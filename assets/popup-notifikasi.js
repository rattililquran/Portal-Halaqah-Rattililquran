// ============================================================
//  Popup Notifikasi -- Rattililqur'an
//  Popup dakwah admin-editable (infaq, keutamaan baca Qur'an, dzikir, dll).
//  BUKAN push notification, BUKAN Pengumuman Onboarding (onboarding_config) --
//  tabel & kanal terpisah, lihat RENCANA_fitur-popup-notifikasi.md (repo
//  Modul-Web) utk latar belakang & keputusan desain lengkap.
//  Include di semua portal SETELAH supabase-core.js & push-permission.js.
// ============================================================

(function() {
'use strict';

function _pnEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── CSS: kartu non-blocking (bukan overlay/modal spt #ob-overlay /
//    #push-dialog-overlay -- lihat §8 RENCANA: ajakan, bukan aksi wajib,
//    jangan menghalangi user memakai portal) ──
var STYLE = `
#pn-card {
  position:fixed; z-index:9000;
  top:50%; left:50%; transform:translate(-50%,-50%);
  width:calc(100% - 2rem); max-width:440px;
  max-height:calc(100vh - 3rem); overflow-x:hidden; overflow-y:auto;
  background:#fff; border-radius:24px;
  box-shadow:0 32px 64px -16px rgba(3,54,90,.4),0 12px 28px -12px rgba(3,54,90,.25);
  animation:pnPopIn .3s ease;
}
@keyframes pnPopIn{from{opacity:0;transform:translate(-50%,-50%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
/* Gradient header & tombol close (di bawah) diduplikasi persis (byte-for-
   byte) di assets/push-permission.js (.push-header) & murid/khatamku-
   popup-module.js (.kp-head/.kp-close) -- 3 file terpisah tanpa mekanisme
   share-CSS (plain <style> injection per modul, bukan build system), jadi
   sengaja disalin drpd direstrukturisasi. Kalau ubah salah satu, ikut ubah
   yg lain (code review 2026-08-27, ditandai duplikasi tapi bukan bug). */
#pn-card .pn-head{
  background:
    radial-gradient(135% 180% at 82% -30%,rgba(255,255,255,.28),transparent 55%),
    linear-gradient(135deg,#0c4a6e 0%,#075985 45%,#0ea5e9 100%);
  padding:22px 50px 20px 22px;position:relative;
}
#pn-card .pn-close{-webkit-appearance:none;appearance:none;position:absolute;top:12px;right:12px;width:32px;height:32px;min-width:32px;max-width:32px;min-height:32px;max-height:32px;box-sizing:border-box;flex-shrink:0;flex-grow:0;aspect-ratio:1/1;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(255,255,255,.22);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:0;outline:none;transition:background .15s ease,transform .15s ease}
#pn-card .pn-close svg{display:block;flex-shrink:0;overflow:visible}
#pn-card .pn-close line{transform-origin:center;transition:transform .4s ease}
#pn-card .pn-close:hover line.l1{transition-delay:0s;transform:rotate(90deg)}
#pn-card .pn-close:hover line.l2{transition-delay:.1s;transform:rotate(90deg)}
@media (prefers-reduced-motion: reduce){ #pn-card .pn-close line{transition:none} }
#pn-card .pn-close:hover{background:rgba(255,255,255,.3);transform:scale(1.06)}
#pn-card .pn-close:active{transform:scale(.94)}
#pn-card .pn-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:800;color:#fff;padding-right:4px;overflow-wrap:break-word}
#pn-card .pn-body{padding:20px 22px 22px}
#pn-card .pn-isi{font-size:15.5px;color:#334155;line-height:1.7;white-space:pre-wrap;overflow-wrap:break-word}
#pn-card .pn-dalil{margin-top:12px;padding:14px 16px;background:#f8fafc;border-radius:12px;font-size:19px;color:#0f172a;line-height:2.1;text-align:right;direction:rtl}
#pn-card .pn-cta{display:block;width:100%;margin-top:16px;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-family:inherit;font-size:15.5px;font-weight:800;text-align:center;text-decoration:none;cursor:pointer;box-sizing:border-box;box-shadow:0 6px 18px -4px rgba(2,132,199,.5);transition:transform .15s ease,box-shadow .15s ease,filter .15s ease}
#pn-card .pn-cta:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 10px 22px -4px rgba(2,132,199,.55)}
#pn-card .pn-cta:active{transform:translateY(0) scale(.98)}
html.theme-dark #pn-card{background:#111c30}
html.theme-dark #pn-card .pn-isi{color:#94a3b8}
html.theme-dark #pn-card .pn-dalil{background:#0d1f35;color:#f0f4ff}
`;

function injectStyle() {
  if (document.getElementById('pn-style')) return;
  var s = document.createElement('style');
  s.id = 'pn-style'; s.textContent = STYLE;
  document.head.appendChild(s);
}

// ── Dismissal versi-aware, per user login (pola sama dgn onboarding_seen_<uid>
//    di push-permission.js), tapi key ikut sertakan id_popup krn tabel ini
//    multi-baris (beda dari onboarding_config yang single-row) ──
function _pnUid() {
  var u = window.HQ && window.HQ.getCurrentUser && window.HQ.getCurrentUser();
  return (u && u.id_user) || 'anon';
}
function seenKey(idPopup) { return 'popup_notif_seen_' + _pnUid() + '_' + idPopup; }
function markSeen(p) { try { localStorage.setItem(seenKey(p.id_popup), String(p.updated_at)); } catch(_) {} }
function hasSeen(p) { try { return localStorage.getItem(seenKey(p.id_popup)) === String(p.updated_at); } catch(_) { return false; } }

// Kolom diminimalkan -- dibuat_oleh (id_user admin) tak perlu sampai ke klien.
// RLS (supabase/patch_087_popup_notifikasi.sql) sudah membatasi baris ke
// aktif=true + dalam rentang tanggal utk role non-admin.
function fetchActive() {
  var sb = window.HQ && window.HQ.supabase;
  if (!sb) return Promise.resolve(null);
  return sb.from('popup_notifikasi')
    .select('id_popup, judul, isi, dalil_arab, cta_label, cta_url, updated_at')
    .eq('aktif', true)
    .order('updated_at', { ascending:false })
    .order('id_popup', { ascending:false }) // tie-break deterministik kalau >1 baris updated_at-nya sama persis
    .limit(1)
    .then(function(res){ return (res.data && res.data[0]) || null; })
    .catch(function(){ return null; });
}

function render(p) {
  injectStyle();
  var old = document.getElementById('pn-card'); if (old) old.remove();
  var ctaBtn = (p.cta_label && p.cta_url && /^https:\/\//.test(p.cta_url))
    ? '<a class="pn-cta" href="' + _pnEsc(p.cta_url) + '" target="_blank" rel="noopener noreferrer" onclick="window._pnDismiss()">' + _pnEsc(p.cta_label) + '</a>'
    : '';
  var card = document.createElement('div');
  card.id = 'pn-card';
  card.innerHTML =
    '<div class="pn-head">' +
      '<button type="button" class="pn-close" aria-label="Tutup" onclick="window._pnDismiss()">'
        + '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line class="l1" x1="1" y1="1" x2="13" y2="13"/><line class="l2" x1="13" y1="1" x2="1" y2="13"/></svg>'
      + '</button>' +
      '<div class="pn-title">' + (p.judul ? _pnEsc(p.judul) : '📣 Info') + '</div>' +
    '</div>' +
    '<div class="pn-body">' +
      '<div class="pn-isi">' + _pnEsc(p.isi) + '</div>' +
      (p.dalil_arab ? '<div class="pn-dalil">' + _pnEsc(p.dalil_arab) + '</div>' : '') +
      ctaBtn +
    '</div>';
  document.body.appendChild(card);
  window._pnCtx = p;
}

window._pnDismiss = function() {
  if (window._pnCtx) markSeen(window._pnCtx);
  var el = document.getElementById('pn-card'); if (el) el.remove();
};

// Entry point -- panggil eksplisit dari startApp() murid/guru (JANGAN ulangi
// pola initOnboarding yang didefinisikan tapi tak pernah dipanggil).
// roleLabel diterima utk konsistensi tanda tangan dgn initOnboarding(), tapi
// TIDAK dipakai memfilter Fase 0 -- popup ini satu kanal utk semua role
// (target per-role sengaja ditunda, lihat RENCANA §7 #4).
window.initPopupNotifikasi = function(roleLabel) {
  fetchActive().then(function(p) {
    if (!p || hasSeen(p)) return;
    // Urutan stagger: onboarding=1.5s, popup dakwah (ini)=4s, ajakan
    // notifikasi=30s, popup KhatamKu (murid)=15s.
    setTimeout(function() { _pnTungguGiliran(p, 0); }, 4000);
  }).catch(function(){});
};

// Pengaman tabrakan popup: cek ULANG scr berkala (bukan sekali lalu nyerah)
// -- popup lain tetap terbuka sampai user pilih aksi, jadi cek sekali-lalu-
// nyerah bikin popup ini nyaris tak pernah tampil kalau kebetulan
// bertabrakan. Coba ulang tiap 3 detik, maks ~36 detik tambahan.
function _pnTungguGiliran(p, percobaan) {
  if (hasSeen(p)) return; // sudah kelihatan lewat cara lain selama jeda
  var terhalang = document.getElementById('ob-overlay')
    || document.getElementById('push-dialog-overlay')
    || document.getElementById('kp-card');
  if (terhalang) {
    if (percobaan < 12) setTimeout(function() { _pnTungguGiliran(p, percobaan + 1); }, 3000);
    return;
  }
  render(p);
}

})();
