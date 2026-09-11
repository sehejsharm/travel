"use client";

import { useMemo, useState } from "react";
import type { PlaceRef, TripItem } from "@/lib/domain/types";
import { haversineKm } from "@/lib/geo";
import { mapEmbedForPlaces, mapEmbedUrl, openInMapsUrl } from "@/lib/maps";
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="font-mono text-[11px] text-ink-faint tabular">
            {located.length} pinned
            {spread > 1 && ` · ${Math.round(spread)} km across`}
          </span>

          {focused ? (
            <button
              type="button"
              onClick={() => setFocused(null)}
              className="press font-mono text-[11px] text-accent-strong underline"
            >
              show the whole trip
            </button>
          ) : (
            <span className="font-mono text-[11px] text-ink-faint">Pick a place to zoom in</span>
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
                  className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      CATEGORY_TONE[item.category] ?? "bg-ink-faint"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate font-mono text-[11px] text-ink-faint">
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
                  className="press shrink-0 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  Maps ↗
                </a>

                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-label={`Edit ${item.title}`}
                  className="press shrink-0 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  Edit
                </button>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Chip tone="accent">bookings</Chip>
        <Chip tone="ok">activities</Chip>
        <Chip>places</Chip>
      </div>
    </div>
  );
}
