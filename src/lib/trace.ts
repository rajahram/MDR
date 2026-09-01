import type {
  AdamVar,
  CrfField,
  LayerKey,
  MdrState,
  Selection,
  SdtmVar,
  Tfl,
} from "../data/types";

export interface TraceRow {
  key: string;
  crf?: CrfField;
  sdtm?: SdtmVar;
  adam?: AdamVar;
  tfls: Tfl[];
  gap?: "CRF_NOT_MAPPED" | "SDTM_NOT_IN_ADAM" | "ADAM_NO_TFL";
}

export const LAYER_META: Record<
  LayerKey,
  { name: string; short: string; color: string; desc: string }
> = {
  crf: { name: "CRF", short: "CRF", color: "#9a5a02", desc: "Source pages & fields (ODM OIDs)" },
  sdtm: { name: "SDTM", short: "SDTM", color: "#057a66", desc: "Submission tabulations (CDISC)" },
  adam: { name: "ADaM", short: "ADaM", color: "#b83814", desc: "Analysis datasets (traceable)" },
  tfl: { name: "TFL", short: "TFL", color: "#2152b0", desc: "Tables, Figures & Listings" },
};

/* ---------- index helpers (O(1) cached hash maps) ---------- */
const indicesCache = new WeakMap<MdrState, {
  crfMap: Map<string, CrfField>;
  sdtmMap: Map<string, SdtmVar>;
  adamMap: Map<string, AdamVar>;
  tflMap: Map<string, Tfl>;
  sdtmByCrf: Map<string, SdtmVar[]>;
  adamBySdtm: Map<string, AdamVar[]>;
  tflByAdam: Map<string, Tfl[]>;
}>();

export function getTraceIndices(s: MdrState) {
  let idx = indicesCache.get(s);
  if (idx) return idx;

  const crfMap = new Map(s.crfFields.map((f) => [f.id, f]));
  const sdtmMap = new Map(s.sdtmVars.map((v) => [v.id, v]));
  const adamMap = new Map(s.adamVars.map((v) => [v.id, v]));
  const tflMap = new Map(s.tfls.map((t) => [t.id, t]));

  const sdtmByCrf = new Map<string, SdtmVar[]>();
  for (const v of s.sdtmVars) {
    for (const cid of v.crfFieldIds) {
      let arr = sdtmByCrf.get(cid);
      if (!arr) { arr = []; sdtmByCrf.set(cid, arr); }
      arr.push(v);
    }
  }

  const adamBySdtm = new Map<string, AdamVar[]>();
  for (const a of s.adamVars) {
    for (const sid of a.sdtmVarIds) {
      let arr = adamBySdtm.get(sid);
      if (!arr) { arr = []; adamBySdtm.set(sid, arr); }
      arr.push(a);
    }
  }

  const tflByAdam = new Map<string, Tfl[]>();
  for (const t of s.tfls) {
    for (const aid of t.adamVarIds) {
      let arr = tflByAdam.get(aid);
      if (!arr) { arr = []; tflByAdam.set(aid, arr); }
      arr.push(t);
    }
  }

  idx = { crfMap, sdtmMap, adamMap, tflMap, sdtmByCrf, adamBySdtm, tflByAdam };
  indicesCache.set(s, idx);
  return idx;
}

export const crfById = (s: MdrState) => getTraceIndices(s).crfMap;
export const sdtmById = (s: MdrState) => getTraceIndices(s).sdtmMap;
export const adamById = (s: MdrState) => getTraceIndices(s).adamMap;

/** ADaM variable ids consuming a given SDTM variable (O(1) lookup) */
export function adamConsumers(state: MdrState, sdtmId: string): AdamVar[] {
  return getTraceIndices(state).adamBySdtm.get(sdtmId) ?? [];
}

/** TFLs referencing a given ADaM variable (O(1) lookup) */
export function tflConsumers(state: MdrState, adamId: string): Tfl[] {
  return getTraceIndices(state).tflByAdam.get(adamId) ?? [];
}

/** SDTM variables sourced from a given CRF field (O(1) lookup) */
export function sdtmTargets(state: MdrState, crfId: string): SdtmVar[] {
  return getTraceIndices(state).sdtmByCrf.get(crfId) ?? [];
}

export function grouped<T>(items: T[], keyOf: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return [...m.entries()];
}

/* ---------- linked-set resolution (O(1) step lookup) ---------- */
export interface LinkedSets {
  crf: Set<string>;
  sdtm: Set<string>;
  adam: Set<string>;
  tfl: Set<string>;
}

/** Resolve the full upstream + downstream closure for a selection. */
export function linkedSets(state: MdrState, sel: Selection | null): LinkedSets {
  const out: LinkedSets = { crf: new Set(), sdtm: new Set(), adam: new Set(), tfl: new Set() };
  if (!sel) return out;
  const idx = getTraceIndices(state);

  const addSdtm = (id: string) => out.sdtm.add(id);
  const addAdam = (id: string) => {
    out.adam.add(id);
    (idx.tflByAdam.get(id) ?? []).forEach((t) => out.tfl.add(t.id));
  };
  const addSdtmChain = (id: string) => {
    addSdtm(id);
    const v = idx.sdtmMap.get(id);
    v?.crfFieldIds.forEach((c) => out.crf.add(c));
    (idx.adamBySdtm.get(id) ?? []).forEach((a) => addAdam(a.id));
  };

  switch (sel.kind) {
    case "crf": {
      out.crf.add(sel.id);
      (idx.sdtmByCrf.get(sel.id) ?? []).forEach((v) => addSdtmChain(v.id));
      break;
    }
    case "sdtm": {
      addSdtmChain(sel.id);
      break;
    }
    case "adam": {
      const a = idx.adamMap.get(sel.id);
      if (a) {
        addAdam(a.id);
        a.sdtmVarIds.forEach((sid) => {
          addSdtm(sid);
          const v = idx.sdtmMap.get(sid);
          v?.crfFieldIds.forEach((c) => out.crf.add(c));
        });
      }
      break;
    }
    case "tfl": {
      const t = idx.tflMap.get(sel.id);
      if (t) {
        out.tfl.add(t.id);
        t.adamVarIds.forEach((aid) => {
          out.adam.add(aid);
          const a = idx.adamMap.get(aid);
          a?.sdtmVarIds.forEach((sid) => {
            addSdtm(sid);
            const v = idx.sdtmMap.get(sid);
            v?.crfFieldIds.forEach((c) => out.crf.add(c));
          });
        });
      }
      break;
    }
  }
  return out;
}

/* ---------- traceability matrix rows ---------- */
export function buildTraceRows(state: MdrState): TraceRow[] {
  const rows: TraceRow[] = [];
  const crfMap = crfById(state);
  const adamConsuming = new Map<string, AdamVar[]>();
  for (const sv of state.sdtmVars) adamConsuming.set(sv.id, adamConsumers(state, sv.id));

  // CRF fields with no SDTM target → documented collection-only gaps
  for (const g of state.crfGaps) {
    const f = crfMap.get(g.crfFieldId);
    if (f) {
      rows.push({ key: `gap-${f.id}`, crf: f, tfls: [], gap: "CRF_NOT_MAPPED" });
    }
  }

  for (const sv of state.sdtmVars) {
    const consumers = adamConsuming.get(sv.id) ?? [];
    if (sv.crfFieldIds.length === 0) {
      // assigned / derived at SDTM level (no CRF source)
      for (const a of consumers) {
        rows.push({ key: `${sv.id}>${a.id}`, sdtm: sv, adam: a, tfls: tflConsumers(state, a.id) });
      }
      if (consumers.length === 0) {
        rows.push({ key: `${sv.id}>—`, sdtm: sv, tfls: [], gap: "SDTM_NOT_IN_ADAM" });
      }
      continue;
    }
    for (const cfid of sv.crfFieldIds) {
      const f = crfMap.get(cfid);
      if (!f) continue;
      if (consumers.length === 0) {
        rows.push({ key: `${f.id}>${sv.id}>—`, crf: f, sdtm: sv, tfls: [], gap: "SDTM_NOT_IN_ADAM" });
        continue;
      }
      for (const a of consumers) {
        rows.push({ key: `${f.id}>${sv.id}>${a.id}`, crf: f, sdtm: sv, adam: a, tfls: tflConsumers(state, a.id) });
      }
    }
  }

  const rank = (d?: string) => ["DM", "EX", "VS", "LB", "AE", "CM"].indexOf(d ?? "") + 10;
  rows.sort((a, b) => {
    const ra = rank(a.sdtm?.domain ?? a.crf?.pageCode);
    const rb = rank(b.sdtm?.domain ?? b.crf?.pageCode);
    if (ra !== rb) return ra - rb;
    const va = a.sdtm?.name ?? a.crf?.id ?? "";
    const vb = b.sdtm?.name ?? b.crf?.id ?? "";
    if (va !== vb) return va.localeCompare(vb);
    return (a.adam?.name ?? "—").localeCompare(b.adam?.name ?? "—");
  });
  return rows;
}

/* ---------- coverage & stats ---------- */
export interface Coverage {
  crfTotal: number;
  crfMapped: number;
  crfPct: number;
  sdtmTotal: number;
  sdtmToAdam: number;
  sdtmPct: number;
  adamTotal: number;
  adamToTfl: number;
  adamPct: number;
  sdtmNoCrf: number;
}

export function coverage(state: MdrState): Coverage {
  const crfMapped = state.crfFields.filter((f) => sdtmTargets(state, f.id).length > 0).length;
  const sdtmToAdam = state.sdtmVars.filter((v) => adamConsumers(state, v.id).length > 0).length;
  const usedAdam = new Set(state.tfls.flatMap((t) => t.adamVarIds));
  const adamToTfl = state.adamVars.filter((a) => usedAdam.has(a.id)).length;
  const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));
  return {
    crfTotal: state.crfFields.length,
    crfMapped,
    crfPct: pct(crfMapped, state.crfFields.length),
    sdtmTotal: state.sdtmVars.length,
    sdtmToAdam,
    sdtmPct: pct(sdtmToAdam, state.sdtmVars.length),
    adamTotal: state.adamVars.length,
    adamToTfl,
    adamPct: pct(adamToTfl, state.adamVars.length),
    sdtmNoCrf: state.sdtmVars.filter((v) => v.crfFieldIds.length === 0).length,
  };
}

export interface DomainStat {
  domain: string;
  total: number;
  crf: number;
  assigned: number;
  derived: number;
  predecessor: number;
}

export function domainStats(state: MdrState): DomainStat[] {
  const m = new Map<string, DomainStat>();
  for (const v of state.sdtmVars) {
    let d = m.get(v.domain);
    if (!d) {
      d = { domain: v.domain, total: 0, crf: 0, assigned: 0, derived: 0, predecessor: 0 };
      m.set(v.domain, d);
    }
    d.total++;
    if (v.origin === "CRF") d.crf++;
    else if (v.origin === "ASSIGNED") d.assigned++;
    else if (v.origin === "DERIVED") d.derived++;
    else d.predecessor++;
  }
  return [...m.values()];
}

/* ---------- global search ---------- */
export interface SearchHit {
  kind: LayerKey;
  id: string;
  title: string;
  subtitle: string;
}

export function searchAll(state: MdrState, q: string): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  const match = (...parts: (string | undefined)[]) =>
    parts.some((p) => p?.toLowerCase().includes(needle));

  for (const f of state.crfFields) {
    if (match(f.id, f.label, f.page)) hits.push({ kind: "crf", id: f.id, title: f.id, subtitle: `${f.page} · ${f.label}` });
  }
  for (const v of state.sdtmVars) {
    if (match(v.id, v.label)) hits.push({ kind: "sdtm", id: v.id, title: v.id, subtitle: v.label });
  }
  for (const v of state.adamVars) {
    if (match(v.id, v.label)) hits.push({ kind: "adam", id: v.id, title: v.id, subtitle: v.label });
  }
  for (const t of state.tfls) {
    if (match(t.code, t.title)) hits.push({ kind: "tfl", id: t.id, title: t.code, subtitle: t.title });
  }
  return hits.slice(0, 14);
}

/* ---------- gap lists ---------- */
export function gapLists(state: MdrState) {
  const crfMap = crfById(state);
  const crfNotMapped = state.crfGaps
    .map((g) => ({ field: crfMap.get(g.crfFieldId), reason: g.reason }))
    .filter((g): g is { field: CrfField; reason: string } => !!g.field);
  const sdtmNotInAdam = state.sdtmVars.filter((v) => adamConsumers(state, v.id).length === 0);
  const usedAdam = new Set(state.tfls.flatMap((t) => t.adamVarIds));
  const adamNoTfl = state.adamVars.filter((a) => !usedAdam.has(a.id));
  const sdtmNoCrf = state.sdtmVars.filter((v) => v.crfFieldIds.length === 0);
  return { crfNotMapped, sdtmNotInAdam, adamNoTfl, sdtmNoCrf };
}

export type { CrfField, SdtmVar, AdamVar, Tfl };
