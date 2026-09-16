"use client";

import { useState, useSyncExternalStore } from "react";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";
import { Sheet } from "./sheet";

const SEEN = "manifest.onboarding.v1";

/** The loop the app is actually built around, in the order it happens. */
const STEPS: { title: string; body: string; art: "add" | "cabinet" | "checks" | "ready" }[] = [
  {
    title: "Send it anything",
    body: "A booking email, a screenshot of a confirmation, a Reel you saved. Paste it, photograph it, or share it straight from another app.",
    art: "add",
  },
  {
    title: "It comes back filed",
    body: "Dates, prices, confirmation numbers and a place on the map — pulled out and sorted into your cabinet, without you typing any of it.",
    art: "cabinet",
  },
  {
    title: "Then it checks the plan",
    body: "A layover too short to make. A museum booked on the day it shuts. A passport that expires before you fly home. You get told before it costs you.",
    art: "checks",
  },
  {
    title: "All of it on this device",
    body: "No account, nothing uploaded, and it works with no signal — which is exactly when you need a booking reference most.",
    art: "ready",
  },
];

function noop() {
  return () => undefined;
}

function alreadySeen(): boolean {
  try {
    return Boolean(localStorage.getItem(SEEN));
  } catch {
    return true;
  }
}

/**
 * Shown once, on a genuine first launch, before the traveller is dropped into
 * an empty trip. Four screens, skippable at every step — the point is to name
 * the Add → Cabinet → Checks loop, not to detain anyone.
 */
export function Onboarding() {
  const seen = useSyncExternalStore(noop, alreadySeen, () => true);
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);

  if (seen || closed) return null;

  function finish() {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      // A blocked store means they see it again; harmless.
    }
    setClosed(true);
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Sheet
      open
      onClose={finish}
      title={`${step + 1} of ${STEPS.length}`}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={finish}
            className="press font-mono text-[11px] text-ink-faint underline"
          >
            skip
          </button>
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="press ml-auto rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
          >
            {last ? "Start my trip" : "Next"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <StepArt kind={current.art} />

        <h3 className="font-display text-xl font-semibold tracking-tight">{current.title}</h3>
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{current.body}</p>

        <ol className="mt-1 flex gap-1.5" aria-label="Progress">
          {STEPS.map((entry, index) => (
            <li
              key={entry.title}
              aria-current={index === step ? "step" : undefined}
              className={`h-1.5 rounded-full transition-all ${
                index === step ? "w-6 bg-accent" : "w-1.5 bg-line-strong"
              }`}
            />
          ))}
        </ol>
      </div>
    </Sheet>
  );
}

/** Small diagrams rather than screenshots, which would go stale immediately. */
function StepArt({ kind }: { kind: "add" | "cabinet" | "checks" | "ready" }) {
  const stroke = {
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-accent-soft">
      <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true">
        {kind === "add" && (
          <>
            <rect x="8" y="6" width="26" height="34" rx="3" {...stroke} />
            <path {...stroke} d="M14 16h14M14 23h14M14 30h8" />
            <circle cx="36" cy="34" r="8" fill="var(--accent)" />
            <path d="M36 30v8M32 34h8" stroke="var(--bg)" strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {kind === "cabinet" && (
          <>
            <rect x="7" y="8" width="34" height="13" rx="2.5" {...stroke} />
            <rect x="7" y="25" width="34" height="13" rx="2.5" {...stroke} />
            <path {...stroke} d="M21 14.5h6M21 31.5h6" />
          </>
        )}
        {kind === "checks" && (
          <>
            <path {...stroke} d="M24 6 39 12v11c0 8.5-6.4 14-15 17-8.6-3-15-8.5-15-17V12z" />
            <path
              d="m18 24 4.5 4.5L31 19"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {kind === "ready" && (
          <g transform="translate(24 24) scale(0.62) translate(-32 -32)">
            <path d={STUB_PATH} fill={BRAND.accent} />
            <path
              d={CHECK_PATH}
              fill="none"
              stroke="var(--accent-soft)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
