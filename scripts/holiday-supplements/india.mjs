/**
 * India's festivals and holidays, which date-holidays barely covers (it has
 * the national days, Good Friday, Christmas and some state days, but nothing
 * on the Hindu or Islamic calendars).
 *
 * Every date is computed here, offline and deterministically, so the file
 * needs no package and works for any year:
 *
 * - Hindu festivals follow the lunisolar (amanta) calendar used by the
 *   standard almanacs: a tithi is each 12° the Moon gains on the Sun, a month
 *   runs from new moon to new moon and is named for the sidereal (Lahiri)
 *   sign the Sun enters during it, and a month the Sun enters no sign in is an
 *   extra (adhik) month whose festivals move to the month after. Which civil
 *   day a festival falls on is decided by where its tithi stands at sunrise,
 *   midday, afternoon, dusk or midnight at New Delhi, by the classical rule
 *   for that festival (see RULES below).
 * - Solar festivals (Makar Sankranti, Pongal, Vaisakhi, Onam) follow the
 *   Sun's sidereal sign changes.
 * - Islamic holidays follow the first sighting of the crescent from New Delhi
 *   (Yallop's criterion), as India's moon-sighting committees decide them.
 *
 * Positions are from Meeus, Astronomical Algorithms (2nd ed.): VSOP87 for the
 * Sun (chapter 32, appendix III) and ELP-2000/82 for the Moon (chapter 47).
 * Checked against astronomy-engine and panchang-ts over 2020 to 2050: the Sun
 * to 2″, the Moon to 15″, tithi and nakshatra ends to 21 s, sunrise to 3 s.
 * How the dates were checked against published ones is in
 * docs/holiday-dates.md.
 */

const SOURCE =
  "Computed from the Hindu lunisolar and Islamic lunar calendars (Meeus, Astronomical Algorithms; " +
  "Lahiri ayanamsa; Yallop crescent criterion), checked against the Government of India's " +
  "gazetted holiday lists, https://dopt.gov.in/";

// ---------------------------------------------------------------------------
// Time and angles. Instants are Julian days in UT; civil days are IST dates.

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const IST = 5.5 / 24;
const UNIX_EPOCH_JD = 2440587.5;
const J2000 = 2451545;

const norm = (degrees) => ((degrees % 360) + 360) % 360;
/** The signed difference a − b, in (−180, 180]. */
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

function jdOfDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS + UNIX_EPOCH_JD - IST;
}

function dateOfJd(jd) {
  return new Date(Math.floor((jd - UNIX_EPOCH_JD + IST) * DAY_MS)).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** TT − UT in seconds: the measured value to 2027, then Espenak and Meeus's model joined to it. */
function deltaT(jd) {
  const model = (year) => {
    const t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  };
  const year = 2000 + (jd - J2000) / 365.25;
  return year <= 2027 ? 69.184 : model(year) - (model(2027) - 69.184);
}

const centuriesTT = (jd) => (jd + deltaT(jd) / 86400 - J2000) / 36525;

/** Nutation in longitude and true obliquity, in degrees (Meeus chapter 22, abridged). */
function nutation(T) {
  const omega = (125.04452 - 1934.136261 * T) * RAD;
  const sun = (280.4665 + 36000.7698 * T) * RAD;
  const moon = (218.3165 + 481267.8813 * T) * RAD;
  const dpsi =
    (-17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * sun) - 0.23 * Math.sin(2 * moon) + 0.21 * Math.sin(2 * omega)) /
    3600;
  const deps =
    (9.2 * Math.cos(omega) + 0.57 * Math.cos(2 * sun) + 0.1 * Math.cos(2 * moon) - 0.09 * Math.cos(2 * omega)) / 3600;
  const eps0 = 23.439291111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  return { dpsi, eps: eps0 + deps };
}

// ---------------------------------------------------------------------------
// The Sun: VSOP87D for the Earth, truncated as in Meeus appendix III.
// Each term is [A, B, C] for A·cos(B + C·τ), A in 1e-8.

const EARTH_L = [
  [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],[3497,2.7441,5753.3849],[3418,2.8289,3.5231],[3136,3.6277,77713.7715],[2676,4.4181,7860.4194],[2343,6.1352,3930.2097],[1324,0.7425,11506.7698],[1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],[902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],[753,2.533,5507.553],[505,4.583,18849.228],[492,4.205,775.523],[357,2.92,0.067],[317,5.849,11790.629],[284,1.899,796.298],[271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],[205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],[132,3.411,2942.463],[126,1.083,20.775],[115,0.645,0.98],[103,0.636,4694.003],[102,0.976,15720.839],[102,4.267,7.114],[99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],[85,1.3,6275.96],[85,3.67,71430.7],[80,1.81,17260.15],[79,3.04,12036.46],[75,1.76,5088.63],[74,3.5,3154.69],[74,4.68,801.82],[70,0.83,9437.76],[62,3.98,8827.39],[61,1.82,7084.9],[57,2.78,6286.6],[56,4.39,14143.5],[56,3.47,6279.55],[52,0.19,12139.55],[52,1.33,1748.02],[51,0.28,5856.48],[49,0.49,1194.45],[41,5.37,8429.24],[41,2.4,19651.05],[39,6.17,10447.39],[37,6.04,10213.29],[37,2.57,1059.38],[36,1.71,2352.87],[36,1.78,6812.77],[33,0.59,17789.85],[30,0.44,83996.85],[30,2.74,1349.87],[25,3.16,4690.48]],
  [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],[425,1.59,3.523],[119,5.796,26.298],[109,2.966,1577.344],[93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],[67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],[45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],[21,5.34,0.98],[19,1.85,5486.78],[19,4.97,213.3],[17,2.99,6275.96],[16,0.03,2544.31],[16,1.43,2146.17],[15,1.21,10977.08],[12,2.83,1748.02],[12,3.26,5088.63],[12,5.27,1194.45],[12,2.08,4694],[11,0.77,553.57],[10,1.3,6286.6],[10,4.24,1349.87],[9,2.7,242.73],[9,5.64,951.72],[8,5.3,2352.87],[6,2.65,9437.76],[6,4.67,4690.48]],
  [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],[27,0.05,3.52],[16,5.19,26.3],[16,3.68,155.42],[10,0.76,18849.23],[9,2.06,77713.77],[7,0.83,775.52],[5,4.66,1577.34],[4,1.03,7.11],[4,3.44,5573.14],[3,5.14,796.3],[3,6.05,5507.55],[3,1.19,242.73],[3,6.12,529.69],[3,0.31,398.15],[3,2.28,553.57],[2,4.38,5223.69],[2,3.75,0.98]],
  [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15],[3,5.2,155.42],[1,4.72,3.52],[1,5.3,18849.23],[1,5.97,242.73]],
  [[114,3.142,0],[8,4.13,6283.08],[1,3.84,12566.15]],
  [[1,3.14,0]],
];
const EARTH_R = [
  [[100013989,0,0],[1670700,3.0984635,6283.07585],[13956,3.05525,12566.1517],[3084,5.1985,77713.7715],[1628,1.1739,5753.3849],[1576,2.8469,7860.4194],[925,5.453,11506.77],[542,4.564,3930.21],[472,3.661,5884.927],[346,0.964,5507.553],[329,5.9,5223.694],[307,0.299,5573.143],[243,4.273,11790.629],[212,5.847,1577.344],[186,5.022,10977.079],[175,3.012,18849.228],[110,5.055,5486.778],[98,0.89,6069.78],[86,5.69,15720.84],[86,1.27,161000.69],[65,0.27,17260.15],[63,0.92,529.69],[57,2.01,83996.85],[56,5.24,71430.7],[49,3.25,2544.31],[47,2.58,775.52],[45,5.54,9437.76],[43,6.01,6275.96],[39,5.36,4694],[38,2.39,8827.39],[37,0.83,19651.05],[37,4.9,12139.55],[36,1.67,12036.46],[35,1.84,2942.46],[33,0.24,7084.9],[32,0.18,5088.63],[32,1.78,398.15],[28,1.21,6286.6],[28,1.9,6279.55],[26,4.59,10447.39]],
  [[103019,1.10749,6283.07585],[1721,1.0644,12566.1517],[702,3.142,0],[32,1.02,18849.23],[31,2.84,5507.55],[25,1.32,5223.69],[18,1.42,1577.34],[10,5.91,10977.08],[9,1.42,6275.96],[9,0.27,5486.78]],
  [[4359,5.7846,6283.0758],[124,5.579,12566.152],[12,3.14,0],[9,3.63,77713.77],[6,1.87,5573.14],[3,5.47,18849.23]],
  [[145,4.273,6283.076],[7,3.92,12566.15]],
  [[4,2.56,6283.08]],
];

function vsop(series, tau) {
  let sum = 0;
  let power = 1;
  for (const terms of series) {
    let s = 0;
    for (const [a, b, c] of terms) s += a * Math.cos(b + c * tau);
    sum += s * power;
    power *= tau;
  }
  return sum / 1e8;
}

/** The Sun's apparent geocentric longitude, and the obliquity, in degrees. */
function sun(jd) {
  const T = centuriesTT(jd);
  const tau = T / 10;
  const { dpsi, eps } = nutation(T);
  const radius = vsop(EARTH_R, tau);
  // + 180° for geocentric, −0.09033″ to FK5, then nutation and aberration.
  const lon = norm(vsop(EARTH_L, tau) / RAD + 180 - 0.09033 / 3600 + dpsi - 20.4898 / 3600 / radius);
  return { lon, lat: 0, eps };
}

// ---------------------------------------------------------------------------
// The Moon: ELP-2000/82 as abridged in Meeus chapter 47.
// [D, M, M′, F, Σl in 1e-6°, Σr in metres]

const MOON_LR = [
  [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
  [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],
  [2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
  [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],
  [4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],
  [2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
  [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],
  [2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],
  [0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
  [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],
  [2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],
  [2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
  [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],
  [1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],
  [0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752],
];
// [D, M, M′, F, Σb in 1e-6°]
const MOON_B = [
  [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
  [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
  [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],
  [4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
  [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],
  [0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
  [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],
  [2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
  [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],
  [4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107],
];

/** The Moon's apparent geocentric longitude and latitude (degrees) and distance (km). */
function moon(jd) {
  const T = centuriesTT(jd);
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  const A3 = 313.45 + 481266.484 * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const eccentricity = (m) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);

  let sl = 0;
  let sr = 0;
  let sb = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) {
    const arg = (d * D + m * M + mp * Mp + f * F) * RAD;
    sl += l * eccentricity(m) * Math.sin(arg);
    sr += r * eccentricity(m) * Math.cos(arg);
  }
  for (const [d, m, mp, f, b] of MOON_B) {
    sb += b * eccentricity(m) * Math.sin((d * D + m * M + mp * Mp + f * F) * RAD);
  }
  sl += 3958 * Math.sin(A1 * RAD) + 1962 * Math.sin((Lp - F) * RAD) + 318 * Math.sin(A2 * RAD);
  sb +=
    -2235 * Math.sin(Lp * RAD) + 382 * Math.sin(A3 * RAD) + 175 * Math.sin((A1 - F) * RAD) +
    175 * Math.sin((A1 + F) * RAD) + 127 * Math.sin((Lp - Mp) * RAD) - 115 * Math.sin((Lp + Mp) * RAD);

  const { dpsi, eps } = nutation(T);
  return { lon: norm(Lp + sl / 1e6 + dpsi), lat: sb / 1e6, dist: 385000.56 + sr / 1000, eps };
}

// ---------------------------------------------------------------------------
// Rising, setting and altitude.

/** Places whose sunrise decides a festival's day. */
const NEW_DELHI = { lat: 28.6139, lon: 77.209 };
const KOLKATA = { lat: 22.5726, lon: 88.3639 };
const CHENNAI = { lat: 13.0827, lon: 80.2707 };
const KOCHI = { lat: 9.9312, lon: 76.2673 };

function siderealTime(jd) {
  const T = (jd - J2000) / 36525;
  return norm(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Geocentric altitude and azimuth (degrees, azimuth from north through east). */
function horizontal({ lon, lat, eps }, jd, place) {
  const l = lon * RAD;
  const b = lat * RAD;
  const e = eps * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = siderealTime(jd) * RAD + place.lon * RAD - ra;
  const phi = place.lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az: norm(az / RAD + 180) };
}

/** Horizontal parallax of the Moon, degrees. */
const moonParallax = (dist) => Math.asin(6378.14 / dist) / RAD;

/**
 * The instant near `guess` when a body's upper limb, with standard
 * refraction, crosses the horizon. `body` returns its position at an instant.
 */
function crossing(body, standard, guess, place) {
  const above = (jd) => {
    const position = body(jd);
    return horizontal(position, jd, place).alt - standard(position);
  };
  let t = guess;
  for (let i = 0; i < 12; i++) {
    const step = above(t) / ((above(t + 1 / 1440) - above(t - 1 / 1440)) / (2 / 1440));
    t -= step;
    if (Math.abs(step) < 1e-6) break;
  }
  return t;
}

const SUN_STANDARD = () => -0.8333;
const MOON_STANDARD = (position) => 0.7275 * moonParallax(position.dist) - 0.5667;

const dayCache = new Map();

/** Sunrise, sunset and the next sunrise on an IST date at a place. */
function day(iso, place = NEW_DELHI) {
  const key = `${iso}|${place.lat}`;
  let info = dayCache.get(key);
  if (!info) {
    // Local mean solar time 06:00 and 18:00 as first guesses.
    const midnight = jdOfDate(iso) + IST - place.lon / 360;
    const rise = crossing(sun, SUN_STANDARD, midnight + 0.25, place);
    const set = crossing(sun, SUN_STANDARD, midnight + 0.75, place);
    const nextRise = crossing(sun, SUN_STANDARD, midnight + 1.25, place);
    info = { iso, rise, set, nextRise };
    dayCache.set(key, info);
  }
  return info;
}

// ---------------------------------------------------------------------------
// Tithis, nakshatras and sidereal signs.

const elongation = (jd) => norm(moon(jd).lon - sun(jd).lon);

/** Lahiri (Chitrapaksha) ayanamsa, as the Indian almanacs use it. */
function ayanamsa(jd) {
  const T = (jd - J2000) / 36525;
  return 23.863801 + (5029.0966 * T + 1.112 * T * T - 6e-6 * T * T * T) / 3600;
}

const siderealSun = (jd) => norm(sun(jd).lon - ayanamsa(jd));
const siderealMoon = (jd) => norm(moon(jd).lon - ayanamsa(jd));

/** Newton's method for when `angle(jd)` reaches `target`, near `guess`. */
function reach(angle, rate, target, guess) {
  let t = guess;
  for (let i = 0; i < 30; i++) {
    const step = angleDiff(target, angle(t)) / rate;
    t += step;
    if (Math.abs(step) < 1e-7) break;
  }
  return t;
}

const MOON_RATE = 12.19; // degrees a day the Moon gains on the Sun, on average
const elongationAt = (target, guess) => reach(elongation, MOON_RATE, target, guess);
const sankranti = (sign, guess) => reach(siderealSun, 0.9856, sign * 30, guess);

const NAKSHATRA = 360 / 27;
const SHRAVANA = 21; // the 22nd nakshatra, Thiruvonam in Malayalam
const nakshatraAt = (jd) => Math.floor(siderealMoon(jd) / NAKSHATRA);

/** The span of nakshatra `index` that runs through or after `jd`. */
function nakshatraSpan(index, jd) {
  const current = nakshatraAt(jd);
  const ahead = (index - current + 27) % 27;
  const guess = jd + ahead * (NAKSHATRA / 13.18);
  const start = reach(siderealMoon, 13.18, index * NAKSHATRA, guess - 0.5);
  const end = reach(siderealMoon, 13.18, ((index + 1) % 27) * NAKSHATRA, start + 1);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Lunar months.

const MONTHS = [
  "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
  "Ashvin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna",
];
const month = Object.fromEntries(MONTHS.map((name, index) => [name, index]));

const SYNODIC = 29.530589;
const lunationCache = new Map();

/**
 * The amanta months that start between November of the year before and the
 * end of the year: [{ start, end, month, adhik }], new moon to new moon.
 */
function lunations(year) {
  let list = lunationCache.get(year);
  if (list) return list;
  list = [];
  let start = elongationAt(0, jdOfDate(`${year - 1}-11-01`));
  const last = jdOfDate(`${year}-12-31`);
  while (start <= last) {
    const end = elongationAt(0, start + SYNODIC);
    const first = Math.floor(siderealSun(start) / 30);
    const entered = Math.floor(siderealSun(end) / 30);
    // A month is named for the sign the Sun enters during it (Mesha →
    // Chaitra). A month with no such entry repeats the next one's name.
    const adhik = first === entered;
    list.push({ start, end, month: adhik ? (entered + 1) % 12 : entered, adhik });
    start = end;
  }
  lunationCache.set(year, list);
  return list;
}

/** Tithi `n` (1 to 30: 15 is Purnima, 30 Amavasya) of a lunation, as a span. */
function tithi(lunation, n) {
  const at = (k) => (k === 0 ? lunation.start : k === 30 ? lunation.end : elongationAt(k * 12, lunation.start + k * 0.984));
  return { start: at(n - 1), end: at(n) };
}

/** Each year's tithi of a regular (not adhik) month, by the IST date of its start. */
function tithisOf(year, monthName, n) {
  return lunations(year)
    .filter((lunation) => !lunation.adhik && lunation.month === month[monthName])
    .map((lunation) => tithi(lunation, n));
}

// ---------------------------------------------------------------------------
// RULES: which civil day a tithi's festival falls on.
//
// A Hindu day runs from sunrise to sunrise. The almanacs divide daytime into
// five parts (the third is madhyahna, the fourth aparahna) and the night into
// fifteen muhurtas (pradosh is the first three after sunset, nishita the
// eighth). Each festival is observed on the day its tithi holds the part of
// the day its worship belongs to; the ladders below settle the cases where
// the tithi holds that part on two days or on neither, as the almanacs do.

const windows = {
  daytime: (d) => [d.rise, d.set],
  madhyahna: (d) => [d.rise + ((d.set - d.rise) * 2) / 5, d.rise + ((d.set - d.rise) * 3) / 5],
  aparahna: (d) => [d.rise + ((d.set - d.rise) * 3) / 5, d.rise + ((d.set - d.rise) * 4) / 5],
  pradosh: (d) => [d.set, d.set + (d.nextRise - d.set) / 5],
  nishita: (d) => [d.set + ((d.nextRise - d.set) * 7) / 15, d.set + ((d.nextRise - d.set) * 8) / 15],
  // Arunodaya: the four ghatis (96 minutes) before sunrise.
  arunodaya: (d) => [d.rise - 96 / 1440, d.rise],
};

function overlap(window, d, span) {
  const [a, b] = window(d);
  return Math.max(0, Math.min(b, span.end) - Math.max(a, span.start));
}

function covers(window, d, span) {
  const [a, b] = window(d);
  return span.start <= a && b <= span.end;
}

/** The days a span touches, with a day either side. */
function candidates(span, place) {
  const days = [];
  for (let iso = addDays(dateOfJd(span.start), -1); iso <= addDays(dateOfJd(span.end), 1); iso = addDays(iso, 1)) {
    days.push(day(iso, place));
  }
  return days;
}

const holdsSunrise = (d, span) => span.start <= d.rise && d.rise < span.end;
const startsOn = (d, span) => d.rise <= span.start && span.start < d.nextRise;

/**
 * Udaya: the day whose sunrise the tithi holds (the first, if two). A tithi
 * that holds no sunrise belongs to the day it starts on.
 */
function udaya(span, place = NEW_DELHI, last = false) {
  const days = candidates(span, place);
  const held = days.filter((d) => holdsSunrise(d, span));
  if (held.length > 0) return (last ? held[held.length - 1] : held[0]).iso;
  return days.find((d) => startsOn(d, span)).iso;
}

/**
 * The day whose window the tithi covers most. The earlier day wins a tie,
 * or when both are covered in full. With no overlap at all, udaya.
 */
function most(window, place = NEW_DELHI) {
  return (span) => {
    let best;
    let bestOverlap = 0;
    for (const d of candidates(span, place)) {
      const o = overlap(window, d, span);
      if (o > bestOverlap + 1e-9) {
        best = d;
        bestOverlap = o;
      }
    }
    return best ? best.iso : udaya(span, place);
  };
}

/** The last day whose window the tithi touches; with none, udaya. */
function lastTouching(window, place = NEW_DELHI) {
  return (span) => {
    const touched = candidates(span, place).filter((d) => overlap(window, d, span) > 0);
    return touched.length > 0 ? touched[touched.length - 1].iso : udaya(span, place);
  };
}

/**
 * A ladder for a window (aparahna for Dussehra, nishita for Shivaratri): the
 * first day it covers in full (or, with `laterIfBoth`, the second of two),
 * else the day with most overlap, else `fallback`.
 */
function ladder(window, { laterIfBoth = false, fallback = udaya } = {}) {
  return (span, place = NEW_DELHI) => {
    const days = candidates(span, place);
    const full = days.filter((d) => covers(window, d, span));
    if (full.length > 0) return (laterIfBoth ? full[full.length - 1] : full[0]).iso;
    let best;
    let bestOverlap = 0;
    for (const d of days) {
      const o = overlap(window, d, span);
      if (o > bestOverlap + 1e-9) {
        best = d;
        bestOverlap = o;
      }
    }
    return best ? best.iso : fallback(span, place);
  };
}

/** Three muhurtas are a fifth of daytime. */
const lastsThreeMuhurtas = (d, span) => span.end - d.rise >= (d.set - d.rise) / 5;

/**
 * Raksha Bandhan's rule: the first sunrise day on which the tithi lasts at
 * least three muhurtas; otherwise the day the tithi begins (with the rakhi
 * tied in the evening, once Bhadra has passed).
 */
function threeMuhurtas(span) {
  const days = candidates(span, NEW_DELHI);
  const held = days.find((d) => holdsSunrise(d, span));
  if (held && lastsThreeMuhurtas(held, span)) return held.iso;
  return days.find((d) => startsOn(d, span)).iso;
}

/**
 * Holika Dahan: the evening whose pradosh Purnima holds, after Bhadra (the
 * first half of Purnima) is over. Purnima holding two evenings takes the
 * first that is free of Bhadra. One evening still under Bhadra past midnight
 * keeps it (the fire is lit in Bhadra's tail), unless next day Purnima lasts
 * three prahars (three quarters of daytime) with Pratipada longer than
 * Purnima, or nearly the whole day: then the fire moves to that evening.
 */
function holikaDahan(span) {
  const days = candidates(span, NEW_DELHI);
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
      const pratipadaLonger = () => elongationAt(192, span.end + 1) - span.end > span.end - span.start;
      if (remaining * 8 >= daytime * 7 || (remaining * 4 >= daytime * 3 && pratipadaLonger())) return next.iso;
    }
    return evening.iso;
  }
  return span.start < days[first].set ? days[first].iso : days[first + 1].iso;
}

/**
 * Dussehra: the aparahna ladder, except that it moves to the next day when
 * Dashami still holds that sunrise for three muhurtas and the Shravana
 * nakshatra holds that day's aparahna but not the first one's.
 */
function vijayadashami(span) {
  const chosen = ladder(windows.aparahna)(span);
  const d = day(chosen);
  const next = day(addDays(chosen, 1));
  const shravana = nakshatraSpan(SHRAVANA, d.rise - 1);
  const shravanaIn = (x) => overlap(windows.aparahna, x, shravana) > 0;
  if (holdsSunrise(next, span) && lastsThreeMuhurtas(next, span) && !shravanaIn(d) && shravanaIn(next)) {
    return next.iso;
  }
  return chosen;
}

/**
 * Janmashtami as the Government of India and the Vaishnava (ISKCON)
 * calendars keep it: Ashtami at sunrise, never a day whose sunrise is still
 * Saptami; an Ashtami that holds no sunrise passes to the next day.
 */
function janmashtamiVaishnava(span, place = NEW_DELHI) {
  const days = candidates(span, place);
  const held = days.find((d) => holdsSunrise(d, span));
  if (held) return held.iso;
  return days.find((d) => d.rise >= span.end).iso;
}

const ROHINI = 3; // the 4th nakshatra, Krishna's birth star

/**
 * The Smarta day: the first Ashtami sunrise day whose midnight (nishita)
 * holds Ashtami or the Rohini nakshatra; failing that, the day before, whose
 * midnight Ashtami reaches although its sunrise was still Saptami.
 */
function janmashtamiSmarta(span) {
  const days = candidates(span, NEW_DELHI);
  const atMidnight = (d, holds) => windows.nishita(d).some(holds);
  const ashtami = (jd) => span.start <= jd && jd < span.end;
  const rohini = (jd) => nakshatraAt(jd) === ROHINI;
  const claimed = days.find((d) => holdsSunrise(d, span) && (atMidnight(d, ashtami) || atMidnight(d, rohini)));
  if (claimed) return claimed.iso;
  const night = days.find((d) => atMidnight(d, ashtami));
  return night ? night.iso : janmashtamiVaishnava(span);
}

/** Navami of Durga Puja: the first day on which Navami has begun two muhurtas before sunset. */
function mahaNavami(span) {
  const days = candidates(span, KOLKATA);
  const cut = (d) => d.rise + ((d.set - d.rise) * 13) / 15;
  return days.find((d) => span.start < cut(d) && d.nextRise > span.start).iso;
}

// ---------------------------------------------------------------------------
// Solar months and nakshatra festivals.

/** The sankranti (the Sun entering sidereal sign `sign`, Mesha = 0) of a year. */
function sankrantiIn(year, sign) {
  // Mesha sankranti is about the 104th day of the year; each sign takes a twelfth of it.
  return sankranti(sign, jdOfDate(`${year}-01-01`) + ((103.5 + sign * 30.44) % 365.25));
}

/** The day of a sankranti by the sunset rule: after sunset, the next day. */
function sunsetRule(jd, place) {
  const d = day(dateOfJd(jd), place);
  return jd < d.set ? d.iso : addDays(d.iso, 1);
}

/**
 * Thiruvonam of Chingam: the day the Shravana nakshatra holds at sunrise in
 * Kochi while the Sun is in Simha (the first of two such sunrises, or the day
 * it falls in if it holds none), taking the later of two in one Chingam.
 */
function onam(year) {
  const start = sankrantiIn(year, 4);
  const end = sankrantiIn(year, 5);
  const days = [];
  for (let iso = dateOfJd(start); iso <= addDays(dateOfJd(end), 1); iso = addDays(iso, 1)) {
    const d = day(iso, KOCHI);
    if (d.rise >= start && d.rise < end) days.push(d);
  }
  const found = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const atRise = nakshatraAt(d.rise) === SHRAVANA;
    const previous = i > 0 && nakshatraAt(days[i - 1].rise) === SHRAVANA;
    if (atRise && !previous) found.push(d.iso);
    // A Shravana that starts and ends between two sunrises.
    if (!atRise && nakshatraAt(d.nextRise) !== SHRAVANA) {
      const span = nakshatraSpan(SHRAVANA, d.rise);
      if (span.start > d.rise && span.end < d.nextRise) found.push(d.iso);
    }
  }
  return found[found.length - 1];
}

// ---------------------------------------------------------------------------
// The Islamic calendar, by first crescent visibility from New Delhi.

/**
 * Yallop's q at the best time (sunset + 4/9 of the lag to moonset), from
 * Yallop, "A Method for Predicting the First Sighting of the New Crescent
 * Moon", NAO Technical Note 69 (1997). Below −0.293 the crescent cannot be
 * seen even with a telescope; above +0.216 it is easily seen by eye.
 */
function yallopQ(iso, place = NEW_DELHI) {
  const d = day(iso, place);
  const moonset = crossing(moon, MOON_STANDARD, d.set + 0.02, place);
  if (moonset <= d.set) return -Infinity;
  const best = d.set + ((moonset - d.set) * 4) / 9;
  const m = moon(best);
  const mh = horizontal(m, best, place);
  const sh = horizontal(sun(best), best, place);
  const arcv = mh.alt - sh.alt;
  const daz = angleDiff(sh.az, mh.az);
  const arcl = Math.acos(Math.cos(arcv * RAD) * Math.cos(daz * RAD)) / RAD;
  const parallax = moonParallax(m.dist); // degrees
  const semidiameter = 0.27245 * parallax * 60 * (1 + Math.sin(mh.alt * RAD) * Math.sin(parallax * RAD));
  const w = semidiameter * (1 - Math.cos(arcl * RAD)); // arcminutes
  return (arcv - (11.8371 - 6.3226 * w + 0.7319 * w * w - 0.1018 * w * w * w)) / 10;
}

/**
 * India's moon-sighting committees go by the naked eye, so a month begins the
 * day after the first evening Yallop rates the crescent "easily visible".
 * This matches 51 of 54 announced dates from 2015 to 2026 and every Islamic
 * date in the 2027 gazette (docs/holiday-dates.md).
 */
const SIGHTING_Q = 0.216;
/** How near the threshold an evening has to be for the date to be a close call. */
const CLOSE_Q = 0.1;

/**
 * The first day of the Islamic month after the new moon at `conjunction`
 * (an IST date), and the day it would be if a borderline evening went the
 * other way.
 */
function hijriMonthStart(conjunction) {
  let evening = dateOfJd(conjunction);
  if (day(evening).set < conjunction) evening = addDays(evening, 1);
  let previous = -Infinity;
  for (let i = 0; i < 3; i++, evening = addDays(evening, 1)) {
    const q = yallopQ(evening);
    if (q >= SIGHTING_Q) {
      const start = addDays(evening, 1);
      if (q < SIGHTING_Q + CLOSE_Q) return { start, alternative: addDays(start, 1) };
      if (previous > SIGHTING_Q - CLOSE_Q) return { start, alternative: addDays(start, -1) };
      return { start };
    }
    previous = q;
  }
  return { start: evening };
}

const hijriCache = new Map();

/**
 * The Islamic months starting from November of the year before, numbered
 * 1 (Muharram) to 12 (Dhu al-Hijjah) by counting new moons from one India
 * observed: 1 Muharram 1447, the day after the new moon of 25 June 2025.
 */
function hijriMonths(year) {
  let months = hijriCache.get(year);
  if (months) return months;
  const newMoon = (jd) => elongationAt(0, jd);
  const anchor = newMoon(jdOfDate("2025-06-25"));
  months = [];
  for (let conjunction = newMoon(jdOfDate(`${year - 1}-11-15`)), i = 0; i < 15; i++) {
    const index = Math.round((conjunction - anchor) / SYNODIC);
    months.push({ ...hijriMonthStart(conjunction), month: (((index % 12) + 12) % 12) + 1 });
    conjunction = newMoon(conjunction + SYNODIC);
  }
  hijriCache.set(year, months);
  return months;
}

/** Day `n` of Islamic month `number` falling in a year, with its close-call alternative. */
function hijriDays(year, number, n) {
  return hijriMonths(year)
    .filter((m) => m.month === number)
    .map((m) => ({
      date: addDays(m.start, n - 1),
      alternative: m.alternative && addDays(m.alternative, n - 1),
    }))
    .filter(({ date }) => date.startsWith(String(year)));
}

// ---------------------------------------------------------------------------
// The festivals.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const longDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]}`;

const note = (...parts) =>
  parts
    .filter(Boolean)
    .map((part) => part.replace(/[.\s]+$/, ""))
    .join(". ");

const LUNAR_NOTE = "Lunar date: some regions keep it a day apart";
const MOON_NOTE = "Set by moon sighting, so it can move a day; Kerala often keeps it a day earlier";
const closeCall = (alternative) => alternative && `A close call this year: some almanacs give ${longDate(alternative)}`;

/**
 * How far an almanac's tithi times can stray from these, in days. Moving a
 * tithi this much either way and getting another day marks a close call.
 */
const ALMANAC_SPREAD = 15 / 1440;

/** Lunar festivals: [name, kind, month, tithi, rule, note, days after the tithi's day]. */
const LUNAR = [
  ["Vasant Panchami", "optional", "Magha", 5, vasantPanchami, "Saraswati Puja. A day off in West Bengal and some other states"],
  ["Maha Shivaratri", "optional", "Magha", 29, ladder(windows.nishita, { laterIfBoth: true, fallback: (span) => dateOfJd(span.start) }), "Night-long worship of Shiva. A day off in many states"],
  ["Holika Dahan", "observance", "Phalguna", 15, holikaDahan, "Bonfires on the eve of Holi"],
  ["Holi", "optional", "Phalguna", 15, holikaDahan, "Festival of colours. A day off in most of northern, western and eastern India; usually a working day in Kerala, Tamil Nadu and Karnataka", 1],
  ["Ugadi and Gudi Padwa", "optional", "Chaitra", 1, udaya, "New Year in Karnataka, Andhra Pradesh and Telangana (Ugadi) and Maharashtra (Gudi Padwa), and a day off there"],
  ["Ram Navami", "optional", "Chaitra", 9, lastTouching(windows.madhyahna), "Birth of Rama. A day off in many states"],
  ["Mahavir Jayanti", "public", "Chaitra", 13, udaya, "Birth of Mahavira, the last Jain tirthankara"],
  ["Hanuman Jayanti", "festival", "Chaitra", 15, udaya, "Birth of Hanuman. Parts of South India keep it on other dates"],
  ["Akshaya Tritiya", "festival", "Vaishakha", 3, threeMuhurtas, "A lucky day to buy gold, so jewellers are crowded"],
  ["Buddha Purnima", "public", "Vaishakha", 15, udaya, "Birth, enlightenment and death of the Buddha"],
  ["Rath Yatra", "optional", "Ashadha", 2, (span) => udaya(span, NEW_DELHI, true), "Jagannath's chariot festival in Puri, which draws huge crowds. A day off in Odisha"],
  ["Guru Purnima", "festival", "Ashadha", 15, udaya, "A day for honouring teachers"],
  ["Raksha Bandhan", "optional", "Shravana", 15, threeMuhurtas, "Sisters tie rakhis on their brothers' wrists. A day off in several northern and western states"],
  ["Janmashtami", "optional", "Shravana", 23, janmashtamiVaishnava, "Birth of Krishna, celebrated at midnight. A day off in most northern states"],
  ["Ganesh Chaturthi", "optional", "Bhadrapada", 4, most(windows.madhyahna), "Start of the Ganesh festival, which runs for up to ten days. A day off in Maharashtra, Goa, Karnataka, Tamil Nadu, Andhra Pradesh and Telangana"],
  ["Anant Chaturdashi", "festival", "Bhadrapada", 14, udaya, "Ganesh immersion processions, biggest in Mumbai and Pune, close many roads"],
  ["Navratri begins", "festival", "Ashvin", 1, udaya, "Nine nights of Durga worship, with garba dancing in Gujarat"],
  ["Durga Puja: Maha Saptami", "festival", "Ashvin", 7, (span) => udaya(span, KOLKATA), "Durga Puja days are days off in West Bengal and other eastern states"],
  ["Durga Puja: Maha Ashtami", "festival", "Ashvin", 8, (span) => udaya(span, KOLKATA), "Durga Puja days are days off in West Bengal and other eastern states"],
  ["Durga Puja: Maha Navami", "festival", "Ashvin", 9, mahaNavami, "Durga Puja days are days off in West Bengal and other eastern states"],
  ["Dussehra", "public", "Ashvin", 10, vijayadashami, "Vijayadashami, the end of Navratri, when effigies of Ravana are burned"],
  ["Durga Puja: Vijaya Dashami", "festival", "Ashvin", 10, vijayadashami, "The Durga images are immersed. Durga Puja days are days off in West Bengal and other eastern states"],
  ["Karva Chauth", "festival", "Ashvin", 19, karvaChauth, "Married women fast until moonrise, mainly in northern India"],
  ["Dhanteras", "festival", "Ashvin", 28, most(windows.pradosh), "The first day of Diwali, and a lucky day to buy gold and kitchenware"],
  ["Naraka Chaturdashi", "festival", "Ashvin", 29, narakaChaturdashi, "Choti Diwali in the north, and Deepavali itself in much of the south"],
  ["Diwali", "public", "Ashvin", 30, most(windows.pradosh), "Lakshmi Puja, the main night of the festival of lights. Trains and flights are packed in the days before"],
  ["Govardhan Puja", "festival", "Kartika", 1, most(windows.daytime), "Annakut, and the Gujarati New Year"],
  ["Bhai Dooj", "festival", "Kartika", 2, lastTouching(windows.aparahna), "Sisters honour their brothers on the last day of Diwali"],
  ["Chhath Puja", "optional", "Kartika", 6, udaya, "Offerings to the setting sun at rivers and ponds. A day off in Bihar and Jharkhand"],
  ["Guru Nanak Jayanti", "public", "Kartika", 15, udaya, "Gurpurab, the birth of Guru Nanak"],
  ["Guru Gobind Singh Jayanti", "optional", "Pausha", 7, udaya, "Gurpurab of the tenth Sikh guru. A day off in Punjab and Haryana"],
];

/** Vasant Panchami: the first day on which Panchami has begun by two fifths of daytime. */
function vasantPanchami(span) {
  const cut = (d) => d.rise + ((d.set - d.rise) * 2) / 5;
  return candidates(span, NEW_DELHI).find((d) => span.start < cut(d) && span.end > d.rise).iso;
}

/** Naraka Chaturdashi: the first day whose arunodaya Chaturdashi touches; with none, udaya. */
function narakaChaturdashi(span, place = NEW_DELHI) {
  const touched = candidates(span, place).find((d) => overlap(windows.arunodaya, d, span) > 0);
  return touched ? touched.iso : udaya(span, place);
}

/** Karva Chauth: the first day Chaturthi holds at moonrise; with none, udaya. */
function karvaChauth(span) {
  for (const d of candidates(span, NEW_DELHI)) {
    // Three days past full, the Moon rises two to four hours after sunset.
    const moonrise = crossing(moon, MOON_STANDARD, d.set + 0.12, NEW_DELHI);
    if (moonrise >= span.start && moonrise < span.end && moonrise < d.nextRise) return d.iso;
  }
  return udaya(span);
}

/** A rule's day for a span, and the other day an almanac a little off would give. */
function decide(rule, span, offset) {
  const date = addDays(rule(span), offset);
  for (const shift of [-ALMANAC_SPREAD, ALMANAC_SPREAD]) {
    const other = addDays(rule({ start: span.start + shift, end: span.end + shift }), offset);
    if (other !== date) return { date, alternative: other };
  }
  return { date };
}

function lunarEntries(year) {
  const entries = [];
  for (const [name, kind, monthName, n, rule, text, offset = 0] of LUNAR) {
    // Pausha straddles New Year, so its festivals can come from either year's month.
    const spans = [...tithisOf(year, monthName, n), ...(monthName === "Pausha" ? tithisOf(year + 1, monthName, n) : [])];
    const seen = new Set();
    for (const span of spans) {
      const { date, alternative } = decide(rule, span, offset);
      if (!date.startsWith(String(year)) || seen.has(date)) continue;
      seen.add(date);
      let extra;
      if (name === "Janmashtami") {
        const smarta = janmashtamiSmarta(span);
        if (smarta !== date) extra = `Many temples and homes, following the Smarta almanac, celebrate it on ${longDate(smarta)}`;
      }
      if (rule === vijayadashami) {
        const aparahna = ladder(windows.aparahna)(span);
        if (aparahna !== date) extra = `The Shravana nakshatra moves it to this day; some almanacs keep ${longDate(aparahna)}`;
      }
      entries.push({ date, name, kind, note: note(text, extra, closeCall(alternative !== date && alternative), LUNAR_NOTE) });
    }
  }
  return entries;
}

/**
 * A festival in LUNAR on its own rule, but with sunrise and sunset taken at
 * `place`, for the neighbouring countries' supplements (south-asia.mjs).
 * Rules tied to one city (Durga Puja's to Kolkata) keep it. Each day comes
 * with the other day an almanac a little off would give, if there is one.
 *
 * @returns {{ date: string, alternative?: string }[]} the year's days, in order
 */
export function lunarFestivalDays(year, name, place = NEW_DELHI) {
  const row = LUNAR.find(([festival]) => festival === name);
  if (!row) throw new Error(`india.mjs: no lunar festival named ${JSON.stringify(name)}`);
  const [, , monthName, n, rule, , offset = 0] = row;
  const atPlace = (span) => rule(span, place);
  const spans = [...tithisOf(year, monthName, n), ...(monthName === "Pausha" ? tithisOf(year + 1, monthName, n) : [])];
  const days = new Map();
  for (const span of spans) {
    const { date, alternative } = decide(atPlace, span, offset);
    if (date.startsWith(String(year)) && !days.has(date)) days.set(date, alternative ? { date, alternative } : { date });
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The days whose sunrise at `place` a tithi of a regular month holds (the
 * udaya rule), with the other day an almanac a little off would give.
 */
export function udayaDays(year, monthName, n, place = NEW_DELHI) {
  if (!(monthName in month)) throw new Error(`india.mjs: no lunar month named ${JSON.stringify(monthName)}`);
  return tithisOf(year, monthName, n)
    .map((span) => decide((s) => udaya(s, place), span, 0))
    .filter(({ date }) => date.startsWith(String(year)))
    .map(({ date, alternative }) => (alternative ? { date, alternative } : { date }));
}

/** A sankranti's day by the sunset rule, with the other day when it is within half an hour of sunset. */
function bySunset(jd, place) {
  const date = sunsetRule(jd, place);
  const d = day(dateOfJd(jd), place);
  return Math.abs(jd - d.set) < 30 / 1440 ? { date, alternative: date === d.iso ? addDays(d.iso, 1) : d.iso } : { date };
}


function solarEntries(year) {
  const makara = sankrantiIn(year, 9);
  const sankrantiDay = bySunset(makara, NEW_DELHI);
  const pongal = bySunset(makara, CHENNAI);
  // Tamil Nadu's government follows the Vakya almanac, whose Makara sankranti
  // comes some hours after this one: an afternoon sankranti here can be after
  // sunset there (Pongal was 15 January in 2026, a day after this rule).
  const pongalHour = ((makara - jdOfDate(dateOfJd(makara))) * 24) % 24;
  const vakya = pongal.date === dateOfJd(makara) && pongalHour >= 12
    ? "Tamil Nadu's government calendar follows the Vakya almanac and may keep it a day later"
    : undefined;
  const mesha = sankrantiIn(year, 0);
  const meshaDay = dateOfJd(mesha);
  const meshaHour = (mesha - jdOfDate(meshaDay)) * 24;
  const puthandu = bySunset(mesha, CHENNAI);
  const onamDay = onam(year);
  const pongalDays = [
    ["Pongal", "Tamil harvest festival. A day off in Tamil Nadu", 0],
    ["Thiruvalluvar Day", "Mattu Pongal. A day off in Tamil Nadu", 1],
    ["Uzhavar Thirunal", "Kaanum Pongal. A day off in Tamil Nadu", 2],
  ];
  return [
    { date: addDays(sankrantiDay.date, -1), name: "Lohri", kind: "festival", note: "Bonfire festival in Punjab, the night before Makar Sankranti" },
    {
      date: sankrantiDay.date,
      name: "Makar Sankranti",
      kind: "optional",
      note: note(
        "Harvest festival: Uttarayan, with kite flying, in Gujarat, and Magh Bihu in Assam. A day off in several states",
        sankrantiDay.date !== `${year}-01-14` && "Gujarat and the central government's list keep it on 14 January",
        closeCall(sankrantiDay.alternative),
      ),
    },
    ...pongalDays.map(([name, text, after]) => ({
      date: addDays(pongal.date, after),
      name,
      kind: "optional",
      note: note(text, vakya, closeCall(pongal.alternative && addDays(pongal.alternative, after))),
    })),
    {
      date: meshaDay,
      name: "Vaisakhi",
      kind: "optional",
      note: note(
        "Sikh New Year and harvest festival. A day off in Punjab",
        (meshaHour < 0.5 || meshaHour > 23.5) && closeCall(meshaHour < 0.5 ? addDays(meshaDay, -1) : addDays(meshaDay, 1)),
      ),
    },
    { date: puthandu.date, name: "Puthandu", kind: "optional", note: note("Tamil New Year. A day off in Tamil Nadu", closeCall(puthandu.alternative)) },
    ...(onamDay
      ? [{ date: onamDay, name: "Onam", kind: "optional", note: "Thiruvonam, Kerala's harvest festival. Kerala takes several days off around it" }]
      : []),
  ];
}

const ISLAMIC = [
  [9, 1, "Ramadan begins", "observance", "The first day of the fast. Many restaurants in Muslim areas open only after sunset"],
  [10, 1, "Eid al-Fitr", "public", "Id-ul-Fitr, the end of Ramadan"],
  [12, 10, "Eid al-Adha", "public", "Id-ul-Zuha (Bakrid), the feast of the sacrifice"],
  [1, 10, "Muharram", "public", "Ashura, with Shia mourning processions in many cities"],
  [3, 12, "Milad-un-Nabi", "public", "Id-e-Milad, the Prophet's birthday"],
];

function islamicEntries(year) {
  return ISLAMIC.flatMap(([number, n, name, kind, text]) =>
    hijriDays(year, number, n).map(({ date, alternative }) => ({
      date,
      name,
      kind,
      note: note(text, alternative && `A close call this year: it may be ${longDate(alternative)}`, MOON_NOTE),
    })),
  );
}

/**
 * Dates a government has notified that the computation does not give, such
 * as a state following its own almanac. Add to it as each year's lists come
 * out; a sighting that moves an Islamic date belongs here too.
 */
const TAMIL_NADU_2026 = "on the date Tamil Nadu notified (G.O. Ms. No. 708 of 11 November 2025); other almanacs give a day earlier";
const NOTIFIED = {
  2026: {
    Pongal: ["2026-01-15", `Tamil harvest festival. A day off in Tamil Nadu, ${TAMIL_NADU_2026}`],
    "Thiruvalluvar Day": ["2026-01-16", `Mattu Pongal. A day off in Tamil Nadu, ${TAMIL_NADU_2026}`],
    "Uzhavar Thirunal": ["2026-01-17", `Kaanum Pongal. A day off in Tamil Nadu, ${TAMIL_NADU_2026}`],
    // The crescent was not seen on 17 May 2026, and DoPT's memorandum of
    // 22 May 2026 moved the central holiday from 27 to 28 May.
    "Eid al-Adha": [
      "2026-05-28",
      "Id-ul-Zuha (Bakrid), the feast of the sacrifice. The central government moved the holiday to 28 May after the moon sighting. In Jammu and Kashmir, where local bodies kept the day before, it may be 27 May",
    ],
  },
};

export function indiaEntries(year) {
  const notified = NOTIFIED[year] ?? {};
  const entries = [...solarEntries(year), ...lunarEntries(year), ...islamicEntries(year)].map((entry) => {
    const official = notified[entry.name];
    return official ? { ...entry, date: official[0], note: official[1] } : entry;
  });
  return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1));
}

/** The pieces behind the dates, for the tests and docs/holiday-dates.md. */
export const internals = {
  sun,
  moon,
  elongation,
  siderealSun,
  siderealMoon,
  day,
  lunations,
  tithi,
  hijriMonths,
  yallopQ,
  sankrantiIn,
  janmashtamiSmarta: (year) => tithisOf(year, "Shravana", 23).map((span) => janmashtamiSmarta(span)),
  places: { NEW_DELHI, KOLKATA, CHENNAI, KOCHI },
  /** The IST date of an instant (a Julian day in UT). */
  dateOfJd,
};

const supplements = [
  {
    country: "IN",
    source: SOURCE,
    entries: indiaEntries,
  },
];

export default supplements;
