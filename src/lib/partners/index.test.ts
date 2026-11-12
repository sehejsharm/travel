import { describe, expect, it } from "vitest";
import type { Trip } from "../domain/types";
import { offersFor } from ".";

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Test trip",
    homeCountry: "IN",
    destinationCountries: ["JP"],
    startDate: "2026-10-14",
    endDate: "2026-10-22",
    travelers: [],
    ...patch,
  };
}

const offer = (current: Trip, id: string) =>
  offersFor(current, []).find((candidate) => candidate.id === id)!;

describe("the power offers say what the trip's sockets actually are", () => {
  it("names the destination's voltage in the title, not a fixed 240V", () => {
    // India is 230V and Japan 100V: the charger has to cope with 100V.
    expect(offer(trip(), "voltage").title).toBe("Check your chargers take 100V");
    // The other way round, the charger has to cope with 230V.
    expect(offer(trip({ homeCountry: "US", destinationCountries: ["GB"] }), "voltage").title).toBe(
      "Check your chargers take 230V",
    );
  });

  it("agrees the verb with the number of countries and writes Type the way the checks do", () => {
    expect(offer(trip(), "adapter").why).toBe("Japan uses Type A, B; home is Type C, D, M.");
    expect(offer(trip({ destinationCountries: ["JP", "GB"] }), "adapter").why).toBe(
      "Japan and United Kingdom use Type A, B, G; home is Type C, D, M.",
    );
  });
});
