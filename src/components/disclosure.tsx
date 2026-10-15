"use client";

import { useState, type ReactNode } from "react";

/**
 * An optional section of a form. Collapsed by default and never required, so
 * the fast path is unaffected by how much depth sits underneath. The summary
 * line carries whatever has been filled in, so a collapsed section still says
 * what it holds.
 */
export function Disclosure({
  label,
  hint,
  summary,
  defaultOpen = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Shown on the closed row once the section has something in it. */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    // No overflow-hidden: it would clip the row's focus outline. The row takes
    // the card's corners itself, so its hover wash still fits the shape.
    <div className="rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`press flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 ${
          open ? "rounded-t-card" : "rounded-card"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-headline">{label}</span>
          <span className="block truncate text-footnote text-ink-soft">
            {summary || hint || "Optional"}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-ink-faint transition-transform duration-300 ease-[var(--ease-spring)] ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}
