import type { ChecklistEntry, ChecklistKind, GeneratedEntry } from "../checklists";
import { generatePacking, generateTasks } from "../checklists";
import type { Trip, TripItem } from "../domain/types";
import type { ItemDraft } from "../extract/types";
import { runChecks } from "../rules";
import { SEED_ITEMS, SEED_TRIP } from "./seed";

export interface AppState {
  trip: Trip;
  items: TripItem[];
  checklist: ChecklistEntry[];
}

const STORAGE_KEY = "manifest.state.v1";

function freshState(): AppState {
  const state: AppState = { trip: SEED_TRIP, items: SEED_ITEMS, checklist: [] };
  return withGeneratedChecklists(state);
}

/**
 * Generated entries are added if missing; a ticked box or an assignment is
 * never overwritten.
 */
function withGeneratedChecklists(state: AppState): AppState {
  const flags = runChecks(state.trip, state.items, new Date());
  const generated: [ChecklistKind, GeneratedEntry[]][] = [
    ["packing", generatePacking(state.trip, state.items)],
    ["task", generateTasks(flags)],
  ];

  const existing = new Set(state.checklist.map((entry) => `${entry.kind}:${entry.label}`));
  const additions: ChecklistEntry[] = [];

  for (const [kind, entries] of generated) {
    for (const entry of entries) {
      if (existing.has(`${kind}:${entry.label}`)) continue;
      additions.push({
        id: `chk-${Math.random().toString(36).slice(2, 10)}`,
        tripId: state.trip.id,
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

function read(): AppState {
  if (typeof window === "undefined") return freshState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();

    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.trip || !Array.isArray(parsed.items)) return freshState();

    return withGeneratedChecklists({
      trip: parsed.trip,
      items: parsed.items,
      checklist: parsed.checklist ?? [],
    });
  } catch {
    // A corrupt or unreadable store should never leave the app blank.
    return freshState();
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

function emit(): void {
  for (const listener of listeners) listener();
}

function set(next: AppState): void {
  state = next;
  write(next);
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): AppState {
  if (!state) state = read();
  return state;
}

/** The server has no stored state, so it renders the seed. */
export function getServerSnapshot(): AppState {
  return freshState();
}

export function addItem(draft: ItemDraft, meta: {
  confidence: number;
  extractionMethod: TripItem["extractionMethod"];
  addedBy?: string;
}): TripItem {
  const current = getSnapshot();
  const item: TripItem = {
    ...draft,
    id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    tripId: current.trip.id,
    createdAt: new Date().toISOString(),
    confidence: meta.confidence,
    extractionMethod: meta.extractionMethod,
    addedBy: meta.addedBy,
  };

  set(withGeneratedChecklists({ ...current, items: [...current.items, item] }));
  return item;
}

export function removeItem(id: string): void {
  const current = getSnapshot();
  set({ ...current, items: current.items.filter((item) => item.id !== id) });
}

export function setChecklistDone(id: string, done: boolean): void {
  const current = getSnapshot();
  set({
    ...current,
    checklist: current.checklist.map((entry) =>
      entry.id === id ? { ...entry, done } : entry,
    ),
  });
}

export function setChecklistAssignee(id: string, assigneeId?: string): void {
  const current = getSnapshot();
  set({
    ...current,
    checklist: current.checklist.map((entry) =>
      entry.id === id ? { ...entry, assigneeId } : entry,
    ),
  });
}

export function addChecklistEntry(kind: ChecklistKind, label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;

  const current = getSnapshot();
  set({
    ...current,
    checklist: [
      ...current.checklist,
      {
        id: `chk-${Math.random().toString(36).slice(2, 10)}`,
        tripId: current.trip.id,
        kind,
        label: trimmed,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

export function removeChecklistEntry(id: string): void {
  const current = getSnapshot();
  set({ ...current, checklist: current.checklist.filter((entry) => entry.id !== id) });
}

export function updateTrip(patch: Partial<Trip>): void {
  const current = getSnapshot();
  set(withGeneratedChecklists({ ...current, trip: { ...current.trip, ...patch } }));
}

/** Restores the bundled sample trip. */
export function resetToSample(): void {
  set(freshState());
}

/** Replaces everything, for a trip opened from a share link. */
export function replaceState(next: AppState): void {
  set(withGeneratedChecklists(next));
}
