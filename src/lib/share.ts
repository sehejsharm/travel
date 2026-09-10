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
