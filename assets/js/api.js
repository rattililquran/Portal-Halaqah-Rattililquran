// ============================================================
//  assets/js/api.js — v3.4
//  Cache sessionStorage + load_more support
// ============================================================

var BASE_URL = 'https://script.google.com/macros/s/AKfycby6J2EUqs9YNxM7x5a4nfSRmQlERWxkYq8bvx1wZbAjKgGwWxhhwFh73LhKxHwqM6FHiA/exec';

// ─── CACHE ───────────────────────────────────────
// TTL per action (detik). 0 = tidak di-cache
var CACHE_TTL = {
  // Data stabil — cache lama
  'getHalaqahGuru'     : 300,  // 5 menit
  'getAllHalaqah'       : 300,
  'getAllUsers'         : 300,
  'getLevelList'        : 600,  // 10 menit
  'getTemplateKoreksi'  : 600,
  'getAllPengumuman'     : 120,
  'getPengumumanMurid'  : 120,
  // Data dinamis — cache pendek
  'getDashboardGuru'    : 60,
  'getDashboardAdmin'   : 60,
  'getDashboardMurid'   : 60,
  'getJadwalHariIni'    : 60,
  'getMuridByHalaqah'   : 120,
  'getAllAnggota'        : 120,
  // Data real-time — tidak di-cache
  'getKBMByHalaqah'     : 0,
  'getRiwayatMurid'     : 0,
  'getProgressGrafik'   : 0,
  'getAuditLog'         : 0,
  'getRekapAbsensi'     : 0,
};

function cacheGet(key) {
  try {
    var raw = sessionStorage.getItem('hq_cache_' + key);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() > obj.exp) {
      sessionStorage.removeItem('hq_cache_' + key);
      return null;
    }
    return obj.data;
  } catch(e) { return null; }
}

function cacheSet(key, data, ttlSeconds) {
  try {
    sessionStorage.setItem('hq_cache_' + key, JSON.stringify({
      data: data,
      exp : Date.now() + ttlSeconds * 1000,
    }));
  } catch(e) {}
}

function cacheInvalidate(patterns) {
  // Hapus cache yang key-nya mengandung pattern
  var keys = Object.keys(sessionStorage).filter(function(k) {
    return k.startsWith('hq_cache_');
  });
  keys.forEach(function(k) {
    var action = k.replace('hq_cache_', '').split('_')[0];
    if (!patterns || patterns.some(function(p){ return k.includes(p); })) {
      sessionStorage.removeItem(k);
    }
  });
}

// ─── TOKEN ───────────────────────────────────────
function getToken() {
  return localStorage.getItem('hq_token') || sessionStorage.getItem('hq_token') || '';
}

// ─── API CORE ────────────────────────────────────
async function apiGet(action, params, skipCache) {
  var p = params || {};
  var cacheKey = action + '_' + JSON.stringify(p);
  var ttl = CACHE_TTL[action];

  // Cache hit
  if (!skipCache && ttl > 0) {
    var cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  var query = new URLSearchParams({ action: action, token: getToken() });
  Object.keys(p).forEach(function(k) {
    if (p[k] !== undefined && p[k] !== null) query.set(k, p[k]);
  });

  var res = await fetch(BASE_URL + '?' + query.toString(), { method:'GET', mode:'cors' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');

  // Simpan ke cache
  if (!skipCache && ttl > 0) cacheSet(cacheKey, data, ttl);

  return data;
}

async function apiPost(action, body) {
  var b = body || {};
  var query = new URLSearchParams({
    action : action,
    token  : getToken(),
    payload: JSON.stringify(b),
  });
  var res = await fetch(BASE_URL + '?' + query.toString(), { method:'GET', mode:'cors' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Terjadi kesalahan');

  // Invalidate cache yang relevan setelah write
  var invalidateMap = {
    'bukaKBM'            : ['getDashboard','getJadwal','getKBM'],
    'simpanPresensi'     : ['getDashboard','getKBM','getRiwayat'],
    'simpanNilaiMurid'   : ['getDashboard','getRiwayat','getProgress'],
    'tutupKBM'           : ['getDashboard','getJadwal','getKBM','getRiwayat'],
    'simpanJurnalKBM'    : ['getKBM'],
    'createUser'         : ['getAllUsers','getDashboard'],
    'updateUser'         : ['getAllUsers'],
    'createHalaqah'      : ['getAllHalaqah','getDashboard'],
    'updateHalaqah'      : ['getAllHalaqah'],
    'addAnggota'         : ['getAllAnggota','getMurid','getDashboard'],
    'saveLevel'          : ['getLevelList'],
    'saveTemplateKoreksi': ['getTemplateKoreksi'],
    'buatPengumuman'     : ['getAllPengumuman','getPengumuman'],
    'kirimPengumumanGuru': ['getAllPengumuman','getPengumuman'],
  };
  if (invalidateMap[action]) cacheInvalidate(invalidateMap[action]);

  return data;
}

// ─── AUTH ─────────────────────────────────────────
var Auth = {
  login: function(nis, role, password) {
    return apiGet('login', { nis:nis, role:role, password:password||'' }, true);
  },
  logout: function() {
    // Hapus semua cache saat logout
    Object.keys(sessionStorage).filter(function(k){return k.startsWith('hq_cache_');})
      .forEach(function(k){ sessionStorage.removeItem(k); });
    localStorage.removeItem('hq_token');
    localStorage.removeItem('hq_user');
    sessionStorage.removeItem('hq_token');
    sessionStorage.removeItem('hq_user');
    var depth = window.location.pathname.split('/').filter(Boolean).length;
    window.location.replace(depth >= 2 ? '../index.html' : 'index.html');
  },
  getUser: function() {
    return JSON.parse(localStorage.getItem('hq_user') || sessionStorage.getItem('hq_user') || 'null');
  },
};

// ─── ADMIN API ────────────────────────────────────
var AdminAPI = {
  getDashboard       : function()          { return apiGet('getDashboardAdmin'); },
  getAllPeriode       : function()          { return apiGet('getAllPeriode'); },
  createPeriode      : function(d)         { return apiPost('createPeriode', d); },
  updatePeriode      : function(d)         { return apiPost('updatePeriode', d); },
  getAllUsers         : function(role)      { return apiGet('getAllUsers', role ? { role:role } : {}); },
  createUser         : function(d)         { return apiPost('createUser', d); },
  updateUser         : function(d)         { return apiPost('updateUser', d); },
  deleteUser         : function(id)        { return apiPost('deleteUser', { id_user:id }); },
  bulkImportBatch1   : function(d)         { return apiPost('bulkImportBatch1', d); },
  bulkImportBatch2   : function(d)         { return apiPost('bulkImportBatch2', d); },
  bulkImportSummary  : function(d)         { return apiPost('bulkImportSummary', d); },
  validateImportCSV  : function(d)         { return apiPost('validateImportCSV', d); },
  importTahap1       : function(d)         { return apiPost('importTahap1Halaqah', d); },
  importTahap2       : function(d)         { return apiPost('importTahap2Users', d); },
  importTahap3       : function(d)         { return apiPost('importTahap3Anggota', d); },
  getAllHalaqah       : function()          { return apiGet('getAllHalaqah'); },
  createHalaqah      : function(d)         { return apiPost('createHalaqah', d); },
  updateHalaqah      : function(d)         { return apiPost('updateHalaqah', d); },
  deleteHalaqah      : function(id)        { return apiPost('deleteHalaqah', { id_halaqah:id }); },
  getAllAnggota       : function(id_h)      { return apiGet('getAllAnggota', id_h ? { id_halaqah:id_h } : {}); },
  addAnggota         : function(d)         { return apiPost('addAnggota', d); },
  updateAnggota      : function(d)         { return apiPost('updateAnggota', d); },
  removeAnggota      : function(id)        { return apiPost('removeAnggota', { id_anggota:id }); },
  getAllKBM           : function(p)         { return apiGet('getAllKBM', p || {}); },
  getRekapAbsensi    : function(p)         { return apiGet('getRekapAbsensi', p || {}); },
  getLaporanGlobal   : function(p)         { return apiGet('getLaporanGlobal', p || {}); },
  getAuditLog        : function(p)         { return apiGet('getAuditLog', p || {}); },
  getKomponenRaport  : function(id_p)      { return apiGet('getKomponenRaport', { id_periode:id_p }); },
  saveKomponenRaport : function(d)         { return apiPost('saveKomponenRaport', d); },
  getNilaiManual     : function(id_p)      { return apiGet('getNilaiManual', { id_periode:id_p }); },
  saveNilaiManual    : function(d)         { return apiPost('saveNilaiManual', d); },
  generateRaport     : function(d)         { return apiPost('generateRaportMurid', d); },
  generateRaportBulk     : function(d) { return apiPost('generateRaportBulk', d); },
  generateRaportByHalaqah: function(d) { return apiPost('generateRaportByHalaqah', d); },
  generateRaportByLevel  : function(d) { return apiPost('generateRaportByLevel', d); },
  getRaportList      : function(id_p)      { return apiGet('getRaportList', { id_periode:id_p }); },
  publishRaport      : function(id)        { return apiPost('publishRaport', { id_raport:id }); },
  kirimRaportEmail   : function(id)        { return apiPost('kirimRaportEmail', { id_raport:id }); },
  buatPengumuman     : function(d)         { return apiPost('buatPengumuman', d); },
  getAllPengumuman    : function()          { return apiGet('getAllPengumuman'); },
  getLevelList       : function()          { return apiGet('getLevelList'); },
  saveLevel          : function(d)         { return apiPost('saveLevel', d); },
  deleteLevel        : function(id)        { return apiPost('deleteLevel', { id_level:id }); },
  getTemplateKoreksi : function()          { return apiGet('getTemplateKoreksi'); },
  saveTemplateKoreksi: function(d)         { return apiPost('saveTemplateKoreksi', d); },
  exportRekapAbsensi : function(p)         { return apiGet('exportRekapAbsensi', p || {}); },
  getArsipList       : function()          { return apiGet('getArsipList'); },
  arsipData          : function(p)         { return apiPost('arsipData', p||{}); },
};

// ─── GURU API ─────────────────────────────────────
var GuruAPI = {
  getDashboard          : function()              { return apiGet('getDashboardGuru'); },
  getHalaqahSaya        : function()              { return apiGet('getHalaqahGuru'); },
  getMurid              : function(id_h)          { return apiGet('getMuridByHalaqah', { id_halaqah:id_h }); },
  getJadwalHariIni      : function()              { return apiGet('getJadwalHariIni'); },
  // Riwayat KBM — default 10, load_more untuk ambil lebih
  getRiwayatKBM         : function(id_h, lim, more) {
    return apiGet('getKBMByHalaqah', { id_halaqah:id_h, limit:lim||10, load_more:more||0 });
  },
  getNilaiByKBM         : function(id_kbm)        { return apiGet('getNilaiByKBM', { id_kbm:id_kbm }); },
  getPresensiByKBM      : function(id_kbm)        { return apiGet('getPresensiByKBM', { id_kbm:id_kbm }); },
  bukaKBM               : function(d)             { return apiPost('bukaKBM', d); },
  simpanPresensi        : function(d)             { return apiPost('simpanPresensi', d); },
  editPresensi          : function(d)             { return apiPost('editPresensi', d); },
  simpanJurnalKBM       : function(d)             { return apiPost('simpanJurnalKBM', d); },
  simpanNilaiMurid      : function(d)             { return apiPost('simpanNilaiMurid', d); },
  tutupKBM              : function(id_kbm)        { return apiPost('tutupKBM', { id_kbm:id_kbm }); },
  addMuridByGuru        : function(d)             { return apiPost('addMuridByGuru', d); },
  kirimPengumuman       : function(d)             { return apiPost('kirimPengumumanGuru', d); },
  getMuridBelum         : function(id_h)          { return apiGet('getMuridBelumDiHalaqah', { id_halaqah:id_h }); },
  generateRekapPresensi : function(id_h)          { return apiGet('generateRekapPresensi', { id_halaqah:id_h }); },
  generateRekapNilai    : function(id_h)          { return apiGet('generateRekapNilai', { id_halaqah:id_h }); },
  getRiwayatMuridKoreksi: function(id_m, lim)     { return apiGet('getRiwayatMuridKoreksi', { id_murid:id_m, limit:lim||10 }); },
  getTemplateKoreksi    : function()              { return apiGet('getTemplateKoreksi'); },
};

// ─── MURID API ────────────────────────────────────
var MuridAPI = {
  getDashboard      : function()              { return apiGet('getDashboardMurid'); },
  // Riwayat — default 10, load_more untuk "lihat lebih"
  getRiwayat        : function(lim, more)     {
    return apiGet('getRiwayatMurid', { limit:lim||10, load_more:more||0 }, true);
  },
  getLatihanMandiri : function()              { return apiGet('getLatihanMandiriMurid'); },
  getRaport         : function()              { return apiGet('getRaportMurid'); },
  getPengumuman     : function()              { return apiGet('getPengumumanMurid'); },
  updateProfil      : function(d)             { return apiPost('updateProfilMurid', d); },
  getProgressGrafik : function()              { return apiGet('getProgressGrafik'); },
  getMateriLevel    : function(lv)            { return apiGet('getMateriLevel', lv ? {level:lv} : {}); },
  getSPPStatus      : function()             { return apiGet('getSPPStatus'); },
};

// ─── EKSPOS GLOBAL ────────────────────────────────
window.HQ = {
  Auth     : Auth,
  AdminAPI : AdminAPI,
  GuruAPI  : GuruAPI,
  MuridAPI : MuridAPI,
  cache    : { invalidate: cacheInvalidate }, // expose untuk debug
};
