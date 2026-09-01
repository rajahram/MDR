import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { StoreProvider, useStore, type ViewKey } from "./state/store";
import { ACTORS } from "./db/sqlite";
import { LAYER_META, searchAll } from "./lib/trace";
import {
  IconAlert, IconFlow, IconGrid, IconReset, IconSearch, IconTable, Logo, ToastHost,
} from "./components/ui";
import { IconClock, IconDb, IconHistory, IconLayers, IconShield, IconTag } from "./components/gxp";
import Dashboard from "./views/Dashboard";
import Explorer from "./views/Explorer";
import Matrix from "./views/Matrix";
import Gaps from "./views/Gaps";
import Domains from "./views/Domains";
import Variables from "./views/Variables";
import Terminology from "./views/Terminology";
import Vlm from "./views/Vlm";
import CrfRegistry from "./views/CrfRegistry";
import Versions from "./views/Versions";
import AuditTrail from "./views/AuditTrail";

const NAV: { group: string; items: { key: ViewKey; label: string; icon: ReactNode }[] }[] = [
  {
    group: "Monitor",
    items: [{ key: "dashboard", label: "Dashboard", icon: <IconGrid size={15} /> }],
  },
  {
    group: "Traceability",
    items: [
      { key: "explorer", label: "Trace Explorer", icon: <IconFlow size={15} /> },
      { key: "matrix", label: "Trace Matrix", icon: <IconTable size={15} /> },
      { key: "gaps", label: "Gap Analysis", icon: <IconAlert size={15} /> },
    ],
  },
  {
    group: "Catalog",
    items: [
      { key: "domains", label: "Domains", icon: <IconLayers size={15} /> },
      { key: "variables", label: "Variables", icon: <IconShield size={15} /> },
      { key: "terminology", label: "Terminology", icon: <IconTag size={15} /> },
      { key: "vlm", label: "VLM", icon: <IconDb size={15} /> },
      { key: "crf", label: "CRF Registry", icon: <IconClock size={15} /> },
    ],
  },
  {
    group: "Governance",
    items: [
      { key: "versions", label: "Versions", icon: <IconHistory size={15} /> },
      { key: "audit", label: "Audit Trail", icon: <IconShield size={15} /> },
    ],
  },
];

function GlobalSearch() {
  const { state, select } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = searchAll(state, q);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-[320px]">
      <IconSearch size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search all metadata"
        aria-label="Search all metadata"
        aria-expanded={open}
        className="h-8 w-full rounded-md border border-line bg-white py-1.5 pl-8 pr-14 text-[11.5px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-raise px-1.5 py-0.5 font-mono text-[8.5px] text-faint lg:block">Ctrl K</kbd>
      {open && q.trim() && (
        <div className="anim-fade absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-line bg-panel shadow-2xl shadow-slate-300/50">
          {hits.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-[12px] font-semibold text-ink">No metadata found</p>
              <p className="mt-1 text-[10.5px] text-faint">Try an OID, domain, variable, codelist, or TFL code.</p>
            </div>
          )}
          {hits.map((h) => {
            const meta = LAYER_META[h.kind];
            return (
              <button
                key={`${h.kind}-${h.id}`}
                onClick={() => { select({ kind: h.kind, id: h.id }, true); setQ(""); setOpen(false); }}
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

function BootPane() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-grid" />
      <div className="relative flex flex-col items-center gap-4">
        <div className="pulse-dot"><Logo size={44} /></div>
        <div className="text-center">
          <p className="font-display text-[18px] font-bold">Clinical MDR</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
            compiling SQLite WASM · seeding master repository…
          </p>
          {slow && (
            <p className="anim-fade mx-auto mt-4 max-w-[380px] rounded-md border border-crf/40 bg-crf/10 px-4 py-2.5 text-left font-mono text-[10px] leading-relaxed text-crf">
              Still compiling. If this persists, the sandbox may be blocking WebAssembly or the
              sql-wasm.wasm asset — check the browser console and reload.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BootErrorPane({ message, onReseed }: { message: string; onReseed: () => void }) {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none fixed inset-0 bg-grid" />
      <div className="anim-fade relative w-full max-w-[460px] rounded-lg border border-crf/45 bg-panel/90 p-7 shadow-2xl shadow-black/60">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-crf">boot failure · SQLite engine</p>
        <h1 className="mt-2 font-display text-[22px] font-bold leading-snug">The master repository could not start</h1>
        <p className="mt-3 break-words rounded-md border border-line/70 bg-abyss/70 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-dim">
          {message}
        </p>
        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
          The in-browser database (sql.js WASM) failed to compile, seed or restore. Reseeding rebuilds
          the validated baseline; nothing audited outside this browser is affected.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onReseed}
            className="rounded-md bg-sdtm px-4 py-2.5 text-[12.5px] font-bold text-[#04211b] transition-all hover:-translate-y-px hover:brightness-110"
          >
            Reseed repository
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-line px-4 py-2.5 text-[12.5px] font-semibold text-dim transition-colors hover:border-line hover:text-ink"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="anim-fade w-full max-w-[440px] rounded-lg border border-crf/45 bg-panel/90 p-6 text-center shadow-2xl shadow-black/50">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-crf">rendering error</p>
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-dim">{this.state.error}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-md border border-line px-4 py-2 text-[12px] font-semibold text-dim transition-colors hover:border-sdtm/50 hover:text-sdtm"
            >
              Dismiss & retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const { ready, bootError, view, setView, actor, setActor, resetDb, db } = useStore();
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = window.setTimeout(() => setArm(false), 3200);
    return () => window.clearTimeout(t);
  }, [arm]);

  if (bootError) return <BootErrorPane message={bootError} onReseed={resetDb} />;
  if (!ready || !db) return <BootPane />;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-abyss">
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid" />

      {/* top bar */}
      <header className="relative z-20 flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2 shadow-sm sm:px-5">
        <button onClick={() => setView("dashboard")} className="flex items-center gap-2.5 rounded-sm text-left transition-opacity hover:opacity-85" aria-label="Go to dashboard">
          <Logo size={30} />
          <span className="leading-none">
            <span className="block font-display text-[14px] font-semibold tracking-tight">
              Clinical <span className="text-sdtm">MDR</span>
            </span>
            <span className="mt-1 block text-[8.5px] font-medium uppercase tracking-[0.16em] text-faint">
              Standards and traceability
            </span>
          </span>
        </button>

        <span className="hidden items-center gap-1.5 border-l border-line pl-4 lg:flex">
          <IconShield size={12} className="text-sdtm" />
          <span className="text-[9.5px] font-semibold tracking-wide text-dim">GxP controlled · 21 CFR Part 11</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="order-last min-w-full basis-full md:order-none md:min-w-0 md:w-[300px] md:basis-auto"><GlobalSearch /></div>
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="sr-only">Acting as</span>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="field-input h-8 w-[204px] py-1 text-[10.5px]" title="Acting user — attributed on every audited action" aria-label="Acting user">
              {ACTORS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <button
            onClick={() => {
              if (arm) { resetDb(); setArm(false); }
              else setArm(true);
            }}
            className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[10px] font-medium transition-all ${
              arm ? "border-adam/60 bg-adam/15 text-adam" : "border-line text-dim hover:border-line hover:text-ink"
            }`}
            title="Reset demo data"
          >
            <IconReset size={11} />
            {arm ? "Confirm reset" : "Reset demo"}
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="hidden w-[216px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-panel p-3 md:flex shadow-sm">
          {NAV.map((g) => (
            <nav key={g.group}>
              <p className="mb-1 px-2 text-[8.5px] font-semibold uppercase tracking-[0.18em] text-faint">{g.group}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = view === n.key;
                  return (
                    <li key={n.key}>
                      <button
                        onClick={() => setView(n.key)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[11.5px] font-medium transition-all ${
                          active ? "bg-sdtm text-white shadow-sm" : "text-dim hover:bg-raise hover:text-ink"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className={active ? "text-white" : "text-sdtm"}>{n.icon}</span>
                        {n.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}

          <div className="mt-auto rounded-md border border-line bg-raise/55 p-3">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-faint">
              <IconDb size={12} className="text-sdtm" /> Repository status
            </p>
            <p className="mt-2 flex items-center gap-2 text-[10.5px] font-semibold text-ink"><span className="h-2 w-2 rounded-full bg-good" /> Available</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-faint">
              Validated baseline · append-only audit history
            </p>
          </div>
        </aside>

        {/* mobile nav */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel/80 px-3 py-2 md:hidden">
            {NAV.flatMap((g) => g.items).map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  view === n.key ? "bg-sdtm text-white" : "text-dim hover:bg-raise hover:text-ink"
                }`}
                aria-current={view === n.key ? "page" : undefined}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          </nav>

          <main className={view === "explorer" ? "min-h-0 min-w-0 flex-1" : "min-h-0 min-w-0 flex-1 overflow-y-auto"}>
            <Boundary key={view}>
              <div className={view === "explorer" ? "h-full" : "view-enter"}>
                {view === "dashboard" && <Dashboard />}
                {view === "explorer" && <div className="view-enter h-full"><Explorer /></div>}
                {view === "matrix" && <Matrix />}
                {view === "gaps" && <Gaps />}
                {view === "domains" && <Domains />}
                {view === "variables" && <Variables />}
                {view === "terminology" && <Terminology />}
                {view === "vlm" && <Vlm />}
                {view === "crf" && <CrfRegistry />}
                {view === "versions" && <Versions />}
                {view === "audit" && <AuditTrail />}
              </div>
            </Boundary>
          </main>
        </div>
      </div>

      <ToastHost />
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
