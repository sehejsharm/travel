"use client";

import { useState } from "react";
import {
  checkForUpdate,
  OFFICIAL_SOURCES,
  referenceFreshness,
  type UpdateOutcome,
} from "@/lib/reference/freshness";
import { SecondaryButton } from "./form";
import { Card } from "./ui";

const OUTCOMES: Record<UpdateOutcome["status"], string> = {
  updated: "A newer build is downloading. Reopen Manifest to pick it up.",
  current: "You already have the latest build, so this is the newest data there is.",
  offline: "No connection — try again when you have signal.",
  unsupported: "This browser cannot check for updates. Reload the page to fetch the latest build.",
};

/**
 * The checks quote dated figures, so this says how dated, and offers the only
 * refresh that is real: pulling a newer build of the app. There is no
 * reference-data service behind Manifest to re-query — the numbers ship with
 * the bundle — so the other half of the answer is pointing at who is
 * authoritative.
 */
export function ReferenceFreshness() {
  const [outcome, setOutcome] = useState<UpdateOutcome>();
  const [busy, setBusy] = useState(false);

  const freshness = referenceFreshness();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-headline">Reference data</p>
        <span
          className={`text-caption tabular ${freshness.stale ? "text-warning" : "text-ink-soft"}`}
        >
          verified {freshness.verifiedOn} · {freshness.ageDays} days old
        </span>
      </div>

      <p className="mt-2 text-footnote text-ink-soft">
        Entry rules, health advice, allowances and exchange rates ship inside the app rather than
        being fetched, which is what lets the checks run with no signal. Re-checking pulls a newer
        build of Manifest if one exists; it cannot make the numbers newer than the build.
      </p>

      {freshness.stale && (
        <p className="mt-2 rounded-control bg-warning-soft px-3 py-2 text-footnote text-warning">
          This data is more than 90 days old. Treat every visa and health finding as a prompt to
          confirm, not as an answer.
        </p>
      )}

      <SecondaryButton
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setOutcome(await checkForUpdate());
          setBusy(false);
        }}
        className="mt-3"
      >
        {busy ? "Checking…" : "Re-check reference data"}
      </SecondaryButton>

      {outcome && <p className="mt-2 text-footnote text-ink-soft">{OUTCOMES[outcome.status]}</p>}

      <ul className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
        {OFFICIAL_SOURCES.map((source) => (
          <li key={source.label} className="flex flex-col items-start">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="press tap text-subheadline text-accent-strong underline underline-offset-2"
            >
              {source.label} ↗
            </a>
            <span className="text-caption text-ink-soft">{source.covers}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
