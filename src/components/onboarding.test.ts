import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * The introduction as static HTML, at a chosen step. The server render takes
 * it as already seen and shows nothing, so here it answers "not seen yet";
 * the step counter, its one numeric state, starts where the test asks; and
 * the sheet, which portals on the client only, draws its contents in place.
 */
const at = { step: 0 };

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
        getSnapshot.name === "alreadySeen" ? () => false as T : getServerSnapshot,
      ),
    useState: <S>(initial: S) => react.useState(typeof initial === "number" ? (at.step as S) : initial),
  };
});

vi.mock("./sheet", () => ({
  Sheet: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) =>
    createElement("section", null, children, footer),
}));

const { Onboarding } = await import("./onboarding");

function show(step: number): string {
  at.step = step;
  return renderToStaticMarkup(createElement(Onboarding));
}

describe("the introduction", () => {
  it("breaks no sentence with a dash on any step", () => {
    for (const step of [0, 1, 2, 3]) expect(show(step)).not.toContain("—");
  });

  it("explains what comes back filed after a colon", () => {
    expect(show(1)).toContain(
      "Dates, prices, confirmation numbers and a place on the map: pulled out and sorted into your cabinet, without you typing any of it.",
    );
  });

  it("joins working with no signal to why it matters with a comma", () => {
    expect(show(3)).toContain(
      "No account, and it works with no signal, exactly when you need a booking reference most.",
    );
  });
});
