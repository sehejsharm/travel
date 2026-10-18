/**
 * Holiday laws newer than date-holidays, and library kinds that hide real
 * closures.
 *
 * - China: the 2024 amendment of the national holiday rules (State Council
 *   Decree No. 795, in force 2025). The extra Spring Festival and Labour Day
 *   days are in build-holidays.mjs's RULE_FIXES; this adds the law's weekend
 *   make-up days, notes on the yearly bridged schedule, and 2026's schedule.
 * - Taiwan: the 2025 Act on the Implementation of Commemorative Days and
 *   Holidays. Labour Day, Teachers' Day, Retrocession Day and Constitution Day
 *   are days off for everyone, and a holiday on a Saturday is made up on the
 *   working day before, one on a Sunday on the working day after. The Lunar
 *   New Year span is in RULE_FIXES.
 * - Hong Kong: an extra general holiday when Ching Ming falls on an Easter
 *   holiday, as in 2015, 2021 and 2026.
 * - Kinds that hide closures: the late-August bank holiday (GB), Victoria Day,
 *   Thanksgiving, Remembrance Day, Truth and Reconciliation Day and Easter
 *   Monday (CA), the King's Birthday in June (AU), Maundy Thursday (ES).
 * - Ethiopia: the four feasts the library pins to one day (Genna, Timkat,
 *   Enkutatash, Meskel), the two national days it lacks, and three library
 *   days off that are not among the 12 closure days of Proclamation
 *   No. 1334/2024 (the first day of Ramadan, the Day of Lament and Derg
 *   Downfall Day).
 * - The sweep of the most-visited countries for newer laws: Mexico's
 *   inauguration day (1 October every six years since 2024), Japan's
 *   Citizens' Holiday in 2032 and 2049, Korea's Labour Day (a public holiday
 *   since 2026, with substitute days) and election days, South Africa's 2026
 *   local election day and Israel's 2026 Knesset election day (both declared
 *   days off), Vietnam's Culture Day (2026), second
 *   National Day and weekend make-up days, Morocco's Amazigh New Year (2024)
 *   and Unity Day (2026) and its two-day Eids, Egypt's Arafat Day, and the
 *   Orthodox Clean Monday in Greece and Cyprus.
 *
 * Every rule was checked against published calendars; the sources and checks
 * are in docs/holiday-dates.md and src/lib/reference/law-updates-holidays.test.ts.
 *
 * All arithmetic is on UTC dates, so the output never depends on the
 * machine's time zone.
 */
import Holidays from "date-holidays";
import { lunisolarDate } from "../build-holidays.mjs";
import { addDays, easter, nthWeekday, orthodoxEaster, ymd } from "./festivals.mjs";

// ---------------------------------------------------------------------------
// Dates.

const FROM = 2026;
const TO = 2050;
const MON = 1;
const THU = 4;
const SAT = 6;

function weekday(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const isWeekend = (iso) => weekday(iso) === 0 || weekday(iso) === SAT;

/** Whole days from one date to another. */
function daysBetween(from, to) {
  const ms = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

const calendars = new Map();

/** Every date in a Gregorian year that a date-holidays rule names. */
function ruleDates(rule, year) {
  let calendar = calendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "observance" })) {
      throw new Error(`law-updates.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    calendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}

/** The one date a rule gives in a year. */
function ruleDate(rule, year) {
  const dates = ruleDates(rule, year);
  if (dates.length !== 1) throw new Error(`law-updates.mjs: ${dates.length} dates for "${rule}" in ${year}`);
  return dates[0];
}

/** The Qingming solar term (15° of solar longitude) at UTC+8, as the library computes it. */
const qingming = (year) => ruleDate("chinese 5-01 solarterm", year);
const chinese = (year, month, day) => lunisolarDate("chinese", year, month, day);
const vietnamese = (year, month, day) => lunisolarDate("vietnamese", year, month, day);

/** The Monday on or before a date. */
function mondayOnOrBefore(iso) {
  return addDays(iso, -((weekday(iso) - MON + 7) % 7));
}

const MOON_NOTE = "Islamic lunar date, estimated: the official date can differ by a day";

const entry = (date, name, kind, note = "") => ({ date, name, kind, note });

// ---------------------------------------------------------------------------
// China.

const CN_SUBSTITUTE_NOTE =
  "Makes up for a holiday on a weekend, as the law requires. The State Council fixes the actual day each November";
const CN_SUBSTITUTE_SET = "Makes up for a holiday on a weekend, as the law requires";
const CN_NOTES = {
  "Spring Festival":
    "Four days off by law since 2025. Each November the State Council sets a longer break, with weekend working days swapped in",
  "Labour Day":
    "Two days off by law since 2025. Each November the State Council sets the break, usually five days with a weekend working day swapped in",
  "National Day":
    "Three days off by law. Each November the State Council sets the Golden Week break, usually seven days with weekend working days swapped in",
};

/** The days off the law names, in date order: [name, date]. */
function chinaStatutory(year) {
  const firstDay = chinese(year, 1, 1);
  return [
    ["New Year's Day", ymd(year, 1, 1)],
    ...[-1, 0, 1, 2].map((offset) => ["Spring Festival", addDays(firstDay, offset)]),
    ["Qingming Festival", qingming(year)],
    ["Labour Day", ymd(year, 5, 1)],
    ["Labour Day", ymd(year, 5, 2)],
    ["Dragon Boat Festival", chinese(year, 5, 5)],
    ["Mid-Autumn Festival", chinese(year, 8, 15)],
    ["National Day", ymd(year, 10, 1)],
    ["National Day", ymd(year, 10, 2)],
    ["National Day", ymd(year, 10, 3)],
  ].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

/**
 * Article 6 of the rules: a holiday that falls on a Saturday or Sunday is
 * made up on a working day. Each one gets the first weekday after it that is
 * not a holiday or another make-up day, as the State Council's notices do
 * (2026: Qingming on Sunday 5 April, made up on Monday 6 April). A holiday on
 * the same day as another (Mid-Autumn in Golden Week) is made up too, as in
 * 2020.
 */
export function chinaSubstitutes(year) {
  const statutory = chinaStatutory(year);
  const holidays = new Set(statutory.map(([, date]) => date));
  const counted = new Set();
  const taken = new Set();
  const out = [];
  for (const [name, date] of statutory) {
    const clash = counted.has(date);
    counted.add(date);
    if (!isWeekend(date) && !clash) continue;
    let day = addDays(date, 1);
    while (isWeekend(day) || holidays.has(day) || taken.has(day)) day = addDays(day, 1);
    taken.add(day);
    out.push(entry(day, `${name} (substitute day)`, "public", CN_SCHEDULES[year] ? CN_SUBSTITUTE_SET : CN_SUBSTITUTE_NOTE));
  }
  return out;
}

/**
 * The State Council's published schedules (国务院办公厅关于部分节假日安排的通知):
 * the extra weekdays off it swaps for weekend working days. 2026: notice of
 * 4 November 2025. Later years follow each November.
 */
const CN_SCHEDULES = {
  2026: {
    bridges: [
      ["2026-01-02", "New Year's Day"],
      ["2026-02-20", "Spring Festival"],
      ["2026-02-23", "Spring Festival"],
      ["2026-05-05", "Labour Day"],
      ["2026-10-06", "National Day"],
      ["2026-10-07", "National Day"],
    ],
    workdays: [
      ["2026-01-04", "New Year's Day"],
      ["2026-02-14", "the Spring Festival"],
      ["2026-02-28", "the Spring Festival"],
      ["2026-05-09", "Labour Day"],
      ["2026-09-20", "National Day"],
      ["2026-10-10", "National Day"],
    ],
  },
};

function chinaEntries(year) {
  const out = [];
  for (const [name, date] of chinaStatutory(year)) {
    if (CN_NOTES[name]) out.push(entry(date, name, "public", CN_NOTES[name]));
  }
  out.push(...chinaSubstitutes(year));
  const schedule = CN_SCHEDULES[year];
  if (schedule) {
    for (const [date, name] of schedule.bridges) {
      out.push(
        entry(
          date,
          `${name} (extra day off)`,
          "public",
          `Set in the State Council's ${year} schedule, swapped for a weekend working day`,
        ),
      );
    }
    for (const [date, holiday] of schedule.workdays) {
      out.push(
        entry(
          date,
          "Make-up working day",
          "observance",
          `Offices and schools work this weekend day, in exchange for an extra day off around ${holiday}`,
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Taiwan.

const TW_ACT = "A day off for everyone under the 2025 holidays act";
const TW_SUBSTITUTE_NOTE =
  "Makes up for a holiday on a weekend. A Saturday holiday moves to the working day before, a Sunday one to the working day after";
const TW_CHILDREN_NOTE = "Children's Day falls on Tomb Sweeping Day this year, so its day off moves";

/** The library's names for the days off the act lists, with a note where the kind changes. */
function taiwanHolidays(year) {
  return [
    { name: "Peace Memorial Day", date: ymd(year, 2, 28) },
    { name: "Children's Day", date: ymd(year, 4, 4) },
    { name: "Tomb Sweeping Day", date: qingming(year) },
    { name: "Labour Day", date: ymd(year, 5, 1), note: TW_ACT },
    { name: "Dragon Boat Festival", date: chinese(year, 5, 5) },
    { name: "Mid-Autumn Festival", date: chinese(year, 8, 15) },
    { name: "Teachers' Day", date: ymd(year, 9, 28), note: `Confucius's Birthday. ${TW_ACT}` },
    { name: "National Day / Double Tenth Day", date: ymd(year, 10, 10) },
    {
      name: "Taiwan Retrocession Day",
      date: ymd(year, 10, 25),
      note: `Now Taiwan Retrocession and Guningtou Victory Memorial Day. ${TW_ACT}`,
    },
    { name: "Constitution Day", date: ymd(year, 12, 25), note: TW_ACT },
  ];
}

/**
 * The made-up days off for Taiwan's holidays other than the Lunar New Year
 * (RULE_FIXES) and 1 January (the library's rule is right): [name, date,
 * note]. A Saturday holiday moves to the working day before, a Sunday one to
 * the working day after, skipping other holidays. Children's Day on the same
 * day as Tomb Sweeping Day moves to the day before, or the day after when it
 * is a Thursday, and then follows the weekend rule (2021, 2024, 2025).
 */
export function taiwanSubstitutes(year) {
  const holidays = taiwanHolidays(year);
  const firstDay = chinese(year, 1, 1);
  const taken = new Set([
    ymd(year, 1, 1),
    ...[-2, -1, 0, 1, 2].map((offset) => addDays(firstDay, offset)),
    ...holidays.map((holiday) => holiday.date),
  ]);
  const free = (day) => !isWeekend(day) && !taken.has(day);

  const moves = holidays.map((holiday) => ({ ...holiday, from: holiday.date, note: TW_SUBSTITUTE_NOTE }));
  const children = moves.find((move) => move.name === "Children's Day");
  if (children.date === qingming(year)) {
    children.from = addDays(children.date, weekday(children.date) === THU ? 1 : -1);
    children.note = TW_CHILDREN_NOTE;
  }

  const out = [];
  for (const move of moves.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))) {
    let day = move.from;
    if (move.from !== move.date && free(day)) {
      // Children's Day moved onto a working day: that is its day off.
    } else if (weekday(day) === SAT) {
      while (!free(day)) day = addDays(day, -1);
    } else if (weekday(day) === 0) {
      while (!free(day)) day = addDays(day, 1);
    } else {
      continue;
    }
    taken.add(day);
    out.push(entry(day, `${move.name} (substitute day)`, "public", move.note));
  }
  return out;
}

function taiwanEntries(year) {
  const out = [];
  for (const holiday of taiwanHolidays(year)) {
    if (holiday.note) out.push(entry(holiday.date, holiday.name, "public", holiday.note));
  }
  return [...out, ...taiwanSubstitutes(year)];
}

const TW_SUBSTITUTE_NAMES = [
  "Peace Memorial Day",
  "Children's Day",
  "Tomb Sweeping Day",
  "Labour Day",
  "Dragon Boat Festival",
  "Mid-Autumn Festival",
  "National Day / Double Tenth Day",
].map((name) => ({ name: `${name} (substitute day)` }));

// ---------------------------------------------------------------------------
// Hong Kong.

/**
 * When Ching Ming (or the day after it, when it is a Sunday) falls on Good
 * Friday, the day after it or Easter Monday, the next day that is not a
 * Sunday or a general holiday is one, as the gazette did in 2015, 2021 and
 * 2026. The library has 2026; this computes the rest.
 */
export function hongKongEasterClash(year) {
  const easterSunday = easter(year);
  const easterDays = [addDays(easterSunday, -2), addDays(easterSunday, -1), addDays(easterSunday, 1)];
  let chingMing = qingming(year);
  if (weekday(chingMing) === 0) chingMing = addDays(chingMing, 1);
  if (!easterDays.includes(chingMing)) return undefined;
  let day = addDays(easterSunday, 2);
  while (weekday(day) === 0 || easterDays.includes(day) || day === chingMing) day = addDays(day, 1);
  return day;
}

function hongKongEntries(year) {
  if (year === 2026) return [];
  const day = hongKongEasterClash(year);
  return day
    ? [
        entry(
          day,
          "The day following Easter Monday",
          "public",
          "Ching Ming Festival falls on an Easter holiday, so the next free day is a general holiday. Estimated: the government confirms it a year ahead",
        ),
      ]
    : [];
}

// ---------------------------------------------------------------------------
// Ethiopia.

/**
 * The Ethiopian year starts on 11 September, or 12 September after its leap
 * year (the one before a Gregorian leap year: 2023, 2027). So Enkutatash and
 * Meskel are a day later in those years, and Timkat (11 Tir) in the next
 * January. Genna is always 7 January: the Church keeps it on 28 Tahsas after
 * a leap year. Checked against 2023 and 2024: Enkutatash 12 September 2023
 * and 11 September 2024, Meskel 28 September 2023 and 27 September 2024,
 * Genna 7 January 2024, Timkat 20 January 2024.
 */
export function ethiopianFeasts(year) {
  const lateYear = year % 4 === 3;
  const leap = year % 4 === 0;
  return {
    genna: ymd(year, 1, 7),
    timkat: ymd(year, 1, leap ? 20 : 19),
    enkutatash: ymd(year, 9, lateYear ? 12 : 11),
    meskel: ymd(year, 9, lateYear ? 28 : 27),
  };
}

function ethiopiaEntries(year) {
  const feasts = ethiopianFeasts(year);
  return [
    // Proclamation 1334/2024 lists 12 closure days; these two library days
    // are not among them, so they stay as days marked, not days off.
    entry(ymd(year, 5, 28), "Derg Downfall Day", "observance", "Ginbot 20. Not a day off under Proclamation 1334/2024"),
    ...islamic("1 Ramadan", year).map((date) =>
      entry(date, "First day of Ramadan", "observance", `Not a day off under Proclamation 1334/2024. ${MOON_NOTE}`),
    ),
    entry(feasts.genna, "Christmas Day", "public", "Genna, Ethiopian Christmas"),
    entry(feasts.timkat, "Epiphany", "public", "Timkat"),
    entry(feasts.enkutatash, "New Year's Day", "public", "Enkutatash, the Ethiopian New Year"),
    entry(feasts.meskel, "Finding of the True Cross", "public", "Meskel"),
    entry(ymd(year, 5, 1), "International Workers' Day", "public"),
    entry(ymd(year, 5, 5), "Patriots' Victory Day", "public"),
  ];
}

/** Each year the library has a feast on the wrong day: drop it there. */
function ethiopiaDrops() {
  // Day of Lament (28 March) is not one of the proclamation's 12 closure days.
  const drops = [{ name: "Christmas Day", dates: ["01-06"] }, { name: "Day of Lament" }];
  for (let year = FROM; year <= TO; year++) {
    const library = {
      // date-holidays: 19 January always, 11 or 12 September by the Gregorian leap year.
      timkat: ymd(year, 1, 19),
      enkutatash: ymd(year, 9, year % 4 === 0 ? 12 : 11),
      meskel: ymd(year, 9, year % 4 === 0 ? 28 : 27),
    };
    const right = ethiopianFeasts(year);
    const rule = (name, date) => ({ name, from: year, to: year, dates: [date.slice(5)] });
    if (library.timkat !== right.timkat) drops.push(rule("Epiphany", library.timkat));
    if (library.enkutatash !== right.enkutatash) drops.push(rule("New Year's Day", library.enkutatash));
    if (library.meskel !== right.meskel) drops.push(rule("Finding of the True Cross", library.meskel));
  }
  return drops;
}

// ---------------------------------------------------------------------------
// Japan.

/**
 * A weekday between two national holidays is a holiday too (Act on National
 * Holidays, art. 3(3)). In September that is the day between Respect for the
 * Aged Day and an Autumnal Equinox two days later. The library only checks
 * 22 September, so it misses 21 September 2032 and 2049.
 */
export function citizensHoliday(year) {
  const respect = nthWeekday(year, 9, MON, 3);
  const equinox = ruleDate("september equinox in +09:00", year);
  return daysBetween(respect, equinox) === 2 ? addDays(respect, 1) : undefined;
}

// ---------------------------------------------------------------------------
// Vietnam.

const VN_SUBSTITUTE_NOTE =
  "Makes up for a holiday on a weekend (Labour Code, article 111). The government can move it";

/**
 * The second National Day off (Labour Code 2019, article 112): 1 or 3
 * September, whichever the government picks to join a weekend. It picked
 * 3 September in 2021 (Thursday the 2nd), 2024 (Monday) and 2027 (Thursday,
 * notice 11483/TB-BNV), and 1 September in 2022 (Friday), 2023 (Saturday),
 * 2025 (Tuesday) and 2026 (Wednesday).
 * With 2 September a Sunday it is taken to be the Monday after.
 */
export function vietnamSecondNationalDay(year) {
  const day = weekday(ymd(year, 9, 2));
  return ymd(year, 9, day === MON || day === THU || day === 0 ? 3 : 1);
}

/** Vietnam's days off besides Tết, which the government sets each year. */
function vietnamHolidays(year) {
  return [
    ["New Year's Day", ymd(year, 1, 1)],
    ["Hung Kings Commemorations", vietnamese(year, 3, 10)],
    ["Reunification Day", ymd(year, 4, 30)],
    ["Labour Day", ymd(year, 5, 1)],
    ["National Day", ymd(year, 9, 2)],
    ["National Day", vietnamSecondNationalDay(year)],
    ["Vietnamese Culture Day", ymd(year, 11, 24)],
  ].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

/**
 * A holiday on a Saturday or Sunday is made up on the next working day
 * (2026: Hung Kings Day on Sunday 26 April, made up on Monday 27 April).
 */
export function vietnamSubstitutes(year) {
  const holidays = vietnamHolidays(year);
  const taken = new Set(holidays.map(([, date]) => date));
  const out = [];
  for (const [name, date] of holidays) {
    if (!isWeekend(date)) continue;
    let day = addDays(date, 1);
    while (isWeekend(day) || taken.has(day)) day = addDays(day, 1);
    taken.add(day);
    out.push(entry(day, `${name} (substitute day)`, "public", VN_SUBSTITUTE_NOTE));
  }
  return out;
}

function vietnamEntries(year) {
  const out = [
    entry(
      vietnamSecondNationalDay(year),
      "National Day",
      "public",
      year <= 2027
        ? "The second National Day off"
        : "The second National Day off. Estimated: the government picks 1 or 3 September each year",
    ),
    entry(ymd(year, 11, 24), "Vietnamese Culture Day", "public", "A paid day off since 2026"),
    ...vietnamSubstitutes(year),
  ];
  if (year === 2026) {
    out.push(
      entry(
        "2026-08-31",
        "National Day",
        "optional",
        "Day off for government offices, which work on Saturday 22 August instead. Private employers choose",
      ),
    );
  }
  if (year === 2027) {
    // Ministry of Home Affairs notice 11483/TB-BNV (9 October 2026): the five
    // days of Tết set by law, two before New Year's Day and three after, plus
    // two make-up days for the weekend, Thursday 4 to Wednesday 10 February.
    // The same notice sets National Day: Thursday 2 and Friday 3 September.
    for (let day = 4; day <= 10; day++) {
      out.push(
        entry(
          ymd(2027, 2, day),
          "Vietnamese New Year",
          "public",
          "Seven days off for Tết, 4 to 10 February: the five set by law plus two for the weekend",
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Korea.

const KR_LABOUR_SUBSTITUTE =
  "Labour Day falls on a weekend or another holiday, so the next working day is off, as the 2026 amendment provides";

/**
 * The April 2026 amendment gives Labour Day (and Constitution Day, which the
 * library has) a substitute holiday: when 1 May falls on a Saturday, a Sunday
 * or another holiday, the first following day that is none of those, nor
 * another substitute day, is off (2027: Monday 3 May; 2039: Tuesday 3 May,
 * as Monday 2 May makes up for Buddha's Birthday). It needs the finished
 * calendar, so it runs on the merged entries.
 */
export function koreaLabourDaySubstitutes(entries) {
  const daysOff = new Set(entries.filter((e) => e.kind === "public").map((e) => e.date));
  const out = [...entries];
  for (let year = FROM; year <= TO; year++) {
    const labourDay = ymd(year, 5, 1);
    const clash = entries.some((e) => e.date === labourDay && e.kind === "public" && e.name !== "Labour Day");
    if (!isWeekend(labourDay) && !clash) continue;
    let day = addDays(labourDay, 1);
    while (isWeekend(day) || daysOff.has(day)) day = addDays(day, 1);
    daysOff.add(day);
    out.push(entry(day, "Labour Day (substitute day)", "public", KR_LABOUR_SUBSTITUTE));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rest.

/** Victoria Day: the Monday before 25 May. */
const victoriaDay = (year) => mondayOnOrBefore(ymd(year, 5, 24));

const islamic = (rule, year) => ruleDates(rule, year);

const LAW_UPDATES = [
  {
    country: "CN",
    source:
      "State Council of China, national holiday rules (Decree No. 795) and the 2026 holiday notice, https://www.news.cn/politics/20251104/88bcffd88ae249e58c699b8772548e3d/c.html",
    entries: chinaEntries,
  },
  {
    country: "TW",
    source:
      "Directorate-General of Personnel Administration, government office calendars 2026 and 2027, https://www.dgpa.gov.tw/",
    drop: TW_SUBSTITUTE_NAMES,
    entries: taiwanEntries,
  },
  {
    country: "HK",
    source: "General Holidays Ordinance (Cap. 149) and the yearly gazette, https://www.elegislation.gov.hk/hk/cap149",
    entries: hongKongEntries,
  },
  {
    country: "GB",
    source: "GOV.UK, UK bank holidays, https://www.gov.uk/bank-holidays",
    // In Scotland, when 1 January is a Saturday, Monday 3 January makes up
    // for New Year's Day and Tuesday 4 January for 2 January; the library
    // names both after New Year's Day.
    drop: [{ name: "New Year's Day (substitute day)", dates: ["01-04"], note: /Scotland/ }],
    entries: (year) => [
      entry(
        nthWeekday(year, 8, MON, -1),
        "Summer bank holiday",
        "public",
        "Not in Scotland, which has the first Monday of August",
      ),
      ...(weekday(ymd(year, 1, 1)) === SAT
        ? [entry(ymd(year, 1, 4), "January 2nd (substitute day)", "optional", "Day off in Scotland")]
        : []),
    ],
  },
  {
    country: "CA",
    source: "Provincial and federal employment standards, as listed by Canada Holidays, https://canada-holidays.ca/",
    drop: [{ name: "Armistice Day" }],
    entries: (year) => [
      entry(
        victoriaDay(year),
        "Victoria Day",
        "public",
        "Not a day off in New Brunswick, Newfoundland and Labrador, Nova Scotia or Prince Edward Island. Quebec has National Patriots' Day the same day",
      ),
      entry(
        ymd(year, 9, 30),
        "National Day for Truth and Reconciliation",
        "optional",
        "Day off for federal government workers and in British Columbia, Manitoba, Prince Edward Island, the Northwest Territories, Nunavut and Yukon. Most businesses elsewhere stay open",
      ),
      entry(
        addDays(easter(year), 1),
        "Easter Monday",
        "optional",
        "Day off for federal government workers. In Quebec, employers give it or Good Friday; most businesses elsewhere stay open",
      ),
      entry(
        nthWeekday(year, 10, MON, 2),
        "Thanksgiving",
        "public",
        "Not a day off by law in New Brunswick, Newfoundland and Labrador, Nova Scotia or Prince Edward Island",
      ),
      entry(
        ymd(year, 11, 11),
        "Remembrance Day",
        "optional",
        "Day off in Alberta, British Columbia, New Brunswick, Newfoundland and Labrador, Northwest Territories, Nova Scotia, Nunavut, Prince Edward Island, Saskatchewan and Yukon. Not in Manitoba, Ontario or Quebec",
      ),
    ],
  },
  {
    country: "AU",
    source: "Australian Government, public holidays, https://www.australia.gov.au/public-holidays",
    entries: (year) => [
      entry(
        nthWeekday(year, 6, MON, 2),
        "King's Birthday",
        "public",
        "Not in Western Australia or Queensland, which keep it later in the year",
      ),
    ],
  },
  {
    country: "ES",
    source: "Boletín Oficial del Estado, yearly list of national and regional holidays, https://www.boe.es/",
    entries: (year) => [
      entry(
        addDays(easter(year), -3),
        "Maundy Thursday",
        "public",
        "Not a day off in Catalonia or the Valencian Community. Regions can swap it, so check the year's regional calendar",
      ),
    ],
  },
  {
    country: "ET",
    source:
      "Public Holidays Proclamation No. 1334/2024, as summarised by DM Ethio Lawyers, https://dmethiolawyers.com/the-new-public-holidays-proclamation/",
    drop: ethiopiaDrops(),
    entries: ethiopiaEntries,
  },
  {
    country: "MX",
    source:
      "Ley Federal del Trabajo, article 74 as amended (DOF 30 September 2024), https://gaceta.diputados.gob.mx/PDF/66/2024/sep/DOF30sep2024-Art74LeyFedTrabajo.pdf",
    drop: [{ name: "Change of Federal Government", dates: ["12-01"] }],
    entries: (year) =>
      (year - 2024) % 6 === 0
        ? [entry(ymd(year, 10, 1), "Change of Federal Government", "public", "A new president takes office")]
        : [],
  },
  {
    country: "JP",
    source: "Cabinet Office of Japan, national holidays, https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html",
    entries: (year) => {
      const day = citizensHoliday(year);
      return day
        ? [
            entry(
              day,
              "Citizens' Holiday",
              "public",
              "A day between two holidays is a holiday too. The equinox it depends on is confirmed each February for the next year",
            ),
          ]
        : [];
    },
  },
  {
    country: "KR",
    source:
      "Regulations on Holidays of Government Offices as amended in April 2026, reported by Money Today, https://www.mt.co.kr/policy/2026/04/28/2026042808250174216",
    finish: koreaLabourDaySubstitutes,
    entries: (year) => [
      entry(ymd(year, 5, 1), "Labour Day", "public", "A public holiday for everyone since 2026. Before, only private-sector workers had it off"),
      // Public Official Election Act, art. 34: local elections on the first
      // Wednesday from 30 days before the term ends (30 June), National
      // Assembly ones from 50 days before (29 May). Later ones are left out,
      // as terms and dates may change.
      ...(year === 2026 ? [entry("2026-06-03", "Local Elections Day", "public", "Election day: a day off by law")] : []),
      ...(year === 2028
        ? [entry("2028-04-12", "National Assembly Election Day", "public", "Election day: a day off by law")]
        : []),
    ],
  },
  {
    country: "ZA",
    source:
      "Public Holidays Act 1994, s2A: the President's declaration of 4 November 2026 as a public holiday (SAnews), https://www.sanews.gov.za/node/84344",
    // Election days are declared one at a time, so only declared ones are listed.
    entries: (year) =>
      year === 2026
        ? [
            entry(
              "2026-11-04",
              "Local Government Elections",
              "public",
              "Election day: declared a public holiday nationwide under the Public Holidays Act",
            ),
          ]
        : [],
  },
  {
    country: "IL",
    source:
      "Knesset Elections Law 5729-1969, s.10 (election day is a day of rest); date set when the Knesset dissolved on 17 July 2026 (Times of Israel), https://www.timesofisrael.com/knesset-election-set-for-october-27-with-government-set-to-complete-full-term/",
    // Knesset elections often come early, so later ones are left out until set.
    entries: (year) =>
      year === 2026
        ? [
            entry(
              "2026-10-27",
              "Knesset Election Day",
              "public",
              "Election day: a paid day off by law, so offices, banks and schools close. Intercity buses and trains are free",
            ),
          ]
        : [],
  },
  {
    country: "VN",
    source:
      "Labour Code 2019 (articles 111 and 112), National Assembly Resolution 28/2026/QH16 and Ministry of Home Affairs notice 11483/TB-BNV (Tết 2027), https://thuvienphapluat.vn/phap-luat/chu-de/lich-nghi-le",
    entries: vietnamEntries,
  },
  {
    country: "MA",
    source:
      "Moroccan government holiday list, as published by Wafir, https://wafir.ma/fr/guide/calendrier-jours-feries-maroc-2026-2027",
    entries: (year) => [
      entry(ymd(year, 1, 14), "Amazigh New Year", "public", "Yennayer. A paid day off since 2024"),
      entry(ymd(year, 10, 31), "Unity Day", "public", "Eid al-Wahda. A day off since 2026"),
      // Two days each, the library has one.
      ...islamic("2 Shawwal", year).map((date) => entry(date, "End of Ramadan (Eid al-Fitr)", "public", MOON_NOTE)),
      ...islamic("11 Dhu al-Hijjah", year).map((date) =>
        entry(date, "Feast of the Sacrifice (Eid al-Adha)", "public", MOON_NOTE),
      ),
      ...islamic("13 Rabi al-awwal", year).map((date) => entry(date, "Birthday of Muhammad (Mawlid)", "public", MOON_NOTE)),
    ],
  },
  {
    country: "EG",
    source:
      "Egyptian cabinet holiday announcements, as listed by Egypt Independent, https://egyptindependent.com/when-is-the-next-official-holiday-in-egypt",
    entries: (year) => islamic("9 Dhu al-Hijjah", year).map((date) => entry(date, "Arafat Day", "public", MOON_NOTE)),
  },
  {
    country: "GR",
    source: "Clean Monday, 48 days before Orthodox Easter, https://en.wikipedia.org/wiki/Clean_Monday",
    drop: [{ name: "Ash Sunday" }],
    entries: (year) => [
      entry(addDays(orthodoxEaster(year), -48), "Clean Monday", "public", "The first day of Orthodox Lent, with kite flying and picnics"),
    ],
  },
  {
    country: "CY",
    source:
      "Cyprus public holidays 2026, as listed by the Eratosthenes Centre of Excellence, https://eratosthenes.org.cy/wp-content/uploads/2023/03/Public-Holidays-2026.pdf",
    drop: [{ name: "Ash Sunday" }, { name: "Clean Monday" }],
    entries: (year) => [
      entry(addDays(orthodoxEaster(year), -48), "Clean Monday", "public", "Green Monday, the first day of Orthodox Lent"),
      entry(addDays(orthodoxEaster(year), 50), "Kataklysmos", "public", "Whit Monday, the Festival of the Flood"),
    ],
  },
];

export default LAW_UPDATES;

/** For the tests. */
export const internals = { qingming, chinaStatutory, taiwanHolidays, vietnamHolidays };
