"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle } from "@/components/ui";
import { toCalendar } from "@/lib/calendar";
import { encodeTrip } from "@/lib/share";
import { loadSampleTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import { destinationBriefs } from "@/lib/rules";

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MoreScreen() {
  const { trip, items, hydrated } = useTripView();
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmReset, setConfirmReset] = useState(false);

  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    return <EmptyState title="No trip yet" body="Create a trip first and this fills in." />;
  }

  const briefs = destinationBriefs({ trip, items, now: new Date() });

  async function share() {
    try {
      const token = await encodeTrip(trip!, items);
      const url = `${window.location.origin}/share#${token}`;

      if (navigator.share) {
        await navigator.share({ title: trip!.name, url });
        setShareState("idle");
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader eyebrow="More" title={trip.name} meta="Export, share, and what is on the ground." />

      <section>
        <SectionTitle>Take it with you</SectionTitle>
        <Card className="divide-y divide-line">
          <button
            type="button"
            onClick={() =>
              download(
                `${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`,
                toCalendar(trip, items),
                "text/calendar;charset=utf-8",
              )
            }
            className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span>
              <span className="text-sm font-medium">Push to calendar</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Downloads an .ics any calendar app reads
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↓</span>
          </button>

          <button
            type="button"
            onClick={share}
            className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span>
              <span className="text-sm font-medium">Share the plan</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {shareState === "copied"
                  ? "Link copied — prices and confirmations are stripped out"
                  : shareState === "failed"
                    ? "Could not create the link"
                    : "A read-only link, held in the URL itself"}
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↗</span>
          </button>

          <Link href="/recap" className="press flex items-center justify-between gap-3 px-4 py-3.5">
            <span>
              <span className="text-sm font-medium">Trip recap</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Spend, places, and where each item came from
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">→</span>
          </Link>
        </Card>
      </section>

      {briefs.length > 0 && (
        <section>
          <SectionTitle>On the ground</SectionTitle>
          <Card className="divide-y divide-line">
            {briefs.map(({ country, hoursFromHome }) => (
              <div key={country.code} className="px-4 py-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-teal">
                  {country.name}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Emergency {country.emergency} · {country.currency} · plugs Type{" "}
                  {country.plugTypes.join("/")} ·{" "}
                  <span className="tabular">
                    {hoursFromHome > 0 ? "+" : ""}
                    {hoursFromHome}h
                  </span>{" "}
                  from home
                </p>
                <p className="mt-1 text-sm text-ink-soft">{country.tipping}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>This device</SectionTitle>
        <Card className="p-4">
          <p className="text-xs leading-relaxed text-ink-soft">
            Manifest keeps your trip on this device. Nothing is uploaded, there is no account, and
            it works with no signal. Clearing your browser data clears the trip.
          </p>

          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              loadSampleTrip();
              setConfirmReset(false);
            }}
            className={`press mt-3 rounded-xl border px-3.5 py-2 text-xs font-medium ${
              confirmReset
                ? "border-critical text-critical"
                : "border-line text-ink-soft"
            }`}
          >
            {confirmReset ? "Tap again to load the sample trip" : "Load the sample trip"}
          </button>
        </Card>
      </section>
    </div>
  );
}
