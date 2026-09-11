import type { DetectedLink } from "./url";

export interface PageMetadata {
  title?: string;
  description?: string;
  image?: string;
  /** Everything worth reading, joined for the extractor. */
  text: string;
}

/** Instagram and TikTok serve their caption to crawlers, not to fetch defaults. */
const CRAWLER_UA =
  "Mozilla/5.0 (compatible; ManifestBot/1.0; +https://github.com/sehejsharm/travel)";

const MAX_BYTES = 512_000;
const TIMEOUT_MS = 8000;

function readMeta(html: string, property: string): string | undefined {
  // Attribute order varies by site, so match either way round.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }

  return undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/**
 * Reads the Open Graph tags a shared link exposes. This is what makes a pasted
 * Reel work: the caption lives in og:description, and the extractor can only
 * find places, prices and times if it has that text to read.
 *
 * Only links the detector already recognised are fetched, which keeps this from
 * becoming a way to make the server request arbitrary hosts.
 */
export async function fetchPageMetadata(
  link: DetectedLink,
  fetchImpl: typeof fetch = fetch,
): Promise<PageMetadata | undefined> {
  try {
    const response = await fetchImpl(link.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": CRAWLER_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
    });

    if (!response.ok) return undefined;

    const body = await response.text();
    const html = body.slice(0, MAX_BYTES);

    const title = readMeta(html, "og:title") ?? readMeta(html, "twitter:title");
    const description =
      readMeta(html, "og:description") ?? readMeta(html, "twitter:description");
    const image = readMeta(html, "og:image");

    const text = [title, description].filter(Boolean).join("\n").trim();
    if (!text) return undefined;

    return { title, description, image, text };
  } catch {
    // Rate limits, logins and blocked crawlers are all normal here. The caller
    // falls back to whatever the user pasted alongside the link.
    return undefined;
  }
}
