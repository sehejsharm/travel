"use client";

import { useTransition } from "react";
import { SOURCE_LABELS, type TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime } from "@/lib/rules";
import { removeItem } from "@/lib/store/state";
import { RemoveButton } from "./form";
import { Card, Chip } from "./ui";

export function ItemCard({
  item,
  addedByName,
}: {
  item: TripItem;
  addedByName?: string;
}) {
  const [pending, startTransition] = useTransition();

  const when = item.startsAt
    ? `${formatDay(item.startsAt)}${formatTime(item.startsAt) ? ` · ${formatTime(item.startsAt)}` : ""}`
    : "Not scheduled";

  const details = [
    item.place?.name && `${item.place.name}${item.arrivalPlace ? ` → ${item.arrivalPlace.name}` : ""}`,
    item.confirmationCode && `Ref ${item.confirmationCode}`,
    addedByName && `Added by ${addedByName}`,
  ].filter(Boolean);

  return (
    <Card as="li" className="animate-rise p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-headline">{item.title}</h3>
        <Chip>{SOURCE_LABELS[item.source]}</Chip>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-footnote text-ink-soft tabular">{when}</span>
        {item.cost && (
          <span className="text-footnote text-ink-soft tabular">
            {formatMoney(item.cost.amount, item.cost.currency)}
            {item.costStatus === "estimated" && " est."}
          </span>
        )}
      </div>

      {details.length > 0 && (
        <p className="mt-1 text-footnote text-ink-soft">
          {details.join(" · ")}
        </p>
      )}

      <RemoveButton
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => removeItem(item.id))}
        className="-ml-3 mt-2"
      >
        {pending ? "Removing" : "Remove"}
      </RemoveButton>
    </Card>
  );
}
