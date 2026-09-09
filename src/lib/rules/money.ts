import type { Flag, ItemCategory, Trip, TripItem } from "../domain/types";
import { convert, formatMoney } from "../reference/fx";
import { daysBetween, formatDay, type RuleContext } from "./shared";

export interface BudgetLine {
  category: ItemCategory;
  planned: number;
  actual: number;
}

export interface BudgetRollup {
  currency: string;
  planned: number;
  actual: number;
  total: number;
  target?: number;
  lines: BudgetLine[];
  unpricedCount: number;
  unconvertedCount: number;
}

const CATEGORY_ORDER: ItemCategory[] = ["booking", "activity", "place", "purchase"];

/**
 * The budget builds itself from whatever has been filed, so items with no
 * price are counted separately rather than silently treated as zero.
 */
export function rollUpBudget(trip: Trip, items: TripItem[]): BudgetRollup {
  const currency = trip.budgetTarget?.currency ?? "USD";
  const lines = new Map<ItemCategory, BudgetLine>(
    CATEGORY_ORDER.map((category) => [category, { category, planned: 0, actual: 0 }]),
  );

  let unpricedCount = 0;
  let unconvertedCount = 0;

  for (const item of items) {
    if (!item.cost) {
      unpricedCount++;
      continue;
    }

    const converted = convert(item.cost.amount, item.cost.currency, currency);
    if (converted === undefined) {
      unconvertedCount++;
      continue;
    }

    const line = lines.get(item.category)!;
    if (item.costStatus === "actual") line.actual += converted;
    else line.planned += converted;
  }

  const all = [...lines.values()];
  const planned = all.reduce((sum, line) => sum + line.planned, 0);
  const actual = all.reduce((sum, line) => sum + line.actual, 0);

  return {
    currency,
    planned,
    actual,
    total: planned + actual,
    target: trip.budgetTarget?.amount,
    lines: all.filter((line) => line.planned > 0 || line.actual > 0),
    unpricedCount,
    unconvertedCount,
  };
}

export function budgetFlags({ trip, items }: RuleContext): Flag[] {
  const rollup = rollUpBudget(trip, items);
  const flags: Flag[] = [];

  if (rollup.target !== undefined && rollup.total > rollup.target) {
    flags.push({
      id: "budget:over",
      severity: "warning",
      category: "money",
      title: `Filed spend is over budget by ${formatMoney(
        rollup.total - rollup.target,
        rollup.currency,
      )}`,
      detail: `${formatMoney(rollup.total, rollup.currency)} filed against a ${formatMoney(
        rollup.target,
        rollup.currency,
      )} target, and that is before anything without a price.`,
      itemIds: [],
    });
  }

  if (rollup.unpricedCount > 0) {
    flags.push({
      id: "budget:unpriced",
      severity: "info",
      category: "money",
      title: `${rollup.unpricedCount} filed item${rollup.unpricedCount === 1 ? " has" : "s have"} no price yet`,
      detail: "They are left out of the total rather than guessed at. Add a price to fold them in.",
      itemIds: items.filter((item) => !item.cost).map((item) => item.id),
    });
  }

  return flags;
}

const REFUND_WARNING_DAYS = 10;

export function refundDeadlines({ items, now }: RuleContext): Flag[] {
  return items
    .filter((item) => item.refundableUntil)
    .flatMap((item) => {
      const days = daysBetween(now, item.refundableUntil!);
      if (days < 0 || days > REFUND_WARNING_DAYS) return [];

      return [
        {
          id: `refund:${item.id}`,
          severity: days <= 3 ? ("warning" as const) : ("info" as const),
          category: "money" as const,
          title: `Free cancellation on ${item.title} ends ${formatDay(item.refundableUntil!)}`,
          detail: `${Math.max(0, Math.floor(days))} day${
            Math.floor(days) === 1 ? "" : "s"
          } left to cancel without losing ${
            item.cost ? formatMoney(item.cost.amount, item.cost.currency) : "the deposit"
          }.`,
          itemIds: [item.id],
        },
      ];
    });
}
