import type { PlaceRef } from "../domain/types";
import { groundPlace } from "../reference/places";
import type { AdviceRequest, AdviceSection, Candidate, Suggestion } from "./types";

/** The shape the write step returns, before any of it has been believed. */
export interface WrittenSections {
  sections: {
    interestId: string;
    suggestions: { name: string; why: string; city: string | null; priceHint: string | null }[];
  }[];
}

/**
 * "Drop what isn't real." A suggestion survives only if its name is traceable
 * to something a tier actually returned — a candidate, or the search text.
 */
export function verify(
  written: WrittenSections,
  candidates: Candidate[],
  request: AdviceRequest,
  findingsText?: string,
): AdviceSection[] {
  const haystack = findingsText?.toLowerCase() ?? "";
  const filed = new Set(request.alreadyFiled.map(normalize));
  const seen = new Set<string>();

  return written.sections
    .map((section) => ({
      interestId: section.interestId,
      suggestions: section.suggestions.flatMap((suggestion, index): Suggestion[] => {
        const key = normalize(suggestion.name);
        if (!key || seen.has(key) || filed.has(key)) return [];

        const source = candidates.find((candidate) => namesMatch(candidate.name, suggestion.name));
        const inFindings = haystack.includes(suggestion.name.toLowerCase());
        if (!source && !inFindings) return [];

        // Their own saves are context for the write step, not an answer: being
        // told about a place you already filed is not a suggestion.
        if (source?.tier === "saved") return [];
        if (isTransit(suggestion.name)) return [];

        seen.add(key);

        return [
          {
            id: `${section.interestId}-${index}-${key.slice(0, 24)}`,
            interestId: section.interestId,
            name: suggestion.name,
            why: suggestion.why,
            place: placeFor(suggestion.name, suggestion.city ?? source?.city, request),
            tier: source?.tier ?? "web",
            attribution: source?.attribution,
            url: source?.url,
            priceHint: suggestion.priceHint ?? undefined,
          },
        ];
      }),
    }))
    .filter((section) => section.suggestions.length > 0);
}

/**
 * Used when the write step is unavailable. Only the community tier carries a
 * section and a real line of its own, so that is all this shows — a heap of
 * bare place names under a heading they do not belong to is worse than saying
 * nothing, which is what an empty result lets the route do.
 */
export function fallbackSections(
  candidates: Candidate[],
  request: AdviceRequest,
): AdviceSection[] {
  const filed = new Set(request.alreadyFiled.map(normalize));
  const seen = new Set<string>();
  const byInterest = new Map<string, Suggestion[]>();

  for (const candidate of candidates) {
    if (candidate.tier !== "community" || !candidate.interestId || !candidate.detail) continue;

    const key = normalize(candidate.name);
    if (!key || seen.has(key) || filed.has(key) || isTransit(candidate.name)) continue;
    seen.add(key);

    const list = byInterest.get(candidate.interestId) ?? [];
    list.push({
      id: `seed-${candidate.interestId}-${key.slice(0, 24)}`,
      interestId: candidate.interestId,
      name: candidate.name,
      why: candidate.detail,
      place: placeFor(candidate.name, candidate.city, request),
      tier: candidate.tier,
      attribution: candidate.attribution,
      url: candidate.url,
    });
    byInterest.set(candidate.interestId, list);
  }

  // Keep the order the traveller picked their sections in.
  return request.interests
    .filter((interestId) => byInterest.has(interestId))
    .map((interestId) => ({ interestId, suggestions: byInterest.get(interestId)! }));
}

/**
 * Airports and stations are how you get there, not something to do. The
 * gazetteer settles it for names like "Tokyo Haneda" that read like places.
 */
function isTransit(name: string): boolean {
  if (/\b(airport|airways|terminal|station)\b/i.test(name) || /\([A-Z]{3}\)\s*$/.test(name)) {
    return true;
  }
  return /\([A-Z]{3}\)/.test(groundPlace(name)?.name ?? "");
}

/** Ground the name where we can; fall back to the destination's own pin. */
function placeFor(name: string, city: string | undefined, request: AdviceRequest): PlaceRef {
  const grounded = groundPlace(name) ?? (city ? groundPlace(city) : undefined);
  if (grounded) return { ...grounded, name };

  const destination = groundPlace(request.destination);
  return {
    name,
    city: city ?? destination?.city ?? request.destination,
    countryCode: request.countryCode ?? destination?.countryCode,
    point: destination?.point,
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose enough for "Senso-ji Temple" to match "Senso-ji", strict otherwise. */
function namesMatch(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

