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

/**
 * Which trip you are looking at, changeable from anywhere. It also settles
 * the question the sample trip used to leave open: loading it adds a trip
 * alongside yours, and says so before it does anything.
 */
export function TripSwitcher() {
  const { state, trip } = useTripView();
  const [open, setOpen] = useState(false);

  if (!trip) return null;

  const hasSample = state.trips.some((entry) => entry.id === SAMPLE_TRIP_ID);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Switch trip"
        className="press flex min-h-11 max-w-[45vw] items-center gap-2 rounded-control border border-line px-3 py-2"
      >
        <span className="truncate text-footnote text-ink-soft">{trip.name}</span>
        <span aria-hidden="true" className="shrink-0 text-caption-2 text-ink-faint">
          ▾
        </span>
      </button>

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
