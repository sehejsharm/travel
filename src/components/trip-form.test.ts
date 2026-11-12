import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "@/lib/domain/types";
import { PURPOSES } from "@/lib/trip-purpose";

/*
 * The trip form as static HTML. Pressing its button is calling the handler
 * the form gave the button on that render, with the store's writes stubbed so
 * what Save would send can be read.
 */
const button: { press?: () => void } = {};
vi.mock("./form", async (original) => {
  const actual = await original<typeof import("./form")>();
  return {
    ...actual,
    PrimaryButton: (props: ComponentProps<typeof actual.PrimaryButton>) => {
      button.press = () => props.onClick?.(undefined as never);
      return createElement(actual.PrimaryButton, props);
    },
  };
});
vi.mock("@/lib/store/state", async (original) => ({
  ...(await original<typeof import("@/lib/store/state")>()),
  updateTrip: vi.fn(),
  createTrip: vi.fn(() => "t2"),
}));

const { TripForm } = await import("./trip-form");
const { updateTrip } = await import("@/lib/store/state");

const trip: Trip = {
  id: "t1",
  name: "Japan",
  homeCountry: "GB",
  destinationCountries: ["JP"],
  startDate: "2026-11-28",
  endDate: "2026-12-06",
  travelers: [],
};

function show(current?: Trip): string {
  return renderToStaticMarkup(
    createElement(TripForm, {
      trip: current,
      onDone: () => {},
      submitLabel: current ? "Save changes" : "Create trip",
    }),
  );
}

describe("the trip form on an existing trip", () => {
  beforeEach(() => {
    vi.mocked(updateTrip).mockClear();
  });

  it("leaves interests out of Save, so it cannot put back what their own section just saved", () => {
    // Opened before anything was picked; the trip screen's interests then save on their own.
    show(trip);
    button.press!();

    expect(updateTrip).toHaveBeenCalledTimes(1);
    const [id, patch] = vi.mocked(updateTrip).mock.calls[0];
    expect(id).toBe("t1");
    expect(patch.name).toBe("Japan");
    expect(Object.keys(patch)).not.toContain("interests");
  });

  it("has no picker of its own for interests, which the trip screen has", () => {
    expect(show(trip)).not.toContain("Personalize suggestions");
    expect(show()).toContain("Personalize suggestions");
  });
});

describe("the When toggle", () => {
  it("says what it does, not a status that is wrong while the dates are filled in", () => {
    const html = show(trip);

    expect(html).toMatch(/<button[^>]*>Skip dates for now<\/button>/);
    expect(html).not.toContain("No dates yet");
    expect(html).toContain('value="2026-11-28"');
  });
});

describe("the purpose chips", () => {
  it("draw a hidden line icon beside each name, not an emoji", () => {
    const html = show(trip);

    for (const purpose of PURPOSES) {
      expect(html).toMatch(
        new RegExp(`<button[^>]*aria-pressed="false"[^>]*><svg[^>]*aria-hidden="true"[^>]*>(?:(?!</?button)[\\s\\S])*?</svg>${purpose.label}</button>`),
      );
    }
    expect(html).not.toMatch(/🌤|💼|🧸|🥂|🎒|👥|🥾/u);
  });
});
