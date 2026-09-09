import type { SourceKind } from "../domain/types";

export interface DetectedLink {
  url: string;
  source: SourceKind;
  platform: string;
  /** Canonical id, where the platform exposes one in the URL. */
  ref?: string;
  /** oEmbed endpoint, for the platforms that serve one without a key. */
  oembed?: string;
}

const PATTERNS: {
  test: RegExp;
  source: SourceKind;
  platform: string;
  oembed?: (url: string) => string;
}[] = [
  {
    test: /instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i,
    source: "reel",
    platform: "Instagram",
  },
  {
    test: /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    source: "tiktok",
    platform: "TikTok",
  },
  {
    test: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i,
    source: "youtube",
    platform: "YouTube",
    oembed: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  },
];

/** Finds the first recognisable social link in pasted text. */
export function detectLink(text: string): DetectedLink | undefined {
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];

  for (const url of urls) {
    for (const pattern of PATTERNS) {
      const match = url.match(pattern.test);
      if (!match) continue;

      return {
        url,
        source: pattern.source,
        platform: pattern.platform,
        ref: match[1],
        oembed: pattern.oembed?.(url),
      };
    }
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
