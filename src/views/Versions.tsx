import { useMemo, useState } from "react";
import type { ReleaseRow } from "../data/types";
import { all, nowIso } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, fmtDateTime, IconHistory, PageHeader, StatusBadge } from "../components/gxp";
import { download, IconChevron, IconDownload } from "../components/ui";

export default function Versions() {
  const { db, v, study, mutate, toast, actor } = useStore();
  const [scope, setScope] = useState<"ALL" | string>("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  const releases = useMemo(
    () => (db ? all<ReleaseRow>(db, "SELECT * FROM releases ORDER BY released_at DESC, id DESC") : []),
    [db, v],
  );
  const filtered = releases.filter((r) => scope === "ALL" || r.study_id === scope);

  const versionCensus = useMemo(() => {
    if (!db) return [];
    const rows = all<{ version: string; n: number }>(
      db, "SELECT version, COUNT(*) AS n FROM variables WHERE study_id=? GROUP BY version ORDER BY version", [study]);
    return rows;
  }, [db, v, study]);

  const ledger = useMemo(
    () => (db ? all<{ id: number; var_id: number; version: string; label: string; status: string; change_reason: string; created_by: string; created_at: string; domain: string; name: string }>(
      db,
      `SELECT vv.id, vv.var_id, vv.version, vv.label, vv.status, vv.change_reason, vv.created_by, vv.created_at,
              va.domain AS domain, va.name AS name
       FROM variable_versions vv JOIN variables va ON va.id = vv.var_id
       WHERE va.study_id=? ORDER BY vv.id DESC LIMIT 12`, [study]) : []),
    [db, v, study],
  );

  if (!db) return null;

  const maxN = Math.max(1, ...versionCensus.map((r) => Number(r.n)));

  const exportSnapshot = () => {
    const tables = ["studies", "domains", "variables", "variable_versions", "ct_codelists", "ct_terms", "vlm", "crf_pages", "crf_fields", "map_c2s", "map_s2a", "tfls", "dispositions", "releases", "audit_trail"];
    const snapshot: Record<string, unknown[]> = {};
    for (const t of tables) snapshot[t] = all(db, `SELECT * FROM ${t}`);
    snapshot._meta = [{ tool: "TRACE·MDR", schema: "master-mdr v1", exported_at: nowIso(), exported_by: actor }];
    download(`TRACE-MDR_snapshot_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), "application/json");
    mutate(() => undefined, { action: "EXPORT", entity: "releases", record: "MDR snapshot (JSON)", field: "—", old_value: "", new_value: "file", reason: "Point-in-time MDR export", study_id: "GLOBAL" });
    toast("success", "MDR snapshot exported — event recorded in the audit trail.");
  };

  return (
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconHistory size={20} />}
        title="Versions & Releases"
        subtitle="Release ledger for define.xml publications, CRF specifications and MDR snapshots — plus the per-variable version census for the selected study."
      >
        <button
          onClick={exportSnapshot}
          className="flex items-center gap-1.5 rounded-md border border-sdtm/45 bg-sdtm/12 px-3 py-2 text-[12px] font-semibold text-sdtm transition-all hover:-translate-y-px hover:bg-sdtm/20"
        >
          <IconDownload size={13} /> Export MDR snapshot
        </button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* releases */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="seg">
              <button className={scope === "ALL" ? "on" : ""} onClick={() => setScope("ALL")}>ALL STUDIES</button>
              {["VX-201", "VX-104"].map((s) => (
                <button key={s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {filtered.map((r) => {
              const isExp = expanded === r.id;
              return (
                <div key={r.id} className={`rounded-lg border bg-deep/60 transition-colors ${isExp ? "border-sdtm/40" : "border-line"}`}>
                  <button onClick={() => setExpanded(isExp ? null : r.id)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-4 text-left hover:bg-panel/40">
                    <IconChevron size={12} className={`text-faint transition-transform duration-200 ${isExp ? "rotate-90" : ""}`} />
                    <span className="w-[150px]">
                      <span className="block font-display text-[15px] font-bold">{r.type} <span className="text-sdtm">{r.version}</span></span>
                      <span className="block font-mono text-[9.5px] text-faint">{r.study_id}</span>
                    </span>
                    <StatusBadge status={r.status} small />
                    <span className="flex gap-2 font-mono text-[10px] tabular">
                      <span className="text-sdtm">+{r.added}</span>
                      <span className="text-[#f2ac3c]">~{r.changed}</span>
                      <span className="text-crf">−{r.deprecated}</span>
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-faint">
                      {r.released_at ? fmtDate(r.released_at) : "in preparation"}
                    </span>
                  </button>
                  {isExp && (
                    <div className="anim-fade grid gap-x-8 gap-y-2 border-t border-line/60 px-5 py-4 text-[11.5px] sm:grid-cols-2">
                      <p><span className="font-mono text-[9.5px] uppercase tracking-wide text-faint">Notes — </span><span className="text-dim">{r.notes}</span></p>
                      <p><span className="font-mono text-[9.5px] uppercase tracking-wide text-faint">Released by — </span><span className="text-dim">{r.released_by || "—"}</span></p>
                      <p><span className="font-mono text-[9.5px] uppercase tracking-wide text-faint">Approved by — </span><span className="text-dim">{r.approved_by || "pending QA"}</span></p>
                      <p><span className="font-mono text-[9.5px] uppercase tracking-wide text-faint">Timestamp — </span><span className="font-mono text-dim">{r.released_at ? fmtDateTime(r.released_at) : "—"}</span></p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* version census + ledger */}
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-line bg-deep/70 p-4">
            <h3 className="font-display text-[13.5px] font-bold">Version census — {study}</h3>
            <p className="mt-0.5 text-[10.5px] text-faint">variables per spec version</p>
            <ul className="mt-3 flex flex-col gap-2">
              {versionCensus.map((r) => (
                <li key={r.version} className="flex items-center gap-2.5">
                  <span className="w-10 shrink-0 font-mono text-[10px] font-semibold text-[#c9b3ff]">v{r.version}</span>
                  <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-raise/70">
                    <div className="h-full rounded-full bg-[#c9b3ff]/65 transition-all duration-700" style={{ width: `${(Number(r.n) / maxN) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular text-faint">{r.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-line bg-deep/70 p-4">
            <h3 className="font-display text-[13.5px] font-bold">Version ledger</h3>
            <p className="mt-0.5 text-[10.5px] text-faint">most recent superseded snapshots</p>
            <ul className="mt-3 flex flex-col">
              {ledger.map((l, i) => (
                <li key={l.id} className="relative border-l border-line/70 pb-3 pl-3.5 last:pb-0">
                  <span className="absolute -left-[4px] top-1 h-2 w-2 rounded-full" style={{ background: i === 0 ? "#c9b3ff" : "#3a5a66" }} />
                  <p className="font-mono text-[10px]">
                    <span className="font-semibold text-[#c9b3ff]">v{l.version}</span>
                    <span className="ml-1.5 text-ink">{l.domain}.{l.name}</span>
                    <span className="ml-1.5"><StatusBadge status={l.status} small /></span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-dim">{l.change_reason}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-faint">{l.created_by} · {fmtDate(l.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
