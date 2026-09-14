import { communityPicks } from "./community";
import { getInterest } from "./interests";
import { hasPlacesKey, searchPlaces } from "./places";
import { citationsAsCandidates, hasSearchCredentials, searchTheWeb } from "./search";
import type { AdviceRequest, AdviceResult, Candidate, SourceTier } from "./types";
import { fallbackSections, verify } from "./verify";
import { writeAdvice } from "./write";

/** Enough answers under one heading that the section feels considered. */
const TARGET_PER_SECTION = 4;

/**
 * The waterfall. Each tier costs more than the one above it, so a tier only
 * runs when the ones above it left a section short. What comes back is
 * written from the material collected here and nowhere else.
 */
export async function advise(request: AdviceRequest): Promise<AdviceResult> {
  const interests = request.interests
    .map((id) => getInterest(id))
    .filter((interest): interest is NonNullable<typeof interest> => Boolean(interest));

  const notes: string[] = [];
  const tiersUsed: SourceTier[] = [];
  const candidates: Candidate[] = [];

  // Tier 1 — their own saved content. Free, and the most personal.
  if (request.saved.length > 0) {
    candidates.push(...request.saved);
    tiersUsed.push("saved");
  }

  // Tier 2 — trips other people published. Free, and real trips.
  const community = communityPicks(request.destination, request.interests);
  if (community.length > 0) {
    candidates.push(...community);
    tiersUsed.push("community");
  }

  // Tier 3 — Google Places, for the sections still thin.
  let thin = thinInterests(candidates, interests.map((interest) => interest.id));

  if (thin.length > 0 && hasPlacesKey()) {
    const found = await Promise.all(
      thin.map((id) => {
        const interest = getInterest(id);
        return searchPlaces(`${interest?.looksFor ?? id} in ${request.destination}`);
      }),
    );

    const flat = found.flat();
    if (flat.length > 0) {
      candidates.push(...flat);
      tiersUsed.push("places");
    }
    thin = thinInterests(candidates, interests.map((interest) => interest.id));
  } else if (thin.length > 0 && !hasPlacesKey()) {
    notes.push("Google Places is not configured, so nearby lookups were skipped.");
  }

  // Tier 4 — the open web. Paid, so only for what is still missing.
  let findingsText: string | undefined;

  if (thin.length > 0 && hasSearchCredentials()) {
    const topics = thin.map((id) => getInterest(id)?.looksFor ?? id);
    const findings = await searchTheWeb(request.destination, topics);

    if (findings) {
      findingsText = findings.text;
      candidates.push(...citationsAsCandidates(findings));
      tiersUsed.push("web");
    }
  } else if (thin.length > 0 && !hasSearchCredentials()) {
    notes.push("Web search needs an Anthropic API key, so the last tier was skipped.");
  }

  const written = await writeAdvice(
    request.destination,
    interests.map((interest) => ({ id: interest.id, label: interest.label })),
    candidates,
    findingsText,
  );

  const sections = written
    ? verify(written, candidates, request, findingsText)
    : fallbackSections(candidates, request);

  return {
    destination: request.destination,
    countryCode: request.countryCode,
    sections,
    tiersUsed,
    generatedAt: new Date().toISOString(),
    notes: notes.length > 0 ? notes : undefined,
  };
}

/**
 * Sections with fewer than the target, which is what opens the next tier.
 * Their own saves do not count: they are context for the write step, never
 * something to hand back, so a trip full of them still needs a real tier.
 */
function thinInterests(candidates: Candidate[], interestIds: string[]): string[] {
  const usable = candidates.filter((candidate) => candidate.tier !== "saved");

  // Only the community tier tags its picks by interest, so a section counts as
  // covered once there is enough untagged material to fill it.
  const tagged = new Map<string, number>();
  let untagged = 0;

  for (const candidate of usable) {
    if (candidate.interestId) tagged.set(candidate.interestId, (tagged.get(candidate.interestId) ?? 0) + 1);
    else untagged++;
  }

  const spare = Math.floor(untagged / Math.max(interestIds.length, 1));
  return interestIds.filter((id) => (tagged.get(id) ?? 0) + spare < TARGET_PER_SECTION);
}

export { INTERESTS, getInterest, DEFAULT_INTERESTS } from "./interests";
export { TIER_LABELS } from "./types";
export type { AdviceRequest, AdviceResult, AdviceSection, Suggestion, SourceTier } from "./types";
