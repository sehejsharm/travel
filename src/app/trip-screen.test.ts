import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Trip, TripItem } from "@/lib/domain/types";
import { primeHolidays } from "@/lib/reference/holidays";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * The trip screen as static HTML, with the trip view stubbed so it renders as
 * if hydrated, over a made-up country (XS): a day off and a festival in the
 * trip's dates, and a day off after them.
 */
const view: { current?: TripView } = {};
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: () => view.current!,
}));

primeHolidays("XS", {
  from: 2026,
  to: 2050,
  entries: [
    ["2026-09-02", "festival", "Wine Week", "Runs 2 to 3 September."],
    ["2026-09-03", "festival", "Wine Week", "Runs 2 to 3 September."],
    ["2026-09-03", "public", "Harvest Holiday", ""],
    ["2026-09-20", "public", "Late Holiday", ""],
  ],
});

const TripScreen = (await import("./page")).default;

function show(trip: Trip, items: TripItem[] = []): string {
  const state = { trips: [trip], activeTripId: trip.id, items, checklist: [], advice: [] } as unknown as AppState;
  view.current = { state, trip, items, checklist: [], flags: [], hydrated: true, empty: false };
  return renderToStaticMarkup(createElement(TripScreen));
}

const trip: Trip = {
  id: "t1",
  name: "September",
  homeCountry: "GB",
  destinationCountries: ["XS"],
  startDate: "2026-09-01",
  endDate: "2026-09-07",
  travelers: [],
};

describe("the trip screen with nothing scheduled", () => {
  it("keeps the empty state and its action, with the trip's days off under it", () => {
    const html = show(trip);

    expect(html).toContain("Nothing scheduled yet");
    expect(html).toContain('href="/add"');
    expect(html).toContain("Days off on your dates");
    expect(html).toContain("Harvest Holiday");
    // The festival is on that day too; the day off after the trip is not.
    expect(html).toContain("Wine Week");
    expect(html).not.toContain("Late Holiday");
    expect(html.indexOf("Nothing scheduled yet")).toBeLessThan(html.indexOf("Harvest Holiday"));
  });

  it("shows the empty state alone when the trip has no day off", () => {
    const html = show({ ...trip, startDate: "2026-09-04", endDate: "2026-09-07" });

    expect(html).toContain("Nothing scheduled yet");
    expect(html).not.toContain("Days off on your dates");
  });

  it("shows no days off for dates that are not settled", () => {
    expect(show({ ...trip, datesTbd: true })).not.toContain("Days off on your dates");
  });

  it("shows the timeline instead once something is on a day", () => {
    const planned: TripItem = {
      id: "i1",
      tripId: "t1",
      title: "Cellar tour",
      category: "activity",
      source: "manual",
      confidence: 1,
      extractionMethod: "deterministic",
      createdAt: "2026-01-01T00:00:00Z",
      startsAt: "2026-09-02T11:00:00+02:00",
      place: { name: "Cellar", countryCode: "XS" },
    };
    const html = show(trip, [planned]);

    expect(html).not.toContain("Nothing scheduled yet");
    expect(html).not.toContain("Days off on your dates");
    expect(html).toContain("Cellar tour");
    expect(html).toContain("Harvest Holiday");
  });
});
