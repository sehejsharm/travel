import type { PlaceRef } from "../domain/types";
import { AIRPORT_LIST } from "./airports";
import { CITIES } from "./cities";

interface GazetteerEntry extends PlaceRef {
  aliases: string[];
  /** Weekdays the place is shut, 0 = Sunday. */
  closedDays?: number[];
  /** Set where turning up without a ticket does not work. */
  advanceBooking?: string;
}

export interface PlaceFacts {
  closedDays?: number[];
  advanceBooking?: string;
}

/**
 * A small local gazetteer stands in for a places API. It exists so the
 * "ground" half of extract-and-ground is real: an extracted name becomes
 * coordinates, which is what the feasibility checks run on.
 */
const GAZETTEER: GazetteerEntry[] = [
  {
    name: "Shibuya Sky",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.658, lng: 139.7016 },
    aliases: ["shibuya sky", "shibuya scramble square", "shibuya observation"],
  },
  {
    name: "teamLab Borderless",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6605, lng: 139.7396 },
    aliases: ["teamlab borderless", "teamlab", "team lab", "azabudai hills teamlab"],
  },
  {
    name: "Senso-ji",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.7148, lng: 139.7967 },
    aliases: ["senso-ji", "sensoji", "asakusa temple", "asakusa"],
  },
  {
    name: "Tsukiji Outer Market",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6654, lng: 139.7707 },
    aliases: ["tsukiji", "tsukiji outer market", "tsukiji market"],
  },
  {
    name: "Shinjuku Gyoen",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6852, lng: 139.71 },
    aliases: ["shinjuku gyoen", "shinjuku garden"],
  },
  {
    name: "Meiji Jingu",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6764, lng: 139.6993 },
    aliases: ["meiji jingu", "meiji shrine"],
  },
  {
    name: "Tokyo Skytree",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.7101, lng: 139.8107 },
    aliases: ["skytree", "tokyo skytree"],
  },
  {
    name: "Omoide Yokocho",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6938, lng: 139.7 },
    aliases: ["omoide yokocho", "memory lane", "piss alley", "golden gai"],
  },
  {
    name: "Akihabara",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6984, lng: 139.7731 },
    aliases: ["akihabara", "akiba", "electric town"],
  },
  {
    name: "Ghibli Museum",
    city: "Mitaka",
    countryCode: "JP",
    point: { lat: 35.6962, lng: 139.5704 },
    aliases: ["ghibli museum", "ghibli", "mitaka ghibli"],
    closedDays: [2],
    advanceBooking: "Dated tickets only, released a month ahead and they sell out",
  },
  {
    name: "Tokyo National Museum",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.7188, lng: 139.7766 },
    aliases: ["tokyo national museum", "ueno museum"],
    closedDays: [1],
  },
  {
    name: "Shibuya Crossing",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6595, lng: 139.7005 },
    aliases: ["shibuya crossing", "scramble crossing", "hachiko"],
  },
  {
    name: "Takeshita Street",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6716, lng: 139.7031 },
    aliases: ["takeshita street", "harajuku", "takeshita dori"],
  },
  {
    name: "Tokyo Station",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.6812, lng: 139.7671 },
    aliases: ["tokyo station"],
  },
  {
    name: "Lake Kawaguchi",
    city: "Fujikawaguchiko",
    countryCode: "JP",
    point: { lat: 35.5171, lng: 138.752 },
    aliases: ["lake kawaguchi", "kawaguchiko", "mount fuji view", "mt fuji"],
  },
  {
    name: "Fushimi Inari Taisha",
    city: "Kyoto",
    countryCode: "JP",
    point: { lat: 34.9671, lng: 135.7727 },
    aliases: ["fushimi inari", "inari shrine", "torii gates"],
  },
  {
    name: "Arashiyama Bamboo Grove",
    city: "Kyoto",
    countryCode: "JP",
    point: { lat: 35.017, lng: 135.6714 },
    aliases: ["arashiyama", "bamboo grove", "bamboo forest"],
  },
  {
    name: "Kiyomizu-dera",
    city: "Kyoto",
    countryCode: "JP",
    point: { lat: 34.9949, lng: 135.7851 },
    aliases: ["kiyomizu-dera", "kiyomizu", "kiyomizudera"],
  },
  {
    name: "Dotonbori",
    city: "Osaka",
    countryCode: "JP",
    point: { lat: 34.6687, lng: 135.5013 },
    aliases: ["dotonbori", "dotombori", "glico sign"],
  },
  {
    name: "Nara Park",
    city: "Nara",
    countryCode: "JP",
    point: { lat: 34.6851, lng: 135.843 },
    aliases: ["nara park", "nara deer", "nara"],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves free text to a known place: a specific landmark where one matches,
 * otherwise the city it names. Returns undefined rather than guessing — an
 * ungrounded item is still filed, it just sits out the distance checks.
 */
export function groundPlace(text: string): PlaceRef | undefined {
  const needle = normalize(text);
  if (!needle) return undefined;

  let best: { entry: GazetteerEntry; score: number } | undefined;

  for (const entry of GAZETTEER) {
    for (const alias of entry.aliases) {
      if (!needle.includes(alias)) continue;
      const score = alias.length;
      if (!best || score > best.score) best = { entry, score };
    }
  }

  if (best) {
    return {
      name: best.entry.name,
      city: best.entry.city,
      countryCode: best.entry.countryCode,
      point: best.entry.point,
    };
  }

  // An airport next: a flight names one, and "DEL" is not a city.
  for (const airport of AIRPORT_LIST) {
    const code = airport.iata.toLowerCase();
    const byCode = new RegExp(`(^|\\s)${code}(\\s|$)`).test(needle);
    if (byCode || needle.includes(normalize(airport.name))) {
      return {
        name: `${airport.name} (${airport.iata})`,
        city: airport.city,
        countryCode: airport.countryCode,
        point: airport.point,
      };
    }
  }

  // Longest city name wins, so "New York" beats a stray match on "York".
  let city: { name: string; countryCode: string; point: { lat: number; lng: number } } | undefined;
  for (const candidate of CITIES) {
    const alias = normalize(candidate.name);
    if (!needle.includes(alias)) continue;
    if (!city || alias.length > normalize(city.name).length) city = candidate;
  }

  if (!city) return undefined;

  return {
    name: city.name,
    city: city.name,
    countryCode: city.countryCode,
    point: city.point,
  };
}

/** Opening quirks for an already-grounded place, looked up by its name. */
export function placeFacts(name: string): PlaceFacts | undefined {
  const entry = GAZETTEER.find((candidate) => candidate.name === name);
  if (!entry?.closedDays && !entry?.advanceBooking) return undefined;
  return { closedDays: entry.closedDays, advanceBooking: entry.advanceBooking };
}

export interface PlaceSuggestion {
  name: string;
  detail: string;
}

/**
 * Type-ahead over the gazetteer and the city list, so a place gets
 * coordinates while you type instead of only when the name happens to match.
 */
export function suggestPlaces(text: string, limit = 8): PlaceSuggestion[] {
  const needle = normalize(text);

  const landmarks = GAZETTEER.map((entry) => ({
    name: entry.name,
    detail: [entry.city, entry.countryCode].filter(Boolean).join(", "),
    rank: rankOf(needle, entry.name, entry.aliases),
  }));

  const airports = AIRPORT_LIST.map((airport) => ({
    name: `${airport.name} (${airport.iata})`,
    detail: `${airport.city}, ${airport.countryCode}`,
    rank: rankOf(needle, airport.name, [airport.iata.toLowerCase()]) - 0.25,
  }));

  const cities = CITIES.map((city) => ({
    name: city.name,
    detail: city.countryCode,
    // A landmark is the more useful answer when both match equally well.
    rank: rankOf(needle, city.name) - 0.5,
  }));

  return [...landmarks, ...airports, ...cities]
    .filter((candidate) => candidate.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.length - b.name.length)
    .slice(0, limit)
    .map(({ name, detail }) => ({ name, detail }));
}

function rankOf(needle: string, name: string, aliases: string[] = []): number {
  if (!needle) return 1;
  for (const candidate of [normalize(name), ...aliases]) {
    if (candidate.startsWith(needle)) return 3;
    if (candidate.includes(needle)) return 2;
  }
  return 0;
}
