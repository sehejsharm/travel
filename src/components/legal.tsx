import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL } from "@/lib/contact";
import { ScreenHeader } from "./ui";

export const LEGAL_UPDATED = "2026-11-10";

export const LEGAL_PAGES: { href: string; title: string; blurb: string }[] = [
  { href: "/legal/privacy", title: "Privacy policy", blurb: "What is stored, and what leaves the device" },
  { href: "/legal/terms", title: "Terms of use", blurb: "Including what the checks are and are not" },
  { href: "/legal/data-deletion", title: "Deleting your data", blurb: "How to remove everything, permanently" },
  { href: "/legal/licences", title: "Licences and attribution", blurb: "The software and data this is built on" },
];

/** Shared chrome so the four documents read as one set. */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* The summary and the document share one reading measure. */}
      <ScreenHeader
        eyebrow="Legal"
        back={{ label: "More", href: "/more" }}
        title={title}
        meta={<p className="max-w-prose">{summary}</p>}
      />

      {/* The document is what the page is for, so it is running text in primary ink, not secondary. */}
      <article className="prose-legal flex max-w-prose flex-col gap-5 text-body text-ink">
        {children}
      </article>

      <nav className="border-t border-line pt-4">
        <p className="section-label mb-1">Also here</p>
        {/*
          Each row is one link holding its blurb, so a blurb that wraps sits tight under its
          own title, and the gap keeps it clear of the next one.
        */}
        <ul className="flex flex-col gap-2">
          {LEGAL_PAGES.filter((page) => page.title !== title).map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="press tap inline-flex min-h-11 flex-wrap content-center items-baseline gap-x-2"
              >
                <span className="text-subheadline text-accent-strong underline underline-offset-2">
                  {page.title}
                </span>
                <span className="text-caption text-ink-soft">{page.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-ink-soft tabular">
          Last updated {LEGAL_UPDATED}.
        </p>
      </nav>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title-3 text-ink">{heading}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          {/* One line of text tall, so the dot centres on the first line. */}
          <span aria-hidden="true" className="flex h-lh shrink-0 items-center">
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The one address, as a link in running text, so every document reaches the same inbox. */
export function ContactLink({ subject }: { subject?: string }) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";

  return (
    <a href={`mailto:${CONTACT_EMAIL}${query}`} className="text-accent-strong underline">
      {CONTACT_EMAIL}
    </a>
  );
}
