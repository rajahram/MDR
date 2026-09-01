import type { Database } from "sql.js";
import { run } from "./sqlite";
import { seedAdamVars, seedCrfFields, seedSdtmVars, seedTfls } from "../data/seed";
import cdiscSeed from "../data/cdisc-seed-optimized.json";

export const DDL = `
CREATE TABLE IF NOT EXISTS studies (
  study_id TEXT PRIMARY KEY, study_name TEXT, protocol TEXT, phase TEXT, ta TEXT,
  crf_name TEXT, crf_version TEXT, sdtm_ig TEXT, adam_ig TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT, study_id TEXT, standard TEXT, code TEXT, name TEXT,
  description TEXT, structure TEXT, cls TEXT, purpose TEXT, key_variables TEXT,
  version TEXT, status TEXT, updated_at TEXT, updated_by TEXT, change_reason TEXT
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
  version TEXT, version_date TEXT, extensible TEXT, status TEXT, updated_at TEXT
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

const PAGE_META: Record<string, { name: string; form: string; repeating: string }> = {
  DM: { name: "Demographics", form: "Subject Form", repeating: "No" },
  VS: { name: "Vital Signs", form: "Visit Form", repeating: "No" },
  AE: { name: "Adverse Events", form: "Log Form", repeating: "Yes" },
  CM: { name: "Concomitant Medications", form: "Log Form", repeating: "Yes" },
  LB: { name: "Local Laboratory", form: "Visit Form", repeating: "No" },
  EX: { name: "Exposure / Dosing", form: "Visit Form", repeating: "Yes" },
  PK: { name: "Pharmacokinetics Sampling", form: "Log Form", repeating: "Yes" },
};

export function seedDatabase(db: Database): void {
  db.run(DDL);
  db.run("BEGIN TRANSACTION;");

  const S = "GLOBAL";

  /* single global repository record — holds the CRF library identity and IG references */
  run(db, `INSERT INTO studies VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
    S, "Global Master MDR", "", "", "",
    "Master eCRF Library", "v2.1", "SDTM IG 3.4 (FDA)", "ADaM IG 1.3 (FDA)", "ACTIVE", "2026-03-27T09:00:00.000Z",
  ]);

  /* 1. DOMAINS FROM CDISC XML */
  const domStmt = db.prepare(`INSERT INTO domains (study_id, standard, code, name, description, structure, cls, purpose, key_variables, version, status, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const d of cdiscSeed.domains) {
    domStmt.run([
      S, d.standard, d.code, d.name, d.description, d.structure, d.cls,
      d.purpose || (d.standard === "SDTM" ? "Tabulation" : "Analysis"),
      d.key_variables || "STUDYID, USUBJID",
      d.version || "1.0", d.status || "ACTIVE",
      d.updated_at || "2026-03-27T00:00:00.000Z",
      d.updated_by || "CDISC Standards Lead",
      d.change_reason || "Imported from XML"
    ]);
  }
  domStmt.free();

  /* 2. VARIABLES FROM CDISC XML */
  const varStmt = db.prepare(`INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const v of cdiscSeed.variables) {
    varStmt.run([
      S, v.standard, v.domain, v.name, v.label, v.type, v.length, v.format || "",
      v.role || "QUALIFIER", v.origin || "CRF", v.derivation || "", v.codelist || null,
      v.key_seq || null, v.core || "Exp", v.version || "1.0", v.status || "ACTIVE",
      v.effective_from || "2026-03-27T00:00:00.000Z",
      v.updated_at || "2026-03-27T00:00:00.000Z",
      v.updated_by || "CDISC Standards Lead",
      v.change_reason || "CDISC IG Release"
    ]);
  }
  varStmt.free();

  /* 3. CONTROLLED TERMINOLOGY FROM CDISC XML */
  const clStmt = db.prepare(`INSERT OR REPLACE INTO ct_codelists VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const c of cdiscSeed.codelists) {
    clStmt.run([
      c.code, c.name, c.type, c.description, c.nci_code, c.source,
      c.version || "2026-03-27", c.version_date || "2026-03-27",
      c.extensible || "No", c.status || "ACTIVE",
      c.updated_at || "2026-03-27T00:00:00.000Z"
    ]);
  }
  clStmt.free();

  const termStmt = db.prepare(`INSERT INTO ct_terms (codelist, order_number, submission_value, display_value, definition, nci_code, status, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const t of cdiscSeed.terms) {
    termStmt.run([
      t.codelist, t.order_number, t.submission_value, t.display_value,
      t.definition, t.nci_code, t.status || "ACTIVE",
      t.created_at || "2026-03-27T00:00:00.000Z"
    ]);
  }
  termStmt.free();

  /* 4. VALUE-LEVEL METADATA (VLM) FROM CDISC XML */
  const vlmStmt = db.prepare(`INSERT INTO vlm (study_id, standard, domain, when_clause, where_clause, name, label, type, length, origin, codelist, method, version, status, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const vm of cdiscSeed.vlm) {
    vlmStmt.run([
      S, vm.standard, vm.domain, vm.when_clause, vm.where_clause, vm.name,
      vm.label, vm.type, vm.length, vm.origin, vm.codelist, vm.method,
      vm.version || "1.0", vm.status || "ACTIVE",
      vm.updated_at || "2026-03-27T00:00:00.000Z"
    ]);
  }
  vlmStmt.free();

  /* 5. MASTER CRF LIBRARY FOR TRACEABILITY */
  const crfName = "Master eCRF Library";
  for (const f of seedCrfFields) {
    const pid = `${S}:${f.pageCode}`;
    if (!db.exec(`SELECT 1 FROM crf_pages WHERE page_id='${pid}'`).length) {
      const m = PAGE_META[f.pageCode] ?? { name: f.page, form: "Visit Form", repeating: "No" };
      run(db, `INSERT INTO crf_pages VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        pid, S, crfName, "v2.1", f.pageCode, m.name, m.form, m.repeating, "ACTIVE", "2026-01-10T08:00:00.000Z",
      ]);
    }
    run(db, `INSERT INTO crf_fields VALUES (?,?,?,?,?,?,?,?,?)`, [
      f.id, S, pid, f.label, f.dataType, f.required ? 1 : 0, f.codelist ?? null, "ACTIVE", "2.1",
    ]);
  }

  /* 6. TRACEABILITY MAPPINGS (CRF -> SDTM & SDTM -> ADaM) */
  const seenC2S = new Set<string>();
  for (const v of seedSdtmVars) {
    for (const cfid of v.crfFieldIds) {
      const key = `${cfid}>${v.id}`;
      if (!seenC2S.has(key)) {
        seenC2S.add(key);
        run(db, `INSERT INTO map_c2s (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S, cfid, v.id, "EDC extract → SAS mapping spec"]);
      }
    }
  }

  const seenS2A = new Set<string>();
  for (const v of seedAdamVars) {
    for (const sid of v.sdtmVarIds) {
      const key = `${sid}>${v.id}`;
      if (!seenS2A.has(key)) {
        seenS2A.add(key);
        run(db, `INSERT INTO map_s2a (study_id, src, tgt, method) VALUES (?,?,?,?)`, [S, sid, v.id, v.derivation ?? "Direct copy from SDTM"]);
      }
    }
  }

  /* 7. TFL SPECIFICATIONS */
  for (const t of seedTfls) {
    run(db, `INSERT INTO tfls VALUES (?,?,?,?,?,?,?)`, [t.code, S, t.kind, t.title, t.adamVarIds.join("|"), "ACTIVE", "1.0"]);
  }

  /* 8. DISPOSITIONS */
  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["DM.SCRFAIL", S, "Operational field — screen failure management only, not part of the submission data model."]);
  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["AE.AEINIT", S, "Personally identifiable information — redacted prior to SDTM conversion."]);
  run(db, `INSERT INTO dispositions VALUES (?,?,?)`, ["CM.CMINDC", S, "CMINDC deprecated in SDTM v3.3 — indication no longer has a submission home."]);

  /* 9. RELEASES */
  const rel = (study: string, ver: string, type: string, at: string, by: string, appr: string, notes: string, status: string, a: number, c: number, d: number) =>
    run(db, `INSERT INTO releases (study_id, version, type, released_at, released_by, approved_by, notes, status, added, changed, deprecated) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [study, ver, type, at, by, appr, notes, status, a, c, d]);
  rel(S, "2.3", "CDASHIG v2.3", "2026-03-27T00:00:00.000Z", "CDISC CDASH Team", "MDR Admin", "CDISC Clinical Data Acquisition Standards Harmonization (CDASH) v2.3 data collection standards.", "RELEASED", 42, 0, 0);
  rel(S, "2026-03-27", "CDASH Controlled Terminology", "2026-03-27T00:00:00.000Z", "CDISC NCI EVS", "MDR Admin", "CDASH Controlled Terminology quarterly release (22 codelists, 354 terms).", "RELEASED", 22, 0, 0);
  rel(S, "2026-03-27", "CDISC SDTM/ADaM Terminology", "2026-03-27T00:00:00.000Z", "CDISC NCI EVS", "MDR Admin", "Quarterly CDISC Controlled Terminology synchronization (SDTM & ADaM).", "RELEASED", 124, 0, 0);
  rel(S, "3.4", "SDTM-IG 3.4 (FDA)", "2026-01-21T14:43:21.000Z", "Pinnacle 21 Community", "CDISC Standards Lead", "FDA SDTM-IG 3.4 compliance validator configuration baseline.", "RELEASED", 131, 0, 0);
  rel(S, "1.3", "ADaM-IG 1.3 (FDA)", "2026-01-21T14:43:21.000Z", "Pinnacle 21 Community", "Statistical Programming", "FDA ADaM-IG 1.3 dataset specifications with BDS/OCCDS structures.", "RELEASED", 14, 0, 0);
  rel(S, "2.1", "Master eCRF Library", "2025-11-10T08:00:00.000Z", "Clinical Data Mgmt", "MDR Admin", "Master CRF Library specification for EDC annotation.", "RELEASED", 42, 2, 0);

  /* 10. INITIAL AUDIT TRAIL */
  const aud = (ts: string, actor: string, action: string, entity: string, record: string, field: string, ov: string, nv: string, reason: string, study: string) =>
    run(db, `INSERT INTO audit_trail (ts, actor, action, entity, record, field, old_value, new_value, reason, study_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ts, actor, action, entity, record, field, ov, nv, reason, study]);
  aud("2026-03-27T09:00:00.000Z", "CDISC Standards Lead", "IMPORT", "domains", `${cdiscSeed.domains.length} Domains (42 CDASH + 131 SDTM + 14 ADaM)`, "—", "", "ACTIVE", "Imported from CDASHIG v2.3, SDTM-IG 3.4 & ADaM-IG 1.3", S);
  aud("2026-03-27T09:00:00.000Z", "CDISC Standards Lead", "IMPORT", "variables", `${cdiscSeed.variables.length} Variables`, "—", "", "ACTIVE", "Imported from CDASHIG v2.3, SDTM-IG 3.4 & ADaM-IG 1.3", S);
  aud("2026-03-27T09:00:00.000Z", "CDISC Standards Lead", "IMPORT", "ct_codelists", `${cdiscSeed.codelists.length} Codelists · ${cdiscSeed.terms.length} Terms`, "—", "", "ACTIVE", "Synchronized with CDASH & CDISC Controlled Terminology 2026-03-27", S);
  aud("2026-03-27T09:00:00.000Z", "CDISC Standards Lead", "IMPORT", "vlm", `${cdiscSeed.vlm.length} Value-Level Overrides`, "—", "", "ACTIVE", "Imported from SDTM-IG 3.4 & ADaM-IG 1.3 ValueListDef", S);

  db.run("COMMIT;");
}
