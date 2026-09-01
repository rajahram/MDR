const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/cdisc-seed.json', 'utf8'));

const CORE_DOMAINS = new Set([
  'DM', 'VS', 'AE', 'CM', 'LB', 'EX', 'DS', 'MH', 'QS', 'SC', 'PC', 'PP', 'EG', 'PE',
  'DA', 'MB', 'MS', 'TA', 'TE', 'TV', 'TS', 'TI', 'CO', 'SV', 'SE', 'FA', 'IE', 'IS', 'TR', 'TU', 'RS',
  'ADSL', 'ADVS', 'ADAE', 'ADCM', 'ADLB', 'ADPC', 'ADTTE', 'ADEG', 'ADNCA'
]);

const coreVars = data.variables.filter(v => CORE_DOMAINS.has(v.domain));
console.log(`Core variables for ${CORE_DOMAINS.size} primary domains: ${coreVars.length}`);

// What if we keep all 145 domains in the registry, and for variables:
// We include all variables for these 40 primary clinical domains (~2,500 variables),
// and for the remaining domains, include their standard variables or all variables.
