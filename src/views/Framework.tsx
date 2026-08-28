import type { ReactNode } from "react";
import { LAYER_META } from "../lib/trace";
import { useStore } from "../state/store";
import { FlowArrow, IconCheck, SectionLabel, useReveal } from "../components/ui";

function Block({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const LAYERS = [
  {
    key: "crf",
    title: "Layer 1 · CRF annotation",
    body: "Export the casebook from the EDC as ODM-XML and register every page and field by OID (PAGE.FIELD). Record data type, codelist and whether the field is required. Fields that exist only for operations — screen-fail reasons, initials, site workflow — are tagged with a disposition instead of a mapping.",
    chips: ["ODM OIDs", "data types", "codelists", "required flags", "dispositions for non-submitted fields"],
  },
  {
    key: "sdtm",
    title: "Layer 2 · SDTM mapping",
    body: "Each annotated field resolves to DOMAIN.VARIABLE with two declarations: a variable role (IDENTIFIER, TOPIC, TIMING, QUALIFIER) and an origin (CRF, ASSIGNED, DERIVED, PREDECESSOR). Vertical CRF fields fan out to one row per record (VS, LB); dictionary coding (MedDRA, WHO-DD) and unit standardisation are recorded as derivations on the target variable.",
    chips: ["variable roles", "origins", "MedDRA / WHO-DD", "unit standardisation", "--TESTCD assignment"],
  },
  {
    key: "adam",
    title: "Layer 3 · ADaM derivation",
    body: "Every analysis variable declares the SDTM variables it reads and a plain-language derivation rule. Records follow one of three structures: ADSL (one row per subject), BDS (one row per subject, parameter, analysis timepoint) or OCCDS (one row per occurrence). Baseline, change-from-baseline and population flags are always derived, never copied.",
    chips: ["ADSL / BDS / OCCDS", "derivation rules", "BASE · CHG · PCHG", "population flags", "imputation rules"],
  },
  {
    key: "tfl",
    title: "Layer 4 · TFL traceability",
    body: "Each table, figure and listing registers the ADaM variables feeding its cells — the tfltool step. A TFL whose variables cannot be traced back to a CRF page has a broken chain; an ADaM variable no TFL consumes is a candidate for removal at the next spec revision.",
    chips: ["cell-level variable refs", "protocol shell alignment", "unused-variable review"],
  },
];

const ROLES = [
  ["IDENTIFIER", "Locates the record: STUDYID, USUBJID, --SEQ."],
  ["TOPIC", "The observation itself: --TEST/--TESTCD, AE.AETERM, CM.CMTRT."],
  ["TIMING", "When it happened: --DTC dates, VISIT, VISITNUM."],
  ["QUALIFIER", "Context around the topic: --POS, --SEV, --ORRES, standardised results."],
];

const ORIGINS = [
  ["CRF", "Transcribed directly from an annotated CRF field.", "text-crf"],
  ["ASSIGNED", "Set by the conversion program: identifiers, units, codelists.", "text-[#9fb6ff]"],
  ["DERIVED", "Computed or coded: AGE, dictionary terms, standardised results.", "text-adam"],
  ["PREDECESSOR", "Carried from an earlier SDTM dataset or the EDC context.", "text-dim"],
];

const WORKFLOW = [
  ["Extract", "Pull CRF metadata from the EDC (ODM-XML); freeze the annotated CRF as the MDR baseline."],
  ["Map", "Author the SDTM mapping spec: domain, variable, role, origin, codelist, derivation for every field."],
  ["Derive", "Define ADaM datasets with per-variable rules; tag each variable with its SDTM sources."],
  ["Publish", "Generate define.xml and the SDTM/ADaM specification PDFs from the same MDR records."],
  ["Validate", "Run Pinnacle 21 (SDTM + ADaM rulesets); every finding must resolve to an MDR record."],
  ["Lock", "Traceability lock: no mapping change after database lock without a controlled spec amendment."],
];

export default function Framework() {
  const { setView } = useStore();

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-10 px-6 pb-20 pt-8">
      {/* intro */}
      <Block>
        <SectionLabel color="#7fa6e8">Framework · Methodology</SectionLabel>
        <h1 className="mt-1.5 font-display text-[30px] font-bold leading-tight tracking-tight">
          Four layers, one unbroken chain
        </h1>
        <p className="mt-2 max-w-[700px] text-[13.5px] leading-relaxed text-dim">
          The MDR is not a spreadsheet of names — it is a directed graph with one invariant:
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 rounded-lg border border-line bg-deep/70 p-4">
          {(["crf", "sdtm", "adam", "tfl"] as const).map((k, i) => (
            <span key={k} className="flex items-center">
              {i > 0 && <FlowArrow color={LAYER_META[k].color} />}
              <span className="rounded-md border px-3 py-1.5 font-mono text-[11.5px] font-semibold" style={{ borderColor: `${LAYER_META[k].color}55`, color: LAYER_META[k].color, background: `${LAYER_META[k].color}0d` }}>
                {LAYER_META[k].name}
                <span className="ml-2 hidden font-normal text-dim sm:inline">{i === 0 ? "OID" : i === 1 ? "domain.var" : i === 2 ? "dataset.var" : "cell refs"}</span>
              </span>
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-[700px] border-l-2 border-sdtm/60 pl-4 text-[13px] italic leading-relaxed text-dim">
          “Every analysis value must be traceable to an SDTM variable; every SDTM observation must be
          traceable to a CRF page or a documented rule.”
        </p>
      </Block>

      {/* layer specs */}
      <section className="flex flex-col">
        {LAYERS.map((l, i) => {
          const c = LAYER_META[l.key as keyof typeof LAYER_META].color;
          return (
            <Block key={l.key} delay={i * 60}>
              <div className="group flex flex-col gap-3 border-l-2 py-4 pl-5 transition-colors sm:flex-row sm:gap-6" style={{ borderColor: `${c}66` }}>
                <span className="font-display text-[26px] font-bold leading-none tabular" style={{ color: `${c}aa` }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[17px] font-bold" style={{ color: c }}>{l.title}</h2>
                  <p className="mt-1.5 max-w-[680px] text-[12.5px] leading-relaxed text-dim">{l.body}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {l.chips.map((ch) => (
                      <span key={ch} className="rounded-sm border border-line/70 bg-panel/60 px-2 py-0.5 font-mono text-[10px] text-dim transition-colors group-hover:border-line group-hover:text-ink">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Block>
          );
        })}
      </section>

      {/* roles & origins */}
      <Block>
        <SectionLabel color="#38c7a6">SDTM declarations</SectionLabel>
        <h2 className="mt-1.5 font-display text-[20px] font-bold tracking-tight">Every variable declares a role and an origin</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-line bg-deep/70">
            <p className="border-b border-line/70 bg-panel px-4 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-sdtm">Variable role</p>
            <ul>
              {ROLES.map(([r, d]) => (
                <li key={r} className="flex gap-3 border-b border-line/40 px-4 py-2.5 last:border-0">
                  <span className="w-[86px] shrink-0 font-mono text-[10.5px] font-semibold text-sdtm">{r}</span>
                  <span className="text-[11.5px] leading-snug text-dim">{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-deep/70">
            <p className="border-b border-line/70 bg-panel px-4 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-crf">Origin</p>
            <ul>
              {ORIGINS.map(([o, d, cls]) => (
                <li key={o} className="flex gap-3 border-b border-line/40 px-4 py-2.5 last:border-0">
                  <span className={`w-[86px] shrink-0 font-mono text-[10.5px] font-semibold ${cls}`}>{o}</span>
                  <span className="text-[11.5px] leading-snug text-dim">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Block>

      {/* workflow */}
      <Block>
        <SectionLabel color="#f2ac3c">Governance workflow</SectionLabel>
        <h2 className="mt-1.5 font-display text-[20px] font-bold tracking-tight">From annotated CRF to traceability lock</h2>
        <ol className="mt-5 flex flex-col">
          {WORKFLOW.map(([t, d], i) => (
            <li key={t} className="group relative flex gap-4 pb-5 last:pb-0">
              {i < WORKFLOW.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-22px)] w-px bg-line" />}
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sdtm/50 bg-deep font-mono text-[10.5px] font-semibold text-sdtm transition-all group-hover:bg-sdtm group-hover:text-abyss">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="font-display text-[14px] font-bold text-ink">{t}</p>
                <p className="mt-0.5 max-w-[620px] text-[12px] leading-relaxed text-dim">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      {/* validation gates */}
      <Block>
        <SectionLabel color="#f27059">Validation gates</SectionLabel>
        <h2 className="mt-1.5 font-display text-[20px] font-bold tracking-tight">What “ready for submission” checks</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {[
            "Pinnacle 21 SDTM ruleset — every finding answered against an MDR record",
            "Pinnacle 21 ADaM ruleset — derivation rules match define.xml",
            "define.xml generated from the MDR, never hand-edited",
            "Annotated CRF (acrf.pdf) page references match CRF OIDs in the MDR",
            "Zero undocumented gaps across CRF → SDTM → ADaM → TFL",
            "Traceability lock signed off before database lock",
          ].map((g) => (
            <li key={g} className="flex items-start gap-2.5 rounded-md border border-line/60 bg-deep/70 px-3.5 py-2.5 text-[12px] leading-snug text-dim transition-colors hover:border-line hover:text-ink">
              <IconCheck size={13} className="mt-0.5 shrink-0 text-sdtm" />
              {g}
            </li>
          ))}
        </ul>
        <button
          onClick={() => setView("explorer")}
          className="mt-6 rounded-md border border-sdtm/50 bg-sdtm/10 px-5 py-2.5 text-[13px] font-semibold text-sdtm transition-all hover:-translate-y-0.5 hover:bg-sdtm/20"
        >
          Apply the framework in the explorer →
        </button>
      </Block>
    </div>
  );
}
