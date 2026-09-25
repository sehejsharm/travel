import { describe, expect, it } from "vitest";
import { clockAt, dateAt, offsetMinutes, offsetOf } from "./datetime";

describe("offsets", () => {
  it("reads an offset as minutes east of UTC", () => {
    expect(offsetMinutes("+09:00")).toBe(540);
    expect(offsetMinutes("+05:45")).toBe(345);
    expect(offsetMinutes("-03:30")).toBe(-210);
    expect(offsetMinutes("Z")).toBe(0);
    expect(offsetMinutes("")).toBeUndefined();
    expect(offsetMinutes("+0900")).toBeUndefined();
  });
});

describe("reading an instant at an offset", () => {
  const instant = new Date("2026-10-15T20:30:00Z");

  it("gives the clock and the calendar date there", () => {
    expect(clockAt(instant, "+09:00")).toBe("05:30");
    expect(dateAt(instant, "+09:00")).toBe("2026-10-16");
    expect(clockAt(instant, "-07:00")).toBe("13:30");
    expect(dateAt(instant, "-07:00")).toBe("2026-10-15");
    expect(clockAt(instant, "+05:45")).toBe("02:15");
  });

  it("reads a time filed with no offset back exactly as it was written, in any zone", () => {
    const filed = "2026-10-18T09:05:00";
    expect(offsetOf(filed)).toBe("");
    expect(clockAt(new Date(Date.parse(filed)), offsetOf(filed))).toBe("09:05");
    expect(dateAt(new Date(Date.parse(filed)), offsetOf(filed))).toBe("2026-10-18");
  });

  it("gives nothing for an invalid instant rather than throwing", () => {
    expect(clockAt(new Date(Number.NaN), "+09:00")).toBe("");
    expect(dateAt(new Date(Number.NaN), "")).toBe("");
  });
});
