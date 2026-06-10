const fs = require('fs');
let code = fs.readFileSync('scripts/populate-daily-challenges.ts', 'utf8');
code = code.replace(/MapAgo\/0.0.0/g, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MapAgoHelpers/0.1.0");
fs.writeFileSync('scripts/populate-daily-challenges.ts', code);
