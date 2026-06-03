// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v5.2 — push notification support
// ============================================================

const CACHE_NAME   = 'halaqah-v5.2';
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
  var BASE    = '/Portal-Halaqah-Rattililquran';
  var ALLOWED_ORIGIN = 'https://rattililquran.github.io';
  var targetUrl;
  if (rawUrl.startsWith('http')) {
    // Hanya izinkan URL dari origin yang sama — tolak open redirect ke domain lain
    try {
      var parsed = new URL(rawUrl);
      targetUrl = parsed.origin === ALLOWED_ORIGIN ? rawUrl : ALLOWED_ORIGIN + BASE + '/';
    } catch (_) {
      targetUrl = ALLOWED_ORIGIN + BASE + '/';
    }
  } else {
    targetUrl = rawUrl.startsWith(BASE) ? rawUrl : BASE + rawUrl;
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // Jika sudah ada tab portal yang terbuka, fokuskan
        for (var i = 0; i < windowClients.length; i++) {
          var c = windowClients[i];
          if (c.url.includes('Portal-Halaqah-Rattililquran') && 'focus' in c) {
            // c.navigate() tidak tersedia di Firefox/Safari — gunakan postMessage sebagai fallback
            return c.focus().then(function() {
              if (typeof c.navigate === 'function') return c.navigate(targetUrl);
              // Fallback: kirim pesan ke tab agar navigasi sendiri
              c.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
            });
          }
        }
        // Tidak ada → buka tab baru
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// Push subscription berubah (endpoint expired) → re-subscribe dan simpan langsung ke DB
self.addEventListener('pushsubscriptionchange', function(e) {
  // Guard: e.oldSubscription bisa null di beberapa browser
  if (!e.oldSubscription || !e.oldSubscription.options) return;

  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(function(newSub) {
        // 1. Coba kirim ke tab portal yang terbuka
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(function(windowClients) {
            if (windowClients.length > 0) {
              windowClients.forEach(function(c) {
                c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSub });
              });
            } else {
              // 2. Tidak ada tab terbuka → simpan langsung ke Supabase via fetch
              // SUPABASE_URL dan SUPABASE_ANON di-cache dari saat SW aktif
              var key = newSub.getKey && newSub.getKey('p256dh');
              var auth = newSub.getKey && newSub.getKey('auth');
              if (!key || !auth) return;
              var toB64url = function(buf) {
                return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
                  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
              };
              // Gunakan URL dan key yang disimpan di SW cache saat install
              var swUrl = self.registration.active && self.registration.active.scriptURL || '';
              var baseUrl = swUrl.replace('/Portal-Halaqah-Rattililquran/sw.js','');
              // Kirim ke send-push dengan flag re-subscribe (best effort)
              fetch(baseUrl + '/functions/v1/update-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint : newSub.endpoint,
                  p256dh   : toB64url(key),
                  auth_key : toB64url(auth),
                }),
              }).catch(function() {});
            }
          });
      })
      .catch(function() { /* Re-subscribe gagal — diabaikan, user perlu subscribe ulang manual */ })
  );
});
