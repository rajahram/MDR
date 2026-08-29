import { useMemo, useState } from "react";
import type { CrfFieldRow, CrfPageRow, StudyRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, IconFile, PageHeader, StatusBadge } from "../components/gxp";
import { IconChevron, IconSearch } from "../components/ui";

export default function CrfRegistry() {
  const { db, v, study, setStudy, transitionStatus } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const studies = useMemo(() => (db ? all<StudyRow>(db, "SELECT * FROM studies ORDER BY study_id") : []), [db, v]);
  const studyRow = studies.find((s) => s.study_id === study);
  const pages = useMemo(
    () => (db ? all<CrfPageRow>(db, "SELECT * FROM crf_pages WHERE study_id=? ORDER BY page_code", [study]) : []),
    [db, v, study],
  );

  if (!db) return null;

  const filteredPages = pages.filter((p) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return `${p.page_code} ${p.page_name}`.toLowerCase().includes(qq);
  });

  return (
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconFile size={20} />}
        title="CRF Registry"
        subtitle="Case report forms tracked by name and version — every page and field registered in the MDR, with the OIDs that anchor the CRF → SDTM mappings."
      >
        <div className="seg">
          {studies.map((s) => (
            <button key={s.study_id} className={s.study_id === study ? "on" : ""} onClick={() => { setStudy(s.study_id); setOpen(null); }}>
              {s.study_id}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* CRF dossier */}
      {studyRow && (
        <div className="mb-5 flex flex-wrap items-center gap-x-10 gap-y-3 rounded-lg border border-crf/25 bg-crf/6 px-5 py-4">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">CRF name</p>
            <p className="mt-0.5 font-display text-[17px] font-bold text-crf">{studyRow.crf_name}</p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">Version</p>
            <p className="mt-1"><span className="rounded-sm border border-crf/40 bg-crf/12 px-2 py-0.5 font-mono text-[12px] font-semibold text-crf">{studyRow.crf_version}</span></p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">Effective</p>
            <p className="mt-1 font-mono text-[12px] text-ink">{fmtDate("2025-11-10")}</p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">Pages / fields</p>
            <p className="mt-1 font-mono text-[12px] tabular text-ink">{pages.length} / {count(db, "SELECT COUNT(*) AS n FROM crf_fields WHERE study_id=?", [study])}</p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">Reference IGs</p>
            <p className="mt-1 font-mono text-[12px] text-ink">{studyRow.sdtm_ig} · {studyRow.adam_ig}</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages…" className="field-input w-[240px] pl-8 font-mono text-[11.5px]" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filteredPages.map((p) => {
          const fields = all<CrfFieldRow>(db, "SELECT * FROM crf_fields WHERE page_id=? ORDER BY oid", [p.page_id]);
          const isOpen = open === p.page_id;
          const mapped = count(db, "SELECT COUNT(DISTINCT src) AS n FROM map_c2s WHERE study_id=?", [study]);
          void mapped;
          return (
            <div key={p.page_id} className={`overflow-hidden rounded-lg border bg-deep/60 transition-colors ${isOpen ? "border-crf/40" : "border-line"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : p.page_id)}
                className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-panel/50"
              >
                <IconChevron size={12} className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                <span className="w-14 font-mono text-[13px] font-bold text-crf">{p.page_code}</span>
                <span className="min-w-[160px] flex-1 text-[13px] text-ink">{p.page_name}</span>
                <span className="font-mono text-[10px] text-dim">{p.form_type}</span>
                <span className="font-mono text-[10px] text-faint">repeating: {p.repeating}</span>
                <span className="rounded-sm bg-crf/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-crf">{fields.length} fields</span>
                <StatusBadge status={p.status} small />
              </button>

              {isOpen && (
                <div className="anim-fade border-t border-line/60 bg-panel/30 px-5 py-4">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>OID</th>
                        <th>Label</th>
                        <th>Data type</th>
                        <th>Codelist</th>
                        <th>Required</th>
                        <th>Field ver</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => {
                        const nMap = count(db, "SELECT COUNT(*) AS n FROM map_c2s WHERE study_id=? AND src=?", [study, f.oid]);
                        return (
                          <tr key={f.oid}>
                            <td className="font-mono text-[11px] font-semibold text-ink">{f.oid}</td>
                            <td className="text-[11.5px] text-dim">{f.label}</td>
                            <td className="font-mono text-[10.5px] text-dim">{f.data_type}</td>
                            <td>{f.codelist ? <span className="rounded-sm border border-[#f2ac3c3d] bg-[#f2ac3c10] px-1.5 py-px font-mono text-[9.5px] text-[#f2ac3c]">{f.codelist}</span> : <span className="text-faint">—</span>}</td>
                            <td>
                              {f.required ? <span className="font-mono text-[10px] font-semibold text-crf">YES</span> : <span className="font-mono text-[10px] text-faint">no</span>}
                            </td>
                            <td className="font-mono text-[10px] text-dim">v{f.version}</td>
                            <td><StatusBadge status={f.status} small /></td>
                            <td className="font-mono text-[9.5px]">
                              {nMap > 0
                                ? <span className="text-sdtm">→ {nMap} SDTM</span>
                                : <span className="text-faint">not mapped</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => transitionStatus("crf_pages", p.page_id, "page_id", p.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE", p.status === "ACTIVE" ? "Page retired in CRF amendment" : "Page re-activated after amendment review")}
                      className="rounded-md border border-line/70 px-3 py-1.5 font-mono text-[10px] text-dim transition-colors hover:border-crf/60 hover:text-crf"
                    >
                      {p.status === "ACTIVE" ? "deprecate page" : "activate page"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
