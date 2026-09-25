"use client";

import type { GeoPoint } from "@/lib/domain/types";
import { inSentence, NEAR_ENOUGH_M } from "@/lib/divert/format";
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

interface PlacedLabel {
  at: Projected;
  text: string;
  tone: string;
  /** Rendered width, so the label can be kept whole inside the frame. */
  width: number;
}

/** Labels are cut to this many characters, with an ellipsis. */
const LABEL_CHARS = 26;
/** Plex Mono advances 0.6em a character; the labels are 9px. */
const CHAR_WIDTH = 5.4;

function shorten(text: string): string {
  return text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text;
}

/**
 * Where a marker's label goes: above it, or below. Centred on the marker
 * where there is room, and slid inward at the edges so it is never clipped.
 */
function labelAt(marker: Projected, below: boolean, width: number): Projected {
  const half = width / 2 + 4;
  const y = below ? marker.y + 18 : marker.y - 11;
  return {
    x: Math.max(half, Math.min(WIDTH - half, marker.x)),
    y: Math.max(12, Math.min(HEIGHT - 6, y)),
  };
}

function collide(a: PlacedLabel, b: PlacedLabel): boolean {
  return Math.abs(a.at.x - b.at.x) < (a.width + b.width) / 2 + 6 && Math.abs(a.at.y - b.at.y) < 14;
}

/**
 * Places labels in priority order, each above or below its marker, wherever
 * it does not overlap one already placed. A label with nowhere to go is left
 * off rather than drawn over another.
 */
function placeLabels(
  wanted: { marker: Projected; text: string; tone: string; preferBelow?: boolean; required?: boolean }[],
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];

  for (const label of wanted) {
    const text = shorten(label.text);
    const width = text.length * CHAR_WIDTH;
    const tries = (label.preferBelow ? [true, false] : [false, true]).map((below) => ({
      at: labelAt(label.marker, below, width),
      text,
      tone: label.tone,
      width,
    }));
    const fits = tries.find((candidate) => placed.every((other) => !collide(candidate, other)));

    if (fits) placed.push(fits);
    else if (label.required) placed.push(tries[0]);
  }

  return placed;
}

function Label({ at, text, tone }: PlacedLabel) {
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
      {text}
    </text>
  );
}

/**
 * One option, drawn: the group's day as a line, where it is now, where the
 * solo traveller is going, and where the two meet. Inline SVG rather than a
 * tile map, so it works with no signal and in both themes. The group, the
 * spot and the meeting point differ in shape and label as well as colour.
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
  const missed = catchUp && !option.feasible;
  const gone = missed && option.groupLeaveMin !== undefined && option.groupLeaveMin <= 0;
  const meeting = gone
    ? "the group's last stop, where they were"
    : missed
      ? "the group's last stop, which they will have left"
      : catchUp
        ? "where you rejoin them"
        : "where they join you";

  // The group's line: what is left of its day for a catch-up, or the turn
  // it makes toward the spot and then back onto the route for a detour.
  const groupPath = catchUp
    ? path([here, ...remaining])
    : path([here, there, ...(next ? [project(next.point)] : [])]);

  // The solo traveller: out to the spot, then across to wherever they meet.
  const userPath = catchUp ? path([here, there, meet]) : path([here, there]);

  const meetIsSpot = distanceM(option.location, spot.point) < NEAR_ENOUGH_M;
  const meetIsGroup = distanceM(option.location, route.position) < NEAR_ENOUGH_M;

  const labels = placeLabels([
    { marker: meet, text: option.meetingPointName, tone: "var(--accent-strong)", required: true },
    ...(meetIsSpot ? [] : [{ marker: there, text: spot.name, tone: "var(--teal)" }]),
    ...(meetIsGroup ? [] : [{ marker: here, text: "Group", tone: "var(--accent-strong)", preferBelow: true }]),
  ]);

  // A diamond, so the spot never reads as another circle beside the group's.
  const diamond = `M${there.x} ${there.y - 6} L${there.x + 6} ${there.y} L${there.x} ${there.y + 6} L${there.x - 6} ${there.y} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Map: the group, your spot at ${inSentence(spot.name, Boolean(spot.synthetic))}, and ${meeting}, ${inSentence(option.meetingPointName, option.meetingPointGenerated)}`}
      className="block h-auto w-full bg-surface-2"
    >
      <path d={path(stops)} fill="none" stroke="var(--line-strong)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={groupPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeOpacity={catchUp ? 0.55 : 0.85} strokeDasharray={catchUp ? undefined : "6 4"} />
      {/* Dotted, so the traveller's line differs from the group's in shape, not only hue. */}
      <path d={userPath} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="0.5 5" />

      {stops.map((stop, index) => (
        <circle key={route.waypoints[index].id} cx={stop.x} cy={stop.y} r="3.5" fill="var(--surface)" stroke="var(--ink-faint)" strokeWidth="1.5" />
      ))}

      {/* The group breathes only on a live day; a simulated clock is not now. */}
      {!reduced && !route.simulated && (
        <circle cx={here.x} cy={here.y} r="5" fill="var(--accent)" opacity="0.4">
          <animate attributeName="r" values="5;12;5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={here.x} cy={here.y} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />

      <path d={diamond} fill="var(--teal)" stroke="var(--surface)" strokeWidth="2" strokeLinejoin="round" />

      <circle cx={meet.x} cy={meet.y} r="8" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx={meet.x} cy={meet.y} r="2.5" fill="var(--accent)" />

      {labels.map((label) => (
        <Label key={label.text} {...label} />
      ))}
    </svg>
  );
}
