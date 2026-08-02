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

  async function loadPengembanganGuru() {
    var r = _root(); if (!r) return;
    PG.myId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id_user : null;
    r.innerHTML = '<div id="pgTabs"></div><div id="pgBody"></div>';
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
    el.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">'
      + _tabs().map(function(t) {
          var on = t.id === PG.tab;
          return '<button onclick="pgGoTab(\'' + t.id + '\')" style="border:none;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;'
            + (on ? 'background:#0284c7;color:#fff' : 'background:var(--bg-2,#f1f5f9);color:var(--text-1,#334155)') + '">' + t.label + '</button>';
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
      var [kelRes, rekapRes] = await Promise.all([
        window.HQ.GuruAPI.getKelompokPengajarku(),
        window.HQ.GuruAPI.getRekapPeerSaya(),
      ]);
      PG.kelompok = kelRes.data || [];
      var rekap = rekapRes.data || {};
      if (!PG.kelompok.length) {
        _body('<div style="color:var(--text-3);font-size:13px;padding:16px;line-height:1.6">Anda belum tergabung di halaqah pengajar mana pun.<br>Hubungi admin untuk dimasukkan ke kelompok pembinaan.</div>');
        return;
      }
      var head = '<div style="background:var(--bg-2,#f8fafc);border-radius:11px;padding:12px;margin-bottom:12px;display:flex;gap:16px;flex-wrap:wrap">'
        + _mini('Setoran keluar', rekap.total_setor || 0)
        + _mini('Menyimak rekan', rekap.total_simak || 0)
        + (rekap.kategori_dominan ? _mini('Fokus tersering', esc(rekap.kategori_dominan)) : '')
        + '</div>';
      _body(head + PG.kelompok.map(_peerCard).join(''));
      PG.kelompok.forEach(function(k) { _loadSetoranKelompok(k.id_kelompok); });
    } catch (e) { _err(e); }
  }

  function _mini(label, val) {
    return '<div><div style="font-size:11px;color:var(--text-3)">' + label + '</div><div style="font-size:18px;font-weight:800;margin-top:2px">' + val + '</div></div>';
  }

  function _peerCard(k) {
    return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:13px;margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start">'
      + '<div><div style="font-weight:800;font-size:14px">' + esc(k.nama_kelompok) + '</div>'
      + '<div style="font-size:11px;color:var(--text-3)">' + (k.fokus ? esc(k.fokus) + ' · ' : '') + (k.jadwal ? '🗓️ ' + esc(k.jadwal) : '') + '</div></div>'
      + '<button onclick="pgSetorForm(\'' + escJs(k.id_kelompok) + '\')" style="border:none;background:#0284c7;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer">+ Setor</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:6px">Anggota: ' + ((k.anggota || []).map(function(a) { return esc(a.nama_guru || a.id_guru); }).join(', ') || '—') + '</div>'
      + '<div style="margin-top:8px"><button onclick="pgToggleTarget(\'' + escJs(k.id_kelompok) + '\')" style="border:none;background:rgba(217,119,6,.12);color:#b45309;border-radius:7px;padding:4px 11px;font-size:11px;font-weight:800;cursor:pointer">🎯 Target &amp; Milestone</button></div>'
      + '<div id="pgTgt_' + esc(k.id_kelompok) + '" style="display:none;margin-top:8px"></div>'
      + '<div id="pgSet_' + esc(k.id_kelompok) + '" style="margin-top:10px"><div style="font-size:11px;color:var(--text-3)">⏳ Memuat setoran...</div></div>'
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
              return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:4px 0">'
                + '<span style="font-size:12px">' + esc(s.nama_penyetor || s.id_penyetor) + ' · <strong>' + esc(s.kategori) + '</strong>' + (s.sub_materi ? ' · ' + esc(s.sub_materi) : '') + '</span>'
                + '<button onclick="pgSimakForm(\'' + escJs(s.id_setoran) + '\',\'' + escJs(id_kelompok) + '\')" style="border:none;background:#16a34a;color:#fff;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:800;cursor:pointer">Nilai</button>'
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
    var body = ''
      + _fld('Simak oleh (rekan)', '<select id="pgSetPenyimak" class="pg-inp">' + anggota.map(function(a) { return '<option value="' + esc(a.id) + '">' + esc(a.nama) + '</option>'; }).join('') + '</select>')
      + _fld('Kategori', '<select id="pgSetKategori" class="pg-inp">' + _optTags(KATEGORI, 'makhraj') + '</select>')
      + _fld('Sub materi (opsional)', '<input id="pgSetSub" class="pg-inp" placeholder="mis. Huruf isti\'la\'">')
      + _fld('Dalil / matan (opsional)', '<textarea id="pgSetDalil" class="pg-inp" rows="2" placeholder="mis. dari Matan Al-Jazariyah"></textarea>')
      + _fld('Catatan (opsional)', '<input id="pgSetCatatan" class="pg-inp" placeholder="konteks setoran">');
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
      await window.HQ.GuruAPI.simpanSetoranPeer(d);
      toast('Setoran terkirim', 'ok');
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
      var head = '<div style="border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px;margin-bottom:12px">'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
        + '<span style="font-size:12px;font-weight:800;border-radius:100px;padding:3px 11px;' + (JENJANG_BADGE[jenjang] || '') + '">' + esc(jenjang) + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:' + (k.status_sertifikasi === 'tersertifikasi' ? '#166534' : '#92400e') + '">' + esc(k.status_sertifikasi || 'orientasi') + '</span>'
        + (k.hafalan_juz != null ? '<span style="font-size:11px;color:var(--text-3)">· ' + esc(k.hafalan_juz) + ' juz</span>' : '')
        + '</div>'
        + (k.status_sanad ? '<div style="font-size:12px;color:var(--text-3);margin-top:6px">Sanad: ' + esc(k.status_sanad) + '</div>' : '')
        + '</div>';
      var evalSec = _profilList('📊 Evaluasi', (d.evaluasi || []).map(function(e) {
        return '<strong>' + (e.nilai_akhir != null ? e.nilai_akhir : '—') + '</strong> · ' + esc(e.tanggal || '') + (e.catatan ? ' · ' + esc(e.catatan) : '');
      }));
      var tashihSec = _profilList('🎤 Tashih', (d.tashih || []).map(function(t) {
        return esc(t.tanggal || '') + ' · ' + esc(t.surat_diuji || '-') + ' · ' + esc(t.hasil || '-');
      }));
      var mtbSec = _profilList('🎯 Mutaba\'ah', (d.mutabaah || []).map(function(m) {
        return '<strong>' + esc(m.status) + '</strong> · ' + esc(m.temuan) + (m.rencana ? ' → ' + esc(m.rencana) : '');
      }));
      var jenjangSec = _profilList('🪜 Riwayat Jenjang', (d.riwayat_jenjang || []).map(function(r) {
        return esc(r.tanggal || '') + ' · ' + esc(r.jenjang_lama || '-') + ' → <strong>' + esc(r.jenjang_baru) + '</strong>';
      }));
      _body(head + evalSec + tashihSec + mtbSec + jenjangSec);
    } catch (e) { _err(e); }
  }

  function _profilList(title, items) {
    return '<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:800;margin-bottom:6px">' + title + '</div>'
      + (items.length ? items.map(function(x) { return '<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--border,#f1f5f9)">' + x + '</div>'; }).join('')
                      : '<div style="font-size:11px;color:var(--text-3)">Belum ada.</div>')
      + '</div>';
  }

  // ══════════════════ TAB: BINAAN (MUSYRIF) ══════════════════
  async function _loadBinaan() {
    if (!PG.musyrif) { _body('<div style="padding:16px;color:var(--text-3)">Khusus Musyrif.</div>'); return; }
    try {
      var [binaanRes, indRes] = await Promise.all([
        window.HQ.GuruAPI.getBinaanSaya(),
        window.HQ.GuruAPI.getIndikatorEvaluasi(),
      ]);
      var binaan = (binaanRes.data || []).filter(function(u) { return u.id_user !== PG.myId; });
      PG.indikator = indRes.data || [];
      var rows = binaan.map(function(u) {
        var k = u.kompetensi || {};
        return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:11px;padding:11px;margin-bottom:8px">'
          + '<div style="font-weight:800;font-size:13px">' + esc(u.nama_lengkap) + ' <span style="font-size:10px;font-weight:600;color:var(--text-3)">· ' + esc(k.jenjang || 'pemula') + '</span></div>'
          + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
          + '<button onclick="pgTashihForm(\'' + escJs(u.id_user) + '\')" style="border:none;background:rgba(2,132,199,.1);color:#0284c7;border-radius:7px;padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer">🎤 Tashih</button>'
          + '<button onclick="pgEvaluasiForm(\'' + escJs(u.id_user) + '\')" style="border:none;background:rgba(124,58,237,.1);color:#7c3aed;border-radius:7px;padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer">📊 Evaluasi</button>'
          + '<button onclick="pgMutabaahForm(\'' + escJs(u.id_user) + '\')" style="border:none;background:rgba(217,119,6,.1);color:#b45309;border-radius:7px;padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer">🎯 Mutaba\'ah</button>'
          + '</div></div>';
      }).join('');
      _body('<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Sebagai Musyrif, Anda membina pengajar berikut. Data mutu bersifat rahasia antar pengajar.</div>'
        + (rows || '<div style="color:var(--text-3);font-size:12px">Belum ada pengajar binaan.</div>'));
    } catch (e) { _err(e); }
  }

  function pgTashihForm(id_guru) {
    var butir = ['makhraj', 'sifat', 'tajwid', 'waqaf', 'tartil'];
    var body = _fld('Surat/ayat diuji', '<input id="pgTsSurat" class="pg-inp" placeholder="mis. Al-Fatihah">')
      + butir.map(function(b) {
          return _fld(b.charAt(0).toUpperCase() + b.slice(1), '<select id="pgTs_' + b + '" class="pg-inp"><option value="baik">Baik</option><option value="perlu">Perlu perbaikan</option></select>');
        }).join('')
      + _fld('Hasil', '<select id="pgTsHasil" class="pg-inp"><option value="lulus">Lulus</option><option value="mengulang">Mengulang</option></select>')
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
    var body = _fld('Temuan / kelemahan', '<textarea id="pgMtTemuan" class="pg-inp" rows="2"></textarea>')
      + _fld('Rencana perbaikan (opsional)', '<textarea id="pgMtRencana" class="pg-inp" rows="2"></textarea>')
      + _fld('Target waktu (opsional)', '<input id="pgMtTarget" type="date" class="pg-inp">');
    pgModal('Buka Mutaba\'ah', body, async function() {
      var temuan = document.getElementById('pgMtTemuan').value.trim();
      if (!temuan) { throw new Error('Temuan wajib diisi'); }
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
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:var(--bg-1,#fff);border-radius:14px;max-width:440px;width:100%;max-height:85vh;overflow:auto;padding:18px">'
      + '<div style="font-weight:800;font-size:14px;margin-bottom:12px">' + esc(title) + '</div>'
      + '<style>#pgModal .pg-inp{width:100%;box-sizing:border-box;font-size:13px;padding:8px 10px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--bg-1,#fff);color:inherit}</style>'
      + '<div>' + bodyHtml + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'
      + '<button onclick="pgCloseModal()" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Batal</button>'
      + '<button id="pgModalOk" style="border:none;background:#0284c7;color:#fff;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer">Simpan</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('pgModalOk').onclick = async function() {
      var btn = this; btn.disabled = true;
      try { await onOk(); pgCloseModal(); }
      catch (e) { toast(friendlyError(e), 'err'); btn.disabled = false; }
    };
  }
  function pgCloseModal() { var m = document.getElementById('pgModal'); if (m) m.remove(); }

  // ── Export ke window ──
  if (typeof window !== 'undefined') {
    window.loadPengembanganGuru = loadPengembanganGuru;
    window.pgGoTab = pgGoTab;
    window.pgSetorForm = pgSetorForm;
    window.pgSimakForm = pgSimakForm;
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
