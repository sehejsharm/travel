/**
 * Static rates so budget totals are comparable across currencies without a
 * network call. Rates are indicative only — a live FX feed replaces this table
 * without changing `convert`.
 */
export const RATES_AS_OF = "2026-08-01";

/** Units of the currency per 1 USD. */
const PER_USD: Record<string, number> = {
  USD: 1,
  INR: 87,
  JPY: 149,
  EUR: 0.92,
  GBP: 0.78,
  THB: 34,
  AED: 3.67,
  SGD: 1.31,
  AUD: 1.5,
  IDR: 16000,
  VND: 25000,
  NPR: 139,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  JPY: "¥",
  EUR: "€",
  GBP: "£",
  THB: "฿",
  AED: "AED ",
  SGD: "S$",
  AUD: "A$",
  IDR: "Rp",
  VND: "₫",
  NPR: "NPR ",
};

export function isKnownCurrency(code: string): boolean {
  return code.toUpperCase() in PER_USD;
}

export function convert(amount: number, from: string, to: string): number | undefined {
  const fromRate = PER_USD[from.toUpperCase()];
  const toRate = PER_USD[to.toUpperCase()];
  if (fromRate === undefined || toRate === undefined) return undefined;
  return (amount / fromRate) * toRate;
}

export function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
  const fractionDigits = currency.toUpperCase() === "JPY" || currency.toUpperCase() === "IDR" || currency.toUpperCase() === "VND" ? 0 : 2;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${symbol}${formatted}`;
}
