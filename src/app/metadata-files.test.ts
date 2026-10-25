import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";
import { metadata as root } from "./layout";
import { metadata as add } from "./add/layout";
import { metadata as cabinet } from "./cabinet/layout";
import { metadata as checks } from "./checks/layout";
import { metadata as discover } from "./discover/layout";
import { metadata as divert } from "./divert/layout";
import manifest from "./manifest";
import { metadata as more } from "./more/layout";
import { metadata as notFound } from "./not-found";
import { metadata as recap } from "./recap/layout";
import robots from "./robots";
import { metadata as share } from "./share/layout";
import sitemap from "./sitemap";
import { metadata as trip } from "./trip/layout";
import { metadata as newTrip } from "./trip/new/layout";

// fileURLToPath, not URL.pathname: the pathname keeps %20 for spaces and, on Windows, a leading /C:/.
const APP = path.dirname(fileURLToPath(import.meta.url));
const origin = siteUrl().origin;

const TEMPLATE = "%s · Manifest";

/** A segment's own title, whether it is set as a string or with a template for the ones below. */
function ownTitle(metadata: Metadata): string | undefined {
  const { title } = metadata;
  if (typeof title === "string") return title;
  return title && "default" in title ? title.default : undefined;
}

/** Where the page for a URL path lives, if the app has one. */
function pageFile(pathname: string): string {
  return path.join(APP, pathname, "page.tsx");
}

describe("sitemap", () => {
  const entries = sitemap();
  const paths = entries.map((entry) => new URL(entry.url).pathname);

  it("gives absolute URLs on the site's own origin", () => {
    for (const entry of entries) {
      expect(new URL(entry.url).origin).toBe(origin);
    }
  });

  it("lists the home page and every legal page, each of which exists", () => {
    const legal = readdirSync(path.join(APP, "legal"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(pageFile(`/legal/${entry.name}`)))
      .map((entry) => `/legal/${entry.name}`);

    expect(legal.length).toBeGreaterThan(0);
    expect([...paths].sort()).toEqual(["/", ...legal].sort());
    for (const pathname of paths) expect(existsSync(pageFile(pathname))).toBe(true);
  });

  it("leaves out the per-device app screens, the shared trip and the API", () => {
    for (const pathname of paths) {
      expect(pathname).not.toMatch(/^\/(add|cabinet|checks|discover|divert|more|recap|trip|share|api)\b/);
    }
  });
});

describe("robots.txt", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it("allows the site and keeps crawlers off the API only", () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].allow).toBe("/");
    expect(rules[0].disallow).toEqual(["/api/"]);
  });

  it("points at the sitemap by absolute URL", () => {
    expect(result.sitemap).toBe(`${origin}/sitemap.xml`);
  });
});

describe("screen metadata", () => {
  const SCREENS: [string, Metadata][] = [
    ["/add", add],
    ["/cabinet", cabinet],
    ["/checks", checks],
    ["/discover", discover],
    ["/divert", divert],
    ["/more", more],
    ["/recap", recap],
    ["/trip", trip],
    ["/trip/new", newTrip],
    ["/share", share],
  ];

  it("brands every title through the root template", () => {
    expect(root.title).toEqual({ template: TEMPLATE, default: "Manifest" });
    expect(root.twitter).toMatchObject({ card: "summary_large_image" });
    // A title, description or url here would be every screen's, not its own.
    expect(root.openGraph).not.toHaveProperty("title");
    expect(root.openGraph).not.toHaveProperty("description");
    expect(root.openGraph).not.toHaveProperty("url");
  });

  it.each(SCREENS)("%s has its own title and a one-sentence description", (_, metadata) => {
    const title = ownTitle(metadata);
    expect(title).toMatch(/^[A-Z]/);
    // The root template adds the brand; a title carrying it would say it twice.
    expect(title).not.toMatch(/Manifest/);
    expect(metadata.description).toMatch(/^[A-Z][^.!?]*(?:\.\s[A-Z][^.!?]*)?\.$/);
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    // Setting openGraph here would replace the root's, image and all.
    expect(metadata.openGraph).toBeUndefined();
  });

  it("gives every screen a different title", () => {
    expect(new Set(SCREENS.map(([, metadata]) => ownTitle(metadata))).size).toBe(SCREENS.length);
  });

  it("hands the template on past /trip, so /trip/new is branded too", () => {
    // Next passes a template down only from a layout that sets one.
    expect(trip.title).toMatchObject({ template: TEMPLATE });
  });

  it("brands the 404 itself, which the root template does not reach", () => {
    expect(notFound.title).toEqual({ absolute: "Page not found · Manifest" });
  });

  it("keeps the shared trip out of search results", () => {
    expect(share.robots).toMatchObject({ index: false });
  });
});

describe("social card", () => {
  it("is a 1200 x 630 PNG with alt text", async () => {
    const card = await import("./opengraph-image");
    expect(card.size).toEqual({ width: 1200, height: 630 });
    expect(card.contentType).toBe("image/png");
    expect(card.alt.length).toBeGreaterThan(0);

    const png = Buffer.from(await card.default().arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  }, 20_000);
});

describe("favicon.ico", () => {
  const ico = readFileSync(path.join(APP, "favicon.ico"));
  const count = ico.readUInt16LE(4);
  const frames = Array.from({ length: count }, (_, index) => {
    const at = 6 + index * 16;
    const size = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    const png = ico.subarray(offset, offset + size);
    return {
      declared: ico.readUInt8(at),
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
      isPng: png.subarray(1, 4).toString() === "PNG",
    };
  });

  it("carries 48, 32 and 16px frames whose images match what they declare", () => {
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(frames.map((frame) => frame.declared)).toEqual([48, 32, 16]);
    for (const frame of frames) {
      expect(frame.isPng).toBe(true);
      expect([frame.width, frame.height]).toEqual([frame.declared, frame.declared]);
    }
  });
});

describe("web app manifest", () => {
  it("only names icons the app serves", () => {
    for (const icon of manifest().icons ?? []) {
      const name = icon.src.replace(/^\//, "");
      const served =
        existsSync(path.join(APP, name)) ||
        existsSync(path.join(APP, `${name}.tsx`)) ||
        existsSync(path.join(APP, name, "route.tsx"));
      expect(served, icon.src).toBe(true);
    }
  });
});
