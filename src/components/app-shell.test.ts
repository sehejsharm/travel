import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "@/lib/domain/types";
import type { AppState } from "@/lib/store/state";
import type { TripView } from "@/lib/store/use-store";

/*
 * The shell as static HTML, at a given route, with a trip loaded. The server
 * render always has the sidebar open; `sidebar.folded` stands in for the
 * remembered choice by answering the sidebar's own store, and nothing else's.
 */
const route = { pathname: "/" };
const sidebar = { folded: false };

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useSyncExternalStore: <T>(
      subscribe: (onChange: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ) =>
      react.useSyncExternalStore(
        subscribe,
        getSnapshot,
        subscribe.name === "subscribeSidebar" ? () => sidebar.folded as T : getServerSnapshot,
      ),
  };
});

const trip: Trip = {
  id: "t1",
  name: "Japan in spring",
  homeCountry: "GB",
  destinationCountries: ["JP"],
  startDate: "2026-04-01",
  endDate: "2026-04-10",
  travelers: [],
};

vi.mock("@/lib/store/use-store", async (original) => ({
  ...(await original<typeof import("@/lib/store/use-store")>()),
  useTripView: (): TripView => ({
    state: { trips: [trip], activeTripId: trip.id, items: [], checklist: [], advice: [] } as unknown as AppState,
    trip,
    items: [],
    checklist: [],
    flags: [],
    hydrated: true,
    empty: false,
  }),
}));

const { AppShell } = await import("./app-shell");

function shell(pathname: string): string {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(AppShell, null, createElement("p", null, "screen")));
}

/** The accessible names of the links marked as the current page, in order. */
function current(html: string): string[] {
  return [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map((match) => {
    const label = /aria-label="([^"]*)"/.exec(match[0])?.[1];
    return label ?? match[1].replace(/<[^>]*>/g, "");
  });
}

/** The sidebar's markup alone. */
function aside(html: string): string {
  return /<aside[\s\S]*?<\/aside>/.exec(html)?.[0] ?? "";
}

describe("the app shell's current tab", () => {
  beforeEach(() => {
    sidebar.folded = false;
  });

  it("marks the tab of a tab's own screen, in the sidebar and the tab bar", () => {
    expect(current(shell("/"))).toEqual(["Trip", "Trip"]);
    expect(current(shell("/cabinet"))).toEqual(["Cabinet", "Cabinet"]);
  });

  it("marks Trip on the screens opened from the trip", () => {
    for (const pathname of ["/trip", "/trip/new", "/divert"]) {
      expect(current(shell(pathname)), pathname).toEqual(["Trip", "Trip"]);
    }
  });

  it("marks More, in the sidebar and the phone header, on the recap and the legal pages", () => {
    expect(current(shell("/more"))).toEqual(["More", "More"]);
    for (const pathname of ["/recap", "/legal/privacy", "/legal/terms", "/legal/licences", "/legal/data-deletion"]) {
      expect(current(shell(pathname)), pathname).toEqual(["More", "More"]);
    }
  });
});

describe("the folded sidebar", () => {
  beforeEach(() => {
    sidebar.folded = false;
  });

  it("keeps a way to switch trips, as an icon titled with the trip's name", () => {
    sidebar.folded = true;
    const rail = aside(shell("/"));

    // Folded for real: the labels are gone and the toggle offers to open it.
    expect(rail).toContain('aria-label="Show sidebar"');
    expect(rail).not.toContain(">Cabinet<");
    expect(rail).toMatch(/<button[^>]*aria-label="Switch trip"[^>]*title="Japan in spring"/);
  });

  it("shows the trip's name in the switcher while open", () => {
    const rail = aside(shell("/"));
    expect(rail).toContain('aria-label="Hide sidebar"');
    expect(rail).toMatch(/aria-label="Switch trip"[^>]*>[\s\S]*Japan in spring/);
  });
});
