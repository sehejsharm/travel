import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Trip, TripItem } from "@/lib/domain/types";

/* The item sheet as static HTML: the sheet portals on the client only, so here it draws in place. */
vi.mock("./sheet", () => ({
  Sheet: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) =>
    createElement("section", null, children, footer),
}));

const { ItemEditor } = await import("./item-editor");

const trip: Trip = {
  id: "t1",
  name: "Tokyo",
  homeCountry: "GB",
  destinationCountries: ["JP"],
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  travelers: [],
};

/* Scheduled, so the sheet offers to send it back to ideas. */
const item: TripItem = {
  id: "i1",
  tripId: "t1",
  title: "Senso-ji",
  category: "place",
  source: "manual",
  startsAt: "2026-10-15T09:00:00+09:00",
  endsAt: "2026-10-15T11:00:00+09:00",
  confidence: 1,
  extractionMethod: "deterministic",
  createdAt: "2026-09-01T00:00:00Z",
};

describe("the item sheet", () => {
  it("labels clearing the time with a colon, not a dash", () => {
    const html = renderToStaticMarkup(createElement(ItemEditor, { item, trip, onClose: () => undefined }));

    expect(html).toMatch(/<button [^>]*>Clear: send back to ideas<\/button>/);
    expect(html).not.toContain("Clear —");
  });
});
