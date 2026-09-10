"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ChecklistEntry } from "../checklists";
import type { Flag, Trip, TripItem } from "../domain/types";
import { runChecks } from "../rules";
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

  // Checks are pure over the state, so they recompute only when it changes.
  const flags = useMemo(
    () => (trip ? runChecks(trip, items, new Date()) : []),
    [trip, items],
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
