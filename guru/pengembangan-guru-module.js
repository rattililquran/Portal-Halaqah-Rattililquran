// ============================================================
//  Portal Guru — Pengembangan Pengajar (patch_082)
//  Tab: 🤝 Halaqah Pengajar (peer) · 👤 Profil Saya · 📝 Binaan (Musyrif only)
//  Pola IIFE + window.HQ.GuruAPI + toast/showLoad/esc (sama dgn modul guru lain).
// ============================================================
(function() {
  "use strict";

  var KATEGORI = ['makhraj', 'sifat', 'dalil', 'tajwid', 'hafalan', 'lainnya'];
  var NILAI = ['A', 'B', 'C'];
  var KELANCARAN = ['Lancar', 'Cukup', 'Perlu Perbaikan'];
  var JENJANG_BADGE = { pemula: 'background:#e0f2fe;color:#075985', madya: 'background:#fef3c7;color:#92400e', utama: 'background:#dcfce7;color:#166534' };

  var PG = { tab: 'peer', musyrif: false, myId: null, kelompok: [], indikator: [] };

  function _root() { return document.getElementById('pgRoot'); }
  function _body(h) { var b = document.getElementById('pgBody'); if (b) b.innerHTML = h; }
  function _busy() { _body('<div style="padding:20px;color:var(--text-3,#6b7280)">⏳ Memuat...</div>'); }
  function _err(e) { _body('<div style="padding:20px;color:#dc2626">Gagal: ' + esc(friendlyError(e)) + '</div>'); }
  function _optTags(arr, sel) { return arr.map(function(v) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }
  // Label bertumbuh (bukan menghakimi). Nilai enum DB tetap.
  function _hasilLabel(h) { return h === 'mengulang' ? 'lanjut berproses' : (h === 'lulus' ? 'lulus' : (h || '—')); }
  var _RUH = '«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — sebaik-baik kita yang belajar & mengajarkan Al-Qur\'an. Ini ikhtiar tumbuh bersama, bukan rapor kinerja.';
  function _ruhBar() { return '<div class="pg-note" style="margin-bottom:12px">🌿 ' + _RUH + '</div>'; }
  function _privasiBar() { return '<div style="font-size:11px;color:var(--text-3);margin-top:8px">🔒 Data ini rahasia — hanya Anda &amp; pembina yang melihatnya, untuk tumbuh bersama.</div>'; }

  function _pgStyles() {
    return '<style id="pgStyles">'
      + '#pgRoot{--pg-a:#0ea5e9;--pg-a2:#38bdf8;--pg-ad:#2563eb}'
      + '#pgRoot *{box-sizing:border-box}'
      // Segmented tabs
      + '.pg-tabs{display:flex;gap:4px;padding:4px;background:rgba(0,0,0,.045);border:1px solid var(--border);border-radius:14px;margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch}'
      + '.pg-tab{flex:1 0 auto;white-space:nowrap;border:none;border-radius:10px;padding:9px 15px;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--text-2);background:transparent;transition:color .18s,background .18s,box-shadow .18s}'
      + '.pg-tab:hover{color:var(--text)}'
      + '.pg-tab.on{background:linear-gradient(135deg,var(--pg-a),var(--pg-ad));color:#fff;box-shadow:0 4px 13px rgba(14,165,233,.3)}'
      + 'html.theme-dark .pg-tabs{background:rgba(255,255,255,.05)}'
      // Hero
      + '.pg-hero{position:relative;overflow:hidden;border-radius:16px;padding:16px 18px;margin-bottom:14px;background:linear-gradient(135deg,rgba(14,165,233,.13),rgba(56,189,248,.05));border:1px solid rgba(14,165,233,.18)}'
      + '.pg-hero::after{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,.18),transparent 70%);pointer-events:none}'
      + '.pg-hero .ar{font-family:\'Amiri\',serif;font-size:17px;color:var(--blue);line-height:1.95;margin-bottom:5px;position:relative}'
      + '.pg-hero .msg{font-size:12.5px;color:var(--text-2);line-height:1.6;position:relative}'
      + 'html.theme-dark .pg-hero{background:linear-gradient(135deg,rgba(56,189,248,.13),rgba(56,189,248,.04));border-color:rgba(56,189,248,.2)}'
      // Stat tiles
      + '.pg-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin-bottom:16px}'
      + '.pg-stat{background:var(--card);border:1px solid var(--border);border-radius:13px;padding:12px 14px;position:relative;overflow:hidden}'
      + '.pg-stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--pg-a),var(--pg-a2))}'
      + '.pg-stat .v{font-size:23px;font-weight:800;color:var(--text);line-height:1}'
      + '.pg-stat .l{font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-top:6px}'
      + 'html.theme-dark .pg-stat{background:rgba(255,255,255,.04)}'
      // Cards
      + '.pg-card{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:15px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:box-shadow .22s,transform .22s}'
      + '.pg-card:hover{box-shadow:0 10px 26px rgba(0,0,0,.08);transform:translateY(-1px)}'
      + 'html.theme-dark .pg-card{background:rgba(255,255,255,.035)}'
      + 'html.theme-dark .pg-card:hover{box-shadow:0 10px 26px rgba(0,0,0,.35)}'
      + '.pg-card-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}'
      + '.pg-card-t{font-weight:800;font-size:15px;color:var(--text);line-height:1.25}'
      + '.pg-card-sub{font-size:11.5px;color:var(--text-3);margin-top:3px}'
      // Buttons
      + '.pg-btn{border:none;border-radius:10px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .12s,filter .15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}'
      + '.pg-btn:active{transform:scale(.95)}'
      + '.pg-btn-primary{background:linear-gradient(135deg,var(--pg-a),var(--pg-ad));color:#fff;box-shadow:0 3px 10px rgba(14,165,233,.3)}'
      + '.pg-btn-primary:hover{filter:brightness(1.06)}'
      + '.pg-btn-soft{background:rgba(217,119,6,.13);color:#b45309}'
      + '.pg-btn-soft:hover{background:rgba(217,119,6,.2)}'
      + 'html.theme-dark .pg-btn-soft{background:rgba(217,119,6,.2);color:#fbbf24}'
      // Chips
      + '.pg-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}'
      + '.pg-chip{font-size:10.5px;font-weight:700;color:var(--text-2);background:rgba(0,0,0,.05);border-radius:100px;padding:3px 10px;display:inline-flex;align-items:center;gap:4px}'
      + 'html.theme-dark .pg-chip{background:rgba(255,255,255,.08)}'
      // Empty
      + '.pg-empty{text-align:center;color:var(--text-3);font-size:13px;padding:34px 18px;line-height:1.75;background:var(--card);border:1px dashed var(--border);border-radius:15px}'
      + '.pg-empty .ico{font-size:34px;display:block;margin-bottom:8px;opacity:.85}'
      + 'html.theme-dark .pg-empty{background:rgba(255,255,255,.03)}'
      // Profil sections
      + '.pg-sec{margin-bottom:14px}'
      + '.pg-sec-t{font-size:12.5px;font-weight:800;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:6px}'
      + '.pg-row{font-size:12px;color:var(--text-2);padding:9px 11px;border-radius:10px;background:rgba(0,0,0,.025);margin-bottom:5px;line-height:1.5}'
      + 'html.theme-dark .pg-row{background:rgba(255,255,255,.035)}'
      + '.pg-badge{font-size:12px;font-weight:800;border-radius:100px;padding:4px 13px;text-transform:capitalize}'
      + '.pg-note{background:rgba(0,0,0,.025);border-radius:11px;padding:11px 13px;font-size:11.5px;color:var(--text-2);line-height:1.65}'
      + 'html.theme-dark .pg-note{background:rgba(255,255,255,.04)}'
      // Modal (dipasang global karena #pgModal menempel di body) — dark-aware
      + '@keyframes pgFade{from{opacity:0}to{opacity:1}}'
      + '.pg-modal-card{background:#fff;color:var(--text);border-radius:16px;max-width:440px;width:100%;max-height:85vh;overflow:auto;padding:20px;box-shadow:0 24px 64px rgba(0,0,0,.32);animation:pgPop .2s cubic-bezier(.2,.8,.2,1)}'
      + '@keyframes pgPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}'
      + 'html.theme-dark .pg-modal-card{background:#1a1d24;color:#e8eaed}'
      + '.pg-modal-title{font-weight:800;font-size:15px;margin-bottom:14px;color:var(--text)}'
      + 'html.theme-dark .pg-modal-title{color:#f0f2f8}'
      + '#pgModal .pg-inp{width:100%;box-sizing:border-box;font-size:13px;padding:9px 11px;border-radius:9px;border:1px solid var(--border);background:#fff;color:inherit;transition:border-color .15s,box-shadow .15s}'
      + '#pgModal .pg-inp:focus{outline:none;border-color:var(--pg-a);box-shadow:0 0 0 3px rgba(14,165,233,.14)}'
      + 'html.theme-dark #pgModal .pg-inp{background:#22262e;border-color:rgba(255,255,255,.13)}'
      + '.pg-modal-cancel{border:none;background:#f1f5f9;color:#334155;border-radius:9px;padding:8px 15px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s}'
      + '.pg-modal-cancel:hover{background:#e2e8f0}'
      + 'html.theme-dark .pg-modal-cancel{background:rgba(255,255,255,.08);color:#cbd5e1}'
      + '.pg-modal-ok{border:none;background:linear-gradient(135deg,var(--pg-a),var(--pg-ad));color:#fff;border-radius:9px;padding:8px 17px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(14,165,233,.3)}'
      + '.pg-modal-ok:disabled{cursor:default}'
      + '</style>';
  }

  async function loadPengembanganGuru() {
    var r = _root(); if (!r) return;
    PG.myId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id_user : null;
    r.innerHTML = _pgStyles() + '<div id="pgTabs"></div><div id="pgBody"></div>';
    _busy();
    try { var p = await window.HQ.Auth.getProfile(); PG.musyrif = !!(p.data && p.data.is_musyrif); }
    catch (e) { PG.musyrif = false; }
    _renderTabs();
    pgGoTab(PG.tab);
  }

  function _tabs() {
    var t = [{ id: 'peer', label: '🤝 Halaqah Pengajar' }, { id: 'profil', label: '👤 Profil Saya' }];
    if (PG.musyrif) t.push({ id: 'binaan', label: '📝 Binaan (Musyrif)' });
    return t;
  }
  function _renderTabs() {
    var el = document.getElementById('pgTabs'); if (!el) return;
    el.innerHTML = '<div class="pg-tabs">'
      + _tabs().map(function(t) {
          return '<button class="pg-tab' + (t.id === PG.tab ? ' on' : '') + '" onclick="pgGoTab(\'' + t.id + '\')">' + t.label + '</button>';
        }).join('')
      + '</div>';
  }
  function pgGoTab(tab) {
    if (tab === 'binaan' && !PG.musyrif) tab = 'peer';
    PG.tab = tab; _renderTabs(); _busy();
    ({ peer: _loadPeer, profil: _loadProfil, binaan: _loadBinaan }[tab] || _loadPeer)();
  }

  // ══════════════════ TAB: HALAQAH PENGAJAR (PEER) ══════════════════
  async function _loadPeer() {
    try {
      // Kelompok = inti (wajib). Rekap = sekunder — kegagalannya tak boleh
      // mengosongkan daftar kelompok (debug #2). allSettled + fallback {}.
      var settled = await Promise.allSettled([
        window.HQ.GuruAPI.getKelompokPengajarku(),
        window.HQ.GuruAPI.getRekapPeerSaya(),
      ]);
      if (settled[0].status !== 'fulfilled') throw (settled[0].reason || new Error('Gagal memuat kelompok'));
      PG.kelompok = (settled[0].value && settled[0].value.data) || [];
      var rekap = (settled[1].status === 'fulfilled' && settled[1].value.data) || {};
      if (!PG.kelompok.length) {
        _body('<div class="pg-empty"><span class="ico">🤝</span>Anda belum tergabung di halaqah pengajar mana pun.<br>Hubungi admin untuk dimasukkan ke kelompok pembinaan.</div>');
        return;
      }
      var totalKontribusi = (rekap.total_setor || 0) + (rekap.total_simak || 0);
      var sapa = totalKontribusi > 0
        ? '🌱 Alhamdulillah, sudah <strong>' + totalKontribusi + '</strong> kali tumbuh bersama rekan. Barakallahu fiik.'
        : '🌱 Mari mulai saling menyimak — sekecil apa pun langkahnya, berharga.';
      var head = '<div class="pg-hero"><div class="ar">خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ</div><div class="msg">' + sapa + '</div></div>'
        + '<div class="pg-stats">'
        + _mini('Setoran keluar', rekap.total_setor || 0)
        + _mini('Menyimak rekan', rekap.total_simak || 0)
        + (rekap.kategori_dominan ? _mini('Fokus tersering', esc(rekap.kategori_dominan)) : '')
        + '</div>';
      _body(head + PG.kelompok.map(_peerCard).join(''));
      PG.kelompok.forEach(function(k) { _loadSetoranKelompok(k.id_kelompok); });
    } catch (e) { _err(e); }
  }

  function _mini(label, val) {
    return '<div class="pg-stat"><div class="v">' + val + '</div><div class="l">' + label + '</div></div>';
  }

  function _peerCard(k) {
    var anggota = (k.anggota || []).map(function(a) { return '<span class="pg-chip">👤 ' + esc(a.nama_guru || a.id_guru) + '</span>'; }).join('') || '<span class="pg-chip">—</span>';
    return '<div class="pg-card">'
      + '<div class="pg-card-h">'
      + '<div><div class="pg-card-t">' + esc(k.nama_kelompok) + '</div>'
      + '<div class="pg-card-sub">' + (k.fokus ? esc(k.fokus) + ' · ' : '') + (k.jadwal ? '🗓️ ' + esc(k.jadwal) : (k.fokus ? '' : '&nbsp;')) + '</div></div>'
      + '<button class="pg-btn pg-btn-primary" onclick="pgSetorForm(\'' + escJs(k.id_kelompok) + '\')">+ Setor</button>'
      + '</div>'
      + '<div class="pg-chips">' + anggota + '</div>'
      + '<div style="margin-top:11px"><button class="pg-btn pg-btn-soft" onclick="pgToggleTarget(\'' + escJs(k.id_kelompok) + '\')">🎯 Target &amp; Milestone</button></div>'
      + '<div id="pgTgt_' + esc(k.id_kelompok) + '" style="display:none;margin-top:10px"></div>'
      + '<div id="pgSet_' + esc(k.id_kelompok) + '" style="margin-top:12px"><div style="font-size:11px;color:var(--text-3)">⏳ Memuat setoran...</div></div>'
      + '</div>';
  }

  function pgToggleTarget(id_kelompok) {
    var c = document.getElementById('pgTgt_' + id_kelompok);
    if (!c) return;
    if (c.style.display !== 'none') { c.style.display = 'none'; return; }
    c.style.display = 'block';
    _loadTargetMilestone(id_kelompok);
  }

  async function _loadTargetMilestone(id_kelompok) {
    var c = document.getElementById('pgTgt_' + id_kelompok);
    if (!c) return;
    c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
    try {
      var d = (await window.HQ.GuruAPI.getTargetMilestoneKelompok(id_kelompok)).data || {};
      var kj = escJs(id_kelompok);
      var tHtml = (d.target || []).map(function(t) {
        var done = t.status === 'tercapai';
        return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(245,158,11,.08);border-radius:8px;margin-bottom:5px">'
          + '<span style="font-size:11px;font-weight:700;color:#92400e;flex:1;min-width:0">🎯 ' + esc(t.judul)
          + (done ? ' <span style="font-size:10px;font-weight:800;color:#15803d;background:rgba(22,163,74,.14);border-radius:100px;padding:1px 7px">tercapai</span>' : (t.tanggal_target ? ' <span style="font-size:10px;color:var(--text-3)">· ' + esc(t.tanggal_target) + '</span>' : '')) + '</span>'
          + (done ? '' : '<button onclick="pgMarkTarget(\'' + escJs(t.id_target) + '\',\'' + kj + '\')" title="Tandai tercapai" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✓</button>')
          + '<button onclick="pgDelTgt(\'target\',\'' + escJs(t.id_target) + '\',\'' + kj + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px">✕</button>'
          + '</div>';
      }).join('') || '<div style="font-size:11px;color:var(--text-3)">Belum ada target.</div>';
      var mHtml = (d.milestone || []).map(function(m) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px">'
          + '<span style="flex:1">🏆 ' + esc(m.judul) + ' <span style="color:var(--text-3);font-size:10px">· ' + esc(m.tanggal || '') + '</span></span>'
          + '<button onclick="pgDelTgt(\'milestone\',\'' + escJs(m.id_milestone) + '\',\'' + kj + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px">✕</button>'
          + '</div>';
      }).join('') || '<div style="font-size:11px;color:var(--text-3)">Belum ada milestone.</div>';
      c.innerHTML = '<div style="border:1px dashed var(--border,#e5e7eb);border-radius:9px;padding:10px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:11px;font-weight:800;color:#b45309">🎯 Target Bersama</span>'
        + '<button onclick="pgAddTarget(\'' + kj + '\')" style="border:none;background:#d97706;color:#fff;border-radius:6px;padding:3px 9px;font-size:10px;font-weight:800;cursor:pointer">+ Target</button></div>'
        + tHtml
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 5px"><span style="font-size:11px;font-weight:800;color:#166534">🏆 Milestone</span>'
        + '<button onclick="pgAddMilestone(\'' + kj + '\')" style="border:none;background:#16a34a;color:#fff;border-radius:6px;padding:3px 9px;font-size:10px;font-weight:800;cursor:pointer">+ Milestone</button></div>'
        + mHtml
        + '</div>';
    } catch (e) { c.innerHTML = '<div style="font-size:11px;color:#dc2626">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
  }

  async function pgAddTarget(id_kelompok) {
    var judul = prompt('Target bersama (mis: Semua anggota khatam Matan Jazariyah):'); if (judul === null || !judul.trim()) return;
    var tgl = prompt('Tanggal target (YYYY-MM-DD, opsional):', '') || '';
    if (tgl.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(tgl.trim())) { toast('Tanggal tidak valid', 'err'); return; }
    try {
      await window.HQ.GuruAPI.upsertTargetKelompok({ tipe: 'target', id_kelompok: id_kelompok, judul: judul.trim(), tanggal_target: tgl.trim() || null });
      toast('Target ditetapkan', 'ok'); _loadTargetMilestone(id_kelompok);
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  async function pgAddMilestone(id_kelompok) {
    var judul = prompt('Tandai milestone (mis: Ustadz A khatam bab isti\'la\'):'); if (judul === null || !judul.trim()) return;
    try {
      await window.HQ.GuruAPI.upsertTargetKelompok({ tipe: 'milestone', id_kelompok: id_kelompok, judul: judul.trim() });
      toast('Milestone ditandai', 'ok'); _loadTargetMilestone(id_kelompok);
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  async function pgMarkTarget(id_target, id_kelompok) {
    try {
      await window.HQ.GuruAPI.upsertTargetKelompok({ tipe: 'target', id_target: id_target, status: 'tercapai' });
      toast('Target tercapai 🎉', 'ok'); _loadTargetMilestone(id_kelompok);
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  async function pgDelTgt(tipe, id, id_kelompok) {
    var d = { tipe: tipe };
    d[tipe === 'milestone' ? 'id_milestone' : 'id_target'] = id;
    try {
      await window.HQ.GuruAPI.hapusTargetKelompok(d);
      toast('Dihapus', 'ok'); _loadTargetMilestone(id_kelompok);
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  async function _loadSetoranKelompok(id_kelompok) {
    var c = document.getElementById('pgSet_' + id_kelompok);
    if (!c) return;
    try {
      var res = await window.HQ.GuruAPI.getSetoranKelompok(id_kelompok);
      var list = res.data || [];
      var pendingSimak = list.filter(function(s) { return s.id_penyimak === PG.myId && !s.nilai; });
      var html = '';
      if (pendingSimak.length) {
        html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px;margin-bottom:8px">'
          + '<div style="font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px">⏳ Menunggu Anda menyimak (' + pendingSimak.length + ')</div>'
          + pendingSimak.map(function(s) {
              return '<div style="padding:4px 0">'
                + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">'
                + '<span style="font-size:12px">' + esc(s.nama_penyetor || s.id_penyetor) + ' · <strong>' + esc(s.kategori) + '</strong>' + (s.sub_materi ? ' · ' + esc(s.sub_materi) : '') + '</span>'
                + '<button onclick="pgSimakForm(\'' + escJs(s.id_setoran) + '\',\'' + escJs(id_kelompok) + '\')" style="border:none;background:#16a34a;color:#fff;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:800;cursor:pointer">Nilai</button>'
                + '</div>'
                + _pgAudioBtnHtml(s.audio_url)
                + '</div>';
            }).join('')
          + '</div>';
      }
      var recent = list.slice(0, 5).map(function(s) {
        var nilaiBadge = s.nilai ? '<span style="font-size:10px;font-weight:800;background:#dcfce7;color:#166534;border-radius:100px;padding:1px 7px">' + esc(s.nilai) + (s.kelancaran ? ' · ' + esc(s.kelancaran) : '') + '</span>' : '<span style="font-size:10px;color:#92400e">belum dinilai</span>';
        return '<div style="font-size:11px;padding:4px 0;border-top:1px solid var(--border,#f1f5f9)">'
          + esc(s.nama_penyetor || '-') + ' → ' + esc(s.nama_penyimak || '-') + ' · <strong>' + esc(s.kategori) + '</strong> ' + nilaiBadge
          + (s.dalil ? '<div style="color:#0f766e;font-size:10px">📜 ' + esc(s.dalil) + '</div>' : '')
          + (s.catatan ? '<div style="color:var(--text-3);font-size:10px">💬 ' + esc(s.catatan) + '</div>' : '')
          + _pgAudioBtnHtml(s.audio_url)
          + '</div>';
      }).join('');
      c.innerHTML = html + (recent ? '<div style="font-size:11px;font-weight:700;color:var(--text-3);margin-top:4px">Terbaru</div>' + recent : (html ? '' : '<div style="font-size:11px;color:var(--text-3)">Belum ada setoran.</div>'));
    } catch (e) { c.innerHTML = '<div style="font-size:11px;color:#dc2626">Gagal memuat setoran.</div>'; }
  }

  function pgSetorForm(id_kelompok) {
    var k = PG.kelompok.filter(function(x) { return x.id_kelompok === id_kelompok; })[0];
    var anggota = ((k && k.anggota) || [])
      .filter(function(a) { return a.id_guru !== PG.myId; })
      .map(function(a) { return { id: a.id_guru, nama: a.nama_guru || a.id_guru }; });
    if (!anggota.length) { toast('Belum ada rekan lain di kelompok ini untuk menyimak.', 'err'); return; }
    pgRecReset();
    var body = ''
      + _fld('Simak oleh (rekan)', '<select id="pgSetPenyimak" class="pg-inp">' + anggota.map(function(a) { return '<option value="' + esc(a.id) + '">' + esc(a.nama) + '</option>'; }).join('') + '</select>')
      + _fld('Kategori', '<select id="pgSetKategori" class="pg-inp">' + _optTags(KATEGORI, 'makhraj') + '</select>')
      + _fld('Sub materi (opsional)', '<input id="pgSetSub" class="pg-inp" placeholder="mis. Huruf isti\'la\'">')
      + _fld('Dalil / matan (opsional)', '<textarea id="pgSetDalil" class="pg-inp" rows="2" placeholder="mis. dari Matan Al-Jazariyah"></textarea>')
      + _fld('Catatan (opsional)', '<input id="pgSetCatatan" class="pg-inp" placeholder="konteks setoran">')
      + _pgRecHtml();
    pgModal('Setor ke Rekan', body, async function() {
      var penyimakSel = document.getElementById('pgSetPenyimak');
      var d = {
        id_kelompok: id_kelompok,
        id_penyimak: penyimakSel.value,
        nama_penyimak: penyimakSel.options[penyimakSel.selectedIndex].textContent,
        nama_penyetor: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nama_lengkap : null,
        kategori: document.getElementById('pgSetKategori').value,
        sub_materi: document.getElementById('pgSetSub').value.trim() || null,
        dalil: document.getElementById('pgSetDalil').value.trim() || null,
        catatan: document.getElementById('pgSetCatatan').value.trim() || null,
      };
      var audio = await _pgUploadAudio(id_kelompok);
      if (audio) { d.audio_url = audio.url; d.audio_durasi_detik = audio.durasi; d.audio_tipe = audio.tipe; }
      await window.HQ.GuruAPI.simpanSetoranPeer(d);
      toast('Setoran terkirim', 'ok');
      pgRecReset();
      _loadSetoranKelompok(id_kelompok);
    });
  }

  function pgSimakForm(id_setoran, id_kelompok) {
    var body = ''
      + _fld('Nilai', '<select id="pgSimakNilai" class="pg-inp">' + _optTags(NILAI, 'A') + '</select>')
      + _fld('Kelancaran', '<select id="pgSimakLancar" class="pg-inp">' + _optTags(KELANCARAN, 'Lancar') + '</select>')
      + _fld('Umpan balik (opsional)', '<textarea id="pgSimakCatatan" class="pg-inp" rows="2" placeholder="mis. tafkhim perlu dikuatkan"></textarea>');
    pgModal('Simak & Nilai Setoran', body, async function() {
      await window.HQ.GuruAPI.nilaiSetoranPeer({
        id_setoran: id_setoran,
        nilai: document.getElementById('pgSimakNilai').value,
        kelancaran: document.getElementById('pgSimakLancar').value,
        catatan: document.getElementById('pgSimakCatatan').value.trim() || null,
      });
      toast('Penilaian tersimpan', 'ok');
      _loadSetoranKelompok(id_kelompok);
    });
  }

  // ══════════════════ TAB: PROFIL SAYA ══════════════════
  async function _loadProfil() {
    try {
      var d = (await window.HQ.GuruAPI.getProfilPengajarSaya()).data || {};
      var k = d.kompetensi || {};
      var jenjang = k.jenjang || 'pemula';
      var head = '<div class="pg-card">'
        + '<div class="pg-jenjang" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
        + '<span class="pg-badge" style="' + (JENJANG_BADGE[jenjang] || '') + '">' + esc(jenjang) + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:' + (k.status_sertifikasi === 'tersertifikasi' ? '#166534' : '#92400e') + '">' + esc(k.status_sertifikasi || 'orientasi') + '</span>'
        + (k.hafalan_juz != null ? '<span style="font-size:11px;color:var(--text-3)">· ' + esc(k.hafalan_juz) + ' juz</span>' : '')
        + '</div>'
        + (k.status_sanad ? '<div style="font-size:12px;color:var(--text-3);margin-top:8px">Sanad: ' + esc(k.status_sanad) + '</div>' : '')
        + _privasiBar()
        + '</div>';
      var evalSec = _profilList('📊 Evaluasi', (d.evaluasi || []).map(function(e) {
        return '<strong>' + (e.nilai_akhir != null ? e.nilai_akhir : '—') + '</strong> · ' + esc(e.tanggal || '') + (e.catatan ? ' · ' + esc(e.catatan) : '');
      }));
      var tashihSec = _profilList('🎤 Tashih', (d.tashih || []).map(function(t) {
        var baik = 0, tot = 0;
        if (t.skor && typeof t.skor === 'object') { Object.keys(t.skor).forEach(function(k){ tot++; if (t.skor[k] === 'baik') baik++; }); }
        return esc(t.tanggal || '') + ' · ' + esc(t.surat_diuji || '-') + ' · ' + esc(_hasilLabel(t.hasil))
          + (tot ? ' <span style="color:#166534;font-size:10px">✓ ' + baik + '/' + tot + ' butir sudah baik</span>' : '');
      }));
      var mtbSec = _profilList('🎯 Tindak lanjut & harapan', (d.mutabaah || []).map(function(m) {
        return '<strong>' + esc(m.status) + '</strong> · ' + esc(m.temuan) + (m.rencana ? ' → ' + esc(m.rencana) : '');
      }));
      var jenjangSec = _profilList('🪜 Riwayat Jenjang', (d.riwayat_jenjang || []).map(function(r) {
        return esc(r.tanggal || '') + ' · ' + esc(r.jenjang_lama || '-') + ' → <strong>' + esc(r.jenjang_baru) + '</strong>';
      }));
      _body(_ruhBar() + head + evalSec + tashihSec + mtbSec + jenjangSec);
    } catch (e) { _err(e); }
  }

  function _profilList(title, items) {
    return '<div class="pg-sec"><div class="pg-sec-t">' + title + '</div>'
      + (items.length ? items.map(function(x) { return '<div class="pg-row">' + x + '</div>'; }).join('')
                      : '<div style="font-size:11.5px;color:var(--text-3);padding:4px 2px">Belum ada.</div>')
      + '</div>';
  }

  // ══════════════════ TAB: BINAAN (MUSYRIF) ══════════════════
  async function _loadBinaan() {
    if (!PG.musyrif) { _body('<div style="padding:16px;color:var(--text-3)">Khusus Musyrif.</div>'); return; }
    try {
      // Daftar binaan = inti. Indikator = sekunder (dipakai saat buka form evaluasi;
      // pgEvaluasiForm sudah menjaga bila kosong). allSettled agar tak saling menjatuhkan.
      var settled = await Promise.allSettled([
        window.HQ.GuruAPI.getBinaanSaya(),
        window.HQ.GuruAPI.getIndikatorEvaluasi(),
      ]);
      if (settled[0].status !== 'fulfilled') throw (settled[0].reason || new Error('Gagal memuat binaan'));
      var binaan = ((settled[0].value && settled[0].value.data) || []).filter(function(u) { return u.id_user !== PG.myId; });
      PG.indikator = (settled[1].status === 'fulfilled' && settled[1].value.data) || [];
      var rows = binaan.map(function(u) {
        var k = u.kompetensi || {};
        return '<div class="pg-card" style="padding:13px">'
          + '<div class="pg-card-t" style="font-size:14px">' + esc(u.nama_lengkap) + ' <span style="font-size:10px;font-weight:700;color:var(--text-3)">· ' + esc(k.jenjang || 'pemula') + '</span></div>'
          + '<div style="display:flex;gap:6px;margin-top:11px;flex-wrap:wrap">'
          + '<button class="pg-btn" style="background:rgba(2,132,199,.12);color:#0284c7" onclick="pgTashihForm(\'' + escJs(u.id_user) + '\')">🎤 Tashih</button>'
          + '<button class="pg-btn" style="background:rgba(124,58,237,.12);color:#7c3aed" onclick="pgEvaluasiForm(\'' + escJs(u.id_user) + '\')">📊 Evaluasi</button>'
          + '<button class="pg-btn" style="background:rgba(217,119,6,.13);color:#b45309" onclick="pgMutabaahForm(\'' + escJs(u.id_user) + '\')">🎯 Mutaba\'ah</button>'
          + '</div></div>';
      }).join('');
      _body('<div class="pg-note" style="margin-bottom:12px">🤝 Membina dengan lembut &amp; menguatkan — dahulukan apresiasi atas koreksi. Data mutu bersifat rahasia (hanya Anda &amp; admin).</div>'
        + (rows || '<div class="pg-empty"><span class="ico">🌱</span>Belum ada pengajar binaan.</div>'));
    } catch (e) { _err(e); }
  }

  function pgTashihForm(id_guru) {
    var butir = ['makhraj', 'sifat', 'tajwid', 'waqaf', 'tartil'];
    var body = _fld('Surat/ayat diuji', '<input id="pgTsSurat" class="pg-inp" placeholder="mis. Al-Fatihah">')
      + butir.map(function(b) {
          return _fld(b.charAt(0).toUpperCase() + b.slice(1), '<select id="pgTs_' + b + '" class="pg-inp"><option value="baik">Baik</option><option value="perlu">Perlu perbaikan</option></select>');
        }).join('')
      + _fld('Hasil', '<select id="pgTsHasil" class="pg-inp"><option value="lulus">Lulus</option><option value="mengulang">Lanjut berproses</option></select>')
      + _fld('Catatan (opsional)', '<textarea id="pgTsCatatan" class="pg-inp" rows="2"></textarea>');
    pgModal('Tashih Bacaan Pengajar', body, async function() {
      var skor = {};
      butir.forEach(function(b) { skor[b] = document.getElementById('pgTs_' + b).value; });
      await window.HQ.GuruAPI.simpanTashihPengajar({
        id_guru: id_guru, surat_diuji: document.getElementById('pgTsSurat').value.trim() || null,
        skor: skor, hasil: document.getElementById('pgTsHasil').value,
        catatan: document.getElementById('pgTsCatatan').value.trim() || null,
      });
      toast('Tashih tersimpan', 'ok');
    });
  }

  function pgEvaluasiForm(id_guru) {
    if (!PG.indikator.length) { toast('Indikator evaluasi belum diatur admin.', 'err'); return; }
    var body = PG.indikator.map(function(it) {
      return _fld(esc(it.nama) + ' <span style="color:var(--text-3);font-weight:400">(bobot ' + it.bobot + ')</span>',
        '<select id="pgEv_' + esc(it.id_indikator) + '" class="pg-inp">' + [5, 4, 3, 2, 1].map(function(n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select>');
    }).join('')
      + _fld('Catatan (opsional)', '<textarea id="pgEvCatatan" class="pg-inp" rows="2"></textarea>');
    pgModal('Evaluasi Pengajar', body, async function() {
      var skor = {};
      PG.indikator.forEach(function(it) {
        var el = document.getElementById('pgEv_' + it.id_indikator);
        if (el) skor[it.id_indikator] = Number(el.value);
      });
      await window.HQ.GuruAPI.simpanEvaluasiPengajar({
        id_guru: id_guru, skor: skor, catatan: document.getElementById('pgEvCatatan').value.trim() || null,
      });
      toast('Evaluasi tersimpan', 'ok');
    });
  }

  function pgMutabaahForm(id_guru) {
    var body = _fld('Area bertumbuh / catatan sayang', '<textarea id="pgMtTemuan" class="pg-inp" rows="2" placeholder="tulis dengan bahasa yang menguatkan"></textarea>')
      + _fld('Rencana perbaikan (opsional)', '<textarea id="pgMtRencana" class="pg-inp" rows="2"></textarea>')
      + _fld('Target waktu (opsional)', '<input id="pgMtTarget" type="date" class="pg-inp">');
    pgModal('Buka Mutaba\'ah', body, async function() {
      var temuan = document.getElementById('pgMtTemuan').value.trim();
      if (!temuan) { throw new Error('Catatan wajib diisi'); }
      await window.HQ.GuruAPI.upsertMutabaahPengajar({
        id_guru: id_guru, temuan: temuan,
        rencana: document.getElementById('pgMtRencana').value.trim() || null,
        target_waktu: document.getElementById('pgMtTarget').value || null,
        sumber: 'manual',
      });
      toast('Mutaba\'ah dibuka', 'ok');
    });
  }

  // ── Field + modal helper ──
  function _fld(label, control) {
    return '<div style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:3px">' + label + '</label>' + control + '</div>';
  }

  function pgModal(title, bodyHtml, onOk) {
    var old = document.getElementById('pgModal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pgModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;animation:pgFade .18s ease';
    ov.innerHTML = '<div class="pg-modal-card">'
      + '<div class="pg-modal-title">' + esc(title) + '</div>'
      + '<div>' + bodyHtml + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'
      + '<button class="pg-modal-cancel" onclick="pgCloseModal()">Batal</button>'
      + '<button id="pgModalOk" class="pg-modal-ok">Simpan</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('pgModalOk').onclick = async function() {
      var btn = this; var label = btn.textContent;
      btn.disabled = true; btn.textContent = '⏳ Menyimpan…'; btn.style.opacity = '.75';
      try { await onOk(); pgCloseModal(); }
      catch (e) { toast(friendlyError(e), 'err'); btn.disabled = false; btn.textContent = label; btn.style.opacity = ''; }
    };
  }
  function pgCloseModal() {
    // Selalu bebaskan sumber daya rekaman saat modal ditutup (Batal/backdrop/sukses)
    // agar mikrofon tak menyala terus & timer/blob-URL tak menggantung.
    pgRecReset();
    var m = document.getElementById('pgModal'); if (m) m.remove();
  }

  // ══════════════════ REKAM & UNGGAH AUDIO SETORAN PEER ══════════════════
  // Pola murid: file audio → Google Drive via GAS Web App; URL disimpan di
  // pengajar_setoran.audio_url. Reuse token get_latihan_upload_token (lintas-peran)
  // & pemutar putarAudioInline (sudah ada di portal guru via pr-jurnal-module.js).
  var PG_GAS_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbwtY2wL-JSwKU1rmrJBOoa_3JNsRibn5CARn6Fq3gfuD_CztOhx5vW6zbqc0Z_hgjj7/exec';
  function _pgRecBlank() {
    return { mr: null, stream: null, chunks: [], blob: null, mime: '', durasi: 0, t0: 0, timer: null, previewUrl: '', uploadedUrl: '' };
  }
  var _pgRec = _pgRecBlank();

  function _pgRecHtml() {
    return '<div style="margin-bottom:10px">'
      + '<label style="display:block;font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:3px">Rekaman suara (opsional)</label>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<button type="button" id="pgRecBtn" onclick="pgRecToggle()" style="border:none;background:#dc2626;color:#fff;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:800;cursor:pointer">🔴 Mulai Rekam</button>'
      + '<span id="pgRecDur" style="font-size:12px;color:var(--text-3);font-weight:700">00:00</span>'
      + '<button type="button" id="pgRecDel" onclick="pgRecReset()" style="display:none;border:1px solid var(--border,#e5e7eb);background:transparent;color:var(--text-3);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer">Hapus</button>'
      + '</div>'
      + '<audio id="pgRecPreview" controls style="display:none;width:100%;margin-top:8px;height:36px"></audio>'
      + '</div>';
  }

  // Hentikan SEMUA sumber daya aktif: mic, recorder, timer, blob-URL. Aman dipanggil
  // kapan pun (mis. saat modal ditutup) — mencegah mic menyala terus & timer bocor.
  function pgRecReset() {
    if (_pgRec.mr) {
      // Lepas onstop lebih dulu agar callback basi tak menulis ke state baru.
      try { _pgRec.mr.onstop = null; if (_pgRec.mr.state === 'recording') _pgRec.mr.stop(); } catch (e) {}
    }
    if (_pgRec.stream) { try { _pgRec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    if (_pgRec.timer) clearInterval(_pgRec.timer);
    if (_pgRec.previewUrl) { try { URL.revokeObjectURL(_pgRec.previewUrl); } catch (e) {} }
    _pgRec = _pgRecBlank();
    var pv = document.getElementById('pgRecPreview'); if (pv) { pv.removeAttribute('src'); pv.style.display = 'none'; }
    var del = document.getElementById('pgRecDel'); if (del) del.style.display = 'none';
    var b = document.getElementById('pgRecBtn'); if (b) b.textContent = '🔴 Mulai Rekam';
    var dur = document.getElementById('pgRecDur'); if (dur) dur.textContent = '00:00';
  }

  function pgRecToggle() {
    if (_pgRec.mr && _pgRec.mr.state === 'recording') { _pgRec.mr.stop(); return; }
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Perangkat tidak mendukung perekaman suara.', 'err'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mime = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mime)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/wav')) mime = 'audio/wav';
        else mime = '';
      }
      _pgRec.stream = stream;
      _pgRec.chunks = []; _pgRec.blob = null; _pgRec.uploadedUrl = '';
      _pgRec.mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      _pgRec.mime = _pgRec.mr.mimeType || mime || 'audio/webm';
      _pgRec.mr.ondataavailable = function (e) { if (e.data && e.data.size) _pgRec.chunks.push(e.data); };
      _pgRec.mr.onstop = function () {
        if (_pgRec.stream) { _pgRec.stream.getTracks().forEach(function (t) { t.stop(); }); }
        if (_pgRec.timer) { clearInterval(_pgRec.timer); _pgRec.timer = null; }
        _pgRec.blob = new Blob(_pgRec.chunks, { type: _pgRec.mime });
        _pgRec.durasi = Math.round((Date.now() - _pgRec.t0) / 1000);
        if (_pgRec.previewUrl) { try { URL.revokeObjectURL(_pgRec.previewUrl); } catch (e) {} }
        _pgRec.previewUrl = URL.createObjectURL(_pgRec.blob);
        var pv = document.getElementById('pgRecPreview');
        if (pv) { pv.src = _pgRec.previewUrl; pv.style.display = 'block'; }
        var del = document.getElementById('pgRecDel'); if (del) del.style.display = 'inline-block';
        var b = document.getElementById('pgRecBtn'); if (b) b.textContent = '🔴 Rekam Ulang';
      };
      _pgRec.t0 = Date.now();
      _pgRec.mr.start();
      var b = document.getElementById('pgRecBtn'); if (b) b.textContent = '⏹️ Hentikan';
      _pgRec.timer = setInterval(function () {
        var s = Math.floor((Date.now() - _pgRec.t0) / 1000);
        var el = document.getElementById('pgRecDur');
        if (el) el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }, 500);
    }).catch(function () { toast('Izin mikrofon ditolak atau tidak tersedia.', 'err'); });
  }

  // Unggah blob rekaman ke GAS → kembalikan { url, durasi, tipe } atau null bila tak ada rekaman.
  // Bila masih merekam, hentikan & tunggu blob final siap (mr.stop async → blob baru
  // tersedia di onstop). Membuat "Simpan" otomatis menutup rekaman tanpa langkah manual.
  function _pgFinishRecording() {
    return new Promise(function (resolve) {
      if (!(_pgRec.mr && _pgRec.mr.state === 'recording')) { resolve(); return; }
      var mr = _pgRec.mr;
      var prevOnstop = mr.onstop;
      mr.onstop = function () {
        if (typeof prevOnstop === 'function') prevOnstop();  // set blob/preview seperti biasa
        resolve();
      };
      try { mr.stop(); } catch (e) { resolve(); }
    });
  }

  async function _pgUploadAudio(id_kelompok) {
    await _pgFinishRecording();
    if (!_pgRec.blob) return null;
    // Idempoten: bila sudah pernah terunggah (mis. simpan DB gagal lalu retry),
    // pakai URL yang sama — jangan unggah berkas kedua ke Drive.
    if (_pgRec.uploadedUrl) return { url: _pgRec.uploadedUrl, durasi: _pgRec.durasi, tipe: _pgRec.mime };
    // Umpan balik di dalam modal (loader global z-index 9999 < modal 99999 → tak terlihat).
    var okBtn = document.getElementById('pgModalOk');
    var okPrev = okBtn ? okBtn.textContent : '';
    if (okBtn) okBtn.textContent = '⏳ Mengunggah rekaman…';
    try {
      var tokRes = await window.HQ.MuridAPI.getLatihanUploadToken();
      var token = tokRes && tokRes.token;
      if (!token) throw new Error('Gagal mengambil token keamanan.');
      var base64 = await new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onloadend = function () { resolve(r.result.split(',')[1]); };
        r.onerror = reject;
        r.readAsDataURL(_pgRec.blob);
      });
      var ext = ((_pgRec.mime.split('/')[1] || 'webm').split(';')[0]) || 'webm';
      var res = await fetch(PG_GAS_UPLOAD_URL, {
        method: 'POST', mode: 'cors',
        body: JSON.stringify({
          token: token, base64Data: base64,
          fileName: 'PEER-' + id_kelompok + '-' + (PG.myId || '') + '-' + Date.now() + '.' + ext,
          mimeType: _pgRec.mime
        })
      });
      if (!res.ok) throw new Error('Koneksi ke server penyimpanan gagal.');
      var out = await res.json();
      if (out.status !== 'success' || !out.url) throw new Error(out.message || 'Gagal mengunggah rekaman.');
      _pgRec.uploadedUrl = out.url;
      return { url: out.url, durasi: _pgRec.durasi, tipe: _pgRec.mime };
    } finally {
      if (okBtn) okBtn.textContent = okPrev;
    }
  }

  // Hanya izinkan URL http/https — cegah skema berbahaya (javascript:, data:) yang
  // bisa tersimpan di audio_url via API lalu jadi Stored XSS saat dirender ke <a href>.
  function _pgIsHttpUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  }

  // Tombol pemutar rekaman untuk riwayat setoran (reuse putarAudioInline portal guru).
  function _pgAudioBtnHtml(url) {
    if (!_pgIsHttpUrl(url)) return '';
    if (url.indexOf('id=') === -1) {
      return '<div style="margin-top:4px"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#0284c7;font-weight:700">📂 Buka Rekaman</a></div>';
    }
    var fid = url.split('id=')[1].split('&')[0];
    var cid = 'pgAud_' + fid;
    return '<div id="' + cid + '" style="margin-top:5px">'
      + '<button onclick="putarAudioInline(\'' + cid + '\',\'' + escJs(fid) + '\')" style="border:1px solid #0284c7;color:#0284c7;background:transparent;border-radius:7px;padding:3px 10px;font-size:10px;font-weight:800;cursor:pointer">▶️ Putar Rekaman</button>'
      + '</div>';
  }

  // ── Export ke window ──
  if (typeof window !== 'undefined') {
    window.loadPengembanganGuru = loadPengembanganGuru;
    window.pgGoTab = pgGoTab;
    window.pgSetorForm = pgSetorForm;
    window.pgSimakForm = pgSimakForm;
    window.pgRecToggle = pgRecToggle;
    window.pgRecReset = pgRecReset;
    window.pgToggleTarget = pgToggleTarget;
    window.pgAddTarget = pgAddTarget;
    window.pgAddMilestone = pgAddMilestone;
    window.pgMarkTarget = pgMarkTarget;
    window.pgDelTgt = pgDelTgt;
    window.pgTashihForm = pgTashihForm;
    window.pgEvaluasiForm = pgEvaluasiForm;
    window.pgMutabaahForm = pgMutabaahForm;
    window.pgCloseModal = pgCloseModal;
  }
})();
