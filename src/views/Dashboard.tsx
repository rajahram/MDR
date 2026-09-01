import { useMemo } from "react";
import type { AuditRow, ReleaseRow, Status, VariableRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore, type ViewKey } from "../state/store";
import { IconAlert, IconArrow, IconCheck, Logo, useCountUp, useReveal } from "../components/ui";
import {
  fmtDate,
  fmtDateTime,
  IconClock,
  IconHistory,
  IconLayers,
  IconShield,
  IconTag,
  StatCard,
} from "../components/gxp";

const STATUSES: Status[] = ["DRAFT", "IN REVIEW", "ACTIVE", "DEPRECATED"];
const S_COLOR: Record<Status, string> = {
  DRAFT: "#6f8292",
  "IN REVIEW": "#b54708",
  ACTIVE: "#168a31",
  DEPRECATED: "#e01029",
};

function StackedBar({ counts }: { counts: Record<string, number> }) {
  const total = STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0) || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-raise" aria-label="Variable lifecycle distribution">
      {STATUSES.map((status) => {
        const value = counts[status] ?? 0;
        if (!value) return null;
        return (
          <span
            key={status}
            title={`${status}: ${value.toLocaleString()}`}
            style={{ width: `${(value / total) * 100}%`, background: S_COLOR[status] }}
          />
        );
      })}
    </div>
  );
}

function ModuleLink({ step, title, description, value, detail, onClick }: {
  step: string;
  title: string;
  description: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group flex min-h-[132px] w-full flex-col rounded-lg border border-line bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-sdtm/45 hover:shadow-md">
      <span className="flex w-full items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sdtm">{step}</span>
        <IconArrow size={14} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-sdtm" />
      </span>
      <span className="mt-2 font-display text-[14px] font-semibold text-ink">{title}</span>
      <span className="mt-1 min-h-8 text-[10.5px] leading-relaxed text-faint">{description}</span>
      <span className="mt-auto flex items-baseline gap-2 pt-3">
        <span className="font-display text-[22px] font-semibold leading-none text-sdtm tabular">{value.toLocaleString()}</span>
        <span className="text-[9.5px] text-dim">{detail}</span>
      </span>
    </button>
  );
}

export default function Dashboard() {
  const { db, v, setView } = useStore();

  const data = useMemo(() => {
    if (!db) return null;
    const vars = all<VariableRow>(db, "SELECT * FROM variables");
    const domains = all<{ id: number; standard: string; code: string; status: string }>(db, "SELECT id, standard, code, status FROM domains");
    const releases = all<ReleaseRow>(db, "SELECT * FROM releases ORDER BY released_at DESC, id DESC LIMIT 5");
    const audit = all<AuditRow>(db, "SELECT * FROM audit_trail ORDER BY id DESC LIMIT 6");
    const codelists = count(db, "SELECT COUNT(*) AS n FROM ct_codelists");
    const ctTerms = count(db, "SELECT COUNT(*) AS n FROM ct_terms");
    const crfPages = count(db, "SELECT COUNT(*) AS n FROM crf_pages");
    const crfFields = count(db, "SELECT COUNT(*) AS n FROM crf_fields");
    const tfls = count(db, "SELECT COUNT(*) AS n FROM tfls");
    const releaseTotal = count(db, "SELECT COUNT(*) AS n FROM releases");
    const auditTotal = count(db, "SELECT COUNT(*) AS n FROM audit_trail");
    const dispositions = count(db, "SELECT COUNT(*) AS n FROM dispositions");
    const crfMappings = count(db, "SELECT COUNT(*) AS n FROM map_c2s");
    const adamMappings = count(db, "SELECT COUNT(*) AS n FROM map_s2a");
    const unmappedSdtm = count(db, "SELECT COUNT(*) AS n FROM variables v WHERE v.standard='SDTM' AND v.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM map_s2a m WHERE m.src = v.domain || '.' || v.name)");

    const varCounts: Record<string, number> = {};
    for (const status of STATUSES) varCounts[status] = vars.filter((item) => item.status === status).length;
    const domainStats = (["CDASH", "SDTM", "ADaM"] as const).map((standard) => ({
      standard,
      domains: domains.filter((item) => item.standard === standard).length,
      variables: vars.filter((item) => item.standard === standard).length,
    }));

    return {
      vars, domains, releases, audit, codelists, ctTerms, crfPages, crfFields, tfls,
      releaseTotal, auditTotal, dispositions, crfMappings, adamMappings, unmappedSdtm,
      varCounts, domainStats,
    };
  }, [db, v]);

  const ref = useReveal<HTMLDivElement>();
  const varsN = useCountUp(data?.vars.length ?? 0);
  const auditN = useCountUp(data?.auditTotal ?? 0);

  if (!db || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={40} />
          <p className="text-[11px] font-medium text-faint">Preparing the clinical metadata repository…</p>
        </div>
      </div>
    );
  }

  const sdtmVariables = data.domainStats.find((item) => item.standard === "SDTM")?.variables ?? 0;
  const adamVariables = data.domainStats.find((item) => item.standard === "ADaM")?.variables ?? 0;
  const activeVars = data.varCounts.ACTIVE ?? 0;
  const activeRate = data.vars.length ? Math.round((activeVars / data.vars.length) * 100) : 0;
  const queue: { tone: "alert" | "info" | "ok"; count: number; title: string; detail: string; view: ViewKey }[] = [
    { tone: "alert", count: data.unmappedSdtm, title: "SDTM variables without an ADaM consumer", detail: "Assess whether each item needs analysis lineage or a documented disposition.", view: "gaps" },
    { tone: "info", count: data.dispositions, title: "Documented CRF dispositions", detail: "Review accepted collection exceptions before the next standards release.", view: "gaps" },
    { tone: "ok", count: data.releaseTotal, title: "Controlled publication events", detail: "Compare versions, approvals, and effective dates across the repository.", view: "versions" },
  ];

  return (
    <div ref={ref} className="reveal mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <section className="overflow-hidden rounded-xl border border-[#0759a8] bg-sdtm text-white shadow-lg shadow-blue-950/10">
        <div className="grid lg:grid-cols-5">
          <div className="px-5 py-6 sm:px-7 sm:py-7 lg:col-span-3">
            <p className="flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-blue-100"><IconShield size={13} /> Clinical standards command center</p>
            <h1 className="mt-3 max-w-[720px] font-display text-[27px] font-semibold leading-tight tracking-tight sm:text-[32px]">Build once. Trace every definition from CRF to submission.</h1>
            <p className="mt-3 max-w-[720px] text-[12px] leading-relaxed text-blue-50 sm:text-[12.5px]">Govern reusable CDISC metadata, assess downstream change impact, and preserve an attributable record of every controlled decision.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => setView("gaps")} className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-4 text-[11.5px] font-semibold text-sdtm shadow-sm transition-colors hover:bg-blue-50"><IconAlert size={14} /> Review traceability gaps</button>
              <button onClick={() => setView("explorer")} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/55 px-4 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/10">Explore metadata lineage <IconArrow size={13} /></button>
            </div>
          </div>
          <div className="border-t border-white/20 bg-[#0759a8] px-5 py-5 sm:px-6 lg:col-span-2 lg:border-l lg:border-t-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-100">Repository health</p>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
              <div><p className="text-[22px] font-semibold tabular">{activeRate}%</p><p className="mt-0.5 text-[9.5px] text-blue-100">metadata active</p></div>
              <div><p className="text-[22px] font-semibold tabular">{data.auditTotal.toLocaleString()}</p><p className="mt-0.5 text-[9.5px] text-blue-100">audit events</p></div>
              <div><p className="text-[22px] font-semibold tabular">{data.codelists.toLocaleString()}</p><p className="mt-0.5 text-[9.5px] text-blue-100">controlled lists</p></div>
              <div><p className="text-[22px] font-semibold tabular">{data.releaseTotal}</p><p className="mt-0.5 text-[9.5px] text-blue-100">approved releases</p></div>
            </div>
            <p className="mt-5 flex items-start gap-2 border-t border-white/20 pt-4 text-[9.5px] leading-relaxed text-blue-100"><IconCheck size={13} className="mt-px shrink-0 text-white" /> Validated baseline with an append-only, attributable audit history.</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sdtm">End-to-end workflow</p><h2 className="mt-1 font-display text-[18px] font-semibold text-ink">Clinical Metadata Lifecycle</h2></div>
          <p className="text-[10.5px] text-faint">Select a stage to continue work in its source registry.</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ModuleLink step="01 · Design" title="CRF Collection" description="Reusable forms, fields, and controlled collection definitions." value={data.crfFields} detail={`${data.crfPages} forms`} onClick={() => setView("crf")} />
          <ModuleLink step="02 · Standardize" title="SDTM Tabulation" description="Submission variables with collection lineage and terminology." value={sdtmVariables} detail={`${data.crfMappings} CRF mappings`} onClick={() => setView("variables")} />
          <ModuleLink step="03 · Analyze" title="ADaM Derivations" description="Analysis-ready variables, methods, and upstream dependencies." value={adamVariables} detail={`${data.adamMappings} SDTM mappings`} onClick={() => setView("explorer")} />
          <ModuleLink step="04 · Publish" title="Outputs and Releases" description="TFL references, governed versions, and approval evidence." value={data.tfls} detail={`${data.releaseTotal} releases`} onClick={() => setView("versions")} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-line bg-panel p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sdtm">Governance</p><h2 className="mt-1 flex items-center gap-2 font-display text-[15px] font-semibold"><IconLayers size={16} className="text-sdtm" /> Variable Lifecycle</h2></div>
              <span className="rounded-md bg-good/10 px-2.5 py-1 text-[10px] font-semibold text-good">{activeRate}% active</span>
            </div>
            <div className="mt-4"><StackedBar counts={data.varCounts} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUSES.map((status) => (
                <div key={status} className="rounded-md border border-line bg-raise/35 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-faint"><span className="h-2 w-2 rounded-full" style={{ background: S_COLOR[status] }} />{status}</p>
                  <p className="mt-1 font-display text-[16px] font-semibold tabular text-ink">{(data.varCounts[status] ?? 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-panel p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sdtm">Priority queue</p><h2 className="mt-1 font-display text-[15px] font-semibold">Work Requiring Attention</h2></div>
              <button onClick={() => setView("gaps")} className="text-[10.5px] font-semibold text-sdtm hover:underline">Open gap analysis</button>
            </div>
            <div className="mt-3 divide-y divide-line rounded-lg border border-line">
              {queue.map((item) => (
                <button key={item.title} onClick={() => setView(item.view)} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raise/45">
                  <span className={`mt-0.5 flex min-w-11 items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold tabular ${item.tone === "alert" ? "bg-crf/10 text-crf" : item.tone === "ok" ? "bg-good/10 text-good" : "bg-sdtm/10 text-sdtm"}`}>{item.count.toLocaleString()}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold text-ink">{item.title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-faint">{item.detail}</span></span>
                  <IconArrow size={14} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-sdtm" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-line bg-panel p-5 shadow-xs">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-[14px] font-semibold"><IconHistory size={15} className="text-sdtm" /> Latest Releases</h2><button onClick={() => setView("versions")} className="text-[10px] font-semibold text-sdtm hover:underline">View all</button></div>
            <ul className="mt-4 space-y-3">
              {data.releases.map((release) => (
                <li key={release.id} className="border-l-2 border-sdtm/35 pl-3">
                  <p className="flex items-start justify-between gap-2 text-[10.5px] font-semibold text-ink"><span>{release.type} {release.version}</span><span className="shrink-0 rounded bg-good/10 px-1.5 py-0.5 text-[8px] font-semibold text-good">{release.status}</span></p>
                  <p className="mt-1 text-[9.5px] text-faint">{release.released_at ? fmtDate(release.released_at) : "In preparation"} · {release.approved_by || "Approval pending"}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-panel p-5 shadow-xs">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-[14px] font-semibold"><IconClock size={15} className="text-sdtm" /> Recent Audit Activity</h2><button onClick={() => setView("audit")} className="text-[10px] font-semibold text-sdtm hover:underline">View trail</button></div>
            <ul className="mt-3 space-y-2">
              {data.audit.slice(0, 4).map((event) => (
                <li key={event.id} className="rounded-md bg-raise/55 px-3 py-2.5">
                  <p className="flex items-center gap-2 text-[9.5px]"><span className="rounded bg-sdtm/10 px-1.5 py-0.5 text-[8px] font-semibold text-sdtm">{event.action}</span><span className="min-w-0 flex-1 truncate font-semibold text-ink">{event.record}</span><span className="shrink-0 text-[8.5px] text-faint">{fmtDateTime(event.ts)}</span></p>
                  <p className="mt-1 truncate text-[9px] text-faint">{event.actor}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Variables" value={varsN} sub={`${activeVars.toLocaleString()} active`} />
        <StatCard label="Domains" value={data.domains.length} sub="CDASH, SDTM, and ADaM" color="#151f6d" />
        <StatCard label="CT terms" value={data.ctTerms} sub={`${data.codelists} codelists`} color="#0063c3" />
        <StatCard label="Audit events" value={auditN} sub="Append-only evidence" color="#465b6d" />
      </section>
      <p className="mt-5 flex items-center gap-2 text-[9.5px] text-faint"><IconTag size={12} className="text-sdtm" /> Counts reflect the current validated repository baseline and recorded mappings.</p>
    </div>
  );
}
