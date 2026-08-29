import { useMemo, useState } from "react";
import type { CodelistRow, CtTermRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { fmtDate, IconTag, PageHeader, ReasonModal, StatusBadge, StatusModal, VerChip } from "../components/gxp";
import { IconPlus, IconSearch, Modal } from "../components/ui";

export default function Terminology() {
  const { db, v, transitionStatus, mutate, toast } = useStore();
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
  const filtered = codelists.filter((c) => !q.trim() || `${c.code} ${c.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const code = activeCode ?? filtered[0]?.code ?? null;
  const terms = useMemo(
    () => (db && code ? all<CtTermRow>(db, "SELECT * FROM ct_terms WHERE codelist=? ORDER BY order_number", [code]) : []),
    [db, v, code],
  );
  const meta = codelists.find((c) => c.code === code);

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
    <div className="px-5 py-6 sm:px-7">
      <PageHeader
        icon={<IconTag size={20} />}
        title="Controlled Terminology"
        subtitle="Codelists and permitted terms referenced by the variable catalog — submission values, NCI codes and sync version. Term changes follow the same DRAFT → ACTIVE lifecycle."
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* codelist list */}
        <div className="rounded-lg border border-line bg-deep/60">
          <div className="border-b border-line/80 p-3">
            <div className="relative">
              <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search codelists…" className="field-input pl-8 font-mono text-[11px]" />
            </div>
          </div>
          <ul className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
            {filtered.map((c) => {
              const nTerms = count(db, "SELECT COUNT(*) AS n FROM ct_terms WHERE codelist=?", [c.code]);
              const nUsed = count(db, "SELECT COUNT(*) AS n FROM variables WHERE codelist=?", [c.code]);
              const on = c.code === code;
              return (
                <li key={c.code}>
                  <button
                    onClick={() => setActiveCode(c.code)}
                    className={`mb-1 w-full rounded-md border px-3 py-2 text-left transition-all ${on ? "border-[#f2ac3c66] bg-[#f2ac3c0f]" : "border-transparent hover:border-line/70 hover:bg-panel/60"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11.5px] font-semibold text-[#f2ac3c]">{c.code}</span>
                      <StatusBadge status={c.status} small />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-dim">{c.name}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-faint">{nTerms} terms · used ×{nUsed}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* terms panel */}
        <div className="min-w-0">
          {meta ? (
            <div className="rounded-lg border border-line bg-deep/60">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/80 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-[19px] font-bold">{meta.code}</h2>
                    <StatusBadge status={meta.status} small />
                    <VerChip v={meta.version} />
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-dim">{meta.name} — {meta.description}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-faint">
                    source: <span className="text-ink">{meta.source}</span> · sync {fmtDate("2023-12-15")}
                    {meta.nci_code ? <> · NCI <span className="text-[#f2ac3c]">{meta.nci_code}</span></> : ""} · updated {fmtDate(meta.updated_at)}
                  </p>
                </div>
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 rounded-md border border-[#f2ac3c45] bg-[#f2ac3c12] px-3 py-2 text-[11.5px] font-semibold text-[#f2ac3c] transition-all hover:-translate-y-px hover:bg-[#f2ac3c1f]"
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
                        <td className="font-mono text-[11.5px] font-semibold text-ink">{t.submission_value}</td>
                        <td className="text-[11.5px] text-dim">{t.display_value}</td>
                        <td className="max-w-[240px] truncate text-[11px] text-faint" title={t.definition}>{t.definition}</td>
                        <td className="font-mono text-[10px] text-[#f2ac3c]">{t.nci_code ?? "—"}</td>
                        <td><StatusBadge status={t.status} small /></td>
                        <td>
                          <button
                            onClick={() => { setCtTerm(t); setReason(""); }}
                            className="rounded-md border border-line/70 px-2 py-1 font-mono text-[9px] text-dim hover:border-[#f27059] hover:text-[#f27059]"
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
            <p className="rounded-lg border border-line bg-deep/60 p-6 text-center text-[12px] text-faint">No codelist selected.</p>
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
            <button onClick={() => setAdding(false)} className="rounded-md border border-line/80 px-4 py-2 text-[12px] text-dim hover:text-ink">Cancel</button>
            <button
              disabled={nSub.trim().length < 1 || nDisp.trim().length < 1 || nReason.trim().length < 5}
              onClick={addTerm}
              className="rounded-md bg-[#f2ac3c] px-4 py-2 text-[12px] font-semibold text-[#211503] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add as draft
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
