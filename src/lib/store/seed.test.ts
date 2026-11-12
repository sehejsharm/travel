import { describe, expect, it } from "vitest";
import { SEED_ITEMS, SEED_TRIP } from "./seed";

/* The sample trip is the first copy a new traveller reads, so it follows the same rules as the app's own. */
describe("the sample trip", () => {
  it("names a venue after a comma, as the app's places do, not after a dash", () => {
    expect(SEED_ITEMS.find((item) => item.id === "item-sumo")?.title).toBe("Sumo tournament, Ryogoku");
    expect(JSON.stringify([SEED_TRIP, SEED_ITEMS])).not.toContain("—");
  });
});
