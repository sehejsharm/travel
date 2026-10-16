import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContactLink, LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Manifest keeps on your device, what it sends to read a booking or suggest things to do, who receives it, and what is kept.",
};

function Term({ children }: { children: string }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

/*
 * Every claim here is checked against the code that makes it true. When any of
 * these change, this page changes with them, and docs/store-compliance.md too:
 *   reading:      src/lib/capture.ts, src/app/api/extract, src/lib/extract/
 *   suggestions:  src/app/discover/page.tsx, src/app/api/advise, src/lib/advisor/
 *   abuse guard:  src/lib/api/guard.ts
 *   maps:         src/lib/maps.ts, trip-map.tsx, item-fields.tsx
 *   storage:      src/lib/store/, add-draft.ts, review.ts, onboarding.tsx,
 *                 install-prompt.tsx, app-shell.tsx, public/sw.js
 *   share links:  src/lib/share.ts (stripPrivate)
 */
export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy policy"
      summary="Manifest has no accounts, no database and no cookies. Your trips live on this device. This page lists everything that leaves it, who receives it, and what is kept."
    >
      <Section heading="The short version">
        <p>
          Your trips — bookings, notes, prices, passport details, confirmation numbers, everything
          you file — are stored on this device. We run no account system and no user database, so
          we hold no copy of your trips and could not hand one over if asked.
        </p>
        <p>
          Two features need our server: reading something you add, and finding things to do. Each
          sends what is listed below; our server works on it in memory, sends the answer back, and
          stores none of it. Depending on how the server is set up, some of it is passed to Google
          or Anthropic to do the work, as set out below. Maps come to your browser straight from
          Google.
        </p>
        <p>Nothing leaves the device until you do something that needs it.</p>
      </Section>

      <Section heading="1. Reading what you add (when you tap Extract or Read the screenshot)">
        <p>
          When you ask Manifest to read something on the Add screen, it goes to our server, which
          pulls out the booking details and sends them back. Nothing is filed until you tap to
          file it.
        </p>
        <Bullets
          items={[
            <>
              <Term>What is sent:</Term> the text you pasted, typed or shared into the box, or the
              screenshot or photo you picked, plus a label for what it looks like (an email, a Reel). An image is first
              resized on your device to at most 1600 pixels across and saved afresh as a JPEG,
              which also drops the photo&rsquo;s hidden details, such as where it was taken.
              Nothing else goes with it: no device identifier, no trip, no other item.
            </>,
            <>
              <Term>On our server:</Term> a pattern reader works through it in memory. Nothing is
              written to disk, to a database or to our logs; if reading fails, only the error is
              logged, never what you sent.
            </>,
            <>
              <Term>Links in the text:</Term> if it contains an Instagram, TikTok or YouTube link,
              our server fetches that public page to read its title and caption, and for YouTube
              asks YouTube&rsquo;s public oEmbed service too. Those sites see our server asking
              for that link, not your device, so they do not get your IP address.
            </>,
            <>
              <Term>Anthropic:</Term> only when an AI model is switched on for our server. Then text
              the pattern reader cannot read confidently is sent on to Anthropic&rsquo;s API, with
              any title and caption fetched for a link, and a screenshot always is, because only
              the model can read one. With it switched off nothing goes to Anthropic: text is read
              by the pattern reader alone, and our server turns a screenshot away without reading
              or keeping it.
            </>,
            <>
              Anthropic processes what it receives for us, as our processor, under its commercial
              terms, which do not let it train models on it; how long it keeps a request is set by
              its own policy.
            </>,
          ]}
        />
      </Section>

      <Section heading="2. Suggestions in Discover (when you ask for them)">
        <p>
          Discover only looks things up when you ask on the Discover screen: by saving your
          interests there, or tapping Find things to do or Look again. It sends our server:
        </p>
        <Bullets
          items={[
            <>
              the destination — what you typed under Where, or else the city you have filed most
              in, the trip&rsquo;s first destination country, or failing those the trip&rsquo;s
              name — and the code of the trip&rsquo;s first destination country;
            </>,
            <>the interests you picked;</>,
            <>
              the title and place name of everything filed on this trip, so nothing you have
              already filed is suggested back;
            </>,
            <>for each filed item that has a place, the place&rsquo;s name and city, and your notes on that item.</>,
          ]}
        />
        <p>
          Our server starts with your own filed places and a list of suggestions bundled with the
          app, which involves nobody else. After that, and only where each service is switched on
          for our server:
        </p>
        <Bullets
          items={[
            <>
              For any interest still short of suggestions, the <Term>Google Places API</Term>{" "}
              receives a search made only of the kind of place that interest covers and the
              destination as described above (whatever you typed under Where, or else your
              trip&rsquo;s name) — none of your filed titles, notes or anything else about you. This
              step runs only when the writing step below is switched on, since only it can use the
              results.
            </>,
            <>
              For any still short after that, <Term>Anthropic&rsquo;s web search</Term> receives
              the destination and those kinds of places, and runs searches for them through a
              search provider.
            </>,
            <>
              <Term>Anthropic&rsquo;s API</Term> then writes the suggestions up from everything
              gathered, which includes your filed places&rsquo; names, cities and notes.
            </>,
          ]}
        />
        <p>
          Our server keeps none of it. The suggestions that come back are saved on this device so
          the same question is not asked twice. If you would rather your notes stayed put, keep
          private details out of notes on places, or skip Discover — everything else works
          without it.
        </p>
      </Section>

      <Section heading="3. Maps, and links out">
        <p>
          Where a map is shown — on the Cabinet&rsquo;s map view, in an item&rsquo;s editor, and
          under a place you type in on the Add screen — it is a Google Maps embed your browser
          loads straight from Google. Google receives your IP address, your browser&rsquo;s
          details, and the place name or coordinates shown, and may set or read its own cookies
          inside the map, under{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline"
          >
            Google&rsquo;s privacy policy
          </a>
          . No map loads until you open a view that shows one.
        </p>
        <p>
          Tapping Maps, Open in Maps or Directions opens Google Maps in a new tab with that place,
          or both ends of the journey, in the address. A suggestion&rsquo;s source, a product link
          on the Checks screen, and the app&rsquo;s store page when you choose to rate it open the
          same way. From there, that site&rsquo;s own privacy policy applies.
        </p>
        <p>
          The small map on the Divert screen is different: it is drawn on your device from places
          you filed, loads nothing, and contacts no one. Breaking off from your group stores who
          broke off, the spot they chose and when, on this device only. That record is deleted when
          they rejoin, when you delete the trip or remove them from it, or the first time the app
          opens more than twelve hours after they broke off.
        </p>
      </Section>

      <Section heading="4. Hosting, and keeping the server from being abused">
        <p>
          Manifest is served by Vercel. As with any website, each request your device makes —
          opening a page, or asking it to read something or find things to do — reaches Vercel
          with your IP address, your browser&rsquo;s details and the address requested, and
          Vercel keeps short-lived request logs to run and secure the service. What you send to be
          read or to Discover is not part of those logs.
        </p>
        <p>
          Sharing something into Manifest from another app&rsquo;s share menu opens the Add screen
          with what you shared in the page&rsquo;s address. Once Manifest has been opened on this
          device, its offline worker loads that page without it, so what you shared stays here
          until you tap Extract. The very first time, before that worker is in place, the address
          reaches Vercel like any page you open.
        </p>
        <p>
          To keep scripts from running up those two features, our server checks that each request
          comes from the Manifest app, and counts requests from each IP address over a rolling
          minute. The count is kept in memory only, never written down or linked to anything else,
          and is lost when that server instance stops.
        </p>
      </Section>

      <Section heading="Cookies and tracking">
        <p>
          Manifest sets no cookies. It ships no analytics, no advertising identifiers, no tracking
          pixels and no crash reporter, and nothing in it builds a profile of you. If that ever
          changes, this page will say so before it happens.
        </p>
        <p>
          What the app keeps is in your browser&rsquo;s own storage on this device. Only the parts
          you send to be read or to Discover leave it, as set out above:
        </p>
        <Bullets
          items={[
            <>
              <Term>Your trips:</Term> every trip, filed item, checklist and saved suggestion, and a
              break-off from your group while one is running.
            </>,
            <>
              <Term>A few preferences:</Term> whether you have seen the introduction, whether the
              sidebar is folded, whether you dismissed the offer to install the app, and when you
              were last asked to rate it, or that you said no.
            </>,
            <>
              <Term>Unfinished work on the Add screen:</Term> an item you are typing in, or text you
              pasted or shared to be read, kept in this browser tab only so looking something up
              elsewhere does not lose it. It goes when you file it, clear it or close the tab, and
              is never part of a backup.
            </>,
            <>
              <Term>An offline copy</Term> of the app&rsquo;s pages and code, kept by its service
              worker, so Manifest opens with no signal.
            </>,
          ]}
        />
        <p>
          Google&rsquo;s map embeds, and the sites you tap through to, are run by those companies
          and may use their own cookies under their own policies.
        </p>
      </Section>

      <Section heading="Permissions we ask for, and why">
        <Bullets
          items={[
            <>
              <Term>Camera</Term> — only if you tap Camera on the Add screen, to photograph a
              booking. The photo is sent to be read only when you tap Read the screenshot, and is
              not stored.
            </>,
            <>
              <Term>Photo library</Term> — only if you tap Screenshot, to pick an image. Only the one
              image you choose is read, and only when you ask.
            </>,
            <>
              <Term>Clipboard</Term> — read once, only when you tap Paste. Pasting into the box
              yourself needs no permission.
            </>,
            <>
              <Term>Storage</Term> — to keep your trip on this device. This is the whole product.
            </>,
          ]}
        />
        <p>
          Manifest does not ask for your location, your contacts, your calendar or to send you
          notifications. Maps are centred on the places you filed, not on where you are.
        </p>
      </Section>

      <Section heading="Reference data never leaves the device">
        <p>
          Visa rules, vaccination advice, duty-free allowances, plug types, public holidays and
          exchange rates are compiled into the app itself. Running a check contacts nobody and
          reveals nothing about you or where you are going — which is also why those figures carry
          a verification date and can go out of date between releases.
        </p>
      </Section>

      <Section heading="Sharing a trip, and files you save">
        <p>
          A share link puts a compressed copy of the plan in the part of the address after the{" "}
          <code className="rounded-badge bg-surface-2 px-1 font-mono text-footnote">#</code>, which
          browsers never send to a server — ours included. It carries the trip&rsquo;s name and
          dates, its home and destination countries and any legs, how many people are going, and
          each item&rsquo;s title, type, place and times, with when and how it was filed.
        </p>
        <p>
          It leaves behind travellers&rsquo; names, passport countries and expiry dates, insurance
          dates, visa-help choices and where each person flies from; the budget; and every
          item&rsquo;s notes, price, confirmation number, booked-under name, refund deadline,
          source link and who filed it. Anyone you give the link to can read what it carries, and
          it cannot be taken back, so treat it like a document, not a password.
        </p>
        <p>
          Backups and calendar files are made on this device and go wherever you save them. A
          backup holds everything, passport details included; a calendar file includes each
          item&rsquo;s confirmation number, price and source link. Keep them accordingly.
        </p>
      </Section>

      <Section heading="Affiliate links">
        <p>
          The Checks screen may show product suggestions (an eSIM, a plug adapter) chosen by the
          checks themselves. Where a link earns us a commission it is labelled &ldquo;Paid
          link&rdquo; on the card and disclosed underneath. Tapping one takes you to that merchant
          with the search it opens in the address — the country, for an eSIM, or the product,
          such as a plug adapter — and the merchant then applies its own privacy policy and may
          set a cookie attributing the visit. We receive nothing about you from them beyond
          aggregate commission reports.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          Manifest is not directed at children under 13. It has no accounts and builds no profile
          of anyone, children included.
        </p>
      </Section>

      <Section heading="Your rights, and how they work here">
        <p>
          Rights of access, portability, correction and erasure normally mean asking a company to
          act on a database. There is no such database: you hold the only copy of your trips.
          Export it from More → This device, edit any of it in the app, and delete all of it in one
          tap — see{" "}
          <Link href="/legal/data-deletion" className="text-accent-strong underline">
            deleting your data
          </Link>
          . For anything else, write to the address below.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If what leaves your device changes, this page is updated to match, and the date at its
          foot moves with it.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy or your data: <ContactLink subject="Privacy" />.
        </p>
      </Section>
    </LegalPage>
  );
}
