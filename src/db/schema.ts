import type { Database } from "sql.js";
import { run } from "./sqlite";
import { seedAdamVars, seedCrfFields, seedSdtmVars, seedTfls } from "../data/seed";

export const DDL = `
CREATE TABLE IF NOT EXISTS studies (
  study_id TEXT PRIMARY KEY, study_name TEXT, protocol TEXT, phase TEXT, ta TEXT,
  crf_name TEXT, crf_version TEXT, sdtm_ig TEXT, adam_ig TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, standard TEXT, code TEXT, name TEXT,
  description TEXT, structure TEXT, cls TEXT, version TEXT, status TEXT,
  updated_at TEXT, updated_by TEXT, change_reason TEXT
);
CREATE TABLE IF NOT EXISTS variables (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, standard TEXT, domain TEXT, name TEXT,
  label TEXT, type TEXT, length INTEGER, format TEXT, role TEXT, origin TEXT, derivation TEXT,
  codelist TEXT, key_seq INTEGER, core TEXT, version TEXT, status TEXT, effective_from TEXT,
  updated_at TEXT, updated_by TEXT, change_reason TEXT
);
CREATE TABLE IF NOT EXISTS variable_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, var_id INTEGER, version TEXT, label TEXT, type TEXT,
  length INTEGER, role TEXT, origin TEXT, derivation TEXT, codelist TEXT, status TEXT,
  change_reason TEXT, created_by TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS ct_codelists (
  code TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, nci_code TEXT, source TEXT,
  version TEXT, status TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS ct_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, codelist TEXT, order_number INTEGER,
  submission_value TEXT, display_value TEXT, definition TEXT, nci_code TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS vlm (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, standard TEXT, domain TEXT,
  when_clause TEXT, where_clause TEXT, name TEXT, label TEXT, type TEXT, length TEXT,
  origin TEXT, codelist TEXT, method TEXT, version TEXT, status TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS crf_pages (
  page_id TEXT PRIMARY KEY, study_id TEXT, crf_name TEXT, crf_version TEXT, page_code TEXT,
  page_name TEXT, form_type TEXT, repeating TEXT, status TEXT, effective_from TEXT
);
CREATE TABLE IF NOT EXISTS crf_fields (
  oid TEXT, study_id TEXT, page_id TEXT, label TEXT, data_type TEXT,
  required INTEGER, codelist TEXT, status TEXT, version TEXT,
  PRIMARY KEY (study_id, oid)
);
CREATE TABLE IF NOT EXISTS map_c2s (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, src TEXT, tgt TEXT, method TEXT
);
CREATE TABLE IF NOT EXISTS map_s2a (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, src TEXT, tgt TEXT, method TEXT
);
CREATE TABLE IF NOT EXISTS tfls (
  code TEXT, study_id TEXT, kind TEXT, title TEXT, adam_vars TEXT, status TEXT, version TEXT,
  PRIMARY KEY (study_id, code)
);
CREATE TABLE IF NOT EXISTS dispositions (
  crf_oid TEXT, study_id TEXT, reason TEXT,
  PRIMARY KEY (study_id, crf_oid)
);
CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, version TEXT, type TEXT, released_at TEXT,
  released_by TEXT, approved_by TEXT, notes TEXT, status TEXT, added INTEGER, changed INTEGER, deprecated INTEGER
);
CREATE TABLE IF NOT EXISTS audit_trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, actor TEXT, action TEXT, entity TEXT, record TEXT,
  field TEXT, old_value TEXT, new_value TEXT, reason TEXT, study_id TEXT
);
`;

/* ── reference dictionaries ───────────────────────────────────── */
const DOMAIN_META: Record<string, { name: string; structure: string; cls: string }> = {
  DM: { name: "Demographics", structure: "One record per subject", cls: "Special Purpose" },
  VS: { name: "Vital Signs", structure: "One record per subject, visit, test", cls: "Findings" },
  AE: { name: "Adverse Events", structure: "One record per subject, event", cls: "Events" },
  CM: { name: "Concomitant Medications", structure: "One record per subject, medication", cls: "Interventions" },
  LB: { name: "Laboratory Tests Results", structure: "One record per subject, visit, test", cls: "Findings" },
  EX: { name: "Exposure", structure: "One record per subject, dose", cls: "Interventions" },
  PC: { name: "Pharmacokinetics Concentrations", structure: "One record per subject, timepoint, analyte", cls: "Findings" },
  ADSL: { name: "Subject-Level Analysis", structure: "One record per subject", cls: "ADaM — Subject-Level" },
  ADVS: { name: "Vital Signs Analysis", structure: "BDS — one record per parameter, visit", cls: "ADaM — BDS" },
  ADAE: { name: "Adverse Events Analysis", structure: "OCCDS — one record per subject, event", cls: "ADaM — OCCDS" },
  ADCM: { name: "Concomitant Meds Analysis", structure: "OCCDS — one record per subject, medication", cls: "ADaM — OCCDS" },
  ADLB: { name: "Laboratory Analysis", structure: "BDS — one record per parameter, visit", cls: "ADaM — BDS" },
  ADPC: { name: "PK Concentrations Analysis", structure: "BDS — one record per parameter, timepoint", cls: "ADaM — BDS" },
};

const PAGE_META: Record<string, { name: string; form: string; repeating: string }> = {
  DM: { name: "Demographics", form: "Subject Form", repeating: "No" },
  VS: { name: "Vital Signs", form: "Visit Form", repeating: "No" },
  AE: { name: "Adverse Events", form: "Log Form", repeating: "Yes" },
  CM: { name: "Concomitant Medications", form: "Log Form", repeating: "Yes" },
  LB: { name: "Local Laboratory", form: "Visit Form", repeating: "No" },
  EX: { name: "Exposure / Dosing", form: "Visit Form", repeating: "Yes" },
  PK: { name: "Pharmacokinetics Sampling", form: "Log Form", repeating: "Yes" },
};

const PEOPLE = ["S. Iyer — Data Standards Lead", "M. Okafor — MDR Admin", "R. Tanaka — Clinical Data Mgmt"];

/* ── controlled terminology seed ──────────────────────────────── */
const CT: { code: string; name: string; desc: string; nci: string | null; source: string; terms: [string, string, string | null][] }[] = [
  { code: "SEX", name: "Sex", desc: "Physical sexual characteristics of the subject.", nci: "C28421", source: "NCI/CDISC CT 2023-12-15", terms: [["M", "Male", "C20197"], ["F", "Female", "C16576"], ["U", "Unknown", "C17998"]] },
  { code: "NY", name: "No Yes Response", desc: "Generic yes / no response codelist.", nci: "C66742", source: "NCI/CDISC CT 2023-12-15", terms: [["Y", "Yes", "C49488"], ["N", "No", "C49487"]] },
  { code: "RACE", name: "Race", desc: "Racial identity per OMB / CDISC categories.", nci: "C74457", source: "NCI/CDISC CT 2023-12-15", terms: [["AMERICAN INDIAN OR ALASKA NATIVE", "American Indian or Alaska Native", null], ["ASIAN", "Asian", null], ["BLACK OR AFRICAN AMERICAN", "Black or African American", null], ["WHITE", "White", null], ["MULTIPLE", "Multiple", null], ["NOT REPORTED", "Not Reported", null]] },
  { code: "ETHNIC", name: "Ethnicity", desc: "Ethnic group per OMB / CDISC categories.", nci: "C66790", source: "NCI/CDISC CT 2023-12-15", terms: [["HISPANIC OR LATINO", "Hispanic or Latino", null], ["NOT HISPANIC OR LATINO", "Not Hispanic or Latino", null], ["NOT REPORTED", "Not Reported", null]] },
  { code: "SEV", name: "Severity/Intensity Scale", desc: "Intensity of a clinical event or condition.", nci: "C66769", source: "NCI/CDISC CT 2023-12-15", terms: [["MILD", "Mild", null], ["MODERATE", "Moderate", null], ["SEVERE", "Severe", null]] },
  { code: "REL", name: "Relationship to Study Drug", desc: "Investigator-assessed causality.", nci: null, source: "Sponsor-defined", terms: [["RELATED", "Related", null], ["POSSIBLY RELATED", "Possibly Related", null], ["NOT RELATED", "Not Related", null]] },
  { code: "OUT", name: "Outcome of Event", desc: "Outcome of an adverse event.", nci: null, source: "Sponsor-defined", terms: [["RECOVERED/RESOLVED", "Recovered/Resolved", null], ["RECOVERING/RESOLVING", "Recovering/Resolving", null], ["NOT RECOVERED/NOT RESOLVED", "Not Recovered/Not Resolved", null], ["RECOVERED/RESOLVED WITH SEQUELAE", "Recovered with Sequelae", null], ["FATAL", "Fatal", null], ["UNKNOWN", "Unknown", null]] },
  { code: "ACN", name: "Action Taken with Study Drug", desc: "Action taken with the suspect medication.", nci: null, source: "Sponsor-defined", terms: [["DOSE NOT CHANGED", "Dose Not Changed", null], ["DOSE REDUCED", "Dose Reduced", null], ["DRUG INTERRUPTED", "Drug Interrupted", null], ["DRUG WITHDRAWN", "Drug Withdrawn", null], ["UNKNOWN", "Unknown", null]] },
  { code: "VSPOS", name: "Body Position", desc: "Position of the subject during vital signs collection.", nci: null, source: "Sponsor-defined", terms: [["SUPINE", "Supine", null], ["SITTING", "Sitting", null], ["STANDING", "Standing", null]] },
  { code: "UNIT", name: "Unit", desc: "Dose / administration units (subset used by protocol).", nci: null, source: "Sponsor-defined", terms: [["mg", "Milligram", null], ["mL", "Millilitre", null], ["mg/kg", "Milligram per Kilogram", null]] },
  { code: "FREQ", name: "Frequency", desc: "Dosing frequency per interval.", nci: null, source: "Sponsor-defined", terms: [["QD", "Once Daily", null], ["BID", "Twice Daily", null], ["QID", "Four Times Daily", null], ["PRN", "As Needed", null]] },
  { code: "LBCAT", name: "Laboratory Category", desc: "Category of local laboratory test.", nci: null, source: "Sponsor-defined", terms: [["CHEMISTRY", "Chemistry", null], ["HEMATOLOGY", "Hematology", null], ["COAGULATION", "Coagulation", null]] },
  { code: "TRT", name: "Protocol Treatment", desc: "Treatments administered per randomisation arm.", nci: null, source: "Sponsor-defined", terms: [["VX-201 100 MG", "VX-201 100 mg tablet", null], ["VX-201 200 MG", "VX-201 200 mg tablet", null], ["PLACEBO", "Matching placebo", null]] },
];

/* ── value-level metadata seed ────────────────────────────────── */
const VLM_SEED: [string, string, string, string, string, string, string, string, string, string, string][] = [
  // study, standard, domain, when, where, name, label, type, length, origin + method
  ["VX-201", "SDTM", "VS", "VSTESTCD = 'HEIGHT'", "—", "VSORRES", "Height reported in cm", "Num", "5.1", "CRF", "Copied from CRF; no unit conversion required"],
  ["VX-201", "SDTM", "VS", "VSTESTCD = 'TEMP'", "—", "VSORRES", "Body temperature in °C", "Num", "4.1", "CRF", "Converted to °F standard when VSSTRESU = FAHRENHEIT"],
  ["VX-201", "SDTM", "LB", "LBTESTCD = 'GLUC'", "LBCAT = 'CHEMISTRY'", "LBORRES", "Glucose result, mg/dL", "Num", "6.1", "CRF", "Converted from mmol/L via × 18.016 when source unit differs"],
  ["VX-201", "SDTM", "LB", "LBTESTCD = 'HGB'", "LBCAT = 'HEMATOLOGY'", "LBSTRESC", "Hemoglobin standardized, g/dL", "Num", "5.1", "DERIVED", "Standardised from SI units (g/L ÷ 10)"],
  ["VX-201", "SDTM", "AE", "AESER = 'Y'", "—", "AESEV", "Severity restricted for serious events", "Char", "8", "CRF", "Serious events must be SEVERE or LIFE-THREATENING per protocol"],
  ["VX-201", "SDTM", "EX", "EXTRT = 'PLACEBO'", "—", "EXDOSE", "Placebo dose administered", "Num", "3", "DERIVED", "Recorded as 0 mg; EXDOSU remains mg"],
  ["VX-201", "ADaM", "ADLB", "PARAMCD = 'K'", "—", "ANRIND", "Potassium reference indicator", "Char", "8", "DERIVED", "AVAL vs ANRLO/ANRHI with critical-value override"],
  ["VX-201", "ADaM", "ADAE", "ASER = 'Y'", "—", "ADURN", "SAE duration, days", "Num", "8", "DERIVED", "AENDT − ASTDT + 1; ongoing SAEs censored at data cutoff"],
  ["VX-104", "SDTM", "PC", "PCTESTCD = 'VX104'", "—", "PCORRES", "VX-104 plasma concentration", "Num", "10.3", "CRF", "Central lab result in ng/mL, below LLOQ flagged in PCSTAT"],
  ["VX-104", "ADaM", "ADPC", "PARAMCD = 'VX104'", "—", "AVAL", "Concentration in ng/mL", "Num", "10.3", "SDTM", "AVAL = PCSTRESN; BLQ records set to 0 per SAP"],
];

export function seedDatabase(db: Database): void {
  db.run(DDL);

  /* studies */
  run(db, `INSERT INTO studies VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
    "VX-201", "VX-201 Hypertension Study", "VX-201-CL-002", "Phase II", "Cardiovascular / Renal",
    "VX-201 eCRF (Medidata Rave)", "v2.1", "SDTM IG 3.4", "ADaM IG 1.3", "ACTIVE", "2025-10-06T09:00:00.000Z",
  ]);
  run(db, `INSERT INTO studies VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
    "VX-104", "VX-104 First-in-Human SAD/MAD", "VX-104-CL-001", "Phase I", "Clinical Pharmacology",
    "VX-104 eCRF (Veeva CDMS)", "v1.3", "SDTM IG 3.4", "ADaM IG 1.3", "ACTIVE", "2025-12-15T09:00:00.000Z",
  ]);

  /* controlled terminology */
  for (const c of CT) {
    run(db, `INSERT INTO ct_codelists VALUES (?,?,?,?,?,?,?,?,?)`, [
      c.code, c.name, "CODELIST", c.desc, c.nci, c.source, "2023-12-15", "ACTIVE", "2025-12-18T10:12:00.000Z",
    ]);
    c.terms.forEach(([sv, dv, nci], i) => {
      run(db, `INSERT INTO ct_terms (codelist, order_number, submission_value, display_value, definition, nci_code, status, created_at) VALUES (?,?,?,?,?,?,?,?)`, [
        c.code, (i + 1) * 10, sv, dv, `${dv} — permitted term of ${c.name}.`, nci, "ACTIVE", "2025-12-18T10:12:00.000Z",
      ]);
    });
  }

  /* VX-201 — full seed */
  const S = "VX-201";
  const crfName = "VX-201 eCRF (Medidata Rave)";

  for (const f of seedCrfFields) {
    const pid = `${S}:${f.pageCode}`;
    if (!db.exec(`SELECT 1 FROM crf_pages WHERE page_id='${pid}'`).length) {
      const m = PAGE_META[f.pageCode] ?? { name: f.page, form: "Visit Form", repeating: "No" };
      run(db, `INSERT INTO crf_pages VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        pid, S, crfName, "v2.1", f.pageCode, m.name, m.form, m.repeating, "ACTIVE", "2025-11-10T08:00:00.000Z",
      ]);
    }
    run(db, `INSERT INTO crf_fields VALUES (?,?,?,?,?,?,?,?,?)`, [
      f.id, S, pid, f.label, f.dataType, f.required ? 1 : 0, f.codelist ?? null, "ACTIVE", "2.1",
    ]);
  }

  let seq = 0;
  const seenC2S = new Set<string>();
  const seenS2A = new Set<string>();
  const rot = () => PEOPLE[seq++ % PEOPLE.length];

  for (const v of seedSdtmVars) {
    run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      S, "SDTM", v.domain, v.name, v.label, v.type, v.length, "", v.role, v.origin, v.derivation ?? "", v.codelist ?? null,
      v.role === "IDENTIFIER" ? 1 : null, v.role === "IDENTIFIER" ? "Req" : "Exp",
      "1.2", "ACTIVE", "2025-12-01T00:00:00.000Z", "2026-01-12T14:22:00.000Z", rot(), "SDTM define v1.0 publication",
    ]);
    for (const cfid of v.crfFieldIds) {
      const key = `${cfid}>${v.id}`;
      if (!seenC2S.has(key)) {
        seenC2S.add(key);
        run(db, `INSERT INTO map_c2s (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S, cfid, v.id, "EDC extract → SAS mapping spec"]);
      }
    }
  }

  for (const v of seedAdamVars) {
    run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      S, "ADaM", v.dataset, v.name, v.label, v.type, v.length, v.type === "Num" ? "8." : "", "", v.origin, v.derivation ?? "", null,
      v.name === "USUBJID" ? 1 : null, "Req",
      "1.1", "ACTIVE", "2026-01-05T00:00:00.000Z", "2026-02-02T09:41:00.000Z", rot(), "ADaM define v1.0 publication",
    ]);
    for (const sid of v.sdtmVarIds) {
      const key = `${sid}>${v.id}`;
      if (!seenS2A.has(key)) {
        seenS2A.add(key);
        run(db, `INSERT INTO map_s2a (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S, sid, v.id, v.derivation ?? "Direct copy from SDTM"]);
      }
    }
  }

  /* governance-flavoured variable states for VX-201 */
  run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    S, "SDTM", "CM", "CMINDC", "Indication", "Char", 60, "", "QUALIFIER", "CRF", "Copied from CRF CM.CMINDC.", null, null, "Perm",
    "0.9", "DEPRECATED", "2025-12-01T00:00:00.000Z", "2026-01-20T11:05:00.000Z", "S. Iyer — Data Standards Lead",
    "Variable removed from SDTM IG in v3.3 — retained for legacy traceability only.",
  ]);
  run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    S, "ADaM", "ADSL", "BMIBL", "Baseline BMI (kg/m2)", "Num", 8, "8.1", "", "DERIVED", "WEIGHTBL / (HEIGHTBL/100)^2 from ADVS baseline values.", null, null, "Exp",
    "0.2", "DRAFT", "", "2026-02-09T16:30:00.000Z", "J. Lindqvist — Biostatistics",
    "New efficacy covariate requested in SAP v0.3 — pending standards review.",
  ]);
  run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    S, "ADaM", "ADVS", "ONTRTFL", "On-Treatment Record Flag", "Char", 1, "", "", "DERIVED", "'Y' if ADT within treatment window (RFSTDTC ≤ ADT ≤ RFENDTC+30).", null, null, "Exp",
    "0.3", "IN REVIEW", "", "2026-02-11T10:15:00.000Z", "A. Moreau — Statistical Programming",
    "SAP v0.4 requires on-treatment vital signs summaries — awaiting MDR admin approval.",
  ]);

  for (const t of seedTfls) {
    run(db, `INSERT INTO tfls VALUES (?,?,?,?,?,?,?)`, [t.code, S, t.kind, t.title, t.adamVarIds.join("|"), "ACTIVE", "1.0"]);
  }

  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["DM.SCRFAIL", S, "Operational field — screen failure management only, not part of the submission data model."]);
  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["AE.AEINIT", S, "Personally identifiable information — redacted prior to SDTM conversion."]);
  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["CM.CMINDC", S, "CMINDC deprecated in SDTM v3.3 — indication no longer has a submission home."]);

  /* VX-104 — Phase I PK study */
  const S2 = "VX-104";
  const crfName2 = "VX-104 eCRF (Veeva CDMS)";
  const pcFields: [string, string, string, string, number, string | null][] = [
    [`${S2}:DM`, "DM.BRTHDAT", "Date of Birth", "date", 1, null],
    [`${S2}:DM`, "DM.SEX", "Sex", "coded", 1, "SEX"],
    [`${S2}:DM`, "DM.RACE", "Race", "coded", 1, "RACE"],
    [`${S2}:EX`, "EX.EXDAT", "Date of Dose", "date", 1, null],
    [`${S2}:EX`, "EX.EXDOSE", "Dose Administered (mg)", "float", 1, null],
    [`${S2}:EX`, "EX.EXTRT", "Treatment Administered", "coded", 1, "TRT"],
    [`${S2}:PK`, "PC.PCDAT", "Sample Date", "date", 1, null],
    [`${S2}:PK`, "PC.PCTPT", "Planned Time Point", "text", 1, null],
    [`${S2}:PK`, "PC.PCORRES", "Analyte Concentration (ng/mL)", "float", 1, null],
    [`${S2}:PK`, "PC.PCORRESU", "Result Units", "text", 0, null],
  ];
  for (const [pid, oid, label, dt, req, cl] of pcFields) {
    if (!db.exec(`SELECT 1 FROM crf_pages WHERE page_id='${pid}'`).length) {
      const code = pid.split(":")[1];
      const m = PAGE_META[code];
      run(db, `INSERT INTO crf_pages VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        pid, S2, crfName2, "v1.3", code, m.name, m.form, m.repeating, "ACTIVE", "2026-01-05T08:00:00.000Z",
      ]);
    }
    run(db, `INSERT INTO crf_fields VALUES (?,?,?,?,?,?,?,?,?)`, [oid, S2, pid, label, dt, req, cl, "ACTIVE", "1.3"]);
  }

  const v104Domains: [string, string, string][] = [
    ["SDTM", "DM", "ACTIVE"], ["SDTM", "EX", "ACTIVE"], ["SDTM", "PC", "ACTIVE"],
    ["ADaM", "ADSL", "ACTIVE"], ["ADaM", "ADPC", "DRAFT"],
  ];
  for (const [std, code, st] of v104Domains) {
    const m = DOMAIN_META[code];
    run(db, `INSERT INTO domains (study_id, standard, code, name, description, structure, cls, version, status, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
      S2, std, code, m.name, `${m.name} domain for VX-104.`, m.structure, m.cls, "1.0", st,
      "2026-01-28T13:00:00.000Z", "M. Okafor — MDR Admin", st === "DRAFT" ? "New domain onboarded for SAD cohort — define in preparation." : "VX-104 MDR baseline v0.5",
    ]);
  }

  const v104Vars: [string, string, string, string, string, number, string, string, string, string, string][] = [
    // std, domain, name, label, type, length, role, origin, derivation, status, version
    ["SDTM", "DM", "USUBJID", "Unique Subject Identifier", "Char", 15, "IDENTIFIER", "ASSIGNED", "STUDYID || SITEID || SUBJID", "ACTIVE", "1.0"],
    ["SDTM", "DM", "SEX", "Sex", "Char", 1, "TOPIC", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "DM", "BRTHDT", "Date of Birth", "Char", 10, "TIMING", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "DM", "AGE", "Age", "Num", 8, "QUALIFIER", "DERIVED", "Years between BRTHDT and RFSTDTC", "ACTIVE", "1.0"],
    ["SDTM", "EX", "USUBJID", "Unique Subject Identifier", "Char", 15, "IDENTIFIER", "ASSIGNED", "", "ACTIVE", "1.0"],
    ["SDTM", "EX", "EXSEQ", "Sequence Number", "Num", 8, "IDENTIFIER", "ASSIGNED", "Generated per USUBJID", "ACTIVE", "1.0"],
    ["SDTM", "EX", "EXSTDTC", "Start Date of Treatment", "Char", 10, "TIMING", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "EX", "EXTRT", "Name of Actual Treatment", "Char", 15, "TOPIC", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "EX", "EXDOSE", "Dose Administered", "Num", 8, "QUALIFIER", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "PC", "USUBJID", "Unique Subject Identifier", "Char", 15, "IDENTIFIER", "ASSIGNED", "", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCSEQ", "Sequence Number", "Num", 8, "IDENTIFIER", "ASSIGNED", "Generated per USUBJID", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCTESTCD", "PK Test Short Name", "Char", 8, "TOPIC", "ASSIGNED", "Analyte mapping — VX104", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCTEST", "PK Test Name", "Char", 40, "TOPIC", "ASSIGNED", "Lookup keyed by PCTESTCD", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCDTC", "Specimen Collection Date/Time", "Char", 19, "TIMING", "DERIVED", "ISO 8601 of sample date + actual time", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCTPT", "Planned Time Point Name", "Char", 30, "TIMING", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCTPTNUM", "Planned Time Point Number", "Num", 8, "TIMING", "DERIVED", "Numeric mapping of PCTPT", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCORRES", "Result in Original Units", "Char", 20, "TOPIC", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCORRESU", "Original Units", "Char", 10, "QUALIFIER", "CRF", "", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCSTRESC", "Standardized Result (Char)", "Char", 20, "QUALIFIER", "DERIVED", "PCORRES in ng/mL", "ACTIVE", "1.0"],
    ["SDTM", "PC", "PCSTRESN", "Standardized Result (Numeric)", "Num", 10, "QUALIFIER", "DERIVED", "Numeric conversion of PCSTRESC", "ACTIVE", "1.0"],
    ["ADaM", "ADSL", "USUBJID", "Unique Subject Identifier", "Char", 15, "", "SDTM", "", "ACTIVE", "1.0"],
    ["ADaM", "ADSL", "AGE", "Age (years)", "Num", 8, "", "SDTM", "", "ACTIVE", "1.0"],
    ["ADaM", "ADSL", "SEX", "Sex", "Char", 1, "", "SDTM", "", "ACTIVE", "1.0"],
    ["ADaM", "ADSL", "TRT01P", "Planned Treatment", "Char", 20, "", "SDTM", "From randomisation list", "ACTIVE", "1.0"],
    ["ADaM", "ADSL", "SAFFL", "Safety Population Flag", "Char", 1, "", "DERIVED", "'Y' if ≥ 1 dose administered", "ACTIVE", "1.0"],
    ["ADaM", "ADPC", "USUBJID", "Unique Subject Identifier", "Char", 15, "", "SDTM", "", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "PARAMCD", "Parameter Code", "Char", 8, "", "DERIVED", "PCTESTCD translated via BDS lookup", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "AVAL", "Analysis Value (ng/mL)", "Num", 8, "", "SDTM", "AVAL = PCSTRESN", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "AVALU", "Analysis Value Units", "Char", 10, "", "ASSIGNED", "Fixed 'ng/mL'", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "AFRLT", "Actual Time Rel. to First Dose (h)", "Num", 8, "", "DERIVED", "Hours between dose datetime and PCDTC", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "NFRLT", "Nominal Time Rel. to First Dose (h)", "Num", 8, "", "DERIVED", "Planned time point in hours", "DRAFT", "0.3"],
    ["ADaM", "ADPC", "NRELTM1", "Time of Last Measurable Conc. (h)", "Num", 8, "", "DERIVED", "AFRLT of last AVAL > LLOQ", "DRAFT", "0.3"],
  ];
  for (const [std, dom, name, label, type, length, role, origin, derivation, status, version] of v104Vars) {
    run(db, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      S2, std, dom, name, label, type, length, "", role, origin, derivation, name === "SEX" ? "SEX" : null,
      role === "IDENTIFIER" ? 1 : null, role === "IDENTIFIER" ? "Req" : "Exp", version, status,
      status === "ACTIVE" ? "2026-01-28T00:00:00.000Z" : "", "2026-02-05T15:10:00.000Z", "R. Tanaka — Clinical Data Mgmt",
      status === "DRAFT" ? "ADPC draft per PK analysis plan v0.2" : "VX-104 MDR baseline v0.5",
    ]);
  }

  const v104C2S: [string, string][] = [
    ["DM.BRTHDAT", "DM.BRTHDT"], ["DM.SEX", "DM.SEX"], ["DM.RACE", "DM.RACE"],
    ["EX.EXDAT", "EX.EXSTDTC"], ["EX.EXDOSE", "EX.EXDOSE"], ["EX.EXTRT", "EX.EXTRT"],
    ["PC.PCDAT", "PC.PCDTC"], ["PC.PCTPT", "PC.PCTPT"], ["PC.PCTPT", "PC.PCTPTNUM"],
    ["PC.PCORRES", "PC.PCORRES"], ["PC.PCORRES", "PC.PCSTRESC"], ["PC.PCORRES", "PC.PCSTRESN"], ["PC.PCORRESU", "PC.PCORRESU"],
  ];
  for (const [src, tgt] of v104C2S) run(db, `INSERT INTO map_c2s (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S2, src, tgt, "EDC extract → SAS mapping spec"]);

  const v104S2A: [string, string, string][] = [
    ["DM.SEX", "ADSL.SEX", "Direct copy"], ["DM.BRTHDT", "ADSL.AGE", "AGE derivation from BRTHDT"],
    ["PC.PCTESTCD", "ADPC.PARAMCD", "BDS parameter lookup"], ["PC.PCSTRESN", "ADPC.AVAL", "AVAL = PCSTRESN"],
    ["PC.PCDTC", "ADPC.AFRLT", "Hours relative to first dose"], ["PC.PCTPTNUM", "ADPC.NFRLT", "Planned time in hours"],
  ];
  for (const [src, tgt, m] of v104S2A) run(db, `INSERT INTO map_s2a (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S2, src, tgt, m]);

  const v104Tfls: [string, string, string, string][] = [
    ["T14.2.1", "Table", "Plasma Concentration Summary by Time Point", "ADPC.PARAMCD|ADPC.AVAL|ADPC.AFRLT"],
    ["F14.2.2", "Figure", "Mean Concentration–Time Profile (Semi-log)", "ADPC.PARAMCD|ADPC.AVAL|ADPC.NFRLT"],
    ["L16.2.4", "Listing", "Individual PK Concentration Listing", "ADPC.AVAL|ADPC.AFRLT|ADPC.NRELTM1"],
  ];
  for (const [code, kind, title, vars] of v104Tfls) {
    run(db, `INSERT INTO tfls VALUES (?,?,?,?,?,?,?)`, [code, S2, kind, title, vars, "ACTIVE", "1.0"]);
  }

  /* domains for VX-201 (derived from variable seed) */
  const v201Domains = new Map<string, string>();
  for (const v of seedSdtmVars) v201Domains.set(`SDTM:${v.domain}`, "SDTM");
  for (const v of seedAdamVars) v201Domains.set(`ADaM:${v.dataset}`, "ADaM");
  for (const key of v201Domains.keys()) {
    const [std, code] = key.split(":");
    const m = DOMAIN_META[code];
    const st = code === "ADCM" ? "IN REVIEW" : "ACTIVE";
    run(db, `INSERT INTO domains (study_id, standard, code, name, description, structure, cls, version, status, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
      S, std, code, m.name, `${m.name} domain for VX-201.`, m.structure, m.cls, "1.1", st,
      "2026-01-30T09:00:00.000Z", "S. Iyer — Data Standards Lead", st === "IN REVIEW" ? "ADC spec refresh pending review cycle 2026-Q1." : "Define publication v1.0",
    ]);
  }

  /* version history snapshots */
  run(db, `INSERT INTO variable_versions (var_id, version, label, type, length, role, origin, derivation, codelist, status, change_reason, created_by, created_at)
    SELECT id, '0.9', label, type, length, role, origin, derivation, codelist, 'ACTIVE', 'SDTM define v1.0 publication', 'S. Iyer — Data Standards Lead', '2025-12-01T09:00:00.000Z'
    FROM variables WHERE study_id='VX-201' AND domain='CM' AND name='CMTRT' LIMIT 1`);
  run(db, `INSERT INTO variable_versions (var_id, version, label, type, length, role, origin, derivation, codelist, status, change_reason, created_by, created_at)
    SELECT id, '1.0', label, type, length, role, origin, derivation, codelist, 'ACTIVE', 'ADaM define v1.0 publication', 'M. Okafor — MDR Admin', '2026-01-05T09:00:00.000Z'
    FROM variables WHERE study_id='VX-201' AND name='TRTEMFL' LIMIT 1`);
  run(db, `INSERT INTO variable_versions (var_id, version, label, type, length, role, origin, derivation, codelist, status, change_reason, created_by, created_at)
    SELECT id, '1.1', label, type, length, role, origin, derivation, codelist, 'ACTIVE', 'Label clarified per review 2026-01', 'J. Lindqvist — Biostatistics', '2026-01-22T12:00:00.000Z'
    FROM variables WHERE study_id='VX-201' AND name='TRTEMFL' LIMIT 1`);

  /* releases */
  const rel = (study: string, ver: string, type: string, at: string, by: string, appr: string, notes: string, status: string, a: number, c: number, d: number) =>
    run(db, `INSERT INTO releases (study_id, version, type, released_at, released_by, approved_by, notes, status, added, changed, deprecated) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [study, ver, type, at, by, appr, notes, status, a, c, d]);
  rel(S, "0.9", "MDR Baseline", "2025-12-01T09:00:00.000Z", "S. Iyer — Data Standards Lead", "M. Okafor — MDR Admin", "Initial metadata import from mapping specifications.", "RELEASED", 115, 0, 0);
  rel(S, "1.0", "SDTM define.xml", "2026-01-12T14:22:00.000Z", "S. Iyer — Data Standards Lead", "M. Okafor — MDR Admin", "SDTM define v1.0 for database lock — Pinnacle 21 clean.", "RELEASED", 4, 11, 1);
  rel(S, "1.0", "ADaM define.xml", "2026-02-02T09:41:00.000Z", "A. Moreau — Statistical Programming", "J. Lindqvist — Biostatistics", "ADaM define v1.0 with BDS/OCCDS traceability.", "RELEASED", 6, 3, 0);
  rel(S, "2.1", "CRF Specification", "2025-11-10T08:00:00.000Z", "R. Tanaka — Clinical Data Mgmt", "M. Okafor — MDR Admin", "eCRF v2.1 — added exposure log and lab significance flag.", "RELEASED", 2, 1, 0);
  rel(S, "1.1", "MDR Snapshot", "", "M. Okafor — MDR Admin", "", "Q1 review cycle — BMIBL and ONTRTFL in progress.", "DRAFT", 2, 5, 0);
  rel(S2, "0.5", "MDR Baseline", "2026-01-28T13:00:00.000Z", "R. Tanaka — Clinical Data Mgmt", "M. Okafor — MDR Admin", "VX-104 onboarded to master MDR.", "RELEASED", 37, 0, 0);

  /* seeded audit trail */
  const aud = (ts: string, actor: string, action: string, entity: string, record: string, field: string, ov: string, nv: string, reason: string, study: string) =>
    run(db, `INSERT INTO audit_trail (ts, actor, action, entity, record, field, old_value, new_value, reason, study_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ts, actor, action, entity, record, field, ov, nv, reason, study]);
  aud("2025-12-01T09:02:11.000Z", "S. Iyer — Data Standards Lead", "CREATE", "variables", "VX-201 · 115 records", "—", "", "DRAFT", "Initial metadata import from mapping specifications", S);
  aud("2025-12-18T10:12:44.000Z", "M. Okafor — MDR Admin", "IMPORT", "ct_codelists", "13 codelists · 46 terms", "—", "", "ACTIVE", "NCI/CDISC CT 2023-12-15 synchronisation", "GLOBAL");
  aud("2026-01-12T14:22:30.000Z", "S. Iyer — Data Standards Lead", "TRANSITION", "variables", "SDTM.AESEV", "status", "IN REVIEW", "ACTIVE", "SDTM define v1.0 publication", S);
  aud("2026-01-20T11:05:52.000Z", "S. Iyer — Data Standards Lead", "TRANSITION", "variables", "SDTM.CMINDC", "status", "ACTIVE", "DEPRECATED", "Variable removed from SDTM IG in v3.3", S);
  aud("2026-01-28T13:01:07.000Z", "R. Tanaka — Clinical Data Mgmt", "CREATE", "studies", "VX-104", "—", "", "ACTIVE", "VX-104 onboarded to master MDR", S2);
  aud("2026-02-02T09:41:18.000Z", "A. Moreau — Statistical Programming", "EXPORT", "releases", "ADaM define.xml v1.0", "—", "", "file", "define.xml generated for submission package", S);
  aud("2026-02-09T16:30:29.000Z", "J. Lindqvist — Biostatistics", "CREATE", "variables", "ADSL.BMIBL", "—", "", "DRAFT", "New efficacy covariate requested in SAP v0.3", S);
  aud("2026-02-11T10:15:41.000Z", "A. Moreau — Statistical Programming", "TRANSITION", "variables", "ADVS.ONTRTFL", "status", "DRAFT", "IN REVIEW", "SAP v0.4 on-treatment summaries", S);
  aud("2026-02-13T08:44:03.000Z", "M. Okafor — MDR Admin", "UPDATE", "domains", "ADaM.ADCM", "change_reason", "Define publication v1.0", "ADC spec refresh pending review cycle 2026-Q1", "Q1 review cycle", S);
  aud("2026-02-15T17:02:56.000Z", "S. Iyer — Data Standards Lead", "UPDATE", "ct_terms", "OUT · UNKNOWN", "definition", "—", "Outcome not yet known at time of reporting.", "Definition clarified for define.xml", "GLOBAL");
}
