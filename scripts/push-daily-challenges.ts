import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import { fail, parseArgs } from "./shared.ts"

type DailyChallengeLocation = {
  name: string
  region?: string
  isoCountryCode?: string
  text?: string
  link?: string
  source?: string
  views?: number
  coordinates?: {
    lat?: number
    lng?: number
  }
}

type DailyChallengeEntry = {
  theme?: {
    title?: string
  }
  locations?: DailyChallengeLocation[]
}

type DailyChallengesFile = Record<string, DailyChallengeEntry>

type SeedLocation = {
  name: string
  region?: string
  isoCountryCode?: string
  description?: string
  latitude: number
  longitude: number
  sourceLink?: string
  locationLink?: string
  pageViews?: number
}

type SeedPayload = {
  name: string
  locations: SeedLocation[]
}

type EventPageCandidate = {
  title: string
  normalizedTitle: string
}

type EventNote = {
  dateKey: string
  text: string
  pages: EventPageCandidate[]
}

const inferredEventPageCache = new Map<string, string | null>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function loadDotEnvFile(filePath: string) {
  try {
    const rawFile = await readFile(filePath, "utf8")

    for (const line of rawFile.split(/\r?\n/u)) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      const equalsIndex = trimmedLine.indexOf("=")

      if (equalsIndex <= 0) {
        continue
      }

      const key = trimmedLine.slice(0, equalsIndex).trim()

      if (!key || process.env[key] !== undefined) {
        continue
      }

      let value = trimmedLine.slice(equalsIndex + 1).trim()

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function normalizeTitle(value: string) {
  return decodeURIComponent(value)
    .replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//u, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getWikipediaArticleTitle(link: string | undefined) {
  if (!link || !isHttpUrl(link)) {
    return null
  }

  const parsedUrl = new URL(link)

  if (parsedUrl.hostname !== "en.wikipedia.org" || !parsedUrl.pathname.startsWith("/wiki/")) {
    return null
  }

  return decodeURIComponent(parsedUrl.pathname.slice("/wiki/".length))
}

function buildWikipediaArticleUrl(title: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
}

async function resolveWikipediaArticleFromTitle(title: string) {
  const cacheKey = title.trim()

  if (inferredEventPageCache.has(cacheKey)) {
    return inferredEventPageCache.get(cacheKey) ?? null
  }

  const apiUrl = new URL("https://en.wikipedia.org/w/api.php")
  apiUrl.searchParams.set("action", "opensearch")
  apiUrl.searchParams.set("search", cacheKey)
  apiUrl.searchParams.set("limit", "1")
  apiUrl.searchParams.set("namespace", "0")
  apiUrl.searchParams.set("format", "json")
  apiUrl.searchParams.set("origin", "*")

  const response = await fetch(apiUrl, {
    headers: {
      "user-agent": "MapAgoHelpers/0.1.0 (local helper script)",
    },
  })

  if (!response.ok) {
    inferredEventPageCache.set(cacheKey, null)
    return null
  }

  const payload = (await response.json()) as [string, string[], string[], string[]]
  const url = Array.isArray(payload?.[3]) ? payload[3][0] : null
  inferredEventPageCache.set(cacheKey, url ?? null)

  return url ?? null
}

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
  } catch {
    return false
  }
}

function readBooleanOption(value: string | boolean | undefined) {
  if (value === undefined) {
    return false
  }

  if (typeof value === "boolean") {
    return value
  }

  const normalizedValue = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false
  }

  fail(`Expected a boolean value but received "${value}".`)
}

function validateDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    fail(`Expected an ISO date key like YYYY-MM-DD but received "${dateKey}".`)
  }

  return dateKey
}

function parseChallengesFile(value: unknown): DailyChallengesFile {
  if (!isRecord(value)) {
    fail("dailyChallenges JSON must be an object keyed by date.")
  }

  return value as DailyChallengesFile
}

async function resolveEventNotesFiles(explicitPath: string | null) {
  if (explicitPath) {
    return [path.resolve(process.cwd(), explicitPath)]
  }

  const tmpDirectory = path.resolve(process.cwd(), "tmp")

  try {
    const fileNames = await readdir(tmpDirectory)

    return fileNames
      .filter((fileName) => fileName.endsWith("_events.txt"))
      .map((fileName) => path.join(tmpDirectory, fileName))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }

    throw error
  }
}

async function loadEventNotes(filePaths: string[]) {
  const notesByDate = new Map<string, EventNote[]>()

  for (const filePath of filePaths) {
    const rawFile = await readFile(filePath, "utf8")
    let currentDateKey: string | null = null
    let pendingText: string | null = null

    for (const line of rawFile.split(/\r?\n/u)) {
      const sectionMatch = /^===\s+(\d{4}-\d{2}-\d{2})\s+===$/u.exec(line.trim())

      if (sectionMatch) {
        currentDateKey = sectionMatch[1]
        pendingText = null
        continue
      }

      if (!currentDateKey || !line.startsWith("- ")) {
        if (currentDateKey && pendingText && line.startsWith("  pages: ")) {
          const pages = line
            .slice("  pages: ".length)
            .split(" | ")
            .map((entry) => entry.replace(/\s*@[-\d.,]+$/u, "").trim())
            .filter(Boolean)
            .map((title) => ({
              title,
              normalizedTitle: normalizeTitle(title),
            }))

          if (pages.length > 0) {
            const existingNotes = notesByDate.get(currentDateKey) ?? []
            existingNotes.push({
              dateKey: currentDateKey,
              text: pendingText,
              pages,
            })
            notesByDate.set(currentDateKey, existingNotes)
          }

          pendingText = null
        }

        continue
      }

      pendingText = line.slice(2).trim()
    }
  }

  return notesByDate
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .map((token) => token.replace(/(ing|ed|es|s)$/u, ""))
}

function scoreCandidateAgainstText(candidate: EventPageCandidate, text: string) {
  const textTokens = new Set(tokenize(text))
  let score = 0

  for (const token of tokenize(candidate.title)) {
    if (textTokens.has(token)) {
      score += 2
    }
  }

  return score
}

function getEventSpecificityBonus(candidate: EventPageCandidate, locationName: string) {
  const eventKeywords = [
    "attack",
    "war",
    "revolt",
    "battle",
    "bomb",
    "earthquake",
    "massacre",
    "riot",
    "trial",
    "fire",
    "declaration",
    "treaty",
    "agreement",
    "uprising",
    "siege",
    "storm",
    "crash",
    "shooting",
    "explosion",
  ]
  const candidateTokens = new Set(tokenize(candidate.title))
  const normalizedLocationName = normalizeTitle(locationName)

  if (!candidate.normalizedTitle.includes(normalizedLocationName)) {
    return 0
  }

  return eventKeywords.some((keyword) => candidateTokens.has(keyword)) ? 2 : 0
}

function pickBestEventPage(note: EventNote, locationName: string, locationLink: string | undefined, challengeText: string) {
  const normalizedLocationName = normalizeTitle(locationName)
  const normalizedLocationLinkTitle = normalizeTitle(getWikipediaArticleTitle(locationLink) ?? locationName)
  const yearMatch = /On\s+[A-Za-z]+\s+\d{1,2},\s+(\d{3,4})/u.exec(challengeText)
  const year = yearMatch?.[1]

  const locationPage = note.pages.find((page) => {
    return page.normalizedTitle === normalizedLocationLinkTitle || page.normalizedTitle === normalizedLocationName
  })

  const eventCandidates = note.pages.filter((page) => page !== locationPage)
  const bestEventPage = [...eventCandidates].sort((left, right) => {
    const leftScore =
      scoreCandidateAgainstText(left, challengeText) +
      (year && left.title.includes(year) ? 4 : 0) +
      getEventSpecificityBonus(left, locationName)
    const rightScore =
      scoreCandidateAgainstText(right, challengeText) +
      (year && right.title.includes(year) ? 4 : 0) +
      getEventSpecificityBonus(right, locationName)

    return rightScore - leftScore
  })[0]

  return {
    locationPage,
    eventPage: bestEventPage,
  }
}

function findMatchingEventNote(notes: EventNote[], location: DailyChallengeLocation) {
  const locationName = typeof location.name === "string" ? location.name.trim() : ""
  const locationLinkTitle = getWikipediaArticleTitle(typeof location.link === "string" ? location.link : undefined)
  const normalizedLocationName = normalizeTitle(locationName)
  const normalizedLocationLinkTitle = normalizeTitle(locationLinkTitle ?? locationName)
  const challengeText = typeof location.text === "string" ? location.text.trim() : ""

  const locationNamePattern = new RegExp(`\\b${escapeRegExp(normalizedLocationName)}\\b`, "u")
  const matchingNotes = notes.filter(
    (note) =>
      note.pages.some((page) => page.normalizedTitle === normalizedLocationLinkTitle || page.normalizedTitle === normalizedLocationName) ||
      locationNamePattern.test(normalizeTitle(note.text)),
  )

  return [...matchingNotes].sort((left, right) => {
    const leftScore = scoreCandidateAgainstText({ title: left.text, normalizedTitle: normalizeTitle(left.text) }, challengeText)
    const rightScore = scoreCandidateAgainstText({ title: right.text, normalizedTitle: normalizeTitle(right.text) }, challengeText)

    return rightScore - leftScore
  })[0]
}

async function toSeedLocation(
  dateKey: string,
  location: DailyChallengeLocation,
  index: number,
  notesByDate: Map<string, EventNote[]>,
  requireDistinctLinks: boolean,
): Promise<SeedLocation> {
  const locationLabel = `${dateKey} location ${index + 1}`
  const name = typeof location.name === "string" ? location.name.trim() : ""

  if (!name) {
    fail(`Missing name for ${locationLabel}.`)
  }

  if (!location.coordinates || typeof location.coordinates.lat !== "number" || !Number.isFinite(location.coordinates.lat)) {
    fail(`Missing valid latitude for ${locationLabel} (${name}).`)
  }

  if (!location.coordinates || typeof location.coordinates.lng !== "number" || !Number.isFinite(location.coordinates.lng)) {
    fail(`Missing valid longitude for ${locationLabel} (${name}).`)
  }

  const region = typeof location.region === "string" ? location.region.trim() : undefined
  const isoCountryCode = typeof location.isoCountryCode === "string" ? location.isoCountryCode.trim().toUpperCase() : undefined
  const description = typeof location.text === "string" ? location.text.trim() : undefined
  const inputLink = typeof location.link === "string" ? location.link.trim() : undefined
  const notes = notesByDate.get(dateKey) ?? []
  const matchingNote = findMatchingEventNote(notes, location)
  const inferredPages = matchingNote ? pickBestEventPage(matchingNote, name, inputLink, description ?? "") : null
  const locationLink = inferredPages?.locationPage ? buildWikipediaArticleUrl(inferredPages.locationPage.title) : inputLink
  let sourceLink = inferredPages?.eventPage ? buildWikipediaArticleUrl(inferredPages.eventPage.title) : inputLink

  if ((!sourceLink || sourceLink === locationLink) && matchingNote) {
    const inferredEventUrl = await resolveWikipediaArticleFromTitle(matchingNote.text)

    if (inferredEventUrl && inferredEventUrl !== locationLink) {
      sourceLink = inferredEventUrl
    }
  }
  const pageViews = typeof location.views === "number" && Number.isFinite(location.views) ? location.views : undefined

  if (isoCountryCode && !/^[A-Z]{2}$/.test(isoCountryCode)) {
    fail(`Invalid ISO country code for ${locationLabel} (${name}): "${isoCountryCode}".`)
  }

  if (sourceLink && !isHttpUrl(sourceLink)) {
    fail(`Invalid source link for ${locationLabel} (${name}): "${sourceLink}".`)
  }

  if (locationLink && !isHttpUrl(locationLink)) {
    fail(`Invalid location link for ${locationLabel} (${name}): "${locationLink}".`)
  }

  if (requireDistinctLinks && (!sourceLink || !locationLink || sourceLink === locationLink)) {
    fail(`Could not derive distinct sourceLink and locationLink for ${locationLabel} (${name}).`)
  }

  return {
    name,
    region,
    isoCountryCode,
    description,
    latitude: location.coordinates.lat,
    longitude: location.coordinates.lng,
    sourceLink,
    locationLink,
    pageViews,
  }
}

async function toSeedPayload(
  dateKey: string,
  challenge: DailyChallengeEntry,
  fallbackName: string,
  notesByDate: Map<string, EventNote[]>,
  requireDistinctLinks: boolean,
): Promise<SeedPayload> {
  if (!Array.isArray(challenge.locations)) {
    fail(`Expected ${dateKey} to contain a locations array.`)
  }

  if (challenge.locations.length !== 5) {
    fail(`Expected ${dateKey} to contain exactly 5 locations, found ${challenge.locations.length}.`)
  }

  const title = typeof challenge.theme?.title === "string" && challenge.theme.title.trim() ? challenge.theme.title.trim() : fallbackName

  return {
    name: title,
    locations: await Promise.all(
      challenge.locations.map((location, index) => toSeedLocation(dateKey, location, index, notesByDate, requireDistinctLinks)),
    ),
  }
}

function resolveEndpointPath(dateKey: string, endpointTemplate: string | null) {
  if (endpointTemplate) {
    return endpointTemplate.replaceAll("{date}", dateKey)
  }

  return `/admin/games/${dateKey}/seed`
}

async function uploadGame(baseUrl: URL, endpointPath: string, adminToken: string, payload: SeedPayload, dryRun: boolean) {
  const targetUrl = new URL(endpointPath, baseUrl)

  if (dryRun) {
    return {
      ok: true,
      status: 0,
      statusText: "DRY_RUN",
      url: targetUrl.toString(),
      body: null,
    }
  }

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify(payload),
  })

  let body: unknown = null

  try {
    body = (await response.json()) as unknown
  } catch {
    body = null
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: targetUrl.toString(),
    body,
  }
}

const { options } = parseArgs(process.argv.slice(2))
await loadDotEnvFile(path.resolve(process.cwd(), ".env"))
const inputPath = path.resolve(process.cwd(), String(options.input ?? "src/dailyChallenges.json"))
const baseUrlInput = String(options["base-url"] ?? process.env.MAPAGO_API_BASE_URL ?? "https://mapago-backend.map-ago.workers.dev/")
const adminToken = String(options["admin-token"] ?? process.env.MAPAGO_ADMIN_TOKEN ?? process.env.ADMIN_SEED_TOKEN ?? "").trim()
const endpointTemplateInput =
  typeof options["endpoint-template"] === "string"
    ? options["endpoint-template"].trim()
    : typeof process.env.MAPAGO_ADMIN_SEED_PATH_TEMPLATE === "string"
      ? process.env.MAPAGO_ADMIN_SEED_PATH_TEMPLATE.trim()
      : ""
const explicitDateInput = typeof options.date === "string" ? validateDateKey(options.date) : null
const fromDateKey = typeof options.from === "string" ? validateDateKey(options.from) : getLocalDateKey(new Date())
const throughDateKey = typeof options.through === "string" ? validateDateKey(options.through) : null
const includeToday = readBooleanOption(options["include-today"])
const dryRun = readBooleanOption(options["dry-run"])
const continueOnError = readBooleanOption(options["continue-on-error"])
const printPayload = readBooleanOption(options["print-payload"])
const requireDistinctLinks = readBooleanOption(options["require-distinct-links"])
const fallbackName = typeof options.name === "string" && options.name.trim() ? options.name.trim() : "Daily Challenge"
const eventNotesPath = typeof options["events-notes"] === "string" ? options["events-notes"].trim() : null

if (!adminToken && !dryRun) {
  fail("Missing admin token. Pass --admin-token or set MAPAGO_ADMIN_TOKEN / ADMIN_SEED_TOKEN.")
}

const baseUrl = new URL(baseUrlInput)
const rawInput = await readFile(inputPath, "utf8")
const challenges = parseChallengesFile(JSON.parse(rawInput) as unknown)
const eventNotesFiles = await resolveEventNotesFiles(eventNotesPath)
const notesByDate = await loadEventNotes(eventNotesFiles)
const sortedDateKeys = Object.keys(challenges).sort()

const selectedDateKeys = explicitDateInput
  ? [explicitDateInput]
  : sortedDateKeys.filter((dateKey) => {
      if (dateKey < fromDateKey || (!includeToday && dateKey === fromDateKey)) {
        return false
      }

      if (throughDateKey && dateKey > throughDateKey) {
        return false
      }

      return true
    })

if (selectedDateKeys.length === 0) {
  console.log("No matching dates found to upload.")
  process.exit(0)
}

const endpointTemplate = endpointTemplateInput || null
const failures: string[] = []

for (const dateKey of selectedDateKeys) {
  const challenge = challenges[dateKey]

  if (!challenge) {
    fail(`No challenge found for ${dateKey}.`)
  }

  const payload = await toSeedPayload(dateKey, challenge, fallbackName, notesByDate, requireDistinctLinks)
  const endpointPath = resolveEndpointPath(dateKey, endpointTemplate)

  if (printPayload) {
    console.log(JSON.stringify({ dateKey, endpointPath, payload }, null, 2))
  }

  const result = await uploadGame(baseUrl, endpointPath, adminToken, payload, dryRun)

  if (!result.ok) {
    const errorSummary = `${dateKey}: ${result.status} ${result.statusText}`
    failures.push(errorSummary)
    console.error(`Failed ${dateKey} -> ${result.url}`)

    if (result.body) {
      console.error(JSON.stringify(result.body, null, 2))
    }

    if (!continueOnError) {
      fail(`Upload aborted after failure: ${errorSummary}`)
    }

    continue
  }

  if (dryRun) {
    console.log(`DRY RUN ${dateKey} -> ${result.url}`)
    continue
  }

  console.log(`Uploaded ${dateKey} -> ${result.url} (${result.status})`)
}

if (failures.length > 0) {
  fail(`Completed with ${failures.length} failure(s): ${failures.join("; ")}`)
}

console.log(`Finished ${dryRun ? "dry run for" : "uploading"} ${selectedDateKeys.length} game(s).`)
