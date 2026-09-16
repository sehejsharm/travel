export type ItemCategory = "place" | "activity" | "purchase" | "booking";

export type BookingKind = "flight" | "lodging" | "rail" | "car" | "tour" | "other";

export type SourceKind =
  | "screenshot"
  | "gmail"
  | "reel"
  | "tiktok"
  | "youtube"
  | "manual";

export type ExtractionMethod = "deterministic" | "llm";

export type CostStatus = "estimated" | "actual";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface PlaceRef {
  name: string;
  city?: string;
  countryCode?: string;
  point?: GeoPoint;
  /** IATA code when the place is an airport. */
  airport?: string;
}

/**
 * The extraction schema. Every downstream feature (budget rollup, conflict
 * detection, compliance checks) reads from these fields, so the extractor is
 * expected to fill as many as the source supports rather than just a title.
 */
export interface TripItem {
  id: string;
  tripId: string;
  title: string;
  category: ItemCategory;
  bookingKind?: BookingKind;
  source: SourceKind;
  sourceRef?: string;
  notes?: string;
  place?: PlaceRef;
  /** Second endpoint, for flights and other transport. */
  arrivalPlace?: PlaceRef;
  startsAt?: string;
  endsAt?: string;
  cost?: Money;
  costStatus?: CostStatus;
  confirmationCode?: string;
  travelerName?: string;
  refundableUntil?: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
  createdAt: string;
  /** Traveller who filed it, on a shared board. */
  addedBy?: string;
}

export interface Traveler {
  id: string;
  name: string;
  passportCountry: string;
  passportExpiry: string;
  insuranceFrom?: string;
  insuranceTo?: string;
  /**
   * Where this person is flying from, when that is not the trip's own origin.
   * Nationality and origin are different questions: an Indian passport holder
   * living in Berlin carries German plugs and clears German customs coming
   * home, but still needs whatever visa an Indian passport needs. Absent means
   * they set off from the trip's homeCountry, which is the common case.
   */
  originCountry?: string;
  /**
   * They have said they want a hand with the visa. Nothing is withheld either
   * way — this only decides whether the paperwork is spelled out for them.
   */
  needsVisaHelp?: boolean;
}

/**
 * Why the trip is happening. Optional, and only ever used to pick better
 * defaults — never to withhold anything.
 */
export type TripPurpose =
  | "leisure"
  | "business"
  | "family"
  | "romantic"
  | "solo"
  | "group"
  | "backpacking";

/**
 * One country, with its own dates. A trip has legs only when the traveller
 * asked for them; otherwise destinationCountries plus the trip's own dates
 * say everything, and nothing here is populated.
 */
export interface TripLeg {
  id: string;
  countryCode: string;
  /** The city picked, kept for the map and the advisor. */
  city?: string;
  startDate: string;
  endDate: string;
}

export interface Trip {
  id: string;
  name: string;
  /** Where the trip departs from — sets plugs, voltage, duty-free and jet lag. */
  homeCountry: string;
  /**
   * Where you have said you are going. Items add more as they are filed, but
   * the checks must not wait for an item to know the destination.
   */
  destinationCountries?: string[];
  startDate: string;
  endDate: string;
  budgetTarget?: Money;
  travelers: Traveler[];
  /**
   * What this traveller is into, by interest id. The advisor divides its
   * answers into these sections, so picking them shapes every suggestion.
   */
  interests?: string[];
  /**
   * A trip can exist before its dates do. The dates below still hold a
   * provisional window so the UI has something to show, but nothing that
   * depends on when you travel is claimed until this is cleared.
   */
  datesTbd?: boolean;
  /** Prompts the traveller has waved away, so they are asked once. */
  dismissedPrompts?: string[];
  /** Why the trip is happening, which shapes defaults rather than features. */
  purpose?: TripPurpose;
  /**
   * Per-country dates, when the traveller split the trip into legs. Empty or
   * absent means one blended window, which is the common case.
   */
  legs?: TripLeg[];
  /** A chosen hero hue. Absent means derived from the destination. */
  accentHue?: number;
}

export type FlagSeverity = "critical" | "warning" | "info";

export type FlagCategory = "conflict" | "compliance" | "money" | "prep";

export interface Flag {
  id: string;
  severity: FlagSeverity;
  category: FlagCategory;
  title: string;
  detail: string;
  itemIds: string[];
  /** Shown where a flag rests on reference data the user must confirm themselves. */
  verifyWith?: string;
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  place: "Places to visit",
  activity: "Things to do",
  purchase: "Stuff to buy",
  booking: "Bookings",
};

export const SOURCE_LABELS: Record<SourceKind, string> = {
  screenshot: "Screenshot",
  gmail: "Gmail",
  reel: "Reel",
  tiktok: "TikTok",
  youtube: "YouTube",
  manual: "Manual",
};
