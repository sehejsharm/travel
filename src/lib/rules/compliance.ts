import type { Flag, Traveler } from "../domain/types";
import { getCountry } from "../reference/countries";
import {
  localProvider,
  VISA_OUTCOME_LABELS,
  type EntryRequirementsProvider,
} from "../reference/entry-requirements";
import { daysBetween, destinationCountries, formatDay, type RuleContext } from "./shared";

const VERIFY_NOTE = "the destination's embassy or official immigration site";

export function entryRequirements(
  ctx: RuleContext,
  provider: EntryRequirementsProvider = localProvider,
): Flag[] {
  const { trip, items } = ctx;
  const flags: Flag[] = [];

  for (const destination of destinationCountries(trip, items)) {
    const country = getCountry(destination);
    const countryName = country?.name ?? destination;

    for (const traveler of trip.travelers) {
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

      const passportFlag = passportValidity(
        traveler,
        countryName,
        requirement.passportValidityMonths,
        trip.endDate,
      );
      if (passportFlag) flags.push(passportFlag);
    }
  }

  return flags;
}

function passportValidity(
  traveler: Traveler,
  countryName: string,
  requiredMonths: number,
  tripEnd: string,
): Flag | undefined {
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

export function insuranceCoverage({ trip }: RuleContext): Flag[] {
  return trip.travelers.flatMap((traveler): Flag[] => {
    if (!traveler.insuranceFrom || !traveler.insuranceTo) {
      return [
        {
          id: `insurance:${traveler.id}:missing`,
          severity: "info" as const,
          category: "compliance" as const,
          title: `No travel insurance recorded for ${traveler.name}`,
          detail: "Add the policy dates and this will check them against the trip.",
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
