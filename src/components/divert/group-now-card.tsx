import { Card } from "@/components/ui";
import { MODE_LABELS, wallClock } from "@/lib/divert/format";
import { DEMO_GROUP } from "@/lib/divert/mock";
import type { GroupRoute } from "@/lib/divert/types";

/** Where the group is right now, and the honest small print about how we know. */
export function GroupNowCard({ route }: { route: GroupRoute }) {
  const at = route.atStop !== undefined ? route.waypoints[route.atStop] : undefined;
  const next = route.waypoints[route.nextStop];
  const time = (minutes = 0) => wallClock(route.clock, route.offset, minutes);

  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        The group · {time()}
      </p>
      <p className="mt-1 text-sm font-medium">
        {route.nowLabel}
        {at && at.departMin > 0 && ` · leaves ${time(at.departMin)}`}
      </p>
      {next && (
        <p className="mt-0.5 text-sm text-ink-soft">
          Next: {next.name} at {time(next.arriveMin)}, {MODE_LABELS[next.mode]}
        </p>
      )}
      {(route.demo || route.simulated) && (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-faint">
          {route.demo
            ? `${DEMO_GROUP}. Put timed places on your timeline to plan around your own day.`
            : "Simulated from your timeline: the day is not under way, and Manifest never reads your location."}
        </p>
      )}
    </Card>
  );
}
