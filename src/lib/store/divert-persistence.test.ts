import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DivertSpot } from "../divert/types";

/**
 * The store only touches localStorage when there is a window, so the other
 * store tests never exercise read(). These give it a fake one and load the
 * module fresh, which is what a reload does.
 */

const KEY = "manifest.state.v2";
const SPOT: DivertSpot = {
  id: "fuglen-asakusa",
  name: "Fuglen Asakusa",
  category: "coffee",
  point: { lat: 35.7142, lng: 139.7935 },
};

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshStore() {
  vi.resetModules();
  return import("./state");
}

function stored(divert: unknown) {
  storage.set(
    KEY,
    JSON.stringify({ trips: [], activeTripId: "", items: [], checklist: [], advice: [], divert }),
  );
}

describe("a diversion across a reload", () => {
  it("survives a reload while it is current", async () => {
    const first = await freshStore();
    first.createTrip({
      name: "Tokyo",
      homeCountry: "IN",
      destinationCountries: ["JP"],
      startDate: "2026-10-14",
      endDate: "2026-10-22",
      travelers: [{ name: "Sehej" }, { name: "Aanya" }],
    });
    const tripId = first.getSnapshot().activeTripId;
    first.startDivert({ tripId, interestIds: ["coffee"], spot: SPOT }, new Date());

    const second = await freshStore();
    expect(second.getSnapshot().divert).toMatchObject({ tripId, spot: { name: "Fuglen Asakusa" } });
  });

  it("is dropped on load once it has expired, and removed from storage straight away", async () => {
    stored({
      tripId: "t1",
      interestIds: ["coffee"],
      spot: SPOT,
      startedAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    });

    const store = await freshStore();
    expect(store.getSnapshot().divert).toBeUndefined();
    // Nothing else has been saved, and the record is still gone from disk.
    expect(JSON.parse(storage.get(KEY)!).divert).toBeUndefined();
  });

  it("is dropped on load when its trip no longer has a group", async () => {
    storage.set(
      KEY,
      JSON.stringify({
        trips: [{ id: "t1", name: "Solo", homeCountry: "IN", startDate: "2026-10-14", endDate: "2026-10-22", travelers: [{ id: "a", name: "A", passportCountry: "IN", passportExpiry: "" }] }],
        activeTripId: "t1",
        items: [],
        checklist: [],
        advice: [],
        divert: { tripId: "t1", interestIds: ["coffee"], spot: SPOT, startedAt: new Date().toISOString() },
      }),
    );

    const store = await freshStore();
    expect(store.getSnapshot().divert).toBeUndefined();
    expect(JSON.parse(storage.get(KEY)!).divert).toBeUndefined();
  });

  it("is dropped on load when it has the wrong shape, rather than breaking every screen", async () => {
    stored({ tripId: "t1", interestIds: 7, spot: SPOT, startedAt: new Date().toISOString() });

    const store = await freshStore();
    expect(store.getSnapshot().divert).toBeUndefined();
    expect(store.getSnapshot().trips).toEqual([]);
  });
});
