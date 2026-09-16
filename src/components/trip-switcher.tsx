"use client";

import Link from "next/link";
import { useState } from "react";
import { loadSampleTrip, selectTrip, SAMPLE_TRIP_ID } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import { countriesOf } from "@/lib/reference/destinations";
import { flagEmoji } from "@/lib/theme";
import { formatDay } from "@/lib/rules";
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
        className="press flex max-w-[45vw] items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5"
      >
        <span className="truncate font-mono text-[11px] text-ink-soft">{trip.name}</span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-ink-faint">
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
                  className={`press flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-faint">
                      {countries.map((country) => flagEmoji(country.code)).join(" ")}
                      {countries.length > 0 && " · "}
                      {entry.datesTbd
                        ? "no dates yet"
                        : `${formatDay(entry.startDate)} – ${formatDay(entry.endDate)}`}
                    </span>
                  </span>
                  {active && (
                    <span className="shrink-0 font-mono text-[10px] text-accent-strong">now</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <Link
            href="/trip/new"
            onClick={() => setOpen(false)}
            className="press rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-ink"
          >
            New trip
          </Link>

          {!hasSample && (
            <button
              type="button"
              onClick={() => {
                loadSampleTrip();
                setOpen(false);
              }}
              className="press rounded-xl border border-line px-4 py-2.5 text-sm text-ink-soft"
            >
              Add the sample trip
            </button>
          )}

          <p className="text-center font-mono text-[10px] leading-relaxed text-ink-faint">
            {hasSample
              ? "The sample trip is already in your list. Delete it from Trip settings when you are done."
              : "The sample is added alongside your own trips. Nothing you have is replaced."}
          </p>
        </div>
      </Sheet>
    </>
  );
}
