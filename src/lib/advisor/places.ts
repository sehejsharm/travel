import type { Candidate } from "./types";

/**
 * Tier three: Google Places Text Search. Cheap per call but not free, so it
 * only runs when the two free tiers came up short. Returns an empty list
 * rather than throwing when there is no key — the waterfall moves on.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = "places.displayName,places.formattedAddress,places.location,places.editorialSummary,places.priceLevel,places.rating";

const PRICE_HINTS: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "Cheap",
  PRICE_LEVEL_MODERATE: "Mid-priced",
  PRICE_LEVEL_EXPENSIVE: "Expensive",
  PRICE_LEVEL_VERY_EXPENSIVE: "Very expensive",
};

interface PlacesResponse {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    editorialSummary?: { text?: string };
    priceLevel?: string;
    rating?: number;
  }[];
}

export function hasPlacesKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export async function searchPlaces(
  query: string,
  limit = 6,
  fetchImpl: typeof fetch = fetch,
): Promise<Candidate[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: limit }),
    });

    if (!response.ok) {
      console.warn(`Places search failed (${response.status}).`);
      return [];
    }

    const payload = (await response.json()) as PlacesResponse;

    return (payload.places ?? []).flatMap((place) => {
      const name = place.displayName?.text;
      if (!name) return [];

      const price = place.priceLevel ? PRICE_HINTS[place.priceLevel] : undefined;
      const rating = place.rating ? `rated ${place.rating.toFixed(1)}` : undefined;

      return [
        {
          name,
          detail:
            place.editorialSummary?.text ??
            [price, rating].filter(Boolean).join(", ") ??
            place.formattedAddress,
          city: undefined,
          tier: "places" as const,
          attribution: "Google Places",
        } satisfies Candidate,
      ];
    });
  } catch (error) {
    if ((error as Error).name !== "AbortError") console.warn("Places search failed:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
