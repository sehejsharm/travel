/**
 * A trip has no photography behind it — the app works offline — so its
 * identity comes from colour derived from where it goes. The same
 * destination always produces the same pair of hues.
 */
export function destinationHues(seed: string): [number, number] {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return [hash, (hash + 48) % 360];
}

/*
 * Drawn in OKLCH rather than HSL, so every hue is equally light. In HSL a
 * yellow or an orange at the same lightness as a blue is far brighter, and the
 * hero's white text fell to about 2.3:1 on half the hues. At OKLCH lightness
 * 0.45, white stays above 6.4:1 and the hero's 80% white above 4.5:1 for every
 * hue, through the hero's hue drift too (hue-rotate and saturate both keep
 * luminance).
 */
function gradientFrom(hue: number): string {
  return `linear-gradient(135deg, oklch(0.45 0.13 ${hue}), oklch(0.34 0.12 ${(hue + 48) % 360}))`;
}

export function heroGradient(seed: string): string {
  return gradientFrom(destinationHues(seed || "trip")[0]);
}

/** The same gradient shape, from a hue the traveller picked rather than derived. */
export function hueGradient(hue: number): string {
  return gradientFrom(hue);
}

/** ISO 3166-1 alpha-2 to its flag emoji, by regional indicator offset. */
export function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(
    base + code.toUpperCase().charCodeAt(0),
    base + code.toUpperCase().charCodeAt(1),
  );
}
