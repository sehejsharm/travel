/**
 * The Manifest mark: a boarding-pass stub with a checkmark torn through it.
 * The stub says travel; the check says this app is the one that looks at your
 * plan and tells you what is wrong with it. One path, so it stays legible
 * from a 1024px store tile down to a 16px favicon.
 */

export const BRAND = {
  ink: "#0b1116",
  accent: "#c1793d",
  accentLight: "#e39a5c",
  paper: "#f4f6f3",
} as const;

/**
 * The stub outline on a 64-unit grid, with the perforation notches bitten out
 * of both long edges. Drawn as one closed path so it fills cleanly.
 */
export const STUB_PATH =
  "M8 14h48v10.5a7.5 7.5 0 0 0 0 15V50H8V39.5a7.5 7.5 0 0 0 0-15z";

/** The check, stroked over the stub in the background colour to read as cut out. */
export const CHECK_PATH = "M19 32.5 26.5 40 43 23";

export interface MarkColors {
  /** The stub itself. */
  fill: string;
  /** The check torn through it — normally the background behind the mark. */
  cut: string;
}

/** A standalone SVG string, for files that are not React (manifest, press kit). */
export function markSvg({
  size = 64,
  fill = BRAND.accent,
  cut = BRAND.ink,
  background,
  radius = 0,
}: Partial<MarkColors> & { size?: number; background?: string; radius?: number } = {}): string {
  const plate = background
    ? `<rect width="64" height="64" rx="${radius}" fill="${background}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${plate}<path d="${STUB_PATH}" fill="${fill}"/><path d="${CHECK_PATH}" fill="none" stroke="${cut}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
