import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { supplementEntries } from "../../../scripts/build-holidays.mjs";
import supplements, {
  malaysiaSundaySubstitutes,
  usDayAfterThanksgiving,
} from "../../../scripts/holiday-supplements/library-fixes.mjs";
import type { CountryHolidays, HolidayEntry } from "./holiday-data";

/**
 * Corrections to date-holidays' own data (scripts/holiday-supplements/
 * library-fixes.mjs). The finishing rules are checked on small lists, and the
 * results on the generated data, which the build keeps in step.
 */

type Entry = { date: string; name: string; kind: string; note: string };

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "holiday-data");
const FROM = 2026;
const TO = 2050;

const cache = new Map<string, HolidayEntry[]>();
function data(country: string): HolidayEntry[] {
  let list = cache.get(country);
  if (!list) {
    list = (JSON.parse(readFileSync(path.join(DATA_DIR, `${country}.json`), "utf8")) as CountryHolidays).entries;
    cache.set(country, list);
  }
  return list;
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const find = (country: string, date: string, name: string) =>
  data(country).find(([day, , other]) => day === date && other === name);

describe("library-fixes supplement", () => {
  it("loads, with a source for each country", () => {
    const loaded = supplementEntries(supplements, "library-fixes.mjs") as { country: string; source: string }[];
    expect(loaded.map((s) => s.country).sort()).toEqual([
      "BR",
      "DK",
      "FO",
      "GT",
      "HU",
      "ID",
      "MY",
      "NL",
      "NO",
      "PH",
      "PL",
      "SE",
      "SJ",
      "SM",
      "US",
      "VA",
    ]);
    for (const supplement of loaded) expect(supplement.source).toMatch(/https:\/\//);
  });
});

describe("Indonesia", () => {
  it("has Easter Sunday as a national holiday every year", () => {
    for (let year = FROM; year <= TO; year++) {
      expect(data("ID").filter(([date, kind, name]) => name === "Easter Sunday" && kind === "public" && date.startsWith(`${year}-`))).toHaveLength(1);
    }
    expect(find("ID", "2027-03-28", "Easter Sunday")?.[1]).toBe("public");
  });

  it("lists the decrees' collective leave for 2026 and 2027 only", () => {
    const leave = data("ID").filter(([, , name]) => name === "Collective leave (cuti bersama)");
    // 2027: the eight days of SKB 1205, 3 and 2 of 2026, 25 March (before Good Friday) among them.
    expect(leave.map(([date, kind]) => `${date} ${kind}`)).toEqual([
      "2026-12-24 optional",
      "2027-02-05 optional",
      "2027-03-09 optional",
      "2027-03-12 optional",
      "2027-03-15 optional",
      "2027-03-25 optional",
      "2027-05-18 optional",
      "2027-05-19 optional",
      "2027-12-24 optional",
    ]);
    // Later years say collective leave is usually added around Eid al-Fitr.
    const eid2030 = data("ID").find(([date, , name]) => date.startsWith("2030-") && name === "End of Ramadan (Eid al-Fitr)");
    expect(eid2030?.[3]).toMatch(/^The government usually adds collective-leave days/);
  });
});

describe("Malaysia's Sunday substitutes", () => {
  it("puts a Sunday holiday's day off on the next day that is not a holiday", () => {
    const list: Entry[] = [
      { date: "2027-06-06", kind: "public", name: "Islamic New Year", note: "" },
      { date: "2027-06-07", kind: "public", name: "Agong's Birthday", note: "" },
      // A library substitute on another holiday is worked out again.
      { date: "2027-06-07", kind: "public", name: "Islamic New Year (substitute day)", note: "" },
      { date: "2027-06-13", kind: "optional", name: "State Day", note: "Day off in Johor" },
    ];
    const out = malaysiaSundaySubstitutes(list).map((e: Entry) => `${e.date} ${e.kind} ${e.name}`);
    expect(out).toContain("2027-06-08 public Islamic New Year (substitute day)");
    expect(out).not.toContain("2027-06-07 public Islamic New Year (substitute day)");
    // A state's own day is left to its state calendar.
    expect(out.filter((e: string) => e.includes("State Day"))).toEqual(["2027-06-13 optional State Day"]);
  });

  it("gives every Sunday federal holiday a substitute in the data", () => {
    // Published: Monday 23 March 2026 for Hari Raya's second day.
    expect(find("MY", "2026-03-23", "End of Ramadan (Eid al-Fitr) (substitute day)")?.[1]).toBe("public");
    expect(find("MY", "2027-06-08", "Islamic New Year (substitute day)")?.[1]).toBe("public");
    expect(find("MY", "2028-02-28", "End of Ramadan (Eid al-Fitr) (substitute day)")?.[1]).toBe("public");
    // 2030: Chinese New Year's Monday is its second day and Eid, so Wednesday.
    expect(find("MY", "2030-02-06", "Chinese New Year (substitute day)")?.[1]).toBe("public");

    const list = data("MY");
    const publicDays = new Set(list.filter(([, kind, name]) => kind === "public" && !name.endsWith("(substitute day)")).map(([date]) => date));
    for (const [date, kind, name] of list) {
      if (kind !== "public" || weekday(date) !== 0 || name.endsWith("(substitute day)")) continue;
      const substitute = list.find(([day, , other]) => other === `${name} (substitute day)` && day > date && day <= addDays(date, 7));
      expect(substitute, `${date} ${name}`).toBeDefined();
      expect(publicDays.has(substitute![0]), `${substitute![0]} ${name}`).toBe(false);
    }
  });
});

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

describe("the United States' day after Thanksgiving", () => {
  it("folds the states' own names into one entry", () => {
    const list: Entry[] = [
      { date: "2030-11-22", kind: "optional", name: "Family Day", note: "Day off in Nevada" },
      { date: "2030-11-29", kind: "optional", name: "Day After Thanksgiving", note: "Day off in California and Texas" },
      { date: "2030-11-29", kind: "optional", name: "State Holiday", note: "Day off in Georgia. Known as Robert E. Lee's Birthday prior to 2016" },
      { date: "2030-04-26", kind: "optional", name: "State Holiday", note: "Day off in Georgia" },
    ];
    expect(usDayAfterThanksgiving(list)).toEqual([
      {
        date: "2030-11-29",
        kind: "optional",
        name: "Day After Thanksgiving",
        note: "Day off in California, Georgia, Nevada and Texas. Called Family Day in Nevada and State Holiday in Georgia",
      },
      { date: "2030-04-26", kind: "optional", name: "State Holiday", note: "Day off in Georgia" },
    ]);
  });

  it("lists one row on the day in the data, every year", () => {
    for (let year = FROM; year <= TO; year++) {
      const late = data("US").filter(([date, kind]) => date >= `${year}-11-22` && date <= `${year}-11-30` && kind === "optional");
      expect(late.map(([, , name]) => name), `${year}`).toEqual(["Day After Thanksgiving"]);
    }
  });
});

describe("kinds and notes", () => {
  it("adds the Netherlands' Liberation Day, a day off for some", () => {
    expect(find("NL", "2026-05-05", "Liberation Day")?.[1]).toBe("optional");
  });

  it("marks Easter Sunday in the Philippines, not in the proclamation, as an observance", () => {
    expect(find("PH", "2026-04-05", "Easter Sunday")?.[1]).toBe("observance");
  });

  it("flags Denmark's Constitution Day and Christmas Eve, when banks close", () => {
    expect(find("DK", "2026-06-05", "Constitution Day")?.[1]).toBe("bank");
    expect(find("DK", "2026-12-24", "Christmas Eve")?.[1]).toBe("bank");
  });

  it("makes St Olav's Day in the Faroes a day off for some, and Poland's Flag Day a working day", () => {
    expect(find("FO", "2026-07-29", "St Olav's Day")?.[1]).toBe("optional");
    expect(find("PL", "2026-05-02", "Flag Day")?.[1]).toBe("observance");
  });

  it("says the Vatican's papal days are for the current pope", () => {
    expect(find("VA", "2040-05-08", "Anniversary of the election of Pope Leo XIV")?.[3]).toMatch(/current pope/);
  });
});

describe("the library's optional days", () => {
  const countries = readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length));

  it("each say where or for whom they are a day off", () => {
    const bare = countries.flatMap((country) =>
      data(country)
        .filter(([, kind, , note]) => kind === "optional" && note.trim() === "")
        .map(([date, , name]) => `${country} ${date} ${name}`),
    );
    expect(bare).toEqual([]);
  });

  it("are observances where they are no one's day off", () => {
    expect(find("BR", "2026-02-14", "Carnival")?.[1]).toBe("observance");
    expect(find("BR", "2026-02-15", "Carnival")?.[1]).toBe("observance");
    expect(find("BR", "2026-02-16", "Carnival")?.[1]).toBe("bank");
    expect(find("BR", "2026-02-18", "Carnival")).toEqual([
      "2026-02-18",
      "optional",
      "Carnival",
      "Ash Wednesday, the end of Carnival. Federal offices open at 2 pm, and many businesses open late",
    ]);
    expect(find("GT", "2026-06-17", "Father's Day")?.[1]).toBe("observance");
    for (const country of ["NO", "SJ"]) {
      expect(find(country, "2026-07-29", "St Olav's Day (Olsok)")?.[1]).toBe("observance");
      expect(data(country).some(([, , name]) => name === "Olsok")).toBe(false);
    }
    expect(find("SE", "2027-01-05", "Twelfth Night")?.[1]).toBe("observance");
    expect(find("SE", "2027-04-30", "Walpurgis Night")?.[1]).toBe("observance");
    expect(find("SE", "2027-11-05", "All Saints' Eve")?.[3]).toMatch(/^Not a day off, but many workplaces/);
    expect(find("SM", "2026-12-31", "New Year's Eve")?.[1]).toBe("observance");
  });

  it("calls Sweden's allhelgonaafton All Saints' Eve, the Friday before All Saints' Day", () => {
    expect(data("SE").some(([, , name]) => name === "Halloween")).toBe(false);
    for (let year = FROM; year <= TO; year++) {
      const eve = data("SE").filter(([date, , name]) => name === "All Saints' Eve" && date.startsWith(`${year}-`));
      const saints = data("SE").find(([date, , name]) => name === "All Saints' Day" && date.startsWith(`${year}-`));
      expect(eve).toHaveLength(1);
      expect(eve[0][1]).toBe("observance");
      expect(weekday(eve[0][0])).toBe(5);
      expect(saints && weekday(saints[0])).toBe(6);
      expect(new Date(`${eve[0][0]}T00:00:00Z`).getTime() + 86_400_000).toBe(new Date(`${saints![0]}T00:00:00Z`).getTime());
    }
  });

  it("name the group that has them off", () => {
    expect(find("GT", "2026-05-10", "Mother's Day")?.[3]).toMatch(/working mothers/);
    expect(find("AR", "2026-07-10", "Tourism Purposes Non-Working Day")?.[3]).toMatch(/government offices close/);
    expect(find("AR", "2026-12-24", "Christmas Eve")?.[3]).toMatch(/national government/);
    expect(find("BR", "2026-12-31", "New Year's Eve")?.[3]).toMatch(/^Federal offices/);
    for (const country of ["GU", "PR", "VI"]) {
      expect(find(country, "2030-12-24", "Christmas Eve")?.[3]).toMatch(/government staff/);
    }
    expect(find("PH", "2026-02-17", "Chinese New Year")?.[3]).toMatch(/^A special non-working day/);
    expect(find("HU", "2026-12-24", "Christmas Eve")?.[3]).toMatch(/Saturday 12 December/);
    expect(find("HU", "2027-12-24", "Christmas Eve")?.[3]).toMatch(/^Not a public holiday yet.*before Parliament in 2026/);
    expect(find("HU", "2028-12-24", "Christmas Eve")?.[3]).toBe("Not a public holiday: many employers give the day off. Shops must close by 2 pm");
  });
});
