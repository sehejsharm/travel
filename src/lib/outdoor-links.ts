import { groundPlace } from "./reference/places";

/**
 * Links out to AllTrails and eBird, for the Outdoors and Wildlife interests on
 * Discover. Neither needs an API key or calls anything from Manifest: the link
 * opens the other site with only the place in the address.
 */

/** The interests the links belong to. Their ids are matched in advisor/interests.ts. */
export const TRAILS_INTEREST = "nature";
export const BIRDS_INTEREST = "wildlife";

/** About 25 km, in degrees of latitude: a day's reach from the city. */
const REACH = 0.22;

/**
 * AllTrails' trail map, framed on a box around the place. Undefined when the
 * place cannot be located, rather than a link that opens somewhere else.
 */
export function allTrailsUrl(where: string): string | undefined {
  const point = groundPlace(where)?.point;
  if (!point) return undefined;

  // A degree of longitude shrinks towards the poles, so widen it to match.
  const lngReach = REACH / Math.cos((point.lat * Math.PI) / 180);
  const at = (value: number) => value.toFixed(4);

  return (
    "https://www.alltrails.com/explore" +
    `?b_tl_lat=${at(point.lat + REACH)}&b_tl_lng=${at(point.lng - lngReach)}` +
    `&b_br_lat=${at(point.lat - REACH)}&b_br_lng=${at(point.lng + lngReach)}`
  );
}

/** eBird's page for a country: its recent sightings, hotspots and species. */
export function eBirdUrl(countryCode: string): string {
  return `https://ebird.org/region/${countryCode.toUpperCase()}`;
}
