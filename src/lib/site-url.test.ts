import { describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

describe("the site's own address", () => {
  it("uses NEXT_PUBLIC_SITE_URL when it is a real address", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://manifest.example" }).href).toBe(
      "https://manifest.example/",
    );
  });

  it("does not fail the build when the variable exists but is blank", () => {
    // Exactly what importing .env.example into Vercel produced.
    expect(() => siteUrl({ NEXT_PUBLIC_SITE_URL: "" })).not.toThrow();
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "   " }).href).toBe("https://manifest.trip/");
  });

  it("falls back to the domain Vercel gives the project", () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "travel-seven.vercel.app" }).href,
    ).toBe("https://travel-seven.vercel.app/");
  });

  it("reads a bare host as https", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "manifest.example" }).href).toBe("https://manifest.example/");
  });

  it("skips something that is not an address, and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "not a url", VERCEL_PROJECT_PRODUCTION_URL: "travel.vercel.app" }).href,
    ).toBe("https://travel.vercel.app/");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("keeps the placeholder when nothing is set at all", () => {
    expect(siteUrl({}).href).toBe("https://manifest.trip/");
  });
});
