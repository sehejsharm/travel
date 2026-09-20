import type { DivertInterest } from "./types";

/**
 * The quick things one person peels off for while the rest keep going. Each
 * carries how long it usually takes, because that number is what decides
 * where the group can be met again.
 */
export const DIVERT_INTERESTS: DivertInterest[] = [
  {
    id: "coffee",
    title: "Grab coffee",
    icon: "cup",
    category: "coffee",
    blurb: "A proper cup, somewhere to sit",
    dwellMinutes: 20,
  },
  {
    id: "photo",
    title: "Photo spot",
    icon: "camera",
    category: "sights",
    blurb: "The shot the group won't wait for",
    dwellMinutes: 15,
  },
  {
    id: "bite",
    title: "Quick bite",
    icon: "bowl",
    category: "food",
    blurb: "Something fast, eaten standing",
    dwellMinutes: 30,
  },
  {
    id: "shopping",
    title: "Shopping",
    icon: "bag",
    category: "shopping",
    blurb: "One shop, in and out",
    dwellMinutes: 40,
  },
  {
    id: "rest",
    title: "Rest spot",
    icon: "bench",
    category: "rest",
    blurb: "Sit down, charge the phone",
    dwellMinutes: 20,
  },
];

export function getDivertInterest(id: string): DivertInterest | undefined {
  return DIVERT_INTERESTS.find((interest) => interest.id === id);
}

/** The interests behind a set of ids, in the picker's order and without repeats. */
export function interestsFor(ids: string[]): DivertInterest[] {
  const wanted = new Set(ids);
  return DIVERT_INTERESTS.filter((interest) => wanted.has(interest.id));
}

/** Minutes away from the group, doing all of it. Never less than a real pause. */
export function dwellFor(interests: DivertInterest[]): number {
  const total = interests.reduce((sum, interest) => sum + interest.dwellMinutes, 0);
  return Math.max(10, total);
}
