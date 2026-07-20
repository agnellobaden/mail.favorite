const CACHE_NAME = 'eisfavorite-v1';
const urlsToCache = [
  './buchungen-uebersicht.html',
  './rechnung-erstellen.html',
  './email-zu-json.html',
  './rechnung-mobil.html',
  './strichliste-mobil.html',
  './strichliste-kunde-mobil.html',
  './manifest.json'
];

// Installation
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installiere...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cache geöffnet');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('❌ Cache-Fehler:', err))
  );
  self.skipWaiting();
});

// Aktivierung
self.addEventListener('activate', event => {
  console.log('✅ Service Worker: Aktiviert');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Network First, dann Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Wenn erfolgreich, klone und cache die Response
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Bei Fehler (offline), nutze Cache
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // Falls nicht im Cache, zeige Offline-Nachricht
          return new Response('Offline - Keine Verbindung', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});
