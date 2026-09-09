import type { Flag } from "../domain/types";
import { holidaysBetween } from "../reference/holidays";
import { placeFacts } from "../reference/places";
import { destinationCountries, formatDay, localDateKey, scheduled, type RuleContext } from "./shared";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function venueClosures({ items }: RuleContext): Flag[] {
  return scheduled(items).flatMap((item): Flag[] => {
    const facts = item.place ? placeFacts(item.place.name) : undefined;
    if (!facts?.closedDays) return [];

    const weekday = weekdayOf(item.startsAt!);
    if (!facts.closedDays.includes(weekday)) return [];

    return [
      {
        id: `closed:${item.id}`,
        severity: "critical",
        category: "conflict",
        title: `${item.place!.name} is shut on ${WEEKDAYS[weekday]}s`,
        detail: `You have it down for ${formatDay(item.startsAt!)}, which is a ${
          WEEKDAYS[weekday]
        }. Move it to another day.`,
        itemIds: [item.id],
      },
    ];
  });
}

export function advanceBookingNeeded({ items }: RuleContext): Flag[] {
  return items.flatMap((item): Flag[] => {
    const facts = item.place ? placeFacts(item.place.name) : undefined;
    if (!facts?.advanceBooking || item.confirmationCode) return [];

    return [
      {
        id: `advance:${item.id}`,
        severity: "warning",
        category: "conflict",
        title: `${item.place!.name} needs booking ahead`,
        detail: `${facts.advanceBooking}. Nothing filed for this one has a confirmation number, so it may not be booked yet.`,
        itemIds: [item.id],
      },
    ];
  });
}

export function publicHolidays(ctx: RuleContext): Flag[] {
  const { trip, items } = ctx;

  return destinationCountries(trip, items).flatMap((country): Flag[] => {
    const holidays = holidaysBetween(country, trip.startDate, trip.endDate);
    if (holidays.length === 0) return [];

    const scheduledDays = new Set(
      scheduled(items).map((item) => localDateKey(item.startsAt!)),
    );
    const clashing = holidays.filter((holiday) => scheduledDays.has(holiday.date));

    return [
      {
        id: `holiday:${country}`,
        severity: clashing.length > 0 ? "warning" : "info",
        category: "prep",
        title:
          clashing.length > 0
            ? `${clashing[0].name} falls on a day you have plans`
            : `${holidays.length} public holiday${holidays.length === 1 ? "" : "s"} during your trip`,
        detail: holidays
          .map((holiday) => `${formatDay(holiday.date)} — ${holiday.name}`)
          .join("; ")
          .concat(". Museums and offices close, and transport gets busy."),
        itemIds: [],
      },
    ];
  });
}
