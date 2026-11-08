/** West, south, east and north edges, in degrees. */
export type Bounds = [west: number, south: number, east: number, north: number];

/**
 * A box around each destination country, so a map can be framed on the whole
 * country when no city is known. Rounded outwards to a tenth of a degree.
 *
 * Worked out from Natural Earth’s 1:10m country outlines (public domain). Each
 * box holds the country’s largest part and any land within 250 km of it,
 * island to island, plus any part over 10,000 km² and at least half the
 * largest part’s size, which only joins Malaysia’s two halves. Far-off land
 * drops out, so the map is not mostly ocean: French Guiana and France’s other
 * overseas regions, the Azores and Madeira, the Canaries, Svalbard, the
 * Galápagos, Alaska and Hawaii, among others.
 *
 * - Cyprus is the whole island, as ISO 3166 has it. Natural Earth draws the north apart.
 * - Morocco stops at 27°40′N. Natural Earth draws most of Western Sahara inside
 *   Morocco; ISO 3166 keeps them apart.
 * - Fiji stops at the 180th meridian, short of the Lau islands, so no box has
 *   to wrap round the back of the map.
 */
const BOUNDS: Record<string, Bounds> = {
  IN: [68.1, 8, 97.4, 35.5], // India
  PK: [60.8, 23.6, 77.1, 37.1], // Pakistan
  BD: [88, 20.7, 92.7, 26.7], // Bangladesh
  LK: [79.6, 5.9, 81.9, 9.9], // Sri Lanka
  NP: [80, 26.3, 88.2, 30.5], // Nepal
  MV: [72.6, -0.7, 73.8, 7.2], // Maldives
  BT: [88.7, 26.6, 92.1, 28.4], // Bhutan
  KZ: [46.4, 40.5, 87.4, 55.5], // Kazakhstan
  UZ: [55.9, 37.1, 73.2, 45.6], // Uzbekistan
  JP: [122.9, 24.2, 145.9, 45.6], // Japan
  KR: [124.6, 33.1, 131.9, 38.7], // South Korea
  CN: [73.6, 18.1, 134.8, 53.6], // China
  HK: [113.8, 22.1, 114.5, 22.6], // Hong Kong
  TW: [118.2, 21.9, 122.1, 25.3], // Taiwan
  MO: [113.5, 22.1, 113.6, 22.3], // Macau
  MN: [87.7, 41.5, 120, 52.2], // Mongolia
  TH: [97.3, 5.6, 105.7, 20.5], // Thailand
  VN: [102.1, 8.5, 109.5, 23.4], // Vietnam
  ID: [95, -11, 141, 6], // Indonesia
  MY: [99.6, 0.8, 119.3, 7.4], // Malaysia
  SG: [103.6, 1.2, 104.1, 1.5], // Singapore
  PH: [116.9, 4.6, 126.7, 21.2], // Philippines
  KH: [102.3, 10.4, 107.7, 14.8], // Cambodia
  LA: [100, 13.9, 107.7, 22.5], // Laos
  MM: [92.1, 9.7, 101.2, 28.6], // Myanmar
  BN: [114, 4, 115.4, 5.1], // Brunei
  AE: [51.5, 22.6, 56.4, 26.1], // United Arab Emirates
  SA: [34.5, 16.3, 55.7, 32.2], // Saudi Arabia
  QA: [50.7, 24.5, 51.7, 26.2], // Qatar
  OM: [51.9, 16.6, 59.9, 26.4], // Oman
  BH: [50.4, 25.7, 50.7, 26.3], // Bahrain
  KW: [46.5, 28.5, 48.5, 30.1], // Kuwait
  JO: [34.9, 29.1, 39.3, 33.4], // Jordan
  IL: [34.2, 29.4, 35.9, 33.5], // Israel
  TR: [25.6, 35.8, 44.9, 42.1], // Türkiye
  GE: [39.9, 41, 46.7, 43.6], // Georgia
  AM: [43.4, 38.8, 46.7, 41.3], // Armenia
  AZ: [44.7, 38.3, 50.7, 41.9], // Azerbaijan
  GB: [-8.7, 49.9, 1.8, 60.9], // United Kingdom
  IE: [-10.5, 51.4, -5.9, 55.4], // Ireland
  FR: [-5.2, 41.3, 9.6, 51.1], // France
  DE: [5.8, 47.2, 15.1, 55.1], // Germany
  NL: [3.3, 50.7, 7.2, 53.6], // Netherlands
  BE: [2.5, 49.4, 6.4, 51.5], // Belgium
  LU: [5.7, 49.4, 6.6, 50.2], // Luxembourg
  CH: [5.9, 45.8, 10.5, 47.9], // Switzerland
  AT: [9.5, 46.3, 17.2, 49.1], // Austria
  IT: [6.6, 35.4, 18.6, 47.1], // Italy
  ES: [-9.3, 35.1, 4.4, 43.8], // Spain
  PT: [-9.5, 36.9, -6.2, 42.2], // Portugal
  GR: [19.6, 34.8, 28.3, 41.8], // Greece
  MT: [14.1, 35.8, 14.6, 36.1], // Malta
  CY: [32.2, 34.6, 34.6, 35.7], // Cyprus
  IS: [-24.6, 63.3, -13.5, 66.6], // Iceland
  MC: [7.3, 43.7, 7.5, 43.8], // Monaco
  SE: [11.1, 55.3, 24.2, 69.1], // Sweden
  NO: [4.6, 57.9, 31.1, 71.2], // Norway
  DK: [8, 54.5, 15.2, 57.8], // Denmark
  FI: [20.6, 59.8, 31.6, 70.1], // Finland
  EE: [21.8, 57.5, 28.2, 59.7], // Estonia
  LV: [20.9, 55.6, 28.3, 58.1], // Latvia
  LT: [20.9, 53.8, 26.9, 56.5], // Lithuania
  PL: [14.1, 48.9, 24.2, 54.9], // Poland
  CZ: [12, 48.5, 18.9, 51.1], // Czechia
  SK: [16.8, 47.7, 22.6, 49.7], // Slovakia
  HU: [16, 45.7, 22.9, 48.6], // Hungary
  RO: [20.2, 43.6, 29.7, 48.3], // Romania
  BG: [22.3, 41.2, 28.7, 44.3], // Bulgaria
  HR: [13.5, 42.4, 19.5, 46.6], // Croatia
  SI: [13.3, 45.4, 16.6, 46.9], // Slovenia
  RS: [18.8, 42.2, 23, 46.2], // Serbia
  BA: [15.7, 42.5, 19.7, 45.3], // Bosnia and Herzegovina
  AL: [19.2, 39.6, 21.1, 42.7], // Albania
  ME: [18.4, 41.8, 20.4, 43.6], // Montenegro
  MK: [20.4, 40.8, 23.1, 42.4], // North Macedonia
  UA: [22.1, 45.2, 40.2, 52.4], // Ukraine
  US: [-124.8, 24.5, -66.8, 49.4], // United States
  CA: [-141.1, 41.6, -52.6, 83.2], // Canada
  MX: [-117.3, 14.5, -86.7, 32.8], // Mexico
  CR: [-86, 8, -82.5, 11.3], // Costa Rica
  PA: [-83.1, 7.2, -77.1, 9.7], // Panama
  GT: [-92.3, 13.7, -88.2, 17.9], // Guatemala
  CU: [-85, 19.8, -74.1, 23.3], // Cuba
  JM: [-78.4, 17.7, -76.1, 18.6], // Jamaica
  DO: [-72.1, 17.5, -68.3, 20], // Dominican Republic
  BS: [-79.6, 20.9, -72.7, 27], // Bahamas
  BR: [-74.1, -33.8, -34.7, 5.3], // Brazil
  AR: [-73.6, -55.1, -53.6, -21.7], // Argentina
  CL: [-75.8, -56, -66.4, -17.5], // Chile
  PE: [-81.4, -18.4, -68.6, 0], // Peru
  CO: [-79.1, -4.3, -66.8, 12.5], // Colombia
  EC: [-81.1, -5.1, -75.2, 1.5], // Ecuador
  UY: [-58.5, -35, -53.1, -30], // Uruguay
  BO: [-69.7, -22.9, -57.4, -9.6], // Bolivia
  ZA: [16.4, -34.9, 32.9, -22.1], // South Africa
  EG: [24.6, 21.9, 36.9, 31.7], // Egypt
  MA: [-13.2, 27.6, -1, 36], // Morocco
  KE: [33.8, -4.7, 41.9, 5.1], // Kenya
  TZ: [29.3, -11.8, 40.5, -0.9], // Tanzania
  NG: [2.6, 4.2, 14.7, 13.9], // Nigeria
  GH: [-3.3, 4.7, 1.2, 11.2], // Ghana
  ET: [32.9, 3.4, 48, 14.9], // Ethiopia
  TN: [7.4, 30.2, 11.6, 37.4], // Tunisia
  MU: [57.3, -20.6, 57.8, -19.9], // Mauritius
  SC: [52.7, -7.2, 56.3, -3.7], // Seychelles
  NA: [11.7, -29, 25.3, -16.9], // Namibia
  RW: [28.8, -2.9, 30.9, -1], // Rwanda
  AU: [112.9, -43.7, 153.7, -9.2], // Australia
  NZ: [166.4, -48.1, 178.6, -34.3], // New Zealand
  FJ: [177, -20.7, 180, -16.1], // Fiji
  PG: [140.8, -11.7, 156, -1.3], // Papua New Guinea
};

export function countryBounds(code?: string): Bounds | undefined {
  if (!code) return undefined;
  return BOUNDS[code.toUpperCase()];
}
