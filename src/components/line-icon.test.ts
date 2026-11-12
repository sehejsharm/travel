import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getInterest, INTERESTS } from "@/lib/advisor/interests";
import { DIVERT_INTERESTS } from "@/lib/divert/interests";
import type { IconName } from "@/lib/icons";
import { getPurpose, PURPOSES } from "@/lib/trip-purpose";
import { LineIcon } from "./line-icon";

const draw = (name: IconName) => renderToStaticMarkup(createElement(LineIcon, { name }));

/** Every icon the data names. The offers' own are pinned in offers.test.ts. */
const named: IconName[] = [
  ...INTERESTS.map((interest) => interest.icon),
  ...PURPOSES.map((purpose) => purpose.icon),
  ...DIVERT_INTERESTS.map((interest) => interest.icon),
];

describe("the line icons", () => {
  it("have a drawing for every icon the interests, the trip purposes and Divert name", () => {
    for (const name of named) expect(draw(name)).toMatch(/<(?:path|rect|circle|ellipse)\b/);
  });

  it("are hidden line drawings in the text's colour: a 24 box, a 1.7 stroke, round ends, no fill, no text", () => {
    for (const name of named) {
      const svg = draw(name);

      expect(svg).toMatch(/^<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">/);
      expect(svg).toContain(
        '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">',
      );
      // No shape inside changes the group's look.
      expect(svg).not.toMatch(/<(?:path|rect|circle|ellipse)[^>]*(?:fill|stroke)=/);
      expect(svg).not.toContain("<text");
    }
  });

  it("give each interest, and each trip purpose, a drawing of its own", () => {
    expect(new Set(INTERESTS.map((interest) => interest.icon)).size).toBe(INTERESTS.length);
    expect(new Set(PURPOSES.map((purpose) => purpose.icon)).size).toBe(PURPOSES.length);
  });

  it("share one drawing where a purpose and an interest mean the same thing", () => {
    expect(getPurpose("family")?.icon).toBe(getInterest("family")?.icon);
  });
});
