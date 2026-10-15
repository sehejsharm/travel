"use client";

import { useState, useSyncExternalStore } from "react";
import { canAsk, remember, requestReview, reviewMoment } from "@/lib/review";
import { BorderlessButton, SecondaryButton } from "./form";
import { Card } from "./ui";

function noop() {
  return () => undefined;
}

/**
 * Asked once, at a moment the app has actually earned — never on a timer and
 * never while something is still broken.
 */
export function ReviewPrompt({
  criticalOpen,
  criticalSettled,
  itemCount,
  tripEnded,
}: {
  criticalOpen: number;
  criticalSettled: number;
  itemCount: number;
  tripEnded: boolean;
}) {
  const eligible = useSyncExternalStore(noop, canAsk, () => false);
  const [done, setDone] = useState(false);

  const moment = reviewMoment({ criticalOpen, criticalSettled, itemCount, tripEnded });
  if (!eligible || done || !moment) return null;

  return (
    <Card className="animate-rise flex items-start gap-3 border-accent/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-headline">{moment.reason}</p>
        <p className="mt-1 text-subheadline text-ink-soft">
          If Manifest helped, a review is the only way other travellers find it — there is no
          marketing budget behind this.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={async () => {
              remember("asked");
              setDone(true);
              await requestReview();
            }}
          >
            Leave a review
          </SecondaryButton>
          <BorderlessButton
            type="button"
            onClick={() => {
              remember("declined");
              setDone(true);
            }}
          >
            don&rsquo;t ask again
          </BorderlessButton>
        </div>
      </div>
    </Card>
  );
}
