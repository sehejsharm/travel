"use client";

import { useState } from "react";
import type { Trip, TripLeg, TripPurpose } from "@/lib/domain/types";
import { countriesOf } from "@/lib/reference/destinations";
import { COUNTRY_LIST, getCountry } from "@/lib/reference/countries";
import { detectHomeCountry } from "@/lib/reference/home-country";
import { CURRENCY_SYMBOLS } from "@/lib/reference/fx";
import { PURPOSES, getPurpose } from "@/lib/trip-purpose";
import { createTrip, updateTrip, type TravelerInput, type TripInput } from "@/lib/store/state";
import { flagEmoji } from "@/lib/theme";
import { Celebrate } from "./celebrate";
import { CoverPicker } from "./cover-picker";
import { DestinationPicker } from "./destination-picker";
import { Disclosure } from "./disclosure";
import { Field, PrimaryButton, Select, TextInput } from "./form";
import { InterestPicker } from "./interest-picker";
import { LegsEditor } from "./legs-editor";
import { TravelerQuickAdd } from "./traveler-quick-add";

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nights(start: string, end: string): number {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000));
}

interface Draft {
  name: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  datesTbd: boolean;
  homeCountry: string;
  travelers: TravelerInput[];
  purpose?: TripPurpose;
  interests: string[];
  legs: TripLeg[];
  budgetAmount: string;
  budgetCurrency: string;
  accentHue?: number;
}

function initial(trip?: Trip): Draft {
  return {
    name: trip?.name ?? "",
    destinations: trip?.destinationCountries ?? [],
    startDate: trip?.startDate ?? inDays(30),
    endDate: trip?.endDate ?? inDays(37),
    datesTbd: trip?.datesTbd ?? false,
    // Guessed from the browser's own locale rather than hardcoded. It is still
    // a default: the field is right there, and what it drives is on screen.
    homeCountry: trip?.homeCountry ?? detectHomeCountry(),
    travelers: trip?.travelers.map((traveler) => ({ name: traveler.name })) ?? [],
    purpose: trip?.purpose,
    interests: trip?.interests ?? [],
    legs: trip?.legs ?? [],
    budgetAmount: trip?.budgetTarget ? String(trip.budgetTarget.amount) : "",
    budgetCurrency: trip?.budgetTarget?.currency ?? "",
    accentHue: trip?.accentHue,
  };
}

/**
 * Where, when, who — and nothing else is required. Every other question lives
 * behind a collapsed row, so someone in a hurry types a destination, accepts
 * the dates and taps Create, while someone planning properly can do the whole
 * thing without leaving the screen.
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
  const [burst, setBurst] = useState<{ x: number; y: number }>();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const countries = countriesOf(draft.destinations);
  const codes = countries.map((country) => country.code);
  const home = getCountry(draft.homeCountry);
  const purpose = getPurpose(draft.purpose);
  const datesValid = draft.datesTbd || draft.endDate >= draft.startDate;
  const valid = (draft.name.trim().length > 0 || countries.length > 0) && datesValid;

  const resolvedName =
    draft.name.trim() || countries.map((country) => country.name).join(" & ") || "Untitled trip";
  const nightCount = draft.datesTbd ? 0 : nights(draft.startDate, draft.endDate);
  const budget = Number(draft.budgetAmount);
  const hasBudget = draft.budgetAmount !== "" && Number.isFinite(budget) && budget > 0;

  // Only worth showing once someone has actually gone past the fast path.
  const wentDeep =
    Boolean(draft.purpose) ||
    draft.interests.length > 0 ||
    draft.legs.length > 0 ||
    draft.travelers.length > 0 ||
    hasBudget ||
    draft.accentHue !== undefined;

  const summary = [
    countries.map((country) => country.name).join(" & ") || resolvedName,
    draft.datesTbd ? "no dates yet" : `${nightCount} nights`,
    draft.legs.length > 0 && `${draft.legs.length} legs`,
    draft.travelers.length > 0 &&
      `${draft.travelers.length} traveller${draft.travelers.length === 1 ? "" : "s"}`,
    hasBudget && `${draft.budgetCurrency || home?.currency || ""} ${budget.toLocaleString()}`.trim(),
    purpose?.label,
    draft.interests.length > 0 && `${draft.interests.length} interests`,
  ]
    .filter(Boolean)
    .join(" · ");

  function submit(event?: React.MouseEvent<HTMLButtonElement>) {
    if (!valid) return;

    // Fired from where the button actually is, so the burst comes out of the
    // thing that was tapped rather than from the middle of the screen.
    if (event && !trip) {
      const box = event.currentTarget.getBoundingClientRect();
      setBurst({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    }

    const payload = {
      name: resolvedName,
      destinationCountries: codes,
      startDate: draft.startDate,
      endDate: draft.endDate,
      datesTbd: draft.datesTbd || undefined,
      homeCountry: draft.homeCountry.toUpperCase(),
      purpose: draft.purpose,
      legs: draft.legs.filter((leg) => leg.countryCode),
      interests: draft.interests,
      accentHue: draft.accentHue,
      budgetAmount: hasBudget ? budget : undefined,
      budgetCurrency: hasBudget ? draft.budgetCurrency || home?.currency : undefined,
    };

    if (trip) {
      updateTrip(trip.id, {
        name: payload.name,
        destinationCountries: codes,
        startDate: payload.startDate,
        endDate: payload.endDate,
        datesTbd: payload.datesTbd,
        homeCountry: payload.homeCountry,
        purpose: payload.purpose,
        legs: payload.legs.length ? payload.legs : undefined,
        interests: payload.interests.length ? payload.interests : undefined,
        accentHue: payload.accentHue,
        budgetTarget:
          hasBudget && payload.budgetCurrency
            ? { amount: budget, currency: payload.budgetCurrency }
            : undefined,
      });
      onDone(trip.id);
      return;
    }

    onDone(createTrip({ ...payload, travelers: draft.travelers } satisfies TripInput));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------- the fast path */}
      <Field label="Where are you going?">
        <DestinationPicker
          selected={draft.destinations}
          onChange={(destinations) => set("destinations", destinations)}
          autoFocus={!trip}
        />
      </Field>

      {countries.length > 0 && <OnTheGround codes={codes} homeCode={draft.homeCountry} />}


      <Field
        label="Call it"
        hint={countries.length > 0 ? "Left blank, it takes the destination's name." : undefined}
      >
        <TextInput
          value={draft.name}
          placeholder={countries.map((country) => country.name).join(" & ") || "Japan, autumn"}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>

      <PurposeChips value={draft.purpose} onChange={(value) => set("purpose", value)} />

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

      {/* ------------------------------------------ everything optional */}
      <div className="flex flex-col gap-2">
        {!trip && (
          <Disclosure
            label="Who is going?"
            hint="Names only, or add passports now for the visa checks"
            summary={
              draft.travelers.length > 0
                ? draft.travelers.map((traveler) => traveler.name).join(", ")
                : undefined
            }
            defaultOpen={purpose?.expectsGroup}
          >
            <TravelerQuickAdd
              travelers={draft.travelers}
              onChange={(travelers) => set("travelers", travelers)}
            />
          </Disclosure>
        )}

        {countries.length > 1 && !draft.datesTbd && (
          <Disclosure
            label="Split it into legs"
            hint="Give each country its own dates"
            summary={
              draft.legs.length > 0
                ? draft.legs
                    .map((leg) => `${flagEmoji(leg.countryCode)} ${leg.startDate.slice(5)}–${leg.endDate.slice(5)}`)
                    .join("  ")
                : undefined
            }
          >
            <LegsEditor
              legs={draft.legs}
              countries={codes}
              tripStart={draft.startDate}
              tripEnd={draft.endDate}
              onChange={(legs) => set("legs", legs)}
            />
          </Disclosure>
        )}

        <Disclosure
          label="Personalize suggestions"
          hint="Pick what you are into, for Discover"
          summary={draft.interests.length > 0 ? `${draft.interests.length} picked` : undefined}
        >
          {purpose?.suppressSuggestions && (
            <p className="mb-2.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-ink-soft">
              You picked {purpose.label}, so Discover stays quiet by default. Picking interests here
              turns it back on.
            </p>
          )}
          <InterestPicker
            selected={draft.interests}
            onChange={(interests) => set("interests", interests)}
          />
        </Disclosure>

        <Disclosure
          label="Rough budget"
          hint="Even an approximate number makes the money checks work"
          summary={hasBudget ? `${draft.budgetCurrency || home?.currency} ${budget.toLocaleString()}` : undefined}
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Target">
              <TextInput
                inputMode="decimal"
                value={draft.budgetAmount}
                placeholder="Optional"
                onChange={(event) => set("budgetAmount", event.target.value)}
              />
            </Field>
            <Field label="Currency">
              <Select
                value={draft.budgetCurrency || home?.currency || ""}
                onChange={(event) => set("budgetCurrency", event.target.value)}
              >
                {Object.keys(CURRENCY_SYMBOLS).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Without a target the budget card can only show what you have spent. With one, the very
            first check run can tell you whether you are over it.
          </p>
        </Disclosure>

        <Disclosure
          label="Cover"
          hint="How this trip looks on the trip screen"
          summary={draft.accentHue === undefined ? undefined : "custom colour"}
        >
          <CoverPicker
            name={resolvedName}
            seed={codes.join("") || resolvedName}
            dates={draft.datesTbd ? "No dates yet" : `${draft.startDate} – ${draft.endDate}`}
            countries={codes}
            accentHue={draft.accentHue}
            onChange={(hue) => set("accentHue", hue)}
          />
        </Disclosure>
      </div>

      <Field
        label="Flying from"
        hint={
          home
            ? `Sets the plug, voltage, duty-free and jet lag checks against ${home.name}. Visas check per traveller's own passport.`
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

      {/* A last look, only for someone who actually went past the fast path. */}
      {wentDeep && !trip && (
        <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Creating
          </span>
          <br />
          {summary}
        </p>
      )}

      <PrimaryButton onClick={submit} disabled={!valid}>
        {submitLabel}
      </PrimaryButton>

      <Celebrate at={burst} onDone={() => setBurst(undefined)} />

      {!trip && !wentDeep && (
        <p className="text-center font-mono text-[10px] text-ink-faint">
          Everything above the button is optional — a destination is enough to start.
        </p>
      )}
    </div>
  );
}

/** Purpose sits right under the name, as one tap that changes the defaults. */
function PurposeChips({
  value,
  onChange,
}: {
  value?: TripPurpose;
  onChange: (value?: TripPurpose) => void;
}) {
  const chosen = getPurpose(value);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        What kind of trip?
      </span>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PURPOSES.map((purpose) => {
          const active = value === purpose.id;
          return (
            <button
              key={purpose.id}
              type="button"
              onClick={() => onChange(active ? undefined : purpose.id)}
              aria-pressed={active}
              className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              <span aria-hidden="true">{purpose.emoji}</span> {purpose.label}
            </button>
          );
        })}
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
        {chosen ? chosen.effect : "Optional — it only changes what gets pre-filled."}
      </p>
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
    <ul key={codes.join()} className="stagger flex flex-col gap-2">
      {codes.map((code, index) => {
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
            // The "it just knew that" beat: each country's facts slide in.
            className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
            style={{ "--i": index } as React.CSSProperties}
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
