import type { Flag, TripItem } from "../domain/types";
import { haversineKm } from "../geo";
import { formatDay, localDateKey, minutesBetween, type RuleContext } from "./shared";

function nightsBetween(from: string, to: string): string[] {
  const nights: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

/** Nights at the destination with nothing booked to sleep in. */
export function lodgingCoverage({ trip, items }: RuleContext): Flag[] {
  const stays = items.filter(
    (item) => item.bookingKind === "lodging" && item.startsAt && item.endsAt,
  );
  if (stays.length === 0) return [];

  const covered = new Set(
    stays.flatMap((stay) =>
      nightsBetween(localDateKey(stay.startsAt!), localDateKey(stay.endsAt!)),
    ),
  );

  const flights = items
    .filter((item) => item.bookingKind === "flight" && item.startsAt && item.endsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  // Only count nights actually spent at the destination.
  const firstNight = flights.length > 0 ? localDateKey(flights[0].endsAt!) : trip.startDate;
  const lastNight = flights.length > 1 ? localDateKey(flights.at(-1)!.startsAt!) : trip.endDate;

  const uncovered = nightsBetween(firstNight, lastNight).filter((night) => !covered.has(night));
  if (uncovered.length === 0) return [];

  return [
    {
      id: "lodging-coverage",
      severity: "critical",
      category: "conflict",
      title: `${uncovered.length} night${uncovered.length === 1 ? "" : "s"} with nowhere booked`,
      detail: `Nothing covers ${uncovered
        .map((night) => formatDay(night))
        .join(", ")}. Either a booking has not been filed yet, or there is a real gap.`,
      itemIds: stays.map((stay) => stay.id),
    },
  ];
}

/** A stay you are paying for past the point you have already flown home. */
export function lodgingAfterDeparture({ items }: RuleContext): Flag[] {
  const stays = items.filter((item) => item.bookingKind === "lodging" && item.endsAt);
  const flights = items
    .filter((item) => item.bookingKind === "flight" && item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  const departure = flights.at(-1);
  if (!departure || stays.length === 0) return [];

  return stays.flatMap((stay): Flag[] => {
    const overrun = minutesBetween(departure.startsAt!, stay.endsAt!);
    if (overrun <= 0) return [];

    return [
      {
        id: `lodging-overrun:${stay.id}`,
        severity: "warning",
        category: "money",
        title: `${stay.title} runs past your flight home`,
        detail: `Check-out is ${formatDay(stay.endsAt!)} but ${departure.title} leaves ${formatDay(
          departure.startsAt!,
        )}. You are paying for a night you will not sleep in — unless the check-out date is wrong.`,
        itemIds: [stay.id, departure.id],
      },
    ];
  });
}

const SAME_CITY_KM = 80;

/** Consecutive days in cities far apart, with nothing booked to get between them. */
export function onwardTransport({ items }: RuleContext): Flag[] {
  const located = items
    .filter((item) => item.startsAt && item.place?.point && item.bookingKind !== "lodging")
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  const byDay = new Map<string, TripItem>();
  for (const item of located) {
    const day = localDateKey(item.startsAt!);
    if (!byDay.has(day)) byDay.set(day, item);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const flags: Flag[] = [];

  for (let i = 0; i < days.length - 1; i++) {
    const [, current] = days[i];
    const [nextDay, next] = days[i + 1];

    const distance = haversineKm(current.place!.point!, next.place!.point!);
    if (distance < SAME_CITY_KM) continue;

    const hasTransport = items.some(
      (item) =>
        item.category === "booking" &&
        item.bookingKind !== "lodging" &&
        item.startsAt &&
        localDateKey(item.startsAt) >= localDateKey(current.startsAt!) &&
        localDateKey(item.startsAt) <= nextDay,
    );
    if (hasTransport) continue;

    flags.push({
      id: `onward:${current.id}:${next.id}`,
      severity: "warning",
      category: "conflict",
      title: `Nothing booked to get from ${current.place!.city ?? current.place!.name} to ${
        next.place!.city ?? next.place!.name
      }`,
      detail: `${next.title} is ${Math.round(distance)} km from where you were the day before, and no train or flight is filed for that hop.`,
      itemIds: [current.id, next.id],
    });
  }

  return flags;
}
