import { ImageResponse } from "next/og";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Manifest — everything about your trip, in one file.";

/** Secondary text, as in the app's dark theme: paper at 60% on ink. */
const PAPER_SOFT = "rgba(244, 246, 243, 0.6)";

/**
 * The card people see when a trip link or the site itself is shared. X reads
 * it too: Next copies this image into the twitter tags, so there is no
 * separate twitter-image.
 *
 * The face is Geist, the one font next/og bundles: a plain grotesque close to
 * the system faces the app uses, which cannot be shipped here (San Francisco
 * is licensed for Apple's own platforms only). Only its regular weight is
 * bundled, so the hierarchy comes from size and colour, not weight.
 */
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
          padding: "0 92px",
          background: BRAND.ink,
          color: BRAND.paper,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The mark as the dark theme draws it: light copper, with the check cut in ink. */}
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
          <span style={{ fontSize: 44, letterSpacing: "-0.02em" }}>Manifest</span>
        </div>

        {/* Satori needs an explicit display on anything with more than one child. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            lineHeight: 1.1,
            marginTop: 44,
            letterSpacing: "-0.03em",
          }}
        >
          <span>Everything about your trip,</span>
          <span>in one file.</span>
        </div>

        {/*
          Nothing here may overpromise. Trips are kept on the device, but what
          someone asks Manifest to read is sent to the server to be read, so
          the card does not say that nothing leaves the device.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 32,
            color: PAPER_SOFT,
            marginTop: 32,
            lineHeight: 1.4,
          }}
        >
          <span>Files your bookings. Catches the admin that ruins trips.</span>
          <span>No account to make, and it works with no signal.</span>
        </div>
      </div>
    ),
    size,
  );
}
