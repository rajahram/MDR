import { useState, type ReactNode, type SVGProps } from "react";
import type { Status } from "../data/types";
import { STATUS_FLOW } from "../data/types";
import { Modal } from "./ui";

type IP = SVGProps<SVGSVGElement> & { size?: number };
const Svg = ({ size = 16, children, ...rest }: IP & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);

export const IconShield = (p: IP) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></Svg>
);
export const IconDb = (p: IP) => (
  <Svg {...p}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></Svg>
);
export const IconHistory = (p: IP) => (
  <Svg {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></Svg>
);
export const IconTag = (p: IP) => (
  <Svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Svg>
);
export const IconLayers = (p: IP) => (
  <Svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Svg>
);
export const IconPen = (p: IP) => (
  <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>
);
export const IconClock = (p: IP) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>
);
export const IconFile = (p: IP) => (
  <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></Svg>
);

/* ── status lifecycle visuals ─────────────────────────────────── */
export const STATUS_COLOR: Record<Status, string> = {
  DRAFT: "#93a8ad",
  "IN REVIEW": "#f2ac3c",
  ACTIVE: "#38c7a6",
  DEPRECATED: "#f27059",
};

export function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  const c = STATUS_COLOR[status as Status] ?? "#93a8ad";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border font-mono font-semibold ${small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"}`}
      style={{ color: c, borderColor: `${c}4d`, background: `${c}14`, letterSpacing: "0.08em" }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: status === "ACTIVE" ? `0 0 6px ${c}` : "none" }} />
      {status}
    </span>
  );
}

export function VerChip({ v }: { v: string }) {
  return (
    <span className="rounded-sm border border-[#c9b3ff3d] bg-[#c9b3ff10] px-1.5 py-px font-mono text-[9.5px] font-semibold text-[#c9b3ff]">
      v{v}
    </span>
  );
}

/* ── page header for catalog modules ──────────────────────────── */
export function PageHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-sdtm">{icon}</span>
          <h1 className="font-display text-[24px] font-bold tracking-tight">{title}</h1>
        </div>
        <p className="mt-1 max-w-[640px] text-[12.5px] leading-relaxed text-dim">{subtitle}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} className={o === value ? "on" : ""} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── GxP status transition modal (21 CFR Part 11) ─────────────── */
export function StatusModal({
  entity,
  record,
  current,
  reason,
  setReason,
  onConfirm,
  onCancel,
}: {
  entity: string;
  record: string;
  current: Status;
  reason: string;
  setReason: (s: string) => void;
  onConfirm: (to: Status, reason: string) => void;
  onCancel: () => void;
}) {
  const allowed = STATUS_FLOW[current] ?? [];
  const [to, setTo] = useState<Status>(allowed[0] ?? "DRAFT");
  const [signed, setSigned] = useState(false);
  const needsSign = to === "ACTIVE";
  const valid = reason.trim().length >= 5 && (!needsSign || signed);

  return (
    <Modal onClose={onCancel} width={520}>
      <h3 className="mb-3 font-display text-[16px] font-bold">
        Status transition <span className="text-faint">— {entity}</span>
      </h3>
      <p className="text-[12.5px] text-dim">
        <span className="font-mono font-semibold text-ink">{record}</span> is currently{" "}
        <StatusBadge status={current} small />
      </p>

      <div className="mt-4">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Move to</p>
        <div className="flex flex-wrap gap-2">
          {allowed.map((s) => (
            <button
              key={s}
              onClick={() => setTo(s)}
              className={`rounded-md border px-3 py-2 font-mono text-[11px] font-semibold transition-all ${to === s ? "" : "border-line/70 text-dim hover:border-line hover:text-ink"}`}
              style={to === s ? { borderColor: STATUS_COLOR[s], color: STATUS_COLOR[s], background: `${STATUS_COLOR[s]}14`, boxShadow: `0 0 0 1px ${STATUS_COLOR[s]}55` } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Change reason <span className="text-crf">*</span> <span className="normal-case text-faint">(min 5 characters — recorded in the audit trail)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. SDTM define v1.1 publication after review cycle 2026-Q1…"
          className="field-input resize-none font-sans"
        />
      </div>

      {needsSign && (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-sdtm/30 bg-sdtm/8 px-3 py-2.5">
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} className="mt-0.5 accent-[#38c7a6]" />
          <span className="text-[11.5px] leading-relaxed text-dim">
            I understand activating <span className="font-mono text-ink">{record}</span> constitutes an{" "}
            <span className="text-sdtm">electronic signature</span> under 21 CFR Part 11 — the action is attributed to my user ID and time-stamped in the immutable audit trail.
          </span>
        </label>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-line/80 px-4 py-2 text-[12px] text-dim transition-colors hover:border-line hover:text-ink">
          Cancel
        </button>
        <button
          disabled={!valid}
          onClick={() => onConfirm(to, reason.trim())}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: STATUS_COLOR[to], color: "#07141a", boxShadow: valid ? `0 4px 18px ${STATUS_COLOR[to]}33` : "none" }}
        >
          <IconPen size={13} />
          Confirm {to.toLowerCase()}
        </button>
      </div>
    </Modal>
  );
}

/* ── simple reason prompt (version bumps, creates) ────────────── */
export function ReasonModal({
  title,
  hint,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  hint?: string;
  submitLabel: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 5;
  return (
    <Modal onClose={onCancel} width={480}>
      <h3 className="mb-2 font-display text-[16px] font-bold">{title}</h3>
      {hint && <p className="text-[12px] leading-relaxed text-dim">{hint}</p>}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Change reason (recorded in the audit trail)…"
        className="field-input mt-3 resize-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-line/80 px-4 py-2 text-[12px] text-dim hover:text-ink">
          Cancel
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(reason.trim())}
          className="rounded-md bg-sdtm px-4 py-2 text-[12px] font-semibold text-[#07141a] transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ── small stat card ──────────────────────────────────────────── */
export function StatCard({ label, value, sub, color = "#38c7a6" }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="group rounded-lg border border-line bg-deep/70 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-line/80 hover:shadow-lg hover:shadow-black/30">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">{label}</p>
      <p className="mt-1 font-display text-[26px] font-bold leading-none tabular" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[10.5px] text-dim">{sub}</p>}
    </div>
  );
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
