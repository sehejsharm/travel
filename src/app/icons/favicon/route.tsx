import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const runtime = "nodejs";
// Prerendered at build time: an icon never changes between requests.
export const dynamic = "force-static";

/**
 * The 48px source the favicon.ico is built from. Small enough that the check
 * needs a heavier stroke to survive, which is why this is not just the 192
 * route scaled down.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.ink,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 64 64">
          <path d={STUB_PATH} fill={BRAND.accentLight} />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke={BRAND.ink}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 48, height: 48 },
  );
}
