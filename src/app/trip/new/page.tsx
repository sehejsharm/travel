"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TripForm } from "@/components/trip-form";
import { Card, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { duplicateTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";

export default function NewTripScreen() {
  const router = useRouter();
  const { state, hydrated } = useTripView();

  if (!hydrated) return <ScreenSkeleton />;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow="New trip"
        title="Where next?"
        meta="Where, when and who. Everything else can wait."
        action={
          state.trips.length > 0 ? (
            <Link
              href="/"
              className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
            >
              Cancel
            </Link>
          ) : undefined
        }
      />

      <Card className="p-5">
        <TripForm onDone={() => router.push("/")} submitLabel="Create trip" />
      </Card>

      {state.trips.length > 0 && (
        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            Or start from one you have
          </p>
          <Card className="divide-y divide-line">
            {state.trips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => {
                  const id = duplicateTrip(trip.id, `${trip.name} again`);
                  if (id) router.push("/trip");
                }}
                className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    Another trip like {trip.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                    Keeps who is going and what you are into · clears dates, bookings and checks
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-ink-faint">
                  ›
                </span>
              </button>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
