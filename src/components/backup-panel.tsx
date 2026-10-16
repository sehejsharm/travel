"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  backupFilename,
  backupSizeError,
  buildBackup,
  restore,
  type Backup,
  type RestoreMode,
} from "@/lib/store/backup";
import { storageFootprint, wipeEverything } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import { BorderlessButton, DestructiveButton, PrimaryButton, SecondaryButton } from "./form";
import { Card } from "./ui";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The counterweight to storing everything locally: a file the user keeps, and
 * an honest read on how much room the trip is taking. Without this, "clear
 * browsing data" is an unrecoverable delete.
 */
export function BackupPanel() {
  const { state } = useTripView();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [quota, setQuota] = useState<{ usage: number; quota: number }>();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const errorId = useId();

  const footprint = storageFootprint();

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (estimate.usage !== undefined && estimate.quota !== undefined) {
          setQuota({ usage: estimate.usage, quota: estimate.quota });
        }
      })
      .catch(() => {
        // Firefox in private mode refuses; the local figure still stands.
      });
  }, [state]);

  function download() {
    const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Saved ${backupFilename()}.`);
    setError(undefined);
  }

  function refuse(reason: string) {
    setError(reason);
    setPending(null);
  }

  async function pick(file: File) {
    setMessage(undefined);

    // Checked before reading: a wrong pick (a video, a disk image) would
    // otherwise be pulled into memory whole just to be turned away.
    const tooLarge = backupSizeError(file.size);
    if (tooLarge) {
      refuse(tooLarge);
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      refuse("That file could not be read. Try saving it to this device first.");
      return;
    }

    // The checker (and zod with it) loads only when a file is actually restored.
    const { parseBackup } = await import("@/lib/store/backup-parse");
    const parsed = parseBackup(text);
    if ("error" in parsed) {
      refuse(parsed.error);
      return;
    }

    setError(undefined);
    setPending(parsed);
  }

  function apply(mode: RestoreMode) {
    if (!pending) return;
    restore(pending, mode);
    setMessage(
      mode === "merge"
        ? `Merged ${pending.state.trips.length} trip(s) into what you had.`
        : `Replaced everything with ${pending.state.trips.length} trip(s).`,
    );
    setPending(null);
  }

  const nearFull = quota ? quota.usage / quota.quota > 0.8 : false;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-headline">Back up your trips</p>
        <p className="mt-1 text-footnote text-ink-soft">
          Everything is stored in this browser and nowhere else. Clearing site data, reinstalling,
          or switching phones takes it with them — a backup file is how it survives.
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-soft tabular">
        <div className="flex gap-1">
          <dt>this trip data</dt>
          <dd className="text-ink">{formatBytes(footprint.bytes)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>items filed</dt>
          <dd className="text-ink">{footprint.items}</dd>
        </div>
        {quota && (
          <div className="flex gap-1">
            <dt>site total</dt>
            <dd className={nearFull ? "text-critical" : "text-ink"}>
              {formatBytes(quota.usage)} of {formatBytes(quota.quota)}
            </dd>
          </div>
        )}
      </dl>

      {nearFull && (
        <p className="rounded-control bg-critical-soft px-3 py-2 text-footnote text-critical">
          This site is near its storage limit. Export a backup now — the browser may start evicting
          data.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton type="button" onClick={download}>
          Export backup
        </SecondaryButton>
        <BorderlessButton
          type="button"
          onClick={() => input.current?.click()}
          aria-describedby={error ? errorId : undefined}
        >
          Restore from file
        </BorderlessButton>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pick(file);
            event.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div className="rounded-control border border-accent bg-accent-soft p-3">
          <p className="text-footnote">
            That backup holds {pending.state.trips.length} trip(s) and {pending.state.items.length}{" "}
            filed item(s)
            {pending.exportedAt && `, saved ${pending.exportedAt.slice(0, 10)}`}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <PrimaryButton type="button" onClick={() => apply("merge")} className="sm:w-auto">
              Add to what I have
            </PrimaryButton>
            <DestructiveButton type="button" onClick={() => apply("replace")}>
              Replace everything
            </DestructiveButton>
            <BorderlessButton type="button" onClick={() => setPending(null)}>
              Cancel
            </BorderlessButton>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-footnote text-ok">
          {message}
        </p>
      )}
      {/* Announced as it lands: the file picker has closed by then, and focus did not move. */}
      {error && (
        <p id={errorId} role="alert" className="text-footnote text-critical">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => {
            if (!confirmWipe) {
              setConfirmWipe(true);
              return;
            }
            wipeEverything();
            setConfirmWipe(false);
            setMessage("Every trip on this device has been deleted.");
          }}
          className={`press -ml-3 inline-flex min-h-11 items-center rounded-control px-3 py-2 text-left text-subheadline font-medium hover:bg-critical-soft ${
            confirmWipe ? "text-critical" : "text-ink-soft hover:text-critical"
          }`}
        >
          {confirmWipe ? "Tap again to delete every trip on this device" : "Delete all my data"}
        </button>
        {confirmWipe && (
          <BorderlessButton type="button" onClick={() => setConfirmWipe(false)}>
            Cancel
          </BorderlessButton>
        )}
      </div>
    </Card>
  );
}
