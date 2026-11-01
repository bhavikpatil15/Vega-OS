// public/sw.js
const CACHE_NAME = 'nexus-os-shell-v1';

// Static application shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: Cache core application shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[VEGA SW] Pre-cache warning:', err))
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy tuned for offline shell & asset safety
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 1. Navigation requests (HTML page): Network-first with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return new Response('Offline - VEGA OS Shell not cached yet.', {
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 2. Same-origin static assets (/assets/*, JS, CSS, fonts, icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(networkResponse => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (url.pathname.startsWith('/assets/') ||
                url.pathname.endsWith('.js') ||
                url.pathname.endsWith('.css') ||
                url.pathname.endsWith('.svg') ||
                url.pathname.endsWith('.png'))
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for same-origin icons if missing
            return caches.match('/favicon.svg');
          });
      })
    );
    return;
  }

  // 3. External requests (e.g. Unsplash images, external CDN): Network only
  // Note: We deliberately do NOT claim offline support for external networks or cache indiscriminately.
  event.respondWith(
    fetch(request).catch(() => {
      // Graceful offline fallback: return empty or let caller handle
      return new Response('', {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
      });
    })
  );
});
