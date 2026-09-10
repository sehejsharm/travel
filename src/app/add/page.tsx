"use client";

import { useState } from "react";
import { Card, Chip, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { SOURCE_LABELS, type SourceKind } from "@/lib/domain/types";
import type { ExtractionResult } from "@/lib/extract/types";
import { formatMoney } from "@/lib/reference/fx";
import { addItem } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";

const SAMPLES: { label: string; source: SourceKind; text: string }[] = [
  {
    label: "Flight email",
    source: "gmail",
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
    source: "gmail",
    text: `Booking confirmed at Hotel Gracery
Confirmation number: BK99120
Guest name: Sehej Sharma
Check-in: 15 Oct 2026, 15:00
Check-out: 22 Oct 2026, 11:00
Total ¥168,000
Free cancellation until 14 Sep 2026`,
  },
  {
    label: "Reel caption",
    source: "reel",
    text: `this tiny standing sushi bar in tsukiji is unreal 🍣 no reservations, cash only, get there before it opens`,
  },
  {
    label: "Reel link",
    source: "manual",
    text: `https://www.instagram.com/reel/C9xArashiyama/
bamboo grove at 6am before the crowds — free, arrive early`,
  },
];

const SOURCES: SourceKind[] = ["gmail", "screenshot", "reel", "tiktok", "youtube", "manual"];

export default function AddScreen() {
  const { trip, hydrated } = useTripView();
  const [text, setText] = useState(SAMPLES[0].text);
  const [source, setSource] = useState<SourceKind>("gmail");
  const [addedBy, setAddedBy] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hydrated) return <ScreenSkeleton />;

  async function extract() {
    setBusy(true);
    setError(null);
    setFiled(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Extraction failed.");
      setResult(payload as ExtractionResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function file() {
    if (!result) return;
    addItem(result.draft, {
      confidence: result.confidence,
      extractionMethod: result.method,
      addedBy: addedBy || trip.travelers[0]?.id,
    });
    setFiled(result.draft.title);
    setResult(null);
    setText("");
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow="Mailroom"
        title="Drop anything in"
        meta="A booking email, text off a screenshot, a caption, or a Reel link. Pattern matching runs first because it is free; the model is only paid for when that is not confident enough."
      />

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {SAMPLES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => {
              setText(sample.text);
              setSource(sample.source);
              setResult(null);
              setFiled(null);
              setError(null);
            }}
            className="press shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent-strong"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={9}
          aria-label="Content to extract"
          placeholder="Paste a booking email, screenshot text, or a caption…"
          className="w-full resize-y bg-transparent font-mono text-xs leading-relaxed outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as SourceKind)}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
            >
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {SOURCE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          {trip.travelers.length > 1 && (
            <label className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
              As
              <select
                value={addedBy}
                onChange={(event) => setAddedBy(event.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
              >
                {trip.travelers.map((traveler) => (
                  <option key={traveler.id} value={traveler.id}>
                    {traveler.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={extract}
            disabled={busy || text.trim().length === 0}
            className="press ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? "Extracting…" : "Extract"}
          </button>
        </div>
      </Card>

      <div aria-live="polite" className="flex flex-col gap-3">
        {error && (
          <Card className="border-critical p-4 text-sm text-critical">{error}</Card>
        )}

        {filed && (
          <Card className="animate-pop border-teal p-4 text-sm">
            Filed <span className="font-medium">{filed}</span>. The checks have re-run.
          </Card>
        )}

        {result && <Preview result={result} onFile={file} />}
      </div>
    </div>
  );
}

function Preview({ result, onFile }: { result: ExtractionResult; onFile: () => void }) {
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
        <p className="mt-3 rounded-xl bg-teal-soft px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
          Detected {result.link.platform} link — source set for you.{" "}
          {result.link.metadataFetched
            ? "Title pulled from the platform."
            : "That platform will not serve metadata without a token, so only your caption was read."}
        </p>
      )}

      {result.escalationReason && (
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
        File it
      </button>
    </Card>
  );
}
