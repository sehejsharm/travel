import Link from "next/link";
import { DeleteItemButton } from "@/components/delete-item-button";
import { ItemCard } from "@/components/item-card";
import { getTrip, listItems } from "@/lib/db";
import { CATEGORY_LABELS, type ItemCategory } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const COLUMNS: { category: ItemCategory; blurb: string }[] = [
  { category: "place", blurb: "Cafés, trails, views" },
  { category: "activity", blurb: "Tours, activities" },
  { category: "purchase", blurb: "Packing, souvenirs" },
  { category: "booking", blurb: "Flights, hotels" },
];

export default function FilingCabinet() {
  const trip = getTrip();
  const items = listItems(trip.id);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
          Filing cabinet
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold">Everything filed for {trip.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {items.length} items, sorted as they came in.{" "}
          <Link href="/mailroom" className="text-accent-strong underline">
            Add more from the mailroom
          </Link>
          .
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(({ category, blurb }) => {
          const columnItems = items.filter((item) => item.category === category);

          return (
            <section key={category} className="flex flex-col gap-2.5">
              <header className="border-b border-line pb-2">
                <h2 className="font-display text-base font-semibold">
                  {CATEGORY_LABELS[category]}
                </h2>
                <p className="font-mono text-[11px] text-ink-faint">
                  {blurb} · <span className="tabular">{columnItems.length}</span>
                </p>
              </header>

              {columnItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-3 text-xs text-ink-faint">
                  Nothing filed here yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {columnItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      action={<DeleteItemButton id={item.id} />}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
