"use client";

import { useMemo, useState } from "react";
import { searchDestinations, findDestination, type Destination } from "@/lib/reference/destinations";
import { flagEmoji } from "@/lib/theme";
import { TextInput } from "./form";

/**
 * Where you are going, typed rather than hunted for in a list of 117. Picking
 * a city keeps the city for the map and the advisor, but it is the country
 * behind it that switches on the visa, plug, currency and weather checks.
 */
export function DestinationPicker({
  selected,
  onChange,
  autoFocus = false,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");

  const chosen = useMemo(
    () => selected.map((id) => findDestination(id)).filter((entry): entry is Destination => Boolean(entry)),
    [selected],
  );

  const results = useMemo(() => {
    const already = new Set(selected);
    return searchDestinations(query).filter((entry) => !already.has(entry.id));
  }, [query, selected]);

  function add(destination: Destination) {
    onChange([...selected, destination.id]);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label="Search for a city or country"
        placeholder="Kyoto, Portugal, Mexico City…"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            add(results[0]);
          }
        }}
      />

      {results.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {results.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => add(destination)}
                className="press flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {flagEmoji(destination.countryCode)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{destination.label}</span>
                  {destination.kind === "city" && (
                    <span className="block truncate font-mono text-[10px] text-ink-faint">
                      {destination.countryName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                  {destination.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((id) => id !== destination.id))}
                aria-label={`Remove ${destination.label}`}
                className="press flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent-strong"
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
