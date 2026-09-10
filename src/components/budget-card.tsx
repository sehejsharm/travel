import { CATEGORY_LABELS } from "@/lib/domain/types";
import { formatMoney, RATES_AS_OF } from "@/lib/reference/fx";
import type { BudgetRollup } from "@/lib/rules";
import { Card } from "./ui";

export function BudgetCard({ rollup }: { rollup: BudgetRollup }) {
  const ceiling = Math.max(rollup.total, rollup.target ?? 0) || 1;
  const over = rollup.target !== undefined && rollup.total > rollup.target;
  const share = (value: number) => `${Math.max(0, (value / ceiling) * 100)}%`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Filed spend
          </p>
          <p
            className={`mt-1 font-display text-3xl font-semibold tabular ${
              over ? "text-critical" : ""
            }`}
          >
            {formatMoney(rollup.total, rollup.currency)}
          </p>
          {rollup.target !== undefined && (
            <p className="mt-0.5 font-mono text-[11px] text-ink-soft tabular">
              of {formatMoney(rollup.target, rollup.currency)} planned
            </p>
          )}
        </div>

        {rollup.target !== undefined && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
              over
                ? "bg-[var(--critical-soft)] text-critical"
                : "bg-[var(--ok-soft)] text-ok"
            }`}
          >
            {over
              ? `${formatMoney(rollup.total - rollup.target, rollup.currency)} over`
              : `${formatMoney(rollup.target - rollup.total, rollup.currency)} left`}
          </span>
        )}
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-teal" style={{ width: share(rollup.actual) }} />
        <div className="bg-accent/60" style={{ width: share(rollup.planned) }} />
      </div>

      <dl className="mt-4 flex flex-col gap-2">
        {rollup.lines.map((line) => (
          <div key={line.category} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-ink-soft">{CATEGORY_LABELS[line.category]}</dt>
            <dd className="font-mono text-[12px] text-ink-soft tabular">
              {formatMoney(line.planned + line.actual, rollup.currency)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
        <span className="text-teal">booked</span> {formatMoney(rollup.actual, rollup.currency)} ·{" "}
        <span className="text-accent-strong">estimated</span>{" "}
        {formatMoney(rollup.planned, rollup.currency)}
        {rollup.unpricedCount > 0 && ` · ${rollup.unpricedCount} with no price yet`}
        <br />
        rates as of {RATES_AS_OF}
      </p>
    </Card>
  );
}
