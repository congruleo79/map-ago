MapAgo is a daily guessing game, where you guess 5 locations on a map that somehow, maybe even loosely relate thematically to the current date. Locations can be places where something happened on that day, a city, monument or natural formation related to these events, birthplaces, etc. or maybe even only relate to a theme, e.g. February 14, Valentines day could feature locations associated with Love, like Paris.

I want you to curate a list of 5 interesting locations for each day between May 2 and May 9 and output them into the JSON file at `src/dailyChallenges.json`.

All Locations need to be NEW locations, that have never been used before.

1. Use `npm run ai:used-locations -- --format prompt` to see which locations have already been used, so you don't duplicate locations

2. Then source events from wikipedia:

- `npm run ai:events -- --date ...` to receive events/festivities for a certain date from wikipedia
- you can query wikipedia yourself when more research on an article is needed

3. Use

- `npm run ai:coordinates` to get the coordinates for a location
- `npm run ai:views` to get the views for a location. This returns how many wikipedia page views a certain location (e.g. city) has an thus how well known / difiicult to gues it is

Requirements:

- Output valid JSON only.
- Each date must contain an array of 5 objects.
- Each object must contain exactly these fields:
  - `name`
  - `region`
  - `isoCountryCode`
  - `text`
  - `link`
  - `views`
  - `coordinates`

- `name` must be the name of the location (e.g. city, monument, formation)
- `region` must be the name of the containing region, usually a country
- `isoCountryCode` must be a 2 letter ISO code
- `text` must be 3-4 sentences, which can be shown to players, elaborating on how this city is connected to that day and sparking curiosity.
- `text` must begin with `On {Month} {Day}`, when referring to a past event on that day.
- `link` must be a single English Wikipedia article URL thats the source for the "text".
- `views` must be the number of views of the wikipedia article of that location (not the event, but the location!), determining how well known it is and inversely how hard it is to guess
- `coordinates` must be in this format `{ "lat": number, "lng": number }` and be EXACTLY the coordinates of the location to guess.
- Locations can be cities or other specific point locations, NOT vague regions.

- Keep the set globally and thematicaly diverse:
  - no country more than twice per day
  - avoid anglo-american-centric view on the world
  - Avoid specific events that occur too often already like plane crashes
  - at least 4 continents represented per day
  - varied domains such as politics, science, war, culture, sport, disasters, exploration, religion, or technology
- Do not re-use locations already present in the used-locations list.

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
      },
      "isoCountryCode": "US"
    }
  ]
}
```
