import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { Trip, TripItem } from "../domain/types";
import { offersFor } from "../partners";
import { communityPicks } from "./community";
import { INTERESTS, getInterest } from "./interests";
import { searchPlaces } from "./places";
import { fallbackSections, verify } from "./verify";

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Test trip",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-10-14",
    endDate: "2026-10-22",
    travelers: [],
    ...patch,
  };
}

function item(patch: Partial<TripItem> = {}): TripItem {
  return {
    id: "i1",
    tripId: "t1",
    title: "Something",
    category: "activity",
    source: "manual",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

describe("interest sections", () => {
  it("has a unique id and a search hint for every section", () => {
    const ids = INTERESTS.map((interest) => interest.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const interest of INTERESTS) {
      expect(interest.looksFor.length).toBeGreaterThan(10);
    }
  });

  it("looks up by id and misses cleanly", () => {
    expect(getInterest("food")?.label).toBe("Eating");
    expect(getInterest("nonsense")).toBeUndefined();
  });
});

describe("published trips tier", () => {
  it("returns only the interests asked for", () => {
    const picks = communityPicks("Tokyo", ["food"]);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((pick) => pick.tier === "community")).toBe(true);
    expect(picks.map((pick) => pick.name)).toContain("Tsukiji Outer Market");
    expect(picks.map((pick) => pick.name)).not.toContain("teamLab Borderless");
  });

  it("matches a city regardless of case, and misses unknown ones", () => {
    expect(communityPicks("tokyo", ["art"]).length).toBeGreaterThan(0);
    expect(communityPicks("Atlantis", ["art"])).toEqual([]);
  });
});

describe("google places tier", () => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = key;
  });

  it("stays quiet with no key rather than throwing", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(searchPlaces("ramen in Tokyo")).resolves.toEqual([]);
  });

  it("maps a response into candidates", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";

    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              displayName: { text: "Afuri Ramen" },
              editorialSummary: { text: "Yuzu shio ramen" },
              priceLevel: "PRICE_LEVEL_INEXPENSIVE",
            },
            { formattedAddress: "No name here" },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const found = await searchPlaces("ramen in Tokyo", 6, fakeFetch);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Afuri Ramen", tier: "places" });
  });

  it("returns nothing when the API errors", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const failing = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    await expect(searchPlaces("ramen", 6, failing)).resolves.toEqual([]);
  });
});

describe("partner offers", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG;
    delete process.env.NEXT_PUBLIC_ESIM_REF;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("offers data for the destination, not for home", () => {
    const offers = offersFor(trip(), []);
    const esims = offers.filter((offer) => offer.kind === "esim");
    expect(esims).toHaveLength(1);
    expect(esims[0].title).toContain("Japan");
  });

  it("offers an adapter only when the plugs actually differ", () => {
    // India (C/D/M) into Japan (A/B) — different.
    expect(offersFor(trip(), []).some((offer) => offer.kind === "adapter")).toBe(true);
    // Japan into Japan is not a destination at all, so nothing is offered.
    expect(offersFor(trip({ homeCountry: "JP" }), [])).toHaveLength(0);
  });

  it("raises long-haul comfort only for a flight over eight hours", () => {
    const short = item({
      bookingKind: "flight",
      startsAt: "2026-10-14T09:00:00Z",
      endsAt: "2026-10-14T12:00:00Z",
    });
    const long = item({
      bookingKind: "flight",
      startsAt: "2026-10-14T09:00:00Z",
      endsAt: "2026-10-14T21:00:00Z",
    });

    expect(offersFor(trip(), [short]).some((offer) => offer.kind === "comfort")).toBe(false);
    expect(offersFor(trip(), [long]).some((offer) => offer.kind === "comfort")).toBe(true);
  });

  it("links plainly until an associate tag is configured", () => {
    const plain = offersFor(trip(), []).find((offer) => offer.kind === "adapter")!;
    expect(plain.affiliate).toBe(false);
    expect(plain.url).not.toContain("tag=");

    process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG = "manifest-20";
  });

  it("has no offers to make without a destination", () => {
    expect(offersFor(trip({ destinationCountries: [] }), [])).toEqual([]);
  });
});

describe("verification — drop what isn't real", () => {
  const request = {
    destination: "Tokyo",
    countryCode: "JP",
    interests: ["food"],
    alreadyFiled: ["Shibuya Sky"],
    saved: [],
  };

  const candidates = [
    { name: "Tsukiji Outer Market", city: "Tokyo", tier: "community" as const, attribution: "Published trips" },
    { name: "Afuri Ramen", city: "Tokyo", tier: "places" as const, attribution: "Google Places" },
  ];

  function written(names: string[]) {
    return {
      sections: [
        {
          interestId: "food",
          suggestions: names.map((name) => ({ name, why: "Good.", city: null, priceHint: null })),
        },
      ],
    };
  }

  it("keeps a place a tier actually returned", () => {
    const sections = verify(written(["Tsukiji Outer Market"]), candidates, request);
    expect(sections[0].suggestions.map((s) => s.name)).toEqual(["Tsukiji Outer Market"]);
  });

  it("drops a place no tier returned, however plausible", () => {
    const sections = verify(written(["Sukiyabashi Jiro"]), candidates, request);
    expect(sections).toEqual([]);
  });

  it("keeps a place only the web findings mentioned", () => {
    const sections = verify(
      written(["Kagari Ginza"]),
      candidates,
      request,
      "Kagari Ginza serves a chicken-broth ramen worth the queue.",
    );
    expect(sections[0].suggestions).toHaveLength(1);
    expect(sections[0].suggestions[0].tier).toBe("web");
  });

  it("drops anything already filed, so it does not suggest your own plans back", () => {
    const withFiled = [...candidates, { name: "Shibuya Sky", tier: "community" as const }];
    expect(verify(written(["Shibuya Sky"]), withFiled, request)).toEqual([]);
  });

  it("drops a duplicate across sections", () => {
    const twice = {
      sections: [
        { interestId: "food", suggestions: [{ name: "Afuri Ramen", why: "a", city: null, priceHint: null }] },
        { interestId: "coffee", suggestions: [{ name: "Afuri Ramen", why: "b", city: null, priceHint: null }] },
      ],
    };
    const sections = verify(twice, candidates, request);
    expect(sections).toHaveLength(1);
  });

  it("carries the tier and attribution through to the card", () => {
    const [section] = verify(written(["Afuri Ramen"]), candidates, request);
    expect(section.suggestions[0]).toMatchObject({
      tier: "places",
      attribution: "Google Places",
    });
  });

  it("gives every survivor a place to pin, grounded or borrowed from the destination", () => {
    const [section] = verify(written(["Tsukiji Outer Market", "Afuri Ramen"]), candidates, request);
    for (const suggestion of section.suggestions) {
      expect(suggestion.place.point).toBeDefined();
    }
  });

  it("never hands back a place they already saved", () => {
    const withSaved = [
      ...candidates,
      { name: "Nakameguro", tier: "saved" as const, attribution: "Your saves" },
    ];
    expect(verify(written(["Nakameguro"]), withSaved, request)).toEqual([]);
  });

  it("drops airports and stations, which are not things to do", () => {
    const withAirport = [
      ...candidates,
      { name: "Tokyo Haneda", city: "Tokyo", tier: "community" as const },
      { name: "Indira Gandhi International (DEL)", tier: "places" as const },
    ];
    const sections = verify(
      written(["Tokyo Haneda", "Indira Gandhi International (DEL)"]),
      withAirport,
      request,
    );
    expect(sections).toEqual([]);
  });
});

describe("fallback when the write step is unavailable", () => {
  const request = {
    destination: "Tokyo",
    countryCode: "JP",
    interests: ["food", "art"],
    alreadyFiled: ["Senso-ji"],
    saved: [],
  };

  it("shows only picks that carry a section and a real line of their own", () => {
    const sections = fallbackSections(
      [
        { name: "Tsukiji Outer Market", interestId: "food", detail: "Breakfast sushi", city: "Tokyo", tier: "community" as const },
        // No section and no detail — a bare name under a guessed heading.
        { name: "Afuri Ramen", tier: "places" as const },
        { name: "Some Page Title", tier: "web" as const },
      ],
      request,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].interestId).toBe("food");
    expect(sections[0].suggestions.map((s) => s.name)).toEqual(["Tsukiji Outer Market"]);
    expect(sections[0].suggestions[0].why).toBe("Breakfast sushi");
  });

  it("keeps the order the traveller picked their sections in", () => {
    const sections = fallbackSections(
      [
        { name: "teamLab Borderless", interestId: "art", detail: "Digital art", tier: "community" as const },
        { name: "Tsukiji Outer Market", interestId: "food", detail: "Sushi", tier: "community" as const },
      ],
      request,
    );
    expect(sections.map((section) => section.interestId)).toEqual(["food", "art"]);
  });

  it("drops what is already filed, and returns nothing rather than padding", () => {
    expect(
      fallbackSections(
        [{ name: "Senso-ji", interestId: "art", detail: "Temple", tier: "community" as const }],
        request,
      ),
    ).toEqual([]);
  });
});

describe("offers and transit", () => {
  it("does not sell an eSIM for a country you only change planes in", () => {
    const connection: TripItem[] = [
      item({
        id: "f1",
        title: "DEL → BKK",
        bookingKind: "flight",
        place: { name: "Delhi", countryCode: "IN", airport: "DEL" },
        arrivalPlace: { name: "Bangkok", countryCode: "TH", airport: "BKK" },
        startsAt: "2026-10-14T02:00:00Z",
        endsAt: "2026-10-14T08:00:00Z",
      }),
      item({
        id: "f2",
        title: "BKK → HND",
        bookingKind: "flight",
        place: { name: "Bangkok", countryCode: "TH", airport: "BKK" },
        arrivalPlace: { name: "Tokyo", countryCode: "JP", airport: "HND" },
        startsAt: "2026-10-14T09:00:00Z",
        endsAt: "2026-10-14T17:00:00Z",
      }),
    ];

    const titles = offersFor(trip(), connection)
      .filter((offer) => offer.kind === "esim")
      .map((offer) => offer.title);

    expect(titles).toContain("Data in Japan");
    expect(titles).not.toContain("Data in Thailand");
  });
});
