"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InterestPicker } from "@/components/interest-picker";
import { Field, PrimaryButton, TextInput } from "@/components/form";
import {
  BORDERLESS_BUTTON_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/styles";
import {
  ActionBar,
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
import { mapEmbedUrl, openInMapsUrl } from "@/lib/maps";
import {
  allTrailsCountryUrl,
  allTrailsUrl,
  BIRDS_INTEREST,
  eBirdUrl,
  TRAILS_INTEREST,
} from "@/lib/outdoor-links";
import { COUNTRY_LIST, getCountry } from "@/lib/reference/countries";
import { groundPlace } from "@/lib/reference/places";
import { fold } from "@/lib/reference/text";
import { loadHolidays } from "@/lib/reference/holidays";
import { addItem, cacheAdvice, cachedAdvice, updateTrip } from "@/lib/store/state";
import { tripadvisorThingsToDoUrl, tripadvisorUrl } from "@/lib/tripadvisor";
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

/**
 * In place of the advise route's "nothing came back" (a 503) when the calendar
 * has listed something: that answer is about the search, not about the
 * festivals and days off below it.
 */
const SEARCH_EMPTY_NOTE =
  "The search found nothing it could verify, so what is below comes from Manifest’s calendar only. To search further, add an API key for the paid tiers, or file a few places yourself first.";

/** What went wrong with the search, and the route's status, when it answered at all. */
interface SearchProblem {
  message: string;
  status?: number;
}

export default function DiscoverScreen() {
  const { state, trip, items, hydrated } = useTripView();
  const [destination, setDestination] = useState("");
  const [draftInterests, setDraftInterests] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchProblem>();
  const [fresh, setFresh] = useState<AdviceResult>();
  const [mappedId, setMappedId] = useState<string>();
  // The calendar countries whose fetch has finished, joined. If they are
  // still not in after that, the device is offline with the chunk not cached
  // yet, which the calendar note says rather than waiting without a word.
  const calendarCodes = trip ? calendarCountries(trip, items).sort().join(",") : "";
  const [settledCodes, setSettledCodes] = useState("");
  useEffect(() => {
    if (!calendarCodes) return;
    let live = true;
    // The trip view asks for these already, and the two share one fetch.
    void loadHolidays(calendarCodes.split(",")).then(() => {
      if (live) setSettledCodes(calendarCodes);
    });
    return () => {
      live = false;
    };
  }, [calendarCodes]);

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
  const wantsCalendar = interests.includes(CALENDAR_INTEREST);
  const listed = wantsCalendar ? calendarSection(calendar) : [];
  const fromCalendar = listed.length > 0;
  // Still to arrive, or could not: there is a calendar to show, but not yet.
  const calendarPending = wantsCalendar && !trip.datesTbd && calendar.countries.length > 0 && !calendar.ready;
  const calendarOffline = calendarPending && settledCodes === calendarCodes;
  // The calendar follows the trip, not the Where field, so a place typed in
  // that is not the default gets each card's country named.
  const typed = destination.trim().toLowerCase();
  const elsewhere = typed !== "" && typed !== defaultDestination(trip, items).toLowerCase();
  const advice = fresh ?? cachedAdvice(state, trip.id, adviceKey(where, interests));
  // The search found nothing, but the calendar has: a note, not a failure.
  const searchEmpty = error?.status === 503 && fromCalendar && !advice;
  const filedTitles = new Set(items.map((item) => item.title.trim().toLowerCase()));
  // Links out cost nothing, so they show whether or not the search has run.
  // A country's own name is the country, not a city: "Malaysia" would match Malé.
  const namedCountry = COUNTRY_LIST.find((country) => fold(country.name) === fold(where))?.code;
  // A city the place lists cannot locate still has the country it was filed under.
  const filedCountry = items.find((item) => item.place?.city && fold(item.place.city) === fold(where))
    ?.place?.countryCode;
  const linkCountry =
    namedCountry ??
    groundPlace(where)?.countryCode ??
    filedCountry ??
    trip.destinationCountries?.[0];
  const linkCountryName = getCountry(linkCountry)?.name ?? linkCountry;
  const wantsTrails = interests.includes(TRAILS_INTEREST);
  const trailsNearUrl = wantsTrails && !namedCountry ? allTrailsUrl(where) : undefined;
  // With no city to frame, the whole country.
  const trailsInUrl =
    wantsTrails && !trailsNearUrl && linkCountry ? allTrailsCountryUrl(linkCountry) : undefined;
  const birdsCountry = interests.includes(BIRDS_INTEREST) ? linkCountry : undefined;

  // The map follows the suggestion last tapped, starting with the first.
  const sectionsShown = shownSections(interests, fromCalendar, advice);
  const suggestions = sectionsShown.flatMap((shown) => (shown.source === "search" ? shown.section.suggestions : []));
  const mapped = suggestions.find((suggestion) => suggestion.id === mappedId) ?? suggestions[0];

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
        </Card>
        <ActionBar>
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
        </ActionBar>
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
        </Card>
        {/* Kept in reach: on a phone the end of 22 tiles is screens away. */}
        <ActionBar>
          <PrimaryButton
            onClick={() => {
              updateTrip(trip.id, { interests: picked });
              void find(picked);
            }}
            disabled={picked.length === 0}
          >
            Save and find things to do
          </PrimaryButton>
        </ActionBar>
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
      if (!response.ok) {
        setError({ message: payload?.error ?? "That did not work.", status: response.status });
        return;
      }

      setFresh(payload as AdviceResult);
      cacheAdvice(trip.id, adviceKey(where, picked), payload as AdviceResult);
    } catch (problem) {
      setError({ message: problem instanceof Error ? problem.message : "That did not work." });
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

        {wantsCalendar && trip.datesTbd && (
          <p className="mt-3 text-footnote text-ink-soft">
            Manifest&rsquo;s calendar adds the festivals on your dates once they are set.
          </p>
        )}

        {calendarPending && (
          <p role="status" className="mt-3 text-footnote text-ink-soft">
            {calendarOffline
              ? "Manifest’s calendar for your dates is not on this device yet. It loads when you are back online."
              : "Loading Manifest’s calendar for your dates…"}
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

      <Card className="p-4">
        <ul className="flex flex-col items-start gap-1">
          <li>
            <a
              href={tripadvisorThingsToDoUrl(where)}
              target="_blank"
              rel="noreferrer"
              className={BORDERLESS_BUTTON_CLASSES}
            >
              Things to do in {where}, on Tripadvisor ↗
            </a>
          </li>
          {trailsNearUrl && (
            <li>
              <a href={trailsNearUrl} target="_blank" rel="noreferrer" className={BORDERLESS_BUTTON_CLASSES}>
                Trails near {where}, on AllTrails ↗
              </a>
            </li>
          )}
          {trailsInUrl && (
            <li>
              <a href={trailsInUrl} target="_blank" rel="noreferrer" className={BORDERLESS_BUTTON_CLASSES}>
                Trails in {linkCountryName}, on AllTrails ↗
              </a>
            </li>
          )}
          {birdsCountry && (
            <li>
              <a
                href={eBirdUrl(birdsCountry)}
                target="_blank"
                rel="noreferrer"
                className={BORDERLESS_BUTTON_CLASSES}
              >
                Birds seen in {linkCountryName}, on eBird ↗
              </a>
            </li>
          )}
        </ul>
      </Card>

      {error && !searchEmpty && (
        <div className="rounded-card bg-critical-soft p-4 text-subheadline text-critical">{error.message}</div>
      )}

      {searchEmpty && (
        <Card className="p-4">
          <p className="text-subheadline text-ink-soft">{SEARCH_EMPTY_NOTE}</p>
        </Card>
      )}

      {loading && !advice && <LoadingSections count={interests.length} />}

      {!advice && !loading && !error && (
        // The search card's own button above is the action that fills this, so
        // the note does not repeat it.
        <Card className="p-5 text-center">
          <p className="text-title-3">Nothing looked up yet</p>
          <p className="mt-2 text-subheadline text-ink-soft">
            {fromCalendar && "The festivals and days off on your dates are already below, from Manifest’s calendar. "}
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

          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-6">
            {mapped && <SuggestionMap suggestion={mapped} />}

            <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
              {sectionsShown.map((shown) => {
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
                              showCountry={calendar.countries.length > 1 || elsewhere}
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
                          <SuggestionCard
                            suggestion={suggestion}
                            tripId={trip.id}
                            mapped={suggestion.id === mapped?.id}
                            onMap={() => setMappedId(suggestion.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
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

/**
 * The suggestion last tapped, on a small map: beside the list on a wide
 * screen, and on a phone a strip held under the top bar while the list
 * scrolls. It searches by name and city, since most suggestions only know
 * their city's centre.
 */
function SuggestionMap({ suggestion }: { suggestion: Suggestion }) {
  return (
    <aside
      aria-label="Map"
      className="sticky top-[var(--header-height,0px)] z-20 lg:top-10 lg:col-start-2 lg:row-start-1"
    >
      <Card as="div" className="overflow-hidden">
        <iframe
          key={suggestion.id}
          src={mapEmbedUrl({ name: suggestion.name, city: suggestion.place.city })}
          title={`Map of ${suggestion.name}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-36 w-full border-0 lg:h-64"
        />
        <p className="truncate border-t border-line px-4 py-2 text-footnote text-ink-soft">
          {suggestion.name}
        </p>
      </Card>
    </aside>
  );
}

function SuggestionCard({
  suggestion,
  tripId,
  mapped,
  onMap,
}: {
  suggestion: Suggestion;
  tripId: string;
  /** Whether the map beside the list shows this one. */
  mapped: boolean;
  onMap: () => void;
}) {
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
    // A tap anywhere but its buttons and links puts the card on the map. The
    // title is the same control as a button, for the keyboard.
    <div
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("a, button")) onMap();
      }}
    >
      <Card as="div" className={`raised p-4 ${mapped ? "border-accent" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-headline">
            <button
              type="button"
              onClick={onMap}
              aria-pressed={mapped}
              aria-label={`Show ${suggestion.name} on the map`}
              className="text-left"
            >
              {suggestion.name}
            </button>
          </h3>
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

          <a
            href={tripadvisorUrl(suggestion.name, suggestion.place.city)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Reviews of ${suggestion.name} on Tripadvisor`}
            className={BORDERLESS_BUTTON_CLASSES}
          >
            Tripadvisor ↗
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
    </div>
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
