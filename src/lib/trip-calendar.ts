/**
 * The trip's own calendar: the holidays and festivals of each country it goes
 * to, on the days it is there. The timeline marks its days with it, and
 * Discover fills Festivals & shows from it without a search.
 *
 * Pure over the trip and whatever holiday data has loaded. Each country's
 * calendar arrives on its own (see reference/holidays.ts), so before it does
 * these find nothing for that country, and a screen re-renders once it is in.
 * No React here, so the tests can use it as is.
 */
import type { Trip, TripItem } from "./domain/types";
import {
  festivalsBetween,
  holidaysLoaded,
  type Holiday,
  type HolidayKind,
} from "./reference/holidays";
import { destinationCountries, formatDay, windowForCountry } from "./rules/shared";

/** One holiday or festival, on one day, in one country. */
export interface CalendarMark extends Holiday {
  countryCode: string;
}

/** Short names for each kind, as the timeline and Discover label them. */
export const KIND_LABELS: Record<HolidayKind, string> = {
  public: "Day off",
  bank: "Bank holiday",
  // A day off in some regions, or for some people (women, Muslims, one
  // state): the note says which.
  optional: "Day off for some",
  festival: "Festival",
  observance: "Observance",
};

/** Shops, offices and many museums close. */
export function isDayOff(kind: HolidayKind): boolean {
  return kind === "public" || kind === "bank";
}

/** Days off first, then partial ones, then what is on, then what is only marked. */
const KIND_ORDER: Record<HolidayKind, number> = {
  public: 0,
  bank: 1,
  optional: 2,
  festival: 3,
  observance: 4,
};

/**
 * What puts a day with nothing planned on the timeline. An observance (a
 * Mother's Day, an Advent Sunday) is worth a line on a day that already has
 * plans, but not a day of its own.
 */
const WORTH_A_DAY: ReadonlySet<HolidayKind> = new Set<HolidayKind>([
  "public",
  "bank",
  "optional",
  "festival",
]);

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareMarks(a: CalendarMark, b: CalendarMark): number {
  return (
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    compareText(a.countryCode, b.countryCode) ||
    compareText(a.name, b.name)
  );
}

/** The trip's destinations an item happens in, on its own day. */
function itemCountries(item: TripItem, destinations: ReadonlySet<string>): string[] {
  const codes = [item.place, item.arrivalPlace]
    .map((place) => place?.countryCode?.toUpperCase())
    .filter((code): code is string => Boolean(code) && destinations.has(code!));
  return [...new Set(codes)];
}

export interface TripCalendar {
  /**
   * Day → its marks, sorted. Holds every day with something planned that has
   * a mark, and every day of the trip with nothing planned that has a mark
   * worth a day of its own.
   */
  days: Map<string, CalendarMark[]>;
  /** The trip's destinations. With more than one, each mark names its country. */
  countries: string[];
}

/**
 * The marks for the timeline. A country's calendar applies on the days the
 * trip is there: its legs' dates, or the trip's own dates when it has no legs,
 * which is the same window every other check uses. A day with something
 * planned in a country also gets that country's calendar, even outside its
 * window. A trip whose dates are not settled yet only gets marks on days that
 * have plans, since those dates are real.
 */
export function tripCalendar(trip: Trip, items: TripItem[]): TripCalendar {
  const countries = destinationCountries(trip, items);
  const destinations = new Set(countries);
  const planned = new Set(items.filter((item) => item.startsAt).map((item) => dayOf(item.startsAt!)));
  const byDay = new Map<string, Map<string, CalendarMark>>();

  function add(countryCode: string, holiday: Holiday) {
    const marks = byDay.get(holiday.date) ?? new Map<string, CalendarMark>();
    marks.set(`${countryCode}|${holiday.name}`, { ...holiday, countryCode });
    byDay.set(holiday.date, marks);
  }

  if (!trip.datesTbd) {
    for (const code of countries) {
      const window = windowForCountry(trip, code);
      for (const holiday of festivalsBetween(code, window.startDate, window.endDate)) {
        add(code, holiday);
      }
    }
  }

  for (const item of items) {
    if (!item.startsAt) continue;
    const day = dayOf(item.startsAt);
    for (const code of itemCountries(item, destinations)) {
      for (const holiday of festivalsBetween(code, day, day)) add(code, holiday);
    }
  }

  const days = new Map<string, CalendarMark[]>();
  for (const day of [...byDay.keys()].sort()) {
    const marks = [...byDay.get(day)!.values()].sort(compareMarks);
    if (planned.has(day) || marks.some((mark) => WORTH_A_DAY.has(mark.kind))) days.set(day, marks);
  }

  return { days, countries };
}

/** One holiday or festival over the days it runs during the trip. */
export interface CalendarEvent {
  /** Stable for React keys and for telling two events apart. */
  id: string;
  name: string;
  kind: HolidayKind;
  countryCode: string;
  /** The first and last day it runs while the trip is there, inclusive. */
  startDate: string;
  endDate: string;
  note?: string;
}

export interface CalendarAnswer {
  /**
   * Whether the calendar can speak for the trip's dates: they are settled,
   * and every destination's calendar has loaded (or there is none to load).
   */
  ready: boolean;
  countries: string[];
  /** In date order. Empty when not ready. */
  events: CalendarEvent[];
}

function nextDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** On one date: a day off for everyone first (it is the big one), then what is on. */
const EVENT_ORDER: Record<HolidayKind, number> = {
  public: 0,
  bank: 1,
  festival: 2,
  optional: 3,
  observance: 4,
};

/**
 * Everything on while the trip is in each country, for Discover's Festivals &
 * shows: festivals, days off and observances alike, with a festival that runs
 * several days (one entry per day in the data) as one event over those days.
 */
export function tripEvents(trip: Trip, items: TripItem[]): CalendarAnswer {
  const countries = destinationCountries(trip, items);
  const ready = !trip.datesTbd && countries.length > 0 && countries.every(holidaysLoaded);
  if (!ready) return { ready, countries, events: [] };

  const events: CalendarEvent[] = [];
  for (const code of countries) {
    const window = windowForCountry(trip, code);
    /** Name and kind → the run being built, so consecutive days join up. */
    const open = new Map<string, CalendarEvent>();

    for (const holiday of festivalsBetween(code, window.startDate, window.endDate)) {
      const key = `${holiday.kind}|${holiday.name}`;
      const run = open.get(key);
      if (run && nextDay(run.endDate) === holiday.date) {
        run.endDate = holiday.date;
        continue;
      }

      const event: CalendarEvent = {
        id: `${code}|${key}|${holiday.date}`,
        name: holiday.name,
        kind: holiday.kind,
        countryCode: code,
        startDate: holiday.date,
        endDate: holiday.date,
        ...(holiday.note ? { note: holiday.note } : {}),
      };
      open.set(key, event);
      events.push(event);
    }
  }

  events.sort(
    (a, b) =>
      compareText(a.startDate, b.startDate) ||
      EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind] ||
      compareText(a.countryCode, b.countryCode) ||
      compareText(a.name, b.name),
  );
  return { ready, countries, events };
}

/** "Sun 8 Nov", or "Sat 31 Oct – Mon 2 Nov" for an event over several days. */
export function formatEventDates(startDate: string, endDate: string): string {
  return startDate === endDate ? formatDay(startDate) : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}
