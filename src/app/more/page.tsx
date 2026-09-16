"use client";

import Link from "next/link";
import { useState } from "react";
import { BackupPanel } from "@/components/backup-panel";
import { LEGAL_PAGES } from "@/components/legal";
import { InstallPrompt } from "@/components/install-prompt";
import { Card, EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle } from "@/components/ui";
import { toCalendar } from "@/lib/calendar";
import { buildShareLink, type ShareLink } from "@/lib/share";
import { useTripView } from "@/lib/store/use-store";
import { destinationBriefs } from "@/lib/rules";

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MoreScreen() {
  const { trip, items, hydrated } = useTripView();
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [shareLink, setShareLink] = useState<ShareLink>();

  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    return <EmptyState title="No trip yet" body="Create a trip first and this fills in." />;
  }

  const briefs = destinationBriefs({ trip, items, now: new Date() });

  async function share() {
    try {
      const link = await buildShareLink(trip!, items, window.location.origin);
      setShareLink(link);

      // A link this long will not survive being pasted; do not pretend it will.
      if (link.size === "too-big") {
        setShareState("failed");
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: trip!.name, url: link.url });
        setShareState("idle");
        return;
      }

      await navigator.clipboard.writeText(link.url);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader eyebrow="More" title={trip.name} meta="Export, share, and what is on the ground." />

      <section>
        <SectionTitle>Take it with you</SectionTitle>
        <Card className="divide-y divide-line">
          <button
            type="button"
            onClick={() =>
              download(
                `${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`,
                toCalendar(trip, items),
                "text/calendar;charset=utf-8",
              )
            }
            className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span>
              <span className="text-sm font-medium">Push to calendar</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Downloads an .ics any calendar app reads
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↓</span>
          </button>

          <button
            type="button"
            onClick={share}
            className="press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span>
              <span className="text-sm font-medium">Share the plan</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {shareState === "copied"
                  ? "Link copied — prices and confirmations are stripped out"
                  : shareState === "failed"
                    ? "This trip is too big to fit in a link"
                    : "A read-only link, held in the URL itself"}
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↗</span>
          </button>

          {shareLink && shareLink.size !== "safe" && (
            <p className="px-4 py-3 text-xs leading-relaxed text-warning">
              {shareLink.size === "too-big" ? (
                <>
                  The whole trip comes to {shareLink.length.toLocaleString()} characters, which is
                  past what a link survives being pasted into. Export a backup from This device and
                  send the file instead, or schedule fewer items onto days and share again.
                </>
              ) : (
                <>
                  This link is {shareLink.length.toLocaleString()} characters. It will open fine,
                  but some chat apps and email clients cut long links — check it arrived whole.
                </>
              )}
            </p>
          )}

          {shareLink?.trimmedTo !== undefined && shareState === "copied" && (
            <p className="px-4 py-3 text-xs leading-relaxed text-ink-soft">
              The full trip was too long for a reliable link, so this one carries the{" "}
              {shareLink.trimmedTo} scheduled items. Unscheduled ideas were left out.
            </p>
          )}

          <Link href="/recap" className="press flex items-center justify-between gap-3 px-4 py-3.5">
            <span>
              <span className="text-sm font-medium">Trip recap</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Spend, places, and where each item came from
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">→</span>
          </Link>
        </Card>
      </section>

      {briefs.length > 0 && (
        <section>
          <SectionTitle>On the ground</SectionTitle>
          <Card className="divide-y divide-line">
            {briefs.map(({ country, hoursFromHome }) => (
              <div key={country.code} className="px-4 py-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-teal">
                  {country.name}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Emergency {country.emergency} · {country.currency} · plugs Type{" "}
                  {country.plugTypes.join("/")} ·{" "}
                  <span className="tabular">
                    {hoursFromHome > 0 ? "+" : ""}
                    {hoursFromHome}h
                  </span>{" "}
                  from home
                </p>
                <p className="mt-1 text-sm text-ink-soft">{country.tipping}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>This device</SectionTitle>
        <InstallPrompt />
        <BackupPanel />
      </section>

      <section>
        <SectionTitle>Help and legal</SectionTitle>
        <Card className="divide-y divide-line">
          <a
            href="mailto:support@manifest.trip?subject=Manifest%20feedback"
            className="press flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">Help &amp; feedback</span>
              <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                Something wrong, or something missing? Tell us.
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-ink-faint">
              ↗
            </span>
          </a>

          {LEGAL_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="press flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{page.title}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                  {page.blurb}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-ink-faint">
                ›
              </span>
            </Link>
          ))}
        </Card>
      </section>

    </div>
  );
}
