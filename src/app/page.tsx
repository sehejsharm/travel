"use client";

import Link from "next/link";
import { useState } from "react";
import { BudgetCard } from "@/components/budget-card";
import { SeveritySummary } from "@/components/flag-card";
import { ItemEditor } from "@/components/item-editor";
import { Timeline } from "@/components/timeline";
import { TripForm } from "@/components/trip-form";
import {
  Card,
  Chip,
  EmptyState,
  ScreenHeader,
  ScreenSkeleton,
  SectionTitle,
  Stat,
} from "@/components/ui";
import type { TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { daysBetween, formatDay, formatTime, rollUpBudget } from "@/lib/rules";
import { loadSampleTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";

export default function TripScreen() {
  const { trip, items, flags, hydrated, empty } = useTripView();
  const [editing, setEditing] = useState<TripItem | null>(null);

  if (!hydrated) return <ScreenSkeleton />;
  if (empty || !trip) return <FirstRun />;

  const now = new Date();
  const rollup = rollUpBudget(trip, items);
  const daysToGo = Math.ceil(daysBetween(now, trip.startDate));
  const critical = flags.filter((flag) => flag.severity === "critical").length;
  const scheduled = items
    .filter((item) => item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const unscheduled = items.filter((item) => !item.startsAt);
  const nextUp =
    scheduled.find((item) => Date.parse(item.startsAt!) >= now.getTime()) ?? scheduled[0];

  return (
    <div className="flex flex-col gap-7">
      <ScreenHeader
        eyebrow={daysToGo > 0 ? `${daysToGo} days to go` : "In progress"}
        title={trip.name}
        meta={
          <>
            {formatDay(trip.startDate)} – {formatDay(trip.endDate)}
            {trip.travelers.length > 0 &&
              ` · ${trip.travelers.map((traveler) => traveler.name).join(" & ")}`}
          </>
        }
        action={
          <Link
            href="/trip"
            className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            Edit trip
          </Link>
        }
      />

      {trip.travelers.length === 0 && (
        <Link href="/trip" className="press block">
          <Card className="border-warning p-4">
            <p className="text-sm font-medium">Add a traveller to switch on the checks</p>
            <p className="mt-1 text-xs text-ink-soft">
              Visa rules, passport validity and insurance cover all need a passport country and an
              expiry date.
            </p>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Days to go" value={daysToGo > 0 ? String(daysToGo) : "0"} />
        <Stat label="Filed" value={String(items.length)} />
        <Stat label="To fix" value={String(critical)} tone={critical > 0 ? "critical" : "ok"} />
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
            <span aria-hidden="true" className="shrink-0 text-ink-faint">
              ›
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

function FirstRun() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Everything about your trip, in one file.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          Forward a booking email, a screenshot, or a Reel. Manifest pulls out the details, files
          them, and catches the admin that ruins trips — visas, layovers that are too short, a
          museum booked on the day it is shut.
        </p>
      </div>

      <Card className="p-5">
        <TripForm onDone={() => undefined} submitLabel="Create my trip" />
      </Card>

      <button
        type="button"
        onClick={() => loadSampleTrip()}
        className="press mx-auto font-mono text-[11px] text-accent-strong underline"
      >
        or explore a sample trip first
      </button>
    </div>
  );
}
