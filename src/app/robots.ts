import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API answers the app, not readers. A shared trip stays out of search
      // through the noindex in share/layout.tsx, which crawlers only see if
      // this file lets them fetch the page; it is an empty shell anyway (the
      // trip is in the link's fragment), and link-preview bots can draw the card.
      disallow: ["/api/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
