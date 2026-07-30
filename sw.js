importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDNtaUvAbjU2OHjLWNnNJyhkccoH9YlkYo",
  authDomain: "mailfavorite-e8f49.firebaseapp.com",
  projectId: "mailfavorite-e8f49",
  storageBucket: "mailfavorite-e8f49.firebasestorage.app",
  messagingSenderId: "73719715044",
  appId: "1:73719715044:web:e0e762cda49ae166b6c8f1"
});

const messaging = firebase.messaging();

// Push-Benachrichtigung anzeigen, wenn die App im Hintergrund ist / geschlossen ist
messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || 'EisFavorite';
  const options = {
    body: payload.notification && payload.notification.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.click_action) || '/buchungen-uebersicht.html';
  event.waitUntil(clients.openWindow(url));
});

const CACHE_NAME = 'eisfavorite-installable-20260730-v6';
const urlsToCache = [
  '/',
  '/buchungen-uebersicht.html',
  '/login.html',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
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
  // HTML-Navigationsanfragen immer am Browser-HTTP-Cache vorbei direkt vom
  // Server holen, damit nach einem Deploy nie eine veraltete Version einer
  // Seite (z.B. aus dem letzten Öffnen der installierten PWA) angezeigt wird.
  const isHtmlRequest = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');
  const fetchRequest = isHtmlRequest
    ? new Request(event.request.url, { cache: 'no-store' })
    : event.request;

  event.respondWith(
    fetch(fetchRequest)
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
