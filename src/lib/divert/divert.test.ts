import { beforeEach, describe, expect, it } from "vitest";
import type { AdviceResult } from "../advisor/types";
import type { TripItem } from "../domain/types";
import { formatTime } from "../rules/shared";
import { buildBackup, parseBackup, restore } from "../store/backup";
import { SEED_ITEMS } from "../store/seed";
import {
  addTraveler,
  cacheAdvice,
  cachedAdvice,
  chooseRejoin,
  createTrip,
  deleteTrip,
  emptyState,
  getSnapshot,
  loadSampleTrip,
  rejoinGroup,
  removeTraveler,
  replaceState,
  startDivert,
  updateDivert,
} from "../store/state";
import {
  atPlace,
  formatDistance,
  formatEta,
  formatMinutes,
  inSentence,
  NEAR_ENOUGH_M,
  standInSearch,
  wallClock,
} from "./format";
import { distanceM } from "./geometry";
import {
  activeDivert,
  DIVERT_EXPIRES_MS,
  divertedName,
  groupStatus,
  isDivertSession,
} from "./index";
import { categoriesFor, DIVERT_INTERESTS, dwellFor, interestsFor } from "./interests";
import { DEMO_STOPS } from "./mock";
import {
  buildPlan,
  planRejoin,
  progressOf,
  quickestRejoin,
  respot,
  travellerPosition,
  travellerWhereabouts,
} from "./rejoin";
import { anchorName, buildRoute, pickDay, routeForGroup, stopsFromItems } from "./route";
import {
  findSpots,
  gazetteerPoint,
  listSpots,
  selectSpot,
  SPOT_RADIUS_M,
  withoutFreshStandIn,
} from "./spots";
import type { DivertSession, DivertSpot, RejoinOption, RouteStop } from "./types";

const TEAMLAB = { lat: 35.6605, lng: 139.7396 };
const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

const FUGLEN: DivertSpot = {
  id: "fuglen-asakusa",
  name: "Fuglen Asakusa",
  category: "coffee",
  point: { lat: 35.7142, lng: 139.7935 },
};

function spot(patch: Partial<DivertSpot> = {}): DivertSpot {
  return { ...FUGLEN, ...patch };
}

/** A placed, timed item, for building a day by hand. */
function item(id: string, name: string, point: { lat: number; lng: number }, startsAt: string, endsAt?: string): TripItem {
  return {
    id,
    tripId: "t1",
    title: `${name} (the item title)`,
    category: "activity",
    source: "manual",
    place: { name, point },
    startsAt,
    endsAt,
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
  };
}

/** Two points a straight walk north of each other, about 1.15 km apart. */
const SOUTH = { lat: 35.7, lng: 139.78 };
const NORTH = { lat: 35.71033, lng: 139.78 };

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
    expect(categoriesFor(interestsFor(["rest", "bite", "coffee"]))).toEqual(["coffee", "food", "rest"]);
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
    expect(found.map((entry) => entry.id.split("@")[0]).sort()).toEqual(["stand-in-coffee", "stand-in-food"]);
    expect(found.every((entry) => entry.name.endsWith("near Hallgrímskirkja"))).toBe(true);
    expect(found.every((entry) => distanceM(REYKJAVIK, entry.point) < 700)).toBe(true);
    // Deterministic, so a stored one can be found again.
    expect(findSpots(REYKJAVIK, ["coffee", "food"], "Hallgrímskirkja")).toEqual(found);
  });

  it("gives stand-ins placed from different spots different ids", () => {
    const [here] = findSpots(REYKJAVIK, ["coffee"]);
    const [there] = findSpots({ lat: 64.15, lng: -21.95 }, ["coffee"]);

    expect(here.id).not.toBe(there.id);
    expect(findSpots(REYKJAVIK, ["coffee"])[0].id).toBe(here.id);
  });

  it("never offers a fresh stand-in in place of the stand-in already chosen", () => {
    const [current] = findSpots(REYKJAVIK, ["coffee"]);
    const found = findSpots({ lat: 64.1475, lng: -21.94 }, ["coffee", "rest"]);
    expect(found.some((entry) => entry.category === "coffee" && entry.id !== current.id)).toBe(true);

    const kept = withoutFreshStandIn(found, current);
    expect(kept.some((entry) => entry.category === "coffee" && entry.id !== current.id)).toBe(false);
    expect(kept.some((entry) => entry.category === "rest")).toBe(true);
    // A real spot never filters anything.
    expect(withoutFreshStandIn(found, FUGLEN)).toEqual(found);
  });

  it("keeps a saved stand-in listed under its own name after another spot is tapped", () => {
    // Nothing bundled near Sapporo, so every spot is a stand-in.
    const sapporo = { lat: 43.0621, lng: 141.3544 };
    const [saved] = findSpots(sapporo, ["coffee"], "Odori Park");
    const found = findSpots(saved.point, ["coffee", "rest"], "you");
    const rest = found.find((entry) => entry.category === "rest")!;

    // Just opened: the saved spot is the choice.
    const opened = listSpots(found, ["coffee", "rest"], [saved, saved]);
    expect(opened.filter((entry) => entry.category === "coffee")).toEqual([saved]);

    // Tapped the rest stand-in to compare: the saved coffee stand-in is still there, by name.
    const compared = listSpots(found, ["coffee", "rest"], [rest, saved]);
    expect(compared.filter((entry) => entry.category === "coffee")).toEqual([saved]);
    expect(compared.some((entry) => entry.id === rest.id)).toBe(true);

    // Coffee unticked and ticked again, nothing tapped: the saved one leads the list.
    expect(listSpots(found, ["coffee", "rest"], [null, saved])[0]).toEqual(saved);

    // Coffee no longer wanted: the saved one drops out rather than being forced back in.
    expect(listSpots(found, ["rest"], [null, saved]).some((entry) => entry.id === saved.id)).toBe(false);
  });

  it("selects a saved real spot again once its interest is back, not the nearest place", () => {
    const origin = gazetteerPoint("Shibuya Crossing");
    const categories: ("coffee" | "sights")[] = ["coffee", "sights"];
    const found = findSpots(origin, categories);
    const saved = found.find((entry) => entry.id === "streamer-shibuya")!;
    expect(found[0].id).not.toBe(saved.id);

    // Coffee unticked (nothing tapped any more) and ticked again.
    const listed = listSpots(found, categories, [null, saved]);
    expect(selectSpot(listed, categories, [null, saved])?.id).toBe(saved.id);
    // A spot tapped since still wins.
    expect(selectSpot(listed, categories, [found[0], saved])?.id).toBe(found[0].id);
    // With the saved kind no longer wanted, the nearest wanted spot is used.
    expect(selectSpot(listSpots(found, ["sights"], [null, saved]), ["sights"], [null, saved])?.category).toBe("sights");
  });

  it("always includes the nearest of each category asked for", () => {
    const shibuya = { lat: 35.658, lng: 139.7016 };
    const found = findSpots(shibuya, ["coffee", "sights", "food", "shopping", "rest"], undefined, 2);

    expect(new Set(found.map((entry) => entry.category)).size).toBe(5);
  });

  it("takes shared places from the gazetteer rather than typing them twice", () => {
    const crossing = findSpots(gazetteerPoint("Shibuya Crossing"), ["sights"]).find(
      (entry) => entry.id === "scramble-crossing",
    );

    expect(crossing?.name).toBe("Shibuya Crossing");
    expect(crossing?.point).toEqual(gazetteerPoint("Shibuya Crossing"));
    expect(DEMO_STOPS[0].point).toEqual(gazetteerPoint("Senso-ji"));
    expect(() => gazetteerPoint("Nowhere In Particular")).toThrow(/gazetteer/);
  });
});

describe("group route: which stops", () => {
  it("walks between placed, timed stops, named after the place, and skips flights and beds", () => {
    const stops = stopsFromItems(SEED_ITEMS);
    const ids = stops.map((stop) => stop.id);

    expect(ids).not.toContain("item-flight-out");
    expect(ids).not.toContain("item-hotel");
    expect(ids).toContain("item-teamlab");
    expect(ids.indexOf("item-teamlab")).toBeLessThan(ids.indexOf("item-sensoji"));
    expect(stops.find((stop) => stop.id === "item-omoide")?.name).toBe("Omoide Yokocho");
  });

  it("drops a malformed start rather than letting it poison the clock", () => {
    const items = [
      item("bad", "Senso-ji", DEMO_STOPS[0].point, "2026-10-16T9:00:00+09:00"),
      item("ok", "Ueno Park", DEMO_STOPS[2].point, "2026-10-16T11:00:00+09:00"),
    ];

    expect(stopsFromItems(items).map((stop) => stop.id)).toEqual(["ok"]);

    const route = routeForGroup([items[0]], new Date("2026-10-16T02:00:00Z"));
    expect(route.demo).toBe(true);
    expect(Number.isNaN(route.clock.getTime())).toBe(false);
  });

  it("treats a date with no time as a day, not a midnight stop, unless it has an end", () => {
    const items = [
      item("date-only", "Tsukiji Outer Market", { lat: 35.6654, lng: 139.7707 }, "2026-10-16T00:00:00+09:00"),
      item("midnight-show", "Golden Gai", { lat: 35.6938, lng: 139.7036 }, "2026-10-16T00:00:00+09:00", "2026-10-16T01:30:00+09:00"),
      item("sky", "Shibuya Sky", { lat: 35.658, lng: 139.7016 }, "2026-10-16T14:00:00+09:00"),
    ];

    expect(stopsFromItems(items).map((stop) => stop.id)).toEqual(["midnight-show", "sky"]);
  });

  it("treats a bare date, and a midnight-to-midnight span, as days rather than stops", () => {
    const at = { lat: 35.7148, lng: 139.7967 };
    const items = [
      item("bare", "Senso-ji", at, "2026-10-16"),
      item("bare-with-end", "Senso-ji", at, "2026-10-16", "2026-10-16T18:00:00+09:00"),
      item("span", "Festival grounds", at, "2026-10-16T00:00:00+09:00", "2026-10-18T00:00:00+09:00"),
      item("timed", "Ueno Park", { lat: 35.7125, lng: 139.777 }, "2026-10-16T10:00:00+09:00"),
    ];

    expect(stopsFromItems(items).map((stop) => stop.id)).toEqual(["timed"]);
  });

  it("treats an item longer than a waking day as a span the group is within, not a stop", () => {
    const items = [
      item("pass", "Conference hall", { lat: 35.63, lng: 139.79 }, "2026-10-16T09:00:00+09:00", "2026-10-18T18:00:00+09:00"),
      item("day-tour", "Nikko", { lat: 36.7581, lng: 139.5986 }, "2026-10-17T07:00:00+09:00", "2026-10-17T21:00:00+09:00"),
      item("lunch", "Lunch spot", { lat: 35.7125, lng: 139.777 }, "2026-10-18T12:00:00+09:00", "2026-10-18T13:00:00+09:00"),
    ];

    expect(stopsFromItems(items).map((stop) => stop.id)).toEqual(["day-tour", "lunch"]);
  });
});

describe("group route: which day", () => {
  const day = (date: string, times: [string, string][]): RouteStop[] =>
    times.map(([start, end], index) => ({
      id: `${date}-${index}`,
      name: `Stop ${index} on ${date}`,
      point: { lat: 35.7 + index * 0.002, lng: 139.78 },
      startsAt: `${date}T${start}:00+09:00`,
      endsAt: `${date}T${end}:00+09:00`,
    }));

  it("reads today from the destination's calendar, not the phone's", () => {
    const stops = [...day("2026-10-15", [["09:00", "10:00"], ["11:00", "12:00"]]), ...day("2026-10-16", [["15:00", "16:00"], ["17:00", "18:00"]])];
    // 06:00 on the 16th in Tokyo is still the 15th on a phone in the Americas.
    const picked = pickDay(stops, new Date("2026-10-16T06:00:00+09:00"));

    expect(picked.map((stop) => stop.startsAt.slice(0, 10))).toEqual(["2026-10-16", "2026-10-16"]);
  });

  it("keeps a day that runs past midnight while it is still under way", () => {
    const stops = [...day("2026-10-17", [["21:00", "22:00"], ["22:30", "23:59"]]), ...day("2026-10-18", [["09:00", "10:00"]])];
    const picked = pickDay(stops, new Date("2026-10-18T00:10:00+09:00"));

    expect(picked[0].startsAt.slice(0, 10)).toBe("2026-10-17");
  });

  it("lets the day actually happening win over a long item filed as ending days later", () => {
    const items = [
      item("pass", "Conference hall", { lat: 35.63, lng: 139.79 }, "2026-10-16T09:00:00+09:00", "2026-10-18T18:00:00+09:00"),
      item("l", "Lunch spot", { lat: 35.7125, lng: 139.777 }, "2026-10-17T12:00:00+09:00", "2026-10-17T13:00:00+09:00"),
      item("m", "Museum", { lat: 35.7188, lng: 139.7766 }, "2026-10-17T14:00:00+09:00", "2026-10-17T16:00:00+09:00"),
    ];
    const picked = pickDay(stopsFromItems(items), new Date("2026-10-17T14:00:00+09:00"));

    expect(picked.map((stop) => stop.id)).toEqual(["l", "m"]);
  });

  it("keeps a running diversion on its own day even while an earlier long item is still open", () => {
    const items = [
      item("pass", "Conference hall", { lat: 35.63, lng: 139.79 }, "2026-10-16T09:00:00+09:00", "2026-10-18T18:00:00+09:00"),
      item("l", "Lunch spot", { lat: 35.7125, lng: 139.777 }, "2026-10-17T12:00:00+09:00", "2026-10-17T13:00:00+09:00"),
      item("m", "Museum", { lat: 35.7188, lng: 139.7766 }, "2026-10-17T14:00:00+09:00", "2026-10-17T16:00:00+09:00"),
    ];
    const now = new Date("2026-10-17T17:00:00+09:00");
    const since = new Date("2026-10-17T14:00:00+09:00");

    expect(pickDay(stopsFromItems(items), now, since).map((stop) => stop.id)).toEqual(["l", "m"]);
    const route = routeForGroup(items, now, since);
    expect(route.simulated).toBe(false);
    expect(route.phase).toBe("finished");
  });

  it("plans around the day's own stops rather than a long item that spans it", () => {
    const items = [
      item("pass", "Conference hall", { lat: 35.63, lng: 139.79 }, "2026-10-16T09:00:00+09:00", "2026-10-18T18:00:00+09:00"),
      item("l", "Lunch spot", { lat: 35.7125, lng: 139.777 }, "2026-10-17T12:00:00+09:00", "2026-10-17T13:00:00+09:00"),
      item("m", "Museum", { lat: 35.7188, lng: 139.7766 }, "2026-10-17T14:00:00+09:00", "2026-10-17T16:00:00+09:00"),
    ];
    // Broke off at 09:00, before the 17th's own stops began.
    const since = new Date("2026-10-17T09:00:00+09:00");
    const route = routeForGroup(items, new Date("2026-10-17T12:30:00+09:00"), since);

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["l", "m"]);
    expect(route.nowLabel).toBe("At Lunch spot");
    // Before the day's first stop, the same day is shown, simulated.
    const early = routeForGroup(items, new Date("2026-10-17T11:00:00+09:00"), since);
    expect(early.waypoints.map((w) => w.id)).toEqual(["l", "m"]);
    expect(early.simulated).toBe(true);
  });

  it("plans around the day's own stops even when a long item was filed in another offset", () => {
    const items = [
      item("pz", "Conference hall", { lat: 35.63, lng: 139.79 }, "2026-10-16T00:30:00Z", "2026-10-18T09:00:00Z"),
      item("l", "Lunch spot", { lat: 35.7125, lng: 139.777 }, "2026-10-17T12:00:00+09:00", "2026-10-17T13:00:00+09:00"),
      item("m", "Museum", { lat: 35.7188, lng: 139.7766 }, "2026-10-17T14:00:00+09:00", "2026-10-17T16:00:00+09:00"),
    ];
    const since = new Date("2026-10-17T08:00:00+09:00");
    const route = routeForGroup(items, new Date("2026-10-17T12:30:00+09:00"), since);

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["l", "m"]);
  });

  it("keeps an evening diversion in its own city when the next day is filed further east", () => {
    const items = [
      item("l1", "British Museum", { lat: 51.5194, lng: -0.127 }, "2026-10-16T14:00:00+01:00", "2026-10-16T15:00:00+01:00"),
      item("l2", "Borough Market", { lat: 51.5055, lng: -0.091 }, "2026-10-16T17:00:00+01:00", "2026-10-16T19:00:00+01:00"),
      item("p1", "Louvre", { lat: 48.8606, lng: 2.3376 }, "2026-10-17T09:00:00+02:00", "2026-10-17T10:00:00+02:00"),
      item("p2", "Sainte-Chapelle", { lat: 48.8554, lng: 2.345 }, "2026-10-17T11:00:00+02:00", "2026-10-17T12:00:00+02:00"),
    ];
    // Half past eleven in London is already the 17th in Paris.
    const since = new Date("2026-10-16T23:30:00+01:00");
    const route = routeForGroup(items, new Date("2026-10-17T09:05:00+02:00"), since);

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["l1", "l2"]);
    expect(route.simulated).toBe(true);
  });

  it("keeps an evening diversion on the day it was planned against, not the next morning's", () => {
    const items = [
      item("a", "Ueno Park", { lat: 35.7125, lng: 139.777 }, "2026-10-17T10:00:00+09:00", "2026-10-17T11:00:00+09:00"),
      item("b", "Ameyoko", { lat: 35.71, lng: 139.7745 }, "2026-10-17T14:00:00+09:00", "2026-10-17T18:00:00+09:00"),
      item("c", "Fushimi Inari Taisha", { lat: 34.9671, lng: 135.7727 }, "2026-10-18T09:00:00+09:00", "2026-10-18T10:00:00+09:00"),
      item("d", "Kiyomizu-dera", { lat: 34.9949, lng: 135.785 }, "2026-10-18T11:00:00+09:00", "2026-10-18T12:00:00+09:00"),
    ];
    const since = new Date("2026-10-17T22:30:00+09:00");
    const route = routeForGroup(items, new Date("2026-10-18T09:05:00+09:00"), since);

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["a", "b"]);
    expect(route.simulated).toBe(true);
  });

  it("stays on the day a diversion planned before it began, once the day is over", () => {
    const items = [
      item("a", "Ueno Park", { lat: 35.7125, lng: 139.777 }, "2026-10-18T10:00:00+09:00", "2026-10-18T11:00:00+09:00"),
      item("b", "Ameyoko", { lat: 35.71, lng: 139.7745 }, "2026-10-18T11:30:00+09:00", "2026-10-18T12:00:00+09:00"),
    ];
    const since = new Date("2026-10-18T08:00:00+09:00");
    const route = routeForGroup(items, new Date("2026-10-18T13:00:00+09:00"), since);

    expect(route.simulated).toBe(false);
    expect(route.phase).toBe("finished");
  });

  it("stays on the day a running diversion began in once that day ends", () => {
    const items = [
      item("a", "Ueno Park", { lat: 35.7125, lng: 139.777 }, "2026-10-18T16:00:00+09:00", "2026-10-18T17:00:00+09:00"),
      item("b", "Ameyoko", { lat: 35.71, lng: 139.7745 }, "2026-10-18T17:30:00+09:00", "2026-10-18T18:00:00+09:00"),
    ];
    const since = new Date("2026-10-18T17:40:00+09:00");
    const now = new Date("2026-10-18T18:45:00+09:00");

    const anchored = routeForGroup(items, now, since);
    expect(anchored.simulated).toBe(false);
    expect(anchored.phase).toBe("finished");
    expect(anchored.nowLabel).toBe("Finished for the day at Ameyoko");

    // Without a diversion running, the same moment plans the day ahead of time.
    expect(routeForGroup(items, now).simulated).toBe(true);
  });

  it("plans around today with a stand-in clock once the day is over", () => {
    const route = routeForGroup(SEED_ITEMS, new Date("2026-10-18T11:00:00Z"));

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["item-sensoji", "item-tsukiji"]);
    expect(route.demo).toBe(false);
    expect(route.simulated).toBe(true);
    expect(route.atStop).toBe(0);
    expect(route.nowLabel).toBe("At Senso-ji");
    expect(route.offset).toBe("+09:00");
  });

  it("takes tomorrow morning's single stop over a busier day after, when a diversion could run into it", () => {
    const at = (id: string, date: string, start: string, end: string, lng: number) =>
      item(id, `Stop ${id}`, { lat: 35.7, lng }, `${date}T${start}:00+09:00`, `${date}T${end}:00+09:00`);
    const items = [
      at("s1", "2026-10-18", "09:00", "11:00", 139.77),
      at("s2", "2026-10-19", "09:00", "10:00", 139.78),
      at("s3", "2026-10-19", "11:00", "12:00", 139.79),
      at("s4", "2026-10-19", "14:00", "16:00", 139.8),
    ];
    // An evening with nothing on it, the night before.
    const since = new Date("2026-10-17T22:00:00+09:00");

    expect(pickDay(stopsFromItems(items), since).map((stop) => stop.id)).toEqual(["s1"]);
    const route = routeForGroup(items, new Date("2026-10-18T09:30:00+09:00"), since);
    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["s1"]);
    expect(route.simulated).toBe(false);
  });

  it("looks back at the last day once the trip is over, however few stops it had", () => {
    const at = (id: string, date: string, start: string, end: string) =>
      item(id, `Stop ${id}`, { lat: 35.7, lng: 139.77 }, `${date}T${start}:00+09:00`, `${date}T${end}:00+09:00`);
    const items = [
      at("a", "2026-10-16", "10:00", "12:00"),
      at("b", "2026-10-16", "14:00", "16:00"),
      at("c", "2026-10-17", "08:00", "10:00"),
      at("d", "2026-10-17", "13:00", "15:00"),
      at("e", "2026-10-18", "09:00", "10:00"),
    ];

    expect(pickDay(stopsFromItems(items), new Date("2026-10-20T12:00:00+09:00")).map((stop) => stop.id)).toEqual(["e"]);
  });

  it("falls back to the nearest day ahead with somewhere to go between", () => {
    const route = routeForGroup(SEED_ITEMS, new Date("2026-09-20T11:00:00Z"));

    expect(route.waypoints.map((waypoint) => waypoint.id)).toEqual(["item-teamlab", "item-ghibli"]);
    expect(route.simulated).toBe(true);
    expect(route.waypoints[1].mode).toBe("transit");
  });

  it("uses the sample walk when the trip has nothing placed and timed, and never treats it as live", () => {
    const route = routeForGroup([], new Date("2026-10-18T10:20:00+09:00"));

    expect(route.demo).toBe(true);
    expect(route.simulated).toBe(true);
    expect(route.waypoints).toHaveLength(4);
    expect(route.waypoints.slice(1).every((waypoint) => waypoint.mode === "walk")).toBe(true);
  });
});

describe("group route: where the group is", () => {
  it("places the group between stops while it is actually travelling", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T10:20:00+09:00"))!;

    expect(route.simulated).toBe(false);
    expect(route.phase).toBe("on-the-way");
    expect(route.atStop).toBeUndefined();
    expect(route.nextStop).toBe(1);
    expect(route.progress).toBeGreaterThan(0.2);
    expect(route.progress).toBeLessThan(0.5);
    expect(route.nowLabel).toBe("On the way to Kappabashi Kitchen Town");
    expect(anchorName(route)).toBeUndefined();
  });

  it("is not live before the first stop, so the group is never 'already there' early", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T08:45:00+09:00"))!;

    expect(route.simulated).toBe(true);
    expect(route.phase).toBe("at-stop");
    expect(route.atStop).toBe(0);
  });

  it("gives a free afternoon as free time near the next stop, not a four-hour walk", () => {
    const stops: RouteStop[] = [
      { id: "lunch", name: "Lunch", point: SOUTH, startsAt: "2026-10-18T11:00:00+09:00", endsAt: "2026-10-18T12:00:00+09:00" },
      { id: "museum", name: "Museum", point: NORTH, startsAt: "2026-10-18T16:00:00+09:00", endsAt: "2026-10-18T17:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T13:00:00+09:00"))!;

    expect(route.phase).toBe("free-time");
    expect(route.position).toEqual(NORTH);
    expect(route.nowLabel).toBe("Free time before Museum");
    expect(anchorName(route)).toBe("Museum");

    // The only honest meeting is at the museum when it starts; nobody is walking the street for hours.
    const [catchUp] = planRejoin(route, spot({ point: { lat: 35.708, lng: 139.781 } }), 20);
    expect(catchUp.meetingPointName).toBe("Museum");
    expect(catchUp.groupETA).toBe(180);
  });

  it("does not let an assumed hour at a stop push the next stop past its filed start", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: DEMO_STOPS[0].point, startsAt: "2026-10-18T09:00:00+09:00" },
      { id: "b", name: "B", point: DEMO_STOPS[1].point, startsAt: "2026-10-18T09:30:00+09:00" },
      { id: "c", name: "C", point: DEMO_STOPS[2].point, startsAt: "2026-10-18T13:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;
    const [a, b] = route.waypoints;
    const clockAt = (minutes: number) => route.clock.getTime() + minutes * 60_000;

    expect(clockAt(b.arriveMin)).toBe(Date.parse("2026-10-18T09:30:00+09:00"));
    expect(Math.round(b.arriveMin - a.departMin)).toBe(b.travelMin);
    // With room to spare, the assumed hour stands.
    expect(Math.round(b.departMin - b.arriveMin)).toBe(60);
  });

  it("keeps a tight but on-time day to its filed times", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: DEMO_STOPS[2].point, startsAt: "2026-10-18T09:00:00+09:00" },
      { id: "b", name: "B", point: DEMO_STOPS[3].point, startsAt: "2026-10-18T09:15:00+09:00", endsAt: "2026-10-18T11:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;
    const [a, b] = route.waypoints;
    const at = (minutes: number) => route.clock.getTime() + minutes * 60_000;

    expect(at(b.arriveMin)).toBe(Date.parse("2026-10-18T09:15:00+09:00"));
    expect(Math.round(b.arriveMin - a.departMin)).toBe(b.travelMin);
    expect(b.departMin - b.arriveMin).toBeGreaterThan(100);
  });

  it("still gives a late group a short visit rather than none at all", () => {
    // B is reached well after C's filed start could still be made from it.
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: { lat: 35.7148, lng: 139.7967 }, startsAt: "2026-10-18T09:00:00+09:00", endsAt: "2026-10-18T10:00:00+09:00" },
      { id: "b", name: "B", point: { lat: 35.658, lng: 139.7016 }, startsAt: "2026-10-18T10:05:00+09:00" },
      { id: "c", name: "C", point: { lat: 35.6595, lng: 139.7005 }, startsAt: "2026-10-18T10:20:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;
    const b = route.waypoints[1];

    expect(Math.round(b.departMin - b.arriveMin)).toBe(15);
  });

  it("reads an end before the start as a typo and assumes the usual stay", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T09:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T10:00:30+09:00"))!;

    expect(Math.round(route.waypoints[0].departMin - route.waypoints[0].arriveMin)).toBe(60);
    expect(route.nowLabel).toBe("At A, the last stop of the day");
  });

  it("arrives late rather than teleporting when the schedule is tighter than the trip", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "Senso-ji", point: { lat: 35.7148, lng: 139.7967 }, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "Ueno Park", point: { lat: 35.7146, lng: 139.773 }, startsAt: "2026-10-18T10:12:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;

    expect(route.waypoints[1].arriveMin).toBeGreaterThan(10);
    expect(route.waypoints[1].departMin - route.waypoints[1].arriveMin).toBe(60);
  });
});

describe("group route: telling the time", () => {
  it("reads stops filed without an offset the way the timeline does, in any zone", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T09:00:00", endsAt: "2026-10-18T10:00:00" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T11:00:00" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;

    expect(route.offset).toBe("");
    expect(wallClock(route.clock, route.offset, route.waypoints[0].arriveMin)).toBe(formatTime(stops[0].startsAt));
    expect(wallClock(route.clock, route.waypoints[1].offset, route.waypoints[1].arriveMin)).toBe(formatTime(stops[1].startsAt));
  });

  it("keeps each stop's own offset when a day crosses one", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T09:00:00+05:30", endsAt: "2026-10-18T10:00:00+05:30" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T15:00:00+05:45" },
    ];
    const route = buildRoute(stops, new Date("2026-09-01T00:00:00Z"))!;
    const [a, b] = route.waypoints;

    expect(wallClock(route.clock, a.offset, a.arriveMin)).toBe("09:00");
    expect(wallClock(route.clock, b.offset, b.arriveMin)).toBe("15:00");
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
    expect(catchUp.groupLeaveMin).toBeGreaterThan(0);
    expect(catchUp.userETA).toBeGreaterThan(catchUp.groupLeaveMin!);
  });

  it("marks which meeting names Manifest made up", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T09:20:00+09:00"))!;
    const [atStop, toReal] = planRejoin(route, FUGLEN, 20);
    expect(atStop.meetingPointGenerated).toBe(false);
    expect(toReal.meetingPointGenerated).toBe(false);

    const [, toStandIn] = planRejoin(route, spot({ id: "stand-in-coffee@1,1", name: "A coffee stand near you", synthetic: true }), 20);
    expect(toStandIn.meetingPointGenerated).toBe(true);
  });

  it("intercepts on the street when that is quicker than the next stop", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T10:31:00+09:00", endsAt: "2026-10-18T11:30:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T10:11:00+09:00"))!;
    expect(route.phase).toBe("on-the-way");

    const onTheWay: DivertSpot = { id: "kiosk", name: "Kiosk", category: "coffee", point: { lat: 35.7062, lng: 139.78 } };
    const [catchUp] = planRejoin(route, onTheWay, 0);

    expect(catchUp.feasible).toBe(true);
    expect(catchUp.meetingPointName).toBe("On the way to B");
    expect(catchUp.meetingPointGenerated).toBe(true);
    expect(catchUp.location.lat).toBeGreaterThan(onTheWay.point.lat);
    expect(catchUp.location.lat).toBeLessThan(NORTH.lat);
    expect(Math.max(catchUp.userETA, catchUp.groupETA)).toBeLessThan(route.waypoints[1].arriveMin);
  });

  it("never offers a street meeting the group has already walked past", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T10:31:00+09:00", endsAt: "2026-10-18T11:30:00+09:00" },
    ];
    // Most of the way up the street; a spot right beside the start.
    const route = buildRoute(stops, new Date("2026-10-18T10:21:00+09:00"))!;
    expect(route.progress).toBeGreaterThan(0.5);
    const [catchUp] = planRejoin(route, spot({ point: SOUTH }), 0);

    // Whatever it picks, it is ahead of the group, never behind it.
    expect(catchUp.location.lat).toBeGreaterThanOrEqual(route.position.lat);
  });

  it("names a street meeting by how most of the group's way there is travelled", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: { lat: 35.7148, lng: 139.7967 }, startsAt: "2026-10-18T09:00:00+09:00", endsAt: "2026-10-18T09:30:00+09:00" },
      { id: "b", name: "B", point: { lat: 35.7135, lng: 139.788 }, startsAt: "2026-10-18T09:50:00+09:00", endsAt: "2026-10-18T10:00:00+09:00" },
      { id: "c", name: "C", point: { lat: 35.658, lng: 139.7016 }, startsAt: "2026-10-18T11:00:00+09:00", endsAt: "2026-10-18T11:10:00+09:00" },
      { id: "d", name: "D", point: { lat: 35.6655, lng: 139.6975 }, startsAt: "2026-10-18T11:30:00+09:00", endsAt: "2026-10-18T13:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T09:10:00+09:00"))!;
    // A spot beside the C to D walk, and a stay that misses C but catches them on the street.
    const [catchUp] = planRejoin(route, spot({ point: { lat: 35.6618, lng: 139.7001 } }), 70);

    expect(catchUp.meetingPointName).toBe("On the way to D");
    expect(catchUp.groupMode).toBe("transit");
  });

  it("names the group's leg by how most of it is travelled", () => {
    // A short walk, a long hop across town, then a short walk.
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: { lat: 35.7148, lng: 139.7967 }, startsAt: "2026-10-18T09:00:00+09:00", endsAt: "2026-10-18T09:30:00+09:00" },
      { id: "b", name: "B", point: { lat: 35.7135, lng: 139.788 }, startsAt: "2026-10-18T09:50:00+09:00", endsAt: "2026-10-18T10:00:00+09:00" },
      { id: "c", name: "C", point: { lat: 35.658, lng: 139.7016 }, startsAt: "2026-10-18T11:00:00+09:00", endsAt: "2026-10-18T11:10:00+09:00" },
      { id: "d", name: "D", point: { lat: 35.6595, lng: 139.7005 }, startsAt: "2026-10-18T11:20:00+09:00", endsAt: "2026-10-18T13:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T09:10:00+09:00"))!;
    const [catchUp] = planRejoin(route, spot({ point: { lat: 35.6598, lng: 139.7019 } }), 90);

    expect(catchUp.meetingPointName).toBe("D");
    expect(catchUp.groupMode).toBe("transit");
  });

  it("reports no cost to the group's day when the next stop is hours off anyway", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T09:00:00+09:00", endsAt: "2026-10-18T10:00:00+09:00" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T14:00:00+09:00", endsAt: "2026-10-18T15:00:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T09:30:00+09:00"))!;
    const [, detour] = planRejoin(route, spot({ point: { lat: 35.705, lng: 139.781 } }), 20);

    expect(detour.detourMinutes).toBe(0);
    expect(detour.feasible).toBe(true);
    expect(detour.note).toContain("No cost to the day");
  });

  it("says so when the group would reach the spot first and wait", () => {
    // The group is walking right past the café; the traveller set off from
    // well beyond it, on the far side.
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T10:20:00+09:00"))!;
    const origin = { lat: 35.7148, lng: 139.8065 };
    const [, detour] = planRejoin(route, FUGLEN, 20, { elapsedMin: 0, origin });

    expect(detour.groupETA).toBeLessThan(detour.userETA);
    expect(detour.note).toContain("before you and wait");
    expect(detour.waitMinutes).toBe(detour.userETA - detour.groupETA);
  });

  it("says the group would miss its next stop when the detour runs past its end", () => {
    const stops: RouteStop[] = [
      { id: "a", name: "A", point: SOUTH, startsAt: "2026-10-18T10:00:00+09:00", endsAt: "2026-10-18T10:10:00+09:00" },
      { id: "b", name: "B", point: NORTH, startsAt: "2026-10-18T10:31:00+09:00", endsAt: "2026-10-18T10:40:00+09:00" },
    ];
    const route = buildRoute(stops, new Date("2026-10-18T10:15:00+09:00"))!;
    const [, detour] = planRejoin(route, spot({ point: { lat: 35.7, lng: 139.795 } }), 30);

    expect(detour.feasible).toBe(false);
    expect(detour.note).toContain("altogether");
    // Mid-leg the group turns now, so its time there is just the trip.
    expect(detour.groupETA).toBeGreaterThan(0);
  });

  it("charges nothing to the group's plan when there is nothing left after the last stop", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T13:00:00+09:00"))!;
    const [, detour] = planRejoin(route, spot({ point: { lat: 35.7118, lng: 139.7762 } }), 20);

    expect(route.nowLabel).toContain("the last stop of the day");
    expect(detour.detourMinutes).toBe(0);
    expect(detour.note).toContain("Nothing left on the group's day");
  });

  it("says the day is over rather than pointing at a stop the group has left", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T13:45:00+09:00"))!;
    const [catchUp, detour] = planRejoin(route, FUGLEN, 20);

    expect(route.phase).toBe("finished");
    expect(catchUp.feasible).toBe(false);
    expect(catchUp.note).toContain("day is over");
    expect(detour.detourMinutes).toBe(0);
  });

  it("writes notes from the same rounded numbers the card shows", () => {
    // A live clock with seconds in it makes every group time fractional.
    const route = buildRoute(DEMO_STOPS, new Date("2026-10-18T10:16:27.123+09:00"))!;
    for (const candidate of [FUGLEN, spot({ point: { lat: 35.7132, lng: 139.7872 } }), spot({ point: DEMO_STOPS[2].point })]) {
      const [catchUp, detour] = planRejoin(route, candidate, 15);

      if (catchUp.feasible) expect(catchUp.waitMinutes).toBe(Math.max(0, catchUp.groupETA - catchUp.userETA));
      if (catchUp.note.includes("before the group arrives")) expect(catchUp.waitMinutes).toBeGreaterThan(0);
      if (detour.note.includes("later than planned")) expect(detour.detourMinutes).toBeGreaterThan(0);
      if (detour.note.includes("spare after")) expect(detour.waitMinutes).toBeGreaterThan(0);
      for (const option of [catchUp, detour]) {
        expect(Number.isInteger(option.userETA)).toBe(true);
        expect(Number.isInteger(option.groupETA)).toBe(true);
      }
    }
  });
});

describe("a diversion under way", () => {
  const session = (patch: Partial<DivertSession> = {}): DivertSession => ({
    tripId: "t1",
    interestIds: ["coffee"],
    spot: FUGLEN,
    startedAt: "2026-10-18T09:30:00+09:00",
    from: DEMO_STOPS[0].point,
    ...patch,
  });
  const liveAt = (time: string) => buildRoute(DEMO_STOPS, new Date(`2026-10-18T${time}:00+09:00`))!;

  it("counts the ETA down as time passes instead of re-planning from scratch", () => {
    const early = buildPlan(liveAt("09:30"), session());
    const later = buildPlan(liveAt("09:50"), session());
    const [catchUpEarly] = early.options;
    const [catchUpLater, detourLater] = later.options;

    expect(catchUpEarly.meetingPointName).toBe("Senso-ji");
    expect(catchUpLater.meetingPointName).toBe("Senso-ji");
    expect(catchUpLater.feasible).toBe(true);
    expect(catchUpEarly.userETA - catchUpLater.userETA).toBe(20);
    // The same meeting, whenever you look.
    expect(wallClock(later.route.clock, later.route.offset, catchUpLater.userETA)).toBe(
      wallClock(early.route.clock, early.route.offset, catchUpEarly.userETA),
    );
    // Twenty minutes in, they are already at the café.
    expect(detourLater.userETA).toBe(0);
    expect(detourLater.userDistanceM).toBe(0);
  });

  it("counts time only from when the group's day begins", () => {
    const planned = session({ startedAt: "2026-10-18T07:30:00+09:00" });
    expect(progressOf(liveAt("09:05"), planned).elapsedMin).toBeCloseTo(5, 5);
  });

  it("counts nothing as elapsed on a simulated clock", () => {
    const route = buildRoute(DEMO_STOPS, new Date("2026-09-01T00:00:00Z"))!;
    expect(route.simulated).toBe(true);
    expect(progressOf(route, session()).elapsedMin).toBe(0);
  });

  it("starts the walk to a new spot from wherever the traveller is now", () => {
    const route = liveAt("10:00");
    const patch = respot(route, session(), spot({ id: "turret", name: "Turret Coffee" }));

    // Thirty minutes in, they had long since reached the first café.
    expect(patch.from).toEqual(FUGLEN.point);
    expect(patch.fromAt).toBe(route.clock.toISOString());
    expect(patch.chosen).toBeUndefined();

    const moved = session({ ...patch, spot: patch.spot });
    expect(progressOf(route, moved).elapsedMin).toBe(0);
  });

  it("names a stand-in after a real spot the traveller has reached, and otherwise after them", () => {
    expect(travellerWhereabouts(liveAt("10:00"), session()).anchor).toBe("Fuglen Asakusa");
    expect(travellerWhereabouts(liveAt("09:31"), session()).anchor).toBe("you");

    const standIn = session({ spot: spot({ id: "stand-in-coffee@1,1", name: "A coffee stand near you", synthetic: true }) });
    const named = findSpots(travellerWhereabouts(liveAt("10:00"), standIn).position, ["rest"], travellerWhereabouts(liveAt("10:00"), standIn).anchor);
    expect(named.every((entry) => !entry.name.includes("near A "))).toBe(true);
  });

  it("puts a traveller who is still walking out partway along", () => {
    const where = travellerPosition(liveAt("09:33"), session({ spot: spot({ point: DEMO_STOPS[2].point }) }));

    expect(where.lng).toBeLessThan(DEMO_STOPS[0].point.lng);
    expect(where.lng).toBeGreaterThan(DEMO_STOPS[2].point.lng);
  });
});

describe("leading with an option", () => {
  const option = (patch: Partial<RejoinOption>): RejoinOption => ({
    type: "CATCH_UP",
    location: SOUTH,
    meetingPointName: "Somewhere",
    meetingPointGenerated: false,
    userETA: 30,
    groupETA: 20,
    userDistanceM: 500,
    groupDistanceM: 0,
    waitMinutes: 0,
    detourMinutes: 0,
    feasible: true,
    note: "",
    userMode: "walk",
    groupMode: "walk",
    ...patch,
  });

  it("prefers one that works, then the soonest, then the catch-up", () => {
    expect(quickestRejoin([option({ feasible: false }), option({ type: "GROUP_DETOUR" })]).type).toBe("GROUP_DETOUR");
    expect(quickestRejoin([option({ userETA: 50 }), option({ type: "GROUP_DETOUR", userETA: 5, groupETA: 25 })]).type).toBe("GROUP_DETOUR");
    expect(quickestRejoin([option({}), option({ type: "GROUP_DETOUR" })]).type).toBe("CATCH_UP");
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

  function travelers(tripId: string) {
    return getSnapshot().trips.find((entry) => entry.id === tripId)!.travelers;
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

    updateDivert({ spot: spot({ id: "turret", name: "Turret Coffee" }), chosen: undefined }, NOW);
    const session = activeDivert(getSnapshot(), japan, NOW);
    expect(session?.spot.name).toBe("Turret Coffee");
    expect(session?.chosen).toBeUndefined();
  });

  it("names whoever broke off, and nobody once they are gone", () => {
    const japan = trip("Japan");
    const [sehej] = travelers(japan);
    expect(divertedName(travelers(japan), { travelerId: sehej.id })).toBe("Sehej");
    expect(divertedName(travelers(japan), { travelerId: "someone-else" })).toBeUndefined();
  });

  it("expires a diversion left running overnight, and clears it rather than reviving it", () => {
    const japan = trip("Japan");
    const lastNight = new Date(NOW.getTime() - DIVERT_EXPIRES_MS - 60_000);
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, lastNight);

    expect(activeDivert(getSnapshot(), japan, NOW)).toBeUndefined();
    expect(groupStatus(getSnapshot(), japan, NOW)).toBe("IN_GROUP");

    updateDivert({ chosen: "CATCH_UP" }, NOW);
    expect(getSnapshot().divert).toBeUndefined();
  });

  it("deleting a different trip leaves the diversion alone", () => {
    const japan = trip("Japan");
    const old = trip("Old");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);
    deleteTrip(old);

    expect(getSnapshot().divert?.tripId).toBe(japan);
  });

  it("deleting the trip ends its diversion", () => {
    const japan = trip("Japan");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);
    deleteTrip(japan);

    expect(getSnapshot().divert).toBeUndefined();
  });

  it("keeps the diversion when someone else leaves and a group remains", () => {
    const japan = trip("Japan");
    const [sehej, aanya] = travelers(japan);
    addTraveler(japan, { name: "Ria", passportCountry: "IN", passportExpiry: "" });

    startDivert({ tripId: japan, travelerId: sehej.id, interestIds: ["coffee"], spot: spot() }, NOW);
    removeTraveler(japan, aanya.id);

    expect(getSnapshot().divert?.travelerId).toBe(sehej.id);
  });

  it("ends the diversion when the person who broke off leaves the trip", () => {
    const japan = trip("Japan");
    const [sehej] = travelers(japan);
    addTraveler(japan, { name: "Ria", passportCountry: "IN", passportExpiry: "" });

    startDivert({ tripId: japan, travelerId: sehej.id, interestIds: ["coffee"], spot: spot() }, NOW);
    removeTraveler(japan, sehej.id);

    expect(getSnapshot().divert).toBeUndefined();
  });

  it("ends the diversion when the group drops to one", () => {
    const japan = trip("Japan");
    const [sehej, aanya] = travelers(japan);

    startDivert({ tripId: japan, travelerId: sehej.id, interestIds: ["coffee"], spot: spot() }, NOW);
    removeTraveler(japan, aanya.id);

    expect(getSnapshot().divert).toBeUndefined();
  });

  it("loading the sample keeps a diversion and every trip's paid-for advice", () => {
    const japan = trip("Japan");
    const advice: AdviceResult = { destination: "Tokyo", sections: [], tiersUsed: [], generatedAt: NOW.toISOString() };
    cacheAdvice(japan, "tokyo|food", advice);
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);

    loadSampleTrip();

    expect(getSnapshot().divert?.tripId).toBe(japan);
    expect(cachedAdvice(getSnapshot(), japan, "tokyo|food")).toEqual(advice);
  });

  it("keeps a diversion through a merge restore, drops it on replace, and never writes one out", () => {
    const japan = trip("Japan");
    startDivert({ tripId: japan, interestIds: ["coffee"], spot: spot() }, NOW);

    const backup = buildBackup();
    expect("divert" in backup.state).toBe(false);

    const parsed = parseBackup(JSON.stringify(backup));
    if ("error" in parsed) throw new Error(parsed.error);

    restore(parsed, "merge");
    expect(getSnapshot().divert?.tripId).toBe(japan);

    restore(parsed, "replace");
    expect(getSnapshot().divert).toBeUndefined();
  });

  it("ends the diversion when a merge restore brings back a copy of the trip without them", () => {
    const japan = trip("Japan");
    const older = parseBackup(JSON.stringify(buildBackup()));
    if ("error" in older) throw new Error(older.error);

    addTraveler(japan, { name: "Ria", passportCountry: "IN", passportExpiry: "" });
    const ria = travelers(japan).find((traveler) => traveler.name === "Ria")!;
    startDivert({ tripId: japan, travelerId: ria.id, interestIds: ["coffee"], spot: spot() }, NOW);

    restore(older, "merge");
    expect(getSnapshot().divert).toBeUndefined();
  });

  it("ends the diversion when a merge restore leaves the trip with a group of one", () => {
    const japan = trip("Japan");
    const [sehej, aanya] = travelers(japan);
    removeTraveler(japan, aanya.id);
    const older = parseBackup(JSON.stringify(buildBackup()));
    if ("error" in older) throw new Error(older.error);

    addTraveler(japan, { name: "Aanya", passportCountry: "IN", passportExpiry: "" });
    startDivert({ tripId: japan, travelerId: sehej.id, interestIds: ["coffee"], spot: spot() }, NOW);
    expect(getSnapshot().divert).toBeDefined();

    restore(older, "merge");
    expect(getSnapshot().divert).toBeUndefined();
  });

  it("reads a session of the wrong shape as no session", () => {
    const good: DivertSession = { tripId: "t1", interestIds: ["coffee"], spot: FUGLEN, startedAt: NOW.toISOString() };

    expect(isDivertSession(good)).toBe(true);
    expect(isDivertSession({ ...good, interestIds: { 0: "coffee" } })).toBe(false);
    expect(isDivertSession({ ...good, interestIds: "coffee" })).toBe(false);
    expect(isDivertSession({ ...good, spot: { ...FUGLEN, point: { lat: "35", lng: 139 } } })).toBe(false);
    expect(isDivertSession({ ...good, spot: undefined })).toBe(false);
    expect(isDivertSession({ ...good, startedAt: "yesterday-ish" })).toBe(false);
    expect(isDivertSession({ ...good, chosen: "TELEPORT" })).toBe(false);
    expect(isDivertSession({ ...good, from: { lat: Number.NaN, lng: 1 } })).toBe(false);
    expect(activeDivert({ divert: { ...good, interestIds: 42 } as unknown as DivertSession }, "t1", NOW)).toBeUndefined();
  });
});

describe("divert formatting", () => {
  it("reads a made-up name naturally mid-sentence, and leaves a filed name exactly as written", () => {
    expect(inSentence("A coffee stand near you", true)).toBe("a coffee stand near you");
    expect(inSentence("An izakaya near Ueno", true)).toBe("an izakaya near Ueno");
    expect(inSentence("On the way to Ueno Park", true)).toBe("on the way to Ueno Park");
    expect(inSentence("An Bang Beach", false)).toBe("An Bang Beach");
    expect(inSentence("A Brasileira", false)).toBe("A Brasileira");

    expect(atPlace("Ameyoko", false)).toBe("at Ameyoko");
    expect(atPlace("An Bang Beach", false)).toBe("at An Bang Beach");
    expect(atPlace("A coffee stand near you", true)).toBe("at a coffee stand near you");
    expect(atPlace("On the way to Ueno Park", true)).toBe("on the way to Ueno Park");
  });

  it("searches Maps sensibly for a stand-in", () => {
    expect(standInSearch("A coffee stand near you")).toBe("coffee stand near me");
    expect(standInSearch("A bench in the shade near the group")).toBe("bench in the shade near me");
    expect(standInSearch("A viewpoint near Senso-ji")).toBe("viewpoint near Senso-ji");
  });

  it("rounds distances the way a person would say them", () => {
    expect(formatDistance(NEAR_ENOUGH_M - 1)).toBe("here");
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

  it("tells the time in the route's own offset, or the device's when it has none", () => {
    const clock = new Date("2026-10-18T01:20:00Z");
    expect(wallClock(clock, "+09:00", 10)).toBe("10:30");
    expect(wallClock(clock, "-05:00", 10)).toBe("20:30");
    expect(wallClock(clock, "+05:45")).toBe("07:05");
    expect(wallClock(clock, "+00:00")).toBe("01:20");

    const local = new Date(clock.getTime() + 10 * 60_000);
    const pad = (value: number) => String(value).padStart(2, "0");
    expect(wallClock(clock, "", 10)).toBe(`${pad(local.getHours())}:${pad(local.getMinutes())}`);
  });
});
