/**
 * Hindu and Buddhist holidays outside South Asia, where date-holidays stops
 * after the years it hard-codes, or never had them:
 *
 * - Singapore and Malaysia: Vesak Day and Deepavali, and Malaysia's
 *   Thaipusam.
 * - Indonesia: Nyepi, on the Balinese Saka calendar, and Waisak (Vesak Day).
 * - Suriname, Trinidad and Tobago, Guyana and Fiji: Phagwah (Holi) and
 *   Diwali.
 * - Mauritius: Thaipoosam Cavadee, Maha Shivaratree, Ugadi, Ganesh Chaturthi
 *   and Divali, whose library dates after 2026 are a projection that drifts
 *   from the Hindu calendar.
 *
 * The Hindu dates use india.mjs's lunisolar calendar (its Sun, Moon, tithis,
 * lunations and sankrantis). Each country follows its own reckoning, found by
 * checking the rules against its published dates (docs/holiday-dates.md):
 *
 * - Singapore and Malaysia keep Deepavali on Naraka Chaturdashi as Tamil
 *   almanacs do (Chaturdashi before dawn), and Thaipusam on the Pusam star of
 *   the Tamil month of Thai, both by local time.
 * - Fiji keeps Diwali on the night of Amavasya by Fiji time.
 * - Trinidad and Tobago, Guyana, Suriname and Mauritius keep Diwali, and
 *   Mauritius its other Hindu holidays, on India's dates (Mauritius's Ganesh
 *   Chaturthi holiday is the day after). Phagwah in Suriname and Guyana is
 *   the day after the Holika bonfire, by local time.
 * - Vesak follows the Chinese calendar in Singapore and Malaysia, and the
 *   moment of the full moon in Indonesia. Nyepi follows the arithmetic of the
 *   Balinese lunar calendar.
 *
 * Library dates are kept for the years they are official, and replaced where
 * they are a projection that the published dates contradict. Every rule was
 * checked against published dates; the checks, sources and match rates are in
 * docs/holiday-dates.md, and src/lib/reference/diaspora-holidays.test.ts holds
 * them.
 *
 * All arithmetic is in Julian days or on UTC dates, so the output never
 * depends on the machine's time zone.
 */
import Holidays from "date-holidays";
import { lunisolarDate } from "../build-holidays.mjs";
import { indiaEntries, internals } from "./india.mjs";

const { day, lunations, tithi, sankrantiIn, siderealMoon, elongation } = internals;

// ---------------------------------------------------------------------------
// Dates and instants. Instants are Julian days (UT); dates are "YYYY-MM-DD".

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const SUN = 0;
const MON = 1;
const SAT = 6;

const LUNAR = "Lunar date, estimated: the official date can differ by a day.";

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The civil date of an instant in a place's standard time. */
function dateAt(jd, place) {
  return new Date(Math.floor((jd - UNIX_EPOCH_JD + place.tz / 24) * DAY_MS)).toISOString().slice(0, 10);
}

/** Midnight at the start of a civil date in a place's standard time. */
function midnightAt(iso, place) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS + UNIX_EPOCH_JD - place.tz / 24;
}

/** Notes are sentences: each part gets a full stop, and they join with a space. */
function note(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(" ");
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const longDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]}`;
const otherDay = (iso) => iso && `Some calendars give ${longDate(iso)}`;

// ---------------------------------------------------------------------------
// Places. tz is the standard time offset in hours; none of them keeps
// daylight saving time.

export const PLACES = {
  SINGAPORE: { lat: 1.2897, lon: 103.8501, tz: 8 },
  KUALA_LUMPUR: { lat: 3.1478, lon: 101.6953, tz: 8 },
  JAKARTA: { lat: -6.1754, lon: 106.8272, tz: 7 },
  PORT_LOUIS: { lat: -20.1609, lon: 57.5012, tz: 4 },
  SUVA: { lat: -18.1416, lon: 178.4419, tz: 12 },
  PORT_OF_SPAIN: { lat: 10.6549, lon: -61.5019, tz: -4 },
  GEORGETOWN: { lat: 6.8013, lon: -58.1551, tz: -4 },
  PARAMARIBO: { lat: 5.852, lon: -55.2038, tz: -3 },
};

// ---------------------------------------------------------------------------
// Which civil day a tithi's festival falls on, at a place: india.mjs's rules
// (see RULES there), with the place's sunrise, sunset and calendar date.

const windows = {
  pradosh: (d) => [d.set, d.set + (d.nextRise - d.set) / 5],
  arunodaya: (d) => [d.rise - 96 / 1440, d.rise],
};

function overlap(window, d, span) {
  const [a, b] = window(d);
  return Math.max(0, Math.min(b, span.end) - Math.max(a, span.start));
}

/** The days a span touches at a place, with a day either side. */
function candidates(span, place) {
  const days = [];
  for (let iso = addDays(dateAt(span.start, place), -1); iso <= addDays(dateAt(span.end, place), 1); iso = addDays(iso, 1)) {
    days.push(day(iso, place));
  }
  return days;
}

const holdsSunrise = (d, span) => span.start <= d.rise && d.rise < span.end;
const startsOn = (d, span) => d.rise <= span.start && span.start < d.nextRise;

/** Udaya: the day whose sunrise the tithi holds (the first of two); with none, the day it starts on. */
function udaya(span, place) {
  const days = candidates(span, place);
  const held = days.find((d) => holdsSunrise(d, span));
  return (held ?? days.find((d) => startsOn(d, span))).iso;
}

/** Diwali: the evening whose pradosh Amavasya covers most (the earlier on a tie); with none, udaya. */
function diwaliRule(span, place) {
  let best;
  let bestOverlap = 0;
  for (const d of candidates(span, place)) {
    const o = overlap(windows.pradosh, d, span);
    if (o > bestOverlap + 1e-9) {
      best = d;
      bestOverlap = o;
    }
  }
  return best ? best.iso : udaya(span, place);
}

/** Naraka Chaturdashi: the first day whose arunodaya (the 96 minutes before sunrise) the tithi touches; with none, udaya. */
function narakaRule(span, place) {
  const touched = candidates(span, place).find((d) => overlap(windows.arunodaya, d, span) > 0);
  return touched ? touched.iso : udaya(span, place);
}

/**
 * Holika Dahan, the bonfire on the eve of Phagwah, as india.mjs decides it:
 * the evening whose pradosh Purnima holds after Bhadra (its first half) is
 * over, with the place's evenings.
 */
function holikaRule(span, place) {
  const days = candidates(span, place);
  const first = days.findIndex((d) => startsOn(d, span));
  const bhadraEnd = (span.start + span.end) / 2;
  const free = (d) => {
    const [a, b] = windows.pradosh(d);
    return Math.max(a, bhadraEnd) < Math.min(b, span.end);
  };
  const evenings = [days[first], days[first + 1]].filter((d) => overlap(windows.pradosh, d, span) > 0);
  if (evenings.length === 2) return (free(evenings[0]) ? evenings[0] : free(evenings[1]) ? evenings[1] : evenings[0]).iso;
  if (evenings.length === 1) {
    const [evening] = evenings;
    const next = days[days.indexOf(evening) + 1];
    const midnight = evening.set + (evening.nextRise - evening.set) / 2;
    if (!free(evening) && bhadraEnd >= midnight) {
      const remaining = span.end - next.rise;
      const daytime = next.set - next.rise;
      const elongationAt = (target, guess) => reachAngle(elongation, 12.19, target, guess);
      const pratipadaLonger = () => elongationAt(192, span.end + 1) - span.end > span.end - span.start;
      if (remaining * 8 >= daytime * 7 || (remaining * 4 >= daytime * 3 && pratipadaLonger())) return next.iso;
    }
    return evening.iso;
  }
  return span.start < days[first].set ? days[first].iso : days[first + 1].iso;
}

/** Newton's method for when `angle(jd)` reaches `target` (degrees), near `guess`. */
function reachAngle(angle, rate, target, guess) {
  let t = guess;
  for (let i = 0; i < 30; i++) {
    const step = ((((target - angle(t) + 540) % 360) - 180) / rate);
    t += step;
    if (Math.abs(step) < 1e-7) break;
  }
  return t;
}

const ASHVIN = 6;
const PHALGUNA = 11;

/** Tithi n of each regular (not adhik) amanta month of a number that starts around a year. */
function tithisOf(year, monthNumber, n) {
  return lunations(year)
    .filter((lunation) => !lunation.adhik && lunation.month === monthNumber)
    .map((lunation) => tithi(lunation, n));
}

/** A tithi festival's day at a place in a year, by a rule, plus `after` days. */
function tithiDate(year, place, monthNumber, n, rule, after = 0) {
  for (const span of tithisOf(year, monthNumber, n)) {
    const date = addDays(rule(span, place), after);
    if (date.startsWith(String(year))) return date;
  }
  return undefined;
}

/** Diwali (Lakshmi Puja) by a place's evenings. */
export const localDiwali = (year, place) => tithiDate(year, place, ASHVIN, 30, diwaliRule);

/** Phagwah, the day after the Holika bonfire, by a place's evenings. */
export const phagwah = (year, place) => tithiDate(year, place, PHALGUNA, 15, holikaRule, 1);

/** The first day of a Tamil solar month (the Sun entering sidereal sign `sign`), by the sunset rule. */
function tamilMonthStart(year, sign, place) {
  const jd = sankrantiIn(year, sign);
  const iso = dateAt(jd, place);
  return jd < day(iso, place).set ? iso : addDays(iso, 1);
}

/**
 * Deepavali as Singapore and Malaysia keep it, by the Tamil almanac: Naraka
 * Chaturdashi (the 14th of the waning Moon, while it holds the hour before
 * dawn) in the Tamil month of Aippasi.
 */
export function tamilDeepavali(year, place) {
  const aippasi = tamilMonthStart(year, 6, place);
  const karthigai = tamilMonthStart(year, 7, place);
  for (const lunation of lunations(year)) {
    const date = narakaRule(tithi(lunation, 29), place);
    if (date >= aippasi && date < karthigai) return date;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// India's dates, which the Caribbean and Mauritius follow.

const indiaCache = new Map();

/** India's date for one of india.mjs's festivals in a year. */
export function indiaDate(name, year) {
  let list = indiaCache.get(year);
  if (!list) {
    list = indiaEntries(year);
    indiaCache.set(year, list);
  }
  return list.find((entry) => entry.name === name)?.date;
}

// ---------------------------------------------------------------------------
// Thaipusam: the Pusam (Pushya) nakshatra of the Tamil month of Thai.

const NAKSHATRA = 360 / 27;
const PUSHYA = 7; // the 8th nakshatra, Pusam in Tamil

/** How much of a span lies in a civil day at a place, in days. */
function inDay(iso, start, end, place) {
  const a = midnightAt(iso, place);
  return Math.max(0, Math.min(end, a + 1) - Math.max(start, a));
}

/** The civil day that holds most of a span (the earlier on a tie), and the runner-up's shortfall in hours. */
function mainDay(start, end, place) {
  const shares = [];
  for (let iso = dateAt(start, place); iso <= dateAt(end, place); iso = addDays(iso, 1)) {
    shares.push({ iso, share: inDay(iso, start, end, place) });
  }
  const ranked = [...shares].sort((a, b) => b.share - a.share || (a.iso < b.iso ? -1 : 1));
  return {
    date: ranked[0].iso,
    runnerUp: ranked[1]?.iso,
    margin: ((ranked[0].share - (ranked[1]?.share ?? 0)) * 24),
  };
}

/**
 * Thaipusam in a year at a place: the full moon of Thai (the one that falls
 * while the Sun is in sidereal Capricorn) and the Pusam nakshatra beside it.
 * The festival is on the day that holds most of the time Pusam and the
 * full-moon tithi run together or, when they do not meet, most of Pusam.
 * Returns the date and, when the call is within two hours, the other day.
 */
export function thaipusam(year, place) {
  const thai = sankrantiIn(year, 9);
  const masi = sankrantiIn(year, 10);
  const purnima = lunations(year)
    .map((lunation) => tithi(lunation, 15))
    .find((span) => span.end >= thai && span.end < masi);
  const start = reachAngle(siderealMoon, 13.18, PUSHYA * NAKSHATRA, purnima.end - 1);
  const end = reachAngle(siderealMoon, 13.18, (PUSHYA + 1) * NAKSHATRA, start + 1);
  const from = Math.max(start, purnima.start);
  const to = Math.min(end, purnima.end);
  const main = to > from ? mainDay(from, to, place) : mainDay(start, end, place);
  return { date: main.date, alternative: main.margin < 2 ? main.runnerUp : undefined };
}

// ---------------------------------------------------------------------------
// Vesak.

/** Singapore's Vesak Day: the 15th of the 4th Chinese month, as the Singapore Buddhist Federation sets it. */
export function chineseVesak(year) {
  return lunisolarDate("chinese", year, 4, 15);
}

const dayNumberOf = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

/**
 * Malaysia's Wesak Day: the 15th day of the Chinese month nearest the middle
 * of May (16 May at 18:00). Malaysia's Buddhist council keeps Vesak in May,
 * so in a year whose 4th Chinese month starts late it keeps the full moon a
 * month before Singapore's (4 May 2023, 3 May 2015), but takes 31 May over
 * 1 May (2026).
 */
export function malaysianWesak(year) {
  const fifteenths = [];
  for (const [month, leap] of [[2, true], [3, false], [3, true], [4, false], [4, true]]) {
    const date = lunisolarDate("chinese", year, month, 15, leap);
    if (date) fifteenths.push(date);
  }
  return nearestMidMay(year, fifteenths);
}

/** Of some dates, the one nearest 16 May at 18:00. */
export function nearestMidMay(year, dates) {
  const target = dayNumberOf(`${year}-05-16`) + 0.75;
  return [...dates].sort((a, b) => Math.abs(dayNumberOf(a) - target) - Math.abs(dayNumberOf(b) - target))[0];
}

/**
 * Indonesia's Waisak: the day, in Jakarta, of the full moon nearest the 15th
 * of the 4th Chinese month. The Buddhist councils mark the moment of the full
 * moon itself, which can fall a day after the 15th. Returns the date and,
 * when the full moon is within an hour of midnight, the other day.
 */
export function waisak(year) {
  return fullMoonDayNear(chineseVesak(year));
}

/** The Jakarta day of the full moon nearest a date, and the other day when it is within an hour of midnight. */
export function fullMoonDayNear(iso) {
  const full = reachAngle(elongation, 12.19, 180, midnightAt(iso, PLACES.JAKARTA) + 0.5);
  const date = dateAt(full, PLACES.JAKARTA);
  const intoDay = full - midnightAt(date, PLACES.JAKARTA);
  const alternative = intoDay < 1 / 24 ? addDays(date, -1) : intoDay > 23 / 24 ? addDays(date, 1) : undefined;
  return { date, alternative };
}

// ---------------------------------------------------------------------------
// Nyepi: the Balinese Saka lunar calendar.
//
// Bali's lunar days (penanggal and pangelong, 15 each, ending in Purnama, the
// full moon, and Tilem, the new moon) are counted, not observed: 64 lunar days
// to every 63 solar days, so every 63rd day holds two lunar days
// (ngunaratri). BALI_EPOCH (in days since 1970) places the count: it is fitted
// to every Nyepi from 2009 to 2027, and is the one setting that also puts a
// ngunaratri on Anggara Paing of the week Sungsang, as the Eka Sungsang ke
// Paing rule in use since 2000 says. Nyepi is the day after Tilem Kesanga,
// the new moon of the 9th month. Bali's leap months follow a 19-year cycle,
// so each year's Tilem Kesanga is the Tilem nearest the one 19 years before.

const BALI_EPOCH = 6.1;

/** The Balinese lunar day count at the start of a day number; 0 is the first lunar day of a month. */
const baliCount = (dayNumber) => Math.floor((64 * (dayNumber - BALI_EPOCH)) / 63);

/** Whether a day number is a Tilem: a day holding the 30th lunar day of a month. */
function isTilem(dayNumber) {
  for (let k = baliCount(dayNumber); k < baliCount(dayNumber + 1); k++) {
    if (((k % 30) + 30) % 30 === 29) return true;
  }
  return false;
}

/** Whether a day number holds two lunar days (ngunaratri). */
const isNgunaratri = (dayNumber) => baliCount(dayNumber + 1) - baliCount(dayNumber) === 2;

const isoOfDayNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Nyepi from 2009 to 2027, as the joint ministerial decrees (SKB) set it. */
export const NYEPI_PUBLISHED = {
  2009: "03-26", 2010: "03-16", 2011: "03-05", 2012: "03-23", 2013: "03-12", 2014: "03-31",
  2015: "03-21", 2016: "03-09", 2017: "03-28", 2018: "03-17", 2019: "03-07", 2020: "03-25",
  2021: "03-14", 2022: "03-03", 2023: "03-22", 2024: "03-11", 2025: "03-29", 2026: "03-19",
  2027: "03-08",
};

/** Nyepi, the Balinese New Year (the day after Tilem Kesanga), in a year. */
export function nyepi(year) {
  const cycleYear = 2009 + ((((year - 2009) % 19) + 19) % 19);
  const reference = dayNumberOf(`${year}-${NYEPI_PUBLISHED[cycleYear]}`) - 1;
  let best;
  for (let n = reference - 20; n <= reference + 20; n++) {
    if (isTilem(n) && (best === undefined || Math.abs(n - reference) < Math.abs(best - reference))) best = n;
  }
  return isoOfDayNumber(best + 1);
}

/** The Balinese count, for the tests. */
export const bali = {
  isTilem: (iso) => isTilem(dayNumberOf(iso)),
  isNgunaratri: (iso) => isNgunaratri(dayNumberOf(iso)),
};

// ---------------------------------------------------------------------------
// Substitute days.

const libraryDaysOff = new Map();

/** The library's public holidays in a country and year, as a set of dates. */
function daysOffIn(country, year) {
  const key = `${country}|${year}`;
  let set = libraryDaysOff.get(key);
  if (!set) {
    const holidays = new Holidays(country);
    set = new Set((holidays.getHolidays(year) ?? []).filter((h) => h.type === "public").map((h) => h.date.slice(0, 10)));
    libraryDaysOff.set(key, set);
  }
  return set;
}

/**
 * A holiday's substitute day, when it falls on one of `weekdays`: the next
 * day that is neither a weekend day nor already a public holiday.
 */
function substitute(entry, country, weekdays, text) {
  if (!weekdays.includes(weekdayOf(entry.date))) return [];
  const taken = daysOffIn(country, Number(entry.date.slice(0, 4)));
  let date = addDays(entry.date, 1);
  while (weekdayOf(date) === SAT || weekdayOf(date) === SUN || taken.has(date)) date = addDays(date, 1);
  const on = `${WEEKDAY_NAMES[weekdayOf(entry.date)]} ${longDate(entry.date)}`;
  return [{ date, name: `${entry.name} (substitute day)`, kind: entry.kind, note: note(`${entry.name} falls on ${on}`, text) }];
}

/** An entry plus its Sunday substitute. */
const withSundaySubstitute = (entry, country, text) => [entry, ...substitute(entry, country, [SUN], text)];

// ---------------------------------------------------------------------------
// The countries.

const DEEPAVALI = "Festival of lights. Hindu homes are lit with oil lamps and open to visitors";
const PHAGWAH = "Hindu spring festival, with coloured powder and water thrown in the streets";

/** Years whose library Deepavali in Singapore and Malaysia is a projection the Tamil almanac contradicts. */
const SG_MY_DEEPAVALI_FROM = 2028;

function deepavaliSgMy(year, place, text) {
  if (year < SG_MY_DEEPAVALI_FROM) return [];
  const date = tamilDeepavali(year, place);
  const india = indiaDate("Naraka Chaturdashi", year);
  return [{ date, name: "Deepavali", kind: "public", note: note(DEEPAVALI, text, india !== date && otherDay(india), LUNAR) }];
}

function singaporeEntries(year) {
  const entries = [];
  if (year >= 2027) {
    entries.push(
      ...withSundaySubstitute(
        {
          date: chineseVesak(year),
          name: "Vesak Day",
          kind: "public",
          note: note("The Buddha's birth, enlightenment and death. Temples are crowded, and many hold candle-lit processions at night", LUNAR),
        },
        "SG",
      ),
    );
  }
  for (const entry of deepavaliSgMy(year, PLACES.SINGAPORE, "Little India is lit up for weeks before")) {
    entries.push(...withSundaySubstitute(entry, "SG"));
  }
  return entries;
}

const MY_SUBSTITUTE = "Kedah, Kelantan and Terengganu, whose weekend is Friday and Saturday, can differ";

/** Malaysian dates the government notified that the library does not have. */
const MY_NOTIFIED = {
  2026: [
    {
      date: "2026-06-02",
      name: "Vesak Day (substitute day)",
      kind: "public",
      note: "Vesak Day falls on Sunday 31 May, and Monday 1 June is the Yang di-Pertuan Agong's Birthday. Private employers who give Wesak off give this day instead.",
    },
  ],
};

function malaysiaEntries(year) {
  const entries = [...(MY_NOTIFIED[year] ?? [])];
  if (year >= 2027) {
    const wesak = malaysianWesak(year);
    const singapore = chineseVesak(year);
    entries.push(
      ...withSundaySubstitute(
        {
          date: wesak,
          name: "Vesak Day",
          kind: "public",
          note: note(
            "Wesak, for the Buddha's birth, enlightenment and death, with candle-lit processions at night",
            wesak !== singapore && `Malaysia's Buddhist council sets the date, and could choose ${longDate(singapore)}, as Singapore does`,
            LUNAR,
          ),
        },
        "MY",
        MY_SUBSTITUTE,
      ),
    );
    const { date, alternative } = thaipusam(year, PLACES.KUALA_LUMPUR);
    entries.push({
      date,
      name: "Thaipusam",
      kind: "optional",
      note: note(
        "Hindu festival of Murugan. Huge processions of kavadi bearers climb to the Batu Caves near Kuala Lumpur, and fill the streets of George Town",
        "Day off in Johor, Kedah, Kuala Lumpur, Negeri Sembilan, Penang, Perak, Putrajaya and Selangor",
        otherDay(alternative),
        LUNAR,
      ),
    });
  }
  for (const entry of deepavaliSgMy(year, PLACES.KUALA_LUMPUR, "Not a day off in Sarawak")) {
    entries.push(...withSundaySubstitute(entry, "MY", MY_SUBSTITUTE));
  }
  return entries;
}

function indonesiaEntries(year) {
  if (year < 2028) return [];
  const { date, alternative } = waisak(year);
  return [
    {
      date: nyepi(year),
      name: "Nyepi",
      kind: "public",
      note: note(
        "Balinese New Year, the Day of Silence. Bali shuts down for 24 hours from 6 am, the airport included, and visitors must stay in their hotels",
        "Bali's calendar is counted, not observed, and this date is computed from its rules",
        LUNAR,
      ),
    },
    {
      date,
      name: "Vesak Day",
      kind: "public",
      note: note("Waisak. Monks walk in procession from Mendut to Borobudur, which is very crowded", otherDay(alternative), LUNAR),
    },
  ];
}

/** Deepavali on India's date, with the local evening's date as the alternative. */
function caribbeanDeepavali(year, place, name) {
  const date = indiaDate("Diwali", year);
  const local = localDiwali(year, place);
  return { date, name, kind: "public", note: note(DEEPAVALI, local !== date && otherDay(local), LUNAR) };
}

function phagwahEntry(year, place, name) {
  const date = phagwah(year, place);
  const india = indiaDate("Holi", year);
  return { date, name, kind: "public", note: note(PHAGWAH, india !== date && `India keeps Holi on ${longDate(india)}`, LUNAR) };
}

function surinameEntries(year) {
  if (year < 2027) return [];
  return [phagwahEntry(year, PLACES.PARAMARIBO, "Holi Phagwa"), caribbeanDeepavali(year, PLACES.PARAMARIBO, "Deepavali")];
}

function trinidadEntries(year) {
  if (year < 2027) return [];
  return withSundaySubstitute(caribbeanDeepavali(year, PLACES.PORT_OF_SPAIN, "Deepavali"), "TT");
}

function guyanaEntries(year) {
  return [
    ...withSundaySubstitute(phagwahEntry(year, PLACES.GEORGETOWN, "Phagwah"), "GY"),
    ...withSundaySubstitute(caribbeanDeepavali(year, PLACES.GEORGETOWN, "Deepavali"), "GY"),
  ];
}

function fijiEntries(year) {
  const date = localDiwali(year, PLACES.SUVA);
  const india = indiaDate("Diwali", year);
  const weekend = weekdayOf(date) === SAT || weekdayOf(date) === SUN;
  const monday = weekend ? addDays(date, (MON - weekdayOf(date) + 7) % 7) : undefined;
  const text = (...extra) =>
    note(
      DEEPAVALI,
      "The Sanatan Dharam Pratinidhi Sabha of Fiji sets the day by Fiji time",
      india !== date && `India keeps it on ${longDate(india)}`,
      ...extra,
      LUNAR,
    );
  if (!weekend) return [{ date, name: "Diwali", kind: "public", note: text() }];
  return [
    { date, name: "Diwali", kind: "festival", note: text(`The public holiday is on Monday ${longDate(monday)}`) },
    { date: monday, name: "Diwali (substitute day)", kind: "public", note: note(`Diwali falls on ${WEEKDAY_NAMES[weekdayOf(date)]} ${longDate(date)}`) },
  ];
}

/** Mauritius's Hindu holidays: [name in the library, India's festival, days after, note]. */
const MAURITIUS = [
  ["Maha Shivaratree", "Maha Shivaratri", 0, "Night-long worship of Shiva. Pilgrims walk to the sacred lake of Grand Bassin in the days before, so roads there are busy"],
  ["Ugadi", "Ugadi and Gudi Padwa", 0, "Ougadi, the Telugu New Year"],
  ["Ganesh Chaturthi", "Ganesh Chaturthi", 1, "Birth of Ganesh. Mauritius keeps the holiday the day after the festival"],
  ["Divali", "Diwali", 0, DEEPAVALI],
];

/** A Mauritian Hindu holiday's date by the rules (Thaipoosam Cavadee, or one of MAURITIUS). */
export function mauritiusDate(name, year) {
  if (name === "Thaipoosam Cavadee") return thaipusam(year, PLACES.PORT_LOUIS).date;
  const [, india, after] = MAURITIUS.find(([own]) => own === name);
  return addDays(indiaDate(india, year), after);
}

/** Mauritian dates the government notified that the rules do not give. */
const MU_NOTIFIED = {
  2026: {
    "Ganesh Chaturthi": ["2026-09-15", "Birth of Ganesh. Moved from 16 September by Government Notice No. 611 of 2026"],
  },
};

function mauritiusEntries(year) {
  const notified = MU_NOTIFIED[year] ?? {};
  const entries = [];
  if (year >= 2027) {
    const { date, alternative } = thaipusam(year, PLACES.PORT_LOUIS);
    entries.push({
      date,
      name: "Thaipoosam Cavadee",
      kind: "public",
      note: note("Tamil festival of Murugan. Devotees carry the cavadee in processions to the temples", otherDay(alternative), LUNAR),
    });
    for (const [name, , , text] of MAURITIUS) {
      if (notified[name]) continue;
      entries.push({ date: mauritiusDate(name, year), name, kind: "public", note: note(text, LUNAR) });
    }
  }
  for (const [name, [date, text]] of Object.entries(notified)) entries.push({ date, name, kind: "public", note: note(text) });
  return entries;
}

const COMPUTED = "computed from the Hindu lunisolar calendar (Meeus, Astronomical Algorithms; Lahiri ayanamsa)";

const supplements = [
  {
    country: "SG",
    source:
      "Ministry of Manpower, public holidays, https://www.mom.gov.sg/employment-practices/public-holidays; " +
      `Vesak Day from 2027 by the Chinese calendar, and Deepavali from 2028 by the Tamil almanac, ${COMPUTED}`,
    drop: [
      // Projections the Tamil almanac contradicts (2028: 15 November for 17
      // October; 2030: 25 October for 26 October). 2029 is recomputed too.
      { name: "Deepavali", from: SG_MY_DEEPAVALI_FROM, to: 2030 },
    ],
    entries: singaporeEntries,
  },
  {
    country: "MY",
    source:
      "Prime Minister's Department and Ministry of Human Resources holiday notices, https://jtksm.mohr.gov.my/; " +
      `Wesak from 2027 by the Chinese calendar, and Thaipusam from 2027 and Deepavali from 2028 by the Tamil almanac, ${COMPUTED}`,
    drop: [{ name: "Deepavali", from: SG_MY_DEEPAVALI_FROM, to: 2030 }],
    entries: malaysiaEntries,
  },
  {
    country: "ID",
    source:
      "Joint ministerial decrees (SKB 3 Menteri) on national holidays, https://setneg.go.id/; " +
      "Nyepi after 2027 from the Balinese Saka calendar, Waisak from the full moon (Meeus, Astronomical Algorithms)",
    entries: indonesiaEntries,
  },
  {
    country: "SR",
    source: `Government of Suriname, https://gov.sr/; Holi Phagwa and Deepavali after 2026 ${COMPUTED}`,
    // Library projections: 2029's Holi is a month out, and 2027's and 2030's
    // Deepavali a day before India's. 2028 is recomputed too.
    drop: [
      { name: "Holi Phagwa", from: 2027, to: 2030 },
      { name: "Deepavali", from: 2027, to: 2030 },
    ],
    entries: surinameEntries,
  },
  {
    country: "TT",
    source: `Government of Trinidad and Tobago, legal notices under the Public Holidays and Festivals Act, https://printery.gov.tt/; Divali after 2026 ${COMPUTED}`,
    drop: [{ name: "Deepavali", from: 2027, to: 2030 }],
    entries: trinidadEntries,
  },
  {
    country: "GY",
    source: `Government of Guyana holiday notices, https://mops.gov.gy/; Phagwah and Deepavali from 2026 ${COMPUTED}`,
    entries: guyanaEntries,
  },
  {
    country: "FJ",
    source: `Fiji Government public holiday notices, https://www.fiji.gov.fj/; Diwali from 2026 ${COMPUTED}, for Fiji time`,
    entries: fijiEntries,
  },
  {
    country: "MU",
    source: `Prime Minister's Office, public holiday notices, https://pmo.govmu.org/; Hindu holidays after 2026 ${COMPUTED}`,
    // The library's dates after 2026 are a projection that drifts from the
    // Hindu calendar (Maha Shivaratree 2030 three days late, Thaipoosam
    // Cavadee 2049 three days early, two Ganesh Chaturthis and a Divali left on
    // placeholder days). 2026's Ganesh Chaturthi was moved by notice.
    drop: [
      { name: "Thaipoosam Cavadee", from: 2027 },
      { name: "Maha Shivaratree", from: 2027 },
      { name: "Ugadi", from: 2027 },
      { name: "Ganesh Chaturthi", from: 2026 },
      { name: "Divali", from: 2027 },
    ],
    entries: mauritiusEntries,
  },
];

export default supplements;
