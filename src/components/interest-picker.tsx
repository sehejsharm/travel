"use client";

import { useId } from "react";
import { INTERESTS, MAX_INTERESTS, togglePick } from "@/lib/advisor/interests";
import { LineIcon } from "./line-icon";

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
      {/*
        A list, not tiles: rows split by hairlines, so the picker is not a
        card inside a card and 22 of them stay short. Two columns from sm up;
        the top row of each column drops its hairline.
      */}
      <div className="grid sm:grid-cols-2 sm:gap-x-8">
        {INTERESTS.map((interest) => {
          const active = chosen.has(interest.id);
          // Unavailable, not disabled, so the row stays in the Tab order and
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
              className="press flex min-h-11 items-center gap-3 border-t border-line py-2 text-left first:border-t-0 aria-disabled:opacity-40 sm:nth-2:border-t-0"
            >
              <LineIcon name={interest.icon} className="shrink-0 text-ink-soft" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-subheadline font-medium text-ink">{interest.label}</span>
                <span className="text-caption text-ink-soft">{interest.blurb}</span>
              </span>
              {/* The unticked edge is field-edge, 3:1 like any control's; ticked, a drawn check on copper. */}
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? "border-accent bg-accent text-accent-ink" : "border-field-edge"
                }`}
              >
                {active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
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
    return `${count} picked. Discover looks up ${MAX_INTERESTS} at a time, so unpick ${count - MAX_INTERESTS} to choose which.`;
  }
  if (count === MAX_INTERESTS) {
    return `${count} picked, the most Discover looks up at a time. Unpick one to swap it for another.`;
  }
  if (count > 0) return `${count} picked. Each becomes a section of your suggestions.`;
  return min > 0 ? `Pick at least ${min}.` : "Optional. You can pick these later.";
}
