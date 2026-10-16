// Shared UI kit — see DESIGN.md for when to use what.
// Build screens out of these so Split and Chores look like one app.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { formatPence } from "@/lib/money";

// ─── Actions ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  secondary: "bg-surface-2 text-foreground hover:bg-border/70",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "bg-negative-soft text-negative hover:opacity-90",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "h-9 px-3.5 text-sm rounded-full" : "h-12 px-5 rounded-2xl";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${sizing} ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

/** Floating "add" button, bottom-right above the tab bar. One per screen. */
export function Fab({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 mx-auto flex max-w-md justify-end px-4 lg:bottom-8 lg:left-60 lg:max-w-3xl lg:px-10">
      <button
        onClick={onClick}
        className="pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-fg shadow-lg shadow-black/15 transition duration-150 active:scale-95"
      >
        <Plus size={20} strokeWidth={2.5} />
        {label}
      </button>
    </div>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export function Input({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = (
    <input
      className={`h-12 w-full rounded-2xl border border-transparent bg-surface px-4 outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15 ${className}`}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-muted">
      {label}
      {input}
    </label>
  );
}

/** iOS-style segmented toggle, e.g. Equal / £ / %. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 flex-1 rounded-xl text-sm font-medium transition duration-150 ${
            o.value === value ? "bg-surface text-foreground shadow-sm" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-5 ${className}`}>{children}</div>;
}

/** A titled block of a screen. Screens are a vertical stack of Sections. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex min-h-6 items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Container for ListRows — rows are separated by hairlines. */
export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/70 overflow-hidden rounded-3xl bg-surface">{children}</div>;
}

/** The standard row: leading visual · title/subtitle · trailing value. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-16 items-center gap-3.5 px-4 py-3 ${onClick ? "cursor-pointer transition-colors active:bg-surface-2" : ""}`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-sm text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}

/** Pulsing placeholder. Compose these into the shape of the real layout while loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none ${className}`} />;
}

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface px-6 py-10 text-center text-sm text-muted">
      {icon}
      {children}
    </div>
  );
}

/** Bottom sheet for every create/edit form. Controlled: pass open + onClose. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    // Phone: bottom sheet. sm and up: centred dialog.
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet-up sm:animate-pop-in relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-background p-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:p-6 sm:shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition active:scale-95" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Data display ────────────────────────────────────────────────────────────

const hueOf = (name: string) => [...name].reduce((h, c) => h + c.charCodeAt(0) * 7, 0) % 360;

/** Each flatmate gets a stable colour from their name. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hueOf(name)} 55% 52%)` }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function AvatarStack({ names, size = 28 }: { names: string[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {names.map((n, i) => (
        <Avatar key={i} name={n} size={size} />
      ))}
    </div>
  );
}

type BadgeTone = "neutral" | "accent" | "positive" | "negative" | "warning";

const badgeStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyles[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Money is always shown through this. `signed` colours it from the viewer's perspective:
 * positive = you are owed (green), negative = you owe (red).
 */
export function Amount({ pence, signed = false, className = "" }: { pence: number; signed?: boolean; className?: string }) {
  const tone = !signed || pence === 0 ? "" : pence > 0 ? "text-positive" : "text-negative";
  const text = signed && pence > 0 ? `+${formatPence(pence)}` : formatPence(signed ? pence : Math.abs(pence));
  return <span className={`font-semibold tabular-nums ${tone} ${className}`}>{text}</span>;
}

/** Chore weight as 1–5 dots. */
export function WeightDots({ weight }: { weight: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${weight} points`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= weight ? "bg-accent" : "bg-border"}`} />
      ))}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "positive" }) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone === "accent" ? "bg-accent" : "bg-positive"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
