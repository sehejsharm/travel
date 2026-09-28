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
  /** The number typed, when it is one, even if there is no currency to go with it. */
  amount?: number;
  /** Why an amount that was typed cannot be filed. */
  problem?: "amount" | "currency";
}

// How prices are written on bookings and typed on phone keypads: "52,400" and
// "1,299.50", but also "12,50" and "1.234,50" where a comma is the decimal
// point. Three digits after a lone comma are thousands, fewer are cents.
const COMMA_THOUSANDS = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const DOT_THOUSANDS_COMMA_DECIMAL = /^-?\d{1,3}(\.\d{3})+,\d{1,2}$/;
// "12,50", but also the halves of one typed a key at a time: "12," and ",50".
const COMMA_DECIMAL = /^-?(\d+,\d{0,2}|,\d{1,2})$/;

function readAmount(text: string): number {
  if (COMMA_THOUSANDS.test(text)) return Number(text.replace(/,/g, ""));
  if (DOT_THOUSANDS_COMMA_DECIMAL.test(text)) return Number(text.replace(/\./g, "").replace(",", "."));
  if (COMMA_DECIMAL.test(text)) return Number(text.replace(",", "."));
  return Number(text);
}

/**
 * A typed price, which needs a real amount and a currency to mean anything.
 * A negative amount is read as written: the editor keeps one it was given,
 * and typing an item in refuses it itself.
 */
export function readCost(amountText: string, currency: string): CostReading {
  const text = amountText.replace(/\s/g, "");
  if (!text) return {};

  // "+ 0" turns a typed "-0" into plain 0.
  const amount = readAmount(text) + 0;
  if (!Number.isFinite(amount)) return { problem: "amount" };
  if (!currency) return { amount, problem: "currency" };

  return { amount, cost: { amount, currency } };
}
