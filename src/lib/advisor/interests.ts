/**
 * The sections a trip gets divided into. Picking these up front is what makes
 * a suggestion feel addressed to you rather than to the average tourist —
 * the same move as being asked your favourite genres on first run.
 */
export interface Interest {
  id: string;
  label: string;
  emoji: string;
  /** Shown under the label in the picker. */
  blurb: string;
  /** What the advisor should go looking for under this heading. */
  looksFor: string;
}

export const INTERESTS: Interest[] = [
  {
    id: "food",
    label: "Eating",
    emoji: "🍜",
    blurb: "Restaurants, markets, street food",
    looksFor: "restaurants, food markets, street food streets and famous local dishes",
  },
  {
    id: "coffee",
    label: "Coffee & bakeries",
    emoji: "☕️",
    blurb: "Somewhere to sit and read",
    looksFor: "speciality coffee roasters, cafés worth sitting in, and bakeries",
  },
  {
    id: "nightlife",
    label: "Nights out",
    emoji: "🍸",
    blurb: "Bars, live music, late food",
    looksFor: "cocktail bars, live music venues, night markets and late-night food",
  },
  {
    id: "nature",
    label: "Outdoors",
    emoji: "🏞️",
    blurb: "Parks, hikes, viewpoints",
    looksFor: "parks, gardens, hikes, viewpoints and day trips into nature",
  },
  {
    id: "beach",
    label: "Water",
    emoji: "🏝️",
    blurb: "Beaches, islands, swimming",
    looksFor: "beaches, swimming spots, islands and boat trips",
  },
  {
    id: "art",
    label: "Art & museums",
    emoji: "🖼️",
    blurb: "Galleries, exhibitions, collections",
    looksFor: "museums, galleries, exhibitions and artist studios",
  },
  {
    id: "architecture",
    label: "Buildings",
    emoji: "🏛️",
    blurb: "Landmarks, temples, old towns",
    looksFor: "landmark buildings, temples, old quarters and notable architecture",
  },
  {
    id: "shopping",
    label: "Shopping",
    emoji: "🛍️",
    blurb: "Markets, vintage, design",
    looksFor: "markets, vintage shops, design stores and neighbourhoods to browse",
  },
  {
    id: "adventure",
    label: "Adventure",
    emoji: "🧗",
    blurb: "Diving, climbing, riding",
    looksFor: "diving, climbing, cycling, surfing and other things you book a guide for",
  },
  {
    id: "wellness",
    label: "Slowing down",
    emoji: "♨️",
    blurb: "Baths, spas, quiet corners",
    looksFor: "hot springs, bath houses, spas and quiet places to do nothing",
  },
  {
    id: "history",
    label: "History",
    emoji: "📜",
    blurb: "Ruins, memorials, walking tours",
    looksFor: "historic sites, ruins, memorials and walking tours with a story",
  },
  {
    id: "family",
    label: "With kids",
    emoji: "🧸",
    blurb: "Things that work for small people",
    looksFor: "aquariums, zoos, playgrounds, science museums and family-friendly outings",
  },
];

export function getInterest(id: string): Interest | undefined {
  return INTERESTS.find((interest) => interest.id === id);
}

/** Everything, in a sensible order, for a traveller who has picked nothing. */
export const DEFAULT_INTERESTS = ["food", "nature", "art", "architecture"];
