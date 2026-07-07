/**
 * murid/partner-module.js
 * Modul Partner Belajar & Kelompok Qiyam Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var _pqInitialized = false;
  var _pqKelompok = null;
  var _pbInitialized = false;
  var _pbKelompok = null;

  async function _initPartnerPanel() {
    if (!_pqInitialized) {
      _pqInitialized = true;
      _pqFillSuratDatalist();
      var tgl = document.getElementById('pqTanggal');
      if (tgl && !tgl.value) tgl.value = new Date().toISOString().slice(0,10);
      await _pqLoadZiyadahMap();
    }
    await Promise.all([loadPartnerKelompok(), loadPartnerMenunggu()]);
    loadPartnerLiniMasa();
    loadMurajaahSuggest();
    loadTargetKelompok();
    checkCadanganQiyam();
  }

  async function loadMurajaahSuggest() {
    var card = document.getElementById('pqMurajaahCard');
    var body = document.getElementById('pqMurajaahBody');
    if (!card || !body) return;
    if (!_pqKelompok) { card.style.display = 'none'; return; }
    try {
      var res = await window.HQ.MuridAPI.getSetoranRingkasSaya();
      var rows = res.data || [];
      var map = {};
      rows.forEach(function(r){
        var sah = (r.sumber === 'guru') || (r.sumber === 'partner' && r.status_konfirmasi === 'dikonfirmasi');
        if (!sah) return;
        if (!map[r.surat]) map[r.surat] = { surat:r.surat, juz:r.juz, memorized:false, last:0 };
        if (r.jenis === 'Ziyadah') map[r.surat].memorized = true;
        var t = new Date(r.created_at).getTime();
        if (t > map[r.surat].last) map[r.surat].last = t;
      });
      var now = Date.now();
      var suggest = Object.keys(map).map(function(k){ return map[k]; })
        .filter(function(m){ return m.memorized && (now - m.last) >= 7*86400000; })
        .sort(function(a,b){ return a.last - b.last; }).slice(0,3);
      if (!suggest.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      body.innerHTML = suggest.map(function(m){
        var hari = Math.floor((now - m.last)/86400000);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(13,148,136,.12)">'
          + '<div><span style="font-weight:700;color:var(--text)">QS. ' + _esc(m.surat) + '</span> <span style="color:var(--text-3);font-size:11px">· terakhir ' + hari + ' hari lalu</span></div>'
          + '<button onclick="pqMurajaahNow(\'' + _esc(m.surat) + '\',\'' + (m.juz||'') + '\')" style="background:#0d9488;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Muraja\'ah</button>'
        + '</div>';
      }).join('');
    } catch(e) { card.style.display = 'none'; }
  }

  function pqMurajaahNow(surat, juz) {
    switchHafalanTab('partner');
    document.getElementById('pqJenisSel').value = 'Murajaah';
    document.getElementById('pqSuratInput').value = surat;
    if (juz) document.getElementById('pqJuzInput').value = juz;
  }

  async function loadPagePartnerBelajar() {
    if (!_pbInitialized) {
      _pbInitialized = true;
      var tgl = document.getElementById('pbTanggal');
      if (tgl && !tgl.value) tgl.value = new Date().toISOString().slice(0,10);
    }
    await Promise.all([loadPartnerBelajarKelompok(), loadPartnerBelajarMenunggu()]);
    loadPartnerBelajarLiniMasa();
    loadTargetBelajar();
    loadPbRiwayat();
  }

  function _pbMemberWaBtn(nama, no_hp) {
    var msg = 'Assalamualaikum ' + (nama || '') + ', yuk kita saling pantau aktivitas belajar ya 📚\n\nBarakallahu fiikum.';
    var url = _waLink(no_hp, msg);
    if (!url) return '';
    return '<a href="' + url + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" '
      + 'style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:#25d366;color:#fff;text-decoration:none;font-size:13px;flex-shrink:0">💬</a>';
  }

  async function loadPartnerBelajarKelompok() {
    var body = document.getElementById('pbKelompokBody');
    if (!body) return;
    try {
      var resKel = await window.HQ.MuridAPI.getMyKelompokBelajar();
      _pbKelompok = resKel.data;
      if (!_pbKelompok) {
        body.innerHTML = '<div style="color:var(--text-3)">Kamu belum tergabung di kelompok belajar. Hubungi guru/admin untuk dimasukkan ke kelompok.</div>';
        loadAktivitasTertunda();
        return;
      }
      var resStatus  = await window.HQ.MuridAPI.getStatusKelompokBelajar();
      var statusList = resStatus.data || [];
      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';
      var rows = statusList.map(function(m){
        var isMe = m.id_murid === myId;
        var tgl = m.tanggal_terakhir ? _fmtDateHafalan(m.tanggal_terakhir) : 'Belum ada aktivitas';
        var nameLabel = _esc(m.nama_murid) + (isMe ? ' (Kamu)' : '');
        var waBtn = isMe ? '' : _pbMemberWaBtn(m.nama_murid, m.no_hp);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
          + '<span style="font-weight:600;font-size:12px;color:var(--text);flex:1;min-width:0">' + nameLabel + '</span>'
          + '<span style="font-size:11px;color:var(--text-3)">' + _esc(tgl) + '</span>'
          + waBtn
          + '</div>';
      }).join('');
      body.innerHTML = '<div style="font-weight:800;font-size:13px;color:var(--text);margin-bottom:6px">' + _esc(_pbKelompok.nama_kelompok || 'Kelompok Belajar') + '</div>' + rows;
      loadAktivitasTertunda();
    } catch(e) {
      body.innerHTML = '<div style="color:#ef4444">Gagal memuat: ' + _esc(friendlyError(e)) + '</div>';
    }
  }

  async function loadAktivitasTertunda() {
    var card = document.getElementById('pbTertundaCard');
    var body = document.getElementById('pbTertundaBody');
    if (!card || !body) return;
    if (!_pbKelompok) { card.style.display = 'none'; return; }
    try {
      var res = await window.HQ.MuridAPI.getLogRingkasSaya();
      var rows = res.data || [];
      var map = {};
      rows.forEach(function(r){
        var sah = (r.status_konfirmasi === 'dikonfirmasi');
        if (!sah) return;
        if (!map[r.jenis]) map[r.jenis] = { jenis:r.jenis, last:0 };
        var t = new Date(r.created_at).getTime();
        if (t > map[r.jenis].last) map[r.jenis].last = t;
      });
      var ALL_JENIS = ['Murottal','Membaca Terjemah','Membaca Tafsir','Menulis/Kitabah','Mendengar Murottal'];
      var now = Date.now();
      var tertunda = ALL_JENIS.map(function(j){
        var last = map[j] ? map[j].last : 0;
        return { jenis:j, last:last };
      }).filter(function(m){
        return (now - m.last) >= 7*86400000;
      }).sort(function(a,b){ return a.last - b.last; }).slice(0,3);
      if (!tertunda.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      body.innerHTML = tertunda.map(function(m){
        var ket = m.last === 0 ? 'belum pernah' : Math.floor((now - m.last)/86400000) + ' hari lalu';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(13,148,136,.12)">'
          + '<div><span style="font-weight:700;color:var(--text)">' + _esc(m.jenis) + '</span> <span style="color:var(--text-3);font-size:11px">· ' + ket + '</span></div>'
          + '<button onclick="pbTertundaNow(\'' + _esc(m.jenis) + '\')" style="background:#0d9488;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Isi Log</button>'
        + '</div>';
      }).join('');
    } catch(e) { card.style.display = 'none'; }
  }

  function pbTertundaNow(jenis) {
    var sel = document.getElementById('pbJenisSel');
    if (sel) {
      sel.value = jenis;
      sel.focus();
      try {
        sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(e) {}
    }
  }

  // Kartu "Partner Belajar" di Dashboard — CTA state-aware (mirror loadPartnerDashCard)
  async function loadPartnerBelajarDashCard() {
    var card  = document.getElementById('dashPartnerBelajarCard');
    var body  = document.getElementById('dashPartnerBelajarBody');
    var badge = document.getElementById('dashPartnerBelajarBadge');
    if (!card || !body) return;
    try {
      var resKel = await window.HQ.MuridAPI.getMyKelompokBelajar();
      var kel = resKel.data;
      if (!kel) { card.style.display = 'none'; return; }
      card.style.display = 'block';

      var both = await Promise.all([
        window.HQ.MuridAPI.getStatusKelompokBelajar(),
        window.HQ.MuridAPI.getLogMenungguKonfirmasi(),
        window.HQ.MuridAPI.getLogRingkasSaya(),
      ]);
      var statusList = both[0].data || [];
      var jumlahMenunggu = (both[1].data || []).length;
      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';

      // Notif: aktivitas sendiri yang baru dikonfirmasi partner + ada pesan (3 hari terakhir)
      var notifHtml = '';
      var recent = (both[2].data || []).filter(function(r){
        var when = r.updated_at || r.created_at;
        return r.status_konfirmasi === 'dikonfirmasi' && (r.catatan_partner || r.reaksi_partner)
          && when && (Date.now() - new Date(when).getTime()) < 3*86400000;
      })[0];
      if (recent) {
        notifHtml = '<div style="background:rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.25);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:12px;color:#0f766e">'
          + '<span style="font-weight:800">💚 Partnermu mengonfirmasi aktivitasmu' + (recent.reaksi_partner ? ' ' + _esc(recent.reaksi_partner) : '') + '</span>'
          + (recent.catatan_partner ? '<div style="margin-top:2px;color:var(--text-2)">"' + _esc(recent.catatan_partner) + '"</div>' : '')
        + '</div>';
      }

      var myRow = null;
      for (var i = 0; i < statusList.length; i++) { if (statusList[i].id_murid === myId) { myRow = statusList[i]; break; } }
      var myLast = myRow && myRow.tanggal_terakhir;
      var hariSejak = myLast ? Math.floor((Date.now() - new Date(myLast).getTime()) / 86400000) : null;

      var ctaHtml = '';
      if (jumlahMenunggu > 0) {
        ctaHtml = '<div style="background:rgba(13,148,136,.12);border:1px solid rgba(13,148,136,.3);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:12px;font-weight:700;color:#0f766e">'
          + '🎧 Ada ' + jumlahMenunggu + ' teman lapor aktivitas — pantau lalu konfirmasi</div>';
      } else if (myLast === null) {
        ctaHtml = '<div style="background:rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.25);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:12px;font-weight:700;color:#0f766e">'
          + '📚 Belum ada aktivitas. Mulai catat belajar mandirimu</div>';
      } else if (hariSejak >= 3) {
        ctaHtml = '<div style="background:rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.25);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:12px;font-weight:700;color:#0f766e">'
          + '📚 Sudah ' + hariSejak + ' hari belum catat aktivitas. Partnermu menanti kabarmu</div>';
      }

      var rows = statusList.map(function(m){
        var isMe = m.id_murid === myId;
        var tgl = m.tanggal_terakhir ? _fmtDateHafalan(m.tanggal_terakhir) : 'Belum ada aktivitas';
        var nameLabel = _esc(m.nama_murid) + (isMe ? ' (Kamu)' : '');
        var waBtn = isMe ? '' : _pbMemberWaBtn(m.nama_murid, m.no_hp);
        return '<div class="partner-dash-row">'
          + '<span class="partner-dash-name">' + nameLabel + '</span>'
          + '<span style="display:flex;align-items:center;gap:8px"><span class="partner-dash-date">' + _esc(tgl) + '</span>' + waBtn + '</span>'
          + '</div>';
      }).join('');
      body.innerHTML = notifHtml + ctaHtml
        + '<div style="font-weight:800;font-size:13px;margin-bottom:6px">' + _esc(kel.nama_kelompok || 'Kelompok Belajar') + '</div>'
        + rows;

      var sbBadge = document.getElementById('sidebarBelajarBadge');
      if (badge) {
        if (jumlahMenunggu > 0) { badge.style.display = 'inline-flex'; badge.textContent = jumlahMenunggu + ' menunggu konfirmasi'; }
        else { badge.style.display = 'none'; }
      }
      if (sbBadge) {
        if (jumlahMenunggu > 0) { sbBadge.style.display = 'inline-flex'; sbBadge.textContent = jumlahMenunggu; }
        else { sbBadge.style.display = 'none'; }
      }
    } catch(e) {
      card.style.display = 'none';
    }
  }

  // Safe Property Accessors
  try { delete window._pqInitialized; Object.defineProperty(window, '_pqInitialized', { get: function() { return _pqInitialized; }, set: function(v) { _pqInitialized = v; }, configurable: true }); } catch(e) { window._pqInitialized = _pqInitialized; }
  try { delete window._pqKelompok; Object.defineProperty(window, '_pqKelompok', { get: function() { return _pqKelompok; }, set: function(v) { _pqKelompok = v; }, configurable: true }); } catch(e) { window._pqKelompok = _pqKelompok; }
  try { delete window._pbInitialized; Object.defineProperty(window, '_pbInitialized', { get: function() { return _pbInitialized; }, set: function(v) { _pbInitialized = v; }, configurable: true }); } catch(e) { window._pbInitialized = _pbInitialized; }
  try { delete window._pbKelompok; Object.defineProperty(window, '_pbKelompok', { get: function() { return _pbKelompok; }, set: function(v) { _pbKelompok = v; }, configurable: true }); } catch(e) { window._pbKelompok = _pbKelompok; }

  // Expose functions to window
  window._initPartnerPanel = _initPartnerPanel;
  window.loadMurajaahSuggest = loadMurajaahSuggest;
  window.pqMurajaahNow = pqMurajaahNow;
  window.loadPagePartnerBelajar = loadPagePartnerBelajar;
  window._pbMemberWaBtn = _pbMemberWaBtn;
  window.loadPartnerBelajarKelompok = loadPartnerBelajarKelompok;
  window.loadAktivitasTertunda = loadAktivitasTertunda;
  window.pbTertundaNow = pbTertundaNow;
  window.loadPartnerBelajarDashCard = loadPartnerBelajarDashCard;
})();
