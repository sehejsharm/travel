/**
 * Builds the holiday calendar the app ships: one JSON file per country in
 * src/lib/reference/holiday-data/, 2026 to 2050, plus the index.ts that loads
 * each one on demand.
 *
 * The base is date-holidays (https://github.com/commenthol/date-holidays):
 * every country it knows, in English, with school holidays dropped. Each
 * country also gets the days its states or regions take off (date-holidays'
 * per-state lists), as "optional" with a note naming where, and, where the
 * state lists are reliable for it, a note on a national day off that some
 * states do not keep (STATE_GAPS). Four things are corrected on the way
 * through:
 *
 * - a few library rules that disagree with the law (RULE_FIXES below);
 * - the Chinese, Korean and Vietnamese lunisolar calendars, which are
 *   recomputed astronomically: wherever date-holidays' calendar puts a month
 *   on another day, the rules in that month are evaluated again on the right
 *   one (see "The lunisolar calendars");
 * - two names for one holiday on one day (NAME_ALIASES);
 * - names with no English translation, or a wrong one (ENGLISH_NAMES).
 *
 * On top of that go the supplement modules in scripts/holiday-supplements/*.mjs
 * (see the README there): festivals and corrections the library does not
 * carry. A supplement can drop library entries, a supplement entry naming
 * the same holiday on the same date as a library one replaces it, and a
 * supplement's `finish` can rework the country's merged calendar.
 *
 * The output is deterministic: the same library version and supplements give
 * byte-identical files, whatever the machine's time zone or locale.
 *
 *   node scripts/build-holidays.mjs            write the files, print coverage
 *   node scripts/build-holidays.mjs --check    exit 1 if the files are stale
 *
 * Options: --out <dir> writes somewhere else, --supplements <dir> reads
 * supplements from somewhere else.
 */
import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Holidays from "date-holidays";
// astronomia is date-holidays' own astronomy library (it computes the same
// calendars with it), so it is always installed alongside.
import deltat from "astronomia/deltat";
import moonphase from "astronomia/moonphase";
import planetposition from "astronomia/planetposition";
import solar from "astronomia/solar";
import vsop87Bearth from "astronomia/data/vsop87Bearth";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "src/lib/reference/holiday-data");
const DEFAULT_SUPPLEMENTS = path.join(ROOT, "scripts/holiday-supplements");

export const FROM = 2026;
export const TO = 2050;

/** Strongest first. Also the order entries on one date are listed in. */
export const KINDS = ["public", "bank", "optional", "observance", "festival"];
const KIND_RANK = Object.fromEntries(KINDS.map((kind, index) => [kind, index]));

/** What date-holidays calls a type, kept as is. "school" is dropped. */
const LIBRARY_KINDS = new Set(["public", "bank", "optional", "observance"]);
const DAY_OFF = new Set(["public", "bank"]);

/**
 * Countries whose state calendars in date-holidays say where a national day
 * off is not kept (Malaysia's Nuzul Al-Quran, Easter Monday in Scotland). A
 * national day off that some regions lack (with no day off that date, and
 * not the same holiday moved a few days) gets "Not a day off in ..."; one
 * that more than a third of them lack becomes "optional". Elsewhere the state
 * lists are not reliable for this (federal days in the United States close
 * federal offices and banks in every state; Brazil's state lists predate the
 * national Black Awareness Day), so they are left alone.
 */
const STATE_GAPS = new Set(["AU", "CH", "GB", "MY", "SH"]);

const OPTIONS = { languages: ["en"] };

/**
 * Library names shown as the app shows them, per country: names with no
 * English translation (date-holidays falls back to the country's own
 * language for those), and English names the library has wrong (typos,
 * mistranslations, a sovereign who has changed). A name is looked up without
 * the library's " (substitute day)" suffix, so its substitute days follow.
 * Any untranslated library name that turns up after a library upgrade is
 * listed in the coverage summary. Already-English names the library gives no
 * "en" key map to themselves.
 */
const ENGLISH_NAMES = {
  AI: {
    "Celebration of the Birthday of Her Majesty the Queen": "Celebration of the Birthday of His Majesty the King",
  },
  AL: { "League of Lezhë day": "League of Lezhë Day" },
  AM: { "St. Vartan the good work and the duty days": "St Vartan's Day" },
  AT: {
    Florian: "St Florian's Day",
    "Leopoldi-Tag": "St Leopold's Day",
    Martinstag: "St Martin's Day",
    Rupert: "St Rupert's Day",
    Staatsfeiertag: "Labour Day",
    "Tag der Volksabstimmung": "Plebiscite Day",
  },
  AU: { "Easter Tuesday": "Easter Tuesday", "King's Birthday": "King's Birthday", "Proclamation Day": "Proclamation Day" },
  BJ: { "Fête du Vodoun": "Vodun Festival" },
  BO: { "Andean Amazonic Chacoan New Year": "Andean Amazonian Chaqueño New Year" },
  BR: {
    "Adesão do Grão-Pará à independência do Brasil": "Pará's Accession to Independence",
    "Adesão do Maranhão à independência do Brasil": "Maranhão's Accession to Independence",
    "Alusivo ao Dia Internacional da Mulher": "International Women's Day",
    "Assinatura do Tratado de Petrópolis": "Treaty of Petrópolis Day",
    Carnaval: "Carnival",
    "Dia do Comércio": "Commerce Day",
    "Fundação de Brasília": "Founding of Brasília",
    "Morte de Zumbi dos Palmares": "Black Awareness Day",
    "Aniversário do estado": "State Anniversary",
    "Autonomia do Estado": "State Autonomy Day",
    "Criação do Território Federal": "Creation of the Federal Territory",
    "Criação do estado": "State Creation Day",
    "Data magna do estado": "State Day",
    "Dia da Amazônia": "Amazon Day",
    "Dia de Nossa Senhora da Penha": "Our Lady of Penha",
    "Dia de Santa Catarina": "Santa Catarina Day",
    "Dia de Santa Catarina de Alexandria": "St Catherine of Alexandria",
    "Dia de São Jorge": "St George's Day",
    "Dia de São José": "St Joseph's Day",
    "Dia do Evangélico": "Evangelicals' Day",
    "Dia do evangélico": "Evangelicals' Day",
    "Dia do Piauí": "Piauí Day",
    "Elevação do Amazonas à categoria de província": "Amazonas Province Day",
    "Emancipação política": "Political Emancipation Day",
    "Emancipação política de Sergipe": "Sergipe Emancipation Day",
    "Emancipação política do estado do Paraná": "Paraná Emancipation Day",
    "Fundação da Cidade de Goiás": "Founding of the City of Goiás",
    "Homenagem à memória do ex-presidente João Pessoa": "João Pessoa Memorial Day",
    "Independência da Bahia": "Bahia Independence Day",
    "Lançamento da pedra fundamental de Goiânia": "Goiânia Foundation Day",
    "Mártires de Cunhaú e Uruaçu": "Martyrs of Cunhaú and Uruaçu",
    "Nossa Senhora da Natividade": "Our Lady of the Nativity",
    "Nossa Senhora das Neves": "Our Lady of the Snows",
    "Proclamação da República Rio-Grandense": "Gaúcho Day (Riograndense Republic)",
    "Revolução Constitucionalista": "Constitutionalist Revolution Day",
    "Revolução Pernambucana de 1817": "Pernambuco Revolution of 1817",
    "São João": "St John's Day",
    "São Pedro": "St Peter's Day",
  },
  CG: {
    "Fête de la commémoration de la conférence nationale souveraine": "Sovereign National Conference Day",
    "Journée nationale de la République": "Republic Day",
  },
  CH: {
    "2 Janvier": "Berchtold's Day",
    Berchtoldstag: "Berchtold's Day",
    "Saint-Berthold": "Berchtold's Day",
    Bundesfeiertag: "Swiss National Day",
    "Fête des pères": "Father's Day",
    "Fête nationale": "Swiss National Day",
    "Giorno festivo federale": "Swiss National Day",
    Knabenschiessen: "Knabenschiessen (Zurich shooting festival)",
    "Instauration de la République": "Republic Day",
    "Jeûne Genevois": "Geneva Fast",
    Mauritiustag: "St Maurice's Day",
    "Näfelser Fahrt": "Näfels Pilgrimage",
    Vätertag: "Father's Day",
  },
  CK: { "Queen's Birthday": "King's Birthday" },
  CL: { "Día adicional": "Additional holiday" },
  CR: { "Gesta Heroica de Juan Santamaría": "Juan Santamaría Day" },
  DE: {
    "1. Advent": "First Sunday of Advent",
    "2. Advent": "Second Sunday of Advent",
    "3. Advent": "Third Sunday of Advent",
    "4. Advent": "Fourth Sunday of Advent",
    Totensonntag: "Sunday of the Dead",
  },
  DK: { Fastelavn: "Shrovetide (Fastelavn)" },
  ES: {
    "Dia de Cataluña": "Catalonia Day",
    "Día Nacional de Galicia": "Galicia Day",
    "Día de Andalucía": "Andalusia Day",
    "Día de Aragón": "Aragon Day",
    "Día de Asturias": "Asturias Day",
    "Día de Castilla-La Mancha": "Castilla-La Mancha Day",
    "Día de Ceuta": "Ceuta Day",
    "Día de Extremadura": "Extremadura Day",
    "Día de La Rioja": "La Rioja Day",
    "Día de la Comunidad de Madrid": "Madrid Day",
    "Día de la Constitución Española": "Constitution Day",
    "Día de las Instituciones de Cantabria": "Cantabria Institutions Day",
    "Día de las Letras Gallegas": "Galician Literature Day",
    "Día de les Illes Balears": "Balearic Islands Day",
    "Fiesta Nacional de España": "National Day of Spain",
    "Fiesta de Castilla y León": "Castile and León Day",
    "La Bien Aparecida": "Our Lady of Bien Aparecida",
    "Nuestra Señora de África": "Our Lady of Africa",
    "Nuestra Señora de la Almudena": "Our Lady of la Almudena",
    "San Isidro Labrador": "St Isidore's Day",
    "Sant Esteve": "St Stephen's Day",
    "San Esteban": "St Stephen's Day",
    "San Juan": "St John's Day",
    "Santiago Apóstol": "St James's Day",
  },
  FO: { "St.Olav's Day": "St Olav's Day", "St.Olav's Eve": "St Olav's Eve" },
  GI: { "Queen's Birthday": "King's Birthday" },
  GT: { "Day of Race": "Columbus Day (Día de la Raza)" },
  GW: { "Pidjiguiti Day": "Pidjiguiti Day" },
  HN: { "Día de las Américas": "Day of the Americas", "Armed forces Day": "Armed Forces Day" },
  IC: {
    "Día de la Constitución Española": "Constitution Day",
    "Fiesta Nacional de España": "National Day of Spain",
    "La Bajada de la Virgen del Socorro": "Descent of the Virgin of Socorro",
    "Nuestra Señora de Guadalupe": "Our Lady of Guadalupe",
    "Nuestra Señora de la Peña": "Our Lady of la Peña",
    "Nuestra Señora de las Nieves": "Our Lady of the Snows",
    "Nuestra Señora de los Dolores": "Our Lady of Sorrows",
    "Nuestra Señora de los Reyes": "Our Lady of the Kings",
    "Nuestra Señora del Pino": "Our Lady of the Pine",
  },
  IR: {
    "Holyday for Fetr Eeid": "Eid al-Fitr (second day)",
    "Birthday of Muhammad Prophet": "Birthday of the Prophet Muhammad",
    "Mabaas of Muhammad": "Mab'ath (the Prophet's mission)",
  },
  IS: { Bolludagur: "Bun Day", Bóndadagur: "Husbands' Day", Sprengidagur: "Shrove Tuesday (Bursting Day)" },
  LI: { "Feiertagsbrücke": "Bridge day", "Mariä Geburt": "Nativity of Mary", Staatsfeiertag: "National Day" },
  LR: { "J. J. Robert's Day": "J. J. Roberts' Day" },
  LV: { "Restoration of Independence day": "Restoration of Independence Day" },
  ML: { "Jour de l'Afrique": "Africa Day" },
  MS: { "Queen's Birthday Celebration": "King's Birthday Celebration" },
  NA: { "Public Holiday": "Public Holiday" },
  NC: { "Jour de l'an": "New Year's Day" },
  NO: { "Midsummar Eve": "Midsummer Eve" },
  PA: { "Primer Grito de Independencia": "First Cry of Independence", "Separation Day (from Columbia)": "Separation Day (from Colombia)" },
  PL: { "Greater Poland Uprising Remebrence Day": "Greater Poland Uprising Remembrance Day" },
  PT: { "Implantação da República": "Republic Day", "Restauração da Independência": "Restoration of Independence Day" },
  SE: { Vasaloppet: "Vasaloppet ski race" },
  SJ: { "Midsummar Eve": "Midsummer Eve" },
  SK: { "Day of victory over fascism": "Day of Victory over Fascism" },
  SM: { "Cerimonia di investitura dei Capitani Reggenti": "Investiture of the Captains Regent" },
  SN: { "Magal de Touba": "Grand Magal of Touba" },
  SV: {
    "Celebración del Divino Salvador del Mundo": "Feast of the Divine Saviour of the World",
    "Día de la Mujer": "Women's Day",
    "Día del Maestro": "Teachers' Day",
    "Fiestas Agostinas": "August Festivals",
    "Firma de los Acuerdos de Paz": "Peace Accords Day",
  },
  TC: { "Queen's Birthday": "King's Birthday" },
  TN: {
    "عيد الثورة و الشباب": "Revolution and Youth Day",
    "عيد الإستقلال": "Independence Day",
    "عيد الشهداء": "Martyrs' Day",
    "عيد الجمهورية": "Republic Day",
    "عيد المرأة": "Women's Day",
    "عيد الجلاء": "Evacuation Day",
  },
  TW: { "Journalist' Day": "Journalists' Day" },
  US: { "Election Day": "Election Day" },
  VE: {
    "Día de La Divina Pastora": "Divina Pastora Day",
    "Día de Maturin": "Maturín Day",
    "Día de la Virgen de la Chinita": "Virgin of Chiquinquirá (La Chinita)",
    "Día de la Virgen del Socorro": "Virgin of Socorro Day",
    "Natalicio de Jacinto Lara": "Birth of Jacinto Lara",
    "Natalicio de José Antonio Anzoátegui": "Birth of José Antonio Anzoátegui",
    "Natalicio de Rafael Urdaneta": "Birth of Rafael Urdaneta",
  },
  VN: { "Day of liberating the South for national reunification": "Reunification Day" },
  VU: {
    "Fête de Famille": "Family Day",
    "Fête des chefs coutumiers": "Custom Chiefs' Day",
    "Jour de l'Unité": "Unity Day",
    "Journée Mondiale des Enfants": "Children's Day",
    "Mémoire du père de l'indépendance Rév. Dr. W.H. Lini": "Father Lini Day",
  },
};

/** The suffix date-holidays gives a substitute day, in its forms. */
const SUBSTITUTE_SUFFIX = / \((?:substitute day|substitutes)\)$/;

/**
 * One holiday under two library names, which put two entries on one day (a
 * national rule and a state's, or two rules for one span). Each alias becomes
 * the name it maps to before entries are matched, so the two merge and a
 * state's day off joins the others in one "Day off in ..." note. Matched as
 * names are (ignoring case, accents and punctuation).
 */
export const NAME_ALIASES = {
  RU: {
    // Radonitsa, the Tuesday after Orthodox Easter week, under each region's name.
    "Day of Special Remembrance of the Departed (Radonitsa)": "Day of Remembrance of the Departed (Radonitsa)",
    "Radonitsa - Day of Remembrance of the Departed": "Day of Remembrance of the Departed (Radonitsa)",
    "Radonitsa - Day of Special Remembrance of the Departed": "Day of Remembrance of the Departed (Radonitsa)",
    "Unified Day of Remembrance of the Departed": "Day of Remembrance of the Departed (Radonitsa)",
    // Irkutsk's (Единый день поминовения, the common day of remembrance).
    "Unity Day of Remembrance": "Day of Remembrance of the Departed (Radonitsa)",
    // Ingushetia's names for the two Eids, against every other republic's.
    "Eid al-Fitr (Markhash)": "Uraza-Bayram",
    "Eid al-Adha (Ghurba)": "Kurban-Bayram",
  },
  US: {
    // The federal observance and California's name, against every other state's.
    "Day after Thanksgiving Day": "Day After Thanksgiving",
    // Hawaii's name for the general election day the other states take off.
    "General Election Day": "Election Day",
  },
  VN: {
    // The five days of Tết, which the library lists under a second name.
    "Vietnamese New Year Holidays": "Vietnamese New Year",
  },
};

/** Notes added to library holidays: an estimate of a yearly decision, or context a traveller needs. */
const LIBRARY_NOTES = {
  RU: {
    "Day of the Reunification of Crimea with Russia":
      "Russia's name for the day. The annexation is not recognised by Ukraine or the UN General Assembly (Resolution 68/262)",
    "Day of Sevastopol's Return to Russia":
      "Russia's name for the day. The annexation is not recognised by Ukraine or the UN General Assembly (Resolution 68/262)",
  },
  VN: {
    "Vietnamese New Year":
      "Five days off for Tết. The government sets the exact days each year, so they can move by a day or two",
  },
};

/**
 * Library rules that disagree with the law, replaced before any date is
 * computed. Each `remove` must exist in the library (a library upgrade that
 * renames one stops the build, so the fix is looked at again). An `add` rule
 * is in date-holidays' own grammar; `opts` "from" copies the options (names,
 * type) of a removed rule.
 */
export const RULE_FIXES = {
  CN: {
    why: "全国年节及纪念日放假办法 as amended in 2024 (State Council Decree 795): from 2025 the Spring Festival is New Year's Eve and days 1 to 3 (4 days), and Labour Day is 1 and 2 May",
    remove: [],
    add: {
      "chinese 01-0-03 since 2025": { name: { en: "Spring Festival", zh: "春节" }, type: "public" },
      "05-02 since 2025": { name: { en: "Labour Day", zh: "劳动节" }, type: "public" },
    },
  },
  KE: {
    why: "Public Holidays Act (Cap. 110) as amended by the Statute Law (Miscellaneous Amendments) Act 2024: 10 October is Mazingira Day (formerly Moi Day, then Utamaduni Day)",
    remove: ["10-10 and if sunday then next monday"],
    add: {
      "10-10 and if sunday then next monday": {
        name: { en: "Mazingira Day", sw: "Siku ya Mazingira" },
        type: "public",
        substitute: true,
        note: "Environment day: Kenyans are asked to plant trees and join clean-ups",
      },
    },
  },
  KR: {
    why: "Regulations on Holidays of Government Offices, art. 2: Seollal is the day before, the day and the day after (date-holidays issue #640). The library's span starts on the day itself",
    remove: ["korean 01-0-01 P3D"],
    add: { "1 day before korean 01-0-01 P3D": { from: "korean 01-0-01 P3D" } },
  },
  KZ: {
    why: "Labour Code of Kazakhstan: a day off that falls on a holiday moves to the next working day after the holiday. Nauryz is 21 to 23 March, so a substitute for 21 or 22 March cannot land on 22 or 23 March, as the library's does (2026: 24 and 25 March off; 2027: 24 March)",
    remove: [
      "03-21 and if saturday then next monday if sunday then next tuesday",
      "03-22 and if saturday then next monday if sunday then next tuesday",
    ],
    add: {
      "03-21 and if saturday then next tuesday if sunday then next wednesday": {
        from: "03-21 and if saturday then next monday if sunday then next tuesday",
      },
      "03-22 and if saturday then next monday if sunday then next wednesday": {
        from: "03-22 and if saturday then next monday if sunday then next tuesday",
      },
    },
  },
  NG: {
    why: "Public Holidays Act (Cap. P40) and the Ministry of Interior's yearly notices: Children's Day closes schools only (the library nests its type: school under the name, so it reads as public), National Youth Day (since 2020) is not a work-free day, and 1 Muharram is a day off only in states that declare it",
    remove: ["05-27", "11-01 since 2020", "1 Muharram"],
    add: {
      "05-27": { name: { en: "Children's Day" }, type: "observance", note: "Schools close; offices and shops are open" },
      "11-01 since 2020": { name: { en: "National Youth Day" }, type: "observance", note: "Not a day off" },
      "1 Muharram": {
        name: { en: "Islamic New Year" },
        type: "optional",
        note: "A day off only in states that declare it, such as Sokoto, Kano, Katsina, Kebbi, Niger and Borno",
      },
    },
  },
  SH: {
    why: "The Queen's Birthday (third Monday of April) ended with Elizabeth II. St Helena now keeps the King's Birthday in November: Friday 15 November 2024, Friday 14 November 2025 and Friday 13 November 2026, the Friday nearest 14 November",
    remove: ["3rd monday in April"],
    add: {
      "friday after 11-10": {
        name: { en: "King's Birthday" },
        type: "public",
        note: "Estimated: the government sets the day each year. 2024 to 2026 were the Friday nearest the King's birthday, 14 November",
      },
    },
  },
  TW: {
    why: "紀念日及節日實施條例 as amended in 2025: from 2026 the Lunar New Year holiday is the day before New Year's Eve, the Eve and days 1 to 3. One of those on a Saturday or Sunday is made up on a working day, which the DGPA put after the holiday in 2026 and 2027. The library's 'fourth day' every year, and its weekday rule, are not in the law",
    remove: [
      "chinese 01-0-04",
      "chinese 01-0-01 if Monday then next Friday if Tuesday then next Saturdayif Wednesday then next Sunday if Thursday then next Monday if Friday then next Tuesday if Saturday then next Wednesday if Sunday then next Thursday",
    ],
    add: {
      "2 days before chinese 01-0-01 since 2026": {
        name: { en: "Day before Chinese New Year's Eve", zh: "除夕前一日" },
        type: "public",
      },
      // Five days from day 1 - 2 to day 1 + 2. Day 1 on a Monday puts the
      // Saturday and Sunday before it in the span, so two working days after
      // it are made up: Thursday and Friday. And so on for each weekday.
      "substitutes chinese 01-0-01 if Monday then next Thursday if Tuesday then next Friday if Thursday then next Monday if Friday then next Monday if Saturday then next Tuesday if Sunday then next Wednesday since 2026":
        {
          name: { en: "Chinese New Year", zh: "農曆新年補假" },
          type: "public",
          substitute: true,
          note: "Makes up for a New Year day on a weekend. The government can set it a working day earlier instead",
        },
      "substitutes chinese 01-0-01 if Monday then next Friday if Friday then next Tuesday if Saturday then next Wednesday if Sunday then next Thursday since 2026":
        {
          name: { en: "Chinese New Year", zh: "農曆新年補假" },
          type: "public",
          substitute: true,
          note: "Makes up for a New Year day on a weekend. The government can set it a working day earlier instead",
        },
    },
  },
};

/** Typos in the library's notes, fixed on the way through. */
const NOTE_FIXES = [
  [/\bGoverment\b/g, "Government"],
  [/\bindusty\b/g, "industry"],
  [/\bBirtday\b/g, "Birthday"],
  [/\bthe the\b/g, "the"],
  [/\bCalender\b/g, "Calendar"],
  [/\bby statue\b/g, "by statute"],
  [/\bDayoff\b/g, "Day off"],
  [/^Formation\/Liberation day$/g, "The state's formation day"],
];

/**
 * Notes with which the library marks a "public" day as off for one group only
 * (women, Muslims, the armed forces). That is "optional" in this app's terms:
 * shops and offices stay open for everyone else.
 */
const GROUP_ONLY = /^(?:Women|Only for women|Youth from|Children below|Military personnel|For Muslim|For all persons belonging|Orthodox)\b/;

/**
 * Regions shown under another name. The library names Crimea and Sevastopol
 * as Russian regions; the UN General Assembly does not recognise the
 * annexation (Resolution 68/262), so the notes say who controls them.
 */
const REGION_NAMES = {
  RU: { CR: "Crimea (Russian-occupied)", SEV: "Sevastopol (Russian-occupied)" },
};

/** Prefixes that only make a region's name longer. */
const REGION_PREFIXES = [/^Département et région d'outre-mer /, /^Département /];

/** Hijri months, as date-holidays writes them in its rules. */
const LUNAR_ISLAMIC = /\b(?:Muharram|Safar|Rabi al-|Jumada al-|Rajab|Shaban|Ramadan|Shawwal|Dhu al-)/;
const MOON_NOTE = "Islamic lunar date, estimated: the official date can differ by a day";

// ---------------------------------------------------------------------------
// Pure helpers, exported for the tests.

/** The identity two entries share when they name the same holiday. */
export function nameKey(name) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`′]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function entryKey(entry) {
  return `${entry.date}|${nameKey(entry.name)}`;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareEntries(a, b) {
  return (
    compareText(a.date, b.date) ||
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    compareText(a.name, b.name) ||
    compareText(a.note ?? "", b.note ?? "")
  );
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another. */
function daysBetween(from, to) {
  const ms = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

function inRange(date, from, to) {
  return date >= `${from}-01-01` && date <= `${to}-12-31`;
}

function joinNotes(...notes) {
  return notes
    .map((note) => note.replace(/[.;\s]+$/, ""))
    .filter(Boolean)
    .join(". ");
}

function listOf(names) {
  const sorted = [...new Set(names)].sort(compareText);
  return sorted.length <= 1
    ? sorted.join("")
    : `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

const pad = (n) => String(n).padStart(2, "0");

/** name key → canonical name, per country. */
const ALIAS_KEYS = Object.fromEntries(
  Object.entries(NAME_ALIASES).map(([country, aliases]) => [
    country,
    new Map(Object.entries(aliases).map(([alias, name]) => [nameKey(alias), name])),
  ]),
);

/** A library name without its substitute-day suffix, and whether it had one. */
function splitSubstitute(name) {
  const tidy = name.replace(/\s+/g, " ").trim();
  const base = tidy.replace(SUBSTITUTE_SUFFIX, "");
  return { base, substitute: base !== tidy };
}

/**
 * A library name as the app shows it: in English, tidied, aliases resolved,
 * and a substitute day always "<name> (substitute day)".
 */
export function cleanName(country, name) {
  const { base, substitute } = splitSubstitute(name);
  const english = (ENGLISH_NAMES[country]?.[base] ?? base).replace(/′/g, "’").replace(/\s+/g, " ").trim();
  const full = substitute ? `${english} (substitute day)` : english;
  return ALIAS_KEYS[country]?.get(nameKey(full)) ?? full;
}

/** Every library name that cleans to this one: itself and its aliases. */
function libraryNames(country, name) {
  const aliases = Object.entries(NAME_ALIASES[country] ?? {})
    .filter(([, canonical]) => nameKey(canonical) === nameKey(name))
    .map(([alias]) => alias);
  return [name, ...aliases];
}

function cleanRegion(name, code, country) {
  const renamed = REGION_NAMES[country]?.[code];
  if (renamed) return renamed;
  let text = (name ?? "").replace(/\s+/g, " ").trim();
  for (const prefix of REGION_PREFIXES) text = text.replace(prefix, "");
  return text || code;
}

function cleanNote(note) {
  if (!note) return "";
  let text = note.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of NOTE_FIXES) text = text.replace(pattern, replacement);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// The lunisolar calendars.
//
// date-holidays computes the Chinese calendar (and the Korean and Vietnamese
// ones: the same rules, kept at UTC+9 and UTC+7) with two faults in the years
// this app covers:
//
// - its leap-month rule goes wrong in 2033: it puts that year's leap month
//   after month 7, where the official calendars put it after month 11, so
//   months 8 to 11 of 2033 start a month late;
// - its day count slips: in about one month a year, every day from some point
//   in the month on comes out a day early (the 15th on the 14th's date), a
//   rounding fault in converting the date there and back.
//
// So the calendar is computed again here, the way GB/T 33661-2017 defines it:
//
// - a day runs from midnight to midnight at the calendar's UTC offset;
// - a month starts on the day of a new moon, and its nth day is n - 1 days on;
// - the month holding the winter solstice is month 11;
// - when 13 months start between one month 11 and the next, the first of them
//   without a principal solar term (the sun's longitude a multiple of 30°) is
//   a leap month, numbered as the month before it;
// - the others are numbered in order; the month with the sun at 330° is 1.
//
// New moons come from Meeus' algorithm (astronomia's moonphase, good to a few
// seconds), the sun's longitude from VSOP87, and ΔT from astronomia's table.
// Then every library rule naming a lunar day is checked in every lunar year:
// where date-holidays' rule engine gives another date than the true calendar,
// the rule is evaluated again, in a scratch calendar, with the lunar date
// date-holidays needs to land on the true day, so its clauses ("not on
// Sunday", "if Sunday then next Monday", "P3D") apply to the right day.

/** UTC offset, in hours, each date-holidays lunisolar calendar keeps its days in. */
export const LUNISOLAR_ZONES = { chinese: 8, korean: 9, vietnamese: 7 };

const EARTH = new planetposition.Planet(vsop87Bearth);
const J2000 = 2451545;
const UNIX_EPOCH_JDN = 2440588;
const TROPICAL_YEAR = 365.2422;
/** The years the calendars are computed for: the app's, and a margin either side. */
const LUNAR_FROM = FROM - 3;
const LUNAR_TO = TO + 3;

/** A moment in Terrestrial Time (a JDE) as a date at a UTC offset, and how far into it. */
function zoneDate(jde, zone) {
  const jd = jde - deltat.deltaT(2000 + (jde - J2000) / 365.25) / 86400;
  const local = jd + 0.5 + zone / 24;
  const day = Math.floor(local);
  return {
    date: new Date((day - UNIX_EPOCH_JDN) * 86_400_000).toISOString().slice(0, 10),
    minutes: (local - day) * 1440,
  };
}

/** When the sun's apparent longitude reaches `degrees`, starting near `guess`. */
function solarTermJde(degrees, guess) {
  const target = (degrees * Math.PI) / 180;
  let jde = guess;
  for (let i = 0; i < 30; i++) {
    const { lon } = solar.apparentVSOP87(EARTH, jde);
    const diff = ((((target - lon + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    jde += (diff * TROPICAL_YEAR) / (2 * Math.PI);
    if (Math.abs(diff) < 1e-9) break;
  }
  return jde;
}

const trueMonthsCache = new Map();

/**
 * The months of one lunisolar calendar ("chinese", "korean" or "vietnamese")
 * from about 2023 to 2053, in order: { lunarYear, month, leap, start, end }
 * with `end` the next month's start, plus the minutes past local midnight of
 * its new moon and of its principal terms (how close a call each one is).
 * `lunarYear` is the Gregorian year its month 1 starts in.
 */
export function lunisolarMonths(kind) {
  const cached = trueMonthsCache.get(kind);
  if (cached) return cached;
  const zone = LUNISOLAR_ZONES[kind];
  if (zone === undefined) throw new Error(`No lunisolar calendar called ${kind}`);

  // A year either side, so the first and last winter solstices are covered.
  const moons = [];
  for (let k = Math.floor((LUNAR_FROM - 1 - 2000) * 12.3685); k <= Math.ceil((LUNAR_TO + 2 - 2000) * 12.3685); k++) {
    moons.push(zoneDate(moonphase.newMoon(2000 + (k + 0.1) / 12.3685), zone));
  }
  const terms = [];
  for (let year = LUNAR_FROM - 2; year <= LUNAR_TO + 2; year++) {
    for (let degrees = 0; degrees < 360; degrees += 30) {
      const guess = J2000 + (year - 2000) * TROPICAL_YEAR + 79.3 + (degrees / 360) * TROPICAL_YEAR;
      terms.push({ degrees, ...zoneDate(solarTermJde(degrees, guess), zone) });
    }
  }

  const months = [];
  for (let i = 0; i + 1 < moons.length; i++) {
    const start = moons[i].date;
    const end = moons[i + 1].date;
    months.push({
      start,
      end,
      moonMinutes: moons[i].minutes,
      terms: terms.filter((term) => term.date >= start && term.date < end),
    });
  }

  const solstices = months.flatMap((month, index) => (month.terms.some((t) => t.degrees === 270) ? [index] : []));
  const labelled = [];
  for (let s = 0; s + 1 < solstices.length; s++) {
    const [first, next] = [solstices[s], solstices[s + 1]];
    let leapToPlace = next - first === 13;
    let number = 11;
    for (let i = first; i < next; i++) {
      const month = months[i];
      if (i > first && leapToPlace && month.terms.length === 0) {
        leapToPlace = false;
        labelled.push({ ...month, month: number, leap: true });
        continue;
      }
      if (i > first) number = (number % 12) + 1;
      labelled.push({ ...month, month: number, leap: false });
    }
  }

  const result = labelled.map(({ start, end, month, leap, moonMinutes, terms: inMonth }) => ({
    lunarYear: lunarYearOf(month, start),
    month,
    leap,
    start,
    end,
    moonMinutes,
    terms: inMonth.map(({ degrees, date, minutes }) => ({ degrees, date, minutes })),
  }));
  trueMonthsCache.set(kind, result);
  return result;
}

/**
 * The lunar year a date in a given lunar month belongs to: months 11 and 12
 * (and their days) can fall in January to March of the next Gregorian year.
 */
function lunarYearOf(month, date) {
  const year = Number(date.slice(0, 4));
  return month >= 11 && Number(date.slice(5, 7)) <= 3 ? year - 1 : year;
}

const trueStartsCache = new Map();

/**
 * The true calendar's month starts, `${lunarYear}|${month}|${leap ? 1 : 0}` →
 * date. As in date-holidays, a leap label for a month that has no leap month
 * names the month after it.
 */
function trueMonthStarts(kind) {
  let starts = trueStartsCache.get(kind);
  if (starts) return starts;
  starts = new Map();
  const months = lunisolarMonths(kind);
  months.forEach((month, index) => {
    starts.set(`${month.lunarYear}|${month.month}|${month.leap ? 1 : 0}`, month.start);
    if (!month.leap && months[index + 1] && !months[index + 1].leap) {
      starts.set(`${month.lunarYear}|${month.month}|1`, months[index + 1].start);
    }
  });
  trueStartsCache.set(kind, starts);
  return starts;
}

/**
 * The Gregorian date of a day in a lunisolar month, on the true calendar.
 * Day 0 is the day before the 1st (New Year's Eve for month 1), and a day past
 * a 29-day month's end runs into the next month, as in date-holidays' rules.
 * Undefined outside about 2023 to 2053. Supplements can use this for Chinese,
 * Korean and Vietnamese festivals instead of date-holidays' rules.
 */
export function lunisolarDate(kind, lunarYear, month, day, leap = false) {
  if (!(kind in LUNISOLAR_ZONES)) throw new Error(`No lunisolar calendar called ${kind}`);
  const start = trueMonthStarts(kind).get(`${lunarYear}|${month}|${leap ? 1 : 0}`);
  return start === undefined ? undefined : addDays(start, day - 1);
}

const engineCache = new Map();

/** The dates date-holidays' rule engine gives a plain lunar rule in a Gregorian year. */
function engineDates(spec, year) {
  let cached = engineCache.get(spec);
  if (!cached) {
    const calendar = new Holidays({});
    if (!calendar.setHoliday(spec, { name: { en: spec }, type: "observance" })) {
      throw new Error(`date-holidays cannot read the rule "${spec}"`);
    }
    cached = { calendar, years: new Map() };
    engineCache.set(spec, cached);
  }
  if (!cached.years.has(year)) {
    cached.years.set(year, (cached.calendar.getHolidays(year, "en") ?? []).map((h) => h.date.slice(0, 10)));
  }
  return cached.years.get(year);
}

/** The date date-holidays' rule engine gives a lunar date in a lunar year. */
function engineDate(kind, lunarYear, month, leap, day) {
  const spec = `${kind} ${pad(month)}-${leap}-${pad(day)}`;
  for (const year of [lunarYear, lunarYear + 1]) {
    for (const date of engineDates(spec, year)) {
      if (lunarYearOf(month, date) === lunarYear) return date;
    }
  }
  return undefined;
}

const engineMonthsCache = new Map();

/**
 * Where date-holidays' rule engine puts the 1st of each month label, in the
 * shape of trueMonthStarts().
 */
function engineMonthStarts(kind) {
  let starts = engineMonthsCache.get(kind);
  if (starts) return starts;
  const calendar = new Holidays({});
  for (let month = 1; month <= 12; month++) {
    for (const leap of [0, 1]) {
      calendar.setHoliday(`${kind} ${pad(month)}-${leap}-01`, { name: { en: `${month} ${leap}` }, type: "observance" });
    }
  }
  starts = new Map();
  for (let year = LUNAR_FROM; year <= LUNAR_TO; year++) {
    for (const holiday of calendar.getHolidays(year, "en") ?? []) {
      const [month, leap] = holiday.name.split(" ").map(Number);
      const date = holiday.date.slice(0, 10);
      starts.set(`${lunarYearOf(month, date)}|${month}|${leap}`, date);
    }
  }
  engineMonthsCache.set(kind, starts);
  return starts;
}

/**
 * Every month whose first day date-holidays and the true calendar disagree
 * on, for the lunar years from `from` to `to`: { kind, lunarYear, month,
 * leap, library, true } (undefined where that side has no such month, as
 * with a leap month only one of them has). The slipping day count within a
 * month is not listed here; lunisolarCorrectionsFor() shows the days it moves.
 */
export function lunisolarDisagreements(from = FROM - 1, to = TO + 1) {
  const out = [];
  for (const kind of Object.keys(LUNISOLAR_ZONES)) {
    const library = engineMonthStarts(kind);
    // The library's own months: every plain label, and a leap label that does
    // not just name the month after (a day no plain label has).
    const plainDays = new Set([...library].filter(([key]) => key.endsWith("|0")).map(([, date]) => date));
    const libraryMonths = new Map([...library].filter(([key, date]) => key.endsWith("|0") || !plainDays.has(date)));
    const trueMonths = new Map(
      lunisolarMonths(kind).map((month) => [`${month.lunarYear}|${month.month}|${month.leap ? 1 : 0}`, month.start]),
    );
    for (const key of new Set([...libraryMonths.keys(), ...trueMonths.keys()])) {
      const [lunarYear, month, leap] = key.split("|").map(Number);
      if (lunarYear < from || lunarYear > to) continue;
      const libraryDate = libraryMonths.get(key);
      const trueDate = trueMonths.get(key);
      if (libraryDate !== trueDate) {
        out.push({ kind, lunarYear, month, leap: leap === 1, library: libraryDate, true: trueDate });
      }
    }
  }
  return out.sort(
    (a, b) =>
      compareText(a.kind, b.kind) || a.lunarYear - b.lunarYear || a.month - b.month || Number(a.leap) - Number(b.leap),
  );
}

/**
 * A lunar date date-holidays' rule engine turns into `date`: { month, leap,
 * day } in its own (faulty) calendar. The month is the label whose 1st it
 * puts nearest before the date; the day is the count from there, or the one
 * either side that the slipping day count needs, whichever lands on the date.
 */
function engineLabel(kind, date) {
  const candidates = [];
  for (const [key, start] of engineMonthStarts(kind)) {
    const offset = daysBetween(start, date);
    if (offset < 0 || offset > 30) continue;
    const [lunarYear, month, leap] = key.split("|").map(Number);
    candidates.push({ lunarYear, month, leap, offset });
  }
  candidates.sort((a, b) => a.offset - b.offset || a.leap - b.leap);
  for (const { lunarYear, month, leap, offset } of candidates) {
    for (const shift of [0, 1, -1, 2, -2]) {
      const day = offset + 1 + shift;
      if (day < 0 || day > 30) continue;
      if (engineDate(kind, lunarYear, month, leap, day) === date) return { month, leap, day };
    }
  }
  throw new Error(`date-holidays has no ${kind} lunar date that lands on ${date}`);
}

const LUNISOLAR_RULE = /\b(chinese|korean|vietnamese) (?:\d+-\d{1,2}-)?(\d{1,2})-([01])-(\d{1,2})\b/;

/** How far a holiday can sit from the lunar date its rule names (spans, "if Sunday then"). */
const RULE_REACH = 12;

/** A library rule's options as setHoliday() takes them, without what it added. */
function ruleOptions(options) {
  const rest = { ...options };
  delete rest.fn;
  if (rest.active) {
    // date-holidays turns "YYYY-MM-DD" into a local-time Date; read it back
    // the same way, which gives the original date in any time zone.
    const text = (date) =>
      date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : undefined;
    rest.active = rest.active.map(({ from, to }) => ({ from: text(from), to: text(to) }));
  }
  return rest;
}

const correctionsCache = new WeakMap();

/**
 * For one calendar (a country or a state), every lunisolar rule whose day
 * date-holidays has wrong in some lunar year: rule → [{ kind, library, true,
 * holidays }], with `holidays` what the rule gives when evaluated on the true
 * day.
 */
function lunisolarCorrections(calendar, from, to) {
  let corrections = correctionsCache.get(calendar);
  if (corrections) return corrections;
  corrections = new Map();

  for (const [rule, options] of Object.entries(calendar.holidays)) {
    if (!options?.fn) continue;
    const match = LUNISOLAR_RULE.exec(rule);
    if (!match) continue;
    const [spec, kind] = match;
    const [month, leap, day] = match.slice(2).map(Number);

    for (let lunarYear = Math.max(from - 1, LUNAR_FROM + 1); lunarYear <= Math.min(to, LUNAR_TO - 1); lunarYear++) {
      const wrong = engineDate(kind, lunarYear, month, leap, day);
      const right = lunisolarDate(kind, lunarYear, month, day, leap === 1);
      if (!wrong || !right || wrong === right) continue;

      const label = engineLabel(kind, right);
      const fixed = rule.replace(spec, `${kind} ${pad(label.month)}-${label.leap}-${pad(label.day)}`);
      const scratch = new Holidays({});
      if (!scratch.setHoliday(fixed, ruleOptions(options))) {
        throw new Error(`date-holidays cannot read the corrected rule "${fixed}"`);
      }
      const year = Number(right.slice(0, 4));
      const holidays = [];
      for (let y = year - 1; y <= year + 1; y++) {
        for (const holiday of scratch.getHolidays(y, "en") ?? []) {
          if (Math.abs(daysBetween(right, holiday.date.slice(0, 10))) <= RULE_REACH) {
            holidays.push({ ...holiday, rule });
          }
        }
      }
      corrections.set(rule, [...(corrections.get(rule) ?? []), { kind, library: wrong, true: right, holidays }]);
    }
  }
  correctionsCache.set(calendar, corrections);
  return corrections;
}

/** A calendar's holidays for a year, with its lunisolar days corrected. */
function holidaysIn(calendar, year, from, to) {
  const listed = calendar.getHolidays(year, "en") ?? [];
  const corrections = lunisolarCorrections(calendar, from, to);
  if (corrections.size === 0) return listed;

  const kept = listed.filter((holiday) => {
    const wrong = corrections.get(holiday.rule);
    return !wrong?.some((c) => Math.abs(daysBetween(c.library, holiday.date.slice(0, 10))) <= RULE_REACH);
  });
  for (const list of corrections.values()) {
    for (const correction of list) {
      for (const holiday of correction.holidays) {
        if (holiday.date.startsWith(`${year}-`)) kept.push(holiday);
      }
    }
  }
  return kept;
}

// ---------------------------------------------------------------------------
// The library's entries.

/** A date-holidays calendar for a country or one of its states, with RULE_FIXES applied. */
function libraryCalendar(country, state) {
  const calendar = state ? new Holidays(country, state, OPTIONS) : new Holidays(country, OPTIONS);
  const fix = RULE_FIXES[country];
  if (!fix) return calendar;

  const removed = {};
  for (const rule of fix.remove) {
    const options = calendar.holidays[rule];
    if (!options) {
      if (state) continue;
      throw new Error(`RULE_FIXES ${country}: date-holidays has no rule "${rule}" any more; look at the fix again`);
    }
    removed[rule] = ruleOptions(options);
    calendar.setHoliday(rule, false);
  }
  for (const [rule, options] of Object.entries(fix.add)) {
    const opts = options.from ? removed[options.from] : structuredClone(options);
    if (!opts) continue;
    if (!calendar.setHoliday(rule, opts)) {
      throw new Error(`RULE_FIXES ${country}: date-holidays cannot read the rule "${rule}"`);
    }
  }
  return calendar;
}

/** Whether a library rule's name has an English translation. */
function hasEnglishName(name) {
  return Boolean(name) && typeof name === "object" && Object.keys(name).some((lang) => lang === "en" || lang.startsWith("en-"));
}

/**
 * "CC name" for each library holiday the build met that has no English name
 * and no entry in ENGLISH_NAMES, for the coverage summary.
 */
const untranslated = new Set();

/**
 * One date-holidays calendar (a country, or a country and one of its states)
 * as one entry per day. A holiday that runs several days (Songkran, Eid, the
 * Lunar New Year) becomes one entry for each day it covers.
 */
function calendarEntries(calendar, country, from, to) {
  const entries = [];
  // The year before too, for a holiday that starts in late December and runs
  // into the first year.
  for (let year = from - 1; year <= to; year++) {
    for (const holiday of holidaysIn(calendar, year, from, to)) {
      if (!LIBRARY_KINDS.has(holiday.type)) continue;

      const first = holiday.date.slice(0, 10);
      const hours = (holiday.end.getTime() - holiday.start.getTime()) / 3_600_000;
      // Whole days, allowing for a day that a clock change makes 23 or 25
      // hours long. A holiday that starts in the evening still marks its day.
      const days = Math.max(1, Math.floor((hours + 1.5) / 24));
      const options = calendar.holidays[holiday.rule];
      // A one-off date the library marks as a substitute (Malaysia's and
      // Singapore's Deepavali on Monday 9 November 2026) carries the plain
      // name; give it the suffix the rule-made ones have.
      const oneOff = options?.substitute === true && /^\d{4}-\d{2}-\d{2}$/.test(holiday.rule ?? "");
      const name = cleanName(country, oneOff && !SUBSTITUTE_SUFFIX.test(holiday.name) ? `${holiday.name} (substitute day)` : holiday.name);
      const libraryName = options?.name;
      const { base } = splitSubstitute(holiday.name);
      if (libraryName !== undefined && !hasEnglishName(libraryName) && !ENGLISH_NAMES[country]?.[base]) {
        untranslated.add(`${country} ${base}`);
      }
      const libraryNote = cleanNote(holiday.note);
      const kind = holiday.type === "public" && GROUP_ONLY.test(libraryNote) ? "optional" : holiday.type;
      const note = joinNotes(
        libraryNote,
        LIBRARY_NOTES[country]?.[name] ?? "",
        LUNAR_ISLAMIC.test(holiday.rule ?? "") ? MOON_NOTE : "",
      );

      for (let offset = 0; offset < days; offset++) {
        const date = addDays(first, offset);
        if (inRange(date, from, to)) entries.push({ date, kind, name, note });
      }
    }
  }
  return entries;
}

/** Keeps one entry per (date, name): the stronger kind, then the first seen. */
function dedupe(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = entryKey(entry);
    const previous = byKey.get(key);
    if (!previous || KIND_RANK[entry.kind] < KIND_RANK[previous.kind]) byKey.set(key, entry);
  }
  return byKey;
}

/**
 * Everything date-holidays has for a country: the national calendar, plus
 * each state's own days off as "optional", noting where they apply. A state's
 * day off on a date that is already a national one (Arizona's name for Martin
 * Luther King Jr. Day, say) adds nothing a traveller needs, so it is left out.
 */
export function libraryEntries(country, from = FROM, to = TO) {
  const national = dedupe(calendarEntries(libraryCalendar(country), country, from, to));

  const states = new Holidays().getStates(country, "en") ?? {};
  /** region → its days off, and their date|name|substitute keys. */
  const regionDays = new Map();
  for (const code of Object.keys(states).sort()) {
    const region = cleanRegion(states[code], code, country);
    const list = [...dedupe(calendarEntries(libraryCalendar(country, code), country, from, to)).values()].filter((entry) =>
      DAY_OFF.has(entry.kind),
    );
    const named = new Set(
      list.map((entry) => {
        const { base, substitute } = splitSubstitute(entry.name);
        return `${entry.date}|${nameKey(base)}|${substitute}`;
      }),
    );
    regionDays.set(region, { list, daysOff: new Set(list.map((entry) => entry.date)), named });
  }

  // A national day off some regions do not keep (STATE_GAPS) gets a note,
  // and becomes optional when more than a third of them do not.
  for (const [key, entry] of national) {
    if (!STATE_GAPS.has(country) || !DAY_OFF.has(entry.kind)) continue;
    const { base, substitute } = splitSubstitute(entry.name);
    // A region keeps the day if it has a day off then, or has the same
    // holiday moved a few days (a weekend holiday made up on the Monday; a
    // substitute day only by its own substitute day).
    const kinds = substitute ? [true] : [false, true];
    const keeps = ({ daysOff, named }) =>
      daysOff.has(entry.date) ||
      [-3, -2, -1, 1, 2, 3].some((d) => kinds.some((sub) => named.has(`${addDays(entry.date, d)}|${nameKey(base)}|${sub}`)));
    const missing = [...regionDays].filter(([, days]) => !keeps(days)).map(([region]) => region);
    if (missing.length > 0 && missing.length < regionDays.size) {
      national.set(key, {
        ...entry,
        kind: missing.length * 3 > regionDays.size ? "optional" : entry.kind,
        note: joinNotes(`Not a day off in ${listOf(missing)}`, entry.note),
      });
    }
  }

  const nationalDaysOff = new Set(
    [...national.values()].filter((entry) => DAY_OFF.has(entry.kind)).map((entry) => entry.date),
  );
  /** key → { entry, regions } for days off that are not national ones. */
  const regional = new Map();
  /** key → regions, for a national observance some regions take off. */
  const regionsOff = new Map();

  for (const [region, { list }] of regionDays) {
    for (const entry of list) {
      const key = entryKey(entry);
      const nationally = national.get(key);

      if (nationally) {
        if (DAY_OFF.has(nationally.kind) || /^Not a day off in /.test(nationally.note)) continue;
        regionsOff.set(key, [...(regionsOff.get(key) ?? []), region]);
      } else if (nationalDaysOff.has(entry.date)) {
        continue;
      } else if (regional.has(key)) {
        regional.get(key).regions.push(region);
      } else {
        regional.set(key, { entry, regions: [region] });
      }
    }
  }

  const entries = [...national.values()].map((entry) => {
    const regions = regionsOff.get(entryKey(entry));
    if (!regions) return entry;
    return {
      ...entry,
      kind: "optional",
      note: joinNotes(entry.note, `Day off in ${listOf(regions)}`),
    };
  });

  for (const { entry, regions } of regional.values()) {
    entries.push({
      date: entry.date,
      kind: "optional",
      name: entry.name,
      note: joinNotes(`Day off in ${listOf(regions)}`, entry.note),
    });
  }

  return entries.sort(compareEntries);
}

/**
 * Every library day date-holidays' own calendar puts on another date than the
 * true lunisolar calendar, for one country: { kind, rule, library, true }.
 * For the summary and the tests; the build has already moved them.
 */
export function lunisolarCorrectionsFor(country, from = FROM, to = TO) {
  const out = [];
  const calendars = [libraryCalendar(country)];
  for (const code of Object.keys(new Holidays().getStates(country, "en") ?? {}).sort()) {
    calendars.push(libraryCalendar(country, code));
  }
  const seen = new Set();
  for (const calendar of calendars) {
    for (const [rule, list] of lunisolarCorrections(calendar, from, to)) {
      for (const correction of list) {
        const key = `${rule}|${correction.library}`;
        if (seen.has(key) || !inRange(correction.true, from, to)) continue;
        seen.add(key);
        out.push({ kind: correction.kind, rule, library: correction.library, true: correction.true });
      }
    }
  }
  return out.sort((a, b) => compareText(a.true, b.true) || compareText(a.rule, b.rule));
}

/**
 * The merge rule. Library entries keep one per (date, name); then each
 * supplement entry, in order, replaces whatever already has its date and name,
 * or is added. Returns the entries sorted.
 */
export function mergeEntries(library, supplements) {
  const byKey = dedupe(library);
  for (const entry of supplements) byKey.set(entryKey(entry), entry);
  return [...byKey.values()].sort(compareEntries);
}

// ---------------------------------------------------------------------------
// Dropping library entries.

const DROP_KEYS = new Set(["name", "from", "to", "dates", "note"]);
const MONTH_DAY = /^(\d{2})-(\d{2})$/;

/** A drop rule as the build summary and errors show it. */
export function describeDrop(rule) {
  const parts = [`name: ${rule.name instanceof RegExp ? String(rule.name) : JSON.stringify(rule.name)}`];
  if (rule.from !== undefined) parts.push(`from: ${rule.from}`);
  if (rule.to !== undefined) parts.push(`to: ${rule.to}`);
  if (rule.dates !== undefined) parts.push(`dates: ${JSON.stringify(rule.dates)}`);
  if (rule.note !== undefined) parts.push(`note: ${String(rule.note)}`);
  return `{ ${parts.join(", ")} }`;
}

/** Checks a supplement's `drop` list; throws naming the file on anything malformed. */
function dropRules(drop, where) {
  if (drop === undefined) return [];
  if (!Array.isArray(drop)) throw new Error(`${where}: drop must be an array of rules`);
  return drop.map((rule, index) => {
    const at = `${where}: drop[${index}]`;
    if (!rule || typeof rule !== "object" || Array.isArray(rule) || rule instanceof RegExp) {
      throw new Error(`${at} must be an object such as { name: "Holiday" }`);
    }
    for (const key of Object.keys(rule)) {
      if (!DROP_KEYS.has(key)) throw new Error(`${at} has an unknown field ${JSON.stringify(key)}`);
    }
    if (!(rule.name instanceof RegExp) && (typeof rule.name !== "string" || nameKey(rule.name) === "")) {
      throw new Error(`${at}: name must be a holiday's name or a RegExp`);
    }
    for (const key of ["from", "to"]) {
      if (rule[key] !== undefined && !Number.isInteger(rule[key])) {
        throw new Error(`${at}: ${key} must be a whole year`);
      }
    }
    const from = rule.from ?? FROM;
    const to = rule.to ?? TO;
    if (from > to) throw new Error(`${at}: from ${from} is after to ${to}`);
    if (rule.dates !== undefined) {
      if (!Array.isArray(rule.dates) || rule.dates.length === 0) {
        throw new Error(`${at}: dates must be a list of "MM-DD" month-days`);
      }
      for (const date of rule.dates) {
        // 2024 is a leap year, so 02-29 passes.
        if (typeof date !== "string" || !MONTH_DAY.test(date) || !validDate(`2024-${date}`)) {
          throw new Error(`${at}: ${JSON.stringify(date)} is not an "MM-DD" month-day`);
        }
      }
    }
    if (rule.note !== undefined && !(rule.note instanceof RegExp)) {
      throw new Error(`${at}: note must be a RegExp`);
    }
    return {
      name: rule.name,
      from,
      to,
      dates: rule.dates ? new Set(rule.dates) : undefined,
      note: rule.note,
      text: describeDrop(rule),
    };
  });
}

function testRegExp(pattern, text) {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/** Whether a drop rule matches a library entry of `country`. */
function dropMatches(rule, entry, country) {
  const year = Number(entry.date.slice(0, 4));
  if (year < rule.from || year > rule.to) return false;
  if (rule.dates && !rule.dates.has(entry.date.slice(5))) return false;
  if (rule.note && !testRegExp(rule.note, entry.note ?? "")) return false;
  const names = libraryNames(country, entry.name);
  return rule.name instanceof RegExp
    ? names.some((name) => testRegExp(rule.name, name))
    : names.some((name) => nameKey(name) === nameKey(rule.name));
}

/**
 * The library's entries for a country less what its supplements drop. Every
 * rule must match at least one entry (one whose years overlap the build's):
 * a rule that matches nothing is a mistake, or a library change, to look at.
 * Each supplement's `dropped` count is set on it.
 */
export function applyDrops(country, library, supplements, from = FROM, to = TO) {
  const dropped = new Set();
  for (const supplement of supplements) {
    const mine = new Set();
    for (const rule of supplement.drop ?? []) {
      if (rule.to < from || rule.from > to) continue;
      const matched = library.filter((entry) => dropMatches(rule, entry, country));
      if (matched.length === 0) {
        throw new Error(
          `${supplement.file} ${country}: drop ${rule.text} matches no date-holidays entry; check the name and years against the library`,
        );
      }
      for (const entry of matched) mine.add(entry);
    }
    supplement.dropped = mine.size;
    for (const entry of mine) dropped.add(entry);
  }
  return library.filter((entry) => !dropped.has(entry));
}

// ---------------------------------------------------------------------------
// Supplements.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(date) {
  return DATE.test(date) && addDays(date, 0) === date;
}

/**
 * Checks one supplement module's export and calls it for every year. Throws
 * with the file name on anything malformed, so a bad supplement stops the
 * build instead of quietly shipping wrong dates.
 */
export function supplementEntries(supplements, file, from = FROM, to = TO) {
  if (!Array.isArray(supplements)) {
    throw new Error(`${file}: the default export must be an array of supplements`);
  }

  return supplements.map((supplement, index) => {
    const where = `${file} [${index}]`;
    if (typeof supplement?.country !== "string" || !/^[A-Z]{2}$/.test(supplement.country)) {
      throw new Error(`${where}: country must be an upper-case ISO 3166-1 alpha-2 code`);
    }
    if (typeof supplement.source !== "string" || supplement.source.trim() === "") {
      throw new Error(`${where}: source must describe where the dates come from`);
    }
    if (typeof supplement.entries !== "function") {
      throw new Error(`${where}: entries must be a function of the year`);
    }
    if (supplement.finish !== undefined && typeof supplement.finish !== "function") {
      throw new Error(`${where}: finish must be a function of the merged entries`);
    }
    const drop = dropRules(supplement.drop, where);

    const entries = [];
    for (let year = from; year <= to; year++) {
      const listed = supplement.entries(year);
      if (!Array.isArray(listed)) {
        throw new Error(`${where}: entries(${year}) must return an array`);
      }
      entries.push(...checkedEntries(listed, `${where}: entries(${year})`, from, to));
    }

    const finish = supplement.finish
      ? (merged) => {
          const listed = supplement.finish(merged.map((entry) => ({ ...entry })));
          if (!Array.isArray(listed)) throw new Error(`${where}: finish must return an array`);
          return [...dedupe(checkedEntries(listed, `${where}: finish`, from, to)).values()].sort(compareEntries);
        }
      : undefined;

    // `dropped` is how many library entries `drop` removed, set by applyDrops().
    return { country: supplement.country, source: supplement.source.trim(), file, drop, entries, finish, dropped: 0 };
  });
}

/** A supplement's entries, checked and tidied; throws naming `where` on anything malformed. */
function checkedEntries(listed, where, from, to) {
  const entries = [];
  for (const entry of listed) {
    if (typeof entry?.date !== "string" || !validDate(entry.date)) {
      throw new Error(`${where} has a bad date ${JSON.stringify(entry?.date)}`);
    }
    if (!KINDS.includes(entry.kind)) {
      throw new Error(`${where}: ${entry.date} has an unknown kind ${JSON.stringify(entry.kind)}`);
    }
    if (typeof entry.name !== "string" || entry.name.trim() === "") {
      throw new Error(`${where}: ${entry.date} has no name`);
    }
    if (entry.note !== undefined && typeof entry.note !== "string") {
      throw new Error(`${where}: ${entry.date} ${entry.name} has a note that is not text`);
    }
    if (!inRange(entry.date, from, to)) continue;
    entries.push({
      date: entry.date,
      kind: entry.kind,
      name: entry.name.replace(/\s+/g, " ").trim(),
      note: (entry.note ?? "").replace(/\s+/g, " ").trim(),
    });
  }
  return entries;
}

/**
 * The last step for a country: each of its supplements' `finish`, in file
 * order, given the merged entries (library and every supplement) and
 * returning the whole list again. For rules that need the finished calendar,
 * such as a substitute day for every holiday that falls on a Sunday.
 */
export function finishEntries(entries, supplements) {
  let list = entries;
  for (const supplement of supplements) if (supplement.finish) list = supplement.finish(list);
  return list;
}

/**
 * Whether a file in the supplements folder is a supplement: an .mjs module,
 * but not a helper ("_shared.mjs") or a test ("thai.test.mjs").
 */
export function isSupplementFile(file) {
  return file.endsWith(".mjs") && !file.startsWith("_") && !file.endsWith(".test.mjs");
}

/** Every supplement in the folder, in file-name order. A missing folder is none. */
export async function loadSupplements(dir, from = FROM, to = TO) {
  let files;
  try {
    files = (await readdir(dir)).filter(isSupplementFile).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const loaded = [];
  for (const file of files) {
    const supplement = await import(pathToFileURL(path.join(dir, file)).href);
    loaded.push(...supplementEntries(supplement.default, file, from, to));
  }
  return loaded;
}

// ---------------------------------------------------------------------------
// Output.

export function countryJson(entries, from = FROM, to = TO) {
  const rows = entries.map((entry) =>
    JSON.stringify([entry.date, entry.kind, entry.name, entry.note ?? ""]),
  );
  return `{"from":${from},"to":${to},"entries":[\n${rows.join(",\n")}\n]}\n`;
}

const HEADER = `// Generated by scripts/build-holidays.mjs from date-holidays and
// scripts/holiday-supplements/. Do not edit: run \`node scripts/build-holidays.mjs\`.`;

export function indexSource(countries) {
  const loaders = countries
    .map((country) => `  ${country}: () => load(import("./${country}.json")),`)
    .join("\n");

  return `${HEADER}
import type { HolidayKind } from "../holidays";

/** One day: [date, kind, name, note]. The note is "" when there is none. */
export type HolidayEntry = [date: string, kind: HolidayKind, name: string, note: string];

export interface CountryHolidays {
  /** First and last year covered, inclusive. */
  from: number;
  to: number;
  /** Sorted by date. One entry per holiday per day. */
  entries: HolidayEntry[];
}

type Loaded = { default: CountryHolidays };

function load(module: Promise<unknown>): Promise<Loaded> {
  return module as Promise<Loaded>;
}

/**
 * One static import() per country, so each country is its own chunk and is
 * only fetched for a trip that goes there.
 */
export const HOLIDAY_LOADERS: Record<string, () => Promise<Loaded>> = {
${loaders}
};
`;
}

export function sourcesSource(supplements) {
  const seen = new Set();
  const rows = [];
  for (const { country, source } of supplements) {
    const key = `${country}|${source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ country, source });
  }
  rows.sort((a, b) => compareText(a.country, b.country) || compareText(a.source, b.source));

  return `${HEADER}

/** Where the dates beyond date-holidays come from, per country. */
export const HOLIDAY_SOURCES: { country: string; source: string }[] = ${JSON.stringify(rows, null, 2)};
`;
}

/**
 * The whole output, as file name → contents, with numbers for the summary.
 * `countries` limits it to some countries (the tests use it); the index then
 * lists only those.
 *
 * @param {{ supplementsDir?: string, from?: number, to?: number, countries?: string[] }} [options]
 */
export async function build({
  supplementsDir = DEFAULT_SUPPLEMENTS,
  from = FROM,
  to = TO,
  countries: only,
} = {}) {
  const libraryCountries = Object.keys(new Holidays().getCountries("en") ?? {}).sort();
  const supplements = await loadSupplements(supplementsDir, from, to);

  const countries = [...new Set([...libraryCountries, ...supplements.map((s) => s.country)])]
    .filter((country) => !only || only.includes(country))
    .sort();
  const files = new Map();
  const stats = { countries: [], supplements: [], nonLatin: [], untranslated: [], lunisolar: [] };
  untranslated.clear();

  for (const country of countries) {
    const own = supplements.filter((supplement) => supplement.country === country);
    const fullLibrary = libraryCountries.includes(country) ? libraryEntries(country, from, to) : [];
    const library = applyDrops(country, fullLibrary, own, from, to);
    const libraryKeys = new Set(library.map(entryKey));
    if (libraryCountries.includes(country)) {
      for (const moved of lunisolarCorrectionsFor(country, from, to)) stats.lunisolar.push({ country, ...moved });
    }

    for (const supplement of own) {
      const keys = new Set(supplement.entries.map(entryKey));
      const replaced = [...keys].filter((key) => libraryKeys.has(key)).length;
      stats.supplements.push({
        file: supplement.file,
        country,
        entries: keys.size,
        replaced,
        added: keys.size - replaced,
        dropped: supplement.dropped,
      });
    }

    const entries = finishEntries(
      mergeEntries(
        library,
        own.flatMap((supplement) => supplement.entries),
      ),
      own,
    );
    const json = countryJson(entries, from, to);
    files.set(`${country}.json`, json);

    const byKind = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
    const yearsOff = new Set();
    for (const entry of entries) {
      byKind[entry.kind]++;
      if (DAY_OFF.has(entry.kind)) yearsOff.add(Number(entry.date.slice(0, 4)));
      if (!/\p{Script=Latin}/u.test(entry.name)) stats.nonLatin.push(`${country} ${entry.name}`);
    }
    const missingYears = [];
    for (let year = from; year <= to; year++) if (!yearsOff.has(year)) missingYears.push(year);

    stats.countries.push({
      country,
      entries: entries.length,
      bytes: Buffer.byteLength(json),
      byKind,
      missingYears,
      library: libraryCountries.includes(country),
    });
  }

  stats.untranslated = [...untranslated].sort();
  files.set("index.ts", indexSource(countries));
  files.set("sources.ts", sourcesSource(supplements.filter((s) => countries.includes(s.country))));
  return { files, stats, supplements };
}

function libraryVersion() {
  const require = createRequire(import.meta.url);
  return require("date-holidays/package.json").version;
}

function summary({ files, stats }, from, to) {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  let entries = 0;
  let bytes = 0;
  for (const country of stats.countries) {
    entries += country.entries;
    bytes += country.bytes;
    for (const kind of KINDS) totals[kind] += country.byKind[kind];
  }
  const bySize = [...stats.countries].sort((a, b) => b.bytes - a.bytes || compareText(a.country, b.country));
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const lines = [
    `date-holidays ${libraryVersion()}, ${from} to ${to}`,
    `${stats.countries.length} countries (${stats.countries.filter((c) => !c.library).length} from supplements only), ${files.size} files`,
    `${entries} entries: ${KINDS.map((kind) => `${totals[kind]} ${kind}`).join(", ")}`,
    `${bytes} bytes of JSON (${kb(bytes)}); largest ${bySize
      .slice(0, 3)
      .map((c) => `${c.country} ${kb(c.bytes)}`)
      .join(", ")}; smallest ${bySize
      .slice(-3)
      .map((c) => `${c.country} ${kb(c.bytes)}`)
      .join(", ")}`,
  ];

  lines.push(`Rule fixes: ${Object.keys(RULE_FIXES).join(", ")}. Name aliases: ${Object.keys(NAME_ALIASES).join(", ")}.`);
  const disagreements = lunisolarDisagreements(from - 1, to + 1);
  lines.push(
    disagreements.length === 0
      ? "Lunisolar calendars: date-holidays agrees with the astronomical calendar."
      : `Lunisolar months date-holidays puts on another day (${disagreements.length}): ${disagreements
          .map((d) => `${d.kind} ${d.lunarYear} ${d.leap ? "leap " : ""}${d.month} (${d.library ?? "none"} not ${d.true ?? "none"})`)
          .join("; ")}`,
  );
  if (stats.lunisolar.length > 0) {
    lines.push(
      `Library days moved to the true lunisolar date (${stats.lunisolar.length}): ${stats.lunisolar
        .map((m) => `${m.country} ${m.rule} ${m.library} -> ${m.true}`)
        .join("; ")}`,
    );
  }

  if (stats.supplements.length === 0) {
    lines.push("Supplements: none");
  } else {
    lines.push("Supplements:");
    for (const s of stats.supplements) {
      lines.push(
        `  ${s.file} ${s.country}: ${s.entries} entries, ${s.added} added, ${s.replaced} replaced, ${s.dropped} library entries dropped`,
      );
    }
  }

  const gaps = stats.countries.filter((c) => c.missingYears.length > 0);
  lines.push(
    gaps.length === 0
      ? "Every country has at least one day off in every year."
      : `No day off in some years (${gaps.length}): ${gaps
          .map((c) =>
            c.missingYears.length === to - from + 1
              ? `${c.country} (none at all)`
              : `${c.country} (${c.missingYears.length} years)`,
          )
          .join(", ")}`,
  );
  if (stats.nonLatin.length > 0) {
    lines.push(`Names not in Latin script (${stats.nonLatin.length}): ${[...new Set(stats.nonLatin)].join("; ")}`);
  }
  if (stats.untranslated.length > 0) {
    lines.push(
      `Library names with no English translation, to add to ENGLISH_NAMES (${stats.untranslated.length}): ${stats.untranslated.join("; ")}`,
    );
  }
  return lines.join("\n");
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const out = path.resolve(argument("--out") ?? DEFAULT_OUT);
  const supplementsDir = path.resolve(argument("--supplements") ?? DEFAULT_SUPPLEMENTS);
  const result = await build({ supplementsDir });

  if (process.argv.includes("--check")) {
    const stale = [];
    for (const [file, contents] of result.files) {
      const current = await readFile(path.join(out, file), "utf8").catch(() => undefined);
      if (current !== contents) stale.push(file);
    }
    const extra = (await readdir(out).catch(() => []))
      .filter((file) => (file.endsWith(".json") || file.endsWith(".ts")) && !result.files.has(file));
    if (stale.length > 0 || extra.length > 0) {
      console.error(
        `Holiday data is out of date: ${[...stale, ...extra].slice(0, 10).join(", ")}${
          stale.length + extra.length > 10 ? " and more" : ""
        }. Run node scripts/build-holidays.mjs.`,
      );
      process.exit(1);
    }
    console.log("Holiday data is up to date.");
    return;
  }

  await mkdir(out, { recursive: true });
  // A country that is no longer generated must not linger as a stale file.
  for (const file of await readdir(out)) {
    if (file.endsWith(".json") && !result.files.has(file)) await rm(path.join(out, file));
  }
  for (const [file, contents] of result.files) {
    await writeFile(path.join(out, file), contents);
  }

  console.log(summary(result, FROM, TO));
  console.log(`Wrote ${result.files.size} files to ${path.relative(process.cwd(), out) || "."}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
