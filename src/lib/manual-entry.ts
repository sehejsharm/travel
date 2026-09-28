import type { BookingKind, CostStatus, ItemCategory, PlaceRef } from "./domain/types";
import type { ItemDraft } from "./extract/types";
import { fromLocalInput } from "./datetime";
import { endsBeforeStart, offsetForCountry, readCost } from "./item-form";
import { airportPlace, findAirport } from "./reference/airports";
import { groundPlace } from "./reference/places";

/**
 * Typing an item in by hand. What comes out is the same ItemDraft the
 * extractor produces, built the same way — airports as the extractor builds
 * them, times carrying the offset of the country they happen in — so nothing
 * downstream can tell a typed flight from a read one.
 */

export type ManualKind = "flight" | "lodging" | "activity" | "transit";
export type TransitKind = "rail" | "car" | "other";

export const MANUAL_KINDS: { value: ManualKind; label: string }[] = [
  { value: "flight", label: "Flight" },
  { value: "lodging", label: "Lodging" },
  { value: "activity", label: "Activity" },
  { value: "transit", label: "Transit" },
];

export const TRANSIT_KINDS: { value: TransitKind; label: string }[] = [
  { value: "rail", label: "Train" },
  { value: "car", label: "Car" },
  { value: "other", label: "Other" },
];

/**
 * Everything the form holds, as typed. One set of values across the kinds, so
 * switching from Flight to Transit keeps the route; only the fields the chosen
 * kind shows are ever filed.
 */
export interface ManualValues {
  kind: ManualKind;
  transitKind: TransitKind;
  /** The airline, for a flight; the operator, for transit. */
  provider: string;
  flightNumber: string;
  from: string;
  to: string;
  /** What a stay or an activity is called. */
  name: string;
  place: string;
  /** `datetime-local` values: wall clock, no offset. */
  startsAt: string;
  endsAt: string;
  confirmationCode: string;
  costAmount: string;
  costCurrency: string;
  /** Empty until picked, and then a booking is taken as paid and anything else as a guess. */
  costStatus: CostStatus | "";
  travelerName: string;
  refundableUntil: string;
  notes: string;
}

export const EMPTY_MANUAL: ManualValues = {
  kind: "flight",
  transitKind: "rail",
  provider: "",
  flightNumber: "",
  from: "",
  to: "",
  name: "",
  place: "",
  startsAt: "",
  endsAt: "",
  confirmationCode: "",
  costAmount: "",
  costCurrency: "",
  costStatus: "",
  travelerName: "",
  refundableUntil: "",
  notes: "",
};

type TextField = Exclude<keyof ManualValues, "kind" | "transitKind" | "costStatus">;

const TEXT_FIELDS = (Object.keys(EMPTY_MANUAL) as (keyof ManualValues)[]).filter(
  (key): key is TextField => key !== "kind" && key !== "transitKind" && key !== "costStatus",
);

/** Where an error is shown. "title" is whichever field names the item. */
export type ManualErrorKey = "title" | "startsAt" | "endsAt" | "costAmount" | "costCurrency";
export type ManualErrors = Partial<Record<ManualErrorKey, string>>;

export function isTransport(kind: ManualKind): boolean {
  return kind === "flight" || kind === "transit";
}

export function isBlank(values: ManualValues): boolean {
  return TEXT_FIELDS.every((field) => values[field].trim() === "") && values.costStatus === "";
}

/** A fresh form that stays on the kind that was picked. */
export function resetManual(values: ManualValues): ManualValues {
  return { ...EMPTY_MANUAL, kind: values.kind, transitKind: values.transitKind };
}

/** Anything read back from storage, made safe to put in the form. */
export function toManualValues(value: unknown): ManualValues {
  if (!value || typeof value !== "object") return EMPTY_MANUAL;
  const raw = value as Record<string, unknown>;
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(raw[key] as T) ? (raw[key] as T) : fallback;

  const values: ManualValues = {
    ...EMPTY_MANUAL,
    kind: pick("kind", MANUAL_KINDS.map((kind) => kind.value), EMPTY_MANUAL.kind),
    transitKind: pick("transitKind", TRANSIT_KINDS.map((kind) => kind.value), EMPTY_MANUAL.transitKind),
    costStatus: pick("costStatus", ["", "estimated", "actual"] as const, ""),
  };
  for (const field of TEXT_FIELDS) {
    const text = raw[field];
    if (typeof text === "string") values[field] = text;
  }
  return values;
}

/**
 * What a typed place resolves to, exactly as it will be filed. A flight's
 * ends are airports first, built as the extractor builds them; anything else
 * is grounded like a place typed into the editor.
 */
export function resolvePlace(text: string, airports = false): PlaceRef | undefined {
  const name = text.trim();
  if (!name) return undefined;

  if (airports) {
    const airport = findAirport(name);
    if (airport) return airportPlace(airport.iata);
  }
  return groundPlace(name) ?? { name };
}

const TRANSIT_NOUNS: Record<TransitKind, string> = { rail: "Train", car: "Car", other: "Transfer" };

const TITLE_MISSING: Record<ManualKind, string> = {
  flight: "Add the flight number, the airline, or where it flies",
  transit: "Add the operator, or where it goes",
  lodging: "Name the place you are staying",
  activity: "Give it a name",
};

const END_BEFORE_START: Record<ManualKind, string> = {
  flight: "Lands before it takes off",
  transit: "Arrives before it leaves",
  lodging: "Check-out is before check-in",
  activity: "Ends before it starts",
};

function classify(values: ManualValues): { category: ItemCategory; bookingKind?: BookingKind } {
  switch (values.kind) {
    case "flight":
      return { category: "booking", bookingKind: "flight" };
    case "lodging":
      return { category: "booking", bookingKind: "lodging" };
    case "transit":
      return { category: "booking", bookingKind: values.transitKind };
    case "activity":
      return { category: "activity" };
  }
}

/** "DEL → HND" for airports, as the extractor titles a flight; the typed names otherwise. */
function routeOf(values: ManualValues, from?: PlaceRef, to?: PlaceRef): string {
  const start = from?.airport ?? values.from.trim();
  const end = to?.airport ?? values.to.trim();
  if (start && end) return `${start} → ${end}`;
  if (start) return `from ${start}`;
  return end ? `to ${end}` : "";
}

/**
 * A flight leads with its number ("AI142 DEL → HND"), as the extractor writes
 * it — the baggage check reads the carrier from those first two characters.
 * So an airline name never leads: "Air France" would read as Air India (AI).
 */
function titleOf(values: ManualValues, from?: PlaceRef, to?: PlaceRef): string {
  if (!isTransport(values.kind)) return values.name.trim();

  const provider = values.provider.trim();
  const route = routeOf(values, from, to);

  if (values.kind === "transit") {
    const lead = provider || (route ? TRANSIT_NOUNS[values.transitKind] : "");
    return [lead, route].filter(Boolean).join(" ");
  }

  const number = values.flightNumber.toUpperCase().replace(/[\s-]+/g, "");
  if (!number && !provider && !route) return "";
  const title = [number || "Flight", route].filter(Boolean).join(" ");
  return provider ? `${title} · ${provider}` : title;
}

/** The cost status a price is filed with when none was picked. */
export function defaultCostStatus(kind: ManualKind): CostStatus {
  return kind === "activity" ? "estimated" : "actual";
}

export interface ManualResult {
  /** Present only when there is nothing left to fix. */
  draft?: ItemDraft;
  errors: ManualErrors;
}

/**
 * Where a stay or an activity is. The place typed wins; left blank, the name
 * is grounded instead ("Park Hyatt Tokyo" is in Tokyo), as the extractor
 * grounds a booking's whole text — but only when that lands on a real pin,
 * never the name itself standing in for a place.
 */
export function placeOfSpot(values: Pick<ManualValues, "name" | "place">): PlaceRef | undefined {
  if (values.place.trim()) return resolvePlace(values.place);
  const fromName = values.name.trim() ? groundPlace(values.name) : undefined;
  return fromName?.point ? fromName : undefined;
}

/**
 * The offsets a journey's two times are filed with. Each end is on its own
 * country's clock, as the extractor has a flight; an end whose country is not
 * known borrows the other end's, so the two times are never read on different
 * clocks — one with an offset and one in the device's zone.
 */
export function journeyOffsets(from?: PlaceRef, to?: PlaceRef): { start: string; end: string } {
  const start = offsetForCountry(from?.countryCode);
  const end = offsetForCountry(to?.countryCode);
  return { start: start || end, end: end || start };
}

export function buildManualDraft(values: ManualValues): ManualResult {
  const errors: ManualErrors = {};
  const transport = isTransport(values.kind);

  const place = transport ? resolvePlace(values.from, values.kind === "flight") : placeOfSpot(values);
  const arrivalPlace = transport ? resolvePlace(values.to, values.kind === "flight") : undefined;

  const title = titleOf(values, place, arrivalPlace);
  if (!title) errors.title = TITLE_MISSING[values.kind];

  const offsets = journeyOffsets(place, arrivalPlace);
  const startsAt = fromLocalInput(values.startsAt, offsets.start);
  const endsAt = fromLocalInput(values.endsAt, offsets.end);
  if (endsAt && !startsAt) errors.startsAt = "Add when it starts as well";
  else if (endsBeforeStart(startsAt, endsAt)) errors.endsAt = END_BEFORE_START[values.kind];

  const reading = readCost(values.costAmount, values.costCurrency);
  if (reading.problem === "amount") errors.costAmount = "Not an amount";
  else if (reading.cost && reading.cost.amount < 0) errors.costAmount = "A price cannot be negative";
  if (reading.problem === "currency") errors.costCurrency = "Pick one";

  if (Object.keys(errors).length > 0) return { errors };

  const { category, bookingKind } = classify(values);
  const { cost } = reading;

  return {
    errors,
    draft: {
      title,
      category,
      bookingKind,
      source: "manual",
      place,
      arrivalPlace,
      startsAt,
      endsAt,
      cost,
      costStatus: cost ? values.costStatus || defaultCostStatus(values.kind) : undefined,
      confirmationCode: values.confirmationCode.trim().toUpperCase() || undefined,
      travelerName: values.travelerName.trim() || undefined,
      refundableUntil: fromLocalInput(values.refundableUntil),
      notes: values.notes.trim() || undefined,
    },
  };
}

/** Filed with full confidence: nothing was guessed, the traveller typed it. */
export const MANUAL_META = { confidence: 1, extractionMethod: "deterministic" } as const;
