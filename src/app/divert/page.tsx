"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DivertActiveView } from "@/components/divert/divert-active-view";
import { DivertPreferencesView } from "@/components/divert/divert-preferences-view";
import { useFocusOnChange } from "@/components/divert/use-focus-on-change";
import { EmptyState, ScreenSkeleton } from "@/components/ui";
import { useDivert } from "@/lib/divert/use-divert";
import { rejoinGroup } from "@/lib/store/state";

/**
 * One route, two screens: what to break off for while you are with the
 * group, and how to get back once you are not. Which one shows is the
 * store's answer, so a reload lands on the right one.
 */
export default function DivertScreen() {
  const router = useRouter();
  const { trip, route, hydrated, status, session, plan } = useDivert();
  // Set on the way out, so the preferences screen does not flash up between
  // ending the diversion and the trip screen arriving.
  const [leaving, setLeaving] = useState(false);
  useFocusOnChange(hydrated && !leaving ? status : null);

  function rejoin() {
    setLeaving(true);
    rejoinGroup();
    router.push("/");
  }

  if (!hydrated || leaving) return <ScreenSkeleton variant="list" />;

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
    return (
      <DivertActiveView
        key={session.startedAt}
        trip={trip}
        session={session}
        plan={plan}
        onRejoin={rejoin}
      />
    );
  }

  // Keyed on the trip, so switching trips here starts the picker afresh
  // rather than carrying one trip's traveller and picks into another.
  return <DivertPreferencesView key={trip.id} trip={trip} route={route} />;
}
