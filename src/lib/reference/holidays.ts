/**
 * Public holidays, bank holidays, regional days off, observances and
 * festivals, for every country date-holidays covers, from 2026 to 2050.
 * scripts/build-holidays.mjs builds them into holiday-data/, one file per
 * country, merged with the supplements in scripts/holiday-supplements/.
 *
 * Each country is its own chunk, fetched only for a trip that goes there:
 * call loadHolidays() with the destination countries. The reads below are
 * synchronous and answer from whatever has arrived, so before a country loads
 * they find nothing. subscribeHolidays() and holidaysVersion() let a screen
 * re-render, and its checks run again, once the data is in.
 *
 * No React here, so the rules and the tests can use it as is.
 */
import { HOLIDAY_LOADERS, type CountryHolidays } from "./holiday-data";

/**
 * - public: a day off. Shops, offices and many museums close.
 * - bank: a bank holiday. Banks and many offices close.
 * - optional: a day off in some regions or for some people (the note says which).
 * - observance: marked, but not a day off.
 * - festival: a cultural or religious festival, or a big event, that is not a day off.
 */
export type HolidayKind = "public" | "bank" | "optional" | "observance" | "festival";

export interface Holiday {
  date: string;
  name: string;
  kind: HolidayKind;
  note?: string;
}

export type { CountryHolidays };

const DAYS_OFF: ReadonlySet<HolidayKind> = new Set<HolidayKind>(["public", "bank"]);

/** Country code → its holidays, sorted by date. */
const loaded = new Map<string, readonly Holiday[]>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function normalise(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

function hasData(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(HOLIDAY_LOADERS, code);
}

function changed() {
  version += 1;
  for (const listener of [...listeners]) listener();
}

function toHolidays(data: CountryHolidays): readonly Holiday[] {
  const holidays = data.entries.map(([date, kind, name, note]): Holiday =>
    Object.freeze(note ? { date, name, kind, note } : { date, name, kind }),
  );
  // The generator sorts its files; this keeps primed test data honest too.
  holidays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return Object.freeze(holidays);
}

/** Index of the first holiday on or after the date. */
function firstOnOrAfter(holidays: readonly Holiday[], date: string): number {
  let low = 0;
  let high = holidays.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (holidays[middle].date < date) low = middle + 1;
    else high = middle;
  }
  return low;
}

function between(countryCode: string, from: string, to: string): Holiday[] {
  const holidays = loaded.get(normalise(countryCode));
  if (!holidays) return [];

  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  const found: Holiday[] = [];
  for (let index = firstOnOrAfter(holidays, start); index < holidays.length; index++) {
    if (holidays[index].date > end) break;
    found.push(holidays[index]);
  }
  return found;
}

/**
 * Days off (public and bank holidays) between two dates, inclusive. Dates
 * may carry a time, which is ignored. Empty until the country has loaded.
 */
export function holidaysBetween(countryCode: string, from: string, to: string): Holiday[] {
  return between(countryCode, from, to).filter((holiday) => DAYS_OFF.has(holiday.kind));
}

/** The first day off on a date, if there is one and the country has loaded. */
export function isHoliday(countryCode: string, date: string): Holiday | undefined {
  return holidaysBetween(countryCode, date, date)[0];
}

/**
 * Everything between two dates, inclusive, of every kind: days off, regional
 * and optional days, observances and festivals. Empty until the country has
 * loaded.
 */
export function festivalsBetween(countryCode: string, from: string, to: string): Holiday[] {
  return between(countryCode, from, to);
}

function loadOne(code: string): Promise<void> {
  const inFlight = pending.get(code);
  if (inFlight) return inFlight;

  const loading = HOLIDAY_LOADERS[code]()
    .then((module) => {
      loaded.set(code, toHolidays(module.default));
      changed();
    })
    // Offline with the chunk not cached yet. The country stays unloaded, and
    // the next call tries again.
    .catch(() => undefined)
    .finally(() => pending.delete(code));

  pending.set(code, loading);
  return loading;
}

/**
 * Fetches the countries not loaded yet. Codes are ISO 3166-1 alpha-2, in any
 * case; one with no data is skipped. Never rejects: a country that fails to
 * load stays unloaded and can be asked for again.
 */
export async function loadHolidays(countryCodes: string[]): Promise<void> {
  const wanted = new Set(countryCodes.map(normalise));
  await Promise.all(
    [...wanted].filter((code) => hasData(code) && !loaded.has(code)).map(loadOne),
  );
}

/**
 * Whether there is nothing left to fetch for a country: its data is in, or
 * there is no data for it at all (an unknown code), so a screen never waits
 * on a country that will not arrive.
 */
export function holidaysLoaded(countryCode: string): boolean {
  const code = normalise(countryCode);
  return loaded.has(code) || !hasData(code);
}

/** Calls the listener whenever a country's data arrives. Returns the unsubscribe. */
export function subscribeHolidays(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Goes up by one each time data arrives. With subscribeHolidays it fits
 * React's useSyncExternalStore.
 */
export function holidaysVersion(): number {
  return version;
}

/** Puts a country's data in place synchronously, for tests. */
export function primeHolidays(countryCode: string, data: CountryHolidays): void {
  loaded.set(normalise(countryCode), toHolidays(data));
  changed();
}
