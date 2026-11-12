import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TravelerQuickAdd } from "./traveler-quick-add";

/* The quick-add list as static HTML, with one person and no passport details yet. */
const html = renderToStaticMarkup(
  createElement(TravelerQuickAdd, {
    travelers: [{ name: "Asha" }],
    homeCountry: "GB",
    onChange: () => undefined,
    pending: "",
    onPendingChange: () => undefined,
    idPrefix: "quick",
  }),
);

describe("a traveller with no passport details yet", () => {
  it("says they are optional and what uses them after a colon, not across a dash", () => {
    expect(html).toContain("Passport details optional: the visa checks use them");
    expect(html).not.toContain("—");
  });
});
