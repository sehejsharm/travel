"use client";

import { useRouter } from "next/navigation";
import { GhostButton, PrimaryButton } from "@/components/form";
import { Chip, ScreenHeader, SectionTitle } from "@/components/ui";
import type { Trip } from "@/lib/domain/types";
import { formatDistance, formatMinutes, wallClock } from "@/lib/divert/format";
import { distanceM } from "@/lib/divert/geometry";
import { findSpots } from "@/lib/divert/spots";
import type { DivertPlan, DivertSession } from "@/lib/divert/types";
import { chooseRejoin, rejoinGroup, updateDivert } from "@/lib/store/state";
import { GroupNowCard } from "./group-now-card";
import { RejoinOptionCard } from "./rejoin-option-card";

/**
 * Off on your own: the two ways back together, side by side, and the button
 * that ends it. Everything recomputes as the clock moves, so an ETA left on
 * screen keeps counting down.
 */
export function DivertActiveView({
  trip,
  session,
  plan,
}: {
  trip: Trip;
  session: DivertSession;
  plan: DivertPlan;
}) {
  const router = useRouter();
  const { route, spot, interests, dwellMinutes, options } = plan;

  const who = trip.travelers.find((traveler) => traveler.id === session.travelerId)?.name;
  const since = wallClock(new Date(session.startedAt), route.offset);

  const categories = [...new Set(interests.map((interest) => interest.category))];
  const anchor = route.waypoints[route.atStop ?? Math.max(0, route.nextStop - 1)]?.name;
  const alternatives = findSpots(route.position, categories, anchor).filter(
    (candidate) => candidate.id !== spot.id,
  );

  function done() {
    rejoinGroup();
    router.push("/");
  }

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
        action={!route.simulated && <Chip tone="accent">since {since}</Chip>}
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
                onClick={() => updateDivert({ spot: candidate, chosen: undefined })}
                className="press shrink-0 rounded-xl border border-line bg-surface px-3.5 py-2 text-left"
              >
                <span className="block text-sm font-medium">{candidate.name}</span>
                <span className="block font-mono text-[10px] text-ink-faint tabular">
                  {formatDistance(distanceM(route.position, candidate.point))}
                  {candidate.synthetic && " · stand-in"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={done}>Rejoin group</PrimaryButton>
        <GhostButton onClick={rejoinGroup} className="w-full">
          Change what I am after
        </GhostButton>
      </div>
    </div>
  );
}
