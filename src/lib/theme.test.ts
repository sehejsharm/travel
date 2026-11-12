import { describe, expect, it } from "vitest";
import { heroGradient, hueGradient } from "./theme";

/** The two OKLCH hues a hero gradient runs between. */
function hues(gradient: string): number[] {
  return [...gradient.matchAll(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/g)].map((match) => Number(match[1]));
}

const inBlueViolet = (hue: number) => hue >= 250 && hue <= 305;

describe("the hero's gradient", () => {
  it("never starts or ends between blue and violet, whatever the hue", () => {
    for (let hue = 0; hue < 360; hue++) {
      const ends = hues(hueGradient(hue));
      expect(ends, `hue ${hue}`).toHaveLength(2);
      expect(ends.some(inBlueViolet), `hue ${hue}: ${ends.join(" to ")}`).toBe(false);
    }
  });

  it("moves the seeds that used to land there, the sample trip's among them", () => {
    // JPTH (the sample trip) hashed to 250 to 298, and "manifest" to 255 to 303.
    for (const seed of ["JPTH", "manifest"]) {
      expect(hues(heroGradient(seed)).some(inBlueViolet), seed).toBe(false);
    }
  });

  it("draws every other hue as it was, so those trips keep their colour", () => {
    expect(hueGradient(18)).toBe("linear-gradient(135deg, oklch(0.45 0.13 18), oklch(0.34 0.12 66))");
    expect(hueGradient(201)).toBe("linear-gradient(135deg, oklch(0.45 0.13 201), oklch(0.34 0.12 249))");
    // JPKR hashes to 341.
    expect(hues(heroGradient("JPKR"))).toEqual([341, 29]);
  });

  it("spreads the moved hues out rather than piling them on one colour", () => {
    const moved = new Set<number>();
    for (let hue = 202; hue <= 305; hue++) moved.add(hues(hueGradient(hue))[0]);
    expect(moved.size).toBe(104);
  });
});
