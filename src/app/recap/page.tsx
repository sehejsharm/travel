"use client";

import Link from "next/link";
import { BORDERLESS_BUTTON_CLASSES, PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Card, EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle, Stat } from "@/components/ui";
import { SOURCE_LABELS } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { buildRecap } from "@/lib/recap";
import { formatDay } from "@/lib/rules";
import { useTripView } from "@/lib/store/use-store";

const STATUS_COPY = {
  upcoming: "This trip has not started yet, so this is a preview of what the recap will hold.",
  "under way": "You are on this trip now — the numbers move as things get filed.",
  complete: "Here is how the trip actually went.",
} as const;

export default function RecapScreen() {
  const { trip, items, hydrated } = useTripView();
  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Create a trip and the recap fills in."
        action={
          <Link href="/trip/new" className={PRIMARY_BUTTON_CLASSES}>
            Start a trip
          </Link>
        }
      />
    );
  }

  const recap = buildRecap(trip, items, new Date());
  const mostUsed = recap.bySource[0];

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader eyebrow="Recap" title={trip.name} meta={STATUS_COPY[recap.status]} />

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Nights" value={String(recap.nights)} />
        <Stat label="Places" value={String(recap.placesVisited)} />
        <Stat label="Activities" value={String(recap.activities)} />
        <Stat label="Countries" value={recap.countries.join(", ") || "—"} />
        <Stat label="Booked" value={formatMoney(recap.booked, recap.currency)} />
        <Stat label="Estimated" value={formatMoney(recap.estimated, recap.currency)} />
      </div>

      <section>
        <SectionTitle>Where this trip came from</SectionTitle>
        <Card className="p-5">
          <p className="text-subheadline text-ink-soft">
            Every item, traced back to whatever you forwarded in.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {recap.bySource.map(({ source, count }) => (
              <li key={source}>
                <div className="flex justify-between gap-3 text-footnote">
                  <span className="text-ink-soft">{SOURCE_LABELS[source]}</span>
                  <span className="text-ink-soft tabular">{count}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${(count / Math.max(1, items.length)) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {mostUsed && (
            <p className="mt-4 border-t border-line pt-3 text-subheadline text-ink-soft">
              Most of this trip arrived as{" "}
              <span className="font-medium text-ink">{SOURCE_LABELS[mostUsed.source]}</span>{" "}
              content — {mostUsed.count} of {items.length} items.
            </p>
          )}
        </Card>
      </section>

      {recap.busiestDay && (
        <section>
          <SectionTitle>Busiest day</SectionTitle>
          <Card className="p-5">
            <p className="text-title-2">{formatDay(recap.busiestDay.date)}</p>
            <p className="mt-1 text-subheadline text-ink-soft">
              {recap.busiestDay.count} things booked.
            </p>
          </Card>
        </section>
      )}

      <Link href="/more" className={`${BORDERLESS_BUTTON_CLASSES} -ml-3 self-start`}>
        Back to more
      </Link>
    </div>
  );
}
