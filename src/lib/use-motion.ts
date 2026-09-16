"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Whether the person using this has asked for less motion. Read through an
 * external store so it is correct on the first client render and updates live
 * if they change the setting, without a state-setting effect.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // The server cannot know, and assuming reduced motion means the first
    // paint never animates — which is the safe way round.
    () => true,
  );
}

/**
 * Tweens a number toward its target instead of snapping. Used for the
 * readiness percentage, the countdown and spend totals, so a value that
 * changes reads as having moved rather than having been replaced.
 *
 * Driven by requestAnimationFrame against wall-clock time, so it takes the
 * same duration whatever the frame rate, and stops itself when it arrives.
 */
export function useCountUp(target: number, duration = 700): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const from = useRef(0);
  const frame = useRef<number>(undefined);

  useEffect(() => {
    // Nothing to drive: the hook returns the target directly below.
    if (reduced) return;

    const start = performance.now();
    const origin = from.current;
    const distance = target - origin;

    if (distance === 0) return;

    function step(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      // Matches --ease-out, so a tweened number and a moving element that
      // start together also arrive together.
      const eased = 1 - Math.pow(1 - progress, 3);

      const next = origin + distance * eased;
      setValue(next);

      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        from.current = target;
      }
    }

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      from.current = value;
    };
    // `value` is deliberately not a dependency: including it would restart the
    // tween on every frame it sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);

  return reduced ? target : value;
}
