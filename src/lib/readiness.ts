import type { ChecklistEntry } from "./checklists";
import type { Flag } from "./domain/types";

/**
 * One number for "how ready is this trip", computed from the same two lists
 * the Checks screen shows. Ticking a pre-trip task settles the check that
 * raised it, so the ring on the trip screen moves the moment you tick a box —
 * the two screens are the same fact, seen twice.
 */
export interface Readiness {
  /** Non-info checks plus packing entries: everything with a done state. */
  total: number;
  done: number;
  /** 0 to 1. A trip with nothing to do is ready, not zero. */
  share: number;
  /** Criticals still outstanding — the "N things to fix" counter. */
  criticalOpen: number;
  /** Criticals a ticked task has settled, so progress is visible. */
  criticalSettled: number;
}

export function readiness(flags: Flag[], checklist: ChecklistEntry[]): Readiness {
  const tasks = checklist.filter((entry) => entry.kind === "task");
  const packing = checklist.filter((entry) => entry.kind === "packing");

  const settled = new Set<string>();
  for (const task of tasks) {
    if (!task.done) continue;
    if (task.sourceFlagId) settled.add(task.sourceFlagId);
    // Entries filed before tasks carried a flag id still match on their label.
    settled.add(task.label);
  }

  const actionable = flags.filter((flag) => flag.severity !== "info");
  const isSettled = (flag: Flag) => settled.has(flag.id) || settled.has(flag.title);

  const flagsDone = actionable.filter(isSettled).length;
  const packingDone = packing.filter((entry) => entry.done).length;

  // Tasks a person typed themselves are work too, and are not any check.
  const ownTasks = tasks.filter((task) => !task.generatedFrom);
  const ownDone = ownTasks.filter((task) => task.done).length;

  const total = actionable.length + packing.length + ownTasks.length;
  const done = flagsDone + packingDone + ownDone;

  return {
    total,
    done,
    share: total === 0 ? 1 : done / total,
    criticalOpen: actionable.filter((flag) => flag.severity === "critical" && !isSettled(flag))
      .length,
    criticalSettled: actionable.filter((flag) => flag.severity === "critical" && isSettled(flag))
      .length,
  };
}

/** Whether a given check has been ticked off, for the Checks screen. */
export function settledFlagIds(checklist: ChecklistEntry[]): Set<string> {
  const settled = new Set<string>();
  for (const entry of checklist) {
    if (entry.kind !== "task" || !entry.done) continue;
    if (entry.sourceFlagId) settled.add(entry.sourceFlagId);
    settled.add(entry.label);
  }
  return settled;
}
