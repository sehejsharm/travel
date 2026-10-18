import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./countries";
import type { CountryHolidays, HolidayEntry } from "./holiday-data";

/**
 * Checks on the committed holiday data (src/lib/reference/holiday-data/), the
 * shipped calendar as a whole: holidays that stop early, lunar holidays frozen
 * on one month-day, the lunisolar fixes the generator makes, and a file for
 * every country. HOLIDAY_DATA_DIR points it at a dry run instead
 * (node scripts/build-holidays.mjs --out <dir>).
 */

const DATA_DIR =
  process.env.HOLIDAY_DATA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "holiday-data");
const FROM = 2026;
const TO = 2050;
const DAYS_OFF = new Set(["public", "bank", "optional"]);

const cache = new Map<string, CountryHolidays | null>();
function read(country: string): CountryHolidays | null {
  if (!cache.has(country)) {
    const file = path.join(DATA_DIR, `${country}.json`);
    cache.set(country, existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as CountryHolidays) : null);
  }
  return cache.get(country)!;
}

function countries(): string[] {
  const index = readFileSync(path.join(DATA_DIR, "index.ts"), "utf8");
  return [...index.matchAll(/^ {2}([A-Z]{2}): \(\) =>/gm)].map((match) => match[1]).sort();
}

function entries(country: string): HolidayEntry[] {
  return read(country)?.entries ?? [];
}

/** As the generator matches names: ignoring case, accents and punctuation. */
function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`′]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function datesOf(country: string, name: string | RegExp, from = "0000", to = "9999"): string[] {
  return entries(country)
    .filter(([date, , entryName]) => date >= from && date <= to && (typeof name === "string" ? entryName === name : name.test(entryName)))
    .map(([date]) => date);
}

// ---------------------------------------------------------------------------
// (a) Continuity: a day off that is listed in two of 2026 to 2028 must be
// listed in every year to 2050.

/** Names that come and go by design, with the reason. */
const COMES_AND_GOES: { country: string; name: RegExp; reason: string }[] = [
  {
    country: "*",
    name: /\(substitute day\)$|^Substitute |\bin lieu\b|^Public Holiday$/i,
    reason: "a substitute day exists only in years when its holiday falls on a weekend or another holiday",
  },
  { country: "BR", name: /^Election Day$/, reason: "Brazil votes every two years" },
  { country: "US", name: /Election Day$/, reason: "elections are every two or four years" },
  { country: "US", name: /^Inauguration Day$/, reason: "every four years" },
  {
    country: "HK",
    name: /^(Lunar New Year’s Day|The second day of Lunar New Year|The third day of Lunar New Year)$/,
    reason: "Hong Kong does not list a New Year day on a Sunday; the fourth day is the holiday instead",
  },
  {
    country: "HK",
    name: /^The day following the Chinese Mid-Autumn Festival$/,
    reason: "when it falls on a Sunday, Hong Kong lists the second day following instead",
  },
  {
    country: "TW",
    name: /^Chinese New Year \(substitute day\)$/,
    reason: "only when a New Year day falls on a weekend",
  },
  {
    country: "IN",
    name: /^Guru Gobind Singh Jayanti$/,
    reason: "a lunar date in Pausha, which straddles New Year: some years have it twice and nine to 2050 have none",
  },
  {
    country: "LK",
    name: /^Duruthu Full Moon Poya Day$/,
    reason: "the January full moon can fall on 31 December of the year before (2028, 2047), leaving 2029 and 2048 without one",
  },
  { country: "MP", name: /^Election Day$/, reason: "the Northern Mariana Islands vote every two years" },
  {
    country: "ID",
    name: /^Collective leave \(cuti bersama\)$/,
    reason: "the joint decree sets each year's collective leave in September, so only published years are listed",
  },
  {
    country: "MM",
    name: /^Kayin New Year$/,
    reason: "the 1st of Pyatho falls in late December or in January, so some years have it twice and some none",
  },
  {
    country: "MU",
    name: /^(Assumption|All Saints’ Day|All Saints' Day)$/,
    reason: "Mauritius keeps the Assumption as a day off in even years and All Saints' Day in odd years",
  },
];

function comesAndGoes(country: string, name: string): boolean {
  return COMES_AND_GOES.some((item) => (item.country === "*" || item.country === country) && item.name.test(name));
}

/**
 * A region's moving day off that falls on a national one in a year, so the
 * region's name is not listed apart that year.
 */
const ON_A_NATIONAL_DAY: { country: string; name: string; years: number[]; reason: string }[] = [
  { country: "BR", name: "Our Lady of Penha", years: [2031, 2036], reason: "the Monday after Easter week is 21 April, Tiradentes" },
  { country: "ES", name: "Castile and León Day", years: [2038], reason: "23 April is Good Friday" },
  { country: "IT", name: "Whit Monday", years: [2031, 2036], reason: "it is 2 June, Republic Day" },
  { country: "MY", name: "Sultan of Kedah's Birthday", years: [2032], reason: "the third Sunday of June is the Prophet's Birthday" },
  { country: "MY", name: "Penang State Governor's Birthday", years: [2030], reason: "the second Saturday of July is the Prophet's Birthday" },
];

/**
 * Whether a year without `name` is explained by the data itself: the holiday
 * is listed under a "substitute day" or "the day following" name that year
 * (it fell on a weekend), or it has a fixed day that is a national day off
 * that year (a region's day off on a national one is not listed apart).
 */
function explainedGap(list: HolidayEntry[], name: string, year: number, fixedDay: string | undefined): boolean {
  const key = nameKey(name);
  const inYear = list.filter(([date]) => date.startsWith(`${year}-`));
  if (inYear.some(([, , other]) => other !== name && nameKey(other).includes(key))) return true;
  if (fixedDay) {
    const date = `${year}-${fixedDay}`;
    if (inYear.some(([day, kind]) => day === date && (kind === "public" || kind === "bank"))) return true;
  }
  return false;
}

describe("holiday continuity", () => {
  it("lists every day off that is in two of 2026 to 2028 in every year to 2050", () => {
    const problems: string[] = [];
    for (const country of countries()) {
      const list = entries(country);
      const years = new Map<string, Set<number>>();
      const days = new Map<string, Set<string>>();
      for (const [date, , name] of list) {
        if (!years.has(name)) years.set(name, new Set());
        if (!days.has(name)) days.set(name, new Set());
        years.get(name)!.add(Number(date.slice(0, 4)));
        days.get(name)!.add(date.slice(5));
      }
      const offNames = new Set(list.filter(([, kind]) => DAYS_OFF.has(kind)).map(([, , name]) => name));
      for (const name of offNames) {
        const listed = years.get(name)!;
        const early = [2026, 2027, 2028].filter((year) =>
          list.some(([date, kind, other]) => other === name && DAYS_OFF.has(kind) && date.startsWith(`${year}-`)),
        );
        if (early.length < 2 || comesAndGoes(country, name)) continue;
        const fixedDay = days.get(name)!.size === 1 ? [...days.get(name)!][0] : undefined;
        const coincides = ON_A_NATIONAL_DAY.find((item) => item.country === country && item.name === name)?.years ?? [];
        const missing: number[] = [];
        for (let year = FROM; year <= TO; year++) {
          if (listed.has(year) || coincides.includes(year) || explainedGap(list, name, year, fixedDay)) continue;
          missing.push(year);
        }
        if (missing.length > 0) {
          const last = Math.max(...listed);
          problems.push(
            `${country} ${name}: missing ${missing.length} year(s), ${
              missing.length > 3 ? `${missing[0]} to ${missing[missing.length - 1]}` : missing.join(", ")
            } (last listed ${last})`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (b) A lunar or lunisolar holiday moves through the Gregorian year, so it
// cannot sit on one month-day three years running.

const LUNAR = new RegExp(
  [
    "\\bPoya\\b", "\\bEid\\b", "\\bId[- ]ul\\b", "\\bFitr\\b", "\\bAdha\\b", "\\bAlha\\b", "\\bArafat\\b", "\\bHari Raya\\b",
    "\\bVesak\\b", "\\bWesak\\b", "\\bWaisak\\b", "\\bVisakha\\b", "\\bBuddha\\b",
    "\\bDeepavali\\b", "\\bDiwali\\b", "\\bDivali\\b", "\\bJanmashtami\\b", "\\bDurga\\b", "\\bDashain\\b", "\\bTihar\\b",
    "\\bNyepi\\b", "Shivarat", "Sivarat", "\\bMilad\\b", "\\bMawlid\\b", "\\bMaulid\\b", "\\bMouloud\\b", "\\bProphet\\b",
    "\\bRamadan\\b", "\\bRamazan\\b", "\\bMuharram\\b", "\\bAshura\\b", "\\bIslamic New Year\\b", "\\bHijri\\b", "\\bIsra\\b",
    "\\bLosar\\b", "\\bTsagaan Sar\\b", "\\bMakha\\b", "\\bMagha\\b", "\\bAsalha\\b", "\\bAsanha\\b", "\\bKhao Phansa\\b",
    "\\bBuddhist Lent\\b", "\\bThaipusam\\b", "\\bHoli\\b", "\\bPhagwa\\b", "\\bMid-Autumn\\b", "\\bChuseok\\b",
    "\\bDragon Boat\\b", "\\bChung Yeung\\b", "\\bTuen Ng\\b", "\\bLunar New Year", "\\bSpring Festival\\b",
    "\\bSeollal\\b", "\\bT[eế]t\\b", "\\bQingming\\b", "\\bChing Ming\\b", "\\bChinese New Year\\b",
    "\\bKorean New Year\\b", "\\bVietnamese New Year\\b", "\\bKorean Thanksgiving\\b",
    "\\bLhosar\\b", "\\bShagaa\\b", "\\bSagaalgan\\b", "\\bTsagan Sar\\b", "\\bZul\\b", "\\bTshechu\\b",
    "\\bJanai Purnima\\b", "\\bLaxmi Puja\\b", "\\bBhai Tika\\b", "\\bChhath\\b",
    "\\bValmiki\\b", "\\bBasava\\b", "\\bAgrasen\\b", "\\bKanakadasa\\b",
  ].join("|"),
  "i",
);

/** Names the pattern catches that are not lunar, with the reason. */
const NOT_LUNAR: { country: string; name: string; reason: string }[] = [];

describe("lunar holidays", () => {
  it("does not freeze a lunar holiday on one month-day in 2026, 2027 and 2028", () => {
    const problems: string[] = [];
    for (const country of countries()) {
      const byName = new Map<string, Map<number, Set<string>>>();
      for (const [date, , name] of entries(country)) {
        const year = Number(date.slice(0, 4));
        if (year > 2028 || !LUNAR.test(name)) continue;
        if (NOT_LUNAR.some((item) => item.country === country && item.name === name)) continue;
        if (!byName.has(name)) byName.set(name, new Map([[2026, new Set()], [2027, new Set()], [2028, new Set()]]));
        byName.get(name)!.get(year)!.add(date.slice(5));
      }
      for (const [name, years] of byName) {
        const frozen = [...years.get(2026)!].filter((day) => years.get(2027)!.has(day) && years.get(2028)!.has(day));
        if (frozen.length > 0) problems.push(`${country} ${name}: on ${frozen.join(", ")} in 2026, 2027 and 2028`);
      }
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (c), (d) The lunisolar corrections the generator makes, and dates the
// governments published (sources in docs/holiday-dates.md).

describe("lunisolar holidays", () => {
  it("has Korean New Year from the day before Seollal to the day after", () => {
    // Regulations on Holidays of Government Offices, art. 2. 2027's Seollal
    // is a Sunday, so the next working day is a substitute.
    expect(datesOf("KR", "Korean New Year", "2026-01-01", "2027-12-31")).toEqual([
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2027-02-06",
      "2027-02-07",
      "2027-02-08",
    ]);
    expect(datesOf("KR", "Korean New Year (substitute day)", "2026-01-01", "2027-12-31")).toEqual(["2027-02-09"]);
    expect(datesOf("KR", "Korean Thanksgiving", "2026-01-01", "2027-12-31")).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2027-09-14",
      "2027-09-15",
      "2027-09-16",
    ]);
  });

  it("gives Korea a substitute day for each Seollal or Chuseok day on a Sunday or another holiday", () => {
    // Art. 3: the first day after the three that is not a Saturday, Sunday or holiday.
    const problems: string[] = [];
    const list = entries("KR");
    for (const name of ["Korean New Year", "Korean Thanksgiving"]) {
      for (let year = FROM; year <= TO; year++) {
        const span = datesOf("KR", name, `${year}-01-01`, `${year}-12-31`);
        if (span.length !== 3 || addDays(span[0], 2) !== span[2]) {
          problems.push(`${name} ${year}: ${span.join(", ")} is not three days in a row`);
          continue;
        }
        const otherDaysOff = new Set(
          list
            .filter(([date, kind, other]) => kind === "public" && other !== name && !/substitute/.test(other) && date.startsWith(`${year}-`))
            .map(([date]) => date),
        );
        const clashes = span.filter((date) => weekday(date) === 0 || otherDaysOff.has(date)).length;
        const expected: string[] = [];
        for (let date = addDays(span[2], 1); expected.length < clashes; date = addDays(date, 1)) {
          if (weekday(date) !== 0 && weekday(date) !== 6 && !otherDaysOff.has(date)) expected.push(date);
        }
        const got = datesOf("KR", `${name} (substitute day)`, `${year}-01-01`, `${year}-12-31`);
        if (got.join() !== expected.join()) {
          problems.push(`${name} ${year}: substitutes ${got.join(", ") || "none"}, the law gives ${expected.join(", ") || "none"}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("puts 2033's months 8 to 11 where the official calendars do", () => {
    // date-holidays puts 2033's leap month after month 7; it is after month 11.
    expect(datesOf("CN", "Mid-Autumn Festival", "2033-01-01", "2033-12-31")).toEqual(["2033-09-08"]);
    expect(datesOf("TW", "Mid-Autumn Festival", "2033-01-01", "2033-12-31")).toEqual(["2033-09-08"]);
    expect(datesOf("KR", "Korean Thanksgiving", "2033-01-01", "2033-12-31")).toEqual([
      "2033-09-07",
      "2033-09-08",
      "2033-09-09",
    ]);
    expect(datesOf("HK", "The day following the Chinese Mid-Autumn Festival", "2033-01-01", "2033-12-31")).toEqual([
      "2033-09-09",
    ]);
    expect(datesOf("HK", "Chung Yeung Festival", "2033-01-01", "2033-12-31")).toEqual(["2033-10-01"]);
    expect(datesOf("VN", "Mid-Autumn Festival", "2033-01-01", "2033-12-31")).toEqual(["2033-09-08"]);
  });

  it("counts lunar days from the new moon, where date-holidays slips a day", () => {
    // date-holidays has Mid-Autumn 2039 on 1 October, a day before the 15th
    // of a month it starts itself on 18 September.
    expect(datesOf("CN", "Mid-Autumn Festival", "2039-01-01", "2039-12-31")).toEqual(["2039-10-02"]);
    expect(datesOf("HK", "The day following the Chinese Mid-Autumn Festival", "2039-01-01", "2039-12-31")).toEqual([
      "2039-10-03",
    ]);
    // Hung Kings' Day, 10th of the 3rd month: a day off in Vietnam.
    expect(datesOf("VN", "Hung Kings Commemorations", "2050-01-01", "2050-12-31")).toEqual(["2050-04-01"]);
  });

  it("matches Hong Kong's gazetted general holidays for 2027", () => {
    // gov.hk/en/about/abouthk/holiday/2027.htm
    const published: [string, string][] = [
      ["2027-02-06", "Lunar New Year’s Day"],
      ["2027-02-08", "The third day of Lunar New Year"],
      ["2027-02-09", "The fourth day of Lunar New Year"],
      ["2027-04-05", "Ching Ming Festival"],
      ["2027-05-13", "Birthday of the Buddha"],
      ["2027-06-09", "Tuen Ng Festival"],
      ["2027-09-16", "The day following the Chinese Mid-Autumn Festival"],
      ["2027-10-08", "Chung Yeung Festival"],
    ];
    const list = entries("HK");
    for (const [date, name] of published) {
      expect(list.some(([d, kind, n]) => d === date && n === name && kind === "public"), `${date} ${name}`).toBe(true);
    }
    expect(datesOf("HK", /Lunar New Year/, "2027-01-01", "2027-12-31")).toEqual(["2027-02-06", "2027-02-08", "2027-02-09"]);
  });

  it("matches Taiwan's DGPA calendars for the Lunar New Year in 2026 and 2027", () => {
    const daysOff = (from: string, to: string) =>
      entries("TW")
        .filter(([date, kind, name]) => date >= from && date <= to && kind === "public" && /New Year/.test(name))
        .map(([date]) => date);
    // 2026: 15 to 19 February, and 20 February for the 15th, a Sunday.
    expect(daysOff("2026-02-01", "2026-02-28")).toEqual([
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
    ]);
    // 2027: 4 to 10 February, with 9 and 10 February for the 6th and 7th.
    expect(daysOff("2027-02-01", "2027-02-28")).toEqual([
      "2027-02-04",
      "2027-02-05",
      "2027-02-06",
      "2027-02-07",
      "2027-02-08",
      "2027-02-09",
      "2027-02-10",
    ]);
  });

  it("gives China's statutory Spring Festival and Labour Day days", () => {
    // From 2025: New Year's Eve and days 1 to 3, and 1 and 2 May.
    expect(datesOf("CN", "Spring Festival", "2026-01-01", "2027-12-31")).toEqual([
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2027-02-05",
      "2027-02-06",
      "2027-02-07",
      "2027-02-08",
    ]);
    for (let year = FROM; year <= TO; year++) {
      expect(datesOf("CN", "Labour Day", `${year}-01-01`, `${year}-12-31`)).toEqual([`${year}-05-01`, `${year}-05-02`]);
    }
  });

  it("lists Tết as five days under one name, a day apart from China in 2027", () => {
    for (let year = FROM; year <= TO; year++) {
      const days = datesOf("VN", "Vietnamese New Year", `${year}-01-01`, `${year}-12-31`);
      // 2027 is published: notice 11483/TB-BNV adds two make-up days for the weekend.
      const length = year === 2027 ? 7 : 5;
      expect(days, `${year}`).toHaveLength(length);
      expect(addDays(days[0], length - 1), `${year}`).toBe(days[length - 1]);
    }
    expect(datesOf("VN", "Vietnamese New Year", "2027-01-01", "2027-12-31")).toEqual([
      "2027-02-04",
      "2027-02-05",
      "2027-02-06",
      "2027-02-07",
      "2027-02-08",
      "2027-02-09",
      "2027-02-10",
    ]);
    expect(datesOf("VN", "Vietnamese New Year Holidays")).toEqual([]);
    // Tết 2027 is 6 February at UTC+7, as in China; Seollal is the 7th at UTC+9.
    expect(datesOf("VN", "Vietnamese New Year", "2027-01-01", "2027-12-31")).toContain("2027-02-06");
    expect(datesOf("CN", "Spring Festival", "2027-01-01", "2027-12-31")).toContain("2027-02-06");
  });
});

// ---------------------------------------------------------------------------
// (e), (f) A data file for every country.

/**
 * Every ISO 3166-1 alpha-2 code for a sovereign state or an inhabited
 * territory. Left out, as they have no permanent population: AQ Antarctica,
 * BV Bouvet Island, GS South Georgia and the South Sandwich Islands, HM Heard
 * Island and McDonald Islands, IO British Indian Ocean Territory, TF French
 * Southern Territories, UM United States Minor Outlying Islands.
 */
const ISO_COUNTRIES = `
AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM
BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX
CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF
GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS
IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV
LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC
NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA
RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN
VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

describe("holiday files", () => {
  it("lists 242 codes, each once", () => {
    expect(ISO_COUNTRIES).toHaveLength(242);
    expect(new Set(ISO_COUNTRIES).size).toBe(ISO_COUNTRIES.length);
  });

  it("has a file for every country the app knows", () => {
    const missing = Object.keys(COUNTRIES).filter((code) => !read(code));
    expect(missing).toEqual([]);
  });

  it("has a file for every sovereign state and inhabited territory", () => {
    const missing = ISO_COUNTRIES.filter((code) => !read(code));
    expect(missing).toEqual([]);
  });

  it("has a day off in every year in each of them", () => {
    const problems: string[] = [];
    for (const code of ISO_COUNTRIES) {
      const list = entries(code);
      if (list.length === 0) continue;
      for (let year = FROM; year <= TO; year++) {
        if (!list.some(([date, kind]) => date.startsWith(`${year}-`) && (kind === "public" || kind === "bank"))) {
          problems.push(`${code} ${year}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
