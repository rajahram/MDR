import { useMemo, useState } from "react";
import type { AuditRow } from "../data/types";
import { all } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDateTime, IconShield, PageHeader } from "../components/gxp";
import { download, IconSearch } from "../components/ui";

const ACTION_TONE: Record<string, string> = {
  CREATE: "bg-sdtm/15 text-sdtm",
  TRANSITION: "bg-adam/15 text-adam",
  VERSION: "bg-[#c9b3ff1f] text-[#c9b3ff]",
  EXPORT: "bg-tfl/15 text-tfl",
  IMPORT: "bg-[#7fb7e61f] text-[#7fb7e6]",
  UPDATE: "bg-raise text-dim",
};

export default function AuditTrail() {
  const { db, v, toast, mutate } = useStore();
  const [action, setAction] = useState("ALL");
  const [entity, setEntity] = useState("ALL");
  const [q, setQ] = useState("");

  const rows = useMemo(() => (db ? all<AuditRow>(db, "SELECT * FROM audit_trail ORDER BY id DESC") : []), [db, v]);

  const actions = useMemo(() => ["ALL", ...new Set(rows.map((r) => r.action))], [rows]);
  const entities = useMemo(() => ["ALL", ...new Set(rows.map((r) => r.entity))], [rows]);

  const filtered = rows.filter((r) => {
    if (action !== "ALL" && r.action !== action) return false;
    if (entity !== "ALL" && r.entity !== entity) return false;
    const qq = q.trim().toLowerCase();
    if (qq && !`${r.actor} ${r.record} ${r.reason} ${r.old_value} ${r.new_value} ${r.study_id}`.toLowerCase().includes(qq)) return false;
    return true;
  });

  if (!db) return null;

  const exportCsv = () => {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const head = "id,timestamp,actor,action,entity,record,field,old_value,new_value,reason,study";
    const body = filtered.map((r) =>
      [String(r.id), r.ts, r.actor, r.action, r.entity, r.record, r.field, r.old_value, r.new_value, r.reason, r.study_id].map(esc).join(","));
    download(`TRACE-MDR_audit_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body].join("\n"));
    mutate(() => undefined, { action: "EXPORT", entity: "audit_trail", record: `audit_trail.csv (${filtered.length} rows)`, field: "—", old_value: "", new_value: "file", reason: "Audit trail export", study_id: "GLOBAL" });
    toast("success", `${filtered.length} audit events exported to CSV.`);
  };

  return (
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconShield size={20} />}
        title="Audit Trail"
        subtitle="Complete, computer-generated, time-stamped record of every create, update, transition, version and export. The trail is append-only — records can never be modified or deleted."
      >
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-md border border-line/80 px-3 py-2 text-[12px] font-semibold text-dim transition-all hover:-translate-y-px hover:border-sdtm/50 hover:text-sdtm"
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export CSV
        </button>
      </PageHeader>

      <div className="mb-3 flex items-center gap-2 rounded-md border border-[#f2ac3c30] bg-[#f2ac3c0a] px-3.5 py-2.5">
        <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-[#f2ac3c]" />
        <p className="font-mono text-[10.5px] text-[#f2ac3c]">
          21 CFR Part 11 §11.10(e) — secure, time-ordered, operator-attributed record. Retention: life of the master MDR + 15 years.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, record, reason…" className="field-input w-[260px] pl-8 font-mono text-[11.5px]" />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="field-input w-[150px] font-mono text-[11px]">
          {actions.map((a) => <option key={a} value={a}>{a === "ALL" ? "ALL ACTIONS" : a}</option>)}
        </select>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="field-input w-[170px] font-mono text-[11px]">
          {entities.map((a) => <option key={a} value={a}>{a === "ALL" ? "ALL ENTITIES" : a}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] text-faint">{filtered.length} of {rows.length} events</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-deep/60">
        <table className="tbl min-w-[1000px]">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Record</th>
              <th>Change</th>
              <th>Reason</th>
              <th>Study</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-mono text-[10px] tabular text-dim">{fmtDateTime(r.ts)}</td>
                <td className="whitespace-nowrap text-[11px] text-ink">{r.actor}</td>
                <td>
                  <span className={`rounded-sm px-1.5 py-px font-mono text-[9px] font-semibold ${ACTION_TONE[r.action] ?? "bg-raise text-dim"}`}>{r.action}</span>
                </td>
                <td className="font-mono text-[10.5px] text-dim">{r.entity}</td>
                <td className="max-w-[180px]">
                  <span className="block truncate font-mono text-[10.5px] font-semibold text-ink">{r.record}</span>
                </td>
                <td className="max-w-[220px] font-mono text-[10px]">
                  {r.field !== "—" ? (
                    <span className="text-dim">
                      {r.field}: <span className="text-crf">{r.old_value || "∅"}</span>
                      <span className="mx-1 text-faint">→</span>
                      <span className="text-sdtm">{r.new_value}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="max-w-[240px]">
                  <span className="block truncate text-[10.5px] text-dim" title={r.reason}>“{r.reason}”</span>
                </td>
                <td className="font-mono text-[10px] text-faint">{r.study_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
