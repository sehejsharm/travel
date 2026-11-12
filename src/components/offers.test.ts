import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { IconName } from "@/lib/icons";
import type { Offer, OfferKind } from "@/lib/partners";
import { LineIcon } from "./line-icon";
import { Offers } from "./offers";

function offer(kind: string): Offer {
  return {
    id: kind,
    kind: kind as OfferKind,
    title: `About ${kind}`,
    why: "A check raised it.",
    partner: "A shop",
    url: "https://example.com/",
    affiliate: false,
  };
}

const icon = (name: IconName) =>
  renderToStaticMarkup(createElement(LineIcon, { name, className: "shrink-0 text-ink-soft" }));

describe("the offers card", () => {
  it("draws each kind's line icon beside its title, and a suitcase for a kind it does not know", () => {
    const expected: [string, IconName][] = [
      ["esim", "signal"],
      ["adapter", "plug"],
      ["power", "bolt"],
      ["gear", "jacket"],
      ["comfort", "plane"],
      ["something-new", "suitcase"],
    ];
    const html = renderToStaticMarkup(createElement(Offers, { offers: expected.map(([kind]) => offer(kind)) }));
    const cards = html.split("<li").slice(1);

    expect(cards).toHaveLength(expected.length);
    expected.forEach(([kind, name], index) => {
      expect(cards[index]).toContain(`${icon(name)}<div class="min-w-0 flex-1">`);
      expect(cards[index]).toContain(`About ${kind}`);
    });
    expect(html).not.toMatch(/📶|🔌|⚡|🧥|🛫|🧳/u);
  });
});
