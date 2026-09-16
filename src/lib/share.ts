import type { Trip, TripItem } from "./domain/types";

/**
 * A shared trip travels inside the URL fragment, which browsers never send to
 * a server. The link works with no account and no backend, and the trip stays
 * between the people who have the link.
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
  trip: Trip;
  items: TripItem[];
}

/** Only the plan travels — prices and confirmation numbers are left behind. */
function stripPrivate(trip: Trip, items: TripItem[]): SharedTrip {
  return {
    trip,
    items: items.map((item) => ({
      ...item,
      cost: undefined,
      costStatus: undefined,
      confirmationCode: undefined,
      travelerName: undefined,
      refundableUntil: undefined,
    })),
  };
}

export async function encodeTrip(trip: Trip, items: TripItem[]): Promise<string> {
  const json = JSON.stringify(stripPrivate(trip, items));
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

export async function decodeTrip(token: string): Promise<SharedTrip | undefined> {
  try {
    const bytes = fromBase64Url(token);
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const json = new TextDecoder().decode(await collect(stream));
    const parsed = JSON.parse(json) as Partial<SharedTrip>;

    if (!parsed.trip || !Array.isArray(parsed.items)) return undefined;
    return { trip: parsed.trip, items: parsed.items };
  } catch {
    return undefined;
  }
}
