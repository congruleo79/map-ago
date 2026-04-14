# MapAgo

Vibecoded daily game, where you guess the locations of 5 historical events that happened on this particular date.

## Location sourcing

Locations are AI sourced from Wikipedia & Wikidata

Example prompt:

```
For a daily map guessing game:

Your task is to select 5 locations with a historical connection to {date}.

- Use wikipedia's article of events that happened on that date
- Generate a list of 10 locations that somehow relate to events on that day
- Locations can be cities, but also other point of interests, as long as they have a specific location.
- The list must be globally and internationally diverse:
  - No single country should appear more than twice
  - It should contain locations are from at least 4 different continents
  - The locations' stories connecting it to the date should be from diverse fields (history, technology, sports, etc.)
- The shouldn't overlap with locations of past quizzes as defined in the `dailyChallenges.ts`

Output a list of locations with

- name
- region
- 2-3 sentence on how this location relates to the date. Start the text with "On April 14 ..." and optionally a year if applicable

Sort the locations by difficulty, i.e. how "hard" they are to guess on a map

Output them into `dailyChallenges.ts` in the following format.

{
name: {name},
region: {country},
text: {An 2-3 sentence introductory description displayed to tell the player about what happened on that Date and spark curiosity. It should start with "On {date} ...". },
link: {A link to english wikipedia article referencing the event, for the user to "Learn more"},
source: {A source to the wikidata, from which the location data and P625 coordinates were confirmed},
views: {The number of pageviews of the english wikipedia article of the location, to determine how well known and inversely, how difficult to guess the location is},
coordinates: { lat: {latitude, only excatly as sourced from P625 coordinate property of wikidata}, lng: {latitude, only excatly as sourced from P625 coordinate property of wikidata} },
},

You must provide the exact coordinates of wikidata source for the exact latitude and longitude!
```
