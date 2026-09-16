"use client";

import Link from "next/link";
import type { Trip, TripItem } from "@/lib/domain/types";
import { dismissPrompt } from "@/lib/store/state";
import { Card } from "./ui";

interface Prompt {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

/**
 * What creation deliberately did not ask for, asked later and only once the
 * trip is real enough to make the question worth answering. Each can be waved
 * away for good.
 */
function pending(trip: Trip, items: TripItem[]): Prompt[] {
  const dismissed = new Set(trip.dismissedPrompts ?? []);
  const prompts: Prompt[] = [];

  if (trip.datesTbd) {
    prompts.push({
      id: "dates",
      title: "Add your dates",
      body: "Visa lead times, weather and jet lag checks are waiting on them.",
      href: "/trip",
      cta: "Add dates",
    });
  }

  if (trip.travelers.length === 0) {
    prompts.push({
      id: "travelers",
      title: "Who is going?",
      body: "Visas, passport validity and insurance all check per traveller.",
      href: "/trip",
      cta: "Add travellers",
    });
  }

  if (!trip.interests?.length && items.length >= 2) {
    prompts.push({
      id: "interests",
      title: "Pick what you are into",
      body: "Discover suggests things to do under headings you choose.",
      href: "/discover",
      cta: "Pick interests",
    });
  }

  if (!trip.budgetTarget && items.some((item) => item.cost)) {
    prompts.push({
      id: "budget",
      title: "Set a budget target?",
      body: "You have prices filed. A target turns them into a number that means something.",
      href: "/trip",
      cta: "Set a target",
    });
  }

  return prompts.filter((prompt) => !dismissed.has(prompt.id));
}

export function DeferredPrompts({ trip, items }: { trip: Trip; items: TripItem[] }) {
  // One at a time: a stack of nags is just a second empty state.
  const prompt = pending(trip, items)[0];
  if (!prompt) return null;

  return (
    <Card className="animate-rise flex items-start gap-3 border-accent/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{prompt.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{prompt.body}</p>

        <div className="mt-2.5 flex items-center gap-3">
          <Link
            href={prompt.href}
            className="press rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent-ink"
          >
            {prompt.cta}
          </Link>
          <button
            type="button"
            onClick={() => dismissPrompt(trip.id, prompt.id)}
            className="press font-mono text-[10px] text-ink-faint underline"
          >
            not now
          </button>
        </div>
      </div>
    </Card>
  );
}
