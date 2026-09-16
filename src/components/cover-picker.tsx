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
    <div className="flex flex-col gap-2.5">
      <div
        className="relative isolate overflow-hidden rounded-2xl p-4 text-white shadow-card"
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
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/70">Preview</p>
          <p className="mt-1 font-display text-xl leading-tight font-semibold tracking-tight">
            {name || "Your trip"}
          </p>
          <p className="mt-0.5 text-xs text-white/80">{dates}</p>
          {countries.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1">
              {countries.map((code) => (
                <span
                  key={code}
                  className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[9px]"
                >
                  {flagEmoji(code)} {code}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={accentHue === undefined}
          className={`press rounded-full border px-2.5 py-1 font-mono text-[10px] ${
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
            className={`press h-7 w-7 rounded-full border-2 ${
              accentHue === choice.hue ? "border-accent" : "border-transparent"
            }`}
            style={{ backgroundImage: hueGradient(choice.hue) }}
          />
        ))}
      </div>
    </div>
  );
}
