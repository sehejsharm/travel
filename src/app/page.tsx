"use client";

import Link from "next/link";
import { BudgetCard } from "@/components/budget-card";
import { SeveritySummary } from "@/components/flag-card";
import { Timeline } from "@/components/timeline";
import { Card, Chip, EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle, Stat } from "@/components/ui";
import { useTripView } from "@/lib/store/use-store";
import { formatMoney } from "@/lib/reference/fx";
import { daysBetween, formatDay, formatTime, rollUpBudget } from "@/lib/rules";

export default function TripScreen() {
  const { trip, items, flags, hydrated } = useTripView();
  if (!hydrated) return <ScreenSkeleton />;

  const now = new Date();
  const rollup = rollUpBudget(trip, items);
  const daysToGo = Math.ceil(daysBetween(now, trip.startDate));
  const critical = flags.filter((flag) => flag.severity === "critical").length;
  const scheduled = items
    .filter((item) => item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const nextUp = scheduled.find((item) => Date.parse(item.startsAt!) >= now.getTime()) ?? scheduled[0];

  return (
    <div className="flex flex-col gap-7">
      <ScreenHeader
        eyebrow={daysToGo > 0 ? `${daysToGo} days to go` : "In progress"}
        title={trip.name}
        meta={
          <>
            {formatDay(trip.startDate)} – {formatDay(trip.endDate)} ·{" "}
            {trip.travelers.map((traveler) => traveler.name).join(" & ")}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Days to go" value={daysToGo > 0 ? String(daysToGo) : "0"} />
        <Stat label="Filed" value={String(items.length)} />
        <Stat
          label="To fix"
          value={String(critical)}
          tone={critical > 0 ? "critical" : "ok"}
        />
      </div>

      {flags.length > 0 && (
        <Link href="/checks" className="press block">
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {critical > 0
                  ? `${critical} thing${critical === 1 ? "" : "s"} to fix before you fly`
                  : "Everything critical is clear"}
              </p>
              <div className="mt-2">
                <SeveritySummary flags={flags} />
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-ink-faint">
              <path
                d="m9 6 6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Card>
        </Link>
      )}

      {nextUp && (
        <section>
          <SectionTitle>Next up</SectionTitle>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="accent">{formatDay(nextUp.startsAt!)}</Chip>
              {formatTime(nextUp.startsAt!) && (
                <Chip>{formatTime(nextUp.startsAt!)}</Chip>
              )}
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
              {nextUp.title}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {[
                nextUp.place?.name,
                nextUp.cost && formatMoney(nextUp.cost.amount, nextUp.cost.currency),
                nextUp.confirmationCode && `Ref ${nextUp.confirmationCode}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Budget</SectionTitle>
        <BudgetCard rollup={rollup} />
      </section>

      <section>
        <SectionTitle
          trailing={
            <Link href="/cabinet" className="underline">
              {items.filter((item) => !item.startsAt).length} unscheduled
            </Link>
          }
        >
          Timeline
        </SectionTitle>

        {scheduled.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            body="Anything you file with a date and time lands here, day by day."
            action={
              <Link
                href="/add"
                className="press mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
              >
                Add something
              </Link>
            }
          />
        ) : (
          <Timeline items={items} flags={flags} />
        )}
      </section>
    </div>
  );
}
