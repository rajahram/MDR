import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const hits = searchAll(state, q);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-[320px]">
      <IconSearch size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search OID, variable, TFL…"
        className="w-full rounded-md border border-line/80 bg-abyss/60 py-2 pl-8 pr-3 font-mono text-[11px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm/60"
      />
      {open && hits.length > 0 && (
        <div className="anim-fade absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-line bg-panel shadow-2xl shadow-black/60">
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

function Shell() {
  const { ready, view, setView, study, setStudy, studies, actor, setActor, resetDb, db } = useStore();
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = window.setTimeout(() => setArm(false), 3200);
    return () => window.clearTimeout(t);
  }, [arm]);

  if (!ready || !db) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none fixed inset-0">
          <div className="bg-grid absolute inset-0" />
          <div className="orb left-[-140px] top-[-120px] h-[420px] w-[420px] bg-[#38c7a6] opacity-[0.07]" />
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <div className="pulse-dot"><Logo size={44} /></div>
          <div className="text-center">
            <p className="font-display text-[18px] font-bold">TRACE·MDR</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
              compiling SQLite WASM · seeding master repository…
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/80 bg-deep/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <button onClick={() => setView("dashboard")} className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
          <Logo size={28} />
          <span className="leading-none">
            <span className="block font-display text-[15px] font-bold tracking-wide">
              TRACE<span className="text-sdtm">·</span>MDR
            </span>
            <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.2em] text-faint">
              master metadata repository
            </span>
          </span>
        </button>

        <span className="hidden items-center gap-1.5 rounded-md border border-sdtm/30 bg-sdtm/8 px-2.5 py-1.5 lg:flex">
          <IconShield size={12} className="text-sdtm" />
          <span className="font-mono text-[9.5px] font-semibold tracking-wide text-sdtm">GxP · 21 CFR PART 11</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block"><GlobalSearch /></div>
          <label className="flex items-center gap-1.5">
            <span className="hidden font-mono text-[8.5px] uppercase tracking-[0.14em] text-faint xl:block">study</span>
            <select value={study} onChange={(e) => setStudy(e.target.value)} className="field-input w-[110px] py-1.5 font-mono text-[11px] font-semibold text-sdtm">
              {studies.map((s) => <option key={s.study_id} value={s.study_id}>{s.study_id}</option>)}
            </select>
          </label>
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="hidden font-mono text-[8.5px] uppercase tracking-[0.14em] text-faint xl:block">actor</span>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="field-input w-[190px] py-1.5 font-mono text-[10.5px]" title="Signed-in user — attributed on every audited action">
              {ACTORS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <button
            onClick={() => {
              if (arm) { resetDb(); setArm(false); }
              else setArm(true);
            }}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-all ${
              arm ? "border-adam/60 bg-adam/15 text-adam" : "border-line/80 text-dim hover:border-line hover:text-ink"
            }`}
            title="Reset demo data"
          >
            <IconReset size={11} />
            {arm ? "confirm?" : "reset"}
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="hidden w-[190px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line/80 bg-deep/60 p-3 md:flex">
          {NAV.map((g) => (
            <nav key={g.group}>
              <p className="mb-1 px-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-faint">{g.group}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = view === n.key;
                  return (
                    <li key={n.key}>
                      <button
                        onClick={() => setView(n.key)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] font-medium transition-all ${
                          active ? "bg-raise text-ink" : "text-dim hover:bg-panel/70 hover:text-ink"
                        }`}
                      >
                        <span className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r transition-all ${active ? "bg-sdtm" : "bg-transparent group-hover:bg-line"}`} />
                        <span className={active ? "text-sdtm" : ""}>{n.icon}</span>
                        {n.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}

          <div className="mt-auto rounded-md border border-line/60 bg-panel/40 p-3">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
              <IconDb size={11} className="text-sdtm" /> SQLite store
            </p>
            <p className="mt-1.5 font-mono text-[10px] text-dim">master-mdr.sqlite</p>
            <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-faint">
              browser-persisted · sql.js WASM · append-only audit
            </p>
          </div>
        </aside>

        {/* mobile nav */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line/80 bg-deep/60 px-3 py-2 md:hidden">
            {NAV.flatMap((g) => g.items).map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  view === n.key ? "bg-raise text-ink" : "text-dim hover:text-ink"
                }`}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          </nav>

          <main className={view === "explorer" ? "min-h-0 min-w-0 flex-1" : "min-h-0 min-w-0 flex-1 overflow-y-auto"}>
            <div key={view} className={view === "explorer" ? "h-full" : "view-enter"}>
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
