import { useMemo, useState } from "react";
import type { DomainRow, Status, VariableRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { IconLayers, PageHeader, Seg, StatusBadge, StatusModal, VerChip, fmtDate } from "../components/gxp";
import { IconSearch, IconX, Modal } from "../components/ui";
import { RoleBadge, OriginBadge } from "../components/ui";

/* ── Purpose badge ─────────────────────────────────────────── */
function PurposeBadge({ purpose }: { purpose: string }) {
  if (purpose === "Data Collection") {
    return (
      <span className="inline-flex items-center rounded-sm border border-crf/40 bg-crf/10 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wide text-crf">
        Data Collection
      </span>
    );
  }
  const isTabulation = purpose === "Tabulation";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wide ${
        isTabulation
          ? "border-sdtm/40 bg-sdtm/10 text-sdtm"
          : "border-adam/40 bg-adam/10 text-adam"
      }`}
    >
      {isTabulation ? "Tabulation" : "Analysis"}
    </span>
  );
}

/* ── Class chip ─────────────────────────────────────────────── */
const CLASS_COLORS: Record<string, string> = {
  "Special Purpose":    "border-[#7a4f9b40] bg-[#7a4f9b12] text-[#7a4f9b]",
  "Findings":           "border-tfl/40 bg-tfl/10 text-tfl",
  "Events":             "border-adam/40 bg-adam/10 text-adam",
  "Interventions":      "border-sdtm/40 bg-sdtm/10 text-sdtm",
  "Relationships":      "border-[#3568c840] bg-[#3568c812] text-[#3568c8]",
  "Trial Design":       "border-[#c44b2840] bg-[#c44b2810] text-[#c44b28]",
  "ADaM — Subject-Level": "border-crf/40 bg-crf/10 text-crf",
  "ADaM — BDS":         "border-tfl/40 bg-tfl/10 text-tfl",
  "ADaM — OCCDS":       "border-adam/40 bg-adam/10 text-adam",
};
function ClassChip({ cls }: { cls: string }) {
  const color = CLASS_COLORS[cls] ?? "border-line/70 bg-raise text-dim";
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[9px] font-medium ${color}`}>
      {cls}
    </span>
  );
}

/* ── Variables popup ────────────────────────────────────────── */
function VariablesPopup({ domain, onClose }: { domain: DomainRow; onClose: () => void }) {
  const { db, study } = useStore();
  const vars = useMemo(() => {
    if (!db) return [];
    return all<VariableRow>(db, "SELECT * FROM variables WHERE study_id=? AND domain=? AND standard=? ORDER BY role, name", [study, domain.code, domain.standard]);
  }, [db, study, domain.code, domain.standard]);

  const keySet = new Set(
    (domain.key_variables ?? "").split(",").map((k) => k.trim()).filter(Boolean)
  );

  const roleOrder = ["IDENTIFIER", "TOPIC", "QUALIFIER", "TIMING"];
  const grouped = roleOrder.reduce<Record<string, VariableRow[]>>((acc, r) => {
    acc[r] = vars.filter((v) => v.role === r);
    return acc;
  }, {});
  const others = vars.filter((v) => !roleOrder.includes(v.role));

  return (
    <Modal onClose={onClose} width={820}>
      <div className="border-b border-line px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="font-mono text-[20px] font-bold"
                style={{ color: domain.standard === "SDTM" ? "#0b9e84" : "#b8720a" }}
              >
                {domain.code}
              </span>
              <PurposeBadge purpose={domain.purpose} />
              <ClassChip cls={domain.cls} />
              <StatusBadge status={domain.status} small />
            </div>
            <p className="mt-0.5 text-[12.5px] text-dim">{domain.name}</p>
            <p className="mt-1 font-mono text-[10px] text-faint">
              {domain.structure}
              {domain.key_variables && (
                <> · keys: <span className="font-semibold text-sdtm">{domain.key_variables}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md border border-line/70 p-1.5 text-dim hover:text-ink" title="Close">
            <IconX size={13} />
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        <p className="mb-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
          Variables · {vars.length} total
        </p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="tbl min-w-[680px]">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Label</th>
                <th>Role</th>
                <th>Origin</th>
                <th>Type/Len</th>
                <th>Codelist</th>
                <th>Core</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...roleOrder, "OTHER"].flatMap((role) => {
                const group = role === "OTHER" ? others : (grouped[role] ?? []);
                return group.map((v) => (
                  <tr key={v.id} className={keySet.has(v.name) ? "is-active" : ""}>
                    <td>
                      <span className="font-mono text-[11.5px] font-bold" style={{ color: domain.standard === "SDTM" ? "#0b9e84" : "#b8720a" }}>
                        {v.name}
                      </span>
                      {keySet.has(v.name) && (
                        <span className="ml-1.5 rounded-sm bg-sdtm/15 px-1 font-mono text-[8px] font-bold text-sdtm">KEY</span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate text-[11.5px] text-ink" title={v.label}>{v.label}</td>
                    <td>{v.role && <RoleBadge role={v.role} />}</td>
                    <td><OriginBadge origin={v.origin} /></td>
                    <td className="font-mono text-[11px] text-dim">{v.type}{v.length > 0 ? `(${v.length})` : ""}</td>
                    <td>
                      {v.codelist
                        ? <span className="rounded-sm border border-crf/40 bg-crf/10 px-1.5 py-px font-mono text-[9.5px] text-crf">{v.codelist}</span>
                        : <span className="text-faint">—</span>}
                    </td>
                    <td className="font-mono text-[10px] text-dim">{v.core || "—"}</td>
                    <td><StatusBadge status={v.status} small /></td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* ── Main view ──────────────────────────────────────────────── */
export default function Domains() {
  const { db, v, study, transitionStatus } = useStore();
  const [std, setStd] = useState<"ALL" | "CDASH" | "SDTM" | "ADaM">("ALL");
  const [status, setStatus] = useState<"ALL" | Status>("ALL");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<DomainRow | null>(null);
  const [reason, setReason] = useState("");
  const [varsPopup, setVarsPopup] = useState<DomainRow | null>(null);

  const rows = useMemo(() => {
    if (!db) return [];
    return all<DomainRow>(
      db,
      `SELECT d.* FROM domains d
       WHERE d.study_id=?
         AND EXISTS (
           SELECT 1 FROM variables v
           WHERE v.study_id=d.study_id AND v.standard=d.standard AND v.domain=d.code
         )
       ORDER BY d.standard, d.code`,
      [study],
    );
  }, [db, v, study]);

  const filtered = rows.filter((r) => {
    if (std !== "ALL" && r.standard !== std) return false;
    if (status !== "ALL" && r.status !== status) return false;
    const qq = q.trim().toLowerCase();
    if (qq && !`${r.code} ${r.name} ${r.description} ${r.cls}`.toLowerCase().includes(qq)) return false;
    return true;
  });

  if (!db) return null;

  return (
    <div className="px-4 py-3 sm:px-6">
      <PageHeader
        icon={<IconLayers size={18} />}
        title="Domain Registry"
        subtitle="CDASH, SDTM & ADaM datasets — structure, class, purpose, key variables and lifecycle status."
      >
        <Seg options={["ALL", "CDASH", "SDTM", "ADaM"] as const} value={std} onChange={(s) => setStd(s)} />
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search domain, class…"
            className="field-input w-[200px] sm:w-[240px] pl-8 font-mono text-[11.5px]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "ALL" | Status)}
          className="field-input w-[130px] font-mono text-[11px]"
        >
          <option value="ALL">ALL STATUS</option>
          {(["DRAFT", "IN REVIEW", "ACTIVE", "DEPRECATED"] as Status[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[10px] text-faint">
          <span className="font-semibold text-ink">{filtered.length}</span> of {rows.length} domains
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel shadow-sm">
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Name / Description</th>
              <th>Purpose</th>
              <th>Class / Structure</th>
              <th>Key Variables</th>
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
              const keyVars = (r.key_variables ?? "").split(",").map((k) => k.trim()).filter(Boolean);
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setVarsPopup(r)}
                  title="Click to view all variables"
                >
                  <td>
                    <span className="font-mono text-[13px] font-bold" style={{ color: r.standard === "CDASH" ? "#b8720a" : r.standard === "SDTM" ? "#0b9e84" : "#c44b28" }}>
                      {r.code}
                    </span>
                    <span className="mt-0.5 block font-mono text-[8.5px] text-faint">{r.standard}</span>
                  </td>
                  <td>
                    <span className="text-ink font-medium">{r.name}</span>
                    <span className="mt-0.5 block max-w-[280px] truncate text-[10.5px] text-faint">{r.description}</span>
                  </td>
                  <td><PurposeBadge purpose={r.purpose ?? (r.standard === "SDTM" ? "Tabulation" : "Analysis")} /></td>
                  <td className="max-w-[200px]">
                    <ClassChip cls={r.cls} />
                    <span className="mt-0.5 block truncate text-[10px] text-faint">{r.structure}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {keyVars.slice(0, 3).map((k) => (
                        <span key={k} className="rounded-sm border border-sdtm/35 bg-sdtm/8 px-1.5 py-px font-mono text-[9px] font-semibold text-sdtm">
                          {k}
                        </span>
                      ))}
                      {keyVars.length > 3 && (
                        <span className="font-mono text-[9px] text-faint">+{keyVars.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="font-mono text-[12px] tabular text-ink font-semibold">{nvars}</td>
                  <td><VerChip v={r.version} /></td>
                  <td><StatusBadge status={r.status} small /></td>
                  <td className="whitespace-nowrap font-mono text-[10px] text-faint">
                    {fmtDate(r.updated_at)}
                    <span className="block">{r.updated_by.split("—")[0].trim()}</span>
                  </td>
                  <td>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModal(r); setReason(""); }}
                      className="rounded-md border border-line/70 px-2.5 py-1 font-mono text-[9.5px] text-dim transition-colors hover:border-sdtm/50 hover:text-sdtm"
                      title="Transition lifecycle status"
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

      {/* Variables popup */}
      {varsPopup && <VariablesPopup domain={varsPopup} onClose={() => setVarsPopup(null)} />}

      {/* Status transition modal */}
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
