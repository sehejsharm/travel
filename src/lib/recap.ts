import type { Trip, TripItem, SourceKind } from "./domain/types";
import { getCountry } from "./reference/countries";
import { convert } from "./reference/fx";
import { destinationCountries } from "./rules/shared";

export interface RecapStats {
  status: "upcoming" | "under way" | "complete";
  nights: number;
  countries: string[];
  placesVisited: number;
  activities: number;
  currency: string;
  booked: number;
  estimated: number;
  /** Where the trip came from — the point of the mailroom, measured. */
  bySource: { source: SourceKind; count: number }[];
  busiestDay?: { date: string; count: number };
  furthest?: { title: string; km: number };
}

export function buildRecap(trip: Trip, items: TripItem[], now: Date): RecapStats {
  const start = Date.parse(trip.startDate);
  const end = Date.parse(trip.endDate);
  const status =
    now.getTime() < start ? "upcoming" : now.getTime() > end ? "complete" : "under way";

  const currency = trip.budgetTarget?.currency ?? "USD";
  let booked = 0;
  let estimated = 0;

  for (const item of items) {
    if (!item.cost) continue;
    const converted = convert(item.cost.amount, item.cost.currency, currency);
    if (converted === undefined) continue;
    if (item.costStatus === "actual") booked += converted;
    else estimated += converted;
  }

  const counts = new Map<SourceKind, number>();
  for (const item of items) {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }

  const byDay = new Map<string, number>();
  for (const item of items) {
    if (!item.startsAt) continue;
    const day = item.startsAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  // Two things in a day is not a busy day worth remarking on.
  const busiest = [...byDay.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 3);

  return {
    status,
    nights: Math.max(0, Math.round((end - start) / 86_400_000)),
    countries: destinationCountries(trip, items).map(
      (code) => getCountry(code)?.name ?? code,
    ),
    placesVisited: items.filter((item) => item.category === "place").length,
    activities: items.filter((item) => item.category === "activity").length,
    currency,
    booked,
    estimated,
    bySource: [...counts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : undefined,
  };
}
