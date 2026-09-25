import type { AppState } from "./state";
import { emptyState, getSnapshot, replaceState } from "./state";

/**
 * Everything lives in this browser's storage, which means one "clear site
 * data" — or a reinstall, or a new phone — takes the lot. A backup file is
 * the only honest answer to that, so it is a plain JSON download the user
 * owns, not a service they have to trust.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  format: "manifest.backup";
  version: number;
  exportedAt: string;
  state: AppState;
}

export function buildBackup(snapshot: AppState = getSnapshot()): Backup {
  // A diversion is where someone is this afternoon, not part of the trip, and
  // a restore never brings one back — so it is not written out either.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { divert, ...state } = snapshot;

  return {
    format: "manifest.backup",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function backupFilename(now = new Date()): string {
  return `manifest-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Parsed and checked rather than trusted — this file came off a disk. */
export function parseBackup(text: string): Backup | { error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "That file is not JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { error: "That file is not a Manifest backup." };
  }

  const candidate = parsed as Partial<Backup>;
  if (candidate.format !== "manifest.backup") {
    return { error: "That file is not a Manifest backup." };
  }

  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return { error: "That backup came from a newer version of Manifest." };
  }

  const state = candidate.state;
  if (!state || !Array.isArray(state.trips) || !Array.isArray(state.items)) {
    return { error: "That backup is missing its trips." };
  }

  return {
    format: "manifest.backup",
    version: candidate.version,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
    state: {
      trips: state.trips,
      activeTripId: state.activeTripId ?? state.trips[0]?.id ?? "",
      items: state.items,
      checklist: Array.isArray(state.checklist) ? state.checklist : [],
      advice: Array.isArray(state.advice) ? state.advice : [],
    },
  };
}

export type RestoreMode = "merge" | "replace";

/**
 * Merging is the default because restoring onto a phone that already has a
 * trip on it should not silently eat that trip. Ids collide only if they came
 * from the same device, in which case the backup's copy is the newer one.
 */
export function restore(backup: Backup, mode: RestoreMode): void {
  if (mode === "replace") {
    replaceState(backup.state);
    return;
  }

  const current = getSnapshot();
  const trips = mergeById(current.trips, backup.state.trips);
  const merged: AppState = {
    trips,
    items: mergeById(current.items, backup.state.items),
    checklist: mergeById(current.checklist, backup.state.checklist),
    advice: [...(current.advice ?? []), ...(backup.state.advice ?? [])],
    activeTripId: backup.state.activeTripId || current.activeTripId,
    // Merging keeps what is on the device, including someone out on their own.
    divert: trips.some((trip) => trip.id === current.divert?.tripId) ? current.divert : undefined,
  };

  replaceState(merged);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}

export { emptyState };
