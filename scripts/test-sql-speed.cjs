const initSqlJs = require('sql.js');
const fs = require('fs');

async function testSpeed() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const data = JSON.parse(fs.readFileSync('src/data/cdisc-seed-optimized.json', 'utf8'));

  console.time('seedTransaction');
  db.run("BEGIN TRANSACTION;");

  db.run(`
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
  `);

  const domStmt = db.prepare(`INSERT INTO domains (study_id, standard, code, name, description, structure, cls, purpose, key_variables, version, status, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const d of data.domains) {
    domStmt.run(['GLOBAL', d.standard, d.code, d.name, d.description, d.structure, d.cls, d.purpose, d.key_variables, d.version, d.status, d.updated_at, d.updated_by, d.change_reason]);
  }
  domStmt.free();

  const varStmt = db.prepare(`INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const v of data.variables) {
    varStmt.run(['GLOBAL', v.standard, v.domain, v.name, v.label, v.type, v.length, v.format, v.role, v.origin, v.derivation, v.codelist, v.key_seq, v.core, v.version, v.status, v.effective_from, v.updated_at, v.updated_by, v.change_reason]);
  }
  varStmt.free();

  const clStmt = db.prepare(`INSERT OR REPLACE INTO ct_codelists VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const c of data.codelists) {
    clStmt.run([c.code, c.name, c.type, c.description, c.nci_code, c.source, c.version, c.version_date, c.extensible, c.status, c.updated_at]);
  }
  clStmt.free();

  const termStmt = db.prepare(`INSERT INTO ct_terms (codelist, order_number, submission_value, display_value, definition, nci_code, status, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const t of data.terms) {
    termStmt.run([t.codelist, t.order_number, t.submission_value, t.display_value, t.definition, t.nci_code, t.status, t.created_at]);
  }
  termStmt.free();

  const vlmStmt = db.prepare(`INSERT INTO vlm (study_id, standard, domain, when_clause, where_clause, name, label, type, length, origin, codelist, method, version, status, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const vm of data.vlm) {
    vlmStmt.run(['GLOBAL', vm.standard, vm.domain, vm.when_clause, vm.where_clause, vm.name, vm.label, vm.type, vm.length, vm.origin, vm.codelist, vm.method, vm.version, vm.status, vm.updated_at]);
  }
  vlmStmt.free();

  db.run("COMMIT;");
  console.timeEnd('seedTransaction');

  const domCount = db.exec("SELECT COUNT(*) AS c FROM domains")[0].values[0][0];
  const varCount = db.exec("SELECT COUNT(*) AS c FROM variables")[0].values[0][0];
  const clCount = db.exec("SELECT COUNT(*) AS c FROM ct_codelists")[0].values[0][0];
  const termCount = db.exec("SELECT COUNT(*) AS c FROM ct_terms")[0].values[0][0];
  const vlmCount = db.exec("SELECT COUNT(*) AS c FROM vlm")[0].values[0][0];

  console.log(`Inserted successfully:`);
  console.log(`- Domains: ${domCount}`);
  console.log(`- Variables: ${varCount}`);
  console.log(`- Codelists: ${clCount}`);
  console.log(`- Terms: ${termCount}`);
  console.log(`- VLM: ${vlmCount}`);
}

testSpeed();
