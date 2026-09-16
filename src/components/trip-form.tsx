"use client";

import { useState } from "react";
import type { Trip } from "@/lib/domain/types";
import { countriesOf } from "@/lib/reference/destinations";
import { COUNTRY_LIST, getCountry } from "@/lib/reference/countries";
import { createTrip, updateTrip, type TripInput } from "@/lib/store/state";
import { flagEmoji } from "@/lib/theme";
import { DestinationPicker } from "./destination-picker";
import { Field, PrimaryButton, Select, TextInput } from "./form";

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

interface Draft {
  name: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  datesTbd: boolean;
  homeCountry: string;
  travelerNames: string[];
}

function initial(trip?: Trip): Draft {
  return {
    name: trip?.name ?? "",
    destinations: trip?.destinationCountries ?? [],
    startDate: trip?.startDate ?? inDays(30),
    endDate: trip?.endDate ?? inDays(37),
    datesTbd: trip?.datesTbd ?? false,
    homeCountry: trip?.homeCountry ?? "IN",
    travelerNames: trip?.travelers.map((traveler) => traveler.name) ?? [],
  };
}

/**
 * Everything a trip needs to exist, on one screen: where, when, who. Budget,
 * interests and passport details are asked for later by the things that
 * actually need them, so nothing blocks getting started.
 */
export function TripForm({
  trip,
  onDone,
  submitLabel = "Save trip",
}: {
  trip?: Trip;
  onDone: (tripId: string) => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => initial(trip));
  const [traveler, setTraveler] = useState("");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const countries = countriesOf(draft.destinations);
  const home = getCountry(draft.homeCountry);
  const datesValid = draft.datesTbd || draft.endDate >= draft.startDate;
  // A destination alone is enough to name the trip, so only dates can block it.
  const valid = (draft.name.trim().length > 0 || countries.length > 0) && datesValid;

  function addTraveler() {
    const name = traveler.trim();
    if (!name || draft.travelerNames.includes(name)) return;
    set("travelerNames", [...draft.travelerNames, name]);
    setTraveler("");
  }

  function submit() {
    if (!valid) return;

    const name =
      draft.name.trim() || countries.map((country) => country.name).join(" & ") || "Untitled trip";
    const destinationCountries = countries.map((country) => country.code);

    if (trip) {
      updateTrip(trip.id, {
        name,
        destinationCountries,
        startDate: draft.startDate,
        endDate: draft.endDate,
        datesTbd: draft.datesTbd || undefined,
        homeCountry: draft.homeCountry.toUpperCase(),
      });
      onDone(trip.id);
      return;
    }

    onDone(
      createTrip({
        name,
        destinationCountries,
        startDate: draft.startDate,
        endDate: draft.endDate,
        datesTbd: draft.datesTbd || undefined,
        homeCountry: draft.homeCountry,
        travelerNames: draft.travelerNames,
      } satisfies TripInput),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Where are you going?">
        <DestinationPicker
          selected={draft.destinations}
          onChange={(destinations) => set("destinations", destinations)}
          autoFocus={!trip}
        />
      </Field>

      {countries.length > 0 && <OnTheGround codes={countries.map((country) => country.code)} homeCode={draft.homeCountry} />}

      <Field label="Call it" hint={countries.length > 0 ? "Left blank, it takes the destination's name." : undefined}>
        <TextInput
          value={draft.name}
          placeholder={countries.map((country) => country.name).join(" & ") || "Japan, autumn"}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>

      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">When</p>
          <button
            type="button"
            onClick={() => set("datesTbd", !draft.datesTbd)}
            className="press font-mono text-[10px] text-accent-strong underline"
          >
            {draft.datesTbd ? "I know the dates" : "No dates yet"}
          </button>
        </div>

        {draft.datesTbd ? (
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Fine — file ideas now and add dates later. Anything that depends on when you travel
            (visa lead times, weather, jet lag) stays quiet until you do.
          </p>
        ) : (
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <Field label="Leaving">
              <TextInput
                type="date"
                value={draft.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
            </Field>
            <Field label="Back" hint={datesValid ? undefined : "Must be on or after you leave"}>
              <TextInput
                type="date"
                value={draft.endDate}
                min={draft.startDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      {!trip && (
        <Field label="Who is going?" hint="Names only. Passport details come later, from the checks that need them.">
          <div className="flex gap-2">
            <TextInput
              value={traveler}
              placeholder="Optional"
              onChange={(event) => setTraveler(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTraveler();
                }
              }}
            />
            <button
              type="button"
              onClick={addTraveler}
              disabled={!traveler.trim()}
              className="press shrink-0 rounded-xl border border-line px-3.5 py-2 font-mono text-[11px] text-ink-soft disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {draft.travelerNames.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {draft.travelerNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() =>
                      set("travelerNames", draft.travelerNames.filter((entry) => entry !== name))
                    }
                    aria-label={`Remove ${name}`}
                    className="press flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs"
                  >
                    {name}
                    <span aria-hidden="true" className="text-ink-faint">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      )}

      <Field
        label="Flying from"
        hint={
          home
            ? `Sets the visa, plug, currency and jet lag checks against ${home.name}.`
            : undefined
        }
      >
        <Select
          value={draft.homeCountry}
          onChange={(event) => set("homeCountry", event.target.value)}
        >
          {COUNTRY_LIST.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
      </Field>

      <PrimaryButton onClick={submit} disabled={!valid}>
        {submitLabel}
      </PrimaryButton>

      {!trip && (
        <p className="text-center font-mono text-[10px] text-ink-faint">
          Budget and interests can wait — the trip will ask when it needs them.
        </p>
      )}
    </div>
  );
}

/**
 * The payoff for picking a destination, shown immediately rather than buried
 * under More: what the money, the sockets and the clock look like there.
 */
function OnTheGround({ codes, homeCode }: { codes: string[]; homeCode: string }) {
  const home = getCountry(homeCode);

  return (
    <ul className="flex flex-col gap-2">
      {codes.map((code) => {
        const country = getCountry(code);
        if (!country) return null;

        const shift = home ? country.utcOffset - home.utcOffset : 0;
        const facts = [
          country.currency,
          `Type ${country.plugTypes.join("/")} · ${country.voltage}V`,
          shift === 0 ? "same clock as home" : `${shift > 0 ? "+" : ""}${shift}h from home`,
          `emergency ${country.emergency}`,
        ];

        return (
          <li
            key={code}
            className="animate-rise rounded-xl border border-line bg-surface-2 px-3 py-2.5"
          >
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <span aria-hidden="true">{flagEmoji(code)}</span>
              {country.name}
            </p>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-faint">
              {facts.join(" · ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
