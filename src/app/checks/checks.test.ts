import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ChecklistEntry } from "@/lib/checklists";
import type { Flag, Trip } from "@/lib/domain/types";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * Checks as static HTML, with the trip view stubbed so it renders as if
 * hydrated: two travellers, findings of each severity, one critical ticked off
 * and one still open.
 */
const view: { current?: TripView } = {};
vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: () => view.current!,
}));

const Checks = (await import("./page")).default;

const trip: Trip = {
  id: "t1",
  name: "Tokyo",
  homeCountry: "IN",
  destinationCountries: ["JP"],
  startDate: "2026-10-14",
  endDate: "2026-10-22",
  travelers: [
    { id: "a", name: "Sehej", passportCountry: "IN", passportExpiry: "" },
    { id: "b", name: "Aanya", passportCountry: "IN", passportExpiry: "" },
  ],
};

const flags: Flag[] = [
  { id: "f1", severity: "critical", category: "compliance", title: "Needs a visa", detail: "Apply ahead.", itemIds: [] },
  { id: "f4", severity: "critical", category: "conflict", title: "Two hotels on one night", detail: "Cancel one.", itemIds: [] },
  { id: "f2", severity: "warning", category: "money", title: "Roaming is dear", detail: "Get an eSIM.", itemIds: [] },
  { id: "f3", severity: "info", category: "prep", title: "Sockets differ", detail: "Type A, B.", itemIds: [] },
];

function entry(patch: Partial<ChecklistEntry>): ChecklistEntry {
  return { id: "c", tripId: "t1", kind: "task", label: "", done: false, createdAt: "2026-09-01T00:00:00Z", ...patch };
}

const checklist = [
  entry({ id: "c1", label: "Needs a visa", sourceFlagId: "f1", generatedFrom: "compliance check", done: true }),
  entry({ id: "c2", label: "Roaming is dear", sourceFlagId: "f2", generatedFrom: "money check" }),
  entry({ id: "p1", kind: "packing", label: "Passport", generatedFrom: "every trip" }),
  entry({ id: "p2", kind: "packing", label: "Phone charger", generatedFrom: "every trip" }),
];

function show(): string {
  const state = { trips: [trip], activeTripId: trip.id, items: [], checklist, advice: [] } as unknown as AppState;
  view.current = { state, trip, items: [], checklist, flags, hydrated: true, empty: false };
  return renderToStaticMarkup(createElement(Checks));
}

/** One finding's card, from its opening tag to its title. */
function card(html: string, title: string): string {
  const end = html.indexOf(`${title}</h4>`);
  return html.slice(html.lastIndexOf("<li", end), end);
}

describe("the Checks screen", () => {
  it("names what each header counter counts, on its own line", () => {
    const html = show();

    expect(html).toContain("<span>1 of 3 checks handled</span><span>0 of 2 packed</span>");
    expect(html).not.toMatch(/\d+\/\d+ done/);
  });

  it("groups the findings under their severity, with no side rail and no pulsing dot", () => {
    const html = show();
    const headings = [...html.matchAll(/<h3 class="section-label[^"]*">([^<]*)<span class="tabular">(\d+)</g)].map(
      (match) => `${match[1]}${match[2]}`,
    );

    expect(headings).toEqual(["Fix before you fly 2", "Worth a look 1", "Good to know 1"]);
    expect(html).not.toContain("w-1 shrink-0");
    expect(html).not.toContain("animate-pulse-dot");
  });

  it("draws an open Good to know finding neutral, keeping ok teal for one that is done", () => {
    const html = show();

    expect(card(html, "Sockets differ")).toContain("bg-surface-2 text-ink-soft");
    expect(card(html, "Sockets differ")).not.toContain("bg-ok-soft");
    // The ticked visa task settles its finding, which then reads as done.
    expect(card(html, "Needs a visa")).toContain("bg-ok-soft text-ok");
  });

  it("offers the traveller filter as one radio group that wraps instead of cutting a name off", () => {
    const html = show();
    const groups = [...html.matchAll(/<div role="radiogroup"[^>]*class="([^"]*)"/g)];

    expect(groups).toHaveLength(2);
    for (const [, className] of groups) {
      expect(className).toContain("flex-wrap");
      expect(className).not.toContain("overflow-x-auto");
    }
    expect(html).toContain('aria-label="Show pre-trip tasks for"');
    expect(html).toMatch(/<button type="button" role="radio"[^>]*aria-checked="true"[^>]*>Everyone</);
    expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*>Nobody yet</);
    expect(html).not.toMatch(/aria-pressed="(true|false)"[^>]*>(Everyone|Nobody yet)</);
  });

  it("keeps both panels inside a zero-minimum track, so neither runs past the screen", () => {
    expect(show()).toContain('class="grid grid-cols-1 gap-4 lg:grid-cols-2"');
  });

  it("edges an unticked box in the field-edge token", () => {
    const html = show();

    expect(html).toContain("border-field-edge bg-surface");
    expect(html).not.toContain("border-line-strong bg-surface");
  });
});
