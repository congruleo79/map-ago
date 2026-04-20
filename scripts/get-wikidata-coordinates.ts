import { dedupeStrings, fail, parseArgs, printJson, readStdin } from "./shared.ts"

type SearchResult = {
  id: string
  label?: string
  description?: string
  concepturi?: string
  match?: {
    language?: string
    text?: string
    type?: string
  }
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
      labels?: Record<string, { value: string }>
      descriptions?: Record<string, { value: string }>
      claims?: {
        P625?: Array<{
          mainsnak?: {
            datavalue?: {
              value?: EntityClaimValue
            }
          }
        }>
      }
    }
  >
}

type CoordinateLookupResult = {
  query: string
  id: string | null
  label: string | null
  description: string | null
  source: string | null
  coordinates: {
    lat: number
    lng: number
    precision: number | null
    globe: string | null
  } | null
  searchMatch: string | null
  error: string | null
}

async function resolveLocation(name: string): Promise<CoordinateLookupResult> {
  const searchUrl = new URL("https://www.wikidata.org/w/api.php")
  searchUrl.searchParams.set("action", "wbsearchentities")
  searchUrl.searchParams.set("format", "json")
  searchUrl.searchParams.set("language", "en")
  searchUrl.searchParams.set("type", "item")
  searchUrl.searchParams.set("limit", "5")
  searchUrl.searchParams.set("search", name)
  searchUrl.searchParams.set("origin", "*")

  const searchResponse = await fetch(searchUrl, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!searchResponse.ok) {
    fail(`Wikidata search failed for "${name}" with ${searchResponse.status} ${searchResponse.statusText}`)
  }

  const searchPayload = (await searchResponse.json()) as SearchResponse
  const [bestMatch] = searchPayload.search ?? []

  if (!bestMatch) {
    return {
      query: name,
      id: null,
      label: null,
      description: null,
      source: null,
      coordinates: null,
      searchMatch: null,
      error: "No Wikidata match found",
    }
  }

  const entityResponse = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${bestMatch.id}.json`, {
    headers: {
      "user-agent": "MapAgo/0.0.0 (local helper script)",
    },
  })

  if (!entityResponse.ok) {
    fail(`Wikidata entity lookup failed for "${name}" with ${entityResponse.status} ${entityResponse.statusText}`)
  }

  const entityPayload = (await entityResponse.json()) as EntityResponse
  const entity = entityPayload.entities?.[bestMatch.id]
  const coordinateValue = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value

  return {
    query: name,
    id: bestMatch.id,
    label: entity?.labels?.en?.value ?? bestMatch.label ?? name,
    description: entity?.descriptions?.en?.value ?? bestMatch.description ?? null,
    source: bestMatch.concepturi ?? `https://www.wikidata.org/wiki/${bestMatch.id}`,
    coordinates: coordinateValue
      ? {
          lat: coordinateValue.latitude,
          lng: coordinateValue.longitude,
          precision: coordinateValue.precision ?? null,
          globe: coordinateValue.globe ?? null,
        }
      : null,
    searchMatch: bestMatch.match?.text ?? null,
    error: null,
  }
}

const { positional, options } = parseArgs(process.argv.slice(2))
const fromArgs = dedupeStrings(positional)
const fromOption = typeof options.locations === "string" ? dedupeStrings(options.locations.split(",")) : []
const fromStdin = process.stdin.isTTY ? [] : dedupeStrings((await readStdin()).split(/\r?\n/))
const queries = dedupeStrings([...fromArgs, ...fromOption, ...fromStdin])

if (queries.length === 0) {
  fail('Usage: npm run ai:coordinates -- Paris "Vatican City" or echo "Paris" | npm run ai:coordinates')
}

const results = []

for (const query of queries) {
  results.push(await resolveLocation(query))
}

printJson({
  count: results.length,
  results,
})
