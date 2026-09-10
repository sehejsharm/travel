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
