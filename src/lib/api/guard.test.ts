import { beforeEach, describe, expect, it } from "vitest";
import { guard, resetBudgets } from "./guard";

const BUDGET = { limit: 3, windowMs: 60_000 };

/** The app's own fetches always label the body as JSON; tests override it to check the rule. */
function request(headers: Record<string, string>): Request {
  return new Request("https://manifest.example/api/extract", {
    method: "POST",
    headers: { host: "manifest.example", "content-type": "application/json", ...headers },
  });
}

/** What a current browser sends for a fetch from the app's own page. */
const FROM_THE_APP = { origin: "https://manifest.example", "sec-fetch-site": "same-origin" };

beforeEach(() => resetBudgets());

describe("who is allowed to spend the credits", () => {
  it("lets the app's own pages through", () => {
    expect(guard(request({ origin: "https://manifest.example" }), "extract", BUDGET)).toBeUndefined();
  });

  it("works on whatever host it is deployed to, without configuration", () => {
    const preview = new Request("https://travel-abc123.vercel.app/api/extract", {
      method: "POST",
      headers: {
        host: "travel-abc123.vercel.app",
        origin: "https://travel-abc123.vercel.app",
        "content-type": "application/json",
      },
    });
    expect(guard(preview, "extract", BUDGET)).toBeUndefined();
  });

  it("turns away a page on someone else's domain", () => {
    const blocked = guard(request({ origin: "https://not-mine.example" }), "extract", BUDGET);
    expect(blocked?.status).toBe(403);
  });

  it("turns away a request with no browser origin at all", () => {
    // The curl case: a script pointed straight at the URL sends neither header.
    expect(guard(request({}), "extract", BUDGET)?.status).toBe(403);
  });

  it("accepts a referer when that is all there is", () => {
    expect(
      guard(request({ referer: "https://manifest.example/add" }), "extract", BUDGET),
    ).toBeUndefined();
  });

  it("is not fooled by a hostname that merely ends with the real one", () => {
    const blocked = guard(request({ origin: "https://manifest.example.attacker.test" }), "extract", BUDGET);
    expect(blocked?.status).toBe(403);
  });
});

describe("what the browser says about where a request came from", () => {
  it("lets a same-origin fetch from the app's own page through", () => {
    expect(guard(request(FROM_THE_APP), "extract", BUDGET)).toBeUndefined();
  });

  it("turns away a page on another site, even one that somehow carries the right origin", () => {
    const blocked = guard(request({ ...FROM_THE_APP, "sec-fetch-site": "cross-site" }), "extract", BUDGET);
    expect(blocked?.status).toBe(403);
  });

  it("turns away a sibling subdomain, which is same-site but not same-origin", () => {
    const blocked = guard(request({ ...FROM_THE_APP, "sec-fetch-site": "same-site" }), "extract", BUDGET);
    expect(blocked?.status).toBe(403);
  });

  it("turns away a request the user started by hand, which the app never sends", () => {
    const blocked = guard(request({ ...FROM_THE_APP, "sec-fetch-site": "none" }), "extract", BUDGET);
    expect(blocked?.status).toBe(403);
  });

  it("does not let a same-origin claim stand in for the right origin", () => {
    const blocked = guard(
      request({ origin: "https://not-mine.example", "sec-fetch-site": "same-origin" }),
      "extract",
      BUDGET,
    );
    expect(blocked?.status).toBe(403);
  });

  describe("with no Sec-Fetch-Site, as from an older browser", () => {
    it("still lets the app's own origin through", () => {
      expect(guard(request({ origin: "https://manifest.example" }), "extract", BUDGET)).toBeUndefined();
    });

    it("still lets a matching referer through when that is all there is", () => {
      expect(
        guard(request({ referer: "https://manifest.example/discover" }), "advise", BUDGET),
      ).toBeUndefined();
    });

    it("still turns away a foreign origin", () => {
      expect(guard(request({ origin: "https://not-mine.example" }), "extract", BUDGET)?.status).toBe(403);
    });

    it("still turns away a request with neither origin nor referer", () => {
      expect(guard(request({ "x-forwarded-for": "203.0.113.9" }), "extract", BUDGET)?.status).toBe(403);
    });
  });
});

describe("what the body has to be", () => {
  function sending(contentType: string | undefined): Request {
    const headers: Record<string, string> = { host: "manifest.example", ...FROM_THE_APP };
    if (contentType !== undefined) headers["content-type"] = contentType;
    return new Request("https://manifest.example/api/extract", { method: "POST", headers });
  }

  it("accepts JSON, with or without a charset", () => {
    expect(guard(sending("application/json"), "extract", BUDGET)).toBeUndefined();
    expect(guard(sending("Application/JSON; charset=utf-8"), "advise", BUDGET)).toBeUndefined();
  });

  it("refuses a request that does not say what it is sending", () => {
    expect(guard(sending(undefined), "extract", BUDGET)?.status).toBe(415);
  });

  it("refuses the types a cross-site form or no-cors fetch can send", () => {
    for (const type of [
      "text/plain",
      "text/plain;charset=UTF-8",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
    ]) {
      expect(guard(sending(type), "extract", BUDGET)?.status).toBe(415);
    }
  });

  it("refuses a JSON-looking type that is not JSON itself", () => {
    expect(guard(sending("application/json-patch+json"), "extract", BUDGET)?.status).toBe(415);
    expect(guard(sending("text/json"), "extract", BUDGET)?.status).toBe(415);
  });

  it("checks where a request came from before what it sends", () => {
    const foreign = new Request("https://manifest.example/api/extract", {
      method: "POST",
      headers: { host: "manifest.example", origin: "https://not-mine.example", "content-type": "text/plain" },
    });
    expect(guard(foreign, "extract", BUDGET)?.status).toBe(403);
  });

  it("does not spend the budget on a request it refuses", () => {
    const client = { "x-forwarded-for": "203.0.113.50" };
    for (let i = 0; i < BUDGET.limit + 2; i++) {
      const refused = new Request("https://manifest.example/api/extract", {
        method: "POST",
        headers: { host: "manifest.example", ...FROM_THE_APP, ...client, "content-type": "text/plain" },
      });
      expect(guard(refused, "extract", BUDGET)?.status).toBe(415);
    }
    expect(guard(request({ ...FROM_THE_APP, ...client }), "extract", BUDGET)).toBeUndefined();
  });
});

describe("how much one client may spend", () => {
  const headers = { origin: "https://manifest.example", "x-forwarded-for": "203.0.113.9" };

  it("allows the budget, then stops", () => {
    for (let i = 0; i < BUDGET.limit; i++) {
      expect(guard(request(headers), "extract", BUDGET)).toBeUndefined();
    }
    const blocked = guard(request(headers), "extract", BUDGET);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("retry-after")).toBeTruthy();
  });

  it("counts each client separately", () => {
    for (let i = 0; i < BUDGET.limit; i++) guard(request(headers), "extract", BUDGET);
    const other = { ...headers, "x-forwarded-for": "198.51.100.4" };
    expect(guard(request(other), "extract", BUDGET)).toBeUndefined();
  });

  it("reads only the first hop of a forwarded chain", () => {
    const chained = { ...headers, "x-forwarded-for": "203.0.113.9, 10.0.0.1" };
    for (let i = 0; i < BUDGET.limit; i++) guard(request(headers), "extract", BUDGET);
    expect(guard(request(chained), "extract", BUDGET)?.status).toBe(429);
  });

  it("keeps the routes' budgets apart", () => {
    for (let i = 0; i < BUDGET.limit; i++) guard(request(headers), "extract", BUDGET);
    expect(guard(request(headers), "advise", BUDGET)).toBeUndefined();
  });

  it("opens the window again once it has passed", () => {
    const tiny = { limit: 1, windowMs: 0 };
    expect(guard(request(headers), "extract", tiny)).toBeUndefined();
    expect(guard(request(headers), "extract", tiny)).toBeUndefined();
  });
});
