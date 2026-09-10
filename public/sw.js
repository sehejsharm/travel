/* Offline support for Manifest. Deliberately conservative: API calls never
   touch the cache, and only content-hashed build assets are cached forever. */

const CACHE = "manifest-v1";

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
    event.respondWith(
      fetch(request)
        .then((response) => {
          cachePut(request, response);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
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
