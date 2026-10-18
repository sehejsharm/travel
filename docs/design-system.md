# Manifest design system

Manifest follows Apple's Human Interface Guidelines, translated to the web,
with Manifest's own brand in place of Apple's palette. This file is the
standard every screen is built and reviewed against. The tokens live in
`src/app/globals.css`; the shared controls live in `src/components/form.tsx`,
`src/components/ui.tsx` and `src/components/sheet.tsx`, and their looks as
class strings in `src/components/styles.ts` (a plain module, so server
components can use them too).

## Colour: the brand in Apple's semantic layers

Apple's palette (System Blue, fixed greys) is never used. Every colour is a
token, so light and dark come from the same class names.

| Role | Token / class | Light | Dark |
| --- | --- | --- | --- |
| Brand primary: filled buttons, active states, progress, focus ring | `accent` | `#9c5e2c` deeper copper | `#e39a5c` light copper |
| Text on a filled button | `accent-ink` | `#ffffff` (5.2:1) | `#1a1108` |
| Brand-tinted text and its wash | `accent-strong` on `accent-soft` | `#87501f` on copper at 12% | `#f0b87d` on copper at 14% |
| The mark and decorative fills | `brand` | `#c1793d` | `#e39a5c` |
| Grouped background | `bg` | paper `#f4f6f3` | ink `#0b1116` |
| Cards and cells | `surface` | `#ffffff` | `#141d24` |
| Fills, tracks, hover wash | `surface-2`, `surface-3` | `#eaeee8`, `#dfe5dc` | `#1b252c`, `#243038` |
| Primary text | `ink` | brand ink `#0b1116` at 90% | paper `#f4f6f3` at 90% |
| Secondary text | `ink-soft` | brand ink at 60% | paper at 60% |
| Tertiary (placeholders, disabled, decoration only) | `ink-faint` | brand ink at 30% | paper at 30% |
| Hairlines | `line` | brand ink at 10% | paper at 10% |
| Critical / warning / success | `critical`, `warning`, `ok` | `#b23b46` / amber `#7a5c00` / teal `#2f6f62` | `#e5808a` / `#e8b84a` / `#59a595` |
| Frosted bars, sheets | `.nav-surface`, `.material-thick` | paper at 72%, white at 80% | ink at 72%, surface at 80% |

Rules:

- Use tokens only. No hex values in class names and no Tailwind palette
  colours (`gray-*`, `slate-*`, `red-*` and so on). White and black are allowed
  only on the trip hero's gradient and for the dimmed backdrop behind a sheet.
- `ink-faint` is 30%, about 1.9:1. It is for placeholders, disabled controls
  and decorative glyphs (a separator dot, a chevron, a dashed outline), never
  for text a person needs to read. Labels, hints, timestamps and metadata use
  `ink-soft`.
- Warnings are amber (`warning`), never copper: a warning must not look like
  something to tap.
- On the trip hero's gradient, secondary text is `text-white/80` at least.

## Type: San Francisco, with Apple's text styles

The font stack is the system face on every platform: San Francisco on Apple
devices (Safari picks the Text or Display cut by size), Segoe UI on Windows,
Roboto on Android. No web font is loaded, and SF is never served as a file:
Apple licenses it for its own platforms only.

| Class | Size | Weight | Tracking | Leading | Use |
| --- | --- | --- | --- | --- | --- |
| `text-display` | 40px | 700 | -0.025em | 1.1 | The trip hero's name on wide screens |
| `text-large-title` | 34px | 700 | -0.025em | 1.1 | A screen's title |
| `text-title-1` | 28px | 600 | -0.02em | 1.2 | Big numbers, hero title on a phone |
| `text-title-2` | 22px | 600 | -0.02em | 1.2 | Prominent card titles |
| `text-title-3` | 20px | 600 | -0.02em | 1.2 | Section titles, empty-state titles |
| `text-headline` | 17px | 500 | 0 | 1.45 | Row and card titles, sheet titles |
| `text-body` | 17px | 400 | 0 | 1.5 | Running text, inputs, primary buttons |
| `text-callout` | 16px | 400 | 0 | 1.5 | Secondary running text |
| `text-subheadline` | 15px | 400 | 0 | 1.45 | Most UI text: rows, secondary buttons |
| `text-footnote` | 13px | 400 | 0 | 1.38 | Field labels, metadata |
| `text-caption` | 12px | 400 | 0.012em | 1.33 | Chips, hints, small print |
| `text-caption-2` | 11px | 400 | 0.012em | 1.33 | Tab labels, map labels; the minimum |

Rules:

- Nothing is smaller than 11px.
- The styles carry their own tracking and leading. Don't add `tracking-*` or
  `leading-*` next to them.
- Weights: titles take theirs from the style. Text from 15px to 17px is 400 or
  `font-medium` (500), never semibold or bold. Captions are 400.
- `font-mono` is for machine data only: flight numbers, booking references,
  airport codes, and numbers lined up in columns. Never for labels, buttons,
  chips, navigation or hints. Plain numbers in text use `tabular`.
- Uppercase is for section headers only: `.section-label` over grouped
  content, and the eyebrow in `ScreenHeader`.
- `font-display` and `font-sans` resolve to the same stack; neither is needed
  in markup.

## Layout: the 4pt grid, 44pt targets, continuous corners

- Spacing is a multiple of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. In
  Tailwind that means whole steps (`p-1` is 4px, `gap-3` is 12px), never the
  half steps `0.5`, `1.5`, `2.5`, `3.5`, and no arbitrary `[Npx]` value that
  is not a multiple of 4. Hairlines (`h-px`, `w-px`, borders) and the sheet
  grabber are the exceptions.
- Every interactive element has a hit area of at least 44 x 44px: give it the
  size (`min-h-11`, `h-11 w-11`), or add `.tap` to a control drawn smaller,
  which centres an invisible 44 x 44 box on it. Links inside a paragraph of
  running text are exempt, as they are on Apple's platforms.
- Radii by role, nested as outer radius minus padding:

  | Class | Radius | For |
  | --- | --- | --- |
  | `rounded-badge` | 6px | Chips, tags, badges, count bubbles |
  | `rounded-button-sm` | 8px | Small buttons |
  | `rounded-control` | 10px | Buttons, list rows, square icon buttons |
  | `rounded-input` | 12px | Text fields, selects, text areas |
  | `rounded-card` | 16px | Cards, panels, disclosures |
  | `rounded-sheet` | 20px | Sheets, dialogs, popovers |
  | `rounded-container` | 24px | The hero, large containers |
  | `rounded-window` | 32px | Window-sized wrappers |
  | `rounded-full` | circle | Avatars, dots, the Add button, round icon buttons, segmented controls, progress bars |

- Fixed bottom bars pad with `.pb-bar`: `max(16px, env(safe-area-inset-bottom))`.
  The page clears the tab bar with `.pb-safe`.
- A long screen keeps its one next step in reach with `ActionBar`, placed last.
  Below `lg` it is a full-bleed `.nav-surface` bar stacked on the tab bar (the
  shell publishes the bars' heights as `--tab-bar-height` and
  `--header-height`). At `lg` it is a `rounded-sheet` panel floating 24px off
  the bottom. At the end of the page it rests where it rode, and its material,
  hairline and shadow fade out over the last 16px of scroll, as iOS bars do at
  a scroll edge; on a page too short to scroll it is the button alone. While it
  shows, a control scrolled to stays clear of the header and both bottom bars.

## Navigation and structure

- Wide screens use a split view: a sidebar that folds to icons, separated
  from the screen by a hairline. Phones use the frosted tab bar.
- Segmented controls (`Segmented`) are a pill track washed with copper at 8%,
  with the chosen segment raised as a solid pill with a soft shadow.
- Sheets (`Sheet`) slide up from the bottom on a phone, over a dimmed
  backdrop, with Apple's grabber (36 x 5px, rounded, ink at 30%), and settle in
  place as a dialog on a wide screen.
- Overlays (bars, menus, popovers, sheets) use a material, never an opaque
  fill: `.nav-surface` (72%) or `.material-thick` (80%), each a 20px blur with
  saturation at 180%.

## Motion

- Two curves only: `var(--ease-spring)` = `cubic-bezier(0.25, 1, 0.5, 1)` for
  anything that responds to a touch, and `var(--ease-out)` =
  `cubic-bezier(0.16, 1, 0.3, 1)` for things arriving. Never `linear`,
  `ease-in`, `ease-out` or `ease-in-out`, and never Tailwind's default
  transition curve: any `transition-*` utility gets `duration-300` and
  `ease-[var(--ease-spring)]` beside it.
- Animate transform, opacity, colours and shadows only, never `transition-all`
  and never layout.
- `.press` on every control: scale 1.015 under a pointer (hover-capable
  devices only), an immediate dip to 0.96 at 80% opacity when pressed, and a
  spring back. `.liftable` does the same for tappable cards, plus a lifted
  shadow.
- Focus: a 2px copper outline, offset 2px, on everything; inputs instead turn
  their border copper with a soft copper glow. Don't remove outlines.
- Reduced motion turns all of it off (see the end of `globals.css`).

## Components

- Buttons (`form.tsx`): `PrimaryButton` (copper fill, white text, 10px
  radius, 48px tall, full width) for the one thing a screen is for, and only
  one on screen at a time; `SecondaryButton` (copper wash, copper text) for
  supporting actions; `BorderlessButton` (copper text, a wash under a pointer)
  for quiet ones; `DestructiveButton` (red wash, red text, red from the first
  tap) for deleting or replacing; `RemoveButton` (secondary text, red under a
  pointer) for taking one entry out of a list. A link styled as a button uses
  the matching class string from `styles.ts`.
- Overriding a colour by adding a utility next to one already in a class
  string does not work reliably: Tailwind decides which of two same-property
  utilities wins, not the order they are written in. Use the right variant.
- Inputs: `TextInput`, `TextArea`, `Select`. They use 17px text, because
  Safari zooms into any field under 16px. Labels sit above, from `Field`,
  which also shows a validation `error` in the critical tone.
- Empty states (`EmptyState`): a thin-stroke icon, a bold title, a sentence on
  why it is empty, and a required action that fills it.
