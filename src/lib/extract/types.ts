import type { ExtractionMethod, SourceKind, TripItem } from "../domain/types";

export type ItemDraft = Omit<
  TripItem,
  "id" | "tripId" | "createdAt" | "confidence" | "extractionMethod"
>;

export interface ExtractionInput {
  text: string;
  source: SourceKind;
  sourceRef?: string;
  /** Anchors year-less dates. Defaults to today. */
  today?: Date;
}

export interface ExtractionResult {
  draft: ItemDraft;
  confidence: number;
  method: ExtractionMethod;
  /** Field names the pass actually filled, for the preview UI. */
  foundFields: string[];
  /** Set when a cheap pass was escalated, explaining why. */
  escalationReason?: string;
}

/** Below this, the deterministic pass has not found enough to be trusted. */
export const ESCALATION_THRESHOLD = 0.6;
