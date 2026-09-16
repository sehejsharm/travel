/**
 * Every figure the checks quote — visa rules, vaccination advice, duty-free
 * allowances, exchange rates — ships inside the app bundle. There is no
 * backend to poll, so "refresh" honestly means "fetch a newer build of the
 * app", and the only other thing we can do is be blunt about how old the
 * current numbers are and point at who is authoritative.
 */

export const REFERENCE_VERIFIED = "2026-08-01";

/** Past this, the data is old enough that quoting it without a caveat is wrong. */
const STALE_AFTER_DAYS = 90;

export interface Freshness {
  verifiedOn: string;
  ageDays: number;
  stale: boolean;
}

export function referenceFreshness(now = new Date()): Freshness {
  const verified = Date.parse(`${REFERENCE_VERIFIED}T00:00:00Z`);
  const ageDays = Math.max(0, Math.floor((now.getTime() - verified) / 86_400_000));

  return { verifiedOn: REFERENCE_VERIFIED, ageDays, stale: ageDays > STALE_AFTER_DAYS };
}

/** Where to actually confirm a rule, per country, when it matters. */
export const OFFICIAL_SOURCES: { label: string; url: string; covers: string }[] = [
  {
    label: "IATA Travel Centre",
    url: "https://www.iatatravelcentre.com/",
    covers: "Entry rules, visas and transit, by passport and destination",
  },
  {
    label: "WHO international travel and health",
    url: "https://www.who.int/travel-advice",
    covers: "Vaccination and health requirements",
  },
  {
    label: "Your own government's travel advice",
    url: "https://www.google.com/search?q=official+government+travel+advice",
    covers: "Advisories, and the rules that apply to your nationality",
  },
];

export type UpdateOutcome =
  | { status: "unsupported" }
  | { status: "current" }
  | { status: "updated" }
  | { status: "offline" };

/**
 * Asks the service worker to look for a newer build. If one lands, the page
 * reloads onto it and the bundled reference data comes with it.
 */
export async function checkForUpdate(): Promise<UpdateOutcome> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  if (!navigator.onLine) return { status: "offline" };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { status: "unsupported" };

    await registration.update();
    return registration.installing || registration.waiting
      ? { status: "updated" }
      : { status: "current" };
  } catch {
    return { status: "offline" };
  }
}
