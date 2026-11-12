import { describe, expect, it } from "vitest";
import { tripadvisorThingsToDoUrl, tripadvisorUrl } from "./tripadvisor";

describe("links out to Tripadvisor", () => {
  it("searches for a place by its name and city", () => {
    expect(tripadvisorUrl("Senso-ji", "Tokyo")).toBe("https://www.tripadvisor.com/Search?q=Senso-ji%2C%20Tokyo");
    expect(tripadvisorUrl("Senso-ji")).toBe("https://www.tripadvisor.com/Search?q=Senso-ji");
  });

  it("keeps a name's own punctuation out of the address", () => {
    const url = new URL(tripadvisorUrl("Café & Bar #1", "São Paulo"));
    expect(url.searchParams.get("q")).toBe("Café & Bar #1, São Paulo");
    expect([...url.searchParams.keys()]).toEqual(["q"]);
  });

  it("opens the things to do for a whole destination", () => {
    const url = new URL(tripadvisorThingsToDoUrl("Lisbon"));
    expect(url.origin + url.pathname).toBe("https://www.tripadvisor.com/Search");
    expect(url.searchParams.get("q")).toBe("Lisbon");
    expect(url.searchParams.get("ssrc")).toBe("A");
  });
});
