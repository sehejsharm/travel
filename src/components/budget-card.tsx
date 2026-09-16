"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCountUp } from "@/lib/use-motion";
import { CATEGORY_LABELS } from "@/lib/domain/types";
import { formatMoney, RATES_AS_OF } from "@/lib/reference/fx";
import type { BudgetRollup } from "@/lib/rules";
import { Card } from "./ui";

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
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Filed spend
          </p>
          <p
            className={`mt-1 font-display text-3xl font-semibold tabular ${
              over ? "text-critical" : ""
            }`}
          >
            {formatMoney(Math.round(total), rollup.currency)}
          </p>
          {rollup.target !== undefined && (
            <p className="mt-0.5 font-mono text-[11px] text-ink-soft tabular">
              of {formatMoney(rollup.target, rollup.currency)} planned
            </p>
          )}
        </div>

        {rollup.target !== undefined && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase transition-colors duration-[var(--dur-hero)] ${
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

      {/*
        Both segments scale from the left on load rather than being painted at
        their final width, so the bar reads as filling up.
      */}
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="origin-left bg-teal transition-transform duration-[var(--dur-hero)] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ width: share(rollup.actual), transform: `scaleX(${grown})` }}
        />
        <div
          className="origin-left bg-accent/60 transition-transform delay-100 duration-[var(--dur-hero)] ease-[var(--ease-out)] motion-reduce:transition-none motion-reduce:delay-0"
          style={{ width: share(rollup.planned), transform: `scaleX(${grown})` }}
        />
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
        {rollup.unpricedCount > 0 && (
          <>
            {" · "}
            <Link
              href="/cabinet?filter=unpriced"
              className="press text-accent-strong underline underline-offset-2"
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
