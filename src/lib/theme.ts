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

export function heroGradient(seed: string): string {
  const [from, to] = destinationHues(seed || "trip");
  return `linear-gradient(135deg, hsl(${from} 52% 42%), hsl(${to} 58% 30%))`;
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
