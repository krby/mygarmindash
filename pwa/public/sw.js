// Service worker for the app shell only.
// API responses are managed by TanStack Query — do NOT double-cache.

const VERSION = "v2";
const SHELL = `shell-${VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // Android uses the maskable icon for the installed launcher icon — precache it
  // so a re-add while offline still has icon bytes to serve.
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Add each asset independently: a single missing file (e.g. in dev) must
      // not reject the whole precache and leave the shell uncached.
      Promise.allSettled(SHELL_ASSETS.map((a) => cache.add(a))),
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
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Only substitute the app shell for *navigations*. Returning index.html
        // for a failed image/script request is what blanked the installed icon
        // (HTML bytes served as the icon). Let other requests fail honestly.
        if (req.mode === "navigate") {
          const shell = await caches.match("/index.html");
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
