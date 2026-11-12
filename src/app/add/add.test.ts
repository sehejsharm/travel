import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Trip } from "@/lib/domain/types";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * The Add screen as static HTML, with the trip view stubbed so it renders as
 * if hydrated. What the address carries stands in for a share arriving.
 */
const address = { search: "" };
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: (): TripView => {
    const trip: Trip = {
      id: "t1",
      name: "Japan",
      homeCountry: "IN",
      startDate: "2026-12-01",
      endDate: "2026-12-07",
      travelers: [],
    };
    const state = { trips: [trip], activeTripId: trip.id, items: [], checklist: [], advice: [] } as unknown as AppState;
    return { state, trip, items: [], checklist: [], flags: [], hydrated: true, empty: false };
  },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(address.search) }));

const Add = (await import("./page")).default;

function show(search = ""): string {
  address.search = search;
  return renderToStaticMarkup(createElement(Add));
}

describe("the Add screen", () => {
  it("names the way in that opens a form for what it opens, apart from the box that reads typing", () => {
    const html = show();

    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>.*?<\/svg>Fill in by hand<\/button>/);
    expect(html).not.toContain("Type it in");
  });

  it("labels the box where it can be seen, not only for a screen reader", () => {
    const html = show();

    expect(html).toMatch(/<label[^>]*><span[^>]*>Or paste a link, an email, or a note<\/span><textarea/);
    expect(html).not.toContain('aria-label="Content to extract"');
  });

  it("says what the box was read as only once there is something in it", () => {
    // Empty, it used to read "Manual", the source of nothing, which looked like a mode.
    expect(show()).not.toMatch(/<span[^>]*rounded-badge[^>]*>Manual<\/span>/);

    const shared = show(`?url=${encodeURIComponent("https://www.instagram.com/reel/C9xAbc123/")}`);
    expect(shared).toMatch(/<span[^>]*rounded-badge[^>]*>Reel<\/span>/);
  });
});
