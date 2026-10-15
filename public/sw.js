/* Offline support for Manifest. Deliberately conservative: API calls never
   touch the cache, and only content-hashed build assets are cached forever. */

// v2: navigations are keyed by path alone, so the activate step below clears
// v1's copies, some of which held shared text in their query.
const CACHE = "manifest-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Extraction must always hit the network — a stale answer is worse than none.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // A share-target launch carries the shared text in the query. Every page
    // reads its query on the client, so ask the network for the bare page and
    // cache it under that: what was shared stays on the device, out of the
    // server's request logs and out of this cache.
    const page = url.search ? new Request(url.origin + url.pathname) : request;
    event.respondWith(
      fetch(page)
        .then((response) => {
          cachePut(page, response);
          return response;
        })
        .catch(() =>
          caches
            .match(page)
            .then((cached) => cached ?? caches.match("/"))
            .then((cached) => cached ?? Response.error()),
        ),
    );
    return;
  }

  // Build assets carry a content hash, so a cache hit is always correct.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            cachePut(request, response);
            return response;
          }),
      ),
    );
  }
});
