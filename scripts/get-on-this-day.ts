import { dedupeStrings, fail, normalizeDateInput, parseArgs, printJson } from "./shared.ts"

type WikipediaTopic = {
  normalizedtitle?: string
  titles?: {
    normalized?: string
  }
  title?: string
  description?: string
  extract?: string
  coordinates?: {
    lat: number
    lon: number
  }
  content_urls?: {
    desktop?: {
      page?: string
    }
  }
}

type WikipediaEntry = {
  year: number
  text: string
  pages?: WikipediaTopic[]
}

type WikipediaResponse = {
  events?: WikipediaEntry[]
  births?: WikipediaEntry[]
  deaths?: WikipediaEntry[]
  holidays?: WikipediaEntry[]
  selected?: WikipediaEntry[]
}

const { positional, options } = parseArgs(process.argv.slice(2))
const dateInput = String(options.date ?? positional[0] ?? "")

if (!dateInput) {
  fail("Usage: npm run ai:events -- --date 2026-04-16")
}

const sectionFilter = dedupeStrings(
  String(options.sections ?? "events,births,deaths,holidays,selected")
    .split(",")
    .map((section) => section.toLowerCase()),
)

const { month, day, label } = normalizeDateInput(dateInput)
const response = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`, {
  headers: {
    "user-agent": "MapAgo/0.0.0 (local helper script)",
  },
})

if (!response.ok) {
  fail(`Wikipedia request failed with ${response.status} ${response.statusText}`)
}

const payload = (await response.json()) as WikipediaResponse
const sections = Object.fromEntries(
  sectionFilter.map((sectionName) => {
    const entries = payload[sectionName as keyof WikipediaResponse]

    return [
      sectionName,
      Array.isArray(entries)
        ? entries.map((entry) => ({
            year: entry.year,
            text: entry.text,
            relatedPages: (entry.pages ?? []).map((page) => ({
              title: page.normalizedtitle ?? page.titles?.normalized ?? page.title ?? "",
              // description: page.description ?? null,
              // summary: page.extract ?? null,
              url: page.content_urls?.desktop?.page ?? null,
              coordinates: page.coordinates ?? null,
            })),
          }))
        : [],
    ]
  }),
)

printJson({
  date: label,
  source: `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`,
  sections,
})
