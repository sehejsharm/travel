import type { Flag, Traveler } from "../domain/types";
import { getCountry } from "../reference/countries";
import {
  localProvider,
  VISA_OUTCOME_LABELS,
  type EntryRequirementsProvider,
} from "../reference/entry-requirements";
import { healthAdvisory } from "../reference/health";
import {
  daysBetween,
  destinationCountries,
  formatDay,
  hasDate,
  type RuleContext,
  windowForCountry,
} from "./shared";

const VERIFY_NOTE = "the destination's embassy or official immigration site";

export function entryRequirements(
  ctx: RuleContext,
  provider: EntryRequirementsProvider = localProvider,
): Flag[] {
  const { trip, items } = ctx;
  const flags: Flag[] = [];
  const destinations = destinationCountries(trip, items);

  /**
   * A passport has one expiry, so it gets one finding — against the strictest
   * demand across every destination, rather than one per country visited.
   */
  const strictest = new Map<string, { months: number; countryName: string }>();

  for (const destination of destinations) {
    const country = getCountry(destination);
    const countryName = country?.name ?? destination;

    for (const traveler of trip.travelers) {
      // Entry rules are a function of the passport, so without one there is
      // no question to answer. Asking is not a finding, so it stays info.
      if (!traveler.passportCountry?.trim()) {
        flags.push({
          id: `passport-country-missing:${traveler.id}:${destination}`,
          severity: "info",
          category: "compliance",
          title: `Add ${traveler.name}'s passport country to check ${countryName} entry rules`,
          detail: `Visa requirements and how much passport validity ${countryName} wants both depend on which passport is being used.`,
          itemIds: [],
        });
        continue;
      }

      const requirement = provider.lookup(traveler.passportCountry, destination);

      if (requirement.outcome === "visa-required" || requirement.outcome === "e-visa") {
        flags.push({
          id: `visa:${traveler.id}:${destination}`,
          severity: "critical",
          category: "compliance",
          title: `${traveler.name} needs a visa for ${countryName}`,
          detail: `${VISA_OUTCOME_LABELS[requirement.outcome]} on a ${
            traveler.passportCountry
          } passport.${requirement.notes ? ` ${requirement.notes}` : ""} Reference data last checked ${
            requirement.lastVerified
          }.`,
          itemIds: [],
          verifyWith: VERIFY_NOTE,
        });
      } else if (requirement.outcome === "visa-on-arrival") {
        flags.push({
          id: `visa:${traveler.id}:${destination}`,
          severity: "warning",
          category: "compliance",
          title: `${traveler.name} gets a visa on arrival in ${countryName}`,
          detail: `No advance visa needed, but expect a fee and a queue at the border${
            requirement.maxStayDays ? `, valid for ${requirement.maxStayDays} days` : ""
          }.`,
          itemIds: [],
          verifyWith: VERIFY_NOTE,
        });
      } else if (requirement.outcome === "unknown") {
        flags.push({
          id: `visa:${traveler.id}:${destination}`,
          severity: "warning",
          category: "compliance",
          title: `Entry rules for ${countryName} are not in the dataset`,
          detail: `No bundled rule for a ${traveler.passportCountry} passport entering ${countryName}. Check this one manually.`,
          itemIds: [],
          verifyWith: VERIFY_NOTE,
        });
      }

      if (requirement.authorisation) {
        flags.push({
          id: `authorisation:${traveler.id}:${destination}`,
          severity: "warning",
          category: "compliance",
          title: `${countryName} requires ${requirement.authorisation}`,
          detail: `This is separate from a visa and is easy to miss — arrange it for ${traveler.name} before departure.`,
          itemIds: [],
          verifyWith: VERIFY_NOTE,
        });
      }

      const current = strictest.get(traveler.id);
      if (!current || requirement.passportValidityMonths > current.months) {
        strictest.set(traveler.id, {
          months: requirement.passportValidityMonths,
          countryName,
        });
      }
    }
  }

  // With nowhere to go there is nothing to check a passport against.
  if (destinations.length === 0) return flags;

  // The expiry itself is asked for whether or not we know the nationality:
  // whichever passport it is, it has to outlast the trip.
  for (const traveler of trip.travelers) {
    const demand = strictest.get(traveler.id);

    const passportFlag = passportValidity(
      traveler,
      demand?.countryName ?? "your destination",
      demand?.months ?? 0,
      trip.endDate,
    );
    if (passportFlag) flags.push(passportFlag);
  }

  return flags;
}

function passportValidity(
  traveler: Traveler,
  countryName: string,
  requiredMonths: number,
  tripEnd: string,
): Flag | undefined {
  // No expiry on file is a gap in what we know, not a passport about to
  // lapse. Reading it as one produced a critical flag reading "Invalid Date".
  if (!hasDate(traveler.passportExpiry)) {
    return {
      id: `passport-expiry-missing:${traveler.id}`,
      severity: "info",
      category: "compliance",
      title: `Add ${traveler.name}'s passport expiry to check it against this trip`,
      detail:
        requiredMonths > 0
          ? `${countryName} wants ${requiredMonths} months of validity beyond your stay, and this cannot be checked without the date.`
          : "The passport has to outlast the trip, and this cannot be checked without the date.",
      itemIds: [],
    };
  }

  const requiredUntil = new Date(tripEnd);
  requiredUntil.setMonth(requiredUntil.getMonth() + requiredMonths);

  if (Date.parse(traveler.passportExpiry) >= requiredUntil.getTime()) return undefined;

  return {
    id: `passport:${traveler.id}:${countryName}`,
    severity: "critical",
    category: "compliance",
    title: `${traveler.name}'s passport expires too soon for ${countryName}`,
    detail:
      requiredMonths > 0
        ? `${countryName} wants ${requiredMonths} months of validity beyond your stay — that means valid until ${formatDay(
            requiredUntil.toISOString(),
          )}, but this passport expires ${formatDay(traveler.passportExpiry)}.`
        : `The passport expires ${formatDay(
            traveler.passportExpiry,
          )}, before the trip ends on ${formatDay(tripEnd)}.`,
    itemIds: [],
    verifyWith: VERIFY_NOTE,
  };
}

export function healthAdvisories(ctx: RuleContext): Flag[] {
  const { trip, items } = ctx;

  return destinationCountries(trip, items).flatMap((code): Flag[] => {
    const advisory = healthAdvisory(code);
    const countryName = getCountry(code)?.name ?? code;
    if (!advisory) return [];

    const flags: Flag[] = [
      {
        id: `health:${code}`,
        severity: advisory.notes.length > 0 ? "warning" : "info",
        category: "compliance",
        title: `Health prep for ${countryName}`,
        detail: `${advisory.recommended.join(", ")}.${
          advisory.notes.length > 0 ? ` ${advisory.notes.join(" ")}` : ""
        } Reference data last checked ${advisory.lastVerified}.`,
        itemIds: [],
        verifyWith: "a travel clinic, at least six weeks before you fly",
      },
    ];

    if (advisory.yellowFeverIfArrivingFrom) {
      flags.push({
        id: `yellow-fever:${code}`,
        severity: "info",
        category: "compliance",
        title: `${countryName} asks for yellow fever proof from some countries`,
        detail:
          "Only if you are arriving from, or have recently transited, a country where yellow fever is present. Worth checking against your route.",
        itemIds: [],
        verifyWith: VERIFY_NOTE,
      });
    }

    return flags;
  });
}

export function insuranceCoverage({ trip }: RuleContext): Flag[] {
  return trip.travelers.flatMap((traveler): Flag[] => {
    // Presence is not enough — a date restored from a backup or typed by hand
    // can be unparseable, and that must ask again rather than quietly pass.
    if (!hasDate(traveler.insuranceFrom) || !hasDate(traveler.insuranceTo)) {
      return [
        {
          id: `insurance:${traveler.id}:missing`,
          severity: "info" as const,
          category: "compliance" as const,
          title: `Add insurance dates to check ${traveler.name}'s cover against this trip`,
          detail: "With the policy start and end dates, this checks the trip falls inside them.",
          itemIds: [],
        },
      ];
    }

    const startsLate = daysBetween(traveler.insuranceFrom, trip.startDate) < 0;
    const endsEarly = daysBetween(trip.endDate, traveler.insuranceTo) < 0;
    if (!startsLate && !endsEarly) return [];

    return [
      {
        id: `insurance:${traveler.id}:gap`,
        severity: "warning" as const,
        category: "compliance" as const,
        title: `${traveler.name}'s insurance does not cover the whole trip`,
        detail: `Policy runs ${formatDay(traveler.insuranceFrom)} to ${formatDay(
          traveler.insuranceTo,
        )}, but the trip runs ${formatDay(trip.startDate)} to ${formatDay(trip.endDate)}.`,
        itemIds: [],
      },
    ];
  });
}

/**
 * Someone ticked "I want help with the visa". That changes nothing about what
 * they are allowed to do — the entry checks above already ran for them — but
 * it turns the answer into the steps, in order, for the destinations that
 * actually need paperwork. It is a warning rather than info so it becomes a
 * tickable task rather than a line they read once.
 */
export function visaAssistance(
  ctx: RuleContext,
  provider: EntryRequirementsProvider = localProvider,
): Flag[] {
  const { trip, items } = ctx;
  const asked = trip.travelers.filter((traveler) => traveler.needsVisaHelp);
  if (asked.length === 0) return [];

  const destinations = destinationCountries(trip, items);
  if (destinations.length === 0) return [];

  return asked.flatMap((traveler): Flag[] => {
    if (!traveler.passportCountry?.trim()) {
      return [
        {
          id: `visa-help-passport:${traveler.id}`,
          severity: "warning",
          category: "compliance",
          title: `Add ${traveler.name}'s passport country to walk them through the visa`,
          detail:
            "Which paperwork applies depends entirely on the passport. With it, this lists the steps for each destination in order.",
          itemIds: [],
        },
      ];
    }

    const steps = destinations.flatMap((destination) => {
      const requirement = provider.lookup(traveler.passportCountry, destination);
      const countryName = getCountry(destination)?.name ?? destination;
      const window = windowForCountry(trip, destination);
      const lead = Math.round(daysBetween(ctx.now, window.startDate));

      if (requirement.outcome === "visa-required") {
        return [
          `${countryName}: a visa has to be granted before you fly. Book the consulate or visa-centre appointment first — that slot, not the decision, is usually what runs out. Take the passport, photos to their spec, proof of funds, and your return flight and lodging bookings.${
            lead > 0 ? ` You have ${lead} days.` : ""
          }`,
        ];
      }
      if (requirement.outcome === "e-visa") {
        return [
          `${countryName}: applied for online, but not instant. Apply on the official government portal only — search results are full of paid intermediaries charging for a free form. Have a passport scan and a card ready.${
            lead > 0 ? ` You have ${lead} days.` : ""
          }`,
        ];
      }
      if (requirement.outcome === "visa-on-arrival") {
        return [
          `${countryName}: nothing to do in advance, but land prepared — the fee is often cash only in a specific currency, and they will ask for an onward ticket and an address.${
            requirement.maxStayDays ? ` Good for ${requirement.maxStayDays} days.` : ""
          }`,
        ];
      }
      if (requirement.authorisation) {
        return [
          `${countryName}: no visa, but ${requirement.authorisation} is mandatory and easy to miss. Do it on the official site.`,
        ];
      }
      return [];
    });

    if (steps.length === 0) {
      return [
        {
          id: `visa-help-clear:${traveler.id}`,
          severity: "info",
          category: "compliance",
          title: `${traveler.name} has no visa to arrange for this trip`,
          detail: `Nothing to apply for on a ${traveler.passportCountry} passport for these destinations. Still worth reconfirming close to travel — rules move.`,
          itemIds: [],
          verifyWith: VERIFY_NOTE,
        },
      ];
    }

    return [
      {
        id: `visa-help:${traveler.id}`,
        severity: "warning",
        category: "compliance",
        title: `Walk ${traveler.name} through the visa paperwork`,
        detail: `${steps.join(" ")} Reference data last checked ${
          provider.lookup(traveler.passportCountry, destinations[0]).lastVerified
        }.`,
        itemIds: [],
        verifyWith: VERIFY_NOTE,
      },
    ];
  });
}
