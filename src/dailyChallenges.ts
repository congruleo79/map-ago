import type { LatLngLiteral } from "leaflet"
import dailyChallengesData from "./dailyChallenges.json"

export type LocationTarget = {
  name: string
  region: string
  isoCountryCode?: string
  text?: string
  link?: string
  source?: string
  views?: number
  coordinates: LatLngLiteral
}

export type DailyChallengeTheme = {
  title: string
}

export type DailyChallengeEntry = {
  theme?: DailyChallengeTheme
  locations: LocationTarget[]
}

export type DailyChallenge = {
  dateKey: string
  theme?: DailyChallengeTheme
  targets: LocationTarget[]
}

export const dailyChallenges = dailyChallengesData as Record<string, DailyChallengeEntry>

const sortedDailyChallenges: Record<string, DailyChallengeEntry> = Object.fromEntries(
  Object.entries(dailyChallenges).map(([dateKey, challenge]) => [
    dateKey,
    {
      ...challenge,
      locations: [...challenge.locations].sort((left, right) => (right.views ?? 0) - (left.views ?? 0)),
    },
  ]),
)

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const dateKey = getLocalDateKey(date)
  const selectedChallenge = sortedDailyChallenges[dateKey]

  if (selectedChallenge) {
    return {
      dateKey,
      theme: selectedChallenge.theme,
      targets: selectedChallenge.locations,
    }
  }

  const sortedDates = Object.keys(sortedDailyChallenges).sort()
  const fallbackDate = [...sortedDates].reverse().find((challengeDate) => challengeDate <= dateKey) ?? sortedDates[0]
  const fallbackChallenge = sortedDailyChallenges[fallbackDate]

  return {
    dateKey: fallbackDate,
    theme: fallbackChallenge.theme,
    targets: fallbackChallenge.locations,
  }
}
