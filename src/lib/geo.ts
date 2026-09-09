import type { GeoPoint } from "./domain/types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export type TravelMode = "walk" | "transit" | "drive" | "fly";

export interface TravelEstimate {
  mode: TravelMode;
  distanceKm: number;
  minutes: number;
}

/**
 * Straight-line distance underestimates real routes, so each mode carries a
 * detour factor plus fixed overhead (waiting, parking, airport time).
 */
export function estimateTravel(from: GeoPoint, to: GeoPoint): TravelEstimate {
  const distanceKm = haversineKm(from, to);

  let mode: TravelMode;
  let speedKmh: number;
  let detour: number;
  let overheadMin: number;

  if (distanceKm < 1.2) {
    mode = "walk";
    speedKmh = 4.8;
    detour = 1.3;
    overheadMin = 2;
  } else if (distanceKm < 40) {
    mode = "transit";
    speedKmh = 22;
    detour = 1.35;
    overheadMin = 10;
  } else if (distanceKm < 600) {
    mode = "drive";
    speedKmh = 70;
    detour = 1.25;
    overheadMin = 15;
  } else {
    mode = "fly";
    speedKmh = 750;
    detour = 1.1;
    overheadMin = 180;
  }

  const minutes = Math.round((distanceKm * detour * 60) / speedKmh + overheadMin);
  return { mode, distanceKm, minutes };
}
