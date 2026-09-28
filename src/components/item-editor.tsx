"use client";

import { useState } from "react";
import { addHours, fromLocalInput, offsetOf, toLocalInput } from "@/lib/datetime";
import type { BookingKind, ItemCategory, PlaceRef, Trip, TripItem } from "@/lib/domain/types";
import { endsBeforeStart, offsetForCountry, readCost, resolvePlace } from "@/lib/item-form";
import { removeItem, unscheduleItem, updateItem } from "@/lib/store/state";
import { Field, GhostButton, PrimaryButton, Segmented, Select, TextInput } from "./form";
import {
  ConfirmationField,
  CostFields,
  FieldGroup,
  FLIGHT_END_FIELD,
  NotesField,
  PlaceField,
  RefundField,
  TravellerField,
  WhenFields,
} from "./item-fields";
import { Sheet } from "./sheet";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "place", label: "Place" },
  { value: "activity", label: "Activity" },
  { value: "purchase", label: "Buy" },
  { value: "booking", label: "Booking" },
];

const BOOKING_KINDS: BookingKind[] = ["flight", "lodging", "rail", "car", "tour", "other"];

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
  if (!item) return null;
  // Remounting per item is what resets the form — no state sync in an effect.
  return <ItemEditorForm key={item.id} item={item} trip={trip} onClose={onClose} />;
}

function ItemEditorForm({
  item,
  trip,
  onClose,
}: {
  item: TripItem;
  trip: Trip;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [confirmDelete, setConfirmDelete] = useState(false);

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

    return offsetForCountry(placeFor(draft.placeName)?.countryCode ?? item.place?.countryCode);
  }

  function save() {
    const startOffset = offsetFor(item.startsAt);
    const startsAt = fromLocalInput(draft.startsAt, startOffset);
    // An end before the start is a typo, not an intention.
    const typedEnd = fromLocalInput(draft.endsAt, offsetFor(item.endsAt) || startOffset);
    const endsAt = endsBeforeStart(startsAt, typedEnd) ? undefined : typedEnd;

    const place = placeFor(draft.placeName);

    // A price that is not a number, or has no currency, is left off.
    const { cost } = readCost(draft.costAmount, draft.costCurrency);

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

  const isFlight = draft.category === "booking" && draft.bookingKind === "flight";

  /**
   * Where the place field lands, for its preview and for Save alike. A place
   * left as it was is kept exactly as filed: grounding its name again would
   * lose what only the filing knew, like a flight's airport code. A renamed
   * one is resolved afresh — a flight's end as an airport, as on the Add
   * screen — and keeps no stale pin. Spaces alone are no place.
   */
  function placeFor(text: string): PlaceRef | undefined {
    const name = text.trim();
    if (!name) return undefined;
    if (item.place && name === item.place.name.trim()) {
      // Filed without its code ("Tokyo Haneda (HND)" from a screenshot), a
      // flight's end that plainly names one airport is settled on it.
      if (isFlight && !item.place.airport) {
        const settled = resolvePlace(name, true);
        if (settled?.airport) return settled;
      }
      return item.place;
    }
    return resolvePlace(name, isFlight);
  }

  // A time filed on another clock (a flight landing elsewhere) can read earlier than it left.
  const sameZone = !item.endsAt || offsetOf(item.startsAt) === offsetOf(item.endsAt);

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

        <Field label="Category" group>
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

        <WhenFields
          start={draft.startsAt}
          end={draft.endsAt}
          onStart={(value) => set("startsAt", value)}
          onEnd={(value) => set("endsAt", value)}
          sameZone={sameZone}
          action={
            !draft.startsAt && (
              <button
                type="button"
                onClick={scheduleForFirstDay}
                className="press font-mono text-[10px] text-accent-strong underline"
              >
                put on day one
              </button>
            )
          }
          footer={
            draft.startsAt && (
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
            )
          }
        />

        <FieldGroup>
          <PlaceField
            value={draft.placeName}
            onChange={(value) => set("placeName", value)}
            {...(isFlight ? FLIGHT_END_FIELD : {})}
            resolve={placeFor}
          />
        </FieldGroup>

        <CostFields
          amount={draft.costAmount}
          currency={draft.costCurrency}
          status={draft.costStatus}
          onAmount={(value) => set("costAmount", value)}
          onCurrency={(value) => set("costCurrency", value)}
          onStatus={(value) => set("costStatus", value)}
        />

        <ConfirmationField
          value={draft.confirmationCode}
          onChange={(value) => set("confirmationCode", value)}
        />

        <TravellerField
          value={draft.travelerName}
          travelers={trip.travelers}
          onChange={(value) => set("travelerName", value)}
        />

        <RefundField
          value={draft.refundableUntil}
          onChange={(value) => set("refundableUntil", value)}
        />

        <NotesField value={draft.notes} onChange={(value) => set("notes", value)} />

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
