const CACHE_NAME = 'eisfavorite-guaranteed-save-20260721-v4';
const urlsToCache = [
  '/',
  '/buchungen-uebersicht.html',
  '/logo.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.json'
];

// Installation - Cache-Dateien speichern
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache geöffnet');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Aktivierung - Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Netzwerk zuerst, dann Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Wenn die Anfrage erfolgreich ist, speichere sie im Cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Bei Netzwerkfehler, verwende Cache
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // Fallback für HTML-Seiten
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/buchungen-uebersicht.html');
          }
        });
      })
  );
});
