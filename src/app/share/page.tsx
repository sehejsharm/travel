"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, ScreenSkeleton } from "@/components/ui";
import { CATEGORY_LABELS, type ItemCategory, type TripItem } from "@/lib/domain/types";
import { decodeTrip } from "@/lib/share";
import type { AppState } from "@/lib/store/state";
import { destinationBriefs, formatDay, formatTime, localDateKey } from "@/lib/rules";

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

export default function SharedTrip() {
  const [state, setState] = useState<AppState | null | undefined>(undefined);

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "");
    if (!token) {
      setState(null);
      return;
    }
    decodeTrip(token).then((decoded) => setState(decoded ?? null));
  }, []);

  if (state === undefined) return <ScreenSkeleton />;

  if (state === null) {
    return (
      <Card className="p-8 text-center">
        <h1 className="font-display text-xl font-semibold">This link has nothing in it</h1>
        <p className="mt-2 text-sm text-ink-soft">
          A shared trip travels inside the link itself, so it has to be copied whole.
        </p>
        <Link
          href="/"
          className="press mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          Open Manifest
        </Link>
      </Card>
    );
  }

  const { trip, items } = state;
  const days = groupByDay(items.filter((item) => item.bookingKind !== "lodging"));
  const ideas = items.filter(
    (item) => !item.startsAt && IDEA_CATEGORIES.includes(item.category),
  );
  const briefs = destinationBriefs({ trip, items, now: new Date() });

  return (
    <article className="flex flex-col gap-10">
      <header className="border-b border-line pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-strong">
          {briefs.map((brief) => brief.country.name).join(" · ") || "Trip"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{trip.name}</h1>
        <p className="mt-2 font-mono text-xs text-ink-soft tabular">
          {formatDay(trip.startDate)} – {formatDay(trip.endDate)} ·{" "}
          {trip.travelers.map((traveler) => traveler.name).join(" & ")}
        </p>
        <p className="mt-4 max-w-prose text-sm text-ink-soft">
          A read-only view. Prices and confirmation numbers were left behind — this is the plan,
          not the paperwork.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">The plan</h2>
        {days.map(([day, dayItems]) => (
          <div key={day} className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {formatDay(dayItems[0].startsAt!)}
            </h3>
            <ul className="flex flex-col gap-3 border-l border-line pl-4">
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
          <h2 className="font-display text-xl font-semibold tracking-tight">Still on the list</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ideas.map((item) => (
              <Card as="li" key={item.id} className="p-3">
                <p className="text-sm">{item.title}</p>
                <p className="font-mono text-[11px] text-ink-faint">
                  {CATEGORY_LABELS[item.category]}
                  {item.place?.city ? ` · ${item.place.city}` : ""}
                </p>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {briefs.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Good to know</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {briefs.map(({ country }) => (
              <div key={country.code}>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-teal">
                  {country.name}
                </dt>
                <dd className="text-sm text-ink-soft">
                  Emergency {country.emergency} · {country.currency} · plugs Type{" "}
                  {country.plugTypes.join("/")}
                </dd>
                <dd className="text-sm text-ink-soft">{country.tipping}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <footer className="border-t border-line pt-5">
        <p className="font-mono text-[11px] text-ink-faint">
          {items.length} items · shared from Manifest
        </p>
        <Link
          href="/"
          className="press mt-3 inline-block rounded-xl border border-line px-4 py-2 text-sm"
        >
          Plan your own trip
        </Link>
      </footer>
    </article>
  );
}
