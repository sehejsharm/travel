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
}

export interface Trip {
  id: string;
  name: string;
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
