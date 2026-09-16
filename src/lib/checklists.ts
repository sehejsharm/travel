import type { Flag, Trip, TripItem } from "./domain/types";
import { weatherFor } from "./reference/climate";
import { getCountry } from "./reference/countries";
import { affected, destinationCountries, nameList, originGroups } from "./rules/shared";
import { getPurpose } from "./trip-purpose";

export type ChecklistKind = "packing" | "task";

export interface ChecklistEntry {
  id: string;
  tripId: string;
  kind: ChecklistKind;
  label: string;
  detail?: string;
  /** Set where the entry was generated rather than typed by a person. */
  generatedFrom?: string;
  /** The check this came from, so ticking it can settle that check. */
  sourceFlagId?: string;
  assigneeId?: string;
  done: boolean;
  createdAt: string;
}

export type GeneratedEntry = Pick<
  ChecklistEntry,
  "label" | "detail" | "generatedFrom" | "sourceFlagId"
>;

const BASE_PACKING: GeneratedEntry[] = [
  { label: "Passport", generatedFrom: "every trip" },
  { label: "Phone charger", generatedFrom: "every trip" },
  { label: "Card that works abroad", generatedFrom: "every trip" },
];

/**
 * Builds the packing list from the trip itself — the weather where you are
 * going, the sockets there, how long you are away, and what you have filed to
 * do — rather than from a generic template.
 */
export function generatePacking(trip: Trip, items: TripItem[]): GeneratedEntry[] {
  const entries = [...BASE_PACKING];
  const origins = originGroups(trip);
  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86_400_000,
    ),
  );

  entries.push({
    label: `Clothes for ${nights} night${nights === 1 ? "" : "s"}`,
    detail: "Laundry once is usually lighter than packing for every day.",
    generatedFrom: "trip length",
  });

  for (const code of destinationCountries(trip, items)) {
    const country = getCountry(code);
    if (!country) continue;

    const weather = weatherFor(code, trip.startDate, trip.endDate);
    if (weather) {
      entries.push({
        label: `Layers for ${weather.lowC}–${weather.highC}°C`,
        detail: `Seasonal normals for ${weather.referenceCity} across your dates.`,
        generatedFrom: `${country.name} climate`,
      });

      if (weather.lowC <= 10) {
        entries.push({
          label: "Warm layer",
          detail: `Nights drop to about ${weather.lowC}°C in ${country.name}.`,
          generatedFrom: `${country.name} climate`,
        });
      }
      if (weather.highC >= 28) {
        entries.push({
          label: "Sun protection",
          detail: `Days reach about ${weather.highC}°C in ${country.name}.`,
          generatedFrom: `${country.name} climate`,
        });
      }
      if (weather.wet) {
        entries.push({
          label: "Rain jacket or umbrella",
          detail: `You are travelling in ${country.name}'s wet season.`,
          generatedFrom: `${country.name} climate`,
        });
      }
    }

    // Whose plugs fit depends on where each person set off from — but the
    // adapter itself usually does not, so this packs one line unless the
    // answer genuinely differs across the party.
    const needsAdapter = affected(origins, (group) => {
      const from = getCountry(group.countryCode);
      return Boolean(from) && !country.plugTypes.some((type) => from!.plugTypes.includes(type));
    });

    if (needsAdapter) {
      const froms = needsAdapter.groups
        .map((group) => getCountry(group.countryCode))
        .filter((from): from is NonNullable<typeof from> => Boolean(from));

      entries.push({
        label: needsAdapter.everyone
          ? `Type ${country.plugTypes.join("/")} plug adapter`
          : `Type ${country.plugTypes.join("/")} plug adapter for ${nameList(needsAdapter.travelers)}`,
        detail: `${country.name} sockets will not take ${froms
          .map((from) => `Type ${from.plugTypes.join(", ")}${origins.length > 1 ? ` (${from.name})` : ""}`)
          .join(" or ")} plugs.`,
        generatedFrom: `${country.name} sockets`,
      });
    }

    if (country.cashPreference === "cash-heavy") {
      entries.push({
        label: `Cash in ${country.currency}`,
        detail: `Plenty of places in ${country.name} take nothing else.`,
        generatedFrom: `${country.name} payments`,
      });
    }
  }

  const walking = items.filter(
    (item) => item.category === "place" || item.category === "activity",
  ).length;
  if (walking >= 5) {
    entries.push({
      label: "Shoes you can walk all day in",
      detail: `${walking} places and activities are filed for this trip.`,
      generatedFrom: "your filed items",
    });
  }

  return dedupe(entries);
}

/**
 * Pre-trip tasks come from the checks — anything that needs doing before
 * departure becomes something you can tick off, instead of a warning you read
 * once and forget.
 */
/**
 * Tasks a kind of trip always seems to need, regardless of what the checks
 * found. Business travel is the clear case: nothing in the plan tells you to
 * keep receipts, but every business traveller has to.
 */
export function purposeTasks(trip: Trip): GeneratedEntry[] {
  return (getPurpose(trip.purpose)?.tasks ?? []).map((task) => ({
    label: task.label,
    detail: task.detail,
    generatedFrom: `${getPurpose(trip.purpose)?.label.toLowerCase()} trip`,
  }));
}

export function generateTasks(flags: Flag[]): GeneratedEntry[] {
  const actionable = flags.filter(
    (flag) =>
      flag.severity !== "info" &&
      (flag.category === "compliance" || flag.category === "money" || flag.category === "conflict"),
  );

  return dedupe(
    actionable.map((flag) => ({
      label: flag.title,
      detail: flag.detail,
      generatedFrom: `${flag.category} check`,
      sourceFlagId: flag.id,
    })),
  );
}

function dedupe(entries: GeneratedEntry[]): GeneratedEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.label)) return false;
    seen.add(entry.label);
    return true;
  });
}
