import { dateAt, offsetOf } from "../datetime";
import type { TripItem } from "../domain/types";
import { estimateTravel, type TravelEstimate } from "../geo";
import { formatTime, hasDate, localDateKey } from "../rules/shared";
import { lerp } from "./geometry";
import { DEMO_STOPS } from "./mock";
import type { GroupPhase, GroupRoute, GroupWaypoint, RouteStop } from "./types";

/** With no end time filed, this is how long the group is assumed to stay. */
export const DEFAULT_DWELL_MIN = 60;
/** The shortest stay assumed at a stop with no end, however tight the day. */
const MIN_DWELL_MIN = 15;
/** How far into the first stop the stand-in clock sits when the day is not live. */
const SIMULATED_INTO_FIRST_STOP_MIN = 20;
/** How long after the day's last stop "now" is still a useful clock for it. */
const LIVE_SLACK_MIN = 30;

/** Bookings that move the group between days or cities, not stops on a walk. */
const NOT_STOPS = new Set(["flight", "lodging", "rail", "car"]);

/**
 * Whether an item's start is a moment rather than a day. A bare date
 * ("2026-10-18") names a day. So does local midnight, which is how the
 * pattern pass files a date with no time — unless an end with a clock time
 * after it says something really is happening at midnight. A midnight-to-
 * midnight range is a span of days, not a stop.
 */
function hasTimeOfDay(item: TripItem): boolean {
  const start = formatTime(item.startsAt!);
  if (!start) return false;
  if (start !== "00:00") return true;
  if (!hasDate(item.endsAt)) return false;

  const end = formatTime(item.endsAt);
  return end !== "" && end !== "00:00" && Date.parse(item.endsAt) > Date.parse(item.startsAt!);
}

/**
 * The stops a group actually moves between: timed with a readable date,
 * placed, and not a flight or a bed. Named after the place rather than the
 * item, because a meeting point is somewhere, not something.
 */
export function stopsFromItems(items: TripItem[]): RouteStop[] {
  return items
    .filter(
      (item) =>
        hasDate(item.startsAt) &&
        item.place?.point &&
        hasTimeOfDay(item) &&
        !(item.bookingKind && NOT_STOPS.has(item.bookingKind)),
    )
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))
    .map((item) => ({
      id: item.id,
      name: item.place!.name.trim() || item.title,
      point: item.place!.point!,
      startsAt: item.startsAt!,
      endsAt: hasDate(item.endsAt) ? item.endsAt : undefined,
    }));
}

interface Schedule {
  /** Epoch ms the group gets to each stop. */
  arrive: number[];
  /** Epoch ms it leaves each one. */
  depart: number[];
  /** The way in to each stop; undefined for the first. */
  legs: (TravelEstimate | undefined)[];
}

/**
 * When the group is actually at each stop. Filed times are honoured where
 * they are consistent: where the next stop starts before the group could get
 * there, it arrives when it arrives. A stop with no end is assumed to take an
 * hour, cut short so the group can still make the next stop's filed start.
 * Once that start is already lost, the group still gets a quarter of an hour
 * there rather than passing straight through. An end before the start is a
 * typo, as the item editor treats it.
 */
function schedule(stops: RouteStop[]): Schedule {
  const legs = stops.map((stop, i) =>
    i === 0 ? undefined : estimateTravel(stops[i - 1].point, stop.point),
  );
  const arrive: number[] = [];
  const depart: number[] = [];

  for (let i = 0; i < stops.length; i++) {
    const start = Date.parse(stops[i].startsAt);
    const filedEnd = stops[i].endsAt ? Date.parse(stops[i].endsAt!) : Number.NaN;
    const end = filedEnd > start ? filedEnd : Number.NaN;

    const earliest = i === 0 ? start : Math.max(start, depart[i - 1] + legs[i]!.minutes * 60_000);

    let leave: number;
    if (!Number.isNaN(end)) {
      leave = Math.max(end, earliest);
    } else {
      leave = earliest + DEFAULT_DWELL_MIN * 60_000;
      const next = stops[i + 1];
      if (next) {
        const latest = Date.parse(next.startsAt) - legs[i + 1]!.minutes * 60_000;
        const floor = latest < earliest ? earliest + MIN_DWELL_MIN * 60_000 : earliest;
        leave = Math.min(leave, Math.max(latest, floor));
      }
    }

    arrive.push(earliest);
    depart.push(leave);
  }

  return { arrive, depart, legs };
}

/**
 * A day's live window: from the first arrival to a little after the last
 * departure. Before the first stop the group is somewhere the timeline does
 * not say, so that is not live.
 */
function liveWindow(sched: Schedule): { first: number; end: number } {
  return {
    first: sched.arrive[0],
    end: sched.depart[sched.depart.length - 1] + LIVE_SLACK_MIN * 60_000,
  };
}

function liveAt(sched: Schedule, at: number): boolean {
  const { first, end } = liveWindow(sched);
  return at >= first && at <= end;
}

/**
 * Whether a diversion that began at `since` has run through part of this
 * day's live window by `now` — begun before the day or during it, it stays
 * anchored to this day until it ends, so the plan never snaps to another.
 */
function ranThrough(sched: Schedule, since: number, now: number): boolean {
  const { first, end } = liveWindow(sched);
  return since <= end && now >= first && now >= since;
}

/** "Today" for a day's stops, in the offset they were filed in. */
function todayFor(stops: RouteStop[], now: Date): string {
  return dateAt(now, offsetOf(stops[0].startsAt));
}

/**
 * Which day's stops to plan around, most specific first: the day a running
 * diversion has run through, so the plan never jumps to another while it
 * lasts; a day under way; today, as the destination's calendar reads it; the
 * nearest day ahead with somewhere to go between; and once the trip is over,
 * the most recent day, for looking back.
 */
export function pickDay(stops: RouteStop[], now: Date, since?: Date): RouteStop[] {
  const byDay = new Map<string, RouteStop[]>();
  for (const stop of stops) {
    const day = localDateKey(stop.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), stop]);
  }
  if (byDay.size === 0) return [];

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  // Newest first: a long item filed as ending days later keeps its own day's
  // window open, and must not hide the day that is actually happening now.
  const latestFirst = [...days].reverse();

  if (since) {
    const anchored = latestFirst.find(([, day]) =>
      ranThrough(schedule(day), since.getTime(), now.getTime()),
    );
    if (anchored) return anchored[1];
  }

  const liveNow = latestFirst.find(([, day]) => liveAt(schedule(day), now.getTime()));
  if (liveNow) return liveNow[1];

  const today = days.find(([key, day]) => key === todayFor(day, now));
  if (today) return today[1];

  const ahead = days.filter(([key, day]) => key > todayFor(day, now));
  const pool = ahead.length > 0 ? ahead : [...days].reverse();
  const chosen = pool.find(([, day]) => day.length >= 2) ?? pool[0];

  return chosen[1];
}

/**
 * Turns a day's stops into a timeline the group can be placed on. The clock
 * is now while the day is live — or while a diversion that has run into it
 * is still going — and otherwise sits partway into the first stop, so the
 * group is somewhere rather than nowhere yet. The bundled sample is never
 * live: its date is fixed, and it is nobody's actual day.
 */
export function buildRoute(
  stops: RouteStop[],
  now: Date,
  options: { demo?: boolean; since?: Date } = {},
): GroupRoute | undefined {
  if (stops.length === 0) return undefined;

  const sched = schedule(stops);
  const { arrive, depart, legs } = sched;
  const anchored =
    options.since !== undefined && ranThrough(sched, options.since.getTime(), now.getTime());
  const live = !options.demo && (liveAt(sched, now.getTime()) || anchored);

  const clockMs = live
    ? now.getTime()
    : Math.min(arrive[0] + SIMULATED_INTO_FIRST_STOP_MIN * 60_000, depart[0]);

  const waypoints: GroupWaypoint[] = stops.map((stop, i) => ({
    id: stop.id,
    name: stop.name,
    point: stop.point,
    arriveMin: (arrive[i] - clockMs) / 60_000,
    departMin: (depart[i] - clockMs) / 60_000,
    mode: legs[i]?.mode ?? "walk",
    travelMin: legs[i]?.minutes ?? 0,
    offset: offsetOf(stop.startsAt),
  }));

  const located = locate(waypoints);
  const reference = waypoints[located.atStop ?? Math.min(located.nextStop, waypoints.length - 1)];

  return {
    waypoints,
    ...located,
    clock: new Date(clockMs),
    offset: reference.offset,
    simulated: !live,
    demo: Boolean(options.demo),
  };
}

type Located = Pick<GroupRoute, "position" | "phase" | "atStop" | "nextStop" | "progress" | "nowLabel">;

/**
 * Where along its day the group is at the clock, and how to say so. After
 * leaving a stop the group travels for as long as the trip takes, then waits
 * near the next stop until it starts — a free afternoon is not a four-hour
 * walk down one street.
 */
function locate(waypoints: GroupWaypoint[]): Located {
  const last = waypoints.length - 1;

  // The clock never sits before the first arrival (see buildRoute), but a
  // caller building a route by hand could put it there.
  if (waypoints[0].arriveMin > 0) {
    return at(waypoints, 0, `Due at ${waypoints[0].name}`);
  }

  for (let i = 0; i <= last; i++) {
    const stop = waypoints[i];

    if (stop.arriveMin <= 0 && stop.departMin >= 0) {
      return at(
        waypoints,
        i,
        i === last ? `At ${stop.name}, the last stop of the day` : `At ${stop.name}`,
      );
    }

    const next = waypoints[i + 1];
    if (!next || stop.departMin >= 0 || next.arriveMin <= 0) continue;

    const out = -stop.departMin;
    if (next.travelMin > 0 && out < next.travelMin) {
      const progress = out / next.travelMin;
      return {
        position: lerp(stop.point, next.point, progress),
        phase: "on-the-way",
        nextStop: i + 1,
        progress,
        nowLabel: `On the way to ${next.name}`,
      };
    }

    return {
      position: next.point,
      phase: "free-time",
      nextStop: i + 1,
      progress: 1,
      nowLabel: `Free time before ${next.name}`,
    };
  }

  return {
    position: waypoints[last].point,
    phase: "finished",
    atStop: last,
    nextStop: last + 1,
    progress: 0,
    nowLabel: `Finished for the day at ${waypoints[last].name}`,
  };
}

function at(waypoints: GroupWaypoint[], index: number, nowLabel: string): Located {
  return {
    position: waypoints[index].point,
    phase: "at-stop" satisfies GroupPhase,
    atStop: index,
    nextStop: index + 1,
    progress: 0,
    nowLabel,
  };
}

/**
 * The stop to name a place after: the one the group is at, or has free time
 * near. On the move there is none, and a stand-in reads "near the group".
 */
export function anchorName(route: GroupRoute): string | undefined {
  if (route.phase === "on-the-way") return undefined;
  const index = route.phase === "free-time" ? route.nextStop : route.atStop;
  return index === undefined ? undefined : route.waypoints[index]?.name;
}

/**
 * The group's route for this trip: its own timeline when it has timed,
 * located stops, and the bundled sample walk when it has none yet. `since`
 * is when a running diversion began, which keeps its day live until it ends.
 */
export function routeForGroup(items: TripItem[], now = new Date(), since?: Date): GroupRoute {
  const own = pickDay(stopsFromItems(items), now, since);
  if (own.length > 0) return buildRoute(own, now, { since })!;
  return buildRoute(DEMO_STOPS, now, { demo: true })!;
}
