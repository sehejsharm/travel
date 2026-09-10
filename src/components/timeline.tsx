"use client";

import type { Flag, TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime, localDateKey } from "@/lib/rules";
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
      {days.map(([day, dayItems]) => (
        <li key={day}>
          <div className="mb-2 flex items-baseline gap-2 px-0.5">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {formatDay(dayItems[0].startsAt!)}
            </h3>
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] text-ink-faint tabular">{dayItems.length}</span>
          </div>

          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-line">
              {dayItems.map((item) => (
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
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ol>
  );
}
