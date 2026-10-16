import type { Metadata } from "next";
import { Bullets, ContactLink, LegalPage, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms you accept by using Manifest, including what the checks are not.",
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      summary="Short, because Manifest keeps nothing of yours and promises little. The part that matters most is what the checks are not."
    >
      <Section heading="Agreement">
        <p>
          By using Manifest you accept these terms. If you do not, do not use it. There is no
          account to close — deleting the app, or clearing its data, ends the relationship
          completely.
        </p>
      </Section>

      <Section heading="The checks are information, not advice">
        <p className="rounded-card border border-warning bg-warning-soft p-4 text-warning">
          <strong className="font-medium">Manifest is not a legal, immigration, medical, insurance or financial adviser,
          and its findings are not advice.</strong> Visa requirements, passport validity rules,
          vaccination guidance, customs and duty-free allowances, baggage rules and currency
          figures are drawn from reference data compiled into the app on a stated date. They change
          without notice, they vary by nationality, by route, by airline and by individual
          circumstance, and they may simply be wrong.
        </p>
        <p>
          Every such finding is a prompt to verify with an authority that can actually bind
          anyone — the relevant embassy or consulate, your airline, your insurer, or your own
          government&rsquo;s travel advice. Never rely on Manifest as the last word before booking
          or travelling. You remain solely responsible for meeting the entry, health and documentary
          requirements of every country you travel to or through.
        </p>
      </Section>

      <Section heading="Automatic extraction is imperfect">
        <p>
          Reading a booking out of an email, a screenshot or a caption is a best effort, whether
          it is done by pattern matching or by an AI model. Dates, times, time zones, prices,
          currencies and confirmation numbers can be misread or missed. Check anything that matters
          against the original confirmation — Manifest shows you what it read before you file it
          precisely so you can.
        </p>
      </Section>

      <Section heading="Your data is your responsibility">
        <p>
          Manifest keeps your trips on your device and holds no copy. That means we cannot recover
          a trip if you clear your browser data, lose the device, or uninstall the app. Browsers
          may also evict site storage when space runs short. Export a backup from More → This device
          if the trip matters to you. We are not liable for data lost this way.
        </p>
        <p>
          A share link carries a copy of the plan inside it, and anyone who has the link can read
          it. It cannot be revoked once sent, so you decide who gets one.
        </p>
      </Section>

      <Section heading="Suggestions and third-party services">
        <p>
          Places suggested in Discover come from a list bundled with the app and, where they are
          switched on, from Google Places and web searches; the line on why each is worth a visit
          may be written by an AI model from those sources. They are not endorsements, are not
          verified as safe, open or operating, and may be out of date or simply wrong. Maps are
          provided by Google under its own terms. Where a product link earns a commission it is
          labelled; that arrangement never changes what the checks say, and nothing on the Checks
          screen is placed because someone paid for it.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <Bullets
          items={[
            "Do not use Manifest to process content you have no right to, or anyone else's personal data without their knowledge.",
            "Do not attempt to overload, reverse-engineer or abuse the extraction and suggestion endpoints.",
            "Automated or bulk use of those endpoints is not permitted.",
          ]}
        />
      </Section>

      <Section heading="Availability">
        <p>
          Typing items in by hand, the checks, the timeline, the budget, backups and making a share
          link all run on your device, and work with no signal on screens Manifest has already
          loaded on this device. Reading what you add, and Discover,
          need our server and, for some of what they do, third-party services we may switch on or
          off — reading screenshots needs an AI model, for one. They may be slow, rate-limited or
          unavailable, and are provided as they are, with no uptime promise.
        </p>
      </Section>

      <Section heading="Warranty and liability">
        <p>
          Manifest is provided &ldquo;as is&rdquo;, without warranties of any kind, express or
          implied, including merchantability, fitness for a particular purpose, and accuracy. To the
          fullest extent the law allows, we are not liable for any indirect or consequential loss,
          nor for missed flights, refused boarding, denied entry, penalties, lost bookings or lost
          data arising from your use of Manifest. Nothing here excludes liability that cannot
          lawfully be excluded, and if you are a consumer your statutory rights are unaffected.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          These terms may change as the app does. The date at the foot of this page is when they
          last did; continuing to use Manifest after that means accepting the current version.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms: <ContactLink subject="Terms of use" />.
        </p>
      </Section>
    </LegalPage>
  );
}
