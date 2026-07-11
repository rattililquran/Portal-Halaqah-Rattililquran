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
      if (tgl && !tgl.value) tgl.value = localDateStr();
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
          + '<button onclick="pqMurajaahNow(\'' + escJs(m.surat) + '\',\'' + (m.juz||'') + '\')" style="background:#0d9488;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Muraja\'ah</button>'
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
      if (tgl && !tgl.value) tgl.value = localDateStr();
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
          + '<button onclick="pbTertundaNow(\'' + escJs(m.jenis) + '\')" style="background:#0d9488;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Isi Log</button>'
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

  // ------------------------------------------------------------
  //  DYNAMIC FEEDBACK DIALOG (REUSABLE)
  // ------------------------------------------------------------
  function showFeedbackModal(title, subtitle, onSubmit) {
    var existing = document.getElementById('pbFeedbackModal');
    if (existing) document.body.removeChild(existing);

    var modal = document.createElement('div');
    modal.id = 'pbFeedbackModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '99999';

    modal.innerHTML = 
      '<div class="modal-content" style="max-width:400px; padding:20px; border-radius:16px; background:var(--card-solid); border:1px solid var(--border); box-shadow:0 10px 25px rgba(0,0,0,0.15); width:90%; position:relative;">'
      + '  <div style="font-size:16px; font-weight:800; color:var(--text); margin-bottom:4px;">' + _esc(title) + '</div>'
      + '  <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">' + _esc(subtitle) + '</div>'
      + '  <div style="margin-bottom:12px;">'
      + '    <label style="display:block; font-size:10px; font-weight:700; color:var(--text-3); margin-bottom:6px; text-transform:uppercase;">Pilih Reaksi</label>'
      + '    <div style="display:flex; gap:10px; font-size:24px;" id="pbModalReaksi">'
      + '      <span style="cursor:pointer; padding:6px; border-radius:8px; border:1.5px solid var(--border); transition:all 0.2s;" onclick="selectPbEmoji(this, \'👍\')">👍</span>'
      + '      <span style="cursor:pointer; padding:6px; border-radius:8px; border:1.5px solid var(--border); transition:all 0.2s;" onclick="selectPbEmoji(this, \'❤️\')">❤️</span>'
      + '      <span style="cursor:pointer; padding:6px; border-radius:8px; border:1.5px solid var(--border); transition:all 0.2s;" onclick="selectPbEmoji(this, \'👏\')">👏</span>'
      + '      <span style="cursor:pointer; padding:6px; border-radius:8px; border:1.5px solid var(--border); transition:all 0.2s;" onclick="selectPbEmoji(this, \'💪\')">💪</span>'
      + '      <span style="cursor:pointer; padding:6px; border-radius:8px; border:1.5px solid var(--border); transition:all 0.2s;" onclick="selectPbEmoji(this, \'⭐\')">⭐</span>'
      + '    </div>'
      + '  </div>'
      + '  <div style="margin-bottom:16px;">'
      + '    <label style="display:block; font-size:10px; font-weight:700; color:var(--text-3); margin-bottom:6px; text-transform:uppercase;">Catatan / Penyemangat (Opsional)</label>'
      + '    <textarea class="fc" id="pbModalCatatan" rows="3" placeholder="Tulis pesan penyemangat untuk partnermu..." style="width:100%; border-radius:10px; padding:10px; font-size:12.5px;"></textarea>'
      + '  </div>'
      + '  <div style="display:flex; gap:10px; justify-content:flex-end;">'
      + '    <button onclick="closePbFeedbackModal()" style="padding:10px 16px; border-radius:10px; border:none; background:var(--bg-2); color:var(--text-2); font-weight:700; font-size:12.5px; cursor:pointer;">Batal</button>'
      + '    <button id="pbModalSubmitBtn" style="padding:10px 16px; border-radius:10px; border:none; background:var(--green); color:#fff; font-weight:700; font-size:12.5px; cursor:pointer;">Konfirmasi ✓</button>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);

    var selectedEmoji = '';
    window.selectPbEmoji = function(el, emoji) {
      document.querySelectorAll('#pbModalReaksi span').forEach(function(s) {
        s.style.borderColor = 'var(--border)';
        s.style.background = 'none';
      });
      el.style.borderColor = 'var(--green)';
      el.style.background = 'rgba(34,197,94,0.1)';
      selectedEmoji = emoji;
    };

    window.closePbFeedbackModal = function() {
      if (document.body.contains(modal)) document.body.removeChild(modal);
    };

    document.getElementById('pbModalSubmitBtn').onclick = function() {
      var catatan = document.getElementById('pbModalCatatan').value.trim();
      closePbFeedbackModal();
      onSubmit(selectedEmoji, catatan);
    };
  }

  // ------------------------------------------------------------
  //  PARTNER BELAJAR (Level 1-4) IMPLEMENTATIONS
  // ------------------------------------------------------------

  async function loadPbRiwayat() {
    var listEl = document.getElementById('pbRiwayatList');
    if (!listEl) return;
    try {
      var res = await window.HQ.MuridAPI.getLogRingkasSaya();
      var list = res.data || [];
      if (list.length === 0) {
        listEl.innerHTML = '<div class="empty" style="padding:20px 0;"><div class="empty-ico">📖</div><div class="empty-ttl" style="font-size:12px;">Belum ada riwayat aktivitas belajar</div></div>';
        return;
      }
      
      listEl.innerHTML = list.map(function(r) {
        var tgl = r.tanggal ? fmtDate(r.tanggal) : '-';
        var isKonf = r.status_konfirmasi === 'dikonfirmasi';
        var badgeCls = isKonf ? 'b-green' : 'b-amber';
        var badgeTxt = isKonf ? 'Dikonfirmasi' : 'Menunggu';
        
        var reactionHtml = '';
        if (isKonf && (r.catatan_partner || r.reaksi_partner)) {
          reactionHtml = '<div style="margin-top:6px; padding:6px 10px; background:var(--bg-2); border-radius:6px; font-size:11px; border-left:2.5px solid var(--blue); color:var(--text-2);">'
            + '<strong>Catatan Partner:</strong> ' 
            + (r.reaksi_partner ? '<span style="font-size:13px; margin-right:4px;">' + _esc(r.reaksi_partner) + '</span>' : '')
            + (r.catatan_partner ? _esc(r.catatan_partner) : '')
            + '</div>';
        }
        
        return '<div class="at-card" style="padding:12px 14px; margin-bottom:10px; border:1px solid var(--border); border-radius:12px; background:var(--card-solid);">'
          + '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
          + '    <div>'
          + '      <div style="font-weight:700; font-size:13px; color:var(--text);">' + _esc(r.jenis_aktivitas) + '</div>'
          + (r.deskripsi ? ('<div style="font-size:11.5px; color:var(--text-2); margin-top:2px;">' + _esc(r.deskripsi) + '</div>') : '')
          + '      <div style="font-size:10.5px; color:var(--text-3); margin-top:4px;">📅 ' + tgl + (r.durasi_menit ? (' · ⏱️ ' + r.durasi_menit + ' menit') : '') + '</div>'
          + '    </div>'
          + '    <span class="badge ' + badgeCls + '" style="font-size:9.5px; padding:2px 8px;">' + badgeTxt + '</span>'
          + '  </div>'
          + reactionHtml
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('loadPbRiwayat error:', e);
      listEl.innerHTML = '<div style="color:var(--red); padding:10px 0;">Gagal memuat riwayat.</div>';
    }
  }

  async function loadPartnerBelajarMenunggu() {
    var wrap = document.getElementById('pbMenungguWrap');
    var listEl = document.getElementById('pbMenungguList');
    if (!wrap || !listEl) return;
    try {
      var res = await window.HQ.MuridAPI.getLogMenungguKonfirmasi();
      var list = res.data || [];
      if (list.length === 0) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = 'block';
      listEl.innerHTML = list.map(function(r) {
        var tgl = r.tanggal ? fmtDate(r.tanggal) : '-';
        var durasi = r.durasi_menit ? (r.durasi_menit + ' menit') : '';
        var desc = r.deskripsi ? ('"' + _esc(r.deskripsi) + '"') : '';
        var subtitle = _esc(r.jenis_aktivitas) + (durasi ? ' · ' + durasi : '') + (desc ? ' · ' + desc : '');
        
        return '<div class="at-card" style="padding:14px; margin-bottom:10px; border:1.5px solid rgba(245,158,11,.3); border-radius:14px; background:var(--card-solid);">'
          + '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
          + '    <div>'
          + '      <div style="font-weight:800; font-size:13.5px; color:var(--text);">' + _esc(r.nama_murid) + '</div>'
          + '      <div style="font-size:12px; color:var(--text-2); margin-top:4px;">' + subtitle + '</div>'
          + '      <div style="font-size:11px; color:var(--text-3); margin-top:4px;">📅 ' + tgl + '</div>'
          + '    </div>'
          + '    <button class="at-btn" onclick="pbKonfirmasiLog(\'' + r.id_log + '\', \'' + escJs(r.nama_murid) + '\', \'' + escJs(r.jenis_aktivitas) + '\')" style="background:var(--green); color:#fff; border:none; border-radius:9px; padding:6px 12px; font-size:11.5px; font-weight:800; cursor:pointer;">Konfirmasi</button>'
          + '  </div>'
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('loadPartnerBelajarMenunggu error:', e);
      wrap.style.display = 'none';
    }
  }

  window.pbKonfirmasiLog = function(id_log, nama_murid, jenis) {
    showFeedbackModal('Konfirmasi Aktivitas', nama_murid + ' · ' + jenis, async function(emoji, catatan) {
      showLoad();
      try {
        var r = await window.HQ.MuridAPI.konfirmasiLogBelajar(id_log, 'Lancar', catatan, emoji);
        if (r.status === 'ok') {
          toast('Aktivitas berhasil dikonfirmasi! ✓', 'ok');
          await loadPagePartnerBelajar();
          if (typeof loadPartnerBelajarDashCard === 'function') loadPartnerBelajarDashCard();
        } else {
          toast(r.message || 'Gagal mengonfirmasi', 'err');
        }
      } catch (e) {
        toast(friendlyError(e), 'err');
      } finally {
        hideLoad();
      }
    });
  };

  async function loadPartnerBelajarLiniMasa() {
    var card = document.getElementById('pbLiniMasaCard');
    var body = document.getElementById('pbLiniMasaBody');
    if (!card || !body) return;
    if (!_pbKelompok) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    try {
      var res = await window.HQ.MuridAPI.getLiniMasaBelajar();
      var feed = res.data || [];
      if (feed.length === 0) {
        body.innerHTML = '<div style="color:var(--text-3); text-align:center; padding:10px 0;">Belum ada aktivitas atau milestone di kelompok ini.</div>';
        return;
      }

      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';

      body.innerHTML = feed.map(function(item) {
        var tgl = item.tanggal ? fmtDate(item.tanggal) : '-';
        var isMilestone = item.tipe === 'milestone';
        var icon = isMilestone ? '🎯' : '📝';
        var content = '';

        if (isMilestone) {
          var canDel = item.dibuat_oleh === myId;
          var delBtn = canDel ? ' <button onclick="pbDeleteMilestone(\'' + item.id_item + '\')" style="background:none; border:none; color:var(--red); font-size:11px; cursor:pointer; font-weight:700; padding:2px 6px;">[Hapus]</button>' : '';
          content = '<div style="background:rgba(13,148,136,0.08); border-left:3px solid var(--green); padding:8px 10px; border-radius:8px; margin:4px 0;">'
            + '  <strong>' + _esc(item.judul) + '</strong>' + delBtn
            + '  <div style="font-size:10px; color:var(--text-3); margin-top:2px;">Ditandai oleh ' + _esc(item.nama_pembuat || 'Anggota') + '</div>'
            + '</div>';
        } else {
          content = '<strong>' + _esc(item.nama_pembuat) + '</strong> melaporkan aktivitas belajar: "' + _esc(item.judul) + '"'
            + (item.deskripsi ? ' <span style="font-style:italic; color:var(--text-3);">(' + _esc(item.deskripsi) + ')</span>' : '');
        }

        return '<div style="display:flex; gap:10px; margin-bottom:12px; font-size:12px; line-height:1.45;">'
          + '  <div style="font-size:16px;">' + icon + '</div>'
          + '  <div style="flex:1;">'
          + '    <div>' + content + '</div>'
          + '    <div style="font-size:10.5px; color:var(--text-3); margin-top:2px;">📅 ' + tgl + '</div>'
          + '  </div>'
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('loadPartnerBelajarLiniMasa error:', e);
      body.innerHTML = '<div style="color:var(--red)">Gagal memuat lini masa.</div>';
    }
  }

  window.pbToggleMilestoneForm = function() {
    var form = document.getElementById('pbMilestoneForm');
    if (form) {
      var isNone = form.style.display === 'none';
      form.style.display = isNone ? 'block' : 'none';
      if (isNone) {
        var tgl = document.getElementById('pbMilestoneTgl');
        if (tgl && !tgl.value) tgl.value = localDateStr();
        document.getElementById('pbMilestoneJudul').focus();
      }
    }
  };

  window.pbSaveMilestone = async function() {
    var judul = (document.getElementById('pbMilestoneJudul') || {}).value || '';
    var tgl = (document.getElementById('pbMilestoneTgl') || {}).value || '';

    if (!judul.trim()) { toast('Masukkan judul milestone', 'err'); return; }
    if (!tgl) { toast('Pilih tanggal milestone', 'err'); return; }
    if (!_pbKelompok) return;

    showLoad();
    try {
      var r = await window.HQ.MuridAPI.addMilestoneBelajar({
        id_kelompok: _pbKelompok.id_kelompok,
        id_halaqah: _pbKelompok.id_halaqah,
        judul: judul.trim(),
        tanggal: tgl
      });
      if (r.status === 'ok') {
        toast('Milestone berhasil disimpan! 🎯', 'ok');
        document.getElementById('pbMilestoneJudul').value = '';
        document.getElementById('pbMilestoneForm').style.display = 'none';
        await loadPartnerBelajarLiniMasa();
      } else {
        toast(r.message || 'Gagal menyimpan', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pbDeleteMilestone = async function(id_milestone) {
    if (!confirm('Apakah Anda yakin ingin menghapus milestone ini?')) return;
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.deleteMilestoneBelajar(id_milestone);
      if (r.status === 'ok') {
        toast('Milestone berhasil dihapus! ✓', 'ok');
        await loadPartnerBelajarLiniMasa();
      } else {
        toast(r.message || 'Gagal menghapus', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  async function loadTargetBelajar() {
    var card = document.getElementById('pbTargetCard');
    var body = document.getElementById('pbTargetBody');
    if (!card || !body) return;
    if (!_pbKelompok) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    try {
      var res = await window.HQ.MuridAPI.getTargetKelompokBelajar();
      var list = res.data || [];
      if (list.length === 0) {
        body.innerHTML = '<div style="color:var(--text-3); text-align:center; padding:10px 0;">Belum ada target bersama kelompok.</div>';
        return;
      }

      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';

      body.innerHTML = list.map(function(t) {
        var tgl = t.tanggal_target ? fmtDate(t.tanggal_target) : 'Tanpa deadline';
        var progressList = t.target_belajar_progress || [];
        var isMeSelesai = progressList.some(function(p) { return p.id_murid === myId && p.selesai_at; });
        var numDone = progressList.filter(function(p) { return p.selesai_at; }).length;
        var numTotal = _pbKelompok.anggota_kelompok_belajar ? _pbKelompok.anggota_kelompok_belajar.length : 3;

        var progressCheckHtml = '<input type="checkbox" ' + (isMeSelesai ? 'checked' : '') 
          + ' onclick="pbTandaiTarget(\'' + t.id_target + '\', this.checked)" '
          + ' style="width:16px; height:16px; cursor:pointer;">';

        var canDel = t.dibuat_oleh === myId;
        var delBtn = canDel ? ' <button onclick="pbDeleteTarget(\'' + t.id_target + '\')" style="background:none; border:none; color:var(--red); font-size:11px; cursor:pointer; font-weight:700; padding:2px 6px;">[Hapus]</button>' : '';

        var partnersDoneHtml = progressList.map(function(p) {
          var label = _esc(p.nama_murid) + (p.id_murid === myId ? ' (Kamu)' : '');
          var statusIcon = p.selesai_at ? '✅' : '⏳';
          return '<div style="font-size:11px; margin-top:2px; color:var(--text-2);">' + statusIcon + ' ' + label + '</div>';
        }).join('');

        return '<div style="background:var(--bg-2); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:10px;">'
          + '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
          + '    <div style="display:flex; gap:10px; align-items:flex-start;">'
          + '      <div style="margin-top:2px;">' + progressCheckHtml + '</div>'
          + '      <div>'
          + '        <div style="font-weight:700; font-size:12.5px; color:var(--text);">' + _esc(t.judul) + '</div>'
          + '        <div style="font-size:10.5px; color:var(--text-3); margin-top:2px;">📅 Batas: ' + tgl + '</div>'
          + '      </div>'
          + '    </div>'
          + '    <div>' + delBtn + '</div>'
          + '  </div>'
          + '  <div style="height:5px; background:var(--border); border-radius:100px; margin-top:10px; overflow:hidden;">'
          + '    <div style="height:100%; background:var(--green); width:' + Math.min(100, Math.round((numDone / numTotal) * 100)) + '%; border-radius:100px;"></div>'
          + '  </div>'
          + '  <div style="font-size:10.5px; color:var(--text-3); margin-top:6px; font-weight:600;">Selesai: ' + numDone + ' dari ' + numTotal + ' anggota</div>'
          + '  <div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:6px;">' + partnersDoneHtml + '</div>'
          + '</div>';
      }).join('');
    } catch(e) {
      console.error('loadTargetBelajar error:', e);
      body.innerHTML = '<div style="color:var(--red)">Gagal memuat target kelompok.</div>';
    }
  }

  window.pbToggleTargetForm = function() {
    var form = document.getElementById('pbTargetForm');
    if (form) {
      var isNone = form.style.display === 'none';
      form.style.display = isNone ? 'block' : 'none';
      if (isNone) {
        var tgl = document.getElementById('pbTargetTgl');
        if (tgl && !tgl.value) tgl.value = localDateStr();
        document.getElementById('pbTargetJudul').focus();
      }
    }
  };

  window.pbSaveTarget = async function() {
    var judul = (document.getElementById('pbTargetJudul') || {}).value || '';
    var tgl = (document.getElementById('pbTargetTgl') || {}).value || '';

    if (!judul.trim()) { toast('Masukkan judul target', 'err'); return; }
    if (!_pbKelompok) return;

    showLoad();
    try {
      var r = await window.HQ.MuridAPI.addTargetKelompokBelajar({
        id_kelompok: _pbKelompok.id_kelompok,
        id_halaqah: _pbKelompok.id_halaqah,
        judul: judul.trim(),
        tanggal_target: tgl || null
      });
      if (r.status === 'ok') {
        toast('Target bersama berhasil dibuat! 🎯', 'ok');
        document.getElementById('pbTargetJudul').value = '';
        document.getElementById('pbTargetForm').style.display = 'none';
        await loadTargetBelajar();
      } else {
        toast(r.message || 'Gagal membuat target', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pbDeleteTarget = async function(id_target) {
    if (!confirm('Apakah Anda yakin ingin menghapus target ini?')) return;
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.deleteTargetKelompokBelajar(id_target);
      if (r.status === 'ok') {
        toast('Target bersama berhasil dihapus! ✓', 'ok');
        await loadTargetBelajar();
      } else {
        toast(r.message || 'Gagal menghapus', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pbTandaiTarget = async function(id_target, selesai) {
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.tandaiProgressTargetBelajar(id_target, selesai);
      if (r.status === 'ok') {
        toast(selesai ? 'Target berhasil ditandai selesai! 🎉' : 'Progress target dibatalkan', 'ok');
        await loadTargetBelajar();
      } else {
        toast(r.message || 'Gagal memperbarui target', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };


  // ------------------------------------------------------------
  //  PARTNER QIYAN (Tahfidz) IMPLEMENTATIONS
  // ------------------------------------------------------------

  async function loadPartnerKelompok() {
    var body = document.getElementById('pqKelompokBody');
    if (!body) return;
    try {
      var resKel = await window.HQ.MuridAPI.getMyKelompokPartner();
      _pqKelompok = resKel.data;
      if (!_pqKelompok) {
        body.innerHTML = '<div style="color:var(--text-3)">Kamu belum tergabung di kelompok partner Qiyam. Hubungi guru/admin untuk dimasukkan ke kelompok.</div>';
        return;
      }
      var resStatus = await window.HQ.MuridAPI.getStatusKelompokPartner();
      var statusList = resStatus.data || [];
      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';
      var rows = statusList.map(function(m) {
        var isMe = m.id_murid === myId;
        var tgl = m.tanggal_terakhir ? _fmtDateHafalan(m.tanggal_terakhir) : 'Belum ada setoran';
        var nameLabel = _esc(m.nama_murid) + (isMe ? ' (Kamu)' : '');
        var waBtn = isMe ? '' : _pbMemberWaBtn(m.nama_murid, m.no_hp);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
          + '<span style="font-weight:600;font-size:12px;color:var(--text);flex:1;min-width:0">' + nameLabel + '</span>'
          + '<span style="font-size:11px;color:var(--text-3)">' + _esc(tgl) + '</span>'
          + waBtn
          + '</div>';
      }).join('');
      body.innerHTML = '<div style="font-weight:800;font-size:13px;color:var(--text);margin-bottom:6px">' + _esc(_pqKelompok.nama_kelompok || 'Kelompok Partner Qiyam') + '</div>' + rows;
    } catch(e) {
      body.innerHTML = '<div style="color:#ef4444">Gagal memuat: ' + _esc(friendlyError(e)) + '</div>';
    }
  }

  async function loadPartnerMenunggu() {
    var wrap = document.getElementById('pqMenungguWrap');
    var listEl = document.getElementById('pqMenungguList');
    if (!wrap || !listEl) return;
    try {
      var res = await window.HQ.MuridAPI.getSetoranMenungguKonfirmasi();
      var list = res.data || [];
      if (list.length === 0) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = 'block';
      listEl.innerHTML = list.map(function(r) {
        var tgl = r.created_at ? fmtDate(r.created_at) : '-';
        var detail = 'QS. ' + _esc(r.surat) + ' · Ayat ' + r.ayat_dari + '-' + r.ayat_sampai + (r.juz ? ' · Juz ' + r.juz : '');
        var subtitle = _esc(r.jenis) + ' · ' + detail;
        
        return '<div class="at-card" style="padding:14px; margin-bottom:10px; border:1.5px solid rgba(245,158,11,.3); border-radius:14px; background:var(--card-solid);">'
          + '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
          + '    <div>'
          + '      <div style="font-weight:800; font-size:13.5px; color:var(--text);">' + _esc(r.nama_murid) + '</div>'
          + '      <div style="font-size:12px; color:var(--text-2); margin-top:4px;">' + subtitle + '</div>'
          + '      <div style="font-size:11px; color:var(--text-3); margin-top:4px;">📅 ' + tgl + '</div>'
          + '    </div>'
          + '    <button class="at-btn" onclick="pqKonfirmasiSetoran(\'' + r.id_setoran + '\', \'' + escJs(r.nama_murid) + '\', \'' + escJs(r.jenis) + ' ' + escJs(r.surat) + '\')" style="background:var(--green); color:#fff; border:none; border-radius:9px; padding:6px 12px; font-size:11.5px; font-weight:800; cursor:pointer;">Konfirmasi</button>'
          + '  </div>'
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('loadPartnerMenunggu error:', e);
      wrap.style.display = 'none';
    }
  }

  window.pqKonfirmasiSetoran = function(id_setoran, nama_murid, detail) {
    showFeedbackModal('Konfirmasi Setoran', nama_murid + ' · ' + detail, async function(emoji, catatan) {
      showLoad();
      try {
        var r = await window.HQ.MuridAPI.konfirmasiSetoranPartner(id_setoran, 'Lancar', catatan, emoji);
        if (r.status === 'ok') {
          toast('Setoran berhasil dikonfirmasi! ✓', 'ok');
          await _initPartnerPanel();
          if (typeof loadPartnerDashCard === 'function') loadPartnerDashCard();
        } else {
          toast(r.message || 'Gagal mengonfirmasi', 'err');
        }
      } catch (e) {
        toast(friendlyError(e), 'err');
      } finally {
        hideLoad();
      }
    });
  };

  async function loadPartnerLiniMasa() {
    var card = document.getElementById('pqLiniMasaCard');
    var body = document.getElementById('pqLiniMasaBody');
    if (!card || !body) return;
    if (!_pqKelompok) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    try {
      var res = await window.HQ.MuridAPI.getLiniMasaSetoran();
      var feed = res.data || [];
      if (feed.length === 0) {
        body.innerHTML = '<div style="color:var(--text-3); text-align:center; padding:10px 0;">Belum ada aktivitas atau milestone di kelompok Qiyam ini.</div>';
        return;
      }

      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';

      body.innerHTML = feed.map(function(item) {
        var tgl = item.tanggal ? fmtDate(item.tanggal) : '-';
        var isMilestone = item.tipe === 'milestone';
        var icon = isMilestone ? '🎯' : '🕌';
        var content = '';

        if (isMilestone) {
          var canDel = item.dibuat_oleh === myId;
          var delBtn = canDel ? ' <button onclick="pqDeleteMilestone(\'' + item.id_item + '\')" style="background:none; border:none; color:var(--red); font-size:11px; cursor:pointer; font-weight:700; padding:2px 6px;">[Hapus]</button>' : '';
          content = '<div style="background:rgba(13,148,136,0.08); border-left:3px solid var(--green); padding:8px 10px; border-radius:8px; margin:4px 0;">'
            + '  <strong>' + _esc(item.judul) + '</strong>' + delBtn
            + '  <div style="font-size:10px; color:var(--text-3); margin-top:2px;">Ditandai oleh ' + _esc(item.nama_pembuat || 'Anggota') + '</div>'
            + '</div>';
        } else {
          content = '<strong>' + _esc(item.nama_pembuat) + '</strong> menyetor hafalan: ' + _esc(item.judul)
            + (item.deskripsi ? ' <span style="font-style:italic; color:var(--text-3);">(' + _esc(item.deskripsi) + ')</span>' : '');
        }

        return '<div style="display:flex; gap:10px; margin-bottom:12px; font-size:12px; line-height:1.45;">'
          + '  <div style="font-size:16px;">' + icon + '</div>'
          + '  <div style="flex:1;">'
          + '    <div>' + content + '</div>'
          + '    <div style="font-size:10.5px; color:var(--text-3); margin-top:2px;">📅 ' + tgl + '</div>'
          + '  </div>'
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('loadPartnerLiniMasa error:', e);
      body.innerHTML = '<div style="color:var(--red)">Gagal memuat lini masa.</div>';
    }
  }

  window.pqToggleMilestoneForm = function() {
    var form = document.getElementById('pqMilestoneForm');
    if (form) {
      var isNone = form.style.display === 'none';
      form.style.display = isNone ? 'block' : 'none';
      if (isNone) {
        var tgl = document.getElementById('pqMilestoneTgl');
        if (tgl && !tgl.value) tgl.value = localDateStr();
        document.getElementById('pqMilestoneJudul').focus();
      }
    }
  };

  window.pqSaveMilestone = async function() {
    var judul = (document.getElementById('pqMilestoneJudul') || {}).value || '';
    var tgl = (document.getElementById('pqMilestoneTgl') || {}).value || '';

    if (!judul.trim()) { toast('Masukkan judul milestone', 'err'); return; }
    if (!tgl) { toast('Pilih tanggal milestone', 'err'); return; }
    if (!_pqKelompok) return;

    showLoad();
    try {
      var r = await window.HQ.MuridAPI.addMilestone({
        id_kelompok: _pqKelompok.id_kelompok,
        judul: judul.trim(),
        tanggal: tgl
      });
      if (r.status === 'ok') {
        toast('Milestone berhasil disimpan! 🎯', 'ok');
        document.getElementById('pqMilestoneJudul').value = '';
        document.getElementById('pqMilestoneForm').style.display = 'none';
        await loadPartnerLiniMasa();
      } else {
        toast(r.message || 'Gagal menyimpan', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pqDeleteMilestone = async function(id_milestone) {
    if (!confirm('Apakah Anda yakin ingin menghapus milestone ini?')) return;
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.deleteMilestone(id_milestone);
      if (r.status === 'ok') {
        toast('Milestone berhasil dihapus! ✓', 'ok');
        await loadPartnerLiniMasa();
      } else {
        toast(r.message || 'Gagal menghapus', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  async function loadTargetKelompok() {
    var card = document.getElementById('pqTargetCard');
    var body = document.getElementById('pqTargetBody');
    if (!card || !body) return;
    if (!_pqKelompok) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    try {
      var res = await window.HQ.MuridAPI.getTargetKelompok();
      var list = res.data || [];
      if (list.length === 0) {
        body.innerHTML = '<div style="color:var(--text-3); text-align:center; padding:10px 0;">Belum ada target bersama kelompok.</div>';
        return;
      }

      var myId = (window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user) || '';

      body.innerHTML = list.map(function(t) {
        var tgl = t.tanggal_target ? fmtDate(t.tanggal_target) : 'Tanpa deadline';
        var progressList = t.target_partner_progress || [];
        var isMeSelesai = progressList.some(function(p) { return p.id_murid === myId && p.selesai_at; });
        var numDone = progressList.filter(function(p) { return p.selesai_at; }).length;
        var numTotal = _pqKelompok.anggota_kelompok_partner ? _pqKelompok.anggota_kelompok_partner.length : 3;

        var progressCheckHtml = '<input type="checkbox" ' + (isMeSelesai ? 'checked' : '') 
          + ' onclick="pqTandaiTarget(\'' + t.id_target + '\', this.checked)" '
          + ' style="width:16px; height:16px; cursor:pointer;">';

        var canDel = t.dibuat_oleh === myId;
        var delBtn = canDel ? ' <button onclick="pqDeleteTarget(\'' + t.id_target + '\')" style="background:none; border:none; color:var(--red); font-size:11px; cursor:pointer; font-weight:700; padding:2px 6px;">[Hapus]</button>' : '';

        var partnersDoneHtml = progressList.map(function(p) {
          var label = _esc(p.nama_murid) + (p.id_murid === myId ? ' (Kamu)' : '');
          var statusIcon = p.selesai_at ? '✅' : '⏳';
          return '<div style="font-size:11px; margin-top:2px; color:var(--text-2);">' + statusIcon + ' ' + label + '</div>';
        }).join('');

        return '<div style="background:var(--bg-2); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:10px;">'
          + '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">'
          + '    <div style="display:flex; gap:10px; align-items:flex-start;">'
          + '      <div style="margin-top:2px;">' + progressCheckHtml + '</div>'
          + '      <div>'
          + '        <div style="font-weight:700; font-size:12.5px; color:var(--text);">' + _esc(t.judul) + '</div>'
          + '        <div style="font-size:10.5px; color:var(--text-3); margin-top:2px;">📅 Batas: ' + tgl + '</div>'
          + '      </div>'
          + '    </div>'
          + '    <div>' + delBtn + '</div>'
          + '  </div>'
          + '  <div style="height:5px; background:var(--border); border-radius:100px; margin-top:10px; overflow:hidden;">'
          + '    <div style="height:100%; background:var(--green); width:' + Math.min(100, Math.round((numDone / numTotal) * 100)) + '%; border-radius:100px;"></div>'
          + '  </div>'
          + '  <div style="font-size:10.5px; color:var(--text-3); margin-top:6px; font-weight:600;">Selesai: ' + numDone + ' dari ' + numTotal + ' anggota</div>'
          + '  <div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:6px;">' + partnersDoneHtml + '</div>'
          + '</div>';
      }).join('');
    } catch(e) {
      console.error('loadTargetKelompok error:', e);
      body.innerHTML = '<div style="color:var(--red)">Gagal memuat target kelompok.</div>';
    }
  }

  window.pqToggleTargetForm = function() {
    var form = document.getElementById('pqTargetForm');
    if (form) {
      var isNone = form.style.display === 'none';
      form.style.display = isNone ? 'block' : 'none';
      if (isNone) {
        var tgl = document.getElementById('pqTargetTgl');
        if (tgl && !tgl.value) tgl.value = localDateStr();
        document.getElementById('pqTargetJudul').focus();
      }
    }
  };

  window.pqSaveTarget = async function() {
    var judul = (document.getElementById('pqTargetJudul') || {}).value || '';
    var tgl = (document.getElementById('pqTargetTgl') || {}).value || '';

    if (!judul.trim()) { toast('Masukkan judul target', 'err'); return; }
    if (!_pqKelompok) return;

    showLoad();
    try {
      var r = await window.HQ.MuridAPI.addTargetKelompok({
        id_kelompok: _pqKelompok.id_kelompok,
        id_halaqah: _pqKelompok.id_halaqah,
        judul: judul.trim(),
        tanggal_target: tgl || null
      });
      if (r.status === 'ok') {
        toast('Target bersama berhasil dibuat! 🎯', 'ok');
        document.getElementById('pqTargetJudul').value = '';
        document.getElementById('pqTargetForm').style.display = 'none';
        await loadTargetKelompok();
      } else {
        toast(r.message || 'Gagal membuat target', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pqDeleteTarget = async function(id_target) {
    if (!confirm('Apakah Anda yakin ingin menghapus target ini?')) return;
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.deleteTargetKelompok(id_target);
      if (r.status === 'ok') {
        toast('Target bersama berhasil dihapus! ✓', 'ok');
        await loadTargetKelompok();
      } else {
        toast(r.message || 'Gagal menghapus', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

  window.pqTandaiTarget = async function(id_target, selesai) {
    showLoad();
    try {
      var r = await window.HQ.MuridAPI.tandaiProgressTargetPartner(id_target, selesai);
      if (r.status === 'ok') {
        toast(selesai ? 'Target berhasil ditandai selesai! 🎉' : 'Progress target dibatalkan', 'ok');
        await loadTargetKelompok();
      } else {
        toast(r.message || 'Gagal memperbarui target', 'err');
      }
    } catch(e) {
      toast(friendlyError(e), 'err');
    } finally {
      hideLoad();
    }
  };

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
  window.loadPbRiwayat = loadPbRiwayat;
  window.loadPartnerBelajarMenunggu = loadPartnerBelajarMenunggu;
  window.loadPartnerBelajarLiniMasa = loadPartnerBelajarLiniMasa;
  window.loadTargetBelajar = loadTargetBelajar;
  window.loadPartnerKelompok = loadPartnerKelompok;
  window.loadPartnerMenunggu = loadPartnerMenunggu;
  window.loadPartnerLiniMasa = loadPartnerLiniMasa;
  window.loadTargetKelompok = loadTargetKelompok;
})();
