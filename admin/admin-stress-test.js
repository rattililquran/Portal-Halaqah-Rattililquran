/*
 * admin-stress-test.js — Alat DEV stress-test (Portal Admin).
 * Diekstrak dari supabase-client.js (Fase 1 split monolit, 2026-07-18) agar TIDAK
 * ikut ter-ship ke portal murid/guru. Dimuat LAZY hanya saat admin membuka menu
 * stress-test; method di-attach ke window.HQ.AdminAPI sehingga pemanggil di
 * konten-module.js tak berubah.
 *
 * Dependensi ke supabase-client.js (terverifikasi hanya 3):
 *   _sb        -> window.HQ.supabase
 *   _uid()     -> window.HQ.getCurrentUser().id_user
 *   _localDate -> disalin di bawah (self-contained)
 */
(function () {
  'use strict';
  if (!window.HQ || !window.HQ.AdminAPI) {
    console.error('[admin-stress-test] window.HQ.AdminAPI belum ada — muat SETELAH supabase-client.js');
    return;
  }
  var _sb = window.HQ.supabase;
  function _uid() { var u = window.HQ.getCurrentUser && window.HQ.getCurrentUser(); return u && u.id_user; }
  function _localDate(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  var STRESS = {
  // ── STRESS TEST: generate data KBM, nilai, setoran untuk uji performa ──────
  // Semua data ditandai [STRESS_TEST] — hapus via cleanupStressTest().
  stressTestKBM: async function(opts, onProgress) {
    var sesiCount  = opts.sesiPerHalaqah || 3;
    var incSetoran = opts.includeSetoran !== false;
    var MARKER     = '[STRESS_TEST]';
    var MATERI     = ['Tahsin Makhraj','Tahsin Sifat Huruf','Tajwid Ghunnah','Tajwid Mad','Muraja\'ah Juz 30','Ziyadah Al-Baqarah','Tahfidz Review'];
    var KOREKSI    = ['Perhatikan mad jaiz munfashil','Ikhfa\' kurang sempurna','Qalqalah perlu diperbaiki','Bacaan sudah lancar, tingkatkan tartil','Perbaiki makharijul huruf'];
    var ADAB       = ['Baik','Perlu Perhatian'];
    var KAMERA     = ['kamera terbuka','kamera tertutup'];
    var HADIR      = ['H','H','H','H','H','H','I','A']; // ~75% H, 12.5% I, 12.5% A
    var NILAI      = [75,78,80,82,85,87,88,90,92,95,100];
    var SURAT      = [{nama:'Al-Fatihah',max:7},{nama:'Al-Baqarah',max:30},{nama:'Al-Imran',max:20},{nama:'Al-Mulk',max:30},{nama:'Yasin',max:30}];
    var KELANCARAN = ['Lancar','Cukup','Perlu Perbaikan']; // harus sesuai konfigurasi_penilaian default

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    // [DESAIN SENGAJA] Gunakan crypto.randomUUID agar ID benar-benar unik meski loop cepat.
    // Date.now() bisa sama di iterasi berurutan (same ms) → 409 collision di kbm_log.
    function stId(p) {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()
        : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,8).toUpperCase();
      return p + '-ST' + uuid;
    }

    if (onProgress) onProgress(5, 'Memuat data halaqah...');
    var { data: halaqahList, error: hqErr } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah, id_guru, nama_guru').eq('status','aktif');
    if (hqErr || !halaqahList?.length) return { status:'error', message:'Tidak ada halaqah aktif' };

    var { data: anggotaAll } = await _sb.from('anggota').select('id_murid, nama_murid, id_halaqah').eq('status','aktif');
    var anggotaMap = {};
    (anggotaAll || []).forEach(function(a) {
      if (!anggotaMap[a.id_halaqah]) anggotaMap[a.id_halaqah] = [];
      anggotaMap[a.id_halaqah].push(a);
    });

    var totalKbm = 0, totalNilai = 0, totalSetoran = 0, errors = [];
    var total = halaqahList.length;

    for (var hi = 0; hi < total; hi++) {
      var h    = halaqahList[hi];
      var murid = anggotaMap[h.id_halaqah] || [];
      if (onProgress) onProgress(
        Math.round(10 + (hi / total) * 80),
        'Halaqah ' + (hi+1) + '/' + total + ': ' + h.nama_halaqah + ' (' + murid.length + ' murid)'
      );
      if (!murid.length) continue;
      if (!h.id_guru) continue; // skip halaqah tanpa guru — id_guru FK ke users.id_user tidak boleh null

      for (var si = 0; si < sesiCount; si++) {
        var daysAgo = (sesiCount - si) * 7;
        var tgl     = _localDate(new Date(Date.now() - daysAgo * 86400000));
        var id_kbm  = stId('KBM');
        var materi  = pick(MATERI);

        var stPertemuanKe = 9000 + Math.floor(Math.random() * 9000);
        var { error: e1 } = await _sb.from('kbm_log').insert({
          id_kbm,
          id_halaqah        : h.id_halaqah,
          id_guru           : h.id_guru,
          nama_guru         : h.nama_guru || '',
          tanggal_pertemuan : tgl,
          pertemuan_ke      : stPertemuanKe,
          status            : 'selesai',
          jenis_sesi        : 'KBM Reguler',
          materi_belajar    : materi,
          pencapaian_modul  : materi,
          catatan_umum      : MARKER,
          jumlah_hadir      : Math.round(murid.length * 0.75),
          jumlah_alpa       : murid.length - Math.round(murid.length * 0.75),
          jam_mulai         : '15:00',
          jam_selesai       : '16:00',
        });
        if (e1) { errors.push('kbm_log: ' + e1.message); continue; }
        totalKbm++;

        // nilai_kbm — presensi + nilai per murid
        var nilaiRows = murid.map(function(m) {
          return {
            id_kbm, id_halaqah: h.id_halaqah, id_murid: m.id_murid,
            pertemuan_ke  : stPertemuanKe,
            tanggal       : tgl,
            jenis_sesi    : 'KBM Reguler',
            status_hadir  : pick(HADIR),
            adab          : pick(ADAB),
            kamera_murid  : pick(KAMERA),
            nilai         : pick(NILAI),
            koreksi_tahsin: pick(KOREKSI),
            catatan_murid : MARKER,
          };
        });
        for (var bi = 0; bi < nilaiRows.length; bi += 50) {
          var { error: e2 } = await _sb.from('nilai_kbm').upsert(nilaiRows.slice(bi, bi+50), { onConflict: 'id_kbm,id_murid' });
          if (e2) errors.push('nilai_kbm: ' + e2.message);
          else totalNilai += Math.min(50, nilaiRows.length - bi);
        }

        // setoran_hafalan (opsional)
        if (incSetoran) {
          var st       = pick(SURAT);
          var stRows   = murid
            .filter(function() { return Math.random() > 0.3; }) // 70% murid setoran per sesi
            .map(function(m) {
              return {
                id_murid  : m.id_murid,
                nama_murid: m.nama_murid || '',
                id_halaqah: h.id_halaqah,
                id_kbm,
                id_guru   : h.id_guru || '',
                nama_guru : h.nama_guru || '',
                jenis     : 'Ziyadah',
                surat     : st.nama,
                ayat_dari : 1,
                ayat_sampai: Math.min(st.max, 7),
                nilai     : pick(NILAI),
                kelancaran: pick(KELANCARAN),
                catatan   : MARKER,
              };
            });
          for (var bj = 0; bj < stRows.length; bj += 50) {
            var { error: e3 } = await _sb.from('setoran_hafalan').insert(stRows.slice(bj, bj+50));
            if (e3) {
              console.error('[StressTest] setoran_hafalan error:', e3.code, e3.message, e3.details, e3.hint);
              errors.push('setoran [' + (e3.code||'?') + ']: ' + e3.message);
            } else {
              totalSetoran += Math.min(50, stRows.length - bj);
            }
          }
        }
      }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalKbm, totalNilai, totalSetoran, errors };
  },

  // Hapus semua data stress test (semua bertanda [STRESS_TEST])
  cleanupStressTest: async function() {
    var MARKER = '[STRESS_TEST]';
    // Urutan: anak (setoran + nilai) dulu, lalu induk (kbm_log) — karena FK id_kbm
    var [r1, r2] = await Promise.all([
      _sb.from('setoran_hafalan').delete({ count: 'exact' }).eq('catatan', MARKER),
      _sb.from('nilai_kbm').delete({ count: 'exact' }).eq('catatan_murid', MARKER),
    ]);
    if (r1.error) console.error('[Cleanup] setoran_hafalan error:', r1.error);
    if (r2.error) console.error('[Cleanup] nilai_kbm error:', r2.error);

    var r3 = await _sb.from('kbm_log').delete({ count: 'exact' }).eq('catatan_umum', MARKER);
    if (r3.error) console.error('[Cleanup] kbm_log error:', r3.error);

    console.log('[Cleanup] deleted — setoran:', r1.count, 'nilai:', r2.count, 'kbm:', r3.count);

    var errs = [r1.error, r2.error, r3.error].filter(Boolean);
    return errs.length
      ? { status:'error', errors: errs.map(function(e){ return e.message; }) }
      : { status:'ok', deleted: { setoran: r1.count, nilai: r2.count, kbm: r3.count } };
  },

  // Stress test At-Tibyan: insert at_tibyan_sesi + at_tibyan_log
  // Semua sesi ditandai nama_guru='[STRESS_TEST]' dan pertemuan_ke mulai dari 9000
  stressTestAtTibyan: async function(opts, onProgress) {
    var sesiCount = opts.sesiCount || 3;
    var MARKER    = '[STRESS_TEST]';
    var HADIR     = ['H','H','H','H','H','T','I','A']; // ~62.5% H, 12.5% T, 12.5% I, 12.5% A

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function stId(p) {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()
        : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,8).toUpperCase();
      return p + '-ST' + uuid;
    }

    if (onProgress) onProgress(5, 'Memuat data murid...');
    var [anggotaRes, halaqahRes] = await Promise.all([
      _sb.from('anggota').select('id_murid, nama_murid, id_halaqah').eq('status','aktif'),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah').eq('status','aktif'),
    ]);
    var anggotaList = anggotaRes.data || [];
    if (!anggotaList.length) return { status:'error', message:'Tidak ada anggota aktif' };

    var halaqahMap = {};
    (halaqahRes.data || []).forEach(function(h) { halaqahMap[h.id_halaqah] = h.nama_halaqah; });

    var currentUserId = _uid();
    var totalSesi = 0, totalLog = 0, errors = [];

    for (var si = 0; si < sesiCount; si++) {
      var pertemuanKe = 9000 + Math.floor(Math.random() * 9000);
      var daysAgo = (sesiCount - si) * 7;
      var tgl     = _localDate(new Date(Date.now() - daysAgo * 86400000));
      var id_sesi = stId('ATS');

      if (onProgress) onProgress(
        Math.round(10 + (si / sesiCount) * 80),
        'Sesi ' + (si+1) + '/' + sesiCount + ' — pertemuan ke-' + pertemuanKe
      );

      var logRows = anggotaList.map(function(m) {
        return {
          id_sesi,
          id_murid      : m.id_murid,
          nama_murid    : m.nama_murid || '',
          id_halaqah    : m.id_halaqah || null,
          nama_halaqah  : halaqahMap[m.id_halaqah] || '',
          status_hadir  : pick(HADIR),
          tanggal       : tgl,
        };
      });

      var hadirCount = logRows.filter(function(r) { return ['H','T'].includes(r.status_hadir); }).length;

      var { error: e1 } = await _sb.from('at_tibyan_sesi').insert({
        id_sesi,
        tanggal      : tgl,
        id_guru      : currentUserId,
        nama_guru    : MARKER,
        total_hadir  : hadirCount,
        total_murid  : logRows.length,
        status       : 'selesai',
        pertemuan_ke : pertemuanKe,
      });
      if (e1) { errors.push('at_tibyan_sesi: ' + e1.message); continue; }
      totalSesi++;

      for (var bi = 0; bi < logRows.length; bi += 50) {
        var { error: e2 } = await _sb.from('at_tibyan_log').insert(logRows.slice(bi, bi+50));
        if (e2) {
          console.error('[StressTest AT] at_tibyan_log error:', e2.code, e2.message);
          errors.push('at_tibyan_log [' + (e2.code||'?') + ']: ' + e2.message);
        } else {
          totalLog += Math.min(50, logRows.length - bi);
        }
      }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalSesi, totalLog, errors };
  },

  // Hapus semua data stress test At-Tibyan (nama_guru = '[STRESS_TEST]')
  cleanupStressTestAtTibyan: async function() {
    var MARKER = '[STRESS_TEST]';
    // Ambil id_sesi dulu
    var { data: sesiList, error: eq } = await _sb.from('at_tibyan_sesi').select('id_sesi').eq('nama_guru', MARKER);
    if (eq) return { status:'error', errors:[eq.message] };
    var sesiIds = (sesiList || []).map(function(s) { return s.id_sesi; });
    if (!sesiIds.length) return { status:'ok', deleted: { sesi:0, log:0 } };

    // Hapus log dulu (FK anak), lalu sesi (FK induk)
    var r1 = await _sb.from('at_tibyan_log').delete({ count:'exact' }).in('id_sesi', sesiIds);
    if (r1.error) console.error('[Cleanup AT] at_tibyan_log error:', r1.error);

    var r2 = await _sb.from('at_tibyan_sesi').delete({ count:'exact' }).eq('nama_guru', MARKER);
    if (r2.error) console.error('[Cleanup AT] at_tibyan_sesi error:', r2.error);

    console.log('[Cleanup AT] deleted — sesi:', r2.count, 'log:', r1.count);

    var errs = [r1.error, r2.error].filter(Boolean);
    return errs.length
      ? { status:'error', errors: errs.map(function(e){ return e.message; }) }
      : { status:'ok', deleted: { sesi: r2.count, log: r1.count } };
  },

  // Stress test Rekap Status: buat kbm_log ringan lalu rekap_status per halaqah
  // Marker: catatan_ustadz='[STRESS_TEST]' di rekap_status, catatan_umum='[STRESS_TEST]' di kbm_log
  stressTestRekapStatus: async function(opts, onProgress) {
    var sesiCount = opts.sesiPerHalaqah || 2;
    var MARKER    = '[STRESS_TEST]';
    var CATATAN   = ['Ustadz hadir tepat waktu','Murid aktif dan responsif','Ada beberapa murid terlambat','Sesi berjalan lancar','Perlu peningkatan kedisiplinan'];
    var MATERI    = ['Tahsin Makhraj','Tajwid Ghunnah','Muraja\'ah Juz 30','Ziyadah Al-Baqarah'];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function stId(p) {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()
        : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,8).toUpperCase();
      return p + '-ST' + uuid;
    }

    if (onProgress) onProgress(5, 'Memuat halaqah & ketua...');
    var [hqRes, ketuaRes] = await Promise.all([
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, id_guru, nama_guru').eq('status','aktif'),
      _sb.from('anggota').select('id_murid, id_halaqah').eq('is_ketua', true).eq('status','aktif'),
    ]);
    var halaqahList = (hqRes.data || []).filter(function(h) { return h.id_guru; });
    if (!halaqahList.length) return { status:'error', message:'Tidak ada halaqah aktif dengan guru' };

    var ketuaMap = {};
    (ketuaRes.data || []).forEach(function(k) { ketuaMap[k.id_halaqah] = k.id_murid; });
    var fallbackId = _uid();

    var totalKbm = 0, totalRekap = 0, errors = [];

    for (var hi = 0; hi < halaqahList.length; hi++) {
      var h = halaqahList[hi];
      var ketuaId = ketuaMap[h.id_halaqah] || fallbackId;
      if (onProgress) onProgress(
        Math.round(10 + (hi / halaqahList.length) * 80),
        'Halaqah ' + (hi+1) + '/' + halaqahList.length + ': ' + h.nama_halaqah
      );

      for (var si = 0; si < sesiCount; si++) {
        var daysAgo     = (sesiCount - si) * 7;
        var tgl         = _localDate(new Date(Date.now() - daysAgo * 86400000));
        var id_kbm      = stId('KBM');
        var pertemuanKe = 9000 + Math.floor(Math.random() * 9000);

        var { error: e1 } = await _sb.from('kbm_log').insert({
          id_kbm, id_halaqah: h.id_halaqah, id_guru: h.id_guru,
          nama_guru: h.nama_guru || '', tanggal_pertemuan: tgl,
          pertemuan_ke: pertemuanKe, status: 'selesai',
          jenis_sesi: 'KBM Reguler', materi_belajar: pick(MATERI),
          catatan_umum: MARKER, jumlah_hadir: 4, jumlah_alpa: 1,
          jam_mulai: '15:00', jam_selesai: '16:00',
        });
        if (e1) { errors.push('kbm_log: ' + e1.message); continue; }
        totalKbm++;

        var { error: e2 } = await _sb.from('rekap_status').insert({
          id_halaqah   : h.id_halaqah,
          id_kbm,
          id_ketua     : ketuaId,
          catatan_ustadz: MARKER + ' ' + pick(CATATAN),
        });
        if (e2) {
          console.error('[StressTest REKAP] error:', e2.code, e2.message);
          errors.push('rekap_status [' + (e2.code||'?') + ']: ' + e2.message);
        } else { totalRekap++; }
      }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalKbm, totalRekap, errors };
  },

  cleanupStressTestRekapStatus: async function() {
    var MARKER = '[STRESS_TEST]';
    var r1 = await _sb.from('rekap_status').delete({ count:'exact' }).like('catatan_ustadz', MARKER + '%');
    if (r1.error) console.error('[Cleanup REKAP] rekap_status error:', r1.error);
    var r2 = await _sb.from('kbm_log').delete({ count:'exact' }).eq('catatan_umum', MARKER);
    if (r2.error) console.error('[Cleanup REKAP] kbm_log error:', r2.error);
    console.log('[Cleanup REKAP] deleted — rekap:', r1.count, 'kbm:', r2.count);
    var errs = [r1.error, r2.error].filter(Boolean);
    return errs.length
      ? { status:'error', errors: errs.map(function(e){ return e.message; }) }
      : { status:'ok', deleted: { rekap: r1.count, kbm: r2.count } };
  },

  // Stress test Push User Prefs: upsert prefs semua user aktif dengan key '_st: true'
  // Tidak mengganggu prefs nyata — key '_st' diabaikan oleh filterByUserPrefs
  stressTestPushPrefs: async function(onProgress) {
    if (onProgress) onProgress(5, 'Memuat users aktif...');
    var { data: userList, error } = await _sb.from('users').select('id_user').eq('status','aktif');
    if (error || !userList?.length) return { status:'error', message:'Tidak ada user aktif' };

    var total = userList.length, done = 0, errors = [];
    var BATCH = 50;

    for (var bi = 0; bi < userList.length; bi += BATCH) {
      var batch = userList.slice(bi, bi + BATCH);
      if (onProgress) onProgress(
        Math.round(10 + (bi / total) * 80),
        'Batch ' + (bi+1) + '–' + Math.min(bi+BATCH, total) + ' dari ' + total + ' user'
      );

      // Fetch prefs saat ini dulu agar merge (tidak tiban prefs nyata)
      var ids = batch.map(function(u) { return u.id_user; });
      var { data: existing } = await _sb.from('push_user_prefs').select('id_user, prefs').in('id_user', ids);
      var existingMap = {};
      (existing || []).forEach(function(r) { existingMap[r.id_user] = r.prefs || {}; });

      var rows = batch.map(function(u) {
        var merged = Object.assign({}, existingMap[u.id_user] || {}, { _st: true });
        return { id_user: u.id_user, prefs: merged, updated_at: new Date().toISOString() };
      });

      var { error: e } = await _sb.from('push_user_prefs').upsert(rows, { onConflict: 'id_user' });
      if (e) { errors.push('push_user_prefs [' + (e.code||'?') + ']: ' + e.message); }
      else { done += batch.length; }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalUsers: done, errors };
  },

  cleanupStressTestPushPrefs: async function() {
    // Ambil semua rows yang punya key '_st'
    var { data: rows, error: eq } = await _sb.from('push_user_prefs')
      .select('id_user, prefs').filter('prefs', 'cs', '{"_st":true}');
    if (eq) return { status:'error', errors:[eq.message] };
    if (!rows?.length) return { status:'ok', deleted: { rows: 0 } };

    var deleted = 0, errors = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var newPrefs = Object.assign({}, r.prefs);
      delete newPrefs._st;
      var res;
      if (Object.keys(newPrefs).length === 0) {
        // Hapus row jika prefs jadi kosong (user tidak punya prefs nyata)
        res = await _sb.from('push_user_prefs').delete().eq('id_user', r.id_user);
      } else {
        res = await _sb.from('push_user_prefs').update({ prefs: newPrefs }).eq('id_user', r.id_user);
      }
      if (res.error) errors.push(res.error.message);
      else deleted++;
    }
    console.log('[Cleanup PREFS] cleaned:', deleted, 'rows');
    return errors.length
      ? { status:'error', errors }
      : { status:'ok', deleted: { rows: deleted } };
  },

  // Combined Load: jalankan semua ST secara berurutan
  stressTestCombined: async function(opts, onProgress) {
    var results = {};
    var step = 0, totalSteps = 5;
    function prog(pct, msg) {
      if (onProgress) onProgress(
        Math.round((step / totalSteps) * 100 + pct / totalSteps),
        '[' + (step+1) + '/' + totalSteps + '] ' + msg
      );
    }

    step = 0; results.kbm = await window.HQ.AdminAPI.stressTestKBM(
      { sesiPerHalaqah: opts.sesi || 2, includeSetoran: true }, prog);

    step = 1; results.atTibyan = await window.HQ.AdminAPI.stressTestAtTibyan(
      { sesiCount: opts.sesi || 2 }, prog);

    step = 2; results.observasi = await window.HQ.AdminAPI.stressTestObservasi(
      { sesiPerHalaqah: opts.sesi || 2 }, prog);

    step = 3; results.rekapStatus = await window.HQ.AdminAPI.stressTestRekapStatus(
      { sesiPerHalaqah: opts.sesi || 2 }, prog);

    step = 4; results.users = await window.HQ.AdminAPI.stressTestUsers(
      { muridPerHalaqah: 2 }, prog);

    if (onProgress) onProgress(100, 'Combined load selesai!');
    return results;
  },

  cleanupStressTestCombined: async function() {
    var [r1, r2, r3, r4, r5] = await Promise.all([
      window.HQ.AdminAPI.cleanupStressTest(),
      window.HQ.AdminAPI.cleanupStressTestAtTibyan(),
      window.HQ.AdminAPI.cleanupStressTestObservasi(),
      window.HQ.AdminAPI.cleanupStressTestRekapStatus(),
      window.HQ.AdminAPI.cleanupStressTestUsers(),
    ]);
    return { kbm: r1, atTibyan: r2, observasi: r3, rekapStatus: r4, users: r5 };
  },

  // Stress test Observasi KBM: buat kbm_log ringan per halaqah lalu observasi linked ke sesi tsb
  // Marker: catatan_tambahan='[STRESS_TEST]' di observasi, catatan_umum='[STRESS_TEST]' di kbm_log
  stressTestObservasi: async function(opts, onProgress) {
    var sesiCount  = opts.sesiPerHalaqah || 2;
    var MARKER     = '[STRESS_TEST]';
    var KONDISI    = ['Kondusif','Kondusif','Kurang Kondusif','Tidak Kondusif'];
    var LATIHAN    = ['Ya','Ya','Tidak'];
    var TEPAT      = ['Tepat Waktu','Tepat Waktu','Tepat Waktu','Guru Terlambat','Diakhiri Lebih Awal'];
    var KAMERA     = ['Sebagian Besar Terbuka','Campuran','Sebagian Besar Tertutup'];
    var MATERI     = ['Tahsin Makhraj','Tajwid Ghunnah','Muraja\'ah Juz 30','Ziyadah Al-Baqarah'];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function stId(p) {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()
        : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,8).toUpperCase();
      return p + '-ST' + uuid;
    }

    if (onProgress) onProgress(5, 'Memuat data halaqah & ketua...');
    var [hqRes, ketuaRes] = await Promise.all([
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, id_guru, nama_guru').eq('status','aktif'),
      _sb.from('anggota').select('id_murid, id_halaqah').eq('is_ketua', true).eq('status','aktif'),
    ]);
    var halaqahList = (hqRes.data || []).filter(function(h) { return h.id_guru; });
    if (!halaqahList.length) return { status:'error', message:'Tidak ada halaqah aktif dengan guru' };

    // Map ketua per halaqah, fallback ke admin user jika tidak ada ketua
    var ketuaMap = {};
    (ketuaRes.data || []).forEach(function(k) { ketuaMap[k.id_halaqah] = k.id_murid; });
    var fallbackId = _uid();

    var totalKbm = 0, totalObs = 0, errors = [];
    var total = halaqahList.length;

    for (var hi = 0; hi < total; hi++) {
      var h = halaqahList[hi];
      var ketuaId = ketuaMap[h.id_halaqah] || fallbackId;
      if (onProgress) onProgress(
        Math.round(10 + (hi / total) * 80),
        'Halaqah ' + (hi+1) + '/' + total + ': ' + h.nama_halaqah
      );

      for (var si = 0; si < sesiCount; si++) {
        var daysAgo      = (sesiCount - si) * 7;
        var tgl          = _localDate(new Date(Date.now() - daysAgo * 86400000));
        var id_kbm       = stId('KBM');
        var pertemuanKe  = 9000 + Math.floor(Math.random() * 9000);

        // Insert kbm_log minimal (tanpa nilai/setoran)
        var { error: e1 } = await _sb.from('kbm_log').insert({
          id_kbm,
          id_halaqah       : h.id_halaqah,
          id_guru          : h.id_guru,
          nama_guru        : h.nama_guru || '',
          tanggal_pertemuan: tgl,
          pertemuan_ke     : pertemuanKe,
          status           : 'selesai',
          jenis_sesi       : 'KBM Reguler',
          materi_belajar   : pick(MATERI),
          catatan_umum     : MARKER,
          jumlah_hadir     : 4,
          jumlah_alpa      : 1,
          jam_mulai        : '15:00',
          jam_selesai      : '16:00',
        });
        if (e1) { errors.push('kbm_log: ' + e1.message); continue; }
        totalKbm++;

        // Insert observasi linked ke kbm ini
        var tepatWaktu = pick(TEPAT);
        var { error: e2 } = await _sb.from('observasi_kbm').insert({
          id_kbm,
          id_halaqah      : h.id_halaqah,
          id_ketua        : ketuaId,
          pertemuan_ke    : pertemuanKe,
          tanggal         : tgl,
          kondisi_kelas   : pick(KONDISI),
          ada_latihan     : pick(LATIHAN),
          ketepatan_waktu : tepatWaktu,
          estimasi_menit  : tepatWaktu !== 'Tepat Waktu' ? Math.floor(Math.random() * 20) + 5 : null,
          kamera_peserta  : pick(KAMERA),
          catatan_tambahan: MARKER,
          status          : 'submitted',
        });
        if (e2) {
          console.error('[StressTest OBS] error:', e2.code, e2.message);
          errors.push('observasi [' + (e2.code||'?') + ']: ' + e2.message);
        } else {
          totalObs++;
        }
      }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalKbm, totalObs, errors };
  },

  // Hapus semua data stress test Observasi
  cleanupStressTestObservasi: async function() {
    var MARKER = '[STRESS_TEST]';
    // Observasi dulu (FK anak), lalu kbm_log (FK induk)
    var r1 = await _sb.from('observasi_kbm').delete({ count:'exact' }).eq('catatan_tambahan', MARKER);
    if (r1.error) console.error('[Cleanup OBS] observasi_kbm error:', r1.error);

    var r2 = await _sb.from('kbm_log').delete({ count:'exact' }).eq('catatan_umum', MARKER);
    if (r2.error) console.error('[Cleanup OBS] kbm_log error:', r2.error);

    console.log('[Cleanup OBS] deleted — observasi:', r1.count, 'kbm:', r2.count);

    var errs = [r1.error, r2.error].filter(Boolean);
    return errs.length
      ? { status:'error', errors: errs.map(function(e){ return e.message; }) }
      : { status:'ok', deleted: { observasi: r1.count, kbm: r2.count } };
  },

  // Stress test User Manajemen: insert users (tanpa auth) + anggota per halaqah
  // Marker: catatan = '[STRESS_TEST]' di users
  stressTestUsers: async function(opts, onProgress) {
    var muridPerHalaqah = opts.muridPerHalaqah || 3;
    var MARKER  = '[STRESS_TEST]';
    var LEVEL   = ['Pemula','Menengah','Lanjutan'];
    var NAMES   = ['Abdullah','Abdurrahman','Ahmad','Ali','Bilal','Fatimah','Hasan','Husain',
                   'Ibrahim','Ismail','Khadijah','Maryam','Muhammad','Nisa','Omar','Siti',
                   'Umar','Uthman','Yahya','Zaid'];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function stId(p) {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g,'').substring(0,8).toUpperCase()
        : Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
      return p + uuid;
    }

    if (onProgress) onProgress(5, 'Memuat data halaqah...');
    var { data: halaqahList, error: hqErr } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah').eq('status','aktif');
    if (hqErr || !halaqahList?.length) return { status:'error', message:'Tidak ada halaqah aktif' };

    var totalUsers = 0, totalAnggota = 0, errors = [];
    var total = halaqahList.length;

    for (var hi = 0; hi < total; hi++) {
      var h = halaqahList[hi];
      if (onProgress) onProgress(
        Math.round(10 + (hi / total) * 80),
        'Halaqah ' + (hi+1) + '/' + total + ': ' + h.nama_halaqah
      );

      for (var mi = 0; mi < muridPerHalaqah; mi++) {
        var id_user   = stId('ST');
        var namaDepan = pick(NAMES);
        var namaBelakang = pick(NAMES);
        var nama      = namaDepan + ' ' + namaBelakang + ' ST';
        var level     = pick(LEVEL);

        var { error: e1 } = await _sb.from('users').insert({
          id_user,
          nama_lengkap: nama,
          role        : 'murid',
          status      : 'aktif',
          email       : id_user.toLowerCase() + '@stress.test',
          no_hp       : '08' + Math.floor(Math.random() * 9e9).toString().padStart(9,'0'),
          catatan     : MARKER,
        });
        if (e1) { errors.push('users: ' + e1.message); continue; }
        totalUsers++;

        var { error: e2 } = await _sb.from('anggota').insert({
          id_murid   : id_user,
          nama_murid : nama,
          id_halaqah : h.id_halaqah,
          level,
          status     : 'aktif',
          is_ketua   : false,
        });
        if (e2) {
          console.error('[StressTest USR] anggota error:', e2.code, e2.message);
          errors.push('anggota [' + (e2.code||'?') + ']: ' + e2.message);
        } else {
          totalAnggota++;
        }
      }
    }

    if (onProgress) onProgress(100, 'Selesai!');
    return { status: errors.length ? 'partial' : 'ok', totalUsers, totalAnggota, errors };
  },

  // Hapus semua data stress test User Manajemen
  cleanupStressTestUsers: async function() {
    var MARKER = '[STRESS_TEST]';
    // Ambil id_user stress test dulu
    var { data: userList, error: eq } = await _sb.from('users').select('id_user').eq('catatan', MARKER);
    if (eq) return { status:'error', errors:[eq.message] };
    var userIds = (userList || []).map(function(u) { return u.id_user; });
    if (!userIds.length) return { status:'ok', deleted: { anggota:0, users:0 } };

    // Hapus anggota dulu (FK anak), lalu users (FK induk)
    var r1 = await _sb.from('anggota').delete({ count:'exact' }).in('id_murid', userIds);
    if (r1.error) console.error('[Cleanup USR] anggota error:', r1.error);

    var r2 = await _sb.from('users').delete({ count:'exact' }).eq('catatan', MARKER);
    if (r2.error) console.error('[Cleanup USR] users error:', r2.error);

    console.log('[Cleanup USR] deleted — anggota:', r1.count, 'users:', r2.count);

    var errs = [r1.error, r2.error].filter(Boolean);
    return errs.length
      ? { status:'error', errors: errs.map(function(e){ return e.message; }) }
      : { status:'ok', deleted: { anggota: r1.count, users: r2.count } };
  },
  };
  Object.assign(window.HQ.AdminAPI, STRESS);
})();
