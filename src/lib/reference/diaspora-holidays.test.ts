import Holidays from "date-holidays";
import { describe, expect, it } from "vitest";
import { supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  NYEPI_PUBLISHED,
  PLACES,
  bali,
  chineseVesak,
  fullMoonDayNear,
  indiaDate,
  localDiwali,
  malaysianWesak,
  mauritiusDate,
  nearestMidMay,
  nyepi,
  phagwah,
  tamilDeepavali,
  thaipusam,
  waisak,
} from "../../../scripts/holiday-supplements/hindu-buddhist-diaspora.mjs";

/**
 * Hindu and Buddhist holidays in South-East Asia, the Caribbean, Fiji and
 * Mauritius (scripts/holiday-supplements/hindu-buddhist-diaspora.mjs),
 * checked against dates governments published. Sources and match rates are
 * in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };

const FROM = 2026;
const TO = 2050;
const SLOW = 120_000;
const LUNAR = "Lunar date, estimated: the official date can differ by a day.";

const yearOf = (iso: string) => Number(iso.slice(0, 4));

function weekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The dates a rule gets wrong among published ones, as "wanted X, got Y". */
function misses(rule: (year: number) => string | undefined, published: string[]): string[] {
  return published.flatMap((date) => {
    const got = rule(yearOf(date));
    return got === date ? [] : [`wanted ${date}, got ${got}`];
  });
}

/**
 * Dates of a Chinese lunar day by date-holidays' own rule ("chinese 04-0-15"),
 * for years before lunisolarDate's range (it starts in 2023).
 */
const ruleCalendars = new Map<string, Holidays>();
function libraryChinese(rule: string, year: number): string[] {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    calendar.setHoliday(rule, { name: { en: rule }, type: "observance" });
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}
const libraryChinese415 = (year: number) => libraryChinese("chinese 04-0-15", year)[0];
const libraryFifteenths = (year: number) =>
  ["chinese 02-1-15", "chinese 03-0-15", "chinese 03-1-15", "chinese 04-0-15", "chinese 04-1-15"].flatMap((rule) =>
    libraryChinese(rule, year),
  );

// ---------------------------------------------------------------------------
// Published dates.

// Singapore, Ministry of Manpower lists (as date-holidays carries them, 2001
// to 2026; the 2027 list of 18 June 2026). A Vesak on a Sunday (2002, 2005)
// is listed by its Monday off; these are the Sundays themselves.
const SG_VESAK = [
  "2001-05-07", "2002-05-26", "2003-05-15", "2004-06-02", "2005-05-22", "2006-05-12", "2007-05-31",
  "2008-05-19", "2009-05-09", "2010-05-28", "2011-05-17", "2012-05-05", "2013-05-24", "2014-05-13",
  "2015-06-01", "2016-05-21", "2017-05-10", "2018-05-29", "2019-05-19", "2020-05-07", "2021-05-26",
  "2022-05-15", "2023-06-02", "2024-05-22", "2025-05-12", "2026-05-31", "2027-05-20",
];

// Singapore's Deepavali, the same lists. 2002, 2003 and 2013 differ from the
// Tamil-almanac rule (see below).
const SG_DEEPAVALI = [
  "2000-10-26", "2001-11-14", "2004-11-11", "2005-11-01", "2006-10-21", "2007-11-08", "2008-10-27",
  "2009-10-17", "2010-11-05", "2011-10-26", "2012-11-13", "2014-10-22", "2015-11-10", "2016-10-29",
  "2017-10-18", "2018-11-06", "2019-10-27", "2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12",
  "2024-10-31", "2025-10-20", "2026-11-08", "2027-10-28",
];
const SG_DEEPAVALI_MISSES: [published: string, computed: string][] = [
  ["2002-11-03", "2002-11-04"],
  ["2003-10-23", "2003-10-24"],
  ["2013-11-03", "2013-11-02"],
];

// Malaysia: the federal lists for 2016 to 2026 (date-holidays), and 2027
// (OfficeHolidays, Thaipusam on Friday 22 January).
const MY_DEEPAVALI = [
  "2016-10-29", "2017-10-18", "2018-11-06", "2019-10-27", "2020-11-14", "2021-11-04", "2022-10-24",
  "2023-11-12", "2024-10-31", "2025-10-20", "2026-11-08", "2027-10-28",
];
const MY_THAIPUSAM = [
  "2016-01-24", "2018-01-31", "2019-01-21", "2020-02-08", "2021-01-28", "2022-01-18", "2023-02-05",
  "2024-01-25", "2025-02-11", "2026-02-01", "2027-01-22",
];
// Wesak: the federal lists, the Ministry of Human Resources statement for
// 2026 (Sunday 31 May, with Tuesday 2 June off), Calendarific and Time.sg for
// 2015 (Sunday 3 May). 2015 and 2023 are a month before Singapore's.
const MY_WESAK = ["2023-05-04", "2024-05-22", "2025-05-12", "2026-05-31", "2027-05-20"];
const MY_WESAK_BEFORE_2023 = ["2015-05-03", "2018-05-29", "2019-05-19", "2020-05-07", "2021-05-26", "2022-05-15"];

// Indonesia: Waisak from date-holidays' list (2001 to 2027), whose 2023 date
// (6 May) the computed full moon puts on 4 June; the 2026 SKB (Sunday 31 May).
const ID_WAISAK = ["2024-05-23", "2025-05-12", "2026-05-31", "2027-05-20"];
const ID_WAISAK_LIBRARY = [
  "2001-05-07", "2002-05-26", "2003-05-16", "2004-06-03", "2005-05-24", "2006-05-13", "2007-06-01",
  "2008-05-20", "2009-05-09", "2010-05-28", "2011-05-17", "2012-05-06", "2013-05-25", "2014-05-15",
  "2015-06-02", "2016-05-22", "2017-05-11", "2018-05-29", "2019-05-19", "2020-05-07", "2021-05-26",
  "2022-05-16",
];

// Trinidad and Tobago: Divali by the government's notices (date-holidays'
// list, 2012 to 2026; Legal Notice No. 340 of 2025 for 20 October 2025).
// 2016 was kept on 29 October, a day before India.
const TT_DIVALI = [
  "2012-11-13", "2013-11-03", "2014-10-23", "2015-11-11", "2017-10-19", "2018-11-07", "2019-10-27",
  "2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12", "2024-10-31", "2025-10-20", "2026-11-08",
];
// Suriname (date-holidays' list, 2014 to 2026) and Guyana (2015 to 2024; 2017
// was kept on 18 October, a day before India).
const SR_DEEPAVALI = [
  "2014-10-23", "2015-11-11", "2016-10-30", "2017-10-19", "2018-11-07", "2019-10-27", "2020-11-14",
  "2021-11-04", "2022-10-24", "2023-11-12", "2024-10-31", "2025-10-20", "2026-11-08",
];
const GY_DEEPAVALI = [
  "2015-11-11", "2018-11-07", "2019-10-27", "2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12", "2024-10-31",
];
// Phagwah: Suriname 2016 to 2028 (date-holidays; 2026 and 2027 also
// OfficeHolidays and HolidayDB), Guyana 2015 to 2024. Guyana's 2021 Phagwah
// fell on Sunday 28 March and was listed by its Monday off; 2020 was kept on
// 10 March, with India, where Suriname kept 9 March. Suriname's list has 6
// March 2015 (5 March here, as in Guyana).
const SR_PHAGWAH = [
  "2016-03-23", "2017-03-12", "2018-03-02", "2019-03-21", "2020-03-09", "2021-03-28", "2022-03-18",
  "2023-03-07", "2024-03-25", "2025-03-14", "2026-03-03", "2027-03-22", "2028-03-11",
];
const GY_PHAGWAH = [
  "2015-03-05", "2016-03-23", "2017-03-12", "2018-03-02", "2019-03-21", "2021-03-28", "2022-03-18",
  "2023-03-07", "2024-03-25",
];

// Fiji: timeanddate for 2024 (Friday 1 November), the Fiji Government's 2025
// list (Tuesday 21 October; the Sanatan Dharam Pratinidhi Sabha's Amavasya)
// and the Cabinet's 2026 list (Monday 9 November for Sunday 8 November).
const FJ_DIWALI = ["2017-10-19", "2018-11-07", "2019-10-27", "2021-11-04", "2024-11-01", "2025-10-21", "2026-11-08"];

// Mauritius: Prime Minister's Office notices for 2025 and 2026 (2026's Ganesh
// Chaturthi moved to 15 September by Government Notice No. 611), with
// Calendarific and Maurinet for 2024.
const MU_PUBLISHED: [name: string, ...dates: string[]][] = [
  ["Thaipoosam Cavadee", "2024-01-25", "2025-02-11", "2026-02-01"],
  ["Maha Shivaratree", "2024-03-08", "2025-02-26", "2026-02-15"],
  ["Ugadi", "2025-03-30", "2026-03-19"],
  ["Ganesh Chaturthi", "2024-09-08", "2025-08-28", "2026-09-15"],
  ["Divali", "2025-10-20", "2026-11-08"],
];

// ---------------------------------------------------------------------------

describe("Vesak", () => {
  it("is the 15th of the 4th Chinese month in Singapore, every year since 2001", () => {
    const rule = (year: number) => (year >= 2023 ? chineseVesak(year) : libraryChinese415(year));
    expect(misses(rule, SG_VESAK)).toEqual([]);
  });

  it("is the Chinese 15th nearest mid-May in Malaysia", () => {
    expect(misses(malaysianWesak, MY_WESAK)).toEqual([]);
    // Before 2023, the same rule on date-holidays' Chinese months.
    expect(misses((year) => nearestMidMay(year, libraryFifteenths(year)), MY_WESAK_BEFORE_2023)).toEqual([]);
  });

  it("differs between Malaysia and Singapore only when the 4th month starts late", () => {
    const differ = [];
    for (let year = FROM; year <= TO; year++) if (malaysianWesak(year) !== chineseVesak(year)) differ.push(year);
    expect(differ).toEqual([2031, 2034, 2042, 2050]);
  });

  it(
    "is the day of the full moon nearest the Chinese 15th in Indonesia",
    () => {
      expect(misses((year) => waisak(year).date, ID_WAISAK)).toEqual([]);
      // date-holidays' older list, with the Chinese 15th from its own rule.
      expect(misses((year) => fullMoonDayNear(libraryChinese415(year)).date, ID_WAISAK_LIBRARY)).toEqual([]);
      // The library's 2023 date is 6 May; the full moon of the 4th month was 4 June.
      expect(waisak(2023).date).toBe("2023-06-04");
    },
    SLOW,
  );
});

describe("Nyepi", () => {
  it("is the day after Tilem Kesanga on the Balinese count, 2009 to 2027", () => {
    for (const [year, monthDay] of Object.entries(NYEPI_PUBLISHED)) {
      expect(nyepi(Number(year))).toBe(`${year}-${monthDay}`);
    }
    // The 2027 decree (SKB of 15 September 2026) settles 8 March, not 9.
    expect(nyepi(2027)).toBe("2027-03-08");
  });

  it("puts a ngunaratri on Anggara Paing Sungsang, as the Eka Sungsang ke Paing rule says", () => {
    // Galungan, Wednesday Kliwon of Dungulan, was 17 June 2026; Tuesday Paing of
    // Sungsang is eight days before it.
    expect(bali.isNgunaratri("2026-06-09")).toBe(true);
    expect(bali.isNgunaratri("2026-06-10")).toBe(false);
  });

  it("falls between 3 March and 1 April every year", () => {
    for (let year = FROM; year <= TO; year++) {
      const date = nyepi(year);
      expect(date >= `${year}-03-03` && date <= `${year}-04-01`).toBe(true);
      expect(bali.isTilem(new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10))).toBe(true);
    }
  });
});

describe("Deepavali and Thaipusam by the Tamil almanac", () => {
  it(
    "matches Singapore's and Malaysia's lists",
    () => {
      expect(misses((year) => tamilDeepavali(year, PLACES.SINGAPORE), SG_DEEPAVALI)).toEqual([]);
      expect(misses((year) => tamilDeepavali(year, PLACES.KUALA_LUMPUR), MY_DEEPAVALI)).toEqual([]);
      for (const [published, computed] of SG_DEEPAVALI_MISSES) {
        expect(tamilDeepavali(yearOf(published), PLACES.SINGAPORE)).toBe(computed);
      }
    },
    SLOW,
  );

  it("keeps 2028's Deepavali on 17 October, the first day of Aippasi, as in 2009", () => {
    expect(tamilDeepavali(2009, PLACES.SINGAPORE)).toBe("2009-10-17");
    expect(tamilDeepavali(2028, PLACES.SINGAPORE)).toBe("2028-10-17");
  });

  it("matches Malaysia's Thaipusam", () => {
    expect(misses((year) => thaipusam(year, PLACES.KUALA_LUMPUR).date, MY_THAIPUSAM)).toEqual([]);
  });
});

describe("Diwali and Phagwah in the Caribbean and Fiji", () => {
  it(
    "keeps India's Diwali in Trinidad and Tobago, Suriname and Guyana",
    () => {
      const india = (year: number) => indiaDate("Diwali", year);
      expect(misses(india, TT_DIVALI)).toEqual([]);
      expect(misses(india, SR_DEEPAVALI)).toEqual([]);
      expect(misses(india, GY_DEEPAVALI)).toEqual([]);
      // The two years kept by the local evening instead.
      expect(localDiwali(2016, PLACES.PORT_OF_SPAIN)).toBe("2016-10-29");
      expect(localDiwali(2017, PLACES.GEORGETOWN)).toBe("2017-10-18");
    },
    SLOW,
  );

  it(
    "keeps Phagwah the day after the Holika bonfire, by local evenings",
    () => {
      expect(misses((year) => phagwah(year, PLACES.PARAMARIBO), SR_PHAGWAH)).toEqual([]);
      expect(misses((year) => phagwah(year, PLACES.GEORGETOWN), GY_PHAGWAH)).toEqual([]);
      expect(phagwah(2020, PLACES.GEORGETOWN)).toBe("2020-03-09");
      expect(indiaDate("Holi", 2020)).toBe("2020-03-10");
    },
    SLOW,
  );

  it("keeps Diwali by Fiji's own evenings", () => {
    expect(misses((year) => localDiwali(year, PLACES.SUVA), FJ_DIWALI)).toEqual([]);
  });
});

describe("Mauritius", () => {
  it(
    "matches the Prime Minister's Office lists",
    () => {
      const out: string[] = [];
      for (const [name, ...dates] of MU_PUBLISHED) {
        for (const date of dates) {
          const got = mauritiusDate(name, yearOf(date));
          if (got !== date) out.push(`${name}: wanted ${date}, got ${got}`);
        }
      }
      expect(out).toEqual([]);
    },
    SLOW,
  );
});

// ---------------------------------------------------------------------------
// The supplement as the generator reads it.

describe("the supplement", () => {
  const checked = supplementEntries(supplements, "hindu-buddhist-diaspora.mjs", FROM, TO);
  const byCountry = new Map(checked.map((supplement) => [supplement.country, supplement.entries as Entry[]]));

  /** [country, name, first year generated]. */
  const YEARLY: [string, string, number][] = [
    ["SG", "Vesak Day", 2027],
    ["SG", "Deepavali", 2028],
    ["MY", "Vesak Day", 2027],
    ["MY", "Deepavali", 2028],
    ["MY", "Thaipusam", 2027],
    ["ID", "Nyepi", 2028],
    ["ID", "Vesak Day", 2028],
    ["SR", "Holi Phagwa", 2027],
    ["SR", "Deepavali", 2027],
    ["TT", "Deepavali", 2027],
    ["GY", "Phagwah", 2026],
    ["GY", "Deepavali", 2026],
    ["FJ", "Diwali", 2026],
    ["MU", "Thaipoosam Cavadee", 2027],
    ["MU", "Maha Shivaratree", 2027],
    ["MU", "Ugadi", 2027],
    ["MU", "Ganesh Chaturthi", 2026],
    ["MU", "Divali", 2027],
  ];

  it("gives each holiday once a year, from its first year to 2050", () => {
    for (const [country, name, first] of YEARLY) {
      const years = (byCountry.get(country) ?? []).filter((entry) => entry.name === name).map((entry) => yearOf(entry.date));
      const expected = Array.from({ length: TO - first + 1 }, (_, i) => first + i);
      expect([country, name, years]).toEqual([country, name, expected]);
    }
  });

  it("ends every computed date's note with the estimate warning", () => {
    for (const [country, entries] of byCountry) {
      for (const entry of entries) {
        if (entry.name.endsWith("(substitute day)")) continue;
        if (country === "MU" && entry.date === "2026-09-15") continue;
        expect([country, entry.name, entry.date, entry.note.endsWith(LUNAR)]).toEqual([country, entry.name, entry.date, true]);
      }
    }
  });

  it("writes notes in plain sentences", () => {
    for (const entries of byCountry.values()) {
      for (const entry of entries) {
        expect(entry.note).not.toMatch(/[—–]/);
        expect(entry.note).toMatch(/\.$/);
      }
    }
  });

  it("gives Sunday holidays their Monday, as Singapore, Malaysia, Trinidad and Tobago and Guyana do", () => {
    const sg = byCountry.get("SG") ?? [];
    expect(sg.find((entry) => entry.name === "Vesak Day" && entry.date === "2029-05-27")).toBeTruthy();
    expect(sg.find((entry) => entry.name === "Vesak Day (substitute day)")?.date).toBe("2029-05-28");
    const my = byCountry.get("MY") ?? [];
    // 2026: Wesak on Sunday 31 May, the King's birthday on Monday 1 June.
    expect(my.find((entry) => entry.name === "Vesak Day (substitute day)" && entry.date.startsWith("2026"))?.date).toBe("2026-06-02");
    for (const entries of byCountry.values()) {
      for (const entry of entries.filter((e) => e.name.endsWith("(substitute day)"))) {
        expect([1, 2]).toContain(weekday(entry.date));
      }
    }
  });

  it("moves Fiji's weekend Diwali to the Monday, as the Cabinet's 2026 list does", () => {
    const fj = byCountry.get("FJ") ?? [];
    expect(fj.filter((entry) => entry.date.startsWith("2026")).map((entry) => [entry.date, entry.kind, entry.name])).toEqual([
      ["2026-11-08", "festival", "Diwali"],
      ["2026-11-09", "public", "Diwali (substitute day)"],
    ]);
  });

  it("drops only library years it replaces", () => {
    const drops = checked.flatMap((supplement) => supplement.drop.map((rule) => `${supplement.country} ${rule.text}`));
    expect(drops).toEqual([
      'SG { name: "Deepavali", from: 2028, to: 2030 }',
      'MY { name: "Deepavali", from: 2028, to: 2030 }',
      'SR { name: "Holi Phagwa", from: 2027, to: 2030 }',
      'SR { name: "Deepavali", from: 2027, to: 2030 }',
      'TT { name: "Deepavali", from: 2027, to: 2030 }',
      'MU { name: "Thaipoosam Cavadee", from: 2027 }',
      'MU { name: "Maha Shivaratree", from: 2027 }',
      'MU { name: "Ugadi", from: 2027 }',
      'MU { name: "Ganesh Chaturthi", from: 2026 }',
      'MU { name: "Divali", from: 2027 }',
    ]);
  });
});
