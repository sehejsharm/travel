import type { TravelMode } from "../geo";

export function formatDistance(metres: number): string {
  if (metres < 25) return "here";
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

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

function parseOffset(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The clock time some minutes after the route's clock, in the offset the
 * stops are written in: a 14:30 in Tokyo reads as 14:30 whatever zone the
 * phone is set to.
 */
export function wallClock(clock: Date, offset: string, minutesAfter = 0): string {
  const shifted = new Date(clock.getTime() + (minutesAfter + parseOffset(offset)) * 60_000);
  return shifted.toISOString().slice(11, 16);
}

export const MODE_LABELS: Record<TravelMode, string> = {
  walk: "on foot",
  transit: "by transit",
  drive: "by car",
  fly: "by air",
};
