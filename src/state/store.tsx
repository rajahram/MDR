import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Database } from "sql.js";
import type {
  AdamVar, CrfField, CrfFieldRow, CrfGap, MdrState, Selection, SdtmVar, Status, Tfl, VariableRow,
} from "../data/types";
import { STATUS_FLOW } from "../data/types";
import { ACTORS, all, clearStoredDb, get, loadSql, nowIso, persistDb, restoreDb, run } from "../db/sqlite";
import { seedDatabase } from "../db/schema";

export type ViewKey =
  | "dashboard" | "explorer" | "matrix" | "gaps"
  | "domains" | "variables" | "terminology" | "vlm" | "crf"
  | "versions" | "audit";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info" | "warn";
  text: string;
}

interface AuditInput {
  action: string;
  entity: string;
  record: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  study_id?: string;
}

interface StoreValue {
  ready: boolean;
  db: Database | null;
  v: number;
  state: MdrState;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  selection: Selection | null;
  select: (sel: Selection | null, goExplorer?: boolean) => void;
  study: string;
  setStudy: (s: string) => void;
  studies: { study_id: string; study_name: string }[];
  actor: string;
  setActor: (a: string) => void;
  toasts: ToastItem[];
  toast: (kind: ToastItem["kind"], msg: string) => void;
  dismissToast: (id: number) => void;
  mutate: (fn: (db: Database) => void, audit?: AuditInput) => void;
  transitionStatus: (table: "variables" | "domains" | "ct_terms" | "crf_pages", id: number | string, idCol: string, to: Status, reason: string) => void;
  bumpVersion: (varId: number, reason: string) => void;
  createVariable: (row: { study_id: string; standard: string; domain: string; name: string; label: string; type: string; length: number; role: string; origin: string; derivation: string; codelist: string | null }, reason: string) => void;
  resetDb: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

/* ── build the trace model from SQLite ────────────────────────── */
function buildModel(db: Database, studyId: string): MdrState {
  const pages = all<{ page_id: string; page_code: string; page_name: string }>(
    db, "SELECT page_id, page_code, page_name FROM crf_pages WHERE study_id=?", [studyId]);
  const pageMap = new Map(pages.map((p) => [p.page_id, p]));

  const fields = all<CrfFieldRow>(db, "SELECT oid, page_id, label, data_type, required, codelist, status FROM crf_fields WHERE study_id=? ORDER BY oid", [studyId]);
  const crfFields: CrfField[] = fields.map((f) => {
    const p = pageMap.get(f.page_id);
    return {
      id: f.oid,
      pageCode: p?.page_code ?? f.page_id,
      page: p?.page_name ?? f.page_id,
      label: f.label,
      dataType: (f.data_type as CrfField["dataType"]) ?? "text",
      required: Number(f.required) === 1,
      codelist: f.codelist ?? undefined,
      status: f.status as Status,
    };
  });

  const c2s = all<{ src: string; tgt: string }>(db, "SELECT src, tgt FROM map_c2s WHERE study_id=?", [studyId]);
  const crfBySdtm = new Map<string, string[]>();
  for (const m of c2s) {
    if (!crfBySdtm.has(m.tgt)) crfBySdtm.set(m.tgt, []);
    crfBySdtm.get(m.tgt)!.push(m.src);
  }

  const sdtmRows = all<VariableRow>(db, "SELECT * FROM variables WHERE study_id=? AND standard='SDTM' ORDER BY domain, name", [studyId]);
  const sdtmVars: SdtmVar[] = sdtmRows.map((r) => ({
    id: `${r.domain}.${r.name}`,
    domain: r.domain,
    name: r.name,
    label: r.label,
    role: r.role || "QUALIFIER",
    type: r.type,
    length: Number(r.length),
    origin: r.origin,
    crfFieldIds: crfBySdtm.get(`${r.domain}.${r.name}`) ?? [],
    derivation: r.derivation || undefined,
    codelist: r.codelist ?? undefined,
    status: r.status as Status,
  }));

  const s2a = all<{ src: string; tgt: string }>(db, "SELECT src, tgt FROM map_s2a WHERE study_id=?", [studyId]);
  const sdtmByAdam = new Map<string, string[]>();
  for (const m of s2a) {
    if (!sdtmByAdam.has(m.tgt)) sdtmByAdam.set(m.tgt, []);
    sdtmByAdam.get(m.tgt)!.push(m.src);
  }

  const adamStruct = new Map(
    all<{ code: string; structure: string }>(db, "SELECT code, structure FROM domains WHERE study_id=? AND standard='ADaM'", [studyId])
      .map((d) => [d.code, d.structure.includes("BDS") ? "BDS" : d.structure.includes("OCCDS") ? "OCCDS" : d.code === "ADSL" ? "ADSL" : "ADaM"]),
  );

  const adamRows = all<VariableRow>(db, "SELECT * FROM variables WHERE study_id=? AND standard='ADaM' ORDER BY domain, name", [studyId]);
  const adamVars: AdamVar[] = adamRows.map((r) => ({
    id: `${r.domain}.${r.name}`,
    dataset: r.domain,
    name: r.name,
    label: r.label,
    type: r.type,
    length: Number(r.length),
    origin: r.origin,
    model: adamStruct.get(r.domain) ?? "ADaM",
    sdtmVarIds: sdtmByAdam.get(`${r.domain}.${r.name}`) ?? [],
    derivation: r.derivation || undefined,
    status: r.status as Status,
  }));

  const tflRows = all<{ code: string; kind: string; title: string; adam_vars: string }>(
    db, "SELECT code, kind, title, adam_vars FROM tfls WHERE study_id=? ORDER BY code", [studyId]);
  const tfls: Tfl[] = tflRows.map((t) => ({
    id: t.code,
    code: t.code,
    kind: (t.kind as Tfl["kind"]) ?? "Table",
    title: t.title,
    adamVarIds: t.adam_vars ? t.adam_vars.split("|") : [],
  }));

  const crfGaps: CrfGap[] = all<{ crf_oid: string; reason: string }>(
    db, "SELECT crf_oid, reason FROM dispositions WHERE study_id=?", [studyId],
  ).map((d) => ({ crfFieldId: d.crf_oid, reason: d.reason }));

  return { crfFields, sdtmVars, adamVars, tfls, crfGaps };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [v, setV] = useState(0);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [study, setStudyState] = useState<string>(() => localStorage.getItem("trace-mdr:study") ?? "VX-201");
  const [actor, setActorState] = useState<string>(() => localStorage.getItem("trace-mdr:actor") ?? ACTORS[0]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const boot = useCallback(async (fresh = false) => {
    const SQL = await loadSql();
    let next: Database | null = null;
    if (!fresh) next = restoreDb(SQL);
    if (!next) {
      next = new SQL.Database();
      seedDatabase(next);
      persistDb(next);
    }
    setDb(next);
    setV((x) => x + 1);
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const toast = useCallback((kind: ToastItem["kind"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text: msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const audit = useCallback((d: Database, entry: AuditInput, actorName: string) => {
    run(d, `INSERT INTO audit_trail (ts, actor, action, entity, record, field, old_value, new_value, reason, study_id) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      nowIso(), actorName, entry.action, entry.entity, entry.record, entry.field ?? "—",
      entry.old_value ?? "", entry.new_value ?? "", entry.reason ?? "", entry.study_id ?? "GLOBAL",
    ]);
  }, []);

  const mutate = useCallback((fn: (d: Database) => void, entry?: AuditInput) => {
    setDb((cur) => {
      if (!cur) return cur;
      fn(cur);
      if (entry) audit(cur, entry, actor);
      persistDb(cur);
      return cur;
    });
    setV((x) => x + 1);
  }, [actor, audit]);

  const transitionStatus = useCallback((table: "variables" | "domains" | "ct_terms" | "crf_pages", id: number | string, idCol: string, to: Status, reason: string) => {
    if (!db) return;
    const row = get<Record<string, string>>(db, `SELECT * FROM ${table} WHERE ${idCol}=?`, [id]);
    const from = (row?.status as string) ?? "?";
    const allowed = STATUS_FLOW[from as Status] ?? [];
    if (!allowed.includes(to)) {
      toast("error", `GxP gate: ${from} → ${to} is not a permitted transition.`);
      return;
    }
    const label = table === "variables" ? `${row?.domain ?? ""}.${row?.name ?? id}` : String(row?.code ?? row?.oid ?? id);
    mutate((d) => {
      if (table === "variables" || table === "domains") {
        run(d, `UPDATE ${table} SET status=?, updated_at=?, updated_by=?, change_reason=? WHERE ${idCol}=?`, [to, nowIso(), actor, reason, id]);
        if (table === "variables" && row) {
          run(d, `INSERT INTO variable_versions (var_id, version, label, type, length, role, origin, derivation, codelist, status, change_reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            Number(id), String(row.version ?? ""), String(row.label ?? ""), String(row.type ?? ""), Number(row.length ?? 0),
            String(row.role ?? ""), String(row.origin ?? ""), String(row.derivation ?? ""), (row.codelist as string | null) ?? null,
            to, reason, actor, nowIso(),
          ]);
        }
      } else {
        run(d, `UPDATE ${table} SET status=? WHERE ${idCol}=?`, [to, id]);
      }
    }, { action: "TRANSITION", entity: table, record: label, field: "status", old_value: from, new_value: to, reason, study_id: (row?.study_id as string) ?? "GLOBAL" });
    toast("success", `${label}: ${from} → ${to} recorded in audit trail.`);
  }, [db, mutate, actor, toast]);

  const bumpVersion = useCallback((varId: number, reason: string) => {
    if (!db) return;
    const row = get<VariableRow & { codelist: string | null }>(db, "SELECT * FROM variables WHERE id=?", [varId]);
    if (!row) return;
    const parts = String(row.version || "1.0").split(".");
    const next = `${parts[0] ?? "1"}.${Number(parts[1] ?? 0) + 1}`;
    mutate((d) => {
      run(d, `UPDATE variables SET version=?, updated_at=?, updated_by=?, change_reason=? WHERE id=?`, [next, nowIso(), actor, reason, varId]);
      run(d, `INSERT INTO variable_versions (var_id, version, label, type, length, role, origin, derivation, codelist, status, change_reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        varId, next, row.label, row.type, Number(row.length), row.role ?? "", row.origin, row.derivation ?? "", row.codelist, row.status, reason, actor, nowIso(),
      ]);
    }, { action: "VERSION", entity: "variables", record: `${row.domain}.${row.name}`, field: "version", old_value: String(row.version), new_value: next, reason, study_id: row.study_id });
    toast("success", `${row.domain}.${row.name} versioned to v${next}.`);
  }, [db, mutate, actor, toast]);

  const createVariable = useCallback((row: Parameters<StoreValue["createVariable"]>[0], reason: string) => {
    mutate((d) => {
      run(d, `INSERT INTO variables (study_id, standard, domain, name, label, type, length, format, role, origin, derivation, codelist, key_seq, core, version, status, effective_from, updated_at, updated_by, change_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        row.study_id, row.standard, row.domain, row.name, row.label, row.type, row.length, "", row.role, row.origin,
        row.derivation, row.codelist, null, "Exp", "1.0", "DRAFT", "", nowIso(), actor, reason,
      ]);
    }, { action: "CREATE", entity: "variables", record: `${row.domain}.${row.name}`, field: "—", old_value: "", new_value: "DRAFT v1.0", reason, study_id: row.study_id });
    toast("success", `${row.domain}.${row.name} created as DRAFT v1.0.`);
  }, [mutate, actor, toast]);

  const resetDb = useCallback(() => {
    clearStoredDb();
    localStorage.removeItem("trace-mdr:study");
    setDb(null);
    void boot(true);
    toast("info", "Master MDR re-seeded to the validated baseline.");
  }, [boot, toast]);

  const select = useCallback((sel: Selection | null, goExplorer = false) => {
    setSelection(sel);
    if (sel && goExplorer) setView("explorer");
  }, []);

  const setStudy = useCallback((s: string) => {
    setStudyState(s);
    localStorage.setItem("trace-mdr:study", s);
    setSelection(null);
  }, []);

  const setActor = useCallback((a: string) => {
    setActorState(a);
    localStorage.setItem("trace-mdr:actor", a);
  }, []);

  const state = useMemo<MdrState>(
    () => (db ? buildModel(db, study) : { crfFields: [], sdtmVars: [], adamVars: [], tfls: [], crfGaps: [] }),
    [db, v, study],
  );

  const studies = useMemo(
    () => (db ? all<{ study_id: string; study_name: string }>(db, "SELECT study_id, study_name FROM studies ORDER BY study_id") : []),
    [db, v],
  );

  const value: StoreValue = {
    ready: !!db, db, v, state, view, setView, selection, select,
    study, setStudy, studies, actor, setActor, toasts, toast, dismissToast,
    mutate, transitionStatus, bumpVersion, createVariable, resetDb,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
