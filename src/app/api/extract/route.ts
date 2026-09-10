import { extract } from "@/lib/extract";
import { SOURCE_LABELS, type SourceKind } from "@/lib/domain/types";

/** Long enough for a forwarded booking email, short enough to stay cheap. */
const MAX_TEXT_LENGTH = 20_000;

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { text, source } = (payload ?? {}) as { text?: unknown; source?: unknown };

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "Nothing to extract." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: "That is too long to extract in one go." }, { status: 413 });
  }
  if (typeof source !== "string" || !(source in SOURCE_LABELS)) {
    return Response.json({ error: "Unknown source." }, { status: 400 });
  }

  try {
    return Response.json(await extract({ text, source: source as SourceKind }));
  } catch (error) {
    console.error("Extraction failed:", error);
    return Response.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
