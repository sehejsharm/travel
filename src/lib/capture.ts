import type { SourceKind } from "./domain/types";
import type { ExtractionResult } from "./extract/types";

export interface CaptureImage {
  data: string;
  mediaType: string;
  previewUrl: string;
  name: string;
}

const MAX_DIMENSION = 1600;

/**
 * Phone screenshots are far larger than the model needs. Downscaling before
 * upload keeps the request small, which is most of the wait on mobile data.
 */
export async function prepareImage(file: File): Promise<CaptureImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const data = dataUrl.split(",")[1] ?? "";

  return { data, mediaType: "image/jpeg", previewUrl: dataUrl, name: file.name || "screenshot" };
}

export async function requestExtraction(body: {
  text?: string;
  source: SourceKind;
  image?: { data: string; mediaType: string };
}): Promise<ExtractionResult> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Extraction failed.");
  return payload as ExtractionResult;
}

/** Anything pasted that looks like a link tells us the source without asking. */
export function sourceForText(text: string): SourceKind {
  if (/instagram\.com/i.test(text)) return "reel";
  if (/tiktok\.com/i.test(text)) return "tiktok";
  if (/youtube\.com|youtu\.be/i.test(text)) return "youtube";
  if (/^(from|subject|to):/im.test(text) || /confirmation|booking reference|pnr/i.test(text)) {
    return "gmail";
  }
  return "manual";
}
