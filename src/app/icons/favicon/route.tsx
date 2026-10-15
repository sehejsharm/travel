import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const runtime = "nodejs";
// Prerendered at build time: an icon never changes between requests.
export const dynamic = "force-static";

/**
 * The 48px frame of favicon.ico. The .ico also carries 16 and 32px frames
 * drawn the same way, because a browser shrinking this one to tab size
 * blurs it.
 *
 * At every size the mark is scaled so the stub's edges land on whole pixels
 * (here 0.75, with the viewBox nudged half a pixel down), and the check is
 * stroked heavier the smaller it gets: 7 units here, 7.5 at 32px, 9 at 16px.
 * That is why this is not just the 192 route scaled down.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BRAND.ink,
        }}
      >
        <svg width="48" height="48" viewBox="0 -0.6667 64 64">
          <path d={STUB_PATH} fill={BRAND.accentLight} />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke={BRAND.ink}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 48, height: 48 },
  );
}
