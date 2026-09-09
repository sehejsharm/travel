import Link from "next/link";
import { getTrip, listItems } from "@/lib/db";
import { SOURCE_LABELS } from "@/lib/domain/types";
import { formatMoney } from "@/lib/reference/fx";
import { buildRecap } from "@/lib/recap";
import { formatDay } from "@/lib/rules";

export const dynamic = "force-dynamic";

const STATUS_COPY = {
  upcoming: "This trip has not started yet, so this is a preview of what the recap will hold.",
  "under way": "You are on this trip now — the numbers move as things get filed.",
  complete: "Here is how the trip actually went.",
} as const;

export default function Recap() {
  const trip = getTrip();
  const items = listItems(trip.id);
  const recap = buildRecap(trip, items, new Date());

  const stats: { label: string; value: string }[] = [
    { label: "Nights", value: String(recap.nights) },
    { label: "Countries", value: recap.countries.join(", ") || "—" },
    { label: "Places", value: String(recap.placesVisited) },
    { label: "Activities", value: String(recap.activities) },
    { label: "Booked", value: formatMoney(recap.booked, recap.currency) },
    { label: "Still estimated", value: formatMoney(recap.estimated, recap.currency) },
  ];

  const mostUsedSource = recap.bySource[0];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
          Recap
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold">{trip.name}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{STATUS_COPY[recap.status]}</p>
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-line bg-surface p-4 shadow-sm">
            <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-ink-faint">
              {stat.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Where this trip came from</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every item, traced back to whatever you forwarded in.
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {recap.bySource.map(({ source, count }) => (
            <li key={source}>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-ink-soft">{SOURCE_LABELS[source]}</span>
                <span className="tabular font-mono text-ink-soft">{count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-sm bg-surface-2">
                <div
                  className="h-full bg-accent-2"
                  style={{ width: `${(count / items.length) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>

        {mostUsedSource && (
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
            Most of this trip arrived as{" "}
            <span className="font-medium text-ink">{SOURCE_LABELS[mostUsedSource.source]}</span>{" "}
            content — {mostUsedSource.count} of {items.length} items.
          </p>
        )}
      </section>

      {recap.busiestDay && (
        <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Busiest day</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {formatDay(recap.busiestDay.date)} — {recap.busiestDay.count} things booked.
          </p>
        </section>
      )}

      <Link href="/" className="font-mono text-[11px] text-accent-strong underline">
        Back to the planning desk
      </Link>
    </div>
  );
}
