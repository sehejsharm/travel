"use client";

import { useState } from "react";
import type { Trip } from "@/lib/domain/types";
import { COUNTRIES } from "@/lib/reference/countries";
import { CURRENCY_SYMBOLS } from "@/lib/reference/fx";
import { createTrip, updateTrip, type TripInput } from "@/lib/store/state";
import { Field, PrimaryButton, Select, TextInput } from "./form";

const COUNTRY_OPTIONS = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function TripForm({
  trip,
  onDone,
  submitLabel = "Save trip",
}: {
  trip?: Trip;
  onDone: (tripId: string) => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<TripInput>({
    name: trip?.name ?? "",
    startDate: trip?.startDate ?? inDays(30),
    endDate: trip?.endDate ?? inDays(37),
    homeCountry: trip?.homeCountry ?? "IN",
    destinationCountry: trip?.destinationCountries?.[0] ?? "JP",
    budgetAmount: trip?.budgetTarget?.amount,
    budgetCurrency: trip?.budgetTarget?.currency ?? "INR",
  });

  const set = <K extends keyof TripInput>(key: K, value: TripInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const datesValid = draft.endDate >= draft.startDate;
  const valid = draft.name.trim().length > 0 && draft.startDate && datesValid;

  function submit() {
    if (!valid) return;

    if (trip) {
      updateTrip(trip.id, {
        name: draft.name.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        homeCountry: draft.homeCountry.toUpperCase(),
        destinationCountries: draft.destinationCountry
          ? [draft.destinationCountry.toUpperCase()]
          : [],
        budgetTarget:
          draft.budgetAmount && draft.budgetCurrency
            ? { amount: draft.budgetAmount, currency: draft.budgetCurrency }
            : undefined,
      });
      onDone(trip.id);
      return;
    }

    onDone(createTrip(draft));
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Where are you going?">
        <TextInput
          value={draft.name}
          placeholder="Japan, autumn"
          autoFocus={!trip}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Leaving">
          <TextInput
            type="date"
            value={draft.startDate}
            min={trip ? undefined : today()}
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

      <Field
        label="Destination"
        hint="Switches on the visa, health, plug, weather and holiday checks for this country."
      >
        <Select
          value={draft.destinationCountry}
          onChange={(event) => set("destinationCountry", event.target.value)}
        >
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Home country"
        hint="Sets the visa, plug, currency and jet lag checks against where you are going."
      >
        <Select
          value={draft.homeCountry}
          onChange={(event) => set("homeCountry", event.target.value)}
        >
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Budget">
          <TextInput
            inputMode="decimal"
            value={draft.budgetAmount ?? ""}
            placeholder="Optional"
            onChange={(event) =>
              set("budgetAmount", event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Currency">
          <Select
            value={draft.budgetCurrency}
            onChange={(event) => set("budgetCurrency", event.target.value)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <PrimaryButton onClick={submit} disabled={!valid}>
        {submitLabel}
      </PrimaryButton>
    </div>
  );
}
