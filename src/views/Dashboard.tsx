import { useMemo } from "react";
import type { AuditRow, CodelistRow, ReleaseRow, Status, VariableRow } from "../data/types";
import { all, count } from "../db/sqlite";
import { useStore } from "../state/store";
import { useCountUp, useReveal, Logo } from "../components/ui";
import { StatusBadge, StatCard, fmtDate, fmtDateTime, IconShield, IconDb, IconHistory, IconLayers, IconTag, IconClock } from "../components/gxp";

const STATUSES: Status[] = ["DRAFT", "IN REVIEW", "ACTIVE", "DEPRECATED"];
const S_COLOR: Record<string, string> = { DRAFT: "#7a95a8", "IN REVIEW": "#b8720a", ACTIVE: "#0b9e84", DEPRECATED: "#c44b28" };

function StackedBar({ counts, height = 10 }: { counts: Record<string, number>; height?: number }) {
  const total = STATUSES.reduce((s, k) => s + (counts[k] ?? 0), 0) || 1;
  return (
    <div className="flex w-full overflow-hidden rounded-full border border-line bg-raise" style={{ height }}>
      {STATUSES.map((s) => {
        const n = counts[s] ?? 0;
        if (n === 0) return null;
        return (
          <div
            key={s}
            title={`${s}: ${n}`}
            className="transition-all duration-500 hover:opacity-80"
            style={{ width: `${(n / total) * 100}%`, background: S_COLOR[s] }}
          />
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { db, v, setView } = useStore();

  const data = useMemo(() => {
    if (!db) return null;
    const vars = all<VariableRow>(db, "SELECT * FROM variables");
    const domains = all<{ id: number; study_id: string; standard: string; code: string; status: string }>(db, "SELECT id, study_id, standard, code, status FROM domains");
    const codelists = all<CodelistRow>(db, "SELECT * FROM ct_codelists ORDER BY code");
    const ctTerms = count(db, "SELECT COUNT(*) AS n FROM ct_terms");
    const vlmN = count(db, "SELECT COUNT(*) AS n FROM vlm");
    const crfPages = count(db, "SELECT COUNT(*) AS n FROM crf_pages");
    const crfFields = count(db, "SELECT COUNT(*) AS n FROM crf_fields");
    const tflN = count(db, "SELECT COUNT(*) AS n FROM tfls");
    const releases = all<ReleaseRow>(db, "SELECT * FROM releases ORDER BY released_at DESC, id DESC LIMIT 6");
    const releaseTotal = count(db, "SELECT COUNT(*) AS n FROM releases");
    const audit = all<AuditRow>(db, "SELECT * FROM audit_trail ORDER BY id DESC LIMIT 8");
    const gapsCrf = count(db, "SELECT COUNT(*) AS n FROM dispositions");
    const gapsSdtm = vars.filter((x) => x.standard === "SDTM" && !all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM map_s2a WHERE src=?", [`${x.domain}.${x.name}`])[0]?.n && x.status === "ACTIVE").length;
    const auditTotal = count(db, "SELECT COUNT(*) AS n FROM audit_trail");

    const varCounts: Record<string, number> = {};
    for (const s of STATUSES) varCounts[s] = vars.filter((x) => x.status === s).length;
    const allCounts: Record<string, number> = {};
    for (const s of STATUSES) {
      allCounts[s] =
        vars.filter((x) => x.status === s).length +
        domains.filter((x) => x.status === s).length;
    }

    const ctUsage = codelists.map((c) => ({
      ...c,
      used: vars.filter((x) => x.codelist === c.code).length,
      terms: count(db, "SELECT COUNT(*) AS n FROM ct_terms WHERE codelist=?", [c.code]),
    })).sort((a, b) => b.used - a.used).slice(0, 6);

    return { vars, domains, codelists, ctTerms, vlmN, crfPages, crfFields, tflN, releases, releaseTotal, audit, gapsCrf, gapsSdtm, varCounts, allCounts, ctUsage, auditTotal };
  }, [db, v]);

  const ref = useReveal<HTMLDivElement>();
  const varsN = useCountUp(data?.vars.length ?? 0);
  const auditN = useCountUp(data?.auditTotal ?? 0);

  if (!db || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={40} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">mounting SQLite master repository…</p>
        </div>
      </div>
    );
  }

  const activeVars = data.varCounts.ACTIVE ?? 0;

  return (
    <div ref={ref} className="reveal px-5 py-6 sm:px-7">
      {/* masthead */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-sdtm">
            <IconShield size={13} /> Master metadata repository · GxP validated · 21 CFR Part 11
          </p>
          <h1 className="mt-1.5 font-display text-[32px] font-bold leading-tight tracking-tight">
            Source of truth, <span className="text-sdtm">CRF to submission</span>
          </h1>
          <p className="mt-1.5 max-w-[660px] text-[13px] leading-relaxed text-dim">
            Every analysis value traces to an SDTM variable and every SDTM observation traces to a CRF page or a documented rule.
            All changes are versioned, attributed and written to the immutable audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 shadow-xs">
          <IconDb size={16} className="text-sdtm" />
          <div className="leading-tight">
            <p className="font-mono text-[11px] font-semibold text-ink">master-mdr.sqlite</p>
            <p className="font-mono text-[9.5px] text-faint">{data.auditTotal} audit events · CDISC XML loaded</p>
          </div>
        </div>
      </div>

      {/* KPI band */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Releases" value={data.releaseTotal} sub="publication events" color="#7a4f9b" />
        <StatCard label="Domains" value={data.domains.length} sub="CDASH + SDTM + ADaM" />
        <StatCard label="Variables" value={varsN} sub={`${activeVars} active`} />
        <StatCard label="CT terms" value={data.ctTerms} sub={`${data.codelists.length} codelists`} color="#b8720a" />
        <StatCard label="VLM records" value={data.vlmN} sub="value-level rules" color="#3568c8" />
        <StatCard label="CRF forms" value={data.crfPages} sub={`${data.crfFields} fields`} color="#c44b28" />
        <StatCard label="TFL refs" value={data.tflN} sub="protocol shells" />
        <StatCard label="Audit events" value={auditN} sub="append-only" color="#7a95a8" />
      </div>

      {/* status distribution */}
      <section className="mt-6 rounded-lg border border-line bg-panel p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold">
            <IconLayers size={15} className="text-sdtm" /> Lifecycle distribution — variables
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-1.5 font-mono text-[9.5px] text-dim">
                <span className="h-2 w-2 rounded-sm" style={{ background: S_COLOR[s] }} /> {s} · {data.varCounts[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <StackedBar counts={data.varCounts} height={12} />
        </div>
        <p className="mt-2.5 text-[11px] text-faint">
          Draft metadata enters as <span className="text-[#7a95a8] font-semibold">DRAFT</span>, passes standards review <span className="text-[#b8720a] font-semibold">IN REVIEW</span>, is activated with an electronic signature <span className="text-sdtm font-semibold">ACTIVE</span>, and retires with a documented reason <span className="text-crf font-semibold">DEPRECATED</span>.
        </p>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2">
          {/* domain coverage */}
          <div className="rounded-lg border border-line bg-panel p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[14px] font-bold">Domain census by standard & purpose</h3>
                <p className="font-mono text-[10px] text-faint">CDASH (Data Collection) · SDTM (Tabulation) · ADaM (Analysis)</p>
              </div>
              <button onClick={() => setView("domains")} className="font-mono text-[10px] text-sdtm underline-offset-2 hover:underline cursor-pointer">open registry →</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              {(["CDASH", "SDTM", "ADaM"] as const).map((std) => {
                const doms = data.domains.filter((d) => d.standard === std);
                const nvars = data.vars.filter((x) => x.standard === std).length;
                const purpose = std === "CDASH" ? "Data Collection" : std === "SDTM" ? "Tabulation" : "Analysis";
                const color = std === "CDASH" ? "#b8720a" : std === "SDTM" ? "#0b9e84" : "#c44b28";
                return (
                  <div key={std} className="rounded-md border border-line/60 bg-raise/30 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[12px] font-bold" style={{ color }}>
                        {std}
                      </span>
                      <span className="font-mono text-[9px] text-faint uppercase font-medium">{purpose}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] text-dim">{doms.length} domains · {nvars} vars</p>
                    <div className="mt-2 flex max-h-[220px] flex-wrap gap-1 overflow-y-auto">
                      {doms.map((d) => (
                        <span key={`${std}${d.id}`} className="rounded-sm border border-line bg-panel px-1.5 py-0.5 font-mono text-[9px] text-dim hover:border-sdtm/50 cursor-pointer" title={`${d.code}: ${d.status}`} onClick={() => setView("domains")}>
                          <span style={{ color: S_COLOR[d.status] ?? "#7a95a8" }}>●</span> {d.code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* right rail */}
        <div className="flex flex-col gap-4">
          {/* releases */}
          <section className="rounded-lg border border-line bg-panel p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[13.5px] font-bold"><IconHistory size={14} className="text-sdtm" /> Latest releases</h3>
              <button onClick={() => setView("versions")} className="font-mono text-[10px] text-sdtm underline-offset-2 hover:underline">all →</button>
            </div>
            <ul className="mt-3 flex flex-col">
              {data.releases.slice(0, 5).map((r) => (
                <li key={r.id} className="group relative border-l border-line pb-3.5 pl-3.5 last:pb-0">
                  <span className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full" style={{ background: r.status === "RELEASED" ? "#0b9e84" : "#b8720a" }} />
                  <p className="font-mono text-[10.5px]">
                    <span className="font-semibold text-ink">{r.type} {r.version}</span>
                    <span className={`ml-2 rounded-sm px-1 py-px text-[8.5px] ${r.status === "RELEASED" ? "bg-sdtm/15 text-sdtm font-semibold" : "bg-crf/15 text-crf font-semibold"}`}>{r.status}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-faint">{r.released_at ? fmtDate(r.released_at) : "in preparation"} · appr. {r.approved_by || "pending"}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* CT usage */}
          <section className="rounded-lg border border-line bg-panel p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[13.5px] font-bold"><IconTag size={14} className="text-crf" /> Terminology hotspots</h3>
              <button onClick={() => setView("terminology")} className="font-mono text-[10px] text-sdtm underline-offset-2 hover:underline">CT →</button>
            </div>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {data.ctUsage.map((c) => (
                <li key={c.code} className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 font-mono text-[10px] font-semibold text-crf">{c.code}</span>
                  <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-raise">
                    <div className="h-full rounded-full bg-crf/70 transition-all duration-700" style={{ width: `${Math.min(100, (c.used / (data.ctUsage[0]?.used || 1)) * 100)}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[9.5px] tabular text-faint">{c.terms}t · ×{c.used}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* live audit */}
          <section className="rounded-lg border border-line bg-panel p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[13.5px] font-bold"><IconClock size={14} className="text-dim" /> Audit stream</h3>
              <button onClick={() => setView("audit")} className="font-mono text-[10px] text-sdtm underline-offset-2 hover:underline">trail →</button>
            </div>
            <ul className="mt-2.5 flex flex-col gap-2">
              {data.audit.slice(0, 6).map((a) => (
                <li key={a.id} className="rounded-md border border-line bg-raise/50 px-2.5 py-2">
                  <p className="flex items-center gap-2 font-mono text-[9.5px]">
                    <span className={`rounded-sm px-1 py-px text-[8.5px] font-semibold ${a.action === "TRANSITION" ? "bg-adam/15 text-adam" : a.action === "CREATE" ? "bg-sdtm/15 text-sdtm" : a.action === "EXPORT" ? "bg-tfl/15 text-tfl" : "bg-raise text-dim"}`}>{a.action}</span>
                    <span className="truncate text-dim font-medium">{a.record}</span>
                    <span className="ml-auto shrink-0 text-faint">{fmtDateTime(a.ts)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-faint">{a.actor}{a.field !== "—" ? ` · ${a.field}: ${a.old_value} → ${a.new_value}` : ""}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* gap strip */}
      <section className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-crf/30 bg-crf/8 px-5 py-3.5">
        <p className="flex items-center gap-2 font-display text-[13px] font-bold text-crf">
          <span className="pulse-dot h-2 w-2 rounded-full bg-crf" /> Traceability attention
        </p>
        <button onClick={() => setView("gaps")} className="font-mono text-[10.5px] text-dim hover:text-ink">
          {data.gapsCrf} documented CRF dispositions · {data.gapsSdtm} SDTM variables without an ADaM consumer →
        </button>
      </section>
    </div>
  );
}
