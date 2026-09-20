import type { AppState } from "../store/state";
import type { DivertSession, UserGroupStatus } from "./types";

export * from "./types";
export { DIVERT_INTERESTS, dwellFor, getDivertInterest, interestsFor } from "./interests";
export { findSpots, SPOT_RADIUS_M } from "./spots";
export { distanceM, lerp, offsetPoint } from "./geometry";
export {
  buildRoute,
  DEFAULT_DWELL_MIN,
  pickDay,
  routeForGroup,
  stopsFromItems,
} from "./route";
export { buildPlan, planRejoin } from "./rejoin";
export { formatDistance, formatEta, formatMinutes, MODE_LABELS, wallClock } from "./format";
export { DEMO_GROUP, DEMO_STOPS } from "./mock";

/** A diversion nobody ended is over by the next morning, not still running. */
export const DIVERT_EXPIRES_MS = 12 * 60 * 60 * 1000;

/**
 * The stored session, if it belongs to this trip and is still current. A
 * session with no usable spot (a hand-edited store, an older shape) reads as
 * no session, never as a crash.
 */
export function activeDivert(
  state: Pick<AppState, "divert">,
  tripId: string,
  now = new Date(),
): DivertSession | undefined {
  const session = state.divert;
  if (!session || session.tripId !== tripId || !session.spot?.point) return undefined;

  const started = Date.parse(session.startedAt);
  if (Number.isNaN(started) || now.getTime() - started > DIVERT_EXPIRES_MS) return undefined;

  return session;
}

export function groupStatus(
  state: Pick<AppState, "divert">,
  tripId: string,
  now = new Date(),
): UserGroupStatus {
  return activeDivert(state, tripId, now) ? "DIVERTED" : "IN_GROUP";
}
