// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v3.3
// ============================================================

const CACHE_NAME   = 'halaqah-v3.3';
const BASE         = '/Portal-Halaqah-Rattililquran';
const STATIC_CACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/guru/index.html',
  BASE + '/murid/index.html',
  BASE + '/admin/index.html',
  BASE + '/manifest.json',
  BASE + '/assets/js/api.js',
  BASE + '/assets/js/jspdf.umd.min.js',
  BASE + '/assets/js/html2canvas.min.js',
  BASE + '/assets/images/logo-putih.png',
  BASE + '/assets/images/logo-abu.png',
  // Fonts lokal
  BASE + '/assets/font.css',
  BASE + '/assets/fonts/PlusJakartaSans-400.woff2',
  BASE + '/assets/fonts/PlusJakartaSans-500.woff2',
  BASE + '/assets/fonts/PlusJakartaSans-600.woff2',
  BASE + '/assets/fonts/PlusJakartaSans-700.woff2',
  BASE + '/assets/fonts/PlusJakartaSans-800.woff2',
  BASE + '/assets/fonts/Amiri-arabic-400.woff2',
  BASE + '/assets/fonts/Amiri-arabic-700.woff2',
  BASE + '/assets/fonts/Amiri-latin-400.woff2',
  BASE + '/assets/fonts/Amiri-latin-700.woff2',
];

// Install — cache file statis
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_CACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — hapus cache lama
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — Network first, fallback ke cache
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // GAS API — selalu network, jangan cache
  if (url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Font Google (CDN) — cache
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  // Static assets — cache first
  if (url.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML pages — network first, fallback cache
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res.ok) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match(BASE + '/index.html');
      });
    })
  );
});
