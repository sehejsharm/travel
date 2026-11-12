import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DataDeletion from "./data-deletion/page";
import Privacy from "./privacy/page";
import Terms from "./terms/page";

/*
 * The legal pages as static HTML. Their wording is settled, so only the
 * punctuation between clauses changed: brackets round an aside, a colon
 * before what explains, and no dash breaking a sentence anywhere.
 */
function html(page: FC): string {
  return renderToStaticMarkup(createElement(page));
}

describe("the legal pages", () => {
  it.each([
    ["privacy policy", Privacy],
    ["terms of use", Terms],
    ["data deletion", DataDeletion],
  ])("break no sentence with a dash: %s", (_, page) => {
    expect(html(page)).not.toContain("—");
  });

  it("set the privacy policy's asides in brackets and its list of permissions with colons", () => {
    const privacy = html(Privacy);

    expect(privacy).toContain(
      "Your trips (bookings, notes, prices, passport details, confirmation numbers, everything you file) are stored on this device.",
    );
    expect(privacy).toContain(
      "Where a map is shown (on the Cabinet’s map view, in an item’s editor, under a place you type in on the Add screen, and next to Discover’s suggestions), it is a Google Maps embed",
    );
    expect(privacy).toContain('<strong class="font-medium text-ink">Camera:</strong> only if you tap Camera');
    expect(privacy).toContain('<strong class="font-medium text-ink">Storage:</strong> to keep your trip on this device.');
  });

  it("put a colon before what explains the sentence ahead of it", () => {
    expect(html(Terms)).toContain(
      "There is no account to close: deleting the app, or clearing its data, ends the relationship completely.",
    );
    expect(html(DataDeletion)).toContain(
      "There is no way to revoke it: this is the trade for links that need no server.",
    );
  });
});
