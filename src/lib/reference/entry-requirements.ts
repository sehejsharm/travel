/**
 * Entry requirements are the one area where being wrong has real consequences
 * for the traveler, so this module is an interface with a small local dataset
 * behind it. Production is expected to swap `localProvider` for a licensed feed
 * (Sherpa, Timatic) without any caller changing — hence every result carries a
 * `lastVerified` date and a `source` the UI is required to surface.
 */

export type VisaOutcome =
  | "visa-free"
  | "visa-on-arrival"
  | "e-visa"
  | "visa-required"
  | "unknown";

export interface EntryRequirement {
  outcome: VisaOutcome;
  /** Days permitted without a visa, when the outcome allows any. */
  maxStayDays?: number;
  /** Months of passport validity required beyond the date of entry or exit. */
  passportValidityMonths: number;
  /** Travel authorisation that is not a visa but is still mandatory (ETA, ESTA). */
  authorisation?: string;
  notes?: string;
  lastVerified: string;
  source: string;
}

export interface EntryRequirementsProvider {
  lookup(passportCountry: string, destinationCountry: string): EntryRequirement;
}

const LAST_VERIFIED = "2026-08-01";
const SOURCE = "Bundled reference dataset (replace with licensed provider)";

/** Keyed `${passport}->${destination}`. */
const MATRIX: Record<string, Omit<EntryRequirement, "lastVerified" | "source">> = {
  "IN->JP": {
    outcome: "visa-required",
    passportValidityMonths: 0,
    notes: "Apply at a Japanese consulate or an authorised agency before travel.",
  },
  "IN->TH": {
    outcome: "visa-free",
    maxStayDays: 60,
    passportValidityMonths: 6,
    notes: "Exemption scheme has changed repeatedly — reconfirm close to travel.",
  },
  "IN->AE": {
    outcome: "e-visa",
    passportValidityMonths: 6,
    notes: "Often arranged by the airline or hotel; check which applies to you.",
  },
  "IN->SG": {
    outcome: "visa-required",
    passportValidityMonths: 6,
    authorisation: "SG Arrival Card within 3 days of arrival",
  },
  "IN->ID": {
    outcome: "visa-on-arrival",
    maxStayDays: 30,
    passportValidityMonths: 6,
  },
  "IN->NP": {
    outcome: "visa-free",
    passportValidityMonths: 6,
    notes: "Indian nationals may enter on a voter ID or passport.",
  },
  "IN->GB": {
    outcome: "visa-required",
    passportValidityMonths: 0,
  },
  "IN->US": {
    outcome: "visa-required",
    passportValidityMonths: 6,
  },
  "US->JP": {
    outcome: "visa-free",
    maxStayDays: 90,
    passportValidityMonths: 0,
  },
  "US->GB": {
    outcome: "visa-free",
    maxStayDays: 180,
    passportValidityMonths: 0,
    authorisation: "UK ETA required before travel",
  },
  "US->IN": {
    outcome: "e-visa",
    passportValidityMonths: 6,
  },
  "GB->JP": {
    outcome: "visa-free",
    maxStayDays: 90,
    passportValidityMonths: 0,
  },
  "GB->TH": {
    outcome: "visa-free",
    maxStayDays: 60,
    passportValidityMonths: 6,
  },
};

export const localProvider: EntryRequirementsProvider = {
  lookup(passportCountry, destinationCountry) {
    const key = `${passportCountry.toUpperCase()}->${destinationCountry.toUpperCase()}`;
    const hit = MATRIX[key];

    if (!hit) {
      return {
        outcome: "unknown",
        // Six months is the most common requirement, so it is the safe default
        // to warn against when the pair is not in the dataset.
        passportValidityMonths: 6,
        notes: "This passport and destination pair is not in the bundled dataset.",
        lastVerified: LAST_VERIFIED,
        source: SOURCE,
      };
    }

    return { ...hit, lastVerified: LAST_VERIFIED, source: SOURCE };
  },
};

export const VISA_OUTCOME_LABELS: Record<VisaOutcome, string> = {
  "visa-free": "No visa needed",
  "visa-on-arrival": "Visa on arrival",
  "e-visa": "e-Visa required",
  "visa-required": "Visa required in advance",
  unknown: "Not in dataset — check yourself",
};
