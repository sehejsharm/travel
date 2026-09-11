import { COUNTRY_LATITUDE } from "./cities";

/**
 * Monthly climate normals for one reference city per country. Not a forecast —
 * far enough out a forecast does not exist, and packing decisions only need the
 * season. A live forecast API would slot in for trips inside two weeks.
 */
export interface ClimateNormals {
  referenceCity: string;
  /** True when the figures come from the latitude model, not measurements. */
  estimated?: boolean;
  /** Average daily high in °C, January first. */
  highC: number[];
  /** Average daily low in °C, January first. */
  lowC: number[];
  /** Month numbers (1-12) with a wet season or high rainfall. */
  wetMonths: number[];
}

export const CLIMATE: Record<string, ClimateNormals> = {
  JP: {
    referenceCity: "Tokyo",
    highC: [10, 10, 14, 19, 23, 26, 30, 31, 27, 22, 17, 12],
    lowC: [2, 2, 5, 10, 15, 19, 23, 24, 21, 16, 10, 4],
    wetMonths: [6, 7, 9],
  },
  TH: {
    referenceCity: "Bangkok",
    highC: [32, 33, 34, 35, 34, 33, 33, 32, 32, 32, 32, 31],
    lowC: [22, 24, 26, 27, 26, 26, 25, 25, 25, 25, 23, 21],
    wetMonths: [5, 6, 7, 8, 9, 10],
  },
  IN: {
    referenceCity: "Delhi",
    highC: [20, 24, 30, 36, 40, 39, 35, 34, 34, 33, 28, 22],
    lowC: [7, 10, 15, 21, 26, 28, 27, 26, 24, 19, 12, 8],
    wetMonths: [7, 8, 9],
  },
  GB: {
    referenceCity: "London",
    highC: [8, 8, 11, 14, 18, 21, 23, 23, 20, 15, 11, 9],
    lowC: [3, 3, 4, 6, 9, 12, 14, 14, 12, 9, 6, 4],
    wetMonths: [10, 11, 12, 1],
  },
  US: {
    referenceCity: "New York",
    highC: [4, 6, 11, 17, 22, 27, 29, 28, 25, 18, 12, 7],
    lowC: [-3, -2, 2, 7, 13, 18, 21, 20, 17, 11, 5, 0],
    wetMonths: [],
  },
  FR: {
    referenceCity: "Paris",
    highC: [7, 8, 12, 16, 20, 23, 25, 25, 21, 16, 11, 8],
    lowC: [3, 3, 5, 7, 11, 14, 16, 16, 13, 10, 6, 3],
    wetMonths: [],
  },
  IT: {
    referenceCity: "Rome",
    highC: [12, 13, 16, 19, 24, 28, 31, 31, 27, 22, 16, 13],
    lowC: [3, 4, 6, 8, 12, 16, 18, 19, 16, 12, 8, 5],
    wetMonths: [10, 11],
  },
  ES: {
    referenceCity: "Madrid",
    highC: [10, 12, 16, 18, 23, 29, 33, 32, 27, 20, 14, 10],
    lowC: [2, 3, 5, 7, 11, 16, 19, 19, 15, 11, 6, 3],
    wetMonths: [],
  },
  SG: {
    referenceCity: "Singapore",
    highC: [30, 31, 32, 32, 32, 31, 31, 31, 31, 31, 30, 30],
    lowC: [24, 24, 25, 25, 25, 25, 25, 25, 25, 24, 24, 24],
    wetMonths: [11, 12, 1],
  },
  AE: {
    referenceCity: "Dubai",
    highC: [24, 25, 28, 33, 38, 39, 41, 41, 38, 35, 30, 26],
    lowC: [14, 15, 18, 21, 25, 27, 30, 30, 27, 23, 19, 16],
    wetMonths: [],
  },
  ID: {
    referenceCity: "Bali",
    highC: [31, 31, 31, 32, 31, 30, 30, 30, 31, 32, 32, 31],
    lowC: [24, 24, 24, 24, 24, 23, 22, 22, 23, 24, 24, 24],
    wetMonths: [11, 12, 1, 2, 3],
  },
  VN: {
    referenceCity: "Hanoi",
    highC: [20, 21, 23, 28, 32, 33, 33, 32, 31, 29, 26, 22],
    lowC: [14, 16, 19, 22, 25, 26, 26, 26, 25, 22, 19, 15],
    wetMonths: [6, 7, 8, 9],
  },
  AU: {
    referenceCity: "Sydney",
    highC: [26, 26, 25, 23, 20, 17, 17, 18, 20, 22, 24, 25],
    lowC: [19, 19, 17, 15, 11, 9, 8, 9, 11, 14, 16, 18],
    wetMonths: [3, 4, 6],
  },
  NP: {
    referenceCity: "Kathmandu",
    highC: [19, 21, 25, 28, 29, 29, 28, 28, 28, 26, 23, 20],
    lowC: [2, 4, 8, 11, 16, 19, 20, 20, 19, 14, 8, 3],
    wetMonths: [6, 7, 8, 9],
  },
};

/**
 * Countries without measured normals still need a sensible answer. Temperature
 * tracks latitude and season closely enough to say "pack a warm layer" — it is
 * explicitly an estimate, and the UI says so.
 */
function estimateNormals(latitude: number): ClimateNormals {
  const tropical = Math.max(0, 1 - Math.abs(latitude) / 23.5);
  const baseHigh = 31 - Math.abs(latitude) * 0.42;
  // Seasonal swing grows with distance from the equator and flips below it.
  const swing = Math.min(16, Math.abs(latitude) * 0.34) * (latitude < 0 ? -1 : 1);

  const highC: number[] = [];
  const lowC: number[] = [];

  for (let month = 0; month < 12; month++) {
    // Peaks in July in the north, January in the south.
    const season = -Math.cos(((month - 6) / 12) * 2 * Math.PI);
    const high = Math.round(baseHigh + season * swing);
    highC.push(high);
    lowC.push(Math.round(high - (8 + tropical * -2 + Math.abs(latitude) * 0.06)));
  }

  return { referenceCity: "this region", highC, lowC, wetMonths: [], estimated: true };
}

export interface TripWeather {
  referenceCity: string;
  highC: number;
  lowC: number;
  wet: boolean;
  estimated: boolean;
}

/** Averages the normals across the months the trip actually spans. */
export function weatherFor(
  countryCode: string,
  startDate: string,
  endDate: string,
): TripWeather | undefined {
  const code = countryCode.toUpperCase();
  const latitude = COUNTRY_LATITUDE[code];
  const normals = CLIMATE[code] ?? (latitude === undefined ? undefined : estimateNormals(latitude));
  if (!normals) return undefined;

  const startMonth = Number(startDate.slice(5, 7));
  const endMonth = Number(endDate.slice(5, 7));
  const months: number[] = [];

  for (let month = startMonth; months.length < 12; month = (month % 12) + 1) {
    months.push(month);
    if (month === endMonth) break;
  }

  const mean = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    referenceCity: normals.referenceCity,
    highC: mean(months.map((month) => normals.highC[month - 1])),
    lowC: mean(months.map((month) => normals.lowC[month - 1])),
    wet: months.some((month) => normals.wetMonths.includes(month)),
    estimated: normals.estimated ?? false,
  };
}
