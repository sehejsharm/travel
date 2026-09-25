"use client";

import type { CSSProperties } from "react";
import { Card, Chip } from "@/components/ui";
import {
  atPlace,
  formatDistance,
  formatEta,
  formatMinutes,
  inSentence,
  MODE_LABELS,
  NEAR_ENOUGH_M,
  standInSearch,
  wallClock,
} from "@/lib/divert/format";
import type { DivertPlan, RejoinOption } from "@/lib/divert/types";
import type { TravelMode } from "@/lib/geo";
import { openInMapsUrl } from "@/lib/maps";
import { DivertMap } from "./divert-map";

function Leg({
  label,
  eta,
  distance,
  mode,
  at,
  simulated,
}: {
  label: string;
  eta: number;
  distance: number;
  mode: TravelMode;
  at: string;
  simulated: boolean;
}) {
  const where =
    distance < NEAR_ENOUGH_M
      ? eta <= 0
        ? "already there"
        : "waiting nearby"
      : `${formatDistance(distance)} ${MODE_LABELS[mode]}`;

  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tracking-tight tabular">
        {/* A simulated clock is not now, so it gets a time rather than a countdown. */}
        {simulated ? `at ${at}` : formatEta(eta)}
      </dd>
      <dd className="font-mono text-[11px] text-ink-faint tabular">
        {where}
        {!simulated && ` · ${at}`}
      </dd>
    </div>
  );
}

/** One of the two ways back together: who goes where, when, and what it costs. */
export function RejoinOptionCard({
  option,
  plan,
  chosen,
  onChoose,
  index,
}: {
  option: RejoinOption;
  plan: DivertPlan;
  chosen: boolean;
  onChoose: () => void;
  index: number;
}) {
  const { route, spot } = plan;
  const catchUp = option.type === "CATCH_UP";
  const missed = catchUp && !option.feasible;
  // Past rather than future: the group had already left before now.
  const gone = missed && option.groupLeaveMin !== undefined && option.groupLeaveMin <= 0;
  const standIn = !catchUp && spot.synthetic;
  const time = (minutes: number) => wallClock(route.clock, route.offset, minutes);
  const together = Math.max(option.userETA, option.groupETA);

  // A stand-in is a made-up point, so Maps gets a search for the kind of
  // place rather than a pin on coordinates nobody checked.
  const place = inSentence(option.meetingPointName, option.meetingPointGenerated);
  const mapsUrl = standIn
    ? openInMapsUrl({ name: standInSearch(option.meetingPointName) })
    : openInMapsUrl({ name: option.meetingPointName, point: option.location });
  // The button's name follows the card's own wording, so a screen reader is
  // never promised a rejoin the card says will not happen.
  const choice = gone
    ? `head to ${place}, where the group was`
    : missed
      ? `try for ${place}, though the group will have left`
      : catchUp
        ? `rejoin ${atPlace(option.meetingPointName, option.meetingPointGenerated)}`
        : `the group joins you at ${place}`;

  return (
    <Card
      as="article"
      className={`raised overflow-hidden ${chosen ? "border-accent" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={catchUp ? "accent" : "ok"}>{catchUp ? "Rejoin point" : "Group joins you"}</Chip>
          {chosen && <Chip tone="accent">your plan</Chip>}
          {!option.feasible && <Chip tone="warning">does not work in time</Chip>}
          {standIn && <Chip tone="warning">stand-in</Chip>}
        </div>

        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
          {option.meetingPointName}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {gone
            ? "The group's last stop, though they have already moved on."
            : missed
              ? "The group's last stop, though they will have moved on before you get there."
              : catchUp
              ? "The nearest point on the group's route you can get to before they move on."
              : "The group comes to you instead, once they are done where they are."}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Leg
            label="You"
            eta={option.userETA}
            distance={option.userDistanceM}
            mode={option.userMode}
            at={time(option.userETA)}
            simulated={route.simulated}
          />
          {gone ? (
            <div className="rounded-xl bg-surface-2 px-3 py-2.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                The group left
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold tracking-tight tabular">
                at {time(option.groupLeaveMin!)}
              </dd>
            </div>
          ) : (
            <Leg
              label={missed ? "The group, before it leaves" : "The group"}
              eta={option.groupETA}
              distance={option.groupDistanceM}
              mode={option.groupMode}
              at={time(option.groupETA)}
              simulated={route.simulated}
            />
          )}
        </dl>

        <p className="mt-3 text-sm leading-relaxed">{option.note}</p>
        <p className="mt-1.5 font-mono text-[11px] text-ink-faint tabular">
          {missed && option.groupLeaveMin !== undefined ? (
            <>
              You arrive {time(option.userETA)} ·{" "}
              {option.groupLeaveMin <= 0
                ? `the group left at ${time(option.groupLeaveMin)}`
                : `the group leaves ${time(option.groupLeaveMin)}`}
            </>
          ) : (
            <>
              Together around {time(together)}
              {option.waitMinutes > 0 && ` · ${formatMinutes(option.waitMinutes)} waiting`}
              {option.detourMinutes > 0 &&
                ` · group ${formatMinutes(option.detourMinutes)} behind plan`}
            </>
          )}
        </p>
      </div>

      <DivertMap route={route} spot={spot} option={option} />

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onChoose}
          aria-pressed={chosen}
          aria-label={`Go with this: ${choice}`}
          className={`press flex-1 rounded-xl px-4 py-2.5 text-sm font-medium ${
            chosen
              ? "border border-accent bg-accent-soft text-accent-strong"
              : "bg-accent text-accent-ink"
          }`}
        >
          Go with this
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={
            standIn
              ? `Search Google Maps for a ${standInSearch(option.meetingPointName)}`
              : `Open ${option.meetingPointName} in Google Maps`
          }
          className="press shrink-0 rounded-xl border border-line px-3 py-2.5 font-mono text-[11px] text-ink-soft hover:border-accent hover:text-accent-strong"
        >
          Maps ↗
        </a>
      </div>
    </Card>
  );
}
