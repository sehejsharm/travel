import type { BookingKind, CostStatus, ItemCategory, PlaceRef, Trip } from "./domain/types";
import type { ItemDraft } from "./extract/types";
import { fromLocalInput } from "./datetime";
import { endsBeforeStart, offsetForCountry, readCost, resolvePlace } from "./item-form";

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
export type ManualErrorKey =
  | "title"
  | "flightNumber"
  | "startsAt"
  | "endsAt"
  | "costAmount"
  | "costCurrency";
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

/** Where a typed place lands, shared with the editor so both file the same thing. */
export { resolvePlace } from "./item-form";

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

/** What the trip says about where it is: its legs, its destinations and its dates. */
export type TripClock = Partial<
  Pick<Trip, "destinationCountries" | "legs" | "startDate" | "endDate" | "datesTbd">
>;

/**
 * Where the trip is on a date: the leg that covers it, or its one
 * destination. Legs share their travel day, and whatever starts on it is
 * taken to be at the leg starting that day: check in in Tokyo, not Bangkok.
 */
function tripCountryOn(trip: TripClock, date: string): string | undefined {
  const covering = (trip.legs ?? []).filter((leg) => leg.startDate <= date && date <= leg.endDate);
  if (covering.length > 0) {
    return (covering.find((leg) => leg.startDate === date) ?? covering[0]).countryCode;
  }
  const countries = trip.destinationCountries ?? [];
  return countries.length === 1 ? countries[0] : undefined;
}

/**
 * The offsets an item's two times are filed with. Each end is on its own
 * country's clock, as the extractor has a flight; an end whose country is not
 * known borrows the other end's, so the two are never read on different
 * clocks — one with an offset and one in the device's zone.
 *
 * With neither place known — a stay typed with no place, a train between two
 * places the gazetteer lacks — the trip says where it is on the day it
 * starts, as long as the whole item falls within the trip, and both ends take
 * that one clock: a stay is in one place, however many legs its nights touch.
 * The place is never guessed from the name: "Museo del Prado" is not in Delhi.
 */
export function itemOffsets(
  from: PlaceRef | undefined,
  to: PlaceRef | undefined,
  trip?: TripClock,
  dates: { start?: string; end?: string } = {},
): { start: string; end: string } {
  const start = offsetForCountry(from?.countryCode);
  const end = offsetForCountry(to?.countryCode);
  if (start || end || !trip) return { start: start || end, end: end || start };

  const days = [dates.start, dates.end].filter((day): day is string => Boolean(day));
  const dated = !trip.datesTbd && trip.startDate && trip.endDate;
  if (days.length === 0) return { start: "", end: "" };
  if (dated && days.some((day) => day < trip.startDate! || day > trip.endDate!)) {
    return { start: "", end: "" };
  }

  // A day no leg covers says nothing; the other end's day may.
  const clock = offsetForCountry(
    tripCountryOn(trip, days[0]) ?? tripCountryOn(trip, days[days.length - 1]),
  );
  return { start: clock, end: clock };
}

// "AI 142", "6E204", "EK-511", "BA 1A": a carrier code, then the number.
const FLIGHT_NUMBER = /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/;

export function buildManualDraft(values: ManualValues, trip?: TripClock): ManualResult {
  const errors: ManualErrors = {};
  const transport = isTransport(values.kind);

  const place = resolvePlace(transport ? values.from : values.place, values.kind === "flight");
  const arrivalPlace = transport ? resolvePlace(values.to, values.kind === "flight") : undefined;

  const title = titleOf(values, place, arrivalPlace);
  if (!title) errors.title = TITLE_MISSING[values.kind];

  // The airline typed into the number box would lead the title and read as another carrier.
  const number = values.flightNumber.toUpperCase().replace(/[\s-]+/g, "");
  if (values.kind === "flight" && number && !FLIGHT_NUMBER.test(number)) {
    errors.flightNumber = "A flight number looks like AI 142";
  }

  const offsets = itemOffsets(place, arrivalPlace, trip, {
    start: values.startsAt.slice(0, 10),
    end: values.endsAt.slice(0, 10),
  });
  const startsAt = fromLocalInput(values.startsAt, offsets.start);
  const endsAt = fromLocalInput(values.endsAt, offsets.end);
  if (endsAt && !startsAt) errors.startsAt = "Add when it starts as well";
  else if (endsBeforeStart(startsAt, endsAt)) errors.endsAt = END_BEFORE_START[values.kind];

  const reading = readCost(values.costAmount, values.costCurrency);
  if (reading.problem === "amount") errors.costAmount = "Not an amount";
  else if ((reading.amount ?? 0) < 0) errors.costAmount = "A price cannot be negative";
  else if (reading.problem === "currency") errors.costCurrency = "Pick one";

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
