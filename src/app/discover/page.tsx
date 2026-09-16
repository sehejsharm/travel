"use client";

import Link from "next/link";
import { useState } from "react";
import { InterestPicker } from "@/components/interest-picker";
import { PrimaryButton, TextInput } from "@/components/form";
import {
  Card,
  Chip,
  EmptyState,
  ScreenHeader,
  ScreenSkeleton,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { getInterest } from "@/lib/advisor/interests";
import { TIER_LABELS, type AdviceResult, type Suggestion } from "@/lib/advisor/types";
import { DEFAULT_INTERESTS } from "@/lib/advisor/interests";
import type { Trip, TripItem } from "@/lib/domain/types";
import { openInMapsUrl } from "@/lib/maps";
import { getCountry } from "@/lib/reference/countries";
import { addItem, cacheAdvice, cachedAdvice, updateTrip } from "@/lib/store/state";
import { useTripView } from "@/lib/store/use-store";

const TIER_TONE: Record<string, "accent" | "ok" | "neutral" | "warning"> = {
  saved: "ok",
  community: "ok",
  places: "warning",
  web: "neutral",
};

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

  const interests = trip.interests ?? [];
  const where = destination.trim() || defaultDestination(trip, items);
  const key = `${where.toLowerCase()}|${[...interests].sort().join(",")}`;
  const advice = fresh ?? cachedAdvice(state, trip.id, key);

  // Nothing picked yet: the whole screen is the question.
  if (interests.length === 0) {
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
              onClick={() => updateTrip(trip.id, { interests: picked })}
              disabled={picked.length === 0}
            >
              Save and find things to do
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  async function find() {
    if (!trip) return;

    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/advise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destination: where,
          countryCode: trip.destinationCountries?.[0],
          interests,
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
      cacheAdvice(trip.id, key, payload as AdviceResult);
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
        meta={`${interests.length} interests · every suggestion names where it came from`}
        action={
          <Link
            href="/trip"
            className="press rounded-xl border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            Edit interests
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              Where
            </span>
            <TextInput
              value={destination}
              placeholder={defaultDestination(trip, items)}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          <div className="shrink-0 sm:w-48">
            <PrimaryButton onClick={find} disabled={loading}>
              {loading ? "Looking…" : advice ? "Look again" : "Find things to do"}
            </PrimaryButton>
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
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
        <Card className="border-critical p-4">
          <p className="text-sm font-medium text-critical">{error}</p>
        </Card>
      )}

      {loading && !advice && <LoadingSections count={interests.length} />}

      {advice && (
        <>
          <Sourcing advice={advice} />

          {advice.sections.map((section) => {
            const interest = getInterest(section.interestId);

            return (
              <section key={section.interestId}>
                <SectionTitle trailing={`${section.suggestions.length}`}>
                  {interest ? `${interest.emoji} ${interest.label}` : section.interestId}
                </SectionTitle>

                <ul className="flex flex-col gap-2.5">
                  {section.suggestions.map((suggestion, index) => (
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

      {!advice && !loading && !error && (
        <EmptyState
          title="Nothing looked up yet"
          body="Tap find, and I will work down from your own saves to published trips before spending anything on a search."
        />
      )}
    </div>
  );
}

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
    <Card as="div" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-medium">{suggestion.name}</h3>
        <Chip tone={TIER_TONE[suggestion.tier] ?? "neutral"}>{suggestion.tier}</Chip>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{suggestion.why}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={file}
          disabled={filed}
          className={`press rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide ${
            filed
              ? "bg-[var(--ok-soft)] text-ok"
              : "bg-accent text-accent-ink"
          }`}
        >
          {filed ? "Filed ✓" : "Add to trip"}
        </button>

        <a
          href={openInMapsUrl(suggestion.place)}
          target="_blank"
          rel="noreferrer"
          className="press rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-accent-strong"
        >
          Maps ↗
        </a>

        {suggestion.url && (
          <a
            href={suggestion.url}
            target="_blank"
            rel="noreferrer"
            className="press font-mono text-[10px] text-ink-faint underline"
          >
            {suggestion.attribution ?? "source"} ↗
          </a>
        )}

        {suggestion.priceHint && (
          <span className="ml-auto font-mono text-[10px] text-ink-faint">
            {suggestion.priceHint}
          </span>
        )}
      </div>
    </Card>
  );
}

/** Says plainly which tiers were consulted — and which were not. */
function Sourcing({ advice }: { advice: AdviceResult }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        Where these came from
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {advice.tiersUsed.map((tier) => (
          <li key={tier}>
            <Chip tone={TIER_TONE[tier] ?? "neutral"}>{TIER_LABELS[tier]}</Chip>
          </li>
        ))}
      </ul>
      {advice.notes?.map((note) => (
        <p key={note} className="mt-2 text-[11px] text-ink-faint">
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
