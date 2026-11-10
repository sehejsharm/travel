import { describe, expect, it } from "vitest";
import { AIRPORT_LIST } from "./airports";
import { CITIES } from "./cities";
import { countryBounds } from "./country-bounds";
import { COUNTRY_LIST } from "./countries";

/** Places left out of their country's box on purpose: they are far off its main part. */
const FAR_OFF = new Set(["Madeira", "Honolulu", "HNL"]);

describe("country boxes", () => {
  it("has a well-formed box for every destination country", () => {
    for (const country of COUNTRY_LIST) {
      const bounds = countryBounds(country.code);
      expect(bounds, country.code).toBeDefined();
      const [west, south, east, north] = bounds!;
      expect(west, country.code).toBeLessThan(east);
      expect(south, country.code).toBeLessThan(north);
      expect(west, country.code).toBeGreaterThanOrEqual(-180);
      expect(east, country.code).toBeLessThanOrEqual(180);
      expect(south, country.code).toBeGreaterThanOrEqual(-90);
      expect(north, country.code).toBeLessThanOrEqual(90);
    }
  });

  it("holds every city and airport the app knows in that country", () => {
    const places = [
      ...CITIES.map((city) => ({ id: city.name, countryCode: city.countryCode, point: city.point })),
      ...AIRPORT_LIST.map((airport) => ({ id: airport.iata, countryCode: airport.countryCode, point: airport.point })),
    ];
    const outside = places.filter(({ id, countryCode, point }) => {
      const bounds = countryBounds(countryCode);
      if (!bounds || FAR_OFF.has(id)) return false;
      const [west, south, east, north] = bounds;
      return point.lng < west || point.lng > east || point.lat < south || point.lat > north;
    });

    expect(outside.map(({ id, countryCode }) => `${id} (${countryCode})`)).toEqual([]);
  });

  it("leaves far-off territories out of the box", () => {
    const [west, south] = countryBounds("FR")!;
    // French Guiana, at 4°N 53°W, would stretch France's box across the Atlantic.
    expect(west).toBeGreaterThan(-6);
    expect(south).toBeGreaterThan(41);
  });

  it("does not know a country it has no box for", () => {
    expect(countryBounds("XX")).toBeUndefined();
    expect(countryBounds(undefined)).toBeUndefined();
  });
});
