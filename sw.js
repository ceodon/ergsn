// ERGSN Service Worker — offline-first cache for slow/intermittent networks
const CACHE = 'ergsn-v1';
const CORE = [
  '/ergsn/',
  '/ergsn/index.html',
  '/ergsn/translations.js',
  '/ergsn/favicon.svg',
  '/ergsn/privacy.html',
  '/ergsn/terms.html',
  '/ergsn/partners-kr.html',
  '/ergsn/tracker.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network-first for navigations (fresh HTML), cache-first for static assets
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Skip cross-origin (Telegram proxy, FormSubmit, Plausible, Google Fonts)
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('/ergsn/')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r && r.status === 200 && r.type === 'basic') {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => cached))
  );
});
