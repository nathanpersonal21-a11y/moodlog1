// ── VERSION — change this string on every commit to force iOS to update ──
// If you set up GitHub Actions, the workflow bumps this automatically.
const CACHE_VERSION = 'moodlog-v20260605-2031';

const STATIC_ASSETS = ['./', './index.html'];

// ── INSTALL: cache static assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old SW to die
  );
});

// ── ACTIVATE: delete every old cache, then take control of all open tabs ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take over tabs without a reload
  );
});

// ── FETCH: network-first for HTML/JS, cache-first for fonts/images ──
// Network-first means the app always tries to get the latest code from
// GitHub Pages. If offline, it falls back to the cached version.
// This is the key difference from the old cache-first strategy — iOS will
// now pick up your changes on the next load instead of serving stale cache.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept POST requests (Google Sheets sync, Drive uploads)
  if (e.request.method !== 'GET') return;

  // Never intercept cross-origin requests except Google Fonts
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') ||
                        url.hostname.includes('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !isGoogleFonts) return;

  // Google Fonts: cache-first (they're versioned and never change)
  if (isGoogleFonts) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Everything else (index.html, sw.js itself): network-first
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Only cache valid responses from our own origin
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request)) // offline fallback
  );
});
