// ============================================================
//  sw.js — Service Worker
//  Portal Halaqah Rattililqur'an
//  Versi: 1.0.0
//  Strategi: Cache-First untuk aset statis,
//            Network-First untuk panggilan API GAS.
// ============================================================

const APP_VERSION   = 'v1.0.0';
const CACHE_STATIC  = `halaqah-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `halaqah-dynamic-${APP_VERSION}`;

// ─── Aset yang di-cache saat install ───
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/utils.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  // Halaman portal
  '/admin/index.html',
  '/guru/index.html',
  '/murid/index.html',
  // Google Fonts (offline fallback)
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Amiri:wght@400;700&display=swap',
];

// ─── Daftar origin API (tidak di-cache agresif) ───
const API_ORIGINS = [
  'script.google.com',
  'script.googleusercontent.com',
];


// ════════════════════════════════════════════════
//  INSTALL — pre-cache aset statis
// ════════════════════════════════════════════════
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${APP_VERSION}…`);
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      // addAll gagal total jika satu URL error — gunakan loop aman
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Gagal cache: ${url}`, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Pre-cache selesai');
      return self.skipWaiting(); // aktifkan SW baru langsung
    })
  );
});


// ════════════════════════════════════════════════
//  ACTIVATE — hapus cache lama
// ════════════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${APP_VERSION}…`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => {
            console.log('[SW] Menghapus cache lama:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});


// ════════════════════════════════════════════════
//  FETCH — strategi per jenis request
// ════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan request non-GET & chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // ── 1. API Google Apps Script → Network-First ──
  if (API_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── 2. Font Google → Cache-First dengan fallback ──
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // ── 3. Aset statis (HTML, CSS, JS, gambar) → Cache-First ──
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // ── 4. Navigasi (HTML pages) → Network-First + fallback ──
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // ── 5. Default → Cache-First dengan dynamic cache ──
  event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
});


// ════════════════════════════════════════════════
//  STRATEGI CACHE
// ════════════════════════════════════════════════

/** Cache-First: ambil dari cache, fallback ke network & simpan. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

/** Network-First: coba network, fallback ke cache. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

/** Navigasi: network dulu, fallback ke index.html jika offline. */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Offline: kembalikan halaman yang relevan dari cache
    const urlPath = new URL(request.url).pathname;
    const pages   = ['/admin/index.html', '/guru/index.html', '/murid/index.html', '/index.html'];
    for (const page of pages) {
      if (urlPath.startsWith(page.replace('/index.html', ''))) {
        const cached = await caches.match(page);
        if (cached) return cached;
      }
    }
    const fallback = await caches.match('/index.html');
    return fallback || offlineFallback(request);
  }
}

/** Respons fallback saat benar-benar offline dan tidak ada cache. */
function offlineFallback(request) {
  if (request.headers.get('Accept')?.includes('text/html')) {
    return new Response(`
      <!DOCTYPE html>
      <html lang="id">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Offline — Halaqah</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #061a36; color: #fff;
               display: flex; align-items: center; justify-content: center;
               min-height: 100dvh; flex-direction: column; gap: 16px; padding: 24px; text-align: center; }
        .icon { font-size: 56px; }
        h1 { font-size: 22px; font-weight: 700; }
        p  { font-size: 14px; color: rgba(255,255,255,0.6); max-width: 280px; line-height: 1.6; }
        button { padding: 12px 28px; border-radius: 100px; border: none; cursor: pointer;
                 background: #2a8de0; color: #fff; font-size: 14px; font-weight: 600;
                 margin-top: 8px; }
      </style></head>
      <body>
        <div class="icon">📵</div>
        <h1>Tidak Ada Koneksi</h1>
        <p>Periksa koneksi internet Anda, lalu coba lagi.</p>
        <button onclick="location.reload()">Coba Lagi</button>
      </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}


// ════════════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════════════

function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico)$/i.test(url.pathname);
}


// ════════════════════════════════════════════════
//  BACKGROUND SYNC (opsional — untuk POST offline)
// ════════════════════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === 'sync-kbm') {
    event.waitUntil(syncPendingKBM());
  }
  if (event.tag === 'sync-absensi') {
    event.waitUntil(syncPendingAbsensi());
  }
});

async function syncPendingKBM() {
  console.log('[SW] Background sync: KBM pending');
  // TODO: baca dari IndexedDB dan POST ke GAS
  // const pending = await idb.getAll('pending-kbm');
  // for (const item of pending) { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(item) }); }
}

async function syncPendingAbsensi() {
  console.log('[SW] Background sync: Absensi pending');
  // TODO: implementasi serupa
}


// ════════════════════════════════════════════════
//  PUSH NOTIFICATION (opsional)
// ════════════════════════════════════════════════
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Halaqah Rattililqur\'an', {
      body:    data.body    || 'Ada notifikasi baru.',
      icon:    '/assets/icons/icon-192.png',
      badge:   '/assets/icons/icon-96.png',
      tag:     data.tag     || 'halaqah-notif',
      data:    data.url     || '/',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data || '/');
    })
  );
});

console.log('[SW] Service Worker Halaqah loaded:', APP_VERSION);
