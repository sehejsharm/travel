import type { TripPurpose } from "./domain/types";

/**
 * Purpose changes defaults, never capabilities. Everything a purpose turns on
 * can be turned off, and everything it turns off can be turned back on — it
 * is a starting position, not a mode.
 */
export interface PurposeProfile {
  id: TripPurpose;
  label: string;
  emoji: string;
  /** What choosing it actually does, shown under the chips once picked. */
  effect: string;
  /** Interests pre-selected when the traveller has not chosen their own. */
  interests?: string[];
  /** Extra pre-trip tasks this kind of trip always seems to need. */
  tasks?: { label: string; detail?: string }[];
  /** Business travellers are not looking for restaurant suggestions. */
  suppressSuggestions?: boolean;
  /** Nudge toward adding the rest of the party. */
  expectsGroup?: boolean;
}

export const PURPOSES: PurposeProfile[] = [
  {
    id: "leisure",
    label: "Leisure",
    emoji: "🌤️",
    effect: "The usual: suggestions on, nothing special assumed.",
  },
  {
    id: "business",
    label: "Business",
    emoji: "💼",
    effect: "Adds a receipts and expenses checklist, and keeps Discover quiet unless you ask.",
    suppressSuggestions: true,
    tasks: [
      { label: "Keep every receipt", detail: "Photograph each one as you go — they file into the cabinet with a price." },
      { label: "Check the expense policy", detail: "Per-diem, class of travel, and what needs approval before you book." },
      { label: "Confirm the meeting addresses", detail: "Put them on days so the travel-time checks can see them." },
    ],
  },
  {
    id: "family",
    label: "Family",
    emoji: "🧸",
    effect: "Turns on the With kids suggestions.",
    interests: ["family", "food", "nature"],
  },
  {
    id: "romantic",
    label: "Honeymoon",
    emoji: "🥂",
    effect: "Leans the suggestions toward eating, slowing down and views.",
    interests: ["food", "wellness", "nature"],
  },
  {
    id: "solo",
    label: "Solo",
    emoji: "🎒",
    effect: "Assumes one traveller, and keeps the checks focused on you.",
  },
  {
    id: "group",
    label: "Group",
    emoji: "👥",
    effect: "Nudges you to add everyone, since visas and passports check per person.",
    expectsGroup: true,
  },
  {
    id: "backpacking",
    label: "Backpacking",
    emoji: "🥾",
    effect: "Expects loose dates and long stays, and leans outdoors.",
    interests: ["nature", "adventure", "food"],
  },
];

export function getPurpose(id?: TripPurpose): PurposeProfile | undefined {
  return PURPOSES.find((purpose) => purpose.id === id);
}
