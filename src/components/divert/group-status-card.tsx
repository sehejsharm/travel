"use client";

import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import { formatEta } from "@/lib/divert/format";
import { useDivert } from "@/lib/divert/use-divert";
import { rejoinGroup } from "@/lib/store/state";

/**
 * The trip screen's handle on the group: the way in to breaking off, and
 * while someone is off, where they are and the quickest way back.
 */
export function GroupStatusCard() {
  const { trip, status, session, plan } = useDivert();
  if (!trip) return null;

  const size = trip.travelers.length;

  if (status === "DIVERTED" && session && plan) {
    const option =
      plan.options.find((candidate) => candidate.type === session.chosen) ?? plan.options[0];
    const who = trip.travelers.find((traveler) => traveler.id === session.travelerId)?.name;

    return (
      <Card className="raised border-accent p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Chip tone="accent">Diverted{who && ` · ${who}`}</Chip>
            <h3 className="mt-2 truncate font-display text-lg font-semibold tracking-tight">
              {plan.spot.name}
            </h3>
            <p className="mt-0.5 text-sm text-ink-soft">
              {option.type === "CATCH_UP" ? "Rejoin at" : "The group joins you at"}{" "}
              {option.meetingPointName}, {formatEta(Math.max(option.userETA, option.groupETA))}
            </p>
          </div>
          <Link
            href="/divert"
            className="press shrink-0 rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            Options ›
          </Link>
        </div>
        <button
          type="button"
          onClick={rejoinGroup}
          className="press mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
        >
          Rejoin group
        </button>
      </Card>
    );
  }

  return (
    <Card className="raised flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {size >= 2 ? `Travelling as ${size}` : "Travelling solo"}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {size >= 2
            ? "Break off for coffee or a photo and get a route back to the others."
            : "Add the rest of the party on the Trip screen and you can break off from them."}
        </p>
      </div>
      {size >= 2 ? (
        <Link
          href="/divert"
          className="press shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
        >
          Divert from group
        </Link>
      ) : (
        <Link
          href="/trip"
          className="press shrink-0 rounded-xl border border-line px-4 py-2.5 text-sm text-ink-soft"
        >
          Add travellers
        </Link>
      )}
    </Card>
  );
}
