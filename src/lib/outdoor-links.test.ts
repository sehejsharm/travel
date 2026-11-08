import { describe, expect, it } from "vitest";
import { allTrailsCountryUrl, allTrailsUrl, eBirdUrl } from "./outdoor-links";

describe("links out for Outdoors and Wildlife", () => {
  it("frames AllTrails' map on a box around the city", () => {
    const url = new URL(allTrailsUrl("Lisbon")!);
    expect(url.origin + url.pathname).toBe("https://www.alltrails.com/explore");

    // Lisbon is at 38.7223, -9.1393: the box's corners sit either side of it.
    const top = Number(url.searchParams.get("b_tl_lat"));
    const bottom = Number(url.searchParams.get("b_br_lat"));
    const left = Number(url.searchParams.get("b_tl_lng"));
    const right = Number(url.searchParams.get("b_br_lng"));
    expect(top).toBeGreaterThan(38.7223);
    expect(bottom).toBeLessThan(38.7223);
    expect(left).toBeLessThan(-9.1393);
    expect(right).toBeGreaterThan(-9.1393);
    // Wider in longitude than in latitude, since a degree of longitude is shorter there.
    expect(right - left).toBeGreaterThan(top - bottom);
  });

  it("leaves AllTrails out for a place it cannot locate", () => {
    expect(allTrailsUrl("qqzzxx")).toBeUndefined();
  });

  it("frames AllTrails' map on a whole country", () => {
    const url = new URL(allTrailsCountryUrl("pt")!);
    expect(url.origin + url.pathname).toBe("https://www.alltrails.com/explore");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      b_tl_lat: "42.2000",
      b_tl_lng: "-9.5000",
      b_br_lat: "36.9000",
      b_br_lng: "-6.2000",
    });
  });

  it("has no country link for a country it has no box for", () => {
    expect(allTrailsCountryUrl("XX")).toBeUndefined();
  });

  it("opens eBird's page for the country", () => {
    expect(eBirdUrl("jp")).toBe("https://ebird.org/region/JP");
  });
});
