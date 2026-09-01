const fs = require('fs');

const seedFile = 'src/data/cdisc-seed-optimized.json';
const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

console.log('Original variables count:', data.variables.length);

const varMap = new Map();

for (const v of data.variables) {
  const key = `${v.standard}:${v.domain}:${v.name}`;
  if (!varMap.has(key)) {
    varMap.set(key, v);
  } else {
    // If the new one has richer information (e.g. codelist, derivation, label), merge it
    const existing = varMap.get(key);
    if (!existing.codelist && v.codelist) existing.codelist = v.codelist;
    if (!existing.derivation && v.derivation) existing.derivation = v.derivation;
    if (v.label && v.label.length > existing.label.length) existing.label = v.label;
    if (!existing.key_seq && v.key_seq) existing.key_seq = v.key_seq;
  }
}

const cleanVars = Array.from(varMap.values());
console.log('Clean deduplicated variables count:', cleanVars.length);
console.log('Removed duplicate count:', data.variables.length - cleanVars.length);

data.variables = cleanVars;

fs.writeFileSync(seedFile, JSON.stringify(data));
console.log('Updated', seedFile, 'successfully.');
