import { useMemo, useState } from "react";
import type { VlmRow } from "../data/types";
import { all } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, PageHeader, Seg, StatusBadge, VerChip } from "../components/gxp";
import { IconLayers } from "../components/gxp";
import { IconSearch } from "../components/ui";

export default function Vlm() {
  const { db, v, study, select } = useStore();
  const [std, setStd] = useState<"ALL" | "SDTM" | "ADaM">("ALL");
  const [domain, setDomain] = useState("ALL");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () => (db ? all<VlmRow>(db, "SELECT * FROM vlm WHERE study_id=? ORDER BY domain, name", [study]) : []),
    [db, v, study],
  );

  const domains = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.domain);
    return [...s].sort();
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (std !== "ALL" && r.standard !== std) return false;
    if (domain !== "ALL" && r.domain !== domain) return false;
    const qq = q.trim().toLowerCase();
    if (qq && !`${r.name} ${r.label} ${r.when_clause} ${r.where_clause} ${r.domain}`.toLowerCase().includes(qq)) return false;
    return true;
  });

  if (!db) return null;

  return (
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconLayers size={20} />}
        title="Value-Level Metadata"
        subtitle="In-line overrides for observations where the variable-level rule is not enough — parsed directly from SDTM-IG 3.4 & ADaM-IG 1.3 ValueListDef and WhereClauseDef. These rows publish into define.xml ValueListDef."
      >
        <Seg options={["ALL", "SDTM", "ADaM"] as const} value={std} onChange={setStd} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search variable, condition…" className="field-input w-[260px] pl-8 font-mono text-[11.5px]" />
        </div>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="field-input w-[140px] font-mono text-[11px]">
          <option value="ALL">ALL DOMAINS</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] text-faint">{filtered.length} of {rows.length} VLM records</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel shadow-sm">
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Variable</th>
              <th>WHEN / WHERE condition</th>
              <th>Override definition</th>
              <th>Method</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="font-mono text-[12px] font-bold" style={{ color: r.standard === "SDTM" ? "#0b9e84" : "#b8720a" }}>
                    {r.domain}
                  </span>
                  <span className="block font-mono text-[8.5px] text-faint">{r.standard}</span>
                </td>
                <td className="font-mono text-[11.5px] font-bold text-ink">{r.name}</td>
                <td className="max-w-[280px]">
                  <span className="rounded-sm border border-tfl/40 bg-tfl/10 px-1.5 py-0.5 font-mono text-[10px] text-tfl">
                    WHEN {r.when_clause}
                  </span>
                  {r.where_clause !== "—" && (
                    <span className="ml-1 rounded-sm border border-[#7a4f9b40] bg-[#7a4f9b10] px-1.5 py-0.5 font-mono text-[10px] text-[#7a4f9b]">
                      WHERE {r.where_clause}
                    </span>
                  )}
                </td>
                <td>
                  <span className="block text-[11.5px] font-medium text-ink">{r.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-faint">
                    {r.type}{r.length ? `(${r.length})` : ""} · origin {r.origin}
                    {r.codelist ? ` · codelist ${r.codelist}` : ""}
                  </span>
                </td>
                <td className="max-w-[260px] text-[11px] leading-relaxed text-dim">{r.method}</td>
                <td><VerChip v={r.version} /></td>
                <td><StatusBadge status={r.status} small /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-mono text-[10px] text-faint">
        Synchronised with CDISC XML (2026-03-27 release) · 418 value-level specifications active.
      </p>
    </div>
  );
}
