"use client";

import { useId } from "react";
import { INTERESTS, MAX_INTERESTS, togglePick } from "@/lib/advisor/interests";

/**
 * The first question the advisor asks. Tapping a few of these is the whole
 * setup — what you pick becomes the headings your suggestions arrive under.
 */
export function InterestPicker({
  selected,
  onChange,
  min = 1,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * How many the screen asks for before it goes on. 0 where picking is
   * optional, as in trip creation, so the caption does not ask for one.
   */
  min?: number;
}) {
  const chosen = new Set(selected);
  // Only ones still on the list count: an id from an old backup is not a section.
  const count = INTERESTS.filter((interest) => chosen.has(interest.id)).length;
  // At the limit the rest wait, rather than be picked and then quietly dropped.
  const full = count >= MAX_INTERESTS;
  const captionId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {INTERESTS.map((interest) => {
          const active = chosen.has(interest.id);
          // Unavailable, not disabled, so the tile stays in the Tab order and
          // a screen reader can still reach it, hear what it is and why it waits.
          const waiting = full && !active;

          return (
            <button
              key={interest.id}
              type="button"
              onClick={() => {
                if (!waiting) onChange(togglePick(selected, interest.id));
              }}
              aria-pressed={active}
              aria-disabled={waiting || undefined}
              aria-describedby={waiting ? captionId : undefined}
              className={`press flex flex-col items-start gap-1 rounded-card border p-3 text-left aria-disabled:opacity-40 ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-line-strong aria-disabled:hover:border-line"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span aria-hidden="true" className="text-title-3">
                  {interest.emoji}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-caption-2 ${
                    active
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line-strong text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              {/* Balanced and pretty, so a narrow tile breaks "Camping & / road trips", not "Camping & road / trips". */}
              <span
                className={`text-balance text-subheadline font-medium ${active ? "text-accent-strong" : "text-ink"}`}
              >
                {interest.label}
              </span>
              <span className="text-pretty text-caption text-ink-soft">
                {interest.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {/* Polite, so reaching the limit is said out loud, not only shown by the dimmed rest. */}
      <p id={captionId} aria-live="polite" className="text-caption text-ink-soft tabular">
        {pickedCaption(count, min)}
      </p>
    </div>
  );
}

function pickedCaption(count: number, min: number): string {
  if (count > MAX_INTERESTS) {
    return `${count} picked — Discover looks up ${MAX_INTERESTS} at a time, so unpick ${count - MAX_INTERESTS} to choose which.`;
  }
  if (count === MAX_INTERESTS) {
    return `${count} picked, the most Discover looks up at a time. Unpick one to swap it for another.`;
  }
  if (count > 0) return `${count} picked — each becomes a section of your suggestions.`;
  return min > 0 ? `Pick at least ${min}.` : "Optional — you can pick these later.";
}
