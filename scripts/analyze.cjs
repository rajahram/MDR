const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/cdiscData.json', 'utf8'));

console.log('Domains count:', data.domains.length);
const domVarCounts = {};
for (const v of data.variables) {
  domVarCounts[v.domain] = (domVarCounts[v.domain] || 0) + 1;
}

console.log('Top 20 domains by variable count:');
console.log(Object.entries(domVarCounts).sort((a,b) => b[1] - a[1]).slice(0, 20));

// Check how many codelists are referenced by variables
const refCodelists = new Set();
for (const v of data.variables) {
  if (v.codelist) refCodelists.add(v.codelist);
}
console.log('Codelists directly referenced by variables:', refCodelists.size);

// Check size if we include all domains, all VLM, all 1240 codelists, but filter terms to referenced codelists or top 100
const refTerms = data.terms.filter(t => refCodelists.has(t.codelist));
console.log('Terms for referenced codelists:', refTerms.length);
