import Holidays from "date-holidays";
import { describe, expect, it } from "vitest";
import { supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  FESTIVALS,
  chineseDate,
  easter,
  festivalEntries,
  nikiniPoya,
  orthodoxEaster,
  poyaNear,
  thaiLunarDate,
} from "../../../scripts/holiday-supplements/festivals.mjs";

/**
 * The festival rules in scripts/holiday-supplements/festivals.mjs, checked
 * against dates organisers, tourist boards and the press published. Where each
 * date comes from, and the match rates, are in docs/holiday-dates.md.
 */

const FROM = 2026;
const TO = 2050;

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function festival(country: string, name: string) {
  const found = FESTIVALS.find((entry) => entry.country === country && entry.name === name);
  if (!found) throw new Error(`no festival ${country} ${name}`);
  return found;
}

/** The days a festival has in a year. */
function datesOf(country: string, name: string, year: number): Set<string> {
  return new Set(festivalEntries(festival(country, name), year).map((entry) => entry.date));
}

/** The run of consecutive days that contains a date, which may cross into the next year. */
function runAround(country: string, name: string, date: string): [string, string] | undefined {
  const year = Number(date.slice(0, 4));
  const dates = new Set([...datesOf(country, name, year - 1), ...datesOf(country, name, year), ...datesOf(country, name, year + 1)]);
  if (!dates.has(date)) return undefined;
  let first = date;
  while (dates.has(addDays(first, -1))) first = addDays(first, -1);
  let last = date;
  while (dates.has(addDays(last, 1))) last = addDays(last, 1);
  return [first, last];
}

/**
 * [country, name, first, last, how]: a published edition. "exact" (the
 * default) means the rule gives exactly those days; "within" that the rule's
 * days lie inside a longer published span; "covers" that the rule's days
 * include a shorter published one (the main nights of a longer festival);
 * "starts" that only the first day was published.
 */
type How = "exact" | "within" | "covers" | "starts";
type Published = [country: string, name: string, first: string, last: string, how?: How];

const PUBLISHED: Published[] = [
  // Europe
  ["IT", "Venice Carnival", "2025-02-22", "2025-03-04"],
  ["IT", "Venice Carnival", "2026-02-07", "2026-02-17"],
  ["IT", "Battle of the Oranges", "2025-03-02", "2025-03-04"],
  ["IT", "Battle of the Oranges", "2026-02-15", "2026-02-17"],
  ["IT", "Palio di Siena", "2026-07-02", "2026-07-02"],
  ["IT", "Palio di Siena", "2026-08-16", "2026-08-16"],
  ["IT", "Festa del Redentore", "2026-07-18", "2026-07-19"],
  ["IT", "Festa del Redentore", "2027-07-17", "2027-07-18"],
  ["IT", "Regata Storica", "2026-09-06", "2026-09-06"],
  ["ES", "Las Fallas", "2026-03-15", "2026-03-19"],
  ["ES", "Holy Week processions", "2025-04-13", "2025-04-20"],
  ["ES", "Holy Week processions", "2026-03-29", "2026-04-05"],
  ["ES", "San Fermín", "2025-07-06", "2025-07-14"],
  ["ES", "San Fermín", "2026-07-06", "2026-07-14"],
  ["ES", "La Tomatina", "2025-08-27", "2025-08-27"],
  ["ES", "La Tomatina", "2026-08-26", "2026-08-26"],
  ["ES", "Romería del Rocío", "2026-05-22", "2026-05-25"],
  ["PT", "São João do Porto", "2026-06-23", "2026-06-24"],
  ["PT", "Santo António", "2026-06-12", "2026-06-13"],
  ["FR", "Fête de la Musique", "2026-06-21", "2026-06-21"],
  ["FR", "Fête des Lumières", "2024-12-05", "2024-12-08", "within"],
  ["FR", "Fête des Lumières", "2026-12-05", "2026-12-08", "within"],
  ["DE", "Oktoberfest", "2024-09-21", "2024-10-06"],
  ["DE", "Oktoberfest", "2026-09-19", "2026-10-04"],
  ["DE", "Oktoberfest", "2027-09-18", "2027-10-03"],
  ["DE", "Oktoberfest", "2028-09-16", "2028-10-03"],
  ["DE", "Oktoberfest", "2029-09-22", "2029-10-07"],
  ["DE", "Cologne Carnival", "2025-02-27", "2025-03-04"],
  ["DE", "Cologne Carnival", "2026-02-12", "2026-02-17"],
  ["DE", "Christmas markets", "2025-11-28", "2025-12-24"],
  ["DE", "Kiel Week", "2026-06-20", "2026-06-28"],
  ["DE", "Kiel Week", "2027-06-19", "2027-06-27"],
  ["CZ", "Christmas markets", "2024-11-30", "2025-01-06"],
  ["CZ", "Christmas markets", "2025-11-29", "2026-01-06"],
  ["CH", "Basel Fasnacht", "2025-03-10", "2025-03-12"],
  ["CH", "Basel Fasnacht", "2026-02-23", "2026-02-25"],
  ["CH", "Lucerne Carnival", "2025-02-27", "2025-03-04"],
  ["CH", "Lucerne Carnival", "2026-02-12", "2026-02-17"],
  ["CH", "Lucerne Carnival", "2027-02-04", "2027-02-09"],
  ["CH", "Sechseläuten", "2014-04-28", "2014-04-28"],
  ["CH", "Sechseläuten", "2017-04-24", "2017-04-24"],
  ["CH", "Sechseläuten", "2026-04-20", "2026-04-20"],
  ["BE", "Binche Carnival", "2025-03-02", "2025-03-04"],
  ["BE", "Binche Carnival", "2026-02-15", "2026-02-17"],
  ["BE", "Gentse Feesten", "2025-07-18", "2025-07-27"],
  ["BE", "Gentse Feesten", "2026-07-17", "2026-07-26"],
  ["BE", "Gentse Feesten", "2027-07-16", "2027-07-25"],
  ["NL", "Keukenhof tulip season", "2026-03-19", "2026-05-10"],
  ["GB", "Up Helly Aa", "2025-01-28", "2025-01-28"],
  ["GB", "Up Helly Aa", "2026-01-27", "2026-01-27"],
  ["GB", "Cheese rolling", "2026-05-25", "2026-05-25"],
  ["GB", "Glastonbury Festival", "2027-06-23", "2027-06-27"],
  ["GB", "National Eisteddfod", "2026-08-01", "2026-08-08"],
  ["GB", "National Eisteddfod", "2027-07-31", "2027-08-07"],
  ["GB", "Edinburgh Festival Fringe", "2026-08-07", "2026-08-31"],
  ["GB", "Edinburgh Festival Fringe", "2027-08-06", "2027-08-30"],
  ["GB", "Notting Hill Carnival", "2025-08-24", "2025-08-25"],
  ["GB", "Notting Hill Carnival", "2026-08-30", "2026-08-31"],
  ["GB", "Braemar Gathering", "2026-09-05", "2026-09-05"],
  ["GB", "Lewes Bonfire", "2023-11-04", "2023-11-04"],
  ["GB", "Lewes Bonfire", "2025-11-05", "2025-11-05"],
  ["GB", "Edinburgh's Hogmanay", "2025-12-29", "2026-01-01"],
  ["IE", "Puck Fair", "2026-08-10", "2026-08-12"],
  ["GR", "Patras Carnival", "2025-03-01", "2025-03-02"],
  ["GR", "Patras Carnival", "2026-02-21", "2026-02-22"],
  ["RU", "Maslenitsa", "2025-02-24", "2025-03-02"],
  ["RU", "Maslenitsa", "2026-02-16", "2026-02-22"],
  ["HU", "Busójárás", "2025-02-27", "2025-03-04"],
  ["HU", "Busójárás", "2026-02-12", "2026-02-17"],
  ["AM", "Vardavar", "2014-07-27", "2014-07-27"],
  ["AM", "Vardavar", "2026-07-12", "2026-07-12"],
  ["TR", "Şeb-i Arus", "2025-12-07", "2025-12-17"],
  // Middle East and Africa
  ["EG", "Abu Simbel Sun Festival", "2026-02-22", "2026-02-22"],
  ["EG", "Abu Simbel Sun Festival", "2026-10-22", "2026-10-22"],
  ["ET", "Timkat", "2024-01-19", "2024-01-20"],
  // Asia
  ["JP", "Sapporo Snow Festival", "2026-02-04", "2026-02-11"],
  ["JP", "Sapporo Snow Festival", "2027-02-04", "2027-02-11"],
  ["JP", "Takayama Festival", "2025-04-14", "2025-04-15"],
  ["JP", "Takayama Festival", "2026-10-09", "2026-10-10"],
  ["JP", "Aoi Matsuri", "2026-05-15", "2026-05-15"],
  ["JP", "Sanja Matsuri", "2026-05-15", "2026-05-17"],
  ["JP", "Hakata Gion Yamakasa", "2026-07-01", "2026-07-15"],
  ["JP", "Gion Matsuri", "2026-07-14", "2026-07-17"],
  ["JP", "Gion Matsuri", "2026-07-21", "2026-07-24"],
  ["JP", "Tenjin Matsuri", "2025-07-24", "2025-07-25"],
  ["JP", "Tenjin Matsuri", "2026-07-24", "2026-07-25"],
  ["JP", "Sumida River Fireworks", "2026-07-25", "2026-07-25"],
  ["JP", "Aomori Nebuta Matsuri", "2025-08-02", "2025-08-07"],
  ["JP", "Aomori Nebuta Matsuri", "2026-08-02", "2026-08-07"],
  ["JP", "Akita Kanto Matsuri", "2025-08-03", "2025-08-06"],
  ["JP", "Akita Kanto Matsuri", "2026-08-03", "2026-08-06"],
  ["JP", "Sendai Tanabata Matsuri", "2025-08-06", "2025-08-08"],
  ["JP", "Sendai Tanabata Matsuri", "2026-08-06", "2026-08-08"],
  ["JP", "Yosakoi Matsuri", "2026-08-09", "2026-08-12"],
  ["JP", "Awa Odori", "2025-08-11", "2025-08-15", "within"],
  ["JP", "Awa Odori", "2026-08-11", "2026-08-15", "within"],
  ["JP", "Obon", "2025-08-13", "2025-08-16"],
  ["JP", "Gozan Okuribi", "2025-08-16", "2025-08-16"],
  ["JP", "Gozan Okuribi", "2026-08-16", "2026-08-16"],
  ["JP", "Jidai Matsuri", "2026-10-22", "2026-10-22"],
  ["CN", "Harbin Ice and Snow Festival", "2026-01-05", "2026-01-05", "starts"],
  ["CN", "Lantern Festival", "2025-02-12", "2025-02-12"],
  ["CN", "Lantern Festival", "2026-03-03", "2026-03-03"],
  ["CN", "Water-Splashing Festival", "2024-04-13", "2024-04-15"],
  ["CN", "Water-Splashing Festival", "2025-04-13", "2025-04-15"],
  ["HK", "Cheung Chau Bun Festival", "2025-05-05", "2025-05-05"],
  ["HK", "Cheung Chau Bun Festival", "2026-05-24", "2026-05-24"],
  ["HK", "Tai Hang Fire Dragon Dance", "2026-09-24", "2026-09-26"],
  ["TW", "Lantern Festival", "2026-03-03", "2026-03-03"],
  ["TH", "Lunar New Year", "2025-01-29", "2025-01-29"],
  ["TH", "Lunar New Year", "2026-02-17", "2026-02-17"],
  ["TH", "Phuket Vegetarian Festival", "2025-10-21", "2025-10-29"],
  ["TH", "Phuket Vegetarian Festival", "2026-10-10", "2026-10-18"],
  ["TH", "Yi Peng", "2025-11-05", "2025-11-06"],
  ["TH", "Yi Peng", "2026-11-24", "2026-11-25"],
  ["PH", "Feast of the Black Nazarene", "2026-01-09", "2026-01-09"],
  ["PH", "Sinulog", "2025-01-19", "2025-01-19"],
  ["PH", "Sinulog", "2026-01-18", "2026-01-18"],
  ["PH", "Ati-Atihan", "2025-01-19", "2025-01-19"],
  ["PH", "Dinagyang", "2025-01-26", "2025-01-26"],
  ["PH", "Dinagyang", "2026-01-25", "2026-01-25"],
  ["ID", "Galungan", "2025-04-23", "2025-04-23"],
  ["ID", "Galungan", "2025-11-19", "2025-11-19"],
  ["ID", "Galungan", "2026-06-17", "2026-06-17"],
  ["ID", "Galungan", "2027-01-13", "2027-01-13"],
  ["ID", "Galungan", "2027-08-11", "2027-08-11"],
  ["ID", "Kuningan", "2025-05-03", "2025-05-03"],
  ["ID", "Kuningan", "2025-11-29", "2025-11-29"],
  ["ID", "Kuningan", "2026-06-27", "2026-06-27"],
  ["ID", "Kuningan", "2027-01-23", "2027-01-23"],
  ["ID", "Kuningan", "2027-08-21", "2027-08-21"],
  ["LK", "Kandy Esala Perahera", "2024-08-10", "2024-08-20"],
  ["LK", "Kandy Esala Perahera", "2025-07-30", "2025-08-09"],
  ["LK", "Kandy Esala Perahera", "2026-08-18", "2026-08-28"],
  ["MN", "Naadam", "2026-07-10", "2026-07-15"],
  ["SG", "Mid-Autumn Festival", "2025-10-06", "2025-10-06"],
  ["SG", "Mid-Autumn Festival", "2026-09-25", "2026-09-25"],
  // The Americas
  ["US", "Rose Parade", "2023-01-02", "2023-01-02"],
  ["US", "Rose Parade", "2025-01-01", "2025-01-01"],
  ["US", "Mardi Gras in New Orleans", "2025-02-27", "2025-03-04"],
  ["US", "Mardi Gras in New Orleans", "2026-02-12", "2026-02-17"],
  ["US", "Merrie Monarch Festival", "2025-04-20", "2025-04-26"],
  ["US", "Merrie Monarch Festival", "2026-04-05", "2026-04-11"],
  ["US", "Coachella", "2026-04-10", "2026-04-12"],
  ["US", "Coachella", "2027-04-16", "2027-04-18"],
  ["US", "Burning Man", "2025-08-24", "2025-09-01"],
  ["US", "Burning Man", "2026-08-30", "2026-09-07"],
  ["US", "Albuquerque International Balloon Fiesta", "2025-10-04", "2025-10-12"],
  ["US", "Albuquerque International Balloon Fiesta", "2026-10-03", "2026-10-11"],
  ["PR", "Fiestas de la Calle San Sebastián", "2026-01-15", "2026-01-18"],
  ["CA", "Carnaval de Québec", "2026-02-06", "2026-02-15"],
  ["CA", "Carnaval de Québec", "2027-02-05", "2027-02-14"],
  ["CA", "Calgary Stampede", "2025-07-04", "2025-07-13"],
  ["CA", "Calgary Stampede", "2026-07-03", "2026-07-12"],
  ["CA", "Calgary Stampede", "2027-07-09", "2027-07-18"],
  ["CA", "Calgary Stampede", "2028-07-07", "2028-07-16"],
  ["CA", "Calgary Stampede", "2029-07-06", "2029-07-15"],
  ["MX", "Guelaguetza", "2025-07-21", "2025-07-21"],
  ["MX", "Guelaguetza", "2025-07-28", "2025-07-28"],
  ["MX", "Guelaguetza", "2026-07-20", "2026-07-20"],
  ["MX", "Guelaguetza", "2026-07-27", "2026-07-27"],
  ["MX", "Day of the Dead", "2026-10-31", "2026-11-02"],
  ["MX", "Las Posadas", "2025-12-16", "2025-12-24"],
  ["MX", "Night of the Radishes", "2026-12-23", "2026-12-23"],
  ["GT", "Holy Week in Antigua", "2025-04-13", "2025-04-20"],
  ["GT", "Holy Week in Antigua", "2026-03-29", "2026-04-05"],
  ["GT", "Sumpango Giant Kite Festival", "2025-11-01", "2025-11-01"],
  ["BS", "Junkanoo", "2025-12-26", "2025-12-26"],
  ["BS", "Junkanoo", "2026-01-01", "2026-01-01"],
  ["TT", "Trinidad Carnival", "2025-03-03", "2025-03-04"],
  ["TT", "Trinidad Carnival", "2026-02-16", "2026-02-17"],
  ["CO", "Carnaval de Negros y Blancos", "2025-01-02", "2025-01-06"],
  ["CO", "Carnaval de Negros y Blancos", "2026-01-02", "2026-01-07", "within"],
  ["CO", "Carnaval de Barranquilla", "2025-03-01", "2025-03-04"],
  ["CO", "Carnaval de Barranquilla", "2026-02-14", "2026-02-17"],
  ["PE", "Corpus Christi in Cusco", "2026-06-03", "2026-06-04"],
  ["PE", "Inti Raymi", "2025-06-24", "2025-06-24"],
  ["PE", "Inti Raymi", "2026-06-24", "2026-06-24"],
  ["BO", "Oruro Carnival", "2025-03-01", "2025-03-04"],
  ["BO", "Oruro Carnival", "2026-02-14", "2026-02-17"],
  ["BR", "Rio Carnival", "2025-03-02", "2025-03-04", "covers"],
  ["BR", "Rio Carnival", "2026-02-13", "2026-02-18"],
  ["BR", "Parintins Folklore Festival", "2025-06-27", "2025-06-29"],
  ["BR", "Parintins Folklore Festival", "2026-06-26", "2026-06-28"],
  ["BR", "Círio de Nazaré", "2025-10-11", "2025-10-12"],
  ["BR", "Círio de Nazaré", "2026-10-10", "2026-10-11"],
  // Oceania
  ["AU", "Sydney Gay and Lesbian Mardi Gras Parade", "2026-02-28", "2026-02-28"],
  ["AU", "Sydney Gay and Lesbian Mardi Gras Parade", "2027-03-06", "2027-03-06"],
  ["AU", "Moomba", "2025-03-06", "2025-03-10"],
  ["AU", "Moomba", "2026-03-05", "2026-03-09"],
  ["AU", "Moomba", "2027-03-04", "2027-03-08"],
  ["AU", "Vivid Sydney", "2026-05-22", "2026-06-13"],
  ["AU", "Vivid Sydney", "2027-05-28", "2027-06-19"],
];

/** Loy Krathong as the Tourism Authority of Thailand and others announced it. */
const LOY_KRATHONG: Record<number, string> = {
  2014: "2014-11-06",
  2015: "2015-11-25",
  2016: "2016-11-14",
  2017: "2017-11-03",
  2018: "2018-11-22",
  2019: "2019-11-11",
  2020: "2020-10-31",
  2021: "2021-11-19",
  2022: "2022-11-08",
  2023: "2023-11-27",
  2024: "2024-11-15",
  2025: "2025-11-05",
  2026: "2026-11-24",
  2027: "2027-11-13",
};

/** Sri Lanka's 2026 full moon poya days, as gazetted (date-holidays' LK data is that year's). */
const POYA_2026 = [
  "2026-01-03", "2026-02-01", "2026-03-02", "2026-04-01", "2026-05-01", "2026-05-30", "2026-06-29",
  "2026-07-29", "2026-08-27", "2026-09-26", "2026-10-25", "2026-11-24", "2026-12-23",
];

/** Nikini poya: the last night of the Kandy Perahera's Randoli processions. */
const NIKINI: Record<number, string> = {
  2022: "2022-08-11",
  2023: "2023-08-30",
  2024: "2024-08-19",
  2025: "2025-08-08",
  2026: "2026-08-27",
};

function libraryDate(rule: string, year: number): string {
  const calendar = new Holidays();
  calendar.setHoliday(rule, { name: { en: rule }, type: "observance" });
  return (calendar.getHolidays(year) ?? [])[0]?.date.slice(0, 10) ?? "";
}

describe("festival supplement", () => {
  it("is a valid supplement for every year the calendar covers", () => {
    const checked = supplementEntries(supplements, "festivals.mjs", FROM, TO);
    expect(checked).toHaveLength(FESTIVALS.length);
    for (const supplement of checked) {
      expect(supplement.country).toMatch(/^[A-Z]{2}$/);
      expect(supplement.source).toMatch(/https:\/\//);
    }
  });

  it("covers 80 to 150 festivals, outside India, as festivals (Naadam is a public holiday)", () => {
    expect(FESTIVALS.length).toBeGreaterThanOrEqual(80);
    expect(FESTIVALS.length).toBeLessThanOrEqual(150);
    expect(FESTIVALS.some((entry) => entry.country === "IN")).toBe(false);
    for (const entry of FESTIVALS) {
      expect(entry.kind ?? "festival").toBe(entry.name === "Naadam" ? "public" : "festival");
    }
  });

  it("names each festival once per country", () => {
    const keys = FESTIVALS.map((entry) => `${entry.country} ${entry.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives each year only its own days, once each, with a note", () => {
    for (let year = FROM; year <= TO; year++) {
      const seen = new Set<string>();
      for (const entry of FESTIVALS) {
        for (const day of festivalEntries(entry, year)) {
          expect(day.date.startsWith(`${year}-`)).toBe(true);
          const key = `${entry.country}|${day.date}|${day.name}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          expect(day.note).toMatch(/\.$/);
        }
      }
    }
  });

  it("says when a festival that runs several days runs", () => {
    const days = festivalEntries(festival("DE", "Oktoberfest"), 2027);
    expect(days).toHaveLength(16);
    expect(days.every((day) => day.note.includes("Runs 18 September to 3 October."))).toBe(true);
    const hogmanay = festivalEntries(festival("GB", "Edinburgh's Hogmanay"), 2027).map((day) => day.note);
    expect(hogmanay[0]).toContain("Runs 29 December to 1 January.");
    expect(festivalEntries(festival("ES", "La Tomatina"), 2027)[0].note).not.toContain("Runs");
  });

  it("lists organiser-set festivals only for the years already announced", () => {
    expect(festivalEntries(festival("GB", "Glastonbury Festival"), 2026)).toEqual([]);
    expect(festivalEntries(festival("GB", "Glastonbury Festival"), 2028)).toEqual([]);
    expect(festivalEntries(festival("US", "Coachella"), 2028)).toEqual([]);
    expect(festivalEntries(festival("JP", "Sapporo Snow Festival"), 2028)).toEqual([]);
    expect(festivalEntries(festival("GB", "Edinburgh Festival Fringe"), 2028)).toEqual([]);
  });

  it("matches every published edition", () => {
    const wrong: string[] = [];
    for (const [country, name, first, last, how = "exact"] of PUBLISHED) {
      const run = how === "within" ? findRunInside(country, name, first, last) : runAround(country, name, first);
      const ok =
        run !== undefined &&
        (how === "exact"
          ? run[0] === first && run[1] === last
          : how === "starts"
            ? run[0] === first
            : how === "covers"
              ? run[0] <= first && run[1] >= last
              : true);
      if (!ok) wrong.push(`${country} ${name}: published ${first} to ${last} (${how}), rule gives ${run?.join(" to ") ?? "nothing"}`);
    }
    expect(wrong).toEqual([]);
  });

  it("matches Loy Krathong in 12 of the 14 years announced, and is never more than a day out", () => {
    let matches = 0;
    for (const [year, published] of Object.entries(LOY_KRATHONG)) {
      const computed = thaiLunarDate(Number(year), 12, 15);
      if (computed === published) matches++;
      else expect(computed).toBe(addDays(published, 1));
    }
    expect(matches).toBe(12);
  });

  it("finds Sri Lanka's poya days", () => {
    for (const date of POYA_2026) expect(poyaNear(date)).toBe(date);
    for (const [year, date] of Object.entries(NIKINI)) expect(nikiniPoya(Number(year))).toBe(date);
  });

  it("computes Easter as date-holidays does", () => {
    for (let year = FROM; year <= TO; year++) {
      expect(easter(year)).toBe(libraryDate("easter", year));
      expect(orthodoxEaster(year)).toBe(libraryDate("orthodox", year));
    }
  });

  it("reads the Chinese calendar, with 2033's leap month in the right place", () => {
    expect(chineseDate(2025, 1, 1)).toBe("2025-01-29");
    expect(chineseDate(2026, 1, 1)).toBe("2026-02-17");
    expect(chineseDate(2026, 8, 15)).toBe("2026-09-25");
    expect(chineseDate(2033, 8, 15)).toBe("2033-09-08");
    // Mid-Autumn falls between 7 September and 6 October all century.
    for (let year = FROM; year <= TO; year++) {
      const midAutumn = chineseDate(year, 8, 15);
      expect(midAutumn >= `${year}-09-07` && midAutumn <= `${year}-10-06`).toBe(true);
    }
  });
});

/** A run of the rule's days that lies inside a published span. */
function findRunInside(country: string, name: string, first: string, last: string): [string, string] | undefined {
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const run = runAround(country, name, date);
    if (run && run[0] >= first && run[1] <= last) return run;
  }
  return undefined;
}
