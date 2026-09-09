import type { Flag, FlagSeverity } from "@/lib/domain/types";

const SEVERITY_STYLES: Record<FlagSeverity, { border: string; text: string; label: string }> = {
  critical: { border: "border-l-critical", text: "text-critical", label: "Fix before you fly" },
  warning: { border: "border-l-warning", text: "text-warning", label: "Worth a look" },
  info: { border: "border-l-info", text: "text-info", label: "Good to know" },
};

export function FlagCard({ flag }: { flag: Flag }) {
  const style = SEVERITY_STYLES[flag.severity];

  return (
    <li
      className={`rounded-md border border-line ${style.border} border-l-4 bg-surface p-4 shadow-sm`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono text-[10px] uppercase tracking-[0.09em] ${style.text}`}>
          {flag.category}
        </span>
        <h3 className="font-medium">{flag.title}</h3>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">{flag.detail}</p>
      {flag.verifyWith && (
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          Reference data only — confirm with {flag.verifyWith}.
        </p>
      )}
    </li>
  );
}

export function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface p-4 text-sm text-ink-soft">
        Nothing to flag. Every check passed against what is filed so far.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {flags.map((flag) => (
        <FlagCard key={flag.id} flag={flag} />
      ))}
    </ul>
  );
}

export function FlagCounts({ flags }: { flags: Flag[] }) {
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
          <span
            key={severity}
            className={`rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] ${SEVERITY_STYLES[severity].text}`}
          >
            <span className="tabular">{counts[severity]}</span> {SEVERITY_STYLES[severity].label}
          </span>
        ))}
    </div>
  );
}
