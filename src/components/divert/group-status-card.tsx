"use client";

import Link from "next/link";
import { PrimaryButton } from "@/components/form";
import { Card, Chip } from "@/components/ui";
import { divertedName } from "@/lib/divert";
import { formatEta, wallClock } from "@/lib/divert/format";
import { DEMO_GROUP } from "@/lib/divert/mock";
import { quickestRejoin } from "@/lib/divert/rejoin";
import { useDivert } from "@/lib/divert/use-divert";
import { rejoinGroup } from "@/lib/store/state";

/**
 * The trip screen's handle on the group: the way in to breaking off, and
 * while someone is off, where they are and the best way back. Says nothing
 * on a trip without a group, so it never nudges a solo traveller to fill in
 * a party they do not have.
 */
export function GroupStatusCard() {
  const { trip, status, session, plan } = useDivert();
  if (!trip) return null;

  if (status === "DIVERTED" && session && plan) {
    const { route } = plan;
    const option =
      plan.options.find((candidate) => candidate.type === session.chosen) ??
      quickestRejoin(plan.options);
    const who = divertedName(trip.travelers, session);
    const together = Math.max(option.userETA, option.groupETA);
    const standIn = option.type === "GROUP_DETOUR" && plan.spot.synthetic;

    return (
      <Card className="raised border-accent p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="accent">Diverted{who && ` · ${who}`}</Chip>
              {!option.feasible && <Chip tone="warning">does not work in time</Chip>}
              {standIn && <Chip tone="warning">stand-in</Chip>}
            </div>
            <h3 className="mt-2 truncate font-display text-lg font-semibold tracking-tight">
              {plan.spot.name}
            </h3>
            <p className="mt-0.5 text-sm text-ink-soft">
              {option.type === "CATCH_UP" ? "Rejoin at" : "The group joins you at"}{" "}
              {option.meetingPointName},{" "}
              {route.simulated
                ? `at ${wallClock(route.clock, route.offset, together)} (simulated)`
                : formatEta(together)}
            </p>
            {route.demo && (
              <p className="mt-1 font-mono text-[11px] text-ink-faint">
                {DEMO_GROUP}: your timeline has no timed, placed stops to plan around.
              </p>
            )}
          </div>
          <Link
            href="/divert"
            className="press shrink-0 rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            Options ›
          </Link>
        </div>
        <PrimaryButton onClick={rejoinGroup} className="mt-3">
          Rejoin group
        </PrimaryButton>
      </Card>
    );
  }

  if (trip.travelers.length < 2) return null;

  return (
    <Card className="raised flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Travelling as {trip.travelers.length}</p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Break off for coffee or a photo and get a route back to the others.
        </p>
      </div>
      <Link
        href="/divert"
        className="press shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
      >
        Divert from group
      </Link>
    </Card>
  );
}
