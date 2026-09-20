"use client";

import Link from "next/link";
import { DivertActiveView } from "@/components/divert/divert-active-view";
import { DivertPreferencesView } from "@/components/divert/divert-preferences-view";
import { EmptyState, ScreenSkeleton } from "@/components/ui";
import { useDivert } from "@/lib/divert/use-divert";

/**
 * One route, two screens: what to break off for while you are with the
 * group, and how to get back once you are not. Which one shows is the
 * store's answer, so a reload lands on the right one.
 */
export default function DivertScreen() {
  const { trip, route, hydrated, status, session, plan } = useDivert();

  if (!hydrated) return <ScreenSkeleton variant="list" />;

  if (!trip || !route) {
    return (
      <EmptyState
        title="No trip yet"
        body="Start a trip, and once it has more than one traveller on it you can break off from the others."
        action={
          <Link
            href="/"
            className="press mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Start a trip
          </Link>
        }
      />
    );
  }

  if (status === "DIVERTED" && session && plan) {
    return <DivertActiveView trip={trip} session={session} plan={plan} />;
  }

  return <DivertPreferencesView trip={trip} route={route} />;
}
