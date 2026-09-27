import type { Money } from "./domain/types";
import { offsetOf } from "./datetime";
import { offsetSuffix } from "./extract/patterns";
import { getCountry } from "./reference/countries";

/**
 * The rules an item's form holds its fields to, shared by the editor and by
 * typing an item in on the Add screen so the two cannot drift apart.
 */

/**
 * The offset a time in this country is filed with ("+09:00"), or "" when the
 * country is unknown and the time is left in the device's zone. The extractor
 * files times the same way.
 */
export function offsetForCountry(countryCode?: string): string {
  const country = getCountry(countryCode);
  return country ? offsetSuffix(country.utcOffset) : "";
}

/**
 * True when an end falls before its start. With both offsets known the
 * instants are compared, so a flight east across the date line (leaves Tokyo
 * 18:00, lands in Los Angeles 11:00 the same day) is not mistaken for a typo.
 * Without them the wall clocks are all there is.
 */
export function endsBeforeStart(startsAt?: string, endsAt?: string): boolean {
  if (!startsAt || !endsAt) return false;

  if (offsetOf(startsAt) && offsetOf(endsAt)) {
    const start = Date.parse(startsAt);
    const end = Date.parse(endsAt);
    if (Number.isFinite(start) && Number.isFinite(end)) return end < start;
  }

  return endsAt.slice(0, 16) < startsAt.slice(0, 16);
}

export interface CostReading {
  cost?: Money;
  /** Why an amount that was typed cannot be filed. */
  problem?: "amount" | "currency";
}

// "52,400" and "1,299.50" are how prices are written on a booking.
const THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

/** A typed price, which needs a real amount and a currency to mean anything. */
export function readCost(amountText: string, currency: string): CostReading {
  const text = amountText.replace(/\s/g, "");
  if (!text) return {};

  const amount = Number(THOUSANDS.test(text) ? text.replace(/,/g, "") : text);
  if (!Number.isFinite(amount) || amount < 0) return { problem: "amount" };
  if (!currency) return { problem: "currency" };

  return { cost: { amount, currency } };
}
