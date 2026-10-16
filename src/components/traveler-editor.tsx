"use client";

import { useId, useState } from "react";
import type { Traveler } from "@/lib/domain/types";
import { COUNTRIES } from "@/lib/reference/countries";
import { addTraveler, removeTraveler, updateTraveler } from "@/lib/store/state";
import { DestructiveButton, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "./form";
import { dayError } from "./legs-editor";
import { Sheet } from "./sheet";

const COUNTRY_OPTIONS = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));

type Draft = Omit<Traveler, "id">;

/**
 * Someone new most likely holds the passport of the country the trip sets
 * off from. A fixed default would quietly run every visa check against a
 * passport nobody chose.
 */
function blank(homeCountry: string): Draft {
  const home = homeCountry.toUpperCase();
  return {
    name: "",
    passportCountry: home in COUNTRIES ? home : "",
    passportExpiry: "",
    insuranceFrom: "",
    insuranceTo: "",
  };
}

type ErrorKey = "name" | "passportExpiry" | "insuranceFrom" | "insuranceTo";

/** In the order the fields are on screen, so the cursor goes to the first. */
const ERROR_ORDER: ErrorKey[] = ["name", "passportExpiry", "insuranceFrom", "insuranceTo"];

/** Every date here is optional; one that was typed has to be whole, and cover has to end after it starts. */
function problems(draft: Draft): Partial<Record<ErrorKey, string>> {
  const errors: Partial<Record<ErrorKey, string>> = {};
  if (!draft.name.trim()) errors.name = "Enter a name";
  if (draft.passportExpiry) errors.passportExpiry = dayError(draft.passportExpiry);
  if (draft.insuranceFrom) errors.insuranceFrom = dayError(draft.insuranceFrom);
  if (draft.insuranceTo) {
    errors.insuranceTo =
      dayError(draft.insuranceTo) ??
      (draft.insuranceFrom && !errors.insuranceFrom && draft.insuranceTo < draft.insuranceFrom
        ? "Must be on or after the cover starts"
        : undefined);
  }
  return errors;
}

export function TravelerEditor({
  tripId,
  traveler,
  homeCountry,
  open,
  onClose,
}: {
  tripId: string;
  /** Null when adding someone new. */
  traveler: Traveler | null;
  /** The trip's own origin, which every traveller inherits unless they differ. */
  homeCountry: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  // Keyed on who is being edited, so opening the sheet always starts clean.
  return (
    <TravelerEditorForm
      key={traveler?.id ?? "new"}
      tripId={tripId}
      traveler={traveler}
      homeCountry={homeCountry}
      onClose={onClose}
    />
  );
}

function TravelerEditorForm({
  tripId,
  traveler,
  homeCountry,
  onClose,
}: {
  tripId: string;
  traveler: Traveler | null;
  homeCountry: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    traveler ? { ...blank(homeCountry), ...traveler } : blank(homeCountry),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A name is only called missing once one was typed and taken away; an
  // empty new sheet is not a mistake, and Save waits for a name regardless.
  const [nameTouched, setNameTouched] = useState(false);

  const uid = useId();
  const fieldId = (key: ErrorKey) => `${uid}-${key}`;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const errors = problems(draft);
  const shown: Partial<Record<ErrorKey, string>> = {
    ...errors,
    name: nameTouched ? errors.name : undefined,
  };

  function save() {
    if (!draft.name.trim()) return;

    const first = ERROR_ORDER.find((key) => errors[key]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }

    const payload: Draft = {
      name: draft.name.trim(),
      passportCountry: draft.passportCountry.toUpperCase(),
      passportExpiry: draft.passportExpiry,
      insuranceFrom: draft.insuranceFrom || undefined,
      insuranceTo: draft.insuranceTo || undefined,
      // Stored only when it differs from the trip, so clearing it goes back to
      // inheriting rather than pinning the same country twice.
      originCountry:
        draft.originCountry && draft.originCountry.toUpperCase() !== homeCountry.toUpperCase()
          ? draft.originCountry.toUpperCase()
          : undefined,
      needsVisaHelp: draft.needsVisaHelp || undefined,
    };

    if (traveler) updateTraveler(tripId, traveler.id, payload);
    else addTraveler(tripId, payload);

    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={traveler ? "Edit traveller" : "Add traveller"}
      footer={
        <div className="flex gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={!draft.name.trim()}>
            Save
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" error={shown.name}>
          <TextInput
            id={fieldId("name")}
            value={draft.name}
            placeholder="As printed on the passport"
            aria-invalid={shown.name ? true : undefined}
            onChange={(event) => {
              set("name", event.target.value);
              setNameTouched(true);
            }}
          />
        </Field>

        <Field
          label="Passport country"
          hint="Drives the visa and entry checks for every destination on this trip."
        >
          <Select
            value={draft.passportCountry}
            onChange={(event) => set("passportCountry", event.target.value)}
          >
            {/* As in trip creation, where a traveller can be added by name alone. */}
            <option value="">Not set</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Passport expires"
          hint="Checked against each country's validity rule, not just the trip dates."
          error={shown.passportExpiry}
        >
          <TextInput
            id={fieldId("passportExpiry")}
            type="date"
            value={draft.passportExpiry}
            aria-invalid={shown.passportExpiry ? true : undefined}
            onChange={(event) => set("passportExpiry", event.target.value)}
          />
        </Field>

        <Field
          label="Flying from"
          hint="Where this person sets off from, if it is not where the trip does. Sets their plugs, voltage, jet lag and the customs allowance they come home to — the passport above still decides the visa."
        >
          <Select
            value={draft.originCountry ?? ""}
            onChange={(event) => set("originCountry", event.target.value || undefined)}
          >
            <option value="">Same as the trip ({homeCountry})</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(draft.needsVisaHelp)}
            onChange={(event) => set("needsVisaHelp", event.target.checked)}
            className="press mt-1 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="text-subheadline">
            Needs a hand with the visa
            <span className="block text-caption text-ink-soft">
              Adds a check that spells out the paperwork, in order, for every destination that
              needs it.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insurance from" error={shown.insuranceFrom}>
            <TextInput
              id={fieldId("insuranceFrom")}
              type="date"
              value={draft.insuranceFrom ?? ""}
              aria-invalid={shown.insuranceFrom ? true : undefined}
              onChange={(event) => set("insuranceFrom", event.target.value)}
            />
          </Field>
          <Field label="Insurance to" error={shown.insuranceTo}>
            <TextInput
              id={fieldId("insuranceTo")}
              type="date"
              value={draft.insuranceTo ?? ""}
              min={draft.insuranceFrom || undefined}
              aria-invalid={shown.insuranceTo ? true : undefined}
              onChange={(event) => set("insuranceTo", event.target.value)}
            />
          </Field>
        </div>

        {traveler && (
          <div className="border-t border-line pt-4">
            <DestructiveButton
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                removeTraveler(tripId, traveler.id);
                onClose();
              }}
            >
              {confirmDelete ? "Tap again to remove" : "Remove traveller"}
            </DestructiveButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}
