"use client";

import Link from "next/link";
import { useState } from "react";
import { BackupPanel } from "@/components/backup-panel";
import { LEGAL_PAGES } from "@/components/legal";
import { InstallPrompt } from "@/components/install-prompt";
import { PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Card, EmptyState, ScreenHeader, ScreenSkeleton, SectionTitle } from "@/components/ui";
import { toCalendar } from "@/lib/calendar";
import { CONTACT_EMAIL } from "@/lib/contact";
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

/**
 * A country's emergency line with each number a link that calls it: "110
 * police / 119 fire and ambulance" keeps its words, and 110 and 119 dial.
 */
function EmergencyNumbers({ numbers }: { numbers: string }) {
  return numbers.split(/(\d+)/).map((part, index) =>
    index % 2 === 1 ? (
      <a
        key={index}
        href={`tel:${part}`}
        className="tap inline-flex min-h-11 items-center font-medium tabular underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export default function MoreScreen() {
  const { trip, items, hydrated } = useTripView();
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [shareLink, setShareLink] = useState<ShareLink>();

  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Create a trip first and this fills in."
        action={
          <Link href="/trip/new" className={PRIMARY_BUTTON_CLASSES}>
            Start a trip
          </Link>
        }
      />
    );
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
            className="press flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-headline">Push to calendar</span>
              <span className="mt-1 block text-footnote text-ink-soft">
                Downloads an .ics any calendar app reads
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↓</span>
          </button>

          <button
            type="button"
            onClick={share}
            className="press flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-headline">Share the plan</span>
              <span className="mt-1 block text-footnote text-ink-soft">
                {shareState === "copied"
                  ? "Link copied. Prices and confirmations are stripped out"
                  : shareState === "failed"
                    ? "This trip is too big to fit in a link"
                    : "A read-only link, held in the URL itself"}
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">↗</span>
          </button>

          {shareLink && shareLink.size !== "safe" && (
            <p className="px-4 py-3 text-footnote text-warning">
              {shareLink.size === "too-big" ? (
                <>
                  The whole trip comes to {shareLink.length.toLocaleString()} characters, which is
                  past what a link survives being pasted into. Export a backup from This device and
                  send the file instead, or schedule fewer items onto days and share again.
                </>
              ) : (
                <>
                  This link is {shareLink.length.toLocaleString()} characters. It will open fine,
                  but some chat apps and email clients cut long links, so check it arrived whole.
                </>
              )}
            </p>
          )}

          {shareLink?.trimmedTo !== undefined && shareState === "copied" && (
            <p className="px-4 py-3 text-footnote text-ink-soft">
              The full trip was too long for a reliable link, so this one carries the{" "}
              {shareLink.trimmedTo} scheduled items. Unscheduled ideas were left out.
            </p>
          )}

          <Link
            href="/recap"
            className="press flex min-h-11 items-center justify-between gap-3 px-4 py-3"
          >
            <span>
              <span className="block text-headline">Trip recap</span>
              <span className="mt-1 block text-footnote text-ink-soft">
                Spend, places, and where each item came from
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-ink-faint">
              ›
            </span>
          </Link>
        </Card>
      </section>

      {briefs.length > 0 && (
        <section>
          <SectionTitle>On the ground</SectionTitle>
          <Card className="divide-y divide-line">
            {briefs.map(({ country, hoursFromHome }) => (
              <div key={country.code} className="px-4 py-3">
                <p className="text-subheadline font-medium text-teal">{country.name}</p>
                {/* Emergency first, on its own row, each number a tap from a call. */}
                <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 text-subheadline">
                  <dt className="text-ink-soft">Emergency</dt>
                  <dd className="text-ink">
                    <EmergencyNumbers numbers={country.emergency} />
                  </dd>
                  <dt className="text-ink-soft">Currency</dt>
                  <dd className="text-ink">{country.currency}</dd>
                  <dt className="text-ink-soft">Plugs</dt>
                  <dd className="text-ink">Type {country.plugTypes.join("/")}</dd>
                  <dt className="text-ink-soft">Time</dt>
                  <dd className="text-ink">
                    <span className="tabular">
                      {hoursFromHome > 0 ? "+" : ""}
                      {hoursFromHome}h
                    </span>{" "}
                    from home
                  </dd>
                </dl>
                <p className="mt-1 text-subheadline text-ink-soft">{country.tipping}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section id="this-device" className="flex flex-col gap-3">
        <SectionTitle>This device</SectionTitle>
        <InstallPrompt />
        <BackupPanel />
      </section>

      <section>
        <SectionTitle>Help and legal</SectionTitle>
        <Card className="divide-y divide-line">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Manifest%20feedback`}
            className="press flex min-h-11 items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-headline">Help &amp; feedback</span>
              <span className="mt-1 block text-footnote text-ink-soft">
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
              className="press flex min-h-11 items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block text-headline">{page.title}</span>
                <span className="mt-1 block text-footnote text-ink-soft">
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
