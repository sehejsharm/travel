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
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-faint">
            {summary || hint || "Optional"}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {open && <div className="border-t border-line px-3.5 py-3.5">{children}</div>}
    </div>
  );
}
