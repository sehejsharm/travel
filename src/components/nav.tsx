"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mailroom", label: "Mailroom" },
  { href: "/cabinet", label: "Filing cabinet" },
  { href: "/", label: "Planning desk" },
];

export function Nav() {
  const pathname = usePathname();

  // A shared trip page stands on its own — whoever opens it is not a user here.
  if (pathname.startsWith("/share/")) return null;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
            <rect
              x="4"
              y="8"
              width="32"
              height="24"
              rx="2"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.6"
            />
            <line x1="4" y1="16" x2="36" y2="16" stroke="var(--accent)" strokeWidth="2.6" />
            <circle cx="11" cy="24" r="1.9" fill="var(--accent)" />
            <line x1="16" y1="24" x2="31" y2="24" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <span className="font-display text-xl font-semibold">Manifest</span>
        </Link>

        <nav className="flex gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                  active
                    ? "bg-accent/15 text-accent-strong"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
