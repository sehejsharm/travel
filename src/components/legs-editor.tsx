"use client";

import type { TripLeg } from "@/lib/domain/types";
import { getCountry } from "@/lib/reference/countries";
import { flagEmoji } from "@/lib/theme";
import { Field, RemoveButton, SecondaryButton, Select, TextInput } from "./form";

/**
 * Splitting a multi-country trip into legs, each with its own dates. Without
 * this, "Japan + Thailand" is two tags on one date range, and every
 * date-dependent check — weather, holidays, packing — has to blend two
 * countries into one answer that fits neither.
 */
export function LegsEditor({
  legs,
  countries,
  tripStart,
  tripEnd,
  onChange,
}: {
  legs: TripLeg[];
  /** The destinations already picked, which is what a leg can be about. */
  countries: string[];
  tripStart: string;
  tripEnd: string;
  onChange: (legs: TripLeg[]) => void;
}) {
  function update(id: string, patch: Partial<TripLeg>) {
    onChange(legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));
  }

  function add() {
    const last = legs[legs.length - 1];
    const start = last?.endDate ?? tripStart;
    const unused = countries.find((code) => !legs.some((leg) => leg.countryCode === code));

    onChange([
      ...legs,
      {
        id: `leg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        countryCode: unused ?? countries[0] ?? "",
        startDate: start,
        endDate: tripEnd >= start ? tripEnd : start,
      },
    ]);
  }

  if (countries.length === 0) {
    return (
      <p className="text-footnote text-ink-soft">
        Pick your destinations first, then you can give each one its own dates.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote text-ink-soft">
        Give each country its own dates and the weather, holiday and packing checks run against
        the days you are actually there — not a blend of both.
      </p>

      {legs.map((leg, index) => {
        const country = getCountry(leg.countryCode);

        return (
          <div key={leg.id} className="rounded-card border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-footnote font-medium text-ink-soft tabular">
                Leg {index + 1}
              </span>
              <Select
                value={leg.countryCode}
                onChange={(event) => update(leg.id, { countryCode: event.target.value })}
                aria-label={`Country for leg ${index + 1}`}
                className="min-w-0 flex-1"
              >
                {countries.map((code) => (
                  <option key={code} value={code}>
                    {flagEmoji(code)} {getCountry(code)?.name ?? code}
                  </option>
                ))}
              </Select>
              <RemoveButton
                type="button"
                onClick={() => onChange(legs.filter((entry) => entry.id !== leg.id))}
                aria-label={`Remove leg ${index + 1}`}
                className="-mr-3 shrink-0"
              >
                Remove
              </RemoveButton>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Arrive">
                <TextInput
                  type="date"
                  value={leg.startDate}
                  onChange={(event) => update(leg.id, { startDate: event.target.value })}
                />
              </Field>
              <Field label="Leave">
                <TextInput
                  type="date"
                  value={leg.endDate}
                  min={leg.startDate}
                  onChange={(event) => update(leg.id, { endDate: event.target.value })}
                />
              </Field>
            </div>

            {country && leg.endDate < leg.startDate && (
              <p className="mt-2 text-caption text-critical">
                Leaving {country.name} before arriving there.
              </p>
            )}
          </div>
        );
      })}

      <SecondaryButton type="button" onClick={add} className="self-start">
        + Add a leg
      </SecondaryButton>
    </div>
  );
}
