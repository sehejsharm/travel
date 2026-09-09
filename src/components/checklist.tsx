"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addChecklist, assignChecklist, removeChecklist, toggleChecklist } from "@/app/actions";
import type { ChecklistEntry, ChecklistKind } from "@/lib/checklists";
import type { Traveler } from "@/lib/domain/types";

export function Checklist({
  title,
  kind,
  entries,
  travelers,
  emptyLabel,
  note,
  compact = false,
}: {
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
  const [pending, startTransition] = useTransition();

  // The box has to flip on click, not a server round-trip later.
  const [shown, applyOptimistic] = useOptimistic(
    entries,
    (current, update: { id: string; done: boolean }) =>
      current.map((entry) =>
        entry.id === update.id ? { ...entry, done: update.done } : entry,
      ),
  );

  const done = shown.filter((entry) => entry.done).length;

  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="font-mono text-[11px] text-ink-faint tabular">
          {done}/{shown.length} done
        </p>
      </div>

      {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}

      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {shown.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={entry.done}
                aria-label={entry.label}
                onChange={(event) => {
                  const next = event.target.checked;
                  startTransition(async () => {
                    applyOptimistic({ id: entry.id, done: next });
                    await toggleChecklist(entry.id, next);
                  });
                }}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent-2)]"
              />

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${entry.done ? "text-ink-faint line-through" : ""}`}>
                  {entry.label}
                </p>
                {entry.detail && !entry.done && !compact && (
                  <p className="text-xs text-ink-soft">{entry.detail}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {entry.generatedFrom && !compact && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-faint">
                      from {entry.generatedFrom}
                    </span>
                  )}
                  {travelers.length > 1 && (
                    <select
                      value={entry.assigneeId ?? ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        startTransition(() => assignChecklist(entry.id, next));
                      }}
                      aria-label={`Assign ${entry.label}`}
                      className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-soft outline-none focus:border-accent"
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
                      onClick={() => startTransition(() => removeChecklist(entry.id))}
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
          const label = draft;
          setDraft("");
          startTransition(() => addChecklist(kind, label));
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Add to ${title.toLowerCase()}`}
          placeholder="Add your own…"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || draft.trim().length === 0}
          className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft hover:border-accent hover:text-accent-strong disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </section>
  );
}
