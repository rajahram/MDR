const fs = require('fs');

const seedFile = 'src/data/cdisc-seed-optimized.json';
const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

console.log('Original variables:', data.variables.length);
console.log('Original domains:', data.domains.length);

// 1. Remove ADaM variables containing '*'
const cleanVariables = data.variables.filter(v => {
  if (v.standard === 'ADaM' && v.name.includes('*')) {
    return false;
  }
  return true;
});

console.log('Variables after removing ADaM * vars:', cleanVariables.length);
console.log('Removed ADaM * vars:', data.variables.length - cleanVariables.length);

// 2. Count variables per domain
const varCountMap = new Map();
for (const v of cleanVariables) {
  const key = `${v.standard}:${v.domain}`;
  varCountMap.set(key, (varCountMap.get(key) || 0) + 1);
}

// 3. Remove domains with 0 variables
const cleanDomains = data.domains.filter(dom => {
  const key = `${dom.standard}:${dom.code}`;
  const count = varCountMap.get(key) || 0;
  if (count === 0) {
    console.log(`Removing 0-variable domain: [${dom.standard}] ${dom.code} (${dom.name})`);
    return false;
  }
  return true;
});

console.log('Domains after removing 0-variable domains:', cleanDomains.length);
console.log('Removed 0-variable domains:', data.domains.length - cleanDomains.length);

data.variables = cleanVariables;
data.domains = cleanDomains;

fs.writeFileSync(seedFile, JSON.stringify(data));
console.log('Updated', seedFile, 'successfully.');
