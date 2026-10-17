import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  ENTRIES,
  caymanEntries,
  falklandsEntries,
  kiribatiEntries,
  macauEntries,
  marianasEntries,
  marshallEntries,
  micronesiaEntries,
  nauruEntries,
  niueEntries,
  northKoreaEntries,
  palauEntries,
  pitcairnEntries,
  pngEntries,
  ruleDates,
  samoaEntries,
  solomonEntries,
  timorEntries,
  tokelauEntries,
  tuvaluEntries,
  ukOfficialBirthday,
  weekday,
} from "../../../scripts/holiday-supplements/pacific-east-asia.mjs";

/**
 * The Pacific islands, Timor-Leste, Macau, North Korea, the Falkland Islands
 * and the Cayman Islands (scripts/holiday-supplements/pacific-east-asia.mjs),
 * checked against dates the governments published. Sources and match rates
 * are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };
type EntriesOf = (year: number) => Entry[];

const FROM = 2026;
const TO = 2050;
const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";
const DAYS_OFF = new Set(["public", "bank", "optional"]);
const years = Array.from({ length: TO - FROM + 1 }, (_, index) => FROM + index);

function datesOf(entriesOf: EntriesOf, name: string | RegExp, year: number, kinds = DAYS_OFF): string[] {
  return entriesOf(year)
    .filter((entry) => (typeof name === "string" ? entry.name === name : name.test(entry.name)) && kinds.has(entry.kind))
    .map((entry) => entry.date)
    .sort();
}

/** Expects each [date, name] to be listed as a day off (any day-off kind). */
function expectDaysOff(entriesOf: EntriesOf, published: [string, string][]) {
  for (const [date, name] of published) {
    const list = entriesOf(Number(date.slice(0, 4)));
    expect(
      list.some((entry) => entry.date === date && entry.name === name && DAYS_OFF.has(entry.kind)),
      `${date} ${name}`,
    ).toBe(true);
  }
}

/** One country's calendar as the build makes it: library, less drops, plus this module's entries. */
function built(country: string): EntriesOf {
  const mine = supplementEntries(
    (supplements as { country: string }[]).filter((supplement) => supplement.country === country),
    "pacific-east-asia.mjs",
  );
  const library = applyDrops(country, libraryEntries(country), mine);
  const all = mergeEntries(library, mine.flatMap((supplement: { entries: Entry[] }) => supplement.entries)) as Entry[];
  return (year) => all.filter((entry) => entry.date.startsWith(`${year}-`));
}

// ---------------------------------------------------------------------------
// Every country.

describe("every country", () => {
  it("has a public day off in every year, valid kinds and plain notes", () => {
    for (const [country, entriesOf] of Object.entries(ENTRIES)) {
      for (const year of years) {
        const list = (entriesOf as EntriesOf)(year);
        if (country !== "KY") expect(list.some((entry) => entry.kind === "public"), `${country} ${year}`).toBe(true);
        for (const entry of list) {
          expect(entry.date.startsWith(`${year}-`), `${country} ${entry.date} ${entry.name}`).toBe(true);
          expect(["public", "bank", "optional", "observance", "festival"]).toContain(entry.kind);
          expect(entry.note, `${country} ${entry.date} ${entry.name}`).not.toMatch(/[—–]/);
        }
      }
    }
  });

  it("passes the build's checks, and every drop rule removes something", () => {
    const checked = supplementEntries(supplements, "pacific-east-asia.mjs");
    expect(checked.map((supplement: { country: string }) => supplement.country)).toEqual(Object.keys(ENTRIES).sort());
    expect(() => built("KY")).not.toThrow();
  });

  it("never puts a substitute day on another day off or a weekend", () => {
    for (const [country, entriesOf] of Object.entries(ENTRIES)) {
      for (const year of years) {
        const list = (entriesOf as EntriesOf)(year);
        for (const sub of list.filter((entry) => /\(substitute day\)$/.test(entry.name))) {
          expect([0, 6], `${country} ${sub.date} ${sub.name}`).not.toContain(weekday(sub.date));
          const others = list.filter(
            (entry) => entry.date === sub.date && entry !== sub && DAYS_OFF.has(entry.kind) && !/\(substitute day\)$/.test(entry.name),
          );
          // A regional day can coincide with a national substitute; national ones never do.
          const clash = others.filter((entry) => !/^Day off in /.test(entry.note) || /^Day off in /.test(sub.note));
          expect(clash, `${country} ${sub.date} ${sub.name}`).toEqual([]);
        }
      }
    }
  });

  it("marks every computed lunar date, and only those, as estimated", () => {
    for (const [country, entriesOf] of Object.entries({ MO: macauEntries, KP: northKoreaEntries })) {
      for (const year of years) {
        for (const entry of (entriesOf as EntriesOf)(year)) {
          const lunar =
            /Lunar New Year|Seollal|Buddha|Tuen Ng|Mid-Autumn|Chung Yeung|A-Ma|Drunken Dragon|Daeboreum|Chuseok/.test(entry.name) &&
            !/\(substitute day\)$/.test(entry.name);
          expect(entry.note.endsWith(LUNAR), `${country} ${entry.date} ${entry.name}`).toBe(lunar);
        }
      }
    }
    for (const year of years) {
      for (const entry of timorEntries(year).filter((e: Entry) => /Eid/.test(e.name))) {
        expect(entry.note.endsWith(ISLAMIC), `${entry.date} ${entry.name}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The sovereign's birthday, on the UK's official-birthday Saturday.

describe("the King's official birthday", () => {
  it("is the Saturday from 11 to 17 June in the years the UK kept it there", () => {
    // Trooping the Colour: 2020 (13 June), 2021, 2023 to 2026. Not 2022 (the
    // jubilee, 2 June), 2018 (9 June) or 2019 (8 June).
    expect([2020, 2021, 2023, 2024, 2025, 2026].map(ukOfficialBirthday)).toEqual([
      "2020-06-13",
      "2021-06-12",
      "2023-06-17",
      "2024-06-15",
      "2025-06-14",
      "2026-06-13",
    ]);
  });

  it("gives the Cayman Islands the Monday after (gov.ky lists 2020 to 2026)", () => {
    // date-holidays' hard-coded Queen's Birthday dates, from gov.ky.
    const published: Record<number, string> = {
      2020: "2020-06-15",
      2021: "2021-06-14",
      2023: "2023-06-19",
      2024: "2024-06-17",
      2025: "2025-06-16",
      2026: "2026-06-15",
    };
    for (const [year, date] of Object.entries(published)) {
      expect(datesOf(caymanEntries, "King's Birthday", Number(year))).toEqual([date]);
    }
    // The rule misses 2018 (11 June), 2019 (10 June) and 2022 (20 June).
    expect(datesOf(caymanEntries, "King's Birthday", 2019)).toEqual(["2019-06-17"]);
  });

  it("gives the Solomon Islands the Friday before (gazettes 2023 to 2025)", () => {
    expect(datesOf(solomonEntries, "King's Birthday", 2023)).toEqual(["2023-06-16"]);
    expect(datesOf(solomonEntries, "King's Birthday", 2024)).toEqual(["2024-06-14"]);
    expect(datesOf(solomonEntries, "King's Birthday", 2025)).toEqual(["2025-06-13"]);
    expect(datesOf(solomonEntries, "King's Birthday", 2026)).toEqual(["2026-06-12"]);
  });
});

// ---------------------------------------------------------------------------
// Cayman Islands: what the library lacks or has wrong.

describe("Cayman Islands", () => {
  const ky = built("KY");

  it("matches the government's 2026 list", () => {
    // Caymanian Times, "Cayman Islands 2026 public holidays" (government list).
    expectDaysOff(ky, [
      ["2026-01-01", "New Year's Day"],
      ["2026-01-26", "National Heroes Day"],
      ["2026-02-18", "Ash Wednesday"],
      ["2026-04-03", "Good Friday"],
      ["2026-04-06", "Easter Monday"],
      ["2026-05-04", "Emancipation Day"],
      ["2026-05-18", "Discovery Day"],
      ["2026-06-15", "King's Birthday"],
      ["2026-07-06", "Constitution Day"],
      ["2026-11-09", "Remembrance Day"],
      ["2026-12-25", "Christmas Day"],
      ["2026-12-28", "Boxing Day (substitute day)"],
    ]);
    expect(ky(2026).filter((entry) => entry.name === "Queen's Birthday")).toEqual([]);
  });

  it("has the King's Birthday and Constitution Day every year, never on 2 July", () => {
    for (const year of years) {
      expect(datesOf(ky, "King's Birthday", year)).toHaveLength(1);
      const constitution = datesOf(ky, "Constitution Day", year);
      expect(constitution).toHaveLength(1);
      expect(weekday(constitution[0])).toBe(1);
      expect(Number(constitution[0].slice(8))).toBeLessThanOrEqual(7);
    }
  });

  it("moves Christmas and Boxing Day off a weekend", () => {
    // 2027: Saturday and Sunday, so Monday and Tuesday. 2033: Sunday and Monday.
    expect(datesOf(ky, /\(substitute day\)$/, 2027)).toEqual(["2027-12-27", "2027-12-28"]);
    expect(datesOf(ky, "Christmas Day (substitute day)", 2033)).toEqual(["2033-12-27"]);
  });
});

// ---------------------------------------------------------------------------
// Papua New Guinea and the Solomon Islands.

describe("Papua New Guinea", () => {
  it("matches the gazetted 2026 list (G832, 19 August 2025)", () => {
    expectDaysOff(pngEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-02-26", "Grand Chief Sir Michael Somare Remembrance Day"],
      ["2026-04-03", "Good Friday"],
      ["2026-04-06", "Easter Monday"],
      ["2026-06-17", "King's Birthday"],
      ["2026-07-23", "National Remembrance Day"],
      ["2026-08-26", "National Repentance Day"],
      ["2026-09-16", "Independence Day"],
      ["2026-12-25", "Christmas Day"],
      ["2026-12-26", "Boxing Day"],
    ]);
    // Boxing Day on a Saturday is not moved; only Sunday holidays are.
    expect(datesOf(pngEntries, /\(substitute day\)$/, 2026)).toEqual([]);
  });

  it("matches 2025 (IPA list) and the Act's Sunday rule", () => {
    expectDaysOff(pngEntries, [
      ["2025-02-26", "Grand Chief Sir Michael Somare Remembrance Day"],
      ["2025-06-17", "King's Birthday"],
      ["2025-09-16", "Independence Day"],
    ]);
    // Christmas 2033 on a Sunday: Boxing Day Monday, and Tuesday for Christmas.
    expect(datesOf(pngEntries, "Christmas Day (substitute day)", 2033)).toEqual(["2033-12-27"]);
  });

  it("lists the 2026 Highlands shows", () => {
    const festival = new Set(["festival"]);
    expect(datesOf(pngEntries, "Goroka Show", 2026, festival)).toEqual(["2026-09-18", "2026-09-19", "2026-09-20"]);
    expect(datesOf(pngEntries, "Mount Hagen Show", 2026, festival)).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
    expect(datesOf(pngEntries, "Goroka Show", 2027, festival)).toEqual([]);
  });
});

describe("Solomon Islands", () => {
  it("matches the 2026 dates published so far", () => {
    expectDaysOff(solomonEntries, [
      ["2026-04-03", "Good Friday"],
      ["2026-04-04", "Holy Saturday"],
      ["2026-04-06", "Easter Monday"],
      ["2026-05-25", "Whit Monday"],
      ["2026-07-07", "Independence Day"],
      ["2026-12-26", "National Day of Thanksgiving"],
      ["2026-12-28", "National Day of Thanksgiving (substitute day)"],
      // Gazette No. 114 of 10 August 2026.
      ["2026-11-18", "Malaita Province Day"],
    ]);
    expect(datesOf(solomonEntries, "Malaita Province Day", 2026)).toEqual(["2026-11-18"]);
    expect(datesOf(solomonEntries, "Malaita Province Day", 2027)).toEqual(["2027-08-15"]);
  });

  it("keeps a Saturday New Year's Day on the Friday before", () => {
    expect(datesOf(solomonEntries, "New Year's Day (substitute day)", 2027)).toEqual(["2027-12-31"]);
  });
});

// ---------------------------------------------------------------------------
// Micronesia: the Marshall Islands, Palau, the FSM and the Northern Marianas.

describe("Micronesia and its neighbours", () => {
  it("matches the Marshall Islands' 2026 holidays", () => {
    expectDaysOff(marshallEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-03-01", "Nuclear Victims Remembrance Day"],
      ["2026-03-02", "Nuclear Victims Remembrance Day (substitute day)"],
      ["2026-04-03", "Good Friday"],
      ["2026-05-01", "Constitution Day"],
      ["2026-07-03", "Fishermen's Day"],
      ["2026-09-04", "Dri-Jerbal Day"],
      ["2026-09-25", "Manit Day"],
      ["2026-11-17", "President's Day"],
      ["2026-12-04", "Gospel Day"],
      ["2026-12-25", "Christmas Day"],
    ]);
    expect(datesOf(marshallEntries, "General Election Day", 2027)).toEqual(["2027-11-15"]);
    expect(datesOf(marshallEntries, "General Election Day", 2028)).toEqual([]);
  });

  it("matches Palau's 2026 holidays", () => {
    expectDaysOff(palauEntries, [
      ["2026-03-16", "Youth Day (substitute day)"],
      ["2026-05-05", "Senior Citizens Day"],
      ["2026-06-01", "President's Day"],
      ["2026-07-09", "Constitution Day"],
      ["2026-10-01", "Independence Day"],
      ["2026-10-23", "United Nations Day (substitute day)"],
      ["2026-11-27", "Family Day"],
    ]);
  });

  it("matches the FSM's 2026 holidays", () => {
    expectDaysOff(micronesiaEntries, [
      ["2026-03-31", "Micronesian Culture and Tradition Day"],
      ["2026-05-11", "Federated States of Micronesia Day (substitute day)"],
      ["2026-10-23", "United Nations Day (substitute day)"],
      ["2026-11-03", "Independence Day"],
      ["2026-11-11", "FSM Veterans of Foreign Wars Day"],
      ["2026-11-23", "Presidents Day"],
    ]);
    const yapDay = micronesiaEntries(2026).find((entry: Entry) => entry.name === "Yap Day");
    expect(yapDay).toMatchObject({ date: "2026-03-01", kind: "optional" });
    expect(yapDay?.note).toMatch(/^Day off in Yap\./);
  });

  it("follows the Northern Marianas' memos", () => {
    // 2023 memo: Citizenship Day, Saturday 4 November, on Friday 3 November.
    expectDaysOff(marianasEntries, [
      ["2022-03-24", "Commonwealth Covenant Day"],
      ["2023-11-03", "Citizenship Day (substitute day)"],
      ["2026-03-24", "Commonwealth Covenant Day"],
      ["2026-10-12", "Commonwealth Cultural Day"],
      ["2026-11-03", "Election Day"],
      ["2026-11-04", "Citizenship Day"],
      ["2026-12-08", "Constitution Day"],
      ["2026-07-03", "Independence Day (substitute day)"],
    ]);
    // Good Friday 2035 is 23 March, the Friday before Saturday's Covenant Day.
    expect(datesOf(marianasEntries, "Commonwealth Covenant Day (substitute day)", 2035)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The South Pacific.

describe("the South Pacific", () => {
  it("matches Samoa's 2026 list (MCIL)", () => {
    expectDaysOff(samoaEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-01-02", "Day after New Year's Day"],
      ["2026-04-03", "Good Friday"],
      ["2026-04-04", "Easter Saturday"],
      ["2026-04-06", "Easter Monday"],
      ["2026-05-11", "Mother's Day"],
      ["2026-06-01", "Independence Day"],
      ["2026-08-10", "Father's Day"],
      ["2026-10-12", "White Monday"],
    ]);
    expect(datesOf(samoaEntries, "White Sunday", 2026, new Set(["festival"]))).toEqual(["2026-10-11"]);
  });

  it("matches Kiribati, Nauru and Tuvalu where 2025 and 2026 dates are published", () => {
    expectDaysOff(kiribatiEntries, [
      ["2026-05-01", "Labour Day"],
      ["2026-07-12", "Independence Day"],
      ["2026-07-13", "Independence Day (substitute day)"],
    ]);
    // Nauru's 2025 gazette, and 2026.
    expectDaysOff(nauruEntries, [
      ["2025-04-22", "Easter Tuesday"],
      ["2025-08-19", "Ibumin Earoeni Day"],
      ["2026-04-07", "Easter Tuesday"],
      ["2026-07-01", "RONPHOS Handover Day"],
      ["2026-09-25", "Sir Hammer DeRoburt Day"],
      ["2026-10-26", "Angam Day"],
      ["2026-02-02", "Independence Day (substitute day)"],
      ["2026-02-03", "Day following Independence Day (substitute day)"],
    ]);
    expectDaysOff(tuvaluEntries, [
      ["2026-05-11", "Gospel Day"],
      ["2026-06-13", "King's Birthday"],
      ["2026-10-01", "Tuvalu Day"],
      ["2026-10-02", "Tuvalu Day"],
      ["2026-12-28", "Boxing Day (substitute day)"],
    ]);
  });

  it("matches Niue's circulars, and Tokelau's and Pitcairn's rules", () => {
    expectDaysOff(niueEntries, [
      ["2026-04-03", "Good Friday"],
      ["2026-04-06", "Easter Monday"],
      ["2026-01-02", "Takai Commission Holiday"],
      ["2026-04-27", "ANZAC Day (substitute day)"],
      ["2026-06-01", "King's Birthday"],
    ]);
    expectDaysOff(tokelauEntries, [["2026-09-03", "Tokehega Day"]]);
    expectDaysOff(pitcairnEntries, [
      ["2026-01-23", "Bounty Day"],
      ["2026-06-01", "King's Birthday"],
      ["2026-07-02", "Pitcairn Day"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// The Falkland Islands.

describe("Falkland Islands", () => {
  it("matches the government's 2026 to 2029 list", () => {
    expectDaysOff(falklandsEntries, [
      ["2026-06-15", "Liberation Day (substitute day)"],
      ["2026-10-05", "Peat Cutting Monday"],
      ["2026-11-16", "King's Birthday (substitute day)"],
      ["2026-12-08", "Battle Day"],
      ["2026-12-28", "Boxing Day (substitute day)"],
      ["2026-12-29", "Christmas Holiday (substitute day)"],
      ["2027-12-08", "Battle Day"],
      ["2028-12-08", "Battle Day"],
      ["2029-12-10", "Battle Day (substitute day)"],
    ]);
    expect(datesOf(falklandsEntries, /Thatcher|Falklands Day/, 2026)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Timor-Leste.

describe("Timor-Leste", () => {
  it("lists the fixed and Easter-based days of 2026", () => {
    expectDaysOff(timorEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-03-03", "Veterans' Day"],
      ["2026-04-03", "Good Friday"],
      ["2026-05-01", "Labour Day"],
      ["2026-05-20", "Restoration of Independence Day"],
      ["2026-06-04", "Corpus Christi"],
      ["2026-08-30", "Popular Consultation Day"],
      ["2026-11-01", "All Saints' Day"],
      ["2026-11-02", "All Souls' Day"],
      ["2026-11-03", "National Women's Day"],
      ["2026-11-12", "National Youth Day"],
      ["2026-11-28", "Proclamation of Independence Day"],
      ["2026-12-07", "Memorial Day"],
      ["2026-12-08", "Immaculate Conception"],
      ["2026-12-25", "Christmas Day"],
      ["2026-12-31", "National Heroes Day"],
      ["2026-03-20", "End of Ramadan (Eid al-Fitr)"],
      ["2026-05-27", "Feast of the Sacrifice (Eid al-Adha)"],
    ]);
  });

  it("follows the library's Hijri dates, which matched 5 of Timor-Leste's 10 Eids in 2021 to 2025", () => {
    // Published (timor-leste.gov.tl via python-holidays): Fitr, then Adha.
    const published: Record<number, [string, string]> = {
      2021: ["2021-05-13", "2021-07-19"],
      2022: ["2022-05-02", "2022-07-09"],
      2023: ["2023-04-22", "2023-06-29"],
      2024: ["2024-04-10", "2024-06-17"],
      2025: ["2025-03-31", "2025-06-06"],
    };
    let same = 0;
    for (const [year, [fitr, adha]] of Object.entries(published)) {
      if (ruleDates("1 Shawwal", Number(year))[0] === fitr) same++;
      if (ruleDates("10 Dhu al-Hijjah", Number(year))[0] === adha) same++;
    }
    expect(same).toBe(5);
  });

  it("marks the usual government days off in Lent as optional", () => {
    // Declared every year from 2012 to 2025 (Ash Wednesday 2025: 5 March).
    expect(datesOf(timorEntries, "Ash Wednesday", 2025)).toEqual(["2025-03-05"]);
    expect(datesOf(timorEntries, "Holy Thursday", 2024)).toEqual(["2024-03-28"]);
    expect(timorEntries(2026).find((entry: Entry) => entry.name === "Ash Wednesday")?.kind).toBe("optional");
  });
});

// ---------------------------------------------------------------------------
// Macau.

describe("Macau", () => {
  it("matches the government's 2026 public holidays and compensatory rest days", () => {
    // gov.mo/en/public-holidays/year-2026/
    expectDaysOff(macauEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-02-17", "Lunar New Year's Day"],
      ["2026-02-18", "The second day of the Lunar New Year"],
      ["2026-02-19", "The third day of the Lunar New Year"],
      ["2026-04-03", "Good Friday"],
      ["2026-04-04", "The Day before Easter"],
      ["2026-04-05", "Ching Ming Festival"],
      ["2026-05-01", "Labour Day"],
      ["2026-05-24", "The Buddha's Birthday"],
      ["2026-06-19", "Tuen Ng Festival"],
      ["2026-09-26", "The day following the Mid-Autumn Festival"],
      ["2026-10-01", "National Day of the People's Republic of China"],
      ["2026-10-02", "The day following National Day"],
      ["2026-10-18", "Chung Yeung Festival"],
      ["2026-11-02", "All Souls' Day"],
      ["2026-12-08", "Immaculate Conception"],
      ["2026-12-20", "Macao S.A.R. Establishment Day"],
      ["2026-12-22", "Winter Solstice"],
      ["2026-12-24", "Christmas Eve"],
      ["2026-12-25", "Christmas Day"],
    ]);
    // Six compensatory rest days.
    expect(datesOf(macauEntries, /\(substitute day\)$/, 2026)).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-05-25",
      "2026-09-28",
      "2026-10-19",
      "2026-12-21",
    ]);
  });

  it("marks the ten obligatory holidays as days off for everyone", () => {
    const obligatory = macauEntries(2026).filter((entry: Entry) => entry.kind === "public");
    expect(obligatory).toHaveLength(10);
  });

  it("puts 2033's Chung Yeung and Mid-Autumn where the official calendar does", () => {
    expect(datesOf(macauEntries, "The day following the Mid-Autumn Festival", 2033)).toEqual(["2033-09-09"]);
    expect(datesOf(macauEntries, "Chung Yeung Festival", 2033)).toEqual(["2033-10-01"]);
    // 2039: the generator's calendar, a day after date-holidays' own.
    expect(datesOf(macauEntries, "The day following the Mid-Autumn Festival", 2039)).toEqual(["2039-10-03"]);
  });
});

// ---------------------------------------------------------------------------
// North Korea.

describe("North Korea", () => {
  it("has the 2026 national days off", () => {
    expectDaysOff(northKoreaEntries, [
      ["2026-01-01", "New Year's Day"],
      ["2026-02-17", "Lunar New Year (Seollal)"],
      ["2026-02-16", "Kim Jong Il's Birthday"],
      ["2026-02-17", "Kim Jong Il's Birthday"],
      ["2026-04-15", "Kim Il Sung's Birthday"],
      ["2026-04-16", "Kim Il Sung's Birthday"],
      ["2026-05-01", "May Day"],
      ["2026-07-27", "Victory Day"],
      ["2026-08-15", "Liberation Day"],
      ["2026-09-25", "Chuseok"],
      ["2026-09-09", "Foundation Day of the Republic"],
      ["2026-10-10", "Workers' Party Foundation Day"],
      ["2026-12-27", "Socialist Constitution Day"],
    ]);
  });

  it("keeps the Korean calendar, a day after China's in 2027", () => {
    expect(datesOf(northKoreaEntries, "Lunar New Year (Seollal)", 2027)).toEqual(["2027-02-07"]);
    expect(datesOf(macauEntries, "Lunar New Year's Day", 2027)).toEqual(["2027-02-06"]);
  });
});
