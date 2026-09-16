import type { Trip, TripItem } from "../domain/types";
import { getCountry } from "../reference/countries";
import { weatherFor } from "../reference/climate";
import { affected, destinationCountries, nameList, originGroups } from "../rules/shared";

/**
 * Offers that fall out of the checks the app already runs. The rule is that
 * an offer must answer a problem the trip actually has — a socket that does
 * not match, a country with no roaming — otherwise it is an advert, and the
 * checks lose their credibility.
 *
 * Partner and associate ids come from the environment. With none set the
 * links are ordinary, non-affiliate ones, so the app is honest out of the box.
 */

export type OfferKind = "esim" | "adapter" | "power" | "gear" | "comfort";

export interface Offer {
  id: string;
  kind: OfferKind;
  title: string;
  /** The check that raised it, in one line. */
  why: string;
  partner: string;
  url: string;
  /** True when the link earns a commission, which the UI must disclose. */
  affiliate: boolean;
}

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG;
const AMAZON_DOMAIN = process.env.NEXT_PUBLIC_AMAZON_DOMAIN ?? "www.amazon.com";
const ESIM_PARTNER = process.env.NEXT_PUBLIC_ESIM_PARTNER ?? "Airalo";
const ESIM_BASE = process.env.NEXT_PUBLIC_ESIM_URL ?? "https://www.airalo.com/search";
const ESIM_REF = process.env.NEXT_PUBLIC_ESIM_REF;

/** An Amazon search rather than a hardcoded ASIN, which goes stale. */
function amazonSearch(keywords: string): { url: string; affiliate: boolean } {
  const url = new URL(`https://${AMAZON_DOMAIN}/s`);
  url.searchParams.set("k", keywords);
  if (AMAZON_TAG) url.searchParams.set("tag", AMAZON_TAG);
  return { url: url.toString(), affiliate: Boolean(AMAZON_TAG) };
}

function esimLink(countryName: string): { url: string; affiliate: boolean } {
  const url = new URL(ESIM_BASE);
  url.searchParams.set("q", countryName);
  if (ESIM_REF) url.searchParams.set("ref", ESIM_REF);
  return { url: url.toString(), affiliate: Boolean(ESIM_REF) };
}

export function offersFor(trip: Trip, items: TripItem[]): Offer[] {
  const offers: Offer[] = [];
  const origins = originGroups(trip);

  // The same list the checks use, so a country you only change planes in is
  // not sold an eSIM it would never connect to.
  const destinations = destinationCountries(trip, items)
    .map((code) => getCountry(code))
    .filter((country): country is NonNullable<typeof country> => Boolean(country));

  if (destinations.length === 0) return offers;

  // Data. One eSIM per country, or one regional note when there are several.
  for (const country of destinations.slice(0, 3)) {
    const link = esimLink(country.name);
    offers.push({
      id: `esim-${country.code}`,
      kind: "esim",
      title: `Data in ${country.name}`,
      why: "Your home number will roam at whatever your carrier charges. An eSIM is usually a few dollars for the trip.",
      partner: ESIM_PARTNER,
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  // Sockets. Only when the plugs genuinely differ from where you set off. The
  // adapter is the same product whoever needs it, so this is one offer unless
  // part of the party does not need it at all.
  const known = origins.filter((group) => getCountry(group.countryCode));

  const needsAdapter = affected(known, (group) => {
    const homePlugs = new Set(getCountry(group.countryCode)!.plugTypes);
    return destinations.some((country) => country.plugTypes.some((plug) => !homePlugs.has(plug)));
  });

  if (needsAdapter) {
    const homePlugs = new Set(
      needsAdapter.groups.flatMap((group) => getCountry(group.countryCode)!.plugTypes),
    );
    const foreign = destinations.filter((country) =>
      country.plugTypes.some((plug) => !homePlugs.has(plug)),
    );
    const types = [...new Set(foreign.flatMap((country) => country.plugTypes))].join(", ");
    const link = amazonSearch("universal travel adapter");

    offers.push({
      id: "adapter",
      kind: "adapter",
      title: `A plug adapter that fits${needsAdapter.everyone ? "" : ` for ${nameList(needsAdapter.travelers)}`}`,
      why: `${foreign.map((country) => country.name).join(" and ")} use type ${types}; ${needsAdapter.groups
        .map((group) => {
          const home = getCountry(group.countryCode)!;
          return known.length === 1 ? `home is type ${home.plugTypes.join(", ")}` : `${home.name} is type ${home.plugTypes.join(", ")}`;
        })
        .join(", ")}.`,
      partner: "Amazon",
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  // Voltage is the one that destroys a hairdryer, so it is called out apart.
  const wrongVoltage = affected(known, (group) => {
    const home = getCountry(group.countryCode)!;
    return destinations.some((country) => Math.abs(country.voltage - home.voltage) > 40);
  });

  if (wrongVoltage) {
    const home = getCountry(wrongVoltage.groups[0].countryCode)!;
    const mismatch = destinations.find(
      (country) => Math.abs(country.voltage - home.voltage) > 40,
    )!;
    const link = amazonSearch("dual voltage travel converter");

    offers.push({
      id: "voltage",
      kind: "power",
      title: `Check your chargers take 240V${wrongVoltage.everyone ? "" : ` for ${nameList(wrongVoltage.travelers)}`}`,
      why: `${mismatch.name} runs at ${mismatch.voltage}V against ${[
        ...new Set(wrongVoltage.groups.map((group) => getCountry(group.countryCode)!.voltage)),
      ].join(" or ")}V where you set off. Laptops and phones cope; heating appliances do not.`,
      partner: "Amazon",
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  // Weather, read off the same normals the packing list uses.
  const first = destinations[0];
  const weather = weatherFor(first.code, trip.startDate, trip.endDate);

  if (weather?.wet) {
    const link = amazonSearch("packable rain jacket");
    offers.push({
      id: "rain",
      kind: "gear",
      title: "Something for the rain",
      why: `${first.name} is in its wet season while you are there.`,
      partner: "Amazon",
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  if (weather && weather.lowC <= 5) {
    const link = amazonSearch("merino base layer");
    offers.push({
      id: "cold",
      kind: "gear",
      title: "Layers for the cold",
      why: `Nights drop to about ${weather.lowC}°C in ${weather.referenceCity}.`,
      partner: "Amazon",
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  // Long-haul comfort, only when there is actually a long flight filed.
  if (hasLongHaul(items)) {
    const link = amazonSearch("compression socks flight");
    offers.push({
      id: "longhaul",
      kind: "comfort",
      title: "For the long flight",
      why: "You have a flight over eight hours on this trip.",
      partner: "Amazon",
      url: link.url,
      affiliate: link.affiliate,
    });
  }

  return offers;
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

function hasLongHaul(items: TripItem[]): boolean {
  return items.some((item) => {
    if (item.bookingKind !== "flight" || !item.startsAt || !item.endsAt) return false;
    return Date.parse(item.endsAt) - Date.parse(item.startsAt) >= EIGHT_HOURS;
  });
}

/** Whether anything on screen actually earns a commission. */
export function anyAffiliate(offers: Offer[]): boolean {
  return offers.some((offer) => offer.affiliate);
}
