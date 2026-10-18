/**
 * The Theravada Buddhist calendars of mainland South-East Asia:
 *
 * - Thailand: date-holidays has Makha Bucha, Visakha Bucha, Asalha Bucha and
 *   Buddhist Lent (Khao Phansa) for 2026 only. They are computed here for
 *   every later year, and every public holiday on a weekend, the library's
 *   fixed ones included, gets its substitute day.
 * - Laos, Cambodia and Myanmar: date-holidays has no data at all, so each
 *   gets its whole official list of public holidays here, plus its biggest
 *   festivals.
 *
 * Thailand, Laos and Cambodia keep the same lunisolar calendar, computed by
 * thaiLunarDate() in festivals.mjs (ported from pythaidate, MIT licence).
 * Myanmar has its own, computed below with Yan Naing Aye's published
 * algorithm (ported from mmcal, MIT licence). Every rule was checked against
 * published dates from 2024 to 2027; the checks, sources and match rates are
 * in docs/holiday-dates.md, and src/lib/reference/theravada-holidays.test.ts
 * holds them.
 *
 * All arithmetic is on UTC dates or Julian day numbers, so the output never
 * depends on the machine's time zone.
 */
import Holidays from "date-holidays";
import { addDays, runs, thaiLeapMonthYear, thaiLunarDate, ymd } from "./festivals.mjs";
import { indiaEntries } from "./india.mjs";

// ---------------------------------------------------------------------------
// Shared pieces.

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JDN = 2440588;
const SAT = 6;
const SUN = 0;

const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";

function weekdayOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const isWeekend = (iso) => [SAT, SUN].includes(weekdayOf(iso));

function jdnOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS + UNIX_EPOCH_JDN;
}

function isoOfJdn(jdn) {
  return new Date((jdn - UNIX_EPOCH_JDN) * DAY_MS).toISOString().slice(0, 10);
}

/** Every day from first to last, inclusive. */
function daysFrom(first, last) {
  const days = [];
  for (let date = first; date <= last; date = addDays(date, 1)) days.push(date);
  return days;
}

/** Notes are sentences: each part gets a full stop, and they join with a space. */
function note(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(" ");
}

/**
 * Substitute days off, for countries where a holiday on a Saturday or Sunday
 * gives the next working day off. Holidays are taken in date order; each
 * substitute goes on the first weekday after its holiday that is not already
 * a day off or another holiday's substitute.
 *
 * @param {{ date: string, name: string, kind: string, note?: string }[]} holidays the ones that earn a substitute
 * @param {Set<string>} daysOff every day off, those holidays included
 */
function substitutes(holidays, daysOff, substituteNote) {
  const taken = new Set(daysOff);
  const result = [];
  for (const holiday of [...holidays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (!isWeekend(holiday.date)) continue;
    let date = addDays(holiday.date, 1);
    while (isWeekend(date) || taken.has(date)) date = addDays(date, 1);
    taken.add(date);
    result.push({
      date,
      name: `${holiday.name} (substitute day)`,
      kind: holiday.kind,
      note: note(substituteNote(holiday)),
    });
  }
  return result;
}

/** The dates a date-holidays rule names in a Gregorian year, as festivals.mjs reads them. */
const ruleCalendars = new Map();
function ruleDates(rule, year) {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "public" })) {
      throw new Error(`theravada.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}

// ---------------------------------------------------------------------------
// Thailand.

const TH_SOURCE =
  "Bank of Thailand holiday announcements, https://www.bot.or.th/; Thai lunar calendar computed as in pythaidate (MIT, Mark Hollow), https://github.com/hmmbug/pythaidate";

/** Years whose Buddhist holidays the government has already published (they match the computation). */
const TH_PUBLISHED = new Set([2026, 2027]);

const TH_CABINET = "The Cabinet confirms the date each year";
const TH_ALCOHOL = "Alcohol sales are banned";
const TH_SUBSTITUTE = "The Cabinet confirms substitute days each year";

/** The library's names, so that 2026 merges with its entries rather than doubling them. */
const TH_NOTES = {
  "Makha Bucha": "Buddhist holy day. Temples hold candle-lit processions in the evening",
  "Vesak Day": "Visakha Bucha, for the Buddha's birth, enlightenment and death. Temples hold candle-lit processions in the evening",
  "Asalha Puja": "Asalha Bucha, for the Buddha's first sermon. Temples hold candle-lit processions in the evening",
  "Buddhist Lent": "Khao Phansa, the start of the three-month rains retreat. Government offices close. Banks and most businesses stay open",
};

/**
 * Thailand's four Buddhist holidays in a Gregorian year: the full moons of the
 * 3rd, 6th and 8th months and the day after the last. In an adhikamasa year,
 * with its second 8th month, they move a month later: Makha Bucha to the 4th
 * month, Visakha Bucha to the 7th and Asalha Bucha to the second 8th.
 */
export function thaiBuddhistDays(year) {
  const leap = thaiLeapMonthYear(year);
  const asalha = thaiLunarDate(year, leap ? 88 : 8, 15);
  return [
    { date: thaiLunarDate(year, leap ? 4 : 3, 15), name: "Makha Bucha" },
    { date: thaiLunarDate(year, leap ? 7 : 6, 15), name: "Vesak Day" },
    { date: asalha, name: "Asalha Puja" },
    { date: addDays(asalha, 1), name: "Buddhist Lent" },
  ];
}

const thaiLibrary = new Holidays("TH");
const SONGKRAN = "Songkran Festival";

function thaiBuddhist(year) {
  const estimated = TH_PUBLISHED.has(year) ? "" : LUNAR;
  return thaiBuddhistDays(year).map(({ date, name }) => ({
    date,
    name,
    kind: "public",
    note: note(TH_NOTES[name], TH_ALCOHOL, TH_CABINET, estimated),
  }));
}

/** A year's Buddhist days and substitute days; a substitute for late December can fall in January. */
export function thaiEntries(year) {
  const inYear = (entry) => entry.date.startsWith(`${year}-`);
  return [...thaiBuddhist(year), ...thaiSubstitutes(year - 1).filter(inYear), ...thaiSubstitutes(year).filter(inYear)];
}

function thaiSubstitutes(year) {
  const buddhist = thaiBuddhist(year);

  // Thai practice: a public holiday on a Saturday or Sunday gives the next
  // working day off (Monday 7 December 2026 for King Bhumibol's Birthday on
  // Saturday 5 December). date-holidays has no Thai substitute days, so they
  // are made here for the library's fixed holidays and the computed Buddhist
  // ones together, each on the first weekday that is not already off.
  //
  // - Buddhist Lent, a day off for government offices only, gets no
  //   substitute (2024: Asalha Bucha on Saturday 20 July and Buddhist Lent on
  //   Sunday 21 July gave only Monday 22 July), and a substitute can share its
  //   day (2027: Asalha Bucha on Sunday 18 July, substitute Monday 19 July,
  //   Buddhist Lent).
  // - Songkran, 13 to 15 April, gets one substitute however many of its days
  //   fall on a weekend: the first working day after it (2024: Saturday 13
  //   and Sunday 14 April gave Tuesday 16 April).
  // - 31 December on a Sunday is made up after New Year's Day (2029: Tuesday
  //   2 January).
  const library = [];
  for (const holiday of thaiLibrary.getHolidays(year) ?? []) {
    // The library's own copies of the four (to 2026) are left to the computation.
    if (holiday.type === "public" && !(holiday.name in TH_NOTES)) {
      library.push({ date: holiday.date.slice(0, 10), name: holiday.name, kind: "public" });
    }
  }
  const earning = buddhist.filter((entry) => entry.name !== "Buddhist Lent");
  const daysOff = new Set([...library, ...earning].map((entry) => entry.date));
  daysOff.add(ymd(year + 1, 1, 1));
  // Last year's 31 December on a weekend took the first working day of January.
  if (isWeekend(ymd(year - 1, 12, 31))) daysOff.add(ymd(year, 1, 2));

  const songkran = library.filter((entry) => entry.name === SONGKRAN);
  const weekendSongkran = songkran.find((entry) => isWeekend(entry.date));
  const holidays = [
    ...earning,
    ...library.filter((entry) => entry.name !== SONGKRAN),
    // One stand-in for the whole span: its substitute goes after the span.
    ...(weekendSongkran ? [{ ...weekendSongkran }] : []),
  ];
  const extra = substitutes(holidays, daysOff, (holiday) =>
    holiday.name === SONGKRAN
      ? note("Part of Songkran falls on a weekend, so the next working day after it is off", TH_SUBSTITUTE)
      : note(`${holiday.name} falls on a weekend, so the next working day is off`, TH_SUBSTITUTE),
  );
  return extra;
}

// ---------------------------------------------------------------------------
// Laos.

const LA_SOURCE =
  "Prime Minister's Office public holiday announcements, reported by Vientiane Times, https://www.vientianetimes.org.la/; Lao lunar calendar computed as in pythaidate (MIT, Mark Hollow), https://github.com/hmmbug/pythaidate";

/** The Lao lunar calendar is Thailand's (checked against 2024 to 2026 festivals). */
export function laoEntries(year) {
  const fixed = [
    { date: ymd(year, 1, 1), name: "International New Year's Day", kind: "public" },
    { date: ymd(year, 3, 8), name: "International Women's Day", kind: "public" },
    ...[14, 15, 16].map((day) => ({
      date: ymd(year, 4, day),
      name: "Lao New Year",
      kind: "public",
      note: "Pi Mai Lao. Water throwing in the streets for three days, most of all in Luang Prabang. Offices and many shops close.",
    })),
    { date: ymd(year, 5, 1), name: "International Labour Day", kind: "public" },
    {
      date: ymd(year, 7, 20),
      name: "Lao Women's Union Day",
      kind: "optional",
      note: "A day off for women only.",
    },
    { date: ymd(year, 12, 2), name: "National Day", kind: "public" },
  ];

  const daysOff = new Set(fixed.filter((entry) => entry.kind === "public").map((entry) => entry.date));
  const extra = substitutes(fixed, daysOff, (holiday) =>
    holiday.kind === "optional"
      ? `${holiday.name} falls on a weekend, so women have the next working day off`
      : `${holiday.name} falls on a weekend, so the next working day is off`,
  );

  const thatLuang = thaiLunarDate(year, 12, 15);
  const okPhansa = thaiLunarDate(year, 11, 15);
  const festivals = [
    ...daysFrom(addDays(thatLuang, -4), thatLuang).map((date) => ({
      date,
      name: "Boun That Luang",
      kind: "festival",
      note: note(
        "Vientiane: the festival of the That Luang stupa, the most important in Laos. It ends on the full-moon morning, when thousands of monks receive alms at the stupa",
        runs(addDays(thatLuang, -4), thatLuang),
        LUNAR,
      ),
    })),
    {
      date: okPhansa,
      name: "Boun Ok Phansa",
      kind: "festival",
      note: note(
        "The end of Buddhist Lent. Candle-lit processions at temples, and illuminated boats and floating offerings on the Mekong in the evening",
        LUNAR,
      ),
    },
    {
      date: addDays(okPhansa, 1),
      name: "Vientiane Boat Racing Festival",
      kind: "festival",
      note: note("Vientiane: long-boat races on the Mekong, the day after Boun Ok Phansa", LUNAR),
    },
    {
      date: thaiLunarDate(year, 9, 29),
      name: "Boun Khao Padap Din",
      kind: "festival",
      note: note(
        "Before dawn, families leave parcels of rice and food at temples for the spirits of the dead",
        LUNAR,
      ),
    },
    {
      date: thaiLunarDate(year, 10, 15),
      name: "Boun Khao Salak",
      kind: "festival",
      note: note(
        "Fifteen days after Boun Khao Padap Din: more offerings for the dead, and gifts to monks handed out by lot",
        LUNAR,
      ),
    },
  ];

  return [...fixed, ...extra, ...festivals];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayMonth(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]}`;
}

// ---------------------------------------------------------------------------
// Cambodia.

const KH_SOURCE =
  "Royal Government of Cambodia sub-decrees on public holidays (No. 167 of 2025 for 2026), https://www.cncc.gov.kh/; Khmer lunar calendar computed as in pythaidate (MIT, Mark Hollow), https://github.com/hmmbug/pythaidate";

/**
 * Khmer New Year: from Moha Sangkran, the day the Sun enters Aries by the
 * Khmer (and Thai) astronomical rules, to Leung Sak, the first day of the new
 * Chula Sakaraj year, inclusive. That is three days, or four when there are
 * two Virak Vanabat days between them.
 *
 * Leung Sak falls this many days into April (the fraction is the time of day):
 * CS × 0.25875 − ⌊CS / 4 + 0.5⌋ + ⌊CS / 100 + 0.38⌋ − ⌊CS / 400 + 0.595⌋ − 5.53375,
 * CS being the new Chula Sakaraj year (the Gregorian year less 638), and
 * Moha Sangkran 2.165 days before it.
 */
export function khmerNewYear(year) {
  const cs = year - 638;
  const leungSak =
    cs * 0.25875 -
    Math.floor(cs / 4 + 0.5) +
    Math.floor(cs / 100 + 0.38) -
    Math.floor(cs / 400 + 0.595) -
    5.53375;
  const sangkran = leungSak - 2.165;
  return daysFrom(ymd(year, 4, Math.floor(sangkran)), ymd(year, 4, Math.floor(leungSak)));
}

export function khmerEntries(year) {
  const visak = thaiLunarDate(year, 6, 15);
  const pchumBen = [thaiLunarDate(year, 10, 29), thaiLunarDate(year, 10, 30), thaiLunarDate(year, 11, 1)];
  const waterFestival = thaiLunarDate(year, 12, 15);
  const newYear = khmerNewYear(year);

  return [
    { date: ymd(year, 1, 1), name: "International New Year's Day", kind: "public" },
    { date: ymd(year, 1, 7), name: "Victory over Genocide Day", kind: "public" },
    { date: ymd(year, 3, 8), name: "International Women's Day", kind: "public" },
    ...newYear.map((date) => ({
      date,
      name: "Khmer New Year",
      kind: "public",
      note: note(
        "Choul Chnam Thmey. Water and powder throwing, games at temples, and Angkor packed with Cambodian visitors. Phnom Penh empties as people go home to their provinces",
        runs(newYear[0], newYear[newYear.length - 1]),
        "The Ministry of Cults and Religion sets the days by the Khmer astronomical calendar. Estimated: the official days can differ by a day",
      ),
    })),
    { date: ymd(year, 5, 1), name: "International Labour Day", kind: "public" },
    {
      date: visak,
      name: "Visak Bochea",
      kind: "public",
      note: note("The Buddha's birth, enlightenment and death. Candle-lit processions at temples in the evening", LUNAR),
    },
    {
      date: addDays(visak, 4),
      name: "Royal Ploughing Ceremony",
      kind: "public",
      note: note("Royal oxen plough a field in Phnom Penh, and what they choose to eat foretells the harvest", LUNAR),
    },
    { date: ymd(year, 5, 14), name: "King Norodom Sihamoni's Birthday", kind: "public" },
    { date: ymd(year, 6, 18), name: "Queen Mother Norodom Monineath Sihanouk's Birthday", kind: "public" },
    { date: ymd(year, 9, 24), name: "Constitution Day", kind: "public" },
    ...pchumBen.map((date) => ({
      date,
      name: "Pchum Ben",
      kind: "public",
      note: note(
        "Festival of the ancestors: before dawn, families bring rice and food to temples for the spirits of the dead. Many people travel home to their provinces",
        runs(pchumBen[0], pchumBen[2]),
        LUNAR,
      ),
    })),
    { date: ymd(year, 10, 15), name: "King Father Norodom Sihanouk Commemoration Day", kind: "public" },
    { date: ymd(year, 10, 29), name: "King Norodom Sihamoni's Coronation Day", kind: "public" },
    { date: ymd(year, 11, 9), name: "Independence Day", kind: "public" },
    ...[-1, 0, 1].map((offset) => ({
      date: addDays(waterFestival, offset),
      name: "Water Festival",
      kind: "public",
      note: note(
        "Bon Om Touk. Boat races on the Tonle Sap river in Phnom Penh, with illuminated floats and fireworks at night. The capital is very crowded",
        runs(addDays(waterFestival, -1), addDays(waterFestival, 1)),
        LUNAR,
      ),
    })),
    { date: ymd(year, 12, 29), name: "Peace Day", kind: "public" },
  ];
}

// ---------------------------------------------------------------------------
// Myanmar.
//
// The Myanmar calendar, as Yan Naing Aye computes it in "Modern Myanmar
// Calendrical Calculations" (https://cool-emerald.blogspot.com/2013/06/
// algorithm-program-and-calculation-of.html). The functions below are ported
// from his mmcal (https://github.com/yan9a/mmcal, ceMmDateTime.js), keeping
// only the third era (1312 ME, 1950, and after) and its known exceptions.
// mmcal's licence follows:
//
//   MIT License
//
//   Copyright (c) 2018 Yan Naing Aye
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.

/** The Myanmar solar year and lunar month, in days, and the start of 0 ME (Julian day, Myanmar time). */
const MM_SOLAR_YEAR = 1577917828 / 4320000;
const MM_LUNAR_MONTH = 1577917828 / 53433336;
const MM_EPOCH = 1954168.050623;
/** The third era's full-moon offset and number of months that may hold the intercalation. */
const MM_WO = -0.5;
const MM_NM = 8;
/** Third-era exceptions in mmcal: a full-moon day moved, and watat years reversed. */
const MM_FULL_MOON_FIX = { 1377: 1 };
const MM_WATAT_FIX = new Set([1344, 1345]);

/** A Myanmar year's second-Waso full moon (Julian day number) and whether it is a watat year. */
function myanmarWatat(my) {
  if (my < 1312) throw new Error(`theravada.mjs: Myanmar year ${my} is before the third era`);
  const threshold = (MM_SOLAR_YEAR / 12 - MM_LUNAR_MONTH) * (12 - MM_NM);
  let excess = (MM_SOLAR_YEAR * (my + 3739)) % MM_LUNAR_MONTH;
  if (excess < threshold) excess += MM_LUNAR_MONTH;
  const fullMoon = Math.round(
    MM_SOLAR_YEAR * my + MM_EPOCH - excess + 4.5 * MM_LUNAR_MONTH + MM_WO + (MM_FULL_MOON_FIX[my] ?? 0),
  );
  let watat = excess >= MM_LUNAR_MONTH - (MM_SOLAR_YEAR / 12 - MM_LUNAR_MONTH) * MM_NM;
  if (MM_WATAT_FIX.has(my)) watat = !watat;
  return { fullMoon, watat };
}

/**
 * A Myanmar year's type (0 common, 1 little watat, 2 big watat), the Julian
 * day number of its 1st of Tagu less a day's worth of offset (tg1), and
 * whether the watat years around it are spaced as the rules require.
 */
function myanmarYear(my) {
  const year = myanmarWatat(my);
  let back = 0;
  let previous;
  do {
    back++;
    previous = myanmarWatat(my - back);
  } while (!previous.watat && back < 3);
  let type = 0;
  let consistent = true;
  if (year.watat) {
    const gap = (year.fullMoon - previous.fullMoon) % 354;
    type = Math.floor(gap / 31) + 1;
    consistent = gap === 30 || gap === 31;
  }
  return { type, tagu1: previous.fullMoon + 354 * back - 102, consistent };
}

/**
 * A Gregorian date on the Myanmar calendar: year (ME), month (1 Tagu, 2
 * Kason, 3 Nayon, 0 first Waso, 4 Waso, 5 Wagaung, 6 Tawthalin,
 * 7 Thadingyut, 8 Tazaungmon, 9 Nadaw, 10 Pyatho, 11 Tabodwe, 12 Tabaung,
 * 13 late Tagu, 14 late Kason), day of the month (1 to 30) and moon phase
 * (0 waxing, 1 full moon, 2 waning, 3 new moon).
 */
export function myanmarDate(iso) {
  const jdn = jdnOf(iso);
  const my = Math.floor((jdn - 0.5 - MM_EPOCH) / MM_SOLAR_YEAR);
  const year = myanmarYear(my);
  let dayCount = jdn - year.tagu1 + 1;
  const big = Math.floor(year.type / 2);
  const common = Math.floor(1 / (year.type + 1));
  const length = 354 + (1 - common) * 30 + big;
  const late = Math.floor((dayCount - 1) / length);
  dayCount -= late * length;
  const a = Math.floor((dayCount + 423) / 512);
  let month = Math.floor((dayCount - big * a + common * a * 30 + 29.26) / 29.544);
  const e = Math.floor((month + 12) / 16);
  const f = Math.floor((month + 11) / 16);
  const day = dayCount - Math.floor(29.544 * month - 29.26) - big * e + common * f * 30;
  month += f * 3 - e * 4 + 12 * late;
  const monthLength = 30 - (month % 2) + (month === 3 ? big : 0);
  const phase = Math.floor((day + 1) / 16) + Math.floor(day / 16) + Math.floor(day / monthLength);
  return { year: my, type: year.type, consistent: year.consistent, month, day, phase };
}

/**
 * Thingyan, the water festival that ends the Myanmar year, in a Gregorian
 * year: Akyo (the eve), Akya (the day Thingyan arrives, when the Sun enters
 * Aries by the Myanmar rules), the Akyat days between, Atat (the day it
 * leaves) and Myanmar New Year's Day.
 */
export function thingyan(year) {
  const atat = MM_SOLAR_YEAR * (year - 638) + MM_EPOCH;
  const akya = Math.round(atat - 2.169918982);
  const atatDay = Math.round(atat);
  return {
    days: daysFrom(isoOfJdn(akya - 1), isoOfJdn(atatDay)),
    newYear: isoOfJdn(atatDay + 1),
  };
}

const MM_SOURCE =
  "Government of Myanmar public holiday notifications (Leave and Holidays Act), as reported by Myanmar Labour News, https://myanmarlabournews.com/; Myanmar calendar computed with Yan Naing Aye's algorithm, mmcal (MIT), https://github.com/yan9a/mmcal";

/** Thingyan office holidays the government announced, where they run beyond the festival's own days. */
const THINGYAN_ANNOUNCED = { 2026: ["2026-04-11", "2026-04-19"] };

const MM_TABAUNG = 12;
const MM_KASON = 2;
const MM_WASO = 4;
const MM_THADINGYUT = 7;
const MM_TAZAUNGMON = 8;
const MM_PYATHO = 10;

/** India's Diwali, which Myanmar's Hindu community keeps as Deepavali. */
function deepavali(year) {
  return indiaEntries(year).find((entry) => entry.name === "Diwali")?.date;
}

export function myanmarEntries(year) {
  const entries = [
    { date: ymd(year, 1, 4), name: "Independence Day", kind: "public" },
    { date: ymd(year, 2, 12), name: "Union Day", kind: "public" },
    { date: ymd(year, 3, 2), name: "Peasants' Day", kind: "public" },
    { date: ymd(year, 3, 27), name: "Armed Forces Day", kind: "public" },
    { date: ymd(year, 5, 1), name: "Labour Day", kind: "public" },
    { date: ymd(year, 7, 19), name: "Martyrs' Day", kind: "public" },
    { date: ymd(year, 12, 25), name: "Christmas Day", kind: "public" },
  ];

  // Thingyan and the New Year.
  const festival = thingyan(year);
  const announced = THINGYAN_ANNOUNCED[year];
  const thingyanDays = announced
    ? daysFrom(announced[0], announced[1]).filter((date) => date !== festival.newYear)
    : festival.days;
  const thingyanNote = announced
    ? note(
        "The water festival: water throwing in the streets, pavilions and music, most of all in Yangon and Mandalay. Offices, banks and most shops close",
        `The government gave office holidays from ${dayMonth(announced[0])} to ${dayMonth(announced[1])}`,
      )
    : note(
        "The water festival: water throwing in the streets, pavilions and music, most of all in Yangon and Mandalay. Offices, banks and most shops close",
        "These are the festival's own days by the Myanmar calendar. The government sets the office holidays each year and usually adds more days around them",
      );
  for (const date of thingyanDays) {
    entries.push({ date, name: "Thingyan Water Festival", kind: "public", note: thingyanNote });
  }
  entries.push({
    date: festival.newYear,
    name: "Myanmar New Year",
    kind: "public",
    note: "The first day of the Myanmar year, after Thingyan. Many people visit pagodas and monasteries.",
  });

  // The lunar holidays, read off the Myanmar calendar day by day.
  for (let date = ymd(year, 1, 1); date <= ymd(year, 12, 31); date = addDays(date, 1)) {
    const { month, day, phase } = myanmarDate(date);
    const fullMoon = phase === 1;
    if (month === MM_TABAUNG && fullMoon) {
      entries.push({
        date,
        name: "Full Moon Day of Tabaung",
        kind: "public",
        note: note("Pagoda festivals, the biggest at the Shwedagon in Yangon", LUNAR),
      });
    } else if (month === MM_KASON && fullMoon) {
      entries.push({
        date,
        name: "Full Moon Day of Kasong",
        kind: "public",
        note: note("Buddha Day: people pour water on the Bodhi trees at pagodas", LUNAR),
      });
    } else if (month === MM_WASO && fullMoon) {
      entries.push({
        date,
        name: "Full Moon Day of Waso",
        kind: "public",
        note: note("The start of Buddhist Lent. People offer robes to monks", LUNAR),
      });
    } else if (month === MM_THADINGYUT && day >= 14 && day <= 16) {
      entries.push({
        date,
        name: "Thadingyut",
        kind: "public",
        note: note(
          "The festival of lights at the end of Buddhist Lent, three days off around the full moon. Homes, pagodas and streets are lit with candles and lanterns",
          LUNAR,
        ),
      });
    } else if (month === MM_TAZAUNGMON && (day === 14 || day === 15)) {
      entries.push({
        date,
        name: "Tazaungdaing",
        kind: "public",
        note: note(
          "The Tazaungmon full moon, with the day before off too. Lights, robe-weaving contests at pagodas, and the hot-air balloon festival in Taunggyi",
          LUNAR,
        ),
      });
    } else if (month === MM_TAZAUNGMON && day === 25) {
      entries.push({
        date,
        name: "National Day",
        kind: "public",
        note: note("The 10th day after the Tazaungmon full moon, marking the 1920 student strike", LUNAR),
      });
    } else if (month === MM_PYATHO && day === 1) {
      entries.push({
        date,
        name: "Kayin New Year",
        kind: "public",
        note: note("The Karen (Kayin) New Year, the 1st day of Pyatho", LUNAR),
      });
    }
  }

  // Eid al-Adha: Myanmar kept it a day after date-holidays' Hijri date in 2025
  // and 2026 (7 June 2025, 28 May 2026), so it is moved by a day.
  for (const date of [...ruleDates("10 Dhu al-Hijjah", year - 1), ...ruleDates("10 Dhu al-Hijjah", year)]) {
    const local = addDays(date, 1);
    if (!local.startsWith(`${year}-`)) continue;
    entries.push({
      date: local,
      name: "Feast of the Sacrifice (Eid al-Adha)",
      kind: "public",
      note: `Myanmar usually keeps it a day after Saudi Arabia. The government confirms the date shortly before. ${ISLAMIC}`,
    });
  }

  const diwali = deepavali(year);
  if (diwali) {
    entries.push({
      date: diwali,
      name: "Deepavali",
      kind: "public",
      note: note("The Hindu festival of lights. The government confirms the date shortly before", LUNAR),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// The supplements.

const supplements = [
  { country: "TH", source: TH_SOURCE, entries: thaiEntries },
  { country: "LA", source: LA_SOURCE, entries: laoEntries },
  { country: "KH", source: KH_SOURCE, entries: khmerEntries },
  { country: "MM", source: MM_SOURCE, entries: myanmarEntries },
];

export default supplements;
