import { describe, expect, it } from "vitest";
import type { Trip, Traveler } from "../domain/types";
import { runChecks } from "./index";

/**
 * A traveller added during trip creation has a name and nothing else. Every
 * check that reads one of their documents has to notice the document is
 * missing before it reasons about it — otherwise absence reads as a problem,
 * which is worse than saying nothing.
 */
function traveler(patch: Partial<Traveler> = {}): Traveler {
  return { id: "tr1", name: "Sehej", passportCountry: "", passportExpiry: "", ...patch };
}

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Portugal",
    homeCountry: "IN",
    destinationCountries: ["PT"],
    startDate: "2026-11-02",
    endDate: "2026-11-09",
    travelers: [traveler()],
    ...patch,
  };
}

const NOW = new Date("2026-09-16");

describe("a traveller with no documents yet", () => {
  const flags = runChecks(trip(), [], NOW);

  it("never renders an unparseable date", () => {
    for (const flag of flags) {
      expect(`${flag.title} ${flag.detail}`).not.toContain("Invalid Date");
      expect(`${flag.title} ${flag.detail}`).not.toContain("NaN");
    }
  });

  it("does not claim the passport expires too soon when no expiry was given", () => {
    expect(flags.some((flag) => /expires too soon/.test(flag.title))).toBe(false);
  });

  it("raises nothing critical purely from missing data", () => {
    const critical = flags.filter((flag) => flag.severity === "critical");
    expect(critical.map((flag) => flag.title)).toEqual([]);
  });

  it("asks for the passport expiry instead, neutrally", () => {
    const prompt = flags.find((flag) => flag.id.startsWith("passport-expiry-missing:"));
    expect(prompt).toBeDefined();
    expect(prompt!.severity).toBe("info");
    expect(prompt!.title).toMatch(/^Add /);
  });

  it("asks for the passport nationality rather than reporting unknown entry rules", () => {
    expect(flags.some((flag) => /not in the dataset/.test(flag.title))).toBe(false);

    const prompt = flags.find((flag) => flag.id.startsWith("passport-country-missing:"));
    expect(prompt).toBeDefined();
    expect(prompt!.severity).toBe("info");
  });

  it("asks for insurance dates neutrally, as it already did", () => {
    const prompt = flags.find((flag) => flag.id.startsWith("insurance:"));
    expect(prompt?.severity).toBe("info");
  });
});

describe("a traveller with documents", () => {
  const complete = trip({
    travelers: [traveler({ passportCountry: "IN", passportExpiry: "2026-11-20" })],
  });

  it("still catches a passport that genuinely expires too soon", () => {
    const flags = runChecks(complete, [], NOW);
    const found = flags.find((flag) => /expires too soon/.test(flag.title));

    expect(found).toBeDefined();
    expect(found!.severity).toBe("critical");
    expect(found!.detail).not.toContain("Invalid Date");
  });

  it("stays quiet when the passport is valid long enough", () => {
    const flags = runChecks(
      trip({ travelers: [traveler({ passportCountry: "IN", passportExpiry: "2030-01-01" })] }),
      [],
      NOW,
    );
    expect(flags.some((flag) => /expires too soon/.test(flag.title))).toBe(false);
    expect(flags.some((flag) => flag.id.startsWith("passport-expiry-missing:"))).toBe(false);
  });

  it("does not ask for what it already has", () => {
    const flags = runChecks(complete, [], NOW);
    expect(flags.some((flag) => flag.id.startsWith("passport-country-missing:"))).toBe(false);
  });

  it("treats a malformed stored date as missing rather than as an expiry", () => {
    const flags = runChecks(
      trip({ travelers: [traveler({ passportCountry: "IN", passportExpiry: "not-a-date" })] }),
      [],
      NOW,
    );
    expect(flags.some((flag) => /expires too soon/.test(flag.title))).toBe(false);
    expect(flags.some((flag) => flag.id.startsWith("passport-expiry-missing:"))).toBe(true);
  });
});

describe("one passport, one finding", () => {
  it("does not repeat the passport check once per destination", () => {
    const flags = runChecks(
      trip({
        destinationCountries: ["PT", "ES", "FR"],
        travelers: [traveler({ passportCountry: "IN", passportExpiry: "2026-11-20" })],
      }),
      [],
      NOW,
    );

    const passportFlags = flags.filter((flag) => flag.id.startsWith("passport:"));
    expect(passportFlags).toHaveLength(1);
  });

  it("checks against the strictest destination, not the first one", () => {
    const flags = runChecks(
      trip({
        destinationCountries: ["PT", "TH"],
        travelers: [traveler({ passportCountry: "IN", passportExpiry: "2027-02-01" })],
      }),
      [],
      NOW,
    );

    // Somewhere wants six months past the trip; a Feb 2027 passport misses it.
    const found = flags.find((flag) => flag.id.startsWith("passport:"));
    expect(found?.severity).toBe("critical");
    expect(found?.detail).toMatch(/months of validity/);
  });

  it("says nothing about passports on a trip with no destination yet", () => {
    const flags = runChecks(trip({ destinationCountries: [] }), [], NOW);
    expect(flags.some((flag) => flag.id.includes("passport"))).toBe(false);
  });
});

describe("insurance dates", () => {
  const withPassport = { passportCountry: "IN", passportExpiry: "2030-01-01" };

  it("asks again when a stored date is unparseable rather than passing silently", () => {
    const flags = runChecks(
      trip({
        travelers: [
          traveler({ ...withPassport, insuranceFrom: "2026-11-01", insuranceTo: "oops" }),
        ],
      }),
      [],
      NOW,
    );

    const prompt = flags.find((flag) => flag.id.endsWith(":missing"));
    expect(prompt?.severity).toBe("info");
    expect(`${prompt?.title} ${prompt?.detail}`).not.toContain("Invalid Date");
  });

  it("still catches a policy that ends before the trip does", () => {
    const flags = runChecks(
      trip({
        travelers: [
          traveler({ ...withPassport, insuranceFrom: "2026-11-01", insuranceTo: "2026-11-05" }),
        ],
      }),
      [],
      NOW,
    );
    expect(flags.some((flag) => flag.id.endsWith(":gap"))).toBe(true);
  });

  it("stays quiet when the policy covers the trip", () => {
    const flags = runChecks(
      trip({
        travelers: [
          traveler({ ...withPassport, insuranceFrom: "2026-11-01", insuranceTo: "2026-11-30" }),
        ],
      }),
      [],
      NOW,
    );
    expect(flags.some((flag) => flag.id.startsWith("insurance:"))).toBe(false);
  });
});
