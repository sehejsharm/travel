import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Licences and attribution — Manifest",
  description: "The open-source software, fonts and data Manifest is built on.",
};

const SOFTWARE: [string, string, string][] = [
  ["Next.js", "MIT", "https://github.com/vercel/next.js"],
  ["React and React DOM", "MIT", "https://github.com/facebook/react"],
  ["Tailwind CSS", "MIT", "https://github.com/tailwindlabs/tailwindcss"],
  ["Zod", "MIT", "https://github.com/colinhacks/zod"],
  ["Anthropic TypeScript SDK", "MIT", "https://github.com/anthropics/anthropic-sdk-typescript"],
  ["TypeScript", "Apache-2.0", "https://github.com/microsoft/TypeScript"],
  ["ESLint", "MIT", "https://github.com/eslint/eslint"],
  ["Vitest", "MIT", "https://github.com/vitest-dev/vitest"],
];

const FONTS: [string, string, string][] = [
  ["Fraunces", "SIL Open Font License 1.1", "https://github.com/undercasetype/Fraunces"],
  ["IBM Plex Sans", "SIL Open Font License 1.1", "https://github.com/IBM/plex"],
  ["IBM Plex Mono", "SIL Open Font License 1.1", "https://github.com/IBM/plex"],
];

const SERVICES: [string, string][] = [
  ["Google Maps embeds and links", "https://cloud.google.com/maps-platform/terms"],
  ["Google Places API", "https://cloud.google.com/maps-platform/terms"],
  ["Anthropic API", "https://www.anthropic.com/legal/commercial-terms"],
];

function Table({ rows, note }: { rows: [string, string, string][]; note?: string }) {
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([name, licence, url]) => (
          <li key={name} className="flex flex-wrap items-baseline gap-x-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent-strong underline underline-offset-2"
            >
              {name}
            </a>
            <span className="font-mono text-[10px] text-ink-faint">{licence}</span>
          </li>
        ))}
      </ul>
      {note && <p className="font-mono text-[10px] text-ink-faint">{note}</p>}
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
          Served from our own origin rather than fetched from a font CDN, so using Manifest does not
          announce you to a third party on every page load.
        </p>
        <Table rows={FONTS} />
      </Section>

      <Section heading="Icons and the mark">
        <p>
          Every icon in the interface, and the boarding-pass mark, was drawn for Manifest. No
          third-party icon set is bundled, so there is nothing here to attribute.
        </p>
      </Section>

      <Section heading="Maps and geocoding">
        <p>
          Maps are Google Maps embeds, and place lookups in Discover use the Google Places API. Map
          data is © Google and its data providers; it is shown under Google&rsquo;s terms and is not
          redistributed by us.
        </p>
      </Section>

      <Section heading="Reference data">
        <p>
          Country facts (currencies, plug types, voltages, emergency numbers, standard-time
          offsets), climate normals, city and airport coordinates, public holidays, duty-free
          allowances and indicative exchange rates were compiled by hand from public sources for
          this app, and carry the verification date shown on the Checks screen. They are
          informational, as the{" "}
          <a href="/legal/terms" className="text-accent-strong underline">
            terms
          </a>{" "}
          set out, and no claim is made to any underlying government publication.
        </p>
      </Section>

      <Section heading="Services used at runtime">
        <ul className="flex flex-col gap-1.5">
          {SERVICES.map(([name, url]) => (
            <li key={name}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent-strong underline underline-offset-2"
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
