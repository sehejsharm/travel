import type { PlaceRef } from "./domain/types";

/**
 * Google Maps links that need no API key. The embed endpoint renders a real
 * map in an iframe, and the search and directions endpoints hand off to the
 * Maps app on a phone.
 */

function query(place: PlaceRef): string {
  if (place.point) return `${place.point.lat},${place.point.lng}`;
  return [place.name, place.city].filter(Boolean).join(", ");
}

export function mapEmbedUrl(place: PlaceRef, zoom = 15): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query(place))}&z=${zoom}&output=embed`;
}

/** An embed framing every pin, for the trip overview. */
export function mapEmbedForPlaces(places: PlaceRef[]): string | undefined {
  const points = places.map((place) => place.point).filter(Boolean) as { lat: number; lng: number }[];
  if (points.length === 0) return undefined;

  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;

  // Zoom out as the pins spread, so the whole trip stays in frame.
  const spread = Math.max(
    ...points.map((point) => Math.abs(point.lat - lat) + Math.abs(point.lng - lng)),
    0.01,
  );
  const zoom = spread > 20 ? 3 : spread > 5 ? 5 : spread > 1 ? 8 : spread > 0.2 ? 11 : 13;

  return `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
}

export function openInMapsUrl(place: PlaceRef): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(place))}`;
}

export function directionsUrl(from: PlaceRef, to: PlaceRef): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    query(from),
  )}&destination=${encodeURIComponent(query(to))}`;
}
