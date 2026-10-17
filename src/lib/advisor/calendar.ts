/**
 * Festivals & shows, answered from Manifest's own holiday and festival
 * calendar instead of a search. It runs on the device, from data that ships
 * with the app, so it costs nothing and sends nothing anywhere: Discover asks
 * /api/advise only for the interests the calendar could not answer.
 */
import type { CalendarAnswer } from "../trip-calendar";

/** The interest the calendar answers. Its id is matched in interests.ts. */
export const CALENDAR_INTEREST = "festivals";

/**
 * Whether the calendar has answered Festivals & shows for this trip: its
 * dates are settled, every destination's calendar is in, and something is on.
 * A trip with no dates yet, or nothing on, still lets the other tiers look.
 */
export function calendarAnswered(answer: CalendarAnswer): boolean {
  return answer.ready && answer.events.length > 0;
}

/**
 * The interests to send to /api/advise: everything picked, less what the
 * calendar already answered, so no paid tier is asked for it. The order is
 * kept, since the route keeps only the first few.
 */
export function interestsToLookUp(interests: string[], answer: CalendarAnswer): string[] {
  if (!interests.includes(CALENDAR_INTEREST) || !calendarAnswered(answer)) return interests;
  return interests.filter((id) => id !== CALENDAR_INTEREST);
}

/**
 * Which cached answer belongs to a question. Only the interests actually
 * looked up are in it: the calendar's part is worked out fresh each time, so
 * it follows the trip's dates instead of going stale in the cache.
 */
export function adviceKey(destination: string, lookedUp: string[]): string {
  return `${destination.toLowerCase()}|${[...lookedUp].sort().join(",")}`;
}
