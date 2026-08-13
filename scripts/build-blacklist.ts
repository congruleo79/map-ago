import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { fail, parseArgs } from "./shared.ts"

type DailyChallengeLocation = {
  name?: string
  region?: string
}

type DailyChallengeEntry = {
  locations?: DailyChallengeLocation[]
}

type DailyChallengesFile = Record<string, DailyChallengeEntry>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseDailyChallenges(value: unknown): DailyChallengesFile {
  if (!isRecord(value)) {
    fail("dailyChallenges JSON must be an object keyed by date.")
  }

  return value as DailyChallengesFile
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDefaultFromDateKey(today: Date) {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth() - 2, 1))
}

function validateDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    fail(`Expected an ISO date key like YYYY-MM-DD but received "${dateKey}".`)
  }

  return dateKey
}

const { options } = parseArgs(process.argv.slice(2))
const inputPath = path.resolve(process.cwd(), String(options.input ?? "src/dailyChallenges.json"))
const outputPath = path.resolve(process.cwd(), String(options.output ?? "blacklist.txt"))
const today = new Date()
const throughDateKey = typeof options.through === "string" ? validateDateKey(options.through) : getLocalDateKey(today)
const fromDateKey = typeof options.from === "string" ? validateDateKey(options.from) : getDefaultFromDateKey(today)

if (fromDateKey > throughDateKey) {
  fail(`Expected --from (${fromDateKey}) to be on or before --through (${throughDateKey}).`)
}

const rawInput = await readFile(inputPath, "utf8")
const challenges = parseDailyChallenges(JSON.parse(rawInput) as unknown)
const lines: string[] = []

for (const dateKey of Object.keys(challenges).sort()) {
  if (dateKey < fromDateKey || dateKey > throughDateKey) {
    continue
  }

  const challenge = challenges[dateKey]

  if (!Array.isArray(challenge.locations)) {
    continue
  }

  for (const location of challenge.locations) {
    const name = typeof location.name === "string" ? location.name.trim() : ""
    const region = typeof location.region === "string" ? location.region.trim() : ""

    if (!name || !region) {
      fail(`Expected ${dateKey} entries to contain non-empty name and region fields.`)
    }

    lines.push(`${name}, ${region}`)
  }
}

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8")
console.log(`Wrote ${lines.length} locations from ${fromDateKey} through ${throughDateKey} to ${path.relative(process.cwd(), outputPath)}`)