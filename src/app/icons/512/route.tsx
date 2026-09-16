import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const runtime = "nodejs";
// Prerendered at build time: an icon never changes between requests.
export const dynamic = "force-static";

/** The large PWA icon, used for splash screens on Android. */
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
        <svg width={338} height={338} viewBox="0 0 64 64">
          <path d={STUB_PATH} fill={BRAND.accentLight} />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke={BRAND.ink}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
