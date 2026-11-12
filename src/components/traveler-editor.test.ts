import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The traveller sheet as static HTML: the sheet portals on the client only, so here it draws in place. */
vi.mock("./sheet", () => ({
  Sheet: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) =>
    createElement("section", null, children, footer),
}));

const { TravelerEditor } = await import("./traveler-editor");

const html = renderToStaticMarkup(
  createElement(TravelerEditor, {
    tripId: "t1",
    traveler: null,
    homeCountry: "GB",
    open: true,
    onClose: () => undefined,
  }),
);

describe("the traveller sheet", () => {
  it("explains Flying from in whole sentences, not across a dash", () => {
    expect(html).toContain(
      "Sets their plugs, voltage, jet lag and the customs allowance they come home to. The passport above still decides the visa.",
    );
    expect(html).not.toContain("—");
  });
});
