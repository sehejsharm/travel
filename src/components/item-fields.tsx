"use client";

import { useId, type ReactNode } from "react";
import type { CostStatus, PlaceRef, Traveler } from "@/lib/domain/types";
import { mapEmbedUrl, openInMapsUrl } from "@/lib/maps";
import { CURRENCY_SYMBOLS } from "@/lib/reference/fx";
import { groundPlace, suggestPlaces, type PlaceSuggestion } from "@/lib/reference/places";
import { Field, Segmented, Select, TextArea, TextInput } from "./form";

/**
 * The fields an item is made of, shared by the editor sheet and by typing an
 * item in on the Add screen, so an item looks and reads the same wherever its
 * details are filled in.
 */

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

/** A bordered group of fields that belong together, with an optional small heading. */
export function FieldGroup({
  label,
  action,
  children,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      {(label || action) && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {label && (
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {label}
            </p>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** When something starts and ends, as wall-clock times in the place it happens. */
export function WhenFields({
  label = "When",
  startLabel = "Starts",
  endLabel = "Ends",
  start,
  end,
  onStart,
  onEnd,
  action,
  footer,
  startError,
  endError,
  idPrefix,
  sameZone = true,
}: {
  label?: string;
  startLabel?: string;
  endLabel?: string;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  action?: ReactNode;
  footer?: ReactNode;
  startError?: string;
  endError?: string;
  idPrefix?: string;
  /**
   * False when the two ends are on different clocks — a flight landing in
   * another zone can read earlier than it left — so the end is not held to
   * the start's wall clock.
   */
  sameZone?: boolean;
}) {
  return (
    <FieldGroup label={label} action={action}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={startLabel} error={startError}>
          <TextInput
            id={idPrefix && `${idPrefix}-startsAt`}
            type="datetime-local"
            value={start}
            aria-invalid={startError ? true : undefined}
            onChange={(event) => onStart(event.target.value)}
          />
        </Field>
        <Field label={endLabel} error={endError}>
          <TextInput
            id={idPrefix && `${idPrefix}-endsAt`}
            type="datetime-local"
            value={end}
            min={sameZone ? start || undefined : undefined}
            aria-invalid={endError ? true : undefined}
            onChange={(event) => onEnd(event.target.value)}
          />
        </Field>
      </div>
      {footer}
    </FieldGroup>
  );
}

/**
 * A place, grounded as it is typed: suggestions until the name lands on a
 * pin, then the pin — as a map, or a line where a map would crowd the form.
 */
export function PlaceField({
  label = "Place",
  value,
  onChange,
  placeholder = "Senso-ji, Shibuya Sky, Kyoto…",
  resolve = groundPlace,
  suggest = suggestPlaces,
  pinned = (place) => Boolean(place.point),
  map = true,
  id,
  error,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** What the typed text lands on, exactly as it will be filed. */
  resolve?: (text: string) => PlaceRef | undefined;
  suggest?: (text: string) => PlaceSuggestion[];
  /** Whether the place found is settled enough to stop suggesting. */
  pinned?: (place: PlaceRef) => boolean;
  map?: boolean;
  id?: string;
  error?: string;
}) {
  const found = value ? resolve(value) : undefined;
  const grounded = found?.point ? found : undefined;
  const settled = found ? pinned(found) : false;
  // Only worth suggesting while the typed name has not already landed.
  const suggestions = settled ? [] : suggest(value);

  const pinLabel = grounded
    ? `${grounded.name}${grounded.airport ? ` (${grounded.airport})` : ""}${
        grounded.city && grounded.city !== grounded.name ? `, ${grounded.city}` : ""
      }`
    : "";

  return (
    // min-w-0: in a grid, the unbroken "Pinned to" line would otherwise widen the column past its box.
    <div className="min-w-0">
      <Field
        label={label}
        error={error}
        hint={
          value && !grounded
            ? "No coordinates for this name, so it sits out the distance checks"
            : undefined
        }
      >
        <TextInput
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>

      {suggestions.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.name}-${suggestion.detail}`}>
              <button
                type="button"
                onClick={() => onChange(suggestion.name)}
                className="press rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-accent-strong"
              >
                {suggestion.name}
                <span className="text-ink-faint"> · {suggestion.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {grounded && map && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <iframe
            key={grounded.name}
            src={mapEmbedUrl(grounded)}
            title={`Map of ${grounded.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-40 w-full border-0"
          />
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <span className="min-w-0 truncate font-mono text-[10px] text-ink-faint">
              Pinned to {pinLabel}
            </span>
            <a
              href={openInMapsUrl(grounded)}
              target="_blank"
              rel="noreferrer"
              className="press shrink-0 font-mono text-[10px] text-accent-strong underline"
            >
              Open in Maps ↗
            </a>
          </div>
        </div>
      )}

      {grounded && !map && (
        <p className="mt-2 truncate font-mono text-[10px] text-ink-faint">Pinned to {pinLabel}</p>
      )}
    </div>
  );
}

export function CostFields({
  amount,
  currency,
  status,
  onAmount,
  onCurrency,
  onStatus,
  amountError,
  currencyError,
  idPrefix,
}: {
  amount: string;
  currency: string;
  status: CostStatus;
  onAmount: (value: string) => void;
  onCurrency: (value: string) => void;
  onStatus: (value: CostStatus) => void;
  amountError?: string;
  currencyError?: string;
  idPrefix?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Cost" error={amountError}>
          <TextInput
            id={idPrefix && `${idPrefix}-costAmount`}
            inputMode="decimal"
            value={amount}
            placeholder="0"
            aria-invalid={amountError ? true : undefined}
            onChange={(event) => onAmount(event.target.value)}
          />
        </Field>
        <Field label="Currency" error={currencyError}>
          <Select
            id={idPrefix && `${idPrefix}-costCurrency`}
            value={currency}
            aria-invalid={currencyError ? true : undefined}
            onChange={(event) => onCurrency(event.target.value)}
          >
            <option value="">—</option>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {amount && (
        <Field label="Price status" group>
          <Segmented
            label="Price status"
            value={status}
            options={[
              { value: "estimated", label: "Estimated" },
              { value: "actual", label: "Booked" },
            ]}
            onChange={onStatus}
          />
        </Field>
      )}
    </>
  );
}

export function ConfirmationField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Field label="Confirmation">
      <TextInput
        id={id}
        value={value}
        placeholder="PNR or booking reference"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </Field>
  );
}

export function TravellerField({
  value,
  onChange,
  travelers,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  travelers: Traveler[];
  id?: string;
}) {
  const listId = useId();

  return (
    <Field label="Traveller on the booking">
      <TextInput
        id={id}
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {travelers.map((traveler) => (
          <option key={traveler.id} value={traveler.name} />
        ))}
      </datalist>
    </Field>
  );
}

export function RefundField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Field label="Free cancellation until">
      <TextInput
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function NotesField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Field label="Notes">
      <TextArea id={id} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
