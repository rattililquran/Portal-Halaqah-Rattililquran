// ============================================================
//  supabase-client.js
//  Rattililqur'an Portal — Supabase Client
//
//  Menggantikan api.js (GAS HTTP calls)
//  Dipakai di ketiga portal: admin, guru, murid
//
//  CARA PAKAI:
//  1. Ganti <script src="../assets/js/api.js"> dengan file ini
//  2. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di bawah
//  3. Semua fungsi window.HQ.* tetap tersedia dengan API sama
// ============================================================

// ─────────────────────────────────────────────
//  KONFIGURASI — ISI SETELAH PROJECT SUPABASE DIBUAT
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://zefriybfrirrtsulogta.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZnJpeWJmcmlycnRzdWxvZ3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTk1MzIsImV4cCI6MjA5NTkzNTUzMn0.AmB43YG-fCYqATdh5BrfLJmGITI_UeX8csOYyjd9i_U';

// ─────────────────────────────────────────────
//  INISIALISASI SUPABASE CLIENT
// ─────────────────────────────────────────────
// Load Supabase JS dari CDN (atau bundler)
// Tambahkan di HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─────────────────────────────────────────────
//  SESSION MANAGEMENT
// ─────────────────────────────────────────────
let _currentUser = null;   // { id_user, nama, role }
let _session     = null;   // Supabase session

async function _getSession() {
  const { data: { session } } = await _sb.auth.getSession();
  _session = session;
  if (session) {
    const stored = JSON.parse(localStorage.getItem('hq_user') || 'null');
    _currentUser = stored;
  }
  return session;
}

// Auto-refresh session
_sb.auth.onAuthStateChange((event, session) => {
  _session = session;
  if (event === 'SIGNED_OUT') {
    _currentUser = null;
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_user');
  }
});

// ─────────────────────────────────────────────
//  HELPER: throw jika error
// ─────────────────────────────────────────────
function _check(error, context) {
  if (error) {
    console.error(`[Supabase] ${context}:`, error);
    throw new Error(error.message || context);
  }
}

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────
var Auth = {
  login: async function(id_user, password) {
    // Panggil Edge Function login
    const res = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ id_user: id_user.trim().toUpperCase(), password }),
    });
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);

    // Simpan session
    await _sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    _currentUser = data.user;
    localStorage.setItem('hq_user', JSON.stringify(data.user));
    localStorage.setItem('hq_token', data.access_token);
    return data;
  },

  logout: async function() {
    await _sb.auth.signOut();
    localStorage.removeItem('hq_user');
    localStorage.removeItem('hq_token');
    _currentUser = null;
    window.location.href = '../index.html';
  },

  getProfile: async function() {
    return _currentUser;
  },

  changePassword: async function(oldPassword, newPassword) {
    // Verifikasi password lama dulu via login
    if (!_currentUser) throw new Error('Belum login');
    await Auth.login(_currentUser.id_user, oldPassword); // throws jika salah
    const { error } = await _sb.auth.updateUser({ password: newPassword });
    _check(error, 'changePassword');
    return { status: 'ok', message: 'Password berhasil diubah' };
  },
};

// ─────────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────────
var AdminAPI = {
  // ── Dashboard ──
  getDashboard: async function() {
    const [usersRes, halaqahRes, kbmRes] = await Promise.all([
      _sb.from('users').select('role', { count: 'exact' }).eq('status', 'aktif'),
      _sb.from('halaqah').select('id_halaqah', { count: 'exact' }).eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_kbm', { count: 'exact' })
        .eq('status', 'selesai')
        .gte('tanggal_pertemuan', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)),
    ]);
    return {
      status: 'ok',
      data: {
        total_murid:   (usersRes.data || []).filter(u => u.role === 'murid').length,
        total_guru:    (usersRes.data || []).filter(u => u.role === 'guru').length,
        total_halaqah: halaqahRes.count || 0,
        kbm_bulan_ini: kbmRes.count || 0,
      }
    };
  },

  // ── Users ──
  getAllUsers: async function(params) {
    let q = _sb.from('users').select('*').order('nama_lengkap');
    if (params?.role) q = q.eq('role', params.role);
    const { data, error } = await q;
    _check(error, 'getAllUsers');
    return { status: 'ok', data };
  },

  createUser: async function(userData) {
    // Hash password via Edge Function
    const { data, error } = await _sb.from('users').insert({
      ...userData,
      password_hash: userData.password, // Edge Function yang hash
    }).select().single();
    _check(error, 'createUser');
    return { status: 'ok', data };
  },

  updateUser: async function(userData) {
    const { id_user, ...updates } = userData;
    const { data, error } = await _sb.from('users').update(updates).eq('id_user', id_user).select().single();
    _check(error, 'updateUser');
    return { status: 'ok', data };
  },

  deleteUser: async function(id_user) {
    const { error } = await _sb.from('users').update({ status: 'nonaktif' }).eq('id_user', id_user);
    _check(error, 'deleteUser');
    return { status: 'ok', message: 'User dinonaktifkan' };
  },

  // ── Halaqah ──
  getAllHalaqah: async function() {
    const { data, error } = await _sb.from('halaqah').select('*').order('nama_halaqah');
    _check(error, 'getAllHalaqah');
    return { status: 'ok', data };
  },

  createHalaqah: async function(d) {
    const { data, error } = await _sb.from('halaqah').insert(d).select().single();
    _check(error, 'createHalaqah');
    return { status: 'ok', data };
  },

  updateHalaqah: async function(d) {
    const { id_halaqah, ...updates } = d;
    const { data, error } = await _sb.from('halaqah').update(updates).eq('id_halaqah', id_halaqah).select().single();
    _check(error, 'updateHalaqah');
    return { status: 'ok', data };
  },

  // ── Anggota ──
  getAllAnggota: async function(id_halaqah) {
    let q = _sb.from('anggota').select('*, users(nama_lengkap, no_hp, email)');
    if (id_halaqah) q = q.eq('id_halaqah', id_halaqah);
    const { data, error } = await q.order('nama_murid');
    _check(error, 'getAllAnggota');
    return { status: 'ok', data };
  },

  addAnggota: async function(d) {
    const { data, error } = await _sb.from('anggota').insert(d).select().single();
    _check(error, 'addAnggota');
    return { status: 'ok', data };
  },

  removeAnggota: async function(d) {
    const { error } = await _sb.from('anggota').update({ status: 'nonaktif' }).eq('id_anggota', d.id_anggota);
    _check(error, 'removeAnggota');
    return { status: 'ok' };
  },

  // ── Periode ──
  getAllPeriode: async function() {
    const { data, error } = await _sb.from('periode').select('*').order('created_at', { ascending: false });
    _check(error, 'getAllPeriode');
    return { status: 'ok', data };
  },

  createPeriode: async function(d) {
    const { data, error } = await _sb.from('periode').insert(d).select().single();
    _check(error, 'createPeriode');
    return { status: 'ok', data };
  },

  // ── Komponen Raport ──
  getKomponenRaport: async function(id_periode) {
    const { data, error } = await _sb.from('komponen_raport')
      .select('*').eq('id_periode', id_periode).eq('status', 'aktif').order('urutan');
    _check(error, 'getKomponenRaport');
    return { status: 'ok', data };
  },

  saveKomponenRaport: async function(d) {
    // Nonaktifkan yang lama, insert yang baru
    await _sb.from('komponen_raport').update({ status: 'nonaktif' }).eq('id_periode', d.id_periode);
    const { data, error } = await _sb.from('komponen_raport').insert(d.komponen).select();
    _check(error, 'saveKomponenRaport');
    return { status: 'ok', data };
  },

  // ── Nilai Manual ──
  getNilaiManual: async function(id_periode) {
    const { data, error } = await _sb.from('nilai_manual').select('*').eq('id_periode', id_periode);
    _check(error, 'getNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManual: async function(d) {
    const { data, error } = await _sb.from('nilai_manual')
      .upsert(d, { onConflict: 'id_murid,id_periode,id_komponen' }).select().single();
    _check(error, 'saveNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManualBatch: async function(d) {
    const rows = d.nilai_list.map(n => ({ ...n, id_periode: d.id_periode, id_halaqah: d.id_halaqah }));
    const { data, error } = await _sb.from('nilai_manual')
      .upsert(rows, { onConflict: 'id_murid,id_periode,id_komponen' }).select();
    _check(error, 'saveNilaiManualBatch');
    return { status: 'ok', data };
  },

  // ── Raport ──
  getRaportList: async function(params) {
    let q = _sb.from('raport').select('*, users(nama_lengkap), halaqah(nama_halaqah)');
    if (params?.id_periode) q = q.eq('id_periode', params.id_periode);
    const { data, error } = await q.order('created_at', { ascending: false });
    _check(error, 'getRaportList');
    return { status: 'ok', data };
  },

  publishRaport: async function(d) {
    const { error } = await _sb.from('raport').update({
      status: 'published',
      published_by: _currentUser?.id_user,
      published_at: new Date().toISOString(),
    }).eq('id_raport', d.id_raport);
    _check(error, 'publishRaport');
    return { status: 'ok', message: 'Raport dipublikasikan' };
  },

  // ── Laporan Global ──
  getLaporanGlobal: async function(params) {
    const { data, error } = await _sb.from('halaqah')
      .select('*, kbm_log(count), anggota(count)')
      .eq('status', 'aktif');
    _check(error, 'getLaporanGlobal');
    return { status: 'ok', data };
  },

  // ── Rekap Absensi ──
  getRekapAbsensi: async function(params) {
    const { data, error } = await _sb.from('nilai_kbm')
      .select('*, users(nama_lengkap), kbm_log(tanggal_pertemuan, pertemuan_ke)')
      .eq('id_halaqah', params.id_halaqah)
      .order('tanggal', { ascending: true });
    _check(error, 'getRekapAbsensi');
    return { status: 'ok', data };
  },

  // ── Pengumuman ──
  getAllPengumuman: async function() {
    const { data, error } = await _sb.from('pengumuman').select('*').order('tanggal', { ascending: false });
    _check(error, 'getAllPengumuman');
    return { status: 'ok', data };
  },

  buatPengumuman: async function(d) {
    const { data, error } = await _sb.from('pengumuman').insert({
      ...d,
      dibuat_oleh: _currentUser?.id_user,
      nama_pembuat: _currentUser?.nama,
    }).select().single();
    _check(error, 'buatPengumuman');
    return { status: 'ok', data };
  },

  // ── Konfigurasi Raport ──
  getKonfigurasi: async function() {
    const { data, error } = await _sb.from('konfigurasi_raport').select('*');
    _check(error, 'getKonfigurasi');
    const config = {};
    (data || []).forEach(r => { config[r.key] = r.value; });
    return { status: 'ok', data: config };
  },
};

// ─────────────────────────────────────────────
//  GURU API
// ─────────────────────────────────────────────
var GuruAPI = {
  getDashboard: async function() {
    const id_guru = _currentUser?.id_user;
    const { data: halaqah } = await _sb.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif');
    return { status: 'ok', data: { halaqah: halaqah || [], total_halaqah: (halaqah||[]).length } };
  },

  getHalaqahSaya: async function() {
    const { data, error } = await _sb.from('halaqah')
      .select('*, anggota(count)')
      .eq('id_guru', _currentUser?.id_user)
      .eq('status', 'aktif');
    _check(error, 'getHalaqahSaya');
    return { status: 'ok', data };
  },

  getMurid: async function(id_halaqah) {
    const { data, error } = await _sb.from('anggota')
      .select('*, users(nama_lengkap, no_hp)')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif')
      .order('nama_murid');
    _check(error, 'getMurid');
    return { status: 'ok', data };
  },

  // ── KBM ──
  bukaKBM: async function(d) {
    // Hitung pertemuan_ke dari sesi yang sudah selesai
    const { count } = await _sb.from('kbm_log')
      .select('*', { count: 'exact' })
      .eq('id_halaqah', d.id_halaqah)
      .eq('status', 'selesai');

    const id_kbm = 'KBM-' + Date.now();
    const { data, error } = await _sb.from('kbm_log').insert({
      id_kbm,
      id_halaqah: d.id_halaqah,
      id_guru: _currentUser?.id_user,
      nama_guru: _currentUser?.nama,
      tanggal_pertemuan: d.tanggal_pertemuan,
      jam_mulai: d.jam_mulai,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      pertemuan_ke: d.pertemuan_ke_custom || (count + 1),
      status: 'draft',
    }).select().single();
    _check(error, 'bukaKBM');
    return { status: 'ok', data };
  },

  simpanPresensi: async function(d) {
    // Upsert nilai_kbm per murid — SATU sumber kebenaran, tidak ada sheet per-kelas
    const rows = d.presensi.map(p => ({
      id_kbm: d.id_kbm,
      id_halaqah: d.id_halaqah,
      id_murid: p.id_murid,
      status_hadir: p.status_hadir,
      pertemuan_ke: p.pertemuan_ke,
      tanggal: d.tanggal,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
    }));

    const { error } = await _sb.from('nilai_kbm')
      .upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanPresensi');

    // Update jumlah_hadir di kbm_log
    const hadir = d.presensi.filter(p => ['H','T'].includes(p.status_hadir)).length;
    await _sb.from('kbm_log').update({ jumlah_hadir: hadir }).eq('id_kbm', d.id_kbm);

    return { status: 'ok', message: 'Presensi disimpan', jumlah_hadir: hadir };
  },

  simpanNilaiMuridBatch: async function(d) {
    // Update adab, kamera, koreksi per murid
    const updates = d.nilai.map(n => ({
      id_kbm: d.id_kbm,
      id_murid: n.id_murid,
      adab: n.adab,
      kamera_murid: n.kamera_murid,
      koreksi_tahsin: n.koreksi_tahsin,
      catatan_murid: n.catatan_murid,
    }));

    const { error } = await _sb.from('nilai_kbm')
      .upsert(updates, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanNilaiMuridBatch');
    return { status: 'ok' };
  },

  simpanJurnalKBM: async function(d) {
    const { error } = await _sb.from('kbm_log').update({
      materi_belajar: d.pencapaian_modul,
      pencapaian_modul: d.pencapaian_modul,
      halaman_modul: d.halaman_modul,
      metode: d.metode,
      catatan_umum: d.catatan_umum,
      jam_selesai: d.jam_selesai,
      latihan_mandiri: d.latihan_mandiri,
      jenis_latihan: d.jenis_latihan,
      deadline_latihan: d.deadline_latihan,
    }).eq('id_kbm', d.id_kbm);
    _check(error, 'simpanJurnalKBM');
    return { status: 'ok' };
  },

  tutupKBM: async function(id_kbm) {
    // Cek ada presensi — single source of truth = nilai_kbm
    const { count } = await _sb.from('nilai_kbm').select('*', { count: 'exact' }).eq('id_kbm', id_kbm);
    if (!count) {
      // Hapus sesi kosong
      await _sb.from('kbm_log').delete().eq('id_kbm', id_kbm);
      return { status: 'empty_cancelled', message: 'Sesi dibatalkan karena tidak ada presensi' };
    }

    const { error } = await _sb.from('kbm_log').update({ status: 'selesai' }).eq('id_kbm', id_kbm);
    _check(error, 'tutupKBM');
    return { status: 'ok', message: 'Sesi KBM berhasil ditutup' };
  },

  hapusKBM: async function(id_kbm) {
    await _sb.from('nilai_kbm').delete().eq('id_kbm', id_kbm);
    await _sb.from('kbm_log').delete().eq('id_kbm', id_kbm);
    return { status: 'ok' };
  },

  getKBMByHalaqah: async function(id_halaqah, limit, offset) {
    const { data, error } = await _sb.from('kbm_log')
      .select('*')
      .eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 10) - 1);
    _check(error, 'getKBMByHalaqah');
    return { status: 'ok', data };
  },

  getNilaiByKBM: async function(id_kbm) {
    const { data, error } = await _sb.from('nilai_kbm').select('*').eq('id_kbm', id_kbm);
    _check(error, 'getNilaiByKBM');
    return { status: 'ok', data };
  },

  // ── Raport ──
  getAllPeriode: async function() {
    const { data, error } = await _sb.from('periode').select('*').order('created_at', { ascending: false });
    _check(error, 'getAllPeriode');
    return { status: 'ok', data };
  },

  getKomponenRaport: async function(id_periode) {
    return AdminAPI.getKomponenRaport(id_periode);
  },

  getNilaiManual: async function(id_periode) {
    return AdminAPI.getNilaiManual(id_periode);
  },

  saveNilaiManualBatch: async function(d) {
    return AdminAPI.saveNilaiManualBatch(d);
  },

  // ── Pengumuman ──
  kirimPengumuman: async function(d) {
    return AdminAPI.buatPengumuman(d);
  },

  // ── Keaktifan ──
  getKeaktifanAlerts: async function() {
    // Ambil murid dengan alpa >= 2 dalam 40 sesi terakhir per halaqah guru
    const id_guru = _currentUser?.id_user;
    const { data, error } = await _sb.rpc('get_keaktifan_alerts', { p_id_guru: id_guru });
    _check(error, 'getKeaktifanAlerts');
    return { status: 'ok', data: data || { alerts: [], summary: {} } };
  },
};

// ─────────────────────────────────────────────
//  MURID API
// ─────────────────────────────────────────────
var MuridAPI = {
  getDashboard: async function() {
    const id_murid = _currentUser?.id_user;
    const { data: anggota } = await _sb.from('anggota')
      .select('*, halaqah(*)')
      .eq('id_murid', id_murid)
      .eq('status', 'aktif')
      .single();
    return { status: 'ok', data: { anggota } };
  },

  getRiwayat: async function(limit, offset) {
    const id_murid = _currentUser?.id_user;
    const { data, error, count } = await _sb.from('nilai_kbm')
      .select('*, kbm_log(tanggal_pertemuan, pertemuan_ke, materi_belajar, jenis_sesi)', { count: 'exact' })
      .eq('id_murid', id_murid)
      .order('tanggal', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 8) - 1);
    _check(error, 'getRiwayat');
    return { status: 'ok', data, total: count, has_more: (offset||0) + (limit||8) < count };
  },

  getRaport: async function() {
    const id_murid = _currentUser?.id_user;
    const { data, error } = await _sb.from('raport')
      .select('*, periode(nama_periode), halaqah(nama_halaqah, nama_guru)')
      .eq('id_murid', id_murid)
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    _check(error, 'getRaport');
    return { status: 'ok', data };
  },

  getPengumuman: async function() {
    const id_murid = _currentUser?.id_user;
    // Ambil halaqah murid untuk filter pengumuman
    const { data: anggota } = await _sb.from('anggota')
      .select('id_halaqah').eq('id_murid', id_murid).eq('status', 'aktif').single();
    const id_halaqah = anggota?.id_halaqah;

    const { data, error } = await _sb.from('pengumuman')
      .select('*')
      .eq('status', 'aktif')
      .or(`target.in.(semua,all),id_halaqah.eq.${id_halaqah}`)
      .order('tanggal', { ascending: false })
      .limit(15);
    _check(error, 'getPengumuman');
    return { status: 'ok', data };
  },

  getSPPStatus: async function() {
    const id_murid = _currentUser?.id_user;
    const { data, error } = await _sb.from('spp_pembayaran')
      .select('*')
      .eq('id_murid', id_murid)
      .order('tahun', { ascending: false });
    _check(error, 'getSPPStatus');
    return { status: 'ok', data };
  },

  changePassword: async function(d) {
    return Auth.changePassword(d.password_lama, d.password_baru);
  },
};

// ─────────────────────────────────────────────
//  EXPORT — window.HQ (sama persis dengan api.js lama)
// ─────────────────────────────────────────────
window.HQ = {
  Auth,
  AdminAPI,
  GuruAPI,
  MuridAPI,
  supabase: _sb,    // akses langsung jika perlu query custom
  getCurrentUser: () => _currentUser,
};
