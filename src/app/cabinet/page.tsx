"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ItemEditor } from "@/components/item-editor";
import { TripMap } from "@/components/trip-map";
import { PrimaryButton, TextInput } from "@/components/form";
import { PRIMARY_BUTTON_CLASSES } from "@/components/styles";
import { Card, Chip, EmptyState, ScreenHeader, ScreenSkeleton } from "@/components/ui";
import { CATEGORY_LABELS, SOURCE_LABELS, type ItemCategory, type TripItem } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { formatDay, formatTime } from "@/lib/rules";
import { useTripView } from "@/lib/store/use-store";

type Filter = ItemCategory | "all" | "unscheduled" | "unpriced";

/** The stripe down a card's edge, so a category is legible without reading. */
const CATEGORY_TONE: Record<string, string> = {
  booking: "bg-accent",
  activity: "bg-teal",
  place: "bg-line-strong",
  purchase: "bg-warning",
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unscheduled", label: "Not scheduled" },
  { value: "unpriced", label: "No price yet" },
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

function isFilter(value: string | null): value is Filter {
  return FILTERS.some((option) => option.value === value);
}

export default function CabinetScreen() {
  return (
    <Suspense fallback={<ScreenSkeleton variant="list" />}>
      <CabinetScreenInner />
    </Suspense>
  );
}

function CabinetScreenInner() {
  const { trip, items, hydrated } = useTripView();
  const params = useSearchParams();
  // Arriving from the budget card or Discover, the filter is already chosen.
  const requested = params.get("filter");
  const [filter, setFilter] = useState<Filter>(isFilter(requested) ? requested : "all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [editing, setEditing] = useState<TripItem | null>(null);

  if (!hydrated) return <ScreenSkeleton variant="list" />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Create a trip and everything you file lands here."
        action={
          <Link href="/trip/new" className={PRIMARY_BUTTON_CLASSES}>
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
        : value === "unpriced"
          ? items.filter((item) => !item.cost).length
          : items.filter((item) => item.category === value).length;

  const visible = items
    .filter((item) =>
      filter === "all"
        ? true
        : filter === "unscheduled"
          ? !item.startsAt
          : filter === "unpriced"
            ? !item.cost
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
        {/* Drawn as the shared Segmented control, kept as toggle buttons for their aria-pressed. */}
        <div className="flex shrink-0 gap-1 rounded-full bg-accent/8 p-1">
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`press tap h-9 rounded-full px-3 text-footnote font-medium capitalize ${
                view === option ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* The vertical padding keeps each chip's 44px hit area and focus ring inside the scroller, which clips. */}
      <div className="no-scrollbar -mx-5 -mt-2 -mb-1 flex gap-2 overflow-x-auto px-5 py-2">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`press tap flex min-h-8 shrink-0 items-center gap-1 rounded-badge border px-3 text-footnote ${
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
              <span className="text-caption tabular">{countFor(option.value)}</span>
            </button>
          );
        })}
      </div>

      {/* With nothing to show, the map falls through to the list's empty state,
          which knows whether a search is the reason. */}
      {view === "map" && visible.length > 0 ? (
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
            query ? (
              <PrimaryButton type="button" onClick={() => setQuery("")}>
                Clear search
              </PrimaryButton>
            ) : (
              <Link href="/add" className={PRIMARY_BUTTON_CLASSES}>
                Add something
              </Link>
            )
          }
        />
      ) : (
        <ul
          // Keyed on the filter so changing it replays the stagger — the list
          // settling is what tells you the filter did something.
          key={filter}
          className="stagger flex flex-col gap-3"
        >
          {visible.map((item, index) => (
            <li
              key={item.id}
              // Capped: a long cabinet should settle, not cascade for seconds.
              style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
            >
              {/* The whole card is the control, so it lifts as one rather than pressing twice. */}
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="liftable block w-full rounded-card text-left"
              >
                <Card as="div" className="raised relative overflow-hidden p-4 pl-5">
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${
                      CATEGORY_TONE[item.category] ?? "bg-ink-faint"
                    }`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-headline">{item.title}</h3>
                    <Chip>{SOURCE_LABELS[item.source]}</Chip>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-footnote text-ink-soft tabular">
                      {item.startsAt
                        ? `${formatDay(item.startsAt)}${
                            formatTime(item.startsAt) ? ` · ${formatTime(item.startsAt)}` : ""
                          }`
                        : "Tap to schedule"}
                    </span>
                    {item.cost && (
                      <span className="text-footnote text-ink-soft tabular">
                        {formatMoney(item.cost.amount, item.cost.currency)}
                        {item.costStatus === "estimated" && " est."}
                      </span>
                    )}
                  </div>

                  {(item.place || item.confirmationCode) && (
                    <p className="mt-1 text-footnote text-ink-soft">
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
