import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { LayerKey } from "../data/types";
import { LAYER_META, adamConsumers, crfById, linkedSets, sdtmTargets, tflConsumers, grouped } from "../lib/trace";
import { all } from "../db/sqlite";
import { useStore } from "../state/store";
import { FlowArrow, IconAlert, IconChevron, IconPlus, IconSearch, IconX, RoleBadge, OriginBadge, TflChip, GapChip } from "../components/ui";

const PAGE_ORDER = ["DM", "VS", "AE", "CM", "LB", "EX"];

function ColumnShell({
  layer,
  title,
  count,
  q,
  setQ,
  children,
}: {
  layer: LayerKey;
  title: string;
  count: number;
  q: string;
  setQ: (s: string) => void;
  children: ReactNode;
}) {
  const meta = LAYER_META[layer];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-sm">
      <header className="shrink-0 border-b border-line px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between" style={{ borderTop: `2px solid ${meta.color}`, marginTop: -14, paddingTop: 10 }}>
          <h2 className="font-display text-[15px] font-bold tracking-wide">
            <span style={{ color: meta.color }}>{title}</span>
            <span className="ml-2 font-mono text-[10.5px] font-medium text-faint">{count}</span>
          </h2>
        </div>
        <div className="relative mt-2">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}…`}
            className="w-full rounded-md border border-line bg-panel py-1.5 pl-8 pr-2.5 font-mono text-[11.5px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm"
            style={{ caretColor: meta.color }}
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{children}</div>
    </section>
  );
}

function Group({
  code,
  title,
  count,
  k,
  collapsed,
  onToggle,
  color,
  children,
}: {
  code: string;
  title: string;
  count: number;
  k: string;
  collapsed: Set<string>;
  onToggle: (k: string) => void;
  color: string;
  children: ReactNode;
}) {
  const closed = collapsed.has(k);
  return (
    <div className="mb-2">
      <button
        onClick={() => onToggle(k)}
        className="group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-raise/60 cursor-pointer"
      >
        <IconChevron size={11} className={`shrink-0 text-faint transition-transform duration-200 ${closed ? "" : "rotate-90"}`} />
        <span className="font-mono text-[12px] font-bold tracking-[0.12em]" style={{ color }}>
          {code}
        </span>
        <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
        <span className="ml-auto rounded-sm bg-raise px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular text-dim">{count}</span>
      </button>
      {!closed && <div className="mt-1 flex flex-col gap-1.5 pl-1">{children}</div>}
    </div>
  );
}

const CORE_SDTM = new Set(["DM", "VS", "AE", "CM", "LB", "EX"]);
const CORE_ADAM = new Set(["ADSL", "ADAE", "ADVS", "ADLB", "ADCM"]);

export default function Explorer() {
  const { state, selection, select, setView, db, v } = useStore();
  const [qCrf, setQCrf] = useState("");
  const [qSdtm, setQSdtm] = useState("");
  const [qAdam, setQAdam] = useState("");

  const sdtmDomainNames = useMemo(() => {
    if (!db) return new Map<string, string>();
    const rows = all<{ code: string; name: string }>(db, "SELECT code, name FROM domains WHERE standard='SDTM'");
    return new Map(rows.map((r) => [r.code, r.name]));
  }, [db, v]);

  const adamDatasetNames = useMemo(() => {
    if (!db) return new Map<string, string>();
    const rows = all<{ code: string; name: string }>(db, "SELECT code, name FROM domains WHERE standard='ADaM'");
    return new Map(rows.map((r) => [r.code, r.name]));
  }, [db, v]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    // Pre-collapse non-core domains so rendering is instant
    for (const v of state.sdtmVars) {
      if (!CORE_SDTM.has(v.domain)) set.add(`sdtm:${v.domain}`);
    }
    for (const v of state.adamVars) {
      if (!CORE_ADAM.has(v.dataset)) set.add(`adam:${v.dataset}`);
    }
    return set;
  });

  const linked = useMemo(() => linkedSets(state, selection), [state, selection]);
  const crfMap = useMemo(() => crfById(state), [state]);
  const gapSet = useMemo(() => new Set(state.crfGaps.map((g) => g.crfFieldId)), [state]);
  const hasSel = !!selection;

  // Auto-expand any domain that has selected or linked nodes
  useEffect(() => {
    if (!selection) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const sid of linked.sdtm) {
        const dom = sid.split(".")[0];
        if (next.has(`sdtm:${dom}`)) {
          next.delete(`sdtm:${dom}`);
          changed = true;
        }
      }
      for (const aid of linked.adam) {
        const ds = aid.split(".")[0];
        if (next.has(`adam:${ds}`)) {
          next.delete(`adam:${ds}`);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selection, linked]);

  const toggleCollapse = (k: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const isActive = (kind: LayerKey, id: string) => selection?.kind === kind && selection.id === id;
  const dimCls = (kind: LayerKey, id: string) =>
    `node-item w-full rounded-md border px-3 py-2 text-left transition-all cursor-pointer shadow-xs ${
      isActive(kind, id) ? "border-transparent ring-2" : "border-line bg-panel hover:border-slate-400 hover:bg-raise/30"
    } ${hasSel && !linked[kind].has(id) ? "is-dimmed" : ""}`;

  const itemStyle = (kind: LayerKey, id: string): CSSProperties => {
    const c = LAYER_META[kind].color;
    if (isActive(kind, id)) {
      return { borderColor: c, background: `${c}15`, boxShadow: `0 0 0 1.5px ${c}, 0 4px 14px ${c}25` };
    }
    return { background: "#ffffff" };
  };

  const match = (q: string, ...parts: (string | undefined)[]) =>
    q.trim() === "" || parts.some((p) => p?.toLowerCase().includes(q.trim().toLowerCase()));

  /* chain strip data */
  const chain: { kind: LayerKey; items: { id: string; title: string }[] }[] = (
    [
      ["crf", [...linked.crf].map((id) => ({ id, title: id }))],
      ["sdtm", [...linked.sdtm].map((id) => ({ id, title: id }))],
      ["adam", [...linked.adam].map((id) => ({ id, title: id }))],
      ["tfl", [...linked.tfl].map((id) => ({ id, title: id }))],
    ] as [LayerKey, { id: string; title: string }[]][]
  )
    .map(([kind, items]) => ({ kind, items }))
    .filter((g) => g.items.length > 0);

  const selDetail = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "crf") {
      const f = crfMap.get(selection.id);
      return f ? { title: f.id, line1: `${f.page} · ${f.label}`, line2: `type: ${f.dataType}${f.codelist ? ` · codelist ${f.codelist}` : ""}${f.required ? " · required" : " · optional"}`, derivation: gapSet.has(f.id) ? state.crfGaps.find((g) => g.crfFieldId === f.id)?.reason : undefined } : null;
    }
    if (selection.kind === "sdtm") {
      const v = state.sdtmVars.find((x) => x.id === selection.id);
      return v ? { title: v.id, line1: v.label, line2: `${v.role} · ${v.type}${v.length} · origin ${v.origin}${v.codelist ? ` · codelist ${v.codelist}` : ""}`, derivation: v.derivation } : null;
    }
    if (selection.kind === "adam") {
      const v = state.adamVars.find((x) => x.id === selection.id);
      return v ? { title: v.id, line1: v.label, line2: `${v.model} structure · ${v.type}${v.length} · origin ${v.origin}`, derivation: v.derivation } : null;
    }
    const t = state.tfls.find((x) => x.id === selection.id);
    return t ? { title: t.code, line1: t.title, line2: `${t.kind} · consumes ${t.adamVarIds.length} ADaM variables`, derivation: undefined } : null;
  }, [selection, state, crfMap, gapSet]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4 pb-4 pt-4 sm:px-6">
      {/* trace path strip */}
      <div className="shrink-0 rounded-lg border border-line bg-panel shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
            Trace path
          </p>
          {chain.length === 0 ? (
            <p className="flex items-center gap-2 text-[12px] text-dim">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-sdtm" />
              Select any node below to resolve its end-to-end trace across all four layers.
            </p>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-y-2">
                {chain.map((g, gi) => (
                  <span key={g.kind} className="flex items-center">
                    {gi > 0 && <FlowArrow color={LAYER_META[g.kind].color} />}
                    <span className="flex max-w-full flex-wrap items-center gap-1.5">
                      {g.items.slice(0, 6).map((it) => (
                        <button
                          key={it.id}
                          onClick={() => select({ kind: g.kind, id: it.id })}
                          className={`rounded-md border px-2 py-1 font-mono text-[10.5px] font-medium transition-all hover:-translate-y-px ${
                            isActive(g.kind, it.id) ? "" : "border-line/70 hover:border-line"
                          }`}
                          style={
                            isActive(g.kind, it.id)
                              ? { borderColor: LAYER_META[g.kind].color, background: `${LAYER_META[g.kind].color}1c`, color: LAYER_META[g.kind].color }
                              : { color: LAYER_META[g.kind].color, background: `${LAYER_META[g.kind].color}0d` }
                          }
                        >
                          {it.title}
                        </button>
                      ))}
                      {g.items.length > 6 && (
                        <span className="font-mono text-[10px] text-faint">+{g.items.length - 6} more</span>
                      )}
                    </span>
                  </span>
                ))}
              </div>
              <button
                onClick={() => select(null)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-line/70 px-2.5 py-1.5 text-[11px] text-dim transition-colors hover:border-line hover:text-ink"
              >
                <IconX size={11} /> Clear
              </button>
            </>
          )}
        </div>
        {selDetail && (
          <div className="anim-fade mt-2.5 border-t border-line/70 pt-2.5">
            <p className="text-[12px] text-ink">
              <span className="font-mono font-semibold" style={{ color: LAYER_META[selection!.kind].color }}>{selDetail.title}</span>
              <span className="text-dim"> — {selDetail.line1}</span>
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-faint">{selDetail.line2}</p>
            {selDetail.derivation && (
              <p className="mt-1.5 rounded-md border border-line/60 bg-panel/60 px-3 py-2 text-[11.5px] leading-relaxed text-dim">
                <span className="mr-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-adam">rule</span>
                {selDetail.derivation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* three columns */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        {/* CRF */}
        <ColumnShell layer="crf" title="CRF Pages" count={state.crfFields.length} q={qCrf} setQ={setQCrf}>
          {grouped(state.crfFields, (f) => f.pageCode)
            .sort((a, b) => PAGE_ORDER.indexOf(a[0]) - PAGE_ORDER.indexOf(b[0]))
            .map(([code, fields]) => {
              const visible = fields.filter((f) => match(qCrf, f.id, f.label));
              if (visible.length === 0) return null;
              return (
                <Group key={code} code={code} title={fields[0].page} count={visible.length} k={`crf:${code}`} collapsed={collapsed} onToggle={toggleCollapse} color={LAYER_META.crf.color}>
                  {visible.map((f) => {
                    const targets = sdtmTargets(state, f.id).length;
                    const isGap = gapSet.has(f.id);
                    return (
                      <button key={f.id} onClick={() => select(isActive("crf", f.id) ? null : { kind: "crf", id: f.id })} className={dimCls("crf", f.id)} style={itemStyle("crf", f.id)}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[12px] font-bold text-crf">{f.id}</span>
                          {isGap && <IconAlert size={12} className="text-crf shrink-0" />}
                          <span className="ml-auto shrink-0 rounded-sm bg-crf/12 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-crf">
                            {isGap ? "not mapped" : `→ ${targets} SDTM`}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-[11.5px] font-semibold text-ink">{f.label}</span>
                      </button>
                    );
                  })}
                </Group>
              );
            })}
        </ColumnShell>

        {/* SDTM */}
        <ColumnShell layer="sdtm" title="SDTM Domains" count={state.sdtmVars.length} q={qSdtm} setQ={setQSdtm}>
          {grouped(state.sdtmVars, (v) => v.domain).map(([domain, vars]) => {
            const visible = vars.filter((v) => match(qSdtm, v.id, v.label));
            if (visible.length === 0) return null;
            return (
              <Group key={domain} code={domain} title={sdtmDomainNames.get(domain) ?? `${domain} domain`} count={visible.length} k={`sdtm:${domain}`} collapsed={collapsed} onToggle={toggleCollapse} color={LAYER_META.sdtm.color}>
                {visible.map((v) => {
                  const down = adamConsumers(state, v.id).length;
                  return (
                    <button key={v.id} onClick={() => select(isActive("sdtm", v.id) ? null : { kind: "sdtm", id: v.id })} className={dimCls("sdtm", v.id)} style={itemStyle("sdtm", v.id)}>
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-[12px] font-bold text-sdtm">{v.name}</span>
                        <RoleBadge role={v.role} />
                        <OriginBadge origin={v.origin} />
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span className="truncate text-[11.5px] font-semibold text-ink">{v.label}</span>
                        <span className="ml-auto flex shrink-0 gap-1">
                          <span className="rounded-sm bg-raise px-1.5 py-px font-mono text-[9.5px] font-medium text-dim">←{v.crfFieldIds.length}</span>
                          <span className={`rounded-sm px-1.5 py-px font-mono text-[9.5px] font-semibold ${down > 0 ? "bg-sdtm/15 text-sdtm" : "bg-adam/15 text-adam"}`}>
                            {down > 0 ? `→${down}` : "dead end"}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </Group>
            );
          })}
        </ColumnShell>

        {/* ADaM */}
        <ColumnShell layer="adam" title="ADaM Datasets" count={state.adamVars.length} q={qAdam} setQ={setQAdam}>
          {grouped(state.adamVars, (v) => v.dataset).map(([ds, vars]) => {
            const visible = vars.filter((v) => match(qAdam, v.id, v.label));
            if (visible.length === 0) return null;
            return (
              <Group key={ds} code={ds} title={adamDatasetNames.get(ds) ?? (vars[0].model === "ADSL" ? "Subject-Level Analysis" : vars[0].model === "BDS" ? "Basic Data Structure" : "Occurrence Structure")} count={visible.length} k={`adam:${ds}`} collapsed={collapsed} onToggle={toggleCollapse} color={LAYER_META.adam.color}>
                {visible.map((v) => {
                  const tfls = tflConsumers(state, v.id);
                  return (
                    <button key={v.id} onClick={() => select(isActive("adam", v.id) ? null : { kind: "adam", id: v.id })} className={dimCls("adam", v.id)} style={itemStyle("adam", v.id)}>
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-[12px] font-bold text-adam">{v.name}</span>
                        <OriginBadge origin={v.origin} />
                        {tfls.length === 0 && <GapChip label="no TFL" tone="adam" />}
                      </span>
                      <span className="mt-1 block truncate text-[11.5px] font-semibold text-ink">{v.label}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {tfls.slice(0, 3).map((t) => (
                          <span key={t.id} onClick={(e) => { e.stopPropagation(); select({ kind: "tfl", id: t.id }); }} className="cursor-pointer">
                            <TflChip code={t.code} kind={t.kind} />
                          </span>
                        ))}
                        {tfls.length > 3 && <span className="font-mono text-[9.5px] text-faint">+{tfls.length - 3}</span>}
                        <span className="ml-auto rounded-sm bg-raise px-1.5 py-px font-mono text-[9.5px] font-medium text-dim">←{v.sdtmVarIds.length} SDTM</span>
                      </span>
                    </button>
                  );
                })}
              </Group>
            );
          })}
        </ColumnShell>
      </div>

      <button
        onClick={() => setView("variables")}
        className="group fixed bottom-5 right-6 z-40 flex items-center gap-2 rounded-full border border-sdtm/40 bg-panel px-4 py-2.5 text-[12.5px] font-semibold text-sdtm shadow-lg shadow-slate-300/60 transition-all hover:-translate-y-0.5 hover:bg-raise hover:border-sdtm hover:shadow-xl cursor-pointer"
      >
        <IconPlus size={14} className="transition-transform group-hover:rotate-90" />
        New variable
      </button>
    </div>
  );
}
