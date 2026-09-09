import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { BookingKind, ItemCategory, PlaceRef } from "../domain/types";
import { groundPlace } from "../reference/places";
import type { ExtractionInput, ExtractionResult, ItemDraft } from "./types";

const MODEL = "claude-opus-5";

const ExtractedItem = z.object({
  title: z.string(),
  category: z.enum(["place", "activity", "purchase", "booking"]),
  bookingKind: z.enum(["flight", "lodging", "rail", "car", "tour", "other"]).nullable(),
  placeName: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  costAmount: z.number().nullable(),
  costCurrency: z.string().nullable(),
  confirmationCode: z.string().nullable(),
  travelerName: z.string().nullable(),
  refundableUntil: z.string().nullable(),
  notes: z.string().nullable(),
});

const SYSTEM = `You extract structured travel items from messy content: booking emails, screenshots, and social captions.

Rules:
- Only report what the text actually says. Use null for anything absent — never invent a price, date, or address.
- Dates are ISO 8601. Include a UTC offset when the location makes it unambiguous, otherwise give date and time only.
- category: "booking" for anything reserved or paid for, "activity" for things to do, "purchase" for things to buy, "place" for somewhere to go.
- title is short and human — what the traveller would call it, not a sentence.`;

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * The escalation half of "cheapest reliable method first" — only called when
 * the deterministic pass came back under-confident. Returns null when the
 * model is unavailable so the cheap result still stands.
 */
export async function extractWithLlm(
  input: ExtractionInput,
  reason: string,
): Promise<ExtractionResult | null> {
  if (!hasCredentials()) return null;

  const today = (input.today ?? new Date()).toISOString().slice(0, 10);
  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ExtractedItem),
      },
      messages: [
        {
          role: "user",
          content: `Today is ${today}. Source: ${input.source}.\n\n---\n${input.text}\n---`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return null;

    return {
      draft: toDraft(parsed, input),
      confidence: 0.8,
      method: "llm",
      foundFields: filledFields(parsed),
      escalationReason: reason,
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("Extraction escalation skipped: credentials rejected.");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Extraction escalation skipped: rate limited.");
    } else if (error instanceof Anthropic.APIError) {
      console.warn(`Extraction escalation failed (${error.status}): ${error.message}`);
    } else {
      console.warn("Extraction escalation failed:", error);
    }
    return null;
  }
}

type Extracted = z.infer<typeof ExtractedItem>;

function toDraft(parsed: Extracted, input: ExtractionInput): ItemDraft {
  const grounded = parsed.placeName ? groundPlace(parsed.placeName) : undefined;

  const place: PlaceRef | undefined = grounded ?? (parsed.placeName
    ? {
        name: parsed.placeName,
        city: parsed.city ?? undefined,
        countryCode: parsed.countryCode ?? undefined,
      }
    : undefined);

  return {
    title: parsed.title,
    category: parsed.category as ItemCategory,
    bookingKind: (parsed.bookingKind as BookingKind | null) ?? undefined,
    source: input.source,
    sourceRef: input.sourceRef,
    place,
    startsAt: parsed.startsAt ?? undefined,
    endsAt: parsed.endsAt ?? undefined,
    cost:
      parsed.costAmount !== null && parsed.costCurrency
        ? { amount: parsed.costAmount, currency: parsed.costCurrency.toUpperCase() }
        : undefined,
    costStatus:
      parsed.costAmount !== null
        ? parsed.category === "booking"
          ? "actual"
          : "estimated"
        : undefined,
    confirmationCode: parsed.confirmationCode ?? undefined,
    travelerName: parsed.travelerName ?? undefined,
    refundableUntil: parsed.refundableUntil ?? undefined,
    notes: parsed.notes ?? undefined,
  };
}

function filledFields(parsed: Extracted): string[] {
  const fields: string[] = [];
  if (parsed.placeName) fields.push("place");
  if (parsed.startsAt) fields.push("dates");
  if (parsed.costAmount !== null) fields.push("cost");
  if (parsed.confirmationCode) fields.push("confirmation");
  if (parsed.travelerName) fields.push("traveller");
  if (parsed.refundableUntil) fields.push("refund deadline");
  return fields;
}
