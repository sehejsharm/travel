"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { TripItem } from "@/lib/domain/types";
import type { ItemDraft } from "@/lib/extract/types";
import type { DuplicateMatch } from "@/lib/dedupe";
import { BorderlessButton, SecondaryButton } from "./form";
import { Card } from "./ui";

/**
 * The end of adding something, shared by reading it in and typing it in: the
 * heading over what is about to be filed, the choice when it looks like a
 * repeat, and the note once it is in.
 */

export function DraftHeading({ title, chip }: { title: string; chip?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-title-3">{title}</h2>
      {chip}
    </div>
  );
}

/**
 * Where focus goes once something appears in place of the button that was
 * pressed, and what is scrolled into view — the whole card, not one line of it.
 */
function useFocusOnMount<F extends HTMLElement, S extends HTMLElement = F>() {
  const focus = useRef<F>(null);
  const scroll = useRef<S>(null);
  useEffect(() => {
    focus.current?.focus({ preventScroll: true });
    (scroll.current ?? focus.current)?.scrollIntoView({ block: "nearest" });
  }, []);
  return { focus, scroll };
}

// Clear of the sticky header and, on a phone, the tab bar fixed along the bottom.
const CLEAR_OF_BARS = {
  scrollMarginTop: "calc(4.5rem + env(safe-area-inset-top, 0px))",
  scrollMarginBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
};

/**
 * Takes focus when it appears: the button that filed the item has just gone
 * or disabled itself, and the way on to the cabinet is here.
 */
export function FiledNotice({ label }: { label: string }) {
  const { focus } = useFocusOnMount<HTMLDivElement>();
  // The notice is its own focus target, so the shared copper outline follows its corners.
  return (
    <div
      ref={focus}
      tabIndex={-1}
      style={CLEAR_OF_BARS}
      className="animate-pop rounded-card bg-ok-soft p-4 text-subheadline"
    >
      Filed <span className="font-medium">{label}</span>.{" "}
      <Link href="/cabinet" className="text-accent-strong underline">
        See it in the cabinet
      </Link>
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
  const { focus, scroll } = useFocusOnMount<HTMLParagraphElement, HTMLDivElement>();

  return (
    <div ref={scroll} style={CLEAR_OF_BARS}>
      {/* Amber, not copper: a likely repeat is a warning, not something to tap. */}
      <Card className="animate-rise border-warning p-4">
        <p ref={focus} tabIndex={-1} className="text-headline">
          You may already have {matches.length === 1 ? "this" : "one of these"}
        </p>
        <p className="mt-1 text-footnote text-ink-soft">
          “{draft.title}” looks like something already filed. Merging keeps what you have and fills
          in anything it was missing.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {matches.map((match) => (
            <li
              key={match.item.id}
              className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-2 p-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-headline">{match.item.title}</span>
                <span className="block text-footnote text-ink-soft">{match.reason}</span>
              </span>
              <SecondaryButton
                type="button"
                onClick={() => onMerge(match.item)}
                className="shrink-0"
              >
                Merge into this
              </SecondaryButton>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center gap-3">
          <SecondaryButton type="button" onClick={onKeepBoth}>
            Keep both
          </SecondaryButton>
          <BorderlessButton type="button" onClick={onCancel}>
            Back
          </BorderlessButton>
        </div>
      </Card>
    </div>
  );
}

/** Under the file button when there is no trip yet, so starting one is never a surprise. */
export function StartsTripNote({ what }: { what: string }) {
  return (
    <p className="mt-2 text-center text-footnote text-ink-soft">
      You have no trip open. This builds one around {what} — you can rename it and fill in the
      dates after.
    </p>
  );
}
