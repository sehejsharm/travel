"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-motion";

/**
 * A short burst from wherever the button was. Deliberately hand-rolled rather
 * than pulling in a confetti library: this is one moment in the app, and an
 * offline-first PWA should not carry a dependency for it.
 */
const SPARKS = 14;

export function Celebrate({ at, onDone }: { at?: { x: number; y: number }; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: SPARKS }, (_, index) => {
      const angle = (index / SPARKS) * Math.PI * 2;
      const distance = 60 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 20,
        hue: [18, 96, 198, 268][index % 4],
        size: 5 + Math.random() * 5,
      };
    }),
  );

  useEffect(() => {
    // Cleared either way, so the overlay can never outlive the moment.
    const timer = setTimeout(onDone, reduced ? 0 : 750);
    return () => clearTimeout(timer);
  }, [onDone, reduced]);

  if (!at || reduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="animate-spark absolute rounded-full"
          style={
            {
              left: at.x,
              top: at.y,
              width: piece.size,
              height: piece.size,
              background: `hsl(${piece.hue} 62% 55%)`,
              "--dx": `${piece.dx}px`,
              "--dy": `${piece.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
