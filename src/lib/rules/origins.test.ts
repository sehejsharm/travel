import { describe, expect, it } from "vitest";
import type { Traveler, Trip, TripItem } from "../domain/types";
import { generatePacking } from "../checklists";
import { offersFor } from "../partners";
import { visaAssistance } from "./compliance";
import { runChecks } from "./index";
import { customsAllowance } from "./logistics";
import { jetLag, powerCompatibility } from "./prep";
import { nameList, originFor, originGroups } from "./shared";

function traveler(patch: Partial<Traveler> = {}): Traveler {
  return {
    id: "tr1",
    name: "Sehej",
    passportCountry: "IN",
    passportExpiry: "2031-05-01",
    ...patch,
  };
}

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Japan",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-11-02",
    endDate: "2026-11-12",
    travelers: [traveler()],
    ...patch,
  };
}

const NOW = new Date("2026-09-16");
const ctx = (t: Trip, items: TripItem[] = []) => ({ trip: t, items, now: NOW });

describe("where each traveller is flying from", () => {
  it("falls back to the trip's own origin when nobody said otherwise", () => {
    const t = trip();
    expect(originFor(t, t.travelers[0])).toBe("IN");
  });

  it("uses their own origin when they gave one", () => {
    const t = trip({ travelers: [traveler({ originCountry: "de" })] });
    expect(originFor(t, t.travelers[0])).toBe("DE");
  });

  it("is one group for a party all leaving from the same place", () => {
    const groups = originGroups(
      trip({ travelers: [traveler(), traveler({ id: "tr2", name: "Ana" })] }),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].everyone).toBe(true);
  });

  it("still names an origin for a trip with no travellers on file", () => {
    const groups = originGroups(trip({ travelers: [] }));
    expect(groups).toEqual([{ countryCode: "IN", travelers: [], everyone: true }]);
  });

  it("splits into a group per origin, trip's own first", () => {
    const groups = originGroups(
      trip({
        travelers: [
          traveler({ id: "tr2", name: "Ana", originCountry: "GB" }),
          traveler(),
        ],
      }),
    );
    expect(groups.map((group) => group.countryCode)).toEqual(["IN", "GB"]);
    expect(groups.every((group) => group.everyone)).toBe(false);
  });
});

describe("a party split across two origins", () => {
  const split = trip({
    travelers: [
      traveler(),
      traveler({ id: "tr2", name: "Ana", originCountry: "GB", passportCountry: "GB" }),
    ],
  });

  it("does not print the same adapter twice under two names", () => {
    const flags = powerCompatibility(ctx(split));
    // India is Type C/D/M and Britain Type G, but Japan is Type A/B either
    // way — one adapter, one finding. Splitting it would be noise, not detail.
    const plugs = flags.filter((flag) => flag.id.startsWith("plug:"));
    expect(plugs).toHaveLength(1);
    expect(plugs[0].title).not.toMatch(/Ana|Sehej/);
  });

  it("still says which of each side's plugs will not fit", () => {
    const detail = powerCompatibility(ctx(split)).find((flag) => flag.id.startsWith("plug:"))!.detail;
    expect(detail).toMatch(/India/);
    expect(detail).toMatch(/United Kingdom/);
  });

  it("names people only where the answer genuinely differs", () => {
    // Japan is Type A/B, and the United States is too — so an American origin
    // needs nothing while the other two do.
    const mixed = trip({
      travelers: [
        traveler(),
        traveler({ id: "tr2", name: "Ana", originCountry: "GB", passportCountry: "GB" }),
        traveler({ id: "tr3", name: "Rhea", originCountry: "US", passportCountry: "US" }),
      ],
    });
    const plugs = powerCompatibility(ctx(mixed)).filter((flag) => flag.id.startsWith("plug:"));
    expect(plugs).toHaveLength(1);
    expect(plugs[0].title).toMatch(/Sehej and Ana/);
    expect(plugs[0].title).not.toMatch(/Rhea/);
  });

  it("measures jet lag from each person's own time zone", () => {
    const flags = jetLag(ctx(split));
    const titles = flags.map((flag) => flag.title);
    // Japan is 3h30 from India but 9h from Britain — a single answer would be
    // wrong for one of them.
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.some((title) => /United Kingdom/.test(title))).toBe(true);
  });

  it("gives each person the customs allowance they actually come home to", () => {
    const items: TripItem[] = [
      {
        id: "i1",
        tripId: "t1",
        title: "Camera",
        category: "purchase",
        source: "manual",
        cost: { amount: 90_000, currency: "JPY" },
        confidence: 1,
        extractionMethod: "deterministic",
        createdAt: "2026-09-01T00:00:00Z",
      },
    ];
    const flags = customsAllowance(ctx(split, items));
    expect(flags.length).toBeGreaterThan(1);
    expect(new Set(flags.map((flag) => flag.id)).size).toBe(flags.length);
  });

  it("packs one adapter when one adapter is what they need", () => {
    const adapters = generatePacking(split, []).filter((entry) => /plug adapter/.test(entry.label));
    expect(adapters).toHaveLength(1);
    expect(adapters[0].label).not.toMatch(/Ana|Sehej/);
  });

  it("offers one adapter rather than the same one twice", () => {
    const adapters = offersFor(split, []).filter((offer) => offer.kind === "adapter");
    expect(adapters).toHaveLength(1);
    expect(adapters[0].title).not.toMatch(/Ana|Sehej/);
  });
});

describe("nothing changes for a trip that leaves from one place", () => {
  const plain = trip();

  it("keeps the flag ids it has always had", () => {
    expect(powerCompatibility(ctx(plain)).map((flag) => flag.id)).toEqual([
      "plug:JP",
      "voltage:JP",
    ]);
    expect(jetLag(ctx(plain)).map((flag) => flag.id)).toEqual(["jetlag:JP"]);
  });

  it("names nobody, because there is nobody to distinguish", () => {
    for (const flag of [...powerCompatibility(ctx(plain)), ...jetLag(ctx(plain))]) {
      expect(flag.title).not.toContain("Sehej");
    }
  });

  it("packs one adapter with no name on it", () => {
    const adapters = generatePacking(plain, []).filter((entry) => /plug adapter/.test(entry.label));
    expect(adapters).toHaveLength(1);
    expect(adapters[0].label).not.toContain("Sehej");
  });
});

describe("origin is not nationality", () => {
  it("keeps the visa answer on the passport even when they fly from elsewhere", () => {
    // An Indian passport holder living in Berlin: German plugs, Indian visa.
    const berlin = trip({ travelers: [traveler({ originCountry: "DE" })] });
    const flags = runChecks(berlin, [], NOW);
    expect(flags.some((flag) => flag.id === "visa:tr1:JP")).toBe(true);
    expect(flags.find((flag) => flag.id === "visa:tr1:JP")!.detail).toMatch(/IN passport/);
  });
});

describe("asking for help with the visa", () => {
  it("says nothing unless someone asked", () => {
    expect(visaAssistance(ctx(trip()))).toEqual([]);
  });

  it("spells out the steps for the destinations that need paperwork", () => {
    const flags = visaAssistance(ctx(trip({ travelers: [traveler({ needsVisaHelp: true })] })));
    expect(flags).toHaveLength(1);
    expect(flags[0].id).toBe("visa-help:tr1");
    expect(flags[0].detail).toMatch(/Japan/);
    expect(flags[0].detail).toMatch(/appointment/);
    // Warning, not info, so it becomes something you can tick off.
    expect(flags[0].severity).toBe("warning");
  });

  it("counts down the days left against the leg's own window", () => {
    const flags = visaAssistance(ctx(trip({ travelers: [traveler({ needsVisaHelp: true })] })));
    expect(flags[0].detail).toMatch(/You have \d+ days/);
  });

  it("asks for the passport country first, because nothing can be said without it", () => {
    const flags = visaAssistance(
      ctx(trip({ travelers: [traveler({ needsVisaHelp: true, passportCountry: "" })] })),
    );
    expect(flags[0].id).toBe("visa-help-passport:tr1");
    expect(flags[0].title).toMatch(/Add Sehej's passport country/);
  });

  it("says so plainly when there is nothing to apply for", () => {
    const flags = visaAssistance(
      ctx(
        trip({
          destinationCountries: ["TH"],
          travelers: [traveler({ needsVisaHelp: true })],
        }),
      ),
    );
    expect(flags[0].id).toBe("visa-help-clear:tr1");
    expect(flags[0].severity).toBe("info");
  });

  it("becomes a real check on the trip", () => {
    const flags = runChecks(trip({ travelers: [traveler({ needsVisaHelp: true })] }), [], NOW);
    expect(flags.some((flag) => flag.id === "visa-help:tr1")).toBe(true);
  });

  it("renders no unparseable dates", () => {
    const flags = runChecks(trip({ travelers: [traveler({ needsVisaHelp: true })] }), [], NOW);
    for (const flag of flags) {
      expect(`${flag.title} ${flag.detail}`).not.toContain("Invalid Date");
      expect(`${flag.title} ${flag.detail}`).not.toContain("NaN");
    }
  });
});

describe("naming a subset of the party", () => {
  it("reads as a sentence", () => {
    expect(nameList([traveler()])).toBe("Sehej");
    expect(nameList([traveler(), traveler({ id: "tr2", name: "Ana" })])).toBe("Sehej and Ana");
    expect(
      nameList([
        traveler(),
        traveler({ id: "tr2", name: "Ana" }),
        traveler({ id: "tr3", name: "Rhea" }),
      ]),
    ).toBe("Sehej, Ana and Rhea");
  });
});
