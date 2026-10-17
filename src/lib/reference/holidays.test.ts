import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  build,
  entryKey,
  libraryEntries,
  loadSupplements,
  mergeEntries,
  supplementEntries,
} from "../../../scripts/build-holidays.mjs";
import type { Trip } from "../domain/types";
import type { CountryHolidays } from "./holiday-data";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "holiday-data");
const KINDS = ["public", "bank", "optional", "observance", "festival"];

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
      });
    });
  });

  it("matches the committed data for a country, byte for byte", async () => {
    const { files } = await build({ countries: ["JP"] });
    expect(files.get("JP.json")).toBe(readFileSync(path.join(DATA_DIR, "JP.json"), "utf8"));
  });

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
