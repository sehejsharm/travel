/**
 * South Asia, where date-holidays is wrong or runs out:
 *
 * - Sri Lanka: the library pins every poya, both Eids, Milad-un-Nabi,
 *   Deepavali, Mahasivarathri and Thai Pongal to their 2026 month-days in
 *   every year (and repeats 2026's extra poya). 2026 keeps the gazette's
 *   dates; from 2027 every one is computed here.
 * - Bangladesh: Buddha Purnima, Janmashtami and Durga Puja are fixed on one
 *   day in the library (wrong even in 2026), its Islamic days run a day early,
 *   and two holidays it lists were abolished in 2024. All are replaced.
 * - India: three state days in the library are wrong (a fixed Guru Gobind
 *   Singh Jayanti that repeats india.mjs's lunar one, Kerala's Vishu filed as
 *   "Vaisakhi" on 21 April, and West Bengal's New Year fixed on 15 April).
 * - The Maldives: date-holidays has no data, so its whole list is here.
 *
 * Hindu dates use india.mjs's calendar (Meeus positions, Lahiri ayanamsa,
 * the classical tithi rules) at a local place; poya days use festivals.mjs's
 * poya rule; Islamic days use date-holidays' own Hijri rules, shifted where a
 * country keeps them a day later. Every rule was checked against published
 * dates, 2018 to 2027; docs/holiday-dates.md has the checks and
 * src/lib/reference/south-asia-holidays.test.ts holds them.
 *
 * Deterministic and independent of the machine's time zone: dates are ISO
 * strings handled with Date.UTC, and instants are Julian days.
 */
import Holidays from "date-holidays";
import { poyaNear } from "./festivals.mjs";
import { internals, lunarFestivalDays, udayaDays } from "./india.mjs";

const { lunations, tithi, sankrantiIn, day, dateOfJd, places } = internals;

// ---------------------------------------------------------------------------
// Shared pieces.

const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";
const SOLAR = "Solar date, estimated: the official date can differ by a day.";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const longDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]}`;

function addDays(iso, days) {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

const inYear = (year) => (iso) => iso.startsWith(`${year}-`);

/** Notes are sentences: each part gets a full stop (the Islamic note keeps the library's form). */
function note(...parts) {
  const kept = parts.filter(Boolean).map((part) => part.trim());
  return kept
    .map((part, index) =>
      /[.!?]$/.test(part) || (index === kept.length - 1 && part === ISLAMIC) ? part : `${part}.`,
    )
    .join(" ");
}

/** The hour of the day (IST, which is also Sri Lanka's time) of an instant. */
function istHour(jd) {
  const days = jd - 2440587.5 + 5.5 / 24;
  return (days - Math.floor(days)) * 24;
}

/** The dates a date-holidays rule names in a Gregorian year, as festivals.mjs reads them. */
const ruleCalendars = new Map();
function ruleDates(rule, year) {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "public" })) {
      throw new Error(`south-asia.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}

/**
 * Day 1 of a date-holidays Hijri rule ("1 Shawwal") moved by `shift` days, for
 * each time it falls in a Gregorian year. Last year's dates are read too, so a
 * shift across New Year is not lost.
 */
export function hijriDates(rule, year, shift = 0) {
  const dates = [...ruleDates(rule, year - 1), ...ruleDates(rule, year)].map((date) => addDays(date, shift));
  return [...new Set(dates)].filter(inYear(year)).sort();
}

/**
 * Every day of a holiday that runs from `before` days before a Hijri date to
 * `after` days after it, for each such date near a year, kept when it is in
 * the year. Returns [{ date, main }], where `main` is the Hijri date's day.
 */
function hijriSpans(rule, year, shift, before, after) {
  const mains = [...hijriDates(rule, year - 1, shift), ...hijriDates(rule, year, shift), ...hijriDates(rule, year + 1, shift)];
  const days = [];
  for (const main of new Set(mains)) {
    for (let offset = -before; offset <= after; offset++) {
      const date = addDays(main, offset);
      if (inYear(year)(date)) days.push({ date, main });
    }
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

const SORT = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1);

// ---------------------------------------------------------------------------
// Sri Lanka.

const LK_SOURCE =
  "Department of Government Printing, holiday gazettes under the Holidays Act No. 29 of 1971, https://documents.gov.lk/; " +
  "Central Bank of Sri Lanka, bank holidays, https://www.cbsl.gov.lk/; poya, Hindu and solar dates computed " +
  "(Meeus, Astronomical Algorithms; Lahiri ayanamsa); Hijri dates from date-holidays";

/** Years whose gazette is out; their dates are published, not estimates (they match the computation). */
const LK_PUBLISHED = new Set([2026, 2027]);

const JAFFNA = { lat: 9.6615, lon: 80.0255 };

/** The poya day's Sinhala name for each amanta month, Chaitra (Bak) first. */
const POYA_MONTHS = ["Bak", "Vesak", "Poson", "Esala", "Nikini", "Binara", "Vap", "Il", "Unduvap", "Duruthu", "Navam", "Madin"];

const POYA_NOTES = {
  Duruthu: "Marks the Buddha's first visit to Sri Lanka. The Kelaniya temple near Colombo holds its Duruthu Perahera procession",
  Navam: "Colombo's Gangaramaya temple holds its Navam Perahera procession around this day",
  Madin: "Marks the Buddha's first visit home after his enlightenment",
  Bak: "Marks the Buddha's second visit to Sri Lanka",
  Vesak: "The Buddha's birth, enlightenment and death. Lanterns and lit pandals fill the towns, and free food stalls (dansal) line the roads",
  Poson: "Marks the arrival of Buddhism in Sri Lanka. Pilgrims crowd Mihintale and Anuradhapura",
  Esala: "Marks the Buddha's first sermon",
  Nikini: "Kandy's Esala Perahera reaches its grand final procession around this full moon",
  Binara: "Marks the founding of the order of Buddhist nuns",
  Vap: "The end of the monks' rainy-season retreat",
  Il: "Marks the sending out of the first Buddhist missionaries",
  Unduvap: "Marks the arrival of the sacred Bo tree sapling in Anuradhapura",
};
const POYA_RULES = "A Buddhist holiday and a bank holiday. Alcohol is not sold";
const ADHI_NOTE = "An extra full moon day, in a lunar leap year";
const ADHI_CAVEAT =
  "Sri Lanka's almanac sometimes puts the extra month a month earlier, which changes the names of these poya days";

/** How close (in hours) the full-moon tithi's start is to the poya rule's 18:08 cut-off for a close call. */
const POYA_CLOSE_HOURS = 0.5;
const POYA_CUTOFF_HOURS = 18 + 8 / 60;

/**
 * Every poya day of a year: one for each full moon, named for its lunar
 * month by the Lahiri sign rule, with "Adhi" for the extra month of a leap
 * year. The day is festivals.mjs's poya rule (the date the full-moon tithi
 * begins in Sri Lanka if before 18:08, else the next day), which gave every
 * gazetted poya checked, 2018 to 2027.
 */
export function poyaDays(year) {
  const days = [];
  for (const lunation of lunations(year)) {
    const span = tithi(lunation, 15);
    const date = poyaNear(dateOfJd(span.end));
    if (!inYear(year)(date)) continue;
    const month = POYA_MONTHS[lunation.month];
    // Near the cut-off, the other of the two days the tithi's start could give.
    const start = dateOfJd(span.start);
    const close = Math.abs(istHour(span.start) - POYA_CUTOFF_HOURS) < POYA_CLOSE_HOURS;
    const alternative = close ? (date === start ? addDays(start, 1) : start) : undefined;
    days.push(alternative ? { date, month, adhi: lunation.adhik, alternative } : { date, month, adhi: lunation.adhik });
  }
  return days;
}

/**
 * The Sinhala and Tamil New Year: the day (Sri Lanka time) the Sun enters
 * sidereal Aries. The astrologers' published moment runs a few minutes ahead
 * of the Lahiri one, so ten minutes are taken off; it matters only near
 * midnight, which is a close call.
 */
export function sinhalaNewYear(year) {
  const jd = sankrantiIn(year, 0) - 10 / 1440;
  const hour = istHour(jd);
  return { date: dateOfJd(jd), close: hour < 0.5 || hour > 23.5 };
}

/**
 * Thai Pongal, the 1st of the Tamil month Thai: Sri Lanka's Tamil almanacs,
 * like Tamil Nadu's, follow the Vakya reckoning, whose Makara sankranti comes
 * about three hours after the Lahiri one. Before sunset (at Jaffna) it is that
 * day, after sunset the next. Within an hour of sunset is a close call.
 */
const VAKYA_LAG = 3.1 / 24;
export function thaiPongal(year) {
  const jd = sankrantiIn(year, 9) + VAKYA_LAG;
  const date = dateOfJd(jd);
  const sunset = day(date, JAFFNA).set;
  const pongal = jd < sunset ? date : addDays(date, 1);
  return { date: pongal, close: Math.abs(jd - sunset) < 1 / 24 };
}

function lkLunar(year, published, name, festival, text) {
  return lunarFestivalDays(year, festival, JAFFNA).map(({ date, alternative }) => ({
    date,
    name,
    kind: "public",
    note: note(text, !published && alternative && `A close call: some almanacs give ${longDate(alternative)}`, !published && LUNAR),
  }));
}

/** Sri Lanka keeps the Islamic days a day after date-holidays' (Umm al-Qura) dates: 12 of 12 in 2024 to 2027. */
const LK_HIJRI_SHIFT = 1;

export function sriLankaEntries(year) {
  const published = LK_PUBLISHED.has(year);
  const entries = [];

  for (const { date, month, adhi, alternative } of poyaDays(year)) {
    const name = `${adhi ? "Adhi " : ""}${month} Full Moon Poya Day`;
    const estimate = !published && note(alternative && `A close call: it may be ${longDate(alternative)}`, LUNAR);
    const first = adhi ? note(ADHI_NOTE, !published && ADHI_CAVEAT) : POYA_NOTES[month];
    if (month === "Vesak" && !adhi) {
      const onMayDay = date === `${year}-05-01`;
      entries.push({
        date,
        name: onMayDay ? "Labour Day and Vesak Full Moon Poya Day" : name,
        kind: "public",
        note: note(onMayDay && "Labour Day falls on Vesak this year", first, POYA_RULES, estimate),
      });
      entries.push({
        date: addDays(date, 1),
        name: "Day following Vesak Full Moon Poya Day",
        kind: "public",
        note: note("Vesak lanterns, pandals and dansal stalls carry on", estimate),
      });
    } else {
      entries.push({ date, name, kind: "public", note: note(first, POYA_RULES, estimate) });
    }
  }
  if (!entries.some((entry) => entry.name === "Labour Day and Vesak Full Moon Poya Day")) {
    entries.push({ date: `${year}-05-01`, name: "Labour Day", kind: "public", note: "May Day rallies in Colombo." });
  }

  const pongal = thaiPongal(year);
  entries.push({
    date: pongal.date,
    name: "Tamil Thai Pongal Day",
    kind: "public",
    note: note("Tamil harvest festival", !published && pongal.close && "A close call: the Sun changes sign near sunset this year", !published && pongal.close && SOLAR),
  });

  const newYear = sinhalaNewYear(year);
  const newYearEstimate = !published && newYear.close && note("The New Year moment falls near midnight, so these days may move by one", SOLAR);
  entries.push(
    {
      date: addDays(newYear.date, -1),
      name: "Day before Sinhala and Tamil New Year",
      kind: "public",
      note: note("Many shops and restaurants close for several days around the New Year", newYearEstimate),
    },
    {
      date: newYear.date,
      name: "Sinhala and Tamil New Year",
      kind: "public",
      note: note(
        "Astrologers set the auspicious times for each New Year custom. Many shops and restaurants close for several days, and buses and trains are packed",
        newYearEstimate,
      ),
    },
  );

  entries.push(
    ...lkLunar(year, published, "Mahasivarathri Day", "Maha Shivaratri", "Hindu night of Shiva worship"),
    ...lkLunar(year, published, "Deepavali Festival Day", "Naraka Chaturdashi", "Hindu festival of lights"),
  );

  const islamic = [
    ["1 Shawwal", "Id-Ul-Fitr (Ramazan Festival Day)", "The end of Ramadan"],
    ["10 Dhu al-Hijjah", "Id-Ul-Alha (Hadji Festival Day)", "The feast of the sacrifice"],
    ["12 Rabi al-awwal", "Milad-Un-Nabi (Holy Prophet's Birthday)", "The Prophet's birthday"],
  ];
  for (const [rule, name, text] of islamic) {
    for (const date of hijriDates(rule, year, LK_HIJRI_SHIFT)) {
      entries.push({ date, name, kind: "public", note: note(text, ISLAMIC) });
    }
  }
  return entries.sort(SORT);
}

// The library's Sri Lankan days that are right only in 2026.
const LK_DROP = [
  { name: /Full Moon Poya Day$/, from: 2027 },
  { name: "Id-Ul-Fitr (Ramazan Festival Day)", from: 2027 },
  { name: "Id-Ul-Alha (Hadji Festival Day)", from: 2027 },
  { name: "Milad-Un-Nabi (Holy Prophet's Birthday)", from: 2027 },
  { name: "Deepavali Festival Day", from: 2027 },
  { name: "Mahasivarathri Day", from: 2027 },
  { name: "Tamil Thai Pongal Day", from: 2027 },
  { name: "Day before Sinhala and Tamil New Year", from: 2027 },
  { name: "Sinhala and Tamil New Year", from: 2027 },
];

// ---------------------------------------------------------------------------
// Bangladesh.

const BD_SOURCE =
  "Ministry of Public Administration holiday notifications, as reported by The Daily Star, https://www.thedailystar.net/, " +
  "and The Business Standard, https://www.tbsnews.net/; Hindu and Buddhist dates computed for Dhaka " +
  "(Meeus, Astronomical Algorithms; Lahiri ayanamsa); Hijri dates from date-holidays";

const DHAKA = { lat: 23.8103, lon: 90.4125 };

/** Bangladesh keeps the Islamic days a day after date-holidays' dates: 11 of 12 in 2025 and 2026. */
const BD_HIJRI_SHIFT = 1;
const BD_HIJRI_NOTE = "Bangladesh usually starts each Islamic month a day after Saudi Arabia";

/** Years whose holiday list is out (2026, approved November 2025). */
const BD_PUBLISHED = new Set([2026]);

/**
 * The Eid breaks the government announced: days before and after Eid. Other
 * years get the day before, Eid and the day after, the core the lists have
 * long held; the government often adds days around them.
 */
const BD_EID_SPANS = {
  2026: { fitr: [2, 2], adha: [2, 3] },
};

/** Extra days the government added after its list was out. */
const BD_EXTRA = {
  2026: [
    {
      date: "2026-10-22",
      name: "Durga Puja break",
      kind: "bank",
      note: "Added to the Durga Puja break by executive order on 7 October 2026: offices and banks close.",
    },
  ],
};

export function bangladeshEntries(year) {
  const published = BD_PUBLISHED.has(year);
  const lunar = !published && LUNAR;
  const entries = [];

  for (const { date, alternative } of lunarFestivalDays(year, "Buddha Purnima", DHAKA)) {
    entries.push({
      date,
      name: "Buddha Purnima",
      kind: "public",
      note: note("Birth, enlightenment and death of the Buddha", !published && alternative && `A close call: it may be ${longDate(alternative)}`, lunar),
    });
  }
  for (const { date } of lunarFestivalDays(year, "Janmashtami", DHAKA)) {
    entries.push({ date, name: "Janmashtami", kind: "public", note: note("Birth of Krishna", lunar) });
  }
  for (const { date, alternative } of udayaDays(year, "Ashvin", 10, DHAKA)) {
    entries.push({
      date,
      name: "Durga Puja (Bijoya Dashami)",
      kind: "public",
      note: note(
        "The last day of Durga Puja, when the images are immersed in rivers",
        !published && alternative && `A close call: it may be ${longDate(alternative)}`,
        lunar,
      ),
    });
    entries.push({
      date: addDays(date, -1),
      name: "Durga Puja (Maha Navami)",
      kind: "bank",
      note: note("A government holiday by executive order: offices and banks close, most shops open", lunar),
    });
  }

  const spans = BD_EID_SPANS[year] ?? { fitr: [1, 1], adha: [1, 1] };
  const eidBreak = (main) =>
    note(
      `Eid day is ${longDate(main)}. Offices, banks and most shops close for the Eid break, and transport out of Dhaka is packed`,
      !published && "The government sets the break's days each year",
      BD_HIJRI_NOTE,
      ISLAMIC,
    );
  for (const [rule, name, [before, after]] of [
    ["1 Shawwal", "End of Ramadan (Eid al-Fitr)", spans.fitr],
    ["10 Dhu al-Hijjah", "Feast of the Sacrifice (Eid al-Adha)", spans.adha],
  ]) {
    for (const { date, main } of hijriSpans(rule, year, BD_HIJRI_SHIFT, before, after)) {
      entries.push({ date, name, kind: "public", note: eidBreak(main) });
    }
  }
  const islamic = [
    ["15 Shaban", "Shab-e-Barat", "bank", "A night of prayer. A government holiday by executive order: offices and banks close"],
    ["27 Ramadan", "Shab-e-Qadr", "bank", "The night of power, near the end of Ramadan. A government holiday by executive order: offices and banks close"],
    ["10 Muharram", "Day of Ashura", "public", "Shia processions in Old Dhaka"],
    ["12 Rabi al-awwal", "Birthday of Muhammad (Mawlid)", "public", "Eid-e-Milad-un-Nabi"],
  ];
  for (const [rule, name, kind, text] of islamic) {
    for (const date of hijriDates(rule, year, BD_HIJRI_SHIFT)) {
      entries.push({ date, name, kind, note: note(text, BD_HIJRI_NOTE, ISLAMIC) });
    }
  }

  entries.push({
    date: `${year}-08-05`,
    name: "July Mass Uprising Day",
    kind: "public",
    note: "Marks the uprising that ended Sheikh Hasina's government on 5 August 2024. A public holiday since 2025.",
  });
  entries.push(...(BD_EXTRA[year] ?? []));
  return entries.sort(SORT);
}

const BD_DROP = [
  { name: "Buddha's Birthday" },
  { name: "Krishna Janmashtami" },
  { name: "Durga Puja" },
  { name: /Eid al-Fitr/ },
  { name: /Eid al-Adha/ },
  { name: "Day of Ashura" },
  { name: /Mawlid/ },
  // Struck off the holiday list by the interim government in October 2024;
  // not in the 2025 or 2026 lists.
  { name: "Mujib's Birthday & Children's Day" },
  { name: "National Mourning Day" },
];

// ---------------------------------------------------------------------------
// India: the library's state days that are wrong.

const IN_SOURCE =
  "Government of Kerala holiday notification for 2026, as reported by Onmanorama, " +
  "https://www.onmanorama.com/news/kerala/2025/10/29/kerala-public-holidays-2026-full-list.html; " +
  "Mesha sankranti computed (Meeus, Astronomical Algorithms; Lahiri ayanamsa)";

/**
 * Vishu, Kerala's New Year: the first sunrise (at Kochi) after the Sun enters
 * sidereal Aries, when the Vishukkani is seen. Within half an hour of sunrise
 * is a close call.
 */
export function vishu(year) {
  const jd = sankrantiIn(year, 0);
  const d = day(dateOfJd(jd), places.KOCHI);
  return { date: jd < d.rise ? d.iso : addDays(d.iso, 1), close: Math.abs(jd - d.rise) < 0.5 / 24 };
}

/**
 * Poila Baishakh, the Bengali New Year: the Bengali almanacs start a month the
 * day after the sankranti if it comes before midnight, so the day after the
 * civil date of the Mesha sankranti. Their Surya Siddhanta moment can come up
 * to a few hours after the Lahiri one, so a late-evening sankranti is a close
 * call.
 */
export function poilaBaishakh(year) {
  const jd = sankrantiIn(year, 0);
  const hour = istHour(jd);
  return { date: addDays(dateOfJd(jd), 1), close: hour > 21 || hour < 0.5 };
}

export function indiaFixes(year) {
  const kerala = vishu(year);
  const bengal = poilaBaishakh(year);
  return [
    {
      date: kerala.date,
      name: "Vishu",
      kind: "optional",
      note: note("Kerala's New Year. A day off in Kerala", kerala.close && "A close call: the Sun changes sign near sunrise this year", kerala.close && SOLAR),
    },
    {
      date: bengal.date,
      name: "Bengali New Year",
      kind: "optional",
      note: note("Poila Baishakh. A day off in West Bengal", bengal.close && "A close call: the Sun changes sign late in the evening this year", bengal.close && SOLAR),
    },
  ];
}

const IN_DROP = [
  // Fixed on 5 January in the library; india.mjs gives the lunar date.
  { name: "Guru Gobind Singh Jayanti" },
  // Kerala's day is Vishu, about 14 April, not Vaisakhi on 21 April.
  { name: "Vaisakhi", note: /Kerala/ },
  // Fixed on 15 April; it follows the Mesha sankranti.
  { name: "Bengali New Year" },
];

// ---------------------------------------------------------------------------
// The Maldives.

const MV_SOURCE =
  "President's Office of the Maldives holiday announcements, as reported by Standard Maldives, https://standard.mv/, " +
  "and edition.mv, https://edition.mv/; Hijri dates from date-holidays";

export function maldivesEntries(year) {
  const fixed = (month, date, name, text) => ({ date: `${year}-${month}-${date}`, name, kind: "public", note: text });
  const entries = [
    fixed("01", "01", "New Year's Day"),
    fixed("05", "01", "Labour Day"),
    fixed("07", "26", "Independence Day", "Independence from Britain in 1965. The day after is a holiday too."),
    fixed("07", "27", "Independence Day", "Independence from Britain in 1965. The day after is a holiday too."),
    fixed("11", "03", "Victory Day", "Marks the defeat of the 1988 coup attempt."),
    fixed("11", "11", "Republic Day", "The republic was declared in 1968."),
  ];
  const days = [
    ["1 Ramadan", 0, 0, "Beginning of Ramadan", "On inhabited islands, cafes and restaurants close in daylight through Ramadan; resorts carry on as normal"],
    ["1 Shawwal", 0, 2, "Eid al-Fitr", "The end of Ramadan. Offices and most shops on inhabited islands close"],
    ["9 Dhu al-Hijjah", 0, 0, "Hajj Day", "The day of Arafat"],
    ["10 Dhu al-Hijjah", 0, 3, "Eid al-Adha", "The feast of the sacrifice. Offices and most shops on inhabited islands close"],
    ["1 Muharram", 0, 0, "Islamic New Year"],
    ["1 Rabi al-awwal", 0, 0, "National Day", "Qaumee Dhuvas: Muhammad Thakurufaanu's victory over the Portuguese in 1573"],
    ["12 Rabi al-awwal", 0, 0, "The Prophet's Birthday"],
    ["2 Rabi al-thani", 0, 0, "The Day Maldives Embraced Islam", "Marks the conversion to Islam in 1153"],
  ];
  for (const [rule, before, after, name, text] of days) {
    for (const { date } of hijriSpans(rule, year, 0, before, after)) {
      entries.push({ date, name, kind: "public", note: note(text, ISLAMIC) });
    }
  }
  return entries.map((entry) => (entry.note ? entry : { ...entry, note: "" })).sort(SORT);
}

// ---------------------------------------------------------------------------

const supplements = [
  { country: "LK", source: LK_SOURCE, drop: LK_DROP, entries: sriLankaEntries },
  { country: "BD", source: BD_SOURCE, drop: BD_DROP, entries: bangladeshEntries },
  { country: "IN", source: IN_SOURCE, drop: IN_DROP, entries: indiaFixes },
  { country: "MV", source: MV_SOURCE, entries: maldivesEntries },
];

export default supplements;
