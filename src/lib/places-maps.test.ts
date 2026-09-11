import { describe, expect, it } from "vitest";
import { directionsUrl, mapEmbedForPlaces, mapEmbedUrl, openInMapsUrl } from "./maps";
import { groundPlace, suggestPlaces } from "./reference/places";
import { flagEmoji, heroGradient } from "./theme";

describe("place suggestions", () => {
  it("puts a prefix match ahead of a substring match", () => {
    const names = suggestPlaces("nara").map((suggestion) => suggestion.name);
    expect(names[0]).toBe("Nara Park");
    expect(names).toContain("Nara");
  });

  it("finds a city anywhere in the world, not just Japan", () => {
    expect(suggestPlaces("lisb").map((s) => s.name)).toContain("Lisbon");
    expect(suggestPlaces("reykj").map((s) => s.name)).toContain("Reykjavik");
  });

  it("matches on an alias, so a nickname still resolves", () => {
    expect(suggestPlaces("torii").map((s) => s.name)).toContain("Fushimi Inari Taisha");
  });

  it("returns nothing for text that matches no place", () => {
    expect(suggestPlaces("qqzzxx")).toEqual([]);
  });

  it("caps the list so the picker stays a row of chips", () => {
    expect(suggestPlaces("a", 5).length).toBeLessThanOrEqual(5);
  });
});

describe("maps links", () => {
  const place = groundPlace("Senso-ji")!;

  it("grounds a landmark to coordinates the embed can use", () => {
    expect(place.point).toBeDefined();
    expect(mapEmbedUrl(place)).toContain("output=embed");
    expect(mapEmbedUrl(place)).toContain(encodeURIComponent(`${place.point!.lat},`));
  });

  it("frames every pin, zooming out as the trip spreads", () => {
    const near = mapEmbedForPlaces([groundPlace("Senso-ji")!, groundPlace("Shibuya Sky")!]);
    const far = mapEmbedForPlaces([groundPlace("Tokyo")!, groundPlace("Lisbon")!]);
    const zoomOf = (url?: string) => Number(url?.match(/z=(\d+)/)?.[1]);
    expect(zoomOf(far)).toBeLessThan(zoomOf(near));
  });

  it("has no embed to show when nothing is grounded", () => {
    expect(mapEmbedForPlaces([{ name: "Somewhere" }])).toBeUndefined();
  });

  it("hands off to the Maps app for search and directions", () => {
    expect(openInMapsUrl(place)).toContain("maps/search/?api=1");
    const directions = directionsUrl(place, groundPlace("Tokyo Skytree")!);
    expect(directions).toContain("origin=");
    expect(directions).toContain("destination=");
  });

  it("falls back to the place name when there are no coordinates", () => {
    expect(openInMapsUrl({ name: "Cafe Nowhere", city: "Oslo" })).toContain(
      encodeURIComponent("Cafe Nowhere, Oslo"),
    );
  });
});

describe("trip identity", () => {
  it("gives the same destination the same colour every time", () => {
    expect(heroGradient("JPKR")).toBe(heroGradient("JPKR"));
    expect(heroGradient("JPKR")).not.toBe(heroGradient("PTES"));
  });

  it("turns a country code into its flag", () => {
    expect(flagEmoji("JP")).toBe("🇯🇵");
    expect(flagEmoji(undefined)).toBe("");
  });
});

describe("airport grounding", () => {
  it("grounds a bare IATA code, which is all a flight row gives you", () => {
    const place = groundPlace("AI142 DEL → HND");
    expect(place?.city).toBe("Delhi");
    expect(place?.point?.lat).toBeCloseTo(28.55, 1);
  });

  it("grounds a written-out airport name", () => {
    expect(groundPlace("Indira Gandhi International")?.city).toBe("Delhi");
    expect(groundPlace("Keflavík International")?.countryCode).toBe("IS");
  });

  it("does not read a code out of the middle of a word", () => {
    expect(groundPlace("delicatessen crawl")?.city).not.toBe("Delhi");
  });

  it("prefers a landmark over an airport that shares a city", () => {
    expect(groundPlace("Senso-ji")?.name).toBe("Senso-ji");
  });

  it("offers airports in the type-ahead", () => {
    expect(suggestPlaces("hnd").some((s) => s.name.includes("HND"))).toBe(true);
    expect(suggestPlaces("changi").some((s) => s.name.includes("SIN"))).toBe(true);
  });
});
