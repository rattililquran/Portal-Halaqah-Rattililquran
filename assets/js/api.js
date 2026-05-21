// ============================================================
//  js/api.js — API Client untuk Google Apps Script
//  Portal Halaqah Rattililqur'an
//  Versi: 1.0.0
//  Deskripsi: Semua komunikasi frontend ↔ GAS Web App
//             melalui file ini. Ganti BASE_URL setelah deploy.
// ============================================================

// ─── GANTI INI SETELAH DEPLOY GAS ───
const BASE_URL = 'https://script.google.com/macros/s/AKfycbxHViZteE33bJNzisZnU4RV1uyMi-vkUPX6JwjQNGCe_5gOrzP9WimC8VvMKqcrAtAC/exec';

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

// ─── POST request ───
async function apiPost(action, body = {}) {
  const res = await fetch(BASE_URL, {
    method:  'POST',
    mode:    'cors',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, token: getToken(), data: body }),
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
  login: (nis, role)        => apiGet('login', { nis, role }),
  getProfile: ()            => apiGet('getProfile'),
  logout: () => {
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_user');
    sessionStorage.removeItem('hq_token');
    sessionStorage.removeItem('hq_user');
    window.location.href = '/index.html';
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
  getDashboard:    ()          => apiGet('getDashboardAdmin'),

  // Users
  getAllUsers:     (role)      => apiGet('getAllUsers', role ? { role } : {}),
  createUser:     (data)      => apiPost('createUser', data),
  updateUser:     (data)      => apiPost('updateUser', data),
  deleteUser:     (id_user)   => apiPost('deleteUser', { id_user }),

  // Halaqah
  getAllHalaqah:   ()          => apiGet('getAllHalaqah'),
  createHalaqah:  (data)      => apiPost('createHalaqah', data),
  updateHalaqah:  (data)      => apiPost('updateHalaqah', data),
  deleteHalaqah:  (id_halaqah)=> apiPost('deleteHalaqah', { id_halaqah }),

  // Anggota
  addAnggota:     (data)      => apiPost('addAnggota', data),
  removeAnggota:  (id_anggota)=> apiPost('removeAnggota', { id_anggota }),

  // Laporan
  getAllKBM:       (params)    => apiGet('getAllKBM', params || {}),
  getRekapAbsensi:(params)    => apiGet('getRekapAbsensi', params || {}),
  getLaporanGlobal:()         => apiGet('getLaporanGlobal'),
  getAuditLog:    ()          => apiGet('getAuditLog'),

  // Pengumuman
  buatPengumuman: (data)      => apiPost('buatPengumuman', data),
};

// ════════════════════════════════════════════════
//  GURU API
// ════════════════════════════════════════════════
const GuruAPI = {
  getDashboard:       ()            => apiGet('getDashboardGuru'),
  getHalaqahSaya:     ()            => apiGet('getHalaqahGuru'),
  getMurid:           (id_halaqah)  => apiGet('getMuridByHalaqah', { id_halaqah }),
  getRiwayatKBM:      (id_halaqah, limit) => apiGet('getKBMByHalaqah', { id_halaqah, limit: limit || 20 }),
  getHafalanByKBM:    (id_kbm)      => apiGet('getHafalanByKBM', { id_kbm }),

  bukaKBM:            (data)        => apiPost('bukaKBM', data),
  tutupKBM:           (id_kbm)      => apiPost('tutupKBM', { id_kbm }),
  simpanAbsensi:      (data)        => apiPost('simpanAbsensi', data),
  simpanHafalan:      (data)        => apiPost('simpanHafalan', data),
  updateCatatanMurid: (data)        => apiPost('updateCatatanMurid', data),
};

// ════════════════════════════════════════════════
//  MURID API
// ════════════════════════════════════════════════
const MuridAPI = {
  getDashboard:       ()            => apiGet('getDashboardMurid'),
  getProgressHafalan: (params)      => apiGet('getProgressHafalan', params || {}),
  getAbsensi:         ()            => apiGet('getAbsensiMurid'),
  getJadwal:          ()            => apiGet('getJadwalMurid'),
  getPengumuman:      ()            => apiGet('getPengumuman'),
  updateProfil:       (data)        => apiPost('updateProfilMurid', data),
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
