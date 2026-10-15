import type { Metadata } from "next";
import Link from "next/link";
import { BORDERLESS_BUTTON_CLASSES, PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Card } from "@/components/ui";

/*
 * Absolute, because the root layout's template does not reach this file: Next
 * treats it as part of the root segment, like the home page. Next adds
 * noindex to any page answered with a 404 status.
 */
export const metadata: Metadata = {
  title: { absolute: "Page not found · Manifest" },
  description: "There is nothing at this address.",
};

/**
 * Any address the app has no screen for. It renders inside the app shell, so
 * the tabs are still there, and it reads like the app's empty states: an
 * icon, a title, why, and the one thing to do next.
 */
export default function NotFound() {
  return (
    <Card className="raised flex flex-col items-center gap-2 px-6 py-10 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="animate-float mb-2">
        {/* The mark's stub, drawn at a thin stroke the way an SF Symbol is, with a question in it. */}
        <path
          d="M6 10.5h36v7.9a5.6 5.6 0 0 0 0 11.2v7.9H6v-7.9a5.6 5.6 0 0 0 0-11.2z"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 20.5a3.5 3.5 0 1 1 4.9 3.2c-.9.4-1.4 1.1-1.4 2.1v.7"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="30.5" r="1" fill="var(--ink-faint)" />
      </svg>

      <h1 className="text-title-3">Nothing at this address</h1>
      <p className="max-w-sm text-subheadline text-ink-soft">
        The link may be mistyped or out of date. Anything you have filed is still on this device.
      </p>

      <div className="mt-4 w-full max-w-xs">
        <Link href="/" className={PRIMARY_BUTTON_CLASSES}>
          Go to your trip
        </Link>
      </div>

      {/* The legal pages are the only other pages that say the same thing to everyone. */}
      <nav aria-label="Legal" className="mt-2 flex flex-wrap justify-center gap-1">
        <Link href="/legal/privacy" className={BORDERLESS_BUTTON_CLASSES}>
          Privacy policy
        </Link>
        <Link href="/legal/terms" className={BORDERLESS_BUTTON_CLASSES}>
          Terms of use
        </Link>
      </nav>
    </Card>
  );
}
