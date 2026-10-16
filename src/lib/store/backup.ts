import type { AppState } from "./state";
import { emptyState, getSnapshot, replaceState } from "./state";

/**
 * Everything lives in this browser's storage, which means one "clear site
 * data" — or a reinstall, or a new phone — takes the lot. A backup file is
 * the only honest answer to that, so it is a plain JSON download the user
 * owns, not a service they have to trust.
 */

export const BACKUP_VERSION = 1;

/**
 * The store lives in localStorage, which browsers cap at about 5 MB a site.
 * Written out with indentation a full store roughly doubles, so no backup
 * Manifest made can be bigger than this, and a file that is gets refused
 * before it is read into memory.
 */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

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

/** Why a file of this size cannot be a backup, or nothing when it can. */
export function backupSizeError(bytes: number): string | undefined {
  if (bytes <= MAX_BACKUP_BYTES) return undefined;
  return `That file is ${(bytes / 1024 / 1024).toFixed(1)} MB, bigger than any Manifest backup can be, so it was not opened.`;
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
    // Merging keeps what is on the device, including someone out on their own,
    // for as long as the merged trip still has them in a group (see tidy()).
    divert: current.divert,
  };

  replaceState(merged);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}

export { emptyState };
