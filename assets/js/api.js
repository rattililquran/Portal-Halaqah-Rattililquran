// ============================================================
//  js/api.js — API Client untuk Google Apps Script
//  Portal Halaqah Rattililqur'an
//  Versi: 1.0.0
//  Deskripsi: Semua komunikasi frontend ↔ GAS Web App
//             melalui file ini. Ganti BASE_URL setelah deploy.
// ============================================================

// ─── GANTI INI SETELAH DEPLOY GAS ───
const BASE_URL = 'https://script.google.com/macros/s/AKfycbxx3dy_yOdyuNi51YZD_acDOHYPP5casOuzPqn0vwZarcOrmlhjf7nf9qy0An04tOBb_A/exec';

// ─── Helper ambil token dari storage ───
function getToken() {
  return localStorage.getItem('hq_token') || sessionStorage.getItem('hq_token') || '';
}

// ─── GET request ───
async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, token: getToken(), ...params });
  const res   = await fetch(`${BASE_URL}?${query}`, {
    method: 'GET',
    mode:   'cors',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

// ─── POST request — pakai GET untuk hindari CORS preflight 405 ───
async function apiPost(action, body = {}) {
  // Encode data sebagai JSON dalam query param untuk hindari preflight
  const query = new URLSearchParams({
    action,
    token: getToken(),
    payload: JSON.stringify(body),
  });
  const res = await fetch(`${BASE_URL}?${query}`, {
    method: 'GET',
    mode:   'cors',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

// ════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════
const Auth = {
  login: (nis, role, password) => apiGet('login', { nis, role, password: password||'' }),
  getProfile: ()            => apiGet('getProfile'),
  logout: () => {
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_user');
    sessionStorage.removeItem('hq_token');
    sessionStorage.removeItem('hq_user');
    // Deteksi apakah di subfolder atau root
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    window.location.href = depth >= 2 ? '../index.html' : 'index.html';
  },
  getUser: () => {
    return JSON.parse(localStorage.getItem('hq_user') || sessionStorage.getItem('hq_user') || 'null');
  },
  isLoggedIn: () => !!getToken(),
  requireRole: (roles) => {
    const user = Auth.getUser();
    if (!user || !roles.includes(user.role)) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },
};

// ════════════════════════════════════════════════
//  ADMIN API
// ════════════════════════════════════════════════
const AdminAPI = {
  // Dashboard
  getDashboard:        ()           => apiGet('getDashboardAdmin'),

  // Periode
  getAllPeriode:        ()           => apiGet('getAllPeriode'),
  createPeriode:       (data)       => apiPost('createPeriode', data),
  updatePeriode:       (data)       => apiPost('updatePeriode', data),

  // Users
  getAllUsers:          (role)       => apiGet('getAllUsers', role ? { role } : {}),
  createUser:          (data)       => apiPost('createUser', data),
  updateUser:          (data)       => apiPost('updateUser', data),
  deleteUser:          (id_user)    => apiPost('deleteUser', { id_user }),
  bulkImportBatch1:    (data)       => apiPost('bulkImportBatch1', data),
  bulkImportBatch2:    (data)       => apiPost('bulkImportBatch2', data),
  bulkImportSummary:   (data)       => apiPost('bulkImportSummary', data),

  // Halaqah
  getAllHalaqah:        ()           => apiGet('getAllHalaqah'),
  createHalaqah:       (data)       => apiPost('createHalaqah', data),
  updateHalaqah:       (data)       => apiPost('updateHalaqah', data),
  deleteHalaqah:       (id_halaqah) => apiPost('deleteHalaqah', { id_halaqah }),

  // Anggota
  getAllAnggota:        (id_halaqah) => apiGet('getAllAnggota', id_halaqah ? { id_halaqah } : {}),
  addAnggota:          (data)       => apiPost('addAnggota', data),
  updateAnggota:       (data)       => apiPost('updateAnggota', data),
  removeAnggota:       (id_anggota) => apiPost('removeAnggota', { id_anggota }),

  // Laporan
  getAllKBM:            (params)     => apiGet('getAllKBM', params || {}),
  getRekapAbsensi:     (params)     => apiGet('getRekapAbsensi', params || {}),
  getLaporanGlobal:    (params)     => apiGet('getLaporanGlobal', params || {}),
  getAuditLog:         ()           => apiGet('getAuditLog'),

  // Komponen & Nilai Raport
  getKomponenRaport:   (id_periode) => apiGet('getKomponenRaport', { id_periode }),
  saveKomponenRaport:  (data)       => apiPost('saveKomponenRaport', data),
  getNilaiManual:      (id_periode) => apiGet('getNilaiManual', { id_periode }),
  saveNilaiManual:     (data)       => apiPost('saveNilaiManual', data),

  // Raport
  generateRaport:      (data)       => apiPost('generateRaportMurid', data),
  generateRaportBulk:  (data)       => apiPost('generateRaportBulk', data),
  getRaportList:       (id_periode) => apiGet('getRaportList', { id_periode }),
  publishRaport:       (id_raport)  => apiPost('publishRaport', { id_raport }),
  kirimRaportEmail:    (id_raport)  => apiPost('kirimRaportEmail', { id_raport }),

  // Pengumuman
  buatPengumuman:      (data)       => apiPost('buatPengumuman', data),
  getAllPengumuman:     ()           => apiGet('getAllPengumuman'),
};

// ════════════════════════════════════════════════
//  GURU API
// ════════════════════════════════════════════════
const GuruAPI = {
  getDashboard:       ()                   => apiGet('getDashboardGuru'),
  getHalaqahSaya:     ()                   => apiGet('getHalaqahGuru'),
  getMurid:           (id_halaqah)         => apiGet('getMuridByHalaqah', { id_halaqah }),
  getRiwayatKBM:      (id_halaqah, limit)  => apiGet('getKBMByHalaqah', { id_halaqah, limit: limit || 20 }),
  getNilaiByKBM:      (id_kbm)             => apiGet('getNilaiByKBM', { id_kbm }),
  getPresensiByKBM:   (id_kbm)             => apiGet('getPresensiByKBM', { id_kbm }),

  bukaKBM:            (data)               => apiPost('bukaKBM', data),
  simpanPresensi:     (data)               => apiPost('simpanPresensi', data),
  editPresensi:       (data)               => apiPost('editPresensi', data),
  simpanJurnalKBM:    (data)               => apiPost('simpanJurnalKBM', data),
  simpanNilaiMurid:   (data)               => apiPost('simpanNilaiMurid', data),
  tutupKBM:           (id_kbm)             => apiPost('tutupKBM', { id_kbm }),
  updateCatatanMurid: (data)               => apiPost('updateCatatanMurid', data),
  addMuridByGuru:     (data)               => apiPost('addMuridByGuru', data),
  kirimPengumuman:    (data)               => apiPost('kirimPengumumanGuru', data),
  getMuridBelum:      (id_halaqah)         => apiGet('getMuridBelumDiHalaqah', { id_halaqah }),
  generateRekapPresensi: (id_halaqah)      => apiGet('generateRekapPresensi', { id_halaqah }),
  generateRekapNilai:    (id_halaqah)      => apiGet('generateRekapNilai', { id_halaqah }),
};

// ════════════════════════════════════════════════
//  MURID API
// ════════════════════════════════════════════════
const MuridAPI = {
  getDashboard:       ()     => apiGet('getDashboardMurid'),
  getRiwayat:         ()     => apiGet('getRiwayatMurid'),
  getLatihanMandiri:  ()     => apiGet('getLatihanMandiriMurid'),
  getRaport:          ()     => apiGet('getRaportMurid'),
  getPengumuman:      ()     => apiGet('getPengumumanMurid'),
  updateProfil:       (data) => apiPost('updateProfilMurid', data),
};

// ════════════════════════════════════════════════
//  SHARED UTILS
// ════════════════════════════════════════════════
const Utils = {
  formatDate: (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  },
  formatTime: (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  },
  nilaiColor: (nilai) => {
    const map = { A:'#1D9E75', B:'#2a8de0', C:'#e0aa2a', D:'#e05a2a' };
    return map[String(nilai).toUpperCase()] || '#888';
  },
  statusHadirLabel: (kode) => {
    const map = { H:'Hadir', I:'Izin', S:'Sakit', A:'Alpa' };
    return map[String(kode).toUpperCase()] || '-';
  },
  statusHadirColor: (kode) => {
    const map = { H:'#1D9E75', I:'#e0aa2a', S:'#2a8de0', A:'#e05a2a' };
    return map[String(kode).toUpperCase()] || '#888';
  },
};

// Ekspos global (untuk halaman tanpa module bundler)
window.HQ = { Auth, AdminAPI, GuruAPI, MuridAPI, Utils };
