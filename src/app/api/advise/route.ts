import { advise } from "@/lib/advisor";
import { INTERESTS } from "@/lib/advisor/interests";
import type { Candidate } from "@/lib/advisor/types";

/** A destination name, not an essay. */
const MAX_DESTINATION = 120;
const MAX_INTERESTS = 8;
/** Their own saved items are the first tier, but a trip is not unbounded. */
const MAX_SAVED = 60;
/** Titles and place names both, so a filed place is not suggested back. */
const MAX_FILED = 120;

const VALID_INTERESTS = new Set(INTERESTS.map((interest) => interest.id));

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { destination, countryCode, interests, alreadyFiled, saved } = (payload ?? {}) as {
    destination?: unknown;
    countryCode?: unknown;
    interests?: unknown;
    alreadyFiled?: unknown;
    saved?: unknown;
  };

  if (typeof destination !== "string" || !destination.trim()) {
    return Response.json({ error: "Tell me where you are going first." }, { status: 400 });
  }

  if (destination.length > MAX_DESTINATION) {
    return Response.json({ error: "That destination is too long." }, { status: 400 });
  }

  const wanted = Array.isArray(interests)
    ? interests.filter((id): id is string => typeof id === "string" && VALID_INTERESTS.has(id))
    : [];

  if (wanted.length === 0) {
    return Response.json({ error: "Pick at least one thing you are into." }, { status: 400 });
  }

  const result = await advise({
    destination: destination.trim(),
    countryCode: typeof countryCode === "string" ? countryCode : undefined,
    interests: wanted.slice(0, MAX_INTERESTS),
    alreadyFiled: Array.isArray(alreadyFiled)
      ? alreadyFiled.filter((title): title is string => typeof title === "string").slice(0, MAX_FILED)
      : [],
    saved: Array.isArray(saved) ? toCandidates(saved) : [],
  });

  if (result.sections.length === 0) {
    return Response.json(
      {
        error:
          "Nothing came back that I could verify. Add an API key for the paid tiers, or file a few places yourself first.",
        notes: result.notes,
      },
      { status: 503 },
    );
  }

  return Response.json(result);
}

/** Their own items, trusted only for their names — tier one of the waterfall. */
function toCandidates(saved: unknown[]): Candidate[] {
  return saved
    .flatMap((entry): Candidate[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { name, detail, city } = entry as { name?: unknown; detail?: unknown; city?: unknown };
      if (typeof name !== "string" || !name.trim()) return [];

      return [
        {
          name: name.slice(0, 160),
          detail: typeof detail === "string" ? detail.slice(0, 240) : undefined,
          city: typeof city === "string" ? city.slice(0, 80) : undefined,
          tier: "saved",
          attribution: "Your saves",
        },
      ];
    })
    .slice(0, MAX_SAVED);
}
