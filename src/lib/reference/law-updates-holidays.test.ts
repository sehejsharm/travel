import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  chinaSubstitutes,
  citizensHoliday,
  ethiopianFeasts,
  hongKongEasterClash,
  internals,
  taiwanSubstitutes,
  vietnamSecondNationalDay,
  vietnamSubstitutes,
} from "../../../scripts/holiday-supplements/law-updates.mjs";

/**
 * Holiday laws newer than date-holidays, and kinds that hide closures
 * (scripts/holiday-supplements/law-updates.mjs), checked against the
 * calendars governments published. Sources and match rates are in
 * docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };

const SLOW = 120_000;
const loaded = supplementEntries(supplements, "law-updates.mjs");

const mergedCache = new Map<string, Entry[]>();
/** The library for a country, less this file's drops, plus its entries: what the build ships, other supplements aside. */
function merged(country: string): Entry[] {
  let list = mergedCache.get(country);
  if (!list) {
    const own = loaded.filter((supplement: { country: string }) => supplement.country === country);
    const kept = applyDrops(country, libraryEntries(country), own);
    list = mergeEntries(kept, own.flatMap((supplement: { entries: Entry[] }) => supplement.entries)) as Entry[];
    mergedCache.set(country, list);
  }
  return list;
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const isWeekend = (iso: string) => weekday(iso) === 0 || weekday(iso) === 6;

/** Distinct weekdays with a public holiday, in a year (or a date prefix). */
function weekdaysOff(country: string, prefix: string): string[] {
  const dates = merged(country)
    .filter((entry) => entry.kind === "public" && entry.date.startsWith(prefix) && !isWeekend(entry.date))
    .map((entry) => entry.date);
  return [...new Set(dates)].sort();
}

function on(country: string, date: string, name: string): Entry | undefined {
  return merged(country).find((entry) => entry.date === date && entry.name === name);
}

function datesOf(country: string, name: string, prefix = ""): string[] {
  return merged(country)
    .filter((entry) => entry.name === name && entry.date.startsWith(prefix))
    .map((entry) => entry.date);
}

describe("law-updates supplement", () => {
  it("loads, and every drop rule removes a library entry", () => {
    const countries = [...new Set(loaded.map((supplement: { country: string }) => supplement.country))].sort();
    expect(countries).toEqual(["AU", "CA", "CN", "CY", "EG", "ES", "ET", "GB", "GR", "HK", "JP", "KR", "MA", "MX", "TW", "VN"]);
    // applyDrops throws when a rule matches nothing.
    for (const country of countries) expect(merged(country).length).toBeGreaterThan(0);
  }, SLOW);

  it("writes notes in plain English, and marks Islamic dates as estimates", () => {
    for (const supplement of loaded) {
      for (const entry of supplement.entries as Entry[]) {
        expect(entry.note).not.toMatch(/[—–]/);
        if (/Eid|Mawlid|Arafat/.test(entry.name)) {
          expect(entry.note).toBe("Islamic lunar date, estimated: the official date can differ by a day");
        }
      }
    }
  });
});

describe("China", () => {
  it("matches the State Council's 2026 schedule (notice of 4 November 2025)", () => {
    // Weekdays off from February on. January is left out: the notice's
    // New Year bridge was not checked.
    expect(weekdaysOff("CN", "2026").filter((date) => date >= "2026-02")).toEqual([
      "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-23",
      "2026-04-06",
      "2026-05-01", "2026-05-04", "2026-05-05",
      "2026-06-19",
      "2026-09-25",
      "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07",
    ]);
    // The statutory days keep their names; the State Council's extra days are named apart.
    expect(datesOf("CN", "Spring Festival", "2026")).toEqual(["2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19"]);
    expect(datesOf("CN", "Spring Festival (extra day off)")).toEqual(["2026-02-20", "2026-02-23"]);
    expect(datesOf("CN", "Labour Day", "2026")).toEqual(["2026-05-01", "2026-05-02"]);
    for (const date of ["2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10"]) {
      expect(on("CN", date, "Make-up working day")?.kind).toBe("observance");
    }
  }, SLOW);

  it("keeps the 2025 law's four Spring Festival days and two Labour Days, with notes", () => {
    expect(datesOf("CN", "Spring Festival", "2027")).toEqual(["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08"]);
    expect(datesOf("CN", "Labour Day", "2030")).toEqual(["2030-05-01", "2030-05-02"]);
    expect(on("CN", "2030-10-01", "National Day")?.note).toMatch(/Golden Week/);
  });

  it("makes up weekend holidays on the next working day, as the State Council did in 2025 and 2026", () => {
    // 2025: Dragon Boat on Saturday 31 May, off on Monday 2 June.
    expect(chinaSubstitutes(2025).map((entry: Entry) => [entry.date, entry.name])).toEqual([
      ["2025-06-02", "Dragon Boat Festival (substitute day)"],
    ]);
    expect(chinaSubstitutes(2026).map((entry: Entry) => entry.date)).toEqual(["2026-04-06", "2026-05-04", "2026-10-05"]);
    // 2027: Spring Festival days on Saturday and Sunday, Labour Day and National Day on the weekend.
    expect(chinaSubstitutes(2027).map((entry: Entry) => entry.date)).toEqual([
      "2027-02-09", "2027-02-10", "2027-05-03", "2027-05-04", "2027-10-04", "2027-10-05",
    ]);
  });

  it("puts Qingming on the solar term, 4 or 5 April at UTC+8", () => {
    // Computed with VSOP87 (astronomia) at UTC+8; 2026 is the State Council's.
    const QINGMING = [
      "2026-04-05", "2027-04-05", "2028-04-04", "2029-04-04", "2030-04-05", "2031-04-05", "2032-04-04",
      "2033-04-04", "2034-04-05", "2035-04-05", "2036-04-04", "2037-04-04", "2038-04-05", "2039-04-05",
      "2040-04-04", "2041-04-04", "2042-04-04", "2043-04-05", "2044-04-04", "2045-04-04", "2046-04-04",
      "2047-04-05", "2048-04-04", "2049-04-04", "2050-04-04",
    ];
    expect(datesOf("CN", "Qingming Festival")).toEqual(QINGMING);
    expect(QINGMING.map((date) => internals.qingming(Number(date.slice(0, 4))))).toEqual(QINGMING);
  });
});

describe("Taiwan", () => {
  it("matches the DGPA's 2026 office calendar: 16 weekdays off, 120 days in all", () => {
    const off = weekdaysOff("TW", "2026");
    expect(off).toEqual([
      "2026-01-01",
      "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
      "2026-02-27",
      "2026-04-03", "2026-04-06",
      "2026-05-01",
      "2026-06-19",
      "2026-09-25", "2026-09-28",
      "2026-10-09", "2026-10-26",
      "2026-12-25",
    ]);
    expect(off.length + 104).toBe(120);
  }, SLOW);

  it("matches the DGPA's 2027 office calendar: 17 weekdays off, 121 days in all", () => {
    const off = weekdaysOff("TW", "2027");
    expect(off).toEqual([
      "2027-01-01",
      "2027-02-04", "2027-02-05", "2027-02-08", "2027-02-09", "2027-02-10",
      "2027-03-01",
      "2027-04-05", "2027-04-06",
      "2027-04-30",
      "2027-06-09",
      "2027-09-15", "2027-09-28",
      "2027-10-11", "2027-10-25",
      "2027-12-24", "2027-12-31",
    ]);
    expect(off.length + 104).toBe(121);
  }, SLOW);

  it("moves Children's Day off Tomb Sweeping Day as in 2024 and 2025", () => {
    const children = (year: number) =>
      taiwanSubstitutes(year)
        .filter((entry: Entry) => entry.name === "Children's Day (substitute day)")
        .map((entry: Entry) => entry.date);
    // 2024: both on Thursday 4 April, off Friday 5 April. 2025: both on Friday, off Thursday 3 April.
    expect(children(2024)).toEqual(["2024-04-05"]);
    expect(children(2025)).toEqual(["2025-04-03"]);
    // 2025: Dragon Boat on Saturday 31 May, off Friday 30 May.
    expect(taiwanSubstitutes(2025).map((entry: Entry) => entry.date)).toContain("2025-05-30");
  });

  it("makes Labour Day, Teachers' Day, Retrocession Day and Constitution Day days off", () => {
    for (const [date, name] of [
      ["2030-05-01", "Labour Day"],
      ["2030-09-28", "Teachers' Day"],
      ["2030-10-25", "Taiwan Retrocession Day"],
      ["2030-12-25", "Constitution Day"],
    ]) {
      expect(on("TW", date, name)?.kind).toBe("public");
    }
    // No substitute lands on a weekend.
    for (let year = 2026; year <= 2050; year++) {
      for (const entry of taiwanSubstitutes(year) as Entry[]) expect(isWeekend(entry.date)).toBe(false);
    }
  });
});

describe("Hong Kong", () => {
  it("adds a day when Ching Ming falls on an Easter holiday, as the gazette did in 2010, 2015, 2021 and 2026", () => {
    expect([2010, 2015, 2021, 2026].map(hongKongEasterClash)).toEqual(["2010-04-06", "2015-04-07", "2021-04-06", "2026-04-07"]);
    expect(datesOf("HK", "The day following Easter Monday")).toEqual(["2026-04-07", "2037-04-07", "2042-04-08", "2048-04-07"]);
  }, SLOW);
});

describe("kinds that hide closures", () => {
  it("GB, CA, AU and ES", () => {
    expect(on("GB", "2026-08-31", "Summer bank holiday")).toMatchObject({ kind: "bank", note: "Not in Scotland, which has the first Monday of August" });
    expect(on("GB", "2026-08-03", "Summer bank holiday")?.kind).toBe("optional");
    expect(on("CA", "2026-05-18", "Victoria Day")?.kind).toBe("public");
    expect(on("CA", "2026-10-12", "Thanksgiving")?.kind).toBe("public");
    expect(on("CA", "2026-09-30", "National Day for Truth and Reconciliation")?.kind).toBe("optional");
    expect(on("CA", "2026-11-11", "Remembrance Day")?.note).toMatch(/Newfoundland and Labrador.*Not in Manitoba, Ontario or Quebec/);
    expect(datesOf("CA", "Armistice Day")).toEqual([]);
    expect(on("AU", "2026-06-08", "King's Birthday")).toMatchObject({ kind: "public" });
    expect(on("AU", "2026-09-28", "King's Birthday")?.kind).toBe("optional");
    expect(on("ES", "2026-04-02", "Maundy Thursday")).toMatchObject({ kind: "public" });
    expect(on("ES", "2027-03-25", "Maundy Thursday")?.note).toMatch(/Catalonia or the Valencian Community/);
  }, SLOW);
});

describe("Ethiopia", () => {
  it("matches the published feasts of 2023 and 2024", () => {
    expect(ethiopianFeasts(2023)).toMatchObject({ enkutatash: "2023-09-12", meskel: "2023-09-28" });
    expect(ethiopianFeasts(2024)).toEqual({
      genna: "2024-01-07",
      timkat: "2024-01-20",
      enkutatash: "2024-09-11",
      meskel: "2024-09-27",
    });
  });

  it("has one of each feast a year, on the right day", () => {
    for (let year = 2026; year <= 2050; year++) {
      const feasts = ethiopianFeasts(year);
      expect(datesOf("ET", "Christmas Day", String(year))).toEqual([feasts.genna]);
      expect(datesOf("ET", "Epiphany", String(year))).toEqual([feasts.timkat]);
      expect(datesOf("ET", "New Year's Day", String(year))).toEqual([feasts.enkutatash]);
      expect(datesOf("ET", "Finding of the True Cross", String(year))).toEqual([feasts.meskel]);
    }
    expect(datesOf("ET", "Christmas Day", "2026")).toEqual(["2026-01-07"]);
    expect(datesOf("ET", "Epiphany", "2028")).toEqual(["2028-01-20"]);
    expect(datesOf("ET", "New Year's Day", "2027")).toEqual(["2027-09-12"]);
    expect(on("ET", "2026-05-05", "Patriots' Victory Day")?.kind).toBe("public");
  }, SLOW);
});

describe("the sweep", () => {
  it("Mexico: inauguration day is 1 October every six years from 2024", () => {
    expect(datesOf("MX", "Change of Federal Government")).toEqual(["2030-10-01", "2036-10-01", "2042-10-01", "2048-10-01"]);
  }, SLOW);

  it("Japan: the Citizens' Holiday between Respect for the Aged Day and the equinox", () => {
    expect([2026, 2032, 2037, 2043, 2049].map(citizensHoliday)).toEqual([
      "2026-09-22", "2032-09-21", "2037-09-22", "2043-09-22", "2049-09-21",
    ]);
    expect(on("JP", "2032-09-21", "Citizens' Holiday")?.kind).toBe("public");
  }, SLOW);

  it("Korea: Labour Day is a public holiday from 2026, and election days are days off", () => {
    expect(on("KR", "2026-05-01", "Labour Day")?.kind).toBe("public");
    expect(on("KR", "2026-06-03", "Local Elections Day")?.kind).toBe("public");
    expect(on("KR", "2028-04-12", "National Assembly Election Day")?.kind).toBe("public");
  }, SLOW);

  it("Vietnam: Culture Day, the second National Day and weekend make-up days", () => {
    // The government's picks, 2021 to 2026.
    expect([2021, 2022, 2023, 2024, 2025, 2026].map(vietnamSecondNationalDay)).toEqual([
      "2021-09-03", "2022-09-01", "2023-09-01", "2024-09-03", "2025-09-01", "2026-09-01",
    ]);
    // 2023: National Day on Saturday, made up on Monday 4 September.
    expect(vietnamSubstitutes(2023).map((entry: Entry) => entry.date)).toContain("2023-09-04");
    // 2026: Hung Kings Day on Sunday 26 April, made up on Monday 27 April.
    expect(on("VN", "2026-04-27", "Hung Kings Commemorations (substitute day)")?.kind).toBe("public");
    expect(on("VN", "2026-09-01", "National Day")?.kind).toBe("public");
    expect(on("VN", "2026-11-24", "Vietnamese Culture Day")?.kind).toBe("public");
  }, SLOW);

  it("Morocco: Amazigh New Year, Unity Day and two-day Eids", () => {
    expect(on("MA", "2026-01-14", "Amazigh New Year")?.kind).toBe("public");
    expect(on("MA", "2026-10-31", "Unity Day")?.kind).toBe("public");
    // The Ministry of Habous set Mawlid 2026 on 25 August, with 25 and 26 August off.
    expect(datesOf("MA", "Birthday of Muhammad (Mawlid)", "2026")).toEqual(["2026-08-25", "2026-08-26"]);
    expect(datesOf("MA", "Feast of the Sacrifice (Eid al-Adha)", "2026")).toEqual(["2026-05-27", "2026-05-28"]);
  }, SLOW);

  it("Egypt: Arafat Day before Eid al-Adha", () => {
    expect(on("EG", "2026-05-26", "Arafat Day")?.kind).toBe("public");
  }, SLOW);

  it("Greece and Cyprus: Clean Monday on the Monday, 48 days before Orthodox Easter", () => {
    for (const country of ["GR", "CY"]) {
      expect(datesOf(country, "Clean Monday").slice(0, 2)).toEqual(["2026-02-23", "2027-03-15"]);
      expect(datesOf(country, "Ash Sunday")).toEqual([]);
    }
    expect(on("CY", "2026-06-01", "Kataklysmos")?.kind).toBe("public");
  }, SLOW);
});
