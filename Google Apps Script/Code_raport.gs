// ============================================================
//  Code_raport.gs - Sistem Raport Halaqah v1.0
//  Generate, review, dan publish raport per halaqah.
//  Guru dapat generate & publish untuk halaqahnya sendiri.
//  Semua fungsi 100% ASCII.
// ============================================================

'use strict';

// ─────────────────────────────────────────────
//  HELPER: verifikasi guru owns halaqah
// ─────────────────────────────────────────────
function _verifyGuruHalaqah(idHalaqah, user) {
  var halaqah = sheetToObjects(getSheet(CONFIG.SHEET.HALAQAH))
    .find(function(h) {
      return String(h.id_halaqah).trim() === String(idHalaqah).trim()
          && String(h.id_guru).trim()    === String(user.id_user).trim()
          && h.status === 'aktif';
    });
  if (!halaqah) throw new Error('Akses ditolak: halaqah tidak ditemukan atau bukan milik Anda');
  return halaqah;
}

// ─────────────────────────────────────────────
//  CORE: kalkulasi & simpan raport satu murid
//  Dipanggil oleh guru (via generateRaportHalaqahGuru)
//  maupun admin (via generateRaportMurid di Code-Admin).
// ─────────────────────────────────────────────
function _buildRaportMurid(idMurid, idPeriode) {
  var users  = sheetToObjects(getSheet(CONFIG.SHEET.USERS));
  var murid  = users.find(function(u) { return u.id_user === idMurid; });
  if (!murid) return { status: 'error', message: 'Murid tidak ditemukan' };

  var komponen = sheetToObjects(getSheet(CONFIG.SHEET.KOMPONEN_RAPORT))
    .filter(function(k) {
      return String(k.id_periode).trim() === String(idPeriode).trim() && k.status === 'aktif';
    })
    .sort(function(a, b) { return (Number(a.urutan) || 99) - (Number(b.urutan) || 99); });

  if (!komponen.length)
    return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini' };

  var anggota = sheetToObjects(getSheet(CONFIG.SHEET.ANGGOTA))
    .find(function(a) { return a.id_murid === idMurid && a.status === 'aktif'; }) || {};

  // Halaqah yang terhubung ke periode ini
  var allHalaqah = sheetToObjects(getSheet(CONFIG.SHEET.HALAQAH));
  var halaqahIds = allHalaqah
    .filter(function(h) { return String(h.id_periode || '').trim() === String(idPeriode).trim(); })
    .map(function(h) { return String(h.id_halaqah).trim(); });

  // FALLBACK: jika tidak ada halaqah ber-id_periode,
  // gunakan halaqah murid yang bersangkutan agar nilai tidak 0.
  if (!halaqahIds.length && anggota.id_halaqah) {
    halaqahIds = [String(anggota.id_halaqah).trim()];
  }

  // KBM selesai di halaqah relevan
  var kbmIds = sheetToObjects(getSheet(CONFIG.SHEET.KBM_LOG))
    .filter(function(k) {
      return halaqahIds.includes(String(k.id_halaqah).trim()) && k.status === 'selesai';
    })
    .map(function(k) { return k.id_kbm; });

  // Nilai KBM murid ini
  var nilaiKBM = sheetToObjects(getSheet(CONFIG.SHEET.NILAI_KBM))
    .filter(function(n) {
      return String(n.id_murid).trim()   === String(idMurid).trim()
          && halaqahIds.includes(String(n.id_halaqah).trim())
          && kbmIds.includes(n.id_kbm);
    });

  // Nilai manual
  var nilaiManual = sheetToObjects(getSheet(CONFIG.SHEET.NILAI_MANUAL))
    .filter(function(n) {
      return String(n.id_murid).trim()  === String(idMurid).trim()
          && String(n.id_periode).trim() === String(idPeriode).trim();
    });

  // Konfigurasi raport
  var config = {};
  var konfSheet = getSheet(CONFIG.SHEET.KONFIGURASI_RAPORT);
  if (konfSheet) {
    var konfRows = konfSheet.getDataRange().getValues();
    for (var i = 1; i < konfRows.length; i++) {
      var k = String(konfRows[i][0] || '').trim();
      var v = String(konfRows[i][1] || '').trim();
      if (k && v) config[k] = v;
    }
  }

  var gradeMumtaz       = Number(config['grade_mumtaz']           || 90);
  var gradeJayyidJiddan = Number(config['grade_jayyid_jiddan']    || 80);
  var gradeJayyid       = Number(config['grade_jayyid']           || 70);
  var bobotAdab         = Number(config['bobot_adab']             || 70);
  var bobotKamera       = Number(config['bobot_kamera']           || 30);
  var bonusPerfect      = Number(config['bonus_perfect_attendance']|| 5);

  function getPredikat(n) {
    if (n >= gradeMumtaz)       return 'Mumtaz';
    if (n >= gradeJayyidJiddan) return 'Jayyid Jiddan';
    if (n >= gradeJayyid)       return 'Jayyid';
    return 'Maqbul';
  }

  // ── Hitung nilai per komponen ──────────────────────────
  var nilaiKomponen = komponen.map(function(k) {
    var nilaiAngka = 0;
    var nama = k.nama_komponen.toLowerCase();

    if (k.tipe === 'otomatis') {
      if (nama.includes('kehadiran') && !nama.includes('tibyan')) {
        // % hadir KBM Reguler
        var total = nilaiKBM.length;
        var skor  = nilaiKBM.reduce(function(s, n) {
          var kd = String(n.status_hadir || '').toUpperCase();
          return s + (kd === 'H' ? 1.0 : (kd === 'T' ? 0.7 : (kd === 'I' ? 0.5 : 0)));
        }, 0);
        nilaiAngka = total > 0 ? Math.round((skor / total) * 100) : 0;

      } else if (nama.includes('kbm') || nama.includes('harian')) {
        // KBM Harian = rata-rata (adab x 70% + kamera x 30%)
        var valid = nilaiKBM.filter(function(n) {
          return !['A','I'].includes(String(n.status_hadir || '').toUpperCase());
        });
        var totalScore = 0;
        valid.forEach(function(n) {
          var adab = n.adab === 'Baik' ? 100 : 50;
          var kam  = n.kamera_murid === 'kamera terbuka' ? 100
                   : (n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50);
          totalScore += Math.round((adab * bobotAdab + kam * bobotKamera) / 100);
        });
        nilaiAngka = valid.length > 0 ? Math.round(totalScore / valid.length) : 0;

      } else if (nama.includes('adab')) {
        var valid = nilaiKBM.filter(function(n) {
          return !['A','I'].includes(String(n.status_hadir || '').toUpperCase()) && n.adab;
        });
        var baik = valid.filter(function(n) { return n.adab === 'Baik'; }).length;
        nilaiAngka = valid.length > 0 ? Math.round((baik / valid.length) * 100) : 0;

      } else if (nama.includes('kamera')) {
        var valid = nilaiKBM.filter(function(n) {
          return !['A','I'].includes(String(n.status_hadir || '').toUpperCase()) && n.kamera_murid;
        });
        var totalKam = 0;
        valid.forEach(function(n) {
          totalKam += n.kamera_murid === 'kamera terbuka' ? 100
                    : (n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50);
        });
        nilaiAngka = valid.length > 0 ? Math.round(totalKam / valid.length) : 0;

      } else if (nama.includes('tibyan') || nama.includes('at-tibyan')) {
        var shAtSesi = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                         .getSheetByName(CONFIG.SHEET.AT_TIBYAN_SESI);
        var shAtLog  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                         .getSheetByName(CONFIG.SHEET.AT_TIBYAN_LOG);
        if (shAtSesi && shAtLog) {
          var totalAt  = sheetToObjects(shAtSesi).filter(function(s) { return s.status === 'selesai'; }).length;
          if (totalAt > 0) {
            var muridLog = sheetToObjects(shAtLog)
              .filter(function(r) { return String(r.id_murid).trim() === String(idMurid).trim(); });
            var hadirAt  = muridLog.filter(function(r) {
              return ['H','T'].includes(String(r.status_hadir || '').toUpperCase());
            }).length;
            nilaiAngka = Math.round((hadirAt / totalAt) * 100);
          }
        }
      } else {
        // fallback otomatis: rata-rata KBM harian
        var valid = nilaiKBM.filter(function(n) {
          return !['A','I'].includes(String(n.status_hadir || '').toUpperCase());
        });
        var totalScore = 0;
        valid.forEach(function(n) {
          var adab = n.adab === 'Baik' ? 100 : 50;
          var kam  = n.kamera_murid === 'kamera terbuka' ? 100
                   : (n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50);
          totalScore += Math.round((adab * bobotAdab + kam * bobotKamera) / 100);
        });
        nilaiAngka = valid.length > 0 ? Math.round(totalScore / valid.length) : 0;
      }
    } else {
      // manual
      var nm = nilaiManual.find(function(n) {
        return String(n.id_komponen).trim() === String(k.id_komponen).trim();
      });
      nilaiAngka = nm ? Number(nm.nilai) || 0 : 0;
    }

    return {
      id_komponen   : k.id_komponen,
      nama_komponen : k.nama_komponen,
      bobot         : Number(k.bobot),
      nilai         : nilaiAngka,
      nilai_bobot   : Math.round(nilaiAngka * Number(k.bobot) / 100),
      tipe          : k.tipe,
    };
  });

  // ── Nilai Akhir + bonus kehadiran penuh ───────────────────
  var nilaiAkhir = nilaiKomponen.reduce(function(s, k) { return s + k.nilai_bobot; }, 0);
  var alpaCount  = nilaiKBM.filter(function(n) {
    return String(n.status_hadir || '').toUpperCase() === 'A';
  }).length;
  if (nilaiKBM.length > 0 && alpaCount === 0) {
    nilaiAkhir = Math.min(100, nilaiAkhir + bonusPerfect);
  }

  var predikat = nilaiKBM.length === 0 ? 'Belum Ada Data' : getPredikat(nilaiAkhir);

  // ── Periode & halaqah info ────────────────────────────────
  var periode    = sheetToObjects(getSheet(CONFIG.SHEET.PERIODE))
    .find(function(p) { return String(p.id_periode).trim() === String(idPeriode).trim(); }) || {};
  var halaqahObj = allHalaqah.find(function(h) { return h.id_halaqah === anggota.id_halaqah; }) || {};

  // Catatan halaqah dari Catatan_Raport
  var catatanGuru = '';
  var catSheet = getSheet(CONFIG.SHEET.CATATAN_RAPORT);
  if (catSheet) {
    var cRow = sheetToObjects(catSheet)
      .find(function(r) { return String(r.id_halaqah).trim() === String(anggota.id_halaqah || '').trim(); });
    catatanGuru = cRow ? (cRow.catatan || '') : '';
  }

  var raportData = {
    id_murid      : murid.id_user,
    nama_murid    : murid.nama_lengkap,
    email         : murid.email || '',
    halaqah       : halaqahObj.nama_halaqah || anggota.id_halaqah || '',
    id_halaqah    : anggota.id_halaqah || '',
    level         : anggota.level || '',
    guru_pengajar : halaqahObj.nama_guru || '',
    periode       : periode.nama_periode || '',
    total_sesi    : nilaiKBM.length,
    total_hadir   : nilaiKBM.filter(function(n) {
      return ['H','T'].includes(String(n.status_hadir || '').toUpperCase());
    }).length,
    komponen      : nilaiKomponen,
    nilai_akhir   : nilaiAkhir,
    predikat      : predikat,
    catatan_guru  : catatanGuru,
    tanggal_cetak : nowISO().substring(0, 10),
  };

  // ── Simpan / update ke sheet Raport ──────────────────────
  var shRaport = getSheet(CONFIG.SHEET.RAPORT);
  var existing = sheetToObjects(shRaport).find(function(r) {
    return r.id_murid === idMurid && String(r.id_periode).trim() === String(idPeriode).trim();
  });

  if (existing) {
    updateRowWhere(shRaport, 'id_raport', existing.id_raport, {
      nilai_akhir   : nilaiAkhir,
      predikat      : predikat,
      detail_json   : JSON.stringify(nilaiKomponen),
      tanggal_cetak : raportData.tanggal_cetak,
      status        : existing.status === 'published' ? 'published' : 'draft',
    });
    raportData.id_raport = existing.id_raport;
    raportData.status    = existing.status === 'published' ? 'published' : 'draft';
  } else {
    var id_raport = generateId('RPT');
    appendRow(shRaport, {
      id_raport     : id_raport,
      id_murid      : idMurid,
      id_periode    : idPeriode,
      id_halaqah    : anggota.id_halaqah || '',
      nilai_akhir   : nilaiAkhir,
      predikat      : predikat,
      detail_json   : JSON.stringify(nilaiKomponen),
      tanggal_cetak : raportData.tanggal_cetak,
      status        : 'draft',
      url_pdf       : '',
    });
    raportData.id_raport = id_raport;
    raportData.status    = 'draft';
  }

  return { status: 'ok', message: 'Raport berhasil digenerate', data: raportData };
}

// ─────────────────────────────────────────────
//  GURU: Generate raport semua murid di halaqah
// ─────────────────────────────────────────────
function generateRaportHalaqahGuru(data, user) {
  if (!data.id_halaqah || !data.id_periode)
    return { status: 'error', message: 'id_halaqah dan id_periode wajib diisi' };

  _verifyGuruHalaqah(data.id_halaqah, user);

  var anggota = sheetToObjects(getSheet(CONFIG.SHEET.ANGGOTA))
    .filter(function(a) { return a.id_halaqah === data.id_halaqah && a.status === 'aktif'; });

  if (!anggota.length)
    return { status: 'error', message: 'Tidak ada murid aktif di halaqah ini' };

  var results = { berhasil: [], gagal: [] };
  anggota.forEach(function(a) {
    try {
      var r = _buildRaportMurid(a.id_murid, data.id_periode);
      if (r.status === 'ok') results.berhasil.push(r.data);
      else results.gagal.push({ id_murid: a.id_murid, nama: a.nama_murid || a.id_murid, alasan: r.message });
    } catch(e) {
      results.gagal.push({ id_murid: a.id_murid, nama: a.nama_murid || a.id_murid, alasan: e.message });
    }
  });

  writeAuditLog(user.id_user, 'generateRaportHalaqah', {
    id_halaqah : data.id_halaqah,
    id_periode : data.id_periode,
    berhasil   : results.berhasil.length,
  });

  return {
    status  : 'ok',
    message : results.berhasil.length + ' raport digenerate, ' + results.gagal.length + ' gagal',
    data    : results,
  };
}

// ─────────────────────────────────────────────
//  GURU: List raport halaqahnya (dengan detail komponen)
// ─────────────────────────────────────────────
function getRaportListGuru(params, user) {
  if (!params.id_halaqah || !params.id_periode)
    return { status: 'error', message: 'id_halaqah dan id_periode wajib diisi' };

  _verifyGuruHalaqah(params.id_halaqah, user);

  var muridIds = sheetToObjects(getSheet(CONFIG.SHEET.ANGGOTA))
    .filter(function(a) { return a.id_halaqah === params.id_halaqah && a.status === 'aktif'; })
    .map(function(a) { return a.id_murid; });

  var users = sheetToObjects(getSheet(CONFIG.SHEET.USERS));
  var rows  = sheetToObjects(getSheet(CONFIG.SHEET.RAPORT))
    .filter(function(r) {
      return muridIds.includes(r.id_murid)
          && String(r.id_periode).trim() === String(params.id_periode).trim();
    })
    .map(function(r) {
      var u = users.find(function(u) { return u.id_user === r.id_murid; }) || {};
      var detail = [];
      try { detail = JSON.parse(r.detail_json || '[]'); } catch(e) {}
      return {
        id_raport    : r.id_raport,
        id_murid     : r.id_murid,
        nama_murid   : u.nama_lengkap || r.id_murid,
        email        : u.email || '',
        nilai_akhir  : r.nilai_akhir,
        predikat     : r.predikat,
        status       : r.status,
        tanggal_cetak: r.tanggal_cetak,
        detail       : detail,
      };
    })
    .sort(function(a, b) { return a.nama_murid.localeCompare(b.nama_murid); });

  return { status: 'ok', data: rows };
}

// ─────────────────────────────────────────────
//  GURU: Publish semua raport draft di halaqah
//  (publish satu per satu dilakukan di frontend via loop)
// ─────────────────────────────────────────────
function publishAllRaportHalaqahGuru(data, user) {
  if (!data.id_halaqah || !data.id_periode)
    return { status: 'error', message: 'id_halaqah dan id_periode wajib diisi' };

  _verifyGuruHalaqah(data.id_halaqah, user);

  var muridIds = sheetToObjects(getSheet(CONFIG.SHEET.ANGGOTA))
    .filter(function(a) { return a.id_halaqah === data.id_halaqah && a.status === 'aktif'; })
    .map(function(a) { return a.id_murid; });

  var shRaport = getSheet(CONFIG.SHEET.RAPORT);
  var targets  = sheetToObjects(shRaport).filter(function(r) {
    return muridIds.includes(r.id_murid)
        && String(r.id_periode).trim() === String(data.id_periode).trim()
        && r.status === 'draft';
  });

  if (!targets.length)
    return { status: 'error', message: 'Tidak ada raport draft yang bisa dipublish' };

  var published = 0;
  targets.forEach(function(r) {
    try {
      updateRowWhere(shRaport, 'id_raport', r.id_raport, { status: 'published' });
      published++;
    } catch(e) {}
  });

  writeAuditLog(user.id_user, 'publishRaportBulk', {
    id_halaqah: data.id_halaqah,
    id_periode: data.id_periode,
    published : published,
  });

  return {
    status  : 'ok',
    message : published + ' raport berhasil dipublish ke murid',
    data    : { published: published, total: targets.length },
  };
}

// ─────────────────────────────────────────────
//  GURU: Ambil catatan halaqah (untuk textarea)
// ─────────────────────────────────────────────
function getCatatanHalaqah(params, user) {
  if (!params.id_halaqah)
    return { status: 'error', message: 'id_halaqah wajib diisi' };

  _verifyGuruHalaqah(params.id_halaqah, user);

  var catSheet = getSheet(CONFIG.SHEET.CATATAN_RAPORT);
  if (!catSheet) return { status: 'ok', data: { catatan: '' } };

  var row = sheetToObjects(catSheet)
    .find(function(r) { return String(r.id_halaqah).trim() === String(params.id_halaqah).trim(); });

  return { status: 'ok', data: { catatan: row ? (row.catatan || '') : '' } };
}

// ─────────────────────────────────────────────
//  GURU: Simpan catatan halaqah (tampil di raport)
// ─────────────────────────────────────────────
function saveCatatanHalaqahGuru(data, user) {
  if (!data.id_halaqah)
    return { status: 'error', message: 'id_halaqah wajib diisi' };

  var halaqah = _verifyGuruHalaqah(data.id_halaqah, user);

  var catSheet = getSheet(CONFIG.SHEET.CATATAN_RAPORT);
  if (!catSheet) {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    catSheet = ss.insertSheet('Catatan_Raport');
    catSheet.appendRow(['id_halaqah', 'nama_halaqah', 'catatan']);
  }

  var existing = sheetToObjects(catSheet)
    .find(function(r) { return String(r.id_halaqah).trim() === String(data.id_halaqah).trim(); });

  if (existing) {
    updateRowWhere(catSheet, 'id_halaqah', data.id_halaqah, { catatan: data.catatan || '' });
  } else {
    appendRow(catSheet, {
      id_halaqah   : data.id_halaqah,
      nama_halaqah : halaqah.nama_halaqah || '',
      catatan      : data.catatan || '',
    });
  }

  writeAuditLog(user.id_user, 'saveCatatanHalaqah', { id_halaqah: data.id_halaqah });
  return { status: 'ok', message: 'Catatan halaqah berhasil disimpan' };
}
