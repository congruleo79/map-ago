# MapAgo

Vibecoded daily game, where you guess the locations of 5 historical events that happened on this particular date.

## Location sourcing

Locations are AI sourced from Wikipedia & Wikidata

### Helper scripts for AI

Use these scripts to reduce prompt size and push the structured lookup work into deterministic tooling:

```bash
npm run ai:events -- --date 2026-04-16
npm run ai:coordinates -- "Houston" "Monaco" "Tbilisi"
npm run ai:views -- Houston
npm run ai:views -- "https://en.wikipedia.org/wiki/Apollo_13"
npm run ai:used-locations -- --format prompt
```

- `npm run ai:events -- --date YYYY-MM-DD`
  Returns structured JSON from Wikimedia's "On this day" feed for that date, including `events`, `births`, `deaths`, `holidays`, and `selected` entries.
- `npm run ai:coordinates -- <location...>`
  Searches Wikidata for each location, resolves the best-matching entity, and returns the exact `P625` coordinates from the entity data when available.
- `npm run ai:populate -- --input <ideas.json> --output src/dailyChallenges.json`
  Reads a curated JSON file of challenge ideas, resolves Wikidata coordinates for each location, fetches Wikipedia pageviews for each linked article, and writes a fully populated `dailyChallenges.json` without using an LLM.
- `npm run ai:views -- <article-title-or-wikipedia-url...>`
  Returns monthly Wikipedia pageview counts for each article, defaulting to the last 12 complete months. Plain location names like `Houston` are resolved through Wikidata to the canonical English Wikipedia article first. You can also pass `--months N` and `--end YYYY-MM`.
- `npm run ai:used-locations -- --format json|prompt`
  Reads `src/dailyChallenges.ts` and returns the previously used locations either as JSON or as a compact semicolon-separated prompt string.

## Prompt

MapAgo is a daily guessing game, where you guess 5 locations on a map that somehow, maybe even loosely relate to the current date. Locations can be places where something happened on that day, a city, monument or natural formation related to these events, birthplaces, etc. or maybe even the 5 locations of a date could follow a certain theme, e.g. February 14, Valentines day could feature locations associated with Love, like Paris.

I want you to curate a list of 5 interesting locations for April 20 and output them into the JSON file at `src/dailyChallenges.json`.

Use

- `npm run ai:events -- --date ...` to receive events/festivities for a certain date from wikipedia
- `npm run ai:used-locations -- --format prompt` to see which locations have already been used, so you don't duplicate recent locations
- you can query wikipedia yourself when more research on an article is needed
- `npm run ai:coordinates` to get the coordinates for a location
- `npm run ai:views` to get the views for a location

Requirements:

- Output valid JSON only.
- The shape must match the existing JSON file
- Each date must contain an array of 5 objects.

- Each object must contain exactly these fields:
  - `name`
  - `region`
  - `text`
  - `link`
  - `views`
  - `coordinates`
- `name` must be the name of the location (e.g. city, monument, formation)
- `region` must be the name of the containing region, usually a country
- `text` must be 3-4 sentences, which will be shown to players, elaborating on how this city is connected to that day and sparking curiosity.
- `text` must begin with `On {Month} {Day}` and may include a year where useful.
- `link` must be a single English Wikipedia article URL that best supports the explanation.
- `views` must be the number of views of the wikipedia article of that location, determining how well known it is, or inversely how hard it is to guess
- `coordinates` must be in this format `{ "lat": number, "lng": number }` and be EXACTLY the coordinates of the location to guess.
- Locations can be cities or other specific point locations, NOT vague regions.
- Keep the set globally diverse:
  - no country more than twice per day
  - at least 4 continents represented per day
  - varied domains such as politics, science, war, culture, sport, disasters, exploration, religion, or technology
- Do not re-use locations already present in the used-locations list.
- Do not include coordinates, pageviews, or Wikidata IDs. Those will be added later by script.

Expected JSON shape example:

```json
{
  "2026-04-14": [
    {
      "name": "Houston",
      "region": "United States",
      "text": "On April 14, 1970, Mission Control in Houston received the famous Apollo 13 distress call after an oxygen tank failure crippled the spacecraft on its way to the Moon. The line is often remembered as \"Houston, we have a problem,\" but the original transmission was even more immediate: \"Houston, we've had a problem.\"",
      "link": "https://en.wikipedia.org/wiki/Apollo_13",
      "views": 88790,
      "coordinates": {
        "lat": 29.762777777778,
        "lng": -95.383055555556
      }
    }
  ]
}
```
