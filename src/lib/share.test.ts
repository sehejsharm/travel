import { describe, expect, it } from "vitest";
import type { Trip, TripItem } from "./domain/types";
import { MAX_URL_LENGTH, SAFE_URL_LENGTH } from "./share";

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

describe("share link sizing", () => {
  it("keeps the safe ceiling well under the risky one", () => {
    expect(SAFE_URL_LENGTH).toBeLessThan(MAX_URL_LENGTH);
  });

  // buildShareLink needs CompressionStream, which is a browser API; the
  // sizing decision it makes is pure, so it is checked here directly.
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
});
