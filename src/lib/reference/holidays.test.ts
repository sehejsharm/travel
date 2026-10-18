import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  NAME_ALIASES,
  RULE_FIXES,
  applyDrops,
  build,
  cleanName,
  entryKey,
  finishEntries,
  isSupplementFile,
  libraryEntries,
  loadSupplements,
  lunisolarCorrectionsFor,
  lunisolarDate,
  lunisolarDisagreements,
  lunisolarMonths,
  mergeEntries,
  supplementEntries,
} from "../../../scripts/build-holidays.mjs";
import type { Trip } from "../domain/types";
import type { CountryHolidays } from "./holiday-data";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "holiday-data");
const KINDS = ["public", "bank", "optional", "observance", "festival"];
/** The lunisolar checks compute three calendars through date-holidays' rule engine. */
const SLOW = 120_000;

type Entry = { date: string; kind: string; name: string; note: string };

/** A module with nothing loaded, so each test starts from the same place. */
async function fresh() {
  vi.resetModules();
  const holidays = await import("./holidays");
  const data = await import("./holiday-data");
  return { ...holidays, HOLIDAY_LOADERS: data.HOLIDAY_LOADERS };
}

const SAMPLE: CountryHolidays = {
  from: 2026,
  to: 2050,
  entries: [
    ["2026-03-01", "observance", "Marked Day", ""],
    ["2026-03-02", "public", "Day Off", ""],
    ["2026-03-03", "bank", "Bank Day", "Banks shut"],
    ["2026-03-04", "optional", "Regional Day", "Day off in the north"],
    ["2026-03-05", "festival", "Lantern Festival", "Parades after dark"],
  ],
};

describe("holiday loader", () => {
  it("answers nothing before a country loads, then answers synchronously", async () => {
    const { holidaysBetween, holidaysLoaded, isHoliday, loadHolidays } = await fresh();

    expect(holidaysLoaded("JP")).toBe(false);
    expect(holidaysBetween("JP", "2026-01-01", "2026-12-31")).toEqual([]);
    expect(isHoliday("JP", "2026-01-01")).toBeUndefined();

    await loadHolidays(["jp"]);

    expect(holidaysLoaded("JP")).toBe(true);
    expect(holidaysBetween("JP", "2026-10-01", "2026-10-31")).toEqual([
      { date: "2026-10-12", name: "Sports Day", kind: "public" },
    ]);
    expect(holidaysBetween("JP", "2026-10-14", "2026-10-22")).toEqual([]);
    expect(isHoliday("jp", "2026-01-01T09:00:00+09:00")?.name).toBe("New Year's Day");
  });

  it("keeps days off apart from everything else", async () => {
    const { festivalsBetween, holidaysBetween, isHoliday, primeHolidays } = await fresh();
    primeHolidays("ZZ", SAMPLE);

    expect(holidaysBetween("ZZ", "2026-03-01", "2026-03-31")).toEqual([
      { date: "2026-03-02", name: "Day Off", kind: "public" },
      { date: "2026-03-03", name: "Bank Day", kind: "bank", note: "Banks shut" },
    ]);
    expect(festivalsBetween("ZZ", "2026-03-01", "2026-03-31").map((h) => h.kind)).toEqual([
      "observance",
      "public",
      "bank",
      "optional",
      "festival",
    ]);
    expect(festivalsBetween("ZZ", "2026-03-05", "2026-03-05")[0]).toEqual({
      date: "2026-03-05",
      name: "Lantern Festival",
      kind: "festival",
      note: "Parades after dark",
    });
    // An empty note is no note.
    expect("note" in festivalsBetween("ZZ", "2026-03-01", "2026-03-01")[0]).toBe(false);

    expect(isHoliday("ZZ", "2026-03-02")?.name).toBe("Day Off");
    expect(isHoliday("ZZ", "2026-03-01")).toBeUndefined();
    expect(isHoliday("ZZ", "2026-03-05")).toBeUndefined();
  });

  it("includes both ends of a range, and ignores times of day", async () => {
    const { festivalsBetween, holidaysBetween, primeHolidays } = await fresh();
    primeHolidays("ZZ", SAMPLE);

    expect(festivalsBetween("ZZ", "2026-03-02", "2026-03-04").map((h) => h.date)).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
    ]);
    expect(
      holidaysBetween("ZZ", "2026-03-02T23:30:00+09:00", "2026-03-03T00:10:00-05:00").map((h) => h.date),
    ).toEqual(["2026-03-02", "2026-03-03"]);
    expect(festivalsBetween("ZZ", "2026-03-06", "2026-12-31")).toEqual([]);
    expect(festivalsBetween("ZZ", "2026-03-04", "2026-03-02")).toEqual([]);
  });

  it("sorts primed data that arrives out of order", async () => {
    const { festivalsBetween, primeHolidays } = await fresh();
    primeHolidays("ZZ", { ...SAMPLE, entries: [...SAMPLE.entries].reverse() });

    expect(festivalsBetween("ZZ", "2026-01-01", "2026-12-31").map((h) => h.date)).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
  });

  it("resolves an unknown country to nothing, without throwing", async () => {
    const { festivalsBetween, holidaysBetween, holidaysLoaded, holidaysVersion, isHoliday, loadHolidays } =
      await fresh();
    const before = holidaysVersion();

    await expect(loadHolidays(["XX", "", "toString", "__proto__", "constructor"])).resolves.toBeUndefined();

    expect(holidaysBetween("XX", "2026-01-01", "2050-12-31")).toEqual([]);
    expect(festivalsBetween("XX", "2026-01-01", "2050-12-31")).toEqual([]);
    expect(isHoliday("XX", "2026-01-01")).toBeUndefined();
    // Nothing will ever arrive for it, so nothing should wait on it.
    expect(holidaysLoaded("XX")).toBe(true);
    expect(holidaysVersion()).toBe(before);
  });

  it("bumps the version and tells subscribers when data arrives", async () => {
    const { holidaysVersion, loadHolidays, primeHolidays, subscribeHolidays } = await fresh();
    const listener = vi.fn();
    const unsubscribe = subscribeHolidays(listener);
    const start = holidaysVersion();

    await loadHolidays(["GB"]);
    expect(holidaysVersion()).toBe(start + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    // Already loaded: nothing to fetch, nothing to tell.
    await loadHolidays(["GB", "gb"]);
    expect(holidaysVersion()).toBe(start + 1);

    // Two callers asking at once share one fetch.
    await Promise.all([loadHolidays(["FR"]), loadHolidays(["FR", "DE"])]);
    expect(holidaysVersion()).toBe(start + 3);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    primeHolidays("ZZ", SAMPLE);
    expect(holidaysVersion()).toBe(start + 4);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("leaves a country that fails to load unloaded, and tries again next time", async () => {
    const { HOLIDAY_LOADERS, holidaysBetween, holidaysLoaded, holidaysVersion, loadHolidays } = await fresh();
    const loader = vi.spyOn(HOLIDAY_LOADERS, "TH").mockRejectedValueOnce(new Error("offline"));
    const before = holidaysVersion();

    await expect(loadHolidays(["TH"])).resolves.toBeUndefined();
    expect(holidaysLoaded("TH")).toBe(false);
    expect(holidaysVersion()).toBe(before);

    await loadHolidays(["TH"]);
    expect(holidaysLoaded("TH")).toBe(true);
    expect(holidaysBetween("TH", "2026-04-13", "2026-04-15").map((h) => h.name)).toEqual([
      "Songkran Festival",
      "Songkran Festival",
      "Songkran Festival",
    ]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("feeds the public-holiday check once the country is in", async () => {
    vi.resetModules();
    const { loadHolidays } = await import("./holidays");
    const { publicHolidays } = await import("../rules/openings");
    const trip: Trip = {
      id: "trip",
      name: "Japan, autumn",
      homeCountry: "IN",
      startDate: "2026-10-10",
      endDate: "2026-10-16",
      destinationCountries: ["JP"],
      travelers: [],
    };
    const ctx = { trip, items: [], now: new Date("2026-09-01T00:00:00Z") };

    expect(publicHolidays(ctx)).toEqual([]);

    await loadHolidays(["JP"]);
    const flags = publicHolidays(ctx);
    expect(flags).toHaveLength(1);
    expect(flags[0].title).toBe("1 public holiday during your trip");
    expect(flags[0].detail).toContain("Sports Day");
  });
});

describe("holiday generator", () => {
  const library = [
    { date: "2026-01-01", kind: "public", name: "New Year's Day", note: "" },
    { date: "2026-01-02", kind: "bank", name: "January 2nd", note: "" },
  ];

  it("lets a supplement entry replace the library's for the same day and name", () => {
    const merged = mergeEntries(library, [
      // Same holiday, written differently: it replaces the library's.
      { date: "2026-01-01", kind: "public", name: "New Year’s day", note: "Everything shuts" },
      // Same name on another day: added, not a replacement.
      { date: "2026-01-03", kind: "festival", name: "New Year's Day", note: "" },
    ]);

    expect(merged).toEqual([
      { date: "2026-01-01", kind: "public", name: "New Year’s day", note: "Everything shuts" },
      { date: "2026-01-02", kind: "bank", name: "January 2nd", note: "" },
      { date: "2026-01-03", kind: "festival", name: "New Year's Day", note: "" },
    ]);
  });

  it("keeps one entry per day and name, and the later supplement wins", () => {
    const merged = mergeEntries(
      [...library, { date: "2026-01-01", kind: "observance", name: "New Year's Day", note: "" }],
      [
        { date: "2026-01-02", kind: "public", name: "January 2nd", note: "first" },
        { date: "2026-01-02", kind: "public", name: "January 2nd", note: "second" },
      ],
    );

    expect(merged.map((entry: { date: string; kind: string; note: string }) => [entry.date, entry.kind, entry.note])).toEqual([
      ["2026-01-01", "public", ""],
      ["2026-01-02", "public", "second"],
    ]);
    expect(new Set(merged.map(entryKey)).size).toBe(merged.length);
  });

  it("rejects a malformed supplement with the file named", () => {
    const valid = { country: "IN", source: "Somewhere, https://example.org", entries: () => [] };

    expect(() => supplementEntries({}, "bad.mjs")).toThrow(/bad\.mjs/);
    expect(() => supplementEntries([{ ...valid, country: "in" }], "bad.mjs")).toThrow(/country/);
    expect(() => supplementEntries([{ ...valid, source: "" }], "bad.mjs")).toThrow(/source/);
    expect(() =>
      supplementEntries([{ ...valid, entries: () => [{ date: "2026-02-30", kind: "public", name: "X" }] }], "bad.mjs"),
    ).toThrow(/bad date/);
    expect(() =>
      supplementEntries([{ ...valid, entries: () => [{ date: "2026-02-01", kind: "holiday", name: "X" }] }], "bad.mjs"),
    ).toThrow(/unknown kind/);
    // A name every object inherits is not a kind either.
    for (const kind of ["constructor", "toString", "__proto__"]) {
      expect(() =>
        supplementEntries([{ ...valid, entries: () => [{ date: "2026-02-01", kind, name: "X" }] }], "bad.mjs"),
      ).toThrow(/unknown kind/);
    }
    expect(() => supplementEntries([{ ...valid, finish: "later" }], "bad.mjs")).toThrow(/finish/);
  });

  it("finishes a country on its merged entries, checking what comes back", () => {
    const [supplement] = supplementEntries(
      [
        {
          country: "IN",
          source: "Somewhere, https://example.org",
          entries: (year: number) => (year === 2026 ? [{ date: "2026-03-01", kind: "public", name: "Sunday Day" }] : []),
          finish: (entries: Entry[]) => [
            ...entries,
            ...entries.filter((e) => e.name === "Sunday Day").map((e) => ({ ...e, date: "2026-03-02", name: "Sunday Day (substitute day)" })),
          ],
        },
      ],
      "fin.mjs",
    );
    const merged = mergeEntries([], supplement.entries);
    expect(finishEntries(merged, [supplement]).map((e: Entry) => `${e.date} ${e.name}`)).toEqual([
      "2026-03-01 Sunday Day",
      "2026-03-02 Sunday Day (substitute day)",
    ]);
    const [bad] = supplementEntries(
      [{ country: "IN", source: "Somewhere, https://example.org", entries: () => [], finish: () => [{ date: "2026-13-01", kind: "public", name: "X" }] }],
      "fin.mjs",
    );
    expect(() => finishEntries([], [bad])).toThrow(/fin\.mjs \[0\]: finish has a bad date/);
  });

  it("rejects a malformed drop rule with the file named", () => {
    const valid = { country: "LK", source: "Somewhere, https://example.org", entries: () => [] };
    const bad = (drop: unknown) => () => supplementEntries([{ ...valid, drop }], "bad.mjs");

    expect(bad({ name: "X" })).toThrow(/bad\.mjs \[0\]: drop must be an array/);
    expect(bad(["X"])).toThrow(/bad\.mjs \[0\]: drop\[0\] must be an object/);
    expect(bad([{ name: "X", year: 2027 }])).toThrow(/unknown field "year"/);
    expect(bad([{ from: 2027 }])).toThrow(/name must be/);
    expect(bad([{ name: "  " }])).toThrow(/name must be/);
    expect(bad([{ name: "X", from: 2027.5 }])).toThrow(/from must be a whole year/);
    expect(bad([{ name: "X", from: 2030, to: 2027 }])).toThrow(/from 2030 is after to 2027/);
    expect(bad([{ name: "X", dates: ["13-01"] }])).toThrow(/"13-01" is not an "MM-DD" month-day/);
    expect(bad([{ name: "X", dates: [] }])).toThrow(/dates must be a list/);
    expect(bad([{ name: "X", note: "Kerala" }])).toThrow(/note must be a RegExp/);
    expect(bad([{ name: /X/, dates: ["02-29"], note: /Kerala/, from: 2028, to: 2028 }])).not.toThrow();
  });

  it("drops library entries by name, years, month-days and note", () => {
    const library: Entry[] = [
      { date: "2026-11-08", kind: "public", name: "Deepavali Festival Day", note: "" },
      { date: "2027-11-08", kind: "public", name: "Deepavali Festival Day", note: "" },
      { date: "2026-05-01", kind: "public", name: "Vesak Full Moon Poya Day", note: "" },
      { date: "2027-05-01", kind: "public", name: "Vesak Full Moon Poya Day", note: "" },
      { date: "2026-04-14", kind: "optional", name: "Vaisakhi", note: "Day off in Kerala" },
      { date: "2026-04-14", kind: "optional", name: "Vaisakhi", note: "Day off in Punjab" },
      { date: "2026-06-29", kind: "public", name: "Poson Full Moon Poya Day", note: "" },
    ];
    const [supplement] = supplementEntries(
      [
        {
          country: "LK",
          source: "Somewhere, https://example.org",
          drop: [
            // Matched as names are: case and punctuation do not matter.
            { name: "deepavali festival-day", from: 2027 },
            { name: /Full Moon Poya Day$/, dates: ["05-01"] },
            { name: "Vaisakhi", note: /Kerala/ },
          ],
          entries: () => [],
        },
      ],
      "lk.mjs",
    );
    const kept = applyDrops("LK", library, [supplement]);

    expect(kept.map((entry: Entry) => `${entry.date} ${entry.name} ${entry.note}`.trim())).toEqual([
      "2026-11-08 Deepavali Festival Day",
      "2026-04-14 Vaisakhi Day off in Punjab",
      "2026-06-29 Poson Full Moon Poya Day",
    ]);
    expect(supplement.dropped).toBe(4);
  });

  it("drops nothing a supplement adds, and checks each rule against the library", () => {
    const [supplement] = supplementEntries(
      [
        {
          country: "LK",
          source: "Somewhere, https://example.org",
          drop: [{ name: "Own Day" }],
          entries: (year: number) => [{ date: `${year}-03-03`, kind: "public", name: "Own Day" }],
        },
      ],
      "own.mjs",
    );
    expect(() => applyDrops("LK", [], [supplement])).toThrow(/own\.mjs LK: drop \{ name: "Own Day" \} matches no/);
    // A rule whose years are outside the build's is not checked.
    const [later] = supplementEntries(
      [{ country: "LK", source: "Somewhere", drop: [{ name: "Gone", from: 2040 }], entries: () => [] }],
      "later.mjs",
      2026,
      2030,
    );
    expect(applyDrops("LK", [], [later], 2026, 2030)).toEqual([]);
  });

  it("matches a drop rule under a library name the generator aliases", () => {
    const [supplement] = supplementEntries(
      [{ country: "US", source: "Somewhere", drop: [{ name: "Day after Thanksgiving Day" }], entries: () => [] }],
      "us.mjs",
    );
    const library = [{ date: "2026-11-27", kind: "optional", name: "Day After Thanksgiving", note: "" }];
    expect(applyDrops("US", library, [supplement])).toEqual([]);
  });

  it("loads only supplement modules from the folder", () => {
    expect(isSupplementFile("india.mjs")).toBe(true);
    expect(isSupplementFile("_shared.mjs")).toBe(false);
    expect(isSupplementFile("thai.test.mjs")).toBe(false);
    expect(isSupplementFile("README.md")).toBe(false);
  });

  it("calls a supplement for every year and drops dates outside the range", () => {
    const years: number[] = [];
    const [supplement] = supplementEntries(
      [
        {
          country: "IN",
          source: "Somewhere, https://example.org",
          entries: (year: number) => {
            years.push(year);
            return [
              { date: `${year}-11-01`, kind: "festival", name: "  Lights  Festival ", note: "In the evening" },
              { date: `${year + 30}-01-01`, kind: "festival", name: "Far Away" },
            ];
          },
        },
      ],
      "in.mjs",
    );

    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(2050);
    expect(supplement.entries).toHaveLength(25);
    expect(supplement.entries[0]).toEqual({
      date: "2026-11-01",
      kind: "festival",
      name: "Lights Festival",
      note: "In the evening",
    });
  });

  it("builds with no supplements folder at all", async () => {
    await expect(loadSupplements(path.join(tmpdir(), "no-such-holiday-supplements"))).resolves.toEqual([]);
  });

  describe("with supplements on disk", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "holiday-supplements-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    writeFileSync(
      path.join(dir, "a-jp.mjs"),
      `export default [{
        country: "JP",
        source: "Test source, https://example.org/jp",
        drop: [
          { name: "Sports Day", from: 2027, to: 2027 },
          { name: /^Marine Day$/, dates: ["07-20"], to: 2026 },
        ],
        entries: (year) => year === 2026 ? [
          { date: "2026-01-01", name: "New Year's Day", kind: "public", note: "Corrected by a supplement" },
          { date: "2026-07-07", name: "Tanabata", kind: "festival" },
        ] : [],
      }, {
        country: "ZZ",
        source: "Test source, https://example.org/zz",
        entries: (year) => [{ date: year + "-05-05", name: "Only Here", kind: "public" }],
      }];\n`,
    );
    writeFileSync(path.join(dir, "README.md"), "Not a module.\n");
    // Neither is loaded: one is a helper, the other a test.
    writeFileSync(path.join(dir, "_shared.mjs"), `throw new Error("a helper was loaded as a supplement");\n`);
    writeFileSync(path.join(dir, "a-jp.test.mjs"), `throw new Error("a test was loaded as a supplement");\n`);

    it("merges them into the country files, the index and the sources", async () => {
      const { files, stats } = await build({ supplementsDir: dir, countries: ["JP", "ZZ"] });
      const jp = JSON.parse(files.get("JP.json")!) as CountryHolidays;
      const zz = JSON.parse(files.get("ZZ.json")!) as CountryHolidays;

      const newYear = jp.entries.filter(([date]) => date === "2026-01-01");
      expect(newYear).toEqual([["2026-01-01", "public", "New Year's Day", "Corrected by a supplement"]]);
      expect(jp.entries).toContainEqual(["2026-07-07", "festival", "Tanabata", ""]);
      expect(jp.entries.filter(([date]) => date === "2027-01-01")).toEqual([
        ["2027-01-01", "public", "New Year's Day", ""],
      ]);

      // A country the library does not know gets a file from its supplement alone.
      expect(zz.entries).toHaveLength(25);
      expect(files.get("index.ts")).toContain('ZZ: () => load(import("./ZZ.json")),');
      expect(files.get("sources.ts")).toContain("Test source, https://example.org/zz");
      expect(stats.supplements).toContainEqual({
        file: "a-jp.mjs",
        country: "JP",
        entries: 2,
        replaced: 1,
        added: 1,
        dropped: 2,
      });

      // Dropped from the library for the years and days named, and only those.
      expect(jp.entries.filter(([, , name]) => name === "Sports Day").map(([date]) => date.slice(0, 4))).not.toContain("2027");
      expect(jp.entries).toContainEqual(["2026-10-12", "public", "Sports Day", ""]);
      expect(jp.entries.some(([date, , name]) => date === "2026-07-20" && name === "Marine Day")).toBe(false);
      expect(jp.entries.some(([date, , name]) => date === "2027-07-19" && name === "Marine Day")).toBe(true);
    });
  });

  describe("with a drop rule that matches nothing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "holiday-supplements-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(
      path.join(dir, "b-jp.mjs"),
      `export default [{
        country: "JP",
        source: "Test source, https://example.org/jp",
        drop: [{ name: "No Such Holiday", from: 2030 }],
        entries: () => [],
      }];\n`,
    );

    it("stops the build, naming the file and the rule", async () => {
      await expect(build({ supplementsDir: dir, countries: ["JP"] })).rejects.toThrow(
        /b-jp\.mjs JP: drop \{ name: "No Such Holiday", from: 2030 \} matches no date-holidays entry/,
      );
    });
  });

  it("matches the committed data, byte for byte, for a country of every supplement", async () => {
    // Loading every supplement takes several seconds (the Indian and diaspora
    // almanacs compute every year at import), so this gets a long timeout.
    // One country for each supplement file at least, so a supplement changed
    // without regenerating the data fails here, not only in holidays:check.
    const countries = ["AE", "FJ", "ID", "IN", "JP", "LK", "MU", "NP", "TH", "WS"];
    const { files, supplements } = await build({ countries });
    const covered = new Set(supplements.filter((s: { country: string }) => countries.includes(s.country)).map((s: { file: string }) => s.file));
    expect([...new Set(supplements.map((s: { file: string }) => s.file))].filter((file) => !covered.has(file))).toEqual([]);
    for (const country of countries) {
      expect(files.get(`${country}.json`), country).toBe(readFileSync(path.join(DATA_DIR, `${country}.json`), "utf8"));
    }
  }, 120_000);

  it("marks a state's own day off as optional, saying where", () => {
    const entries = libraryEntries("GB", 2026, 2026);
    expect(entries).toContainEqual({
      date: "2026-11-30",
      kind: "optional",
      name: "St Andrew’s Day",
      note: "Day off in Scotland",
    });
    // A national day off is not repeated under a state's name.
    expect(entries.filter((entry: { date: string }) => entry.date === "2026-12-25")).toHaveLength(1);
  });
});

describe("holiday generator corrections", () => {
  it("merges one holiday's two library names on a day", () => {
    expect(cleanName("US", "Day after Thanksgiving Day")).toBe("Day After Thanksgiving");
    expect(cleanName("VN", "Vietnamese New Year Holidays")).toBe("Vietnamese New Year");
    expect(cleanName("GB", "Day after Thanksgiving Day")).toBe("Day after Thanksgiving Day");
    expect(Object.keys(NAME_ALIASES).sort()).toEqual(["RU", "US", "VN"]);
    // Ingushetia's names for the Eids, and Irkutsk's for Radonitsa.
    expect(cleanName("RU", "Eid al-Fitr (Markhash)")).toBe("Uraza-Bayram");
    expect(cleanName("RU", "Eid al-Adha (Ghurba)")).toBe("Kurban-Bayram");
    expect(cleanName("RU", "Unity Day of Remembrance")).toBe("Day of Remembrance of the Departed (Radonitsa)");

    const us = libraryEntries("US", 2026, 2026).filter((entry: Entry) => entry.date === "2026-11-27");
    const after = us.filter((entry: Entry) => /Thanksgiving/.test(entry.name));
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe("Day After Thanksgiving");
    expect(after[0].note).toMatch(/^Day off in California, Delaware, /);

    const vn = libraryEntries("VN", 2026, 2026).filter((entry: Entry) => entry.date.startsWith("2026-02"));
    expect(vn.filter((entry: Entry) => /New Year/.test(entry.name)).map((entry: Entry) => [entry.date, entry.name])).toEqual([
      ["2026-02-16", "Vietnamese New Year"],
      ["2026-02-17", "Vietnamese New Year"],
      ["2026-02-18", "Vietnamese New Year"],
      ["2026-02-19", "Vietnamese New Year"],
      ["2026-02-20", "Vietnamese New Year"],
    ]);
  });

  it("gives the library's untranslated and wrong names in English, substitutes included", () => {
    expect(cleanName("CH", "Bundesfeiertag")).toBe("Swiss National Day");
    expect(cleanName("AT", "Staatsfeiertag")).toBe("Labour Day");
    expect(cleanName("LI", "Staatsfeiertag")).toBe("National Day");
    expect(cleanName("PT", "Implantação da República")).toBe("Republic Day");
    expect(cleanName("PA", "Separation Day (from Columbia) (substitute day)")).toBe("Separation Day (from Colombia) (substitute day)");
    expect(cleanName("BO", "Andean Amazonic Chacoan New Year (substitutes)")).toBe("Andean Amazonian Chaqueño New Year (substitute day)");
    expect(cleanName("GI", "Queen's Birthday")).toBe("King's Birthday");
    expect(cleanName("IR", "Holyday for Fetr Eeid")).toBe("Eid al-Fitr (second day)");
    // Other countries keep their own names.
    expect(cleanName("GB", "Staatsfeiertag")).toBe("Staatsfeiertag");
  });

  it("notes a national day off that some states do not keep", { timeout: SLOW }, () => {
    const my = libraryEntries("MY", 2026, 2026) as Entry[];
    expect(my.find((e) => e.name === "Day of Nuzul Al-Quran")).toMatchObject({
      kind: "optional",
      note: expect.stringMatching(/^Not a day off in Johor, Kedah, Malacca, Negeri Sembilan, Sabah and Sarawak\. Islamic/),
    });
    expect(my.find((e) => e.date === "2026-01-01" && e.name === "New Year's Day")).toMatchObject({
      kind: "public",
      note: "Not a day off in Johor, Kedah, Kelantan, Perlis and Terengganu",
    });
    // A one-off substitute date in the library gets the suffix.
    expect(my.find((e) => e.date === "2026-11-09")?.name).toBe("Deepavali (substitute day)");
    const gb = libraryEntries("GB", 2026, 2026) as Entry[];
    expect(gb.find((e) => e.name === "Easter Monday")?.note).toBe("Not a day off in Scotland");
    // A region that moves a weekend holiday to the Monday still keeps it.
    const au = libraryEntries("AU", 2027, 2027) as Entry[];
    expect(au.find((e) => e.date === "2027-12-25")?.note).toBe("");
  });

  it("names Crimea's regions as occupied, and its 18 March days as Russia's", { timeout: SLOW }, () => {
    const ru = libraryEntries("RU", 2026, 2026) as Entry[];
    expect(ru.find((e) => e.name === "Day of the Reunification of Crimea with Russia")?.note).toMatch(
      /^Day off in Crimea \(Russian-occupied\)\. Russia's name for the day\. The annexation is not recognised/,
    );
    expect(ru.filter((e) => e.date === "2026-03-20").map((e) => e.name)).toEqual(["Uraza-Bayram"]);
    expect(ru.filter((e) => e.date === "2026-04-21").map((e) => e.name)).toEqual(["Day of Remembrance of the Departed (Radonitsa)"]);
  });

  it("fixes Kazakhstan's Nauryz substitutes, Kenya's Mazingira Day, Nigeria's kinds and St Helena's King's Birthday", () => {
    const kz = libraryEntries("KZ", 2026, 2027) as Entry[];
    const nauryz = (year: number) => [...new Set(kz.filter((e) => /^Nauryz/.test(e.name) && e.date.startsWith(`${year}-`)).map((e) => e.date))];
    expect(nauryz(2026)).toEqual(["2026-03-21", "2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25"]);
    expect(nauryz(2027)).toEqual(["2027-03-21", "2027-03-22", "2027-03-23", "2027-03-24"]);
    const ke = libraryEntries("KE", 2027, 2027) as Entry[];
    expect(ke.filter((e) => /Mazingira/.test(e.name)).map((e) => `${e.date} ${e.name}`)).toEqual([
      "2027-10-10 Mazingira Day",
      "2027-10-11 Mazingira Day (substitute day)",
    ]);
    expect(ke.some((e) => /Moi Day/.test(e.name))).toBe(false);
    const ng = libraryEntries("NG", 2026, 2026) as Entry[];
    expect(ng.find((e) => e.name === "Children's Day")?.kind).toBe("observance");
    expect(ng.find((e) => e.name === "National Youth Day")?.kind).toBe("observance");
    expect(ng.find((e) => e.name === "Islamic New Year")?.kind).toBe("optional");
    const sh = libraryEntries("SH", 2026, 2026) as Entry[];
    expect(sh.filter((e) => /Birthday/.test(e.name)).map((e) => `${e.date} ${e.name}`)).toEqual(["2026-11-13 King's Birthday"]);
    expect(Object.keys(RULE_FIXES).sort()).toEqual(["CN", "KE", "KR", "KZ", "NG", "SH", "TW"]);
  });

  it("starts Korean New Year the day before Seollal, keeping the substitute days", { timeout: SLOW }, () => {
    const kr = libraryEntries("KR", 2026, 2030).filter((entry: Entry) => entry.name.startsWith("Korean New Year"));
    expect(kr.map((entry: Entry) => `${entry.date} ${entry.name}`)).toEqual([
      "2026-02-16 Korean New Year",
      "2026-02-17 Korean New Year",
      "2026-02-18 Korean New Year",
      "2027-02-06 Korean New Year",
      "2027-02-07 Korean New Year",
      "2027-02-08 Korean New Year",
      "2027-02-09 Korean New Year (substitute day)",
      "2028-01-26 Korean New Year",
      "2028-01-27 Korean New Year",
      "2028-01-28 Korean New Year",
      "2029-02-12 Korean New Year",
      "2029-02-13 Korean New Year",
      "2029-02-14 Korean New Year",
      "2030-02-02 Korean New Year",
      "2030-02-03 Korean New Year",
      "2030-02-04 Korean New Year",
      "2030-02-05 Korean New Year (substitute day)",
    ]);
  });

  it("gives Taiwan the day before New Year's Eve and its make-up days", { timeout: SLOW }, () => {
    const tw = libraryEntries("TW", 2026, 2027).filter(
      (entry: Entry) => entry.kind === "public" && /New Year/.test(entry.name) && entry.date.slice(5, 7) === "02",
    );
    expect(tw.map((entry: Entry) => `${entry.date} ${entry.name}`)).toEqual([
      "2026-02-15 Day before Chinese New Year's Eve",
      "2026-02-16 Chinese New Year's Eve",
      "2026-02-17 Chinese New Year",
      "2026-02-18 The second day of the Chinese New Year",
      "2026-02-19 The third day of the Chinese New Year",
      "2026-02-20 Chinese New Year (substitute day)",
      "2027-02-04 Day before Chinese New Year's Eve",
      "2027-02-05 Chinese New Year's Eve",
      "2027-02-06 Chinese New Year",
      "2027-02-07 The second day of the Chinese New Year",
      "2027-02-08 The third day of the Chinese New Year",
      "2027-02-09 Chinese New Year (substitute day)",
      "2027-02-10 Chinese New Year (substitute day)",
    ]);
  });

  it("stops the build when a rule it fixes is gone from the library", () => {
    RULE_FIXES.KR.remove.push("korean 12-0-99 no such rule");
    try {
      expect(() => libraryEntries("KR", 2026, 2026)).toThrow(/RULE_FIXES KR: date-holidays has no rule "korean 12-0-99/);
    } finally {
      RULE_FIXES.KR.remove.pop();
    }
  });

  it("computes the lunisolar calendars' leap months", { timeout: SLOW }, () => {
    const leaps = (kind: string) =>
      lunisolarMonths(kind)
        .filter((month: { leap: boolean }) => month.leap)
        .map((month: { lunarYear: number; month: number; start: string }) => `${month.lunarYear} ${month.month} ${month.start}`);
    // 2023 and 2025 as published; 2033's after month 11, not 7.
    expect(leaps("chinese")).toEqual(expect.arrayContaining(["2023 2 2023-03-22", "2025 6 2025-07-25", "2033 11 2033-12-22"]));
    expect(leaps("chinese").filter((leap: string) => leap.startsWith("2033"))).toEqual(["2033 11 2033-12-22"]);
    expect(leaps("korean").filter((leap: string) => leap.startsWith("2033"))).toEqual(["2033 11 2033-12-22"]);
    expect(leaps("vietnamese").filter((leap: string) => leap.startsWith("2033"))).toEqual(["2033 11 2033-12-22"]);
  });

  it("finds date-holidays' months wrong only in 2033", { timeout: SLOW }, () => {
    const rows = lunisolarDisagreements(2025, 2051).map(
      (d: { kind: string; lunarYear: number; month: number; leap: boolean; library?: string; true?: string }) =>
        `${d.kind} ${d.lunarYear} ${d.leap ? "leap " : ""}${d.month}: ${d.library ?? "none"} not ${d.true ?? "none"}`,
    );
    const chineseLike = (kind: string) => [
      `${kind} 2033 leap 7: 2033-08-25 not none`,
      `${kind} 2033 8: 2033-09-23 not 2033-08-25`,
      `${kind} 2033 9: 2033-10-23 not 2033-09-23`,
      `${kind} 2033 10: 2033-11-22 not 2033-10-23`,
      `${kind} 2033 11: 2034-01-20 not 2033-11-22`,
      `${kind} 2033 leap 11: none not 2033-12-22`,
    ];
    expect(rows).toEqual([
      ...chineseLike("chinese"),
      ...chineseLike("korean"),
      "vietnamese 2033 leap 8: 2033-09-23 not none",
      "vietnamese 2033 9: 2033-10-23 not 2033-09-23",
      "vietnamese 2033 10: 2033-11-22 not 2033-10-23",
      "vietnamese 2033 11: 2034-01-20 not 2033-11-22",
      "vietnamese 2033 leap 11: none not 2033-12-22",
    ]);
  });

  it("keeps each calendar at its own UTC offset", { timeout: SLOW }, () => {
    // New Year 2027: the new moon is 6 February 23:56 in Beijing, so the 6th
    // at UTC+8 and UTC+7, and the 7th at UTC+9.
    expect(lunisolarDate("chinese", 2027, 1, 1)).toBe("2027-02-06");
    expect(lunisolarDate("vietnamese", 2027, 1, 1)).toBe("2027-02-06");
    expect(lunisolarDate("korean", 2027, 1, 1)).toBe("2027-02-07");
    expect(lunisolarDate("vietnamese", 2027, 1, 0)).toBe("2027-02-05");
    // A month that starts a day earlier in Vietnam than in China (22 April).
    expect(lunisolarDate("vietnamese", 2031, 3, 1, true)).toBe("2031-04-21");
    expect(lunisolarDate("chinese", 2031, 3, 1, true)).toBe("2031-04-22");
    expect(lunisolarDate("chinese", 2033, 8, 15)).toBe("2033-09-08");
    expect(lunisolarDate("chinese", 2026, 1, 1)).toBe("2026-02-17");
    expect(lunisolarDate("chinese", 2060, 1, 1)).toBeUndefined();
  });

  it("moves the library's days that land on the wrong date", { timeout: SLOW }, () => {
    const moved = lunisolarCorrectionsFor("CN").map(
      (m: { rule: string; library: string; true: string }) => `${m.rule} ${m.library} -> ${m.true}`,
    );
    expect(moved).toEqual(["chinese 08-0-15 2033-10-07 -> 2033-09-08", "chinese 08-0-15 2039-10-01 -> 2039-10-02"]);

    const hk = libraryEntries("HK", 2033, 2033).filter((entry: Entry) => /Mid-Autumn|Chung Yeung/.test(entry.name));
    expect(hk.map((entry: Entry) => `${entry.date} ${entry.name}`)).toEqual([
      "2033-09-09 The day following the Chinese Mid-Autumn Festival",
      "2033-10-01 Chung Yeung Festival",
    ]);
    const kr = libraryEntries("KR", 2033, 2033).filter((entry: Entry) => entry.name === "Korean Thanksgiving");
    expect(kr.map((entry: Entry) => entry.date)).toEqual(["2033-09-07", "2033-09-08", "2033-09-09"]);
  });
});

describe("holiday coverage", () => {
  const files = readdirSync(DATA_DIR).filter((file) => file.endsWith(".json")).sort();
  const countries = files.map((file) => file.replace(/\.json$/, ""));
  const read = (country: string) =>
    JSON.parse(readFileSync(path.join(DATA_DIR, `${country}.json`), "utf8")) as CountryHolidays;

  it("has a file for every country date-holidays knows, and a loader for each", async () => {
    const { HOLIDAY_LOADERS } = await import("./holiday-data");
    expect(countries.length).toBeGreaterThanOrEqual(200);
    expect(Object.keys(HOLIDAY_LOADERS).sort()).toEqual(countries);
  });

  it("spans 2026 to 2050 in every country, with a day off in every year", () => {
    const problems: string[] = [];

    for (const country of countries) {
      const data = read(country);
      if (data.from !== 2026 || data.to !== 2050) problems.push(`${country} covers ${data.from}-${data.to}`);

      const years = new Set<number>();
      const keys = new Set<string>();
      let previous = "";
      for (const [date, kind, name, note] of data.entries) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(`${country} ${date} is not a date`);
        if (date < previous) problems.push(`${country} ${date} is out of order`);
        if (date < "2026-01-01" || date > "2050-12-31") problems.push(`${country} ${date} is out of range`);
        if (!KINDS.includes(kind)) problems.push(`${country} ${date} has kind ${kind}`);
        if (name.trim() === "") problems.push(`${country} ${date} has no name`);
        if (typeof note !== "string") problems.push(`${country} ${date} has a note that is not text`);

        const key = entryKey({ date, kind, name });
        if (keys.has(key)) problems.push(`${country} ${date} repeats ${name}`);
        keys.add(key);

        if (kind === "public" || kind === "bank") years.add(Number(date.slice(0, 4)));
        previous = date;
      }

      if (!data.entries.some(([date]) => date.startsWith("2026-"))) problems.push(`${country} has nothing in 2026`);
      if (!data.entries.some(([date]) => date.startsWith("2050-"))) problems.push(`${country} has nothing in 2050`);
      for (let year = 2026; year <= 2050; year++) {
        if (!years.has(year)) problems.push(`${country} has no day off in ${year}`);
      }
    }

    expect(problems).toEqual([]);
  });

  it("has New Year's Day as a day off in every year in JP, US, GB and FR", () => {
    for (const country of ["JP", "US", "GB", "FR"]) {
      const data = read(country);
      for (let year = 2026; year <= 2050; year++) {
        expect(
          data.entries.some(
            ([date, kind, name]) => date === `${year}-01-01` && kind === "public" && /new year/i.test(name),
          ),
          `${country} ${year}`,
        ).toBe(true);
      }
    }
  });
});
