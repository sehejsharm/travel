import { beforeEach, describe, expect, it } from "vitest";
import { guard, resetBudgets } from "./guard";

const BUDGET = { limit: 3, windowMs: 60_000 };

function request(headers: Record<string, string>): Request {
  return new Request("https://manifest.example/api/extract", {
    method: "POST",
    headers: { host: "manifest.example", ...headers },
  });
}

beforeEach(() => resetBudgets());

describe("who is allowed to spend the credits", () => {
  it("lets the app's own pages through", () => {
    expect(guard(request({ origin: "https://manifest.example" }), "extract", BUDGET)).toBeUndefined();
  });

  it("works on whatever host it is deployed to, without configuration", () => {
    const preview = new Request("https://travel-abc123.vercel.app/api/extract", {
      method: "POST",
      headers: { host: "travel-abc123.vercel.app", origin: "https://travel-abc123.vercel.app" },
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
