import { useMemo, useState } from "react";
import { buildTraceRows, LAYER_META, type TraceRow } from "../lib/trace";
import { useStore } from "../state/store";
import { GapChip, IconDownload, OriginBadge, RoleBadge, SectionLabel, TflChip, download } from "../components/ui";

const esc = (s?: string) => (s == null ? "" : `"${s.replace(/"/g, '""')}"`);

export default function Matrix() {
  const { state, select, toast } = useStore();
  const rows = useMemo(() => buildTraceRows(state), [state]);
  const [page, setPage] = useState("ALL");
  const [domain, setDomain] = useState("ALL");
  const [dataset, setDataset] = useState("ALL");
  const [q, setQ] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [cap, setCap] = useState(140);

  const pages = useMemo(() => ["ALL", ...new Set(state.crfFields.map((f) => f.pageCode))], [state]);
  const domains = useMemo(() => ["ALL", ...new Set(state.sdtmVars.map((v) => v.domain))], [state]);
  const datasets = useMemo(() => ["ALL", ...new Set(state.adamVars.map((v) => v.dataset))], [state]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (page !== "ALL" && (r.crf?.pageCode ?? r.sdtm?.domain) !== page) return false;
      if (domain !== "ALL" && r.sdtm?.domain !== domain) return false;
      if (dataset !== "ALL" && r.adam?.dataset !== dataset) return false;
      if (gapsOnly && !r.gap) return false;
      if (needle) {
        const hay = [r.crf?.id, r.crf?.label, r.sdtm?.id, r.sdtm?.label, r.adam?.id, r.adam?.label, r.adam?.derivation]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, page, domain, dataset, q, gapsOnly]);

  const shown = filtered.slice(0, cap);

  const exportCsv = () => {
    const header = ["CRF Page", "CRF Field", "CRF Label", "SDTM Var", "SDTM Label", "Role", "SDTM Origin", "ADaM Var", "ADaM Label", "Derivation Rule", "TFL References", "Flag"].join(",");
    const body = filtered
      .map((r: TraceRow) =>
        [
          esc(r.crf?.page),
          esc(r.crf?.id),
          esc(r.crf?.label),
          esc(r.sdtm?.id),
          esc(r.sdtm?.label),
          esc(r.sdtm?.role),
          esc(r.sdtm?.origin),
          esc(r.adam?.id),
          esc(r.adam?.label),
          esc(r.adam?.derivation ?? r.sdtm?.derivation),
          esc(r.tfls.map((t) => t.code).join("; ")),
          esc(r.gap === "CRF_NOT_MAPPED" ? "CRF not mapped" : r.gap === "SDTM_NOT_IN_ADAM" ? "No ADaM consumer" : ""),
        ].join(",")
      )
      .join("\n");
    download(`trace-mdr-matrix-${state.crfFields.length}rows.csv`, `${header}\n${body}`);
    toast("success", `Exported ${filtered.length} trace rows to CSV.`);
  };

  const sel = "rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none transition-colors focus:border-sdtm/60 cursor-pointer";

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Traceability Matrix</SectionLabel>
          <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">The full crosswalk</h1>
          <p className="mt-1 text-[13px] text-dim">
            Every CRF → SDTM → ADaM path as a single auditable row. Flagged rows are documented gaps.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-[12.5px] font-medium text-ink transition-all hover:border-sdtm/50 hover:bg-raise shadow-xs cursor-pointer"
        >
          <IconDownload size={14} className="text-sdtm" />
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3 shadow-xs">
        <select value={page} onChange={(e) => setPage(e.target.value)} className={sel} aria-label="CRF page filter">
          {pages.map((p) => (
            <option key={p} value={p}>{p === "ALL" ? "All CRF pages" : `CRF · ${p}`}</option>
          ))}
        </select>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={sel} aria-label="SDTM domain filter">
          {domains.map((d) => (
            <option key={d} value={d}>{d === "ALL" ? "All SDTM domains" : `SDTM · ${d}`}</option>
          ))}
        </select>
        <select value={dataset} onChange={(e) => setDataset(e.target.value)} className={sel} aria-label="ADaM dataset filter">
          {datasets.map((d) => (
            <option key={d} value={d}>{d === "ALL" ? "All ADaM datasets" : `ADaM · ${d}`}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search variables, labels, rules…"
          className="min-w-[220px] flex-1 rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-[11.5px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm/60"
        />
        <button
          onClick={() => setGapsOnly((g) => !g)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10.5px] font-medium transition-all cursor-pointer ${
            gapsOnly ? "border-crf/60 bg-crf/15 text-crf" : "border-line text-dim hover:border-line hover:text-ink"
          }`}
        >
          gaps only
        </button>
        <span className="ml-auto font-mono text-[10.5px] tabular text-faint">{filtered.length} rows</span>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-lg border border-line bg-panel shadow-sm">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 shadow-xs">
              <tr className="bg-panel">
                {["CRF source", "SDTM target", "Origin", "ADaM variable", "Derivation rule", "TFLs"].map((h, i) => (
                  <th key={h} className={`whitespace-nowrap border-b border-line px-3.5 py-2.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] ${i === 0 ? "text-crf" : i === 1 || i === 2 ? "text-sdtm" : i === 3 || i === 4 ? "text-adam" : "text-tfl"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr
                  key={r.key}
                  className={`group cursor-pointer border-b border-line/50 transition-colors hover:bg-raise/60 ${i % 2 === 1 ? "bg-raise/20" : ""}`}
                  onClick={() => {
                    const target = r.adam ?? r.sdtm ?? r.crf;
                    if (target) select({ kind: r.adam ? "adam" : r.sdtm ? "sdtm" : "crf", id: target.id }, true);
                  }}
                  title="Open in explorer"
                >
                  <td className="px-3.5 py-2 align-top">
                    {r.crf ? (
                      <>
                        <span className="font-mono text-[11.5px] font-semibold text-crf">{r.crf.id}</span>
                        <span className="block max-w-[190px] truncate text-[11px] text-dim">{r.crf.label}</span>
                      </>
                    ) : (
                      <span className="font-mono text-[10px] text-faint">— no CRF source</span>
                    )}
                    {r.gap === "CRF_NOT_MAPPED" && <span className="mt-1 inline-block"><GapChip label="not mapped" /></span>}
                  </td>
                  <td className="px-3.5 py-2 align-top">
                    {r.sdtm ? (
                      <>
                        <span className="font-mono text-[11.5px] font-semibold text-sdtm">{r.sdtm.id}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <RoleBadge role={r.sdtm.role} />
                          <span className="max-w-[150px] truncate text-[11px] text-dim">{r.sdtm.label}</span>
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-[10px] text-faint">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 align-top">
                    {r.sdtm ? <OriginBadge origin={r.sdtm.origin} /> : <span className="font-mono text-[10px] text-faint">—</span>}
                  </td>
                  <td className="px-3.5 py-2 align-top">
                    {r.adam ? (
                      <>
                        <span className="font-mono text-[11.5px] font-semibold text-adam">{r.adam.id}</span>
                        <span className="block max-w-[170px] truncate text-[11px] text-dim">{r.adam.label}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-faint">—</span>
                        {r.gap === "SDTM_NOT_IN_ADAM" && <GapChip label="no ADaM consumer" tone="sdtm" />}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3.5 py-2 align-top text-[11px] leading-snug text-dim">
                    {r.adam?.derivation ?? r.sdtm?.derivation ?? <span className="text-faint">direct copy</span>}
                  </td>
                  <td className="px-3.5 py-2 align-top">
                    <span className="flex max-w-[170px] flex-wrap gap-1">
                      {r.tfls.slice(0, 2).map((t) => (
                        <TflChip key={t.id} code={t.code} kind={t.kind} />
                      ))}
                      {r.tfls.length > 2 && <span className="font-mono text-[9.5px] text-faint">+{r.tfls.length - 2}</span>}
                      {r.tfls.length === 0 && r.adam && <span className="font-mono text-[10px] text-faint">—</span>}
                    </span>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-faint">
                    No trace rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > cap && (
          <button
            onClick={() => setCap((c) => c + 200)}
            className="w-full border-t border-line/60 py-2.5 text-[12px] font-medium text-dim transition-colors hover:bg-panel/60 hover:text-ink"
          >
            Showing {shown.length} of {filtered.length} rows — load more
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10.5px] text-faint">
        <span className="font-mono uppercase tracking-[0.14em]">Legend</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: LAYER_META.crf.color }} /> CRF ODM OID</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: LAYER_META.sdtm.color }} /> SDTM DOMAIN.VARIABLE</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: LAYER_META.adam.color }} /> ADaM DATASET.VARIABLE</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: LAYER_META.tfl.color }} /> TFL reference</span>
      </div>
    </div>
  );
}
