"use client";

import Link from "next/link";
import type { Trip, TripItem } from "@/lib/domain/types";
import { getCountry } from "@/lib/reference/countries";
import { flagEmoji, heroGradient } from "@/lib/theme";
import { daysBetween, formatDay } from "@/lib/rules";

/**
 * The first thing you see. It answers the only two questions you have on
 * opening the app before a trip: how long left, and is anything broken.
 */
export function TripHero({
  trip,
  items,
  critical,
  ready,
}: {
  trip: Trip;
  items: TripItem[];
  critical: number;
  ready: number;
}) {
  const countries = destinationsOf(trip, items);
  const seed = countries.join("") || trip.name;

  const now = new Date();
  const daysToGo = Math.ceil(daysBetween(now, trip.startDate));
  const nights = Math.max(0, Math.round(daysBetween(trip.startDate, trip.endDate)));
  const underway = daysToGo <= 0 && daysBetween(now, trip.endDate) >= 0;

  return (
    <section
      className="animate-rise relative isolate overflow-hidden rounded-3xl text-white shadow-float"
      style={{ backgroundImage: heroGradient(seed) }}
    >
      {/* Contour lines, so the block reads as a place rather than a swatch. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
        preserveAspectRatio="none"
        viewBox="0 0 400 200"
      >
        {[0, 1, 2, 3, 4, 5].map((ring) => (
          <ellipse
            key={ring}
            cx="330"
            cy="40"
            rx={40 + ring * 42}
            ry={28 + ring * 30}
            fill="none"
            stroke="white"
            strokeWidth="1.2"
          />
        ))}
      </svg>

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
              {underway ? "Under way" : daysToGo > 0 ? "Counting down" : "Wrapped"}
            </p>
            <h1 className="mt-1.5 font-display text-[30px] leading-tight font-semibold tracking-tight sm:text-4xl">
              {trip.name}
            </h1>
            <p className="mt-1.5 text-sm text-white/80">
              {formatDay(trip.startDate)} – {formatDay(trip.endDate)}
              {nights > 0 && ` · ${nights} nights`}
            </p>
          </div>

          <Link
            href="/trip"
            className="press shrink-0 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm hover:bg-white/20"
          >
            Edit
          </Link>
        </div>

        {countries.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {countries.map((code) => (
              <li
                key={code}
                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[10px] tracking-wide"
              >
                {flagEmoji(code)} {getCountry(code)?.name ?? code}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center gap-4 border-t border-white/15 pt-4">
          <ReadyRing critical={critical} ready={ready} />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {critical > 0
                ? `${critical} thing${critical === 1 ? "" : "s"} to fix before you fly`
                : "Nothing blocking — you are clear to fly"}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-white/70 tabular">
              {items.length} filed
              {!underway && daysToGo > 0 && ` · ${daysToGo} days to go`}
            </p>
          </div>

          <Link
            href="/checks"
            aria-label="Open checks"
            className="press shrink-0 rounded-xl border border-white/25 bg-white/10 px-3 py-2 font-mono text-[11px] hover:bg-white/20"
          >
            Checks ›
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Share of the checks that pass, as a ring rather than another number. */
function ReadyRing({ critical, ready }: { critical: number; ready: number }) {
  const total = ready + critical;
  const share = total === 0 ? 1 : ready / total;
  const circumference = 2 * Math.PI * 20;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tabular">
        {Math.round(share * 100)}%
      </span>
    </div>
  );
}

function destinationsOf(trip: Trip, items: TripItem[]): string[] {
  const codes = new Set<string>(trip.destinationCountries ?? []);
  for (const item of items) {
    if (item.place?.countryCode) codes.add(item.place.countryCode);
    if (item.arrivalPlace?.countryCode) codes.add(item.arrivalPlace.countryCode);
  }
  codes.delete(trip.homeCountry);
  return [...codes].slice(0, 6);
}
