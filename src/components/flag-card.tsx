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

export function FlagCard({ flag }: { flag: Flag }) {
  const severity = SEVERITY[flag.severity];

  return (
    <Card as="li" className="animate-rise flex overflow-hidden">
      <span className={`w-1 shrink-0 ${severity.rail}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={severity.tone}>{flag.category}</Chip>
          <h3 className="text-[15px] leading-snug font-medium">{flag.title}</h3>
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

export function SeveritySummary({ flags }: { flags: Flag[] }) {
  const counts = {
    critical: flags.filter((flag) => flag.severity === "critical").length,
    warning: flags.filter((flag) => flag.severity === "warning").length,
    info: flags.filter((flag) => flag.severity === "info").length,
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
