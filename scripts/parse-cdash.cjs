const fs = require('fs');

// Helper to parse standard CSV line with quoted fields
function parseCsv(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // CRLF
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

// 1. Analyze CDASH CT
console.log('--- Analyzing CDASH CT ---');
const ctContent = fs.readFileSync('C:/Users/ginge/Downloads/CDASH_CT_2026-03-27.csv', 'utf8');
const ctRows = parseCsv(ctContent);
const ctHeader = ctRows[0];
console.log('CT rows:', ctRows.length);

const codelists = [];
const codelistTerms = [];
let currentCodelist = null;

for (let i = 1; i < ctRows.length; i++) {
  const r = ctRows[i];
  const code = r[0]?.trim();
  const parentClCode = r[1]?.trim();
  const extensible = r[2]?.trim();
  const clName = r[3]?.trim();
  const subValue = r[4]?.trim();
  const synonyms = r[5]?.trim();
  const definition = r[6]?.trim();
  const nciPrefTerm = r[7]?.trim();
  const stdDate = r[8]?.trim();

  // If parentClCode is empty, this row defines a CODELIST header
  if (!parentClCode) {
    currentCodelist = {
      code: subValue, // e.g. CMDOSFRM
      name: clName,
      type: 'CODELIST',
      description: definition,
      nci_code: code,
      source: 'CDASH CT 2026-03-27',
      version: '2026-03-27',
      version_date: '2026-03-27',
      extensible: extensible || 'No',
      status: 'ACTIVE',
      updated_at: '2026-03-27T00:00:00.000Z'
    };
    codelists.push(currentCodelist);
  } else {
    // Term row
    const targetCodelistCode = currentCodelist?.code || parentClCode;
    codelistTerms.push({
      codelist: targetCodelistCode,
      order_number: codelistTerms.filter(t => t.codelist === targetCodelistCode).length * 10 + 10,
      submission_value: subValue,
      display_value: synonyms || subValue,
      definition: definition,
      nci_code: code,
      status: 'ACTIVE',
      created_at: '2026-03-27T00:00:00.000Z'
    });
  }
}

console.log(`CDASH Codelists found: ${codelists.length}`);
console.log(`CDASH Terms found: ${codelistTerms.length}`);
console.log('Sample CDASH Codelists:', codelists.map(c => `${c.code} (${c.name})`).slice(0, 10));

// 2. Analyze CDASHIG
console.log('\n--- Analyzing CDASHIG v2.3 ---');
const igContent = fs.readFileSync('C:/Users/ginge/Downloads/CDASHIG_v2.3.csv', 'utf8');
const igRows = parseCsv(igContent);
console.log('IG rows:', igRows.length);
const igHeader = igRows[0];

const domainsMap = new Map(); // domainCode -> { code, name, cls, structure, vars: [] }

for (let i = 1; i < igRows.length; i++) {
  const r = igRows[i];
  const ver = r[0]?.trim();
  const cls = r[1]?.trim();
  const dom = r[2]?.trim();
  const scenario = r[3]?.trim();
  const varOrder = r[4]?.trim();
  const varName = r[5]?.trim();
  const varLabel = r[6]?.trim();
  const def = r[7]?.trim();
  const qText = r[8]?.trim();
  const prompt = r[9]?.trim();
  const type = r[10]?.trim();
  const core = r[11]?.trim();
  const crfInstructions = r[12]?.trim();
  const sdtmTarget = r[13]?.trim();
  const mapInstructions = r[14]?.trim();
  const ctCode = r[15]?.trim();
  const ctSubVal = r[16]?.trim();
  const implNotes = r[17]?.trim();

  if (!dom || !varName) continue;

  if (!domainsMap.has(dom)) {
    domainsMap.set(dom, {
      code: dom,
      name: `${dom} Domain`,
      cls: cls || 'Special Purpose',
      structure: 'One record per observation',
      vars: []
    });
  }

  domainsMap.get(dom).vars.push({
    domain: dom,
    order: parseInt(varOrder, 10) || (domainsMap.get(dom).vars.length + 1),
    name: varName,
    label: varLabel || varName,
    type: type === 'Num' ? 'Num' : 'Char',
    core: core || 'O',
    sdtmTarget,
    mapInstructions,
    codelist: ctSubVal || ctCode || null,
    prompt: prompt || qText,
    def
  });
}

console.log(`CDASH Domains found: ${domainsMap.size}`);
console.log('CDASH Domain codes:', Array.from(domainsMap.keys()));
for (const [code, d] of domainsMap.entries()) {
  console.log(`  ${code}: ${d.vars.length} variables (Class: ${d.cls})`);
}
