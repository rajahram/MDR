const fs = require('fs');

function inspectItemsAndAdam() {
  const sdtm = fs.readFileSync('C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/SDTM-IG 3.4 (FDA).xml', 'utf8');
  // find ItemDef for SEX or AGE or RACE in DM
  const sexIdx = sdtm.indexOf('<ItemDef OID="IT.DM.SEX"');
  if (sexIdx !== -1) {
    console.log('--- SDTM IT.DM.SEX ---');
    console.log(sdtm.slice(sexIdx, sdtm.indexOf('</ItemDef>', sexIdx) + 10));
  }

  // inspect ADaM
  const adam = fs.readFileSync('C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/2508.1/ADaM-IG 1.3 (FDA).xml', 'utf8');
  const adslIdx = adam.indexOf('<ItemGroupDef OID="IG.ADSL"');
  if (adslIdx !== -1) {
    console.log('--- ADaM IG.ADSL ---');
    console.log(adam.slice(adslIdx, adslIdx + 1200));
  }

  // inspect ADaM CT
  const adamCt = fs.readFileSync('C:/Users/ginge/OneDrive/Documents/Pinnacle 21 Community/configs/data/CDISC/ADaM/2026-03-27/ADaM Terminology.odm.xml', 'utf8');
  console.log('--- ADaM CT Root ---');
  console.log(adamCt.slice(0, 1000));
  const clIdx = adamCt.indexOf('<CodeList ');
  if (clIdx !== -1) {
    console.log('--- ADaM CodeList ---');
    console.log(adamCt.slice(clIdx, adamCt.indexOf('</CodeList>', clIdx) + 11));
  }

  // inspect VLM in SDTM
  const whereIdx = sdtm.indexOf('<def:WhereClauseDef ');
  if (whereIdx !== -1) {
    console.log('--- WhereClauseDef ---');
    console.log(sdtm.slice(whereIdx, sdtm.indexOf('</def:WhereClauseDef>', whereIdx) + 21));
  }
}

inspectItemsAndAdam();
