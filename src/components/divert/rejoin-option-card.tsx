"use client";

import type { CSSProperties } from "react";
import { Card, Chip } from "@/components/ui";
import { formatDistance, formatEta, formatMinutes, MODE_LABELS, wallClock } from "@/lib/divert/format";
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
}: {
  label: string;
  eta: number;
  distance: number;
  mode: TravelMode;
  at: string;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tracking-tight tabular">
        {formatEta(eta)}
      </dd>
      <dd className="font-mono text-[11px] text-ink-faint tabular">
        {distance < 25 ? "already there" : `${formatDistance(distance)} ${MODE_LABELS[mode]}`} · {at}
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
  const time = (minutes: number) => wallClock(route.clock, route.offset, minutes);
  const together = Math.max(option.userETA, option.groupETA);

  return (
    <Card
      as="article"
      className={`raised overflow-hidden ${chosen ? "border-accent" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={catchUp ? "accent" : "ok"}>{catchUp ? "Rejoin group" : "Group joins you"}</Chip>
          {chosen && <Chip tone="accent">your plan</Chip>}
          {!option.feasible && <Chip tone="warning">does not work in time</Chip>}
        </div>

        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
          {option.meetingPointName}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {catchUp
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
          />
          <Leg
            label="The group"
            eta={option.groupETA}
            distance={option.groupDistanceM}
            mode={option.groupMode}
            at={time(option.groupETA)}
          />
        </dl>

        <p className="mt-3 text-sm leading-relaxed">{option.note}</p>
        <p className="mt-1.5 font-mono text-[11px] text-ink-faint tabular">
          Together around {time(together)}
          {option.waitMinutes > 0 && ` · ${formatMinutes(option.waitMinutes)} waiting`}
          {option.detourMinutes > 0 && ` · group ${formatMinutes(option.detourMinutes)} behind plan`}
        </p>
      </div>

      <DivertMap route={route} spot={spot} option={option} />

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onChoose}
          aria-pressed={chosen}
          className={`press flex-1 rounded-xl px-4 py-2.5 text-sm font-medium ${
            chosen
              ? "border border-accent bg-accent-soft text-accent-strong"
              : "bg-accent text-accent-ink"
          }`}
        >
          {chosen ? "Going with this" : "Go with this"}
        </button>
        <a
          href={openInMapsUrl({ name: option.meetingPointName, point: option.location })}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${option.meetingPointName} in Google Maps`}
          className="press shrink-0 rounded-xl border border-line px-3 py-2.5 font-mono text-[11px] text-ink-soft hover:border-accent hover:text-accent-strong"
        >
          Maps ↗
        </a>
      </div>
    </Card>
  );
}
