/**
 * Festivals and big events worldwide that are not days off, so date-holidays
 * does not carry them: carnivals, matsuri, lantern and water festivals,
 * pilgrimages, Christmas markets and a few music and arts festivals. India is
 * left to india.mjs.
 *
 * Every festival is a rule computed for any year from 2026 to 2050:
 *
 * - a fixed date or range (San Fermín, 6 to 14 July);
 * - the nth weekday of a month (La Tomatina, the last Wednesday of August);
 * - a day relative to Easter, Western or Orthodox (every carnival);
 * - a Chinese lunisolar date, from the generator's astronomical Chinese
 *   calendar (the Lantern Festival, 15th of the 1st month);
 * - the Thai lunar calendar (Loy Krathong, the 15th waxing day of the 12th
 *   month), computed with the Chulasakarat rules below, ported from
 *   pythaidate (MIT licence, notice below). theravada.mjs uses the same
 *   calendar for the Buddhist holidays of Thailand, Laos and Cambodia;
 * - the full moon a Sri Lankan almanac names Nikini, for the Kandy Perahera;
 * - the Balinese 210-day Pawukon cycle (Galungan).
 *
 * A festival whose organiser sets the dates each year with no rule (most music
 * festivals) lists only the years already announced, and nothing after.
 *
 * A festival that runs several days has one entry per day, all with the same
 * name, and the note says when it runs ("Runs 7 to 17 February"), so a trip
 * that starts in the middle still finds it. Every rule was checked against
 * published editions (two or more, or one plus the organiser's own statement
 * of the rule); the checks and match rates are in docs/holiday-dates.md, and
 * src/lib/reference/festivals.test.ts holds them.
 *
 * All arithmetic is on UTC dates, so the output never depends on the
 * machine's time zone.
 */
import { lunisolarDate } from "../build-holidays.mjs";

// ---------------------------------------------------------------------------
// Dates. Plain "YYYY-MM-DD" strings, computed in UTC.

const DAY_MS = 86_400_000;
const MONTHS = [
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
const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const FRI = 5;
const SAT = 6;

function isoOfMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A date from its parts. Overflowing days roll into the next month. */
export function ymd(year, month, day) {
  return isoOfMs(Date.UTC(year, month - 1, day));
}

function parts(iso) {
  return iso.split("-").map(Number);
}

export function addDays(iso, days) {
  const [year, month, day] = parts(iso);
  return ymd(year, month, day + days);
}

function weekdayOf(iso) {
  const [year, month, day] = parts(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The weekday on or after a date. */
function onOrAfter(iso, weekday) {
  return addDays(iso, (weekday - weekdayOf(iso) + 7) % 7);
}

/** The weekday on or before a date. */
function onOrBefore(iso, weekday) {
  return addDays(iso, -((weekdayOf(iso) - weekday + 7) % 7));
}

/** The nth weekday of a month: 1 is the first, -1 the last. */
export function nthWeekday(year, month, weekday, n) {
  if (n > 0) return addDays(onOrAfter(ymd(year, month, 1), weekday), 7 * (n - 1));
  return addDays(onOrBefore(ymd(year, month + 1, 0), weekday), -7 * (-n - 1));
}

/** Western (Gregorian) Easter Sunday: the anonymous Gregorian computus. */
export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/**
 * Orthodox Easter Sunday as a Gregorian date: the Julian computus, plus the
 * 13 days the Julian calendar trails by from 1900 to 2099.
 */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(ymd(year, month, day), 13);
}

const fromEaster = (year, days) => addDays(easter(year), days);
const fromOrthodoxEaster = (year, days) => addDays(orthodoxEaster(year), days);

/** The first Sunday of Advent: the fourth Sunday before Christmas Day. */
function adventSunday(year) {
  return addDays(onOrBefore(ymd(year, 12, 24), SUN), -21);
}

// ---------------------------------------------------------------------------
// The Chinese lunisolar calendar, from the generator.

/**
 * The Gregorian date of a day in a Chinese month (not a leap month) of the
 * lunar year that starts in a Gregorian year. The generator recomputes the
 * calendar astronomically (Purple Mountain Observatory rules, at UTC+8),
 * because date-holidays puts 2033's leap month after the 7th month instead of
 * the 11th and lets its day count slip a day in some months (Mid-Autumn 2039,
 * the Lantern Festival in 2044, 2045 and 2050).
 */
export function chineseDate(year, month, day) {
  const date = lunisolarDate("chinese", year, month, day);
  if (!date) throw new Error(`festivals.mjs: no Chinese date for ${month}/${day} in ${year}`);
  return date;
}

// ---------------------------------------------------------------------------
// The Thai lunar calendar.
//
// The Chulasakarat (Suriyayatra) rules: a year's mean lunar and solar
// positions from the epoch decide whether it has an extra month (adhikamasa)
// or an extra day (adhikavara), with the adjustments that keep consecutive
// years' weekdays in step. This follows Eade, The Calendrical Systems of
// Mainland South-East Asia, as implemented in pythaidate
// (https://github.com/hmmbug/pythaidate). The result matches pythaidate for
// every year 2008 to 2050. The Thai government's calendar sometimes places
// the extra day differently, so a computed date can be a day later than the
// official one (2014 and 2015 were).
//
// Months use the Thai (Sukhothai) numbers. A lunar year starts with month 5
// in March or April and runs 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, so months
// 1 to 4 fall in the next January to April. An adhikamasa year repeats the 8th
// month: its months run 5, 6, 7, 8, 88, 9 and on, 88 being the second 8th.
// Laos and Cambodia keep the same calendar (scripts/holiday-supplements/
// theravada.mjs uses it for both).
//
// The constants and the year-type logic below are ported from pythaidate,
// whose licence follows:
//
//   Copyright 2023 Mark Hollow
//
//   Permission is hereby granted, free of charge, to any person obtaining
//   a copy of this software and associated documentation files (the
//   “Software”), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish,
//   distribute, sublicense, and/or sell copies of the Software, and to
//   permit persons to whom the Software is furnished to do so, subject to
//   the following conditions:
//
//   The above copyright notice and this permission notice shall be included
//   in all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
//   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
//   NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
//   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
//   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
//   THE USE OR OTHER DEALINGS IN THE SOFTWARE.

const DAYS_IN_800_YEARS = 292207;
const EPOCH_OFFSET = 373;
/** Julian day number of the Chulasakarat epoch, less one. */
const CS_JDN_OFFSET = 1954167;
const UNIX_EPOCH_JDN = 2440588;
const CUMULATIVE_DAYS = {
  A: [0, 29, 59, 88, 118, 147, 177, 206, 236, 265, 295, 324, 354, 383],
  B: [0, 29, 59, 89, 119, 148, 178, 207, 237, 266, 296, 325, 355, 384],
  C: [0, 29, 59, 88, 118, 148, 177, 207, 236, 266, 295, 325, 354, 384],
};
/** Month order from Thai New Year; 88 is the leap 8th month. */
const MONTH_ORDER = [null, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4];
const MONTH_ORDER_LEAP = [null, 5, 6, 7, 8, 88, 9, 10, 11, 12, 1, 2, 3, 4];

/** Days from the epoch to a Chulasakarat year's New Year's Day. */
function horakhun(csYear) {
  return Math.floor((csYear * DAYS_IN_800_YEARS + EPOCH_OFFSET) / 800) + 1;
}

/** One year's mean positions and its type: A plain, B extra day, C extra month. */
function thaiYear(csYear) {
  const days = horakhun(csYear);
  const kammacapon = 800 - ((csYear * DAYS_IN_800_YEARS + EPOCH_OFFSET) % 800);
  const quotient = Math.floor((days * 11 + 650) / 692);
  let avoman = (days * 11 + 650) % 692;
  if (avoman === 0) avoman = 692;
  let tithi = (quotient + days) % 30;
  if (avoman === 692) tithi -= 1;

  const nextDays = horakhun(csYear + 1);
  const nextTithi = (Math.floor((nextDays * 11 + 650) / 692) + nextDays) % 30;

  const langsak = Math.max(1, tithi);
  const nyd = (days % 7 - (langsak < 6 ? langsak + 29 : langsak) + 1 + 35) % 7;
  const leapDay = kammacapon <= 207;

  let type = tithi > 24 || tithi < 6 ? "C" : "A";
  if (tithi === 25 && nextTithi === 5) type = "A";
  if ((leapDay && avoman <= 126) || (!leapDay && avoman <= 137)) type = type === "C" ? "c" : "B";

  const length = type === "A" ? 4 : type === "B" ? 5 : 6;
  return { tithi, langsak, nyd, nextNyd: (nyd + length) % 7, type, offset: false };
}

/** A year's type and how many days into the lunar year its New Year's Day falls. */
function thaiYearZero(csYear) {
  const years = [-2, -1, 0, 1, 2].map((delta) => thaiYear(csYear + delta));
  if (years[2].tithi === 24 && years[3].tithi === 6) {
    for (const year of years) {
      year.type = "C";
      year.nextNyd = (year.nextNyd + 2) % 7;
    }
  }
  // An extra day and an extra month cannot share a year: move the day to the
  // neighbour that keeps the weekdays in sequence.
  for (const i of [1, 2, 3]) {
    if (years[i].type === "c") {
      const j = years[i].nyd === years[i - 1].nextNyd ? 1 : -1;
      years[i + j].type = "B";
      years[i + j].nextNyd = (years[i + j].nextNyd + 1) % 7;
    }
  }
  for (const i of [1, 2, 3]) {
    if (years[i - 1].nextNyd !== years[i].nyd && years[i].nextNyd !== years[i + 1].nyd) {
      years[i].offset = true;
      years[i].langsak += 1;
      years[i].nyd = (years[i].nyd + 6) % 7;
      years[i].nextNyd = (years[i].nextNyd + 6) % 7;
    }
  }
  const year = years[2];
  const type = year.type === "c" ? "C" : year.type;
  let offsetDays = year.langsak;
  if (offsetDays < 6 + (year.offset ? 1 : 0)) offsetDays += 29;
  return { type, offsetDays };
}

/**
 * Whether the Thai lunar year that starts in a Gregorian year's spring is an
 * adhikamasa year, with a second 8th month (88). In such a Gregorian year
 * Thailand moves each Buddhist holiday a month later: Makha Bucha to the full
 * moon of the 4th month (the one before that spring), Visakha Bucha to the
 * 7th and Asalha Bucha to the second 8th.
 */
export function thaiLeapMonthYear(gregorianYear) {
  return thaiYearZero(gregorianYear - 638).type === "C";
}

/**
 * The Gregorian date of a Thai lunar date that falls in a Gregorian year.
 * month is 1 to 12 or 88 (Sukhothai numbering); day is 1 to 30, where 15 is
 * the full moon and 16 the first waning day. Months 5 to 12 and 88 are those
 * of the lunar year that starts in that year's March or April; months 1 to 4
 * are the ones in its January to April, which end the lunar year before. A
 * day past the end of a month (30 in a 29-day month) rolls into the next.
 */
export function thaiLunarDate(gregorianYear, month, day) {
  const csYear = month <= 4 ? gregorianYear - 639 : gregorianYear - 638;
  const { type, offsetDays } = thaiYearZero(csYear);
  const order = type === "C" ? MONTH_ORDER_LEAP : MONTH_ORDER;
  const index = order.indexOf(month);
  if (index < 1 || !Number.isInteger(day) || day < 1 || day > 30) {
    throw new Error(`festivals.mjs: there is no Thai lunar date ${month}/${day} in ${gregorianYear}`);
  }
  const days = CUMULATIVE_DAYS[type][index - 1] + day - offsetDays;
  return isoOfMs((horakhun(csYear) + days + CS_JDN_OFFSET - UNIX_EPOCH_JDN) * DAY_MS);
}

/** Loy Krathong: the full moon (15th waxing day) of the 12th Thai month. */
const loyKrathong = (year) => thaiLunarDate(year, 12, 15);

// ---------------------------------------------------------------------------
// Sri Lanka's Nikini full moon, for the Kandy Esala Perahera.
//
// Positions from Meeus, Astronomical Algorithms (2nd ed.): lunar phases
// (chapter 49), the Sun's apparent longitude (chapter 25) and the Moon's
// longitude (chapter 47, the 60 largest terms). Self-consistent to about a
// minute: the Moon is 180° from the Sun at every computed full moon.
//
// Nikini is the full moon of the lunar month (new moon to new moon) in which
// the Sun enters sidereal Leo (Simha, by the Lahiri ayanamsa). Its poya day is
// the date in Sri Lanka on which the full-moon tithi (the Moon 168° to 180°
// from the Sun) begins, if it begins before 18:08; otherwise the day after.
// That rule gives every gazetted poya day of 2026 and the Nikini poyas of 2022
// to 2025.

const RAD = Math.PI / 180;
const UNIX_EPOCH_JD = 2440587.5;
const J2000 = 2451545;
/** TT − UT, about 70 s over these years. */
const DELTA_T_DAYS = 70 / 86_400;
const SRI_LANKA_HOURS = 5.5;
const POYA_CUTOFF_HOURS = 18 + 8 / 60;

const sinDeg = (degrees) => Math.sin(degrees * RAD);
const norm = (degrees) => ((degrees % 360) + 360) % 360;

/** UT Julian day of the new moon (k whole) or full moon (k + 0.5) number k from 2000. */
function lunarPhase(k) {
  const t = k / 1236.85;
  const full = k % 1 !== 0;
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  const m = 2.5534 + 29.1053567 * k - 0.0000014 * t * t - 0.00000011 * t ** 3;
  const mp = 201.5643 + 385.81693528 * k + 0.0107582 * t * t + 0.00001238 * t ** 3 - 0.000000058 * t ** 4;
  const f = 160.7108 + 390.67050284 * k - 0.0016118 * t * t - 0.00000227 * t ** 3 + 0.000000011 * t ** 4;
  const omega = 124.7746 - 1.56375588 * k + 0.0020672 * t * t + 0.00000215 * t ** 3;
  const c = full
    ? [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209]
    : [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208];
  let jde =
    2451550.09766 + 29.530588861 * k + 0.00015437 * t * t - 0.00000015 * t ** 3 + 0.00000000073 * t ** 4;
  jde +=
    c[0] * sinDeg(mp) +
    c[1] * e * sinDeg(m) +
    c[2] * sinDeg(2 * mp) +
    c[3] * sinDeg(2 * f) +
    c[4] * e * sinDeg(mp - m) +
    c[5] * e * sinDeg(mp + m) +
    c[6] * e * e * sinDeg(2 * m) -
    0.00111 * sinDeg(mp - 2 * f) -
    0.00057 * sinDeg(mp + 2 * f) +
    0.00056 * e * sinDeg(2 * mp + m) -
    0.00042 * sinDeg(3 * mp) +
    0.00042 * e * sinDeg(m + 2 * f) +
    0.00038 * e * sinDeg(m - 2 * f) -
    0.00024 * e * sinDeg(2 * mp - m) -
    0.00017 * sinDeg(omega) -
    0.00007 * sinDeg(mp + 2 * m) +
    0.00004 * sinDeg(2 * mp - 2 * f) +
    0.00004 * sinDeg(3 * m) +
    0.00003 * sinDeg(mp + m - 2 * f) +
    0.00003 * sinDeg(2 * mp + 2 * f) -
    0.00003 * sinDeg(mp + m + 2 * f) +
    0.00003 * sinDeg(mp - m + 2 * f) -
    0.00002 * sinDeg(mp - m - 2 * f) -
    0.00002 * sinDeg(3 * mp + m) +
    0.00002 * sinDeg(4 * mp);
  const planetary = [
    [299.77, 0.107408, 0.000325],
    [251.88, 0.016321, 0.000165],
    [251.83, 26.651886, 0.000164],
    [349.42, 36.412478, 0.000126],
    [84.66, 18.206239, 0.00011],
    [141.74, 53.303771, 0.000062],
    [207.14, 2.453732, 0.00006],
    [154.84, 7.30686, 0.000056],
    [34.52, 27.261239, 0.000047],
    [207.19, 0.121824, 0.000042],
    [291.34, 1.844379, 0.00004],
    [161.72, 24.198154, 0.000037],
    [239.56, 25.513099, 0.000035],
    [331.55, 3.592518, 0.000023],
  ];
  planetary.forEach(([a, b, amplitude], index) => {
    jde += amplitude * sinDeg(a + b * k - (index === 0 ? 0.009173 * t * t : 0));
  });
  return jde - DELTA_T_DAYS;
}

/** The Sun's apparent ecliptic longitude, degrees. */
function sunLongitude(jd) {
  const t = (jd + DELTA_T_DAYS - J2000) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sinDeg(m) +
    (0.019993 - 0.000101 * t) * sinDeg(2 * m) +
    0.000289 * sinDeg(3 * m);
  return norm(l0 + center - 0.00569 - 0.00478 * sinDeg(125.04 - 1934.136 * t));
}

/** Meeus table 47.A, longitude: multiples of D, M, M′, F and the coefficient in 1e-6°. */
const MOON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

/** The Moon's apparent ecliptic longitude, degrees. */
function moonLongitude(jd) {
  const t = (jd + DELTA_T_DAYS - J2000) / 36525;
  const lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t ** 3 / 538841 - t ** 4 / 65194000;
  const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + t ** 3 / 545868 - t ** 4 / 113065000;
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + t ** 3 / 24490000;
  const mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + t ** 3 / 69699 - t ** 4 / 14712000;
  const f = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t - t ** 3 / 3526000 + t ** 4 / 863310000;
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  let sum = 0;
  for (const [cd, cm, cmp, cf, coefficient] of MOON_TERMS) {
    const factor = cm === 0 ? 1 : Math.abs(cm) === 1 ? e : e * e;
    sum += coefficient * factor * sinDeg(cd * d + cm * m + cmp * mp + cf * f);
  }
  sum += 3958 * sinDeg(119.75 + 131.849 * t) + 1962 * sinDeg(lp - f) + 318 * sinDeg(53.09 + 479264.29 * t);
  return norm(lp + sum / 1e6 - 0.00478 * sinDeg(125.04452 - 1934.136261 * t));
}

/** How far the Moon is ahead of the Sun, 0° to 360°. */
function elongation(jd) {
  return norm(moonLongitude(jd) - sunLongitude(jd));
}

/** The Lahiri (Chitrapaksha) ayanamsa, degrees. */
function lahiri(jd) {
  return 23.857 + ((jd - J2000) / 365.25) * (50.29 / 3600);
}

/** When the Sun's sidereal longitude reaches a value, searching from a guess. */
function sankranti(siderealLongitude, guess) {
  let jd = guess;
  for (let i = 0; i < 30; i++) {
    const behind = ((siderealLongitude - (sunLongitude(jd) - lahiri(jd)) + 540) % 360) - 180;
    if (Math.abs(behind) < 1e-7) break;
    jd += behind / 0.9856;
  }
  return jd;
}

function jdOfIso(iso) {
  const [year, month, day] = parts(iso);
  return Date.UTC(year, month - 1, day) / DAY_MS + UNIX_EPOCH_JD;
}

/** The civil date at a UTC offset of an instant. */
function isoOfJd(jd, offsetHours) {
  return isoOfMs(Math.floor((jd - UNIX_EPOCH_JD) * DAY_MS + offsetHours * 3_600_000));
}

/** The full moon of the lunation (new moon to new moon) containing an instant. */
function fullMoonOfLunation(jd) {
  let k = Math.floor((jd - 2451550.09766) / 29.530588861);
  while (lunarPhase(k) > jd) k -= 1;
  while (lunarPhase(k + 1) <= jd) k += 1;
  return lunarPhase(k + 0.5);
}

/** The Sri Lankan poya day for a full moon. */
function poyaOf(fullMoon) {
  // The full-moon tithi begins when the Moon is 168° ahead, 20 to 27 hours before.
  let low = fullMoon - 1.5;
  let high = fullMoon;
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2;
    if (elongation(middle) < 168) low = middle;
    else high = middle;
  }
  return isoOfJd(high + (24 - POYA_CUTOFF_HOURS) / 24, SRI_LANKA_HOURS);
}

/** The poya day of a full moon near a date, for the tests. */
export function poyaNear(iso) {
  const k = Math.round((jdOfIso(iso) - 2451550.09766) / 29.530588861 - 0.5) + 0.5;
  return poyaOf(lunarPhase(k));
}

/** Nikini Full Moon Poya Day: the full moon of the month the Sun enters sidereal Leo. */
export function nikiniPoya(year) {
  return poyaOf(fullMoonOfLunation(sankranti(120, jdOfIso(ymd(year, 8, 17)))));
}

// ---------------------------------------------------------------------------
// The Balinese Pawukon: a 210-day cycle with no years.

/** A Galungan (Budha Kliwon Dungulan), from the published Pawukon tables. */
const GALUNGAN_EPOCH = "2025-04-23";
const PAWUKON_DAYS = 210;

function galungans(year) {
  const epoch = jdOfIso(GALUNGAN_EPOCH);
  const first = Math.ceil((jdOfIso(ymd(year, 1, 1)) - epoch) / PAWUKON_DAYS);
  const found = [];
  for (let n = first; ; n++) {
    const date = addDays(GALUNGAN_EPOCH, n * PAWUKON_DAYS);
    if (!date.startsWith(`${year}-`)) break;
    found.push(date);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Festivals.

/** A run of days, first to last inclusive, with its own note if it needs one. */
function span(first, last, note) {
  return { first, last, note };
}

const single = (date, note) => span(date, date, note);

/** Editions by year, for festivals whose organisers set new dates each year. */
function announced(byYear) {
  return (year) => (byYear[year] ?? []).map(([first, last, note]) => span(first, last ?? first, note));
}

function dayAndMonth(iso) {
  const [, month, day] = parts(iso);
  return { day, month: MONTHS[month - 1] };
}

/** "Runs 7 to 17 February", "Runs 28 February to 4 March". */
export function runs(first, last) {
  const from = dayAndMonth(first);
  const to = dayAndMonth(last);
  return from.month === to.month
    ? `Runs ${from.day} to ${to.day} ${to.month}`
    : `Runs ${from.day} ${from.month} to ${to.day} ${to.month}`;
}

function sentences(...texts) {
  return texts
    .filter(Boolean)
    .map((text) => text.replace(/[.\s]+$/, ""))
    .join(". ")
    .concat(".");
}

const THAI_LUNAR = "Thai lunar date, computed: the official date can differ by a day";
const CHINESE_LUNAR = "The date follows the Chinese lunar calendar";
const NOT_A_HOLIDAY = "Not a public holiday";
const CHINESE_CALENDAR_SOURCE =
  "Chinese lunisolar calendar, computed astronomically by scripts/build-holidays.mjs (GB/T 33661-2017 rules), checked against date-holidays (https://github.com/commenthol/date-holidays)";

/**
 * Every festival: country (ISO 3166-1 alpha-2), name, source, the note shown
 * to travellers, and editions(year), the runs that start in that year. kind
 * is "festival" unless given.
 *
 * @type {{ country: string, name: string, source: string, note?: string, caveat?: string,
 *   kind?: "public" | "bank" | "optional" | "observance" | "festival",
 *   editions: (year: number) => { first: string, last: string, note?: string }[] }[]}
 */
export const FESTIVALS = [
  // ----- Europe --------------------------------------------------------------
  {
    country: "IT",
    name: "Venice Carnival",
    source: "Carnevale di Venezia, https://carnevale.venezia.it/",
    note: "Venice: costume parades, masked balls and the Flight of the Angel in St Mark's Square; the programme starts a week or two earlier",
    editions: (year) => [span(fromEaster(year, -57), fromEaster(year, -47))],
  },
  {
    country: "IT",
    name: "Battle of the Oranges",
    source: "Storico Carnevale di Ivrea, Turismo Torino, https://www.turismotorino.org/",
    note: "Ivrea, near Turin: teams pelt each other with oranges in the town squares on the last three days of carnival",
    editions: (year) => [span(fromEaster(year, -49), fromEaster(year, -47))],
  },
  {
    country: "IT",
    name: "Palio di Siena",
    source: "Comune di Siena, https://www.comune.siena.it/",
    note: "Siena: bareback horse race round the Piazza del Campo in the evening, after days of trial races. Rain can put it back a day",
    editions: (year) => [single(ymd(year, 7, 2)), single(ymd(year, 8, 16))],
  },
  {
    country: "IT",
    name: "Festa del Redentore",
    source: "Comune di Venezia, https://www.comune.venezia.it/",
    note: "Venice: fireworks over St Mark's Basin on the Saturday night and a bridge of boats to the Redentore church on Giudecca",
    editions: (year) => {
      const sunday = nthWeekday(year, 7, SUN, 3);
      return [span(addDays(sunday, -1), sunday)];
    },
  },
  {
    country: "IT",
    name: "Regata Storica",
    source: "Comune di Venezia, https://www.comune.venezia.it/",
    note: "Venice: a pageant of historic boats, then races, on the Grand Canal",
    editions: (year) => [single(nthWeekday(year, 9, SUN, 1))],
  },
  {
    country: "ES",
    name: "Las Fallas",
    source: "Visit València, https://www.visitvalencia.com/",
    note: "Valencia: hundreds of giant sculptures fill the streets, with fireworks and parades, and all burn on the night of 19 March. Daily mascletà firecrackers at 2 pm from 1 March",
    editions: (year) => [span(ymd(year, 3, 15), ymd(year, 3, 19))],
  },
  {
    country: "ES",
    name: "Holy Week processions",
    source: "Spain's official tourism site, https://www.spain.info/",
    note: "Seville, Málaga and towns across Spain: floats carried through the streets day and night. Hotels fill early",
    editions: (year) => [span(fromEaster(year, -7), easter(year))],
  },
  {
    country: "ES",
    name: "San Fermín",
    source: "Ayuntamiento de Pamplona, https://www.pamplona.es/",
    note: "Pamplona: opens at noon on 6 July; bull runs at 8 am daily from 7 July, and street parties round the clock",
    editions: (year) => [span(ymd(year, 7, 6), ymd(year, 7, 14))],
  },
  {
    country: "ES",
    name: "La Tomatina",
    source: "Visit València, https://www.visitvalencia.com/",
    note: "Buñol, near Valencia: an hour-long tomato fight in the town centre around midday. Tickets needed",
    editions: (year) => [single(nthWeekday(year, 8, WED, -1))],
  },
  {
    country: "ES",
    name: "Romería del Rocío",
    source: "Hermandad Matriz de Almonte, https://www.rocio.com/",
    note: "El Rocío, Huelva: about a million pilgrims gather for Pentecost, and the Virgin is carried out before dawn on the Monday. Roads to the village are packed",
    editions: (year) => [span(fromEaster(year, 47), fromEaster(year, 50))],
  },
  {
    country: "PT",
    name: "São João do Porto",
    source: "Visit Porto, https://www.visitporto.travel/",
    note: "Porto: an all-night street party on 23 June with fireworks over the Douro at midnight, grilled sardines and plastic hammers",
    editions: (year) => [span(ymd(year, 6, 23), ymd(year, 6, 24))],
  },
  {
    country: "PT",
    name: "Santo António",
    source: "Visit Lisboa, https://www.visitlisboa.com/",
    note: "Lisbon: neighbourhood marches down Avenida da Liberdade on the night of 12 June and street parties with grilled sardines in Alfama",
    editions: (year) => [span(ymd(year, 6, 12), ymd(year, 6, 13))],
  },
  {
    country: "FR",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Paris: lion dances and parades in the 13th arrondissement and Belleville on the nearest weekends",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "FR",
    name: "Fête de la Musique",
    source: "Ministère de la Culture, https://fetedelamusique.culture.gouv.fr/",
    note: "Free concerts in streets, squares and bars all over France, late into the night",
    editions: (year) => [single(ymd(year, 6, 21))],
  },
  {
    country: "FR",
    name: "Fête des Lumières",
    source: "Ville de Lyon, https://www.fetedeslumieres.lyon.fr/",
    note: "Lyon: light shows across the city over about four nights around 8 December, when residents put candles in their windows. Hotels fill early",
    editions: (year) => [single(ymd(year, 12, 8))],
  },
  {
    country: "DE",
    name: "Oktoberfest",
    source: "City of Munich, https://www.muenchen.de/int/en/events/oktoberfest.html",
    note: "Munich: the beer festival on the Theresienwiese. Hotels sell out and prices rise",
    editions: (year) => {
      // It ends on the first Sunday of October, or on 3 October (German Unity
      // Day) if that is later, and opens on the Saturday 15 days before that Sunday.
      const sunday = nthWeekday(year, 10, SUN, 1);
      const unity = ymd(year, 10, 3);
      return [span(addDays(sunday, -15), sunday > unity ? sunday : unity)];
    },
  },
  {
    country: "DE",
    name: "Cologne Carnival",
    source: "Stadt Köln, https://www.stadt-koeln.de/",
    note: "Cologne: street carnival from 11:11 am on the Thursday (Weiberfastnacht) to the Rose Monday parade and Shrove Tuesday. Düsseldorf and Mainz celebrate on the same days",
    editions: (year) => [span(fromEaster(year, -52), fromEaster(year, -47))],
  },
  {
    country: "DE",
    name: "Christmas markets",
    source: "Stadt Nürnberg, https://www.nuernberg.de/",
    note: "Nuremberg's Christkindlesmarkt, and markets in most towns until 23 or 24 December",
    editions: (year) => [span(addDays(adventSunday(year), -2), ymd(year, 12, 24))],
  },
  {
    country: "DE",
    name: "Kiel Week",
    source: "Kieler Woche, https://www.kieler-woche.de/",
    note: "Kiel: the world's largest sailing regatta, with a city festival and a parade of tall ships",
    editions: (year) => {
      const sunday = nthWeekday(year, 6, SUN, -1);
      return [span(addDays(sunday, -8), sunday)];
    },
  },
  {
    country: "CZ",
    name: "Christmas markets",
    source: "Prague City Tourism, https://www.prague.eu/",
    note: "Prague: markets on Old Town and Wenceslas Squares",
    editions: (year) => [span(addDays(adventSunday(year), -1), ymd(year + 1, 1, 6))],
  },
  {
    country: "CH",
    name: "Basel Fasnacht",
    source: "Kanton Basel-Stadt, https://www.bs.ch/",
    note: "Basel: starts with the Morgestraich at 4 am on Monday, when the city switches its lights off for lantern parades, then three days of fife and drum processions",
    editions: (year) => [span(fromEaster(year, -41), fromEaster(year, -39))],
  },
  {
    country: "CH",
    name: "Lucerne Carnival",
    source: "Lucerne Tourism, https://www.luzern.com/",
    note: "Lucerne: from the 5 am bang on Thursday to the Tuesday night parade of brass bands (Guuggenmusigen)",
    editions: (year) => [span(fromEaster(year, -52), fromEaster(year, -47))],
  },
  {
    country: "CH",
    name: "Sechseläuten",
    source: "Stadt Zürich, https://www.stadt-zuerich.ch/",
    note: "Zurich: the guilds' parade and the burning of the Böögg, a snowman packed with fireworks, in the evening",
    editions: (year) => {
      // The third Monday in April; in Holy Week it moves to the second, on
      // Easter Monday to the fourth (city council decision 1214 of 1952).
      const third = nthWeekday(year, 4, MON, 3);
      const easterMonday = fromEaster(year, 1);
      if (third === easterMonday) return [single(addDays(third, 7))];
      if (third === fromEaster(year, -6)) return [single(addDays(third, -7))];
      return [single(third)];
    },
  },
  {
    country: "BE",
    name: "Binche Carnival",
    source: "Carnaval de Binche, https://www.carnavaldebinche.be/",
    note: "Binche: the Gilles, in wax masks and ostrich-feather hats, dance through the town on Shrove Tuesday and throw oranges to the crowd",
    editions: (year) => [span(fromEaster(year, -49), fromEaster(year, -47))],
  },
  {
    country: "BE",
    name: "Gentse Feesten",
    source: "Stad Gent, https://stad.gent/",
    note: "Ghent: ten days of free street music, theatre and parties in the old centre",
    editions: (year) => {
      const friday = onOrBefore(ymd(year, 7, 20), FRI);
      return [span(friday, addDays(friday, 9))];
    },
  },
  {
    country: "NL",
    name: "Keukenhof tulip season",
    source: "Keukenhof, https://keukenhof.nl/",
    note: "Lisse: the Keukenhof flower gardens, open only in spring. Book a timed ticket; the tulips usually peak in mid to late April",
    editions: announced({ 2026: [["2026-03-19", "2026-05-10"]], 2027: [["2027-03-18", "2027-05-09"]] }),
  },
  {
    country: "GB",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "London's Chinatown and Trafalgar Square hold the celebrations, usually on the following weekend",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "GB",
    name: "Up Helly Aa",
    source: "Visit Shetland, https://www.shetland.org/",
    note: "Lerwick, Shetland: a torchlit procession of Vikings who burn a longship in the evening",
    editions: (year) => [single(nthWeekday(year, 1, TUE, -1))],
  },
  {
    country: "GB",
    name: "Cheese rolling",
    source: "SoGlos, https://www.soglos.com/",
    note: "Cooper's Hill, Gloucestershire: racers chase a wheel of Double Gloucester down a near-vertical hill from noon. Unofficial, and sometimes called off",
    editions: (year) => [single(nthWeekday(year, 5, MON, -1))],
  },
  {
    country: "GB",
    name: "Glastonbury Festival",
    source: "Glastonbury Festivals, https://www.glastonburyfestivals.co.uk/",
    note: "Pilton, Somerset: music and performing arts on a dairy farm. Tickets sell out the autumn before; the festival takes some years off",
    editions: announced({ 2027: [["2027-06-23", "2027-06-27"]] }),
  },
  {
    country: "GB",
    name: "National Eisteddfod",
    source: "Eisteddfod Genedlaethol Cymru, https://eisteddfod.wales/",
    note: "Wales: a week of Welsh-language music, poetry and competitions, held in a different town each year",
    editions: (year) => {
      const saturday = addDays(nthWeekday(year, 8, MON, 1), -2);
      return [span(saturday, addDays(saturday, 7))];
    },
  },
  {
    country: "GB",
    name: "Edinburgh Festival Fringe",
    source: "Edinburgh Festival Fringe Society, https://www.edfringe.com/",
    note: "Edinburgh: the world's biggest arts festival, in the same weeks as the International Festival and the Military Tattoo. Rooms book up months ahead",
    editions: announced({ 2026: [["2026-08-07", "2026-08-31"]], 2027: [["2027-08-06", "2027-08-30"]] }),
  },
  {
    country: "GB",
    name: "Notting Hill Carnival",
    source: "Royal Borough of Kensington and Chelsea, https://www.rbkc.gov.uk/",
    note: "London: Caribbean carnival parade and sound systems in Notting Hill. Sunday is family day, Monday the main parade",
    editions: (year) => {
      const monday = nthWeekday(year, 8, MON, -1);
      return [span(addDays(monday, -1), monday)];
    },
  },
  {
    country: "GB",
    name: "Braemar Gathering",
    source: "Braemar Royal Highland Society, https://braemargathering.org/",
    note: "Braemar, Aberdeenshire: Highland games with caber tossing, pipe bands and Highland dancing",
    editions: (year) => [single(nthWeekday(year, 9, SAT, 1))],
  },
  {
    country: "GB",
    name: "Bonfire Night",
    source: "VisitBritain, https://www.visitbritain.com/",
    note: "Bonfires and fireworks across Britain for Guy Fawkes Night. Many public displays are on the nearest weekend",
    editions: (year) => [single(ymd(year, 11, 5))],
  },
  {
    country: "GB",
    name: "Lewes Bonfire",
    source: "Lewes District Council, https://lewes-eastbourne.gov.uk/",
    note: "Lewes, East Sussex: bonfire societies' torchlit processions and fireworks. The town closes to traffic and trains may not stop there that evening",
    editions: (year) => {
      // On 5 November, or the Saturday before when the 5th is a Sunday.
      const fifth = ymd(year, 11, 5);
      return [single(weekdayOf(fifth) === SUN ? addDays(fifth, -1) : fifth)];
    },
  },
  {
    country: "GB",
    name: "Edinburgh's Hogmanay",
    source: "Edinburgh's Hogmanay, https://www.edinburghshogmanay.com/",
    note: "Edinburgh: torchlight procession on 29 December, street party and fireworks on 31 December, and the Loony Dook dip in the sea on 1 January",
    editions: (year) => [span(ymd(year, 12, 29), ymd(year + 1, 1, 1))],
  },
  {
    country: "IE",
    name: "Puck Fair",
    source: "Puck Fair, https://www.puckfair.ie/",
    note: "Killorglin, County Kerry: one of Ireland's oldest fairs, where a wild goat is crowned king of the town",
    editions: (year) => [span(ymd(year, 8, 10), ymd(year, 8, 12))],
  },
  {
    country: "GR",
    name: "Patras Carnival",
    source: "Visit Greece, https://www.visitgreece.gr/",
    note: "Patras: a night parade on Saturday and the Grand Parade, with tens of thousands in costume, on Sunday, the last weekend before Orthodox Lent",
    editions: (year) => [span(fromOrthodoxEaster(year, -50), fromOrthodoxEaster(year, -49))],
  },
  {
    country: "RU",
    name: "Maslenitsa",
    source: "Russian Orthodox calendar (the week before Great Lent), https://www.dp.ru/",
    note: "Pancake week before Orthodox Lent: blini, fairs and the burning of a straw figure of winter on the Sunday, in Moscow, St Petersburg and towns across Russia",
    editions: (year) => [span(fromOrthodoxEaster(year, -55), fromOrthodoxEaster(year, -49))],
  },
  {
    country: "HU",
    name: "Busójárás",
    source: "Mohács carnival programme, https://xpatloop.com/",
    note: "Mohács: men in carved wooden masks and sheepskins chase winter away; the biggest parade, river crossing and bonfire are on Sunday",
    editions: (year) => [span(fromEaster(year, -52), fromEaster(year, -47))],
  },
  {
    country: "AM",
    name: "Vardavar",
    source: "Armenian Apostolic Church calendar (14 weeks after Easter), https://armeniadiscovery.com/",
    note: "Water festival across Armenia: expect to be soaked in the streets of Yerevan",
    editions: (year) => [single(fromEaster(year, 98))],
  },
  {
    country: "TR",
    name: "Şeb-i Arus",
    source: "Ministry of Culture and Tourism, https://sebiarus.ktb.gov.tr/",
    note: "Konya: whirling dervish ceremonies for Rumi's death anniversary, ending on 17 December. Book early",
    editions: (year) => [span(ymd(year, 12, 7), ymd(year, 12, 17))],
  },

  // ----- Middle East and Africa ----------------------------------------------
  {
    country: "EG",
    name: "Abu Simbel Sun Festival",
    source: "Egyptian Ministry of Tourism and Antiquities, https://egymonuments.gov.eg/",
    note: "Abu Simbel: at sunrise the sun reaches the statues in the temple's inner sanctuary. Arrive before dawn",
    editions: (year) => [single(ymd(year, 2, 22)), single(ymd(year, 10, 22))],
  },
  {
    country: "ET",
    name: "Timkat",
    source: "Ethiopian Orthodox calendar, https://en.wikipedia.org/wiki/Timkat",
    note: "Ethiopian Epiphany: on the eve each church's tabot is carried to water for an all-night vigil, with the baptism ceremony at dawn. Gondar and Lalibela are the main places to see it",
    editions: (year) => {
      // 19 January, or the 20th in a Gregorian leap year.
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const day = leap ? 20 : 19;
      return [span(ymd(year, 1, day - 1), ymd(year, 1, day))];
    },
  },

  // ----- Asia ----------------------------------------------------------------
  {
    country: "JP",
    name: "Sapporo Snow Festival",
    source: "Sapporo Snow Festival Executive Committee, https://www.snowfes.com/",
    note: "Sapporo: giant snow and ice sculptures in Odori Park, Susukino and Tsudome",
    editions: announced({ 2026: [["2026-02-04", "2026-02-11"]], 2027: [["2027-02-04", "2027-02-11"]] }),
  },
  {
    country: "JP",
    name: "Takayama Festival",
    source: "Gifu Prefecture tourism, https://www.kankou-gifu.jp/",
    editions: (year) => [
      span(ymd(year, 4, 14), ymd(year, 4, 15), "Takayama: the spring festival (Sanno Matsuri), with ornate floats, mechanical puppets and a lantern-lit evening procession"),
      span(ymd(year, 10, 9), ymd(year, 10, 10), "Takayama: the autumn festival (Hachiman Matsuri), with ornate floats, mechanical puppets and a lantern-lit evening procession"),
    ],
  },
  {
    country: "JP",
    name: "Aoi Matsuri",
    source: "Kyoto City Tourism, https://kyoto.travel/en/",
    note: "Kyoto: a procession in Heian-period court dress from the Imperial Palace to the Shimogamo and Kamigamo shrines. Rain moves it to the next day",
    editions: (year) => [single(ymd(year, 5, 15))],
  },
  {
    country: "JP",
    name: "Sanja Matsuri",
    source: "Tokyo Convention and Visitors Bureau, https://www.gotokyo.org/",
    note: "Tokyo (Asakusa): portable shrines carried through the streets round Sensō-ji. The biggest crowds are on Saturday and Sunday",
    editions: (year) => {
      const saturday = nthWeekday(year, 5, SAT, 3);
      return [span(addDays(saturday, -1), addDays(saturday, 1))];
    },
  },
  {
    country: "JP",
    name: "Hakata Gion Yamakasa",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Fukuoka: float displays all fortnight, ending with the Oiyama float race at 4:59 am on 15 July",
    editions: (year) => [span(ymd(year, 7, 1), ymd(year, 7, 15))],
  },
  {
    country: "JP",
    name: "Gion Matsuri",
    source: "Kyoto City Tourism, https://kyoto.travel/en/",
    editions: (year) => [
      span(ymd(year, 7, 14), ymd(year, 7, 17), "Kyoto: evening street festivities (yoiyama) among the floats, then the grand float parade on the morning of 17 July"),
      span(ymd(year, 7, 21), ymd(year, 7, 24), "Kyoto: evening street festivities (yoiyama), then the second float parade on the morning of 24 July"),
    ],
  },
  {
    country: "JP",
    name: "Tenjin Matsuri",
    source: "Osaka Convention and Tourism Bureau, https://osaka-info.jp/",
    note: "Osaka: processions on land, then a boat procession on the Ōkawa River and fireworks on the evening of 25 July",
    editions: (year) => [span(ymd(year, 7, 24), ymd(year, 7, 25))],
  },
  {
    country: "JP",
    name: "Sumida River Fireworks",
    source: "Sumidagawa Fireworks Festival, https://www.sumidagawa-hanabi.com/",
    note: "Tokyo: about 20,000 fireworks over the Sumida River near Asakusa in the evening. Cancelled, not postponed, in bad weather",
    editions: (year) => [single(nthWeekday(year, 7, SAT, -1))],
  },
  {
    country: "JP",
    name: "Aomori Nebuta Matsuri",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Aomori: giant illuminated warrior floats paraded each night, ending with a daytime parade and fireworks over the bay on 7 August",
    editions: (year) => [span(ymd(year, 8, 2), ymd(year, 8, 7))],
  },
  {
    country: "JP",
    name: "Akita Kanto Matsuri",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Akita: performers balance tall bamboo poles hung with dozens of paper lanterns each evening",
    editions: (year) => [span(ymd(year, 8, 3), ymd(year, 8, 6))],
  },
  {
    country: "JP",
    name: "Sendai Tanabata Matsuri",
    source: "Tohoku Kizuna Matsuri, https://tohoku-kizunamatsuri.jp/",
    note: "Sendai: shopping streets hung with giant paper streamers, after fireworks on the evening of 5 August",
    editions: (year) => [span(ymd(year, 8, 6), ymd(year, 8, 8))],
  },
  {
    country: "JP",
    name: "Yosakoi Matsuri",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Kōchi: dance teams with wooden clappers perform through the city; the main competition is on 10 and 11 August",
    editions: (year) => [span(ymd(year, 8, 9), ymd(year, 8, 12))],
  },
  {
    country: "JP",
    name: "Awa Odori",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Tokushima: dance troupes fill the streets every evening. An opening night has been held on 11 August in recent years",
    editions: (year) => [span(ymd(year, 8, 12), ymd(year, 8, 15))],
  },
  {
    country: "JP",
    name: "Obon",
    source: "Japan National Tourism Organization, https://www.japan.travel/en/",
    note: "Many people travel to their home towns: trains, flights and roads are at their busiest, and some shops and restaurants close",
    editions: (year) => [span(ymd(year, 8, 13), ymd(year, 8, 16))],
  },
  {
    country: "JP",
    name: "Gozan Okuribi",
    source: "Kyoto City Tourism, https://kyoto.travel/en/",
    note: "Kyoto: five huge bonfires, among them the 大 character, are lit on the hills from 8 pm to send the ancestors' spirits off at the end of Obon",
    editions: (year) => [single(ymd(year, 8, 16))],
  },
  {
    country: "JP",
    name: "Jidai Matsuri",
    source: "Kyoto City Tourism, https://kyoto.travel/en/",
    note: "Kyoto: a costumed procession through the eras of Kyoto's history, from the Imperial Palace to Heian Shrine. Rain moves it to the next day",
    editions: (year) => [single(ymd(year, 10, 22))],
  },
  {
    country: "CN",
    name: "Harbin Ice and Snow Festival",
    source: "China Daily, https://www.chinadailyhk.com/",
    note: "Harbin: ice and snow sculpture parks, open from about late December to late February; official opening 5 January",
    editions: (year) => [span(ymd(year, 1, 5), ymd(year, 1, 31))],
  },
  {
    country: "CN",
    name: "Lantern Festival",
    source: CHINESE_CALENDAR_SOURCE,
    note: "The 15th day of the lunar new year: lantern displays, lion dances and sweet tangyuan dumplings, closing the New Year season",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 15))],
  },
  {
    country: "CN",
    name: "Water-Splashing Festival",
    source: "Visit Yunnan, https://visityunnanchina.com/",
    note: "Xishuangbanna (Jinghong), Yunnan: Dai New Year with a lantern release, a parade and a city-wide water fight on the last day",
    editions: (year) => [span(ymd(year, 4, 13), ymd(year, 4, 15))],
  },
  {
    country: "HK",
    name: "Cheung Chau Bun Festival",
    source: "Hong Kong Tourism Board, https://www.discoverhongkong.com/",
    note: "Cheung Chau island: children ride high above the Piu Sik parade, and climbers race up a tower of buns at midnight. Ferries are packed",
    caveat: CHINESE_LUNAR,
    editions: (year) => [single(chineseDate(year, 4, 8))],
  },
  {
    country: "HK",
    name: "Tai Hang Fire Dragon Dance",
    source: "Hong Kong Tourism Board, https://www.discoverhongkong.com/",
    note: "Hong Kong (Tai Hang, Causeway Bay): a 67-metre dragon studded with burning incense sticks winds through the streets each evening around the Mid-Autumn Festival",
    caveat: CHINESE_LUNAR,
    editions: (year) => [span(chineseDate(year, 8, 14), chineseDate(year, 8, 16))],
  },
  {
    country: "TW",
    name: "Lantern Festival",
    source: "Taiwan Tourism Administration, https://www.taiwan.net.tw/",
    note: "Sky lanterns released at Pingxi and Shifen, and firework 'beehives' at Yanshui. The Taiwan Lantern Festival light show runs for about two weeks from this day",
    caveat: CHINESE_LUNAR,
    editions: (year) => [single(chineseDate(year, 1, 15))],
  },
  {
    country: "TH",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Bangkok's Chinatown (Yaowarat) and Chinese communities across Thailand celebrate with lion dances and firecrackers",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "TH",
    name: "Phuket Vegetarian Festival",
    source: "Tourism Authority of Thailand, https://www.tatnews.org/",
    note: "Phuket Town: shrine processions of devotees in trance, firecrackers, and vegetarian food everywhere",
    caveat: CHINESE_LUNAR,
    editions: (year) => [span(chineseDate(year, 9, 1), chineseDate(year, 9, 9))],
  },
  {
    country: "TH",
    name: "Loy Krathong",
    source: "Tourism Authority of Thailand, https://www.thailand.go.th/; Thai lunar calendar computed as in pythaidate (MIT), https://github.com/hmmbug/pythaidate",
    note: "Candle-lit floating offerings on rivers and lakes across Thailand on the full-moon night. Sukhothai and Bangkok hold the biggest celebrations",
    caveat: THAI_LUNAR,
    editions: (year) => [single(loyKrathong(year))],
  },
  {
    country: "TH",
    name: "Yi Peng",
    source: "Tourism Authority of Thailand, https://www.thailand.go.th/; Thai lunar calendar computed as in pythaidate (MIT), https://github.com/hmmbug/pythaidate",
    note: "Chiang Mai: lanterns, candle-lit temples and parades for the Lanna full-moon festival, alongside Loy Krathong. Mass lantern releases are ticketed events outside the city",
    caveat: THAI_LUNAR,
    editions: (year) => [span(loyKrathong(year), addDays(loyKrathong(year), 1))],
  },
  {
    country: "PH",
    name: "Feast of the Black Nazarene",
    source: "Manila Bulletin, https://mb.com.ph/",
    note: "Manila (Quiapo): millions follow the Black Nazarene through the streets in a procession that can last a day. Roads around Quiapo close",
    editions: (year) => [single(ymd(year, 1, 9))],
  },
  {
    country: "PH",
    name: "Sinulog",
    source: "SunStar Cebu, https://www.sunstar.com.ph/",
    note: "Cebu City: the street-dancing grand parade for the Santo Niño, after a week of processions",
    editions: (year) => [single(nthWeekday(year, 1, SUN, 3))],
  },
  {
    country: "PH",
    name: "Ati-Atihan",
    source: "Ati-Atihan festival, https://en.wikipedia.org/wiki/Ati-Atihan",
    note: "Kalibo, Aklan: dancers with soot-blackened faces and tribal costumes fill the streets; the festivities run all week up to this Sunday",
    editions: (year) => [single(nthWeekday(year, 1, SUN, 3))],
  },
  {
    country: "PH",
    name: "Dinagyang",
    source: "Daily Tribune, https://tribune.net.ph/",
    note: "Iloilo City: the tribe dance competition and street parades",
    editions: (year) => [single(nthWeekday(year, 1, SUN, 4))],
  },
  {
    country: "ID",
    name: "Galungan",
    source: "Balinese Pawukon calendar, https://baliuntold.com/culture/galungan-and-kuningan/",
    note: "Bali: streets lined with tall bamboo penjor poles as Balinese Hindus mark the victory of dharma. Temples are busy and some businesses close",
    editions: (year) => galungans(year).map((date) => single(date)),
  },
  {
    country: "ID",
    name: "Kuningan",
    source: "Balinese Pawukon calendar, https://baliuntold.com/culture/galungan-and-kuningan/",
    note: "Bali: the last day of the Galungan period, when the ancestors' spirits return to heaven; temple ceremonies end by midday",
    editions: (year) => galungans(year).map((date) => single(addDays(date, 10))),
  },
  {
    country: "LK",
    name: "Kandy Esala Perahera",
    source: "Sri Dalada Maligawa schedule, https://kandyesalaperahera.com/dates; Nikini full moon computed (Meeus, Astronomical Algorithms)",
    note: "Kandy: nightly processions of dancers, drummers and elephants for the Sacred Tooth Relic, ending with the grand Randoli on the full moon",
    caveat: "Dates set by the Temple of the Tooth; computed, so they can differ by a day",
    editions: (year) => {
      const poya = nikiniPoya(year);
      return [span(addDays(poya, -9), addDays(poya, 1))];
    },
  },
  {
    country: "MN",
    name: "Naadam",
    kind: "public",
    source: "Law on Public Holidays and Observances, art. 4.1.1, https://legalinfo.mn/",
    note: "National festival of wrestling, horse racing and archery, opening at the stadium in Ulaanbaatar on 11 July. A public holiday; the government sometimes adds days",
    editions: (year) => [span(ymd(year, 7, 10), ymd(year, 7, 15))],
  },
  {
    country: "SG",
    name: "Mid-Autumn Festival",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Lantern displays in Chinatown and at Gardens by the Bay, and mooncakes everywhere",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 8, 15))],
  },
  {
    country: "MY",
    name: "Mid-Autumn Festival",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Lantern processions and mooncakes in Chinese communities, notably in Penang and Kuala Lumpur",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 8, 15))],
  },

  // ----- The Americas --------------------------------------------------------
  {
    country: "US",
    name: "Rose Parade",
    source: "Tournament of Roses, https://tournamentofroses.com/",
    note: "Pasadena: flower-covered floats on Colorado Boulevard in the morning, before the Rose Bowl game. Never held on a Sunday",
    editions: (year) => {
      const first = ymd(year, 1, 1);
      return [single(weekdayOf(first) === SUN ? ymd(year, 1, 2) : first)];
    },
  },
  {
    country: "US",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Lion dances and celebrations in Chinatowns such as San Francisco's and New York's; the big parades are on a nearby weekend",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "US",
    name: "Mardi Gras in New Orleans",
    source: "New Orleans & Company, https://www.neworleans.com/",
    note: "New Orleans: the biggest parades roll every evening from Thursday to Fat Tuesday. Parade season begins on 6 January",
    editions: (year) => [span(fromEaster(year, -52), fromEaster(year, -47))],
  },
  {
    country: "US",
    name: "Merrie Monarch Festival",
    source: "Merrie Monarch Festival, https://www.merriemonarch.com/",
    note: "Hilo, Hawaiʻi: the world's leading hula competition, from Easter Sunday, with a royal parade on Saturday",
    editions: (year) => [span(easter(year), fromEaster(year, 6))],
  },
  {
    country: "US",
    name: "Coachella",
    source: "Coachella Valley Music and Arts Festival, https://www.coachella.com/",
    note: "Indio, California: music festival, held over two weekends",
    editions: announced({
      2026: [["2026-04-10", "2026-04-12"], ["2026-04-17", "2026-04-19"]],
      2027: [["2027-04-09", "2027-04-11"], ["2027-04-16", "2027-04-18"]],
    }),
  },
  {
    country: "US",
    name: "Burning Man",
    source: "Burning Man Project, https://burningman.org/",
    note: "Black Rock Desert, Nevada: a week-long temporary city of art; the Man burns on Saturday night. Tickets needed",
    editions: (year) => {
      const laborDay = nthWeekday(year, 9, MON, 1);
      return [span(addDays(laborDay, -8), laborDay)];
    },
  },
  {
    country: "US",
    name: "Albuquerque International Balloon Fiesta",
    source: "Albuquerque International Balloon Fiesta, https://balloonfiesta.com/",
    note: "Albuquerque: mass ascents of hundreds of hot-air balloons at dawn, and evening balloon glows",
    editions: (year) => {
      const saturday = addDays(nthWeekday(year, 10, SUN, 1), -1);
      return [span(saturday, addDays(saturday, 8))];
    },
  },
  {
    country: "PR",
    name: "Fiestas de la Calle San Sebastián",
    source: "Discover Puerto Rico, https://www.discoverpuertorico.com/",
    note: "Old San Juan: four days of music, parades of big-headed cabezudos and street food",
    editions: (year) => {
      const sunday = nthWeekday(year, 1, SUN, 3);
      return [span(addDays(sunday, -3), sunday)];
    },
  },
  {
    country: "CA",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Lion dances and celebrations in Chinatowns, notably Vancouver's and Toronto's",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "CA",
    name: "Carnaval de Québec",
    source: "Carnaval de Québec, https://carnaval.qc.ca/",
    note: "Quebec City: winter carnival with Bonhomme's ice palace, night parades and canoe races across the icy St Lawrence",
    editions: announced({ 2026: [["2026-02-06", "2026-02-15"]], 2027: [["2027-02-05", "2027-02-14"]] }),
  },
  {
    country: "CA",
    name: "Calgary Stampede",
    source: "Calgary Stampede, https://www.calgarystampede.com/",
    note: "Calgary: rodeo, chuckwagon races and a parade on the first morning. Hotels fill early",
    editions: (year) => {
      // Ten days from the Friday between 3 and 9 July.
      const friday = onOrAfter(ymd(year, 7, 3), FRI);
      return [span(friday, addDays(friday, 9))];
    },
  },
  {
    country: "MX",
    name: "Guelaguetza",
    source: "Visit Mexico, https://www.visitmexico.com/",
    note: "Oaxaca: dancers from the state's regions perform at the auditorium on Cerro del Fortín, morning and evening (tickets needed for the front sections)",
    editions: (year) => {
      // The two Mondays after 16 July; one falling on 18 July (Juárez's death)
      // moves a week.
      let first = onOrAfter(ymd(year, 7, 17), MON);
      if (first === ymd(year, 7, 18)) first = addDays(first, 7);
      return [single(first), single(addDays(first, 7))];
    },
  },
  {
    country: "MX",
    name: "Day of the Dead",
    source: "Visit Mexico, https://www.visitmexico.com/",
    note: "Altars, marigolds and candle-lit vigils in cemeteries across Mexico, notably around Lake Pátzcuaro. Mexico City's parade is on a weekend near the start",
    editions: (year) => [span(ymd(year, 10, 31), ymd(year, 11, 2))],
  },
  {
    country: "MX",
    name: "Las Posadas",
    source: "Visit Mexico, https://www.visitmexico.com/",
    note: "Nine evenings of processions re-enacting Mary and Joseph's search for shelter, with piñatas, across Mexico",
    editions: (year) => [span(ymd(year, 12, 16), ymd(year, 12, 24))],
  },
  {
    country: "MX",
    name: "Night of the Radishes",
    source: "Visit Mexico, https://www.visitmexico.com/",
    note: "Oaxaca: a carved-radish sculpture contest in the Zócalo from the afternoon",
    editions: (year) => [single(ymd(year, 12, 23))],
  },
  {
    country: "GT",
    name: "Holy Week in Antigua",
    source: "Agencia Guatemalteca de Noticias, https://agn.gt/",
    note: "Antigua Guatemala: processions over carpets of coloured sawdust and flowers, biggest on Thursday and Good Friday. Book months ahead",
    editions: (year) => [span(fromEaster(year, -7), easter(year))],
  },
  {
    country: "GT",
    name: "Sumpango Giant Kite Festival",
    source: "La Hora, https://lahora.gt/",
    note: "Sumpango, near Antigua: giant paper kites, some 20 metres across, shown and flown at the cemetery for All Saints' Day",
    editions: (year) => [single(ymd(year, 11, 1))],
  },
  {
    country: "BS",
    name: "Junkanoo",
    source: "The Islands of the Bahamas, https://www.bahamas.com/",
    note: "Nassau: costumed rush-out parades with drums, cowbells and horns on Bay Street from the small hours",
    editions: (year) => [single(ymd(year, 12, 26)), single(ymd(year + 1, 1, 1))],
  },
  {
    country: "TT",
    name: "Trinidad Carnival",
    source: "Tourism Trinidad, https://visittrinidad.tt/",
    note: "Port of Spain: J'ouvert from before dawn on Monday, then two days of costumed mas bands in the streets. Not official holidays, but much of the country stops",
    editions: (year) => [span(fromEaster(year, -48), fromEaster(year, -47))],
  },
  {
    country: "CO",
    name: "Carnaval de Negros y Blancos",
    source: "Colombia Travel, https://colombia.travel/",
    note: "Pasto: parades, with everyone painted black on 5 January and dusted with white powder for the grand parade on 6 January",
    editions: (year) => [span(ymd(year, 1, 2), ymd(year, 1, 6))],
  },
  {
    country: "CO",
    name: "Carnaval de Barranquilla",
    source: "Colombia Travel, https://colombia.travel/es/barranquilla/carnaval-de-barranquilla",
    note: "Barranquilla: four days of parades, from the Battle of Flowers on Saturday to Joselito's mock funeral on Tuesday",
    editions: (year) => [span(fromEaster(year, -50), fromEaster(year, -47))],
  },
  {
    country: "PE",
    name: "Corpus Christi in Cusco",
    source: "TreXperience Peru, https://trexperienceperu.com/",
    note: "Cusco: saints from the city's parishes are carried to the cathedral on Wednesday and round the Plaza de Armas on Thursday, with chiriuchu feasts",
    editions: (year) => [span(fromEaster(year, 59), fromEaster(year, 60))],
  },
  {
    country: "PE",
    name: "Inti Raymi",
    source: "Lima Easy, https://www.limaeasy.com/",
    note: "Cusco: the Inca sun festival re-enacted at Qorikancha, the Plaza de Armas and Sacsayhuamán (seats ticketed). Cusco is at its busiest",
    editions: (year) => [single(ymd(year, 6, 24))],
  },
  {
    country: "BO",
    name: "Oruro Carnival",
    source: "Los Tiempos, https://www.lostiempos.com/",
    note: "Oruro: the Entrada, a pilgrimage parade of tens of thousands of dancers in devil masks and other costumes, from Saturday morning. Stands are ticketed",
    editions: (year) => [span(fromEaster(year, -50), fromEaster(year, -47))],
  },
  {
    country: "BR",
    name: "Rio Carnival",
    source: "Riotur, https://prefeitura.rio/riotur/",
    note: "Rio de Janeiro: samba schools parade at the Sambadrome, the top Special Group on Sunday to Tuesday nights, and street blocos dance all over the city. Salvador, Recife and Olinda party on the same days",
    editions: (year) => [span(fromEaster(year, -51), fromEaster(year, -46))],
  },
  {
    country: "BR",
    name: "Parintins Folklore Festival",
    source: "Estado de Minas, https://www.em.com.br/",
    note: "Parintins, Amazonas: the rival Boi Garantido and Boi Caprichoso perform over three nights in the Bumbódromo. Reached by boat or plane from Manaus",
    editions: (year) => {
      const friday = nthWeekday(year, 6, FRI, -1);
      return [span(friday, addDays(friday, 2))];
    },
  },
  {
    country: "BR",
    name: "Círio de Nazaré",
    source: "O Liberal, https://www.oliberal.com/",
    note: "Belém: about two million people follow the image of Our Lady of Nazareth. The river procession and the night procession are on Saturday, the main one on Sunday morning",
    editions: (year) => {
      const sunday = nthWeekday(year, 10, SUN, 2);
      return [span(addDays(sunday, -1), sunday)];
    },
  },

  // ----- Oceania -------------------------------------------------------------
  {
    country: "AU",
    name: "Lunar New Year",
    source: CHINESE_CALENDAR_SOURCE,
    note: "Sydney's Lunar New Year festival and celebrations in Melbourne's Chinatown, with lion dances and markets",
    caveat: NOT_A_HOLIDAY,
    editions: (year) => [single(chineseDate(year, 1, 1))],
  },
  {
    country: "AU",
    name: "Sydney Gay and Lesbian Mardi Gras Parade",
    source: "Sydney Gay and Lesbian Mardi Gras, https://www.mardigras.org.au/",
    note: "Sydney: the night parade along Oxford Street, the high point of a festival of several weeks",
    editions: announced({ 2026: [["2026-02-28"]], 2027: [["2027-03-06"]] }),
  },
  {
    country: "AU",
    name: "Moomba",
    source: "City of Melbourne, https://www.melbourne.vic.gov.au/",
    note: "Melbourne: a free festival along the Yarra River over the Labour Day long weekend, with the Moomba Parade on Monday",
    editions: (year) => {
      const labourDay = nthWeekday(year, 3, MON, 2);
      return [span(addDays(labourDay, -4), labourDay)];
    },
  },
  {
    country: "AU",
    name: "Vivid Sydney",
    source: "NSW Government, https://www.nsw.gov.au/",
    note: "Sydney: light installations and projections on the Opera House and around the harbour every evening, with music and talks",
    editions: announced({ 2026: [["2026-05-22", "2026-06-13"]], 2027: [["2027-05-28", "2027-06-19"]] }),
  },
];


// ---------------------------------------------------------------------------
// Entries.

/** One festival's entries for a year: every day of every edition that falls in it. */
export function festivalEntries(festival, year) {
  const entries = [];
  for (const edition of [...festival.editions(year - 1), ...festival.editions(year)]) {
    const note = sentences(
      edition.note ?? festival.note,
      edition.first === edition.last ? "" : runs(edition.first, edition.last),
      festival.caveat,
    );
    for (let date = edition.first; date <= edition.last; date = addDays(date, 1)) {
      if (date.startsWith(`${year}-`)) {
        entries.push({ date, name: festival.name, kind: festival.kind ?? "festival", note });
      }
    }
  }
  return entries;
}

/** One supplement per festival, so each keeps its own source. */
const supplements = FESTIVALS.map((festival) => ({
  country: festival.country,
  source: `${festival.name}: ${festival.source}`,
  entries: (year) => festivalEntries(festival, year),
}));

export default supplements;
