import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_MANUAL } from "./manual-entry";

/**
 * The unfinished Add form lives in sessionStorage. Loading the module fresh
 * is what the app coming back from another tab, or being reloaded behind the
 * traveller's back, does.
 */

const KEY = "manifest.add-draft.v1";
let storage: Map<string, string>;

function stubStorage(overrides: Partial<Storage> = {}) {
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
      ...overrides,
    },
  });
}

async function fresh() {
  vi.resetModules();
  return import("./add-draft");
}

beforeEach(() => {
  storage = new Map();
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Add screen's unfinished work", () => {
  it("survives the screen going away and coming back", async () => {
    const first = await fresh();
    first.setAddMode("type");
    first.editManual({ kind: "lodging", name: "Hotel Gracery" });
    first.editManual({ confirmationCode: "BK99120" });

    const second = await fresh();
    expect(second.getAddDraft()).toEqual({
      mode: "type",
      text: "",
      manual: { ...EMPTY_MANUAL, kind: "lodging", name: "Hotel Gracery", confirmationCode: "BK99120" },
    });
  });

  it("keeps something shared to be read, ready to read, until it is filed", async () => {
    const first = await fresh();
    first.setAddMode("type");
    first.editManual({ name: "Tea ceremony" });
    first.takeShare("https://www.instagram.com/reel/C9xArashiyama/");

    // The phone reloads the app while the traveller checks the caption.
    const second = await fresh();
    expect(second.getAddDraft()).toMatchObject({
      mode: "drop",
      text: "https://www.instagram.com/reel/C9xArashiyama/",
      manual: { name: "Tea ceremony" },
    });

    // Taken in: the address no longer speaks for the box.
    expect(second.getAddDraft().sharedFrom).toBe("https://www.instagram.com/reel/C9xArashiyama/");

    second.editReadText("");
    expect((await fresh()).getAddDraft().text).toBe("");
  });

  it("clears what was typed but stays on the kind that was picked", async () => {
    const draft = await fresh();
    draft.editManual({ kind: "transit", transitKind: "car", from: "Kyoto" });
    draft.clearManual();

    expect(draft.getAddDraft().manual).toEqual({ ...EMPTY_MANUAL, kind: "transit", transitKind: "car" });
    expect(JSON.parse(storage.get(KEY)!).manual.from).toBe("");
  });

  it("starts clean from anything unreadable", async () => {
    storage.set(KEY, "{not json");
    expect((await fresh()).getAddDraft()).toEqual({ mode: "drop", text: "", manual: EMPTY_MANUAL });

    storage.set(KEY, JSON.stringify({ mode: "sideways", manual: { kind: 7, notes: "kept" } }));
    expect((await fresh()).getAddDraft()).toEqual({
      mode: "drop",
      text: "",
      manual: { ...EMPTY_MANUAL, notes: "kept" },
    });
  });

  it("still holds the form for this visit when storage refuses to", async () => {
    stubStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    });
    const draft = await fresh();
    draft.editManual({ name: "Tea ceremony" });
    expect(draft.getAddDraft().manual.name).toBe("Tea ceremony");
  });

  it("says a share is not kept when storage is switched off, so its address stays", async () => {
    vi.stubGlobal("window", { sessionStorage: null });
    const draft = await fresh();
    expect(draft.takeShare("https://www.instagram.com/reel/C9xArashiyama/")).toBe(false);
    expect(draft.getAddDraft().text).toBe("https://www.instagram.com/reel/C9xArashiyama/");
  });

  it("hands out a new snapshot on each change, which is what re-renders the form", async () => {
    const draft = await fresh();
    const before = draft.getAddDraft();
    expect(draft.getAddDraft()).toBe(before);

    draft.editManual({ notes: "window seat" });
    expect(draft.getAddDraft()).not.toBe(before);
    expect(draft.getAddDraft().manual.notes).toBe("window seat");
  });
});
