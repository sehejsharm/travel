"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GhostButton } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { TravelerEditor } from "@/components/traveler-editor";
import { TripForm } from "@/components/trip-form";
import { Card, Chip, ScreenHeader, ScreenSkeleton, SectionTitle } from "@/components/ui";
import type { Traveler } from "@/lib/domain/types";
import { deleteTrip, selectTrip, tripItems } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import { formatDay } from "@/lib/rules";

export default function TripSettings() {
  const router = useRouter();
  const { state, trip, hydrated } = useTripView();
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<Traveler | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    router.replace("/");
    return <ScreenSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow="Trip settings"
        title={trip.name}
        meta={`${formatDay(trip.startDate)} – ${formatDay(trip.endDate)}`}
      />

      {state.trips.length > 1 && (
        <section>
          <SectionTitle>Your trips</SectionTitle>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {state.trips.map((candidate) => {
              const active = candidate.id === trip.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectTrip(candidate.id)}
                  className={`press shrink-0 rounded-xl border px-3.5 py-2 text-left ${
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  }`}
                >
                  <span className="block text-sm font-medium">{candidate.name}</span>
                  <span className="block font-mono text-[10px] text-ink-faint tabular">
                    {candidate.startDate}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Details</SectionTitle>
        <Card className="p-5">
          <TripForm trip={trip} onDone={() => router.push("/")} submitLabel="Save changes" />
        </Card>
      </section>

      <section>
        <SectionTitle
          trailing={
            <button
              type="button"
              onClick={() => {
                setEditingTraveler(null);
                setTravelerOpen(true);
              }}
              className="press text-accent-strong underline"
            >
              add
            </button>
          }
        >
          Travellers
        </SectionTitle>

        {trip.travelers.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-ink-soft">
              Add a traveller with their passport details and the visa, passport validity and
              insurance checks start running.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {trip.travelers.map((traveler) => (
              <button
                key={traveler.id}
                type="button"
                onClick={() => {
                  setEditingTraveler(traveler);
                  setTravelerOpen(true);
                }}
                className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{traveler.name}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                    {traveler.passportCountry} passport
                    {traveler.passportExpiry
                      ? ` · expires ${formatDay(traveler.passportExpiry)}`
                      : " · no expiry set"}
                  </span>
                </span>
                {!traveler.passportExpiry && <Chip tone="warning">incomplete</Chip>}
              </button>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Manage</SectionTitle>
        <Card className="flex flex-col gap-3 p-5">
          <GhostButton onClick={() => setNewTripOpen(true)}>Start another trip</GhostButton>

          <GhostButton
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              deleteTrip(trip.id);
              router.push("/");
            }}
            className={confirmDelete ? "border-critical text-critical" : ""}
          >
            {confirmDelete
              ? `Tap again to delete "${trip.name}" and its ${tripItems(state, trip.id).length} items`
              : "Delete this trip"}
          </GhostButton>
        </Card>
      </section>

      <Sheet open={newTripOpen} onClose={() => setNewTripOpen(false)} title="New trip">
        <TripForm
          onDone={() => {
            setNewTripOpen(false);
            router.push("/");
          }}
          submitLabel="Create trip"
        />
      </Sheet>

      <TravelerEditor
        tripId={trip.id}
        traveler={editingTraveler}
        open={travelerOpen}
        onClose={() => setTravelerOpen(false)}
      />
    </div>
  );
}
