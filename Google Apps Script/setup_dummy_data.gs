// ============================================================
//  setup_dummy_data.gs - Seed data untuk testing menyeluruh
//  Jalankan seedAllData() untuk reset + isi semua data
//  Jalankan seedKBMOnly() jika hanya ingin seed KBM + nilai
//  Jalankan seedAtTibyanOnly() untuk seed At-Tibyan saja
//  WARNING: Akan menghapus dan mengisi ulang semua sheet terkait
// ============================================================

// ID komponen yang dipakai di seed (konsisten antara seedKomponenRaport dan seedNilaiManual)
var KMP = {
  KBM_HARIAN : 'KMP-SEED-001',  // 40% otomatis
  KEHADIRAN  : 'KMP-SEED-002',  // 20% otomatis
  ADAB       : 'KMP-SEED-003',  // 10% otomatis
  MICRO      : 'KMP-SEED-004',  // 15% manual
  UAS        : 'KMP-SEED-005',  // 15% manual
};

/**
 * Master seed - jalankan fungsi ini untuk setup lengkap.
 * Urutan: Periode -> Halaqah -> Users -> Anggota ->
 *         KomponenRaport -> Catatan -> KBM -> AtTibyan ->
 *         NilaiManual -> Pengumuman -> clear Raport
 */
function seedAllData() {
  seedPeriode();
  seedHalaqah();
  seedUsers();
  seedAnggota();
  seedKomponenRaport();
  seedCatatanRaport();
  seedKBMData();
  seedAtTibyanData();
  seedNilaiManual();
  seedPengumuman();
  clearRaportSheet();
  Logger.log('SEED SELESAI - semua data testing sudah siap.');
  Browser.msgBox('Seed selesai! Cek semua sheet di spreadsheet.\nJalankan raportGenerate() dari portal guru untuk test generate raport.');
}

function seedKBMOnly() {
  seedKBMData();
  Logger.log('KBM seed selesai.');
}

/**
 * Tambahkan kolom nama_guru dan nama_halaqah ke sheet Users.
 * Jalankan SEKALI: setupUsersColumns()
 * Setelah itu jalankan backfillUsersColumns() untuk isi data lama.
 */
function setupUsersColumns() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.USERS);
  if (!sh) { Browser.msgBox('Sheet Users tidak ditemukan.'); return; }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colNames = headers.map(function(h) { return String(h).trim().toLowerCase(); });
  var added = [];

  if (colNames.indexOf('nama_guru') === -1) {
    var newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue('nama_guru')
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sh.setColumnWidth(newCol, 200);
    added.push('nama_guru');
  }
  if (colNames.indexOf('nama_halaqah') === -1) {
    var newCol2 = sh.getLastColumn() + 1;
    sh.getRange(1, newCol2).setValue('nama_halaqah')
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sh.setColumnWidth(newCol2, 180);
    added.push('nama_halaqah');
  }

  if (added.length === 0) {
    Browser.msgBox('Kolom nama_guru dan nama_halaqah sudah ada. Tidak perlu ditambahkan.');
  } else {
    Browser.msgBox('Kolom ' + added.join(' dan ') + ' berhasil ditambahkan ke Users!\nJalankan backfillUsersColumns() untuk mengisi data lama.');
  }
}

/**
 * Backfill nama_guru dan nama_halaqah untuk murid di sheet Users.
 * Cocokkan berdasarkan Anggota -> Halaqah -> Users(guru).
 */
function backfillUsersColumns() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var shUsers = ss.getSheetByName(CONFIG.SHEET.USERS);
  var shAnggota = ss.getSheetByName(CONFIG.SHEET.ANGGOTA);
  var shHalaqah = ss.getSheetByName(CONFIG.SHEET.HALAQAH);
  var shUsersGuru = shUsers; // sama sheet

  if (!shUsers || !shAnggota || !shHalaqah) {
    Browser.msgBox('Sheet tidak ditemukan.'); return;
  }

  // Build map: id_halaqah -> { nama_halaqah, id_guru }
  var halaqahRows = sheetToObjects(shHalaqah);
  var halaqahMap = {};
  halaqahRows.forEach(function(h) {
    halaqahMap[String(h.id_halaqah).trim()] = {
      nama_halaqah: h.nama_halaqah || '',
      id_guru: String(h.id_guru || '').trim()
    };
  });

  // Build map: id_murid -> id_halaqah (dari Anggota, ambil yang aktif)
  var anggotaRows = sheetToObjects(shAnggota);
  var muridHalaqah = {};
  anggotaRows.filter(function(a) { return a.status === 'aktif'; })
    .forEach(function(a) {
      muridHalaqah[String(a.id_murid).trim()] = String(a.id_halaqah || '').trim();
    });

  // Build map: id_guru -> nama_lengkap
  var usersRows = sheetToObjects(shUsers);
  var guruNama = {};
  usersRows.filter(function(u) { return u.role === 'guru'; })
    .forEach(function(u) { guruNama[String(u.id_user).trim()] = u.nama_lengkap || ''; });

  // Update sheet Users
  var userData = shUsers.getDataRange().getValues();
  var headers = userData[0].map(function(h) { return String(h).trim(); });
  var idUserCol = headers.indexOf('id_user');
  var roleCol = headers.indexOf('role');
  var namaGuruCol = headers.indexOf('nama_guru');
  var namaHalaqahCol = headers.indexOf('nama_halaqah');

  if (namaGuruCol === -1 || namaHalaqahCol === -1) {
    Browser.msgBox('Kolom nama_guru atau nama_halaqah tidak ditemukan. Jalankan setupUsersColumns() dulu.');
    return;
  }

  var updated = 0;
  for (var i = 1; i < userData.length; i++) {
    var role = String(userData[i][roleCol] || '').trim();
    if (role !== 'murid') continue;
    var idMurid = String(userData[i][idUserCol] || '').trim();
    var idHalaqah = muridHalaqah[idMurid] || '';
    if (!idHalaqah) continue;
    var hqInfo = halaqahMap[idHalaqah] || {};
    var namaGuru = guruNama[hqInfo.id_guru] || '';
    var namaHalaqah = hqInfo.nama_halaqah || '';
    if (namaGuru || namaHalaqah) {
      shUsers.getRange(i + 1, namaGuruCol + 1).setValue(namaGuru);
      shUsers.getRange(i + 1, namaHalaqahCol + 1).setValue(namaHalaqah);
      updated++;
    }
  }

  Logger.log('Backfill Users selesai: ' + updated + ' murid diupdate.');
  Browser.msgBox('Backfill selesai!\n' + updated + ' murid berhasil diisi nama_guru dan nama_halaqah.');
}

/**
 * Tambahkan kolom id_guru ke sheet KBM_Log jika belum ada.
 * Jalankan SEKALI dari GAS Editor: setupKBMLogIdGuru()
 * Aman dijalankan berulang - tidak menghapus data.
 */
function setupKBMLogIdGuru() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.KBM_LOG);
  if (!sh) { Browser.msgBox('Sheet KBM_Log tidak ditemukan.'); return; }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colNames = headers.map(function(h) { return String(h).trim().toLowerCase(); });

  if (colNames.indexOf('id_guru') !== -1) {
    Browser.msgBox('Kolom id_guru sudah ada di KBM_Log. Tidak perlu ditambahkan lagi.');
    return;
  }

  // Tambahkan kolom id_guru di posisi ke-3 (setelah id_kbm dan id_halaqah)
  // agar konsisten dengan struktur yang diharapkan
  var insertPos = 3; // kolom C
  sh.insertColumnBefore(insertPos);
  sh.getRange(1, insertPos).setValue('id_guru');
  sh.getRange(1, insertPos)
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff');

  Logger.log('Kolom id_guru berhasil ditambahkan di kolom ' + insertPos + '.');
  Browser.msgBox(
    'Kolom id_guru berhasil ditambahkan ke KBM_Log!\n\n' +
    'Catatan: Data lama tidak punya nilai id_guru.\n' +
    'Sesi baru yang dibuat via portal akan otomatis terisi.\n\n' +
    'Untuk backfill data lama, jalankan fungsi backfillKBMLogIdGuru().'
  );
}

/**
 * Backfill id_guru di baris KBM_Log yang kosong.
 * Cocokkan berdasarkan id_halaqah -> cari guru di sheet Halaqah.
 * Jalankan setelah setupKBMLogIdGuru().
 */
/**
 * Tambahkan kolom halaman_modul ke sheet KBM_Log jika belum ada.
 * Jalankan SEKALI: setupKBMLogHalamanModul()
 */
function setupKBMLogHalamanModul() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.KBM_LOG);
  if (!sh) { Browser.msgBox('Sheet KBM_Log tidak ditemukan.'); return; }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colNames = headers.map(function(h) { return String(h).trim().toLowerCase(); });

  if (colNames.indexOf('halaman_modul') !== -1) {
    Browser.msgBox('Kolom halaman_modul sudah ada. Tidak perlu ditambahkan lagi.');
    return;
  }

  // Tambahkan setelah materi_belajar atau pencapaian_modul
  var insertAfter = colNames.indexOf('materi_belajar');
  if (insertAfter === -1) insertAfter = colNames.indexOf('pencapaian_modul');
  var insertPos = insertAfter !== -1 ? insertAfter + 2 : sh.getLastColumn() + 1;

  sh.insertColumnAfter(insertAfter !== -1 ? insertAfter + 1 : sh.getLastColumn());
  sh.getRange(1, insertPos).setValue('halaman_modul')
    .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
  sh.setColumnWidth(insertPos, 160);

  Logger.log('Kolom halaman_modul berhasil ditambahkan di kolom ' + insertPos + '.');
  Browser.msgBox('Kolom halaman_modul berhasil ditambahkan ke KBM_Log!');
}

function backfillKBMLogIdGuru() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var shKBM = ss.getSheetByName(CONFIG.SHEET.KBM_LOG);
  var shHalaqah = ss.getSheetByName(CONFIG.SHEET.HALAQAH);
  if (!shKBM || !shHalaqah) { Browser.msgBox('Sheet tidak ditemukan.'); return; }

  // Build map halaqah -> id_guru
  var halaqahRows = sheetToObjects(shHalaqah);
  var halaqahMap = {};
  halaqahRows.forEach(function(h) {
    halaqahMap[String(h.id_halaqah).trim()] = String(h.id_guru || '').trim();
  });

  var kbmData = shKBM.getDataRange().getValues();
  var headers = kbmData[0].map(function(h) { return String(h).trim(); });
  var idGuruCol = headers.indexOf('id_guru');
  var idHalaqahCol = headers.indexOf('id_halaqah');

  if (idGuruCol === -1) { Browser.msgBox('Kolom id_guru tidak ditemukan. Jalankan setupKBMLogIdGuru() dulu.'); return; }

  var updated = 0;
  for (var i = 1; i < kbmData.length; i++) {
    if (!kbmData[i][idGuruCol]) {
      var idHalaqah = String(kbmData[i][idHalaqahCol] || '').trim();
      var idGuru = halaqahMap[idHalaqah] || '';
      if (idGuru) {
        shKBM.getRange(i + 1, idGuruCol + 1).setValue(idGuru);
        updated++;
      }
    }
  }

  Logger.log('Backfill selesai: ' + updated + ' baris diupdate.');
  Browser.msgBox('Backfill id_guru selesai!\n' + updated + ' baris diupdate dari ' + (kbmData.length - 1) + ' total baris.');
}

function seedAtTibyanOnly() {
  seedAtTibyanData();
  Logger.log('At-Tibyan seed selesai.');
}

// ============================================================
//  DATA MASTER
// ============================================================

var GURU_DATA = [
  { id:'UMAR',    nama:'Al-Ustadz Umar Abdul Aziz',           no_hp:'082316993233', pass:'654321' },
  { id:'NISA',    nama:'Al-Ustadzah Annisa Rizkya Rahmawati', no_hp:'08123456789',  pass:'654321' },
  { id:'ISMI',    nama:'Al-Ustadzah Ismi Fitrianingsih',      no_hp:'08234567890',  pass:'654321' },
  { id:'ULUM',    nama:'Al-Ustadzah Nurul Hidayatul Ulum',    no_hp:'08345678901',  pass:'654321' },
  { id:'ADISSA',  nama:'Al-Ustadzah Adissa Fitria Alkautsar', no_hp:'08456789012',  pass:'654321' },
  { id:'RAHMIZA', nama:'Al-Ustadzah Aulia Rahmiza',           no_hp:'08567890123',  pass:'654321' },
];

var HALAQAH_DATA = [
  { id:'HQ-MARYAM',   nama:'Maryam',   level:'Level 1', id_guru:'NISA',   jadwal:'Rabu Jumat',   jam_mulai:'15:00', jam_selesai:'16:30', id_periode:'P2026-1' },
  { id:'HQ-ASMA',     nama:'Asma',     level:'Level 1', id_guru:'ISMI',   jadwal:'Rabu Jumat',   jam_mulai:'18:30', jam_selesai:'20:00', id_periode:'P2026-1' },
  { id:'HQ-RUMAYSHO', nama:'Rumaysho', level:'Level 1', id_guru:'ADISSA', jadwal:'Rabu Jumat',   jam_mulai:'19:30', jam_selesai:'21:00', id_periode:'P2026-1' },
  { id:'HQ-SAHLAH',   nama:'Sahlah',   level:'Level 1', id_guru:'ADISSA', jadwal:'Selasa Kamis', jam_mulai:'08:00', jam_selesai:'09:30', id_periode:'P2026-1' },
  { id:'HQ-FATIMAH',  nama:'Fatimah',  level:'Level 1', id_guru:'ADISSA', jadwal:'Senin Rabu',   jam_mulai:'09:00', jam_selesai:'10:30', id_periode:'P2026-1' },
  { id:'HQ-KHADIJAH', nama:'Khadijah', level:'Level 1', id_guru:'ULUM',   jadwal:'Senin Kamis',  jam_mulai:'15:30', jam_selesai:'17:00', id_periode:'P2026-1' },
];

var MURID_DATA = [
  // Maryam - 11 murid (skenario keaktifan bervariasi)
  { id:'RTL24180250', nama:'Nur Lindatul Hidayah',    no_hp:'085184624062', halaqah:'HQ-MARYAM' },
  { id:'RTL24180251', nama:'Mitha Afril Yani',         no_hp:'081549171617', halaqah:'HQ-MARYAM' },
  { id:'RTL24180252', nama:'Himaya',                   no_hp:'08170441080',  halaqah:'HQ-MARYAM' },
  { id:'RTL24180253', nama:'Vidyah Nawang Sari',       no_hp:'085787614715', halaqah:'HQ-MARYAM' },
  { id:'RTL24180254', nama:'Camelia Santika',          no_hp:'082149624840', halaqah:'HQ-MARYAM' },
  { id:'RTL24180255', nama:'Afifah',                   no_hp:'085640354396', halaqah:'HQ-MARYAM' },
  { id:'RTL24180257', nama:'Irma Istarizkizra',        no_hp:'081387470744', halaqah:'HQ-MARYAM' },
  { id:'RTL24180258', nama:'Shinta Mandasari',         no_hp:'081232598036', halaqah:'HQ-MARYAM' },
  { id:'RTL24180260', nama:'Uray Aurel Maylaf Islam',  no_hp:'089517356889', halaqah:'HQ-MARYAM' },
  { id:'RTL24180261', nama:'Sri Ayuni',                no_hp:'083827589918', halaqah:'HQ-MARYAM' },
  { id:'RTL24180106', nama:'Shinta Mandasari 2',       no_hp:'081232598037', halaqah:'HQ-MARYAM' },
  // Asma - 5 murid
  { id:'RTL24180262', nama:'Tyas Cindi Aulia',         no_hp:'085755633986', halaqah:'HQ-ASMA' },
  { id:'RTL24180263', nama:'Aulia Manik',              no_hp:'089532864658', halaqah:'HQ-ASMA' },
  { id:'RTL24180264', nama:'Sayyidah Fatimatuz Zahro', no_hp:'082335698687', halaqah:'HQ-ASMA' },
  { id:'RTL24180265', nama:'Annisa',                   no_hp:'082259606370', halaqah:'HQ-ASMA' },
  { id:'RTL24180266', nama:'Safana Hani Hamidah',      no_hp:'081288319938', halaqah:'HQ-ASMA' },
  // Khadijah - 5 murid
  { id:'RTL24180310', nama:'Sri Bulan Harahap',        no_hp:'081199997735', halaqah:'HQ-KHADIJAH' },
  { id:'RTL24180311', nama:'Yuni Putri Pratama',       no_hp:'087760447846', halaqah:'HQ-KHADIJAH' },
  { id:'RTL24180312', nama:'Neng Chandra',             no_hp:'081225796652', halaqah:'HQ-KHADIJAH' },
  { id:'RTL24180313', nama:'Irma Marsitah',            no_hp:'089693729507', halaqah:'HQ-KHADIJAH' },
  { id:'RTL24180314', nama:'Fitria Rahma',             no_hp:'082382891626', halaqah:'HQ-KHADIJAH' },
];

// ============================================================
//  SEED PERIODE
// ============================================================
function seedPeriode() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.PERIODE);
  if (!sh) { Logger.log('Sheet Periode tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  appendRow(sh, {
    id_periode     : 'P2026-1',
    nama_periode   : 'Semester 1 2026',
    tanggal_mulai  : '2026-01-01',
    tanggal_selesai: '2026-06-30',
    deskripsi      : 'Periode testing untuk semua skenario',
    status         : 'aktif',
    timestamp      : nowISO(),
  });
  Logger.log('Periode: 1 periode aktif ditambahkan.');
}

// ============================================================
//  SEED HALAQAH
// ============================================================
function seedHalaqah() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.HALAQAH);
  if (!sh) { Logger.log('Sheet Halaqah tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var guruMap = {};
  GURU_DATA.forEach(function(g) { guruMap[g.id] = g.nama; });

  HALAQAH_DATA.forEach(function(h) {
    appendRow(sh, {
      id_halaqah  : h.id,
      nama_halaqah: h.nama,
      id_guru     : h.id_guru,
      nama_guru   : guruMap[h.id_guru] || '',
      level       : h.level,
      jadwal_hari : h.jadwal,
      jam_mulai   : h.jam_mulai,
      jam_selesai : h.jam_selesai,
      lokasi      : 'Online (Zoom)',
      kurikulum   : h.level,
      id_periode  : h.id_periode || 'P2026-1',
      status      : 'aktif',
      tgl_dibuat  : today,
    });
  });
  Logger.log('Halaqah: ' + HALAQAH_DATA.length + ' halaqah ditambahkan.');
}

// ============================================================
//  SEED USERS
// ============================================================
function seedUsers() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.USERS);
  if (!sh) { Logger.log('Sheet Users tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  // Admin
  appendRow(sh, {
    id_user:'ADMIN-001', nama_lengkap:'Administrator', role:'admin',
    no_hp:'081111111111', email:'admin@rattililquran.id',
    alamat:'', tgl_daftar:today, status:'aktif', password:'admin123', catatan:'Akun admin utama',
  });

  // Guru
  GURU_DATA.forEach(function(g) {
    appendRow(sh, {
      id_user:g.id, nama_lengkap:g.nama, role:'guru',
      no_hp:g.no_hp, email:'', alamat:'',
      tgl_daftar:today, status:'aktif', password:g.pass, catatan:'',
    });
  });

  // Murid
  var halaqahNamaMap = {};
  HALAQAH_DATA.forEach(function(h) { halaqahNamaMap[h.id] = h.nama; });
  var halaqahGuruMap = {};
  HALAQAH_DATA.forEach(function(h) { halaqahGuruMap[h.id] = h.id_guru; });
  var guruNamaMap = {};
  GURU_DATA.forEach(function(g) { guruNamaMap[g.id] = g.nama; });

  MURID_DATA.forEach(function(m) {
    appendRow(sh, {
      id_user:m.id, nama_lengkap:m.nama, role:'murid',
      no_hp:m.no_hp, email:'', alamat:'',
      tgl_daftar:today, status:'aktif', password:'123456', catatan:'',
      nama_guru:guruNamaMap[halaqahGuruMap[m.halaqah]] || '',
      nama_halaqah:halaqahNamaMap[m.halaqah] || '',
    });
  });

  Logger.log('Users: 1 admin + ' + GURU_DATA.length + ' guru + ' + MURID_DATA.length + ' murid.');
}

// ============================================================
//  SEED ANGGOTA
// ============================================================
function seedAnggota() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.ANGGOTA);
  if (!sh) { Logger.log('Sheet Anggota tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var halaqahLevelMap = {};
  HALAQAH_DATA.forEach(function(h) { halaqahLevelMap[h.id] = h.level; });

  MURID_DATA.forEach(function(m) {
    appendRow(sh, {
      id_anggota   : generateId('ANG'),
      id_halaqah   : m.halaqah,
      id_murid     : m.id,
      nama_murid   : m.nama,
      tgl_bergabung: today,
      level        : halaqahLevelMap[m.halaqah] || 'Level 1',
      target_level : 'Level 2',
      total_hadir  : 0,
      status       : 'aktif',
      catatan_guru : '',
      is_ketua     : '',  // diisi TRUE oleh admin untuk menunjuk ketua kelas
    });
  });
  Logger.log('Anggota: ' + MURID_DATA.length + ' murid terdaftar.');
}

// ============================================================
//  SETUP KOLOM IS_KETUA DI SHEET ANGGOTA YANG SUDAH ADA
//  Jalankan fungsi ini SEKALI jika sheet Anggota sudah ada
//  tapi belum punya kolom is_ketua.
//  Aman dijalankan berulang -- tidak menghapus data.
// ============================================================
function setupKetuaColumn() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.ANGGOTA);
  if (!sh) {
    Browser.msgBox('Sheet Anggota tidak ditemukan.');
    return;
  }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colNames = headers.map(function(h) { return String(h).trim().toLowerCase(); });

  // Cek apakah kolom is_ketua sudah ada
  if (colNames.indexOf('is_ketua') !== -1) {
    Browser.msgBox('Kolom is_ketua sudah ada di baris ' + (colNames.indexOf('is_ketua') + 1) + '. Tidak perlu ditambahkan lagi.');
    return;
  }

  // Tambahkan kolom is_ketua di sebelah kanan kolom terakhir
  var newCol = sh.getLastColumn() + 1;
  sh.getRange(1, newCol).setValue('is_ketua');
  sh.getRange(1, newCol)
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff');

  // Isi semua baris data dengan nilai kosong (FALSE by default)
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.getRange(2, newCol, lastRow - 1, 1).setValue('');
  }

  sh.setColumnWidth(newCol, 100);
  Logger.log('Kolom is_ketua berhasil ditambahkan di kolom ' + newCol + '.');
  Browser.msgBox(
    'Kolom is_ketua berhasil ditambahkan!\n\n' +
    'Cara menunjuk ketua kelas:\n' +
    '1. Buka sheet Anggota\n' +
    '2. Cari baris murid yang jadi ketua\n' +
    '3. Isi kolom is_ketua dengan: TRUE\n' +
    '4. Save spreadsheet'
  );
}

// ============================================================
//  SEED KOMPONEN RAPORT
//  5 komponen, total bobot = 100%
//  Menggunakan KMP.* constants agar seedNilaiManual bisa referensi ID yang sama
// ============================================================
function seedKomponenRaport() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.KOMPONEN_RAPORT);
  if (!sh) { Logger.log('Sheet Komponen_Raport tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var komponen = [
    { id:KMP.KBM_HARIAN, nama:'Nilai KBM Harian', bobot:40, tipe:'otomatis', urutan:1 },
    { id:KMP.KEHADIRAN,  nama:'Kehadiran',         bobot:20, tipe:'otomatis', urutan:2 },
    { id:KMP.ADAB,       nama:'Adab',              bobot:10, tipe:'otomatis', urutan:3 },
    { id:KMP.MICRO,      nama:'Micro Teaching',    bobot:15, tipe:'manual',   urutan:4 },
    { id:KMP.UAS,        nama:'UAS',               bobot:15, tipe:'manual',   urutan:5 },
  ];

  komponen.forEach(function(k) {
    appendRow(sh, {
      id_komponen  : k.id,
      id_periode   : 'P2026-1',
      nama_komponen: k.nama,
      bobot        : k.bobot,
      tipe         : k.tipe,
      urutan       : k.urutan,
      status       : 'aktif',
    });
  });
  var totalBobot = komponen.reduce(function(s, k) { return s + k.bobot; }, 0);
  Logger.log('Komponen_Raport: ' + komponen.length + ' komponen. Total bobot = ' + totalBobot + '%.');
}

// ============================================================
//  SEED CATATAN RAPORT PER HALAQAH
// ============================================================
function seedCatatanRaport() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.CATATAN_RAPORT);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET.CATATAN_RAPORT);
    sh.appendRow(['id_halaqah', 'nama_halaqah', 'catatan']);
    sh.getRange('A1:C1').setFontWeight('bold').setBackground('#065f46').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var catatan = [
    { id:'HQ-MARYAM',   nama:'Maryam',
      cat:"Alhamdulillah, perjalanan belajar Al-Qur'an semester ini berjalan dengan baik. " +
          "Murid-murid menunjukkan semangat dan kesungguhan dalam mengikuti setiap sesi KBM. " +
          "Semoga ilmu yang sudah dipelajari dapat diamalkan dan memberi manfaat. " +
          "Tetap semangat dan istiqomah dalam menjaga bacaan Al-Qur'an. Barakallahu fiikum." },
    { id:'HQ-ASMA',     nama:'Asma',
      cat:"Alhamdulillah, halaqah Asma semester ini berjalan lancar. " +
          "Murid menunjukkan perkembangan yang baik dalam penguasaan tajwid dasar. " +
          "Semoga terus istiqomah dan konsisten berlatih di rumah. Barakallahu fiikum." },
    { id:'HQ-KHADIJAH', nama:'Khadijah',
      cat:"Alhamdulillah, halaqah Khadijah semester ini penuh berkah. " +
          "Kehadiran murid sangat baik dan semangat belajar terus meningkat. " +
          "Semoga Allah mudahkan perjalanan belajar Al-Qur'an kita semua. Barakallahu fiikum." },
  ];

  catatan.forEach(function(c) {
    appendRow(sh, { id_halaqah: c.id, nama_halaqah: c.nama, catatan: c.cat });
  });
  Logger.log('Catatan_Raport: ' + catatan.length + ' catatan halaqah ditambahkan.');
}

// ============================================================
//  CLEAR RAPORT SHEET (hapus hasil generate lama agar fresh)
// ============================================================
function clearRaportSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.RAPORT);
  if (!sh) { Logger.log('Sheet Raport tidak ditemukan, skip.'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  Logger.log('Raport: sheet dibersihkan (siap generate via portal guru).');
}

// ============================================================
//  SEED KBM DATA (Log + Nilai)
//  Skenario testing:
//  - 12 sesi selesai (Des 2025 - Mei 2026, 2 per bulan)
//  - 1 sesi draft aktif (hari ini)
//  - Murid Himaya: 3x alpa -> KRITIS
//  - Murid Vidyah: 1x alpa -> PERINGATAN
//  - Murid Camelia: hadir semua -> NORMAL + bonus perfect attendance
//  - Variasi terlambat dan kamera untuk testing keaktifan
// ============================================================
function seedKBMData() {
  var ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var shKBM = ss.getSheetByName(CONFIG.SHEET.KBM_LOG);
  var shNilai = ss.getSheetByName(CONFIG.SHEET.NILAI_KBM);
  if (!shKBM || !shNilai) { Logger.log('Sheet KBM_Log atau Nilai_KBM tidak ditemukan'); return; }

  // Hapus data lama halaqah Maryam saja
  var kbmRows = sheetToObjects(shKBM);
  var nilaiRows = sheetToObjects(shNilai);
  var oldKbmIds = kbmRows.filter(function(k) { return k.id_halaqah === 'HQ-MARYAM'; }).map(function(k) { return k.id_kbm; });

  // Hapus semua dan buat ulang (lebih aman)
  if (shKBM.getLastRow() > 1)   shKBM.deleteRows(2, shKBM.getLastRow() - 1);
  if (shNilai.getLastRow() > 1) shNilai.deleteRows(2, shNilai.getLastRow() - 1);

  // Murid Maryam yang akan diberi data
  var muridMaryam = MURID_DATA.filter(function(m) { return m.halaqah === 'HQ-MARYAM'; });

  // Sesi tanggal (12 sesi: Des 2025 - Mei 2026)
  var sesiTanggal = [
    '2025-12-04', '2025-12-11',
    '2026-01-08', '2026-01-15',
    '2026-02-05', '2026-02-12',
    '2026-03-05', '2026-03-12',
    '2026-04-02', '2026-04-09',
    '2026-05-07', '2026-05-14',
  ];

  // Pola kehadiran per murid (index sesi 0-11)
  // H=Hadir, T=Terlambat, I=Izin, A=Alpa
  var POLA_HADIR = {
    'RTL24180250': ['H','H','H','T','H','H','H','H','T','H','H','H'],  // Normal, 2x terlambat
    'RTL24180251': ['H','H','H','H','H','H','H','H','H','H','H','H'],  // Perfect attendance
    'RTL24180252': ['H','A','H','A','H','H','A','H','H','H','H','H'],  // KRITIS 3x alpa
    'RTL24180253': ['H','H','H','H','A','H','H','H','H','H','H','H'],  // PERINGATAN 1x alpa
    'RTL24180254': ['H','H','H','H','H','H','H','H','H','H','H','H'],  // Perfect attendance
    'RTL24180255': ['H','H','T','H','H','H','T','H','H','T','H','H'],  // 3x terlambat
    'RTL24180257': ['H','H','H','H','H','I','H','H','H','H','H','H'],  // 1x izin
    'RTL24180258': ['H','H','H','H','H','H','H','H','H','H','H','H'],  // Normal
    'RTL24180260': ['A','H','H','A','H','H','H','H','H','H','H','H'],  // KRITIS 2x alpa
    'RTL24180261': ['H','H','H','H','H','H','H','T','H','H','H','H'],  // 1x terlambat
    'RTL24180106': ['H','H','H','H','H','H','H','H','H','H','H','H'],  // Normal
  };

  // Pola adab dan kamera
  var POLA_ADAB = {
    'RTL24180250': ['Baik','Baik','Baik','Baik','Butuh Perhatian','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180251': ['Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180252': ['Baik','','Baik','','Baik','Butuh Perhatian','','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180253': ['Baik','Baik','Baik','Baik','','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180254': ['Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180255': ['Baik','Baik','Baik','Baik','Baik','Baik','Butuh Perhatian','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180257': ['Baik','Baik','Baik','Baik','Baik','','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180258': ['Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180260': ['','Baik','Baik','','Baik','Baik','Baik','Butuh Perhatian','Baik','Baik','Baik','Baik'],
    'RTL24180261': ['Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
    'RTL24180106': ['Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik','Baik'],
  };

  var POLA_KAMERA = {
    'RTL24180250': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera sering tertutup','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180251': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180252': ['kamera terbuka','','kamera terbuka','','kamera sering tertutup','kamera selalu tertutup','','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180253': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180254': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180255': ['kamera terbuka','kamera terbuka','kamera sering tertutup','kamera terbuka','kamera terbuka','kamera terbuka','kamera selalu tertutup','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180257': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180258': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180260': ['','kamera terbuka','kamera terbuka','','kamera sering tertutup','kamera terbuka','kamera terbuka','kamera selalu tertutup','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180261': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera sering tertutup','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
    'RTL24180106': ['kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka','kamera terbuka'],
  };

  var MATERI = [
    'Makharijul Huruf - Halqi','Makharijul Huruf - Lisan','Sifatul Huruf - Jahr Hams',
    'Sifatul Huruf - Syiddah Rakhawah','Nun Mati - Idzhar Halqi','Nun Mati - Idgham',
    'Nun Mati - Iqlab','Nun Mati - Ikhfa','Mim Mati - Idzhar Syafawi',
    'Mad Asli - Mad Thabii','Mad Fariy - Wajib Muttashil','Mad Fariy - Jaiz Munfashil',
  ];

  var nilaiKBMBatch = [];

  sesiTanggal.forEach(function(tgl, idx) {
    var idKBM = 'KBM-DUMMY-' + String(idx + 1).padStart(3, '0');
    var jumlahHadir = 0;
    var jumlahAlpa  = 0;

    muridMaryam.forEach(function(m) {
      var sh_val = (POLA_HADIR[m.id] && POLA_HADIR[m.id][idx]) || 'H';
      if (['H','T'].includes(sh_val)) jumlahHadir++;
      if (sh_val === 'A') jumlahAlpa++;
    });

    // Tulis KBM_Log
    appendRow(shKBM, {
      id_kbm           : idKBM,
      id_halaqah       : 'HQ-MARYAM',
      id_guru          : 'NISA',
      nama_guru        : 'Al-Ustadzah Annisa Rizkya Rahmawati',
      tanggal_pertemuan: tgl,
      jam_mulai        : '15:00',
      jam_selesai      : '16:30',
      pertemuan_ke     : idx + 1,
      jenis_sesi       : 'KBM Reguler',
      pencapaian_modul : MATERI[idx] || 'Murajaah',
      metode           : 'Talaqqi dan Murajaah',
      catatan_umum     : 'Alhamdulillah sesi berjalan lancar. Semangat belajar murid baik.',
      latihan_mandiri  : idx % 3 === 0 ? 'Baca halaman ' + (idx * 2 + 1) + ' sampai ' + (idx * 2 + 4) + ', rekam VN kirim ke WAG' : '',
      jenis_latihan    : idx % 3 === 0 ? 'VN di WAG' : '',
      deadline_latihan : idx % 3 === 0 ? _addDays(tgl, 7) : '',
      jumlah_hadir     : jumlahHadir,
      jumlah_alpa      : jumlahAlpa,
      status           : 'selesai',
      timestamp_dibuat : tgl + 'T15:00:00.000Z',
    });

    // Tulis Nilai_KBM per murid
    muridMaryam.forEach(function(m) {
      var sh_val  = (POLA_HADIR[m.id]  && POLA_HADIR[m.id][idx])  || 'H';
      var adab    = (POLA_ADAB[m.id]   && POLA_ADAB[m.id][idx])   || '';
      var kamera  = (POLA_KAMERA[m.id] && POLA_KAMERA[m.id][idx]) || '';
      var isHadir = ['H','T'].includes(sh_val);

      nilaiKBMBatch.push({
        id_nilai      : generateId('NLI'),
        id_kbm        : idKBM,
        id_halaqah    : 'HQ-MARYAM',
        pertemuan_ke  : idx + 1,
        tanggal       : tgl,
        jam_mulai     : '15:00',
        jam_selesai   : '16:30',
        jenis_sesi    : 'KBM Reguler',
        id_murid      : m.id,
        nama_murid    : m.nama,
        status_hadir  : sh_val,
        nilai         : '',
        adab          : isHadir ? adab : '',
        kamera_murid  : isHadir ? kamera : '',
        koreksi_tahsin: isHadir ? 'Perbaiki ghunnah pada nun bertasydid' : '',
        catatan_murid : '',
        timestamp     : tgl + 'T16:30:00.000Z',
      });
    });
  });

  // Batch write nilai
  if (nilaiKBMBatch.length > 0) {
    var headers = Object.keys(nilaiKBMBatch[0]);
    nilaiKBMBatch.forEach(function(row) {
      appendRow(shNilai, row);
    });
  }

  // SESI DRAFT AKTIF - untuk test alert draft dan hapus draft
  var draftId = 'KBM-DRAFT-001';
  appendRow(shKBM, {
    id_kbm           : draftId,
    id_halaqah       : 'HQ-MARYAM',
    id_guru          : 'NISA',
    nama_guru        : 'Al-Ustadzah Annisa Rizkya Rahmawati',
    tanggal_pertemuan: '2026-06-01',
    jam_mulai        : '15:00',
    jam_selesai      : '',
    pertemuan_ke     : 13,
    jenis_sesi       : 'KBM Reguler',
    pencapaian_modul : '',
    metode           : '',
    catatan_umum     : '',
    latihan_mandiri  : '',
    jenis_latihan    : '',
    deadline_latihan : '',
    jumlah_hadir     : 0,
    jumlah_alpa      : 0,
    status           : 'draft',
    timestamp_dibuat : '2026-06-01T15:00:00.000Z',
  });

  // Update total_hadir di Anggota
  _updateTotalHadirHalaqah('HQ-MARYAM');

  Logger.log('KBM: ' + sesiTanggal.length + ' sesi selesai + 1 sesi draft + ' + nilaiKBMBatch.length + ' nilai murid.');
}

// ============================================================
//  SEED AT-TIBYAN DATA (5 sesi, semua halaqah)
// ============================================================
function seedAtTibyanData() {
  var ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var shSesi = ss.getSheetByName(CONFIG.SHEET.AT_TIBYAN_SESI);
  var shLog  = ss.getSheetByName(CONFIG.SHEET.AT_TIBYAN_LOG);

  // Auto-create sheets jika belum ada
  if (!shSesi) {
    shSesi = ss.insertSheet(CONFIG.SHEET.AT_TIBYAN_SESI);
    var hdrSesi = ['id_sesi','pertemuan_ke','tanggal','id_guru','nama_guru','total_hadir','total_murid','status','timestamp_dibuat'];
    shSesi.appendRow(hdrSesi);
    shSesi.getRange(1,1,1,hdrSesi.length).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
    shSesi.setFrozenRows(1);
  }
  if (!shLog) {
    shLog = ss.insertSheet(CONFIG.SHEET.AT_TIBYAN_LOG);
    var hdrLog = ['id_log','id_sesi','pertemuan_ke','tanggal','id_murid','nama_murid','id_halaqah','nama_halaqah','level','status_hadir','timestamp'];
    shLog.appendRow(hdrLog);
    shLog.getRange(1,1,1,hdrLog.length).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
    shLog.setFrozenRows(1);
  }

  if (shSesi.getLastRow() > 1) shSesi.deleteRows(2, shSesi.getLastRow() - 1);
  if (shLog.getLastRow()  > 1) shLog.deleteRows(2,  shLog.getLastRow()  - 1);

  var sesiAtTibyan = [
    { ke:1, tgl:'2026-01-12', materi:'Pentingnya Niat Ikhlas dalam Belajar Al-Quran' },
    { ke:2, tgl:'2026-01-19', materi:'Keutamaan Membaca Al-Quran dengan Tartil' },
    { ke:3, tgl:'2026-02-09', materi:'Makharijul Huruf dan Kaitannya dengan Tajwid' },
    { ke:4, tgl:'2026-02-16', materi:'Hukum Nun Mati dan Tanwin - Idzhar dan Idgham' },
    { ke:5, tgl:'2026-03-02', materi:'Adab Membaca Al-Quran dan Menjaga Mushaf' },
  ];

  // Pola kehadiran At-Tibyan per murid
  // Sebagian alpa untuk test keaktifan At-Tibyan
  var POLA_AT = {
    'RTL24180250': ['H','H','H','H','H'],  // Normal
    'RTL24180251': ['H','H','H','H','H'],  // Hadir semua
    'RTL24180252': ['A','H','A','H','H'],  // KRITIS (2x alpa)
    'RTL24180253': ['H','A','H','H','H'],  // PERINGATAN (1x alpa)
    'RTL24180254': ['H','H','H','H','H'],  // Hadir semua
    'RTL24180255': ['H','H','T','H','H'],  // Terlambat
    'RTL24180257': ['H','H','H','H','H'],  // Normal
    'RTL24180258': ['H','H','H','A','H'],  // PERINGATAN
    'RTL24180260': ['A','H','A','H','H'],  // KRITIS
    'RTL24180261': ['H','H','H','H','H'],  // Normal
    'RTL24180106': ['H','H','H','H','H'],  // Normal
    // Asma
    'RTL24180262': ['H','H','H','H','H'],
    'RTL24180263': ['H','H','A','H','H'],
    'RTL24180264': ['H','H','H','H','H'],
    'RTL24180265': ['H','H','H','A','H'],
    'RTL24180266': ['H','H','H','H','H'],
    // Khadijah
    'RTL24180310': ['H','H','H','H','H'],
    'RTL24180311': ['H','H','H','H','H'],
    'RTL24180312': ['A','H','H','H','H'],
    'RTL24180313': ['H','H','H','H','H'],
    'RTL24180314': ['H','H','H','H','H'],
  };

  var halaqahNamaMap = {};
  var halaqahLevelMap = {};
  HALAQAH_DATA.forEach(function(h) {
    halaqahNamaMap[h.id]  = h.nama;
    halaqahLevelMap[h.id] = h.level;
  });

  sesiAtTibyan.forEach(function(s, idx) {
    var idSesi = 'ATS-DUMMY-' + String(s.ke).padStart(3, '0');
    var hadirCount = 0;

    MURID_DATA.forEach(function(m) {
      var sh_val = (POLA_AT[m.id] && POLA_AT[m.id][idx]) || 'H';
      if (['H','T'].includes(sh_val)) hadirCount++;
      appendRow(shLog, {
        id_log      : generateId('ATL'),
        id_sesi     : idSesi,
        pertemuan_ke: s.ke,
        tanggal     : s.tgl,
        id_murid    : m.id,
        nama_murid  : m.nama,
        id_halaqah  : m.halaqah,
        nama_halaqah: halaqahNamaMap[m.halaqah] || '',
        level       : halaqahLevelMap[m.halaqah] || 'Level 1',
        status_hadir: sh_val,
        timestamp   : s.tgl + 'T08:00:00.000Z',
      });
    });

    appendRow(shSesi, {
      id_sesi         : idSesi,
      pertemuan_ke    : s.ke,
      tanggal         : s.tgl,
      id_guru         : 'UMAR',
      nama_guru       : 'Al-Ustadz Umar Abdul Aziz',
      total_hadir     : hadirCount,
      total_murid     : MURID_DATA.length,
      status          : 'selesai',
      timestamp_dibuat: s.tgl + 'T08:00:00.000Z',
    });
  });

  Logger.log('At-Tibyan: ' + sesiAtTibyan.length + ' sesi + ' + (sesiAtTibyan.length * MURID_DATA.length) + ' log presensi.');
}

// ============================================================
//  SEED NILAI MANUAL (UAS dan Micro Teaching)
//  Menggunakan KMP.UAS dan KMP.MICRO agar konsisten dengan
//  seedKomponenRaport() - ID harus cocok agar nilaiManual.find() berhasil
// ============================================================
function seedNilaiManual() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.NILAI_MANUAL);
  if (!sh) { Logger.log('Sheet Nilai_Manual tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  // Nilai UAS dan Micro Teaching untuk murid Maryam
  // Variasi realistis: Mumtaz, Jayyid Jiddan, Jayyid, Maqbul
  var nilaiMaryam = [
    { id:'RTL24180250', halaqah:'HQ-MARYAM', nama:'Nur Lindatul Hidayah',   uas:85, micro:80 },
    { id:'RTL24180251', halaqah:'HQ-MARYAM', nama:'Mitha Afril Yani',        uas:92, micro:88 },
    { id:'RTL24180252', halaqah:'HQ-MARYAM', nama:'Himaya',                  uas:65, micro:60 },
    { id:'RTL24180253', halaqah:'HQ-MARYAM', nama:'Vidyah Nawang Sari',      uas:78, micro:75 },
    { id:'RTL24180254', halaqah:'HQ-MARYAM', nama:'Camelia Santika',         uas:95, micro:92 },
    { id:'RTL24180255', halaqah:'HQ-MARYAM', nama:'Afifah',                  uas:82, micro:78 },
    { id:'RTL24180257', halaqah:'HQ-MARYAM', nama:'Irma Istarizkizra',       uas:88, micro:84 },
    { id:'RTL24180258', halaqah:'HQ-MARYAM', nama:'Shinta Mandasari',        uas:86, micro:82 },
    { id:'RTL24180260', halaqah:'HQ-MARYAM', nama:'Uray Aurel Maylaf Islam', uas:70, micro:65 },
    { id:'RTL24180261', halaqah:'HQ-MARYAM', nama:'Sri Ayuni',               uas:90, micro:85 },
    { id:'RTL24180106', halaqah:'HQ-MARYAM', nama:'Shinta Mandasari 2',      uas:83, micro:80 },
  ];

  nilaiMaryam.forEach(function(n) {
    appendRow(sh, {
      id_nilai_manual: generateId('NMN'),
      id_murid       : n.id,
      id_halaqah     : n.halaqah,
      id_periode     : 'P2026-1',
      id_komponen    : KMP.UAS,
      nama_komponen  : 'UAS',
      nilai          : n.uas,
      catatan        : 'Nilai UAS Semester 1 2026',
      timestamp      : nowISO(),
    });
    appendRow(sh, {
      id_nilai_manual: generateId('NMN'),
      id_murid       : n.id,
      id_halaqah     : n.halaqah,
      id_periode     : 'P2026-1',
      id_komponen    : KMP.MICRO,
      nama_komponen  : 'Micro Teaching',
      nilai          : n.micro,
      catatan        : 'Nilai Micro Teaching - Presentasi hukum tajwid',
      timestamp      : nowISO(),
    });
  });

  Logger.log('Nilai_Manual: ' + (nilaiMaryam.length * 2) + ' entri (UAS + Micro Teaching untuk halaqah Maryam).');
}

// ============================================================
//  SEED PENGUMUMAN
// ============================================================
function seedPengumuman() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET.PENGUMUMAN);
  if (!sh) { Logger.log('Sheet Pengumuman tidak ditemukan'); return; }
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var pengumuman = [
    {
      id:'PGM-001', pengirim:'NISA', target:'HQ-MARYAM',
      judul:'[PENTING] Jadwal UAS Semester 1 2026',
      isi:'Assalamualaikum para murid Maryam. UAS akan dilaksanakan pada tanggal 15 Juni 2026. Harap mempersiapkan diri dengan baik. Materi: semua hukum tajwid dari pertemuan 1-12. Hadir tepat waktu ya!',
      tgl:'2026-05-28',
    },
    {
      id:'PGM-002', pengirim:'NISA', target:'HQ-MARYAM',
      judul:'Libur Halaqah Minggu Ini',
      isi:'Assalamualaikum. Diinformasikan bahwa halaqah minggu ini (5 Juni 2026) ditiadakan karena ustadzah ada keperluan mendadak. Insya Allah akan diganti di jadwal berikutnya. Mohon maaf atas ketidaknyamanannya.',
      tgl:'2026-06-01',
    },
    {
      id:'PGM-003', pengirim:'UMAR', target:'all',
      judul:'[INFO] Kajian At-Tibyan Pekan Depan',
      isi:'Assalamualaikum warahmatullahi wabarakatuh. Kajian At-Tibyan akan dilaksanakan pekan depan, hari Ahad 9 Juni 2026 pukul 08.00 WIB via Zoom. Tema: Waqaf dan Ibtida dalam membaca Al-Quran. Hadir ya semua!',
      tgl:'2026-06-01',
    },
  ];

  pengumuman.forEach(function(p) {
    appendRow(sh, {
      id_pengumuman: p.id,
      pengirim     : p.pengirim,
      target       : p.target,
      judul        : p.judul,
      isi          : p.isi,
      tanggal      : p.tgl,
      timestamp    : p.tgl + 'T07:00:00.000Z',
    });
  });

  Logger.log('Pengumuman: ' + pengumuman.length + ' pengumuman ditambahkan.');
}

// ============================================================
//  HELPERS
// ============================================================
function _addDays(dateStr, days) {
  var d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
