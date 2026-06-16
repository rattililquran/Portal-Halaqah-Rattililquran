// ============================================================
//  Push Permission Manager — Rattililqur'an
//  Include di semua portal setelah supabase-client.js
// ============================================================

(function() {
'use strict';

// ── Config ───────────────────────────────────────────────────
var STORAGE_KEY_DISMISSED  = 'push_prompt_dismissed';
var STORAGE_KEY_SUBSCRIBED = 'push_subscribed';
var DISMISS_DAYS           = 30; // tanya lagi setelah 30 hari jika di-skip

// ── CSS dialog ───────────────────────────────────────────────
var STYLE = `
#push-dialog-overlay {
  position:fixed;inset:0;z-index:10000;
  background:rgba(15,23,42,.55);backdrop-filter:blur(8px);
  display:flex;align-items:flex-end;justify-content:center;
  padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));
  animation:pushFadeIn .3s ease;
}
@keyframes pushFadeIn{from{opacity:0}to{opacity:1}}
#push-dialog {
  background:#fff;border-radius:24px;width:100%;max-width:440px;
  box-shadow:0 24px 64px rgba(15,23,42,.25);overflow:hidden;
}
.push-header {
  background:linear-gradient(135deg,#0c4a6e,#0ea5e9);
  padding:20px 20px 16px;position:relative;
}
.push-header-ico {
  width:52px;height:52px;background:rgba(255,255,255,.15);
  border-radius:16px;display:flex;align-items:center;justify-content:center;
  font-size:26px;margin-bottom:10px;
}
.push-header-title {
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:16px;font-weight:800;color:#fff;margin-bottom:4px;
}
.push-header-sub {
  font-size:12.5px;color:rgba(255,255,255,.8);font-weight:500;line-height:1.5;
}
.push-body { padding:18px 20px 20px; }
.push-benefits { display:flex;flex-direction:column;gap:8px;margin-bottom:16px; }
.push-benefit-item {
  display:flex;align-items:flex-start;gap:10px;
  background:#f8fafc;border-radius:10px;padding:10px 12px;
}
.push-benefit-ico { font-size:18px;flex-shrink:0;margin-top:1px }
.push-benefit-text { font-size:12.5px;color:#334155;line-height:1.55 }
.push-benefit-text strong { color:#0f172a;font-weight:700 }

.push-warning {
  background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
  padding:10px 12px;margin-bottom:16px;
  display:flex;align-items:flex-start;gap:8px;
}
.push-warning-text { font-size:12px;color:#92400e;line-height:1.6 }
.push-warning-text strong { display:block;font-weight:700;margin-bottom:2px }

.push-actions { display:flex;flex-direction:column;gap:8px }
.push-btn-allow {
  width:100%;padding:14px;border:none;border-radius:14px;
  background:linear-gradient(135deg,#0284c7,#0369a1);
  color:#fff;font-family:inherit;font-size:14px;font-weight:800;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
  box-shadow:0 4px 16px rgba(2,132,199,.35);
  transition:opacity .2s;
}
.push-btn-allow:hover{opacity:.9}
.push-btn-allow:disabled{opacity:.6;cursor:not-allowed}
.push-btn-skip {
  width:100%;padding:10px;border:none;background:none;
  color:#94a3b8;font-family:inherit;font-size:12.5px;font-weight:600;
  cursor:pointer;transition:color .2s;
}
.push-btn-skip:hover{color:#64748b}
.push-privacy-note {
  text-align:center;font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.5;
}
html.theme-dark #push-dialog{background:#111c30}
html.theme-dark .push-benefit-item{background:#0d1f35}
html.theme-dark .push-benefit-text{color:#94a3b8}
html.theme-dark .push-benefit-text strong{color:#f0f4ff}
html.theme-dark .push-privacy-note{color:#4a5568}

.push-steps{display:flex;flex-direction:column;gap:11px;margin-bottom:16px}
.push-step{display:flex;align-items:flex-start;gap:12px}
.push-step-num{
  flex-shrink:0;width:26px;height:26px;border-radius:50%;
  background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;
  font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;
}
.push-step-text{font-size:13px;color:#334155;line-height:1.5;padding-top:2px}
.push-step-text strong{color:#0f172a;font-weight:700}
.push-step-text .push-ico-inline{
  display:inline-flex;align-items:center;justify-content:center;
  width:20px;height:20px;border-radius:5px;background:#e0f2fe;
  font-size:13px;vertical-align:-4px;margin:0 1px;
}
html.theme-dark .push-step-text{color:#94a3b8}
html.theme-dark .push-step-text strong{color:#f0f4ff}
html.theme-dark .push-step-text .push-ico-inline{background:#0d2a45}

#ob-overlay{
  position:fixed;inset:0;z-index:10001;
  background:rgba(15,23,42,.55);backdrop-filter:blur(8px);
  display:flex;align-items:flex-end;justify-content:center;
  padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));
  animation:pushFadeIn .3s ease;
}
#ob-card{
  background:#fff;border-radius:24px;width:100%;max-width:440px;
  box-shadow:0 24px 64px rgba(15,23,42,.25);overflow:hidden;
}
html.theme-dark #ob-card{background:#111c30}
.ob-msg{font-size:13.5px;color:#334155;line-height:1.6;white-space:pre-wrap;margin-bottom:16px}
html.theme-dark .ob-msg{color:#94a3b8}
`;

// ── Inject CSS ────────────────────────────────────────────────
function injectStyle() {
  if (document.getElementById('push-style')) return;
  var s = document.createElement('style');
  s.id = 'push-style'; s.textContent = STYLE;
  document.head.appendChild(s);
}

// ── Deteksi lingkungan perangkat ─────────────────────────────
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ menyamar sebagai Macintosh; bedakan via touch points
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true; // iOS Safari home-screen
}

// Tentukan kondisi pengguna agar dialog menampilkan instruksi yang TEPAT:
//  'ios-install' = iPhone/iPad belum dipasang ke Layar Utama → push mustahil
//                  sebelum install (penyebab utama "kesusahan aktifkan")
//  'denied'      = izin pernah ditolak → browser tak bisa di-prompt lagi,
//                  harus lewat setelan (kalau diam saja = buntu permanen)
//  'granted'     = izin sudah diberikan
//  'unsupported' = browser tak mendukung push (selain kasus iOS di atas)
//  'ask'         = siap diminta izin secara normal
function getPushState() {
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!window.HQ || !window.HQ.PushAPI || !window.HQ.PushAPI.isSupported()) return 'unsupported';
  var perm = window.HQ.PushAPI.getPermissionStatus();
  if (perm === 'denied')  return 'denied';
  if (perm === 'granted') return 'granted';
  return 'ask';
}

// ── Konten dialog: state 'ask' (ajakan normal) ───────────────
function contentAsk(roleLabel) {
  var benefits = [
    { ico:'⏰', text:'<strong>Reminder jadwal KBM</strong> sehari sebelumnya — tidak perlu khawatir lupa lagi' },
    { ico:'📢', text:'<strong>Pengumuman penting</strong> langsung muncul di HP meski aplikasi ditutup' },
    { ico:'📄', text:'<strong>Raport baru dipublish</strong> — kamu langsung tahu tanpa perlu cek portal terus' },
    { ico:'✏️', text:'<strong>Deadline latihan mandiri</strong> — pengingat sehari sebelum batas waktu' },
  ];
  if (roleLabel === 'admin') {
    benefits = [
      { ico:'💳', text:'<strong>Konfirmasi SPP masuk</strong> — validasi cepat tanpa murid menunggu lama' },
      { ico:'📊', text:'<strong>Rekap harian</strong> — ringkasan aktivitas setiap malam jam 21.00' },
      { ico:'📢', text:'<strong>Pengumuman penting</strong> dari tim langsung ke HP' },
    ];
  } else if (roleLabel === 'guru') {
    benefits = [
      { ico:'⏰', text:'<strong>Pengingat jadwal KBM</strong> pagi hari sebelum mengajar' },
      { ico:'📢', text:'<strong>Pengumuman penting</strong> dari admin langsung ke HP' },
      { ico:'🚨', text:'<strong>Murid kritis</strong> — notif saat murid halaqahmu alpa berulang' },
      { ico:'⚠️', text:'<strong>Draft KBM</strong> — pengingat jika sesi belum ditutup setelah 2 jam' },
    ];
  }
  return `
    <div class="push-header">
      <div class="push-header-ico">🔔</div>
      <div class="push-header-title">Aktifkan Notifikasi Portal</div>
      <div class="push-header-sub">Agar kamu tidak ketinggalan hal-hal penting dari Rattililqur'an</div>
    </div>
    <div class="push-body">
      <div class="push-benefits">
        ${benefits.map(b => `
          <div class="push-benefit-item">
            <div class="push-benefit-ico">${b.ico}</div>
            <div class="push-benefit-text">${b.text}</div>
          </div>
        `).join('')}
      </div>
      <div class="push-warning">
        <div style="font-size:18px;flex-shrink:0">⚠️</div>
        <div class="push-warning-text">
          <strong>Jika kamu menolak izin notifikasi:</strong>
          Kamu tidak akan mendapat pengingat jadwal KBM, info pengumuman, atau notif raport baru.
          Kamu harus buka portal secara manual untuk mengecek pembaruan.
          Izin bisa diaktifkan kembali nanti melalui pengaturan browser.
        </div>
      </div>
      <div class="push-actions">
        <button class="push-btn-allow" id="pushBtnAllow" onclick="window._pushAllow()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Ya, Aktifkan Notifikasi
        </button>
        <button class="push-btn-skip" onclick="window._pushSkip()">Nanti Saja</button>
        <div class="push-privacy-note">
          🔒 Notifikasi hanya dari portal Rattililqur'an.<br>
          Tidak ada iklan. Bisa dimatikan kapan saja.
        </div>
      </div>
    </div>
  `;
}

// ── Konten dialog: state 'ios-install' (iPhone belum dipasang) ─
function contentIosInstall() {
  return `
    <div class="push-header">
      <div class="push-header-ico">📲</div>
      <div class="push-header-title">Pasang Portal Dulu, Yuk</div>
      <div class="push-header-sub">Di iPhone/iPad, notifikasi hanya bisa aktif setelah portal ditambahkan ke Layar Utama</div>
    </div>
    <div class="push-body">
      <div class="push-steps">
        <div class="push-step">
          <div class="push-step-num">1</div>
          <div class="push-step-text">Ketuk ikon <span class="push-ico-inline">⎙</span> <strong>Bagikan</strong> di bagian bawah Safari (di iPad ada di kanan atas).</div>
        </div>
        <div class="push-step">
          <div class="push-step-num">2</div>
          <div class="push-step-text">Gulir, lalu pilih <strong>"Tambahkan ke Layar Utama"</strong>.</div>
        </div>
        <div class="push-step">
          <div class="push-step-num">3</div>
          <div class="push-step-text">Buka portal dari <strong>ikon baru di Layar Utama</strong> (bukan dari Safari), lalu aktifkan notifikasi dari sana.</div>
        </div>
      </div>
      <div class="push-warning">
        <div style="font-size:18px;flex-shrink:0">💡</div>
        <div class="push-warning-text">
          <strong>Kenapa harus dipasang?</strong>
          Ini aturan Apple — notifikasi web di iPhone hanya jalan kalau portal dibuka sebagai aplikasi (dari Layar Utama), bukan dari tab Safari.
        </div>
      </div>
      <div class="push-actions">
        <button class="push-btn-allow" onclick="window._pushOpenInstall()">
          📖 Lihat Panduan Lengkap (dengan Gambar)
        </button>
        <button class="push-btn-skip" onclick="window._pushSkip()">Nanti Saja</button>
      </div>
    </div>
  `;
}

// ── Konten dialog: state 'denied' (izin diblokir) ────────────
function contentDenied() {
  var ua = navigator.userAgent;
  var steps;
  if (isIOS()) {
    steps = [
      'Buka <strong>Setelan</strong> iPhone → gulir cari <strong>"Rattililqur\'an"</strong> (atau nama portal).',
      'Ketuk <strong>Notifikasi</strong>, lalu nyalakan <strong>"Izinkan Notifikasi"</strong>.',
      'Kembali ke portal dan tekan tombol di bawah.',
    ];
  } else if (/Android/.test(ua)) {
    steps = [
      'Ketuk ikon <span class="push-ico-inline">⋮</span> menu Chrome → <strong>Setelan situs</strong> (Site settings).',
      'Pilih <strong>Notifikasi</strong> → ubah dari "Diblokir" menjadi <strong>"Izinkan"</strong>.',
      'Kembali ke portal dan tekan tombol di bawah.',
    ];
  } else {
    steps = [
      'Klik ikon <span class="push-ico-inline">🔒</span> gembok di kiri kolom alamat browser.',
      'Cari <strong>Notifikasi</strong> → ubah menjadi <strong>"Izinkan"</strong> (Allow).',
      'Muat ulang halaman, lalu tekan tombol di bawah.',
    ];
  }
  return `
    <div class="push-header" style="background:linear-gradient(135deg,#7c2d12,#ea580c)">
      <div class="push-header-ico">🔕</div>
      <div class="push-header-title">Notifikasi Sedang Diblokir</div>
      <div class="push-header-sub">Izin notifikasi pernah ditolak. Ikuti langkah berikut untuk mengaktifkannya kembali.</div>
    </div>
    <div class="push-body">
      <div class="push-steps">
        ${steps.map((s, i) => `
          <div class="push-step">
            <div class="push-step-num">${i + 1}</div>
            <div class="push-step-text">${s}</div>
          </div>
        `).join('')}
      </div>
      <div class="push-actions">
        <button class="push-btn-allow" id="pushBtnAllow" onclick="window._pushRetry()">
          🔄 Saya Sudah Aktifkan — Coba Lagi
        </button>
        <button class="push-btn-skip" onclick="window._pushSkip()">Tutup</button>
      </div>
    </div>
  `;
}

// ── Konten dialog: state 'unsupported' ───────────────────────
function contentUnsupported() {
  return `
    <div class="push-header" style="background:linear-gradient(135deg,#334155,#64748b)">
      <div class="push-header-ico">🚫</div>
      <div class="push-header-title">Browser Belum Mendukung</div>
      <div class="push-header-sub">Notifikasi web belum tersedia di browser ini</div>
    </div>
    <div class="push-body">
      <div class="push-warning">
        <div style="font-size:18px;flex-shrink:0">💡</div>
        <div class="push-warning-text">
          Coba buka portal lewat <strong>Google Chrome</strong> (Android/desktop) atau <strong>Safari</strong> terbaru (iPhone) lalu pasang ke Layar Utama. Sementara itu, cek pembaruan langsung di portal lewat ikon lonceng 🔔.
        </div>
      </div>
      <div class="push-actions">
        <button class="push-btn-skip" onclick="window._pushSkip()">Mengerti</button>
      </div>
    </div>
  `;
}

// ── Pilih konten sesuai state & render ───────────────────────
function dialogInner(state, roleLabel) {
  if (state === 'ios-install') return contentIosInstall();
  if (state === 'denied')      return contentDenied();
  if (state === 'unsupported') return contentUnsupported();
  return contentAsk(roleLabel);
}

function showDialog(state, roleLabel) {
  injectStyle();
  removeDialog();
  var overlay = document.createElement('div');
  overlay.id  = 'push-dialog-overlay';
  overlay.innerHTML = '<div id="push-dialog">' + dialogInner(state, roleLabel) + '</div>';
  document.body.appendChild(overlay);
}

// ── Hapus dialog ─────────────────────────────────────────────
function removeDialog() {
  var el = document.getElementById('push-dialog-overlay');
  if (el) el.remove();
}

// ── Aksi tombol ──────────────────────────────────────────────
window._pushAllow = async function() {
  var btn = document.getElementById('pushBtnAllow');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
  try {
    await window.HQ.PushAPI.subscribe();
    localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
    removeDialog();
    // Toast sukses
    if (typeof toast === 'function') toast('🔔 Notifikasi berhasil diaktifkan!', 'ok');
  } catch(e) {
    console.warn('Push subscribe error:', e);
    console.warn('Error name:', e && e.name);
    console.warn('Error msg:', e && e.message);
    console.warn('HQ loaded:', typeof window.HQ);
    if (btn) {
      btn.disabled = false;
      // Tampilkan detail error agar bisa didiagnosis
      var errName = (e && e.name) || 'Unknown';
      var errMsg  = (e && e.message) ? e.message.slice(0,40) : 'no message';
      btn.innerHTML = '❌ ' + errName + ': ' + errMsg;
    }
  }
};

// Buka panduan install (untuk state iOS belum dipasang)
window._pushOpenInstall = function() {
  window.open('../panduan-install.html', '_blank');
  // Jangan tutup dialog & jangan set timer skip — biar murid bisa ikuti langkah
  // sambil dialog tetap terlihat saat kembali. Cukup biarkan terbuka.
};

// Coba ulang setelah murid mengaktifkan izin lewat setelan (state 'denied')
window._pushRetry = async function() {
  var btn = document.getElementById('pushBtnAllow');
  if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa...'; }
  // Browser tak akan memunculkan prompt lagi saat 'denied'; subscribe() hanya
  // berhasil jika murid sudah mengubahnya ke "Izinkan" di setelan.
  if (window.HQ.PushAPI.getPermissionStatus() === 'denied') {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '⚠️ Masih diblokir — selesaikan langkah di atas dulu';
    }
    return;
  }
  try {
    await window.HQ.PushAPI.subscribe();
    localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
    removeDialog();
    if (typeof toast === 'function') toast('🔔 Notifikasi berhasil diaktifkan!', 'ok');
  } catch(e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Coba Lagi'; }
  }
};

window._pushSkip = function() {
  localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now()));
  removeDialog();
};

// ── Entry point otomatis: tampilkan dialog setelah login ─────
window.initPushPrompt = function(roleLabel) {
  var state = getPushState();

  // Sudah granted: pastikan subscription browser masih ada (localStorage bisa
  // stale jika data browser dibersihkan). Jika hilang → reset agar muncul lagi.
  if (state === 'granted') {
    if (window.HQ && window.HQ.PushAPI) {
      window.HQ.PushAPI.getActiveSubscription().then(function(sub) {
        if (!sub && localStorage.getItem(STORAGE_KEY_SUBSCRIBED) === 'true') {
          localStorage.removeItem(STORAGE_KEY_SUBSCRIBED);
          localStorage.removeItem(STORAGE_KEY_DISMISSED);
        }
      }).catch(function(){});
    }
    return;
  }
  // Browser tak didukung (non-iOS): jangan ganggu otomatis.
  if (state === 'unsupported') return;
  // Sudah pernah subscribe & memang siap-tanya → jangan ganggu.
  if (state === 'ask' && localStorage.getItem(STORAGE_KEY_SUBSCRIBED) === 'true') return;

  // Hormati timer "Nanti Saja" (30 hari) untuk popup OTOMATIS.
  var dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISSED);
  if (dismissedAt) {
    var daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 86400);
    if (daysSince < DISMISS_DAYS) return;
  }

  // Tunda 3 detik agar tidak langsung popup saat buka halaman.
  setTimeout(function() {
    if (document.getElementById('push-dialog-overlay')) return;
    if (document.getElementById('ob-overlay')) return; // jangan tumpuk di atas onboarding
    showDialog(state, roleLabel || 'murid');
  }, 3000);
};

// ── Entry point PERMANEN: dipanggil dari tombol "Aktifkan" di portal ─
// Selalu buka (abaikan timer skip) & tampilkan instruksi sesuai kondisi.
window.openPushDialog = function(roleLabel) {
  var state = getPushState();
  if (state === 'granted') {
    // Sudah granted: kalau subscription ada, cukup beri tahu; kalau hilang,
    // tawarkan aktifkan ulang lewat dialog normal.
    if (window.HQ && window.HQ.PushAPI) {
      window.HQ.PushAPI.getActiveSubscription().then(function(sub) {
        if (sub) { if (typeof toast === 'function') toast('🔔 Notifikasi sudah aktif di perangkat ini', 'ok'); }
        else showDialog('ask', roleLabel || 'murid');
      }).catch(function(){ showDialog('ask', roleLabel || 'murid'); });
    }
    return;
  }
  showDialog(state, roleLabel || 'murid');
};

// ── Handle pesan dari Service Worker ─────────────────────────
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', function(e) {
  if (!e.data) return;

  // Re-subscribe saat subscription berubah
  if (e.data.type === 'PUSH_SUBSCRIPTION_CHANGED' && e.data.subscription) {
    // Guard: tunggu window.HQ siap (maks 5 detik)
    var attempts = 0;
    var tryResubscribe = function() {
      if (window.HQ && window.HQ.PushAPI && window.HQ.getCurrentUser && window.HQ.getCurrentUser()) {
        window.HQ.PushAPI._saveSubscription(e.data.subscription)
          .catch(function(err) { console.warn('Re-subscribe failed:', err); });
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryResubscribe, 500);
      }
    };
    tryResubscribe();
  }

  // Navigasi ke URL dari notifikasi (fallback untuk Firefox/Safari)
  if (e.data.type === 'PUSH_NAVIGATE' && e.data.url) {
    var url = e.data.url;
    if (url && url !== window.location.pathname) {
      window.location.href = url;
    }
  }
});

// ============================================================
//  Pengumuman Onboarding — popup admin-editable saat login
// ============================================================
function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

var _obCtx = null;

function _obMarkSeen() {
  if (!_obCtx || _obCtx.preview) return; // pratinjau admin tak menandai
  try {
    var u   = window.HQ && window.HQ.getCurrentUser && window.HQ.getCurrentUser();
    var uid = (u && u.id_user) || 'anon';
    var stamp = (_obCtx.cfg && _obCtx.cfg.updated_at) ? String(_obCtx.cfg.updated_at) : '1';
    localStorage.setItem('onboarding_seen_' + uid, stamp);
  } catch (_) {}
}

window._obClose = function() {
  _obMarkSeen();
  var el = document.getElementById('ob-overlay'); if (el) el.remove();
};

window._obCta = function() {
  var ctx = _obCtx;
  _obMarkSeen();
  var el = document.getElementById('ob-overlay'); if (el) el.remove();
  // Satu-satunya aksi yang didukung saat ini: buka dialog aktivasi notifikasi.
  if (ctx && ctx.cfg && ctx.cfg.cta_action === 'push' && typeof window.openPushDialog === 'function') {
    window.openPushDialog(ctx.roleLabel);
  }
};

// Render popup. isPreview=true dipakai admin untuk pratinjau (abaikan "sudah dilihat").
window.renderOnboardingPopup = function(cfg, roleLabel, isPreview) {
  if (!cfg) return;
  injectStyle();
  var old = document.getElementById('ob-overlay'); if (old) old.remove();

  var ctaBtn = '';
  if (cfg.cta_action && cfg.cta_label) {
    ctaBtn = '<button class="push-btn-allow" onclick="window._obCta()">' + _escHtml(cfg.cta_label) + '</button>';
  }
  var overlay = document.createElement('div');
  overlay.id = 'ob-overlay';
  overlay.innerHTML =
    '<div id="ob-card">' +
      '<div class="push-header">' +
        '<div class="push-header-ico">📣</div>' +
        '<div class="push-header-title">' + _escHtml(cfg.judul) + '</div>' +
      '</div>' +
      '<div class="push-body">' +
        '<div class="ob-msg">' + _escHtml(cfg.pesan) + '</div>' +
        '<div class="push-actions">' +
          ctaBtn +
          '<button class="push-btn-skip" onclick="window._obClose()">' + (ctaBtn ? 'Nanti Saja' : 'Mengerti') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  _obCtx = { cfg: cfg, roleLabel: roleLabel || 'murid', preview: !!isPreview };
};

// Cek apakah perangkat ini SUDAH punya notifikasi aktif (izin granted +
// subscription aktif). Dipakai untuk opsi "hanya tampilkan ke yang belum aktif".
function hasActivePush() {
  return new Promise(function(resolve) {
    var P = window.HQ && window.HQ.PushAPI;
    if (!P || P.getPermissionStatus() !== 'granted') return resolve(false);
    P.getActiveSubscription().then(function(sub) { resolve(!!sub); }).catch(function() { resolve(false); });
  });
}

// Entry point: cek config & tampilkan popup sekali per (versi config × user).
window.initOnboarding = function(roleLabel) {
  if (!window.HQ || !window.HQ.AdminAPI || !window.HQ.AdminAPI.getOnboarding) return;
  window.HQ.AdminAPI.getOnboarding().then(function(r) {
    var cfg = r && r.data;
    if (!cfg || !cfg.enabled || !cfg.judul) return;
    var role = roleLabel || 'murid';
    if (cfg.target_role !== 'all' && cfg.target_role !== role) return;

    var u   = window.HQ.getCurrentUser && window.HQ.getCurrentUser();
    var uid = (u && u.id_user) || 'anon';
    var stamp = cfg.updated_at ? String(cfg.updated_at) : '1';
    if (localStorage.getItem('onboarding_seen_' + uid) === stamp) return; // sudah lihat versi ini

    // Opsi targeting: lewati user yang notifikasinya sudah aktif.
    var gate = cfg.only_unsubscribed ? hasActivePush() : Promise.resolve(false);
    gate.then(function(sudahAktif) {
      if (sudahAktif) return; // sudah aktif & admin minta hanya yang belum → lewati
      setTimeout(function() {
        if (document.getElementById('ob-overlay')) return;
        window.renderOnboardingPopup(cfg, role, false);
      }, 1500);
    });
  }).catch(function(){});
};

})();
