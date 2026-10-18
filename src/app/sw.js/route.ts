/**
 * The service worker for the dashboard and the till (registered only under
 * /dashboard and /staff, see components/AppServiceWorker; guest pages never
 * get one). It keeps the app's files (scripts, styles, fonts, icons: their
 * names change with every build) on the device after the first visit, and
 * shows a proper "you're offline" page when a page can't load. It never
 * stores pages or API answers: no guest names or numbers are left on a
 * shared till. Each deploy changes VERSION, which is how a running till
 * learns there's a new version (and offers to reload), and clears the last
 * version's files.
 */
const VERSION = process.env.APP_BUILD ?? "dev";

const SCRIPT = `
const VERSION = ${JSON.stringify(VERSION)};
const ASSETS = "tapmore-assets-" + VERSION;
const OFFLINE = "tapmore-offline-" + VERSION;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  // A first install takes over at once; an update waits until the page says so (its Reload button).
  event.waitUntil(caches.open(OFFLINE).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith("tapmore-") && key !== ASSETS && key !== OFFLINE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(fromCacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(fromNetworkOrOffline(request));
  }
  // Everything else (API calls, page data) goes to the network untouched.
});

async function fromCacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(request, response.clone());
  return response;
}

async function fromNetworkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Always checked, so a new deploy is noticed on the next visit.
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
