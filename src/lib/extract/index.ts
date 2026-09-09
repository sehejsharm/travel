import { extractDeterministic } from "./deterministic";
import { extractWithLlm, hasCredentials } from "./llm";
import { detectLink, fetchLinkMetadata } from "./url";
import {
  ESCALATION_THRESHOLD,
  type DetectedLinkSummary,
  type ExtractionInput,
  type ExtractionResult,
} from "./types";

export { extractDeterministic } from "./deterministic";
export { hasCredentials } from "./llm";
export { detectLink } from "./url";
export * from "./types";

/**
 * Cheapest reliable method first: pattern matching runs on everything and
 * costs nothing, and the model is only paid for when that comes back
 * under-confident.
 */
export async function extract(input: ExtractionInput): Promise<ExtractionResult> {
  const { input: prepared, link } = await resolveLink(input);

  const cheap = extractDeterministic(prepared);
  if (cheap.confidence >= ESCALATION_THRESHOLD) return { ...cheap, link };

  const reason = cheap.foundFields.length
    ? `Pattern pass found only ${cheap.foundFields.join(", ")}.`
    : "Pattern pass found no structured fields.";

  const escalated = await extractWithLlm(prepared, reason);
  if (escalated) return { ...escalated, link };

  return {
    ...cheap,
    link,
    escalationReason: hasCredentials()
      ? `${reason} Model pass unavailable — review the fields below.`
      : `${reason} No API key set, so nothing was escalated.`,
  };
}

/**
 * A pasted Reel or TikTok link tells us the source without the user picking it,
 * and where the platform serves metadata, the title gives the extractor
 * something to read beyond the caption.
 */
async function resolveLink(
  input: ExtractionInput,
): Promise<{ input: ExtractionInput; link?: DetectedLinkSummary }> {
  const detected = detectLink(input.text);
  if (!detected) return { input };

  const metadata = await fetchLinkMetadata(detected);

  return {
    input: {
      ...input,
      source: detected.source,
      sourceRef: detected.url,
      text: metadata ? `${metadata.title}\n${input.text}` : input.text,
    },
    link: {
      platform: detected.platform,
      url: detected.url,
      metadataFetched: Boolean(metadata),
    },
  };
}
