/**
 * The Pacific islands, Timor-Leste, Macau, North Korea, the Falkland Islands
 * and the Cayman Islands.
 *
 * date-holidays has no data at all for Papua New Guinea, the Solomon
 * Islands, Micronesia, Kiribati, the Marshall Islands, Nauru, Palau, Tuvalu,
 * Samoa, Timor-Leste, the Northern Mariana Islands, Niue, Tokelau, Pitcairn,
 * the Falkland Islands, Macau and North Korea. Each gets its current official
 * list here: fixed days, Easter-based days, the sovereign's birthday by its
 * local rule, weekend substitutes where the law gives them, regional days and
 * a few big festivals.
 *
 * For the Cayman Islands the library hard-codes the Queen's Birthday one year
 * at a time and stops in 2026, puts Constitution Day on 2 July (it is the
 * first Monday of July), and lacks Emancipation Day, Remembrance Day and the
 * weekend substitutes for Christmas and Boxing Day. Those are fixed here.
 *
 * Where a date is set each year (a sovereign's birthday, an Islamic holiday)
 * the rule below is the best estimate from the published years, and the note
 * says so. How every rule was checked, with sources and match rates, is in
 * docs/holiday-dates.md; src/lib/reference/pacific-east-asia-holidays.test.ts
 * holds the published dates.
 *
 * Lunar dates use the generator's own Chinese and Korean calendars
 * (lunisolarDate), which also fix date-holidays' 2033 leap month and the days
 * its count slips. Islamic dates and solar terms use date-holidays' rules, so
 * neighbours agree with the countries the library covers.
 *
 * Deterministic and independent of the machine's time zone: dates are ISO
 * strings handled with Date.UTC.
 */
import Holidays from "date-holidays";
import { lunisolarDate } from "../build-holidays.mjs";

// ---------------------------------------------------------------------------
// Dates.

const SUN = 0;
const MON = 1;
const THU = 4;
const FRI = 5;
const SAT = 6;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";

function isoOfMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A date from its parts. Overflowing days roll into the next month. */
export function ymd(year, month, day) {
  return isoOfMs(Date.UTC(year, month - 1, day));
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return ymd(year, month, day + days);
}

export function weekday(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The weekday on or after a date. */
function onOrAfter(iso, day) {
  return addDays(iso, (day - weekday(iso) + 7) % 7);
}

/** The nth weekday of a month: 1 is the first, -1 the last. */
export function nthWeekday(year, month, day, n) {
  if (n > 0) return addDays(onOrAfter(ymd(year, month, 1), day), 7 * (n - 1));
  const last = ymd(year, month + 1, 0);
  return addDays(last, -((weekday(last) - day + 7) % 7) - 7 * (-n - 1));
}

/** The Monday after the nth Sunday of a month (Samoa's and Tuvalu's rule). */
function mondayAfterSunday(year, month, n) {
  return addDays(nthWeekday(year, month, SUN, n), 1);
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
  return ymd(year, month, ((h + l - 7 * m + 114) % 31) + 1);
}

const fromEaster = (year, days) => addDays(easter(year), days);

/**
 * The Saturday the United Kingdom keeps as the King's official birthday
 * (Trooping the Colour), as an estimate: the Saturday from 11 to 17 June. It
 * was that Saturday every year from 2020 to 2026 except the 2022 jubilee; in
 * 2018 and 2019 it was a week earlier. The Cayman Islands keep the Monday
 * after it and the Solomon Islands the Friday before.
 */
export function ukOfficialBirthday(year) {
  return onOrAfter(ymd(year, 6, 11), SAT);
}

// ---------------------------------------------------------------------------
// Calendars from date-holidays' rules: Islamic dates and solar terms.

const ruleCalendars = new Map();

/** The dates a date-holidays rule names in a Gregorian year. */
export function ruleDates(rule, year) {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "public" })) {
      throw new Error(`pacific-east-asia.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? [])
    .map((holiday) => holiday.date.slice(0, 10))
    .filter((date) => date.startsWith(`${year}-`));
}

/** Qingming, the solar term at 15°, in China's time zone. */
const qingming = (year) => ruleDates("chinese 5-01 solarterm", year)[0];
/** Dongzhi (the winter solstice), the solar term at 270°, in China's time zone. */
const winterSolstice = (year) => ruleDates("chinese 22-01 solarterm", year)[0];
/** Cheongmyeong (Qingming) in Korea's time zone. */
const cheongmyeong = (year) => ruleDates("korean 5-01 solarterm", year)[0];

// ---------------------------------------------------------------------------
// Entries and weekend substitutes.

/** Notes are sentences: each part gets a full stop (the Islamic note keeps the library's form). */
function note(...parts) {
  const kept = parts.filter(Boolean).map((part) => part.trim());
  return kept
    .map((part, index) =>
      /[.!?]$/.test(part) || (index === kept.length - 1 && part === ISLAMIC) ? part : `${part}.`,
    )
    .join(" ");
}

/**
 * One holiday. `sub` says how a weekend day is replaced:
 * - "next": a Saturday or Sunday holiday moves to the next weekday that is
 *   not already a day off (so Christmas on a Saturday and Boxing Day on a
 *   Sunday give Monday and Tuesday);
 * - "sunday": only a Sunday holiday moves, to the next day that is not a
 *   Sunday or a day off;
 * - "us": a Saturday holiday is kept on the Friday before (no extra day when
 *   that Friday is already off) and a Sunday one on the next free weekday
 *   (the US federal rule).
 * `where` makes it a regional day ("Day off in Kosrae"). `library` marks a
 * holiday date-holidays already lists: it counts for substitutes but is not
 * repeated.
 */
function day(date, name, kind = "public", text = "", extra = {}) {
  return { date, name, kind, note: text, ...extra };
}

const SORT = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const DAY_OFF = new Set(["public", "bank", "optional"]);

function freeDay(start, taken) {
  let date = start;
  while (weekday(date) === SAT || weekday(date) === SUN || taken.has(date)) date = addDays(date, 1);
  return date;
}

function freeNonSunday(start, taken) {
  let date = start;
  while (weekday(date) === SUN || taken.has(date)) date = addDays(date, 1);
  return date;
}

/** The weekend substitutes for one group of holidays (national, or one region). */
function substitutesOf(holidays, taken, options) {
  const out = [];
  for (const holiday of [...holidays].sort(SORT)) {
    if (!holiday.sub) continue;
    const wd = weekday(holiday.date);
    let date;
    if (holiday.sub === "sunday") {
      if (wd !== SUN) continue;
      date = freeNonSunday(addDays(holiday.date, 1), taken);
    } else if (wd === SAT && holiday.sub === "us") {
      // The Friday before; when that is already a day off, no extra day.
      date = addDays(holiday.date, -1);
      if (taken.has(date)) continue;
    } else if (wd === SAT || wd === SUN) {
      date = freeDay(addDays(holiday.date, 1), taken);
    } else {
      continue;
    }
    taken.add(date);
    const [year, month, dayOfMonth] = holiday.date.split("-").map(Number);
    // The year too when the holiday is in another year (New Year's Day kept on 31 December).
    const when = `${WEEKDAYS[wd]} ${dayOfMonth} ${MONTH_NAMES[month - 1]}${date.startsWith(`${year}-`) ? "" : ` ${year}`}`;
    out.push({
      date,
      name: `${holiday.name} (substitute day)`,
      kind: options.subKind ?? holiday.kind,
      note: options.subNote
        ? options.subNote(holiday, when)
        : note(holiday.where && `Day off in ${holiday.where}`, `In place of ${holiday.name}, on ${when}`),
      where: holiday.where,
    });
  }
  return out;
}

/**
 * A country's entries for a year from its holidays for any year: the
 * holidays of the year and the one either side (so a New Year's Day on a
 * Saturday gives the Friday before), their substitutes, and regional notes.
 */
function yearly(base, options = {}) {
  return (year) => {
    const all = [year - 1, year, year + 1].flatMap(base);
    const national = all.filter((holiday) => !holiday.where);
    const taken = new Set(national.filter((holiday) => DAY_OFF.has(holiday.kind)).map((holiday) => holiday.date));
    const subs = substitutesOf(national, taken, options);
    const regions = [...new Set(all.map((holiday) => holiday.where).filter(Boolean))];
    for (const region of regions) {
      const own = all.filter((holiday) => holiday.where === region);
      const regionTaken = new Set([...taken, ...own.filter((h) => DAY_OFF.has(h.kind)).map((h) => h.date)]);
      subs.push(...substitutesOf(own, regionTaken, {}));
    }
    const seen = new Set();
    const out = [];
    for (const holiday of [...all, ...subs].sort(SORT)) {
      if (!holiday.date.startsWith(`${year}-`) || holiday.library) continue;
      const key = `${holiday.date} ${holiday.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const text = holiday.where && !/\(substitute day\)$/.test(holiday.name)
        ? note(`Day off in ${holiday.where}`, holiday.note)
        : holiday.note;
      out.push({ date: holiday.date, name: holiday.name, kind: holiday.kind, note: text });
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// Cayman Islands.

const CAYMAN_KINGS_BIRTHDAY = { 2026: "2026-06-15" };

/**
 * The days date-holidays lacks or has wrong. The King's Birthday is the
 * Monday after the Saturday the UK appoints (Public Holidays Act, 2007
 * Revision): published for 2026, estimated after.
 */
function caymanBase(year) {
  const king = CAYMAN_KINGS_BIRTHDAY[year] ?? addDays(ukOfficialBirthday(year), 2);
  return [
    day(nthWeekday(year, 5, MON, 1), "Emancipation Day", "public", "Marks the abolition of slavery."),
    day(
      king,
      "King's Birthday",
      "public",
      CAYMAN_KINGS_BIRTHDAY[year]
        ? ""
        : "Estimated: the Monday after the King's official birthday in the UK, set each year. It can be a week earlier.",
    ),
    day(nthWeekday(year, 7, MON, 1), "Constitution Day"),
    day(nthWeekday(year, 11, MON, 2), "Remembrance Day"),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next", library: true }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "next", library: true }),
  ];
}

export const caymanEntries = yearly(caymanBase);

// ---------------------------------------------------------------------------
// Papua New Guinea.

const PNG_FESTIVALS = {
  2026: [
    ["2026-08-14", "2026-08-16", "Mount Hagen Show", "Mount Hagen, Western Highlands: clans from across the Highlands in body paint and plumes. Runs 14 to 16 August."],
    ["2026-09-18", "2026-09-20", "Goroka Show", "Goroka, Eastern Highlands: the biggest gathering of singsing groups, in Independence week. Runs 18 to 20 September."],
  ],
};

function runOf(first, last, name, text) {
  const out = [];
  for (let date = first; date <= last; date = addDays(date, 1)) out.push(day(date, name, "festival", text));
  return out;
}

/**
 * Public Holidays Act 1953 and the yearly gazette: a Sunday holiday moves to
 * Monday; Christmas on a Sunday gives the Tuesday too (Boxing Day is the
 * Monday). The King's Birthday has been 17 June since 2023; in 2023, a
 * Saturday, the Friday before was given.
 */
function pngBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "sunday" }),
    day(
      ymd(year, 2, 26),
      "Grand Chief Sir Michael Somare Remembrance Day",
      "public",
      "Declared by gazette each year. On a weekend, a weekday may be given instead.",
    ),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(ymd(year, 6, 17), "King's Birthday", "public", "Set by gazette each year: 17 June since 2023.", { sub: "us" }),
    day(ymd(year, 7, 23), "National Remembrance Day", "public", "", { sub: "sunday" }),
    day(ymd(year, 8, 26), "National Repentance Day", "public", "", { sub: "sunday" }),
    day(ymd(year, 9, 16), "Independence Day", "public", "", { sub: "sunday" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "sunday" }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "sunday" }),
    ...(PNG_FESTIVALS[year] ?? []).flatMap(([first, last, name, text]) => runOf(first, last, name, text)),
  ];
}

export const pngEntries = yearly(pngBase);

// ---------------------------------------------------------------------------
// Solomon Islands.

const SB_PROVINCES = [
  [2, 25, "Choiseul Province Day", "Choiseul Province"],
  [6, 2, "Isabel Province Day", "Isabel Province"],
  [6, 8, "Temotu Province Day", "Temotu Province"],
  [6, 29, "Central Province Day", "Central Province"],
  [7, 20, "Rennell and Bellona Province Day", "Rennell and Bellona Province"],
  [8, 1, "Guadalcanal Province Day", "Guadalcanal Province"],
  [8, 3, "Makira-Ulawa Province Day", "Makira-Ulawa Province"],
  [8, 15, "Malaita Province Day", "Malaita Province"],
  [12, 7, "Western Province Day", "Western Province"],
];
/** Gazette No. 114 of 10 August 2026 moved Malaita's 2026 day to 18 November. */
const SB_PROVINCE_MOVED = { "2026 Malaita Province Day": "2026-11-18" };

/**
 * Public Holidays Act and the yearly gazettes: a Sunday holiday moves to
 * Monday and a Saturday one to the Friday before; Christmas and Thanksgiving
 * on a weekend give the Monday and Tuesday. The King's Birthday is the Friday
 * before the UK's official-birthday Saturday (2023 to 2025), estimated.
 */
function solomonBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "us" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, -1), "Holy Saturday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(fromEaster(year, 50), "Whit Monday"),
    day(
      addDays(ukOfficialBirthday(year), -1),
      "King's Birthday",
      "public",
      "Estimated: the Friday before the King's official birthday in the UK, set by gazette each year. It can be a week earlier.",
    ),
    day(ymd(year, 7, 7), "Independence Day", "public", "", { sub: "us" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "National Day of Thanksgiving", "public", "", { sub: "next" }),
    ...SB_PROVINCES.map(([month, dayOfMonth, name, where]) =>
      day(SB_PROVINCE_MOVED[`${year} ${name}`] ?? ymd(year, month, dayOfMonth), name, "optional", "", { sub: "us", where }),
    ),
  ];
}

export const solomonEntries = yearly(solomonBase);

// ---------------------------------------------------------------------------
// Micronesia.

/**
 * FSM Code title 1, sections 601 to 603: a Saturday holiday is kept on the
 * Friday before, a Sunday one on the Monday after. State days from the state
 * codes, with the same rule.
 */
function micronesiaBase(year) {
  const state = (month, dayOfMonth, name, where, text = "") =>
    day(ymd(year, month, dayOfMonth), name, "optional", text, { sub: "us", where });
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "us" }),
    day(ymd(year, 3, 31), "Micronesian Culture and Tradition Day", "public", "", { sub: "us" }),
    day(ymd(year, 5, 10), "Federated States of Micronesia Day", "public", "Constitution Day.", { sub: "us" }),
    day(ymd(year, 10, 24), "United Nations Day", "public", "", { sub: "us" }),
    day(ymd(year, 11, 3), "Independence Day", "public", "", { sub: "us" }),
    day(ymd(year, 11, 11), "FSM Veterans of Foreign Wars Day", "public", "", { sub: "us" }),
    day(ymd(year, 11, 23), "Presidents Day", "public", "", { sub: "us" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "us" }),
    // Kosrae.
    state(1, 11, "Kosrae State Constitution Day", "Kosrae"),
    state(8, 21, "Kosrae Gospel Day", "Kosrae"),
    state(9, 8, "Kosrae Liberation Day", "Kosrae"),
    day(nthWeekday(year, 11, THU, 4), "Thanksgiving Day", "optional", "", { where: "Kosrae" }),
    state(12, 3, "Kosrae Disability Day", "Kosrae"),
    // Kosrae and Pohnpei.
    day(fromEaster(year, -2), "Good Friday", "optional", "", { where: "Kosrae and Pohnpei" }),
    // Pohnpei.
    state(3, 8, "Pohnpei Women's Day", "Pohnpei"),
    state(9, 11, "Pohnpei Liberation Day", "Pohnpei"),
    state(11, 8, "Pohnpei Constitution Day", "Pohnpei"),
    // Chuuk.
    state(9, 26, "Chuuk State Charter Day", "Chuuk"),
    state(10, 1, "Chuuk State Constitution Day", "Chuuk"),
    // Yap.
    state(3, 1, "Yap Day", "Yap", "Yap's culture festival: traditional dances, canoes and crafts"),
    state(12, 24, "Yap State Constitution Day", "Yap"),
  ];
}

export const micronesiaEntries = yearly(micronesiaBase);

// ---------------------------------------------------------------------------
// Kiribati.

const KI_MOVES =
  "The government often moves this day off to a nearby Friday or Monday. Check the year's list.";

/**
 * Public Holidays Ordinance as amended in 2002: a holiday on a weekend moves
 * to the next weekday (Gospel Day and the first elders' day excepted).
 * Labour Day is on the government's lists from 2025, not in the law.
 */
function kiribatiBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "next" }),
    day(ymd(year, 3, 8), "International Women's Day", "public", KI_MOVES, { sub: "next" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(ymd(year, 4, 19), "National Health Day", "public", KI_MOVES, { sub: "next" }),
    day(ymd(year, 5, 1), "Labour Day", "public", KI_MOVES, { sub: "next" }),
    day(ymd(year, 7, 11), "Gospel Day", "public", KI_MOVES),
    day(ymd(year, 7, 12), "Independence Day", "public", "", { sub: "next" }),
    day(
      ymd(year, 7, 15),
      "National Culture and Senior Citizens Day",
      "public",
      note("Part of the independence holidays, honouring the elders", KI_MOVES),
    ),
    day(
      ymd(year, 7, 16),
      "National Culture and Senior Citizens Day",
      "public",
      note("Part of the independence holidays, honouring the elders", KI_MOVES),
      { sub: "next" },
    ),
    day(ymd(year, 8, 5), "Youth Day", "public", KI_MOVES, { sub: "next" }),
    day(ymd(year, 12, 9), "Human Rights and Peace Day", "public", KI_MOVES, { sub: "next" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "next" }),
  ];
}

export const kiribatiEntries = yearly(kiribatiBase);

// ---------------------------------------------------------------------------
// Marshall Islands.

/**
 * Public Holidays Act 1988 as amended, and the Public Service Commission's
 * yearly memos: a Saturday holiday on the Friday before, a Sunday one on the
 * Monday after. General Election Day is every four years (P.L. 2015-38).
 */
function marshallBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "us" }),
    day(ymd(year, 3, 1), "Nuclear Victims Remembrance Day", "public", "", { sub: "us" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(ymd(year, 5, 1), "Constitution Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 7, FRI, 1), "Fishermen's Day"),
    day(nthWeekday(year, 9, FRI, 1), "Dri-Jerbal Day", "public", "Workers' day."),
    day(nthWeekday(year, 9, FRI, -1), "Manit Day", "public", "Custom and culture day."),
    ...(year % 4 === 3 ? [day(nthWeekday(year, 11, MON, 3), "General Election Day")] : []),
    day(ymd(year, 11, 17), "President's Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 12, FRI, 1), "Gospel Day"),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "us" }),
  ];
}

export const marshallEntries = yearly(marshallBase);

// ---------------------------------------------------------------------------
// Nauru.

/**
 * The yearly public holidays gazette: a holiday on a weekend moves to the
 * next weekday not already off (Independence Day and the day after, and
 * Christmas and the day after, to Monday and Tuesday).
 */
function nauruBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "next" }),
    day(ymd(year, 1, 31), "Independence Day", "public", "", { sub: "next" }),
    day(ymd(year, 2, 1), "Day following Independence Day", "public", "", { sub: "next" }),
    day(ymd(year, 3, 8), "International Women's Day", "public", "", { sub: "next" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(fromEaster(year, 2), "Easter Tuesday"),
    day(ymd(year, 5, 17), "Constitution Day", "public", "", { sub: "next" }),
    day(ymd(year, 7, 1), "RONPHOS Handover Day", "public", "", { sub: "next" }),
    day(ymd(year, 8, 19), "Ibumin Earoeni Day", "public", "Day of the tribes.", { sub: "next" }),
    day(ymd(year, 9, 25), "Sir Hammer DeRoburt Day", "public", "", { sub: "next" }),
    day(ymd(year, 10, 26), "Angam Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "Day following Christmas", "public", "", { sub: "next" }),
  ];
}

export const nauruEntries = yearly(nauruBase);

// ---------------------------------------------------------------------------
// Palau.

/**
 * Palau National Code title 1, chapter 7: a Saturday holiday on the Friday
 * before, a Sunday one on the Monday after. Family Day is the fourth Friday
 * of November (RPPL 10-15).
 */
function palauBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "us" }),
    day(ymd(year, 3, 15), "Youth Day", "public", "", { sub: "us" }),
    day(ymd(year, 5, 5), "Senior Citizens Day", "public", "", { sub: "us" }),
    day(ymd(year, 6, 1), "President's Day", "public", "", { sub: "us" }),
    day(ymd(year, 7, 9), "Constitution Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 9, MON, 1), "Labor Day"),
    day(ymd(year, 10, 1), "Independence Day", "public", "", { sub: "us" }),
    day(ymd(year, 10, 24), "United Nations Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 11, THU, 4), "Thanksgiving Day"),
    day(nthWeekday(year, 11, FRI, 4), "Family Day"),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "us" }),
  ];
}

export const palauEntries = yearly(palauBase);

// ---------------------------------------------------------------------------
// Tuvalu.

const TV_ISLANDS = [
  [1, 8, "Nanumea Day (Te Po o Tefolaha)", "Nanumea"],
  [2, 3, "Po Lahi (Big Day)", "Nanumea"],
  [2, 11, "Nukufetau Day", "Nukufetau"],
  [2, 16, "Day of the Flood", "Nui"],
  [4, 15, "Nanumaga Day", "Nanumaga"],
  [4, 23, "Day of the Bombing", "Funafuti"],
  [5, 10, "Nukulaelae Gospel Day", "Nukulaelae"],
  [9, 17, "Niutao Day", "Niutao"],
  [10, 21, "Cyclone Day", "Funafuti"],
  [11, 25, "Vaitupu Happy Day (Te Aso Fiafia)", "Vaitupu"],
];

/**
 * Public Holidays Act, revised 2022, with the 2018 and 2020 amendments: a
 * weekend holiday moves to the next weekday not already off. The King's
 * Birthday is the second Saturday of June and is not moved.
 */
function tuvaluBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "next" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(mondayAfterSunday(year, 5, 2), "Gospel Day"),
    day(nthWeekday(year, 6, SAT, 2), "King's Birthday"),
    day(nthWeekday(year, 8, MON, 1), "National Youth Day"),
    day(ymd(year, 10, 1), "Tuvalu Day", "public", "Independence. A two-day holiday.", { sub: "next" }),
    day(ymd(year, 10, 2), "Tuvalu Day", "public", "Independence. A two-day holiday.", { sub: "next" }),
    day(mondayAfterSunday(year, 10, 2), "National Children's Day"),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "next" }),
    ...TV_ISLANDS.map(([month, dayOfMonth, name, where]) => day(ymd(year, month, dayOfMonth), name, "optional", "", { where })),
  ];
}

export const tuvaluEntries = yearly(tuvaluBase);

// ---------------------------------------------------------------------------
// Samoa.

/**
 * Public Holidays Act 2008, as the Ministry of Commerce, Industry and Labour
 * lists it: no weekend substitutes. White Sunday itself is the children's
 * festival; the Monday after is the holiday.
 */
function samoaBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day"),
    day(ymd(year, 1, 2), "Day after New Year's Day"),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, -1), "Easter Saturday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(mondayAfterSunday(year, 5, 2), "Mother's Day", "public", "The Monday after Mother's Day Sunday."),
    day(ymd(year, 6, 1), "Independence Day"),
    day(mondayAfterSunday(year, 8, 2), "Father's Day", "public", "The Monday after Father's Day Sunday."),
    day(
      nthWeekday(year, 10, SUN, 2),
      "White Sunday",
      "festival",
      "Lotu a Tamaiti: children dressed in white lead church services, then are served first at the family feast.",
    ),
    day(mondayAfterSunday(year, 10, 2), "White Monday", "public", "The day after White Sunday (Lotu a Tamaiti)."),
    day(ymd(year, 12, 25), "Christmas Day"),
    day(ymd(year, 12, 26), "Boxing Day"),
  ];
}

export const samoaEntries = yearly(samoaBase);

// ---------------------------------------------------------------------------
// Timor-Leste.

const TL_DECREED =
  "Usually declared a day off for government staff (tolerância de ponto). Decided each year; most businesses open.";

/**
 * Law 10/2005 on public holidays, as amended in 2016: no weekend
 * substitutes. Eid dates from date-holidays' Hijri rules (2021 to 2025 they
 * matched Timor-Leste's on 5 of 10 Eids, and were a day early on 4).
 */
function timorBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day"),
    day(ymd(year, 3, 3), "Veterans' Day"),
    day(fromEaster(year, -46), "Ash Wednesday", "optional", TL_DECREED),
    day(fromEaster(year, -3), "Holy Thursday", "optional", TL_DECREED),
    day(fromEaster(year, -2), "Good Friday"),
    day(ymd(year, 5, 1), "Labour Day"),
    day(ymd(year, 5, 20), "Restoration of Independence Day"),
    day(fromEaster(year, 39), "Ascension Day", "observance"),
    day(fromEaster(year, 60), "Corpus Christi"),
    day(ymd(year, 6, 1), "International Children's Day", "observance"),
    day(ymd(year, 8, 20), "FALINTIL Day", "observance", "Armed forces day."),
    day(ymd(year, 8, 30), "Popular Consultation Day", "public", "Marks the 1999 vote for independence."),
    day(ymd(year, 11, 1), "All Saints' Day"),
    day(ymd(year, 11, 2), "All Souls' Day"),
    day(ymd(year, 11, 3), "National Women's Day"),
    day(ymd(year, 11, 12), "National Youth Day"),
    day(ymd(year, 11, 28), "Proclamation of Independence Day"),
    day(ymd(year, 12, 7), "Memorial Day"),
    day(ymd(year, 12, 8), "Immaculate Conception"),
    day(ymd(year, 12, 10), "Human Rights Day", "observance"),
    day(ymd(year, 12, 25), "Christmas Day"),
    day(ymd(year, 12, 31), "National Heroes Day"),
    ...ruleDates("1 Shawwal", year).map((date) =>
      day(date, "End of Ramadan (Eid al-Fitr)", "public", note("Idul Fitri", ISLAMIC)),
    ),
    ...ruleDates("10 Dhu al-Hijjah", year).map((date) =>
      day(date, "Feast of the Sacrifice (Eid al-Adha)", "public", note("Idul Adha", ISLAMIC)),
    ),
  ];
}

export const timorEntries = yearly(timorBase);

// ---------------------------------------------------------------------------
// Northern Mariana Islands.

const FEDERAL = "A US federal holiday: federal offices and banks close.";

/**
 * 1 CMC § 311 as the Governor's yearly memos list it: the federal holidays
 * and the Commonwealth's own, a Saturday holiday on the Friday before and a
 * Sunday one on the Monday after. Election Day in even years.
 */
function marianasBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 1, MON, 3), "Martin Luther King Jr. Day"),
    day(nthWeekday(year, 2, MON, 3), "Presidents' Day"),
    day(ymd(year, 3, 24), "Commonwealth Covenant Day", "public", "", { sub: "us" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(nthWeekday(year, 5, MON, -1), "Memorial Day"),
    day(ymd(year, 6, 19), "Juneteenth", "bank", FEDERAL, { sub: "us" }),
    day(ymd(year, 7, 4), "Independence Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 9, MON, 1), "Labor Day"),
    day(nthWeekday(year, 10, MON, 2), "Commonwealth Cultural Day"),
    ...(year % 2 === 0
      ? [day(addDays(nthWeekday(year, 11, MON, 1), 1), "Election Day", "public", "Election years only.")]
      : []),
    day(ymd(year, 11, 4), "Citizenship Day", "public", "", { sub: "us" }),
    day(ymd(year, 11, 11), "Veterans Day", "public", "", { sub: "us" }),
    day(nthWeekday(year, 11, THU, 4), "Thanksgiving Day"),
    day(ymd(year, 12, 8), "Constitution Day", "public", "", { sub: "us" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "us" }),
  ];
}

export const marianasEntries = yearly(marianasBase, {
  subNote: (holiday, when) =>
    holiday.kind === "bank" ? FEDERAL : note(`In place of ${holiday.name}, on ${when}`),
});

// ---------------------------------------------------------------------------
// Niue.

/**
 * Public Holidays Ordinance 1961 and the Public Service Commission's
 * circulars: a weekend holiday moves to the next weekday not already off.
 */
function niueBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "next" }),
    day(ymd(year, 1, 2), "Takai Commission Holiday", "public", "", { sub: "next" }),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(ymd(year, 4, 25), "ANZAC Day", "public", "", { sub: "next" }),
    day(nthWeekday(year, 6, MON, 1), "King's Birthday"),
    day(ymd(year, 10, 19), "Constitution Day", "public", "", { sub: "next" }),
    day(ymd(year, 10, 20), "Constitution Day Holiday", "public", "", { sub: "next" }),
    day(nthWeekday(year, 10, MON, 4), "Peniamina Gospel Day"),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "next" }),
  ];
}

export const niueEntries = yearly(niueBase);

// ---------------------------------------------------------------------------
// Tokelau.

const TK_SUNDAY =
  "A public holiday in Tokelau's rules, kept on a Sunday as in Samoa. The date is an estimate.";

/** Interpretation Rules 2003. Villages can declare their own days too. */
function tokelauBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day"),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(nthWeekday(year, 5, SUN, 2), "Mother's Day", "observance", TK_SUNDAY),
    day(nthWeekday(year, 8, SUN, 2), "Father's Day", "observance", TK_SUNDAY),
    day(ymd(year, 9, 3), "Tokehega Day", "public", "Marks the Treaty of Tokehega, in force since 1983, which settled the sea border with American Samoa."),
    day(nthWeekday(year, 10, SUN, 2), "White Sunday", "observance", TK_SUNDAY),
    day(ymd(year, 12, 25), "Christmas Day"),
    day(ymd(year, 12, 26), "Boxing Day"),
  ];
}

export const tokelauEntries = yearly(tokelauBase);

// ---------------------------------------------------------------------------
// Pitcairn Islands.

/** The government's Public Holidays and Commemoration Days policy (June 2024). */
function pitcairnBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day"),
    day(ymd(year, 1, 2), "Day after New Year's Day", "optional", "Government offices close."),
    day(ymd(year, 1, 23), "Bounty Day", "public", "Marks the burning of HMS Bounty in 1790."),
    day(fromEaster(year, -2), "Good Friday"),
    day(fromEaster(year, 1), "Easter Monday"),
    day(ymd(year, 4, 25), "ANZAC Day", "observance"),
    day(nthWeekday(year, 6, MON, 1), "King's Birthday"),
    day(ymd(year, 7, 2), "Pitcairn Day"),
    day(ymd(year, 11, 11), "Remembrance Day", "observance"),
    day(ymd(year, 12, 25), "Christmas Day"),
    day(ymd(year, 12, 26), "Boxing Day"),
  ];
}

export const pitcairnEntries = yearly(pitcairnBase);

// ---------------------------------------------------------------------------
// Falkland Islands.

/**
 * The government's Public Holidays 2026 to 2029: a weekend holiday moves to
 * the next weekday not already off (so Christmas Day, Boxing Day and the
 * Christmas Holiday on 27 December fill the next free weekdays).
 */
function falklandsBase(year) {
  return [
    day(ymd(year, 1, 1), "New Year's Day", "public", "", { sub: "next" }),
    day(ymd(year, 1, 10), "Margaret Thatcher Day", "observance", "Not a public holiday."),
    day(fromEaster(year, -2), "Good Friday"),
    day(ymd(year, 6, 14), "Liberation Day", "public", "Marks the end of the 1982 war.", { sub: "next" }),
    day(ymd(year, 8, 14), "Falklands Day", "observance", "Not a public holiday."),
    day(nthWeekday(year, 10, MON, 1), "Peat Cutting Monday"),
    day(ymd(year, 11, 14), "King's Birthday", "public", "", { sub: "next" }),
    day(ymd(year, 12, 8), "Battle Day", "public", "Marks the 1914 naval Battle of the Falkland Islands.", { sub: "next" }),
    day(ymd(year, 12, 25), "Christmas Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 26), "Boxing Day", "public", "", { sub: "next" }),
    day(ymd(year, 12, 27), "Christmas Holiday", "public", "", { sub: "next" }),
  ];
}

export const falklandsEntries = yearly(falklandsBase);

// ---------------------------------------------------------------------------
// Macau.

const MO_PUBLIC =
  "Public holiday: government offices, banks and schools close. Many shops and private firms stay open.";

const chinese = (year, month, dayOfMonth) => lunisolarDate("chinese", year, month, dayOfMonth);

/**
 * Executive Order 60/2000 (the public holidays) and Law 7/2008 (the ten
 * obligatory holidays, a paid day off for every worker). A public holiday on
 * a Saturday or Sunday gives government staff a compensatory rest day on the
 * next working day.
 */
function macauBase(year) {
  const obligatory = (date, name, text = "") => day(date, name, "public", text, { sub: "next" });
  const holiday = (date, name, text = "") => day(date, name, "bank", note(MO_PUBLIC, text), { sub: "next" });
  return [
    obligatory(ymd(year, 1, 1), "New Year's Day"),
    obligatory(chinese(year, 1, 1), "Lunar New Year's Day", LUNAR),
    obligatory(chinese(year, 1, 2), "The second day of the Lunar New Year", LUNAR),
    obligatory(chinese(year, 1, 3), "The third day of the Lunar New Year", LUNAR),
    day(fromEaster(year, -2), "Good Friday", "bank", MO_PUBLIC),
    holiday(fromEaster(year, -1), "The Day before Easter"),
    obligatory(qingming(year), "Ching Ming Festival", "Families visit ancestral graves."),
    obligatory(ymd(year, 5, 1), "Labour Day"),
    holiday(chinese(year, 4, 8), "The Buddha's Birthday", LUNAR),
    holiday(chinese(year, 5, 5), "Tuen Ng Festival", note("Dragon Boat Festival", LUNAR)),
    obligatory(chinese(year, 8, 16), "The day following the Mid-Autumn Festival", LUNAR),
    obligatory(ymd(year, 10, 1), "National Day of the People's Republic of China"),
    holiday(ymd(year, 10, 2), "The day following National Day"),
    obligatory(chinese(year, 9, 9), "Chung Yeung Festival", LUNAR),
    holiday(ymd(year, 11, 2), "All Souls' Day"),
    holiday(ymd(year, 12, 8), "Immaculate Conception"),
    obligatory(ymd(year, 12, 20), "Macao S.A.R. Establishment Day"),
    holiday(winterSolstice(year), "Winter Solstice"),
    holiday(ymd(year, 12, 24), "Christmas Eve"),
    holiday(ymd(year, 12, 25), "Christmas Day"),
    day(
      chinese(year, 3, 23),
      "A-Ma Festival",
      "festival",
      note("A-Ma Temple: offerings, lion dances and Cantonese opera for the birthday of the sea goddess A-Ma (Mazu)", LUNAR),
    ),
    day(
      chinese(year, 4, 8),
      "Feast of the Drunken Dragon",
      "festival",
      note("Fishmongers dance a wooden dragon through the old town and share rice wine, on the Buddha's Birthday", LUNAR),
    ),
    day(ymd(year, 5, 13), "Our Lady of Fatima Procession", "festival", "An evening candlelit procession from St Dominic's Church to Penha Hill."),
    ...(year === 2026
      ? runOf("2026-11-19", "2026-11-22", "Macau Grand Prix", "Street races on the Guia Circuit. Runs 19 to 22 November; hotels fill early.")
      : []),
  ];
}

export const macauEntries = yearly(macauBase, {
  subKind: "optional",
  subNote: (holiday, when) =>
    note(`Compensatory rest day for ${holiday.name}, on ${when}: government offices close`, "Most businesses stay open"),
});

// ---------------------------------------------------------------------------
// North Korea.

const korean = (year, month, dayOfMonth) => lunisolarDate("korean", year, month, dayOfMonth);

/**
 * The national and folk holidays. Days off are those the sources agree on;
 * the others are listed as observances. Lunar dates follow the Korean
 * calendar at UTC+9, North Korea's time zone since 2018. No weekend
 * substitutes.
 */
function northKoreaBase(year) {
  const twoDays = (month, dayOfMonth, name, text) => [
    day(ymd(year, month, dayOfMonth), name, "public", text),
    day(ymd(year, month, dayOfMonth + 1), name, "public", text),
  ];
  return [
    day(ymd(year, 1, 1), "New Year's Day"),
    day(korean(year, 1, 1), "Lunar New Year (Seollal)", "public", LUNAR),
    day(
      korean(year, 1, 15),
      "Daeboreum",
      "festival",
      note("The first full moon of the lunar year: nuts, five-grain rice and moon-viewing", LUNAR),
    ),
    day(ymd(year, 2, 8), "Korean People's Army Day", "observance"),
    ...twoDays(2, 16, "Kim Jong Il's Birthday", "Called the Day of the Shining Star. A two-day national holiday."),
    day(ymd(year, 3, 8), "International Women's Day", "observance"),
    day(cheongmyeong(year), "Cheongmyeong", "festival", "Folk festival: families tend ancestral graves."),
    ...twoDays(4, 15, "Kim Il Sung's Birthday", "Called the Day of the Sun. A two-day national holiday."),
    day(ymd(year, 4, 25), "Korean People's Revolutionary Army Day", "observance"),
    day(ymd(year, 5, 1), "May Day"),
    day(ymd(year, 6, 6), "Korean Children's Union Day", "observance"),
    day(ymd(year, 7, 27), "Victory Day", "public", "Marks the 1953 Korean War armistice."),
    day(ymd(year, 8, 15), "Liberation Day", "public", "Marks the end of Japanese rule in 1945."),
    day(ymd(year, 8, 25), "Day of Songun", "observance"),
    day(ymd(year, 8, 28), "Youth Day", "observance"),
    day(korean(year, 8, 15), "Chuseok", "public", note("Harvest festival: families visit ancestral graves", LUNAR)),
    day(ymd(year, 9, 9), "Foundation Day of the Republic", "public", "Marks the founding of the state in 1948."),
    day(ymd(year, 10, 10), "Workers' Party Foundation Day"),
    day(ymd(year, 11, 16), "Mother's Day", "observance"),
    day(ymd(year, 12, 27), "Socialist Constitution Day"),
  ];
}

export const northKoreaEntries = yearly(northKoreaBase);

// ---------------------------------------------------------------------------
// The supplements.

/** Each country's entries for a year, by country code (for the tests). */
export const ENTRIES = {
  FK: falklandsEntries,
  FM: micronesiaEntries,
  KI: kiribatiEntries,
  KP: northKoreaEntries,
  KY: caymanEntries,
  MH: marshallEntries,
  MO: macauEntries,
  MP: marianasEntries,
  NR: nauruEntries,
  NU: niueEntries,
  PG: pngEntries,
  PN: pitcairnEntries,
  PW: palauEntries,
  SB: solomonEntries,
  TK: tokelauEntries,
  TL: timorEntries,
  TV: tuvaluEntries,
  WS: samoaEntries,
};

const SOURCES = {
  FK: "Falkland Islands Government, Public Holidays 2026 to 2029, https://www.gov.fk/",
  FM: "FSM Code title 1 chapter 6 and the state codes, FSM Legal Information System, http://www.fsmlaw.org/",
  KI: "Public Holidays Ordinance as amended, PacLII, https://www.paclii.org/ki/legis/consol_act/pho216/; Public Service Office, https://www.pso.gov.ki/",
  KP: "Public holidays in North Korea, Wikipedia, https://en.wikipedia.org/wiki/Public_holidays_in_North_Korea; Korean lunisolar calendar computed",
  KY: "Cayman Islands Government, public holidays (Public Holidays Act, 2007 Revision; Public Holidays Order 2024), https://www.gov.ky/public-holidays",
  MH: "Public Holidays Act 1988 as amended, Nitijela, https://rmiparliament.org/; Public Service Commission holiday memos, https://www.pscrmi.net/",
  MO: "Macao SAR Government Portal, public holidays (Executive Order 60/2000, Law 7/2008), https://www.gov.mo/en/public-holidays/; Chinese lunisolar calendar computed",
  MP: "Office of the Governor, legal holidays memoranda (1 CMC § 311), https://governor.gov.mp/",
  NR: "Nauru Government Gazette, public holiday notices, https://ronlaw.gov.nr/",
  NU: "Public Holidays Ordinance 1961 and Public Service Commission circulars, Government of Niue, https://www.gov.nu/",
  PG: "National Gazette public holiday notices (Public Holidays Act 1953), PacLII, https://www.paclii.org/pg/; PNG Tourism Promotion Authority events, https://papuanewguinea.travel/events/",
  PN: "Government of the Pitcairn Islands, Public Holidays and Commemoration Days policy (2024), https://www.government.pn/",
  PW: "Palau National Code title 1 chapter 7, PacLII, http://www.paclii.org/pw/legis/consol_act/gpt1262/",
  SB: "Solomon Islands Government Gazette, national and provincial public holidays, https://solomons.gov.sb/",
  TK: "Tokelau Interpretation Rules 2003, PacLII, https://paclii.org/tk/",
  TL: "Law 10/2005 on public holidays as amended, and the Government's yearly lists, https://timor-leste.gov.tl/",
  TV: "Public Holidays Act as amended to 2022, PacLII, https://www.paclii.org/tv/",
  WS: "Ministry of Commerce, Industry and Labour, public holidays calendar (Public Holidays Act 2008), https://www.mcil.gov.ws/public-holidays-calendar",
};

const DROP = {
  KY: [
    // Hard-coded one year at a time, ending in 2026; the King's Birthday replaces it.
    { name: "Queen's Birthday" },
    // On 2 July in the library; the first Monday of July by law.
    { name: "Constitution Day", dates: ["07-02"] },
  ],
};

const supplements = Object.keys(ENTRIES)
  .sort()
  .map((country) => ({
    country,
    source: SOURCES[country],
    ...(DROP[country] ? { drop: DROP[country] } : {}),
    entries: ENTRIES[country],
  }));

export default supplements;
