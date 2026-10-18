/**
 * The Middle East and Central Asia, where date-holidays is wrong or has no
 * data:
 *
 * - The United Arab Emirates: the library marks Laylat al-Mi'raj and the
 *   first day of Ramadan as days off (they are not), and lacks Arafat Day,
 *   Commemoration Day, the second National Day and the last day of Ramadan
 *   that the cabinet adds to the Eid al-Fitr break.
 * - Iran: every Solar Hijri holiday (Nowruz, Sizdah Bedar, Islamic Republic
 *   Day, 14 and 15 Khordad, 22 Bahman, 29 Esfand) is recomputed here from the
 *   March equinox (scripts/holiday-supplements/_solar-hijri.mjs). The
 *   library's own Solar Hijri dates turn out to agree on every day from 2026
 *   to 2050; the entries add notes and no longer depend on its calendar code.
 * - Azerbaijan: the library's list is replaced: Novruz is five days off by
 *   law, 20 to 24 March (the library has one day, "Spring Festival"), Victory
 *   Day (8 November) is added, and every holiday on a weekend or on another
 *   holiday is made up on the next working day (Labour Code, art. 105).
 * - Bahrain: three days of Eid al-Fitr and two of Ashura, with weekend days
 *   made up; the library has one of each.
 * - Iran: the Islamic days of the published 1405 calendar where they differ.
 * - Uzbekistan: the presidential decree's extra days off for 2026.
 * - No data at all in the library: Qatar, Oman, Kuwait, Jordan, Iraq, Lebanon,
 *   Palestine, Syria, Yemen, Afghanistan, Kyrgyzstan, Tajikistan and
 *   Turkmenistan. Each gets its current official list.
 *
 * Islamic days come from date-holidays' own Hijri rules ("1 Shawwal",
 * "10 Dhu al-Hijjah"), so neighbours agree with the countries the library
 * covers. Every 2025 and 2026 Eid date found for these countries fell on the
 * library's day, except Oman's Eid al-Fitr 2025 (a day later), so no country
 * is shifted. Spans (how many days each Eid lasts) follow each government's
 * 2024 to 2026 announcements.
 * Every rule was checked against published dates; docs/holiday-dates.md has
 * the checks and src/lib/reference/middle-east-holidays.test.ts holds them.
 *
 * Deterministic and independent of the machine's time zone: dates are ISO
 * strings handled with Date.UTC.
 */
import Holidays from "date-holidays";
import { KABUL, TEHRAN, inGregorianYear, yearStart } from "./_solar-hijri.mjs";

// ---------------------------------------------------------------------------
// Shared pieces.

const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";
const SOLAR = "Solar date, estimated: the official date can differ by a day.";

const SUN = 0;
const TUE = 2;
const FRI = 5;
const SAT = 6;

/** Notes are sentences: each part gets a full stop (the Islamic note keeps the library's form). */
function note(...parts) {
  const kept = parts.filter(Boolean).map((part) => part.trim());
  return kept
    .map((part, index) =>
      /[.!?]$/.test(part) || (index === kept.length - 1 && part === ISLAMIC) ? part : `${part}.`,
    )
    .join(" ");
}

function isoOfMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function ymd(year, month, day) {
  return isoOfMs(Date.UTC(year, month - 1, day));
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return ymd(year, month, day + days);
}

function weekday(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The nth weekday of a month: 1 is the first, -1 the last. */
function nthWeekday(year, month, day, n) {
  if (n > 0) {
    const first = ymd(year, month, 1);
    return addDays(first, ((day - weekday(first) + 7) % 7) + 7 * (n - 1));
  }
  const last = ymd(year, month + 1, 0);
  return addDays(last, -((weekday(last) - day + 7) % 7) - 7 * (-n - 1));
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

/** Orthodox Easter Sunday: the Julian computus plus the 13 days the Julian calendar trails by to 2099. */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  return addDays(ymd(year, month, ((d + e + 114) % 31) + 1), 13);
}

const SORT = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

// ---------------------------------------------------------------------------
// Hijri dates, from date-holidays' rules.

const ruleCalendars = new Map();

/** The dates a date-holidays rule names in a Gregorian year. */
function ruleDates(rule, year) {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "public" })) {
      throw new Error(`middle-east.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}

/** Each day a Hijri rule ("1 Shawwal") falls on in or near a Gregorian year. */
export function hijriDates(rule, year) {
  return [...new Set([year - 1, year, year + 1].flatMap((y) => ruleDates(rule, y)))].sort();
}

/**
 * Islamic holidays for one year. Each spec is { rule, name, kind, text, from,
 * to }: the days from `from` to `to` (default 0 and 0) around each date the
 * rule names, kept when they are in the year. `text` is a string, or a
 * function of the offset and the rule's date.
 */
function islamic(year, specs) {
  const out = [];
  for (const { rule, name, kind, text, from = 0, to = 0 } of specs) {
    for (const main of hijriDates(rule, year)) {
      for (let offset = from; offset <= to; offset++) {
        const date = addDays(main, offset);
        if (!date.startsWith(`${year}-`)) continue;
        const words = typeof text === "function" ? text(offset, main) : text;
        out.push({ date, name, kind, note: note(words, ISLAMIC) });
      }
    }
  }
  return out;
}

/** A fixed-date day: month and day as "MM-DD". */
function fixed(year, monthDay, name, kind, text) {
  return { date: `${year}-${monthDay}`, name, kind, note: note(text) };
}

/**
 * Days that make up for holidays on a weekend: for each of `entries` on a
 * weekend day, the next working day that is not a weekend or another day off
 * (in `entries` or `others`), named "<name> (substitute day)".
 */
function substitutes(entries, weekend, text, others = []) {
  const off = new Set([...entries, ...others].filter((entry) => entry.kind === "public").map((entry) => entry.date));
  const out = [];
  for (const entry of [...entries].sort(SORT)) {
    if (entry.kind !== "public" || !weekend.includes(weekday(entry.date))) continue;
    let date = addDays(entry.date, 1);
    while (weekend.includes(weekday(date)) || off.has(date)) date = addDays(date, 1);
    off.add(date);
    out.push({ date, name: `${entry.name} (substitute day)`, kind: "public", note: note(text) });
  }
  return out;
}

const longDate = (iso) =>
  `${Number(iso.slice(8, 10))} ${
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][
      Number(iso.slice(5, 7)) - 1
    ]
  }`;

const EID_FITR = "End of Ramadan (Eid al-Fitr)";
const EID_ADHA = "Feast of the Sacrifice (Eid al-Adha)";
const ARAFAT = "Arafat Day";
const NEW_YEAR_HIJRI = "Islamic New Year";
const MAWLID = "Birthday of Muhammad (Mawlid)";
const MIRAJ = "Isra and Mi'raj";
const RAMADAN = "First day of Ramadan";

const RAMADAN_TEXT = "Not a day off. Offices keep shorter hours through Ramadan, and many restaurants close by day";
const FITR_TEXT = "The end of Ramadan. Offices and many shops close";
const ADHA_TEXT = "The feast of the sacrifice. Offices and many shops close";

const ARAFAT_TEXT = "The day Hajj pilgrims gather at Mount Arafat, the eve of Eid al-Adha";

/**
 * Eid al-Fitr, the days `fitr` = [from, to] around 1 Shawwal (a negative
 * `from` takes in the last day of Ramadan), Eid al-Adha likewise around
 * 10 Dhu al-Hijjah, and Arafat Day unless `arafat` is false.
 */
function eids(year, options = {}) {
  const {
    fitr = [0, 2],
    adha = [0, 2],
    arafat = true,
    fitrText = FITR_TEXT,
    adhaText = ADHA_TEXT,
    arafatKind = "public",
    arafatText = ARAFAT_TEXT,
  } = options;
  return islamic(year, [
    {
      rule: "1 Shawwal",
      name: EID_FITR,
      kind: "public",
      from: fitr[0],
      to: fitr[1],
      text: (offset, main) => (offset < 0 ? `The last day of Ramadan, part of the Eid break. Eid day is ${longDate(main)}` : fitrText),
    },
    { rule: "10 Dhu al-Hijjah", name: EID_ADHA, kind: "public", from: adha[0], to: adha[1], text: adhaText },
    ...(arafat ? [{ rule: "9 Dhu al-Hijjah", name: ARAFAT, kind: arafatKind, text: arafatText }] : []),
  ]);
}

// ---------------------------------------------------------------------------
// The United Arab Emirates (library fixes).

const AE_SOURCE =
  "UAE Cabinet holiday resolutions, as announced by the Federal Authority for Government Human Resources " +
  "and the Ministry of Human Resources and Emiratisation, https://www.mohre.gov.ae/; Hijri dates from date-holidays";

const AE_DECEMBER =
  "The government adds 1 or 3 December to National Day, sometimes both, and names the days each year: " +
  "2 and 3 December in 2024, 1 and 2 December in 2025";

export function uaeEntries(year) {
  return [
    ...islamic(year, [
      { rule: "27 Rajab", name: "Laylat al-Mi'raj", kind: "observance", text: "Not a day off" },
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: "Not a day off. Offices keep shorter hours through Ramadan" },
      {
        rule: "1 Shawwal",
        name: EID_FITR,
        kind: "public",
        from: -1,
        to: -1,
        text: (_, main) =>
          `The last day of Ramadan. The government added it to the Eid break in 2024 and 2026. Eid day is ${longDate(main)}`,
      },
      { rule: "9 Dhu al-Hijjah", name: ARAFAT, kind: "public", text: "The day before Eid al-Adha, a day off with it" },
    ]),
    fixed(year, "12-01", "Commemoration Day", "optional", `Honours Emiratis who died in service. ${AE_DECEMBER}`),
    fixed(year, "12-02", "National Day", "public", `Marks the union of the emirates in 1971. ${AE_DECEMBER}`),
    fixed(year, "12-03", "National Day", "optional", `The second National Day. ${AE_DECEMBER}`),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Iran (library fixes): the Solar Hijri holidays.

const IR_SOURCE =
  "Solar Hijri calendar computed from the March equinox at Tehran (Meeus, Astronomical Algorithms, via astronomia), " +
  "checked against the Iranian calendar's published year starts, https://arxiv.org/abs/astro-ph/0409620";

const NOWRUZ_TEXT =
  "The Persian New Year, at the March equinox. Many offices and shops close or keep short hours until Sizdah Bedar, " +
  "and trains, flights and hotels are busy";

/** [month, day, name, note] on the Solar Hijri calendar. */
const IR_SOLAR = [
  [1, 1, "Nowruz", NOWRUZ_TEXT],
  [1, 2, "Nowruz", NOWRUZ_TEXT],
  [1, 3, "Nowruz", NOWRUZ_TEXT],
  [1, 4, "Nowruz", NOWRUZ_TEXT],
  [1, 12, "Islamic Republic Day", "Marks the 1979 referendum that made Iran an Islamic republic"],
  [1, 13, "Sizdah Bedar", "Nature Day, the 13th day of the new year. Families picnic in parks and the countryside"],
  [3, 14, "Imam Khomeini's Demise", "Marks the death of Ayatollah Khomeini in 1989"],
  [3, 15, "Revolt of Khordad 15", "Marks the uprising of 5 June 1963"],
  [11, 22, "Anniversary of Islamic Revolution", "Marks the revolution's victory in 1979. Rallies fill the main squares"],
  [12, 29, "Nationalization of the Iranian oil industry", "Marks the nationalisation of oil in 1951"],
];

/** Year starts already published (Iran's official calendar), which the computation must give. */
const PUBLISHED_STARTS = { 1403: "2024-03-20", 1404: "2025-03-21", 1405: "2026-03-21" };

/**
 * Whether a Solar Hijri year's start is a close call: within half an hour of
 * the noon that decides it, or a day apart at the meridians given. A year
 * whose start is published is not.
 */
function closeStart(shYear, longitudes = [TEHRAN]) {
  if (PUBLISHED_STARTS[shYear]) {
    if (yearStart(shYear + 621).date !== PUBLISHED_STARTS[shYear]) {
      throw new Error(`middle-east.mjs: the computed start of ${shYear} is not the published ${PUBLISHED_STARTS[shYear]}`);
    }
    return false;
  }
  const starts = longitudes.map((longitude) => yearStart(shYear + 621, longitude));
  return starts.some((start) => Math.abs(start.margin) < 30) || new Set(starts.map((start) => start.date)).size > 1;
}

/**
 * Islamic holidays of Iran's official calendar where it differs from the
 * library's Hijri dates: [name, the library's date, the official date]. The
 * 1405 calendar (21 March 2026 to 20 March 2027), set by the University of
 * Tehran's calendar council, starts Shawwal 1447 a day after Umm al-Qura
 * (Eid al-Fitr on 1 and 2 Farvardin) and Safar and Rajab 1448 a day later
 * too (the Prophet's death on 21 Mordad, 13 Rajab on 2 Dey, Mab'ath on
 * 16 Dey), and puts 1 Shawwal 1448 on 19 Esfand, after 30 days of Ramadan.
 * The next year's calendar comes out each winter; add it here.
 */
const IR_PUBLISHED = [
  ["End of Ramadan (Eid al-Fitr)", "2026-03-20", "2026-03-21"],
  ["Eid al-Fitr (second day)", "2026-03-21", "2026-03-22"],
  ["Martyrdom of Imam Jafar", "2026-04-13", "2026-04-14"],
  ["Arbaeen-e Hosseini", "2026-08-03", "2026-08-04"],
  ["Demise of Prophet Muhammad and Imam Hassan (Mujtaba)", "2026-08-11", "2026-08-12"],
  ["Birthday of Imam Ali", "2026-12-22", "2026-12-23"],
  ["Mab'ath (the Prophet's mission)", "2027-01-05", "2027-01-06"],
  ["End of Ramadan (Eid al-Fitr)", "2027-03-09", "2027-03-10"],
  ["Eid al-Fitr (second day)", "2027-03-10", "2027-03-11"],
];

const IR_PUBLISHED_NOTE =
  "The date in Iran's official calendar for 1405. The Leader's office can still move it a day after the moon is sighted";

export function iranEntries(year) {
  const published = IR_PUBLISHED.filter(([, , date]) => date.startsWith(`${year}-`)).map(([name, , date]) => ({
    date,
    name,
    kind: "public",
    note: note(IR_PUBLISHED_NOTE),
  }));
  return [
    ...IR_SOLAR.map(([month, day, name, text]) => {
      const { date, shYear } = inGregorianYear(year, month, day);
      return { date, name, kind: "public", note: note(text, closeStart(shYear) ? SOLAR : "") };
    }),
    ...published,
  ].sort(SORT);
}

const IR_DROP = [
  ...IR_PUBLISHED.map(([name, library]) => ({
    name,
    from: Number(library.slice(0, 4)),
    to: Number(library.slice(0, 4)),
    dates: [library.slice(5)],
  })),
  { name: "Nowruz" },
  { name: "Islamic Republic Day" },
  { name: "Sizdah Bedar" },
  { name: "Imam Khomeini's Demise" },
  { name: "Revolt of Khordad 15" },
  { name: "Anniversary of Islamic Revolution" },
  { name: "Nationalization of the Iranian oil industry" },
];

// ---------------------------------------------------------------------------
// Azerbaijan (library fixes): the whole list.

const AZ_SOURCE =
  "Labour Code of the Republic of Azerbaijan, art. 105, and the Cabinet of Ministers' non-working days, as published " +
  "by Azerbaijan's embassies, https://budapest.mfa.gov.az/en/category/qeyri-is";

const NOVRUZ_AZ =
  "The spring new year: five days off by law, 20 to 24 March. Families light bonfires and share pastries and sprouted wheat";
const AZ_MOVED =
  "Makes up for the holiday falling on a weekend or on another holiday (Labour Code, art. 105). The Cabinet of Ministers confirms the days each year";

/**
 * The library's Azerbaijani list is out of date: it lacks Victory Day
 * (8 November), keeps 18 October, 12 November and 17 November as days off
 * (they are working days; the Cabinet's 2026 list leaves them out), has
 * 20 January as an observance (a non-working day) and names 28 May
 * "Republic Day" (Independence Day since 2021). Its weekend substitutes do not chain either. So every library day
 * is replaced by this list.
 */
function azerbaijanHolidays(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public", "Two days off, 1 and 2 January"),
    fixed(year, "01-02", "New Year's Day", "public", "Two days off, 1 and 2 January"),
    fixed(year, "03-08", "International Women's Day", "public"),
    ...[20, 21, 22, 23, 24].map((day) => fixed(year, `03-${day}`, "Novruz Holiday", "public", NOVRUZ_AZ)),
    fixed(year, "05-09", "Day of Victory over Fascism", "public"),
    fixed(year, "05-28", "Independence Day", "public", "Marks the first republic's declaration of independence in 1918"),
    fixed(year, "06-15", "National Salvation Day", "public"),
    fixed(year, "06-26", "Armed Forces Day", "public"),
    fixed(year, "11-08", "Victory Day", "public", "Marks the end of the 2020 war over Karabakh"),
    fixed(year, "11-09", "Flag Day", "public"),
    fixed(year, "12-31", "International Solidarity Day of Azerbaijanis", "public"),
  ];
}

function azerbaijanBayrams(year) {
  return islamic(year, [
    { rule: "1 Shawwal", name: EID_FITR, kind: "public", from: 0, to: 1, text: "Ramazan Bayram, the end of Ramadan: two days off" },
    { rule: "10 Dhu al-Hijjah", name: EID_ADHA, kind: "public", from: 0, to: 1, text: "Gurban Bayram, the feast of the sacrifice: two days off" },
  ]);
}

/**
 * Article 105: a holiday on a Saturday or Sunday, or on the same day as
 * another holiday, moves its day off to the next working day. Each one gets
 * the first weekday after it that is not a holiday or another moved day; a
 * Bayram day that falls on another holiday is the one that moves (2026:
 * Ramazan Bayram on 20 and 21 March, in Novruz, moved to 27 and 30 March;
 * Gurban Bayram's second day on Independence Day moved to 29 May). Computed
 * once for every year, as a day can move into the next year.
 */
let azMoved;
function azerbaijanMoved() {
  if (azMoved) return azMoved;
  azMoved = [];
  const all = [];
  for (let year = 2025; year <= 2051; year++) all.push(...azerbaijanHolidays(year), ...azerbaijanBayrams(year));
  const off = new Set(all.map((entry) => entry.date));
  const taken = new Set();
  for (let year = 2025; year <= 2050; year++) {
    const seen = new Set();
    const earning = [];
    for (const islamicDay of [false, true]) {
      const list = islamicDay ? azerbaijanBayrams(year) : azerbaijanHolidays(year);
      for (const entry of list.sort(SORT)) {
        const clash = seen.has(entry.date);
        seen.add(entry.date);
        if (clash || [SAT, SUN].includes(weekday(entry.date))) earning.push(entry);
      }
    }
    for (const entry of earning) {
      let date = addDays(entry.date, 1);
      while ([SAT, SUN].includes(weekday(date)) || off.has(date) || taken.has(date)) date = addDays(date, 1);
      taken.add(date);
      azMoved.push({
        date,
        name: `${entry.name} (substitute day)`,
        kind: "public",
        note: note(AZ_MOVED, entry.name === EID_FITR || entry.name === EID_ADHA ? ISLAMIC : ""),
      });
    }
  }
  return azMoved;
}

export function azerbaijanEntries(year) {
  return [
    ...azerbaijanHolidays(year),
    ...azerbaijanBayrams(year),
    ...azerbaijanMoved().filter((entry) => entry.date.startsWith(`${year}-`)),
    fixed(
      year,
      "01-20",
      "Day of National Mourning",
      "public",
      "Remembers those killed in Baku on 20 January 1990. A non-working day, not moved when it falls on a weekend",
    ),
    fixed(year, "10-18", "Day of Restoration of Independence", "observance", "Marks independence from the Soviet Union in 1991. Not a day off"),
    fixed(year, "11-12", "Constitution Day", "observance", "Not a day off"),
    fixed(year, "11-17", "National Revival Day", "observance", "Not a day off"),
  ].sort(SORT);
}

// Every library entry: the list above replaces them all.
const AZ_DROP = [{ name: /./ }];

// ---------------------------------------------------------------------------
// Bahrain (library fixes): the Eid al-Fitr and Ashura breaks.

const BH_SOURCE =
  "Crown Prince and Prime Minister's holiday circulars, https://www.pmo.gov.bh/, and Central Bank of Bahrain holiday " +
  "notices, https://www.cbb.gov.bh/; Hijri dates from date-holidays";

const BH_FITR = "The end of Ramadan: Eid day and the two days after are off";
const BH_ASHURA =
  "Two days off: the official calendar's Ashura and the day after, as Bahrain's Shia community counts Muharram by the " +
  "Jaafari calendar (25 and 26 June in 2026)";

/**
 * The library has one day for Eid al-Fitr and one for Ashura. The
 * government gives Eid day and the two after it, and two days for Ashura,
 * and a day of either break on the Friday and Saturday weekend is made up on
 * the next working day (2026: Eid on 20 to 22 March, made up on 23 and
 * 24 March; Ashura on 25 and 26 June, made up on Sunday 28 June).
 */
export function bahrainEntries(year) {
  const breaks = islamic(year, [
    { rule: "1 Shawwal", name: EID_FITR, kind: "public", from: 0, to: 2, text: BH_FITR },
    { rule: "10 Muharram", name: "Day of Ashura", kind: "public", from: 0, to: 1, text: BH_ASHURA },
  ]);
  const others = islamic(year, [
    { rule: "9 Dhu al-Hijjah", name: ARAFAT, kind: "public" },
    { rule: "10 Dhu al-Hijjah", name: EID_ADHA, kind: "public", from: 0, to: 2 },
    { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
    { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public" },
  ]);
  const fixedDays = ["01-01", "05-01", "12-16", "12-17"].map((day) => fixed(year, day, "Fixed holiday", "public"));
  return [
    ...breaks,
    ...substitutes(
      breaks,
      [FRI, SAT],
      "Makes up for a day of the break falling on the Friday and Saturday weekend. The government confirms it each year",
      [...others, ...fixedDays],
    ).map((entry) => ({ ...entry, note: note(entry.note, ISLAMIC) })),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Qatar.

const QA_SOURCE =
  "Amiri Diwan and Qatar Central Bank holiday announcements, as reported by The Peninsula, https://thepeninsulaqatar.com/, " +
  "and Time Out Doha; Labour Law No. 14 of 2004; Hijri dates from date-holidays";

export function qatarEntries(year) {
  return [
    {
      date: nthWeekday(year, 2, TUE, 2),
      name: "National Sport Day",
      kind: "public",
      note: note("The second Tuesday of February. Offices close and sports events run across the country"),
    },
    {
      date: nthWeekday(year, 3, SUN, 1),
      name: "March Bank Holiday",
      kind: "bank",
      note: note("Banks close for the day. Shops and most offices are open"),
    },
    fixed(year, "12-18", "National Day", "public", "Marks the founding of the state in 1878. Parades on Doha's Corniche"),
    ...islamic(year, [{ rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT }]),
    ...eids(year, {
      fitrText: "The end of Ramadan. Three days off for most workers; government offices close for about a week",
      adhaText: "The feast of the sacrifice. Three days off for most workers; government offices close for about five days",
      arafatKind: "optional",
      arafatText: "Government offices close for the Eid break; most private firms work",
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Oman.

const OM_SOURCE =
  "Council of Ministers and Ministry of Labour holiday announcements, as reported by the Oman Observer, " +
  "https://www.omanobserver.om/, and the Times of Oman; Royal Decree 88/2022; Hijri dates from date-holidays";

const OM_MOVES = "The government often moves it next to the weekend and announces the day in advance";
const OM_HIJRI = "Oman sights the moon itself and sometimes starts the month a day after Saudi Arabia";

/** 2026's fixed holidays, moved next to the weekend in the Council of Ministers' list of December 2025. */
const OM_2026 = {
  "Accession Day": ["2026-01-15"],
  [MIRAJ]: ["2026-01-18"],
  [NEW_YEAR_HIJRI]: ["2026-06-18"],
  [MAWLID]: ["2026-08-27"],
  "National Day": ["2026-11-25", "2026-11-26"],
};

/** For an Eid whose first day is a Friday, the next working day is off too (Royal Decree 88/2022). */
function omanFridayDay(year, rule, lastOffset, name) {
  const out = [];
  for (const main of hijriDates(rule, year)) {
    if (weekday(main) !== FRI) continue;
    let date = addDays(main, lastOffset + 1);
    while (weekday(date) === FRI || weekday(date) === SAT) date = addDays(date, 1);
    if (date.startsWith(`${year}-`)) {
      out.push({ date, name, kind: "public", note: note("Eid's first day fell on a Friday, so a day is added", ISLAMIC) });
    }
  }
  return out;
}

export function omanEntries(year) {
  const movable = [
    fixed(year, "01-11", "Accession Day", "public", `Marks Sultan Haitham's accession in 2020. ${OM_MOVES}`),
    ...islamic(year, [
      { rule: "27 Rajab", name: MIRAJ, kind: "public", text: `The Prophet's night journey. ${OM_MOVES}. ${OM_HIJRI}` },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public", text: `${OM_MOVES}. ${OM_HIJRI}` },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: `The Prophet's birthday. ${OM_MOVES}. ${OM_HIJRI}` },
    ]),
    fixed(year, "11-20", "National Day", "public", `Two days off. ${OM_MOVES}`),
    fixed(year, "11-21", "National Day", "public", `Two days off. ${OM_MOVES}`),
  ];
  const announced = year === 2026 ? OM_2026 : {};
  const kept = movable.filter((entry) => !announced[entry.name]);
  for (const [name, dates] of Object.entries(announced)) {
    for (const date of dates) {
      kept.push({ date, name, kind: "public", note: note("The day the government set for 2026, moved next to the weekend") });
    }
  }
  const ramadan =
    year === 2026
      ? [{ date: "2026-02-19", name: RAMADAN, kind: "observance", note: note(RAMADAN_TEXT, "Oman began Ramadan a day after Saudi Arabia in 2026") }]
      : islamic(year, [{ rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: `${RAMADAN_TEXT}. ${OM_HIJRI}` }]);
  return [
    ...kept,
    ...ramadan,
    ...eids(year, {
      fitr: [-1, 2],
      fitrText: `The end of Ramadan. The break runs from 29 Ramadan to the third day of Eid. ${OM_HIJRI}`,
      adhaText: `The feast of the sacrifice. ${OM_HIJRI}`,
    }),
    ...omanFridayDay(year, "1 Shawwal", 2, `${EID_FITR} (substitute day)`),
    ...omanFridayDay(year, "10 Dhu al-Hijjah", 2, `${EID_ADHA} (substitute day)`),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Kuwait.

const KW_SOURCE =
  "Civil Service Commission holiday circulars, as reported by the Arab Times, https://www.arabtimesonline.com/, " +
  "and KUNA; Hijri dates from date-holidays";

export function kuwaitEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "02-25", "National Day", "public", "Marks independence in 1961. Parades and fireworks over Kuwait City"),
    fixed(year, "02-26", "Liberation Day", "public", "Marks the end of the Iraqi occupation in 1991"),
    ...islamic(year, [
      { rule: "27 Rajab", name: MIRAJ, kind: "public", text: "The Prophet's night journey" },
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, {
      fitrText: "The end of Ramadan. The government sometimes adds days to reach the weekend",
      adhaText: "The feast of the sacrifice. The government sometimes adds days to reach the weekend",
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Jordan.

const JO_SOURCE =
  "Prime Ministry holiday circulars, as reported by the Jordan News Agency (Petra), https://petra.gov.jo/; " +
  "Hijri dates from date-holidays";

export function jordanEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "05-25", "Independence Day", "public", "Marks independence in 1946"),
    fixed(year, "12-25", "Christmas Day", "public"),
    ...islamic(year, [
      { rule: "27 Rajab", name: MIRAJ, kind: "public", text: "The Prophet's night journey" },
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, {
      fitr: [0, 3],
      adha: [0, 3],
      fitrText: "The end of Ramadan. The government sets the break each year; it was four days in 2025",
      adhaText: "The feast of the sacrifice. The break runs from Arafat Day to the fourth day of Eid",
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Iraq.

const IQ_SOURCE =
  "Official Holidays Law No. 12 of 2024, Official Gazette of Iraq (al-Waqai al-Iraqiya) no. 4777, https://moj.gov.iq/; " +
  "Hijri dates from date-holidays";

const IQ_HIJRI = "Iraq's Shia and Sunni authorities can start the month a day apart";

export function iraqEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "01-06", "Army Day", "public", "Marks the founding of the Iraqi army in 1921"),
    fixed(year, "03-21", "Nowruz", "public", "The spring new year, celebrated above all in the Kurdistan Region"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "10-03", "National Day", "public", "Marks independence and joining the League of Nations in 1932"),
    fixed(year, "12-25", "Christmas Day", "optional", "A day off for Christians"),
    ...islamic(year, [
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: `${RAMADAN_TEXT}. ${IQ_HIJRI}` },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      {
        rule: "10 Muharram",
        name: "Day of Ashura",
        kind: "public",
        text: "Marks the death of Imam Hussein. Huge processions in Karbala and other Shia cities",
      },
      {
        rule: "20 Safar",
        name: "Arbaeen",
        kind: "festival",
        text:
          "Millions of pilgrims walk to Karbala to end the 40 days of mourning for Imam Hussein. " +
          "Roads, hotels and transport in the south are packed for days before",
      },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
      { rule: "18 Dhu al-Hijjah", name: "Eid al-Ghadir", kind: "public", text: "A Shia feast, a day off for everyone since 2024" },
    ]),
    ...eids(year, {
      adha: [0, 3],
      arafat: false,
      fitrText: `The end of Ramadan. ${IQ_HIJRI}`,
      adhaText: `The feast of the sacrifice, four days off. ${IQ_HIJRI}`,
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Lebanon.

const LB_SOURCE =
  "Council of Ministers holiday decisions, as listed by the Embassy of Lebanon in Poland, https://en.lebanon.pl/, " +
  "and timeanddate.com; Hijri dates from date-holidays";

/** A day of the Easter cycle for the Western and the Orthodox churches (both listed when the Easters coincide). */
function easters(year, offset, western, orthodox, kind, text) {
  const w = addDays(easter(year), offset);
  const o = addDays(orthodoxEaster(year), offset);
  const together = w === o ? "Western and Orthodox Easter fall together this year" : "";
  return [
    { date: w, name: western, kind, note: note(text, together || "For the Western churches") },
    { date: o, name: orthodox, kind, note: note(text, together || "For the Orthodox churches") },
  ];
}

export function lebanonEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "01-06", "Armenian Christmas", "public", "Christmas for the Armenian church"),
    fixed(year, "02-09", "St Maroun's Day", "public", "The feast of the Maronite church's patron saint"),
    fixed(year, "02-14", "Rafic Hariri Memorial Day", "observance", "Marks the killing of former prime minister Rafic Hariri in 2005"),
    fixed(year, "03-25", "Feast of the Annunciation", "public", "A shared Christian and Muslim holiday"),
    ...easters(year, -2, "Good Friday", "Orthodox Good Friday", "public"),
    ...easters(year, 1, "Easter Monday", "Orthodox Easter Monday", "optional", "Government offices close; many businesses open"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "05-06", "Martyrs' Day", "observance", "Marks the nationalists hanged in Beirut and Damascus in 1916"),
    fixed(year, "05-25", "Resistance and Liberation Day", "public", "Marks the Israeli withdrawal from the south in 2000"),
    fixed(year, "08-15", "Assumption Day", "public"),
    fixed(year, "11-22", "Independence Day", "public", "Marks independence in 1943"),
    fixed(year, "12-25", "Christmas Day", "public"),
    ...islamic(year, [
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "10 Muharram", name: "Day of Ashura", kind: "public", text: "Shia communities hold processions, notably in Nabatieh" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, { fitr: [0, 1], adha: [0, 1], arafat: false }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Palestine.

const PS_SOURCE =
  "Palestinian Council of Ministers holiday decisions, as posted by municipalities (https://aldahrieh.ps/) and listed by " +
  "officeholidays.com; Hijri dates from date-holidays";

export function palestineEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "01-07", "Orthodox Christmas", "optional", "A day off for Christians. Banks close"),
    ...easters(year, 0, "Easter Sunday", "Orthodox Easter", "optional", "A day off for Christians"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "11-15", "Independence Day", "public", "Marks the 1988 declaration of independence"),
    fixed(year, "12-25", "Christmas Day", "public", "Bethlehem holds its Christmas Eve procession and midnight mass the night before"),
    ...islamic(year, [
      { rule: "27 Rajab", name: MIRAJ, kind: "public", text: "The Prophet's night journey to Jerusalem" },
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, {
      adha: [0, 3],
      adhaText: "The feast of the sacrifice. The break runs from Arafat Day to the fourth day of Eid",
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Syria.

const SY_SOURCE =
  "Holidays set by the current Syrian government: Presidential Decree No. 188 of 2025 and Legislative Decree No. 13 " +
  "of 2026 (Nowruz), as published by SANA, https://sana.sy/en/; Hijri dates from date-holidays";

export function syriaEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "03-18", "Syrian Revolution Day", "public", "Marks the start of the 2011 uprising. A holiday since 2025"),
    fixed(year, "03-21", "Mother's Day", "public"),
    fixed(year, "03-21", "Nowruz", "public", "The spring new year, celebrated above all by Kurds. A holiday since 2026"),
    fixed(year, "04-17", "Independence Day", "public", "Evacuation Day: marks the departure of the last French troops in 1946"),
    fixed(year, "05-01", "Labour Day", "public"),
    ...easters(year, 0, "Easter Sunday", "Orthodox Easter", "public"),
    fixed(year, "12-08", "Liberation Day", "public", "Marks the fall of the Assad government on 8 December 2024"),
    fixed(year, "12-25", "Christmas Day", "public"),
    ...islamic(year, [
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, { adha: [0, 3], arafat: false, adhaText: "The feast of the sacrifice, four days off" }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Yemen.

const YE_SOURCE =
  "Holidays of the Republic of Yemen as listed by timeanddate.com, https://www.timeanddate.com/holidays/yemen/, " +
  "and calendarific.com (the government in Aden and the authorities in Sanaa keep these days); Hijri dates from date-holidays";

export function yemenEntries(year) {
  return [
    fixed(year, "01-01", "New Year's Day", "bank", "Banks close. Other offices work"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "05-22", "Unity Day", "public", "Marks the union of North and South Yemen in 1990"),
    fixed(year, "09-26", "Revolution Day", "public", "Marks the 1962 revolution in the north"),
    fixed(year, "10-14", "October Revolution Day", "public", "Marks the start of the 1963 uprising against British rule in the south"),
    fixed(year, "11-30", "Independence Day", "public", "Marks the British withdrawal from Aden in 1967"),
    ...islamic(year, [
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "1 Muharram", name: NEW_YEAR_HIJRI, kind: "public" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year, {
      fitr: [-1, 3],
      adha: [0, 3],
      fitrText: "The end of Ramadan. The break usually runs from the day before Eid to the fourth day",
      adhaText: "The feast of the sacrifice. The break usually runs from Arafat Day to the fourth day of Eid",
    }),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Afghanistan.

const AF_SOURCE =
  "Holidays observed by the current authorities in Kabul (the Taliban administration), as listed by timeanddate.com, " +
  "https://www.timeanddate.com/holidays/afghanistan/, calendarlabs.com and publicholidays.info; Solar Hijri dates " +
  "computed from the March equinox (Meeus, via astronomia); Hijri dates from date-holidays";

/** [month, day, name, note] on the Solar Hijri calendar (Hamal, Sawr, ... Dalw, Hut). */
const AF_SOLAR = [
  [11, 26, "Liberation Day", "public", "Marks the Soviet withdrawal in 1989 (26 Dalw on the Afghan solar calendar)"],
  [2, 8, "Mujahideen Victory Day", "public", "Marks the mujahideen's entry into Kabul in 1992 (8 Sawr on the Afghan solar calendar)"],
  [5, 24, "Victory Day", "public", "Marks the Taliban's return to power in Kabul on 15 August 2021 (24 Asad on the Afghan solar calendar)"],
  [5, 28, "Independence Day", "public", "Marks independence from British control in 1919 (28 Asad on the Afghan solar calendar)"],
  [6, 9, "Withdrawal Day", "public", "Marks the departure of the last foreign troops on 31 August 2021 (9 Sonbola on the Afghan solar calendar)"],
  [1, 1, "Nowruz", "observance", "The Afghan new year (1 Hamal). Not an official holiday under the current authorities; many families still mark it"],
];

export function afghanistanEntries(year) {
  return [
    ...AF_SOLAR.map(([month, day, name, kind, text]) => {
      const { date, shYear } = inGregorianYear(year, month, day);
      // Kabul's noon comes 71 minutes before Tehran's, so a year can start a day apart.
      return { date, name, kind, note: note(text, closeStart(shYear, [TEHRAN, KABUL]) ? SOLAR : "") };
    }),
    ...islamic(year, [
      { rule: "1 Ramadan", name: RAMADAN, kind: "observance", text: RAMADAN_TEXT },
      { rule: "10 Muharram", name: "Day of Ashura", kind: "public", text: "Shia communities hold mourning gatherings" },
      { rule: "12 Rabi al-awwal", name: MAWLID, kind: "public", text: "The Prophet's birthday" },
    ]),
    ...eids(year),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Kyrgyzstan.

const KG_SOURCE =
  "Labour Code of the Kyrgyz Republic (in force 28 January 2025) and the Ministry of Labour's holiday calendar, " +
  "as reported by 24.kg, https://24.kg/english/; Hijri dates from date-holidays";

export function kyrgyzstanEntries(year) {
  const newYear = "New Year holidays run from 1 to 7 January";
  const may = "The May holidays run from 1 to 9 May";
  const working = "A holiday, but a working day since 2025";
  return [
    fixed(year, "01-01", "New Year's Day", "public", newYear),
    ...[2, 3, 4, 5, 6].map((day) => fixed(year, `01-0${day}`, "New Year Holidays", "public", newYear)),
    fixed(year, "01-07", "Orthodox Christmas", "public", newYear),
    fixed(year, "02-23", "Defender of the Fatherland Day", "observance", working),
    fixed(year, "03-08", "International Women's Day", "public"),
    fixed(year, "03-21", "Nooruz", "public", "The spring new year. Feasts, games and sumolok, a sweet wheat pudding"),
    fixed(year, "04-07", "Day of the People's April Revolution", "observance", `Marks the 2010 uprising. ${working}`),
    fixed(year, "05-01", "Labour Day", "public", may),
    ...[2, 3, 4, 6, 7, 8].map((day) => fixed(year, `05-0${day}`, "May Holidays", "public", may)),
    fixed(year, "05-05", "Constitution Day", "public", may),
    fixed(year, "05-09", "Victory Day", "public", may),
    fixed(year, "08-31", "Independence Day", "public", "Marks independence in 1991"),
    fixed(year, "11-07", "Days of History and Commemoration of Ancestors", "observance", working),
    fixed(year, "11-08", "Days of History and Commemoration of Ancestors", "observance", working),
    ...islamic(year, [
      { rule: "1 Shawwal", name: "Orozo Ait (Eid al-Fitr)", kind: "public", text: "The end of Ramadan" },
      { rule: "10 Dhu al-Hijjah", name: "Kurman Ait (Eid al-Adha)", kind: "public", text: "The feast of the sacrifice" },
    ]),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Tajikistan.

const TJ_SOURCE =
  "Labour Code of the Republic of Tajikistan, holidays as listed by timeanddate.com, " +
  "https://www.timeanddate.com/holidays/tajikistan/, and calendarlabs.com; Hijri dates from date-holidays";

export function tajikistanEntries(year) {
  const single = [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "03-08", "Mother's Day", "public"),
    fixed(year, "05-01", "Labour Day", "public"),
    fixed(year, "05-09", "Victory Day", "public"),
    fixed(year, "06-27", "National Unity Day", "public", "Marks the 1997 peace agreement that ended the civil war"),
    fixed(year, "09-09", "Independence Day", "public", "Marks independence in 1991"),
    fixed(year, "11-06", "Constitution Day", "public"),
  ];
  const navruz = [21, 22, 23, 24].map((day) =>
    fixed(year, `03-${day}`, "Navruz", "public", "The spring new year: four days off, 21 to 24 March. Feasts, music and sumalak"),
  );
  const eid = islamic(year, [
    { rule: "1 Shawwal", name: "Idi Ramazon (Eid al-Fitr)", kind: "public", text: "The end of Ramadan" },
    { rule: "10 Dhu al-Hijjah", name: "Idi Qurbon (Eid al-Adha)", kind: "public", text: "The feast of the sacrifice" },
  ]);
  return [
    ...single,
    ...navruz,
    ...eid,
    ...substitutes(single, [SAT, SUN], "Makes up for the holiday falling on a weekend", [...navruz, ...eid]),
    fixed(year, "02-23", "Armed Forces Day", "observance", "Not a day off"),
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Turkmenistan.

const TM_SOURCE =
  "Ministry of Labour and Social Protection holiday schedule, as reported by Beyan.tm, https://beyan.tm/en/, " +
  "and timeanddate.com; Hijri dates from date-holidays";

const TM_MOVED =
  "Makes up for the holiday falling on a Sunday: the day off moves to the next working day (Labour Code, art. 81). " +
  "Estimated: the president's decree sets the day each year";

/**
 * A holiday on a Sunday moves its day off to the next working day, by a
 * presidential decree under the Labour Code (2020: Independence Day on
 * Sunday 27 September, off on Monday 28 September; 2021: Novruz on Sunday
 * 21 March, off on Tuesday 23 March). In 2026 the decree made Monday
 * 28 September an extra day off for the 35th anniversary of independence and
 * moved the Sunday's day off to Tuesday 29 September. The 2026 list is the
 * published one; the rule is applied from 2027.
 */
export function turkmenistanEntries(year) {
  const single = [
    fixed(year, "01-01", "New Year's Day", "public"),
    fixed(year, "03-08", "International Women's Day", "public"),
    fixed(year, "03-21", "Novruz Bayramy", "public", "The spring new year: two days off, 21 and 22 March"),
    fixed(year, "03-22", "Novruz Bayramy", "public", "The spring new year: two days off, 21 and 22 March"),
    fixed(year, "05-09", "Victory Day", "public"),
    fixed(year, "05-18", "Constitution and State Flag Day", "public"),
    fixed(year, "09-27", "Independence Day", "public", "Marks independence in 1991. Parades in Ashgabat"),
    fixed(year, "10-06", "Day of Remembrance", "public", "Remembers the victims of the 1948 Ashgabat earthquake"),
    fixed(year, "12-12", "International Neutrality Day", "public", "Marks the UN's recognition of Turkmenistan's neutrality in 1995"),
  ];
  const eid = islamic(year, [
    { rule: "1 Shawwal", name: "Oraza Bayramy (Eid al-Fitr)", kind: "public", text: "The end of Ramadan" },
    {
      rule: "10 Dhu al-Hijjah",
      name: "Gurban Bayramy (Eid al-Adha)",
      kind: "public",
      from: 0,
      to: 2,
      text: "The feast of the sacrifice: three days off in 2026; the president's decree sets the days each year",
    },
  ]);
  const moved =
    year === 2026
      ? [
          fixed(2026, "09-28", "Independence Day (extra day off)", "public", "An extra day off for the 35th anniversary of independence, by presidential decree"),
          fixed(2026, "09-29", "Independence Day (substitute day)", "public", "Independence Day fell on a Sunday, so the presidential decree moved its day off here"),
        ]
      : substitutes(single, [SUN], TM_MOVED, eid);
  return [
    ...single,
    ...eid,
    ...moved,
    {
      date: nthWeekday(year, 4, SUN, -1),
      name: "Turkmen Horse Day",
      kind: "festival",
      note: note("The last Sunday of April. Races and shows of Akhal-Teke horses, above all near Ashgabat"),
    },
    {
      date: nthWeekday(year, 8, SUN, 2),
      name: "Melon Day",
      kind: "festival",
      note: note("The second Sunday of August. Melon fairs and tastings across the country"),
    },
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Uzbekistan (library additions): the yearly decree's extra days off.

const UZ_SOURCE =
  "Presidential decree of 24 December 2025 on additional non-working days and weekend shifts in 2026, as reported by " +
  "yep.uz, https://yep.uz/en, and EY Uzbekistan's payroll update for December 2025 to January 2026";

const UZ_DECREE = "An extra day off set by the presidential decree for 2026";
const UZ_SIX_DAY = "A day off for six-day-week employees only, by the presidential decree for 2026";

/**
 * Each December the president decrees the next year's extra days off, joined
 * to the holidays. The library has the holidays; this adds the decree's days.
 * Later years are added as each decree is published.
 */
const UZ_DECREES = {
  2026: [
    ["2026-01-02", "New Year's Day (extra day off)", "public", UZ_DECREE],
    ["2026-01-03", "New Year's Day (extra day off)", "optional", UZ_SIX_DAY],
    ["2026-05-28", "Eid al-Adha (extra day off)", "public", UZ_DECREE],
    ["2026-05-29", "Eid al-Adha (extra day off)", "public", UZ_DECREE],
    ["2026-05-30", "Eid al-Adha (extra day off)", "optional", UZ_SIX_DAY],
    ["2026-08-31", "Independence Day (extra day off)", "public", UZ_DECREE],
    ["2026-12-31", "New Year's Eve (extra day off)", "optional", UZ_SIX_DAY],
  ],
};

export function uzbekistanEntries(year) {
  return (UZ_DECREES[year] ?? []).map(([date, name, kind, text]) => ({ date, name, kind, note: note(text) }));
}

// ---------------------------------------------------------------------------

export const ENTRIES = {
  AE: uaeEntries,
  IR: iranEntries,
  AZ: azerbaijanEntries,
  QA: qatarEntries,
  OM: omanEntries,
  KW: kuwaitEntries,
  JO: jordanEntries,
  IQ: iraqEntries,
  LB: lebanonEntries,
  PS: palestineEntries,
  SY: syriaEntries,
  YE: yemenEntries,
  AF: afghanistanEntries,
  KG: kyrgyzstanEntries,
  TJ: tajikistanEntries,
  TM: turkmenistanEntries,
};

const supplements = [
  { country: "AE", source: AE_SOURCE, entries: uaeEntries },
  { country: "IR", source: IR_SOURCE, drop: IR_DROP, entries: iranEntries },
  { country: "AZ", source: AZ_SOURCE, drop: AZ_DROP, entries: azerbaijanEntries },
  { country: "BH", source: BH_SOURCE, entries: bahrainEntries },
  { country: "QA", source: QA_SOURCE, entries: qatarEntries },
  { country: "OM", source: OM_SOURCE, entries: omanEntries },
  { country: "KW", source: KW_SOURCE, entries: kuwaitEntries },
  { country: "JO", source: JO_SOURCE, entries: jordanEntries },
  { country: "IQ", source: IQ_SOURCE, entries: iraqEntries },
  { country: "LB", source: LB_SOURCE, entries: lebanonEntries },
  { country: "PS", source: PS_SOURCE, entries: palestineEntries },
  { country: "SY", source: SY_SOURCE, entries: syriaEntries },
  { country: "YE", source: YE_SOURCE, entries: yemenEntries },
  { country: "AF", source: AF_SOURCE, entries: afghanistanEntries },
  { country: "KG", source: KG_SOURCE, entries: kyrgyzstanEntries },
  { country: "TJ", source: TJ_SOURCE, entries: tajikistanEntries },
  { country: "TM", source: TM_SOURCE, entries: turkmenistanEntries },
  { country: "UZ", source: UZ_SOURCE, entries: uzbekistanEntries },
];

export default supplements;
