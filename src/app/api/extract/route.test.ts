import { beforeEach, describe, expect, it } from "vitest";
import { resetBudgets } from "@/lib/api/guard";
import { POST as extract } from "./route";

describe("the extract route with an image over the limit", () => {
  beforeEach(() => resetBudgets());

  it("turns it away in two short sentences, not across a dash", async () => {
    const response = await extract(
      new Request("https://manifest.example/api/extract", {
        method: "POST",
        headers: {
          host: "manifest.example",
          origin: "https://manifest.example",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source: "screenshot",
          image: { data: "A".repeat(5_600_001), mediaType: "image/png" },
        }),
      }),
    );

    expect(response.status).toBe(413);
    const { error } = (await response.json()) as { error: string };
    expect(error).toBe("That image is too large. Under 4 MB works best.");
  });
});
