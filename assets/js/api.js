// ============================================================
//  assets/js/api.js — API Client Portal Halaqah Rattililqur'an
//  UPDATE: Selalu upload file ini ke GitHub setiap ada perubahan
// ============================================================

const BASE_URL = 'https://script.google.com/macros/s/AKfycbxx3dy_yOdyuNi51YZD_acDOHYPP5casOuzPqn0vwZarcOrmlhjf7nf9qy0An04tOBb_A/exec';

function getToken() {
  return localStorage.getItem('hq_token') || sessionStorage.getItem('hq_token') || '';
}

async function apiGet(action, params) {
  const p = params || {};
  const query = new URLSearchParams({ action, token: getToken() });
  Object.keys(p).forEach(k => { if (p[k] !== undefined && p[k] !== null) query.set(k, p[k]); });
  const res = await fetch(BASE_URL + '?' + query.toString(), { method:'GET', mode:'cors' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

async function apiPost(action, body) {
  const b = body || {};
  const query = new URLSearchParams({
    action,
    token  : getToken(),
    payload: JSON.stringify(b),
  });
  const res = await fetch(BASE_URL + '?' + query.toString(), { method:'GET', mode:'cors' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

// ─── AUTH ───────────────────────────────────────
var Auth = {
  login: function(nis, role, password) {
    return apiGet('login', { nis: nis, role: role, password: password || '' });
  },
  logout: function() {
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_user');
    sessionStorage.removeItem('hq_token');
    sessionStorage.removeItem('hq_user');
    var depth = window.location.pathname.split('/').filter(Boolean).length;
    window.location.href = depth >= 2 ? '../index.html' : 'index.html';
  },
  getUser: function() {
    return JSON.parse(localStorage.getItem('hq_user') || sessionStorage.getItem('hq_user') || 'null');
  },
};

// ─── ADMIN API ──────────────────────────────────
var AdminAPI = {
  // Dashboard
  getDashboard       : function()          { return apiGet('getDashboardAdmin'); },

  // Periode
  getAllPeriode       : function()          { return apiGet('getAllPeriode'); },
  createPeriode      : function(d)         { return apiPost('createPeriode', d); },
  updatePeriode      : function(d)         { return apiPost('updatePeriode', d); },

  // Users
  getAllUsers         : function(role)      { return apiGet('getAllUsers', role ? { role:role } : {}); },
  createUser         : function(d)         { return apiPost('createUser', d); },
  updateUser         : function(d)         { return apiPost('updateUser', d); },
  deleteUser         : function(id)        { return apiPost('deleteUser', { id_user:id }); },
  bulkImportBatch1   : function(d)         { return apiPost('bulkImportBatch1', d); },
  bulkImportBatch2   : function(d)         { return apiPost('bulkImportBatch2', d); },
  bulkImportSummary  : function(d)         { return apiPost('bulkImportSummary', d); },

  // Halaqah
  getAllHalaqah       : function()          { return apiGet('getAllHalaqah'); },
  createHalaqah      : function(d)         { return apiPost('createHalaqah', d); },
  updateHalaqah      : function(d)         { return apiPost('updateHalaqah', d); },
  deleteHalaqah      : function(id)        { return apiPost('deleteHalaqah', { id_halaqah:id }); },

  // Anggota
  getAllAnggota       : function(id_h)      { return apiGet('getAllAnggota', id_h ? { id_halaqah:id_h } : {}); },
  addAnggota         : function(d)         { return apiPost('addAnggota', d); },
  updateAnggota      : function(d)         { return apiPost('updateAnggota', d); },
  removeAnggota      : function(id)        { return apiPost('removeAnggota', { id_anggota:id }); },

  // Laporan
  getAllKBM           : function(p)         { return apiGet('getAllKBM', p || {}); },
  getRekapAbsensi    : function(p)         { return apiGet('getRekapAbsensi', p || {}); },
  getLaporanGlobal   : function(p)         { return apiGet('getLaporanGlobal', p || {}); },
  getAuditLog        : function()          { return apiGet('getAuditLog'); },

  // Komponen & Nilai
  getKomponenRaport  : function(id_p)      { return apiGet('getKomponenRaport', { id_periode:id_p }); },
  saveKomponenRaport : function(d)         { return apiPost('saveKomponenRaport', d); },
  getNilaiManual     : function(id_p)      { return apiGet('getNilaiManual', { id_periode:id_p }); },
  saveNilaiManual    : function(d)         { return apiPost('saveNilaiManual', d); },

  // Raport
  generateRaport     : function(d)         { return apiPost('generateRaportMurid', d); },
  generateRaportBulk : function(d)         { return apiPost('generateRaportBulk', d); },
  getRaportList      : function(id_p)      { return apiGet('getRaportList', { id_periode:id_p }); },
  publishRaport      : function(id)        { return apiPost('publishRaport', { id_raport:id }); },
  kirimRaportEmail   : function(id)        { return apiPost('kirimRaportEmail', { id_raport:id }); },

  // Pengumuman
  buatPengumuman     : function(d)         { return apiPost('buatPengumuman', d); },
  getAllPengumuman    : function()          { return apiGet('getAllPengumuman'); },
  getLevelList       : function()          { return apiGet('getLevelList'); },
  saveLevel          : function(d)         { return apiPost('saveLevel', d); },
  deleteLevel        : function(id)        { return apiPost('deleteLevel', { id_level:id }); },
  getTemplateKoreksi : function()          { return apiGet('getTemplateKoreksi'); },
  saveTemplateKoreksi: function(d)         { return apiPost('saveTemplateKoreksi', d); },
  exportRekapAbsensi : function(p)         { return apiGet('exportRekapAbsensi', p||{}); },
};

// ─── GURU API ───────────────────────────────────
var GuruAPI = {
  getDashboard          : function()           { return apiGet('getDashboardGuru'); },
  getHalaqahSaya        : function()           { return apiGet('getHalaqahGuru'); },
  getMurid              : function(id_h)       { return apiGet('getMuridByHalaqah', { id_halaqah:id_h }); },
  getRiwayatKBM         : function(id_h, lim)  { return apiGet('getKBMByHalaqah', { id_halaqah:id_h, limit:lim||20 }); },
  getNilaiByKBM         : function(id_kbm)     { return apiGet('getNilaiByKBM', { id_kbm:id_kbm }); },
  getPresensiByKBM      : function(id_kbm)     { return apiGet('getPresensiByKBM', { id_kbm:id_kbm }); },
  bukaKBM               : function(d)          { return apiPost('bukaKBM', d); },
  simpanPresensi        : function(d)          { return apiPost('simpanPresensi', d); },
  editPresensi          : function(d)          { return apiPost('editPresensi', d); },
  simpanJurnalKBM       : function(d)          { return apiPost('simpanJurnalKBM', d); },
  simpanNilaiMurid      : function(d)          { return apiPost('simpanNilaiMurid', d); },
  tutupKBM              : function(id_kbm)     { return apiPost('tutupKBM', { id_kbm:id_kbm }); },
  addMuridByGuru        : function(d)          { return apiPost('addMuridByGuru', d); },
  kirimPengumuman       : function(d)          { return apiPost('kirimPengumumanGuru', d); },
  getMuridBelum         : function(id_h)       { return apiGet('getMuridBelumDiHalaqah', { id_halaqah:id_h }); },
  generateRekapPresensi : function(id_h)       { return apiGet('generateRekapPresensi', { id_halaqah:id_h }); },
  generateRekapNilai    : function(id_h)       { return apiGet('generateRekapNilai', { id_halaqah:id_h }); },
  getJadwalHariIni      : function()           { return apiGet('getJadwalHariIni'); },
  getRiwayatMuridKoreksi: function(id_m, lim)  { return apiGet('getRiwayatMuridKoreksi', { id_murid:id_m, limit:lim||10 }); },
  getTemplateKoreksi    : function()           { return apiGet('getTemplateKoreksi'); },
};

// ─── MURID API ──────────────────────────────────
var MuridAPI = {
  getDashboard      : function()  { return apiGet('getDashboardMurid'); },
  getRiwayat        : function()  { return apiGet('getRiwayatMurid'); },
  getLatihanMandiri : function()  { return apiGet('getLatihanMandiriMurid'); },
  getRaport         : function()  { return apiGet('getRaportMurid'); },
  getPengumuman     : function()  { return apiGet('getPengumumanMurid'); },
  updateProfil      : function(d) { return apiPost('updateProfilMurid', d); },
  getProgressGrafik : function()  { return apiGet('getProgressGrafik'); },
};

// ─── EKSPOS GLOBAL ──────────────────────────────
// Ganti apapun yang sudah ada sebelumnya
window.HQ = {
  Auth     : Auth,
  AdminAPI : AdminAPI,
  GuruAPI  : GuruAPI,
  MuridAPI : MuridAPI,
};
