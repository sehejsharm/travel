import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { POST as advise } from "@/app/api/advise/route";
import { InterestPicker } from "@/components/interest-picker";
import { resetBudgets } from "../api/guard";
import type { Trip, TripItem } from "../domain/types";
import { offersFor } from "../partners";
import { communityPicks } from "./community";
import { DEFAULT_INTERESTS, INTERESTS, MAX_INTERESTS, getInterest, togglePick } from "./interests";
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

  it("adds the ten new interests after the original twelve, in the order they were approved", () => {
    expect(INTERESTS).toHaveLength(22);
    expect(INTERESTS.slice(12).map((interest) => [interest.id, interest.label])).toEqual([
      ["gems", "Hidden gems"],
      ["wildlife", "Wildlife"],
      ["local", "Local life"],
      ["festivals", "Festivals & shows"],
      ["classes", "Classes & workshops"],
      ["social", "Meet people"],
      ["camping", "Camping & road trips"],
      ["daytrips", "Day trips"],
      ["photo", "Photo spots"],
      ["film", "Film locations"],
    ]);
  });

  it("gives every interest a label, an emoji and a line under it", () => {
    for (const interest of INTERESTS) {
      expect(interest.label.trim()).not.toBe("");
      expect(interest.emoji.trim()).not.toBe("");
      expect(interest.blurb.trim()).not.toBe("");
    }
  });

  it("keeps ids to plain lowercase words, safe inside Discover's cache key", () => {
    // The key joins ids with "," after a "|", and ids are stored on trips for good.
    for (const interest of INTERESTS) expect(interest.id).toMatch(/^[a-z]+$/);
  });

  it("starts a traveller who picked nothing on interests that exist, within the limit", () => {
    expect(DEFAULT_INTERESTS.every((id) => getInterest(id))).toBe(true);
    expect(DEFAULT_INTERESTS.length).toBeLessThanOrEqual(MAX_INTERESTS);
  });
});

describe("picking interests", () => {
  const ids = INTERESTS.map((interest) => interest.id);

  it("keeps the picker's order, whatever order they were tapped in", () => {
    const picked = ["film", "gems", "food"].reduce(togglePick, [] as string[]);
    expect(picked).toEqual(["food", "gems", "film"]);
  });

  it("unpicks one that was picked", () => {
    expect(togglePick(["food", "social"], "social")).toEqual(["food"]);
  });

  it("stops at the limit rather than letting a pick past it be dropped later", () => {
    const full = ids.slice(0, MAX_INTERESTS);
    expect(togglePick(full, "film")).toEqual(full);
    // Swapping still works: unpick one, then the other goes in.
    expect(togglePick(togglePick(full, full[0]), "film")).toEqual([...full.slice(1), "film"]);
  });

  it("lets a trip that already holds more than the limit come back under it", () => {
    const over = ids.slice(0, MAX_INTERESTS + 2);
    expect(togglePick(over, over[0])).toEqual(over.slice(1));
    expect(togglePick(over, "film")).toEqual(over);
  });

  it("drops ids that are not interests, and ignores a tap on one", () => {
    expect(togglePick(["food", "retired-id"], "gems")).toEqual(["food", "gems"]);
    expect(togglePick(["food"], "nonsense")).toEqual(["food"]);
  });
});

describe("the interest picker", () => {
  const ids = INTERESTS.map((interest) => interest.id);

  function render(selected: string[], min?: number): string {
    return renderToStaticMarkup(createElement(InterestPicker, { selected, onChange: () => {}, min }));
  }

  function count(html: string, pattern: RegExp): number {
    return html.match(pattern)?.length ?? 0;
  }

  it("offers all of them, and none is off-limits below the limit", () => {
    const html = render(["food", "gems"]);
    expect(count(html, /<button/g)).toBe(INTERESTS.length);
    expect(count(html, /disabled=""/g)).toBe(0);
    expect(html).toContain("Film locations");
    expect(html).toContain("2 picked");
  });

  it("holds the rest back at the limit, and says why", () => {
    const html = render(ids.slice(0, MAX_INTERESTS));
    expect(count(html, /disabled=""/g)).toBe(INTERESTS.length - MAX_INTERESTS);
    expect(count(html, /aria-pressed="true"/g)).toBe(MAX_INTERESTS);
    expect(html).toContain("the most Discover looks up at a time");
  });

  it("tells a trip over the limit how many to unpick", () => {
    const html = render(ids.slice(0, MAX_INTERESTS + 2));
    expect(html).toContain("unpick 2 to choose which");
  });

  it("does not count an id that is no longer an interest", () => {
    expect(render(["food", "retired-id"])).toContain("1 picked");
    expect(render(["retired-id"], 0)).toContain("Optional");
  });
});

describe("the advise route and the new interests", () => {
  const keys = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "GOOGLE_PLACES_API_KEY"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  // Tokyo has published picks for food, and none for any of these.
  const uncovered = ["gems", "wildlife", "local", "festivals", "classes", "social", "camping", "daytrips", "photo", "film"];

  beforeEach(() => {
    // No keys, so only the free tiers run and nothing is sent anywhere.
    for (const key of keys) delete process.env[key];
  });
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function ask(interests: string[]) {
    // Each request still passes the guard, just with a fresh budget: these are not a burst.
    resetBudgets();
    return advise(
      new Request("https://manifest.example/api/advise", {
        method: "POST",
        headers: {
          host: "manifest.example",
          origin: "https://manifest.example",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ destination: "Tokyo", countryCode: "JP", interests }),
      }),
    );
  }

  it("accepts every new interest rather than turning it away as unknown", async () => {
    for (const id of uncovered) {
      // Nothing to verify for these yet, which is a 503; an unknown id is a 400.
      expect((await ask([id])).status).toBe(503);
    }
    expect((await ask(["nonsense"])).status).toBe(400);
  });

  it("answers the sections it can alongside a new one", async () => {
    const response = await ask(["food", "gems"]);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sections: { interestId: string }[] };
    expect(body.sections.map((section) => section.interestId)).toEqual(["food"]);
  });

  it("caps a request at the same number the picker stops at", async () => {
    expect((await ask([...uncovered.slice(0, MAX_INTERESTS - 1), "food"])).status).toBe(200);
    expect((await ask([...uncovered.slice(0, MAX_INTERESTS), "food"])).status).toBe(503);
  });

  it("has no published picks to offer under a new interest, rather than made-up ones", () => {
    expect(communityPicks("Tokyo", uncovered)).toEqual([]);
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
