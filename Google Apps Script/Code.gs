// Jalankan di V8 Runtime (Apps Script > Settings > Script Runtime: V8)
// ============================================================
//  Code.gs — Entry Point & Core Utilities
//  Portal Manajemen Halaqah Rattililqur'an
//  Versi: 1.0.0
//  Deskripsi: File utama GAS. Berisi konfigurasi, router HTTP,
//             autentikasi role, dan helper global.
// ============================================================

// ─────────────────────────────────────────────
//  KONFIGURASI GLOBAL
// ─────────────────────────────────────────────

// Timezone tetap WIB — tidak bergantung script timezone
var TZ = 'Asia/Jakarta';

const CONFIG = {
  // Ganti dengan Spreadsheet ID milik Anda
  SPREADSHEET_ID: '19Lbdtdt3cjTsWzwYw6bhyVWCCFzSsF2x7r-Unk7-Ks0',

  // Nama sheet (tab) di Google Sheets
  SHEET: {
    USERS           : 'Users',
    HALAQAH         : 'Halaqah',
    ANGGOTA         : 'Anggota',
    KBM_LOG         : 'KBM_Log',
    NILAI_KBM       : 'Nilai_KBM',
    PENGUMUMAN      : 'Pengumuman',
    LEVEL           : 'Level',
    PERIODE         : 'Periode',
    KOMPONEN_RAPORT : 'Komponen_Raport',
    NILAI_MANUAL    : 'Nilai_Manual',
    RAPORT          : 'Raport',
    AUDIT_LOG         : 'Audit_Log',
    TEMPLATE_KOREKSI  : 'Template_Koreksi',
    KONFIGURASI_RAPORT: 'Konfigurasi_Raport',
    CATATAN_RAPORT    : 'Catatan_Raport',
    AT_TIBYAN_SESI    : 'At-Tibyan_Sesi',
    AT_TIBYAN_LOG     : 'At-Tibyan_Log',
    OBSERVASI_KBM     : 'Observasi_KBM',
  },

  // Role yang diizinkan
  ROLE: {
    ADMIN      : 'admin',
    SUPERADMIN : 'superadmin',
    GURU       : 'guru',
    MURID      : 'murid',
  },

  // Versi API — tampil di response header
  API_VERSION: 'v1.0',
};


// ─────────────────────────────────────────────
//  ENTRY POINT — doGet & doPost
// ─────────────────────────────────────────────

/**
 * Menangani semua request GET dari frontend.
 * Query params: action, token, + param spesifik per action.
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || '';
    const token  = params.token  || '';

    // Jika ada payload (dari apiPost yang dikonversi ke GET), parse sebagai data POST
    let postData = {};
    if (params.payload) {
      try { postData = JSON.parse(params.payload); } catch(_) {}
    }

    // Verifikasi token / session
    const user = verifyToken(token);
    if (!user && action !== 'login') {
      return jsonResponse({ status: 'error', message: 'Unauthorized' }, 401);
    }

    // Route berdasarkan action
    switch (action) {

      // ── Auth ──
      case 'login':         return handleLogin(params);
      case 'getProfile':    return jsonResponse(getProfile(user));

      // ── Admin ──
      case 'getDashboardAdmin':  return routeAdmin(user, () => getDashboardAdmin());
      case 'getAllUsers':         return routeAdmin(user, () => getAllUsers(params));
      case 'getAllHalaqah':       return routeAdmin(user, () => getAllHalaqah());
      case 'getAllAnggota':       return routeAdmin(user, () => getAllAnggota(params));
      case 'getAllKBM':           return routeAdmin(user, () => getAllKBM(params));
      case 'getRekapAbsensi':    return routeAdmin(user, () => getRekapAbsensi(params));
      case 'getLaporanGlobal':   return routeAdmin(user, () => getLaporanGlobal(params));
      case 'getAuditLog':        return routeSuperAdmin(user, () => getAuditLog());
      case 'getAllPeriode':       return routeGuru(user, () => getAllPeriode());
      case 'getKomponenRaport':  return routeGuru(user, () => getKomponenRaport(params));
      case 'getNilaiManual':     return routeGuru(user, () => getNilaiManual(params, user));
      case 'getRaportList':      return routeAdmin(user, () => getRaportList(params));
      case 'getAllPengumuman':    return routeAdmin(user, () => getAllPengumuman());
      case 'getLevelList':        return jsonResponse(getLevelList());
      case 'getArsipList':        return routeAdmin(user, () => getArsipList());
      case 'arsipData':           return routeAdmin(user, () => arsipDataLama(Object.keys(postData).length ? postData : params));
      case 'getTemplateKoreksi':  return jsonResponse(getTemplateKoreksi());
      case 'exportRekapAbsensi':  return routeAdmin(user, () => exportRekapAbsensi(params));

      // ── Guru ──
      case 'getDashboardGuru':      return routeGuru(user, () => getDashboardGuru(user));
      case 'getHalaqahGuru':        return routeGuru(user, () => getHalaqahGuru(user));
      case 'getMuridByHalaqah':     return routeGuru(user, () => getMuridByHalaqah(params));
      case 'getJadwalHariIni':      return routeGuru(user, () => getJadwalHariIni(user));
      case 'getRiwayatMuridKoreksi':return routeGuru(user, () => getRiwayatMuridKoreksi(params));
      case 'getTemplateKoreksi':    return jsonResponse(getTemplateKoreksi());
      case 'getKBMByHalaqah':    return routeGuru(user, () => getKBMByHalaqah(params));
      case 'getNilaiByKBM':      return routeGuru(user, () => getNilaiByKBM(params));
      case 'getPresensiByKBM':   return routeGuru(user, () => getPresensiByKBM(params));
      case 'getMuridBelumDiHalaqah': return routeGuru(user, () => getMuridBelumDiHalaqah(params, user));
      case 'generateRekapPresensi':  return routeGuru(user, () => generateRekapPresensi(params));
      case 'generateRekapNilai':     return routeGuru(user, () => generateRekapNilai(params));
      case 'getKeaktifanAlerts':     return routeGuru(user, () => getKeaktifanAlerts(user));
      case 'getDraftCount':          return routeGuru(user, () => getDraftCount(user));
      case 'getAtTibyanSesi':        return routeGuru(user, () => getAtTibyanSesi(params, user));
      case 'getObservasiKBM':       return routeSuperAdmin(user, () => getObservasiKBM(params));
      case 'getObservasiStats':     return routeSuperAdmin(user, () => getObservasiStats(params));
      case 'assignKetuaKelas':      return routeSuperAdmin(user, () => assignKetuaKelas(postData));
      case 'getAtTibyanDetail':      return routeGuru(user, () => getAtTibyanDetail(params, user));
      case 'getAtTibyanRekap':       return routeGuru(user, () => getAtTibyanRekap(params, user));
      case 'getAtTibyanKeaktifan':   return routeGuru(user, () => getAtTibyanKeaktifan(user));
      case 'getAllMuridAktif':        return routeGuru(user, () => getAllMuridAktif(user));
      // ── Guru: Raport ──
      case 'getRaportListGuru':      return routeGuru(user, () => getRaportListGuru(params, user));
      case 'getCatatanHalaqah':      return routeGuru(user, () => getCatatanHalaqah(params, user));

      // ── Guru (write via GET+payload) ──
      case 'bukaKBM':            return routeGuru(user, () => bukaKBM(postData, user));
      case 'simpanPresensi':     return routeGuru(user, () => simpanPresensi(postData, user));
      case 'editPresensi':       return routeGuru(user, () => editPresensi(postData, user));
      case 'simpanJurnalKBM':    return routeGuru(user, () => simpanJurnalKBM(postData, user));
      case 'simpanNilaiMurid':   return routeGuru(user, () => simpanNilaiMurid(postData, user));
      case 'simpanNilaiMuridBatch': return routeGuru(user, () => simpanNilaiMuridBatch(postData, user));
      case 'tutupKBM':           return routeGuru(user, () => tutupKBM(postData, user));
      case 'hapusKBM':           return routeGuru(user, () => hapusKBM(postData, user));
      case 'updateCatatanMurid': return routeGuru(user, () => updateCatatanMurid(postData, user));
      case 'addMuridByGuru':     return routeGuru(user, () => addMuridByGuru(postData, user));
      case 'kirimPengumumanGuru':return routeGuru(user, () => kirimPengumumanGuru(postData, user));
      case 'changePassword':     return routeGuru(user, () => changePassword(postData, user));
      case 'simpanFollowupKeaktifan': return routeGuru(user, () => simpanFollowupKeaktifan(postData, user));
      case 'simpanAtTibyanBulk':     return routeGuru(user, () => simpanAtTibyanBulk(postData, user));
      case 'editAtTibyanSesi':            return routeGuru(user, () => editAtTibyanSesi(postData, user));
      // ── Guru: Raport (write) ──
      case 'generateRaportHalaqahGuru':  return routeGuru(user, () => generateRaportHalaqahGuru(postData, user));
      case 'publishAllRaportHalaqahGuru':return routeGuru(user, () => publishAllRaportHalaqahGuru(postData, user));
      case 'saveCatatanHalaqahGuru':     return routeGuru(user, () => saveCatatanHalaqahGuru(postData, user));

      // ── Ketua Kelas (write) ──
      case 'submitObservasi':        return routeKetua(user, (ang) => submitObservasi(postData, user, ang));
      case 'simpanRekapStatus':      return routeKetua(user, (ang) => simpanRekapStatus(postData, user, ang));

      // ── Admin (write via GET+payload) ──
      case 'createUser':         return routeAdmin(user, () => createUser(postData));
      case 'updateUser':         return routeAdmin(user, () => updateUser(postData));
      case 'deleteUser':         return routeAdmin(user, () => deleteUser(postData));
      case 'createHalaqah':      return routeAdmin(user, () => createHalaqah(postData));
      case 'updateHalaqah':      return routeAdmin(user, () => updateHalaqah(postData));
      case 'deleteHalaqah':      return routeAdmin(user, () => deleteHalaqah(postData));
      case 'addAnggota':         return routeAdmin(user, () => addAnggota(postData));
      case 'updateAnggota':      return routeAdmin(user, () => updateAnggota(postData));
      case 'removeAnggota':      return routeAdmin(user, () => removeAnggota(postData));
      case 'buatPengumuman':     return routeAdmin(user, () => buatPengumuman(postData));
      case 'createPeriode':      return routeAdmin(user, () => createPeriode(postData));
      case 'updatePeriode':      return routeAdmin(user, () => updatePeriode(postData));
      case 'saveKomponenRaport'     : return routeAdmin(user, () => saveKomponenRaport(postData));
      case 'saveNilaiManual'         : return routeGuru(user, () => saveNilaiManual(postData, user));
      case 'saveNilaiManualBatch'    : return routeGuru(user, () => saveNilaiManualBatch(postData, user));
      case 'generateRaportMurid'     : return routeAdmin(user, () => generateRaportMurid(postData));
      case 'generateRaportBulk'      : return routeAdmin(user, () => generateRaportBulk(postData));
      case 'generateRaportByHalaqah' : return routeAdmin(user, () => generateRaportByHalaqah(postData));
      case 'generateRaportByLevel'   : return routeAdmin(user, () => generateRaportByLevel(postData));
      case 'publishRaport'           : return routeAdmin(user, () => publishRaport(postData));
      case 'kirimRaportEmail'        : return routeAdmin(user, () => kirimRaportEmail(postData));
      case 'saveLevel'               : return routeAdmin(user, () => saveLevel(postData));
      case 'deleteLevel'             : return routeAdmin(user, () => deleteLevel(postData));
      case 'saveTemplateKoreksi'     : return routeAdmin(user, () => saveTemplateKoreksi(postData));
      case 'bulkImportBatch1'        : return routeAdmin(user, () => bulkImportBatch1(postData));
      case 'bulkImportBatch2'        : return routeAdmin(user, () => bulkImportBatch2(postData));
      case 'bulkImportSummary'       : return routeAdmin(user, () => bulkImportSummary(postData));
      // Import terintegrasi (3 tahap)
      case 'validateImportCSV'       : return routeAdmin(user, () => validateImportCSV(postData));
      case 'importTahap1Halaqah'     : return routeAdmin(user, () => importTahap1Halaqah(postData));
      case 'importTahap2Users'       : return routeAdmin(user, () => importTahap2Users(postData));
      case 'importTahap3Anggota'     : return routeAdmin(user, () => importTahap3Anggota(postData));

      // ── Murid (write via GET+payload) ──
      case 'updateProfilMurid':  return routeMurid(user, () => updateProfilMurid(postData, user));
      case 'changePasswordMurid': return routeMurid(user, () => changePasswordMurid(postData, user));
      case 'saveAssessmentMurid': return routeMurid(user, () => saveAssessmentMurid(postData, user));

      // ── Murid ──
      case 'getDashboardMurid':     return routeMurid(user, () => getDashboardMurid(user));
      case 'getProgressGrafik':     return routeMurid(user, () => getProgressGrafik(user));
      case 'getMateriLevel':        return routeMurid(user, () => getMateriLevel(params));
      case 'getAtTibyan':           return routeMurid(user, () => getAtTibyan(params));
      case 'getAtTibyanMurid':      return routeMurid(user, () => getAtTibyanMurid(user));

      // ── Ketua Kelas ──
      case 'getKetuaInfo':          return routeKetua(user, (ang) => getKetuaInfo(user, ang));
      case 'getKeaktifanAnggota':   return routeKetua(user, (ang) => getKeaktifanAnggota(user, ang, params));
      case 'getAtTibyanAnggota':    return routeKetua(user, (ang) => getAtTibyanAnggota(user, ang));
      case 'getObservasiPending':   return routeKetua(user, (ang) => getObservasiPending(user, ang));
      case 'getObservasiHistory':   return routeKetua(user, (ang) => getObservasiHistory(user, ang));
      case 'getKBMJurnal':          return routeKetua(user, (ang) => getKBMJurnal(params, user, ang));
      case 'getRekapStatus':        return routeKetua(user, (ang) => getRekapStatus(user, ang));
      case 'getSPPStatus':          return routeMurid(user, () => getSPPStatus(user));
      case 'getRiwayatMurid':       return routeMurid(user, () => getRiwayatMurid(user, params));
      case 'getLatihanMandiriMurid':return routeMurid(user, () => getLatihanMandiriMurid(user));
      case 'getRaportMurid':        return routeMurid(user, () => getRaportMurid(user));
      case 'getKonfigurasiRaport':  return routeMurid(user, () => getKonfigurasiRaport(user));
      case 'getPengumumanMurid':    return routeMurid(user, () => getPengumumanMurid(user));
      case 'getKeaktifanAlertsMurid': return routeMurid(user, () => getKeaktifanAlertsMurid(user));
      case 'getPengumuman':         return jsonResponse(getPengumumanMurid(user));
      case 'getAssessmentItems':    return routeMurid(user, () => getAssessmentItems(params));
      case 'getAssessmentMurid':    return routeMurid(user, () => getAssessmentMurid(user));
      case 'getAssessmentRekap':    return routeGuru(user, () => getAssessmentRekap(params, user));

      default:
        return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action }, 400);
    }

  } catch (err) {
    logError('doGet', err);
    return jsonResponse({ status: 'error', message: err.message }, 500);
  }
}


/**
 * Menangani semua request POST dari frontend.
 * Body JSON: { action, token, data: {...} }
 */
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';
    const token  = body.token  || '';
    const data   = body.data   || {};
    const postData = data;

    // Verifikasi token
    const user = verifyToken(token);
    if (!user && action !== 'login') {
      return jsonResponse({ status: 'error', message: 'Unauthorized' }, 401);
    }

    switch (action) {

      // ── Admin ──
      case 'createUser':               return routeAdmin(user, () => createUser(postData));
      case 'updateUser':               return routeAdmin(user, () => updateUser(postData));
      case 'deleteUser':               return routeAdmin(user, () => deleteUser(postData));
      case 'createHalaqah':            return routeAdmin(user, () => createHalaqah(postData));
      case 'updateHalaqah':            return routeAdmin(user, () => updateHalaqah(postData));
      case 'deleteHalaqah':            return routeAdmin(user, () => deleteHalaqah(postData));
      case 'addAnggota':               return routeAdmin(user, () => addAnggota(postData));
      case 'updateAnggota':            return routeAdmin(user, () => updateAnggota(postData));
      case 'removeAnggota':            return routeAdmin(user, () => removeAnggota(postData));
      case 'buatPengumuman':           return routeAdmin(user, () => buatPengumuman(postData));
      case 'saveLevel':                return routeAdmin(user, () => saveLevel(postData));
      case 'deleteLevel':              return routeAdmin(user, () => deleteLevel(postData));
      case 'saveTemplateKoreksi':      return routeAdmin(user, () => saveTemplateKoreksi(postData));
      case 'generateRaportByHalaqah':  return routeAdmin(user, () => generateRaportByHalaqah(postData));
      case 'generateRaportByLevel':    return routeAdmin(user, () => generateRaportByLevel(postData));

      // ── Guru ──
      case 'bukaKBM':            return routeGuru(user, () => bukaKBM(postData, user));
      case 'simpanPresensi':     return routeGuru(user, () => simpanPresensi(postData, user));
      case 'editPresensi':       return routeGuru(user, () => editPresensi(postData, user));
      case 'simpanJurnalKBM':    return routeGuru(user, () => simpanJurnalKBM(postData, user));
      case 'simpanNilaiMurid':   return routeGuru(user, () => simpanNilaiMurid(postData, user));
      case 'simpanNilaiMuridBatch': return routeGuru(user, () => simpanNilaiMuridBatch(postData, user));
      case 'tutupKBM':           return routeGuru(user, () => tutupKBM(postData, user));
      case 'hapusKBM':           return routeGuru(user, () => hapusKBM(postData, user));
      case 'addMuridByGuru':     return routeGuru(user, () => addMuridByGuru(postData, user));
      case 'kirimPengumumanGuru':return routeGuru(user, () => kirimPengumumanGuru(postData, user));
      case 'changePassword':     return routeGuru(user, () => changePassword(postData, user));
      case 'saveNilaiManualBatch': return routeGuru(user, () => saveNilaiManualBatch(postData, user));
      case 'simpanFollowupKeaktifan': return routeGuru(user, () => simpanFollowupKeaktifan(postData, user));

      case 'saveAssessmentMurid':    return routeMurid(user, () => saveAssessmentMurid(postData, user));

      // ── Murid ──
      case 'updateProfilMurid':      return routeMurid(user, () => updateProfilMurid(postData, user));

      default:
        return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action }, 400);
    }

  } catch (err) {
    logError('doPost', err);
    return jsonResponse({ status: 'error', message: err.message }, 500);
  }
}


// ─────────────────────────────────────────────
//  AUTENTIKASI & TOKEN
// ─────────────────────────────────────────────

/**
 * Login berbasis NIS (id_user) santri.
 * Di produksi, gunakan Google OAuth / PropertiesService untuk session.
 */
function handleLogin(params) {
  const nis      = (params.nis      || '').trim();
  const password = (params.password || '').trim();
  if (!nis) return jsonResponse({ status: 'error', message: 'NIS wajib diisi' });

  const sheet = getSheet(CONFIG.SHEET.USERS);
  const rows  = sheetToObjects(sheet);
  const user  = rows.find(r => r.id_user === nis && r.status === 'aktif');

  if (!user) {
    return jsonResponse({ status: 'error', message: 'NIS tidak ditemukan atau akun nonaktif' });
  }

  // Verifikasi password jika sudah diset
  if (user.password && user.password.toString().trim() !== '') {
    if (!password) {
      return jsonResponse({ status: 'error', message: 'Password wajib diisi' });
    }
    if (user.password.toString().trim() !== password) {
      return jsonResponse({ status: 'error', message: 'Password salah' });
    }
  }

  // Buat token dari id_user + timestamp
  const token = generateToken(user.id_user);

  // Simpan token ke PropertiesService (session store)
  const store = PropertiesService.getScriptProperties();
  store.setProperty('token_' + token, JSON.stringify({
    id_user : user.id_user,
    role    : user.role,
    nama    : user.nama_lengkap,
    exp     : Date.now() + (8 * 60 * 60 * 1000) // 8 jam
  }));

  return jsonResponse({
    status : 'ok',
    token  : token,
    user   : {
      id_user : user.id_user,
      nama    : user.nama_lengkap,
      role    : user.role,
    }
  });
}

/**
 * Verifikasi token dari PropertiesService.
 * Kembalikan objek user jika valid, null jika tidak.
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const store   = PropertiesService.getScriptProperties();
    const raw     = store.getProperty('token_' + token);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.exp) {
      store.deleteProperty('token_' + token); // hapus expired
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

/**
 * Generate token unik berbasis id_user + timestamp.
 */
function generateToken(id) {
  const raw = id + Date.now() + Math.random();
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
  ).replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
}

/**
 * Ambil profil user yang sedang login.
 */
function getProfile(user) {
  const sheet = getSheet(CONFIG.SHEET.USERS);
  const rows  = sheetToObjects(sheet);
  const found = rows.find(r => r.id_user === user.id_user);
  if (!found) return { status: 'error', message: 'User tidak ditemukan' };
  delete found.password; // jangan kirim password
  delete found.email;    // tidak digunakan
  return { status: 'ok', data: found };
}


// ─────────────────────────────────────────────
//  ROUTE GUARD PER ROLE
// ─────────────────────────────────────────────

function _isAdmin(user) {
  return user && (user.role === CONFIG.ROLE.ADMIN || user.role === CONFIG.ROLE.SUPERADMIN);
}
function _isSuperAdmin(user) {
  return user && user.role === CONFIG.ROLE.SUPERADMIN;
}

// Admin biasa + superadmin bisa akses
function routeAdmin(user, fn) {
  if (!_isAdmin(user)) {
    return jsonResponse({ status: 'error', message: 'Akses ditolak: hanya Admin' }, 403);
  }
  return jsonResponse(fn());
}

// Hanya superadmin yang bisa akses (data sensitif)
function routeSuperAdmin(user, fn) {
  if (!_isSuperAdmin(user)) {
    return jsonResponse({ status: 'error', message: 'Akses ditolak: hanya Super Admin' }, 403);
  }
  return jsonResponse(fn());
}

function routeGuru(user, fn) {
  if (![CONFIG.ROLE.ADMIN, CONFIG.ROLE.SUPERADMIN, CONFIG.ROLE.GURU].includes(user.role)) {
    return jsonResponse({ status: 'error', message: 'Akses ditolak: hanya Guru atau Admin' }, 403);
  }
  return jsonResponse(fn());
}

// Assign / cabut ketua kelas — hanya superadmin
function assignKetuaKelas(data) {
  if (!data.id_anggota) return { status: 'error', message: 'id_anggota wajib diisi' };
  var shAnggota = getSheet(CONFIG.SHEET.ANGGOTA);
  var rows = sheetToObjects(shAnggota);
  var row  = rows.find(function(r) { return String(r.id_anggota).trim() === String(data.id_anggota).trim(); });
  if (!row) return { status: 'error', message: 'Anggota tidak ditemukan' };

  // Jika assign=true, pastikan tidak ada ketua lain di halaqah yang sama
  if (data.assign === true || data.assign === 'true') {
    rows.filter(function(r) {
      return String(r.id_halaqah).trim() === String(row.id_halaqah).trim() &&
             String(r.is_ketua).toLowerCase() === 'true' &&
             String(r.id_anggota).trim() !== String(data.id_anggota).trim();
    }).forEach(function(r) {
      updateRowWhere(shAnggota, 'id_anggota', r.id_anggota, { is_ketua: '' });
    });
    updateRowWhere(shAnggota, 'id_anggota', data.id_anggota, { is_ketua: 'TRUE' });
    return { status: 'ok', message: 'Ketua kelas berhasil ditunjuk' };
  } else {
    updateRowWhere(shAnggota, 'id_anggota', data.id_anggota, { is_ketua: '' });
    return { status: 'ok', message: 'Status ketua kelas berhasil dicabut' };
  }
}

function routeMurid(user, fn) {
  return jsonResponse(fn());
}

// Ketua kelas — harus murid dengan is_ketua=true
function routeKetua(user, fn) {
  if (!user) return jsonResponse({ status: 'error', message: 'Unauthorized' }, 401);
  const anggota = sheetToObjects(getSheet(CONFIG.SHEET.ANGGOTA))
    .find(function(a) {
      return String(a.id_murid).trim() === String(user.id_user).trim() &&
             a.status === 'aktif' &&
             String(a.is_ketua).toLowerCase() === 'true';
    });
  if (!anggota) return jsonResponse({ status: 'error', message: 'Akses ditolak: bukan ketua kelas' }, 403);
  return jsonResponse(fn(anggota));
}

// ─────────────────────────────────────────────
//  HELPER: SHEETS
// ─────────────────────────────────────────────

/**
 * Ambil object Sheet berdasarkan nama tab.
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" tidak ditemukan');
  return sh;
}

/**
 * Konversi data Sheet menjadi array of objects.
 * Baris pertama dianggap header.
 */
function sheetToObjects(sheet) {
  const data    = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());

  // Kolom yang harus jadi string tanggal yyyy-MM-dd
  const DATE_COLS = ['tanggal_pertemuan','tgl_bergabung','tgl_daftar','tgl_dibuat','timestamp','timestamp_dibuat'];
  // Kolom yang harus jadi string jam HH:mm
  const TIME_COLS = ['jam_mulai','jam_selesai'];

  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      if (DATE_COLS.includes(h)) {
        // Date object atau string ISO → yyyy-MM-dd
        if (v instanceof Date) {
          v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
        } else {
          v = String(v || '').substring(0, 10);
        }
      } else if (TIME_COLS.includes(h)) {
        // Angka desimal Sheets (0.5 = 12:00) atau Date object → HH:mm
        if (typeof v === 'number') {
          const totalMin = Math.round(v * 24 * 60);
          const hh = Math.floor(totalMin / 60) % 24;
          const mm = totalMin % 60;
          v = String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
        } else if (v instanceof Date) {
          v = Utilities.formatDate(v, TZ, 'HH:mm');
        } else {
          const s = String(v || '');
          v = s.length >= 5 ? s.substring(0, 5) : s;
        }
      }
      obj[h] = v;
    });
    return obj;
  });
}

/**
 * Parse any date cell value (Date object, string in ISO, or Indonesian format) safely.
 */
function _parseDateSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (!s) return null;
  
  // Try standard parse
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  
  // Parse Indonesian DD/MM/YYYY or DD-MM-YYYY format
  const parts = s.split(/[\-\/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) { // e.g. 30/05/2026 -> day=30, month=05, year=2026
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    if (parts[0].length === 4) { // e.g. 2026/05/30
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}


/**
 * Baca N baris terakhir dari sheet (dari bawah ke atas).
 * Jauh lebih cepat untuk sheet besar.
 * @param {Sheet} sheet
 * @param {number} limit  Jumlah baris yang diambil (default 40)
 * @param {number} extra  Baris tambahan untuk "load more" (default 0)
 */
function sheetToObjectsLimited(sheet, limit, extra) {
  limit = limit || 40;
  extra = extra || 0;
  const take   = limit + extra;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const numCols  = sheet.getLastColumn();
  const headers  = sheet.getRange(1, 1, 1, numCols).getValues()[0]
    .map(h => String(h).trim());

  // Ambil dari bawah sejumlah 'take' baris
  const startRow = Math.max(2, lastRow - take + 1);
  const numRows  = lastRow - startRow + 1;
  const data     = sheet.getRange(startRow, 1, numRows, numCols).getValues();

  const DATE_COLS = ['tanggal_pertemuan','tgl_bergabung','tgl_daftar','tgl_dibuat','timestamp','timestamp_dibuat'];
  const TIME_COLS = ['jam_mulai','jam_selesai'];

  const rows = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      if (DATE_COLS.includes(h)) {
        v = v instanceof Date
          ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd')
          : String(v || '').substring(0, 10);
      } else if (TIME_COLS.includes(h)) {
        if (typeof v === 'number') {
          const totalMin = Math.round(v * 24 * 60);
          const hh = Math.floor(totalMin / 60) % 24;
          const mm = totalMin % 60;
          v = String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
        } else if (v instanceof Date) {
          v = Utilities.formatDate(v, TZ, 'HH:mm');
        } else {
          const s = String(v || '');
          v = s.length >= 5 ? s.substring(0, 5) : s;
        }
      }
      obj[h] = v;
    });
    return obj;
  });

  // Kembalikan urutan terbaru dulu (reverse)
  return rows.reverse();
}


/**
 * Ambil hanya field tertentu dari object — kompres response
 * @param {Object} obj
 * @param {string[]} fields
 */
function pickFields(obj, fields) {
  const out = {};
  fields.forEach(f => { if (obj[f] !== undefined) out[f] = obj[f]; });
  return out;
}

/**
 * Map array of objects, ambil hanya field tertentu
 */
function pickFieldsMap(arr, fields) {
  return arr.map(obj => pickFields(obj, fields));
}

/**
 * Tambah baris baru ke sheet berdasarkan header yang ada.
 */
function appendRow(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row     = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

/**
 * Update baris tertentu berdasarkan nilai kolom key.
 * Contoh: updateRowWhere(sheet, 'id_user', 'U001', { nama_lengkap: 'Budi' })
 */
function updateRowWhere(sheet, keyCol, keyVal, newData) {
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const keyIdx  = headers.indexOf(keyCol);
  if (keyIdx < 0) throw new Error('Kolom ' + keyCol + ' tidak ditemukan');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      Object.keys(newData).forEach(col => {
        const cIdx = headers.indexOf(col);
        if (cIdx >= 0) sheet.getRange(i + 1, cIdx + 1).setValue(newData[col]);
      });
      return true;
    }
  }
  return false; // tidak ditemukan
}

/**
 * Hapus baris (soft delete: ubah status = 'nonaktif').
 */
function softDeleteRow(sheet, keyCol, keyVal) {
  return updateRowWhere(sheet, keyCol, keyVal, { status: 'nonaktif' });
}

/**
 * Generate ID unik dengan prefix.
 * Contoh: generateId('USR') → 'USR-20250517-0012'
 */
function generateId(prefix) {
  const now    = new Date();
  const date   = Utilities.formatDate(now, TZ, 'yyyyMMdd');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return prefix + '-' + date + '-' + random;
}

/**
 * Format tanggal ke 'dd MMM yyyy'.
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Utilities.formatDate(d, TZ, 'dd MMM yyyy');
}

/**
 * Dapatkan timestamp sekarang (string ISO).
 */
function nowISO() {
  // Format: yyyy-MM-dd HH:mm (WIB/zona lokal)
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
}


// ─────────────────────────────────────────────
//  HELPER: HTTP RESPONSE
// ─────────────────────────────────────────────

/**
 * Kembalikan ContentService JSON dengan CORS header.
 * Catatan: GAS tidak mendukung custom status code — semua 200.
 * Gunakan field "status" dalam body untuk error handling di frontend.
 */
function jsonResponse(obj, _httpCode) {
  const payload = typeof obj === 'object' ? obj : { status: 'ok', data: obj };
  if (!payload.status) payload.status = 'ok';
  payload._api = CONFIG.API_VERSION;
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


// ─────────────────────────────────────────────
//  HELPER: LOGGING & AUDIT
// ─────────────────────────────────────────────

/**
 * Catat error ke console GAS (bisa dilihat di Executions).
 */
function logError(context, err) {
  console.error('[ERROR][' + context + '] ' + err.message);
}

/**
 * Tulis audit log ke sheet Pengumuman (atau bisa buat sheet AuditLog terpisah).
 */
function writeAuditLog(userId, action, detail) {
  try {
    const sheet = getSheet(CONFIG.SHEET.PENGUMUMAN);
    // Untuk audit log, idealnya buat sheet AuditLog tersendiri
    // Di sini disederhanakan menggunakan Logger
    console.log('[AUDIT] ' + userId + ' | ' + action + ' | ' + JSON.stringify(detail));
  } catch (_) {}
}


// ─────────────────────────────────────────────
//  PENGUMUMAN (shared, semua role bisa baca)
// ─────────────────────────────────────────────

function getPengumuman() {
  const sheet = getSheet(CONFIG.SHEET.PENGUMUMAN);
  const rows  = sheetToObjects(sheet).filter(r => r.status === 'aktif');
  rows.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  return { status: 'ok', data: rows.slice(0, 10) };
}


// ─────────────────────────────────────────────
//  INISIALISASI SPREADSHEET (jalankan sekali)
// ─────────────────────────────────────────────

/**
 * Jalankan fungsi ini SATU KALI dari editor GAS untuk membuat
 * semua sheet dengan header yang benar.
 * Menu: Run → initSpreadsheet
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Set spreadsheet timezone to WIB (Asia/Jakarta)
  ss.setSpreadsheetTimeZone(TZ);

  const schemas = {
    [CONFIG.SHEET.USERS]: [
      'id_user','nama_lengkap','role','no_hp',
      'email','alamat','tgl_daftar','status','password','catatan',
      'nama_guru','nama_halaqah'
    ],
    [CONFIG.SHEET.HALAQAH]: [
      'id_halaqah','nama_halaqah','id_guru','nama_guru',
      'level','jadwal_hari','jam_mulai','jam_selesai',
      'lokasi','kurikulum','status','tgl_dibuat'
    ],
    [CONFIG.SHEET.ANGGOTA]: [
      'id_anggota','id_halaqah','id_murid','nama_murid',
      'tgl_bergabung','level','target_level','total_hadir',
      'status','catatan_guru'
    ],
    [CONFIG.SHEET.KBM_LOG]: [
      'id_kbm','id_halaqah','id_guru','nama_guru',
      'tanggal_pertemuan','jam_mulai','jam_selesai',
      'pertemuan_ke','jenis_sesi','pencapaian_modul',
      'metode','catatan_umum',
      'latihan_mandiri','jenis_latihan','deadline_latihan',
      'jumlah_hadir','jumlah_alpa',
      'status','timestamp_dibuat'
    ],
    [CONFIG.SHEET.NILAI_KBM]: [
      'id_nilai','id_kbm','id_halaqah','id_murid','nama_murid',
      'status_hadir','nilai','adab','koreksi_tahsin',
      'catatan_murid','kamera_murid','timestamp'
    ],
    [CONFIG.SHEET.LEVEL]: [
      'id_level','nama_level','urutan','deskripsi',
      'jumlah_pertemuan','status'
    ],
    [CONFIG.SHEET.PERIODE]: [
      'id_periode','nama_periode','tanggal_mulai','tanggal_selesai',
      'deskripsi','status','timestamp'
    ],
    [CONFIG.SHEET.KOMPONEN_RAPORT]: [
      'id_komponen','id_periode','nama_komponen','bobot',
      'tipe','urutan','status'
    ],
    [CONFIG.SHEET.NILAI_MANUAL]: [
      'id_nilai_manual','id_murid','id_halaqah','id_periode',
      'id_komponen','nama_komponen','nilai','catatan','timestamp'
    ],
    [CONFIG.SHEET.RAPORT]: [
      'id_raport','id_murid','id_periode','id_halaqah',
      'nilai_akhir','predikat','detail_json',
      'tanggal_cetak','status','url_pdf'
    ],
    [CONFIG.SHEET.AUDIT_LOG]: [
      'id_log','user_id','action','detail','timestamp'
    ],
    'Template_Koreksi': [
      'id_template','kategori','teks','urutan','status'
    ],
    [CONFIG.SHEET.PENGUMUMAN]: [
      'id_pengumuman','judul','isi','target_role',
      'dibuat_oleh','tanggal','status'
    ],
  };

  Object.entries(schemas).forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      console.log('Sheet dibuat: ' + name);
    }
    // Set header jika sheet kosong
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length)
        .setBackground('#1a6fc4')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      console.log('Header ditambahkan ke: ' + name);
    }
  });

  // Seed 1 akun admin default
  const userSheet = ss.getSheetByName(CONFIG.SHEET.USERS);
  if (userSheet.getLastRow() === 1) {
    userSheet.appendRow([
      'USR-ADMIN-001', 'Administrator', 'admin', '08100000000', '-', '-', '-',
      formatDate(new Date()), 'aktif', '', 'Akun admin default'
    ]);
    console.log('Akun admin default dibuat.');
  }

  // Seed data level default
  const levelSheet = ss.getSheetByName(CONFIG.SHEET.LEVEL);
  if (levelSheet && levelSheet.getLastRow() === 1) {
    const levels = [
      ['LVL-001','Level 1',1,'Dasar Makharijul Huruf','40','aktif'],
      ['LVL-002','Level 2',2,'Tajwid Dasar','40','aktif'],
      ['LVL-003','Level 3',3,'Tajwid Lanjutan','40','aktif'],
      ['LVL-004','Level 4',4,'Tartil Al-Quran','40','aktif'],
      ['LVL-005','Level Qiyam',5,'Qiyamul Lail & Murajaah','40','aktif'],
    ];
    levels.forEach(row => levelSheet.appendRow(row));
    console.log('Data level default ditambahkan.');
  }

  console.log('Inisialisasi selesai!');
  SpreadsheetApp.getUi().alert('✅ Inisialisasi berhasil! Semua sheet siap digunakan.');
}

/**
 * Hapus baris permanen (hard delete) berdasarkan kecocokan kolom key.
 */
function deleteRowsWhere(sheet, keyCol, keyVal) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx < 0) return false;

  let deleted = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      sheet.deleteRow(i + 1);
      deleted = true;
    }
  }
  return deleted;
}