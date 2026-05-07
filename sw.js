const CACHE_STATIC = 'hazajaro-static-v5';
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
      .then(() => self.skipWaiting()) // Azonnal átveszi az irányítást
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_STATIC && k !== CACHE_TILES)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // Azonnal frissíti az összes nyitott lapot
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // OpenStreetMap tiles — cache-first (offline térképhez)
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(CACHE_TILES).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp && resp.status === 200) cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => new Response('', {status: 503}));
        })
      )
    );
    return;
  }

  // index.html és sw.js — mindig hálózatról, cache fallback
  if (url.endsWith('.html') || url.endsWith('sw.js')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          caches.open(CACHE_STATIC).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Leaflet és egyéb statikus fájlok — cache-first
  if (url.includes('unpkg.com') || url.endsWith('.css') || url.endsWith('.js')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_STATIC).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => new Response('Offline', {status: 503}))
      )
    );
    return;
  }

  // Minden más — hálózat, cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Üzenet az app felé ha új verzió érhető el
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
