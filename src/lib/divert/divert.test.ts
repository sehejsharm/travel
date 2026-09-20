import { beforeEach, describe, expect, it } from "vitest";
import type { TripItem } from "../domain/types";
import { SEED_ITEMS } from "../store/seed";
import {
  chooseRejoin,
  createTrip,
  deleteTrip,
  emptyState,
  getSnapshot,
  rejoinGroup,
  replaceState,
  startDivert,
  updateDivert,
} from "../store/state";
import { formatDistance, formatEta, formatMinutes, wallClock } from "./format";
import { distanceM } from "./geometry";
import { activeDivert, DIVERT_EXPIRES_MS, groupStatus } from "./index";
import { DIVERT_INTERESTS, dwellFor, interestsFor } from "./interests";
import { DEMO_STOPS } from "./mock";
import { buildPlan, planRejoin } from "./rejoin";
import { buildRoute, pickDay, routeForGroup, stopsFromItems } from "./route";
import { findSpots, SPOT_RADIUS_M } from "./spots";
import type { DivertSpot, RouteStop } from "./types";

const TEAMLAB = { lat: 35.6605, lng: 139.7396 };
const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

const FUGLEN: DivertSpot = {
  id: "fuglen-asakusa",
  name: "Fuglen Asakusa",
  category: "coffee",
  point: { lat: 35.7142, lng: 139.7935 },
};

/** A trip-shaped session for the store tests. */
function spot(patch: Partial<DivertSpot> = {}): DivertSpot {
  return { ...FUGLEN, ...patch };
}

describe("divert interests", () => {
  it("offers the five quick interests with unique ids", () => {
    expect(DIVERT_INTERESTS.map((interest) => interest.title)).toEqual([
      "Grab coffee",
      "Photo spot",
      "Quick bite",
      "Shopping",
      "Rest spot",
    ]);
    expect(new Set(DIVERT_INTERESTS.map((interest) => interest.id)).size).toBe(5);
    expect(DIVERT_INTERESTS.every((interest) => interest.dwellMinutes > 0)).toBe(true);
  });

  it("sums the time away across picks and never under ten minutes", () => {
    expect(dwellFor(interestsFor(["coffee", "photo"]))).toBe(35);
    expect(dwellFor([])).toBe(10);
  });

  it("keeps the picker's order whatever order things were picked in", () => {
    expect(interestsFor(["rest", "coffee", "rest"]).map((interest) => interest.id)).toEqual([
      "coffee",
      "rest",
    ]);
  });
});

describe("divert spots", () => {
  it("finds real spots near the group, nearest first", () => {
    const found = findSpots(TEAMLAB, ["coffee", "rest"]);
    const ids = found.map((entry) => entry.id);

    expect(ids).toContain("blue-bottle-roppongi");
    expect(ids).toContain("shiba-park");
    expect(found.some((entry) => entry.synthetic)).toBe(false);

    const distances = found.map((entry) => distanceM(TEAMLAB, entry.point));
    expect(distances.every((metres) => metres <= SPOT_RADIUS_M)).toBe(true);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("stands in a spot where nothing is nearby, and says so", () => {
    const found = findSpots(REYKJAVIK, ["coffee", "food"], "Hallgrímskirkja");

    expect(found).toHaveLength(2);
    expect(found.every((entry) => entry.synthetic)).toBe(true);
    expect(found.map((entry) => entry.id).sort()).toEqual(["stand-in-coffee", "stand-in-food"]);
    expect(found.every((entry) => entry.name.endsWith("near Hallgrímskirkja"))).toBe(true);
    expect(found.every((entry) => distanceM(REYKJAVIK, entry.point) < 700)).toBe(true);
    // Deterministic, so a stored one can be found again.
    expect(findSpots(REYKJAVIK, ["coffee", "food"], "Hallgrímskirkja")).toEqual(found);
  });

  it("always includes the nearest of each category asked for", () => {
    const shibuya = { lat: 35.658, lng: 139.7016 };
    const found = findSpots(shibuya, ["coffee", "sights", "food", "shopping", "rest"], undefined, 2);

    expect(new Set(found.map((entry) => entry.category)).size).toBe(5);
  });
});

describe("group route", () => {
  it("walks between the day's placed, timed stops and skips flights and beds", () => {
    const ids = stopsFromItems(SEED_ITEMS).map((stop) => stop.id);

    expect(ids).not.toContain("item-flight-out");
    expect(ids).not.toContain("item-hotel");
    expect(ids).toContain("item-teamlab");
    expect(ids.indexOf("item-teamlab")).toBeLessThan(ids.indexOf("item-sensoji"));
  });

  it("plans around today when today has stops, with a stand-in clock once the day is over", () => {
    // 11:00Z is the same calendar day almost everywhere, and 20:00 in Tokyo.
    const now = new Date("2026-10-18T11:00:00Z");
    const day = pickDay(stopsFromItems(SEED_ITEMS), now);
    expect(day.map((stop) => stop.id)).toEqual(["item-sensoji", "item-tsukiji"]);

    const route = routeForGroup(SEED_ITEMS, now);
    expect(route.demo).toBe(false);
    expect(route.simulated).toBe(true);
    expect(route.atStop).toBe(0);
    expect(route.nowLabel).toBe("At Senso-ji early morning");
    expect(route.offset).toBe("+09:00");
  });

  it("falls back to the nearest day ahead with somewhere to go between", () => {
    const route = routeForGroup(SEED_ITEMS, new Date("2026-09-20T11:00:00Z"));

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["item-teamlab", "item-ghibli"]);
    expect(route.simulated).toBe(true);
    expect(route.waypoints[1].mode).toBe("transit");
  });

  it("places the group between stops on a live day", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T10:20:00+09:00"))!;

    expect(route.simulated).toBe(false);
    expect(route.atStop).toBeUndefined();
    expect(route.nextStop).toBe(1);
    expect(route.progress).toBeGreaterThan(0.2);
    expect(route.progress).toBeLessThan(0.5);
    expect(route.nowLabel).toBe("On the way to Kappabashi Kitchen Town");
    expect(distanceM(route.position, DEMO_STOPS[0].point)).toBeGreaterThan(100);
    expect(distanceM(route.position, DEMO_STOPS[1].point)).toBeGreaterThan(100);
  });

  it("arrives late rather than teleporting when the schedule is tighter than the walk", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "Senso-ji", point: { lat: 35.7148, lng: 139.7967 }, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "Ueno Park", point: { lat: 35.7146, lng: 139.773 }, startsAt: "2026-10-18T10:12:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;

    // The stand-in clock sits at the first stop's departure, so a scheduled
    // 10:12 arrival would be two minutes out; the walk takes far longer.
    expect(route.waypoints[1].arriveMin).toBeGreaterThan(10);
    expect(route.waypoints[1].departMin - route.waypoints[1].arriveMin).toBe(60);
  });

  it("uses the sample walk when the trip has nothing placed and timed", () => {
    const items: TripItem[] = [];
    const route = routeForGroup(items, new Date("2026-09-20T11:00:00Z"));

    expect(route.demo).toBe(true);
    expect(route.waypoints).toHaveLength(4);
    expect(route.waypoints.slice(1).every((waypoint) => waypoint.mode === "walk")).toBe(true);
  });
});

describe("rejoin planning", () => {
  // The group is at Senso-ji with 55 minutes left before it moves on.
  const atSensoji = () => buildRoute(DEMO_STOPS, new Date("2026-10-18T09:20:00+09:00"))!;

  it("returns the catch-up first and the group detour second", () => {
    const [catchUp, detour] = planRejoin(atSensoji(), FUGLEN, 20);

    expect(catchUp.type).toBe("CATCH_UP");
    expect(detour.type).toBe("GROUP_DETOUR");
  });

  it("sends a short break back to the stop the group is still at", () => {
    const [catchUp] = planRejoin(atSensoji(), FUGLEN, 20);

    expect(catchUp.feasible).toBe(true);
    expect(catchUp.meetingPointName).toBe("Senso-ji");
    expect(catchUp.groupETA).toBe(0);
    expect(catchUp.groupDistanceM).toBe(0);
    expect(catchUp.userETA).toBeGreaterThan(20);
    expect(catchUp.userETA).toBeLessThan(55);
    expect(catchUp.waitMinutes).toBe(0);
    expect(catchUp.note).toContain("walk straight in");
  });

  it("measures the group detour against its next stop", () => {
    const route = atSensoji();
    const [, detour] = planRejoin(route, FUGLEN, 20);

    expect(detour.location).toEqual(FUGLEN.point);
    expect(detour.meetingPointName).toBe("Fuglen Asakusa");
    // The group finishes at Senso-ji first, then walks over.
    expect(detour.groupETA).toBeGreaterThan(route.waypoints[0].departMin);
    expect(detour.userETA).toBeLessThan(detour.groupETA);
    expect(detour.feasible).toBe(true);
    expect(detour.detourMinutes).toBeGreaterThanOrEqual(0);
    expect(detour.detourMinutes).toBeLessThan(15);
    expect(detour.note).toContain("Kappabashi Kitchen Town");
    expect(detour.waitMinutes).toBeGreaterThan(0);
  });

  it("says so when a long break cannot catch the group anywhere", () => {
    const [catchUp] = planRejoin(atSensoji(), FUGLEN, 240);

    expect(catchUp.feasible).toBe(false);
    expect(catchUp.meetingPointName).toBe("Ameyoko");
    expect(catchUp.note).toContain("after the group moves on");
  });

  it("intercepts on the street when that is quicker than the next stop", () => {
    // A straight walking leg north; the spot sits on it, ahead of the group.
    const a = { lat: 35.7, lng: 139.78 };
    const b = { lat: 35.71033, lng: 139.78 };
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: a, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "B", point: b, startsAt: "2026-10-18T10:31:00+09:00", endsAt: "2026-10-18T11:30:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T10:11:00+09:00"))!;
    expect(route.atStop).toBeUndefined();

    const onTheWay: DivertSpot = { id: "kiosk", name: "Kiosk", category: "coffee", point: { lat: 35.7062, lng: 139.78 } };
    const [catchUp] = planRejoin(route, onTheWay, 0);

    expect(catchUp.feasible).toBe(true);
    expect(catchUp.meetingPointName).toBe("On the way to B");
    expect(catchUp.location.lat).toBeGreaterThan(onTheWay.point.lat);
    expect(catchUp.location.lat).toBeLessThan(b.lat);
    expect(Math.max(catchUp.userETA, catchUp.groupETA)).toBeLessThan(route.waypoints[1].arriveMin);
  });

  it("builds a plan from a stored session", () => {
    const plan = buildPlan(atSensoji(), {
      tripId: "t1",
      interestIds: ["photo", "coffee"],
      spot: FUGLEN,
      startedAt: "2026-10-18T00:20:00Z",
    });

    expect(plan.dwellMinutes).toBe(35);
    expect(plan.interests.map((interest) => interest.id)).toEqual(["coffee", "photo"]);
    expect(plan.options.map((option) => option.type)).toEqual(["CATCH_UP", "GROUP_DETOUR"]);
  });
});

describe("divert state", () => {
  const NOW = new Date("2026-10-18T01:00:00Z");

  function trip(name: string): string {
    return createTrip({
      name,
      homeCountry: "IN",
      destinationCountries: ["JP"],
      startDate: "2026-10-14",
      endDate: "2026-10-22",
      travelers: [{ name: "Sehej" }, { name: "Aanya" }],
    });
  }

  beforeEach(() => {
    replaceState(emptyState());
  });

  it("flips the status for the diverted trip only", () => {
    const japan = trip("Japan");
    const korea = trip("Korea");

    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);

    expect(groupStatus(getSnapshot(), japan, NOW)).toBe("DIVERTED");
    expect(groupStatus(getSnapshot(), korea, NOW)).toBe("IN_GROUP");
  });

  it("rejoining clears the session entirely", () => {
    const japan = trip("Japan");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);
    rejoinGroup();

    expect(getSnapshot().divert).toBeUndefined();
    expect(groupStatus(getSnapshot(), japan, NOW)).toBe("IN_GROUP");
  });

  it("remembers the chosen way back and a switched spot", () => {
    const japan = trip("Japan");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);

    chooseRejoin("GROUP_DETOUR");
    expect(activeDivert(getSnapshot(), japan, NOW)?.chosen).toBe("GROUP_DETOUR");

    updateDivert({ spot: spot({ id: "turret", name: "Turret Coffee" }), chosen: undefined });
    const session = activeDivert(getSnapshot(), japan, NOW);
    expect(session?.spot.name).toBe("Turret Coffee");
    expect(session?.chosen).toBeUndefined();
  });

  it("expires a diversion left running overnight", () => {
    const japan = trip("Japan");
    const lastNight = new Date(NOW.getTime() - DIVERT_EXPIRES_MS - 60_000);
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, lastNight);

    expect(activeDivert(getSnapshot(), japan, NOW)).toBeUndefined();
    expect(groupStatus(getSnapshot(), japan, NOW)).toBe("IN_GROUP");
  });

  it("deleting the trip ends its diversion", () => {
    const japan = trip("Japan");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);
    deleteTrip(japan);

    expect(getSnapshot().divert).toBeUndefined();
  });

  it("reads a session with no usable spot as no session", () => {
    const broken = {
      divert: {
        tripId: "t1",
        interestIds: [],
        spot: undefined as unknown as DivertSpot,
        startedAt: NOW.toISOString(),
      },
    };

    expect(activeDivert(broken, "t1", NOW)).toBeUndefined();
  });
});

describe("divert formatting", () => {
  it("rounds distances the way a person would say them", () => {
    expect(formatDistance(10)).toBe("here");
    expect(formatDistance(654)).toBe("650 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(12_000)).toBe("12 km");
  });

  it("formats minutes and ETAs", () => {
    expect(formatMinutes(0)).toBe("now");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(75)).toBe("1 h 15 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatEta(25)).toBe("in 25 min");
    expect(formatEta(0)).toBe("now");
  });

  it("tells the time in the route's own offset", () => {
    const clock = new Date("2026-10-18T01:20:00Z");
    expect(wallClock(clock, "+09:00", 10)).toBe("10:30");
    expect(wallClock(clock, "-05:00", 10)).toBe("20:30");
    expect(wallClock(clock, "+00:00")).toBe("01:20");
  });
});
