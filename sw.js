// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v7.0 — DINONAKTIFKAN SEMENTARA (pass-through murni)
// ============================================================
//
//  Cache Storage di WebKit/Safari memiliki bug deadlock: operasi
//  cache.add() saat install bisa bertabrakan dengan caches.match()/
//  cache.put() saat fetch (bahkan pada nama cache & URL yang berbeda),
//  membuat request (font, auth Supabase, HTML) macet "pending" selamanya
//  dan halaman freeze di layar loading — sudah 2x menyebabkan login
//  gagal total. Daripada terus menambal kucing-kucingan dengan bug
//  WebKit yang sulit diprediksi, SW ini untuk sementara dibuat TIDAK
//  mencegat/cache apapun — murni pass-through ke network — sekaligus
//  membersihkan registrasi & cache lama agar versi baru terpasang bersih.
//
//  Fitur PWA offline-cache dimatikan sementara; push notification TETAP
//  jalan (handler di bawah tidak bergantung pada Cache Storage).
// ============================================================

self.addEventListener('install', function(e) {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    Promise.all([
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      }),
      self.clients.claim(),
    ])
  );
});

// Tidak ada fetch handler — semua request lewat langsung ke network,
// browser menangani HTTP cache secara native seperti website biasa.


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
