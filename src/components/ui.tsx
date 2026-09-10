import type { ReactNode } from "react";

export function ScreenHeader({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="animate-rise mb-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-strong">
        {eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight lg:text-4xl">
          {title}
        </h1>
        {action}
      </div>
      {meta && <div className="mt-2 text-sm text-ink-soft">{meta}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "li" | "article";
}) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{children}</h2>
      {trailing && <div className="font-mono text-[11px] text-ink-faint">{trailing}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-ink-soft",
  accent: "bg-accent-soft text-accent-strong",
  ok: "bg-[var(--ok-soft)] text-ok",
  warning: "bg-[var(--warning-soft)] text-warning",
  critical: "bg-[var(--critical-soft)] text-critical",
} as const;

export type Tone = keyof typeof TONES;

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const valueTone =
    tone === "critical" ? "text-critical" : tone === "ok" ? "text-ok" : "text-ink";

  return (
    <Card as="div" className="px-3.5 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular ${valueTone}`}>{value}</p>
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="opacity-60">
        <rect
          x="6"
          y="10"
          width="28"
          height="21"
          rx="3"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <path d="M13 20h14" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-ink-soft">{body}</p>
      {action}
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

/** Shown while the local store hydrates — the app's launch state. */
export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-36" />
      <Skeleton className="h-60" />
    </div>
  );
}
