import { useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import type { SdtmOrigin, SdtmRole } from "../data/types";
import { useStore } from "../state/store";

/* ───────────────────────── icons ───────────────────────── */
type IP = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & { size?: number };
const base = ({ size, ...p }: IP) => ({
  width: size ?? 16,
  height: size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconGrid = (p: IP) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconFlow = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="5" cy="6" r="2.4" />
    <circle cx="19" cy="6" r="2.4" />
    <circle cx="12" cy="18" r="2.4" />
    <path d="M7.2 7.2 10.4 16M16.8 7.2 13.6 16M7.4 6h9.2" />
  </svg>
);
export const IconTable = (p: IP) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 9.5h18M9 9.5V20M15 9.5V20" />
  </svg>
);
export const IconAlert = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 3.5 22 20H2L12 3.5Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </svg>
);
export const IconBook = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
    <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7.5h8M8 11h5" />
  </svg>
);
export const IconSearch = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.9-4.9" />
  </svg>
);
export const IconPlus = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconX = (p: IP) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IconDownload = (p: IP) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 11 12 15.5 16.5 11M4.5 19.5h15" />
  </svg>
);
export const IconChevron = (p: IP) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const IconArrow = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);
export const IconLink = (p: IP) => (
  <svg {...base(p)}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 6.5 12.8 4.7a4 4 0 0 1 5.7 5.7L16.7 12.2M13 17.5l-1.8 1.8a4 4 0 0 1-5.7-5.7l1.8-1.8" />
  </svg>
);
export const IconCheck = (p: IP) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </svg>
);
export const IconReset = (p: IP) => (
  <svg {...base(p)}>
    <path d="M4 5v5h5" />
    <path d="M4.5 10A8 8 0 1 1 4 14.5" />
  </svg>
);
export const IconDot = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
  </svg>
);

/* ───────────────────────── logo ───────────────────────── */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="6" cy="16" r="3.4" fill="#f2ac3c" />
      <circle cx="16" cy="7" r="3.4" fill="#38c7a6" />
      <circle cx="16" cy="25" r="3.4" fill="#f27059" />
      <circle cx="26" cy="16" r="3.4" fill="#7fa6e8" />
      <path
        d="M8.8 14.4 13.2 8.9M8.8 17.6 13.2 23.1M18.8 8.9 23.2 14.4M18.8 23.1 23.2 17.6M16 10.4v11.2"
        stroke="#3d5f6b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ───────────────────────── badges ───────────────────────── */
const roleColor: Record<SdtmRole, string> = {
  IDENTIFIER: "text-[#c9b3ff] border-[#c9b3ff4d] bg-[#c9b3ff14]",
  TOPIC: "text-sdtm border-sdtm/40 bg-sdtm/10",
  TIMING: "text-tfl border-tfl/40 bg-tfl/10",
  QUALIFIER: "text-dim border-line bg-raise/60",
};

export function RoleBadge({ role }: { role: SdtmRole }) {
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[9.5px] font-medium tracking-wide ${roleColor[role]}`}>
      {role.slice(0, 5)}
    </span>
  );
}

const originColor: Record<SdtmOrigin, string> = {
  CRF: "text-crf border-crf/40 bg-crf/10",
  ASSIGNED: "text-[#9fb6ff] border-[#9fb6ff40] bg-[#9fb6ff12]",
  DERIVED: "text-adam border-adam/40 bg-adam/10",
  PREDECESSOR: "text-dim border-line bg-raise/60",
};

export function OriginBadge({ origin }: { origin: SdtmOrigin | "SDTM" }) {
  const cls = origin === "SDTM" ? "text-sdtm border-sdtm/40 bg-sdtm/10" : originColor[origin];
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[9.5px] font-medium tracking-wide ${cls}`}>
      {origin === "PREDECESSOR" ? "PREDE" : origin}
    </span>
  );
}

export function TypeBadge({ type }: { type: "Char" | "Num" }) {
  return (
    <span className="font-mono text-[9.5px] text-faint">{type}</span>
  );
}

export function GapChip({ label, tone = "crf" }: { label: string; tone?: "crf" | "sdtm" | "adam" }) {
  const cls =
    tone === "sdtm"
      ? "text-sdtm border-sdtm/40 bg-sdtm/10"
      : tone === "adam"
        ? "text-adam border-adam/40 bg-adam/10"
        : "text-crf border-crf/40 bg-crf/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[9.5px] font-medium ${cls}`}>
      <IconAlert size={9} />
      {label}
    </span>
  );
}

export function TflChip({ code, kind }: { code: string; kind: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-tfl/35 bg-tfl/10 px-1.5 py-px font-mono text-[9.5px] font-medium text-tfl">
      {kind === "Figure" ? "fig" : kind === "Listing" ? "lst" : "tbl"} {code}
    </span>
  );
}

/* ───────────────────────── animated arrow connector ───────────────────────── */
export function FlowArrow({ color, vertical = false }: { color: string; vertical?: boolean }) {
  return (
    <svg
      width={vertical ? 20 : 46}
      height={vertical ? 26 : 20}
      viewBox={vertical ? "0 0 20 26" : "0 0 46 20"}
      className="shrink-0"
    >
      <line
        x1={vertical ? 10 : 2}
        y1={vertical ? 2 : 10}
        x2={vertical ? 10 : 36}
        y2={vertical ? 18 : 10}
        stroke={color}
        strokeWidth="1.6"
        className="flow-line"
      />
      <path
        d={
          vertical
            ? "M5.5 19 10 25l4.5-6"
            : "M36 4.5l8 5.5-8 5.5"
        }
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ───────────────────────── hooks ───────────────────────── */
export function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

/* ───────────────────────── toast host ───────────────────────── */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-md border px-3.5 py-3 shadow-xl shadow-black/40 backdrop-blur-sm ${
            t.kind === "success"
              ? "border-sdtm/40 bg-[#0d2b26]/95"
              : t.kind === "warn"
                ? "border-crf/40 bg-[#2b220d]/95"
                : "border-line bg-panel/95"
          }`}
        >
          <span
            className={`mt-0.5 shrink-0 ${
              t.kind === "success" ? "text-sdtm" : t.kind === "warn" ? "text-crf" : "text-tfl"
            }`}
          >
            {t.kind === "success" ? <IconCheck size={14} /> : <IconDot size={14} />}
          </span>
          <p className="flex-1 text-[12.5px] leading-snug text-ink">{t.text}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 text-faint transition-colors hover:text-ink"
            aria-label="Dismiss"
          >
            <IconX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── modal shell ───────────────────────── */
export function Modal({
  onClose,
  children,
  width = 620,
}: {
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="anim-fade fixed inset-0 z-[80] flex items-center justify-center bg-abyss/70 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-in max-h-[88vh] w-full overflow-y-auto rounded-lg border border-line bg-deep shadow-2xl shadow-black/60"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── misc ───────────────────────── */
export function SectionLabel({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: color ?? "#5e7c85" }}>
      {children}
    </p>
  );
}

export function download(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
