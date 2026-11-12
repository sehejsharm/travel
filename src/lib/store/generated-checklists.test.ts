import { beforeEach, describe, expect, it } from "vitest";
import {
  addChecklistEntry,
  createTrip,
  emptyState,
  getSnapshot,
  replaceState,
  setChecklistAssignee,
  setChecklistDone,
  updateTrip,
} from "./state";

/**
 * The packing list and pre-trip tasks are rebuilt from the trip on every
 * write. These move a trip's dates and check that the list follows, rather
 * than keeping the old line beside the new one.
 */

function tokyo(): string {
  return createTrip({
    name: "Tokyo",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-10-14",
    endDate: "2026-10-22",
    travelers: [{ name: "Sehej" }, { name: "Aanya" }],
  });
}

const packing = (tripId: string) =>
  getSnapshot().checklist.filter((entry) => entry.tripId === tripId && entry.kind === "packing");

const layers = (tripId: string) =>
  packing(tripId).filter((entry) => entry.label.startsWith("Layers for"));

/** Moved to late November, when Tokyo's seasonal range is a different one. */
const LATER = { startDate: "2026-11-28", endDate: "2026-12-06" };

beforeEach(() => {
  replaceState(emptyState());
});

describe("generated checklist entries after the trip changes", () => {
  it("replaces an untouched line whose basis moved, instead of keeping both", () => {
    const tripId = tokyo();
    const [before] = layers(tripId);
    expect(layers(tripId)).toHaveLength(1);

    updateTrip(tripId, LATER);

    const after = layers(tripId);
    expect(after).toHaveLength(1);
    expect(after[0].label).not.toBe(before.label);
    // Both spans are 8 nights, so that line is still the one it was.
    expect(packing(tripId).filter((entry) => entry.label.startsWith("Clothes for"))).toHaveLength(1);
  });

  it("drops the old trip length once the dates make a different one", () => {
    const tripId = tokyo();
    updateTrip(tripId, { endDate: "2026-10-18" });

    expect(
      packing(tripId)
        .filter((entry) => entry.label.startsWith("Clothes for"))
        .map((entry) => entry.label),
    ).toEqual(["Clothes for 4 nights"]);
  });

  it("keeps a line someone ticked or took on, beside the new one", () => {
    const tripId = tokyo();
    const [ticked] = layers(tripId);
    setChecklistDone(ticked.id, true);
    const clothes = packing(tripId).find((entry) => entry.label.startsWith("Clothes for"))!;
    const traveler = getSnapshot().trips[0].travelers[0];
    setChecklistAssignee(clothes.id, traveler.id);

    updateTrip(tripId, { ...LATER, endDate: "2026-12-02" });

    expect(layers(tripId).map((entry) => entry.id)).toContain(ticked.id);
    expect(layers(tripId)).toHaveLength(2);
    expect(packing(tripId).find((entry) => entry.id === clothes.id)).toMatchObject({
      assigneeId: traveler.id,
    });
  });

  it("never removes a line a person typed", () => {
    const tripId = tokyo();
    addChecklistEntry(tripId, "packing", "Layers for the plane");

    updateTrip(tripId, LATER);

    expect(packing(tripId).map((entry) => entry.label)).toContain("Layers for the plane");
  });

  it("leaves another trip's list alone", () => {
    const first = tokyo();
    const firstList = packing(first);
    createTrip({
      name: "London",
      homeCountry: "IN",
      destinationCountries: ["GB"],
      startDate: "2026-07-01",
      endDate: "2026-07-05",
    });

    expect(packing(first)).toEqual(firstList);
  });
});
