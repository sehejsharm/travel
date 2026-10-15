"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlaceRef, TripItem } from "@/lib/domain/types";
import { haversineKm } from "@/lib/geo";
import { mapEmbedForPlaces, mapEmbedUrl, openInMapsUrl } from "@/lib/maps";
import { BorderlessButton, PrimaryButton } from "./form";
import { BORDERLESS_BUTTON_CLASSES, PRIMARY_BUTTON_CLASSES } from "./styles";
import { Card, Chip, EmptyState } from "./ui";

const CATEGORY_TONE: Record<string, string> = {
  booking: "bg-accent",
  activity: "bg-teal",
  place: "bg-ink-faint",
  purchase: "bg-warning",
};

export function TripMap({
  items,
  onSelect,
}: {
  items: TripItem[];
  onSelect: (item: TripItem) => void;
}) {
  const [focused, setFocused] = useState<TripItem | null>(null);

  const located = useMemo(() => items.filter((item) => item.place?.point), [items]);

  const embed = useMemo(() => {
    if (focused?.place) return mapEmbedUrl(focused.place);
    return mapEmbedForPlaces(located.map((item) => item.place!) as PlaceRef[]);
  }, [focused, located]);

  if (located.length === 0) {
    return (
      <EmptyState
        title="Nothing to map yet"
        body="An item gets a pin once its place name matches somewhere known. Open an item and set its place."
        action={
          items.length > 0 ? (
            <PrimaryButton type="button" onClick={() => onSelect(items[0])}>
              <span className="min-w-0 truncate">Set a place for {items[0].title}</span>
            </PrimaryButton>
          ) : (
            <Link href="/add" className={PRIMARY_BUTTON_CLASSES}>
              Add something
            </Link>
          )
        }
      />
    );
  }

  const spread = (() => {
    const points = located.map((item) => item.place!.point!);
    let furthest = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        furthest = Math.max(furthest, haversineKm(points[i], points[j]));
      }
    }
    return furthest;
  })();

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        {embed && (
          <iframe
            key={embed}
            src={embed}
            title={focused ? `Map of ${focused.title}` : "Map of this trip"}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-64 w-full border-0 sm:h-80"
          />
        )}

        {/* The action is a full 44px target; the text pads to match, and the row may wrap on a phone. */}
        <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-2 border-t border-line py-1 pr-1 pl-4">
          <span className="py-2 text-footnote text-ink-soft tabular">
            {located.length} pinned
            {spread > 1 && ` · ${Math.round(spread)} km across`}
          </span>

          {focused ? (
            <BorderlessButton
              type="button"
              onClick={() => setFocused(null)}
              className="-ml-3"
            >
              Show the whole trip
            </BorderlessButton>
          ) : (
            <span className="py-2 pr-3 text-footnote text-ink-soft">Pick a place to zoom in</span>
          )}
        </div>
      </Card>

      <ul className="flex flex-col gap-2">
        {located.map((item) => {
          const active = focused?.id === item.id;

          return (
            <li key={item.id}>
              <Card
                as="div"
                className={`flex items-center gap-3 p-3 ${active ? "border-accent" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setFocused(active ? null : item)}
                  className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${
                      CATEGORY_TONE[item.category] ?? "bg-ink-faint"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-headline">{item.title}</span>
                    <span className="block truncate text-footnote text-ink-soft">
                      {item.place?.name}
                      {item.place?.city && item.place.city !== item.place.name
                        ? ` · ${item.place.city}`
                        : ""}
                    </span>
                  </span>
                </button>

                <a
                  href={openInMapsUrl(item.place!)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.title} in Google Maps`}
                  className={`${BORDERLESS_BUTTON_CLASSES} shrink-0`}
                >
                  Maps ↗
                </a>

                <BorderlessButton
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-label={`Edit ${item.title}`}
                  className="shrink-0"
                >
                  Edit
                </BorderlessButton>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Chip tone="accent">Bookings</Chip>
        <Chip tone="ok">Activities</Chip>
        <Chip>Places</Chip>
      </div>
    </div>
  );
}
