// ERGSN Service Worker — offline-first cache for slow/intermittent networks
// Cache version bumped to v5 on 2026-05-08 to evict v4 cached copies of
// index.html / app.css that still had the old print-from-modal CSS path
// (which leaked the modal's fixed positioning into Chrome's print engine
// and produced 20 repeated identical pages). The fix moves print to a
// dedicated #printSpecSheet container, but only takes effect once the
// fresh HTML/CSS are fetched — hence the cache bump.
const CACHE = 'ergsn-v5';
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
  // Skip cross-origin (Telegram proxy, FormSubmit, Cloudflare Web Analytics, Google Fonts)
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
