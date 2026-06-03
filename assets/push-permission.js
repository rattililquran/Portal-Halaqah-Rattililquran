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
`;

// ── Inject CSS ────────────────────────────────────────────────
function injectStyle() {
  if (document.getElementById('push-style')) return;
  var s = document.createElement('style');
  s.id = 'push-style'; s.textContent = STYLE;
  document.head.appendChild(s);
}

// ── Buat dialog HTML ─────────────────────────────────────────
function createDialog(roleLabel) {
  var overlay = document.createElement('div');
  overlay.id  = 'push-dialog-overlay';

  // Benefits disesuaikan per role
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

  overlay.innerHTML = `
    <div id="push-dialog">
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
    </div>
  `;
  return overlay;
}

// ── Hapus dialog ─────────────────────────────────────────────
function removeDialog() {
  var el = document.getElementById('push-dialog-overlay');
  if (el) el.remove();
}

// ── Cek apakah sudah waktunya tampilkan prompt ────────────────
function shouldShowPrompt() {
  if (!window.HQ || !window.HQ.PushAPI) return false;
  if (!window.HQ.PushAPI.isSupported()) return false;
  if (window.HQ.PushAPI.getPermissionStatus() === 'denied') return false;
  if (window.HQ.PushAPI.getPermissionStatus() === 'granted') return false;
  if (localStorage.getItem(STORAGE_KEY_SUBSCRIBED) === 'true') return false;

  var dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISSED);
  if (dismissedAt) {
    var daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 86400);
    if (daysSince < DISMISS_DAYS) return false;
  }
  return true;
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
    if (btn) {
      btn.disabled = false;
      // Cek jenis error untuk pesan yang tepat
      var msg = '⚠️ Gagal — coba lagi';
      if (e && e.name === 'NotAllowedError') {
        msg = '🚫 Izin ditolak — aktifkan di pengaturan browser';
      } else if (e && (e.name === 'AbortError' || (e.message && e.message.includes('push service')))) {
        msg = '🔄 Coba lagi (refresh halaman dulu)';
      }
      btn.innerHTML = msg;
    }
  }
};

window._pushSkip = function() {
  localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now()));
  removeDialog();
};

// ── Entry point: tampilkan dialog setelah login ───────────────
window.initPushPrompt = function(roleLabel) {
  if (!shouldShowPrompt()) return;

  // Tunda 3 detik agar tidak langsung popup saat buka halaman
  setTimeout(function() {
    if (document.getElementById('push-dialog-overlay')) return;
    injectStyle();
    var dialog = createDialog(roleLabel || 'murid');
    document.body.appendChild(dialog);
  }, 3000);
};

// ── Re-subscribe saat subscription berubah ───────────────────
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'PUSH_SUBSCRIPTION_CHANGED' && e.data.subscription) {
    window.HQ && window.HQ.PushAPI && window.HQ.PushAPI._saveSubscription(e.data.subscription)
      .catch(function(err) { console.warn('Re-subscribe failed:', err); });
  }
});

})();
