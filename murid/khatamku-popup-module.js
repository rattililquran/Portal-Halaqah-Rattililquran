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
  width:calc(100% - 2rem); max-width:440px;
  max-height:calc(100vh - 3rem); overflow-x:hidden; overflow-y:auto;
  background:var(--card-solid); border-radius:24px;
  box-shadow:0 32px 64px -16px rgba(3,54,90,.4),0 12px 28px -12px rgba(3,54,90,.25);
  animation:kpPopIn .3s ease;
}
@keyframes kpPopIn{from{opacity:0;transform:translate(-50%,-50%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
#kp-card .kp-head{
  background:
    radial-gradient(135% 180% at 82% -30%,rgba(255,255,255,.28),transparent 55%),
    linear-gradient(135deg,#0c4a6e 0%,#075985 45%,#0ea5e9 100%);
  padding:22px 50px 20px 22px;position:relative;
}
#kp-card .kp-close{-webkit-appearance:none;appearance:none;position:absolute;top:12px;right:12px;width:32px;height:32px;min-width:32px;max-width:32px;min-height:32px;max-height:32px;box-sizing:border-box;flex-shrink:0;flex-grow:0;aspect-ratio:1/1;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(255,255,255,.22);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:0;outline:none;transition:background .15s ease,transform .15s ease}
#kp-card .kp-close svg{display:block;flex-shrink:0;overflow:visible}
#kp-card .kp-close line{transform-origin:center;transition:transform .4s ease}
#kp-card .kp-close:hover line.l1{transition-delay:0s;transform:rotate(90deg)}
#kp-card .kp-close:hover line.l2{transition-delay:.1s;transform:rotate(90deg)}
@media (prefers-reduced-motion: reduce){ #kp-card .kp-close line{transition:none} }
#kp-card .kp-close:hover{background:rgba(255,255,255,.3);transform:scale(1.06)}
#kp-card .kp-close:active{transform:scale(.94)}
#kp-card .kp-head-ico{width:46px;height:46px;background:rgba(255,255,255,.16);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:23px;margin-bottom:12px;backdrop-filter:blur(6px);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
#kp-card .kp-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:800;color:#fff;padding-right:4px}
#kp-card .kp-body{padding:20px 22px 22px}
#kp-card .kp-sub{font-size:14px;color:var(--text-2);line-height:1.65;margin-bottom:16px}
#kp-card .kp-cta{display:block;width:100%;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-family:inherit;font-size:15.5px;font-weight:800;text-align:center;cursor:pointer;box-sizing:border-box;box-shadow:0 6px 18px -4px rgba(2,132,199,.5);transition:transform .15s ease,box-shadow .15s ease,filter .15s ease}
#kp-card .kp-cta:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 10px 22px -4px rgba(2,132,199,.55)}
#kp-card .kp-cta:active{transform:translateY(0) scale(.98)}
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
    var icon, title, body;
    if (!link || link.status !== 'verified') {
      icon = '🔗'; title = 'Hubungkan KhatamKu';
      body = bodyBelumTerhubung();
    } else if (!progress) {
      icon = '📖'; title = 'KhatamKu-mu';
      body = bodyMenungguSinkron();
    } else {
      icon = '📖'; title = 'KhatamKu-mu';
      body = bodyProgres(progress);
    }
    var card = document.createElement('div');
    card.id = 'kp-card';
    card.innerHTML =
      '<div class="kp-head">' +
        '<button type="button" class="kp-close" aria-label="Tutup" onclick="window._kpDismiss()">'
          + '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line class="l1" x1="1" y1="1" x2="13" y2="13"/><line class="l2" x1="13" y1="1" x2="1" y2="13"/></svg>'
        + '</button>' +
        '<div class="kp-head-ico">' + icon + '</div>' +
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
  // murid/index.html:7744). Urutan stagger: onboarding=1.5s, popup dakwah=4s,
  // ini=15s, ajakan notifikasi=30s. Delay 15000ms SENGAJA lebih santai drpd
  // onboarding/dakwah (popup KhatamKu tidak time-sensitive, boleh telat
  // tampil) tapi masih sebelum ajakan notifikasi. tunggGiliran() tetap
  // jaga-jaga kalau masih terhalang setelah itu.
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
