const fs = require('fs');

function patch(filepath) {
  let code = fs.readFileSync(filepath, 'utf8');
  code = code.replace(/end: \`\S+?3100\`/, "end: `${finalYear}${finalMonth}${String(new Date(Date.UTC(finalYear, end.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, '0')}00`");
  fs.writeFileSync(filepath, code);
  console.log('patched ' + filepath);
}

patch('scripts/populate-daily-challenges.ts');
patch('scripts/get-wikipedia-views.ts');
