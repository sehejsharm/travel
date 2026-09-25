import type { AppState } from "../store/state";
import { liveDivertSession } from "./session";
import type { DivertSession, UserGroupStatus } from "./types";

export * from "./types";
export { categoriesFor, DIVERT_INTERESTS, dwellFor, interestsFor } from "./interests";
export { findSpots, gazetteerPoint, SPOT_RADIUS_M } from "./spots";
export { distanceM, lerp, offsetPoint } from "./geometry";
export {
  anchorName,
  buildRoute,
  DEFAULT_DWELL_MIN,
  pickDay,
  routeForGroup,
  stopsFromItems,
} from "./route";
export {
  buildPlan,
  planRejoin,
  progressOf,
  quickestRejoin,
  respot,
  travellerPosition,
  travellerWhereabouts,
  type TravellerProgress,
} from "./rejoin";
export {
  formatDistance,
  formatEta,
  formatMinutes,
  MODE_LABELS,
  NEAR_ENOUGH_M,
  wallClock,
} from "./format";
export { DEMO_GROUP, DEMO_STOPS } from "./mock";
export {
  DIVERT_EXPIRES_MS,
  fittingDivertSession,
  isDivertExpired,
  isDivertSession,
  liveDivertSession,
} from "./session";

/**
 * The stored session, if it belongs to this trip, is well formed and is still
 * current. Anything else reads as no session, never as a crash.
 */
export function activeDivert(
  state: Pick<AppState, "divert">,
  tripId: string,
  now = new Date(),
): DivertSession | undefined {
  const session = liveDivertSession(state.divert, now);
  return session?.tripId === tripId ? session : undefined;
}

export function groupStatus(
  state: Pick<AppState, "divert">,
  tripId: string,
  now = new Date(),
): UserGroupStatus {
  return activeDivert(state, tripId, now) ? "DIVERTED" : "IN_GROUP";
}

/** The name of whoever broke off, when the trip still lists them. */
export function divertedName(
  travelers: { id: string; name: string }[],
  session: Pick<DivertSession, "travelerId">,
): string | undefined {
  return travelers.find((traveler) => traveler.id === session.travelerId)?.name.trim() || undefined;
}
