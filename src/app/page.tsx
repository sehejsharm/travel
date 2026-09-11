"use client";

import Link from "next/link";
import { useState } from "react";
import { BudgetCard } from "@/components/budget-card";
import { SeveritySummary } from "@/components/flag-card";
import { ItemEditor } from "@/components/item-editor";
import { Timeline } from "@/components/timeline";
import { TripForm } from "@/components/trip-form";
import { TripHero } from "@/components/trip-hero";
import { heroGradient } from "@/lib/theme";
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
import { formatDay, formatTime, rollUpBudget } from "@/lib/rules";
import { loadSampleTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";

export default function TripScreen() {
  const { trip, items, flags, hydrated, empty } = useTripView();
  const [editing, setEditing] = useState<TripItem | null>(null);

  if (!hydrated) return <ScreenSkeleton />;
  if (empty || !trip) return <FirstRun />;

  const now = new Date();
  const rollup = rollUpBudget(trip, items);
  const critical = flags.filter((flag) => flag.severity === "critical").length;
  const scheduled = items
    .filter((item) => item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const unscheduled = items.filter((item) => !item.startsAt);
  const nextUp =
    scheduled.find((item) => Date.parse(item.startsAt!) >= now.getTime()) ?? scheduled[0];

  return (
    <div className="flex flex-col gap-7">
      <TripHero
        trip={trip}
        items={items}
        critical={critical}
        ready={flags.length - critical}
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
        <Stat label="Scheduled" value={String(scheduled.length)} />
        <Stat label="Ideas" value={String(unscheduled.length)} />
        <Stat label="To fix" value={String(critical)} tone={critical > 0 ? "critical" : "ok"} />
      </div>

      {flags.length > 0 && (
        <Link href="/checks" className="press block">
          <Card className="flex items-center justify-between gap-3 p-4">
            <SeveritySummary flags={flags} />
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

function FirstRun() {
  return (
    <div className="flex flex-col gap-6 py-2">
      <section
        className="animate-rise relative isolate overflow-hidden rounded-3xl p-6 text-white shadow-float sm:p-8"
        style={{ backgroundImage: heroGradient("manifest") }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
          preserveAspectRatio="none"
          viewBox="0 0 400 220"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((ring) => (
            <ellipse
              key={ring}
              cx="340"
              cy="30"
              rx={36 + ring * 44}
              ry={26 + ring * 32}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
            />
          ))}
        </svg>

        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Manifest</p>
          <h1 className="mt-2 font-display text-[30px] leading-tight font-semibold tracking-tight sm:text-4xl">
            Everything about your trip, in one file.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Send a booking email, a screenshot, or a Reel. Manifest pulls out the details, files
            them, and catches the admin that ruins trips.
          </p>

          <ul className="mt-5 flex flex-col gap-2">
            {[
              ["Catch", "Layovers too short, a museum booked on the day it is shut"],
              ["Comply", "Visa rules, passport validity and insurance, per traveller"],
              ["Count", "Every price in one currency, planned against booked"],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3 text-sm">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                <span>
                  <span className="font-medium">{title}. </span>
                  <span className="text-white/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
