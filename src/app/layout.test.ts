import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

/** The pre-paint script's source, found in the layout's element tree without rendering the shell. */
function prePaintScript(): string {
  const tree = RootLayout({ children: null } as never) as ReactElement;
  const found: string[] = [];
  (function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object" || !("props" in node)) return;
    const props = (node as ReactElement<{ children?: unknown; dangerouslySetInnerHTML?: { __html: string } }>).props;
    if (props.dangerouslySetInnerHTML) found.push(props.dangerouslySetInnerHTML.__html);
    walk(props.children);
  })(tree);
  return found[0];
}

/** Whether a visit counts as a first run: the script run against a stand-in page. */
function firstRun(pathname: string, stored: string | null): string | undefined {
  const dataset: Record<string, string> = {};
  const storage = { getItem: () => stored };
  new Function("localStorage", "location", "document", prePaintScript())(storage, { pathname }, { documentElement: { dataset } });
  return dataset.firstRun;
}

describe("the splash's first-run hold", () => {
  it("holds for someone new to Manifest", () => {
    expect(firstRun("/", null)).toBe("true");
    expect(firstRun("/trip/new", null)).toBe("true");
  });

  it("does not hold for someone who has used it before", () => {
    expect(firstRun("/", '{"trips":[]}')).toBeUndefined();
  });

  it("does not keep a shared trip waiting, though whoever opens it is nearly always new", () => {
    expect(firstRun("/share", null)).toBeUndefined();
    expect(firstRun("/share/", null)).toBeUndefined();
  });
});
