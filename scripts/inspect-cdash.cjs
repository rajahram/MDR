const fs = require('fs');

function inspectCsv(filePath, maxLines = 10) {
  console.log(`\n=== INSPECTING: ${filePath} ===`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`Total lines: ${lines.length}`);
  console.log('--- Header ---');
  console.log(lines[0]);
  console.log('--- First 5 rows ---');
  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    console.log(`Row ${i}:`, lines[i]);
  }
}

inspectCsv('C:/Users/ginge/Downloads/CDASHIG_v2.3.csv');
inspectCsv('C:/Users/ginge/Downloads/CDASH_CT_2026-03-27.csv');
