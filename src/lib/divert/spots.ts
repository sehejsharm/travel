import type { GeoPoint } from "../domain/types";
import { groundPlace } from "../reference/places";
import { distanceM, offsetPoint } from "./geometry";
import type { DivertCategory, DivertSpot } from "./types";

/**
 * A place's coordinates from the app's own gazetteer, so a place both lists
 * know about is only ever typed once. Throws on a miss, which the tests hit
 * at import time rather than a user hitting it on a screen.
 */
export function gazetteerPoint(name: string): GeoPoint {
  const point = groundPlace(name)?.point;
  if (!point) throw new Error(`"${name}" is not in the gazetteer`);
  return point;
}

/** How far someone will go for a coffee before it stops being a quick detour. */
export const SPOT_RADIUS_M = 1500;

/**
 * Places worth peeling off for, clustered around the sample trip's stops so
 * the flow has something real to offer out of the box. This stands in for a
 * places lookup the same way the gazetteer does: swap the source, keep the
 * shape.
 */
const SPOTS: DivertSpot[] = [
  // Azabudai and Roppongi
  { id: "blue-bottle-roppongi", name: "Blue Bottle Coffee, Roppongi", category: "coffee", point: { lat: 35.664, lng: 139.7318 }, detail: "Quiet upstairs seating" },
  { id: "azabudai-green", name: "Azabudai Hills Central Green", category: "sights", point: { lat: 35.6612, lng: 139.741 }, detail: "Lawn with Tokyo Tower framed behind it" },
  { id: "azabudai-market", name: "Azabudai Hills Market", category: "food", point: { lat: 35.6607, lng: 139.7402 }, detail: "Food hall counters, fast" },
  { id: "donki-roppongi", name: "Don Quijote, Roppongi", category: "shopping", point: { lat: 35.6631, lng: 139.7343 }, detail: "Everything, open late" },
  { id: "shiba-park", name: "Shiba Park", category: "rest", point: { lat: 35.6564, lng: 139.748 }, detail: "Benches with the tower over the trees" },

  // Mitaka and Kichijoji
  { id: "light-up-kichijoji", name: "Light Up Coffee, Kichijoji", category: "coffee", point: { lat: 35.7047, lng: 139.5798 }, detail: "Single-origin pour-overs" },
  { id: "inokashira-bridge", name: "Inokashira Pond bridge", category: "sights", point: { lat: 35.7003, lng: 139.575 }, detail: "Swan boats and the pond in one frame" },
  { id: "harmonica-yokocho", name: "Harmonica Yokocho", category: "food", point: { lat: 35.7036, lng: 139.5797 }, detail: "Alley of tiny counters by the station" },
  { id: "loft-kichijoji", name: "Loft, Kichijoji", category: "shopping", point: { lat: 35.704, lng: 139.5794 }, detail: "Stationery floor" },
  { id: "inokashira-benches", name: "Inokashira Park benches", category: "rest", point: { lat: 35.6998, lng: 139.5738 }, detail: "Shade by the water" },

  // Shibuya
  { id: "streamer-shibuya", name: "Streamer Coffee Company, Shibuya", category: "coffee", point: { lat: 35.6607, lng: 139.7038 }, detail: "Big lattes, big room" },
  { id: "scramble-crossing", name: "Shibuya Crossing", category: "sights", point: gazetteerPoint("Shibuya Crossing"), detail: "From the station bridge, not the road" },
  { id: "uogashi-shibuya", name: "Uogashi Nihon-Ichi standing sushi", category: "food", point: { lat: 35.6598, lng: 139.7019 }, detail: "Ten minutes, standing" },
  { id: "donki-shibuya", name: "MEGA Don Quijote, Shibuya", category: "shopping", point: { lat: 35.6614, lng: 139.6993 }, detail: "Six floors, easy to lose an hour" },
  { id: "miyashita-rooftop", name: "Miyashita Park rooftop", category: "rest", point: { lat: 35.6616, lng: 139.7024 }, detail: "Grass on top of the shops" },

  // Shinjuku
  { id: "verve-shinjuku", name: "Verve Coffee Roasters, Shinjuku", category: "coffee", point: { lat: 35.6905, lng: 139.7008 }, detail: "Right by the south exit" },
  { id: "tmg-observatory", name: "Metropolitan Government observation deck", category: "sights", point: { lat: 35.6896, lng: 139.6921 }, detail: "Free, 45th floor, Fuji on a clear day" },
  { id: "ichiran-shinjuku", name: "Ichiran, Shinjuku Central East", category: "food", point: { lat: 35.6928, lng: 139.7024 }, detail: "Booth ramen, no talking required" },
  { id: "hands-shinjuku", name: "Hands, Shinjuku", category: "shopping", point: { lat: 35.688, lng: 139.7027 }, detail: "Travel gadgets on the upper floors" },
  { id: "shinjuku-central-park", name: "Shinjuku Central Park", category: "rest", point: { lat: 35.6903, lng: 139.6913 }, detail: "Benches under the towers" },

  // Asakusa
  { id: "fuglen-asakusa", name: "Fuglen Asakusa", category: "coffee", point: { lat: 35.7142, lng: 139.7935 }, detail: "Norwegian roaster, sit-down" },
  { id: "sumida-skytree", name: "Sumida Park riverside", category: "sights", point: { lat: 35.7135, lng: 139.8005 }, detail: "Skytree across the water" },
  { id: "asakusa-menchi", name: "Asakusa Menchi", category: "food", point: { lat: 35.7122, lng: 139.7961 }, detail: "One menchi-katsu, eaten on the spot" },
  { id: "kappabashi", name: "Kappabashi Kitchen Town", category: "shopping", point: { lat: 35.7135, lng: 139.788 }, detail: "Knives and plastic food" },
  { id: "asakusa-terrace", name: "Tourist Information Center terrace", category: "rest", point: { lat: 35.7108, lng: 139.7963 }, detail: "Free eighth-floor seats over Nakamise" },

  // Tsukiji and Ginza
  { id: "turret-tsukiji", name: "Turret Coffee, Tsukiji", category: "coffee", point: { lat: 35.6668, lng: 139.7714 }, detail: "Tiny, strong, cash only" },
  { id: "tsukiji-honganji", name: "Tsukiji Hongan-ji", category: "sights", point: { lat: 35.6656, lng: 139.7723 }, detail: "Temple that looks like nowhere else in Tokyo" },
  { id: "kagari-ginza", name: "Kagari ramen, Ginza", category: "food", point: { lat: 35.672, lng: 139.766 }, detail: "Chicken paitan, short queue before noon" },
  { id: "ginza-six", name: "Ginza Six", category: "shopping", point: { lat: 35.6698, lng: 139.764 }, detail: "Rooftop garden when you are done" },
  { id: "hama-rikyu", name: "Hama-rikyu Gardens", category: "rest", point: { lat: 35.66, lng: 139.7635 }, detail: "Teahouse on the pond" },

  // Ueno and Yanaka
  { id: "kayaba-yanaka", name: "Kayaba Coffee, Yanaka", category: "coffee", point: { lat: 35.7233, lng: 139.77 }, detail: "Old house, egg sandwiches" },
  { id: "shinobazu-lotus", name: "Shinobazu Pond", category: "sights", point: { lat: 35.7125, lng: 139.7702 }, detail: "Lotus leaves to the horizon in summer" },
  { id: "ameyoko-food", name: "Ameyoko street food", category: "food", point: { lat: 35.71, lng: 139.7745 }, detail: "Kebabs and fruit on sticks" },
  { id: "yanaka-ginza", name: "Yanaka Ginza", category: "shopping", point: { lat: 35.7268, lng: 139.7658 }, detail: "Old shopping street, cat souvenirs" },
  { id: "ueno-fountain", name: "Ueno Park fountain", category: "rest", point: { lat: 35.7155, lng: 139.7737 }, detail: "Benches facing the museum" },

  // Kyoto
  { id: "vermillion-cafe", name: "Vermillion Cafe", category: "coffee", point: { lat: 34.968, lng: 135.7737 }, detail: "Terrace over the shrine pond" },
  { id: "yotsutsuji", name: "Yotsutsuji lookout", category: "sights", point: { lat: 34.9647, lng: 135.7827 }, detail: "Halfway up, the city below" },
  { id: "inari-sushi", name: "Inari-sushi stalls", category: "food", point: { lat: 34.9678, lng: 135.7712 }, detail: "On the approach, eaten walking" },
  { id: "arabica-arashiyama", name: "% Arabica, Arashiyama", category: "coffee", point: { lat: 35.0132, lng: 135.6776 }, detail: "On the river, always a queue" },
  { id: "togetsukyo", name: "Togetsukyo Bridge", category: "sights", point: { lat: 35.0129, lng: 135.6777 }, detail: "The mountain behind the bridge" },
  { id: "kameyama-park", name: "Kameyama Park", category: "rest", point: { lat: 35.0151, lng: 135.6698 }, detail: "Quiet above the bamboo" },

  // Osaka
  { id: "lilo-coffee", name: "LiLo Coffee Roasters", category: "coffee", point: { lat: 34.672, lng: 135.499 }, detail: "Roasts on site, short walk from the canal" },
  { id: "hozenji-yokocho", name: "Hozenji Yokocho", category: "sights", point: { lat: 34.6676, lng: 135.5033 }, detail: "Lantern alley behind the noise" },
  { id: "daruma-dotonbori", name: "Kushikatsu Daruma, Dotonbori", category: "food", point: { lat: 34.6683, lng: 135.5022 }, detail: "Skewers, no double dipping" },
  { id: "shinsaibashi", name: "Shinsaibashi-suji arcade", category: "shopping", point: { lat: 34.673, lng: 135.501 }, detail: "Covered, runs for blocks" },
  { id: "namba-parks", name: "Namba Parks rooftop garden", category: "rest", point: { lat: 34.662, lng: 135.5015 }, detail: "Terraces climbing the mall" },
];

const STAND_INS: Record<DivertCategory, { noun: string; detail: string }> = {
  coffee: { noun: "coffee stand", detail: "Stood in for a real café — nothing was looked up." },
  sights: { noun: "viewpoint", detail: "Stood in for a real spot — nothing was looked up." },
  food: { noun: "noodle counter", detail: "Stood in for a real place — nothing was looked up." },
  shopping: { noun: "convenience store", detail: "Stood in for a real shop — nothing was looked up." },
  rest: { noun: "bench in the shade", detail: "Stood in for a real spot — nothing was looked up." },
};

const CATEGORY_ORDER: DivertCategory[] = ["coffee", "sights", "food", "shopping", "rest"];

/**
 * A place a few hundred metres off, on a bearing that differs per category
 * so two stand-ins never land on top of each other. Deterministic, so the
 * same group position always yields the same spot and a stored one can be
 * found again.
 */
function standIn(category: DivertCategory, near: GeoPoint, anchorName?: string): DivertSpot {
  const index = CATEGORY_ORDER.indexOf(category);
  const bearing = (index * 137 + 40) % 360;
  const metres = 250 + index * 90;
  const { noun, detail } = STAND_INS[category];
  const point = offsetPoint(near, bearing, metres);

  return {
    // From where it is, so two stand-ins placed from different spots never
    // share an id and a saved one can be told apart from a fresh one.
    id: `stand-in-${category}@${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    name: `A ${noun} near ${anchorName ?? "the group"}`,
    category,
    point,
    detail,
    synthetic: true,
  };
}

/**
 * A fresh search around a stand-in places a new stand-in of the same kind,
 * with a new id, because stand-in ids come from where they sit. Offering it
 * would be a made-up alternative to a made-up place, so it is left out.
 */
export function withoutFreshStandIn(found: DivertSpot[], current?: DivertSpot | null): DivertSpot[] {
  if (!current?.synthetic) return found;
  return found.filter(
    (candidate) =>
      candidate.id === current.id ||
      !(candidate.synthetic && candidate.category === current.category),
  );
}

/**
 * The spots a picker lists: what was found, less any fresh stand-in that
 * would shadow a pinned one, with every pinned spot — the one tapped, the one
 * a running diversion was saved with — kept on the list under its own name
 * for as long as its kind is still wanted.
 */
export function listSpots(
  found: DivertSpot[],
  categories: DivertCategory[],
  pinned: (DivertSpot | null | undefined)[],
): DivertSpot[] {
  const keep = pinned.filter(
    (entry, index, all): entry is DivertSpot =>
      Boolean(entry) &&
      categories.includes(entry!.category) &&
      all.findIndex((other) => other?.id === entry!.id) === index,
  );
  const filtered = keep.reduce((list, entry) => withoutFreshStandIn(list, entry), found);
  const missing = keep.filter((entry) => !filtered.some((candidate) => candidate.id === entry.id));

  return [
    ...missing,
    ...filtered.map((candidate) => keep.find((entry) => entry.id === candidate.id) ?? candidate),
  ];
}

/**
 * The spot a picker has selected: the one tapped, then the one a running
 * diversion was saved with, while its kind is still wanted — and only then
 * the nearest on the list. So putting interests back the way they were never
 * quietly swaps the saved spot for a closer one.
 */
export function selectSpot(
  listed: DivertSpot[],
  categories: DivertCategory[],
  pinned: (DivertSpot | null | undefined)[],
): DivertSpot | undefined {
  return (
    pinned.find((entry): entry is DivertSpot => Boolean(entry) && categories.includes(entry!.category)) ??
    listed[0]
  );
}

/**
 * Spots for the categories asked for, nearest first, within a short walk of
 * where the group is. Every category gets at least one answer: when nothing
 * real is close, a stand-in is placed nearby and marked as such, so the flow
 * never dead-ends on a trip outside the bundled data.
 */
export function findSpots(
  near: GeoPoint,
  categories: DivertCategory[],
  anchorName?: string,
  limit = 6,
): DivertSpot[] {
  const wanted = new Set(categories);

  const nearby = SPOTS.filter((spot) => wanted.has(spot.category))
    .map((spot) => ({ spot, metres: distanceM(near, spot.point) }))
    .filter((entry) => entry.metres <= SPOT_RADIUS_M)
    .sort((a, b) => a.metres - b.metres);

  // The nearest of each category is always in, then the rest by distance.
  const picked = new Map<string, DivertSpot>();
  for (const category of categories) {
    const first = nearby.find((entry) => entry.spot.category === category);
    if (first) picked.set(first.spot.id, first.spot);
  }
  for (const entry of nearby) {
    if (picked.size >= limit) break;
    picked.set(entry.spot.id, entry.spot);
  }

  const covered = new Set([...picked.values()].map((spot) => spot.category));
  const standIns = categories
    .filter((category) => !covered.has(category))
    .map((category) => standIn(category, near, anchorName));

  return [...picked.values(), ...standIns].sort(
    (a, b) => distanceM(near, a.point) - distanceM(near, b.point),
  );
}
