import { describe, expect, it } from "vitest";
import {
  adviceKey,
  CALENDAR_INTEREST,
  calendarAnswered,
  interestsToLookUp,
} from "./advisor/calendar";
import { getInterest, INTERESTS } from "./advisor/interests";
import { TIER_LABELS } from "./advisor/types";
import type { Trip, TripItem } from "./domain/types";
import { loadHolidays, primeHolidays } from "./reference/holidays";
import { publicHolidays } from "./rules/openings";
import {
  formatEventDates,
  isDayOff,
  KIND_LABELS,
  tripCalendar,
  tripEvents,
} from "./trip-calendar";

/*
 * Made-up countries (XA, XB, XC), primed once, so these tests do not depend
 * on the generated data. The last block reads the real files.
 */
primeHolidays("XA", {
  from: 2026,
  to: 2050,
  entries: [
    ["2026-05-01", "public", "Labour Day", ""],
    ["2026-05-02", "festival", "Lantern Fair", "Runs 2 May to 4 May"],
    ["2026-05-03", "festival", "Lantern Fair", "Runs 2 May to 4 May"],
    ["2026-05-03", "observance", "Mothers' Day", ""],
    ["2026-05-04", "festival", "Lantern Fair", "Runs 2 May to 4 May"],
    ["2026-05-04", "optional", "Harvest Day", "Day off in the north"],
    ["2026-05-06", "observance", "Tax Day", ""],
    ["2026-05-09", "bank", "Bank Day", ""],
    ["2026-05-20", "public", "Late Day", ""],
  ],
});
primeHolidays("XB", {
  from: 2026,
  to: 2050,
  entries: [
    ["2026-05-02", "public", "Founding Day", ""],
    ["2026-05-08", "public", "Liberation Day", ""],
  ],
});
primeHolidays("XC", { from: 2026, to: 2050, entries: [["2026-05-05", "observance", "Quiet Day", ""]] });

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    name: "Spring",
    homeCountry: "XH",
    destinationCountries: ["XA"],
    startDate: "2026-05-01",
    endDate: "2026-05-10",
    travelers: [],
    ...overrides,
  };
}

function item(overrides: Partial<TripItem>): TripItem {
  return {
    id: overrides.id ?? "item-1",
    tripId: "trip-1",
    title: "Something",
    category: "activity",
    source: "manual",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function daysOf(calendar: ReturnType<typeof tripCalendar>) {
  return Object.fromEntries(
    [...calendar.days].map(([day, marks]) => [day, marks.map((mark) => `${mark.countryCode} ${mark.name}`)]),
  );
}

describe("the trip's calendar, for the timeline", () => {
  it("marks every day of the trip that has a day off or a festival", () => {
    const calendar = tripCalendar(trip(), []);

    expect(daysOf(calendar)).toEqual({
      "2026-05-01": ["XA Labour Day"],
      "2026-05-02": ["XA Lantern Fair"],
      "2026-05-03": ["XA Lantern Fair", "XA Mothers' Day"],
      "2026-05-04": ["XA Harvest Day", "XA Lantern Fair"],
      "2026-05-09": ["XA Bank Day"],
    });
    expect(calendar.countries).toEqual(["XA"]);
  });

  it("gives an observance a line on a day with plans, but not a day of its own", () => {
    const planned = item({ startsAt: "2026-05-06T10:00:00+02:00", place: { name: "Museum", countryCode: "XA" } });

    expect(tripCalendar(trip(), []).days.has("2026-05-06")).toBe(false);
    expect(daysOf(tripCalendar(trip(), [planned]))["2026-05-06"]).toEqual(["XA Tax Day"]);
  });

  it("lists days off first, then partial ones, festivals and observances", () => {
    const marks = tripCalendar(trip(), []).days.get("2026-05-04")!;
    expect(marks.map((mark) => mark.kind)).toEqual(["optional", "festival"]);

    const mixed = tripCalendar(trip({ destinationCountries: ["XA", "XB"] }), []).days.get("2026-05-02")!;
    expect(mixed.map((mark) => `${mark.kind} ${mark.countryCode}`)).toEqual(["public XB", "festival XA"]);
  });

  it("applies each country's calendar to its own leg only", () => {
    const legs = trip({
      destinationCountries: ["XA", "XB"],
      legs: [
        { id: "a", countryCode: "XA", startDate: "2026-05-01", endDate: "2026-05-04" },
        { id: "b", countryCode: "XB", startDate: "2026-05-05", endDate: "2026-05-10" },
      ],
    });
    const days = daysOf(tripCalendar(legs, []));

    // XB's Founding Day falls in XA's leg, and XA's Bank Day in XB's.
    expect(days["2026-05-02"]).toEqual(["XA Lantern Fair"]);
    expect(days["2026-05-08"]).toEqual(["XB Liberation Day"]);
    expect(days["2026-05-09"]).toBeUndefined();
  });

  it("marks a planned day outside the trip's dates with that country's calendar", () => {
    const early = item({ startsAt: "2026-05-20T09:00:00+02:00", place: { name: "Gallery", countryCode: "xa" } });
    expect(daysOf(tripCalendar(trip(), [early]))["2026-05-20"]).toEqual(["XA Late Day"]);
  });

  it("leaves the home country out", () => {
    const home = trip({ homeCountry: "XA", destinationCountries: ["XA", "XB"] });
    expect(tripCalendar(home, []).countries).toEqual(["XB"]);
    expect(daysOf(tripCalendar(home, []))["2026-05-01"]).toBeUndefined();
  });

  it("claims nothing about a placeholder window, only about days with plans", () => {
    const unsettled = trip({ datesTbd: true });
    expect(tripCalendar(unsettled, []).days.size).toBe(0);

    const planned = item({ startsAt: "2026-05-01T12:00:00+02:00", arrivalPlace: { name: "XA airport", countryCode: "XA" } });
    expect(daysOf(tripCalendar(unsettled, [planned]))).toEqual({ "2026-05-01": ["XA Labour Day"] });
  });

  it("finds nothing for a country whose calendar has not loaded", () => {
    expect(tripCalendar(trip({ destinationCountries: ["XQ"] }), []).days.size).toBe(0);
  });
});

describe("the trip's events, for Discover", () => {
  it("joins a festival's days into one event and keeps the rest in date order", () => {
    const answer = tripEvents(trip(), []);

    expect(answer.ready).toBe(true);
    expect(answer.events.map((event) => [event.name, event.kind, event.startDate, event.endDate])).toEqual([
      ["Labour Day", "public", "2026-05-01", "2026-05-01"],
      ["Lantern Fair", "festival", "2026-05-02", "2026-05-04"],
      ["Mothers' Day", "observance", "2026-05-03", "2026-05-03"],
      ["Harvest Day", "optional", "2026-05-04", "2026-05-04"],
      ["Tax Day", "observance", "2026-05-06", "2026-05-06"],
      ["Bank Day", "bank", "2026-05-09", "2026-05-09"],
    ]);
    expect(answer.events[1].note).toBe("Runs 2 May to 4 May");
    expect(new Set(answer.events.map((event) => event.id)).size).toBe(answer.events.length);
  });

  it("lists a day off for everyone before the festivals on the same day", () => {
    const both = tripEvents(trip({ destinationCountries: ["XA", "XB"], startDate: "2026-05-02", endDate: "2026-05-02" }), []);
    expect(both.events.map((event) => `${event.kind} ${event.name}`)).toEqual([
      "public Founding Day",
      "festival Lantern Fair",
    ]);
  });

  it("covers only the days the trip is there", () => {
    const short = tripEvents(trip({ startDate: "2026-05-03", endDate: "2026-05-03" }), []);
    expect(short.events.map((event) => `${event.name} ${event.startDate}–${event.endDate}`)).toEqual([
      "Lantern Fair 2026-05-03–2026-05-03",
      "Mothers' Day 2026-05-03–2026-05-03",
    ]);
  });

  it("is not ready while the dates are a placeholder or a calendar is still to come", () => {
    expect(tripEvents(trip({ datesTbd: true }), [])).toMatchObject({ ready: false, events: [] });
    expect(tripEvents(trip({ destinationCountries: ["KR"] }), []).ready).toBe(false);
    expect(tripEvents(trip({ destinationCountries: [] }), []).ready).toBe(false);
  });

  it("is ready, with nothing on, for a country with no calendar at all", () => {
    expect(tripEvents(trip({ destinationCountries: ["XQ"] }), [])).toMatchObject({ ready: true, events: [] });
  });

  it("formats one day or a run of days", () => {
    expect(formatEventDates("2026-11-08", "2026-11-08")).toBe("Sun 8 Nov");
    expect(formatEventDates("2026-10-31", "2026-11-02")).toBe("Sat 31 Oct – Mon 2 Nov");
  });

  it("names every kind, and counts only public and bank holidays as days off", () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual(["bank", "festival", "observance", "optional", "public"]);
    expect(["public", "bank", "optional", "festival", "observance"].filter((kind) => isDayOff(kind as never))).toEqual([
      "public",
      "bank",
    ]);
  });
});

describe("what Discover still looks up", () => {
  const answered = tripEvents(trip(), []);
  const nothingOn = tripEvents(trip({ destinationCountries: ["XQ"] }), []);
  const unsettled = tripEvents(trip({ datesTbd: true }), []);

  it("answers the festivals interest, which exists, from the calendar", () => {
    expect(getInterest(CALENDAR_INTEREST)?.label).toBe("Festivals & shows");
    expect(TIER_LABELS.calendar).toBe("From Manifest's calendar");
    expect(calendarAnswered(answered)).toBe(true);
    expect(calendarAnswered(nothingOn)).toBe(false);
    expect(calendarAnswered(unsettled)).toBe(false);
  });

  it("never sends the paid tiers what the calendar answered, and keeps the order", () => {
    expect(interestsToLookUp(["food", "festivals", "art"], answered)).toEqual(["food", "art"]);
    expect(interestsToLookUp(["festivals"], answered)).toEqual([]);
  });

  it("still looks festivals up when the calendar has nothing to say", () => {
    expect(interestsToLookUp(["food", "festivals"], nothingOn)).toEqual(["food", "festivals"]);
    expect(interestsToLookUp(["festivals"], unsettled)).toEqual(["festivals"]);
    expect(interestsToLookUp(["food"], answered)).toEqual(["food"]);
  });

  it("keys the cache by what was looked up, in the format it always had", () => {
    expect(adviceKey("Kyoto", ["nature", "food"])).toBe("kyoto|food,nature");
    expect(adviceKey("Kyoto", interestsToLookUp(["food", "festivals", "nature"], answered))).toBe(
      "kyoto|food,nature",
    );
  });

  it("can send every interest but the calendar's, within the route's limit", () => {
    const all = INTERESTS.map((interest) => interest.id);
    expect(interestsToLookUp(all, answered)).toHaveLength(all.length - 1);
  });
});

describe("with the generated calendar", () => {
  const japan = trip({ homeCountry: "IN", destinationCountries: ["JP"], startDate: "2026-10-09", endDate: "2026-10-18" });
  const india = trip({ homeCountry: "GB", destinationCountries: ["IN"], startDate: "2026-11-01", endDate: "2026-11-14" });

  it("marks Japan's Sports Day as a day off, and the checks see it once it loads", async () => {
    await loadHolidays(["JP", "IN"]);

    const marks = tripCalendar(japan, []).days.get("2026-10-12")!;
    expect(marks.find((mark) => mark.name === "Sports Day")?.kind).toBe("public");
    expect(publicHolidays({ trip: japan, items: [], now: new Date("2026-09-01") })[0]?.title).toBe(
      "1 public holiday during your trip",
    );
  });

  it("puts Diwali and the days around it in Festivals & shows for India", async () => {
    await loadHolidays(["IN"]);
    const answer = tripEvents(india, []);
    const named = Object.fromEntries(answer.events.map((event) => [event.name, event]));

    expect(calendarAnswered(answer)).toBe(true);
    expect(named.Diwali).toMatchObject({ kind: "public", startDate: "2026-11-08" });
    const eighth = answer.events.filter((event) => event.startDate === "2026-11-08").map((event) => event.name);
    expect(eighth[0]).toBe("Diwali");
    expect(named.Dhanteras?.kind).toBe("festival");
    expect(named["Bhai Dooj"]?.kind).toBe("festival");
    expect(interestsToLookUp(["food", "festivals"], answer)).toEqual(["food"]);
  });

  it("has Diwali, Holi and both Eids in every year to 2050", async () => {
    await loadHolidays(["IN"]);
    for (let year = 2026; year <= 2050; year++) {
      const whole = trip({ homeCountry: "GB", destinationCountries: ["IN"], startDate: `${year}-01-01`, endDate: `${year}-12-31` });
      const names = new Set(tripEvents(whole, []).events.map((event) => event.name));
      for (const name of ["Diwali", "Holi", "Eid al-Fitr", "Eid al-Adha"]) {
        expect(names.has(name), `${name} ${year}`).toBe(true);
      }
    }
  });
});
