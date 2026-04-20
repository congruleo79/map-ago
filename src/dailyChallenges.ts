import type { LatLngLiteral } from "leaflet"
import dailyChallengesData from "./dailyChallenges.json"

export type LocationTarget = {
  name: string
  region: string
  text?: string
  link?: string
  source?: string
  views?: number
  coordinates: LatLngLiteral
}

export type DailyChallenge = {
  dateKey: string
  targets: LocationTarget[]
}

export const dailyChallenges = dailyChallengesData as Record<string, LocationTarget[]>

const sortedDailyChallenges: Record<string, LocationTarget[]> = Object.fromEntries(
  Object.entries(dailyChallenges).map(([dateKey, targets]) => [dateKey, [...targets].sort((left, right) => (right.views ?? 0) - (left.views ?? 0))]),
)

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const dateKey = getLocalDateKey(date)

  if (sortedDailyChallenges[dateKey]) {
    return {
      dateKey,
      targets: sortedDailyChallenges[dateKey],
    }
  }

  const sortedDates = Object.keys(sortedDailyChallenges).sort()
  const fallbackDate = [...sortedDates].reverse().find((challengeDate) => challengeDate <= dateKey) ?? sortedDates[0]

  return {
    dateKey: fallbackDate,
    targets: sortedDailyChallenges[fallbackDate],
  }
}
