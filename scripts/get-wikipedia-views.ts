import { dedupeStrings, fail, parseArgs, printJson, readStdin } from "./shared.ts"

type SearchResult = {
  id: string
  label?: string
  description?: string
  concepturi?: string
}

type SearchResponse = {
  search?: SearchResult[]
}

type EntityResponse = {
  entities?: Record<
    string,
    {
      sitelinks?: {
        enwiki?: {
          title?: string
          url?: string
        }
      }
      claims?: {
        P625?: Array<unknown>
      }
      labels?: Record<string, { value: string }>
      descriptions?: Record<string, { value: string }>
    }
  >
}

type PageviewsItem = {
  timestamp: string
  views: number
}

type PageviewsResponse = {
  items?: PageviewsItem[]
}

function normalizeArticleInput(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return ""
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed)
    const wikiPrefix = "/wiki/"

    if (!url.pathname.startsWith(wikiPrefix)) {
      fail(`Unsupported Wikipedia URL: ${trimmed}`)
    }

    return decodeURIComponent(url.pathname.slice(wikiPrefix.length)).replace(/ /g, "_")
  }

  return trimmed.replace(/ /g, "_")
}

function isWikipediaUrl(input: string) {
  return input.startsWith("http://") || input.startsWith("https://")
}

async function resolveArticleInput(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      query: input,
      article: "",
      resolvedBy: "empty",
    }
  }

  if (isWikipediaUrl(trimmed)) {
    return {
      query: input,
      article: normalizeArticleInput(trimmed),
      resolvedBy: "url",
    }
  }

  const searchUrl = new URL("https://www.wikidata.org/w/api.php")
  searchUrl.searchParams.set("action", "wbsearchentities")
  searchUrl.searchParams.set("format", "json")
  searchUrl.searchParams.set("language", "en")
  searchUrl.searchParams.set("type", "item")
  searchUrl.searchParams.set("limit", "5")
  searchUrl.searchParams.set("search", trimmed)
  searchUrl.searchParams.set("origin", "*")

  const searchResponse = await fetch(searchUrl, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!searchResponse.ok) {
    fail(`Wikidata search failed for "${trimmed}" with ${searchResponse.status} ${searchResponse.statusText}`)
  }

  const searchPayload = (await searchResponse.json()) as SearchResponse
  const candidates = searchPayload.search ?? []

  if (candidates.length === 0) {
    return {
      query: input,
      article: normalizeArticleInput(trimmed),
      resolvedBy: "literal-fallback",
    }
  }

  const candidateEntities = []

  for (const candidate of candidates) {
    const entityResponse = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${candidate.id}.json`, {
      headers: {
        "user-agent": "MapAgo/0.0.0 (local helper script)",
      },
    })

    if (!entityResponse.ok) {
      fail(`Wikidata entity lookup failed for "${trimmed}" with ${entityResponse.status} ${entityResponse.statusText}`)
    }

    const entityPayload = (await entityResponse.json()) as EntityResponse
    const entity = entityPayload.entities?.[candidate.id]

    candidateEntities.push({
      candidate,
      entity,
    })
  }

  const normalizedQuery = trimmed.toLowerCase()
  const preferredCandidate =
    candidateEntities.find(({ candidate, entity }) => {
      const label = (entity?.labels?.en?.value ?? candidate.label ?? "").toLowerCase()

      return label === normalizedQuery && Boolean(entity?.sitelinks?.enwiki?.title) && Boolean(entity?.claims?.P625?.length)
    }) ??
    candidateEntities.find(({ entity }) => Boolean(entity?.sitelinks?.enwiki?.title) && Boolean(entity?.claims?.P625?.length)) ??
    candidateEntities.find(({ candidate, entity }) => {
      const label = (entity?.labels?.en?.value ?? candidate.label ?? "").toLowerCase()

      return label === normalizedQuery && Boolean(entity?.sitelinks?.enwiki?.title)
    }) ??
    candidateEntities.find(({ entity }) => Boolean(entity?.sitelinks?.enwiki?.title)) ??
    candidateEntities[0]

  const bestMatch = preferredCandidate.candidate
  const entity = preferredCandidate.entity
  const enwikiTitle = entity?.sitelinks?.enwiki?.title

  return {
    query: input,
    article: normalizeArticleInput(enwikiTitle ?? trimmed),
    resolvedBy: enwikiTitle ? "wikidata-enwiki" : "literal-fallback",
    wikidata: {
      id: bestMatch.id,
      label: entity?.labels?.en?.value ?? bestMatch.label ?? trimmed,
      description: entity?.descriptions?.en?.value ?? bestMatch.description ?? null,
      source: bestMatch.concepturi ?? `https://www.wikidata.org/wiki/${bestMatch.id}`,
      articleUrl: entity?.sitelinks?.enwiki?.url ?? null,
    },
  }
}

function parseMonthInput(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())

  if (!match) {
    fail('Expected a month like "2026-03" for --end.')
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (month < 1 || month > 12) {
    fail('Expected a month like "2026-03" for --end.')
  }

  return { year, month }
}

function getDefaultEndMonth() {
  const current = new Date()
  const year = current.getUTCFullYear()
  const month = current.getUTCMonth()

  if (month === 0) {
    return { year: year - 1, month: 12 }
  }

  return { year, month }
}

function getRange(monthCount: number, endYear: number, endMonth: number) {
  const start = new Date(Date.UTC(endYear, endMonth - monthCount, 1))
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1))

  const startYear = start.getUTCFullYear()
  const startMonth = String(start.getUTCMonth() + 1).padStart(2, "0")
  const finalYear = end.getUTCFullYear()
  const finalMonth = String(end.getUTCMonth() + 1).padStart(2, "0")

  return {
    start: `${startYear}${startMonth}0100`,
    end: `${finalYear}${finalMonth}3100`,
    labelStart: `${startYear}-${startMonth}`,
    labelEnd: `${finalYear}-${finalMonth}`,
  }
}

const { positional, options } = parseArgs(process.argv.slice(2))
const fromArgs = dedupeStrings(positional)
const fromOption = typeof options.articles === "string" ? dedupeStrings(options.articles.split(",")) : []
const fromStdin = process.stdin.isTTY ? [] : dedupeStrings((await readStdin()).split(/\r?\n/))
const articleInputs = dedupeStrings([...fromArgs, ...fromOption, ...fromStdin])
const months = Number(options.months ?? 12)

if (articleInputs.length === 0) {
  fail('Usage: npm run ai:views -- "Apollo_13" or npm run ai:views -- "https://en.wikipedia.org/wiki/Apollo_13"')
}

if (!Number.isInteger(months) || months <= 0) {
  fail("--months must be a positive integer")
}

const endMonth = typeof options.end === "string" ? parseMonthInput(options.end) : getDefaultEndMonth()
const range = getRange(months, endMonth.year, endMonth.month)

const results = []

for (const articleInput of articleInputs) {
  const resolvedInput = await resolveArticleInput(articleInput)
  const article = resolvedInput.article

  if (!article) {
    continue
  }

  const encodedArticle = encodeURIComponent(article)
  const source = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodedArticle}/monthly/${range.start}/${range.end}`
  const response = await fetch(source, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!response.ok) {
    results.push({
      query: resolvedInput.query,
      article,
      resolvedBy: resolvedInput.resolvedBy,
      wikidata: resolvedInput.wikidata ?? null,
      source,
      error: `Pageviews request failed with ${response.status} ${response.statusText}`,
    })
    continue
  }

  const payload = (await response.json()) as PageviewsResponse
  const items = (payload.items ?? []).map((item) => ({
    month: `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}`,
    views: item.views,
  }))

  results.push({
    query: resolvedInput.query,
    article,
    resolvedBy: resolvedInput.resolvedBy,
    wikidata: resolvedInput.wikidata ?? null,
    source,
    totalViews: items.reduce((sum, item) => sum + item.views, 0),
    monthlyViews: items,
  })
}

printJson({
  range: {
    startMonth: range.labelStart,
    endMonth: range.labelEnd,
    months,
  },
  results,
})
