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
  {
    id: "gems",
    label: "Hidden gems",
    emoji: "💎",
    blurb: "Off the tourist trail",
    looksFor:
      "lesser-known towns, villages and islands, quiet regions and uncrowded alternatives to famous spots",
  },
  {
    id: "wildlife",
    label: "Wildlife",
    emoji: "🐘",
    blurb: "Animals in the wild",
    looksFor: "safaris, wildlife reserves, ethical sanctuaries, whale watching and marine encounters",
  },
  {
    id: "local",
    label: "Local life",
    emoji: "🏘️",
    blurb: "Live like a local",
    looksFor: "everyday neighbourhoods, homestays, village visits, local markets and traditional crafts",
  },
  {
    // Keep this id: the festival data elsewhere in the app is matched to it.
    id: "festivals",
    label: "Festivals & shows",
    emoji: "🎭",
    blurb: "What's on while you're there",
    looksFor: "festivals, carnivals, concerts, theatre, opera and seasonal events",
  },
  {
    id: "classes",
    label: "Classes & workshops",
    emoji: "🧶",
    blurb: "Learn a local skill",
    looksFor: "cooking classes, craft workshops, dance lessons and language schools",
  },
  {
    id: "social",
    label: "Meet people",
    emoji: "👋",
    blurb: "Make travel friends",
    looksFor: "social hostels, group dinners, pub crawls, language exchanges and traveller meetups",
  },
  {
    id: "camping",
    label: "Camping & road trips",
    emoji: "🏕️",
    blurb: "On the road and under canvas",
    looksFor: "campsites, campervan routes, motorbike loops, scenic drives and overland journeys",
  },
  {
    id: "daytrips",
    label: "Day trips",
    emoji: "🚆",
    blurb: "Easy escapes from the city",
    looksFor: "nearby towns, ruins, islands and scenery you can get to and back from in a day",
  },
  {
    id: "photo",
    label: "Photo spots",
    emoji: "📸",
    blurb: "Get the shot",
    looksFor: "postcard viewpoints, sunrise spots at landmarks and photo walks",
  },
  {
    id: "film",
    label: "Film locations",
    emoji: "🎬",
    blurb: "Seen it on screen",
    looksFor: "filming locations, studio tours, and film and TV walking tours",
  },
];

export function getInterest(id: string): Interest | undefined {
  return INTERESTS.find((interest) => interest.id === id);
}

/** Everything, in a sensible order, for a traveller who has picked nothing. */
export const DEFAULT_INTERESTS = ["food", "nature", "art", "architecture"];

/**
 * The most sections one Discover search fills. /api/advise keeps only this
 * many and drops the rest, so the picker stops here instead: past it, the
 * ones dropped would be whichever came last, without a word.
 */
export const MAX_INTERESTS = 8;

/**
 * Picking or unpicking one. The answer is in the picker's order, holds only
 * interests that exist, and never grows past MAX_INTERESTS; unpicking always
 * works, so a trip that somehow holds more can always come back under it.
 */
export function togglePick(selected: string[], id: string): string[] {
  const next = new Set(selected.filter((picked) => getInterest(picked)));

  if (next.has(id)) next.delete(id);
  else if (next.size < MAX_INTERESTS && getInterest(id)) next.add(id);

  return INTERESTS.filter((interest) => next.has(interest.id)).map((interest) => interest.id);
}
