import { CITIES } from "./cities";
import { COUNTRY_LIST, getCountry, type CountryInfo } from "./countries";

/**
 * One searchable list of places you can point a trip at. A destination is
 * either a country or a city inside one — either way it resolves to a country
 * code, which is what every check actually runs on.
 */
export interface Destination {
  /** "JP" for a country, "JP:Kyoto" for a city, so chips stay distinct. */
  id: string;
  label: string;
  countryCode: string;
  kind: "country" | "city";
  /** The country's own name, shown under a city. */
  countryName: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_ENTRIES: Destination[] = COUNTRY_LIST.map((country) => ({
  id: country.code,
  label: country.name,
  countryCode: country.code,
  kind: "country",
  countryName: country.name,
}));

const CITY_ENTRIES: Destination[] = CITIES.flatMap((city) => {
  const country = getCountry(city.countryCode);
  if (!country) return [];
  return [
    {
      id: `${city.countryCode}:${city.name}`,
      label: city.name,
      countryCode: city.countryCode,
      kind: "city" as const,
      countryName: country.name,
    },
  ];
});

export const DESTINATIONS: Destination[] = [...COUNTRY_ENTRIES, ...CITY_ENTRIES];

/**
 * Typeahead over both lists. A country outranks a city on an equal match,
 * because "Japan" should not be buried under a Japanese city of the same name.
 */
export function searchDestinations(query: string, limit = 7): Destination[] {
  const needle = normalize(query);
  if (!needle) return [];

  const scored = DESTINATIONS.flatMap((destination) => {
    const label = normalize(destination.label);
    const country = normalize(destination.countryName);

    let score = 0;
    if (label === needle) score = 5;
    else if (label.startsWith(needle)) score = 4;
    else if (label.includes(needle)) score = 3;
    else if (destination.kind === "city" && country.startsWith(needle)) score = 1;

    if (score === 0) return [];
    return [{ destination, score: score + (destination.kind === "country" ? 0.5 : 0) }];
  });

  return scored
    .sort((a, b) => b.score - a.score || a.destination.label.length - b.destination.label.length)
    .slice(0, limit)
    .map((entry) => entry.destination);
}

export function findDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((destination) => destination.id === id);
}

/** What the chips on a trip resolve to: one entry per country, deduplicated. */
export function countriesOf(ids: string[]): CountryInfo[] {
  const codes = [...new Set(ids.map((id) => id.split(":")[0].toUpperCase()))];
  return codes
    .map((code) => getCountry(code))
    .filter((country): country is CountryInfo => Boolean(country));
}
