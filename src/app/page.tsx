import Link from "next/link";
import { BudgetPanel } from "@/components/budget-panel";
import { Checklist } from "@/components/checklist";
import { FlagCounts, FlagList } from "@/components/flags";
import { Timeline } from "@/components/timeline";
import { generatePacking, generateTasks } from "@/lib/checklists";
import { getTrip, listChecklist, listItems, syncChecklist } from "@/lib/db";
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

  // Generated entries are added if missing; ticks and assignments are kept.
  syncChecklist(trip.id, "packing", generatePacking(trip, items));
  syncChecklist(trip.id, "task", generateTasks(flags));
  const packing = listChecklist(trip.id, "packing");
  const tasks = listChecklist(trip.id, "task");

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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <FlagCounts flags={flags} />
          <a
            href="/api/calendar"
            className="rounded-md border border-line px-3 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
          >
            Push to calendar (.ics)
          </a>
          <Link
            href={`/share/${trip.id}`}
            className="rounded-md border border-line px-3 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
          >
            Share trip page
          </Link>
          <Link
            href="/recap"
            className="rounded-md border border-line px-3 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
          >
            Recap
          </Link>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Checklist
          title="Pre-trip tasks"
          kind="task"
          entries={tasks}
          travelers={trip.travelers}
          compact
          note="Raised by the checks below. Tick them off as you go."
          emptyLabel="Nothing outstanding — every check that needs action is clear."
        />
        <Checklist
          title="Packing list"
          kind="packing"
          entries={packing}
          travelers={trip.travelers}
          emptyLabel="Add a destination and dates and this builds itself."
        />
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
