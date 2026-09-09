import type { Flag } from "../domain/types";
import { weatherFor } from "../reference/climate";
import { getCountry, type CountryInfo } from "../reference/countries";
import { destinationCountries, type RuleContext } from "./shared";

export interface DestinationBrief {
  country: CountryInfo;
  hoursFromHome: number;
}

export function destinationBriefs({ trip, items }: RuleContext): DestinationBrief[] {
  const home = getCountry(trip.homeCountry);

  return destinationCountries(trip, items)
    .map((code) => getCountry(code))
    .filter((country): country is CountryInfo => Boolean(country))
    .map((country) => ({
      country,
      hoursFromHome: home ? country.utcOffset - home.utcOffset : 0,
    }));
}

export function powerCompatibility(ctx: RuleContext): Flag[] {
  const home = getCountry(ctx.trip.homeCountry);
  if (!home) return [];

  return destinationBriefs(ctx).flatMap(({ country }) => {
    const missing = country.plugTypes.filter((type) => !home.plugTypes.includes(type));
    const flags: Flag[] = [];

    if (missing.length === country.plugTypes.length) {
      flags.push({
        id: `plug:${country.code}`,
        severity: "info",
        category: "prep",
        title: `Pack a Type ${country.plugTypes.join("/")} adapter for ${country.name}`,
        detail: `${country.name} uses Type ${country.plugTypes.join(
          ", ",
        )} sockets; your Type ${home.plugTypes.join(", ")} plugs will not fit.`,
        itemIds: [],
      });
    }

    if (Math.abs(country.voltage - home.voltage) >= 50) {
      flags.push({
        id: `voltage:${country.code}`,
        severity: "info",
        category: "prep",
        title: `${country.name} runs on ${country.voltage}V, not ${home.voltage}V`,
        detail: `Most phone and laptop chargers handle both, but anything with a motor or a heating element (hair dryers, shavers) may not.`,
        itemIds: [],
      });
    }

    return flags;
  });
}

export function jetLag(ctx: RuleContext): Flag[] {
  return destinationBriefs(ctx)
    .filter(({ hoursFromHome }) => Math.abs(hoursFromHome) >= 3)
    .map(({ country, hoursFromHome }) => {
      const direction = hoursFromHome > 0 ? "ahead of" : "behind";
      const shift = hoursFromHome > 0 ? "earlier" : "later";

      return {
        id: `jetlag:${country.code}`,
        severity: "info" as const,
        category: "prep" as const,
        title: `${country.name} is ${Math.abs(hoursFromHome)}h ${direction} home`,
        detail: `Shifting your bedtime 30–60 min ${shift} for a few days before you fly takes the edge off the first morning.`,
        itemIds: [],
      };
    });
}

export function weatherOutlook(ctx: RuleContext): Flag[] {
  const { trip } = ctx;

  return destinationBriefs(ctx).flatMap(({ country }): Flag[] => {
    const weather = weatherFor(country.code, trip.startDate, trip.endDate);
    if (!weather) return [];

    return [
      {
        id: `weather:${country.code}`,
        severity: "info",
        category: "prep",
        title: `Expect ${weather.lowC}–${weather.highC}°C in ${country.name}`,
        detail: `Seasonal normals for ${weather.referenceCity} across your dates${
          weather.wet ? ", and you are travelling in the wet season — pack a rain layer" : ""
        }. Your packing list is built from this.`,
        itemIds: [],
      },
    ];
  });
}

export function cashReadiness(ctx: RuleContext): Flag[] {
  return destinationBriefs(ctx)
    .filter(({ country }) => country.cashPreference === "cash-heavy")
    .map(({ country }) => ({
      id: `cash:${country.code}`,
      severity: "info" as const,
      category: "prep" as const,
      title: `${country.name} still runs on cash`,
      detail: `Plenty of places take ${country.currency} notes only. Sort out cash before you need it, and tell your bank you are travelling.`,
      itemIds: [],
    }));
}
