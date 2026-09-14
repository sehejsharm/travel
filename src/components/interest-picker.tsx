"use client";

import { INTERESTS } from "@/lib/advisor/interests";

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
  min?: number;
}) {
  const chosen = new Set(selected);

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(INTERESTS.filter((interest) => next.has(interest.id)).map((interest) => interest.id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {INTERESTS.map((interest) => {
          const active = chosen.has(interest.id);

          return (
            <button
              key={interest.id}
              type="button"
              onClick={() => toggle(interest.id)}
              aria-pressed={active}
              className={`press flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span aria-hidden="true" className="text-xl leading-none">
                  {interest.emoji}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                    active
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line-strong text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span
                className={`text-sm font-medium ${active ? "text-accent-strong" : "text-ink"}`}
              >
                {interest.label}
              </span>
              <span className="font-mono text-[10px] leading-snug text-ink-faint">
                {interest.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <p className="font-mono text-[10px] text-ink-faint">
        {selected.length === 0
          ? `Pick at least ${min}.`
          : `${selected.length} picked — each becomes a section of your suggestions.`}
      </p>
    </div>
  );
}
