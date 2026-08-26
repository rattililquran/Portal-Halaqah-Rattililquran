/**
 * murid/khatamku-popup-module.js
 * Popup progres KhatamKu otomatis saat buka aplikasi — Portal Murid Rattililqur'an.
 * Non-blocking (ajakan, bukan aksi wajib) -- gaya visual senada dgn
 * assets/popup-notifikasi.js, tapi modul terpisah krn kontennya data
 * personal KhatamKu (dinamis per-user), bukan konten dakwah admin-editable.
 */
(function() {
  'use strict';

  var STYLE = `
#kp-card {
  position:fixed; z-index:8900;
  top:50%; left:50%; transform:translate(-50%,-50%);
  width:calc(100% - 2.4rem); max-width:400px;
  max-height:calc(100vh - 3rem); overflow-x:hidden; overflow-y:auto;
  background:var(--card-solid); border-radius:20px;
  box-shadow:0 28px 72px rgba(15,23,42,.35);
  animation:kpPopIn .3s ease;
}
@keyframes kpPopIn{from{opacity:0;transform:translate(-50%,-50%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
#kp-card .kp-head{background:linear-gradient(135deg,#0c4a6e,#0ea5e9);padding:18px 46px 16px 20px;position:relative}
#kp-card .kp-close{position:absolute;top:10px;right:10px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
#kp-card .kp-close:hover{background:rgba(255,255,255,.3)}
#kp-card .kp-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:800;color:#fff;padding-right:4px}
#kp-card .kp-body{padding:18px 20px 20px}
#kp-card .kp-sub{font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:14px}
#kp-card .kp-cta{display:block;width:100%;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-family:inherit;font-size:15px;font-weight:800;text-align:center;cursor:pointer;box-sizing:border-box}
`;

  function injectStyle() {
    if (document.getElementById('kp-style')) return;
    var s = document.createElement('style');
    s.id = 'kp-style'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function _kpUid() {
    var u = window.HQ && window.HQ.getCurrentUser && window.HQ.getCurrentUser();
    return (u && u.id_user) || 'anon';
  }

  // Tanggal WIB (bukan UTC) -- "sekali per hari" harus ikut kalender lokal.
  function todayWIB() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // en-CA -> YYYY-MM-DD
  }

  function seenKey() { return 'khatamku_popup_seen_' + _kpUid() + '_' + todayWIB(); }
  function markSeenToday() { try { localStorage.setItem(seenKey(), '1'); } catch(_) {} }
  function hasSeenToday() { try { return localStorage.getItem(seenKey()) === '1'; } catch(_) { return false; } }

  function fmtJamWIB(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch(_) { return ''; }
  }

  // Shared dgn khatamku-link-module.js (window._khStatBox) -- bug hunt #5,
  // dulu ada 2 salinan nyaris identik di file ini & khatamku-link-module.js.
  // khatamku-link-module.js dimuat SEBELUM file ini di index.html (urutan
  // script defer), jadi window._khStatBox sudah pasti terdefinisi di sini.
  var statBox = window._khStatBox;

  function bodyBelumTerhubung() {
    return '<div class="kp-sub">Sambungkan akun KhatamKu-mu supaya progres bacaan &amp; dzikirmu tampil di sini setiap kali buka aplikasi.</div>'
      + '<button type="button" class="kp-cta" onclick="window._kpAksi()">🔗 Hubungkan Sekarang</button>';
  }

  function bodyMenungguSinkron() {
    return '<div class="kp-sub">Akun KhatamKu-mu sudah terhubung ✅ — data progresnya akan muncul di sini setelah sinkronisasi pertama.</div>'
      + '<button type="button" class="kp-cta" onclick="window._kpAksi()">Lihat Detail</button>';
  }

  function bodyProgres(progress) {
    var stats = '<div style="display:flex;gap:8px;margin-bottom:12px">'
      + statBox('Halaman', progress.last_page_read)
      + statBox('Streak', progress.streak_days != null ? progress.streak_days + ' hari' : null)
      + statBox('Khatam', progress.total_khatam)
      + '</div>';
    var jam = fmtJamWIB(progress.synced_at);
    return stats
      + (jam ? '<div class="kp-sub">🕐 Data terakhir disinkron pukul ' + jam + '</div>' : '')
      + '<button type="button" class="kp-cta" onclick="window._kpAksi()">Lihat Detail Lengkap</button>';
  }

  function render(data) {
    injectStyle();
    var old = document.getElementById('kp-card'); if (old) old.remove();
    var link = data.link, progress = data.progress;
    var title, body;
    if (!link || link.status !== 'verified') {
      title = '🔗 Hubungkan KhatamKu';
      body = bodyBelumTerhubung();
    } else if (!progress) {
      title = '📖 KhatamKu-mu';
      body = bodyMenungguSinkron();
    } else {
      title = '📖 KhatamKu-mu';
      body = bodyProgres(progress);
    }
    var card = document.createElement('div');
    card.id = 'kp-card';
    card.innerHTML =
      '<div class="kp-head">' +
        '<button type="button" class="kp-close" aria-label="Tutup" onclick="window._kpDismiss()">&times;</button>' +
        '<div class="kp-title">' + title + '</div>' +
      '</div>' +
      '<div class="kp-body">' + body + '</div>';
    document.body.appendChild(card);
  }

  window._kpDismiss = function() {
    markSeenToday();
    var el = document.getElementById('kp-card'); if (el) el.remove();
  };

  window._kpAksi = function() {
    markSeenToday();
    var el = document.getElementById('kp-card'); if (el) el.remove();
    if (typeof goPage === 'function') goPage('khatamku-link');
  };

  // Overlay lain (onboarding/push-dialog/popup-notifikasi) BUKAN auto-hilang --
  // tetap terbuka sampai user pilih aksi. Dialog "ajakan notifikasi" (push-dialog)
  // khususnya muncul TIAP KALI buka app buat murid yang belum memutuskan
  // (lihat assets/push-permission.js:432-446) -- cek sekali lalu nyerah bikin
  // popup ini nyaris tak pernah tampil buat populasi itu. Coba ulang tiap 3
  // detik (maks ~36 detik) supaya nunggu giliran, bukan langsung nyerah.
  function tunggGiliran(data, percobaan) {
    if (hasSeenToday()) return; // sudah kelihatan lewat cara lain, batal
    if (typeof _currentTabName !== 'undefined' && _currentTabName === 'khatamku-link') return;
    var terhalang = document.getElementById('kp-card')
      || document.getElementById('pn-card')
      || document.getElementById('ob-overlay')
      || document.getElementById('push-dialog-overlay');
    if (terhalang) {
      if (percobaan < 12) setTimeout(function(){ tunggGiliran(data, percobaan + 1); }, 3000);
      return; // menyerah diam-diam kalau masih terhalang sampai batas -- jangan maksa
    }
    markSeenToday();
    render(data);
  }

  // Entry point -- panggil dari startApp() SETELAH initPopupNotifikasi (lihat
  // murid/index.html:7744). Delay awal 15000ms -- lebih santai drpd popup lain
  // (onboarding=1.5s, push-dialog=3s, popup-notifikasi=4s) SENGAJA, supaya di
  // percobaan pertama saja overlay lain sudah besar kemungkinan sudah user
  // tutup duluan (popup KhatamKu tidak time-sensitive, boleh telat tampil).
  // tunggGiliran() tetap jaga-jaga kalau masih terhalang setelah itu.
  window.initKhatamkuPopup = function(roleLabel) {
    if (hasSeenToday()) return;
    if (!window.HQ || !window.HQ.MuridAPI || typeof window.HQ.MuridAPI.getKhatamkuLinkStatus !== 'function') return;
    window.HQ.MuridAPI.getKhatamkuLinkStatus().then(function(r) {
      var data = (r && r.data) || null;
      if (!data) return;
      setTimeout(function(){ tunggGiliran(data, 0); }, 15000);
    }).catch(function(){});
  };
})();
