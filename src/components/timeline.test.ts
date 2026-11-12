import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Flag, PlaceRef, Trip, TripItem } from "@/lib/domain/types";
import { primeHolidays, type HolidayKind } from "@/lib/reference/holidays";
import { Timeline } from "./timeline";

/*
 * The timeline as static HTML, over a made-up country (XT), so it does not
 * depend on the generated data: a fair over the whole trip, a day off on its
 * fourth day, a festival on a day with nothing planned.
 */
primeHolidays("XT", {
  from: 2026,
  to: 2050,
  entries: [
    ...["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"].map(
      (date): [string, HolidayKind, string, string] => [date, "festival", "Rose Fair", "Runs 1 to 6 June."],
    ),
    ["2026-06-03", "festival", "Night Parade", ""],
    ["2026-06-03", "optional", "Port Day", "Day off in the port"],
    ["2026-06-04", "public", "Union Day", ""],
    ["2026-06-05", "public", "Union Day (second day)", ""],
  ],
});

const trip: Trip = {
  id: "t1",
  name: "June",
  homeCountry: "GB",
  destinationCountries: ["XT"],
  startDate: "2026-06-01",
  endDate: "2026-06-06",
  travelers: [],
};

function item(overrides: Partial<TripItem>): TripItem {
  return {
    id: "i1",
    tripId: "t1",
    title: "Something",
    category: "activity",
    source: "manual",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function render(items: TripItem[], given: Trip = trip, flags: Flag[] = []): string {
  return renderToStaticMarkup(createElement(Timeline, { items, flags, onSelect: () => {}, trip: given }));
}

/** Each day's heading, in order. */
function headings(html: string): string[] {
  return [...html.matchAll(/<h3 class="text-headline">([^<]*)</g)].map((match) => match[1]);
}

function count(html: string, text: string): number {
  return html.split(text).length - 1;
}

describe("the timeline's days", () => {
  it("adds a day with nothing planned for a day off only", () => {
    const html = render([]);

    expect(headings(html)).toEqual(["Day 4", "Day 5"]);
    expect(html).toContain("Union Day");
    // The festivals and the day off for some fall on days that are not shown.
    expect(html).not.toContain("Night Parade");
    expect(html).not.toContain("Port Day");
  });

  it("shows a festival's run once, on the first day shown, and a day off on each of its days", () => {
    const planned = [
      item({ id: "a", title: "Harbour walk", startsAt: "2026-06-02T10:00:00+02:00", place: { name: "Harbour", countryCode: "XT" } }),
      item({ id: "b", title: "Boat trip", startsAt: "2026-06-03T10:00:00+02:00", place: { name: "Quay", countryCode: "XT" } }),
      item({ id: "c", title: "Museum", startsAt: "2026-06-06T10:00:00+02:00", place: { name: "Museum", countryCode: "XT" } }),
    ];
    const html = render(planned);

    expect(headings(html)).toEqual(["Day 2", "Day 3", "Day 4", "Day 5", "Day 6"]);
    expect(count(html, "Rose Fair")).toBe(1);
    expect(count(html, "Runs 1 to 6 June.")).toBe(1);
    expect(html.indexOf("Rose Fair")).toBeLessThan(html.indexOf("Boat trip"));
    // On a day with plans, the rest of what is on shows.
    expect(html).toContain("Night Parade");
    expect(html).toContain("Port Day");
    expect(count(html, ">Day off<")).toBe(2);
  });

  it("marks a day off in the warning tone and a festival in a quiet one", () => {
    const html = render([item({ startsAt: "2026-06-04T10:00:00+02:00", place: { name: "Square", countryCode: "XT" } })]);

    expect(html).toMatch(/bg-warning-soft text-warning[^>]*>Day off</);
    expect(html).toMatch(/bg-surface-2 text-ink-soft[^>]*>Festival</);
  });

  it("marks a trip at home with the home country's days off", () => {
    const home = { ...trip, homeCountry: "XT", destinationCountries: ["XT"] };
    expect(headings(render([], home))).toEqual(["Day 4", "Day 5"]);
  });
});

function flag(id: string, severity: Flag["severity"], itemIds: string[]): Flag {
  return { id, severity, category: "conflict", title: `Flag ${id}`, detail: "", itemIds };
}

describe("a day's spend", () => {
  it("is totalled in the budget's currency, not in dollars", () => {
    const html = render(
      [item({ startsAt: "2026-06-02T10:00:00+02:00", cost: { amount: 2600, currency: "JPY" } })],
      { ...trip, budgetTarget: { amount: 150000, currency: "INR" } },
    );

    // 2,600 yen at 149 to the dollar and 87 rupees to the dollar.
    expect(html).toContain("1 stop · ₹1,518.12");
    expect(html).not.toContain("$");
  });
});

describe("a flagged row's chip", () => {
  const planned = [
    item({ id: "a", title: "Garden", startsAt: "2026-06-02T09:00:00+02:00" }),
    item({ id: "b", title: "Concert", startsAt: "2026-06-02T10:00:00+02:00" }),
  ];

  it("names the problem, in amber for a warning and red for a critical", () => {
    const html = render(planned, trip, [
      flag("advance:a", "warning", ["a"]),
      flag("name-mismatch", "warning", ["b"]),
      flag("overlap:a:b", "critical", ["b"]),
      flag("busy-day:2026-06-02", "info", ["a", "b"]),
    ]);

    expect(html).toMatch(/bg-warning-soft text-warning[^>]*>Book ahead</);
    // The worst flag on the row is the one it names.
    expect(html).toMatch(/bg-critical-soft text-critical[^>]*>Overlaps</);
    expect(html).not.toContain("Name differs");
    expect(html).not.toContain(">Check<");
  });

  it("falls back to the flag's own words for a check it has no label for", () => {
    expect(render(planned, trip, [flag("new-check:a", "warning", ["a"])])).toContain(">Flag new-check:a<");
  });
});

describe("the hop between two stops", () => {
  // The hop's line is several text nodes, which static markup separates with comments.
  const show = (...args: Parameters<typeof render>) => render(...args).replaceAll("<!-- -->", "");
  const airport = (code: string, lat: number, lng: number): PlaceRef => ({
    name: code,
    city: code,
    countryCode: "XT",
    point: { lat, lng },
    airport: code,
  });
  const inbound = item({
    id: "in",
    title: "TG683 HND → BKK",
    bookingKind: "flight",
    startsAt: "2026-06-03T00:10:00+09:00",
    endsAt: "2026-06-03T04:50:00+07:00",
    place: airport("HND", 35.5494, 139.7798),
    arrivalPlace: airport("BKK", 13.69, 100.7501),
  });
  const onward = item({
    id: "out",
    title: "TG315 BKK → DEL",
    bookingKind: "flight",
    startsAt: "2026-06-03T05:35:00+07:00",
    endsAt: "2026-06-03T08:25:00+05:30",
    place: airport("BKK", 13.69, 100.7501),
    arrivalPlace: airport("DEL", 28.5562, 77.1),
  });

  it("shows two flights through one airport as the connection there, with no directions", () => {
    const html = show([inbound, onward]);

    expect(html).toMatch(/text-ink-soft[^>]*>45 min at BKK</);
    expect(html).not.toContain("fly ·");
    expect(html).not.toContain("Directions");
  });

  it("shows a connection the layover check calls short in the warning tone", () => {
    const html = show([inbound, onward], trip, [flag("layover:in:out", "critical", ["in", "out"])]);

    expect(html).toMatch(/text-warning[^>]*>45 min at BKK</);
  });

  it("starts after a flight at the airport it lands at", () => {
    const hotel = item({
      id: "h",
      title: "Hotel",
      startsAt: "2026-06-03T09:00:00+07:00",
      place: { name: "Hotel", countryCode: "XT", point: { lat: 13.7563, lng: 100.5018 } },
    });
    const html = show([inbound, hotel]);

    expect(html).toContain("transit · ");
    expect(html).toContain(`origin=${encodeURIComponent("13.69,100.7501")}`);
  });

  it("gives a long hop in hours and minutes, and a flight's no directions", () => {
    const at = (id: string, startsAt: string, lat: number, lng: number) =>
      item({ id, title: id, startsAt, place: { name: id, countryCode: "XT", point: { lat, lng } } });

    const drive = show([
      at("Tokyo", "2026-06-02T08:00:00+09:00", 35.6812, 139.7671),
      at("Kyoto", "2026-06-02T18:00:00+09:00", 34.9858, 135.7588),
    ]);
    expect(drive).toMatch(/drive · \d+ h \d+ min · \d+ km/);
    expect(drive).toMatch(/>Directions<\/a>/);

    const fly = show([
      at("Tokyo", "2026-06-02T08:00:00+09:00", 35.6812, 139.7671),
      at("Bangkok", "2026-06-02T20:00:00+07:00", 13.7563, 100.5018),
    ]);
    expect(fly).toMatch(/fly · \d+ h \d+ min · \d+ km/);
    expect(fly).not.toContain("Directions");
  });
});
