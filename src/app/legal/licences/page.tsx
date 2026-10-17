import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/legal";
import { getCountry } from "@/lib/reference/countries";
import { HOLIDAY_SOURCES } from "@/lib/reference/holiday-data/sources";

export const metadata: Metadata = {
  title: "Licences and attribution",
  description: "The open-source software and data Manifest is built on.",
};

const SOFTWARE: [string, string, string][] = [
  ["Next.js", "MIT", "https://github.com/vercel/next.js"],
  ["React and React DOM", "MIT", "https://github.com/facebook/react"],
  ["Tailwind CSS", "MIT", "https://github.com/tailwindlabs/tailwindcss"],
  ["Zod", "MIT", "https://github.com/colinhacks/zod"],
  ["Anthropic TypeScript SDK", "MIT", "https://github.com/anthropics/anthropic-sdk-typescript"],
  [
    "date-holidays",
    "ISC (code), CC BY-SA 3.0 (data)",
    "https://github.com/commenthol/date-holidays",
  ],
  ["TypeScript", "Apache-2.0", "https://github.com/microsoft/TypeScript"],
  ["ESLint", "MIT", "https://github.com/eslint/eslint"],
  ["Vitest", "MIT", "https://github.com/vitest-dev/vitest"],
];

const SERVICES: [string, string][] = [
  ["Vercel hosting", "https://vercel.com/legal/terms"],
  ["Google Maps embeds and links", "https://cloud.google.com/maps-platform/terms"],
  ["Google Places API", "https://cloud.google.com/maps-platform/terms"],
  ["Anthropic API", "https://www.anthropic.com/legal/commercial-terms"],
];

const HOLIDAYS_REPO = "https://github.com/commenthol/date-holidays";
const CC_BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";

function countryName(code: string): string {
  const known = getCountry(code)?.name;
  if (known) return known;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A source as written, with its web address made a link. */
function SourceText({ text }: { text: string }) {
  // The address stops before a comma, bracket or closing full stop.
  const parts = text.split(/(https?:\/\/[^\s,;)]*[^\s,;).])/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-accent-strong underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Table({ rows, note }: { rows: [string, string, string][]; note?: string }) {
  return (
    <>
      <ul className="flex flex-col">
        {rows.map(([name, licence, url]) => (
          <li key={name} className="flex flex-wrap items-baseline gap-x-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="press tap inline-flex min-h-11 items-center text-subheadline text-accent-strong underline underline-offset-2"
            >
              {name}
            </a>
            <span className="text-caption text-ink-soft">{licence}</span>
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
          note="Full licence texts ship inside node_modules in the source repository."
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
          listed once for each day. A day off in only some states or regions is marked as regional,
          with where it applies. A day the data gives to one group only (women, say, or the armed
          forces) is not counted as a day off for everyone, and Islamic holidays carry a note that
          their dates are estimates.
          {HOLIDAY_SOURCES.length > 0 &&
            " Festivals and corrections from the sources below are added on top."}{" "}
          The adapted calendar ships inside the app and is shared under the same licence, CC BY-SA
          3.0.
        </p>
        {HOLIDAY_SOURCES.length > 0 && (
          <ul className="flex flex-col gap-2">
            {HOLIDAY_SOURCES.map(({ country, source }) => (
              <li key={`${country} ${source}`} className="text-subheadline">
                <span className="text-ink">{countryName(country)}</span>:{" "}
                <SourceText text={source} />
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
                {name} ↗
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </LegalPage>
  );
}
