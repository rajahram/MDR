import { useEffect, useRef, useState, type ReactNode } from "react";
import { StoreProvider, useStore, type ViewKey } from "./state/store";
import { STUDY } from "./data/seed";
import { gapLists, LAYER_META, searchAll } from "./lib/trace";
import {
  IconAlert,
  IconBook,
  IconFlow,
  IconGrid,
  IconPlus,
  IconReset,
  IconSearch,
  IconTable,
  Logo,
  ToastHost,
} from "./components/ui";
import Overview from "./views/Overview";
import Explorer from "./views/Explorer";
import Matrix from "./views/Matrix";
import Gaps from "./views/Gaps";
import Framework from "./views/Framework";
import AddTraceModal from "./components/AddTraceModal";

const NAV: { key: ViewKey; label: string; icon: (p: { size?: number }) => ReactNode }[] = [
  { key: "overview", label: "Overview", icon: (p) => <IconGrid {...p} /> },
  { key: "explorer", label: "Explorer", icon: (p) => <IconFlow {...p} /> },
  { key: "matrix", label: "Matrix", icon: (p) => <IconTable {...p} /> },
  { key: "gaps", label: "Gaps", icon: (p) => <IconAlert {...p} /> },
  { key: "framework", label: "Framework", icon: (p) => <IconBook {...p} /> },
];

function GlobalSearch() {
  const { state, select } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const hits = searchAll(state, q);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-[340px]">
      <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search OID, variable, TFL…"
        className="w-full rounded-md border border-line/80 bg-abyss/60 py-2 pl-9 pr-3 font-mono text-[11.5px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm/60"
      />
      {open && hits.length > 0 && (
        <div className="anim-fade absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-line bg-panel shadow-2xl shadow-black/60">
          {hits.map((h) => {
            const meta = LAYER_META[h.kind];
            return (
              <button
                key={`${h.kind}-${h.id}`}
                onClick={() => {
                  select({ kind: h.kind, id: h.id }, true);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 border-b border-line/40 px-3 py-2 text-left transition-colors last:border-0 hover:bg-raise/70"
              >
                <span className="w-11 shrink-0 rounded-sm border px-1 py-px text-center font-mono text-[8.5px] font-semibold" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                  {meta.short}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11.5px] font-semibold text-ink">{h.title}</span>
                  <span className="block truncate text-[10.5px] text-faint">{h.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResetButton() {
  const { dispatch, toast } = useStore();
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = window.setTimeout(() => setArm(false), 3200);
    return () => window.clearTimeout(t);
  }, [arm]);
  return (
    <button
      onClick={() => {
        if (arm) {
          dispatch({ type: "reset" });
          toast("info", "MDR reset to the seeded VX-201 framework.");
          setArm(false);
        } else {
          setArm(true);
        }
      }}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] transition-all ${
        arm ? "border-adam/60 bg-adam/15 text-adam" : "border-line/80 text-dim hover:border-line hover:text-ink"
      }`}
      title="Reset demo data"
    >
      <IconReset size={12} />
      {arm ? "confirm?" : "reset"}
    </button>
  );
}

function Shell() {
  const { state, view, setView, modalOpen, setModalOpen } = useStore();
  const gaps = gapLists(state);
  const gapCount = gaps.crfNotMapped.length + gaps.sdtmNotInAdam.length + gaps.adamNoTfl.length;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-grid absolute inset-0" />
        <div className="orb left-[-140px] top-[-120px] h-[420px] w-[420px] bg-[#38c7a6] opacity-[0.07]" />
        <div className="orb bottom-[-160px] right-[-120px] h-[460px] w-[460px] bg-[#f2ac3c] opacity-[0.06]" style={{ animationDelay: "-8s" }} />
        <div className="orb bottom-[10%] left-[30%] h-[300px] w-[300px] bg-[#f27059] opacity-[0.045]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* top bar */}
      <header className="relative z-20 flex shrink-0 items-center gap-4 border-b border-line/80 bg-deep/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <button onClick={() => setView("overview")} className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
          <Logo size={28} />
          <span className="leading-none">
            <span className="block font-display text-[16px] font-bold tracking-wide">
              TRACE<span className="text-sdtm">·</span>MDR
            </span>
            <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-[0.22em] text-faint">
              CRF → SDTM → ADaM
            </span>
          </span>
        </button>
        <span className="hidden items-center gap-2 rounded-md border border-line/70 bg-panel/70 px-2.5 py-1.5 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-sdtm pulse-dot" />
          <span className="font-mono text-[10.5px] text-dim">
            STUDY {STUDY.id} · {STUDY.phase}
          </span>
        </span>
        <div className="ml-auto hidden w-full max-w-[340px] sm:block">
          <GlobalSearch />
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-sdtm/45 bg-sdtm/12 px-3 py-2 text-[12px] font-semibold text-sdtm transition-all hover:-translate-y-px hover:bg-sdtm/20"
        >
          <IconPlus size={13} />
          <span className="hidden md:inline">Add mapping</span>
        </button>
        <ResetButton />
      </header>

      {/* mobile nav */}
      <nav className="relative z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-line/80 bg-deep/60 px-3 py-2 md:hidden">
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
              view === n.key ? "bg-raise text-ink" : "text-dim hover:text-ink"
            }`}
          >
            {n.icon({ size: 13 })}
            {n.label}
            {n.key === "gaps" && gapCount > 0 && (
              <span className="rounded-full bg-crf/20 px-1.5 font-mono text-[9px] text-crf">{gapCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="hidden w-[196px] shrink-0 flex-col gap-1 border-r border-line/80 bg-deep/60 p-3 md:flex">
          {NAV.map((n) => {
            const active = view === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[12.5px] font-medium transition-all ${
                  active ? "bg-raise text-ink" : "text-dim hover:bg-panel/70 hover:text-ink"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r transition-all ${
                    active ? "bg-sdtm" : "bg-transparent group-hover:bg-line"
                  }`}
                />
                {n.icon({ size: 15 })}
                {n.label}
                {n.key === "gaps" && gapCount > 0 && (
                  <span className="ml-auto rounded-full bg-crf/20 px-2 py-px font-mono text-[9.5px] tabular text-crf">{gapCount}</span>
                )}
              </button>
            );
          })}

          <div className="mt-auto rounded-md border border-line/60 bg-panel/40 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">Repository</p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-[10px] text-dim">
              <li className="flex justify-between"><span className="text-crf">CRF</span><span className="tabular">{state.crfFields.length} fields</span></li>
              <li className="flex justify-between"><span className="text-sdtm">SDTM</span><span className="tabular">{state.sdtmVars.length} vars</span></li>
              <li className="flex justify-between"><span className="text-adam">ADaM</span><span className="tabular">{state.adamVars.length} vars</span></li>
              <li className="flex justify-between"><span className="text-tfl">TFL</span><span className="tabular">{state.tfls.length} refs</span></li>
            </ul>
          </div>
        </aside>

        {/* main */}
        <main className={view === "explorer" ? "min-h-0 min-w-0 flex-1" : "min-h-0 min-w-0 flex-1 overflow-y-auto"}>
          <div key={view} className={view === "explorer" ? "h-full" : "view-enter"}>
            {view === "overview" && <Overview />}
            {view === "explorer" && (
              <div className="view-enter h-full">
                <Explorer />
              </div>
            )}
            {view === "matrix" && <Matrix />}
            {view === "gaps" && <Gaps />}
            {view === "framework" && <Framework />}
          </div>
        </main>
      </div>

      <ToastHost />
      {modalOpen && <AddTraceModal />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
