import { gazetteerPoint } from "./spots";
import type { RouteStop } from "./types";

/**
 * A morning's walk through Asakusa and Ueno, used only when the trip has no
 * timed, located stops of its own. Real places, walkable legs, and times close
 * enough together that the rejoin maths has decisions to make.
 */
export const DEMO_DATE = "2026-10-18";
export const DEMO_OFFSET = "+09:00";
export const DEMO_GROUP = "Sample walk through Asakusa and Ueno";

function at(time: string): string {
  return `${DEMO_DATE}T${time}:00${DEMO_OFFSET}`;
}

export const DEMO_STOPS: RouteStop[] = [
  {
    id: "demo-sensoji",
    name: "Senso-ji",
    point: gazetteerPoint("Senso-ji"),
    startsAt: at("09:00"),
    endsAt: at("10:15"),
  },
  {
    id: "demo-kappabashi",
    name: "Kappabashi Kitchen Town",
    point: { lat: 35.7135, lng: 139.788 },
    startsAt: at("10:30"),
    endsAt: at("11:15"),
  },
  {
    id: "demo-ueno",
    name: "Ueno Park",
    point: { lat: 35.7125, lng: 139.777 },
    startsAt: at("11:40"),
    endsAt: at("12:40"),
  },
  {
    id: "demo-ameyoko",
    name: "Ameyoko",
    point: { lat: 35.71, lng: 139.7745 },
    startsAt: at("12:50"),
    endsAt: at("13:30"),
  },
];
