/**
 * Items store a wall-clock time plus the offset of the place it happens in
 * ("2026-10-16T13:00:00+09:00"). `datetime-local` inputs speak wall clock with
 * no offset, so these convert between the two without shifting the clock.
 */

export function toLocalInput(iso?: string): string {
  return iso ? iso.slice(0, 16) : "";
}

export function offsetOf(iso?: string): string {
  const match = iso?.match(/(Z|[+-]\d{2}:\d{2})$/);
  return match ? (match[1] === "Z" ? "+00:00" : match[1]) : "";
}

export function fromLocalInput(value: string, offset = ""): string | undefined {
  if (!value) return undefined;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}${offset}`;
}

export function toDateInput(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Adds hours to a wall-clock value, keeping its offset. */
export function addHours(iso: string, hours: number): string {
  const offset = offsetOf(iso);
  const base = new Date(`${iso.slice(0, 19)}Z`);
  base.setUTCHours(base.getUTCHours() + hours);
  return `${base.toISOString().slice(0, 19)}${offset}`;
}

/** Minutes east of UTC for an offset like "+05:30" or "Z"; undefined for "" or anything unreadable. */
export function offsetMinutes(offset: string): number | undefined {
  if (offset === "Z") return 0;
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The calendar date and clock an instant reads as at a given offset. An empty
 * offset means the device's own zone, which is how Date.parse reads a time
 * filed without one — so a time goes in and comes back out as it was written,
 * with or without an offset.
 */
function wallReading(instant: Date, offset: string): { date: string; time: string } {
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };

  const minutes = offsetMinutes(offset);
  if (minutes === undefined) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return {
      date: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
      time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}`,
    };
  }

  const shifted = new Date(instant.getTime() + minutes * 60_000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** "14:30" — the clock an instant reads at an offset ("" for the device's zone). */
export function clockAt(instant: Date, offset: string): string {
  return wallReading(instant, offset).time;
}

/** "2026-10-16" — the calendar date an instant falls on at an offset ("" for the device's zone). */
export function dateAt(instant: Date, offset: string): string {
  return wallReading(instant, offset).date;
}
