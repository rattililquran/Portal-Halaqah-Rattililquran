// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v6.3 — bypass SW for fonts/assets to avoid WebKit cache deadlock
// ============================================================

const CACHE_NAME   = 'halaqah-v6.3'; // bump versi → cache lama dihapus saat activate
const BASE         = '/Portal-Halaqah-Rattililquran';
const STATIC_CACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/guru/index.html',
  BASE + '/murid/index.html',
  BASE + '/admin/index.html',
  BASE + '/manifest.json',
  // Catatan: file font/gambar di /assets/ sengaja TIDAK di-precache di sini.
  // Permintaan ke /assets/ dan font CDN dilewatkan begitu saja oleh fetch handler
  // (lihat di bawah) untuk menghindari deadlock Cache Storage di WebKit/Safari
  // (cache.add saat install bertabrakan dengan cache.match/cache.put saat fetch,
  // membuat request font/gambar macet pending selamanya dan halaman ikut freeze).
];

// Install — cache file statis secara fault-tolerant
// Gunakan Promise.allSettled agar satu file gagal tidak crash seluruh SW
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        STATIC_CACHE.map(function(url) { return cache.add(url); })
      );
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


  // Font (Google CDN maupun lokal /assets/) — biarkan lewat tanpa campur tangan SW.
  // Mencegat & cache manual di sini menyebabkan deadlock Cache Storage di WebKit/Safari
  // (caches.match/c.put bertabrakan dengan cache.add saat install), membuat request
  // font/gambar macet pending selamanya dan halaman ikut freeze. Browser sudah cache
  // font & asset secara native lewat HTTP cache.
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || url.includes('/assets/')) {
    return;
  }

  // Hanya GET yang di-cache — POST/PUT/PATCH jangan pernah dicache
  if (e.request.method !== 'GET') return;

  // File lokal /supabase/ — Stale-While-Revalidate (tampil instan, update di background)
  if (url.includes('/supabase/') && !url.includes('supabase.co')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          // Selalu coba ambil versi terbaru di background
          var networkFetch = fetch(e.request).then(function(res) {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(function() { return null; });
          // Kembalikan dari cache instan jika ada, sambil update di background
          return cached || networkFetch;
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
  var PORTAL  = 'https://rattililquran.github.io';
  var targetUrl;
  if (rawUrl.startsWith('http')) {
    try {
      var parsed = new URL(rawUrl);
      // Izinkan semua HTTPS — Zoom, YouTube, dll
      // Blokir HTTP (tidak aman) dan protokol berbahaya
      targetUrl = parsed.protocol === 'https:' ? rawUrl : PORTAL + BASE + '/';
    } catch (_) {
      targetUrl = PORTAL + BASE + '/';
    }
  } else if (rawUrl.startsWith('javascript:') || rawUrl.startsWith('data:')) {
    // Blokir eksekusi kode
    targetUrl = PORTAL + BASE + '/';
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
