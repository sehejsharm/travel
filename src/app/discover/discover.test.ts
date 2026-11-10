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

function show(current: Trip, advice: AppState["advice"] = [], items: TripItem[] = []): string {
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

describe("Discover's interest question", () => {
  /** The markup inside the action bar, or null when the screen has none. */
  function actionBar(html: string): string | null {
    return html.match(/<div class="action-bar [^"]*">([\s\S]*?)<\/div>/)?.[1] ?? null;
  }

  it("keeps its button in the action bar, after the tiles, on the first visit", () => {
    const html = show(trip({ interests: [] }));

    expect(html).toContain("What are you into?");
    expect(actionBar(html)).toMatch(/<button[^>]*>Save and find things to do<\/button>/);
    // Last on the screen, so the bar settles below the tiles at the end.
    expect(html.indexOf("action-bar")).toBeGreaterThan(html.lastIndexOf("aria-pressed"));
  });

  it("does the same on a trip that keeps Discover quiet", () => {
    const html = show(trip({ interests: [], purpose: "business" }));

    expect(html).toContain("Kept quiet for this trip");
    expect(actionBar(html)).toMatch(/<button[^>]*disabled=""[^>]*>Turn suggestions on<\/button>/);
  });

  it("has no action bar once interests are picked", () => {
    expect(actionBar(show(trip()))).toBeNull();
  });
});

describe("Discover's links out to AllTrails and eBird", () => {
  const outdoors = { interests: ["nature", "wildlife"] };

  /** A booking filed in a city, as the extractor files one. */
  function bookedIn(city: string, countryCode: string): TripItem {
    return {
      id: `i-${city}`,
      tripId: "t1",
      title: `Hotel in ${city}`,
      category: "booking",
      bookingKind: "lodging",
      source: "manual",
      place: { name: `Hotel in ${city}`, city, countryCode },
      confidence: 1,
      extractionMethod: "deterministic",
      createdAt: "2026-06-01T00:00:00Z",
    };
  }

  beforeEach(() => {
    view.current = undefined;
  });

  it("frames the whole country when no city is known", () => {
    const html = show(trip({ destinationCountries: ["PT"], ...outdoors }));

    expect(html).toContain(
      'href="https://www.alltrails.com/explore?b_tl_lat=42.2000&amp;b_tl_lng=-9.5000&amp;b_br_lat=36.9000&amp;b_br_lng=-6.2000"',
    );
    expect(html).toContain("Trails in Portugal, on AllTrails ↗");
    expect(html).not.toContain("Trails near");
    expect(html).toContain('href="https://ebird.org/region/PT"');
    expect(html).toContain("Birds seen in Portugal, on eBird ↗");
  });

  it("frames the city once one is filed, and not the country as well", () => {
    const html = show(trip({ destinationCountries: ["PT"], ...outdoors }), [], [bookedIn("Lisbon", "PT")]);

    expect(html).toContain("Trails near Lisbon, on AllTrails ↗");
    expect(html).not.toContain("Trails in");
  });

  it("does not mistake a country's name for a city inside another one", () => {
    // "Malaysia" contains "mal", which is how the place lists spell Malé, in the Maldives.
    const html = show(trip({ destinationCountries: ["MY"], ...outdoors }));

    expect(html).toContain("Trails in Malaysia, on AllTrails ↗");
    expect(html).toContain("Birds seen in Malaysia, on eBird ↗");
    expect(html).not.toContain("Maldives");
  });

  it("takes the country a city was filed under when the place lists cannot locate it", () => {
    const html = show(trip({ destinationCountries: ["ES", "PT"], ...outdoors }), [], [bookedIn("Sintra", "PT")]);

    expect(html).toContain("Trails in Portugal, on AllTrails ↗");
    expect(html).toContain("Birds seen in Portugal, on eBird ↗");
  });

  it("shows neither link without Outdoors or Wildlife", () => {
    const html = show(trip({ destinationCountries: ["PT"], interests: ["food"] }));

    expect(html).not.toContain("alltrails.com");
    expect(html).not.toContain("ebird.org");
  });
});

describe("Discover's map and its links to Tripadvisor", () => {
  const portugal = { destinationCountries: ["PT"], interests: ["food"] };

  /** A cached answer for the trip's default place, "Portugal", with two food picks. */
  function answered(): AppState["advice"] {
    const result: AdviceResult = {
      destination: "Portugal",
      sections: [
        {
          interestId: "food",
          suggestions: [
            // Only the city's centre, as most suggestions carry: the map must search by name.
            { id: "s1", interestId: "food", name: "Pastéis de Belém", why: "The custard tarts.", place: { name: "Pastéis de Belém", city: "Lisbon", point: { lat: 38.7223, lng: -9.1393 } }, tier: "web" },
            { id: "s2", interestId: "food", name: "Time Out Market", why: "Many stalls.", place: { name: "Time Out Market", city: "Lisbon" }, tier: "web" },
          ],
        },
      ],
      tiersUsed: ["web"],
      generatedAt: "2026-06-01T00:00:00Z",
    };
    return [{ tripId: "t1", key: adviceKey("Portugal", ["food"]), result }];
  }

  /** As React writes an attribute: "&" escaped. */
  const attribute = (value: string) => value.replaceAll("&", "&amp;");

  beforeEach(() => {
    view.current = undefined;
  });

  it("links to Tripadvisor's things to do for the place, before any search", () => {
    const html = show(trip(portugal));

    expect(html).toContain(`href="${attribute("https://www.tripadvisor.com/Search?q=Portugal&ssrc=A")}"`);
    expect(html).toContain("Things to do in Portugal, on Tripadvisor ↗");
    // No suggestions yet, so nothing to put on a map.
    expect(html).not.toContain("<iframe");
  });

  it("maps the first suggestion before any is tapped, by its name and city", () => {
    const html = show(trip(portugal), answered());

    expect(html).toContain(
      `src="${attribute("https://www.google.com/maps?q=Past%C3%A9is%20de%20Bel%C3%A9m%2C%20Lisbon&z=15&output=embed")}"`,
    );
    expect(html).toContain('title="Map of Pastéis de Belém"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true" aria-describedby="suggestion-map-hint"[^>]*>Pastéis de Belém</);
    expect(html).toMatch(/<button[^>]*aria-pressed="false" aria-describedby="suggestion-map-hint"[^>]*>Time Out Market</);
    expect(html).toContain('<span id="suggestion-map-hint" hidden="">Shows it on the map</span>');
    // Headings keep the place's own name: no label inside them renames them.
    expect(html).not.toContain('aria-label="Show');
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_16rem]");
  });

  it("keeps one column when there is nothing to map", () => {
    // Festivals & shows alone, with no search yet: the calendar's section, and no map.
    const html = show(trip());

    expect(html).toContain("From Manifest");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("lg:grid-cols-[minmax(0,1fr)_16rem]");
  });

  it("has no Tripadvisor link when it knows no place, only the trip's name", () => {
    const html = show(trip({ name: "New trip", destinationCountries: [], interests: ["food"] }));

    expect(html).not.toContain("tripadvisor.com");
    expect(html).not.toContain("Things to do in New trip");
  });

  it("gives every suggestion its own Tripadvisor link", () => {
    const html = show(trip(portugal), answered());

    expect(html).toContain('href="https://www.tripadvisor.com/Search?q=Past%C3%A9is%20de%20Bel%C3%A9m%2C%20Lisbon"');
    expect(html).toContain('href="https://www.tripadvisor.com/Search?q=Time%20Out%20Market%2C%20Lisbon"');
    expect(html).toContain('aria-label="Reviews of Time Out Market on Tripadvisor"');
  });
});
