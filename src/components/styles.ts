/*
 * The looks of the form controls as class strings, built to Apple's
 * text-field and button specs with the brand filled in. docs/design-system.md
 * has the reasoning behind each number.
 *
 * A plain module, not a client one, so a server component (the legal pages)
 * gets the strings themselves. Imported from form.tsx, which is "use client",
 * a server component is handed a client reference instead, and the link
 * renders unstyled.
 *
 * Inputs set 17px text: Safari zooms the page into any field smaller than
 * 16px on focus, which is the single most un-native thing a web form does.
 * Every control is at least 44px tall, the smallest target a thumb can hit.
 */
export const INPUT_CLASSES =
  "min-h-11 w-full rounded-input border border-line bg-surface px-3 py-2 text-body text-ink outline-none placeholder:text-ink-faint transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out)] focus:border-accent focus:ring-4 focus:ring-accent/15 focus-visible:outline-none disabled:opacity-40";

/*
 * Apple's pop-up button: a native select drawn as tinted text with no box,
 * for a small choice inside a row (whose job a task is). 16px, so Safari
 * does not zoom into it.
 */
export const POPUP_BUTTON_CLASSES =
  "press min-h-11 cursor-pointer rounded-control bg-transparent px-2 text-callout text-accent-strong hover:bg-accent-soft";

/* The button looks, so a link that acts as a button (a Link to /trip/new, say) is drawn exactly like one. */
export const PRIMARY_BUTTON_CLASSES =
  "press shine flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2 text-body font-medium text-accent-ink disabled:opacity-40";

export const SECONDARY_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent-soft px-4 py-2 text-subheadline font-medium text-accent-strong disabled:opacity-40";

/* Something that cannot be undone: red from the first tap, not only on the confirming one. */
export const DESTRUCTIVE_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-critical-soft px-4 py-2 text-subheadline font-medium text-critical disabled:opacity-40";

/*
 * Removing one entry from a list: quiet secondary text, turning red under a
 * pointer, so a column of them does not shout. Its own class string rather
 * than overrides on the borderless one, because Tailwind decides which of two
 * same-property utilities wins, not the order they are written in.
 */
export const REMOVE_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 py-2 text-subheadline font-medium text-ink-soft hover:bg-critical-soft hover:text-critical disabled:opacity-40";

export const BORDERLESS_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 py-2 text-subheadline font-medium text-accent-strong hover:bg-accent-soft disabled:opacity-40";
