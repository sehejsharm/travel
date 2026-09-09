import { extractDeterministic } from "./deterministic";
import { extractWithLlm, hasCredentials } from "./llm";
import { ESCALATION_THRESHOLD, type ExtractionInput, type ExtractionResult } from "./types";

export { extractDeterministic } from "./deterministic";
export { hasCredentials } from "./llm";
export * from "./types";

/**
 * Cheapest reliable method first: pattern matching runs on everything and
 * costs nothing, and the model is only paid for when that comes back
 * under-confident.
 */
export async function extract(input: ExtractionInput): Promise<ExtractionResult> {
  const cheap = extractDeterministic(input);
  if (cheap.confidence >= ESCALATION_THRESHOLD) return cheap;

  const reason = cheap.foundFields.length
    ? `Pattern pass found only ${cheap.foundFields.join(", ")}.`
    : "Pattern pass found no structured fields.";

  const escalated = await extractWithLlm(input, reason);
  if (escalated) return escalated;

  return {
    ...cheap,
    escalationReason: hasCredentials()
      ? `${reason} Model pass unavailable — review the fields below.`
      : `${reason} No API key set, so nothing was escalated.`,
  };
}
