const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/cdiscData.json', 'utf8'));

const CORE_DOMAINS = new Set([
  'DM', 'VS', 'AE', 'CM', 'LB', 'EX', 'DS', 'MH', 'QS', 'SC', 'PC', 'PP', 'EG', 'PE',
  'DA', 'MB', 'MS', 'TA', 'TE', 'TV', 'TS', 'TI', 'CO', 'SV', 'SE', 'FA', 'IE', 'IS', 'TR', 'TU', 'RS',
  'ADSL', 'ADVS', 'ADAE', 'ADCM', 'ADLB', 'ADPC', 'ADTTE', 'ADEG', 'ADNCA', 'ADDL', 'ADPPK'
]);

const selectedVars = [];
const varsByDomain = {};
for (const v of data.variables) {
  if (!varsByDomain[v.domain]) varsByDomain[v.domain] = [];
  varsByDomain[v.domain].push(v);
}

for (const dom of data.domains) {
  const domVars = varsByDomain[dom.code] || [];
  if (CORE_DOMAINS.has(dom.code)) {
    selectedVars.push(...domVars);
  } else {
    selectedVars.push(...domVars.slice(0, 25));
  }
}

const usedCodelists = new Set();
for (const v of selectedVars) {
  if (v.codelist) usedCodelists.add(v.codelist);
}
['SEX', 'NY', 'RACE', 'ETHNIC', 'SEV', 'REL', 'OUT', 'ACN', 'VSPOS', 'UNIT', 'FREQ', 'LBCAT', 'TRT', 'COUNTRY', 'AGEU', 'EVAL', 'ROUTE', 'ARMCD', 'PARAMCD', 'AVISIT'].forEach(c => usedCodelists.add(c));

const selectedCodelists = data.codelists.filter(c => usedCodelists.has(c.code));

// Cap terms per codelist to 40 max
const termsByCode = {};
for (const t of data.terms) {
  if (!usedCodelists.has(t.codelist)) continue;
  if (!termsByCode[t.codelist]) termsByCode[t.codelist] = [];
  if (termsByCode[t.codelist].length < 40) {
    termsByCode[t.codelist].push(t);
  }
}

const selectedTerms = [];
for (const k of Object.keys(termsByCode)) {
  selectedTerms.push(...termsByCode[k]);
}

const bundle = {
  version_date: '2026-03-27',
  domains: data.domains,
  variables: selectedVars,
  codelists: selectedCodelists,
  terms: selectedTerms,
  vlm: data.vlm
};

console.log('Optimized bundle:');
console.log('- Domains:', bundle.domains.length);
console.log('- Variables:', bundle.variables.length);
console.log('- Codelists:', bundle.codelists.length);
console.log('- Terms:', bundle.terms.length);
console.log('- VLM:', bundle.vlm.length);

const outStr = JSON.stringify(bundle);
console.log(`Bundle size: ${(outStr.length / 1024 / 1024).toFixed(2)} MB`);
fs.writeFileSync('src/data/cdisc-seed-optimized.json', outStr);
