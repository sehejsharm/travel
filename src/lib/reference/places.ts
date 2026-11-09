import type { PlaceRef } from "../domain/types";
import { AIRPORT_LIST } from "./airports";
import { CITIES, type City } from "./cities";
import { fold, hasWords } from "./text";

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
    aliases: ["lake kawaguchi", "kawaguchiko", "fujikawaguchiko", "mount fuji view", "mt fuji"],
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

/**
 * A name as people type it, accents and all folded away, with a possessive
 * dropped first: fold() joins an apostrophe, which keeps "O'Hare" one word but
 * would make "Tokyo's" "tokyos".
 */
function plain(value: string): string {
  return fold(value.replace(/['`\u00b4\u2018\u2019\u02bb\u02bc]s\b/gi, " "));
}

/**
 * A listed name in each form people type it. An apostrophe is written as
 * nothing or as a space, so "Xi'an" is both "xian" and "xi an".
 */
function forms(name: string): string[] {
  const joined = plain(name);
  const split = plain(name.replace(/['`\u00b4\u2018\u2019\u02bb\u02bc]/g, " "));
  return split === joined ? [joined] : [joined, split];
}

// Local names tickets print for a city: Trenitalia writes "Milano Centrale".
const LOCAL_NAMES: Record<string, string[]> = { Milan: ["Milano"] };

// Folded once, when the module loads, rather than on every lookup.
const LANDMARKS = GAZETTEER.map((entry) => ({ entry, aliases: entry.aliases.flatMap(forms) }));
const CITY_NAMES = CITIES.map((city) => ({
  city,
  names: [city.name, ...(LOCAL_NAMES[city.name] ?? [])].flatMap(forms),
}));
const CITY_WORDS = new Set(CITY_NAMES.flatMap(({ names }) => names));
const AIRPORTS = AIRPORT_LIST.map((airport) => {
  const names = forms(airport.name);
  // An airport called by its city's name alone ("Zurich", "Munich") stands
  // for the city unless the text says airport: "Kunsthaus Zürich" is not ZRH.
  return { airport, names, cityNamed: names.some((name) => CITY_WORDS.has(name)) };
});
const CODES = new Set(AIRPORT_LIST.map((airport) => airport.iata));

/**
 * The airport codes a text names. A code counts only in capitals, as flights
 * write them: "Los Angeles" is not Lagos (LOS), nor "per diem" Perth (PER). A
 * hyphen joins a word, so "SEA-VIEW" and "ADD-ONS" name no airport, while
 * "DEL-HND" names two.
 */
function codesIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const word of text.split(/[^\p{L}\p{N}-]+/u)) {
    const parts = word.split("-");
    if (parts.every((part) => CODES.has(part))) parts.forEach((part) => found.add(part));
  }
  return found;
}

/**
 * Resolves free text to a known place: a specific landmark where one matches,
 * otherwise the city it names. Returns undefined rather than guessing — an
 * ungrounded item is still filed, it just sits out the distance checks.
 */
export function groundPlace(text: string): PlaceRef | undefined {
  const needle = plain(text);
  if (!needle) return undefined;

  let best: { entry: GazetteerEntry; score: number } | undefined;

  // Names match as whole words: "Malaysia" does not name Malé, nor "Festival" Fes.
  for (const { entry, aliases } of LANDMARKS) {
    for (const alias of aliases) {
      if (!hasWords(needle, alias)) continue;
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
  const codes = codesIn(text);
  const saysAirport = hasWords(needle, "airport");
  for (const { airport, names, cityNamed } of AIRPORTS) {
    const named = (!cityNamed || saysAirport) && names.some((name) => hasWords(needle, name));
    if (codes.has(airport.iata) || named) {
      return {
        name: `${airport.name} (${airport.iata})`,
        city: airport.city,
        countryCode: airport.countryCode,
        point: airport.point,
      };
    }
  }

  // Longest city name wins, so "New York" beats a stray match on "York".
  let longest: { city: City; name: string } | undefined;
  for (const { city, names } of CITY_NAMES) {
    for (const name of names) {
      if (!hasWords(needle, name)) continue;
      if (!longest || name.length > longest.name.length) longest = { city, name };
    }
  }

  if (!longest) return undefined;
  const { city } = longest;

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
  const needle = plain(text);

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

/**
 * Type-ahead for a flight's ends, which are airports and nothing else. Nothing
 * is offered for an empty box: a list of arbitrary airports is noise. Accents
 * are folded, so "Malaga" finds Málaga and "Zürich" finds Zurich.
 */
export function suggestAirports(text: string, limit = 6): PlaceSuggestion[] {
  const needle = fold(text);
  if (!needle) return [];
  const rank = (candidates: string[]) => {
    for (const candidate of candidates) {
      if (candidate.startsWith(needle)) return 3;
      if (candidate.includes(needle)) return 2;
    }
    return 0;
  };

  return AIRPORT_LIST.map((airport) => ({
    name: `${airport.name} (${airport.iata})`,
    detail: `${airport.city}, ${airport.countryCode}`,
    rank: rank([fold(airport.name), airport.iata.toLowerCase(), fold(airport.city)]),
  }))
    .filter((candidate) => candidate.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.length - b.name.length)
    .slice(0, limit)
    .map(({ name, detail }) => ({ name, detail }));
}

function rankOf(needle: string, name: string, aliases: string[] = []): number {
  if (!needle) return 1;
  for (const candidate of [name, ...aliases].flatMap(forms)) {
    if (candidate.startsWith(needle)) return 3;
    if (candidate.includes(needle)) return 2;
  }
  return 0;
}
