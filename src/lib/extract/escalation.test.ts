import { describe, expect, it, vi } from "vitest";

/*
 * The model is configured but its pass fails, so the cheap result stands and
 * the reason shown on the Add screen says what to do next.
 */
vi.mock("./llm", () => ({
  hasCredentials: () => true,
  extractWithLlm: async () => null,
  extractFromImage: async () => null,
}));

const { extract } = await import("./index");

describe("when the model pass is unavailable", () => {
  it("says so, then what to do, in two sentences rather than across a dash", async () => {
    const result = await extract({ text: "dinner somewhere nice", source: "manual" });

    expect(result.escalationReason).toMatch(/ Model pass unavailable\. Review the fields below\.$/);
    expect(result.escalationReason).not.toContain("—");
  });
});
