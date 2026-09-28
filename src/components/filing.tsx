"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { TripItem } from "@/lib/domain/types";
import type { ItemDraft } from "@/lib/extract/types";
import type { DuplicateMatch } from "@/lib/dedupe";
import { Card } from "./ui";

/**
 * The end of adding something, shared by reading it in and typing it in: the
 * heading over what is about to be filed, the choice when it looks like a
 * repeat, and the note once it is in.
 */

export function DraftHeading({ title, chip }: { title: string; chip?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {chip}
    </div>
  );
}

/** Where focus goes once something appears in place of the button that was pressed. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return ref;
}

/**
 * Takes focus when it appears: the button that filed the item has just gone
 * or disabled itself, and the way on to the cabinet is here.
 */
export function FiledNotice({ label }: { label: string }) {
  const ref = useFocusOnMount<HTMLDivElement>();
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="animate-pop border-teal p-4 text-sm">
        Filed <span className="font-medium">{label}</span>.{" "}
        <Link href="/cabinet" className="text-accent-strong underline">
          See it in the cabinet
        </Link>
      </Card>
    </div>
  );
}

/**
 * Shown instead of the file button when something very like this is already
 * in the cabinet. Neither answer is presumed: merging fills the gaps in what
 * is filed, keeping both leaves the cabinet exactly as the traveller expects.
 */
export function DuplicateChoice({
  draft,
  matches,
  onMerge,
  onKeepBoth,
  onCancel,
}: {
  draft: ItemDraft;
  matches: DuplicateMatch[];
  onMerge: (item: TripItem) => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}) {
  // The button that raised this has gone, so the question takes the focus.
  const heading = useFocusOnMount<HTMLParagraphElement>();

  return (
    <Card className="animate-rise border-accent p-4">
      <p ref={heading} tabIndex={-1} className="text-sm font-medium outline-none">
        You may already have {matches.length === 1 ? "this" : "one of these"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        “{draft.title}” looks like something already filed. Merging keeps what you have and fills
        in anything it was missing.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {matches.map((match) => (
          <li
            key={match.item.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{match.item.title}</span>
              <span className="block font-mono text-[10px] text-ink-faint">{match.reason}</span>
            </span>
            <button
              type="button"
              onClick={() => onMerge(match.item)}
              className="press shrink-0 rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent-ink"
            >
              Merge into this
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onKeepBoth}
          className="press rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft"
        >
          Keep both
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="press font-mono text-[10px] text-ink-faint underline"
        >
          back
        </button>
      </div>
    </Card>
  );
}

/** Under the file button when there is no trip yet, so starting one is never a surprise. */
export function StartsTripNote({ what }: { what: string }) {
  return (
    <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-ink-faint">
      You have no trip open. This builds one around {what} — you can rename it and fill in the
      dates after.
    </p>
  );
}
