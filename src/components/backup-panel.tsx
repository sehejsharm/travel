"use client";

import { useEffect, useRef, useState } from "react";
import {
  backupFilename,
  buildBackup,
  parseBackup,
  restore,
  type Backup,
  type RestoreMode,
} from "@/lib/store/backup";
import { storageFootprint, wipeEverything } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
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

  async function pick(file: File) {
    setMessage(undefined);
    const parsed = parseBackup(await file.text());

    if ("error" in parsed) {
      setError(parsed.error);
      setPending(null);
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
        <p className="text-sm font-medium">Back up your trips</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Everything is stored in this browser and nowhere else. Clearing site data, reinstalling,
          or switching phones takes it with them — a backup file is how it survives.
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-ink-faint tabular">
        <div className="flex gap-1.5">
          <dt>this trip data</dt>
          <dd className="text-ink-soft">{formatBytes(footprint.bytes)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>items filed</dt>
          <dd className="text-ink-soft">{footprint.items}</dd>
        </div>
        {quota && (
          <div className="flex gap-1.5">
            <dt>site total</dt>
            <dd className={nearFull ? "text-critical" : "text-ink-soft"}>
              {formatBytes(quota.usage)} of {formatBytes(quota.quota)}
            </dd>
          </div>
        )}
      </dl>

      {nearFull && (
        <p className="rounded-lg bg-[var(--critical-soft)] px-2.5 py-1.5 text-xs text-critical">
          This site is near its storage limit. Export a backup now — the browser may start evicting
          data.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="press rounded-xl bg-accent px-3.5 py-2 font-mono text-[11px] text-accent-ink"
        >
          Export backup
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="press rounded-xl border border-line px-3.5 py-2 font-mono text-[11px] text-ink-soft"
        >
          Restore from file
        </button>
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
        <div className="rounded-xl border border-accent bg-accent-soft p-3">
          <p className="text-xs leading-relaxed">
            That backup holds {pending.state.trips.length} trip(s) and {pending.state.items.length}{" "}
            filed item(s)
            {pending.exportedAt && `, saved ${pending.exportedAt.slice(0, 10)}`}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => apply("merge")}
              className="press rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] uppercase text-accent-ink"
            >
              Add to what I have
            </button>
            <button
              type="button"
              onClick={() => apply("replace")}
              className="press rounded-lg border border-critical px-3 py-1.5 font-mono text-[10px] uppercase text-critical"
            >
              Replace everything
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="press font-mono text-[10px] text-ink-faint underline"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-ok">{message}</p>}
      {error && <p className="text-xs text-critical">{error}</p>}

      <div className="border-t border-line pt-3">
        <button
          type="button"
          onClick={() => {
            if (!confirmWipe) {
              setConfirmWipe(true);
              return;
            }
            wipeEverything();
            setConfirmWipe(false);
            setMessage("Everything on this device has been deleted.");
          }}
          className={`press font-mono text-[10px] underline ${
            confirmWipe ? "text-critical" : "text-ink-faint hover:text-critical"
          }`}
        >
          {confirmWipe ? "Tap again to delete every trip on this device" : "Delete all my data"}
        </button>
        {confirmWipe && (
          <button
            type="button"
            onClick={() => setConfirmWipe(false)}
            className="press ml-3 font-mono text-[10px] text-ink-faint underline"
          >
            cancel
          </button>
        )}
      </div>
    </Card>
  );
}
