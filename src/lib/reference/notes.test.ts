import { describe, expect, it } from "vitest";
import { localProvider, VISA_OUTCOME_LABELS } from "./entry-requirements";
import { healthAdvisory } from "./health";

/*
 * Reference text the Checks screen quotes word for word. Only the punctuation
 * changed: a dash between an observation and what to do about it is now a
 * full stop, so each note is whole sentences.
 */
describe("reference notes quoted in Checks", () => {
  it("give health advice as whole sentences", () => {
    expect(healthAdvisory("TH")?.notes).toContain(
      "Dengue is mosquito-borne and there is no vaccine for most travellers. Repellent matters more than pills.",
    );
    expect(healthAdvisory("IN")?.notes).toEqual([
      "Malaria risk varies sharply by region and season. Check your specific destinations.",
    ]);
    expect(healthAdvisory("NP")?.notes).toEqual([
      "Altitude sickness is the main risk above 2,500 m. Plan an acclimatisation schedule.",
    ]);
  });

  it("give entry notes and visa labels without a dash", () => {
    expect(localProvider.lookup("IN", "TH").notes).toBe(
      "Exemption scheme has changed repeatedly. Reconfirm close to travel.",
    );
    expect(VISA_OUTCOME_LABELS.unknown).toBe("Not in dataset: check yourself");
    for (const label of Object.values(VISA_OUTCOME_LABELS)) expect(label).not.toContain("—");
  });
});
