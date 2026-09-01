import { useEffect, useMemo, useState } from "react";
import type { AuditRow, CodelistRow, CtTermRow, Status, VariableRow, VarVersionRow, VlmRow } from "../data/types";
import { all } from "../db/sqlite";
import { useStore } from "../state/store";
import {
  fmtDate, fmtDateTime, IconHistory, IconShield, PageHeader, ReasonModal, Seg, StatusBadge, StatusModal, VerChip,
} from "../components/gxp";
import { IconPlus, IconSearch, IconX, Modal, OriginBadge, RoleBadge } from "../components/ui";

const EMPTY_FORM = { standard: "SDTM", domain: "", name: "", label: "", type: "Char", length: 8, role: "QUALIFIER", origin: "CRF", derivation: "", codelist: "" };

/* ── Codelist popup ─────────────────────────────────────────── */
function CodelistPopup({ code, onClose }: { code: string; onClose: () => void }) {
  const { db } = useStore();
  const meta = useMemo(() => db ? all<CodelistRow>(db, "SELECT * FROM ct_codelists WHERE code=?", [code])[0] ?? null : null, [db, code]);
  const terms = useMemo(() => db ? all<CtTermRow>(db, "SELECT * FROM ct_terms WHERE codelist=? ORDER BY order_number", [code]) : [], [db, code]);

  return (
    <Modal onClose={onClose} width={680}>
      <div className="border-b border-line px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[20px] font-bold text-crf">{code}</span>
              {meta && <StatusBadge status={meta.status} small />}
              {meta?.extensible && (
                <span className={`rounded-sm border px-1.5 py-px font-mono text-[9px] ${meta.extensible === "Yes" ? "border-good/40 bg-good/10 text-good" : "border-line bg-raise text-faint"}`}>
                  {meta.extensible === "Yes" ? "extensible" : "fixed"}
                </span>
              )}
            </div>
            {meta && (
              <>
                <p className="mt-0.5 text-[12.5px] font-medium text-dim">{meta.name}</p>
                <p className="mt-0.5 text-[11px] text-faint">{meta.description}</p>
                <p className="mt-1.5 font-mono text-[10px] text-faint">
                  source: <span className="text-ink">{meta.source}</span>
                  {meta.version_date && <> · version: <span className="font-semibold text-ink">{meta.version_date}</span></>}
                  {meta.nci_code && <> · NCI <span className="text-crf">{meta.nci_code}</span></>}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="rounded-md border border-line/70 p-1.5 text-dim hover:text-ink" title="Close">
            <IconX size={13} />
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        <p className="mb-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">Permitted terms · {terms.length}</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="tbl min-w-[580px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Submission Value</th>
                <th>Display Value</th>
                <th>NCI Code</th>
                <th>Definition</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className={t.status === "DEPRECATED" ? "opacity-40" : ""}>
                  <td className="font-mono text-[10px] tabular text-faint">{t.order_number}</td>
                  <td className="font-mono text-[11.5px] font-bold text-ink">{t.submission_value}</td>
                  <td className="text-[11.5px] text-dim">{t.display_value}</td>
                  <td className="font-mono text-[10px] text-crf">{t.nci_code ?? "—"}</td>
                  <td className="max-w-[220px] truncate text-[10.5px] text-faint" title={t.definition}>{t.definition}</td>
                  <td><StatusBadge status={t.status} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* ── Core badge ────────────────────────────────────────────── */
export function CoreBadge({ core }: { core?: string | null }) {
  if (!core) return <span className="text-faint font-mono text-[9px]">—</span>;
  const c = core.toUpperCase();
  if (c === "REQ" || c === "REQUIRED") {
    return (
      <span className="rounded-sm border border-emerald-600/40 bg-emerald-500/12 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-700 whitespace-nowrap" title="Core: Required">
        Req
      </span>
    );
  }
  if (c === "EXP" || c === "EXPECTED") {
    return (
      <span className="rounded-sm border border-sky-600/40 bg-sky-500/12 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-700 whitespace-nowrap" title="Core: Expected">
        Exp
      </span>
    );
  }
  if (c.includes("COND") || c === "R/C") {
    return (
      <span className="rounded-sm border border-amber-600/40 bg-amber-500/12 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-700 whitespace-nowrap" title="Core: Conditional">
        Cond
      </span>
    );
  }
  if (c.includes("PERM")) {
    return (
      <span className="rounded-sm border border-line bg-raise text-dim px-1.5 py-0.5 font-mono text-[9px] font-medium whitespace-nowrap" title={`Core: ${core}`}>
        Perm
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-line bg-raise/60 text-faint px-1.5 py-0.5 font-mono text-[8.5px] whitespace-nowrap" title={`Core: ${core}`}>
      {core.length > 7 ? core.slice(0, 6) + "…" : core}
    </span>
  );
}

export default function Variables() {
  const { db, v, study, transitionStatus, bumpVersion, createVariable, setView, select } = useStore();
  const [std, setStd] = useState<"ALL" | "CDASH" | "SDTM" | "ADaM">("ALL");
  const [status, setStatus] = useState<"ALL" | Status>("ALL");
  const [domain, setDomain] = useState("ALL");
  const [coreFilter, setCoreFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<VariableRow | null>(null);
  const [modal, setModal] = useState<VariableRow | null>(null);
  const [reason, setReason] = useState("");
  const [bump, setBump] = useState<VariableRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createReason, setCreateReason] = useState("");
  const [codelistPopup, setCodelistPopup] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const rows = useMemo(
    () => (db ? all<VariableRow>(db, "SELECT * FROM variables WHERE study_id=? ORDER BY standard, domain, name", [study]) : []),
    [db, v, study],
  );

  const domains = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (std === "ALL" || r.standard === std) {
        s.add(r.domain);
      }
    }
    return [...s].sort();
  }, [rows, std]);

  const filtered = rows.filter((r) => {
    if (std !== "ALL" && r.standard !== std) return false;
    if (status !== "ALL" && r.status !== status) return false;
    if (domain !== "ALL" && r.domain !== domain) return false;
    if (coreFilter !== "ALL") {
      const c = (r.core || "").toUpperCase();
      if (coreFilter === "REQ" && !c.includes("REQ")) return false;
      if (coreFilter === "EXP" && !c.includes("EXP")) return false;
      if (coreFilter === "PERM" && !c.includes("PERM")) return false;
      if (coreFilter === "COND" && !c.includes("COND") && c !== "R/C") return false;
    }
    const qq = q.trim().toLowerCase();
    if (qq && !`${r.domain}.${r.name} ${r.label}`.toLowerCase().includes(qq)) return false;
    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [std, domain, status, coreFilter, q]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const detail = useMemo(() => {
    if (!db || !active) return null;
    const versions = all<VarVersionRow>(db, "SELECT * FROM variable_versions WHERE var_id=? ORDER BY id DESC", [active.id]);
    const audit = all<AuditRow>(db, "SELECT * FROM audit_trail WHERE record=? ORDER BY id DESC LIMIT 6", [`${active.domain}.${active.name}`]);
    const vlm = all<VlmRow>(db, "SELECT * FROM vlm WHERE study_id=? AND name=?", [study, active.name]);
    const terms = active.codelist ? all<CtTermRow>(db, "SELECT * FROM ct_terms WHERE codelist=? AND status='ACTIVE' ORDER BY order_number", [active.codelist]) : [];
    return { versions, audit, vlm, terms };
  }, [db, v, active, study]);

  if (!db) return null;

  const set = (k: string, val: string | number) => setForm((f) => ({ ...f, [k]: val }));
  const canCreate = form.name.trim().length >= 2 && form.label.trim().length >= 3 && form.domain && createReason.trim().length >= 5;

  return (
    <div className="px-4 py-3 sm:px-6">
      <PageHeader
        icon={<IconShield size={18} />}
        title="Variable Catalog"
        subtitle="CDASH collection, SDTM tabulation & ADaM analysis variables under version control."
      >
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, domain: domains[0] ?? "" }); setCreateReason(""); setCreating(true); }}
          className="flex items-center gap-1.5 rounded-md border border-sdtm/45 bg-sdtm/12 px-2.5 py-1 text-[11.5px] font-semibold text-sdtm transition-all hover:-translate-y-px hover:bg-sdtm/20 cursor-pointer"
        >
          <IconPlus size={12} /> New variable
        </button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search OID or label…"
            className="field-input w-[180px] sm:w-[220px] pl-8 font-mono text-[11.5px]"
          />
        </div>
        <Seg options={["ALL", "CDASH", "SDTM", "ADaM"] as const} value={std} onChange={(s) => { setStd(s); setDomain("ALL"); }} />
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="field-input w-[120px] font-mono text-[11px]">
          <option value="ALL">ALL DOMAINS</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={coreFilter} onChange={(e) => setCoreFilter(e.target.value)} className="field-input w-[110px] font-mono text-[11px]">
          <option value="ALL">ALL CORE</option>
          <option value="REQ">Required</option>
          <option value="EXP">Expected</option>
          <option value="PERM">Permissible</option>
          <option value="COND">Conditional</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | Status)} className="field-input w-[120px] font-mono text-[11px]">
          <option value="ALL">ALL STATUS</option>
          {(["DRAFT", "IN REVIEW", "ACTIVE", "DEPRECATED"] as Status[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] text-faint">
          <span className="font-semibold text-ink">{filtered.length}</span> of {rows.length} variables
        </span>
      </div>

      <div className={`overflow-x-auto rounded-lg border border-line bg-panel shadow-sm ${active ? "lg:mr-[396px]" : ""} transition-all`}>
        <table className="tbl min-w-[960px]">
          <thead>
            <tr>
              <th>OID</th>
              <th>Label</th>
              <th>Core</th>
              <th>Role / Origin</th>
              <th>Type</th>
              <th>Codelist</th>
              <th>Version</th>
              <th>Status</th>
              <th>Updated by</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => (
              <tr
                key={r.id}
                onClick={() => setActive(active?.id === r.id ? null : r)}
                className={`cursor-pointer ${active?.id === r.id ? "is-active" : ""}`}
              >
                <td className="font-mono text-[11.5px] font-bold" style={{
                  color: r.standard === "CDASH" ? "#b8720a" : r.standard === "SDTM" ? "#0b9e84" : "#c44b28"
                }}>
                  {r.domain}.{r.name}
                  <span className="mt-0.5 block text-[8.5px] font-medium text-faint">{r.standard}</span>
                </td>
                <td className="max-w-[280px]">
                  <span className="block truncate text-ink font-medium">{r.label}</span>
                  {r.derivation && <span className="mt-0.5 block truncate text-[10px] text-faint" title={r.derivation}>ƒ {r.derivation}</span>}
                </td>
                <td>
                  <CoreBadge core={r.core} />
                </td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {r.role && <RoleBadge role={r.role} />}
                    <OriginBadge origin={r.origin} />
                  </span>
                </td>
                <td className="font-mono text-[11px] text-dim">{r.type}{r.length > 0 ? `(${r.length})` : ""}</td>
                <td>{r.codelist ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCodelistPopup(r.codelist!); }}
                    className="rounded-sm border border-crf/40 bg-crf/10 px-1.5 py-px font-mono text-[9.5px] text-crf transition-colors hover:bg-crf/20 hover:border-crf/60 cursor-pointer font-medium"
                    title={`View codelist: ${r.codelist}`}
                  >
                    {r.codelist}
                  </button>
                ) : <span className="text-faint">—</span>}</td>
                <td><VerChip v={r.version} /></td>
                <td><StatusBadge status={r.status} small /></td>
                <td className="whitespace-nowrap font-mono text-[9.5px] text-faint">{r.updated_by.split("—")[0].trim()}<span className="block">{fmtDate(r.updated_at)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-line bg-raise/40 px-4 py-2.5">
            <span className="font-mono text-[11px] text-dim">
              Showing <span className="font-semibold text-ink">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-ink">{filtered.length}</span> variables
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button
                disabled={safePage === 1}
                onClick={() => setPage(1)}
                className="rounded border border-line bg-panel px-2 py-1 text-dim hover:bg-raise disabled:opacity-35 cursor-pointer disabled:cursor-default"
                title="First page"
              >
                «
              </button>
              <button
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-line bg-panel px-2.5 py-1 text-dim hover:bg-raise disabled:opacity-35 cursor-pointer disabled:cursor-default"
                title="Previous page"
              >
                ‹ Prev
              </button>
              <span className="px-2 font-semibold text-ink">
                {safePage} / {totalPages}
              </span>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-line bg-panel px-2.5 py-1 text-dim hover:bg-raise disabled:opacity-35 cursor-pointer disabled:cursor-default"
                title="Next page"
              >
                Next ›
              </button>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage(totalPages)}
                className="rounded border border-line bg-panel px-2 py-1 text-dim hover:bg-raise disabled:opacity-35 cursor-pointer disabled:cursor-default"
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── detail drawer ── */}
      {active && detail && (
        <aside className="drawer fixed bottom-0 right-0 top-0 z-40 w-full max-w-[392px] overflow-y-auto border-l border-line bg-panel shadow-2xl shadow-slate-400/50">
          <div className="sticky top-0 z-10 border-b border-line bg-panel/95 px-5 py-4 backdrop-blur-sm shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[17px] font-bold" style={{
                  color: active.standard === "CDASH" ? "#b8720a" : active.standard === "SDTM" ? "#0b9e84" : "#c44b28"
                }}>
                  {active.domain}.{active.name}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-dim">{active.label}</p>
              </div>
              <button onClick={() => setActive(null)} className="rounded-md border border-line p-1.5 text-dim hover:text-ink cursor-pointer"><IconX size={13} /></button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={active.status} small />
              <VerChip v={active.version} />
              <CoreBadge core={active.core} />
              {active.role && <RoleBadge role={active.role} />}
              <OriginBadge origin={active.origin} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setModal(active); setReason(""); }} className="flex-1 rounded-md border border-sdtm/40 bg-sdtm/10 px-3 py-1.5 text-[11px] font-semibold text-sdtm hover:bg-sdtm/18 cursor-pointer">
                Transition status
              </button>
              <button onClick={() => setBump(active)} className="flex-1 rounded-md border border-[#7a4f9b40] bg-[#7a4f9b10] px-3 py-1.5 text-[11px] font-semibold text-[#7a4f9b] hover:bg-[#7a4f9b1c] cursor-pointer">
                New version
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5">
            {/* spec */}
            <section>
              <h4 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">Specification</h4>
              <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1.5 text-[11.5px]">
                <dt className="text-faint">Standard</dt><dd className="font-mono text-ink font-semibold">{active.standard} · {active.domain}</dd>
                <dt className="text-faint">Type / Length</dt><dd className="font-mono text-ink">{active.type}{active.length}{active.format ? ` · format ${active.format}` : ""}</dd>
                <dt className="text-faint">Core</dt><dd className="font-mono text-ink font-semibold">{active.core || "—"}</dd>
                <dt className="text-faint">Codelist</dt>
                <dd className="font-mono text-ink">
                  {active.codelist ? (
                    <button
                      onClick={() => setCodelistPopup(active.codelist!)}
                      className="text-crf hover:underline font-semibold cursor-pointer"
                    >
                      {active.codelist} →
                    </button>
                  ) : "—"}
                </dd>
                <dt className="text-faint">Effective</dt><dd className="font-mono text-ink">{fmtDate(active.effective_from)}</dd>
                <dt className="text-faint">Change reason</dt><dd className="text-dim">{active.change_reason || "—"}</dd>
              </dl>
              {active.derivation && (
                <p className="mt-2.5 rounded-md border border-adam/25 bg-adam/8 px-3 py-2 text-[11px] leading-relaxed text-dim">
                  <span className="mr-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-adam">derivation</span>
                  {active.derivation}
                </p>
              )}
              <button
                onClick={() => { select({ kind: active.standard === "SDTM" ? "sdtm" : "adam", id: `${active.domain}.${active.name}` }, true); }}
                className="mt-2.5 font-mono text-[10.5px] text-sdtm underline-offset-2 hover:underline cursor-pointer"
              >
                open in trace explorer →
              </button>
            </section>

            {/* permitted terms */}
            {detail.terms.length > 0 && (
              <section>
                <h4 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">Permitted terms · {active.codelist}</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.terms.map((t) => (
                    <span key={t.id} title={t.definition} className="rounded-sm border border-crf/35 bg-crf/10 px-2 py-1 font-mono text-[10px] text-crf font-medium">{t.submission_value}</span>
                  ))}
                </div>
              </section>
            )}

            {/* VLM */}
            <section>
              <h4 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">Value-level overrides · {detail.vlm.length}</h4>
              {detail.vlm.length === 0 ? (
                <p className="mt-2 text-[11px] text-faint">No VLM records — variable-level metadata applies everywhere.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {detail.vlm.map((vm) => (
                    <li key={vm.id} className="rounded-md border border-tfl/30 bg-tfl/8 px-3 py-2">
                      <p className="font-mono text-[10px] text-tfl font-semibold">WHEN {vm.when_clause}{vm.where_clause !== "—" ? ` · WHERE ${vm.where_clause}` : ""}</p>
                      <p className="mt-1 text-[10.5px] text-dim">{vm.label} — {vm.type}{vm.length}, origin {vm.origin}</p>
                      <p className="mt-0.5 text-[10px] text-faint">{vm.method}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* version history */}
            <section>
              <h4 className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                <IconHistory size={12} /> Version history · {detail.versions.length}
              </h4>
              {detail.versions.length === 0 ? (
                <p className="mt-2 text-[11px] text-faint">Baseline version — no superseded snapshots yet.</p>
              ) : (
                <ul className="mt-2.5 flex flex-col">
                  {detail.versions.map((vv, i) => (
                    <li key={vv.id} className="relative border-l border-line pb-3 pl-3.5 last:pb-0">
                      <span className="absolute -left-[4px] top-1 h-2 w-2 rounded-full" style={{ background: i === 0 ? "#7a4f9b" : "#a0b2be" }} />
                      <p className="font-mono text-[10.5px]">
                        <span className="font-semibold text-[#7a4f9b]">v{vv.version}</span>
                        <StatusBadge status={vv.status} small />
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-dim">{vv.change_reason}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-faint">{vv.created_by} · {fmtDate(vv.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* record audit */}
            <section className="pb-6">
              <h4 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">Record audit trail</h4>
              {detail.audit.length === 0 ? (
                <p className="mt-2 text-[11px] text-faint">No audited changes for this record yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {detail.audit.map((a) => (
                    <li key={a.id} className="rounded-md border border-line bg-raise/60 px-2.5 py-2">
                      <p className="font-mono text-[9.5px]">
                        <span className="font-semibold text-dim">{a.action}</span>
                        <span className="text-faint"> · {a.field}{a.field !== "—" ? `: ${a.old_value} → ${a.new_value}` : ""}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-faint">{a.actor} · {fmtDateTime(a.ts)}</p>
                      <p className="mt-0.5 text-[10px] text-dim">“{a.reason}”</p>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setView("audit")} className="mt-2 font-mono text-[10px] text-sdtm underline-offset-2 hover:underline cursor-pointer">full audit trail →</button>
            </section>
          </div>
        </aside>
      )}

      {/* modals */}
      {modal && (
        <StatusModal
          entity="variable"
          record={`${modal.domain}.${modal.name}`}
          current={modal.status}
          reason={reason}
          setReason={setReason}
          onCancel={() => setModal(null)}
          onConfirm={(to, rsn) => {
            transitionStatus("variables", modal.id, "id", to, rsn);
            setActive(null);
            setModal(null);
          }}
        />
      )}
      {bump && (
        <ReasonModal
          title={`New version — ${bump.domain}.${bump.name}`}
          hint="Bumps the minor version (e.g. v1.2 → v1.3), snapshots the current state into the version ledger and writes an audit event."
          submitLabel="Create version"
          onCancel={() => setBump(null)}
          onSubmit={(rsn) => { bumpVersion(bump.id, rsn); setBump(null); }}
        />
      )}
      {creating && (
        <Modal onClose={() => setCreating(false)} width={560}>
          <h3 className="font-display text-[16px] font-bold">New variable</h3>
          <p className="mt-1 text-[11.5px] text-dim">Created as <StatusBadge status="DRAFT" small /> v1.0 · will need review and an electronic signature before activation.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Standard
              <select className="field-input mt-1" value={form.standard} onChange={(e) => set("standard", e.target.value)}>
                <option>SDTM</option><option>ADaM</option>
              </select>
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Domain
              <select className="field-input mt-1" value={form.domain} onChange={(e) => set("domain", e.target.value)}>
                {domains.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Name
              <input className="field-input mt-1 font-mono uppercase" placeholder="TRTEMFL" value={form.name} onChange={(e) => set("name", e.target.value.toUpperCase())} />
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Type
              <select className="field-input mt-1" value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option>Char</option><option>Num</option>
              </select>
            </label>
            <label className="col-span-2 text-[10px] font-mono uppercase tracking-wide text-faint">Label
              <input className="field-input mt-1" placeholder="Treatment-Emergent Flag" value={form.label} onChange={(e) => set("label", e.target.value)} />
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Length
              <input type="number" className="field-input mt-1" value={form.length} onChange={(e) => set("length", Number(e.target.value))} />
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Role (SDTM)
              <select className="field-input mt-1" value={form.role} onChange={(e) => set("role", e.target.value)}>
                {["QUALIFIER", "TOPIC", "TIMING", "IDENTIFIER", ""].map((r) => <option key={r || "none"} value={r}>{r || "n/a (ADaM)"}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Origin
              <select className="field-input mt-1" value={form.origin} onChange={(e) => set("origin", e.target.value)}>
                {["CRF", "ASSIGNED", "DERIVED", "PREDECESSOR", "SDTM"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Codelist
              <select className="field-input mt-1" value={form.codelist} onChange={(e) => set("codelist", e.target.value)}>
                <option value="">— none —</option>
                {all<{ code: string }>(db, "SELECT code FROM ct_codelists ORDER BY code").map((c) => <option key={c.code}>{c.code}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-[10px] font-mono uppercase tracking-wide text-faint">Derivation rule
              <input className="field-input mt-1" placeholder="'Y' if ASTDT ≥ RFSTDTC" value={form.derivation} onChange={(e) => set("derivation", e.target.value)} />
            </label>
          </div>
          <textarea value={createReason} onChange={(e) => setCreateReason(e.target.value)} rows={2} placeholder="Business reason for adding this variable (audited)…" className="field-input mt-3 resize-none" />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded-md border border-line/80 px-4 py-2 text-[12px] text-dim hover:text-ink">Cancel</button>
            <button
              disabled={!canCreate}
              onClick={() => {
                createVariable({ study_id: study, standard: form.standard, domain: form.domain, name: form.name.trim().toUpperCase(), label: form.label.trim(), type: form.type, length: Number(form.length), role: form.role, origin: form.origin, derivation: form.derivation.trim(), codelist: form.codelist || null }, createReason.trim());
                setCreating(false);
              }}
              className="rounded-md bg-sdtm px-4 py-2 text-[12px] font-semibold text-[#07141a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create draft
            </button>
          </div>
        </Modal>
      )}
      {/* Codelist popup */}
      {codelistPopup && <CodelistPopup code={codelistPopup} onClose={() => setCodelistPopup(null)} />}
    </div>
  );
}
