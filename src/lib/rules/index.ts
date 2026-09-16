import type { Flag, Trip, TripItem } from "../domain/types";
import {
  bookingMismatches,
  geographicFeasibility,
  layoverFeasibility,
  overbookedDays,
  timeOverlaps,
} from "./conflicts";
import {
  entryRequirements,
  healthAdvisories,
  insuranceCoverage,
  visaAssistance,
} from "./compliance";
import { lodgingAfterDeparture, lodgingCoverage, onwardTransport } from "./gaps";
import { baggageAllowance, connectivity, customsAllowance } from "./logistics";
import { budgetFlags, refundDeadlines } from "./money";
import { advanceBookingNeeded, publicHolidays, venueClosures } from "./openings";
import { cashReadiness, jetLag, powerCompatibility, weatherOutlook } from "./prep";
import type { Rule, RuleContext } from "./shared";

export * from "./shared";
export { rollUpBudget, type BudgetRollup } from "./money";
export { destinationBriefs, type DestinationBrief } from "./prep";

const RULES: Rule[] = [
  timeOverlaps,
  geographicFeasibility,
  layoverFeasibility,
  bookingMismatches,
  overbookedDays,
  venueClosures,
  advanceBookingNeeded,
  lodgingCoverage,
  lodgingAfterDeparture,
  onwardTransport,
  entryRequirements,
  visaAssistance,
  healthAdvisories,
  insuranceCoverage,
  budgetFlags,
  refundDeadlines,
  customsAllowance,
  baggageAllowance,
  powerCompatibility,
  weatherOutlook,
  jetLag,
  cashReadiness,
  connectivity,
  publicHolidays,
];

/**
 * Rules whose whole premise is *when* you travel. A trip without dates yet
 * has a provisional window, and claiming a visa lead time or a weather
 * outlook against a placeholder would be worse than staying quiet.
 */
const NEEDS_DATES: Rule[] = [
  entryRequirements,
  visaAssistance,
  healthAdvisories,
  insuranceCoverage,
  weatherOutlook,
  jetLag,
  publicHolidays,
  refundDeadlines,
];

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function runChecks(trip: Trip, items: TripItem[], now = new Date()): Flag[] {
  const ctx: RuleContext = { trip, items, now };
  const active = trip.datesTbd ? RULES.filter((rule) => !NEEDS_DATES.includes(rule)) : RULES;

  return active.flatMap((rule) => rule(ctx)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
