"use client";

import { useState } from "react";
import type { Traveler } from "@/lib/domain/types";
import { COUNTRIES } from "@/lib/reference/countries";
import { addTraveler, removeTraveler, updateTraveler } from "@/lib/store/state";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "./form";
import { Sheet } from "./sheet";

const COUNTRY_OPTIONS = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));

type Draft = Omit<Traveler, "id">;

const BLANK: Draft = {
  name: "",
  passportCountry: "IN",
  passportExpiry: "",
  insuranceFrom: "",
  insuranceTo: "",
};

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
    traveler ? { ...BLANK, ...traveler } : BLANK,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function save() {
    if (!draft.name.trim()) return;

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
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={!draft.name.trim()}>
            Save
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput
            value={draft.name}
            placeholder="As printed on the passport"
            onChange={(event) => set("name", event.target.value)}
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
        >
          <TextInput
            type="date"
            value={draft.passportExpiry}
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

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={Boolean(draft.needsVisaHelp)}
            onChange={(event) => set("needsVisaHelp", event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="text-sm">
            Needs a hand with the visa
            <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-ink-faint">
              Adds a check that spells out the paperwork, in order, for every destination that
              needs it.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insurance from">
            <TextInput
              type="date"
              value={draft.insuranceFrom ?? ""}
              onChange={(event) => set("insuranceFrom", event.target.value)}
            />
          </Field>
          <Field label="Insurance to">
            <TextInput
              type="date"
              value={draft.insuranceTo ?? ""}
              min={draft.insuranceFrom || undefined}
              onChange={(event) => set("insuranceTo", event.target.value)}
            />
          </Field>
        </div>

        {traveler && (
          <div className="border-t border-line pt-4">
            <GhostButton
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                removeTraveler(tripId, traveler.id);
                onClose();
              }}
              className={confirmDelete ? "border-critical text-critical" : ""}
            >
              {confirmDelete ? "Tap again to remove" : "Remove traveller"}
            </GhostButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}
