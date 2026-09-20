import { offsetOf } from "../datetime";
import type { TripItem } from "../domain/types";
import { estimateTravel, type TravelMode } from "../geo";
import { lerp } from "./geometry";
import { DEMO_STOPS } from "./mock";
import type { GroupRoute, GroupWaypoint, RouteStop } from "./types";

/** With no end time filed, this is how long the group is assumed to stay. */
export const DEFAULT_DWELL_MIN = 60;
/** How far into the first stop the stand-in clock sits when the day is not live. */
const SIMULATED_INTO_FIRST_STOP_MIN = 20;
/** Beyond this either side of the day, "now" is not a useful clock for it. */
const LIVE_SLACK_MIN = 30;

/** Bookings that move the group between days or cities, not stops on a walk. */
const NOT_STOPS = new Set(["flight", "lodging", "rail", "car"]);

/** The stops a group actually moves between: timed, placed, and not a flight or a bed. */
export function stopsFromItems(items: TripItem[]): RouteStop[] {
  return items
    .filter(
      (item) =>
        item.startsAt &&
        item.place?.point &&
        !(item.bookingKind && NOT_STOPS.has(item.bookingKind)),
    )
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))
    .map((item) => ({
      id: item.id,
      name: item.title,
      point: item.place!.point!,
      startsAt: item.startsAt!,
      endsAt: item.endsAt,
    }));
}

function localDateKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Which day's stops to plan around: today's when there are any, otherwise the
 * nearest day ahead with somewhere to go between, so the route has a shape.
 * Once the trip is over, the most recent day, for looking back.
 */
export function pickDay(stops: RouteStop[], now: Date): RouteStop[] {
  const byDay = new Map<string, RouteStop[]>();
  for (const stop of stops) {
    const day = stop.startsAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), stop]);
  }
  if (byDay.size === 0) return [];

  const today = localDateKey(now);
  const todays = byDay.get(today);
  if (todays?.length) return todays;

  const days = [...byDay.keys()].sort();
  const ahead = days.filter((day) => day > today);
  const pool = ahead.length > 0 ? ahead : [...days].reverse();
  const chosen = pool.find((day) => byDay.get(day)!.length >= 2) ?? pool[0];

  return byDay.get(chosen)!;
}

/**
 * Turns a day's stops into a timeline the group can be placed on. Filed times
 * are honoured where they are consistent; where the next stop starts before
 * the group could get there, the group arrives when it arrives.
 */
export function buildRoute(
  stops: RouteStop[],
  now: Date,
  options: { demo?: boolean } = {},
): GroupRoute | undefined {
  if (stops.length === 0) return undefined;

  const arrive: number[] = [];
  const depart: number[] = [];
  const modes: TravelMode[] = [];

  for (let i = 0; i < stops.length; i++) {
    const scheduledStart = Date.parse(stops[i].startsAt);
    const scheduledEnd = stops[i].endsAt ? Date.parse(stops[i].endsAt!) : Number.NaN;

    let mode: TravelMode = "walk";
    let earliest = scheduledStart;

    if (i > 0) {
      const travel = estimateTravel(stops[i - 1].point, stops[i].point);
      mode = travel.mode;
      earliest = Math.max(scheduledStart, depart[i - 1] + travel.minutes * 60_000);
    }

    arrive.push(earliest);
    depart.push(
      Number.isNaN(scheduledEnd)
        ? earliest + DEFAULT_DWELL_MIN * 60_000
        : Math.max(scheduledEnd, earliest),
    );
    modes.push(mode);
  }

  // The clock is now while the day is live; otherwise it sits partway into
  // the first stop, so the group is somewhere rather than nowhere yet.
  const first = arrive[0];
  const last = depart[depart.length - 1];
  const slack = LIVE_SLACK_MIN * 60_000;
  const live = now.getTime() >= first - slack && now.getTime() <= last + slack;
  const clockMs = live
    ? now.getTime()
    : Math.min(first + SIMULATED_INTO_FIRST_STOP_MIN * 60_000, depart[0]);

  const waypoints: GroupWaypoint[] = stops.map((stop, i) => ({
    id: stop.id,
    name: stop.name,
    point: stop.point,
    arriveMin: (arrive[i] - clockMs) / 60_000,
    departMin: (depart[i] - clockMs) / 60_000,
    mode: modes[i],
  }));

  return {
    waypoints,
    ...locate(waypoints),
    clock: new Date(clockMs),
    offset: offsetOf(stops[0].startsAt) || "+00:00",
    simulated: !live,
    demo: Boolean(options.demo),
  };
}

/** Where along its day the group is at the clock, and how to say so. */
function locate(
  waypoints: GroupWaypoint[],
): Pick<GroupRoute, "position" | "atStop" | "nextStop" | "progress" | "nowLabel"> {
  const last = waypoints.length - 1;

  if (waypoints[0].arriveMin > 0) {
    return {
      position: waypoints[0].point,
      nextStop: 0,
      progress: 0,
      nowLabel: `Setting off for ${waypoints[0].name}`,
    };
  }

  for (let i = 0; i <= last; i++) {
    const stop = waypoints[i];

    if (stop.arriveMin <= 0 && stop.departMin >= 0) {
      return {
        position: stop.point,
        atStop: i,
        nextStop: i + 1,
        progress: 0,
        nowLabel: i === last ? `At ${stop.name}, the last stop of the day` : `At ${stop.name}`,
      };
    }

    const next = waypoints[i + 1];
    if (next && stop.departMin < 0 && next.arriveMin > 0) {
      const progress = -stop.departMin / (next.arriveMin - stop.departMin);
      return {
        position: lerp(stop.point, next.point, progress),
        nextStop: i + 1,
        progress,
        nowLabel: `On the way to ${next.name}`,
      };
    }
  }

  return {
    position: waypoints[last].point,
    atStop: last,
    nextStop: last + 1,
    progress: 0,
    nowLabel: `Finished for the day at ${waypoints[last].name}`,
  };
}

/**
 * The group's route for this trip: its own timeline when it has timed,
 * located stops, and the bundled sample walk when it has none yet.
 */
export function routeForGroup(items: TripItem[], now = new Date()): GroupRoute {
  const own = pickDay(stopsFromItems(items), now);
  if (own.length > 0) return buildRoute(own, now)!;
  return buildRoute(DEMO_STOPS, now, { demo: true })!;
}
