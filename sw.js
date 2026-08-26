const CACHE_NAME = 'crm-pagos-v2';
const STATIC_ASSETS = [
  '/',
  'index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isFirebase = request.url.includes('firestore.googleapis.com') ||
                     request.url.includes('identitytoolkit.googleapis.com') ||
                     request.url.includes('securetoken.googleapis.com');
  if (isFirebase) return; // network only for Firebase APIs

  // Network-first for same-origin, fallback to cache
  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp.ok && request.url.startsWith(self.location.origin)) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
