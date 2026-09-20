import type { GeoPoint } from "../domain/types";
import { estimateTravel, type TravelEstimate, type TravelMode } from "../geo";
import { distanceM, lerp } from "./geometry";
import { dwellFor, interestsFor } from "./interests";
import type {
  DivertPlan,
  DivertSession,
  DivertSpot,
  GroupRoute,
  RejoinOption,
} from "./types";

/** Points tried along a walking leg, as fractions of it. */
const LEG_SAMPLES = [0.25, 0.5, 0.75];
/** A group will slow down this much for someone waving at them from a side street. */
const INTERCEPT_SLACK_MIN = 3;

/**
 * The two ways back together, given where the group is going and how long
 * the solo traveller wants at their spot. Pure over its inputs, so the same
 * question always gets the same answer and the whole thing is testable.
 */
export function planRejoin(
  route: GroupRoute,
  spot: DivertSpot,
  dwellMinutes: number,
): RejoinOption[] {
  const toSpot = estimateTravel(route.position, spot.point);
  const readyMin = toSpot.minutes + dwellMinutes;

  return [catchUp(route, spot, readyMin), groupDetour(route, spot, toSpot, readyMin)];
}

/** A plan from a stored session, for the screens. */
export function buildPlan(route: GroupRoute, session: DivertSession): DivertPlan {
  const interests = interestsFor(session.interestIds);
  const dwellMinutes = dwellFor(interests);

  return {
    spot: session.spot,
    interests,
    dwellMinutes,
    route,
    options: planRejoin(route, session.spot, dwellMinutes),
  };
}

interface Candidate {
  location: GeoPoint;
  name: string;
  /** Minutes after the clock the group is there; zero when it already is. */
  groupArrive: number;
  /** Minutes after the clock the group has gone past or moved on. */
  groupLeave: number;
  groupDistanceM: number;
  groupMode: TravelMode;
  userArrive: number;
  userDistanceM: number;
  userMode: TravelMode;
  /** A stop on the route, rather than a point along a leg. */
  atStop: boolean;
}

/**
 * The earliest point on what is left of the group's day that the solo
 * traveller can reach before the group has moved on. Stops are tried first
 * since they have names and the group lingers there; walking legs are also
 * sampled, because cutting across to meet them mid-street is often quicker.
 */
function catchUp(route: GroupRoute, spot: DivertSpot, readyMin: number): RejoinOption {
  const { waypoints } = route;
  const candidates: Candidate[] = [];

  const firstAhead = route.atStop ?? route.nextStop;
  const legStart = route.atStop ?? Math.max(0, route.nextStop - 1);

  // Distance along the route from the group's position to each stop, so the
  // group's share of a meeting is measured the way it will walk it.
  const along = new Map<number, number>();
  if (route.atStop !== undefined) {
    along.set(route.atStop, 0);
  } else if (legStart < waypoints.length) {
    const legLength =
      waypoints[legStart + 1] ? distanceM(waypoints[legStart].point, waypoints[legStart + 1].point) : 0;
    along.set(legStart, -route.progress * legLength);
  }
  for (let i = legStart; i < waypoints.length - 1; i++) {
    along.set(i + 1, (along.get(i) ?? 0) + distanceM(waypoints[i].point, waypoints[i + 1].point));
  }

  for (let i = legStart; i < waypoints.length; i++) {
    const stop = waypoints[i];

    if (i >= firstAhead && stop.departMin > 0) {
      const walk = estimateTravel(spot.point, stop.point);
      candidates.push({
        location: stop.point,
        name: stop.name,
        groupArrive: Math.max(0, stop.arriveMin),
        groupLeave: stop.departMin,
        groupDistanceM: Math.max(0, along.get(i) ?? 0),
        groupMode: i === route.atStop ? "walk" : stop.mode,
        userArrive: readyMin + walk.minutes,
        userDistanceM: Math.round(walk.distanceKm * 1000),
        userMode: walk.mode,
        atStop: true,
      });
    }

    const next = waypoints[i + 1];
    if (!next || next.mode !== "walk") continue;

    const legMin = next.arriveMin - stop.departMin;
    if (legMin <= 0) continue;

    const legLength = distanceM(stop.point, next.point);
    const passed = i === legStart && route.atStop === undefined ? route.progress : 0;

    for (const fraction of LEG_SAMPLES) {
      if (fraction <= passed) continue;

      const point = lerp(stop.point, next.point, fraction);
      const groupPass = stop.departMin + fraction * legMin;
      const walk = estimateTravel(spot.point, point);

      candidates.push({
        location: point,
        name: `On the way to ${next.name}`,
        groupArrive: Math.max(0, groupPass),
        groupLeave: groupPass + INTERCEPT_SLACK_MIN,
        groupDistanceM: Math.max(0, (along.get(i) ?? 0) + fraction * legLength),
        groupMode: "walk",
        userArrive: readyMin + walk.minutes,
        userDistanceM: Math.round(walk.distanceKm * 1000),
        userMode: walk.mode,
        atStop: false,
      });
    }
  }

  const meetAt = (candidate: Candidate) => Math.max(candidate.userArrive, candidate.groupArrive);
  const feasible = candidates
    .filter((candidate) => candidate.userArrive <= candidate.groupLeave)
    .sort(
      (a, b) =>
        meetAt(a) - meetAt(b) ||
        Number(b.atStop) - Number(a.atStop) ||
        a.userDistanceM - b.userDistanceM,
    );

  const best = feasible[0];
  if (best) {
    const wait = Math.max(0, best.groupArrive - best.userArrive);
    const note =
      wait > 0
        ? `You would be there ${formatWait(wait)} before the group arrives.`
        : best.atStop
          ? best.groupArrive <= 0
            ? `The group is there until ${formatWait(best.groupLeave)} from now, so walk straight in.`
            : `The group will still be there when you arrive, with ${formatWait(best.groupLeave - best.userArrive)} to spare.`
          : "Cut across and meet them on the street rather than at the next stop.";

    return toOption(best, wait, note, true);
  }

  // Nothing works in time. Say so against the last stop rather than staying silent.
  const fallback = candidates.filter((candidate) => candidate.atStop).at(-1) ?? lastStopCandidate(route, spot, readyMin, along);
  const late = fallback.userArrive - fallback.groupLeave;

  return toOption(
    fallback,
    0,
    `You would reach ${fallback.name} about ${formatWait(late)} after the group moves on. Worth a message before you set off.`,
    false,
  );
}

/** The day's final stop as a candidate, for when the group has already finished. */
function lastStopCandidate(
  route: GroupRoute,
  spot: DivertSpot,
  readyMin: number,
  along: Map<number, number>,
): Candidate {
  const index = route.waypoints.length - 1;
  const stop = route.waypoints[index];
  const walk = estimateTravel(spot.point, stop.point);

  return {
    location: stop.point,
    name: stop.name,
    groupArrive: Math.max(0, stop.arriveMin),
    groupLeave: stop.departMin,
    groupDistanceM: Math.max(0, along.get(index) ?? 0),
    groupMode: stop.mode,
    userArrive: readyMin + walk.minutes,
    userDistanceM: Math.round(walk.distanceKm * 1000),
    userMode: walk.mode,
    atStop: true,
  };
}

function toOption(candidate: Candidate, wait: number, note: string, feasible: boolean): RejoinOption {
  return {
    type: "CATCH_UP",
    location: candidate.location,
    meetingPointName: candidate.name,
    userETA: Math.round(candidate.userArrive),
    groupETA: Math.round(candidate.groupArrive),
    userDistanceM: candidate.userDistanceM,
    groupDistanceM: Math.round(candidate.groupDistanceM),
    waitMinutes: Math.round(wait),
    detourMinutes: 0,
    feasible,
    note,
    userMode: candidate.userMode,
    groupMode: candidate.groupMode,
  };
}

/**
 * The group finishes what it is doing, then comes to the spot instead of
 * carrying on. The cost is measured against its next stop: how much later it
 * gets there, and whether that still leaves any of the visit.
 */
function groupDetour(
  route: GroupRoute,
  spot: DivertSpot,
  toSpot: TravelEstimate,
  readyMin: number,
): RejoinOption {
  const { waypoints } = route;
  const atStop = route.atStop !== undefined ? waypoints[route.atStop] : undefined;
  const next = waypoints[route.nextStop];

  // From a stop the group leaves when it was going to; mid-leg it turns now.
  const leaveMin = atStop ? Math.max(0, atStop.departMin) : 0;
  const groupETA = leaveMin + toSpot.minutes;

  // Everyone moves on together once the later of the two is done.
  const departTogether = Math.max(groupETA, readyMin);

  let detourMinutes = toSpot.minutes;
  let feasible = true;
  let note: string;

  if (next) {
    const onward = estimateTravel(spot.point, next.point).minutes;
    const direct = estimateTravel(route.position, next.point).minutes;
    const arriveNext = departTogether + onward;
    const plannedNext = Math.max(next.arriveMin, leaveMin + direct);

    detourMinutes = Math.max(0, arriveNext - plannedNext);
    feasible = arriveNext <= next.departMin;

    note = !feasible
      ? `They would miss ${next.name} altogether, arriving after it ends.`
      : detourMinutes > 0
        ? `They would reach ${next.name} about ${formatWait(detourMinutes)} later than planned.`
        : `No cost to the day: ${next.name} is on the way.`;
  } else {
    note = "Nothing left on the group's day, so they simply come to you.";
  }

  const spare = groupETA - readyMin;
  const timing =
    spare > 0
      ? ` You would have ${formatWait(spare)} spare after you are done.`
      : spare < 0
        ? ` They would arrive while you are still at it, and can join in.`
        : "";

  return {
    type: "GROUP_DETOUR",
    location: spot.point,
    meetingPointName: spot.name,
    userETA: Math.round(toSpot.minutes),
    groupETA: Math.round(groupETA),
    userDistanceM: Math.round(toSpot.distanceKm * 1000),
    groupDistanceM: Math.round(toSpot.distanceKm * 1000),
    waitMinutes: Math.round(Math.max(0, spare)),
    detourMinutes: Math.round(detourMinutes),
    feasible,
    note: note + timing,
    userMode: toSpot.mode,
    groupMode: toSpot.mode,
  };
}

function formatWait(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
