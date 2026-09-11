import { extract, extractFromImage } from "@/lib/extract";
import { SOURCE_LABELS, type SourceKind } from "@/lib/domain/types";

/** Long enough for a forwarded booking email, short enough to stay cheap. */
const MAX_TEXT_LENGTH = 20_000;
/** Roughly a 4 MB image once base64 overhead is counted. */
const MAX_IMAGE_CHARS = 5_600_000;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { text, source, image } = (payload ?? {}) as {
    text?: unknown;
    source?: unknown;
    image?: unknown;
  };

  if (typeof source !== "string" || !(source in SOURCE_LABELS)) {
    return Response.json({ error: "Unknown source." }, { status: 400 });
  }

  if (image) {
    return extractImage(image, source as SourceKind);
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "Nothing to extract." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: "That is too long to extract in one go." }, { status: 413 });
  }

  try {
    return Response.json(await extract({ text, source: source as SourceKind }));
  } catch (error) {
    console.error("Extraction failed:", error);
    return Response.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}

async function extractImage(image: unknown, source: SourceKind) {
  const { data, mediaType } = (image ?? {}) as { data?: unknown; mediaType?: unknown };

  if (typeof data !== "string" || data.length === 0) {
    return Response.json({ error: "That image could not be read." }, { status: 400 });
  }
  if (data.length > MAX_IMAGE_CHARS) {
    return Response.json(
      { error: "That image is too large — under 4 MB works best." },
      { status: 413 },
    );
  }
  if (typeof mediaType !== "string" || !IMAGE_TYPES.includes(mediaType as ImageType)) {
    return Response.json(
      { error: "Use a PNG, JPEG, WebP or GIF screenshot." },
      { status: 415 },
    );
  }

  try {
    const result = await extractFromImage(data, mediaType as ImageType, { text: "", source });

    if (!result) {
      return Response.json(
        {
          error:
            "Reading images needs an ANTHROPIC_API_KEY on the server. Paste the text instead and it will still work.",
        },
        { status: 503 },
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error("Image extraction failed:", error);
    return Response.json({ error: "Could not read that image." }, { status: 500 });
  }
}
