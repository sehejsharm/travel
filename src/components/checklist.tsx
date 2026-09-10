"use client";

import { useState } from "react";
import type { ChecklistEntry, ChecklistKind } from "@/lib/checklists";
import type { Traveler } from "@/lib/domain/types";
import {
  addChecklistEntry,
  removeChecklistEntry,
  setChecklistAssignee,
  setChecklistDone,
} from "@/lib/store/state";
import { Card } from "./ui";

export function Checklist({
  tripId,
  title,
  kind,
  entries,
  travelers,
  emptyLabel,
  note,
  compact = false,
}: {
  tripId: string;
  title: string;
  kind: ChecklistKind;
  entries: ChecklistEntry[];
  travelers: Traveler[];
  emptyLabel: string;
  note?: string;
  /** Drops the explanation, for lists whose detail is already on the page. */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const done = entries.filter((entry) => entry.done).length;
  const progress = entries.length > 0 ? (done / entries.length) * 100 : 0;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-[11px] text-ink-faint tabular">
          {done}/{entries.length}
        </span>
      </div>

      {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-lg py-1.5">
              <input
                type="checkbox"
                checked={entry.done}
                aria-label={entry.label}
                onChange={(event) => setChecklistDone(entry.id, event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded accent-[var(--teal)]"
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-snug ${
                    entry.done ? "text-ink-faint line-through" : ""
                  }`}
                >
                  {entry.label}
                </p>
                {entry.detail && !entry.done && !compact && (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{entry.detail}</p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {entry.generatedFrom && !compact && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-faint">
                      {entry.generatedFrom}
                    </span>
                  )}
                  {travelers.length > 1 && (
                    <select
                      value={entry.assigneeId ?? ""}
                      onChange={(event) =>
                        setChecklistAssignee(entry.id, event.target.value || undefined)
                      }
                      aria-label={`Assign ${entry.label}`}
                      className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-soft outline-none focus:border-accent"
                    >
                      <option value="">unassigned</option>
                      {travelers.map((traveler) => (
                        <option key={traveler.id} value={traveler.id}>
                          {traveler.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {!entry.generatedFrom && (
                    <button
                      type="button"
                      onClick={() => removeChecklistEntry(entry.id)}
                      className="font-mono text-[10px] text-ink-faint underline hover:text-critical"
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addChecklistEntry(tripId, kind, draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Add to ${title.toLowerCase()}`}
          placeholder="Add your own…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          className="press rounded-xl border border-line px-3.5 py-2 font-mono text-[11px] text-ink-soft disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </Card>
  );
}
