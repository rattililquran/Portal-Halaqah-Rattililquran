// ============================================================
//  SUPABASE CORE — dimuat SEMUA portal (config, _sb, helper, Auth, Push, boundary)
//  Hasil split supabase-client.js (2026-07-18). File ini KANONIK — edit di sini.
//  supabase-client.js lama disimpan sbg fallback rollback; boleh dihapus stlh live OK.
// ============================================================

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
//  PUSH (prefs + notifications) — dipakai semua portal
// ─────────────────────────────────────────────

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
//  BOUNDARY METHODS (direlokasi ke core; dipakai lintas-bundle)
//  Ditempel ke HQ.<Obj> oleh hq-assemble.js (fill-if-absent).
// ─────────────────────────────────────────────
async function _core_getRincianRaport(id_raport) {
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

    // Jika raport adalah daurah, inject field urutan dari assessment_items agar
    // client dapat mengurutkan indikator sesuai urutan hari pembelajaran.
    // Fix untuk raport lama yang detail_json-nya belum menyimpan field urutan.
    var isDaurahKomp = komponen.some(function(k) { return k.tipe === 'daurah_indikator'; });
    if (isDaurahKomp) {
      try {
        var { data: asmtOrder } = await _sb.from('assessment_items')
          .select('id_item, urutan')
          .eq('level', 'Tahsin Al-Fatihah')
          .eq('status', 'aktif')
          .order('urutan');
        if (asmtOrder && asmtOrder.length) {
          var orderMap = {};
          asmtOrder.forEach(function(a, idx) { orderMap[String(a.id_item)] = a.urutan != null ? Number(a.urutan) : idx; });
          komponen = komponen.map(function(k) {
            if (k.tipe === 'daurah_indikator' && orderMap[String(k.id_komponen)] !== undefined) {
              return Object.assign({}, k, { urutan: orderMap[String(k.id_komponen)] });
            }
            return k;
          });
        }
      } catch(e) { /* gagal fetch urutan — tetap lanjut dengan urutan lama */ }
    }

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
}
async function _core_generateRaportPDF(id_raport) {
    // PDF generation via GAS masih dipertahankan sementara
    return { status: 'error', message: 'PDF generation belum tersedia. Gunakan fitur print browser.' };
}
async function _core_getPenilaianHafalan() {
    var { data, error } = await _sb.from('konfigurasi_penilaian_hafalan')
      .select('kelancaran, nilai')
      .eq('id', 'global')
      .maybeSingle();
    if (error) { console.warn('getPenilaianHafalan:', error.message); return { status: 'ok', data: null }; }
    return { status: 'ok', data: data || null };
}
async function _core_getPushConfig() {
    var {data,error} = await _sb.from('push_config').select('*').order('key');
    _check(error,'getPushConfig'); return {status:'ok',data:data||[]};
}
async function _core_getLatihanUploadToken() {
    var { data, error } = await _sb.rpc('get_latihan_upload_token');
    _check(error, 'getLatihanUploadToken');
    return { status: 'ok', token: data };
}

// ─────────────────────────────────────────────
//  window.HQ BASE — anggota yang SELALU ada di tiap portal.
//  Bundle lain (staff/murid) & hq-assemble menempel sisanya.
// ─────────────────────────────────────────────
window.HQ = window.HQ || {};
window.HQ.Auth = Auth;
window.HQ.PushAPI = PushAPI;
window.HQ.PushPrefsAPI = PushPrefsAPI;
window.HQ.AbsensiGuruUtil = AbsensiGuruUtil;
window.HQ.supabase = _sb;
window.HQ.getCurrentUser = function() { return _currentUser; };
window.HQ.cache = { invalidate: function(){ return window._clearHQCache && window._clearHQCache(); }, clear: function(){ return window._clearHQCache && window._clearHQCache(); } };
window.HQ.SPP_NOMINAL_BULANAN = SPP_NOMINAL_BULANAN;
