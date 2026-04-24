// ERGSN Service Worker — offline-first cache for slow/intermittent networks
// Cache version bumped to v3 on 2026-04-25 to evict stale cached copies of
// scripts/header.js, scripts/footer.js, and scripts/products-catalog.js
// after the nav + footer expansion (partners-tourism.html + kbeauty-latam.html
// links) and the K-Beauty chip filter were added — cache-first returning
// v2 cached bundles left new pages invisible in shared chrome.
const CACHE = 'ergsn-v3';
const CORE = [
  '/',
  '/index.html',
  '/translations.js',
  '/favicon.svg',
  '/privacy.html',
  '/terms.html',
  '/partners-kr.html',
  '/tracker.html'
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
        .catch(() => caches.match(req).then(r => r || caches.match('/')))
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
