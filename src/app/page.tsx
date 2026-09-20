"use client";

import Link from "next/link";
import { useState } from "react";
import { BudgetCard } from "@/components/budget-card";
import { SeveritySummary } from "@/components/flag-card";
import { ItemEditor } from "@/components/item-editor";
import { Timeline } from "@/components/timeline";
import { DeferredPrompts } from "@/components/deferred-prompts";
import { FirstRun } from "@/components/first-run";
import { GroupStatusCard } from "@/components/divert/group-status-card";
import { Onboarding } from "@/components/onboarding";
import { ReviewPrompt } from "@/components/review-prompt";
import { TripHero } from "@/components/trip-hero";
import {
  Card,
  Chip,
  EmptyState,
  ScreenSkeleton,
  SectionTitle,
  Stat,
} from "@/components/ui";
import type { TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { readiness, settledFlagIds } from "@/lib/readiness";
import { daysBetween, formatDay, formatTime, rollUpBudget } from "@/lib/rules";
import { useTripView } from "@/lib/store/use-store";

export default function TripScreen() {
  const { trip, items, flags, checklist, hydrated, empty } = useTripView();
  const [editing, setEditing] = useState<TripItem | null>(null);

  if (!hydrated) return <ScreenSkeleton />;
  if (empty || !trip) {
    return (
      <>
        <Onboarding />
        <FirstRun />
      </>
    );
  }

  const now = new Date();
  const rollup = rollUpBudget(trip, items);
  const progress = readiness(flags, checklist);
  const critical = progress.criticalOpen;
  const scheduled = items
    .filter((item) => item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const unscheduled = items.filter((item) => !item.startsAt);
  const nextUp =
    scheduled.find((item) => Date.parse(item.startsAt!) >= now.getTime()) ?? scheduled[0];

  return (
    <div className="flex flex-col gap-7">
      <TripHero trip={trip} items={items} readiness={progress} />

      <ReviewPrompt
        criticalOpen={progress.criticalOpen}
        criticalSettled={progress.criticalSettled}
        itemCount={items.length}
        tripEnded={!trip.datesTbd && daysBetween(new Date(), trip.endDate) < 0}
      />

      <DeferredPrompts trip={trip} items={items} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Scheduled" value={String(scheduled.length)} />
        <Stat label="Ideas" value={String(unscheduled.length)} />
        <Stat
          label="To fix"
          value={String(critical)}
          tone={critical > 0 ? "critical" : "ok"}
        />
      </div>

      <GroupStatusCard />

      {flags.length > 0 && (
        <Link href="/checks" className="press block">
          <Card className="flex items-center justify-between gap-3 p-4">
            <SeveritySummary flags={flags} settledIds={settledFlagIds(checklist)} />
            <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-ink-faint">
              open checks <span aria-hidden="true">›</span>
            </span>
          </Card>
        </Link>
      )}

      {nextUp && (
        <section>
          <SectionTitle>Next up</SectionTitle>
          <button
            type="button"
            onClick={() => setEditing(nextUp)}
            className="press block w-full text-left"
          >
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="accent">{formatDay(nextUp.startsAt!)}</Chip>
                {formatTime(nextUp.startsAt!) && <Chip>{formatTime(nextUp.startsAt!)}</Chip>}
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
                  .join(" · ") || "Tap to add the details"}
              </p>
            </Card>
          </button>
        </section>
      )}

      {unscheduled.length > 0 && (
        <section>
          <SectionTitle trailing={`${unscheduled.length} waiting`}>Not on a day yet</SectionTitle>
          <Card className="divide-y divide-line">
            {unscheduled.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setEditing(item)}
                className="press flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                    {item.place?.city ?? item.place?.name ?? "No place set"}
                  </span>
                </span>
                <Chip tone="accent">schedule</Chip>
              </button>
            ))}
            {unscheduled.length > 5 && (
              <Link
                href="/cabinet"
                className="press block px-4 py-3 font-mono text-[11px] text-accent-strong"
              >
                See all {unscheduled.length} →
              </Link>
            )}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Budget</SectionTitle>
        <BudgetCard rollup={rollup} />
      </section>

      <section>
        <SectionTitle>Timeline</SectionTitle>
        {scheduled.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            body="File something in the Add tab, then tap it to put it on a day."
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
          <Timeline items={items} flags={flags} onSelect={setEditing} />
        )}
      </section>

      <ItemEditor item={editing} trip={trip} onClose={() => setEditing(null)} />
    </div>
  );
}
