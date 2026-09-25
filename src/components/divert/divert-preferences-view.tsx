"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { PrimaryButton } from "@/components/form";
import { Card, Chip, ScreenHeader, SectionTitle } from "@/components/ui";
import type { GeoPoint, Trip } from "@/lib/domain/types";
import { formatDistance, formatMinutes } from "@/lib/divert/format";
import { distanceM } from "@/lib/divert/geometry";
import { categoriesFor, DIVERT_INTERESTS, dwellFor, interestsFor } from "@/lib/divert/interests";
import { respot, travellerWhereabouts } from "@/lib/divert/rejoin";
import { anchorName } from "@/lib/divert/route";
import { findSpots, SPOT_RADIUS_M, withoutFreshStandIn } from "@/lib/divert/spots";
import type { DivertSession, DivertSpot, GroupRoute } from "@/lib/divert/types";
import { startDivert, updateDivert } from "@/lib/store/state";
import { DivertIconGlyph } from "./divert-icon";
import { GroupNowCard } from "./group-now-card";

interface Origin {
  position: GeoPoint;
  anchor?: string;
}

/**
 * Picking what to break off for. Interests first, then the spots that serve
 * them near where the group is; the nearest is preselected so one tap on the
 * button is enough. Given a running session, the same screen changes it
 * instead, measuring from wherever the traveller is now.
 */
export function DivertPreferencesView({
  trip,
  route,
  session,
  onDone,
}: {
  trip: Trip;
  route: GroupRoute;
  session?: DivertSession;
  onDone?: () => void;
}) {
  const editing = session !== undefined;

  // Where "nearby" is measured from. Frozen when the picks change rather than
  // on every tick, so a live group walking on does not reshuffle the list
  // under a finger or quietly swap the spot that was tapped.
  const originNow = (): Origin =>
    session ? travellerWhereabouts(route, session) : { position: route.position, anchor: anchorName(route) };

  const [picked, setPicked] = useState<string[]>(session?.interestIds ?? []);
  const [chosen, setChosen] = useState<DivertSpot | null>(session?.spot ?? null);
  const [travelerId, setTravelerId] = useState<string | undefined>(session?.travelerId);
  const [origin, setOrigin] = useState<Origin>(originNow);

  const interests = interestsFor(picked);
  const categories = categoriesFor(interests);
  const found = withoutFreshStandIn(
    categories.length > 0 ? findSpots(origin.position, categories, origin.anchor) : [],
    chosen,
  );
  // A spot already chosen stays on the list while its kind is still wanted,
  // even if it is not among the nearest from here, and always under the name
  // it was saved with.
  const keepChosen =
    chosen && categories.includes(chosen.category) && !found.some((spot) => spot.id === chosen.id);
  const spots = keepChosen
    ? [chosen, ...found]
    : found.map((candidate) => (chosen && candidate.id === chosen.id ? chosen : candidate));
  const spot =
    (chosen && categories.includes(chosen.category) ? chosen : undefined) ?? spots[0];

  const dwell = dwellFor(interests);
  const group = trip.travelers.length >= 2;
  const selected = trip.travelers.some((traveler) => traveler.id === travelerId)
    ? travelerId
    : trip.travelers[0]?.id;
  const ready = Boolean(spot) && group && !route.demo;

  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((entry) => entry !== id) : [...picked, id];
    const nextCategories = categoriesFor(interestsFor(next));
    const nextOrigin = originNow();

    setPicked(next);
    setOrigin(nextOrigin);
    // A spot kept from before must still be the kind wanted, and still near.
    if (
      chosen &&
      (!nextCategories.includes(chosen.category) ||
        distanceM(nextOrigin.position, chosen.point) > SPOT_RADIUS_M)
    ) {
      setChosen(null);
    }
  }

  function go() {
    if (!spot || !ready) return;
    const interestIds = interests.map((interest) => interest.id);

    if (session) {
      const moved = spot.id !== session.spot.id;
      updateDivert({
        travelerId: selected,
        interestIds,
        ...(moved ? respot(route, session, spot) : {}),
      });
      onDone?.();
      return;
    }

    startDivert({
      tripId: trip.id,
      travelerId: selected,
      interestIds,
      spot,
      from: route.position,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow={editing ? "Diverted" : "Divert from group"}
        title={editing ? "Change your plans" : "Break off for a bit"}
        meta={
          editing
            ? "Pick again. The way back is worked out from wherever you are now."
            : "Pick what you are after. Manifest works out where to meet the others again."
        }
        action={
          editing ? (
            <button
              type="button"
              onClick={onDone}
              className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
            >
              Back
            </button>
          ) : (
            <Link
              href="/"
              className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
            >
              Back
            </Link>
          )
        }
      />

      <GroupNowCard route={route} />

      {!group && (
        <Card className="p-4">
          <p className="text-sm font-medium">Diverting needs at least two people on the trip.</p>
          <p className="mt-1 text-sm text-ink-soft">
            There is no group to break off from yet.{" "}
            <Link href="/trip" className="text-accent-strong underline underline-offset-2">
              Add the others in Trip settings
            </Link>{" "}
            and come back.
          </p>
        </Card>
      )}

      {group && route.demo && (
        <Card className="p-4">
          <p className="text-sm font-medium">This is the sample walk, not your day.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Your timeline has no timed, placed stops yet, so there is no route to meet the group
            on. Look around here, then put times and places on your timeline to break off for real.
          </p>
        </Card>
      )}

      {group && (
        <section>
          <SectionTitle>Who is breaking off</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {trip.travelers.map((traveler, index) => {
              const active = traveler.id === selected;
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
                  {traveler.name.trim() || `Traveller ${index + 1}`}
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
          <SectionTitle trailing={`within ${formatDistance(SPOT_RADIUS_M)}`}>
            {route.demo ? "Sample places" : "Nearby"}
          </SectionTitle>
          <Card className="divide-y divide-line">
            {spots.map((candidate) => {
              const active = candidate.id === spot?.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChosen(candidate)}
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
                    {route.demo && !candidate.synthetic && <Chip tone="warning">sample</Chip>}
                    <span
                      className={`font-mono text-[11px] tabular ${
                        active ? "text-accent-strong" : "text-ink-faint"
                      }`}
                    >
                      {formatDistance(distanceM(origin.position, candidate.point))}
                    </span>
                  </span>
                </button>
              );
            })}
          </Card>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={go} disabled={!ready}>
          {editing ? "Update rejoin route" : "Find rejoin route"}
        </PrimaryButton>
        <p className="text-center font-mono text-[11px] text-ink-faint">
          {route.demo
            ? "Sample only: put timed, placed stops on your timeline to break off for real"
            : spot
              ? `${editing ? "" : "Starts your diversion: "}${formatMinutes(dwell)} at ${spot.name}, then back to the others`
              : "Pick what you are after and a spot appears"}
        </p>
      </div>
    </div>
  );
}
