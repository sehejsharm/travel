/**
 * Corrections to date-holidays' own data that are not newer laws (those are
 * in law-updates.mjs): days the library lacks, kinds that say a day off
 * where there is none (or hide one there is), and rules that need the
 * finished calendar.
 *
 * - Indonesia: Easter Sunday, a national holiday in every year's joint
 *   decree, and the decrees' collective-leave days (cuti bersama) for the
 *   years published, 2026 and 2027.
 * - Malaysia: a federal holiday on a Sunday gives the next working day off
 *   (Holidays Act 1951, s.3). The library does this for its fixed days but
 *   not its Islamic ones, and lets a substitute land on another holiday, so
 *   every substitute is worked out again on the finished calendar.
 * - The United States: the day after Thanksgiving is one day off under six
 *   state names; they are merged into one entry naming each state's name.
 *   Nevada's Family Day and West Virginia's Lincoln's Day follow Thanksgiving
 *   by law, not the library's fourth Friday of November.
 * - The Netherlands: Liberation Day (5 May), which the library files as a
 *   school holiday, so it was dropped.
 * - Kinds: Easter Sunday in the Philippines (not in the yearly proclamation),
 *   Denmark's Constitution Day and Christmas Eve (banks close and shops close
 *   early by law), St Olav's Day in the Faroe Islands (off for most workers),
 *   Poland's Flag Day (a working day). Library "optional" days that are no
 *   one's day off become observances: Brazil's Carnival weekend, Guatemala's
 *   Father's Day, St Olav's Day in Norway and Svalbard, Sweden's Twelfth
 *   Night, Walpurgis Night and All Saints' Eve, San Marino's New Year's Eve.
 * - Notes on "optional" days, saying who has them off: Brazil's Ash
 *   Wednesday, Hungary's Christmas Eve. (Notes that suit every year of a
 *   library day are in build-holidays.mjs, LIBRARY_NOTES.)
 * - Notes: the Vatican's days for the reigning pope.
 *
 * Every date is computed with UTC dates, so the output never depends on the
 * machine's time zone.
 */
import { addDays, easter, nthWeekday, ymd } from "./festivals.mjs";

const FROM = 2026;
const TO = 2050;
const SUN = 0;
const SAT = 6;
const THU = 4;

function weekday(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const entry = (date, name, kind, note = "") => ({ date, name, kind, note });

const SUBSTITUTE = " (substitute day)";
const MOON_NOTE = "Islamic lunar date, estimated: the official date can differ by a day";
const LUNAR_NOTE = "Lunar date, estimated: the official date can differ by a day.";

/** "Day off in A, B and C. More" → ["A", "B", "C"]. */
function regionsIn(note) {
  const match = /^Day off in ([^.]+)/.exec(note ?? "");
  return match ? match[1].split(/, | and /) : [];
}

function listOf(names) {
  const sorted = [...new Set(names)].sort();
  return sorted.length <= 1 ? sorted.join("") : `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Indonesia.

const ID_SOURCE =
  "Joint decrees of the Ministers of Religious Affairs, Manpower and Administrative Reform on national holidays and " +
  "collective leave (cuti bersama) in 2026, https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026, " +
  "and 2027 (SKB 1205, 3 and 2 of 2026), https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027";

const CUTI_BERSAMA_NOTE =
  "Collective leave: government offices close; private employers choose whether to close, and it counts against annual leave";

/** The decrees' collective-leave days still to come or in 2027; each year's is published in September. */
const CUTI_BERSAMA = {
  2026: ["2026-12-24"],
  // SKB 1205, 3 and 2 of 2026 (signed 15 September 2026), all eight days.
  2027: [
    "2027-02-05", // Chinese New Year (Imlek), Saturday 6 February
    "2027-03-09", // Eid al-Fitr, 10 and 11 March
    "2027-03-12",
    "2027-03-15",
    "2027-03-25", // Good Friday (Wafat Yesus Kristus), 26 March
    "2027-05-18", // Eid al-Adha, 17 May
    "2027-05-19", // Vesak (Waisak), 20 May
    "2027-12-24", // Christmas
  ],
};

const LAST_DECREE = 2027;

function indonesiaEntries(year) {
  return [
    entry(easter(year), "Easter Sunday", "public", "Kebangkitan Yesus Kristus, a national holiday"),
    ...(CUTI_BERSAMA[year] ?? []).map((date) => entry(date, "Collective leave (cuti bersama)", "optional", CUTI_BERSAMA_NOTE)),
  ];
}

/** After the last published decree, Eid al-Fitr's note says collective leave is usually added. */
function indonesiaFinish(entries) {
  return entries.map((e) =>
    e.name === "End of Ramadan (Eid al-Fitr)" && Number(e.date.slice(0, 4)) > LAST_DECREE
      ? {
          ...e,
          note: `The government usually adds collective-leave days (cuti bersama) around it, set each September. ${e.note}`,
        }
      : e,
  );
}

// ---------------------------------------------------------------------------
// Malaysia.

const MY_SUBSTITUTE = "Kedah, Kelantan and Terengganu, whose weekend is Friday and Saturday, can differ";

/**
 * Holidays Act 1951, s.3: a public holiday on a Sunday makes the next day
 * that is not a holiday a public holiday (2026: Hari Raya Aidilfitri's second
 * day on Sunday 22 March, off on Monday 23 March; 2027: Awal Muharram on
 * Sunday 6 June, with the Agong's Birthday on Monday 7 June, off on Tuesday
 * 8 June). Every public substitute day is worked out again here, so one never
 * lands on another holiday. A national day off that some states do not keep
 * ("Not a day off in ...") gets its substitute in the same states.
 */
export function malaysiaSundaySubstitutes(entries) {
  const isSubstitute = (e) => e.name.endsWith(SUBSTITUTE) && e.kind === "public";
  const kept = entries.filter((e) => !isSubstitute(e));
  const previous = new Map(entries.filter(isSubstitute).map((e) => [`${e.date}|${e.name}`, e]));
  const daysOff = new Set(kept.filter((e) => e.kind === "public").map((e) => e.date));
  const earning = kept.filter(
    (e) => weekday(e.date) === SUN && (e.kind === "public" || (e.kind === "optional" && /^Not a day off in /.test(e.note))),
  );

  const out = [...kept];
  const taken = new Set();
  const seen = new Set();
  for (const holiday of earning) {
    const key = `${holiday.date}|${holiday.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let date = addDays(holiday.date, 1);
    while (weekday(date) === SAT || weekday(date) === SUN || daysOff.has(date) || taken.has(date)) date = addDays(date, 1);
    taken.add(date);
    const name = `${holiday.name}${SUBSTITUTE}`;
    const before = previous.get(`${date}|${name}`);
    if (before && holiday.kind === "public") {
      out.push(before);
      continue;
    }
    const regions = /^Not a day off in [^.]+/.exec(holiday.note)?.[0];
    const estimate = holiday.note.includes(MOON_NOTE) ? MOON_NOTE : holiday.note.includes(LUNAR_NOTE) ? LUNAR_NOTE : "";
    const text = [regions, `${holiday.name} falls on a Sunday, so the next working day is off`, MY_SUBSTITUTE, estimate]
      .filter(Boolean)
      .map((part) => (/[.]$/.test(part) || part === MOON_NOTE ? part : `${part}.`))
      .join(" ");
    out.push(entry(date, name, holiday.kind, text));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The United States.

/** State names for the day after Thanksgiving: [name, state]. */
const US_AFTER_THANKSGIVING = [
  ["Family Day", "Nevada"],
  ["Lincoln's Birthday", "Indiana"],
  ["Lincoln's Day", "West Virginia"],
  ["Native American Heritage Day", "Maryland"],
  ["State Holiday", "Georgia"],
];

/**
 * The day after Thanksgiving: one row naming every state that takes it off,
 * and what each one calls it, instead of six rows on one day.
 */
export function usDayAfterThanksgiving(entries) {
  const out = [...entries];
  for (let year = FROM; year <= TO; year++) {
    const day = addDays(nthWeekday(year, 11, THU, 4), 1);
    const main = out.findIndex((e) => e.date === day && e.name === "Day After Thanksgiving");
    if (main === -1) continue;
    const regions = regionsIn(out[main].note);
    const called = [];
    for (const [name, state] of US_AFTER_THANKSGIVING) {
      // Nevada's and West Virginia's are in the library as the fourth Friday of November.
      const index = out.findIndex(
        (e) => e.name === name && e.kind === "optional" && e.date.startsWith(`${year}-11-`) && regionsIn(e.note).includes(state),
      );
      if (index === -1) continue;
      out.splice(index, 1);
      regions.push(state);
      called.push(`${name} in ${state}`);
    }
    const at = out.findIndex((e) => e.date === day && e.name === "Day After Thanksgiving");
    out[at] = {
      ...out[at],
      note: `Day off in ${listOf(regions)}${called.length ? `. Called ${listOf(called)}` : ""}`,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Library "optional" days: who has them off, or that no one does.

/** Brazil's Carnival: the weekend before the Monday and Tuesday off, and Ash Wednesday's morning. */
function brazilCarnival(year) {
  const sunday = easter(year);
  return [
    entry(addDays(sunday, -50), "Carnival", "observance", "The Carnival weekend. Banks and many offices close on Monday and Tuesday"),
    entry(addDays(sunday, -49), "Carnival", "observance", "The Carnival weekend. Banks and many offices close on Monday and Tuesday"),
    entry(
      addDays(sunday, -46),
      "Carnival",
      "optional",
      "Ash Wednesday, the end of Carnival. Federal offices open at 2 pm, and many businesses open late",
    ),
  ];
}

/**
 * Hungary's Christmas Eve: not in the Labour Code's list of holidays (Mt.
 * 102. §) yet, though a bill to add it (T/13464, September 2026) has every
 * party's support. In 2026 the government's working-day decree makes it a
 * rest day, worked on Saturday 12 December.
 */
function hungaryChristmasEve(year) {
  const shops = "Shops must close by 2 pm";
  // The bill is named only for 2026 and 2027, in words that stay true once
  // it is decided. Revisit every year when T/13464 passes or fails.
  const notes = {
    2026: `A day off for most workers, made up by working on Saturday 12 December. Parliament is debating a bill to make it a public holiday. ${shops}`,
    2027: `Not a public holiday yet: many employers give the day off. A bill to make it one was before Parliament in 2026. ${shops}`,
  };
  const note = notes[year] ?? `Not a public holiday: many employers give the day off. ${shops}`;
  return [entry(ymd(year, 12, 24), "Christmas Eve", "optional", note)];
}

/** Sweden's All Saints' Eve: the Friday from 30 October to 5 November. */
function swedenAllSaintsEve(year) {
  let date = ymd(year, 10, 30);
  while (weekday(date) !== 5) date = addDays(date, 1);
  return date;
}

const OLSOK = "St Olav's Day (Olsok)";

// ---------------------------------------------------------------------------
// The list.

const LIBRARY_FIXES = [
  {
    country: "ID",
    source: ID_SOURCE,
    finish: indonesiaFinish,
    entries: indonesiaEntries,
  },
  {
    country: "MY",
    source: "Holidays Act 1951 (Act 369), s.3, https://lom.agc.gov.my/act-detail.php?act=369",
    finish: malaysiaSundaySubstitutes,
    entries: () => [],
  },
  {
    country: "US",
    source:
      "State holiday laws: Nevada (NRS 236.015, Family Day), West Virginia (Code §2-2-1), Indiana (IC 1-1-9-1), Maryland and Georgia, https://www.leg.state.nv.us/nrs/nrs-236.html",
    finish: usDayAfterThanksgiving,
    entries: () => [],
  },
  {
    country: "NL",
    source: "Rijksoverheid, Bevrijdingsdag (5 mei) vrije dag, https://www.rijksoverheid.nl/onderwerpen/bevrijdingsdag/vraag-en-antwoord/bevrijdingsdag-5-mei-vrije-dag",
    entries: (year) => [
      entry(
        ymd(year, 5, 5),
        "Liberation Day",
        "optional",
        "Day off for many government and education workers; for others only if their collective agreement grants it, often only every fifth year. Liberation festivals with free music in about 14 cities",
      ),
    ],
  },
  {
    country: "BR",
    source:
      "Ministério da Gestão e da Inovação, yearly portaria of national holidays and pontos facultativos, https://www.gov.br/gestao/",
    entries: brazilCarnival,
  },
  {
    country: "GT",
    source: "Ministerio de Trabajo, Inspección General de Trabajo: Father's Day is not a paid holiday, https://www.mintrabajo.gob.gt/",
    entries: (year) => [
      entry(ymd(year, 6, 17), "Father's Day", "observance", "Not a day off by law, though some employers give working fathers the day off"),
    ],
  },
  {
    country: "HU",
    source: "Munka Törvénykönyve, 102. §, and the Országgyűlés bill T/13464 (2026), https://www.parlament.hu/irom42/13464/13464.pdf",
    entries: hungaryChristmasEve,
  },
  {
    country: "NO",
    source: "Lov om helligdager og helligdagsfred: 29 July is a flag day, not a public holiday, https://lovdata.no/",
    entries: (year) => [
      entry(ymd(year, 7, 29), OLSOK, "observance", "A flag day, not a day off. Trondheim holds its St Olav Festival around it"),
    ],
  },
  {
    country: "SJ",
    source: "Lov om helligdager og helligdagsfred: 29 July is a flag day, not a public holiday, https://lovdata.no/",
    entries: (year) => [entry(ymd(year, 7, 29), OLSOK, "observance", "A flag day, not a day off")],
  },
  {
    country: "SE",
    source:
      "Swedish collective agreements, as published by employers such as Uppsala University, https://www.uu.se/medarbetare/anstallning/anstallningsvillkor/arbetstid/roda-dagar-och-klamdagar",
    entries: (year) => [
      entry(ymd(year, 1, 5), "Twelfth Night", "observance", "Not a day off, but many workplaces close early"),
      entry(
        ymd(year, 4, 30),
        "Walpurgis Night",
        "observance",
        "Not a day off, but many workplaces close early. Bonfires and spring songs in the evening",
      ),
      // Four hours shorter at Uppsala and Örebro universities, not a day off.
      entry(
        swedenAllSaintsEve(year),
        "All Saints' Eve",
        "observance",
        "Not a day off, but many workplaces, government offices among them, close at midday. Shops stay open",
      ),
    ],
  },
  {
    country: "SM",
    source: "Legge 152 of 1990 on the calendar of holidays, https://www.consigliograndeegenerale.sm/",
    entries: (year) => [entry(ymd(year, 12, 31), "New Year's Eve", "observance", "A working day: not a holiday since 1990")],
  },
  {
    country: "PH",
    source: "Office of the President, yearly proclamations of regular holidays and special days, https://www.officialgazette.gov.ph/",
    entries: (year) => [
      entry(easter(year), "Easter Sunday", "observance", "Not in the year's holiday proclamation. A Sunday, so no working day is lost"),
    ],
  },
  {
    country: "DK",
    source: "Danish closing-hours act (lukkeloven) and the banks' holiday calendar, https://www.retsinformation.dk/",
    entries: (year) => [
      entry(ymd(year, 6, 5), "Constitution Day", "bank", "Not a public holiday, but banks close and shops must close early by law. Many workplaces give the afternoon off"),
      entry(ymd(year, 12, 24), "Christmas Eve", "bank", "Not a public holiday, but banks and most offices close, and shops must close early by law"),
    ],
  },
  {
    country: "FO",
    source: "Faroese collective agreements, as summarised by date-holidays, https://github.com/commenthol/date-holidays",
    entries: (year) => [
      entry(ymd(year, 7, 28), "St Olav's Eve", "optional", "An afternoon off for many workers under union agreements. Ólavsøka, the national festival, starts in Tórshavn"),
      entry(ymd(year, 7, 29), "St Olav's Day", "optional", "A day off for most workers under union agreements. The height of the Ólavsøka festival in Tórshavn"),
    ],
  },
  {
    country: "PL",
    source: "Act of 20 February 2004 establishing Flag Day, https://isap.sejm.gov.pl/",
    entries: (year) => [
      entry(ymd(year, 5, 2), "Flag Day", "observance", "Not a day off. Many people take leave to bridge 1 and 3 May"),
    ],
  },
  {
    country: "VA",
    source: "Holy See, holidays of Vatican City State, https://www.vatican.va/",
    entries: (year) => [
      entry(
        ymd(year, 5, 8),
        "Anniversary of the election of Pope Leo XIV",
        "public",
        "For the current pope, Leo XIV, elected on 8 May 2025. A new pope brings his own day",
      ),
      entry(
        ymd(year, 9, 17),
        "Saint Robert Bellarmine - Name day of the Holy Father",
        "public",
        "Name day of the current pope, Leo XIV (Robert Francis Prevost). A new pope brings his own day",
      ),
    ],
  },
];

export default LIBRARY_FIXES;
