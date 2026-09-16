/**
 * When to ask for a review, and how.
 *
 * The "how" is constrained: StoreKit's `requestReview` and Play's In-App
 * Review API are native, and Manifest runs in a browser. So this asks the
 * native shell when one is present — a Capacitor or TWA wrapper can expose
 * `window.manifestNative.requestReview()` — and otherwise opens the listing.
 * A raw link-out is the worse option, which is why it is only the fallback.
 */

const ASKED = "manifest.review.asked";
const DECLINED = "manifest.review.declined";

/** Both stores rate-limit their own prompts; asking twice a year is plenty. */
const COOL_OFF_DAYS = 180;

export interface ReviewMoment {
  /** Why now — shown to the user, so it has to be a real accomplishment. */
  reason: string;
}

interface NativeBridge {
  requestReview?: () => Promise<void> | void;
}

declare global {
  interface Window {
    manifestNative?: NativeBridge;
  }
}

export function canAsk(now = new Date()): boolean {
  try {
    if (localStorage.getItem(DECLINED)) return false;

    const asked = localStorage.getItem(ASKED);
    if (!asked) return true;

    const days = (now.getTime() - Number(asked)) / 86_400_000;
    return days > COOL_OFF_DAYS;
  } catch {
    // No storage means no memory of asking, so do not ask at all.
    return false;
  }
}

/**
 * The moment has to be earned. Asking mid-planning, or while something is
 * still broken, is how an app gets one star for the prompt itself.
 */
export function reviewMoment({
  criticalOpen,
  criticalSettled,
  itemCount,
  tripEnded,
}: {
  criticalOpen: number;
  criticalSettled: number;
  itemCount: number;
  tripEnded: boolean;
}): ReviewMoment | undefined {
  if (tripEnded && itemCount >= 5) {
    return { reason: "You just finished a trip that Manifest kept together." };
  }

  if (criticalOpen === 0 && criticalSettled >= 3) {
    return { reason: "Everything that had to be fixed before you fly is done." };
  }

  return undefined;
}

export function remember(outcome: "asked" | "declined"): void {
  try {
    if (outcome === "declined") localStorage.setItem(DECLINED, "1");
    else localStorage.setItem(ASKED, String(Date.now()));
  } catch {
    // Not worth failing over.
  }
}

export const STORE_LISTING_URL =
  process.env.NEXT_PUBLIC_STORE_URL ?? "https://apps.apple.com/app/manifest-trip-planner";

/** Native first, listing second. Returns how it was handled, for telemetry-free logging. */
export async function requestReview(): Promise<"native" | "listing"> {
  const native = typeof window !== "undefined" ? window.manifestNative : undefined;

  if (native?.requestReview) {
    await native.requestReview();
    return "native";
  }

  window.open(STORE_LISTING_URL, "_blank", "noreferrer");
  return "listing";
}
