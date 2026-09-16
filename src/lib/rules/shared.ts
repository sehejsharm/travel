import type { Flag, Traveler, Trip, TripItem, TripLeg } from "../domain/types";

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

/**
 * Whether a stored date is something we can actually reason about. Empty
 * strings arrive from travellers added by name alone during trip creation,
 * and a malformed one can arrive from a restored backup or a hand-edited
 * field — both must read as "not told yet", never as a date in the past.
 */
export function hasDate(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

/* -------------------------------------------------------------- origins */

/**
 * Where one person sets off from. The trip's homeCountry is the default and
 * stays the answer for everyone who did not say otherwise, so a solo trip and
 * a group all leaving from the same place behave exactly as they always did.
 */
export function originFor(trip: Trip, traveler: Traveler): string {
  const own = traveler.originCountry?.trim().toUpperCase();
  return own || trip.homeCountry.toUpperCase();
}

export interface OriginGroup {
  countryCode: string;
  travelers: Traveler[];
  /** True when this is the only origin on the trip, so nothing needs naming. */
  everyone: boolean;
}

/**
 * The trip's origins, one group per country. Anything that depends on where
 * you are coming from — plugs, voltage, jet lag, the allowance you carry
 * through customs on the way back — has to be answered per group rather than
 * once for the whole trip, or half the party gets advice meant for the other
 * half. With one origin there is one group, and callers can render it exactly
 * as they rendered the single trip-wide answer before.
 */
export function originGroups(trip: Trip): OriginGroup[] {
  const byCountry = new Map<string, Traveler[]>();

  for (const traveler of trip.travelers) {
    const code = originFor(trip, traveler);
    byCountry.set(code, [...(byCountry.get(code) ?? []), traveler]);
  }

  // No travellers on file still means a trip that departs from somewhere.
  if (byCountry.size === 0) {
    return [{ countryCode: trip.homeCountry.toUpperCase(), travelers: [], everyone: true }];
  }

  const groups = [...byCountry.entries()].map(([countryCode, travelers]) => ({
    countryCode,
    travelers,
    everyone: byCountry.size === 1,
  }));

  // The trip's own origin first; it is the one most of the party shares.
  const home = trip.homeCountry.toUpperCase();
  return groups.sort((a, b) =>
    a.countryCode === home ? -1 : b.countryCode === home ? 1 : b.travelers.length - a.travelers.length,
  );
}

/**
 * Who a piece of advice applies to, and whether that is everyone. Advice is
 * split by its answer rather than by origin: two people leaving from India and
 * Britain both need the same Type A/B adapter for Japan, and printing that
 * twice under two names is noise, not detail. Names appear only where the
 * answer genuinely does not cover the whole party. Undefined means nothing
 * to say.
 */
export function affected(
  groups: OriginGroup[],
  applies: (group: OriginGroup) => boolean,
): { groups: OriginGroup[]; travelers: Traveler[]; everyone: boolean } | undefined {
  const hit = groups.filter(applies);
  if (hit.length === 0) return undefined;

  return {
    groups: hit,
    travelers: hit.flatMap((group) => group.travelers),
    everyone: hit.length === groups.length,
  };
}

/** "Ana and Sehej", for a finding that only applies to some of the party. */
export function nameList(travelers: Traveler[]): string {
  const names = travelers.map((traveler) => traveler.name).filter(Boolean);
  if (names.length === 0) return "You";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

  // Legs carry their own countries; they are the same destinations, just with
  // dates attached, so they feed the same set.
  for (const leg of trip.legs ?? []) {
    const code = leg.countryCode.toUpperCase();
    if (code && code !== home) found.add(code);
  }

  for (const declared of trip.destinationCountries ?? []) {
    const code = declared.toUpperCase();
    if (code && code !== home) found.add(code);
  }

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

/**
 * The window a given country is actually visited in. With legs, that is the
 * leg's own dates — so a visa lead time, a weather outlook or a packing
 * decision for Thailand is judged against the Thailand days, not against the
 * whole trip. Without legs, every country shares the trip's window.
 */
export function windowForCountry(
  trip: Trip,
  countryCode: string,
): { startDate: string; endDate: string } {
  const code = countryCode.toUpperCase();
  const legs = (trip.legs ?? []).filter((leg) => leg.countryCode.toUpperCase() === code);
  if (legs.length === 0) return { startDate: trip.startDate, endDate: trip.endDate };

  return {
    startDate: legs.reduce((first, leg) => (leg.startDate < first ? leg.startDate : first), legs[0].startDate),
    endDate: legs.reduce((last, leg) => (leg.endDate > last ? leg.endDate : last), legs[0].endDate),
  };
}

/** Which leg a moment in time falls inside, for grouping a timeline by country. */
export function legForDate(trip: Trip, isoDate: string): TripLeg | undefined {
  const day = isoDate.slice(0, 10);
  return (trip.legs ?? []).find((leg) => day >= leg.startDate && day <= leg.endDate);
}
