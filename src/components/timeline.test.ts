import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Trip, TripItem } from "@/lib/domain/types";
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

function render(items: TripItem[], given: Trip = trip): string {
  return renderToStaticMarkup(createElement(Timeline, { items, flags: [], onSelect: () => {}, trip: given }));
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
