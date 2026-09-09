import { CATEGORY_LABELS } from "@/lib/domain/types";
import { formatMoney, RATES_AS_OF } from "@/lib/reference/fx";
import type { BudgetRollup } from "@/lib/rules";

export function BudgetPanel({ rollup }: { rollup: BudgetRollup }) {
  const ceiling = Math.max(rollup.total, rollup.target ?? 0) || 1;
  const overBudget = rollup.target !== undefined && rollup.total > rollup.target;

  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Budget</h2>
        <p className="font-mono text-[11px] text-ink-faint">
          built from filed items · rates as of {RATES_AS_OF}
        </p>
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-2">
        <span
          className={`font-display text-3xl font-semibold tabular ${
            overBudget ? "text-critical" : ""
          }`}
        >
          {formatMoney(rollup.total, rollup.currency)}
        </span>
        {rollup.target !== undefined && (
          <span className="font-mono text-xs text-ink-soft tabular">
            of {formatMoney(rollup.target, rollup.currency)} planned
          </span>
        )}
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {rollup.lines.map((line) => {
          const lineTotal = line.planned + line.actual;
          return (
            <li key={line.category}>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-ink-soft">{CATEGORY_LABELS[line.category]}</span>
                <span className="tabular font-mono text-ink-soft">
                  {formatMoney(lineTotal, rollup.currency)}
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-sm bg-surface-2">
                <div
                  className="bg-accent-2"
                  style={{ width: `${(line.actual / ceiling) * 100}%` }}
                  title={`Booked: ${formatMoney(line.actual, rollup.currency)}`}
                />
                <div
                  className="bg-accent/50"
                  style={{ width: `${(line.planned / ceiling) * 100}%` }}
                  title={`Estimated: ${formatMoney(line.planned, rollup.currency)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-[11px] text-ink-faint">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-accent-2 align-middle" /> booked{" "}
          <span className="tabular">{formatMoney(rollup.actual, rollup.currency)}</span>
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-accent/50 align-middle" /> estimated{" "}
          <span className="tabular">{formatMoney(rollup.planned, rollup.currency)}</span>
        </span>
        {rollup.unpricedCount > 0 && (
          <span className="tabular">{rollup.unpricedCount} items with no price yet</span>
        )}
      </div>
    </section>
  );
}
