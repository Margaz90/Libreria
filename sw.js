/* Service worker della Libreria di Diego.
   - File dell'app: rete prima (così gli aggiornamenti arrivano subito), copia locale se sei offline.
   - Font e copertine: copia locale prima, rete solo la prima volta.
   - Ricerche su Google Books: sempre dalla rete. */
const VERSION = "v52";
const SHELL = `libreria-shell-${VERSION}`;
const ASSETS = "libreria-asset-v1";
const LIBS = "libreria-lib-v1"; // lettore ISBN: resta in cache tra una versione e l'altra, così funziona anche offline
const SHELL_FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const MAX_ASSETS = 400;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("libreria-shell-") && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data === "skip-waiting") self.skipWaiting(); });

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(req, { signal: ctl.signal });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) ||
           (req.mode === "navigate" ? await cache.match("index.html") : Response.error());
  }
}

async function cacheFirst(req, cacheName = ASSETS) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") { cache.put(req, res.clone()); if (cacheName === ASSETS) trim(ASSETS, MAX_ASSETS); }
    return res;
  } catch { return Response.error(); }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith("seed.json")) return; // sempre dalla rete
    if (url.pathname.endsWith("zxing.min.js")) { e.respondWith(cacheFirst(req, LIBS)); return; }
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.hostname === "www.googleapis.com") return; // ricerche: solo rete
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") ||
      url.hostname.endsWith("books.google.com") || url.hostname.endsWith("books.googleusercontent.com") ||
      url.hostname.endsWith("covers.openlibrary.org") || url.hostname.endsWith("archive.org") ||
      url.hostname.endsWith("mzstatic.com") || url.hostname === "cdn.jsdelivr.net") { // SDK di Firebase: caricato solo all'accesso, poi in cache
    e.respondWith(cacheFirst(req));
  }
});
