"use client";

import { useState } from "react";
import { Checklist } from "@/components/checklist";
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
          <div className="flex flex-col gap-1.5">
            <SeveritySummary flags={flags} settledIds={settled} />
            <span className="font-mono text-[11px] text-ink-faint tabular">
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

        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
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
                className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  active
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-soft"
                }`}
              >
                {option.label}
                <span className="ml-1.5 font-mono text-[10px] tabular opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing to flag"
            body="Every check passed against what is filed so far."
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
