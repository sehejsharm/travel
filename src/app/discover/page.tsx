"use client";

import Link from "next/link";
import { useState } from "react";
import { InterestPicker } from "@/components/interest-picker";
import { Field, PrimaryButton, TextInput } from "@/components/form";
import {
  BORDERLESS_BUTTON_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/styles";
import {
  Card,
  Chip,
  EmptyState,
  ScreenHeader,
  ScreenSkeleton,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import {
  adviceKey,
  CALENDAR_INTEREST,
  calendarSection,
  shownSections,
} from "@/lib/advisor/calendar";
import { getInterest } from "@/lib/advisor/interests";
import { getPurpose } from "@/lib/trip-purpose";
import {
  TIER_LABELS,
  type AdviceResult,
  type SourceTier,
  type Suggestion,
} from "@/lib/advisor/types";
import { DEFAULT_INTERESTS } from "@/lib/advisor/interests";
import type { Trip, TripItem } from "@/lib/domain/types";
import { openInMapsUrl } from "@/lib/maps";
import { getCountry } from "@/lib/reference/countries";
import { loadHolidays } from "@/lib/reference/holidays";
import { addItem, cacheAdvice, cachedAdvice, updateTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";
import {
  calendarCountries,
  formatEventDates,
  holidayTone,
  KIND_LABELS,
  tripEvents,
  type CalendarEvent,
} from "@/lib/trip-calendar";

const TIER_TONE: Record<string, "accent" | "ok" | "neutral" | "warning"> = {
  saved: "ok",
  community: "ok",
  places: "warning",
  web: "neutral",
  calendar: "ok",
};

const CALENDAR_NOTE =
  "The festivals and days off on your dates come from Manifest's calendar, on this device. Nothing was searched for them.";

export default function DiscoverScreen() {
  const { state, trip, items, hydrated } = useTripView();
  const [destination, setDestination] = useState("");
  const [draftInterests, setDraftInterests] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [fresh, setFresh] = useState<AdviceResult>();

  if (!hydrated) return <ScreenSkeleton variant="list" />;
  if (!trip) {
    return (
      <EmptyState
        title="No trip yet"
        body="Start a trip and I can go looking for things to do on it."
        action={
          <Link href="/trip/new" className={PRIMARY_BUTTON_CLASSES}>
            Start a trip
          </Link>
        }
      />
    );
  }

  const interests = trip.interests ?? [];
  // A business trip does not want restaurant suggestions unless asked. The
  // picker is still right there, so this is a default, not a restriction.
  const quiet = getPurpose(trip.purpose)?.suppressSuggestions && interests.length === 0;
  const where = destination.trim() || defaultDestination(trip, items);
  // Festivals & shows is searched like any other interest, for concerts,
  // theatre and opera. Beside it, Manifest's calendar lists the festivals on
  // the trip's own countries and dates, on the device. It is worked out on
  // every render, which keeps it in step with the dates, and it shows whether
  // or not the search has run or worked.
  const calendar = tripEvents(trip, items);
  const listed = interests.includes(CALENDAR_INTEREST) ? calendarSection(calendar) : [];
  const fromCalendar = listed.length > 0;
  const advice = fresh ?? cachedAdvice(state, trip.id, adviceKey(where, interests));
  const filedTitles = new Set(items.map((item) => item.title.trim().toLowerCase()));

  if (quiet && !loading && !advice) {
    return (
      <div className="flex flex-col gap-5">
        <ScreenHeader
          eyebrow="Discover"
          title="Kept quiet for this trip"
          meta="You marked this a business trip, so suggestions are off by default."
        />
        <Card className="p-4">
          <p className="text-subheadline text-ink-soft">
            Pick a few interests and Discover starts suggesting things to do around your meetings.
          </p>
          <div className="mt-3">
            <InterestPicker selected={draftInterests ?? []} onChange={setDraftInterests} />
          </div>
          <div className="mt-4">
            <PrimaryButton
              onClick={() => {
                const picked = draftInterests ?? [];
                updateTrip(trip.id, { interests: picked });
                void find(picked);
              }}
              disabled={!draftInterests?.length}
            >
              Turn suggestions on
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  // Nothing picked yet: the whole screen is the question.
  if (interests.length === 0 && !loading && !advice) {
    const picked = draftInterests ?? DEFAULT_INTERESTS;

    return (
      <div className="flex flex-col gap-5">
        <ScreenHeader
          eyebrow="Discover"
          title="What are you into?"
          meta="Your picks become the sections your suggestions arrive under. Change them any time."
        />

        <Card className="p-4">
          <InterestPicker selected={picked} onChange={setDraftInterests} />
          <div className="mt-4">
            <PrimaryButton
              onClick={() => {
                updateTrip(trip.id, { interests: picked });
                void find(picked);
              }}
              disabled={picked.length === 0}
            >
              Save and find things to do
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Picking interests runs the search straight away rather than leaving the
   * traveller on a screen with a button and no idea where their answers went.
   * The picks are passed in because the store has not propagated them yet.
   */
  async function find(picked: string[] = interests) {
    if (!trip) return;

    setLoading(true);
    setError(undefined);

    // The trip view loads the calendar already. Asking again retries a country
    // that could not load offline; the search does not wait for it.
    void loadHolidays(calendarCountries(trip, items));

    try {
      const response = await fetch("/api/advise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destination: where,
          countryCode: trip.destinationCountries?.[0],
          interests: picked,
          alreadyFiled: items.flatMap((item) =>
            [item.title, item.place?.name].filter((value): value is string => Boolean(value)),
          ),
          saved: items
            .filter((item) => item.place)
            .map((item) => ({
              name: item.place!.name,
              detail: item.notes,
              city: item.place!.city,
            })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "That did not work.");

      setFresh(payload as AdviceResult);
      cacheAdvice(trip.id, adviceKey(where, picked), payload as AdviceResult);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not work.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow="Discover"
        title="Things to do"
        meta={`${interests.length} interest${interests.length === 1 ? "" : "s"} · every suggestion names where it came from`}
        action={
          <Link href="/trip" className={BORDERLESS_BUTTON_CLASSES}>
            Edit interests
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Where">
              <TextInput
                value={destination}
                placeholder={defaultDestination(trip, items)}
                onChange={(event) => setDestination(event.target.value)}
              />
            </Field>
          </div>
          <div className="shrink-0 sm:w-48">
            <PrimaryButton onClick={() => void find()} disabled={loading}>
              {loading ? "Looking…" : advice ? "Look again" : "Find things to do"}
            </PrimaryButton>
          </div>
        </div>

        {interests.includes(CALENDAR_INTEREST) && trip.datesTbd && (
          <p className="mt-3 text-footnote text-ink-soft">
            Manifest&rsquo;s calendar adds the festivals on your dates once they are set.
          </p>
        )}

        <ul className="mt-3 flex flex-wrap gap-2">
          {interests.map((id) => {
            const interest = getInterest(id);
            if (!interest) return null;
            return (
              <li key={id}>
                <Chip>
                  {interest.emoji} {interest.label}
                </Chip>
              </li>
            );
          })}
        </ul>
      </Card>

      {error && (
        <div className="rounded-card bg-critical-soft p-4 text-subheadline text-critical">{error}</div>
      )}

      {loading && !advice && <LoadingSections count={interests.length} />}

      {!advice && !loading && !error && (
        // The search card's own button above is the action that fills this, so
        // the note does not repeat it.
        <Card className="p-5 text-center">
          <p className="text-title-3">Nothing looked up yet</p>
          <p className="mt-2 text-subheadline text-ink-soft">
            {fromCalendar && "The festivals on your dates are already below, from Manifest’s calendar. "}
            Tap Find things to do, and I will work down from your own saves to Manifest&rsquo;s own
            list before spending anything on a search.
          </p>
        </Card>
      )}

      {(advice || fromCalendar) && (
        <>
          <Sourcing
            tiers={[...(fromCalendar ? (["calendar"] as const) : []), ...(advice?.tiersUsed ?? [])]}
            notes={[...(fromCalendar ? [CALENDAR_NOTE] : []), ...(advice?.notes ?? [])]}
          />

          {shownSections(interests, fromCalendar, advice).map((shown) => {
            if (shown.source === "calendar") {
              return (
                <section key="calendar">
                  <SectionTitle trailing={`${listed.length}`}>{TIER_LABELS.calendar}</SectionTitle>

                  <ul className="flex flex-col gap-3">
                    {listed.map((event, index) => (
                      <li
                        key={event.id}
                        className="animate-rise"
                        style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                      >
                        <CalendarCard
                          event={event}
                          tripId={trip.id}
                          showCountry={calendar.countries.length > 1}
                          alreadyFiled={filedTitles.has(event.name.trim().toLowerCase())}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }

            const interest = getInterest(shown.interestId);
            const title = interest ? `${interest.emoji} ${interest.label}` : shown.interestId;

            return (
              <section key={shown.interestId}>
                <SectionTitle trailing={`${shown.section.suggestions.length}`}>{title}</SectionTitle>

                <ul className="flex flex-col gap-3">
                  {shown.section.suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      className="animate-rise"
                      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                    >
                      <SuggestionCard suggestion={suggestion} tripId={trip.id} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * One holiday or festival from Manifest's calendar. Filed, it becomes an idea
 * with its dates in the notes, ready to put on a day.
 */
function CalendarCard({
  event,
  tripId,
  showCountry,
  alreadyFiled,
}: {
  event: CalendarEvent;
  tripId: string;
  showCountry: boolean;
  alreadyFiled: boolean;
}) {
  const [filed, setFiled] = useState(false);
  const done = filed || alreadyFiled;
  const when = formatEventDates(event.startDate, event.endDate);
  const country = getCountry(event.countryCode)?.name ?? event.countryCode;

  function file() {
    addItem(
      tripId,
      {
        title: event.name,
        category: "activity",
        source: "manual",
        notes: `${[showCountry ? `${when}, ${country}` : when, event.note].filter(Boolean).join(". ")} (${
          TIER_LABELS.calendar
        })`,
      },
      // Dates from the calendar, not from a model, though a lunar one can move a day.
      { confidence: 0.9, extractionMethod: "deterministic" },
    );
    setFiled(true);
  }

  return (
    <Card as="div" className="raised p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-headline">{event.name}</h3>
        <Chip tone={TIER_TONE.calendar}>Calendar</Chip>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-footnote text-ink-soft tabular">
          {when}
          {showCountry && ` · ${country}`}
        </span>
        <Chip tone={holidayTone(event.kind)}>{KIND_LABELS[event.kind]}</Chip>
      </div>

      {event.note && <p className="mt-2 text-subheadline text-ink-soft">{event.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={file}
          disabled={done}
          className={done ? FILED_BUTTON_CLASSES : SECONDARY_BUTTON_CLASSES}
        >
          {done ? "Filed ✓" : "Add to trip"}
        </button>
      </div>
    </Card>
  );
}

/** "Filed": the secondary button's shape in the ok tone, left undimmed though it is disabled. */
const FILED_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-ok-soft px-4 py-2 text-subheadline font-medium text-ok";

function SuggestionCard({ suggestion, tripId }: { suggestion: Suggestion; tripId: string }) {
  const [filed, setFiled] = useState(false);

  function file() {
    addItem(
      tripId,
      {
        title: suggestion.name,
        category: "activity",
        source: "manual",
        place: suggestion.place,
        notes: `${suggestion.why}${suggestion.attribution ? ` (${suggestion.attribution})` : ""}`,
      },
      { confidence: 0.7, extractionMethod: "llm" },
    );
    setFiled(true);
  }

  return (
    <Card as="div" className="raised p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-headline">{suggestion.name}</h3>
        <Chip tone={TIER_TONE[suggestion.tier] ?? "neutral"}>
          {suggestion.tier.charAt(0).toUpperCase() + suggestion.tier.slice(1)}
        </Chip>
      </div>

      <p className="mt-1 text-subheadline text-ink-soft">{suggestion.why}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={file}
          disabled={filed}
          className={filed ? FILED_BUTTON_CLASSES : SECONDARY_BUTTON_CLASSES}
        >
          {filed ? "Filed ✓" : "Add to trip"}
        </button>

        <a
          href={openInMapsUrl(suggestion.place)}
          target="_blank"
          rel="noreferrer"
          className={BORDERLESS_BUTTON_CLASSES}
        >
          Maps ↗
        </a>

        {suggestion.url && (
          <a
            href={suggestion.url}
            target="_blank"
            rel="noreferrer"
            className="press tap inline-flex items-center text-footnote text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            {suggestion.attribution ?? "source"} ↗
          </a>
        )}

        {suggestion.priceHint && (
          <span className="ml-auto text-footnote text-ink-soft tabular">
            {suggestion.priceHint}
          </span>
        )}
      </div>
    </Card>
  );
}

/** Says plainly which tiers were consulted — and which were not. */
function Sourcing({ tiers, notes }: { tiers: readonly SourceTier[]; notes: string[] }) {
  return (
    <Card className="p-4">
      <p className="section-label">Where these came from</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {tiers.map((tier) => (
          <li key={tier}>
            <Chip tone={TIER_TONE[tier] ?? "neutral"}>{TIER_LABELS[tier]}</Chip>
          </li>
        ))}
      </ul>
      {notes.map((note) => (
        <p key={note} className="mt-2 text-caption text-ink-soft">
          {note}
        </p>
      ))}
    </Card>
  );
}

function LoadingSections({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Looking things up">
      {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ))}
    </div>
  );
}

/** Where to look, if they have not said: the city they have most filed in. */
function defaultDestination(trip: Trip, items: TripItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const city = item.place?.city;
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];

  const country = getCountry(trip.destinationCountries?.[0]);
  return country?.name ?? trip.name;
}
