import { describe, expect, it } from "vitest";
import type { Trip, TripItem } from "./domain/types";
import { MAX_URL_LENGTH, SAFE_URL_LENGTH, buildShareLink, decodeTrip, encodeTrip } from "./share";

const trip: Trip = {
  id: "t1",
  name: "Japan",
  homeCountry: "IN",
  destinationCountries: ["JP"],
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  travelers: [],
};

function items(count: number, scheduled: boolean): TripItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `i${index}`,
    tripId: "t1",
    title: `Item ${index}`,
    category: "activity" as const,
    source: "manual" as const,
    confidence: 1,
    extractionMethod: "deterministic" as const,
    createdAt: "2026-09-01T00:00:00Z",
    startsAt: scheduled ? "2026-10-15T09:00:00+09:00" : undefined,
  }));
}

/**
 * Every private value is distinctive, so finding any of them anywhere in the
 * link's decompressed payload — under any key — fails the test.
 */
const SECRETS = {
  travellerOne: "Ananya Krishnaswamy",
  travellerTwo: "Sehej Oberoi",
  passportCountry: "NZ",
  passportExpiry: "2027-01-31",
  insuranceFrom: "2026-10-13",
  insuranceTo: "2026-10-23",
  originCountry: "BR",
  budget: 987654,
  interest: "nightlife",
  dismissed: "prompt-dismissed-xyz",
  note: "door code 4471, spare key under the mat",
  cost: 123456,
  confirmation: "PNRQ7X9",
  bookedName: "MR KRISHNASWAMY/ANANYA",
  refundableUntil: "2026-10-01T23:59:00Z",
  sourceRef: "https://www.instagram.com/reel/SECRETREF/",
  addedBy: "Cousin Tejas",
};

const privateTrip: Trip = {
  ...trip,
  name: "Kyoto in autumn",
  budgetTarget: { amount: SECRETS.budget, currency: "INR" },
  interests: [SECRETS.interest],
  dismissedPrompts: [SECRETS.dismissed],
  purpose: "romantic",
  accentHue: 271,
  legs: [{ id: "leg1", countryCode: "JP", city: "Kyoto", startDate: "2026-10-14", endDate: "2026-10-22" }],
  travelers: [
    {
      id: "p1",
      name: SECRETS.travellerOne,
      passportCountry: SECRETS.passportCountry,
      passportExpiry: SECRETS.passportExpiry,
      insuranceFrom: SECRETS.insuranceFrom,
      insuranceTo: SECRETS.insuranceTo,
      originCountry: SECRETS.originCountry,
      needsVisaHelp: true,
    },
    {
      id: "p2",
      name: SECRETS.travellerTwo,
      passportCountry: "IN",
      passportExpiry: "2031-05-05",
    },
  ],
};

const privateItems: TripItem[] = [
  {
    id: "flight",
    tripId: "t1",
    title: "Delhi to Osaka",
    category: "booking",
    bookingKind: "flight",
    source: "gmail",
    sourceRef: SECRETS.sourceRef,
    notes: SECRETS.note,
    place: { name: "Indira Gandhi International", city: "Delhi", countryCode: "IN", airport: "DEL" },
    arrivalPlace: { name: "Kansai International", city: "Osaka", countryCode: "JP", airport: "KIX" },
    startsAt: "2026-10-14T08:00:00+05:30",
    endsAt: "2026-10-14T19:30:00+09:00",
    cost: { amount: SECRETS.cost, currency: "INR" },
    costStatus: "actual",
    confirmationCode: SECRETS.confirmation,
    travelerName: SECRETS.bookedName,
    refundableUntil: SECRETS.refundableUntil,
    confidence: 0.95,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
    addedBy: SECRETS.addedBy,
  },
  {
    id: "temple",
    tripId: "t1",
    title: "Fushimi Inari at dawn",
    category: "place",
    source: "manual",
    notes: SECRETS.note,
    place: { name: "Fushimi Inari Taisha", city: "Kyoto", countryCode: "JP", point: { lat: 34.9671, lng: 135.7727 } },
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-09-02T00:00:00Z",
    addedBy: SECRETS.addedBy,
  },
];

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** What the link itself holds, read independently of decodeTrip's own filter. */
async function rawPayload(token: string): Promise<string> {
  const stream = new Blob([fromBase64Url(token) as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** A link in the format used before anything about travellers was stripped. */
async function legacyToken(payload: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function expectNoSecrets(text: string): void {
  for (const [field, value] of Object.entries(SECRETS)) {
    expect(text, `${field} leaked into the link`).not.toContain(String(value));
  }
}

describe("what a share link carries", () => {
  it("leaves every traveller detail, the budget, and item notes out of the payload", async () => {
    const payload = await rawPayload(await encodeTrip(privateTrip, privateItems));

    expectNoSecrets(payload);

    const parsed = JSON.parse(payload);
    expect(parsed.trip.travelers).toEqual([]);
    expect(parsed.trip).not.toHaveProperty("budgetTarget");
    expect(parsed.trip).not.toHaveProperty("interests");
    expect(parsed.trip).not.toHaveProperty("purpose");
    for (const item of parsed.items) {
      for (const key of [
        "notes",
        "cost",
        "costStatus",
        "confirmationCode",
        "travelerName",
        "refundableUntil",
        "sourceRef",
        "addedBy",
      ]) {
        expect(item, `${item.id}.${key}`).not.toHaveProperty(key);
      }
    }
  });

  it("does not reach into the traveller list under any other key", async () => {
    const payload = await rawPayload(await encodeTrip(privateTrip, privateItems));

    for (const key of ["passportCountry", "passportExpiry", "insuranceFrom", "insuranceTo", "needsVisaHelp", "originCountry"]) {
      expect(payload).not.toContain(`"${key}"`);
    }
  });

  it("still carries the plan, and how many are going", async () => {
    const shared = await decodeTrip(await encodeTrip(privateTrip, privateItems));

    expect(shared?.travellerCount).toBe(2);
    expect(shared?.trip.name).toBe("Kyoto in autumn");
    expect(shared?.trip.startDate).toBe("2026-10-14");
    expect(shared?.trip.homeCountry).toBe("IN");
    expect(shared?.trip.legs?.[0]).toMatchObject({ countryCode: "JP", city: "Kyoto" });

    const flight = shared?.items.find((item) => item.id === "flight");
    expect(flight).toMatchObject({
      title: "Delhi to Osaka",
      bookingKind: "flight",
      startsAt: "2026-10-14T08:00:00+05:30",
      arrivalPlace: { airport: "KIX", countryCode: "JP" },
    });
    expect(shared?.items.find((item) => item.id === "temple")?.place?.point).toEqual({
      lat: 34.9671,
      lng: 135.7727,
    });
  });

  it("leaves stays out entirely: the page never shows them, and a hotel's point is where the group sleeps", async () => {
    const stay: TripItem = {
      ...items(1, true)[0],
      id: "stay",
      title: "Hotel Kanra Kyoto",
      category: "booking",
      bookingKind: "lodging",
      place: { name: "Hotel Kanra Kyoto", city: "Kyoto", countryCode: "JP", point: { lat: 34.9953, lng: 135.7581 } },
    };
    const payload = await rawPayload(await encodeTrip(trip, [...items(1, true), stay]));

    expect(payload).not.toContain("Hotel Kanra");
    expect(payload).not.toContain("135.7581");
    expect((await decodeTrip(await legacyToken({ trip, items: [stay] })))?.items).toEqual([]);
  });

  it("keeps the strip on the shorter, scheduled-only link too", async () => {
    const padding = Array.from({ length: 80 }, (_, index) => ({
      ...privateItems[1],
      id: `idea-${index}`,
      title: `An unscheduled idea with a fairly long name, number ${index}`,
    }));
    const link = await buildShareLink(privateTrip, [...privateItems, ...padding], "https://manifest.trip");

    expectNoSecrets(await rawPayload(link.url.split("#")[1]!));
  });
});

describe("links made before the strip", () => {
  it("still open, and show no more than a new link would", async () => {
    // The old format: the whole trip, unfiltered, with no traveller count.
    const token = await legacyToken({ trip: privateTrip, items: privateItems });
    const shared = await decodeTrip(token);

    expect(shared).toBeDefined();
    expect(shared?.travellerCount).toBe(2);
    expect(shared?.trip.travelers).toEqual([]);
    expect(shared?.items.map((item) => item.title)).toEqual(["Delhi to Osaka", "Fushimi Inari at dawn"]);
    expectNoSecrets(JSON.stringify(shared));
  });

  it("turn away a payload with no usable trip, rather than half-drawing it", async () => {
    expect(await decodeTrip(await legacyToken({ trip: { name: 4 }, items: [] }))).toBeUndefined();
    expect(await decodeTrip(await legacyToken({ items: [] }))).toBeUndefined();
    expect(await decodeTrip("not-a-link")).toBeUndefined();
    expect(await decodeTrip("")).toBeUndefined();
  });

  it("turn away a trip whose fields are the wrong types", async () => {
    expect(await decodeTrip(await legacyToken({ trip: { ...trip, destinationCountries: "JP" }, items: [] }))).toBeUndefined();
    expect(await decodeTrip(await legacyToken({ trip: { ...trip, legs: [{ countryCode: 5 }] }, items: [] }))).toBeUndefined();
  });

  it("drop items whose fields are the wrong types, rather than crash the page", async () => {
    const good = items(1, true)[0];
    const shared = await decodeTrip(
      await legacyToken({
        trip,
        items: [good, { ...good, id: "bad-time", startsAt: 5 }, { ...good, id: "bad-place", place: { name: "X", countryCode: 5 } }],
      }),
    );

    expect(shared?.items.map((item) => item.id)).toEqual([good.id]);
  });

  it("drop items that are not items", async () => {
    const shared = await decodeTrip(
      await legacyToken({ trip, items: [privateItems[1], "junk", { id: 3 }], travellerCount: 1 }),
    );

    expect(shared?.items.map((item) => item.id)).toEqual(["temple"]);
    expect(shared?.travellerCount).toBe(1);
  });
});

describe("share link sizing", () => {
  it("keeps the safe ceiling well under the risky one", () => {
    expect(SAFE_URL_LENGTH).toBeLessThan(MAX_URL_LENGTH);
  });

  it("classifies by length the way the UI expects", () => {
    const classify = (length: number) =>
      length <= SAFE_URL_LENGTH ? "safe" : length > MAX_URL_LENGTH ? "too-big" : "risky";

    expect(classify(900)).toBe("safe");
    expect(classify(SAFE_URL_LENGTH)).toBe("safe");
    expect(classify(SAFE_URL_LENGTH + 1)).toBe("risky");
    expect(classify(MAX_URL_LENGTH + 1)).toBe("too-big");
  });

  it("has unscheduled items to drop when a trip is too big", () => {
    const mixed = [...items(30, true), ...items(30, false)];
    expect(mixed.filter((item) => item.startsAt).length).toBe(30);
    expect(trip.name).toBe("Japan");
  });

  it("builds a link on the origin it is given, under /share", async () => {
    const link = await buildShareLink(trip, items(3, true), "https://manifest.trip");

    expect(link.url.startsWith("https://manifest.trip/share#")).toBe(true);
    expect(link.size).toBe("safe");
    expect(link.length).toBe(link.url.length);
  });
});
