const CACHE_STATIC = 'hazajaro-static-v3';
const CACHE_TILES = 'hazajaro-tiles-v1';

const STATIC_ASSETS = [
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_STATIC && k !== CACHE_TILES)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // OpenStreetMap tiles — cache-first, then network, store for offline
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(CACHE_TILES).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp && resp.status === 200) {
              cache.put(e.request, resp.clone());
            }
            return resp;
          }).catch(() => cached || new Response('', {status: 503}));
        })
      )
    );
    return;
  }

  // Static assets — cache-first
  if (url.includes('unpkg.com') || url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.css')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_STATIC).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached || new Response('Offline', {status: 503}))
      )
    );
    return;
  }

  // Everything else — network first, fallback to cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
