"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { DraftHeading, DuplicateChoice, FiledNotice, StartsTripNote } from "@/components/filing";
import { ManualAddTripItem } from "@/components/manual-add-trip-item";
import { Card, Chip, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { editReadText, setAddMode, takeShare, useAddDraft, type AddMode } from "@/lib/add-draft";
import { prepareImage, requestExtraction, sourceForText, type CaptureImage } from "@/lib/capture";
import { SOURCE_LABELS, type TripItem } from "@/lib/domain/types";
import type { ExtractionResult } from "@/lib/extract/types";
import { fileDraft } from "@/lib/filing";
import { formatMoney } from "@/lib/reference/fx";
import { updateItem } from "@/lib/store/state";
import { findDuplicates, mergeInto, type DuplicateMatch } from "@/lib/dedupe";
import { useTripView } from "@/lib/store/use-store";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Flight email",
    text: `Your Air India booking is confirmed
PNR: 7QW2LM
Passenger: Sehej Sharma
AI 142 · DEL → HND
Departs 14 Oct 2026 19:55
Arrives 15 Oct 2026 07:25
Total paid ₹52,400`,
  },
  {
    label: "Hotel email",
    text: `Booking confirmed at Hotel Gracery
Confirmation number: BK99120
Check-in: 15 Oct 2026, 15:00
Check-out: 22 Oct 2026, 11:00
Total ¥168,000
Free cancellation until 14 Sep 2026`,
  },
  {
    label: "Reel link",
    text: "https://www.instagram.com/reel/C9xArashiyama/",
  },
  {
    label: "A note",
    text: "standing sushi bar in tsukiji, cash only, go before it opens",
  },
];

export default function AddScreen() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AddScreenInner />
    </Suspense>
  );
}

function AddScreenInner() {
  const { trip, items, hydrated } = useTripView();
  const shared = useSearchParams();
  // Arriving from the OS share sheet, the content is in the URL. It is taken
  // into the kept draft — ready to read, whatever way in was last used — and
  // then out of the address, so a reload restores the screen as it was left
  // (the share included, until it is filed) instead of re-offering it forever.
  const sharedText = [shared.get("title"), shared.get("text"), shared.get("url")]
    .filter(Boolean)
    .join("\n");
  const shareInAddress = shared.has("title") || shared.has("text") || shared.has("url");
  useEffect(() => {
    if (!shareInAddress) return;
    const kept = sharedText ? takeShare(sharedText) : true;
    // Native, not a router navigation: the address changes at once, with no
    // request in between for the box to be stuck showing the share, and Next
    // keeps useSearchParams in step with it.
    if (kept) window.history.replaceState(null, "", "/add");
  }, [shareInAddress, sharedText]);

  // Until the share is taken in, the address speaks for it; after, the draft
  // does, even if storage refused it and the address had to stay.
  const draft = useAddDraft();
  const shareWaiting = sharedText !== "" && draft.sharedFrom !== sharedText;
  const text = shareWaiting ? sharedText : draft.text;
  const setText = editReadText;
  const mode: AddMode = shareWaiting ? "drop" : draft.mode;
  const typing = mode === "type";
  const [image, setImage] = useState<CaptureImage | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Pasting a screenshot straight onto the screen is the fastest path there is.
  // Not while typing an item in, where a paste belongs to the field.
  const onPastedImage = useEffectEvent((file: File) => loadImage(file));
  useEffect(() => {
    if (mode !== "drop") return;

    async function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;

      event.preventDefault();
      await onPastedImage(file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode]);

  if (!hydrated) return <ScreenSkeleton variant="list" />;

  function chooseMode(next: AddMode) {
    if (next === mode) return;
    setAddMode(next);
    // What was said about the last filing is not repeated on coming back: it
    // would take the focus from the button just pressed.
    setFiled(null);
    setDuplicates([]);
  }

  async function loadImage(file: File) {
    // An image arriving, however it came, means it is to be read.
    chooseMode("drop");
    setError(null);
    setFiled(null);
    setResult(null);

    try {
      setImage(await prepareImage(file));
    } catch {
      setError("Could not read that image.");
    }
  }

  async function pasteFromClipboard() {
    chooseMode("drop");
    setError(null);
    try {
      const clipboard = await navigator.clipboard.readText();
      if (clipboard.trim()) {
        setText(clipboard);
        setFiled(null);
      }
    } catch {
      setError("Your browser would not share the clipboard — paste into the box instead.");
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    setFiled(null);

    try {
      setResult(
        await requestExtraction(
          image
            ? { source: "screenshot", image: { data: image.data, mediaType: image.mediaType } }
            : { text, source: sourceForText(text) },
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function file(force = false) {
    if (!result) return;

    // The same booking often arrives twice — email, then a screenshot of it.
    if (!force && trip) {
      const found = findDuplicates(result.draft, items);
      if (found.length > 0) {
        setDuplicates(found);
        return;
      }
    }

    // With no trip yet, the thing you just filed becomes the start of one.
    fileDraft(trip, result.draft, {
      confidence: result.confidence,
      extractionMethod: result.method,
    });
    clear(result.draft.title);
  }

  function merge(into: TripItem) {
    if (!result) return;
    updateItem(into.id, mergeInto(into, result.draft));
    clear(`${into.title} (merged)`);
  }

  function clear(label: string) {
    setFiled(label);
    setDuplicates([]);
    setResult(null);
    setText("");
    setImage(null);
  }

  const ready = image !== null || text.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow="Add"
        title="Drop anything in"
        meta="A screenshot, a Reel link, a booking email, or a scribbled note — or type it in yourself. It gets filed and checked."
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        aria-label="Choose a screenshot"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void loadImage(chosen);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void loadImage(chosen);
          event.target.value = "";
        }}
      />

      {image && !typing ? (
        <Card className="animate-pop overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.previewUrl} alt="Screenshot to read" className="max-h-72 w-full object-contain bg-surface-2" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate font-mono text-[11px] text-ink-faint">
              {image.name}
            </span>
            <button
              type="button"
              onClick={() => setImage(null)}
              className="press font-mono text-[11px] text-ink-faint underline hover:text-critical"
            >
              remove
            </button>
          </div>
        </Card>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) void loadImage(dropped);
          }}
          className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${
            dragging ? "border-accent bg-accent-soft" : "border-line bg-surface"
          }`}
        >
          {/* Two by two on a phone: four across, "Screenshot" no longer fits its button. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CaptureButton
              label="Screenshot"
              onClick={() => fileInput.current?.click()}
              icon={
                <>
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="m5 17 4.5-4 3.5 3 2.5-2L21 17" />
                </>
              }
            />
            <CaptureButton
              label="Camera"
              onClick={() => cameraInput.current?.click()}
              icon={
                <>
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                  <circle cx="12" cy="13" r="3.2" />
                </>
              }
            />
            <CaptureButton
              label="Paste"
              onClick={pasteFromClipboard}
              icon={
                <>
                  <rect x="6" y="4" width="12" height="17" rx="2" />
                  <path d="M9.5 4h5v2.5h-5z" />
                </>
              }
            />
            <CaptureButton
              label="Type it in"
              pressed={typing}
              onClick={() => chooseMode(typing ? "drop" : "type")}
              icon={
                <>
                  <path d="M4 20h4L19 9l-4-4L4 16z" />
                  <path d="m13.5 6.5 4 4" />
                </>
              }
            />
          </div>

          <p className="mt-3 text-center text-xs text-ink-faint">
            {typing
              ? "Or drop a screenshot here to have it read instead"
              : "Drop a screenshot here, or paste one straight onto this screen"}
          </p>
        </div>
      )}

      {typing ? (
        <ManualAddTripItem trip={trip} items={items} />
      ) : (
        <>
          <Card className="p-4">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              aria-label="Content to extract"
              placeholder="…or paste a link, an email, or just type what you want to remember"
              className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Chip tone={image ? "accent" : "neutral"}>
                {image ? "screenshot" : SOURCE_LABELS[sourceForText(text)]}
              </Chip>

              <button
                type="button"
                onClick={run}
                disabled={busy || !ready}
                className="press ml-auto rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-40"
              >
                {busy ? "Reading…" : image ? "Read the screenshot" : "Extract"}
              </button>
            </div>
          </Card>

          {!image && !text && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => setText(example.text)}
                  className="press shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  Try: {example.label}
                </button>
              ))}
            </div>
          )}

          <div aria-live="polite" className="flex flex-col gap-3">
            {error && <Card className="border-critical p-4 text-sm text-critical">{error}</Card>}

            {filed && <FiledNotice label={filed} />}

            {result && duplicates.length === 0 && (
              <Preview result={result} onFile={() => file()} startsTrip={!trip} />
            )}

            {result && duplicates.length > 0 && (
              <DuplicateChoice
                draft={result.draft}
                matches={duplicates}
                onMerge={merge}
                onKeepBoth={() => file(true)}
                onCancel={() => setDuplicates([])}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CaptureButton({
  label,
  onClick,
  icon,
  pressed,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  /** Set only on a way in that stays chosen, like typing it in. */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`press flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 text-xs font-medium hover:border-accent hover:text-accent-strong ${
        pressed ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-bg-elevated"
      }`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-accent"
      >
        {icon}
      </svg>
      {label}
    </button>
  );
}

function Preview({
  result,
  onFile,
  startsTrip = false,
}: {
  result: ExtractionResult;
  onFile: () => void;
  /** With no trip open, filing this creates one around it. */
  startsTrip?: boolean;
}) {
  const { draft } = result;
  const percent = Math.round(result.confidence * 100);

  const rows: [string, string][] = [
    ["Title", draft.title],
    ["Category", draft.bookingKind ? `${draft.category} · ${draft.bookingKind}` : draft.category],
    [
      "Place",
      draft.place
        ? `${draft.place.name}${draft.place.point ? " · grounded" : " · no coordinates"}`
        : "—",
    ],
    ["Starts", draft.startsAt ?? "—"],
    ["Ends", draft.endsAt ?? "—"],
    ["Cost", draft.cost ? formatMoney(draft.cost.amount, draft.cost.currency) : "—"],
    ["Confirmation", draft.confirmationCode ?? "—"],
    ["Traveller", draft.travelerName ?? "—"],
    ["Refundable until", draft.refundableUntil ?? "—"],
  ];

  return (
    <Card className="animate-pop p-5">
      <DraftHeading
        title="Preview"
        chip={
          <Chip tone={result.method === "llm" ? "accent" : "neutral"}>
            {result.method === "llm" ? "model pass" : "pattern pass"}
          </Chip>
        }
      />

      <div className="mt-3">
        <div className="flex justify-between font-mono text-[11px] text-ink-soft">
          <span>confidence</span>
          <span className="tabular">{percent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${percent >= 60 ? "bg-teal" : "bg-warning"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {result.link && (
        <div className="mt-3 rounded-xl bg-teal-soft px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-teal">
            {result.link.platform} link
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {result.link.metadataFetched
              ? result.link.caption
                ? `Read the caption: “${result.link.caption.slice(0, 140)}”`
                : "Read the page for its title and caption."
              : "That post would not share its caption — paste the caption text and it will read that instead."}
          </p>
        </div>
      )}

      {result.escalationReason && !result.link && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
          {result.escalationReason}
        </p>
      )}

      <dl className="mt-4 divide-y divide-line border-y border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 py-2">
            <dt className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {label}
            </dt>
            <dd className="min-w-0 flex-1 text-xs break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onFile}
        className="press mt-4 w-full rounded-xl bg-teal px-4 py-2.5 text-sm font-medium text-white"
      >
        {startsTrip ? "Start a new trip from this" : "File it"}
      </button>

      {startsTrip && <StartsTripNote what="what was found" />}
    </Card>
  );
}
