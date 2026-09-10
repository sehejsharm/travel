"use client";

import Link from "next/link";
import { useState } from "react";
import { ItemCard } from "@/components/item-card";
import { Card, EmptyState, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { CATEGORY_LABELS, type ItemCategory } from "@/lib/domain/types";
import { useTripView } from "@/lib/store/use-store";

const FILTERS: { value: ItemCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "place", label: CATEGORY_LABELS.place },
  { value: "activity", label: CATEGORY_LABELS.activity },
  { value: "booking", label: CATEGORY_LABELS.booking },
  { value: "purchase", label: CATEGORY_LABELS.purchase },
];

export default function CabinetScreen() {
  const { trip, items, hydrated } = useTripView();
  const [filter, setFilter] = useState<ItemCategory | "all">("all");

  if (!hydrated) return <ScreenSkeleton />;

  const visible = filter === "all" ? items : items.filter((item) => item.category === filter);
  const nameFor = (id?: string) =>
    trip.travelers.length > 1
      ? trip.travelers.find((traveler) => traveler.id === id)?.name
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow="Filing cabinet"
        title="Everything filed"
        meta={`${items.length} items, sorted as they came in`}
      />

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((option) => {
          const count =
            option.value === "all"
              ? items.length
              : items.filter((item) => item.category === option.value).length;
          const active = filter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
              <span className="ml-1.5 font-mono text-[10px] tabular opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing filed here yet"
          body="Forward a booking email, a screenshot, or a Reel and it lands in the cabinet."
          action={
            <Link
              href="/add"
              className="press mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              Add something
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} addedByName={nameFor(item.addedBy)} />
          ))}
        </ul>
      )}

      <Card className="p-4">
        <p className="text-xs leading-relaxed text-ink-soft">
          Everything here lives on this device. Nothing is uploaded, and the app keeps working
          with no signal.
        </p>
      </Card>
    </div>
  );
}
