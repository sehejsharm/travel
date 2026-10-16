"use client";

import Link from "next/link";
import { useState } from "react";
import { loadSampleTrip } from "@/lib/store/state";
import { heroGradient } from "@/lib/theme";
import { BorderlessButton } from "./form";
import { PRIMARY_BUTTON_CLASSES } from "./styles";
import { Card } from "./ui";

const BEATS: [string, string][] = [
  ["Send it anything", "A booking email, a screenshot, a Reel. It comes back filed with dates, prices and a place."],
  ["It checks the plan", "Layovers too short, a museum booked on the day it shuts, a passport that expires mid-trip."],
  ["It works with no signal", "Your trips live on this device, with no account. Our server reads what you send it and keeps none of it."],
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
        className="animate-rise relative isolate overflow-hidden rounded-container p-6 text-white shadow-float sm:p-8"
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
          <p className="text-footnote font-medium text-white/80">Manifest</p>
          <h1 className="mt-2 text-title-1 sm:text-display">
            Everything about your trip, in one file.
          </h1>
          <p className="mt-3 max-w-md text-subheadline text-white/80">
            Manifest files your bookings automatically and catches the admin that ruins trips.
            Your trip stays on this device, with or without signal.
          </p>

          <Link href="/trip/new" className={`${PRIMARY_BUTTON_CLASSES} mt-5 sm:max-w-xs`}>
            Create your first trip
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <Card className="divide-y divide-line">
        {BEATS.map(([title, body], index) => (
          <div key={title} className="flex gap-3 p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-footnote font-medium text-accent-strong tabular">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-headline">{title}</p>
              <p className="mt-1 text-subheadline text-ink-soft">{body}</p>
            </div>
          </div>
        ))}
      </Card>

      <BorderlessButton
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          loadSampleTrip();
        }}
        className="mx-auto"
      >
        {loading ? "Loading…" : "or look around a sample trip first"}
      </BorderlessButton>
    </div>
  );
}
