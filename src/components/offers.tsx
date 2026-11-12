"use client";

import type { IconName } from "@/lib/icons";
import { anyAffiliate, type Offer } from "@/lib/partners";
import { LineIcon } from "./line-icon";
import { SECONDARY_BUTTON_CLASSES } from "./styles";
import { Card, Chip, SectionTitle } from "./ui";

const KIND_ICON: Record<string, IconName> = {
  esim: "signal",
  adapter: "plug",
  power: "bolt",
  gear: "jacket",
  comfort: "plane",
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

      <ul className="flex flex-col gap-3">
        {offers.map((offer, index) => (
          <li
            key={offer.id}
            className="animate-rise"
            style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
          >
            <Card as="div" className="flex items-start gap-3 p-4">
              <LineIcon name={KIND_ICON[offer.kind] ?? "suitcase"} className="shrink-0 text-ink-soft" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-headline">{offer.title}</h3>
                  {offer.affiliate && <Chip>Paid link</Chip>}
                </div>
                <p className="mt-1 text-subheadline text-ink-soft">{offer.why}</p>

                <a
                  href={offer.url}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className={`${SECONDARY_BUTTON_CLASSES} mt-3`}
                >
                  Look on {offer.partner}
                </a>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {anyAffiliate(offers) && (
        <p className="mt-3 text-caption text-ink-soft">
          Some links here earn us a commission if you buy, at no extra cost to you. They are chosen
          by the checks above (never by who pays most), and the app works identically if you
          ignore them.
        </p>
      )}
    </section>
  );
}
