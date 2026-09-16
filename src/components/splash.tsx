"use client";

import { useEffect } from "react";
import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";
import { useHydrated } from "@/lib/store/use-store";

/**
 * The cold-start beat. It is server-rendered, so it is on screen in the first
 * paint — before hydration, before the store is read — and comes off as soon
 * as there is something real behind it.
 */
export function Splash() {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const splash = document.getElementById("splash");
    if (splash) splash.dataset.ready = "true";
  }, [hydrated]);

  return (
    <div id="splash" aria-hidden="true">
      <div className="splash-mark flex flex-col items-center gap-3">
        <svg width="56" height="56" viewBox="0 0 64 64">
          <path d={STUB_PATH} fill={BRAND.accent} />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke="var(--bg)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-display text-lg font-semibold tracking-tight">Manifest</span>

        {/*
          A returning user sees the mark and nothing else — they know what this
          is. Someone opening it for the first time gets one line while the
          shell initialises, so the wait does some work. Which one shows is
          decided by the pre-paint script in the layout, not by React: reading
          storage during render would mean a different first paint on the
          server and the client.
        */}
        <span className="splash-intro max-w-[16rem] px-6 text-center font-mono text-[10px] leading-relaxed text-ink-faint">
          Your bookings, filed and checked. On this device, with or without signal.
        </span>
      </div>
    </div>
  );
}
