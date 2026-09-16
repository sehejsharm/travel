import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Deleting your data — Manifest",
  description: "How to permanently delete everything Manifest holds. There is no account to close.",
};

export default function DataDeletion() {
  return (
    <LegalPage
      title="Deleting your data"
      summary="Apple and Google both require a clear deletion route, even for an app with no account. Here it is."
    >
      <Section heading="There is no account, so there is nothing to request">
        <p>
          Deletion is normally a request to a company holding your records. Manifest holds none. We
          operate no user database and no server-side copy of your trips, so there is no request to
          send and nobody who has to act on it. Deletion is something you do, and it takes effect
          immediately.
        </p>
      </Section>

      <Section heading="Delete everything from inside the app">
        <p>
          Open <strong className="text-ink">More → This device</strong> and tap{" "}
          <strong className="text-ink">Delete all my data</strong>, then tap again to confirm. That
          removes every trip, every filed item, every checklist, and every cached suggestion from
          this browser&rsquo;s storage at once. It cannot be undone, so export a backup first if you
          want to keep a copy.
        </p>
        <Link
          href="/more"
          className="press inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          Go to This device
        </Link>
      </Section>

      <Section heading="Delete it from the browser instead">
        <p>If you would rather not trust the in-app button, clearing site data does the same job:</p>
        <Bullets
          items={[
            <>
              <strong className="text-ink">iOS Safari:</strong> Settings → Safari → Advanced →
              Website Data → find this site → swipe to delete.
            </>,
            <>
              <strong className="text-ink">Android Chrome:</strong> ⋮ → Settings → Site settings →
              Data stored → find this site → Delete.
            </>,
            <>
              <strong className="text-ink">Desktop:</strong> open the site, then DevTools →
              Application → Storage → Clear site data.
            </>,
            <>
              <strong className="text-ink">Installed to the home screen:</strong> deleting the app
              icon removes its storage with it on both platforms.
            </>,
          ]}
        />
      </Section>

      <Section heading="What deletion does not reach">
        <Bullets
          items={[
            <>
              <strong className="text-ink">Backup files you exported.</strong> Those are yours, on
              your disk or in whatever you saved them to. Delete them yourself.
            </>,
            <>
              <strong className="text-ink">Share links you sent.</strong> The trip travels inside
              the link, so anyone holding one keeps that snapshot. There is no way to revoke it —
              this is the trade for links that need no server. Only send them to people you mean to.
            </>,
            <>
              <strong className="text-ink">Calendar events you exported.</strong> Once an .ics file
              is in your calendar it belongs to your calendar.
            </>,
            <>
              <strong className="text-ink">Third parties you were handed off to.</strong> A
              merchant you tapped through to, or Google Maps, applies its own policy and its own
              deletion route.
            </>,
          ]}
        />
      </Section>

      <Section heading="Extraction content">
        <p>
          Text and screenshots sent for extraction are processed in memory and not retained by us.
          There is nothing held to delete. Our processor&rsquo;s retention is governed by its own
          API terms, described in the{" "}
          <Link href="/legal/privacy" className="text-accent-strong underline">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="If you want it in writing">
        <p>
          Email <span className="text-ink">privacy@manifest.trip</span> and we will confirm in
          writing that no copy of your data exists on our side. We cannot delete anything for you,
          because we have nothing of yours to delete.
        </p>
      </Section>
    </LegalPage>
  );
}
