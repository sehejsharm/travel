"use client";

import { useState, useTransition } from "react";
import { fileItem } from "@/app/actions";
import { runExtraction } from "@/app/mailroom/actions";
import { SOURCE_LABELS, type SourceKind, type Traveler } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import type { ExtractionResult } from "@/lib/extract/types";

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

export function MailroomForm({
  escalationAvailable,
  travelers,
}: {
  escalationAvailable: boolean;
  travelers: Traveler[];
}) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [source, setSource] = useState<SourceKind>("gmail");
  const [addedBy, setAddedBy] = useState(travelers[0]?.id ?? "");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const [filing, startFile] = useTransition();

  function extract() {
    setFiled(null);
    startExtract(async () => {
      setResult(await runExtraction(text, source));
    });
  }

  function file() {
    if (!result) return;
    const title = result.draft.title;
    startFile(async () => {
      await fileItem(result, addedBy || undefined);
      setResult(null);
      setText("");
      setFiled(title);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setText(sample.text);
                setSource(sample.source);
                setResult(null);
                setFiled(null);
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={12}
          placeholder="Paste a booking email, screenshot text, or a caption…"
          className="w-full resize-y rounded-md border border-line bg-surface p-3.5 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as SourceKind)}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
            >
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {SOURCE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          {travelers.length > 1 && (
            <label className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
              Filing as
              <select
                value={addedBy}
                onChange={(event) => setAddedBy(event.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
              >
                {travelers.map((traveler) => (
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
            disabled={extracting || text.trim().length === 0}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {extracting ? "Extracting…" : "Extract and ground"}
          </button>
        </div>

        <p className="font-mono text-[11px] text-ink-faint">
          {escalationAvailable
            ? "Model escalation is available for low-confidence content."
            : "No ANTHROPIC_API_KEY set — low-confidence content stays on the pattern pass."}
        </p>
      </section>

      <section aria-live="polite">
        {filed && (
          <p className="rounded-md border border-accent-2 bg-accent-2/10 p-4 text-sm">
            Filed <span className="font-medium">{filed}</span>. It is in the cabinet and the checks
            have re-run.
          </p>
        )}

        {!filed && !result && (
          <p className="rounded-md border border-dashed border-line p-4 text-sm text-ink-soft">
            The extraction preview shows up here — every field it found, and how confident it is,
            before anything is filed.
          </p>
        )}

        {result && <Preview result={result} onFile={file} filing={filing} />}
      </section>
    </div>
  );
}

function Preview({
  result,
  onFile,
  filing,
}: {
  result: ExtractionResult;
  onFile: () => void;
  filing: boolean;
}) {
  const { draft, confidence, method } = result;
  const percent = Math.round(confidence * 100);

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
    <div className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Extraction preview</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          {method === "llm" ? "model pass" : "pattern pass"}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between font-mono text-[11px] text-ink-soft">
          <span>confidence</span>
          <span className="tabular">{percent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-surface-2">
          <div
            className={percent >= 60 ? "h-full bg-accent-2" : "h-full bg-warning"}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {result.link && (
        <p className="mt-3 rounded-md border border-accent-2 bg-accent-2/10 p-2.5 font-mono text-[11px]">
          Detected {result.link.platform} link — source set automatically.{" "}
          {result.link.metadataFetched
            ? "Pulled the title from the platform."
            : "The platform did not serve metadata, so only your caption was read."}
        </p>
      )}

      {result.escalationReason && (
        <p className="mt-3 rounded-md border border-line bg-surface-2 p-2.5 font-mono text-[11px] text-ink-soft">
          {result.escalationReason}
        </p>
      )}

      <dl className="mt-4 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 bg-surface px-3 py-1.5">
            <dt className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              {label}
            </dt>
            <dd className="min-w-0 flex-1 break-words text-xs">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onFile}
        disabled={filing}
        className="mt-4 w-full rounded-md bg-accent-2 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {filing ? "Filing…" : "File it"}
      </button>
    </div>
  );
}
