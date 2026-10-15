import type { PlaceRef, Trip, TripItem } from "./domain/types";

/**
 * A shared trip travels inside the URL fragment, which browsers never send to
 * a server. The link works with no account and no backend, and the trip stays
 * between the people who have the link. What goes into it is the plan only:
 * see stripPrivate below, which the privacy policy describes field for field.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export interface SharedTrip {
  /**
   * The trip as a link carries it. `travelers` is always empty: who is going,
   * and their passports, insurance and visa needs, never leave the sender's
   * device. `travellerCount` is all the reader learns about them.
   */
  trip: Trip;
  items: TripItem[];
  /** How many people are going, and nothing else about them. */
  travellerCount: number;
}

/**
 * The plan travels; the paperwork and the people stay home. Each field is
 * picked by name rather than everything copied and some removed, so a field
 * added to Trip or TripItem later stays out of links until someone decides it
 * belongs in one.
 *
 * Left behind: traveller names, passport countries and expiries, insurance
 * dates, visa help and where each person flies from; the budget target, the
 * trip's interests and purpose; and from every item its notes, price,
 * confirmation number, traveller name, refund deadline, source link and who
 * filed it. Stays are left behind whole: the shared page never shows them, and
 * a hotel's exact point is where the group sleeps.
 */
function stripPrivate(trip: Trip, items: TripItem[], travellerCount: number): SharedTrip {
  return {
    trip: shareTrip(trip),
    items: items.filter((item) => item.bookingKind !== "lodging").map(shareItem),
    travellerCount,
  };
}

function sharePlace(place: PlaceRef | undefined): PlaceRef | undefined {
  if (!place) return undefined;
  const { name, city, countryCode, point, airport } = place;
  return { name, city, countryCode, point: point && { lat: point.lat, lng: point.lng }, airport };
}

function shareTrip(trip: Trip): Trip {
  return {
    id: trip.id,
    name: trip.name,
    // Kept so the home country is not mistaken for a destination.
    homeCountry: trip.homeCountry,
    destinationCountries: trip.destinationCountries,
    startDate: trip.startDate,
    endDate: trip.endDate,
    datesTbd: trip.datesTbd,
    legs: trip.legs?.map(({ id, countryCode, city, startDate, endDate }) => ({
      id,
      countryCode,
      city,
      startDate,
      endDate,
    })),
    travelers: [],
  };
}

function shareItem(item: TripItem): TripItem {
  return {
    id: item.id,
    tripId: item.tripId,
    title: item.title,
    category: item.category,
    bookingKind: item.bookingKind,
    source: item.source,
    place: sharePlace(item.place),
    arrivalPlace: sharePlace(item.arrivalPlace),
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    confidence: item.confidence,
    extractionMethod: item.extractionMethod,
    createdAt: item.createdAt,
  };
}

export async function encodeTrip(trip: Trip, items: TripItem[]): Promise<string> {
  const json = JSON.stringify(stripPrivate(trip, items, trip.travelers.length));
  const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return toBase64Url(await collect(compressed));
}

/**
 * Where a URL stops being reliably shareable. Browsers themselves cope with
 * far more, but a link is only useful if the thing you paste it into keeps it
 * whole, and plenty of chat clients, link previewers, proxies and QR encoders
 * give up well before the browser would.
 */
export const SAFE_URL_LENGTH = 2000;
/** Past here it will not survive being pasted anywhere worth pasting it. */
export const MAX_URL_LENGTH = 8000;

export type ShareSize = "safe" | "risky" | "too-big";

export interface ShareLink {
  url: string;
  size: ShareSize;
  length: number;
  /** Set when the link only carries part of the trip. */
  trimmedTo?: number;
}

/** Only the scheduled items, for a trip too big to send whole. */
function trim(items: TripItem[]): TripItem[] {
  return items.filter((item) => item.startsAt);
}

/**
 * Builds the shareable URL, shrinking the payload rather than handing back a
 * link that silently breaks. A trip big enough to fail is exactly the trip
 * somebody most wants to send.
 */
export async function buildShareLink(
  trip: Trip,
  items: TripItem[],
  origin: string,
): Promise<ShareLink> {
  const base = `${origin}/share#`;

  const full = `${base}${await encodeTrip(trip, items)}`;
  if (full.length <= SAFE_URL_LENGTH) {
    return { url: full, size: "safe", length: full.length };
  }

  const scheduled = trim(items);
  if (scheduled.length < items.length) {
    const trimmed = `${base}${await encodeTrip(trip, scheduled)}`;
    if (trimmed.length <= SAFE_URL_LENGTH) {
      return {
        url: trimmed,
        size: "safe",
        length: trimmed.length,
        trimmedTo: scheduled.length,
      };
    }
  }

  return {
    url: full,
    size: full.length > MAX_URL_LENGTH ? "too-big" : "risky",
    length: full.length,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Enough of a trip to draw the page without throwing. A link is anyone's to edit. */
const optionalString = (value: unknown) => value === undefined || typeof value === "string";

/** Enough of a trip, of the right types, to draw the page without throwing. */
function isTrip(value: unknown): value is Trip {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    typeof value.homeCountry === "string" &&
    typeof value.startDate === "string" &&
    typeof value.endDate === "string" &&
    (value.destinationCountries === undefined ||
      (Array.isArray(value.destinationCountries) &&
        value.destinationCountries.every((code) => typeof code === "string"))) &&
    (value.legs === undefined ||
      (Array.isArray(value.legs) &&
        value.legs.every((leg) => isObject(leg) && typeof leg.countryCode === "string")))
  );
}

function isPlace(value: unknown): boolean {
  return (
    value === undefined ||
    (isObject(value) && typeof value.name === "string" && optionalString(value.countryCode))
  );
}

function isItem(value: unknown): value is TripItem {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.category === "string" &&
    optionalString(value.startsAt) &&
    optionalString(value.endsAt) &&
    isPlace(value.place) &&
    isPlace(value.arrivalPlace)
  );
}

export async function decodeTrip(token: string): Promise<SharedTrip | undefined> {
  try {
    const bytes = fromBase64Url(token);
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const json = new TextDecoder().decode(await collect(stream));
    const parsed: unknown = JSON.parse(json);

    if (!isObject(parsed) || !isTrip(parsed.trip) || !Array.isArray(parsed.items)) {
      return undefined;
    }

    // Links made before names were stripped still carry the whole traveller
    // list. They open, and go through the same filter, so an old link shows
    // no more than a new one.
    const counted = parsed.travellerCount;
    const travellerCount =
      typeof counted === "number" && Number.isInteger(counted) && counted >= 0
        ? counted
        : Array.isArray(parsed.trip.travelers)
          ? parsed.trip.travelers.length
          : 0;

    return stripPrivate(parsed.trip, parsed.items.filter(isItem), travellerCount);
  } catch {
    return undefined;
  }
}
