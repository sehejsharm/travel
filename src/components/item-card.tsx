import { SOURCE_LABELS, type TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime } from "@/lib/rules";

export function SourceChip({ item }: { item: TripItem }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
      {SOURCE_LABELS[item.source]}
    </span>
  );
}

export function ItemCard({
  item,
  action,
  addedByName,
}: {
  item: TripItem;
  action?: React.ReactNode;
  addedByName?: string;
}) {
  const when = item.startsAt
    ? `${formatDay(item.startsAt)}${formatTime(item.startsAt) ? ` · ${formatTime(item.startsAt)}` : ""}`
    : "Not scheduled";

  return (
    <li className="rounded-md border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
        <SourceChip item={item} />
      </div>

      <dl className="mt-2 flex flex-col gap-1 font-mono text-[11px] text-ink-faint">
        <div className="flex justify-between gap-3">
          <dt className="sr-only">When</dt>
          <dd className="tabular">{when}</dd>
          {item.cost && (
            <dd className="tabular text-ink-soft">
              {formatMoney(item.cost.amount, item.cost.currency)}
              {item.costStatus === "estimated" && " est."}
            </dd>
          )}
        </div>
        {item.place && (
          <div>
            <dt className="sr-only">Where</dt>
            <dd>
              {item.place.name}
              {item.arrivalPlace ? ` → ${item.arrivalPlace.name}` : ""}
              {item.place.point ? "" : " · not grounded"}
            </dd>
          </div>
        )}
        {item.confirmationCode && (
          <div>
            <dt className="sr-only">Confirmation</dt>
            <dd>Ref {item.confirmationCode}</dd>
          </div>
        )}
        {addedByName && (
          <div>
            <dt className="sr-only">Added by</dt>
            <dd>Added by {addedByName}</dd>
          </div>
        )}
      </dl>

      {action && <div className="mt-2.5">{action}</div>}
    </li>
  );
}
