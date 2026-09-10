"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface Tab {
  href: string;
  label: string;
  icon: ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Trip",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path {...stroke} d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="19" cy="17" r="2" {...stroke} />
      </svg>
    ),
  },
  {
    href: "/cabinet",
    label: "Cabinet",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="3.5" y="4" width="17" height="7" rx="2" {...stroke} />
        <rect x="3.5" y="13" width="17" height="7" rx="2" {...stroke} />
        <path {...stroke} d="M10.5 7.5h3M10.5 16.5h3" />
      </svg>
    ),
  },
  {
    href: "/add",
    label: "Add",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path {...stroke} d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/checks",
    label: "Checks",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path {...stroke} d="M12 3.5 20 7v5.5c0 4.2-3.2 7-8 8.5-4.8-1.5-8-4.3-8-8.5V7z" />
        <path {...stroke} d="m9 12 2.2 2.2L15.5 10" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "More",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
        <rect
          x="4"
          y="8"
          width="32"
          height="24"
          rx="3"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.8"
        />
        <line x1="4" y1="16" x2="36" y2="16" stroke="var(--accent)" strokeWidth="2.8" />
        <circle cx="11" cy="24" r="2" fill="var(--accent)" />
        <line x1="16" y1="24" x2="31" y2="24" stroke="var(--accent)" strokeWidth="2.2" />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight">Manifest</span>
    </span>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // A shared trip is read by someone who is not a user of this app.
  if (pathname.startsWith("/share")) {
    return <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>;
  }

  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <Link href="/" className="px-2">
          <Wordmark />
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  active
                    ? "bg-accent-soft font-medium text-accent-strong"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="nav-surface pt-safe sticky top-0 z-30 border-b border-line lg:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <Link href="/">
              <Wordmark />
            </Link>
          </div>
        </header>

        <main className="pb-safe mx-auto w-full max-w-3xl flex-1 px-5 pt-5 lg:max-w-4xl lg:px-10 lg:pt-10 lg:pb-16">
          {children}
        </main>

        <nav
          aria-label="Main"
          className="nav-surface fixed inset-x-0 bottom-0 z-30 border-t border-line lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ul className="flex items-stretch justify-around">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab.href);
              const isAdd = tab.href === "/add";

              return (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`press flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[10px] font-medium ${
                      active ? "text-accent-strong" : "text-ink-faint"
                    }`}
                  >
                    <span
                      className={
                        isAdd
                          ? "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-card"
                          : "flex h-9 w-9 items-center justify-center"
                      }
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
