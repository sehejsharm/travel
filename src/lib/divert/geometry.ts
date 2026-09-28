import type { GeoPoint } from "../domain/types";
import { haversineKm } from "../geo";

/** Straight-line metres, rounded, for distances short enough to walk. */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  return Math.round(haversineKm(a, b) * 1000);
}

/** The point a fraction of the way from one to the other. Fine over a few km. */
export function lerp(from: GeoPoint, to: GeoPoint, fraction: number): GeoPoint {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

const METRES_PER_DEGREE = 111_320;

/** A point some metres away on a compass bearing, for placing a made-up spot. */
export function offsetPoint(from: GeoPoint, bearingDeg: number, metres: number): GeoPoint {
  const bearing = (bearingDeg * Math.PI) / 180;
  const latScale = Math.cos((from.lat * Math.PI) / 180);

  return {
    lat: round(from.lat + (metres * Math.cos(bearing)) / METRES_PER_DEGREE),
    lng: round(from.lng + (metres * Math.sin(bearing)) / (METRES_PER_DEGREE * latScale)),
  };
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
