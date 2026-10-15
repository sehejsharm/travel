import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Only the pages that say the same thing to everyone. The app screens hold
 * one device's own trip, so to a crawler they are an empty shell, and the
 * shared-trip page carries its trip in the link's fragment.
 */
const PUBLIC_PATHS = [
  "/",
  "/legal/privacy",
  "/legal/terms",
  "/legal/data-deletion",
  "/legal/licences",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // No lastModified: a build date would claim every page changed on every deploy.
  return PUBLIC_PATHS.map((path) => ({ url: new URL(path, base).href }));
}
