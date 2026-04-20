import { dailyChallenges } from "../src/dailyChallenges.ts"
import { parseArgs, printJson } from "./shared.ts"

type UsedLocation = {
  name: string
  region: string
  count: number
  dates: string[]
}

const { options } = parseArgs(process.argv.slice(2))
const format = String(options.format ?? "json")

const locations = new Map<string, UsedLocation>()

for (const [dateKey, targets] of Object.entries(dailyChallenges)) {
  for (const target of targets) {
    const key = `${target.name}::${target.region}`.toLowerCase()
    const existing = locations.get(key)

    if (existing) {
      existing.count += 1
      existing.dates.push(dateKey)
      continue
    }

    locations.set(key, {
      name: target.name,
      region: target.region,
      count: 1,
      dates: [dateKey],
    })
  }
}

const usedLocations = [...locations.values()].sort((left, right) => {
  if (left.name === right.name) {
    return left.region.localeCompare(right.region)
  }

  return left.name.localeCompare(right.name)
})

if (format === "prompt") {
  console.log(usedLocations.map((location) => `${location.name}, ${location.region}`).join("; "))
} else {
  printJson({
    count: usedLocations.length,
    usedLocations,
  })
}
