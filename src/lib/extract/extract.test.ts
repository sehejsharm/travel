import { describe, expect, it } from "vitest";
import { extractDeterministic } from "./deterministic";
import { findDates, findMoney, findRefundDeadline, offsetSuffix } from "./patterns";
import { ESCALATION_THRESHOLD } from "./types";

const TODAY = new Date("2026-09-09T00:00:00Z");

describe("patterns", () => {
  it("reads money written with a symbol or a code", () => {
    expect(findMoney("Total paid ₹52,400")).toEqual({ amount: 52400, currency: "INR" });
    expect(findMoney("Total ¥168,000 for 7 nights")).toEqual({ amount: 168000, currency: "JPY" });
    expect(findMoney("charged USD 249.50")).toEqual({ amount: 249.5, currency: "USD" });
  });

  it("does not invent a price when there is none", () => {
    expect(findMoney("free walking tour, meet at 9")).toBeUndefined();
  });

  it("reads day-first, month-first and ISO dates with their times", () => {
    expect(findDates("Departs 14 Oct 2026 19:55", 2026)[0]).toMatchObject({
      date: "2026-10-14",
      time: "19:55",
    });
    expect(findDates("Oct 15, 2026 at 7:25 am", 2026)[0]).toMatchObject({
      date: "2026-10-15",
      time: "07:25",
    });
    expect(findDates("2026-10-22T11:00", 2026)[0]).toMatchObject({
      date: "2026-10-22",
      time: "11:00",
    });
  });

  it("converts pm times to 24 hour", () => {
    expect(findDates("18 Oct 2026 7:30 pm", 2026)[0].time).toBe("19:30");
  });

  it("marks slash dates ambiguous only when both halves could be a month", () => {
    expect(findDates("on 05/10/2026", 2026)[0]).toMatchObject({
      date: "2026-10-05",
      ambiguous: true,
    });
    expect(findDates("on 22/10/2026", 2026)[0]).toMatchObject({
      date: "2026-10-22",
      ambiguous: false,
    });
  });

  it("formats half-hour offsets", () => {
    expect(offsetSuffix(5.5)).toBe("+05:30");
    expect(offsetSuffix(9)).toBe("+09:00");
    expect(offsetSuffix(-5)).toBe("-05:00");
  });

  it("separates a cancellation deadline from a non-refundable rate", () => {
    expect(findRefundDeadline("Free cancellation until 14 Sep 2026", 2026).iso).toBe(
      "2026-09-14T00:00:00",
    );
    expect(findRefundDeadline("This rate is non-refundable", 2026)).toEqual({
      nonRefundable: true,
    });
  });
});

describe("deterministic extraction", () => {
  it("pulls a flight booking apart without needing the model", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "gmail",
      text: `Your Air India booking is confirmed
PNR: 7QW2LM
Passenger: Sehej Sharma
AI 142 · DEL → HND
Departs 14 Oct 2026 19:55
Arrives 15 Oct 2026 07:25
Total paid ₹52,400`,
    });

    expect(result.draft.category).toBe("booking");
    expect(result.draft.bookingKind).toBe("flight");
    expect(result.draft.place?.airport).toBe("DEL");
    expect(result.draft.arrivalPlace?.airport).toBe("HND");
    expect(result.draft.confirmationCode).toBe("7QW2LM");
    expect(result.draft.travelerName).toBe("Sehej Sharma");
    expect(result.draft.cost).toEqual({ amount: 52400, currency: "INR" });
    // Departure takes the origin's offset, arrival the destination's.
    expect(result.draft.startsAt).toBe("2026-10-14T19:55:00+05:30");
    expect(result.draft.endsAt).toBe("2026-10-15T07:25:00+09:00");
    expect(result.confidence).toBeGreaterThanOrEqual(ESCALATION_THRESHOLD);
  });

  it("keeps check-in and check-out apart on a hotel booking", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "gmail",
      text: `Booking confirmed at Hotel Gracery
Confirmation number: BK99120
Check-in: 15 Oct 2026, 15:00
Check-out: 22 Oct 2026, 11:00
Total ¥168,000
Free cancellation until 14 Sep 2026`,
    });

    expect(result.draft.bookingKind).toBe("lodging");
    expect(result.draft.startsAt?.slice(0, 10)).toBe("2026-10-15");
    expect(result.draft.endsAt?.slice(0, 10)).toBe("2026-10-22");
    expect(result.draft.refundableUntil?.slice(0, 10)).toBe("2026-09-14");
  });

  it("grounds a place named in a caption", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "reel",
      text: "this tiny standing sushi bar in tsukiji is unreal, cash only",
    });

    expect(result.draft.place?.name).toBe("Tsukiji Outer Market");
    expect(result.draft.place?.point).toBeDefined();
  });

  it("comes back under-confident on a caption with nothing structured in it", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "tiktok",
      text: "saving this for later, looks unreal",
    });

    expect(result.confidence).toBeLessThan(ESCALATION_THRESHOLD);
    expect(result.draft.cost).toBeUndefined();
    expect(result.draft.startsAt).toBeUndefined();
  });
});
