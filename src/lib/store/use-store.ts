"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { runChecks } from "../rules";
import { getServerSnapshot, getSnapshot, subscribe, type AppState } from "./state";

/**
 * The store lives in localStorage, so the server and the first client render
 * cannot agree. Everything waits for `hydrated` rather than risking a mismatch.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useTripView() {
  const state = useAppState();
  const hydrated = useHydrated();

  // Checks are pure over the state, so they recompute only when it changes.
  const flags = useMemo(
    () => runChecks(state.trip, state.items, new Date()),
    [state.trip, state.items],
  );

  return { ...state, flags, hydrated };
}
