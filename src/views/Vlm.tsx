import { useMemo, useState } from "react";
import type { VlmRow } from "../data/types";
import { all } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, PageHeader, Seg, StatusBadge, VerChip } from "../components/gxp";
import { IconLayers } from "../components/gxp";
import { IconSearch } from "../components/ui";

export default function Vlm() {
  const { db, v, study } = useStore();
  const [std, setStd] = useState<"ALL" | "SDTM" | "ADaM">("ALL");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () => (db ? all<VlmRow>(db, "SELECT * FROM vlm WHERE study_id=? ORDER BY domain, name", [study]) : []),
    [db, v, study],
  );

  const filtered = rows.filter((r) => {
    if (std !== "ALL" && r.standard !== std) return false;
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
        subtitle="In-line overrides for observations where the variable-level rule is not enough — e.g. a result that is numeric only for a specific test, or a unit that changes with the analyte. These rows publish into define.xml ValueListDef."
      >
        <Seg options={["ALL", "SDTM", "ADaM"] as const} value={std} onChange={setStd} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search variable, condition…" className="field-input w-[260px] pl-8 font-mono text-[11.5px]" />
        </div>
        <span className="ml-auto font-mono text-[10px] text-faint">{filtered.length} of {rows.length} VLM records</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-deep/60">
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Variable</th>
              <th>WHEN / WHERE condition</th>
              <th>Override</th>
              <th>Method</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="font-mono text-[11.5px] font-semibold" style={{ color: r.standard === "SDTM" ? "#38c7a6" : "#f2ac3c" }}>{r.domain}</span>
                  <span className="block font-mono text-[8.5px] text-faint">{r.standard}</span>
                </td>
                <td className="font-mono text-[11.5px] font-semibold text-ink">{r.name}</td>
                <td className="max-w-[260px]">
                  <span className="rounded-sm border border-[#7fb7e635] bg-[#7fb7e60d] px-1.5 py-0.5 font-mono text-[10px] text-[#7fb7e6]">
                    WHEN {r.when_clause}
                  </span>
                  {r.where_clause !== "—" && (
                    <span className="ml-1 rounded-sm border border-[#c9b3ff35] bg-[#c9b3ff0d] px-1.5 py-0.5 font-mono text-[10px] text-[#c9b3ff]">
                      WHERE {r.where_clause}
                    </span>
                  )}
                </td>
                <td>
                  <span className="block text-[11.5px] text-ink">{r.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-faint">{r.type}{r.length} · origin {r.origin}{r.codelist ? ` · codelist ${r.codelist}` : ""}</span>
                </td>
                <td className="max-w-[240px] text-[11px] leading-relaxed text-dim">{r.method}</td>
                <td><VerChip v={r.version} /></td>
                <td><StatusBadge status={r.status} small /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-mono text-[10px] text-faint">
        Last synchronised {fmtDate("2026-02-10")} · VLM rows are reviewed together with their parent variable during each release cycle.
      </p>
    </div>
  );
}
