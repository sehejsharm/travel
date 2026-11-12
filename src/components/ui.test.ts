import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScreenHeader } from "./ui";

function header(props: Parameters<typeof ScreenHeader>[0]): string {
  return renderToStaticMarkup(createElement(ScreenHeader, props));
}

describe("ScreenHeader's way back", () => {
  it("sits above the title at the leading edge, not in the title row", () => {
    const html = header({ eyebrow: "Divert from group", title: "Break off for a bit", back: { label: "Trip", href: "/" } });

    // The first thing in the header, before the eyebrow and the title.
    expect(html).toMatch(/^<header[^>]*><a [^>]*href="\/"[^>]*>[\s\S]*?Trip<\/a><p/);
    expect(html.indexOf("Trip</a>")).toBeLessThan(html.indexOf("Divert from group"));
    expect(html.indexOf("Trip</a>")).toBeLessThan(html.indexOf("<h1"));
  });

  it("can be a button, for a way back that is not a route", () => {
    const html = header({ eyebrow: "Diverted", title: "Change your plans", back: { label: "Back", onClick: () => undefined } });
    expect(html).toMatch(/<header[^>]*><button type="button"[^>]*>[\s\S]*?Back<\/button>/);
  });

  it("keeps the action at the end of the title row", () => {
    const html = header({ eyebrow: "Checks", title: "Checks", action: createElement("span", null, "Edit") });
    expect(html).toMatch(/<h1[^>]*>Checks<\/h1><span>Edit<\/span>/);
    expect(html).not.toContain("<a ");
  });
});
