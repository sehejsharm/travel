/**
 * Festivals & shows, with Manifest's own holiday and festival calendar beside
 * the search. The search finds concerts, theatre and opera, which the calendar
 * never has, and a request costs the same with or without the interest, so
 * Discover sends it to /api/advise like any other. The calendar adds the
 * festivals on the trip's own dates. It runs on the device, from data that
 * ships with the app, so that part costs nothing and sends nothing anywhere.
 */
import type { AdviceResult, AdviceSection } from "./types";
import type { HolidayKind } from "../reference/holidays";
import type { CalendarAnswer, CalendarEvent } from "../trip-calendar";

/** The interest the calendar adds to. Its id is matched in interests.ts. */
export const CALENDAR_INTEREST = "festivals";

/**
 * What the calendar's section lists: festivals, and days off for everyone,
 * which many festivals are (Diwali, Eid, Christmas) and which change plans as
 * much. An observance or a day off for some is not a festival, so it is left
 * to the timeline.
 */
const LISTED: ReadonlySet<HolidayKind> = new Set<HolidayKind>(["festival", "public", "bank"]);

/**
 * The events for the "From Manifest's calendar" section, in date order. Empty,
 * so no section, until the dates are settled and every destination's calendar
 * is in. A day off alone is enough for one: many of the biggest festivals
 * (Songkran, Chinese New Year, Thingyan, Carnival) are stored as days off, not
 * as festivals, since that is what they are too.
 */
export function calendarSection(answer: CalendarAnswer): CalendarEvent[] {
  if (!answer.ready) return [];
  return answer.events.filter((event) => LISTED.has(event.kind));
}

/**
 * Which cached answer belongs to a question: the destination and every
 * interest asked about, sorted. It is the format the cache always had, so
 * answers saved before the calendar existed still match.
 */
export function adviceKey(destination: string, interests: string[]): string {
  return `${destination.toLowerCase()}|${[...interests].sort().join(",")}`;
}

/** One section on Discover: what the search found for an interest, or the calendar's own. */
export type ShownSection =
  | { interestId: string; source: "search"; section: AdviceSection }
  | { interestId: string; source: "calendar" };

/**
 * The sections in the order the interests are picked in. Festivals & shows has
 * the search's section, when it found anything, then the calendar's, when it
 * has a festival or a day off on, whether or not the search ran or worked. A
 * section the answer holds for an interest no longer picked still shows,
 * after the rest.
 */
export function shownSections(
  interests: string[],
  withCalendar: boolean,
  advice: AdviceResult | undefined,
): ShownSection[] {
  const sections = advice?.sections ?? [];
  const shown: ShownSection[] = [];

  for (const id of interests) {
    const section = sections.find((candidate) => candidate.interestId === id);
    if (section) shown.push({ interestId: id, source: "search", section });
    if (id === CALENDAR_INTEREST && withCalendar) shown.push({ interestId: id, source: "calendar" });
  }
  for (const section of sections) {
    if (!interests.includes(section.interestId)) {
      shown.push({ interestId: section.interestId, source: "search", section });
    }
  }
  return shown;
}
