import { describe, expect, it } from "vitest";
import type { Trip } from "../domain/types";
import { destinationCountries, legForDate, windowForCountry } from "./shared";
import { runChecks } from "./index";

const MULTI: Trip = {
  id: "t1",
  name: "Japan then Thailand",
  homeCountry: "IN",
  destinationCountries: ["JP", "TH"],
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  travelers: [],
  legs: [
    { id: "l1", countryCode: "JP", city: "Tokyo", startDate: "2026-10-14", endDate: "2026-10-20" },
    { id: "l2", countryCode: "TH", city: "Bangkok", startDate: "2026-10-20", endDate: "2026-10-22" },
  ],
};

describe("legs", () => {
  it("gives each country its own window instead of the blended trip", () => {
    expect(windowForCountry(MULTI, "JP")).toEqual({
      startDate: "2026-10-14",
      endDate: "2026-10-20",
    });
    expect(windowForCountry(MULTI, "TH")).toEqual({
      startDate: "2026-10-20",
      endDate: "2026-10-22",
    });
  });

  it("falls back to the whole trip for a country with no leg", () => {
    expect(windowForCountry(MULTI, "PT")).toEqual({
      startDate: "2026-10-14",
      endDate: "2026-10-22",
    });
  });

  it("uses the whole trip when the traveller never split it into legs", () => {
    const single = { ...MULTI, legs: undefined };
    expect(windowForCountry(single, "JP")).toEqual({
      startDate: "2026-10-14",
      endDate: "2026-10-22",
    });
  });

  it("spans several legs in the same country", () => {
    const returning: Trip = {
      ...MULTI,
      legs: [
        { id: "l1", countryCode: "JP", startDate: "2026-10-14", endDate: "2026-10-16" },
        { id: "l2", countryCode: "TH", startDate: "2026-10-16", endDate: "2026-10-19" },
        { id: "l3", countryCode: "JP", startDate: "2026-10-19", endDate: "2026-10-22" },
      ],
    };
    expect(windowForCountry(returning, "JP")).toEqual({
      startDate: "2026-10-14",
      endDate: "2026-10-22",
    });
  });

  it("contributes its countries to the destination set", () => {
    const legsOnly: Trip = { ...MULTI, destinationCountries: [] };
    expect(destinationCountries(legsOnly, []).sort()).toEqual(["JP", "TH"]);
  });

  it("never treats home as a destination, even as a leg", () => {
    const viaHome: Trip = {
      ...MULTI,
      legs: [...MULTI.legs!, { id: "l3", countryCode: "IN", startDate: "2026-10-22", endDate: "2026-10-23" }],
    };
    expect(destinationCountries(viaHome, [])).not.toContain("IN");
  });

  it("says which leg a day belongs to, for grouping a timeline", () => {
    expect(legForDate(MULTI, "2026-10-15T09:00:00+09:00")?.countryCode).toBe("JP");
    expect(legForDate(MULTI, "2026-10-21T09:00:00+07:00")?.countryCode).toBe("TH");
    expect(legForDate(MULTI, "2026-11-01")).toBeUndefined();
  });

  it("judges the weather per leg, not across the whole trip", () => {
    const flags = runChecks(MULTI, [], new Date("2026-09-16"));
    const weather = flags.filter((flag) => flag.id.startsWith("weather:"));

    // Two destinations, two separate outlooks rather than one blended one.
    expect(weather.length).toBe(2);
    expect(new Set(weather.map((flag) => flag.detail)).size).toBe(2);
  });
});
