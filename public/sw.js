/* Offline-first service worker. The build is a single inlined HTML file,
   so caching the document is enough to run with no network. */

const CACHE = "wwr-v5";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-maskable.svg"];
/** Runtime cache ceiling: same-origin assets beyond this get evicted oldest-first. */
const RUNTIME_CAP = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        // a partially primed cache is still better than no cache, but stay loud about it
        c.addAll(CORE).catch((err) => console.warn("[sw] core pre-cache incomplete:", err))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimRuntimeCache() {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_CAP) return;
  const shell = new URL("./index.html", self.location).href;
  const root = new URL("./", self.location).href;
  for (const req of keys.slice(0, keys.length - RUNTIME_CAP)) {
    // never evict the offline shell
    if (req.url === shell || req.url === root) continue;
    await cache.delete(req);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigations: network first so updates land, cache as the offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE).then((c) => c.put("./index.html", copy))
          );
          return res;
        })
        .catch(() =>
          caches
            .match("./index.html")
            .then((r) => r || caches.match("./"))
            .then((r) => r || new Response("Offline and not cached yet.", { status: 503, headers: { "Content-Type": "text/plain" } }))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok && new URL(req.url).origin === self.location.origin) {
              const copy = res.clone();
              event.waitUntil(
                caches.open(CACHE).then((c) => c.put(req, copy)).then(trimRuntimeCache)
              );
            }
            return res;
          })
          .catch(() => hit)
    )
  );
});
