/**
 * Health advisories per destination. Like entry requirements, this is the kind
 * of data that has to come from an authoritative feed (WHO, CDC, NaTHNaC) in
 * production — every flag built on it points the traveller at a travel clinic.
 */
export interface HealthAdvisory {
  /** Vaccinations commonly recommended for this destination. */
  recommended: string[];
  /** Conditions under which proof of yellow fever vaccination is demanded. */
  yellowFeverIfArrivingFrom: boolean;
  /** Non-vaccine advisories worth surfacing before departure. */
  notes: string[];
  lastVerified: string;
}

const LAST_VERIFIED = "2026-08-01";

const ADVISORIES: Record<string, Omit<HealthAdvisory, "lastVerified">> = {
  JP: {
    recommended: ["Routine vaccinations up to date"],
    yellowFeverIfArrivingFrom: false,
    notes: [],
  },
  TH: {
    recommended: ["Hepatitis A", "Typhoid", "Tetanus booster"],
    yellowFeverIfArrivingFrom: true,
    notes: [
      "Dengue is mosquito-borne and there is no vaccine for most travellers — repellent matters more than pills.",
      "Rabies risk from dogs and monkeys; consider pre-exposure shots for longer or rural stays.",
    ],
  },
  IN: {
    recommended: ["Hepatitis A", "Typhoid", "Tetanus booster"],
    yellowFeverIfArrivingFrom: true,
    notes: ["Malaria risk varies sharply by region and season — check your specific destinations."],
  },
  ID: {
    recommended: ["Hepatitis A", "Typhoid"],
    yellowFeverIfArrivingFrom: true,
    notes: ["Rabies is present; avoid contact with monkeys and stray dogs."],
  },
  VN: {
    recommended: ["Hepatitis A", "Typhoid"],
    yellowFeverIfArrivingFrom: true,
    notes: ["Japanese encephalitis is worth discussing for rural or long stays."],
  },
  NP: {
    recommended: ["Hepatitis A", "Typhoid"],
    yellowFeverIfArrivingFrom: true,
    notes: ["Altitude sickness is the main risk above 2,500 m — plan an acclimatisation schedule."],
  },
  SG: {
    recommended: ["Routine vaccinations up to date"],
    yellowFeverIfArrivingFrom: true,
    notes: [],
  },
  AE: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  GB: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  US: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  FR: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  IT: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  ES: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
  AU: { recommended: ["Routine vaccinations up to date"], yellowFeverIfArrivingFrom: false, notes: [] },
};

export function healthAdvisory(countryCode: string): HealthAdvisory | undefined {
  const advisory = ADVISORIES[countryCode.toUpperCase()];
  if (!advisory) return undefined;
  return { ...advisory, lastVerified: LAST_VERIFIED };
}
