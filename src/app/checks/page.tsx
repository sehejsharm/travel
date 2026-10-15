"use client";

import Link from "next/link";
import { useState } from "react";
import { Checklist } from "@/components/checklist";
import { PrimaryButton } from "@/components/form";
import { PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Offers } from "@/components/offers";
import { ReferenceFreshness } from "@/components/reference-freshness";
import { FlagCard, SeveritySummary } from "@/components/flag-card";
import { EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle } from "@/components/ui";
import type { FlagSeverity } from "@/lib/domain/types";
import { offersFor } from "@/lib/partners";
import { readiness, settledFlagIds } from "@/lib/readiness";
import { useTripView } from "@/lib/store/use-store";

const FILTERS: { value: FlagSeverity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Fix first" },
  { value: "warning", label: "Worth a look" },
  { value: "info", label: "Good to know" },
];

export default function ChecksScreen() {
  const { trip, items, checklist, flags, hydrated } = useTripView();
  const [filter, setFilter] = useState<FlagSeverity | "all">("all");

  if (!hydrated) return <ScreenSkeleton variant="checks" />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Create a trip and the checks start running against it."
        action={
          <Link href="/trip/new" className={PRIMARY_BUTTON_CLASSES}>
            Start a trip
          </Link>
        }
      />
    );
  }

  const settled = settledFlagIds(checklist);
  const progress = readiness(flags, checklist);
  const isSettled = (flagId: string, title: string) => settled.has(flagId) || settled.has(title);

  // Handled checks drop to the bottom rather than vanishing, so ticking a box
  // reads as progress instead of as something going missing.
  const visible = (filter === "all" ? flags : flags.filter((flag) => flag.severity === filter))
    .slice()
    .sort(
      (a, b) =>
        Number(isSettled(a.id, a.title)) - Number(isSettled(b.id, b.title)),
    );
  const offers = offersFor(trip, items);
  const tasks = checklist.filter((entry) => entry.kind === "task");
  const packing = checklist.filter((entry) => entry.kind === "packing");

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow="Checks"
        title="What needs attention"
        meta={
          <div className="flex flex-col gap-2">
            <SeveritySummary flags={flags} settledIds={settled} />
            <span className="text-footnote text-ink-soft tabular">
              {progress.done}/{progress.total} done
              {progress.criticalSettled > 0 &&
                ` · ${progress.criticalSettled} critical ticked off`}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Checklist
          tripId={trip.id}
          title="Pre-trip tasks"
          kind="task"
          entries={tasks}
          travelers={trip.travelers}
          compact
          note="Raised by the checks below."
          emptyLabel="Nothing outstanding."
        />
        <Checklist
          tripId={trip.id}
          title="Packing list"
          kind="packing"
          entries={packing}
          travelers={trip.travelers}
          note="Built from the weather, the sockets and your plans."
          emptyLabel="Add a destination and dates and this builds itself."
        />
      </div>

      <section>
        <SectionTitle trailing={`${flags.length} checks`}>Findings</SectionTitle>

        {/* The vertical padding keeps each chip's 44px hit area and focus ring inside the scroller, which clips. */}
        <div className="no-scrollbar -mx-5 -mt-2 mb-1 flex gap-2 overflow-x-auto px-5 py-2">
          {FILTERS.map((option) => {
            const count =
              option.value === "all"
                ? flags.length
                : flags.filter((flag) => flag.severity === option.value).length;
            const active = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={active}
                className={`press tap flex min-h-8 shrink-0 items-center gap-1 rounded-badge border px-3 text-footnote ${
                  active
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-soft"
                }`}
              >
                {option.label}
                <span className="text-caption tabular">{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing to flag"
            body="Every check passed against what is filed so far."
            action={
              // Filtered to one severity, the rest are a tap away; unfiltered, the checks only
              // have more to say once more is filed.
              filter === "all" ? (
                <Link href="/add" className={PRIMARY_BUTTON_CLASSES}>
                  Add something
                </Link>
              ) : (
                <PrimaryButton type="button" onClick={() => setFilter("all")}>
                  Show all checks
                </PrimaryButton>
              )
            }
          />
        ) : (
          <ul key={filter} className="stagger flex flex-col gap-3">
            {visible.map((flag, index) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                settled={isSettled(flag.id, flag.title)}
                index={Math.min(index, 10)}
              />
            ))}
          </ul>
        )}
      </section>

      <Offers offers={offers} />

      <ReferenceFreshness />
    </div>
  );
}
