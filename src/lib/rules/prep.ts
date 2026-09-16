import type { Flag, Traveler } from "../domain/types";
import { weatherFor } from "../reference/climate";
import { getCountry, type CountryInfo } from "../reference/countries";
import {
  affected,
  destinationCountries,
  nameList,
  originGroups,
  type OriginGroup,
  type RuleContext,
  windowForCountry,
} from "./shared";

export interface DestinationBrief {
  country: CountryInfo;
  hoursFromHome: number;
}

/**
 * The destinations, seen from one origin. Defaults to the trip's own, which is
 * what a single-origin trip and every read-only summary wants; the rules pass
 * a group's origin so a party leaving from two places gets two answers.
 */
export function destinationBriefs(
  { trip, items }: RuleContext,
  originCode: string = trip.homeCountry,
): DestinationBrief[] {
  const home = getCountry(originCode);

  return destinationCountries(trip, items)
    .map((code) => getCountry(code))
    .filter((country): country is CountryInfo => Boolean(country))
    .map((country) => ({
      country,
      hoursFromHome: home ? country.utcOffset - home.utcOffset : 0,
    }));
}

/** "for Ana and Sehej", used only where the advice does not cover everyone. */
function whose(hit: { travelers: CountryInfo[] | Traveler[]; everyone: boolean }): string {
  return hit.everyone ? "" : ` for ${nameList(hit.travelers as Traveler[])}`;
}

/** Stable and unique per audience, and unchanged for a single-origin trip. */
function scopedId(prefix: string, countryCode: string, hit: { groups: OriginGroup[]; everyone: boolean }): string {
  if (hit.everyone) return `${prefix}:${countryCode}`;
  return `${prefix}:${countryCode}:${hit.groups.map((group) => group.countryCode).sort().join("+")}`;
}

/** "Type C, D, M (India)", so a merged finding still says what each side has. */
function plugsBy(groups: OriginGroup[]): string {
  return groups
    .map((group) => {
      const country = getCountry(group.countryCode);
      return country ? `Type ${country.plugTypes.join(", ")} (${country.name})` : group.countryCode;
    })
    .join(" or ");
}

export function powerCompatibility(ctx: RuleContext): Flag[] {
  const groups = originGroups(ctx.trip).filter((group) => getCountry(group.countryCode));
  if (groups.length === 0) return [];

  return destinationBriefs(ctx).flatMap(({ country }) => {
    const flags: Flag[] = [];

    // One finding per answer, not one per person. The adapter Japan needs is
    // the same whether you set off from Delhi or London; what differs is only
    // which of your own plugs it replaces, and that fits in the detail.
    const needsAdapter = affected(groups, (group) => {
      const home = getCountry(group.countryCode)!;
      return country.plugTypes.every((type) => !home.plugTypes.includes(type));
    });

    if (needsAdapter) {
      flags.push({
        id: scopedId("plug", country.code, needsAdapter),
        severity: "info",
        category: "prep",
        title: `Pack a Type ${country.plugTypes.join("/")} adapter for ${country.name}${whose(needsAdapter)}`,
        detail: `${country.name} uses Type ${country.plugTypes.join(", ")} sockets; ${
          groups.length === 1
            ? `your Type ${getCountry(groups[0].countryCode)!.plugTypes.join(", ")} plugs`
            : `${plugsBy(needsAdapter.groups)} plugs`
        } will not fit.`,
        itemIds: [],
      });
    }

    const wrongVoltage = affected(groups, (group) => {
      const home = getCountry(group.countryCode)!;
      return Math.abs(country.voltage - home.voltage) >= 50;
    });

    if (wrongVoltage) {
      const voltages = [
        ...new Set(wrongVoltage.groups.map((group) => getCountry(group.countryCode)!.voltage)),
      ];
      flags.push({
        id: scopedId("voltage", country.code, wrongVoltage),
        severity: "info",
        category: "prep",
        title: `${country.name} runs on ${country.voltage}V, not ${voltages.join(" or ")}V${whose(wrongVoltage)}`,
        detail:
          "Most phone and laptop chargers handle both, but anything with a motor or a heating element (hair dryers, shavers) may not.",
        itemIds: [],
      });
    }

    return flags;
  });
}

export function jetLag(ctx: RuleContext): Flag[] {
  const groups = originGroups(ctx.trip).filter((group) => getCountry(group.countryCode));
  if (groups.length === 0) return [];

  return destinationBriefs(ctx).flatMap(({ country }): Flag[] => {
    // Here the number itself differs per origin — Tokyo is 3h30 from Delhi and
    // 9h from London — so two lines carry two facts rather than repeating one.
    const byShift = new Map<number, OriginGroup[]>();

    for (const group of groups) {
      const shift = country.utcOffset - getCountry(group.countryCode)!.utcOffset;
      if (Math.abs(shift) < 3) continue;
      byShift.set(shift, [...(byShift.get(shift) ?? []), group]);
    }

    return [...byShift.entries()].map(([shift, hit]) => {
      const everyone = hit.length === groups.length;
      const travelers = hit.flatMap((group) => group.travelers);
      const from = everyone && groups.length === 1
        ? "home"
        : hit.map((group) => getCountry(group.countryCode)!.name).join(" and ");

      return {
        id: scopedId("jetlag", country.code, { groups: hit, everyone }),
        severity: "info" as const,
        category: "prep" as const,
        title: `${country.name} is ${Math.abs(shift)}h ${
          shift > 0 ? "ahead of" : "behind"
        } ${from}${whose({ travelers, everyone })}`,
        detail: `Shifting bedtime 30–60 min ${
          shift > 0 ? "earlier" : "later"
        } for a few days before the flight takes the edge off the first morning.`,
        itemIds: [],
      };
    });
  });
}

export function weatherOutlook(ctx: RuleContext): Flag[] {
  const { trip } = ctx;

  return destinationBriefs(ctx).flatMap(({ country }): Flag[] => {
    // With legs, the days spent in this country — not the whole trip. A
    // November week in Lisbon and a November week in Bangkok want different
    // clothes, and the blended window would describe neither.
    const window = windowForCountry(trip, country.code);
    const weather = weatherFor(country.code, window.startDate, window.endDate);
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
