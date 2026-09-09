import type { Flag, TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime, localDateKey } from "@/lib/rules";

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

export function Timeline({ items, flags }: { items: TripItem[]; flags: Flag[] }) {
  const days = groupByDay(items);
  const flaggedIds = new Set(
    flags.filter((flag) => flag.severity !== "info").flatMap((flag) => flag.itemIds),
  );

  if (days.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface p-4 text-sm text-ink-soft">
        Nothing scheduled yet. Filed items with a date and time show up here.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-5">
      {days.map(([day, dayItems]) => (
        <li key={day}>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.09em] text-ink-faint">
            {formatDay(dayItems[0].startsAt!)}
          </h3>

          <ul className="mt-2 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
            {dayItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-3.5 py-2.5"
              >
                <span className="w-11 shrink-0 font-mono text-xs text-ink-faint tabular">
                  {formatTime(item.startsAt!) || "--:--"}
                </span>
                <span className="flex-1 text-sm">
                  {item.title}
                  {flaggedIds.has(item.id) && (
                    <span className="ml-2 font-mono text-[10px] uppercase text-critical">
                      flagged
                    </span>
                  )}
                </span>
                {item.place && (
                  <span className="font-mono text-[11px] text-ink-faint">
                    {item.place.city ?? item.place.name}
                  </span>
                )}
                {item.cost && (
                  <span className="font-mono text-[11px] text-ink-soft tabular">
                    {formatMoney(item.cost.amount, item.cost.currency)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
