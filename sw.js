// Caddie Service Worker — STORM CACHE
const CACHE_NAME = 'caddie-v1';
const URLS_TO_CACHE = [
  '/pjcaddie/',
  '/pjcaddie/index.html'
];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first for the app, network first for the API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for the Anthropic API
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({error: 'offline'}), {
          headers: {'Content-Type': 'application/json'}
        })
      )
    );
    return;
  }

  // Always go to network for Google Fonts
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache first for everything else (the app itself)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for the app
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If we're fully offline and have no cache, return a friendly fallback
        if (event.request.destination === 'document') {
          return caches.match('/pjcaddie/');
        }
      });
    })
  );
});
