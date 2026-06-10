const fs = require('fs');
let code = fs.readFileSync('scripts/populate-daily-challenges.ts', 'utf8');
// replace any fetch(...) with throttledFetch(...) if it's not already throttledFetch
code = code.replace(/([\s\=])fetch\(/g, "$1throttledFetch(");
// wait actually, I might replace the definition of throttledFetch. 
// let's do a more robust string replacement
code = fs.readFileSync('scripts/populate-daily-challenges.ts', 'utf8');
// replace ONLY fetch(searchUrl, fetch(entityUrl
code = code.replace(/await fetch\(searchUrl/g, "await throttledFetch(searchUrl");
code = code.replace(/await fetch\(entityUrl/g, "await throttledFetch(entityUrl");
code = code.replace(/await fetch\(`https:\/\/en.wikipedia.org/g, "await throttledFetch(`https:\/\/en.wikipedia.org");
fs.writeFileSync('scripts/populate-daily-challenges.ts', code);
console.log('patched');
