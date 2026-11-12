import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BudgetRollup } from "@/lib/rules";
import { BudgetCard } from "./budget-card";

/*
 * The budget card as static HTML. On the server the count-up reads as reduced
 * motion, so the headline shows the value it lands on.
 */
const rollup: BudgetRollup = {
  currency: "INR",
  planned: 8232.89,
  actual: 193779.86,
  total: 202012.75,
  target: 150000,
  lines: [],
  unpricedCount: 0,
  unconvertedCount: 0,
};

function render(given: BudgetRollup): string {
  return renderToStaticMarkup(createElement(BudgetCard, { rollup: given }));
}

describe("the budget card", () => {
  it("lands the headline on the exact total, at the currency's precision", () => {
    const html = render(rollup);

    expect(html).toContain("₹202,012.75");
    expect(html).not.toContain("₹202,013.00");
    expect(html).toContain("₹52,012.75 over");
  });

  it("marks the plan on the bar and draws the spend past it as critical", () => {
    const html = render(rollup);

    // Booked fills the bar up to the plan, and the overspend runs from there.
    expect(html).toMatch(/class="origin-left bg-teal[^"]*" style="width:74\.25/);
    expect(html).toMatch(/class="origin-left bg-critical[^"]*" style="width:25\.74/);
    expect(html).toMatch(/bg-ink" style="left:74\.25/);
  });

  it("draws neither under the plan", () => {
    const html = render({ ...rollup, target: 250000 });

    expect(html).not.toContain("bg-critical ");
    expect(html).not.toContain("bg-ink");
  });
});
