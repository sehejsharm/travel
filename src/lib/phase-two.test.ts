import { describe, expect, it, vi } from "vitest";
import { toCalendar } from "./calendar";
import { generatePacking, generateTasks } from "./checklists";
import type { Flag, Trip, TripItem } from "./domain/types";
import { detectLink, fetchLinkMetadata } from "./extract/url";
import { buildRecap } from "./recap";
import { baggageForFlight, dutyFreeAllowance } from "./reference/allowances";
import { weatherFor } from "./reference/climate";
import { healthAdvisory } from "./reference/health";
import { holidaysBetween } from "./reference/holidays";
import { placeFacts } from "./reference/places";

const TRIP: Trip = {
  id: "trip",
  name: "Japan, autumn",
  homeCountry: "IN",
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  budgetTarget: { amount: 150000, currency: "INR" },
  travelers: [
    { id: "t1", name: "Sehej Sharma", passportCountry: "IN", passportExpiry: "2027-06-01" },
  ],
};

function item(overrides: Partial<TripItem> & { id: string }): TripItem {
  return {
    tripId: "trip",
    title: overrides.id,
    category: "activity",
    source: "manual",
    confidence: 0.9,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const TOKYO = { name: "Shibuya Sky", city: "Tokyo", countryCode: "JP", point: { lat: 35.658, lng: 139.7016 } };

describe("climate", () => {
  it("averages the normals across the months a trip spans", () => {
    const weather = weatherFor("JP", "2026-10-14", "2026-10-22")!;

    expect(weather.referenceCity).toBe("Tokyo");
    expect(weather.highC).toBe(22);
    expect(weather.lowC).toBe(16);
    expect(weather.wet).toBe(false);
  });

  it("spans a trip that crosses into the next year", () => {
    const weather = weatherFor("JP", "2026-12-28", "2027-01-04")!;
    expect(weather.highC).toBe(11);
  });

  it("knows the wet season", () => {
    expect(weatherFor("TH", "2026-07-01", "2026-07-10")!.wet).toBe(true);
    expect(weatherFor("TH", "2026-01-01", "2026-01-10")!.wet).toBe(false);
  });
});

describe("packing list", () => {
  const items = [item({ id: "a", place: TOKYO })];

  it("builds from the weather, the sockets and the trip length", () => {
    const labels = generatePacking(TRIP, items).map((entry) => entry.label);

    expect(labels).toContain("Passport");
    expect(labels).toContain("Clothes for 8 nights");
    expect(labels).toContain("Type A/B plug adapter");
    expect(labels).toContain("Cash in JPY");
  });

  it("adds a rain layer only for a wet-season trip", () => {
    const thailand = [item({ id: "a", place: { name: "Bangkok", countryCode: "TH" } })];
    const wet = generatePacking(
      { ...TRIP, startDate: "2026-07-01", endDate: "2026-07-08" },
      thailand,
    ).map((entry) => entry.label);
    const dry = generatePacking(
      { ...TRIP, startDate: "2026-01-05", endDate: "2026-01-12" },
      thailand,
    ).map((entry) => entry.label);

    expect(wet).toContain("Rain jacket or umbrella");
    expect(dry).not.toContain("Rain jacket or umbrella");
  });

  it("does not repeat an entry", () => {
    const labels = generatePacking(TRIP, items).map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("pre-trip tasks", () => {
  const flags: Flag[] = [
    { id: "1", severity: "critical", category: "compliance", title: "Needs a visa", detail: "d", itemIds: [] },
    { id: "2", severity: "info", category: "prep", title: "Pack an adapter", detail: "d", itemIds: [] },
    { id: "3", severity: "warning", category: "money", title: "Cancellation ends soon", detail: "d", itemIds: [] },
  ];

  it("turns actionable findings into things you can tick off", () => {
    const labels = generateTasks(flags).map((entry) => entry.label);

    expect(labels).toEqual(["Needs a visa", "Cancellation ends soon"]);
  });

  it("leaves informational flags out — they are not tasks", () => {
    expect(generateTasks(flags).map((entry) => entry.label)).not.toContain("Pack an adapter");
  });
});

describe("calendar export", () => {
  const items = [
    item({
      id: "teamlab",
      title: "teamLab Borderless",
      place: TOKYO,
      startsAt: "2026-10-16T13:00:00+09:00",
      endsAt: "2026-10-16T14:30:00+09:00",
      confirmationCode: "TLB4402",
    }),
    item({ id: "unscheduled", title: "Someday" }),
  ];

  const ics = toCalendar(TRIP, items);

  it("writes a valid calendar envelope", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.includes("\r\n")).toBe(true);
  });

  it("converts local times to UTC stamps", () => {
    // 13:00 in Tokyo is 04:00 UTC.
    expect(ics).toContain("DTSTART:20261016T040000Z");
    expect(ics).toContain("DTEND:20261016T053000Z");
  });

  it("only exports things that have a time", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain("Someday");
  });

  it("escapes characters that would break the format", () => {
    const tricky = toCalendar(TRIP, [
      item({ id: "x", title: "Dinner; drinks, later", startsAt: "2026-10-16T19:00:00+09:00" }),
    ]);

    expect(tricky).toContain("SUMMARY:Dinner\\; drinks\\, later");
  });
});

describe("link detection", () => {
  it("recognises the platforms and pulls the id out", () => {
    expect(detectLink("look https://www.instagram.com/reel/C9xAbc123/ 🔥")).toMatchObject({
      source: "reel",
      platform: "Instagram",
      ref: "C9xAbc123",
    });
    expect(detectLink("https://www.tiktok.com/@someone/video/7412345678901234567")).toMatchObject({
      source: "tiktok",
      platform: "TikTok",
    });
    expect(detectLink("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({
      source: "youtube",
      platform: "YouTube",
    });
  });

  it("ignores text with no recognisable link", () => {
    expect(detectLink("just a note about a cafe")).toBeUndefined();
    expect(detectLink("https://example.com/blog")).toBeUndefined();
  });

  it("reads the title when the platform serves oEmbed", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "48 hours in Kyoto", author_name: "someone" }),
    });

    const link = detectLink("https://youtu.be/dQw4w9WgXcQ")!;
    await expect(fetchLinkMetadata(link, fakeFetch as unknown as typeof fetch)).resolves.toEqual({
      title: "48 hours in Kyoto",
      author: "someone",
    });
  });

  it("gives up quietly when the platform will not serve metadata", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("blocked"));
    const link = detectLink("https://youtu.be/dQw4w9WgXcQ")!;

    await expect(
      fetchLinkMetadata(link, failing as unknown as typeof fetch),
    ).resolves.toBeUndefined();

    // Instagram has no keyless endpoint, so it never even tries.
    const instagram = detectLink("https://www.instagram.com/reel/C9xAbc123/")!;
    await expect(fetchLinkMetadata(instagram)).resolves.toBeUndefined();
  });
});

describe("reference lookups", () => {
  it("reads the carrier out of a flight number", () => {
    expect(baggageForFlight("AI142 DEL → HND")?.airline).toBe("Air India");
    expect(baggageForFlight("TG683")?.checkedKg).toBe(30);
    expect(baggageForFlight("ZZ999")).toBeUndefined();
  });

  it("knows what you can bring home", () => {
    expect(dutyFreeAllowance("IN")).toMatchObject({ amount: 50000, currency: "INR" });
    expect(dutyFreeAllowance("XX")).toBeUndefined();
  });

  it("carries health advice with a verified date", () => {
    const advisory = healthAdvisory("TH")!;
    expect(advisory.recommended).toContain("Hepatitis A");
    expect(advisory.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("finds holidays inside a date range only", () => {
    expect(holidaysBetween("JP", "2026-10-01", "2026-10-31")).toHaveLength(1);
    expect(holidaysBetween("JP", "2026-10-14", "2026-10-22")).toHaveLength(0);
  });

  it("knows which venues shut on which day", () => {
    expect(placeFacts("Ghibli Museum")?.closedDays).toEqual([2]);
    expect(placeFacts("Tokyo National Museum")?.closedDays).toEqual([1]);
    expect(placeFacts("Senso-ji")).toBeUndefined();
  });
});

describe("recap", () => {
  const items = [
    item({ id: "a", source: "reel", category: "place", cost: { amount: 3800, currency: "JPY" }, costStatus: "actual", place: TOKYO }),
    item({ id: "b", source: "reel", category: "place" }),
    item({ id: "c", source: "gmail", category: "booking", cost: { amount: 52400, currency: "INR" }, costStatus: "actual" }),
    item({ id: "d", source: "tiktok", category: "activity", cost: { amount: 2600, currency: "JPY" }, costStatus: "estimated" }),
  ];

  it("knows whether the trip has happened yet", () => {
    expect(buildRecap(TRIP, items, new Date("2026-09-09")).status).toBe("upcoming");
    expect(buildRecap(TRIP, items, new Date("2026-10-18")).status).toBe("under way");
    expect(buildRecap(TRIP, items, new Date("2026-11-01")).status).toBe("complete");
  });

  it("separates what is booked from what is still a guess", () => {
    const recap = buildRecap(TRIP, items, new Date("2026-11-01"));

    expect(Math.round(recap.booked)).toBe(54619);
    expect(Math.round(recap.estimated)).toBe(1518);
  });

  it("traces the trip back to where each item came from", () => {
    const recap = buildRecap(TRIP, items, new Date("2026-11-01"));

    expect(recap.bySource[0]).toEqual({ source: "reel", count: 2 });
    expect(recap.nights).toBe(8);
  });
});
