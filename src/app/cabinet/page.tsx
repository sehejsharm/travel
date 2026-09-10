"use client";

import Link from "next/link";
import { useState } from "react";
import { ItemEditor } from "@/components/item-editor";
import { TripMap } from "@/components/trip-map";
import { TextInput } from "@/components/form";
import { Card, Chip, EmptyState, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { CATEGORY_LABELS, SOURCE_LABELS, type ItemCategory, type TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime } from "@/lib/rules";
import { useTripView } from "@/lib/store/use-store";

type Filter = ItemCategory | "all" | "unscheduled";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unscheduled", label: "Not scheduled" },
  { value: "place", label: CATEGORY_LABELS.place },
  { value: "activity", label: CATEGORY_LABELS.activity },
  { value: "booking", label: CATEGORY_LABELS.booking },
  { value: "purchase", label: CATEGORY_LABELS.purchase },
];

function matches(item: TripItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.title,
    item.place?.name,
    item.place?.city,
    item.confirmationCode,
    item.notes,
    item.travelerName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function CabinetScreen() {
  const { trip, items, hydrated } = useTripView();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [editing, setEditing] = useState<TripItem | null>(null);

  if (!hydrated) return <ScreenSkeleton />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Create a trip and everything you file lands here."
        action={
          <Link
            href="/"
            className="press mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Start a trip
          </Link>
        }
      />
    );
  }

  const countFor = (value: Filter) =>
    value === "all"
      ? items.length
      : value === "unscheduled"
        ? items.filter((item) => !item.startsAt).length
        : items.filter((item) => item.category === value).length;

  const visible = items
    .filter((item) =>
      filter === "all"
        ? true
        : filter === "unscheduled"
          ? !item.startsAt
          : item.category === filter,
    )
    .filter((item) => matches(item, query));

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        eyebrow="Filing cabinet"
        title="Everything filed"
        meta={`${items.length} items in ${trip.name}`}
      />

      <div className="flex gap-2">
        <TextInput
          type="search"
          value={query}
          aria-label="Search filed items"
          placeholder="Search places, refs, notes…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex shrink-0 rounded-xl border border-line bg-surface-2 p-1">
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`press rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                view === option ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
              <span className="ml-1.5 font-mono text-[10px] tabular opacity-70">
                {countFor(option.value)}
              </span>
            </button>
          );
        })}
      </div>

      {view === "map" ? (
        <TripMap items={visible} onSelect={setEditing} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={query ? "Nothing matches that" : "Nothing filed here yet"}
          body={
            query
              ? "Try a place name, a booking reference, or part of a note."
              : "Forward a booking email, a screenshot, or a Reel and it lands in the cabinet."
          }
          action={
            !query && (
              <Link
                href="/add"
                className="press mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
              >
                Add something
              </Link>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="press block w-full text-left"
              >
                <Card as="div" className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] leading-snug font-medium">{item.title}</h3>
                    <Chip>{SOURCE_LABELS[item.source]}</Chip>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-mono text-[11px] text-ink-faint tabular">
                      {item.startsAt
                        ? `${formatDay(item.startsAt)}${
                            formatTime(item.startsAt) ? ` · ${formatTime(item.startsAt)}` : ""
                          }`
                        : "Tap to schedule"}
                    </span>
                    {item.cost && (
                      <span className="font-mono text-[11px] text-ink-soft tabular">
                        {formatMoney(item.cost.amount, item.cost.currency)}
                        {item.costStatus === "estimated" && " est."}
                      </span>
                    )}
                  </div>

                  {(item.place || item.confirmationCode) && (
                    <p className="mt-1 font-mono text-[11px] text-ink-faint">
                      {[
                        item.place?.name,
                        item.confirmationCode && `Ref ${item.confirmationCode}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ItemEditor item={editing} trip={trip} onClose={() => setEditing(null)} />
    </div>
  );
}
