/* HYBR.D - offline shell. Bump CACHE when the app files change. */

const CACHE = 'vo2max-v107';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/block.js',
  './js/chart.js',
  './js/exercises.js',
  './js/gcal.js',
  './js/icons.js',
  './js/ics.js',
  './js/intervals.js',
  './js/muscleDiagram.js',
  './js/shareCard.js',
  './js/store.js',
  './js/workout.js',
  './js/zones.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/logo-header.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/muscles/body-front.png',
  './icons/muscles/body-back.png',
  './icons/muscles/chest-front.png',
  './icons/muscles/shoulders-front.png',
  './icons/muscles/shoulders-back.png',
  './icons/muscles/biceps-front.png',
  './icons/muscles/forearms-front.png',
  './icons/muscles/abs-front.png',
  './icons/muscles/quads-front.png',
  './icons/muscles/back-back.png',
  './icons/muscles/triceps-back.png',
  './icons/muscles/glutes-back.png',
  './icons/muscles/hamstrings-back.png',
  './icons/muscles/calves-back.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Network first, so a deployed update is picked up as soon as it is online,
  // with the cache as the offline fallback. The index.html fallback only
  // applies to page navigations - falling back to it for a failed asset
  // fetch (e.g. one of the muscle-diagram PNGs dropped mid-load) would hand
  // the browser an HTML document where it expected a script or image, which
  // renders as a broken-image icon instead of failing cleanly.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })),
  );
});
