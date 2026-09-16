import { describe, expect, it } from "vitest";
import { FALLBACK_HOME, homeCountryFrom } from "./home-country";

describe("guessing where someone is flying from", () => {
  it("reads the region out of a locale", () => {
    expect(homeCountryFrom("en-GB", undefined)).toBe("GB");
    expect(homeCountryFrom("pt-PT", undefined)).toBe("PT");
    expect(homeCountryFrom("ja-JP", undefined)).toBe("JP");
  });

  it("prefers the locale over the timezone, since it is a deliberate setting", () => {
    expect(homeCountryFrom("en-GB", "America/New_York")).toBe("GB");
  });

  it("falls back to the timezone when the locale carries no region", () => {
    expect(homeCountryFrom("en", "Asia/Kolkata")).toBe("IN");
    expect(homeCountryFrom(undefined, "Europe/Lisbon")).toBe("PT");
  });

  it("ignores a region we have no country data for", () => {
    expect(homeCountryFrom("en-ZZ", "Asia/Kolkata")).toBe("IN");
  });

  it("falls back rather than guessing wildly", () => {
    expect(homeCountryFrom(undefined, undefined)).toBe(FALLBACK_HOME);
    expect(homeCountryFrom("en", "Mars/Olympus")).toBe(FALLBACK_HOME);
  });
});
