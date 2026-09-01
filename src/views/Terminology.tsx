import { useMemo, useState } from "react";
import type { CodelistRow, CtTermRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, IconTag, PageHeader, ReasonModal, Seg, StatusBadge, StatusModal, VerChip } from "../components/gxp";
import { IconPlus, IconSearch, Modal } from "../components/ui";

export default function Terminology() {
  const { db, v, transitionStatus, mutate, toast, setView } = useStore();
  const [std, setStd] = useState<"ALL" | "CDASH" | "SDTM" | "ADaM">("ALL");
  const [q, setQ] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [termModal, setCtTerm] = useState<CtTermRow | null>(null);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [nSub, setNSub] = useState("");
  const [nDisp, setNDisp] = useState("");
  const [nDef, setNDef] = useState("");
  const [nReason, setNReason] = useState("");

  const codelists = useMemo(
    () => (db ? all<CodelistRow>(db, "SELECT * FROM ct_codelists ORDER BY code") : []),
    [db, v],
  );

  // Pre-index which standards and variables reference each codelist
  const codelistUsageMap = useMemo(() => {
    if (!db) return new Map<string, { standards: Set<string>; vars: { standard: string; domain: string; name: string }[] }>();
    const varRows = all<{ standard: string; domain: string; name: string; codelist: string }>(
      db,
      "SELECT standard, domain, name, codelist FROM variables WHERE codelist IS NOT NULL"
    );
    const map = new Map<string, { standards: Set<string>; vars: { standard: string; domain: string; name: string }[] }>();
    for (const v of varRows) {
      const codes = v.codelist.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
      for (const c of codes) {
        if (!map.has(c)) map.set(c, { standards: new Set(), vars: [] });
        map.get(c)!.standards.add(v.standard);
        map.get(c)!.vars.push({ standard: v.standard, domain: v.domain, name: v.name });
      }
    }
    return map;
  }, [db, v]);

  const getApplicableStandards = (c: CodelistRow): ("CDASH" | "SDTM" | "ADaM")[] => {
    const res = new Set<"CDASH" | "SDTM" | "ADaM">();
    if (c.source?.includes("CDASH")) res.add("CDASH");
    if (c.source?.includes("ADaM")) res.add("ADaM");
    if (c.source?.includes("SDTM")) res.add("SDTM");
    if (res.size === 0) res.add("SDTM");

    const usage = codelistUsageMap.get(c.code);
    if (usage) {
      for (const s of usage.standards) {
        if (s === "CDASH" || s === "SDTM" || s === "ADaM") {
          res.add(s);
        }
      }
    }
    return Array.from(res);
  };

  const filtered = codelists.filter((c) => {
    const applicable = getApplicableStandards(c);
    if (std !== "ALL" && !applicable.includes(std)) return false;
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return `${c.code} ${c.name} ${c.source}`.toLowerCase().includes(qq);
  });

  const code = activeCode ?? filtered[0]?.code ?? null;
  const terms = useMemo(
    () => (db && code ? all<CtTermRow>(db, "SELECT * FROM ct_terms WHERE codelist=? ORDER BY order_number", [code]) : []),
    [db, v, code],
  );
  const meta = codelists.find((c) => c.code === code);
  const activeUsage = meta ? codelistUsageMap.get(meta.code) : null;
  const activeApplicable = meta ? getApplicableStandards(meta) : [];

  if (!db) return null;

  const addTerm = () => {
    if (!code) return;
    const maxOrder = terms.reduce((m, t) => Math.max(m, Number(t.order_number)), 0);
    mutate((d) => {
      d.run(`INSERT INTO ct_terms (codelist, order_number, submission_value, display_value, definition, nci_code, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [code, maxOrder + 10, nSub.trim().toUpperCase(), nDisp.trim(), nDef.trim(), null, "DRAFT", new Date().toISOString()]);
    }, { action: "CREATE", entity: "ct_terms", record: `${code} · ${nSub.trim().toUpperCase()}`, field: "—", old_value: "", new_value: "DRAFT", reason: nReason.trim(), study_id: "GLOBAL" });
    toast("success", `Term “${nSub.trim().toUpperCase()}” added to ${code} as DRAFT.`);
    setAdding(false);
    setNSub(""); setNDisp(""); setNDef(""); setNReason("");
  };

  return (
    <div className="px-4 py-3 sm:px-6">
      <PageHeader
        icon={<IconTag size={18} />}
        title="Controlled Terminology"
        subtitle="CDISC Codelists & permitted terms (2026-03-27) across CDASH, SDTM and ADaM."
      >
        <Seg options={["ALL", "CDASH", "SDTM", "ADaM"] as const} value={std} onChange={(s) => setStd(s)} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* codelist list */}
        <div className="rounded-lg border border-line bg-panel shadow-sm">
          <div className="border-b border-line p-3">
            <div className="relative">
              <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search codelists…" className="field-input pl-8 font-mono text-[11px]" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[9px] text-faint">Standard: <span className="font-semibold text-ink">{std}</span></span>
              <p className="font-mono text-[9px] text-faint">{filtered.length} of {codelists.length} codelists</p>
            </div>
          </div>
          <ul className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
            {filtered.map((c) => {
              const nTerms = count(db, "SELECT COUNT(*) AS n FROM ct_terms WHERE codelist=?", [c.code]);
              const appStandards = getApplicableStandards(c);
              const usage = codelistUsageMap.get(c.code);
              const nUsed = usage ? usage.vars.length : 0;
              const on = c.code === code;
              return (
                <li key={c.code}>
                  <button
                    onClick={() => setActiveCode(c.code)}
                    className={`mb-1 w-full rounded-md border px-3 py-2 text-left transition-all cursor-pointer ${
                      on
                        ? "border-crf/60 bg-crf/10 shadow-xs"
                        : "border-transparent hover:border-line hover:bg-raise/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-bold text-crf">{c.code}</span>
                      <div className="flex items-center gap-1">
                        {c.extensible === "Yes" && (
                          <span className="rounded-sm bg-good/10 px-1 font-mono text-[8px] font-semibold text-good">EXT</span>
                        )}
                        <StatusBadge status={c.status} small />
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-dim">{c.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {appStandards.map((s) => (
                        <span
                          key={s}
                          className={`rounded-sm border px-1 py-px font-mono text-[8px] font-bold ${
                            s === "CDASH"
                              ? "border-crf/40 bg-crf/10 text-crf"
                              : s === "SDTM"
                              ? "border-sdtm/40 bg-sdtm/10 text-sdtm"
                              : "border-adam/40 bg-adam/10 text-adam"
                          }`}
                        >
                          {s}
                        </span>
                      ))}
                      <span className="ml-auto font-mono text-[9px] text-faint">
                        {nTerms} terms {nUsed > 0 ? `· ×${nUsed} vars` : ""}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* terms panel */}
        <div className="min-w-0">
          {meta ? (
            <div className="rounded-lg border border-line bg-panel shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-[20px] font-bold text-ink">{meta.code}</h2>
                    <StatusBadge status={meta.status} small />
                    <VerChip v={meta.version} />
                    {meta.extensible && (
                      <span className={`rounded-sm border px-1.5 py-px font-mono text-[9px] font-semibold ${
                        meta.extensible === "Yes"
                          ? "border-good/40 bg-good/10 text-good"
                          : "border-line bg-raise text-faint"
                      }`}>
                        {meta.extensible === "Yes" ? "extensible" : "fixed"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] font-medium text-dim">{meta.name} — {meta.description}</p>
                  
                  {/* Applicability summary badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9.5px] font-semibold uppercase text-faint">Applicable to:</span>
                    {activeApplicable.map((s) => (
                      <span
                        key={s}
                        className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold ${
                          s === "CDASH"
                            ? "border-crf/40 bg-crf/10 text-crf"
                            : s === "SDTM"
                            ? "border-sdtm/40 bg-sdtm/10 text-sdtm"
                            : "border-adam/40 bg-adam/10 text-adam"
                        }`}
                      >
                        ● {s} ({s === "CDASH" ? "Data Collection" : s === "SDTM" ? "Tabulation" : "Analysis"})
                      </span>
                    ))}
                  </div>

                  <p className="mt-2 font-mono text-[10px] text-faint">
                    origin: <span className="text-ink font-semibold">{meta.source}</span>
                    {meta.version_date
                      ? <> · CT version: <span className="font-semibold text-ink">{meta.version_date}</span></>
                      : <> · sync {fmtDate("2026-03-27")}</>}
                    {meta.nci_code ? <> · NCI <span className="text-crf font-bold">{meta.nci_code}</span></> : ""} · updated {fmtDate(meta.updated_at)}
                  </p>

                  {/* Variables using this codelist */}
                  {activeUsage && activeUsage.vars.length > 0 && (
                    <div className="mt-2.5 rounded-md border border-line bg-raise/30 p-2.5">
                      <p className="font-mono text-[9.5px] font-semibold uppercase text-dim">
                        Referenced by {activeUsage.vars.length} variables in MDR:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeUsage.vars.slice(0, 16).map((v, vi) => (
                          <button
                            key={`${v.standard}.${v.domain}.${v.name}.${vi}`}
                            onClick={() => setView("variables")}
                            className="rounded-sm border border-line bg-panel px-1.5 py-0.5 font-mono text-[9.5px] text-ink hover:border-sdtm hover:text-sdtm cursor-pointer transition-colors"
                            title={`Click to view variable in catalog: ${v.standard} ${v.domain}.${v.name}`}
                          >
                            <span className="font-semibold" style={{
                              color: v.standard === "CDASH" ? "#9a5a02" : v.standard === "SDTM" ? "#057a66" : "#b83814"
                            }}>
                              [{v.standard}]
                            </span>{" "}
                            {v.domain}.{v.name}
                          </button>
                        ))}
                        {activeUsage.vars.length > 16 && (
                          <span className="font-mono text-[9.5px] text-faint self-center">
                            +{activeUsage.vars.length - 16} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 rounded-md border border-crf/40 bg-crf/10 px-3 py-2 text-[11.5px] font-semibold text-crf transition-all hover:-translate-y-px hover:bg-crf/20 cursor-pointer"
                >
                  <IconPlus size={13} /> Add term
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="tbl min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Ord</th>
                      <th>Submission value</th>
                      <th>Display</th>
                      <th>Definition</th>
                      <th>NCI</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map((t) => (
                      <tr key={t.id} className={t.status === "DEPRECATED" ? "opacity-50" : ""}>
                        <td className="font-mono text-[10.5px] tabular text-faint">{t.order_number}</td>
                        <td className="font-mono text-[11.5px] font-bold text-ink">{t.submission_value}</td>
                        <td className="text-[11.5px] font-medium text-dim">{t.display_value}</td>
                        <td className="max-w-[260px] truncate text-[11px] text-faint" title={t.definition}>{t.definition}</td>
                        <td className="font-mono text-[10px] font-semibold text-crf">{t.nci_code ?? "—"}</td>
                        <td><StatusBadge status={t.status} small /></td>
                        <td>
                          <button
                            onClick={() => { setCtTerm(t); setReason(""); }}
                            className="rounded-md border border-line px-2 py-1 font-mono text-[9px] text-dim hover:border-adam hover:text-adam cursor-pointer"
                          >
                            {t.status === "ACTIVE" ? "deprecate" : "transition"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-faint shadow-sm">No codelist selected.</p>
          )}
        </div>
      </div>

      {termModal && (
        <StatusModal
          entity="ct_term"
          record={`${termModal.codelist} · ${termModal.submission_value}`}
          current={termModal.status}
          reason={reason}
          setReason={setReason}
          onCancel={() => setCtTerm(null)}
          onConfirm={(to, rsn) => {
            transitionStatus("ct_terms", termModal.id, "id", to, rsn);
            setCtTerm(null);
          }}
        />
      )}

      {adding && code && (
        <Modal onClose={() => setAdding(false)} width={480}>
          <h3 className="font-display text-[16px] font-bold">Add permitted term — {code}</h3>
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Submission value
              <input className="field-input mt-1 font-mono uppercase" placeholder="LIFE-THREATENING" value={nSub} onChange={(e) => setNSub(e.target.value)} />
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Display value
              <input className="field-input mt-1" placeholder="Life-Threatening" value={nDisp} onChange={(e) => setNDisp(e.target.value)} />
            </label>
            <label className="text-[10px] font-mono uppercase tracking-wide text-faint">Definition
              <input className="field-input mt-1" placeholder="Event associated with risk of death…" value={nDef} onChange={(e) => setNDef(e.target.value)} />
            </label>
            <textarea rows={2} className="field-input resize-none" placeholder="Reason for adding this term (audited)…" value={nReason} onChange={(e) => setNReason(e.target.value)} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-md border border-line px-4 py-2 text-[12px] text-dim hover:text-ink">Cancel</button>
            <button
              disabled={nSub.trim().length < 1 || nDisp.trim().length < 1 || nReason.trim().length < 5}
              onClick={addTerm}
              className="rounded-md bg-crf px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add as draft
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
