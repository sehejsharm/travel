"use client";

import type { GeoPoint } from "@/lib/domain/types";
import type { DivertSpot, GroupRoute, RejoinOption } from "@/lib/divert/types";
import { distanceM } from "@/lib/divert/geometry";
import { useReducedMotion } from "@/lib/use-motion";

const WIDTH = 320;
const HEIGHT = 168;
const PAD = 26;
/** Degrees the frame never shrinks below, so two points 30 m apart still read as a map. */
const MIN_SPAN = 0.0025;
/** Stops further off than this are left out of the frame; the line still leads toward them. */
const FRAME_RADIUS_M = 2500;

interface Projected {
  x: number;
  y: number;
}

/**
 * A flat projection of a few square kilometres, centred on everything that
 * matters. Longitude is stretched by the cosine of the latitude so a metre
 * east is as long as a metre north, which is all a map this size needs.
 */
function projector(points: GeoPoint[]): (point: GeoPoint) => Projected {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const stretch = Math.cos((midLat * Math.PI) / 180);

  const minX = Math.min(...lngs) * stretch;
  const maxX = Math.max(...lngs) * stretch;
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);

  const spanX = Math.max(maxX - minX, MIN_SPAN);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  return (point) => ({
    x: WIDTH / 2 + (point.lng * stretch - centreX) * scale,
    y: HEIGHT / 2 - (point.lat - centreY) * scale,
  });
}

function path(points: Projected[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

/** Where a marker's label goes: above it, or below when there is no room above. */
function labelAt(marker: Projected, below = false): Projected {
  return {
    x: Math.max(44, Math.min(WIDTH - 44, marker.x)),
    y: below || marker.y < 22 ? marker.y + 18 : marker.y - 11,
  };
}

function collide(a: Projected, b: Projected): boolean {
  return Math.abs(a.x - b.x) < 110 && Math.abs(a.y - b.y) < 14;
}

function Label({ at, text, tone }: { at: Projected; text: string; tone: string }) {
  const shown = text.length > 26 ? `${text.slice(0, 25)}…` : text;

  return (
    <text
      x={at.x}
      y={at.y}
      textAnchor="middle"
      fontSize="9"
      fontFamily="var(--font-plex-mono), monospace"
      fill={tone}
      stroke="var(--surface-2)"
      strokeWidth="3"
      paintOrder="stroke"
    >
      {shown}
    </text>
  );
}

/**
 * One option, drawn: the group's day as a line, where it is now, where the
 * solo traveller is going, and where the two meet. Inline SVG rather than a
 * tile map, so it works with no signal and in both themes.
 */
export function DivertMap({
  route,
  spot,
  option,
}: {
  route: GroupRoute;
  spot: DivertSpot;
  option: RejoinOption;
}) {
  const reduced = useReducedMotion();

  // The frame holds the group, the spot and the meeting point, plus whatever
  // stops are close enough to matter. A transit hop across the city would
  // otherwise shrink the part you are actually walking into a corner.
  const project = projector([
    route.position,
    spot.point,
    option.location,
    ...route.waypoints
      .filter((waypoint) => distanceM(route.position, waypoint.point) <= FRAME_RADIUS_M)
      .map((waypoint) => waypoint.point),
  ]);

  const stops = route.waypoints.map((waypoint) => project(waypoint.point));
  const here = project(route.position);
  const there = project(spot.point);
  const meet = project(option.location);

  const remaining = route.waypoints.slice(route.nextStop).map((waypoint) => project(waypoint.point));
  const next = route.waypoints[route.nextStop];
  const catchUp = option.type === "CATCH_UP";

  // The group's line: what is left of its day for a catch-up, or the turn
  // it makes toward the spot and then back onto the route for a detour.
  const groupPath = catchUp
    ? path([here, ...remaining])
    : path([here, there, ...(next ? [project(next.point)] : [])]);

  // The solo traveller: out to the spot, then across to wherever they meet.
  const userPath = catchUp ? path([here, there, meet]) : path([here, there]);

  const meetIsSpot = distanceM(option.location, spot.point) < 15;

  // Two labels a few metres apart go one above and one below their markers.
  let spotLabel = labelAt(there);
  let meetLabel = labelAt(meet);
  if (!meetIsSpot && collide(spotLabel, meetLabel)) {
    if (meet.y + 18 <= HEIGHT - 6) meetLabel = labelAt(meet, true);
    else spotLabel = labelAt(there, true);
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Map: ${catchUp ? "you rejoin the group at" : "the group joins you at"} ${option.meetingPointName}`}
      className="block h-auto w-full bg-surface-2"
    >
      <path d={path(stops)} fill="none" stroke="var(--line-strong)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={groupPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeOpacity={catchUp ? 0.55 : 0.85} strokeDasharray={catchUp ? undefined : "5 4"} />
      <path d={userPath} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />

      {stops.map((stop, index) => (
        <circle key={route.waypoints[index].id} cx={stop.x} cy={stop.y} r="3.5" fill="var(--surface)" stroke="var(--ink-faint)" strokeWidth="1.5" />
      ))}

      {/* The group, breathing so it reads as live rather than pinned. */}
      {!reduced && (
        <circle cx={here.x} cy={here.y} r="5" fill="var(--accent)" opacity="0.4">
          <animate attributeName="r" values="5;12;5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={here.x} cy={here.y} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />

      <circle cx={there.x} cy={there.y} r="5" fill="var(--teal)" stroke="var(--surface)" strokeWidth="2" />

      <circle cx={meet.x} cy={meet.y} r="8" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx={meet.x} cy={meet.y} r="2.5" fill="var(--accent)" />

      {!meetIsSpot && <Label at={spotLabel} text={spot.name} tone="var(--teal)" />}
      <Label at={meetLabel} text={option.meetingPointName} tone="var(--accent-strong)" />
    </svg>
  );
}
