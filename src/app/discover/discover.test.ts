import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adviceKey } from "@/lib/advisor/calendar";
import type { AdviceResult } from "@/lib/advisor/types";
import type { Trip, TripItem } from "@/lib/domain/types";
import { primeHolidays } from "@/lib/reference/holidays";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * Discover as static HTML, with the trip view stubbed so it renders as if
 * hydrated. Made-up countries: XF has festivals, days off and the rest; XG
 * has days off only.
 */
const view: { current?: TripView } = {};
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: () => view.current!,
}));

primeHolidays("XF", {
  from: 2026,
  to: 2050,
  entries: [
    ["2026-07-01", "public", "Republic Day", ""],
    ["2026-07-02", "festival", "Kite Festival", "Runs 2 to 3 July."],
    ["2026-07-03", "festival", "Kite Festival", "Runs 2 to 3 July."],
    ["2026-07-03", "optional", "Harvest Day", "Day off in the north"],
    ["2026-07-04", "observance", "Teachers' Day", ""],
  ],
});
primeHolidays("XG", { from: 2026, to: 2050, entries: [["2026-07-01", "public", "Flag Day", ""]] });

const Discover = (await import("./page")).default;

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "July",
    homeCountry: "GB",
    destinationCountries: ["XF"],
    startDate: "2026-07-01",
    endDate: "2026-07-05",
    travelers: [],
    interests: ["festivals"],
    ...overrides,
  };
}

function show(current: Trip, advice: AppState["advice"] = []): string {
  const items: TripItem[] = [];
  const state = { trips: [current], activeTripId: current.id, items, checklist: [], advice } as unknown as AppState;
  view.current = { state, trip: current, items, checklist: [], flags: [], hydrated: true, empty: false };
  return renderToStaticMarkup(createElement(Discover));
}

/** The section headings, in order. */
function sections(html: string): string[] {
  return [...html.matchAll(/<h2 class="text-title-3">([^<]*)</g)].map((match) => match[1]);
}

describe("Discover's Festivals & shows", () => {
  beforeEach(() => {
    view.current = undefined;
  });

  it("always lets the search run, even with only Festivals & shows picked", () => {
    const html = show(trip());

    expect(html).toMatch(/<button[^>]*>Find things to do<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Find things to do/);
    expect(html).not.toContain("Nothing to look up");
    expect(html).toContain("Nothing looked up yet");
  });

  it("lists the festivals and days off on the trip's dates, not observances or days off for some", () => {
    const html = show(trip());

    expect(sections(html)).toEqual(["From Manifest&#x27;s calendar"]);
    expect(html).toContain("Kite Festival");
    expect(html).toContain("Republic Day");
    expect(html).not.toContain("Harvest Day");
    expect(html).not.toContain("Teachers&#x27; Day");
  });

  it("lists days off with no festival on, since many festivals are days off", () => {
    const html = show(trip({ destinationCountries: ["XG"] }));
    expect(sections(html)).toEqual(["From Manifest&#x27;s calendar"]);
    expect(html).toContain("Flag Day");
    expect(html).toContain("The festivals and days off on your dates are already below");
  });

  it("says the calendar is on its way while a destination's has not loaded", () => {
    // KR has data that these tests never load.
    const html = show(trip({ destinationCountries: ["KR"] }));
    expect(sections(html)).toEqual([]);
    expect(html).toContain("Loading Manifest’s calendar for your dates…");
    expect(show(trip())).not.toContain("Loading Manifest’s calendar");
    expect(show(trip({ destinationCountries: ["KR"], interests: ["food"] }))).not.toContain("Loading Manifest’s calendar");
  });

  it("has no calendar section without dates or without the interest", () => {
    expect(sections(show(trip({ datesTbd: true })))).toEqual([]);
    expect(show(trip({ datesTbd: true }))).toContain("adds the festivals on your dates once they are set");
    expect(sections(show(trip({ interests: ["food"] })))).toEqual([]);
  });

  it("shows the search's own Festivals & shows beside the calendar's, from a cached answer", () => {
    const result: AdviceResult = {
      destination: "XF",
      sections: [
        {
          interestId: "festivals",
          suggestions: [{ id: "s1", interestId: "festivals", name: "Summer opera", why: "Open-air opera.", place: { name: "Arena" }, tier: "community" }],
        },
      ],
      tiersUsed: ["community"],
      generatedAt: "2026-06-01T00:00:00Z",
    };
    // With no country name to go on, Discover looks in the trip's name.
    const current = trip({ interests: ["food", "festivals"] });
    // The key holds every interest, festivals included, as the cache always did.
    const html = show(current, [{ tripId: "t1", key: adviceKey("July", ["food", "festivals"]), result }]);

    expect(sections(html)).toEqual(["🎭 Festivals &amp; shows", "From Manifest&#x27;s calendar"]);
    expect(html).toContain("Summer opera");
    expect(html).toContain("Look again");
  });

  it("labels holidays without loading the timeline", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toMatch(/components\/timeline/);
    expect(source).toMatch(/holidayTone[\s\S]*from "@\/lib\/trip-calendar"/);
  });
});
