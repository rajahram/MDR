import { useMemo } from "react";
import type { LayerKey } from "../data/types";
import { coverage, gapLists, LAYER_META } from "../lib/trace";
import { useStore } from "../state/store";
import { IconCheck, IconChevron, SectionLabel, useCountUp, useReveal } from "../components/ui";

function Ring({ pct, color, label }: { pct: number; color: string; label: string }) {
  const n = useCountUp(pct, 1100);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#d1dce6" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * n) / 100}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text x="44" y="49" textAnchor="middle" fill={color} fontSize="16" fontFamily="Space Grotesk, sans-serif" fontWeight="700">
          {n}%
        </text>
      </svg>
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{label}</p>
    </div>
  );
}

function GapItem({
  kind,
  id,
  code,
  title,
  note,
}: {
  kind: LayerKey;
  id: string;
  code: string;
  title: string;
  note?: string;
}) {
  const { select } = useStore();
  const meta = LAYER_META[kind];
  return (
    <button
      onClick={() => select({ kind, id }, true)}
      className="node-item group flex w-full items-start gap-3 rounded-md border border-line bg-raise/50 px-3.5 py-2.5 text-left hover:border-line hover:bg-raise cursor-pointer"
    >
      <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold" style={{ color: meta.color }}>
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-ink">{title}</span>
        {note && <span className="mt-0.5 block text-[11px] leading-snug text-faint">{note}</span>}
      </span>
      <IconChevron size={12} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}

export default function Gaps() {
  const { state } = useStore();
  const cov = useMemo(() => coverage(state), [state]);
  const gaps = useMemo(() => gapLists(state), [state]);
  const ref1 = useReveal<HTMLDivElement>();
  const ref2 = useReveal<HTMLDivElement>();
  const ref3 = useReveal<HTMLDivElement>();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 pb-16 pt-8">
      <div>
        <SectionLabel color="#b8720a">Gap Analysis</SectionLabel>
        <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">Where the chain breaks — and where it may</h1>
        <p className="mt-1 max-w-[700px] text-[13px] text-dim">
          A gap is only a problem when it is undocumented. Each item below either needs a mapping, a
          justification recorded in the MDR, or explicit acceptance by data governance.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-around gap-6 rounded-xl border border-line bg-panel px-6 py-5 shadow-sm">
        <Ring pct={cov.crfPct} color={LAYER_META.crf.color} label="CRF → SDTM" />
        <Ring pct={cov.sdtmPct} color={LAYER_META.sdtm.color} label="SDTM → ADaM" />
        <Ring pct={cov.adamPct} color={LAYER_META.adam.color} label="ADaM → TFL" />
        <div className="max-w-[260px] text-[11.5px] leading-relaxed text-faint">
          <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-dim">Reading the rings</p>
          100% is rarely the target — assigned identifiers and derived terms legitimately skip layers.
          The target is <span className="text-ink font-semibold">0 undocumented gaps</span>.
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* CRF not mapped */}
        <div ref={ref1} className="reveal flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-crf">Collected, not mapped</h2>
            <span className="rounded-sm bg-crf/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-crf">{gaps.crfNotMapped.length}</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-dim">
            CRF fields with no SDTM target. Each needs a documented disposition — operational-only,
            PII redaction, or a deprecated SDTM construct.
          </p>
          <div className="flex flex-col gap-2">
            {gaps.crfNotMapped.map((g) => (
              <GapItem key={g.field.id} kind="crf" id={g.field.id} code={g.field.id} title={g.field.label} note={g.reason} />
            ))}
            {gaps.crfNotMapped.length === 0 && (
              <p className="flex items-center gap-2 rounded-md border border-sdtm/30 bg-sdtm/10 px-3 py-2.5 text-[12px] text-sdtm">
                <IconCheck size={13} /> Every collected field has a documented disposition.
              </p>
            )}
          </div>
        </div>

        {/* SDTM dead ends */}
        <div ref={ref2} className="reveal flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-sdtm">SDTM dead ends</h2>
            <span className="rounded-sm bg-sdtm/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-sdtm">{gaps.sdtmNotInAdam.length}</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-dim">
            Standardised variables consumed by no ADaM dataset. Acceptable for submission-only
            context (units, dictionary terms kept for traceability) — flag anything an analysis needs.
          </p>
          <div className="flex flex-col gap-2">
            {gaps.sdtmNotInAdam.map((v) => (
              <GapItem key={v.id} kind="sdtm" id={v.id} code={v.id} title={v.label} note={`origin ${v.origin}${v.derivation ? ` · ${v.derivation}` : ""}`} />
            ))}
          </div>
        </div>

        {/* ADaM unused */}
        <div ref={ref3} className="reveal flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-adam">Analysis vars, no TFL</h2>
            <span className="rounded-sm bg-adam/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-adam">{gaps.adamNoTfl.length}</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-dim">
            ADaM variables referenced by no table, figure or listing. Keep flags used for populations;
            remove or re-scope anything derived without a consumer.
          </p>
          <div className="flex flex-col gap-2">
            {gaps.adamNoTfl.map((v) => (
              <GapItem key={v.id} kind="adam" id={v.id} code={v.id} title={v.label} note={v.derivation ?? `${v.dataset} · origin ${v.origin}`} />
            ))}
            {gaps.adamNoTfl.length === 0 && (
              <p className="flex items-center gap-2 rounded-md border border-sdtm/30 bg-sdtm/10 px-3 py-2.5 text-[12px] text-sdtm">
                <IconCheck size={13} /> Every analysis variable feeds a TFL.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-line bg-deep/70 p-5">
        <span className="mt-0.5 text-tfl"><IconCheck size={15} /></span>
        <p className="text-[12.5px] leading-relaxed text-dim">
          <span className="font-semibold text-ink">{gaps.sdtmNoCrf.length} SDTM variables legitimately have no CRF source</span>{" "}
          — identifiers (USUBJID, sequence numbers), assigned units and codelists, and terms derived
          from dictionaries or the randomisation list. These are recorded with origin{" "}
          <span className="font-mono text-[11px] text-[#9fb6ff]">ASSIGNED</span> /{" "}
          <span className="font-mono text-[11px] text-adam">DERIVED</span> and are not treated as gaps.
        </p>
      </div>
    </div>
  );
}
