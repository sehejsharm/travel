import type { Money } from "../domain/types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "₹": "INR",
  $: "USD",
  "¥": "JPY",
  "€": "EUR",
  "£": "GBP",
  "฿": "THB",
};

export function offsetSuffix(offsetHours: number): string {
  const sign = offsetHours < 0 ? "-" : "+";
  const abs = Math.abs(offsetHours);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export interface FoundDate {
  /** Calendar date as `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock time as `HH:MM`, when the text carried one. */
  time?: string;
  index: number;
  /** True where day/month order had to be assumed. */
  ambiguous: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function timeNear(text: string, from: number): string | undefined {
  const window = text.slice(from, from + 40);
  // Not \b — an ISO timestamp puts a word character ("T") right before the hour.
  const match = window.match(/(?<!\d)(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return undefined;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();

  if (hours > 23 || minutes > 59) return undefined;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return `${pad(hours)}:${pad(minutes)}`;
}

/** Pulls every date it can recognise, in the order they appear. */
export function findDates(text: string, fallbackYear: number): FoundDate[] {
  const found: FoundDate[] = [];

  const iso = /\b(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
  for (const match of text.matchAll(iso)) {
    found.push({
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: timeNear(text, match.index! + match[0].length),
      index: match.index!,
      ambiguous: false,
    });
  }

  const dayFirst = /\b(\d{1,2})(?!\d)\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?/g;
  for (const match of text.matchAll(dayFirst)) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (!month) continue;
    const day = Number(match[1]);
    if (day < 1 || day > 31) continue;

    found.push({
      date: `${match[3] ?? fallbackYear}-${pad(month)}-${pad(day)}`,
      time: timeNear(text, match.index! + match[0].length),
      index: match.index!,
      ambiguous: false,
    });
  }

  // The lookahead stops a bare year ("Oct 2026") reading as a day of the month.
  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?,?\s*(\d{4})?/g;
  for (const match of text.matchAll(monthFirst)) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (!month) continue;
    const day = Number(match[2]);
    if (day < 1 || day > 31) continue;

    found.push({
      date: `${match[3] ?? fallbackYear}-${pad(month)}-${pad(day)}`,
      time: timeNear(text, match.index! + match[0].length),
      index: match.index!,
      ambiguous: false,
    });
  }

  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  for (const match of text.matchAll(numeric)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    // Day-first unless the first number can only be a month.
    const dayFirstReading = first > 12 || second <= 12;
    const day = dayFirstReading ? first : second;
    const month = dayFirstReading ? second : first;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    found.push({
      date: `${match[3]}-${pad(month)}-${pad(day)}`,
      time: timeNear(text, match.index! + match[0].length),
      index: match.index!,
      ambiguous: first <= 12 && second <= 12,
    });
  }

  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .filter((entry) => {
      const key = `${entry.date}T${entry.time ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function toIso(found: FoundDate, offsetHours?: number): string {
  const time = found.time ?? "00:00";
  const suffix = offsetHours === undefined ? "" : offsetSuffix(offsetHours);
  return `${found.date}T${time}:00${suffix}`;
}

export function findMoney(text: string): Money | undefined {
  const symbol = text.match(
    /([₹$¥€£฿])\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/,
  );
  if (symbol) {
    return {
      amount: Number(symbol[2].replace(/,/g, "")),
      currency: CURRENCY_BY_SYMBOL[symbol[1]],
    };
  }

  const code = text.match(
    /\b(INR|USD|JPY|EUR|GBP|THB|AED|SGD|AUD|IDR|VND|NPR)\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i,
  );
  if (code) {
    return {
      amount: Number(code[2].replace(/,/g, "")),
      currency: code[1].toUpperCase(),
    };
  }

  return undefined;
}

export interface FlightLeg {
  flightNumber: string;
  from?: string;
  to?: string;
}

const NON_AIRPORT_TRIGRAMS = new Set([
  "THE", "AND", "FOR", "YOU", "ARE", "NOT", "ALL", "NEW", "OUT", "GET", "PNR", "ETA",
]);

export function findFlight(text: string): FlightLeg | undefined {
  const flight = text.match(/\b([A-Z]{2})\s?-?\s?(\d{2,4})\b/);
  if (!flight) return undefined;

  const route = text.match(/\b([A-Z]{3})\b\s*(?:→|->|-|–|to)\s*\b([A-Z]{3})\b/);
  const codes = route
    ? [route[1], route[2]].filter((code) => !NON_AIRPORT_TRIGRAMS.has(code))
    : [];

  return {
    flightNumber: `${flight[1]}${flight[2]}`,
    from: codes[0],
    to: codes[1],
  };
}

export function findConfirmationCode(text: string): string | undefined {
  const match = text.match(
    /\b(?:pnr|booking reference|booking ref|confirmation(?: number| code)?|reservation(?: number| code)?)\b\s*[:#-]?\s*([A-Z0-9]{5,10})\b/i,
  );
  return match?.[1]?.toUpperCase();
}

export function findTravelerName(text: string): string | undefined {
  const match = text.match(
    /\b(?:passenger|traveller|traveler|guest|lead guest|booked for)\b\s*(?:name)?\s*[:-]\s*([A-Za-z][A-Za-z .'-]{2,40})/i,
  );
  return match?.[1]?.trim().replace(/\s+/g, " ");
}

export function findRefundDeadline(
  text: string,
  fallbackYear: number,
): { iso?: string; nonRefundable: boolean } {
  if (/\bnon[- ]?refundable\b/i.test(text)) return { nonRefundable: true };

  const match = text.match(
    /\b(?:free cancellation|cancel(?: for free)?|refundable)\b[^.\n]{0,30}?\b(?:until|before|by|till)\b\s*([^.\n]{4,30})/i,
  );
  if (!match) return { nonRefundable: false };

  const dates = findDates(match[1], fallbackYear);
  return { iso: dates[0] ? toIso(dates[0]) : undefined, nonRefundable: false };
}
