import type { Flag } from "../domain/types";
import { baggageForFlight, dutyFreeAllowance } from "../reference/allowances";
import { getCountry } from "../reference/countries";
import { convert, formatMoney } from "../reference/fx";
import { destinationCountries, type RuleContext } from "./shared";

export function baggageAllowance({ items }: RuleContext): Flag[] {
  const allowances = new Map<string, ReturnType<typeof baggageForFlight>>();

  for (const item of items) {
    if (item.bookingKind !== "flight") continue;
    const allowance = baggageForFlight(item.title);
    if (allowance) allowances.set(allowance.airline, allowance);
  }

  if (allowances.size === 0) return [];

  const shopping = items.filter((item) => item.category === "purchase").length;
  const lines = [...allowances.values()].map(
    (allowance) =>
      `${allowance!.airline}: ${allowance!.checkedKg} kg checked, ${allowance!.cabinKg} kg cabin${
        allowance!.note ? ` (${allowance!.note})` : ""
      }`,
  );

  return [
    {
      id: "baggage",
      severity: "info",
      category: "prep",
      title: shopping > 0 ? `${shopping} things to buy, and this much room for them` : "Your baggage allowance",
      detail: `${lines.join(". ")}. Economy allowances — a cheaper fare class may give you less.`,
      itemIds: [],
    },
  ];
}

export function customsAllowance({ trip, items }: RuleContext): Flag[] {
  const allowance = dutyFreeAllowance(trip.homeCountry);
  if (!allowance) return [];

  const purchases = items.filter((item) => item.category === "purchase" && item.cost);
  if (purchases.length === 0) return [];

  const total = purchases.reduce((sum, item) => {
    const converted = convert(item.cost!.amount, item.cost!.currency, allowance.currency);
    return sum + (converted ?? 0);
  }, 0);

  const over = total > allowance.amount;

  return [
    {
      id: "customs",
      severity: over ? "warning" : "info",
      category: "money",
      title: over
        ? `Your shopping list is over the ${trip.homeCountry} duty-free allowance`
        : `Duty-free allowance coming home: ${formatMoney(allowance.amount, allowance.currency)}`,
      detail: `${formatMoney(total, allowance.currency)} of purchases filed against a ${formatMoney(
        allowance.amount,
        allowance.currency,
      )} allowance. ${allowance.note}.${over ? " Anything over is declarable." : ""}`,
      itemIds: purchases.map((item) => item.id),
    },
  ];
}

export function connectivity(ctx: RuleContext): Flag[] {
  const { trip, items } = ctx;

  return destinationCountries(trip, items).flatMap((code): Flag[] => {
    const country = getCountry(code);
    if (!country) return [];

    return [
      {
        id: `roaming:${code}`,
        severity: "info",
        category: "prep",
        title: `Sort data for ${country.name} before you land`,
        detail:
          "A travel eSIM bought in advance is almost always cheaper than switching on roaming at the airport, and it works the moment you land.",
        itemIds: [],
      },
    ];
  });
}
