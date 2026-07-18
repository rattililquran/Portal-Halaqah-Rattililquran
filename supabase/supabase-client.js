// ============================================================
//  supabase-client.js  v2.0
//  Rattililqur'an Portal — Supabase Client
//  Menggantikan api.js (GAS) sepenuhnya
// ============================================================

const SUPABASE_URL  = 'https://zefriybfrirrtsulogta.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZnJpeWJmcmlycnRzdWxvZ3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTk1MzIsImV4cCI6MjA5NTkzNTUzMn0.AmB43YG-fCYqATdh5BrfLJmGITI_UeX8csOYyjd9i_U';

const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// Tarif SPP Pribadi per bulan (Rupiah). SATU-SATUNYA sumber untuk frontend —
// dipakai di rekap admin (AdminAPI) & tampilan konfirmasi murid (spp-module.js
// via window.HQ.SPP_NOMINAL_BULANAN). CATATAN: nilai otoritatif untuk transaksi
// gateway TETAP dihardcode server-side di edge function mayar-create-payment
// (anti-tampering) — jika tarif berubah, ubah DI SANA JUGA agar sinkron.
const SPP_NOMINAL_BULANAN = 75000;

// ─────────────────────────────────────────────
//  SESSION
// ─────────────────────────────────────────────
var _currentUser = null;

(function() {
  var stored = sessionStorage.getItem('hq_user') || localStorage.getItem('hq_user');
  if (stored) { try { _currentUser = JSON.parse(stored); } catch(e) {} }
})();

// CATATAN PENTING — jangan tambahkan restore sesi manual via _sb.auth.setSession() di sini.
// createClient() di atas sudah otomatis memulihkan & me-refresh sesi dari localStorage
// miliknya sendiri (persistSession+autoRefreshToken aktif secara default). Versi lama
// kode ini melakukan restore manual TAMBAHAN pakai hq_token/hq_refresh — dua mekanisme
// refresh-token berjalan paralel itulah yang memicu "refresh token reuse detected" saat
// keduanya merotasi token nyaris bersamaan (mis. saat PWA dibuka lagi dari background),
// menyebabkan sesi tercabut paksa & wajib login ulang. Sekarang Supabase adalah
// satu-satunya pengelola token; hq_token/hq_refresh hanya cermin/cadangan (disinkronkan
// lewat onAuthStateChange di bawah), bukan sumber yang dipakai untuk restore aktif.
_sb.auth.onAuthStateChange(function(event, session) {
  if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
    localStorage.setItem('hq_token',   session.access_token);
    localStorage.setItem('hq_refresh', session.refresh_token);
  }
  if (event === 'SIGNED_OUT') {
    _currentUser = null;
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_refresh');
    localStorage.removeItem('hq_user');
  }
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function _uid() { return _currentUser && _currentUser.id_user; }

function _check(error, ctx) {
  if (error) { console.error('[SB] ' + ctx + ':', error); throw new Error(error.message || ctx); }
}

// Ambil SEMUA baris menembus batas PostgREST max_rows (1000) dengan paginasi .range().
// applyFn(q) HARUS menerapkan filter + .order() pada kolom UNIK agar paginasi stabil
// (tanpa order, urutan antar-halaman tidak dijamin -> baris bisa dobel/terlewat).
async function _selectAllPaged(table, columns, applyFn, ctx) {
  var PAGE = 1000, from = 0, all = [];
  while (true) {
    var q = _sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (applyFn) q = applyFn(q);
    var res = await q;
    _check(res.error, ctx || ('selectAllPaged:' + table));
    var rows = res.data || [];
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Tanggal lokal (YYYY-MM-DD) — JANGAN pakai toISOString() yang berbasis UTC:
// di WIB sebelum jam 07:00 hasilnya mundur 1 hari (bug sesi Subuh/Qiyam pagi).
function _localDate(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
window.localDateStr = _localDate;

// Normalisasi jam dari CSV: "15.00" / "15.30" (pakai titik) -> "15:00" / "15:30"
// agar valid untuk kolom time di Postgres. Mengembalikan null jika kosong.
function _normJam(v) {
  if (!v) return null;
  var s = String(v).trim();
  if (!s) return null;
  return s.replace(/\./g, ':');
}

// Catat transaksi penting (validasi SPP, perubahan role/status, publish raport) ke audit_log
// lewat RPC log_audit_action — user_id dikunci ke pemanggil sendiri (anti-pemalsuan log).
// Logging tidak boleh menggagalkan transaksi utama jika gagal — karena itu tidak di-_check().
function _logAudit(action, detail) {
  _sb.rpc('log_audit_action', { p_action: action, p_detail: detail || null })
    .then(function(r) { if (r.error) console.error('[audit]', action, r.error); })
    .catch(function(e) { console.error('[audit]', action, e); });
}

// BUG-017 fix: gunakan crypto.randomUUID() untuk ID yang lebih aman dan anti-collision
function _genId(prefix) {
  var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()
    : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,8).toUpperCase();
  return prefix + '-' + uuid;
}

// PATCH 066/067 (Snapshot Bank Soal): timpa konten `soal` dengan SNAPSHOT beku dari
// quiz_soal (bila ada), agar tampilan hasil & review menampilkan soal SEBAGAIMANA
// dikerjakan murid — bukan konten Bank Soal yang mungkin sudah diedit. Bila snapshot
// belum ada (data lama / kuis belum submit), biarkan konten live (fallback aman).
function _overrideSoalFromSnap(s, snap) {
  if (!s || !snap || !snap.snap_at) return;
  if (snap.snap_tipe_soal) s.tipe_soal = snap.snap_tipe_soal;
  if (snap.snap_teks_soal != null) s.teks_soal = snap.snap_teks_soal;
  s.teks_arab = snap.snap_teks_arab;
  s.audio_url = snap.snap_audio_url;
  if (Array.isArray(snap.snap_pilihan)) {
    s.soal_pilihan = snap.snap_pilihan.map(function (p, i) {
      return { id_pilihan: 'snap-' + i, teks_pilihan: p.teks, is_benar: !!p.is_benar, urutan: p.urutan };
    });
  }
  if (Array.isArray(snap.snap_pasangan)) {
    s.soal_pasangan = snap.snap_pasangan.map(function (p, i) {
      return { id_pasangan: 'snap-' + i, teks_kiri: p.kiri, teks_kanan: p.kanan, urutan: p.urutan };
    });
  }
  if (Array.isArray(snap.snap_kunci)) {
    s.soal_kunci_isian = snap.snap_kunci.map(function (k, i) {
      return { id_kunci: 'snap-' + i, teks_kunci: k };
    });
  }
}

// Kolom snapshot yang perlu diambil dari quiz_soal untuk substitusi tampilan.
var _SNAP_COLS = 'id_quiz, id_soal, snap_tipe_soal, snap_teks_soal, snap_teks_arab, snap_audio_url, snap_pilihan, snap_pasangan, snap_kunci, snap_at';

// M1: baris SPP gateway 'menunggu' yang invoice Mayar-nya sudah kedaluwarsa
// (ditinggalkan, tak jadi dibayar). Diperlakukan sebagai 'belum' di tampilan
// supaya tidak terlihat "sedang diproses" selamanya. Backend (claim_spp_gateway)
// juga mengizinkan pembuatan invoice baru untuk baris seperti ini.
function _sppGatewayExpired(r) {
  return r && r.metode_bayar === 'gateway' && r.status === 'menunggu'
    && r.mayar_expired_at && new Date(r.mayar_expired_at).getTime() < Date.now();
}

// L4: jalur lama simpan template koreksi (3 request, NON-ATOMIK). Hanya
// dipakai sebagai fallback bila RPC save_template_koreksi belum ada di DB
// (patch_039 belum dijalankan). p_templates sudah dinormalisasi:
// [{ id_template|null, kategori, teks }].
async function _saveTemplateKoreksiLegacy(templates) {
  var existing = [], fresh = [];
  templates.forEach(function(t, i){
    var r = { kategori: t.kategori, teks: t.teks, urutan: i + 1, status: 'aktif' };
    if (t.id_template) { r.id_template = t.id_template; existing.push(r); } else { fresh.push(r); }
  });
  var keptIds = existing.map(function(r){ return r.id_template; });
  var { data: cur, error: curErr } = await _sb.from('template_koreksi').select('id_template').eq('status','aktif');
  _check(curErr, 'saveTemplateKoreksi.fetch');
  var toOff = (cur || []).map(function(r){ return r.id_template; }).filter(function(id){ return keptIds.indexOf(id) < 0; });
  if (toOff.length) {
    var off = await _sb.from('template_koreksi').update({ status:'nonaktif' }).in('id_template', toOff).select('id_template');
    _check(off.error, 'saveTemplateKoreksi.deactivate');
  }
  var written = 0;
  if (existing.length) {
    var up = await _sb.from('template_koreksi').upsert(existing, { onConflict:'id_template' }).select('id_template');
    _check(up.error, 'saveTemplateKoreksi.update');
    written += (up.data || []).length;
  }
  if (fresh.length) {
    var ins = await _sb.from('template_koreksi').insert(fresh).select('id_template');
    _check(ins.error, 'saveTemplateKoreksi.insert');
    written += (ins.data || []).length;
  }
  if (templates.length > 0 && written === 0) {
    throw new Error('Template tidak tersimpan (0 baris ditulis ke DB). Kemungkinan sesi ini tidak punya hak admin (RLS admin_write_template). Coba logout lalu login ulang sebagai admin.');
  }
  return { status:'ok', written: written };
}

// Nama hari Indonesia
function _hariIni() {
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
}

// Tanggal hari ini di zona waktu Asia/Jakarta, format YYYY-MM-DD
// (new Date().toISOString() pakai UTC -- bisa nyasar ke tanggal kemarin
// sekitar jam 00:00-07:00 WIB. Lihat rencana_kelas_pengganti.md §10.G)
function _todayJakarta() {
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  var y, m, d;
  parts.forEach(function(p) {
    if (p.type === 'year') y = p.value;
    else if (p.type === 'month') m = p.value;
    else if (p.type === 'day') d = p.value;
  });
  return y + '-' + m + '-' + d;
}

// Daftar nama_level dengan partner_belajar_enabled=true (cache ringan per sesi)
var _belajarLevelNamesCache = null;
async function _belajarLevelNames() {
  if (_belajarLevelNamesCache) return _belajarLevelNamesCache;
  var { data, error } = await _sb.from('level').select('nama_level').eq('partner_belajar_enabled', true);
  if (error) return [];
  _belajarLevelNamesCache = (data || []).map(function(l) { return l.nama_level; });
  return _belajarLevelNamesCache;
}

// ─────────────────────────────────────────────
//  ABSENSI GURU — mesin rekap (agregasi JS, lihat RANCANGAN_ABSENSI_GURU.md §4)
//  Keputusan §10.4: dihitung di klien, BUKAN RPC. Acuan pola: getJadwalHariIni.
// ─────────────────────────────────────────────

// Jenis sesi yang DIABAIKAN total dari absensi guru (guru tidak diabsen untuk kajian).
var _ABSENSI_JENIS_DIABAIKAN = 'Kajian At-Tibyan';

// Nama hari Indonesia -> indeks getDay()/getUTCDay() (Minggu=0). Mencakup variasi ejaan.
var _HARI_INDEX = {
  'minggu': 0, 'ahad': 0, 'senin': 1, 'selasa': 2, 'rabu': 3,
  'kamis': 4, 'jumat': 5, "jum'at": 5, 'sabtu': 6,
};

// Durasi (menit) dari jam isian guru "HH:MM". Pelengkap bila selesai_pada NULL (baris lama).
function _absensiMenitDariJam(jm, js) {
  if (!jm || !js) return null;
  var a = String(jm).split(':'), b = String(js).split(':');
  if (a.length < 2 || b.length < 2) return null;
  var m1 = (+a[0]) * 60 + (+a[1]);
  var m2 = (+b[0]) * 60 + (+b[1]);
  if (!isFinite(m1) || !isFinite(m2)) return null;
  var d = m2 - m1;
  if (d < 0) d += 1440;            // sesi melewati tengah malam (mis. Qiyam dini hari)
  return d > 0 ? d : null;
}

// Durasi mengajar nyata. UTAMA: server (selesai_pada − created_at). CADANGAN: jam isian guru.
// null = "tak terukur" (jangan dihukum; dianggap Hadir penuh — lihat §4.1).
function _absensiDurasiMenit(k) {
  if (k.selesai_pada && k.created_at) {
    var ms = new Date(k.selesai_pada).getTime() - new Date(k.created_at).getTime();
    if (isFinite(ms) && ms > 0) return Math.round(ms / 60000);
  }
  return _absensiMenitDariJam(
    k.jam_mulai ? String(k.jam_mulai).substring(0, 5) : null,
    k.jam_selesai ? String(k.jam_selesai).substring(0, 5) : null
  );
}

// Ambil semua bahan rekap untuk satu bulan.
// opts: { bulan(1-12), tahun, scope:'admin'|'guru', id_guru? }
//   scope 'guru' membatasi query halaqah ke milik sendiri (sesuai RLS guru).
async function _fetchAbsensiData(opts) {
  var bulan = opts.bulan, tahun = opts.tahun;
  var mm = String(bulan).padStart(2, '0');
  var lastDay = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  var start = tahun + '-' + mm + '-01';
  var end   = tahun + '-' + mm + '-' + String(lastDay).padStart(2, '0');

  var settingP = _sb.from('pengaturan_absensi_guru').select('*').eq('id', 1).maybeSingle();

  var hqQ = _sb.from('halaqah')
    .select('id_halaqah, nama_halaqah, level, id_guru, nama_guru, jadwal_hari, jam_mulai')
    .eq('status', 'aktif');
  if (opts.scope === 'guru') hqQ = hqQ.eq('id_guru', opts.id_guru);

  var liburQ = _sb.from('hari_libur_resmi').select('tanggal').gte('tanggal', start).lte('tanggal', end);

  var ovQ = _sb.from('absensi_guru_override').select('*').gte('tanggal', start).lte('tanggal', end);
  if (opts.id_guru) ovQ = ovQ.eq('id_guru', opts.id_guru);

  var results = await Promise.all([settingP, hqQ, liburQ, ovQ]);
  var settingR = results[0], hqR = results[1], liburR = results[2], ovR = results[3];
  _check(hqR.error, 'absensi:halaqah');
  // T2 — jangan telan error override secara senyap. Bukan fatal (rekap tetap bisa tampil tanpa
  // koreksi), tapi peringatkan agar inkonsistensi admin↔guru tidak luput dari perhatian.
  if (ovR && ovR.error) console.warn('[absensi] gagal membaca override (koreksi admin mungkin tak diterapkan):', ovR.error.message || ovR.error);

  var halaqah = hqR.data || [];
  var hqIds = halaqah.map(function(h) { return h.id_halaqah; });

  var kbm = [];
  if (hqIds.length > 0) {
    // SEMUA jenis (At-Tibyan disaring saat derivasi, tapi tetap "menempati" slot → cegah Alpa palsu).
    var kbmR = await _sb.from('kbm_log')
      .select('id_kbm, id_halaqah, id_guru, nama_guru, jenis_sesi, status, is_pengganti, tanggal_pertemuan, jam_mulai, jam_selesai, created_at, selesai_pada, keterangan_libur')
      .in('id_halaqah', hqIds)
      .in('status', ['selesai', 'libur', 'draft'])
      .gte('tanggal_pertemuan', start).lte('tanggal_pertemuan', end);
    _check(kbmR.error, 'absensi:kbm_log');
    kbm = kbmR.data || [];
  }

  // Daftar guru untuk baris rekap. Admin: semua guru aktif. Guru: diri sendiri saja
  // (guru tak punya hak baca seluruh tabel users via RLS).
  var guruList;
  if (opts.scope === 'guru') {
    guruList = [{ id_user: opts.id_guru, nama: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '' }];
  } else {
    var gR = await _sb.from('users').select('id_user, nama_lengkap').eq('role', 'guru').eq('status', 'aktif');
    guruList = (gR.data || []).map(function(u) { return { id_user: u.id_user, nama: u.nama_lengkap }; });
  }

  var liburSet = {};
  (liburR.data || []).forEach(function(r) { liburSet[r.tanggal] = true; });

  return {
    bulan: bulan, tahun: tahun, lastDay: lastDay,
    setting: settingR.data || { durasi_minimal_menit: 90, durasi_outlier_menit: 180 },
    halaqah: halaqah, kbm: kbm, override: (ovR.data || []), liburSet: liburSet, guruList: guruList,
  };
}

// Derivasi murni (tanpa I/O) → matriks rekap. Lihat §4.1 (A)(B)(C).
function _deriveRekapAbsensi(data) {
  var ambang  = data.setting.durasi_minimal_menit || 90;
  var outlier = data.setting.durasi_outlier_menit || 180;
  var mulai   = data.setting.tanggal_mulai_berlaku || null;  // Alpa hanya utk tgl >= ini (NULL = tanpa batas)
  var today   = _todayJakarta();
  var mm      = String(data.bulan).padStart(2, '0');

  var hqById = {};
  data.halaqah.forEach(function(h) { hqById[h.id_halaqah] = h; });

  // Slot terisi (id_halaqah|tanggal) dari SEMUA kbm (termasuk At-Tibyan & draft) → guard Alpa palsu.
  var slotOccupied = {};
  data.kbm.forEach(function(k) { slotOccupied[k.id_halaqah + '|' + k.tanggal_pertemuan] = true; });

  // Satu unit per sel (id_guru|id_halaqah|tanggal).
  var cellMap = {};
  function putUnit(u) { cellMap[u.id_guru + '|' + u.id_halaqah + '|' + u.tanggal] = u; }
  function newUnit(over) {
    return Object.assign({
      id_guru: '', nama_guru: '', id_halaqah: '', nama_halaqah: '', tanggal: '',
      jenis_sesi: 'KBM Reguler', status: '', durasi_menit: null,
      pengganti: false, outlier: false, durasi_singkat: false,
      perlu_ditutup: false, override: false, keterangan: '',
    }, over || {});
  }

  // (A) Unit dari sesi nyata
  data.kbm.forEach(function(k) {
    var jenis = k.jenis_sesi || 'KBM Reguler';
    if (jenis === _ABSENSI_JENIS_DIABAIKAN) return;        // diabaikan total
    var tgl = k.tanggal_pertemuan;
    var hq  = hqById[k.id_halaqah] || {};
    var u = newUnit({
      id_guru: k.id_guru, nama_guru: k.nama_guru || hq.nama_guru || '',
      id_halaqah: k.id_halaqah, nama_halaqah: hq.nama_halaqah || '',
      tanggal: tgl, jenis_sesi: jenis,
    });

    if (k.status === 'libur') {
      u.status = 'I'; u.keterangan = k.keterangan_libur || '';
      putUnit(u); return;
    }
    if (k.status === 'draft') {
      if (tgl < today) { u.status = '_DRAFT'; u.perlu_ditutup = true; putUnit(u); }
      return;                                              // hari ini/akan datang: belum dinilai
    }
    if (k.status === 'selesai') {
      var durasi = _absensiDurasiMenit(k);
      u.durasi_menit = durasi;
      if (durasi != null && durasi > outlier) u.outlier = true;
      if (k.is_pengganti) {
        u.status = 'HP'; u.pengganti = true;
        if (durasi != null && durasi < ambang) u.durasi_singkat = true;
      } else if (durasi != null && durasi < ambang) {
        u.status = 'DS'; u.durasi_singkat = true;
      } else {
        u.status = 'H';                                    // ≥ ambang ATAU tak terukur
      }
      putUnit(u);
    }
  });

  // (B) Alpa dari jadwal Reguler (hanya halaqah Reguler berjadwal yang punya jam_mulai)
  data.halaqah.forEach(function(h) {
    if (h.level === 'Level Qiyam') return;                 // Alpa hanya untuk Reguler
    if (!h.jadwal_hari || !h.jam_mulai) return;
    var hariIdx = [];
    (h.jadwal_hari || '').toLowerCase().split(/[,\s]+/).forEach(function(t) {
      if (t && _HARI_INDEX.hasOwnProperty(t)) hariIdx.push(_HARI_INDEX[t]);
    });
    if (hariIdx.length === 0) return;
    for (var d = 1; d <= data.lastDay; d++) {
      var tgl = data.tahun + '-' + mm + '-' + String(d).padStart(2, '0');
      if (tgl >= today) continue;                          // hanya tanggal yang sudah lewat
      if (mulai && tgl < mulai) continue;                  // sebelum "berlaku mulai" → tak di-Alpa
      var wd = new Date(Date.UTC(data.tahun, data.bulan - 1, d)).getUTCDay();
      if (hariIdx.indexOf(wd) < 0) continue;               // bukan hari terjadwal
      if (slotOccupied[h.id_halaqah + '|' + tgl]) continue; // sudah ada sesi → bukan Alpa
      putUnit(newUnit({
        id_guru: h.id_guru, nama_guru: h.nama_guru || '',
        id_halaqah: h.id_halaqah, nama_halaqah: h.nama_halaqah || '',
        tanggal: tgl, jenis_sesi: 'KBM Reguler',
        status: data.liburSet[tgl] ? 'L' : 'A',
      }));
    }
  });

  // (C) Overlay override admin (atas menang)
  data.override.forEach(function(ov) {
    var key = ov.id_guru + '|' + ov.id_halaqah + '|' + ov.tanggal;
    var hq  = hqById[ov.id_halaqah] || {};
    var u = cellMap[key] || newUnit({
      id_guru: ov.id_guru, nama_guru: hq.nama_guru || '',
      id_halaqah: ov.id_halaqah, nama_halaqah: hq.nama_halaqah || '',
      tanggal: ov.tanggal,
    });
    u.status = ov.status;
    u.override = true;
    u.pengganti = ov.status === 'HP';
    u.perlu_ditutup = false;
    if (ov.keterangan) u.keterangan = ov.keterangan;
    cellMap[key] = u;
  });

  // Agregasi per guru
  var guruRows = {};
  function ensureRow(id_guru, nama) {
    if (!guruRows[id_guru]) {
      guruRows[id_guru] = {
        id_guru: id_guru, nama_guru: nama || '',
        H: 0, DS: 0, HP: 0, HP_penuh: 0, I: 0, A: 0, L: 0, perlu_ditutup: 0, cells: {},
      };
    } else if (!guruRows[id_guru].nama_guru && nama) {
      guruRows[id_guru].nama_guru = nama;
    }
    return guruRows[id_guru];
  }
  data.guruList.forEach(function(g) { ensureRow(g.id_user, g.nama); });

  Object.keys(cellMap).forEach(function(key) {
    var u = cellMap[key];
    var row = ensureRow(u.id_guru, u.nama_guru);
    if (!row.cells[u.tanggal]) row.cells[u.tanggal] = [];
    row.cells[u.tanggal].push(u);
    switch (u.status) {
      case 'H':  row.H++; break;
      case 'DS': row.DS++; break;
      case 'HP': row.HP++; if (u.durasi_menit == null || u.durasi_menit >= ambang) row.HP_penuh++; break;
      case 'I':  row.I++; break;
      case 'A':  row.A++; break;
      case 'L':  row.L++; break;
      case '_DRAFT': row.perlu_ditutup++; break;
    }
  });

  var rows = Object.keys(guruRows).map(function(id) {
    var r = guruRows[id];
    var hadirNum  = r.H + r.DS + r.HP;
    var penyebut  = hadirNum + r.I + r.A;
    var durasiNum = r.H + r.HP_penuh;
    var durasiPen = r.H + r.DS + r.HP;
    // Izin/libur yang sudah ditebus kelas pengganti (HP) tidak menggerus % kehadiran.
    // Mekanisme pengganti khusus untuk libur→Izin (lihat getHalaqahSaya: sisa_pengganti),
    // jadi yang dikecualikan hanya Izin yang terganti, bukan Alpa.
    var izinDiganti = Math.min(r.HP, r.I);
    var penyebutEfektif = Math.max(0, penyebut - izinDiganti);
    r.izin_diganti  = izinDiganti;
    r.pct_kehadiran = penyebutEfektif > 0 ? Math.min(100, Math.round(hadirNum / penyebutEfektif * 100)) : null;
    r.pct_durasi    = durasiPen > 0 ? Math.round(durasiNum / durasiPen * 100) : null;
    var izinAlpa = r.I + r.A;
    r.hutang = { izin_alpa: izinAlpa, diganti: Math.min(r.HP, izinAlpa), sisa: Math.max(0, izinAlpa - r.HP) };
    return r;
  });
  rows.sort(function(a, b) { return (a.nama_guru || '').localeCompare(b.nama_guru || ''); });

  var tanggalList = [];
  for (var d2 = 1; d2 <= data.lastDay; d2++) {
    tanggalList.push(data.tahun + '-' + mm + '-' + String(d2).padStart(2, '0'));
  }

  return {
    bulan: data.bulan, tahun: data.tahun,
    ambang: ambang, ambang_wajar: outlier, tanggal_mulai_berlaku: mulai,
    tanggal_list: tanggalList, guru: rows,
  };
}

// Palet status absensi guru — util BERSAMA (dipakai admin & guru). Lihat RANCANGAN §3.
// Ekstraksi palet inline lama (guru/index.html) ke sini agar warna matriks seragam.
var AbsensiGuruUtil = {
  STATUS_META: {
    H:      { label: 'Hadir',             short: 'H',  color: '#15803d', bg: '#dcfce7' },
    DS:     { label: 'Durasi Singkat',    short: 'DS', color: '#b45309', bg: '#fef3c7' },
    HP:     { label: 'Hadir (Pengganti)', short: 'Hᴾ', color: '#15803d', bg: '#dcfce7' },
    I:      { label: 'Izin',              short: 'I',  color: '#1d4ed8', bg: '#dbeafe' },
    A:      { label: 'Alpa',              short: 'A',  color: '#b91c1c', bg: '#fee2e2' },
    L:      { label: 'Libur',             short: 'L',  color: '#6b7280', bg: '#f3f4f6' },
    _DRAFT: { label: 'Perlu Ditutup',     short: '⏳', color: '#6b7280', bg: '#f3f4f6' },
  },
  meta: function(code) {
    return this.STATUS_META[code] || { label: code || '–', short: code || '–', color: '#6b7280', bg: '#f3f4f6' };
  },
  // Penanda tambahan pada sel (selain status): ᴾ pengganti · ⚠ singkat/outlier · ⏳ draft.
  flags: function(unit) {
    if (!unit) return '';
    var f = '';
    if (unit.pengganti) f += 'ᴾ';
    if (unit.durasi_singkat || unit.outlier) f += '⚠';
    if (unit.perlu_ditutup) f += '⏳';
    return f;
  },
};

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────
var Auth = {
  login: async function(id_user, password) {
    var res = await fetch(SUPABASE_URL + '/functions/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON },
      body: JSON.stringify({ id_user: id_user.trim().toUpperCase(), password: password }),
    });
    var data;
    try { data = await res.json(); } catch(e) { throw new Error('Server tidak merespons dengan benar. Coba lagi.'); }
    if (data.status === 'error') throw new Error(data.message);
    if (!data.user || !data.access_token) throw new Error('Respons login tidak lengkap. Coba lagi.');
    await _sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    _currentUser = data.user;
    localStorage.setItem('hq_user',    JSON.stringify(data.user));
    localStorage.setItem('hq_token',   data.access_token);
    localStorage.setItem('hq_refresh', data.refresh_token);
    return data;
  },

  logout: async function() {
    await _sb.auth.signOut();
    localStorage.removeItem('hq_user');
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_refresh');
    _currentUser = null;
    // BUG-010 fix: deteksi path lebih akurat, support deployment di subdirektori apapun
    var path = window.location.pathname;
    var inSubdir = /\/(guru|admin|murid)\//i.test(path);
    var loginPage = inSubdir ? '../index.html' : 'index.html';
    window.location.href = loginPage;
  },

  getUser: function() { return _currentUser; },
  getProfile: async function() {
    var uid = _uid();
    if (!uid) return { status: 'error', message: 'Sesi telah berakhir. Silakan login ulang.' };
    var { data, error } = await _sb.from('users').select('*').eq('id_user', uid).maybeSingle();
    if (error) throw new Error(error.message);
    return { status: 'ok', data: data || _currentUser };
  },
  updateProfile: async function(d) {
    var uid = _uid();
    if (!uid) throw new Error('Sesi telah berakhir. Silakan login ulang.');
    var { error } = await _sb.from('users').update({ no_hp: d.no_hp, email: d.email, alamat: d.alamat }).eq('id_user', uid);
    _check(error, 'updateProfile');
    return { status: 'ok' };
  },

  changePassword: async function(d) {
    var uid = _uid();
    if (!uid) throw new Error('Sesi telah berakhir. Silakan login ulang.');
    var newPw = d.newPassword || d.password_baru;
    // Verifikasi password lama
    await Auth.login(uid, d.oldPassword || d.password_lama);
    // Update di Supabase Auth
    var { error } = await _sb.auth.updateUser({ password: newPw });
    _check(error, 'changePassword');
    // Sync password_hash di tabel users (agar verify_user_password tetap valid)
    await _sb.rpc('set_user_password', { p_id_user: _uid(), p_password: newPw });
    return { status: 'ok', message: 'Password berhasil diubah' };
  },
};

// ─────────────────────────────────────────────
//  GURU API
// ─────────────────────────────────────────────
var GuruAPI = {

  // ── Dashboard ──────────────────────────────
  getDashboard: async function() {
    var id_guru = _uid();
    var today   = _todayJakarta();   // L2: zona Asia/Jakarta, bukan UTC (hindari off-by-one < 07:00 WIB)
    var month   = today.slice(0, 7);

    var [hqRes, anggotaRes, kbmHariRes, kbmBulanRes, draftRes, levelsRes] = await Promise.all([
      _sb.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif'),
      _sb.from('anggota').select('id_murid, id_halaqah').eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').eq('tanggal_pertemuan', today),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').gte('tanggal_pertemuan', month + '-01'),
      // Defensif: pakai limit(1) (bukan maybeSingle) agar dashboard tetap load
      // walau terjadi anomali >1 draft (maybeSingle akan melempar error).
      _sb.from('kbm_log').select('*').eq('id_guru', id_guru).eq('status', 'draft')
         .order('tanggal_pertemuan', { ascending: false }).limit(1),
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
    ]);

    var halaqah   = hqRes.data || [];
    var hqIds     = halaqah.map(function(h) { return h.id_halaqah; });
    var muridSet  = new Set((anggotaRes.data || []).filter(function(a) {
      return hqIds.includes(a.id_halaqah);
    }).map(function(a) { return a.id_murid; }));

    // Hitung pertemuan_ke per halaqah per jenis_sesi secara terpisah
    var kbmCounts = {}; // { id_halaqah: { jenis_sesi: count } }
    if (hqIds.length > 0) {
      var { data: kbmAll } = await _sb.from('kbm_log')
        .select('id_halaqah, jenis_sesi')
        .in('id_halaqah', hqIds).eq('status', 'selesai');
      (kbmAll || []).forEach(function(k) {
        var jenis = k.jenis_sesi || 'KBM Reguler';
        if (!kbmCounts[k.id_halaqah]) kbmCounts[k.id_halaqah] = {};
        kbmCounts[k.id_halaqah][jenis] = (kbmCounts[k.id_halaqah][jenis] || 0) + 1;
      });
    }

    var targetSesiMap = {};
    (levelsRes.data || []).forEach(function(l) {
      if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
      if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
    });

    halaqah = halaqah.map(function(h) {
      var muridCount = (anggotaRes.data || []).filter(function(a) {
        return a.id_halaqah === h.id_halaqah;
      }).length;
      var counts = kbmCounts[h.id_halaqah] || {};
      var isQiyam = h.level === 'Level Qiyam';
      var regCount = counts['KBM Reguler'] || 0;
      var qiyamCount = counts['KBM Qiyam'] || 0;
      var mainCount = isQiyam ? qiyamCount : regCount;
      var targetSesi = targetSesiMap[h.level] || 40;
      return Object.assign({}, h, {
        total_murid  : muridCount,
        pertemuan_ke : mainCount + 1,
        sisa_sesi    : isQiyam ? 0 : Math.max(0, targetSesi - regCount),
        target_sesi  : isQiyam ? 0 : targetSesi,
        jam_mulai    : h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai  : h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
      });
    });

    var draft = (draftRes.data && draftRes.data[0]) || null;
    if (draft) {
      draft.jam_mulai = draft.jam_mulai ? draft.jam_mulai.substring(0, 5) : null;
      draft.jam_selesai = draft.jam_selesai ? draft.jam_selesai.substring(0, 5) : null;
    }

    return {
      status: 'ok',
      data: {
        halaqah      : halaqah,
        total_halaqah: halaqah.length,
        total_murid  : muridSet.size,
        kbm_hari_ini : (kbmHariRes.data || []).length,
        kbm_bulan_ini: (kbmBulanRes.data || []).length,
        sesi_draft   : draft,
      }
    };
  },

  // ── Jadwal hari ini ────────────────────────
  getJadwalHariIni: async function() {
    var id_guru = _uid();
    var hari    = _hariIni();
    var today   = _todayJakarta();

    var [{ data: halaqah, error }, { data: liburResmi }, levelsRes] = await Promise.all([
      _sb.from('halaqah').select('*, anggota(count)')
        .eq('id_guru', id_guru).eq('status', 'aktif'),
      _sb.from('hari_libur_resmi').select('tanggal, keterangan').eq('tanggal', today).maybeSingle(),
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
    ]);
    _check(error, 'getJadwalHariIni');

    // Hitung pertemuan_ke per halaqah — pisahkan Reguler dan Qiyam
    var hqIds = (halaqah || []).map(function(h) { return h.id_halaqah; });
    // Hitung pertemuan per jenis KBM — masing-masing punya counter sendiri
    var kbmByJenis       = {};  // { id_halaqah: { 'KBM Reguler': N (selesai), ... } }
    var liburByJenis     = {};  // { id_halaqah: { jenis: N (status='libur') } }
    var penggantiByJenis = {};  // { id_halaqah: { jenis: N (selesai & is_pengganti) } }
    var liburEntries     = {};  // { id_halaqah: { jenis: [{tanggal_pertemuan, keterangan_libur}, ...] } }
    if (hqIds.length > 0) {
      var { data: kbmAll } = await _sb.from('kbm_log')
        .select('id_halaqah, jenis_sesi, status, is_pengganti, tanggal_pertemuan, keterangan_libur')
        .in('id_halaqah', hqIds).in('status', ['selesai', 'libur']);
      (kbmAll || []).forEach(function(k) {
        var jenis = k.jenis_sesi || 'KBM Reguler';
        if (k.status === 'selesai') {
          if (!kbmByJenis[k.id_halaqah]) kbmByJenis[k.id_halaqah] = {};
          kbmByJenis[k.id_halaqah][jenis] = (kbmByJenis[k.id_halaqah][jenis] || 0) + 1;
          if (k.is_pengganti) {
            if (!penggantiByJenis[k.id_halaqah]) penggantiByJenis[k.id_halaqah] = {};
            penggantiByJenis[k.id_halaqah][jenis] = (penggantiByJenis[k.id_halaqah][jenis] || 0) + 1;
          }
        } else if (k.status === 'libur') {
          if (!liburByJenis[k.id_halaqah]) liburByJenis[k.id_halaqah] = {};
          liburByJenis[k.id_halaqah][jenis] = (liburByJenis[k.id_halaqah][jenis] || 0) + 1;
          if (!liburEntries[k.id_halaqah]) liburEntries[k.id_halaqah] = {};
          if (!liburEntries[k.id_halaqah][jenis]) liburEntries[k.id_halaqah][jenis] = [];
          liburEntries[k.id_halaqah][jenis].push({
            tanggal_pertemuan: k.tanggal_pertemuan,
            keterangan_libur: k.keterangan_libur || '',
          });
        }
      });
    }

    var targetSesiMap = {};
    if (levelsRes && levelsRes.data) {
      levelsRes.data.forEach(function(l) {
        if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
        if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
      });
    }

    var result = (halaqah || []).map(function(h) {
      var jadwalHari = (h.jadwal_hari || '').split(/[,\s]+/);
      var isHariIni  = jadwalHari.some(function(j) {
        return j.toLowerCase().includes(hari.toLowerCase());
      });
      var jenisCounts = kbmByJenis[h.id_halaqah] || {};
      var regCount    = jenisCounts['KBM Reguler']    || 0;
      var qiyamCount  = jenisCounts['KBM Qiyam']      || 0;
      var microCount  = jenisCounts['Micro Teaching']  || 0;
      var lainCount   = jenisCounts['Lainnya']          || 0;
      // sisa_pengganti per jenis_sesi = count(libur) - count(selesai & is_pengganti), clamp >= 0
      var liburCounts     = liburByJenis[h.id_halaqah] || {};
      var penggantiCounts = penggantiByJenis[h.id_halaqah] || {};
      var sisaPengganti = {};
      var penggantiPending = {};  // { jenis: [{tanggal_pertemuan, keterangan_libur}, ...] } -- reminder libur belum diganti
      var entriesByJenis = liburEntries[h.id_halaqah] || {};
      ['KBM Reguler', 'KBM Qiyam', 'Micro Teaching', 'Lainnya'].forEach(function(j) {
        var sisa = Math.max(0, (liburCounts[j] || 0) - (penggantiCounts[j] || 0));
        sisaPengganti[j] = sisa;
        if (sisa > 0) {
          var entries = (entriesByJenis[j] || []).slice().sort(function(a, b) {
            return (b.tanggal_pertemuan || '').localeCompare(a.tanggal_pertemuan || '');
          });
          penggantiPending[j] = entries.slice(0, sisa);
        }
      });
      var targetSesi = targetSesiMap[h.level] || 40;
      return {
        id_halaqah             : h.id_halaqah,
        nama_halaqah           : h.nama_halaqah,
        level                  : h.level,
        jadwal_hari            : h.jadwal_hari,
        jam_mulai              : h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai            : h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
        lokasi                 : h.lokasi,
        total_murid            : h.anggota ? h.anggota[0].count : 0,
        pertemuan_ke           : (h.level === 'Level Qiyam' ? qiyamCount : regCount) + 1,       // backward compat
        pertemuan_ke_reguler   : regCount + 1,
        pertemuan_ke_qiyam     : qiyamCount + 1,
        pertemuan_ke_microteach: microCount + 1,
        pertemuan_ke_lainnya   : lainCount + 1,
        total_sesi             : regCount,           // hanya Reguler untuk progress 40
        sisa_sesi              : Math.max(0, targetSesi - regCount),
        target_sesi            : targetSesi,
        sisa_pengganti         : sisaPengganti,
        pengganti_pending      : penggantiPending,
        is_hari_ini            : isHariIni,
      };
    });

    result.sort(function(a, b) {
      if (a.is_hari_ini && !b.is_hari_ini) return -1;
      if (!a.is_hari_ini && b.is_hari_ini) return 1;
      return (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
    });

    return { status: 'ok', data: result, hari_ini: hari, libur_resmi_hari_ini: liburResmi || null };
  },

  // ── Absensi Saya (transparansi kehadiran guru) ─────────────
  // Rekap kehadiran + durasi milik sendiri untuk satu bulan. Lihat RANCANGAN §6, §7.2.
  getAbsensiSaya: async function(p) {
    p = p || {};
    var now   = new Date();
    var bulan = Number(p.bulan) || (now.getMonth() + 1);
    var tahun = Number(p.tahun) || now.getFullYear();
    var id_guru = _uid();
    if (!id_guru) return { status: 'error', message: 'Sesi telah berakhir. Silakan login ulang.' };

    var data  = await _fetchAbsensiData({ bulan: bulan, tahun: tahun, scope: 'guru', id_guru: id_guru });
    var rekap = _deriveRekapAbsensi(data);
    var me = rekap.guru.filter(function(g) { return g.id_guru === id_guru; })[0] || {
      id_guru: id_guru, nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      H: 0, DS: 0, HP: 0, HP_penuh: 0, I: 0, A: 0, L: 0, perlu_ditutup: 0, cells: {},
      pct_kehadiran: null, pct_durasi: null, izin_diganti: 0, hutang: { izin_alpa: 0, diganti: 0, sisa: 0 },
    };
    return { status: 'ok', data: {
      bulan: bulan, tahun: tahun, ambang: rekap.ambang, ambang_wajar: rekap.ambang_wajar,
      tanggal_list: rekap.tanggal_list, rekap: me,
    } };
  },

  // ── Halaqah ────────────────────────────────
  getHalaqahSaya: async function() {
    var { data, error } = await _sb.from('halaqah')
      .select('*').eq('id_guru', _uid()).eq('status', 'aktif').order('nama_halaqah');
    _check(error, 'getHalaqahSaya');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data };
  },

  // ── Murid ──────────────────────────────────
  getMurid: async function(id_halaqah) {
    var [anggotaRes, nilaiAll, hqRes] = await Promise.all([
      _sb.from('anggota').select('*, users!anggota_id_murid_fkey(no_hp, email)')
        .eq('id_halaqah', id_halaqah).eq('status', 'aktif').order('nama_murid'),
      _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, status_hadir, adab, kamera_murid',
        function(q){ return q.eq('id_halaqah', id_halaqah).order('id_nilai'); }, 'getMurid:nilai_kbm'),
      _sb.from('halaqah').select('level').eq('id_halaqah', id_halaqah).maybeSingle(),
    ]);
    _check(anggotaRes.error, 'getMurid');

    var targetSesi = 40;
    if (hqRes && hqRes.data && hqRes.data.level) {
      var { data: lvl } = await _sb.from('level').select('jumlah_pertemuan').or('id_level.eq.' + hqRes.data.level + ',nama_level.eq.' + hqRes.data.level).maybeSingle();
      if (lvl && lvl.jumlah_pertemuan) targetSesi = lvl.jumlah_pertemuan;
    }

    return { status: 'ok', data: (anggotaRes.data || []).map(function(a) {
      var nm = nilaiAll.filter(function(n) { return n.id_murid === a.id_murid; });
      var hadir = nm.filter(function(n) { return ['H','T'].includes(n.status_hadir); });
      var adabData   = hadir.filter(function(n) { return n.adab; });
      var kameraData = hadir.filter(function(n) { return n.kamera_murid; });
      var hadirCount = hadir.length;
      return Object.assign({}, a, {
        no_hp         : a.users && a.users.no_hp,
        email         : a.users && a.users.email,
        jumlah_hadir  : hadirCount,
        total_hadir   : hadirCount,
        total_sesi    : nm.length,
        pct_hadir     : nm.length > 0 ? Math.round(hadirCount / nm.length * 100) : 0,
        skor_hadir_raw: hadirCount,
        skor_dari_40  : Math.min(Math.round(hadirCount / targetSesi * 100), 100),
        poin_adab     : adabData.length > 0 ? Math.round(adabData.filter(function(n){return n.adab==='Baik';}).length / adabData.length * 100) : 0,
        poin_kamera   : kameraData.length > 0 ? Math.round(kameraData.filter(function(n){return n.kamera_murid==='kamera terbuka';}).length / kameraData.length * 100) : 0,
      });
    })};
  },

  getMuridBelum: async function(id_halaqah) {
    // Ambil semua murid yang belum di halaqah ini
    var { data: sudah } = await _sb.from('anggota')
      .select('id_murid').eq('id_halaqah', id_halaqah);
    var sudahIds = (sudah || []).map(function(a) { return a.id_murid; });
    var q = _sb.from('users').select('*').eq('role', 'murid').eq('status', 'aktif');
    if (sudahIds.length > 0) q = q.not('id_user', 'in', '(' + sudahIds.join(',') + ')');
    var { data, error } = await q.order('nama_lengkap');
    _check(error, 'getMuridBelum');
    return { status: 'ok', data };
  },

  addMuridByGuru: async function(d) {
    var user = await _sb.from('users').select('nama_lengkap').eq('id_user', d.id_murid).single();
    var { error } = await _sb.from('anggota').insert({
      id_halaqah: d.id_halaqah, id_murid: d.id_murid,
      nama_murid: user.data && user.data.nama_lengkap,
      level: d.level, target_level: d.target_level, status: 'aktif',
    });
    _check(error, 'addMuridByGuru');
    return { status: 'ok', message: 'Murid berhasil ditambahkan' };
  },

  updateCatatanMurid: async function(d) {
    var { error } = await _sb.from('anggota')
      .update({ catatan_guru: d.catatan_guru }).eq('id_anggota', d.id_anggota);
    _check(error, 'updateCatatanMurid');
    return { status: 'ok' };
  },

  // ── KBM ────────────────────────────────────
  bukaKBM: async function(d) {
    // Cek tidak ada draft aktif
    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (draft) return { status: 'error', message: 'Masih ada sesi yang belum ditutup: ' + draft.id_kbm };

    // Hitung pertemuan_ke — masing-masing jenis sesi dihitung secara terpisah
    var countQ = _sb.from('kbm_log').select('*', { count: 'exact', head: true })
      .eq('id_halaqah', d.id_halaqah).eq('status', 'selesai')
      .eq('jenis_sesi', d.jenis_sesi || 'KBM Reguler');
    var { count } = await countQ;

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru  : _uid(), nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      tanggal_pertemuan: d.tanggal_pertemuan,
      jam_mulai: d.jam_mulai, jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      pertemuan_ke: d.pertemuan_ke_custom || ((count || 0) + 1),
      status: 'draft',
      is_pengganti: !!d.is_pengganti,
    }).select().single();
    // Unique partial index uniq_kbm_log_draft_per_guru menolak draft kedua
    // untuk guru yang sama secara atomik di level DB (cegah race condition
    // saat dua tab/perangkat membuka sesi hampir bersamaan)
    if (error && error.code === '23505') {
      return { status: 'error', message: 'Masih ada sesi yang belum ditutup. Silakan tutup sesi sebelumnya terlebih dahulu.' };
    }
    _check(error, 'bukaKBM');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return { status: 'ok', message: 'Sesi KBM berhasil dibuka', data };
  },

  // ── Kelas Pengganti: Flow 1 — tandai sesi hari ini sebagai libur ──
  tandaiLibur: async function(d) {
    var keterangan = (d.keterangan_libur || '').trim();
    if (!keterangan) return { status: 'error', message: 'Alasan libur wajib diisi' };

    // Cek tidak ada draft aktif (harus diselesaikan dulu lewat Flow 5a/5b)
    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (draft) return { status: 'error', message: 'Masih ada sesi yang belum diselesaikan: ' + draft.id_kbm };

    // Cegah duplikat: sesi (halaqah + tanggal + jenis_sesi) sudah dicatat hari ini
    var { data: existing } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_halaqah', d.id_halaqah).eq('tanggal_pertemuan', d.tanggal_pertemuan)
      .eq('jenis_sesi', d.jenis_sesi || 'KBM Reguler').maybeSingle();
    if (existing) return { status: 'error', message: 'Sudah ada catatan KBM untuk halaqah dan tanggal ini' };

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru: _uid(), nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      tanggal_pertemuan: d.tanggal_pertemuan,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      status: 'libur',
      keterangan_libur: keterangan,
      pertemuan_ke: null,
      is_pengganti: false,
    }).select().single();
    _check(error, 'tandaiLibur');
    return { status: 'ok', message: 'Sesi ditandai libur', data };
  },

  // ── Kelas Pengganti: Flow 5b — batalkan draft aktif & tandai libur ──
  batalkanTandaiLibur: async function(d) {
    var keterangan = (d.keterangan_libur || '').trim();
    if (!keterangan) return { status: 'error', message: 'Alasan libur wajib diisi' };

    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (!draft) return { status: 'error', message: 'Tidak ada sesi draft yang aktif' };

    // Bersihkan presensi/nilai parsial yang sudah terlanjur diisi pada draft ini
    await _sb.from('nilai_kbm').delete().eq('id_kbm', draft.id_kbm);

    var { data, error } = await _sb.from('kbm_log').update({
      status: 'libur',
      keterangan_libur: keterangan,
      pertemuan_ke: null,
      is_pengganti: false,
      jumlah_hadir: null,
      jumlah_alpa: null,
    }).eq('id_kbm', draft.id_kbm).select().single();
    _check(error, 'batalkanTandaiLibur');
    return { status: 'ok', message: 'Sesi dibatalkan dan ditandai libur', data };
  },

  simpanPresensi: async function(d) {
    var tanggal = d.tanggal || d.tanggal_pertemuan;
    var rows = d.presensi.map(function(p) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: p.id_murid,
      status_hadir: p.status_hadir,
      pertemuan_ke: d.pertemuan_ke, tanggal: tanggal,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
    }; });
    var { error } = await _sb.from('nilai_kbm')
      .upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanPresensi');
    var hadir = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = d.presensi.filter(function(p) { return ['I','A'].includes(p.status_hadir); }).length;
    // BUG-011 fix: sync tanggal_pertemuan ke kbm_log jika guru mengubah tanggal
    var { error: kbmErr } = await _sb.from('kbm_log').update({
      jumlah_hadir: hadir,
      jumlah_alpa: alpa,
      tanggal_pertemuan: tanggal,  // sinkronkan tanggal agar konsisten
    }).eq('id_kbm', d.id_kbm);
    _check(kbmErr, 'simpanPresensi:kbm_log');
    return { status: 'ok', message: 'Presensi berhasil disimpan', jumlah_hadir: hadir };
  },

  simpanNilaiMurid: async function(d) {
    var { error } = await _sb.from('nilai_kbm').update({
      adab: d.adab, kamera_murid: d.kamera_murid,
      koreksi_tahsin: d.koreksi_tahsin, catatan_murid: d.catatan_murid,
      nilai: d.nilai || null,
    }).eq('id_kbm', d.id_kbm).eq('id_murid', d.id_murid);
    _check(error, 'simpanNilaiMurid');
    return { status: 'ok' };
  },

  simpanNilaiMuridBatch: async function(d) {
    var updates = (d.nilai_list || d.nilai || []).map(function(n) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: n.id_murid,
      adab: n.adab, kamera_murid: n.kamera_murid,
      koreksi_tahsin: n.koreksi_tahsin, catatan_murid: n.catatan_murid,
      nilai: n.nilai || null,
    }; });
    if (!updates.length) return { status: 'ok' };
    var { error } = await _sb.from('nilai_kbm')
      .upsert(updates, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanNilaiMuridBatch');
    return { status: 'ok' };
  },

  simpanJurnalKBM: async function(d) {
    var { error } = await _sb.from('kbm_log').update({
      materi_belajar: d.materi_belajar, pencapaian_modul: d.pencapaian_modul,
      halaman_modul: d.halaman_modul, metode: d.metode, catatan_umum: d.catatan_umum,
      jam_selesai: d.jam_selesai, latihan_mandiri: d.latihan_mandiri,
      jenis_latihan: d.jenis_latihan || null, deadline_latihan: d.deadline_latihan || null,
      referensi_url: d.referensi_url || null,
    }).eq('id_kbm', d.id_kbm);
    _check(error, 'simpanJurnalKBM');
    return { status: 'ok', message: 'Jurnal KBM berhasil disimpan' };
  },

  getLastKbmWithPr: async function(id_halaqah) {
    var { data, error } = await _sb.from('kbm_log')
      .select('tanggal_pertemuan, latihan_mandiri')
      .eq('id_halaqah', id_halaqah)
      .not('latihan_mandiri', 'is', null)
      .neq('latihan_mandiri', '')
      .eq('status', 'selesai')
      .order('tanggal_pertemuan', { ascending: false })
      .limit(1);
    _check(error, 'getLastKbmWithPr');
    return { status: 'ok', data: data ? data[0] : null };
  },

  tutupKBM: async function(id_kbm) {
    var { count } = await _sb.from('nilai_kbm').select('*', { count: 'exact', head: true }).eq('id_kbm', id_kbm);
    if (count === null || count === 0) {
      // Tidak auto-delete — guru harus aktif memilih hapus via hapusKBM()
      return { status: 'error', message: 'Belum ada presensi murid. Isi presensi dulu atau hapus sesi secara manual.' };
    }
    var { data: kbm } = await _sb.from('nilai_kbm').select('status_hadir').eq('id_kbm', id_kbm);
    var hadir = (kbm || []).filter(function(n) { return ['H','T'].includes(n.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = (kbm || []).filter(function(n) { return ['I','A'].includes(n.status_hadir); }).length;
    var { error } = await _sb.from('kbm_log').update({
      status: 'selesai', jumlah_hadir: hadir, jumlah_alpa: alpa,
    }).eq('id_kbm', id_kbm);
    _check(error, 'tutupKBM');
    // Push setelah sesi ditutup (fire-and-forget, tidak blocking)
    (async function() {
      try {
        var { data: kbmData } = await _sb.from('kbm_log')
          .select('id_halaqah, pertemuan_ke, nama_guru, tanggal_pertemuan, materi_belajar, pencapaian_modul')
          .eq('id_kbm', id_kbm).single();
        if (!kbmData) return;

        // 1. Push ke ketua kelas — window observasi terbuka (+ rekap jika jurnal sudah diisi)
        var { data: anggota } = await _sb.from('anggota')
          .select('id_murid, is_ketua').eq('id_halaqah', kbmData.id_halaqah).eq('status','aktif');
        var ketuaIds = (anggota || []).filter(function(a){ return a.is_ketua; }).map(function(a){ return a.id_murid; });
        if (ketuaIds.length) {
          // Jurnal (materi_belajar/pencapaian_modul) baru terisi jika guru mengisi sebelum tutup sesi —
          // guru juga bisa "Tutup tanpa jurnal", jadi rekap hanya disebut kalau datanya sudah ada.
          var jurnalSudahAda = !!(kbmData.materi_belajar || kbmData.pencapaian_modul);
          var bodyMsg = 'Sesi pertemuan ke-' + (kbmData.pertemuan_ke || '') + ' selesai. Window observasi terbuka — isi sebelum guru mulai sesi berikutnya.';
          if (jurnalSudahAda) bodyMsg += ' Jangan lupa kirim Rekap Sesi ke grup WA juga ya.';
          _sendPushBg({
            user_ids: ketuaIds,
            title: '📋 Isi Observasi KBM Sekarang!',
            body : bodyMsg,
            url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
            tag  : 'observasi-window-' + id_kbm,
            data : { trigger: 'observasi_terbuka', id_kbm: id_kbm },
          });
        }

        // 2. Push ke murid yang ALPA — cek push_config.enabled dulu
        var { data: cfg } = await _sb.from('push_config').select('enabled').eq('key','kbm_absen').maybeSingle();
        var kbmAbsenEnabled = cfg ? cfg.enabled === true : true; // null/false → nonaktif; default aktif jika tidak ada row
        if (kbmAbsenEnabled) {
          var { data: alpaMurid } = await _sb.from('nilai_kbm')
            .select('id_murid').eq('id_kbm', id_kbm).eq('status_hadir', 'A');
          var alpaIds = (alpaMurid || []).map(function(r){ return r.id_murid; });
          if (alpaIds.length) {
            var tgl = kbmData.tanggal_pertemuan
              ? new Date(kbmData.tanggal_pertemuan + 'T00:00:00+07:00').toLocaleDateString('id-ID', {timeZone:'Asia/Jakarta', weekday:'long', day:'numeric', month:'long'})
              : 'hari ini';
            _sendPushBg({
              user_ids: alpaIds,
              title   : '🤲 Catatan Kehadiran KBM',
              body    : 'Qadarullah kami mendapati Anda absen di KBM ' + tgl + '. Semoga Anda baik saja dan mohon segera komunikasi kepada Guru Halaqah. Baarakallahu fiikum',
              url     : '/Portal-Halaqah-Rattililquran/murid/index.html',
              tag     : 'kbm-absen-' + id_kbm,
              data    : { trigger: 'kbm_absen', id_kbm: id_kbm },
            });
          }
        }
      } catch(e) {}
    })();
    return { status: 'ok', message: 'Sesi KBM berhasil ditutup. Jazakallah khairan!', data: { id_kbm, jumlah_hadir: hadir } };
  },

  hapusKBM: async function(id_kbm) {
    await _sb.from('nilai_kbm').delete().eq('id_kbm', id_kbm);
    var { error } = await _sb.from('kbm_log').delete().eq('id_kbm', id_kbm);
    _check(error, 'hapusKBM');
    return { status: 'ok', message: 'Sesi KBM berhasil dihapus' };
  },

  editPresensi: async function(d) {
    var rows = d.presensi.map(function(p) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: p.id_murid, status_hadir: p.status_hadir,
    }; });
    var { error } = await _sb.from('nilai_kbm').upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'editPresensi');
    var hadir = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = d.presensi.filter(function(p) { return ['I','A'].includes(p.status_hadir); }).length;
    var upd = { jumlah_hadir: hadir, jumlah_alpa: alpa };
    // Update tanggal & pertemuan_ke di kbm_log jika berubah
    if (d.tanggal_pertemuan) upd.tanggal_pertemuan = d.tanggal_pertemuan;
    if (d.pertemuan_ke)      upd.pertemuan_ke      = d.pertemuan_ke;
    var { error: kbmErr } = await _sb.from('kbm_log').update(upd).eq('id_kbm', d.id_kbm);
    _check(kbmErr, 'editPresensi:kbm_log');
    return { status: 'ok', message: 'Presensi berhasil diperbarui' };
  },

  getKBMByHalaqah: async function(id_halaqah, limit, offset) {
    var { data, error, count } = await _sb.from('kbm_log')
      .select('*', { count: 'exact' }).eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 10) - 1);
    _check(error, 'getKBMByHalaqah');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data, total: count, has_more: (offset||0) + (limit||10) < count };
  },

  getNilaiByKBM: async function(id_kbm) {
    var [nilaiRes, kbmRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*').eq('id_kbm', id_kbm),
      _sb.from('kbm_log').select('jenis_sesi').eq('id_kbm', id_kbm).maybeSingle()
    ]);
    _check(nilaiRes.error, 'getNilaiByKBM');
    var data = nilaiRes.data || [];
    var kbm = kbmRes.data || null;
    var jenisSesi = kbm ? kbm.jenis_sesi : 'KBM Reguler';

    // Ambil nama murid terpisah untuk hindari ambiguitas FK join
    var ids = data.map(function(r) { return r.id_murid; });
    var namaMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap').in('id_user', ids);
      (users || []).forEach(function(u) { namaMap[u.id_user] = u.nama_lengkap; });
    }

    var setoranMap = {};
    var setoranCount = {};
    if (jenisSesi === 'KBM Qiyam') {
      var { data: setoranData } = await _sb.from('setoran_hafalan').select('*').eq('id_kbm', id_kbm);
      (setoranData || []).forEach(function(s) {
        setoranMap[s.id_murid] = s;               // last-wins (dipertahankan untuk kompat pemanggil lama)
        setoranCount[s.id_murid] = (setoranCount[s.id_murid] || 0) + 1;
      });
    }

    return { status: 'ok', data: data.map(function(r) {
      return Object.assign({}, r, {
        nama_murid: namaMap[r.id_murid] || r.id_murid,
        jenis_sesi: jenisSesi,
        hafalan: setoranMap[r.id_murid] || null,
        hafalan_count: setoranCount[r.id_murid] || 0   // >1 → ada >1 setoran/murid di sesi ini (editor menahan diri)
      });
    })};
  },

  getPresensiByKBM: async function(id_kbm) {
    var [nilaiRes, kbmRes] = await Promise.all([
      _sb.from('nilai_kbm').select('id_murid, status_hadir').eq('id_kbm', id_kbm),
      _sb.from('kbm_log').select('id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke').eq('id_kbm', id_kbm).maybeSingle(),
    ]);
    _check(nilaiRes.error, 'getPresensiByKBM');
    var ids = (nilaiRes.data || []).map(function(r) { return r.id_murid; });
    var namaMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap').in('id_user', ids);
      (users || []).forEach(function(u) { namaMap[u.id_user] = u.nama_lengkap; });
    }
    return { status: 'ok', kbm: kbmRes.data || null, data: (nilaiRes.data || []).map(function(r) {
      return { id_murid: r.id_murid, status_hadir: r.status_hadir, nama_murid: namaMap[r.id_murid] || r.id_murid };
    })};
  },

  // Ambil field Jurnal & Latihan Mandiri sebuah sesi untuk fitur Edit KBM.
  // Field-field ini TIDAK memengaruhi kalkulasi raport (deskriptif), jadi aman
  // diedit kapan pun. pr_submitted_count dipakai guard: peringatkan guru bila
  // sudah ada murid yang mengumpulkan PR sebelum ia mengubah teks/jenis latihan.
  getJurnalByKBM: async function(id_kbm) {
    var [kbmRes, prRes] = await Promise.all([
      _sb.from('kbm_log').select('id_kbm, jenis_sesi, materi_belajar, pencapaian_modul, halaman_modul, metode, catatan_umum, jam_selesai, latihan_mandiri, jenis_latihan, deadline_latihan, referensi_url').eq('id_kbm', id_kbm).maybeSingle(),
      _sb.from('nilai_kbm').select('id_nilai', { count: 'exact', head: true }).eq('id_kbm', id_kbm).not('pr_submitted_at', 'is', null),
    ]);
    _check(kbmRes.error, 'getJurnalByKBM');
    var kbm = kbmRes.data || null;
    if (kbm && kbm.jam_selesai) kbm.jam_selesai = String(kbm.jam_selesai).substring(0, 5);
    return { status: 'ok', data: kbm, pr_submitted_count: prRes.count || 0 };
  },

  // Guard raport: raport adalah SNAPSHOT beku di tabel `raport` (bukan live),
  // jadi mengedit presensi/nilai setelah raport digenerate TIDAK otomatis
  // memperbarui raport. Fungsi ini mendeteksi apakah sesi (id_kbm) jatuh dalam
  // periode yang raportnya SUDAH dibuat untuk halaqah tsb — dipakai klien untuk
  // memperingatkan guru agar men-generate ulang. Baca-saja, tak mengubah apa pun.
  cekRaportTerdampak: async function(id_kbm) {
    var { data: kbm } = await _sb.from('kbm_log')
      .select('tanggal_pertemuan, id_halaqah').eq('id_kbm', id_kbm).maybeSingle();
    if (!kbm || !kbm.tanggal_pertemuan || !kbm.id_halaqah) return { status: 'ok', ada: false };
    var tgl = kbm.tanggal_pertemuan;
    // Periode yang rentang tanggalnya memuat tanggal sesi (abaikan periode tanpa rentang)
    var { data: periodes } = await _sb.from('periode')
      .select('id_periode, nama_periode')
      .not('tanggal_mulai', 'is', null).not('tanggal_selesai', 'is', null)
      .lte('tanggal_mulai', tgl).gte('tanggal_selesai', tgl);
    if (!periodes || !periodes.length) return { status: 'ok', ada: false };
    var periodeIds = periodes.map(function(p) { return p.id_periode; });
    // Raport halaqah ini di periode2 tsb (RLS guru_all_raport membatasi ke halaqah miliknya)
    var { data: raports } = await _sb.from('raport')
      .select('id_periode, status').eq('id_halaqah', kbm.id_halaqah).in('id_periode', periodeIds);
    if (!raports || !raports.length) return { status: 'ok', ada: false };
    var published = raports.some(function(r) { return r.status === 'published'; });
    var terdampak = {}; raports.forEach(function(r) { terdampak[r.id_periode] = 1; });
    var nama = periodes.filter(function(p) { return terdampak[p.id_periode]; })
      .map(function(p) { return p.nama_periode; }).join(', ');
    return { status: 'ok', ada: true, published: published, nama_periode: nama, jumlah: raports.length };
  },

  // ── Fase 2: server staging draft nilai KBM (kbm_draft) ──
  // JSON inert; TIDAK menggantikan commit final. Melempar error bila gagal
  // (mis. tabel belum dibuat) → pemanggil di klien menangkap & no-op (fallback
  // ke localStorage). Lihat patch_047_kbm_draft.sql.
  saveKbmDraftServer: async function(d) {
    var { error } = await _sb.from('kbm_draft').upsert({
      id_kbm     : d.id_kbm,
      id_guru    : _uid(),
      jenis_sesi : d.jenis_sesi || null,
      draft      : d.draft || {},
      updated_at : new Date().toISOString(),
    }, { onConflict: 'id_kbm' });
    _check(error, 'saveKbmDraftServer');
    return { status: 'ok' };
  },

  getKbmDraftServer: async function(id_kbm) {
    var { data, error } = await _sb.from('kbm_draft')
      .select('draft, updated_at, jenis_sesi').eq('id_kbm', id_kbm).maybeSingle();
    _check(error, 'getKbmDraftServer');
    return { status: 'ok', data: data || null };
  },

  clearKbmDraftServer: async function(id_kbm) {
    var { error } = await _sb.from('kbm_draft').delete().eq('id_kbm', id_kbm);
    _check(error, 'clearKbmDraftServer');
    return { status: 'ok' };
  },

  getRiwayatMuridKoreksi: async function(id_murid, limit) {
    var { data, error } = await _sb.from('nilai_kbm')
      .select('koreksi_tahsin, tanggal, pertemuan_ke, jenis_sesi')
      .eq('id_murid', id_murid).neq('koreksi_tahsin', '')
      .or('jenis_sesi.neq.Micro Teaching,jenis_sesi.is.null')
      .order('tanggal', { ascending: false }).limit(limit || 10);
    _check(error, 'getRiwayatMuridKoreksi');
    return { status: 'ok', data };
  },

  // ── Pengumuman ─────────────────────────────
  kirimPengumuman: async function(d) {
    var { data, error } = await _sb.from('pengumuman').insert({
      judul: d.judul, isi: d.isi,
      target: d.target || 'semua', id_halaqah: d.id_halaqah || null,
      dibuat_oleh: _uid(), nama_pembuat: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || 'Guru',
      tanggal: _localDate(), status: 'aktif',
    }).select().single();
    _check(error, 'kirimPengumuman');
    // Push: jika target = 'semua' → role_filter null (semua role)
    // jika target = id_halaqah → ambil dulu murid halaqah tersebut
    if (d.target === 'semua') {
      _sendPushBg({
        title: '📢 ' + (d.judul || 'Pengumuman Baru'),
        body : (d.isi || '').slice(0, 100),
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'pengumuman-' + (data && data.id || Date.now()),
        data : { trigger: 'pengumuman' },
      });
    } else if (d.id_halaqah) {
      // Ambil murid halaqah tersebut secara async
      _sb.from('anggota').select('id_murid').eq('id_halaqah', d.id_halaqah).eq('status','aktif')
        .then(function(res) {
          var ids = (res.data || []).map(function(a){ return a.id_murid; });
          if (ids.length) _sendPushBg({
            user_ids: ids,
            title: '📢 ' + (d.judul || 'Pengumuman Baru'),
            body : (d.isi || '').slice(0, 100),
            url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
            tag  : 'pengumuman-' + (data && data.id || Date.now()),
            data : { trigger: 'pengumuman' },
          });
        }).catch(function(){});
    }
    return { status: 'ok', data };
  },

  // ── Template koreksi ───────────────────────
  getTemplateKoreksi: async function() {
    var { data, error } = await _sb.from('template_koreksi')
      .select('kategori, teks, urutan').eq('status', 'aktif').order('urutan');
    _check(error, 'getTemplateKoreksi');
    // Frontend expects: { 'Tajwid': [{teks:...}, ...], 'Makhraj': [...] }
    var grouped = {};
    (data || []).forEach(function(row) {
      if (!grouped[row.kategori]) grouped[row.kategori] = [];
      grouped[row.kategori].push({ teks: row.teks });
    });
    return { status: 'ok', data: grouped };
  },

  // ── Riwayat KBM ───────────────────────────
  getRiwayatKBM: async function(id_halaqah, limit, offset) {
    var q = _sb.from('kbm_log').select('*')
      .eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .limit(limit || 30);
    if (offset) q = q.range(offset, offset + (limit || 30) - 1);
    var { data, error } = await q;
    _check(error, 'getRiwayatKBM');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // ── Keaktifan ──────────────────────────────
  getKeaktifanAlerts: async function() {
    var { data, error } = await _sb.rpc('get_keaktifan_alerts', { p_id_guru: _uid() });
    _check(error, 'getKeaktifanAlerts');
    var raw = data || { alerts: [], summary: { kritis: 0, peringatan: 0, normal: 0 } };
    var alertList = raw.alerts || [];

    // Ambil no_hp dari users
    var hpMap = {};
    if (alertList.length) {
      var ids = alertList.map(function(m){ return m.id_murid; });
      var { data: users } = await _sb.from('users').select('id_user, no_hp').in('id_user', ids);
      (users || []).forEach(function(u){ hpMap[u.id_user] = u.no_hp; });
    }

    // Ambil riwayat 15 sesi terakhir — per murid secara paralel (bukan 1 query global)
    // Ini memastikan setiap murid benar-benar mendapat 15 baris, bukan terpotong limit global
    var riwayatMap = {};
    // Iterasi per pasangan (id_murid, id_halaqah) agar murid multi-halaqah tidak saling timpa
    var alertPairs = alertList.filter(function(m){ return m.status !== 'normal'; });
    var alertIds   = alertPairs.map(function(m){ return m.id_murid; }); // untuk followup query
    if (alertPairs.length) {
      // Batch paralel: ambil 15 sesi per pasangan sekaligus (maksimal 10 paralel)
      var BATCH = 10;
      for (var bi = 0; bi < alertPairs.length; bi += BATCH) {
        var batch = alertPairs.slice(bi, bi + BATCH);
        await Promise.all(batch.map(function(pair) {
          var id_murid   = pair.id_murid;
          var id_halaqah = pair.id_halaqah;
          return _sb.from('nilai_kbm')
            .select('id_murid, id_halaqah, status_hadir, kamera_murid, kbm_log!nilai_kbm_id_kbm_fkey(tanggal_pertemuan, jenis_sesi)')
            .eq('id_murid', id_murid)
            .eq('id_halaqah', id_halaqah)
            .order('id_kbm', { ascending: false })
            .limit(15)
            .then(function(res) {
              (res.data || []).forEach(function(s) {
                if (!s.kbm_log || s.kbm_log.jenis_sesi !== 'KBM Reguler') return;
                var key = s.id_murid + '_' + s.id_halaqah;
                if (!riwayatMap[key]) riwayatMap[key] = [];
                var warna = 'hijau';
                if (s.status_hadir === 'A') warna = 'merah';
                else if (s.status_hadir === 'I') warna = 'abu';
                else if (s.status_hadir === 'T') warna = 'kuning';
                else if (s.kamera_murid && (s.kamera_murid.includes('selalu') || s.kamera_murid.includes('sering'))) warna = 'coklat';
                riwayatMap[key].push({
                  tanggal     : (s.kbm_log && s.kbm_log.tanggal_pertemuan) || '-',
                  status_hadir: s.status_hadir || 'H',
                  kamera_murid: s.kamera_murid || 'kamera terbuka',
                  warna       : warna,
                });
              });
            });
        }));
      }
    }

    // Ambil data dismissal dari anggota untuk SEMUA murid di alerts
    // Key: id_murid + '_' + id_halaqah — satu murid bisa di banyak halaqah
    var followupMap = {};
    if (alertIds.length) {
      var { data: followupRows } = await _sb.from('anggota')
        .select('id_murid, id_halaqah, followup_alpa_kbm, followup_alpa_at, followup_at')
        .in('id_murid', alertIds);
      (followupRows || []).forEach(function(r) { followupMap[r.id_murid + '_' + r.id_halaqah] = r; });
    }

    var alerts = alertList.map(function(m) {
      var metrics = {
        absen           : m.alpa || 0,
        terlambat       : m.terlambat || 0,
        kamera_tertutup : m.kamera_buruk || 0,
      };
      // Compute flags dari metrics — filter yang sudah di-dismiss guru (persisten via DB)
      var dismissed = followupMap[m.id_murid + '_' + m.id_halaqah] || {};
      var kbmBase   = dismissed.followup_alpa_kbm || 0;
      var flags = [];
      if (metrics.absen >= 1 && metrics.absen > kbmBase)
        flags.push({ tipe:'absen',    label:'Absen/Alpa',       detail: metrics.absen + 'x',           count: metrics.absen });
      if (metrics.terlambat >= 2)
        flags.push({ tipe:'terlambat',label:'Sering Terlambat', detail: metrics.terlambat + 'x',       count: metrics.terlambat });
      if (metrics.kamera_tertutup >= 2)
        flags.push({ tipe:'kamera',   label:'Kamera Tertutup',  detail: metrics.kamera_tertutup + 'x', count: metrics.kamera_tertutup });

      var riwayatKey = m.id_murid + '_' + m.id_halaqah;
      return {
        id_murid    : m.id_murid,
        nama_murid  : m.nama,
        no_hp       : hpMap[m.id_murid] || '',
        id_halaqah  : m.id_halaqah,
        nama_halaqah: m.nama_halaqah || '',
        level       : m.level || '',
        status      : m.status,
        metrics     : metrics,
        flags       : flags,
        riwayat     : (riwayatMap[riwayatKey] || []).slice().reverse(), // cronologis, slice() cegah mutasi
      };
    });
    return { status: 'ok', data: { alerts: alerts, summary: raw.summary } };
  },

  simpanFollowupKeaktifan: async function(d) {
    // Ambil baris anggota — filter per halaqah jika diketahui, hindari maybeSingle() crash multi-halaqah
    var q = _sb.from('anggota')
      .select('id_halaqah, catatan_guru, followup_alpa_kbm, followup_alpa_at')
      .eq('id_murid', d.id_murid).eq('status','aktif');
    if (d.id_halaqah) q = q.eq('id_halaqah', d.id_halaqah);
    var { data: rows, error: anggotaErr } = await q;
    _check(anggotaErr, 'simpanFollowupKeaktifan.fetch');
    var anggota = rows && rows[0];
    if (!anggota) return { status: 'ok' };
    var id_halaqah = anggota.id_halaqah;

    // Hitung alpa KBM dan At-Tibyan per halaqah sebagai baseline dismissal
    var [kbmRes, atRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('status_hadir','A'),
    ]);
    var kbmAlpa = kbmRes.count || 0;
    var atAlpa  = atRes.count  || 0;

    // Simpan catatan — batasi 10 entri terakhir agar tidak tumbuh tak terbatas
    var tglStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
    var tambahan = d.catatan ? ' (' + d.catatan + ')' : '';
    var baris  = '[' + tglStr + '] Sudah dihubungi — ' + (d.tipe_alert||'keaktifan') + ' (' + (d.value||0) + 'x)' + tambahan;
    var existing = anggota.catatan_guru ? anggota.catatan_guru.split('\n').filter(Boolean) : [];
    existing.push(baris);
    var catatan = existing.slice(-10).join('\n'); // simpan maksimal 10 entri

    var { error } = await _sb.from('anggota').update({
      catatan_guru     : catatan,
      followup_alpa_kbm: kbmAlpa,
      followup_alpa_at : atAlpa,
      followup_at      : new Date().toISOString(),
    }).eq('id_murid', d.id_murid).eq('id_halaqah', id_halaqah);
    _check(error, 'simpanFollowupKeaktifan');
    return { status: 'ok' };
  },

  // ── Assessment ─────────────────────────────
  getAssessmentRekap: async function(id_halaqah) {
    var { data: anggota } = await _sb.from('anggota').select('id_murid, nama_murid, level').eq('id_halaqah', id_halaqah).eq('status','aktif');
    if (!anggota || !anggota.length) return { status:'ok', data:[], total_items:0, level:'' };
    var level    = anggota[0].level || 'Level 1';
    var muridIds = anggota.map(function(a){ return a.id_murid; });
    var [itemsRes, jawabanRes] = await Promise.all([
      _sb.from('assessment_items').select('id_item, kategori, teks_latin, teks_arab, keterangan, urutan').eq('level', level).eq('status','aktif').order('urutan'),
      _sb.from('assessment_murid').select('id_murid, id_item, status, status_guru, updated_at').in('id_murid', muridIds),
    ]);
    var items      = itemsRes.data  || [];
    var totalItems = items.length;
    var itemSet    = new Set(items.map(function(i){ return i.id_item; }));
    // Group jawaban per murid
    var jawabanMap = {};
    (jawabanRes.data || []).forEach(function(j) {
      if (!jawabanMap[j.id_murid]) jawabanMap[j.id_murid] = { items:{}, last_update: null };
      jawabanMap[j.id_murid].items[j.id_item] = { status: j.status, status_guru: j.status_guru };
      if (!jawabanMap[j.id_murid].last_update || j.updated_at > jawabanMap[j.id_murid].last_update)
        jawabanMap[j.id_murid].last_update = j.updated_at;
    });
    var data = anggota.map(function(m) {
      var mj = jawabanMap[m.id_murid] || { items:{}, last_update: null };
      var paham=0, ragu=0, belum=0, kosong=0;
      var detail = items.map(function(it) {
        var ans = mj.items[it.id_item] || { status: null, status_guru: null };
        var s = ans.status;
        if      (s === 'paham') paham++;
        else if (s === 'ragu' ) ragu++;
        else if (s === 'belum') belum++;
        else kosong++;
        return {
          id_item: it.id_item,
          kategori: it.kategori,
          teks_latin: it.teks_latin,
          teks_arab: it.teks_arab,
          keterangan: it.keterangan,
          urutan: it.urutan,
          jawaban: s,
          jawaban_guru: ans.status_guru
        };
      });
      return { 
        id_murid: m.id_murid, 
        nama_murid: m.nama_murid, 
        level: m.level || level,
        summary: { paham, ragu, belum, kosong }, 
        pct_paham: totalItems > 0 ? Math.round(paham / totalItems * 100) : 0, 
        last_update: mj.last_update,
        detail: detail
      };
    }).sort(function(a,b){ return a.pct_paham - b.pct_paham; });
    return { status:'ok', data, total_items: totalItems, level };
  },

  simpanVerifikasiGuru: async function(d) {
    var id_murid = d.id_murid;
    var id_item  = d.id_item;
    var status_guru = d.status_guru;
    var { error } = await _sb.from('assessment_murid').upsert({
      id_murid: id_murid,
      id_item: id_item,
      status_guru: status_guru,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id_murid,id_item' });
    _check(error, 'simpanVerifikasiGuru');
    return { status: 'ok' };
  },

  // ── At-Tibyan ──────────────────────────────
  getAllMuridAktif: async function() {
    var id_guru = _uid();
    var { data: hq } = await _sb.from('halaqah').select('id_halaqah').eq('id_guru', id_guru).eq('status', 'aktif');
    var hqIds = (hq || []).map(function(h) { return h.id_halaqah; });
    if (!hqIds.length) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid, id_halaqah, level, halaqah(nama_halaqah)')
      .in('id_halaqah', hqIds).eq('status', 'aktif').order('nama_murid');
    _check(error, 'getAllMuridAktif');
    return { status: 'ok', data };
  },

  getAtTibyanMateriForForm: async function() {
    var {data} = await _sb.from('at_tibyan_materi').select('pertemuan_ke, materi_pembahasan, nasihat_aplikatif').order('pertemuan_ke');
    return { status:'ok', data: (data||[]).map(function(r){ return { pertemuan_ke: Number(r.pertemuan_ke), materi_pembahasan: r.materi_pembahasan||'', nasihat_aplikatif: r.nasihat_aplikatif||'' }; }) };
  },

  getAtTibyanSesi: async function() {
    var { data, error } = await _sb.from('at_tibyan_sesi')
      .select('*').eq('id_guru', _uid()).order('tanggal', { ascending: false }).limit(30);
    _check(error, 'getAtTibyanSesi');
    return { status: 'ok', data };
  },

  getAtTibyanDetail: async function(id_sesi) {
    var [sesiRes, logRes] = await Promise.all([
      _sb.from('at_tibyan_sesi').select('*').eq('id_sesi', id_sesi).single(),
      _sb.from('at_tibyan_log').select('*').eq('id_sesi', id_sesi).order('nama_murid'),
    ]);
    return { status: 'ok', data: { sesi: sesiRes.data, presensi: logRes.data || [] } };
  },

  getAtTibyanRekap: async function(id_halaqah) {
    var id_guru = _uid();
    var { data: sesiList } = await _sb.from('at_tibyan_sesi')
      .select('id_sesi').eq('id_guru', id_guru).eq('status', 'selesai');
    var sesiIds = (sesiList || []).map(function(s){ return s.id_sesi; });
    var totalSesi = sesiIds.length;
    if (!sesiIds.length) return { status: 'ok', data: [], total_sesi: 0, summary: { pct_keseluruhan: 0, total_murid: 0, total_hadir: 0, total_izin: 0, total_absen: 0 } };
    var data = await _selectAllPaged('at_tibyan_log',
      'id_log, id_murid, nama_murid, status_hadir, id_halaqah, nama_halaqah',
      function(q){ q = q.in('id_sesi', sesiIds); if (id_halaqah) q = q.eq('id_halaqah', id_halaqah); return q.order('id_log'); },
      'getAtTibyanRekap');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid || '', nama_halaqah: r.nama_halaqah, level: '', hadir: 0, izin: 0, absen: 0, total: 0 };
      var m = muridMap[r.id_murid];
      m.total++;
      // Klasifikasi 3 kelompok eksplisit agar hadir+izin+absen selalu = total (status_hadir: H/T=hadir, I=izin, A=alpa)
      if (['H','T'].includes(r.status_hadir)) m.hadir++;
      else if (r.status_hadir === 'I') m.izin++;
      else if (r.status_hadir === 'A') m.absen++;
    });
    // Ambil nama_lengkap dari users & level dari anggota agar selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var [usersRes, anggotaRes] = await Promise.all([
        _sb.from('users').select('id_user, nama_lengkap').in('id_user', muridIds),
        _sb.from('anggota').select('id_murid, level').in('id_murid', muridIds).eq('status', 'aktif'),
      ]);
      _check(usersRes.error, 'getAtTibyanRekap:users');
      _check(anggotaRes.error, 'getAtTibyanRekap:anggota');
      var users = usersRes.data || [];
      var members = anggotaRes.data || [];
      users.forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
        }
      });
      members.forEach(function(m) {
        if (muridMap[m.id_murid]) {
          muridMap[m.id_murid].level = m.level || '';
        }
      });
    }
    var rows = Object.values(muridMap).map(function(m) {
      return Object.assign(m, { pct_hadir: m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0 });
    }).sort(function(a,b){ return (a.nama_murid||'').localeCompare(b.nama_murid||''); });
    var totalHadir = rows.reduce(function(s,m){ return s+m.hadir; }, 0);
    var totalIzin  = rows.reduce(function(s,m){ return s+m.izin; }, 0);
    var totalAbsen = rows.reduce(function(s,m){ return s+m.absen; }, 0);
    var totalEntries = rows.reduce(function(s,m){ return s+m.total; }, 0);
    return { status: 'ok', data: rows, total_sesi: totalSesi,
      summary: { pct_keseluruhan: totalEntries > 0 ? Math.round(totalHadir/totalEntries*100) : 0, total_murid: rows.length, total_hadir: totalHadir, total_izin: totalIzin, total_absen: totalAbsen } };
  },

  getAtTibyanKeaktifan: async function() {
    var id_guru = _uid();
    var { data: sesiList } = await _sb.from('at_tibyan_sesi')
      .select('id_sesi').eq('id_guru', id_guru).eq('status', 'selesai');
    var sesiIds = (sesiList || []).map(function(s){ return s.id_sesi; });
    var totalSesi = sesiIds.length;
    if (!sesiIds.length) return { status: 'ok', data: { alerts: [], summary: { kritis: 0, peringatan: 0, normal: 0 } } };
    // BUG-015 fix: filter by sesiIds (sesi milik guru ini saja) agar murid cross-guru tidak dihitung ganda
    var data = await _selectAllPaged('at_tibyan_log',
      'id_log, id_murid, nama_murid, id_halaqah, nama_halaqah, status_hadir, tanggal',
      function(q){ return q.in('id_sesi', sesiIds).order('tanggal', { ascending: true }).order('id_log'); },
      'getAtTibyanKeaktifan');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = {
        id_murid: r.id_murid, nama_murid: r.nama_murid, nama_halaqah: r.nama_halaqah,
        level: '', hadir: 0, absen: 0, total: 0, riwayat: []
      };
      var m = muridMap[r.id_murid]; m.total++;
      var hadir = ['H','T'].includes(r.status_hadir);
      if (hadir) m.hadir++; else if (r.status_hadir === 'A') m.absen++;
      // 'I' (Izin) ditandai abu-abu — bukan merah seperti Alpa — agar tidak terlihat sama spt absen
      var warna = hadir ? 'hijau' : (r.status_hadir === 'I' ? 'abu' : 'merah');
      m.riwayat.push({ warna: warna, tanggal: r.tanggal });
    });
    // Ambil nama_lengkap, no_hp dari users, dan level dari anggota agar selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var [usersRes, anggotaRes] = await Promise.all([
        _sb.from('users').select('id_user, nama_lengkap, no_hp').in('id_user', muridIds),
        _sb.from('anggota').select('id_murid, level').in('id_murid', muridIds).eq('status', 'aktif'),
      ]);
      _check(usersRes.error, 'getAtTibyanKeaktifan:users');
      _check(anggotaRes.error, 'getAtTibyanKeaktifan:anggota');
      var users = usersRes.data || [];
      var members = anggotaRes.data || [];
      users.forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
          muridMap[u.id_user].no_hp  = u.no_hp  || '';
        }
      });
      members.forEach(function(m) {
        if (muridMap[m.id_murid]) {
          muridMap[m.id_murid].level  = m.level  || '';
        }
      });
    }
    var summary = { kritis: 0, peringatan: 0, normal: 0 };
    var alerts = Object.values(muridMap).map(function(m) {
      var pct_hadir = m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0;
      var status = m.absen >= 2 ? 'kritis' : m.absen === 1 ? 'peringatan' : 'normal';
      summary[status]++;
      return Object.assign(m, { pct_hadir, total_sesi: totalSesi, status });
    });
    return { status: 'ok', data: { alerts, summary } };
  },

  simpanAtTibyan: async function(d) {
    // BUG-M2 fix: cek duplikat pertemuan_ke sebelum insert
    if (d.pertemuan_ke) {
      var { count: dupCount } = await _sb.from('at_tibyan_sesi')
        .select('*', { count: 'exact', head: true })
        .eq('pertemuan_ke', d.pertemuan_ke);
      if (dupCount > 0) {
        return { status: 'error', message: 'Pertemuan ke-' + d.pertemuan_ke + ' sudah ada. Gunakan fitur Edit untuk mengubahnya.' };
      }
    }
    var id_sesi = _genId('ATS');
    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var { error: errSesi } = await _sb.from('at_tibyan_sesi').insert({
      id_sesi, tanggal: d.tanggal, id_guru: _uid(),
      nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      total_hadir: hadirCount, total_murid: d.presensi.length,
      status: 'selesai', pertemuan_ke: d.pertemuan_ke || 1,
    });
    _check(errSesi, 'simpanAtTibyan:sesi');
    var logRows = d.presensi.map(function(p) { return {
      id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, nama_halaqah: p.nama_halaqah,
      status_hadir: p.status_hadir, tanggal: d.tanggal,
    }; });
    var { error: errLog } = await _sb.from('at_tibyan_log').insert(logRows);
    if (errLog) {
      await _sb.from('at_tibyan_sesi').delete().eq('id_sesi', id_sesi).catch(function(){});
      _check(errLog, 'simpanAtTibyan:log');
    }
    return { status: 'ok', message: 'Sesi At-Tibyan berhasil disimpan' };
  },

  editAtTibyan: async function(d) {
    // Ambil data lama dulu sebagai cadangan rollback
    var { data: sesiData } = await _sb.from('at_tibyan_sesi').select('tanggal, total_hadir').eq('id_sesi', d.id_sesi).single();
    var tanggal = (sesiData && sesiData.tanggal) || d.tanggal || null;
    var oldHadirCount = sesiData && sesiData.total_hadir;
    var { data: oldLogs } = await _sb.from('at_tibyan_log').select('*').eq('id_sesi', d.id_sesi);

    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var logRows = d.presensi.map(function(p) { return {
      id_sesi: d.id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, nama_halaqah: p.nama_halaqah || '',
      status_hadir: p.status_hadir, tanggal: tanggal,
    }; });

    // Cek error delete dulu (sebelum insert): kalau delete gagal diam-diam,
    // insert berikutnya akan menghasilkan baris log dobel.
    var { error: delErr } = await _sb.from('at_tibyan_log').delete().eq('id_sesi', d.id_sesi);
    _check(delErr, 'editAtTibyan:delete');
    await _sb.from('at_tibyan_sesi').update({ total_hadir: hadirCount }).eq('id_sesi', d.id_sesi);

    var { error: insertErr } = await _sb.from('at_tibyan_log').insert(logRows);
    if (insertErr) {
      // Rollback: kembalikan data lama
      if (oldLogs && oldLogs.length) {
        var rollbackRows = oldLogs.map(function(r) {
          var copy = Object.assign({}, r);
          delete copy.id_log; delete copy.created_at; // BUG-K1 fix: PK kolom adalah id_log, bukan id
          return copy;
        });
        await _sb.from('at_tibyan_log').insert(rollbackRows).catch(function(){});
      }
      if (oldHadirCount !== undefined) {
        await _sb.from('at_tibyan_sesi').update({ total_hadir: oldHadirCount }).eq('id_sesi', d.id_sesi).catch(function(){});
      }
      _check(insertErr, 'editAtTibyan.insert');
    }
    return { status: 'ok' };
  },

  // ── Raport ─────────────────────────────────
  getAllPeriode: async function() {
    var { data, error } = await _sb.from('periode').select('*').order('created_at', { ascending: false });
    _check(error, 'getAllPeriode');
    return { status: 'ok', data };
  },

  getKomponenRaport: async function(id_periode) {
    var { data, error } = await _sb.from('komponen_raport')
      .select('*').eq('id_periode', id_periode).eq('status', 'aktif').order('urutan');
    _check(error, 'getKomponenRaport');
    return { status: 'ok', data };
  },

  getNilaiManual: async function(id_periode) {
    var { data, error } = await _sb.from('nilai_manual').select('*').eq('id_periode', id_periode);
    _check(error, 'getNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManual: async function(d) {
    var { data, error } = await _sb.from('nilai_manual')
      .upsert(d, { onConflict: 'id_murid,id_periode,id_komponen' }).select().single();
    _check(error, 'saveNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManualBatch: async function(d) {
    var rows = (d.nilai_list || []).map(function(n) { return Object.assign({}, n, {
      id_periode: d.id_periode, id_halaqah: d.id_halaqah,
    }); });
    var { error } = await _sb.from('nilai_manual')
      .upsert(rows, { onConflict: 'id_murid,id_periode,id_komponen' });
    _check(error, 'saveNilaiManualBatch');
    return { status: 'ok', message: rows.length + ' nilai disimpan' };
  },

  getRaportListGuru: async function(id_halaqah, id_periode) {
    var { data, error } = await _sb.from('raport')
      .select('*, users!raport_id_murid_fkey(nama_lengkap, email)')
      .eq('id_halaqah', id_halaqah).eq('id_periode', id_periode)
      .order('created_at', { ascending: false });
    _check(error, 'getRaportListGuru');
    return { status: 'ok', data: (data || []).map(function(r) { return Object.assign({}, r, {
      nama_murid: r.users && r.users.nama_lengkap,
      email     : r.users && r.users.email,
      detail    : r.detail_json ? (typeof r.detail_json === 'string' ? (function(){try{return JSON.parse(r.detail_json);}catch(e){return [];}})() : r.detail_json) : [],
    }); }) };
  },

  generateRaportHalaqah: async function(d) {
    // Kalkulasi raport semua murid di halaqah
    var { data: anggota, error: errAnggota } = await _sb.from('anggota').select('id_murid, nama_murid, level').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    _check(errAnggota, 'generateRaportHalaqah:anggota');
    if (!anggota || !anggota.length) return { status: 'error', message: 'Tidak ada murid aktif di halaqah ini.' };
    var ids = (anggota || []).map(function(a) { return a.id_murid; });
    var { data: komponen, error: errKomp } = await _sb.from('komponen_raport').select('*').eq('id_periode', d.id_periode).eq('status', 'aktif').order('urutan');
    _check(errKomp, 'generateRaportHalaqah:komponen');
    var hasNonDaurah = (anggota || []).some(function(a) { return a.level !== 'Tahsin Al-Fatihah'; });
    if (hasNonDaurah && (!komponen || !komponen.length)) {
      return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini.' };
    }

    // BUG-021 fix: baca threshold grade dari DB, bukan hardcode
    var { data: cfgRows } = await _sb.from('konfigurasi_raport').select('key, value');
    var cfgMap = {}; (cfgRows || []).forEach(function(r) { cfgMap[r.key] = r.value; });
    var gradeConfig = {
      mumtaz      : parseInt(cfgMap['grade_mumtaz']         || '90'),
      jayyidJiddan: parseInt(cfgMap['grade_jayyid_jiddan']  || '80'),
      jayyid      : parseInt(cfgMap['grade_jayyid']         || '70'),
      bonusPerfect: parseInt(cfgMap['bonus_perfect_attendance'] || '5'),
    };

    var hasDaurah = (anggota || []).some(function(a) { return a.level === 'Tahsin Al-Fatihah'; });
    var asmtItems = [], asmtMurid = [];

    var [nilaiManualRes, nilaiKBMRes, atLogRes, atSesiRes, catatanRes, periodeRes, asmtItemsRes, asmtMuridRes] = await Promise.all([
      _sb.from('nilai_manual').select('*').eq('id_periode', d.id_periode),
      _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').eq('id_halaqah', d.id_halaqah),
      _sb.from('at_tibyan_log').select('id_murid, status_hadir').eq('id_halaqah', d.id_halaqah).in('id_murid', ids),
      _sb.from('at_tibyan_sesi').select('*', { count: 'exact', head: true }).eq('id_guru', d.id_guru || _uid()).eq('status', 'selesai'),
      _sb.from('catatan_raport').select('catatan').eq('id_halaqah', d.id_halaqah).maybeSingle(),
      _sb.from('periode').select('tanggal_mulai, tanggal_selesai').eq('id_periode', d.id_periode).maybeSingle(),
      hasDaurah ? _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').eq('status', 'aktif').order('urutan') : Promise.resolve({ data: [] }),
      hasDaurah ? _sb.from('assessment_murid').select('*').in('id_murid', ids) : Promise.resolve({ data: [] }),
    ]);
    var nilaiManual = nilaiManualRes.data;
    var nilaiKBM    = nilaiKBMRes.data;
    var atLog       = atLogRes.data;
    var totalAt     = atSesiRes.count || 0;
    var catatan     = catatanRes.data;
    asmtItems       = asmtItemsRes.data || [];
    asmtMurid       = asmtMuridRes.data || [];

    // Rentang periode untuk membatasi KBM yang dihitung (defensif: hanya bila
    // kedua tanggal terisi; periode lama tanpa tanggal → perilaku lama, tak difilter).
    var pr = periodeRes.data || {};
    var periodeRange = (pr.tanggal_mulai && pr.tanggal_selesai)
      ? { mulai: pr.tanggal_mulai, selesai: pr.tanggal_selesai } : null;

    var berhasil = [], gagal = [];
    for (var i = 0; i < (anggota || []).length; i++) {
      var m = anggota[i];
      try {
        var raportData = _kalkulasiRaport(m.id_murid, d.id_periode, d.id_halaqah,
          komponen, nilaiManual, nilaiKBM, atLog, totalAt, gradeConfig, m.level, periodeRange, asmtItems, asmtMurid);
        var detailJson = raportData.komponen;
        var { error: upErr } = await _sb.from('raport')
          .upsert({
            id_murid: m.id_murid, id_periode: d.id_periode, id_halaqah: d.id_halaqah,
            nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat,
            detail_json: detailJson, tanggal_cetak: _localDate(),
            status: 'draft',
          }, { onConflict: 'id_murid,id_periode' });
        if (upErr) throw new Error(upErr.message);
        berhasil.push(Object.assign({ nama_murid: m.nama_murid, catatan_guru: catatan && catatan.catatan }, raportData));
      } catch(e) { gagal.push({ id_murid: m.id_murid, nama: m.nama_murid, alasan: e.message }); }
    }
    return { status: 'ok', message: berhasil.length + ' raport digenerate', data: { berhasil, gagal } };
  },

  publishAllRaportHalaqah: async function(d) {
    var { data: anggota } = await _sb.from('anggota').select('id_murid').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    var ids = (anggota || []).map(function(a) { return a.id_murid; });
    var { error } = await _sb.from('raport').update({ status: 'published', published_by: _uid(), published_at: new Date().toISOString() })
      .in('id_murid', ids).eq('id_periode', d.id_periode).eq('status', 'draft');
    _check(error, 'publishAllRaportHalaqah');
    // Auto-buat pengumuman
    await _sb.from('pengumuman').insert({
      judul: '[Raport] Raport sudah tersedia',
      isi: 'Assalamualaikum, raport halaqah Anda sudah dipublikasikan. Silakan cek di menu Raport.',
      target: d.id_halaqah, id_halaqah: d.id_halaqah,
      dibuat_oleh: _uid(), nama_pembuat: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || 'Admin',
      tanggal: _localDate(), status: 'aktif',
    });
    // Push ke murid halaqah ini
    if (ids.length) {
      _sendPushBg({
        user_ids: ids,
        title : '📄 Raport Kamu Sudah Tersedia!',
        body  : 'Raport semester ini sudah dipublish. Ketuk untuk melihat nilai dan predikatmu.',
        url   : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag   : 'raport-published-' + d.id_halaqah,
        data  : { trigger: 'raport_published', id_halaqah: d.id_halaqah },
      });
    }
    return { status: 'ok', message: 'Raport berhasil dipublish' };
  },

  getCatatanHalaqah: async function(id_halaqah) {
    var { data } = await _sb.from('catatan_raport').select('catatan').eq('id_halaqah', id_halaqah).maybeSingle();
    return { status: 'ok', data: { catatan: data && data.catatan || '' } };
  },

  saveCatatanHalaqah: async function(d) {
    var { error } = await _sb.from('catatan_raport')
      .upsert({ id_halaqah: d.id_halaqah, catatan: d.catatan }, { onConflict: 'id_halaqah' });
    _check(error, 'saveCatatanHalaqah');
    return { status: 'ok', message: 'Catatan disimpan' };
  },

  getRincianRaport: async function(id_raport) {
    var { data: raport } = await _sb.from('raport').select('*').eq('id_raport', id_raport).single();
    if (!raport) return { status: 'error', message: 'Raport tidak ditemukan' };
    // BUG-K3 fix: pakai maybeSingle() agar tidak crash jika data relasi sudah terhapus (ON DELETE SET NULL)
    var { data: murid }   = raport.id_murid   ? await _sb.from('users').select('nama_lengkap, email').eq('id_user', raport.id_murid).maybeSingle()   : { data: null };
    var { data: halaqah } = raport.id_halaqah ? await _sb.from('halaqah').select('nama_halaqah, nama_guru').eq('id_halaqah', raport.id_halaqah).maybeSingle() : { data: null };
    var { data: periode } = raport.id_periode ? await _sb.from('periode').select('nama_periode').eq('id_periode', raport.id_periode).maybeSingle() : { data: null };
    var { data: nilaiKBM } = await _sb.from('nilai_kbm')
      .select('*, kbm_log!nilai_kbm_id_kbm_fkey(materi_belajar, jenis_sesi, tanggal_pertemuan, pertemuan_ke)')
      .eq('id_murid', raport.id_murid).eq('id_halaqah', raport.id_halaqah);
    var { data: nilaiManual } = await _sb.from('nilai_manual').select('*').eq('id_murid', raport.id_murid).eq('id_periode', raport.id_periode);
    var { data: catatan } = await _sb.from('catatan_raport').select('catatan').eq('id_halaqah', raport.id_halaqah).maybeSingle();
    var komponen = raport.detail_json ? (typeof raport.detail_json === 'string' ? (function(){try{return JSON.parse(raport.detail_json);}catch(e){return [];}})() : raport.detail_json) : [];

    // Urutkan berdasarkan jenis_sesi (Reguler -> Qiyam -> Micro Teaching) kemudian tanggal
    var sortedKBM = (nilaiKBM || []).sort(function(a, b) {
      var catOrder = { 'KBM Reguler': 1, 'KBM Qiyam': 2, 'Micro Teaching': 3 };
      var jenisA = a.jenis_sesi || (a.kbm_log && a.kbm_log.jenis_sesi) || 'KBM Reguler';
      var jenisB = b.jenis_sesi || (b.kbm_log && b.kbm_log.jenis_sesi) || 'KBM Reguler';
      var catA = catOrder[jenisA] || 99;
      var catB = catOrder[jenisB] || 99;
      if (catA !== catB) return catA - catB;
      var tA = a.tanggal || (a.kbm_log && a.kbm_log.tanggal_pertemuan) || '';
      var tB = b.tanggal || (b.kbm_log && b.kbm_log.tanggal_pertemuan) || '';
      return tA.localeCompare(tB);
    });

    // Calculate attendance summary statistics using all sessions (consistent with Kehadiran grade component)
    var hadirList = (sortedKBM || []).filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
    var totalSesi = (sortedKBM || []).length;
    return { status: 'ok', data: {
      raport: {
        id_raport: raport.id_raport, id_murid: raport.id_murid,
        nama_murid: murid && murid.nama_lengkap, email: murid && murid.email,
        halaqah: halaqah && halaqah.nama_halaqah, guru: halaqah && halaqah.nama_guru,
        periode: periode && periode.nama_periode, level: '',
        nilai_akhir: raport.nilai_akhir, predikat: raport.predikat,
        tanggal_cetak: raport.tanggal_cetak, status: raport.status,
        url_pdf: raport.url_pdf || '', komponen, catatan_guru: catatan && catatan.catatan || '',
      },
      sesi: (sortedKBM || []).map(function(n, i) { return {
        no: i+1,
        pertemuan_ke: n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
        tanggal: n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
        status_hadir: n.status_hadir, adab: n.adab, kamera: n.kamera_murid,
        koreksi: n.koreksi_tahsin, catatan_murid: n.catatan_murid,
        materi: (n.kbm_log && n.kbm_log.materi_belajar) || '-',
        jenis_sesi: n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler',
      }; }),
      summary: {
        total_sesi: totalSesi, total_hadir: hadirList.length,
        total_alpa: (sortedKBM || []).filter(function(n){return String(n.status_hadir||'').toUpperCase()==='A';}).length,
        total_izin: (sortedKBM || []).filter(function(n){return String(n.status_hadir||'').toUpperCase()==='I';}).length,
        total_terlambat: (sortedKBM || []).filter(function(n){return String(n.status_hadir||'').toUpperCase()==='T';}).length,
        pct_hadir: totalSesi > 0 ? Math.round((hadirList.length/totalSesi)*100) : 0,
      },
      nilai_manual: (nilaiManual || []),
    }};
  },

  generateRaportPDF: async function(id_raport) {
    // PDF generation via GAS masih dipertahankan sementara
    return { status: 'error', message: 'PDF generation belum tersedia. Gunakan fitur print browser.' };
  },

  // ── Password ───────────────────────────────
  changePassword: async function(d) { return Auth.changePassword(d); },

  // ── Rekap ──────────────────────────────────
  generateRekapPresensi: async function(id_halaqah) {
    return { status: 'ok', message: 'Rekap Presensi: fitur in progress' };
  },
  generateRekapNilai: async function(id_halaqah) {
    return { status: 'ok', message: 'Rekap Nilai: fitur in progress' };
  },

  // ── Tahfidz / Setoran Hafalan (Level Qiyam) ──────────────────────────
  // Ambil halaqah Level Qiyam milik guru yang sedang login
  getQiyamHalaqah: async function() {
    var { data, error } = await _sb.from('halaqah')
      .select('id_halaqah, nama_halaqah, level, jadwal_hari, jam_mulai, jam_selesai')
      .eq('id_guru', _uid())
      .eq('level', 'Level Qiyam')
      .eq('status', 'aktif')
      .order('nama_halaqah');
    _check(error, 'getQiyamHalaqah');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // Ambil daftar murid aktif di halaqah Qiyam tertentu (untuk dropdown form input)
  getMuridQiyam: async function(id_halaqah) {
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif')
      .order('nama_murid');
    _check(error, 'getMuridQiyam');
    return { status: 'ok', data: data || [] };
  },

  // Ambil riwayat setoran di halaqah Qiyam (bisa filter per murid)
  getSetoranHafalanGuru: async function(id_halaqah, id_murid, limit, offset) {
    var q = _sb.from('setoran_hafalan')
      .select('*', { count: 'exact' })
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: false });
    if (id_murid) q = q.eq('id_murid', id_murid);
    var lim = limit || 20;
    q = q.range(offset || 0, (offset || 0) + lim - 1);
    var { data, error, count } = await q;
    _check(error, 'getSetoranHafalanGuru');
    return { status: 'ok', data: data || [], total: count || 0, has_more: (offset || 0) + lim < (count || 0) };
  },

  // Input setoran hafalan baru
  addSetoranHafalan: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_murid           : d.id_murid,
      nama_murid         : d.nama_murid || '',
      id_halaqah         : d.id_halaqah,
      id_kbm             : d.id_kbm    || null,
      id_guru            : _uid(),
      nama_guru          : (user && (user.nama_lengkap || user.nama)) || '',
      juz                : d.juz ? parseInt(d.juz) : null,
      surat              : d.surat,
      ayat_dari          : parseInt(d.ayat_dari),
      ayat_sampai        : parseInt(d.ayat_sampai),
      jenis              : d.jenis || 'Ziyadah',
      nilai              : d.nilai,
      kelancaran         : d.kelancaran || null,
      kamera             : d.kamera    || null,
      catatan            : d.catatan   || null,
      target_surat       : d.target_surat       || null,
      target_ayat_dari   : d.target_ayat_dari   ? parseInt(d.target_ayat_dari)   : null,
      target_ayat_sampai : d.target_ayat_sampai ? parseInt(d.target_ayat_sampai) : null,
    };
    // Jika guru mengisi tanggal manual, gunakan sebagai created_at
    if (d.tanggal) {
      payload.created_at = new Date(d.tanggal + 'T12:00:00').toISOString();
    }
    var { data, error } = await _sb.from('setoran_hafalan').insert(payload).select().single();
    _check(error, 'addSetoranHafalan');

    // Auto-sync kamera to nilai_kbm for Qiyam sessions
    if (d.id_kbm && d.id_murid) {
      var { error: syncErr } = await _sb.from('nilai_kbm')
        .update({ kamera_murid: d.kamera || 'kamera terbuka' })
        .eq('id_kbm', d.id_kbm)
        .eq('id_murid', d.id_murid);
      if (syncErr) {
        console.warn('Gagal sync kamera ke nilai_kbm:', syncErr.message);
      }
    }
    return { status: 'ok', data };
  },

  // Ambil data Ziyadah murid tertentu (untuk validasi range Murajaah)
  // includePartnerConfirmed: jika true, ikut sertakan setoran mandiri (sumber='partner')
  // yang sudah dikonfirmasi partner — dipakai validasi Murajaah mandiri murid (§3.8).
  // Default false: hanya sumber='guru' (perilaku lama, dipakai form guru).
  getZiyadahMurid: async function(id_halaqah, id_murid, includePartnerConfirmed) {
    var q = _sb.from('setoran_hafalan')
      .select('surat, juz, ayat_dari, ayat_sampai')
      .eq('id_halaqah', id_halaqah)
      .eq('id_murid', id_murid)
      .eq('jenis', 'Ziyadah');
    q = includePartnerConfirmed
      ? q.or('sumber.eq.guru,and(sumber.eq.partner,status_konfirmasi.eq.dikonfirmasi)')
      : q.eq('sumber', 'guru');
    var { data, error } = await q;
    _check(error, 'getZiyadahMurid');
    return { status: 'ok', data: data || [] };
  },

  // Hapus setoran (hanya yang dibuat guru sendiri)
  deleteSetoranHafalan: async function(id_setoran) {
    var { error } = await _sb.from('setoran_hafalan')
      .delete()
      .eq('id_setoran', id_setoran)
      .eq('id_guru', _uid());
    _check(error, 'deleteSetoranHafalan');
    return { status: 'ok' };
  },

  // Edit setoran (Paket 3c: Edit Nilai KBM Qiyam). Hanya field penilaian yang
  // diubah (nilai/kelancaran/kamera/catatan/jenis) — surat/ayat/juz/target tidak
  // disentuh. Guard id_guru = pemilik (selaras RLS guru_update_own_setoran).
  // `nilai` NOT NULL → pemanggil wajib mengirimnya. Efek samping kamera→nilai_kbm
  // direplikasi dari addSetoranHafalan agar konsisten.
  updateSetoranHafalan: async function(d) {
    var fields = {
      nilai      : d.nilai,
      kelancaran : d.kelancaran || null,
      kamera     : d.kamera     || null,
      catatan    : d.catatan    || null,
      updated_at : new Date().toISOString(),
    };
    if (d.jenis) fields.jenis = d.jenis;
    var { error } = await _sb.from('setoran_hafalan')
      .update(fields)
      .eq('id_setoran', d.id_setoran)
      .eq('id_guru', _uid());
    _check(error, 'updateSetoranHafalan');
    // Sync kamera ke nilai_kbm untuk sesi Qiyam (kamera_murid inilah yang dibaca
    // raport). Sinkronkan nilai APA ADANYA — termasuk saat dikosongkan (null) —
    // agar setoran_hafalan.kamera & nilai_kbm.kamera_murid tak desync. Hanya
    // dijalankan bila pemanggil memang menyertakan field kamera (key ada),
    // sehingga pemanggil yang tak menyentuh kamera tak ikut ternol.
    if (d.id_kbm && d.id_murid && d.kamera !== undefined) {
      var { error: syncErr } = await _sb.from('nilai_kbm')
        .update({ kamera_murid: d.kamera || null })
        .eq('id_kbm', d.id_kbm)
        .eq('id_murid', d.id_murid);
      if (syncErr) console.warn('Gagal sync kamera ke nilai_kbm:', syncErr.message);
    }
    return { status: 'ok' };
  },

  // ── Raport Tahfidz ─────────────────────────────────────────────────────
  // Ambil semua setoran hafalan dalam rentang tanggal (untuk raport)
  getRaportTahfidzData: async function(id_halaqah, id_murid, tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_halaqah', id_halaqah)
      .eq('sumber', 'guru') // §3.7: raport resmi hanya hitung setoran guru
      .order('created_at', { ascending: true })
      .limit(500); // BUG-14 fix: cegah timeout untuk dataset besar
    if (id_murid)    q = q.eq('id_murid', id_murid);
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getRaportTahfidzData');
    return { status: 'ok', data: data || [] };
  },

  // Konfigurasi penilaian hafalan (Kelancaran + Nilai Makhraj & Tajwid)
  getPenilaianHafalan: async function() {
    var { data, error } = await _sb.from('konfigurasi_penilaian_hafalan')
      .select('kelancaran, nilai')
      .eq('id', 'global')
      .maybeSingle();
    if (error) { console.warn('getPenilaianHafalan:', error.message); return { status: 'ok', data: null }; }
    return { status: 'ok', data: data || null };
  },

  savePenilaianHafalan: async function(config) {
    var { error } = await _sb.from('konfigurasi_penilaian_hafalan')
      .upsert({
        id         : 'global',
        kelancaran : config.kelancaran,
        nilai      : config.nilai,
        updated_by : _uid(),
      }, { onConflict: 'id' });
    _check(error, 'savePenilaianHafalan');
    return { status: 'ok' };
  },

  // Target terbaru per murid di halaqah Qiyam (untuk kartu pengingat guru)
  getTargetHafalanMurid: async function(id_halaqah, id_murids) {
    var q = _sb.from('setoran_hafalan')
      .select('id_murid, nama_murid, target_surat, target_ayat_dari, target_ayat_sampai, created_at, updated_at')
      .not('target_surat', 'is', null)
      .order('created_at', { ascending: false })
      .order('updated_at', { ascending: false });
    if (id_murids && id_murids.length) {
      q = q.in('id_murid', id_murids);
    } else {
      q = q.eq('id_halaqah', id_halaqah);
    }
    var { data, error } = await q;
    _check(error, 'getTargetHafalanMurid');
    // Deduplicate — ambil target terbaru per murid
    var seen = new Set();
    var result = (data || []).filter(function(r) {
      if (seen.has(r.id_murid)) return false;
      seen.add(r.id_murid);
      return true;
    });
    return { status: 'ok', data: result };
  },

  // ── Kelompok Partner Qiyam ───────────────────────────────────────────
  // Daftar kelompok + anggota di sebuah halaqah Qiyam
  getKelompokPartnerHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('kelompok_partner_qiyam')
      .select('*, anggota_kelompok_partner(*)')
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: true });
    _check(error, 'getKelompokPartnerHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Pantau denyut tiap anggota kelompok partner di sebuah halaqah Qiyam
  // (tanggal setoran mandiri terakhir, jumlah menunggu/dikonfirmasi, no_hp)
  getPantauKelompokPartner: async function(id_halaqah) {
    var { data, error } = await _sb.rpc('get_pantau_kelompok_partner', { p_id_halaqah: id_halaqah });
    _check(error, 'getPantauKelompokPartner');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok (Fase 3) untuk guru/admin (per kelompok) ──
  getLiniMasaSetoranKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.rpc('get_lini_masa_setoran', { p_id_kelompok: id_kelompok });
    _check(error, 'getLiniMasaSetoranKelompok');
    return { status: 'ok', data: data || [] };
  },
  getMilestoneByKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.from('milestone_kelompok_partner')
      .select('*').eq('id_kelompok', id_kelompok)
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMilestoneByKelompok');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('milestone_kelompok_partner').insert(payload).select().single();
    _check(error, 'addMilestoneKelompok');
    return { status: 'ok', data: data };
  },
  deleteMilestoneKelompok: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_partner').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneKelompok');
    return { status: 'ok' };
  },

  // #3 Konfirmasi setoran partner oleh guru/admin (jalan keluar bila partner berhalangan)
  guruKonfirmasiSetoran: async function(id_setoran, kelancaran, catatan) {
    var logData = null;
    try {
      var { data } = await _sb.from('setoran_hafalan')
        .select('id_murid, jenis, surat, ayat_dari, ayat_sampai')
        .eq('id_setoran', id_setoran)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('guru_konfirmasi_setoran_partner', {
      p_id_setoran: id_setoran, p_kelancaran: kelancaran, p_catatan: catatan || null,
    });
    _check(error, 'guruKonfirmasiSetoran');

    if (logData && logData.id_murid) {
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Setoran Dikonfirmasi (Guru)',
        body    : 'Setoran "' + logData.jenis + ' ' + logData.surat + ' Ayat ' + logData.ayat_dari + '-' + logData.ayat_sampai + '" kamu telah dikonfirmasi oleh Guru Halaqah!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
        tag     : 'partner-qiyam-konf-' + id_setoran,
        data    : { trigger: 'partner_qiyam_konf', id_setoran: id_setoran }
      });
    }

    return { status: 'ok' };
  },
  // Daftar setoran partner yang masih menunggu di sebuah halaqah (untuk guru konfirmasi)
  getSetoranPartnerMenungguHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('id_setoran, id_murid, nama_murid, jenis, surat, juz, ayat_dari, ayat_sampai, catatan, created_at, lampiran_url, audio_durasi_detik')
      .eq('id_halaqah', id_halaqah).eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu')
      .order('created_at', { ascending: true });
    _check(error, 'getSetoranPartnerMenungguHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // #4 Target bersama kelompok (guru/admin)
  getTargetByKelompok: async function(id_kelompok) {
    var res = await _sb.from('target_kelompok_partner')
      .select('*, target_partner_progress(id_murid, nama_murid)')
      .eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_partner')
        .select('*').eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
      _check(fb.error, 'getTargetByKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  addTargetByKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('target_kelompok_partner').insert(payload).select().single();
    _check(error, 'addTargetByKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetByKelompok: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_partner').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetByKelompok');
    return { status: 'ok' };
  },
  deleteTargetByKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_partner').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetByKelompok');
    return { status: 'ok' };
  },

  // Buat kelompok baru. anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok kosong jika
  // insert anggota gagal (validasi roster/aktif atau koneksi putus)
  createKelompokPartner: async function(id_halaqah, nama_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { data: id_kelompok, error } = await _sb.rpc('create_kelompok_partner', {
      p_id_halaqah: id_halaqah, p_nama_kelompok: nama_kelompok || null, p_anggota: rows
    });
    _check(error, 'createKelompokPartner');
    return { status: 'ok', data: { id_kelompok: id_kelompok } };
  },

  // Ubah nama/status kelompok
  updateKelompokPartner: async function(id_kelompok, updates) {
    var payload = { updated_at: new Date().toISOString() };
    if (updates.nama_kelompok !== undefined) payload.nama_kelompok = updates.nama_kelompok;
    if (updates.status !== undefined)        payload.status = updates.status;
    var { error } = await _sb.from('kelompok_partner_qiyam').update(payload).eq('id_kelompok', id_kelompok);
    _check(error, 'updateKelompokPartner');
    return { status: 'ok' };
  },

  // Ganti seluruh anggota kelompok (replace). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok tanpa
  // anggota jika insert pengganti gagal (validasi roster/aktif atau koneksi putus)
  setAnggotaKelompok: async function(id_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { error } = await _sb.rpc('set_anggota_kelompok_partner', {
      p_id_kelompok: id_kelompok, p_anggota: rows
    });
    _check(error, 'setAnggotaKelompok');
    return { status: 'ok' };
  },

  // Hapus kelompok (anggota ikut terhapus via on delete cascade)
  deleteKelompokPartner: async function(id_kelompok) {
    var { error } = await _sb.from('kelompok_partner_qiyam').delete().eq('id_kelompok', id_kelompok);
    _check(error, 'deleteKelompokPartner');
    return { status: 'ok' };
  },

  // ── Kelompok Partner Belajar (Level 1-4, non-Qiyam) ──────────────────
  // Daftar nama_level dengan Partner Belajar aktif (untuk filter selector)
  getLevelBelajarEnabled: async function() {
    var data = await _belajarLevelNames();
    return { status: 'ok', data: data };
  },

  // Halaqah guru dengan level partner_belajar_enabled=true
  getBelajarHalaqah: async function() {
    var namaLevels = await _belajarLevelNames();
    if (!namaLevels.length) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('halaqah')
      .select('id_halaqah, nama_halaqah, level, jadwal_hari, jam_mulai, jam_selesai')
      .eq('id_guru', _uid())
      .in('level', namaLevels)
      .eq('status', 'aktif')
      .order('nama_halaqah');
    _check(error, 'getBelajarHalaqah');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // Murid aktif di halaqah Partner Belajar tertentu (untuk form kelompok)
  getMuridBelajar: async function(id_halaqah) {
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif')
      .order('nama_murid');
    _check(error, 'getMuridBelajar');
    return { status: 'ok', data: data || [] };
  },

  getKelompokBelajarHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('kelompok_partner_belajar')
      .select('*, anggota_kelompok_belajar(*)')
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: true });
    _check(error, 'getKelompokBelajarHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Pantau denyut tiap anggota kelompok belajar di sebuah halaqah
  // (tanggal aktivitas terakhir, jumlah menunggu/dikonfirmasi, no_hp)
  getPantauKelompokBelajar: async function(id_halaqah) {
    var { data, error } = await _sb.rpc('get_pantau_kelompok_belajar', { p_id_halaqah: id_halaqah });
    _check(error, 'getPantauKelompokBelajar');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok untuk guru/admin (per kelompok) ──
  getLiniMasaBelajarKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.rpc('get_lini_masa_belajar', { p_id_kelompok: id_kelompok });
    _check(error, 'getLiniMasaBelajarKelompok');
    return { status: 'ok', data: data || [] };
  },
  getMilestoneBelajarByKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.from('milestone_kelompok_belajar')
      .select('*').eq('id_kelompok', id_kelompok)
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMilestoneBelajarByKelompok');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneBelajarKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('milestone_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addMilestoneBelajarKelompok');
    return { status: 'ok', data: data };
  },
  deleteMilestoneBelajarKelompok: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_belajar').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneBelajarKelompok');
    return { status: 'ok' };
  },

  // Konfirmasi aktivitas belajar oleh guru/admin (jalan keluar bila partner berhalangan)
  guruKonfirmasiLogBelajar: async function(id_log, kelancaran, catatan) {
    var logData = null;
    try {
      var { data } = await _sb.from('log_belajar_mandiri')
        .select('id_murid, jenis_aktivitas')
        .eq('id_log', id_log)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('guru_konfirmasi_log_belajar', {
      p_id_log: id_log, p_kelancaran: kelancaran, p_catatan: catatan || null,
    });
    _check(error, 'guruKonfirmasiLogBelajar');

    if (logData && logData.id_murid) {
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Laporan Dikonfirmasi (Guru)',
        body    : 'Aktivitas "' + logData.jenis_aktivitas + '" kamu telah dikonfirmasi oleh Guru Halaqah!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
        tag     : 'partner-belajar-konf-' + id_log,
        data    : { trigger: 'partner_belajar_konf', id_log: id_log }
      });
    }

    return { status: 'ok' };
  },
  // Daftar aktivitas belajar yang masih menunggu di sebuah halaqah (untuk guru konfirmasi)
  getLogBelajarMenungguHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('log_belajar_mandiri')
      .select('id_log, id_murid, nama_murid, tanggal, jenis_aktivitas, deskripsi, durasi_menit, created_at')
      .eq('id_halaqah', id_halaqah).eq('status_konfirmasi', 'menunggu')
      .order('created_at', { ascending: true });
    _check(error, 'getLogBelajarMenungguHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Target bersama kelompok (guru/admin)
  getTargetBelajarByKelompok: async function(id_kelompok) {
    var res = await _sb.from('target_kelompok_belajar')
      .select('*, target_belajar_progress(id_murid, nama_murid)')
      .eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_belajar')
        .select('*').eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
      _check(fb.error, 'getTargetBelajarByKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  addTargetBelajarByKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('target_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addTargetBelajarByKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetBelajarByKelompok: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_belajar').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetBelajarByKelompok');
    return { status: 'ok' };
  },
  deleteTargetBelajarByKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_belajar').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetBelajarByKelompok');
    return { status: 'ok' };
  },

  // Buat kelompok baru (3-5 anggota). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok kosong jika
  // insert anggota gagal (validasi roster/aktif atau koneksi putus)
  createKelompokBelajar: async function(id_halaqah, nama_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { data: id_kelompok, error } = await _sb.rpc('create_kelompok_belajar', {
      p_id_halaqah: id_halaqah, p_nama_kelompok: nama_kelompok || null, p_anggota: rows
    });
    _check(error, 'createKelompokBelajar');
    return { status: 'ok', data: { id_kelompok: id_kelompok } };
  },

  // Ubah nama/status kelompok
  updateKelompokBelajar: async function(id_kelompok, updates) {
    var payload = { updated_at: new Date().toISOString() };
    if (updates.nama_kelompok !== undefined) payload.nama_kelompok = updates.nama_kelompok;
    if (updates.status !== undefined)        payload.status = updates.status;
    var { error } = await _sb.from('kelompok_partner_belajar').update(payload).eq('id_kelompok', id_kelompok);
    _check(error, 'updateKelompokBelajar');
    return { status: 'ok' };
  },

  // Ganti seluruh anggota kelompok (replace, 3-5 anggota). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok tanpa
  // anggota jika insert pengganti gagal (validasi roster/aktif atau koneksi putus)
  setAnggotaKelompokBelajar: async function(id_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { error } = await _sb.rpc('set_anggota_kelompok_belajar', {
      p_id_kelompok: id_kelompok, p_anggota: rows
    });
    _check(error, 'setAnggotaKelompokBelajar');
    return { status: 'ok' };
  },

  // Hapus kelompok (anggota ikut terhapus via on delete cascade; log_belajar_mandiri
  // TIDAK ikut terhapus -- id_kelompok tanpa FK, riwayat aktivitas tetap utuh)
  deleteKelompokBelajar: async function(id_kelompok) {
    var { error } = await _sb.from('kelompok_partner_belajar').delete().eq('id_kelompok', id_kelompok);
    _check(error, 'deleteKelompokBelajar');
    return { status: 'ok' };
  },

  getHalaqahPRSubmissions: async function(id_halaqah) {
    // 1. Ambil list murid yang statusnya aktif di halaqah ini
    var { data: activeAnggota } = await _sb.from('anggota')
      .select('id_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif');
    
    var activeMuridIds = (activeAnggota || []).map(function(a) { return a.id_murid; });
    if (activeMuridIds.length === 0) {
      return { status: 'ok', data: [] };
    }

    // 2. Tarik log PR hanya untuk murid aktif di halaqah ini
    var { data, error } = await _sb.from('nilai_kbm')
      .select('id_nilai, id_murid, id_halaqah, tanggal, pertemuan_ke, status_hadir, pr_status, pr_catatan_murid, pr_lampiran_url, pr_submitted_at, pr_status_nilai, pr_catatan_guru, pr_lampiran_guru_url, users(nama_lengkap, no_hp), kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,deadline_latihan)')
      .eq('id_halaqah', id_halaqah)
      .in('id_murid', activeMuridIds)
      .not('kbm_log.latihan_mandiri', 'is', null)
      .order('tanggal', { ascending: false });
    _check(error, 'getHalaqahPRSubmissions');
    return { status: 'ok', data: (data || []).filter(function(d) {
      return d.kbm_log && d.kbm_log.latihan_mandiri;
    }).map(function(d) {
      return Object.assign({}, d, {
        nama_murid: d.users ? d.users.nama_lengkap : '',
        no_wa: d.users ? d.users.no_hp : ''
      });
    }) };
  },

  nilaiPR: async function(id_nilai, status_nilai, catatan_guru, lampiran_guru_url) {
    var { data, error } = await _sb.rpc('nilai_latihan_mandiri', {
      p_id_nilai: id_nilai,
      p_pr_status_nilai: status_nilai,
      p_pr_catatan_guru: catatan_guru,
      p_pr_lampiran_guru_url: lampiran_guru_url || null
    });
    _check(error, 'nilaiPR');
    return { status: 'ok', data: data };
  },

  // ── Quiz Management (Guru) ─────────────────
  getKuisList: async function() {
    var id_guru = _uid();
    var { data: kuisData, error } = await _sb.from('quiz')
      .select('*, quiz_halaqah(id_halaqah, halaqah(nama_halaqah)), quiz_soal(id_soal)')
      .eq('id_guru', id_guru)
      .order('created_at', { ascending: false });
    _check(error, 'getKuisList');
    
    var list = (kuisData || []).map(function(q) {
      return Object.assign({}, q, {
        total_soal: (q.quiz_soal || []).length,
        assigned_halaqah: (q.quiz_halaqah || []).map(function(qh) {
          return { id_halaqah: qh.id_halaqah, nama_halaqah: qh.halaqah ? qh.halaqah.nama_halaqah : '' };
        })
      });
    });
    return { status: 'ok', data: list };
  },

  // ── Rattil Maze (guru) — kelola level MILIK guru; RLS maze_level_write (id_guru=self) ──
  getMazeLevelsGuru: async function() {
    var { data, error } = await _sb.from('maze_level')
      .select('*').eq('id_guru', _uid()).order('urutan', { ascending: true });
    _check(error, 'getMazeLevelsGuru');
    return { status: 'ok', data: data || [] };
  },
  createMazeLevelGuru: async function(payload) {
    var row = {
      id_guru:           _uid(),
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      map_data:          payload.map_data,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_halaqah:    payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    var { data, error } = await _sb.from('maze_level').insert([row]).select().single();
    _check(error, 'createMazeLevelGuru');
    if (!data) throw new Error('createMazeLevelGuru: 0 baris tersimpan (akses ditolak?).');
    return { status: 'ok', data: data };
  },
  updateMazeLevelGuru: async function(id_maze_level, payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_halaqah:    payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    if (payload.map_data) row.map_data = payload.map_data;
    var { data, error } = await _sb.from('maze_level')
      .update(row).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'updateMazeLevelGuru');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — bukan level Anda / akses ditolak).');
    return { status: 'ok' };
  },
  setMazeLevelAktifGuru: async function(id_maze_level, aktif) {
    var { data, error } = await _sb.from('maze_level')
      .update({ aktif: !!aktif }).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'setMazeLevelAktifGuru');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteMazeLevelGuru: async function(id_maze_level) {
    var { error } = await _sb.from('maze_level').delete().eq('id_maze_level', id_maze_level);
    _check(error, 'deleteMazeLevelGuru');
    return { status: 'ok' };
  },

  // ── Rattil Run (guru) — kelola level MILIK guru; RLS run_level_write (id_guru=self) ──
  getRunLevelsGuru: async function() {
    var { data, error } = await _sb.from('run_level')
      .select('*').eq('id_guru', _uid()).order('urutan', { ascending: true });
    _check(error, 'getRunLevelsGuru');
    return { status: 'ok', data: data || [] };
  },
  createRunLevelGuru: async function(payload) {
    var row = {
      id_guru:             _uid(),
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_halaqah:      payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level').insert([row]).select().single();
    _check(error, 'createRunLevelGuru');
    if (!data) throw new Error('createRunLevelGuru: 0 baris tersimpan (akses ditolak?).');
    return { status: 'ok', data: data };
  },
  updateRunLevelGuru: async function(id_run_level, payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_halaqah:      payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level')
      .update(row).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'updateRunLevelGuru');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — bukan level Anda / akses ditolak).');
    return { status: 'ok' };
  },
  setRunLevelAktifGuru: async function(id_run_level, aktif) {
    var { data, error } = await _sb.from('run_level')
      .update({ aktif: !!aktif }).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'setRunLevelAktifGuru');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteRunLevelGuru: async function(id_run_level) {
    var { error } = await _sb.from('run_level').delete().eq('id_run_level', id_run_level);
    _check(error, 'deleteRunLevelGuru');
    return { status: 'ok' };
  },

  createKuis: async function(payload) {
    var id_guru = _uid();
    var id_quiz = 'QZ-' + _genId('');
    var kuisRow = {
      id_quiz: id_quiz,
      id_guru: id_guru,
      judul: payload.judul,
      deskripsi: payload.deskripsi || null,
      kategori: payload.kategori || 'Umum',
      mode: payload.mode || 'mandiri',
      status: payload.status || 'draft',
      durasi_per_soal_detik: payload.durasi_per_soal_detik !== undefined ? payload.durasi_per_soal_detik : 30,
      urutan_soal: payload.urutan_soal || 'berurutan',
      tampilkan_jawaban: payload.tampilkan_jawaban || 'setelah_submit',
      boleh_retake: payload.boleh_retake || false,
      tgl_mulai: payload.tgl_mulai || null,
      tgl_selesai: payload.tgl_selesai || null,
      anti_tab_aktif: payload.anti_tab_aktif !== undefined ? payload.anti_tab_aktif : true,
      maks_peringatan_tab: payload.maks_peringatan_tab || 2
    };

    var { data, error } = await _sb.from('quiz').insert([kuisRow]).select().single();
    _check(error, 'createKuis');

    if (payload.id_halaqah_list && payload.id_halaqah_list.length > 0) {
      var halaqahRows = payload.id_halaqah_list.map(function(hid) {
        return { id_quiz: id_quiz, id_halaqah: hid };
      });
      var { error: hqErr } = await _sb.from('quiz_halaqah').insert(halaqahRows);
      _check(hqErr, 'createKuis:quiz_halaqah');
    }

    return { status: 'ok', data: data };
  },

  updateKuis: async function(id_quiz, payload) {
    var kuisRow = {};
    if (payload.judul !== undefined) kuisRow.judul = payload.judul;
    if (payload.deskripsi !== undefined) kuisRow.deskripsi = payload.deskripsi;
    if (payload.kategori !== undefined) kuisRow.kategori = payload.kategori;
    if (payload.mode !== undefined) kuisRow.mode = payload.mode;
    if (payload.status !== undefined) kuisRow.status = payload.status;
    if (payload.durasi_per_soal_detik !== undefined) kuisRow.durasi_per_soal_detik = payload.durasi_per_soal_detik;
    if (payload.urutan_soal !== undefined) kuisRow.urutan_soal = payload.urutan_soal;
    if (payload.tampilkan_jawaban !== undefined) kuisRow.tampilkan_jawaban = payload.tampilkan_jawaban;
    if (payload.boleh_retake !== undefined) kuisRow.boleh_retake = payload.boleh_retake;
    if (payload.tgl_mulai !== undefined) kuisRow.tgl_mulai = payload.tgl_mulai;
    if (payload.tgl_selesai !== undefined) kuisRow.tgl_selesai = payload.tgl_selesai;
    if (payload.anti_tab_aktif !== undefined) kuisRow.anti_tab_aktif = payload.anti_tab_aktif;
    if (payload.maks_peringatan_tab !== undefined) kuisRow.maks_peringatan_tab = payload.maks_peringatan_tab;
    kuisRow.updated_at = new Date().toISOString();

    var { data, error } = await _sb.from('quiz').update(kuisRow).eq('id_quiz', id_quiz).select().single();
    _check(error, 'updateKuis');

    if (payload.id_halaqah_list !== undefined) {
      await _sb.from('quiz_halaqah').delete().eq('id_quiz', id_quiz);
      if (payload.id_halaqah_list.length > 0) {
        var halaqahRows = payload.id_halaqah_list.map(function(hid) {
          return { id_quiz: id_quiz, id_halaqah: hid };
        });
        var { error: hqErr } = await _sb.from('quiz_halaqah').insert(halaqahRows);
        _check(hqErr, 'updateKuis:quiz_halaqah');
      }
    }

    return { status: 'ok', data: data };
  },

  deleteKuis: async function(id_quiz) {
    var { error } = await _sb.from('quiz').delete().eq('id_quiz', id_quiz);
    _check(error, 'deleteKuis');
    return { status: 'ok' };
  },

  getBankSoal: async function(kategori, tipe_soal, level, pertemuan_ke) {
    var q = _sb.from('soal')
      .select('*, users!id_guru(nama_lengkap), soal_pilihan(*), soal_pasangan(*), soal_kunci_isian(*)')
      .order('created_at', { ascending: false });

    if (kategori) q = q.eq('kategori', kategori);
    if (tipe_soal) q = q.eq('tipe_soal', tipe_soal);
    if (level) q = q.contains('levels', [level]);
    if (pertemuan_ke !== undefined && pertemuan_ke !== null && pertemuan_ke !== '') {
      q = q.eq('rekomendasi_pertemuan_ke', parseInt(pertemuan_ke));
    }

    var { data, error } = await q;
    _check(error, 'getBankSoal');
    return { status: 'ok', data: data || [] };
  },

  createSoal: async function(payload) {
    try {
      var id_guru = _uid();
      var id_soal = 'SL-' + _genId('');
      var soalRow = {
        id_soal: id_soal,
        id_guru: id_guru,
        tipe_soal: payload.tipe_soal,
        teks_soal: payload.teks_soal,
        teks_arab: payload.teks_arab || null,
        highlight_markup: payload.highlight_markup || null,
        audio_url: payload.audio_url || null,
        audio_tipe: payload.audio_tipe || null,
        isian_case_sensitive: payload.isian_case_sensitive || false,
        isian_abaikan_tanda_baca: payload.isian_abaikan_tanda_baca || false,
        penjelasan: payload.penjelasan || null,
        levels: payload.levels || [],
        rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke !== undefined && payload.rekomendasi_pertemuan_ke !== null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
        durasi_detik_default: (payload.durasi_detik_default !== undefined && payload.durasi_detik_default !== null && payload.durasi_detik_default !== '') ? parseInt(payload.durasi_detik_default) : null,
        bobot_poin_default: (payload.bobot_poin_default !== undefined && payload.bobot_poin_default !== null && payload.bobot_poin_default !== '') ? parseInt(payload.bobot_poin_default) : 10,
        boleh_maze: !!payload.boleh_maze,
        boleh_run: !!payload.boleh_run
      };

      var { data: soalData, error } = await _sb.from('soal').insert([soalRow]).select().single();
      _check(error, 'createSoal');

      if (payload.pilihan && payload.pilihan.length > 0) {
        var pilihanRows = payload.pilihan.map(function(p, idx) {
          return {
            id_soal: id_soal,
            teks_pilihan: p.teks_pilihan,
            urutan: idx + 1,
            is_benar: !!p.is_benar
          };
        });
        var { error: pilErr } = await _sb.from('soal_pilihan').insert(pilihanRows);
        _check(pilErr, 'createSoal:pilihan');
      }

      if (payload.pasangan && payload.pasangan.length > 0) {
        var pasanganRows = payload.pasangan.map(function(p, idx) {
          return {
            id_soal: id_soal,
            teks_kiri: p.teks_kiri,
            teks_kanan: p.teks_kanan,
            urutan: idx + 1
          };
        });
        var { error: pasErr } = await _sb.from('soal_pasangan').insert(pasanganRows);
        _check(pasErr, 'createSoal:pasangan');
      }

      if (payload.kunci_isian && payload.kunci_isian.length > 0) {
        var kunciRows = payload.kunci_isian.map(function(k) {
          return {
            id_soal: id_soal,
            teks_kunci: String(k).trim()
          };
        });
        var { error: kunErr } = await _sb.from('soal_kunci_isian').insert(kunciRows);
        _check(kunErr, 'createSoal:kunci_isian');
      }

      return { status: 'ok', data: soalData };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Gagal menyimpan soal. Pastikan database patch_062_quiz_bugfix.sql sudah dijalankan di Supabase SQL Editor.');
      }
      throw e;
    }
  },

  updateSoal: async function(id_soal, payload) {
    var { error } = await _sb.rpc('update_soal', {
      p_id_soal: id_soal,
      p_teks_soal: payload.teks_soal || null,
      p_penjelasan: payload.penjelasan || null,
      p_highlight: payload.highlight_markup || null
    });
    _check(error, 'updateSoal');
    return { status: 'ok' };
  },

  getSoalDetail: async function(id_soal) {
    var { data, error } = await _sb.from('soal')
      .select('*, soal_pilihan(*), soal_pasangan(*), soal_kunci_isian(*)')
      .eq('id_soal', id_soal)
      .single();
    _check(error, 'getSoalDetail');
    return { status: 'ok', data: data };
  },

  updateSoalFull: async function(id_soal, payload) {
    var soalRow = {
      tipe_soal: payload.tipe_soal,
      teks_soal: payload.teks_soal,
      teks_arab: payload.teks_arab || null,
      highlight_markup: payload.highlight_markup || null,
      audio_url: payload.audio_url || null,
      audio_tipe: payload.audio_tipe || null,
      isian_case_sensitive: payload.isian_case_sensitive || false,
      isian_abaikan_tanda_baca: payload.isian_abaikan_tanda_baca || false,
      penjelasan: payload.penjelasan || null,
      levels: payload.levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke !== undefined && payload.rekomendasi_pertemuan_ke !== null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      durasi_detik_default: (payload.durasi_detik_default !== undefined && payload.durasi_detik_default !== null && payload.durasi_detik_default !== '') ? parseInt(payload.durasi_detik_default) : null,
      bobot_poin_default: (payload.bobot_poin_default !== undefined && payload.bobot_poin_default !== null && payload.bobot_poin_default !== '') ? parseInt(payload.bobot_poin_default) : 10,
      boleh_maze: !!payload.boleh_maze,
      boleh_run: !!payload.boleh_run
    };

    // .select() agar bisa mendeteksi jumlah baris terupdate. Di bawah RLS, update yang
    // diblok (mis. soal terkunci karena kuisnya sudah dikerjakan murid, atau bukan
    // pemilik/bukan admin) mengembalikan 0 baris TANPA error — kalau tidak dicek, kita
    // salah melapor "berhasil". Guard ini juga WAJIB sebelum delete opsi di bawah, agar
    // pilihan/pasangan/kunci tidak ikut terhapus saat soal-nya sendiri gagal diperbarui.
    var { data: updatedRows, error: updateErr } = await _sb.from('soal')
      .update(soalRow).eq('id_soal', id_soal).select('id_soal');
    _check(updateErr, 'updateSoalFull:soal');
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error('Soal tidak bisa diedit: kemungkinan sudah dipakai di kuis yang telah dikerjakan murid (terkunci), atau akses ditolak. Duplikasi soal terlebih dahulu jika ingin mengubahnya.');
    }

    await Promise.all([
      _sb.from('soal_pilihan').delete().eq('id_soal', id_soal),
      _sb.from('soal_pasangan').delete().eq('id_soal', id_soal),
      _sb.from('soal_kunci_isian').delete().eq('id_soal', id_soal)
    ]);

    if (payload.pilihan && payload.pilihan.length > 0) {
      var pilihanRows = payload.pilihan.map(function(p, idx) {
        return {
          id_soal: id_soal,
          teks_pilihan: p.teks_pilihan,
          urutan: idx + 1,
          is_benar: !!p.is_benar
        };
      });
      var { error: pilErr } = await _sb.from('soal_pilihan').insert(pilihanRows);
      _check(pilErr, 'updateSoalFull:pilihan');
    }

    if (payload.pasangan && payload.pasangan.length > 0) {
      var pasanganRows = payload.pasangan.map(function(p, idx) {
        return {
          id_soal: id_soal,
          teks_kiri: p.teks_kiri,
          teks_kanan: p.teks_kanan,
          urutan: idx + 1
        };
      });
      var { error: pasErr } = await _sb.from('soal_pasangan').insert(pasanganRows);
      _check(pasErr, 'updateSoalFull:pasangan');
    }

    if (payload.kunci_isian && payload.kunci_isian.length > 0) {
      var kunciRows = payload.kunci_isian.map(function(k) {
        return {
          id_soal: id_soal,
          teks_kunci: String(k).trim()
        };
      });
      var { error: kunErr } = await _sb.from('soal_kunci_isian').insert(kunciRows);
      _check(kunErr, 'updateSoalFull:kunci_isian');
    }

    return { status: 'ok' };
  },

  deleteSoal: async function(id_soal) {
    try {
      var { error } = await _sb.from('soal').delete().eq('id_soal', id_soal);
      if (error) {
        if (error.code === '23503') {
          throw new Error('Soal tidak bisa dihapus karena sedang digunakan dalam kuis.');
        }
        _check(error, 'deleteSoal');
      }
      return { status: 'ok' };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Soal tidak bisa dihapus. Silakan pastikan kuis yang menggunakan soal ini sudah dihapus atau database patch_062_quiz_bugfix.sql sudah dijalankan.');
      }
      throw e;
    }
  },

  addSoalToKuis: async function(id_quiz, id_soal, urutan, bobot_poin, durasi_detik_override) {
    var finalUrutan = urutan;
    if (finalUrutan === undefined || finalUrutan === null) {
      var { data: qsData, error: qsErr } = await _sb
        .from('quiz_soal')
        .select('urutan')
        .eq('id_quiz', id_quiz)
        .order('urutan', { ascending: false })
        .limit(1);
      if (qsErr) console.warn('[Quiz] Failed to fetch max urutan:', qsErr);
      var maxUrutan = (qsData && qsData.length > 0) ? qsData[0].urutan : 0;
      finalUrutan = maxUrutan + 1;
    }

    var finalPoin = bobot_poin;
    var finalDurasi = durasi_detik_override;

    if (finalPoin === undefined || finalPoin === null || finalDurasi === undefined || finalDurasi === null) {
      try {
        var { data: soalData } = await _sb.from('soal').select('durasi_detik_default, bobot_poin_default').eq('id_soal', id_soal).single();
        if (soalData) {
          if (finalPoin === undefined || finalPoin === null) {
            finalPoin = soalData.bobot_poin_default !== null && soalData.bobot_poin_default !== undefined ? soalData.bobot_poin_default : 10;
          }
          if (finalDurasi === undefined || finalDurasi === null) {
            finalDurasi = soalData.durasi_detik_default !== null && soalData.durasi_detik_default !== undefined ? soalData.durasi_detik_default : null;
          }
        }
      } catch (e) {
        console.warn('[Quiz] Failed to fetch soal defaults:', e);
      }
    }

    var { error } = await _sb.from('quiz_soal').insert([{
      id_quiz: id_quiz,
      id_soal: id_soal,
      urutan: finalUrutan,
      bobot_poin: finalPoin !== undefined && finalPoin !== null ? finalPoin : 10,
      durasi_detik_override: finalDurasi || null
    }]);
    _check(error, 'addSoalToKuis');
    return { status: 'ok' };
  },

  updateSoalKuisSetting: async function(id_quiz, id_soal, durasi_detik_override, bobot_poin) {
    var payload = {};
    if (durasi_detik_override !== undefined) payload.durasi_detik_override = durasi_detik_override ? parseInt(durasi_detik_override) : null;
    if (bobot_poin !== undefined) payload.bobot_poin = parseInt(bobot_poin) || 10;

    var { error } = await _sb.from('quiz_soal').update(payload).eq('id_quiz', id_quiz).eq('id_soal', id_soal);
    _check(error, 'updateSoalKuisSetting');
    return { status: 'ok' };
  },

  removeSoalFromKuis: async function(id_quiz, id_soal) {
    try {
      var { error } = await _sb.from('quiz_soal').delete().eq('id_quiz', id_quiz).eq('id_soal', id_soal);
      if (error) _check(error, 'removeSoalFromKuis');
      return { status: 'ok' };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Gagal menghapus soal dari kuis. Pastikan database patch_062_quiz_bugfix.sql sudah dijalankan di Supabase SQL Editor.');
      }
      throw e;
    }
  },

  getHasilKuis: async function(id_quiz) {
    var [quizRes, hasilRes, jawabanRes] = await Promise.all([
      _sb.from('quiz').select('*, quiz_soal(*, soal(*))').eq('id_quiz', id_quiz).single(),
      _sb.from('hasil_quiz').select('*, users!hasil_quiz_id_murid_fkey(nama_lengkap, no_hp)').eq('id_quiz', id_quiz).order('skor_total', { ascending: false }),
      _sb.from('jawaban_murid').select('*').eq('id_quiz', id_quiz)
    ]);
    _check(quizRes.error, 'getHasilKuis:quiz');
    _check(hasilRes.error, 'getHasilKuis:hasil');

    // PATCH 066/067: tampilkan konten soal beku (snapshot). quiz_soal(*) sudah
    // membawa kolom snap_*, jadi timpa embed soal-nya langsung.
    if (quizRes.data && Array.isArray(quizRes.data.quiz_soal)) {
      quizRes.data.quiz_soal.forEach(function (qs) { _overrideSoalFromSnap(qs.soal, qs); });
    }

    var hasil = hasilRes.data || [];
    var totalMengerjakan = hasil.length;
    var totalSkor = hasil.reduce(function(acc, h) { return acc + (h.skor_total || 0); }, 0);
    var avgSkor = totalMengerjakan > 0 ? Math.round(totalSkor / totalMengerjakan) : 0;

    var muridSudah = new Set(hasil.map(function(h) { return h.id_murid; }));
    var belumMengerjakan = [];

    try {
      var { data: qhData } = await _sb.from('quiz_halaqah').select('id_halaqah').eq('id_quiz', id_quiz);
      if (qhData && qhData.length > 0) {
        var halaqahIds = qhData.map(function(qh) { return qh.id_halaqah; });
        var { data: angData } = await _sb.from('anggota')
          .select('id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(nama_lengkap, no_hp)')
          .in('id_halaqah', halaqahIds)
          .eq('status', 'aktif');
        
        if (angData) {
          var seenMurid = new Set();
          angData.forEach(function(a) {
            if (!seenMurid.has(a.id_murid)) {
              seenMurid.add(a.id_murid);
              if (!muridSudah.has(a.id_murid)) {
                belumMengerjakan.push({
                  id_murid: a.id_murid,
                  nama_lengkap: a.nama_murid || (a.users && a.users.nama_lengkap) || 'Murid',
                  no_hp: a.users ? a.users.no_hp : null
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Quiz] Failed to fetch non-completers:', e);
    }

    return {
      status: 'ok',
      quiz: quizRes.data,
      summary: {
        total_mengerjakan: totalMengerjakan,
        rata_rata_skor: avgSkor,
        hasil_murid: hasil,
        jawaban_detail: jawabanRes.data || [],
        belum_mengerjakan: belumMengerjakan
      }
    };
  },

  getAntrianReviewIsian: async function(id_quiz) {
    var id_guru = _uid();
    var selectStr = '*, users!jawaban_murid_id_murid_fkey(nama_lengkap), soal(*, soal_kunci_isian(*))';
    var userRole = _currentUser && _currentUser.role;
    var isAdmin = userRole === 'admin' || userRole === 'superadmin';

    var q;
    if (isAdmin) {
      q = _sb.from('jawaban_murid')
        .select(selectStr)
        .eq('status_review', 'menunggu_review')
        .order('created_at', { ascending: true });
    } else {
      q = _sb.from('jawaban_murid')
        .select(selectStr + ', quiz!inner(id_guru)')
        .eq('status_review', 'menunggu_review')
        .eq('quiz.id_guru', id_guru)
        .order('created_at', { ascending: true });
    }

    if (id_quiz) q = q.eq('id_quiz', id_quiz);

    var { data, error } = await q;
    _check(error, 'getAntrianReviewIsian');

    // PATCH 066/067: tampilkan teks soal beku (snapshot) di antrian review.
    var rows = data || [];
    if (rows.length) {
      var quizIds = Array.from(new Set(rows.map(function (r) { return r.id_quiz; })));
      var snapRes = await _sb.from('quiz_soal').select(_SNAP_COLS).in('id_quiz', quizIds);
      var snapMap = {};
      (snapRes.data || []).forEach(function (r) { snapMap[r.id_quiz + '|' + r.id_soal] = r; });
      rows.forEach(function (r) { _overrideSoalFromSnap(r.soal, snapMap[r.id_quiz + '|' + r.id_soal]); });
    }
    return { status: 'ok', data: rows };
  },

  reviewIsianSingkat: async function(id_jawaban, disetujui, simpan_sebagai_varian) {
    var { error } = await _sb.rpc('review_isian_singkat', {
      p_id_jawaban: id_jawaban,
      p_disetujui: !!disetujui,
      p_simpan_sebagai_varian: !!simpan_sebagai_varian
    });
    _check(error, 'reviewIsianSingkat');
    return { status: 'ok' };
  },

  startSesiLive: async function(id_quiz, id_halaqah, kode_join) {
    var kode = (kode_join || 'RATTIL-' + Math.random().toString(36).substring(2,6).toUpperCase()).toUpperCase();
    var { data, error } = await _sb.from('sesi_quiz').insert([{
      id_quiz: id_quiz,
      id_halaqah: id_halaqah,
      kode_join: kode,
      status: 'menunggu'
    }]).select().single();
    _check(error, 'startSesiLive');
    return { status: 'ok', data: data };
  },
  getMutabaahDaurahGuru: async function(id_periode) {
    id_periode = id_periode || 'P-DAURAH-JULI-2026';
    var id_guru = _uid();
    var [periodeRes, halaqahRes, asmtItemRes] = await Promise.all([
      _sb.from('periode').select('id_periode, nama_periode, tanggal_mulai, tanggal_selesai').eq('id_periode', id_periode).maybeSingle(),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, id_guru, level, status').eq('id_guru', id_guru).eq('level','Tahsin Al-Fatihah').eq('status','aktif'),
      _sb.from('assessment_items').select('id_item, nama_item:teks_latin, urutan, kategori').eq('level','Tahsin Al-Fatihah').eq('status','aktif').order('urutan'),
    ]);
    _check(periodeRes.error, 'getMutabaahDaurahGuru.periode');
    _check(halaqahRes.error, 'getMutabaahDaurahGuru.halaqah');
    _check(asmtItemRes.error, 'getMutabaahDaurahGuru.items');

    var periode = periodeRes.data || { id_periode: id_periode, nama_periode: 'Daurah Al-Fatihah', tanggal_mulai: '2026-07-11', tanggal_selesai: '2026-07-18' };
    var indikator = asmtItemRes.data || [];
    // .order('urutan') di query hanya urut GLOBAL — indikator hari berbeda bisa
    // bercampur (Hari 2 urutan 1 muncul sebelum Hari 1 urutan 7). Urutkan ulang
    // per Hari (angka di kategori) lalu urutan, sama seperti fix di konten-module.js.
    indikator.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var hqIds = (halaqahRes.data||[]).map(function(h){ return h.id_halaqah; });
    var itemIds = indikator.map(function(i){ return i.id_item; });

    var today = new Date(); today.setHours(0,0,0,0);
    var tglMulai = new Date(periode.tanggal_mulai); tglMulai.setHours(0,0,0,0);
    var tglSelesai = new Date(periode.tanggal_selesai); tglSelesai.setHours(0,0,0,0);
    var hariKe = today < tglMulai ? 0 : today > tglSelesai ? 8 : Math.floor((today - tglMulai) / 86400000) + 1;
    var statusDaurah = today < tglMulai ? 'belum' : today > tglSelesai ? 'selesai' : 'berlangsung';

    // Data besar diambil TERFILTER (halaqah milik guru + rentang tanggal periode)
    // dan berpaginasi via _selectAllPaged agar tidak terpotong batas 1000 baris PostgREST.
    var anggotaRows=[], kbmRows=[], nilaiRows=[], asmtRows=[];
    if (hqIds.length) {
      var big = await Promise.all([
        _selectAllPaged('anggota', 'id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(no_hp)',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','aktif').order('id_murid').order('id_halaqah'); },
          'getMutabaahDaurahGuru.anggota'),
        _selectAllPaged('kbm_log', 'id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke, status',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','selesai')
            .gte('tanggal_pertemuan', periode.tanggal_mulai).lte('tanggal_pertemuan', periode.tanggal_selesai)
            .order('id_kbm'); },
          'getMutabaahDaurahGuru.kbm'),
        _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, id_halaqah, id_kbm, status_hadir',
          function(q){ return q.in('id_halaqah', hqIds).order('id_nilai'); },
          'getMutabaahDaurahGuru.nilai'),
        itemIds.length
          ? _selectAllPaged('assessment_murid', 'id_murid, id_item, status_guru',
              function(q){ return q.in('id_item', itemIds).order('id_murid').order('id_item'); },
              'getMutabaahDaurahGuru.asmt')
          : Promise.resolve([]),
      ]);
      anggotaRows = big[0]; kbmRows = big[1]; nilaiRows = big[2]; asmtRows = big[3];
    }

    // Hanya nilai dari sesi KBM daurah (status selesai & dalam rentang periode)
    var kbmKeById = {};
    kbmRows.forEach(function(k){ kbmKeById[k.id_kbm] = k.pertemuan_ke || 0; });
    nilaiRows = nilaiRows.filter(function(n){ return Object.prototype.hasOwnProperty.call(kbmKeById, n.id_kbm); });

    var anggotaByHq={}, kbmByHq={}, nilaiByHqMurid={}, asmtByMuridItem={};
    anggotaRows.forEach(function(a){
      var aCopy = Object.assign({}, a, { no_hp: a.users && a.users.no_hp });
      delete aCopy.users;
      (anggotaByHq[a.id_halaqah]=anggotaByHq[a.id_halaqah]||[]).push(aCopy);
    });
    kbmRows.forEach(function(k){ (kbmByHq[k.id_halaqah]=kbmByHq[k.id_halaqah]||[]).push(k); });
    nilaiRows.forEach(function(n){
      var key=n.id_halaqah+'|'+n.id_murid;
      (nilaiByHqMurid[key]=nilaiByHqMurid[key]||[]).push(n);
    });
    asmtRows.forEach(function(s){ asmtByMuridItem[s.id_murid+'|'+s.id_item]=s.status_guru; });

    var halaqahList = (halaqahRes.data||[]).map(function(hq) {
      var muridList = (anggotaByHq[hq.id_halaqah]||[]);
      var sesiList  = (kbmByHq[hq.id_halaqah]||[]).sort(function(a,b){ return (a.pertemuan_ke||0)-(b.pertemuan_ke||0); });
      var sumHadir=0, sumTotal=0;
      var murid = muridList.map(function(m) {
        var nm = (nilaiByHqMurid[hq.id_halaqah+'|'+m.id_murid]||[]);
        var hadir = nm.filter(function(n){ return ['H','T'].includes(n.status_hadir); }).length;
        sumHadir+=hadir; sumTotal+=nm.length;
        var sesiStatus = {};
        nm.forEach(function(n){ var ke = kbmKeById[n.id_kbm]; if (ke) sesiStatus[ke] = n.status_hadir; });
        var tajwid = indikator.map(function(item){
          return { id_item:item.id_item, nama:item.nama_item, status:asmtByMuridItem[m.id_murid+'|'+item.id_item]||null };
        });
        var pahamCount=tajwid.filter(function(t){ return t.status==='paham'; }).length;
        return Object.assign({},m,{ hadir, sesiTotal:nm.length, pctHadir:nm.length>0?Math.round(hadir/nm.length*100):0, tajwid, pahamCount, sesiStatus });
      });
      var pctTajwidSum=0, pctTajwidCount=0;
      murid.forEach(function(m){ if(indikator.length>0){ pctTajwidSum+=m.pahamCount; pctTajwidCount+=indikator.length; } });
      return Object.assign({},hq,{
        murid, sesiList,
        sesiTerlaksana: sesiList.length,
        pctHadir: sumTotal>0?Math.round(sumHadir/sumTotal*100):0,
        pctTajwid: pctTajwidCount>0?Math.round(pctTajwidSum/pctTajwidCount*100):0,
      });
    });

    var totalPeserta=0, gSumHadir=0, gSumTotal=0, gSumPaham=0, gSumTajwid=0, totalSesi=0;
    halaqahList.forEach(function(h){
      totalPeserta+=h.murid.length; totalSesi+=h.sesiTerlaksana;
      h.murid.forEach(function(m){ gSumHadir+=m.hadir; gSumTotal+=m.sesiTotal; gSumPaham+=m.pahamCount; gSumTajwid+=indikator.length; });
    });

    var indikatorRanking = indikator.map(function(item){
      var paham=0,ragu=0,belum=0,total=0;
      halaqahList.forEach(function(h){ h.murid.forEach(function(m){
        var s=asmtByMuridItem[m.id_murid+'|'+item.id_item];
        if(s==='paham')paham++; else if(s==='ragu')ragu++; else if(s==='belum')belum++;
        if(s)total++;
      }); });
      return { id_item:item.id_item, nama:item.nama_item, paham,ragu,belum,total,
        pctPaham:total>0?Math.round(paham/total*100):null };
    }).sort(function(a,b){ return (a.pctPaham===null?-1:a.pctPaham)-(b.pctPaham===null?-1:b.pctPaham); });

    var muridAlert=[];
    halaqahList.forEach(function(h){ h.murid.forEach(function(m){
      var tajwidBelum=m.tajwid.filter(function(t){ return t.status==='belum'; }).length;
      var tajwidRagu =m.tajwid.filter(function(t){ return t.status==='ragu';  }).length;
      var lvl=(m.sesiTotal>0&&m.pctHadir<75)||tajwidBelum>=3?'kritis':((m.sesiTotal>0&&m.pctHadir<85)||tajwidRagu>=3)?'perhatian':null;
      if(lvl) muridAlert.push(Object.assign({},m,{
        nama_halaqah:h.nama_halaqah, nama_guru:h.nama_guru,
        tajwidBelum, tajwidRagu,
        indikatorLemah:m.tajwid.filter(function(t){ return t.status==='belum'||t.status==='ragu'; }).map(function(t){ return t.nama; }),
        level:lvl
      }));
    }); });
    muridAlert.sort(function(a,b){ return (a.level==='kritis'?0:1)-(b.level==='kritis'?0:1); });

    return { status:'ok', data:{
      periode, hariKe, statusDaurah,
      summary:{ totalPeserta, hariKe, totalSesi, avgHadir:gSumTotal>0?Math.round(gSumHadir/gSumTotal*100):0, avgTajwid:gSumTajwid>0?Math.round(gSumPaham/gSumTajwid*100):0 },
      halaqahList, indikatorRanking, indikator, muridAlert
    }};
  },
};

// ─────────────────────────────────────────────
//  KALKULASI RAPORT (helper internal)
// ─────────────────────────────────────────────
// BUG-021 fix: gradeConfig parameter opsional untuk backward compat
function _kalkulasiRaport(idMurid, idPeriode, idHalaqah, komponen, nilaiManual, nilaiKBM, atLog, totalAt, gradeConfig, studentLevel, periodeRange, asmtItems, asmtMurid) {
  var lvl = (studentLevel || '').trim();
  // BUG-021: threshold dari gradeConfig (dari DB), fallback ke default jika tidak ada
  var G = gradeConfig || {};
  var GRADE_MUMTAZ       = G.mumtaz       || 90;
  var GRADE_JAYYID_JIDDAN= G.jayyidJiddan || 80;
  var GRADE_JAYYID       = G.jayyid       || 70;
  var BONUS_PERFECT      = G.bonusPerfect != null ? G.bonusPerfect : 5;

  if (lvl === 'Tahsin Al-Fatihah') {
    // 1. Ambil data jawaban murid untuk 7 indikator
    var myAnswers = (asmtMurid || []).filter(function(a) { return a.id_murid === idMurid; });
    
    // 2. Petakan ke komponen detail_json (80% total / 7 indikator = ~11.4% per indikator)
    var listKomp = [];
    (asmtItems || []).forEach(function(item) {
      var ans = myAnswers.find(function(a) { return a.id_item === item.id_item; });
      var statusGuru = ans ? ans.status_guru : null;
      // Indikator yang BELUM diverifikasi guru (status_guru null / tak ada baris) di-exclude
      // (tak menyumbang bobot), bukan default 50 — selaras kebijakan "hanya nilai komponen
      // yang ada datanya". Verdict 'belum' (50) TETAP dihitung: itu penilaian guru yang sah.
      if (statusGuru == null) return;
      var score = statusGuru === 'paham' ? 100 : statusGuru === 'ragu' ? 70 : 50;
      listKomp.push({
        id_komponen: item.id_item,
        nama_komponen: item.teks_latin,
        teks_arab: item.teks_arab,
        keterangan: item.keterangan,
        bobot: 11.4,
        bobot_original: 11.4,
        nilai: score,
        nilai_bobot: Math.round((score * 11.4) / 100 * 10) / 10,
        tipe: 'daurah_indikator',
        status_guru: statusGuru
      });
    });

    // 3. Tambahkan komponen KBM Daurah (Kehadiran & Kamera)
    var myKBM = (nilaiKBM || []).filter(function(n) {
      if (n.id_murid !== idMurid) return false;
      if (n.kbm_log && n.kbm_log.status === 'draft') return false;
      if (periodeRange) {
        var tgl = n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan);
        if (!tgl || tgl < periodeRange.mulai || tgl > periodeRange.selesai) return false;
      }
      return true;
    });

    // A. Kehadiran KBM (Bobot: 10%) — hanya dihitung bila ada data KBM di periode ini.
    // Tanpa sesi KBM sama sekali, kehadiran tidak dinilai (di-exclude), selaras cabang Reguler.
    // Sebelumnya default 100 → murid tanpa data KBM ikut terangkat & membuat guard
    // "Belum Ada Data" (listKomp.length===0) mustahil tercapai.
    if (myKBM.length > 0) {
      var skorHadir = myKBM.reduce(function(s,n) {
        var kd = String(n.status_hadir||'').toUpperCase();
        return s + (kd === 'H' ? 1 : kd === 'T' ? 0.7 : kd === 'I' ? 0.5 : 0);
      }, 0);
      var nilaiHadir = Math.round(skorHadir / myKBM.length * 100);

      listKomp.push({
        id_komponen: 'daurah-kehadiran-kbm',
        nama_komponen: 'Kehadiran KBM',
        bobot: 10,
        bobot_original: 10,
        nilai: nilaiHadir,
        nilai_bobot: Math.round((nilaiHadir * 10) / 100 * 10) / 10,
        tipe: 'daurah_kbm',
        keterangan: 'Kedisiplinan kehadiran di ruang Zoom'
      });
    }

    // B. Partisipasi & Kamera KBM (Bobot: 10%) — hanya dihitung bila ada sesi hadir (H/T).
    // Murid absen total tidak dinilai adab/kamera: komponen di-exclude (tak menyumbang bobot),
    // selaras perilaku cabang Reguler. Sebelumnya default 100 → menaikkan nilai murid absen.
    var hadir = myKBM.filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
    if (hadir.length > 0) {
      var ts = 0;
      hadir.forEach(function(n) {
        var km = n.kamera_murid === 'kamera terbuka' ? 100 : n.kamera_murid === 'kamera tertutup' || n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50;
        var a = n.adab === 'Baik' ? 100 : 50;
        ts += Math.round((a * 70 + km * 30) / 100);
      });
      var nilaiKamera = Math.round(ts / hadir.length);

      listKomp.push({
        id_komponen: 'daurah-partisipasi-kbm',
        nama_komponen: 'Adab & Kamera KBM',
        bobot: 10,
        bobot_original: 10,
        nilai: nilaiKamera,
        nilai_bobot: Math.round((nilaiKamera * 10) / 100 * 10) / 10,
        tipe: 'daurah_kbm',
        keterangan: 'Kesesuaian adab dan kesiapan kamera selama KBM'
      });
    }

    // 4. Hitung Nilai Akhir
    var rawSum = listKomp.reduce(function(sum, k) { return sum + (k.nilai * k.bobot); }, 0);
    var totalWeight = listKomp.reduce(function(sum, k) { return sum + k.bobot; }, 0);
    var nilaiAkhir = totalWeight > 0 ? Math.round(rawSum / totalWeight) : 0;

    // Kelulusan daurah menuntut SEMUA indikator tajwid terkonfigurasi (asmtItems aktif)
    // sudah diverifikasi guru. Bila belum lengkap → predikat 'Belum Lengkap' (bukan grade
    // final) agar sertifikat LULUS tak terbit tanpa bukti penilaian tajwid.
    var totalIndikator   = (asmtItems || []).length;
    var indikatorDinilai = listKomp.filter(function(k){ return k.tipe === 'daurah_indikator'; }).length;
    var indikatorLengkap = totalIndikator > 0 && indikatorDinilai >= totalIndikator;

    var predikat = listKomp.length === 0 ? 'Belum Ada Data'
      : !indikatorLengkap                 ? 'Belum Lengkap'
      : nilaiAkhir >= GRADE_MUMTAZ        ? 'Mumtaz'
      : nilaiAkhir >= GRADE_JAYYID_JIDDAN ? 'Jayyid Jiddan'
      : nilaiAkhir >= GRADE_JAYYID        ? 'Jayyid'
      : 'Maqbul';

    return { nilai_akhir: nilaiAkhir, predikat, komponen: listKomp };
  }

  // Fase 1.5: hanya hitung baris dari sesi yang BUKAN draft (predikat <> 'draft' agar
  // tahan data legacy ber-status NULL). Sesi draft yang belum diselesaikan tidak boleh
  // mencemari raport (lihat RENCANA_persistensi_nilai_kbm.md §6).
  var myKBM = (nilaiKBM || []).filter(function(n) {
    if (n.id_murid !== idMurid) return false;
    if (n.kbm_log && n.kbm_log.status === 'draft') return false;   // Fase 1.5: buang sesi draft
    if (periodeRange) {                                            // #2: batasi ke rentang periode
      var tgl = n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan);
      if (!tgl || tgl < periodeRange.mulai || tgl > periodeRange.selesai) return false;
    }
    return true;
  });
  var myManual = (nilaiManual || []).filter(function(n) { return n.id_murid === idMurid; });
  var myAt = (atLog || []).filter(function(n) { return n.id_murid === idMurid; });

  // Filter out Micro Teaching sessions from regular calculations
  var myRegulerKBM = myKBM.filter(function(n) {
    var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
    return jenis !== 'Micro Teaching';
  });

  // BUG-021: threshold dari gradeConfig (dari DB), fallback ke default jika tidak ada
  var G = gradeConfig || {};
  var GRADE_MUMTAZ       = G.mumtaz       || 90;
  var GRADE_JAYYID_JIDDAN= G.jayyidJiddan || 80;
  var GRADE_JAYYID       = G.jayyid       || 70;
  var BONUS_PERFECT      = G.bonusPerfect != null ? G.bonusPerfect : 5;

  var ADAB_W = 70, KAM_W = 30;

  var nilaiKomp = (komponen || []).map(function(k) {
    var v = 0, nama = (k.nama_komponen || '').toLowerCase();
    var isExcluded = false;

    if (k.tipe === 'manual') {
      var nm = myManual.find(function(n) { return n.id_komponen === k.id_komponen; });
      if (nm && nm.nilai !== null && nm.nilai !== '') {
        v = Number(nm.nilai) || 0;
      } else {
        isExcluded = true;
      }
    } else {
      var hadir = myRegulerKBM.filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
      if (nama.includes('kehadiran') && !nama.includes('tibyan')) {
        // Kehadiran counts MT sessions to reward observer presence (uses myKBM instead of myRegulerKBM)
        var skor = myKBM.reduce(function(s,n) { var kd=String(n.status_hadir||'').toUpperCase(); return s+(kd==='H'?1:kd==='T'?0.7:kd==='I'?0.5:0); }, 0);
        v = myKBM.length > 0 ? Math.round(skor/myKBM.length*100) : 0;
        if (myKBM.length === 0) isExcluded = true;
      } else if (nama.includes('kbm') || nama.includes('harian')) {
        if (lvl === 'Micro Teaching') {
          isExcluded = true;
        } else {
          var ts = 0;
          hadir.forEach(function(n) {
            var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
            var km = n.kamera_murid === 'kamera terbuka' ? 100 : n.kamera_murid === 'kamera tertutup' || n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50;
            if (jenis === 'KBM Qiyam') {
              // Qiyam uses camera scores instead of adab (since Qiyam doesn't input adab)
              ts += km;
            } else {
              var a = n.adab === 'Baik' ? 100 : 50;
              ts += Math.round((a * ADAB_W + km * KAM_W) / 100);
            }
          });
          v = hadir.length > 0 ? Math.round(ts / hadir.length) : 0;
          if (hadir.length === 0) isExcluded = true;
        }
      } else if (nama.includes('adab')) {
        if (lvl === 'Level Qiyam' || lvl === 'Micro Teaching') {
          isExcluded = true;
        } else {
          var vAdab = hadir.filter(function(n){return n.adab;});
          v = vAdab.length > 0 ? Math.round(vAdab.filter(function(n){return n.adab==='Baik';}).length/vAdab.length*100) : 0;
          if (vAdab.length === 0) isExcluded = true;
        }
      } else if (nama.includes('tibyan') || nama.includes('at-tibyan')) {
        var hadirAt = myAt.filter(function(n){return ['H','T'].includes(String(n.status_hadir||'').toUpperCase());}).length;
        v = totalAt > 0 ? Math.round(hadirAt/totalAt*100) : 0;
        if (totalAt === 0) isExcluded = true;
      } else if (nama.includes('micro') || nama.includes('micro teaching')) {
        var mtRows = myKBM.filter(function(n) {
          var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
          return jenis === 'Micro Teaching' && n.nilai != null && n.nilai !== '';
        });
        var mtSum = mtRows.reduce(function(s, n) { return s + (Number(n.nilai) || 0); }, 0);
        v = mtRows.length > 0 ? Math.round(mtSum / mtRows.length) : 0;
        if (mtRows.length === 0) isExcluded = true;
      }
    }
    return { id_komponen: k.id_komponen, nama_komponen: k.nama_komponen, bobot: Number(k.bobot), nilai: v, isExcluded: isExcluded, tipe: k.tipe };
  });

  // Separate active and excluded components
  var activeKomp = nilaiKomp.filter(function(k) { return !k.isExcluded; });
  var totalActiveWeight = activeKomp.reduce(function(sum, k) { return sum + k.bobot; }, 0);

  var nilaiAkhir = 0;
  if (totalActiveWeight > 0) {
    var rawSum = activeKomp.reduce(function(s, k) {
      return s + (k.nilai * k.bobot);
    }, 0);
    nilaiAkhir = Math.round(rawSum / totalActiveWeight);
    
    // Rescale active weights to sum up to exactly 100%
    var bobotUsedSum = 0;
    activeKomp.forEach(function(k) {
      k.bobot_original = k.bobot;
      var preciseBobot = (k.bobot_original / totalActiveWeight) * 100;
      k.bobot = Math.round(preciseBobot * 10) / 10;
      bobotUsedSum += k.bobot;
      
      var preciseNilaiBobot = (k.nilai * preciseBobot) / 100;
      k.nilai_bobot = Math.round(preciseNilaiBobot * 10) / 10;
    });
    
    // Adjust rounding error for bobot to ensure sum is exactly 100%
    var bobotDiff = 100 - bobotUsedSum;
    if (Math.abs(bobotDiff) > 0.01 && activeKomp.length > 0) {
      activeKomp[0].bobot = Math.round((activeKomp[0].bobot + bobotDiff) * 10) / 10;
    }
  }

  // Clean up properties for the final JSON array
  var detailJson = activeKomp.map(function(k) {
    return {
      id_komponen: k.id_komponen,
      nama_komponen: k.nama_komponen,
      bobot: k.bobot,
      bobot_original: k.bobot_original || k.bobot,
      nilai: k.nilai,
      nilai_bobot: k.nilai_bobot,
      tipe: k.tipe
    };
  });

  // Apply perfect attendance bonus using all KBM sessions (myKBM)
  var alpa = myKBM.filter(function(n){return String(n.status_hadir||'').toUpperCase()==='A';}).length;
  if (myKBM.length > 0 && alpa === 0) nilaiAkhir = Math.min(100, nilaiAkhir + BONUS_PERFECT);

  var predikat = myKBM.length === 0 ? 'Belum Ada Data'
    : nilaiAkhir >= GRADE_MUMTAZ        ? 'Mumtaz'
    : nilaiAkhir >= GRADE_JAYYID_JIDDAN ? 'Jayyid Jiddan'
    : nilaiAkhir >= GRADE_JAYYID        ? 'Jayyid'
    : 'Maqbul';

  return { nilai_akhir: nilaiAkhir, predikat, komponen: detailJson };
}

// ─────────────────────────────────────────────
//  MURID API
// ─────────────────────────────────────────────
var MuridAPI = {
  // Transparansi dana bulan berjalan untuk para Muhsinin (murid yang berinfaq).
  // Total infaq via RPC (murid tak bisa baca infaq orang lain), operasional via tabel (all_read).
  getTransparansiDana: async function(p) {
    var now = new Date();
    var tahun = p && p.tahun ? Number(p.tahun) : now.getFullYear();
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var bulan = (p && p.bulan) ? p.bulan : BULAN[now.getMonth()];
    var bulanIdx = BULAN.indexOf(bulan) + 1;
    var [infaqRes, opRes, beasiswaCountRes] = await Promise.all([
      _sb.rpc('get_infaq_bulanan', { p_bulan_idx: bulanIdx, p_tahun: tahun }),
      _sb.from('operasional').select('keterangan, nominal').eq('tahun', tahun).eq('bulan', bulan).order('created_at'),
      _sb.rpc('get_beasiswa_count'),
    ]);
    // Jika RPC belum ada (patch_052 belum dijalankan) → lempar agar panel tetap tersembunyi
    if (infaqRes && infaqRes.error) throw infaqRes.error;
    var infaq_bulanan = Number((infaqRes && infaqRes.data) || 0);
    var items = (opRes && opRes.data) || [];
    var operasional_total = items.reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: {
      bulan: bulan, tahun: tahun,
      infaq_bulanan: infaq_bulanan,
      operasional_items: items,
      operasional_total: operasional_total,
      sisa: infaq_bulanan - operasional_total,
      beasiswa_count: Number((beasiswaCountRes && beasiswaCountRes.data) || 0),
    } };
  },
  getDashboard: async function() {
    var id_murid = _uid();
    var [anggotaRes, userRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('*, halaqah(*, periode(*))').eq('id_murid', id_murid).eq('status', 'aktif').maybeSingle(),
      _sb.from('users').select('*').eq('id_user', id_murid).maybeSingle(),
      _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(*)').eq('id_murid', id_murid),
    ]);
    var anggota    = anggotaRes.data;
    var user       = userRes.data;
    var rawNilai   = nilaiRes.data || [];

    // Map KBM sessions in-memory resolving fallbacks for tanggal, pertemuan_ke, and jenis_sesi
    var allSessions = rawNilai.map(function(n) {
      var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
      return {
        id_kbm: n.id_kbm,
        id_halaqah: n.id_halaqah,
        id_murid: n.id_murid,
        status_hadir: n.status_hadir,
        adab: n.adab,
        kamera_murid: n.kamera_murid,
        nilai: n.nilai,
        koreksi_tahsin: n.koreksi_tahsin,
        catatan_murid: n.catatan_murid,
        pertemuan_ke: n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
        tanggal: n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
        jenis_sesi: jenis,
        materi: (n.kbm_log && n.kbm_log.materi_belajar) || '-',
      };
    });

    // Filter KBM sessions strictly based on student level (prevent MT leakages)
    var dashboardNilai = [];
    if (anggota && anggota.level === 'Level Qiyam') {
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Qiyam'; });
    } else if (anggota && (anggota.level === 'Micro Teaching' || (anggota.halaqah && anggota.halaqah.level === 'Micro Teaching'))) {
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'Micro Teaching'; });
    } else {
      // Regular KBM student: only show KBM Reguler
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Reguler'; });
    }

    var id_halaqah = anggota && anggota.halaqah && anggota.halaqah.id_halaqah;
    // Fetch pengumuman aktif untuk murid ini (target: semua atau halaqah ini)
    var pengumumanQuery = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(5);
    if (id_halaqah) pengumumanQuery = pengumumanQuery.or('target.in.(semua,all),id_halaqah.eq.'+id_halaqah);
    else pengumumanQuery = pengumumanQuery.in('target',['semua','all']);

    // Fetch exercises (PR) and exclude MT exercises
    var prQuery = _sb.from('nilai_kbm')
      .select('id_nilai, tanggal, pertemuan_ke, jenis_sesi, pr_status, pr_status_nilai, pr_catatan_guru, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar,jenis_sesi)')
      .eq('id_murid', id_murid) /* semua status kehadiran (H/T/I/A): murid absen/izin tetap dapat latihan mandiri */
      .not('kbm_log.latihan_mandiri','is',null)
      .order('tanggal',{ascending:false}).limit(10);

    var qiyamCountQuery = _sb.from('setoran_hafalan')
      .select('id_setoran', { count: 'exact', head: true })
      .eq('id_murid', id_murid)
      .eq('sumber', 'guru');

    var qiyamLatestQuery = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', id_murid)
      .eq('sumber', 'guru')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Apakah level halaqah murid mengaktifkan Partner Belajar (gating UI). Non-fatal:
    // kalau kolom/baris belum ada (migration 020 belum jalan), anggap false.
    // Sekaligus ambil jumlah_pertemuan untuk kustomisasi target progres KBM murid.
    var levelBelajarQuery = (anggota && anggota.halaqah && anggota.halaqah.level)
      ? _sb.from('level').select('partner_belajar_enabled, jumlah_pertemuan').eq('nama_level', anggota.halaqah.level).maybeSingle()
      : Promise.resolve({ data: null });

    var [
      { data: pengumuman },
      { data: prRaw },
      qiyamCountRes,
      qiyamLatestRes,
      levelBelajarRes
    ] = await Promise.all([
      pengumumanQuery,
      prQuery,
      qiyamCountQuery,
      qiyamLatestQuery,
      levelBelajarQuery
    ]);

    _check(qiyamLatestRes.error, 'getDashboard - qiyamLatest');

    // Calculate Micro Teaching in memory (immunized against NULL DB values)
    var mtSessions = allSessions.filter(function(n) { return n.jenis_sesi === 'Micro Teaching' && n.nilai != null && n.nilai !== ''; });
    var mtScores = mtSessions.map(function(m){ return Number(m.nilai); }).filter(function(v){ return !isNaN(v); });
    var mtAvg = mtScores.length > 0 ? Math.round(mtScores.reduce(function(a,b){ return a+b; }, 0) / mtScores.length) : 0;
    var sortedMt = mtSessions.slice().sort(function(a, b) {
      return (b.tanggal || '').localeCompare(a.tanggal || '');
    });
    var mtLatest = sortedMt.length > 0 ? sortedMt[0] : null;

    var today = _localDate();
    var prAktif = (prRaw||[])
      .filter(function(n){
        var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
        return n.kbm_log && n.kbm_log.latihan_mandiri && jenis !== 'Micro Teaching';
      })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        return Object.assign({}, n.kbm_log, {
          id_nilai: n.id_nilai,
          tanggal: n.tanggal, pertemuan_ke: n.pertemuan_ke,
          deadline: dl,
          status_deadline: !dl ? 'aktif' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : 'aktif',
          pr_status: n.pr_status || 'belum',
          pr_status_nilai: n.pr_status_nilai,
          pr_catatan_guru: n.pr_catatan_guru
        });
      })
      .filter(function(n){ return n.pr_status === 'belum'; }); // Hanya tampilkan PR yang belum selesai di dashboard

    var countH  = dashboardNilai.filter(function(n) { return n.status_hadir === 'H'; }).length;
    var countT  = dashboardNilai.filter(function(n) { return n.status_hadir === 'T'; }).length;
    var countI  = dashboardNilai.filter(function(n) { return n.status_hadir === 'I'; }).length;
    var countA  = dashboardNilai.filter(function(n) { return n.status_hadir === 'A'; }).length;
    var totalHadir  = countH + countT;
    var totalSesi   = dashboardNilai.length;
    var pctHadir    = totalSesi > 0 ? Math.round(totalHadir / totalSesi * 100) : 0;

    // Poin Adab & Kamera — hanya dari sesi hadir yang sudah dinilai
    var hadirNilai  = dashboardNilai.filter(function(n){ return ['H','T'].includes(n.status_hadir); });
    var adabData    = hadirNilai.filter(function(n){ return n.adab; });
    var adabBaik    = adabData.filter(function(n){ return n.adab==='Baik'; }).length;
    var poinAdab    = adabData.length > 0 ? Math.round(adabBaik/adabData.length*100) : undefined;
    var kameraData  = hadirNilai.filter(function(n){ return n.kamera_murid; });
    var kamTerbuka  = kameraData.filter(function(n){ return n.kamera_murid==='kamera terbuka'; }).length;
    var kamSeltup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera selalu tertutup'; }).length;
    var kamSegtup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera sering tertutup'; }).length;
    var poinKamera  = kameraData.length > 0 ? Math.round(kamTerbuka/kameraData.length*100) : undefined;
    var hq = (anggota && anggota.halaqah) || {};

    var regulerNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Reguler'; });
    var regHadir     = regulerNilai.filter(function(n) { return n.status_hadir === 'H' || n.status_hadir === 'T'; }).length;
    var regTotalSesi = regulerNilai.length;

    var daurahData = null;
    if (anggota && (anggota.level === 'Tahsin Al-Fatihah' || (anggota.halaqah && anggota.halaqah.level === 'Tahsin Al-Fatihah'))) {
      var [asmtItemsRes, asmtMuridRes] = await Promise.all([
        _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').order('urutan'),
        _sb.from('assessment_murid').select('*').eq('id_murid', id_murid)
      ]);
      var items = asmtItemsRes.data || [];
      var asmt = asmtMuridRes.data || [];
      var asmtMap = {};
      asmt.forEach(function(a) { asmtMap[a.id_item] = a.status_guru; });

      var progressItems = items.map(function(item) {
        return {
          id_item: item.id_item,
          nama: item.nama_item,
          kategori: item.kategori,
          status: asmtMap[item.id_item] || null
        };
      });

      var totalPaham = progressItems.filter(function(i) { return i.status === 'paham'; }).length;
      var totalRagu = progressItems.filter(function(i) { return i.status === 'ragu'; }).length;
      var totalBelum = progressItems.filter(function(i) { return i.status === 'belum'; }).length;

      var periode = (anggota.halaqah && anggota.halaqah.periode) || null;
      var hariKe = 0;
      var statusDaurah = 'belum';
      if (periode && periode.tanggal_mulai && periode.tanggal_selesai) {
        var todayT = new Date(); todayT.setHours(0,0,0,0);
        var tglMulai = new Date(periode.tanggal_mulai); tglMulai.setHours(0,0,0,0);
        var tglSelesai = new Date(periode.tanggal_selesai); tglSelesai.setHours(0,0,0,0);
        hariKe = todayT < tglMulai ? 0 : todayT > tglSelesai ? 8 : Math.floor((todayT - tglMulai) / 86400000) + 1;
        statusDaurah = todayT < tglMulai ? 'belum' : todayT > tglSelesai ? 'selesai' : 'berlangsung';
      }

      daurahData = {
        hariKe: hariKe,
        statusDaurah: statusDaurah,
        items: progressItems,
        summary: {
          total: items.length,
          paham: totalPaham,
          ragu: totalRagu,
          belum: totalBelum,
          belum_dinilai: items.length - (totalPaham + totalRagu + totalBelum),
          pct_paham: items.length > 0 ? Math.round(totalPaham / items.length * 100) : 0
        }
      };
    }

    return { status: 'ok', data: {
      anggota,
      profil  : user,
      halaqah : {
        nama      : hq.nama_halaqah || '',
        guru      : hq.nama_guru    || '',
        level     : hq.level        || '',
        jadwal    : hq.jadwal_hari  || '',
        jam       : hq.jam_mulai    ? String(hq.jam_mulai).substring(0, 5)    : '',
        jam_selesai: hq.jam_selesai ? String(hq.jam_selesai).substring(0, 5)  : '',
        id_halaqah: hq.id_halaqah   || '',
        partner_belajar_enabled: !!(levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.partner_belajar_enabled),
        tanggal_mulai: hq.periode ? hq.periode.tanggal_mulai : null,
        tanggal_selesai: hq.periode ? hq.periode.tanggal_selesai : null,
      },
      kehadiran: {
        skor_hadir  : regHadir,
        skor_dari_40: Math.min(Math.round(regHadir / ((levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40) * 100), 100),
        pct_hadir   : pctHadir,
        total_hadir : totalHadir,
        total_sesi  : totalSesi,
        sisa_sesi   : Math.max(0, ((levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40) - regTotalSesi),
        target_sesi : (levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40,
        count_h     : countH,
        count_t     : countT,
        count_i     : countI,
        count_a     : countA,
      },
      id_murid   : id_murid,
      no_hp      : user && user.no_hp  || '',
      email      : user && user.email  || '',
      poin_adab  : poinAdab,
      poin_kamera: poinKamera,
      poin_adab_detail  : { baik: adabBaik, cukup: adabData.length - adabBaik },
      poin_kamera_detail: { terbuka: kamTerbuka, selalu_tertutup: kamSeltup, sering_tertutup: kamSegtup },
      pengumuman : pengumuman || [],
      pr_aktif   : prAktif,
      daurah     : daurahData,
      qiyam: {
        total_setoran: qiyamCountRes.count || 0,
        terakhir: qiyamLatestRes.data || null
      },
      micro_teaching: {
        terakhir: mtLatest ? {
          nilai: mtLatest.nilai,
          pertemuan_ke: mtLatest.pertemuan_ke,
          tanggal: mtLatest.tanggal,
          materi: mtLatest.materi,
          koreksi_tahsin: mtLatest.koreksi_tahsin,
          catatan_murid: mtLatest.catatan_murid
        } : null,
        rata_nilai: mtAvg,
        total_sesi: mtScores.length
      }
    }};
  },

  getRiwayat: async function(limit, offset) {
    var id_murid = _uid();
    
    // Fetch student level first to filter history correctly (KBM Reguler and MT do not appear in Qiyam)
    var { data: ang } = await _sb.from('anggota')
      .select('level')
      .eq('id_murid', id_murid)
      .eq('status', 'aktif')
      .maybeSingle();

    var q = _sb.from('nilai_kbm')
      .select('*, kbm_log!nilai_kbm_id_kbm_fkey(tanggal_pertemuan,pertemuan_ke,materi_belajar,latihan_mandiri,jenis_latihan,deadline_latihan,jenis_sesi)', { count: 'exact' })
      .eq('id_murid', id_murid);

    if (ang && ang.level === 'Level Qiyam') {
      q = q.eq('jenis_sesi', 'KBM Qiyam');
    } else if (ang && ang.level === 'Micro Teaching') {
      q = q.eq('jenis_sesi', 'Micro Teaching');
    } else {
      // Regular KBM student: only show KBM Reguler. Use OR filter to include legacy records where jenis_sesi is NULL
      q = q.or('jenis_sesi.eq.KBM Reguler,jenis_sesi.is.null');
    }

    var { data, error, count } = await q
      .order('tanggal', { ascending: false })
      .range(offset||0, (offset||0)+(limit||8)-1);
    _check(error, 'getRiwayat');
    var mapped = (data||[]).map(function(n) { return Object.assign({}, n, {
      tanggal         : n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
      pertemuan_ke    : n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
      materi          : (n.kbm_log && n.kbm_log.materi_belajar) || '',
      materi_belajar  : n.kbm_log && n.kbm_log.materi_belajar,
      latihan_mandiri : n.kbm_log && n.kbm_log.latihan_mandiri,
      jenis_latihan   : n.kbm_log && n.kbm_log.jenis_latihan,
      deadline_latihan: n.kbm_log && n.kbm_log.deadline_latihan,
      jenis_sesi      : n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler',
    }); });
    return { status: 'ok', data: mapped, total: count, has_more: (offset||0)+(limit||8) < (count||0) };
  },

  getLatihanMandiri: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('nilai_kbm')
      .select('id_nilai, tanggal, pertemuan_ke, jenis_sesi, pr_status, pr_catatan_murid, pr_lampiran_url, pr_submitted_at, pr_status_nilai, pr_catatan_guru, pr_lampiran_guru_url, pr_dinilai_at, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar,jenis_sesi,referensi_url)')
      .eq('id_murid', id_murid) /* semua status kehadiran (H/T/I/A): murid absen/izin tetap dapat latihan mandiri */
      .not('kbm_log.latihan_mandiri', 'is', null)
      .order('tanggal', { ascending: false }).limit(20);
    _check(error, 'getLatihanMandiri');
    var today = _localDate();
    var rows = (data||[])
      .filter(function(n){
        return n.kbm_log && n.kbm_log.latihan_mandiri;
      })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        var daysLeft = dl ? Math.ceil((new Date(dl) - new Date(today)) / 86400000) : null;
        var status = !dl ? 'none' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : daysLeft <= 3 ? 'mepet' : 'aman';
        return {
          id_nilai       : n.id_nilai,
          tanggal        : n.tanggal,
          pertemuan_ke   : n.pertemuan_ke,
          latihan_mandiri: n.kbm_log.latihan_mandiri,
          jenis_latihan  : n.kbm_log.jenis_latihan,
          deadline       : dl,
          materi_belajar : n.kbm_log.materi_belajar,
          status_deadline: status,
          pr_status      : n.pr_status || 'belum',
          pr_catatan_murid: n.pr_catatan_murid || '',
          pr_lampiran_url: n.pr_lampiran_url || '',
          pr_submitted_at: n.pr_submitted_at,
          pr_status_nilai: n.pr_status_nilai,
          pr_catatan_guru: n.pr_catatan_guru || '',
          pr_lampiran_guru_url: n.pr_lampiran_guru_url || '',
          pr_dinilai_at  : n.pr_dinilai_at,
          referensi_url  : (n.kbm_log && n.kbm_log.referensi_url) || ''
        };
      });
    return { status: 'ok', data: rows };
  },

  getLatihanUploadToken: async function() {
    var { data, error } = await _sb.rpc('get_latihan_upload_token');
    _check(error, 'getLatihanUploadToken');
    return { status: 'ok', token: data };
  },

  submitPR: async function(id_nilai, catatan, lampiran_url) {
    var { data, error } = await _sb.rpc('submit_latihan_mandiri', {
      p_id_nilai: id_nilai,
      p_pr_catatan_murid: catatan,
      p_pr_lampiran_url: lampiran_url
    });
    _check(error, 'submitPR');
    return { status: 'ok', data: data };
  },

  logLatihanHarian: async function(durasi, kategori, catatan) {
    var id_murid = _uid();
    var { data, error } = await _sb.from('log_latihan_harian').upsert({
      id_murid: id_murid,
      tanggal: _localDate(),
      durasi_menit: parseInt(durasi),
      kategori: kategori,
      catatan: catatan
    }, { onConflict: 'id_murid,tanggal' });
    _check(error, 'logLatihanHarian');
    return { status: 'ok', data: data };
  },

  getStreakLatihan: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.rpc('get_murid_streak', { p_id_murid: id_murid });
    _check(error, 'getStreakLatihan');
    return { status: 'ok', streak: data || 0 };
  },

  getRaport: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('raport')
      .select('*, periode(nama_periode), halaqah(nama_halaqah,nama_guru)')
      .eq('id_murid', id_murid).eq('status', 'published')
      .order('created_at', { ascending: false });
    _check(error, 'getRaport');
    return { status: 'ok', data: (data||[]).map(function(r) { return Object.assign({}, r, {
      nama_periode: r.periode && r.periode.nama_periode,
      halaqah_nama: r.halaqah && r.halaqah.nama_halaqah,
      guru_nama   : r.halaqah && r.halaqah.nama_guru,
      komponen    : r.detail_json ? (function(){ try{ return typeof r.detail_json==='string'?JSON.parse(r.detail_json):r.detail_json; }catch(e){ return []; } })() : [],
    }); }) };
  },

  getRincianRaport: async function(id_raport) { return GuruAPI.getRincianRaport(id_raport); },
  generateRaportPDF: async function(id_r)    { return GuruAPI.generateRaportPDF(id_r); },

  getPengumuman: async function() {
    var id_murid = _uid();
    // BUG-019 fix: maybeSingle() agar tidak error jika murid di beberapa halaqah
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid', id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah;
    var q = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(15);
    if (id_halaqah) q = q.or('target.eq.semua,target.eq.all,id_halaqah.eq.' + id_halaqah);
    else q = q.in('target', ['semua','all']);
    var { data, error } = await q;
    _check(error, 'getPengumuman');
    return { status: 'ok', data };
  },

  getSPPStatus: async function() {
    var id_murid = _uid();
    var tahunIni = new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('*').eq('id_murid', id_murid)
      .order('tahun',{ascending:false}).order('created_at',{ascending:false});
    if (error) return { status: 'ok', data: { rows: [], lunas_bulan: [], tunggakan: 0, total_nominal: 0 } };
    var rows = data || [];
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var tahunAktif = rows.length ? Math.max(tahunIni, rows[0].tahun) : tahunIni;
    var rowsTahunIni = rows.filter(function(r){ return r.tahun === tahunAktif; });
    var lunasBulan  = rowsTahunIni.filter(function(r){ return r.status==='lunas' && (r.jenis==='SPP Pribadi' || !r.jenis); }).map(function(r){ return r.bulan; });
    var menunggu    = rowsTahunIni.filter(function(r){ return r.status==='menunggu' && (r.jenis==='SPP Pribadi' || !r.jenis) && !_sppGatewayExpired(r); }).map(function(r){ return r.bulan; });
    var bulanGrid   = BULAN.map(function(b) {
      var l = lunasBulan.includes(b);
      var m = menunggu.includes(b);
      return { bulan:b, status: l?'lunas': m?'menunggu':'belum' };
    });
    var totalNominal = rowsTahunIni.filter(function(r){return r.status==='lunas';}).reduce(function(s,r){return s+Number(r.nominal||0);},0);
    // [DESAIN SENGAJA] Kewajiban SPP = 5 bulan flat per periode.
    // JANGAN diganti window kalender (Jan–bulanBerjalan) — setiap level/kelas
    // bisa dibuka di bulan berbeda, tidak selalu mulai Januari.
    // tunggakan = sisa dari 5, bukan "bulan lewat yang belum dibayar".
    var TOTAL_SPP = 5;
    var tunggakan = Math.max(0, TOTAL_SPP - lunasBulan.length);
    // [DESAIN SENGAJA] Bulan mulai grid diambil dari bulan pertama yang pernah
    // disubmit murid — bukan Januari, bukan tanggal bergabung anggota.
    // Bulan sebelum itu tampil ○ (tidak berlaku), bukan ❌.
    var semuaBulanSpp = rowsTahunIni.filter(function(r){ return r.jenis==='SPP Pribadi'||!r.jenis; });
    var bulanMulaiIdx = semuaBulanSpp.length
      ? semuaBulanSpp.reduce(function(min,r){ var i=BULAN.indexOf(r.bulan); return i>=0&&i<min?i:min; }, 11)
      : new Date().getMonth();
    return { status: 'ok', data: {
      rows, lunas_bulan: lunasBulan, menunggu_bulan: menunggu,
      bulan_grid: bulanGrid, tunggakan, total_nominal: totalNominal,
      tahun_aktif: tahunAktif, has_paid: lunasBulan.length > 0,
      window_size: TOTAL_SPP, bulan_mulai_idx: bulanMulaiIdx,
    }};
  },

  getMetodeBayar: async function() {
    var { data } = await _sb.from('spp_metode_bayar').select('*').eq('aktif',true).order('urutan');
    return { status:'ok', data: data||[] };
  },

  konfirmasiSPP: async function(d) {
    var id_murid = _uid();
    var user = _currentUser || {};
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid',id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah || '';
    // Support multi-bulan: d.bulan bisa array atau string
    var bulanList = Array.isArray(d.bulan) ? d.bulan : (d.bulan && d.bulan !== '-' ? [d.bulan] : ['-']);
    if (!bulanList.length) bulanList = ['-'];

    // BUG-002 fix: cek baris yang sudah lunas agar tidak dioverride
    // BUG-K2 fix: sertakan jenis di id_spp agar tidak clash jika multi-jenis
    var jenisSuffix = (d.jenis || 'SPP Pribadi').replace(/\s+/g,'').substring(0,3).toUpperCase();
    var idSppMap = {};
    bulanList.forEach(function(bulan) {
      var id = 'SPP-' + id_murid + '-' + bulan.substring(0,3).toUpperCase() + '-' + d.tahun + '-' + jenisSuffix;
      if (d.jenis === 'Infaq/Operasional') {
        id += '-' + Math.random().toString(36).substring(2,10).toUpperCase();
      }
      idSppMap[bulan] = id;
    });

    var idSppList = Object.values(idSppMap);
    var { data: existingRows } = await _sb.from('spp_pembayaran')
      .select('id_spp, status').in('id_spp', idSppList);
    var sudahLunasSet = new Set(
      (existingRows || []).filter(function(r){ return r.status === 'lunas'; }).map(function(r){ return r.id_spp; })
    );
    // Filter: hanya proses bulan yang belum lunas
    var bulanProses = bulanList.filter(function(bulan) {
      var id_spp = idSppMap[bulan];
      return !sudahLunasSet.has(id_spp);
    });
    if (!bulanProses.length) {
      return { status: 'ok', message: 'Semua bulan yang dipilih sudah lunas. Tidak ada yang perlu dikonfirmasi.' };
    }

    var rows = bulanProses.map(function(bulan) {
      return {
        id_spp    : idSppMap[bulan],
        id_murid, nama_murid: user.nama_lengkap || user.nama || '',
        id_halaqah,
        bulan, tahun: Number(d.tahun),
        jenis: d.jenis || 'SPP Pribadi',
        status: 'menunggu',
        // BUG-07 fix: dibagi bulanProses.length (bulan yg benar-benar diproses), bukan bulanList.length
        nominal: bulanProses.length > 1 ? Math.round(Number(d.nominal||0) / bulanProses.length) : Number(d.nominal||0),
        metode_transfer: d.metode_transfer || '',
        bukti_url: d.bukti_url || '',
        catatan: d.catatan || '',
        metode_bayar: 'manual',
        mayar_expired_at: null,
        mayar_invoice_id: null,
        mayar_payment_link: null,
      };
    });
    var { error } = await _sb.from('spp_pembayaran').upsert(rows, { onConflict: 'id_spp' });
    _check(error, 'konfirmasiSPP');
    var jumlah = bulanProses.length > 1 ? bulanProses.length + ' bulan' : 'pembayaran';
    return { status: 'ok', message: 'Konfirmasi ' + jumlah + ' terkirim, menunggu validasi admin.' };
  },

  // Buat invoice Mayar → kembalikan payment_link untuk redirect
  createPaymentGateway: async function(d) {
    var tk = sessionStorage.getItem('hq_token') || localStorage.getItem('hq_token');
    if (!tk) throw new Error('Sesi berakhir. Silakan login ulang.');
    var res = await fetch(SUPABASE_URL + '/functions/v1/mayar-create-payment', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
      body   : JSON.stringify({
        bulan  : Array.isArray(d.bulan) ? d.bulan : [d.bulan],
        tahun  : Number(d.tahun),
        nominal: Number(d.nominal),
        jenis  : d.jenis || 'SPP Pribadi',
      }),
    });
    var data;
    try { data = await res.json(); } catch(e) { throw new Error('Server tidak merespons. Coba lagi.'); }
    if (data.status === 'error') throw new Error(data.message);
    if (!data.payment_link) throw new Error('Link pembayaran tidak tersedia. Coba lagi.');
    return data;
  },

  // BUG-M6 fix: implementasi nyata — grafik kehadiran 6 bulan terakhir
  getProgressGrafik: async function() {
    var id_murid = _uid();
    if (!id_murid) return { status: 'ok', data: [] };
    var since = new Date();
    since.setMonth(since.getMonth() - 6);
    var sinceStr = _localDate(since);
    var { data: rows, error } = await _sb.from('nilai_kbm')
      .select('tanggal, status_hadir')
      .eq('id_murid', id_murid)
      .gte('tanggal', sinceStr)
      .order('tanggal');
    if (error || !rows || !rows.length) return { status: 'ok', data: [] };
    // Kelompokkan per bulan
    var bulanMap = {};
    rows.forEach(function(r) {
      if (!r.tanggal) return;
      var key = r.tanggal.substring(0, 7); // 'YYYY-MM'
      if (!bulanMap[key]) bulanMap[key] = { total: 0, hadir: 0 };
      bulanMap[key].total++;
      if (['H', 'T'].includes(String(r.status_hadir || '').toUpperCase())) bulanMap[key].hadir++;
    });
    var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var grafik = Object.keys(bulanMap).sort().map(function(key) {
      var b = bulanMap[key];
      var pct = b.total > 0 ? Math.round(b.hadir / b.total * 100) : 0;
      var parts = key.split('-');
      return { bulan: BULAN[parseInt(parts[1], 10) - 1] + ' ' + parts[0], pct_hadir: pct, total: b.total, hadir: b.hadir };
    });
    return { status: 'ok', data: grafik };
  },

  getMateriLevel: async function() {
    var {data,error} = await _sb.from('materi_level').select('*').order('level').order('urutan');
    if (!error && data && data.length) {
      var grouped = {};
      data.forEach(function(r) {
        if (!grouped[r.level]) grouped[r.level] = [];
        grouped[r.level].push({ kategori: r.kategori, judul: r.judul, isi: r.isi });
      });
      return { status: 'ok', data: grouped };
    }
    return { status: 'ok', data: {} };
  },

  getAtTibyan: async function() {
    var id_murid = _uid();
    var [materiRes, logRes] = await Promise.all([
      _sb.from('at_tibyan_materi').select('*').order('pertemuan_ke'),
      _sb.from('at_tibyan_log').select('pertemuan_ke, status_hadir, tanggal, id_sesi').eq('id_murid', id_murid)
    ]);

    var materiData = materiRes.data || [];
    var logData = logRes.data || [];

    var logMapByPtm = {};
    var logMapByDate = {};
    logData.forEach(function(l) {
      if (l.pertemuan_ke !== null && l.pertemuan_ke !== undefined) {
        logMapByPtm[String(l.pertemuan_ke)] = l;
      }
      if (l.tanggal) {
        logMapByDate[l.tanggal] = l;
      }
    });

    var rows = materiData.map(function(r) {
      var pStr = String(r.pertemuan_ke);
      var log = logMapByPtm[pStr] || logMapByDate[r.tanggal];
      var presenceTxt = 'Presensi Belum Ada';
      if (log) {
        var sh = log.status_hadir;
        if (sh === 'H') presenceTxt = 'Hadir';
        else if (sh === 'T') presenceTxt = 'Hadir (Terlambat)';
        else if (sh === 'I') presenceTxt = 'Izin';
        else if (sh === 'A') presenceTxt = 'Alpa';
      }
      return {
        pertemuan_ke: pStr,
        tanggal: r.tanggal || '',
        pemateri: r.pemateri || '',
        materi_pembahasan: r.materi_pembahasan || '',
        nasihat_aplikatif: r.nasihat_aplikatif || '',
        presensi: presenceTxt,
        bab: '',
        materi: r.materi_pembahasan || '',
        catatan_guru: ''
      };
    });

    var columns = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'pemateri', label: 'Pemateri' },
      { key: 'materi_pembahasan', label: 'Materi Pembahasan' },
      { key: 'nasihat_aplikatif', label: 'Nasihat Aplikatif' }
    ];

    return { status: 'ok', data: rows, columns: columns };
  },
  getAtTibyanMurid: async function() {
    var id_murid = _uid();
    var { data: logs } = await _sb.from('at_tibyan_log')
      .select('id_sesi, status_hadir, tanggal').eq('id_murid', id_murid).order('tanggal', { ascending: false });
    if (!logs || !logs.length) return { status: 'ok', data: [], summary: { hadir: 0, total: 0, pct: 0 } };
    var sesiIds = logs.map(function(r){ return r.id_sesi; }).filter(Boolean);
    var sesiMap = {};
    if (sesiIds.length) {
      var { data: sesiList } = await _sb.from('at_tibyan_sesi').select('id_sesi, pertemuan_ke').in('id_sesi', sesiIds);
      (sesiList || []).forEach(function(s){ sesiMap[s.id_sesi] = s.pertemuan_ke; });
    }
    var rows = logs.map(function(r) {
      return { id_sesi: r.id_sesi, status_hadir: r.status_hadir, tanggal: r.tanggal, pertemuan_ke: sesiMap[r.id_sesi] || null };
    });
    var total = rows.length;
    var hadir = rows.filter(function(r){ return ['H','T'].includes(r.status_hadir); }).length;
    var pct   = total > 0 ? Math.round(hadir / total * 100) : 0;
    return { status: 'ok', data: rows, summary: { hadir, total, pct } };
  },
  getKonfigurasiRaport: async function() {
    var { data } = await _sb.from('konfigurasi_raport').select('*');
    var cfg = {}; (data||[]).forEach(function(r){cfg[r.key]=r.value;});
    return { status: 'ok', data: cfg };
  },
  getKeaktifanAlerts: async function() {
    var id_murid = _uid();
    var [kbmRes, atRes, anggotaRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',id_murid).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',id_murid).eq('status_hadir','A'),
      _sb.from('anggota').select('followup_alpa_kbm,followup_alpa_at,followup_at').eq('id_murid',id_murid).eq('status','aktif').maybeSingle(),
    ]);
    var kbmAlpa   = kbmRes.count || 0;
    var atAlpa    = atRes.count  || 0;
    if (anggotaRes.error) _check(anggotaRes.error, 'getKeaktifanAlerts.anggota');
    var dismissed = anggotaRes.data || {};

    // Alert hanya tampil jika alpa BERTAMBAH sejak guru terakhir dismiss
    // Jika kbmAlpa <= baseline saat dismiss → guru sudah handle, banner hilang
    var kbmDismissed = dismissed.followup_alpa_kbm != null && kbmAlpa <= dismissed.followup_alpa_kbm;
    var atDismissed  = dismissed.followup_alpa_at  != null && atAlpa  <= dismissed.followup_alpa_at;

    var alerts = [];
    if (!kbmDismissed) {
      if      (kbmAlpa >= 2) alerts.push({ tipe:'absen_kritis',     judul:'Kehadiran KBM Kritis!',       pesan:'Kamu sudah alpa '+kbmAlpa+'× di KBM halaqah. Segera hubungi guru ya.',  detail:'KBM alpa: '+kbmAlpa+'×' });
      else if (kbmAlpa === 1) alerts.push({ tipe:'absen_peringatan', judul:'Peringatan Kehadiran KBM',    pesan:'Kamu sudah alpa 1× di KBM. Jaga kehadiranmu!',                          detail:'KBM alpa: 1×' });
    }
    if (!atDismissed) {
      if      (atAlpa >= 2) alerts.push({ tipe:'absen_kritis',      judul:'Kehadiran At-Tibyan Kritis!', pesan:'Kamu sudah alpa '+atAlpa+'× di At-Tibyan. Semangat hadir ya!',          detail:'At-Tibyan alpa: '+atAlpa+'×' });
      else if (atAlpa === 1) alerts.push({ tipe:'absen_peringatan', judul:'Peringatan At-Tibyan',        pesan:'Kamu sudah alpa 1× di At-Tibyan. Jaga kehadiranmu!',                    detail:'At-Tibyan alpa: 1×' });
    }
    return { status: 'ok', data: { alerts, followup_at: dismissed.followup_at || null } };
  },

  // Ambil inbox push notifikasi yang belum dibaca murid
  getNotifInbox: async function() {
    var id_murid = _uid();
    if (!id_murid) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('notif_inbox')
      .select('id, judul, pesan, tipe, url, created_at')
      .eq('id_user', id_murid)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return { status: 'ok', data: [] };
    return { status: 'ok', data: data || [] };
  },

  // Tandai satu item inbox sebagai sudah dibaca
  markNotifRead: async function(id) {
    var id_murid = _uid();
    if (!id_murid || !id) return { status: 'err' };
    var { error } = await _sb.from('notif_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('id_user', id_murid);
    return error ? { status: 'err' } : { status: 'ok' };
  },

  getAssessmentItems: async function(level) {
    var q = _sb.from('assessment_items').select('id_item,level,kategori,teks_latin,teks_arab,keterangan,urutan').eq('status','aktif').order('urutan');
    if (level) q = q.eq('level', level);
    var { data, error } = await q;
    if (error || !data || !data.length) return { status: 'ok', data: {} };
    // .order('urutan') saja GLOBAL — urutan di-reset per kategori/Hari (mis.
    // Hari 2 urutan 1 bisa muncul sebelum Hari 1 urutan 7), jadi kategori bisa
    // tercampur. Urutkan ulang per Hari (angka di kategori) lalu urutan —
    // sama seperti fix di konten-module.js & getMutabaahDaurah(Guru).
    data.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var grouped = {};
    data.forEach(function(item) {
      if (!grouped[item.level]) grouped[item.level] = {};
      if (!grouped[item.level][item.kategori]) grouped[item.level][item.kategori] = [];
      grouped[item.level][item.kategori].push(item);
    });
    return { status: 'ok', data: grouped };
  },

  getAssessmentMurid: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('assessment_murid').select('id_item, status').eq('id_murid', id_murid);
    if (error) return { status: 'ok', data: {} };
    var jawaban = {};
    (data || []).forEach(function(r) { jawaban[r.id_item] = r.status; });
    return { status: 'ok', data: jawaban };
  },

  // Penilaian guru per indikator tajwid (status_guru) — BUKAN hasil "verifikasi"
  // atas jawaban self-assessment murid, tapi nilai yang diinput guru langsung
  // saat menutup sesi KBM Daurah (lihat guru/kbm-module.js: _daurahAssessmentMap
  // -> simpanVerifikasiGuru saat "Selesaikan KBM"), persis seperti input
  // nilai/adab/kamera. Dipakai halaman "Mutaba'ah Daurah" murid.
  // RLS "murid_rw_asmt_murid" (FOR ALL, id_murid = current_user_id()) sudah
  // mengizinkan murid membaca kolom ini di barisnya sendiri, tanpa perlu
  // policy baru.
  getPenilaianGuru: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('assessment_murid').select('id_item, status_guru').eq('id_murid', id_murid);
    if (error) return { status: 'ok', data: {} };
    var out = {};
    (data || []).forEach(function(r) { if (r.status_guru) out[r.id_item] = r.status_guru; });
    return { status: 'ok', data: out };
  },

  saveAssessment: async function(d) {
    var id_murid = _uid();
    var jawaban  = d.jawaban || {};
    var rows = Object.keys(jawaban).filter(function(k){ return jawaban[k]; }).map(function(id_item) {
      return { id_murid, id_item, status: jawaban[id_item], updated_at: new Date().toISOString() };
    });
    if (!rows.length) return { status: 'ok' };
    var { error } = await _sb.from('assessment_murid').upsert(rows, { onConflict: 'id_murid,id_item' });
    _check(error, 'saveAssessment');
    return { status: 'ok', message: rows.length + ' jawaban disimpan' };
  },
  changePassword: async function(d) { return Auth.changePassword(d); },
  updateProfil: async function(d) {
    return Auth.updateProfile(d);
  },

  // ── Tahfidz / Setoran Hafalan (Level Qiyam) ──────────────────────────
  // Riwayat setoran milik murid yang login (hanya Level Qiyam via RLS)
  getSetoranHafalan: async function(limit, offset) {
    // BUG-06 fix: client-side guard — cek level murid sebelum fetch
    var { data: angData } = await _sb.from('anggota')
      .select('level').eq('id_murid', _uid()).eq('status', 'aktif').maybeSingle();
    if (!angData || angData.level !== 'Level Qiyam') {
      return { status: 'ok', data: [], total: 0, has_more: false };
    }
    var lim = limit || 10;
    var off = offset || 0;
    // Ambil lim+1 baris untuk deteksi has_more — hindari count:'exact' yang
    // memaksa COUNT(*) terpisah (lambat di PostgREST, apalagi dgn RLS).
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', _uid())
      .order('updated_at', { ascending: false }) // urut per tanggal update (mis. setoran partner naik saat dikonfirmasi)
      .range(off, off + lim);
    _check(error, 'getSetoranHafalan');
    var rows = data || [];
    var hasMore = rows.length > lim;
    if (hasMore) rows = rows.slice(0, lim);
    return { status: 'ok', data: rows, total: null, has_more: hasMore };
  },

  // Raport tahfidz murid sendiri (berdasarkan rentang tanggal)
  getMyRaportTahfidz: async function(tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', _uid())
      .eq('sumber', 'guru') // §3.7: raport resmi hanya hitung setoran guru
      .order('created_at', { ascending: true });
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getMyRaportTahfidz');
    return { status: 'ok', data: data || [] };
  },

  // §3.7: ringkasan aktivitas mandiri bersama partner (sudah dikonfirmasi)
  getMyAktivitasPartner: async function(tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('jenis')
      .eq('id_murid', _uid())
      .eq('sumber', 'partner')
      .eq('status_konfirmasi', 'dikonfirmasi');
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getMyAktivitasPartner');
    var rows = data || [];
    return { status: 'ok', data: {
      ziyadah  : rows.filter(function(r) { return r.jenis === 'Ziyadah'; }).length,
      murajaah : rows.filter(function(r) { return r.jenis === 'Murajaah'; }).length,
    }};
  },

  // ── Kelompok Partner Qiyam ───────────────────────────────────────────
  // Kelompok partner aktif milik murid (beserta anggota)
  getMyKelompokPartner: async function() {
    var { data, error } = await _sb.from('kelompok_partner_qiyam')
      .select('*, anggota_kelompok_partner(*)')
      .eq('status', 'aktif')
      .maybeSingle();
    _check(error, 'getMyKelompokPartner');
    return { status: 'ok', data: data || null };
  },

  // Data Ziyadah milik sendiri (resmi + mandiri yang sudah dikonfirmasi) — validasi range Murajaah (§3.8)
  getZiyadahSaya: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('surat, juz, ayat_dari, ayat_sampai')
      .eq('id_murid', _uid())
      .eq('jenis', 'Ziyadah')
      .or('sumber.eq.guru,and(sumber.eq.partner,status_konfirmasi.eq.dikonfirmasi)');
    _check(error, 'getZiyadahSaya');
    return { status: 'ok', data: data || [] };
  },

  // Input setoran mandiri ke partner (§3.8)
  addSetoranMandiri: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_murid    : _uid(),
      nama_murid  : (user && (user.nama_lengkap || user.nama)) || '',
      id_halaqah  : d.id_halaqah,
      juz         : d.juz ? parseInt(d.juz) : null,
      surat       : d.surat,
      ayat_dari   : parseInt(d.ayat_dari),
      ayat_sampai : parseInt(d.ayat_sampai),
      jenis       : d.jenis,
      catatan     : d.catatan || null,
      sumber      : 'partner',
      status_konfirmasi: 'menunggu',
      nilai       : null,
      lampiran_url: d.lampiran_url || null,
      audio_durasi_detik: d.audio_durasi_detik ? parseInt(d.audio_durasi_detik) : null,
    };
    if (d.tanggal) {
      payload.created_at = new Date(d.tanggal + 'T12:00:00').toISOString();
    }
    var { data, error } = await _sb.from('setoran_hafalan').insert(payload).select().single();
    _check(error, 'addSetoranMandiri');

    // Kirim push notification ke partner sekelompok qiyam
    if (data) {
      (async function() {
        try {
          var { data: memberRow } = await _sb.from('anggota_kelompok_partner')
            .select('id_kelompok')
            .eq('id_murid', _uid())
            .maybeSingle();
          if (memberRow && memberRow.id_kelompok) {
            var { data: partners } = await _sb.from('anggota_kelompok_partner')
              .select('id_murid')
              .eq('id_kelompok', memberRow.id_kelompok)
              .neq('id_murid', _uid());
            var partnerIds = (partners || []).map(function(p) { return p.id_murid; });
            if (partnerIds.length) {
              _sendPushBg({
                user_ids: partnerIds,
                title   : '🕌 Setoran Qiyam Baru',
                body    : payload.nama_murid + ' menyetor hafalan baru: ' + payload.jenis + ' ' + payload.surat + ' Ayat ' + payload.ayat_dari + '-' + payload.ayat_sampai + '. Ketuk untuk menyimak!',
                url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
                tag     : 'partner-qiyam-baru-' + memberRow.id_kelompok,
                data    : { trigger: 'partner_qiyam_baru', id_kelompok: memberRow.id_kelompok }
              });
            }
          }
        } catch(e) {
          console.error('Gagal mengirim push Qiyam ke partner:', e);
        }
      })();
    }

    return { status: 'ok', data };
  },

  // Daftar setoran mandiri partner sekelompok yang menunggu konfirmasi (§3.6 langkah 3)
  getSetoranMenungguKonfirmasi: async function() {
    var { data, error } = await _sb.rpc('get_setoran_menunggu_konfirmasi');
    _check(error, 'getSetoranMenungguKonfirmasi');
    return { status: 'ok', data: data || [] };
  },

  // Konfirmasi setoran mandiri partner + isi kelancaran, catatan & reaksi
  konfirmasiSetoranPartner: async function(id_setoran, kelancaran, catatan_partner, reaksi_partner) {
    var logData = null;
    try {
      var { data } = await _sb.from('setoran_hafalan')
        .select('id_murid, jenis, surat, ayat_dari, ayat_sampai')
        .eq('id_setoran', id_setoran)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('konfirmasi_setoran_partner', {
      p_id_setoran      : id_setoran,
      p_kelancaran      : kelancaran,
      p_catatan_partner : catatan_partner || null,
      p_reaksi_partner  : reaksi_partner || null,
    });
    _check(error, 'konfirmasiSetoranPartner');

    if (logData && logData.id_murid) {
      var partnerUser = _currentUser || {};
      var partnerNama = (partnerUser && (partnerUser.nama_lengkap || partnerUser.nama)) || 'Partner';
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Setoran Dikonfirmasi',
        body    : 'Setoran "' + logData.jenis + ' ' + logData.surat + ' Ayat ' + logData.ayat_dari + '-' + logData.ayat_sampai + '" kamu telah dikonfirmasi oleh ' + partnerNama + '!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
        tag     : 'partner-qiyam-konf-' + id_setoran,
        data    : { trigger: 'partner_qiyam_konf', id_setoran: id_setoran }
      });
    }

    return { status: 'ok' };
  },

  // Tanggal setoran mandiri terakhir tiap anggota kelompok — kartu status pasif (§5.7)
  getStatusKelompokPartner: async function() {
    var { data, error } = await _sb.rpc('get_status_kelompok_partner');
    _check(error, 'getStatusKelompokPartner');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok (Fase 3) — auto-feed setoran + milestone manual ──
  // Feed setoran partner yang sudah dikonfirmasi (anggota kelompok sendiri)
  getLiniMasaSetoran: async function() {
    var { data, error } = await _sb.rpc('get_lini_masa_setoran', { p_id_kelompok: null });
    _check(error, 'getLiniMasaSetoran');
    return { status: 'ok', data: data || [] };
  },
  // Milestone manual kelompok sendiri (RLS membatasi ke kelompok murid)
  getMyMilestones: async function() {
    var { data, error } = await _sb.from('milestone_kelompok_partner')
      .select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMyMilestones');
    return { status: 'ok', data: data || [] };
  },
  addMilestone: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('milestone_kelompok_partner').insert(payload).select().single();
    _check(error, 'addMilestone');
    return { status: 'ok', data: data };
  },
  deleteMilestone: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_partner').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestone');
    return { status: 'ok' };
  },

  // #2 Batalkan / edit setoran mandiri yang masih 'menunggu'
  deleteSetoranMandiri: async function(id_setoran) {
    var { error } = await _sb.from('setoran_hafalan').delete()
      .eq('id_setoran', id_setoran).eq('id_murid', _uid())
      .eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu');
    _check(error, 'deleteSetoranMandiri');
    return { status: 'ok' };
  },
  updateSetoranMandiri: async function(id_setoran, d) {
    var payload = {};
    if (d.jenis      !== undefined) payload.jenis      = d.jenis;
    if (d.surat      !== undefined) payload.surat      = d.surat;
    if (d.juz        !== undefined) payload.juz        = d.juz ? parseInt(d.juz) : null;
    if (d.ayat_dari  !== undefined) payload.ayat_dari  = parseInt(d.ayat_dari);
    if (d.ayat_sampai!== undefined) payload.ayat_sampai= parseInt(d.ayat_sampai);
    if (d.catatan    !== undefined) payload.catatan    = d.catatan || null;
    if (d.lampiran_url !== undefined) payload.lampiran_url = d.lampiran_url || null;
    if (d.audio_durasi_detik !== undefined) payload.audio_durasi_detik = d.audio_durasi_detik ? parseInt(d.audio_durasi_detik) : null;
    var { error } = await _sb.from('setoran_hafalan').update(payload)
      .eq('id_setoran', id_setoran).eq('id_murid', _uid())
      .eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu');
    _check(error, 'updateSetoranMandiri');
    return { status: 'ok' };
  },

  // #1 Data untuk Saran Muraja'ah (semua setoran sendiri yang sah, ringkas)
  getSetoranRingkasSaya: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('surat, juz, jenis, sumber, status_konfirmasi, ayat_dari, ayat_sampai, created_at')
      .eq('id_murid', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getSetoranRingkasSaya');
    return { status: 'ok', data: data || [] };
  },

  // #4 Target bersama kelompok (murid) — beserta progres konsensus tiap anggota.
  // Resilient: bila tabel/relasi target_partner_progress belum ada (migration 021
  // belum dideploy), fallback ke select biasa agar kartu target tetap hidup.
  getTargetKelompok: async function() {
    var res = await _sb.from('target_kelompok_partner')
      .select('*, target_partner_progress(id_murid, nama_murid, selesai_at)')
      .order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_partner')
        .select('*').order('created_at', { ascending: false });
      _check(fb.error, 'getTargetKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  // Konsensus: tandai/batalkan progres target Qiyam untuk diri sendiri.
  tandaiProgressTargetPartner: async function(id_target, selesai) {
    var { error } = await _sb.rpc('tandai_progress_target_partner', {
      p_id_target: id_target, p_selesai: !!selesai,
    });
    _check(error, 'tandaiProgressTargetPartner');
    return { status: 'ok' };
  },
  addTargetKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('target_kelompok_partner').insert(payload).select().single();
    _check(error, 'addTargetKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetKelompok: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_partner').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetKelompok');
    return { status: 'ok' };
  },
  deleteTargetKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_partner').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetKelompok');
    return { status: 'ok' };
  },

  // ── Kelompok Partner Belajar (Level 1-4, non-Qiyam) ──────────────────
  // Kelompok belajar aktif milik murid (beserta anggota)
  getMyKelompokBelajar: async function() {
    var { data, error } = await _sb.from('kelompok_partner_belajar')
      .select('*, anggota_kelompok_belajar(*)')
      .eq('status', 'aktif')
      .maybeSingle();
    _check(error, 'getMyKelompokBelajar');
    return { status: 'ok', data: data || null };
  },

  // Lapor aktivitas belajar mandiri
  addLogBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok    : d.id_kelompok,
      id_halaqah     : d.id_halaqah,
      id_murid       : _uid(),
      nama_murid     : (user && (user.nama_lengkap || user.nama)) || '',
      jenis_aktivitas: d.jenis_aktivitas,
      deskripsi      : d.deskripsi || null,
      durasi_menit   : d.durasi_menit ? parseInt(d.durasi_menit) : null,
      status_konfirmasi: 'menunggu',
      kelancaran     : null,
    };
    if (d.tanggal) payload.tanggal = d.tanggal;
    var { data, error } = await _sb.from('log_belajar_mandiri').insert(payload).select().single();
    _check(error, 'addLogBelajar');

    // Kirim push notification ke partner sekelompok
    if (data && d.id_kelompok) {
      (async function() {
        try {
          var { data: partners } = await _sb.from('anggota_kelompok_belajar')
            .select('id_murid')
            .eq('id_kelompok', d.id_kelompok)
            .neq('id_murid', _uid());
          var partnerIds = (partners || []).map(function(p) { return p.id_murid; });
          if (partnerIds.length) {
            _sendPushBg({
              user_ids: partnerIds,
              title   : '📝 Laporan Belajar Baru',
              body    : payload.nama_murid + ' melaporkan aktivitas belajar baru: "' + payload.jenis_aktivitas + '". Ketuk untuk memberikan konfirmasi!',
              url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
              tag     : 'partner-belajar-baru-' + d.id_kelompok,
              data    : { trigger: 'partner_belajar_baru', id_kelompok: d.id_kelompok }
            });
          }
        } catch(e) {
          console.error('Gagal mengirim push ke partner:', e);
        }
      })();
    }

    return { status: 'ok', data: data };
  },

  // Daftar aktivitas partner sekelompok yang menunggu konfirmasi
  getLogMenungguKonfirmasi: async function() {
    var { data, error } = await _sb.rpc('get_log_menunggu_konfirmasi');
    _check(error, 'getLogMenungguKonfirmasi');
    return { status: 'ok', data: data || [] };
  },

  // Konfirmasi aktivitas partner + isi kelancaran, catatan & reaksi
  konfirmasiLogBelajar: async function(id_log, kelancaran, catatan_partner, reaksi_partner) {
    var logData = null;
    try {
      var { data } = await _sb.from('log_belajar_mandiri')
        .select('id_murid, jenis_aktivitas')
        .eq('id_log', id_log)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('konfirmasi_log_belajar', {
      p_id_log          : id_log,
      p_kelancaran      : kelancaran,
      p_catatan_partner : catatan_partner || null,
      p_reaksi_partner  : reaksi_partner || null,
    });
    _check(error, 'konfirmasiLogBelajar');

    if (logData && logData.id_murid) {
      var partnerUser = _currentUser || {};
      var partnerNama = (partnerUser && (partnerUser.nama_lengkap || partnerUser.nama)) || 'Partner';
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Laporan Dikonfirmasi',
        body    : 'Aktivitas "' + logData.jenis_aktivitas + '" kamu telah dikonfirmasi oleh ' + partnerNama + '!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
        tag     : 'partner-belajar-konf-' + id_log,
        data    : { trigger: 'partner_belajar_konf', id_log: id_log }
      });
    }

    return { status: 'ok' };
  },

  // Tanggal aktivitas terakhir tiap anggota kelompok — kartu status pasif
  getStatusKelompokBelajar: async function() {
    var { data, error } = await _sb.rpc('get_status_kelompok_belajar');
    _check(error, 'getStatusKelompokBelajar');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok — auto-feed aktivitas + milestone manual ──
  getLiniMasaBelajar: async function() {
    var { data, error } = await _sb.rpc('get_lini_masa_belajar', { p_id_kelompok: null });
    _check(error, 'getLiniMasaBelajar');
    return { status: 'ok', data: data || [] };
  },
  // Milestone manual kelompok sendiri (RLS membatasi ke kelompok murid)
  getMyMilestonesBelajar: async function() {
    var { data, error } = await _sb.from('milestone_kelompok_belajar')
      .select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMyMilestonesBelajar');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('milestone_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addMilestoneBelajar');
    return { status: 'ok', data: data };
  },
  deleteMilestoneBelajar: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_belajar').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneBelajar');
    return { status: 'ok' };
  },

  // Batalkan / edit aktivitas mandiri yang masih 'menunggu'
  deleteLogBelajar: async function(id_log) {
    var { error } = await _sb.from('log_belajar_mandiri').delete()
      .eq('id_log', id_log).eq('id_murid', _uid()).eq('status_konfirmasi', 'menunggu');
    _check(error, 'deleteLogBelajar');
    return { status: 'ok' };
  },
  updateLogBelajar: async function(id_log, d) {
    var payload = {};
    if (d.jenis_aktivitas !== undefined) payload.jenis_aktivitas = d.jenis_aktivitas;
    if (d.deskripsi       !== undefined) payload.deskripsi       = d.deskripsi || null;
    if (d.durasi_menit    !== undefined) payload.durasi_menit    = d.durasi_menit ? parseInt(d.durasi_menit) : null;
    if (d.tanggal         !== undefined) payload.tanggal         = d.tanggal;
    var { error } = await _sb.from('log_belajar_mandiri').update(payload)
      .eq('id_log', id_log).eq('id_murid', _uid()).eq('status_konfirmasi', 'menunggu');
    _check(error, 'updateLogBelajar');
    return { status: 'ok' };
  },

  // Riwayat aktivitas sendiri (semua status) — data utk Riwayat & "aktivitas tertunda"
  getLogRingkasSaya: async function() {
    var { data, error } = await _sb.from('log_belajar_mandiri')
      .select('id_log, jenis_aktivitas, deskripsi, durasi_menit, tanggal, status_konfirmasi, kelancaran, catatan_partner, reaksi_partner, created_at, updated_at')
      .eq('id_murid', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getLogRingkasSaya');
    return { status: 'ok', data: data || [] };
  },

  // Target bersama kelompok (murid) — beserta progres konsensus tiap anggota.
  // Resilient: bila tabel/relasi target_belajar_progress belum ada (migration
  // belum dideploy), fallback ke select biasa agar kartu target tetap hidup.
  getTargetKelompokBelajar: async function() {
    var res = await _sb.from('target_kelompok_belajar')
      .select('*, target_belajar_progress(id_murid, nama_murid, selesai_at)')
      .order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_belajar')
        .select('*').order('created_at', { ascending: false });
      _check(fb.error, 'getTargetKelompokBelajar');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  // Konsensus: tandai/batalkan progres target untuk diri sendiri.
  // selesai=true menandai; false membatalkan. Status target dihitung ulang
  // server-side -> 'tercapai' hanya bila SEMUA anggota aktif menandai.
  tandaiProgressTargetBelajar: async function(id_target, selesai) {
    var { error } = await _sb.rpc('tandai_progress_target_belajar', {
      p_id_target: id_target, p_selesai: !!selesai,
    });
    _check(error, 'tandaiProgressTargetBelajar');
    return { status: 'ok' };
  },
  addTargetKelompokBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('target_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addTargetKelompokBelajar');
    return { status: 'ok', data: data };
  },
  updateTargetKelompokBelajar: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_belajar').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetKelompokBelajar');
    return { status: 'ok' };
  },
  deleteTargetKelompokBelajar: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_belajar').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetKelompokBelajar');
    return { status: 'ok' };
  },

  // Target hafalan berikutnya (setoran terbaru yang punya target_surat)
  getTargetHafalan: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('target_surat, target_ayat_dari, target_ayat_sampai, nama_guru, created_at')
      .eq('id_murid', _uid())
      .not('target_surat', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    _check(error, 'getTargetHafalan');
    return { status: 'ok', data: data || null };
  },

  // ── CHARGING (catatan penyemangat pribadi) ──
  getChargingNotes: async function() {
    var { data, error } = await _sb.from('charging_notes')
      .select('*')
      .eq('id_user', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getChargingNotes');
    return { status: 'ok', data: data || [] };
  },

  saveChargingNote: async function(d) {
    var payload = {
      id_user : _uid(),
      content : d.content,
      category: d.category,
      color   : d.color,
      updated_at: new Date().toISOString(),
    };
    var query;
    if (d.id_note) {
      query = _sb.from('charging_notes').update(payload).eq('id_note', d.id_note).eq('id_user', _uid()).select();
    } else {
      query = _sb.from('charging_notes').insert(payload).select();
    }
    var { data, error } = await query;
    _check(error, 'saveChargingNote');
    return { status: 'ok', data: data };
  },

  deleteChargingNote: async function(id_note) {
    var { error } = await _sb.from('charging_notes').delete().eq('id_note', id_note).eq('id_user', _uid());
    _check(error, 'deleteChargingNote');
    return { status: 'ok' };
  },

  kirimSaranMasukan: async function(d) {
    var id_murid = _uid();
    var user = _currentUser || {};
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid',id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah || null;
    
    var row = {
      id_murid: d.is_anonymous ? null : id_murid,
      nama_pengirim: d.is_anonymous ? null : (user.nama_lengkap || user.nama || ''),
      kategori_utama: d.kategori_utama,
      sub_kategori: d.sub_kategori,
      id_halaqah: d.kategori_utama === 'program' ? id_halaqah : null,
      rating_guru: d.rating_guru || null,
      rating_materi: d.rating_materi || null,
      isi_masukan: d.isi_masukan,
      is_anonymous: !!d.is_anonymous,
      status: 'pending'
    };
    
    var { error } = await _sb.from('saran_masukan').insert([row]);
    _check(error, 'kirimSaranMasukan');
    return { status: 'ok', message: 'Bismillah, masukan Anda telah terkirim!' };
  },

  kirimSaran: async function(d) {
    return this.kirimSaranMasukan(d);
  },

  getRiwayatSaran: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('saran_masukan')
      .select('*')
      .eq('id_murid', id_murid)
      .order('created_at', { ascending: false });
    _check(error, 'getRiwayatSaran');
    return { status: 'ok', data: data || [] };
  },

  // ── Quiz Murid ─────────────────────────────
  getKuisTersedia: async function() {
    var id_murid = _uid();
    var { data: anggotaData, error: aErr } = await _sb.from('anggota')
      .select('id_halaqah').eq('id_murid', id_murid).eq('status', 'aktif');
    _check(aErr, 'getKuisTersedia:anggota');

    if (!anggotaData || anggotaData.length === 0) return { status: 'ok', data: [] };

    var halaqahIds = anggotaData.map(function(a) { return a.id_halaqah; });

    var { data: qhData, error: qhErr } = await _sb.from('quiz_halaqah')
      .select('id_quiz, quiz(*)')
      .in('id_halaqah', halaqahIds);
    _check(qhErr, 'getKuisTersedia:quiz_halaqah');

    var today = _todayJakarta();
    var kuisList = (qhData || [])
      .map(function(qh) { return qh.quiz; })
      .filter(function(q) {
        if (!q || q.status !== 'aktif') return false;
        if (q.tgl_mulai && q.tgl_mulai > today) return false;
        if (q.tgl_selesai && q.tgl_selesai < today) return false;
        return true;
      });

    if (kuisList.length === 0) return { status: 'ok', data: [] };

    var quizIds = kuisList.map(function(q) { return q.id_quiz; });
    var { data: hasilData } = await _sb.from('hasil_quiz')
      .select('*').eq('id_murid', id_murid).in('id_quiz', quizIds);

    var hasilMap = {};
    (hasilData || []).forEach(function(h) {
      if (!hasilMap[h.id_quiz] || h.skor_total > hasilMap[h.id_quiz].skor_total) {
        hasilMap[h.id_quiz] = h;
      }
    });

    var result = kuisList.map(function(q) {
      var h = hasilMap[q.id_quiz] || null;
      return Object.assign({}, q, {
        sudah_dikerjakan: !!h,
        hasil_terbaik: h
      });
    });

    return { status: 'ok', data: result };
  },

  getKuisDetail: async function(id_quiz) {
    var { data: quizData, error: qErr } = await _sb.from('quiz')
      .select('*, quiz_soal(urutan, bobot_poin, durasi_detik_override, soal(*, soal_pilihan(id_pilihan, teks_pilihan, urutan), soal_pasangan(id_pasangan, teks_kiri, teks_kanan, urutan)))')
      .eq('id_quiz', id_quiz).single();
    _check(qErr, 'getKuisDetail');

    var soalList = (quizData.quiz_soal || []).map(function(qs) {
      var s = qs.soal;
      if (!s) return null;
      var pilihan = (s.soal_pilihan || []).map(function(p) {
        return { id_pilihan: p.id_pilihan, teks_pilihan: p.teks_pilihan, urutan: p.urutan };
      });
      var pasangan = s.soal_pasangan || [];
      if (s.tipe_soal === 'matching') {
        var kananShuffled = pasangan.map(function(p) { return p.teks_kanan; }).sort(function() { return Math.random() - 0.5; });
        pasangan = pasangan.map(function(p, idx) {
          return { id_pasangan: p.id_pasangan, teks_kiri: p.teks_kiri, opsi_kanan: kananShuffled };
        });
      }
      return {
        id_soal: s.id_soal,
        tipe_soal: s.tipe_soal,
        teks_soal: s.teks_soal,
        teks_arab: s.teks_arab,
        highlight_markup: s.highlight_markup,
        audio_url: s.audio_url,
        audio_tipe: s.audio_tipe,
        urutan: qs.urutan,
        bobot_poin: qs.bobot_poin,
        durasi_detik: (qs.durasi_detik_override !== null && qs.durasi_detik_override !== undefined && qs.durasi_detik_override > 0) ? qs.durasi_detik_override : (quizData.durasi_per_soal_detik || 0),
        pilihan: pilihan,
        pasangan: pasangan
      };
    }).filter(Boolean);

    soalList.sort(function(a, b) { return a.urutan - b.urutan; });

    if (quizData.urutan_soal === 'acak') {
      soalList.sort(function() { return Math.random() - 0.5; });
    }

    return {
      status: 'ok',
      data: {
        id_quiz: quizData.id_quiz,
        judul: quizData.judul,
        deskripsi: quizData.deskripsi,
        mode: quizData.mode,
        durasi_per_soal_detik: quizData.durasi_per_soal_detik,
        tampilkan_jawaban: quizData.tampilkan_jawaban,
        boleh_retake: quizData.boleh_retake,
        anti_tab_aktif: quizData.anti_tab_aktif,
        maks_peringatan_tab: quizData.maks_peringatan_tab,
        soal: soalList
      }
    };
  },

  jawabSoal: async function(payload) {
    var { data, error } = await _sb.rpc('jawab_soal', {
      p_id_quiz: payload.id_quiz,
      p_id_soal: payload.id_soal,
      p_attempt_ke: payload.attempt_ke || 1,
      p_id_pilihan: payload.id_pilihan || null,
      p_matching_json: payload.matching_json || null,
      p_teks_isian: payload.teks_isian || null,
      p_waktu_detik: payload.waktu_detik || null
    });
    _check(error, 'jawabSoal');
    return { status: 'ok', data: data };
  },

  submitKuis: async function(payload) {
    var { error } = await _sb.rpc('submit_quiz', {
      p_id_quiz: payload.id_quiz,
      p_attempt_ke: payload.attempt_ke || 1,
      p_durasi_pengerjaan_detik: payload.durasi_pengerjaan_detik || null,
      p_jumlah_tab_switch: payload.jumlah_tab_switch || 0,
      p_total_durasi_keluar_detik: payload.total_durasi_keluar_detik || 0
    });
    _check(error, 'submitKuis');
    return { status: 'ok' };
  },

  getHasilKuisMurid: async function(id_quiz, attempt_ke) {
    var id_murid = _uid();
    var attempt = attempt_ke || 1;
    var [hasilRes, jawabanRes, quizRes, snapRes] = await Promise.all([
      _sb.from('hasil_quiz').select('*').eq('id_quiz', id_quiz).eq('id_murid', id_murid).eq('attempt_ke', attempt).single(),
      _sb.from('jawaban_murid').select('*, soal(*, soal_pilihan(*), soal_pasangan(*))').eq('id_quiz', id_quiz).eq('id_murid', id_murid).eq('attempt_ke', attempt),
      _sb.from('quiz').select('tampilkan_jawaban').eq('id_quiz', id_quiz).single(),
      _sb.from('quiz_soal').select(_SNAP_COLS).eq('id_quiz', id_quiz)
    ]);
    _check(hasilRes.error, 'getHasilKuisMurid:hasil');

    var quizSetting = quizRes.data ? quizRes.data.tampilkan_jawaban : 'setelah_submit';

    // PATCH 066/067: tampilkan konten soal beku (snapshot) alih-alih Bank Soal live.
    var _snapMap = {};
    (snapRes.data || []).forEach(function (r) { _snapMap[r.id_soal] = r; });
    var jawaban = jawabanRes.data || [];
    jawaban.forEach(function (j) { _overrideSoalFromSnap(j.soal, _snapMap[j.id_soal]); });

    return {
      status: 'ok',
      hasil: hasilRes.data,
      jawaban: jawaban,
      tampilkan_jawaban_setting: quizSetting
    };
  },

  getRiwayatKuisMurid: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('hasil_quiz')
      .select('*, quiz(id_quiz, judul, deskripsi, kategori, durasi_per_soal_detik, tampilkan_jawaban)')
      .eq('id_murid', id_murid)
      .order('submitted_at', { ascending: false });
    _check(error, 'getRiwayatKuisMurid');
    return { status: 'ok', data: data || [] };
  },

  getLeaderboardKuis: async function(id_quiz) {
    var { data, error } = await _sb.from('hasil_quiz')
      .select('id_hasil, skor_total, durasi_pengerjaan_detik, attempt_ke, submitted_at, users!hasil_quiz_id_murid_fkey(id_user, nama_lengkap, status)')
      .eq('id_quiz', id_quiz)
      .order('skor_total', { ascending: false })
      .order('durasi_pengerjaan_detik', { ascending: true });

    _check(error, 'getLeaderboardKuis');

    var seenMurid = {};
    var leaderboard = [];
    (data || []).forEach(function(h) {
      if (!h.users || h.users.status !== 'aktif') return;
      if (!seenMurid[h.users.id_user]) {
        seenMurid[h.users.id_user] = true;
        leaderboard.push({
          id_murid: h.users.id_user,
          nama_lengkap: h.users.nama_lengkap,
          skor_total: h.skor_total,
          durasi_pengerjaan_detik: h.durasi_pengerjaan_detik,
          attempt_ke: h.attempt_ke
        });
      }
    });

    return { status: 'ok', data: leaderboard };
  },

  joinSesiLive: async function(kode_join) {
    var { data, error } = await _sb.rpc('join_sesi_live', { p_kode: kode_join });
    _check(error, 'joinSesiLive');
    return { status: 'ok', data: data };
  },

  // ── Maze Adventure (gamifikasi; patch_069) ─────────────
  // GERBANG "nebeng quiz" (mirror getKuisTersedia): level yang ditautkan ke quiz
  // (id_kuis) hanya muncul kalau quiz itu DITUGASKAN ke halaqah murid + status
  // 'aktif' + hari ini di rentang tgl_mulai..tgl_selesai. Level tanpa id_kuis =
  // latihan bebas (selalu tampil). Jadi murid main soal-terhubung hanya setelah
  // guru menugaskan quiz-nya — sama seperti quiz biasa.
  getMazeLevels: async function() {
    var id_murid = _uid();
    // select('*') agar AMAN sebelum/sesudah patch_070 (kolom target_levels/
    // rekomendasi_pertemuan_ke belum ada → undefined → levelOk() = tak menyaring).
    var { data: levels, error } = await _sb.from('maze_level')
      .select('*')
      .eq('aktif', true)
      .order('urutan', { ascending: true });
    _check(error, 'getMazeLevels');
    levels = levels || [];
    if (!levels.length) return { status: 'ok', data: [] };

    // Halaqah + level murid ini (dipakai gerbang quiz DAN filter target_levels)
    var halaqahIds = [], muridLevels = {};
    if (id_murid) {
      var { data: anggotaData } = await _sb.from('anggota')
        .select('id_halaqah, halaqah(level)')
        .eq('id_murid', id_murid).eq('status', 'aktif');
      (anggotaData || []).forEach(function(a){
        halaqahIds.push(a.id_halaqah);
        if (a.halaqah && a.halaqah.level) muridLevels[a.halaqah.level] = true;
      });
    }

    // Quiz yang tersedia untuk murid ini (aturan sama persis dgn quiz)
    var kuisIds = Array.from(new Set(levels.map(function(l){ return l.id_kuis; }).filter(Boolean)));
    var available = {};
    if (kuisIds.length && halaqahIds.length) {
      var { data: qhData } = await _sb.from('quiz_halaqah')
        .select('id_quiz, quiz(id_quiz, status, tgl_mulai, tgl_selesai)')
        .in('id_halaqah', halaqahIds)
        .in('id_quiz', kuisIds);
      var today = _todayJakarta();
      (qhData || []).forEach(function(qh){
        var q = qh.quiz;
        if (!q || q.status !== 'aktif') return;
        if (q.tgl_mulai && q.tgl_mulai > today) return;
        if (q.tgl_selesai && q.tgl_selesai < today) return;
        available[q.id_quiz] = true;
      });
    }

    var halaqahSet = {}; halaqahIds.forEach(function(h){ halaqahSet[h] = true; });

    // Audiens (prioritas paling spesifik): target_halaqah (guru, per-halaqah) >
    // target_levels (admin, per-level) > penugasan quiz (nebeng quiz) > semua.
    function anyIn(arr, set){ for (var i = 0; i < (arr ? arr.length : 0); i++) if (set[arr[i]]) return true; return false; }
    function visible(l){
      if (l.target_halaqah && l.target_halaqah.length) return anyIn(l.target_halaqah, halaqahSet);
      if (l.target_levels && l.target_levels.length)   return anyIn(l.target_levels, muridLevels);
      return !l.id_kuis || available[l.id_kuis];
    }

    var data = levels
      .filter(visible)
      .map(function(l){ return Object.assign({}, l, { ditugaskan: !!l.id_kuis }); });
    return { status: 'ok', data: data };
  },

  // Soal maze via RPC TERPISAH (termasuk is_benar utk feedback instan; aman karena
  // maze nol bobot akademik). JANGAN pakai getKuisDetail (sengaja sembunyikan is_benar).
  getMazeSoal: async function(id_maze_level) {
    var { data, error } = await _sb.rpc('get_maze_soal', { p_id_maze_level: id_maze_level });
    _check(error, 'getMazeSoal');
    return { status: 'ok', data: data || [] };
  },

  // Simpan progress (RPC upsert skor-terbaik). Mengembalikan baris tersimpan sebagai
  // KONFIRMASI (hindari "RLS 0-row silent"): pemanggil wajib cek data != null.
  simpanMazeProgress: async function(payload) {
    var { data, error } = await _sb.rpc('simpan_maze_progress', {
      p_id_maze_level: payload.id_maze_level,
      p_score:         payload.score || 0,
      p_best_time_ms:  (payload.best_time_ms != null ? payload.best_time_ms : null),
      p_nyawa_sisa:    (payload.nyawa_sisa != null ? payload.nyawa_sisa : null),
      p_completed:     !!payload.completed,
      p_badges:        payload.badges || [],
      p_soal_snapshot: payload.soal_snapshot || null
    });
    _check(error, 'simpanMazeProgress');
    if (!data) throw new Error('simpanMazeProgress: baris tidak tersimpan (progress kosong)');
    return { status: 'ok', data: data };
  },

  // Baca progress maze milik murid ini (RLS: hanya baris sendiri).
  getMazeProgress: async function() {
    var { data, error } = await _sb.from('maze_progress')
      .select('id_maze_level, score, best_time_ms, nyawa_sisa, completed, badges, updated_at, maze_level(nama_level)')
      .order('updated_at', { ascending: false });
    _check(error, 'getMazeProgress');
    return { status: 'ok', data: data || [] };
  },

  // ── Rattil Run (murid) — gerbang akses IDENTIK Maze: target_halaqah > target_levels > quiz ──
  getRunLevels: async function() {
    var id_murid = _uid();
    // select('*') agar aman terhadap perubahan kolom (kolom baru → undefined → tak menyaring).
    var { data: levels, error } = await _sb.from('run_level')
      .select('*')
      .eq('aktif', true)
      .order('urutan', { ascending: true });
    _check(error, 'getRunLevels');
    levels = levels || [];
    if (!levels.length) return { status: 'ok', data: [] };

    // Halaqah + level murid ini (dipakai gerbang quiz DAN filter target_levels)
    var halaqahIds = [], muridLevels = {};
    if (id_murid) {
      var { data: anggotaData } = await _sb.from('anggota')
        .select('id_halaqah, halaqah(level)')
        .eq('id_murid', id_murid).eq('status', 'aktif');
      (anggotaData || []).forEach(function(a){
        halaqahIds.push(a.id_halaqah);
        if (a.halaqah && a.halaqah.level) muridLevels[a.halaqah.level] = true;
      });
    }

    // Quiz yang tersedia untuk murid ini (aturan sama persis dgn quiz)
    var kuisIds = Array.from(new Set(levels.map(function(l){ return l.id_kuis; }).filter(Boolean)));
    var available = {};
    if (kuisIds.length && halaqahIds.length) {
      var { data: qhData } = await _sb.from('quiz_halaqah')
        .select('id_quiz, quiz(id_quiz, status, tgl_mulai, tgl_selesai)')
        .in('id_halaqah', halaqahIds)
        .in('id_quiz', kuisIds);
      var today = _todayJakarta();
      (qhData || []).forEach(function(qh){
        var q = qh.quiz;
        if (!q || q.status !== 'aktif') return;
        if (q.tgl_mulai && q.tgl_mulai > today) return;
        if (q.tgl_selesai && q.tgl_selesai < today) return;
        available[q.id_quiz] = true;
      });
    }

    var halaqahSet = {}; halaqahIds.forEach(function(h){ halaqahSet[h] = true; });
    function anyIn(arr, set){ for (var i = 0; i < (arr ? arr.length : 0); i++) if (set[arr[i]]) return true; return false; }
    function visible(l){
      if (l.target_halaqah && l.target_halaqah.length) return anyIn(l.target_halaqah, halaqahSet);
      if (l.target_levels && l.target_levels.length)   return anyIn(l.target_levels, muridLevels);
      return !l.id_kuis || available[l.id_kuis];
    }

    var data = levels
      .filter(visible)
      .map(function(l){ return Object.assign({}, l, { ditugaskan: !!l.id_kuis }); });
    return { status: 'ok', data: data };
  },

  // Soal Run via RPC TERPISAH (termasuk is_benar utk feedback instan; aman krn Run nol bobot akademik).
  getRunSoal: async function(id_run_level) {
    var { data, error } = await _sb.rpc('get_run_soal', { p_id_run_level: id_run_level });
    _check(error, 'getRunSoal');
    return { status: 'ok', data: data || [] };
  },

  // Simpan progress Run (RPC upsert nilai-terbaik). Kembalikan baris tersimpan sbg KONFIRMASI.
  simpanRunProgress: async function(payload) {
    var { data, error } = await _sb.rpc('simpan_run_progress', {
      p_id_run_level:  payload.id_run_level,
      p_score:         payload.score || 0,
      p_best_distance: (payload.best_distance != null ? payload.best_distance : null),
      p_jml_benar:     (payload.jml_benar != null ? payload.jml_benar : null),
      p_nyawa_sisa:    (payload.nyawa_sisa != null ? payload.nyawa_sisa : null),
      p_completed:     !!payload.completed,
      p_badges:        payload.badges || [],
      p_soal_snapshot: payload.soal_snapshot || null
    });
    _check(error, 'simpanRunProgress');
    if (!data) throw new Error('simpanRunProgress: baris tidak tersimpan (progress kosong)');
    return { status: 'ok', data: data };
  },

  // Baca progress Run milik murid ini (RLS: hanya baris sendiri).
  getRunProgress: async function() {
    var { data, error } = await _sb.from('run_progress')
      .select('id_run_level, score, best_distance, jml_benar, nyawa_sisa, completed, badges, updated_at, run_level(nama_level)')
      .order('updated_at', { ascending: false });
    _check(error, 'getRunProgress');
    return { status: 'ok', data: data || [] };
  },
};

// ─────────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────────
var AdminAPI = {
  getDashboard: async function() {
    var bulanIni = _localDate().slice(0,7)+'-01';
    var bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var namaBulanIni = bulanIndo[new Date().getMonth()];
    var tahunIni = new Date().getFullYear();
    var tujuhHariLalu = _localDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    var [
      usersRes, hqRes, kbmBulanRes, periodeRes, nilaiRes, anggotaRes, kbmSesiRes, raportRes,
      saranRes, sppPendingRes, kbmAllRes, sppBulanIniRes, anggotaTipeRes, kbmPekanRes
    ] = await Promise.all([
      _sb.from('users').select('role').eq('status','aktif'),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, level').eq('status','aktif'),
      _sb.from('kbm_log').select('id_kbm',{count:'exact',head:true}).eq('status','selesai').gte('tanggal_pertemuan', bulanIni),
      _sb.from('periode').select('id_periode, nama_periode').eq('status','aktif').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      _sb.from('nilai_kbm').select('id_halaqah, status_hadir'),
      _sb.from('anggota').select('id_halaqah').eq('status','aktif'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai'),
      _sb.from('raport').select('id_halaqah, nilai_akhir').not('nilai_akhir','is',null),
      _sb.from('saran_masukan').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      _sb.from('spp_pembayaran').select('*').eq('status', 'menunggu'),
      _sb.from('kbm_log').select('id_halaqah, jenis_sesi, status, is_pengganti').in('status', ['selesai', 'libur']),
      _sb.from('spp_pembayaran').select('jenis, nominal, metode_bayar').eq('tahun', tahunIni).eq('bulan', namaBulanIni).eq('status', 'lunas'),
      _sb.from('anggota').select('tipe_spp').eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai').gte('tanggal_pertemuan', tujuhHariLalu),
    ]);

    var roles = {};
    (usersRes.data||[]).forEach(function(u){roles[u.role]=(roles[u.role]||0)+1;});
    // Aggregate per halaqah
    var anggotaMap={}, nilaiMap={}, sesiMap={}, raportMap={};
    (anggotaRes.data||[]).forEach(function(a){ anggotaMap[a.id_halaqah]=(anggotaMap[a.id_halaqah]||0)+1; });
    (nilaiRes.data||[]).forEach(function(n){
      if (!nilaiMap[n.id_halaqah]) nilaiMap[n.id_halaqah]={hadir:0,total:0};
      nilaiMap[n.id_halaqah].total++;
      if (['H','T'].includes(n.status_hadir)) nilaiMap[n.id_halaqah].hadir++;
    });
    (kbmSesiRes.data||[]).forEach(function(k){ sesiMap[k.id_halaqah]=(sesiMap[k.id_halaqah]||0)+1; });
    (raportRes.data||[]).forEach(function(r){
      if (!raportMap[r.id_halaqah]) raportMap[r.id_halaqah]={sum:0,count:0};
      raportMap[r.id_halaqah].sum+=Number(r.nilai_akhir||0);
      raportMap[r.id_halaqah].count++;
    });
    var totalNilaiIsi = (nilaiRes.data||[]).filter(function(n){return n.status_hadir;}).length;
    var totalAnggota  = (anggotaRes.data||[]).length;
    var halaqah = (hqRes.data||[]).map(function(h) {
      var nm = nilaiMap[h.id_halaqah]||{hadir:0,total:0};
      var rm = raportMap[h.id_halaqah]||{sum:0,count:0};
      return {
        nama_halaqah: h.nama_halaqah, nama_guru: h.nama_guru, level: h.level, id_halaqah: h.id_halaqah,
        total_murid: anggotaMap[h.id_halaqah]||0,
        total_sesi : sesiMap[h.id_halaqah]||0,
        avg_nilai  : rm.count>0 ? Math.round(rm.sum/rm.count) : 0,
        pct_hadir  : nm.total>0 ? Math.round(nm.hadir/nm.total*100) : 0,
      };
    });

    // 1. Saran Pending Count
    var saranPendingCount = saranRes.count || 0;

    // 2. SPP Pending Count (saring expired)
    var sppPendingCount = (sppPendingRes.data || []).filter(function(r) { return !_sppGatewayExpired(r); }).length;

    // 3. Hutang Kelas Pengganti Count
    var liburByHalaqahAndJenis = {}, penggantiByHalaqahAndJenis = {};
    (kbmAllRes.data || []).forEach(function(k) {
      var jenis = k.jenis_sesi || 'KBM Reguler';
      if (k.status === 'libur') {
        if (!liburByHalaqahAndJenis[k.id_halaqah]) liburByHalaqahAndJenis[k.id_halaqah] = {};
        liburByHalaqahAndJenis[k.id_halaqah][jenis] = (liburByHalaqahAndJenis[k.id_halaqah][jenis] || 0) + 1;
      } else if (k.status === 'selesai' && k.is_pengganti) {
        if (!penggantiByHalaqahAndJenis[k.id_halaqah]) penggantiByHalaqahAndJenis[k.id_halaqah] = {};
        penggantiByHalaqahAndJenis[k.id_halaqah][jenis] = (penggantiByHalaqahAndJenis[k.id_halaqah][jenis] || 0) + 1;
      }
    });
    var totalHutangPengganti = 0;
    var allLiburHalaqah = Object.keys(liburByHalaqahAndJenis);
    allLiburHalaqah.forEach(function(id_halaqah) {
      var libur = liburByHalaqahAndJenis[id_halaqah] || {};
      var pengganti = penggantiByHalaqahAndJenis[id_halaqah] || {};
      Object.keys(libur).forEach(function(jenis) {
        var sisa = (libur[jenis] || 0) - (pengganti[jenis] || 0);
        if (sisa > 0) totalHutangPengganti += sisa;
      });
    });

    // 4. Financial Overview Bulan Ini
    var totalMasuk = 0;
    var sppLunasCount = 0;
    var sppLunasNominal = 0;
    var infaqNominal = 0;
    var ihsanNominal = 0;
    var gatewayNominal = 0;
    var manualNominal = 0;

    (sppBulanIniRes.data || []).forEach(function(s) {
      var nominal = Number(s.nominal || 0);
      // 'Ihsan Guru' = gaji guru (PENGELUARAN), bukan pemasukan → jangan
      // dihitung sebagai total_masuk (dulu bug: totalMasuk += utk SEMUA baris
      // membuat "Total Masuk" dashboard menggelembung). Selaras dgn getSPPRekap.
      if (s.jenis === 'SPP Pribadi' || !s.jenis) {
        totalMasuk += nominal;
        sppLunasCount++;
        sppLunasNominal += nominal;
      } else if (s.jenis === 'Infaq/Operasional') {
        totalMasuk += nominal;
        infaqNominal += nominal;
      } else if (s.jenis === 'Ihsan Guru') {
        ihsanNominal += nominal;
        return; // gaji, bukan pemasukan → jangan masuk split metode income
      }

      if (s.metode_bayar === 'gateway') {
        gatewayNominal += nominal;
      } else {
        manualNominal += nominal;
      }
    });

    // SPP target nominal: hitung murid non-beasiswa
    var sppTargetMuridCount = (anggotaTipeRes.data || []).filter(function(a) { return a.tipe_spp !== 'beasiswa'; }).length;
    var sppTargetNominal = sppTargetMuridCount * SPP_NOMINAL_BULANAN;

    // Hitung Kepatuhan Input KBM Pekan Ini (7 hari terakhir)
    var halaqahAktifIds = (hqRes.data || []).map(function(h) { return h.id_halaqah; });
    var halaqahSetorSet = new Set();
    (kbmPekanRes.data || []).forEach(function(k) {
      if (halaqahAktifIds.includes(k.id_halaqah)) {
        halaqahSetorSet.add(k.id_halaqah);
      }
    });
    var totalActiveHq = halaqahAktifIds.length;
    var hqInputtedCount = halaqahSetorSet.size;
    var pctKepatuhanInput = totalActiveHq > 0 ? Math.round(hqInputtedCount / totalActiveHq * 100) : 0;

    return { status:'ok', data:{
      total_murid: roles.murid||0, total_guru: roles.guru||0,
      total_halaqah: (hqRes.data||[]).length, kbm_bulan_ini: kbmBulanRes.count||0,
      pct_nilai_terisi: pctKepatuhanInput,
      periode_aktif: periodeRes.data||null,
      halaqah: halaqah,
      saran_pending_count: saranPendingCount,
      spp_pending_count: sppPendingCount,
      total_hutang_pengganti: totalHutangPengganti,
      financial_overview: {
        bulan_ini: namaBulanIni,
        total_masuk: totalMasuk,
        spp_lunas_count: sppLunasCount,
        spp_lunas_nominal: sppLunasNominal,
        spp_target_murid_count: sppTargetMuridCount,
        spp_target_nominal: sppTargetNominal,
        infaq_nominal: infaqNominal,
        ihsan_nominal: ihsanNominal,
        gateway_nominal: gatewayNominal,
        manual_nominal: manualNominal
      }
    }};
  },
  getAllUsers: async function(p) {
    var q = _sb.from('users').select('*').order('nama_lengkap');
    // Accept both a plain string role (e.g. 'guru') or an object { role: 'guru' }
    var roleFilter = typeof p === 'string' ? p : (p && p.role ? p.role : null);
    if (roleFilter) q = q.eq('role', roleFilter);
    var {data,error} = await q; _check(error,'getAllUsers'); return {status:'ok',data};
  },
  createUser: async function(d) { var {data,error}=await _sb.from('users').insert(d).select().single(); _check(error,'createUser'); return {status:'ok',data}; },
  updateUser: async function(d) { var {id_user,...u}=d; var {data,error}=await _sb.from('users').update(u).eq('id_user',id_user).select(); _check(error,'updateUser'); if(!data || !data.length) throw new Error('User '+id_user+' tidak ditemukan atau tidak ada perubahan tersimpan -- coba muat ulang halaman dan login ulang'); if('role' in u || 'status' in u){ _logAudit('update_user_role_status', {id_user:id_user, changes:u}); } return {status:'ok',data:data[0]}; },
  deleteUser: async function(id_user) { var {error}=await _sb.from('users').update({status:'nonaktif'}).eq('id_user',id_user); _check(error,'deleteUser'); return {status:'ok'}; },
  // Hapus murid PERMANEN & bersih (RPC patch_043, superadmin only):
  // hapus data + cascade, bebaskan ID, hapus akun auth login.
  hardDeleteMurid: async function(id_user) {
    var {data,error}=await _sb.rpc('hard_delete_murid', { p_id_user: id_user });
    _check(error,'hardDeleteMurid');
    _logAudit('hard_delete_murid', { id_user: id_user });
    return {status:'ok',data};
  },
  getAllHalaqah: async function() {
    // Fetch halaqah + seluruh anggota aktif (untuk ketua + hitung jumlah murid) in parallel
    var [{data: hqData, error: hqErr}, {data: anggotaData}] = await Promise.all([
      _sb.from('halaqah').select('*').order('nama_halaqah'),
      _sb.from('anggota').select('id_halaqah, nama_murid, is_ketua').eq('status', 'aktif'),
    ]);
    _check(hqErr,'getAllHalaqah');
    // Build ketua map + count murid aktif per halaqah
    var ketuaMap = {}, countMap = {};
    (anggotaData || []).forEach(function(a) {
      countMap[a.id_halaqah] = (countMap[a.id_halaqah] || 0) + 1;
      if (a.is_ketua === true) ketuaMap[a.id_halaqah] = a.nama_murid;
    });
    if (hqData) {
      hqData = hqData.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
          nama_ketua: ketuaMap[h.id_halaqah] || null,
          total_murid: countMap[h.id_halaqah] || 0,
        });
      });
    }
    return {status:'ok',data:hqData};
  },
  createHalaqah: async function(d) {
    if (!d.id_halaqah) {
      d.id_halaqah = 'HQ-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    var {data,error}=await _sb.from('halaqah').insert(d).select().single();
    _check(error,'createHalaqah');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return {status:'ok',data};
  },
  updateHalaqah: async function(d) {
    var {id_halaqah,...u}=d;
    var {data,error}=await _sb.from('halaqah').update(u).eq('id_halaqah',id_halaqah).select().single();
    _check(error,'updateHalaqah');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return {status:'ok',data};
  },
  deleteHalaqah: async function(id) { var {error}=await _sb.from('halaqah').update({status:'nonaktif'}).eq('id_halaqah',id); _check(error,'deleteHalaqah'); return {status:'ok'}; },

  // ── Kelas Pengganti: Hari Libur Resmi (admin) ─────────────────
  getHariLiburResmi: async function() {
    var { data, error } = await _sb.from('hari_libur_resmi').select('*').order('tanggal', { ascending: false });
    _check(error, 'getHariLiburResmi');
    return { status: 'ok', data };
  },
  // d: { tanggal_mulai, tanggal_selesai (opsional, default = tanggal_mulai), keterangan }
  // Disimpan 1 baris per tanggal (lihat rencana_kelas_pengganti.md §10.E)
  simpanHariLiburResmi: async function(d) {
    if (!d.tanggal_mulai || !(d.keterangan || '').trim()) {
      return { status: 'error', message: 'Tanggal dan keterangan wajib diisi' };
    }
    var start = new Date(d.tanggal_mulai + 'T00:00:00');
    var end   = new Date((d.tanggal_selesai || d.tanggal_mulai) + 'T00:00:00');
    if (end < start) return { status: 'error', message: 'Tanggal selesai harus sama atau setelah tanggal mulai' };

    var rows = [];
    for (var dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      rows.push({ tanggal: y + '-' + m + '-' + day, keterangan: d.keterangan.trim(), dibuat_oleh: _uid() });
    }
    var { data, error } = await _sb.from('hari_libur_resmi').upsert(rows, { onConflict: 'tanggal' }).select();
    _check(error, 'simpanHariLiburResmi');
    return { status: 'ok', message: 'Hari libur resmi disimpan (' + rows.length + ' tanggal)', data };
  },
  hapusHariLiburResmi: async function(tanggal) {
    var { error } = await _sb.from('hari_libur_resmi').delete().eq('tanggal', tanggal);
    _check(error, 'hapusHariLiburResmi');
    return { status: 'ok' };
  },

  // ── Absensi Guru (rekap + override + pengaturan) ─────────────
  //  Mesin rekap = agregasi JS (_fetchAbsensiData/_deriveRekapAbsensi). Lihat RANCANGAN §4, §6.
  //  p: { bulan(1-12), tahun, id_guru? }. Tanpa argumen → bulan & tahun berjalan.
  getRekapAbsensiGuru: async function(p) {
    p = p || {};
    var now   = new Date();
    var bulan = Number(p.bulan) || (now.getMonth() + 1);
    var tahun = Number(p.tahun) || now.getFullYear();
    var data  = await _fetchAbsensiData({ bulan: bulan, tahun: tahun, scope: 'admin', id_guru: p.id_guru || null });
    var rekap = _deriveRekapAbsensi(data);
    if (p.id_guru) rekap.guru = rekap.guru.filter(function(g) { return g.id_guru === p.id_guru; });
    return { status: 'ok', data: rekap };
  },

  // Simpan/ubah koreksi manual (upsert 1 override per sel guru+halaqah+tanggal).
  setAbsensiGuruOverride: async function(d) {
    d = d || {};
    if (!d.id_guru || !d.id_halaqah || !d.tanggal || !d.status) {
      return { status: 'error', message: 'id_guru, id_halaqah, tanggal, dan status wajib diisi' };
    }
    if (['H', 'DS', 'HP', 'I', 'A', 'L'].indexOf(d.status) < 0) {
      return { status: 'error', message: 'Status override tidak valid: ' + d.status };
    }
    var { data, error } = await _sb.from('absensi_guru_override').upsert({
      id_guru: d.id_guru, id_halaqah: d.id_halaqah, tanggal: d.tanggal,
      status: d.status, keterangan: d.keterangan || null, dicatat_oleh: _uid(),
    }, { onConflict: 'id_guru,id_halaqah,tanggal' }).select().single();
    _check(error, 'setAbsensiGuruOverride');
    _logAudit('set_absensi_override', { id_guru: d.id_guru, id_halaqah: d.id_halaqah, tanggal: d.tanggal, status: d.status });
    return { status: 'ok', data: data };
  },

  // Hapus override (kembali ke status otomatis). Terima id_override (string) atau {id_guru,id_halaqah,tanggal}.
  hapusOverride: async function(p) {
    var q = _sb.from('absensi_guru_override').delete();
    if (typeof p === 'string') q = q.eq('id_override', p);
    else if (p && p.id_override) q = q.eq('id_override', p.id_override);
    else if (p && p.id_guru && p.id_halaqah && p.tanggal) {
      q = q.eq('id_guru', p.id_guru).eq('id_halaqah', p.id_halaqah).eq('tanggal', p.tanggal);
    } else {
      return { status: 'error', message: 'id_override atau (id_guru, id_halaqah, tanggal) wajib' };
    }
    var { error } = await q;
    _check(error, 'hapusOverride');
    return { status: 'ok' };
  },

  getPengaturanAbsensiGuru: async function() {
    var { data, error } = await _sb.from('pengaturan_absensi_guru').select('*').eq('id', 1).maybeSingle();
    _check(error, 'getPengaturanAbsensiGuru');
    return { status: 'ok', data: data || { id: 1, durasi_minimal_menit: 90, durasi_outlier_menit: 180 } };
  },
  setPengaturanAbsensiGuru: async function(d) {
    d = d || {};
    var row = {
      id: 1,
      durasi_minimal_menit: Number(d.durasi_minimal_menit) || 90,
      durasi_outlier_menit: Number(d.durasi_outlier_menit) || 180,
      updated_at: new Date().toISOString(), updated_by: _uid(),
    };
    // tanggal_mulai_berlaku (patch_050): hanya kirim bila field disertakan,
    // agar tetap aman bila patch_050 belum dijalankan & field tak diutak-atik.
    if ('tanggal_mulai_berlaku' in d) row.tanggal_mulai_berlaku = d.tanggal_mulai_berlaku || null;
    var { error } = await _sb.from('pengaturan_absensi_guru').upsert(row, { onConflict: 'id' });
    _check(error, 'setPengaturanAbsensiGuru');
    return { status: 'ok' };
  },

  // ── Kelas Pengganti: Flow 6 — toggle is_pengganti (admin) ─────
  toggleIsPengganti: async function(d) {
    var { data, error } = await _sb.from('kbm_log').update({ is_pengganti: !!d.is_pengganti })
      .eq('id_kbm', d.id_kbm).eq('status', 'selesai').select().single();
    _check(error, 'toggleIsPengganti');
    if (!data) throw new Error('Sesi tidak ditemukan atau bukan sesi berstatus selesai');
    return { status: 'ok', data };
  },

  // ── Kelas Pengganti: Flow 7 — ringkasan sisa_pengganti per halaqah/jenis_sesi ──
  getSisaPenggantiSummary: async function() {
    var { data: kbmAll, error } = await _sb.from('kbm_log')
      .select('id_halaqah, jenis_sesi, status, is_pengganti, tanggal_pertemuan, keterangan_libur')
      .in('status', ['selesai', 'libur']);
    _check(error, 'getSisaPenggantiSummary');

    var liburByJenis = {}, penggantiByJenis = {}, liburEntries = {};
    (kbmAll || []).forEach(function(k) {
      var jenis = k.jenis_sesi || 'KBM Reguler';
      if (k.status === 'libur') {
        if (!liburByJenis[k.id_halaqah]) liburByJenis[k.id_halaqah] = {};
        liburByJenis[k.id_halaqah][jenis] = (liburByJenis[k.id_halaqah][jenis] || 0) + 1;
        if (!liburEntries[k.id_halaqah]) liburEntries[k.id_halaqah] = [];
        liburEntries[k.id_halaqah].push({
          tanggal_pertemuan: k.tanggal_pertemuan,
          jenis_sesi: jenis,
          keterangan_libur: k.keterangan_libur || '',
        });
      } else if (k.status === 'selesai' && k.is_pengganti) {
        if (!penggantiByJenis[k.id_halaqah]) penggantiByJenis[k.id_halaqah] = {};
        penggantiByJenis[k.id_halaqah][jenis] = (penggantiByJenis[k.id_halaqah][jenis] || 0) + 1;
      }
    });

    var result = {};
    var allHalaqah = Object.keys(Object.assign({}, liburByJenis, penggantiByJenis));
    allHalaqah.forEach(function(id_halaqah) {
      var libur = liburByJenis[id_halaqah] || {};
      var pengganti = penggantiByJenis[id_halaqah] || {};
      var jenisSet = Object.keys(Object.assign({}, libur, pengganti));
      var perJenis = {};
      var hasAnomali = false;
      jenisSet.forEach(function(jenis) {
        var raw = (libur[jenis] || 0) - (pengganti[jenis] || 0);
        perJenis[jenis] = { sisa: Math.max(0, raw), raw: raw };
        if (raw < 0) hasAnomali = true;
      });
      var riwayatLibur = (liburEntries[id_halaqah] || []).slice().sort(function(a, b) {
        return (b.tanggal_pertemuan || '').localeCompare(a.tanggal_pertemuan || '');
      });
      result[id_halaqah] = { per_jenis: perJenis, has_anomali: hasAnomali, riwayat_libur: riwayatLibur };
    });
    return { status: 'ok', data: result };
  },

  // ── Kelas Pengganti: riwayat libur/pengganti dari SEMUA halaqah (untuk monitoring) ──
  getRiwayatPenggantiSemua: async function(limit) {
    var { data, error } = await _sb.from('kbm_log').select('*')
      .or('status.eq.libur,is_pengganti.eq.true')
      .order('tanggal_pertemuan', { ascending: false })
      .limit(limit || 100);
    _check(error, 'getRiwayatPenggantiSemua');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },
  getAllAnggota: async function(id_halaqah) {
    var q = _sb.from('anggota').select('*, users!anggota_id_murid_fkey(nama_lengkap,no_hp)');
    if (id_halaqah) q = q.eq('id_halaqah',id_halaqah);
    var {data,error}=await q.order('nama_murid'); _check(error,'getAllAnggota');
    // Fallback nama dari join users bila kolom denormalisasi nama_murid kosong (baris lama)
    if (data) data = data.map(function(a) {
      return Object.assign({}, a, { nama_murid: a.nama_murid || (a.users && a.users.nama_lengkap) || '' });
    });
    return {status:'ok',data};
  },
  addAnggota: async function(d) {
    // Isi nama_murid (denormalisasi) bila belum ada — dipakai untuk display & nama ketua
    if (!d.nama_murid && d.id_murid) {
      var {data:u}=await _sb.from('users').select('nama_lengkap').eq('id_user',d.id_murid).single();
      if (u && u.nama_lengkap) d = Object.assign({}, d, { nama_murid: u.nama_lengkap });
    }
    var {data,error}=await _sb.from('anggota').insert(d).select().single(); _check(error,'addAnggota'); return {status:'ok',data};
  },
  updateAnggota: async function(d) { var {id_anggota,...u}=d; var {error}=await _sb.from('anggota').update(u).eq('id_anggota',id_anggota); _check(error,'updateAnggota'); return {status:'ok'}; },
  // Pindah murid dari halaqah asal ke tujuan secara atomik (RPC patch_042).
  // Tidak meninggalkan baris nyangkut di halaqah lama + aman dari duplikat.
  pindahHalaqah: async function(d) {
    var {data,error}=await _sb.rpc('pindah_anggota_halaqah', {
      p_id_anggota        : d.id_anggota,
      p_id_halaqah_tujuan : d.id_halaqah_tujuan,
      p_level             : d.level || null,
      p_target_level      : d.target_level || null,
    });
    _check(error,'pindahHalaqah'); return {status:'ok',data};
  },
  removeAnggota: async function(d) { var id=typeof d==='string'?d:(d&&d.id_anggota); var {error}=await _sb.from('anggota').update({status:'nonaktif'}).eq('id_anggota',id); _check(error,'removeAnggota'); return {status:'ok'}; },
  assignKetuaKelas: async function(d) {
    var {data:row,error:errRow}=await _sb.from('anggota').select('id_halaqah').eq('id_anggota',d.id_anggota).single();
    _check(errRow,'assignKetuaKelas');
    if (d.assign) {
      await _sb.from('anggota').update({is_ketua:false}).eq('id_halaqah',row.id_halaqah);
      var {error}=await _sb.from('anggota').update({is_ketua:true}).eq('id_anggota',d.id_anggota);
      _check(error,'assignKetuaKelas');
    } else {
      var {error}=await _sb.from('anggota').update({is_ketua:false}).eq('id_anggota',d.id_anggota);
      _check(error,'assignKetuaKelas');
    }
    return {status:'ok'};
  },
  // Kelompok Partner Qiyam — admin lihat/atur lintas halaqah (RLS admin_all_*)
  getMuridQiyam: async function(id_halaqah) { return GuruAPI.getMuridQiyam(id_halaqah); },
  getKelompokPartnerHalaqah: async function(id_halaqah) { return GuruAPI.getKelompokPartnerHalaqah(id_halaqah); },
  getPantauKelompokPartner: async function(id_halaqah) { return GuruAPI.getPantauKelompokPartner(id_halaqah); },
  getLiniMasaSetoranKelompok: async function(id_kelompok) { return GuruAPI.getLiniMasaSetoranKelompok(id_kelompok); },
  getMilestoneByKelompok: async function(id_kelompok) { return GuruAPI.getMilestoneByKelompok(id_kelompok); },
  addMilestoneKelompok: async function(d) { return GuruAPI.addMilestoneKelompok(d); },
  deleteMilestoneKelompok: async function(id_milestone) { return GuruAPI.deleteMilestoneKelompok(id_milestone); },
  guruKonfirmasiSetoran: async function(id_setoran, kelancaran, catatan) { return GuruAPI.guruKonfirmasiSetoran(id_setoran, kelancaran, catatan); },
  getSetoranPartnerMenungguHalaqah: async function(id_halaqah) { return GuruAPI.getSetoranPartnerMenungguHalaqah(id_halaqah); },
  getTargetByKelompok: async function(id_kelompok) { return GuruAPI.getTargetByKelompok(id_kelompok); },
  addTargetByKelompok: async function(d) { return GuruAPI.addTargetByKelompok(d); },
  updateTargetByKelompok: async function(id_target, updates) { return GuruAPI.updateTargetByKelompok(id_target, updates); },
  deleteTargetByKelompok: async function(id_target) { return GuruAPI.deleteTargetByKelompok(id_target); },
  createKelompokPartner: async function(id_halaqah, nama_kelompok, anggota) { return GuruAPI.createKelompokPartner(id_halaqah, nama_kelompok, anggota); },
  updateKelompokPartner: async function(id_kelompok, updates) { return GuruAPI.updateKelompokPartner(id_kelompok, updates); },
  setAnggotaKelompok: async function(id_kelompok, anggota) { return GuruAPI.setAnggotaKelompok(id_kelompok, anggota); },
  deleteKelompokPartner: async function(id_kelompok) { return GuruAPI.deleteKelompokPartner(id_kelompok); },

  // Kelompok Partner Belajar — admin lihat/atur lintas halaqah (RLS admin_all_*)
  getLevelBelajarEnabled: async function() { return GuruAPI.getLevelBelajarEnabled(); },
  getMuridBelajar: async function(id_halaqah) { return GuruAPI.getMuridBelajar(id_halaqah); },
  getKelompokBelajarHalaqah: async function(id_halaqah) { return GuruAPI.getKelompokBelajarHalaqah(id_halaqah); },
  getPantauKelompokBelajar: async function(id_halaqah) { return GuruAPI.getPantauKelompokBelajar(id_halaqah); },
  getLiniMasaBelajarKelompok: async function(id_kelompok) { return GuruAPI.getLiniMasaBelajarKelompok(id_kelompok); },
  getMilestoneBelajarByKelompok: async function(id_kelompok) { return GuruAPI.getMilestoneBelajarByKelompok(id_kelompok); },
  addMilestoneBelajarKelompok: async function(d) { return GuruAPI.addMilestoneBelajarKelompok(d); },
  deleteMilestoneBelajarKelompok: async function(id_milestone) { return GuruAPI.deleteMilestoneBelajarKelompok(id_milestone); },
  guruKonfirmasiLogBelajar: async function(id_log, kelancaran, catatan) { return GuruAPI.guruKonfirmasiLogBelajar(id_log, kelancaran, catatan); },
  getLogBelajarMenungguHalaqah: async function(id_halaqah) { return GuruAPI.getLogBelajarMenungguHalaqah(id_halaqah); },
  getTargetBelajarByKelompok: async function(id_kelompok) { return GuruAPI.getTargetBelajarByKelompok(id_kelompok); },
  addTargetBelajarByKelompok: async function(d) { return GuruAPI.addTargetBelajarByKelompok(d); },
  updateTargetBelajarByKelompok: async function(id_target, updates) { return GuruAPI.updateTargetBelajarByKelompok(id_target, updates); },
  deleteTargetBelajarByKelompok: async function(id_target) { return GuruAPI.deleteTargetBelajarByKelompok(id_target); },
  createKelompokBelajar: async function(id_halaqah, nama_kelompok, anggota) { return GuruAPI.createKelompokBelajar(id_halaqah, nama_kelompok, anggota); },
  updateKelompokBelajar: async function(id_kelompok, updates) { return GuruAPI.updateKelompokBelajar(id_kelompok, updates); },
  setAnggotaKelompokBelajar: async function(id_kelompok, anggota) { return GuruAPI.setAnggotaKelompokBelajar(id_kelompok, anggota); },
  deleteKelompokBelajar: async function(id_kelompok) { return GuruAPI.deleteKelompokBelajar(id_kelompok); },

  getAllPeriode: async function() { return GuruAPI.getAllPeriode(); },
  createPeriode: async function(d) { var {data,error}=await _sb.from('periode').insert(d).select().single(); _check(error,'createPeriode'); return {status:'ok',data}; },
  updatePeriode: async function(d) { var {id_periode,...u}=d; var {data,error}=await _sb.from('periode').update(u).eq('id_periode',id_periode).select().single(); _check(error,'updatePeriode'); return {status:'ok',data}; },
  getKomponenRaport: async function(id) { return GuruAPI.getKomponenRaport(id); },
  saveKomponenRaport: async function(d) {
    await _sb.from('komponen_raport').update({status:'nonaktif'}).eq('id_periode',d.id_periode);
    var rows = d.komponen.map(function(k, idx) {
      return {
        id_komponen   : k.id_komponen || _genId('KMP'),
        id_periode    : d.id_periode,
        nama_komponen : k.nama_komponen,
        bobot         : Number(k.bobot),
        tipe          : k.tipe || 'otomatis',
        urutan        : idx,
        status        : 'aktif'
      };
    });
    var {data,error}=await _sb.from('komponen_raport').upsert(rows, { onConflict: 'id_komponen' }).select();
    _check(error,'saveKomponenRaport'); return {status:'ok',data};
  },
  getNilaiManual: async function(id) { return GuruAPI.getNilaiManual(id); },
  getMutabaahDaurahGuru: async function(id_periode) { return GuruAPI.getMutabaahDaurahGuru(id_periode); },
  saveNilaiManual: async function(d) { return GuruAPI.saveNilaiManual(d); },
  saveNilaiManualBatch: async function(d) { return GuruAPI.saveNilaiManualBatch(d); },
  getRaportList: async function(p) {
    var q = _sb.from('raport').select('*, users!raport_id_murid_fkey(nama_lengkap), halaqah(nama_halaqah), periode(nama_periode)');
    if (p && p.id_periode) q = q.eq('id_periode',p.id_periode);
    var {data,error}=await q.order('created_at',{ascending:false}); _check(error,'getRaportList'); return {status:'ok',data};
  },
  publishRaport: async function(d) {
    var {error}=await _sb.from('raport').update({status:'published',published_by:_uid(),published_at:new Date().toISOString()}).eq('id_raport',d.id_raport);
    _check(error,'publishRaport');
    _logAudit('publish_raport', {id_raport: d.id_raport});
    return {status:'ok',message:'Raport dipublikasikan'};
  },
  getAllPengumuman: async function() { var {data,error}=await _sb.from('pengumuman').select('*').order('tanggal',{ascending:false}); _check(error,'getAllPengumuman'); return {status:'ok',data}; },
  buatPengumuman: async function(d) {
    var {data,error}=await _sb.from('pengumuman').insert(Object.assign({},d,{dibuat_oleh:_uid(),nama_pembuat:(_currentUser&&(_currentUser.nama||_currentUser.nama_lengkap))||'Admin'})).select().single();
    _check(error,'buatPengumuman'); return {status:'ok',data};
  },
  getLaporanGlobal: async function() {
    var [hqRes, anggotaRes, nilaiRes, kbmSesiRes, raportRes] = await Promise.all([
      _sb.from('halaqah').select('*').eq('status','aktif'),
      _sb.from('anggota').select('id_halaqah').eq('status','aktif'),
      _sb.from('nilai_kbm').select('id_halaqah, status_hadir'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai'),
      _sb.from('raport').select('id_halaqah, nilai_akhir').not('nilai_akhir','is',null),
    ]);
    _check(hqRes.error,'getLaporanGlobal');
    // Aggregate per halaqah (pola sama dengan getDashboard)
    var anggotaMap={}, nilaiMap={}, sesiMap={}, raportMap={};
    (anggotaRes.data||[]).forEach(function(a){ anggotaMap[a.id_halaqah]=(anggotaMap[a.id_halaqah]||0)+1; });
    (nilaiRes.data||[]).forEach(function(n){
      if (!nilaiMap[n.id_halaqah]) nilaiMap[n.id_halaqah]={hadir:0,total:0};
      nilaiMap[n.id_halaqah].total++;
      if (['H','T'].includes(n.status_hadir)) nilaiMap[n.id_halaqah].hadir++;
    });
    (kbmSesiRes.data||[]).forEach(function(k){ sesiMap[k.id_halaqah]=(sesiMap[k.id_halaqah]||0)+1; });
    (raportRes.data||[]).forEach(function(r){
      if (!raportMap[r.id_halaqah]) raportMap[r.id_halaqah]={sum:0,count:0};
      raportMap[r.id_halaqah].sum+=Number(r.nilai_akhir||0);
      raportMap[r.id_halaqah].count++;
    });
    var data = (hqRes.data||[]).map(function(h) {
      var nm = nilaiMap[h.id_halaqah]||{hadir:0,total:0};
      var rm = raportMap[h.id_halaqah]||{sum:0,count:0};
      return Object.assign({}, h, {
        jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
        total_murid: anggotaMap[h.id_halaqah]||0,
        total_sesi : sesiMap[h.id_halaqah]||0,
        avg_nilai  : rm.count>0 ? Math.round(rm.sum/rm.count) : 0,
        pct_hadir  : nm.total>0 ? Math.round(nm.hadir/nm.total*100) : 0,
      });
    });
    return {status:'ok',data};
  },
  getMutabaahDaurah: async function(id_periode) {
    id_periode = id_periode || 'P-DAURAH-JULI-2026';
    var [periodeRes, halaqahRes, asmtItemRes] = await Promise.all([
      _sb.from('periode').select('id_periode, nama_periode, tanggal_mulai, tanggal_selesai').eq('id_periode', id_periode).maybeSingle(),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, id_guru, level, status').eq('level','Tahsin Al-Fatihah').eq('status','aktif'),
      _sb.from('assessment_items').select('id_item, nama_item:teks_latin, urutan, kategori').eq('level','Tahsin Al-Fatihah').eq('status','aktif').order('urutan'),
    ]);
    _check(periodeRes.error, 'getMutabaahDaurah.periode');
    _check(halaqahRes.error, 'getMutabaahDaurah.halaqah');
    _check(asmtItemRes.error, 'getMutabaahDaurah.items');

    var periode = periodeRes.data || { id_periode: id_periode, nama_periode: 'Daurah Al-Fatihah', tanggal_mulai: '2026-07-11', tanggal_selesai: '2026-07-18' };
    var indikator = asmtItemRes.data || [];
    // .order('urutan') di query hanya urut GLOBAL — indikator hari berbeda bisa
    // bercampur (Hari 2 urutan 1 muncul sebelum Hari 1 urutan 7). Urutkan ulang
    // per Hari (angka di kategori) lalu urutan, sama seperti fix di konten-module.js.
    indikator.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var hqIds = (halaqahRes.data||[]).map(function(h){ return h.id_halaqah; });
    var itemIds = indikator.map(function(i){ return i.id_item; });

    var today = new Date(); today.setHours(0,0,0,0);
    var tglMulai = new Date(periode.tanggal_mulai); tglMulai.setHours(0,0,0,0);
    var tglSelesai = new Date(periode.tanggal_selesai); tglSelesai.setHours(0,0,0,0);
    var hariKe = today < tglMulai ? 0 : today > tglSelesai ? 8 : Math.floor((today - tglMulai) / 86400000) + 1;
    var statusDaurah = today < tglMulai ? 'belum' : today > tglSelesai ? 'selesai' : 'berlangsung';

    // Data besar diambil TERFILTER (halaqah daurah + rentang tanggal periode)
    // dan berpaginasi via _selectAllPaged agar tidak terpotong batas 1000 baris PostgREST.
    var anggotaRows=[], kbmRows=[], nilaiRows=[], asmtRows=[];
    if (hqIds.length) {
      var big = await Promise.all([
        _selectAllPaged('anggota', 'id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(no_hp)',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','aktif').order('id_murid').order('id_halaqah'); },
          'getMutabaahDaurah.anggota'),
        _selectAllPaged('kbm_log', 'id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke, status',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','selesai')
            .gte('tanggal_pertemuan', periode.tanggal_mulai).lte('tanggal_pertemuan', periode.tanggal_selesai)
            .order('id_kbm'); },
          'getMutabaahDaurah.kbm'),
        _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, id_halaqah, id_kbm, status_hadir',
          function(q){ return q.in('id_halaqah', hqIds).order('id_nilai'); },
          'getMutabaahDaurah.nilai'),
        itemIds.length
          ? _selectAllPaged('assessment_murid', 'id_murid, id_item, status_guru',
              function(q){ return q.in('id_item', itemIds).order('id_murid').order('id_item'); },
              'getMutabaahDaurah.asmt')
          : Promise.resolve([]),
      ]);
      anggotaRows = big[0]; kbmRows = big[1]; nilaiRows = big[2]; asmtRows = big[3];
    }

    // Hanya nilai dari sesi KBM daurah (status selesai & dalam rentang periode)
    var kbmKeById = {};
    kbmRows.forEach(function(k){ kbmKeById[k.id_kbm] = k.pertemuan_ke || 0; });
    nilaiRows = nilaiRows.filter(function(n){ return Object.prototype.hasOwnProperty.call(kbmKeById, n.id_kbm); });

    var anggotaByHq={}, kbmByHq={}, nilaiByHqMurid={}, asmtByMuridItem={};
    anggotaRows.forEach(function(a){
      var aCopy = Object.assign({}, a, { no_hp: a.users && a.users.no_hp });
      delete aCopy.users;
      (anggotaByHq[a.id_halaqah]=anggotaByHq[a.id_halaqah]||[]).push(aCopy);
    });
    kbmRows.forEach(function(k){ (kbmByHq[k.id_halaqah]=kbmByHq[k.id_halaqah]||[]).push(k); });
    nilaiRows.forEach(function(n){
      var key=n.id_halaqah+'|'+n.id_murid;
      (nilaiByHqMurid[key]=nilaiByHqMurid[key]||[]).push(n);
    });
    asmtRows.forEach(function(s){ asmtByMuridItem[s.id_murid+'|'+s.id_item]=s.status_guru; });

    var halaqahList = (halaqahRes.data||[]).map(function(hq) {
      var muridList = (anggotaByHq[hq.id_halaqah]||[]);
      var sesiList  = (kbmByHq[hq.id_halaqah]||[]).sort(function(a,b){ return (a.pertemuan_ke||0)-(b.pertemuan_ke||0); });
      var sumHadir=0, sumTotal=0;
      var murid = muridList.map(function(m) {
        var nm = (nilaiByHqMurid[hq.id_halaqah+'|'+m.id_murid]||[]);
        var hadir = nm.filter(function(n){ return ['H','T'].includes(n.status_hadir); }).length;
        sumHadir+=hadir; sumTotal+=nm.length;
        var sesiStatus = {};
        nm.forEach(function(n){ var ke = kbmKeById[n.id_kbm]; if (ke) sesiStatus[ke] = n.status_hadir; });
        var tajwid = indikator.map(function(item){
          return { id_item:item.id_item, nama:item.nama_item, status:asmtByMuridItem[m.id_murid+'|'+item.id_item]||null };
        });
        var pahamCount=tajwid.filter(function(t){ return t.status==='paham'; }).length;
        return Object.assign({},m,{ hadir, sesiTotal:nm.length, pctHadir:nm.length>0?Math.round(hadir/nm.length*100):0, tajwid, pahamCount, sesiStatus });
      });
      var pctTajwidSum=0, pctTajwidCount=0;
      murid.forEach(function(m){ if(indikator.length>0){ pctTajwidSum+=m.pahamCount; pctTajwidCount+=indikator.length; } });
      return Object.assign({},hq,{
        murid, sesiList,
        sesiTerlaksana: sesiList.length,
        pctHadir: sumTotal>0?Math.round(sumHadir/sumTotal*100):0,
        pctTajwid: pctTajwidCount>0?Math.round(pctTajwidSum/pctTajwidCount*100):0,
      });
    });

    var totalPeserta=0, gSumHadir=0, gSumTotal=0, gSumPaham=0, gSumTajwid=0, totalSesi=0;
    halaqahList.forEach(function(h){
      totalPeserta+=h.murid.length; totalSesi+=h.sesiTerlaksana;
      h.murid.forEach(function(m){ gSumHadir+=m.hadir; gSumTotal+=m.sesiTotal; gSumPaham+=m.pahamCount; gSumTajwid+=indikator.length; });
    });

    var indikatorRanking = indikator.map(function(item){
      var paham=0,ragu=0,belum=0,total=0;
      halaqahList.forEach(function(h){ h.murid.forEach(function(m){
        var s=asmtByMuridItem[m.id_murid+'|'+item.id_item];
        if(s==='paham')paham++; else if(s==='ragu')ragu++; else if(s==='belum')belum++;
        if(s)total++;
      }); });
      return { id_item:item.id_item, nama:item.nama_item, paham,ragu,belum,total,
        pctPaham:total>0?Math.round(paham/total*100):null };
    }).sort(function(a,b){ return (a.pctPaham===null?-1:a.pctPaham)-(b.pctPaham===null?-1:b.pctPaham); });

    var muridAlert=[];
    halaqahList.forEach(function(h){ h.murid.forEach(function(m){
      var tajwidBelum=m.tajwid.filter(function(t){ return t.status==='belum'; }).length;
      var tajwidRagu =m.tajwid.filter(function(t){ return t.status==='ragu';  }).length;
      var lvl=(m.sesiTotal>0&&m.pctHadir<75)||tajwidBelum>=3?'kritis':((m.sesiTotal>0&&m.pctHadir<85)||tajwidRagu>=3)?'perhatian':null;
      if(lvl) muridAlert.push(Object.assign({},m,{
        nama_halaqah:h.nama_halaqah, nama_guru:h.nama_guru,
        tajwidBelum, tajwidRagu,
        indikatorLemah:m.tajwid.filter(function(t){ return t.status==='belum'||t.status==='ragu'; }).map(function(t){ return t.nama; }),
        level:lvl
      }));
    }); });
    muridAlert.sort(function(a,b){ return (a.level==='kritis'?0:1)-(b.level==='kritis'?0:1); });

    return { status:'ok', data:{
      periode, hariKe, statusDaurah,
      summary:{ totalPeserta, hariKe, totalSesi, avgHadir:gSumTotal>0?Math.round(gSumHadir/gSumTotal*100):0, avgTajwid:gSumTajwid>0?Math.round(gSumPaham/gSumTajwid*100):0 },
      halaqahList, indikatorRanking, indikator, muridAlert
    }};
  },
  getRekapAbsensi: async function(p) {
    var [levelsRes, queryAnggotaData] = await Promise.all([
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
      (function() {
        var q = _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, halaqah(nama_halaqah, level)').eq('status', 'aktif');
        if (p.id_halaqah) q = q.eq('id_halaqah', p.id_halaqah);
        return q.order('nama_murid');
      })()
    ]);
    var targetSesiMap = {};
    (levelsRes.data || []).forEach(function(l) {
      if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
      if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
    });
    var anggota = queryAnggotaData.data;
    var errAnggota = queryAnggotaData.error;
    _check(errAnggota, 'getRekapAbsensi.anggota');
    
    var nilaiList = [];
    
    // Fetch logs based on requested session type
    if (p.jenis_sesi === 'Kajian At-Tibyan') {
      // Fetch only from at_tibyan_log
      var queryAt = _sb.from('at_tibyan_log')
        .select('id_murid, status_hadir, id_halaqah');
      if (p.id_halaqah) {
        queryAt = queryAt.eq('id_halaqah', p.id_halaqah);
      }
      var { data: atList, error: errAt } = await queryAt;
      _check(errAt, 'getRekapAbsensi.at_tibyan_log');
      
      nilaiList = (atList || []).map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: 'Kajian At-Tibyan'
        };
      });
    } else if (p.jenis_sesi) {
      // Fetch specified session type from nilai_kbm (e.g. KBM Reguler, Micro Teaching)
      var queryNilai = _sb.from('nilai_kbm')
        .select('id_murid, status_hadir, jenis_sesi');
      if (p.id_halaqah) {
        queryNilai = queryNilai.eq('id_halaqah', p.id_halaqah);
      }
      queryNilai = queryNilai.eq('jenis_sesi', p.jenis_sesi);
      var { data: kbmList, error: errNilai } = await queryNilai;
      _check(errNilai, 'getRekapAbsensi.nilai');
      
      nilaiList = (kbmList || []).map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: n.jenis_sesi || 'KBM Reguler'
        };
      });
    } else {
      // Fetch all session types (Semua Jenis Sesi) - merge from both tables
      var queryNilai = _sb.from('nilai_kbm')
        .select('id_murid, status_hadir, jenis_sesi');
      if (p.id_halaqah) {
        queryNilai = queryNilai.eq('id_halaqah', p.id_halaqah);
      }
      var queryAt = _sb.from('at_tibyan_log')
        .select('id_murid, status_hadir, id_halaqah');
      if (p.id_halaqah) {
        queryAt = queryAt.eq('id_halaqah', p.id_halaqah);
      }
      
      var [resNilai, resAt] = await Promise.all([queryNilai, queryAt]);
      _check(resNilai.error, 'getRekapAbsensi.nilai');
      _check(resAt.error, 'getRekapAbsensi.at_tibyan_log');
      
      var kbmList = resNilai.data || [];
      var atList = resAt.data || [];
      
      nilaiList = kbmList.map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: n.jenis_sesi || 'KBM Reguler'
        };
      });
      atList.forEach(function(n) {
        nilaiList.push({
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: 'Kajian At-Tibyan'
        });
      });
    }
    
    var list = (anggota || []).map(function(a) {
      var studentLogs = (nilaiList || []).filter(function(n) { return n.id_murid === a.id_murid; });
      var H = studentLogs.filter(function(n) { return n.status_hadir === 'H'; }).length;
      var T = studentLogs.filter(function(n) { return n.status_hadir === 'T'; }).length;
      var I = studentLogs.filter(function(n) { return n.status_hadir === 'I'; }).length;
      var A = studentLogs.filter(function(n) { return n.status_hadir === 'A'; }).length;
      var total = studentLogs.length;
      var scoreSum = H + (T * 0.7) + (I * 0.5);
      var pct_hadir = total > 0 ? Math.round((scoreSum / total) * 100) : 0;
      var targetSesi = (a.halaqah && targetSesiMap[a.halaqah.level]) || 40;
      var skor_dari_40 = Math.min(Math.round(scoreSum / targetSesi * 100), 100);
      return {
        id_murid: a.id_murid,
        nama_murid: a.nama_murid,
        id_halaqah: a.id_halaqah,
        nama_halaqah: a.halaqah ? a.halaqah.nama_halaqah : '—',
        H: H, T: T, I: I, A: A,
        total: total,
        pct_hadir: pct_hadir,
        skor_dari_40: skor_dari_40
      };
    });
    return { status: 'ok', data: list };
  },
  getLevelList: async function() { var {data,error}=await _sb.from('level').select('*').eq('status','aktif').order('urutan'); _check(error,'getLevelList'); return {status:'ok',data}; },
  saveLevel: async function(d) { var {data,error}=await _sb.from('level').upsert(d,{onConflict:'id_level'}).select(); _check(error,'saveLevel'); return {status:'ok',data}; },
  // Admin: kembalikan baris MENTAH (incl id_template & urutan) utk editor,
  // bukan versi guru yang sudah dikelompokkan per kategori.
  getTemplateKoreksi: async function() {
    var { data, error } = await _sb.from('template_koreksi')
      .select('id_template, kategori, teks, urutan').eq('status','aktif').order('urutan');
    _check(error, 'getTemplateKoreksi(admin)');
    return { status:'ok', flat: data || [] };
  },
  saveTemplateKoreksi: async function(d) {
    // L4: simpan atomik (nonaktif+upsert+insert dalam 1 transaksi) via RPC.
    // Tahan beda versi frontend (t.id maupun t.id_template).
    var templates = ((d && d.templates) || [])
      .filter(function(t){ return t.teks && String(t.teks).trim(); })
      .map(function(t){
        return {
          id_template: t.id || t.id_template || null,
          kategori   : String(t.kategori || 'Umum').trim(),
          teks       : String(t.teks).trim(),
        };
      });
    var rpc = await _sb.rpc('save_template_koreksi', { p_templates: templates });
    if (rpc.error) {
      // Fallback bila RPC belum ada di DB (patch_039 belum dijalankan).
      if (rpc.error.code === 'PGRST202' || /save_template_koreksi/i.test(rpc.error.message || '')) {
        return await _saveTemplateKoreksiLegacy(templates);
      }
      _check(rpc.error, 'saveTemplateKoreksi');
    }
    var written = Number(rpc.data || 0);
    if (templates.length > 0 && written === 0) {
      throw new Error('Template tidak tersimpan (0 baris ditulis ke DB). Kemungkinan sesi ini tidak punya hak admin (RLS admin_write_template). Coba logout lalu login ulang sebagai admin.');
    }
    return { status:'ok', written: written };
  },
  resetPassword: async function(id_user, new_password) {
    var token = sessionStorage.getItem('hq_token') || localStorage.getItem('hq_token');
    var res = await fetch(SUPABASE_URL + '/functions/v1/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id_user: id_user, new_password: new_password }),
    });
    var data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  },
  getAuditLog: async function() { var {data,error}=await _sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100); _check(error,'getAuditLog'); return {status:'ok',data}; },
  getObservasiKBM: async function(p) {
    p = p || {};
    var { data, error } = await _sb.from('observasi_kbm')
      .select('*, halaqah(nama_halaqah, id_guru, nama_guru)')
      .order('created_at', { ascending: false });
    _check(error, 'getObservasiKBM');
    var list = data || [];
    list = list.map(function(r) {
      if (r.halaqah) {
        r.nama_halaqah = r.halaqah.nama_halaqah;
        r.id_guru = r.halaqah.id_guru;
        r.nama_guru = r.halaqah.nama_guru;
      }
      return r;
    });
    if (p.id_halaqah) {
      list = list.filter(function(r) { return r.id_halaqah === p.id_halaqah; });
    }
    if (p.id_guru) {
      list = list.filter(function(r) { return r.id_guru === p.id_guru; });
    }
    if (p.tgl_dari) {
      list = list.filter(function(r) { return r.tanggal >= p.tgl_dari; });
    }
    if (p.tgl_sampai) {
      list = list.filter(function(r) { return r.tanggal <= p.tgl_sampai; });
    }
    return { status: 'ok', data: list };
  },
  // ── SPP Metode Bayar ───────────────────────
  getMetodeBayar: async function() {
    var { data, error } = await _sb.from('spp_metode_bayar').select('*').eq('aktif',true).order('urutan');
    _check(error,'getMetodeBayar'); return { status:'ok', data: data||[] };
  },
  saveMetodeBayar: async function(d) {
    var { id, ...fields } = d;
    if (id) {
      var { error } = await _sb.from('spp_metode_bayar').update(fields).eq('id',id);
      _check(error,'saveMetodeBayar'); return { status:'ok' };
    }
    var { error } = await _sb.from('spp_metode_bayar').insert(fields);
    _check(error,'saveMetodeBayar'); return { status:'ok' };
  },
  deleteMetodeBayar: async function(id) {
    var { error } = await _sb.from('spp_metode_bayar').update({aktif:false}).eq('id',id);
    _check(error,'deleteMetodeBayar'); return { status:'ok' };
  },

  // ── SPP Admin ──────────────────────────────
  getSPPPending: async function() {
    var { data, error } = await _sb.from('spp_pembayaran').select('*').eq('status','menunggu').order('created_at',{ascending:false});
    _check(error,'getSPPPending');
    // M1: sembunyikan reservasi gateway yang sudah kedaluwarsa (invoice tak
    // jadi dibayar) — itu bukan pengajuan manual yang perlu divalidasi admin.
    // Pengajuan manual & invoice gateway yang masih berlaku tetap tampil.
    var rows = (data||[]).filter(function(r){ return !_sppGatewayExpired(r); });
    return { status:'ok', data: rows };
  },
  validasiSPP: async function(id_spp, aksi) {
    // Ambil data SPP dulu untuk push ke murid
    var { data: sppRow } = await _sb.from('spp_pembayaran').select('id_murid, bulan, tahun').eq('id_spp', id_spp).single();
    // Guard: hanya boleh validasi pengajuan yang masih 'menunggu' — cegah validasi ganda
    // (mis. dua admin klik tombol bersamaan, atau klik berulang) yang bisa menimpa
    // validated_by/validated_at dan mengirim notifikasi duplikat ke murid.
    var updateFields = {
      status: aksi, validated_by: _uid(), validated_at: new Date().toISOString(),
    };
    if (aksi === 'lunas') {
      updateFields.tanggal_bayar = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    }
    var { data: updRows, error } = await _sb.from('spp_pembayaran').update(updateFields)
      .eq('id_spp', id_spp).eq('status','menunggu').select('id_spp');
    _check(error,'validasiSPP');
    if (!updRows || !updRows.length) {
      return { status:'error', message:'Pengajuan ini sudah divalidasi sebelumnya.' };
    }
    _logAudit('validasi_spp', {id_spp: id_spp, aksi: aksi, id_murid: sppRow && sppRow.id_murid});
    // Push ke murid yang bersangkutan
    if (sppRow && sppRow.id_murid) {
      var isLunas = aksi === 'lunas';
      _sendPushBg({
        user_ids: [sppRow.id_murid],
        title: isLunas ? '✅ Pembayaran SPP Diterima!' : '❌ Konfirmasi SPP Ditolak',
        body : isLunas
          ? 'SPP ' + (sppRow.bulan || '') + ' ' + (sppRow.tahun || '') + ' sudah terverifikasi. Jazakallahu khairan!'
          : 'Konfirmasi SPP ' + (sppRow.bulan || '') + ' ditolak admin. Silakan hubungi admin untuk info lebih lanjut.',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'spp-validasi-' + id_spp,
        data : { trigger: isLunas ? 'spp_lunas' : 'spp_ditolak' },
      });
    }
    return { status:'ok' };
  },

  // ── Input SPP Manual oleh Admin ────────────────────────────
  // Ambil status SPP per bulan untuk murid tertentu (dipakai modal input manual)
  getSPPStatusMurid: async function(id_murid, tahun) {
    var t = tahun || new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('bulan, status, jenis')
      .eq('id_murid', id_murid).eq('tahun', t);
    _check(error, 'getSPPStatusMurid');
    var lunas = []; var menunggu = [];
    (data||[]).forEach(function(r) {
      if (r.jenis && r.jenis !== 'SPP Pribadi') return;
      if (r.status === 'lunas') lunas.push(r.bulan);
      else if (r.status === 'menunggu') menunggu.push(r.bulan);
    });
    return { status:'ok', data: { lunas: lunas, menunggu: menunggu } };
  },

  getIhsanStatusGuru: async function(id_guru, tahun) {
    var t = tahun || new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('bulan, status')
      .eq('id_murid', id_guru).eq('tahun', t).eq('jenis', 'Ihsan Guru');
    _check(error, 'getIhsanStatusGuru');
    var lunas = [];
    (data||[]).forEach(function(r) {
      if (r.status === 'lunas') lunas.push(r.bulan);
    });
    return { status:'ok', data: { lunas: lunas } };
  },

  // Input pembayaran SPP langsung oleh admin (tanpa murid konfirmasi)
  // d: { id_murid, bulan (array), tahun, jenis, nominal, catatan }
  inputSPPManual: async function(d) {
    var id_murid = d.id_murid;
    if (!id_murid) throw new Error('Murid belum dipilih.');
    var bulanList = Array.isArray(d.bulan) ? d.bulan : [d.bulan];
    if (!bulanList.length) throw new Error('Pilih minimal 1 bulan.');
    var tahun = Number(d.tahun) || new Date().getFullYear();
    var jenis = d.jenis || 'SPP Pribadi';

    // Ambil data anggota untuk denormalisasi
    var { data: anggota } = await _sb.from('anggota').select('nama_murid, id_halaqah')
      .eq('id_murid', id_murid).eq('status', 'aktif').maybeSingle();
    var nama_murid = (anggota && anggota.nama_murid) || '';
    var id_halaqah = (anggota && anggota.id_halaqah) || '';

    // Jika nama_murid kosong, fallback ke tabel users
    if (!nama_murid) {
      var { data: usr } = await _sb.from('users').select('nama_lengkap').eq('id_user', id_murid).maybeSingle();
      nama_murid = (usr && usr.nama_lengkap) || '';
    }

    // Generate id_spp IDENTIK dengan format MuridAPI.konfirmasiSPP
    var jenisSuffix = jenis.replace(/\s+/g,'').substring(0,3).toUpperCase();
    var idSppMap = {};
    bulanList.forEach(function(bulan) {
      var id = 'SPP-' + id_murid + '-' + bulan.substring(0,3).toUpperCase() + '-' + tahun + '-' + jenisSuffix;
      if (jenis === 'Infaq/Operasional' || jenis === 'Ihsan Guru') {
        id += '-' + Math.random().toString(36).substring(2,10).toUpperCase();
      }
      idSppMap[bulan] = id;
    });

    // Cek bulan yang sudah lunas — skip (untuk SPP Pribadi saja, untuk Infaq & Ihsan Guru tidak skip karena bisa multi-payment)
    var bulanProses = bulanList;
    if (jenis === 'SPP Pribadi') {
      var idSppList = Object.values(idSppMap);
      var { data: existingRows } = await _sb.from('spp_pembayaran')
        .select('id_spp, status').in('id_spp', idSppList);
      var sudahLunasSet = new Set(
        (existingRows || []).filter(function(r){ return r.status === 'lunas'; }).map(function(r){ return r.id_spp; })
      );
      bulanProses = bulanList.filter(function(bulan) {
        return !sudahLunasSet.has(idSppMap[bulan]);
      });
    }
    
    if (!bulanProses.length) {
      return { status: 'ok', message: 'Semua bulan yang dipilih sudah lunas sebelumnya.', count: 0 };
    }

    var now = new Date();
    var todayWIB = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    var nominalPerBulan = bulanProses.length > 1
      ? Math.round(Number(d.nominal || 0) / bulanProses.length)
      : Number(d.nominal || 0);

    var rows = bulanProses.map(function(bulan) {
      return {
        id_spp       : idSppMap[bulan],
        id_murid     : id_murid,
        nama_murid   : nama_murid,
        id_halaqah   : id_halaqah,
        bulan        : bulan,
        tahun        : tahun,
        jenis        : jenis,
        status       : 'lunas',
        nominal      : nominalPerBulan,
        metode_bayar : 'admin_manual',
        metode_transfer: null,
        bukti_url    : null,
        catatan      : d.catatan || 'Input manual oleh admin',
        tanggal_bayar: todayWIB,
        validated_by : _uid(),
        validated_at : now.toISOString(),
        mayar_expired_at  : null,
        mayar_invoice_id  : null,
        mayar_payment_link: null,
      };
    });

    var { error } = await _sb.from('spp_pembayaran').upsert(rows, { onConflict: 'id_spp' });
    _check(error, 'inputSPPManual');

    _logAudit('input_spp_manual', {
      id_murid: id_murid, nama_murid: nama_murid,
      bulan: bulanProses, tahun: tahun, jenis: jenis,
      nominal: d.nominal, count: bulanProses.length,
    });

    // Push notification ke murid (HANYA untuk SPP Pribadi / Infaq, Guru tidak mendapat notifikasi)
    if (id_murid && jenis !== 'Ihsan Guru') {
      var bulanLabel = bulanProses.length > 1
        ? bulanProses.length + ' bulan'
        : bulanProses[0] + ' ' + tahun;
      _sendPushBg({
        user_ids: [id_murid],
        title: '✅ SPP Dicatat Lunas oleh Admin',
        body : 'Pembayaran ' + (jenis === 'SPP Pribadi' ? 'SPP ' : 'Infaq ') + bulanLabel + ' sudah dicatat lunas. Jazakallahu khairan!',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'spp-admin-manual-' + id_murid + '-' + tahun,
        data : { trigger: 'spp_lunas' },
      });
    }

    return { status:'ok', message: bulanProses.length + ' bulan berhasil dicatat lunas.', count: bulanProses.length };
  },

  // Riwayat konfirmasi terbaru (manual maupun otomatis via gateway) — untuk
  // menemukan & membatalkan salah konfirmasi tanpa perlu SQL manual.
  getSPPRecentValidasi: async function() {
    var { data: manual, error: e1 } = await _sb.from('spp_pembayaran')
      .select('*').not('validated_by','is',null)
      .order('validated_at',{ascending:false}).limit(10);
    _check(e1,'getSPPRecentValidasi');
    var { data: gateway, error: e2 } = await _sb.from('spp_pembayaran')
      .select('*').eq('metode_bayar','gateway').eq('status','lunas').is('validated_by',null)
      .order('tanggal_bayar',{ascending:false}).limit(10);
    _check(e2,'getSPPRecentValidasi');
    var all = (manual||[]).concat(gateway||[]);
    all.forEach(function(r) {
      r._when = r.validated_at || (r.tanggal_bayar ? r.tanggal_bayar + 'T00:00:00Z' : r.created_at);
    });
    all.sort(function(a,b) { return new Date(b._when) - new Date(a._when); });
    return { status:'ok', data: all.slice(0,10) };
  },
  // Batalkan konfirmasi/penolakan yang salah — kembalikan ke 'menunggu'
  // supaya bisa dikonfirmasi ulang dengan benar (tanpa SQL manual).
  batalkanValidasiSPP: async function(id_spp) {
    var { data: sppRow } = await _sb.from('spp_pembayaran').select('id_murid, bulan, tahun, status').eq('id_spp', id_spp).maybeSingle();
    if (!sppRow || (sppRow.status !== 'lunas' && sppRow.status !== 'ditolak')) {
      return { status:'error', message:'Status saat ini tidak bisa dibatalkan.' };
    }
    var { data: updRows, error } = await _sb.from('spp_pembayaran').update({
      status: 'menunggu', validated_by: null, validated_at: null, tanggal_bayar: null,
      mayar_expired_at: null, metode_bayar: 'manual',
    }).eq('id_spp', id_spp).in('status', ['lunas','ditolak']).select('id_spp');
    _check(error,'batalkanValidasiSPP');
    if (!updRows || !updRows.length) {
      return { status:'error', message:'Status sudah berubah, gagal membatalkan.' };
    }
    _logAudit('batal_validasi_spp', {id_spp: id_spp, status_sebelumnya: sppRow.status, id_murid: sppRow.id_murid});
    return { status:'ok' };
  },
  getSPPRekap: async function(p) {
    // p: { tahun, id_halaqah, bulan }
    var tahun = p && p.tahun ? Number(p.tahun) : new Date().getFullYear();
    // Ambil seluruh pembayaran lunas untuk tahun tersebut (baik SPP Pribadi, Infaq/Operasional, maupun Ihsan Guru)
    var q = _sb.from('spp_pembayaran').select('*').eq('tahun', tahun).eq('status','lunas');
    if (p && p.bulan)      q = q.eq('bulan', p.bulan);
    var { data: sppData, error } = await q;
    _check(error,'getSPPRekap');

    // Saring berdasarkan id_halaqah di memori agar Ihsan Guru tidak ikut tersaring keluar
    var sppFiltered = sppData || [];
    if (p && p.id_halaqah) {
      sppFiltered = sppFiltered.filter(function(s) {
        return s.id_halaqah === p.id_halaqah || s.jenis === 'Ihsan Guru';
      });
    }

    // Filter berdasarkan jenis pembayaran
    var sppPribadi = sppFiltered.filter(function(s){ return s.jenis === 'SPP Pribadi' || !s.jenis; });
    var infaqData = sppFiltered.filter(function(s){ return s.jenis === 'Infaq/Operasional'; });
    var ihsanData = sppFiltered.filter(function(s){ return s.jenis === 'Ihsan Guru'; });

    // Ambil semua anggota aktif untuk cross-check
    var anggotaQ = _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, level, tipe_spp, halaqah(nama_halaqah, id_guru)').eq('status','aktif');
    if (p && p.id_halaqah) anggotaQ = anggotaQ.eq('id_halaqah', p.id_halaqah);
    var { data: anggota } = await anggotaQ;
    // Ambil no_hp terpisah untuk hindari FK join error
    var muridIds = (anggota||[]).map(function(a){ return a.id_murid; });
    var hpMap = {};
    if (muridIds.length) {
      var { data: usersHp } = await _sb.from('users').select('id_user, no_hp').in('id_user', muridIds);
      (usersHp||[]).forEach(function(u){ hpMap[u.id_user] = u.no_hp; });
    }
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var TOTAL_REKAP   = 12;
    var WINDOW_SIZE   = 5; // jumlah bulan kewajiban berturut-turut sejak bulan pertama murid bayar
    // Bulan terakhir yang sudah selesai (getMonth() tanpa +1: Juni=5 → Jan-Mei sudah lewat)
    var bulanSelesai  = new Date().getMonth(); // 0-indexed, eksklusif
    // Window default (untuk murid yang belum pernah punya catatan SPP Pribadi tahun ini):
    // dari Januari sampai bulan berjalan.
    var startIdx = Math.max(0, bulanSelesai - TOTAL_REKAP);
    var endIdx   = bulanSelesai;
    var bulanRekapDefault = BULAN.slice(startIdx, endIdx);

    // Cari bulan pertama tiap murid mulai punya catatan SPP Pribadi tahun ini —
    // murid yang baru mulai/bayar di muka (mis. baru tercatat mulai Oktober)
    // tidak dianggap nunggak untuk bulan-bulan sebelum itu.
    var firstBulanMap = {};
    if (muridIds.length) {
      var allSppRows = await _selectAllPaged('spp_pembayaran', 'id_spp, id_murid, bulan, jenis',
        function(q){ return q.eq('tahun', tahun).in('id_murid', muridIds).order('id_spp'); },
        'getSPPRekap:allSppRows');
      (allSppRows||[]).forEach(function(r){
        if (r.jenis && r.jenis !== 'SPP Pribadi') return;
        var idx = BULAN.indexOf(r.bulan);
        if (idx < 0) return;
        if (firstBulanMap[r.id_murid] === undefined || idx < firstBulanMap[r.id_murid]) {
          firstBulanMap[r.id_murid] = idx;
        }
      });
    }

    // Map id_murid → bulan lunas (menggunakan data SPP Pribadi saja)
    var lunasMap = {};
    sppPribadi.forEach(function(s){
      if (!lunasMap[s.id_murid]) lunasMap[s.id_murid] = [];
      lunasMap[s.id_murid].push(s.bulan);
    });
    var muridListRaw = (anggota||[]).map(function(a) {
      var lunasBulan = lunasMap[a.id_murid] || [];
      var firstIdx = firstBulanMap[a.id_murid];
      var isBeasiswa = a.tipe_spp === 'beasiswa';
      var bulanBelum, tunggakan, winLen;
      if (isBeasiswa) {
        // Murid beasiswa: SPP Pribadi dibebaskan → tak pernah nunggak.
        // Dikeluarkan dari hitungan lunas/menunggak (kategori terpisah, lihat bawah).
        bulanBelum = [];
        tunggakan  = 0;
        winLen     = 0;
      } else if (firstIdx === undefined) {
        // Belum pernah punya catatan SPP Pribadi sama sekali → anggap nunggak WINDOW_SIZE bulan
        bulanBelum = [];
        tunggakan  = WINDOW_SIZE;
        winLen     = WINDOW_SIZE;
      } else {
        // Window kewajiban = WINDOW_SIZE bulan berturut-turut mulai dari bulan
        // pertama murid bayar, melingkar ke tahun berikutnya jika perlu
        // (mis. mulai Oktober → Okt, Nov, Des, Jan, Feb).
        var bulanRekapMurid = [];
        for (var i = 0; i < WINDOW_SIZE; i++) {
          bulanRekapMurid.push(BULAN[(firstIdx + i) % 12]);
        }
        bulanBelum = bulanRekapMurid.filter(function(b){ return !lunasBulan.includes(b); });
        tunggakan  = bulanBelum.length;
        winLen     = bulanRekapMurid.length;
      }
      return {
        id_murid: a.id_murid, nama_murid: a.nama_murid,
        id_halaqah: a.id_halaqah, nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '',
        level: a.level, no_hp: hpMap[a.id_murid] || '',
        lunas_bulan: lunasBulan, tunggakan, bulan_belum: bulanBelum,
        _winLen: winLen, is_beasiswa: isBeasiswa,
      };
    }).sort(function(a,b){ return b.tunggakan - a.tunggakan || a.nama_murid.localeCompare(b.nama_murid); });

    // Map id_murid → info halaqah/level (untuk daftar Infaq)
    var anggotaMap = {};
    (anggota||[]).forEach(function(a){
      anggotaMap[a.id_murid] = { nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '', id_halaqah: a.id_halaqah, level: a.level };
    });
    // Daftar pembayaran Infaq/Operasional (per transaksi, untuk Rekap Pembayaran)
    var infaqList = infaqData.map(function(r){
      var info = anggotaMap[r.id_murid] || {};
      return {
        id_murid: r.id_murid, nama_murid: r.nama_murid,
        id_halaqah: r.id_halaqah || info.id_halaqah || '', nama_halaqah: info.nama_halaqah || '',
        level: info.level || '', bulan: r.bulan, tahun: r.tahun,
        nominal: r.nominal, tanggal_bayar: r.tanggal_bayar, metode_bayar: r.metode_bayar,
      };
    }).sort(function(a,b){ return (b.tanggal_bayar||'').localeCompare(a.tanggal_bayar||'') || a.nama_murid.localeCompare(b.nama_murid); });

    // Hitung masing-masing total nominal
    var totalSPP = sppPribadi.reduce(function(s,r){return s+Number(r.nominal||0);},0);
    var totalInfaq = infaqData.reduce(function(s,r){return s+Number(r.nominal||0);},0);
    var totalIhsan = ihsanData.reduce(function(s,r){return s+Number(r.nominal||0);},0);

    // Hitung total masuk (pemasukan SPP + Infaq) & saldo net
    var totalMasuk = totalSPP + totalInfaq;
    var totalNet = totalMasuk - totalIhsan;

    // Hitung breakdown metode bayar (Gateway vs Manual)
    var sppGatewayNominal = 0;
    var sppGatewayCount = 0;
    var sppManualNominal = 0;
    var sppManualCount = 0;
    sppPribadi.forEach(function(s) {
      if (s.metode_bayar === 'gateway') {
        sppGatewayNominal += Number(s.nominal || 0);
        sppGatewayCount++;
      } else {
        sppManualNominal += Number(s.nominal || 0);
        sppManualCount++;
      }
    });

    var infaqGatewayNominal = 0;
    var infaqGatewayCount = 0;
    var infaqManualNominal = 0;
    var infaqManualCount = 0;
    infaqData.forEach(function(s) {
      if (s.metode_bayar === 'gateway') {
        infaqGatewayNominal += Number(s.nominal || 0);
        infaqGatewayCount++;
      } else {
        infaqManualNominal += Number(s.nominal || 0);
        infaqManualCount++;
      }
    });

    var totalGatewayNominal = sppGatewayNominal + infaqGatewayNominal;
    var totalGatewayCount = sppGatewayCount + infaqGatewayCount;
    var totalManualNominal = sppManualNominal + infaqManualNominal;
    var totalManualCount = sppManualCount + infaqManualCount;

    // ── Murid beasiswa = ember ketiga (dikeluarkan dari lunas & menunggak) ──
    var beasiswa_count = muridListRaw.filter(function(m){ return m.is_beasiswa; }).length;
    // Lunas = tunggakan===0 DAN window kewajibannya tidak kosong (non-beasiswa saja)
    var lunas     = muridListRaw.filter(function(m){ return !m.is_beasiswa && m.tunggakan===0 && m._winLen>0; }).length;
    var menunggak = muridListRaw.filter(function(m){ return !m.is_beasiswa && m.tunggakan>0; }).length;

    // ── Distribusi sisa donasi ke guru pengajar murid beasiswa (basis per bulan) ──
    var bulanTarget = (p && p.bulan) ? p.bulan : BULAN[new Date().getMonth()];
    var bulanIdx    = BULAN.indexOf(bulanTarget) + 1;
    // Infaq per bulan via tanggal_bayar (RPC; kolom bulan infaq selalu '-')
    var infaqBulananRes = await _sb.rpc('get_infaq_bulanan', { p_bulan_idx: bulanIdx, p_tahun: tahun });
    var infaq_bulanan = Number((infaqBulananRes && infaqBulananRes.data) || 0);
    // Operasional bulan tersebut
    var opQ = await _sb.from('operasional').select('nominal').eq('tahun', tahun).eq('bulan', bulanTarget);
    var operasional_total = (opQ.data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    var sisa_donasi = infaq_bulanan - operasional_total;
    // Guru distinct (id_guru non-null) yang mengajar murid beasiswa
    var beasiswaGuruSet = {};
    (anggota||[]).forEach(function(a){
      if (a.tipe_spp === 'beasiswa' && a.halaqah && a.halaqah.id_guru) beasiswaGuruSet[a.halaqah.id_guru] = true;
    });
    var guru_beasiswa_count = Object.keys(beasiswaGuruSet).length;
    var bagian_per_guru = (sisa_donasi > 0 && guru_beasiswa_count > 0) ? Math.floor(sisa_donasi / guru_beasiswa_count) : 0;

    var muridList = muridListRaw.map(function(m){
      return { id_murid:m.id_murid, nama_murid:m.nama_murid, id_halaqah:m.id_halaqah, nama_halaqah:m.nama_halaqah,
        level:m.level, no_hp:m.no_hp, lunas_bulan:m.lunas_bulan, tunggakan:m.tunggakan, bulan_belum:m.bulan_belum, is_beasiswa:m.is_beasiswa };
    });
    return { status:'ok', data:{ murid_list: muridList, infaq_list: infaqList,
      ihsan_list: ihsanData.map(function(r) {
        return {
          id_spp: r.id_spp,
          id_murid: r.id_murid,
          nama_murid: r.nama_murid,
          bulan: r.bulan,
          tahun: r.tahun,
          nominal: r.nominal,
          tanggal_bayar: r.tanggal_bayar,
          catatan: r.catatan
        };
      }).sort(function(a,b){ return (b.tanggal_bayar||'').localeCompare(a.tanggal_bayar||'') || a.nama_murid.localeCompare(b.nama_murid); }),
      total_nominal: totalSPP, total_infaq: totalInfaq, total_ihsan: totalIhsan, total_masuk: totalMasuk, total_net: totalNet, lunas, menunggak, tahun,
      spp_gateway_nominal: sppGatewayNominal, spp_gateway_count: sppGatewayCount,
      spp_manual_nominal: sppManualNominal, spp_manual_count: sppManualCount,
      infaq_gateway_nominal: infaqGatewayNominal, infaq_gateway_count: infaqGatewayCount,
      infaq_manual_nominal: infaqManualNominal, infaq_manual_count: infaqManualCount,
      total_gateway_nominal: totalGatewayNominal, total_gateway_count: totalGatewayCount,
      total_manual_nominal: totalManualNominal, total_manual_count: totalManualCount,
      bulan_rekap: bulanRekapDefault, total_rekap: TOTAL_REKAP, window_size: WINDOW_SIZE,
      // ── Beasiswa & distribusi sisa donasi ──
      beasiswa_count: beasiswa_count,
      beasiswa_bulan: bulanTarget,
      beasiswa_infaq_bulanan: infaq_bulanan,
      beasiswa_operasional: operasional_total,
      beasiswa_sisa: sisa_donasi,
      beasiswa_guru_count: guru_beasiswa_count,
      beasiswa_bagian_per_guru: bagian_per_guru } };
  },
  // ── Operasional (ledger pengeluaran bulanan) ────────────────
  getOperasional: async function(p) {
    var tahun = p && p.tahun ? Number(p.tahun) : new Date().getFullYear();
    var q = _sb.from('operasional').select('*').eq('tahun', tahun);
    if (p && p.bulan) q = q.eq('bulan', p.bulan);
    var { data, error } = await q.order('created_at', { ascending:false });
    _check(error,'getOperasional');
    var total = (data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: data||[], total: total };
  },
  tambahOperasional: async function(d) {
    var { error } = await _sb.from('operasional').insert({
      bulan: d.bulan, tahun: Number(d.tahun), keterangan: d.keterangan,
      nominal: Number(d.nominal), catatan: d.catatan || null, created_by: _uid(),
    });
    _check(error,'tambahOperasional');
    return { status:'ok' };
  },
  updateOperasional: async function(d) {
    var { id_operasional } = d, u = {};
    ['bulan','tahun','keterangan','nominal','catatan'].forEach(function(k){ if (d[k] !== undefined) u[k] = d[k]; });
    if (u.nominal != null) u.nominal = Number(u.nominal);
    if (u.tahun   != null) u.tahun   = Number(u.tahun);
    var { error } = await _sb.from('operasional').update(u).eq('id_operasional', id_operasional);
    _check(error,'updateOperasional');
    return { status:'ok' };
  },
  hapusOperasional: async function(id_operasional) {
    var { error } = await _sb.from('operasional').delete().eq('id_operasional', id_operasional);
    _check(error,'hapusOperasional');
    return { status:'ok' };
  },
  // ── Kas / Buku Kas umum (dua arah: masuk & keluar) ──────────
  // Additive: TIDAK menyentuh operasional/spp_pembayaran. Laporan Arus Kas
  // (getArusKas) menggabungkan sumber-sumber di lapisan aplikasi. RLS: tulis
  // admin, baca authenticated (patch_077).
  getKas: async function(p) {
    p = p || {};
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var tahun = p.tahun ? Number(p.tahun) : new Date().getFullYear();
    var q = _sb.from('kas').select('*');
    // Periode: rentang (bulanStart..bulanEnd) | bulan tunggal | setahun penuh
    var sIdx = -1, eIdx = -1;
    if (p.bulanStart && p.bulanEnd) { sIdx = BULAN.indexOf(p.bulanStart); eIdx = BULAN.indexOf(p.bulanEnd); }
    else if (p.bulan)               { sIdx = eIdx = BULAN.indexOf(p.bulan); }
    if (sIdx >= 0 && eIdx >= 0) {
      if (sIdx > eIdx) { var _t = sIdx; sIdx = eIdx; eIdx = _t; }
      var pad = function(n){ return (n < 10 ? '0' : '') + n; };
      var start = tahun + '-' + pad(sIdx + 1) + '-01';
      var endY  = eIdx === 11 ? tahun + 1 : tahun;
      var endM  = eIdx === 11 ? 1 : eIdx + 2;
      var end   = endY + '-' + pad(endM) + '-01';
      q = q.gte('tanggal', start).lt('tanggal', end);
    } else {
      q = q.gte('tanggal', tahun + '-01-01').lt('tanggal', (tahun + 1) + '-01-01');
    }
    if (p.arah)     q = q.eq('arah', p.arah);
    if (p.kategori) q = q.eq('kategori', p.kategori);
    var { data, error } = await q.order('tanggal', { ascending:false }).order('created_at', { ascending:false });
    _check(error,'getKas');
    var total = (data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: data||[], total: total };
  },
  tambahKas: async function(d) {
    var { data, error } = await _sb.from('kas').insert({
      tanggal: d.tanggal || new Date().toISOString().slice(0,10),
      arah: d.arah, kategori: d.kategori,
      nominal: Number(d.nominal), keterangan: d.keterangan,
      penerima: d.penerima || null, metode: d.metode || null,
      bukti_url: d.bukti_url || null, catatan: d.catatan || null,
      created_by: _uid(),
    }).select('id_kas').single();
    _check(error,'tambahKas');
    _logAudit('tambah_kas', { id_kas: data && data.id_kas, arah: d.arah, kategori: d.kategori, nominal: Number(d.nominal) });
    return { status:'ok', data: data };
  },
  updateKas: async function(d) {
    var { id_kas } = d, u = {};
    ['tanggal','arah','kategori','nominal','keterangan','penerima','metode','bukti_url','catatan'].forEach(function(k){ if (d[k] !== undefined) u[k] = d[k]; });
    if (u.nominal != null) u.nominal = Number(u.nominal);
    var { error } = await _sb.from('kas').update(u).eq('id_kas', id_kas);
    _check(error,'updateKas');
    _logAudit('update_kas', { id_kas: id_kas, changes: u });
    return { status:'ok' };
  },
  hapusKas: async function(id_kas) {
    var { error } = await _sb.from('kas').delete().eq('id_kas', id_kas);
    _check(error,'hapusKas');
    _logAudit('hapus_kas', { id_kas: id_kas });
    return { status:'ok' };
  },
  // ── Kategori Kas konfigurabel (patch_078) ───────────────────
  // 'Operasional' (keluar) dikunci (kunci=true) karena dipakai routing ke tabel
  // operasional. 'Honor Guru' diblokir (diinput via Ihsan Guru, bukan Buku Kas).
  getKasKategori: async function() {
    var { data, error } = await _sb.from('kas_kategori').select('*')
      .order('arah', { ascending:true }).order('urutan', { ascending:true }).order('nama', { ascending:true });
    _check(error,'getKasKategori');
    return { status:'ok', data: data||[] };
  },
  tambahKasKategori: async function(d) {
    var nama = (d.nama||'').trim();
    var arah = d.arah === 'masuk' ? 'masuk' : 'keluar';
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    if (arah === 'keluar' && nama.toLowerCase() === 'honor guru')
      throw new Error('Honor Guru diinput lewat tombol "Ihsan Guru", bukan Buku Kas.');
    var { data, error } = await _sb.from('kas_kategori')
      .insert({ arah: arah, nama: nama, urutan: Number(d.urutan)||0, created_by: _uid() })
      .select('id_kk').single();
    if (error && (error.code === '23505' || /duplicate|unique/i.test(error.message||'')))
      throw new Error('Kategori "'+nama+'" sudah ada di sisi '+arah+'.');
    _check(error,'tambahKasKategori');
    _logAudit('tambah_kas_kategori', { arah: arah, nama: nama });
    return { status:'ok', data: data };
  },
  updateKasKategori: async function(d) {
    var nama = (d.nama||'').trim();
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    var { data: cur } = await _sb.from('kas_kategori').select('kunci, arah, nama').eq('id_kk', d.id_kk).single();
    if (cur && cur.kunci) throw new Error('Kategori "'+cur.nama+'" terkunci (sistem) — tak bisa diubah.');
    if (cur && cur.arah === 'keluar' && nama.toLowerCase() === 'honor guru')
      throw new Error('Honor Guru diinput lewat tombol "Ihsan Guru", bukan Buku Kas.');
    var u = { nama: nama };
    if (d.urutan !== undefined) u.urutan = Number(d.urutan)||0;
    var { error } = await _sb.from('kas_kategori').update(u).eq('id_kk', d.id_kk);
    if (error && (error.code === '23505' || /duplicate|unique/i.test(error.message||'')))
      throw new Error('Nama kategori "'+nama+'" sudah dipakai.');
    _check(error,'updateKasKategori');
    _logAudit('update_kas_kategori', { id_kk: d.id_kk, nama: nama });
    return { status:'ok' };
  },
  hapusKasKategori: async function(id_kk) {
    var { data: cur } = await _sb.from('kas_kategori').select('kunci, nama').eq('id_kk', id_kk).single();
    if (cur && cur.kunci) throw new Error('Kategori "'+cur.nama+'" terkunci (sistem) — tak bisa dihapus.');
    var { error } = await _sb.from('kas_kategori').delete().eq('id_kk', id_kk);
    _check(error,'hapusKasKategori');
    _logAudit('hapus_kas_kategori', { id_kk: id_kk });
    return { status:'ok' };
  },
  // Laporan Arus Kas (rentang bulan): sisi MASUK = SPP Pribadi lunas + Infaq
  // lunas + kas(masuk); sisi KELUAR = kas(keluar) + operasional + Ihsan Guru
  // (gaji). Ihsan Guru TIDAK dihitung sebagai pemasukan. Infaq via RPC
  // get_infaq_bulanan per bulan (kolom bulan infaq selalu '-', periode dari
  // tanggal_bayar) lalu dijumlah — konsisten dgn transparansi murid & beasiswa.
  // Terima {tahun, bulan} (tunggal, legacy) ATAU {tahun, bulanStart, bulanEnd}.
  getArusKas: async function(p) {
    p = p || {};
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var tahun = p.tahun ? Number(p.tahun) : new Date().getFullYear();
    // Resolusi periode → indeks bulan [startIdx..endIdx]
    var startIdx, endIdx;
    if (p.bulanStart && p.bulanEnd) { startIdx = BULAN.indexOf(p.bulanStart); endIdx = BULAN.indexOf(p.bulanEnd); }
    else if (p.bulan)               { startIdx = endIdx = BULAN.indexOf(p.bulan); }
    else                            { startIdx = endIdx = new Date().getMonth(); }
    if (startIdx < 0) startIdx = new Date().getMonth();
    if (endIdx   < 0) endIdx   = new Date().getMonth();
    if (startIdx > endIdx) { var _t = startIdx; startIdx = endIdx; endIdx = _t; }
    var monthNames = BULAN.slice(startIdx, endIdx + 1);

    // 1. SPP Pribadi + Ihsan Guru lunas dlm rentang (keduanya pakai kolom bulan = nama bulan)
    var { data: sppRows, error: sppErr } = await _sb.from('spp_pembayaran')
      .select('id_spp, id_murid, nama_murid, jenis, bulan, tahun, nominal, tanggal_bayar, metode_bayar, catatan')
      .eq('tahun', tahun).in('bulan', monthNames).eq('status','lunas');
    _check(sppErr,'getArusKas:spp');
    var sppPribadiRows = (sppRows||[]).filter(function(s){ return s.jenis === 'SPP Pribadi' || !s.jenis; });
    var ihsanRows      = (sppRows||[]).filter(function(s){ return s.jenis === 'Ihsan Guru'; });
    var sppMasuk    = sppPribadiRows.reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    var ihsanKeluar = ihsanRows.reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);

    // 2. Infaq per bulan (RPC — periode via tanggal_bayar), dijumlah utk rentang
    var infaqPromises = [];
    for (var mi = startIdx; mi <= endIdx; mi++) infaqPromises.push(_sb.rpc('get_infaq_bulanan', { p_bulan_idx: mi + 1, p_tahun: tahun }));
    var infaqResults = await Promise.all(infaqPromises);
    var infaqMasuk = 0, infaqPerBulan = [];
    infaqResults.forEach(function(r, i){ var n = Number((r && r.data) || 0); infaqMasuk += n; if (n > 0) infaqPerBulan.push({ bulan: BULAN[startIdx + i], nominal: n }); });

    // 3. Operasional dlm rentang (tabel lama, TIDAK disentuh) — ambil setahun lalu saring
    var opAll = await this.getOperasional({ tahun: tahun });
    var opRows = (opAll.data || []).filter(function(o){ return monthNames.indexOf(o.bulan) >= 0; });
    var operasionalKeluar = opRows.reduce(function(s,o){ return s+Number(o.nominal||0); }, 0);

    // 4. Kas umum dlm rentang
    var kasRes = await this.getKas({ tahun: tahun, bulanStart: monthNames[0], bulanEnd: monthNames[monthNames.length - 1] });
    var kasRows = kasRes.data || [];
    var kasMasuk = 0, kasKeluar = 0, bMasuk = {}, bKeluar = {};
    kasRows.forEach(function(k){
      var n = Number(k.nominal||0);
      if (k.arah === 'masuk') { kasMasuk += n; bMasuk[k.kategori] = (bMasuk[k.kategori]||0)+n; }
      else { kasKeluar += n; bKeluar[k.kategori] = (bKeluar[k.kategori]||0)+n; }
    });

    var totalMasuk  = sppMasuk + infaqMasuk + kasMasuk;
    var totalKeluar = kasKeluar + operasionalKeluar + ihsanKeluar;

    // Breakdown per kategori (untuk grafik)
    var breakdownMasuk = [];
    if (sppMasuk   > 0) breakdownMasuk.push({ kategori:'SPP Pribadi', nominal: sppMasuk });
    if (infaqMasuk > 0) breakdownMasuk.push({ kategori:'Infaq', nominal: infaqMasuk });
    Object.keys(bMasuk).forEach(function(k){ breakdownMasuk.push({ kategori:k, nominal:bMasuk[k] }); });
    var breakdownKeluar = [];
    if (ihsanKeluar       > 0) breakdownKeluar.push({ kategori:'Honor Guru (Ihsan)', nominal: ihsanKeluar });
    if (operasionalKeluar > 0) breakdownKeluar.push({ kategori:'Operasional', nominal: operasionalKeluar });
    Object.keys(bKeluar).forEach(function(k){ breakdownKeluar.push({ kategori:k, nominal:bKeluar[k] }); });
    breakdownMasuk.sort(function(a,b){ return b.nominal - a.nominal; });
    breakdownKeluar.sort(function(a,b){ return b.nominal - a.nominal; });

    // Riwayat gabungan kronologis (bertanggal dulu desc, agregat tanpa tanggal di akhir)
    var riwayat = [];
    kasRows.forEach(function(k){
      riwayat.push({ source:'kas', id:k.id_kas, tanggal:k.tanggal, arah:k.arah,
        kategori:k.kategori, nominal:Number(k.nominal||0), keterangan:k.keterangan,
        penerima:k.penerima||null, metode:k.metode||null, catatan:k.catatan||null });
    });
    opRows.forEach(function(o){
      riwayat.push({ source:'operasional', id:o.id_operasional, tanggal:null, arah:'keluar',
        kategori:'Operasional', nominal:Number(o.nominal||0), keterangan:(o.keterangan||'')+' ('+(o.bulan||'')+')',
        penerima:null, metode:null, catatan:o.catatan||null });
    });
    ihsanRows.forEach(function(x){
      riwayat.push({ source:'ihsan', id:x.id_spp, tanggal:x.tanggal_bayar||null, arah:'keluar',
        kategori:'Honor Guru (Ihsan)', nominal:Number(x.nominal||0),
        keterangan:'Ihsan Guru — '+(x.nama_murid||''), penerima:x.nama_murid||null, metode:x.metode_bayar||null, catatan:x.catatan||null });
    });
    sppPribadiRows.forEach(function(s){
      riwayat.push({ source:'spp', id:s.id_spp, tanggal:s.tanggal_bayar||null, arah:'masuk',
        kategori:'SPP Pribadi', nominal:Number(s.nominal||0),
        keterangan:'SPP '+(s.bulan||'')+' — '+(s.nama_murid||''), penerima:s.nama_murid||null, metode:s.metode_bayar||null, catatan:s.catatan||null });
    });
    // Infaq: satu baris agregat per bulan (per-baris individu tak tersedia bersih via kolom bulan='-')
    infaqPerBulan.forEach(function(x){
      riwayat.push({ source:'infaq', id:'infaq-'+tahun+'-'+x.bulan, tanggal:null, arah:'masuk',
        kategori:'Infaq', nominal:x.nominal, keterangan:'Infaq/Operasional ('+x.bulan+')', penerima:null, metode:null, catatan:null });
    });
    riwayat.sort(function(a,b){
      var ta = a.tanggal || '', tb = b.tanggal || '';
      if (ta && tb) return tb.localeCompare(ta);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return 0;
    });

    return { status:'ok', data:{
      tahun: tahun, bulan_start: monthNames[0], bulan_end: monthNames[monthNames.length - 1],
      total_masuk: totalMasuk, total_keluar: totalKeluar, saldo: totalMasuk - totalKeluar,
      masuk:  { spp_pribadi: sppMasuk, infaq: infaqMasuk, kas: kasMasuk },
      keluar: { kas: kasKeluar, operasional: operasionalKeluar, ihsan: ihsanKeluar },
      breakdown_masuk: breakdownMasuk, breakdown_keluar: breakdownKeluar,
      riwayat: riwayat,
    }};
  },
  exportRekapAbsensi: async function(p) { return {status:'ok',message:'Export belum diimplementasi'}; },
  arsipData: async function() { throw new Error('Fitur arsip data belum tersedia. Data BELUM dipindahkan — jangan jadikan ini sebagai pengganti backup.'); },
  getArsipList: async function() { return {status:'ok',data:[]}; },
  deleteLevel: async function(id) { var {error}=await _sb.from('level').update({status:'nonaktif'}).eq('id_level',id); _check(error,'deleteLevel'); return {status:'ok'}; },
  // ── Import Bulk CSV — 3 Tahap ────────────────────────────────
  importTahap1: async function(d) {
    var halaqah = d.halaqah || [];
    var dibuat = [], skipped = [];
    // Ambil semua halaqah existing untuk cek duplikat & tabrakan id_halaqah
    var { data: existing } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah');
    var existingSet = new Set((existing||[]).map(function(h){return h.nama_halaqah.toLowerCase();}));
    var usedIds = new Set((existing||[]).map(function(h){return h.id_halaqah;}));
    // Ambil semua guru untuk mapping nama → id_user
    var { data: gurus } = await _sb.from('users').select('id_user, nama_lengkap').eq('role','guru');
    var guruMap = {};
    (gurus||[]).forEach(function(g){ guruMap[g.nama_lengkap.toLowerCase()] = g.id_user; });
    for (var i = 0; i < halaqah.length; i++) {
      var h = halaqah[i];
      // Trim nama_halaqah/nama_guru -- spasi liar dari CSV (mis. "Rumaysho ")
      // membuat halaqah yang sama dianggap berbeda antar baris/level.
      var namaHalaqah = (h.nama_halaqah||'').trim();
      var namaGuru    = (h.nama_guru||'').trim();
      if (existingSet.has(namaHalaqah.toLowerCase())) { skipped.push(namaHalaqah); continue; }
      var id_guru = guruMap[namaGuru.toLowerCase()] || null;
      // BUG-031 fix: nama halaqah yang berbagi 12 karakter awal yang sama
      // (mis. "Halaqah Tahsin Akhwat 1", "...2", dst) menghasilkan id_halaqah
      // yang sama -> tabrakan primary key -> insert gagal diam-diam. Tambah
      // suffix angka jika id_halaqah sudah dipakai.
      var suffix  = namaHalaqah.replace(/^halaqah\s*/i,'').replace(/^al-?/i,'').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,12);
      var baseId  = 'HQ-' + (suffix || String(Date.now()).slice(-6));
      var id_halaqah = baseId, n = 1;
      while (usedIds.has(id_halaqah)) { n++; id_halaqah = baseId + '-' + n; }
      var { error } = await _sb.from('halaqah').insert({
        id_halaqah, nama_halaqah:namaHalaqah, id_guru, nama_guru:namaGuru,
        level:h.level||'Level 1', jadwal_hari:h.jadwal_hari||null,
        jam_mulai:_normJam(h.jam_mulai), jam_selesai:_normJam(h.jam_selesai), status:'aktif',
      });
      if (!error) { dibuat.push(namaHalaqah); existingSet.add(namaHalaqah.toLowerCase()); usedIds.add(id_halaqah); }
      else skipped.push(namaHalaqah + ' (error: ' + error.message + ')');
    }
    return { status:'ok', dibuat, skipped, message: dibuat.length + ' halaqah dibuat, ' + skipped.length + ' dilewati' };
  },

  importTahap2: async function(d) {
    var users = d.users || [];
    var berhasil = [], duplikat = 0, gagal = [];
    if (!users.length) return { status:'ok', berhasil, duplikat, gagal };
    // Cek duplikat secara batch
    var nisExisting = users.filter(function(u){return u.nis;}).map(function(u){return u.nis.toUpperCase().trim();});
    var existingSet = new Set();
    if (nisExisting.length) {
      var { data: ex } = await _sb.from('users').select('id_user').in('id_user', nisExisting);
      (ex||[]).forEach(function(u){ existingSet.add(u.id_user); });
    }
    // Cari max murid ID untuk auto-generate
    var yearPrefix = 'RTL' + new Date().getFullYear().toString().slice(2);
    var { data: lastMurid } = await _sb.from('users').select('id_user').like('id_user', yearPrefix+'%').order('id_user',{ascending:false}).limit(1);
    var lastNum = 0;
    if (lastMurid && lastMurid[0]) {
      var m = lastMurid[0].id_user.replace(yearPrefix,'');
      lastNum = parseInt(m) || 0;
    }
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      try {
        var id_user = u.nis ? u.nis.toUpperCase().trim() : '';
        if (!id_user) {
          if ((u.role||'murid') === 'murid') {
            lastNum++;
            id_user = yearPrefix + String(lastNum).padStart(6,'0');
          } else {
            // BUG-020 fix: tambah suffix numerik agar guru bernama depan sama tidak tabrakan
            var baseId = u.nama_lengkap
              .replace(/^(al-|al\s|ustadz\s|ustadzah\s)/gi, '')
              .split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g,'').substring(0, 6);
            id_user = baseId;
            // Cek dan tambah suffix jika sudah ada
            var suffix = 2;
            while (existingSet.has(id_user)) {
              id_user = baseId.substring(0, 5) + suffix;
              suffix++;
            }
          }
        }
        if (existingSet.has(id_user)) { duplikat++; continue; }
        var { error } = await _sb.from('users').insert({
          id_user, nama_lengkap:u.nama_lengkap, role:u.role||'murid',
          no_hp:u.no_hp||null, email:u.email||null,
          nama_guru:u.nama_guru||null, nama_halaqah:u.nama_halaqah||null,
          status:'aktif',
        });
        if (error) { gagal.push({nis:id_user, error:error.message}); continue; }
        if (u.password) await _sb.rpc('set_user_password', { p_id_user:id_user, p_password:u.password });
        existingSet.add(id_user);
        berhasil.push(id_user);
      } catch(e) { gagal.push({nis:u.nis||u.nama_lengkap, error:e.message}); }
    }
    return { status:'ok', berhasil, duplikat, gagal };
  },

  importTahap3: async function(d) {
    var anggota = d.anggota || [];
    var assigned = 0, not_found = [];
    if (!anggota.length) return { status:'ok', assigned, not_found };
    // Load halaqah map
    var { data: allHQ } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah').eq('status','aktif');
    var hqMap = {};
    (allHQ||[]).forEach(function(h){ hqMap[h.nama_halaqah.toLowerCase()] = h.id_halaqah; });
    // Load existing anggota untuk cek duplikat
    var { data: existAnggota } = await _sb.from('anggota').select('id_murid, id_halaqah');
    var existSet = new Set((existAnggota||[]).map(function(a){return a.id_murid+'|'+a.id_halaqah;}));
    for (var i = 0; i < anggota.length; i++) {
      var a = anggota[i];
      var id_halaqah = hqMap[(a.nama_halaqah||'').trim().toLowerCase()];
      if (!id_halaqah) { not_found.push('Halaqah tidak ditemukan: '+a.nama_halaqah); continue; }
      var id_murid = (a.nis||'').toUpperCase().trim();
      // Jika NIS kosong, cari berdasarkan nama
      if (!id_murid) {
        var { data: found } = await _sb.from('users').select('id_user').eq('nama_lengkap',a.nama_murid).eq('role','murid').maybeSingle();
        if (found) id_murid = found.id_user;
        else { not_found.push('User tidak ditemukan: '+a.nama_murid); continue; }
      }
      if (existSet.has(id_murid+'|'+id_halaqah)) { assigned++; continue; }
      var { error } = await _sb.from('anggota').insert({
        id_murid, nama_murid:a.nama_murid, id_halaqah, level:a.level||'Level 1', status:'aktif',
      });
      if (!error) { assigned++; existSet.add(id_murid+'|'+id_halaqah); }
      else not_found.push(id_murid+' (error: '+error.message+')');
    }
    return { status:'ok', assigned, not_found };
  },

  // Tautkan halaqah.id_guru yang masih kosong (mis. halaqah dibuat di
  // Tahap 1 sebelum guru-nya dibuat di Tahap 2) ke id_user guru terkait
  // berdasarkan kecocokan nama_guru <-> nama_lengkap.
  linkHalaqahGuru: async function() {
    var { data: belum } = await _sb.from('halaqah').select('id_halaqah, nama_guru').is('id_guru', null);
    if (!belum || !belum.length) return { status:'ok', linked:0 };
    var { data: gurus } = await _sb.from('users').select('id_user, nama_lengkap').eq('role','guru');
    var guruMap = {};
    (gurus||[]).forEach(function(g){ guruMap[g.nama_lengkap.toLowerCase()] = g.id_user; });
    var linked = 0;
    for (var i = 0; i < belum.length; i++) {
      var h = belum[i];
      var id_guru = h.nama_guru ? guruMap[h.nama_guru.toLowerCase()] : null;
      if (!id_guru) continue;
      var { error } = await _sb.from('halaqah').update({ id_guru: id_guru }).eq('id_halaqah', h.id_halaqah);
      if (!error) linked++;
    }
    return { status:'ok', linked: linked };
  },
  // Raport bulk — TODO: implementasi penuh
  generateRaportByHalaqah: async function(p) { return GuruAPI.generateRaportHalaqah ? GuruAPI.generateRaportHalaqah(p) : {status:'ok',data:[]}; },
  generateRaportByLevel: async function(p) {
    // p = { id_periode, level }
    if (!p || !p.id_periode || !p.level) throw new Error('id_periode dan level wajib diisi.');
    
    // 1. Ambil semua anggota aktif dari level yang diminta (lintas halaqah)
    var { data: anggota, error: errAnggota } = await _sb.from('anggota')
      .select('id_murid, nama_murid, level, id_halaqah')
      .eq('level', p.level).eq('status', 'aktif');
    _check(errAnggota, 'generateRaportByLevel:anggota');
    if (!anggota || !anggota.length) return { status: 'error', message: 'Tidak ada murid aktif dengan level ' + p.level + '.' };
    var ids = anggota.map(function(a) { return a.id_murid; });

    // 2. Ambil komponen raport (untuk non-daurah)
    var { data: komponen } = await _sb.from('komponen_raport').select('*').eq('id_periode', p.id_periode).eq('status', 'aktif').order('urutan');
    var isDaurahLevel = p.level === 'Tahsin Al-Fatihah';
    if (!isDaurahLevel && (!komponen || !komponen.length)) {
      return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini.' };
    }

    // 3. Grade config
    var { data: cfgRows } = await _sb.from('konfigurasi_raport').select('key, value');
    var cfgMap = {}; (cfgRows || []).forEach(function(r) { cfgMap[r.key] = r.value; });
    var gradeConfig = {
      mumtaz      : parseInt(cfgMap['grade_mumtaz']         || '90'),
      jayyidJiddan: parseInt(cfgMap['grade_jayyid_jiddan']  || '80'),
      jayyid      : parseInt(cfgMap['grade_jayyid']         || '70'),
      bonusPerfect: parseInt(cfgMap['bonus_perfect_attendance'] || '5'),
    };

    // 4. Periode range
    var { data: prData } = await _sb.from('periode').select('tanggal_mulai, tanggal_selesai').eq('id_periode', p.id_periode).maybeSingle();
    var pr = prData || {};
    var periodeRange = (pr.tanggal_mulai && pr.tanggal_selesai) ? { mulai: pr.tanggal_mulai, selesai: pr.tanggal_selesai } : null;

    // 5. Assessment data untuk daurah
    var asmtItems = [], asmtMurid = [];
    if (isDaurahLevel) {
      var [aiRes, amRes] = await Promise.all([
        _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').eq('status', 'aktif').order('urutan'),
        _sb.from('assessment_murid').select('*').in('id_murid', ids),
      ]);
      asmtItems = aiRes.data || [];
      asmtMurid = amRes.data || [];
    }

    // 6. Nilai manual dan KBM per halaqah (dikelompokkan)
    var nilaiManualAll = [], nilaiKBMAll = [], atLogAll = [];
    if (isDaurahLevel) {
      // Daurah hanya butuh nilai_kbm (komponen Kehadiran + Adab/Kamera, 20%); nilai_manual
      // & At-Tibyan tak dipakai cabang daurah. Tanpa fetch ini komponen KBM daurah hilang
      // (selaras generateRaportHalaqah yang memang mengambil KBM untuk daurah).
      var { data: kbmD } = await _sb.from('nilai_kbm')
        .select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').in('id_murid', ids);
      nilaiKBMAll = kbmD || [];
    } else {
      var [nmRes, kbmRes, atRes] = await Promise.all([
        _sb.from('nilai_manual').select('*').eq('id_periode', p.id_periode).in('id_murid', ids),
        _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').in('id_murid', ids),
        _sb.from('at_tibyan_log').select('id_murid, id_halaqah, status_hadir').in('id_murid', ids),
      ]);
      nilaiManualAll = nmRes.data || [];
      nilaiKBMAll    = kbmRes.data || [];
      atLogAll       = atRes.data  || [];
    }

    // 7. Generate per murid
    var berhasil = [], gagal = [];
    for (var i = 0; i < anggota.length; i++) {
      var m = anggota[i];
      try {
        var myNilaiKBM  = nilaiKBMAll.filter(function(n){ return n.id_halaqah === m.id_halaqah; });
        var myAtLog     = atLogAll.filter(function(a){ return a.id_halaqah === m.id_halaqah; });
        var raportData = _kalkulasiRaport(
          m.id_murid, p.id_periode, m.id_halaqah,
          komponen, nilaiManualAll, myNilaiKBM, myAtLog, 0,
          gradeConfig, m.level, periodeRange, asmtItems, asmtMurid
        );
        var { error: upErr } = await _sb.from('raport').upsert({
          id_murid: m.id_murid, id_periode: p.id_periode, id_halaqah: m.id_halaqah,
          nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat,
          detail_json: raportData.komponen,
          tanggal_cetak: _localDate(),
          status: 'draft',
        }, { onConflict: 'id_murid,id_periode' });
        if (upErr) throw new Error(upErr.message);
        berhasil.push({ nama_murid: m.nama_murid, nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat });
      } catch(e) { gagal.push({ id_murid: m.id_murid, nama: m.nama_murid, alasan: e.message }); }
    }
    return { status: 'ok', message: berhasil.length + ' raport berhasil digenerate (level: ' + p.level + ')', data: { berhasil, gagal } };
  },
  generateRaportBulk: async function(p) { throw new Error('Generate raport bulk belum diimplementasi.'); },
  kirimRaportEmail: async function(id) { throw new Error('Kirim raport via email belum diimplementasi.'); },
  getObservasiStats: async function(p) {
    p = p || {};
    var { data, error } = await _sb.from('observasi_kbm')
      .select('*, halaqah(nama_halaqah, id_guru, nama_guru)')
      .order('created_at', { ascending: false });
    _check(error, 'getObservasiStats');
    var list = data || [];
    list = list.map(function(r) {
      if (r.halaqah) {
        r.nama_halaqah = r.halaqah.nama_halaqah;
        r.id_guru = r.halaqah.id_guru;
        r.nama_guru = r.halaqah.nama_guru;
      }
      return r;
    });
    if (p.id_halaqah) {
      list = list.filter(function(r) { return r.id_halaqah === p.id_halaqah; });
    }
    if (p.id_guru) {
      list = list.filter(function(r) { return r.id_guru === p.id_guru; });
    }
    if (p.tgl_dari) {
      list = list.filter(function(r) { return r.tanggal >= p.tgl_dari; });
    }
    if (p.tgl_sampai) {
      list = list.filter(function(r) { return r.tanggal <= p.tgl_sampai; });
    }
    var statsMap = {};
    list.forEach(function(r) {
      var guruId = r.id_guru || 'UNKNOWN';
      var guruNama = r.nama_guru || r.id_guru || 'Tanpa Nama';
      if (!statsMap[guruId]) {
        statsMap[guruId] = {
          nama_guru: guruNama,
          total: 0,
          kondusif: 0,
          tepat_waktu: 0,
          terlambat: 0,
          total_menit_telat: 0,
          ada_latihan: 0,
          kamera_sebagian_besar_terbuka: 0,
          kamera_campuran: 0,
          kamera_sebagian_besar_tertutup: 0
        };
      }
      var s = statsMap[guruId];
      s.total++;
      if (r.kondisi_kelas === 'Kondusif') {
        s.kondusif++;
      }
      if (r.ketepatan_waktu === 'Tepat Waktu') {
        s.tepat_waktu++;
      }
      if (r.ketepatan_waktu === 'Guru Terlambat' || r.ketepatan_waktu === 'Keduanya') {
        s.terlambat++;
        s.total_menit_telat += (Number(r.estimasi_menit) || 0);
      }
      if (r.ada_latihan === 'Ya') {
        s.ada_latihan++;
      }
      if (r.kamera_peserta === 'Sebagian Besar Terbuka') {
        s.kamera_sebagian_besar_terbuka++;
      } else if (r.kamera_peserta === 'Campuran') {
        s.kamera_campuran++;
      } else if (r.kamera_peserta === 'Sebagian Besar Tertutup') {
        s.kamera_sebagian_besar_tertutup++;
      }
    });
    var statsList = Object.keys(statsMap).map(function(k) {
      var s = statsMap[k];
      return {
        id_guru: k,
        nama_guru: s.nama_guru,
        total: s.total,
        kondusif: s.kondusif,
        pct_kondusif: s.total > 0 ? Math.round((s.kondusif / s.total) * 100) : 0,
        tepat_waktu: s.tepat_waktu,
        pct_tepat_waktu: s.total > 0 ? Math.round((s.tepat_waktu / s.total) * 100) : 0,
        terlambat: s.terlambat,
        rata_menit_telat: s.terlambat > 0 ? Math.round(s.total_menit_telat / s.terlambat) : 0,
        ada_latihan: s.ada_latihan,
        pct_ada_latihan: s.total > 0 ? Math.round((s.ada_latihan / s.total) * 100) : 0,
        kamera_sebagian_besar_terbuka: s.kamera_sebagian_besar_terbuka,
        kamera_campuran: s.kamera_campuran,
        kamera_sebagian_besar_tertutup: s.kamera_sebagian_besar_tertutup
      };
    });
    return { status: 'ok', data: statsList };
  },

  getKepatuhanRekap: async function() {
    var [halaqahRes, anggotaRes, nilaiRes, atRes, kbmLogRes, obsRes] = await Promise.all([
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, id_guru, nama_guru').eq('status','aktif'),
      _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, is_ketua, followup_at, followup_alpa_kbm, followup_alpa_at, followup_ketua_at, followup_ketua_alpa_kbm, followup_ketua_alpa_at').eq('status','aktif'),
      _sb.from('nilai_kbm').select('id_murid, id_halaqah, status_hadir, kamera_murid'),
      _sb.from('at_tibyan_log').select('id_murid, id_halaqah, status_hadir'),
      _sb.from('kbm_log').select('id_kbm, id_halaqah').eq('status', 'selesai'),
      _sb.from('observasi_kbm').select('id_kbm, id_halaqah')
    ]);
    _check(halaqahRes.error, 'getKepatuhanRekap.halaqah');
    _check(anggotaRes.error, 'getKepatuhanRekap.anggota');
    var halaqahList = halaqahRes.data || [];
    var anggotaList = anggotaRes.data || [];
    var nilaiList   = nilaiRes.data || [];
    var atList      = atRes.data || [];
    var kbmLogList  = kbmLogRes.data || [];
    var obsList     = obsRes.data || [];

    var kbmLogMap = {};
    kbmLogList.forEach(function(k){
      kbmLogMap[k.id_halaqah] = (kbmLogMap[k.id_halaqah] || 0) + 1;
    });
    var obsMap = {};
    obsList.forEach(function(o){
      obsMap[o.id_halaqah] = (obsMap[o.id_halaqah] || 0) + 1;
    });
    var membersMap = {};
    anggotaList.forEach(function(a){
      if (!membersMap[a.id_halaqah]) membersMap[a.id_halaqah] = [];
      membersMap[a.id_halaqah].push(a);
    });
    var nilaiMuridMap = {};
    nilaiList.forEach(function(n){
      if (!nilaiMuridMap[n.id_murid]) nilaiMuridMap[n.id_murid] = [];
      nilaiMuridMap[n.id_murid].push(n);
    });
    var atMuridMap = {};
    atList.forEach(function(n){
      if (!atMuridMap[n.id_murid]) atMuridMap[n.id_murid] = [];
      atMuridMap[n.id_murid].push(n);
    });
    var rekap = halaqahList.map(function(h) {
      var members = membersMap[h.id_halaqah] || [];
      var ketua = members.find(function(m){ return m.is_ketua; })?.nama_murid || 'Belum Diatur';
      var totalKritis = 0;
      var guruFollowedUp = 0;
      var ketuaFollowedUp = 0;
      members.forEach(function(m) {
        var nm = nilaiMuridMap[m.id_murid] || [];
        var at = atMuridMap[m.id_murid] || [];
        var alpaKbm = nm.filter(function(n){ return n.status_hadir === 'A'; }).length;
        var alpaAt  = at.filter(function(n){ return n.status_hadir === 'A'; }).length;
        var terlambat = nm.filter(function(n){ return n.status_hadir === 'T'; }).length;
        var kameraBuruk = nm.filter(function(n) { return n.kamera_murid && (n.kamera_murid.toLowerCase().indexOf('selalu') >= 0 || n.kamera_murid.toLowerCase().indexOf('sering') >= 0); }).length;
        var status = (alpaKbm >= 2 || alpaAt >= 2) ? 'kritis' : ((alpaKbm === 1 || alpaAt === 1 || terlambat >= 2 || kameraBuruk >= 2) ? 'peringatan' : 'normal');
        if (status !== 'normal') {
          totalKritis++;
          if (m.followup_at) {
            var isGuruDone = (m.followup_alpa_kbm >= alpaKbm) && (m.followup_alpa_at >= alpaAt);
            if (isGuruDone) guruFollowedUp++;
          }
          if (m.followup_ketua_at) {
            var isKetuaDone = (m.followup_ketua_alpa_kbm >= alpaKbm) && (m.followup_ketua_alpa_at >= alpaAt);
            if (isKetuaDone) ketuaFollowedUp++;
          }
        }
      });
      var totalKbm = kbmLogMap[h.id_halaqah] || 0;
      var totalObs = obsMap[h.id_halaqah] || 0;
      return {
        id_halaqah: h.id_halaqah,
        nama_halaqah: h.nama_halaqah,
        nama_guru: h.nama_guru || 'Tanpa Guru',
        nama_ketua: ketua,
        total_murid: members.length,
        total_kritis: totalKritis,
        guru_followed_up: guruFollowedUp,
        ketua_followed_up: ketuaFollowedUp,
        total_kbm: totalKbm,
        total_obs: totalObs,
        pct_guru_followup: totalKritis > 0 ? Math.round((guruFollowedUp / totalKritis) * 100) : 100,
        pct_ketua_followup: totalKritis > 0 ? Math.round((ketuaFollowedUp / totalKritis) * 100) : 100,
        pct_obs: totalKbm > 0 ? Math.round((totalObs / totalKbm) * 100) : 100
      };
    });
    return { status: 'ok', data: rekap };
  },

  // ── Materi At-Tibyan (admin CRUD) ─────────────
  getAtTibyanMateriAdmin: async function() {
    var {data,error} = await _sb.from('at_tibyan_materi').select('*').order('pertemuan_ke');
    _check(error,'getAtTibyanMateriAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertAtTibyanMateri: async function(d) {
    var row = { pertemuan_ke: Number(d.pertemuan_ke), tanggal: d.tanggal||'', pemateri: d.pemateri||'', materi_pembahasan: d.materi_pembahasan||'', nasihat_aplikatif: d.nasihat_aplikatif||'' };
    if (d.id) row.id = d.id;
    var {data,error} = await _sb.from('at_tibyan_materi').upsert(row,{onConflict:'id'}).select().single();
    _check(error,'upsertAtTibyanMateri');
    return {status:'ok', data};
  },
  deleteAtTibyanMateri: async function(id) {
    var {error} = await _sb.from('at_tibyan_materi').delete().eq('id',id);
    _check(error,'deleteAtTibyanMateri');
    return {status:'ok'};
  },

  // ── Assessment Items (Daurah Indikator CRUD) ─────────────
  getAssessmentItemsAdmin: async function() {
    var {data,error} = await _sb.from('assessment_items').select('*').order('urutan');
    _check(error,'getAssessmentItemsAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertAssessmentItem: async function(d) {
    var row = {
      level: d.level || 'Tahsin Al-Fatihah',
      kategori: d.kategori || 'Tahsin',
      teks_latin: d.teks_latin || '',
      teks_arab: d.teks_arab || '',
      keterangan: d.keterangan || '',
      urutan: Number(d.urutan) || 1,
      status: d.status || 'aktif'
    };
    if (d.id_item) {
      row.id_item = d.id_item;
    } else {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        row.id_item = crypto.randomUUID();
      } else {
        row.id_item = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    }
    var {data,error} = await _sb.from('assessment_items').upsert(row,{onConflict:'id_item'}).select().single();
    _check(error,'upsertAssessmentItem');
    return {status:'ok', data};
  },
  deleteAssessmentItem: async function(id_item) {
    var {error} = await _sb.from('assessment_items').delete().eq('id_item', id_item);
    _check(error,'deleteAssessmentItem');
    return {status:'ok'};
  },

  // ── Push Subscriber Management ────────────────
  getPushSubscribers: async function() {
    var {data,error} = await _sb.from('push_subscriptions')
      .select('id,id_user,role,device_hint,created_at').order('created_at',{ascending:false});
    _check(error,'getPushSubscribers');
    var ids = (data||[]).map(function(s){return s.id_user;});
    var namaMap = {};
    if (ids.length) {
      var {data:users} = await _sb.from('users').select('id_user,nama_lengkap').in('id_user',ids);
      (users||[]).forEach(function(u){namaMap[u.id_user]=u.nama_lengkap;});
    }
    return {status:'ok', data:(data||[]).map(function(s){
      return Object.assign({},s,{nama:namaMap[s.id_user]||s.id_user});
    })};
  },
  deletePushSubscriber: async function(id) {
    var {error} = await _sb.from('push_subscriptions').delete().eq('id',id);
    _check(error,'deletePushSubscriber'); return {status:'ok'};
  },
  getHalaqahForPush: async function() {
    var {data} = await _sb.from('halaqah').select('id_halaqah,nama_halaqah,level').eq('status','aktif').order('nama_halaqah');
    return {status:'ok',data:data||[]};
  },
  getLevelForPush: async function() {
    var {data} = await _sb.from('level').select('nama_level').eq('status','aktif').order('urutan');
    return {status:'ok',data:(data||[]).map(function(l){return l.nama_level;})};
  },
  getPushTargetUserIds: async function(target) {
    var q = _sb.from('anggota').select('id_murid').eq('status','aktif');
    if (target.halaqah) q = q.eq('id_halaqah',target.halaqah);
    if (target.level)   q = q.eq('level',target.level);
    var {data} = await q;
    return (data||[]).map(function(a){return a.id_murid;});
  },

  // ── Push Notifikasi Admin ──────────────────────
  getPushConfig: async function() {
    var {data,error} = await _sb.from('push_config').select('*').order('key');
    _check(error,'getPushConfig'); return {status:'ok',data:data||[]};
  },
  updatePushConfig: async function(key, enabled) {
    var {error} = await _sb.from('push_config').update({enabled,updated_at:new Date().toISOString()}).eq('key',key);
    _check(error,'updatePushConfig'); return {status:'ok'};
  },
  // Pengumuman onboarding (single-row id=1). Read diizinkan semua user (RLS);
  // write hanya admin. Dipakai murid untuk menampilkan popup saat login.
  getOnboarding: async function() {
    var {data,error} = await _sb.from('onboarding_config').select('*').eq('id',1).maybeSingle();
    _check(error,'getOnboarding'); return {status:'ok',data:data||null};
  },
  saveOnboarding: async function(cfg) {
    var row = {
      id         : 1,
      enabled    : !!cfg.enabled,
      judul      : cfg.judul || '',
      pesan      : cfg.pesan || '',
      target_role: cfg.target_role || 'murid',
      cta_label  : cfg.cta_label || '',
      cta_action : cfg.cta_action || '',
      only_unsubscribed: !!cfg.only_unsubscribed,
      updated_at : new Date().toISOString(),
    };
    var {error} = await _sb.from('onboarding_config').upsert(row, {onConflict:'id'});
    _check(error,'saveOnboarding'); return {status:'ok'};
  },
  getPushStats: async function() {
    var [total,murid,guru,admin] = await Promise.all([
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).eq('role','murid'),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).eq('role','guru'),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).in('role',['admin','superadmin']),
    ]);
    var {data:logs} = await _sb.from('push_log').select('*').order('created_at',{ascending:false}).limit(10);
    return {status:'ok',data:{total:total.count||0,murid:murid.count||0,guru:guru.count||0,admin:admin.count||0,logs:logs||[]}};
  },
  testSendPush: async function(d) {
    var session = (await _sb.auth.getSession()).data.session;
    var token   = session ? session.access_token : SUPABASE_ANON;
    var res = await fetch(SUPABASE_URL+'/functions/v1/send-push',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify(d),
    });
    return res.json();
  },
  testTrigger: async function(trigger) {
    var session = (await _sb.auth.getSession()).data.session;
    var token   = session ? session.access_token : SUPABASE_ANON;
    var res = await fetch(SUPABASE_URL+'/functions/v1/push-scheduler',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({trigger}),
    });
    return res.json();
  },

  // ── Materi Level (admin CRUD) ──────────────────
  getMateriLevelAdmin: async function() {
    var {data,error} = await _sb.from('materi_level').select('*').order('level').order('urutan');
    _check(error,'getMateriLevelAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertMateriLevel: async function(d) {
    var row = { level: d.level||'', kategori: d.kategori||'', judul: d.judul||'', isi: d.isi||'', urutan: Number(d.urutan)||0 };
    if (d.id) row.id = d.id;
    var {data,error} = await _sb.from('materi_level').upsert(row,{onConflict:'id'}).select().single();
    _check(error,'upsertMateriLevel');
    return {status:'ok', data};
  },
  deleteMateriLevel: async function(id) {
    var {error} = await _sb.from('materi_level').delete().eq('id',id);
    _check(error,'deleteMateriLevel');
    return {status:'ok'};
  },

  getAllSaran: async function() {
    var { data, error } = await _sb.from('saran_masukan')
      .select('*, halaqah(nama_halaqah, nama_guru), users:id_murid(nama_lengkap)')
      .order('created_at', { ascending: false })
      .limit(500);
    _check(error, 'getAllSaran');
    return { status: 'ok', data: data || [] };
  },

  updateSaran: async function(id, updates, studentId = null) {
    var { error } = await _sb.from('saran_masukan')
      .update(updates)
      .eq('id', id);
    _check(error, 'updateSaran');
    
    if (studentId && (updates.status || updates.tanggapan)) {
      _sendPushBg({
        user_ids: [studentId],
        title: '💬 Tanggapan Saran & Masukan',
        body : 'Aspirasi Anda telah ditanggapi atau diperbarui oleh Staf Manajemen. Silakan periksa di tab Riwayat.',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'saran-tanggapan-' + id,
        data : { trigger: 'saran_responded' },
      });
    }

    return { status: 'ok' };
  },

  // ── Rattil Maze (admin) — kelola level; RLS maze_level_admin_write (is_admin) ──
  getMazeLevelsAdmin: async function() {
    var { data, error } = await _sb.from('maze_level')
      .select('*')
      .order('urutan', { ascending: true });
    _check(error, 'getMazeLevelsAdmin');
    return { status: 'ok', data: data || [] };
  },
  getQuizListForMaze: async function() {
    var { data, error } = await _sb.from('quiz')
      .select('id_quiz, judul, status')
      .order('created_at', { ascending: false });
    _check(error, 'getQuizListForMaze');
    return { status: 'ok', data: data || [] };
  },
  createMazeLevel: async function(payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      map_data:          payload.map_data,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_levels:     payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    var { data, error } = await _sb.from('maze_level').insert([row]).select().single();
    _check(error, 'createMazeLevel');
    if (!data) throw new Error('createMazeLevel: 0 baris tersimpan (akses admin ditolak?).');
    return { status: 'ok', data: data };
  },
  updateMazeLevel: async function(id_maze_level, payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_levels:     payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    if (payload.map_data) row.map_data = payload.map_data;
    var { data, error } = await _sb.from('maze_level')
      .update(row).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'updateMazeLevel');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — akses ditolak?).');
    return { status: 'ok' };
  },
  setMazeLevelAktif: async function(id_maze_level, aktif) {
    var { data, error } = await _sb.from('maze_level')
      .update({ aktif: !!aktif }).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'setMazeLevelAktif');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteMazeLevel: async function(id_maze_level) {
    var { error } = await _sb.from('maze_level').delete().eq('id_maze_level', id_maze_level);
    _check(error, 'deleteMazeLevel');
    return { status: 'ok' };
  },

  // ── Rattil Run (admin) — kelola level; RLS run_level_write (is_admin) ──
  getRunLevelsAdmin: async function() {
    var { data, error } = await _sb.from('run_level')
      .select('*')
      .order('urutan', { ascending: true });
    _check(error, 'getRunLevelsAdmin');
    return { status: 'ok', data: data || [] };
  },
  getQuizListForRun: async function() {
    var { data, error } = await _sb.from('quiz')
      .select('id_quiz, judul, status')
      .order('created_at', { ascending: false });
    _check(error, 'getQuizListForRun');
    return { status: 'ok', data: data || [] };
  },
  createRunLevel: async function(payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_levels:       payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level').insert([row]).select().single();
    _check(error, 'createRunLevel');
    if (!data) throw new Error('createRunLevel: 0 baris tersimpan (akses admin ditolak?).');
    return { status: 'ok', data: data };
  },
  updateRunLevel: async function(id_run_level, payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_levels:       payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level')
      .update(row).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'updateRunLevel');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — akses ditolak?).');
    return { status: 'ok' };
  },
  setRunLevelAktif: async function(id_run_level, aktif) {
    var { data, error } = await _sb.from('run_level')
      .update({ aktif: !!aktif }).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'setRunLevelAktif');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteRunLevel: async function(id_run_level) {
    var { error } = await _sb.from('run_level').delete().eq('id_run_level', id_run_level);
    _check(error, 'deleteRunLevel');
    return { status: 'ok' };
  },
};

// ─────────────────────────────────────────────
//  KETUA API
// ─────────────────────────────────────────────
var KetuaAPI = {
  getInfo: async function() {
    var id_murid = _uid();
    var { data: anggota } = await _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('is_ketua', true).maybeSingle();
    if (!anggota) return { status: 'error', message: 'Bukan ketua kelas' };
    if (anggota.halaqah) {
      anggota.halaqah.jam_mulai = anggota.halaqah.jam_mulai ? anggota.halaqah.jam_mulai.substring(0, 5) : null;
      anggota.halaqah.jam_selesai = anggota.halaqah.jam_selesai ? anggota.halaqah.jam_selesai.substring(0, 5) : null;
      anggota.halaqah.nama = anggota.halaqah.nama_halaqah;
    }
    return { status: 'ok', halaqah: anggota.halaqah, anggota };
  },

  getKeaktifanAnggota: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var id_halaqah = info.halaqah.id_halaqah;
    var [anggotaRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('id_murid, nama_murid, level, followup_ketua_at, followup_ketua_alpa_kbm, followup_ketua_alpa_at').eq('id_halaqah', id_halaqah).eq('status', 'aktif'),
      _sb.from('nilai_kbm').select('id_murid, status_hadir, kamera_murid, tanggal').eq('id_halaqah', id_halaqah).order('tanggal', { ascending: false }),
    ]);
    if (anggotaRes.error) return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var ids = (anggotaRes.data || []).map(function(a) { return a.id_murid; });
    var hpMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.rpc('ketua_get_member_no_hp');
      (users || []).forEach(function(u) { hpMap[u.id_user] = u.no_hp; });
    }
    var nilaiAll = nilaiRes.data || [];
    var summary = { kritis: 0, peringatan: 0, normal: 0 };
    var alerts = [];
    (anggotaRes.data || []).forEach(function(a) {
      var nm = nilaiAll.filter(function(n) { return n.id_murid === a.id_murid; });
      var hadir = nm.filter(function(n) { return ['H','T'].includes(n.status_hadir); });
      var alpa = nm.filter(function(n) { return n.status_hadir === 'A'; }).length;
      var terlambat = nm.filter(function(n) { return n.status_hadir === 'T'; }).length;
      var kamera_buruk = nm.filter(function(n) { return n.kamera_murid && (n.kamera_murid.toLowerCase().indexOf('selalu') >= 0 || n.kamera_murid.toLowerCase().indexOf('sering') >= 0); }).length;
      var status = alpa >= 2 ? 'kritis' : (alpa === 1 || terlambat >= 2 || kamera_buruk >= 2) ? 'peringatan' : 'normal';
      summary[status]++;
      if (status !== 'normal') alerts.push({
        id_murid  : a.id_murid,
        nama_murid: a.nama_murid,
        status    : status,
        pct_hadir : nm.length > 0 ? Math.round(hadir.length / nm.length * 100) : 0,
        absen     : alpa,
        total_sesi: nm.length,
        no_hp     : hpMap[a.id_murid] || '',
        followup_ketua_at      : a.followup_ketua_at || null,
        followup_ketua_alpa_kbm: a.followup_ketua_alpa_kbm || 0,
        followup_ketua_alpa_at : a.followup_ketua_alpa_at || 0,
        riwayat   : nm.slice(0, 8).map(function(n) {
          return { warna: ['H','T'].includes(n.status_hadir) ? 'hijau' : n.status_hadir === 'A' ? 'merah' : 'abu', tanggal: n.tanggal };
        }),
      });
    });
    return { status: 'ok', data: { summary: summary, alerts: alerts } };
  },

  getAtTibyanAnggota: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: { alerts: [] } };
    var { data, error } = await _sb.from('at_tibyan_log')
      .select('id_murid, nama_murid, status_hadir, tanggal')
      .eq('id_halaqah', info.halaqah.id_halaqah)
      .order('tanggal', { ascending: false });
    if (error) return { status: 'ok', data: { alerts: [] } };
    var map = {};
    (data || []).forEach(function(r) {
      if (!map[r.id_murid]) map[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid, hadir: 0, alpa: 0, total: 0, riwayat: [] };
      map[r.id_murid].total++;
      if (['H','T'].includes(r.status_hadir)) map[r.id_murid].hadir++;
      // Hanya 'A' (Alpa) yang dihitung sbg ketidakhadiran utk alert — 'I' (Izin) tidak dianggap sama dgn Alpa
      if (r.status_hadir === 'A') map[r.id_murid].alpa++;
      if (map[r.id_murid].riwayat.length < 8) map[r.id_murid].riwayat.push({ warna: ['H','T'].includes(r.status_hadir) ? 'hijau' : (r.status_hadir === 'A' ? 'merah' : 'abu'), tanggal: r.tanggal });
    });
    var ids = Object.keys(map);
    var hpMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.rpc('ketua_get_member_no_hp');
      (users || []).forEach(function(u) { hpMap[u.id_user] = u.no_hp; });
    }
    var alerts = Object.values(map).map(function(m) {
      var alpa = m.alpa;
      var status = alpa >= 2 ? 'kritis' : alpa === 1 ? 'peringatan' : 'normal';
      return {
        id_murid  : m.id_murid,
        nama_murid: m.nama_murid,
        status    : status,
        pct_hadir : m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0,
        absen     : alpa,
        total_sesi: m.total,
        no_hp     : hpMap[m.id_murid] || '',
        riwayat   : m.riwayat
      };
    }).filter(function(m) { return m.status !== 'normal'; });
    return { status: 'ok', data: { alerts: alerts } };
  },

  getTrenKehadiran: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('kbm_log')
      .select('pertemuan_ke, tanggal_pertemuan, jumlah_hadir, jumlah_alpa')
      .eq('id_halaqah', info.halaqah.id_halaqah).eq('status', 'selesai')
      .order('tanggal_pertemuan', { ascending: false }).limit(10);
    if (error) return { status: 'ok', data: [] };
    var rows = (data || []).map(function(k) {
      var total = (k.jumlah_hadir || 0) + (k.jumlah_alpa || 0);
      return {
        pertemuan_ke: k.pertemuan_ke,
        tanggal     : k.tanggal_pertemuan,
        pct_hadir   : total > 0 ? Math.round((k.jumlah_hadir || 0) / total * 100) : null,
      };
    }).reverse(); // urut kronologis (lama -> baru) untuk grafik
    return { status: 'ok', data: rows };
  },

  getObservasiPending: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var id_halaqah = info.halaqah.id_halaqah;
    var id_ketua   = _uid();
    // KBM selesai yang belum diobservasi ketua ini
    var [kbmRes, obsRes] = await Promise.all([
      _sb.from('kbm_log').select('id_kbm, tanggal_pertemuan, pertemuan_ke, jumlah_hadir')
        .eq('id_halaqah', id_halaqah).eq('status', 'selesai')
        .order('tanggal_pertemuan', { ascending: false }).limit(20),
      _sb.from('observasi_kbm').select('id_kbm').eq('id_ketua', id_ketua),
    ]);
    var sudahObsIds = new Set((obsRes.data || []).map(function(o) { return o.id_kbm; }));
    var allSesi = (kbmRes.data || []).map(function(k) {
      var sudah = sudahObsIds.has(k.id_kbm);
      return Object.assign({}, k, {
        tanggal      : k.tanggal_pertemuan,
        window_status: sudah ? 'selesai' : 'terbuka',
      });
    });
    return { status: 'ok', data: allSesi };
  },

  getObservasiHistory: async function() {
    var id_ketua = _uid();
    var { data, error } = await _sb.from('observasi_kbm').select('*, kbm_log(tanggal_pertemuan, pertemuan_ke)')
      .eq('id_ketua', id_ketua).order('created_at', { ascending: false }).limit(20);
    if (error) return { status: 'ok', data: [] };
    return { status: 'ok', data: data || [] };
  },

  getKBMJurnal: async function(id_kbm) {
    var { data, error } = await _sb.from('kbm_log')
      .select('*, halaqah(nama_halaqah, level)')
      .eq('id_kbm', id_kbm)
      .single();
    if (error) {
      console.warn('getKBMJurnal error:', error.message);
      return { status: 'ok', data: null };
    }
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
      
      data.tanggal = data.tanggal_pertemuan;

      // Handle halaqah join result (could be object or array)
      var hqObj = null;
      if (data.halaqah) {
        if (Array.isArray(data.halaqah)) {
          hqObj = data.halaqah[0] || null;
        } else {
          hqObj = data.halaqah;
        }
      }
      data.nama_halaqah = hqObj ? (hqObj.nama_halaqah || '') : '';
      data.level = hqObj ? (hqObj.level || '') : '';

      // Fetch student attendance via SECURITY DEFINER RPC (returns nama_lengkap from users)
      var { data: presensiRes, error: presensiErr } = await _sb.rpc('ketua_get_kbm_presensi', { p_id_kbm: id_kbm });

      if (presensiErr) {
        console.warn('getKBMJurnal: presensi RPC error:', presensiErr.message);
      }

      data.presensi = (presensiRes || []).map(function(r) {
        return {
          id_murid: r.id_murid,
          status_hadir: r.status_hadir,
          nama_murid: r.nama_murid || r.id_murid
        };
      });
    }
    return { status: 'ok', data };
  },

  getRekapStatus: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('rekap_status').select('*')
      .eq('id_halaqah', info.halaqah.id_halaqah)
      .order('created_at', { ascending: false }).limit(20);
    if (error) return { status: 'ok', data: [] };
    // Return array id_kbm agar Set.has(id_kbm) bekerja di frontend
    return { status: 'ok', data: (data || []).map(function(r) { return r.id_kbm; }) };
  },

  submitObservasi: async function(d) {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') throw new Error('Bukan ketua kelas');
    var kbm = await _sb.from('kbm_log').select('tanggal_pertemuan, pertemuan_ke')
      .eq('id_kbm', d.id_kbm).single();
    var { error } = await _sb.from('observasi_kbm').insert({
      id_kbm          : d.id_kbm,
      id_halaqah      : info.halaqah.id_halaqah,
      id_ketua        : _uid(),
      pertemuan_ke    : kbm.data && kbm.data.pertemuan_ke,
      tanggal         : kbm.data && kbm.data.tanggal_pertemuan,
      kondisi_kelas   : d.kondisi_kelas,
      ada_latihan     : d.ada_latihan,
      ketepatan_waktu : d.ketepatan_waktu,
      estimasi_menit  : d.estimasi_menit,
      kamera_peserta  : d.kamera_peserta,
      catatan_tambahan: d.catatan_lain || d.catatan_tambahan,
      status          : 'submitted',
    });
    _check(error, 'submitObservasi');
    return { status: 'ok', message: 'Observasi berhasil dikirim' };
  },

  simpanRekapStatus: async function(d) {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') throw new Error('Bukan ketua kelas');
    var { error } = await _sb.from('rekap_status').insert({
      id_halaqah   : info.halaqah.id_halaqah,
      id_kbm       : d.id_kbm,
      id_ketua     : _uid(),
      catatan_ustadz: d.catatan_ustadz || '',
    });
    _check(error, 'simpanRekapStatus');
    return { status: 'ok' };
  },

  simpanFollowupKeaktifanKetua: async function(d) {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') throw new Error('Bukan ketua kelas');
    var id_halaqah = info.halaqah.id_halaqah;

    // Ambil baris anggota
    var q = _sb.from('anggota')
      .select('id_halaqah, catatan_guru, followup_ketua_alpa_kbm, followup_ketua_alpa_at, followup_ketua_at')
      .eq('id_murid', d.id_murid).eq('status','aktif').eq('id_halaqah', id_halaqah);
    var { data: rows, error: anggotaErr } = await q;
    _check(anggotaErr, 'simpanFollowupKeaktifanKetua.fetch');
    var anggota = rows && rows[0];
    if (!anggota) return { status: 'ok' };

    // Hitung alpa KBM dan At-Tibyan per halaqah sebagai baseline dismissal
    var [kbmRes, atRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
    ]);
    var kbmAlpa = kbmRes.count || 0;
    var atAlpa  = atRes.count  || 0;

    // Simpan catatan — batasi 10 entri terakhir agar tidak tumbuh tak terbatas
    var tglStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
    var baris  = '[' + tglStr + '] Ketua Kelas menghubungi murid — ' + (d.tipe_alert||'keaktifan') + ' (' + (d.value||0) + 'x)';
    var existing = anggota.catatan_guru ? anggota.catatan_guru.split('\n').filter(Boolean) : [];
    existing.push(baris);
    var catatan = existing.slice(-10).join('\n'); // simpan maksimal 10 entri

    var { error } = await _sb.from('anggota').update({
      catatan_guru           : catatan,
      followup_ketua_alpa_kbm: kbmAlpa,
      followup_ketua_alpa_at : atAlpa,
      followup_ketua_at      : new Date().toISOString(),
    }).eq('id_murid', d.id_murid).eq('id_halaqah', id_halaqah);
    _check(error, 'simpanFollowupKeaktifanKetua');
    return { status: 'ok' };
  },
};

// ─────────────────────────────────────────────
//  PUSH USER PREFS (murid & guru)
// ─────────────────────────────────────────────
var PushPrefsAPI = {
  // Ambil preferensi notifikasi user ini
  getPrefs: async function() {
    var uid = _uid();
    if (!uid) return {status:'ok',data:{}};
    var {data} = await _sb.from('push_user_prefs').select('prefs').eq('id_user',uid).maybeSingle();
    return {status:'ok',data:(data&&data.prefs)||{}};
  },
  // Simpan preferensi (prefs = object key:boolean)
  savePrefs: async function(prefs) {
    var uid = _uid();
    if (!uid) throw new Error('Belum login');
    var {error} = await _sb.from('push_user_prefs').upsert({
      id_user:uid, prefs, updated_at:new Date().toISOString()
    },{onConflict:'id_user'});
    _check(error,'savePrefs');
    return {status:'ok'};
  },
  // Update satu key saja
  setOne: async function(key, value) {
    var r = await PushPrefsAPI.getPrefs();
    var prefs = Object.assign({},r.data,{[key]:value});
    return PushPrefsAPI.savePrefs(prefs);
  },
};

// ─────────────────────────────────────────────
//  PUSH HELPER (internal, non-blocking)
// ─────────────────────────────────────────────
function _sendPushBg(opts) {
  // Gunakan session token user yang sedang login (bukan anon key)
  // agar Edge Function dapat memverifikasi pemanggil adalah authenticated user
  _sb.auth.getSession().then(function(res) {
    var token = (res.data && res.data.session && res.data.session.access_token) || null;
    if (!token) return; // tidak kirim push jika tidak ada session aktif
    fetch(SUPABASE_URL + '/functions/v1/send-push', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body   : JSON.stringify(opts),
    }).catch(function() {});
  }).catch(function() {});
}

// ─────────────────────────────────────────────
//  PUSH NOTIFICATIONS API
// ─────────────────────────────────────────────
var VAPID_PUBLIC_KEY = 'BDqTqhZZpAuSq18HKjMTUFYJSimkDpO4X939NAbfdyuDf5-qQmSvY7RBP6OUH2dhYhNQgP8-STvIJf3mO8aOCw0';

var PushAPI = {
  // Cek apakah browser mendukung push notifikasi
  isSupported: function() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  // Cek status izin saat ini
  getPermissionStatus: function() {
    if (!PushAPI.isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  // Ambil subscription yang sedang aktif (jika ada)
  getActiveSubscription: async function() {
    if (!PushAPI.isSupported()) return null;
    try {
      var reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch(e) { return null; }
  },

  // Subscribe push notifikasi
  subscribe: async function() {
    if (!PushAPI.isSupported()) throw new Error('Browser tidak mendukung push notifikasi');
    var reg = await navigator.serviceWorker.ready;
    // Unsubscribe dari subscription lama dulu (cegah konflik VAPID key)
    var existing = await reg.pushManager.getSubscription().catch(function(){ return null; });
    if (existing) await existing.unsubscribe().catch(function(){});
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly     : true,
      applicationServerKey: _urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    // Simpan subscription ke Supabase
    await PushAPI._saveSubscription(sub);
    return sub;
  },

  // Unsubscribe
  unsubscribe: async function() {
    var sub = await PushAPI.getActiveSubscription();
    if (!sub) return;
    var endpoint = sub.endpoint;
    await sub.unsubscribe();
    // Hapus dari Supabase
    var user = _currentUser;
    if (!user) return;
    await _sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
  },

  // Simpan subscription ke tabel push_subscriptions
  _saveSubscription: async function(sub) {
    var user = _currentUser;
    if (!user || !user.id_user) throw new Error('Belum login');
    var key  = sub.getKey && sub.getKey('p256dh');
    var auth = sub.getKey && sub.getKey('auth');
    if (!key || !auth) throw new Error('Subscription tidak valid');
    // Simpan sebagai base64url (bukan standard base64) agar compatible dengan web-push library
    var toB64url = function(buf) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    };
    var p256dh  = toB64url(key);
    var authKey = toB64url(auth);
    var deviceHint = /iPhone|iPad/.test(navigator.userAgent) ? 'ios'
      : /Android/.test(navigator.userAgent) ? 'android' : 'desktop';
    var { error } = await _sb.from('push_subscriptions').upsert({
      id_user    : user.id_user,
      role       : user.role || 'murid',
      endpoint   : sub.endpoint,
      p256dh     : p256dh,
      auth_key   : authKey,
      device_hint: deviceHint,
      updated_at : new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw new Error(error.message);
    // Dedup: saat device re-subscribe, browser membuat endpoint BARU sehingga
    // row endpoint lama jadi yatim → gagal 410 di broadcast berikutnya (sumber
    // utama angka "gagal"). Hapus row lama milik user+device yang sama yang
    // endpoint-nya berbeda dari yang baru saja disimpan. Tidak menggagalkan
    // proses subscribe kalau cleanup error (best-effort).
    try {
      await _sb.from('push_subscriptions').delete()
        .eq('id_user', user.id_user)
        .eq('device_hint', deviceHint)
        .neq('endpoint', sub.endpoint);
    } catch (_) { /* cleanup best-effort */ }
  },

  // Kirim push (dipanggil dari portal, hanya untuk admin/guru)
  send: async function(opts) {
    var sess  = await _sb.auth.getSession();
    var token = sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Sesi tidak ditemukan. Silakan login ulang.');
    var res = await fetch(SUPABASE_URL + '/functions/v1/send-push', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(opts),
    });
    return res.json();
  },
};

// Helper: convert base64url → Uint8Array (untuk VAPID key)
function _urlB64ToUint8Array(base64String) {
  var padding  = '='.repeat((4 - base64String.length % 4) % 4);
  var base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData  = window.atob(base64);
  var output   = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ─────────────────────────────────────────────
//  DYNAMIC CACHE WRAPPER (SWR & INVALIDATION)
// ─────────────────────────────────────────────
(function() {
  if (typeof window === 'undefined') return;

  var apis = {
    AdminAPI: AdminAPI,
    GuruAPI: GuruAPI,
    MuridAPI: MuridAPI,
    KetuaAPI: KetuaAPI
  };

  var readPrefixes = ['get', 'load', 'find', 'search'];
  var writePrefixes = ['create', 'update', 'delete', 'simpan', 'hapus', 'add', 'aktivasi', 'set'];

  function getCacheKey(apiName, methodName, args) {
    return 'hq_cache_' + apiName + '_' + methodName + '_' + JSON.stringify(args);
  }

  function clearCache() {
    if (typeof sessionStorage === 'undefined') return;
    for (var i = sessionStorage.length - 1; i >= 0; i--) {
      var key = sessionStorage.key(i);
      if (key && key.indexOf('hq_cache_') === 0) {
        sessionStorage.removeItem(key);
      }
    }
  }

  // SWR Caching
  function wrapRead(apiName, methodName, original) {
    return async function() {
      var args = Array.prototype.slice.call(arguments);
      if (typeof sessionStorage === 'undefined') {
        return original.apply(this, args);
      }

      var key = getCacheKey(apiName, methodName, args);
      var FRESH_TTL = 30 * 1000;       // 30 seconds
      var STALE_TTL = 5 * 60 * 1000;    // 5 minutes

      try {
        var cached = sessionStorage.getItem(key);
        if (cached) {
          var parsed = JSON.parse(cached);
          var age = Date.now() - parsed.timestamp;

          if (age < FRESH_TTL) {
            return parsed.data;
          } else if (age < STALE_TTL) {
            // SWR: fetch background, return cache immediately
            original.apply(this, args).then(function(res) {
              sessionStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                data: res
              }));
            }).catch(function(err) {
              console.warn('SWR refresh failed for ' + key + ':', err);
            });
            return parsed.data;
          }
        }
      } catch (e) {
        console.warn('Cache read error for ' + key + ':', e);
      }

      // Blocking fetch
      var res = await original.apply(this, args);
      try {
        sessionStorage.setItem(key, JSON.stringify({
          timestamp: Date.now(),
          data: res
        }));
      } catch (e) {
        console.warn('Cache write error for ' + key + ':', e);
      }
      return res;
    };
  }

  // Mutation Invalidation
  function wrapWrite(original) {
    return async function() {
      var args = Array.prototype.slice.call(arguments);
      var res = await original.apply(this, args);
      clearCache();
      return res;
    };
  }

  // Wrap all API functions
  Object.keys(apis).forEach(function(apiName) {
    var api = apis[apiName];
    if (!api) return;
    Object.keys(api).forEach(function(methodName) {
      var original = api[methodName];
      if (typeof original !== 'function') return;

      var isRead = readPrefixes.some(function(p) { return methodName.indexOf(p) === 0; });
      var isWrite = writePrefixes.some(function(p) { return methodName.indexOf(p) === 0; });

      if (isRead) {
        api[methodName] = wrapRead(apiName, methodName, original);
      } else if (isWrite) {
        api[methodName] = wrapWrite(original);
      }
    });
  });

  // Wrap Auth.logout
  if (typeof Auth !== 'undefined' && Auth.logout) {
    var originalLogout = Auth.logout;
    Auth.logout = async function() {
      var args = Array.prototype.slice.call(arguments);
      clearCache();
      return originalLogout.apply(this, args);
    };
  }

  // Expose global clear cache function
  window._clearHQCache = clearCache;
})();

// ─────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────
window.HQ = {
  Auth, AdminAPI, GuruAPI, MuridAPI, KetuaAPI,
  SuperAdminAPI: AdminAPI,
  PushAPI, PushPrefsAPI,
  QuizAPI: {
    // Guru Methods
    getKuisList: function() { return GuruAPI.getKuisList.apply(GuruAPI, arguments); },
    getMazeLevelsGuru: function() { return GuruAPI.getMazeLevelsGuru.apply(GuruAPI, arguments); },
    createMazeLevelGuru: function() { return GuruAPI.createMazeLevelGuru.apply(GuruAPI, arguments); },
    updateMazeLevelGuru: function() { return GuruAPI.updateMazeLevelGuru.apply(GuruAPI, arguments); },
    setMazeLevelAktifGuru: function() { return GuruAPI.setMazeLevelAktifGuru.apply(GuruAPI, arguments); },
    deleteMazeLevelGuru: function() { return GuruAPI.deleteMazeLevelGuru.apply(GuruAPI, arguments); },
    getRunLevelsGuru: function() { return GuruAPI.getRunLevelsGuru.apply(GuruAPI, arguments); },
    createRunLevelGuru: function() { return GuruAPI.createRunLevelGuru.apply(GuruAPI, arguments); },
    updateRunLevelGuru: function() { return GuruAPI.updateRunLevelGuru.apply(GuruAPI, arguments); },
    setRunLevelAktifGuru: function() { return GuruAPI.setRunLevelAktifGuru.apply(GuruAPI, arguments); },
    deleteRunLevelGuru: function() { return GuruAPI.deleteRunLevelGuru.apply(GuruAPI, arguments); },
    createKuis: function() { return GuruAPI.createKuis.apply(GuruAPI, arguments); },
    updateKuis: function() { return GuruAPI.updateKuis.apply(GuruAPI, arguments); },
    deleteKuis: function() { return GuruAPI.deleteKuis.apply(GuruAPI, arguments); },
    getBankSoal: function() { return GuruAPI.getBankSoal.apply(GuruAPI, arguments); },
    createSoal: function() { return GuruAPI.createSoal.apply(GuruAPI, arguments); },
    updateSoal: function() { return GuruAPI.updateSoal.apply(GuruAPI, arguments); },
    getSoalDetail: function() { return GuruAPI.getSoalDetail.apply(GuruAPI, arguments); },
    updateSoalFull: function() { return GuruAPI.updateSoalFull.apply(GuruAPI, arguments); },
    deleteSoal: function() { return GuruAPI.deleteSoal.apply(GuruAPI, arguments); },
    addSoalToKuis: function() { return GuruAPI.addSoalToKuis.apply(GuruAPI, arguments); },
    removeSoalFromKuis: function() { return GuruAPI.removeSoalFromKuis.apply(GuruAPI, arguments); },
    updateSoalKuisSetting: function() { return GuruAPI.updateSoalKuisSetting.apply(GuruAPI, arguments); },
    getHasilKuis: function() { return GuruAPI.getHasilKuis.apply(GuruAPI, arguments); },
    getAntrianReviewIsian: function() { return GuruAPI.getAntrianReviewIsian.apply(GuruAPI, arguments); },
    reviewIsianSingkat: function() { return GuruAPI.reviewIsianSingkat.apply(GuruAPI, arguments); },
    startSesiLive: function() { return GuruAPI.startSesiLive.apply(GuruAPI, arguments); },
    // Murid Methods
    getKuisTersedia: function() { return MuridAPI.getKuisTersedia.apply(MuridAPI, arguments); },
    getKuisDetail: function() { return MuridAPI.getKuisDetail.apply(MuridAPI, arguments); },
    jawabSoal: function() { return MuridAPI.jawabSoal.apply(MuridAPI, arguments); },
    submitKuis: function() { return MuridAPI.submitKuis.apply(MuridAPI, arguments); },
    getHasilKuisMurid: function() { return MuridAPI.getHasilKuisMurid.apply(MuridAPI, arguments); },
    getRiwayatKuisMurid: function() { return MuridAPI.getRiwayatKuisMurid.apply(MuridAPI, arguments); },
    getLeaderboardKuis: function() { return MuridAPI.getLeaderboardKuis.apply(MuridAPI, arguments); },
    joinSesiLive: function() { return MuridAPI.joinSesiLive.apply(MuridAPI, arguments); }
  },
  AbsensiGuruUtil: AbsensiGuruUtil,
  supabase: _sb,
  getCurrentUser: function() { return _currentUser; },
  cache: { invalidate: window._clearHQCache, clear: window._clearHQCache },
  SPP_NOMINAL_BULANAN: SPP_NOMINAL_BULANAN,
};
