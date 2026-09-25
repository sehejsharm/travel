import { clockAt } from "../datetime";
import type { TravelMode } from "../geo";

/** Closer than this and two points are the same place, for every screen that says so. */
export const NEAR_ENOUGH_M = 25;

export function formatDistance(metres: number): string {
  if (metres < NEAR_ENOUGH_M) return "here";
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** "45 min", "1 h 15 min", or "now" for anything that rounds to nothing. */
export function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole <= 0) return "now";
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "in 25 min", or "now". */
export function formatEta(minutes: number): string {
  const whole = Math.round(minutes);
  return whole <= 0 ? "now" : `in ${formatMinutes(whole)}`;
}

/**
 * The clock some minutes after the route's clock, read at the route's offset:
 * a 14:30 in Tokyo reads as 14:30 whatever zone the phone is set to, and a
 * time filed with no offset reads as it was written.
 */
export function wallClock(clock: Date, offset: string, minutesAfter = 0): string {
  return clockAt(new Date(clock.getTime() + minutesAfter * 60_000), offset);
}

/** A place name as it reads mid-sentence: "A coffee stand near you" becomes "a coffee stand near you". */
export function inSentence(name: string): string {
  return name.replace(/^(An?) /, (_, article: string) => `${article.toLowerCase()} `);
}

/**
 * What to search Maps for instead of a stand-in's made-up point: the kind of
 * place, near the named stop, or near wherever the phone is when there is none.
 */
export function standInSearch(name: string): string {
  return name.replace(/^An? /, "").replace(/ near (you|the group)$/, " near me");
}

export const MODE_LABELS: Record<TravelMode, string> = {
  walk: "on foot",
  transit: "by transit",
  drive: "by car",
  fly: "by air",
};
