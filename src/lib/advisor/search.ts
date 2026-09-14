import Anthropic from "@anthropic-ai/sdk";
import type { Candidate } from "./types";

/**
 * Tier four: the open web, through Claude's server-side search tool. This is
 * the only tier we pay per query for, so the waterfall reaches it last and
 * asks one question covering every outstanding section at once.
 */

const MODEL = "claude-opus-5";
const MAX_PAUSE_ROUNDS = 3;

export function hasSearchCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface SearchFindings {
  /** What the search actually returned, as prose the write step can read. */
  text: string;
  /** Pages consulted, kept so every suggestion can cite one. */
  citations: { title: string; url: string }[];
}

export async function searchTheWeb(
  destination: string,
  topics: string[],
): Promise<SearchFindings | null> {
  if (!hasSearchCredentials() || topics.length === 0) return null;

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Find specific, named places in ${destination} for a traveller interested in: ${topics.join("; ")}.

Search for current recommendations. For each place, note its exact name, the neighbourhood or city it is in, and one concrete line on what makes it worth going to. Prefer places that several sources mention. Do not include anything you cannot point to a page for.`,
    },
  ];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low" },
      // Dynamic-filtering variant; it runs code itself, so no code_execution tool here.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages,
    });

    // A long search can hand the turn back before it is finished.
    for (let round = 0; response.stop_reason === "pause_turn" && round < MAX_PAUSE_ROUNDS; round++) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "low" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      });
    }

    if (response.stop_reason === "refusal") return null;

    return collect(response);
  } catch (error) {
    logFailure(error);
    return null;
  }
}

function collect(response: Anthropic.Message): SearchFindings | null {
  const parts: string[] = [];
  const citations: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const block of response.content) {
    if (block.type === "text") {
      parts.push(block.text);
      continue;
    }

    if (block.type !== "web_search_tool_result") continue;

    // On a tool error the content is a single object, not a list of results.
    if (!Array.isArray(block.content)) {
      console.warn(`Web search error: ${block.content.error_code}`);
      continue;
    }

    for (const result of block.content) {
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      citations.push({ title: result.title, url: result.url });
    }
  }

  const text = parts.join("\n").trim();
  if (!text) return null;

  return { text, citations };
}

/** The web tier yielding nothing is normal, so it warns and never throws. */
function logFailure(error: unknown): void {
  if (error instanceof Anthropic.AuthenticationError) {
    console.warn("Web search skipped: credentials rejected.");
  } else if (error instanceof Anthropic.RateLimitError) {
    console.warn("Web search skipped: rate limited.");
  } else if (error instanceof Anthropic.APIError) {
    console.warn(`Web search failed (${error.status}): ${error.message}`);
  } else {
    console.warn("Web search failed:", error);
  }
}

/** Candidates straight from the citation list, for when the write step fails. */
export function citationsAsCandidates(findings: SearchFindings): Candidate[] {
  return findings.citations.slice(0, 8).map((citation) => ({
    name: citation.title,
    tier: "web" as const,
    attribution: new URL(citation.url).hostname.replace(/^www\./, ""),
    url: citation.url,
  }));
}
