import type { Flag, Trip, TripItem } from "../domain/types";
import {
  bookingMismatches,
  geographicFeasibility,
  layoverFeasibility,
  overbookedDays,
  timeOverlaps,
} from "./conflicts";
import { entryRequirements, insuranceCoverage } from "./compliance";
import { budgetFlags, refundDeadlines } from "./money";
import { cashReadiness, jetLag, powerCompatibility } from "./prep";
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
  entryRequirements,
  insuranceCoverage,
  budgetFlags,
  refundDeadlines,
  powerCompatibility,
  jetLag,
  cashReadiness,
];

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function runChecks(trip: Trip, items: TripItem[], now = new Date()): Flag[] {
  const ctx: RuleContext = { trip, items, now };

  return RULES.flatMap((rule) => rule(ctx)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
