import type { GeoPoint } from "../domain/types";

export interface Airport {
  iata: string;
  name: string;
  city: string;
  countryCode: string;
  point: GeoPoint;
  /** Published minimum connection times, in minutes. */
  minConnect: { domestic: number; international: number };
}

export const AIRPORTS: Record<string, Airport> = {
  DEL: {
    iata: "DEL",
    name: "Indira Gandhi International",
    city: "Delhi",
    countryCode: "IN",
    point: { lat: 28.5562, lng: 77.1 },
    minConnect: { domestic: 60, international: 90 },
  },
  BOM: {
    iata: "BOM",
    name: "Chhatrapati Shivaji Maharaj International",
    city: "Mumbai",
    countryCode: "IN",
    point: { lat: 19.0896, lng: 72.8656 },
    minConnect: { domestic: 60, international: 90 },
  },
  HND: {
    iata: "HND",
    name: "Tokyo Haneda",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.5494, lng: 139.7798 },
    minConnect: { domestic: 45, international: 75 },
  },
  NRT: {
    iata: "NRT",
    name: "Tokyo Narita",
    city: "Tokyo",
    countryCode: "JP",
    point: { lat: 35.772, lng: 140.3929 },
    minConnect: { domestic: 60, international: 90 },
  },
  KIX: {
    iata: "KIX",
    name: "Kansai International",
    city: "Osaka",
    countryCode: "JP",
    point: { lat: 34.4342, lng: 135.2328 },
    minConnect: { domestic: 50, international: 80 },
  },
  SIN: {
    iata: "SIN",
    name: "Singapore Changi",
    city: "Singapore",
    countryCode: "SG",
    point: { lat: 1.3644, lng: 103.9915 },
    minConnect: { domestic: 60, international: 60 },
  },
  BKK: {
    iata: "BKK",
    name: "Suvarnabhumi",
    city: "Bangkok",
    countryCode: "TH",
    point: { lat: 13.69, lng: 100.7501 },
    minConnect: { domestic: 70, international: 90 },
  },
  DXB: {
    iata: "DXB",
    name: "Dubai International",
    city: "Dubai",
    countryCode: "AE",
    point: { lat: 25.2532, lng: 55.3657 },
    minConnect: { domestic: 60, international: 75 },
  },
  LHR: {
    iata: "LHR",
    name: "London Heathrow",
    city: "London",
    countryCode: "GB",
    point: { lat: 51.47, lng: -0.4543 },
    minConnect: { domestic: 60, international: 90 },
  },
};

export function getAirport(code?: string): Airport | undefined {
  if (!code) return undefined;
  return AIRPORTS[code.toUpperCase()];
}
