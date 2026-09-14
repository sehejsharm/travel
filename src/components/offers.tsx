"use client";

import { anyAffiliate, type Offer } from "@/lib/partners";
import { Card, Chip, SectionTitle } from "./ui";

const KIND_EMOJI: Record<string, string> = {
  esim: "📶",
  adapter: "🔌",
  power: "⚡️",
  gear: "🧥",
  comfort: "🛫",
};

/**
 * Offers sit under the checks because that is where they were earned: each
 * one names the check that raised it. Where a link pays us, it says so.
 */
export function Offers({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;

  return (
    <section>
      <SectionTitle trailing={`${offers.length}`}>Sorted before you go</SectionTitle>

      <ul className="flex flex-col gap-2.5">
        {offers.map((offer, index) => (
          <li
            key={offer.id}
            className="animate-rise"
            style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
          >
            <Card as="div" className="flex items-start gap-3 p-4">
              <span aria-hidden="true" className="mt-0.5 text-xl leading-none">
                {KIND_EMOJI[offer.kind] ?? "🧳"}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] leading-snug font-medium">{offer.title}</h3>
                  {offer.affiliate && <Chip>paid link</Chip>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{offer.why}</p>

                <a
                  href={offer.url}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="press mt-2.5 inline-block rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  Look on {offer.partner} ↗
                </a>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {anyAffiliate(offers) && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
          Some links here earn us a commission if you buy, at no extra cost to you. They are chosen
          by the checks above — never by who pays most — and the app works identically if you
          ignore them.
        </p>
      )}
    </section>
  );
}
