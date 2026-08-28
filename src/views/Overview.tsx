import { useMemo } from "react";
import { STUDY } from "../data/seed";
import { coverage, domainStats, gapLists, LAYER_META } from "../lib/trace";
import { useStore } from "../state/store";
import { FlowArrow, IconAlert, IconArrow, IconChevron, SectionLabel, download, useCountUp, useReveal } from "../components/ui";

function StatNode({
  color,
  count,
  unit,
  sub,
}: {
  color: string;
  count: number;
  unit: string;
  sub: string;
}) {
  const n = useCountUp(count);
  return (
    <div className="relative flex min-w-[132px] flex-col items-center gap-1 rounded-lg border border-line bg-panel/80 px-5 py-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40">
      <span className="absolute inset-x-4 top-0 h-px" style={{ background: color, opacity: 0.7 }} />
      <span className="font-display text-3xl font-bold tabular" style={{ color }}>
        {n}
      </span>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">{unit}</span>
      <span className="text-[11px] text-faint">{sub}</span>
    </div>
  );
}

function CoverageBar({ label, n, total, pct, color }: { label: string; n: number; total: number; pct: number; color: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        <span className="font-mono text-[11px] tabular text-dim">
          {n}/{total} · <span style={{ color }}>{pct}%</span>
        </span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-raise">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function Overview() {
  const { state, setView, select, toast } = useStore();
  const cov = useMemo(() => coverage(state), [state]);
  const gaps = useMemo(() => gapLists(state), [state]);
  const domains = useMemo(() => domainStats(state), [state]);
  const headRef = useReveal<HTMLDivElement>();
  const attnRef = useReveal<HTMLDivElement>();

  const exportJson = () => {
    download("trace-mdr-snapshot.json", JSON.stringify(state, null, 2), "application/json");
    toast("success", "MDR snapshot exported as JSON.");
  };

  const attention = [
    ...gaps.crfNotMapped.map((g) => ({ kind: "crf" as const, id: g.field.id, code: g.field.id, text: g.reason })),
    ...gaps.sdtmNotInAdam.slice(0, 3).map((v) => ({ kind: "sdtm" as const, id: v.id, code: v.id, text: `${v.label} — collected/standardised but consumed by no ADaM dataset.` })),
    ...gaps.adamNoTfl.slice(0, 3).map((v) => ({ kind: "adam" as const, id: v.id, code: v.id, text: `${v.label} — defined but referenced by no TFL.` })),
  ].slice(0, 6);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6 pb-16 pt-8">
      {/* header */}
      <div ref={headRef} className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Metadata Repository · Study {STUDY.id}</SectionLabel>
          <h1 className="mt-2 font-display text-[34px] font-bold leading-tight tracking-tight">
            One unbroken trace from{" "}
            <span className="text-crf">case report</span> to{" "}
            <span className="text-adam">analysis</span>.
          </h1>
          <p className="mt-2 max-w-[620px] text-[13.5px] leading-relaxed text-dim">
            Every field captured on a CRF page is mapped to an SDTM variable with a declared role and
            origin; every SDTM observation flows into a traceable ADaM variable with a documented
            derivation; every analysis value lands in a Table, Figure or Listing.
          </p>
        </div>
        <button
          onClick={exportJson}
          className="group flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-[12.5px] font-medium text-ink transition-all hover:border-sdtm/50 hover:bg-raise"
        >
          <IconArrow size={14} className="rotate-90 text-sdtm transition-transform group-hover:translate-y-0.5" />
          Export MDR snapshot
        </button>
      </div>

      {/* pipeline */}
      <div className="rounded-xl border border-line bg-deep/70 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-4">
          <StatNode color={LAYER_META.crf.color} count={cov.crfTotal} unit="CRF fields" sub={`${new Set(state.crfFields.map((f) => f.pageCode)).size} casebook pages`} />
          <div className="flex flex-col items-center gap-1">
            <FlowArrow color={LAYER_META.sdtm.color} />
            <span className="font-mono text-[9.5px] tabular text-faint">{cov.crfPct}% annotated</span>
          </div>
          <StatNode color={LAYER_META.sdtm.color} count={cov.sdtmTotal} unit="SDTM vars" sub={`${domains.length} domains`} />
          <div className="flex flex-col items-center gap-1">
            <FlowArrow color={LAYER_META.adam.color} />
            <span className="font-mono text-[9.5px] tabular text-faint">{cov.sdtmPct}% flow to ADaM</span>
          </div>
          <StatNode color={LAYER_META.adam.color} count={cov.adamTotal} unit="ADaM vars" sub={`${new Set(state.adamVars.map((a) => a.dataset)).size} datasets`} />
          <div className="flex flex-col items-center gap-1">
            <FlowArrow color={LAYER_META.tfl.color} />
            <span className="font-mono text-[9.5px] tabular text-faint">{cov.adamPct}% used in TFLs</span>
          </div>
          <StatNode color={LAYER_META.tfl.color} count={state.tfls.length} unit="TFLs" sub="tables · figures · listings" />
        </div>
        <p className="mt-6 border-t border-line/70 pt-4 text-center font-mono text-[10.5px] tracking-wide text-faint">
          {STUDY.protocol} &nbsp;·&nbsp; {STUDY.sdtm} &nbsp;·&nbsp; {STUDY.adam} &nbsp;·&nbsp; {STUDY.meddra} &nbsp;·&nbsp; {STUDY.whodd}
        </p>
      </div>

      {/* middle grid */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* coverage */}
        <div className="flex flex-col gap-5 rounded-xl border border-line bg-deep/70 p-6">
          <div className="flex items-center justify-between">
            <SectionLabel color="#38c7a6">Layer-to-layer coverage</SectionLabel>
            <button onClick={() => setView("gaps")} className="flex items-center gap-1 text-[11.5px] font-medium text-dim transition-colors hover:text-ink">
              Gap analysis <IconChevron size={11} />
            </button>
          </div>
          <CoverageBar label="CRF fields → SDTM variables" n={cov.crfMapped} total={cov.crfTotal} pct={cov.crfPct} color={LAYER_META.crf.color} />
          <CoverageBar label="SDTM variables → ADaM variables" n={cov.sdtmToAdam} total={cov.sdtmTotal} pct={cov.sdtmPct} color={LAYER_META.sdtm.color} />
          <CoverageBar label="ADaM variables → TFL references" n={cov.adamToTfl} total={cov.adamTotal} pct={cov.adamPct} color={LAYER_META.adam.color} />
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            {cov.sdtmNoCrf} SDTM variables are ASSIGNED / DERIVED with no CRF source — expected for
            identifiers, sequences and dictionary-coded terms.
          </p>
        </div>

        {/* domain distribution */}
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-deep/70 p-6">
          <div className="flex items-center justify-between">
            <SectionLabel color="#f2ac3c">SDTM variable census by origin</SectionLabel>
            <button onClick={() => setView("matrix")} className="flex items-center gap-1 text-[11.5px] font-medium text-dim transition-colors hover:text-ink">
              Full matrix <IconChevron size={11} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {domains.map((d) => (
              <button
                key={d.domain}
                onClick={() => setView("matrix")}
                className="group text-left"
                title={`Open ${d.domain} in the traceability matrix`}
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-mono text-[11.5px] font-semibold tracking-wide text-ink transition-colors group-hover:text-sdtm">
                    {d.domain}
                    <span className="ml-2 text-[10px] font-normal text-faint">{d.total} vars</span>
                  </span>
                </div>
                <div className="flex h-[10px] overflow-hidden rounded-sm bg-raise">
                  {d.crf > 0 && <div className="h-full bg-crf/80 transition-all group-hover:bg-crf" style={{ width: `${(d.crf / d.total) * 100}%` }} />}
                  {d.derived > 0 && <div className="h-full bg-adam/75 transition-all group-hover:bg-adam" style={{ width: `${(d.derived / d.total) * 100}%` }} />}
                  {d.assigned > 0 && <div className="h-full bg-[#9fb6ff80]" style={{ width: `${(d.assigned / d.total) * 100}%` }} />}
                  {d.predecessor > 0 && <div className="h-full bg-faint/50" style={{ width: `${(d.predecessor / d.total) * 100}%` }} />}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line/70 pt-3">
            {[
              ["CRF", "#f2ac3c"],
              ["DERIVED", "#f27059"],
              ["ASSIGNED", "#9fb6ff"],
              ["PREDECESSOR", "#5e7c85"],
            ].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-wide text-dim">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* attention */}
      <div ref={attnRef} className="reveal rounded-xl border border-line bg-deep/70 p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel color="#f2ac3c">Needs annotation review</SectionLabel>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-dim">
            <IconAlert size={12} className="text-crf" />
            {attention.length} of {gaps.crfNotMapped.length + gaps.sdtmNotInAdam.length + gaps.adamNoTfl.length} open items
          </span>
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {attention.map((a) => {
            const meta = LAYER_META[a.kind];
            return (
              <li key={a.id}>
                <button
                  onClick={() => select({ kind: a.kind, id: a.id }, true)}
                  className="node-item group flex w-full items-start gap-3 rounded-md border border-line/70 bg-panel/60 px-3.5 py-2.5 text-left hover:border-line"
                  style={{ borderLeftColor: meta.color, borderLeftWidth: 2 }}
                >
                  <span className="mt-0.5 font-mono text-[11px] font-semibold" style={{ color: meta.color }}>
                    {a.code}
                  </span>
                  <span className="flex-1 text-[12px] leading-snug text-dim transition-colors group-hover:text-ink">{a.text}</span>
                  <IconChevron size={12} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
