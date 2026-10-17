import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import { indiaEntries } from "../../../scripts/holiday-supplements/india.mjs";
import supplements, {
  bangladeshEntries,
  hijriDates,
  indiaFixes,
  maldivesEntries,
  poilaBaishakh,
  poyaDays,
  sinhalaNewYear,
  sriLankaEntries,
  thaiPongal,
  vishu,
} from "../../../scripts/holiday-supplements/south-asia.mjs";

/**
 * Sri Lanka, Bangladesh, the Maldives and three Indian state days
 * (scripts/holiday-supplements/south-asia.mjs), checked against dates the
 * governments, central banks and the press published. Sources and match
 * rates are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };
type Table = [name: string, ...dates: string[]][];

const FROM = 2026;
const TO = 2050;
const SLOW = 120_000;
const KINDS = new Set(["public", "bank", "optional", "observance", "festival"]);
const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";

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

const lk = cached(sriLankaEntries as (year: number) => Entry[]);
const bd = cached(bangladeshEntries as (year: number) => Entry[]);
const mv = cached(maldivesEntries as (year: number) => Entry[]);
const india = cached(indiaFixes as (year: number) => Entry[]);

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

function datesOf(entriesOf: (year: number) => Entry[], name: string, year: number): string[] {
  return entriesOf(year)
    .filter((entry) => entry.name === name)
    .map((entry) => entry.date)
    .sort();
}

const years = Array.from({ length: TO - FROM + 1 }, (_, index) => FROM + index);

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Lengths of the runs of consecutive days, leaving out a run cut by the year's edge. */
function runLengths(dates: string[]): number[] {
  const runs: string[][] = [];
  for (const date of [...dates].sort()) {
    const last = runs[runs.length - 1];
    if (last && addDays(last[last.length - 1], 1) === date) last.push(date);
    else runs.push([date]);
  }
  return runs
    .filter((run) => !run[0].endsWith("-01-01") && !run[run.length - 1].endsWith("-12-31"))
    .map((run) => run.length);
}

// ---------------------------------------------------------------------------
// Sri Lanka.

/** The 2026 gazette, as date-holidays' LK.yaml has it. */
const LK_2026: Table = [
  ["Duruthu Full Moon Poya Day", "2026-01-03"],
  ["Tamil Thai Pongal Day", "2026-01-15"],
  ["Navam Full Moon Poya Day", "2026-02-01"],
  ["Mahasivarathri Day", "2026-02-15"],
  ["Madin Full Moon Poya Day", "2026-03-02"],
  ["Id-Ul-Fitr (Ramazan Festival Day)", "2026-03-21"],
  ["Bak Full Moon Poya Day", "2026-04-01"],
  ["Day before Sinhala and Tamil New Year", "2026-04-13"],
  ["Sinhala and Tamil New Year", "2026-04-14"],
  ["Labour Day and Vesak Full Moon Poya Day", "2026-05-01"],
  ["Day following Vesak Full Moon Poya Day", "2026-05-02"],
  ["Id-Ul-Alha (Hadji Festival Day)", "2026-05-28"],
  ["Adhi Poson Full Moon Poya Day", "2026-05-30"],
  ["Poson Full Moon Poya Day", "2026-06-29"],
  ["Esala Full Moon Poya Day", "2026-07-29"],
  ["Milad-Un-Nabi (Holy Prophet's Birthday)", "2026-08-26"],
  ["Nikini Full Moon Poya Day", "2026-08-27"],
  ["Binara Full Moon Poya Day", "2026-09-26"],
  ["Vap Full Moon Poya Day", "2026-10-25"],
  ["Deepavali Festival Day", "2026-11-08"],
  ["Il Full Moon Poya Day", "2026-11-24"],
  ["Unduvap Full Moon Poya Day", "2026-12-23"],
];

/** The 2027 gazette (Extraordinary Gazette 2493/05) as the Central Bank lists it. */
const LK_2027: Table = [
  ["Tamil Thai Pongal Day", "2027-01-15"],
  ["Duruthu Full Moon Poya Day", "2027-01-22"],
  ["Navam Full Moon Poya Day", "2027-02-20"],
  ["Mahasivarathri Day", "2027-03-06"],
  ["Id-Ul-Fitr (Ramazan Festival Day)", "2027-03-10"],
  ["Madin Full Moon Poya Day", "2027-03-22"],
  ["Day before Sinhala and Tamil New Year", "2027-04-13"],
  ["Sinhala and Tamil New Year", "2027-04-14"],
  ["Bak Full Moon Poya Day", "2027-04-20"],
  ["Labour Day", "2027-05-01"],
  ["Id-Ul-Alha (Hadji Festival Day)", "2027-05-17"],
  ["Vesak Full Moon Poya Day", "2027-05-19"],
  ["Poson Full Moon Poya Day", "2027-06-18"],
  ["Esala Full Moon Poya Day", "2027-07-18"],
  ["Milad-Un-Nabi (Holy Prophet's Birthday)", "2027-08-15"],
  ["Nikini Full Moon Poya Day", "2027-08-16"],
  ["Binara Full Moon Poya Day", "2027-09-15"],
  ["Vap Full Moon Poya Day", "2027-10-15"],
  ["Deepavali Festival Day", "2027-10-28"],
  ["Il Full Moon Poya Day", "2027-11-13"],
  ["Unduvap Full Moon Poya Day", "2027-12-13"],
];

/** The 2025 calendar (Government Printing Department, via Ada Derana; Sri Lankan missions). */
const LK_2025: Table = [
  ["Tamil Thai Pongal Day", "2025-01-14"],
  ["Mahasivarathri Day", "2025-02-26"],
  ["Id-Ul-Fitr (Ramazan Festival Day)", "2025-03-31"],
  ["Day before Sinhala and Tamil New Year", "2025-04-13"],
  ["Sinhala and Tamil New Year", "2025-04-14"],
  ["Id-Ul-Alha (Hadji Festival Day)", "2025-06-07"],
  ["Milad-Un-Nabi (Holy Prophet's Birthday)", "2025-09-05"],
  ["Deepavali Festival Day", "2025-10-20"],
];

/** The Central Bank's 2024 list. */
const LK_2024: Table = [
  ["Tamil Thai Pongal Day", "2024-01-15"],
  ["Mahasivarathri Day", "2024-03-08"],
  ["Id-Ul-Fitr (Ramazan Festival Day)", "2024-04-11"],
  ["Day before Sinhala and Tamil New Year", "2024-04-12"],
  ["Sinhala and Tamil New Year", "2024-04-13"],
  ["Vesak Full Moon Poya Day", "2024-05-23"],
  ["Day following Vesak Full Moon Poya Day", "2024-05-24"],
  ["Id-Ul-Alha (Hadji Festival Day)", "2024-06-17"],
  ["Milad-Un-Nabi (Holy Prophet's Birthday)", "2024-09-16"],
  ["Deepavali Festival Day", "2024-10-31"],
];

/** Older gazettes' poya days: 2023 (gazette 2287/04, CBSL), 2020 (CBSL, desk calendar), 2018 (CBSL). */
const POYA_DATES = [
  "2023-01-06", "2023-02-05", "2023-03-06", "2023-04-05", "2023-05-05", "2023-06-03", "2023-07-03",
  "2023-08-01", "2023-08-30", "2023-09-29", "2023-10-28", "2023-11-26", "2023-12-26",
  "2020-09-01", "2020-10-01", "2020-10-30", "2018-05-29",
];

describe("Sri Lanka", () => {
  it("matches every date in the 2026 and 2027 gazettes and the 2024 and 2025 lists", { timeout: SLOW }, () => {
    expect(mismatches(lk, LK_2026)).toEqual([]);
    expect(mismatches(lk, LK_2027)).toEqual([]);
    expect(mismatches(lk, LK_2025)).toEqual([]);
    expect(mismatches(lk, LK_2024)).toEqual([]);
  });

  it("gives 2026 exactly the gazette's names and dates, so the library's entries are replaced, not doubled", { timeout: SLOW }, () => {
    const gazette = new Set(LK_2026.map(([name, date]) => `${date}|${name}`));
    const mine = new Set(lk(2026).map((entry) => `${entry.date}|${entry.name}`));
    expect(mine).toEqual(gazette);
  });

  it("puts every gazetted poya day of 2018, 2020 and 2023 on the right date", () => {
    const computed = new Set([2018, 2020, 2023].flatMap((year) => poyaDays(year).map((poya: { date: string }) => poya.date)));
    expect(POYA_DATES.filter((date) => !computed.has(date))).toEqual([]);
  });

  it("names the extra poya as the 2018, 2020 and 2026 gazettes did, and records 2023's exception", () => {
    const names = (year: number) =>
      poyaDays(year).map((poya: { date: string; month: string; adhi: boolean }) => `${poya.date} ${poya.adhi ? "Adhi " : ""}${poya.month}`);
    expect(names(2018)).toContain("2018-05-29 Adhi Poson");
    expect(names(2020)).toContain("2020-10-01 Adhi Vap");
    expect(names(2020)).toContain("2020-10-30 Vap");
    expect(names(2026)).toContain("2026-05-30 Adhi Poson");
    // The 2023 gazette called 3 July "Adhi Esala" and 1 August "Esala"; the
    // Lahiri rule puts the extra month one later. The dates agree.
    expect(names(2023)).toContain("2023-07-03 Esala");
    expect(names(2023)).toContain("2023-08-01 Adhi Nikini");
  });

  it("runs the poya days in month order, 29 or 30 days apart, with each extra month before its namesake", () => {
    const ORDER = ["Duruthu", "Navam", "Madin", "Bak", "Vesak", "Poson", "Esala", "Nikini", "Binara", "Vap", "Il", "Unduvap"];
    const all = years.flatMap((year) => poyaDays(year) as { date: string; month: string; adhi: boolean }[]);
    const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
    const problems: string[] = [];
    for (let i = 1; i < all.length; i++) {
      const [before, poya] = [all[i - 1], all[i]];
      if (![29, 30].includes(days(before.date, poya.date))) problems.push(`${before.date} to ${poya.date}`);
      const next = before.adhi ? before.month : ORDER[(ORDER.indexOf(before.month) + 1) % 12];
      if (poya.month !== next || (poya.adhi && before.adhi)) problems.push(`${poya.date} ${poya.month} after ${before.month}`);
    }
    expect(problems).toEqual([]);
    // Ten leap months from 2026 to 2050, about one every 33 months.
    expect(all.filter((poya) => poya.adhi).map((poya) => poya.date.slice(0, 4))).toEqual([
      "2026", "2029", "2031", "2034", "2037", "2039", "2042", "2045", "2048", "2050",
    ]);
  });

  it("has 12 or 13 poya days a year, one Vesak and one Labour Day", { timeout: SLOW }, () => {
    for (const year of years) {
      const poyas = poyaDays(year) as { date: string; month: string; adhi: boolean }[];
      expect([12, 13]).toContain(poyas.length);
      const list = lk(year);
      const vesak = list.filter((entry) => /Vesak Full Moon Poya Day$/.test(entry.name) && !entry.name.startsWith("Day"));
      expect(vesak).toHaveLength(1);
      expect(datesOf(lk, "Day following Vesak Full Moon Poya Day", year)).toHaveLength(1);
      const mayDay = list.filter((entry) => entry.date === `${year}-05-01` && /Labour Day/.test(entry.name));
      expect(mayDay).toHaveLength(1);
    }
  });

  it("marks computed lunar dates as estimates and the gazetted years as published", { timeout: SLOW }, () => {
    for (const year of years) {
      for (const entry of lk(year)) {
        if (/Poya Day$|Mahasivarathri|Deepavali/.test(entry.name)) {
          expect(entry.note.endsWith(LUNAR)).toBe(year > 2027);
        }
        if (/^Id-Ul|^Milad/.test(entry.name)) expect(entry.note.endsWith(ISLAMIC)).toBe(true);
      }
    }
  });

  it("keeps the Islamic days a day after date-holidays' dates", () => {
    expect(hijriDates("1 Shawwal", 2027, 1)).toEqual(["2027-03-10"]);
    expect(hijriDates("1 Shawwal", 2027, 0)).toEqual(["2027-03-09"]);
  });

  it("finds the New Year and Thai Pongal days from the Sun", () => {
    expect([2024, 2025, 2026, 2027, 2028].map((year) => sinhalaNewYear(year).date)).toEqual([
      "2024-04-13", "2025-04-14", "2026-04-14", "2027-04-14", "2028-04-13",
    ]);
    expect([2024, 2025, 2026, 2027].map((year) => thaiPongal(year).date)).toEqual([
      "2024-01-15", "2025-01-14", "2026-01-15", "2027-01-15",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Bangladesh.

/** The 2026 list (Ministry of Public Administration, via The Daily Star and The Business Standard). */
const BD_2026: Table = [
  ["Shab-e-Barat", "2026-02-04"],
  ["Shab-e-Qadr", "2026-03-17"],
  ["End of Ramadan (Eid al-Fitr)", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22", "2026-03-23"],
  ["Buddha Purnima", "2026-05-01"],
  ["Feast of the Sacrifice (Eid al-Adha)", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31"],
  ["Day of Ashura", "2026-06-26"],
  ["July Mass Uprising Day", "2026-08-05"],
  ["Birthday of Muhammad (Mawlid)", "2026-08-26"],
  ["Janmashtami", "2026-09-04"],
  ["Durga Puja (Maha Navami)", "2026-10-20"],
  ["Durga Puja (Bijoya Dashami)", "2026-10-21"],
];

/** The 2025 and 2024 lists (Dhaka Tribune; holidaydb). */
const BD_EARLIER: Table = [
  ["Shab-e-Barat", "2025-02-15"],
  ["Shab-e-Qadr", "2025-03-28"],
  ["End of Ramadan (Eid al-Fitr)", "2025-03-31"],
  ["Day of Ashura", "2025-07-06"],
  ["Janmashtami", "2024-08-26", "2025-08-16"],
  ["Durga Puja (Maha Navami)", "2025-10-01"],
  ["Durga Puja (Bijoya Dashami)", "2024-10-13", "2025-10-02"],
  ["Buddha Purnima", "2024-05-23"],
];

describe("Bangladesh", () => {
  it("matches every day in the 2026 list", { timeout: SLOW }, () => {
    expect(mismatches(bd, BD_2026)).toEqual([]);
    expect(datesOf(bd, "End of Ramadan (Eid al-Fitr)", 2026)).toHaveLength(5);
    expect(datesOf(bd, "Feast of the Sacrifice (Eid al-Adha)", 2026)).toHaveLength(6);
  });

  it("matches the 2024 and 2025 lists, missing only Buddha Purnima 2025", { timeout: SLOW }, () => {
    expect(mismatches(bd, BD_EARLIER)).toEqual([]);
    // Listed on 11 May 2025, the day the full-moon tithi began; Dhaka's
    // sunrise rule gives 12 May, as it gives the listed 23 May 2024 and 1 May 2026.
    expect(datesOf(bd, "Buddha Purnima", 2025)).toEqual(["2025-05-12"]);
  });

  it("has each festival once a year, an Eid break of three days, and no abolished holidays", { timeout: SLOW }, () => {
    for (const year of years) {
      for (const name of ["Buddha Purnima", "Janmashtami", "Durga Puja (Bijoya Dashami)", "July Mass Uprising Day"]) {
        expect(datesOf(bd, name, year)).toHaveLength(1);
      }
      const names = new Set(bd(year).map((entry) => entry.name));
      expect(names.has("National Mourning Day")).toBe(false);
      if (year > 2026) {
        // The day before Eid, Eid and the day after.
        for (const name of ["End of Ramadan (Eid al-Fitr)", "Feast of the Sacrifice (Eid al-Adha)"]) {
          expect(datesOf(bd, name, year).length).toBeGreaterThanOrEqual(1);
          for (const length of runLengths(datesOf(bd, name, year))) expect(length).toBe(3);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The Maldives.

/** The President's Office (2025 Eid al-Adha) and the holiday calendars where they agree. */
const MV_PUBLISHED: Table = [
  // The Moon Sighting Committee declared 30 March 2025 on Saudi Arabia's sighting.
  ["Eid al-Fitr", "2025-03-30"],
  ["Hajj Day", "2025-06-05", "2026-05-26"],
  ["Eid al-Adha", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09", "2026-05-27"],
  ["Beginning of Ramadan", "2025-03-01"],
  ["Islamic New Year", "2025-06-26"],
  ["National Day", "2025-08-24"],
  ["The Prophet's Birthday", "2025-09-04"],
  ["The Day Maldives Embraced Islam", "2025-09-24"],
  ["Eid al-Fitr", "2026-03-20", "2026-03-21", "2026-03-22"],
  ["Independence Day", "2025-07-26", "2025-07-27", "2026-07-26", "2026-07-27"],
  ["Victory Day", "2026-11-03"],
  ["Republic Day", "2026-11-11"],
];

describe("the Maldives", () => {
  it("matches the published dates", { timeout: SLOW }, () => {
    expect(mismatches(mv, MV_PUBLISHED)).toEqual([]);
  });

  it("has a full list in every year, with Eid al-Fitr over three days and Eid al-Adha over four", { timeout: SLOW }, () => {
    for (const year of years) {
      const list = mv(year);
      expect(list.filter((entry) => entry.kind === "public").length).toBeGreaterThanOrEqual(15);
      for (const name of ["New Year's Day", "Labour Day", "Victory Day", "Republic Day"]) {
        expect(datesOf(mv, name, year)).toHaveLength(1);
      }
      expect(datesOf(mv, "Independence Day", year)).toEqual([`${year}-07-26`, `${year}-07-27`]);
      for (const length of runLengths(datesOf(mv, "Eid al-Fitr", year))) expect(length).toBe(3);
      for (const length of runLengths(datesOf(mv, "Eid al-Adha", year))) expect(length).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// India.

describe("India's state days", () => {
  it("puts Vishu and Poila Baishakh on the notified days", () => {
    // Kerala's lists: 15 April 2023, 14 April 2024 and 2025, 15 April 2026.
    expect([2023, 2024, 2025, 2026].map((year) => vishu(year).date)).toEqual([
      "2023-04-15", "2024-04-14", "2025-04-14", "2026-04-15",
    ]);
    expect(datesOf(india, "Vishu", 2026)).toEqual(["2026-04-15"]);
    expect(datesOf(india, "Bengali New Year", 2026)).toEqual(["2026-04-15"]);
  });

  it("follows the Mesha sankranti: Vishu at the first sunrise after it, Poila Baishakh the civil day after", () => {
    expect([2024, 2025, 2026, 2027, 2028].map((year) => vishu(year).date)).toEqual([
      "2024-04-14", "2025-04-14", "2026-04-15", "2027-04-15", "2028-04-14",
    ]);
    expect([2024, 2025, 2026, 2027, 2028].map((year) => poilaBaishakh(year).date)).toEqual([
      "2024-04-14", "2025-04-15", "2026-04-15", "2027-04-15", "2028-04-14",
    ]);
  });

  it("keeps India's 2026 Bakrid on 28 May, the day the central government moved it to", { timeout: SLOW }, () => {
    const bakrid = (indiaEntries(2026) as Entry[]).filter((entry) => entry.name === "Eid al-Adha");
    expect(bakrid.map((entry) => entry.date)).toEqual(["2026-05-28"]);
    expect(bakrid[0].note).toContain("Jammu and Kashmir");
  });
});

// ---------------------------------------------------------------------------
// The supplement as the generator reads it.

describe("south-asia.mjs", () => {
  it("is well formed, and every drop rule removes a library entry", { timeout: SLOW }, () => {
    const loaded = supplementEntries(supplements, "south-asia.mjs") as {
      country: string;
      entries: Entry[];
    }[];
    expect(loaded.map((supplement) => supplement.country)).toEqual(["LK", "BD", "IN", "MV"]);
    for (const supplement of loaded) {
      const keys = new Set<string>();
      for (const entry of supplement.entries) {
        expect(KINDS.has(entry.kind)).toBe(true);
        expect(entry.note.includes("—")).toBe(false);
        const key = `${entry.date}|${entry.name}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
      if (supplement.country === "MV") continue;
      // Throws if a rule matches nothing.
      const kept = applyDrops(supplement.country, libraryEntries(supplement.country), [supplement]) as Entry[];
      const merged = mergeEntries(kept, supplement.entries) as Entry[];
      if (supplement.country === "LK") {
        // 2026 keeps the gazette's 22 lunar and solar days, now with notes.
        const lk2026 = merged.filter((entry) => entry.date.startsWith("2026-"));
        expect(mismatches(() => lk2026, LK_2026)).toEqual([]);
        expect(lk2026.filter((entry) => entry.date === "2026-05-01")).toHaveLength(1);
        // From 2027 nothing is left on the library's frozen month-days.
        expect(merged.some((entry) => entry.date === "2027-05-30" && entry.name.startsWith("Adhi"))).toBe(false);
      }
      if (supplement.country === "BD") {
        expect(merged.some((entry) => entry.name === "Buddha's Birthday")).toBe(false);
        expect(merged.some((entry) => entry.name === "Mujib's Birthday & Children's Day")).toBe(false);
      }
      if (supplement.country === "IN") {
        expect(merged.some((entry) => entry.name === "Vaisakhi" && /Kerala/.test(entry.note))).toBe(false);
        expect(merged.some((entry) => entry.name === "Guru Gobind Singh Jayanti")).toBe(false);
      }
    }
  });

  it("gives the same dates every time", { timeout: SLOW }, () => {
    expect(JSON.stringify(sriLankaEntries(2041))).toBe(JSON.stringify(sriLankaEntries(2041)));
    expect(JSON.stringify(bangladeshEntries(2041))).toBe(JSON.stringify(bangladeshEntries(2041)));
  });
});
