import type { Money } from "../domain/types";

/**
 * What you are allowed to carry: the airline's limit on the way there, and the
 * customs limit on the way back. Both are the kind of number people only look
 * up once they are already over it.
 */
export interface BaggageAllowance {
  airline: string;
  cabinKg: number;
  checkedKg: number;
  note?: string;
}

/** Typical economy allowances. Fare class and route can change these. */
const BAGGAGE: Record<string, BaggageAllowance> = {
  AI: { airline: "Air India", cabinKg: 8, checkedKg: 25, note: "2 × 23 kg on Americas routes" },
  TG: { airline: "Thai Airways", cabinKg: 7, checkedKg: 30 },
  SQ: { airline: "Singapore Airlines", cabinKg: 7, checkedKg: 30 },
  NH: { airline: "ANA", cabinKg: 10, checkedKg: 46, note: "2 × 23 kg on international routes" },
  JL: { airline: "Japan Airlines", cabinKg: 10, checkedKg: 46, note: "2 × 23 kg on international routes" },
  BA: { airline: "British Airways", cabinKg: 23, checkedKg: 23, note: "Cabin bag has no separate weight tier on most fares" },
  EK: { airline: "Emirates", cabinKg: 7, checkedKg: 25 },
  QR: { airline: "Qatar Airways", cabinKg: 7, checkedKg: 25 },
  "6E": { airline: "IndiGo", cabinKg: 7, checkedKg: 15, note: "Domestic allowance" },
};

/** Reads the carrier from a flight number like "AI142" or "6E 204". */
export function baggageForFlight(flightNumber: string): BaggageAllowance | undefined {
  const code = flightNumber.trim().toUpperCase().match(/^([A-Z0-9]{2})/)?.[1];
  return code ? BAGGAGE[code] : undefined;
}

export interface DutyFreeAllowance extends Money {
  note: string;
}

/** What a returning resident may bring in before duty is charged. */
const DUTY_FREE: Record<string, DutyFreeAllowance> = {
  IN: { amount: 50000, currency: "INR", note: "Residents returning after more than three days" },
  US: { amount: 800, currency: "USD", note: "Per returning resident" },
  GB: { amount: 390, currency: "GBP", note: "Goods carried in accompanied baggage" },
  AU: { amount: 900, currency: "AUD", note: "Per traveller aged 18 or over" },
  SG: { amount: 500, currency: "SGD", note: "For trips over 48 hours" },
  JP: { amount: 200000, currency: "JPY", note: "Total value of goods brought in" },
};

export function dutyFreeAllowance(countryCode: string): DutyFreeAllowance | undefined {
  return DUTY_FREE[countryCode.toUpperCase()];
}
