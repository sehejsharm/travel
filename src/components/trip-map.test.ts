import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TripItem } from "@/lib/domain/types";
import { TripMap } from "./trip-map";

const hotel: TripItem = {
  id: "i1",
  tripId: "t1",
  title: "Hotel Avenida",
  category: "booking",
  source: "manual",
  place: { name: "Hotel Avenida", city: "Lisbon", point: { lat: 38.72, lng: -9.14 } },
  confidence: 1,
  extractionMethod: "deterministic",
  createdAt: "2026-06-01T00:00:00Z",
};

describe("the trip map's places", () => {
  it("label the link out Maps, with no arrow glued to it, and name where it goes", () => {
    const html = renderToStaticMarkup(createElement(TripMap, { items: [hotel], onSelect: () => {} }));

    expect(html).toMatch(/<a[^>]*aria-label="Open Hotel Avenida in Google Maps"[^>]*>Maps<\/a>/);
    expect(html).not.toMatch(/[↗→]/);
  });
});
