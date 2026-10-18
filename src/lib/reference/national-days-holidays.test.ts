import { describe, expect, it } from "vitest";
import { applyDrops, libraryEntries, mergeEntries, supplementEntries } from "../../../scripts/build-holidays.mjs";
import fiji, { nearestMondayOrFriday } from "../../../scripts/holiday-supplements/fiji.mjs";
import islamicSoutheastAsia from "../../../scripts/holiday-supplements/islamic-southeast-asia.mjs";
import mauritius from "../../../scripts/holiday-supplements/mauritius.mjs";

/**
 * Corrections made while merging the regional supplements: South-east Asia's
 * published 2027 Islamic days, Fiji's national days and Mauritius's
 * alternating Catholic feast. Each check is a date a government (or, for
 * Mauritius, the calendars that copy its notices) published; sources are in
 * docs/holiday-dates.md.
 */

type Entry = { date: string; name: string; kind: string; note: string };
type Loaded = { country: string; entries: Entry[] };

// libraryEntries() for a country with many states (Malaysia) takes several seconds.
const SLOW = 120_000;
const MOON_NOTE = "Islamic lunar date, estimated: the official date can differ by a day";

function merged(supplements: unknown[], file: string, country: string): Entry[] {
  const own = (supplementEntries(supplements, file) as Loaded[]).filter((supplement) => supplement.country === country);
  const kept = applyDrops(country, libraryEntries(country), own);
  return mergeEntries(kept, own.flatMap((supplement) => supplement.entries)) as Entry[];
}

function datesOf(list: Entry[], name: string, year: number): string[] {
  return list.filter((entry) => entry.name === name && entry.date.startsWith(`${year}-`)).map((entry) => entry.date);
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

describe("2027 Islamic days in Singapore, Malaysia and Indonesia", { timeout: SLOW }, () => {
  it("matches Singapore's Ministry of Manpower list", () => {
    const sg = merged(islamicSoutheastAsia, "islamic-southeast-asia.mjs", "SG");
    expect(datesOf(sg, "Hari Raya Puasa", 2027)).toEqual(["2027-03-10"]);
    expect(datesOf(sg, "Hari Raya Haji", 2027)).toEqual(["2027-05-17"]);
    // Other years stay on the library's dates.
    expect(datesOf(sg, "Hari Raya Puasa", 2026)).toEqual(["2026-03-21"]);
  });

  it("matches Indonesia's joint decree (SKB) for 2027", () => {
    const id = merged(islamicSoutheastAsia, "islamic-southeast-asia.mjs", "ID");
    expect(datesOf(id, "End of Ramadan (Eid al-Fitr)", 2027)).toEqual(["2027-03-10", "2027-03-11"]);
    expect(datesOf(id, "Feast of the Sacrifice (Eid al-Adha)", 2027)).toEqual(["2027-05-17"]);
    expect(datesOf(id, "Islamic New Year", 2027)).toEqual(["2027-06-06"]);
    expect(datesOf(id, "Birthday of Muhammad (Mawlid)", 2027)).toEqual(["2027-08-15"]);
    expect(datesOf(id, "Laylat al-Mi'raj", 2027)).toEqual(["2027-01-05", "2027-12-26"]);
  });

  it("matches Indonesia's 2026 decree: Idul Fitri on 21 and 22 March, a day after the library", () => {
    const id = merged(islamicSoutheastAsia, "islamic-southeast-asia.mjs", "ID");
    expect(datesOf(id, "End of Ramadan (Eid al-Fitr)", 2026)).toEqual(["2026-03-21", "2026-03-22"]);
  });

  it("matches Malaysia's 2027 federal list", () => {
    const my = merged(islamicSoutheastAsia, "islamic-southeast-asia.mjs", "MY");
    expect(datesOf(my, "End of Ramadan (Eid al-Fitr)", 2027)).toEqual(["2027-03-10", "2027-03-11"]);
    const adha = my.filter((entry) => entry.name === "Feast of the Sacrifice (Eid al-Adha)" && entry.date.startsWith("2027-"));
    expect(adha.map((entry) => [entry.date, entry.kind])).toEqual([
      ["2027-05-17", "public"],
      ["2027-05-18", "optional"],
    ]);
    expect(datesOf(my, "Arafat Day", 2027)).toEqual(["2027-05-16"]);
  });

  it("keeps the library's caveat on every moved day", () => {
    for (const supplement of supplementEntries(islamicSoutheastAsia, "islamic-southeast-asia.mjs") as Loaded[]) {
      for (const entry of supplement.entries) expect(entry.note.endsWith(MOON_NOTE), `${entry.date} ${entry.name}`).toBe(true);
    }
  });
});

describe("Fiji's national days", { timeout: SLOW }, () => {
  const fj = merged(fiji, "fiji.mjs", "FJ");

  it("moves a day to the nearest Monday or Friday, a Wednesday to the Monday before", () => {
    expect(nearestMondayOrFriday("2025-05-14")).toBe("2025-05-12"); // Wednesday
    expect(nearestMondayOrFriday("2026-05-14")).toBe("2026-05-15"); // Thursday
    expect(nearestMondayOrFriday("2025-05-30")).toBe("2025-05-30"); // Friday
    expect(nearestMondayOrFriday("2026-05-30")).toBe("2026-05-29"); // Saturday
    expect(nearestMondayOrFriday("2027-05-30")).toBe("2027-05-31"); // Sunday
    expect(nearestMondayOrFriday("2029-05-29")).toBe("2029-05-28"); // Tuesday
  });

  it("matches the Cabinet's 2026 list of eleven holidays", () => {
    const daysOff = fj
      .filter((entry) => entry.date.startsWith("2026-") && entry.kind === "public")
      .map((entry) => `${entry.date} ${entry.name}`);
    expect(daysOff).toEqual([
      "2026-01-01 New Year's Day",
      "2026-04-03 Good Friday",
      "2026-04-04 Easter Saturday",
      "2026-04-06 Easter Monday",
      "2026-05-15 Girmit Day",
      "2026-05-29 Ratu Sir Lala Sukuna Day",
      "2026-08-24 Birthday of Muhammad (Mawlid)",
      "2026-10-10 Fiji Day",
      "2026-12-25 Christmas Day",
      "2026-12-26 Boxing Day",
      "2026-12-28 Boxing Day (substitute day)",
    ]);
    // Diwali (Monday 9 November) comes from hindu-buddhist-diaspora.mjs.
  });

  it("has Girmit Day and Ratu Sir Lala Sukuna Day on a Monday or Friday every year, and no Constitution Day", () => {
    for (let year = 2026; year <= 2050; year++) {
      for (const name of ["Girmit Day", "Ratu Sir Lala Sukuna Day"]) {
        const dates = datesOf(fj, name, year);
        expect(dates, `${name} ${year}`).toHaveLength(1);
        expect([1, 5], `${name} ${year}`).toContain(weekday(dates[0]));
      }
      expect(datesOf(fj, "Constitution Day", year)).toEqual([]);
    }
    expect(fj.find((entry) => entry.date === "2027-05-14")?.name).toBe("Girmit Day");
  });
});

describe("Mauritius's alternating feast", { timeout: SLOW }, () => {
  const mu = merged(mauritius, "mauritius.mjs", "MU");

  it("keeps the Assumption off in even years and All Saints' Day in odd years", () => {
    const kind = (date: string, name: string) => mu.find((entry) => entry.date === date && entry.name === name)?.kind;
    expect(kind("2026-08-15", "Assumption")).toBe("public");
    expect(kind("2026-11-01", "All Saints' Day")).toBe("observance");
    expect(kind("2027-08-15", "Assumption")).toBe("observance");
    expect(kind("2027-11-01", "All Saints' Day")).toBe("public");
    for (let year = 2026; year <= 2050; year++) {
      const off = mu.filter(
        (entry) => entry.date.startsWith(`${year}-`) && entry.kind === "public" && /^(Assumption|All Saints' Day)$/.test(entry.name),
      );
      expect(off, `${year}`).toHaveLength(1);
    }
  });
});
