import { describe, expect, it } from "vitest";
import type { AppState } from "./state";
import { backupFilename, buildBackup, parseBackup, BACKUP_VERSION } from "./backup";

function state(patch: Partial<AppState> = {}): AppState {
  return {
    trips: [
      {
        id: "t1",
        name: "Japan",
        homeCountry: "IN",
        destinationCountries: ["JP"],
        startDate: "2026-10-14",
        endDate: "2026-10-22",
        travelers: [],
      },
    ],
    activeTripId: "t1",
    items: [],
    checklist: [],
    advice: [],
    ...patch,
  };
}

describe("backup", () => {
  it("round-trips a state through JSON", () => {
    const backup = buildBackup(state());
    const parsed = parseBackup(JSON.stringify(backup));

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.state.trips[0].name).toBe("Japan");
    expect(parsed.version).toBe(BACKUP_VERSION);
  });

  it("names the file by the day it was taken", () => {
    expect(backupFilename(new Date("2026-09-16T12:00:00Z"))).toBe("manifest-backup-2026-09-16.json");
  });

  it("refuses something that is not JSON", () => {
    expect(parseBackup("not json")).toEqual({ error: "That file is not JSON." });
  });

  it("refuses a JSON file that is not a Manifest backup", () => {
    expect(parseBackup('{"hello":"world"}')).toMatchObject({
      error: "That file is not a Manifest backup.",
    });
  });

  it("refuses a backup from a newer version rather than guessing at it", () => {
    const future = JSON.stringify({ ...buildBackup(state()), version: BACKUP_VERSION + 1 });
    expect(parseBackup(future)).toMatchObject({ error: expect.stringContaining("newer version") });
  });

  it("refuses a backup with no trips in it", () => {
    const broken = JSON.stringify({ format: "manifest.backup", version: 1, state: {} });
    expect(parseBackup(broken)).toMatchObject({ error: expect.stringContaining("missing its trips") });
  });

  it("fills in lists an older backup did not carry", () => {
    const old = JSON.stringify({
      format: "manifest.backup",
      version: 1,
      state: { trips: state().trips, items: [] },
    });
    const parsed = parseBackup(old);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.state.checklist).toEqual([]);
    expect(parsed.state.advice).toEqual([]);
    expect(parsed.state.activeTripId).toBe("t1");
  });
});
