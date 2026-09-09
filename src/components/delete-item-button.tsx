"use client";

import { useTransition } from "react";
import { removeItem } from "@/app/actions";

export function DeleteItemButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => removeItem(id))}
      className="font-mono text-[11px] text-ink-faint underline transition-colors hover:text-critical disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
