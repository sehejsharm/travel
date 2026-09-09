import type { Flag, TripItem } from "../domain/types";
import { estimateTravel } from "../geo";
import { getAirport } from "../reference/airports";
import {
  endOf,
  formatDay,
  formatTime,
  localDateKey,
  minutesBetween,
  scheduled,
  type RuleContext,
} from "./shared";

const MODE_LABELS = {
  walk: "walk",
  transit: "transit ride",
  drive: "drive",
  fly: "flight",
} as const;

export function timeOverlaps({ items }: RuleContext): Flag[] {
  const list = scheduled(items).filter((item) => item.endsAt);
  const flags: Flag[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (Date.parse(b.startsAt!) >= Date.parse(a.endsAt!)) break;

      flags.push({
        id: `overlap:${a.id}:${b.id}`,
        severity: "critical",
        category: "conflict",
        title: `${a.title} overlaps ${b.title}`,
        detail: `Both are booked on ${formatDay(a.startsAt!)} — ${a.title} runs until ${formatTime(
          a.endsAt!,
        )} but ${b.title} starts at ${formatTime(b.startsAt!)}.`,
        itemIds: [a.id, b.id],
      });
    }
  }

  return flags;
}

export function geographicFeasibility({ items }: RuleContext): Flag[] {
  const list = scheduled(items);
  const flags: Flag[] = [];

  for (let i = 0; i < list.length - 1; i++) {
    const current = list[i];
    const next = list[i + 1];

    const from = current.arrivalPlace?.point ?? current.place?.point;
    const to = next.place?.point;
    if (!from || !to) continue;
    if (localDateKey(endOf(current)) !== localDateKey(next.startsAt!)) continue;

    const gap = minutesBetween(endOf(current), next.startsAt!);
    if (gap < 0) continue;

    const travel = estimateTravel(from, to);
    if (gap >= travel.minutes) continue;

    flags.push({
      id: `geo:${current.id}:${next.id}`,
      severity: "warning",
      category: "conflict",
      title: `Not enough time between ${current.title} and ${next.title}`,
      detail: `Only ${Math.round(gap)} min between them, but it is a ${travel.minutes} min ${
        MODE_LABELS[travel.mode]
      } (${travel.distanceKm.toFixed(1)} km). Move one, or drop the gap.`,
      itemIds: [current.id, next.id],
    });
  }

  return flags;
}

export function layoverFeasibility({ items }: RuleContext): Flag[] {
  const flights = items
    .filter((item) => item.bookingKind === "flight" && item.startsAt && item.endsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  const flags: Flag[] = [];

  for (let i = 0; i < flights.length - 1; i++) {
    const arriving = flights[i];
    const departing = flights[i + 1];

    const arrivalCode = arriving.arrivalPlace?.airport;
    const departureCode = departing.place?.airport;
    if (!arrivalCode || !departureCode) continue;

    const layover = minutesBetween(arriving.endsAt!, departing.startsAt!);
    // Beyond a day apart these are two separate journeys, not a connection.
    if (layover < 0 || layover > 24 * 60) continue;

    if (arrivalCode !== departureCode) {
      flags.push({
        id: `airport-change:${arriving.id}:${departing.id}`,
        severity: "critical",
        category: "conflict",
        title: `Connection changes airport (${arrivalCode} → ${departureCode})`,
        detail: `You land at ${arrivalCode} and depart from ${departureCode} ${Math.round(
          layover,
        )} min later. That transfer is on you — check it is possible before relying on it.`,
        itemIds: [arriving.id, departing.id],
      });
      continue;
    }

    const airport = getAirport(arrivalCode);
    if (!airport) continue;

    const isInternational =
      arriving.place?.countryCode !== departing.arrivalPlace?.countryCode ||
      arriving.place?.countryCode !== airport.countryCode;
    const required = isInternational
      ? airport.minConnect.international
      : airport.minConnect.domestic;

    if (layover >= required) continue;

    flags.push({
      id: `layover:${arriving.id}:${departing.id}`,
      severity: "critical",
      category: "conflict",
      title: `Layover at ${arrivalCode} is below the minimum connection time`,
      detail: `${Math.round(layover)} min between flights, but ${airport.name} publishes ${required} min for ${
        isInternational ? "international" : "domestic"
      } connections. A delay on the inbound leg loses the onward flight.`,
      itemIds: [arriving.id, departing.id],
    });
  }

  return flags;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export function bookingMismatches({ items }: RuleContext): Flag[] {
  const flags: Flag[] = [];
  const bookings = items.filter((item) => item.category === "booking");

  const named = bookings.filter((item) => item.travelerName);
  const variants = new Map<string, TripItem[]>();
  for (const item of named) {
    const key = normalizeName(item.travelerName!);
    variants.set(key, [...(variants.get(key) ?? []), item]);
  }

  // One flag for the whole trip, not one per pair — the traveller has a single
  // name problem to fix, however many bookings it spans.
  if (variants.size > 1) {
    const spellings = [...variants.values()].map(
      (group) => `"${group[0].travelerName}" on ${group[0].title}`,
    );

    flags.push({
      id: "name-mismatch",
      severity: "warning",
      category: "conflict",
      title: "Traveller name differs between bookings",
      detail: `${spellings.join(", ")}. Airlines and hotels do check this against your passport.`,
      itemIds: named.map((item) => item.id),
    });
  }

  flags.push(...lodgingGaps(bookings));
  return flags;
}

function lodgingGaps(bookings: TripItem[]): Flag[] {
  const arrivals = bookings
    .filter((item) => item.bookingKind === "flight" && item.endsAt)
    .sort((a, b) => Date.parse(a.endsAt!) - Date.parse(b.endsAt!));
  const stays = bookings
    .filter((item) => item.bookingKind === "lodging" && item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  if (arrivals.length === 0 || stays.length === 0) return [];

  const firstArrival = arrivals[0];
  const firstStay = stays[0];
  const arrivalDay = localDateKey(firstArrival.endsAt!);
  const checkInDay = localDateKey(firstStay.startsAt!);

  if (arrivalDay === checkInDay) return [];

  return [
    {
      id: `lodging-gap:${firstArrival.id}:${firstStay.id}`,
      severity: "critical",
      category: "conflict",
      title: "No bed on your arrival night",
      detail: `You land on ${formatDay(firstArrival.endsAt!)} but ${firstStay.title} only starts on ${formatDay(
        firstStay.startsAt!,
      )}. Either the check-in date is wrong or you are a night short.`,
      itemIds: [firstArrival.id, firstStay.id],
    },
  ];
}

const BUSY_DAY_THRESHOLD = 5;

export function overbookedDays({ items }: RuleContext): Flag[] {
  const byDay = new Map<string, TripItem[]>();

  for (const item of scheduled(items)) {
    if (item.category === "booking") continue;
    const key = localDateKey(item.startsAt!);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return [...byDay.entries()]
    .filter(([, dayItems]) => dayItems.length >= BUSY_DAY_THRESHOLD)
    .map(([day, dayItems]) => ({
      id: `busy-day:${day}`,
      severity: "info" as const,
      category: "conflict" as const,
      title: `${dayItems.length} things booked on ${formatDay(dayItems[0].startsAt!)}`,
      detail: "That is a lot for one day once travel time between them is counted. Consider moving one to a lighter day.",
      itemIds: dayItems.map((item) => item.id),
    }));
}
