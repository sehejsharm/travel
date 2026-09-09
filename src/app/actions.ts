"use server";

import { revalidatePath } from "next/cache";
import { addItem, deleteItem, getTrip } from "@/lib/db";
import type { ExtractionResult } from "@/lib/extract";

export async function removeItem(id: string): Promise<void> {
  deleteItem(id);
  revalidatePath("/");
  revalidatePath("/cabinet");
}

export async function fileItem(result: ExtractionResult): Promise<void> {
  const trip = getTrip();
  addItem(trip.id, result.draft, {
    confidence: result.confidence,
    extractionMethod: result.method,
  });

  revalidatePath("/");
  revalidatePath("/cabinet");
}
