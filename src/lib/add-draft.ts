"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_MANUAL, resetManual, toManualValues, type ManualValues } from "./manual-entry";

/**
 * The Add screen's unfinished work: which way in was picked, what was pasted
 * or shared to be read, and a typed item not yet filed. It outlives the
 * screen, so leaving for another tab to look up a booking reference — or the
 * phone reloading the app behind your back while you do — loses none of it.
 *
 * Kept in sessionStorage rather than with the trip: it belongs to this tab,
 * is gone when the tab closes, and never travels in a backup.
 */

export type AddMode = "drop" | "type";

export interface AddDraft {
  mode: AddMode;
  /** The box of things to be read: a pasted email, a shared link, a note. */
  text: string;
  manual: ManualValues;
}

const KEY = "manifest.add-draft.v1";
const INITIAL: AddDraft = { mode: "drop", text: "", manual: EMPTY_MANUAL };

let current: AddDraft | undefined;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function load(): AddDraft {
  if (current) return current;

  let saved: unknown;
  try {
    const raw = storage()?.getItem(KEY);
    saved = raw ? JSON.parse(raw) : undefined;
  } catch {
    saved = undefined;
  }

  const record = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  current = {
    mode: record.mode === "type" ? "type" : "drop",
    text: typeof record.text === "string" ? record.text : "",
    manual: toManualValues(record.manual),
  };
  return current;
}

function save(next: AddDraft): void {
  current = next;
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and full storage still keep it for as long as the app is open.
  }
  for (const listener of listeners) listener();
}

export function getAddDraft(): AddDraft {
  return load();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAddDraft(): AddDraft {
  return useSyncExternalStore(subscribe, getAddDraft, () => INITIAL);
}

export function setAddMode(mode: AddMode): void {
  const draft = load();
  if (draft.mode !== mode) save({ ...draft, mode });
}

export function editManual(patch: Partial<ManualValues>): void {
  const draft = load();
  save({ ...draft, manual: { ...draft.manual, ...patch } });
}

export function editReadText(text: string): void {
  const draft = load();
  if (draft.text !== text) save({ ...draft, text });
}

/** Something shared to the app: it is to be read, whatever way in was last used. */
export function takeShare(text: string): void {
  save({ ...load(), mode: "drop", text });
}

/** Empties the typed item, keeping the kind that was picked. */
export function clearManual(): void {
  const draft = load();
  save({ ...draft, manual: resetManual(draft.manual) });
}
