import { describe, expect, it } from "vitest";
import { extractDeterministic } from "./extract/deterministic";
import { fileDraft } from "./filing";
import { endsBeforeStart, offsetForCountry, readCost } from "./item-form";
import {
  buildManualDraft,
  EMPTY_MANUAL,
  isBlank,
  MANUAL_META,
  resetManual,
  resolvePlace,
  toManualValues,
  type ManualValues,
} from "./manual-entry";
import { airportPlace, findAirport } from "./reference/airports";
import { suggestAirports } from "./reference/places";
import { createTrip, getSnapshot, tripItems } from "./store/state";

const values = (patch: Partial<ManualValues>): ManualValues => ({ ...EMPTY_MANUAL, ...patch });

// The Air India email the Add screen offers as an example.
const AIR_INDIA_EMAIL = `Your Air India booking is confirmed
PNR: 7QW2LM
Passenger: Sehej Sharma
AI 142 · DEL → HND
Departs 14 Oct 2026 19:55
Arrives 15 Oct 2026 07:25
Total paid ₹52,400`;

describe("a typed flight", () => {
  const typed = values({
    kind: "flight",
    flightNumber: "ai 142",
    from: "DEL",
    to: "Tokyo Haneda (HND)",
    startsAt: "2026-10-14T19:55",
    endsAt: "2026-10-15T07:25",
    confirmationCode: "7qw2lm",
    costAmount: "52,400",
    costCurrency: "INR",
    travelerName: "Sehej Sharma",
  });

  it("is the same item the extractor reads out of the booking email", () => {
    const read = extractDeterministic({
      text: AIR_INDIA_EMAIL,
      source: "gmail",
      today: new Date("2026-09-09T00:00:00Z"),
    }).draft;
    const { draft, errors } = buildManualDraft(typed);

    expect(errors).toEqual({});
    // Only where it came from differs.
    expect({ ...draft, source: read.source, sourceRef: read.sourceRef }).toEqual(read);
    expect(draft?.source).toBe("manual");
  });

  it("files each end on the clock of the country it is in", () => {
    const { draft } = buildManualDraft(typed);
    expect(draft?.startsAt).toBe("2026-10-14T19:55:00+05:30");
    expect(draft?.endsAt).toBe("2026-10-15T07:25:00+09:00");
    expect(draft?.place?.airport).toBe("DEL");
    expect(draft?.arrivalPlace?.airport).toBe("HND");
  });

  it("is not refused for landing earlier on the clock than it left", () => {
    // Tokyo 18:00 is 09:00 UTC; New York 17:00 the same day is 22:00 UTC.
    const { draft, errors } = buildManualDraft(
      values({
        kind: "flight",
        flightNumber: "JL 4",
        from: "HND",
        to: "JFK",
        startsAt: "2026-10-20T18:00",
        endsAt: "2026-10-20T17:00",
      }),
    );
    expect(errors).toEqual({});
    expect(draft?.endsAt).toBe("2026-10-20T17:00:00-05:00");
  });

  it("is refused when it really does land before it leaves", () => {
    const { draft, errors } = buildManualDraft(
      values({
        kind: "flight",
        flightNumber: "NH 1",
        from: "HND",
        to: "KIX",
        startsAt: "2026-10-20T18:00",
        endsAt: "2026-10-20T17:00",
      }),
    );
    expect(draft).toBeUndefined();
    expect(errors.endsAt).toBeTruthy();
  });

  it("leads with the flight number, which is where the baggage check reads the airline", () => {
    const title = (patch: Partial<ManualValues>) =>
      buildManualDraft(values({ kind: "flight", ...patch })).draft?.title;

    expect(title({ flightNumber: "AI 142", from: "DEL", to: "HND" })).toBe("AI142 DEL → HND");
    expect(title({ flightNumber: "AI-142", provider: "Air India", from: "DEL", to: "HND" })).toBe(
      "AI142 DEL → HND · Air India",
    );
    // An airline name never leads: "Air France" would read as Air India's "AI".
    expect(title({ provider: "Air France", from: "CDG", to: "HND" })).toBe("Flight CDG → HND · Air France");
    expect(title({ provider: "Air France" })).toBe("Flight · Air France");
    expect(title({ from: "DEL", to: "HND" })).toBe("Flight DEL → HND");
    expect(title({ flightNumber: "AI 142", to: "HND" })).toBe("AI142 to HND");
  });

  it("settles a city with one airport on it, and leaves one with two to the traveller", () => {
    const { draft } = buildManualDraft(
      values({ kind: "flight", flightNumber: "AI 306", from: "Delhi", to: "Tokyo" }),
    );
    expect(draft?.place).toEqual(airportPlace("DEL"));
    expect(draft?.arrivalPlace?.airport).toBeUndefined();
    expect(draft?.arrivalPlace?.name).toBe("Tokyo");
    expect(draft?.title).toBe("AI306 DEL → Tokyo");
  });

  it("wants a flight number to look like one, so an airline typed there is not read as a carrier", () => {
    const flight = (flightNumber: string) =>
      buildManualDraft(values({ kind: "flight", flightNumber, from: "CDG", to: "HND" }));
    expect(flight("Air France").errors.flightNumber).toBeTruthy();
    expect(flight("6E 204").errors).toEqual({});
    expect(flight("EK-511").draft?.title).toBe("EK511 CDG → HND");
  });

  it("does not pin a flight's end to an airport it cannot name one code for", () => {
    const { draft } = buildManualDraft(values({ kind: "flight", flightNumber: "AI 1", from: "DEL/DXB", to: "HND" }));
    expect(draft?.place).toEqual({ name: "DEL/DXB" });
  });

  it("keeps the city and country of an end it cannot settle on one airport", () => {
    // Both Tokyo airports: Tokyo, on Japan's clock, but no code claimed.
    const tokyo = resolvePlace("NRT/HND", true);
    expect(tokyo).toMatchObject({ name: "NRT/HND", city: "Tokyo", countryCode: "JP" });
    expect(tokyo?.airport).toBeUndefined();

    // An airport off the list, beside a city on it: not that city's airport, nor a guess at its country.
    expect(resolvePlace("Frankfurt Hahn", true)).toEqual({ name: "Frankfurt Hahn" });

    // So a same-day flight east across the date line still files, on the right clocks.
    const { draft, errors } = buildManualDraft(
      values({ kind: "flight", flightNumber: "JL 62", from: "NRT/HND", to: "Los Angeles LAX", startsAt: "2026-10-20T17:00", endsAt: "2026-10-20T10:00" }),
    );
    expect(errors).toEqual({});
    expect(draft?.startsAt).toBe("2026-10-20T17:00:00+09:00");
    expect(draft?.endsAt).toBe("2026-10-20T10:00:00-05:00");
  });

  it("needs something to call it", () => {
    const { draft, errors } = buildManualDraft(values({ kind: "flight", startsAt: "2026-10-14T19:55" }));
    expect(draft).toBeUndefined();
    expect(errors.title).toBeTruthy();
  });
});

describe("clocks and places the extractor would have found", () => {
  it("puts both ends of a journey on one clock when only one end is known", () => {
    // Shinjuku is not in the gazetteer; Hakone is. Mixed, the start would be
    // read on the device's clock and the train could end before it began.
    const { draft } = buildManualDraft(
      values({
        kind: "transit",
        transitKind: "rail",
        provider: "Romancecar",
        from: "Shinjuku",
        to: "Hakone",
        startsAt: "2026-10-17T10:00",
        endsAt: "2026-10-17T11:30",
      }),
    );
    expect(draft?.startsAt).toBe("2026-10-17T10:00:00+09:00");
    expect(draft?.endsAt).toBe("2026-10-17T11:30:00+09:00");

    const unknownEnd = buildManualDraft(
      values({ kind: "flight", flightNumber: "AI 1", from: "DEL", to: "Somewhere Else", startsAt: "2026-10-17T10:00", endsAt: "2026-10-17T16:00" }),
    ).draft;
    expect(unknownEnd?.endsAt).toBe("2026-10-17T16:00:00+05:30");
  });

  it("never guesses a place from a name", () => {
    // A loose match on the name would pin these to Delhi, Agra and Nara.
    for (const name of ["Museo del Prado", "Sagrada Familia", "Carbonara cooking class"]) {
      expect(buildManualDraft(values({ kind: "activity", name })).draft?.place).toBeUndefined();
    }
  });

  it("puts a stay with no place on the trip's own clock for that day", () => {
    const stay = values({ kind: "lodging", name: "Park Hyatt Tokyo", startsAt: "2026-10-16T15:00", endsAt: "2026-10-25T11:00" });
    expect(buildManualDraft(stay, { destinationCountries: ["JP"] }).draft).toMatchObject({
      startsAt: "2026-10-16T15:00:00+09:00",
      endsAt: "2026-10-25T11:00:00+09:00",
    });
    expect(buildManualDraft(stay, { destinationCountries: ["JP"] }).draft?.place).toBeUndefined();

    // A trip in legs uses the leg that day falls in.
    const legs = {
      destinationCountries: ["JP", "TH"],
      legs: [
        { id: "a", countryCode: "JP", startDate: "2026-10-14", endDate: "2026-10-20" },
        { id: "b", countryCode: "TH", startDate: "2026-10-20", endDate: "2026-10-25" },
      ],
    };
    const bangkok = values({ kind: "activity", name: "Muay Thai", startsAt: "2026-10-22T19:00" });
    expect(buildManualDraft(bangkok, legs).draft?.startsAt).toBe("2026-10-22T19:00:00+07:00");

    // Legs share their travel day: a check-in that day is at the new leg,
    // a check-out that day is still at the old one.
    const touching = {
      destinationCountries: ["TH", "JP"],
      legs: [
        { id: "a", countryCode: "TH", startDate: "2026-10-01", endDate: "2026-10-05" },
        { id: "b", countryCode: "JP", startDate: "2026-10-05", endDate: "2026-10-10" },
      ],
    };
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Park Hyatt Tokyo", startsAt: "2026-10-05T15:00", endsAt: "2026-10-08T11:00" }), touching).draft,
    ).toMatchObject({ startsAt: "2026-10-05T15:00:00+09:00", endsAt: "2026-10-08T11:00:00+09:00" });
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Mandarin Oriental", startsAt: "2026-10-02T15:00", endsAt: "2026-10-05T11:00" }), touching).draft,
    ).toMatchObject({ startsAt: "2026-10-02T15:00:00+07:00", endsAt: "2026-10-05T11:00:00+07:00" });

    // Anything but a stay keeps one clock, even across the travel day.
    const dinner = values({ kind: "activity", name: "Seine dinner cruise", startsAt: "2026-10-05T19:00", endsAt: "2026-10-05T22:00" });
    const westward = {
      destinationCountries: ["JP", "FR"],
      legs: [
        { id: "a", countryCode: "JP", startDate: "2026-10-01", endDate: "2026-10-05" },
        { id: "b", countryCode: "FR", startDate: "2026-10-05", endDate: "2026-10-10" },
      ],
    };
    expect(buildManualDraft(dinner, westward)).toMatchObject({
      errors: {},
      draft: { startsAt: "2026-10-05T19:00:00+01:00", endsAt: "2026-10-05T22:00:00+01:00" },
    });

    // A stay is in one place: the night between two legs that do not share a
    // day is on the clock of the day it starts.
    const apart = {
      destinationCountries: ["JP", "FR"],
      legs: [
        { id: "a", countryCode: "JP", startDate: "2026-10-01", endDate: "2026-10-04" },
        { id: "b", countryCode: "FR", startDate: "2026-10-05", endDate: "2026-10-10" },
      ],
    };
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Airport hotel", startsAt: "2026-10-04T22:00", endsAt: "2026-10-05T09:00" }), apart).draft,
    ).toMatchObject({ startsAt: "2026-10-04T22:00:00+09:00", endsAt: "2026-10-05T09:00:00+09:00" });

    // A day room on the travel day is one stay in one place: one clock.
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Day room", startsAt: "2026-10-05T10:00", endsAt: "2026-10-05T16:00" }), westward),
    ).toMatchObject({ errors: {}, draft: { startsAt: "2026-10-05T10:00:00+01:00", endsAt: "2026-10-05T16:00:00+01:00" } });

    // Outside the trip's dates the trip says nothing, for either end: a stay
    // the night before, out on the first morning, is not on the trip's clock.
    const dated = { destinationCountries: ["JP"], startDate: "2026-10-01", endDate: "2026-10-10" };
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Hilton SFO", startsAt: "2026-09-30T20:00", endsAt: "2026-10-01T08:00" }), dated).draft,
    ).toMatchObject({ startsAt: "2026-09-30T20:00:00", endsAt: "2026-10-01T08:00:00" });
    // Nor for a last night that checks out the morning after the trip ends.
    expect(
      buildManualDraft(values({ kind: "lodging", name: "Airport hotel", startsAt: "2026-10-10T20:00", endsAt: "2026-10-11T08:00" }), dated).draft,
    ).toMatchObject({ startsAt: "2026-10-10T20:00:00", endsAt: "2026-10-11T08:00:00" });

    // Two countries and no legs: no guess.
    expect(buildManualDraft(bangkok, { destinationCountries: ["JP", "TH"] }).draft?.startsAt).toBe(
      "2026-10-22T19:00:00",
    );
  });

  it("uses the trip's clock for a journey between two places it cannot find", () => {
    const { draft } = buildManualDraft(
      values({ kind: "transit", provider: "Hakone Tozan", from: "Gora", to: "Sounzan", startsAt: "2026-10-17T10:00", endsAt: "2026-10-17T10:10" }),
      { destinationCountries: ["JP"] },
    );
    expect(draft?.startsAt).toBe("2026-10-17T10:00:00+09:00");
    expect(draft?.endsAt).toBe("2026-10-17T10:10:00+09:00");
  });
});

describe("typed transit, stays and activities", () => {
  it("files a train as a rail booking between the places typed", () => {
    const { draft } = buildManualDraft(
      values({
        kind: "transit",
        transitKind: "rail",
        from: "Tokyo",
        to: "Kyoto",
        startsAt: "2026-10-18T09:00",
        endsAt: "2026-10-18T11:15",
      }),
    );
    expect(draft).toMatchObject({
      title: "Train Tokyo → Kyoto",
      category: "booking",
      bookingKind: "rail",
      startsAt: "2026-10-18T09:00:00+09:00",
      endsAt: "2026-10-18T11:15:00+09:00",
    });
    expect(draft?.place?.point).toBeDefined();
    expect(draft?.arrivalPlace?.point).toBeDefined();
  });

  it("names transit after its operator when there is one", () => {
    const { draft } = buildManualDraft(
      values({ kind: "transit", transitKind: "car", provider: "Toyota Rent a Car", from: "Kyoto" }),
    );
    expect(draft).toMatchObject({ title: "Toyota Rent a Car from Kyoto", bookingKind: "car" });
  });

  it("files a stay as a lodging booking, and needs its name", () => {
    expect(buildManualDraft(values({ kind: "lodging", place: "Shinjuku" })).errors.title).toBeTruthy();

    const { draft } = buildManualDraft(
      values({
        kind: "lodging",
        name: "Hotel Gracery Shinjuku",
        place: "Tokyo",
        startsAt: "2026-10-15T15:00",
        endsAt: "2026-10-22T11:00",
        confirmationCode: "bk99120",
        costAmount: "168000",
        costCurrency: "JPY",
      }),
    );
    expect(draft).toMatchObject({
      title: "Hotel Gracery Shinjuku",
      category: "booking",
      bookingKind: "lodging",
      startsAt: "2026-10-15T15:00:00+09:00",
      endsAt: "2026-10-22T11:00:00+09:00",
      confirmationCode: "BK99120",
      cost: { amount: 168000, currency: "JPY" },
      costStatus: "actual",
    });
    expect(draft?.arrivalPlace).toBeUndefined();
  });

  it("will not check out before checking in", () => {
    const { errors } = buildManualDraft(
      values({
        kind: "lodging",
        name: "Hotel Gracery",
        startsAt: "2026-10-22T11:00",
        endsAt: "2026-10-15T15:00",
      }),
    );
    expect(errors.endsAt).toBeTruthy();
  });

  it("files an activity as a guess at the price unless told it is paid", () => {
    const base = values({ kind: "activity", name: "Tea ceremony", place: "Kyoto", costAmount: "4000", costCurrency: "JPY" });
    expect(buildManualDraft(base).draft).toMatchObject({
      category: "activity",
      bookingKind: undefined,
      costStatus: "estimated",
    });
    expect(buildManualDraft({ ...base, costStatus: "actual" }).draft?.costStatus).toBe("actual");
  });

  it("keeps a place it cannot pin, by name, as the editor does", () => {
    const { draft } = buildManualDraft(values({ kind: "activity", name: "Jazz bar", place: "Bar Martha" }));
    expect(draft?.place).toEqual({ name: "Bar Martha" });
  });

  it("asks for a start when only an end was given", () => {
    const { errors } = buildManualDraft(
      values({ kind: "activity", name: "Tea ceremony", endsAt: "2026-10-18T11:00" }),
    );
    expect(errors.startsAt).toBeTruthy();
  });

  it("wants a price to be a number with a currency", () => {
    const priced = (costAmount: string, costCurrency: string) =>
      buildManualDraft(values({ kind: "activity", name: "Tea ceremony", costAmount, costCurrency }));

    expect(priced("about 40", "USD").errors.costAmount).toBeTruthy();
    expect(priced("-40", "USD").errors.costAmount).toBeTruthy();
    // Said at once, not only after a currency is picked.
    expect(priced("-40", "").errors).toEqual({ costAmount: "A price cannot be negative" });
    expect(priced("40", "").errors.costCurrency).toBeTruthy();
    expect(priced("1,299.50", "USD").draft?.cost).toEqual({ amount: 1299.5, currency: "USD" });
    expect(priced("", "USD").draft?.cost).toBeUndefined();
  });

  it("files only what the chosen kind shows, whatever else was typed before switching", () => {
    const { draft } = buildManualDraft(
      values({
        kind: "lodging",
        name: "Hotel Gracery",
        provider: "Air India",
        flightNumber: "AI 142",
        from: "DEL",
        to: "HND",
      }),
    );
    expect(draft?.title).toBe("Hotel Gracery");
    expect(draft?.place).toBeUndefined();
    expect(draft?.arrivalPlace).toBeUndefined();

    const flight = buildManualDraft(
      values({ kind: "flight", flightNumber: "AI 142", name: "Hotel Gracery", place: "Tokyo" }),
    ).draft;
    expect(flight?.title).toBe("AI142");
    expect(flight?.place).toBeUndefined();

    // A flight number left behind does not name a stay.
    expect(
      buildManualDraft(values({ kind: "lodging", flightNumber: "AI 142", from: "DEL" })).errors.title,
    ).toBeTruthy();
  });
});

describe("the form's own state", () => {
  it("knows an untouched form, and clears back to the kind that was picked", () => {
    expect(isBlank(EMPTY_MANUAL)).toBe(true);
    expect(isBlank(values({ notes: "  " }))).toBe(true);
    expect(isBlank(values({ from: "DEL" }))).toBe(false);

    const cleared = resetManual(values({ kind: "transit", transitKind: "car", from: "Kyoto" }));
    expect(cleared).toEqual({ ...EMPTY_MANUAL, kind: "transit", transitKind: "car" });
  });

  it("reads back only what makes sense from storage", () => {
    expect(toManualValues(null)).toEqual(EMPTY_MANUAL);
    expect(toManualValues("junk")).toEqual(EMPTY_MANUAL);
    expect(
      toManualValues({ kind: "boat", transitKind: "rail", from: 42, to: "HND", costStatus: "free" }),
    ).toEqual({ ...EMPTY_MANUAL, transitKind: "rail", to: "HND" });
  });
});

describe("rules shared with the editor", () => {
  it("compares instants when both ends carry an offset, and clocks when they do not", () => {
    expect(endsBeforeStart("2026-10-20T18:00:00+09:00", "2026-10-20T17:00:00-05:00")).toBe(false);
    expect(endsBeforeStart("2026-10-20T18:00:00+09:00", "2026-10-20T17:00:00+09:00")).toBe(true);
    expect(endsBeforeStart("2026-10-20T18:00:00", "2026-10-20T17:00:00")).toBe(true);
    expect(endsBeforeStart("2026-10-20T18:00:00", "2026-10-20T18:00:00")).toBe(false);
    expect(endsBeforeStart(undefined, "2026-10-20T17:00:00")).toBe(false);
  });

  it("files a time with its country's offset, or none when the country is unknown", () => {
    expect(offsetForCountry("JP")).toBe("+09:00");
    expect(offsetForCountry("IN")).toBe("+05:30");
    expect(offsetForCountry("US")).toBe("-05:00");
    expect(offsetForCountry(undefined)).toBe("");
  });

  it("reads a price as written on a booking", () => {
    const priced = (text: string, currency: string) => readCost(text, currency).cost?.amount;
    expect(readCost("52,400", "INR").cost).toEqual({ amount: 52400, currency: "INR" });
    expect(priced(" 12.50 ", "USD")).toBe(12.5);
    // Typed a key at a time on a comma keypad.
    expect(priced("12,", "EUR")).toBe(12);
    expect(priced(",50", "EUR")).toBe(0.5);
    expect(Object.is(priced("-0", "EUR"), 0)).toBe(true);
    // The amount is known even before a currency is picked.
    expect(readCost("-40", "")).toEqual({ amount: -40, problem: "currency" });
    // A comma keypad's decimal point, and European grouping.
    expect(priced("12,50", "EUR")).toBe(12.5);
    expect(priced("1.234,50", "EUR")).toBe(1234.5);
    // Read as written; the editor keeps a negative it was given.
    expect(priced("-40", "USD")).toBe(-40);
    expect(readCost("12,5,0", "EUR")).toEqual({ problem: "amount" });
    expect(readCost("", "USD")).toEqual({});
  });
});

describe("airports typed by hand", () => {
  // Each row: what a traveller types into a flight's From or To, and the
  // airport it should settle on (undefined: left for them to pick).
  const TABLE: [string, string | undefined][] = [
    ["Los Angeles LAX", "LAX"],
    ["LAX Los Angeles", "LAX"],
    ["Los Angeles International Airport, USA", "LAX"],
    ["Los Angeles International Airport, CA", "LAX"],
    ["Dubai International Airport, UAE", "DXB"],
    ["Frankfurt, Germany", "FRA"],
    ["Istanbul Airport, Turkey", "IST"],
    ["Istanbul New Airport", "IST"],
    ["Hyderabad, India", "HYD"],
    ["Paris Charles de Gaulle Terminal 2E", "CDG"],
    ["Indira Gandhi International Airport, New Delhi", "DEL"],
    ["Hamad International Airport, Doha, Qatar", "DOH"],
    ["Daniel K. Inouye International Airport, Honolulu, HI", "HNL"],
    ["Aeropuerto de Málaga-Costa del Sol", "AGP"],
    ["Zagreb Franjo Tuđman Airport", "ZAG"],
    ["delhi del", "DEL"],
    // Printed in capitals on an e-ticket: still names, not codes.
    ["LOS ANGELES", "LAX"],
    ["LOS ANGELES INTERNATIONAL AIRPORT", "LAX"],
    ["MÁLAGA-COSTA DEL SOL", "AGP"],
    ["FRANJO TUĐMAN", "ZAG"],
    ["Costa del Sol", "AGP"],
    ["LIMA, PERÚ", "LIM"],
    ["Charles de Gaulle", "CDG"],
    ["CHARLES DE GAULLE", "CDG"],
    ["Aéroport Charles de Gaulle", "CDG"],
    // Abbreviations with their punctuation, and states written out.
    ["Tokyo Haneda Int'l", "HND"],
    ["London Heathrow, U.K.", "LHR"],
    ["JFK, U.S.A.", "JFK"],
    ["Los Angeles, California", "LAX"],
    ["Toronto Pearson, Ontario", "YYZ"],
    ["Hong Kong, China", "HKG"],
    // Initials however dotted, and a name's short form.
    ["O.R. Tambo", "JNB"],
    ["London Heathrow, U. K.", "LHR"],
    ["Palma", "PMI"],
    ["Palma, Spain", "PMI"],
    // Left for the traveller: two airports at once, an airport not on the
    // list, a word pointing at another country, a word that only looks like a code.
    ["Charles de Gaulle or Orly", undefined],
    ["Suvarnabhumi or Don Mueang", undefined],
    ["Lansing Capital Region International Airport", undefined],
    ["Manchester, NH", undefined],
    ["Melbourne, FL", undefined],
    // A listed airport accepts its own state, not any: Logan, Utah is not Boston Logan.
    ["Boston Logan, MA", "BOS"],
    ["Logan, UT", undefined],
    ["Las Vegas, NM", undefined],
    // A state after a city stays a state, not a joining word, whatever follows it.
    ["Athens, LA", undefined],
    ["Manchester, DE", undefined],
    ["Logan, LA, USA", undefined],
    ["Athens, LA 71003", undefined],
    // Two airports named with their codes: neither is picked.
    ["Charles de Gaulle (CDG) or Orly (ORY)", undefined],
    ["Museo del Prado", undefined],
    ["Frankfurt/Main", undefined],
    ["NRT/HND", undefined],
  ];

  it.each(TABLE)("%s → %s", (typed, iata) => {
    expect(findAirport(typed)?.iata).toBe(iata);
  });

  it("are found in the loose ways people type them", () => {
    const code = (text: string) => findAirport(text)?.iata;
    expect(code("Dubai International Airport")).toBe("DXB");
    expect(code("HND airport")).toBe("HND");
    expect(code("Tokyo Haneda airport")).toBe("HND");
    expect(code("Haneda HND")).toBe("HND");
    expect(code("Delhi DEL")).toBe("DEL");
    expect(code("DEL - Delhi")).toBe("DEL");
    expect(code("Paris CDG")).toBe("CDG");
    expect(code("Dubai airport")).toBe("DXB");
    expect(code("Male")).toBe("MLE");
    expect(code("Sabiha Gokcen International")).toBe("SAW");
    expect(code("Haneda")).toBe("HND");
    expect(code("Istanbul Airport")).toBe("IST");
    // A code typed beats a name the text happens to hold.
    expect(code("Istanbul SAW")).toBe("SAW");
    expect(code("Istanbul Sabiha Gokcen")).toBe("SAW");
    // Still left to the traveller: a city with two airports, two codes at once,
    // or a city beside an airport that is not on the list.
    expect(code("Tokyo airport")).toBeUndefined();
    expect(code("DEL to HND")).toBeUndefined();
    expect(code("Milan Linate")).toBeUndefined();
    expect(code("Frankfurt Hahn")).toBeUndefined();
    expect(code("Sharjah Dubai")).toBeUndefined();
  });

  it("are found by code, picked suggestion, name, or a city that has only one", () => {
    expect(findAirport("hnd")?.iata).toBe("HND");
    expect(findAirport("Tokyo Haneda (HND)")?.iata).toBe("HND");
    expect(findAirport("kansai international")?.iata).toBe("KIX");
    expect(findAirport("Delhi")?.iata).toBe("DEL");
    expect(findAirport("Tokyo")).toBeUndefined();
    expect(findAirport("xyz")).toBeUndefined();
    expect(findAirport("  ")).toBeUndefined();
  });

  it("are suggested by name, code or city, and not before anything is typed", () => {
    expect(suggestAirports("")).toEqual([]);
    // Typed without the accent the name has.
    expect(suggestAirports("Malaga")[0]?.name).toBe("Málaga-Costa del Sol (AGP)");
    expect(suggestAirports("tokyo").map((airport) => airport.name)).toEqual(
      expect.arrayContaining(["Tokyo Haneda (HND)", "Tokyo Narita (NRT)"]),
    );
    expect(suggestAirports("hnd")[0]?.name).toBe("Tokyo Haneda (HND)");
  });

  it("resolve to the same place whether typed or read", () => {
    expect(resolvePlace("HND", true)).toEqual(airportPlace("HND"));
    // Anywhere but a flight's ends, a code is just text to ground.
    expect(resolvePlace("HND")?.airport).toBeUndefined();
    // Unsettled, a flight's end keeps only a city it plainly names.
    expect(resolvePlace("Manchester, NH", true)).toEqual({ name: "Manchester, NH" });
    expect(resolvePlace("Frankfurt, Germany", true)?.airport).toBe("FRA");
    expect(resolvePlace("nrt or hnd", true)).toMatchObject({ city: "Tokyo", countryCode: "JP" });
    expect(resolvePlace("Tokyo NRT/HND", true)).toMatchObject({ city: "Tokyo", countryCode: "JP" });
    expect(resolvePlace("Tokyo Narita or Haneda", true)).toMatchObject({ city: "Tokyo", countryCode: "JP" });
    expect(resolvePlace("Narita or Haneda", true)).toMatchObject({ city: "Tokyo", countryCode: "JP" });
    expect(resolvePlace("Charles de Gaulle or Orly", true)).toMatchObject({ city: "Paris", countryCode: "FR" });
    // "OR" after a city is Oregon, not "or": no foreign country.
    expect(resolvePlace("Rome, OR", true)?.countryCode).toBeUndefined();
    expect(resolvePlace("   ")).toBeUndefined();
  });
});

describe("filing a typed item", () => {
  it("goes in as a full-confidence item from the traveller", () => {
    const tripId = createTrip({
      name: "Tokyo",
      homeCountry: "IN",
      destinationCountries: ["JP"],
      startDate: "2026-10-14",
      endDate: "2026-10-22",
      travelers: [{ name: "Sehej", passportCountry: "IN", passportExpiry: "2031-01-01" }],
    });
    const trip = getSnapshot().trips.find((entry) => entry.id === tripId)!;
    const { draft } = buildManualDraft(values({ kind: "activity", name: "Tea ceremony" }));

    const item = fileDraft(trip, draft!, MANUAL_META);

    expect(item).toMatchObject({
      tripId,
      title: "Tea ceremony",
      source: "manual",
      confidence: 1,
      extractionMethod: "deterministic",
      // Filed by the trip's first traveller, as a read item is.
      addedBy: trip.travelers[0].id,
    });
    expect(tripItems(getSnapshot(), tripId).map((entry) => entry.id)).toContain(item.id);
  });

  it("starts a trip around it when none is open", () => {
    const before = getSnapshot().trips.length;
    const { draft } = buildManualDraft(
      values({ kind: "flight", flightNumber: "AI 142", from: "DEL", to: "HND", startsAt: "2026-10-14T19:55" }),
    );

    const item = fileDraft(undefined, draft!, MANUAL_META);
    const trip = getSnapshot().trips.find((entry) => entry.id === item.tripId);

    expect(getSnapshot().trips.length).toBe(before + 1);
    expect(trip).toMatchObject({ name: "Tokyo", startDate: "2026-10-14", destinationCountries: ["JP"] });
  });
});
