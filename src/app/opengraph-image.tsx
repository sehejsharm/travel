import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Manifest — everything about your trip, in one file.";

/** The card people see when a trip link or the site itself is shared. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: BRAND.ink,
          color: BRAND.paper,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
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
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>Manifest</span>
        </div>

        {/* Satori needs an explicit display on anything with more than one child. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.1,
            marginTop: 44,
            letterSpacing: "-0.03em",
          }}
        >
          <span>Everything about your trip,</span>
          <span>in one file.</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 30,
            color: "#9fb0b7",
            marginTop: 32,
            lineHeight: 1.4,
          }}
        >
          <span>Files your bookings automatically. Catches the admin that ruins trips.</span>
          <span>Works with no signal, and never leaves your device.</span>
        </div>
      </div>
    ),
    size,
  );
}
