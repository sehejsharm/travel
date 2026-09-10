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

const KIND_TONE = {
  flight: "text-accent-strong",
  lodging: "text-teal",
} as const;

export function Timeline({ items, flags }: { items: TripItem[]; flags: Flag[] }) {
  const days = groupByDay(items);
  const flagged = new Set(
    flags.filter((flag) => flag.severity !== "info").flatMap((flag) => flag.itemIds),
  );

  return (
    <ol className="flex flex-col gap-5">
      {days.map(([day, dayItems], dayIndex) => (
        <li key={day} className="animate-rise" style={{ animationDelay: `${dayIndex * 30}ms` }}>
          <div className="mb-2 flex items-baseline gap-2 px-0.5">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {formatDay(dayItems[0].startsAt!)}
            </h3>
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] text-ink-faint tabular">
              {dayItems.length}
            </span>
          </div>

          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-line">
              {dayItems.map((item) => {
                const kindTone =
                  item.bookingKind && item.bookingKind in KIND_TONE
                    ? KIND_TONE[item.bookingKind as keyof typeof KIND_TONE]
                    : "text-ink-faint";

                return (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <div className="flex w-11 shrink-0 flex-col items-end pt-0.5">
                      <span className="font-mono text-xs text-ink-soft tabular">
                        {formatTime(item.startsAt!) || "—"}
                      </span>
                    </div>

                    <div className="relative flex flex-col items-center pt-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full bg-current ${kindTone}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[15px] leading-snug font-medium">{item.title}</p>
                        {flagged.has(item.id) && (
                          <Chip tone="critical">check</Chip>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        {[
                          item.place?.city ?? item.place?.name,
                          item.cost && formatMoney(item.cost.amount, item.cost.currency),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </li>
      ))}
    </ol>
  );
}
