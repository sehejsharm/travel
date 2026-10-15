"use client";

import { useState } from "react";
import { COUNTRY_LIST, getCountry } from "@/lib/reference/countries";
import type { TravelerInput } from "@/lib/store/state";
import { flagEmoji } from "@/lib/theme";
import { Field, RemoveButton, SecondaryButton, Select, TextInput } from "./form";
import { dayError } from "./legs-editor";

function sameName(a: string, b: string): boolean {
  const fold = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
  return fold(a) === fold(b);
}

/**
 * Why the name being typed cannot be added. Blank is not a problem, only
 * nothing to add yet; a name already on the list would be a second row for
 * the same person, and the list tells people apart by name.
 */
export function pendingNameError(travelers: TravelerInput[], pending: string): string | undefined {
  const name = pending.trim();
  if (name && travelers.some((traveler) => sameName(traveler.name, name))) {
    return `${name} is already on the list`;
  }
  return undefined;
}

/** A passport expiry is optional; one that was typed has to be a whole date. */
export function expiryError(traveler: TravelerInput): string | undefined {
  return traveler.passportExpiry ? dayError(traveler.passportExpiry) : undefined;
}

export function travelerNameInputId(idPrefix: string): string {
  return `${idPrefix}-traveler-name`;
}

export function travelerExpiryInputId(idPrefix: string, index: number): string {
  return `${idPrefix}-traveler-${index}-expiry`;
}

function focusSoon(id: string): void {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

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
  homeCountry,
  onChange,
  pending,
  onPendingChange,
  pendingError,
  idPrefix,
}: {
  travelers: TravelerInput[];
  /** The trip's own origin, and the default everyone inherits. */
  homeCountry: string;
  onChange: (travelers: TravelerInput[]) => void;
  /**
   * The name being typed, held by the form: it outlives this section being
   * folded away, and the form can point at a name typed but never added.
   */
  pending: string;
  onPendingChange: (pending: string) => void;
  /** Set by the form, when it was submitted with a name still waiting here. */
  pendingError?: string;
  /** Unique on the page, so two open forms never share a field id. */
  idPrefix: string;
}) {
  const [expanded, setExpanded] = useState<string>();

  const nameId = travelerNameInputId(idPrefix);
  const nameError = pendingNameError(travelers, pending) ?? pendingError;

  function add() {
    const name = pending.trim();
    if (!name) return;
    if (pendingNameError(travelers, name)) {
      focusSoon(nameId);
      return;
    }
    onChange([...travelers, { name }]);
    onPendingChange("");
    // Open the new person straight away — they are the one you were thinking of.
    setExpanded(name);
  }

  function update(name: string, patch: Partial<TravelerInput>) {
    onChange(travelers.map((traveler) => (traveler.name === name ? { ...traveler, ...patch } : traveler)));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* gap-2, as in a Field, so the error sits as close as a field's own would. */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <TextInput
            id={nameId}
            value={pending}
            placeholder="Name"
            aria-label="Traveller name"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            onChange={(event) => onPendingChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <SecondaryButton
            type="button"
            onClick={add}
            disabled={!pending.trim()}
            className="shrink-0"
          >
            Add
          </SecondaryButton>
        </div>
        {nameError && (
          <p id={`${nameId}-error`} className="text-caption text-critical">
            {nameError}
          </p>
        )}
      </div>

      {travelers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {travelers.map((traveler, index) => {
            const expiryProblem = expiryError(traveler);
            const expiryId = travelerExpiryInputId(idPrefix, index);
            // A row with something wrong in it stays open, so the problem is never folded away.
            const open = expanded === traveler.name || Boolean(expiryProblem);
            const hasDocs = Boolean(traveler.passportCountry && traveler.passportExpiry && !expiryProblem);
            const origin = traveler.originCountry ?? homeCountry;
            const flyingElsewhere = origin.toUpperCase() !== homeCountry.toUpperCase();

            return (
              <li key={traveler.name} className="rounded-card border border-line bg-surface-2 p-3">
                {/* The two actions are drawn small so the name keeps its room on a
                    phone; .tap gives each a 44px hit area, and gap-2 keeps them apart. */}
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-subheadline">{traveler.name}</span>
                    <span className="block text-footnote text-ink-soft">
                      {[
                        hasDocs
                          ? `${flagEmoji(traveler.passportCountry)} passport, expires ${traveler.passportExpiry}`
                          : "Passport details optional — the visa checks use them",
                        flyingElsewhere ? `flying from ${getCountry(origin)?.name ?? origin}` : "",
                        traveler.needsVisaHelp ? "wants visa help" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      // Done cannot fold away a date that needs fixing; it goes to it instead.
                      if (open && expiryProblem) {
                        focusSoon(expiryId);
                        return;
                      }
                      setExpanded(open ? undefined : traveler.name);
                    }}
                    aria-expanded={open}
                    className="press tap flex min-h-8 shrink-0 items-center rounded-button-sm bg-accent-soft px-3 text-footnote font-medium text-accent-strong"
                  >
                    {open ? "Done" : hasDocs ? "Edit" : "+ Passport"}
                  </button>

                  <RemoveButton
                    type="button"
                    onClick={() =>
                      onChange(travelers.filter((entry) => entry.name !== traveler.name))
                    }
                    aria-label={`Remove ${traveler.name}`}
                    className="-mr-3 shrink-0"
                  >
                    Remove
                  </RemoveButton>
                </div>

                {open && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Passport country">
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
                    </Field>

                    <Field label="Expires" error={expiryProblem}>
                      <TextInput
                        id={expiryId}
                        type="date"
                        value={traveler.passportExpiry ?? ""}
                        aria-invalid={expiryProblem ? true : undefined}
                        onChange={(event) =>
                          update(traveler.name, { passportExpiry: event.target.value })
                        }
                      />
                    </Field>

                    {/* Nationality and origin are different questions. Asked
                        only once there is a second person, because with one
                        traveller the trip's own origin already is the answer. */}
                    {travelers.length > 1 && (
                      <div className="sm:col-span-2">
                        <Field
                          label="Flying from"
                          hint="Sets their plugs, voltage, jet lag and the customs allowance they come home to. The passport above still decides the visa."
                        >
                          <Select
                            aria-label={`Flying from, for ${traveler.name}`}
                            value={traveler.originCountry ?? ""}
                            onChange={(event) =>
                              update(traveler.name, { originCountry: event.target.value || undefined })
                            }
                          >
                            <option value="">
                              Same as the trip ({getCountry(homeCountry)?.name ?? homeCountry})
                            </option>
                            {COUNTRY_LIST.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    )}

                    <label className="flex min-h-11 items-start gap-3 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={Boolean(traveler.needsVisaHelp)}
                        onChange={(event) =>
                          update(traveler.name, { needsVisaHelp: event.target.checked })
                        }
                        className="press mt-1 size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="text-subheadline">
                        Needs a hand with the visa
                        <span className="block text-caption text-ink-soft">
                          Spells out the paperwork, in order, for every destination that needs it.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {travelers.length > 1 && (
        <p className="text-footnote text-ink-soft">
          Each person is checked against their own passport, so a group on different nationalities
          gets different visa answers for the same destination.
        </p>
      )}
    </div>
  );
}
