"use client";

import { useState } from "react";
import { GhostButton, PrimaryButton } from "@/components/form";
import { Chip, ScreenHeader, SectionTitle } from "@/components/ui";
import type { Trip } from "@/lib/domain/types";
import { divertedName } from "@/lib/divert";
import { formatDistance, formatMinutes, wallClock } from "@/lib/divert/format";
import { distanceM } from "@/lib/divert/geometry";
import { categoriesFor } from "@/lib/divert/interests";
import { respot, travellerPosition } from "@/lib/divert/rejoin";
import { findSpots } from "@/lib/divert/spots";
import type { DivertPlan, DivertSession } from "@/lib/divert/types";
import { chooseRejoin, updateDivert } from "@/lib/store/state";
import { DivertPreferencesView } from "./divert-preferences-view";
import { GroupNowCard } from "./group-now-card";
import { RejoinOptionCard } from "./rejoin-option-card";
import { useFocusOnChange } from "./use-focus-on-change";

/**
 * Off on your own: the two ways back together, side by side, and the button
 * that ends it. Everything recomputes as the clock moves, so on a live day an
 * ETA left on screen keeps counting down. Changing plans edits this diversion
 * in place rather than ending it.
 */
export function DivertActiveView({
  trip,
  session,
  plan,
  onRejoin,
}: {
  trip: Trip;
  session: DivertSession;
  plan: DivertPlan;
  onRejoin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useFocusOnChange(editing ? "edit" : "active");

  const { route, spot, interests, dwellMinutes, options } = plan;

  if (editing) {
    return (
      <DivertPreferencesView
        trip={trip}
        route={route}
        session={session}
        onDone={() => setEditing(false)}
      />
    );
  }

  const who = divertedName(trip.travelers, session);
  const here = travellerPosition(route, session);
  const alternatives = findSpots(here, categoriesFor(interests), spot.name).filter(
    (candidate) => candidate.id !== spot.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow={who ? `Diverted · ${who}` : "Diverted"}
        title={spot.name}
        meta={
          <>
            {interests.map((interest) => interest.title).join(" + ")} · about{" "}
            {formatMinutes(dwellMinutes)}
            {spot.detail && ` · ${spot.detail}`}
          </>
        }
        action={
          // "Since" is a real time only against a real clock.
          !route.simulated && (
            <Chip tone="accent">since {wallClock(new Date(session.startedAt), route.offset)}</Chip>
          )
        }
      />

      <GroupNowCard route={route} />

      <section>
        <SectionTitle trailing="two ways back">Meet up</SectionTitle>
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {options.map((option, index) => (
            <RejoinOptionCard
              key={option.type}
              option={option}
              plan={plan}
              chosen={session.chosen === option.type}
              onChoose={() => chooseRejoin(option.type)}
              index={index}
            />
          ))}
        </div>
      </section>

      {alternatives.length > 0 && (
        <section>
          <SectionTitle>Somewhere else instead</SectionTitle>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {alternatives.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => updateDivert(respot(route, session, candidate))}
                className="press shrink-0 rounded-xl border border-line bg-surface px-3.5 py-2 text-left"
              >
                <span className="block text-sm font-medium">{candidate.name}</span>
                <span className="block font-mono text-[10px] text-ink-faint tabular">
                  {formatDistance(distanceM(here, candidate.point))}
                  {candidate.synthetic && " · stand-in"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onRejoin}>Rejoin group</PrimaryButton>
        <GhostButton onClick={() => setEditing(true)} className="w-full">
          Change what I am after
        </GhostButton>
      </div>
    </div>
  );
}
