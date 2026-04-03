
// Service Worker básico para cumplir criterios de instalación PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estrategia básica: Network First, fallback to cache (si implementáramos cache)
  // Por ahora, simplemente permite que la app funcione y sea instalable.
  event.respondWith(fetch(event.request));
});
