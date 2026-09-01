import { useMemo, useState } from "react";
import type { CrfFieldRow, CrfPageRow, StudyRow, VariableRow } from "../data/types";
import { all, count, nowIso, run } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, IconFile, PageHeader, StatusBadge } from "../components/gxp";
import { IconChevron, IconPlus, IconSearch, IconX, Modal } from "../components/ui";

export default function CrfRegistry() {
  const { db, v, study, transitionStatus, mutate, toast } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Registration modal state
  const [registering, setRegistering] = useState(false);
  const [newPageCode, setNewPageCode] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [newFormType, setNewFormType] = useState("Visit Form");
  const [newRepeating, setNewRepeating] = useState<"No" | "Yes">("No");
  const [importCdash, setImportCdash] = useState(true);
  const [newReason, setNewReason] = useState("");

  // Add field modal state
  const [addingField, setAddingField] = useState<string | null>(null);
  const [fOid, setFOid] = useState("");
  const [fLabel, setFLabel] = useState("");
  const [fDataType, setFDataType] = useState<"text" | "integer" | "float" | "date" | "time" | "coded">("text");
  const [fCodelist, setFCodelist] = useState("");
  const [fRequired, setFRequired] = useState(false);
  const [fReason, setFReason] = useState("");

  const studyRow = useMemo(
    () => (db ? all<StudyRow>(db, "SELECT * FROM studies LIMIT 1")[0] : undefined),
    [db, v],
  );

  const pages = useMemo(
    () => (db ? all<CrfPageRow>(db, "SELECT * FROM crf_pages WHERE study_id=? ORDER BY page_code", [study]) : []),
    [db, v, study],
  );

  const cdashDomains = useMemo(() => {
    if (!db) return [];
    return all<{ code: string; name: string }>(db, "SELECT code, name FROM domains WHERE standard='CDASH' ORDER BY code");
  }, [db, v]);

  if (!db) return null;

  const filteredPages = pages.filter((p) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return `${p.page_code} ${p.page_name} ${p.form_type}`.toLowerCase().includes(qq);
  });

  const handleRegisterPage = () => {
    if (!newPageCode.trim() || !newPageName.trim() || !newReason.trim()) return;
    const code = newPageCode.trim().toUpperCase();
    const pid = `${study}:${code}`;
    const crfName = studyRow?.crf_name ?? "Master eCRF Library";

    mutate((d) => {
      run(d, `INSERT INTO crf_pages VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        pid, study, crfName, "v2.1", code, newPageName.trim(), newFormType, newRepeating, "ACTIVE", nowIso(),
      ]);

      if (importCdash) {
        const cdashVars = all<VariableRow>(d, "SELECT * FROM variables WHERE standard='CDASH' AND domain=? ORDER BY id", [code]);
        for (const cv of cdashVars) {
          const oid = `${code}.${cv.name}`;
          const dType = cv.type.toLowerCase().includes("num") ? "integer" : "text";
          run(d, `INSERT OR IGNORE INTO crf_fields VALUES (?,?,?,?,?,?,?,?,?)`, [
            oid, study, pid, cv.label, dType, cv.core === "Req" ? 1 : 0, cv.codelist, "ACTIVE", "2.1",
          ]);
          // Map to SDTM target if exists
          const sdtmTarget = all<{ name: string }>(d, "SELECT name FROM variables WHERE standard='SDTM' AND domain=? AND name=?", [code, cv.name]);
          if (sdtmTarget.length > 0) {
            run(d, `INSERT OR IGNORE INTO map_c2s (study_id, src, tgt, method) VALUES (?,?,?,?)`, [
              study, oid, `${code}.${cv.name}`, "CDASH to SDTM specification mapping",
            ]);
          }
        }
      }
    }, {
      action: "CREATE",
      entity: "crf_pages",
      record: `${code} · ${newPageName.trim()}`,
      field: "—",
      old_value: "",
      new_value: "ACTIVE",
      reason: newReason.trim(),
      study_id: study,
    });

    toast("success", `CRF Page ${code} (${newPageName.trim()}) registered successfully.`);
    setRegistering(false);
    setNewPageCode("");
    setNewPageName("");
    setNewReason("");
    setOpen(pid);
  };

  const handleAddField = () => {
    if (!addingField || !fOid.trim() || !fLabel.trim() || !fReason.trim()) return;
    const oid = fOid.trim().toUpperCase();
    mutate((d) => {
      run(d, `INSERT INTO crf_fields VALUES (?,?,?,?,?,?,?,?,?)`, [
        oid, study, addingField, fLabel.trim(), fDataType, fRequired ? 1 : 0, fCodelist.trim() || null, "ACTIVE", "2.1",
      ]);
    }, {
      action: "CREATE",
      entity: "crf_fields",
      record: `${addingField} · ${oid}`,
      field: "—",
      old_value: "",
      new_value: "ACTIVE",
      reason: fReason.trim(),
      study_id: study,
    });

    toast("success", `Field ${oid} added to page.`);
    setAddingField(null);
    setFOid("");
    setFLabel("");
    setFCodelist("");
    setFReason("");
  };

  return (
    <div className="px-4 py-3 sm:px-6">
      <PageHeader
        icon={<IconFile size={18} />}
        title="CRF Registry"
        subtitle="eCRF forms & data collection fields governed by CDASH IG v2.3 standards with direct SDTM mapping."
      >
        <button
          onClick={() => { setRegistering(true); setNewReason(""); }}
          className="flex items-center gap-1.5 rounded-md border border-crf/45 bg-crf/12 px-3 py-1.5 text-[11.5px] font-semibold text-crf transition-all hover:-translate-y-px hover:bg-crf/20 cursor-pointer"
        >
          <IconPlus size={12} /> Register Page
        </button>
      </PageHeader>

      {/* CRF dossier summary */}
      {studyRow && (
        <div className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-crf/25 bg-crf/6 px-4 py-2.5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">CRF library</p>
            <p className="font-display text-[15px] font-bold text-crf">{studyRow.crf_name}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Version</p>
            <p className="mt-0.5"><span className="rounded-sm border border-crf/40 bg-crf/12 px-1.5 py-px font-mono text-[11px] font-semibold text-crf">{studyRow.crf_version}</span></p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Pages / fields</p>
            <p className="mt-0.5 font-mono text-[11.5px] tabular text-ink font-semibold">{pages.length} pages · {count(db, "SELECT COUNT(*) AS n FROM crf_fields WHERE study_id=?", [study])} fields</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Reference Standard</p>
            <p className="mt-0.5 font-mono text-[11.5px] font-bold text-crf">
              CDASH IG v2.3 <span className="font-normal text-dim text-[10.5px]">(Data Collection) → {studyRow.sdtm_ig} Target</span>
            </p>
          </div>
          <div className="ml-auto">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Effective</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink">{fmtDate("2026-03-27")}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages or forms…"
            className="field-input w-[220px] sm:w-[260px] pl-8 font-mono text-[11.5px]"
          />
        </div>
        <span className="ml-auto font-mono text-[10px] text-faint">
          <span className="font-semibold text-ink">{filteredPages.length}</span> of {pages.length} forms
        </span>
      </div>

      {/* Pages list */}
      <div className="flex flex-col gap-2.5">
        {filteredPages.map((p) => {
          const fields = all<CrfFieldRow>(db, "SELECT * FROM crf_fields WHERE page_id=? ORDER BY oid", [p.page_id]);
          const isOpen = open === p.page_id;
          return (
            <div key={p.page_id} className={`overflow-hidden rounded-lg border bg-panel shadow-xs transition-colors ${isOpen ? "border-crf/50" : "border-line"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : p.page_id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-raise/60 cursor-pointer"
              >
                <IconChevron size={11} className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                <span className="w-12 font-mono text-[12.5px] font-bold text-crf">{p.page_code}</span>
                <span className="min-w-[140px] flex-1 text-[12.5px] font-semibold text-ink">{p.page_name}</span>
                <span className="rounded-sm border border-line bg-raise px-1.5 py-0.5 font-mono text-[9.5px] text-dim">{p.form_type}</span>
                <span className="font-mono text-[10px] text-faint">repeating: {p.repeating}</span>
                <span className="rounded-sm bg-crf/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-crf">{fields.length} fields</span>
                <StatusBadge status={p.status} small />
              </button>

              {isOpen && (
                <div className="anim-fade border-t border-line bg-raise/20 px-4 py-3">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-dim">
                      {fields.length} Registered Fields (CDASH)
                    </span>
                    <button
                      onClick={() => { setAddingField(p.page_id); setFOid(`${p.page_code}.`); setFReason(""); }}
                      className="flex items-center gap-1 rounded-sm border border-crf/40 bg-crf/10 px-2 py-1 font-mono text-[10px] font-semibold text-crf hover:bg-crf/20 cursor-pointer"
                    >
                      <IconPlus size={11} /> Add field
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded border border-line bg-panel">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>OID</th>
                          <th>Label</th>
                          <th>Data type</th>
                          <th>Codelist</th>
                          <th>Required</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>SDTM Mapping</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => {
                          const nMap = count(db, "SELECT COUNT(*) AS n FROM map_c2s WHERE study_id=? AND src=?", [study, f.oid]);
                          return (
                            <tr key={f.oid}>
                              <td className="font-mono text-[11px] font-bold text-crf">{f.oid}</td>
                              <td className="text-[11.5px] text-ink font-medium">{f.label}</td>
                              <td className="font-mono text-[10.5px] text-dim">{f.data_type}</td>
                              <td>{f.codelist ? <span className="rounded-sm border border-crf/40 bg-crf/10 px-1.5 py-px font-mono text-[9.5px] text-crf font-semibold">{f.codelist}</span> : <span className="text-faint">—</span>}</td>
                              <td>
                                {f.required ? <span className="font-mono text-[9.5px] font-bold text-emerald-700">YES</span> : <span className="font-mono text-[9.5px] text-faint">no</span>}
                              </td>
                              <td className="font-mono text-[10px] text-dim">v{f.version}</td>
                              <td><StatusBadge status={f.status} small /></td>
                              <td className="font-mono text-[10px]">
                                {nMap > 0
                                  ? <span className="font-semibold text-sdtm">→ {nMap} SDTM Target</span>
                                  : <span className="text-faint">not mapped</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2.5 flex justify-end">
                    <button
                      onClick={() => transitionStatus("crf_pages", p.page_id, "page_id", p.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE", p.status === "ACTIVE" ? "Page retired in CRF amendment" : "Page re-activated after amendment review")}
                      className="rounded-md border border-line/70 px-2.5 py-1 font-mono text-[9.5px] text-dim transition-colors hover:border-crf/60 hover:text-crf cursor-pointer"
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

      {/* ── Register Page Modal ── */}
      {registering && (
        <Modal onClose={() => setRegistering(false)} width={540}>
          <div className="border-b border-line px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[16px] font-bold text-ink">Register CRF Page / Form</h3>
                <p className="font-mono text-[10px] text-faint">Reference Standard: CDASH IG v2.3</p>
              </div>
              <button onClick={() => setRegistering(false)} className="rounded-md border border-line p-1 text-dim hover:text-ink cursor-pointer"><IconX size={13} /></button>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 px-5 py-4">
            {/* Quick Pick from CDASH */}
            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Quick Pick CDASH Domain:</label>
              <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto rounded border border-line p-1.5 bg-raise/20">
                {cdashDomains.slice(0, 20).map((d) => (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => { setNewPageCode(d.code); setNewPageName(d.name); }}
                    className="rounded-sm border border-line bg-panel px-1.5 py-0.5 font-mono text-[9.5px] text-dim hover:border-crf hover:text-crf cursor-pointer"
                  >
                    {d.code} · {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Page Code (e.g. DS, MH)</label>
                <input
                  value={newPageCode}
                  onChange={(e) => setNewPageCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DS"
                  className="field-input font-mono text-[11.5px] font-bold text-crf uppercase w-full"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Repeating / Log</label>
                <select
                  value={newRepeating}
                  onChange={(e) => setNewRepeating(e.target.value as "No" | "Yes")}
                  className="field-input font-mono text-[11px] w-full"
                >
                  <option value="No">No (Single record)</option>
                  <option value="Yes">Yes (Repeating / Log)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Form / Page Title</label>
              <input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g. Disposition Event Log"
                className="field-input text-[12px] w-full"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Form Type</label>
              <select
                value={newFormType}
                onChange={(e) => setNewFormType(e.target.value)}
                className="field-input font-mono text-[11px] w-full"
              >
                <option value="Visit Form">Visit Form (scheduled visit questionnaire)</option>
                <option value="Log / Repeating Form">Log / Repeating Form (e.g. AEs, ConMeds)</option>
                <option value="Single Event Form">Single Event Form (e.g. Enrollment, Demographics)</option>
                <option value="Common / Unscheduled">Common / Unscheduled Assessment</option>
              </select>
            </div>

            <div className="rounded border border-crf/30 bg-crf/6 p-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importCdash}
                  onChange={(e) => setImportCdash(e.target.checked)}
                  className="rounded text-crf focus:ring-crf"
                />
                <span className="text-[12px] font-semibold text-ink">
                  Auto-import standard fields from CDASH IG ({newPageCode || "Domain"})
                </span>
              </label>
              <p className="mt-1 font-mono text-[10px] text-dim pl-5">
                Automatically registers standard CDASH prompt variables and establishes mappings to SDTM target.
              </p>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">GxP Change Reason (required)</label>
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Protocol amendment 2 adds disposition page"
                className="field-input text-[11.5px] w-full"
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setRegistering(false)}
                className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-dim hover:bg-raise cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newPageCode.trim() || !newPageName.trim() || !newReason.trim()}
                onClick={handleRegisterPage}
                className="rounded-md border border-crf/60 bg-crf px-4 py-1.5 font-mono text-[11px] font-bold text-white shadow-xs hover:bg-crf/90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                Register Page
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Field Modal ── */}
      {addingField && (
        <Modal onClose={() => setAddingField(null)} width={500}>
          <div className="border-b border-line px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[16px] font-bold text-ink">Add Field to {addingField}</h3>
                <p className="font-mono text-[10px] text-faint">CDASH-compliant data collection field</p>
              </div>
              <button onClick={() => setAddingField(null)} className="rounded-md border border-line p-1 text-dim hover:text-ink cursor-pointer"><IconX size={13} /></button>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Field OID</label>
                <input
                  value={fOid}
                  onChange={(e) => setFOid(e.target.value.toUpperCase())}
                  placeholder="e.g. DM.MARISTAT"
                  className="field-input font-mono text-[11.5px] font-bold text-crf uppercase w-full"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Data Type</label>
                <select
                  value={fDataType}
                  onChange={(e) => setFDataType(e.target.value as any)}
                  className="field-input font-mono text-[11px] w-full"
                >
                  <option value="text">text (string)</option>
                  <option value="integer">integer (number)</option>
                  <option value="float">float (decimal)</option>
                  <option value="date">date (ISO 8601)</option>
                  <option value="time">time</option>
                  <option value="coded">coded (terminology)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Prompt / Label</label>
              <input
                value={fLabel}
                onChange={(e) => setFLabel(e.target.value)}
                placeholder="e.g. Marital Status"
                className="field-input text-[12px] w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">Codelist (optional)</label>
                <input
                  value={fCodelist}
                  onChange={(e) => setFCodelist(e.target.value.toUpperCase())}
                  placeholder="e.g. MARISTAT"
                  className="field-input font-mono text-[11px] uppercase w-full"
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fRequired}
                    onChange={(e) => setFRequired(e.target.checked)}
                    className="rounded text-crf focus:ring-crf"
                  />
                  <span className="font-mono text-[11px] font-semibold text-ink">Mandatory field</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-dim">GxP Change Reason</label>
              <input
                value={fReason}
                onChange={(e) => setFReason(e.target.value)}
                placeholder="e.g. Adding field per study protocol"
                className="field-input text-[11.5px] w-full"
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setAddingField(null)}
                className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-dim hover:bg-raise cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!fOid.trim() || !fLabel.trim() || !fReason.trim()}
                onClick={handleAddField}
                className="rounded-md border border-crf/60 bg-crf px-4 py-1.5 font-mono text-[11px] font-bold text-white shadow-xs hover:bg-crf/90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                Add Field
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
