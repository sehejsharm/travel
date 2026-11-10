"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCountUp } from "@/lib/use-motion";

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
      <p className="flex items-center gap-2 text-caption uppercase text-accent-strong">
        <span aria-hidden="true" className="h-px w-4 bg-accent" />
        {eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        {/* Apple's large title: bold, tracked in, set tight. */}
        <h1 className="text-large-title lg:text-display">{title}</h1>
        {action}
      </div>
      {meta && <div className="mt-2 text-subheadline text-ink-soft">{meta}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "li" | "article";
  /** Mostly the stagger index; kept narrow rather than spreading all props. */
  style?: CSSProperties;
}) {
  // Tailwind orders same-property utilities itself, so a caller's border colour
  // could lose to border-line. Leave the hairline out when one is given.
  const tinted =
    /(?:^|\s)(?:[a-z-]+:)*border-(?:accent|critical|warning|ok|teal|brand|ink|line-strong|transparent)(?![\w-])/.test(
      className,
    );
  return (
    <Tag
      style={style}
      className={`rounded-card border bg-surface shadow-card ${tinted ? "" : "border-line"} ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * A long screen's next step, kept in reach while the screen scrolls: a bar
 * stacked on the tab bar on a phone, a panel floating off the bottom on a wide
 * screen. Where it sits is .action-bar's job (globals.css). Put it last.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="action-bar nav-surface z-20 border-t border-line py-3 lg:mx-0 lg:rounded-sheet lg:border lg:p-2 lg:shadow-float">
      {children}
    </div>
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
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-title-3">{children}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {trailing && <div className="text-footnote text-ink-soft tabular">{trailing}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-ink-soft",
  accent: "bg-accent-soft text-accent-strong",
  ok: "bg-ok-soft text-ok",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
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
      className={`inline-flex items-center gap-1 rounded-badge px-2 py-1 text-caption ${TONES[tone]} ${className}`}
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

  // Most callers pass a plain count (items filed, nights, things to fix) —
  // that one tweens in on mount rather than appearing as a flat number.
  // Anything else (a joined country list, a formatted money string) is
  // printed as given, since there is nothing numeric to animate.
  const numeric = /^-?\d+$/.test(value) ? Number(value) : null;
  const tweened = useCountUp(numeric ?? 0, 700);
  const display = numeric === null ? value : String(Math.round(tweened));

  return (
    <Card as="div" className="raised px-4 py-3">
      <p className="text-caption text-ink-soft">{label}</p>
      <p className={`mt-1 text-title-1 tabular ${valueTone}`}>{display}</p>
    </Card>
  );
}

/**
 * Apple's empty state: a muted line icon, a bold title, a sentence on why
 * there is nothing here, and the one action that fills it. The action is
 * required, so an empty screen is never a dead end.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <Card className="raised flex flex-col items-center gap-2 px-6 py-10 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="animate-float mb-2">
        {/* A tray, drawn at a thin stroke the way an SF Symbol is. */}
        <path
          d="M8 27 13 12.5A3 3 0 0 1 15.8 10.5h16.4a3 3 0 0 1 2.8 2L40 27v8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 27h9l2 4h10l2-4h9"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-title-3">{title}</p>
      <p className="max-w-sm text-subheadline text-ink-soft">{body}</p>
      <div className="mt-4 w-full max-w-xs">{action}</div>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-card ${className}`} />;
}

/**
 * Shown while the local store hydrates. Each variant mirrors the shape of the
 * screen behind it, so the page settles into place rather than jumping — once
 * a trip has months of screenshots and notes in it, this is on screen long
 * enough for the difference to matter.
 */
export function ScreenSkeleton({
  variant = "trip",
}: {
  variant?: "trip" | "list" | "checks";
}) {
  if (variant === "list") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-11" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-7 w-20 rounded-badge" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "checks") {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-52" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-5 w-28" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-52 rounded-container" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-36" />
      <Skeleton className="h-60" />
    </div>
  );
}
