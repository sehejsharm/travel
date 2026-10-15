"use client";

import type { TripLeg } from "@/lib/domain/types";
import { getCountry } from "@/lib/reference/countries";
import { formatDay } from "@/lib/rules/shared";
import { flagEmoji } from "@/lib/theme";
import { Field, RemoveButton, SecondaryButton, Select, TextInput } from "./form";

/**
 * Why a day from a date field cannot be used, or nothing when it can. A date
 * field gives "" until every part of it is filled in, and a year typed short
 * ("26" for 2026) arrives as 0026, which would sort before every real date.
 */
export function dayError(value: string): string | undefined {
  const match = /^(\d{4,})-\d{2}-\d{2}$/.exec(value);
  if (!match) return "Enter a full date";
  const year = Number(match[1]);
  if (year < 1900 || year > 2199) return "Check the year";
  return undefined;
}

export interface LegErrors {
  startDate?: string;
  endDate?: string;
}

/**
 * A leg has to fit inside the trip, and end on or after it starts: the checks
 * judge each country by its leg's own days, so a leg outside the trip puts
 * its weather and visa answers on days nobody is there.
 */
export function legErrors(leg: TripLeg, tripStart: string, tripEnd: string): LegErrors {
  const tripKnown = !dayError(tripStart) && !dayError(tripEnd) && tripStart <= tripEnd;
  const startProblem = dayError(leg.startDate);
  const errors: LegErrors = {};

  if (startProblem) errors.startDate = startProblem;
  else if (tripKnown && leg.startDate < tripStart) errors.startDate = `Before the trip starts (${formatDay(tripStart)})`;
  else if (tripKnown && leg.startDate > tripEnd) errors.startDate = `After the trip ends (${formatDay(tripEnd)})`;

  const endProblem = dayError(leg.endDate);
  if (endProblem) errors.endDate = endProblem;
  else if (!startProblem && leg.endDate < leg.startDate) errors.endDate = "Must be on or after you arrive";
  else if (tripKnown && leg.endDate > tripEnd) errors.endDate = `After the trip ends (${formatDay(tripEnd)})`;

  return errors;
}

/** Where each leg's date fields are, so a form can send the cursor to one. */
export function legInputId(idPrefix: string, legId: string, field: keyof LegErrors): string {
  return `${idPrefix}-leg-${legId}-${field}`;
}

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
  idPrefix,
  onChange,
}: {
  legs: TripLeg[];
  /** The destinations already picked, which is what a leg can be about. */
  countries: string[];
  tripStart: string;
  tripEnd: string;
  /** Unique on the page, so two open forms never share a field id. */
  idPrefix: string;
  onChange: (legs: TripLeg[]) => void;
}) {
  function update(id: string, patch: Partial<TripLeg>) {
    onChange(legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));
  }

  function add() {
    const last = legs[legs.length - 1];
    // Picks up where the last leg left off, as long as that is still inside the trip.
    const start =
      last && last.endDate >= tripStart && last.endDate <= tripEnd ? last.endDate : tripStart;
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
        const errors = legErrors(leg, tripStart, tripEnd);
        const startId = legInputId(idPrefix, leg.id, "startDate");
        const endId = legInputId(idPrefix, leg.id, "endDate");

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
              <Field label="Arrive" error={errors.startDate}>
                <TextInput
                  id={startId}
                  type="date"
                  value={leg.startDate}
                  min={tripStart || undefined}
                  max={tripEnd || undefined}
                  aria-invalid={errors.startDate ? true : undefined}
                  onChange={(event) => update(leg.id, { startDate: event.target.value })}
                />
              </Field>
              <Field label="Leave" error={errors.endDate}>
                <TextInput
                  id={endId}
                  type="date"
                  value={leg.endDate}
                  min={leg.startDate || tripStart || undefined}
                  max={tripEnd || undefined}
                  aria-invalid={errors.endDate ? true : undefined}
                  onChange={(event) => update(leg.id, { endDate: event.target.value })}
                />
              </Field>
            </div>
          </div>
        );
      })}

      <SecondaryButton type="button" onClick={add} className="self-start">
        + Add a leg
      </SecondaryButton>
    </div>
  );
}
