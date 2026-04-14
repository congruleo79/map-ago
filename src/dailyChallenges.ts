import type { LatLngLiteral } from "leaflet"

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

const dailyChallenges: Record<string, LocationTarget[]> = {
  "2026-04-14": [
    {
      name: "Houston",
      region: "United States",
      text: 'On April 14, 1970, Mission Control in Houston received the famous Apollo 13 distress call after an oxygen tank failure crippled the spacecraft on its way to the Moon. The line is often remembered as "Houston, we have a problem," but the original transmission was even more immediate: "Houston, we\'ve had a problem."',
      link: "https://en.wikipedia.org/wiki/Apollo_13",
      source: "https://www.wikidata.org/wiki/Q16555",
      views: 88790,
      coordinates: { lat: 29.762777777778, lng: -95.383055555556 },
    },
    {
      name: "Monaco",
      region: "Monaco",
      text: "On April 14, 1929, the inaugural Monaco Grand Prix was held on the streets of the principality, beginning one of motor racing's most iconic events. The race helped turn Monaco into a permanent symbol of glamorous, high-risk circuit racing.",
      link: "https://en.wikipedia.org/wiki/1929_Monaco_Grand_Prix",
      source: "https://www.wikidata.org/wiki/Q235",
      views: 205600,
      coordinates: { lat: 43.73111111111111, lng: 7.42 },
    },
    {
      name: "Tbilisi",
      region: "Georgia",
      text: "On April 14, 1978, thousands of people gathered in Tbilisi to protest Soviet attempts to weaken the status of the Georgian language. The demonstrations succeeded, and the date is still remembered in Georgia as a symbol of linguistic identity and civic resistance.",
      link: "https://en.wikipedia.org/wiki/1978_Georgian_demonstrations",
      source: "https://www.wikidata.org/wiki/Q994",
      views: 44436,
      coordinates: { lat: 41.7225, lng: 44.7925 },
    },
    {
      name: "Dhaka",
      region: "Bangladesh",
      text: "On April 14, Dhaka becomes one of the main centers of Pohela Boishakh, the Bengali New Year, with processions, music, and public celebrations across the city. The festivities around Ramna Park and the University of Dhaka have made the capital one of the date's most recognizable cultural focal points.",
      link: "https://en.wikipedia.org/wiki/Pohela_Boishakh",
      source: "https://www.wikidata.org/wiki/Q1354",
      views: 52784,
      coordinates: { lat: 23.72888888888889, lng: 90.39444444444445 },
    },
    {
      name: "Chibok",
      region: "Nigeria",
      text: "On April 14, 2014, Chibok became known around the world when Boko Haram abducted 276 schoolgirls from the town. The event drew sustained international attention and turned this relatively remote place into a global symbol of grief, outrage, and demands for accountability.",
      link: "https://en.wikipedia.org/wiki/Chibok_schoolgirls_kidnapping",
      source: "https://www.wikidata.org/wiki/Q5095348",
      views: 426,
      coordinates: { lat: 10.869722222222222, lng: 12.846666666666666 },
    },
  ],
  "2026-04-15": [
    {
      name: "Athens",
      region: "Greece",
      text: "On April 15, 1896, the closing ceremony of the first modern Olympic Games was held in Athens. The city became the symbolic starting point for the revived international Olympic movement.",
      link: "https://en.wikipedia.org/wiki/1896_Summer_Olympics",
      source: "https://www.wikidata.org/wiki/Q1524",
      views: 71778,
      coordinates: { lat: 37.98416666666667, lng: 23.728055555555557 },
    },
    {
      name: "Bari",
      region: "Italy",
      text: "On April 15, 1071, Bari, the last Byzantine possession in southern Italy, surrendered to Robert Guiscard after a long siege. The city marks the end of Byzantine rule in the region.",
      link: "https://en.wikipedia.org/wiki/Siege_of_Bari",
      source: "https://www.wikidata.org/wiki/Q3519",
      views: 23355,
      coordinates: { lat: 41.125277777778, lng: 16.866666666667 },
    },
    {
      name: "Busan",
      region: "South Korea",
      text: "On April 15, 2002, Air China Flight 129 crashed on approach to Gimhae International Airport in Busan. The disaster made the city the focus of one of South Korea's deadliest aviation accidents.",
      link: "https://en.wikipedia.org/wiki/Air_China_Flight_129",
      source: "https://www.wikidata.org/wiki/Q16520",
      views: 31161,
      coordinates: { lat: 35.18, lng: 129.075 },
    },
    {
      name: "Marrakesh",
      region: "Morocco",
      text: "On April 15, 1994, the Marrakesh Agreement establishing the World Trade Organization was adopted in Marrakesh. The city gave its name to one of the key agreements shaping the modern global trading system.",
      link: "https://en.wikipedia.org/wiki/Marrakesh_Agreement",
      source: "https://www.wikidata.org/wiki/Q101625",
      views: 36358,
      coordinates: { lat: 31.62947, lng: -7.98108 },
    },
    {
      name: "Paris",
      region: "France",
      text: "On April 15, 2019, a major fire severely damaged Notre-Dame de Paris. Paris became the focus of worldwide attention as people watched one of its best-known landmarks burn.",
      link: "https://en.wikipedia.org/wiki/Notre-Dame_de_Paris_fire",
      source: "https://www.wikidata.org/wiki/Q90",
      views: 150579,
      coordinates: { lat: 48.85666666666667, lng: 2.352222222222222 },
    },
  ],
  "2026-04-16": [
    {
      name: "Skopje",
      region: "North Macedonia",
      text: "On April 16, 1346, Stefan Dusan was crowned emperor in Skopje. The city served as the ceremonial center of a major medieval Balkan empire at a decisive moment in regional history.",
      link: "https://en.wikipedia.org/wiki/Stefan_Du%C5%A1an",
      source: "https://www.wikidata.org/wiki/Q384",
      views: 28899,
      coordinates: { lat: 41.99611111111111, lng: 21.431666666666665 },
    },
    {
      name: "Salta",
      region: "Argentina",
      text: "On April 16, 1582, Spanish conquistador Hernando de Lerma founded the settlement of Salta. That date marks the beginning of one of northwestern Argentina's most important colonial-era cities.",
      link: "https://en.wikipedia.org/wiki/Salta",
      source: "https://www.wikidata.org/wiki/Q36307",
      views: 4745,
      coordinates: { lat: -24.788333333333, lng: -65.410555555556 },
    },
    {
      name: "Kotka",
      region: "Finland",
      text: "On April 16, 1878, the Senate of the Grand Duchy of Finland issued the declaration establishing the city of Kotka. The date marks the formal beginning of this major Finnish port city.",
      link: "https://en.wikipedia.org/wiki/Kotka",
      source: "https://www.wikidata.org/wiki/Q192155",
      views: 2129,
      coordinates: { lat: 60.466666666667, lng: 26.945833333333 },
    },
    {
      name: "Athens",
      region: "Greece",
      text: "On April 16, 2003, the Treaty of Accession was signed in Athens to admit ten new states to the European Union. The city briefly became the stage for one of the EU's largest single expansions.",
      link: "https://en.wikipedia.org/wiki/Treaty_of_Accession_2003",
      source: "https://www.wikidata.org/wiki/Q1524",
      views: 71778,
      coordinates: { lat: 37.98416666666667, lng: 23.728055555555557 },
    },
    {
      name: "Malta",
      region: "Malta",
      text: "On April 16, 1942, King George VI awarded the George Cross to Malta in recognition of the island's collective wartime bravery. The decoration became one of the defining symbols of Malta's experience in World War II.",
      link: "https://en.wikipedia.org/wiki/Award_of_the_George_Cross_to_Malta",
      source: "https://www.wikidata.org/wiki/Q233",
      views: 185957,
      coordinates: { lat: 35.88333333333333, lng: 14.5 },
    },
  ],
  "2026-04-17": [
    {
      name: "Kaunas",
      region: "Lithuania",
      text: "On April 17, 1362, Kaunas Castle fell to the Teutonic Order after a long siege. Kaunas entered the historical record as a frontier stronghold in the medieval Baltic conflicts.",
      link: "https://en.wikipedia.org/wiki/Siege_of_Kaunas_(1362)",
      source: "https://www.wikidata.org/wiki/Q4115712",
      views: 13919,
      coordinates: { lat: 54.9, lng: 23.933333333333 },
    },
    {
      name: "San Juan",
      region: "Puerto Rico",
      text: "On April 17, 1797, British forces attacked San Juan in one of the largest invasions of Spanish territories in the Americas. The city's defenses helped repel the assault and preserve Spanish control.",
      link: "https://en.wikipedia.org/wiki/Battle_of_San_Juan_(1797)",
      source: "https://www.wikidata.org/wiki/Q41211",
      views: 39123,
      coordinates: { lat: 18.46527777777778, lng: -66.11666666666666 },
    },
    {
      name: "Damascus",
      region: "Syria",
      text: "On April 17, 1946, the last French troops withdrew from Syria, and Damascus became the capital of a fully independent state. The date is still commemorated in Syria as Evacuation Day.",
      link: "https://en.wikipedia.org/wiki/Evacuation_Day_(Syria)",
      source: "https://www.wikidata.org/wiki/Q3766",
      views: 71402,
      coordinates: { lat: 33.513055555556, lng: 36.291944444444 },
    },
    {
      name: "Maputo",
      region: "Mozambique",
      text: "On April 17, 1992, the tanker Katina P was deliberately run aground off Maputo, causing a major oil spill. The incident linked the city to one of the notable environmental accidents in the western Indian Ocean.",
      link: "https://en.wikipedia.org/wiki/Katina_P",
      source: "https://www.wikidata.org/wiki/Q3889",
      views: 12697,
      coordinates: { lat: -25.915277777778, lng: 32.576388888889 },
    },
    {
      name: "Windsor",
      region: "United Kingdom",
      text: "On April 17, 2021, the funeral of Prince Philip took place at St George's Chapel in Windsor Castle. Windsor became the ceremonial focus of a globally watched royal event.",
      link: "https://en.wikipedia.org/wiki/Death_and_funeral_of_Prince_Philip,_Duke_of_Edinburgh",
      source: "https://www.wikidata.org/wiki/Q464955",
      views: 10293,
      coordinates: { lat: 51.483333333333, lng: -0.6 },
    },
  ],
  "2026-04-18": [
    {
      name: "Vatican City",
      region: "Vatican City",
      text: "On April 18, 1506, the cornerstone of the current St. Peter's Basilica was laid in Vatican City. The date marks the beginning of one of the most famous church-building projects in the world.",
      link: "https://en.wikipedia.org/wiki/St._Peter%27s_Basilica",
      source: "https://www.wikidata.org/wiki/Q237",
      views: 126591,
      coordinates: { lat: 41.904, lng: 12.453 },
    },
    {
      name: "Addis Ababa",
      region: "Ethiopia",
      text: "On April 18, 1972, East African Airways Flight 720 crashed during a rejected takeoff from Addis Ababa Bole International Airport. Addis Ababa became the site of one of the most serious air disasters in East African aviation history.",
      link: "https://en.wikipedia.org/wiki/East_African_Airways_Flight_720",
      source: "https://www.wikidata.org/wiki/Q3624",
      views: 52944,
      coordinates: { lat: 9.0272222222222, lng: 38.736944444444 },
    },
    {
      name: "Tokyo",
      region: "Japan",
      text: "On April 18, 1942, Tokyo was among the Japanese cities bombed in the Doolittle Raid. The attack made the capital a central symbol in a dramatic turning point of the Pacific War.",
      link: "https://en.wikipedia.org/wiki/Doolittle_Raid",
      source: "https://www.wikidata.org/wiki/Q1490",
      views: 143585,
      coordinates: { lat: 35.68944444444445, lng: 139.69166666666666 },
    },
    {
      name: "The Hague",
      region: "Netherlands",
      text: "On April 18, 1946, the International Court of Justice held its inaugural meeting in The Hague. The city further strengthened its role as one of the world's main centers for international law.",
      link: "https://en.wikipedia.org/wiki/International_Court_of_Justice",
      source: "https://www.wikidata.org/wiki/Q36600",
      views: 74902,
      coordinates: { lat: 52.08, lng: 4.31 },
    },
    {
      name: "Bandung",
      region: "Indonesia",
      text: "On April 18, 1955, leaders from twenty-nine nations gathered in Bandung for the Asian-African Conference. The city became permanently associated with postcolonial solidarity and the rise of the Non-Aligned world.",
      link: "https://en.wikipedia.org/wiki/Asian%E2%80%93African_Conference",
      source: "https://www.wikidata.org/wiki/Q10389",
      views: 10012,
      coordinates: { lat: -6.921845833333333, lng: 107.60708305555555 },
    },
  ],
  "2026-04-19": [
    {
      name: "Caracas",
      region: "Venezuela",
      text: "On April 19, 1810, people in Caracas removed the Spanish governor and installed a local junta. The city became one of the first major centers of the independence movement in Spanish South America.",
      link: "https://en.wikipedia.org/wiki/19_April_Movement",
      source: "https://www.wikidata.org/wiki/Q1533",
      views: 27208,
      coordinates: { lat: 10.50611111111111, lng: -66.91444444444444 },
    },
    {
      name: "Warsaw",
      region: "Poland",
      text: "On April 19, 1943, the Warsaw Ghetto Uprising began after German forces entered the ghetto. Warsaw became the site of one of the most powerful acts of Jewish resistance during World War II.",
      link: "https://en.wikipedia.org/wiki/Warsaw_Ghetto_Uprising",
      source: "https://www.wikidata.org/wiki/Q270",
      views: 71983,
      coordinates: { lat: 52.23, lng: 21.011111111111113 },
    },
    {
      name: "Basel",
      region: "Switzerland",
      text: "On April 19, 1943, Albert Hofmann deliberately took LSD in Basel and made the bicycle ride later celebrated as Bicycle Day. The city is tied to one of the strangest and most widely referenced episodes in modern chemical history.",
      link: "https://en.wikipedia.org/wiki/History_of_lysergic_acid_diethylamide#%22Bicycle_Day%22",
      source: "https://www.wikidata.org/wiki/Q78",
      views: 28459,
      coordinates: { lat: 47.560555555556, lng: 7.5905555555556 },
    },
    {
      name: "Berlin",
      region: "Germany",
      text: "On April 19, 1999, the German Bundestag returned to Berlin. The move confirmed the city once again as the working capital of reunified Germany.",
      link: "https://en.wikipedia.org/wiki/Decision_on_the_Capital_of_Germany",
      source: "https://www.wikidata.org/wiki/Q64",
      views: 151218,
      coordinates: { lat: 52.516666666667, lng: 13.383333333333 },
    },
    {
      name: "Santiago",
      region: "Chile",
      text: "On April 19, 1925, Colo-Colo was founded in Santiago and went on to become Chile's most successful football club. The city is therefore tied to one of the country's most important sporting institutions.",
      link: "https://en.wikipedia.org/wiki/Colo-Colo",
      source: "https://www.wikidata.org/wiki/Q2887",
      views: 42531,
      coordinates: { lat: -33.4375, lng: -70.65 },
    },
  ],
}

const sortedDailyChallenges: Record<string, LocationTarget[]> = Object.fromEntries(
  Object.entries(dailyChallenges).map(([dateKey, targets]) => [
    dateKey,
    [...targets].sort((left, right) => (right.views ?? 0) - (left.views ?? 0)),
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
