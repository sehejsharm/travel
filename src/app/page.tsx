import Link from "next/link";
import { BudgetPanel } from "@/components/budget-panel";
import { FlagCounts, FlagList } from "@/components/flags";
import { Timeline } from "@/components/timeline";
import { getTrip, listItems } from "@/lib/db";
import {
  daysBetween,
  destinationBriefs,
  formatDay,
  rollUpBudget,
  runChecks,
} from "@/lib/rules";

export const dynamic = "force-dynamic";

export default function PlanningDesk() {
  const trip = getTrip();
  const items = listItems(trip.id);
  const now = new Date();

  const flags = runChecks(trip, items, now);
  const rollup = rollUpBudget(trip, items);
  const briefs = destinationBriefs({ trip, items, now });
  const daysToGo = Math.ceil(daysBetween(now, trip.startDate));
  const unscheduled = items.filter((item) => !item.startsAt).length;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
          Planning desk
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold">{trip.name}</h1>
        <p className="mt-1 font-mono text-xs text-ink-soft tabular">
          {formatDay(trip.startDate)} – {formatDay(trip.endDate)}
          {daysToGo > 0 && ` · ${daysToGo} days to go`} ·{" "}
          {trip.travelers.map((traveler) => traveler.name).join(", ")}
        </p>
        <div className="mt-3">
          <FlagCounts flags={flags} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Trip timeline</h2>
            {unscheduled > 0 && (
              <Link href="/cabinet" className="font-mono text-[11px] text-accent-strong underline">
                {unscheduled} filed but unscheduled
              </Link>
            )}
          </div>
          <Timeline items={items} flags={flags} />
        </section>

        <div className="flex flex-col gap-6">
          <BudgetPanel rollup={rollup} />

          {briefs.length > 0 && (
            <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">On the ground</h2>
              <dl className="mt-3 flex flex-col gap-3">
                {briefs.map(({ country, hoursFromHome }) => (
                  <div key={country.code} className="flex flex-col gap-1">
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-accent-2">
                      {country.name}
                    </dt>
                    <dd className="text-sm text-ink-soft">
                      Emergency {country.emergency} · {country.currency} ·{" "}
                      <span className="tabular">
                        {hoursFromHome > 0 ? "+" : ""}
                        {hoursFromHome}h
                      </span>{" "}
                      from home
                    </dd>
                    <dd className="text-sm text-ink-soft">{country.tipping}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">What needs attention</h2>
          <p className="font-mono text-[11px] text-ink-faint tabular">
            {flags.length} checks flagged
          </p>
        </div>
        <FlagList flags={flags} />
      </section>
    </div>
  );
}
