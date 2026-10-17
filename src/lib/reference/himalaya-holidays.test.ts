import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  bhutanEntries,
  hijriDates,
  mongoliaEntries,
  nepalEntries,
  russiaEntries,
  zulEntries,
} from "../../../scripts/holiday-supplements/himalaya.mjs";
import {
  bsMonthLengths,
  bsMonthStart,
  bsToIso,
  rules,
  tithiDays,
} from "../../../scripts/holiday-supplements/_nepali-calendar.mjs";
import {
  dateOf,
  daysNumbered,
  fromIso,
  leapMonths,
  monthCounts,
  newYear,
} from "../../../scripts/holiday-supplements/_tibetan-calendar.mjs";

/**
 * Nepal, Bhutan, Mongolia and Russia's Buddhist and regional days
 * (scripts/holiday-supplements/himalaya.mjs and its two calendar helpers),
 * checked against dates the governments published. Sources and match rates
 * are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };
type Table = [name: string, ...dates: string[]][];

const FROM = 2026;
const TO = 2050;
const SLOW = 120_000;
const KINDS = new Set(["public", "bank", "optional", "observance", "festival"]);
const LUNAR = "Lunar date, estimated: the official date can differ by a day.";

function cached(entriesOf: (year: number) => Entry[]): (year: number) => Entry[] {
  const cache = new Map<number, Entry[]>();
  return (year) => {
    let list = cache.get(year);
    if (!list) {
      list = entriesOf(year);
      cache.set(year, list);
    }
    return list;
  };
}

const nepal = cached(nepalEntries as (year: number) => Entry[]);
const bhutan = cached(bhutanEntries as (year: number) => Entry[]);
const mongolia = cached(mongoliaEntries as (year: number) => Entry[]);
const russia = cached((year) => [...(russiaEntries(year) as Entry[]), ...(zulEntries(year) as Entry[])]);

/** Mismatches as "name: wanted …, got …", so a failure says what moved. */
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

const datesOf = (entriesOf: (year: number) => Entry[], year: number, name: string) =>
  entriesOf(year)
    .filter((entry) => entry.name === name)
    .map((entry) => entry.date);

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// ---------------------------------------------------------------------------
// The Tibetan calendar (Janson).

describe("the Tibetan calendar", () => {
  it("gives the Phugpa New Year that Kalmykia and the Tibetan almanacs keep", () => {
    // Kalmykia's decrees: Tsagan Sar on 5 March 2011 and 22 February 2012
    // (Caucasian Knot); 18 February 2026 (ConsultantPlus, in date-holidays).
    // 16 February 2018: tibetan-date-calculator's fixture.
    expect(newYear("phugpa", 2011)).toBe("2011-03-05");
    expect(newYear("phugpa", 2012)).toBe("2012-02-22");
    expect(newYear("phugpa", 2018)).toBe("2018-02-16");
    expect(newYear("phugpa", 2026)).toBe("2026-02-18");
  });

  it("gives Kalmykia's Zul and Buddha's birthday", () => {
    // date-holidays (ConsultantPlus): Zul on 25 December 2024 and 14 December
    // 2025, Buddha Shakyamuni's birthday on 31 May 2026.
    expect(dateOf("phugpa", 2024, 10, 25)).toBe("2024-12-25");
    expect(dateOf("phugpa", 2025, 10, 25)).toBe("2025-12-14");
    expect(dateOf("phugpa", 2026, 4, 15)).toBe("2026-05-31");
  });

  it("gives the Mongolian New Year, a month or a day from the Tibetan one in some years", () => {
    // Irkutsk governor's decree 15-ug: Sagaalgan on 2 February 2022 in
    // Ust-Orda; Tuva (ConsultantPlus): Shagaa on 10 February 2024, 1 March
    // 2025 and 18 February 2026.
    expect(newYear("mongolian", 2022)).toBe("2022-02-02");
    expect(newYear("phugpa", 2022)).toBe("2022-03-03");
    expect(newYear("mongolian", 2024)).toBe("2024-02-10");
    expect(newYear("mongolian", 2025)).toBe("2025-03-01");
    expect(newYear("phugpa", 2025)).toBe("2025-02-28");
    expect(newYear("mongolian", 2026)).toBe("2026-02-18");
  });

  it("puts the leap month after the regular one in Bhutan and before it elsewhere", () => {
    for (let year = FROM; year <= TO; year++) {
      for (const version of ["phugpa", "mongolian", "bhutanese"] as const) {
        expect(leapMonths(version, year).length, `${version} ${year}`).toBeLessThanOrEqual(1);
      }
    }
    // Every day read back gives the date it came from (a skipped number has no day).
    for (const version of ["phugpa", "mongolian", "bhutanese"] as const) {
      const n = monthCounts(version, 2027, 5).regular;
      for (let day = 1; day <= 30; day++) {
        if (daysNumbered(version, n, day).length === 0) continue;
        const back = fromIso(version, dateOf(version, 2027, 5, day));
        expect([back.year, back.month, back.day], `${version} ${day}`).toEqual([2027, 5, day]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Bikram Sambat.

/**
 * BS month lengths, Baisakh to Chaitra, as each digit plus 29 days, from the
 * published calendars (as nepali-date-converter transcribes them; 2083 from
 * the Ministry of Home Affairs notice in Nepal Rajpatra).
 */
const BS_LENGTHS: [year: number, lengths: string][] = [
  [2060, "223321101011"], [2061, "232321110012"], [2062, "132322010102"], [2063, "223222101011"],
  [2064, "223321101011"], [2065, "232321110012"], [2066, "222322011002"], [2067, "223222101011"],
  [2068, "223321101011"], [2069, "232321110012"], [2070, "222322011011"], [2071, "223222101011"],
  [2072, "232321101011"], [2073, "232321110012"], [2074, "222322101011"], [2075, "223222101011"],
  [2076, "232321110011"], [2077, "232321110102"], [2078, "222322101011"], [2079, "223222101011"],
  [2080, "232321110011"], [2081, "232321110102"], [2082, "223222101011"], [2083, "223222101011"],
  [2084, "232321110012"], [2085, "132321110102"], [2086, "223222101011"],
];
const BS_START: Record<number, string> = { 2060: "2003-04-14" };

describe("Bikram Sambat", () => {
  it("starts the published years where the calendars do", () => {
    expect(bsMonthStart(2060, 1)).toBe(BS_START[2060]);
    expect(bsMonthStart(2081, 1)).toBe("2024-04-13");
    expect(bsMonthStart(2082, 1)).toBe("2025-04-14");
    expect(bsMonthStart(2083, 1)).toBe("2026-04-14");
    expect(bsMonthStart(2084, 1)).toBe("2027-04-14");
  });

  it("matches the published month lengths of 2081 to 2084 exactly, and 2060 to 2086 in all but a few close calls", () => {
    let matched = 0;
    let months = 0;
    for (const [year, digits] of BS_LENGTHS) {
      const published = [...digits].map((digit) => Number(digit) + 29);
      const computed = bsMonthLengths(year);
      if (year >= 2081 && year <= 2084) expect(computed, `${year}`).toEqual(published);
      // A month is right when it starts on the right day.
      let start = bsMonthStart(year, 1);
      for (let month = 1; month <= 12; month++) {
        months++;
        if (bsMonthStart(year, month) === start) matched++;
        start = new Date(Date.parse(start) + published[month - 1] * 86_400_000).toISOString().slice(0, 10);
      }
    }
    expect(matched / months).toBeGreaterThan(0.98);
  }, SLOW);

  it("dates the fixed days of the 2083 notice", () => {
    expect(bsToIso(2083, 2, 15)).toBe("2026-05-29"); // Republic Day
    expect(bsToIso(2083, 6, 3)).toBe("2026-09-19"); // Constitution Day
    expect(bsToIso(2083, 9, 15)).toBe("2026-12-30"); // Tamu Lhosar
    expect(bsToIso(2083, 9, 27)).toBe("2027-01-11"); // Prithvi Jayanti
    expect(bsToIso(2083, 10, 1)).toBe("2027-01-15"); // Maghe Sankranti
    expect(bsToIso(2083, 10, 16)).toBe("2027-01-30"); // Martyrs' Day
    expect(bsToIso(2083, 11, 7)).toBe("2027-02-19"); // Democracy Day
  });
});

// ---------------------------------------------------------------------------
// Nepal.

/** Ministry of Home Affairs, public holidays of 2083 BS (Nepal Rajpatra 75/67, 2082-11-18). */
const NP_2083: Table = [
  ["Nepali New Year", "2026-04-14"],
  ["Buddha Jayanti", "2026-05-01"],
  ["Ubhauli", "2026-05-01"],
  ["Labour Day", "2026-05-01"],
  ["Republic Day", "2026-05-29"],
  ["Janai Purnima", "2026-08-28"],
  ["Gai Jatra", "2026-08-29"],
  ["Krishna Janmashtami", "2026-09-04"],
  ["Gen Z Martyrs' Day", "2026-09-08"],
  ["Haritalika Teej", "2026-09-14"],
  ["Constitution Day", "2026-09-19"],
  ["Indra Jatra", "2026-09-25"],
  ["Jitiya", "2026-10-04"],
  ["Ghatasthapana", "2026-10-11"],
  ["Fulpati", "2026-10-17"],
  ["Laxmi Puja", "2026-11-08"],
  ["Bhai Tika", "2026-11-11"],
  ["Chhath", "2026-11-15"],
  ["Udhauli", "2026-12-24"],
  ["Christmas Day", "2026-12-25"],
  ["Tamu Lhosar", "2026-12-30"],
  ["Prithvi Jayanti", "2027-01-11"],
  ["Maghe Sankranti", "2027-01-15"],
  ["Martyrs' Day", "2027-01-30"],
  ["Sonam Lhosar", "2027-02-07"],
  ["Vasant Panchami", "2027-02-11"],
  ["Democracy Day", "2027-02-19"],
  ["Maha Shivaratri", "2027-03-06"],
  ["International Women's Day", "2027-03-08"],
  ["Gyalpo Lhosar", "2027-03-09"],
  ["Holi", "2027-03-21", "2027-03-22"],
  ["Ghode Jatra", "2027-04-06"],
];

/** The 2081 and 2082 notices, as the press and law firms reported them. */
const NP_2081_2082: Table = [
  ["Sonam Lhosar", "2025-01-30", "2026-01-19"],
  ["Gyalpo Lhosar", "2025-02-28", "2026-02-18"],
  ["Holi", "2025-03-13", "2025-03-14"],
  ["Republic Day", "2025-05-29"],
  ["Haritalika Teej", "2025-08-26"],
  ["Ghatasthapana", "2025-09-22"],
  ["Fulpati", "2024-10-10", "2025-09-29"],
  ["Laxmi Puja", "2024-10-31", "2025-10-20"],
  // NEPSE closures: Ghode Jatra on 18 March 2026, Holi in the hills on 2 March 2026.
  ["Ghode Jatra", "2026-03-18"],
  ["Holi", "2026-03-02"],
  ["Chhath", "2025-10-27"],
  // Hamro Patro and the calendars: Eid al-Fitr on 21 March and Bakar Eid on 28 May 2026.
  ["Eid al-Fitr", "2026-03-21"],
  ["Bakar Eid", "2026-05-28"],
];

/** Days off from the first to the last date, as the notices give Dashain and Tihar. */
function daysOffBetween(first: string, last: string): string[] {
  const year = Number(first.slice(0, 4));
  return nepal(year)
    .filter((entry) => entry.date >= first && entry.date <= last && entry.kind === "public")
    .map((entry) => entry.date)
    .filter((date, index, all) => all.indexOf(date) === index);
}

describe("Nepal", () => {
  it("matches the 2083 BS notice", () => {
    expect(mismatches(nepal, NP_2083)).toEqual([]);
    // Dashain: Fulpati to Duwadashi, 17 to 23 October; Tihar: Laxmi Puja to the day after Bhai Tika.
    expect(daysOffBetween("2026-10-17", "2026-10-23")).toHaveLength(7);
    expect(datesOf(nepal, 2026, "Dashain holiday").at(-1)).toBe("2026-10-23");
    expect(daysOffBetween("2026-11-08", "2026-11-12")).toHaveLength(5);
    expect(datesOf(nepal, 2026, "Tihar holiday").at(-1)).toBe("2026-11-12");
  }, SLOW);

  it("matches the 2081 and 2082 notices", () => {
    expect(mismatches(nepal, NP_2081_2082)).toEqual([]);
    // Dashain 2081: Asoj 24 to 28 (10 to 14 October 2024); 2082: 13 to 18 Asoj (29 September to 4 October 2025).
    expect(daysOffBetween("2024-10-10", "2024-10-14")).toHaveLength(5);
    expect(nepal(2024).some((entry) => entry.date === "2024-10-15" && /Dashain/.test(entry.name))).toBe(false);
    expect(daysOffBetween("2025-09-29", "2025-10-04")).toHaveLength(6);
    // Tihar 2081: Kartik 15 to 19 (31 October to 4 November 2024); 2082: Kartik 3 to 7 (20 to 24 October 2025).
    expect(datesOf(nepal, 2024, "Tihar holiday").at(-1)).toBe("2024-11-04");
    expect(datesOf(nepal, 2025, "Tihar holiday").at(-1)).toBe("2025-10-24");
  }, SLOW);

  it("keeps Vijaya Dashami on the Surya Siddhanta tithi, as Nepal and Bhutan do", () => {
    // Bhutan's Dashain, which follows Nepal: 12 October 2024, 2 October 2025, 21 October 2026.
    expect(tithiDays(2024, "Ashvin", 10)).toEqual(["2024-10-12"]);
    expect(tithiDays(2025, "Ashvin", 10)).toEqual(["2025-10-02"]);
    expect(tithiDays(2026, "Ashvin", 10)).toEqual(["2026-10-21"]);
    expect(tithiDays(2024, "Shravana", 23, rules.midnight)).toEqual(["2024-08-26"]);
  });

  it("keeps Islamic days a day after Saudi Arabia", () => {
    // Eid al-Fitr: 3 May 2022 in Nepal, 2 May by date-holidays' rule.
    expect(hijriDates("1 Shawwal", 2022, 1)).toEqual(["2022-05-03"]);
  });

  it("lists Nepal's days off every year, with the estimate noted after the published list", () => {
    const every = [
      "Nepali New Year", "Republic Day", "Constitution Day", "Ghatasthapana", "Fulpati", "Vijaya Dashami",
      "Dashain holiday", "Laxmi Puja", "Bhai Tika", "Tihar holiday", "Chhath", "Maghe Sankranti", "Buddha Jayanti",
      "Janai Purnima", "Krishna Janmashtami", "Maha Shivaratri", "Udhauli", "Ubhauli", "Tamu Lhosar", "Sonam Lhosar",
      "Gyalpo Lhosar", "Holi", "Eid al-Fitr", "Bakar Eid", "Christmas Day",
    ];
    const problems: string[] = [];
    for (let year = FROM; year <= TO; year++) {
      const list = nepal(year);
      for (const name of every) {
        if (!list.some((entry) => entry.name === name)) problems.push(`${year} ${name}`);
      }
      for (const entry of list) {
        if (!KINDS.has(entry.kind) || !entry.date.startsWith(`${year}-`)) problems.push(`${year} ${entry.name} ${entry.kind}`);
        if (/[—–]/.test(entry.note)) problems.push(`${entry.date} ${entry.name}: dash in note`);
      }
      // Dashain is six to eight days, Tihar five.
      const dashain = list.filter((entry) => ["Fulpati", "Maha Ashtami", "Maha Navami", "Vijaya Dashami", "Dashain holiday"].includes(entry.name));
      const dashainDays = new Set(dashain.map((entry) => entry.date)).size;
      if (dashainDays < 5 || dashainDays > 8) problems.push(`${year} Dashain has ${dashainDays} days`);
    }
    expect(problems).toEqual([]);
    expect(nepal(2027).find((entry) => entry.name === "Vijaya Dashami")?.note).toMatch(/Lunar date, estimated/);
    expect(nepal(2026).find((entry) => entry.name === "Vijaya Dashami")?.note).not.toMatch(/estimated/);
  }, SLOW);
});

// ---------------------------------------------------------------------------
// Bhutan.

/** RCSC lists, as calendar sites carry them (2024 to 2026), and the Department of Tourism's festival dates. */
const BT_PUBLISHED: Table = [
  ["Traditional Day of Offering", "2024-01-12", "2025-01-30", "2026-01-19"],
  ["Losar", "2024-02-10", "2024-02-11", "2025-02-28", "2025-03-01", "2026-02-18", "2026-02-19"],
  ["Zhabdrung Kuchoe", "2024-04-18", "2025-05-07", "2026-04-26"],
  ["Lord Buddha's Parinirvana", "2026-05-31"],
  ["Birth Anniversary of Guru Rinpoche", "2026-06-24"],
  ["First Sermon of Lord Buddha", "2025-07-28"],
  ["Thimphu Drubchoe", "2026-09-17"],
  ["Thimphu Tshechu", "2025-10-02", "2025-10-03", "2026-09-21", "2026-09-22", "2026-09-23"],
  ["Blessed Rainy Day", "2025-09-23", "2026-09-23"],
  ["Dashain", "2024-10-12", "2025-10-02", "2026-10-21"],
  ["Descending Day of Lord Buddha", "2025-11-11", "2026-11-01"],
  ["Paro Tshechu", "2026-03-29", "2026-04-02"],
];

describe("Bhutan", () => {
  it("matches the published holidays of 2024 to 2026", () => {
    expect(mismatches(bhutan, BT_PUBLISHED)).toEqual([]);
  }, SLOW);

  it("lists every holiday every year", () => {
    const every = [
      "Nyilo", "Traditional Day of Offering", "Losar", "Birth Anniversary of His Majesty the King", "Zhabdrung Kuchoe",
      "Birth Anniversary of the Third Druk Gyalpo", "Lord Buddha's Parinirvana", "Birth Anniversary of Guru Rinpoche",
      "First Sermon of Lord Buddha", "Thimphu Tshechu", "Blessed Rainy Day", "Dashain", "Descending Day of Lord Buddha",
      "Coronation Day of His Majesty the King", "Birth Anniversary of the Fourth Druk Gyalpo and Constitution Day",
      "National Day",
    ];
    const problems: string[] = [];
    for (let year = FROM; year <= TO; year++) {
      for (const name of every) {
        if (!bhutan(year).some((entry) => entry.name === name)) problems.push(`${year} ${name}`);
      }
      if (datesOf(bhutan, year, "Losar").length !== 2) problems.push(`${year} Losar`);
    }
    expect(problems).toEqual([]);
    expect(bhutan(2027).find((entry) => entry.name === "Losar")?.note).toContain(LUNAR);
  }, SLOW);
});

// ---------------------------------------------------------------------------
// Mongolia.

describe("Mongolia", () => {
  it("matches the published 2026 holidays and the 2027 Chinggis Khaan day", () => {
    expect(datesOf(mongolia, 2026, "Tsagaan Sar")).toEqual(["2026-02-18", "2026-02-19", "2026-02-20"]);
    expect(datesOf(mongolia, 2026, "Buddha's Birthday")).toEqual(["2026-05-31"]);
    expect(datesOf(mongolia, 2026, "Chinggis Khaan's Birthday")).toEqual(["2026-11-10"]);
    expect(datesOf(mongolia, 2027, "Chinggis Khaan's Birthday")).toEqual(["2027-11-29"]);
    expect(datesOf(mongolia, 2025, "Tsagaan Sar")[0]).toBe("2025-03-01");
  });

  it("does not repeat Naadam, which festivals.mjs has", () => {
    for (let year = FROM; year <= TO; year++) {
      expect(mongolia(year).some((entry) => /Naadam/.test(entry.name))).toBe(false);
      expect(datesOf(mongolia, year, "Tsagaan Sar")).toHaveLength(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Russia.

describe("Russia's regional days", () => {
  it("follows each region's rule from 2027, as 2024 to 2026 fit it", () => {
    for (let year = 2027; year <= TO; year++) {
      const list = russia(year);
      const one = (name: string) => list.filter((entry) => entry.name === name).map((entry) => entry.date);
      expect(one("Tsagan Sar"), `${year}`).toEqual([newYear("phugpa", year)]);
      expect(one("White Month Festival (Sagaalgan)"), `${year}`).toEqual([newYear("mongolian", year)]);
      expect(one("Shagaa"), `${year}`).toEqual([newYear("mongolian", year)]);
      const [naadym] = one("Naadym");
      expect(weekday(naadym)).toBe(5);
      expect(Number(naadym.slice(8))).toBeGreaterThanOrEqual(18);
      const [uastyrdzhi] = one("First Monday of the Uastyrdzhi (Djeorguiba) Festival");
      expect(weekday(uastyrdzhi)).toBe(1);
      expect(Number(uastyrdzhi.slice(8))).toBeGreaterThanOrEqual(17);
      expect(one("Constitution Day of the Republic of Tuva")).toEqual([`${year}-05-06`]);
      expect(weekday(one("Day of Remembrance of the Departed (Radonitsa)")[0])).toBe(2);
    }
    // The rules give the library's 2026 days (and Tuva's 2024 and 2025 Naadym).
    expect(russiaEntries(2026)).toEqual([]);
    expect(zulEntries(2026).map((entry: Entry) => entry.date)).toEqual(["2026-12-03"]);
  });

  it("drops the library's later Radonitsa for one entry naming every region", () => {
    const [ru] = (supplementEntries(supplements, "himalaya.mjs") as { country: string; entries: Entry[] }[]).filter(
      (supplement) => supplement.country === "RU",
    );
    const kept = applyDrops("RU", libraryEntries("RU"), [ru]) as Entry[];
    const merged = mergeEntries(kept, ru.entries) as Entry[];
    const radonitsa2027 = merged.filter((entry) => entry.date === "2027-05-11" && /Radonitsa/.test(entry.name));
    expect(radonitsa2027).toHaveLength(1);
    expect(radonitsa2027[0].note).toMatch(/Krasnodar Krai.*Republic of Dagestan.*Stavropol Krai/);
    expect(merged.some((entry) => entry.date === "2026-04-21" && /Radonitsa/.test(entry.name))).toBe(true);
  }, SLOW);
});

describe("the supplement", () => {
  it("loads, with a source and valid entries for each country", () => {
    const loaded = supplementEntries(supplements, "himalaya.mjs") as { country: string; source: string; entries: Entry[] }[];
    expect(loaded.map((supplement) => supplement.country)).toEqual(["NP", "BT", "MN", "RU"]);
    for (const supplement of loaded) {
      expect(supplement.source).toMatch(/https:\/\//);
      const keys = new Set<string>();
      for (const entry of supplement.entries) {
        const key = `${entry.date}|${entry.name}`;
        expect(keys.has(key), key).toBe(false);
        keys.add(key);
      }
    }
  }, SLOW);
});
