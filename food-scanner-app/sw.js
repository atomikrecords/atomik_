// SafeBite service worker — makes the app installable and usable with no
// signal (the exact situation this app needs to work in: grocery store
// dead zones). App files are network-first so a redeploy always reaches
// users promptly; the cached copy is only the fallback when offline.
const CACHE_NAME = 'safebite-shell-v2';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept PUTs to the BiteID API etc.

  const url = new URL(req.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isShellFile = isOwnOrigin && SHELL_FILES.includes(url.pathname);
  const isNavigation = req.mode === 'navigate';

  // Only handle our own app-shell files and page navigations offline.
  // Everything else (Open Food Facts, our functions, FDA) passes straight
  // through to the network untouched — those need live data, not a cache.
  if (!isShellFile && !isNavigation) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(isNavigation ? '/index.html' : req, copy));
        return res;
      })
      .catch(() => caches.match(isNavigation ? '/index.html' : req))
  );
});
