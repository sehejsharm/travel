/**
 * Builds the holiday calendar the app ships: one JSON file per country in
 * src/lib/reference/holiday-data/, 2026 to 2050, plus the index.ts that loads
 * each one on demand.
 *
 * The base is date-holidays (https://github.com/commenthol/date-holidays):
 * every country it knows, in English, with school holidays dropped. Each
 * country also gets the days its states or regions take off (date-holidays'
 * per-state lists), as "optional" with a note naming where. On top of that go
 * the supplement modules in scripts/holiday-supplements/*.mjs (see the README
 * there): festivals and corrections the library does not carry. A supplement
 * entry naming the same holiday on the same date as a library one replaces it.
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

const OPTIONS = { languages: ["en"] };

/**
 * Library names with no English translation, which date-holidays falls back
 * to the country's own language for. Anything else non-Latin that turns up
 * after a library upgrade is listed in the coverage summary.
 */
const ENGLISH_NAMES = {
  TN: {
    "عيد الثورة و الشباب": "Revolution and Youth Day",
    "عيد الإستقلال": "Independence Day",
    "عيد الشهداء": "Martyrs' Day",
    "عيد الجمهورية": "Republic Day",
    "عيد المرأة": "Women's Day",
    "عيد الجلاء": "Evacuation Day",
  },
};

/** Typos in the library's notes, fixed on the way through. */
const NOTE_FIXES = [
  [/\bGoverment\b/g, "Government"],
  [/\bindusty\b/g, "industry"],
  [/\bBirtday\b/g, "Birthday"],
];

/**
 * Notes with which the library marks a "public" day as off for one group only
 * (women, Muslims, the armed forces). That is "optional" in this app's terms:
 * shops and offices stay open for everyone else.
 */
const GROUP_ONLY = /^(?:Women|Only for women|Youth from|Children below|Military personnel|For Muslim|For all persons belonging|Orthodox)\b/;

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

function cleanName(country, name) {
  const english = ENGLISH_NAMES[country]?.[name] ?? name;
  return english.replace(/′/g, "’").replace(/\s+/g, " ").trim();
}

function cleanRegion(name, code) {
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
    for (const holiday of calendar.getHolidays(year, "en") ?? []) {
      if (!LIBRARY_KINDS.has(holiday.type)) continue;

      const first = holiday.date.slice(0, 10);
      const hours = (holiday.end.getTime() - holiday.start.getTime()) / 3_600_000;
      // Whole days, allowing for a day that a clock change makes 23 or 25
      // hours long. A holiday that starts in the evening still marks its day.
      const days = Math.max(1, Math.floor((hours + 1.5) / 24));
      const name = cleanName(country, holiday.name);
      const libraryNote = cleanNote(holiday.note);
      const kind = holiday.type === "public" && GROUP_ONLY.test(libraryNote) ? "optional" : holiday.type;
      const note = joinNotes(libraryNote, LUNAR_ISLAMIC.test(holiday.rule ?? "") ? MOON_NOTE : "");

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
  const national = dedupe(calendarEntries(new Holidays(country, OPTIONS), country, from, to));
  const nationalDaysOff = new Set(
    [...national.values()].filter((entry) => DAY_OFF.has(entry.kind)).map((entry) => entry.date),
  );

  const states = new Holidays().getStates(country, "en") ?? {};
  /** key → { entry, regions } for days off that are not national ones. */
  const regional = new Map();
  /** key → regions, for a national observance some regions take off. */
  const regionsOff = new Map();

  for (const code of Object.keys(states).sort()) {
    const region = cleanRegion(states[code], code);
    const calendar = new Holidays(country, code, OPTIONS);
    for (const entry of dedupe(calendarEntries(calendar, country, from, to)).values()) {
      if (!DAY_OFF.has(entry.kind)) continue;
      const key = entryKey(entry);
      const nationally = national.get(key);

      if (nationally) {
        if (DAY_OFF.has(nationally.kind)) continue;
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
 * The merge rule. Library entries keep one per (date, name); then each
 * supplement entry, in order, replaces whatever already has its date and name,
 * or is added. Returns the entries sorted.
 */
export function mergeEntries(library, supplements) {
  const byKey = dedupe(library);
  for (const entry of supplements) byKey.set(entryKey(entry), entry);
  return [...byKey.values()].sort(compareEntries);
}

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

    const entries = [];
    for (let year = from; year <= to; year++) {
      const listed = supplement.entries(year);
      if (!Array.isArray(listed)) {
        throw new Error(`${where}: entries(${year}) must return an array`);
      }
      for (const entry of listed) {
        if (typeof entry?.date !== "string" || !validDate(entry.date)) {
          throw new Error(`${where}: entries(${year}) has a bad date ${JSON.stringify(entry?.date)}`);
        }
        if (!(entry.kind in KIND_RANK)) {
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
    }

    return { country: supplement.country, source: supplement.source.trim(), file, entries };
  });
}

/** Every supplement in the folder, in file-name order. A missing folder is none. */
export async function loadSupplements(dir, from = FROM, to = TO) {
  let files;
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith(".mjs")).sort();
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
  const stats = { countries: [], supplements: [], nonLatin: [] };

  for (const country of countries) {
    const library = libraryCountries.includes(country) ? libraryEntries(country, from, to) : [];
    const libraryKeys = new Set(library.map(entryKey));
    const own = supplements.filter((supplement) => supplement.country === country);

    for (const supplement of own) {
      const keys = new Set(supplement.entries.map(entryKey));
      const replaced = [...keys].filter((key) => libraryKeys.has(key)).length;
      stats.supplements.push({
        file: supplement.file,
        country,
        entries: keys.size,
        replaced,
        added: keys.size - replaced,
      });
    }

    const entries = mergeEntries(
      library,
      own.flatMap((supplement) => supplement.entries),
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

  if (stats.supplements.length === 0) {
    lines.push("Supplements: none");
  } else {
    lines.push("Supplements:");
    for (const s of stats.supplements) {
      lines.push(`  ${s.file} ${s.country}: ${s.entries} entries, ${s.added} added, ${s.replaced} replaced`);
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
    lines.push(`Names not in English (${stats.nonLatin.length}): ${[...new Set(stats.nonLatin)].join("; ")}`);
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
