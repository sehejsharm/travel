import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Flag, Trip, TripItem } from "@/lib/domain/types";
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

function show(trip: Trip, items: TripItem[] = [], flags: Flag[] = []): string {
  const state = { trips: [trip], activeTripId: trip.id, items, checklist: [], advice: [] } as unknown as AppState;
  view.current = { state, trip, items, checklist: [], flags, hydrated: true, empty: false };
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

function item(id: string, title: string, startsAt?: string): TripItem {
  return {
    id,
    tripId: "t1",
    title,
    category: "activity",
    source: "manual",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-01-01T00:00:00Z",
    startsAt,
  };
}

const critical: Flag = {
  id: "f1",
  severity: "critical",
  category: "compliance",
  title: "Passport runs out",
  detail: "It expires before the trip ends.",
  itemIds: [],
};

describe("the trip screen's composition", () => {
  it("counts what is left to fix once, in the hero, with one way to Checks", () => {
    const html = show(trip, [item("i1", "Cellar tour", "2026-09-02T11:00:00+02:00")], [critical]);

    expect(html).toContain("1 thing to fix before you fly");
    // No stat tile ("To fix") or severity strip ("Fix before you fly") says it again.
    expect(html.match(/to fix|fix before you fly/gi)).toHaveLength(1);
    expect(html.match(/href="\/checks[?#"]/g)).toHaveLength(1);
  });

  it("names open warnings once, in the hero, now that no severity strip does", () => {
    const warning: Flag = { ...critical, id: "f2", severity: "warning", title: "Needs an ETA" };

    expect(show(trip, [], [warning]).match(/worth a look/g)).toHaveLength(1);
    expect(show(trip, [], [warning])).toContain("1 worth a look");
    expect(show(trip, [], [critical])).not.toContain("worth a look");
  });

  it("puts Next up, then the timeline, then ideas, then the budget after the hero and prompts", () => {
    const html = show(trip, [
      item("i1", "Cellar tour", "2026-09-02T11:00:00+02:00"),
      item("i2", "Olive mill"),
    ]);
    const order = [trip.name, "Who is going?", ">Next up<", ">Timeline<", ">Not on a day yet<", ">Budget<"];

    const at = order.map((text) => html.indexOf(text));
    expect(at).not.toContain(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("links to the full list of ideas without an arrow glued to the label", () => {
    const ideas = ["a", "b", "c", "d", "e", "f"].map((id) => item(id, `Idea ${id}`));
    const html = show(trip, ideas);

    // To the cabinet's own "Not scheduled" filter, so "all 6" is what it opens on.
    expect(html).toMatch(/<a[^>]*href="\/cabinet\?filter=unscheduled"[^>]*>See all 6<\/a>/);
    expect(html).not.toContain("→");
  });
});
