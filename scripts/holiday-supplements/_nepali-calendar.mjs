/**
 * Nepal's calendars: Bikram Sambat (BS), the solar calendar the government
 * dates everything by, and the lunar (tithi) calendar its festivals follow,
 * both as the Nepal Panchanga Nirnayak Samiti computes them, from the Surya
 * Siddhanta.
 *
 * A helper for the supplements, not a supplement itself (its name starts
 * with "_", so the generator skips it).
 *
 * - The Sun and Moon follow the Surya Siddhanta (Burgess's translation, 1860,
 *   chapters 1 and 2): mean motions from the start of the Kali Yuga, the
 *   apsides, and the manda equation with the epicycle that shrinks from 14°
 *   (Sun) and 32° (Moon) at the apsides to 13°40′ and 31°40′ at the
 *   quadrants. Its year is longer than the sidereal year and its Moon lacks
 *   the evection, so its sankrantis and tithis differ from modern astronomy
 *   by up to several hours; the Nepali almanac keeps those differences, and
 *   so does this file.
 * - A BS month starts with the Sun's entry into a sign (sankranti). When the
 *   entry falls between sunrise and sunset, the month starts that day. At
 *   night it starts the same day if the entry is before midnight and the next
 *   day if after, except that Shrawan (the entry into Karka) keeps the evening
 *   before and Magh (Makara) moves to the morning after, as the dharmashastra
 *   rules for those two sankrantis have it.
 * - A lunar month runs from new moon to new moon and is named for the sign
 *   the Sun enters during it (Mesha: Chaitra); a month the Sun enters no sign
 *   in is an extra (adhik) month. A festival falls on the day its tithi holds
 *   at sunrise in Kathmandu (udaya), or at the time of day its worship
 *   belongs to (see `rules`).
 *
 * Checked against the BS month lengths of 2000 to 2086 BS (1943 to 2030) in
 * the published calendars (1,037 of 1,044 months; the misses are entries
 * within about 20 minutes of midnight, sunset or sunrise) and the Ministry of
 * Home Affairs' holiday lists for 2081, 2082 and 2083 BS. Sources and match
 * rates are in docs/holiday-dates.md.
 *
 * Deterministic and independent of the machine's time zone: instants are
 * Julian days (UT) and dates ISO strings built with Date.UTC.
 */
import { internals } from "./india.mjs";

const { day: sunriseDay, lunations: drikLunations } = internals;

export const KATHMANDU = { lat: 27.7172, lon: 85.324 };

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const NPT = 5.75 / 24;

const norm = (degrees) => ((degrees % 360) + 360) % 360;
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

// ---------------------------------------------------------------------------
// The Surya Siddhanta's Sun and Moon.

/** Civil days in a mahayuga of 4,320,000 years. */
const CIVIL_DAYS = 1577917828;
/** Revolutions in a mahayuga. */
const SUN_REVOLUTIONS = 4320000;
const MOON_REVOLUTIONS = 57753336;
const MOON_APSIS_REVOLUTIONS = 488203;
/** The Sun's apsis, which barely moves (387 revolutions in a kalpa). */
const SUN_APSIS = 77 + 17 / 60;
/** The Kali Yuga began at midnight at Ujjain (75.77° E), 17/18 February 3102 BCE. */
const KALI_EPOCH = 588465.5 - 75.7683 / 360;
/**
 * A small shift of the epoch, fitted to the published BS month lengths: it
 * stands for the almanac's local-time corrections (desantara and the like).
 */
const EPOCH_SHIFT = 0.01;

/** The fraction of a revolution a body has made since the Kali epoch. */
function revolutions(days, perMahayuga) {
  const x = (days * perMahayuga) / CIVIL_DAYS;
  return (x - Math.floor(x)) * 360;
}

/** The manda equation for a mean longitude, an apsis and the epicycle at the apsides. */
function trueLongitude(mean, apsis, epicycle) {
  const anomaly = (mean - apsis) * RAD;
  const periphery = epicycle - Math.abs(Math.sin(anomaly)) / 3; // 20′ less at the quadrants
  return norm(mean - Math.asin((periphery / 360) * Math.sin(anomaly)) / RAD);
}

/** The Sun's and Moon's sidereal longitudes (degrees) at an instant. */
export function longitudes(jd) {
  const days = jd - KALI_EPOCH + EPOCH_SHIFT;
  const sun = trueLongitude(revolutions(days, SUN_REVOLUTIONS), SUN_APSIS, 14);
  // At the Kali epoch the Moon's apsis was at 90°.
  const moonApsis = norm(revolutions(days, MOON_APSIS_REVOLUTIONS) + 90);
  const moon = trueLongitude(revolutions(days, MOON_REVOLUTIONS), moonApsis, 32);
  return { sun, moon };
}

const sunLongitude = (jd) => longitudes(jd).sun;
const elongation = (jd) => {
  const { sun, moon } = longitudes(jd);
  return norm(moon - sun);
};

/** Newton's method for when an angle reaches `target`, near `guess`. */
function reach(angle, rate, target, guess) {
  let t = guess;
  for (let i = 0; i < 60; i++) {
    const step = angleDiff(target, angle(t)) / rate;
    t += step;
    if (Math.abs(step) < 1e-8) break;
  }
  return t;
}

const elongationAt = (target, guess) => reach(elongation, 12.19, target, guess);

// ---------------------------------------------------------------------------
// Dates.

/** The Nepal date of an instant. */
export function nepalDate(jd) {
  return new Date(Math.floor((jd - UNIX_EPOCH_JD + NPT) * DAY_MS)).toISOString().slice(0, 10);
}

/** The instant of Nepal midnight starting a date. */
function nepalMidnight(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS + UNIX_EPOCH_JD - NPT;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const dayCache = new Map();
/** Sunrise, sunset and the next sunrise in Kathmandu on a date. */
function day(iso) {
  let info = dayCache.get(iso);
  if (!info) {
    info = sunriseDay(iso, KATHMANDU);
    dayCache.set(iso, info);
  }
  return info;
}

// ---------------------------------------------------------------------------
// Bikram Sambat.

export const BS_MONTHS = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const KARKA = 3; // the sign whose entry starts Shrawan
const MAKARA = 9; // Magh

/** The instant the Sun enters `sign` (0 Mesha to 11 Mina) in BS year `bsYear`. */
function sankrantiOf(bsYear, sign) {
  // Mesha falls about 13 April of the Gregorian year 57 below the BS year;
  // each sign after it takes about 30.44 days.
  const [y, m, d] = [bsYear - 57, 4, 13];
  const guess = Date.UTC(y, m - 1, d) / DAY_MS + UNIX_EPOCH_JD + sign * 30.44;
  return reach(sunLongitude, 0.9856, sign * 30, guess);
}

/**
 * The first day of a month, and how close the sankranti came to the moment
 * that decides it (in days), for close calls.
 */
function monthStartInfo(bsYear, month) {
  const sign = month - 1;
  const jd = sankrantiOf(bsYear, sign);
  const date = nepalDate(jd);
  const today = day(date);
  if (jd >= today.rise && jd < today.set) {
    return { date, margin: Math.min(jd - today.rise, today.set - jd) };
  }
  // At night: the evening it follows, and whether midnight has passed.
  const afterMidnight = jd < today.rise;
  const evening = afterMidnight ? addDays(date, -1) : date;
  const midnight = nepalMidnight(afterMidnight ? date : addDays(date, 1));
  const eveningSet = day(evening).set;
  const nextRise = day(addDays(evening, 1)).rise;
  const edges = Math.min(jd - eveningSet, nextRise - jd);
  if (sign === KARKA) return { date: evening, margin: edges };
  if (sign === MAKARA) return { date: addDays(evening, 1), margin: edges };
  return { date: afterMidnight ? addDays(evening, 1) : evening, margin: Math.min(edges, Math.abs(jd - midnight)) };
}

const monthCache = new Map();
/** The ISO date of the first day of BS month `month` (1 Baisakh to 12 Chaitra). */
export function bsMonthStart(bsYear, month) {
  const key = `${bsYear}-${month}`;
  let info = monthCache.get(key);
  if (!info) {
    info = monthStartInfo(bsYear, month);
    monthCache.set(key, info);
  }
  return info.date;
}

/**
 * Whether a month's start is a close call: the sankranti is within half an
 * hour of the sunrise, sunset or midnight that decides the day.
 */
export function bsMonthCloseCall(bsYear, month) {
  bsMonthStart(bsYear, month);
  return monthCache.get(`${bsYear}-${month}`).margin < 30 / 1440;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

/** The lengths of a BS year's twelve months. */
export function bsMonthLengths(bsYear) {
  const lengths = [];
  for (let month = 1; month <= 12; month++) {
    const next = month === 12 ? bsMonthStart(bsYear + 1, 1) : bsMonthStart(bsYear, month + 1);
    lengths.push(daysBetween(bsMonthStart(bsYear, month), next));
  }
  return lengths;
}

/** The ISO date of a BS date. */
export function bsToIso(bsYear, month, date) {
  return addDays(bsMonthStart(bsYear, month), date - 1);
}

// ---------------------------------------------------------------------------
// Lunar months and tithis.

export const LUNAR_MONTHS = [
  "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
  "Ashvin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna",
];

const lunationCache = new Map();

/**
 * How near a sign boundary (degrees) the Sun may be at a new moon before the
 * month's name is a close call: 0.1° is about two and a half hours, well
 * beyond how far this Surya Siddhanta can be from the almanac's.
 */
const NAMING_MARGIN = 0.1;

const boundaryDistance = (longitude) => Math.abs(longitude - Math.round(longitude / 30) * 30);

/**
 * The lunar months that start from November of the year before to the end of
 * the year. A month whose name turns on a sankranti within NAMING_MARGIN of
 * its new moon takes the name modern astronomy gives it (india.mjs), so a
 * coin toss cannot invent an extra or a lost month: on the Surya Siddhanta
 * that happens only in such near ties (2028, 2047 and 2048).
 */
function lunations(year) {
  let list = lunationCache.get(year);
  if (list) return list;
  list = [];
  const drik = [...drikLunations(year - 1), ...drikLunations(year), ...drikLunations(year + 1)];
  let start = elongationAt(0, nepalMidnight(`${year - 1}-11-01`));
  const last = nepalMidnight(`${year}-12-31`);
  while (start <= last) {
    const end = elongationAt(0, start + 29.53);
    const atStart = sunLongitude(start);
    const atEnd = sunLongitude(end);
    const first = Math.floor(atStart / 30);
    const entered = Math.floor(atEnd / 30);
    let adhik = first === entered;
    let month = adhik ? (entered + 1) % 12 : entered;
    if (Math.min(boundaryDistance(atStart), boundaryDistance(atEnd)) < NAMING_MARGIN) {
      const twin = drik.find((lunation) => Math.abs(lunation.start - start) < 1.5);
      if (twin) ({ month, adhik } = twin);
    }
    list.push({ start, end, month, adhik });
    start = end;
  }
  lunationCache.set(year, list);
  return list;
}

/** Tithi n (1 to 30: 15 is Purnima, 30 Amavasya) of a lunation, as a span of instants. */
function tithiSpan(lunation, n) {
  const at = (k) => (k === 0 ? lunation.start : k === 30 ? lunation.end : elongationAt(k * 12, lunation.start + k * 0.984));
  return { start: at(n - 1), end: at(n) };
}

/** The days a span touches, with a day either side. */
function candidates(span) {
  const days = [];
  for (let iso = addDays(nepalDate(span.start), -1); iso <= addDays(nepalDate(span.end), 1); iso = addDays(iso, 1)) {
    days.push(day(iso));
  }
  return days;
}

const overlap = ([a, b], span) => Math.max(0, Math.min(b, span.end) - Math.max(a, span.start));
const covers = ([a, b], span) => span.start <= a && b <= span.end;
const holds = (instant, span) => span.start <= instant && instant < span.end;

const windows = {
  daytime: (d) => [d.rise, d.set],
  pradosh: (d) => [d.set, d.set + (d.nextRise - d.set) / 5],
  nishita: (d) => [d.set + ((d.nextRise - d.set) * 7) / 15, d.set + ((d.nextRise - d.set) * 8) / 15],
};

/** Udaya: the first day whose sunrise the tithi holds; with none, the day it starts. */
function udaya(span) {
  const days = candidates(span);
  const held = days.find((d) => holds(d.rise, span));
  if (held) return held.iso;
  return days.find((d) => d.rise <= span.start && span.start < d.nextRise).iso;
}

/** The day whose window the tithi covers most (the earlier on a tie); with none, udaya. */
function most(window) {
  return (span) => {
    let best;
    let bestOverlap = 0;
    for (const d of candidates(span)) {
      const o = overlap(window(d), span);
      if (o > bestOverlap + 1e-9) {
        best = d;
        bestOverlap = o;
      }
    }
    return best ? best.iso : udaya(span);
  };
}

/**
 * The rules the festivals follow, each a function of a tithi's span:
 * - `udaya`: the tithi at sunrise (most festivals);
 * - `pradosh`: the evening (the three muhurtas after sunset) the tithi
 *   covers most (Laxmi Puja);
 * - `firstEvening`: the first evening the tithi reaches (Holi in the hills,
 *   the night of the full moon);
 * - `midnight`: the midnight (nishita) the tithi covers most (Janmashtami);
 * - `shivaratri`: the later of two midnights the tithi covers in full, else
 *   the one it covers most;
 * - `sunset`: the first sunset the tithi holds (Chhath's evening offering);
 * - `daytime`: the daytime the tithi covers most (Ghode Jatra's parade).
 */
export const rules = {
  udaya,
  pradosh: most(windows.pradosh),
  firstEvening(span) {
    const touched = candidates(span).find((d) => overlap(windows.pradosh(d), span) > 0);
    return touched ? touched.iso : udaya(span);
  },
  midnight: most(windows.nishita),
  shivaratri(span) {
    const full = candidates(span).filter((d) => covers(windows.nishita(d), span));
    return full.length > 0 ? full[full.length - 1].iso : most(windows.nishita)(span);
  },
  sunset(span) {
    const held = candidates(span).find((d) => holds(d.set, span));
    return held ? held.iso : udaya(span);
  },
  daytime: most(windows.daytime),
};

/**
 * The days in Gregorian `year` of tithi `n` of lunar month `monthName` (a
 * regular month, not an adhik one), by `rule`, shifted `offset` days.
 */
export function tithiDays(year, monthName, n, rule = rules.udaya, offset = 0) {
  const index = LUNAR_MONTHS.indexOf(monthName);
  if (index < 0) throw new Error(`_nepali-calendar.mjs: no lunar month named ${JSON.stringify(monthName)}`);
  const days = [];
  const years = monthName === "Pausha" ? [year, year + 1] : [year];
  for (const y of years) {
    for (const lunation of lunations(y)) {
      if (lunation.adhik || lunation.month !== index) continue;
      const date = addDays(rule(tithiSpan(lunation, n)), offset);
      if (date.startsWith(`${year}-`) && !days.includes(date)) days.push(date);
    }
  }
  return days.sort();
}
