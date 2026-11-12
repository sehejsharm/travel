import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./disclosure";

describe("a closed Disclosure", () => {
  it("lets its hint wrap, so a phone does not cut off the part that explains the row", () => {
    const hint = "Names only, or add passports now for the visa checks";
    const html = renderToStaticMarkup(
      // Children go in as their own argument, so the props are cast past the type that wants them.
      createElement(Disclosure, { label: "Who is going?", hint } as ComponentProps<typeof Disclosure>, "Inside"),
    );

    const line = new RegExp(`<span class="([^"]*)">${hint}</span>`).exec(html);
    expect(line).not.toBeNull();
    expect(line![1].split(" ")).not.toContain("truncate");
    // Closed, what is inside is not drawn.
    expect(html).not.toContain("Inside");
  });
});
