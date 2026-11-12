import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetBudgets } from "@/lib/api/guard";
import { POST as advise } from "./route";

describe("the advise route with nothing to show", () => {
  const keys = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "GOOGLE_PLACES_API_KEY"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    // No keys, so only the free tiers run and nothing is sent anywhere.
    for (const key of keys) delete process.env[key];
    resetBudgets();
  });
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("tells the traveller what happened and what they can do, not how to configure the server", async () => {
    // Tokyo has no published picks for hidden gems.
    const response = await advise(
      new Request("https://manifest.example/api/advise", {
        method: "POST",
        headers: {
          host: "manifest.example",
          origin: "https://manifest.example",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ destination: " Tokyo ", countryCode: "JP", interests: ["gems"] }),
      }),
    );

    expect(response.status).toBe(503);
    const { error } = (await response.json()) as { error: string };
    expect(error).toBe("Nothing came back for Tokyo that I could verify. File a few places you like, then look again.");
    expect(error).not.toMatch(/API key|paid tiers/);
  });
});
