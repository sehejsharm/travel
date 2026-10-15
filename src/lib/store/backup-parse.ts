import { z } from "zod";
import { TIER_LABELS } from "../advisor/types";
import type { ChecklistKind } from "../checklists";
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  type BookingKind,
  type CostStatus,
  type ExtractionMethod,
  type TripPurpose,
} from "../domain/types";
import { BACKUP_VERSION, backupSizeError, type Backup } from "./backup";

/*
 * Reading a backup file back in. Its own module, loaded only when someone
 * restores a file: the record checks need zod, and nothing else on the More
 * screen (or any screen it is prefetched from) should pay for that.
 */

/* ------------------------------------------------------- record shapes */

/*
 * What every record in a backup must look like before it is let into the
 * store. A record with a field of the wrong type would otherwise load, and
 * then break whichever screen first calls a string method on a number.
 *
 * Unknown fields are kept rather than stripped, so nothing a later version
 * adds is lost on the way through. A field the types call optional may also
 * be null, which hand-written JSON often uses for "not set", and is read as
 * absent. Dates are only held to being text: the checks already treat an
 * unparseable date as missing and ask for it again, and refusing a whole
 * backup over one date would lock someone out of everything else in it.
 */

function optional<T extends z.ZodType>(schema: T) {
  return schema.nullish().transform((value) => value ?? undefined);
}

/** A closed list of values, kept in step with its type by the Record. */
function oneOf<T extends string>(values: Record<T, unknown>) {
  return z.enum(Object.keys(values) as [T, ...T[]]);
}

const BOOKING_KINDS: Record<BookingKind, true> = {
  flight: true,
  lodging: true,
  rail: true,
  car: true,
  tour: true,
  other: true,
};
const COST_STATUSES: Record<CostStatus, true> = { estimated: true, actual: true };
const EXTRACTION_METHODS: Record<ExtractionMethod, true> = { deterministic: true, llm: true };
const CHECKLIST_KINDS: Record<ChecklistKind, true> = { packing: true, task: true };
const PURPOSE_IDS: Record<TripPurpose, true> = {
  leisure: true,
  business: true,
  family: true,
  romantic: true,
  solo: true,
  group: true,
  backpacking: true,
};

const id = z.string().min(1);
const text = z.string();
const texts = z.array(text);

const money = z.looseObject({ amount: z.number(), currency: text });

const place = z.looseObject({
  name: text,
  city: optional(text),
  countryCode: optional(text),
  point: optional(
    z.looseObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  ),
  airport: optional(text),
});

const traveler = z.looseObject({
  id,
  name: text,
  passportCountry: text,
  passportExpiry: text,
  insuranceFrom: optional(text),
  insuranceTo: optional(text),
  originCountry: optional(text),
  needsVisaHelp: optional(z.boolean()),
});

const leg = z.looseObject({
  id,
  countryCode: text,
  city: optional(text),
  startDate: text,
  endDate: text,
});

const trip = z.looseObject({
  id,
  name: text,
  homeCountry: text,
  destinationCountries: optional(texts),
  startDate: text,
  endDate: text,
  budgetTarget: optional(money),
  travelers: z.array(traveler),
  interests: optional(texts),
  datesTbd: optional(z.boolean()),
  dismissedPrompts: optional(texts),
  purpose: optional(oneOf(PURPOSE_IDS)),
  legs: optional(z.array(leg)),
  accentHue: optional(z.number()),
});

const item = z.looseObject({
  id,
  tripId: id,
  title: text,
  category: oneOf(CATEGORY_LABELS),
  bookingKind: optional(oneOf(BOOKING_KINDS)),
  source: oneOf(SOURCE_LABELS),
  sourceRef: optional(text),
  notes: optional(text),
  place: optional(place),
  arrivalPlace: optional(place),
  startsAt: optional(text),
  endsAt: optional(text),
  cost: optional(money),
  costStatus: optional(oneOf(COST_STATUSES)),
  confirmationCode: optional(text),
  travelerName: optional(text),
  refundableUntil: optional(text),
  confidence: z.number(),
  extractionMethod: oneOf(EXTRACTION_METHODS),
  createdAt: text,
  addedBy: optional(text),
});

const checklistEntry = z.looseObject({
  id,
  tripId: id,
  kind: oneOf(CHECKLIST_KINDS),
  label: text,
  detail: optional(text),
  generatedFrom: optional(text),
  sourceFlagId: optional(text),
  assigneeId: optional(text),
  done: z.boolean(),
  createdAt: text,
});

const tier = oneOf(TIER_LABELS);

const suggestion = z.looseObject({
  id: text,
  interestId: text,
  name: text,
  why: text,
  place,
  tier,
  attribution: optional(text),
  url: optional(text),
  priceHint: optional(text),
});

const cachedAdvice = z.looseObject({
  tripId: text,
  key: text,
  result: z.looseObject({
    destination: text,
    countryCode: optional(text),
    sections: z.array(z.looseObject({ interestId: text, suggestions: z.array(suggestion) })),
    tiersUsed: z.array(tier),
    generatedAt: text,
    notes: optional(texts),
  }),
});

const backupState = z.looseObject({
  trips: z.array(trip),
  activeTripId: optional(text),
  items: z.array(item),
  // Absent from backups taken before these lists existed.
  checklist: optional(z.array(checklistEntry)),
  advice: optional(z.array(cachedAdvice)),
});

/* ------------------------------------------------- saying what is wrong */

/** The lists whose entries are records, and what one of each is called. */
const RECORD_NOUNS: Record<string, string> = {
  trips: "trip",
  items: "filed item",
  checklist: "checklist entry",
  advice: "saved suggestion list",
  travelers: "traveller",
  legs: "leg",
  sections: "section",
  suggestions: "suggestion",
};

const FIELD_NAMES: Record<string, string> = {
  items: "filed items",
  travelers: "travellers",
  advice: "saved suggestions",
};

function isRecord(value: unknown): value is Record<string | number, unknown> {
  return typeof value === "object" && value !== null;
}

function fieldName(key: PropertyKey): string {
  if (typeof key === "number") return String(key + 1);
  const name = String(key);
  return FIELD_NAMES[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

/** A record's own name, so the message points at the one to fix. */
function nameOf(record: unknown): string | undefined {
  if (!isRecord(record)) return undefined;
  const name = [record.name, record.title, record.label].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  if (!name) return undefined;
  return name.length > 40 ? `${name.slice(0, 39)}…` : name;
}

function problemWith(issue: z.core.$ZodIssue, value: unknown): string {
  if (value === undefined) return "is missing";

  switch (issue.code) {
    case "invalid_type":
      switch (issue.expected) {
        case "string":
          return "should be text";
        case "number":
          return "should be a number";
        case "boolean":
          return "should be true or false";
        case "array":
          return "should be a list";
        default:
          return "is not in the right shape";
      }
    case "invalid_value":
      return `is “${String(value).slice(0, 40)}”, which Manifest does not know`;
    case "too_small":
      return typeof value === "string" ? "is empty" : "is out of range";
    case "too_big":
      return "is out of range";
    default:
      return "is not valid";
  }
}

/**
 * "Trip 2 (“Japan”), traveller 1 (“Asha”): passport expiry is missing." —
 * the record by its position and name, then the field, then what is wrong
 * with it, so a hand-edited file can be fixed by reading the message.
 */
function describeIssue(issue: z.core.$ZodIssue, root: unknown): string {
  const where: string[] = [];
  const field: string[] = [];
  let value: unknown = root;

  for (let index = 0; index < issue.path.length; index += 1) {
    const key = issue.path[index];
    const next = issue.path[index + 1];
    const container = isRecord(value) ? value[key as string | number] : undefined;

    if (typeof key === "string" && typeof next === "number" && key in RECORD_NOUNS) {
      const record = Array.isArray(container) ? container[next] : undefined;
      const name = nameOf(record);
      where.push(`${RECORD_NOUNS[key]} ${next + 1}${name ? ` (“${name}”)` : ""}`);
      field.length = 0;
      value = record;
      index += 1;
      continue;
    }

    field.push(fieldName(key));
    value = container;
  }

  const problem = problemWith(issue, value);
  const place = where.join(", ");
  const sentence = field.length
    ? `${place ? `${place}: ` : ""}${field.join(" › ")} ${problem}`
    : `${place} ${problem}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/* ------------------------------------------------------------- reading */

/** Parsed and checked rather than trusted — this file came off a disk. */
export function parseBackup(text: string): Backup | { error: string } {
  const tooLarge = backupSizeError(text.length);
  if (tooLarge) return { error: tooLarge };

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "That file is not JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { error: "That file is not a Manifest backup." };
  }

  const candidate = parsed as Partial<Backup>;
  if (candidate.format !== "manifest.backup") {
    return { error: "That file is not a Manifest backup." };
  }

  if (typeof candidate.version !== "number" || !Number.isInteger(candidate.version) || candidate.version < 1) {
    return { error: "That file is not a Manifest backup." };
  }

  if (candidate.version > BACKUP_VERSION) {
    return { error: "That backup came from a newer version of Manifest." };
  }

  const raw: unknown = candidate.state;
  if (!isRecord(raw) || !Array.isArray(raw.trips)) {
    return { error: "That backup is missing its trips." };
  }
  if (!Array.isArray(raw.items)) {
    return { error: "That backup is missing its filed items." };
  }

  const checked = backupState.safeParse(raw);
  if (!checked.success) {
    const [first, ...rest] = checked.error.issues;
    const more = rest.length
      ? ` There ${rest.length === 1 ? "is 1 more problem" : `are ${rest.length} more problems`} after that one.`
      : "";
    return {
      error: `That backup is damaged, so nothing was restored. ${describeIssue(first, raw)}${more}`,
    };
  }

  const { trips, items, checklist, advice, activeTripId } = checked.data;

  return {
    format: "manifest.backup",
    version: candidate.version,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
    state: {
      trips,
      // One that names no trip in the file would leave nothing selected.
      activeTripId: trips.some((entry) => entry.id === activeTripId)
        ? (activeTripId as string)
        : (trips[0]?.id ?? ""),
      items,
      checklist: checklist ?? [],
      advice: advice ?? [],
    },
  };
}

