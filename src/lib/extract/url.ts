import type { SourceKind } from "../domain/types";

export interface DetectedLink {
  /** The link as it will be fetched: parsed, on a known host, and https. */
  url: string;
  source: SourceKind;
  platform: string;
  /** Canonical id, where the platform exposes one in the URL. */
  ref?: string;
  /** oEmbed endpoint, for the platforms that serve one without a key. */
  oembed?: string;
}

interface Platform {
  source: SourceKind;
  platform: string;
  /**
   * The exact hostnames this platform serves posts from. A link is only ever
   * fetched when its hostname is one of these, never because the platform's
   * name appears somewhere else in the URL.
   */
  hosts: readonly string[];
  /** The post id, or undefined when the path is not a post. */
  ref: (url: URL) => string | undefined;
  oembed?: (url: string) => string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}/;

const PLATFORMS: readonly Platform[] = [
  {
    source: "reel",
    platform: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    ref: (url) => url.pathname.match(/^\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i)?.[1],
  },
  {
    source: "tiktok",
    platform: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com"],
    ref: (url) => url.pathname.match(/^\/@[\w.-]+\/video\/(\d+)/i)?.[1],
  },
  {
    source: "youtube",
    platform: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    ref: (url) => {
      if (url.hostname === "youtu.be") return url.pathname.slice(1).match(YOUTUBE_ID)?.[0];
      if (url.pathname === "/watch") return url.searchParams.get("v")?.match(YOUTUBE_ID)?.[0];
      return url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/i)?.[1];
    },
    oembed: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
];

function platformOn(url: URL): Platform | undefined {
  return PLATFORMS.find((platform) => platform.hosts.includes(url.hostname));
}

/**
 * Whether the server may request this URL on behalf of a link it detected:
 * https, the platform's own hostname, the default port, and no credentials.
 * Shared with the page fetcher so a redirect is held to the same rule as the
 * link that started it — and, given a platform, must stay on that platform.
 */
export function isFetchableLink(value: string | URL, platform?: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") {
    return false;
  }

  const found = platformOn(url);
  return Boolean(found && (platform === undefined || found.platform === platform));
}

/** Finds the first recognisable social link in pasted text. */
export function detectLink(text: string): DetectedLink | undefined {
  const candidates = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }

    // An old http:// share link is still the platform's own; it is only ever
    // requested over https.
    if (url.protocol === "http:") url.protocol = "https:";
    if (!isFetchableLink(url)) continue;

    const platform = platformOn(url);
    const ref = platform?.ref(url);
    if (!platform || !ref) continue;

    return {
      url: url.href,
      source: platform.source,
      platform: platform.platform,
      ref,
      oembed: platform.oembed?.(url.href),
    };
  }

  return undefined;
}

export interface LinkMetadata {
  title: string;
  author?: string;
}

/**
 * Best-effort only. Instagram and TikTok now gate oEmbed behind an app token,
 * and any endpoint can be unreachable, so a failure here must not stop the item
 * being filed — the caption the user pasted is still extracted.
 */
export async function fetchLinkMetadata(
  link: DetectedLink,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkMetadata | undefined> {
  if (!link.oembed) return undefined;

  try {
    const response = await fetchImpl(link.oembed, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return undefined;

    const payload = (await response.json()) as { title?: string; author_name?: string };
    if (!payload.title) return undefined;

    return { title: payload.title, author: payload.author_name };
  } catch {
    return undefined;
  }
}
