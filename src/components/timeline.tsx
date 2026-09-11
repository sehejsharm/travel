"use client";

import type { Flag, TripItem } from "@/lib/domain/types";
import { estimateTravel } from "@/lib/geo";
import { directionsUrl } from "@/lib/maps";
import { formatDay, formatTime, localDateKey } from "@/lib/rules";
import { convert, formatMoney } from "@/lib/reference/fx";
import { Card, Chip } from "./ui";

function groupByDay(items: TripItem[]): [string, TripItem[]][] {
  const byDay = new Map<string, TripItem[]>();

  for (const item of items) {
    if (!item.startsAt) continue;
    const key = localDateKey(item.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => [
      day,
      dayItems.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!)),
    ]);
}

const KIND_TONE: Record<string, string> = {
  flight: "text-accent-strong",
  lodging: "text-teal",
};

export function Timeline({
  items,
  flags,
  onSelect,
}: {
  items: TripItem[];
  flags: Flag[];
  onSelect: (item: TripItem) => void;
}) {
  const days = groupByDay(items);
  const flagged = new Set(
    flags.filter((flag) => flag.severity !== "info").flatMap((flag) => flag.itemIds),
  );

  return (
    <ol className="flex flex-col gap-5">
      {days.map(([day, dayItems], dayIndex) => (
        <li key={day}>
          <DayHeader day={day} items={dayItems} index={dayIndex} />

          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-line">
              {dayItems.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="press flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  >
                    <span className="w-11 shrink-0 pt-0.5 text-right font-mono text-xs text-ink-soft tabular">
                      {formatTime(item.startsAt!) || "—"}
                    </span>

                    <span className="flex flex-col items-center pt-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full bg-current ${
                          KIND_TONE[item.bookingKind ?? ""] ?? "text-ink-faint"
                        }`}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[15px] leading-snug font-medium">{item.title}</span>
                        {flagged.has(item.id) && <Chip tone="critical">check</Chip>}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                        {[
                          item.place?.city ?? item.place?.name,
                          item.cost && formatMoney(item.cost.amount, item.cost.currency),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>

                    <span aria-hidden="true" className="self-center text-ink-faint">
                      ›
                    </span>
                  </button>

                  <Hop from={item} to={dayItems[index + 1]} />
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ol>
  );
}

const MODE_LABEL: Record<string, string> = {
  walk: "walk",
  transit: "transit",
  drive: "drive",
  fly: "fly",
};

/** The gap between two pinned stops, with a one-tap handoff to Google Maps. */
function Hop({ from, to }: { from: TripItem; to?: TripItem }) {
  if (!from.place?.point || !to?.place?.point) return null;

  const travel = estimateTravel(from.place.point, to.place.point);
  if (travel.distanceKm < 0.15) return null;

  return (
    <div className="flex items-center gap-2 border-t border-dashed border-line/70 bg-surface-2/40 py-1.5 pr-4 pl-[4.25rem]">
      <span className="font-mono text-[10px] text-ink-faint tabular">
        {MODE_LABEL[travel.mode]} · {travel.minutes} min ·{" "}
        {travel.distanceKm < 10 ? travel.distanceKm.toFixed(1) : Math.round(travel.distanceKm)} km
      </span>
      <a
        href={directionsUrl(from.place, to.place)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="press ml-auto font-mono text-[10px] text-accent-strong underline"
      >
        Directions ↗
      </a>
    </div>
  );
}

/**
 * A day gets its own masthead: which day of the trip it is, what it costs,
 * and where it happens — so the timeline scans as days, not as a list of rows.
 */
function DayHeader({ day, items, index }: { day: string; items: TripItem[]; index: number }) {
  const spend = items.reduce(
    (total, item) =>
      total + (item.cost ? convert(item.cost.amount, item.cost.currency, "USD") ?? 0 : 0),
    0,
  );
  const areas = [...new Set(items.map((item) => item.place?.city ?? item.place?.name).filter(Boolean))];
  const [weekday, ...rest] = formatDay(`${day}T12:00:00Z`).split(" ");

  return (
    <div className="mb-2.5 flex items-center gap-3 px-0.5">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface shadow-card">
        <span className="font-mono text-[9px] uppercase tracking-wide text-ink-faint">
          {weekday.replace(",", "")}
        </span>
        <span className="font-display text-[15px] leading-none font-semibold tabular">
          {day.slice(8)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Day {index + 1}
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">
            {rest.join(" ")}
          </span>
        </h3>
        <p className="truncate font-mono text-[10px] text-ink-faint tabular">
          {[
            `${items.length} stop${items.length === 1 ? "" : "s"}`,
            areas.slice(0, 2).join(" · "),
            spend > 0 && formatMoney(spend, "USD"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
