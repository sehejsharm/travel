"use client";

import { useMemo } from "react";
import type { Flag, Trip, TripItem } from "@/lib/domain/types";
import { estimateTravel } from "@/lib/geo";
import { directionsUrl } from "@/lib/maps";
import { formatDay, formatTime, localDateKey } from "@/lib/rules";
import { getCountry } from "@/lib/reference/countries";
import { convert, formatMoney } from "@/lib/reference/fx";
import type { HolidayKind } from "@/lib/reference/holidays";
import { activeTrip } from "@/lib/store/state";
import { useAppState, useHolidaysVersion } from "@/lib/store/use-store";
import { KIND_LABELS, tripCalendar, type CalendarMark } from "@/lib/trip-calendar";
import { BORDERLESS_BUTTON_CLASSES } from "./styles";
import { Card, Chip, type Tone } from "./ui";

/**
 * The days to show, each with what is planned and what is on: every day with
 * something scheduled, and every day of the trip that has a holiday or a
 * festival, planned or not.
 */
function groupByDay(
  items: TripItem[],
  marks: Map<string, CalendarMark[]>,
): [string, TripItem[]][] {
  const byDay = new Map<string, TripItem[]>();

  for (const item of items) {
    if (!item.startsAt) continue;
    const key = localDateKey(item.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  for (const day of marks.keys()) if (!byDay.has(day)) byDay.set(day, []);

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => [
      day,
      dayItems.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!)),
    ]);
}

/**
 * Which day of the trip it is. A trip whose dates are not settled counts the
 * days shown instead, since its window is only a placeholder.
 */
function dayLabel(trip: Trip | undefined, day: string, index: number): string {
  if (!trip || trip.datesTbd) return `Day ${index + 1}`;

  const start = trip.startDate.slice(0, 10);
  if (day < start) return "Before the trip";
  if (day > trip.endDate.slice(0, 10)) return "After the trip";
  return `Day ${Math.round((Date.parse(day) - Date.parse(start)) / 86_400_000) + 1}`;
}

const KIND_TONE: Record<string, string> = {
  flight: "text-accent-strong",
  lodging: "text-teal",
};

export function Timeline({
  items,
  flags,
  onSelect,
  trip: given,
}: {
  items: TripItem[];
  flags: Flag[];
  onSelect: (item: TripItem) => void;
  /** The trip the items belong to. Defaults to the active trip. */
  trip?: Trip;
}) {
  const state = useAppState();
  const trip = given ?? activeTrip(state);
  // Each country's calendar arrives on its own; this renders again when one does.
  const holidays = useHolidaysVersion();
  const calendar = useMemo(
    () => (trip ? calendarFor(trip, items, holidays) : undefined),
    [trip, items, holidays],
  );
  const marks = calendar?.days ?? new Map<string, CalendarMark[]>();
  const days = groupByDay(items, marks);
  const flagged = new Set(
    flags.filter((flag) => flag.severity !== "info").flatMap((flag) => flag.itemIds),
  );

  return (
    <ol className="flex flex-col gap-5">
      {days.map(([day, dayItems], dayIndex) => (
        <li key={day}>
          <DayHeader
            day={day}
            items={dayItems}
            label={dayLabel(trip, day, dayIndex)}
          />

          <Card as="div" className="overflow-hidden">
            {marks.has(day) && (
              <DayMarks
                marks={marks.get(day)!}
                showCountry={(calendar?.countries.length ?? 0) > 1}
                divided={dayItems.length > 0}
              />
            )}

            {dayItems.length > 0 && (
              <ul className="divide-y divide-line">
                {dayItems.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="press flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2"
                    >
                      <span className="w-11 shrink-0 pt-1 text-right text-footnote text-ink-soft tabular">
                        {formatTime(item.startsAt!) || "—"}
                      </span>

                      <span className="flex flex-col items-center pt-2">
                        <span
                          className={`h-2 w-2 rounded-full bg-current ${
                            KIND_TONE[item.bookingKind ?? ""] ?? "text-ink-faint"
                          }`}
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-headline">{item.title}</span>
                          {flagged.has(item.id) && <Chip tone="critical">Check</Chip>}
                        </span>
                        <span className="mt-1 block text-footnote text-ink-soft tabular">
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
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}

/** The trip's calendar as of one version of the holiday data. */
function calendarFor(trip: Trip, items: TripItem[], holidayVersion: number) {
  void holidayVersion;
  return tripCalendar(trip, items);
}

/**
 * Days off read as amber, the way any heads-up does, since shops, offices and
 * many museums close; everything else has a quiet chip, so the two never look
 * alike. The dot says the rest: amber in outline for a day off for some, the
 * brand's colour for a festival, faint for an observance, which changes nothing.
 */
const MARK_TONE: Record<HolidayKind, Tone> = {
  public: "warning",
  bank: "warning",
  optional: "neutral",
  festival: "neutral",
  observance: "neutral",
};

/** The chip tone for a kind of holiday, so Discover labels them the same way. */
export function holidayTone(kind: HolidayKind): Tone {
  return MARK_TONE[kind];
}

const MARK_DOT: Record<HolidayKind, string> = {
  public: "bg-warning",
  bank: "bg-warning",
  optional: "border border-warning",
  festival: "bg-brand",
  observance: "bg-ink-faint",
};

/** The day's holidays and festivals, above its plans, as a calendar lists all-day events. */
function DayMarks({
  marks,
  showCountry,
  divided,
}: {
  marks: CalendarMark[];
  showCountry: boolean;
  divided: boolean;
}) {
  return (
    <ul
      aria-label="Holidays and festivals"
      className={`divide-y divide-line bg-surface-2/40 ${divided ? "border-b border-line" : ""}`}
    >
      {marks.map((mark) => (
        <li key={`${mark.countryCode}|${mark.name}`} className="flex gap-3 px-4 py-3">
          <span className="w-11 shrink-0 pt-1 text-right text-caption text-ink-soft">All day</span>

          <span className="flex flex-col items-center pt-2" aria-hidden="true">
            <span className={`h-2 w-2 rounded-full ${MARK_DOT[mark.kind]}`} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-subheadline font-medium text-pretty">{mark.name}</span>
              <Chip tone={MARK_TONE[mark.kind]}>
                {KIND_LABELS[mark.kind]}
                {showCountry && ` · ${getCountry(mark.countryCode)?.name ?? mark.countryCode}`}
              </Chip>
            </span>
            {mark.note && (
              <span className="mt-1 block text-footnote text-ink-soft text-pretty">{mark.note}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
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
    <div className="flex min-h-11 items-center gap-2 border-t border-dashed border-line/70 bg-surface-2/40 pr-4 pl-17">
      <span className="text-caption text-ink-soft tabular">
        {MODE_LABEL[travel.mode]} · {travel.minutes} min ·{" "}
        {travel.distanceKm < 10 ? travel.distanceKm.toFixed(1) : Math.round(travel.distanceKm)} km
      </span>
      <a
        href={directionsUrl(from.place, to.place)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={`${BORDERLESS_BUTTON_CLASSES} -mr-3 ml-auto shrink-0`}
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
function DayHeader({ day, items, label }: { day: string; items: TripItem[]; label: string }) {
  const spend = items.reduce(
    (total, item) =>
      total + (item.cost ? convert(item.cost.amount, item.cost.currency, "USD") ?? 0 : 0),
    0,
  );
  const areas = [...new Set(items.map((item) => item.place?.city ?? item.place?.name).filter(Boolean))];
  const [weekday, ...rest] = formatDay(`${day}T12:00:00Z`).split(" ");

  return (
    <div className="mb-2 flex items-center gap-3 px-1">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-control border border-line bg-surface shadow-card">
        <span className="text-caption-2 text-ink-soft">{weekday.replace(",", "")}</span>
        <span className="text-headline tabular">{day.slice(8)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-headline">
          {label}
          <span className="ml-2 text-footnote font-normal text-ink-soft tabular">
            {rest.join(" ")}
          </span>
        </h3>
        <p className="truncate text-footnote text-ink-soft tabular">
          {[
            items.length === 0
              ? "Nothing planned"
              : `${items.length} stop${items.length === 1 ? "" : "s"}`,
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
