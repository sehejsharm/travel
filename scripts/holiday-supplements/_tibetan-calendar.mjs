/**
 * The Tibetan (Kalachakra) lunisolar calendar in three versions: Phugpa (the
 * Tibetan standard, kept by Kalmykia's Buddhists), Mongolian (Mongolia,
 * Buryatia, Tuva) and Bhutanese.
 *
 * A helper for the supplements, not a supplement itself (its name starts
 * with "_", so the generator skips it).
 *
 * The arithmetic is Svante Janson's, "Tibetan calendar mathematics"
 * (Uppsala, 2007, revised 2014), https://www2.math.uu.se/~svantejs/papers/calendars/tibet.pdf:
 *
 * - Month count. A month is (Y, M): year Y, the Gregorian year its New Year
 *   falls in, and number M, 1 to 12. With M' = 12(Y − Y0) + M, the true month
 *   count is n = ⌊(67M' − β)/65⌋. When (67M' − β) mod 65 is 0 or 1 the number
 *   is doubled: in Tibet and Mongolia the leap month (n − 1) comes before the
 *   regular one, in Bhutan the regular month (n − 1) comes first.
 * - Lunar days. Lunar day d (1 to 30) of month n ends at the true date
 *   mean + moon/60 − sun/60, where mean = n·m1 + d·m2 + m0, the Moon's
 *   anomaly is n·a1 + d·a2 + a0 and the Sun's mean longitude n·s1 + d·s2 + s0,
 *   and the equations come from the traditional tables (moon_tab, sun_tab)
 *   with linear interpolation. The integer part is the Julian Day Number of
 *   the calendar day on which the lunar day ends.
 * - Calendar days. A day is numbered for the lunar day that ends in it. When
 *   two end in one day, the day takes the first number and the second is
 *   skipped; when none ends, the next number is repeated (the first of the
 *   two days is the leap day).
 *
 * Epoch constants are Janson's: E806 for Phugpa (sections 5 and 7), E1747
 * for the Mongolian version and E1754 for the Bhutanese (appendix A). The
 * arithmetic is exact (BigInt fractions), so no date can tip over a day
 * boundary through rounding.
 *
 * Deterministic and independent of the machine's time zone: dates are ISO
 * strings built with Date.UTC.
 */

// ---------------------------------------------------------------------------
// Exact fractions, as [numerator, denominator] BigInt pairs.

const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

function frac(numerator, denominator = 1n) {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const g = gcd(n, d) || 1n;
  return d < 0n ? [-n / g, -d / g] : [n / g, d / g];
}

const add = ([a, b], [c, d]) => frac(a * d + c * b, b * d);
const sub = ([a, b], [c, d]) => frac(a * d - c * b, b * d);
const times = ([a, b], k) => frac(a * BigInt(k), b);
const over = ([a, b], k) => frac(a, b * BigInt(k));

/** ⌊x⌋ as a BigInt. */
function floor([a, b]) {
  const q = a / b;
  return a < 0n && q * b !== a ? q - 1n : q;
}

/** x − ⌊x⌋. */
const fractional = (x) => sub(x, [floor(x), 1n]);

// ---------------------------------------------------------------------------
// The tables.

const MOON_TAB = [0, 5, 10, 15, 19, 22, 24, 25];
const SUN_TAB = [0, 6, 10, 11];

/** moon_tab(i) for a whole i: a quarter wave over 28 steps. */
function moonTab(i) {
  const k = ((i % 28) + 28) % 28;
  if (k <= 7) return MOON_TAB[k];
  if (k <= 14) return MOON_TAB[14 - k];
  if (k <= 21) return -MOON_TAB[k - 14];
  return -MOON_TAB[28 - k];
}

/** sun_tab(i) for a whole i: a quarter wave over 12 steps. */
function sunTab(i) {
  const k = ((i % 12) + 12) % 12;
  if (k <= 3) return SUN_TAB[k];
  if (k <= 6) return SUN_TAB[6 - k];
  if (k <= 9) return -SUN_TAB[k - 6];
  return -SUN_TAB[12 - k];
}

/** A table at a fractional argument x, by linear interpolation. */
function interpolate(table, x) {
  const i = Number(floor(x));
  const t = fractional(x);
  const low = table(i);
  return add([BigInt(low), 1n], times(t, table(i + 1) - low));
}

// ---------------------------------------------------------------------------
// The versions.

const M1 = frac(167025, 5656);
const M2 = frac(167025, 5656 * 30);
const S1 = frac(65, 804);
const S2 = frac(65, 804 * 30);
const A1 = frac(253, 3528);
const A2 = frac(1, 28);

/**
 * Each version: its epoch year Y0, β, whether a leap month follows the
 * regular one, and the mean date, mean Sun and Moon's anomaly at the epoch.
 */
export const VERSIONS = {
  phugpa: {
    y0: 806,
    beta: 123,
    leapAfter: false,
    m0: add([2015501n, 1n], frac(4783, 5656)),
    s0: frac(743, 804),
    a0: frac(475, 3528),
  },
  mongolian: {
    y0: 1747,
    beta: 172,
    leapAfter: false,
    m0: add([2359237n, 1n], frac(2603, 2828)),
    s0: frac(397, 402),
    a0: frac(1523, 1764),
  },
  bhutanese: {
    y0: 1754,
    beta: 191,
    leapAfter: true,
    m0: add([2361807n, 1n], frac(52, 707)),
    s0: frac(1, 67),
    a0: frac(17, 147),
  },
};

function version(name) {
  const v = VERSIONS[name];
  if (!v) throw new Error(`_tibetan-calendar.mjs: no version named ${JSON.stringify(name)}`);
  return v;
}

/**
 * The true month counts of month M of year Y: `regular`, and `leap` when the
 * number is doubled that year.
 */
export function monthCounts(name, year, month) {
  const v = version(name);
  const k = 67 * (12 * (year - v.y0) + month) - v.beta;
  const n = Math.floor(k / 65);
  const doubled = ((k % 65) + 65) % 65 <= 1;
  if (!doubled) return { regular: n };
  return v.leapAfter ? { regular: n - 1, leap: n } : { regular: n, leap: n - 1 };
}

/** The months of a year that are doubled (usually none, at most one). */
export function leapMonths(name, year) {
  const months = [];
  for (let month = 1; month <= 12; month++) {
    if (monthCounts(name, year, month).leap !== undefined) months.push(month);
  }
  return months;
}

const trueDateCache = new Map();

/** The true date (a Julian day) at which lunar day d (0 to 30) of true month n ends. */
export function trueDate(name, n, d) {
  const key = `${name}|${n}|${d}`;
  let value = trueDateCache.get(key);
  if (value) return value;
  const v = version(name);
  const mean = add(add(times(M1, n), times(M2, d)), v.m0);
  const anomaly = fractional(add(add(times(A1, n), times(A2, d)), v.a0));
  const sunAnomaly = sub(fractional(add(add(times(S1, n), times(S2, d)), v.s0)), frac(1, 4));
  const moonEquation = interpolate(moonTab, times(anomaly, 28));
  const sunEquation = interpolate(sunTab, times(sunAnomaly, 12));
  value = add(mean, over(sub(moonEquation, sunEquation), 60));
  trueDateCache.set(key, value);
  return value;
}

/** The Julian Day Number of the calendar day on which lunar day d of month n ends. */
export const endDay = (name, n, d) => Number(floor(trueDate(name, n, d)));

// ---------------------------------------------------------------------------
// Gregorian dates.

const UNIX_EPOCH_JDN = 2440588; // 1970-01-01
const DAY_MS = 86_400_000;

/** The ISO date of a Julian Day Number. */
export function isoOfJdn(jdn) {
  return new Date((jdn - UNIX_EPOCH_JDN) * DAY_MS).toISOString().slice(0, 10);
}

/** The Julian Day Number of an ISO date. */
export function jdnOfIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS + UNIX_EPOCH_JDN;
}

/** The first and last calendar days (JDNs) of true month n. */
export function monthSpan(name, n) {
  return { first: endDay(name, n - 1, 30) + 1, last: endDay(name, n, 30) };
}

/**
 * The calendar days numbered `day` in month n: one day; none when the number
 * is skipped; two when it is repeated (the first is the leap day).
 */
export function daysNumbered(name, n, day) {
  const end = endDay(name, n, day);
  const before = endDay(name, n, day - 1);
  if (end === before) return [];
  if (end - before === 2) return [end - 1, end];
  return [end];
}

/**
 * The ISO date of day `day` of month `month` of year `year`, as a holiday is
 * kept: on a repeated number, the first day (or the second, with
 * `repeated: "second"`); on a skipped number, the next day (or the day it
 * is skipped on, with `skipped: "before"`). `leap` asks for the leap month.
 */
export function dateOf(name, year, month, day, { leap = false, repeated = "first", skipped = "after" } = {}) {
  const counts = monthCounts(name, year, month);
  const n = leap ? counts.leap : counts.regular;
  if (n === undefined) throw new Error(`_tibetan-calendar.mjs: ${name} ${year} has no leap month ${month}`);
  const days = daysNumbered(name, n, day);
  if (days.length === 0) {
    const end = endDay(name, n, day);
    return isoOfJdn(skipped === "before" ? end : end + 1);
  }
  return isoOfJdn(repeated === "second" ? days[days.length - 1] : days[0]);
}

/** New Year's Day (Losar, Tsagaan Sar): the first day of the year's first month. */
export function newYear(name, year) {
  const { regular, leap } = monthCounts(name, year, 1);
  const first = leap !== undefined ? Math.min(regular, leap) : regular;
  return isoOfJdn(monthSpan(name, first).first);
}

/**
 * The year, month (with leap flag) and day number of a calendar day (an ISO
 * date), and whether it is the first of two days with the same number.
 */
export function fromIso(name, iso) {
  const v = version(name);
  const jdn = jdnOfIso(iso);
  // A first guess from the mean motion, then step to the month holding the day.
  const [mn, md] = v.m0;
  let n = Math.floor((jdn - Number(mn) / Number(md)) / (167025 / 5656));
  while (monthSpan(name, n).first > jdn) n--;
  while (monthSpan(name, n).last < jdn) n++;
  let day = 30;
  let leapDay = false;
  for (let d = 1; d <= 30; d++) {
    const end = endDay(name, n, d);
    if (end >= jdn) {
      day = d;
      leapDay = end > jdn;
      break;
    }
  }
  // Which (year, month) has count n.
  const approx = Math.floor((65 * n + v.beta) / 67);
  for (let mp = approx - 2; mp <= approx + 2; mp++) {
    const year = v.y0 + Math.floor((mp - 1) / 12);
    const month = (((mp - 1) % 12) + 12) % 12 + 1;
    const counts = monthCounts(name, year, month);
    if (counts.regular === n) return { year, month, leapMonth: false, day, leapDay };
    if (counts.leap === n) return { year, month, leapMonth: true, day, leapDay };
  }
  throw new Error(`_tibetan-calendar.mjs: cannot place month count ${n}`);
}
