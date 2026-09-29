import type { Trip, TripItem } from "./domain/types";
import type { ItemDraft } from "./extract/types";
import { addItem, startTripFromDraft } from "./store/state";

/**
 * Files a draft into the open trip. With no trip open, the thing being filed
 * becomes the start of one. Read or typed, every item goes in this way.
 */
export function fileDraft(
  trip: Pick<Trip, "id" | "travelers"> | undefined,
  draft: ItemDraft,
  meta: Pick<TripItem, "confidence" | "extractionMethod">,
): TripItem {
  const target = trip ?? { id: startTripFromDraft(draft), travelers: [] };

  return addItem(target.id, draft, {
    confidence: meta.confidence,
    extractionMethod: meta.extractionMethod,
    addedBy: target.travelers[0]?.id,
  });
}
