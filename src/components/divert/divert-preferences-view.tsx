"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { PrimaryButton } from "@/components/form";
import { Card, Chip, ScreenHeader, SectionTitle } from "@/components/ui";
import type { Trip } from "@/lib/domain/types";
import { formatDistance, formatMinutes } from "@/lib/divert/format";
import { distanceM } from "@/lib/divert/geometry";
import { DIVERT_INTERESTS, dwellFor, interestsFor } from "@/lib/divert/interests";
import { findSpots, SPOT_RADIUS_M } from "@/lib/divert/spots";
import type { GroupRoute } from "@/lib/divert/types";
import { startDivert } from "@/lib/store/state";
import { DivertIconGlyph } from "./divert-icon";
import { GroupNowCard } from "./group-now-card";

/**
 * Picking what to break off for. Interests first, then the spots that serve
 * them near where the group is; the nearest is preselected so one tap on the
 * button is enough.
 */
export function DivertPreferencesView({ trip, route }: { trip: Trip; route: GroupRoute }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [travelerId, setTravelerId] = useState<string | undefined>(trip.travelers[0]?.id);

  const interests = interestsFor(picked);
  const categories = [...new Set(interests.map((interest) => interest.category))];
  const anchor =
    route.waypoints[route.atStop ?? Math.max(0, route.nextStop - 1)]?.name;
  const spots = categories.length > 0 ? findSpots(route.position, categories, anchor) : [];
  const spot = spots.find((candidate) => candidate.id === spotId) ?? spots[0];
  const dwell = dwellFor(interests);
  const group = trip.travelers.length >= 2;

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    setSpotId(null);
  }

  function go() {
    if (!spot || !group) return;
    startDivert({
      tripId: trip.id,
      travelerId,
      interestIds: interests.map((interest) => interest.id),
      spot,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow="Divert from group"
        title="Break off for a bit"
        meta="Pick what you are after. Manifest works out where to meet the others again."
        action={
          <Link
            href="/"
            className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            Back
          </Link>
        }
      />

      <GroupNowCard route={route} />

      {!group && (
        <Card className="border-warning/40 p-4">
          <p className="text-sm font-medium">This trip has only one traveller on it.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Diverting needs a group to divert from.{" "}
            <Link href="/trip" className="text-accent-strong underline underline-offset-2">
              Add the others on the Trip screen
            </Link>{" "}
            and come back.
          </p>
        </Card>
      )}

      {trip.travelers.length >= 2 && (
        <section>
          <SectionTitle>Who is breaking off</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {trip.travelers.map((traveler) => {
              const active = traveler.id === travelerId;
              return (
                <button
                  key={traveler.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTravelerId(traveler.id)}
                  className={`press rounded-full border px-3.5 py-1.5 text-sm ${
                    active
                      ? "border-accent bg-accent-soft font-medium text-accent-strong"
                      : "border-line bg-surface text-ink-soft"
                  }`}
                >
                  {traveler.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle trailing={picked.length > 0 ? `about ${formatMinutes(dwell)}` : "pick one or more"}>
          What for
        </SectionTitle>
        <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DIVERT_INTERESTS.map((interest, index) => {
            const active = picked.includes(interest.id);
            return (
              <li key={interest.id} style={{ "--i": index } as CSSProperties}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(interest.id)}
                  className={`press raised flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left ${
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    <DivertIconGlyph icon={interest.icon} />
                  </span>
                  <span className="text-sm font-medium">{interest.title}</span>
                  <span className="text-xs leading-snug text-ink-soft">{interest.blurb}</span>
                  <span className="mt-auto font-mono text-[10px] text-ink-faint tabular">
                    ~{interest.dwellMinutes} min
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {spots.length > 0 && (
        <section>
          <SectionTitle trailing={`within ${formatDistance(SPOT_RADIUS_M)}`}>Nearby</SectionTitle>
          <Card className="divide-y divide-line">
            {spots.map((candidate) => {
              const active = candidate.id === spot?.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSpotId(candidate.id)}
                  className={`press flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                    active ? "bg-accent-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{candidate.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-faint">
                      {candidate.detail ?? candidate.category}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {candidate.synthetic && <Chip tone="warning">stand-in</Chip>}
                    <span
                      className={`font-mono text-[11px] tabular ${
                        active ? "text-accent-strong" : "text-ink-faint"
                      }`}
                    >
                      {formatDistance(distanceM(route.position, candidate.point))}
                    </span>
                  </span>
                </button>
              );
            })}
          </Card>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={go} disabled={!spot || !group}>
          Find rejoin route
        </PrimaryButton>
        <p className="text-center font-mono text-[11px] text-ink-faint">
          {spot
            ? `${formatMinutes(dwell)} at ${spot.name}, then back to the others`
            : "Pick what you are after and a spot appears"}
        </p>
      </div>
    </div>
  );
}
