/**
 * The trip's own calendar: the holidays and festivals of each country it goes
 * to, on the days it is there. The timeline marks its days with it, and
 * Discover lists the festivals on the trip's dates beside its search.
 *
 * Pure over the trip and whatever holiday data has loaded. Each country's
 * calendar arrives on its own (see reference/holidays.ts), so before it does
 * these find nothing for that country, and a screen re-renders once it is in.
 * No React here, so the tests can use it as is.
 */
import type { Tone } from "../components/ui";
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

/**
 * Days off read as amber, the way any heads-up does, since shops, offices and
 * many museums close; everything else has a quiet chip, so the two never look
 * alike. The timeline and Discover both label holidays with it.
 */
export const MARK_TONE: Record<HolidayKind, Tone> = {
  public: "warning",
  bank: "warning",
  optional: "neutral",
  festival: "neutral",
  observance: "neutral",
};

/** The chip tone for a kind of holiday. */
export function holidayTone(kind: HolidayKind): Tone {
  return MARK_TONE[kind];
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
 * What the timeline shows once over its whole run, on the first day it shows
 * that falls inside it: a Christmas market open for four weeks is one line,
 * not 28. A day off, even one for some people only, changes each day it falls
 * on, so it shows on each.
 */
const ONCE_PER_RUN: ReadonlySet<HolidayKind> = new Set<HolidayKind>(["festival", "observance"]);

/** How far a run is followed either way, as a guard. The longest in the data is under 60 days. */
const MAX_RUN_DAYS = 400;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function nextDay(iso: string): string {
  return shiftDay(iso, 1);
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

/**
 * The countries whose calendars apply to a trip: its destinations, plus the
 * home country when the trip itself names it, as a destination or a leg (a
 * week in London, then Paris). For a trip at home (a weekend in the Lake
 * District from London) one of its places naming home is enough too. A trip
 * abroad does not get it from a place alone, since its outbound flight leaves
 * from home. The checks still leave the home country out: a traveller knows
 * their own days off, but the timeline and Discover can show them, each on
 * the days the trip is there (its leg, or the trip's dates without legs).
 */
export function calendarCountries(trip: Trip, items: TripItem[]): string[] {
  const destinations = destinationCountries(trip, items);
  const home = (trip.homeCountry ?? "").trim().toUpperCase();
  if (!home) return destinations;

  const isHome = (code: string | undefined) => code?.trim().toUpperCase() === home;
  const declared = [
    ...(trip.legs ?? []).map((leg) => leg.countryCode),
    ...(trip.destinationCountries ?? []),
  ].some(isHome);
  if (destinations.length > 0) return declared ? [...destinations, home] : destinations;

  const placed = items.some((item) => isHome(item.place?.countryCode) || isHome(item.arrivalPlace?.countryCode));
  return declared || placed ? [home] : [];
}

/** The trip's countries an item happens in, on its own day. */
function itemCountries(item: TripItem, countries: ReadonlySet<string>): string[] {
  const codes = [item.place, item.arrivalPlace]
    .map((place) => place?.countryCode?.toUpperCase())
    .filter((code): code is string => Boolean(code) && countries.has(code!));
  return [...new Set(codes)];
}

interface Run {
  first: string;
  last: string;
}

function sameEntry(mark: CalendarMark, day: string): boolean {
  return festivalsBetween(mark.countryCode, day, day).some(
    (holiday) => holiday.kind === mark.kind && holiday.name === mark.name,
  );
}

/**
 * The first and last day of the run a mark is part of, in its country's data
 * (one entry per day), which can start before the trip and end after it.
 */
function runOf(mark: CalendarMark): Run {
  let first = mark.date;
  let last = mark.date;
  for (let step = 0; step < MAX_RUN_DAYS && sameEntry(mark, shiftDay(first, -1)); step++) {
    first = shiftDay(first, -1);
  }
  for (let step = 0; step < MAX_RUN_DAYS && sameEntry(mark, nextDay(last)); step++) {
    last = nextDay(last);
  }
  return { first, last };
}

/** "Runs 7 to 17 February", "Runs 28 February to 4 March", as the data's own notes put it. */
function runsNote(first: string, last: string): string {
  const [, fromMonth, fromDay] = first.split("-").map(Number);
  const [, toMonth, toDay] = last.split("-").map(Number);
  return fromMonth === toMonth
    ? `Runs ${fromDay} to ${toDay} ${MONTHS[toMonth - 1]}`
    : `Runs ${fromDay} ${MONTHS[fromMonth - 1]} to ${toDay} ${MONTHS[toMonth - 1]}`;
}

/** A run's note, saying when it runs if the data does not already. */
function withRunNote(mark: CalendarMark, { first, last }: Run): CalendarMark {
  if (first === last || /\bRuns\b/.test(mark.note ?? "")) return mark;
  const note = [mark.note?.replace(/[.\s]+$/, ""), runsNote(first, last)].filter(Boolean).join(". ");
  return { ...mark, note: `${note}.` };
}

export interface TripCalendar {
  /**
   * Day → its marks, sorted. Holds the days the timeline shows that have a
   * mark: every day with something planned, and every day of the trip that is
   * a day off. A festival or an observance is on the first of those days
   * inside its run, and not again.
   */
  days: Map<string, CalendarMark[]>;
  /** The trip's countries. With more than one, each mark names its country. */
  countries: string[];
}

/**
 * The marks for the timeline. A country's calendar applies on the days the
 * trip is there: its legs' dates, or the trip's own dates when it has no legs,
 * which is the same window every other check uses. A day with something
 * planned in a country also gets that country's calendar, even outside its
 * window. A trip whose dates are not settled yet only gets marks on days that
 * have plans, since those dates are real.
 *
 * Only a day off (public or bank) puts a day with nothing planned on the
 * timeline. A festival, a day off for some and an observance show on the days
 * that are there already.
 */
export function tripCalendar(trip: Trip, items: TripItem[]): TripCalendar {
  const countries = calendarCountries(trip, items);
  const inTrip = new Set(countries);
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
    for (const code of itemCountries(item, inTrip)) {
      for (const holiday of festivalsBetween(code, day, day)) add(code, holiday);
    }
  }

  const shown = [...byDay.keys()]
    .filter((day) => planned.has(day) || [...byDay.get(day)!.values()].some((mark) => isDayOff(mark.kind)))
    .sort();
  /** Country, kind, name and day → its run, so each run is followed once. */
  const runs = new Map<string, Run>();
  /** The runs already on an earlier day, by country, kind, name and first day. */
  const placed = new Set<string>();
  const days = new Map<string, CalendarMark[]>();

  for (const day of shown) {
    const marks: CalendarMark[] = [];
    for (const mark of byDay.get(day)!.values()) {
      if (!ONCE_PER_RUN.has(mark.kind)) {
        marks.push(mark);
        continue;
      }
      const entry = `${mark.countryCode}|${mark.kind}|${mark.name}`;
      let run = runs.get(`${entry}|${day}`);
      if (!run) {
        run = runOf(mark);
        for (let date = run.first; date <= run.last; date = nextDay(date)) runs.set(`${entry}|${date}`, run);
      }
      if (placed.has(`${entry}|${run.first}`)) continue;
      placed.add(`${entry}|${run.first}`);
      marks.push(withRunNote(mark, run));
    }
    if (marks.length > 0) days.set(day, marks.sort(compareMarks));
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

/** On one date: a day off for everyone first (it is the big one), then what is on. */
const EVENT_ORDER: Record<HolidayKind, number> = {
  public: 0,
  bank: 1,
  festival: 2,
  optional: 3,
  observance: 4,
};

/**
 * Everything on while the trip is in each country: festivals, days off and
 * observances alike, with a festival that runs several days (one entry per
 * day in the data) as one event over those days. Discover picks from it what
 * to list (see advisor/calendar.ts).
 */
export function tripEvents(trip: Trip, items: TripItem[]): CalendarAnswer {
  const countries = calendarCountries(trip, items);
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
