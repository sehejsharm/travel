import { describe, expect, it } from "vitest";
import type { Trip, TripItem } from "../domain/types";
import { estimateTravel, haversineKm } from "../geo";
import { entryRequirements, healthAdvisories, insuranceCoverage } from "./compliance";
import { lodgingAfterDeparture, lodgingCoverage, onwardTransport } from "./gaps";
import { baggageAllowance, customsAllowance } from "./logistics";
import { advanceBookingNeeded, venueClosures } from "./openings";
import {
  bookingMismatches,
  geographicFeasibility,
  layoverFeasibility,
  timeOverlaps,
} from "./conflicts";
import { budgetFlags, refundDeadlines, rollUpBudget } from "./money";
import { jetLag, powerCompatibility } from "./prep";
import { destinationCountries, formatDay, runChecks } from "./index";

const NOW = new Date("2026-09-09T12:00:00Z");

const TRIP: Trip = {
  id: "trip",
  name: "Japan, autumn",
  homeCountry: "IN",
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  budgetTarget: { amount: 150000, currency: "INR" },
  travelers: [
    {
      id: "t1",
      name: "Sehej Sharma",
      passportCountry: "IN",
      passportExpiry: "2027-06-01",
      insuranceFrom: "2026-10-14",
      insuranceTo: "2026-10-22",
    },
  ],
};

function item(overrides: Partial<TripItem> & { id: string }): TripItem {
  return {
    tripId: "trip",
    title: overrides.id,
    category: "activity",
    source: "manual",
    confidence: 0.9,
    extractionMethod: "deterministic",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const TEAMLAB = { name: "teamLab", countryCode: "JP", point: { lat: 35.6605, lng: 139.7396 } };
const GHIBLI = { name: "Ghibli Museum", countryCode: "JP", point: { lat: 35.6962, lng: 139.5704 } };
const HND = {
  name: "Haneda",
  countryCode: "JP",
  point: { lat: 35.5494, lng: 139.7798 },
  airport: "HND",
};
const BKK = {
  name: "Suvarnabhumi",
  countryCode: "TH",
  point: { lat: 13.69, lng: 100.7501 },
  airport: "BKK",
};
const DEL = {
  name: "Delhi",
  countryCode: "IN",
  point: { lat: 28.5562, lng: 77.1 },
  airport: "DEL",
};
const KYOTO = {
  name: "Fushimi Inari Taisha",
  city: "Kyoto",
  countryCode: "JP",
  point: { lat: 34.9671, lng: 135.7727 },
};

const ctx = (items: TripItem[], trip: Trip = TRIP) => ({ trip, items, now: NOW });

describe("geo", () => {
  it("measures a known distance", () => {
    // Haneda to central Tokyo is roughly 15 km.
    expect(haversineKm(HND.point, TEAMLAB.point)).toBeGreaterThan(12);
    expect(haversineKm(HND.point, TEAMLAB.point)).toBeLessThan(18);
  });

  it("picks a mode from the distance", () => {
    expect(estimateTravel({ lat: 35.66, lng: 139.7 }, { lat: 35.663, lng: 139.703 }).mode).toBe(
      "walk",
    );
    expect(estimateTravel(TEAMLAB.point, GHIBLI.point).mode).toBe("transit");
    expect(estimateTravel(HND.point, BKK.point).mode).toBe("fly");
  });
});

describe("conflict rules", () => {
  it("flags two things booked at the same time", () => {
    const flags = timeOverlaps(
      ctx([
        item({
          id: "cooking",
          startsAt: "2026-10-20T11:00:00+09:00",
          endsAt: "2026-10-20T14:00:00+09:00",
        }),
        item({
          id: "sumo",
          startsAt: "2026-10-20T13:00:00+09:00",
          endsAt: "2026-10-20T17:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("critical");
  });

  it("leaves a clean day alone", () => {
    const flags = timeOverlaps(
      ctx([
        item({
          id: "a",
          startsAt: "2026-10-20T09:00:00+09:00",
          endsAt: "2026-10-20T10:00:00+09:00",
        }),
        item({
          id: "b",
          startsAt: "2026-10-20T11:00:00+09:00",
          endsAt: "2026-10-20T12:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });

  it("flags a gap too short for the distance between two stops", () => {
    const flags = geographicFeasibility(
      ctx([
        item({
          id: "teamlab",
          place: TEAMLAB,
          startsAt: "2026-10-16T13:00:00+09:00",
          endsAt: "2026-10-16T14:30:00+09:00",
        }),
        item({
          id: "ghibli",
          place: GHIBLI,
          startsAt: "2026-10-16T15:00:00+09:00",
          endsAt: "2026-10-16T17:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].detail).toMatch(/transit ride/);
  });

  it("accepts the same two stops when the gap is long enough", () => {
    const flags = geographicFeasibility(
      ctx([
        item({
          id: "teamlab",
          place: TEAMLAB,
          startsAt: "2026-10-16T13:00:00+09:00",
          endsAt: "2026-10-16T14:30:00+09:00",
        }),
        item({
          id: "ghibli",
          place: GHIBLI,
          startsAt: "2026-10-16T16:30:00+09:00",
          endsAt: "2026-10-16T18:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });

  it("flags a layover under the airport's published minimum", () => {
    const flags = layoverFeasibility(
      ctx([
        item({
          id: "leg1",
          category: "booking",
          bookingKind: "flight",
          place: HND,
          arrivalPlace: BKK,
          startsAt: "2026-10-22T00:10:00+09:00",
          endsAt: "2026-10-22T04:50:00+07:00",
        }),
        item({
          id: "leg2",
          category: "booking",
          bookingKind: "flight",
          place: BKK,
          arrivalPlace: DEL,
          startsAt: "2026-10-22T05:35:00+07:00",
          endsAt: "2026-10-22T08:25:00+05:30",
        }),
      ]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].title).toMatch(/below the minimum connection time/);
    expect(flags[0].detail).toMatch(/45 min/);
  });

  it("accepts a comfortable layover", () => {
    const flags = layoverFeasibility(
      ctx([
        item({
          id: "leg1",
          category: "booking",
          bookingKind: "flight",
          place: HND,
          arrivalPlace: BKK,
          startsAt: "2026-10-22T00:10:00+09:00",
          endsAt: "2026-10-22T04:50:00+07:00",
        }),
        item({
          id: "leg2",
          category: "booking",
          bookingKind: "flight",
          place: BKK,
          arrivalPlace: DEL,
          startsAt: "2026-10-22T07:30:00+07:00",
          endsAt: "2026-10-22T10:25:00+05:30",
        }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });

  it("notices the traveller name changing between bookings", () => {
    const flags = bookingMismatches(
      ctx([
        item({ id: "flight", category: "booking", travelerName: "Sehej Sharma" }),
        item({ id: "hotel", category: "booking", travelerName: "Priya Nair" }),
      ]),
    );

    expect(flags.some((flag) => flag.title.includes("name differs"))).toBe(true);
  });

  it("raises one name flag however many bookings disagree", () => {
    const flags = bookingMismatches(
      ctx([
        item({ id: "a", category: "booking", travelerName: "Sehej Sharma" }),
        item({ id: "b", category: "booking", travelerName: "S Sharma" }),
        item({ id: "c", category: "booking", travelerName: "Sehej Sharma" }),
      ]),
    );

    expect(flags.filter((flag) => flag.title.includes("name differs"))).toHaveLength(1);
  });

  it("treats initials as the same traveller", () => {
    const flags = bookingMismatches(
      ctx([
        item({ id: "flight", category: "booking", travelerName: "S Sharma" }),
        item({ id: "hotel", category: "booking", travelerName: "s. sharma" }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });

  it("flags an arrival night with no bed booked", () => {
    const flags = bookingMismatches(
      ctx([
        item({
          id: "flight",
          category: "booking",
          bookingKind: "flight",
          startsAt: "2026-10-14T19:55:00+05:30",
          endsAt: "2026-10-15T07:25:00+09:00",
        }),
        item({
          id: "hotel",
          category: "booking",
          bookingKind: "lodging",
          startsAt: "2026-10-16T15:00:00+09:00",
          endsAt: "2026-10-22T11:00:00+09:00",
        }),
      ]),
    );

    expect(flags.some((flag) => flag.title === "No bed on your arrival night")).toBe(true);
  });
});

describe("compliance rules", () => {
  const inJapan = [item({ id: "a", place: TEAMLAB })];

  it("flags a visa an Indian passport needs for Japan", () => {
    const flags = entryRequirements(ctx(inJapan));
    const visa = flags.find((flag) => flag.id.startsWith("visa:"));

    expect(visa?.severity).toBe("critical");
    expect(visa?.verifyWith).toBeDefined();
  });

  it("flags a passport that expires mid-trip", () => {
    const trip: Trip = {
      ...TRIP,
      travelers: [{ ...TRIP.travelers[0], passportExpiry: "2026-10-18" }],
    };

    const flags = entryRequirements(ctx(inJapan, trip));
    expect(flags.some((flag) => flag.id.startsWith("passport:"))).toBe(true);
  });

  it("leaves a passport valid past the trip alone", () => {
    const flags = entryRequirements(ctx(inJapan));
    expect(flags.some((flag) => flag.id.startsWith("passport:"))).toBe(false);
  });

  it("flags insurance that ends before the trip does", () => {
    const trip: Trip = {
      ...TRIP,
      travelers: [{ ...TRIP.travelers[0], insuranceTo: "2026-10-20" }],
    };

    const flags = insuranceCoverage(ctx(inJapan, trip));
    expect(flags[0].title).toMatch(/does not cover the whole trip/);
  });
});

describe("money rules", () => {
  const priced = [
    item({ id: "flight", category: "booking", cost: { amount: 52400, currency: "INR" }, costStatus: "actual" }),
    item({ id: "hotel", category: "booking", cost: { amount: 168000, currency: "JPY" }, costStatus: "actual" }),
    item({ id: "unpriced" }),
  ];

  it("converts every currency into the budget's own", () => {
    const rollup = rollUpBudget(TRIP, priced);

    expect(rollup.currency).toBe("INR");
    // ¥168,000 is roughly ₹98,000 at the bundled rate.
    expect(rollup.actual).toBeGreaterThan(140000);
    expect(rollup.actual).toBeLessThan(160000);
    expect(rollup.unpricedCount).toBe(1);
  });

  it("counts unpriced items separately instead of treating them as free", () => {
    const rollup = rollUpBudget(TRIP, priced);
    const flags = budgetFlags(ctx(priced));

    expect(rollup.total).toBe(rollup.planned + rollup.actual);
    expect(flags.some((flag) => flag.id === "budget:over")).toBe(true);
    expect(flags.some((flag) => flag.id === "budget:unpriced")).toBe(true);
  });

  it("warns about a cancellation deadline that is nearly up", () => {
    const flags = refundDeadlines(
      ctx([item({ id: "hotel", refundableUntil: "2026-09-11T23:59:00+09:00" })]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("warning");
  });

  it("stays quiet about a deadline months away", () => {
    const flags = refundDeadlines(
      ctx([item({ id: "hotel", refundableUntil: "2026-12-01T23:59:00+09:00" })]),
    );

    expect(flags).toHaveLength(0);
  });
});

describe("prep rules", () => {
  it("names the adapter needed for the destination", () => {
    const flags = powerCompatibility(ctx([item({ id: "a", place: TEAMLAB })]));
    const plug = flags.find((flag) => flag.id.startsWith("plug:"));

    expect(plug?.title).toMatch(/Type A\/B adapter for Japan/);
  });

  it("works out the time shift from home", () => {
    const flags = jetLag(ctx([item({ id: "a", place: TEAMLAB })]));
    expect(flags[0].title).toMatch(/3.5h ahead of home/);
  });
});

describe("destinations vs transit", () => {
  const connection = [
    item({
      id: "leg1",
      category: "booking",
      bookingKind: "flight",
      place: HND,
      arrivalPlace: BKK,
      startsAt: "2026-10-22T00:10:00+09:00",
      endsAt: "2026-10-22T04:50:00+07:00",
    }),
    item({
      id: "leg2",
      category: "booking",
      bookingKind: "flight",
      place: BKK,
      arrivalPlace: DEL,
      startsAt: "2026-10-22T05:35:00+07:00",
      endsAt: "2026-10-22T08:25:00+05:30",
    }),
    item({ id: "sightseeing", place: TEAMLAB }),
  ];

  it("does not treat a country you only change planes in as a destination", () => {
    expect(destinationCountries(TRIP, connection)).toEqual(["JP"]);
    expect(entryRequirements(ctx(connection)).some((flag) => flag.title.includes("Japan"))).toBe(
      true,
    );
  });

  it("counts that country once something other than a connection happens there", () => {
    const withStopover = [
      ...connection,
      item({ id: "bangkok-dinner", place: { ...BKK, airport: undefined } }),
    ];

    expect(destinationCountries(TRIP, withStopover)).toContain("TH");
  });
});

describe("formatting", () => {
  it("keeps a post-midnight departure on its own local date", () => {
    expect(formatDay("2026-10-22T00:10:00+09:00")).toBe("Thu 22 Oct");
  });
});

describe("opening hours and holidays", () => {
  it("catches a museum booked on the day it is shut", () => {
    const flags = venueClosures(
      ctx([
        item({
          id: "ghibli",
          title: "Ghibli Museum",
          place: { name: "Ghibli Museum", countryCode: "JP", point: GHIBLI.point },
          // 2026-10-20 is a Tuesday, and the museum closes on Tuesdays.
          startsAt: "2026-10-20T10:00:00+09:00",
          endsAt: "2026-10-20T12:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("critical");
    expect(flags[0].title).toMatch(/shut on Tuesdays/);
  });

  it("stays quiet on a day the same venue is open", () => {
    const flags = venueClosures(
      ctx([
        item({
          id: "ghibli",
          place: { name: "Ghibli Museum", countryCode: "JP", point: GHIBLI.point },
          startsAt: "2026-10-21T10:00:00+09:00",
        }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });

  it("warns when a venue that needs booking ahead has no confirmation", () => {
    const unbooked = advanceBookingNeeded(
      ctx([
        item({
          id: "ghibli",
          place: { name: "Ghibli Museum", countryCode: "JP", point: GHIBLI.point },
        }),
      ]),
    );
    const booked = advanceBookingNeeded(
      ctx([
        item({
          id: "ghibli",
          confirmationCode: "GM1234",
          place: { name: "Ghibli Museum", countryCode: "JP", point: GHIBLI.point },
        }),
      ]),
    );

    expect(unbooked).toHaveLength(1);
    expect(booked).toHaveLength(0);
  });
});

describe("gaps", () => {
  const outbound = item({
    id: "out",
    category: "booking",
    bookingKind: "flight",
    place: DEL,
    arrivalPlace: HND,
    startsAt: "2026-10-14T19:55:00+05:30",
    endsAt: "2026-10-15T07:25:00+09:00",
  });
  const home = item({
    id: "home",
    category: "booking",
    bookingKind: "flight",
    place: HND,
    arrivalPlace: DEL,
    startsAt: "2026-10-22T00:10:00+09:00",
    endsAt: "2026-10-22T08:25:00+05:30",
  });

  it("finds nights at the destination with nothing booked", () => {
    const shortStay = item({
      id: "hotel",
      category: "booking",
      bookingKind: "lodging",
      startsAt: "2026-10-15T15:00:00+09:00",
      endsAt: "2026-10-19T11:00:00+09:00",
    });

    const flags = lodgingCoverage(ctx([outbound, home, shortStay]));
    expect(flags).toHaveLength(1);
    expect(flags[0].title).toMatch(/3 nights with nowhere booked/);
  });

  it("is quiet when the stay covers every night", () => {
    const fullStay = item({
      id: "hotel",
      category: "booking",
      bookingKind: "lodging",
      startsAt: "2026-10-15T15:00:00+09:00",
      endsAt: "2026-10-22T11:00:00+09:00",
    });

    expect(lodgingCoverage(ctx([outbound, home, fullStay]))).toHaveLength(0);
  });

  it("spots a hotel booked past the flight home", () => {
    const overrun = item({
      id: "hotel",
      category: "booking",
      bookingKind: "lodging",
      startsAt: "2026-10-15T15:00:00+09:00",
      endsAt: "2026-10-22T11:00:00+09:00",
    });

    const flags = lodgingAfterDeparture(ctx([outbound, home, overrun]));
    expect(flags).toHaveLength(1);
    expect(flags[0].category).toBe("money");
  });

  it("flags a city change with no transport booked for it", () => {
    const flags = onwardTransport(
      ctx([
        item({ id: "tokyo", place: TEAMLAB, startsAt: "2026-10-19T10:00:00+09:00" }),
        item({ id: "kyoto", place: KYOTO, startsAt: "2026-10-20T09:00:00+09:00" }),
      ]),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].detail).toMatch(/km from where you were/);
  });

  it("accepts the same hop when a train is filed", () => {
    const flags = onwardTransport(
      ctx([
        item({ id: "tokyo", place: TEAMLAB, startsAt: "2026-10-19T10:00:00+09:00" }),
        item({
          id: "shinkansen",
          category: "booking",
          bookingKind: "rail",
          startsAt: "2026-10-20T06:30:00+09:00",
        }),
        item({ id: "kyoto", place: KYOTO, startsAt: "2026-10-20T09:00:00+09:00" }),
      ]),
    );

    expect(flags).toHaveLength(0);
  });
});

describe("logistics", () => {
  it("reports the allowance for the airlines actually booked", () => {
    const flags = baggageAllowance(
      ctx([
        item({ id: "f", title: "AI142 DEL → HND", category: "booking", bookingKind: "flight" }),
        item({ id: "buy", category: "purchase" }),
      ]),
    );

    expect(flags[0].detail).toMatch(/Air India: 25 kg checked/);
  });

  it("warns only when the shopping list passes the duty-free limit", () => {
    const under = customsAllowance(
      ctx([item({ id: "a", category: "purchase", cost: { amount: 8000, currency: "JPY" } })]),
    );
    const over = customsAllowance(
      ctx([item({ id: "a", category: "purchase", cost: { amount: 900000, currency: "JPY" } })]),
    );

    expect(under[0].severity).toBe("info");
    expect(over[0].severity).toBe("warning");
  });

  it("carries health advice with somewhere to verify it", () => {
    const flags = healthAdvisories(ctx([item({ id: "a", place: TEAMLAB })]));

    expect(flags[0].category).toBe("compliance");
    expect(flags[0].verifyWith).toMatch(/travel clinic/);
  });
});

describe("runChecks", () => {
  it("puts the most severe findings first", () => {
    const flags = runChecks(
      TRIP,
      [
        item({ id: "a", place: TEAMLAB }),
        item({
          id: "leg1",
          category: "booking",
          bookingKind: "flight",
          place: HND,
          arrivalPlace: BKK,
          startsAt: "2026-10-22T00:10:00+09:00",
          endsAt: "2026-10-22T04:50:00+07:00",
        }),
        item({
          id: "leg2",
          category: "booking",
          bookingKind: "flight",
          place: BKK,
          arrivalPlace: DEL,
          startsAt: "2026-10-22T05:35:00+07:00",
          endsAt: "2026-10-22T08:25:00+05:30",
        }),
      ],
      NOW,
    );

    expect(flags[0].severity).toBe("critical");
    expect(flags.at(-1)?.severity).toBe("info");
  });
});
