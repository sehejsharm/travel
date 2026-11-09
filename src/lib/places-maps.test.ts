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

  it("reads a code only in capitals, as flights write them", () => {
    expect(groundPlace("Los Angeles")?.city).toBe("Los Angeles");
    expect(groundPlace("per-diem lunch")).toBeUndefined();
    expect(groundPlace("Zagreb Franjo Tuđman Airport")?.name).toBe("Franjo Tuđman (ZAG)");
    expect(groundPlace("Miami (MIA)")?.name).toBe("Miami International (MIA)");
  });

  it("does not read a code joined to a word by a hyphen", () => {
    expect(groundPlace("HOTEL ARTS BARCELONA\nDELUXE SEA-VIEW ROOM")?.city).toBe("Barcelona");
    expect(groundPlace("HOTEL NIKKO KYOTO\nADD-ONS: BREAKFAST")?.city).toBe("Kyoto");
    // Two codes joined are a route.
    expect(groundPlace("AI 142 DEL-HND")?.name).toContain("(DEL)");
  });

  it("takes an airport named for its city as the city, unless the text says airport", () => {
    expect(groundPlace("Kunsthaus Zürich")?.name).toBe("Zurich");
    expect(groundPlace("Munich")?.name).toBe("Munich");
    expect(groundPlace("Zurich Airport")?.name).toBe("Zurich (ZRH)");
    expect(groundPlace("MUC")?.name).toBe("Munich (MUC)");
  });

  it("prefers a landmark over an airport that shares a city", () => {
    expect(groundPlace("Senso-ji")?.name).toBe("Senso-ji");
  });

  it("offers airports in the type-ahead", () => {
    expect(suggestPlaces("hnd").some((s) => s.name.includes("HND"))).toBe(true);
    expect(suggestPlaces("changi").some((s) => s.name.includes("SIN"))).toBe(true);
  });
});

describe("city and landmark grounding", () => {
  it("does not find a place inside a longer word", () => {
    // Malé, Tunis, Fes, Agra and Nadi hide inside these.
    for (const text of ["Malaysia", "Tunisia", "Malibu beach", "Kite Festival", "Sagrada Familia", "Canadian Rockies"]) {
      expect(groundPlace(text), text).toBeUndefined();
    }
    // Asakusa, the alias for Senso-ji, hides inside Asakusabashi.
    expect(groundPlace("Asakusabashi hostel")).toBeUndefined();
  });

  it("reads accents the way people type them", () => {
    expect(groundPlace("Malé")?.city).toBe("Malé");
    expect(groundPlace("hotel in Male")?.city).toBe("Malé");
    expect(groundPlace("Sao Paulo")?.city).toBe("São Paulo");
    expect(groundPlace("Cancun")?.city).toBe("Cancún");
    expect(groundPlace("Xian")?.city).toBe("Xi'an");
    expect(groundPlace("Hotel Xi An Bell Tower")?.city).toBe("Xi'an");
    expect(groundPlace("O Hare International")?.name).toBe("O'Hare International (ORD)");
    expect(groundPlace("Milano Centrale 08:00")?.city).toBe("Milan");
  });

  it("still finds a place within a longer phrase", () => {
    expect(groundPlace("Kyoto station")?.city).toBe("Kyoto");
    expect(groundPlace("Tokyo's best ramen")?.city).toBe("Tokyo");
    expect(groundPlace("Venice")?.city).toBe("Venice");
    expect(groundPlace("shibuya sky tickets")?.name).toBe("Shibuya Sky");
    expect(groundPlace("Kiyomizu-dera at dawn")?.name).toBe("Kiyomizu-dera");
    expect(groundPlace("Fujikawaguchiko")?.name).toBe("Lake Kawaguchi");
  });

  it("suggests an accented city typed without its accents", () => {
    expect(suggestPlaces("male").map((s) => s.name)).toContain("Malé");
    expect(suggestPlaces("sao p").map((s) => s.name)).toContain("São Paulo");
    expect(suggestPlaces("xi an").map((s) => s.name)).toContain("Xi'an");
  });
});
