import type { BookingKind, ItemCategory, PlaceRef } from "../domain/types";
import { getAirport } from "../reference/airports";
import { getCountry } from "../reference/countries";
import { groundPlace } from "../reference/places";
import {
  findConfirmationCode,
  findDates,
  findFlight,
  findMoney,
  findRefundDeadline,
  findTravelerName,
  toIso,
  type FoundDate,
} from "./patterns";
import type { ExtractionInput, ExtractionResult, ItemDraft } from "./types";

const BOOKING_WORDS =
  /\b(booking|booked|reservation|confirmed|confirmation|e-?ticket|boarding|check-?in|check-?out|itinerary|pnr)\b/i;
const LODGING_WORDS = /\b(hotel|hostel|ryokan|guesthouse|apartment|airbnb|check-?in|check-?out|nights?)\b/i;
const RAIL_WORDS = /\b(shinkansen|train|rail|jr pass|platform)\b/i;
const PURCHASE_WORDS = /\b(buy|bought|shop|shopping|souvenir|pack|packing|store|pick up)\b/i;
const ACTIVITY_WORDS =
  /\b(tour|class|workshop|experience|ticket|entry|admission|museum|show|onsen|cooking|hike|walk)\b/i;

function classify(text: string): { category: ItemCategory; bookingKind?: BookingKind } {
  const isFlight = Boolean(findFlight(text)) && /\b(flight|depart|arriv|boarding|pnr|airline)\b/i.test(text);

  if (isFlight) return { category: "booking", bookingKind: "flight" };
  if (LODGING_WORDS.test(text) && BOOKING_WORDS.test(text)) {
    return { category: "booking", bookingKind: "lodging" };
  }
  if (RAIL_WORDS.test(text) && BOOKING_WORDS.test(text)) {
    return { category: "booking", bookingKind: "rail" };
  }
  if (PURCHASE_WORDS.test(text)) return { category: "purchase" };
  if (ACTIVITY_WORDS.test(text)) return { category: "activity" };
  return { category: "place" };
}

function deriveTitle(text: string, place?: PlaceRef): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 2);

  const cleaned = firstLine
    ?.replace(/^(subject|re|fwd):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned && cleaned.length <= 70) return cleaned;
  if (place) return place.name;
  return cleaned?.slice(0, 67).concat("…") ?? "Untitled item";
}

function airportPlace(code?: string): PlaceRef | undefined {
  const airport = getAirport(code);
  if (!airport) return undefined;
  return {
    name: airport.name,
    city: airport.city,
    countryCode: airport.countryCode,
    point: airport.point,
    airport: airport.iata,
  };
}

function offsetFor(place?: PlaceRef): number | undefined {
  return getCountry(place?.countryCode)?.utcOffset;
}

function checkInOutDates(text: string, dates: FoundDate[]): FoundDate[] {
  const labelled = (label: RegExp): FoundDate | undefined => {
    const match = text.match(label);
    if (!match) return undefined;
    return dates.find((date) => date.index >= match.index!);
  };

  const checkIn = labelled(/check-?in/i);
  const checkOut = labelled(/check-?out/i);
  if (checkIn && checkOut && checkIn !== checkOut) return [checkIn, checkOut];
  return dates;
}

export function extractDeterministic(input: ExtractionInput): ExtractionResult {
  const { text, source, sourceRef } = input;
  const today = input.today ?? new Date();
  const found: string[] = [];

  const { category, bookingKind } = classify(text);
  const flight = bookingKind === "flight" ? findFlight(text) : undefined;

  let place = groundPlace(text);
  let arrivalPlace: PlaceRef | undefined;

  if (flight) {
    place = airportPlace(flight.from) ?? place;
    arrivalPlace = airportPlace(flight.to);
    if (place) found.push("route");
  } else if (place) {
    found.push("place");
  }

  const allDates = findDates(text, today.getFullYear());
  const dates = bookingKind === "lodging" ? checkInOutDates(text, allDates) : allDates;
  if (dates.length > 0) found.push("dates");

  const startOffset = offsetFor(place);
  const endOffset = offsetFor(arrivalPlace ?? place);
  const startsAt = dates[0] ? toIso(dates[0], startOffset) : undefined;
  const endsAt = dates[1] ? toIso(dates[1], endOffset) : undefined;

  const cost = findMoney(text);
  if (cost) found.push("cost");

  const confirmationCode = findConfirmationCode(text);
  if (confirmationCode) found.push("confirmation");

  const travelerName = findTravelerName(text);
  if (travelerName) found.push("traveller");

  const refund = findRefundDeadline(text, today.getFullYear());
  if (refund.iso) found.push("refund deadline");

  const title = flight
    ? `${flight.flightNumber}${flight.from && flight.to ? ` ${flight.from} → ${flight.to}` : ""}`
    : deriveTitle(text, place);

  const draft: ItemDraft = {
    title,
    category,
    bookingKind,
    source,
    sourceRef,
    place,
    arrivalPlace,
    startsAt,
    endsAt,
    cost,
    costStatus: cost ? (category === "booking" ? "actual" : "estimated") : undefined,
    confirmationCode,
    travelerName,
    refundableUntil: refund.iso,
    notes: refund.nonRefundable ? "Marked non-refundable in the source." : undefined,
  };

  return {
    draft,
    confidence: score({ category, found, ambiguous: dates.some((date) => date.ambiguous) }),
    method: "deterministic",
    foundFields: found,
  };
}

function score({
  category,
  found,
  ambiguous,
}: {
  category: ItemCategory;
  found: string[];
  ambiguous: boolean;
}): number {
  let confidence = 0.25;
  if (category === "booking") confidence += 0.1;
  if (found.includes("route")) confidence += 0.2;
  if (found.includes("place")) confidence += 0.15;
  if (found.includes("dates")) confidence += 0.15;
  if (found.includes("cost")) confidence += 0.1;
  if (found.includes("confirmation")) confidence += 0.1;
  if (found.includes("traveller")) confidence += 0.05;
  if (ambiguous) confidence -= 0.1;

  return Math.max(0.05, Math.min(0.95, Number(confidence.toFixed(2))));
}
