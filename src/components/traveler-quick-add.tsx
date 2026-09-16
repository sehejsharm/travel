"use client";

import { useState } from "react";
import { COUNTRY_LIST } from "@/lib/reference/countries";
import type { TravelerInput } from "@/lib/store/state";
import { flagEmoji } from "@/lib/theme";
import { Select, TextInput } from "./form";

/**
 * Names are enough, and always were. But the compliance checks need a passport
 * country and an expiry per person, and the previous route to those was a
 * separate screen reached after creation — which is how a traveller ends up
 * sitting at "INCOMPLETE". Offering the two fields inline, folded away until
 * asked for, removes every screen between typing a name and the checks having
 * what they need.
 */
export function TravelerQuickAdd({
  travelers,
  onChange,
}: {
  travelers: TravelerInput[];
  onChange: (travelers: TravelerInput[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<string>();

  function add() {
    const name = draft.trim();
    if (!name || travelers.some((traveler) => traveler.name === name)) return;
    onChange([...travelers, { name }]);
    setDraft("");
    // Open the new person straight away — they are the one you were thinking of.
    setExpanded(name);
  }

  function update(name: string, patch: Partial<TravelerInput>) {
    onChange(travelers.map((traveler) => (traveler.name === name ? { ...traveler, ...patch } : traveler)));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <TextInput
          value={draft}
          placeholder="Name"
          aria-label="Traveller name"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="press shrink-0 rounded-xl border border-line px-3.5 py-2 font-mono text-[11px] text-ink-soft disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {travelers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {travelers.map((traveler) => {
            const open = expanded === traveler.name;
            const hasDocs = Boolean(traveler.passportCountry && traveler.passportExpiry);

            return (
              <li key={traveler.name} className="rounded-xl border border-line bg-surface-2 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{traveler.name}</span>
                    <span className="block font-mono text-[10px] text-ink-faint">
                      {hasDocs
                        ? `${flagEmoji(traveler.passportCountry)} passport, expires ${traveler.passportExpiry}`
                        : "Passport details optional — the visa checks use them"}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? undefined : traveler.name)}
                    aria-expanded={open}
                    className="press shrink-0 rounded-lg border border-line px-2 py-1 font-mono text-[10px] text-ink-soft"
                  >
                    {open ? "done" : hasDocs ? "edit" : "+ passport"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChange(travelers.filter((entry) => entry.name !== traveler.name))
                    }
                    aria-label={`Remove ${traveler.name}`}
                    className="press shrink-0 font-mono text-[10px] text-ink-faint underline hover:text-critical"
                  >
                    remove
                  </button>
                </div>

                {open && (
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] uppercase tracking-wide text-ink-faint">
                        Passport country
                      </span>
                      <Select
                        value={traveler.passportCountry ?? ""}
                        onChange={(event) =>
                          update(traveler.name, { passportCountry: event.target.value })
                        }
                      >
                        <option value="">Not set</option>
                        {COUNTRY_LIST.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] uppercase tracking-wide text-ink-faint">
                        Expires
                      </span>
                      <TextInput
                        type="date"
                        value={traveler.passportExpiry ?? ""}
                        onChange={(event) =>
                          update(traveler.name, { passportExpiry: event.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {travelers.length > 1 && (
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Each person is checked against their own passport, so a group on different nationalities
          gets different visa answers for the same destination.
        </p>
      )}
    </div>
  );
}
