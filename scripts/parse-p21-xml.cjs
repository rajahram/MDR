const fs = require('fs');
const path = require('path');

const SDTM_XML_PATH = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/SDTM-IG 3.4 (FDA).xml';
const ADAM_XML_PATH = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/ADaM-IG 1.3 (FDA).xml';
const SDTM_CT_PATH  = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/data/CDISC/SDTM/2026-03-27/SDTM Terminology.odm.xml';
const ADAM_CT_PATH  = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/data/CDISC/ADaM/2026-03-27/ADaM Terminology.odm.xml';

console.log('Reading XML files...');
const sdtmXml = fs.readFileSync(SDTM_XML_PATH, 'utf8');
const adamXml = fs.readFileSync(ADAM_XML_PATH, 'utf8');
const sdtmCtXml = fs.readFileSync(SDTM_CT_PATH, 'utf8');
const adamCtXml = fs.readFileSync(ADAM_CT_PATH, 'utf8');

// Regex helper to find attribute value
function getAttr(tag, attr) {
  const m = tag.match(new RegExp('(?:^|\\s)' + attr + '="([^"]*)"'));
  return m ? m[1] : '';
}

// 1. PARSE CONTROLLED TERMINOLOGY
console.log('Parsing Controlled Terminology...');
const codelistsMap = new Map(); // code -> { code, name, type, description, nci_code, source, version_date, extensible, terms: [] }

function parseCT(xml, sourceName, defaultDate) {
  // Extract CreationDateTime or FileOID
  const dateMatch = xml.match(/CreationDateTime="([^"T]+)/) || xml.match(/FileOID="[^"]*?(\d{4}-\d{2}-\d{2})/);
  const versionDate = dateMatch ? dateMatch[1] : defaultDate;

  // Split by <CodeList
  const clBlocks = xml.split(/<CodeList\s+/);
  for (let i = 1; i < clBlocks.length; i++) {
    const block = clBlocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</CodeList>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const oid = getAttr(header, 'OID'); // e.g. "CL.SEX" or "CL.C66731.SEX"
    const name = getAttr(header, 'Name');
    const dataType = getAttr(header, 'DataType') || 'text';
    const extensible = getAttr(header, 'nciodm:CodeListExtensible') || 'No';

    // Normalized code: remove CL. prefix if present, e.g. CL.SEX -> SEX
    let code = oid.replace(/^CL\./, '');
    // If it has numeric prefix like C66731.SEX, let's keep clean code or use name
    if (code.includes('.')) {
      const parts = code.split('.');
      code = parts[parts.length - 1];
    }

    // Get Codelist NCI code from direct Alias child (not inside items)
    let nciCode = null;
    const directAliasMatch = body.match(/<Alias\s+Name="([^"]+)"\s+Context="nci:ExtCodeID"\s*\/>/);
    if (directAliasMatch) {
      nciCode = directAliasMatch[1];
    }

    const terms = [];
    // Match EnumeratedItem or CodeListItem
    const itemRegex = /<(EnumeratedItem|CodeListItem)\s+CodedValue="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>|<(EnumeratedItem|CodeListItem)\s+CodedValue="([^"]*)"([^>]*)\/>/g;
    let im;
    let order = 10;
    while ((im = itemRegex.exec(body)) !== null) {
      const codedValue = im[2] || im[6] || '';
      const itemBody = im[4] || '';
      
      // NCI code for term
      const termNciMatch = itemBody.match(/<Alias\s+Name="([^"]+)"\s+Context="nci:ExtCodeID"/);
      const termNci = termNciMatch ? termNciMatch[1] : null;

      // Decode / Display value
      const decodeMatch = itemBody.match(/<Decode>\s*<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
      const displayValue = decodeMatch ? decodeMatch[1].trim() : codedValue;

      // Definition
      const defMatch = itemBody.match(/<def:Comment[^>]*>([\s\S]*?)<\/def:Comment>/);
      const definition = defMatch ? defMatch[1].trim() : `${displayValue} — permitted value for ${name}.`;

      terms.push({
        order_number: order,
        submission_value: codedValue,
        display_value: displayValue,
        definition: definition,
        nci_code: termNci
      });
      order += 10;
    }

    if (code && !codelistsMap.has(code)) {
      codelistsMap.set(code, {
        code,
        name: name || code,
        type: 'CODELIST',
        description: name ? `${name} controlled terminology` : 'CDISC Controlled Terminology',
        nci_code: nciCode,
        source: sourceName,
        version: versionDate,
        version_date: versionDate,
        extensible: extensible,
        terms
      });
    }
  }
}

parseCT(sdtmCtXml, 'CDISC SDTM CT 2026-03-27', '2026-03-27');
parseCT(adamCtXml, 'CDISC ADaM CT 2026-03-27', '2026-03-27');
console.log(`Parsed ${codelistsMap.size} codelists total.`);

// 2. PARSE ITEM DEFS (Variables metadata dictionary)
function parseItemDefs(xml) {
  const itemDefs = new Map(); // OID -> { name, label, type, length, codelist }
  const itemBlocks = xml.split(/<ItemDef\s+/);
  for (let i = 1; i < itemBlocks.length; i++) {
    const block = itemBlocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</ItemDef>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const oid = getAttr(header, 'OID');
    const name = getAttr(header, 'Name');
    const dataType = getAttr(header, 'DataType') || 'text';
    const length = getAttr(header, 'Length') || getAttr(header, 'val:Length') || '';

    // Description / label
    const descMatch = body.match(/<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
    const label = descMatch ? descMatch[1].trim() : name;

    // CodeListRef
    const clMatch = body.match(/<CodeListRef\s+CodeListOID="([^"]+)"/);
    let codelist = null;
    if (clMatch) {
      codelist = clMatch[1].replace(/^CL\./, '');
      if (codelist.includes('.')) {
        const parts = codelist.split('.');
        codelist = parts[parts.length - 1];
      }
    }

    itemDefs.set(oid, {
      oid,
      name,
      label,
      type: dataType === 'integer' || dataType === 'float' ? 'Num' : 'Char',
      length: length ? parseInt(length, 10) || 8 : (dataType === 'integer' || dataType === 'float' ? 8 : 200),
      codelist
    });
  }
  return itemDefs;
}

console.log('Parsing ItemDefs...');
const sdtmItemDefs = parseItemDefs(sdtmXml);
const adamItemDefs = parseItemDefs(adamXml);
console.log(`SDTM ItemDefs: ${sdtmItemDefs.size}, ADaM ItemDefs: ${adamItemDefs.size}`);

// 3. PARSE DOMAINS AND THEIR VARIABLES
function parseDomainsAndVars(xml, standard, purpose, itemDefs) {
  const domains = [];
  const variables = [];

  const igBlocks = xml.split(/<ItemGroupDef\s+/);
  for (let i = 1; i < igBlocks.length; i++) {
    const block = igBlocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</ItemGroupDef>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const oid = getAttr(header, 'OID');
    const code = getAttr(header, 'Name');
    // Skip SYSTEM or UNRECOGNIZED
    if (code === 'GLOBAL' || code === 'UNRECOGNIZED' || !code) continue;

    const structure = getAttr(header, 'def:Structure') || (purpose === 'Tabulation' ? 'One record per observation' : 'Analysis dataset');
    const cls = getAttr(header, 'def:Class') || (standard === 'ADaM' ? 'Analysis' : 'General');
    const repeating = getAttr(header, 'Repeating') || 'Yes';

    // Description
    const descMatch = body.match(/<Description>\s*<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
    const name = descMatch ? descMatch[1].trim() : code;

    // Parse ItemRefs
    const itemRefs = [];
    const itemRefRegex = /<ItemRef\s+([^>]*)\/>/g;
    let irm;
    const keyVars = [];

    while ((irm = itemRefRegex.exec(body)) !== null) {
      const refAttrs = irm[1];
      const itemOID = getAttr(refAttrs, 'ItemOID');
      const orderNumber = parseInt(getAttr(refAttrs, 'OrderNumber'), 10) || (itemRefs.length + 1);
      const mandatory = getAttr(refAttrs, 'Mandatory') === 'Yes';
      const keySeq = getAttr(refAttrs, 'KeySequence');
      const role = getAttr(refAttrs, 'Role') || 'QUALIFIER';
      const core = getAttr(refAttrs, 'val:Core') || (mandatory ? 'Req' : 'Exp');

      const def = itemDefs.get(itemOID) || {
        name: itemOID.split('.').pop(),
        label: itemOID.split('.').pop(),
        type: 'Char',
        length: 200,
        codelist: null
      };

      if (keySeq) {
        keyVars.push(def.name);
      } else if (role.toUpperCase().includes('IDENTIFIER') && !keyVars.includes(def.name)) {
        keyVars.push(def.name);
      }

      // Default origin
      let origin = 'CRF';
      if (def.name.endsWith('SEQ') || def.name.endsWith('DTC') && def.name.startsWith('RF')) origin = 'DERIVED';
      else if (def.name === 'STUDYID' || def.name === 'DOMAIN') origin = 'ASSIGNED';
      else if (standard === 'ADaM') origin = 'SDTM';

      variables.push({
        study_id: 'GLOBAL',
        standard,
        domain: code,
        name: def.name,
        label: def.label,
        type: def.type,
        length: def.length,
        format: def.type === 'Num' ? '8.' : '',
        role: role.toUpperCase(),
        origin,
        derivation: '',
        codelist: def.codelist,
        key_seq: keySeq ? parseInt(keySeq, 10) : null,
        core,
        version: '1.0',
        status: 'ACTIVE',
        effective_from: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
        updated_by: 'CDISC Standards Lead',
        change_reason: `Imported from ${standard} IG`
      });
    }

    domains.push({
      study_id: 'GLOBAL',
      standard,
      code,
      name,
      description: `${name} ${standard === 'SDTM' ? 'domain' : 'dataset'} per CDISC specification.`,
      structure,
      cls,
      purpose,
      key_variables: keyVars.slice(0, 5).join(', '),
      version: '1.0',
      status: 'ACTIVE',
      updated_at: '2026-03-27T00:00:00.000Z',
      updated_by: 'CDISC Standards Lead',
      change_reason: `CDISC ${standard} release`
    });
  }

  return { domains, variables };
}

console.log('Parsing SDTM & ADaM domains and variables...');
const sdtmData = parseDomainsAndVars(sdtmXml, 'SDTM', 'Tabulation', sdtmItemDefs);
const adamData = parseDomainsAndVars(adamXml, 'ADaM', 'Analysis', adamItemDefs);

console.log(`Parsed SDTM: ${sdtmData.domains.length} domains, ${sdtmData.variables.length} variables`);
console.log(`Parsed ADaM: ${adamData.domains.length} datasets, ${adamData.variables.length} variables`);

// 4. PARSE VLM (Value-Level Metadata)
console.log('Parsing VLM...');
const vlmList = [];

function parseVLM(xml, standard) {
  // Find def:ValueListDef and matching def:WhereClauseDef
  const whereClauses = new Map();
  const wcBlocks = xml.split(/<def:WhereClauseDef\s+/);
  for (let i = 1; i < wcBlocks.length; i++) {
    const block = wcBlocks[i];
    const headerEnd = block.indexOf('>');
    if (headerEnd === -1) continue;
    const header = block.slice(0, headerEnd);
    const oid = getAttr(header, 'OID');
    const itemOIDMatch = block.match(/def:ItemOID="([^"]+)"/);
    const compMatch = block.match(/Comparator="([^"]+)"/);
    const valMatch = block.match(/<CheckValue>([^<]+)<\/CheckValue>/);
    if (itemOIDMatch && valMatch) {
      const varName = itemOIDMatch[1].split('.').pop();
      const comp = compMatch ? compMatch[1] : 'EQ';
      const val = valMatch[1];
      whereClauses.set(oid, `${varName} ${comp === 'EQ' ? '=' : comp} '${val}'`);
    }
  }

  const vlBlocks = xml.split(/<def:ValueListDef\s+/);
  for (let i = 1; i < vlBlocks.length; i++) {
    const block = vlBlocks[i];
    const headerEnd = block.indexOf('>');
    if (headerEnd === -1) continue;
    const header = block.slice(0, headerEnd);
    const oid = getAttr(header, 'OID'); // e.g. VL.DI.DIVAL or VL.QS.QSTEST
    const parts = oid.split('.');
    if (parts.length < 3) continue;
    const domain = parts[1];
    const targetVar = parts[2];

    const itemRefPieces = block.split(/<ItemRef\s+/);
    for (let j = 1; j < itemRefPieces.length; j++) {
      const piece = itemRefPieces[j];
      const itemOID = getAttr(piece, 'ItemOID');
      const wcMatch = piece.match(/WhereClauseOID="([^"]+)"/);
      if (!itemOID || !wcMatch) continue;
      const wcOID = wcMatch[1];
      const condition = whereClauses.get(wcOID) || wcOID.replace(/^WC\./, '');

      vlmList.push({
        study_id: 'GLOBAL',
        standard,
        domain,
        when_clause: condition,
        where_clause: '—',
        name: targetVar,
        label: `${targetVar} where ${condition}`,
        type: 'Char',
        length: '200',
        origin: 'CRF',
        codelist: null,
        method: `Value-level metadata for ${condition}`,
        version: '1.0',
        status: 'ACTIVE',
        updated_at: '2026-03-27T00:00:00.000Z'
      });
    }
  }
}

parseVLM(sdtmXml, 'SDTM');
parseVLM(adamXml, 'ADaM');
console.log(`Parsed ${vlmList.length} VLM records.`);

// Save output summary JSON
const summary = {
  version_date: '2026-03-27',
  sdtm_domain_count: sdtmData.domains.length,
  sdtm_variable_count: sdtmData.variables.length,
  adam_dataset_count: adamData.domains.length,
  adam_variable_count: adamData.variables.length,
  codelist_count: codelistsMap.size,
  vlm_count: vlmList.length,
  domains: [...sdtmData.domains, ...adamData.domains],
  sample_codelists: Array.from(codelistsMap.values()).slice(0, 30),
  sample_vlm: vlmList.slice(0, 150)
};

fs.writeFileSync('scripts/parsed-cdisc.json', JSON.stringify(summary, null, 2));
console.log('Saved scripts/parsed-cdisc.json');
