import { describe, expect, it } from "vitest";
import type { ChecklistEntry } from "./checklists";
import type { Flag, Trip } from "./domain/types";
import { readiness, settledFlagIds } from "./readiness";
import { runChecks } from "./rules";

function flag(patch: Partial<Flag> = {}): Flag {
  return {
    id: "f1",
    severity: "critical",
    category: "compliance",
    title: "Needs a visa",
    detail: "Apply ahead.",
    itemIds: [],
    ...patch,
  };
}

function entry(patch: Partial<ChecklistEntry> = {}): ChecklistEntry {
  return {
    id: "c1",
    tripId: "t1",
    kind: "task",
    label: "Needs a visa",
    done: false,
    createdAt: "2026-09-01T00:00:00Z",
    generatedFrom: "compliance check",
    ...patch,
  };
}

describe("readiness", () => {
  it("counts a trip with nothing to do as ready rather than zero", () => {
    expect(readiness([], []).share).toBe(1);
  });

  it("drops the to-fix count when the task for that check is ticked", () => {
    const flags = [flag()];
    const before = readiness(flags, [entry({ sourceFlagId: "f1" })]);
    const after = readiness(flags, [entry({ sourceFlagId: "f1", done: true })]);

    expect(before.criticalOpen).toBe(1);
    expect(after.criticalOpen).toBe(0);
    expect(after.criticalSettled).toBe(1);
    expect(after.share).toBeGreaterThan(before.share);
  });

  it("settles an older entry that has no flag id, by its label", () => {
    const after = readiness([flag()], [entry({ sourceFlagId: undefined, done: true })]);
    expect(after.criticalOpen).toBe(0);
  });

  it("moves the ring when a packing box is ticked", () => {
    const packing = [
      entry({ id: "p1", kind: "packing", label: "Passport" }),
      entry({ id: "p2", kind: "packing", label: "Adapter" }),
    ];
    const before = readiness([], packing);
    const after = readiness([], [{ ...packing[0], done: true }, packing[1]]);

    expect(before.share).toBe(0);
    expect(after.share).toBe(0.5);
  });

  it("counts a task someone typed themselves, not just generated ones", () => {
    const own = entry({ id: "o1", label: "Book the dog sitter", generatedFrom: undefined });
    expect(readiness([], [own]).total).toBe(1);
    expect(readiness([], [{ ...own, done: true }]).share).toBe(1);
  });

  it("ignores info-level checks, which are not work", () => {
    expect(readiness([flag({ severity: "info" })], []).total).toBe(0);
  });

  it("reports which checks a ticked box has settled", () => {
    const settled = settledFlagIds([entry({ sourceFlagId: "f1", done: true })]);
    expect(settled.has("f1")).toBe(true);
    expect(settledFlagIds([entry({ sourceFlagId: "f1" })]).has("f1")).toBe(false);
  });
});

describe("a trip without dates", () => {
  const base: Trip = {
    id: "t1",
    name: "Someday",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-10-14",
    endDate: "2026-10-22",
    travelers: [
      { id: "tr1", name: "Sehej", passportCountry: "IN", passportExpiry: "2026-10-18" },
    ],
  };

  it("stays quiet about anything that depends on when you travel", () => {
    const withDates = runChecks(base, [], new Date("2026-09-16"));
    const without = runChecks({ ...base, datesTbd: true }, [], new Date("2026-09-16"));

    expect(withDates.some((entry) => entry.category === "compliance")).toBe(true);
    expect(without.some((entry) => entry.category === "compliance")).toBe(false);
    expect(without.length).toBeLessThan(withDates.length);
  });
});
