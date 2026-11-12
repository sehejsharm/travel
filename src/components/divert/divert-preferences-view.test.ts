import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Trip } from "@/lib/domain/types";
import { routeForGroup } from "@/lib/divert/route";
import { DivertPreferencesView } from "./divert-preferences-view";

const trip: Trip = {
  id: "t1",
  name: "Tokyo",
  homeCountry: "GB",
  destinationCountries: ["JP"],
  startDate: "2026-07-01",
  endDate: "2026-07-05",
  travelers: [
    { id: "a", name: "Ana" },
    { id: "b", name: "Ben" },
  ],
} as Trip;

describe("Divert's Back", () => {
  it("sits above the title at the leading edge, named for where it goes, not in the title row", () => {
    // No timed, placed stops, so the sample walk.
    const html = renderToStaticMarkup(createElement(DivertPreferencesView, { trip, route: routeForGroup([]) }));
    const back = html.search(/<a[^>]*href="\/"[^>]*>/);

    expect(back).toBeGreaterThan(-1);
    expect(back).toBeLessThan(html.indexOf("<header"));
    expect(html).toMatch(/<a[^>]*aria-label="Back to Trip"[^>]*><span aria-hidden="true">‹<\/span>Trip<\/a>/);
    // The title row holds the title alone.
    expect(html).toMatch(/<h1[^>]*>Break off for a bit<\/h1><\/div>/);
  });
});
