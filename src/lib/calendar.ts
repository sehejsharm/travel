import type { Trip, TripItem } from "./domain/types";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toUtcStamp(iso: string): string {
  // Offsets in the stored value are respected; a value without one is read as
  // local wall-clock, which is the best available reading of the source.
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 wants lines folded at 75 octets. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  parts.push(` ${rest}`);
  return parts.join("\r\n");
}

const HOUR_MS = 3_600_000;

export function toCalendar(trip: Trip, items: TripItem[]): string {
  const scheduled = items
    .filter((item) => item.startsAt)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Manifest//Trip//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(trip.name)}`,
  ];

  for (const item of scheduled) {
    const end = item.endsAt ?? new Date(Date.parse(item.startsAt!) + HOUR_MS).toISOString();
    const description = [
      item.confirmationCode ? `Confirmation: ${item.confirmationCode}` : "",
      item.cost ? `Cost: ${item.cost.amount} ${item.cost.currency}` : "",
      item.sourceRef ? `From: ${item.sourceRef}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@manifest`,
      `DTSTAMP:${toUtcStamp(item.createdAt)}`,
      `DTSTART:${toUtcStamp(item.startsAt!)}`,
      `DTEND:${toUtcStamp(end)}`,
      fold(`SUMMARY:${escapeText(item.title)}`),
    );

    if (item.place) {
      const location = [item.place.name, item.place.city].filter(Boolean).join(", ");
      lines.push(fold(`LOCATION:${escapeText(location)}`));
    }
    if (description) lines.push(fold(`DESCRIPTION:${escapeText(description)}`));

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
