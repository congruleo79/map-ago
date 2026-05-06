import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { fail, parseArgs } from "./shared.ts"

function sleep(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

type ChallengeEntry = {
  name: string
  region: string
  text: string
  link: string | null
}

type ChallengeInput = Record<string, ChallengeEntry[]>

type SearchResult = {
  id: string
  label?: string
  description?: string
  concepturi?: string
}

type SearchResponse = {
  search?: SearchResult[]
}

type EntityClaimValue = {
  latitude: number
  longitude: number
  precision?: number
  globe?: string
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
        P625?: Array<{
          mainsnak?: {
            datavalue?: {
              value?: EntityClaimValue
            }
          }
        }>
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

type WikipediaQueryResponse = {
  query?: {
    normalized?: Array<{
      from: string
      to: string
    }>
    redirects?: Array<{
      from: string
      to: string
    }>
    pages?: Record<
      string,
      {
        title?: string
        missing?: boolean
      }
    >
  }
}

type ResolvedLocation = {
  id: string
  label: string
  description: string | null
  source: string
  coordinates: {
    lat: number
    lng: number
  }
  articleTitle: string | null
  articleUrl: string | null
}

const ISO_COUNTRY_CODES: Record<string, string> = {
  Afghanistan: "AF",
  Algeria: "DZ",
  Argentina: "AR",
  Aruba: "AW",
  Australia: "AU",
  Bangladesh: "BD",
  Bolivia: "BO",
  Brazil: "BR",
  Canada: "CA",
  Chile: "CL",
  China: "CN",
  "Czech Republic": "CZ",
  Denmark: "DK",
  "Dominican Republic": "DO",
  Egypt: "EG",
  Estonia: "EE",
  Ethiopia: "ET",
  France: "FR",
  Gabon: "GA",
  Georgia: "GE",
  Germany: "DE",
  Greece: "GR",
  India: "IN",
  Indonesia: "ID",
  Iraq: "IQ",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Japan: "JP",
  Lithuania: "LT",
  Mali: "ML",
  Malta: "MT",
  Mexico: "MX",
  Monaco: "MC",
  Morocco: "MA",
  Mozambique: "MZ",
  Namibia: "NA",
  Nepal: "NP",
  Netherlands: "NL",
  Nicaragua: "NI",
  Nigeria: "NG",
  "North Macedonia": "MK",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  "Puerto Rico": "PR",
  "South Africa": "ZA",
  "South Korea": "KR",
  Sweden: "SE",
  Switzerland: "CH",
  Syria: "SY",
  Tanzania: "TZ",
  Thailand: "TH",
  "The Gambia": "GM",
  Ukraine: "UA",
  "United Kingdom": "GB",
  "United States": "US",
  Uzbekistan: "UZ",
  "Vatican City": "VA",
  Venezuela: "VE",
  Vietnam: "VN",
  "West Bank": "PS",
}

let requestDelayMs = 1000
let lastRequestAt = 0

function getIsoCountryCode(region: string) {
  return ISO_COUNTRY_CODES[region]
}

async function throttledFetch(url: string | URL, init?: RequestInit) {
  const elapsedMs = Date.now() - lastRequestAt

  if (lastRequestAt !== 0 && elapsedMs < requestDelayMs) {
    await sleep(requestDelayMs - elapsedMs)
  }

  const response = await fetch(url, init)
  lastRequestAt = Date.now()

  return response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function validateInput(value: unknown): ChallengeInput {
  if (!isRecord(value)) {
    fail("Input JSON must be an object keyed by date.")
  }

  const parsedEntries = Object.entries(value).map(([dateKey, rawEntries]) => {
    if (!Array.isArray(rawEntries)) {
      fail(`Expected an array for ${dateKey}.`)
    }

    const entries = rawEntries.map((rawEntry, index) => {
      if (!isRecord(rawEntry)) {
        fail(`Expected an object for ${dateKey}[${index}].`)
      }

      const name = typeof rawEntry.name === "string" ? rawEntry.name.trim() : ""
      const region = typeof rawEntry.region === "string" ? rawEntry.region.trim() : ""
      const text = typeof rawEntry.text === "string" ? rawEntry.text.trim() : ""
      const link = typeof rawEntry.link === "string" ? rawEntry.link.trim() : null

      if (!name || !region || !text) {
        fail(`Expected ${dateKey}[${index}] to contain non-empty name, region, and text fields.`)
      }

      return {
        name,
        region,
        text,
        link: link || null,
      }
    })

    return [dateKey, entries] as const
  })

  return Object.fromEntries(parsedEntries)
}

async function fetchEntities(candidateIds: string[], query: string) {
  const entityUrl = new URL("https://www.wikidata.org/w/api.php")
  entityUrl.searchParams.set("action", "wbgetentities")
  entityUrl.searchParams.set("format", "json")
  entityUrl.searchParams.set("languages", "en")
  entityUrl.searchParams.set("props", "labels|descriptions|claims|sitelinks")
  entityUrl.searchParams.set("ids", candidateIds.join("|"))
  entityUrl.searchParams.set("origin", "*")

  const entityResponse = await throttledFetch(entityUrl, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!entityResponse.ok) {
    fail(`Wikidata entity lookup failed for "${query}" with ${entityResponse.status} ${entityResponse.statusText}`)
  }

  const entityPayload = (await entityResponse.json()) as EntityResponse

  return entityPayload.entities ?? {}
}

async function resolveLocation(name: string, region: string): Promise<ResolvedLocation> {
  const searchQueries = [`${name}, ${region}`, name]

  for (const query of searchQueries) {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php")
    searchUrl.searchParams.set("action", "wbsearchentities")
    searchUrl.searchParams.set("format", "json")
    searchUrl.searchParams.set("language", "en")
    searchUrl.searchParams.set("type", "item")
    searchUrl.searchParams.set("limit", "5")
    searchUrl.searchParams.set("search", query)
    searchUrl.searchParams.set("origin", "*")

    const searchResponse = await throttledFetch(searchUrl, {
      headers: {
        "user-agent": "MapAgo/0.0.0 (local helper script)",
      },
    })

    if (!searchResponse.ok) {
      fail(`Wikidata search failed for "${query}" with ${searchResponse.status} ${searchResponse.statusText}`)
    }

    const searchPayload = (await searchResponse.json()) as SearchResponse
    const candidates = searchPayload.search ?? []

    if (candidates.length === 0) {
      continue
    }

    const candidateIds = candidates.map((candidate) => candidate.id)
    const entities = await fetchEntities(candidateIds, query)
    const candidateEntities = candidates.map((candidate) => ({
      candidate,
      entity: entities[candidate.id] ?? null,
    }))

    const normalizedName = name.toLowerCase()
    const normalizedRegion = region.toLowerCase()
    const preferredCandidate =
      candidateEntities.find(({ candidate, entity }) => {
        const label = (entity?.labels?.en?.value ?? candidate.label ?? "").toLowerCase()
        const description = (entity?.descriptions?.en?.value ?? candidate.description ?? "").toLowerCase()

        return label === normalizedName && description.includes(normalizedRegion) && Boolean(entity?.claims?.P625?.length)
      }) ??
      candidateEntities.find(({ candidate, entity }) => {
        const label = (entity?.labels?.en?.value ?? candidate.label ?? "").toLowerCase()

        return label === normalizedName && Boolean(entity?.claims?.P625?.length)
      }) ??
      candidateEntities.find(({ entity }) => Boolean(entity?.claims?.P625?.length))

    if (!preferredCandidate) {
      continue
    }

    const coordinateValue = preferredCandidate.entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value

    if (!coordinateValue) {
      continue
    }

    return {
      id: preferredCandidate.candidate.id,
      label: preferredCandidate.entity?.labels?.en?.value ?? preferredCandidate.candidate.label ?? name,
      description: preferredCandidate.entity?.descriptions?.en?.value ?? preferredCandidate.candidate.description ?? null,
      source: preferredCandidate.candidate.concepturi ?? `https://www.wikidata.org/wiki/${preferredCandidate.candidate.id}`,
      coordinates: {
        lat: coordinateValue.latitude,
        lng: coordinateValue.longitude,
      },
      articleTitle: preferredCandidate.entity?.sitelinks?.enwiki?.title ?? null,
      articleUrl: preferredCandidate.entity?.sitelinks?.enwiki?.url ?? null,
    }
  }

  fail(`Could not resolve coordinates for ${name}, ${region}.`)
}

function normalizeArticleInput(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return ""
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed)

    if (!url.pathname.startsWith("/wiki/")) {
      fail(`Unsupported Wikipedia URL: ${trimmed}`)
    }

    return decodeURIComponent(url.pathname.slice("/wiki/".length)).replace(/ /g, "_")
  }

  return trimmed.replace(/ /g, "_")
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
  }
}

async function resolveWikipediaArticleTitle(articleInput: string) {
  const article = normalizeArticleInput(articleInput)

  if (!article) {
    return null
  }

  const queryUrl = new URL("https://en.wikipedia.org/w/api.php")
  queryUrl.searchParams.set("action", "query")
  queryUrl.searchParams.set("format", "json")
  queryUrl.searchParams.set("redirects", "1")
  queryUrl.searchParams.set("titles", article.replace(/_/g, " "))
  queryUrl.searchParams.set("origin", "*")

  const response = await throttledFetch(queryUrl, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!response.ok) {
    fail(`Wikipedia title lookup failed for "${articleInput}" with ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as WikipediaQueryResponse
  const pages = Object.values(payload.query?.pages ?? {})
  const existingPage = pages.find((page) => !page.missing && page.title)

  return existingPage?.title?.replace(/ /g, "_") ?? null
}

async function fetchViews(articleInput: string, months: number, endMonth: { year: number; month: number }) {
  const article = await resolveWikipediaArticleTitle(articleInput)

  if (!article) {
    console.warn(`No resolvable Wikipedia article found for pageviews: ${articleInput}`)
    return 0
  }

  const range = getRange(months, endMonth.year, endMonth.month)
  const response = await throttledFetch(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/monthly/${range.start}/${range.end}`,
    {
      headers: {
        "user-agent": "MapAgo/0.0.0 (local helper script)",
      },
    },
  )

  if (!response.ok) {
    if (response.status === 404) {
      console.warn(`No pageviews entry found for ${articleInput}; using 0 views.`)
      return 0
    }

    fail(`Wikipedia pageviews request failed for "${articleInput}" with ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as PageviewsResponse

  return (payload.items ?? []).reduce((sum, item) => sum + item.views, 0)
}

const { options } = parseArgs(process.argv.slice(2))
const inputPath = path.resolve(process.cwd(), String(options.input ?? "src/dailyChallengeIdeas.json"))
const outputPath = path.resolve(process.cwd(), String(options.output ?? "src/dailyChallenges.json"))
const months = Number(options.months ?? 12)
const delayMs = Number(options.delayMs ?? options.delay ?? 1000)

if (!Number.isInteger(months) || months <= 0) {
  fail("--months must be a positive integer")
}

if (!Number.isInteger(delayMs) || delayMs < 0) {
  fail("--delay-ms must be a non-negative integer")
}

requestDelayMs = delayMs

const endMonth = typeof options.end === "string" ? parseMonthInput(options.end) : getDefaultEndMonth()
const rawInput = await readFile(inputPath, "utf8")
const input = validateInput(JSON.parse(rawInput) as unknown)
const output: Record<
  string,
  Array<{
    name: string
    region: string
    isoCountryCode?: string
    text: string
    link: string
    source: string
    views: number
    coordinates: {
      lat: number
      lng: number
    }
  }>
> = {}

for (const [dateKey, entries] of Object.entries(input)) {
  output[dateKey] = []

  for (const entry of entries) {
    const resolvedLocation = await resolveLocation(entry.name, entry.region)
    const link = entry.link ?? resolvedLocation.articleUrl
    const viewsSource = resolvedLocation.articleTitle ?? resolvedLocation.articleUrl ?? entry.name

    if (!link) {
      fail(`Missing Wikipedia link for ${entry.name}, ${entry.region}.`)
    }

    const views = await fetchViews(viewsSource, months, endMonth)

    output[dateKey].push({
      name: entry.name,
      region: entry.region,
      isoCountryCode: getIsoCountryCode(entry.region),
      text: entry.text,
      link,
      source: resolvedLocation.source,
      views,
      coordinates: resolvedLocation.coordinates,
    })
  }
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8")
console.log(`Wrote ${path.relative(process.cwd(), outputPath)} from ${path.relative(process.cwd(), inputPath)}`)
