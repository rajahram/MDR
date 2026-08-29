import initSqlJs from "sql.js";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const STORAGE_KEY = "trace-mdr-master:db:v1";

let sqlPromise: Promise<SqlJsStatic> | null = null;

export function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlPromise;
}

/* ── base64 ↔ bytes (chunked to stay stack-safe) ──────────────── */
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x2000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function persistDb(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, bytesToB64(db.export()));
  } catch (err) {
    // localStorage quota / private mode — keep the session alive in memory
    console.warn("MDR persist skipped:", err);
  }
}

export function restoreDb(SQL: SqlJsStatic): Database | null {
  try {
    const b64 = localStorage.getItem(STORAGE_KEY);
    if (!b64) return null;
    return new SQL.Database(b64ToBytes(b64));
  } catch {
    return null;
  }
}

export function clearStoredDb(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/* ── query helpers ─────────────────────────────────────────────── */
export function all<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as unknown as T);
  stmt.free();
  return out;
}

export function get<T>(db: Database, sql: string, params: SqlValue[] = []): T | undefined {
  const rows = all<T>(db, sql, params);
  return rows[0];
}

export function run(db: Database, sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
}

export function count(db: Database, sql: string, params: SqlValue[] = []): number {
  const row = get<Record<string, number>>(db, sql, params);
  if (!row) return 0;
  const k = Object.keys(row)[0];
  return Number(row[k] ?? 0);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const ACTORS = [
  "M. Okafor — MDR Admin",
  "S. Iyer — Data Standards Lead",
  "J. Lindqvist — Biostatistics",
  "R. Tanaka — Clinical Data Mgmt",
  "A. Moreau — Statistical Programming",
];
