import { COUNTRIES } from "./countries";

/**
 * A sensible "flying from", guessed rather than hardcoded. The browser will
 * not tell us where you are — and we deliberately never ask for location —
 * but the locale and the IANA timezone both carry a region, and between them
 * they are right far more often than a fixed default.
 *
 * It is only ever a default: the field stays editable, and everything it
 * drives (plugs, voltage, duty-free, jet lag) is visible on the same screen.
 */

/** IANA zones whose region is not inferable from the locale alone. */
const ZONE_HINTS: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Riyadh": "SA",
  "Asia/Singapore": "SG",
  "Asia/Bangkok": "TH",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Kuala_Lumpur": "MY",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Lisbon": "PT",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Athens": "GR",
  "Europe/Istanbul": "TR",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Santiago": "CL",
  "America/Lima": "PE",
  "America/Bogota": "CO",
  "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG",
  "Africa/Nairobi": "KE",
  "Africa/Lagos": "NG",
  "Africa/Casablanca": "MA",
};

/** The last resort, used only when neither signal yields a known country. */
export const FALLBACK_HOME = "IN";

function known(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return upper in COUNTRIES ? upper : undefined;
}

/**
 * Split out from the browser lookup so it can be tested without a DOM. Both
 * inputs are optional because both can be absent or unhelpful.
 */
export function homeCountryFrom(locale?: string, timeZone?: string): string {
  // A locale region is the stronger signal when it exists: "en-GB" is a
  // deliberate setting, while a timezone can just be where the laptop booted.
  const region = locale?.split("-")[1];
  const fromLocale = known(region);
  if (fromLocale) return fromLocale;

  const fromZone = known(timeZone ? ZONE_HINTS[timeZone] : undefined);
  if (fromZone) return fromZone;

  return FALLBACK_HOME;
}

/** The browser's best guess, for use as a form default. */
export function detectHomeCountry(): string {
  if (typeof Intl === "undefined") return FALLBACK_HOME;

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return homeCountryFrom(resolved.locale, resolved.timeZone);
  } catch {
    return FALLBACK_HOME;
  }
}
