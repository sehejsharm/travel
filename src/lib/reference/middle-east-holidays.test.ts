import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import { KABUL, TEHRAN, inGregorianYear, toGregorian, yearStart } from "../../../scripts/holiday-supplements/_solar-hijri.mjs";
import supplements, {
  ENTRIES,
  afghanistanEntries,
  azerbaijanEntries,
  iranEntries,
  iraqEntries,
  jordanEntries,
  kuwaitEntries,
  kyrgyzstanEntries,
  lebanonEntries,
  omanEntries,
  palestineEntries,
  qatarEntries,
  syriaEntries,
  tajikistanEntries,
  turkmenistanEntries,
  uaeEntries,
  yemenEntries,
} from "../../../scripts/holiday-supplements/middle-east.mjs";

/**
 * The Middle East and Central Asia (scripts/holiday-supplements/middle-east.mjs
 * and _solar-hijri.mjs), checked against dates the governments published.
 * Sources and match rates are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };
type EntriesOf = (year: number) => Entry[];

const FROM = 2026;
const TO = 2050;
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";
const SOLAR = "Solar date, estimated: the official date can differ by a day.";
const DAYS_OFF = new Set(["public", "bank", "optional"]);
const years = Array.from({ length: TO - FROM + 1 }, (_, index) => FROM + index);

const EID_FITR = "End of Ramadan (Eid al-Fitr)";
const EID_ADHA = "Feast of the Sacrifice (Eid al-Adha)";

function datesOf(entriesOf: EntriesOf, name: string | RegExp, year: number, kinds = DAYS_OFF): string[] {
  return (entriesOf(year) as Entry[])
    .filter((entry) => (typeof name === "string" ? entry.name === name : name.test(entry.name)) && kinds.has(entry.kind))
    .map((entry) => entry.date)
    .sort();
}

/** The days off in a date range, whatever their names. */
function daysOff(entriesOf: EntriesOf, from: string, to: string): string[] {
  const year = Number(from.slice(0, 4));
  return [
    ...new Set(
      (entriesOf(year) as Entry[])
        .filter((entry) => entry.date >= from && entry.date <= to && DAYS_OFF.has(entry.kind))
        .map((entry) => entry.date),
    ),
  ].sort();
}

/** "MM-DD" dates in a year, for short fixtures. */
const on = (year: number, ...days: string[]) => days.map((day) => `${year}-${day}`);

/** One country's calendar as the build makes it: library, less drops, plus this module's entries. */
function built(country: string): EntriesOf {
  const mine = supplementEntries(
    (supplements as { country: string }[]).filter((supplement) => supplement.country === country),
    "middle-east.mjs",
  );
  const library = applyDrops(country, libraryEntries(country), mine);
  const all = mergeEntries(library, mine.flatMap((supplement: { entries: Entry[] }) => supplement.entries)) as Entry[];
  return (year) => all.filter((entry) => entry.date.startsWith(`${year}-`));
}

// ---------------------------------------------------------------------------
// Every country.

describe("every country", () => {
  it("has days off in every year, valid kinds, and plain notes", () => {
    for (const [country, entriesOf] of Object.entries(ENTRIES)) {
      for (const year of years) {
        const list = (entriesOf as EntriesOf)(year);
        expect(list.some((entry) => entry.kind === "public"), `${country} ${year}`).toBe(true);
        for (const entry of list) {
          expect(entry.date.startsWith(`${year}-`), `${country} ${entry.date} ${entry.name}`).toBe(true);
          expect(["public", "bank", "optional", "observance", "festival"]).toContain(entry.kind);
          expect(entry.note, `${country} ${entry.date} ${entry.name}`).not.toMatch(/[—–]/);
        }
      }
    }
  });

  it("ends every Islamic date's note with the library's caveat", () => {
    const islamicName = /Eid|Ramadan|Arafat|Islamic New Year|Mawlid|Mi'raj|Ashura|Arbaeen|Ghadir|Ait|Idi |Oraza|Gurban/;
    for (const [country, entriesOf] of Object.entries(ENTRIES)) {
      for (const year of [2026, 2035, 2050]) {
        for (const entry of (entriesOf as EntriesOf)(year)) {
          // Oman's 2026 days and Iran's 1405 ones are the announced ones, not estimates.
          if (!islamicName.test(entry.name) || (country === "OM" && /2026/.test(entry.note) && !entry.note.endsWith(ISLAMIC))) continue;
          if (country === "IR" && entry.note.startsWith("The date in Iran's official calendar for 1405")) continue;
          expect(entry.note.endsWith(ISLAMIC), `${country} ${entry.date} ${entry.name}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The Solar Hijri calendar.

describe("Solar Hijri calendar", () => {
  it("starts the years 1399 to 1405 on Iran's published days", () => {
    // Iran's official calendars: 1 Farvardin (as widely recorded; 1404 from the
    // equinox at 12:31 IRST, after noon).
    const published: [number, string][] = [
      [1399, "2020-03-20"],
      [1400, "2021-03-21"],
      [1401, "2022-03-21"],
      [1402, "2023-03-21"],
      [1403, "2024-03-20"],
      [1404, "2025-03-21"], // equinox 12:31 IRST, after noon
      [1405, "2026-03-21"],
    ];
    for (const [shYear, date] of published) expect(toGregorian(shYear, 1, 1), `${shYear}`).toBe(date);
    // 22 Bahman, the revolution's anniversary: 11 February 2024, 10 February 2025.
    expect(toGregorian(1402, 11, 22)).toBe("2024-02-11");
    expect(toGregorian(1403, 11, 22)).toBe("2025-02-10");
  });

  it("agrees with date-holidays (jalaali-js) on every Solar Hijri holiday from 2026 to 2050", () => {
    const solar = /^(Nowruz|Islamic Republic Day|Sizdah Bedar|Imam Khomeini's Demise|Revolt of Khordad 15|Anniversary of Islamic Revolution|Nationalization of the Iranian oil industry)$/;
    const library = (libraryEntries("IR") as Entry[]).filter((entry) => solar.test(entry.name)).map((entry) => `${entry.date} ${entry.name}`);
    const mine = years.flatMap((year) =>
      (iranEntries as EntriesOf)(year).filter((entry) => solar.test(entry.name)).map((entry) => `${entry.date} ${entry.name}`),
    );
    expect(mine.sort()).toEqual(library.sort());
    expect(mine).toHaveLength(250);
  });

  it("never puts the equinox within 30 minutes of Tehran's noon from 2026 to 2050", () => {
    for (const year of years) expect(Math.abs(yearStart(year, TEHRAN).margin), `${year}`).toBeGreaterThanOrEqual(30);
  });

  it("knows Kabul's noon would start 1408 a day later, and flags Afghanistan's dates that year", () => {
    expect(yearStart(2029, TEHRAN).date).toBe("2029-03-20");
    expect(yearStart(2029, KABUL).date).toBe("2029-03-21");
    const flagged = years.flatMap((year) =>
      (afghanistanEntries as EntriesOf)(year)
        .filter((entry) => entry.note.endsWith(SOLAR))
        .map((entry) => entry.date),
    );
    expect(flagged).toContain("2029-08-18"); // 28 Asad 1408
    expect(flagged).toContain("2030-02-14"); // 26 Dalw 1408
    expect(flagged.every((date: string) => date >= "2029-03-20" && date <= "2034-03-19")).toBe(true);
  });

  it("maps a month and day into the right Gregorian year", () => {
    expect(inGregorianYear(2026, 11, 22)).toEqual({ date: "2026-02-11", shYear: 1404 });
    expect(inGregorianYear(2026, 1, 1)).toEqual({ date: "2026-03-21", shYear: 1405 });
    expect(inGregorianYear(2028, 12, 29)).toEqual({ date: "2028-03-19", shYear: 1406 });
  });
});

// ---------------------------------------------------------------------------
// The United Arab Emirates.

describe("United Arab Emirates", () => {
  const ae = built("AE");

  it("gives the 2026 Eid al-Fitr break the federal government announced (19 to 22 March)", () => {
    expect(daysOff(ae, "2026-03-15", "2026-03-31")).toEqual(on(2026, "03-19", "03-20", "03-21", "03-22"));
  });

  it("covers the 2024 and 2025 Eid al-Fitr breaks but 2024's first day (29 Ramadan)", () => {
    const eve = (year: number) => datesOf(uaeEntries as EntriesOf, EID_FITR, year);
    const library = (year: number) =>
      (libraryEntries("AE", year, year) as Entry[]).filter((entry) => entry.name === EID_FITR).map((entry) => entry.date);
    // The 2024 and 2025 announcements as remembered (not re-checked in the
    // research run). 2024: 8 to 12 April; 8 April (29 Ramadan) is not listed.
    expect([...eve(2024), ...library(2024)].sort()).toEqual(on(2024, "04-09", "04-10", "04-11", "04-12"));
    // 2025: 30 March to 1 April (the day before, 29 March, was a Saturday).
    expect([...eve(2025), ...library(2025)].sort()).toEqual(on(2025, "03-29", "03-30", "03-31", "04-01"));
  });

  it("adds Arafat Day to the Eid al-Adha break (26 to 29 May 2026)", () => {
    expect(daysOff(ae, "2026-05-20", "2026-05-31")).toEqual(on(2026, "05-26", "05-27", "05-28", "05-29"));
  });

  it("lists 1 to 3 December, which hold the days off given in 2024 (2, 3) and 2025 (1, 2)", () => {
    for (const year of years) {
      expect(datesOf(ae, /^(Commemoration Day|National Day)$/, year)).toEqual(on(year, "12-01", "12-02", "12-03"));
      // Only 2 December is certain; the government adds 1 or 3 December, or both.
      expect(datesOf(ae, /^(Commemoration Day|National Day)$/, year, new Set(["public"]))).toEqual(on(year, "12-02"));
    }
  });

  it("marks Laylat al-Mi'raj and the first day of Ramadan, but not as days off", () => {
    for (const year of years) {
      const list = ae(year).filter((entry) => entry.name === "Laylat al-Mi'raj" || entry.name === "First day of Ramadan");
      expect(list.length, `${year}`).toBeGreaterThanOrEqual(2);
      expect(list.every((entry) => entry.kind === "observance"), `${year}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Iran and Azerbaijan.

describe("Iran", () => {
  it("lists each Solar Hijri holiday once a year, after the library's are dropped", () => {
    const ir = built("IR");
    for (const year of years) {
      expect(datesOf(ir, "Nowruz", year)).toHaveLength(4);
      for (const name of ["Islamic Republic Day", "Sizdah Bedar", "Anniversary of Islamic Revolution", "Nationalization of the Iranian oil industry"]) {
        expect(datesOf(ir, name, year), `${name} ${year}`).toHaveLength(1);
      }
    }
    expect(datesOf(ir, "Nowruz", 2028)).toEqual(on(2028, "03-20", "03-21", "03-22", "03-23"));
    expect(datesOf(ir, "Anniversary of Islamic Revolution", 2029)).toEqual(["2029-02-10"]);
  });
});

describe("Azerbaijan", () => {
  const az = built("AZ");

  it("matches the Cabinet's 2026 non-working days: Novruz 20 to 24 March and make-up days 25, 26, 27 and 30 March", () => {
    expect(daysOff(az, "2026-03-15", "2026-03-31")).toEqual(
      on(2026, "03-20", "03-21", "03-22", "03-23", "03-24", "03-25", "03-26", "03-27", "03-30"),
    );
    expect(datesOf(az, "Spring Festival", 2026)).toEqual([]);
  });

  it("matches the Cabinet's whole 2026 list, with Victory Day and the art. 105 transfers", () => {
    expect(daysOff(az, "2026-01-01", "2026-12-31")).toEqual(
      on(
        2026,
        "01-01", "01-02", "01-20", "03-08", "03-09",
        "03-20", "03-21", "03-22", "03-23", "03-24", "03-25", "03-26", "03-27", "03-30",
        "05-09", "05-11", "05-27", "05-28", "05-29", "06-15", "06-26",
        "11-08", "11-09", "11-10", "12-31",
      ),
    );
    // Working days since 2021, marked but not off.
    for (const [date, name] of [["2026-10-18", "Day of Restoration of Independence"], ["2026-11-12", "Constitution Day"], ["2026-11-17", "National Revival Day"]]) {
      expect(az(2026).find((entry) => entry.date === date && entry.name === name)?.kind).toBe("observance");
    }
    expect(datesOf(az, "Independence Day", 2026)).toEqual(["2026-05-28"]);
    expect(datesOf(az, "Victory Day", 2030)).toEqual(["2030-11-08"]);
  });

  it("gives Novruz five days, 20 to 24 March, every year, and makes up its weekend days", () => {
    for (const year of years) {
      expect(datesOf(azerbaijanEntries as EntriesOf, "Novruz Holiday", year)).toEqual(on(year, "03-20", "03-21", "03-22", "03-23", "03-24"));
      const weekend = on(year, "03-20", "03-21", "03-22", "03-23", "03-24").filter((date) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()));
      expect(datesOf(azerbaijanEntries as EntriesOf, "Novruz Holiday (substitute day)", year)).toHaveLength(weekend.length);
    }
  });
});

describe("Uzbekistan (library)", () => {
  it("keeps Navro'z on 21 March, with the 2026 decree's make-up day on Monday 23 March", () => {
    const uz = (year: number) => (libraryEntries("UZ", year, year) as Entry[]).filter((entry) => /^Nowruz/.test(entry.name)).map((entry) => entry.date);
    expect(uz(2026)).toEqual(["2026-03-21", "2026-03-23"]);
    for (const year of years) expect(uz(year)).toContain(`${year}-03-21`);
  });
});

// ---------------------------------------------------------------------------
// The Gulf.

describe("Qatar", () => {
  it("matches the 2026 dates", () => {
    expect(datesOf(qatarEntries as EntriesOf, "National Sport Day", 2026)).toEqual(["2026-02-10"]);
    expect(datesOf(qatarEntries as EntriesOf, "National Day", 2026)).toEqual(["2026-12-18"]);
    // The Amiri Diwan's breaks: Eid al-Fitr 17 to 23 March, Eid al-Adha 26 to 30 May 2026.
    for (const date of datesOf(qatarEntries as EntriesOf, EID_FITR, 2026)) expect(date >= "2026-03-17" && date <= "2026-03-23").toBe(true);
    expect(datesOf(qatarEntries as EntriesOf, EID_ADHA, 2026)).toEqual(on(2026, "05-27", "05-28", "05-29"));
  });
});

describe("Oman", () => {
  it("matches the Council of Ministers' 2026 list", () => {
    const om = omanEntries as EntriesOf;
    expect(datesOf(om, "Accession Day", 2026)).toEqual(["2026-01-15"]);
    expect(datesOf(om, "Isra and Mi'raj", 2026)).toEqual(["2026-01-18"]);
    expect(datesOf(om, "Islamic New Year", 2026)).toEqual(["2026-06-18"]);
    expect(datesOf(om, "Birthday of Muhammad (Mawlid)", 2026)).toEqual(["2026-08-27"]);
    expect(datesOf(om, "National Day", 2026)).toEqual(["2026-11-25", "2026-11-26"]);
  });

  it("gives the Ministry of Labour's 2026 Eid al-Fitr break, 19 to 23 March, with a day for Eid on a Friday", () => {
    expect(daysOff(omanEntries as EntriesOf, "2026-03-15", "2026-03-31")).toEqual(on(2026, "03-19", "03-20", "03-21", "03-22", "03-23"));
  });

  it("keeps law dates from 2027, and records that Oman kept Eid al-Fitr 2025 a day after the library", () => {
    expect(datesOf(omanEntries as EntriesOf, "National Day", 2027)).toEqual(["2027-11-20", "2027-11-21"]);
    expect(datesOf(omanEntries as EntriesOf, "Accession Day", 2027)).toEqual(["2027-01-11"]);
    // Oman kept Eid al-Fitr 2025 on 31 March (as remembered, not re-checked).
    // Computed: 30 March, Saudi Arabia's day.
    expect(datesOf(omanEntries as EntriesOf, EID_FITR, 2025)).toContain("2025-03-30");
  });
});

describe("Kuwait", () => {
  it("matches the Civil Service Commission's 2025 Eid al-Fitr break and the 2026 dates", () => {
    expect(datesOf(kuwaitEntries as EntriesOf, EID_FITR, 2025)).toEqual(on(2025, "03-30", "03-31", "04-01"));
    expect(datesOf(kuwaitEntries as EntriesOf, "Islamic New Year", 2026)).toEqual(["2026-06-16"]);
    expect(datesOf(kuwaitEntries as EntriesOf, "National Day", 2026)).toEqual(["2026-02-25"]);
    expect(datesOf(kuwaitEntries as EntriesOf, "Liberation Day", 2026)).toEqual(["2026-02-26"]);
    expect(daysOff(kuwaitEntries as EntriesOf, "2026-05-20", "2026-05-31")).toEqual(on(2026, "05-26", "05-27", "05-28", "05-29"));
  });
});

// ---------------------------------------------------------------------------
// The Levant and Iraq.

describe("Jordan", () => {
  it("matches the Prime Ministry's 2025 and 2026 circulars", () => {
    expect(datesOf(jordanEntries as EntriesOf, EID_FITR, 2025)).toEqual(on(2025, "03-30", "03-31", "04-01", "04-02"));
    expect(daysOff(jordanEntries as EntriesOf, "2026-05-24", "2026-05-31")).toEqual(
      on(2026, "05-25", "05-26", "05-27", "05-28", "05-29", "05-30"),
    );
    expect(datesOf(jordanEntries as EntriesOf, "Islamic New Year", 2026)).toEqual(["2026-06-16"]);
  });
});

describe("Iraq", () => {
  it("has the days of the Official Holidays Law No. 12 of 2024", () => {
    const iq = iraqEntries as EntriesOf;
    for (const year of years) {
      for (const [name, days] of [
        ["New Year's Day", 1],
        ["Army Day", 1],
        ["Nowruz", 1],
        ["Labour Day", 1],
        ["National Day", 1],
      ] as const) {
        expect(datesOf(iq, name, year), `${name} ${year}`).toHaveLength(days);
      }
    }
    // Eid al-Adha is four days (10 to 13 Dhu al-Hijjah); Eid al-Ghadir 24 June 2024.
    expect(datesOf(iq, EID_ADHA, 2026)).toEqual(on(2026, "05-27", "05-28", "05-29", "05-30"));
    expect(datesOf(iq, "Eid al-Ghadir", 2024)).toEqual(["2024-06-24"]);
    // The law's count: 11 occasions, 16 days (a year with each lunar holiday once).
    const general = iq(2030).filter((entry) => entry.kind === "public");
    expect(new Set(general.map((entry) => entry.name)).size).toBe(11);
    expect(general).toHaveLength(16);
  });
});

describe("Lebanon", () => {
  it("matches the 2025 and 2026 lists", () => {
    const lb = lebanonEntries as EntriesOf;
    expect(datesOf(lb, EID_FITR, 2025)).toEqual(on(2025, "03-30", "03-31"));
    expect(datesOf(lb, EID_ADHA, 2025)).toEqual(on(2025, "06-06", "06-07"));
    expect(datesOf(lb, "Day of Ashura", 2025)).toEqual(["2025-07-05"]);
    expect(datesOf(lb, "Birthday of Muhammad (Mawlid)", 2025)).toEqual(["2025-09-04"]);
    expect(datesOf(lb, "Good Friday", 2026)).toEqual(["2026-04-03"]);
    expect(datesOf(lb, "Orthodox Good Friday", 2026)).toEqual(["2026-04-10"]);
    expect(datesOf(lb, "Orthodox Easter Monday", 2026)).toEqual(["2026-04-13"]);
    for (const [name, day] of [
      ["Armenian Christmas", "01-06"],
      ["St Maroun's Day", "02-09"],
      ["Feast of the Annunciation", "03-25"],
      ["Resistance and Liberation Day", "05-25"],
      ["Assumption Day", "08-15"],
      ["Independence Day", "11-22"],
    ]) {
      expect(datesOf(lb, name, 2026), name).toEqual([`2026-${day}`]);
    }
  });
});

describe("Palestine", () => {
  it("matches the Council of Ministers' 2026 Eid al-Adha break and the fixed days", () => {
    const ps = palestineEntries as EntriesOf;
    expect(daysOff(ps, "2026-05-20", "2026-05-31")).toEqual(on(2026, "05-26", "05-27", "05-28", "05-29", "05-30"));
    expect(datesOf(ps, "Isra and Mi'raj", 2026)).toEqual(["2026-01-16"]);
    expect(datesOf(ps, "Independence Day", 2026)).toEqual(["2026-11-15"]);
  });
});

describe("Syria", () => {
  it("has Decree 188 of 2025's days and Nowruz, and none of the days it dropped", () => {
    const sy = syriaEntries as EntriesOf;
    for (const [name, day] of [
      ["Syrian Revolution Day", "03-18"],
      ["Mother's Day", "03-21"],
      ["Nowruz", "03-21"],
      ["Independence Day", "04-17"],
      ["Labour Day", "05-01"],
      ["Liberation Day", "12-08"],
      ["Christmas Day", "12-25"],
    ]) {
      expect(datesOf(sy, name, 2027), name).toEqual([`2027-${day}`]);
    }
    for (const year of years) {
      const fixedDays = sy(year)
        .filter((entry) => !entry.note.endsWith(ISLAMIC) && !/Easter/.test(entry.name))
        .map((entry) => entry.date.slice(5));
      for (const dropped of ["03-08", "05-06", "10-06"]) expect(fixedDays, `${year}`).not.toContain(dropped);
    }
    expect(datesOf(sy, "Easter Sunday", 2026)).toEqual(["2026-04-05"]);
    expect(datesOf(sy, "Orthodox Easter", 2026)).toEqual(["2026-04-12"]);
    expect(datesOf(sy, EID_ADHA, 2026)).toEqual(on(2026, "05-27", "05-28", "05-29", "05-30"));
  });
});

describe("Yemen", () => {
  it("matches the 2025 Eid breaks the calendars list", () => {
    expect(datesOf(yemenEntries as EntriesOf, EID_FITR, 2025)).toEqual(on(2025, "03-29", "03-30", "03-31", "04-01", "04-02"));
    expect(daysOff(yemenEntries as EntriesOf, "2025-06-01", "2025-06-15")).toEqual(on(2025, "06-05", "06-06", "06-07", "06-08", "06-09"));
    expect(datesOf(yemenEntries as EntriesOf, "Unity Day", 2026)).toEqual(["2026-05-22"]);
  });
});

// ---------------------------------------------------------------------------
// Afghanistan and Central Asia.

describe("Afghanistan", () => {
  it("puts the national days on their Solar Hijri dates (2026 as listed)", () => {
    const af = afghanistanEntries as EntriesOf;
    expect(datesOf(af, "Liberation Day", 2026)).toEqual(["2026-02-15"]);
    expect(datesOf(af, "Mujahideen Victory Day", 2026)).toEqual(["2026-04-28"]);
    expect(datesOf(af, "Victory Day", 2026)).toEqual(["2026-08-15"]);
    expect(datesOf(af, "Independence Day", 2026)).toEqual(["2026-08-19"]);
    expect(datesOf(af, "Withdrawal Day", 2026)).toEqual(["2026-08-31"]);
    // A year that starts on 20 March moves them a day earlier.
    expect(datesOf(af, "Independence Day", 2028)).toEqual(["2028-08-18"]);
    // Nowruz is marked, not a day off.
    expect(datesOf(af, "Nowruz", 2026, new Set(["observance"]))).toEqual(["2026-03-21"]);
  });
});

describe("Kyrgyzstan", () => {
  it("matches the Labour Code of 2025 and the Ministry's 2026 calendar", () => {
    const kg = kyrgyzstanEntries as EntriesOf;
    expect(daysOff(kg, "2026-01-01", "2026-01-31")).toEqual(on(2026, "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07"));
    expect(daysOff(kg, "2026-05-01", "2026-05-31")).toEqual([
      ...on(2026, "05-01", "05-02", "05-03", "05-04", "05-05", "05-06", "05-07", "05-08", "05-09"),
      "2026-05-27",
    ]);
    expect(daysOff(kg, "2026-02-01", "2026-04-30")).toEqual(on(2026, "03-08", "03-20", "03-21"));
    expect(daysOff(kg, "2026-08-01", "2026-12-31")).toEqual(["2026-08-31"]);
  });
});

describe("Tajikistan", () => {
  it("matches the 2026 days off, with weekend holidays made up on the Monday", () => {
    const tj = tajikistanEntries as EntriesOf;
    expect(daysOff(tj, "2026-03-01", "2026-03-31")).toEqual(on(2026, "03-08", "03-09", "03-20", "03-21", "03-22", "03-23", "03-24"));
    expect(daysOff(tj, "2026-05-01", "2026-06-30")).toEqual(on(2026, "05-01", "05-09", "05-11", "05-27", "06-27", "06-29"));
    expect(datesOf(tj, "Independence Day", 2026)).toEqual(["2026-09-09"]);
    expect(datesOf(tj, "Constitution Day", 2026)).toEqual(["2026-11-06"]);
  });
});

describe("Turkmenistan", () => {
  it("matches the Ministry of Labour's 2026 schedule and the September decree", () => {
    const tm = turkmenistanEntries as EntriesOf;
    // The decree for the 35th anniversary: 28 September an extra day off, and
    // Sunday 27 September's day off moved to 29 September.
    expect(daysOff(tm, "2026-01-01", "2026-12-31")).toEqual(
      on(2026, "01-01", "03-08", "03-20", "03-21", "03-22", "05-09", "05-18", "05-27", "05-28", "05-29", "09-27", "09-28", "09-29", "10-06", "12-12"),
    );
  });

  it("moves a Sunday holiday's day off to the next working day from 2027", () => {
    const tm = turkmenistanEntries as EntriesOf;
    // As in 2021: Novruz on Sunday 21 March, off on Tuesday 23 March.
    expect(datesOf(tm, "Novruz Bayramy (substitute day)", 2027)).toEqual(["2027-03-23"]);
    expect(datesOf(tm, "International Neutrality Day (substitute day)", 2027)).toEqual(["2027-12-13"]);
    for (const year of years.filter((y) => y > 2026)) {
      for (const entry of tm(year).filter((e) => e.name.endsWith("(substitute day)"))) {
        expect([1, 2, 3, 4, 5]).toContain(new Date(`${entry.date}T00:00:00Z`).getUTCDay());
      }
    }
  });
});

describe("Uzbekistan (decree days)", () => {
  it("adds the presidential decree's extra days off for 2026", () => {
    const uz = built("UZ");
    expect(datesOf(uz, /\(extra day off\)$/, 2026, new Set(["public"]))).toEqual(on(2026, "01-02", "05-28", "05-29", "08-31"));
    expect(datesOf(uz, /\(extra day off\)$/, 2026, new Set(["optional"]))).toEqual(on(2026, "01-03", "05-30", "12-31"));
    expect(datesOf(uz, /\(extra day off\)$/, 2027)).toEqual([]);
  });
});

describe("Bahrain", () => {
  it("gives Eid al-Fitr three days and Ashura two, with weekend days made up (2026 circulars)", () => {
    const bh = built("BH");
    expect(daysOff(bh, "2026-03-15", "2026-03-31")).toEqual(on(2026, "03-20", "03-21", "03-22", "03-23", "03-24"));
    expect(daysOff(bh, "2026-06-20", "2026-06-30")).toEqual(on(2026, "06-25", "06-26", "06-28"));
  });
});

describe("Iran's 1405 calendar", () => {
  it("uses the published Islamic dates where they differ from the library's", () => {
    const ir = built("IR");
    expect(datesOf(ir, EID_FITR, 2026)).toEqual(["2026-03-21"]);
    expect(datesOf(ir, "Eid al-Fitr (second day)", 2026)).toEqual(["2026-03-22"]);
    expect(datesOf(ir, "Demise of Prophet Muhammad and Imam Hassan (Mujtaba)", 2026)).toEqual(["2026-08-12"]);
    expect(datesOf(ir, "Birthday of Imam Ali", 2026)).toEqual(["2026-01-02", "2026-12-23"]);
    expect(datesOf(ir, "Mab'ath (the Prophet's mission)", 2027)).toEqual(["2027-01-06", "2027-12-25"]);
    expect(datesOf(ir, EID_FITR, 2027)).toEqual(["2027-03-10"]);
    // Days where the library already agrees stay: Tasua and Ashura on 3 and 4 Tir.
    expect(datesOf(ir, "Ashoura", 2026)).toEqual(["2026-06-25"]);
  });
});
