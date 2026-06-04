// ============================================================
//  supabase-client.js  v2.0
//  Rattililqur'an Portal — Supabase Client
//  Menggantikan api.js (GAS) sepenuhnya
// ============================================================

const SUPABASE_URL  = 'https://zefriybfrirrtsulogta.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZnJpeWJmcmlycnRzdWxvZ3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTk1MzIsImV4cCI6MjA5NTkzNTUzMn0.AmB43YG-fCYqATdh5BrfLJmGITI_UeX8csOYyjd9i_U';

const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─────────────────────────────────────────────
//  SESSION
// ─────────────────────────────────────────────
let _currentUser = null;

// Restore session dari localStorage saat page load
(function _restoreSession() {
  var stored = localStorage.getItem('hq_user');
  if (stored) { try { _currentUser = JSON.parse(stored); } catch(e) {} }
  var token   = localStorage.getItem('hq_token');
  var refresh = localStorage.getItem('hq_refresh');
  if (token && refresh) {
    // Restore dengan kedua token agar Supabase bisa auto-refresh saat expired
    _sb.auth.setSession({ access_token: token, refresh_token: refresh }).catch(function(){});
  }
})();

// Simpan token terbaru setiap kali Supabase refresh otomatis
_sb.auth.onAuthStateChange(function(event, session) {
  if (event === 'TOKEN_REFRESHED' && session) {
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

// Buat id unik sederhana
function _genId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

// Nama hari Indonesia
function _hariIni() {
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
}

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
    window.location.href = window.location.pathname.includes('/guru/') ||
                           window.location.pathname.includes('/admin/') ||
                           window.location.pathname.includes('/murid/')
      ? '../index.html' : 'index.html';
  },

  getUser: function() { return _currentUser; },
  getProfile: function() { return Promise.resolve({ status: 'ok', data: _currentUser }); },

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
    var today   = new Date().toISOString().slice(0, 10);
    var month   = today.slice(0, 7);

    var [hqRes, anggotaRes, kbmHariRes, kbmBulanRes, draftRes] = await Promise.all([
      _sb.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif'),
      _sb.from('anggota').select('id_murid, id_halaqah').eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').eq('tanggal_pertemuan', today),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').gte('tanggal_pertemuan', month + '-01'),
      _sb.from('kbm_log').select('*').eq('id_guru', id_guru).eq('status', 'draft').maybeSingle(),
    ]);

    var halaqah   = hqRes.data || [];
    var hqIds     = halaqah.map(function(h) { return h.id_halaqah; });
    var muridSet  = new Set((anggotaRes.data || []).filter(function(a) {
      return hqIds.includes(a.id_halaqah);
    }).map(function(a) { return a.id_murid; }));

    // Hitung pertemuan_ke per halaqah
    var kbmCounts = {};
    if (hqIds.length > 0) {
      var { data: kbmAll } = await _sb.from('kbm_log')
        .select('id_halaqah, pertemuan_ke')
        .in('id_halaqah', hqIds).eq('status', 'selesai');
      (kbmAll || []).forEach(function(k) {
        if (!kbmCounts[k.id_halaqah]) kbmCounts[k.id_halaqah] = 0;
        kbmCounts[k.id_halaqah]++;
      });
    }

    halaqah = halaqah.map(function(h) {
      var muridCount = (anggotaRes.data || []).filter(function(a) {
        return a.id_halaqah === h.id_halaqah;
      }).length;
      return Object.assign({}, h, {
        total_murid  : muridCount,
        pertemuan_ke : (kbmCounts[h.id_halaqah] || 0) + 1,
        sisa_sesi    : Math.max(0, 40 - (kbmCounts[h.id_halaqah] || 0)),
      });
    });

    return {
      status: 'ok',
      data: {
        halaqah      : halaqah,
        total_halaqah: halaqah.length,
        total_murid  : muridSet.size,
        kbm_hari_ini : (kbmHariRes.data || []).length,
        kbm_bulan_ini: (kbmBulanRes.data || []).length,
        sesi_draft   : draftRes.data || null,
      }
    };
  },

  // ── Jadwal hari ini ────────────────────────
  getJadwalHariIni: async function() {
    var id_guru = _uid();
    var hari    = _hariIni();

    var { data: halaqah, error } = await _sb.from('halaqah')
      .select('*, anggota(count)')
      .eq('id_guru', id_guru).eq('status', 'aktif');
    _check(error, 'getJadwalHariIni');

    // Hitung pertemuan_ke per halaqah
    var hqIds = (halaqah || []).map(function(h) { return h.id_halaqah; });
    var kbmCounts = {};
    if (hqIds.length > 0) {
      var { data: kbmAll } = await _sb.from('kbm_log')
        .select('id_halaqah').in('id_halaqah', hqIds).eq('status', 'selesai');
      (kbmAll || []).forEach(function(k) {
        kbmCounts[k.id_halaqah] = (kbmCounts[k.id_halaqah] || 0) + 1;
      });
    }

    var result = (halaqah || []).map(function(h) {
      var jadwalHari = (h.jadwal_hari || '').split(/[,\s]+/);
      var isHariIni  = jadwalHari.some(function(j) {
        return j.toLowerCase().includes(hari.toLowerCase());
      });
      return {
        id_halaqah  : h.id_halaqah,
        nama_halaqah: h.nama_halaqah,
        level       : h.level,
        jadwal_hari : h.jadwal_hari,
        jam_mulai   : h.jam_mulai,
        jam_selesai : h.jam_selesai,
        lokasi      : h.lokasi,
        total_murid : h.anggota ? h.anggota[0].count : 0,
        pertemuan_ke: (kbmCounts[h.id_halaqah] || 0) + 1,
        total_sesi  : kbmCounts[h.id_halaqah] || 0,
        is_hari_ini : isHariIni,
      };
    });

    result.sort(function(a, b) {
      if (a.is_hari_ini && !b.is_hari_ini) return -1;
      if (!a.is_hari_ini && b.is_hari_ini) return 1;
      return (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
    });

    return { status: 'ok', data: result, hari_ini: hari };
  },

  // ── Halaqah ────────────────────────────────
  getHalaqahSaya: async function() {
    var { data, error } = await _sb.from('halaqah')
      .select('*').eq('id_guru', _uid()).eq('status', 'aktif').order('nama_halaqah');
    _check(error, 'getHalaqahSaya');
    return { status: 'ok', data };
  },

  // ── Murid ──────────────────────────────────
  getMurid: async function(id_halaqah) {
    var [anggotaRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('*, users!anggota_id_murid_fkey(no_hp, email)')
        .eq('id_halaqah', id_halaqah).eq('status', 'aktif').order('nama_murid'),
      _sb.from('nilai_kbm').select('id_murid, status_hadir, adab, kamera_murid')
        .eq('id_halaqah', id_halaqah),
    ]);
    _check(anggotaRes.error, 'getMurid');
    var nilaiAll = nilaiRes.data || [];
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
        skor_dari_40  : Math.min(Math.round(hadirCount / 40 * 100), 100),
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

    // Hitung pertemuan_ke — pisahkan counter KBM Reguler dan KBM Qiyam
    var isKbmQiyam = d.jenis_sesi === 'KBM Qiyam';
    var countQ = _sb.from('kbm_log').select('*', { count: 'exact', head: true })
      .eq('id_halaqah', d.id_halaqah).eq('status', 'selesai')
      .eq('jenis_sesi', isKbmQiyam ? 'KBM Qiyam' : 'KBM Reguler');
    var { count } = await countQ;

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru  : _uid(), nama_guru: _currentUser && _currentUser.nama,
      tanggal_pertemuan: d.tanggal_pertemuan,
      jam_mulai: d.jam_mulai, jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      pertemuan_ke: d.pertemuan_ke_custom || ((count || 0) + 1),
      status: 'draft',
    }).select().single();
    _check(error, 'bukaKBM');
    return { status: 'ok', message: 'Sesi KBM berhasil dibuka', data };
  },

  getDraftCount: async function() {
    var { count } = await _sb.from('kbm_log').select('*', { count: 'exact', head: true })
      .eq('id_guru', _uid()).eq('status', 'draft');
    return { status: 'ok', data: count || 0 };
  },

  simpanPresensi: async function(d) {
    var rows = d.presensi.map(function(p) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: p.id_murid,
      status_hadir: p.status_hadir,
      pertemuan_ke: d.pertemuan_ke, tanggal: d.tanggal || d.tanggal_pertemuan,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
    }; });
    var { error } = await _sb.from('nilai_kbm')
      .upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanPresensi');
    var hadir = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var alpa  = d.presensi.filter(function(p) { return p.status_hadir === 'A'; }).length;
    await _sb.from('kbm_log').update({ jumlah_hadir: hadir, jumlah_alpa: alpa }).eq('id_kbm', d.id_kbm);
    return { status: 'ok', message: 'Presensi berhasil disimpan', jumlah_hadir: hadir };
  },

  simpanNilaiMurid: async function(d) {
    var { error } = await _sb.from('nilai_kbm').update({
      adab: d.adab, kamera_murid: d.kamera_murid,
      koreksi_tahsin: d.koreksi_tahsin, catatan_murid: d.catatan_murid,
    }).eq('id_kbm', d.id_kbm).eq('id_murid', d.id_murid);
    _check(error, 'simpanNilaiMurid');
    return { status: 'ok' };
  },

  simpanNilaiMuridBatch: async function(d) {
    var updates = (d.nilai_list || d.nilai || []).map(function(n) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: n.id_murid,
      adab: n.adab, kamera_murid: n.kamera_murid,
      koreksi_tahsin: n.koreksi_tahsin, catatan_murid: n.catatan_murid,
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
    }).eq('id_kbm', d.id_kbm);
    _check(error, 'simpanJurnalKBM');
    return { status: 'ok', message: 'Jurnal KBM berhasil disimpan' };
  },

  tutupKBM: async function(id_kbm) {
    var { count } = await _sb.from('nilai_kbm').select('*', { count: 'exact', head: true }).eq('id_kbm', id_kbm);
    if (count === null || count === 0) {
      // Tidak auto-delete — guru harus aktif memilih hapus via hapusKBM()
      return { status: 'error', message: 'Belum ada presensi murid. Isi presensi dulu atau hapus sesi secara manual.' };
    }
    var { data: kbm } = await _sb.from('nilai_kbm').select('status_hadir').eq('id_kbm', id_kbm);
    var hadir = (kbm || []).filter(function(n) { return ['H','T'].includes(n.status_hadir); }).length;
    var alpa  = (kbm || []).filter(function(n) { return n.status_hadir === 'A'; }).length;
    var { error } = await _sb.from('kbm_log').update({
      status: 'selesai', jumlah_hadir: hadir, jumlah_alpa: alpa,
    }).eq('id_kbm', id_kbm);
    _check(error, 'tutupKBM');
    // Push setelah sesi ditutup (fire-and-forget, tidak blocking)
    (async function() {
      try {
        var { data: kbmData } = await _sb.from('kbm_log')
          .select('id_halaqah, pertemuan_ke, nama_guru, tanggal_pertemuan')
          .eq('id_kbm', id_kbm).single();
        if (!kbmData) return;

        // 1. Push ke ketua kelas — window observasi terbuka
        var { data: anggota } = await _sb.from('anggota')
          .select('id_murid, is_ketua').eq('id_halaqah', kbmData.id_halaqah).eq('status','aktif');
        var ketuaIds = (anggota || []).filter(function(a){ return a.is_ketua; }).map(function(a){ return a.id_murid; });
        if (ketuaIds.length) {
          _sendPushBg({
            user_ids: ketuaIds,
            title: '📋 Isi Observasi KBM Sekarang!',
            body : 'Sesi pertemuan ke-' + (kbmData.pertemuan_ke || '') + ' selesai. Window observasi terbuka — isi sebelum guru mulai sesi berikutnya.',
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
    // Update tanggal & pertemuan_ke di kbm_log jika berubah
    if (d.tanggal_pertemuan || d.pertemuan_ke) {
      var upd = {};
      if (d.tanggal_pertemuan) upd.tanggal_pertemuan = d.tanggal_pertemuan;
      if (d.pertemuan_ke)      upd.pertemuan_ke      = d.pertemuan_ke;
      await _sb.from('kbm_log').update(upd).eq('id_kbm', d.id_kbm);
    }
    return { status: 'ok', message: 'Presensi berhasil diperbarui' };
  },

  getKBMByHalaqah: async function(id_halaqah, limit, offset) {
    var { data, error, count } = await _sb.from('kbm_log')
      .select('*', { count: 'exact' }).eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 10) - 1);
    _check(error, 'getKBMByHalaqah');
    return { status: 'ok', data, total: count, has_more: (offset||0) + (limit||10) < count };
  },

  getNilaiByKBM: async function(id_kbm) {
    var { data, error } = await _sb.from('nilai_kbm').select('*').eq('id_kbm', id_kbm);
    _check(error, 'getNilaiByKBM');
    // Ambil nama murid terpisah untuk hindari ambiguitas FK join
    var ids = (data || []).map(function(r) { return r.id_murid; });
    var namaMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap').in('id_user', ids);
      (users || []).forEach(function(u) { namaMap[u.id_user] = u.nama_lengkap; });
    }
    return { status: 'ok', data: (data || []).map(function(r) {
      return Object.assign({}, r, { nama_murid: namaMap[r.id_murid] || r.id_murid });
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

  getRiwayatMuridKoreksi: async function(id_murid, limit) {
    var { data, error } = await _sb.from('nilai_kbm')
      .select('koreksi_tahsin, tanggal, pertemuan_ke')
      .eq('id_murid', id_murid).neq('koreksi_tahsin', '')
      .order('tanggal', { ascending: false }).limit(limit || 10);
    _check(error, 'getRiwayatMuridKoreksi');
    return { status: 'ok', data };
  },

  // ── Pengumuman ─────────────────────────────
  kirimPengumuman: async function(d) {
    var { data, error } = await _sb.from('pengumuman').insert({
      judul: d.judul, isi: d.isi,
      target: d.target || 'semua', id_halaqah: d.id_halaqah || null,
      dibuat_oleh: _uid(), nama_pembuat: _currentUser && _currentUser.nama,
      tanggal: new Date().toISOString().slice(0, 10), status: 'aktif',
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
    var baris  = '[' + tglStr + '] Sudah dihubungi — ' + (d.tipe_alert||'keaktifan') + ' (' + (d.value||0) + 'x)';
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
      _sb.from('assessment_items').select('id_item').eq('level', level).eq('status','aktif'),
      _sb.from('assessment_murid').select('id_murid, id_item, status, updated_at').in('id_murid', muridIds),
    ]);
    var items      = itemsRes.data  || [];
    var totalItems = items.length;
    var itemSet    = new Set(items.map(function(i){ return i.id_item; }));
    // Group jawaban per murid
    var jawabanMap = {};
    (jawabanRes.data || []).forEach(function(j) {
      if (!jawabanMap[j.id_murid]) jawabanMap[j.id_murid] = { items:{}, last_update: null };
      jawabanMap[j.id_murid].items[j.id_item] = j.status;
      if (!jawabanMap[j.id_murid].last_update || j.updated_at > jawabanMap[j.id_murid].last_update)
        jawabanMap[j.id_murid].last_update = j.updated_at;
    });
    var data = anggota.map(function(m) {
      var mj = jawabanMap[m.id_murid] || { items:{}, last_update: null };
      var paham=0, ragu=0, belum=0, kosong=0;
      itemSet.forEach(function(id_item) {
        var s = mj.items[id_item];
        if      (s === 'paham') paham++;
        else if (s === 'ragu' ) ragu++;
        else if (s === 'belum') belum++;
        else kosong++;
      });
      return { id_murid:m.id_murid, nama_murid:m.nama_murid, summary:{paham,ragu,belum,kosong}, pct_paham:totalItems>0?Math.round(paham/totalItems*100):0, last_update:mj.last_update };
    }).sort(function(a,b){ return a.pct_paham - b.pct_paham; });
    return { status:'ok', data, total_items: totalItems, level };
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
    if (!sesiIds.length) return { status: 'ok', data: [], total_sesi: 0, summary: { pct_keseluruhan: 0, total_murid: 0, total_hadir: 0, total_absen: 0 } };
    var q = _sb.from('at_tibyan_log')
      .select('id_murid, nama_murid, status_hadir, id_halaqah, nama_halaqah')
      .in('id_sesi', sesiIds);
    if (id_halaqah) q = q.eq('id_halaqah', id_halaqah);
    var { data, error } = await q;
    _check(error, 'getAtTibyanRekap');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid || '', nama_halaqah: r.nama_halaqah, level: '', hadir: 0, absen: 0, total: 0 };
      var m = muridMap[r.id_murid];
      m.total++;
      if (['H','T'].includes(r.status_hadir)) m.hadir++; else if (r.status_hadir === 'A') m.absen++;
    });
    // Ambil nama_lengkap & level dari users agar nama selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap, level').in('id_user', muridIds);
      (users || []).forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
          muridMap[u.id_user].level = u.level || '';
        }
      });
    }
    var rows = Object.values(muridMap).map(function(m) {
      return Object.assign(m, { pct_hadir: m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0 });
    }).sort(function(a,b){ return (a.nama_murid||'').localeCompare(b.nama_murid||''); });
    var totalHadir = rows.reduce(function(s,m){ return s+m.hadir; }, 0);
    var totalAbsen = rows.reduce(function(s,m){ return s+m.absen; }, 0);
    var totalEntries = rows.reduce(function(s,m){ return s+m.total; }, 0);
    return { status: 'ok', data: rows, total_sesi: totalSesi,
      summary: { pct_keseluruhan: totalEntries > 0 ? Math.round(totalHadir/totalEntries*100) : 0, total_murid: rows.length, total_hadir: totalHadir, total_absen: totalAbsen } };
  },

  getAtTibyanKeaktifan: async function() {
    var id_guru = _uid();
    var { data: sesiList } = await _sb.from('at_tibyan_sesi')
      .select('id_sesi').eq('id_guru', id_guru).eq('status', 'selesai');
    var sesiIds = (sesiList || []).map(function(s){ return s.id_sesi; });
    var totalSesi = sesiIds.length;
    if (!sesiIds.length) return { status: 'ok', data: { alerts: [], summary: { kritis: 0, peringatan: 0, normal: 0 } } };
    var { data, error } = await _sb.from('at_tibyan_log')
      .select('id_murid, nama_murid, id_halaqah, nama_halaqah, status_hadir, tanggal')
      .in('id_sesi', sesiIds).order('tanggal', { ascending: true });
    _check(error, 'getAtTibyanKeaktifan');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = {
        id_murid: r.id_murid, nama_murid: r.nama_murid, nama_halaqah: r.nama_halaqah,
        level: '', hadir: 0, absen: 0, total: 0, riwayat: []
      };
      var m = muridMap[r.id_murid]; m.total++;
      var hadir = ['H','T'].includes(r.status_hadir);
      if (hadir) m.hadir++; else if (r.status_hadir === 'A') m.absen++;
      m.riwayat.push({ warna: hadir ? 'hijau' : 'merah', tanggal: r.tanggal });
    });
    // Ambil nama_lengkap, no_hp, level dari users agar selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap, no_hp, level').in('id_user', muridIds);
      (users || []).forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
          muridMap[u.id_user].no_hp  = u.no_hp  || '';
          muridMap[u.id_user].level  = u.level  || '';
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
    var id_sesi = _genId('ATS');
    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var { error: errSesi } = await _sb.from('at_tibyan_sesi').insert({
      id_sesi, tanggal: d.tanggal, id_guru: _uid(),
      nama_guru: _currentUser && _currentUser.nama,
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

    await _sb.from('at_tibyan_log').delete().eq('id_sesi', d.id_sesi);
    await _sb.from('at_tibyan_sesi').update({ total_hadir: hadirCount }).eq('id_sesi', d.id_sesi);

    var { error: insertErr } = await _sb.from('at_tibyan_log').insert(logRows);
    if (insertErr) {
      // Rollback: kembalikan data lama
      if (oldLogs && oldLogs.length) {
        var rollbackRows = oldLogs.map(function(r) {
          var copy = Object.assign({}, r);
          delete copy.id; delete copy.created_at;
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
    var { data: anggota, error: errAnggota } = await _sb.from('anggota').select('id_murid, nama_murid').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    _check(errAnggota, 'generateRaportHalaqah:anggota');
    if (!anggota || !anggota.length) return { status: 'error', message: 'Tidak ada murid aktif di halaqah ini.' };
    var { data: komponen, error: errKomp } = await _sb.from('komponen_raport').select('*').eq('id_periode', d.id_periode).eq('status', 'aktif').order('urutan');
    _check(errKomp, 'generateRaportHalaqah:komponen');
    if (!komponen || !komponen.length) return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini.' };
    var { data: nilaiManual } = await _sb.from('nilai_manual').select('*').eq('id_periode', d.id_periode);
    var { data: nilaiKBM } = await _sb.from('nilai_kbm').select('*').eq('id_halaqah', d.id_halaqah);
    var { data: atLog } = await _sb.from('at_tibyan_log').select('id_murid, status_hadir').eq('id_halaqah', d.id_halaqah);
    var { count: totalAt } = await _sb.from('at_tibyan_sesi').select('*', { count: 'exact', head: true }).eq('id_guru', d.id_guru || _uid()).eq('status', 'selesai');
    var { data: catatan } = await _sb.from('catatan_raport').select('catatan').eq('id_halaqah', d.id_halaqah).maybeSingle();

    var berhasil = [], gagal = [];
    for (var i = 0; i < (anggota || []).length; i++) {
      var m = anggota[i];
      try {
        var raportData = _kalkulasiRaport(m.id_murid, d.id_periode, d.id_halaqah,
          komponen, nilaiManual, nilaiKBM, atLog, totalAt || 0);
        var detailJson = raportData.komponen;
        var { error: upErr } = await _sb.from('raport')
          .upsert({
            id_murid: m.id_murid, id_periode: d.id_periode, id_halaqah: d.id_halaqah,
            nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat,
            detail_json: detailJson, tanggal_cetak: new Date().toISOString().slice(0,10),
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
      dibuat_oleh: _uid(), nama_pembuat: _currentUser && _currentUser.nama,
      tanggal: new Date().toISOString().slice(0,10), status: 'aktif',
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
    var { data: murid } = await _sb.from('users').select('nama_lengkap, email').eq('id_user', raport.id_murid).single();
    var { data: halaqah } = await _sb.from('halaqah').select('nama_halaqah, nama_guru').eq('id_halaqah', raport.id_halaqah).single();
    var { data: periode } = await _sb.from('periode').select('nama_periode').eq('id_periode', raport.id_periode).single();
    var { data: nilaiKBM } = await _sb.from('nilai_kbm').select('*').eq('id_murid', raport.id_murid).eq('id_halaqah', raport.id_halaqah).order('tanggal');
    var { data: nilaiManual } = await _sb.from('nilai_manual').select('*').eq('id_murid', raport.id_murid).eq('id_periode', raport.id_periode);
    var { data: catatan } = await _sb.from('catatan_raport').select('catatan').eq('id_halaqah', raport.id_halaqah).maybeSingle();
    var komponen = raport.detail_json ? (typeof raport.detail_json === 'string' ? (function(){try{return JSON.parse(raport.detail_json);}catch(e){return [];}})() : raport.detail_json) : [];
    var hadirList = (nilaiKBM || []).filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
    var totalSesi = (nilaiKBM || []).length;
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
      sesi: (nilaiKBM || []).map(function(n, i) { return {
        no: i+1, pertemuan_ke: n.pertemuan_ke, tanggal: n.tanggal,
        status_hadir: n.status_hadir, adab: n.adab, kamera: n.kamera_murid,
        koreksi: n.koreksi_tahsin, catatan_murid: n.catatan_murid, materi: '-',
      }; }),
      summary: {
        total_sesi: totalSesi, total_hadir: hadirList.length,
        total_alpa: (nilaiKBM||[]).filter(function(n){return n.status_hadir==='A';}).length,
        total_izin: (nilaiKBM||[]).filter(function(n){return n.status_hadir==='I';}).length,
        total_terlambat: (nilaiKBM||[]).filter(function(n){return n.status_hadir==='T';}).length,
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
    return { status: 'ok', data };
  },

  // Ambil data Ziyadah murid tertentu (untuk validasi range Murajaah)
  getZiyadahMurid: async function(id_halaqah, id_murid) {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('surat, juz, ayat_dari, ayat_sampai')
      .eq('id_halaqah', id_halaqah)
      .eq('id_murid', id_murid)
      .eq('jenis', 'Ziyadah');
    _check(error, 'getZiyadahMurid');
    // Merge range per surat (ambil min ayat_dari & max ayat_sampai)
    var map = {};
    (data || []).forEach(function(r) {
      if (!map[r.surat]) {
        map[r.surat] = { surat: r.surat, juz: r.juz, ayat_dari: r.ayat_dari, ayat_sampai: r.ayat_sampai };
      } else {
        map[r.surat].ayat_dari   = Math.min(map[r.surat].ayat_dari,   r.ayat_dari);
        map[r.surat].ayat_sampai = Math.max(map[r.surat].ayat_sampai, r.ayat_sampai);
      }
    });
    return { status: 'ok', data: Object.values(map) };
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

  // ── Raport Tahfidz ─────────────────────────────────────────────────────
  // Ambil semua setoran hafalan dalam rentang tanggal (untuk raport)
  getRaportTahfidzData: async function(id_halaqah, id_murid, tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: true });
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
  getTargetHafalanMurid: async function(id_halaqah) {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('id_murid, nama_murid, target_surat, target_ayat_dari, target_ayat_sampai, created_at')
      .eq('id_halaqah', id_halaqah)
      .not('target_surat', 'is', null)
      .order('created_at', { ascending: false });
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
};

// ─────────────────────────────────────────────
//  KALKULASI RAPORT (helper internal)
// ─────────────────────────────────────────────
function _kalkulasiRaport(idMurid, idPeriode, idHalaqah, komponen, nilaiManual, nilaiKBM, atLog, totalAt) {
  var myKBM = (nilaiKBM || []).filter(function(n) { return n.id_murid === idMurid; });
  var myManual = (nilaiManual || []).filter(function(n) { return n.id_murid === idMurid; });
  var myAt = (atLog || []).filter(function(n) { return n.id_murid === idMurid; });

  var ADAB_W = 70, KAM_W = 30;

  var nilaiKomp = (komponen || []).map(function(k) {
    var v = 0, nama = (k.nama_komponen || '').toLowerCase();
    if (k.tipe === 'manual') {
      var nm = myManual.find(function(n) { return n.id_komponen === k.id_komponen; });
      v = nm ? Number(nm.nilai) || 0 : 0;
    } else {
      var hadir = myKBM.filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
      if (nama.includes('kehadiran') && !nama.includes('tibyan')) {
        var skor = myKBM.reduce(function(s,n) { var kd=String(n.status_hadir||'').toUpperCase(); return s+(kd==='H'?1:kd==='T'?0.7:kd==='I'?0.5:0); }, 0);
        v = myKBM.length > 0 ? Math.round(skor/myKBM.length*100) : 0;
      } else if (nama.includes('kbm') || nama.includes('harian')) {
        var ts = 0; hadir.forEach(function(n) { var a=n.adab==='Baik'?100:50; var km=n.kamera_murid==='kamera terbuka'?100:n.kamera_murid==='kamera selalu tertutup'?0:50; ts+=Math.round((a*ADAB_W+km*KAM_W)/100); });
        v = hadir.length > 0 ? Math.round(ts/hadir.length) : 0;
      } else if (nama.includes('adab')) {
        var vAdab = hadir.filter(function(n){return n.adab;});
        v = vAdab.length > 0 ? Math.round(vAdab.filter(function(n){return n.adab==='Baik';}).length/vAdab.length*100) : 0;
      } else if (nama.includes('tibyan') || nama.includes('at-tibyan')) {
        var hadirAt = myAt.filter(function(n){return ['H','T'].includes(String(n.status_hadir||'').toUpperCase());}).length;
        v = totalAt > 0 ? Math.round(hadirAt/totalAt*100) : 0;
      }
    }
    return { id_komponen: k.id_komponen, nama_komponen: k.nama_komponen, bobot: Number(k.bobot), nilai: v, nilai_bobot: Math.round(v*Number(k.bobot)/100), tipe: k.tipe };
  });

  var nilaiAkhir = nilaiKomp.reduce(function(s,k){return s+k.nilai_bobot;}, 0);
  var alpa = myKBM.filter(function(n){return String(n.status_hadir||'').toUpperCase()==='A';}).length;
  if (myKBM.length > 0 && alpa === 0) nilaiAkhir = Math.min(100, nilaiAkhir + 5);
  var predikat = myKBM.length === 0 ? 'Belum Ada Data'
    : nilaiAkhir >= 90 ? 'Mumtaz' : nilaiAkhir >= 80 ? 'Jayyid Jiddan' : nilaiAkhir >= 70 ? 'Jayyid' : 'Maqbul';
  return { nilai_akhir: nilaiAkhir, predikat, komponen: nilaiKomp };
}

// ─────────────────────────────────────────────
//  MURID API
// ─────────────────────────────────────────────
var MuridAPI = {
  getDashboard: async function() {
    var id_murid = _uid();
    var [anggotaRes, userRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('status', 'aktif').maybeSingle(),
      _sb.from('users').select('*').eq('id_user', id_murid).maybeSingle(),
      _sb.from('nilai_kbm').select('status_hadir, adab, kamera_murid').eq('id_murid', id_murid),
    ]);
    var anggota    = anggotaRes.data;
    var user       = userRes.data;
    var nilai      = nilaiRes.data || [];
    var id_halaqah = anggota && anggota.halaqah && anggota.halaqah.id_halaqah;
    // Fetch pengumuman aktif untuk murid ini (target: semua atau halaqah ini)
    var pengumumanQuery = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(5);
    if (id_halaqah) pengumumanQuery = pengumumanQuery.or('target.in.(semua,all),id_halaqah.eq.'+id_halaqah);
    else pengumumanQuery = pengumumanQuery.in('target',['semua','all']);
    var prQuery = _sb.from('nilai_kbm')
      .select('tanggal, pertemuan_ke, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar)')
      .eq('id_murid', id_murid).in('status_hadir',['H','T'])
      .not('kbm_log.latihan_mandiri','is',null)
      .order('tanggal',{ascending:false}).limit(10);
    var [{ data: pengumuman }, { data: prRaw }] = await Promise.all([pengumumanQuery, prQuery]);
    var today = new Date().toISOString().slice(0,10);
    var prAktif = (prRaw||[])
      .filter(function(n){ return n.kbm_log && n.kbm_log.latihan_mandiri; })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        return Object.assign({}, n.kbm_log, {
          tanggal: n.tanggal, pertemuan_ke: n.pertemuan_ke,
          deadline: dl,
          status_deadline: !dl ? 'aktif' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : 'aktif',
        });
      })
      .filter(function(n){ return n.status_deadline !== 'lewat'; });
    var countH  = nilai.filter(function(n) { return n.status_hadir === 'H'; }).length;
    var countT  = nilai.filter(function(n) { return n.status_hadir === 'T'; }).length;
    var countI  = nilai.filter(function(n) { return n.status_hadir === 'I'; }).length;
    var countA  = nilai.filter(function(n) { return n.status_hadir === 'A'; }).length;
    var totalHadir  = countH + countT;
    var totalSesi   = nilai.length;
    var pctHadir    = totalSesi > 0 ? Math.round(totalHadir / totalSesi * 100) : 0;
    // Poin Adab & Kamera — hanya dari sesi hadir yang sudah dinilai
    var hadirNilai  = nilai.filter(function(n){ return ['H','T'].includes(n.status_hadir); });
    var adabData    = hadirNilai.filter(function(n){ return n.adab; });
    var adabBaik    = adabData.filter(function(n){ return n.adab==='Baik'; }).length;
    var poinAdab    = adabData.length > 0 ? Math.round(adabBaik/adabData.length*100) : undefined;
    var kameraData  = hadirNilai.filter(function(n){ return n.kamera_murid; });
    var kamTerbuka  = kameraData.filter(function(n){ return n.kamera_murid==='kamera terbuka'; }).length;
    var kamSeltup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera selalu tertutup'; }).length;
    var kamSegtup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera sering tertutup'; }).length;
    var poinKamera  = kameraData.length > 0 ? Math.round(kamTerbuka/kameraData.length*100) : undefined;
    var hq = (anggota && anggota.halaqah) || {};
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
      },
      kehadiran: {
        skor_hadir  : totalHadir,
        skor_dari_40: Math.min(Math.round(totalHadir / 40 * 100), 100),
        pct_hadir   : pctHadir,
        total_hadir : totalHadir,
        total_sesi  : totalSesi,
        sisa_sesi   : Math.max(0, 40 - totalSesi),
        count_h     : countH,
        count_t     : countT,
        count_i     : countI,
        count_a     : countA,
      },
      // Fields profil di root agar frontend bisa akses langsung (d.id_murid, d.no_hp, d.email)
      id_murid   : id_murid,
      no_hp      : user && user.no_hp  || '',
      email      : user && user.email  || '',
      poin_adab  : poinAdab,
      poin_kamera: poinKamera,
      poin_adab_detail  : { baik: adabBaik, cukup: adabData.length - adabBaik },
      poin_kamera_detail: { terbuka: kamTerbuka, selalu_tertutup: kamSeltup, sering_tertutup: kamSegtup },
      pengumuman : pengumuman || [],
      pr_aktif   : prAktif,
    }};
  },

  getRiwayat: async function(limit, offset) {
    var id_murid = _uid();
    var { data, error, count } = await _sb.from('nilai_kbm')
      .select('*, kbm_log!nilai_kbm_id_kbm_fkey(tanggal_pertemuan,pertemuan_ke,materi_belajar,latihan_mandiri,jenis_latihan,deadline_latihan)', { count: 'exact' })
      .eq('id_murid', id_murid)
      .order('tanggal', { ascending: false })
      .range(offset||0, (offset||0)+(limit||8)-1);
    _check(error, 'getRiwayat');
    var mapped = (data||[]).map(function(n) { return Object.assign({}, n, {
      tanggal         : n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
      pertemuan_ke    : (n.kbm_log && n.kbm_log.pertemuan_ke) || n.pertemuan_ke,
      materi_belajar  : n.kbm_log && n.kbm_log.materi_belajar,
      latihan_mandiri : n.kbm_log && n.kbm_log.latihan_mandiri,
      jenis_latihan   : n.kbm_log && n.kbm_log.jenis_latihan,
      deadline_latihan: n.kbm_log && n.kbm_log.deadline_latihan,
    }); });
    return { status: 'ok', data: mapped, total: count, has_more: (offset||0)+(limit||8) < (count||0) };
  },

  getLatihanMandiri: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('nilai_kbm')
      .select('tanggal, pertemuan_ke, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar)')
      .eq('id_murid', id_murid).in('status_hadir',['H','T'])
      .not('kbm_log.latihan_mandiri', 'is', null)
      .order('tanggal', { ascending: false }).limit(20);
    _check(error, 'getLatihanMandiri');
    var today = new Date().toISOString().slice(0,10);
    var rows = (data||[])
      .filter(function(n){ return n.kbm_log && n.kbm_log.latihan_mandiri; })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        var daysLeft = dl ? Math.ceil((new Date(dl) - new Date(today)) / 86400000) : null;
        var status = !dl ? 'none' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : daysLeft <= 3 ? 'mepet' : 'aman';
        return {
          tanggal        : n.tanggal,
          pertemuan_ke   : n.pertemuan_ke,
          latihan_mandiri: n.kbm_log.latihan_mandiri,
          jenis_latihan  : n.kbm_log.jenis_latihan,
          deadline       : dl,
          materi_belajar : n.kbm_log.materi_belajar,
          status_deadline: status,
        };
      });
    return { status: 'ok', data: rows };
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
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid', id_murid).eq('status','aktif').single();
    var id_halaqah = anggota && anggota.id_halaqah;
    var q = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(15);
    if (id_halaqah) q = q.or('target.in.(semua,all),id_halaqah.eq.' + id_halaqah);
    else q = q.in('target', ['semua','all']);
    var { data, error } = await q;
    _check(error, 'getPengumuman');
    return { status: 'ok', data };
  },

  getSPPStatus: async function() {
    var id_murid = _uid();
    var tahunIni = new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran')
      .select('*').eq('id_murid', id_murid)
      .order('tahun',{ascending:false}).order('created_at',{ascending:false});
    if (error) return { status: 'ok', data: { rows: [], lunas_bulan: [], tunggakan: 0, total_nominal: 0 } };
    var rows = data || [];
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    // Tahun aktif: tahun ini atau tahun terakhir ada data
    var tahunAktif = rows.length ? Math.max(tahunIni, rows[0].tahun) : tahunIni;
    var rowsTahunIni = rows.filter(function(r){ return r.tahun === tahunAktif; });
    var lunasBulan  = rowsTahunIni.filter(function(r){ return r.status==='lunas'; }).map(function(r){ return r.bulan; });
    var menunggu    = rowsTahunIni.filter(function(r){ return r.status==='menunggu'; }).map(function(r){ return r.bulan; });
    var bulanGrid   = BULAN.map(function(b) {
      var l = lunasBulan.includes(b);
      var m = menunggu.includes(b);
      return { bulan:b, status: l?'lunas': m?'menunggu':'belum' };
    });
    var totalNominal = rowsTahunIni.filter(function(r){return r.status==='lunas';}).reduce(function(s,r){return s+Number(r.nominal||0);},0);
    var TOTAL_REKAP  = 5;
    var bulanSelesai = new Date().getMonth(); // bulan yg sudah lewat (Juni=5 → Jan-Mei selesai)
    // Window SELALU dimulai dari max(0, bulanSelesai - TOTAL_REKAP)
    // agar tidak salah hitung lunas saat murid baru bayar sebagian di akhir window
    var startIdx = Math.max(0, bulanSelesai - TOTAL_REKAP);
    var endIdx   = bulanSelesai; // eksklusif
    var bulanDiWindow = BULAN.slice(startIdx, endIdx);
    var tunggakan = bulanDiWindow.filter(function(b){ return !lunasBulan.includes(b); }).length;
    return { status: 'ok', data: {
      rows, lunas_bulan: lunasBulan, menunggu_bulan: menunggu,
      bulan_grid: bulanGrid, tunggakan, total_nominal: totalNominal,
      tahun_aktif: tahunAktif, has_paid: lunasBulan.length > 0,
      start_bulan: BULAN[startIdx], end_bulan: BULAN[endIdx-1],
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
    var rows = bulanList.map(function(bulan) {
      return {
        id_spp    : 'SPP-' + id_murid + '-' + bulan.substring(0,3).toUpperCase() + '-' + d.tahun,
        id_murid, nama_murid: user.nama_lengkap || user.nama || '',
        id_halaqah,
        bulan, tahun: Number(d.tahun),
        jenis: d.jenis || 'SPP Pribadi',
        status: 'menunggu',
        nominal: bulanList.length > 1 ? Math.round(Number(d.nominal||0) / bulanList.length) : Number(d.nominal||0),
        metode_transfer: d.metode_transfer || '',
        bukti_url: d.bukti_url || '',
        catatan: d.catatan || '',
      };
    });
    var { error } = await _sb.from('spp_pembayaran').upsert(rows, { onConflict: 'id_spp' });
    _check(error, 'konfirmasiSPP');
    var jumlah = bulanList.length > 1 ? bulanList.length + ' bulan' : 'pembayaran';
    return { status: 'ok', message: 'Konfirmasi ' + jumlah + ' terkirim, menunggu validasi admin.' };
  },

  getProgressGrafik: async function() { return { status: 'ok', data: [] }; },

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
    var {data,error} = await _sb.from('at_tibyan_materi').select('*').order('pertemuan_ke');
    if (!error && data && data.length) {
      var rows = data.map(function(r) {
        return { pertemuan_ke: String(r.pertemuan_ke), tanggal: r.tanggal||'', pemateri: r.pemateri||'', materi_pembahasan: r.materi_pembahasan||'', nasihat_aplikatif: r.nasihat_aplikatif||'' };
      });
      return { status: 'ok', data: rows, columns: ['pertemuan_ke','tanggal','pemateri','materi_pembahasan','nasihat_aplikatif'] };
    }
    return { status: 'ok', data: [], columns: ['pertemuan_ke','tanggal','pemateri','materi_pembahasan','nasihat_aplikatif'] };
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
    var grouped = {};
    (data || []).forEach(function(item) {
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
    var { error } = await _sb.from('users').update({ no_hp: d.no_hp, email: d.email }).eq('id_user', _uid());
    _check(error, 'updateProfil');
    return { status: 'ok' };
  },

  // ── Tahfidz / Setoran Hafalan (Level Qiyam) ──────────────────────────
  // Riwayat setoran milik murid yang login (hanya bisa diakses jika Level Qiyam via RLS)
  getSetoranHafalan: async function(limit, offset) {
    var lim = limit || 10;
    var { data, error, count } = await _sb.from('setoran_hafalan')
      .select('*', { count: 'exact' })
      .eq('id_murid', _uid())
      .order('created_at', { ascending: false })
      .range(offset || 0, (offset || 0) + lim - 1);
    _check(error, 'getSetoranHafalan');
    return { status: 'ok', data: data || [], total: count || 0, has_more: (offset || 0) + lim < (count || 0) };
  },

  // Raport tahfidz murid sendiri (berdasarkan rentang tanggal)
  getMyRaportTahfidz: async function(tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', _uid())
      .order('created_at', { ascending: true });
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getMyRaportTahfidz');
    return { status: 'ok', data: data || [] };
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
};

// ─────────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────────
var AdminAPI = {
  getDashboard: async function() {
    var bulanIni = new Date().toISOString().slice(0,7)+'-01';
    var [usersRes, hqRes, kbmBulanRes, periodeRes, nilaiRes, anggotaRes, kbmSesiRes, raportRes] = await Promise.all([
      _sb.from('users').select('role').eq('status','aktif'),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, level').eq('status','aktif'),
      _sb.from('kbm_log').select('id_kbm',{count:'exact',head:true}).eq('status','selesai').gte('tanggal_pertemuan', bulanIni),
      _sb.from('periode').select('id_periode, nama_periode').eq('status','aktif').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      _sb.from('nilai_kbm').select('id_halaqah, status_hadir'),
      _sb.from('anggota').select('id_halaqah').eq('status','aktif'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai'),
      _sb.from('raport').select('id_halaqah, nilai_akhir').not('nilai_akhir','is',null),
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
    return { status:'ok', data:{
      total_murid: roles.murid||0, total_guru: roles.guru||0,
      total_halaqah: (hqRes.data||[]).length, kbm_bulan_ini: kbmBulanRes.count||0,
      pct_nilai_terisi: totalAnggota>0 ? Math.min(Math.round(totalNilaiIsi/totalAnggota*100),100) : 0,
      periode_aktif: periodeRes.data||null,
      halaqah: halaqah,
    }};
  },
  getAllUsers: async function(p) {
    var q = _sb.from('users').select('*').order('nama_lengkap');
    if (p && p.role) q = q.eq('role',p.role);
    var {data,error} = await q; _check(error,'getAllUsers'); return {status:'ok',data};
  },
  createUser: async function(d) { var {data,error}=await _sb.from('users').insert(d).select().single(); _check(error,'createUser'); return {status:'ok',data}; },
  updateUser: async function(d) { var {id_user,...u}=d; var {data,error}=await _sb.from('users').update(u).eq('id_user',id_user).select().single(); _check(error,'updateUser'); return {status:'ok',data}; },
  deleteUser: async function(id_user) { var {error}=await _sb.from('users').update({status:'nonaktif'}).eq('id_user',id_user); _check(error,'deleteUser'); return {status:'ok'}; },
  getAllHalaqah: async function() { var {data,error}=await _sb.from('halaqah').select('*').order('nama_halaqah'); _check(error,'getAllHalaqah'); return {status:'ok',data}; },
  createHalaqah: async function(d) { var {data,error}=await _sb.from('halaqah').insert(d).select().single(); _check(error,'createHalaqah'); return {status:'ok',data}; },
  updateHalaqah: async function(d) { var {id_halaqah,...u}=d; var {data,error}=await _sb.from('halaqah').update(u).eq('id_halaqah',id_halaqah).select().single(); _check(error,'updateHalaqah'); return {status:'ok',data}; },
  deleteHalaqah: async function(id) { var {error}=await _sb.from('halaqah').update({status:'nonaktif'}).eq('id_halaqah',id); _check(error,'deleteHalaqah'); return {status:'ok'}; },
  getAllAnggota: async function(id_halaqah) {
    var q = _sb.from('anggota').select('*, users!anggota_id_murid_fkey(nama_lengkap,no_hp)');
    if (id_halaqah) q = q.eq('id_halaqah',id_halaqah);
    var {data,error}=await q.order('nama_murid'); _check(error,'getAllAnggota'); return {status:'ok',data};
  },
  addAnggota: async function(d) { var {data,error}=await _sb.from('anggota').insert(d).select().single(); _check(error,'addAnggota'); return {status:'ok',data}; },
  updateAnggota: async function(d) { var {id_anggota,...u}=d; var {error}=await _sb.from('anggota').update(u).eq('id_anggota',id_anggota); _check(error,'updateAnggota'); return {status:'ok'}; },
  removeAnggota: async function(d) { var id=typeof d==='string'?d:(d&&d.id_anggota); var {error}=await _sb.from('anggota').update({status:'nonaktif'}).eq('id_anggota',id); _check(error,'removeAnggota'); return {status:'ok'}; },
  assignKetuaKelas: async function(d) {
    await _sb.from('anggota').update({is_ketua:false}).eq('id_halaqah',d.id_halaqah);
    var {error}=await _sb.from('anggota').update({is_ketua:true}).eq('id_anggota',d.id_anggota);
    _check(error,'assignKetuaKelas'); return {status:'ok'};
  },
  getAllPeriode: async function() { return GuruAPI.getAllPeriode(); },
  createPeriode: async function(d) { var {data,error}=await _sb.from('periode').insert(d).select().single(); _check(error,'createPeriode'); return {status:'ok',data}; },
  updatePeriode: async function(d) { var {id_periode,...u}=d; var {data,error}=await _sb.from('periode').update(u).eq('id_periode',id_periode).select().single(); _check(error,'updatePeriode'); return {status:'ok',data}; },
  getKomponenRaport: async function(id) { return GuruAPI.getKomponenRaport(id); },
  saveKomponenRaport: async function(d) {
    await _sb.from('komponen_raport').update({status:'nonaktif'}).eq('id_periode',d.id_periode);
    var {data,error}=await _sb.from('komponen_raport').insert(d.komponen).select();
    _check(error,'saveKomponenRaport'); return {status:'ok',data};
  },
  getNilaiManual: async function(id) { return GuruAPI.getNilaiManual(id); },
  saveNilaiManual: async function(d) { return GuruAPI.saveNilaiManual(d); },
  saveNilaiManualBatch: async function(d) { return GuruAPI.saveNilaiManualBatch(d); },
  getRaportList: async function(p) {
    var q = _sb.from('raport').select('*, users!raport_id_murid_fkey(nama_lengkap), halaqah(nama_halaqah), periode(nama_periode)');
    if (p && p.id_periode) q = q.eq('id_periode',p.id_periode);
    var {data,error}=await q.order('created_at',{ascending:false}); _check(error,'getRaportList'); return {status:'ok',data};
  },
  publishRaport: async function(d) {
    var {error}=await _sb.from('raport').update({status:'published',published_by:_uid(),published_at:new Date().toISOString()}).eq('id_raport',d.id_raport);
    _check(error,'publishRaport'); return {status:'ok',message:'Raport dipublikasikan'};
  },
  getAllPengumuman: async function() { var {data,error}=await _sb.from('pengumuman').select('*').order('tanggal',{ascending:false}); _check(error,'getAllPengumuman'); return {status:'ok',data}; },
  buatPengumuman: async function(d) {
    var {data,error}=await _sb.from('pengumuman').insert(Object.assign({},d,{dibuat_oleh:_uid(),nama_pembuat:_currentUser&&_currentUser.nama})).select().single();
    _check(error,'buatPengumuman'); return {status:'ok',data};
  },
  getLaporanGlobal: async function() { var {data,error}=await _sb.from('halaqah').select('*, anggota(count), kbm_log(count)').eq('status','aktif'); _check(error,'getLaporanGlobal'); return {status:'ok',data}; },
  getRekapAbsensi: async function(p) { var {data,error}=await _sb.from('nilai_kbm').select('*').eq('id_halaqah',p.id_halaqah).order('tanggal'); _check(error,'getRekapAbsensi'); return {status:'ok',data}; },
  getLevelList: async function() { var {data,error}=await _sb.from('level').select('*').eq('status','aktif').order('urutan'); _check(error,'getLevelList'); return {status:'ok',data}; },
  saveLevel: async function(d) { var {data,error}=await _sb.from('level').upsert(d,{onConflict:'id_level'}).select(); _check(error,'saveLevel'); return {status:'ok',data}; },
  getTemplateKoreksi: async function() { return GuruAPI.getTemplateKoreksi(); },
  saveTemplateKoreksi: async function(d) { var {error}=await _sb.from('template_koreksi').upsert(d,{onConflict:'id_template'}); _check(error,'saveTemplateKoreksi'); return {status:'ok'}; },
  resetPassword: async function(id_user, new_password) {
    var token = localStorage.getItem('hq_token');
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
  getObservasiKBM: async function() { var {data,error}=await _sb.from('observasi_kbm').select('*').order('created_at',{ascending:false}); _check(error,'getObservasiKBM'); return {status:'ok',data}; },
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
    _check(error,'getSPPPending'); return { status:'ok', data: data||[] };
  },
  validasiSPP: async function(id_spp, aksi) {
    // Ambil data SPP dulu untuk push ke murid
    var { data: sppRow } = await _sb.from('spp_pembayaran').select('id_murid, bulan, tahun').eq('id_spp', id_spp).single();
    var { error } = await _sb.from('spp_pembayaran').update({
      status: aksi, validated_by: _uid(), validated_at: new Date().toISOString(),
    }).eq('id_spp', id_spp);
    _check(error,'validasiSPP');
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
  getSPPRekap: async function(p) {
    // p: { tahun, id_halaqah, bulan }
    var tahun = p && p.tahun ? Number(p.tahun) : new Date().getFullYear();
    // Hanya SPP Pribadi yang direkap per bulan; Infaq dicatat tapi tidak masuk rekap tunggakan
    var q = _sb.from('spp_pembayaran').select('*').eq('tahun', tahun).eq('status','lunas').eq('jenis','SPP Pribadi');
    if (p && p.id_halaqah) q = q.eq('id_halaqah', p.id_halaqah);
    if (p && p.bulan)      q = q.eq('bulan', p.bulan);
    var { data: sppData, error } = await q;
    _check(error,'getSPPRekap');
    // Ambil semua anggota aktif untuk cross-check
    var anggotaQ = _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, level, halaqah(nama_halaqah)').eq('status','aktif');
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
    var TOTAL_REKAP   = 5;
    // Bulan terakhir yang sudah selesai (getMonth() tanpa +1: Juni=5 → Jan-Mei sudah lewat)
    var bulanSelesai  = new Date().getMonth(); // 0-indexed, eksklusif
    // Window SELALU dari max(0, bulanSelesai-TOTAL_REKAP) sampai bulanSelesai
    // agar murid tidak dianggap lunas hanya karena bayar sebagian di akhir window
    var startIdx = Math.max(0, bulanSelesai - TOTAL_REKAP);
    var endIdx   = bulanSelesai;
    var bulanRekap = BULAN.slice(startIdx, endIdx);
    // Map id_murid → bulan lunas
    var lunasMap = {};
    (sppData||[]).forEach(function(s){
      if (!lunasMap[s.id_murid]) lunasMap[s.id_murid] = [];
      lunasMap[s.id_murid].push(s.bulan);
    });
    var muridList = (anggota||[]).map(function(a) {
      var lunasBulan = lunasMap[a.id_murid] || [];
      var bulanBelum = bulanRekap.filter(function(b){ return !lunasBulan.includes(b); });
      var tunggakan  = bulanBelum.length;
      return {
        id_murid: a.id_murid, nama_murid: a.nama_murid,
        id_halaqah: a.id_halaqah, nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '',
        level: a.level, no_hp: hpMap[a.id_murid] || '',
        lunas_bulan: lunasBulan, tunggakan, bulan_belum: bulanBelum,
      };
    }).sort(function(a,b){ return b.tunggakan - a.tunggakan || a.nama_murid.localeCompare(b.nama_murid); });
    var totalNominal = (sppData||[]).reduce(function(s,r){return s+Number(r.nominal||0);},0);
    // Lunas = tunggakan===0 DAN sudah bayar minimal TOTAL_REKAP bulan di window
    var lunas     = muridList.filter(function(m){ return m.tunggakan===0 && bulanRekap.length>0; }).length;
    var menunggak = muridList.filter(function(m){ return m.tunggakan>0; }).length;
    return { status:'ok', data:{ murid_list: muridList, total_nominal: totalNominal, lunas, menunggak, tahun,
      bulan_rekap: bulanRekap, total_rekap: TOTAL_REKAP } };
  },
  exportRekapAbsensi: async function(p) { return {status:'ok',message:'Export belum diimplementasi'}; },
  arsipData: async function() { return {status:'ok',message:'Arsip data belum diimplementasi'}; },
  getArsipList: async function() { return {status:'ok',data:[]}; },
  deleteLevel: async function(id) { var {error}=await _sb.from('level').update({status:'nonaktif'}).eq('id_level',id); _check(error,'deleteLevel'); return {status:'ok'}; },
  // ── Import Bulk CSV — 3 Tahap ────────────────────────────────
  importTahap1: async function(d) {
    var halaqah = d.halaqah || [];
    var dibuat = [], skipped = [];
    // Ambil semua halaqah existing untuk cek duplikat
    var { data: existing } = await _sb.from('halaqah').select('nama_halaqah');
    var existingSet = new Set((existing||[]).map(function(h){return h.nama_halaqah.toLowerCase();}));
    // Ambil semua guru untuk mapping nama → id_user
    var { data: gurus } = await _sb.from('users').select('id_user, nama_lengkap').eq('role','guru');
    var guruMap = {};
    (gurus||[]).forEach(function(g){ guruMap[g.nama_lengkap.toLowerCase()] = g.id_user; });
    for (var i = 0; i < halaqah.length; i++) {
      var h = halaqah[i];
      if (existingSet.has(h.nama_halaqah.toLowerCase())) { skipped.push(h.nama_halaqah); continue; }
      var id_guru = guruMap[h.nama_guru.toLowerCase()] || null;
      var suffix  = h.nama_halaqah.replace(/^halaqah\s*/i,'').replace(/^al-?/i,'').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,12);
      var id_halaqah = 'HQ-' + (suffix || String(Date.now()).slice(-6));
      var { error } = await _sb.from('halaqah').insert({
        id_halaqah, nama_halaqah:h.nama_halaqah, id_guru, nama_guru:h.nama_guru,
        level:h.level||'Level 1', jadwal_hari:h.jadwal_hari||null,
        jam_mulai:h.jam_mulai||null, jam_selesai:h.jam_selesai||null, status:'aktif',
      });
      if (!error) { dibuat.push(h.nama_halaqah); existingSet.add(h.nama_halaqah.toLowerCase()); }
      else skipped.push(h.nama_halaqah + ' (error: ' + error.message + ')');
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
            // Guru: ambil kata-kata bermakna dari nama
            id_user = u.nama_lengkap.replace(/^(al-|al |ustadz|ustadzah)\s*/gi,'').split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g,'').substring(0,8);
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
      var id_halaqah = hqMap[(a.nama_halaqah||'').toLowerCase()];
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
  // Raport bulk — TODO: implementasi penuh
  generateRaportByHalaqah: async function(p) { return GuruAPI.generateRaportHalaqah ? GuruAPI.generateRaportHalaqah(p) : {status:'ok',data:[]}; },
  generateRaportByLevel: async function(p) { throw new Error('Generate raport per level belum diimplementasi.'); },
  generateRaportBulk: async function(p) { throw new Error('Generate raport bulk belum diimplementasi.'); },
  kirimRaportEmail: async function(id) { throw new Error('Kirim raport via email belum diimplementasi.'); },
  getObservasiStats: async function(p) { var {data,error}=await _sb.from('observasi_kbm').select('*').order('created_at',{ascending:false}); _check(error,'getObservasiStats'); return {status:'ok',data:data||[]}; },

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
};

// ─────────────────────────────────────────────
//  KETUA API
// ─────────────────────────────────────────────
var KetuaAPI = {
  getInfo: async function() {
    var id_murid = _uid();
    var { data: anggota } = await _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('is_ketua', true).maybeSingle();
    if (!anggota) return { status: 'error', message: 'Bukan ketua kelas' };
    return { status: 'ok', halaqah: anggota.halaqah, anggota };
  },

  getKeaktifanAnggota: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var id_halaqah = info.halaqah.id_halaqah;
    var [anggotaRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('id_murid, nama_murid, level').eq('id_halaqah', id_halaqah).eq('status', 'aktif'),
      _sb.from('nilai_kbm').select('id_murid, status_hadir, kamera_murid, tanggal').eq('id_halaqah', id_halaqah).order('tanggal', { ascending: false }),
    ]);
    if (anggotaRes.error) return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var ids = (anggotaRes.data || []).map(function(a) { return a.id_murid; });
    var hpMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, no_hp').in('id_user', ids);
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
      if (!map[r.id_murid]) map[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid, hadir: 0, total: 0, riwayat: [] };
      map[r.id_murid].total++;
      if (['H','T'].includes(r.status_hadir)) map[r.id_murid].hadir++;
      if (map[r.id_murid].riwayat.length < 8) map[r.id_murid].riwayat.push({ warna: ['H','T'].includes(r.status_hadir) ? 'hijau' : 'merah', tanggal: r.tanggal });
    });
    var alerts = Object.values(map).map(function(m) {
      var alpa = m.total - m.hadir;
      var status = alpa >= 2 ? 'kritis' : alpa === 1 ? 'peringatan' : 'normal';
      return { id_murid: m.id_murid, nama_murid: m.nama_murid, status: status, pct_hadir: m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0, absen: alpa, total_sesi: m.total, riwayat: m.riwayat };
    }).filter(function(m) { return m.status !== 'normal'; });
    return { status: 'ok', data: { alerts: alerts } };
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
    var { data, error } = await _sb.from('kbm_log').select('*').eq('id_kbm', id_kbm).single();
    if (error) return { status: 'ok', data: null };
    return { status: 'ok', data };
  },

  getRekapStatus: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('rekap_status').select('*')
      .eq('id_halaqah', info.halaqah.id_halaqah)
      .order('created_at', { ascending: false }).limit(10);
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
//  EXPORT
// ─────────────────────────────────────────────
window.HQ = {
  Auth, AdminAPI, GuruAPI, MuridAPI, KetuaAPI,
  SuperAdminAPI: AdminAPI,
  PushAPI, PushPrefsAPI,
  supabase: _sb,
  getCurrentUser: function() { return _currentUser; },
  cache: { invalidate: function() {} },
};
