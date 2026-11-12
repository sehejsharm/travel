import type { Flag, FlagSeverity } from "@/lib/domain/types";
import { Card, Chip, type Tone } from "./ui";

// Good to know is not a status, so it is neutral: ok is kept for a check that is done.
const SEVERITY: Record<FlagSeverity, { tone: Tone; label: string }> = {
  critical: { tone: "critical", label: "Fix before you fly" },
  warning: { tone: "warning", label: "Worth a look" },
  info: { tone: "neutral", label: "Good to know" },
};

/** The words for a severity, for the headings the Checks screen groups findings under. */
export function severityLabel(severity: FlagSeverity): string {
  return SEVERITY[severity].label;
}

/** `settled` means its pre-trip task has been ticked, so it reads as handled. */
export function FlagCard({
  flag,
  settled = false,
  index = 0,
}: {
  flag: Flag;
  settled?: boolean;
  /** Position in the list, for the shared stagger. */
  index?: number;
}) {
  const severity = SEVERITY[flag.severity];

  return (
    <Card
      as="li"
      className={`raised flex overflow-hidden transition-opacity duration-300 ease-[var(--ease-spring)] ${
        settled ? "opacity-60" : ""
      }`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="min-w-0 flex-1 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={settled ? "ok" : severity.tone}>{settled ? "done" : flag.category}</Chip>
          {/* An h4: the Checks screen sets each card under its severity's h3. */}
          <h4 className={`text-headline ${settled ? "text-ink-soft line-through" : ""}`}>
            {flag.title}
          </h4>
        </div>
        <p className="mt-1 text-subheadline text-ink-soft">{flag.detail}</p>
        {flag.verifyWith && (
          <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-caption text-ink-soft">
            Reference data: confirm with {flag.verifyWith}.
          </p>
        )}
      </div>
    </Card>
  );
}

export function SeveritySummary({
  flags,
  settledIds,
}: {
  flags: Flag[];
  /** Ticked-off checks are counted out, so the strip tracks the ring. */
  settledIds?: Set<string>;
}) {
  const open = settledIds
    ? flags.filter((flag) => !settledIds.has(flag.id) && !settledIds.has(flag.title))
    : flags;

  const counts = {
    critical: open.filter((flag) => flag.severity === "critical").length,
    warning: open.filter((flag) => flag.severity === "warning").length,
    info: open.filter((flag) => flag.severity === "info").length,
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(counts) as FlagSeverity[])
        .filter((severity) => counts[severity] > 0)
        .map((severity) => (
          <Chip key={severity} tone={SEVERITY[severity].tone}>
            <span className="tabular">{counts[severity]}</span> {SEVERITY[severity].label}
          </Chip>
        ))}
    </div>
  );
}
