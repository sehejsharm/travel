import type { Metadata } from "next";
import Link from "next/link";
import { PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Bullets, ContactLink, LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Deleting your data",
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
          operate no user database, keep no server-side copy of your trips, and store nothing you
          send to be read or to Discover, so there is no request to send and nobody who has to act
          on it. Deletion is something you do, and it takes effect immediately.
        </p>
      </Section>

      <Section heading="Delete everything from inside the app">
        <p>
          Open <strong className="font-medium text-ink">More → This device</strong> and tap{" "}
          <strong className="font-medium text-ink">Delete all my data</strong>, then tap again to confirm. That
          removes every trip, every filed item, every checklist, every saved suggestion and any
          break-off from your group from this browser&rsquo;s storage at once. It cannot be undone,
          so export a backup first if you want to keep a copy.
        </p>
        <p>
          Three things are not trip data and stay behind: a few display preferences (listed in the{" "}
          <Link href="/legal/privacy" className="text-accent-strong underline">
            privacy policy
          </Link>
          ), the offline copy of the app itself, and anything half-done on the Add screen, which
          goes when you file it, clear it or close the tab. Clearing site data, below, removes the
          lot.
        </p>
        <Link href="/more" className={`${PRIMARY_BUTTON_CLASSES} sm:max-w-xs`}>
          Go to This device
        </Link>
      </Section>

      <Section heading="Delete it from the browser instead">
        <p>If you would rather not trust the in-app button, clearing site data does the same job:</p>
        <Bullets
          items={[
            <>
              <strong className="font-medium text-ink">iOS Safari:</strong> Settings → Safari → Advanced →
              Website Data → find this site → swipe to delete.
            </>,
            <>
              <strong className="font-medium text-ink">Android Chrome:</strong> ⋮ → Settings → Site settings →
              Data stored → find this site → Delete.
            </>,
            <>
              <strong className="font-medium text-ink">Desktop:</strong> open the site, then DevTools →
              Application → Storage → Clear site data.
            </>,
            <>
              <strong className="font-medium text-ink">Installed to the home screen:</strong> on iPhone and
              iPad, deleting the icon removes its storage with it. On Android, also clear the
              site&rsquo;s data in Chrome as above, in case Chrome kept it.
            </>,
          ]}
        />
      </Section>

      <Section heading="What deletion does not reach">
        <Bullets
          items={[
            <>
              <strong className="font-medium text-ink">Backup files you exported.</strong> Those are yours, on
              your disk or in whatever you saved them to. Delete them yourself.
            </>,
            <>
              <strong className="font-medium text-ink">Share links you sent.</strong> The trip travels inside
              the link, so anyone holding one keeps that snapshot. There is no way to revoke it —
              this is the trade for links that need no server. Only send them to people you mean to.
            </>,
            <>
              <strong className="font-medium text-ink">Calendar events you exported.</strong> Once an .ics file
              is in your calendar it belongs to your calendar.
            </>,
            <>
              <strong className="font-medium text-ink">Third parties you were handed off to.</strong> A
              merchant you tapped through to, or Google Maps, applies its own policy and its own
              deletion route.
            </>,
          ]}
        />
      </Section>

      <Section heading="What you sent to be read, or to Discover">
        <p>
          Text and screenshots sent to be read, and what Discover sends, are worked on in memory
          and not kept by us, so there is nothing held to delete. Where part of that went on to
          Google or Anthropic, their own terms govern how long they keep it, as the{" "}
          <Link href="/legal/privacy" className="text-accent-strong underline">
            privacy policy
          </Link>{" "}
          describes.
        </p>
      </Section>

      <Section heading="If you want it in writing">
        <p>
          Email <ContactLink subject="Data deletion" /> and we will confirm in writing that we hold
          no copy of your trips, or of anything you sent to be read or to Discover. We cannot
          delete any of it for you, because we have none of it to delete.
        </p>
      </Section>
    </LegalPage>
  );
}
