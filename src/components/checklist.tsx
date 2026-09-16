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
  entries: allEntries,
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
  const [whose, setWhose] = useState<string>("everyone");

  /**
   * There are no accounts and nothing syncs, so "assign" would be a promise
   * the app cannot keep. What this actually is, is a way to split the list
   * between the people holding this phone — so it says that, and filtering by
   * a name is the point rather than a side effect.
   */
  const entries =
    whose === "everyone"
      ? allEntries
      : whose === "nobody"
        ? allEntries.filter((entry) => !entry.assigneeId)
        : allEntries.filter((entry) => entry.assigneeId === whose);

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

      {travelers.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {[
            { value: "everyone", label: "Everyone" },
            ...travelers.map((traveler) => ({ value: traveler.id, label: traveler.name })),
            { value: "nobody", label: "Nobody yet" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setWhose(option.value)}
              aria-pressed={whose === option.value}
              className={`press shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                whose === option.value
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        {/*
          Scaled rather than resized: width animations relayout the bar on
          every frame, and this one moves on every tick of a checkbox.
        */}
        <div
          className="h-full origin-left rounded-full bg-teal transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${progress / 100})`, width: "100%" }}
        />
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          {allEntries.length > 0 ? "Nothing on this person's list." : emptyLabel}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-3 rounded-lg px-1 py-1.5 transition-colors duration-200"
            >
              <Checkbox
                checked={entry.done}
                label={entry.label}
                onChange={(next) => setChecklistDone(entry.id, next)}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-snug transition-[color,opacity] duration-[var(--dur-move)] ease-[var(--ease-soft)] ${
                    entry.done ? "text-ink-faint line-through opacity-70" : ""
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
                      aria-label={`Whose job: ${entry.label}`}
                      className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-soft outline-none focus:border-accent"
                    >
                      <option value="">whose job?</option>
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

/**
 * The most-tapped control in the app, so it gets the most care: the box fills
 * with a slight overshoot and the tick draws itself. A real input sits
 * underneath, so keyboard, screen readers and form semantics are untouched.
 */
function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />

      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border transition-all duration-[var(--dur-micro)] ease-[var(--ease-spring)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 ${
          checked
            ? "scale-100 border-teal bg-teal"
            : "border-line-strong bg-surface peer-hover:border-teal"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.2 4.6 8.8 10 3.4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={checked ? "animate-check" : "opacity-0"}
          />
        </svg>
      </span>
    </span>
  );
}
