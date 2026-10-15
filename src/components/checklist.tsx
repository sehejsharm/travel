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
import { RemoveButton, SecondaryButton, TextInput } from "./form";
import { POPUP_BUTTON_CLASSES } from "./styles";
import { Card, Chip } from "./ui";

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
        <h2 className="text-title-3">{title}</h2>
        <span className="text-footnote text-ink-soft tabular">
          {done}/{entries.length}
        </span>
      </div>

      {note && <p className="mt-1 text-caption text-ink-soft">{note}</p>}

      {travelers.length > 1 && (
        // The padding keeps each chip's 44px hit area and focus ring inside the scroller, which clips.
        <div className="no-scrollbar -mx-1 mt-1 -mb-2 flex gap-2 overflow-x-auto px-1 py-2">
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
              className={`press tap flex min-h-8 shrink-0 items-center rounded-badge border px-3 text-footnote ${
                whose === option.value
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        {/*
          Scaled rather than resized: width animations relayout the bar on
          every frame, and this one moves on every tick of a checkbox.
        */}
        <div
          className="h-full origin-left rounded-full bg-teal transition-transform duration-300 ease-[var(--ease-spring)]"
          style={{ transform: `scaleX(${progress / 100})`, width: "100%" }}
        />
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-subheadline text-ink-soft">
          {allEntries.length > 0 ? "Nothing on this person's list." : emptyLabel}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-control px-1 py-2">
              <Checkbox
                checked={entry.done}
                label={entry.label}
                onChange={(next) => setChecklistDone(entry.id, next)}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-subheadline transition-colors duration-300 ease-[var(--ease-spring)] ${
                    entry.done ? "text-ink-soft line-through" : ""
                  }`}
                >
                  {entry.label}
                </p>
                {entry.detail && !entry.done && !compact && (
                  <p className="mt-1 text-footnote text-ink-soft">{entry.detail}</p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {entry.generatedFrom && !compact && (
                    <Chip>{entry.generatedFrom.charAt(0).toUpperCase() + entry.generatedFrom.slice(1)}</Chip>
                  )}
                  {/*
                    Only worth asking while it is still someone's job. On a
                    done row it is noise, and with a dozen ticked items it was
                    a dropdown per line.
                  */}
                  {travelers.length > 1 && !entry.done && (
                    // A pop-up button inside the row, not a full form field.
                    <select
                      value={entry.assigneeId ?? ""}
                      onChange={(event) =>
                        setChecklistAssignee(entry.id, event.target.value || undefined)
                      }
                      aria-label={`Whose job: ${entry.label}`}
                      className={`-ml-2 ${POPUP_BUTTON_CLASSES}`}
                    >
                      <option value="">Whose job?</option>
                      {travelers.map((traveler) => (
                        <option key={traveler.id} value={traveler.id}>
                          {traveler.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {entry.done && entry.assigneeId && (
                    <span className="text-caption text-ink-soft">
                      {travelers.find((traveler) => traveler.id === entry.assigneeId)?.name}
                    </span>
                  )}
                  {!entry.generatedFrom && (
                    <RemoveButton type="button" onClick={() => removeChecklistEntry(entry.id)}>
                      Remove
                    </RemoveButton>
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
        <TextInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Add to ${title.toLowerCase()}`}
          placeholder="Add your own…"
          className="min-w-0 flex-1"
        />
        <SecondaryButton
          type="submit"
          disabled={draft.trim().length === 0}
          className="shrink-0"
        >
          Add
        </SecondaryButton>
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
    // A label, so a tap anywhere in its 44 x 44 hit area (.tap) reaches the input.
    <label className="press tap relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 cursor-pointer accent-[var(--accent)] opacity-0"
      />

      <span
        aria-hidden="true"
        className={`flex h-5 w-5 items-center justify-center rounded-badge border transition-[background-color,border-color] duration-300 ease-[var(--ease-spring)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 ${
          checked
            ? "scale-100 border-teal bg-teal"
            : "border-line-strong bg-surface peer-hover:border-teal"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.2 4.6 8.8 10 3.4"
            stroke="var(--surface)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={checked ? "animate-check" : "opacity-0"}
          />
        </svg>
      </span>
    </label>
  );
}
