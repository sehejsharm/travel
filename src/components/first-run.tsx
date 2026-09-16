"use client";

import Link from "next/link";
import { useState } from "react";
import { loadSampleTrip } from "@/lib/store/state";
import { heroGradient } from "@/lib/theme";
import { Card } from "./ui";

const BEATS: [string, string][] = [
  ["Send it anything", "A booking email, a screenshot, a Reel. It comes back filed with dates, prices and a place."],
  ["It checks the plan", "Layovers too short, a museum booked on the day it shuts, a passport that expires mid-trip."],
  ["It works with no signal", "Everything lives on this device. No account, nothing uploaded."],
];

/**
 * The first thing anyone ever sees. It never shows an empty dashboard: one
 * call to action, three lines on what the app is for, and a way to look
 * around before committing anything.
 */
export function FirstRun() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-5 py-2">
      <section
        className="animate-rise relative isolate overflow-hidden rounded-3xl p-6 text-white shadow-float sm:p-8"
        style={{ backgroundImage: heroGradient("manifest") }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
          preserveAspectRatio="none"
          viewBox="0 0 400 220"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((ring) => (
            <ellipse
              key={ring}
              cx="340"
              cy="30"
              rx={36 + ring * 44}
              ry={26 + ring * 32}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
            />
          ))}
        </svg>

        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Manifest</p>
          <h1 className="mt-2 font-display text-[30px] leading-tight font-semibold tracking-tight sm:text-4xl">
            Everything about your trip, in one file.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Manifest files your bookings automatically and catches the admin that ruins trips —
            privately, on this device, with or without signal.
          </p>

          <Link
            href="/trip/new"
            className="press mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-card"
          >
            Create your first trip
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <Card className="divide-y divide-line">
        {BEATS.map(([title, body], index) => (
          <div key={title} className="flex gap-3 p-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] text-accent-strong">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          </div>
        ))}
      </Card>

      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          loadSampleTrip();
        }}
        className="press mx-auto font-mono text-[11px] text-accent-strong underline disabled:opacity-50"
      >
        {loading ? "Loading…" : "or look around a sample trip first"}
      </button>
    </div>
  );
}
