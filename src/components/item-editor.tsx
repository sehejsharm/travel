"use client";

import { useEffect, useState } from "react";
import { addHours, fromLocalInput, offsetOf, toLocalInput } from "@/lib/datetime";
import type { BookingKind, ItemCategory, Trip, TripItem } from "@/lib/domain/types";
import { getCountry } from "@/lib/reference/countries";
import { CURRENCY_SYMBOLS } from "@/lib/reference/fx";
import { groundPlace } from "@/lib/reference/places";
import { removeItem, unscheduleItem, updateItem } from "@/lib/store/state";
import { Field, GhostButton, PrimaryButton, Segmented, Select, TextArea, TextInput } from "./form";
import { Sheet } from "./sheet";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "place", label: "Place" },
  { value: "activity", label: "Activity" },
  { value: "purchase", label: "Buy" },
  { value: "booking", label: "Booking" },
];

const BOOKING_KINDS: BookingKind[] = ["flight", "lodging", "rail", "car", "tour", "other"];
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

interface Draft {
  title: string;
  category: ItemCategory;
  bookingKind: BookingKind | "";
  startsAt: string;
  endsAt: string;
  placeName: string;
  costAmount: string;
  costCurrency: string;
  costStatus: "estimated" | "actual";
  confirmationCode: string;
  travelerName: string;
  refundableUntil: string;
  notes: string;
}

function toDraft(item: TripItem): Draft {
  return {
    title: item.title,
    category: item.category,
    bookingKind: item.bookingKind ?? "",
    startsAt: toLocalInput(item.startsAt),
    endsAt: toLocalInput(item.endsAt),
    placeName: item.place?.name ?? "",
    costAmount: item.cost ? String(item.cost.amount) : "",
    costCurrency: item.cost?.currency ?? "",
    costStatus: item.costStatus ?? "estimated",
    confirmationCode: item.confirmationCode ?? "",
    travelerName: item.travelerName ?? "",
    refundableUntil: toLocalInput(item.refundableUntil),
    notes: item.notes ?? "",
  };
}

export function ItemEditor({
  item,
  trip,
  onClose,
}: {
  item: TripItem | null;
  trip: Trip;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(item ? toDraft(item) : null);
    setConfirmDelete(false);
  }, [item]);

  if (!item || !draft) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  /**
   * Times keep the offset they were filed with. A newly scheduled item takes
   * the offset of the country it happens in, so distance and layover checks
   * compare like with like.
   */
  function offsetFor(existing?: string): string {
    const known = offsetOf(existing);
    if (known) return known;

    const grounded = groundPlace(draft!.placeName);
    const country = getCountry(grounded?.countryCode ?? item!.place?.countryCode);
    if (!country) return "";

    const sign = country.utcOffset < 0 ? "-" : "+";
    const abs = Math.abs(country.utcOffset);
    const hours = String(Math.floor(abs)).padStart(2, "0");
    const minutes = String(Math.round((abs - Math.floor(abs)) * 60)).padStart(2, "0");
    return `${sign}${hours}:${minutes}`;
  }

  function save() {
    if (!draft || !item) return;

    const startOffset = offsetFor(item.startsAt);
    const startsAt = fromLocalInput(draft.startsAt, startOffset);
    // An end before the start is a typo, not an intention.
    const endsAt =
      draft.endsAt && (!startsAt || draft.endsAt >= draft.startsAt)
        ? fromLocalInput(draft.endsAt, offsetFor(item.endsAt) || startOffset)
        : undefined;

    const grounded = draft.placeName ? groundPlace(draft.placeName) : undefined;
    const place = draft.placeName
      ? grounded ?? { ...item.place, name: draft.placeName }
      : undefined;

    const amount = Number(draft.costAmount);
    const cost =
      draft.costAmount && Number.isFinite(amount) && draft.costCurrency
        ? { amount, currency: draft.costCurrency }
        : undefined;

    updateItem(item.id, {
      title: draft.title.trim() || item.title,
      category: draft.category,
      bookingKind: draft.bookingKind || undefined,
      startsAt,
      endsAt: startsAt ? endsAt : undefined,
      place,
      cost,
      costStatus: cost ? draft.costStatus : undefined,
      confirmationCode: draft.confirmationCode.trim() || undefined,
      travelerName: draft.travelerName.trim() || undefined,
      refundableUntil: fromLocalInput(draft.refundableUntil),
      notes: draft.notes.trim() || undefined,
    });

    onClose();
  }

  function scheduleForFirstDay() {
    const startsAt = `${trip.startDate}T09:00`;
    set("startsAt", startsAt);
    set("endsAt", toLocalInput(addHours(`${startsAt}:00`, 2)));
  }

  const grounded = draft.placeName ? groundPlace(draft.placeName) : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.startsAt ? "Edit" : "Schedule or edit"}
      footer={
        <div className="flex gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>Save</PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title">
          <TextInput value={draft.title} onChange={(event) => set("title", event.target.value)} />
        </Field>

        <Field label="Category">
          <Segmented
            label="Category"
            value={draft.category}
            options={CATEGORIES}
            onChange={(value) => set("category", value)}
          />
        </Field>

        {draft.category === "booking" && (
          <Field label="Booking type">
            <Select
              value={draft.bookingKind}
              onChange={(event) => set("bookingKind", event.target.value as BookingKind | "")}
            >
              <option value="">Not set</option>
              {BOOKING_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              When
            </p>
            {!draft.startsAt && (
              <button
                type="button"
                onClick={scheduleForFirstDay}
                className="press font-mono text-[10px] text-accent-strong underline"
              >
                put on day one
              </button>
            )}
          </div>

          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <Field label="Starts">
              <TextInput
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) => set("startsAt", event.target.value)}
              />
            </Field>
            <Field label="Ends">
              <TextInput
                type="datetime-local"
                value={draft.endsAt}
                min={draft.startsAt || undefined}
                onChange={(event) => set("endsAt", event.target.value)}
              />
            </Field>
          </div>

          {draft.startsAt && (
            <button
              type="button"
              onClick={() => {
                set("startsAt", "");
                set("endsAt", "");
              }}
              className="press mt-2 font-mono text-[10px] text-ink-faint underline"
            >
              clear — send back to ideas
            </button>
          )}
        </div>

        <Field
          label="Place"
          hint={
            draft.placeName
              ? grounded
                ? `Matched ${grounded.name}${grounded.city ? `, ${grounded.city}` : ""} — distance checks will use it`
                : "No coordinates for this name, so it sits out the distance checks"
              : undefined
          }
        >
          <TextInput
            value={draft.placeName}
            placeholder="Senso-ji, Shibuya Sky…"
            onChange={(event) => set("placeName", event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Cost">
            <TextInput
              inputMode="decimal"
              value={draft.costAmount}
              placeholder="0"
              onChange={(event) => set("costAmount", event.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={draft.costCurrency}
              onChange={(event) => set("costCurrency", event.target.value)}
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

        {draft.costAmount && (
          <Field label="Price status">
            <Segmented
              label="Price status"
              value={draft.costStatus}
              options={[
                { value: "estimated", label: "Estimated" },
                { value: "actual", label: "Booked" },
              ]}
              onChange={(value) => set("costStatus", value)}
            />
          </Field>
        )}

        <Field label="Confirmation">
          <TextInput
            value={draft.confirmationCode}
            placeholder="PNR or booking reference"
            onChange={(event) => set("confirmationCode", event.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Traveller on the booking">
          <TextInput
            value={draft.travelerName}
            list="traveller-names"
            onChange={(event) => set("travelerName", event.target.value)}
          />
          <datalist id="traveller-names">
            {trip.travelers.map((traveler) => (
              <option key={traveler.id} value={traveler.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Free cancellation until">
          <TextInput
            type="datetime-local"
            value={draft.refundableUntil}
            onChange={(event) => set("refundableUntil", event.target.value)}
          />
        </Field>

        <Field label="Notes">
          <TextArea
            rows={2}
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {item.startsAt && (
            <GhostButton
              onClick={() => {
                unscheduleItem(item.id);
                onClose();
              }}
            >
              Unschedule
            </GhostButton>
          )}
          <GhostButton
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              removeItem(item.id);
              onClose();
            }}
            className={confirmDelete ? "border-critical text-critical" : ""}
          >
            {confirmDelete ? "Tap again to delete" : "Delete"}
          </GhostButton>
        </div>
      </div>
    </Sheet>
  );
}
