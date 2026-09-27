"use client";

import { useState, type ReactNode } from "react";
import { clearManual, editManual, useAddDraft } from "@/lib/add-draft";
import { findDuplicates, mergeInto, type DuplicateMatch } from "@/lib/dedupe";
import { SOURCE_LABELS, type PlaceRef, type Trip, type TripItem } from "@/lib/domain/types";
import type { ItemDraft } from "@/lib/extract/types";
import { fileDraft } from "@/lib/filing";
import { offsetForCountry } from "@/lib/item-form";
import {
  buildManualDraft,
  defaultCostStatus,
  isBlank,
  isTransport,
  MANUAL_KINDS,
  MANUAL_META,
  resolvePlace,
  TRANSIT_KINDS,
  type ManualErrorKey,
  type ManualKind,
  type ManualValues,
  type TransitKind,
} from "@/lib/manual-entry";
import { suggestAirports, suggestPlaces } from "@/lib/reference/places";
import { updateItem } from "@/lib/store/state";
import { Disclosure } from "./disclosure";
import { DraftHeading, DuplicateChoice, FiledNotice, StartsTripNote } from "./filing";
import { Field, GhostButton, PrimaryButton, Segmented, TextInput } from "./form";
import {
  ConfirmationField,
  CostFields,
  FieldGroup,
  NotesField,
  PlaceField,
  RefundField,
  TravellerField,
  WhenFields,
} from "./item-fields";
import { Card, Chip } from "./ui";

type Section = "cost" | "confirmation" | "traveller" | "refund" | "notes";

interface KindCopy {
  heading: string;
  name?: { label: string; placeholder: string };
  place?: { label: string; placeholder: string };
  when: { label: string; start: string; end: string };
  /** Shown up front, after the name, place and times. */
  primary: Section[];
  /** Tucked under "More details", so the fast path stays short. */
  more: Section[];
}

const COPY: Record<ManualKind, KindCopy> = {
  flight: {
    heading: "New flight",
    when: { label: "When", start: "Departs", end: "Arrives" },
    primary: ["confirmation", "notes"],
    more: ["cost", "traveller", "refund"],
  },
  transit: {
    heading: "New transit",
    when: { label: "When", start: "Departs", end: "Arrives" },
    primary: ["confirmation", "notes"],
    more: ["cost", "traveller", "refund"],
  },
  lodging: {
    heading: "New stay",
    name: { label: "Hotel or property", placeholder: "Hotel Gracery Shinjuku" },
    place: { label: "Address or area", placeholder: "Kabukicho, Shinjuku, Tokyo" },
    when: { label: "Stay", start: "Check-in", end: "Check-out" },
    primary: ["confirmation"],
    more: ["cost", "traveller", "refund", "notes"],
  },
  activity: {
    heading: "New activity",
    name: { label: "Name", placeholder: "Tea ceremony in Gion" },
    place: { label: "Where", placeholder: "Senso-ji, Shibuya Sky, Kyoto…" },
    when: { label: "When", start: "Starts", end: "Ends" },
    primary: ["cost", "notes"],
    more: ["confirmation", "traveller", "refund"],
  },
};

const TRANSIT_COPY: Record<
  TransitKind,
  { operator: string; from: string; to: string; start: string; end: string }
> = {
  rail: { operator: "JR Nozomi 225", from: "From", to: "To", start: "Departs", end: "Arrives" },
  car: {
    operator: "Toyota Rent a Car",
    from: "Pick-up point",
    to: "Drop-off point",
    start: "Pick-up",
    end: "Drop-off",
  },
  other: { operator: "Ferry, coach, transfer…", from: "From", to: "To", start: "Departs", end: "Arrives" },
};

const SECTION_LABELS: Record<Section, string> = {
  cost: "Cost",
  confirmation: "Confirmation",
  traveller: "Traveller",
  refund: "Free cancellation",
  notes: "Notes",
};

/** Where each problem is shown, and so where the cursor goes to fix it. */
const ERROR_ORDER: ManualErrorKey[] = ["title", "startsAt", "endsAt", "costAmount", "costCurrency"];

function fieldId(key: ManualErrorKey, kind: ManualKind): string {
  if (key !== "title") return `manual-${key}`;
  if (kind === "flight") return "manual-flightNumber";
  return kind === "transit" ? "manual-provider" : "manual-name";
}

// How a flight's ends and other typed places are looked up while typing.
const resolveAirport = (text: string) => resolvePlace(text, true);
const isAirport = (place: PlaceRef) => Boolean(place.airport);
const suggestWhenTyped = (text: string) => (text.trim() ? suggestPlaces(text) : []);

function filled(values: ManualValues, section: Section): boolean {
  switch (section) {
    case "cost":
      return values.costAmount.trim() !== "";
    case "confirmation":
      return values.confirmationCode.trim() !== "";
    case "traveller":
      return values.travelerName.trim() !== "";
    case "refund":
      return values.refundableUntil !== "";
    case "notes":
      return values.notes.trim() !== "";
  }
}

/**
 * Typing an item in, for a booking with no email to paste or anything easier
 * entered by hand. Built from the editor's own fields and filed through the
 * same path as something read, so the item that lands is indistinguishable
 * from an extracted one. Unfinished input is kept while you look elsewhere.
 */
export function ManualAddTripItem({ trip, items }: { trip?: Trip; items: TripItem[] }) {
  const values = useAddDraft().manual;
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState<{ draft: ItemDraft; matches: DuplicateMatch[] } | null>(
    null,
  );
  const [filedLabel, setFiledLabel] = useState<string | null>(null);

  const { kind } = values;
  const copy = COPY[kind];
  const transit = TRANSIT_COPY[values.transitKind];
  const transport = isTransport(kind);
  const errors = attempted ? buildManualDraft(values).errors : {};
  const blank = isBlank(values);

  // A flight's two ends can be on different clocks, so its arrival is not held to its departure's.
  const from = transport ? resolvePlace(values.from, kind === "flight") : undefined;
  const to = transport ? resolvePlace(values.to, kind === "flight") : undefined;
  const sameZone =
    !transport || offsetForCountry(from?.countryCode) === offsetForCountry((to ?? from)?.countryCode);

  function set(patch: Partial<ManualValues>) {
    editManual(patch);
    setPending(null);
    setFiledLabel(null);
    // A different kind of item has not been tried yet, so it is not told off yet.
    if (patch.kind && patch.kind !== kind) setAttempted(false);
  }

  function submit() {
    const result = buildManualDraft(values);

    if (!result.draft) {
      setAttempted(true);
      const first = ERROR_ORDER.find((key) => result.errors[key]);
      // After the render that shows the errors, and opens "More details" if one is in there.
      if (first) requestAnimationFrame(() => document.getElementById(fieldId(first, kind))?.focus());
      return;
    }

    // Typing in a booking that was already read from its email is the usual repeat.
    if (trip) {
      const matches = findDuplicates(result.draft, items);
      if (matches.length > 0) {
        setPending({ draft: result.draft, matches });
        return;
      }
    }

    file(result.draft);
  }

  function file(draft: ItemDraft) {
    fileDraft(trip, draft, MANUAL_META);
    done(draft.title);
  }

  function merge(into: TripItem) {
    if (!pending) return;
    updateItem(into.id, mergeInto(into, pending.draft));
    done(`${into.title} (merged)`);
  }

  function done(label: string) {
    clearManual();
    setAttempted(false);
    setPending(null);
    setFiledLabel(label);
  }

  function clear() {
    clearManual();
    setAttempted(false);
    setPending(null);
    setFiledLabel(null);
  }

  const moreErrors = copy.more.includes("cost") && Boolean(errors.costAmount || errors.costCurrency);
  const moreFilled = copy.more.filter((section) => filled(values, section));

  function section(name: Section): ReactNode {
    switch (name) {
      case "cost":
        return (
          <CostFields
            key={name}
            idPrefix="manual"
            amount={values.costAmount}
            currency={values.costCurrency}
            status={values.costStatus || defaultCostStatus(kind)}
            onAmount={(value) => set({ costAmount: value })}
            onCurrency={(value) => set({ costCurrency: value })}
            onStatus={(value) => set({ costStatus: value })}
            amountError={errors.costAmount}
            currencyError={errors.costCurrency}
          />
        );
      case "confirmation":
        return (
          <ConfirmationField
            key={name}
            id="manual-confirmationCode"
            value={values.confirmationCode}
            onChange={(value) => set({ confirmationCode: value })}
          />
        );
      case "traveller":
        return (
          <TravellerField
            key={name}
            id="manual-travelerName"
            value={values.travelerName}
            travelers={trip?.travelers ?? []}
            onChange={(value) => set({ travelerName: value })}
          />
        );
      case "refund":
        return (
          <RefundField
            key={name}
            id="manual-refundableUntil"
            value={values.refundableUntil}
            onChange={(value) => set({ refundableUntil: value })}
          />
        );
      case "notes":
        return (
          <NotesField
            key={name}
            id="manual-notes"
            value={values.notes}
            onChange={(value) => set({ notes: value })}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-5">
        <DraftHeading title={copy.heading} chip={<Chip>{SOURCE_LABELS.manual}</Chip>} />

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Type" group>
            <Segmented
              label="Type"
              value={kind}
              options={MANUAL_KINDS}
              onChange={(value) => set({ kind: value })}
            />
          </Field>

          {kind === "transit" && (
            <Field label="Travelling by" group>
              <Segmented
                label="Travelling by"
                value={values.transitKind}
                options={TRANSIT_KINDS}
                onChange={(value) => set({ transitKind: value })}
              />
            </Field>
          )}

          {kind === "flight" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flight number" error={errors.title}>
                <TextInput
                  id="manual-flightNumber"
                  value={values.flightNumber}
                  placeholder="AI 142"
                  autoComplete="off"
                  aria-invalid={errors.title ? true : undefined}
                  onChange={(event) => set({ flightNumber: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Airline">
                <TextInput
                  id="manual-provider"
                  value={values.provider}
                  placeholder="Air India"
                  onChange={(event) => set({ provider: event.target.value })}
                />
              </Field>
            </div>
          )}

          {kind === "transit" && (
            <Field label="Operator" error={errors.title}>
              <TextInput
                id="manual-provider"
                value={values.provider}
                placeholder={transit.operator}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => set({ provider: event.target.value })}
              />
            </Field>
          )}

          {copy.name && (
            <Field label={copy.name.label} error={errors.title}>
              <TextInput
                id="manual-name"
                value={values.name}
                placeholder={copy.name.placeholder}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
          )}

          {transport && (
            <FieldGroup label="Route">
              <div className="grid gap-3 sm:grid-cols-2">
                <PlaceField
                  id="manual-from"
                  label={kind === "flight" ? "From" : transit.from}
                  value={values.from}
                  onChange={(value) => set({ from: value })}
                  placeholder={kind === "flight" ? "DEL or Delhi" : "Tokyo"}
                  {...(kind === "flight"
                    ? { resolve: resolveAirport, suggest: suggestAirports, pinned: isAirport }
                    : { resolve: resolvePlace, suggest: suggestWhenTyped })}
                  map={false}
                />
                <PlaceField
                  id="manual-to"
                  label={kind === "flight" ? "To" : transit.to}
                  value={values.to}
                  onChange={(value) => set({ to: value })}
                  placeholder={kind === "flight" ? "HND or Tokyo Haneda" : "Kyoto"}
                  {...(kind === "flight"
                    ? { resolve: resolveAirport, suggest: suggestAirports, pinned: isAirport }
                    : { resolve: resolvePlace, suggest: suggestWhenTyped })}
                  map={false}
                />
              </div>
            </FieldGroup>
          )}

          {copy.place && (
            <FieldGroup>
              <PlaceField
                id="manual-place"
                label={copy.place.label}
                value={values.place}
                onChange={(value) => set({ place: value })}
                placeholder={copy.place.placeholder}
                resolve={resolvePlace}
                suggest={suggestWhenTyped}
              />
            </FieldGroup>
          )}

          <WhenFields
            idPrefix="manual"
            label={copy.when.label}
            startLabel={kind === "transit" ? transit.start : copy.when.start}
            endLabel={kind === "transit" ? transit.end : copy.when.end}
            start={values.startsAt}
            end={values.endsAt}
            onStart={(value) => set({ startsAt: value })}
            onEnd={(value) => set({ endsAt: value })}
            startError={errors.startsAt}
            endError={errors.endsAt}
            sameZone={sameZone}
          />

          {copy.primary.map(section)}

          <Disclosure
            // Opened when something in it needs fixing, so the error is never hidden.
            key={`${kind}-${moreErrors}`}
            label="More details"
            hint={copy.more.map((name) => SECTION_LABELS[name]).join(", ")}
            summary={moreFilled.map((name) => SECTION_LABELS[name]).join(", ")}
            defaultOpen={moreErrors || moreFilled.length > 0}
          >
            <div className="flex flex-col gap-4">{copy.more.map(section)}</div>
          </Disclosure>
        </div>

        <div className="mt-5 flex gap-2 border-t border-line pt-4">
          <GhostButton onClick={clear} disabled={blank}>
            Clear
          </GhostButton>
          <PrimaryButton onClick={submit}>
            {trip ? "Add to trip" : "Start a new trip from this"}
          </PrimaryButton>
        </div>

        {trip ? (
          <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-ink-faint">
            Adds to {trip.name}
          </p>
        ) : (
          <StartsTripNote what="what you typed" />
        )}
      </Card>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pending && (
          <DuplicateChoice
            draft={pending.draft}
            matches={pending.matches}
            onMerge={merge}
            onKeepBoth={() => file(pending.draft)}
            onCancel={() => setPending(null)}
          />
        )}
        {filedLabel && <FiledNotice label={filedLabel} />}
      </div>
    </div>
  );
}
