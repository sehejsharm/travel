import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INTERESTS, MAX_INTERESTS } from "@/lib/advisor/interests";
import { InterestPicker } from "./interest-picker";

/*
 * The picker's look as a list. Its behaviour (aria-pressed, the limit,
 * aria-disabled and the live caption) is pinned in src/lib/advisor/advisor.test.ts.
 */
function render(selected: string[], min?: number): string {
  return renderToStaticMarkup(createElement(InterestPicker, { selected, onChange: () => {}, min }));
}

/** Each row, in order. */
function rows(html: string): string[] {
  return [...html.matchAll(/<button[\s\S]*?<\/button>/g)].map((match) => match[0]);
}

/** As React writes text: "&" and "'" escaped, then made safe inside a RegExp. */
function asHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("'", "&#x27;")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("the interest picker", () => {
  const ids = INTERESTS.map((interest) => interest.id);

  it("is rows split by hairlines, at least 44px tall, in two columns from sm up, with no tile around each", () => {
    const html = render(["food"]);

    expect(html).toContain('<div class="grid sm:grid-cols-2 sm:gap-x-8">');
    expect(rows(html)).toHaveLength(INTERESTS.length);
    for (const row of rows(html)) {
      const className = row.match(/^<button[^>]*class="([^"]*)"/)![1];
      expect(className).toContain("min-h-11");
      expect(className).toContain("border-t border-line");
      // The top row of each column has no hairline above it.
      expect(className).toContain("first:border-t-0");
      expect(className).toContain("sm:nth-2:border-t-0");
      // No card inside a card: no rounded box, fill or border of its own.
      expect(className).not.toMatch(/rounded|bg-|border-accent/);
    }
  });

  it("gives each row its icon, its name over its blurb, and a selection circle", () => {
    const html = render([]);

    for (const interest of INTERESTS) {
      expect(html).toMatch(
        new RegExp(
          `<svg[^>]*aria-hidden="true" class="shrink-0 text-ink-soft">(?:(?!</?button)[\\s\\S])*?</svg>` +
            `<span class="flex min-w-0 flex-1 flex-col"><span class="text-subheadline font-medium text-ink">${asHtml(interest.label)}</span>` +
            `<span class="text-caption text-ink-soft">${asHtml(interest.blurb)}</span></span>` +
            `<span aria-hidden="true" class="[^"]*rounded-full border[^"]*">`,
        ),
      );
    }
  });

  it("rings an unticked circle in field-edge, and ticks a picked one with a drawn check on copper", () => {
    const [food, coffee] = rows(render(["food"]));

    expect(food).toContain("border-accent bg-accent text-accent-ink");
    expect(food).toContain('<path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor"');
    expect(coffee).toContain("border-field-edge");
    expect(coffee).not.toContain("<path d=\"M2.5 6.2");
    expect(render(["food"])).not.toContain("✓");
    expect(render(["food"])).not.toContain("border-line-strong");
  });

  it("captions every count without a dash between clauses", () => {
    const counts = [render([]), render([], 0), render(["food"]), render(ids.slice(0, MAX_INTERESTS)), render(ids.slice(0, MAX_INTERESTS + 2))];

    for (const html of counts) {
      const caption = html.match(/<p [^>]*aria-live="polite"[^>]*>([^<]*)<\/p>/)![1];
      expect(caption).not.toMatch(/[—–]/);
    }
    expect(render([], 0)).toContain("Optional. You can pick these later.");
    expect(render(["food"])).toContain("1 picked. Each becomes a section of your suggestions.");
  });
});
