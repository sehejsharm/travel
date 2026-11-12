import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Trip, TripItem } from "@/lib/domain/types";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * The cabinet as static HTML, with the trip view stubbed so it renders as if
 * hydrated, and no filter asked for in the address.
 */
const view: { current?: TripView } = {};
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: () => view.current!,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const Cabinet = (await import("./page")).default;

const trip: Trip = {
  id: "t1",
  name: "Japan",
  homeCountry: "IN",
  startDate: "2026-12-01",
  endDate: "2026-12-07",
  travelers: [],
};

function item(overrides: Partial<TripItem>): TripItem {
  return {
    id: "i1",
    tripId: "t1",
    title: "Something",
    category: "activity",
    source: "manual",
    confidence: 1,
    extractionMethod: "deterministic",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function show(items: TripItem[]): string {
  const state = { trips: [trip], activeTripId: trip.id, items, checklist: [], advice: [] } as unknown as AppState;
  view.current = { state, trip, items, checklist: [], flags: [], hydrated: true, empty: false };
  return renderToStaticMarkup(createElement(Cabinet));
}

/** The cards' titles, in order. */
function titles(html: string): string[] {
  return [...html.matchAll(/<h2 class="text-headline">([^<]*)</g)].map((match) => match[1]);
}

describe("the cabinet", () => {
  // In the order they were filed, which is not the order they happen in.
  const filed = [
    item({ id: "a", title: "Sumo", startsAt: "2026-12-04T13:00:00+09:00" }),
    item({ id: "b", title: "Bamboo grove", category: "place" }),
    item({ id: "c", title: "Museum", startsAt: "2026-12-03T10:00:00+09:00" }),
    item({ id: "d", title: "Flight home", category: "booking", startsAt: "2026-12-06T00:10:00+09:00" }),
    item({ id: "e", title: "Shrine", startsAt: "2026-12-05T07:00:00+09:00" }),
  ];

  it("lists what is on a day in date order, then what is not", () => {
    expect(titles(show(filed))).toEqual(["Museum", "Sumo", "Shrine", "Flight home", "Bamboo grove"]);
  });

  it("titles each card one level under the screen's heading", () => {
    const html = show(filed);

    expect(html).toContain("<h1");
    expect(html).not.toContain("<h3");
    expect(titles(html)).toHaveLength(filed.length);
  });

  it("says each card's category in words", () => {
    const html = show([item({ title: "Flight home", category: "booking", confirmationCode: "TG55PL" })]);

    expect(html).toContain("Bookings · Ref TG55PL");
    expect(html).toContain("Tap to schedule");
  });
});
