import type { Flag, FlagSeverity } from "@/lib/domain/types";
import { Card, Chip, type Tone } from "./ui";

const SEVERITY: Record<
  FlagSeverity,
  { tone: Tone; rail: string; label: string }
> = {
  critical: { tone: "critical", rail: "bg-critical", label: "Fix before you fly" },
  warning: { tone: "warning", rail: "bg-warning", label: "Worth a look" },
  info: { tone: "ok", rail: "bg-ok", label: "Good to know" },
};

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
  // An unresolved conflict is the one severity that is about to cost you
  // something, so it gets a second signal beyond colour and label.
  const urgent = !settled && flag.severity === "critical";

  return (
    <Card
      as="li"
      className={`liftable raised flex overflow-hidden transition-opacity duration-[var(--dur-move)] ${
        settled ? "opacity-60" : ""
      }`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <span
        className={`w-1 shrink-0 transition-colors duration-[var(--dur-move)] ${
          settled ? "bg-ok" : severity.rail
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={settled ? "ok" : severity.tone}>
            {urgent && (
              <span
                aria-hidden="true"
                className={`animate-pulse-dot mr-0.5 h-1.5 w-1.5 rounded-full ${severity.rail}`}
              />
            )}
            {settled ? "done" : flag.category}
          </Chip>
          <h3
            className={`text-[15px] leading-snug font-medium ${
              settled ? "text-ink-faint line-through" : ""
            }`}
          >
            {flag.title}
          </h3>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{flag.detail}</p>
        {flag.verifyWith && (
          <p className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-ink-faint">
            Reference data — confirm with {flag.verifyWith}.
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
