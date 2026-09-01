const fs = require('fs');

// Load parsed-cdisc.json summary if needed, or re-run generator
const SDTM_XML_PATH = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/SDTM-IG 3.4 (FDA).xml';
const ADAM_XML_PATH = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/ADaM-IG 1.3 (FDA).xml';
const SDTM_CT_PATH  = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/data/CDISC/SDTM/2026-03-27/SDTM Terminology.odm.xml';
const ADAM_CT_PATH  = 'C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/data/CDISC/ADaM/2026-03-27/ADaM Terminology.odm.xml';

console.log('Loading XML files...');
const sdtmXml = fs.readFileSync(SDTM_XML_PATH, 'utf8');
const adamXml = fs.readFileSync(ADAM_XML_PATH, 'utf8');
const sdtmCtXml = fs.readFileSync(SDTM_CT_PATH, 'utf8');
const adamCtXml = fs.readFileSync(ADAM_CT_PATH, 'utf8');

function getAttr(tag, attr) {
  const m = tag.match(new RegExp('(?:^|\\s)' + attr + '="([^"]*)"'));
  return m ? m[1] : '';
}

// 1. Codelists
const codelists = [];
const codelistTerms = [];
const codelistSet = new Set();

function extractCT(xml, source, vDate) {
  const clBlocks = xml.split(/<CodeList\s+/);
  for (let i = 1; i < clBlocks.length; i++) {
    const block = clBlocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</CodeList>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const oid = getAttr(header, 'OID');
    const name = getAttr(header, 'Name');
    const extensible = getAttr(header, 'nciodm:CodeListExtensible') || 'No';

    let code = oid.replace(/^CL\./, '');
    if (code.includes('.')) {
      const parts = code.split('.');
      code = parts[parts.length - 1];
    }
    if (!code || codelistSet.has(code)) continue;
    codelistSet.add(code);

    let nciCode = null;
    const directAlias = body.match(/<Alias\s+Name="([^"]+)"\s+Context="nci:ExtCodeID"\s*\/>/);
    if (directAlias) nciCode = directAlias[1];

    codelists.push({
      code,
      name: name || code,
      type: 'CODELIST',
      description: name ? `${name} controlled terminology` : 'CDISC Controlled Terminology',
      nci_code: nciCode,
      source,
      version: vDate,
      version_date: vDate,
      extensible,
      status: 'ACTIVE',
      updated_at: '2026-03-27T00:00:00.000Z'
    });

    const itemRegex = /<(EnumeratedItem|CodeListItem)\s+CodedValue="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>|<(EnumeratedItem|CodeListItem)\s+CodedValue="([^"]*)"([^>]*)\/>/g;
    let im;
    let order = 10;
    while ((im = itemRegex.exec(body)) !== null) {
      const codedValue = im[2] || im[6] || '';
      const itemBody = im[4] || '';

      const termNciMatch = itemBody.match(/<Alias\s+Name="([^"]+)"\s+Context="nci:ExtCodeID"/);
      const termNci = termNciMatch ? termNciMatch[1] : null;

      const decodeMatch = itemBody.match(/<Decode>\s*<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
      const displayValue = decodeMatch ? decodeMatch[1].trim() : codedValue;

      const defMatch = itemBody.match(/<def:Comment[^>]*>([\s\S]*?)<\/def:Comment>/);
      const definition = defMatch ? defMatch[1].trim() : `${displayValue} — permitted value for ${name}.`;

      codelistTerms.push({
        codelist: code,
        order_number: order,
        submission_value: codedValue,
        display_value: displayValue,
        definition: definition.slice(0, 300),
        nci_code: termNci,
        status: 'ACTIVE',
        created_at: '2026-03-27T00:00:00.000Z'
      });
      order += 10;
    }
  }
}

extractCT(sdtmCtXml, 'CDISC SDTM CT 2026-03-27', '2026-03-27');
extractCT(adamCtXml, 'CDISC ADaM CT 2026-03-27', '2026-03-27');
console.log(`Codelists: ${codelists.length}, Terms: ${codelistTerms.length}`);

// 2. ItemDefs
function getItemDefs(xml) {
  const itemDefs = new Map();
  const blocks = xml.split(/<ItemDef\s+/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</ItemDef>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const oid = getAttr(header, 'OID');
    const name = getAttr(header, 'Name');
    const dataType = getAttr(header, 'DataType') || 'text';
    const length = getAttr(header, 'Length') || getAttr(header, 'val:Length') || '';

    const descMatch = body.match(/<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
    const label = descMatch ? descMatch[1].trim() : name;

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
      name,
      label,
      type: dataType === 'integer' || dataType === 'float' ? 'Num' : 'Char',
      length: length ? parseInt(length, 10) || 8 : (dataType === 'integer' || dataType === 'float' ? 8 : 200),
      codelist
    });
  }
  return itemDefs;
}

const sdtmItemDefs = getItemDefs(sdtmXml);
const adamItemDefs = getItemDefs(adamXml);

// 3. Domains & Variables
const domains = [];
const variables = [];

function extractDomains(xml, standard, purpose, itemDefs) {
  const igBlocks = xml.split(/<ItemGroupDef\s+/);
  for (let i = 1; i < igBlocks.length; i++) {
    const block = igBlocks[i];
    const headerEnd = block.indexOf('>');
    const header = block.slice(0, headerEnd);
    const bodyEnd = block.indexOf('</ItemGroupDef>');
    const body = bodyEnd !== -1 ? block.slice(headerEnd + 1, bodyEnd) : block.slice(headerEnd + 1);

    const code = getAttr(header, 'Name');
    if (!code || code === 'GLOBAL' || code === 'UNRECOGNIZED') continue;

    const structure = getAttr(header, 'def:Structure') || (purpose === 'Tabulation' ? 'One record per observation' : 'Analysis dataset');
    const cls = getAttr(header, 'def:Class') || (standard === 'ADaM' ? 'Analysis' : 'General');
    const descMatch = body.match(/<Description>\s*<TranslatedText[^>]*>([\s\S]*?)<\/TranslatedText>/);
    const name = descMatch ? descMatch[1].trim() : code;

    const itemRefPieces = body.split(/<ItemRef\s+/);
    const keyVars = [];

    for (let j = 1; j < itemRefPieces.length; j++) {
      const piece = itemRefPieces[j];
      const itemOID = getAttr(piece, 'ItemOID');
      const keySeq = getAttr(piece, 'KeySequence');
      const role = getAttr(piece, 'Role') || 'QUALIFIER';
      const mandatory = getAttr(piece, 'Mandatory') === 'Yes';
      const core = getAttr(piece, 'val:Core') || (mandatory ? 'Req' : 'Exp');

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

      let origin = 'CRF';
      if (def.name.endsWith('SEQ') || (def.name.endsWith('DTC') && def.name.startsWith('RF'))) origin = 'DERIVED';
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
        derivation: standard === 'ADaM' ? `Mapped from SDTM.${code.replace(/^AD/, '')} / derivation` : '',
        codelist: def.codelist,
        key_seq: keySeq ? parseInt(keySeq, 10) : null,
        core,
        version: '1.0',
        status: 'ACTIVE',
        effective_from: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
        updated_by: 'CDISC Standards Lead',
        change_reason: `CDISC ${standard} release`
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
      key_variables: keyVars.slice(0, 6).join(', '),
      version: '1.0',
      status: 'ACTIVE',
      updated_at: '2026-03-27T00:00:00.000Z',
      updated_by: 'CDISC Standards Lead',
      change_reason: `Imported from ${standard} IG`
    });
  }
}

extractDomains(sdtmXml, 'SDTM', 'Tabulation', sdtmItemDefs);
extractDomains(adamXml, 'ADaM', 'Analysis', adamItemDefs);
console.log(`Domains: ${domains.length}, Variables: ${variables.length}`);

// 4. VLM
const vlmList = [];
function extractVLM(xml, standard) {
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
    const oid = getAttr(header, 'OID');
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
        method: `Value-level metadata specification for ${condition}`,
        version: '1.0',
        status: 'ACTIVE',
        updated_at: '2026-03-27T00:00:00.000Z'
      });
    }
  }
}

extractVLM(sdtmXml, 'SDTM');
extractVLM(adamXml, 'ADaM');
console.log(`VLM: ${vlmList.length}`);

// We write directly into a JSON file for the app:
const cdiscData = {
  version_date: '2026-03-27',
  domains,
  variables,
  codelists,
  terms: codelistTerms,
  vlm: vlmList
};

fs.writeFileSync('src/data/cdiscData.json', JSON.stringify(cdiscData));
console.log(`Wrote src/data/cdiscData.json with ${domains.length} domains, ${variables.length} variables, ${codelists.length} codelists, ${codelistTerms.length} terms, ${vlmList.length} VLM!`);
