"use client";

import { useId, useState } from "react";
import type { Trip, TripLeg, TripPurpose } from "@/lib/domain/types";
import { readCost } from "@/lib/item-form";
import { countriesOf } from "@/lib/reference/destinations";
import { COUNTRY_LIST, getCountry } from "@/lib/reference/countries";
import { detectHomeCountry } from "@/lib/reference/home-country";
import { CURRENCY_SYMBOLS } from "@/lib/reference/fx";
import { PURPOSES, getPurpose } from "@/lib/trip-purpose";
import { createTrip, updateTrip, type TravelerInput, type TripInput } from "@/lib/store/state";
import { flagEmoji } from "@/lib/theme";
import { Celebrate } from "./celebrate";
import { CoverPicker } from "./cover-picker";
import { DestinationPicker, unpickedDestination } from "./destination-picker";
import { Disclosure } from "./disclosure";
import { BorderlessButton, Field, PrimaryButton, Select, TextInput } from "./form";
import { InterestPicker } from "./interest-picker";
import { dayError, legErrors, legInputId, LegsEditor } from "./legs-editor";
import {
  expiryError,
  pendingNameError,
  travelerExpiryInputId,
  travelerNameInputId,
  TravelerQuickAdd,
} from "./traveler-quick-add";

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nights(start: string, end: string): number {
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

/** Focus by id once the render in progress has landed (and opened a section, if it had to). */
function focusSoon(id: string): void {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/** The optional sections a problem can be inside, which must open before it can be fixed. */
type Section = "travelers" | "legs" | "budget";

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
  // Typed but not yet added: kept here so neither is lost when its section
  // folds away, and so Create can point at them rather than drop them.
  const [destinationQuery, setDestinationQuery] = useState("");
  const [travelerName, setTravelerName] = useState("");
  const [attempted, setAttempted] = useState(false);
  // Held here so a problem inside one can open it; see Disclosure.
  const [open, setOpen] = useState<Record<Section, boolean>>(() => ({
    travelers: Boolean(getPurpose(trip?.purpose)?.expectsGroup),
    legs: false,
    budget: false,
  }));

  // Two forms can be open at once (the trip's own, and a new one in a sheet).
  const uid = useId();
  const ids = {
    destination: `${uid}-destination`,
    start: `${uid}-start`,
    end: `${uid}-end`,
    budget: `${uid}-budget`,
    currency: `${uid}-currency`,
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const openSection = (section: Section, value: boolean) =>
    setOpen((current) => ({ ...current, [section]: value }));

  const countries = countriesOf(draft.destinations);
  const codes = countries.map((country) => country.code);
  const home = getCountry(draft.homeCountry);
  const purpose = getPurpose(draft.purpose);

  /* ------------------------------------------------------- what is wrong */

  // Nothing to create yet: no name, no destination, and none being typed.
  const blank = !draft.name.trim() && countries.length === 0 && !destinationQuery.trim();

  const destinationPending = unpickedDestination(destinationQuery, draft.destinations);

  const startError = draft.datesTbd ? undefined : dayError(draft.startDate);
  const endError = draft.datesTbd
    ? undefined
    : (dayError(draft.endDate) ??
      (!startError && draft.endDate < draft.startDate ? "Must be on or after you leave" : undefined));

  // Travellers are only added here when the trip is new; an existing trip edits them on its own screen.
  const travelerNameError = trip
    ? undefined
    : (pendingNameError(draft.travelers, travelerName) ??
      (attempted && travelerName.trim() ? "Not added yet. Tap Add, or clear the name." : undefined));
  const expiryProblems = trip ? [] : draft.travelers.map(expiryError);
  const expiryIndex = expiryProblems.findIndex(Boolean);

  // Legs are only held to the trip while the section that edits them is on screen.
  const legsShown = countries.length > 1 && !draft.datesTbd;
  const legProblem = legsShown
    ? draft.legs
        .map((leg, index) => ({ leg, index, errors: legErrors(leg, draft.startDate, draft.endDate) }))
        .find(({ errors }) => errors.startDate || errors.endDate)
    : undefined;

  // The currency list is short; a home currency outside it is not offered as if it were chosen.
  const defaultCurrency = home && home.currency in CURRENCY_SYMBOLS ? home.currency : "";
  const budgetCurrency = draft.budgetCurrency || defaultCurrency;
  const budgetReading = readCost(draft.budgetAmount, budgetCurrency);
  const budgetAmountError =
    budgetReading.problem === "amount"
      ? "Not an amount"
      : budgetReading.amount !== undefined && budgetReading.amount <= 0
        ? "More than 0, or leave it empty"
        : undefined;
  const budgetCurrencyError =
    !budgetAmountError && budgetReading.problem === "currency" ? "Pick a currency" : undefined;
  const budget = budgetAmountError ? undefined : budgetReading.cost;
  const hasBudget = budget !== undefined;

  /** In the order they are on screen, so the cursor goes to the first one a person would meet. */
  const problems: { id: string; section?: Section }[] = [
    destinationPending && { id: ids.destination },
    startError && { id: ids.start },
    endError && { id: ids.end },
    !trip && travelerName.trim() && { id: travelerNameInputId(uid), section: "travelers" as const },
    expiryIndex >= 0 && { id: travelerExpiryInputId(uid, expiryIndex), section: "travelers" as const },
    legProblem && {
      id: legInputId(uid, legProblem.leg.id, legProblem.errors.startDate ? "startDate" : "endDate"),
      section: "legs" as const,
    },
    budgetAmountError && { id: ids.budget, section: "budget" as const },
    budgetCurrencyError && { id: ids.currency, section: "budget" as const },
  ].filter((problem): problem is { id: string; section?: Section } => Boolean(problem));

  // A destination taken off takes its legs with it: the editor could not show them, but they would still be saved.
  function setDestinations(destinations: string[]) {
    const kept = new Set(countriesOf(destinations).map((country) => country.code));
    setDraft((current) => ({
      ...current,
      destinations,
      legs: current.legs.filter((leg) => kept.has(leg.countryCode.toUpperCase())),
    }));
  }

  const resolvedName =
    draft.name.trim() || countries.map((country) => country.name).join(" & ") || "Untitled trip";
  const nightCount = draft.datesTbd || startError || endError ? 0 : nights(draft.startDate, draft.endDate);

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
    budget && `${budget.currency} ${budget.amount.toLocaleString()}`,
    purpose?.label,
    draft.interests.length > 0 && `${draft.interests.length} interests`,
  ]
    .filter(Boolean)
    .join(" · ");

  function submit(event?: React.MouseEvent<HTMLButtonElement>) {
    if (blank) return;

    const [first] = problems;
    if (first) {
      setAttempted(true);
      if (first.section) openSection(first.section, true);
      // After the render that shows the errors and opens the section the first one is in.
      focusSoon(first.id);
      return;
    }

    // Fired from where the button actually is, so the burst comes out of the
    // thing that was tapped rather than from the middle of the screen.
    if (event && !trip) {
      const box = event.currentTarget.getBoundingClientRect();
      setBurst({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    }

    // Without dates, the window is only provisional — but it still has to be one.
    const provisional =
      draft.datesTbd &&
      (dayError(draft.startDate) || dayError(draft.endDate) || draft.endDate < draft.startDate);

    const payload = {
      name: resolvedName,
      destinationCountries: codes,
      startDate: provisional ? inDays(30) : draft.startDate,
      endDate: provisional ? inDays(37) : draft.endDate,
      datesTbd: draft.datesTbd || undefined,
      homeCountry: draft.homeCountry.toUpperCase(),
      purpose: draft.purpose,
      legs: draft.legs.filter((leg) => leg.countryCode),
      interests: draft.interests,
      accentHue: draft.accentHue,
      budgetAmount: budget?.amount,
      budgetCurrency: budget?.currency,
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
        budgetTarget: budget,
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
          onChange={setDestinations}
          query={destinationQuery}
          onQueryChange={setDestinationQuery}
          inputId={ids.destination}
          unpicked={attempted}
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

      <div className="rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">When</p>
          {/* Full 44px button; the negative margins keep the header row slim. */}
          <BorderlessButton
            type="button"
            onClick={() => set("datesTbd", !draft.datesTbd)}
            className="-my-2 -mr-3"
          >
            {draft.datesTbd ? "I know the dates" : "No dates yet"}
          </BorderlessButton>
        </div>

        {draft.datesTbd ? (
          <p className="mt-2 text-footnote text-ink-soft">
            Fine — file ideas now and add dates later. Anything that depends on when you travel
            (visa lead times, weather, jet lag) stays quiet until you do.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Leaving" error={startError}>
              <TextInput
                id={ids.start}
                type="date"
                value={draft.startDate}
                aria-invalid={startError ? true : undefined}
                onChange={(event) => set("startDate", event.target.value)}
              />
            </Field>
            <Field label="Back" error={endError}>
              <TextInput
                id={ids.end}
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                aria-invalid={endError ? true : undefined}
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
            open={open.travelers}
            onOpenChange={(value) => openSection("travelers", value)}
            // Closed, it still says when something inside needs fixing.
            summary={
              !open.travelers && travelerName.trim()
                ? `Not added yet: ${travelerName.trim()}`
                : !open.travelers && expiryIndex >= 0
                  ? `${draft.travelers[expiryIndex].name}: ${expiryProblems[expiryIndex]}`
                  : draft.travelers.length > 0
                    ? draft.travelers.map((traveler) => traveler.name).join(", ")
                    : undefined
            }
          >
            <TravelerQuickAdd
              travelers={draft.travelers}
              homeCountry={draft.homeCountry}
              onChange={(travelers) => set("travelers", travelers)}
              pending={travelerName}
              onPendingChange={setTravelerName}
              pendingError={travelerNameError}
              idPrefix={uid}
            />
          </Disclosure>
        )}

        {legsShown && (
          <Disclosure
            label="Split it into legs"
            hint="Give each country its own dates"
            open={open.legs}
            onOpenChange={(value) => openSection("legs", value)}
            summary={
              !open.legs && legProblem
                ? `Leg ${legProblem.index + 1}: ${legProblem.errors.startDate ?? legProblem.errors.endDate}`
                : draft.legs.length > 0
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
              idPrefix={uid}
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
            <p className="mb-3 rounded-control bg-surface-2 px-3 py-2 text-footnote text-ink-soft">
              You picked {purpose.label}, so Discover stays quiet by default. Picking interests here
              turns it back on.
            </p>
          )}
          <InterestPicker
            selected={draft.interests}
            onChange={(interests) => set("interests", interests)}
            min={0}
          />
        </Disclosure>

        <Disclosure
          label="Rough budget"
          hint="Even an approximate number makes the money checks work"
          open={open.budget}
          onOpenChange={(value) => openSection("budget", value)}
          summary={
            !open.budget && (budgetAmountError || budgetCurrencyError)
              ? `Budget: ${budgetAmountError ?? budgetCurrencyError}`
              : budget
                ? `${budget.currency} ${budget.amount.toLocaleString()}`
                : undefined
          }
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Target" error={budgetAmountError}>
              <TextInput
                id={ids.budget}
                inputMode="decimal"
                value={draft.budgetAmount}
                placeholder="Optional"
                aria-invalid={budgetAmountError ? true : undefined}
                onChange={(event) => set("budgetAmount", event.target.value)}
              />
            </Field>
            <Field label="Currency" error={budgetCurrencyError}>
              <Select
                id={ids.currency}
                value={budgetCurrency}
                aria-invalid={budgetCurrencyError ? true : undefined}
                onChange={(event) => set("budgetCurrency", event.target.value)}
              >
                {/* Only when nothing on the list is the home currency, so the field never shows one it does not hold. */}
                {!budgetCurrency && (
                  <option value="" disabled>
                    Choose
                  </option>
                )}
                {/* A currency saved before it left the list stays shown as what it is. */}
                {[...new Set([...Object.keys(CURRENCY_SYMBOLS), budgetCurrency].filter(Boolean))].map(
                  (code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ),
                )}
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-footnote text-ink-soft">
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
        <p className="rounded-card border border-line bg-surface-2 px-4 py-3 text-footnote text-ink-soft">
          <span className="section-label">Creating</span>
          <br />
          {summary}
        </p>
      )}

      <PrimaryButton onClick={submit} disabled={blank}>
        {submitLabel}
      </PrimaryButton>

      <Celebrate at={burst} onDone={() => setBurst(undefined)} />

      {!trip && !wentDeep && (
        <p className="text-center text-caption text-ink-soft">
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
    <div className="flex flex-col gap-2">
      {/* Drawn like a Field label, so it reads as one of the form's questions. */}
      <span className="text-footnote font-medium text-ink-soft">What kind of trip?</span>

      {/* The vertical padding keeps each chip's 44px hit area and focus ring inside the scroller, which clips. */}
      <div className="no-scrollbar -mx-1 -my-2 flex gap-2 overflow-x-auto px-1 py-2">
        {PURPOSES.map((purpose) => {
          const active = value === purpose.id;
          return (
            <button
              key={purpose.id}
              type="button"
              onClick={() => onChange(active ? undefined : purpose.id)}
              aria-pressed={active}
              className={`press tap flex min-h-8 shrink-0 items-center gap-1 rounded-badge border px-3 text-footnote ${
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

      <p className="text-caption text-ink-soft">
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
            className="rounded-card border border-line bg-surface-2 px-4 py-3"
            style={{ "--i": index } as React.CSSProperties}
          >
            <p className="flex items-center gap-2 text-subheadline font-medium">
              <span aria-hidden="true">{flagEmoji(code)}</span>
              {country.name}
            </p>
            <p className="text-footnote text-ink-soft tabular">
              {facts.join(" · ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
