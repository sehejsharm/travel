import type { Flag, Trip, TripItem } from "../domain/types";

export interface RuleContext {
  trip: Trip;
  items: TripItem[];
  now: Date;
}

export type Rule = (ctx: RuleContext) => Flag[];

/** The calendar date as written in the item's own local offset. */
export function localDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 60000;
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === "string" ? Date.parse(from) : from.getTime();
  const b = typeof to === "string" ? Date.parse(to) : to.getTime();
  return (b - a) / 86_400_000;
}

export function formatDay(iso: string): string {
  // Read the date as written. Re-projecting into the server's zone would show
  // a 00:10 departure in Tokyo as the previous day.
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatTime(iso: string): string {
  // Read the clock time as written rather than re-projecting into a local zone.
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

/** Items that sit at a point in time, so they can collide with each other. */
export function scheduled(items: TripItem[]): TripItem[] {
  return items
    .filter((item) => item.startsAt && item.bookingKind !== "lodging")
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
}

export function endOf(item: TripItem): string {
  return item.endsAt ?? item.startsAt!;
}

/**
 * Countries you only change planes in. You do not clear immigration there, so
 * they must not raise visa, passport or packing flags.
 */
function transitCountries(items: TripItem[]): Set<string> {
  const flights = items
    .filter((item) => item.bookingKind === "flight" && item.startsAt && item.endsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  const transit = new Set<string>();

  for (let i = 0; i < flights.length - 1; i++) {
    const arriving = flights[i];
    const departing = flights[i + 1];
    const airport = arriving.arrivalPlace?.airport;

    if (!airport || airport !== departing.place?.airport) continue;
    if (minutesBetween(arriving.endsAt!, departing.startsAt!) > 24 * 60) continue;

    const code = arriving.arrivalPlace?.countryCode?.toUpperCase();
    if (code) transit.add(code);
  }

  return transit;
}

export function destinationCountries(trip: Trip, items: TripItem[]): string[] {
  const home = trip.homeCountry.toUpperCase();
  const transit = transitCountries(items);
  const found = new Set<string>();

  for (const item of items) {
    for (const place of [item.place, item.arrivalPlace]) {
      const code = place?.countryCode?.toUpperCase();
      if (!code || code === home) continue;
      // A country stops being mere transit as soon as something other than a
      // connecting flight happens there.
      if (transit.has(code) && item.bookingKind === "flight") continue;
      found.add(code);
    }
  }

  return [...found];
}
