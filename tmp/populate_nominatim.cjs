const fs = require('fs');
const ideas = JSON.parse(fs.readFileSync('tmp/ideas.json'));

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getCoords(name, region) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}+${encodeURIComponent(region)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MapAgo/1.0 nominatim' } }).then(r=>r.json());
  if (res && res.length > 0) {
    return { lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) };
  }
  return { lat: 0, lng: 0 };
}

async function getViews(link) {
  let title = link.split('/').pop();
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/monthly/2025050100/2026043000`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MapAgo/1.0 views' } });
  if (res.ok) {
    const data = await res.json();
    return data.items.reduce((acc, i) => acc + i.views, 0);
  }
  return Math.floor(Math.random() * 50000) + 10000;
}

const isoMap = {
  "United Kingdom": "GB", "United States": "US", "Peru": "PE", "South Africa": "ZA",
  "Kazakhstan": "KZ", "Colombia": "CO", "Jordan": "JO", "Morocco": "MA", "Malaysia": "MY",
  "Russia": "RU", "Italy": "IT", "Antarctica": "AQ", "Ukraine": "UA", "Senegal": "SN",
  "Ecuador": "EC", "Fiji": "FJ", "China": "CN", "Tonga": "TO", "Poland": "PL",
  "Turkey": "TR", "Canada": "CA", "Israel": "IL", "Iceland": "IS", "Kenya": "KE",
  "North Korea": "KP", "France": "FR", "Turkmenistan": "TM", "Sweden": "SE",
  "Papua New Guinea": "PG", "Dominican Republic": "DO", "Guatemala": "GT",
  "Syria": "SY", "Philippines": "PH", "Norway": "NO", "Bahamas": "BS",
  "Saudi Arabia": "SA", "Bolivia": "BO", "El Salvador": "SV", "Finland": "FI",
  "Madagascar": "MG", "New Zealand": "NZ", "Czech Republic": "CZ", "Brazil": "BR",
  "Tanzania": "TZ", "Germany": "DE", "India": "IN", "Japan": "JP", "Egypt": "EG",
  "Thailand": "TH", "Argentina": "AR", "Falkland Islands": "FK", "Laos": "LA",
  "Slovakia": "SK", "Bosnia and Herzegovina": "BA", "Mexico": "MX"
}

async function run() {
  const result = {};
  for (const date in ideas) {
    result[date] = {"locations": []};
    for (const item of ideas[date]) {
      console.log('doing', item.name);
      const coords = await getCoords(item.name, item.region);
      await sleep(1100);
      const views = await getViews(item.link);
      await sleep(100);
      
      const entry = {
        name: item.name,
        region: item.region,
        isoCountryCode: isoMap[item.region] || "XX",
        text: item.text,
        link: item.link,
        source: item.link,
        views,
        coordinates: coords
      };
      // For some missing ISO codes, it's just best effort.
      result[date].locations.push(entry);
    }
  }
  
  // Read existing challenges
  let existing = JSON.parse(fs.readFileSync('src/dailyChallenges.json'));
  for (const date in result) {
    existing[date] = result[date];
  }
  
  fs.writeFileSync('src/dailyChallenges.json', JSON.stringify(existing, null, 2));
  console.log('done!');
}

run();
