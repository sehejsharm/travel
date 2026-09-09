"use server";

import { revalidatePath } from "next/cache";
import type { ChecklistKind } from "@/lib/checklists";
import {
  addChecklistEntry,
  addItem,
  deleteChecklistEntry,
  deleteItem,
  getTrip,
  setChecklistAssignee,
  setChecklistDone,
} from "@/lib/db";
import type { ExtractionResult } from "@/lib/extract";

export async function removeItem(id: string): Promise<void> {
  deleteItem(id);
  revalidatePath("/");
  revalidatePath("/cabinet");
}

export async function fileItem(result: ExtractionResult, addedBy?: string): Promise<void> {
  const trip = getTrip();
  addItem(trip.id, result.draft, {
    confidence: result.confidence,
    extractionMethod: result.method,
    addedBy,
  });

  revalidatePath("/");
  revalidatePath("/cabinet");
}

export async function toggleChecklist(id: string, done: boolean): Promise<void> {
  setChecklistDone(id, done);
  revalidatePath("/");
}

export async function assignChecklist(id: string, assigneeId: string): Promise<void> {
  setChecklistAssignee(id, assigneeId || null);
  revalidatePath("/");
}

export async function addChecklist(kind: ChecklistKind, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;

  addChecklistEntry(getTrip().id, kind, trimmed);
  revalidatePath("/");
}

export async function removeChecklist(id: string): Promise<void> {
  deleteChecklistEntry(id);
  revalidatePath("/");
}
