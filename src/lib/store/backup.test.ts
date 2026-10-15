import { describe, expect, it } from "vitest";
import type { AppState } from "./state";
import { sampleState } from "./state";
import {
  backupFilename,
  backupSizeError,
  buildBackup,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  type Backup,
} from "./backup";
import { parseBackup } from "./backup-parse";

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

/** A backup written out, then edited by hand the way someone would in a text editor. */
function edited(change: (file: Backup & Record<string, unknown>) => void, from: AppState = state()): string {
  const file = JSON.parse(JSON.stringify(buildBackup(from)));
  change(file);
  return JSON.stringify(file);
}

function errorOf(result: ReturnType<typeof parseBackup>): string {
  if (!("error" in result)) throw new Error("expected the backup to be refused");
  return result.error;
}

/** Every optional field filled in, so the shape check is held to everything the app can write. */
function everything(): AppState {
  return state({
    trips: [
      {
        id: "t1",
        name: "Japan & Thailand",
        homeCountry: "IN",
        destinationCountries: ["JP", "TH"],
        startDate: "2026-10-14",
        endDate: "2026-10-28",
        datesTbd: false,
        budgetTarget: { amount: 250000, currency: "INR" },
        purpose: "family",
        interests: ["food", "history"],
        dismissedPrompts: ["budget"],
        accentHue: 198,
        legs: [
          { id: "l1", countryCode: "JP", city: "Tokyo", startDate: "2026-10-14", endDate: "2026-10-21" },
          { id: "l2", countryCode: "TH", startDate: "2026-10-21", endDate: "2026-10-28" },
        ],
        travelers: [
          {
            id: "p1",
            name: "Asha",
            passportCountry: "IN",
            passportExpiry: "2030-01-01",
            insuranceFrom: "2026-10-14",
            insuranceTo: "2026-10-28",
            originCountry: "DE",
            needsVisaHelp: true,
          },
        ],
      },
    ],
    items: [
      {
        id: "i1",
        tripId: "t1",
        title: "AI 306 DEL → NRT",
        category: "booking",
        bookingKind: "flight",
        source: "gmail",
        sourceRef: "msg-1",
        notes: "Window seat",
        place: { name: "Delhi", city: "Delhi", countryCode: "IN", airport: "DEL", point: { lat: 28.56, lng: 77.1 } },
        arrivalPlace: { name: "Narita", countryCode: "JP", airport: "NRT" },
        startsAt: "2026-10-14T21:00+05:30",
        endsAt: "2026-10-15T08:30+09:00",
        cost: { amount: 52400, currency: "INR" },
        costStatus: "actual",
        confirmationCode: "ABC123",
        travelerName: "Asha",
        refundableUntil: "2026-10-01",
        confidence: 0.9,
        extractionMethod: "llm",
        createdAt: "2026-09-01T10:00:00Z",
        addedBy: "Asha",
      },
    ],
    checklist: [
      {
        id: "c1",
        tripId: "t1",
        kind: "packing",
        label: "Rain jacket",
        detail: "Showers likely",
        generatedFrom: "weather",
        sourceFlagId: "f1",
        assigneeId: "p1",
        done: true,
        createdAt: "2026-09-01T10:00:00Z",
      },
    ],
    advice: [
      {
        tripId: "t1",
        key: "tokyo|food",
        result: {
          destination: "Tokyo",
          countryCode: "JP",
          generatedAt: "2026-09-01T10:00:00Z",
          tiersUsed: ["saved", "web"],
          notes: ["Places was not configured"],
          sections: [
            {
              interestId: "food",
              suggestions: [
                {
                  id: "s1",
                  interestId: "food",
                  name: "Fuunji",
                  why: "Tsukemen worth the queue",
                  place: { name: "Fuunji", city: "Tokyo", countryCode: "JP" },
                  tier: "web",
                  attribution: "example.com",
                  url: "https://example.com",
                  priceHint: "¥1,100",
                },
              ],
            },
          ],
        },
      },
    ],
  });
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
    expect(parseBackup("[1, 2, 3]")).toMatchObject({ error: "That file is not a Manifest backup." });
  });

  it("refuses a version number no Manifest ever wrote", () => {
    for (const version of [0, -1, 0.5, "1"]) {
      const odd = edited((file) => {
        file.version = version as number;
      });
      expect(errorOf(parseBackup(odd))).toBe("That file is not a Manifest backup.");
    }
  });

  it("refuses a backup from a newer version rather than guessing at it", () => {
    const future = JSON.stringify({ ...buildBackup(state()), version: BACKUP_VERSION + 1 });
    expect(parseBackup(future)).toMatchObject({ error: expect.stringContaining("newer version") });
  });

  it("refuses a backup with no trips in it", () => {
    const broken = JSON.stringify({ format: "manifest.backup", version: 1, state: {} });
    expect(parseBackup(broken)).toMatchObject({ error: expect.stringContaining("missing its trips") });
  });

  it("refuses a backup with no filed items in it", () => {
    const broken = edited((file) => {
      delete (file.state as Partial<AppState>).items;
    });
    expect(errorOf(parseBackup(broken))).toBe("That backup is missing its filed items.");
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

describe("backup size", () => {
  it("lets through anything a real backup could be", () => {
    expect(backupSizeError(0)).toBeUndefined();
    expect(backupSizeError(MAX_BACKUP_BYTES)).toBeUndefined();
  });

  it("refuses a file too big to be one, before reading it", () => {
    expect(backupSizeError(24 * 1024 * 1024)).toBe(
      "That file is 24.0 MB, bigger than any Manifest backup can be, so it was not opened.",
    );
  });

  it("refuses text that long without parsing it", () => {
    expect(errorOf(parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)))).toContain("bigger than any Manifest backup");
  });
});

describe("backup records", () => {
  it("accepts every field the app writes", () => {
    const full = everything();
    const parsed = parseBackup(JSON.stringify(buildBackup(full)));

    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.state.trips).toEqual(full.trips);
    expect(parsed.state.items).toEqual(full.items);
    expect(parsed.state.checklist).toEqual(full.checklist);
    expect(parsed.state.advice).toEqual(full.advice);
  });

  it("accepts the sample trip, with its generated checklists", () => {
    const sample = sampleState();
    const parsed = parseBackup(JSON.stringify(buildBackup(sample)));

    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.state.items).toHaveLength(sample.items.length);
    expect(parsed.state.checklist).toHaveLength(sample.checklist.length);
  });

  it("refuses a trip with a field missing, naming the trip and the field", () => {
    const broken = edited((file) => {
      delete (file.state.trips[0] as Partial<AppState["trips"][number]>).endDate;
    });

    expect(errorOf(parseBackup(broken))).toBe(
      "That backup is damaged, so nothing was restored. Trip 1 (“Japan”): end date is missing.",
    );
  });

  it("refuses a field of the wrong type deep inside a trip", () => {
    const broken = edited((file) => {
      (file.state.trips[0].travelers[0] as unknown as Record<string, unknown>).passportExpiry = 20300101;
    }, everything());

    expect(errorOf(parseBackup(broken))).toBe(
      "That backup is damaged, so nothing was restored. Trip 1 (“Japan & Thailand”), traveller 1 (“Asha”): passport expiry should be text.",
    );
  });

  it("refuses a value no list of choices holds", () => {
    const broken = edited((file) => {
      (file.state.items[0] as unknown as Record<string, unknown>).category = "food";
    }, everything());

    expect(errorOf(parseBackup(broken))).toContain(
      "Filed item 1 (“AI 306 DEL → NRT”): category is “food”, which Manifest does not know.",
    );
  });

  it("refuses a record that is not a record at all", () => {
    const broken = edited((file) => {
      (file.state.checklist as unknown[]).push("Passport");
    }, everything());

    expect(errorOf(parseBackup(broken))).toContain("Checklist entry 2 is not in the right shape.");
  });

  it("refuses a list that is not a list", () => {
    const broken = edited((file) => {
      (file.state as unknown as Record<string, unknown>).checklist = { 0: "Passport" };
    });

    expect(errorOf(parseBackup(broken))).toContain("Checklist should be a list.");
  });

  it("refuses an empty id, which would leave the record impossible to edit or delete", () => {
    const broken = edited((file) => {
      file.state.items[0].id = "";
    }, everything());

    expect(errorOf(parseBackup(broken))).toContain("Filed item 1 (“AI 306 DEL → NRT”): id is empty.");
  });

  it("refuses a map point off the globe", () => {
    const broken = edited((file) => {
      file.state.items[0].place!.point!.lat = 128.56;
    }, everything());

    expect(errorOf(parseBackup(broken))).toContain("place › point › lat is out of range.");
  });

  it("checks the saved suggestions as well as the trips", () => {
    const broken = edited((file) => {
      (file.state.advice![0].result.sections[0].suggestions[0] as unknown as Record<string, unknown>).tier = "tarot";
    }, everything());

    expect(errorOf(parseBackup(broken))).toContain(
      "Saved suggestion list 1, section 1, suggestion 1 (“Fuunji”): tier is “tarot”, which Manifest does not know.",
    );
  });

  it("says how many more problems there are after the first", () => {
    const broken = edited((file) => {
      const trip = file.state.trips[0] as unknown as Record<string, unknown>;
      trip.name = 7;
      trip.startDate = null;
      trip.travelers = "Asha";
    });

    expect(errorOf(parseBackup(broken))).toMatch(/Trip 1: name should be text\. There are 2 more problems after that one\.$/);
  });

  it("reads null in an optional field as not set", () => {
    const withNulls = edited((file) => {
      const trip = file.state.trips[0] as unknown as Record<string, unknown>;
      trip.budgetTarget = null;
      trip.legs = null;
      trip.datesTbd = null;
    });
    const parsed = parseBackup(withNulls);

    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.state.trips[0].budgetTarget).toBeUndefined();
    expect(parsed.state.trips[0].legs).toBeUndefined();
    expect(parsed.state.trips[0].datesTbd).toBeUndefined();
  });

  it("keeps fields it does not know, so nothing a later version wrote is lost", () => {
    const newer = edited((file) => {
      (file.state.trips[0] as unknown as Record<string, unknown>).pinnedNote = "Bring yen";
    });
    const parsed = parseBackup(newer);

    if ("error" in parsed) throw new Error(parsed.error);
    expect((parsed.state.trips[0] as unknown as Record<string, unknown>).pinnedNote).toBe("Bring yen");
  });

  it("selects the first trip when the selected one is not in the file", () => {
    const stray = edited((file) => {
      file.state.activeTripId = "t-gone";
    });
    const parsed = parseBackup(stray);

    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.state.activeTripId).toBe("t1");
  });
});
