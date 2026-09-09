import { notFound } from "next/navigation";
import { getTrip, listItems } from "@/lib/db";
import { CATEGORY_LABELS, type ItemCategory, type TripItem } from "@/lib/domain/types";
import { destinationBriefs, formatDay, formatTime, localDateKey } from "@/lib/rules";

export const dynamic = "force-dynamic";

function groupByDay(items: TripItem[]): [string, TripItem[]][] {
  const byDay = new Map<string, TripItem[]>();

  for (const item of items) {
    if (!item.startsAt) continue;
    const key = localDateKey(item.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => [
      day,
      dayItems.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!)),
    ]);
}

const IDEA_CATEGORIES: ItemCategory[] = ["place", "activity"];

export default async function SharedTrip({ params }: PageProps<"/share/[tripId]">) {
  const { tripId } = await params;
  const trip = getTrip();
  if (trip.id !== tripId) notFound();

  const items = listItems(trip.id);
  const days = groupByDay(items.filter((item) => item.bookingKind !== "lodging"));
  const ideas = items.filter(
    (item) => !item.startsAt && IDEA_CATEGORIES.includes(item.category),
  );
  const briefs = destinationBriefs({ trip, items, now: new Date() });

  return (
    <article className="flex flex-col gap-10">
      <header className="border-b border-line pb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
          {briefs.map((brief) => brief.country.name).join(" · ") || "Trip"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{trip.name}</h1>
        <p className="mt-2 font-mono text-xs text-ink-soft tabular">
          {formatDay(trip.startDate)} – {formatDay(trip.endDate)} ·{" "}
          {trip.travelers.map((traveler) => traveler.name).join(" & ")}
        </p>
        <p className="mt-4 max-w-prose text-sm text-ink-soft">
          A read-only view of this trip. Prices and confirmation numbers stay private — this page
          shows the plan, not the paperwork.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl font-semibold">The plan</h2>
        {days.map(([day, dayItems]) => (
          <div key={day} className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.09em] text-ink-faint">
              {formatDay(dayItems[0].startsAt!)}
            </h3>
            <ul className="flex flex-col gap-2 border-l border-line pl-4">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="font-mono text-[11px] text-ink-faint">
                    {formatTime(item.startsAt!)}
                    {item.place ? ` · ${item.place.city ?? item.place.name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {ideas.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Still on the list</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ideas.map((item) => (
              <li key={item.id} className="rounded-md border border-line bg-surface p-3">
                <p className="text-sm">{item.title}</p>
                <p className="font-mono text-[11px] text-ink-faint">
                  {CATEGORY_LABELS[item.category]}
                  {item.place?.city ? ` · ${item.place.city}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Good to know</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {briefs.map(({ country }) => (
            <div key={country.code}>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-accent-2">
                {country.name}
              </dt>
              <dd className="text-sm text-ink-soft">
                Emergency {country.emergency} · money in {country.currency} · plugs Type{" "}
                {country.plugTypes.join("/")}
              </dd>
              <dd className="text-sm text-ink-soft">{country.tipping}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-line pt-5 font-mono text-[11px] text-ink-faint">
        {items.length} items filed · {items.filter((item) => item.cost).length} with a price
        attached · totals hidden on shared pages
      </footer>
    </article>
  );
}
