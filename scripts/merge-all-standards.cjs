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
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
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

const CDASH_DOMAIN_NAMES = {
  AG: "Procedure Agents",
  CM: "Concomitant Medications",
  EC: "Exposure as Collected",
  EX: "Exposure",
  ML: "Medical History Log",
  PR: "Procedures",
  SU: "Substance Use",
  AE: "Adverse Events",
  CE: "Clinical Events",
  DV: "Protocol Deviations",
  HO: "Healthcare Encounters",
  MH: "Medical History",
  CP: "Cell Phenotyping",
  CV: "Cardiovascular Findings",
  DA: "Drug Accountability",
  DD: "Death Details",
  IE: "Inclusion/Exclusion Criteria",
  MK: "Musculoskeletal Findings",
  NV: "Nervous System Findings",
  OE: "Ophthalmic Examination Findings",
  RE: "Respiratory Findings",
  RP: "Reproductive System Findings",
  RS: "Disease Response",
  SC: "Subject Characteristics",
  TR: "Tumor Response",
  TU: "Tumor Identification",
  UR: "Urinary System Findings",
  VS: "Vital Signs",
  FA: "Findings About",
  SR: "Skin Response",
  CO: "Comments",
  DS: "Disposition",
  SA: "Serious Adverse Events",
  EG: "Electrocardiogram",
  GF: "Genetic Findings",
  LB: "Laboratory Test Results",
  MB: "Microbiology Specimen",
  MI: "Microscopic Findings",
  MS: "Microbiology Susceptibility",
  PC: "Pharmacokinetics Concentrations",
  PE: "Physical Examination",
  DM: "Demographics"
};

// 1. Load existing base (SDTM + ADaM)
console.log('Loading existing SDTM + ADaM seed...');
const existingData = JSON.parse(fs.readFileSync('src/data/cdisc-seed-optimized.json', 'utf8'));

// 2. Parse CDASH CT
console.log('Parsing CDASH CT CSV...');
const ctContent = fs.readFileSync('C:/Users/ginge/Downloads/CDASH_CT_2026-03-27.csv', 'utf8');
const ctRows = parseCsv(ctContent);

const cdashCodelists = [];
const cdashTerms = [];
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

  if (!parentClCode) {
    currentCodelist = {
      code: subValue,
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
    cdashCodelists.push(currentCodelist);
  } else {
    const targetCodelistCode = currentCodelist?.code || parentClCode;
    cdashTerms.push({
      codelist: targetCodelistCode,
      order_number: cdashTerms.filter(t => t.codelist === targetCodelistCode).length * 10 + 10,
      submission_value: subValue,
      display_value: synonyms || subValue,
      definition: definition,
      nci_code: code,
      status: 'ACTIVE',
      created_at: '2026-03-27T00:00:00.000Z'
    });
  }
}

// 3. Parse CDASHIG v2.3 CSV
console.log('Parsing CDASHIG v2.3 CSV...');
const igContent = fs.readFileSync('C:/Users/ginge/Downloads/CDASHIG_v2.3.csv', 'utf8');
const igRows = parseCsv(igContent);

const cdashDomainsMap = new Map();
const cdashVariables = [];

for (let i = 1; i < igRows.length; i++) {
  const r = igRows[i];
  const ver = r[0]?.trim() || 'CDASHIG v2.3';
  const cls = r[1]?.trim() || 'Special-Purpose';
  const dom = r[2]?.trim();
  const scenario = r[3]?.trim();
  const varOrder = r[4]?.trim();
  const varName = r[5]?.trim();
  const varLabel = r[6]?.trim();
  const def = r[7]?.trim();
  const qText = r[8]?.trim();
  const prompt = r[9]?.trim();
  const type = r[10]?.trim() === 'Num' ? 'Num' : 'Char';
  const core = r[11]?.trim() || 'O';
  const sdtmTarget = r[13]?.trim();
  const mapInstructions = r[14]?.trim();
  const ctCode = r[15]?.trim();
  const ctSubVal = r[16]?.trim();
  const implNotes = r[17]?.trim();

  if (!dom || !varName) continue;

  if (!cdashDomainsMap.has(dom)) {
    cdashDomainsMap.set(dom, {
      study_id: 'GLOBAL',
      standard: 'CDASH',
      code: dom,
      name: CDASH_DOMAIN_NAMES[dom] || `${dom} Domain`,
      description: `${CDASH_DOMAIN_NAMES[dom] || dom} data collection domain in CDASHIG v2.3.`,
      structure: 'One record per observation',
      cls: cls,
      purpose: 'Data Collection',
      key_variables: 'STUDYID, SITEID, SUBJID',
      version: '2.3',
      status: 'ACTIVE',
      updated_at: '2026-03-27T00:00:00.000Z',
      updated_by: 'CDISC CDASH Team',
      change_reason: 'CDASHIG v2.3 release'
    });
  }

  // Determine CDASH variable role
  let role = 'QUALIFIER';
  if (['STUDYID', 'SITEID', 'SUBJID'].includes(varName)) role = 'IDENTIFIER';
  else if (varName.endsWith('TRT') || varName.endsWith('TERM') || varName.endsWith('TESTCD') || varName.endsWith('MODIFY')) role = 'TOPIC';
  else if (varName.endsWith('DTC') || varName.endsWith('DY') || varName.endsWith('TIM')) role = 'TIMING';

  // Map CDASH core (HR -> Req, R -> Exp, O -> Perm)
  let dbCore = core;
  if (core === 'HR') dbCore = 'Req';
  else if (core === 'R') dbCore = 'Exp';
  else if (core === 'O') dbCore = 'Perm';

  // Derivation notes to include SDTM target and mapping
  let derivation = '';
  if (sdtmTarget) derivation = `SDTM Target: ${sdtmTarget}`;
  if (mapInstructions && !mapInstructions.startsWith('Maps directly')) {
    derivation += ` · ${mapInstructions}`;
  }

  cdashVariables.push({
    study_id: 'GLOBAL',
    standard: 'CDASH',
    domain: dom,
    name: varName,
    label: varLabel || varName,
    type: type,
    length: type === 'Num' ? 8 : 200,
    format: type === 'Num' ? '8.' : '',
    role: role,
    origin: 'CRF',
    derivation: derivation,
    codelist: ctSubVal || ctCode || null,
    key_seq: ['STUDYID', 'SITEID', 'SUBJID'].includes(varName) ? (varName === 'STUDYID' ? 1 : varName === 'SITEID' ? 2 : 3) : null,
    core: dbCore,
    version: '2.3',
    status: 'ACTIVE',
    effective_from: '2026-03-27T00:00:00.000Z',
    updated_at: '2026-03-27T00:00:00.000Z',
    updated_by: 'CDISC CDASH Team',
    change_reason: 'CDASHIG v2.3 Release'
  });
}

const cdashDomains = Array.from(cdashDomainsMap.values());
console.log(`CDASH Domains parsed: ${cdashDomains.length}`);
console.log(`CDASH Variables parsed: ${cdashVariables.length}`);
console.log(`CDASH Codelists parsed: ${cdashCodelists.length}`);
console.log(`CDASH Terms parsed: ${cdashTerms.length}`);

// 4. Merge with existing data
// Avoid duplicate codelists
const existingClCodes = new Set(existingData.codelists.map(c => c.code));
const newCodelists = [...existingData.codelists];
for (const cl of cdashCodelists) {
  if (!existingClCodes.has(cl.code)) {
    newCodelists.push(cl);
    existingClCodes.add(cl.code);
  }
}

const mergedData = {
  version_date: '2026-03-27',
  domains: [...cdashDomains, ...existingData.domains],
  variables: [...cdashVariables, ...existingData.variables],
  codelists: newCodelists,
  terms: [...cdashTerms, ...existingData.terms],
  vlm: existingData.vlm
};

console.log('\n--- MERGED DATASET SUMMARY ---');
console.log(`Total Domains: ${mergedData.domains.length} (42 CDASH + 131 SDTM + 14 ADaM)`);
console.log(`Total Variables: ${mergedData.variables.length} (${cdashVariables.length} CDASH + ${existingData.variables.length} SDTM/ADaM)`);
console.log(`Total Codelists: ${mergedData.codelists.length}`);
console.log(`Total Terms: ${mergedData.terms.length}`);
console.log(`Total VLM: ${mergedData.vlm.length}`);

const outStr = JSON.stringify(mergedData);
console.log(`Output size: ${(outStr.length / 1024 / 1024).toFixed(2)} MB`);
fs.writeFileSync('src/data/cdisc-seed-optimized.json', outStr);
console.log('Saved merged src/data/cdisc-seed-optimized.json successfully.');
