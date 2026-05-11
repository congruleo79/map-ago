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
