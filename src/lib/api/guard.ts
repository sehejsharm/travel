/**
 * The two model-backed routes are the only things in this app that cost money
 * to run. Everything else is static and local. Without a gate, the URL alone
 * is enough for anyone to spend the owner's Anthropic credits, and there is no
 * account system to hang a per-user limit off.
 *
 * So two cheap defences, neither of which the app itself ever trips:
 *
 *   1. The request has to come from this app in a browser. A same-origin POST
 *      always carries an Origin header; a script pointed at the URL from
 *      somewhere else carries a different one, or none.
 *   2. A per-IP budget over a rolling window, so a browser that does send the
 *      right Origin still cannot sit in a loop.
 *
 * Be honest about the limits of (2): each serverless instance keeps its own
 * counters, so the effective ceiling is the limit times however many instances
 * are warm, and a rotating IP gets a fresh budget. It is a speed bump against
 * casual abuse, not a wall against a determined one. The wall is the spend cap
 * set on the Anthropic account, which is the thing that actually bounds the
 * bill and belongs there rather than in this file.
 */

/** Extra origins allowed in, comma-separated. The site's own is always allowed. */
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export interface Budget {
  /** Requests allowed per window, per IP. */
  limit: number;
  windowMs: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Module scope, so it survives between invocations on a warm instance and
 * vanishes on a cold one — which is the right trade for a counter nobody needs
 * to be durable. Keyed by route so a burst of extractions cannot exhaust the
 * advisor's budget as well.
 */
const windows = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number): void {
  if (windows.size < 2000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

function hostOf(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Whether the request was made by this app rather than by something pointed at
 * its URL. Compared against the Host the request actually arrived on, so it
 * keeps working on preview deployments and on localhost without configuration.
 */
function sameOrigin(request: Request): boolean {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const allowed = new Set(
    [host, hostOf(process.env.NEXT_PUBLIC_SITE_URL ?? null), ...EXTRA_ORIGINS.map((origin) => hostOf(origin))].filter(
      (value): value is string => Boolean(value),
    ),
  );

  // Origin is the reliable one: browsers attach it to every cross-origin POST
  // and to same-origin POSTs alike, and script cannot forge it.
  const origin = hostOf(request.headers.get("origin"));
  if (origin) return allowed.has(origin);

  // No Origin at all means it was not a browser fetch. A share-target or
  // service-worker request still carries one, so this is the curl case.
  const referer = hostOf(request.headers.get("referer"));
  return referer ? allowed.has(referer) : false;
}

/** Best available client identity behind Vercel's proxy. */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a Response when the request should not be served, or undefined to
 * let it through. Callers check for a response and return it unchanged.
 */
export function guard(request: Request, route: string, budget: Budget): Response | undefined {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "This endpoint only answers the app it belongs to." },
      { status: 403 },
    );
  }

  const now = Date.now();
  sweep(now);

  const key = `${route}:${clientKey(request)}`;
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + budget.windowMs });
    return undefined;
  }

  if (current.count >= budget.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return Response.json(
      { error: "That is a lot of requests in a short time. Give it a minute." },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }

  current.count += 1;
  return undefined;
}

/** Exposed for tests, which must not inherit counters from each other. */
export function resetBudgets(): void {
  windows.clear();
}
