import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOLIDAY_SOURCES } from "@/lib/reference/holiday-data/sources";
import Licences from "./page";

/* The licences page as static HTML, over the real holiday sources. */
const html = renderToStaticMarkup(createElement(Licences));

/** The countries in the holiday sources list, in order. */
function countries(): string[] {
  return [...html.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]);
}

/** One country's disclosure, from its summary to its end. */
function country(name: string): string {
  const start = html.indexOf(`>${name}</span>`);
  return html.slice(start, html.indexOf("</details>", start));
}

describe("the licences page's holiday sources", () => {
  it("lists the countries in order of their names, not their codes", () => {
    const names = countries();

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    // In code order, Switzerland (CH) came before China and Spain (ES) before Ethiopia.
    expect(names.indexOf("China")).toBeLessThan(names.indexOf("Switzerland"));
    expect(names.indexOf("Ethiopia")).toBeLessThan(names.indexOf("Spain"));
    expect(names[0]).toBe("Afghanistan");
  });

  it("gathers each country's sources under one disclosure, in the order given", () => {
    expect(html.match(/<details/g)).toHaveLength(new Set(HOLIDAY_SOURCES.map(({ country }) => country)).size);

    const australia = country("Australia");
    expect(australia).toContain(">5 sources<");
    const order = ["Australian Government", "Lunar New Year", "Moomba", "Sydney Gay", "Vivid Sydney"];
    const at = order.map((text) => australia.indexOf(text));
    expect(at.every((index) => index > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(country("Armenia")).toContain(">1 source<");
  });

  it("links the words that name each source, not its web address", () => {
    expect(html).toMatch(/Moomba: <a href="https:\/\/www\.melbourne\.vic\.gov\.au\/"[^>]*>City of Melbourne<\/a>/);
    // Two addresses in one source: each on its own name, the "and" between them left as text.
    expect(html).toMatch(/>Ministry of Public Administration holiday notifications, as reported by The Daily Star<\/a>, and <a href="https:\/\/www\.tbsnews\.net\/"[^>]*>The Business Standard<\/a>; Hindu/);
    // An address in brackets loses its brackets with it.
    expect(html).toMatch(/as posted by municipalities<\/a> and listed by officeholidays\.com;/);
    // A clause break inside brackets is not where the name starts.
    expect(html).toMatch(/>Computed from the Hindu lunisolar and Islamic lunar calendars \(Meeus, Astronomical Algorithms; Lahiri ayanamsa; Yallop crescent criterion\), checked against the Government of India&#x27;s gazetted holiday lists<\/a>/);
    expect(html).not.toMatch(/>https?:\/\//);
    expect(html).not.toContain("break-all");
  });

  it("says how the Chinese festivals are dated once, not under every country that keeps one", () => {
    expect(html.match(/GB\/T 33661-2017/g)).toHaveLength(1);
    expect(country("Australia")).toContain("<li>Lunar New Year: Chinese lunisolar calendar</li>");
    expect(country("Singapore")).toContain("<li>Mid-Autumn Festival: Chinese lunisolar calendar</li>");
  });
});

describe("the licences page's software and services", () => {
  it("points to licence texts a reader can open, not to the repository's own files", () => {
    expect(html).not.toMatch(/scripts\/|\.mjs|node_modules/);
    // Name and licence are one link, to the licence's full text.
    expect(html).toMatch(
      /<a href="https:\/\/github\.com\/hmmbug\/pythaidate\/blob\/HEAD\/LICENSE\.txt"[^>]*><span[^>]*>pythaidate \(adapted for Manifest’s Thai lunar calendar\)<\/span><span[^>]*>MIT, © 2023 Mark Hollow<\/span><\/a>/,
    );
    expect(html).toMatch(/<a href="https:\/\/github\.com\/commenthol\/date-holidays\/blob\/v3\.37\.0\/LICENSE"[^>]*><span[^>]*>date-holidays<\/span>/);
  });

  it("ends no service link with an arrow", () => {
    expect(html).not.toContain("↗");
    expect(html).toMatch(/>Vercel hosting<\/a>/);
  });
});
