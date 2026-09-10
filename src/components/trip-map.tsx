"use client";

import { useMemo, useState } from "react";
import type { TripItem } from "@/lib/domain/types";
import { haversineKm } from "@/lib/geo";
import { Card, Chip, EmptyState } from "./ui";

const WIDTH = 640;
const HEIGHT = 420;
const PAD = 46;

const CATEGORY_FILL: Record<string, string> = {
  booking: "var(--accent)",
  activity: "var(--teal)",
  place: "var(--ink-soft)",
  purchase: "var(--warning)",
};

/**
 * Plots filed places on their own bounding box rather than a tile map: it needs
 * no network, works offline, and the thing worth seeing here is how far apart
 * the stops are, not the streets between them.
 */
export function TripMap({
  items,
  onSelect,
}: {
  items: TripItem[];
  onSelect: (item: TripItem) => void;
}) {
  const [active, setActive] = useState<string | null>(null);

  const located = useMemo(
    () => items.filter((item) => item.place?.point),
    [items],
  );

  const projected = useMemo(() => {
    if (located.length === 0) return [];

    const lats = located.map((item) => item.place!.point!.lat);
    const lngs = located.map((item) => item.place!.point!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // A single point, or a perfectly straight line, would divide by zero.
    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLng = Math.max(maxLng - minLng, 0.01);

    return located.map((item) => {
      const { lat, lng } = item.place!.point!;
      return {
        item,
        x: PAD + ((lng - minLng) / spanLng) * (WIDTH - PAD * 2),
        // Latitude grows upward, the SVG y axis grows downward.
        y: PAD + ((maxLat - lat) / spanLat) * (HEIGHT - PAD * 2),
      };
    });
  }, [located]);

  if (located.length === 0) {
    return (
      <EmptyState
        title="Nothing to map yet"
        body="Items get a pin once their place name matches somewhere known. Open an item and set its place."
      />
    );
  }

  const activeEntry = projected.find((entry) => entry.item.id === active);
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
      <Card className="overflow-hidden p-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-manipulation"
          role="img"
          aria-label={`${located.length} filed places`}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="var(--line)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" opacity="0.5" />

          {projected.map((entry) => {
            const selected = entry.item.id === active;
            return (
              <g key={entry.item.id}>
                <circle
                  cx={entry.x}
                  cy={entry.y}
                  r={selected ? 11 : 7}
                  fill={CATEGORY_FILL[entry.item.category] ?? "var(--ink-soft)"}
                  opacity={selected ? 1 : 0.85}
                  stroke="var(--surface)"
                  strokeWidth="2.5"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActive(selected ? null : entry.item.id)}
                />
                <title>{entry.item.title}</title>
              </g>
            );
          })}
        </svg>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">bookings</Chip>
        <Chip tone="ok">activities</Chip>
        <Chip>places</Chip>
        <span className="ml-auto font-mono text-[10px] text-ink-faint tabular">
          {located.length} pinned · {Math.round(spread)} km apart at the extremes
        </span>
      </div>

      {activeEntry ? (
        <button
          type="button"
          onClick={() => onSelect(activeEntry.item)}
          className="press block w-full text-left"
        >
          <Card className="p-4">
            <p className="text-sm font-medium">{activeEntry.item.title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
              {activeEntry.item.place?.name}
              {activeEntry.item.place?.city ? ` · ${activeEntry.item.place.city}` : ""} · tap to
              edit
            </p>
          </Card>
        </button>
      ) : (
        <p className="text-center font-mono text-[11px] text-ink-faint">
          Tap a pin to see what it is
        </p>
      )}
    </div>
  );
}
