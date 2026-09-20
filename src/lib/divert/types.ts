import type { GeoPoint } from "../domain/types";
import type { TravelMode } from "../geo";

/**
 * Whether the person holding this device is with the rest of the party or
 * has broken off for a bit. Nothing else in the app changes with it: the
 * trip, the checks and the timeline are the group's, whoever is looking.
 */
export type UserGroupStatus = "IN_GROUP" | "DIVERTED";

export type DivertCategory = "coffee" | "sights" | "food" | "shopping" | "rest";

/** Keys into the icon set, so the data stays free of JSX. */
export type DivertIcon = "cup" | "camera" | "bowl" | "bag" | "bench";

export interface DivertInterest {
  id: string;
  title: string;
  icon: DivertIcon;
  category: DivertCategory;
  /** One line under the title in the picker. */
  blurb: string;
  /** How long it usually takes, which is what the rejoin maths waits for. */
  dwellMinutes: number;
}

export interface DivertSpot {
  id: string;
  name: string;
  category: DivertCategory;
  point: GeoPoint;
  detail?: string;
  /** Made up near the group rather than looked up, and the UI says so. */
  synthetic?: boolean;
}

/** One stop on the group's day, as the route builder wants it. */
export interface RouteStop {
  id: string;
  name: string;
  point: GeoPoint;
  startsAt: string;
  endsAt?: string;
}

export interface GroupWaypoint {
  id: string;
  name: string;
  point: GeoPoint;
  /** Minutes after the clock the group gets here; negative once it has. */
  arriveMin: number;
  /** Minutes after the clock the group moves on. */
  departMin: number;
  /** How the group gets here from the previous stop. */
  mode: TravelMode;
}

/**
 * The group's day as a line through time and space. Everything is relative
 * to `clock`, which is now when the day is under way and a stand-in when it
 * is not, so the same maths serves a live afternoon and a plan for October.
 */
export interface GroupRoute {
  waypoints: GroupWaypoint[];
  /** Where the group is at the clock. */
  position: GeoPoint;
  /** The stop the group is at, when it is at one. */
  atStop?: number;
  /** The next stop it has yet to reach; equals the length once the day is done. */
  nextStop: number;
  /** How far along the current leg the group is, 0 to 1. Zero at a stop. */
  progress: number;
  clock: Date;
  /** The UTC offset the stops are written in, so times read as the locals see them. */
  offset: string;
  /** True when the clock is a stand-in because the day is not live. */
  simulated: boolean;
  /** True when the stops are the bundled sample rather than this trip's. */
  demo: boolean;
  /** What the group is doing at the clock, in words. */
  nowLabel: string;
}

export type RejoinOptionType = "CATCH_UP" | "GROUP_DETOUR";

export interface RejoinOption {
  type: RejoinOptionType;
  location: GeoPoint;
  meetingPointName: string;
  /** Minutes after the clock until the solo traveller is at the meeting point. */
  userETA: number;
  /** Minutes after the clock until the group is. */
  groupETA: number;
  userDistanceM: number;
  groupDistanceM: number;
  /** Minutes whoever is there first spends waiting for the other. */
  waitMinutes: number;
  /** How much later the group reaches its next stop because of this. Zero for a catch-up. */
  detourMinutes: number;
  /** False when the times do not work: the group will have moved on. */
  feasible: boolean;
  /** One line on how it plays out. */
  note: string;
  userMode: TravelMode;
  groupMode: TravelMode;
}

export interface DivertPlan {
  spot: DivertSpot;
  interests: DivertInterest[];
  /** Minutes at the spot, summed over the interests picked. */
  dwellMinutes: number;
  route: GroupRoute;
  /** The catch-up first, then the group detour. */
  options: RejoinOption[];
}

/** What the store keeps while someone is off on their own. */
export interface DivertSession {
  tripId: string;
  /** Who broke off, when the trip lists its travellers. */
  travelerId?: string;
  interestIds: string[];
  spot: DivertSpot;
  startedAt: string;
  /** The rendezvous they went with, once they picked one. */
  chosen?: RejoinOptionType;
}
