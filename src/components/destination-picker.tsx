"use client";

import { useMemo } from "react";
import { searchDestinations, findDestination, type Destination } from "@/lib/reference/destinations";
import { flagEmoji } from "@/lib/theme";
import { TextInput } from "./form";

/**
 * What text typed in the search but never picked amounts to: "pick" while it
 * still matches something to choose, "unknown" when it matches nothing, and
 * nothing at all when it is empty or only matches what is already picked
 * (then nothing is lost by ignoring it).
 */
export function unpickedDestination(query: string, selected: string[]): "pick" | "unknown" | undefined {
  if (!query.trim()) return undefined;
  const matches = searchDestinations(query);
  if (matches.length === 0) return "unknown";
  return matches.some((entry) => !selected.includes(entry.id)) ? "pick" : undefined;
}

/**
 * Where you are going, typed rather than hunted for in a list of 117. Picking
 * a city keeps the city for the map and the advisor, but it is the country
 * behind it that switches on the visa, plug, currency and weather checks.
 */
export function DestinationPicker({
  selected,
  onChange,
  query,
  onQueryChange,
  inputId,
  unpicked = false,
  autoFocus = false,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * What is typed in the search, held by the form, so it can tell a
   * destination typed but never picked from one that was never wanted.
   */
  query: string;
  onQueryChange: (query: string) => void;
  inputId: string;
  /**
   * Set by the form when it was submitted with text still typed here, which
   * turns the note under the search into an error. Drawn here rather than by
   * the Field around the picker: the search names itself, so a Field's error
   * would not reach a screen reader.
   */
  unpicked?: boolean;
  autoFocus?: boolean;
}) {
  const chosen = useMemo(
    () => selected.map((id) => findDestination(id)).filter((entry): entry is Destination => Boolean(entry)),
    [selected],
  );

  const matches = useMemo(() => searchDestinations(query), [query]);
  const results = useMemo(() => {
    const already = new Set(selected);
    return matches.filter((entry) => !already.has(entry.id));
  }, [matches, selected]);

  // Typed text that matches nothing would otherwise just sit there, looking accepted.
  const typed = query.trim();
  // As unpickedDestination works it out, from the search already run.
  const pending = !typed ? undefined : matches.length === 0 ? "unknown" : results.length > 0 ? "pick" : undefined;
  const error = !unpicked
    ? undefined
    : pending === "pick"
      ? "Not added yet. Pick it from the list, or clear it."
      : pending === "unknown"
        ? `Nothing called “${typed}” in the list. Clear it, or try the country it is in.`
        : undefined;
  const note =
    pending === "unknown"
      ? `Nothing called “${typed}” in the list. Try the country it is in.`
      : typed && results.length === 0
        ? "Already on your list."
        : undefined;
  const noteId = `${inputId}-note`;

  function add(destination: Destination) {
    onChange([...selected, destination.id]);
    onQueryChange("");
  }

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        id={inputId}
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label="Search for a city or country"
        aria-invalid={error ? true : undefined}
        aria-describedby={error || note ? noteId : undefined}
        placeholder="Kyoto, Portugal, Mexico City…"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            add(results[0]);
          }
        }}
      />

      {error ? (
        <p id={noteId} className="text-caption text-critical">
          {error}
        </p>
      ) : (
        note && (
          <p id={noteId} className="text-caption text-ink-soft">
            {note}
          </p>
        )
      )}

      {results.length > 0 && (
        // Rows are inset and rounded rather than clipped, so their focus rings stay visible.
        <ul className="rounded-card border border-line bg-surface p-1">
          {results.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => add(destination)}
                className="press flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-surface-2"
              >
                <span aria-hidden="true" className="text-body">
                  {flagEmoji(destination.countryCode)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subheadline">{destination.label}</span>
                  {destination.kind === "city" && (
                    <span className="block truncate text-footnote text-ink-soft">
                      {destination.countryName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-caption text-ink-soft">
                  {destination.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen.length > 0 && (
        // gap-y-3 keeps the 44px hit areas of chips on wrapped lines from overlapping.
        <ul className="flex flex-wrap gap-x-2 gap-y-3">
          {chosen.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((id) => id !== destination.id))}
                aria-label={`Remove ${destination.label}`}
                className="press tap flex min-h-8 items-center gap-1 rounded-badge border border-accent bg-accent-soft px-3 text-footnote text-accent-strong"
              >
                <span aria-hidden="true">{flagEmoji(destination.countryCode)}</span>
                {destination.label}
                <span aria-hidden="true" className="text-ink-faint">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
