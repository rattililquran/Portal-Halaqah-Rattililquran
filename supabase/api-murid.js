// ============================================================
//  API MURID — MuridAPI + KetuaAPI (dimuat HANYA portal murid)
//  Hasil split supabase-client.js (2026-07-18). File ini KANONIK — edit di sini.
//  supabase-client.js lama disimpan sbg fallback rollback; boleh dihapus stlh live OK.
// ============================================================


// ─────────────────────────────────────────────
//  MURID API
// ─────────────────────────────────────────────
var MuridAPI = {
  // Transparansi dana bulan berjalan untuk para Muhsinin (murid yang berinfaq).
  // Total infaq via RPC (murid tak bisa baca infaq orang lain), operasional via tabel (all_read).
  getTransparansiDana: async function(p) {
    var now = new Date();
    var tahun = p && p.tahun ? Number(p.tahun) : now.getFullYear();
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var bulan = (p && p.bulan) ? p.bulan : BULAN[now.getMonth()];
    var bulanIdx = BULAN.indexOf(bulan) + 1;
    var [infaqRes, opRes, beasiswaCountRes] = await Promise.all([
      _sb.rpc('get_infaq_bulanan', { p_bulan_idx: bulanIdx, p_tahun: tahun }),
      _sb.from('operasional').select('keterangan, nominal').eq('tahun', tahun).eq('bulan', bulan).order('created_at'),
      _sb.rpc('get_beasiswa_count'),
    ]);
    // Jika RPC belum ada (patch_052 belum dijalankan) → lempar agar panel tetap tersembunyi
    if (infaqRes && infaqRes.error) throw infaqRes.error;
    var infaq_bulanan = Number((infaqRes && infaqRes.data) || 0);
    var items = (opRes && opRes.data) || [];
    var operasional_total = items.reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: {
      bulan: bulan, tahun: tahun,
      infaq_bulanan: infaq_bulanan,
      operasional_items: items,
      operasional_total: operasional_total,
      sisa: infaq_bulanan - operasional_total,
      beasiswa_count: Number((beasiswaCountRes && beasiswaCountRes.data) || 0),
    } };
  },
  getDashboard: async function() {
    var id_murid = _uid();
    var [anggotaRes, userRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('*, halaqah(*, periode(*))').eq('id_murid', id_murid).eq('status', 'aktif').maybeSingle(),
      _sb.from('users').select('*').eq('id_user', id_murid).maybeSingle(),
      _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(*)').eq('id_murid', id_murid),
    ]);
    var anggota    = anggotaRes.data;
    var user       = userRes.data;
    var rawNilai   = nilaiRes.data || [];

    // Map KBM sessions in-memory resolving fallbacks for tanggal, pertemuan_ke, and jenis_sesi
    var allSessions = rawNilai.map(function(n) {
      var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
      return {
        id_kbm: n.id_kbm,
        id_halaqah: n.id_halaqah,
        id_murid: n.id_murid,
        status_hadir: n.status_hadir,
        adab: n.adab,
        kamera_murid: n.kamera_murid,
        nilai: n.nilai,
        koreksi_tahsin: n.koreksi_tahsin,
        catatan_murid: n.catatan_murid,
        pertemuan_ke: n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
        tanggal: n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
        jenis_sesi: jenis,
        materi: (n.kbm_log && n.kbm_log.materi_belajar) || '-',
      };
    });

    // Filter KBM sessions strictly based on student level (prevent MT leakages)
    var dashboardNilai = [];
    if (anggota && anggota.level === 'Level Qiyam') {
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Qiyam'; });
    } else if (anggota && (anggota.level === 'Micro Teaching' || (anggota.halaqah && anggota.halaqah.level === 'Micro Teaching'))) {
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'Micro Teaching'; });
    } else {
      // Regular KBM student: only show KBM Reguler
      dashboardNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Reguler'; });
    }

    var id_halaqah = anggota && anggota.halaqah && anggota.halaqah.id_halaqah;
    // Fetch pengumuman aktif untuk murid ini (target: semua atau halaqah ini)
    var pengumumanQuery = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(5);
    if (id_halaqah) pengumumanQuery = pengumumanQuery.or('target.in.(semua,all),id_halaqah.eq.'+id_halaqah);
    else pengumumanQuery = pengumumanQuery.in('target',['semua','all']);

    // Fetch exercises (PR) and exclude MT exercises
    var prQuery = _sb.from('nilai_kbm')
      .select('id_nilai, tanggal, pertemuan_ke, jenis_sesi, pr_status, pr_status_nilai, pr_catatan_guru, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar,jenis_sesi)')
      .eq('id_murid', id_murid) /* semua status kehadiran (H/T/I/A): murid absen/izin tetap dapat latihan mandiri */
      .not('kbm_log.latihan_mandiri','is',null)
      .order('tanggal',{ascending:false}).limit(10);

    var qiyamCountQuery = _sb.from('setoran_hafalan')
      .select('id_setoran', { count: 'exact', head: true })
      .eq('id_murid', id_murid)
      .eq('sumber', 'guru');

    var qiyamLatestQuery = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', id_murid)
      .eq('sumber', 'guru')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Apakah level halaqah murid mengaktifkan Partner Belajar (gating UI). Non-fatal:
    // kalau kolom/baris belum ada (migration 020 belum jalan), anggap false.
    // Sekaligus ambil jumlah_pertemuan untuk kustomisasi target progres KBM murid.
    var levelBelajarQuery = (anggota && anggota.halaqah && anggota.halaqah.level)
      ? _sb.from('level').select('partner_belajar_enabled, jumlah_pertemuan').eq('nama_level', anggota.halaqah.level).maybeSingle()
      : Promise.resolve({ data: null });

    var [
      { data: pengumuman },
      { data: prRaw },
      qiyamCountRes,
      qiyamLatestRes,
      levelBelajarRes
    ] = await Promise.all([
      pengumumanQuery,
      prQuery,
      qiyamCountQuery,
      qiyamLatestQuery,
      levelBelajarQuery
    ]);

    _check(qiyamLatestRes.error, 'getDashboard - qiyamLatest');

    // Calculate Micro Teaching in memory (immunized against NULL DB values)
    var mtSessions = allSessions.filter(function(n) { return n.jenis_sesi === 'Micro Teaching' && n.nilai != null && n.nilai !== ''; });
    var mtScores = mtSessions.map(function(m){ return Number(m.nilai); }).filter(function(v){ return !isNaN(v); });
    var mtAvg = mtScores.length > 0 ? Math.round(mtScores.reduce(function(a,b){ return a+b; }, 0) / mtScores.length) : 0;
    var sortedMt = mtSessions.slice().sort(function(a, b) {
      return (b.tanggal || '').localeCompare(a.tanggal || '');
    });
    var mtLatest = sortedMt.length > 0 ? sortedMt[0] : null;

    var today = _localDate();
    var prAktif = (prRaw||[])
      .filter(function(n){
        var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
        return n.kbm_log && n.kbm_log.latihan_mandiri && jenis !== 'Micro Teaching';
      })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        return Object.assign({}, n.kbm_log, {
          id_nilai: n.id_nilai,
          tanggal: n.tanggal, pertemuan_ke: n.pertemuan_ke,
          deadline: dl,
          status_deadline: !dl ? 'aktif' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : 'aktif',
          pr_status: n.pr_status || 'belum',
          pr_status_nilai: n.pr_status_nilai,
          pr_catatan_guru: n.pr_catatan_guru
        });
      })
      .filter(function(n){ return n.pr_status === 'belum'; }); // Hanya tampilkan PR yang belum selesai di dashboard

    var countH  = dashboardNilai.filter(function(n) { return n.status_hadir === 'H'; }).length;
    var countT  = dashboardNilai.filter(function(n) { return n.status_hadir === 'T'; }).length;
    var countI  = dashboardNilai.filter(function(n) { return n.status_hadir === 'I'; }).length;
    var countA  = dashboardNilai.filter(function(n) { return n.status_hadir === 'A'; }).length;
    var totalHadir  = countH + countT;
    var totalSesi   = dashboardNilai.length;
    var pctHadir    = totalSesi > 0 ? Math.round(totalHadir / totalSesi * 100) : 0;

    // Poin Adab & Kamera — hanya dari sesi hadir yang sudah dinilai
    var hadirNilai  = dashboardNilai.filter(function(n){ return ['H','T'].includes(n.status_hadir); });
    var adabData    = hadirNilai.filter(function(n){ return n.adab; });
    var adabBaik    = adabData.filter(function(n){ return n.adab==='Baik'; }).length;
    var poinAdab    = adabData.length > 0 ? Math.round(adabBaik/adabData.length*100) : undefined;
    var kameraData  = hadirNilai.filter(function(n){ return n.kamera_murid; });
    var kamTerbuka  = kameraData.filter(function(n){ return n.kamera_murid==='kamera terbuka'; }).length;
    var kamSeltup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera selalu tertutup'; }).length;
    var kamSegtup   = kameraData.filter(function(n){ return n.kamera_murid==='kamera sering tertutup'; }).length;
    var poinKamera  = kameraData.length > 0 ? Math.round(kamTerbuka/kameraData.length*100) : undefined;
    var hq = (anggota && anggota.halaqah) || {};

    var regulerNilai = allSessions.filter(function(n) { return n.jenis_sesi === 'KBM Reguler'; });
    var regHadir     = regulerNilai.filter(function(n) { return n.status_hadir === 'H' || n.status_hadir === 'T'; }).length;
    var regTotalSesi = regulerNilai.length;

    var daurahData = null;
    if (anggota && (anggota.level === 'Tahsin Al-Fatihah' || (anggota.halaqah && anggota.halaqah.level === 'Tahsin Al-Fatihah'))) {
      var [asmtItemsRes, asmtMuridRes] = await Promise.all([
        _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').order('urutan'),
        _sb.from('assessment_murid').select('*').eq('id_murid', id_murid)
      ]);
      var items = asmtItemsRes.data || [];
      var asmt = asmtMuridRes.data || [];
      var asmtMap = {};
      asmt.forEach(function(a) { asmtMap[a.id_item] = a.status_guru; });

      var progressItems = items.map(function(item) {
        return {
          id_item: item.id_item,
          nama: item.nama_item,
          kategori: item.kategori,
          status: asmtMap[item.id_item] || null
        };
      });

      var totalPaham = progressItems.filter(function(i) { return i.status === 'paham'; }).length;
      var totalRagu = progressItems.filter(function(i) { return i.status === 'ragu'; }).length;
      var totalBelum = progressItems.filter(function(i) { return i.status === 'belum'; }).length;

      var periode = (anggota.halaqah && anggota.halaqah.periode) || null;
      var hariKe = 0;
      var statusDaurah = 'belum';
      if (periode && periode.tanggal_mulai && periode.tanggal_selesai) {
        var todayT = new Date(); todayT.setHours(0,0,0,0);
        var tglMulai = new Date(periode.tanggal_mulai); tglMulai.setHours(0,0,0,0);
        var tglSelesai = new Date(periode.tanggal_selesai); tglSelesai.setHours(0,0,0,0);
        hariKe = todayT < tglMulai ? 0 : todayT > tglSelesai ? 8 : Math.floor((todayT - tglMulai) / 86400000) + 1;
        statusDaurah = todayT < tglMulai ? 'belum' : todayT > tglSelesai ? 'selesai' : 'berlangsung';
      }

      daurahData = {
        hariKe: hariKe,
        statusDaurah: statusDaurah,
        items: progressItems,
        summary: {
          total: items.length,
          paham: totalPaham,
          ragu: totalRagu,
          belum: totalBelum,
          belum_dinilai: items.length - (totalPaham + totalRagu + totalBelum),
          pct_paham: items.length > 0 ? Math.round(totalPaham / items.length * 100) : 0
        }
      };
    }

    return { status: 'ok', data: {
      anggota,
      profil  : user,
      halaqah : {
        nama      : hq.nama_halaqah || '',
        guru      : hq.nama_guru    || '',
        level     : hq.level        || '',
        jadwal    : hq.jadwal_hari  || '',
        jam       : hq.jam_mulai    ? String(hq.jam_mulai).substring(0, 5)    : '',
        jam_selesai: hq.jam_selesai ? String(hq.jam_selesai).substring(0, 5)  : '',
        id_halaqah: hq.id_halaqah   || '',
        partner_belajar_enabled: !!(levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.partner_belajar_enabled),
        tanggal_mulai: hq.periode ? hq.periode.tanggal_mulai : null,
        tanggal_selesai: hq.periode ? hq.periode.tanggal_selesai : null,
      },
      kehadiran: {
        skor_hadir  : regHadir,
        skor_dari_40: Math.min(Math.round(regHadir / ((levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40) * 100), 100),
        pct_hadir   : pctHadir,
        total_hadir : totalHadir,
        total_sesi  : totalSesi,
        sisa_sesi   : Math.max(0, ((levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40) - regTotalSesi),
        target_sesi : (levelBelajarRes && levelBelajarRes.data && levelBelajarRes.data.jumlah_pertemuan) || 40,
        count_h     : countH,
        count_t     : countT,
        count_i     : countI,
        count_a     : countA,
      },
      id_murid   : id_murid,
      no_hp      : user && user.no_hp  || '',
      email      : user && user.email  || '',
      poin_adab  : poinAdab,
      poin_kamera: poinKamera,
      poin_adab_detail  : { baik: adabBaik, cukup: adabData.length - adabBaik },
      poin_kamera_detail: { terbuka: kamTerbuka, selalu_tertutup: kamSeltup, sering_tertutup: kamSegtup },
      pengumuman : pengumuman || [],
      pr_aktif   : prAktif,
      daurah     : daurahData,
      qiyam: {
        total_setoran: qiyamCountRes.count || 0,
        terakhir: qiyamLatestRes.data || null
      },
      micro_teaching: {
        terakhir: mtLatest ? {
          nilai: mtLatest.nilai,
          pertemuan_ke: mtLatest.pertemuan_ke,
          tanggal: mtLatest.tanggal,
          materi: mtLatest.materi,
          koreksi_tahsin: mtLatest.koreksi_tahsin,
          catatan_murid: mtLatest.catatan_murid
        } : null,
        rata_nilai: mtAvg,
        total_sesi: mtScores.length
      }
    }};
  },

  getRiwayat: async function(limit, offset) {
    var id_murid = _uid();
    
    // Fetch student level first to filter history correctly (KBM Reguler and MT do not appear in Qiyam)
    var { data: ang } = await _sb.from('anggota')
      .select('level')
      .eq('id_murid', id_murid)
      .eq('status', 'aktif')
      .maybeSingle();

    var q = _sb.from('nilai_kbm')
      .select('*, kbm_log!nilai_kbm_id_kbm_fkey(tanggal_pertemuan,pertemuan_ke,materi_belajar,latihan_mandiri,jenis_latihan,deadline_latihan,jenis_sesi)', { count: 'exact' })
      .eq('id_murid', id_murid);

    if (ang && ang.level === 'Level Qiyam') {
      q = q.eq('jenis_sesi', 'KBM Qiyam');
    } else if (ang && ang.level === 'Micro Teaching') {
      q = q.eq('jenis_sesi', 'Micro Teaching');
    } else {
      // Regular KBM student: only show KBM Reguler. Use OR filter to include legacy records where jenis_sesi is NULL
      q = q.or('jenis_sesi.eq.KBM Reguler,jenis_sesi.is.null');
    }

    var { data, error, count } = await q
      .order('tanggal', { ascending: false })
      .range(offset||0, (offset||0)+(limit||8)-1);
    _check(error, 'getRiwayat');
    var mapped = (data||[]).map(function(n) { return Object.assign({}, n, {
      tanggal         : n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan),
      pertemuan_ke    : n.pertemuan_ke || (n.kbm_log && n.kbm_log.pertemuan_ke),
      materi          : (n.kbm_log && n.kbm_log.materi_belajar) || '',
      materi_belajar  : n.kbm_log && n.kbm_log.materi_belajar,
      latihan_mandiri : n.kbm_log && n.kbm_log.latihan_mandiri,
      jenis_latihan   : n.kbm_log && n.kbm_log.jenis_latihan,
      deadline_latihan: n.kbm_log && n.kbm_log.deadline_latihan,
      jenis_sesi      : n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler',
    }); });
    return { status: 'ok', data: mapped, total: count, has_more: (offset||0)+(limit||8) < (count||0) };
  },

  getLatihanMandiri: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('nilai_kbm')
      .select('id_nilai, tanggal, pertemuan_ke, jenis_sesi, pr_status, pr_catatan_murid, pr_lampiran_url, pr_submitted_at, pr_status_nilai, pr_catatan_guru, pr_lampiran_guru_url, pr_dinilai_at, kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,jenis_latihan,deadline_latihan,materi_belajar,jenis_sesi,referensi_url)')
      .eq('id_murid', id_murid) /* semua status kehadiran (H/T/I/A): murid absen/izin tetap dapat latihan mandiri */
      .not('kbm_log.latihan_mandiri', 'is', null)
      .order('tanggal', { ascending: false }).limit(20);
    _check(error, 'getLatihanMandiri');
    var today = _localDate();
    var rows = (data||[])
      .filter(function(n){
        return n.kbm_log && n.kbm_log.latihan_mandiri;
      })
      .map(function(n) {
        var dl = n.kbm_log.deadline_latihan;
        var daysLeft = dl ? Math.ceil((new Date(dl) - new Date(today)) / 86400000) : null;
        var status = !dl ? 'none' : dl < today ? 'lewat' : dl === today ? 'hari_ini' : daysLeft <= 3 ? 'mepet' : 'aman';
        return {
          id_nilai       : n.id_nilai,
          tanggal        : n.tanggal,
          pertemuan_ke   : n.pertemuan_ke,
          latihan_mandiri: n.kbm_log.latihan_mandiri,
          jenis_latihan  : n.kbm_log.jenis_latihan,
          deadline       : dl,
          materi_belajar : n.kbm_log.materi_belajar,
          status_deadline: status,
          pr_status      : n.pr_status || 'belum',
          pr_catatan_murid: n.pr_catatan_murid || '',
          pr_lampiran_url: n.pr_lampiran_url || '',
          pr_submitted_at: n.pr_submitted_at,
          pr_status_nilai: n.pr_status_nilai,
          pr_catatan_guru: n.pr_catatan_guru || '',
          pr_lampiran_guru_url: n.pr_lampiran_guru_url || '',
          pr_dinilai_at  : n.pr_dinilai_at,
          referensi_url  : (n.kbm_log && n.kbm_log.referensi_url) || ''
        };
      });
    return { status: 'ok', data: rows };
  },

  getLatihanUploadToken: async function() {
    var { data, error } = await _sb.rpc('get_latihan_upload_token');
    _check(error, 'getLatihanUploadToken');
    return { status: 'ok', token: data };
  },

  submitPR: async function(id_nilai, catatan, lampiran_url) {
    var { data, error } = await _sb.rpc('submit_latihan_mandiri', {
      p_id_nilai: id_nilai,
      p_pr_catatan_murid: catatan,
      p_pr_lampiran_url: lampiran_url
    });
    _check(error, 'submitPR');
    return { status: 'ok', data: data };
  },

  logLatihanHarian: async function(durasi, kategori, catatan) {
    var id_murid = _uid();
    var { data, error } = await _sb.from('log_latihan_harian').upsert({
      id_murid: id_murid,
      tanggal: _localDate(),
      durasi_menit: parseInt(durasi),
      kategori: kategori,
      catatan: catatan
    }, { onConflict: 'id_murid,tanggal' });
    _check(error, 'logLatihanHarian');
    return { status: 'ok', data: data };
  },

  getStreakLatihan: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.rpc('get_murid_streak', { p_id_murid: id_murid });
    _check(error, 'getStreakLatihan');
    return { status: 'ok', streak: data || 0 };
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
      komponen    : r.detail_json ? (function(){ try{ return typeof r.detail_json==='string'?JSON.parse(r.detail_json):r.detail_json; }catch(e){ return []; } })() : [],
    }); }) };
  },

  getRincianRaport: async function(id_raport) { return _core_getRincianRaport(id_raport); },
  generateRaportPDF: async function(id_r)    { return _core_generateRaportPDF(id_r); },

  getPengumuman: async function() {
    var id_murid = _uid();
    // BUG-019 fix: maybeSingle() agar tidak error jika murid di beberapa halaqah
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid', id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah;
    var q = _sb.from('pengumuman').select('*').eq('status','aktif').order('tanggal',{ascending:false}).limit(15);
    if (id_halaqah) q = q.or('target.eq.semua,target.eq.all,id_halaqah.eq.' + id_halaqah);
    else q = q.in('target', ['semua','all']);
    var { data, error } = await q;
    _check(error, 'getPengumuman');
    return { status: 'ok', data };
  },

  getSPPStatus: async function() {
    var id_murid = _uid();
    var tahunIni = new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('*').eq('id_murid', id_murid)
      .order('tahun',{ascending:false}).order('created_at',{ascending:false});
    if (error) return { status: 'ok', data: { rows: [], lunas_bulan: [], tunggakan: 0, total_nominal: 0 } };
    var rows = data || [];
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var tahunAktif = rows.length ? Math.max(tahunIni, rows[0].tahun) : tahunIni;
    var rowsTahunIni = rows.filter(function(r){ return r.tahun === tahunAktif; });
    var lunasBulan  = rowsTahunIni.filter(function(r){ return r.status==='lunas' && (r.jenis==='SPP Pribadi' || !r.jenis); }).map(function(r){ return r.bulan; });
    var menunggu    = rowsTahunIni.filter(function(r){ return r.status==='menunggu' && (r.jenis==='SPP Pribadi' || !r.jenis) && !_sppGatewayExpired(r); }).map(function(r){ return r.bulan; });
    var bulanGrid   = BULAN.map(function(b) {
      var l = lunasBulan.includes(b);
      var m = menunggu.includes(b);
      return { bulan:b, status: l?'lunas': m?'menunggu':'belum' };
    });
    var totalNominal = rowsTahunIni.filter(function(r){return r.status==='lunas';}).reduce(function(s,r){return s+Number(r.nominal||0);},0);
    // [DESAIN SENGAJA] Kewajiban SPP = 5 bulan flat per periode.
    // JANGAN diganti window kalender (Jan–bulanBerjalan) — setiap level/kelas
    // bisa dibuka di bulan berbeda, tidak selalu mulai Januari.
    // tunggakan = sisa dari 5, bukan "bulan lewat yang belum dibayar".
    var TOTAL_SPP = 5;
    var tunggakan = Math.max(0, TOTAL_SPP - lunasBulan.length);
    // [DESAIN SENGAJA] Bulan mulai grid diambil dari bulan pertama yang pernah
    // disubmit murid — bukan Januari, bukan tanggal bergabung anggota.
    // Bulan sebelum itu tampil ○ (tidak berlaku), bukan ❌.
    var semuaBulanSpp = rowsTahunIni.filter(function(r){ return r.jenis==='SPP Pribadi'||!r.jenis; });
    var bulanMulaiIdx = semuaBulanSpp.length
      ? semuaBulanSpp.reduce(function(min,r){ var i=BULAN.indexOf(r.bulan); return i>=0&&i<min?i:min; }, 11)
      : new Date().getMonth();
    return { status: 'ok', data: {
      rows, lunas_bulan: lunasBulan, menunggu_bulan: menunggu,
      bulan_grid: bulanGrid, tunggakan, total_nominal: totalNominal,
      tahun_aktif: tahunAktif, has_paid: lunasBulan.length > 0,
      window_size: TOTAL_SPP, bulan_mulai_idx: bulanMulaiIdx,
    }};
  },

  getMetodeBayar: async function() {
    var { data } = await _sb.from('spp_metode_bayar').select('*').eq('aktif',true).order('urutan');
    return { status:'ok', data: data||[] };
  },

  konfirmasiSPP: async function(d) {
    var id_murid = _uid();
    var user = _currentUser || {};
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid',id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah || '';
    // Support multi-bulan: d.bulan bisa array atau string
    var bulanList = Array.isArray(d.bulan) ? d.bulan : (d.bulan && d.bulan !== '-' ? [d.bulan] : ['-']);
    if (!bulanList.length) bulanList = ['-'];

    // BUG-002 fix: cek baris yang sudah lunas agar tidak dioverride
    // BUG-K2 fix: sertakan jenis di id_spp agar tidak clash jika multi-jenis
    var jenisSuffix = (d.jenis || 'SPP Pribadi').replace(/\s+/g,'').substring(0,3).toUpperCase();
    var idSppMap = {};
    bulanList.forEach(function(bulan) {
      var id = 'SPP-' + id_murid + '-' + bulan.substring(0,3).toUpperCase() + '-' + d.tahun + '-' + jenisSuffix;
      if (d.jenis === 'Infaq/Operasional') {
        id += '-' + Math.random().toString(36).substring(2,10).toUpperCase();
      }
      idSppMap[bulan] = id;
    });

    var idSppList = Object.values(idSppMap);
    var { data: existingRows } = await _sb.from('spp_pembayaran')
      .select('id_spp, status').in('id_spp', idSppList);
    var sudahLunasSet = new Set(
      (existingRows || []).filter(function(r){ return r.status === 'lunas'; }).map(function(r){ return r.id_spp; })
    );
    // Filter: hanya proses bulan yang belum lunas
    var bulanProses = bulanList.filter(function(bulan) {
      var id_spp = idSppMap[bulan];
      return !sudahLunasSet.has(id_spp);
    });
    if (!bulanProses.length) {
      return { status: 'ok', message: 'Semua bulan yang dipilih sudah lunas. Tidak ada yang perlu dikonfirmasi.' };
    }

    var rows = bulanProses.map(function(bulan) {
      return {
        id_spp    : idSppMap[bulan],
        id_murid, nama_murid: user.nama_lengkap || user.nama || '',
        id_halaqah,
        bulan, tahun: Number(d.tahun),
        jenis: d.jenis || 'SPP Pribadi',
        status: 'menunggu',
        // BUG-07 fix: dibagi bulanProses.length (bulan yg benar-benar diproses), bukan bulanList.length
        nominal: bulanProses.length > 1 ? Math.round(Number(d.nominal||0) / bulanProses.length) : Number(d.nominal||0),
        metode_transfer: d.metode_transfer || '',
        bukti_url: d.bukti_url || '',
        catatan: d.catatan || '',
        metode_bayar: 'manual',
        mayar_expired_at: null,
        mayar_invoice_id: null,
        mayar_payment_link: null,
      };
    });
    var { error } = await _sb.from('spp_pembayaran').upsert(rows, { onConflict: 'id_spp' });
    _check(error, 'konfirmasiSPP');
    var jumlah = bulanProses.length > 1 ? bulanProses.length + ' bulan' : 'pembayaran';
    return { status: 'ok', message: 'Konfirmasi ' + jumlah + ' terkirim, menunggu validasi admin.' };
  },

  // Buat invoice Mayar → kembalikan payment_link untuk redirect
  createPaymentGateway: async function(d) {
    var tk = sessionStorage.getItem('hq_token') || localStorage.getItem('hq_token');
    if (!tk) throw new Error('Sesi berakhir. Silakan login ulang.');
    var res = await fetch(SUPABASE_URL + '/functions/v1/mayar-create-payment', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
      body   : JSON.stringify({
        bulan  : Array.isArray(d.bulan) ? d.bulan : [d.bulan],
        tahun  : Number(d.tahun),
        nominal: Number(d.nominal),
        jenis  : d.jenis || 'SPP Pribadi',
      }),
    });
    var data;
    try { data = await res.json(); } catch(e) { throw new Error('Server tidak merespons. Coba lagi.'); }
    if (data.status === 'error') throw new Error(data.message);
    if (!data.payment_link) throw new Error('Link pembayaran tidak tersedia. Coba lagi.');
    return data;
  },

  // BUG-M6 fix: implementasi nyata — grafik kehadiran 6 bulan terakhir
  getProgressGrafik: async function() {
    var id_murid = _uid();
    if (!id_murid) return { status: 'ok', data: [] };
    var since = new Date();
    since.setMonth(since.getMonth() - 6);
    var sinceStr = _localDate(since);
    var { data: rows, error } = await _sb.from('nilai_kbm')
      .select('tanggal, status_hadir')
      .eq('id_murid', id_murid)
      .gte('tanggal', sinceStr)
      .order('tanggal');
    if (error || !rows || !rows.length) return { status: 'ok', data: [] };
    // Kelompokkan per bulan
    var bulanMap = {};
    rows.forEach(function(r) {
      if (!r.tanggal) return;
      var key = r.tanggal.substring(0, 7); // 'YYYY-MM'
      if (!bulanMap[key]) bulanMap[key] = { total: 0, hadir: 0 };
      bulanMap[key].total++;
      if (['H', 'T'].includes(String(r.status_hadir || '').toUpperCase())) bulanMap[key].hadir++;
    });
    var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var grafik = Object.keys(bulanMap).sort().map(function(key) {
      var b = bulanMap[key];
      var pct = b.total > 0 ? Math.round(b.hadir / b.total * 100) : 0;
      var parts = key.split('-');
      return { bulan: BULAN[parseInt(parts[1], 10) - 1] + ' ' + parts[0], pct_hadir: pct, total: b.total, hadir: b.hadir };
    });
    return { status: 'ok', data: grafik };
  },

  getMateriLevel: async function() {
    var {data,error} = await _sb.from('materi_level').select('*').order('level').order('urutan');
    if (!error && data && data.length) {
      var grouped = {};
      data.forEach(function(r) {
        if (!grouped[r.level]) grouped[r.level] = [];
        grouped[r.level].push({ kategori: r.kategori, judul: r.judul, isi: r.isi });
      });
      return { status: 'ok', data: grouped };
    }
    return { status: 'ok', data: {} };
  },

  getAtTibyan: async function() {
    var id_murid = _uid();
    var [materiRes, logRes] = await Promise.all([
      _sb.from('at_tibyan_materi').select('*').order('pertemuan_ke'),
      _sb.from('at_tibyan_log').select('pertemuan_ke, status_hadir, tanggal, id_sesi').eq('id_murid', id_murid)
    ]);

    var materiData = materiRes.data || [];
    var logData = logRes.data || [];

    var logMapByPtm = {};
    var logMapByDate = {};
    logData.forEach(function(l) {
      if (l.pertemuan_ke !== null && l.pertemuan_ke !== undefined) {
        logMapByPtm[String(l.pertemuan_ke)] = l;
      }
      if (l.tanggal) {
        logMapByDate[l.tanggal] = l;
      }
    });

    var rows = materiData.map(function(r) {
      var pStr = String(r.pertemuan_ke);
      var log = logMapByPtm[pStr] || logMapByDate[r.tanggal];
      var presenceTxt = 'Presensi Belum Ada';
      if (log) {
        var sh = log.status_hadir;
        if (sh === 'H') presenceTxt = 'Hadir';
        else if (sh === 'T') presenceTxt = 'Hadir (Terlambat)';
        else if (sh === 'I') presenceTxt = 'Izin';
        else if (sh === 'A') presenceTxt = 'Alpa';
      }
      return {
        pertemuan_ke: pStr,
        tanggal: r.tanggal || '',
        pemateri: r.pemateri || '',
        materi_pembahasan: r.materi_pembahasan || '',
        nasihat_aplikatif: r.nasihat_aplikatif || '',
        presensi: presenceTxt,
        bab: '',
        materi: r.materi_pembahasan || '',
        catatan_guru: ''
      };
    });

    var columns = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'pemateri', label: 'Pemateri' },
      { key: 'materi_pembahasan', label: 'Materi Pembahasan' },
      { key: 'nasihat_aplikatif', label: 'Nasihat Aplikatif' }
    ];

    return { status: 'ok', data: rows, columns: columns };
  },
  getAtTibyanMurid: async function() {
    var id_murid = _uid();
    var { data: logs } = await _sb.from('at_tibyan_log')
      .select('id_sesi, status_hadir, tanggal').eq('id_murid', id_murid).order('tanggal', { ascending: false });
    if (!logs || !logs.length) return { status: 'ok', data: [], summary: { hadir: 0, total: 0, pct: 0 } };
    var sesiIds = logs.map(function(r){ return r.id_sesi; }).filter(Boolean);
    var sesiMap = {};
    if (sesiIds.length) {
      var { data: sesiList } = await _sb.from('at_tibyan_sesi').select('id_sesi, pertemuan_ke').in('id_sesi', sesiIds);
      (sesiList || []).forEach(function(s){ sesiMap[s.id_sesi] = s.pertemuan_ke; });
    }
    var rows = logs.map(function(r) {
      return { id_sesi: r.id_sesi, status_hadir: r.status_hadir, tanggal: r.tanggal, pertemuan_ke: sesiMap[r.id_sesi] || null };
    });
    var total = rows.length;
    var hadir = rows.filter(function(r){ return ['H','T'].includes(r.status_hadir); }).length;
    var pct   = total > 0 ? Math.round(hadir / total * 100) : 0;
    return { status: 'ok', data: rows, summary: { hadir, total, pct } };
  },
  getKonfigurasiRaport: async function() {
    var { data } = await _sb.from('konfigurasi_raport').select('*');
    var cfg = {}; (data||[]).forEach(function(r){cfg[r.key]=r.value;});
    return { status: 'ok', data: cfg };
  },
  getKeaktifanAlerts: async function() {
    var id_murid = _uid();
    var [kbmRes, atRes, anggotaRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',id_murid).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',id_murid).eq('status_hadir','A'),
      _sb.from('anggota').select('followup_alpa_kbm,followup_alpa_at,followup_at').eq('id_murid',id_murid).eq('status','aktif').maybeSingle(),
    ]);
    var kbmAlpa   = kbmRes.count || 0;
    var atAlpa    = atRes.count  || 0;
    if (anggotaRes.error) _check(anggotaRes.error, 'getKeaktifanAlerts.anggota');
    var dismissed = anggotaRes.data || {};

    // Alert hanya tampil jika alpa BERTAMBAH sejak guru terakhir dismiss
    // Jika kbmAlpa <= baseline saat dismiss → guru sudah handle, banner hilang
    var kbmDismissed = dismissed.followup_alpa_kbm != null && kbmAlpa <= dismissed.followup_alpa_kbm;
    var atDismissed  = dismissed.followup_alpa_at  != null && atAlpa  <= dismissed.followup_alpa_at;

    var alerts = [];
    if (!kbmDismissed) {
      if      (kbmAlpa >= 2) alerts.push({ tipe:'absen_kritis',     judul:'Kehadiran KBM Kritis!',       pesan:'Kamu sudah alpa '+kbmAlpa+'× di KBM halaqah. Segera hubungi guru ya.',  detail:'KBM alpa: '+kbmAlpa+'×' });
      else if (kbmAlpa === 1) alerts.push({ tipe:'absen_peringatan', judul:'Peringatan Kehadiran KBM',    pesan:'Kamu sudah alpa 1× di KBM. Jaga kehadiranmu!',                          detail:'KBM alpa: 1×' });
    }
    if (!atDismissed) {
      if      (atAlpa >= 2) alerts.push({ tipe:'absen_kritis',      judul:'Kehadiran At-Tibyan Kritis!', pesan:'Kamu sudah alpa '+atAlpa+'× di At-Tibyan. Semangat hadir ya!',          detail:'At-Tibyan alpa: '+atAlpa+'×' });
      else if (atAlpa === 1) alerts.push({ tipe:'absen_peringatan', judul:'Peringatan At-Tibyan',        pesan:'Kamu sudah alpa 1× di At-Tibyan. Jaga kehadiranmu!',                    detail:'At-Tibyan alpa: 1×' });
    }
    return { status: 'ok', data: { alerts, followup_at: dismissed.followup_at || null } };
  },

  // Ambil inbox push notifikasi yang belum dibaca murid
  getNotifInbox: async function() {
    var id_murid = _uid();
    if (!id_murid) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('notif_inbox')
      .select('id, judul, pesan, tipe, url, created_at')
      .eq('id_user', id_murid)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return { status: 'ok', data: [] };
    return { status: 'ok', data: data || [] };
  },

  // Tandai satu item inbox sebagai sudah dibaca
  markNotifRead: async function(id) {
    var id_murid = _uid();
    if (!id_murid || !id) return { status: 'err' };
    var { error } = await _sb.from('notif_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('id_user', id_murid);
    return error ? { status: 'err' } : { status: 'ok' };
  },

  getAssessmentItems: async function(level) {
    var q = _sb.from('assessment_items').select('id_item,level,kategori,teks_latin,teks_arab,keterangan,urutan').eq('status','aktif').order('urutan');
    if (level) q = q.eq('level', level);
    var { data, error } = await q;
    if (error || !data || !data.length) return { status: 'ok', data: {} };
    // .order('urutan') saja GLOBAL — urutan di-reset per kategori/Hari (mis.
    // Hari 2 urutan 1 bisa muncul sebelum Hari 1 urutan 7), jadi kategori bisa
    // tercampur. Urutkan ulang per Hari (angka di kategori) lalu urutan —
    // sama seperti fix di konten-module.js & getMutabaahDaurah(Guru).
    data.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var grouped = {};
    data.forEach(function(item) {
      if (!grouped[item.level]) grouped[item.level] = {};
      if (!grouped[item.level][item.kategori]) grouped[item.level][item.kategori] = [];
      grouped[item.level][item.kategori].push(item);
    });
    return { status: 'ok', data: grouped };
  },

  getAssessmentMurid: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('assessment_murid').select('id_item, status').eq('id_murid', id_murid);
    if (error) return { status: 'ok', data: {} };
    var jawaban = {};
    (data || []).forEach(function(r) { jawaban[r.id_item] = r.status; });
    return { status: 'ok', data: jawaban };
  },

  // Penilaian guru per indikator tajwid (status_guru) — BUKAN hasil "verifikasi"
  // atas jawaban self-assessment murid, tapi nilai yang diinput guru langsung
  // saat menutup sesi KBM Daurah (lihat guru/kbm-module.js: _daurahAssessmentMap
  // -> simpanVerifikasiGuru saat "Selesaikan KBM"), persis seperti input
  // nilai/adab/kamera. Dipakai halaman "Mutaba'ah Daurah" murid.
  // RLS "murid_rw_asmt_murid" (FOR ALL, id_murid = current_user_id()) sudah
  // mengizinkan murid membaca kolom ini di barisnya sendiri, tanpa perlu
  // policy baru.
  getPenilaianGuru: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('assessment_murid').select('id_item, status_guru').eq('id_murid', id_murid);
    if (error) return { status: 'ok', data: {} };
    var out = {};
    (data || []).forEach(function(r) { if (r.status_guru) out[r.id_item] = r.status_guru; });
    return { status: 'ok', data: out };
  },

  saveAssessment: async function(d) {
    var id_murid = _uid();
    var jawaban  = d.jawaban || {};
    var rows = Object.keys(jawaban).filter(function(k){ return jawaban[k]; }).map(function(id_item) {
      return { id_murid, id_item, status: jawaban[id_item], updated_at: new Date().toISOString() };
    });
    if (!rows.length) return { status: 'ok' };
    var { error } = await _sb.from('assessment_murid').upsert(rows, { onConflict: 'id_murid,id_item' });
    _check(error, 'saveAssessment');
    return { status: 'ok', message: rows.length + ' jawaban disimpan' };
  },
  changePassword: async function(d) { return Auth.changePassword(d); },
  updateProfil: async function(d) {
    return Auth.updateProfile(d);
  },

  // ── Tahfidz / Setoran Hafalan (Level Qiyam) ──────────────────────────
  // Riwayat setoran milik murid yang login (hanya Level Qiyam via RLS)
  getSetoranHafalan: async function(limit, offset) {
    // BUG-06 fix: client-side guard — cek level murid sebelum fetch
    var { data: angData } = await _sb.from('anggota')
      .select('level').eq('id_murid', _uid()).eq('status', 'aktif').maybeSingle();
    if (!angData || angData.level !== 'Level Qiyam') {
      return { status: 'ok', data: [], total: 0, has_more: false };
    }
    var lim = limit || 10;
    var off = offset || 0;
    // Ambil lim+1 baris untuk deteksi has_more — hindari count:'exact' yang
    // memaksa COUNT(*) terpisah (lambat di PostgREST, apalagi dgn RLS).
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', _uid())
      .order('updated_at', { ascending: false }) // urut per tanggal update (mis. setoran partner naik saat dikonfirmasi)
      .range(off, off + lim);
    _check(error, 'getSetoranHafalan');
    var rows = data || [];
    var hasMore = rows.length > lim;
    if (hasMore) rows = rows.slice(0, lim);
    return { status: 'ok', data: rows, total: null, has_more: hasMore };
  },

  // Raport tahfidz murid sendiri (berdasarkan rentang tanggal)
  getMyRaportTahfidz: async function(tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_murid', _uid())
      .eq('sumber', 'guru') // §3.7: raport resmi hanya hitung setoran guru
      .order('created_at', { ascending: true });
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getMyRaportTahfidz');
    return { status: 'ok', data: data || [] };
  },

  // §3.7: ringkasan aktivitas mandiri bersama partner (sudah dikonfirmasi)
  getMyAktivitasPartner: async function(tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('jenis')
      .eq('id_murid', _uid())
      .eq('sumber', 'partner')
      .eq('status_konfirmasi', 'dikonfirmasi');
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59');
    var { data, error } = await q;
    _check(error, 'getMyAktivitasPartner');
    var rows = data || [];
    return { status: 'ok', data: {
      ziyadah  : rows.filter(function(r) { return r.jenis === 'Ziyadah'; }).length,
      murajaah : rows.filter(function(r) { return r.jenis === 'Murajaah'; }).length,
    }};
  },

  // ── Kelompok Partner Qiyam ───────────────────────────────────────────
  // Kelompok partner aktif milik murid (beserta anggota)
  getMyKelompokPartner: async function() {
    var { data, error } = await _sb.from('kelompok_partner_qiyam')
      .select('*, anggota_kelompok_partner(*)')
      .eq('status', 'aktif')
      .maybeSingle();
    _check(error, 'getMyKelompokPartner');
    return { status: 'ok', data: data || null };
  },

  // Data Ziyadah milik sendiri (resmi + mandiri yang sudah dikonfirmasi) — validasi range Murajaah (§3.8)
  getZiyadahSaya: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('surat, juz, ayat_dari, ayat_sampai')
      .eq('id_murid', _uid())
      .eq('jenis', 'Ziyadah')
      .or('sumber.eq.guru,and(sumber.eq.partner,status_konfirmasi.eq.dikonfirmasi)');
    _check(error, 'getZiyadahSaya');
    return { status: 'ok', data: data || [] };
  },

  // Input setoran mandiri ke partner (§3.8)
  addSetoranMandiri: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_murid    : _uid(),
      nama_murid  : (user && (user.nama_lengkap || user.nama)) || '',
      id_halaqah  : d.id_halaqah,
      juz         : d.juz ? parseInt(d.juz) : null,
      surat       : d.surat,
      ayat_dari   : parseInt(d.ayat_dari),
      ayat_sampai : parseInt(d.ayat_sampai),
      jenis       : d.jenis,
      catatan     : d.catatan || null,
      sumber      : 'partner',
      status_konfirmasi: 'menunggu',
      nilai       : null,
      lampiran_url: d.lampiran_url || null,
      audio_durasi_detik: d.audio_durasi_detik ? parseInt(d.audio_durasi_detik) : null,
    };
    if (d.tanggal) {
      payload.created_at = new Date(d.tanggal + 'T12:00:00').toISOString();
    }
    var { data, error } = await _sb.from('setoran_hafalan').insert(payload).select().single();
    _check(error, 'addSetoranMandiri');

    // Kirim push notification ke partner sekelompok qiyam
    if (data) {
      (async function() {
        try {
          var { data: memberRow } = await _sb.from('anggota_kelompok_partner')
            .select('id_kelompok')
            .eq('id_murid', _uid())
            .maybeSingle();
          if (memberRow && memberRow.id_kelompok) {
            var { data: partners } = await _sb.from('anggota_kelompok_partner')
              .select('id_murid')
              .eq('id_kelompok', memberRow.id_kelompok)
              .neq('id_murid', _uid());
            var partnerIds = (partners || []).map(function(p) { return p.id_murid; });
            if (partnerIds.length) {
              _sendPushBg({
                user_ids: partnerIds,
                title   : '🕌 Setoran Qiyam Baru',
                body    : payload.nama_murid + ' menyetor hafalan baru: ' + payload.jenis + ' ' + payload.surat + ' Ayat ' + payload.ayat_dari + '-' + payload.ayat_sampai + '. Ketuk untuk menyimak!',
                url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
                tag     : 'partner-qiyam-baru-' + memberRow.id_kelompok,
                data    : { trigger: 'partner_qiyam_baru', id_kelompok: memberRow.id_kelompok }
              });
            }
          }
        } catch(e) {
          console.error('Gagal mengirim push Qiyam ke partner:', e);
        }
      })();
    }

    return { status: 'ok', data };
  },

  // Daftar setoran mandiri partner sekelompok yang menunggu konfirmasi (§3.6 langkah 3)
  getSetoranMenungguKonfirmasi: async function() {
    var { data, error } = await _sb.rpc('get_setoran_menunggu_konfirmasi');
    _check(error, 'getSetoranMenungguKonfirmasi');
    return { status: 'ok', data: data || [] };
  },

  // Konfirmasi setoran mandiri partner + isi kelancaran, catatan & reaksi
  konfirmasiSetoranPartner: async function(id_setoran, kelancaran, catatan_partner, reaksi_partner) {
    var logData = null;
    try {
      var { data } = await _sb.from('setoran_hafalan')
        .select('id_murid, jenis, surat, ayat_dari, ayat_sampai')
        .eq('id_setoran', id_setoran)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('konfirmasi_setoran_partner', {
      p_id_setoran      : id_setoran,
      p_kelancaran      : kelancaran,
      p_catatan_partner : catatan_partner || null,
      p_reaksi_partner  : reaksi_partner || null,
    });
    _check(error, 'konfirmasiSetoranPartner');

    if (logData && logData.id_murid) {
      var partnerUser = _currentUser || {};
      var partnerNama = (partnerUser && (partnerUser.nama_lengkap || partnerUser.nama)) || 'Partner';
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Setoran Dikonfirmasi',
        body    : 'Setoran "' + logData.jenis + ' ' + logData.surat + ' Ayat ' + logData.ayat_dari + '-' + logData.ayat_sampai + '" kamu telah dikonfirmasi oleh ' + partnerNama + '!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
        tag     : 'partner-qiyam-konf-' + id_setoran,
        data    : { trigger: 'partner_qiyam_konf', id_setoran: id_setoran }
      });
    }

    return { status: 'ok' };
  },

  // Tanggal setoran mandiri terakhir tiap anggota kelompok — kartu status pasif (§5.7)
  getStatusKelompokPartner: async function() {
    var { data, error } = await _sb.rpc('get_status_kelompok_partner');
    _check(error, 'getStatusKelompokPartner');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok (Fase 3) — auto-feed setoran + milestone manual ──
  // Feed setoran partner yang sudah dikonfirmasi (anggota kelompok sendiri)
  getLiniMasaSetoran: async function() {
    var { data, error } = await _sb.rpc('get_lini_masa_setoran', { p_id_kelompok: null });
    _check(error, 'getLiniMasaSetoran');
    return { status: 'ok', data: data || [] };
  },
  // Milestone manual kelompok sendiri (RLS membatasi ke kelompok murid)
  getMyMilestones: async function() {
    var { data, error } = await _sb.from('milestone_kelompok_partner')
      .select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMyMilestones');
    return { status: 'ok', data: data || [] };
  },
  addMilestone: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('milestone_kelompok_partner').insert(payload).select().single();
    _check(error, 'addMilestone');
    return { status: 'ok', data: data };
  },
  deleteMilestone: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_partner').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestone');
    return { status: 'ok' };
  },

  // #2 Batalkan / edit setoran mandiri yang masih 'menunggu'
  deleteSetoranMandiri: async function(id_setoran) {
    var { error } = await _sb.from('setoran_hafalan').delete()
      .eq('id_setoran', id_setoran).eq('id_murid', _uid())
      .eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu');
    _check(error, 'deleteSetoranMandiri');
    return { status: 'ok' };
  },
  updateSetoranMandiri: async function(id_setoran, d) {
    var payload = {};
    if (d.jenis      !== undefined) payload.jenis      = d.jenis;
    if (d.surat      !== undefined) payload.surat      = d.surat;
    if (d.juz        !== undefined) payload.juz        = d.juz ? parseInt(d.juz) : null;
    if (d.ayat_dari  !== undefined) payload.ayat_dari  = parseInt(d.ayat_dari);
    if (d.ayat_sampai!== undefined) payload.ayat_sampai= parseInt(d.ayat_sampai);
    if (d.catatan    !== undefined) payload.catatan    = d.catatan || null;
    if (d.lampiran_url !== undefined) payload.lampiran_url = d.lampiran_url || null;
    if (d.audio_durasi_detik !== undefined) payload.audio_durasi_detik = d.audio_durasi_detik ? parseInt(d.audio_durasi_detik) : null;
    var { error } = await _sb.from('setoran_hafalan').update(payload)
      .eq('id_setoran', id_setoran).eq('id_murid', _uid())
      .eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu');
    _check(error, 'updateSetoranMandiri');
    return { status: 'ok' };
  },

  // #1 Data untuk Saran Muraja'ah (semua setoran sendiri yang sah, ringkas)
  getSetoranRingkasSaya: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('surat, juz, jenis, sumber, status_konfirmasi, ayat_dari, ayat_sampai, created_at')
      .eq('id_murid', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getSetoranRingkasSaya');
    return { status: 'ok', data: data || [] };
  },

  // #4 Target bersama kelompok (murid) — beserta progres konsensus tiap anggota.
  // Resilient: bila tabel/relasi target_partner_progress belum ada (migration 021
  // belum dideploy), fallback ke select biasa agar kartu target tetap hidup.
  getTargetKelompok: async function() {
    var res = await _sb.from('target_kelompok_partner')
      .select('*, target_partner_progress(id_murid, nama_murid, selesai_at)')
      .order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_partner')
        .select('*').order('created_at', { ascending: false });
      _check(fb.error, 'getTargetKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  // Konsensus: tandai/batalkan progres target Qiyam untuk diri sendiri.
  tandaiProgressTargetPartner: async function(id_target, selesai) {
    var { error } = await _sb.rpc('tandai_progress_target_partner', {
      p_id_target: id_target, p_selesai: !!selesai,
    });
    _check(error, 'tandaiProgressTargetPartner');
    return { status: 'ok' };
  },
  addTargetKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('target_kelompok_partner').insert(payload).select().single();
    _check(error, 'addTargetKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetKelompok: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_partner').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetKelompok');
    return { status: 'ok' };
  },
  deleteTargetKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_partner').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetKelompok');
    return { status: 'ok' };
  },

  // ── Kelompok Partner Belajar (Level 1-4, non-Qiyam) ──────────────────
  // Kelompok belajar aktif milik murid (beserta anggota)
  getMyKelompokBelajar: async function() {
    var { data, error } = await _sb.from('kelompok_partner_belajar')
      .select('*, anggota_kelompok_belajar(*)')
      .eq('status', 'aktif')
      .maybeSingle();
    _check(error, 'getMyKelompokBelajar');
    return { status: 'ok', data: data || null };
  },

  // Lapor aktivitas belajar mandiri
  addLogBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok    : d.id_kelompok,
      id_halaqah     : d.id_halaqah,
      id_murid       : _uid(),
      nama_murid     : (user && (user.nama_lengkap || user.nama)) || '',
      jenis_aktivitas: d.jenis_aktivitas,
      deskripsi      : d.deskripsi || null,
      durasi_menit   : d.durasi_menit ? parseInt(d.durasi_menit) : null,
      status_konfirmasi: 'menunggu',
      kelancaran     : null,
    };
    if (d.tanggal) payload.tanggal = d.tanggal;
    var { data, error } = await _sb.from('log_belajar_mandiri').insert(payload).select().single();
    _check(error, 'addLogBelajar');

    // Kirim push notification ke partner sekelompok
    if (data && d.id_kelompok) {
      (async function() {
        try {
          var { data: partners } = await _sb.from('anggota_kelompok_belajar')
            .select('id_murid')
            .eq('id_kelompok', d.id_kelompok)
            .neq('id_murid', _uid());
          var partnerIds = (partners || []).map(function(p) { return p.id_murid; });
          if (partnerIds.length) {
            _sendPushBg({
              user_ids: partnerIds,
              title   : '📝 Laporan Belajar Baru',
              body    : payload.nama_murid + ' melaporkan aktivitas belajar baru: "' + payload.jenis_aktivitas + '". Ketuk untuk memberikan konfirmasi!',
              url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
              tag     : 'partner-belajar-baru-' + d.id_kelompok,
              data    : { trigger: 'partner_belajar_baru', id_kelompok: d.id_kelompok }
            });
          }
        } catch(e) {
          console.error('Gagal mengirim push ke partner:', e);
        }
      })();
    }

    return { status: 'ok', data: data };
  },

  // Daftar aktivitas partner sekelompok yang menunggu konfirmasi
  getLogMenungguKonfirmasi: async function() {
    var { data, error } = await _sb.rpc('get_log_menunggu_konfirmasi');
    _check(error, 'getLogMenungguKonfirmasi');
    return { status: 'ok', data: data || [] };
  },

  // Konfirmasi aktivitas partner + isi kelancaran, catatan & reaksi
  konfirmasiLogBelajar: async function(id_log, kelancaran, catatan_partner, reaksi_partner) {
    var logData = null;
    try {
      var { data } = await _sb.from('log_belajar_mandiri')
        .select('id_murid, jenis_aktivitas')
        .eq('id_log', id_log)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('konfirmasi_log_belajar', {
      p_id_log          : id_log,
      p_kelancaran      : kelancaran,
      p_catatan_partner : catatan_partner || null,
      p_reaksi_partner  : reaksi_partner || null,
    });
    _check(error, 'konfirmasiLogBelajar');

    if (logData && logData.id_murid) {
      var partnerUser = _currentUser || {};
      var partnerNama = (partnerUser && (partnerUser.nama_lengkap || partnerUser.nama)) || 'Partner';
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Laporan Dikonfirmasi',
        body    : 'Aktivitas "' + logData.jenis_aktivitas + '" kamu telah dikonfirmasi oleh ' + partnerNama + '!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
        tag     : 'partner-belajar-konf-' + id_log,
        data    : { trigger: 'partner_belajar_konf', id_log: id_log }
      });
    }

    return { status: 'ok' };
  },

  // Tanggal aktivitas terakhir tiap anggota kelompok — kartu status pasif
  getStatusKelompokBelajar: async function() {
    var { data, error } = await _sb.rpc('get_status_kelompok_belajar');
    _check(error, 'getStatusKelompokBelajar');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok — auto-feed aktivitas + milestone manual ──
  getLiniMasaBelajar: async function() {
    var { data, error } = await _sb.rpc('get_lini_masa_belajar', { p_id_kelompok: null });
    _check(error, 'getLiniMasaBelajar');
    return { status: 'ok', data: data || [] };
  },
  // Milestone manual kelompok sendiri (RLS membatasi ke kelompok murid)
  getMyMilestonesBelajar: async function() {
    var { data, error } = await _sb.from('milestone_kelompok_belajar')
      .select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMyMilestonesBelajar');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      tanggal      : d.tanggal || _localDate(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('milestone_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addMilestoneBelajar');
    return { status: 'ok', data: data };
  },
  deleteMilestoneBelajar: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_belajar').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneBelajar');
    return { status: 'ok' };
  },

  // Batalkan / edit aktivitas mandiri yang masih 'menunggu'
  deleteLogBelajar: async function(id_log) {
    var { error } = await _sb.from('log_belajar_mandiri').delete()
      .eq('id_log', id_log).eq('id_murid', _uid()).eq('status_konfirmasi', 'menunggu');
    _check(error, 'deleteLogBelajar');
    return { status: 'ok' };
  },
  updateLogBelajar: async function(id_log, d) {
    var payload = {};
    if (d.jenis_aktivitas !== undefined) payload.jenis_aktivitas = d.jenis_aktivitas;
    if (d.deskripsi       !== undefined) payload.deskripsi       = d.deskripsi || null;
    if (d.durasi_menit    !== undefined) payload.durasi_menit    = d.durasi_menit ? parseInt(d.durasi_menit) : null;
    if (d.tanggal         !== undefined) payload.tanggal         = d.tanggal;
    var { error } = await _sb.from('log_belajar_mandiri').update(payload)
      .eq('id_log', id_log).eq('id_murid', _uid()).eq('status_konfirmasi', 'menunggu');
    _check(error, 'updateLogBelajar');
    return { status: 'ok' };
  },

  // Riwayat aktivitas sendiri (semua status) — data utk Riwayat & "aktivitas tertunda"
  getLogRingkasSaya: async function() {
    var { data, error } = await _sb.from('log_belajar_mandiri')
      .select('id_log, jenis_aktivitas, deskripsi, durasi_menit, tanggal, status_konfirmasi, kelancaran, catatan_partner, reaksi_partner, created_at, updated_at')
      .eq('id_murid', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getLogRingkasSaya');
    return { status: 'ok', data: data || [] };
  },

  // Target bersama kelompok (murid) — beserta progres konsensus tiap anggota.
  // Resilient: bila tabel/relasi target_belajar_progress belum ada (migration
  // belum dideploy), fallback ke select biasa agar kartu target tetap hidup.
  getTargetKelompokBelajar: async function() {
    var res = await _sb.from('target_kelompok_belajar')
      .select('*, target_belajar_progress(id_murid, nama_murid, selesai_at)')
      .order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_belajar')
        .select('*').order('created_at', { ascending: false });
      _check(fb.error, 'getTargetKelompokBelajar');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  // Konsensus: tandai/batalkan progres target untuk diri sendiri.
  // selesai=true menandai; false membatalkan. Status target dihitung ulang
  // server-side -> 'tercapai' hanya bila SEMUA anggota aktif menandai.
  tandaiProgressTargetBelajar: async function(id_target, selesai) {
    var { error } = await _sb.rpc('tandai_progress_target_belajar', {
      p_id_target: id_target, p_selesai: !!selesai,
    });
    _check(error, 'tandaiProgressTargetBelajar');
    return { status: 'ok' };
  },
  addTargetKelompokBelajar: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || '',
    };
    var { data, error } = await _sb.from('target_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addTargetKelompokBelajar');
    return { status: 'ok', data: data };
  },
  updateTargetKelompokBelajar: async function(id_target, updates) {
    var { error } = await _sb.from('target_kelompok_belajar').update(updates).eq('id_target', id_target);
    _check(error, 'updateTargetKelompokBelajar');
    return { status: 'ok' };
  },
  deleteTargetKelompokBelajar: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_belajar').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetKelompokBelajar');
    return { status: 'ok' };
  },

  // Target hafalan berikutnya (setoran terbaru yang punya target_surat)
  getTargetHafalan: async function() {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('target_surat, target_ayat_dari, target_ayat_sampai, nama_guru, created_at')
      .eq('id_murid', _uid())
      .not('target_surat', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    _check(error, 'getTargetHafalan');
    return { status: 'ok', data: data || null };
  },

  // ── CHARGING (catatan penyemangat pribadi) ──
  getChargingNotes: async function() {
    var { data, error } = await _sb.from('charging_notes')
      .select('*')
      .eq('id_user', _uid())
      .order('created_at', { ascending: false });
    _check(error, 'getChargingNotes');
    return { status: 'ok', data: data || [] };
  },

  saveChargingNote: async function(d) {
    var payload = {
      id_user : _uid(),
      content : d.content,
      category: d.category,
      color   : d.color,
      updated_at: new Date().toISOString(),
    };
    var query;
    if (d.id_note) {
      query = _sb.from('charging_notes').update(payload).eq('id_note', d.id_note).eq('id_user', _uid()).select();
    } else {
      query = _sb.from('charging_notes').insert(payload).select();
    }
    var { data, error } = await query;
    _check(error, 'saveChargingNote');
    return { status: 'ok', data: data };
  },

  deleteChargingNote: async function(id_note) {
    var { error } = await _sb.from('charging_notes').delete().eq('id_note', id_note).eq('id_user', _uid());
    _check(error, 'deleteChargingNote');
    return { status: 'ok' };
  },

  kirimSaranMasukan: async function(d) {
    var id_murid = _uid();
    var user = _currentUser || {};
    var { data: anggota } = await _sb.from('anggota').select('id_halaqah').eq('id_murid',id_murid).eq('status','aktif').maybeSingle();
    var id_halaqah = anggota && anggota.id_halaqah || null;
    
    var row = {
      id_murid: d.is_anonymous ? null : id_murid,
      nama_pengirim: d.is_anonymous ? null : (user.nama_lengkap || user.nama || ''),
      kategori_utama: d.kategori_utama,
      sub_kategori: d.sub_kategori,
      id_halaqah: d.kategori_utama === 'program' ? id_halaqah : null,
      rating_guru: d.rating_guru || null,
      rating_materi: d.rating_materi || null,
      isi_masukan: d.isi_masukan,
      is_anonymous: !!d.is_anonymous,
      status: 'pending'
    };
    
    var { error } = await _sb.from('saran_masukan').insert([row]);
    _check(error, 'kirimSaranMasukan');
    return { status: 'ok', message: 'Bismillah, masukan Anda telah terkirim!' };
  },

  kirimSaran: async function(d) {
    return this.kirimSaranMasukan(d);
  },

  getRiwayatSaran: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('saran_masukan')
      .select('*')
      .eq('id_murid', id_murid)
      .order('created_at', { ascending: false });
    _check(error, 'getRiwayatSaran');
    return { status: 'ok', data: data || [] };
  },

  // ── Quiz Murid ─────────────────────────────
  getKuisTersedia: async function() {
    var id_murid = _uid();
    var { data: anggotaData, error: aErr } = await _sb.from('anggota')
      .select('id_halaqah').eq('id_murid', id_murid).eq('status', 'aktif');
    _check(aErr, 'getKuisTersedia:anggota');

    if (!anggotaData || anggotaData.length === 0) return { status: 'ok', data: [] };

    var halaqahIds = anggotaData.map(function(a) { return a.id_halaqah; });

    var { data: qhData, error: qhErr } = await _sb.from('quiz_halaqah')
      .select('id_quiz, quiz(*)')
      .in('id_halaqah', halaqahIds);
    _check(qhErr, 'getKuisTersedia:quiz_halaqah');

    var today = _todayJakarta();
    var kuisList = (qhData || [])
      .map(function(qh) { return qh.quiz; })
      .filter(function(q) {
        if (!q || q.status !== 'aktif') return false;
        if (q.tgl_mulai && q.tgl_mulai > today) return false;
        if (q.tgl_selesai && q.tgl_selesai < today) return false;
        return true;
      });

    if (kuisList.length === 0) return { status: 'ok', data: [] };

    var quizIds = kuisList.map(function(q) { return q.id_quiz; });
    var { data: hasilData } = await _sb.from('hasil_quiz')
      .select('*').eq('id_murid', id_murid).in('id_quiz', quizIds);

    var hasilMap = {};
    (hasilData || []).forEach(function(h) {
      if (!hasilMap[h.id_quiz] || h.skor_total > hasilMap[h.id_quiz].skor_total) {
        hasilMap[h.id_quiz] = h;
      }
    });

    var result = kuisList.map(function(q) {
      var h = hasilMap[q.id_quiz] || null;
      return Object.assign({}, q, {
        sudah_dikerjakan: !!h,
        hasil_terbaik: h
      });
    });

    return { status: 'ok', data: result };
  },

  getKuisDetail: async function(id_quiz) {
    var { data: quizData, error: qErr } = await _sb.from('quiz')
      .select('*, quiz_soal(urutan, bobot_poin, durasi_detik_override, soal(*, soal_pilihan(id_pilihan, teks_pilihan, urutan), soal_pasangan(id_pasangan, teks_kiri, teks_kanan, urutan)))')
      .eq('id_quiz', id_quiz).single();
    _check(qErr, 'getKuisDetail');

    var soalList = (quizData.quiz_soal || []).map(function(qs) {
      var s = qs.soal;
      if (!s) return null;
      var pilihan = (s.soal_pilihan || []).map(function(p) {
        return { id_pilihan: p.id_pilihan, teks_pilihan: p.teks_pilihan, urutan: p.urutan };
      });
      var pasangan = s.soal_pasangan || [];
      if (s.tipe_soal === 'matching') {
        var kananShuffled = pasangan.map(function(p) { return p.teks_kanan; }).sort(function() { return Math.random() - 0.5; });
        pasangan = pasangan.map(function(p, idx) {
          return { id_pasangan: p.id_pasangan, teks_kiri: p.teks_kiri, opsi_kanan: kananShuffled };
        });
      }
      return {
        id_soal: s.id_soal,
        tipe_soal: s.tipe_soal,
        teks_soal: s.teks_soal,
        teks_arab: s.teks_arab,
        highlight_markup: s.highlight_markup,
        audio_url: s.audio_url,
        audio_tipe: s.audio_tipe,
        urutan: qs.urutan,
        bobot_poin: qs.bobot_poin,
        durasi_detik: (qs.durasi_detik_override !== null && qs.durasi_detik_override !== undefined && qs.durasi_detik_override > 0) ? qs.durasi_detik_override : (quizData.durasi_per_soal_detik || 0),
        pilihan: pilihan,
        pasangan: pasangan
      };
    }).filter(Boolean);

    soalList.sort(function(a, b) { return a.urutan - b.urutan; });

    if (quizData.urutan_soal === 'acak') {
      soalList.sort(function() { return Math.random() - 0.5; });
    }

    return {
      status: 'ok',
      data: {
        id_quiz: quizData.id_quiz,
        judul: quizData.judul,
        deskripsi: quizData.deskripsi,
        mode: quizData.mode,
        durasi_per_soal_detik: quizData.durasi_per_soal_detik,
        tampilkan_jawaban: quizData.tampilkan_jawaban,
        boleh_retake: quizData.boleh_retake,
        anti_tab_aktif: quizData.anti_tab_aktif,
        maks_peringatan_tab: quizData.maks_peringatan_tab,
        soal: soalList
      }
    };
  },

  jawabSoal: async function(payload) {
    var { data, error } = await _sb.rpc('jawab_soal', {
      p_id_quiz: payload.id_quiz,
      p_id_soal: payload.id_soal,
      p_attempt_ke: payload.attempt_ke || 1,
      p_id_pilihan: payload.id_pilihan || null,
      p_matching_json: payload.matching_json || null,
      p_teks_isian: payload.teks_isian || null,
      p_waktu_detik: payload.waktu_detik || null
    });
    _check(error, 'jawabSoal');
    return { status: 'ok', data: data };
  },

  submitKuis: async function(payload) {
    var { error } = await _sb.rpc('submit_quiz', {
      p_id_quiz: payload.id_quiz,
      p_attempt_ke: payload.attempt_ke || 1,
      p_durasi_pengerjaan_detik: payload.durasi_pengerjaan_detik || null,
      p_jumlah_tab_switch: payload.jumlah_tab_switch || 0,
      p_total_durasi_keluar_detik: payload.total_durasi_keluar_detik || 0
    });
    _check(error, 'submitKuis');
    return { status: 'ok' };
  },

  getHasilKuisMurid: async function(id_quiz, attempt_ke) {
    var id_murid = _uid();
    var attempt = attempt_ke || 1;
    var [hasilRes, jawabanRes, quizRes, snapRes] = await Promise.all([
      _sb.from('hasil_quiz').select('*').eq('id_quiz', id_quiz).eq('id_murid', id_murid).eq('attempt_ke', attempt).single(),
      _sb.from('jawaban_murid').select('*, soal(*, soal_pilihan(*), soal_pasangan(*))').eq('id_quiz', id_quiz).eq('id_murid', id_murid).eq('attempt_ke', attempt),
      _sb.from('quiz').select('tampilkan_jawaban').eq('id_quiz', id_quiz).single(),
      _sb.from('quiz_soal').select(_SNAP_COLS).eq('id_quiz', id_quiz)
    ]);
    _check(hasilRes.error, 'getHasilKuisMurid:hasil');

    var quizSetting = quizRes.data ? quizRes.data.tampilkan_jawaban : 'setelah_submit';

    // PATCH 066/067: tampilkan konten soal beku (snapshot) alih-alih Bank Soal live.
    var _snapMap = {};
    (snapRes.data || []).forEach(function (r) { _snapMap[r.id_soal] = r; });
    var jawaban = jawabanRes.data || [];
    jawaban.forEach(function (j) { _overrideSoalFromSnap(j.soal, _snapMap[j.id_soal]); });

    return {
      status: 'ok',
      hasil: hasilRes.data,
      jawaban: jawaban,
      tampilkan_jawaban_setting: quizSetting
    };
  },

  getRiwayatKuisMurid: async function() {
    var id_murid = _uid();
    var { data, error } = await _sb.from('hasil_quiz')
      .select('*, quiz(id_quiz, judul, deskripsi, kategori, durasi_per_soal_detik, tampilkan_jawaban)')
      .eq('id_murid', id_murid)
      .order('submitted_at', { ascending: false });
    _check(error, 'getRiwayatKuisMurid');
    return { status: 'ok', data: data || [] };
  },

  getLeaderboardKuis: async function(id_quiz) {
    var { data, error } = await _sb.from('hasil_quiz')
      .select('id_hasil, skor_total, durasi_pengerjaan_detik, attempt_ke, submitted_at, users!hasil_quiz_id_murid_fkey(id_user, nama_lengkap, status)')
      .eq('id_quiz', id_quiz)
      .order('skor_total', { ascending: false })
      .order('durasi_pengerjaan_detik', { ascending: true });

    _check(error, 'getLeaderboardKuis');

    var seenMurid = {};
    var leaderboard = [];
    (data || []).forEach(function(h) {
      if (!h.users || h.users.status !== 'aktif') return;
      if (!seenMurid[h.users.id_user]) {
        seenMurid[h.users.id_user] = true;
        leaderboard.push({
          id_murid: h.users.id_user,
          nama_lengkap: h.users.nama_lengkap,
          skor_total: h.skor_total,
          durasi_pengerjaan_detik: h.durasi_pengerjaan_detik,
          attempt_ke: h.attempt_ke
        });
      }
    });

    return { status: 'ok', data: leaderboard };
  },

  joinSesiLive: async function(kode_join) {
    var { data, error } = await _sb.rpc('join_sesi_live', { p_kode: kode_join });
    _check(error, 'joinSesiLive');
    return { status: 'ok', data: data };
  },

  // ── Maze Adventure (gamifikasi; patch_069) ─────────────
  // GERBANG "nebeng quiz" (mirror getKuisTersedia): level yang ditautkan ke quiz
  // (id_kuis) hanya muncul kalau quiz itu DITUGASKAN ke halaqah murid + status
  // 'aktif' + hari ini di rentang tgl_mulai..tgl_selesai. Level tanpa id_kuis =
  // latihan bebas (selalu tampil). Jadi murid main soal-terhubung hanya setelah
  // guru menugaskan quiz-nya — sama seperti quiz biasa.
  getMazeLevels: async function() {
    var id_murid = _uid();
    // select('*') agar AMAN sebelum/sesudah patch_070 (kolom target_levels/
    // rekomendasi_pertemuan_ke belum ada → undefined → levelOk() = tak menyaring).
    var { data: levels, error } = await _sb.from('maze_level')
      .select('*')
      .eq('aktif', true)
      .order('urutan', { ascending: true });
    _check(error, 'getMazeLevels');
    levels = levels || [];
    if (!levels.length) return { status: 'ok', data: [] };

    // Halaqah + level murid ini (dipakai gerbang quiz DAN filter target_levels)
    var halaqahIds = [], muridLevels = {};
    if (id_murid) {
      var { data: anggotaData } = await _sb.from('anggota')
        .select('id_halaqah, halaqah(level)')
        .eq('id_murid', id_murid).eq('status', 'aktif');
      (anggotaData || []).forEach(function(a){
        halaqahIds.push(a.id_halaqah);
        if (a.halaqah && a.halaqah.level) muridLevels[a.halaqah.level] = true;
      });
    }

    // Quiz yang tersedia untuk murid ini (aturan sama persis dgn quiz)
    var kuisIds = Array.from(new Set(levels.map(function(l){ return l.id_kuis; }).filter(Boolean)));
    var available = {};
    if (kuisIds.length && halaqahIds.length) {
      var { data: qhData } = await _sb.from('quiz_halaqah')
        .select('id_quiz, quiz(id_quiz, status, tgl_mulai, tgl_selesai)')
        .in('id_halaqah', halaqahIds)
        .in('id_quiz', kuisIds);
      var today = _todayJakarta();
      (qhData || []).forEach(function(qh){
        var q = qh.quiz;
        if (!q || q.status !== 'aktif') return;
        if (q.tgl_mulai && q.tgl_mulai > today) return;
        if (q.tgl_selesai && q.tgl_selesai < today) return;
        available[q.id_quiz] = true;
      });
    }

    var halaqahSet = {}; halaqahIds.forEach(function(h){ halaqahSet[h] = true; });

    // Audiens (prioritas paling spesifik): target_halaqah (guru, per-halaqah) >
    // target_levels (admin, per-level) > penugasan quiz (nebeng quiz) > semua.
    function anyIn(arr, set){ for (var i = 0; i < (arr ? arr.length : 0); i++) if (set[arr[i]]) return true; return false; }
    function visible(l){
      if (l.target_halaqah && l.target_halaqah.length) return anyIn(l.target_halaqah, halaqahSet);
      if (l.target_levels && l.target_levels.length)   return anyIn(l.target_levels, muridLevels);
      return !l.id_kuis || available[l.id_kuis];
    }

    var data = levels
      .filter(visible)
      .map(function(l){ return Object.assign({}, l, { ditugaskan: !!l.id_kuis }); });
    return { status: 'ok', data: data };
  },

  // Soal maze via RPC TERPISAH (termasuk is_benar utk feedback instan; aman karena
  // maze nol bobot akademik). JANGAN pakai getKuisDetail (sengaja sembunyikan is_benar).
  getMazeSoal: async function(id_maze_level) {
    var { data, error } = await _sb.rpc('get_maze_soal', { p_id_maze_level: id_maze_level });
    _check(error, 'getMazeSoal');
    return { status: 'ok', data: data || [] };
  },

  // Simpan progress (RPC upsert skor-terbaik). Mengembalikan baris tersimpan sebagai
  // KONFIRMASI (hindari "RLS 0-row silent"): pemanggil wajib cek data != null.
  simpanMazeProgress: async function(payload) {
    var { data, error } = await _sb.rpc('simpan_maze_progress', {
      p_id_maze_level: payload.id_maze_level,
      p_score:         payload.score || 0,
      p_best_time_ms:  (payload.best_time_ms != null ? payload.best_time_ms : null),
      p_nyawa_sisa:    (payload.nyawa_sisa != null ? payload.nyawa_sisa : null),
      p_completed:     !!payload.completed,
      p_badges:        payload.badges || [],
      p_soal_snapshot: payload.soal_snapshot || null
    });
    _check(error, 'simpanMazeProgress');
    if (!data) throw new Error('simpanMazeProgress: baris tidak tersimpan (progress kosong)');
    return { status: 'ok', data: data };
  },

  // Baca progress maze milik murid ini (RLS: hanya baris sendiri).
  getMazeProgress: async function() {
    var { data, error } = await _sb.from('maze_progress')
      .select('id_maze_level, score, best_time_ms, nyawa_sisa, completed, badges, updated_at, maze_level(nama_level)')
      .order('updated_at', { ascending: false });
    _check(error, 'getMazeProgress');
    return { status: 'ok', data: data || [] };
  },

  // ── Rattil Run (murid) — gerbang akses IDENTIK Maze: target_halaqah > target_levels > quiz ──
  getRunLevels: async function() {
    var id_murid = _uid();
    // select('*') agar aman terhadap perubahan kolom (kolom baru → undefined → tak menyaring).
    var { data: levels, error } = await _sb.from('run_level')
      .select('*')
      .eq('aktif', true)
      .order('urutan', { ascending: true });
    _check(error, 'getRunLevels');
    levels = levels || [];
    if (!levels.length) return { status: 'ok', data: [] };

    // Halaqah + level murid ini (dipakai gerbang quiz DAN filter target_levels)
    var halaqahIds = [], muridLevels = {};
    if (id_murid) {
      var { data: anggotaData } = await _sb.from('anggota')
        .select('id_halaqah, halaqah(level)')
        .eq('id_murid', id_murid).eq('status', 'aktif');
      (anggotaData || []).forEach(function(a){
        halaqahIds.push(a.id_halaqah);
        if (a.halaqah && a.halaqah.level) muridLevels[a.halaqah.level] = true;
      });
    }

    // Quiz yang tersedia untuk murid ini (aturan sama persis dgn quiz)
    var kuisIds = Array.from(new Set(levels.map(function(l){ return l.id_kuis; }).filter(Boolean)));
    var available = {};
    if (kuisIds.length && halaqahIds.length) {
      var { data: qhData } = await _sb.from('quiz_halaqah')
        .select('id_quiz, quiz(id_quiz, status, tgl_mulai, tgl_selesai)')
        .in('id_halaqah', halaqahIds)
        .in('id_quiz', kuisIds);
      var today = _todayJakarta();
      (qhData || []).forEach(function(qh){
        var q = qh.quiz;
        if (!q || q.status !== 'aktif') return;
        if (q.tgl_mulai && q.tgl_mulai > today) return;
        if (q.tgl_selesai && q.tgl_selesai < today) return;
        available[q.id_quiz] = true;
      });
    }

    var halaqahSet = {}; halaqahIds.forEach(function(h){ halaqahSet[h] = true; });
    function anyIn(arr, set){ for (var i = 0; i < (arr ? arr.length : 0); i++) if (set[arr[i]]) return true; return false; }
    function visible(l){
      if (l.target_halaqah && l.target_halaqah.length) return anyIn(l.target_halaqah, halaqahSet);
      if (l.target_levels && l.target_levels.length)   return anyIn(l.target_levels, muridLevels);
      return !l.id_kuis || available[l.id_kuis];
    }

    var data = levels
      .filter(visible)
      .map(function(l){ return Object.assign({}, l, { ditugaskan: !!l.id_kuis }); });
    return { status: 'ok', data: data };
  },

  // Soal Run via RPC TERPISAH (termasuk is_benar utk feedback instan; aman krn Run nol bobot akademik).
  getRunSoal: async function(id_run_level) {
    var { data, error } = await _sb.rpc('get_run_soal', { p_id_run_level: id_run_level });
    _check(error, 'getRunSoal');
    return { status: 'ok', data: data || [] };
  },

  // Simpan progress Run (RPC upsert nilai-terbaik). Kembalikan baris tersimpan sbg KONFIRMASI.
  simpanRunProgress: async function(payload) {
    var { data, error } = await _sb.rpc('simpan_run_progress', {
      p_id_run_level:  payload.id_run_level,
      p_score:         payload.score || 0,
      p_best_distance: (payload.best_distance != null ? payload.best_distance : null),
      p_jml_benar:     (payload.jml_benar != null ? payload.jml_benar : null),
      p_nyawa_sisa:    (payload.nyawa_sisa != null ? payload.nyawa_sisa : null),
      p_completed:     !!payload.completed,
      p_badges:        payload.badges || [],
      p_soal_snapshot: payload.soal_snapshot || null
    });
    _check(error, 'simpanRunProgress');
    if (!data) throw new Error('simpanRunProgress: baris tidak tersimpan (progress kosong)');
    return { status: 'ok', data: data };
  },

  // Baca progress Run milik murid ini (RLS: hanya baris sendiri).
  getRunProgress: async function() {
    var { data, error } = await _sb.from('run_progress')
      .select('id_run_level, score, best_distance, jml_benar, nyawa_sisa, completed, badges, updated_at, run_level(nama_level)')
      .order('updated_at', { ascending: false });
    _check(error, 'getRunProgress');
    return { status: 'ok', data: data || [] };
  },
};


// ─────────────────────────────────────────────
//  KETUA API
// ─────────────────────────────────────────────
var KetuaAPI = {
  getInfo: async function() {
    var id_murid = _uid();
    var { data: anggota } = await _sb.from('anggota').select('*, halaqah(*)').eq('id_murid', id_murid).eq('is_ketua', true).maybeSingle();
    if (!anggota) return { status: 'error', message: 'Bukan ketua kelas' };
    if (anggota.halaqah) {
      anggota.halaqah.jam_mulai = anggota.halaqah.jam_mulai ? anggota.halaqah.jam_mulai.substring(0, 5) : null;
      anggota.halaqah.jam_selesai = anggota.halaqah.jam_selesai ? anggota.halaqah.jam_selesai.substring(0, 5) : null;
      anggota.halaqah.nama = anggota.halaqah.nama_halaqah;
    }
    return { status: 'ok', halaqah: anggota.halaqah, anggota };
  },

  getKeaktifanAnggota: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var id_halaqah = info.halaqah.id_halaqah;
    var [anggotaRes, nilaiRes] = await Promise.all([
      _sb.from('anggota').select('id_murid, nama_murid, level, followup_ketua_at, followup_ketua_alpa_kbm, followup_ketua_alpa_at').eq('id_halaqah', id_halaqah).eq('status', 'aktif'),
      _sb.from('nilai_kbm').select('id_murid, status_hadir, kamera_murid, tanggal').eq('id_halaqah', id_halaqah).order('tanggal', { ascending: false }),
    ]);
    if (anggotaRes.error) return { status: 'ok', data: { summary: { kritis:0, peringatan:0, normal:0 }, alerts: [] } };
    var ids = (anggotaRes.data || []).map(function(a) { return a.id_murid; });
    var hpMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.rpc('ketua_get_member_no_hp');
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
        followup_ketua_at      : a.followup_ketua_at || null,
        followup_ketua_alpa_kbm: a.followup_ketua_alpa_kbm || 0,
        followup_ketua_alpa_at : a.followup_ketua_alpa_at || 0,
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
      if (!map[r.id_murid]) map[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid, hadir: 0, alpa: 0, total: 0, riwayat: [] };
      map[r.id_murid].total++;
      if (['H','T'].includes(r.status_hadir)) map[r.id_murid].hadir++;
      // Hanya 'A' (Alpa) yang dihitung sbg ketidakhadiran utk alert — 'I' (Izin) tidak dianggap sama dgn Alpa
      if (r.status_hadir === 'A') map[r.id_murid].alpa++;
      if (map[r.id_murid].riwayat.length < 8) map[r.id_murid].riwayat.push({ warna: ['H','T'].includes(r.status_hadir) ? 'hijau' : (r.status_hadir === 'A' ? 'merah' : 'abu'), tanggal: r.tanggal });
    });
    var ids = Object.keys(map);
    var hpMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.rpc('ketua_get_member_no_hp');
      (users || []).forEach(function(u) { hpMap[u.id_user] = u.no_hp; });
    }
    var alerts = Object.values(map).map(function(m) {
      var alpa = m.alpa;
      var status = alpa >= 2 ? 'kritis' : alpa === 1 ? 'peringatan' : 'normal';
      return {
        id_murid  : m.id_murid,
        nama_murid: m.nama_murid,
        status    : status,
        pct_hadir : m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0,
        absen     : alpa,
        total_sesi: m.total,
        no_hp     : hpMap[m.id_murid] || '',
        riwayat   : m.riwayat
      };
    }).filter(function(m) { return m.status !== 'normal'; });
    return { status: 'ok', data: { alerts: alerts } };
  },

  getTrenKehadiran: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('kbm_log')
      .select('pertemuan_ke, tanggal_pertemuan, jumlah_hadir, jumlah_alpa')
      .eq('id_halaqah', info.halaqah.id_halaqah).eq('status', 'selesai')
      .order('tanggal_pertemuan', { ascending: false }).limit(10);
    if (error) return { status: 'ok', data: [] };
    var rows = (data || []).map(function(k) {
      var total = (k.jumlah_hadir || 0) + (k.jumlah_alpa || 0);
      return {
        pertemuan_ke: k.pertemuan_ke,
        tanggal     : k.tanggal_pertemuan,
        pct_hadir   : total > 0 ? Math.round((k.jumlah_hadir || 0) / total * 100) : null,
      };
    }).reverse(); // urut kronologis (lama -> baru) untuk grafik
    return { status: 'ok', data: rows };
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
    var allSesi = (kbmRes.data || []).map(function(k) {
      var sudah = sudahObsIds.has(k.id_kbm);
      return Object.assign({}, k, {
        tanggal      : k.tanggal_pertemuan,
        window_status: sudah ? 'selesai' : 'terbuka',
      });
    });
    return { status: 'ok', data: allSesi };
  },

  getObservasiHistory: async function() {
    var id_ketua = _uid();
    var { data, error } = await _sb.from('observasi_kbm').select('*, kbm_log(tanggal_pertemuan, pertemuan_ke)')
      .eq('id_ketua', id_ketua).order('created_at', { ascending: false }).limit(20);
    if (error) return { status: 'ok', data: [] };
    return { status: 'ok', data: data || [] };
  },

  getKBMJurnal: async function(id_kbm) {
    var { data, error } = await _sb.from('kbm_log')
      .select('*, halaqah(nama_halaqah, level)')
      .eq('id_kbm', id_kbm)
      .single();
    if (error) {
      console.warn('getKBMJurnal error:', error.message);
      return { status: 'ok', data: null };
    }
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
      
      data.tanggal = data.tanggal_pertemuan;

      // Handle halaqah join result (could be object or array)
      var hqObj = null;
      if (data.halaqah) {
        if (Array.isArray(data.halaqah)) {
          hqObj = data.halaqah[0] || null;
        } else {
          hqObj = data.halaqah;
        }
      }
      data.nama_halaqah = hqObj ? (hqObj.nama_halaqah || '') : '';
      data.level = hqObj ? (hqObj.level || '') : '';

      // Fetch student attendance via SECURITY DEFINER RPC (returns nama_lengkap from users)
      var { data: presensiRes, error: presensiErr } = await _sb.rpc('ketua_get_kbm_presensi', { p_id_kbm: id_kbm });

      if (presensiErr) {
        console.warn('getKBMJurnal: presensi RPC error:', presensiErr.message);
      }

      data.presensi = (presensiRes || []).map(function(r) {
        return {
          id_murid: r.id_murid,
          status_hadir: r.status_hadir,
          nama_murid: r.nama_murid || r.id_murid
        };
      });
    }
    return { status: 'ok', data };
  },

  getRekapStatus: async function() {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('rekap_status').select('*')
      .eq('id_halaqah', info.halaqah.id_halaqah)
      .order('created_at', { ascending: false }).limit(20);
    if (error) return { status: 'ok', data: [] };
    // Return array id_kbm agar Set.has(id_kbm) bekerja di frontend
    return { status: 'ok', data: (data || []).map(function(r) { return r.id_kbm; }) };
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
      estimasi_menit  : d.estimasi_menit,
      kamera_peserta  : d.kamera_peserta,
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

  simpanFollowupKeaktifanKetua: async function(d) {
    var info = await KetuaAPI.getInfo();
    if (info.status !== 'ok') throw new Error('Bukan ketua kelas');
    var id_halaqah = info.halaqah.id_halaqah;

    // Ambil baris anggota
    var q = _sb.from('anggota')
      .select('id_halaqah, catatan_guru, followup_ketua_alpa_kbm, followup_ketua_alpa_at, followup_ketua_at')
      .eq('id_murid', d.id_murid).eq('status','aktif').eq('id_halaqah', id_halaqah);
    var { data: rows, error: anggotaErr } = await q;
    _check(anggotaErr, 'simpanFollowupKeaktifanKetua.fetch');
    var anggota = rows && rows[0];
    if (!anggota) return { status: 'ok' };

    // Hitung alpa KBM dan At-Tibyan per halaqah sebagai baseline dismissal
    var [kbmRes, atRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
    ]);
    var kbmAlpa = kbmRes.count || 0;
    var atAlpa  = atRes.count  || 0;

    // Simpan catatan — batasi 10 entri terakhir agar tidak tumbuh tak terbatas
    var tglStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
    var baris  = '[' + tglStr + '] Ketua Kelas menghubungi murid — ' + (d.tipe_alert||'keaktifan') + ' (' + (d.value||0) + 'x)';
    var existing = anggota.catatan_guru ? anggota.catatan_guru.split('\n').filter(Boolean) : [];
    existing.push(baris);
    var catatan = existing.slice(-10).join('\n'); // simpan maksimal 10 entri

    var { error } = await _sb.from('anggota').update({
      catatan_guru           : catatan,
      followup_ketua_alpa_kbm: kbmAlpa,
      followup_ketua_alpa_at : atAlpa,
      followup_ketua_at      : new Date().toISOString(),
    }).eq('id_murid', d.id_murid).eq('id_halaqah', id_halaqah);
    _check(error, 'simpanFollowupKeaktifanKetua');
    return { status: 'ok' };
  },
};

// ── attach ke window.HQ ──
window.HQ = window.HQ || {};
window.HQ.MuridAPI = MuridAPI;
window.HQ.KetuaAPI = KetuaAPI;
