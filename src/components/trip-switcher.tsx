"use client";

import Link from "next/link";
import { useState } from "react";
import { loadSampleTrip, selectTrip, SAMPLE_TRIP_ID } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import { countriesOf } from "@/lib/reference/destinations";
import { flagEmoji } from "@/lib/theme";
import { formatDay } from "@/lib/rules";
import { SecondaryButton } from "./form";
import { PRIMARY_BUTTON_CLASSES } from "./styles";
import { Sheet } from "./sheet";

const chevron = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Which trip you are looking at, changeable from anywhere. It also settles
 * the question the sample trip used to leave open: loading it adds a trip
 * alongside yours, and says so before it does anything. Compact, for the
 * folded sidebar, it is an icon button with the trip's name as its title.
 */
export function TripSwitcher({ compact = false }: { compact?: boolean }) {
  const { state, trip } = useTripView();
  const [open, setOpen] = useState(false);

  if (!trip) return null;

  const hasSample = state.trips.some((entry) => entry.id === SAMPLE_TRIP_ID);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Switch trip"
          title={trip.name}
          className="press flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink-soft hover:bg-surface-2 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path {...chevron} d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Switch trip"
          className="press flex min-h-11 max-w-[45vw] items-center gap-2 rounded-control border border-line px-3 py-2"
        >
          <span className="truncate text-subheadline text-ink">{trip.name}</span>
          {/* The only sign the pill opens a list, so ink-soft (3:1 and up), not faint. */}
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="shrink-0 text-ink-soft">
            <path {...chevron} d="m7 9.5 5 5 5-5" />
          </svg>
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Your trips">
        <ul className="flex flex-col gap-2">
          {state.trips.map((entry) => {
            const countries = countriesOf(entry.destinationCountries ?? []);
            const active = entry.id === trip.id;

            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectTrip(entry.id);
                    setOpen(false);
                  }}
                  className={`press flex min-h-11 w-full items-center gap-3 rounded-control border p-3 text-left ${
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline">{entry.name}</span>
                    <span className="mt-1 block truncate text-footnote text-ink-soft tabular">
                      {countries.map((country) => flagEmoji(country.code)).join(" ")}
                      {countries.length > 0 && " · "}
                      {entry.datesTbd
                        ? "no dates yet"
                        : `${formatDay(entry.startDate)} – ${formatDay(entry.endDate)}`}
                    </span>
                  </span>
                  {active && (
                    <span className="shrink-0 text-caption text-accent-strong">now</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <Link href="/trip/new" onClick={() => setOpen(false)} className={PRIMARY_BUTTON_CLASSES}>
            New trip
          </Link>

          {!hasSample && (
            <SecondaryButton
              type="button"
              onClick={() => {
                loadSampleTrip();
                setOpen(false);
              }}
            >
              Add the sample trip
            </SecondaryButton>
          )}

          <p className="text-center text-caption text-ink-soft">
            {hasSample
              ? "The sample trip is already in your list. Delete it from Trip settings when you are done."
              : "The sample is added alongside your own trips. Nothing you have is replaced."}
          </p>
        </div>
      </Sheet>
    </>
  );
}
