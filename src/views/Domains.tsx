import { useMemo, useState } from "react";
import type { DomainRow, Status } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { IconLayers, PageHeader, Seg, StatusBadge, StatusModal, VerChip, fmtDate } from "../components/gxp";
import { IconSearch } from "../components/ui";

export default function Domains() {
  const { db, v, study, transitionStatus } = useStore();
  const [std, setStd] = useState<"ALL" | "SDTM" | "ADaM">("ALL");
  const [status, setStatus] = useState<"ALL" | Status>("ALL");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<DomainRow | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => {
    if (!db) return [];
    return all<DomainRow>(db, "SELECT * FROM domains WHERE study_id=? ORDER BY standard, code", [study]);
  }, [db, v, study]);

  const filtered = rows.filter((r) => {
    if (std !== "ALL" && r.standard !== std) return false;
    if (status !== "ALL" && r.status !== status) return false;
    const qq = q.trim().toLowerCase();
    if (qq && !`${r.code} ${r.name} ${r.description}`.toLowerCase().includes(qq)) return false;
    return true;
  });

  if (!db) return null;

  return (
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconLayers size={20} />}
        title="Domain Registry"
        subtitle="SDTM domains and ADaM datasets registered for the selected study — structure, class, lifecycle status and version. Transitions are recorded in the audit trail."
      >
        <Seg options={["ALL", "SDTM", "ADaM"] as const} value={std} onChange={(s) => setStd(s)} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search domains…" className="field-input w-[240px] pl-8 font-mono text-[11.5px]" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | Status)} className="field-input w-[150px] font-mono text-[11px]">
          <option value="ALL">ALL STATUS</option>
          {(["DRAFT", "IN REVIEW", "ACTIVE", "DEPRECATED"] as Status[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] text-faint">{filtered.length} of {rows.length} domains</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-deep/60">
        <table className="tbl min-w-[860px]">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Name</th>
              <th>Standard</th>
              <th>Class / Structure</th>
              <th>Vars</th>
              <th>Version</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const nvars = count(db, "SELECT COUNT(*) AS n FROM variables WHERE study_id=? AND domain=? AND standard=?", [study, r.code, r.standard]);
              return (
                <tr key={r.id}>
                  <td className="font-mono text-[12px] font-semibold" style={{ color: r.standard === "SDTM" ? "#38c7a6" : "#f2ac3c" }}>{r.code}</td>
                  <td>
                    <span className="text-ink">{r.name}</span>
                    <span className="mt-0.5 block max-w-[300px] truncate text-[10.5px] text-faint">{r.description}</span>
                  </td>
                  <td><span className="rounded-sm border border-line/70 px-1.5 py-px font-mono text-[9.5px] text-dim">{r.standard}</span></td>
                  <td className="max-w-[240px] text-[11px] text-dim">
                    <span className="text-ink">{r.cls}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-faint">{r.structure}</span>
                  </td>
                  <td className="font-mono text-[11.5px] tabular text-ink">{nvars}</td>
                  <td><VerChip v={r.version} /></td>
                  <td><StatusBadge status={r.status} small /></td>
                  <td className="whitespace-nowrap font-mono text-[10px] text-faint">{fmtDate(r.updated_at)}<span className="block">{r.updated_by.split("—")[0].trim()}</span></td>
                  <td>
                    <button
                      onClick={() => { setModal(r); setReason(""); }}
                      className="rounded-md border border-line/70 px-2.5 py-1 font-mono text-[9.5px] text-dim transition-colors hover:border-sdtm/50 hover:text-sdtm"
                    >
                      transition
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <StatusModal
          entity="domain"
          record={`${modal.standard}.${modal.code}`}
          current={modal.status}
          reason={reason}
          setReason={setReason}
          onCancel={() => setModal(null)}
          onConfirm={(to, rsn) => {
            transitionStatus("domains", modal.id, "id", to, rsn);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
