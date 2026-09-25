import type { GeoPoint } from "../domain/types";
import { estimateTravel, type TravelMode } from "../geo";
import { formatMinutes } from "./format";
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

/** How far into their own diversion the solo traveller is. */
export interface TravellerProgress {
  /** Minutes since they set off toward the spot. */
  elapsedMin: number;
  /** Where they set off from; the group's position when not given. */
  origin?: GeoPoint;
}

interface Traveller {
  /** Minutes until they are done at the spot and free to move. */
  readyMin: number;
  /** What is left of the trip out to the spot. */
  toSpotMin: number;
  toSpotM: number;
  toSpotMode: TravelMode;
}

/**
 * Where the traveller stands in their diversion: still heading out, at the
 * spot with some of their time left, or done. Time already spent comes off
 * the walk first and then off the stay, so an ETA left on screen counts down.
 */
function travellerAt(
  route: GroupRoute,
  spot: DivertSpot,
  dwellMinutes: number,
  progress: TravellerProgress,
): Traveller {
  const origin = progress.origin ?? route.position;
  const walk = estimateTravel(origin, spot.point);
  const elapsed = Math.max(0, progress.elapsedMin);

  const walkLeft = Math.max(0, walk.minutes - elapsed);
  const stayLeft = Math.max(0, dwellMinutes - Math.max(0, elapsed - walk.minutes));

  return {
    readyMin: walkLeft + stayLeft,
    toSpotMin: walkLeft,
    toSpotM: Math.round(distanceM(origin, spot.point) * (walkLeft / walk.minutes)),
    toSpotMode: walk.mode,
  };
}

/**
 * The two ways back together, given where the group is going, how long the
 * solo traveller wants at their spot, and how far into that they already
 * are. Pure over its inputs, so the same question always gets the same
 * answer and the whole thing is testable.
 */
export function planRejoin(
  route: GroupRoute,
  spot: DivertSpot,
  dwellMinutes: number,
  progress: TravellerProgress = { elapsedMin: 0 },
): RejoinOption[] {
  const traveller = travellerAt(route, spot, dwellMinutes, progress);
  return [catchUp(route, spot, traveller.readyMin), groupDetour(route, spot, traveller)];
}

/**
 * How far into the diversion the traveller is, by the route's clock. A
 * simulated clock is not now, so nothing has elapsed on it.
 */
export function progressOf(route: GroupRoute, session: DivertSession): TravellerProgress {
  const setOff = Date.parse(session.fromAt ?? session.startedAt);
  const elapsedMin =
    route.simulated || Number.isNaN(setOff)
      ? 0
      : Math.max(0, (route.clock.getTime() - setOff) / 60_000);

  return { elapsedMin, origin: session.from };
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
    options: planRejoin(route, session.spot, dwellMinutes, progressOf(route, session)),
  };
}

/** Where the traveller probably is now: partway out, or at the spot. */
export function travellerPosition(route: GroupRoute, session: DivertSession): GeoPoint {
  const { elapsedMin, origin } = progressOf(route, session);
  const from = origin ?? route.position;
  const walk = estimateTravel(from, session.spot.point).minutes;

  return elapsedMin >= walk ? session.spot.point : lerp(from, session.spot.point, elapsedMin / walk);
}

/**
 * Changing spot mid-diversion. The new walk starts from wherever the
 * traveller is now, and the rendezvous they had picked no longer applies.
 */
export function respot(
  route: GroupRoute,
  session: DivertSession,
  spot: DivertSpot,
): Pick<DivertSession, "spot" | "from" | "fromAt" | "chosen"> {
  return {
    spot,
    from: travellerPosition(route, session),
    fromAt: route.simulated ? session.fromAt : route.clock.toISOString(),
    chosen: undefined,
  };
}

/**
 * The option to lead with when none has been picked: one that works, then
 * whichever gets everyone together soonest, then the catch-up, which costs
 * the group nothing.
 */
export function quickestRejoin(options: RejoinOption[]): RejoinOption {
  const together = (option: RejoinOption) => Math.max(option.userETA, option.groupETA);
  return [...options].sort(
    (a, b) =>
      Number(b.feasible) - Number(a.feasible) ||
      together(a) - together(b) ||
      (a.type === "CATCH_UP" ? -1 : 1),
  )[0];
}

type ModeTally = Partial<Record<TravelMode, number>>;

function tally(counts: ModeTally, mode: TravelMode, metres: number): ModeTally {
  return { ...counts, [mode]: (counts[mode] ?? 0) + metres };
}

/** The mode most of a multi-leg distance is covered by. */
function dominantMode(counts: ModeTally): TravelMode {
  let best: TravelMode = "walk";
  let most = 0;
  for (const [mode, metres] of Object.entries(counts) as [TravelMode, number][]) {
    if (metres > most) {
      best = mode;
      most = metres;
    }
  }
  return best;
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
 * sampled over the time the group is actually on them, because cutting
 * across to meet them mid-street is often quicker.
 */
function catchUp(route: GroupRoute, spot: DivertSpot, readyMin: number): RejoinOption {
  const { waypoints } = route;
  const candidates: Candidate[] = [];

  const firstAhead = route.atStop ?? route.nextStop;
  const legStart = route.atStop ?? Math.max(0, route.nextStop - 1);

  // Distance along the route from the group to each stop, and by which modes
  // it is covered, so the group's share of a meeting reads the way it travels.
  const along = new Map<number, number>();
  const modes = new Map<number, ModeTally>();
  const nextLeg = waypoints[legStart + 1];
  if (route.atStop !== undefined || !nextLeg) {
    along.set(legStart, 0);
    modes.set(legStart, {});
  } else {
    const covered = route.progress * distanceM(waypoints[legStart].point, nextLeg.point);
    along.set(legStart, -covered);
    modes.set(legStart, { [nextLeg.mode]: -covered });
  }
  for (let i = legStart; i < waypoints.length - 1; i++) {
    const metres = distanceM(waypoints[i].point, waypoints[i + 1].point);
    along.set(i + 1, along.get(i)! + metres);
    modes.set(i + 1, tally(modes.get(i)!, waypoints[i + 1].mode, metres));
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
        groupMode: dominantMode(modes.get(i) ?? {}),
        userArrive: readyMin + walk.minutes,
        userDistanceM: distanceM(spot.point, stop.point),
        userMode: walk.mode,
        atStop: true,
      });
    }

    const next = waypoints[i + 1];
    if (!next || next.mode !== "walk" || next.travelMin <= 0) continue;

    const legLength = distanceM(stop.point, next.point);
    const passed = i === legStart && route.atStop === undefined ? route.progress : 0;

    for (const fraction of LEG_SAMPLES) {
      if (fraction <= passed) continue;

      const point = lerp(stop.point, next.point, fraction);
      const groupPass = stop.departMin + fraction * next.travelMin;
      const walk = estimateTravel(spot.point, point);

      candidates.push({
        location: point,
        name: `On the way to ${next.name}`,
        groupArrive: Math.max(0, groupPass),
        groupLeave: groupPass + INTERCEPT_SLACK_MIN,
        groupDistanceM: Math.max(0, (along.get(i) ?? 0) + fraction * legLength),
        groupMode: "walk",
        userArrive: readyMin + walk.minutes,
        userDistanceM: distanceM(spot.point, point),
        userMode: walk.mode,
        atStop: false,
      });
    }
  }

  const meetAt = (candidate: Candidate) => Math.max(candidate.userArrive, candidate.groupArrive);
  const best = candidates
    .filter((candidate) => candidate.userArrive <= candidate.groupLeave)
    .sort(
      (a, b) =>
        meetAt(a) - meetAt(b) ||
        Number(b.atStop) - Number(a.atStop) ||
        a.userDistanceM - b.userDistanceM,
    )[0];

  if (best) {
    // Round once, and write the note from the same numbers the card shows.
    const userETA = Math.round(best.userArrive);
    const groupETA = Math.round(best.groupArrive);
    const wait = Math.max(0, groupETA - userETA);
    const spare = Math.round(best.groupLeave) - userETA;

    const note =
      wait > 0
        ? `You would be there ${formatMinutes(wait)} before the group arrives.`
        : !best.atStop
          ? "Cut across and meet them on the street rather than at the next stop."
          : groupETA <= 0
            ? `The group is there for another ${formatMinutes(best.groupLeave)}, so walk straight in.`
            : spare > 0
              ? `The group will still be there when you arrive, with ${formatMinutes(spare)} to spare.`
              : "The group will still be there when you arrive, just.";

    return toOption(best, { userETA, groupETA, wait, feasible: true, note });
  }

  // Nothing works in time. Say so against a stop rather than staying silent.
  const fallback =
    candidates.filter((candidate) => candidate.atStop).at(-1) ??
    lastStopCandidate(route, spot, readyMin, along.get(waypoints.length - 1) ?? 0, modes.get(waypoints.length - 1) ?? {});
  const userETA = Math.round(fallback.userArrive);
  const late = userETA - Math.round(fallback.groupLeave);

  const note =
    route.phase === "finished"
      ? "The group's day is over, so there is no stop left to meet them at. Message them to find out where they are."
      : late > 0
        ? `You would reach ${fallback.name} about ${formatMinutes(late)} after the group moves on. Worth messaging them.`
        : `You would reach ${fallback.name} just as the group moves on. Worth messaging them.`;

  return {
    ...toOption(fallback, {
      userETA,
      groupETA: Math.round(fallback.groupArrive),
      wait: 0,
      feasible: false,
      note,
    }),
    groupLeaveMin: Math.round(fallback.groupLeave),
  };
}

/** The day's final stop as a candidate, for when every stop is already behind the group. */
function lastStopCandidate(
  route: GroupRoute,
  spot: DivertSpot,
  readyMin: number,
  alongMetres: number,
  counts: ModeTally,
): Candidate {
  const stop = route.waypoints[route.waypoints.length - 1];
  const walk = estimateTravel(spot.point, stop.point);

  return {
    location: stop.point,
    name: stop.name,
    groupArrive: Math.max(0, stop.arriveMin),
    groupLeave: stop.departMin,
    groupDistanceM: Math.max(0, alongMetres),
    groupMode: dominantMode(counts),
    userArrive: readyMin + walk.minutes,
    userDistanceM: distanceM(spot.point, stop.point),
    userMode: walk.mode,
    atStop: true,
  };
}

function toOption(
  candidate: Candidate,
  shown: { userETA: number; groupETA: number; wait: number; feasible: boolean; note: string },
): RejoinOption {
  return {
    type: "CATCH_UP",
    location: candidate.location,
    meetingPointName: candidate.name,
    userETA: shown.userETA,
    groupETA: shown.groupETA,
    userDistanceM: candidate.userDistanceM,
    groupDistanceM: Math.round(candidate.groupDistanceM),
    waitMinutes: shown.wait,
    detourMinutes: 0,
    feasible: shown.feasible,
    note: shown.note,
    userMode: candidate.userMode,
    groupMode: candidate.groupMode,
  };
}

/**
 * The group finishes what it is doing, then comes to the spot instead of
 * carrying on. The cost is measured against its next stop: how much later it
 * gets there, and whether that still leaves any of the visit.
 */
function groupDetour(route: GroupRoute, spot: DivertSpot, traveller: Traveller): RejoinOption {
  const { waypoints } = route;
  const atStop = route.phase === "at-stop" ? waypoints[route.atStop!] : undefined;
  const next = waypoints[route.nextStop];
  const trip = estimateTravel(route.position, spot.point);

  // From a stop the group leaves when it was going to; otherwise it turns now.
  const leaveMin = atStop ? Math.max(0, atStop.departMin) : 0;
  const groupArrive = leaveMin + trip.minutes;

  // Everyone moves on together once the later of the two is done.
  const departTogether = Math.max(groupArrive, traveller.readyMin);

  let detourMinutes = 0;
  let feasible = true;
  let note: string;

  if (next) {
    const onward = estimateTravel(spot.point, next.point).minutes;
    const direct = estimateTravel(route.position, next.point).minutes;
    const arriveNext = departTogether + onward;
    const plannedNext = Math.max(next.arriveMin, leaveMin + direct);

    detourMinutes = Math.max(0, Math.round(arriveNext - plannedNext));
    feasible = arriveNext <= next.departMin;

    note = !feasible
      ? `They would miss ${next.name} altogether, arriving after it ends.`
      : detourMinutes > 0
        ? `They would reach ${next.name} about ${formatMinutes(detourMinutes)} later than planned.`
        : `No cost to the day: they still reach ${next.name} on time.`;
  } else if (route.phase === "finished") {
    note = "The group's day is over, so coming to you costs it nothing.";
  } else {
    note = "Nothing left on the group's day after this, so they simply come to you.";
  }

  const userETA = Math.round(traveller.toSpotMin);
  const groupETA = Math.round(groupArrive);
  const spare = groupETA - Math.round(traveller.readyMin);
  const timing =
    spare > 0
      ? ` You would have ${formatMinutes(spare)} spare after you are done.`
      : spare < 0
        ? " They would arrive while you are still at it, and can join in."
        : "";

  return {
    type: "GROUP_DETOUR",
    location: spot.point,
    meetingPointName: spot.name,
    userETA,
    groupETA,
    userDistanceM: traveller.toSpotM,
    groupDistanceM: distanceM(route.position, spot.point),
    waitMinutes: Math.max(0, spare),
    detourMinutes,
    feasible,
    note: note + timing,
    userMode: traveller.toSpotMode,
    groupMode: trip.mode,
  };
}
