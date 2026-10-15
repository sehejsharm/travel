"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCountUp } from "@/lib/use-motion";
import { CATEGORY_LABELS } from "@/lib/domain/types";
import { formatMoney, RATES_AS_OF } from "@/lib/reference/fx";
import type { BudgetRollup } from "@/lib/rules";
import { Card, Chip } from "./ui";

export function BudgetCard({ rollup }: { rollup: BudgetRollup }) {
  const ceiling = Math.max(rollup.total, rollup.target ?? 0) || 1;
  const over = rollup.target !== undefined && rollup.total > rollup.target;
  const share = (value: number) => `${Math.max(0, (value / ceiling) * 100)}%`;

  // 0 on the first client frame, 1 after — which is what the bar animates
  // between. An effect rather than a class so it also replays on remount.
  const [grown, setGrown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(1));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = useCountUp(rollup.total, 800);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-footnote text-ink-soft">Filed spend</p>
          <p className={`mt-1 text-title-1 tabular ${over ? "text-critical" : ""}`}>
            {formatMoney(Math.round(total), rollup.currency)}
          </p>
          {rollup.target !== undefined && (
            <p className="mt-1 text-footnote text-ink-soft tabular">
              of {formatMoney(rollup.target, rollup.currency)} planned
            </p>
          )}
        </div>

        {rollup.target !== undefined && (
          <Chip
            tone={over ? "critical" : "ok"}
            className="shrink-0 tabular transition-colors duration-300 ease-[var(--ease-spring)]"
          >
            {over
              ? `${formatMoney(rollup.total - rollup.target, rollup.currency)} over`
              : `${formatMoney(rollup.target - rollup.total, rollup.currency)} left`}
          </Chip>
        )}
      </div>

      {/*
        Both segments scale from the left on load rather than being painted at
        their final width, so the bar reads as filling up.
      */}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="origin-left bg-teal transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ width: share(rollup.actual), transform: `scaleX(${grown})` }}
        />
        <div
          className="origin-left bg-accent/60 transition-transform delay-100 duration-300 ease-[var(--ease-out)] motion-reduce:transition-none motion-reduce:delay-0"
          style={{ width: share(rollup.planned), transform: `scaleX(${grown})` }}
        />
      </div>

      <dl className="mt-4 flex flex-col gap-2">
        {rollup.lines.map((line) => (
          <div key={line.category} className="flex items-center justify-between gap-3 text-subheadline">
            <dt className="text-ink-soft">{CATEGORY_LABELS[line.category]}</dt>
            <dd className="text-ink-soft tabular">
              {formatMoney(line.planned + line.actual, rollup.currency)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-line pt-3 text-caption text-ink-soft tabular">
        <span className="text-teal">booked</span> {formatMoney(rollup.actual, rollup.currency)} ·{" "}
        <span className="text-accent-strong">estimated</span>{" "}
        {formatMoney(rollup.planned, rollup.currency)}
        {rollup.unpricedCount > 0 && (
          <>
            {" · "}
            <Link
              href="/cabinet?filter=unpriced"
              className="press tap inline-block text-accent-strong underline underline-offset-2"
            >
              {rollup.unpricedCount} with no price yet
            </Link>
          </>
        )}
        <br />
        rates as of {RATES_AS_OF}
      </p>
    </Card>
  );
}
