// ============================================================
//  Portal Admin — Pengembangan Pengajar Module (patch_082)
//  Tab: Profil & Jenjang · Pelatihan · Mutaba'ah & Rapor · Halaqah Pengajar · Indikator
//  Pola IIFE + window.HQ.AdminAPI + toast/showLoad/esc (sama dgn modul admin lain).
// ============================================================
(function() {
  "use strict";

  var JENJANG = ['pemula', 'madya', 'utama'];
  var PP = { tab: 'profil', pengajar: [], obsCatatan: {} };

  function _isSuper() { return currentUser && currentUser.role === 'superadmin'; }
  function _root()    { return document.getElementById('ppRoot'); }
  function _body(html) { var b = document.getElementById('ppBody'); if (b) b.innerHTML = html; }
  function _busy()    { _body('<div style="padding:20px;color:var(--text-3)">⏳ Memuat...</div>'); }
  function _err(e)    { _body('<div style="padding:20px;color:var(--red,#dc2626)">Gagal: ' + esc(friendlyError(e)) + '</div>'); }

  var TABS = [
    { id: 'profil',    label: '👤 Profil & Jenjang' },
    { id: 'pelatihan', label: '🎓 Pelatihan' },
    { id: 'rapor',     label: '📊 Mutaba\'ah & Rapor' },
    { id: 'peer',      label: '🤝 Halaqah Pengajar' },
    { id: 'indikator', label: '⚙️ Indikator', superOnly: true },
  ];

  function _tabBar() {
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">'
      + TABS.filter(function(t) { return !t.superOnly || _isSuper(); }).map(function(t) {
          var on = t.id === PP.tab;
          return '<button onclick="ppGoTab(\'' + t.id + '\')" style="border:none;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;'
            + (on ? 'background:var(--blue,#2563eb);color:#fff' : 'background:var(--bg-2,#f1f5f9);color:var(--text-1,#334155)') + '">' + t.label + '</button>';
        }).join('')
      + '</div>';
  }

  function loadPengembanganPengajar() {
    var r = _root(); if (!r) return;
    r.innerHTML = _tabBar() + '<div id="ppBody"></div>';
    ppGoTab(PP.tab);
  }

  function ppGoTab(tab) {
    var def = TABS.filter(function(t) { return t.id === tab; })[0];
    if (def && def.superOnly && !_isSuper()) tab = 'profil';
    PP.tab = tab;
    var r = _root(); if (!r) return;
    r.innerHTML = _tabBar() + '<div id="ppBody"></div>';
    _busy();
    ({ profil: _loadProfil, pelatihan: _loadPelatihan, rapor: _loadRapor, peer: _loadPeer, indikator: _loadIndikator }[tab] || _loadProfil)();
  }

  // ── Helper: opsi <select> guru dari cache global allUsers ──
  function _guruOptions(selectedId) {
    var guru = (allUsers || []).filter(function(u) { return u.role === 'guru' && u.status === 'aktif'; });
    return '<option value="">— pilih pengajar —</option>' + guru.map(function(u) {
      return '<option value="' + esc(u.id_user) + '"' + (u.id_user === selectedId ? ' selected' : '') + '>' + esc(u.nama_lengkap) + '</option>';
    }).join('');
  }

  // ══════════════════ TAB 1: PROFIL & JENJANG ══════════════════
  async function _loadProfil() {
    try {
      var res = await window.HQ.AdminAPI.getPengajarList();
      PP.pengajar = res.data || [];
      var badge = { pemula: 'background:#e0f2fe;color:#075985', madya: 'background:#fef3c7;color:#92400e', utama: 'background:#dcfce7;color:#166534' };
      var rows = PP.pengajar.map(function(p) {
        var k = p.kompetensi || {};
        var jenjang = k.jenjang || 'pemula';
        var sert = k.status_sertifikasi || 'orientasi';
        var jenjangSel = _isSuper()
          ? '<select onchange="ppSetJenjang(\'' + esc(p.id_user) + '\',this.value)" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border,#e5e7eb)">'
              + JENJANG.map(function(j) { return '<option value="' + j + '"' + (j === jenjang ? ' selected' : '') + '>' + j + '</option>'; }).join('')
            + '</select>'
          : '<span style="font-size:11px;font-weight:800;border-radius:100px;padding:2px 9px;' + (badge[jenjang] || '') + '">' + esc(jenjang) + '</span>';
        var sertBtn = '<button onclick="ppToggleSertifikasi(\'' + esc(p.id_user) + '\',\'' + sert + '\')" style="border:none;border-radius:100px;padding:2px 9px;font-size:10px;font-weight:800;cursor:pointer;'
          + (sert === 'tersertifikasi' ? 'background:#dcfce7;color:#166534' : 'background:#fef3c7;color:#92400e') + '">'
          + (sert === 'tersertifikasi' ? '✓ tersertifikasi' : '⏳ orientasi') + '</button>';
        return '<tr>'
          + '<td><strong>' + esc(p.nama_lengkap) + '</strong>' + (p.is_musyrif ? ' <span style="font-size:10px;color:#7c3aed;font-weight:800">· Musyrif</span>' : '') + '</td>'
          + '<td>' + jenjangSel + '</td>'
          + '<td>' + sertBtn + '</td>'
          + '<td style="font-size:11px;color:var(--text-3)">' + esc(k.status_sanad || '—') + (k.hafalan_juz != null ? ' · ' + esc(k.hafalan_juz) + ' juz' : '') + '</td>'
          + '<td><button onclick="ppEditKompetensi(\'' + esc(p.id_user) + '\')" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:7px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer">✎ Edit</button></td>'
          + '</tr>';
      }).join('');
      _body('<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="text-align:left;color:var(--text-3);font-size:11px">'
        + '<th style="padding:8px">Pengajar</th><th>Jenjang</th><th>Sertifikasi</th><th>Sanad/Hafalan</th><th></th></tr></thead>'
        + '<tbody>' + (rows || '<tr><td colspan="5" style="padding:16px;color:var(--text-3)">Belum ada pengajar.</td></tr>') + '</tbody></table></div>'
        + (_isSuper() ? '' : '<div style="font-size:11px;color:var(--text-3);margin-top:8px">ℹ️ Ubah jenjang hanya untuk superadmin.</div>'));
    } catch (e) { _err(e); }
  }

  async function ppSetJenjang(id_guru, jenjang) {
    var catatan = prompt('Catatan kenaikan/penetapan jenjang "' + jenjang + '" (opsional):') || '';
    showLoad('Menyimpan jenjang...');
    try {
      await window.HQ.AdminAPI.setJenjang(id_guru, jenjang, catatan.trim() || null);
      toast('Jenjang diperbarui', 'ok');
      _loadProfil();
    } catch (e) { toast(friendlyError(e), 'err'); _loadProfil(); }
    finally { hideLoad(); }
  }

  async function ppToggleSertifikasi(id_guru, current) {
    var next = current === 'tersertifikasi' ? 'orientasi' : 'tersertifikasi';
    if (!(await showConfirm('Ubah status sertifikasi menjadi "' + next + '"?', { title: 'Sertifikasi Pengajar', okText: 'Ya' }))) return;
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertPengajarKompetensi({ id_guru: id_guru, status_sertifikasi: next });
      toast('Status sertifikasi diperbarui', 'ok');
      _loadProfil();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppEditKompetensi(id_guru) {
    var p = PP.pengajar.filter(function(x) { return x.id_user === id_guru; })[0];
    var k = (p && p.kompetensi) || {};
    var sanad = prompt('Deskripsi sanad/talaqqi:', k.status_sanad || '');
    if (sanad === null) return;
    var hafalanRaw = prompt('Hafalan (juz, angka):', k.hafalan_juz != null ? String(k.hafalan_juz) : '');
    if (hafalanRaw === null) return;
    var hafalan = hafalanRaw.trim() === '' ? null : Number(hafalanRaw);
    if (hafalan != null && (isNaN(hafalan) || hafalan < 0 || hafalan > 30)) { toast('Hafalan juz harus angka 0–30', 'err'); return; }
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertPengajarKompetensi({ id_guru: id_guru, status_sanad: sanad.trim() || null, hafalan_juz: hafalan });
      toast('Profil kompetensi disimpan', 'ok');
      _loadProfil();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  // ══════════════════ TAB 2: PELATIHAN ══════════════════
  async function _loadPelatihan() {
    try {
      var res = await window.HQ.AdminAPI.getPelatihanList();
      var list = res.data || [];
      var statusBadge = { terjadwal: 'background:#e0f2fe;color:#075985', selesai: 'background:#dcfce7;color:#166534', batal: 'background:#fee2e2;color:#991b1b' };
      var rows = list.map(function(p) {
        return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:11px;padding:12px;margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start">'
          + '<div><div style="font-weight:800;font-size:13px">' + esc(p.judul) + '</div>'
          + '<div style="font-size:11px;color:var(--text-3)">' + esc(p.kategori) + ' · ' + esc(p.tanggal) + (p.pemateri ? ' · ' + esc(p.pemateri) : '') + '</div></div>'
          + '<span style="font-size:10px;font-weight:800;border-radius:100px;padding:2px 9px;height:fit-content;' + (statusBadge[p.status] || '') + '">' + esc(p.status) + '</span>'
          + '</div>'
          + '<div style="display:flex;gap:6px;margin-top:8px;align-items:center">'
          + '<span style="font-size:11px;color:var(--text-3)">Hadir ' + p.peserta.hadir + '/' + p.peserta.total + '</span>'
          + '<button onclick="ppKehadiran(\'' + esc(p.id_pelatihan) + '\')" style="margin-left:auto;border:none;background:rgba(37,99,235,.1);color:#2563eb;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer">✓ Kehadiran</button>'
          + '</div></div>';
      }).join('');
      _body('<button onclick="ppNewPelatihan()" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:12px">+ Pelatihan Baru</button>'
        + (rows || '<div style="color:var(--text-3);font-size:12px">Belum ada pelatihan.</div>'));
    } catch (e) { _err(e); }
  }

  async function ppNewPelatihan() {
    var judul = prompt('Judul pelatihan:'); if (judul === null || !judul.trim()) return;
    var tanggal = prompt('Tanggal (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (tanggal === null || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal.trim())) { toast('Tanggal tidak valid (YYYY-MM-DD)', 'err'); return; }
    var kategori = prompt('Kategori (tahsin/metodologi/adab/psikologi/orientasi/lainnya):', 'tahsin');
    if (kategori === null) return;
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertPelatihan({ judul: judul.trim(), tanggal: tanggal.trim(), kategori: (kategori.trim() || 'tahsin') });
      toast('Pelatihan dibuat', 'ok');
      _loadPelatihan();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppKehadiran(id_pelatihan) {
    showLoad('Memuat peserta...');
    try {
      var [pesRes] = await Promise.all([window.HQ.AdminAPI.getPesertaPelatihan(id_pelatihan)]);
      var hadirMap = {};
      (pesRes.data || []).forEach(function(x) { hadirMap[x.id_guru] = x.status_hadir; });
      var guru = (allUsers || []).filter(function(u) { return u.role === 'guru' && u.status === 'aktif'; });
      hideLoad();
      var body = guru.map(function(u) {
        var s = hadirMap[u.id_user] || '';
        return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px">'
          + '<span style="flex:1">' + esc(u.nama_lengkap) + '</span>'
          + ['H', 'I', 'A'].map(function(v) {
              return '<label style="font-size:11px;display:inline-flex;gap:3px;align-items:center"><input type="radio" name="pph_' + esc(u.id_user) + '" value="' + v + '"' + (s === v ? ' checked' : '') + '>' + v + '</label>';
            }).join('&nbsp;')
          + '</label>';
      }).join('');
      showModalHtml('Kehadiran Pelatihan', body, function() { return _submitKehadiran(id_pelatihan, guru); });
    } catch (e) { hideLoad(); toast(friendlyError(e), 'err'); }
  }

  async function _submitKehadiran(id_pelatihan, guru) {
    var list = guru.map(function(u) {
      var sel = document.querySelector('input[name="pph_' + u.id_user + '"]:checked');
      return sel ? { id_guru: u.id_user, status_hadir: sel.value } : null;
    }).filter(Boolean);
    await window.HQ.AdminAPI.setKehadiranPelatihan(id_pelatihan, list);
    toast('Kehadiran disimpan', 'ok');
    _loadPelatihan();
  }

  // ══════════════════ TAB 3: MUTABA'AH & RAPOR ══════════════════
  async function _loadRapor() {
    try {
      var d = (await window.HQ.AdminAPI.getDashboardPengajar()).data || {};
      var pj = d.per_jenjang || {};
      _body('<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
        + _stat('Total Pengajar', d.total_pengajar || 0)
        + _stat('Rata Nilai Evaluasi', d.rata_nilai_evaluasi != null ? d.rata_nilai_evaluasi : '—')
        + _stat('Mutaba\'ah Belum Selesai', d.mutabaah_belum_selesai || 0)
        + _stat('Pemula / Madya / Utama', (pj.pemula || 0) + ' / ' + (pj.madya || 0) + ' / ' + (pj.utama || 0))
        + '</div>'
        + '<div style="font-size:12px;font-weight:800;margin-bottom:6px">Rapor per Pengajar</div>'
        + '<select id="ppRaporSel" onchange="ppLoadRapor(this.value)" style="width:100%;max-width:340px;font-size:12px;padding:7px 9px;border-radius:8px;border:1px solid var(--border,#e5e7eb)">' + _guruOptions(null) + '</select>'
        + '<div id="ppRaporBox" style="margin-top:12px"></div>');
    } catch (e) { _err(e); }
  }

  function _stat(label, val) {
    return '<div style="flex:1;min-width:130px;background:var(--bg-2,#f8fafc);border-radius:11px;padding:12px">'
      + '<div style="font-size:11px;color:var(--text-3)">' + esc(label) + '</div>'
      + '<div style="font-size:20px;font-weight:800;margin-top:2px">' + esc(String(val)) + '</div></div>';
  }

  async function ppLoadRapor(id_guru) {
    var box = document.getElementById('ppRaporBox');
    if (!box) return;
    if (!id_guru) { box.innerHTML = ''; return; }
    box.innerHTML = '<div style="color:var(--text-3);font-size:12px">⏳ Memuat rapor...</div>';
    try {
      // Observasi (sensitif) hanya untuk superadmin — hindari error RLS di admin biasa.
      var calls = [window.HQ.AdminAPI.getRaporPengajar(id_guru), window.HQ.AdminAPI.getApresiasiList(id_guru)];
      if (_isSuper()) calls.push(window.HQ.AdminAPI.getObservasiKBM({ id_guru: id_guru }));
      var res = await Promise.all(calls);
      var r = (res[0] && res[0].data) || {};
      var ap = (res[1] && res[1].data) || [];
      var obs = (res[2] && res[2].data) || [];
      var ev = r.evaluasi_terakhir;
      PP.obsCatatan = {};   // simpan catatan observasi utk tindak lanjut (hindari escaping panjang di onclick)
      var apHtml = ap.map(function(a) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px">'
          + '<span style="flex:1">🏅 <strong>' + esc(a.jenis) + '</strong>' + (a.keterangan ? ' · ' + esc(a.keterangan) : '') + ' <span style="color:var(--text-3)">· ' + esc(a.tanggal || '') + '</span></span>'
          + '<button onclick="ppHapusApresiasi(\'' + esc(a.id_apresiasi) + '\',\'' + esc(id_guru) + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px">✕</button>'
          + '</div>';
      }).join('') || '<div style="font-size:11px;color:var(--text-3)">Belum ada apresiasi.</div>';
      var obsHtml = '';
      if (_isSuper()) {
        var obsRows = obs.slice(0, 6).map(function(o, i) {
          var key = 'o' + i;
          PP.obsCatatan[key] = o.catatan || o.catatan_lain || '';
          var teks = PP.obsCatatan[key];
          return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;border-top:1px solid var(--border,#f1f5f9)">'
            + '<span style="flex:1;min-width:0">👁️ ' + esc((o.tanggal || '') + (teks ? ' · ' + teks : ' · (tanpa catatan)')) + '</span>'
            + (teks ? '<button onclick="ppTindaklanjutiObservasi(\'' + esc(id_guru) + '\',\'' + key + '\')" style="border:none;background:rgba(217,119,6,.12);color:#b45309;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer">→ Mutaba\'ah</button>' : '')
            + '</div>';
        }).join('') || '<div style="font-size:11px;color:var(--text-3)">Belum ada observasi.</div>';
        obsHtml = '<div style="border:1px dashed var(--border,#e5e7eb);border-radius:9px;padding:10px;margin-top:12px">'
          + '<div style="font-size:12px;font-weight:800;margin-bottom:5px">👁️ Observasi KBM (ketua kelas)</div>'
          + obsRows + '</div>';
      }
      box.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap">'
        + _stat('Nilai Evaluasi Terakhir', ev && ev.nilai_akhir != null ? ev.nilai_akhir : '—')
        + _stat('% Kehadiran', r.pct_kehadiran != null ? r.pct_kehadiran + '%' : '—')
        + _stat('Capaian Murid', r.capaian_murid != null ? r.capaian_murid : '—')
        + _stat('Tashih Lulus', (r.tashih_lulus || 0) + '/' + (r.tashih_total || 0))
        + _stat('Micro Teaching', r.micro_teaching || 0)
        + _stat('Mutaba\'ah Terbuka', r.mutabaah_terbuka || 0)
        + '</div>'
        + '<div style="font-size:11px;color:var(--text-3);margin-top:8px">💡 % Kehadiran & Capaian Murid ditarik otomatis dari data absensi & raport; Micro Teaching dari sesi KBM.</div>'
        + '<div style="border:1px dashed var(--border,#e5e7eb);border-radius:9px;padding:10px;margin-top:12px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:12px;font-weight:800">🏅 Apresiasi</span>'
        + '<button onclick="ppBeriApresiasi(\'' + esc(id_guru) + '\')" style="border:none;background:#d97706;color:#fff;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer">+ Beri Apresiasi</button></div>'
        + apHtml + '</div>'
        + obsHtml;
    } catch (e) { box.innerHTML = '<div style="color:var(--red)">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
  }

  async function ppBeriApresiasi(id_guru) {
    var jenis = prompt('Jenis apresiasi (teladan/kehadiran/dedikasi):', 'teladan');
    if (jenis === null || !jenis.trim()) return;
    var keterangan = prompt('Keterangan (opsional):') || '';
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.setApresiasi({ id_guru: id_guru, jenis: jenis.trim(), keterangan: keterangan.trim() || null });
      toast('Apresiasi diberikan', 'ok');
      ppLoadRapor(id_guru);
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppHapusApresiasi(id_apresiasi, id_guru) {
    if (!(await showConfirm('Hapus apresiasi ini?', { title: 'Hapus Apresiasi?', okText: 'Ya', danger: true }))) return;
    try {
      await window.HQ.AdminAPI.hapusApresiasi(id_apresiasi);
      toast('Apresiasi dihapus', 'ok');
      ppLoadRapor(id_guru);
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  // B1: temuan observasi ketua → buka mutaba'ah (sumber='observasi'). is_pembina() izinkan tulis.
  async function ppTindaklanjutiObservasi(id_guru, key) {
    var temuanDefault = (PP.obsCatatan && PP.obsCatatan[key]) || '';
    var temuan = prompt('Temuan (dari observasi) untuk ditindaklanjuti:', temuanDefault);
    if (temuan === null || !temuan.trim()) return;
    var rencana = prompt('Rencana perbaikan (opsional):') || '';
    showLoad('Membuka mutaba\'ah...');
    try {
      await window.HQ.GuruAPI.upsertMutabaahPengajar({
        id_guru: id_guru, temuan: temuan.trim(), rencana: rencana.trim() || null, sumber: 'observasi',
      });
      toast('Mutaba\'ah dibuka dari observasi', 'ok');
      ppLoadRapor(id_guru);
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  // ══════════════════ TAB 4: HALAQAH PENGAJAR (PEER) ══════════════════
  async function _loadPeer() {
    try {
      var [pantauRes, kelRes] = await Promise.all([
        window.HQ.AdminAPI.getPantauPeer(),
        window.HQ.AdminAPI.getKelompokPengajarAdmin(),
      ]);
      var pantau = pantauRes.data || {};
      var kelompok = kelRes.data || [];
      var kat = pantau.kategori || {};
      var katHtml = Object.keys(kat).sort(function(a, b) { return kat[b] - kat[a]; })
        .map(function(k) { return '<span style="font-size:11px;background:var(--bg-2,#f1f5f9);border-radius:100px;padding:2px 9px">' + esc(k) + ': ' + kat[k] + '</span>'; }).join(' ');
      var cards = kelompok.map(function(k) {
        var anggota = (k.anggota || []).map(function(a) { return esc(a.nama_guru || a.id_guru); }).join(', ');
        return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:11px;padding:12px;margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;gap:8px">'
          + '<div style="font-weight:800;font-size:13px">' + esc(k.nama_kelompok) + (k.fokus ? ' <span style="font-size:11px;font-weight:600;color:var(--text-3)">· ' + esc(k.fokus) + '</span>' : '') + '</div>'
          + '<button onclick="ppDeleteKelompok(\'' + esc(k.id_kelompok) + '\')" style="border:none;background:none;color:#ef4444;cursor:pointer;font-size:13px">✕</button>'
          + '</div>'
          + '<div style="font-size:11px;color:var(--text-3);margin:4px 0">' + (k.jadwal ? '🗓️ ' + esc(k.jadwal) + ' · ' : '') + 'Setoran: ' + ((pantau.kelompok || []).filter(function(x) { return x.id_kelompok === k.id_kelompok; }).map(function(x) { return x.jumlah_setoran; })[0] || 0) + '</div>'
          + '<div style="font-size:11px;margin-bottom:6px">Anggota: ' + (anggota || '<span style="color:var(--text-3)">belum ada</span>') + '</div>'
          + '<button onclick="ppSetAnggota(\'' + esc(k.id_kelompok) + '\')" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">Atur Anggota</button>'
          + ' <button onclick="ppIngatkan(\'' + esc(k.id_kelompok) + '\')" style="border:none;background:rgba(37,99,235,.1);color:#2563eb;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">🔔 Ingatkan</button>'
          + '</div>';
      }).join('');
      _body('<div style="background:var(--bg-2,#f8fafc);border-radius:11px;padding:12px;margin-bottom:12px">'
        + '<div style="font-size:12px;font-weight:800;margin-bottom:4px">🌱 Keaktifan Kolaboratif</div>'
        + '<div style="font-size:12px">Total setoran pekan ini & lampau: <strong>' + (pantau.total_setoran || 0) + '</strong></div>'
        + '<div style="margin-top:6px">' + (katHtml || '<span style="font-size:11px;color:var(--text-3)">Belum ada setoran.</span>') + '</div></div>'
        + '<button onclick="ppNewKelompok()" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:12px">+ Kelompok Pengajar</button>'
        + (cards || '<div style="color:var(--text-3);font-size:12px">Belum ada kelompok.</div>'));
    } catch (e) { _err(e); }
  }

  async function ppNewKelompok() {
    var nama = prompt('Nama kelompok pengajar (mis: Halaqah Makhraj Sabtu):'); if (nama === null || !nama.trim()) return;
    var fokus = prompt('Fokus (mis: Makhraj & Sifat) — opsional:') || '';
    var jadwal = prompt('Jadwal (mis: Setiap Sabtu ba\'da Subuh) — opsional:') || '';
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertKelompokPengajar({ nama_kelompok: nama.trim(), fokus: fokus.trim() || null, jadwal: jadwal.trim() || null });
      toast('Kelompok dibuat', 'ok');
      _loadPeer();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppSetAnggota(id_kelompok) {
    try {
      var kelRes = await window.HQ.AdminAPI.getKelompokPengajarAdmin();
      var k = (kelRes.data || []).filter(function(x) { return x.id_kelompok === id_kelompok; })[0];
      var current = {};
      ((k && k.anggota) || []).forEach(function(a) { current[a.id_guru] = true; });
      var guru = (allUsers || []).filter(function(u) { return u.role === 'guru' && u.status === 'aktif'; });
      var body = guru.map(function(u) {
        return '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px">'
          + '<input type="checkbox" class="pp-anggota" value="' + esc(u.id_user) + '" data-nama="' + esc(u.nama_lengkap) + '"' + (current[u.id_user] ? ' checked' : '') + '>'
          + esc(u.nama_lengkap) + '</label>';
      }).join('');
      showModalHtml('Atur Anggota Kelompok', body, function() { return _submitAnggota(id_kelompok); });
    } catch (e) { toast(friendlyError(e), 'err'); }
  }

  async function _submitAnggota(id_kelompok) {
    var checks = Array.prototype.slice.call(document.querySelectorAll('.pp-anggota:checked'));
    var list = checks.map(function(c) { return { id_guru: c.value, nama_guru: c.getAttribute('data-nama') }; });
    await window.HQ.AdminAPI.setAnggotaKelompokPengajar(id_kelompok, list);
    toast('Anggota diperbarui', 'ok');
    _loadPeer();
  }

  async function ppIngatkan(id_kelompok) {
    var pesan = prompt('Pesan pengingat (kosongkan untuk default):', '') ;
    if (pesan === null) return;
    showLoad('Mengirim pengingat...');
    try {
      var res = await window.HQ.AdminAPI.ingatkanKelompokPengajar(id_kelompok, pesan.trim());
      toast('Pengingat terkirim ke ' + (res.jumlah || 0) + ' anggota', 'ok');
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppDeleteKelompok(id_kelompok) {
    if (!(await showConfirm('Hapus kelompok ini? Setoran, target & milestone-nya ikut terhapus.', { title: 'Hapus Kelompok?', okText: 'Ya, Hapus', danger: true }))) return;
    showLoad('Menghapus...');
    try {
      await window.HQ.AdminAPI.deleteKelompokPengajar(id_kelompok);
      toast('Kelompok dihapus', 'ok');
      _loadPeer();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  // ══════════════════ TAB 5: INDIKATOR (superadmin) ══════════════════
  async function _loadIndikator() {
    if (!_isSuper()) { _body('<div style="padding:16px;color:var(--text-3)">Hanya superadmin.</div>'); return; }
    try {
      var res = await window.HQ.AdminAPI.getIndikatorEvaluasi();
      var list = res.data || [];
      var total = list.filter(function(i) { return i.status === 'aktif'; }).reduce(function(s, i) { return s + Number(i.bobot || 0); }, 0);
      var rows = list.map(function(i) {
        return '<tr>'
          + '<td style="padding:6px"><strong>' + esc(i.nama) + '</strong></td>'
          + '<td>' + esc(String(i.bobot)) + '</td>'
          + '<td style="font-size:11px;color:' + (i.status === 'aktif' ? '#166534' : '#991b1b') + '">' + esc(i.status) + '</td>'
          + '<td><button onclick="ppEditIndikator(\'' + esc(i.id_indikator) + '\')" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">✎</button></td>'
          + '</tr>';
      }).join('');
      _body('<div style="font-size:12px;margin-bottom:8px">Total bobot aktif: <strong style="color:' + (total === 100 ? '#166534' : '#dc2626') + '">' + total + '</strong> / 100</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;color:var(--text-3);font-size:11px"><th style="padding:6px">Indikator</th><th>Bobot</th><th>Status</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>'
        + '<button onclick="ppNewIndikator()" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;margin-top:12px">+ Indikator</button>');
    } catch (e) { _err(e); }
  }

  async function ppNewIndikator() {
    var nama = prompt('Nama indikator:'); if (nama === null || !nama.trim()) return;
    var bobotRaw = prompt('Bobot (angka, total ideal 100):', '0'); if (bobotRaw === null) return;
    var bobot = Number(bobotRaw);
    if (isNaN(bobot) || bobot < 0 || bobot > 100) { toast('Bobot harus angka 0–100', 'err'); return; }
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertIndikator({ nama: nama.trim(), bobot: bobot });
      toast('Indikator ditambahkan', 'ok');
      _loadIndikator();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  async function ppEditIndikator(id_indikator) {
    var res = await window.HQ.AdminAPI.getIndikatorEvaluasi();
    var it = (res.data || []).filter(function(x) { return x.id_indikator === id_indikator; })[0];
    if (!it) return;
    var bobotRaw = prompt('Bobot untuk "' + it.nama + '":', String(it.bobot)); if (bobotRaw === null) return;
    var bobot = Number(bobotRaw);
    if (isNaN(bobot) || bobot < 0 || bobot > 100) { toast('Bobot harus angka 0–100', 'err'); return; }
    var status = (prompt('Status (aktif/nonaktif):', it.status) || it.status).trim();
    if (['aktif', 'nonaktif'].indexOf(status) < 0) { toast('Status harus aktif/nonaktif', 'err'); return; }
    showLoad('Menyimpan...');
    try {
      await window.HQ.AdminAPI.upsertIndikator({ id_indikator: id_indikator, nama: it.nama, bobot: bobot, urutan: it.urutan, status: status });
      toast('Indikator disimpan', 'ok');
      _loadIndikator();
    } catch (e) { toast(friendlyError(e), 'err'); }
    finally { hideLoad(); }
  }

  // ── Modal generik sederhana (fallback bila belum ada showModalHtml global) ──
  function showModalHtml(title, bodyHtml, onOk) {
    var old = document.getElementById('ppModal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ppModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:var(--bg-1,#fff);border-radius:14px;max-width:440px;width:100%;max-height:80vh;overflow:auto;padding:18px">'
      + '<div style="font-weight:800;font-size:14px;margin-bottom:10px">' + esc(title) + '</div>'
      + '<div id="ppModalBody">' + bodyHtml + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'
      + '<button onclick="ppCloseModal()" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Batal</button>'
      + '<button id="ppModalOk" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer">Simpan</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('ppModalOk').onclick = async function() {
      var btn = this; btn.disabled = true;
      try { await onOk(); ppCloseModal(); }
      catch (e) { toast(friendlyError(e), 'err'); btn.disabled = false; }
    };
  }
  function ppCloseModal() { var m = document.getElementById('ppModal'); if (m) m.remove(); }

  // ── Export ke window ──
  if (typeof window !== 'undefined') {
    window.loadPengembanganPengajar = loadPengembanganPengajar;
    window.ppGoTab = ppGoTab;
    window.ppSetJenjang = ppSetJenjang;
    window.ppToggleSertifikasi = ppToggleSertifikasi;
    window.ppEditKompetensi = ppEditKompetensi;
    window.ppNewPelatihan = ppNewPelatihan;
    window.ppKehadiran = ppKehadiran;
    window.ppLoadRapor = ppLoadRapor;
    window.ppBeriApresiasi = ppBeriApresiasi;
    window.ppHapusApresiasi = ppHapusApresiasi;
    window.ppTindaklanjutiObservasi = ppTindaklanjutiObservasi;
    window.ppIngatkan = ppIngatkan;
    window.ppNewKelompok = ppNewKelompok;
    window.ppSetAnggota = ppSetAnggota;
    window.ppDeleteKelompok = ppDeleteKelompok;
    window.ppNewIndikator = ppNewIndikator;
    window.ppEditIndikator = ppEditIndikator;
    window.ppCloseModal = ppCloseModal;
  }
})();
