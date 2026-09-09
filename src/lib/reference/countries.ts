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

export const COUNTRIES: Record<string, CountryInfo> = {
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    plugTypes: ["C", "D", "M"],
    voltage: 230,
    utcOffset: 5.5,
    emergency: "112",
    cashPreference: "mixed",
    tipping: "10% at restaurants; UPI is accepted almost everywhere",
  },
  JP: {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    plugTypes: ["A", "B"],
    voltage: 100,
    utcOffset: 9,
    emergency: "110 police / 119 fire and ambulance",
    cashPreference: "cash-heavy",
    tipping: "No tipping — it can cause offence",
  },
  TH: {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    plugTypes: ["A", "B", "C", "O"],
    voltage: 230,
    utcOffset: 7,
    emergency: "191 police / 1669 ambulance",
    cashPreference: "cash-heavy",
    tipping: "Round up the bill; not expected but appreciated",
  },
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    plugTypes: ["C", "D", "G"],
    voltage: 230,
    utcOffset: 4,
    emergency: "999 police / 998 ambulance",
    cashPreference: "card-friendly",
    tipping: "10–15% where service charge is not already added",
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    plugTypes: ["G"],
    voltage: 230,
    utcOffset: 8,
    emergency: "999 police / 995 ambulance",
    cashPreference: "card-friendly",
    tipping: "Not expected; service charge is usually included",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    plugTypes: ["G"],
    voltage: 230,
    utcOffset: 0,
    emergency: "999 (112 also works)",
    cashPreference: "card-friendly",
    tipping: "10–12.5% at restaurants unless service is included",
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    plugTypes: ["A", "B"],
    voltage: 120,
    utcOffset: -5,
    emergency: "911",
    cashPreference: "card-friendly",
    tipping: "18–22% expected at sit-down restaurants",
  },
  FR: {
    code: "FR",
    name: "France",
    currency: "EUR",
    plugTypes: ["C", "E"],
    voltage: 230,
    utcOffset: 1,
    emergency: "112",
    cashPreference: "card-friendly",
    tipping: "Service is included; round up for good service",
  },
  IT: {
    code: "IT",
    name: "Italy",
    currency: "EUR",
    plugTypes: ["C", "F", "L"],
    voltage: 230,
    utcOffset: 1,
    emergency: "112",
    cashPreference: "mixed",
    tipping: "Coperto is charged per person; tipping beyond it is optional",
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    plugTypes: ["C", "F"],
    voltage: 230,
    utcOffset: 7,
    emergency: "112 (110 police)",
    cashPreference: "cash-heavy",
    tipping: "Round up; 5–10% at tourist restaurants",
  },
  VN: {
    code: "VN",
    name: "Vietnam",
    currency: "VND",
    plugTypes: ["A", "C", "D"],
    voltage: 220,
    utcOffset: 7,
    emergency: "113 police / 115 ambulance",
    cashPreference: "cash-heavy",
    tipping: "Not customary outside tourist areas",
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    plugTypes: ["I"],
    voltage: 230,
    utcOffset: 10,
    emergency: "000",
    cashPreference: "card-friendly",
    tipping: "Not expected; staff are paid a full wage",
  },
  NP: {
    code: "NP",
    name: "Nepal",
    currency: "NPR",
    plugTypes: ["C", "D", "M"],
    voltage: 230,
    utcOffset: 5.75,
    emergency: "100 police / 102 ambulance",
    cashPreference: "cash-heavy",
    tipping: "10% at restaurants; guides and porters expect more",
  },
  ES: {
    code: "ES",
    name: "Spain",
    currency: "EUR",
    plugTypes: ["C", "F"],
    voltage: 230,
    utcOffset: 1,
    emergency: "112",
    cashPreference: "card-friendly",
    tipping: "Small change is plenty; not obligatory",
  },
};

export function getCountry(code?: string): CountryInfo | undefined {
  if (!code) return undefined;
  return COUNTRIES[code.toUpperCase()];
}
