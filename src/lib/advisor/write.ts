import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Candidate } from "./types";

/**
 * The write step. It is deliberately given no freedom to add places: every
 * name it returns has to come from the candidate list or the search findings
 * it is handed. Anything else is dropped by the verify step that follows.
 */

const MODEL = "claude-opus-5";

const Written = z.object({
  sections: z.array(
    z.object({
      interestId: z.string(),
      suggestions: z.array(
        z.object({
          name: z.string(),
          why: z.string(),
          city: z.string().nullable(),
          priceHint: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export type WrittenAdvice = z.infer<typeof Written>;

const SYSTEM = `You turn research about a destination into short, specific travel suggestions.

Hard rules:
- Every place you name MUST appear in the material you are given. Never add a place from your own knowledge, however obvious it seems. An answer with four real places beats one with eight where two were invented.
- "why" is one sentence, concrete and practical — what you would actually do there, a timing tip, or what to order. Never marketing copy, never "a must-visit gem".
- Use the place's real name as the material spells it, with no added description.
- Put each suggestion under the interest section it best fits. Skip a section entirely rather than padding it.
- priceHint only when the material says something about cost.`;

export async function writeAdvice(
  destination: string,
  interests: { id: string; label: string }[],
  candidates: Candidate[],
  findingsText?: string,
): Promise<WrittenAdvice | null> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  if (candidates.length === 0 && !findingsText) return null;

  const client = new Anthropic();

  const material = [
    candidates.length > 0 &&
      `Places found, with where each came from:\n${candidates
        .map((candidate) =>
          `- ${candidate.name}${candidate.city ? ` (${candidate.city})` : ""}${
            candidate.detail ? ` — ${candidate.detail}` : ""
          } [${candidate.attribution ?? candidate.tier}]`,
        )
        .join("\n")}`,
    findingsText && `Notes from a web search:\n${findingsText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Written) },
      messages: [
        {
          role: "user",
          content: `Destination: ${destination}
Sections to fill, by id: ${interests.map((interest) => `${interest.id} (${interest.label})`).join(", ")}

${material}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.warn(`Advice write failed (${error.status}): ${error.message}`);
    } else {
      console.warn("Advice write failed:", error);
    }
    return null;
  }
}
