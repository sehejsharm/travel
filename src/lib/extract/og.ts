import { isFetchableLink, type DetectedLink } from "./url";

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
/** Share links bounce once or twice (youtu.be to youtube.com, a login wall). */
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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
 * This is the one place the server requests a URL a visitor chose, so it only
 * ever requests the platform's own hosts over https. Redirects are followed by
 * hand rather than by fetch, and each hop is held to that same rule: a link on
 * a real host that bounces somewhere else is dropped, not followed.
 */
export async function fetchPageMetadata(
  link: DetectedLink,
  fetchImpl: typeof fetch = fetch,
): Promise<PageMetadata | undefined> {
  if (!isFetchableLink(link.url, link.platform)) return undefined;

  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let target = link.url;
    let response: Response | undefined;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const current = await fetchImpl(target, {
        redirect: "manual",
        signal,
        headers: {
          "user-agent": CRAWLER_UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });

      if (!REDIRECT_STATUSES.has(current.status)) {
        response = current;
        break;
      }

      await current.body?.cancel();
      const location = current.headers.get("location");
      if (!location) return undefined;

      const next = new URL(location, target).href;
      if (!isFetchableLink(next, link.platform)) return undefined;
      target = next;
    }

    // Out of hops, or a fetch that followed redirects on its own and ended up
    // somewhere it should not have.
    if (!response) return undefined;
    if (response.url && !isFetchableLink(response.url, link.platform)) return undefined;
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
