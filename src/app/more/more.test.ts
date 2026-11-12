import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Trip } from "@/lib/domain/types";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/* More as static HTML, with the trip view stubbed so it renders as if hydrated. */
const view: { current?: TripView } = {};
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: () => view.current!,
}));

const More = (await import("./page")).default;

function show(): string {
  const trip: Trip = {
    id: "t1",
    name: "Tokyo",
    homeCountry: "GB",
    destinationCountries: ["JP"],
    startDate: "2026-07-01",
    endDate: "2026-07-05",
    travelers: [],
  };
  const state = { trips: [trip], activeTripId: trip.id, items: [], checklist: [], advice: [] } as unknown as AppState;
  view.current = { state, trip, items: [], checklist: [], flags: [], hydrated: true, empty: false };
  return renderToStaticMarkup(createElement(More));
}

describe("More's On the ground", () => {
  it("puts the emergency numbers first, on their own row, each one a call", () => {
    const html = show();
    const ground = html.slice(html.indexOf("On the ground"));

    expect(ground).toMatch(/<dl[^>]*><dt[^>]*>Emergency<\/dt>/);
    expect(ground).toMatch(/<a[^>]*href="tel:110"[^>]*>110<\/a> police \/ <a[^>]*href="tel:119"[^>]*>119<\/a> fire and ambulance/);
    expect(ground).toMatch(/<dt[^>]*>Currency<\/dt><dd[^>]*>JPY<\/dd>/);
    expect(ground).toMatch(/<dt[^>]*>Plugs<\/dt><dd[^>]*>Type A\/B<\/dd>/);
    // Not run together with the currency and plugs on one dotted line.
    expect(ground).not.toContain("Emergency 110");
  });

  it("gives This device an anchor that links can land on", () => {
    // /more#this-device: the section, with its own title first inside it.
    expect(show()).toMatch(/<section id="this-device"[^>]*>(?:<[^>]+>)*This device</);
  });
});
