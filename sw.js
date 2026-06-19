// ============================================================
//  Service Worker — Portal Halaqah Rattililqur'an
//  Cache version: v8.2 — caching konservatif, percobaan terbatas
// ============================================================
//
//  RIWAYAT: SW ini sempat dicurigai 2x sebagai biang login freeze
//  (deadlock Cache Storage WebKit/Safari). Setelah investigasi lebih
//  dalam, akar masalah SEBENARNYA adalah infinite loop di kode lain
//  (MutationObserver fitur nomor tabel — sudah diperbaiki terpisah),
//  BUKAN di Cache Storage / SW ini. Namun karena WebKit Cache Storage
//  tetap dikenal sebagai API yang historisnya rapuh, desain v8.0 ini
//  dibuat SANGAT KONSERVATIF untuk meminimalkan risiko:
//
//   1. TIDAK precache apapun saat install — meniadakan kemungkinan
//      cache.add() (install) bertabrakan dengan cache.put() (fetch)
//      di window waktu yang sama (race condition utama versi lama).
//   2. HANYA mencegat aset statis SAME-ORIGIN di /assets/ (font,
//      gambar, css) dengan stale-while-revalidate.
//   3. Halaman HTML (index/guru/murid/admin) & SEMUA request
//      cross-origin (Supabase API, font CDN Google) TIDAK PERNAH
//      dicegat — selalu langsung ke network seperti website biasa.
//      (Auth/login harus selalu fresh dari network, tidak boleh
//      tersangkut logika cache apapun.)
//   4. Method selain GET tidak pernah disentuh.
//
//  STATUS: PERCOBAAN — pantau beberapa hari di berbagai browser
//  (terutama Safari/WebKit) sebelum dianggap final. Jika muncul lagi
//  gejala "freeze di layar loading" / request font|auth pending,
//  unregister SW ini dan kembali ke versi pass-through (v7.0).
// ============================================================

const CACHE_NAME = 'halaqah-v8.2';
const BASE       = '/Portal-Halaqah-Rattililquran';

self.addEventListener('install', function(e) {
  // Sengaja TIDAK precache apapun — cache hanya terisi secara
  // bertahap saat aset benar-benar diminta (lihat fetch handler).
  e.waitUntil(self.skipWaiting());
});

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

self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = req.url;

  // Hanya GET yang boleh disentuh — POST/PUT/PATCH selalu lewat network.
  if (req.method !== 'GET') return;

  // Hanya same-origin /assets/ (font lokal, gambar, css) yang di-cache.
  // Halaman HTML, Supabase API, font CDN Google — semua dilewatkan
  // begitu saja agar selalu fresh dari network (terutama untuk auth/login).
  var isSameOriginAsset = url.indexOf(self.location.origin) === 0
    && url.indexOf(BASE + '/assets/') !== -1;
  if (!isSameOriginAsset) return;

  // Stale-While-Revalidate: tampilkan dari cache jika ada (instan),
  // sambil ambil versi terbaru di background untuk request berikutnya.
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(req).then(function(cached) {
        var networkFetch = fetch(req).then(function(res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function() { return cached; });
        return cached || networkFetch;
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
