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
    // Verifikasi password lama
    await Auth.login(_uid(), d.oldPassword || d.password_lama);
    var { error } = await _sb.auth.updateUser({ password: d.newPassword || d.password_baru });
    _check(error, 'changePassword');
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
      return Object.assign({}, a, {
        no_hp       : a.users && a.users.no_hp,
        email       : a.users && a.users.email,
        jumlah_hadir: hadir.length,
        total_sesi  : nm.length,
        pct_hadir   : nm.length > 0 ? Math.round(hadir.length / nm.length * 100) : 0,
        poin_adab   : adabData.length > 0 ? Math.round(adabData.filter(function(n){return n.adab==='Baik';}).length / adabData.length * 100) : 0,
        poin_kamera : kameraData.length > 0 ? Math.round(kameraData.filter(function(n){return n.kamera_murid==='kamera terbuka';}).length / kameraData.length * 100) : 0,
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

    // Hitung pertemuan_ke
    var { count } = await _sb.from('kbm_log').select('*', { count: 'exact', head: true })
      .eq('id_halaqah', d.id_halaqah).eq('status', 'selesai');

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru  : _uid(), nama_guru: _currentUser && _currentUser.nama,
      tanggal_pertemuan: d.tanggal_pertemuan,
      jam_mulai: d.jam_mulai, jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      pertemuan_ke: d.pertemuan_ke_custom || (count + 1),
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
      materi_belajar: d.pencapaian_modul, pencapaian_modul: d.pencapaian_modul,
      halaman_modul: d.halaman_modul, metode: d.metode, catatan_umum: d.catatan_umum,
      jam_selesai: d.jam_selesai, latihan_mandiri: d.latihan_mandiri,
      jenis_latihan: d.jenis_latihan, deadline_latihan: d.deadline_latihan,
    }).eq('id_kbm', d.id_kbm);
    _check(error, 'simpanJurnalKBM');
    return { status: 'ok', message: 'Jurnal KBM berhasil disimpan' };
  },

  tutupKBM: async function(id_kbm) {
    var { count } = await _sb.from('nilai_kbm').select('*', { count: 'exact', head: true }).eq('id_kbm', id_kbm);
    if (!count) {
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
    // Transform RPC result ke format yang diharapkan frontend
    var alerts = (raw.alerts || []).map(function(m) {
      return {
        id_murid    : m.id_murid,
        nama_murid  : m.nama,
        id_halaqah  : m.id_halaqah,
        nama_halaqah: m.nama_halaqah || '',
        level       : m.level || '',
        status      : m.status,
        riwayat     : [],
        metrics: {
          absen           : m.alpa || 0,
          terlambat       : m.terlambat || 0,
          kamera_tertutup : m.kamera_buruk || 0,
        },
      };
    });
    return { status: 'ok', data: { alerts: alerts, summary: raw.summary } };
  },

  simpanFollowupKeaktifan: async function(d) {
    // Simpan catatan follow-up ke anggota
    var { error } = await _sb.from('anggota')
      .update({ catatan_guru: d.catatan }).eq('id_murid', d.id_murid).eq('id_halaqah', d.id_halaqah);
    _check(error, 'simpanFollowupKeaktifan');
    return { status: 'ok' };
  },

  // ── Assessment ─────────────────────────────
  getAssessmentRekap: async function(id_halaqah) {
    // Assessment mandiri belum ada tabel khusus — return empty agar frontend tampil "belum ada data"
    return { status: 'ok', data: [], total_items: 0, level: '' };
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

  getAtTibyanSesi: async function() {
    var { data, error } = await _sb.from('at_tibyan_sesi')
      .select('*').order('tanggal', { ascending: false }).limit(30);
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
    var { data, error } = await _sb.from('at_tibyan_log')
      .select('id_murid, nama_murid, status_hadir, id_halaqah, nama_halaqah');
    _check(error, 'getAtTibyanRekap');
    return { status: 'ok', data };
  },

  getAtTibyanKeaktifan: async function() {
    var id_guru = _uid();
    var { data: hq } = await _sb.from('halaqah').select('id_halaqah').eq('id_guru', id_guru);
    var hqIds = (hq || []).map(function(h) { return h.id_halaqah; });
    var { data, error } = await _sb.from('at_tibyan_log')
      .select('id_murid, nama_murid, id_halaqah, status_hadir')
      .in('id_halaqah', hqIds);
    _check(error, 'getAtTibyanKeaktifan');
    // Hitung alpa per murid
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = { id_murid: r.id_murid, nama: r.nama_murid, alpa: 0, total: 0 };
      muridMap[r.id_murid].total++;
      if (r.status_hadir === 'A') muridMap[r.id_murid].alpa++;
    });
    var alerts = Object.values(muridMap).filter(function(m) { return m.alpa > 0; });
    return { status: 'ok', data: { alerts, summary: {} } };
  },

  simpanAtTibyan: async function(d) {
    var id_sesi = _genId('ATS');
    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    await _sb.from('at_tibyan_sesi').insert({
      id_sesi, tanggal: d.tanggal, id_guru: _uid(),
      nama_guru: _currentUser && _currentUser.nama,
      total_hadir: hadirCount, total_murid: d.presensi.length,
      status: 'selesai', pertemuan_ke: d.pertemuan_ke || 1,
    });
    var logRows = d.presensi.map(function(p) { return {
      id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, nama_halaqah: p.nama_halaqah,
      status_hadir: p.status_hadir, tanggal: d.tanggal,
    }; });
    await _sb.from('at_tibyan_log').insert(logRows);
    return { status: 'ok', message: 'Sesi At-Tibyan berhasil disimpan' };
  },

  editAtTibyan: async function(d) {
    await _sb.from('at_tibyan_log').delete().eq('id_sesi', d.id_sesi);
    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    await _sb.from('at_tibyan_sesi').update({ total_hadir: hadirCount }).eq('id_sesi', d.id_sesi);
    var logRows = d.presensi.map(function(p) { return {
      id_sesi: d.id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, status_hadir: p.status_hadir,
    }; });
    await _sb.from('at_tibyan_log').insert(logRows);
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
      detail    : r.detail_json ? (typeof r.detail_json === 'string' ? JSON.parse(r.detail_json) : r.detail_json) : [],
    }); }) };
  },

  generateRaportHalaqah: async function(d) {
    // Kalkulasi raport semua murid di halaqah
    var { data: anggota } = await _sb.from('anggota').select('id_murid, nama_murid').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    var { data: komponen } = await _sb.from('komponen_raport').select('*').eq('id_periode', d.id_periode).eq('status', 'aktif').order('urutan');
    var { data: nilaiManual } = await _sb.from('nilai_manual').select('*').eq('id_periode', d.id_periode);
    var { data: nilaiKBM } = await _sb.from('nilai_kbm').select('*').eq('id_halaqah', d.id_halaqah);
    var { data: atLog } = await _sb.from('at_tibyan_log').select('id_murid, status_hadir');
    var { count: totalAt } = await _sb.from('at_tibyan_sesi').select('*', { count: 'exact', head: true }).eq('status', 'selesai');
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
    var komponen = raport.detail_json ? (typeof raport.detail_json === 'string' ? JSON.parse(raport.detail_json) : raport.detail_json) : [];
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
    var { data: anggota } = await _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('status', 'aktif').single();
    var { data: user } = await _sb.from('users').select('*').eq('id_user', id_murid).single();
    var { count: totalHadir } = await _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid', id_murid).in('status_hadir',['H','T']);
    var { count: totalSesi } = await _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid', id_murid);
    var pctHadir = totalSesi > 0 ? Math.round((totalHadir||0)/(totalSesi||1)*100) : 0;
    return { status: 'ok', data: {
      anggota, profil: user,
      skor_hadir: ((totalHadir||0)/40*100).toFixed(1),
      pct_hadir: pctHadir,
      total_hadir: totalHadir || 0,
      total_sesi: totalSesi || 0,
      sisa_sesi: Math.max(0, 40 - (totalSesi||0)),
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
      tanggal: n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
      pertemuan_ke: n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
      materi_belajar: n.kbm_log && n.kbm_log.materi_belajar,
      latihan_mandiri: n.kbm_log && n.kbm_log.latihan_mandiri,
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
    return { status: 'ok', data: (data||[]).filter(function(n){ return n.kbm_log && n.kbm_log.latihan_mandiri; }) };
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
      komponen    : r.detail_json ? (typeof r.detail_json==='string'?JSON.parse(r.detail_json):r.detail_json) : [],
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
    var { data, error } = await _sb.from('spp_pembayaran')
      .select('*').eq('id_murid', id_murid).order('tahun',{ascending:false});
    _check(error, 'getSPPStatus');
    var lunas = (data||[]).filter(function(s){return s.status==='lunas';}).map(function(s){return s.bulan;});
    var hasPaid = lunas.length > 0;
    return { status: 'ok', data: {
      has_paid: hasPaid, lunas, belum_lunas: hasPaid ? [] : ['Bulan 1','Bulan 2','Bulan 3','Bulan 4','Bulan 5'],
      pesan: hasPaid ? 'Jazakumullahu khairan, seluruh SPP telah lunas.' : 'Ada 5 bulan amanah yang belum ditunaikan.',
      periode: lunas,
    }};
  },

  getProgressGrafik: async function() { return { status: 'ok', data: [] }; },
  getMateriLevel: async function() { return { status: 'ok', data: [] }; },
  getAtTibyan: async function() { return { status: 'ok', data: [] }; },
  getAtTibyanMurid: async function() {
    var { data } = await _sb.from('at_tibyan_log').select('*').eq('id_murid', _uid()).order('tanggal',{ascending:false});
    return { status: 'ok', data };
  },
  getKonfigurasiRaport: async function() {
    var { data } = await _sb.from('konfigurasi_raport').select('*');
    var cfg = {}; (data||[]).forEach(function(r){cfg[r.key]=r.value;});
    return { status: 'ok', data: cfg };
  },
  getKeaktifanAlerts: async function() { return { status: 'ok', data: { alerts: [] } }; },
  getAssessmentItems: async function() { return { status: 'ok', data: {} }; },
  getAssessmentMurid: async function() { return { status: 'ok', data: {} }; },
  saveAssessment: async function() { return { status: 'ok' }; },
  changePassword: async function(d) { return Auth.changePassword(d); },
  updateProfil: async function(d) {
    var { error } = await _sb.from('users').update({ no_hp: d.no_hp, email: d.email }).eq('id_user', _uid());
    _check(error, 'updateProfil');
    return { status: 'ok' };
  },
};

// ─────────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────────
var AdminAPI = {
  getDashboard: async function() {
    var [usersRes, halaqahRes, kbmRes] = await Promise.all([
      _sb.from('users').select('role').eq('status','aktif'),
      _sb.from('halaqah').select('id_halaqah',{count:'exact',head:true}).eq('status','aktif'),
      _sb.from('kbm_log').select('id_kbm',{count:'exact',head:true}).eq('status','selesai')
        .gte('tanggal_pertemuan', new Date().toISOString().slice(0,7)+'-01'),
    ]);
    var roles = {}; (usersRes.data||[]).forEach(function(u){roles[u.role]=(roles[u.role]||0)+1;});
    return { status:'ok', data:{ total_murid:roles.murid||0, total_guru:roles.guru||0, total_halaqah:halaqahRes.count||0, kbm_bulan_ini:kbmRes.count||0 }};
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
  removeAnggota: async function(d) { var {error}=await _sb.from('anggota').update({status:'nonaktif'}).eq('id_anggota',d.id_anggota); _check(error,'removeAnggota'); return {status:'ok'}; },
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
  exportRekapAbsensi: async function(p) { return {status:'ok',message:'Export via Supabase Storage belum diimplementasi'}; },
  arsipData: async function() { return {status:'ok',message:'Arsip data belum diimplementasi'}; },
  getArsipList: async function() { return {status:'ok',data:[]}; },
};

// ─────────────────────────────────────────────
//  KETUA API
// ─────────────────────────────────────────────
var KetuaAPI = {
  getInfo: async function() {
    var id_murid = _uid();
    var { data: anggota } = await _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('is_ketua', true).single();
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
    var pending = (kbmRes.data || []).filter(function(k) { return !sudahObsIds.has(k.id_kbm); });
    return { status: 'ok', data: pending };
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
    return { status: 'ok', data: data || [] };
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
//  EXPORT
// ─────────────────────────────────────────────
window.HQ = {
  Auth, AdminAPI, GuruAPI, MuridAPI, KetuaAPI,
  SuperAdminAPI: AdminAPI,
  supabase: _sb,
  getCurrentUser: function() { return _currentUser; },
  cache: { invalidate: function() {} },
};
