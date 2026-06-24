// Service worker for the app shell only.
// API responses are managed by TanStack Query — do NOT double-cache.

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {
        // Don't break install if some assets are missing in dev.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // /api/* is owned by TanStack Query + IndexedDB persister. Pass through.
  if (url.pathname.startsWith("/api/")) return;

  // Only handle same-origin GETs for the app shell.
  if (url.origin !== self.location.origin) return;

  // Network-first with cache fallback for the shell.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("/index.html"))),
  );
});
