"use client";

import { useEffect, useMemo, useState } from "react";
import { useTripView, type TripView } from "../store/use-store";
import { activeDivert, groupStatus } from "./index";
import { buildPlan } from "./rejoin";
import { routeForGroup } from "./route";
import type { DivertPlan, DivertSession, GroupRoute, UserGroupStatus } from "./types";

export interface DivertView extends TripView {
  status: UserGroupStatus;
  session?: DivertSession;
  /** The group's day, whether or not anyone has broken off from it. */
  route?: GroupRoute;
  /** Both ways back, once someone has. */
  plan?: DivertPlan;
  /** The moment the route and plan are relative to. */
  now: Date;
}

/** Ticks on the half minute, so a live ETA left on screen counts down. */
const TICK_MS = 30_000;

/**
 * The trip view plus where the group is and, if someone has diverted, how
 * they get back together. The clock is state rather than read each render,
 * so one render agrees with itself about what time it is. A running
 * diversion anchors the route to the day it began in.
 */
export function useDivert(): DivertView {
  const view = useTripView();
  const { trip, items, state } = view;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const session = trip ? activeDivert(state, trip.id, now) : undefined;
  const since = session ? Date.parse(session.startedAt) : undefined;
  const plannedDay = session?.day;

  const route = useMemo(
    () =>
      trip
        ? routeForGroup(items, now, since === undefined ? undefined : new Date(since), plannedDay)
        : undefined,
    [trip, items, now, since, plannedDay],
  );
  const plan = useMemo(
    () => (route && session ? buildPlan(route, session) : undefined),
    [route, session],
  );

  return {
    ...view,
    status: trip ? groupStatus(state, trip.id, now) : "IN_GROUP",
    session,
    route,
    plan,
    now,
  };
}
