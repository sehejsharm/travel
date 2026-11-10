"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChecklistEntry } from "../checklists";
import type { Flag, Trip, TripItem } from "../domain/types";
import { holidaysVersion, loadHolidays, subscribeHolidays } from "../reference/holidays";
import { runChecks } from "../rules";
import { calendarCountries } from "../trip-calendar";
import {
  activeTrip,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  tripItems,
  type AppState,
} from "./state";

const noop = () => () => {};

/**
 * The store lives in localStorage, so the server and the first client render
 * cannot agree. useSyncExternalStore gives us "am I on the client yet" without
 * setting state from an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Nothing has loaded on the server, nor before hydration. */
const noHolidaysYet = () => 0;

/**
 * Goes up each time a country's holiday calendar arrives. Anything that reads
 * the calendar (the checks, the timeline, Discover) depends on it, so it
 * renders again once the data is in.
 */
export function useHolidaysVersion(): number {
  return useSyncExternalStore(subscribeHolidays, holidaysVersion, noHolidaysYet);
}

export interface TripView {
  state: AppState;
  trip?: Trip;
  items: TripItem[];
  checklist: ChecklistEntry[];
  flags: Flag[];
  hydrated: boolean;
  /** True once hydrated with no trips at all — the first-run case. */
  empty: boolean;
}

export function useTripView(): TripView {
  const state = useAppState();
  const hydrated = useHydrated();

  const trip = activeTrip(state);
  const items = useMemo(
    () => (trip ? tripItems(state, trip.id) : []),
    [state, trip],
  );

  const checklist = useMemo(
    () => (trip ? state.checklist.filter((entry) => entry.tripId === trip.id) : []),
    [state.checklist, trip],
  );

  // Each country's holiday calendar is its own chunk, fetched once and then
  // cached: the destinations', or the home country's for a trip at home. The
  // countries are joined into one string so the effect runs when they change,
  // not on every new items array.
  const countries = useMemo(
    () => (trip ? calendarCountries(trip, items).sort().join(",") : ""),
    [trip, items],
  );
  useEffect(() => {
    if (!countries) return;
    return keepHolidaysLoaded(countries.split(","), window);
  }, [countries]);
  const holidays = useHolidaysVersion();

  // Checks are pure over the state and the holiday calendar, so they recompute
  // only when one of them changes. The public-holiday check finds nothing for
  // a country until its calendar is in, then runs again when it arrives.
  const flags = useMemo(
    () => (trip ? checksFor(trip, items, holidays) : []),
    [trip, items, holidays],
  );

  return {
    state,
    trip,
    items,
    checklist,
    flags,
    hydrated,
    empty: hydrated && state.trips.length === 0,
  };
}

/**
 * Loads the countries' calendars now, and again each time the device comes
 * back online, since a chunk that failed offline stays unloaded until asked
 * for again. Loading what is already in costs nothing. Returns the cleanup.
 */
export function keepHolidaysLoaded(countryCodes: string[], target: EventTarget): () => void {
  const load = () => void loadHolidays(countryCodes);
  load();
  target.addEventListener("online", load);
  return () => target.removeEventListener("online", load);
}

/**
 * The checks, as of one version of the holiday calendar. The rules read the
 * calendar themselves; the version is passed so a new one is a new question.
 */
function checksFor(trip: Trip, items: TripItem[], holidayVersion: number): Flag[] {
  void holidayVersion;
  return runChecks(trip, items, new Date());
}
