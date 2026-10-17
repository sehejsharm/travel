/**
 * Nepal, Bhutan and Mongolia, which date-holidays does not cover (Mongolia
 * has only Naadam, from festivals.mjs), and the Buddhist and regional days of
 * Russia's republics that the library lists for 2026 only.
 *
 * - Nepal: the government's public holidays (the Ministry of Home Affairs'
 *   yearly list in Nepal Rajpatra), on the Bikram Sambat and lunar calendars
 *   computed in _nepali-calendar.mjs.
 * - Bhutan: the Royal Civil Service Commission's public holidays, on the
 *   Bhutanese lunar calendar (_tibetan-calendar.mjs).
 * - Mongolia: the Law on Public Holidays and Observances, with Tsagaan Sar,
 *   Buddha's Birthday and Chinggis Khaan's Birthday on the Mongolian lunar
 *   calendar (_tibetan-calendar.mjs).
 * - Russia: Kalmykia's Buddhist days on the Tibetan (Phugpa) calendar (and
 *   Zul, which the library stops after 2025), the White Month in Buryatia,
 *   Zabaykalsky Krai and Tuva on the Mongolian one, Radonitsa (Orthodox
 *   Easter plus nine days) in the regions whose laws keep it, and Tuva's and
 *   North Ossetia's other regional days, from 2027 on.
 *
 * Every rule was checked against dates published for 2022 to 2027; the
 * checks and sources are in docs/holiday-dates.md, and
 * src/lib/reference/himalaya-holidays.test.ts holds them.
 *
 * Deterministic and independent of the machine's time zone: dates are ISO
 * strings built with Date.UTC, and instants are Julian days.
 */
import Holidays from "date-holidays";
import { orthodoxEaster } from "./festivals.mjs";
import { dateOf, isoOfJdn, monthCounts, monthSpan, newYear } from "./_tibetan-calendar.mjs";
import { bsMonthCloseCall, bsToIso, rules, tithiDays } from "./_nepali-calendar.mjs";

// ---------------------------------------------------------------------------
// Shared pieces.

const LUNAR = "Lunar date, estimated: the official date can differ by a day.";
const ISLAMIC = "Islamic lunar date, estimated: the official date can differ by a day";
const SOLAR = "Solar date, estimated: the official date can differ by a day.";

/** Notes are sentences: each part gets a full stop (the Islamic note keeps the library's form). */
function note(...parts) {
  const kept = parts.filter(Boolean).map((part) => part.trim());
  return kept
    .map((part, index) => (/[.!?]$/.test(part) || (index === kept.length - 1 && part === ISLAMIC) ? part : `${part}.`))
    .join(" ");
}

function addDays(iso, days) {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

const inYear = (year) => (iso) => iso.startsWith(`${year}-`);
const SORT = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1);

/** Every day from `first` to `last`, inclusive. */
function daysFrom(first, last) {
  const days = [];
  for (let iso = first; iso <= last; iso = addDays(iso, 1)) days.push(iso);
  return days;
}

const ruleCalendars = new Map();
/** The dates a date-holidays rule names in a Gregorian year, as festivals.mjs reads them. */
function ruleDates(rule, year) {
  let calendar = ruleCalendars.get(rule);
  if (!calendar) {
    calendar = new Holidays({});
    if (!calendar.setHoliday(rule, { name: { en: rule }, type: "public" })) {
      throw new Error(`himalaya.mjs: date-holidays cannot read the rule "${rule}"`);
    }
    ruleCalendars.set(rule, calendar);
  }
  return (calendar.getHolidays(year) ?? []).map((holiday) => holiday.date.slice(0, 10));
}

/** A date-holidays Hijri rule's days in a year, moved by `shift` days. */
export function hijriDates(rule, year, shift = 0) {
  const dates = [...ruleDates(rule, year - 1), ...ruleDates(rule, year)].map((date) => addDays(date, shift));
  return [...new Set(dates)].filter(inYear(year)).sort();
}

/** The Tibetan-calendar date in a Gregorian year: day `day` of month `month` of the lunar year that year or the year before. */
function lunarDays(version, year, month, day, options) {
  return [...new Set([year - 1, year].map((lunarYear) => dateOf(version, lunarYear, month, day, options)))].filter(
    inYear(year),
  );
}

/** The first calendar day of a lunar month (the "first day" holidays keep, even when the number 1 is skipped). */
function monthFirstDays(version, year, month) {
  const first = (lunarYear) => isoOfJdn(monthSpan(version, monthCounts(version, lunarYear, month).regular).first);
  return [...new Set([first(year - 1), first(year)])].filter(inYear(year));
}

// ---------------------------------------------------------------------------
// Nepal.

const NP_SOURCE =
  "Ministry of Home Affairs, Government of Nepal, public holiday notices in Nepal Rajpatra, " +
  "https://www.moha.gov.np/; Bikram Sambat and lunar dates computed from the Surya Siddhanta as the " +
  "Nepal Panchanga Nirnayak Samiti does; Islamic dates from date-holidays, a day later";

/**
 * The last day of the latest BS year whose list is out (2083 BS, published
 * 2082-11-18): up to it the dates are published, and match the computation.
 */
const NP_PUBLISHED_TO = "2027-04-13";

/** Nepal keeps each Islamic month a day after Saudi Arabia (2022, 2025 and 2026 Eids). */
const NP_HIJRI_SHIFT = 1;

const KV = "A day off in the Kathmandu Valley only";

/** [name, kind, BS month, BS day, note]: holidays on a fixed BS date. */
const NP_FIXED_BS = [
  ["Nepali New Year", "public", 1, 1, "Baisakh 1, the first day of the Bikram Sambat year. Bhaktapur's Bisket Jatra peaks around it"],
  ["Loktantra Diwas", "observance", 1, 11, "Marks the 2006 people's movement that restored democracy. Not a day off"],
  ["Republic Day", "public", 2, 15, "Marks the end of the monarchy in 2008"],
  ["Gen Z Martyrs' Day", "observance", 5, 23, "Remembers those killed in the protests of September 2025. Not a day off"],
  ["Constitution Day", "public", 6, 3, "National Day, for the 2015 constitution"],
  ["Tamu Lhosar", "public", 9, 15, "The Gurung New Year"],
  ["Prithvi Jayanti", "public", 9, 27, "National Unity Day, the birth anniversary of King Prithvi Narayan Shah"],
  ["Maghe Sankranti", "public", 10, 1, "Magh 1, the winter harvest festival, and the Tharu and Magar New Year"],
  ["Martyrs' Day", "public", 10, 16, "Remembers those who died for democracy"],
  ["Democracy Day", "public", 11, 7, "Prajatantra Diwas, for the end of Rana rule in 1951"],
];

/** [name, kind, lunar month, tithi, rule, note, days after]: holidays on the lunar calendar. */
const NP_LUNAR = [
  ["Buddha Jayanti", "public", "Vaishakha", 15, rules.udaya, "The Buddha's birth, enlightenment and death. Pilgrims crowd Lumbini, Swayambhu and Boudha"],
  ["Ubhauli", "public", "Vaishakha", 15, rules.udaya, "Chandi Purnima, the Kirat community's spring festival"],
  ["Janai Purnima", "public", "Shravana", 15, rules.udaya, "Raksha Bandhan. Sacred threads are changed and tied; pilgrims go to Gosaikunda"],
  ["Gai Jatra", "optional", "Shravana", 16, rules.udaya, "A day off in the Kathmandu Valley, and for the Newar community elsewhere. Processions remember the year's dead"],
  ["Krishna Janmashtami", "public", "Shravana", 23, rules.midnight, "Krishna's birth, celebrated at midnight. Crowds at Krishna Mandir in Patan"],
  ["Haritalika Teej", "optional", "Bhadrapada", 3, rules.udaya, "A day off for women. Women in red fast and dance, and crowd Pashupatinath"],
  ["Indra Jatra", "optional", "Bhadrapada", 14, rules.udaya, `${KV}. The Kumari's chariot procession in Basantapur`],
  ["Jitiya", "optional", "Bhadrapada", 23, rules.udaya, "A day off for women who keep the fast, mostly in the Terai"],
  ["Ghatasthapana", "public", "Ashvin", 1, rules.udaya, "The first day of Dashain, when barley is sown for the tika"],
  ["Laxmi Puja", "public", "Ashvin", 30, rules.pradosh, "The main night of Tihar, the festival of lights"],
  ["Govardhan Puja", "public", "Kartika", 1, rules.udaya, "Also Mha Puja, the Newar New Year"],
  ["Bhai Tika", "public", "Kartika", 2, rules.udaya, "Sisters give their brothers tika on the last day of Tihar"],
  ["Chhath", "public", "Kartika", 6, rules.sunset, "Offerings to the setting sun at rivers and ponds, biggest in the Terai"],
  ["Guru Nanak Jayanti", "optional", "Kartika", 15, rules.udaya, "A day off for Sikhs"],
  ["Udhauli", "public", "Margashirsha", 15, rules.udaya, "The Kirat community's autumn festival, also Yomari Punhi and Jyapu Day"],
  ["Sonam Lhosar", "public", "Magha", 1, rules.udaya, "The Tamang New Year"],
  ["Vasant Panchami", "optional", "Magha", 5, rules.udaya, "Saraswati Puja. Schools and colleges close"],
  ["Maha Shivaratri", "public", "Magha", 29, rules.shivaratri, "Night-long worship of Shiva. Huge crowds and sadhus at Pashupatinath"],
  ["Gyalpo Lhosar", "public", "Phalguna", 1, rules.udaya, "The Sherpa and Tibetan New Year. Celebrations at Boudha"],
  ["Holi", "optional", "Phalguna", 15, rules.firstEvening, "Fagu Purnima, the festival of colours. A day off in the hill and mountain districts, including the Kathmandu Valley; the Terai keeps the next day"],
  ["Holi", "optional", "Phalguna", 15, rules.firstEvening, "Fagu Purnima in the Terai. A day off in the 21 Terai districts, a day after the hills", 1],
  ["Ghode Jatra", "optional", "Phalguna", 30, rules.daytime, `${KV}. Horse races at Tundikhel`],
];

/**
 * The named Dashain days. The government gives every day off from Fulpati
 * (Saptami) to Duwadashi (the 12th); the others are "Dashain holiday".
 */
const DASHAIN = [
  [7, "Fulpati", "The seventh day of Dashain, when sacred leaves are carried into Kathmandu"],
  [8, "Maha Ashtami", "Animal sacrifices at Durga temples"],
  [9, "Maha Navami", "Temples are crowded and the Taleju temple opens to the public"],
  [10, "Vijaya Dashami", "The main day of Dashain, when elders give tika and jamara. Most shops and offices close for the week"],
];
const DASHAIN_GAP = "Dashain holidays continue";
const DASHAIN_LAST = "Duwadashi, the last day of the Dashain holidays";

/** A note for a lunar day, estimated after the published list. */
const npLunarNote = (date, ...parts) => note(...parts, date > NP_PUBLISHED_TO && LUNAR);

function npFixedEntries(year) {
  const entries = [];
  for (const bsYear of [year + 56, year + 57]) {
    for (const [name, kind, month, day, text] of NP_FIXED_BS) {
      const date = bsToIso(bsYear, month, day);
      if (!inYear(year)(date)) continue;
      const close = date > NP_PUBLISHED_TO && bsMonthCloseCall(bsYear, month);
      entries.push({ date, name, kind, note: note(text, close && "A close call: the Sun changes sign near the hour that decides when the month starts", close && SOLAR) });
    }
  }
  return entries;
}

function npDashain(year) {
  const named = new Map();
  for (const [tithi, name, text] of DASHAIN) {
    for (const date of tithiDays(year, "Ashvin", tithi)) {
      if (!named.has(date)) named.set(date, []);
      named.get(date).push([name, text]);
    }
  }
  const entries = [];
  for (const start of tithiDays(year, "Ashvin", 7)) {
    // Duwadashi is five or six days after Fulpati.
    const end = tithiDays(year, "Ashvin", 12).find((date) => date >= start && date <= addDays(start, 8));
    if (!end) continue;
    for (const date of daysFrom(start, end)) {
      const names = named.get(date) ?? [["Dashain holiday", date === end ? DASHAIN_LAST : DASHAIN_GAP]];
      for (const [name, text] of names) entries.push({ date, name, kind: "public", note: npLunarNote(date, text) });
    }
  }
  return entries;
}

/** Tihar: Laxmi Puja to the day after Bhai Tika, all days off. */
function npTihar(year) {
  const entries = [];
  for (const start of tithiDays(year, "Ashvin", 30, rules.pradosh)) {
    // Bhai Tika comes two to four days after Laxmi Puja; anything else is not this Tihar.
    const bhaiTika = tithiDays(year, "Kartika", 2).find((date) => date > start && date <= addDays(start, 5));
    if (!bhaiTika) continue;
    const named = new Set([start, bhaiTika, ...tithiDays(year, "Kartika", 1)]);
    for (const date of daysFrom(addDays(start, 1), addDays(bhaiTika, 1))) {
      if (named.has(date)) continue;
      const after = date > bhaiTika;
      entries.push({
        date,
        name: "Tihar holiday",
        kind: "public",
        note: npLunarNote(date, after ? "The day after Bhai Tika, the last of the Tihar holidays" : "Tihar holidays continue"),
      });
    }
  }
  return entries;
}

function npLunarEntries(year) {
  const entries = [];
  for (const [name, kind, month, tithi, rule, text, offset = 0] of NP_LUNAR) {
    for (const date of tithiDays(year, month, tithi, rule, offset)) {
      entries.push({ date, name, kind, note: npLunarNote(date, text) });
    }
  }
  return entries;
}

/** [rule, name, kind, note, announced dates]. */
const NP_ISLAMIC = [
  ["1 Shawwal", "Eid al-Fitr", "public", "The end of Ramadan", ["2026-03-21"]],
  ["10 Dhu al-Hijjah", "Bakar Eid", "public", "Eid al-Adha, the feast of the sacrifice", ["2026-05-28"]],
  ["12 Rabi al-awwal", "Prophet's Birthday", "optional", "A day off for Muslims", []],
];

function npIslamicEntries(year) {
  return NP_ISLAMIC.flatMap(([rule, name, kind, text, announced]) =>
    hijriDates(rule, year, NP_HIJRI_SHIFT).map((date) => ({
      date,
      name,
      kind,
      note: note(text, "Nepal usually keeps it a day after Saudi Arabia", !announced.includes(date) && ISLAMIC),
    })),
  );
}

export function nepalEntries(year) {
  return [
    ...npFixedEntries(year),
    ...npLunarEntries(year),
    ...npDashain(year),
    ...npTihar(year),
    ...npIslamicEntries(year),
    { date: `${year}-03-08`, name: "International Women's Day", kind: "public", note: "" },
    { date: `${year}-05-01`, name: "Labour Day", kind: "public", note: "" },
    { date: `${year}-12-25`, name: "Christmas Day", kind: "public", note: "" },
  ].sort(SORT);
}

/** Nepal's Vijaya Dashami, which Bhutan keeps as Dashain. */
export const vijayaDashami = (year) => tithiDays(year, "Ashvin", 10);

// ---------------------------------------------------------------------------
// Bhutan.

const BT_SOURCE =
  "Royal Civil Service Commission, Government holiday list, https://www.rcsc.gov.bt/; lunar dates computed on the " +
  "Bhutanese calendar (Svante Janson, Tibetan calendar mathematics, appendix A)";

/** The RCSC list for 2026 is out and matches the computation. */
const BT_PUBLISHED = new Set([2026]);

const BT_THIMPHU = "A day off in Thimphu only";

function btLunar(year, name, kind, month, day, text, options) {
  const lunar = !BT_PUBLISHED.has(year) && LUNAR;
  return lunarDays("bhutanese", year, month, day, options).map((date) => ({ date, name, kind, note: note(text, lunar) }));
}

/** Three or five days from a lunar date, as festivals run. */
function btRun(year, name, kind, month, day, length, text, options) {
  const lunar = !BT_PUBLISHED.has(year) && LUNAR;
  const entries = [];
  for (const lunarYear of [year - 1, year]) {
    const start = dateOf("bhutanese", lunarYear, month, day, options);
    for (let i = 0; i < length; i++) {
      const date = addDays(start, i);
      if (inYear(year)(date)) entries.push({ date, name, kind, note: note(text, lunar) });
    }
  }
  return entries;
}

export function bhutanEntries(year) {
  const lunar = !BT_PUBLISHED.has(year) && LUNAR;
  const losar = newYear("bhutanese", year);
  const entries = [
    { date: `${year}-01-02`, name: "Nyilo", kind: "public", note: note("The winter solstice, when the days start to lengthen. Usually 2 January; the government sets the day each year and it can move by a day") },
    ...btLunar(year, "Traditional Day of Offering", "public", 12, 1, "The first day of the last lunar month, a day of offerings and family feasts"),
    ...[0, 1].map((i) => ({ date: addDays(losar, i), name: "Losar", kind: "public", note: note("The Bhutanese New Year", lunar) })),
    ...[21, 22, 23].map((day) => ({ date: `${year}-02-${day}`, name: "Birth Anniversary of His Majesty the King", kind: "public", note: note("King Jigme Khesar Namgyel Wangchuck's birthday") })),
    ...btLunar(year, "Zhabdrung Kuchoe", "public", 3, 10, "Remembers Zhabdrung Ngawang Namgyal, who unified Bhutan"),
    { date: `${year}-05-02`, name: "Birth Anniversary of the Third Druk Gyalpo", kind: "public", note: note("King Jigme Dorji Wangchuck's birthday") },
    ...btLunar(year, "Lord Buddha's Parinirvana", "public", 4, 15, "The Buddha's enlightenment and death"),
    ...btLunar(year, "Birth Anniversary of Guru Rinpoche", "public", 5, 10, "The birth of Padmasambhava, who brought Buddhism to Bhutan"),
    ...btLunar(year, "First Sermon of Lord Buddha", "public", 6, 4, "Drukpa Tsheshi"),
    ...btLunar(year, "Thimphu Drubchoe", "optional", 8, 6, `${BT_THIMPHU}. Rituals at Tashichho Dzong before the Thimphu Tshechu`),
    ...btRun(year, "Thimphu Tshechu", "optional", 8, 10, 3, `${BT_THIMPHU}. Masked dances at Tashichho Dzong; hotels in Thimphu fill up`),
    { date: `${year}-09-23`, name: "Blessed Rainy Day", kind: "public", note: note("Thrue Bab, a day for ritual bathing. Usually 23 September; astrologers set the day each year") },
    ...vijayaDashami(year).map((date) => ({ date, name: "Dashain", kind: "public", note: note("Vijaya Dashami, kept by Bhutan's Hindu community on the Nepali calendar", lunar) })),
    ...btLunar(year, "Descending Day of Lord Buddha", "public", 9, 22, "The Buddha's return from the heaven of the Thirty-Three"),
    { date: `${year}-11-01`, name: "Coronation Day of His Majesty the King", kind: "public", note: "" },
    { date: `${year}-11-11`, name: "Birth Anniversary of the Fourth Druk Gyalpo and Constitution Day", kind: "public", note: "" },
    { date: `${year}-12-17`, name: "National Day", kind: "public", note: note("Marks the crowning of the first king in 1907") },
    ...btRun(year, "Paro Tshechu", "festival", 2, 11, 5, "Paro: masked dances at Rinpung Dzong, ending at dawn with the unrolling of a giant thangka. Bhutan's busiest festival, so book well ahead", { repeated: "second" }),
  ];
  return entries.filter((entry) => inYear(year)(entry.date)).sort(SORT);
}

// ---------------------------------------------------------------------------
// Mongolia.

const MN_SOURCE =
  "Law of Mongolia on Public Holidays and Observances, https://legalinfo.mn/; lunar dates computed on the " +
  "Mongolian calendar (Svante Janson, Tibetan calendar mathematics, appendix A)";

const MN_PUBLISHED = new Set([2026]);

export function mongoliaEntries(year) {
  const lunar = !MN_PUBLISHED.has(year) && LUNAR;
  const tsagaanSar = newYear("mongolian", year);
  const tsagaanNotes = [
    "Lunar New Year, the White Month. Families visit their elders; shops and offices close for three days",
    "The second day of Tsagaan Sar",
    "The third day of Tsagaan Sar",
  ];
  return [
    { date: `${year}-01-01`, name: "New Year's Day", kind: "public", note: "" },
    ...tsagaanNotes.map((text, i) => ({ date: addDays(tsagaanSar, i), name: "Tsagaan Sar", kind: "public", note: note(text, lunar) })),
    { date: `${year}-03-08`, name: "International Women's Day", kind: "public", note: "" },
    ...lunarDays("mongolian", year, 4, 15).map((date) => ({ date, name: "Buddha's Birthday", kind: "public", note: note("The 15th of the first summer month: the Buddha's birth, enlightenment and death", lunar) })),
    { date: `${year}-06-01`, name: "Children's Day", kind: "public", note: note("Mother and Children's Day") },
    ...monthFirstDays("mongolian", year, 10).map((date) => ({ date, name: "Chinggis Khaan's Birthday", kind: "public", note: note("National Pride Day, on the first day of the first winter month", lunar) })),
    { date: `${year}-11-26`, name: "Republic Day", kind: "public", note: note("Marks the founding of the Mongolian People's Republic in 1924") },
    { date: `${year}-12-29`, name: "Independence Day", kind: "public", note: note("National Freedom and Independence Day, for the 1911 declaration") },
  ].sort(SORT);
}

// ---------------------------------------------------------------------------
// Russia's regional days, from 2027 (date-holidays has 2026).

const RU_SOURCE =
  "Regional holiday laws and decrees (ConsultantPlus), https://www.consultant.ru/; Buddhist dates computed on the " +
  "Tibetan and Mongolian calendars (Svante Janson, Tibetan calendar mathematics)";

/** The library's own regional notes, so the later years read like 2026. */
const KALMYKIA = "Day off in Republic of Kalmykia";
const TUVA = "Day off in Republic of Tuva";
const BURYATIA = "Day off in Republic of Buryatia and Zabaykalsky Krai";
const RU_FROM = 2027;

/**
 * Radonitsa, the Tuesday nine days after Orthodox Easter. The library has it
 * every year for four republics, but for 2026 only in the regions below,
 * whose laws make it a day off every year (it was in 2025 too). From 2027
 * the library's own entries are dropped and one entry names every region, as
 * the generator merges 2026's. Irkutsk Oblast calls it the Unity Day of
 * Remembrance, which the generator keeps apart.
 */
const RADONITSA = "Day of Remembrance of the Departed (Radonitsa)";
const RADONITSA_REGIONS = [
  "Bryansk Oblast", "Kabardino-Balkar Republic", "Karachay-Cherkess Republic", "Krasnodar Krai", "Omsk Oblast",
  "Penza Oblast", "Republic of Adygea", "Republic of Dagestan", "Saratov Oblast", "Stavropol Krai",
];
const RADONITSA_NOTE = `Day off in ${RADONITSA_REGIONS.slice(0, -1).join(", ")} and ${RADONITSA_REGIONS.at(-1)}`;

/** The weekday (0 Sunday) a date falls on. */
function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The first `weekday` on or after a date. */
const onOrAfter = (iso, day) => addDays(iso, (day - weekday(iso) + 7) % 7);

export function russiaEntries(year) {
  if (year < RU_FROM) return [];
  // A note that is only the region keeps the library's form, without a full stop.
  const regional = (date, name, text, ...extra) => ({ date, name, kind: "optional", note: extra.length ? note(text, ...extra) : text });
  const radonitsa = addDays(orthodoxEaster(year), 9);
  return [
    regional(newYear("phugpa", year), "Tsagan Sar", KALMYKIA, "The Kalmyk White Month, on the Tibetan calendar", LUNAR),
    ...lunarDays("phugpa", year, 4, 15).map((date) => regional(date, "Birthday of Buddha Shakyamuni", KALMYKIA, LUNAR)),
    regional(newYear("mongolian", year), "White Month Festival (Sagaalgan)", BURYATIA, "The Buryat New Year, on the Mongolian calendar", LUNAR),
    regional(newYear("mongolian", year), "Shagaa", TUVA, "The Tuvan New Year, on the Mongolian calendar", LUNAR),
    regional(radonitsa, RADONITSA, RADONITSA_NOTE),
    regional(radonitsa, "Unity Day of Remembrance", "Day off in Irkutsk Oblast"),
    regional(`${year}-05-06`, "Constitution Day of the Republic of Tuva", TUVA),
    // Set by the Tuvan government each year: a Friday in the second half of
    // July (19 July 2024, 18 July 2025, 24 July 2026).
    regional(onOrAfter(`${year}-07-18`, 5), "Naadym", TUVA, "The herders' festival, with wrestling and horse racing", "The government sets the day each year, so it is an estimate and can move by a week"),
    // The Monday of the festival week, which runs from the Sunday before St George's Day (23 November).
    regional(onOrAfter(`${year}-11-17`, 1), "First Monday of the Uastyrdzhi (Djeorguiba) Festival", "Day off in Republic of North Ossetia-Alania", "The day is set by decree each year, so it is an estimate"),
  ];
}

/** Zul, Kalmykia's New Year of age, which the library has for 2024 and 2025 only. */
export function zulEntries(year) {
  return lunarDays("phugpa", year, 10, 25).map((date) => ({
    date,
    name: "Zul",
    kind: "optional",
    note: note(KALMYKIA, "The festival of lamps for Tsongkhapa, when every Kalmyk turns a year older", LUNAR),
  }));
}

// ---------------------------------------------------------------------------

const supplements = [
  { country: "NP", source: NP_SOURCE, entries: nepalEntries },
  { country: "BT", source: BT_SOURCE, entries: bhutanEntries },
  { country: "MN", source: MN_SOURCE, entries: mongoliaEntries },
  {
    country: "RU",
    source: RU_SOURCE,
    // The library's Radonitsa (four republics) gives way to the entry for every region.
    drop: [{ name: /Radonitsa/, from: RU_FROM }],
    entries: (year) => [...russiaEntries(year), ...zulEntries(year)].sort(SORT),
  },
];

export default supplements;
