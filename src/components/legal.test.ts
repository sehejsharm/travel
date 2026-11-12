import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, LegalPage } from "./legal";

/* A legal document as static HTML: the terms, with one paragraph for its text. */
const html = renderToStaticMarkup(
  LegalPage({ title: "Terms of use", summary: "What the checks are.", children: createElement("p", null, "The text.") }),
);

/** The classes on the first element with this tag. */
function classes(tag: string): string[] {
  return new RegExp(`<${tag} class="([^"]*)"`).exec(html)![1].split(" ");
}

describe("a legal document", () => {
  it("sets its text as running text in primary ink, at a readable measure", () => {
    expect(classes("article")).toEqual(expect.arrayContaining(["text-body", "text-ink", "max-w-prose"]));
    expect(classes("article")).not.toContain("text-ink-soft");
    expect(classes("article")).not.toContain("text-callout");
    // The summary under the title keeps to the same measure.
    expect(html).toContain('<p class="max-w-prose">What the checks are.</p>');
  });

  it("keeps each Also here blurb inside its own link, apart from the next", () => {
    const others = LEGAL_PAGES.filter((page) => page.title !== "Terms of use");
    const nav = html.slice(html.indexOf("<nav"));

    for (const page of others) {
      expect(nav).toMatch(new RegExp(`<a [^>]*href="${page.href}"[^>]*>(?:(?!</a>).)*${page.blurb}</span></a>`));
    }
    expect(nav).toMatch(/<ul class="[^"]*\bgap-2\b/);
  });
});
