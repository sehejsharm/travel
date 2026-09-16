import type { Metadata } from "next";
import { Bullets, LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy policy — Manifest",
  description: "What Manifest stores, and the handful of things that leave your device.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy policy"
      summary="Manifest has no accounts and no database. Your trip lives in this browser. This page is the complete list of what leaves it."
    >
      <Section heading="The short version">
        <p>
          Everything you file — bookings, screenshots you capture, notes, prices, passport expiry
          dates, confirmation numbers — is written to storage inside your own browser and is never
          sent to us. We operate no user database, no account system, and no analytics that
          identify you. We cannot read your trip, and we could not hand it to anyone else if we
          were asked to.
        </p>
        <p>
          Three things do leave your device, all of them started by something you did. They are
          listed in full below.
        </p>
      </Section>

      <Section heading="1. Extracting a booking (only when you tap Extract)">
        <p>
          When you paste text or capture a screenshot and ask Manifest to read it, that content is
          sent to our server, which forwards it to the Anthropic API to be turned into structured
          fields. We do not store it — it passes through memory and is not written to disk or to
          any log by us.
        </p>
        <Bullets
          items={[
            <>
              <strong className="text-ink">What is sent:</strong> the text or image you supplied,
              and nothing else about you. No device identifier, no trip history, no other item.
            </>,
            <>
              <strong className="text-ink">Who receives it:</strong> Anthropic, as a processor, under
              their API terms. They do not train models on API inputs by default.
            </>,
            <>
              <strong className="text-ink">If you paste a link</strong> to Instagram, TikTok or
              YouTube, our server also requests that public page to read its title, description and
              preview image. That request comes from our server, not your device, so your IP address
              is not revealed to those sites.
            </>,
            <>
              <strong className="text-ink">Screenshots are not retained anywhere.</strong> The image
              is downscaled in your browser, sent for extraction, and discarded. Only the extracted
              fields are saved, on your device.
            </>,
          ]}
        />
      </Section>

      <Section heading="2. Suggestions in Discover (only when you tap Find)">
        <p>
          Asking for things to do sends the destination name and the interest sections you picked to
          our server, which works down a list of sources until it has enough to answer:
        </p>
        <Bullets
          items={[
            <>
              Your own filed places, and a list of suggestions bundled with the app — both handled
              entirely without contacting anyone.
            </>,
            <>
              The <strong className="text-ink">Google Places API</strong>, which receives the
              destination and a description of what you are looking for. It does not receive your
              identity, your trip, or your location.
            </>,
            <>
              <strong className="text-ink">Web search through the Anthropic API</strong>, which
              issues search queries containing the destination and your interests. Those queries
              reach a search provider through Anthropic.
            </>,
          ]}
        />
        <p>
          The names of places you have already filed are included so the advisor does not suggest
          them back to you. If you would rather they were not sent, do not use Discover — every
          other part of Manifest works without it.
        </p>
      </Section>

      <Section heading="3. Maps">
        <p>
          Where a map is shown — on the cabinet map view and in an item&rsquo;s editor — it is a
          Google Maps embed loaded by your browser. That is a direct connection from your device to
          Google, which means Google receives your IP address, your browser details, and the
          coordinates or place name being displayed, under{" "}
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
          Tapping &ldquo;Maps&rdquo; or &ldquo;Directions&rdquo; opens Google Maps in a new tab and
          hands off to it in the ordinary way.
        </p>
      </Section>

      <Section heading="Permissions we ask for, and why">
        <Bullets
          items={[
            <>
              <strong className="text-ink">Camera</strong> — only if you tap Camera on the Add
              screen, to photograph a booking. The photo goes to extraction and is not stored.
            </>,
            <>
              <strong className="text-ink">Photo library</strong> — only if you choose Screenshot,
              to pick an existing image. We receive the one file you select.
            </>,
            <>
              <strong className="text-ink">Clipboard</strong> — only when you tap Paste, read once.
            </>,
            <>
              <strong className="text-ink">Storage</strong> — to keep your trip on the device. This
              is the whole product.
            </>,
          ]}
        />
        <p>
          Manifest does not request your location. Maps are centred on the places you filed, not on
          where you are.
        </p>
      </Section>

      <Section heading="Reference data never leaves the device">
        <p>
          Visa rules, vaccination advice, duty-free allowances, plug types, public holidays and
          exchange rates are compiled into the app itself. Running a compliance check contacts
          nobody and reveals nothing about you or where you are going — which is also why those
          figures carry a verification date and can go out of date between releases.
        </p>
      </Section>

      <Section heading="Sharing a trip">
        <p>
          A share link puts a compressed copy of the trip in the part of the URL after the{" "}
          <code className="rounded bg-surface-2 px-1 font-mono text-[11px]">#</code>, which browsers
          never transmit to a server — including ours. Prices, confirmation numbers, traveller names
          and refund deadlines are stripped before the link is made. Anyone you give the link to can
          read the trip, so treat it like a document, not a password.
        </p>
      </Section>

      <Section heading="Affiliate links">
        <p>
          The Checks screen may show product suggestions (an eSIM, a plug adapter) chosen by the
          checks themselves. Where a link earns us a commission it is labelled &ldquo;paid
          link&rdquo; on the card and disclosed underneath. Tapping one takes you to that
          merchant, who then applies their own privacy policy and may set a cookie attributing the
          visit. We receive no information about you from them beyond aggregate commission reports.
        </p>
      </Section>

      <Section heading="Analytics">
        <p>
          Manifest ships with no analytics SDK, no advertising identifier, and no third-party
          tracker. If aggregate install and page-view statistics are ever added they will be
          anonymous and aggregate-only, and this section will say so before it happens.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          Manifest is not directed at children under 13 and collects nothing from anyone, which
          includes them.
        </p>
      </Section>

      <Section heading="Your rights, and how they work here">
        <p>
          Rights of access, portability, correction and erasure normally require asking a company
          to act on a database. There is no such database. You hold the only copy: export it from
          More → This device, edit any of it in the app, and delete all of it in one tap. See{" "}
          <a href="/legal/data-deletion" className="text-accent-strong underline">
            deleting your data
          </a>
          .
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy: <span className="text-ink">privacy@manifest.trip</span>.
          Replace this with a monitored address before submitting to an app store — both Apple and
          Google verify that it works.
        </p>
      </Section>
    </LegalPage>
  );
}
