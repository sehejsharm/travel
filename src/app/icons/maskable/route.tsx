import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const runtime = "nodejs";
// Prerendered at build time: an icon never changes between requests.
export const dynamic = "force-static";

/** Maskable (stub in ink on an accent plate, so the check is cut by the plate): the mark sits inside the 40% safe zone so no crop clips it, on a full bleed plate. */
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
          background: BRAND.accent,
        }}
      >
        <svg width={230} height={230} viewBox="0 0 64 64">
          <path d={STUB_PATH} fill={BRAND.ink} />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke={BRAND.accent}
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
