import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS ignores SVG icons, so the home-screen icon is rendered to PNG. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1116",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 40 40">
          <rect
            x="5"
            y="9"
            width="30"
            height="22"
            rx="3"
            fill="none"
            stroke="#e39a5c"
            strokeWidth="2.8"
          />
          <line x1="5" y1="16.5" x2="35" y2="16.5" stroke="#e39a5c" strokeWidth="2.8" />
          <circle cx="11.5" cy="24" r="2" fill="#e39a5c" />
          <line
            x1="16.5"
            y1="24"
            x2="29"
            y2="24"
            stroke="#e39a5c"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
