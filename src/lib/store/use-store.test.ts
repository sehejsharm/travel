import { describe, expect, it, vi } from "vitest";

const { loadHolidays } = vi.hoisted(() => ({
  loadHolidays: vi.fn(async (codes: string[]) => {
    void codes;
  }),
}));
vi.mock("../reference/holidays", async (original) => ({
  ...(await original<typeof import("../reference/holidays")>()),
  loadHolidays,
}));

const { keepHolidaysLoaded } = await import("./use-store");

describe("keeping the trip's calendars loaded", () => {
  it("loads at once, again each time the device comes back online, and stops when cleaned up", () => {
    const device = new EventTarget();
    const stop = keepHolidaysLoaded(["JP", "IN"], device);
    expect(loadHolidays).toHaveBeenCalledTimes(1);
    expect(loadHolidays).toHaveBeenLastCalledWith(["JP", "IN"]);

    device.dispatchEvent(new Event("online"));
    device.dispatchEvent(new Event("online"));
    expect(loadHolidays).toHaveBeenCalledTimes(3);

    // Going offline asks for nothing.
    device.dispatchEvent(new Event("offline"));
    expect(loadHolidays).toHaveBeenCalledTimes(3);

    stop();
    device.dispatchEvent(new Event("online"));
    expect(loadHolidays).toHaveBeenCalledTimes(3);
  });
});
