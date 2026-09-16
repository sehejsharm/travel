import { describe, expect, it } from "vitest";
import type { Trip } from "./domain/types";
import { purposeTasks } from "./checklists";
import { PURPOSES, getPurpose } from "./trip-purpose";
import { runChecks } from "./rules";

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Trip",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-10-14",
    endDate: "2026-10-22",
    travelers: [],
    ...patch,
  };
}

describe("trip purpose", () => {
  it("has a unique id and a stated effect for each", () => {
    const ids = PURPOSES.map((purpose) => purpose.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const purpose of PURPOSES) {
      expect(purpose.effect.length).toBeGreaterThan(10);
    }
  });

  it("gives a business trip its receipts checklist", () => {
    const tasks = purposeTasks(trip({ purpose: "business" }));
    expect(tasks.map((task) => task.label)).toContain("Keep every receipt");
    expect(tasks.every((task) => task.generatedFrom === "business trip")).toBe(true);
  });

  it("adds no tasks for a purpose that needs none, or none at all", () => {
    expect(purposeTasks(trip({ purpose: "leisure" }))).toEqual([]);
    expect(purposeTasks(trip())).toEqual([]);
  });

  it("keeps Discover quiet for business, and only for business", () => {
    expect(getPurpose("business")?.suppressSuggestions).toBe(true);
    expect(getPurpose("family")?.suppressSuggestions).toBeUndefined();
  });

  it("surfaces the with-kids section for a family trip", () => {
    expect(getPurpose("family")?.interests).toContain("family");
  });

  it("nudges toward more travellers for a group trip", () => {
    expect(getPurpose("group")?.expectsGroup).toBe(true);
  });

  it("misses cleanly on an unknown purpose", () => {
    expect(getPurpose(undefined)).toBeUndefined();
  });
});

describe("a budget set at creation", () => {
  it("shows in the money checks before anything is filed", () => {
    const flags = runChecks(
      trip({ budgetTarget: { amount: 120000, currency: "INR" } }),
      [],
      new Date("2026-09-16"),
    );
    const ready = flags.find((flag) => flag.id === "budget:ready");
    expect(ready?.severity).toBe("info");
    expect(ready?.title).toMatch(/Budget set at/);
  });

  it("says nothing about money when no target was given", () => {
    const flags = runChecks(trip(), [], new Date("2026-09-16"));
    expect(flags.some((flag) => flag.id === "budget:ready")).toBe(false);
  });

  it("gives way to the real total once something is filed", () => {
    const flags = runChecks(
      trip({ budgetTarget: { amount: 100, currency: "INR" } }),
      [
        {
          id: "i1",
          tripId: "t1",
          title: "Hotel",
          category: "booking",
          source: "manual",
          cost: { amount: 500, currency: "INR" },
          confidence: 1,
          extractionMethod: "deterministic",
          createdAt: "2026-09-01T00:00:00Z",
        },
      ],
      new Date("2026-09-16"),
    );
    expect(flags.some((flag) => flag.id === "budget:ready")).toBe(false);
    expect(flags.some((flag) => flag.id === "budget:over")).toBe(true);
  });
});
