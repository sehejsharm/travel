export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  plugTypes: string[];
  voltage: number;
  /** Standard-time UTC offset in hours. Ignores daylight saving. */
  utcOffset: number;
  emergency: string;
  cashPreference: "cash-heavy" | "mixed" | "card-friendly";
  tipping: string;
}

type Row = [
  code: string,
  name: string,
  currency: string,
  plugs: string,
  voltage: number,
  offset: number,
  emergency: string,
  cash: CountryInfo["cashPreference"],
  tipping: string,
];

// Shared tipping notes, since most countries fall into a handful of cultures.
const NO_TIP = "Not expected — staff are paid a full wage";
const ROUND_UP = "Round up the bill; 5–10% for good service";
const EU_SERVICE = "Service is usually included; round up for good service";
const TEN = "10% at restaurants unless service is already added";
const US_STYLE = "18–22% expected at sit-down restaurants";

const ROWS: Row[] = [
  // ---- South and Central Asia ----
  ["IN", "India", "INR", "C,D,M", 230, 5.5, "112", "mixed", "10% at restaurants; UPI is accepted almost everywhere"],
  ["PK", "Pakistan", "PKR", "C,D", 230, 5, "15", "cash-heavy", TEN],
  ["BD", "Bangladesh", "BDT", "C,D,G", 220, 6, "999", "cash-heavy", TEN],
  ["LK", "Sri Lanka", "LKR", "D,G,M", 230, 5.5, "119", "cash-heavy", TEN],
  ["NP", "Nepal", "NPR", "C,D,M", 230, 5.75, "100 police / 102 ambulance", "cash-heavy", "10%; guides and porters expect more"],
  ["MV", "Maldives", "MVR", "D,G", 230, 5, "102", "card-friendly", "10% service charge is standard"],
  ["BT", "Bhutan", "BTN", "C,D,G", 230, 6, "112", "cash-heavy", ROUND_UP],
  ["KZ", "Kazakhstan", "KZT", "C,F", 220, 6, "112", "mixed", TEN],
  ["UZ", "Uzbekistan", "UZS", "C,F", 220, 5, "112", "cash-heavy", TEN],

  // ---- East Asia ----
  ["JP", "Japan", "JPY", "A,B", 100, 9, "110 police / 119 fire and ambulance", "cash-heavy", "No tipping — it can cause offence"],
  ["KR", "South Korea", "KRW", "C,F", 220, 9, "112 police / 119 ambulance", "card-friendly", NO_TIP],
  ["CN", "China", "CNY", "A,C,I", 220, 8, "110 police / 120 ambulance", "mixed", "Not customary; mobile payment is everywhere"],
  ["HK", "Hong Kong", "HKD", "G", 220, 8, "999", "card-friendly", "10% service charge is usual"],
  ["TW", "Taiwan", "TWD", "A,B", 110, 8, "110 police / 119 ambulance", "mixed", NO_TIP],
  ["MO", "Macau", "MOP", "G", 220, 8, "999", "card-friendly", "Round up"],
  ["MN", "Mongolia", "MNT", "C,E", 230, 8, "102 police / 103 ambulance", "cash-heavy", ROUND_UP],

  // ---- South East Asia ----
  ["TH", "Thailand", "THB", "A,B,C,O", 230, 7, "191 police / 1669 ambulance", "cash-heavy", "Round up the bill; not expected but appreciated"],
  ["VN", "Vietnam", "VND", "A,C,D", 220, 7, "113 police / 115 ambulance", "cash-heavy", "Not customary outside tourist areas"],
  ["ID", "Indonesia", "IDR", "C,F", 230, 7, "112 (110 police)", "cash-heavy", ROUND_UP],
  ["MY", "Malaysia", "MYR", "G", 240, 8, "999", "mixed", "Service charge is usually added"],
  ["SG", "Singapore", "SGD", "G", 230, 8, "999 police / 995 ambulance", "card-friendly", "Not expected; service charge included"],
  ["PH", "Philippines", "PHP", "A,B,C", 220, 8, "911", "cash-heavy", TEN],
  ["KH", "Cambodia", "KHR", "A,C,G", 230, 7, "117 police / 119 ambulance", "cash-heavy", ROUND_UP],
  ["LA", "Laos", "LAK", "A,B,C,E,F", 230, 7, "191 police / 195 ambulance", "cash-heavy", ROUND_UP],
  ["MM", "Myanmar", "MMK", "C,D,F,G", 230, 6.5, "199", "cash-heavy", ROUND_UP],
  ["BN", "Brunei", "BND", "G", 240, 8, "993 police / 991 ambulance", "card-friendly", NO_TIP],

  // ---- Middle East ----
  ["AE", "United Arab Emirates", "AED", "C,D,G", 230, 4, "999 police / 998 ambulance", "card-friendly", "10–15% where no service charge"],
  ["SA", "Saudi Arabia", "SAR", "G", 230, 3, "999 police / 997 ambulance", "card-friendly", TEN],
  ["QA", "Qatar", "QAR", "G", 240, 3, "999", "card-friendly", TEN],
  ["OM", "Oman", "OMR", "G", 240, 4, "9999", "mixed", TEN],
  ["BH", "Bahrain", "BHD", "G", 230, 3, "999", "card-friendly", TEN],
  ["KW", "Kuwait", "KWD", "G", 240, 3, "112", "card-friendly", TEN],
  ["JO", "Jordan", "JOD", "B,C,D,F,G,J", 230, 3, "911", "cash-heavy", TEN],
  ["IL", "Israel", "ILS", "C,H,M", 230, 2, "100 police / 101 ambulance", "card-friendly", "12–15% at restaurants"],
  ["TR", "Türkiye", "TRY", "C,F", 230, 3, "112", "mixed", TEN],
  ["GE", "Georgia", "GEL", "C,F", 220, 4, "112", "mixed", TEN],
  ["AM", "Armenia", "AMD", "C,F", 230, 4, "911", "cash-heavy", TEN],
  ["AZ", "Azerbaijan", "AZN", "C,F", 220, 4, "112", "cash-heavy", TEN],

  // ---- Western Europe ----
  ["GB", "United Kingdom", "GBP", "G", 230, 0, "999 (112 also works)", "card-friendly", "10–12.5% unless service is included"],
  ["IE", "Ireland", "EUR", "G", 230, 0, "112 or 999", "card-friendly", TEN],
  ["FR", "France", "EUR", "C,E", 230, 1, "112", "card-friendly", EU_SERVICE],
  ["DE", "Germany", "EUR", "C,F", 230, 1, "112", "mixed", "Round up to the nearest euro or two"],
  ["NL", "Netherlands", "EUR", "C,F", 230, 1, "112", "card-friendly", EU_SERVICE],
  ["BE", "Belgium", "EUR", "C,E", 230, 1, "112", "card-friendly", EU_SERVICE],
  ["LU", "Luxembourg", "EUR", "C,F", 230, 1, "112", "card-friendly", EU_SERVICE],
  ["CH", "Switzerland", "CHF", "C,J", 230, 1, "112 (117 police)", "card-friendly", EU_SERVICE],
  ["AT", "Austria", "EUR", "C,F", 230, 1, "112", "mixed", "Round up 5–10%"],
  ["IT", "Italy", "EUR", "C,F,L", 230, 1, "112", "mixed", "Coperto is charged per person; tipping beyond it is optional"],
  ["ES", "Spain", "EUR", "C,F", 230, 1, "112", "card-friendly", "Small change is plenty"],
  ["PT", "Portugal", "EUR", "C,F", 230, 0, "112", "mixed", ROUND_UP],
  ["GR", "Greece", "EUR", "C,F", 230, 2, "112", "mixed", ROUND_UP],
  ["MT", "Malta", "EUR", "G", 230, 1, "112", "card-friendly", TEN],
  ["CY", "Cyprus", "EUR", "G", 240, 2, "112", "card-friendly", TEN],
  ["IS", "Iceland", "ISK", "C,F", 230, 0, "112", "card-friendly", NO_TIP],
  ["MC", "Monaco", "EUR", "C,E,F", 230, 1, "112", "card-friendly", EU_SERVICE],

  // ---- Nordics and Baltics ----
  ["SE", "Sweden", "SEK", "C,F", 230, 1, "112", "card-friendly", NO_TIP],
  ["NO", "Norway", "NOK", "C,F", 230, 1, "112 police / 113 ambulance", "card-friendly", NO_TIP],
  ["DK", "Denmark", "DKK", "C,E,F,K", 230, 1, "112", "card-friendly", NO_TIP],
  ["FI", "Finland", "EUR", "C,F", 230, 2, "112", "card-friendly", NO_TIP],
  ["EE", "Estonia", "EUR", "C,F", 230, 2, "112", "card-friendly", ROUND_UP],
  ["LV", "Latvia", "EUR", "C,F", 230, 2, "112", "card-friendly", ROUND_UP],
  ["LT", "Lithuania", "EUR", "C,F", 230, 2, "112", "card-friendly", ROUND_UP],

  // ---- Central and Eastern Europe ----
  ["PL", "Poland", "PLN", "C,E", 230, 1, "112", "card-friendly", TEN],
  ["CZ", "Czechia", "CZK", "C,E", 230, 1, "112", "card-friendly", TEN],
  ["SK", "Slovakia", "EUR", "C,E", 230, 1, "112", "card-friendly", TEN],
  ["HU", "Hungary", "HUF", "C,F", 230, 1, "112", "mixed", TEN],
  ["RO", "Romania", "RON", "C,F", 230, 2, "112", "mixed", TEN],
  ["BG", "Bulgaria", "BGN", "C,F", 230, 2, "112", "mixed", TEN],
  ["HR", "Croatia", "EUR", "C,F", 230, 1, "112", "mixed", TEN],
  ["SI", "Slovenia", "EUR", "C,F", 230, 1, "112", "card-friendly", ROUND_UP],
  ["RS", "Serbia", "RSD", "C,F", 230, 1, "192 police / 194 ambulance", "cash-heavy", TEN],
  ["BA", "Bosnia and Herzegovina", "BAM", "C,F", 230, 1, "122 police / 124 ambulance", "cash-heavy", TEN],
  ["AL", "Albania", "ALL", "C,F", 230, 1, "112", "cash-heavy", TEN],
  ["ME", "Montenegro", "EUR", "C,F", 230, 1, "112", "cash-heavy", TEN],
  ["MK", "North Macedonia", "MKD", "C,F", 230, 1, "112", "cash-heavy", TEN],
  ["UA", "Ukraine", "UAH", "C,F", 230, 2, "112", "cash-heavy", TEN],

  // ---- North America ----
  ["US", "United States", "USD", "A,B", 120, -5, "911", "card-friendly", US_STYLE],
  ["CA", "Canada", "CAD", "A,B", 120, -5, "911", "card-friendly", "15–20% at restaurants"],
  ["MX", "Mexico", "MXN", "A,B", 127, -6, "911", "mixed", "10–15% at restaurants"],
  ["CR", "Costa Rica", "CRC", "A,B", 120, -6, "911", "mixed", "10% service is usually included"],
  ["PA", "Panama", "PAB", "A,B", 120, -5, "911", "card-friendly", TEN],
  ["GT", "Guatemala", "GTQ", "A,B", 120, -6, "110 police / 122 fire", "cash-heavy", TEN],
  ["CU", "Cuba", "CUP", "A,B,C,L", 110, -5, "106 police / 104 ambulance", "cash-heavy", TEN],
  ["JM", "Jamaica", "JMD", "A,B", 110, -5, "119 police / 110 ambulance", "mixed", TEN],
  ["DO", "Dominican Republic", "DOP", "A,B", 110, -4, "911", "mixed", "10% service is usually added"],
  ["BS", "Bahamas", "BSD", "A,B", 120, -5, "911", "card-friendly", "15% is usual"],

  // ---- South America ----
  ["BR", "Brazil", "BRL", "C,N", 127, -3, "190 police / 192 ambulance", "card-friendly", "10% service is usually added"],
  ["AR", "Argentina", "ARS", "C,I", 220, -3, "911", "cash-heavy", TEN],
  ["CL", "Chile", "CLP", "C,L", 220, -4, "133 police / 131 ambulance", "card-friendly", TEN],
  ["PE", "Peru", "PEN", "A,B,C", 220, -5, "105 police / 116 fire", "mixed", TEN],
  ["CO", "Colombia", "COP", "A,B", 110, -5, "123", "mixed", "10% is usually added as voluntary"],
  ["EC", "Ecuador", "USD", "A,B", 120, -5, "911", "mixed", TEN],
  ["UY", "Uruguay", "UYU", "C,F,L", 220, -3, "911", "card-friendly", TEN],
  ["BO", "Bolivia", "BOB", "A,C", 230, -4, "110 police / 118 ambulance", "cash-heavy", TEN],

  // ---- Africa ----
  ["ZA", "South Africa", "ZAR", "C,D,M,N", 230, 2, "10111 police / 10177 ambulance", "card-friendly", "10–15% at restaurants"],
  ["EG", "Egypt", "EGP", "C,F", 220, 2, "122 police / 123 ambulance", "cash-heavy", "10% plus small tips throughout"],
  ["MA", "Morocco", "MAD", "C,E", 220, 1, "19 police / 15 ambulance", "cash-heavy", TEN],
  ["KE", "Kenya", "KES", "G", 240, 3, "999 or 112", "mixed", TEN],
  ["TZ", "Tanzania", "TZS", "D,G", 230, 3, "112", "cash-heavy", TEN],
  ["NG", "Nigeria", "NGN", "D,G", 240, 1, "112", "cash-heavy", TEN],
  ["GH", "Ghana", "GHS", "D,G", 230, 0, "112", "cash-heavy", TEN],
  ["ET", "Ethiopia", "ETB", "C,F,L", 220, 3, "911", "cash-heavy", TEN],
  ["TN", "Tunisia", "TND", "C,E", 230, 1, "197 police / 190 ambulance", "cash-heavy", TEN],
  ["MU", "Mauritius", "MUR", "C,G", 230, 4, "999 police / 114 ambulance", "card-friendly", TEN],
  ["SC", "Seychelles", "SCR", "G", 240, 4, "999", "card-friendly", TEN],
  ["NA", "Namibia", "NAD", "D,M,N", 220, 2, "10111", "mixed", TEN],
  ["RW", "Rwanda", "RWF", "C,J", 230, 2, "112", "mixed", TEN],

  // ---- Oceania ----
  ["AU", "Australia", "AUD", "I", 230, 10, "000", "card-friendly", NO_TIP],
  ["NZ", "New Zealand", "NZD", "I", 230, 12, "111", "card-friendly", NO_TIP],
  ["FJ", "Fiji", "FJD", "I", 240, 12, "911", "mixed", NO_TIP],
  ["PG", "Papua New Guinea", "PGK", "I", 240, 10, "112", "cash-heavy", NO_TIP],
];

function build(rows: Row[]): Record<string, CountryInfo> {
  const table: Record<string, CountryInfo> = {};

  for (const [code, name, currency, plugs, voltage, utcOffset, emergency, cashPreference, tipping] of rows) {
    table[code] = {
      code,
      name,
      currency,
      plugTypes: plugs.split(","),
      voltage,
      utcOffset,
      emergency,
      cashPreference,
      tipping,
    };
  }

  return table;
}

export const COUNTRIES = build(ROWS);

export function getCountry(code?: string): CountryInfo | undefined {
  if (!code) return undefined;
  return COUNTRIES[code.toUpperCase()];
}

/** Sorted for pickers. */
export const COUNTRY_LIST: CountryInfo[] = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);
