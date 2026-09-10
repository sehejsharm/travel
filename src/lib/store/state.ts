import type { ChecklistEntry, ChecklistKind, GeneratedEntry } from "../checklists";
import { generatePacking, generateTasks } from "../checklists";
import type { Trip, TripItem, Traveler } from "../domain/types";
import type { ItemDraft } from "../extract/types";
import { runChecks } from "../rules";
import { SEED_ITEMS, SEED_TRIP } from "./seed";

export interface AppState {
  trips: Trip[];
  activeTripId: string;
  /** Items for every trip; screens filter by the active one. */
  items: TripItem[];
  checklist: ChecklistEntry[];
}

const STORAGE_KEY = "manifest.state.v2";
const LEGACY_KEY = "manifest.state.v1";

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyState(): AppState {
  return { trips: [], activeTripId: "", items: [], checklist: [] };
}

export function sampleState(): AppState {
  return withGeneratedChecklists({
    trips: [SEED_TRIP],
    activeTripId: SEED_TRIP.id,
    items: SEED_ITEMS,
    checklist: [],
  });
}

export function activeTrip(state: AppState): Trip | undefined {
  return state.trips.find((trip) => trip.id === state.activeTripId) ?? state.trips[0];
}

export function tripItems(state: AppState, tripId: string): TripItem[] {
  return state.items.filter((item) => item.tripId === tripId);
}

/**
 * Generated entries are added if missing; a ticked box or an assignment is
 * never overwritten.
 */
function withGeneratedChecklists(state: AppState): AppState {
  const trip = activeTrip(state);
  if (!trip) return state;

  const items = tripItems(state, trip.id);
  const flags = runChecks(trip, items, new Date());
  const generated: [ChecklistKind, GeneratedEntry[]][] = [
    ["packing", generatePacking(trip, items)],
    ["task", generateTasks(flags)],
  ];

  const existing = new Set(
    state.checklist
      .filter((entry) => entry.tripId === trip.id)
      .map((entry) => `${entry.kind}:${entry.label}`),
  );
  const additions: ChecklistEntry[] = [];

  for (const [kind, entries] of generated) {
    for (const entry of entries) {
      if (existing.has(`${kind}:${entry.label}`)) continue;
      additions.push({
        id: id("chk"),
        tripId: trip.id,
        kind,
        label: entry.label,
        detail: entry.detail,
        generatedFrom: entry.generatedFrom,
        done: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (additions.length === 0) return state;
  return { ...state, checklist: [...state.checklist, ...additions] };
}

function migrateLegacy(raw: string): AppState | undefined {
  try {
    const parsed = JSON.parse(raw) as { trip?: Trip; items?: TripItem[]; checklist?: ChecklistEntry[] };
    if (!parsed.trip || !Array.isArray(parsed.items)) return undefined;

    return {
      trips: [parsed.trip],
      activeTripId: parsed.trip.id,
      items: parsed.items,
      checklist: parsed.checklist ?? [],
    };
  } catch {
    return undefined;
  }
}

function read(): AppState {
  if (typeof window === "undefined") return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (Array.isArray(parsed.trips)) {
        return withGeneratedChecklists({
          trips: parsed.trips,
          activeTripId: parsed.activeTripId ?? parsed.trips[0]?.id ?? "",
          items: parsed.items ?? [],
          checklist: parsed.checklist ?? [],
        });
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateLegacy(legacy);
      if (migrated) return withGeneratedChecklists(migrated);
    }

    return emptyState();
  } catch {
    // A corrupt store should never leave the app blank.
    return emptyState();
  }
}

function write(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode and full quotas both throw; the session still works.
  }
}

let state: AppState | undefined;
const listeners = new Set<() => void>();

function set(next: AppState): void {
  state = next;
  write(next);
  for (const listener of listeners) listener();
}

function mutate(update: (current: AppState) => AppState): void {
  set(withGeneratedChecklists(update(getSnapshot())));
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): AppState {
  if (!state) state = read();
  return state;
}

/** The server has no stored state, so it renders nothing until hydration. */
export function getServerSnapshot(): AppState {
  return emptyState();
}

/* ------------------------------------------------------------------ trips */

export interface TripInput {
  name: string;
  startDate: string;
  endDate: string;
  homeCountry: string;
  destinationCountry: string;
  budgetAmount?: number;
  budgetCurrency?: string;
}

export function createTrip(input: TripInput): string {
  const trip: Trip = {
    id: id("trip"),
    name: input.name.trim() || "Untitled trip",
    homeCountry: input.homeCountry.toUpperCase(),
    destinationCountries: input.destinationCountry ? [input.destinationCountry.toUpperCase()] : [],
    startDate: input.startDate,
    endDate: input.endDate,
    budgetTarget:
      input.budgetAmount && input.budgetCurrency
        ? { amount: input.budgetAmount, currency: input.budgetCurrency.toUpperCase() }
        : undefined,
    travelers: [],
  };

  mutate((current) => ({
    ...current,
    trips: [...current.trips, trip],
    activeTripId: trip.id,
  }));

  return trip.id;
}

export function updateTrip(tripId: string, patch: Partial<Trip>): void {
  mutate((current) => ({
    ...current,
    trips: current.trips.map((trip) => (trip.id === tripId ? { ...trip, ...patch } : trip)),
  }));
}

export function deleteTrip(tripId: string): void {
  mutate((current) => {
    const trips = current.trips.filter((trip) => trip.id !== tripId);
    return {
      trips,
      activeTripId: current.activeTripId === tripId ? (trips[0]?.id ?? "") : current.activeTripId,
      items: current.items.filter((item) => item.tripId !== tripId),
      checklist: current.checklist.filter((entry) => entry.tripId !== tripId),
    };
  });
}

export function selectTrip(tripId: string): void {
  mutate((current) => ({ ...current, activeTripId: tripId }));
}

export function loadSampleTrip(): string {
  const sample = sampleState();
  mutate((current) => ({
    trips: [...current.trips.filter((trip) => trip.id !== SEED_TRIP.id), ...sample.trips],
    activeTripId: SEED_TRIP.id,
    items: [...current.items.filter((item) => item.tripId !== SEED_TRIP.id), ...sample.items],
    checklist: current.checklist.filter((entry) => entry.tripId !== SEED_TRIP.id),
  }));
  return SEED_TRIP.id;
}

/* ------------------------------------------------------------- travellers */

export function addTraveler(tripId: string, traveler: Omit<Traveler, "id">): void {
  updateTripTravelers(tripId, (travelers) => [...travelers, { ...traveler, id: id("traveler") }]);
}

export function updateTraveler(
  tripId: string,
  travelerId: string,
  patch: Partial<Traveler>,
): void {
  updateTripTravelers(tripId, (travelers) =>
    travelers.map((traveler) =>
      traveler.id === travelerId ? { ...traveler, ...patch } : traveler,
    ),
  );
}

export function removeTraveler(tripId: string, travelerId: string): void {
  updateTripTravelers(tripId, (travelers) =>
    travelers.filter((traveler) => traveler.id !== travelerId),
  );
}

function updateTripTravelers(
  tripId: string,
  update: (travelers: Traveler[]) => Traveler[],
): void {
  mutate((current) => ({
    ...current,
    trips: current.trips.map((trip) =>
      trip.id === tripId ? { ...trip, travelers: update(trip.travelers) } : trip,
    ),
  }));
}

/* ------------------------------------------------------------------ items */

export function addItem(
  tripId: string,
  draft: ItemDraft,
  meta: {
    confidence: number;
    extractionMethod: TripItem["extractionMethod"];
    addedBy?: string;
  },
): TripItem {
  const item: TripItem = {
    ...draft,
    id: id("item"),
    tripId,
    createdAt: new Date().toISOString(),
    confidence: meta.confidence,
    extractionMethod: meta.extractionMethod,
    addedBy: meta.addedBy,
  };

  mutate((current) => ({ ...current, items: [...current.items, item] }));
  return item;
}

export function updateItem(itemId: string, patch: Partial<TripItem>): void {
  mutate((current) => ({
    ...current,
    items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  }));
}

export function removeItem(itemId: string): void {
  mutate((current) => ({
    ...current,
    items: current.items.filter((item) => item.id !== itemId),
  }));
}

/** Clears a scheduled time, sending the item back to the ideas list. */
export function unscheduleItem(itemId: string): void {
  updateItem(itemId, { startsAt: undefined, endsAt: undefined });
}

/* -------------------------------------------------------------- checklist */

export function setChecklistDone(entryId: string, done: boolean): void {
  mutate((current) => ({
    ...current,
    checklist: current.checklist.map((entry) =>
      entry.id === entryId ? { ...entry, done } : entry,
    ),
  }));
}

export function setChecklistAssignee(entryId: string, assigneeId?: string): void {
  mutate((current) => ({
    ...current,
    checklist: current.checklist.map((entry) =>
      entry.id === entryId ? { ...entry, assigneeId } : entry,
    ),
  }));
}

export function addChecklistEntry(tripId: string, kind: ChecklistKind, label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;

  mutate((current) => ({
    ...current,
    checklist: [
      ...current.checklist,
      {
        id: id("chk"),
        tripId,
        kind,
        label: trimmed,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

export function removeChecklistEntry(entryId: string): void {
  mutate((current) => ({
    ...current,
    checklist: current.checklist.filter((entry) => entry.id !== entryId),
  }));
}

/** Replaces everything, for a trip opened from a share link. */
export function importTrip(trip: Trip, items: TripItem[]): void {
  mutate((current) => ({
    ...current,
    trips: [...current.trips.filter((existing) => existing.id !== trip.id), trip],
    activeTripId: trip.id,
    items: [...current.items.filter((item) => item.tripId !== trip.id), ...items],
  }));
}
