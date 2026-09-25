import type { GeoPoint, Trip } from "../domain/types";
import type { DivertSession } from "./types";

/**
 * Checks on a stored diversion. A leaf module on purpose: the store imports
 * it, so it must not import anything that imports the store.
 */

/** A diversion nobody ended is over by the next morning, not still running. */
export const DIVERT_EXPIRES_MS = 12 * 60 * 60 * 1000;

function isPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

/**
 * Whether something read back from storage is a diversion this build can
 * use. A hand-edited store, or one written by another version, reads as no
 * diversion rather than crashing the trip screen on every load.
 */
export function isDivertSession(value: unknown): value is DivertSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  const spot = session.spot as Record<string, unknown> | undefined;

  return (
    typeof session.tripId === "string" &&
    typeof session.startedAt === "string" &&
    !Number.isNaN(Date.parse(session.startedAt)) &&
    Array.isArray(session.interestIds) &&
    session.interestIds.every((id) => typeof id === "string") &&
    (session.travelerId === undefined || typeof session.travelerId === "string") &&
    (session.from === undefined || isPoint(session.from)) &&
    (session.fromAt === undefined ||
      (typeof session.fromAt === "string" && !Number.isNaN(Date.parse(session.fromAt)))) &&
    (session.chosen === undefined || session.chosen === "CATCH_UP" || session.chosen === "GROUP_DETOUR") &&
    !!spot &&
    typeof spot === "object" &&
    typeof spot.id === "string" &&
    typeof spot.name === "string" &&
    isPoint(spot.point)
  );
}

export function isDivertExpired(session: DivertSession, now: Date): boolean {
  return now.getTime() - Date.parse(session.startedAt) > DIVERT_EXPIRES_MS;
}

/** The stored session if it is well formed and still current, otherwise nothing. */
export function liveDivertSession(value: unknown, now: Date): DivertSession | undefined {
  return isDivertSession(value) && !isDivertExpired(value, now) ? value : undefined;
}

/**
 * The stored session if it is well formed and still has a group to come back
 * to: its trip exists, has at least two people on it, and still lists whoever
 * broke off. The store applies this on every write, so deleting the trip,
 * removing the traveller or restoring an older copy of the trip all end a
 * diversion that no longer makes sense, without each of them having to know.
 * Expiry is checked on load and on use instead, where "now" is the real now.
 */
export function fittingDivertSession(value: unknown, trips: Trip[]): DivertSession | undefined {
  if (!isDivertSession(value)) return undefined;

  const trip = trips.find((candidate) => candidate.id === value.tripId);
  if (!trip || trip.travelers.length < 2) return undefined;
  if (value.travelerId && !trip.travelers.some((traveler) => traveler.id === value.travelerId)) {
    return undefined;
  }

  return value;
}
