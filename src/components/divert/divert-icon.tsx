import type { ReactNode } from "react";
import type { DivertIcon } from "@/lib/divert/types";

/** Line icons for the divert interests, drawn like the tab bar's. */
const GLYPHS: Record<DivertIcon, ReactNode> = {
  cup: (
    <>
      <path d="M5 9h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8.5 4.5c0 1.2-1 1.3-1 2.5M11.5 4.5c0 1.2-1 1.3-1 2.5" />
    </>
  ),
  camera: (
    <>
      <rect x="3.5" y="7.5" width="17" height="11.5" rx="2.5" />
      <circle cx="12" cy="13.2" r="3.3" />
      <path d="m8.8 7.5 1.3-2.5h3.8l1.3 2.5" />
    </>
  ),
  bowl: (
    <>
      <path d="M4 11.5h16a8 8 0 0 1-16 0z" />
      <path d="M9.5 11.5 12 4.5M13.5 11.5l4.5-6" />
      <path d="M8 19.5h8" />
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
      <path d="M3.5 12.5h17" />
      <path d="M5.5 12.5V8h13v4.5" />
      <path d="M6 12.5v6M18 12.5v6M8.5 12.5V16h7v-3.5" />
    </>
  ),
};

export function DivertIconGlyph({ icon, size = 22 }: { icon: DivertIcon; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[icon]}
      </g>
    </svg>
  );
}
