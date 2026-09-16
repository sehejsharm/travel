"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "./ui";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "manifest.install.dismissed";

/**
 * Installing is the difference between a website and the thing this claims to
 * be: opening instantly from the home screen, and working with no signal.
 * Chrome hands us the prompt; iOS does not, so there it explains the two taps
 * instead of pretending there is a button.
 */
/**
 * Read once on the client. Done through an external store rather than in an
 * effect, so it never causes a render pass that immediately schedules another.
 */
const noop = () => () => undefined;

function readPlatform(): "chromium" | "ios-safari" | "hidden" {
  try {
    if (localStorage.getItem(DISMISSED)) return "hidden";
  } catch {
    // A blocked store just means we ask again next time.
  }

  // Already installed: nothing to offer.
  if (window.matchMedia("(display-mode: standalone)").matches) return "hidden";

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  return isIos && isSafari ? "ios-safari" : "chromium";
}

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const platform = useSyncExternalStore(noop, readPlatform, () => "hidden" as const);

  useEffect(() => {
    const onPrompt = (incoming: Event) => {
      incoming.preventDefault();
      setEvent(incoming as InstallEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const iosHint = platform === "ios-safari";

  // Chromium only earns the card once it has actually offered us the prompt.
  if (dismissed || platform === "hidden" || (!iosHint && !event)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Not worth failing the dismissal over.
    }
    setDismissed(true);
  }

  return (
    <Card className="flex items-start gap-3 border-accent/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Put Manifest on your home screen</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
          {iosHint
            ? "Tap the share button, then “Add to Home Screen”. It opens instantly and works with no signal."
            : "It opens instantly, runs full screen, and works with no signal."}
        </p>

        <div className="mt-2.5 flex items-center gap-3">
          {event && (
            <button
              type="button"
              onClick={async () => {
                await event.prompt();
                await event.userChoice;
                setDismissed(true);
              }}
              className="press rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent-ink"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="press font-mono text-[10px] text-ink-faint underline"
          >
            no thanks
          </button>
        </div>
      </div>
    </Card>
  );
}
