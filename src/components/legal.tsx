import Link from "next/link";
import type { ReactNode } from "react";
import { ScreenHeader } from "./ui";

export const LEGAL_UPDATED = "2026-09-16";

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
      <ScreenHeader eyebrow="Legal" title={title} meta={summary} />

      <article className="prose-legal flex flex-col gap-5 text-sm leading-relaxed text-ink-soft">
        {children}
      </article>

      <nav className="border-t border-line pt-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          Also here
        </p>
        <ul className="flex flex-col gap-1.5">
          {LEGAL_PAGES.filter((page) => page.title !== title).map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="press text-sm text-accent-strong underline underline-offset-2"
              >
                {page.title}
              </Link>
              <span className="ml-2 font-mono text-[10px] text-ink-faint">{page.blurb}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[10px] text-ink-faint">
          Last updated {LEGAL_UPDATED}.
        </p>
      </nav>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{heading}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
