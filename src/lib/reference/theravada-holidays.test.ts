import { describe, expect, it } from "vitest";
import { supplementEntries } from "../../../scripts/build-holidays.mjs";
import { thaiLeapMonthYear, thaiLunarDate } from "../../../scripts/holiday-supplements/festivals.mjs";
import supplements, {
  khmerEntries,
  khmerNewYear,
  laoEntries,
  myanmarDate,
  myanmarEntries,
  thaiBuddhistDays,
  thaiEntries,
  thingyan,
} from "../../../scripts/holiday-supplements/theravada.mjs";

/**
 * The Buddhist calendars of Thailand, Laos, Cambodia and Myanmar
 * (scripts/holiday-supplements/theravada.mjs), checked against dates the
 * governments, central banks and the press published. Sources and match
 * rates are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };

const FROM = 2026;
const TO = 2050;
const SLOW = 60_000;

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** [name, ...dates]: published dates, each of which the rule must give. */
type Table = [name: string, ...dates: string[]][];

function mismatches(entriesOf: (year: number) => Entry[], table: Table): string[] {
  const out: string[] = [];
  for (const [name, ...dates] of table) {
    for (const date of dates) {
      const got = entriesOf(Number(date.slice(0, 4)))
        .filter((entry) => entry.name === name)
        .map((entry) => entry.date);
      if (!got.includes(date)) out.push(`${name}: wanted ${date}, got ${got.join(" and ") || "nothing"}`);
    }
  }
  return out;
}

/** Every date a name has in a year, sorted. */
function datesOf(entriesOf: (year: number) => Entry[], name: string, year: number): string[] {
  return entriesOf(year)
    .filter((entry) => entry.name === name)
    .map((entry) => entry.date)
    .sort();
}

const thai = (year: number) => thaiEntries(year) as Entry[];
const lao = (year: number) => laoEntries(year) as Entry[];
const khmer = (year: number) => khmerEntries(year) as Entry[];
const myanmar = (year: number) => myanmarEntries(year) as Entry[];

// ---------------------------------------------------------------------------
// Published dates.

// Thailand: Bank of Thailand holiday lists for 2024 and 2027 (BoT notice
// 37/2569 for 2027), the 2026 list date-holidays carries, and Pattaya Mail
// for 2020. The library's own Asalha Bucha of 2020 and 2024 is a day early.
const THAI_PUBLISHED: Table = [
  ["Makha Bucha", "2024-02-24", "2026-03-03", "2027-02-21"],
  ["Vesak Day", "2024-05-22", "2026-05-31", "2027-05-20"],
  ["Asalha Puja", "2020-07-05", "2024-07-20", "2025-07-10", "2026-07-29", "2027-07-18"],
  ["Buddhist Lent", "2020-07-06", "2025-07-11", "2026-07-30"],
  ["Makha Bucha (substitute day)", "2024-02-26", "2027-02-22"],
  ["Vesak Day (substitute day)", "2026-06-01"],
  ["Asalha Puja (substitute day)", "2024-07-22", "2027-07-19"],
];

// Laos: Prime Minister's Office announcements for 2025 and 2026 (Vientiane
// Times); festival dates from the Lao tourism calendars (Mekong Tourism,
// Calendar Labs) for 2024 to 2026.
const LAO_PUBLISHED: Table = [
  ["International Women's Day (substitute day)", "2025-03-10", "2026-03-09"],
  ["Lao New Year", "2025-04-14", "2025-04-15", "2025-04-16", "2026-04-14", "2026-04-15", "2026-04-16"],
  ["Lao Women's Union Day (substitute day)", "2025-07-21"],
  ["Lao Women's Union Day", "2026-07-20"],
  ["National Day", "2025-12-02", "2026-12-02"],
  ["Boun Khao Padap Din", "2024-09-02"],
  ["Boun Khao Salak", "2024-09-17"],
  ["Boun Ok Phansa", "2025-10-07"],
  ["Vientiane Boat Racing Festival", "2025-10-08"],
  ["Boun That Luang", "2023-11-27", "2024-11-15", "2025-11-05", "2026-11-24"],
];

// Cambodia: sub-decree No. 230 for 2024, No. 167 for 2026 (as tabled by
// Andersen Cambodia) and the 2027 sub-decree of 16 September 2026
// (Cambodianess); Cambodge Mag for Khmer New Year 2025.
const KHMER_PUBLISHED: Table = [
  ["Khmer New Year", "2024-04-13", "2024-04-14", "2024-04-15", "2024-04-16"],
  ["Khmer New Year", "2025-04-14", "2025-04-16", "2026-04-14", "2026-04-15", "2026-04-16"],
  ["Khmer New Year", "2027-04-14", "2027-04-15", "2027-04-16"],
  ["Pchum Ben", "2024-10-01", "2024-10-02", "2024-10-03", "2026-10-10", "2026-10-11", "2026-10-12"],
  ["Pchum Ben", "2027-09-29", "2027-09-30", "2027-10-01"],
  ["Water Festival", "2024-11-14", "2024-11-15", "2024-11-16", "2026-11-23", "2026-11-24", "2026-11-25"],
  ["Water Festival", "2027-11-12", "2027-11-13", "2027-11-14"],
  ["Visak Bochea", "2026-05-01"],
  ["Royal Ploughing Ceremony", "2026-05-05"],
];

/** Cambodia's whole 2026 list, sub-decree No. 167 (21 holiday dates, 22 holidays). */
const KHMER_2026 = [
  "2026-01-01", "2026-01-07", "2026-03-08", "2026-04-14", "2026-04-15", "2026-04-16", "2026-05-01",
  "2026-05-05", "2026-05-14", "2026-06-18", "2026-09-24", "2026-10-10", "2026-10-11", "2026-10-12",
  "2026-10-15", "2026-10-29", "2026-11-09", "2026-11-23", "2026-11-24", "2026-11-25", "2026-12-29",
];

// Myanmar: the government's holiday notifications for 2024 to 2026, as listed
// by HolidayDB, Calendarific, hono.ai and the Yangon Stock Exchange.
const MYANMAR_PUBLISHED: Table = [
  ["Full Moon Day of Tabaung", "2024-03-24", "2025-03-13", "2026-03-02"],
  ["Full Moon Day of Kasong", "2025-05-11", "2026-04-30"],
  ["Full Moon Day of Waso", "2024-07-20", "2025-07-09", "2026-07-29"],
  ["Thadingyut", "2024-10-16", "2024-10-17", "2024-10-18", "2025-10-05", "2025-10-06", "2025-10-07"],
  ["Thadingyut", "2026-10-25", "2026-10-26", "2026-10-27"],
  ["Tazaungdaing", "2024-11-15", "2025-11-04", "2026-11-23", "2026-11-24"],
  ["National Day", "2024-11-25", "2025-11-14", "2026-12-04"],
  ["Kayin New Year", "2025-12-19"],
  ["Feast of the Sacrifice (Eid al-Adha)", "2025-06-07", "2026-05-28"],
  ["Deepavali", "2025-10-20", "2026-11-08"],
  ["Thingyan Water Festival", "2024-04-13", "2024-04-14", "2024-04-15", "2024-04-16"],
  ["Myanmar New Year", "2024-04-17", "2025-04-17", "2026-04-17"],
];

// ---------------------------------------------------------------------------

describe("Thai lunar calendar", () => {
  it("runs on without a gap from each lunar year into the next", () => {
    for (let year = 2000; year <= TO + 1; year++) {
      expect(thaiLunarDate(year, 5, 1)).toBe(addDays(thaiLunarDate(year, 4, 30), 1));
      expect(thaiLunarDate(year, 1, 1)).toBe(addDays(thaiLunarDate(year - 1, 12, 30), 1));
      const leap = thaiLeapMonthYear(year);
      expect(thaiLunarDate(year, 9, 1)).toBe(addDays(thaiLunarDate(year, leap ? 88 : 8, 30), 1));
      if (leap) expect(thaiLunarDate(year, 88, 1)).toBe(addDays(thaiLunarDate(year, 8, 30), 1));
    }
  });

  it("has a second 8th month only in adhikamasa years, and refuses dates that do not exist", () => {
    expect([2023, 2024, 2025, 2026, 2027].map(thaiLeapMonthYear)).toEqual([true, false, false, true, false]);
    expect(() => thaiLunarDate(2027, 88, 15)).toThrow();
    expect(() => thaiLunarDate(2027, 13, 1)).toThrow();
    expect(() => thaiLunarDate(2027, 6, 31)).toThrow();
    let leapYears = 0;
    for (let year = FROM; year <= TO; year++) if (thaiLeapMonthYear(year)) leapYears++;
    // Seven extra months in 19 years.
    expect(leapYears).toBeGreaterThanOrEqual(8);
    expect(leapYears).toBeLessThanOrEqual(10);
  });

  it("puts every full moon within a day of the astronomical one", () => {
    // Mean full moons from the 2026-01-03 10:03 UTC full moon.
    const synodic = 29.530588853;
    const base = Date.UTC(2026, 0, 3, 10, 3);
    for (let year = FROM; year <= TO; year++) {
      for (const day of thaiBuddhistDays(year)) {
        if (day.name === "Buddhist Lent") continue;
        // Noon in Bangkok.
        const ms = Date.parse(`${day.date}T05:00:00Z`);
        const lunations = Math.round((ms - base) / 86_400_000 / synodic);
        const mean = base + lunations * synodic * 86_400_000;
        // The mean moon wanders up to about 14 hours from the true one.
        expect(Math.abs(ms - mean) / 3_600_000).toBeLessThan(48);
      }
    }
  });
});

describe("Thailand", () => {
  it("matches the published Buddhist holidays and their substitute days", () => {
    expect(mismatches(thai, THAI_PUBLISHED)).toEqual([]);
  });

  it("agrees with date-holidays' hard-coded dates where they are right", () => {
    // date-holidays' TH.yaml (from timeanddate.com) for 2011 to 2026. The
    // years left out are where it and the computation differ: 2014 to 2016
    // (the government's calendar put that cycle's extra day elsewhere, so the
    // official dates were a day earlier, as Loy Krathong's were), 2020 and
    // 2024 (the library is a day early: Pattaya Mail and the Bank of
    // Thailand), Asalha Bucha 2023 (the library has 31 July; unconfirmed) and
    // Makha Bucha 2025 (the library has 13 February; unconfirmed).
    const library: Table = [
      ["Makha Bucha", "2011-02-18", "2012-03-07", "2013-02-25", "2014-02-14", "2017-02-11", "2018-03-01",
        "2019-02-19", "2020-02-08", "2021-02-26", "2022-02-16", "2023-03-06", "2024-02-24", "2026-03-03"],
      ["Asalha Puja", "2011-07-15", "2012-08-02", "2013-07-22", "2016-07-19", "2017-07-08", "2018-07-27",
        "2019-07-16", "2021-07-24", "2022-07-13", "2025-07-10", "2026-07-29"],
    ];
    const days = (year: number) => thaiBuddhistDays(year).map((day: { date: string; name: string }) => ({ ...day, kind: "public", note: "" }));
    expect(mismatches(days, library)).toEqual([]);
  });

  it("generates the four Buddhist days every year, public, without doubling the library's 2026", () => {
    for (let year = FROM; year <= TO; year++) {
      const days = thai(year).filter((entry) => !entry.name.includes("substitute"));
      expect(days.map((entry) => entry.name)).toEqual(["Makha Bucha", "Vesak Day", "Asalha Puja", "Buddhist Lent"]);
      for (const entry of days) {
        expect(entry.kind).toBe("public");
        expect(entry.note).toContain("The Cabinet confirms the date each year.");
        expect(entry.note.endsWith("Lunar date, estimated: the official date can differ by a day.")).toBe(year > 2027);
      }
    }
  });

  it("gives a weekday off for a weekend holiday, but none for Buddhist Lent", () => {
    for (let year = FROM; year <= TO; year++) {
      const entries = thai(year);
      for (const holiday of entries.filter((entry) => !entry.name.includes("substitute"))) {
        const substitute = entries.find((entry) => entry.name === `${holiday.name} (substitute day)`);
        const weekend = weekday(holiday.date) === 0 || weekday(holiday.date) === 6;
        expect(substitute !== undefined).toBe(weekend && holiday.name !== "Buddhist Lent");
        if (substitute) {
          expect([1, 2, 3, 4, 5]).toContain(weekday(substitute.date));
          expect(substitute.date > holiday.date).toBe(true);
        }
      }
    }
  });
});

describe("Thailand's substitute days for its fixed holidays", () => {
  const subs = (year: number) => thai(year).filter((entry) => entry.name.endsWith("(substitute day)"));

  it("makes up the library's fixed holidays on the next working day", () => {
    const all = [2026, 2027, 2028, 2029].flatMap((year) => subs(year).map((entry) => `${entry.date} ${entry.name}`));
    // The embassies' 2026 lists: Monday 7 December for King Bhumibol's Birthday on Saturday 5 December.
    expect(all).toContain("2026-12-07 King Bhumibol Adulyadej's Birthday (substitute day)");
    expect(all).toContain("2027-10-25 King Chulalongkorn Day (substitute day)");
    expect(all).toContain("2027-12-06 King Bhumibol Adulyadej's Birthday (substitute day)");
    expect(all).toContain("2028-01-03 New Year's Day (substitute day)");
    // 31 December 2028 is a Sunday and 1 January a holiday, so Tuesday 2 January.
    expect(all).toContain("2029-01-02 New Year's Eve (substitute day)");
  });

  it("gives Songkran one substitute day, after the span, however many of its days fall on a weekend", () => {
    const songkran = (year: number) => subs(year).filter((entry) => entry.name === "Songkran Festival (substitute day)").map((entry) => entry.date);
    expect(songkran(2026)).toEqual([]);
    expect(songkran(2028)).toEqual(["2028-04-17"]);
    expect(songkran(2029)).toEqual(["2029-04-16"]);
    expect(songkran(2030)).toEqual(["2030-04-16"]);
  });

  it("puts every substitute on its own weekday", () => {
    for (let year = FROM; year <= TO; year++) {
      const dates = subs(year).map((entry) => entry.date);
      for (const date of dates) expect([1, 2, 3, 4, 5], date).toContain(weekday(date));
      // Asalha Bucha's substitute may share Buddhist Lent's day, but not another substitute's.
      expect(new Set(dates).size, `${year}`).toBe(dates.length);
    }
  });
});

describe("Laos", () => {
  it("matches the published holidays and festivals", () => {
    expect(mismatches(lao, LAO_PUBLISHED)).toEqual([]);
  });

  it("has the eight official holidays every year, and That Luang's five days", () => {
    for (let year = FROM; year <= TO; year++) {
      const entries = lao(year);
      const official = entries.filter((entry) => !entry.name.includes("substitute") && entry.kind !== "festival");
      expect(official).toHaveLength(8);
      expect(datesOf(lao, "Lao New Year", year)).toEqual([`${year}-04-14`, `${year}-04-15`, `${year}-04-16`]);
      const thatLuang = datesOf(lao, "Boun That Luang", year);
      expect(thatLuang).toHaveLength(5);
      expect(thatLuang[4]).toBe(thaiLunarDate(year, 12, 15));
      expect(entries.find((entry) => entry.name === "Lao Women's Union Day")?.kind).toBe("optional");
    }
  });
});

describe("Cambodia", () => {
  it("matches the published holidays", () => {
    expect(mismatches(khmer, KHMER_PUBLISHED)).toEqual([]);
  });

  it("gives exactly the 2026 sub-decree's days off", () => {
    const dates = [...new Set(khmer(2026).map((entry) => entry.date))].sort();
    expect(dates).toEqual(KHMER_2026);
  });

  it("keeps Visak Bochea in the 6th month even in an adhikamasa year, unlike Thailand", () => {
    expect(thaiLeapMonthYear(2026)).toBe(true);
    expect(datesOf(khmer, "Visak Bochea", 2026)).toEqual(["2026-05-01"]);
    expect(datesOf(thai, "Vesak Day", 2026)).toEqual(["2026-05-31"]);
  });

  it("has a Khmer New Year of three or four days in mid April every year", () => {
    for (let year = FROM; year <= TO; year++) {
      const days = khmerNewYear(year);
      expect(days.length === 3 || days.length === 4).toBe(true);
      expect(days[0] >= `${year}-04-13`).toBe(true);
      expect(days[days.length - 1] <= `${year}-04-17`).toBe(true);
    }
    // Four days in leap years, as in 2024.
    expect(khmerNewYear(2028)).toEqual(["2028-04-13", "2028-04-14", "2028-04-15", "2028-04-16"]);
  });
});

describe("Myanmar", () => {
  it("matches the published holidays", () => {
    expect(mismatches(myanmar, MYANMAR_PUBLISHED)).toEqual([]);
  }, SLOW);

  it("uses the Thingyan office holidays the government announced for 2026", () => {
    const days = datesOf(myanmar, "Thingyan Water Festival", 2026);
    expect(days).toEqual(["2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-18", "2026-04-19"]);
    expect(thingyan(2027)).toEqual({
      days: ["2027-04-13", "2027-04-14", "2027-04-15", "2027-04-16"],
      newYear: "2027-04-17",
    });
  }, SLOW);

  it("keeps a consistent calendar, with each lunar holiday once a year", () => {
    for (let year = FROM; year <= TO; year++) {
      for (let date = `${year}-01-01`; date <= `${year}-12-31`; date = addDays(date, 1)) {
        expect(myanmarDate(date).consistent).toBe(true);
      }
      const entries = myanmar(year);
      const count = (name: string) => entries.filter((entry) => entry.name === name).length;
      for (const name of ["Full Moon Day of Tabaung", "Full Moon Day of Kasong", "Full Moon Day of Waso", "National Day", "Myanmar New Year", "Deepavali"]) {
        expect(count(name)).toBe(1);
      }
      expect(count("Thadingyut")).toBe(3);
      expect(count("Tazaungdaing")).toBe(2);
      expect(count("Kayin New Year")).toBeLessThanOrEqual(2);
      expect(count("Feast of the Sacrifice (Eid al-Adha)")).toBeGreaterThanOrEqual(1);
    }
  }, SLOW);
});

describe("theravada supplement", () => {
  it("is a valid supplement, with a day off in every year in every country", () => {
    const checked = supplementEntries(supplements, "theravada.mjs", FROM, TO);
    expect(checked.map((supplement: { country: string }) => supplement.country)).toEqual(["TH", "LA", "KH", "MM"]);
    for (const supplement of checked as { country: string; source: string; entries: Entry[] }[]) {
      expect(supplement.source).toMatch(/https:\/\//);
      for (let year = FROM; year <= TO; year++) {
        expect(supplement.entries.some((entry) => entry.date.startsWith(`${year}-`) && entry.kind === "public")).toBe(true);
      }
    }
  }, SLOW);

  it("gives each year only its own days, each name once a day, every note a sentence", () => {
    for (const entriesOf of [thai, lao, khmer, myanmar]) {
      for (let year = FROM; year <= TO; year++) {
        const seen = new Set<string>();
        for (const entry of entriesOf(year)) {
          expect(entry.date.startsWith(`${year}-`)).toBe(true);
          const key = `${entry.date}|${entry.name}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          if (entry.note) {
            expect(entry.note).not.toMatch(/—/);
            expect(entry.note).toMatch(/(\.|a day)$/);
          }
        }
      }
    }
  }, SLOW);
});
