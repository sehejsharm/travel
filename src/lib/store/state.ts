import type { ChecklistEntry, ChecklistKind, GeneratedEntry } from "../checklists";
import { generatePacking, generateTasks } from "../checklists";
import type { Trip, TripItem, Traveler } from "../domain/types";
import type { AdviceResult } from "../advisor/types";
import type { ItemDraft } from "../extract/types";
import { getCountry } from "../reference/countries";
import { runChecks } from "../rules";
import { SEED_ITEMS, SEED_TRIP } from "./seed";

export interface CachedAdvice {
  tripId: string;
  /** Destination and interests, so a changed question misses the cache. */
  key: string;
  result: AdviceResult;
}

export interface AppState {
  trips: Trip[];
  activeTripId: string;
  /** Items for every trip; screens filter by the active one. */
  items: TripItem[];
  checklist: ChecklistEntry[];
  /** Suggestions already paid for, kept so they are not paid for twice. */
  advice?: CachedAdvice[];
}

const STORAGE_KEY = "manifest.state.v2";
const LEGACY_KEY = "manifest.state.v1";

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyState(): AppState {
  return { trips: [], activeTripId: "", items: [], checklist: [], advice: [] };
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
          advice: parsed.advice ?? [],
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
  /** Country codes. A city destination resolves to its country before it lands here. */
  destinationCountries: string[];
  /** A trip can be created before its dates are known. */
  datesTbd?: boolean;
  /** Names only — documents are asked for later, by the checks that need them. */
  travelerNames?: string[];
  budgetAmount?: number;
  budgetCurrency?: string;
}

export function createTrip(input: TripInput): string {
  const trip: Trip = {
    id: id("trip"),
    name: input.name.trim() || "Untitled trip",
    homeCountry: input.homeCountry.toUpperCase(),
    destinationCountries: [
      ...new Set(input.destinationCountries.map((code) => code.toUpperCase()).filter(Boolean)),
    ],
    startDate: input.startDate,
    endDate: input.endDate,
    datesTbd: input.datesTbd,
    travelers: (input.travelerNames ?? [])
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: id("traveler"), name, passportCountry: "", passportExpiry: "" })),
    budgetTarget:
      input.budgetAmount && input.budgetCurrency
        ? { amount: input.budgetAmount, currency: input.budgetCurrency.toUpperCase() }
        : undefined,
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
      advice: (current.advice ?? []).filter((entry) => entry.tripId !== tripId),
    };
  });
}

/**
 * A trip used as a template. What carries over is the shape of the trip —
 * who is going, what they are into, the packing habits — never the bookings,
 * the dates or the checks, which belong to the trip that is now finished.
 */
export function duplicateTrip(tripId: string, name: string): string | undefined {
  const source = getSnapshot().trips.find((trip) => trip.id === tripId);
  if (!source) return undefined;

  const copy: Trip = {
    ...source,
    id: id("trip"),
    name: name.trim() || `${source.name} again`,
    datesTbd: true,
    // Travellers come with their documents: a passport does not expire because
    // you started a new trip, and the checks need it either way.
    travelers: source.travelers.map((traveler) => ({ ...traveler, id: id("traveler") })),
  };

  // Hand-written checklist entries are habits worth keeping; generated ones
  // rebuild themselves from the new trip's own checks.
  const handwritten = getSnapshot()
    .checklist.filter((entry) => entry.tripId === tripId && !entry.generatedFrom)
    .map((entry) => ({ ...entry, id: id("check"), tripId: copy.id, done: false, assigneeId: undefined }));

  mutate((current) => ({
    ...current,
    trips: [...current.trips, copy],
    activeTripId: copy.id,
    checklist: [...current.checklist, ...handwritten],
  }));

  return copy.id;
}

/**
 * A trip conjured out of the first thing you filed. A flight confirmation
 * knows where and when; a Reel usually only knows where. Whatever it does not
 * know is left open rather than guessed, which is what datesTbd is for.
 */
export function startTripFromDraft(draft: ItemDraft, homeCountry = "IN"): string {
  const country = draft.arrivalPlace?.countryCode ?? draft.place?.countryCode;
  const city = draft.arrivalPlace?.city ?? draft.place?.city;
  const info = country ? getCountry(country) : undefined;

  const start = draft.startsAt?.slice(0, 10);
  const end = draft.endsAt?.slice(0, 10) ?? start;

  return createTrip({
    name: city ?? info?.name ?? "New trip",
    destinationCountries: country && country !== homeCountry ? [country] : [],
    startDate: start ?? new Date().toISOString().slice(0, 10),
    endDate: end && start && end >= start ? end : (start ?? new Date().toISOString().slice(0, 10)),
    datesTbd: !start,
    homeCountry,
  });
}

/** A prompt waved away stays away — asked once, not every launch. */
export function dismissPrompt(tripId: string, prompt: string): void {
  mutate((current) => ({
    ...current,
    trips: current.trips.map((trip) =>
      trip.id === tripId
        ? { ...trip, dismissedPrompts: [...new Set([...(trip.dismissedPrompts ?? []), prompt])] }
        : trip,
    ),
  }));
}

export function selectTrip(tripId: string): void {
  mutate((current) => ({ ...current, activeTripId: tripId }));
}

/** The sample trip's id, so the UI can tell whether it is already loaded. */
export const SAMPLE_TRIP_ID = SEED_TRIP.id;

/** Adds the sample alongside whatever is already there — never replaces it. */
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

/* ---------------------------------------------------------------- advice */

/**
 * Advice is cached per trip, destination and interest set: the same question
 * costs the same money every time it is asked, and the answer does not move
 * hour to hour. Clearing it is a deliberate refresh.
 */
export function cacheAdvice(tripId: string, key: string, result: AdviceResult): void {
  mutate((current) => ({
    ...current,
    advice: [
      ...(current.advice ?? []).filter(
        (entry) => !(entry.tripId === tripId && entry.key === key),
      ),
      { tripId, key, result },
    ],
  }));
}

export function cachedAdvice(state: AppState, tripId: string, key: string): AdviceResult | undefined {
  return (state.advice ?? []).find((entry) => entry.tripId === tripId && entry.key === key)?.result;
}

export function clearAdvice(tripId: string): void {
  mutate((current) => ({
    ...current,
    advice: (current.advice ?? []).filter((entry) => entry.tripId !== tripId),
  }));
}

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
