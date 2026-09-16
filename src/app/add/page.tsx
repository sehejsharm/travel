"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Card, Chip, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { prepareImage, requestExtraction, sourceForText, type CaptureImage } from "@/lib/capture";
import { SOURCE_LABELS, type TripItem } from "@/lib/domain/types";
import type { ExtractionResult, ItemDraft } from "@/lib/extract/types";
import { formatMoney } from "@/lib/reference/fx";
import { addItem, startTripFromDraft, updateItem } from "@/lib/store/state";
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
  // Arriving from the OS share sheet, the content is already in the URL.
  const [text, setText] = useState(() =>
    [shared.get("title"), shared.get("text"), shared.get("url")].filter(Boolean).join("\n"),
  );
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
  useEffect(() => {
    async function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;

      event.preventDefault();
      await loadImage(file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  if (!hydrated) return <ScreenSkeleton variant="list" />;

  async function loadImage(file: File) {
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
    const target = trip ?? { id: startTripFromDraft(result.draft), travelers: [] };

    addItem(target.id, result.draft, {
      confidence: result.confidence,
      extractionMethod: result.method,
      addedBy: target.travelers[0]?.id,
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
        meta="A screenshot, a Reel link, a booking email, or a scribbled note. It gets read, filed and checked."
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

      {image ? (
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
          <div className="grid grid-cols-3 gap-2">
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
          </div>

          <p className="mt-3 text-center text-xs text-ink-faint">
            Drop a screenshot here, or paste one straight onto this screen
          </p>
        </div>
      )}

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

        {filed && (
          <Card className="animate-pop border-teal p-4 text-sm">
            Filed <span className="font-medium">{filed}</span>.{" "}
            <Link href="/cabinet" className="text-accent-strong underline">
              See it in the cabinet
            </Link>
          </Card>
        )}

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
    </div>
  );
}

function CaptureButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex flex-col items-center gap-2 rounded-xl border border-line bg-bg-elevated px-2 py-3.5 text-xs font-medium hover:border-accent hover:text-accent-strong"
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">Preview</h2>
        <Chip tone={result.method === "llm" ? "accent" : "neutral"}>
          {result.method === "llm" ? "model pass" : "pattern pass"}
        </Chip>
      </div>

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

      {startsTrip && (
        <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-ink-faint">
          You have no trip open. This builds one around what was found — you can rename it and
          fill in the dates after.
        </p>
      )}
    </Card>
  );
}

/**
 * Shown instead of the file button when something very like this is already
 * in the cabinet. Neither answer is presumed: merging fills the gaps in what
 * is filed, keeping both leaves the cabinet exactly as the traveller expects.
 */
function DuplicateChoice({
  draft,
  matches,
  onMerge,
  onKeepBoth,
  onCancel,
}: {
  draft: ItemDraft;
  matches: DuplicateMatch[];
  onMerge: (item: TripItem) => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="animate-rise border-accent p-4">
      <p className="text-sm font-medium">
        You may already have {matches.length === 1 ? "this" : "one of these"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        “{draft.title}” looks like something already filed. Merging keeps what you have and fills
        in anything it was missing.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {matches.map((match) => (
          <li
            key={match.item.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{match.item.title}</span>
              <span className="block font-mono text-[10px] text-ink-faint">{match.reason}</span>
            </span>
            <button
              type="button"
              onClick={() => onMerge(match.item)}
              className="press shrink-0 rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent-ink"
            >
              Merge into this
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onKeepBoth}
          className="press rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft"
        >
          Keep both
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="press font-mono text-[10px] text-ink-faint underline"
        >
          back
        </button>
      </div>
    </Card>
  );
}
