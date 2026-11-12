import type { ReactNode } from "react";
import type { IconName } from "@/lib/icons";

/**
 * The app's one set of line icons, drawn like the tab bar's: a 24 box, a 1.7
 * stroke in the current colour, round caps and joins, and no fills, so they
 * sit beside text in its own colour. Flags are the one emoji the app keeps.
 */
const GLYPHS: Record<IconName, ReactNode> = {
  backpack: (
    <>
      <path d="M5.5 10.5a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z" />
      <path d="M10 6.5V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 14 5v1.5" />
      <path d="M8.5 20.5v-4a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4M9 11h6" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  bench: (
    <>
      <path d="M3.5 11.5h17" />
      <path d="M5.5 11.5V7h13v4.5" />
      <path d="M6 11.5v6M18 11.5v6M8.5 11.5V15h7v-3.5" />
    </>
  ),
  bolt: <path d="M13 3.5 5 13.5h6.5l-1 7 8.5-10h-6.5z" />,
  bowl: (
    <>
      <path d="M4 11.5h16a8 8 0 0 1-16 0z" />
      <path d="M9.5 11.5 12 4.5M13.5 11.5l4.5-6" />
      <path d="M8 19.5h8" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  camera: (
    <>
      <rect x="3.5" y="7.5" width="17" height="11.5" rx="2.5" />
      <circle cx="12" cy="13.2" r="3.3" />
      <path d="m8.8 7.5 1.3-2.5h3.8l1.3 2.5" />
    </>
  ),
  chat: (
    <>
      <path d="M9 11a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2v8.5L18 17h-7a2 2 0 0 1-2-2z" />
      <path d="M15 9V6a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v8.5L6 12h3" />
    </>
  ),
  clapper: (
    <>
      <path d="M3.5 11h17v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 11 20 6.5 19.3 4 2.8 8.5z" />
      <path d="m7.5 7.2 2.2 2.6M12.5 5.9l2.2 2.6" />
    </>
  ),
  cocktail: (
    <>
      <path d="M4.5 5h15L12 13z" />
      <path d="M12 13v6.5M8 19.5h8" />
    </>
  ),
  columns: (
    <>
      <path d="M12 3.5 3.5 8h17z" />
      <path d="M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7" />
      <path d="M3.5 20h17" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" />
    </>
  ),
  cup: (
    <>
      <path d="M5 9h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8.5 4.5c0 1.2-1 1.3-1 2.5M11.5 4.5c0 1.2-1 1.3-1 2.5" />
    </>
  ),
  family: (
    <>
      <circle cx="8.5" cy="7" r="2.5" />
      <path d="M4 20v-3.5a4.5 4.5 0 0 1 9 0V20" />
      <circle cx="17" cy="11" r="2" />
      <path d="M14 20v-1.5a3 3 0 0 1 6 0V20" />
    </>
  ),
  gem: (
    <>
      <path d="M7 4.5h10l3.5 5-8.5 10-8.5-10z" />
      <path d="M3.5 9.5h17M10.5 4.5 9 9.5l3 10 3-10-1.5-5" />
    </>
  ),
  heart: (
    <path d="M12 19.5s-7.5-4.6-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.4-7.5 10-7.5 10z" />
  ),
  "hot-spring": (
    <>
      <path d="M4.5 14.5a7.5 4.5 0 0 0 15 0" />
      <path d="M8.5 12.5c-1.2-1.3-1.2-2.7 0-4s1.2-2.7 0-4M12 12.5c-1.2-1.3-1.2-2.7 0-4s1.2-2.7 0-4M15.5 12.5c-1.2-1.3-1.2-2.7 0-4s1.2-2.7 0-4" />
    </>
  ),
  houses: (
    <>
      <path d="M4 19v-9l5-4.5 5 4.5v9" />
      <path d="M14 13l3-2.75 3 2.75V19" />
      <path d="M3 19h18M7.5 19v-4h3v4" />
    </>
  ),
  jacket: (
    <>
      <path d="M9.5 3.5 5.5 5 2.5 15.5l2.5 1L8 11v9.5h8V11l3 5.5 2.5-1L18.5 5l-4-1.5" />
      <path d="M9.5 3.5 12 8l2.5-4.5M12 8v12.5" />
    </>
  ),
  mortarboard: (
    <>
      <path d="M12 5 21 9.5 12 14 3 9.5z" />
      <path d="M7 11.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
      <path d="M21 9.5v5" />
    </>
  ),
  mountains: <path d="M3 17.5 9 6.5l3.5 6 2.5-3.5 6 8.5z" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 2-2 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a3.5 3.5 0 0 0 3.5-3.5c0-4-3.8-7-8.5-7z" />
      <circle cx="7.5" cy="11" r="0.9" />
      <circle cx="10" cy="7.5" r="0.9" />
      <circle cx="14.5" cy="7.5" r="0.9" />
    </>
  ),
  paw: (
    <>
      <path d="M12 12.5c-2.5 0-5 3-5 5.2 0 1.4 1 2.3 2.5 2.3 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.5 0 2.5-.9 2.5-2.3 0-2.2-2.5-5.2-5-5.2z" />
      <ellipse cx="5.5" cy="10.5" rx="1.6" ry="2" />
      <ellipse cx="9.2" cy="6.2" rx="1.7" ry="2.2" />
      <ellipse cx="14.8" cy="6.2" rx="1.7" ry="2.2" />
      <ellipse cx="18.5" cy="10.5" rx="1.6" ry="2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5V19a5.5 5.5 0 0 1 11 0v.5" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.2a5.5 5.5 0 0 1 3.5 5.1v.2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  plane: (
    <path
      transform="translate(1.25 -1.25) rotate(45 12 12)"
      d="M12 3.5c1 0 1.5 1 1.5 2.5v4l7 4v2l-7-2v4l2 1.5v1.5l-3.5-1-3.5 1v-1.5l2-1.5v-4l-7 2v-2l7-4V6c0-1.5.5-2.5 1.5-2.5z"
    />
  ),
  plug: (
    <>
      <path d="M9.5 4v5M14.5 4v5" />
      <path d="M6.5 9h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 18v2.5" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 20V6.25a2.25 2.25 0 1 1-2.25-2.25H17v13.75a2.25 2.25 0 1 1 2.25 2.25z" />
      <path d="M10 10h4M10 13.5h4" />
    </>
  ),
  signal: <path d="M5 18.5V16M9.5 18.5V13M14 18.5v-9M18.5 18.5v-13" />,
  suitcase: (
    <>
      <rect x="6" y="7.5" width="12" height="12" rx="2" />
      <path d="M10 7.5v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M9.5 10.5v6M14.5 10.5v6M8.5 19.5v1M15.5 19.5v1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  tent: (
    <>
      <path d="M4.5 19.5 13.4 3.5M19.5 19.5 10.6 3.5" />
      <path d="M3 19.5h18M9.5 19.5l2.5-5 2.5 5" />
    </>
  ),
  ticket: (
    <>
      <path d="M5 7h14a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 0 0 3v2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 0 0-3v-2A1.5 1.5 0 0 1 5 7z" />
      <path d="M15 8.5v1M15 11.5v1M15 14.5v1" />
    </>
  ),
  train: (
    <>
      <rect x="6" y="3.5" width="12" height="13.5" rx="3" />
      <path d="M6 10h12M9 13.5h.01M15 13.5h.01" />
      <path d="M8.5 17 7 20.5M15.5 17l1.5 3.5" />
    </>
  ),
  waves: (
    <path d="M3 9q1.5-2.6 3 0t3 0 3 0 3 0 3 0 3 0M3 15.5q1.5-2.6 3 0t3 0 3 0 3 0 3 0 3 0" />
  ),
};

export function LineIcon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[name]}
      </g>
    </svg>
  );
}
