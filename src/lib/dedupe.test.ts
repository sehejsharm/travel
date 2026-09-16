import { describe, expect, it } from "vitest";
import { findDuplicates, mergeInto } from "./dedupe";
import type { TripItem } from "./domain/types";
import type { ItemDraft } from "./extract/types";

function item(patch: Partial<TripItem> = {}): TripItem {
  return {
    id: "i1",
    tripId: "t1",
    title: "Shinjuku Granbell Hotel",
    category: "booking",
    bookingKind: "lodging",
    source: "gmail",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

function draft(patch: Partial<ItemDraft> = {}): ItemDraft {
  return { title: "Shinjuku Granbell Hotel", category: "booking", source: "screenshot", ...patch };
}

describe("duplicate detection", () => {
  it("catches the same booking filed from a screenshot after the email", () => {
    const found = findDuplicates(draft(), [item()]);
    expect(found).toHaveLength(1);
    expect(found[0].reason).toContain("similar name");
  });

  it("treats a matching confirmation code as settling it", () => {
    const found = findDuplicates(
      draft({ title: "Totally different words here", confirmationCode: "X4RT9K" }),
      [item({ confirmationCode: "x4rt9k" })],
    );
    expect(found[0].score).toBe(1);
    expect(found[0].reason).toContain("Same confirmation code");
  });

  it("leaves genuinely different items alone", () => {
    expect(findDuplicates(draft({ title: "Ramen cooking class" }), [item()])).toEqual([]);
  });

  it("does not match two short titles that merely share a common word", () => {
    expect(
      findDuplicates(draft({ title: "Tokyo Station" }), [item({ title: "Tokyo Skytree" })]),
    ).toEqual([]);
  });

  it("is more confident when the place and time line up too", () => {
    const withContext = findDuplicates(
      draft({
        place: { name: "Shinjuku" },
        startsAt: "2026-10-15T15:00:00Z",
      }),
      [item({ place: { name: "Shinjuku" }, startsAt: "2026-10-15T16:00:00Z" })],
    );
    const nameOnly = findDuplicates(draft(), [item()]);

    expect(withContext[0].score).toBeGreaterThan(nameOnly[0].score);
    expect(withContext[0].reason).toContain("same time");
  });

  it("returns at most three, best first", () => {
    const many = Array.from({ length: 6 }, (_, index) => item({ id: `i${index}` }));
    const found = findDuplicates(draft(), many);
    expect(found.length).toBeLessThanOrEqual(3);
    expect(found[0].score).toBeGreaterThanOrEqual(found[found.length - 1].score);
  });
});

describe("merging", () => {
  it("fills gaps without overwriting what is already filed", () => {
    const existing = item({ confirmationCode: "KEEP", cost: { amount: 100, currency: "USD" } });
    const merged = mergeInto(
      existing,
      draft({ confirmationCode: "NEW", cost: { amount: 999, currency: "USD" }, startsAt: "2026-10-15T15:00:00Z" }),
    );

    expect(merged.confirmationCode).toBe("KEEP");
    expect(merged.cost).toEqual({ amount: 100, currency: "USD" });
    // The gap the existing entry had is filled from the new one.
    expect(merged.startsAt).toBe("2026-10-15T15:00:00Z");
  });

  it("keeps both sets of notes rather than losing one", () => {
    const merged = mergeInto(item({ notes: "From the email" }), draft({ notes: "From the screenshot" }));
    expect(merged.notes).toBe("From the email\nFrom the screenshot");
  });
});
