// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v5.0 — push notification support
// ============================================================

const CACHE_NAME   = 'halaqah-v5.0';
const BASE         = '/Portal-Halaqah-Rattililquran';
const STATIC_CACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/guru/index.html',
  BASE + '/murid/index.html',
  BASE + '/admin/index.html',
  BASE + '/manifest.json',
  // jspdf dan html2canvas dimuat lazy (on-demand), tidak dicache saat install
  // karena file bisa tidak ada dan menyebabkan SW install gagal
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

  // GAS API — selalu network, jangan cache, biarkan browser menangani secara native
  if (url.includes('script.google.com')) {
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

  // Hanya GET yang di-cache — POST/PUT/PATCH jangan pernah dicache
  if (e.request.method !== 'GET') return;

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


// ══════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

// Terima push dari server → tampilkan notifikasi
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(_) {}

  var title   = data.title   || "Rattililqur'an";
  var body    = data.body    || '';
  var icon    = data.icon    || '/Portal-Halaqah-Rattililquran/assets/icons/icon-192.png';
  var badge   = data.badge   || '/Portal-Halaqah-Rattililquran/assets/icons/icon-72.png';
  var tag     = data.tag     || 'rattil-notif';
  var url     = data.url     || '/Portal-Halaqah-Rattililquran/';

  e.waitUntil(
    self.registration.showNotification(title, {
      body        : body,
      icon        : icon,
      badge       : badge,
      tag         : tag,
      renotify    : true,
      requireInteraction: false,
      data        : { url: url, ...(data.data || {}) },
      vibrate     : [200, 100, 200],
    })
  );
});

// Klik notifikasi → buka/fokus tab portal
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var rawUrl = (e.notification.data && e.notification.data.url) || '/';
  // Pastikan URL selalu punya base path (cegah 404)
  var BASE = '/Portal-Halaqah-Rattililquran';
  var targetUrl = rawUrl.startsWith('http') ? rawUrl
    : (rawUrl.startsWith(BASE) ? rawUrl : BASE + rawUrl);

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // Jika sudah ada tab portal yang terbuka, fokuskan
        for (var i = 0; i < windowClients.length; i++) {
          var c = windowClients[i];
          if (c.url.includes('Portal-Halaqah-Rattililquran') && 'focus' in c) {
            c.focus(); if (c.navigate) return c.navigate(targetUrl); return c;
          }
        }
        // Tidak ada → buka tab baru
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// Push subscription berubah (endpoint expired) → hapus dari server
self.addEventListener('pushsubscriptionchange', function(e) {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(function(newSub) {
        // Kirim subscription baru ke server (dihandle oleh portal saat reload)
        return self.clients.matchAll().then(function(clients) {
          clients.forEach(function(c) {
            c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSub });
          });
        });
      })
  );
});
