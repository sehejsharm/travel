"use client";

import { flagEmoji, heroGradient, hueGradient } from "@/lib/theme";

/**
 * The hero, previewed while you are still filling in the form, with a few
 * alternates. The default stays derived from the destination — this only
 * overrides it, so a trip still looks like somewhere without anyone choosing.
 */
export const ACCENT_CHOICES: { hue: number; label: string }[] = [
  { hue: 18, label: "Clay" },
  { hue: 96, label: "Olive" },
  { hue: 198, label: "Harbour" },
  { hue: 268, label: "Plum" },
];

export function CoverPicker({
  name,
  seed,
  dates,
  countries,
  accentHue,
  onChange,
}: {
  name: string;
  seed: string;
  dates: string;
  countries: string[];
  accentHue?: number;
  onChange: (hue?: number) => void;
}) {
  const background = accentHue === undefined ? heroGradient(seed) : hueGradient(accentHue);

  return (
    <div className="flex flex-col gap-3">
      {/* rounded-card, not the hero's rounded-container: it sits inside a card and
          must not be rounder than the card around it. */}
      <div
        className="relative isolate overflow-hidden rounded-card p-4 text-white shadow-card"
        style={{ backgroundImage: background }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
          preserveAspectRatio="none"
          viewBox="0 0 400 140"
        >
          {[0, 1, 2, 3, 4].map((ring) => (
            <ellipse
              key={ring}
              cx="330"
              cy="30"
              rx={36 + ring * 44}
              ry={24 + ring * 28}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
            />
          ))}
        </svg>

        <div className="relative">
          {/* The same label the trip hero carries over its title. */}
          <p className="text-footnote font-medium text-white/80">Preview</p>
          <p className="mt-1 text-title-2">{name || "Your trip"}</p>
          <p className="mt-1 text-footnote text-white/80">{dates}</p>
          {countries.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1">
              {countries.map((code) => (
                <span
                  key={code}
                  className="rounded-badge border border-white/20 bg-white/10 px-2 py-1 text-caption"
                >
                  {flagEmoji(code)} {code}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* Each swatch is drawn at 32px with .tap; gap-3 keeps their 44px hit areas apart. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={accentHue === undefined}
          className={`press tap flex min-h-8 items-center rounded-badge border px-3 text-footnote ${
            accentHue === undefined
              ? "border-accent bg-accent-soft text-accent-strong"
              : "border-line text-ink-soft"
          }`}
        >
          From destination
        </button>

        {ACCENT_CHOICES.map((choice) => (
          <button
            key={choice.hue}
            type="button"
            onClick={() => onChange(choice.hue)}
            aria-pressed={accentHue === choice.hue}
            aria-label={choice.label}
            className={`press tap h-8 w-8 rounded-full border-2 ${
              accentHue === choice.hue ? "border-accent" : "border-transparent"
            }`}
            style={{ backgroundImage: hueGradient(choice.hue) }}
          />
        ))}
      </div>
    </div>
  );
}
