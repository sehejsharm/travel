/**
 * The Solar Hijri calendar of Iran and Afghanistan (a helper for
 * middle-east.mjs, not a supplement: its name starts with "_").
 *
 * A year starts (1 Farvardin, Afghanistan's 1 Hamal) on the day the March
 * equinox falls before true solar noon in Tehran, and on the next day if it
 * falls after. Months 1 to 6 have 31 days, months 7 to 11 have 30, and the
 * last month has 29 or 30, whatever is left before the next year starts. The
 * year that starts in March of Gregorian year Y is Y − 621.
 *
 * The equinox is Meeus's (Astronomical Algorithms, chapter 27, via astronomia,
 * good to a minute over 1951 to 2050), less ΔT; noon is mean noon at the
 * meridian moved by the equation of time (good to half a minute). The result
 * matches jalaali-js (Borkowski's algorithm, which date-holidays uses) for
 * every year from 1990 to 2090, and Iran's published starts of the years 1399
 * to 1405 (20 or 21 March 2020 to 2026). From 2026 to 2050 the equinox is at
 * least 40 minutes from Tehran's noon (2029 is the closest), so no year start
 * there is a close call. Kabul's noon, 71 minutes earlier, would start 1408
 * on 21 March 2029 instead of the 20th.
 *
 * Deterministic and independent of the machine's time zone: Date.UTC and
 * getUTC* only.
 */
import deltat from "astronomia/deltat";
import solstice from "astronomia/solstice";

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;

/** Longitudes (degrees east) whose true noon decides the year's first day. */
export const TEHRAN = 51.4215;
export const KABUL = 69.1723;

/** Iran's month names, then Afghanistan's (Dari, zodiacal), 1 to 12. */
export const IRANIAN_MONTHS = [
  "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
  "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand",
];
export const AFGHAN_MONTHS = [
  "Hamal", "Sawr", "Jawza", "Saratan", "Asad", "Sonbola",
  "Mizan", "Aqrab", "Qaws", "Jadi", "Dalw", "Hut",
];

function isoOfMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return isoOfMs(Date.UTC(year, month - 1, day + days));
}

/** The equation of time (apparent minus mean solar time) in minutes, at a Julian day (UT). */
function equationOfTime(jd) {
  const n = jd - 2451545;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const anomaly = ((357.528 + 0.9856003 * n) * Math.PI) / 180;
  const lambda = ((meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * Math.PI) / 180;
  const obliquity = ((23.439 - 0.0000004 * n) * Math.PI) / 180;
  const ascension = ((Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)) * 180) / Math.PI + 360) % 360;
  return ((((meanLongitude - ascension + 540) % 360) - 180) * 4);
}

/** The instant (Unix ms, UT) of the March equinox of a Gregorian year. */
export function marchEquinox(year) {
  const jde = solstice.march(year);
  const jd = jde - deltat.deltaT(year + 0.22) / 86400;
  return (jd - UNIX_EPOCH_JD) * DAY_MS;
}

const cache = new Map();

/**
 * The first day of the Solar Hijri year that starts in March of a Gregorian
 * year, by true noon at `longitude`: { date, margin }, `margin` being how many
 * minutes the equinox falls before (negative) or after (positive) that noon.
 */
export function yearStart(year, longitude = TEHRAN) {
  const key = `${year}|${longitude}`;
  if (cache.has(key)) return cache.get(key);
  const equinox = marchEquinox(year);
  // The equinox's civil day at the meridian, and that day's true noon in UT.
  const offset = (longitude / 360) * DAY_MS;
  const local = new Date(equinox + offset);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const jd = equinox / DAY_MS + UNIX_EPOCH_JD;
  const noon = day + DAY_MS / 2 - offset - equationOfTime(jd) * 60_000;
  const result = {
    date: isoOfMs(equinox < noon ? day : day + DAY_MS),
    margin: Math.round((equinox - noon) / 60_000),
  };
  cache.set(key, result);
  return result;
}

/** Days before the 1st of a month (1 to 12) in a Solar Hijri year. */
function daysBefore(month) {
  return month <= 7 ? (month - 1) * 31 : 186 + (month - 7) * 30;
}

/** The Gregorian date of a Solar Hijri date (year as in 1405, month 1 to 12). */
export function toGregorian(shYear, month, day, longitude = TEHRAN) {
  return addDays(yearStart(shYear + 621, longitude).date, daysBefore(month) + day - 1);
}

/**
 * The Gregorian date in a Gregorian year of a Solar Hijri month and day, with
 * the Solar Hijri year it belongs to: { date, shYear }. Months 1 to 9 (and the
 * start of 10) fall in the year starting that March, the rest in the one
 * before. Undefined for the 30th of the last month in a year it lacks.
 */
export function inGregorianYear(year, month, day, longitude = TEHRAN) {
  for (const shYear of [year - 622, year - 621]) {
    const date = toGregorian(shYear, month, day, longitude);
    if (month === 12 && day === 30 && date === yearStart(shYear + 622, longitude).date) continue;
    if (date.startsWith(`${year}-`)) return { date, shYear };
  }
  return undefined;
}
