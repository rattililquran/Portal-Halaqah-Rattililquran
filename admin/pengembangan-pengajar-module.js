// ============================================================
//  Portal Admin — Pengembangan Pengajar Module (patch_082)
//  Tab: Profil & Jenjang · Pelatihan · Mutaba'ah & Rapor · Halaqah Pengajar · Indikator
//  Pola IIFE + window.HQ.AdminAPI + toast/showLoad/esc (sama dgn modul admin lain).
// ============================================================
(function() {
  "use strict";

  var JENJANG = ['pemula', 'madya', 'utama'];
  var PP = { tab: 'profil', pengajar: [], obsCatatan: {}, agenda: [], agendaIndikator: [] };

  function _isSuper() { return currentUser && currentUser.role === 'superadmin'; }
  function _root()    { return document.getElementById('ppRoot'); }
  function _body(html) { var b = document.getElementById('ppBody'); if (b) b.innerHTML = html; }
  function _busy()    { _body('<div style="padding:20px;color:var(--text-3)">⏳ Memuat...</div>'); }
  function _err(e)    { _body('<div style="padding:20px;color:var(--red,#dc2626)">Gagal: ' + esc(friendlyError(e)) + '</div>'); }

  var TABS = [
    { id: 'profil',    label: '👤 Profil & Jenjang' },
    { id: 'agenda',    label: '📅 Program Pembinaan' },
    { id: 'pelatihan', label: '🎓 Pelatihan' },
    { id: 'rapor',     label: '📊 Mutaba\'ah & Rapor' },
    { id: 'peer',      label: '🤝 Halaqah Pengajar' },
    { id: 'indikator', label: '⚙️ Indikator', superOnly: true },
  ];

  // Ciri guru terbaik (4 ranah) + ruh penyemangat.
  var RANAH = [
    { id: 'qurani',      label: 'Qur\'ani',            ruh: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ — sebaik-baik kalian yang belajar & mengajarkan Al-Qur\'an' },
    { id: 'pedagogik',   label: 'Pedagogik',           ruh: 'اُدْعُ إِلَىٰ سَبِيلِ رَبِّكَ بِالْحِكْمَةِ وَالْمَوْعِظَةِ الْحَسَنَةِ (An-Nahl 125) — hikmah & keteladanan' },
    { id: 'kepribadian', label: 'Kepribadian & Adab',  ruh: 'وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا — guru Al-Qur\'an dihias adab sebelum ilmu' },
    { id: 'sosial',      label: 'Sosial',              ruh: 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ (Al-Ma\'idah 2) — tumbuh dalam kebersamaan' },
    { id: 'lainnya',     label: 'Lainnya',             ruh: '' },
  ];
  function _ranahLabel(id) { var r = RANAH.filter(function(x){ return x.id === id; })[0]; return r ? r.label : (id || '—'); }

  // Pustaka playbook (quick-add). Keresahan: masalah→eksekusi→target.
  var KERESAHAN_TEMPLATES = [
    { masalah: 'Sebagian guru telat hadir', judul: 'Check-in 10 menit sebelum KBM + briefing kedisiplinan', target: 'Kehadiran tepat waktu ≥95%', ranah: 'kepribadian', id_indikator: 'PIND-DISIPLIN', frekuensi: 'bulanan' },
    { masalah: 'Jurnal KBM sering telat/kosong', judul: 'Pengingat + template jurnal cepat + audit mingguan', target: 'Jurnal terisi ≤24 jam', ranah: 'kepribadian', id_indikator: 'PIND-DISIPLIN', frekuensi: 'mingguan' },
    { masalah: 'Sesi libur tak diganti', judul: 'Jadwalkan kelas pengganti + monitoring hutang', target: 'Hutang pengganti = 0', ranah: 'kepribadian', id_indikator: 'PIND-DISIPLIN', frekuensi: 'bulanan' },
    { masalah: 'Makhraj/sifat sebagian guru belum mantap', judul: 'Tashih intensif pekanan + halaqah tahsin wajib', target: 'Lulus tashih Madya', ranah: 'qurani', id_indikator: 'PIND-KEFASIHAN', frekuensi: 'mingguan' },
    { masalah: 'Gharib/musykilat kurang dikuasai', judul: 'Kajian gharib bulanan + latihan', target: 'Kuasai kaidah gharib inti', ranah: 'qurani', id_indikator: 'PIND-KEFASIHAN', frekuensi: 'bulanan' },
    { masalah: 'Waqaf–ibtida\' sering keliru', judul: 'Drill waqaf pada mushaf standar', target: 'Tepat waqaf & ibtida\'', ranah: 'qurani', id_indikator: 'PIND-KEFASIHAN', frekuensi: 'bulanan' },
    { masalah: 'Hafalan guru menurun', judul: 'Muraja\'ah rutin + setoran peer mingguan', target: 'Hafalan terjaga', ranah: 'qurani', id_indikator: 'PIND-KEFASIHAN', frekuensi: 'mingguan' },
    { masalah: 'Mengajar monoton/kaku', judul: 'Storytelling + microteaching + observasi-feedback', target: 'Kelas lebih hidup', ranah: 'pedagogik', id_indikator: 'PIND-MENGAJAR', frekuensi: 'bulanan' },
    { masalah: 'Murid cepat bosan', judul: 'Terapkan gamifikasi (Rattil Quiz/Maze/Run) + variasi metode', target: 'Keaktifan murid naik', ranah: 'pedagogik', id_indikator: 'PIND-MENGAJAR', frekuensi: 'bulanan' },
    { masalah: 'Koreksi bacaan murid kurang tepat', judul: 'Drill teknik koreksi + kalibrasi standar antar-guru', target: 'Koreksi konsisten & tepat', ranah: 'pedagogik', id_indikator: 'PIND-MENGAJAR', frekuensi: 'bulanan' },
    { masalah: 'Kelas multi-usia sulit dikelola', judul: 'Pelatihan manajemen kelas per rentang usia', target: 'Kelas lebih teratur', ranah: 'pedagogik', id_indikator: 'PIND-MENGAJAR', frekuensi: 'semesteran' },
    { masalah: 'Semangat/ruhiyah menurun', judul: 'Mabit + muhasabah + kajian adab pengajar', target: 'Keikhlasan & semangat terjaga', ranah: 'kepribadian', id_indikator: 'PIND-ADAB', frekuensi: 'semesteran' },
    { masalah: 'Adab interaksi dengan murid perlu dikuatkan', judul: 'Kajian adab mu\'allim + keteladanan', target: 'Teladan akhlak', ranah: 'kepribadian', id_indikator: 'PIND-ADAB', frekuensi: 'bulanan' },
    { masalah: 'Komunikasi dengan wali kurang', judul: 'Pelatihan komunikasi + template pesan + laporan berkala', target: 'Kepuasan wali naik', ranah: 'sosial', id_indikator: 'PIND-ADAB', frekuensi: 'semesteran' },
    { masalah: 'Keluhan wali meningkat', judul: 'SOP respon keluhan + evaluasi akar masalah', target: 'Keluhan turun', ranah: 'sosial', id_indikator: 'PIND-ADAB', frekuensi: 'bulanan' },
    { masalah: 'Kolaborasi antar-guru lemah', judul: 'Forum sharing + aktifkan halaqah pengajar (peer)', target: 'Saling bantu meningkat', ranah: 'sosial', id_indikator: 'PIND-ADAB', frekuensi: 'mingguan' },
    { masalah: 'Capaian hafalan murid rendah', judul: 'Evaluasi metode per halaqah + target mingguan + muraja\'ah', target: 'Capaian hafalan naik', ranah: 'pedagogik', id_indikator: 'PIND-CAPAIAN', frekuensi: 'bulanan' },
    { masalah: 'Banyak murid tidak aktif', judul: 'Follow-up keaktifan + pendekatan wali', target: 'Keaktifan murid naik', ranah: 'pedagogik', id_indikator: 'PIND-CAPAIAN', frekuensi: 'bulanan' },
    { masalah: 'Pengajar baru belum siap', judul: 'Orientasi 4–8 pertemuan + magang didampingi musyrif', target: 'Lulus sertifikasi Pemula', ranah: 'pedagogik', id_indikator: 'PIND-MENGAJAR', frekuensi: 'sekali' },
    { masalah: 'Kekurangan musyrif/pembina', judul: 'Kaderisasi musyrif (jalur jenjang Utama)', target: 'Rasio pembina cukup', ranah: 'pedagogik', id_indikator: '', frekuensi: 'tahunan' },
  ];
  var PELATIHAN_TEMPLATES = [
    { judul: 'Storytelling Qur\'ani', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'belajar' },
    { judul: 'Microteaching & peer feedback', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'praktik' },
    { judul: 'Manajemen kelas multi-usia', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'belajar' },
    { judul: 'Teknik koreksi bacaan', kategori: 'tahsin', ranah: 'qurani', jenis: 'praktik' },
    { judul: 'Komunikasi & kemitraan wali', kategori: 'psikologi', ranah: 'sosial', jenis: 'belajar' },
    { judul: 'Psikologi perkembangan anak', kategori: 'psikologi', ranah: 'pedagogik', jenis: 'belajar' },
    { judul: 'Adab & ruhiyah pengajar', kategori: 'adab', ranah: 'kepribadian', jenis: 'belajar' },
    { judul: 'Gharib & musykilat', kategori: 'tahsin', ranah: 'qurani', jenis: 'belajar' },
    { judul: 'Waqaf & ibtida\'', kategori: 'tahsin', ranah: 'qurani', jenis: 'belajar' },
    { judul: 'Public speaking & artikulasi', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'praktik' },
    { judul: 'Gamifikasi kelas (Quiz/Maze/Run)', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'praktik' },
    { judul: 'Asesmen & penilaian objektif', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'belajar' },
    { judul: 'Tahsin lanjutan & jalur sanad', kategori: 'tahsin', ranah: 'qurani', jenis: 'belajar' },
    { judul: 'Nagham/irama tilawah', kategori: 'tahsin', ranah: 'qurani', jenis: 'praktik' },
    { judul: 'Manajemen waktu & tertib jurnal', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'belajar' },
    { judul: 'Optimalkan portal (KBM/absensi/raport)', kategori: 'metodologi', ranah: 'pedagogik', jenis: 'praktik' },
    { judul: 'Keselamatan & perlindungan anak', kategori: 'adab', ranah: 'kepribadian', jenis: 'belajar' },
    { judul: 'Etika digital & privasi data murid', kategori: 'adab', ranah: 'sosial', jenis: 'belajar' },
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
    ({ profil: _loadProfil, agenda: _loadAgenda, pelatihan: _loadPelatihan, rapor: _loadRapor, peer: _loadPeer, indikator: _loadIndikator }[tab] || _loadProfil)();
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

  // ══════════════════ TAB: PROGRAM PEMBINAAN (AGENDA) ══════════════════
  async function _loadAgenda() {
    try {
      var settled = await Promise.allSettled([
        window.HQ.AdminAPI.getAgendaPembinaan(),
        window.HQ.AdminAPI.getIndikatorEvaluasi(),
      ]);
      if (settled[0].status !== 'fulfilled') throw (settled[0].reason || new Error('Gagal memuat agenda'));
      PP.agenda = (settled[0].value && settled[0].value.data) || [];
      PP.agendaIndikator = (settled[1].status === 'fulfilled' && settled[1].value.data) || [];
      var masalah = PP.agenda.filter(function(a){ return a.asal === 'masalah'; });
      var kebaikan = PP.agenda.filter(function(a){ return a.asal !== 'masalah'; });
      _body(
        '<button onclick="ppNewAgenda()" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:14px">+ To-do Pembinaan</button>'
        + _agendaGroup('🩹 Dari Keresahan (yang ingin diperbaiki)', '#b45309', 'rgba(217,119,6,.07)', masalah)
        + _agendaGroup('🌱 Dari Kebaikan (yang ingin dikejar)', '#166534', 'rgba(22,163,74,.06)', kebaikan)
      );
    } catch (e) { _err(e); }
  }

  function _agendaGroup(title, color, bg, items) {
    var body;
    if (!items.length) {
      body = '<div style="font-size:11px;color:var(--text-3);padding:4px 2px">Belum ada.</div>';
    } else {
      // sub-kelompok per ranah (untuk kebaikan) atau flat (masalah tetap urut ranah)
      body = items.map(_agendaCard).join('');
    }
    return '<div style="border-radius:12px;background:' + bg + ';padding:12px;margin-bottom:14px">'
      + '<div style="font-size:13px;font-weight:800;color:' + color + ';margin-bottom:8px">' + title + '</div>'
      + body + '</div>';
  }

  function _agendaCard(a) {
    var badFrek = { mingguan: 'Mingguan', bulanan: 'Bulanan', semesteran: 'Semesteran', tahunan: 'Tahunan', sekali: 'Sekali' };
    var jenisBadge = a.jenis
      ? '<span style="font-size:10px;font-weight:800;border-radius:100px;padding:1px 8px;' + (a.jenis === 'belajar' ? 'background:#e0f2fe;color:#075985' : 'background:#dcfce7;color:#166534') + '">' + (a.jenis === 'belajar' ? '📖 belajar' : '🔨 praktik') + '</span>' : '';
    var indBadge = a.indikator
      ? '<span style="font-size:10px;color:#7c3aed;font-weight:700">dinilai: ' + esc(a.indikator.nama) + (a.indikator.bobot != null ? ' ' + a.indikator.bobot + '%' : '') + '</span>' : '';
    var ranahBadge = a.ranah ? '<span style="font-size:10px;color:var(--text-3)">' + esc(_ranahLabel(a.ranah)) + '</span>' : '';
    var done = a.status === 'selesai';
    var head = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start">'
      + '<div style="min-width:0"><div style="font-weight:800;font-size:13px' + (done ? ';text-decoration:line-through;color:var(--text-3)' : '') + '">' + esc(a.judul) + (done ? ' ✅' : '') + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:3px">' + jenisBadge + ranahBadge + indBadge
      + '<span style="font-size:10px;color:var(--text-3)">· ' + (badFrek[a.frekuensi] || a.frekuensi) + (a.jadwal_teks ? ' · ' + esc(a.jadwal_teks) : '') + (a.jumlah_dilaksanakan ? ' · ' + a.jumlah_dilaksanakan + '× dilaksanakan' : '') + '</span>'
      + '</div></div></div>';
    var body = '';
    if (a.asal === 'masalah') {
      body = '<div style="font-size:11px;margin-top:6px;line-height:1.6">'
        + (a.masalah ? '<div>🩹 <strong>Masalah:</strong> ' + esc(a.masalah) + '</div>' : '')
        + '<div>⚡ <strong>Eksekusi:</strong> ' + esc(a.judul) + '</div>'
        + (a.target ? '<div>🎯 <strong>Target:</strong> ' + esc(a.target) + '</div>' : '')
        + '</div>';
    } else if (a.target || a.deskripsi) {
      body = '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' + esc(a.target || a.deskripsi) + '</div>';
    }
    var actions = '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
      + '<button onclick="ppEditAgenda(\'' + esc(a.id_agenda) + '\')" style="border:none;background:var(--bg-2,#f1f5f9);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer">✎ Edit</button>'
      + '<button onclick="ppIngatkanAgenda(\'' + esc(a.id_agenda) + '\')" style="border:none;background:rgba(37,99,235,.1);color:#2563eb;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer">🔔 Ingatkan</button>'
      + (done ? '' : '<button onclick="ppSelesaiAgenda(\'' + esc(a.id_agenda) + '\')" style="border:none;background:rgba(22,163,74,.1);color:#166534;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer">✓ Selesai</button>')
      + '<button onclick="ppHapusAgenda(\'' + esc(a.id_agenda) + '\')" style="border:none;background:none;color:#ef4444;border-radius:6px;padding:3px 6px;font-size:12px;cursor:pointer">✕</button>'
      + '</div>';
    return '<div style="background:var(--bg-1,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:11px;margin-bottom:8px">'
      + head + body + actions + '</div>';
  }

  function _agendaFormHtml(a) {
    a = a || {};
    var asal = a.asal || 'kebaikan';
    function optSel(list, sel, blank) {
      return (blank ? '<option value="">' + blank + '</option>' : '') + list.map(function(o){
        return '<option value="' + esc(o.v) + '"' + (o.v === sel ? ' selected' : '') + '>' + esc(o.l) + '</option>';
      }).join('');
    }
    var indOpts = (PP.agendaIndikator || []).map(function(i){ return { v: i.id_indikator, l: i.nama + (i.bobot != null ? ' (' + i.bobot + '%)' : '') }; });
    var ranahOpts = RANAH.map(function(r){ return { v: r.id, l: r.label }; });
    var jenisOpts = [{ v: 'belajar', l: '📖 Belajar (ilmu)' }, { v: 'praktik', l: '🔨 Praktik (amal)' }];
    var frekOpts = [{v:'mingguan',l:'Mingguan'},{v:'bulanan',l:'Bulanan'},{v:'semesteran',l:'Semesteran'},{v:'tahunan',l:'Tahunan'},{v:'sekali',l:'Sekali'}];
    // chip pustaka
    var chips = (asal === 'masalah')
      ? KERESAHAN_TEMPLATES.map(function(t, i){ return '<button type="button" onclick="ppFillKeresahan(' + i + ')" style="border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:100px;padding:3px 9px;font-size:10px;cursor:pointer;margin:2px">' + esc(t.masalah) + '</button>'; }).join('')
      : PELATIHAN_TEMPLATES.map(function(t, i){ return '<button type="button" onclick="ppFillKebaikan(' + i + ')" style="border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:100px;padding:3px 9px;font-size:10px;cursor:pointer;margin:2px">' + esc(t.judul) + '</button>'; }).join('');
    function fld(label, ctrl) { return '<div style="margin-bottom:9px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:3px">' + label + '</label>' + ctrl + '</div>'; }
    var inp = 'width:100%;box-sizing:border-box;font-size:13px;padding:7px 9px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--bg-1,#fff);color:inherit';
    return ''
      + fld('Sumber to-do', '<select id="pgaAsal" onchange="ppAgendaAsalChange()" style="' + inp + '">' + optSel([{v:'masalah',l:'🩹 Keresahan (perbaiki masalah)'},{v:'kebaikan',l:'🌱 Kebaikan (kejar ciri)'}], asal) + '</select>')
      + '<div style="margin-bottom:9px"><div style="font-size:10px;color:var(--text-3);margin-bottom:2px">Quick-add dari pustaka:</div><div id="pgaChips" style="max-height:88px;overflow:auto">' + chips + '</div></div>'
      + '<div id="pgaMasalahWrap" style="display:' + (asal === 'masalah' ? 'block' : 'none') + '">' + fld('Masalah (keresahan)', '<textarea id="pgaMasalah" rows="2" style="' + inp + '">' + esc(a.masalah || '') + '</textarea>') + '</div>'
      + fld('Eksekusi / judul kegiatan *', '<input id="pgaJudul" style="' + inp + '" value="' + esc(a.judul || '') + '">')
      + fld('Target (kebaikan yang dikejar)', '<input id="pgaTarget" style="' + inp + '" value="' + esc(a.target || '') + '">')
      + '<div style="display:flex;gap:8px"><div style="flex:1">' + fld('Ranah (ciri)', '<select id="pgaRanah" style="' + inp + '">' + optSel(ranahOpts, a.ranah || '', '—') + '</select>') + '</div>'
      + '<div style="flex:1">' + fld('Ikhtiar', '<select id="pgaJenis" style="' + inp + '">' + optSel(jenisOpts, a.jenis || '', '—') + '</select>') + '</div></div>'
      + fld('Indikator evaluasi terkait (opsional)', '<select id="pgaIndikator" style="' + inp + '">' + optSel(indOpts, a.id_indikator || '', '—') + '</select>')
      + '<div style="display:flex;gap:8px"><div style="flex:1">' + fld('Frekuensi', '<select id="pgaFrekuensi" style="' + inp + '">' + optSel(frekOpts, a.frekuensi || 'sekali') + '</select>') + '</div>'
      + '<div style="flex:1">' + fld('Jadwal (teks)', '<input id="pgaJadwal" style="' + inp + '" placeholder="Setiap Sabtu ba\'da Subuh" value="' + esc(a.jadwal_teks || '') + '">') + '</div></div>';
  }

  function ppAgendaAsalChange() {
    var asal = document.getElementById('pgaAsal').value;
    var w = document.getElementById('pgaMasalahWrap'); if (w) w.style.display = asal === 'masalah' ? 'block' : 'none';
    var chipsEl = document.getElementById('pgaChips');
    if (chipsEl) {
      chipsEl.innerHTML = (asal === 'masalah')
        ? KERESAHAN_TEMPLATES.map(function(t, i){ return '<button type="button" onclick="ppFillKeresahan(' + i + ')" style="border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:100px;padding:3px 9px;font-size:10px;cursor:pointer;margin:2px">' + esc(t.masalah) + '</button>'; }).join('')
        : PELATIHAN_TEMPLATES.map(function(t, i){ return '<button type="button" onclick="ppFillKebaikan(' + i + ')" style="border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:100px;padding:3px 9px;font-size:10px;cursor:pointer;margin:2px">' + esc(t.judul) + '</button>'; }).join('');
    }
  }
  function _setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
  function ppFillKeresahan(i) {
    var t = KERESAHAN_TEMPLATES[i]; if (!t) return;
    _setVal('pgaMasalah', t.masalah); _setVal('pgaJudul', t.judul); _setVal('pgaTarget', t.target);
    _setVal('pgaRanah', t.ranah); _setVal('pgaJenis', 'praktik'); _setVal('pgaFrekuensi', t.frekuensi);
    _setVal('pgaIndikator', t.id_indikator || '');   // hanya terpasang bila opsi ada
  }
  function ppFillKebaikan(i) {
    var t = PELATIHAN_TEMPLATES[i]; if (!t) return;
    _setVal('pgaJudul', t.judul); _setVal('pgaRanah', t.ranah); _setVal('pgaJenis', t.jenis);
  }

  function _collectAgenda() {
    var d = {
      asal: document.getElementById('pgaAsal').value,
      judul: (document.getElementById('pgaJudul').value || '').trim(),
      masalah: (document.getElementById('pgaMasalah') ? document.getElementById('pgaMasalah').value : '').trim() || null,
      target: (document.getElementById('pgaTarget').value || '').trim() || null,
      ranah: document.getElementById('pgaRanah').value || null,
      jenis: document.getElementById('pgaJenis').value || null,
      id_indikator: document.getElementById('pgaIndikator').value || null,
      frekuensi: document.getElementById('pgaFrekuensi').value || 'sekali',
      jadwal_teks: (document.getElementById('pgaJadwal').value || '').trim() || null,
    };
    return d;
  }

  function ppNewAgenda() {
    showModalHtml('Tambah To-do Pembinaan', _agendaFormHtml(null), async function() {
      var d = _collectAgenda();
      if (!d.judul) throw new Error('Judul/eksekusi wajib diisi');
      await window.HQ.AdminAPI.upsertAgendaPembinaan(d);
      toast('To-do ditambahkan', 'ok');
      _loadAgenda();
    });
  }
  function ppEditAgenda(id_agenda) {
    var a = (PP.agenda || []).filter(function(x){ return x.id_agenda === id_agenda; })[0];
    if (!a) return;
    showModalHtml('Edit To-do Pembinaan', _agendaFormHtml(a), async function() {
      var d = _collectAgenda(); d.id_agenda = id_agenda;
      if (!d.judul) throw new Error('Judul/eksekusi wajib diisi');
      await window.HQ.AdminAPI.upsertAgendaPembinaan(d);
      toast('To-do disimpan', 'ok');
      _loadAgenda();
    });
  }
  async function ppSelesaiAgenda(id_agenda) {
    showLoad('Menyimpan...');
    try { await window.HQ.AdminAPI.upsertAgendaPembinaan({ id_agenda: id_agenda, status: 'selesai' }); toast('Ditandai selesai', 'ok'); _loadAgenda(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { hideLoad(); }
  }
  async function ppHapusAgenda(id_agenda) {
    if (!(await showConfirm('Hapus to-do ini?', { title: 'Hapus?', okText: 'Ya, Hapus', danger: true }))) return;
    showLoad('Menghapus...');
    try { await window.HQ.AdminAPI.hapusAgendaPembinaan(id_agenda); toast('Dihapus', 'ok'); _loadAgenda(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { hideLoad(); }
  }
  async function ppIngatkanAgenda(id_agenda) {
    showLoad('Mengirim pengingat...');
    try { var r = await window.HQ.AdminAPI.ingatkanAgenda(id_agenda); toast('Pengingat terkirim ke ' + (r.jumlah || 0) + ' guru', 'ok'); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { hideLoad(); }
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
      var chips = '<div style="font-size:10px;color:var(--text-3);margin:2px 0">Template siap-pakai:</div><div style="max-height:70px;overflow:auto;margin-bottom:10px">'
        + PELATIHAN_TEMPLATES.map(function(t, i){ return '<button onclick="ppPelatihanTpl(' + i + ')" style="border:1px solid var(--border,#e5e7eb);background:var(--bg-2,#f8fafc);border-radius:100px;padding:3px 9px;font-size:10px;cursor:pointer;margin:2px">' + esc(t.judul) + '</button>'; }).join('')
        + '</div>';
      _body('<button onclick="ppNewPelatihan()" style="border:none;background:var(--blue,#2563eb);color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:12px">+ Pelatihan Baru</button>'
        + chips
        + (rows || '<div style="color:var(--text-3);font-size:12px">Belum ada pelatihan.</div>'));
    } catch (e) { _err(e); }
  }

  function ppPelatihanTpl(i) { var t = PELATIHAN_TEMPLATES[i]; if (t) ppNewPelatihan(t.judul, t.kategori); }

  async function ppNewPelatihan(prefJudul, prefKategori) {
    var judul = prompt('Judul pelatihan:', prefJudul || ''); if (judul === null || !judul.trim()) return;
    var tanggal = prompt('Tanggal (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (tanggal === null || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal.trim())) { toast('Tanggal tidak valid (YYYY-MM-DD)', 'err'); return; }
    var kategori = prompt('Kategori (tahsin/metodologi/adab/psikologi/orientasi/lainnya):', prefKategori || 'tahsin');
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
      var pesRes = await window.HQ.AdminAPI.getPesertaPelatihan(id_pelatihan);
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
      // allSettled: rapor inti WAJIB; apresiasi & observasi SEKUNDER (kegagalannya
      // tak boleh mengosongkan rapor). Lihat debug #1.
      var calls = [window.HQ.AdminAPI.getRaporPengajar(id_guru), window.HQ.AdminAPI.getApresiasiList(id_guru)];
      if (_isSuper()) calls.push(window.HQ.AdminAPI.getObservasiKBM({ id_guru: id_guru }));
      var res = await Promise.allSettled(calls);
      if (res[0].status !== 'fulfilled') throw (res[0].reason || new Error('Gagal memuat rapor'));
      var r = (res[0].value && res[0].value.data) || {};
      var ap = (res[1] && res[1].status === 'fulfilled' && res[1].value.data) || [];
      var obs = (res[2] && res[2].status === 'fulfilled' && res[2].value.data) || [];
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
      // Kelola kelompok = inti (wajib). Pantau (stats) = sekunder — jangan gagalkan
      // pengelolaan kelompok bila stats gagal (debug #1 pola sama).
      var settled = await Promise.allSettled([
        window.HQ.AdminAPI.getKelompokPengajarAdmin(),
        window.HQ.AdminAPI.getPantauPeer(),
      ]);
      if (settled[0].status !== 'fulfilled') throw (settled[0].reason || new Error('Gagal memuat kelompok'));
      var kelompok = (settled[0].value && settled[0].value.data) || [];
      var pantau = (settled[1].status === 'fulfilled' && settled[1].value.data) || {};
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
    window.ppNewAgenda = ppNewAgenda;
    window.ppEditAgenda = ppEditAgenda;
    window.ppSelesaiAgenda = ppSelesaiAgenda;
    window.ppHapusAgenda = ppHapusAgenda;
    window.ppIngatkanAgenda = ppIngatkanAgenda;
    window.ppAgendaAsalChange = ppAgendaAsalChange;
    window.ppFillKeresahan = ppFillKeresahan;
    window.ppFillKebaikan = ppFillKebaikan;
    window.ppPelatihanTpl = ppPelatihanTpl;
    window.ppNewKelompok = ppNewKelompok;
    window.ppSetAnggota = ppSetAnggota;
    window.ppDeleteKelompok = ppDeleteKelompok;
    window.ppNewIndikator = ppNewIndikator;
    window.ppEditIndikator = ppEditIndikator;
    window.ppCloseModal = ppCloseModal;
  }
})();
