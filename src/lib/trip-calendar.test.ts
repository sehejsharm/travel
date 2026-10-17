import { describe, expect, it } from "vitest";
import { adviceKey, CALENDAR_INTEREST, calendarSection, shownSections } from "./advisor/calendar";
import { getInterest } from "./advisor/interests";
import { TIER_LABELS, type AdviceResult } from "./advisor/types";
import type { Trip, TripItem } from "./domain/types";
import { loadHolidays, primeHolidays, type HolidayKind } from "./reference/holidays";
import { publicHolidays } from "./rules/openings";
import {
  calendarCountries,
  formatEventDates,
  holidayTone,
  isDayOff,
  KIND_LABELS,
  MARK_TONE,
  tripCalendar,
  tripEvents,
} from "./trip-calendar";

/*
 * Made-up countries (XA to XD), primed once, so these tests do not depend on
 * the generated data. The last block reads the real files.
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

/** Runs: one that starts before the trip, a day off over three days, an observance with no note, and a festival held twice. */
const TULIPS = "Gardens open every day. Runs 28 April to 12 May.";
primeHolidays("XD", {
  from: 2026,
  to: 2050,
  entries: [
    ...run("2026-04-28", 15, "festival", "Tulip Season", TULIPS),
    ...run("2026-05-02", 2, "festival", "Jazz Weekend", "Runs 2 to 3 May."),
    ...run("2026-05-09", 2, "festival", "Jazz Weekend", "Runs 9 to 10 May."),
    ...run("2026-05-03", 3, "public", "Spring Days", ""),
    ...run("2026-05-06", 3, "observance", "Kite Week", ""),
    ...run("2026-05-07", 2, "optional", "Harbour Days", "Day off in the port"),
  ],
});

/** One entry a day for a run of days, as the data holds it. */
function run(first: string, count: number, kind: HolidayKind, name: string, note: string) {
  return days(first, count).map((date): [string, HolidayKind, string, string] => [date, kind, name, note]);
}

/** The dates from a first one, one a day. */
function days(first: string, count: number): string[] {
  const [year, month, day] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10),
  );
}

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
  it("adds a day with nothing planned only for a day off", () => {
    const calendar = tripCalendar(trip(), []);

    // The Lantern Fair, Harvest Day and Mothers' Day fall on days with
    // nothing planned and no day off, so they add no day of their own.
    expect(daysOf(calendar)).toEqual({
      "2026-05-01": ["XA Labour Day"],
      "2026-05-09": ["XA Bank Day"],
    });
    expect(calendar.countries).toEqual(["XA"]);
  });

  it("shows festivals, days off for some and observances on days with plans", () => {
    const planned = [
      item({ id: "a", startsAt: "2026-05-03T10:00:00+02:00", place: { name: "Museum", countryCode: "XA" } }),
      item({ id: "b", startsAt: "2026-05-04T10:00:00+02:00", place: { name: "Park", countryCode: "XA" } }),
      item({ id: "c", startsAt: "2026-05-06T10:00:00+02:00", place: { name: "Gallery", countryCode: "XA" } }),
    ];

    expect(daysOf(tripCalendar(trip(), planned))).toEqual({
      "2026-05-01": ["XA Labour Day"],
      "2026-05-03": ["XA Lantern Fair", "XA Mothers' Day"],
      // The fair is already on the 3rd; the day off for some shows on its day.
      "2026-05-04": ["XA Harvest Day"],
      "2026-05-06": ["XA Tax Day"],
      "2026-05-09": ["XA Bank Day"],
    });
  });

  it("lists days off first, then partial ones, festivals and observances", () => {
    const onThe4th = [item({ startsAt: "2026-05-04T10:00:00+02:00", place: { name: "Park", countryCode: "XA" } })];
    const marks = tripCalendar(trip(), onThe4th).days.get("2026-05-04")!;
    expect(marks.map((mark) => mark.kind)).toEqual(["optional", "festival"]);

    const mixed = tripCalendar(trip({ destinationCountries: ["XA", "XB"] }), []).days.get("2026-05-02")!;
    expect(mixed.map((mark) => `${mark.kind} ${mark.countryCode}`)).toEqual(["public XB", "festival XA"]);
  });

  it("shows a festival once over its run, on the first day shown inside it, with when it runs", () => {
    const calendar = tripCalendar(trip({ destinationCountries: ["XD"] }), []);

    // Only the Spring Days put days on the timeline. The tulips started
    // before the trip, so they show on the first of those, and not again.
    expect(daysOf(calendar)).toEqual({
      "2026-05-03": ["XD Spring Days", "XD Jazz Weekend", "XD Tulip Season"],
      "2026-05-04": ["XD Spring Days"],
      "2026-05-05": ["XD Spring Days"],
    });
    const tulips = calendar.days.get("2026-05-03")!.find((mark) => mark.name === "Tulip Season");
    expect(tulips?.note).toBe(TULIPS);
  });

  it("follows a run back past the trip's start, to a planned day before it", () => {
    const early = item({ startsAt: "2026-04-29T10:00:00+02:00", place: { name: "Gardens", countryCode: "XD" } });
    const days = daysOf(tripCalendar(trip({ destinationCountries: ["XD"] }), [early]));

    expect(days["2026-04-29"]).toEqual(["XD Tulip Season"]);
    expect(days["2026-05-03"]).toEqual(["XD Spring Days", "XD Jazz Weekend"]);
  });

  it("keeps a day off on every day, and says when an observance runs if the data does not", () => {
    const planned = ["2026-05-01", "2026-05-07", "2026-05-08", "2026-05-10"].map((day, index) =>
      item({ id: `p${index}`, startsAt: `${day}T10:00:00+02:00`, place: { name: "Harbour", countryCode: "XD" } }),
    );
    const calendar = tripCalendar(trip({ destinationCountries: ["XD"] }), planned);

    expect(daysOf(calendar)).toEqual({
      "2026-05-01": ["XD Tulip Season"],
      "2026-05-03": ["XD Spring Days", "XD Jazz Weekend"],
      "2026-05-04": ["XD Spring Days"],
      "2026-05-05": ["XD Spring Days"],
      "2026-05-07": ["XD Harbour Days", "XD Kite Week"],
      "2026-05-08": ["XD Harbour Days"],
      // The same festival again, a week later: a run of its own.
      "2026-05-10": ["XD Jazz Weekend"],
    });
    const kites = calendar.days.get("2026-05-07")!.find((mark) => mark.name === "Kite Week");
    expect(kites?.note).toBe("Runs 6 to 8 May.");
    expect(calendar.days.get("2026-05-10")![0].note).toBe("Runs 9 to 10 May.");
  });

  it("applies each country's calendar to its own leg only", () => {
    const legs = trip({
      destinationCountries: ["XA", "XB"],
      legs: [
        { id: "a", countryCode: "XA", startDate: "2026-05-01", endDate: "2026-05-04" },
        { id: "b", countryCode: "XB", startDate: "2026-05-05", endDate: "2026-05-10" },
      ],
    });
    const onThe2nd = [item({ startsAt: "2026-05-02T10:00:00+02:00", place: { name: "Fair", countryCode: "XA" } })];
    const days = daysOf(tripCalendar(legs, onThe2nd));

    // XB's Founding Day falls in XA's leg, and XA's Bank Day in XB's.
    expect(days["2026-05-02"]).toEqual(["XA Lantern Fair"]);
    expect(days["2026-05-08"]).toEqual(["XB Liberation Day"]);
    expect(days["2026-05-09"]).toBeUndefined();
  });

  it("marks a planned day outside the trip's dates with that country's calendar", () => {
    const early = item({ startsAt: "2026-05-20T09:00:00+02:00", place: { name: "Gallery", countryCode: "xa" } });
    expect(daysOf(tripCalendar(trip(), [early]))["2026-05-20"]).toEqual(["XA Late Day"]);
  });

  it("leaves the home country out of a trip abroad", () => {
    const home = trip({ homeCountry: "XA", destinationCountries: ["XA", "XB"] });
    expect(tripCalendar(home, []).countries).toEqual(["XB"]);
    expect(daysOf(tripCalendar(home, []))["2026-05-01"]).toBeUndefined();
  });

  it("gives a trip at home the home country's calendar", () => {
    const domestic = trip({ homeCountry: "XA", destinationCountries: ["XA"] });

    expect(tripCalendar(domestic, []).countries).toEqual(["XA"]);
    expect(daysOf(tripCalendar(domestic, []))).toEqual({
      "2026-05-01": ["XA Labour Day"],
      "2026-05-09": ["XA Bank Day"],
    });
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

describe("which countries' calendars apply", () => {
  it("uses the destinations when there are any", () => {
    expect(calendarCountries(trip({ destinationCountries: ["XA", "XB"] }), [])).toEqual(["XA", "XB"]);
    expect(calendarCountries(trip({ homeCountry: "XA", destinationCountries: ["XA", "XB"] }), [])).toEqual(["XB"]);
  });

  it("uses the home country for a trip at home, from its destinations, legs or places", () => {
    const home = { homeCountry: "XA", destinationCountries: [] };
    expect(calendarCountries(trip({ homeCountry: "XA", destinationCountries: ["xa"] }), [])).toEqual(["XA"]);
    expect(
      calendarCountries(trip({ ...home, legs: [{ id: "l", countryCode: "XA", startDate: "2026-05-01", endDate: "2026-05-03" }] }), []),
    ).toEqual(["XA"]);
    expect(calendarCountries(trip(home), [item({ place: { name: "Cottage", countryCode: "XA" } })])).toEqual(["XA"]);
  });

  it("is empty when nothing says where the trip goes", () => {
    expect(calendarCountries(trip({ homeCountry: "XA", destinationCountries: [] }), [])).toEqual([]);
    expect(calendarCountries(trip({ homeCountry: "", destinationCountries: [] }), [])).toEqual([]);
  });

  it("gives Discover a trip at home's events too", () => {
    const domestic = tripEvents(trip({ homeCountry: "XA", destinationCountries: ["XA"] }), []);
    expect(domestic).toMatchObject({ ready: true, countries: ["XA"] });
    expect(domestic.events.map((event) => event.name)).toContain("Lantern Fair");
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

  it("gives days off the warning tone and everything else a quiet one", () => {
    expect(Object.keys(MARK_TONE).sort()).toEqual(Object.keys(KIND_LABELS).sort());
    expect(holidayTone("public")).toBe("warning");
    expect(holidayTone("bank")).toBe("warning");
    expect(["optional", "festival", "observance"].map((kind) => holidayTone(kind as never))).toEqual([
      "neutral",
      "neutral",
      "neutral",
    ]);
  });
});

describe("what Discover lists from the calendar", () => {
  const onTrip = tripEvents(trip(), []);

  it("lists festivals and days off for everyone, not observances or days off for some", () => {
    expect(calendarSection(onTrip).map((event) => `${event.kind} ${event.name}`)).toEqual([
      "public Labour Day",
      "festival Lantern Fair",
      "bank Bank Day",
    ]);
  });

  it("lists nothing while no festival is on, the dates are a placeholder or a calendar is to come", () => {
    // Days off alone, or an observance alone, are not festivals.
    expect(calendarSection(tripEvents(trip({ destinationCountries: ["XB"] }), []))).toEqual([]);
    expect(calendarSection(tripEvents(trip({ destinationCountries: ["XC"] }), []))).toEqual([]);
    expect(calendarSection(tripEvents(trip({ datesTbd: true }), []))).toEqual([]);
    expect(calendarSection(tripEvents(trip({ destinationCountries: ["KR"] }), []))).toEqual([]);
  });

  it("labels its section the way the sourcing card does", () => {
    expect(getInterest(CALENDAR_INTEREST)?.label).toBe("Festivals & shows");
    expect(TIER_LABELS.calendar).toBe("From Manifest's calendar");
  });

  it("keys the cache by the destination and every interest, sorted, as it always was", () => {
    expect(adviceKey("Kyoto", ["nature", "food"])).toBe("kyoto|food,nature");
    expect(adviceKey("Kyoto", ["food", "festivals", "nature"])).toBe("kyoto|festivals,food,nature");
  });

  it("puts the calendar's section right after the search's Festivals & shows, in pick order", () => {
    const section = (interestId: string) => ({ interestId, suggestions: [] });
    const advice: AdviceResult = {
      destination: "Kyoto",
      sections: [section("art"), section("festivals"), section("food"), section("history")],
      tiersUsed: ["community"],
      generatedAt: "2026-10-17T00:00:00Z",
    };
    const order = (shown: ReturnType<typeof shownSections>) => shown.map((entry) => `${entry.source} ${entry.interestId}`);

    expect(order(shownSections(["food", "festivals", "art"], true, advice))).toEqual([
      "search food",
      "search festivals",
      "calendar festivals",
      "search art",
      // Held from an earlier pick: it still shows, after the rest.
      "search history",
    ]);
    expect(order(shownSections(["food", "festivals"], false, advice))).toEqual([
      "search food",
      "search festivals",
      "search art",
      "search history",
    ]);
  });

  it("shows the calendar's section before any search, or when the search failed", () => {
    expect(shownSections(["food", "festivals"], true, undefined)).toEqual([
      { interestId: "festivals", source: "calendar" },
    ]);
    expect(shownSections(["food"], true, undefined)).toEqual([]);
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

  it("lists Diwali and the festivals around it for India, and no observances or regional days", async () => {
    await loadHolidays(["IN"]);
    const listed = calendarSection(tripEvents(india, []));
    const named = Object.fromEntries(listed.map((event) => [event.name, event]));

    expect(named.Diwali).toMatchObject({ kind: "public", startDate: "2026-11-08" });
    expect(listed.filter((event) => event.startDate === "2026-11-08")[0].name).toBe("Diwali");
    expect(named.Dhanteras?.kind).toBe("festival");
    expect(named["Bhai Dooj"]?.kind).toBe("festival");
    expect(listed.every((event) => ["festival", "public", "bank"].includes(event.kind))).toBe(true);
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

  it("puts Keukenhof's 53 days on the timeline once, on the first day shown inside them", async () => {
    await loadHolidays(["NL"]);
    const april = trip({ homeCountry: "GB", destinationCountries: ["NL"], startDate: "2026-04-01", endDate: "2026-04-30" });
    const planned = ["2026-04-02", "2026-04-10", "2026-04-20"].map((day, index) =>
      item({ id: `nl${index}`, startsAt: `${day}T10:00:00+02:00`, place: { name: "Lisse", countryCode: "NL" } }),
    );
    const calendar = tripCalendar(april, planned);
    const withTulips = [...calendar.days].filter(([, marks]) => marks.some((mark) => /Keukenhof/.test(mark.name)));

    expect(withTulips.map(([day]) => day)).toEqual(["2026-04-02"]);
    expect(withTulips[0][1].find((mark) => /Keukenhof/.test(mark.name))?.note).toMatch(/Runs 19 March to 10 May/);
    // Days off still show on their own days.
    expect([...calendar.days.keys()]).toEqual(expect.arrayContaining(["2026-04-06", "2026-04-27"]));
  });

  it("puts Germany's Christmas markets on a day of plans once, and keeps each Christmas day off", async () => {
    await loadHolidays(["DE"]);
    const december = trip({ homeCountry: "GB", destinationCountries: ["DE"], startDate: "2026-12-01", endDate: "2026-12-28" });
    const everyDay = days("2026-12-01", 28).map((day, index) =>
      item({ id: `de${index}`, startsAt: `${day}T18:00:00+01:00`, place: { name: "Nuremberg", countryCode: "DE" } }),
    );
    const calendar = tripCalendar(december, everyDay);
    const markets = [...calendar.days].filter(([, marks]) => marks.some((mark) => mark.name === "Christmas markets"));

    expect(markets.map(([day]) => day)).toEqual(["2026-12-01"]);
    for (const day of ["2026-12-25", "2026-12-26"]) {
      expect(calendar.days.get(day)?.some((mark) => isDayOff(mark.kind)), day).toBe(true);
    }
  });
});
