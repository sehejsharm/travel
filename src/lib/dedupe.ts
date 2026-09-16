import type { ItemDraft } from "./extract/types";
import type { TripItem } from "./domain/types";

/**
 * The same booking arrives twice all the time — the confirmation email, then
 * a screenshot of it, then the airline's reminder. Filing all three silently
 * is how a cabinet stops being trustworthy, so a likely repeat is offered as
 * a merge instead.
 */

export interface DuplicateMatch {
  item: TripItem;
  /** 0 to 1. Only matches above the threshold are ever shown. */
  score: number;
  /** Why we think it is the same thing, in the user's words. */
  reason: string;
}

const THRESHOLD = 0.62;
const SAME_DAY = 36 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  // Single letters carry no signal and inflate short-title overlap.
  return new Set(normalize(value).split(" ").filter((word) => word.length > 1));
}

/** Overlap of the two token sets, which handles reordering and extra words. */
function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;

  return shared / Math.min(left.size, right.size);
}

export function findDuplicates(draft: ItemDraft, items: TripItem[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const item of items) {
    // A confirmation code is an identifier, so it settles the question alone.
    if (
      draft.confirmationCode &&
      item.confirmationCode &&
      draft.confirmationCode.toUpperCase() === item.confirmationCode.toUpperCase()
    ) {
      matches.push({ item, score: 1, reason: `Same confirmation code, ${item.confirmationCode}` });
      continue;
    }

    const titleScore = similarity(draft.title, item.title);
    const placeScore =
      draft.place?.name && item.place?.name ? similarity(draft.place.name, item.place.name) : 0;

    const sameTime =
      draft.startsAt && item.startsAt
        ? Math.abs(Date.parse(draft.startsAt) - Date.parse(item.startsAt)) < SAME_DAY
        : false;

    // A name alone is weak; a name plus a place or a time is not.
    const score = Math.min(1, titleScore * 0.7 + placeScore * 0.2 + (sameTime ? 0.25 : 0));
    if (score < THRESHOLD) continue;

    const reasons = [
      titleScore > 0.5 && "a very similar name",
      placeScore > 0.5 && "the same place",
      sameTime && "the same time",
    ].filter(Boolean) as string[];

    matches.push({ item, score, reason: `Has ${reasons.join(" and ")}` });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Merging keeps what the existing entry already knows and fills its gaps from
 * the new one. Nothing already filed is overwritten — the second copy is
 * usually the thinner of the two.
 */
export function mergeInto(item: TripItem, draft: ItemDraft): Partial<TripItem> {
  return {
    place: item.place ?? draft.place,
    arrivalPlace: item.arrivalPlace ?? draft.arrivalPlace,
    startsAt: item.startsAt ?? draft.startsAt,
    endsAt: item.endsAt ?? draft.endsAt,
    cost: item.cost ?? draft.cost,
    costStatus: item.costStatus ?? draft.costStatus,
    confirmationCode: item.confirmationCode ?? draft.confirmationCode,
    travelerName: item.travelerName ?? draft.travelerName,
    refundableUntil: item.refundableUntil ?? draft.refundableUntil,
    bookingKind: item.bookingKind ?? draft.bookingKind,
    notes: [item.notes, draft.notes].filter(Boolean).join("\n") || undefined,
  };
}
