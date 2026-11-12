import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalPage, Section } from "@/components/legal";
import { getCountry } from "@/lib/reference/countries";
import { HOLIDAY_SOURCES } from "@/lib/reference/holiday-data/sources";

export const metadata: Metadata = {
  title: "Licences and attribution",
  description: "The open-source software and data Manifest is built on.",
};

/*
 * Each links to the full text of its licence, in its own repository. date-holidays is pinned to
 * the release in use, 3.37.0: the project has since moved its data to CC BY-SA 4.0.
 */
const SOFTWARE: [string, string, string][] = [
  ["Next.js", "MIT", "https://github.com/vercel/next.js/blob/HEAD/license.md"],
  ["React and React DOM", "MIT", "https://github.com/facebook/react/blob/HEAD/LICENSE"],
  ["Tailwind CSS", "MIT", "https://github.com/tailwindlabs/tailwindcss/blob/HEAD/LICENSE"],
  ["Zod", "MIT", "https://github.com/colinhacks/zod/blob/HEAD/LICENSE"],
  [
    "Anthropic TypeScript SDK",
    "MIT",
    "https://github.com/anthropics/anthropic-sdk-typescript/blob/HEAD/LICENSE",
  ],
  [
    "date-holidays",
    "ISC (code), CC BY-SA 3.0 (data)",
    "https://github.com/commenthol/date-holidays/blob/v3.37.0/LICENSE",
  ],
  [
    "astronomia (Sun and Moon positions for the lunar calendars)",
    "MIT, © 2013 Sonia Keys, © 2016 commenthol",
    "https://github.com/commenthol/astronomia/blob/HEAD/LICENSE",
  ],
  [
    "pythaidate (adapted for Manifest’s Thai lunar calendar)",
    "MIT, © 2023 Mark Hollow",
    "https://github.com/hmmbug/pythaidate/blob/HEAD/LICENSE.txt",
  ],
  [
    "mmcal (adapted for Manifest’s Myanmar calendar)",
    "MIT, © 2018 Yan Naing Aye",
    "https://github.com/yan9a/mmcal/blob/HEAD/LICENSE",
  ],
  ["TypeScript", "Apache-2.0", "https://github.com/microsoft/TypeScript/blob/HEAD/LICENSE.txt"],
  ["ESLint", "MIT", "https://github.com/eslint/eslint/blob/HEAD/LICENSE"],
  ["Vitest", "MIT", "https://github.com/vitest-dev/vitest/blob/HEAD/LICENSE"],
];

const SERVICES: [string, string][] = [
  ["Vercel hosting", "https://vercel.com/legal/terms"],
  ["Google Maps embeds and links", "https://cloud.google.com/maps-platform/terms"],
  ["Google Places API", "https://cloud.google.com/maps-platform/terms"],
  ["Anthropic API", "https://www.anthropic.com/legal/commercial-terms"],
];

const HOLIDAYS_REPO = "https://github.com/commenthol/date-holidays";
const CC_BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";

/*
 * How Lunar New Year and the other Chinese festivals are dated, word for word as the data gives it
 * for every country that keeps one. Said once, above the list, instead of once a country.
 */
const LUNISOLAR =
  ": Chinese lunisolar calendar, computed astronomically by scripts/build-holidays.mjs" +
  " (GB/T 33661-2017 rules), checked against date-holidays (https://github.com/commenthol/date-holidays)";

function countryName(code: string): string {
  const known = getCountry(code)?.name;
  if (known) return known;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The holiday sources a country at a time: countries by name, each one's sources in the order given. */
function sourcesByCountry(): [string, string[]][] {
  const byCode = new Map<string, string[]>();
  for (const { country, source } of HOLIDAY_SOURCES) {
    byCode.set(country, [...(byCode.get(country) ?? []), source]);
  }
  return [...byCode]
    .map(([code, sources]): [string, string[]] => [countryName(code), sources])
    .sort(([a], [b]) => a.localeCompare(b, "en"));
}

/**
 * Where the words naming a web address start: after the last colon or semicolon outside brackets
 * (the clause they belong to), and past a leading "and" left over from the address before.
 */
function nameStart(words: string): number {
  let start = 0;
  let depth = 0;
  for (let index = words.length - 1; index > 0; index--) {
    const char = words[index];
    if (char === ")") depth++;
    else if (char === "(") depth--;
    else if (depth === 0 && char === " " && (words[index - 1] === ":" || words[index - 1] === ";")) {
      start = index + 1;
      break;
    }
  }
  return start + /^,?\s*(?:and\s+)?/.exec(words.slice(start))![0].length;
}

/**
 * A source as written, with each web address folded into a link on the words that name it:
 * "Moomba: City of Melbourne, https://…" reads "Moomba: City of Melbourne", the publisher linked.
 */
function SourceText({ text }: { text: string }) {
  // The address stops before a comma, bracket or closing full stop.
  const parts = text.split(/(https?:\/\/[^\s,;)]*[^\s,;).])/);
  const nodes: ReactNode[] = [];
  let rest = parts[0];
  for (let index = 1; index < parts.length; index += 2) {
    const url = parts[index];
    const after = parts[index + 1];
    // "…, https://…" or "… (https://…)": the separator goes, and the words before it are the link.
    const bracketed = rest.endsWith(" (") && after.startsWith(")");
    const named = bracketed || rest.endsWith(", ");
    const words = named ? rest.slice(0, -2) : rest;
    const start = named ? nameStart(words) : words.length;
    nodes.push(
      words.slice(0, start),
      <a
        key={index}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-words text-accent-strong underline"
      >
        {words.slice(start) || url}
      </a>,
    );
    rest = bracketed ? after.slice(1) : after;
  }
  nodes.push(rest);
  return <>{nodes}</>;
}

function Table({ rows, note }: { rows: [string, string, string][]; note?: string }) {
  return (
    <>
      {/* One link a row, name and licence together, as the legal pages' "Also here" rows are. */}
      <ul className="flex flex-col gap-2">
        {rows.map(([name, licence, url]) => (
          <li key={name}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="press tap inline-flex min-h-11 flex-wrap content-center items-baseline gap-x-2"
            >
              <span className="text-subheadline text-accent-strong underline underline-offset-2">
                {name}
              </span>
              <span className="text-caption text-ink-soft">{licence}</span>
            </a>
          </li>
        ))}
      </ul>
      {note && <p className="text-caption text-ink-soft">{note}</p>}
    </>
  );
}

export default function Licences() {
  return (
    <LegalPage
      title="Licences and attribution"
      summary="What Manifest is built from, and the terms each piece carries."
    >
      <Section heading="Software">
        <Table
          rows={SOFTWARE}
          note="Each entry links to the full text of its licence."
        />
      </Section>

      <Section heading="Typefaces">
        <p>
          None are bundled. Manifest sets its text in your device&rsquo;s own system typeface (San
          Francisco on Apple devices), so no font is downloaded and nothing is fetched from a font
          service.
        </p>
      </Section>

      <Section heading="Icons and the mark">
        <p>
          Every icon in the interface, and the boarding-pass mark, was drawn for Manifest. No
          third-party icon set is bundled, so there is nothing here to attribute.
        </p>
      </Section>

      <Section heading="Maps and geocoding">
        <p>
          Maps are Google Maps embeds, and Discover can look places up with the Google Places API. Map
          data is © Google and its data providers; it is shown under Google&rsquo;s terms and is not
          redistributed by us.
        </p>
        <p>
          The box each country&rsquo;s AllTrails link is framed on was worked out from{" "}
          <a
            href="https://www.naturalearthdata.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline"
          >
            Natural Earth
          </a>
          &rsquo;s country outlines, which are in the public domain.
        </p>
      </Section>

      <Section heading="Reference data">
        <p>
          Country facts (currencies, plug types, voltages, emergency numbers, standard-time
          offsets), climate normals, city and airport coordinates, duty-free allowances and
          indicative exchange rates were compiled by hand from public sources for this app, and
          carry the verification date shown on the Checks screen. They are informational, as the{" "}
          <Link href="/legal/terms" className="text-accent-strong underline">
            terms
          </Link>{" "}
          set out, and no claim is made to any underlying government publication.
        </p>
      </Section>

      <Section heading="Holidays and festivals">
        <p>
          The holiday calendar is adapted from the data in{" "}
          <a
            href={HOLIDAYS_REPO}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline"
          >
            date-holidays
          </a>
          , © commenthol and the date-holidays contributors, licensed under{" "}
          <a
            href={CC_BY_SA_3}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline"
          >
            CC BY-SA 3.0
          </a>
          . Much of it is drawn from Wikipedia, and each country&rsquo;s file in that project lists
          the articles it relies on.
        </p>
        <p>
          Changes made for Manifest: the data is turned into one English-language list per country
          for 2026 to 2050, school holidays are left out, and a holiday lasting several days is
          listed once for each day. Names the data gives in another language, or gets wrong, are
          given in English. A day off in only some states or regions is marked as regional, with
          where it applies, and a national day off that some regions do not keep says so. A day the
          data gives to one group only (women, say, or the armed forces) is not counted as a day off
          for everyone, and Islamic holidays carry a note that their dates are estimates. Chinese,
          Korean and Vietnamese lunar dates are recomputed from astronomy where the data has them on
          the wrong day, a few rules are changed where a newer law differs, some notes are added or
          corrected, and some entries the sources below show to be wrong are removed or changed.
          {HOLIDAY_SOURCES.length > 0 &&
            " Festivals, corrections and the countries the data does not cover come from the" +
              " sources below, added on top."}{" "}
          The adapted calendar ships inside the app and is shared under the same licence, CC BY-SA
          3.0.
        </p>
        {HOLIDAY_SOURCES.some(({ source }) => source.endsWith(LUNISOLAR)) && (
          <p>
            Where a source below is the Chinese lunisolar calendar, the dates are computed
            astronomically for Manifest (GB/T 33661-2017 rules) and checked against date-holidays.
          </p>
        )}
        {HOLIDAY_SOURCES.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {sourcesByCountry().map(([name, sources]) => (
              <li key={name}>
                <details className="group">
                  <summary className="press flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-subheadline">{name}</span>
                    <span className="text-footnote text-ink-soft tabular">
                      {sources.length} {sources.length === 1 ? "source" : "sources"}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-ink-faint transition-transform duration-300 ease-[var(--ease-spring)] group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <ul className="flex flex-col gap-2 pb-3 text-subheadline">
                    {sources.map((source) => (
                      <li key={source}>
                        {source.endsWith(LUNISOLAR) ? (
                          `${source.slice(0, -LUNISOLAR.length)}: Chinese lunisolar calendar`
                        ) : (
                          <SourceText text={source} />
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
        <p>
          Dates are informational. Governments move holidays and announce some only a year or so
          ahead, so check a date that matters with an official source.
        </p>
      </Section>

      <Section heading="Services used at runtime">
        <ul className="flex flex-col">
          {SERVICES.map(([name, url]) => (
            <li key={name}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="press tap inline-flex min-h-11 items-center text-subheadline text-accent-strong underline underline-offset-2"
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </LegalPage>
  );
}
