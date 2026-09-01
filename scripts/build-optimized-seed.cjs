const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('src/data/cdiscData.json', 'utf8'));

// Filter terms to keep all terms for smaller codelists, and up to 50 terms for huge codelists
const termsByCode = {};
for (const t of raw.terms) {
  if (!termsByCode[t.codelist]) termsByCode[t.codelist] = [];
  if (termsByCode[t.codelist].length < 60) {
    termsByCode[t.codelist].push(t);
  }
}

const filteredTerms = [];
for (const code of Object.keys(termsByCode)) {
  filteredTerms.push(...termsByCode[code]);
}

// Ensure key variables are well formatted for all domains
for (const d of raw.domains) {
  if (!d.key_variables || d.key_variables.trim() === '') {
    if (d.standard === 'SDTM') {
      d.key_variables = 'STUDYID, USUBJID';
    } else {
      d.key_variables = 'STUDYID, USUBJID';
    }
  }
}

// Select only codelists that either have terms or are referenced by variables
const refCodelists = new Set();
for (const v of raw.variables) {
  if (v.codelist) refCodelists.add(v.codelist);
}
const activeCodelists = raw.codelists.filter(c => refCodelists.has(c.code) || termsByCode[c.code]?.length > 0);

const cleanData = {
  version_date: '2026-03-27',
  domains: raw.domains,
  variables: raw.variables,
  codelists: activeCodelists,
  terms: filteredTerms,
  vlm: raw.vlm
};

console.log(`Cleaned seed summary:`);
console.log(`- Domains: ${cleanData.domains.length}`);
console.log(`- Variables: ${cleanData.variables.length}`);
console.log(`- Codelists: ${cleanData.codelists.length}`);
console.log(`- Terms: ${cleanData.terms.length}`);
console.log(`- VLM records: ${cleanData.vlm.length}`);

fs.writeFileSync('src/data/cdisc-seed.json', JSON.stringify(cleanData));
console.log('Saved src/data/cdisc-seed.json successfully.');
