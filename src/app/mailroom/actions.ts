"use server";

import type { SourceKind } from "@/lib/domain/types";
import { extract, type ExtractionResult } from "@/lib/extract";

export async function runExtraction(
  text: string,
  source: SourceKind,
): Promise<ExtractionResult> {
  return extract({ text, source });
}
