import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DataDeletion from "./page";

describe("the data-deletion page", () => {
  it("takes Go to This device to the This device section, not the top of More", () => {
    const html = renderToStaticMarkup(createElement(DataDeletion));

    expect(html).toMatch(/<a [^>]*href="\/more#this-device"[^>]*>Go to This device<\/a>/);
  });
});
