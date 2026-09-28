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

  it("pins a stay or activity by its name when no place is typed, as the extractor does", () => {
    const { draft } = buildManualDraft(
      values({ kind: "lodging", name: "Park Hyatt Tokyo", startsAt: "2026-10-16T15:00", endsAt: "2026-10-25T11:00" }),
    );
    expect(draft?.place).toMatchObject({ name: "Tokyo", countryCode: "JP" });
    expect(draft?.endsAt).toBe("2026-10-25T11:00:00+09:00");

    // A name that lands nowhere is not turned into a place.
    expect(buildManualDraft(values({ kind: "lodging", name: "Hotel Gracery" })).draft?.place).toBeUndefined();
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
    expect(readCost("52,400", "INR")).toEqual({ cost: { amount: 52400, currency: "INR" } });
    expect(readCost(" 12.50 ", "USD")).toEqual({ cost: { amount: 12.5, currency: "USD" } });
    // A comma keypad's decimal point, and European grouping.
    expect(readCost("12,50", "EUR")).toEqual({ cost: { amount: 12.5, currency: "EUR" } });
    expect(readCost("1.234,50", "EUR")).toEqual({ cost: { amount: 1234.5, currency: "EUR" } });
    // Read as written; the editor keeps a negative it was given.
    expect(readCost("-40", "USD")).toEqual({ cost: { amount: -40, currency: "USD" } });
    expect(readCost("12,5,0", "EUR")).toEqual({ problem: "amount" });
    expect(readCost("", "USD")).toEqual({});
  });
});

describe("airports typed by hand", () => {
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
    // Still left to the traveller: a city with two airports, or two codes at once.
    expect(code("Tokyo airport")).toBeUndefined();
    expect(code("DEL to HND")).toBeUndefined();
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
    expect(suggestAirports("tokyo").map((airport) => airport.name)).toEqual(
      expect.arrayContaining(["Tokyo Haneda (HND)", "Tokyo Narita (NRT)"]),
    );
    expect(suggestAirports("hnd")[0]?.name).toBe("Tokyo Haneda (HND)");
  });

  it("resolve to the same place whether typed or read", () => {
    expect(resolvePlace("HND", true)).toEqual(airportPlace("HND"));
    // Anywhere but a flight's ends, a code is just text to ground.
    expect(resolvePlace("HND")?.airport).toBeUndefined();
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
