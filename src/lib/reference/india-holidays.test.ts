import { describe, expect, it } from "vitest";
import supplements, { indiaEntries, internals } from "../../../scripts/holiday-supplements/india.mjs";

/**
 * India's festival dates are computed (scripts/holiday-supplements/india.mjs),
 * so these check them against dates someone in authority published. Sources
 * and match rates are in docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };

const cache = new Map<number, Entry[]>();
function entries(year: number): Entry[] {
  let list = cache.get(year);
  if (!list) {
    list = indiaEntries(year) as Entry[];
    cache.set(year, list);
  }
  return list;
}

/** [name, ...dates]: the dates the reference gives, which must all match. */
type Table = [name: string, ...dates: string[]][];

/** Mismatches as "name: wanted, got …", so a failure says what moved. */
function mismatches(table: Table): string[] {
  const out: string[] = [];
  for (const [name, ...dates] of table) {
    for (const date of dates) {
      const year = Number(date.slice(0, 4));
      const got = entries(year).filter((entry) => entry.name === name).map((entry) => entry.date);
      if (!got.includes(date)) out.push(`${name}: wanted ${date}, got ${got.join(" and ") || "nothing"}`);
    }
  }
  return out;
}

const SLOW = 120_000;

// Government of India, DoPT holiday lists for central government offices in
// Delhi (Annexure I), 2020 to 2027.
const GAZETTED: Table = [
  ["Holi", "2020-03-10", "2021-03-29", "2022-03-18", "2023-03-08", "2024-03-25", "2025-03-14", "2026-03-04", "2027-03-23"],
  ["Ram Navami", "2020-04-02", "2021-04-21", "2023-03-30", "2024-04-17", "2026-03-26", "2027-04-15"],
  ["Mahavir Jayanti", "2020-04-06", "2021-04-25", "2022-04-14", "2023-04-04", "2024-04-21", "2025-04-10", "2026-03-31", "2027-04-19"],
  ["Buddha Purnima", "2020-05-07", "2021-05-26", "2022-05-16", "2023-05-05", "2024-05-23", "2025-05-12", "2026-05-01", "2027-05-20"],
  ["Janmashtami", "2020-08-12", "2021-08-30", "2022-08-19", "2023-09-07", "2024-08-26", "2025-08-16", "2026-09-04", "2027-08-25"],
  ["Dussehra", "2020-10-25", "2021-10-15", "2022-10-05", "2023-10-24", "2024-10-12", "2025-10-02", "2026-10-20", "2027-10-09"],
  ["Diwali", "2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12", "2024-10-31", "2025-10-20", "2026-11-08", "2027-10-29"],
  ["Guru Nanak Jayanti", "2020-11-30", "2021-11-19", "2022-11-08", "2023-11-27", "2024-11-15", "2025-11-05", "2026-11-24", "2027-11-14"],
];

// DoPT restricted holidays (Annexure II) for 2024 and 2027, and Tamil Nadu's
// G.O. Ms. No. 708 for 2026.
const RESTRICTED: Table = [
  ["Maha Shivaratri", "2024-03-08", "2025-02-26", "2027-03-06"],
  ["Raksha Bandhan", "2024-08-19", "2027-08-17"],
  ["Ganesh Chaturthi", "2024-09-07", "2027-09-04"],
  ["Onam", "2027-09-12"],
  ["Pongal", "2024-01-15", "2026-01-15", "2027-01-15"],
  ["Vasant Panchami", "2027-02-11"],
  ["Ugadi and Gudi Padwa", "2027-04-07"],
  ["Vaisakhi", "2027-04-14"],
  ["Puthandu", "2027-04-14"],
  ["Rath Yatra", "2027-07-05"],
  ["Guru Gobind Singh Jayanti", "2027-01-15"],
  ["Durga Puja: Maha Ashtami", "2027-10-07"],
  ["Durga Puja: Maha Navami", "2027-10-08"],
];

// Dates the almanacs (Drik Panchang and others) and Kerala publish, where
// they agree with each other. Years where they disagree are left out.
const ALMANACS: Table = [
  ["Diwali", "2028-10-17", "2029-11-05", "2030-10-26"],
  ["Holi", "2028-03-11"],
  ["Dussehra", "2014-10-03", "2029-10-16", "2030-10-06"],
  ["Raksha Bandhan", "2020-08-03", "2021-08-22", "2022-08-11", "2023-08-30", "2025-08-09", "2026-08-28", "2028-08-05", "2030-08-13"],
  ["Janmashtami", "2028-08-13", "2029-09-01", "2030-08-21"],
  ["Ganesh Chaturthi", "2020-08-22", "2021-09-10", "2022-08-31", "2023-09-19", "2025-08-27", "2026-09-14", "2028-08-23", "2029-09-11", "2030-09-01"],
  ["Maha Shivaratri", "2020-02-21", "2021-03-11", "2022-03-01", "2023-02-18", "2026-02-15", "2028-02-23", "2029-02-11", "2030-03-02"],
  ["Onam", "2020-08-31", "2021-08-21", "2022-09-08", "2023-08-29", "2024-09-15", "2025-09-05", "2026-08-26"],
  ["Ugadi and Gudi Padwa", "2029-04-14"],
  ["Makar Sankranti", "2023-01-15", "2024-01-15", "2025-01-14", "2026-01-14"],
];

// The days India kept, as finally notified or announced after the sighting.
const ISLAMIC: Table = [
  ["Eid al-Fitr", "2015-07-18", "2016-07-07", "2017-06-26", "2018-06-16", "2019-06-05", "2020-05-25", "2021-05-14", "2022-05-03", "2023-04-22", "2024-04-11", "2025-03-31", "2026-03-21"],
  ["Eid al-Adha", "2015-09-25", "2016-09-13", "2017-09-02", "2018-08-22", "2019-08-12", "2020-08-01", "2021-07-21", "2022-07-10", "2023-06-29", "2024-06-17", "2025-06-07", "2026-05-28"],
  ["Muharram", "2015-10-24", "2016-10-12", "2017-10-01", "2018-09-21", "2019-09-10", "2020-08-30", "2021-08-20", "2022-08-09", "2023-07-29", "2024-07-17", "2025-07-06", "2026-06-26"],
  ["Milad-un-Nabi", "2016-12-13", "2017-12-02", "2018-11-21", "2019-11-10", "2020-10-30", "2021-10-19", "2022-10-09", "2023-09-28", "2024-09-16", "2025-09-05", "2026-08-26"],
  ["Ramadan begins", "2020-04-25", "2021-04-14", "2022-04-03", "2023-03-24", "2024-03-12", "2025-03-02", "2026-02-19"],
];
const ISLAMIC_2027: Table = [
  ["Eid al-Fitr", "2027-03-10"],
  ["Eid al-Adha", "2027-05-17"],
  ["Muharram", "2027-06-16"],
  ["Milad-un-Nabi", "2027-08-15"],
];

/** Annual festivals: exactly one a year. */
const ANNUAL = [
  "Lohri", "Makar Sankranti", "Pongal", "Vasant Panchami", "Maha Shivaratri", "Holika Dahan", "Holi",
  "Ugadi and Gudi Padwa", "Ram Navami", "Mahavir Jayanti", "Hanuman Jayanti", "Vaisakhi", "Puthandu",
  "Akshaya Tritiya", "Buddha Purnima", "Rath Yatra", "Guru Purnima", "Raksha Bandhan", "Janmashtami",
  "Ganesh Chaturthi", "Onam", "Anant Chaturdashi", "Navratri begins", "Durga Puja: Maha Saptami",
  "Durga Puja: Maha Ashtami", "Durga Puja: Maha Navami", "Dussehra", "Durga Puja: Vijaya Dashami",
  "Karva Chauth", "Dhanteras", "Naraka Chaturdashi", "Diwali", "Govardhan Puja", "Bhai Dooj",
  "Chhath Puja", "Guru Nanak Jayanti",
];

const KINDS = new Set(["public", "bank", "optional", "observance", "festival"]);

describe("India's computed festival dates", () => {
  it("match every gazetted Hindu, Jain, Buddhist and Sikh holiday from 2020 to 2027", { timeout: SLOW }, () => {
    expect(mismatches(GAZETTED)).toEqual([]);
  });

  it("match the restricted-holiday lists and the almanacs where they agree", { timeout: SLOW }, () => {
    expect(mismatches(RESTRICTED)).toEqual([]);
    expect(mismatches(ALMANACS)).toEqual([]);
  });

  it("match India's moon-sighted Islamic dates in nearly every month", { timeout: SLOW }, () => {
    const total = ISLAMIC.reduce((sum, [, ...dates]) => sum + dates.length, 0);
    const missed = mismatches(ISLAMIC);
    // The three misses (Muharram 2021, Milad-un-Nabi 2024 and 2025) were all
    // borderline evenings, and carry a close-call note naming the other day.
    expect(missed.length).toBeLessThanOrEqual(3);
    expect(total - missed.length).toBeGreaterThanOrEqual(51);
    expect(mismatches(ISLAMIC_2027)).toEqual([]);
  });

  it("names the other day when a sighting is a close call", { timeout: SLOW }, () => {
    const bakrid = entries(2026).find((entry) => entry.name === "Eid al-Adha");
    expect(bakrid?.note).toContain("it may be 27 May");
  });

  it("gives the Smarta day as well when it differs from the gazetted Janmashtami", { timeout: SLOW }, () => {
    const janmashtami = entries(2023).find((entry) => entry.name === "Janmashtami");
    expect(janmashtami?.date).toBe("2023-09-07");
    expect(janmashtami?.note).toContain("6 September");
  });
});

describe("India's supplement", () => {
  it("lists each annual festival exactly once in every year from 2026 to 2050", { timeout: SLOW }, () => {
    const problems: string[] = [];
    for (let year = 2026; year <= 2050; year++) {
      const list = entries(year);
      for (const name of ANNUAL) {
        const count = list.filter((entry) => entry.name === name).length;
        if (count !== 1) problems.push(`${year} ${name}: ${count}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("returns well-formed entries in the supplement shape", { timeout: SLOW }, () => {
    expect(supplements).toHaveLength(1);
    const [india] = supplements;
    expect(india.country).toBe("IN");
    expect(india.source).toMatch(/https:\/\//);

    for (let year = 2026; year <= 2050; year++) {
      const keys = new Set<string>();
      for (const entry of india.entries(year) as Entry[]) {
        expect(entry.date.startsWith(`${year}-`)).toBe(true);
        expect(new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(entry.date);
        expect(KINDS.has(entry.kind)).toBe(true);
        expect(entry.name.trim()).not.toBe("");
        expect(entry.note.trim()).not.toBe("");
        const key = `${entry.date}|${entry.name}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    }
  });

  it("marks the nationwide central government holidays as days off", { timeout: SLOW }, () => {
    const publicNames = new Set(entries(2027).filter((entry) => entry.kind === "public").map((entry) => entry.name));
    expect([...publicNames].sort()).toEqual([
      "Buddha Purnima", "Diwali", "Dussehra", "Eid al-Adha", "Eid al-Fitr", "Guru Nanak Jayanti",
      "Mahavir Jayanti", "Milad-un-Nabi", "Muharram",
    ]);
  });

  it("gives the same dates every time", { timeout: SLOW }, () => {
    expect(JSON.stringify(indiaEntries(2041))).toBe(JSON.stringify(indiaEntries(2041)));
  });
});

describe("the astronomy behind the dates", () => {
  const jd = (iso: string) => Date.parse(iso) / 86_400_000 + 2440587.5;
  const iso = (julian: number) => new Date((julian - 2440587.5) * 86_400_000).toISOString();

  it("puts new and full moons within a minute of the published times", () => {
    // USNO: new moon 2024-04-08 18:21 UT (the total solar eclipse), full moon
    // 2026-03-03 11:38 UT (the total lunar eclipse). The Moon gains 0.0085°
    // on the Sun a minute.
    expect(internals.elongation(jd("2024-04-08T18:21:25Z"))).toBeLessThan(0.0085);
    expect(Math.abs(internals.elongation(jd("2026-03-03T11:38:32Z")) - 180)).toBeLessThan(0.0085);
  });

  it("finds sunrise and sunset in New Delhi to the minute", () => {
    // Astronomy Engine: 05:23:55 IST on 21 June 2026, 17:28:47 IST on 21 December 2026.
    expect(Math.abs(Date.parse(iso(internals.day("2026-06-21").rise)) - Date.parse("2026-06-20T23:53:55Z"))).toBeLessThan(60_000);
    expect(Math.abs(Date.parse(iso(internals.day("2026-12-21").set)) - Date.parse("2026-12-21T11:58:47Z"))).toBeLessThan(60_000);
  });

  it("finds Makar Sankranti 2026 at 15:13 IST, as the almanacs do", () => {
    const instant = Date.parse(iso(internals.sankrantiIn(2026, 9)));
    expect(Math.abs(instant - Date.parse("2026-01-14T09:44:00Z"))).toBeLessThan(2 * 60_000);
  });

  it("finds the extra (adhik) months", () => {
    type Lunation = { start: number; end: number; month: number; adhik: boolean };
    const adhik = (year: number) =>
      (internals.lunations(year) as Lunation[])
        .filter((lunation) => lunation.adhik)
        .map((lunation) => new Date((lunation.start - 2440587.5) * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10));
    expect(adhik(2023)).toEqual(["2023-07-18"]); // Adhik Shravana
    expect(adhik(2026)).toEqual(["2026-05-17"]); // Adhik Jyeshtha
    expect(adhik(2029)).toEqual(["2029-03-15"]); // Adhik Chaitra
  });
});
