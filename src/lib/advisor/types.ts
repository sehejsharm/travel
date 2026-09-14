import type { PlaceRef } from "../domain/types";

/**
 * Which tier of the waterfall an answer came from. It is shown on every
 * card: a suggestion with no traceable source is not worth giving.
 */
export type SourceTier = "saved" | "community" | "places" | "web";

export const TIER_LABELS: Record<SourceTier, string> = {
  saved: "From your own saves",
  community: "From published trips",
  places: "From Google Places",
  web: "From the web",
};

export interface Candidate {
  name: string;
  /** Set when the tier knows which section this belongs under. */
  interestId?: string;
  /** One line on what it is, in the words of whatever found it. */
  detail?: string;
  city?: string;
  countryCode?: string;
  tier: SourceTier;
  /** Where it came from, for attribution — a URL or a trip name. */
  attribution?: string;
  url?: string;
}

export interface Suggestion {
  id: string;
  interestId: string;
  name: string;
  /** Why it is worth your time, written only from what the tiers found. */
  why: string;
  place: PlaceRef;
  tier: SourceTier;
  attribution?: string;
  url?: string;
  /** Roughly what it costs, when a source said so. */
  priceHint?: string;
}

export interface AdviceSection {
  interestId: string;
  suggestions: Suggestion[];
}

export interface AdviceResult {
  destination: string;
  countryCode?: string;
  sections: AdviceSection[];
  /** Which tiers were actually consulted, cheapest first. */
  tiersUsed: SourceTier[];
  generatedAt: string;
  /** Set when a tier could not run, so the UI can say why. */
  notes?: string[];
}

export interface AdviceRequest {
  destination: string;
  countryCode?: string;
  interests: string[];
  /** Titles already filed, so the advisor does not suggest them again. */
  alreadyFiled: string[];
  /** Their own saved items for this destination — tier one. */
  saved: Candidate[];
}
