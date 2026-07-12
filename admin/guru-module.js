// ============================================================
//  Portal Admin — Guru & Halaqah Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Guru & Halaqah Management ---

// ══════════════════════════════════════════
//  APP START
// ══════════════════════════════════════════
async function startApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const nama = currentUser.nama || currentUser.id_user;
  document.getElementById('sbName').textContent  = nama || 'Admin';
  document.getElementById('greet').textContent   = 'Dashboard — ' + nama;

  // Status bendahara dibaca dari kolom DB users.is_bendahara (lewat login response)
  // — BUKAN ditebak dari pola id_user (rapuh: bisa salah kira admin biasa sbg
  // bendahara, atau bendahara sungguhan malah dapat akses penuh).
  var isBendahara = currentUser.role === 'admin' && currentUser.is_bendahara === true;

  if (isBendahara) {
    document.querySelectorAll('.sb-nav button').forEach(function(btn) {
      var p = btn.getAttribute('data-p');
      if (!['dashboard', 'spp'].includes(p)) {
        btn.style.display = 'none';
      }
    });
    document.querySelectorAll('.sb-sec').forEach(function(sec) {
      sec.style.display = 'none';
    });
    var sbRole = document.getElementById('sbRole');
    if (sbRole) sbRole.textContent = 'Bendahara';
  } else if (currentUser.role === 'superadmin') {
    document.querySelectorAll('.nav-superadmin').forEach(function(el) {
      el.style.display = '';
    });
    var sbRole = document.getElementById('sbRole');
    if (sbRole) sbRole.textContent = 'Super Admin';
  }

  await loadMasterData();
  
  if (isBendahara) {
    goPage('spp');
  } else {
    loadDashboard();
  }
  startAdminAutoRefresh();
  resetAdminSession();
}

async function loadMasterData() {
  try {
    const [periodeRes, halaqahRes, usersRes] = await Promise.all([
      window.HQ.AdminAPI.getAllPeriode(),
      window.HQ.AdminAPI.getAllHalaqah(),
      window.HQ.AdminAPI.getAllUsers(),
    ]);
    allPeriode  = periodeRes.data  || [];
    allHalaqah  = halaqahRes.data  || [];
    allUsers    = usersRes.data    || [];
  } catch(e) { console.error('loadMasterData:', e); }
}

// ══════════════════════════════════════════
//  NAVIGASI
// ══════════════════════════════════════════
function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+name)?.classList.add('active');
  document.querySelectorAll('[data-p="'+name+'"]').forEach(b => b.classList.add('active'));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[name] || name;
  closeSB();
  const loaders = {
    dashboard : loadDashboard,
    periode   : loadPeriode,
    users     : () => loadUsers(currentUserTab),
    halaqah   : loadHalaqah,
    anggota   : () => { populateSel('anggotaHalaqahSel', allHalaqah, true); loadAnggota(); },
    pengganti : loadKelasPengganti,
    'kelompok-qiyam' : loadKelompokQiyam,
    'kelompok-belajar' : loadKelompokBelajar,
    komponen  : () => { populatePeriodeSel('komponenPeriodeSel'); if (typeof window.loadKomponen === 'function') window.loadKomponen(); },
    nilai     : () => { populatePeriodeSel('nilaiPeriodeSel'); populateSel('nilaiHalaqahSel', allHalaqah); if (typeof window.loadNilaiSetup === 'function') window.loadNilaiSetup(); },
    raport    : () => { populatePeriodeSel('raportPeriodeSel'); if (typeof window.loadRaportList === 'function') window.loadRaportList(); },
    laporan   : loadLaporan,
    absensi   : () => { populateSel('absensiHalaqahSel', allHalaqah, true); loadAbsensi(); },
    'absensi-guru' : loadAbsensiGuru,
    spp       : function(){ loadMetodeBayarAdmin(); loadSPPAdmin(); },
    pengumuman: loadPengumuman,
    observasi : loadObservasi,
    kepatuhan : loadKepatuhan,
    audit     : loadAudit,
    level    : loadLevel,
    template : loadTemplate,
    arsip    : loadArsipPage,
    materi   : loadMateriAdmin,
    push     : loadPushAdmin,
    saran    : loadSaranPage,
    soal     : loadBankSoalAdmin,
    'indikator-daurah' : () => { if(window.loadIndikatorDaurah) window.loadIndikatorDaurah(); }
  };
  loaders[name]?.();
}

function openSB()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sbOverlay').classList.add('show'); }
function closeSB() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sbOverlay').classList.remove('show'); }

function toggleSidebarCollapse() {
  const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('hq_sidebar_collapsed', isCollapsed ? 'true' : 'false');
}

async function refreshPage() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.style.transform = 'rotate(360deg)'; btn.style.transition = 'transform 0.6s'; }
  setTimeout(() => { if(btn){btn.style.transform='';btn.style.transition='';} }, 700);
  try {
    if (window.HQ && window.HQ.cache && window.HQ.cache.clear) {
      window.HQ.cache.clear();
    }
    await loadMasterData();
    // Fix: variable 'id' tidak terdefinisi — ambil dari element id
    const activePage = document.querySelector('.page.active');
    const activeName = activePage ? activePage.id.replace('page-','') : '';
    if (activeName) goPage(activeName);
  } catch(e) { toast('Gagal refresh: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard() {
  showLoad('Bismillah, memulai perjuangan menjadi sahabat Al-Qur\'an...');
  try {
    const [r, kepatuhanRes] = await Promise.all([
      window.HQ.AdminAPI.getDashboard(),
      window.HQ.AdminAPI.getKepatuhanRekap()
    ]);
    
    const d = r.data;
    const p = d.periode_aktif;
    document.getElementById('periodeInfo').textContent =
      (p && p.nama_periode) ? 'Periode Aktif: ' + p.nama_periode : 'Belum ada periode aktif';
    document.getElementById('st-murid').textContent   = d.total_murid;
    document.getElementById('st-guru').textContent    = d.total_guru;
    document.getElementById('st-halaqah').textContent = d.total_halaqah;
    document.getElementById('st-kbm').textContent     = d.kbm_bulan_ini;
    document.getElementById('st-nilai').textContent   = d.pct_nilai_terisi + '%';
    document.getElementById('st-nilai-bar').style.width = d.pct_nilai_terisi + '%';

    // ── Populate Action Inbox (Opsi 1) ──
    // Saran
    const actSaran = document.getElementById('act-saran');
    const actSaranDesc = document.getElementById('act-saran-desc');
    if (d.saran_pending_count > 0) {
      actSaran.className = 'action-card ac-amber';
      actSaranDesc.textContent = `${d.saran_pending_count} saran masuk belum ditanggapi`;
    } else {
      actSaran.className = 'action-card ac-green';
      actSaranDesc.textContent = 'Semua saran selesai ditindaklanjuti';
    }

    // SPP
    const actSpp = document.getElementById('act-spp');
    const actSppDesc = document.getElementById('act-spp-desc');
    if (d.spp_pending_count > 0) {
      actSpp.className = 'action-card ac-blue';
      actSppDesc.textContent = `${d.spp_pending_count} transfer manual menunggu konfirmasi`;
    } else {
      actSpp.className = 'action-card ac-green';
      actSppDesc.textContent = 'Tidak ada verifikasi pending';
    }

    // Kelas Pengganti
    const actPengganti = document.getElementById('act-pengganti');
    const actPenggantiDesc = document.getElementById('act-pengganti-desc');
    if (d.total_hutang_pengganti > 0) {
      actPengganti.className = 'action-card ac-purple';
      actPenggantiDesc.textContent = `${d.total_hutang_pengganti} sesi libur belum diganti`;
    } else {
      actPengganti.className = 'action-card ac-green';
      actPenggantiDesc.textContent = 'Semua sesi libur telah diganti';
    }

    // ── Populate Halaqah (Opsi 2 - Urut Kehadiran Terendah) ──
    const sortedHalaqah = (d.halaqah || []).slice().sort((a, b) => (a.pct_hadir || 0) - (b.pct_hadir || 0));
    const tbody = document.getElementById('dashHalaqahTbl');
    tbody.innerHTML = sortedHalaqah.map(h => `<tr>
      <td><strong>${esc(h.nama_halaqah)}</strong></td>
      <td>${esc(h.nama_guru)}</td>
      <td><span class="badge b-blue">${esc(h.level)}</span></td>
      <td>${h.total_murid}</td>
      <td>${h.total_sesi}</td>
      <td>${nilaiLabel(h.avg_nilai)}</td>
      <td>${pctBar(h.pct_hadir||0)}</td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada data</td></tr>';

    // ── Populate Compliance Warnings (Opsi 2) ──
    const kList = kepatuhanRes.data || [];
    const warnTbody = document.getElementById('dashWarnList');
    const criticalHalaqahs = kList.filter(h => h.total_kritis > 0);
    if (criticalHalaqahs.length) {
      warnTbody.innerHTML = criticalHalaqahs.map(h => `
        <div class="warn-item">
          <div>
            <span class="warn-name">${esc(h.nama_halaqah)}</span>
            <div class="warn-meta">Guru: ${esc(h.nama_guru)} &middot; Ketua: ${esc(h.nama_ketua)}</div>
          </div>
          <span class="warn-badge" style="background:var(--red-bg);color:var(--red-txt)">${h.total_kritis} Murid Kritis</span>
        </div>
      `).join('');
    } else {
      warnTbody.innerHTML = `<div style="text-align:center;padding:12px;color:var(--green-txt);font-weight:700">✅ Semua halaqah kondusif (0 kritis)</div>`;
    }

    // ── Populate Financial (Opsi 3) ──
    const fin = d.financial_overview || {};
    const pctSppLunas = fin.spp_target_nominal > 0 ? Math.min(Math.round(fin.spp_lunas_nominal / fin.spp_target_nominal * 100), 100) : 0;
    
    document.getElementById('finSppPercent').textContent = pctSppLunas + '%';
    document.getElementById('finSppBar').style.width = pctSppLunas + '%';
    document.getElementById('finSppRatio').textContent = `Rp ${Number(fin.spp_lunas_nominal || 0).toLocaleString('id-ID')} / Rp ${Number(fin.spp_target_nominal || 0).toLocaleString('id-ID')}`;
    
    document.getElementById('finInfaqNominal').textContent = 'Rp ' + Number(fin.infaq_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finIhsanNominal').textContent = 'Rp ' + Number(fin.ihsan_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finGatewayNominal').textContent = 'Rp ' + Number(fin.gateway_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finManualNominal').textContent = 'Rp ' + Number(fin.manual_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finTotalMasuk').textContent = 'Rp ' + Number(fin.total_masuk || 0).toLocaleString('id-ID');

  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

  // --- Observasi KBM Guru Superadmin ---

// ══ OBSERVASI GURU (superadmin) ══════════════════════
// ══ OBSERVASI GURU (superadmin) ══════════════════════
var _obsData  = [];
var _obsStats = [];
var _obsDataFiltered = [];

async function loadObservasi() {
  var idGuru    = document.getElementById('obsFilterGuru').value;
  var idHalaqah = document.getElementById('obsFilterHalaqah').value;
  var tglDari   = document.getElementById('obsDateFrom') ? document.getElementById('obsDateFrom').value : '';
  var tglSampai = document.getElementById('obsDateTo')   ? document.getElementById('obsDateTo').value   : '';
  showLoad('Memuat observasi...');
  try {
    var params = {};
    if (idGuru)    params.id_guru    = idGuru;
    if (idHalaqah) params.id_halaqah = idHalaqah;
    if (tglDari)   params.tgl_dari   = tglDari;
    if (tglSampai) params.tgl_sampai = tglSampai;
    var [rDet, rStat] = await Promise.all([
      window.HQ.SuperAdminAPI.getObservasiKBM(params),
      window.HQ.SuperAdminAPI.getObservasiStats(params),
    ]);
    _obsData  = rDet.data   || [];
    _obsStats = rStat.data  || [];

    // Populate filter guru
    var guruSel = document.getElementById('obsFilterGuru');
    var existing = new Set(Array.from(guruSel.options).map(o=>o.value).filter(v=>v));
    _obsData.forEach(function(r) {
      if (r.id_guru && !existing.has(r.id_guru)) {
        var o = document.createElement('option'); o.value = r.id_guru; o.textContent = r.nama_guru || r.id_guru;
        guruSel.appendChild(o); existing.add(r.id_guru);
      }
    });

    renderObsStats();
    filterObservasiTable();
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  finally { hideLoad(); }
}

// Ambang jumlah sesi minimal supaya persentase dianggap representatif —
// di bawah ini, warna merah/kuning diredam jadi netral & ditandai "data masih sedikit"
var OBS_MIN_SAMPLE = 3;

function renderObsStats() {
  var el = document.getElementById('obsStatsWrap');
  if (!_obsStats.length) { el.innerHTML = ''; return; }

  var sortBy = document.getElementById('obsStatSort') ? document.getElementById('obsStatSort').value : 'total_desc';
  var stats = _obsStats.slice().sort(function(a, b) {
    if (sortBy === 'total_desc')        return b.total - a.total;
    if (sortBy === 'total_asc')         return a.total - b.total;
    if (sortBy === 'kondusif_asc')      return a.pct_kondusif - b.pct_kondusif;
    if (sortBy === 'tepat_waktu_asc')   return a.pct_tepat_waktu - b.pct_tepat_waktu;
    if (sortBy === 'nama_asc')          return (a.nama_guru||'').localeCompare(b.nama_guru||'');
    return 0;
  });

  el.innerHTML = '<div class="section-title" style="font-size:14px;margin-bottom:10px">Rekap per Guru</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:16px">'
    + stats.map(function(g) {
      var sedikit   = g.total < OBS_MIN_SAMPLE;
      var netral    = 'var(--text-2)';
      var cKondusif = sedikit ? netral : (g.pct_kondusif >= 80 ? 'var(--green-txt)' : g.pct_kondusif >= 60 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var cWaktu    = sedikit ? netral : (g.pct_tepat_waktu >= 90 ? 'var(--green-txt)' : g.pct_tepat_waktu >= 70 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var cLatihan  = sedikit ? netral : (g.pct_ada_latihan >= 70 ? 'var(--green-txt)' : g.pct_ada_latihan >= 50 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var badgeSedikit = sedikit
        ? '<span class="badge b-gray" style="font-size:9.5px;font-weight:700" title="Persentase dari sampel kecil belum tentu mencerminkan performa keseluruhan — tunggu lebih banyak data observasi sebelum menyimpulkan">📋 Data masih sedikit (n='+g.total+')</span>'
        : '';
      return '<div class="card" style="padding:16px;cursor:pointer" onclick="filterObsByGuru(\''+esc(g.id_guru||'')+'\',\''+escJs(g.nama_guru||'')+'\')" title="Klik untuk lihat detail observasi guru ini">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text)">'+esc(g.nama_guru)+'</div>'
        + badgeSedikit
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'
        + '<div><div style="color:var(--text-3);font-weight:600">Kondisi Kondusif</div><div style="font-size:20px;font-weight:900;color:'+cKondusif+'">'+g.pct_kondusif+'%</div><div style="color:var(--text-3);font-size:10.5px">'+g.kondusif+' dari '+g.total+' sesi</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Tepat Waktu</div><div style="font-size:20px;font-weight:900;color:'+cWaktu+'">'+g.pct_tepat_waktu+'%</div><div style="color:var(--text-3);font-size:10.5px">Terlambat: '+g.terlambat+'× rata '+g.rata_menit_telat+' mnt</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Ada Latihan</div><div style="font-size:20px;font-weight:900;color:'+cLatihan+'">'+g.pct_ada_latihan+'%</div><div style="color:var(--text-3);font-size:10.5px">'+g.ada_latihan+' dari '+g.total+' sesi</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Kamera Terbuka</div><div style="font-size:20px;font-weight:900;color:var(--blue)">'+g.kamera_sebagian_besar_terbuka+'</div><div style="color:var(--text-3);font-size:10.5px">Campuran: '+g.kamera_campuran+' | Tertutup: '+g.kamera_sebagian_besar_tertutup+'</div></div>'
        + '</div></div>';
    }).join('') + '</div>';
}

// Klik kartu rekap → filter tabel detail ke guru tsb & scroll ke sana
function filterObsByGuru(idGuru, namaGuru) {
  var sel = document.getElementById('obsFilterGuru');
  if (sel && idGuru) {
    var hasOpt = Array.from(sel.options).some(function(o){ return o.value === idGuru; });
    if (!hasOpt) {
      var o = document.createElement('option'); o.value = idGuru; o.textContent = namaGuru || idGuru;
      sel.appendChild(o);
    }
    sel.value = idGuru;
  }
  var search = document.getElementById('obsSearchInput');
  if (search) search.value = idGuru ? '' : (namaGuru || '');
  loadObservasi();
  var anchor = document.getElementById('obsDetailAnchor');
  if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterObservasiTable() {
  const search = (document.getElementById('obsSearchInput')?.value || '').trim().toLowerCase();
  const kondisi = document.getElementById('obsFilterKondisi')?.value || '';
  const sortBy = document.getElementById('obsSort')?.value || 'tanggal_desc';

  _obsDataFiltered = _obsData.filter(r => {
    if (search) {
      const guru = (r.nama_guru || r.id_guru || '').toLowerCase();
      const halaqah = (r.nama_halaqah || r.id_halaqah || '').toLowerCase();
      const catatan = (r.catatan_lain || '').toLowerCase();
      if (!guru.includes(search) && !halaqah.includes(search) && !catatan.includes(search)) {
        return false;
      }
    }
    if (kondisi) {
      if (r.kondisi_kelas !== kondisi) return false;
    }
    return true;
  });

  _obsDataFiltered.sort((a, b) => {
    if (sortBy === 'tanggal_desc') {
      return new Date(b.tanggal || 0) - new Date(a.tanggal || 0);
    } else if (sortBy === 'tanggal_asc') {
      return new Date(a.tanggal || 0) - new Date(b.tanggal || 0);
    } else if (sortBy === 'guru_asc') {
      return (a.nama_guru || '').localeCompare(b.nama_guru || '');
    } else if (sortBy === 'halaqah_asc') {
      return (a.nama_halaqah || '').localeCompare(b.nama_halaqah || '');
    }
    return 0;
  });

  var tbody = document.getElementById('obsDetailTbl');
  if (!_obsDataFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada data observasi sesuai filter</td></tr>';
    return;
  }
  var COND_COLOR = { 'Kondusif':'b-green', 'Kurang Kondusif':'b-amber', 'Tidak Kondusif':'b-red' };
  var WAKTU_COLOR = { 'Tepat Waktu':'b-green', 'Guru Terlambat':'b-red', 'Diakhiri Lebih Awal':'b-amber', 'Keduanya':'b-red' };
  var KAMERA_COLOR = { 'Sebagian Besar Terbuka':'b-green', 'Campuran':'b-amber', 'Sebagian Besar Tertutup':'b-red' };
  tbody.innerHTML = _obsDataFiltered.map(function(r, idx) {
    var menitInfo = r.estimasi_menit > 0 ? ' ('+r.estimasi_menit+' mnt)' : '';
    return '<tr>'
      + '<td>'+fmtDate(r.tanggal)+'<br><small style="color:var(--text-3)">ke-'+esc(String(r.pertemuan_ke||''))+'</small></td>'
      + '<td>'+esc(r.nama_halaqah||r.id_halaqah)+'</td>'
      + '<td style="font-weight:700">'+esc(r.nama_guru||r.id_guru)+'</td>'
      + '<td><span class="badge '+(COND_COLOR[r.kondisi_kelas]||'b-gray')+'" style="font-size:10.5px">'+esc(r.kondisi_kelas||'-')+'</span></td>'
      + '<td><span class="badge '+(r.ada_latihan==='Ya'?'b-green':'b-red')+'" style="font-size:10.5px">'+esc(r.ada_latihan||'-')+'</span></td>'
      + '<td><span class="badge '+(WAKTU_COLOR[r.ketepatan_waktu]||'b-gray')+'" style="font-size:10.5px">'+esc(r.ketepatan_waktu||'-')+menitInfo+'</span></td>'
      + '<td><span class="badge '+(KAMERA_COLOR[r.kamera_peserta]||'b-gray')+'" style="font-size:10.5px">'+esc(r.kamera_peserta||'-')+'</span></td>'
      + '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px" title="' + esc(r.catatan_lain || '–') + '">'+esc(r.catatan_lain||'–')+'</td>'
      + '<td><button class="btn btn-ghost btn-sm" onclick="lihatObsDetail('+idx+')" title="Lihat detail lengkap sesi ini">👁 Detail</button></td>'
      + '</tr>';
  }).join('');
}

function lihatObsDetail(idx) {
  var r = _obsDataFiltered[idx];
  if (!r) return;
  var COND_COLOR = { 'Kondusif':'b-green', 'Kurang Kondusif':'b-amber', 'Tidak Kondusif':'b-red' };
  var WAKTU_COLOR = { 'Tepat Waktu':'b-green', 'Guru Terlambat':'b-red', 'Diakhiri Lebih Awal':'b-amber', 'Keduanya':'b-red' };
  var KAMERA_COLOR = { 'Sebagian Besar Terbuka':'b-green', 'Campuran':'b-amber', 'Sebagian Besar Tertutup':'b-red' };
  var menitInfo = r.estimasi_menit > 0 ? ' ('+r.estimasi_menit+' menit)' : '';
  var rows = [
    ['Tanggal', fmtDate(r.tanggal) + ' &bull; Pertemuan ke-' + esc(String(r.pertemuan_ke||'-'))],
    ['Halaqah', esc(r.nama_halaqah||r.id_halaqah)],
    ['Guru', esc(r.nama_guru||r.id_guru)],
    ['Kondisi Kelas', '<span class="badge '+(COND_COLOR[r.kondisi_kelas]||'b-gray')+'">'+esc(r.kondisi_kelas||'-')+'</span>'],
    ['Ada Latihan', '<span class="badge '+(r.ada_latihan==='Ya'?'b-green':'b-red')+'">'+esc(r.ada_latihan||'-')+'</span>'],
    ['Ketepatan Waktu', '<span class="badge '+(WAKTU_COLOR[r.ketepatan_waktu]||'b-gray')+'">'+esc(r.ketepatan_waktu||'-')+menitInfo+'</span>'],
    ['Kamera Peserta', '<span class="badge '+(KAMERA_COLOR[r.kamera_peserta]||'b-gray')+'">'+esc(r.kamera_peserta||'-')+'</span>']
  ];
  var html = '<div style="display:grid;grid-template-columns:140px 1fr;gap:10px 14px;font-size:13px">'
    + rows.map(function(row) {
        return '<div style="color:var(--text-3);font-weight:600">'+row[0]+'</div><div>'+row[1]+'</div>';
      }).join('')
    + '</div>'
    + '<div style="margin-top:16px">'
    + '<div style="color:var(--text-3);font-weight:600;font-size:13px;margin-bottom:6px">Catatan Lain</div>'
    + '<div style="white-space:pre-wrap;font-size:13px;line-height:1.6;background:var(--bg-2);border-radius:8px;padding:12px">'+esc(r.catatan_lain || '– Tidak ada catatan –')+'</div>'
    + '</div>';
  document.getElementById('obsDetailModalBody').innerHTML = html;
  openModal('modalObsDetail');
}

async function loadAudit() {
  showLoad('Bismillah, memproses...');
  try {
    const r = await window.HQ.SuperAdminAPI.getAuditLog();
    const tbody = document.getElementById('auditTbl');
    tbody.innerHTML = (r.data||[]).map(l=>`<tr>
      <td style="font-size:12px;white-space:nowrap">${esc(l.timestamp)}</td>
      <td><code style="font-size:11px">${esc(l.user_id)}</code></td>
      <td><span class="badge b-blue">${esc(l.action)}</span></td>
      <td style="font-size:12px;color:var(--text-3)">${esc(l.detail)}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada log</td></tr>';
  } catch(e) {}
  finally { hideLoad(); }
}

function miniPctBar(pct, color) {
  return '<div style="display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:2px 0">'
    + '<div style="width:45px;height:5px;background:var(--border);border-radius:100px;overflow:hidden;flex-shrink:0">'
      + '<div style="height:100%;background:'+color+';width:'+Math.min(pct,100)+'%"></div>'
    + '</div>'
    + '<span style="font-size:11px;font-weight:700;color:'+color+';flex-shrink:0;min-width:30px;text-align:right">'+pct+'%</span>'
    + '</div>';
}

async function loadKepatuhan() {
  showLoad('Memuat data kepatuhan...');
  try {
    var res = await window.HQ.AdminAPI.getKepatuhanRekap();
    var list = res.data || [];
    var globalKritis = 0;
    var globalGuruFollowup = 0;
    var globalCompletedKbm = 0;
    var globalCompletedObs = 0;
    list.forEach(function(h) {
      globalKritis += h.total_kritis;
      globalGuruFollowup += h.guru_followed_up;
      globalCompletedKbm += h.total_kbm;
      globalCompletedObs += h.total_obs;
    });
    var guruRate = globalKritis > 0 ? Math.round((globalGuruFollowup / globalKritis) * 100) : 100;
    var ketuaRate = globalCompletedKbm > 0 ? Math.round((globalCompletedObs / globalCompletedKbm) * 100) : 100;
    document.getElementById('kepatuhanTotalKritis').textContent = globalKritis;
    document.getElementById('kepatuhanGuruRate').textContent = guruRate + '%';
    document.getElementById('kepatuhanKetuaRate').textContent = ketuaRate + '%';
    var tbody = document.getElementById('kepatuhanTbl');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="align-center" style="padding:32px;color:var(--text-3)">Belum ada data halaqah aktif</td></tr>';
      return;
    }
    
    // Sort by: lowest KBM observation percentage first. If tie, sort by highest total_kritis first.
    list.sort(function(a, b) {
      var diff = a.pct_obs - b.pct_obs;
      if (diff !== 0) return diff;
      return b.total_kritis - a.total_kritis;
    });

    tbody.innerHTML = list.map(function(h) {
      var cGuru = h.pct_guru_followup >= 80 ? 'var(--green)' : h.pct_guru_followup >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      var cKetua = h.pct_ketua_followup >= 80 ? 'var(--green)' : h.pct_ketua_followup >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      var cObs = h.pct_obs >= 80 ? 'var(--green)' : h.pct_obs >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      return '<tr>'
        + '<td><strong>' + esc(h.nama_halaqah) + '</strong></td>'
        + '<td>' + esc(h.nama_guru) + '</td>'
        + '<td>' + esc(h.nama_ketua) + '</td>'
        + '<td class="align-center"><span class="badge ' + (h.total_kritis > 0 ? 'b-red' : 'b-gray') + '" style="min-width:28px;justify-content:center">' + h.total_kritis + '</span></td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_guru_followup, cGuru)
          + '<br><small style="color:var(--text-3);font-size:10px">' + h.guru_followed_up + ' dari ' + h.total_kritis + '</small>'
        + '</td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_ketua_followup, cKetua)
          + '<br><small style="color:var(--text-3);font-size:10px">' + h.ketua_followed_up + ' dari ' + h.total_kritis + '</small>'
        + '</td>'
        + '<td class="align-center"><span class="badge b-gray" style="font-variant-numeric:tabular-nums">' + h.total_obs + ' / ' + h.total_kbm + '</span></td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_obs, cObs)
        + '</td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    toast('Gagal memuat rekap kepatuhan: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

// ══════════════════════════════════════════
//  SARAN & MASUKAN ADMIN PAGE
// ══════════════════════════════════════════
let allSaranData = [];

async function loadSaranPage() {
  showLoad('Bismillah, memuat daftar saran & masukan...');
  try {
    const res = await window.HQ.AdminAPI.getAllSaran();
    allSaranData = res.data || [];
    calculateSaranStats();
    filterSaran();
  } catch (e) {
    toast('Gagal memuat saran: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

function calculateSaranStats() {
  const total = allSaranData.length;
  const pending = allSaranData.filter(s => s.status === 'pending' || s.status === 'dibaca').length;
  
  // Calculate average rating
  let sumGuru = 0, countGuru = 0;
  let sumMateri = 0, countMateri = 0;
  
  allSaranData.forEach(s => {
    if (s.rating_guru !== null && s.rating_guru !== undefined) {
      sumGuru += s.rating_guru;
      countGuru++;
    }
    if (s.rating_materi !== null && s.rating_materi !== undefined) {
      sumMateri += s.rating_materi;
      countMateri++;
    }
  });
  
  const avgGuru = countGuru > 0 ? (sumGuru / countGuru).toFixed(1) : '–';
  const avgMateri = countMateri > 0 ? (sumMateri / countMateri).toFixed(1) : '–';
  
  document.getElementById('saranStatTotal').textContent = total;
  document.getElementById('saranStatPending').textContent = pending;
  document.getElementById('saranStatAvgGuru').textContent = avgGuru === '–' ? '–' : '⭐ ' + avgGuru;
  document.getElementById('saranStatAvgMateri').textContent = avgMateri === '–' ? '–' : '📖 ' + avgMateri;
}

function filterSaran() {
  const searchVal = document.getElementById('saranSearchInput').value.toLowerCase().trim();
  const catVal = document.getElementById('saranFilterKategori').value;
  const statusVal = document.getElementById('saranFilterStatus').value;
  
  const filtered = allSaranData.filter(s => {
    // Search filter
    const sender = (s.nama_pengirim || 'anonim').toLowerCase();
    const content = (s.isi_masukan || '').toLowerCase();
    const matchSearch = !searchVal || sender.includes(searchVal) || content.includes(searchVal);
    
    // Category filter
    const matchCat = !catVal || s.kategori_utama === catVal;
    
    // Status filter
    const matchStatus = !statusVal || s.status === statusVal;
    
    return matchSearch && matchCat && matchStatus;
  });
  
  renderSaranTable(filtered);
}

function renderSaranTable(list) {
  const tbody = document.getElementById('saranTbl');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="align-center" style="padding:32px;color:var(--text-3)">Tidak ada data saran yang cocok</td></tr>';
    return;
  }
  
  tbody.innerHTML = list.map(s => {
    // Format Date
    let dateStr = '–';
    if (s.created_at) {
      const dt = new Date(s.created_at);
      dateStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Sender Name
    const trueName = (!s.is_anonymous && s.users && s.users.nama_lengkap) ? s.users.nama_lengkap : s.nama_pengirim;
    const senderHtml = s.is_anonymous 
      ? '<span class="badge b-red">🔒 Anonim</span>' 
      : `<strong>${esc(trueName || 'Siswa')}</strong>`;
      
    // Category Badge
    const catBadge = s.kategori_utama === 'portal'
      ? '<span class="badge b-purple">🖥️ Portal & Teknis</span>'
      : '<span class="badge b-blue">📖 Program Kelas</span>';
      
    // Sub-category badge
    const subCatLabel = `<br><small style="color:var(--text-3)">${esc(s.sub_kategori)}</small>`;
    
    // Text Snippet
    const cleanText = esc(s.isi_masukan);
    const shortText = cleanText.length > 70 ? cleanText.substring(0, 70) + '...' : cleanText;
    
    // Rating
    let ratingHtml = '<span style="color:var(--text-3)">–</span>';
    if (s.kategori_utama === 'program') {
      const starGuru = s.rating_guru ? `⭐${s.rating_guru} (G)` : '';
      const starMateri = s.rating_materi ? `⭐${s.rating_materi} (M)` : '';
      ratingHtml = [starGuru, starMateri].filter(Boolean).join('<br>');
    }
    
    // Status Badge
    let statusClass = 'b-amber';
    const statusVal = s.status || 'pending';
    if (statusVal === 'dibaca') statusClass = 'b-blue';
    if (statusVal === 'tindakan') statusClass = 'b-purple';
    if (statusVal === 'selesai') statusClass = 'b-green';
    if (statusVal === 'arsip') statusClass = 'b-teal';
    const statusBadge = `<span class="badge ${statusClass}">${esc(statusVal.toUpperCase())}</span>`;
    
    return `<tr>
      <td style="font-variant-numeric:tabular-nums;white-space:nowrap">${dateStr}</td>
      <td>${senderHtml}</td>
      <td>${catBadge}${subCatLabel}</td>
      <td style="max-width:300px;word-break:break-word">${shortText}</td>
      <td class="align-center" style="white-space:nowrap;font-size:11px">${ratingHtml}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="showSaranDetail('${s.id}')">👁️ Detail / Aksi</button>
      </td>
    </tr>`;
  }).join('');
}

function showSaranDetail(id) {
  const s = allSaranData.find(x => x.id === id);
  if (!s) return;
  
  // Set hidden id
  document.getElementById('saranDetId').value = s.id;
  
  // Set Date
  let dateStr = '–';
  if (s.created_at) {
    const dt = new Date(s.created_at);
    dateStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + 
              dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  document.getElementById('saranDetTanggal').textContent = dateStr;
  
  // Set Sender
  if (s.is_anonymous) {
    document.getElementById('saranDetPengirim').innerHTML = '<span class="badge b-red">🔒 Anonim</span>';
  } else {
    const trueName = (s.users && s.users.nama_lengkap) ? s.users.nama_lengkap : s.nama_pengirim;
    document.getElementById('saranDetPengirim').textContent = trueName || 'Siswa';
  }
  
  // Set Kategori & Sub
  const categoryLabel = s.kategori_utama === 'portal' ? 'Portal & Aplikasi' : 'Program Kelas';
  document.getElementById('saranDetKategori').textContent = categoryLabel + ' (' + s.sub_kategori + ')';
  
  // Set Halaqah
  if (s.kategori_utama === 'program' && s.halaqah) {
    document.getElementById('saranDetHalaqah').textContent = `${s.halaqah.nama_halaqah || '–'} (Guru: ${s.halaqah.nama_guru || '–'})`;
  } else {
    document.getElementById('saranDetHalaqah').textContent = '–';
  }
  
  // Set Ratings
  const wrapGuru = document.getElementById('saranDetRatingGuruWrap');
  const wrapMateri = document.getElementById('saranDetRatingMateriWrap');
  if (s.kategori_utama === 'program') {
    wrapGuru.style.display = s.rating_guru ? 'block' : 'none';
    if (s.rating_guru) document.getElementById('saranDetRatingGuru').textContent = '⭐ ' + s.rating_guru + ' / 5';
    wrapMateri.style.display = s.rating_materi ? 'block' : 'none';
    if (s.rating_materi) document.getElementById('saranDetRatingMateri').textContent = '⭐ ' + s.rating_materi + ' / 5';
  } else {
    wrapGuru.style.display = 'none';
    wrapMateri.style.display = 'none';
  }
  
  // Set Isi
  document.getElementById('saranDetIsi').textContent = s.isi_masukan;
  
  // Set Status
  document.getElementById('saranDetStatus').value = s.status || 'pending';
  
  // Set Tanggapan & Catatan
  document.getElementById('saranDetTanggapan').value = s.tanggapan || '';
  document.getElementById('saranDetCatatanInternal').value = s.catatan_internal || '';
  
  openModal('modalSaranDetail');
}

async function simpanTanggapanSaran() {
  const id = document.getElementById('saranDetId').value;
  const status = document.getElementById('saranDetStatus').value;
  const tanggapan = document.getElementById('saranDetTanggapan').value.trim();
  const catatan_internal = document.getElementById('saranDetCatatanInternal').value.trim();
  
  if (!id) return;
  
  showLoad('Bismillah, menyimpan tanggapan...');
  try {
    const updates = {
      status: status,
      tanggapan: tanggapan || null,
      catatan_internal: catatan_internal || null,
      ditanggapi_at: new Date().toISOString(),
      ditanggapi_oleh: currentUser ? (currentUser.nama_lengkap || currentUser.nama || 'Admin') : 'Admin'
    };
    
    const s = allSaranData.find(x => x.id === id);
    await window.HQ.AdminAPI.updateSaran(id, updates, s ? s.id_murid : null);
    closeModal('modalSaranDetail');
    toast('Tanggapan berhasil disimpan!', 'ok');
    
    // Reload suggestions list
    await loadSaranPage();
  } catch (e) {
    toast('Gagal menyimpan tanggapan: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

// ══════════════════════════════════════════
//  BANK SOAL ADMIN & IMPORT SOAL CSV
// ══════════════════════════════════════════
let _adminBankFilterText = '';
let _adminBankFilterLevel = '';
let _adminBankFilterPertemuan = '';
let _allAdminBankSoalRaw = [];
let _parsedImportSoal = [];

async function loadBankSoalAdmin() {
  showLoad('Bismillah, memuat daftar bank soal...');
  try {
    const res = await window.HQ.QuizAPI.getBankSoal(
      null, 
      null, 
      _adminBankFilterLevel || null, 
      _adminBankFilterPertemuan || null
    );
    _allAdminBankSoalRaw = res.data || [];
    filterAndRenderAdminBankList();
  } catch (err) {
    toast('Gagal memuat bank soal: ' + err.message, 'err');
  } finally {
    hideLoad();
  }
}

function onAdminBankSearchInput(val) {
  _adminBankFilterText = val;
  filterAndRenderAdminBankList();
}

async function onAdminBankLevelFilterChange(val) {
  _adminBankFilterLevel = val;
  await loadBankSoalAdmin();
}

async function onAdminBankPertemuanFilterChange(val) {
  _adminBankFilterPertemuan = val;
  await loadBankSoalAdmin();
}

function getTipeSoalLabelAdmin(tipe) {
  switch (tipe) {
    case 'pilihan_ganda': return 'Pilihan Ganda';
    case 'benar_salah': return 'Benar / Salah';
    case 'matching': return 'Menjodohkan';
    case 'audio': return 'Audio / Suara';
    case 'teks_arab': return 'Teks Arab';
    case 'isian_singkat': return 'Isian Singkat';
    default: return 'Soal';
  }
}

// ── Helper: kelompokkan & urutkan soal per level lalu per pertemuan ──
const ADMIN_LEVEL_ORDER = ['Level 1', 'Level 2', 'Level 3', 'Level Qiyam', 'Micro Teaching', 'Tahsin Al-Fatihah'];

function _adminLevelRank(lvl) {
  const i = ADMIN_LEVEL_ORDER.indexOf(lvl);
  return i === -1 ? ADMIN_LEVEL_ORDER.length : i;
}

// Level utama sebuah soal = level tercentang yang paling awal di urutan kurikulum.
function _adminPrimaryLevel(s) {
  const lvls = (s.levels || []).slice();
  if (!lvls.length) return null;
  lvls.sort((a, b) => _adminLevelRank(a) - _adminLevelRank(b));
  return lvls[0];
}

// Bagi daftar soal menjadi seksi per-level (urut kurikulum, "Tanpa Level" di akhir),
// isi tiap seksi diurutkan naik berdasarkan rekomendasi pertemuan (null di bawah).
function groupAdminSoalByLevel(list) {
  const groups = {};
  list.forEach(s => {
    const key = _adminPrimaryLevel(s) || '__none__';
    (groups[key] = groups[key] || []).push(s);
  });
  return Object.keys(groups).sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    const ra = _adminLevelRank(a), rb = _adminLevelRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b);
  }).map(k => {
    const items = groups[k].slice().sort((x, y) => {
      const px = x.rekomendasi_pertemuan_ke, py = y.rekomendasi_pertemuan_ke;
      const nx = (px === null || px === undefined), ny = (py === null || py === undefined);
      if (nx && ny) return 0;
      if (nx) return 1;
      if (ny) return -1;
      return px - py;
    });
    return { level: k === '__none__' ? null : k, items };
  });
}

function adminLevelSectionHeader(level, count) {
  const label = level || 'Tanpa Level';
  const chip = level
    ? 'background:rgba(16,185,129,0.12);color:#059669;'
    : 'background:var(--bg-2);color:var(--text-3);';
  return `
    <div style="display:flex;align-items:center;gap:8px;margin:18px 0 8px;grid-column:1/-1;">
      <span style="font-size:12px;font-weight:800;${chip}padding:4px 12px;border-radius:100px;white-space:nowrap;">📗 ${esc(label)}</span>
      <span style="font-size:10.5px;font-weight:700;color:var(--text-3);white-space:nowrap;">${count} soal</span>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>`;
}

function adminBankCardHtml(s, num) {
    const authorName = s.users ? s.users.nama_lengkap : 'Pengajar';
    const typeLabel = getTipeSoalLabelAdmin(s.tipe_soal);
    const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '–';
    
    // Levels badges
    const levelsHtml = (s.levels || []).map(lvl => 
      `<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 8px;border-radius:100px;">${esc(lvl)}</span>`
    ).join(' ');

    // Rekomendasi badge
    const rekHtml = s.rekomendasi_pertemuan_ke 
      ? `<span style="font-size:10px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber);padding:2px 8px;border-radius:100px;">📍 Pertemuan ${s.rekomendasi_pertemuan_ke}</span>` 
      : '';

    return `
      <div class="admin-soal-card" style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s ease;display:flex;flex-direction:column;justify-content:space-between;gap:12px;position:relative;">
        <div>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;">
              <!-- Badges -->
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;text-transform:uppercase;letter-spacing:0.02em;">
                  ${typeLabel}
                </span>
                ${levelsHtml}
                ${rekHtml}
              </div>
              <!-- Question text -->
              <div style="font-size:13.5px;font-weight:700;color:var(--text);line-height:1.45;margin-top:4px;word-break:break-word;">
                ${num}. ${esc(s.teks_soal)}
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button onclick="openModalEditSoalAdmin('${escJs(s.id_soal)}')" class="btn-edit-soal-admin" style="background:var(--blue-l);color:var(--blue-d);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Edit Soal">
                ✏️
              </button>
              <button onclick="hapusSoalAdmin('${escJs(s.id_soal)}')" class="btn-delete-soal-admin" style="background:var(--red-l);color:var(--red);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Hapus Soal">
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- Footer Meta Info -->
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;font-size:10.5px;color:var(--text-3);">
          <span>Oleh: <strong>${esc(authorName)}</strong></span>
          <span>Dibuat: ${dateStr}</span>
        </div>
      </div>
    `;
}

function filterAndRenderAdminBankList() {
  const container = document.getElementById('adminBankSoalListContainer');
  if (!container) return;

  const filtered = _allAdminBankSoalRaw.filter(s => {
    if (!_adminBankFilterText) return true;
    const term = _adminBankFilterText.toLowerCase();
    const matchText = (s.teks_soal || '').toLowerCase().includes(term);
    const matchAuthor = (s.users && s.users.nama_lengkap || '').toLowerCase().includes(term);
    return matchText || matchAuthor;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="background:var(--card-solid);padding:40px;border-radius:var(--r-lg);text-align:center;color:var(--text-3);border:1px dashed var(--border);grid-column: 1 / -1;">Tidak ada soal yang cocok dengan filter pencarian.</div>';
    return;
  }

  let html = '';
  groupAdminSoalByLevel(filtered).forEach(g => {
    html += adminLevelSectionHeader(g.level, g.items.length);
    g.items.forEach((s, idx) => {
      html += adminBankCardHtml(s, idx + 1);
    });
  });
  container.innerHTML = html;
}

// ══════════════════════════════════════════
//  EDITOR BANK SOAL (ADMIN) — parity penuh editor guru, memakai updateSoalFull
// ══════════════════════════════════════════
function closeAdminSoalModal() {
  var modalEl = document.getElementById('adminSoalEditModalContainer');
  if (modalEl) modalEl.innerHTML = '';
}

async function openModalEditSoalAdmin(id_soal) {
  var modalEl = document.getElementById('adminSoalEditModalContainer');
  if (!modalEl) return;

  var editingSoal = null;
  try {
    showLoad('Memuat detail soal...');
    var res = await window.HQ.QuizAPI.getSoalDetail(id_soal);
    editingSoal = res.data;
  } catch (err) {
    hideLoad();
    toast('Gagal memuat detail soal: ' + friendlyError(err), 'err');
    return;
  }
  hideLoad();
  if (!editingSoal) { toast('Soal tidak ditemukan', 'err'); return; }

  var t = editingSoal.tipe_soal;
  var sel = function(v) { return t === v ? 'selected' : ''; };

  modalEl.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeAdminSoalModal()">
      <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:800;color:var(--text)">📝 Edit Soal (Bank Soal)</h3>
          <button onclick="closeAdminSoalModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
        </div>

        <form onsubmit="submitFormEditSoalAdmin(event, '${escJs(editingSoal.id_soal)}')">
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TIPE SOAL *</label>
            <select id="csTipe" disabled style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              <option value="pilihan_ganda" ${sel('pilihan_ganda')}>Pilihan Ganda</option>
              <option value="benar_salah" ${sel('benar_salah')}>Benar / Salah</option>
              <option value="matching" ${sel('matching')}>Matching (Menjodohkan)</option>
              <option value="audio" ${sel('audio')}>Audio / Suara</option>
              <option value="teks_arab" ${sel('teks_arab')}>Teks Arab</option>
              <option value="isian_singkat" ${sel('isian_singkat')}>Isian Singkat</option>
            </select>
          </div>

          <!-- Levels Checkboxes -->
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">LEVEL HALAQAH *</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg-2);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 1"> Level 1</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 2"> Level 2</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 3"> Level 3</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level Qiyam"> Level Qiyam</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Micro Teaching"> Micro Teaching</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Tahsin Al-Fatihah"> Tahsin Al-Fatihah</label>
            </div>
          </div>

          <!-- Rekomendasi Pertemuan Ke- -->
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">REKOMENDASI PERTEMUAN KE (OPSIONAL)</label>
            <input type="number" id="csRekomendasiPertemuan" placeholder="Contoh: 23" min="1" value="${editingSoal.rekomendasi_pertemuan_ke ? editingSoal.rekomendasi_pertemuan_ke : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
          </div>

          <!-- Default Durasi & Poin -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT DURASI (DETIK)</label>
              <input type="number" id="csDurasiDefault" placeholder="Kosongkan jika default kuis" min="0" value="${editingSoal.durasi_detik_default !== null && editingSoal.durasi_detik_default !== undefined ? editingSoal.durasi_detik_default : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT POIN</label>
              <input type="number" id="csPoinDefault" placeholder="Default: 10" min="0" value="${editingSoal.bobot_poin_default !== null && editingSoal.bobot_poin_default !== undefined ? editingSoal.bobot_poin_default : '10'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TEKS PERTANYAAN (LATIN) *</label>
            <textarea id="csTeksSoal" required rows="2" placeholder="Ketik pertanyaan di sini..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;">${esc(editingSoal.teks_soal)}</textarea>
          </div>

          <div id="csTeksArabWrap" style="display:none;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label style="font-size:11px;font-weight:700;color:var(--text-2);">TEKS ARAB</label>
              <button type="button" onclick="adminApplyTajwidHighlight()" style="font-size:10.5px;font-weight:800;color:var(--blue-d);background:var(--blue-l);border:none;padding:3px 8px;border-radius:100px;cursor:pointer;">✨ Tandai Highlight Tajwid</button>
            </div>
            <textarea id="csTeksArab" rows="2" oninput="adminUpdateTeksArabPreview(this.value)" placeholder="Gunakan {[...]} untuk highlight kata/hukum tajwid" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:'Amiri',serif;font-size:18px;direction:rtl;outline:none;resize:vertical;">${editingSoal.teks_arab ? esc(editingSoal.teks_arab) : ''}</textarea>
            <div style="margin-top:6px;">
              <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:2px;">Pratinjau Teks Arab:</div>
              <div id="csTeksArabPreview" style="font-family:'Amiri',serif;font-size:22px;direction:rtl;text-align:center;padding:12px;background:var(--bg-2);border-radius:var(--r-sm);border:1px solid var(--border);min-height:48px;word-break:break-word;">
                <span style="color:var(--text-3);">–</span>
              </div>
            </div>
          </div>

          <div id="csAudioWrap" style="display:none;margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URL AUDIO (GDrive / YouTube / MP3 Direct)</label>
            <input type="url" id="csAudioUrl" value="${editingSoal.audio_url ? esc(editingSoal.audio_url) : ''}" placeholder="https://..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
          </div>

          <!-- Options Container Dynamic -->
          <div id="csDynamicOptions" style="margin-bottom:14px;"></div>

          <div style="display:flex;gap:10px;margin-top:18px;">
            <button type="button" onclick="closeAdminSoalModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
            <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Prefill level checkboxes
  var lvls = editingSoal.levels || [];
  document.querySelectorAll('.csLevelCheck').forEach(function(cb) {
    cb.checked = lvls.indexOf(cb.value) !== -1;
  });

  // Render dynamic options for this type
  adminOnTipeSoalChange(t);

  // Prefill answers
  if (t === 'pilihan_ganda' || t === 'audio' || t === 'teks_arab') {
    var pils = editingSoal.soal_pilihan || [];
    var pilInputs = document.querySelectorAll('.csPil');
    var radioInputs = document.querySelectorAll('input[name="csBenar"]');
    pils.forEach(function(p, i) {
      if (pilInputs[i]) pilInputs[i].value = p.teks_pilihan || '';
      if (radioInputs[i]) radioInputs[i].checked = !!p.is_benar;
    });
  } else if (t === 'benar_salah') {
    var pilsBs = editingSoal.soal_pilihan || [];
    var trueBenar = pilsBs.some(function(p) { return p.teks_pilihan === 'Benar' && p.is_benar; });
    var bsInputs = document.querySelectorAll('input[name="csBsBenar"]');
    if (bsInputs[0]) bsInputs[0].checked = trueBenar;
    if (bsInputs[1]) bsInputs[1].checked = !trueBenar;
  } else if (t === 'matching') {
    var pas = editingSoal.soal_pasangan || [];
    var kiriInputs = document.querySelectorAll('.csMatchKiri');
    var kananInputs = document.querySelectorAll('.csMatchKanan');
    pas.forEach(function(p, i) {
      if (kiriInputs[i]) kiriInputs[i].value = p.teks_kiri || '';
      if (kananInputs[i]) kananInputs[i].value = p.teks_kanan || '';
    });
  } else if (t === 'isian_singkat') {
    var kun = editingSoal.soal_kunci_isian || [];
    var keys = kun.map(function(k) { return k.teks_kunci; }).join(', ');
    var inputKunci = document.getElementById('csIsianKunci');
    if (inputKunci) inputKunci.value = keys;
  }

  if (editingSoal.teks_arab) {
    adminUpdateTeksArabPreview(editingSoal.teks_arab);
  }
}

function adminOnTipeSoalChange(tipe) {
  var arabWrap = document.getElementById('csTeksArabWrap');
  var audioWrap = document.getElementById('csAudioWrap');
  var optionsDiv = document.getElementById('csDynamicOptions');

  if (arabWrap) arabWrap.style.display = (tipe === 'teks_arab') ? 'block' : 'none';
  if (audioWrap) audioWrap.style.display = (tipe === 'audio') ? 'block' : 'none';

  if (!optionsDiv) return;

  if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">OPSI PILIHAN (Pilih Kunci Jawaban Benar):</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="0" checked> <input type="text" class="csPil" required placeholder="Pilihan A" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="1"> <input type="text" class="csPil" required placeholder="Pilihan B" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="2"> <input type="text" class="csPil" placeholder="Pilihan C (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="3"> <input type="text" class="csPil" placeholder="Pilihan D (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
      </div>
    `;
  } else if (tipe === 'benar_salah') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">KUNCI JAWABAN BENAR:</label>
      <div style="display:flex;gap:16px;">
        <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="benar" checked> ✅ Benar</label>
        <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="salah"> ❌ Salah</label>
      </div>
    `;
  } else if (tipe === 'matching') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">PASANGAN (TEKS KIRI ↔ TEKS KANAN):</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" placeholder="Teks Kiri 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" placeholder="Teks Kanan 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
      </div>
    `;
  } else if (tipe === 'isian_singkat') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">VARIAN KUNCI JAWABAN (Pisahkan dengan koma):</label>
      <input type="text" id="csIsianKunci" required placeholder="mis. Idgham Bighunnah, idgham bighunnah" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
    `;
  }
}

function adminApplyTajwidHighlight() {
  var el = document.getElementById('csTeksArab');
  if (!el) return;
  var start = el.selectionStart;
  var end = el.selectionEnd;
  var val = el.value;
  if (start === end) {
    alert('Silakan blok/seleksi beberapa huruf atau kata Arab terlebih dahulu untuk ditandai!');
    return;
  }
  var selected = val.substring(start, end);
  el.value = val.substring(0, start) + '{[' + selected + ']}' + val.substring(end);
  el.dispatchEvent(new Event('input'));
  el.focus();
}

function adminUpdateTeksArabPreview(val) {
  var previewEl = document.getElementById('csTeksArabPreview');
  if (!previewEl) return;
  if (!val) {
    previewEl.innerHTML = '<span style="color:var(--text-3); font-size:14px;">–</span>';
    return;
  }
  var html = esc(val).replace(/\{\[(.*?)\]\}/g, function(match, content) {
    return `<span style="background:rgba(239,68,68,0.15); border-bottom:2px solid #ef4444; border-radius:4px; padding:2px 4px; font-weight:800; color:var(--text);">${content}</span>`;
  });
  previewEl.innerHTML = html;
}

async function submitFormEditSoalAdmin(e, id_soal) {
  e.preventDefault();
  var tipe = document.getElementById('csTipe').value;
  var teksSoal = document.getElementById('csTeksSoal').value.trim();

  var selectedLevels = Array.from(document.querySelectorAll('.csLevelCheck:checked')).map(function(cb) {
    return cb.value;
  });

  if (selectedLevels.length === 0) {
    alert('Pilih minimal satu level halaqah!');
    return;
  }

  var rekomendasiPertemuan = document.getElementById('csRekomendasiPertemuan').value;
  var durasiDefault = document.getElementById('csDurasiDefault').value;
  var poinDefault = document.getElementById('csPoinDefault').value;

  var payload = {
    tipe_soal: tipe,
    teks_soal: teksSoal,
    teks_arab: document.getElementById('csTeksArab') ? document.getElementById('csTeksArab').value.trim() : null,
    audio_url: document.getElementById('csAudioUrl') ? document.getElementById('csAudioUrl').value.trim() : null,
    levels: selectedLevels,
    rekomendasi_pertemuan_ke: rekomendasiPertemuan || null,
    durasi_detik_default: durasiDefault !== '' ? parseInt(durasiDefault) : null,
    bobot_poin_default: poinDefault !== '' ? parseInt(poinDefault) : 10,
    pilihan: [],
    pasangan: [],
    kunci_isian: []
  };

  if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
    var pilInputs = Array.from(document.querySelectorAll('.csPil'));
    var selectedBenarIdx = parseInt(document.querySelector('input[name="csBenar"]:checked').value);
    payload.pilihan = pilInputs.map(function(inp, idx) {
      if (!inp.value.trim()) return null;
      return { teks_pilihan: inp.value.trim(), is_benar: idx === selectedBenarIdx };
    }).filter(Boolean);
  } else if (tipe === 'benar_salah') {
    var isBenarSelected = document.querySelector('input[name="csBsBenar"]:checked').value === 'benar';
    payload.pilihan = [
      { teks_pilihan: 'Benar', is_benar: isBenarSelected },
      { teks_pilihan: 'Salah', is_benar: !isBenarSelected }
    ];
  } else if (tipe === 'matching') {
    var kiriInputs = Array.from(document.querySelectorAll('.csMatchKiri'));
    var kananInputs = Array.from(document.querySelectorAll('.csMatchKanan'));
    payload.pasangan = kiriInputs.map(function(kInp, idx) {
      var kiriText = kInp.value.trim();
      var kananText = kananInputs[idx] ? kananInputs[idx].value.trim() : '';
      if (!kiriText || !kananText) return null;
      return { teks_kiri: kiriText, teks_kanan: kananText };
    }).filter(Boolean);
  } else if (tipe === 'isian_singkat') {
    var rawKunci = document.getElementById('csIsianKunci').value;
    payload.kunci_isian = rawKunci.split(',').map(function(k){ return k.trim(); }).filter(Boolean);
  }

  try {
    showLoad('Menyimpan perubahan soal...');
    await window.HQ.QuizAPI.updateSoalFull(id_soal, payload);
    hideLoad();
    closeAdminSoalModal();
    toast('Soal berhasil diperbarui di Bank Soal!', 'ok');
    await loadBankSoalAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menyimpan soal: ' + friendlyError(err), 'err');
  }
}

async function hapusSoalAdmin(id_soal) {
  if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;
  showLoad('Menghapus soal...');
  try {
    await window.HQ.QuizAPI.deleteSoal(id_soal);
    toast('Soal berhasil dihapus!', 'ok');
    await loadBankSoalAdmin();
  } catch (err) {
    toast('Gagal menghapus soal: ' + err.message, 'err');
  } finally {
    hideLoad();
  }
}

function bukaModalImportSoal() {
  _parsedImportSoal = [];
  const dz = document.getElementById('dropZoneSoal');
  if (dz) {
    dz.style.background = '';
    dz.style.borderColor = 'var(--border)';
    dz.innerHTML = '<div style="font-size:36px;margin-bottom:8px">☁️</div>'
      + '<div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Drag berkas CSV Soal ke sini atau klik untuk memilih</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:4px">Format berkas: .csv (UTF-8) — Maksimal 200 soal per unggahan</div>';
  }
  document.getElementById('importPreviewBoxSoal').style.display = 'none';
  document.getElementById('importProgressSoal').style.display = 'none';
  document.getElementById('btnImportSoal').disabled = true;
  document.getElementById('csvFileInputSoal').value = '';
  document.getElementById('btnBatalImportSoal').disabled = false;
  openModal('modalImportSoal');
}

function downloadTemplateSoal() {
  const header = 'tipe_soal;teks_soal;teks_arab;audio_url;pilihan;pasangan;kunci_isian;levels;rekomendasi_pertemuan_ke;durasi_detik_default;bobot_poin_default';
  const sample = [
    'pilihan_ganda;Huruf manakah yang keluar dari Wasatul Halq?;Wakqul Halq;;ع*|غ|ء|ق;;;Level 1,Level 2;23;15;10',
    'benar_salah;Huruf Ghain dan Kha keluar dari ujung tenggorokan (Adnal Halq).;;;Benar*|Salah;;;Level 1;23;30;10',
    'isian_singkat;Berapakah total huruf hijaiyah makhraj Al-Halq?;;;;;6|enam;;Level 1;23;20;15',
    'matching;Jodohkan bagian Al-Halq dengan hurufnya;;;;Aqshal:Hamzah|Wasatul:Ain|Adnal:Ghain;Level 1,Tahsin Al-Fatihah;;;10'
  ].join('\n');
  
  const blob = new Blob([header + '\n' + sample], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'template_import_soal_rattil.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleFileSelectSoal(e) {
  const file = e.target.files[0];
  if (!file) return;
  parseCSVSoal(file);
}

// Drag & drop logic setup
window.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZoneSoal');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--blue)'; dz.style.background = 'rgba(56,189,248,.05)'; });
  dz.addEventListener('dragleave', e => { e.preventDefault(); dz.style.borderColor = 'var(--border)'; dz.style.background = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = 'var(--border)'; dz.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file) parseCSVSoal(file);
  });
});

function parseCSVSoal(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    
    if (lines.length < 2) {
      toast('Berkas CSV kosong atau tidak memiliki baris data!', 'err');
      return;
    }
    
    // Parse header to check correctness
    const header = lines[0].toLowerCase().split(';');
    const expected = ['tipe_soal','teks_soal','teks_arab','audio_url','pilihan','pasangan','kunci_isian','levels','rekomendasi_pertemuan_ke'];
    const isHeaderValid = expected.every(col => header.includes(col));
    
    if (!isHeaderValid) {
      toast('Header CSV tidak cocok dengan template! Gunakan separator titik koma (;)', 'err');
      return;
    }

    const colIndex = {};
    header.forEach((name, idx) => { colIndex[name] = idx; });

    _parsedImportSoal = [];
    let validCount = 0;

    const tbody = document.getElementById('importPreviewTbodySoal');
    tbody.innerHTML = '';

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(';');
      if (row.length < expected.length) continue;

      const getValue = (colName) => (row[colIndex[colName]] || '').trim();

      const tipe = getValue('tipe_soal').toLowerCase();
      const teks_soal = getValue('teks_soal');
      const teks_arab = getValue('teks_arab') || null;
      const audio_url = getValue('audio_url') || null;
      const pilihanRaw = getValue('pilihan');
      const pasanganRaw = getValue('pasangan');
      const kunciRaw = getValue('kunci_isian');
      const levelsRaw = getValue('levels');
      const rekRaw = getValue('rekomendasi_pertemuan_ke');
      const durRaw = header.includes('durasi_detik_default') ? getValue('durasi_detik_default') : '';
      const poinRaw = header.includes('bobot_poin_default') ? getValue('bobot_poin_default') : '';

      const item = {
        tipe_soal: tipe,
        teks_soal: teks_soal,
        teks_arab: teks_arab,
        audio_url: audio_url,
        pilihan: [],
        pasangan: [],
        kunci_isian: [],
        levels: [],
        rekomendasi_pertemuan_ke: null,
        durasi_detik_default: null,
        bobot_poin_default: 10,
        error: ''
      };

      // Validasi Tipe Soal
      const tipeValid = ['pilihan_ganda', 'benar_salah', 'matching', 'audio', 'teks_arab', 'isian_singkat'].includes(tipe);
      if (!tipe) {
        item.error = 'Tipe soal kosong';
      } else if (!tipeValid) {
        item.error = `Tipe '${tipe}' tidak valid`;
      }

      // Validasi Teks Soal
      if (!teks_soal && !item.error) {
        item.error = 'Teks soal wajib diisi';
      }

      // Parse & Validasi Pilihan
      if (['pilihan_ganda', 'benar_salah', 'audio', 'teks_arab'].includes(tipe) && !item.error) {
        if (!pilihanRaw) {
          item.error = 'Kolom pilihan wajib diisi untuk tipe ini';
        } else {
          const pils = pilihanRaw.split('|').map(p => p.trim()).filter(Boolean);
          if (pils.length < 2) {
            item.error = 'Minimal harus ada 2 pilihan jawaban';
          } else {
            let correctCount = 0;
            pils.forEach((p, idx) => {
              const isCorrect = p.endsWith('*');
              const cleanText = isCorrect ? p.slice(0, -1).trim() : p;
              if (isCorrect) correctCount++;
              item.pilihan.push({
                teks_pilihan: cleanText,
                is_benar: isCorrect,
                urutan: idx + 1
              });
            });
            if (correctCount === 0) {
              item.error = 'Tidak ada pilihan jawaban benar (akhiri dengan *)';
            } else if (correctCount > 1) {
              item.error = 'Ada lebih dari 1 pilihan jawaban benar';
            }
          }
        }
      }

      // Parse & Validasi Pasangan (Matching)
      if (tipe === 'matching' && !item.error) {
        if (!pasanganRaw) {
          item.error = 'Kolom pasangan wajib diisi untuk tipe matching';
        } else {
          const pairs = pasanganRaw.split('|').map(p => p.trim()).filter(Boolean);
          if (pairs.length < 2) {
            item.error = 'Minimal harus ada 2 pasangan menjodohkan';
          } else {
            pairs.forEach((p, idx) => {
              const parts = p.split(':');
              if (parts.length !== 2) {
                item.error = 'Format pasangan salah (Gunakan Kiri:Kanan)';
              } else {
                item.pasangan.push({
                  teks_kiri: parts[0].trim(),
                  teks_kanan: parts[1].trim(),
                  urutan: idx + 1
                });
              }
            });
          }
        }
      }

      // Parse & Validasi Kunci Isian (Short Answer)
      if (tipe === 'isian_singkat' && !item.error) {
        if (!kunciRaw) {
          item.error = 'Kunci isian wajib diisi untuk isian singkat';
        } else {
          const kuncis = kunciRaw.split('|').map(k => k.trim()).filter(Boolean);
          if (kuncis.length === 0) {
            item.error = 'Kunci isian kosong';
          } else {
            kuncis.forEach(k => {
              item.kunci_isian.push({ teks_kunci: k });
            });
          }
        }
      }

      // Parse Levels
      if (levelsRaw) {
        item.levels = levelsRaw.split(',').map(l => l.trim()).filter(Boolean);
      }

      // Parse Rekomendasi Pertemuan
      if (rekRaw) {
        const num = parseInt(rekRaw);
        if (!isNaN(num) && num > 0) {
          item.rekomendasi_pertemuan_ke = num;
        }
      }

      // Parse Durasi Default
      if (durRaw) {
        const num = parseInt(durRaw);
        if (!isNaN(num) && num >= 0) {
          item.durasi_detik_default = num;
        }
      }

      // Parse Poin Default
      if (poinRaw) {
        const num = parseInt(poinRaw);
        if (!isNaN(num) && num >= 0) {
          item.bobot_poin_default = num;
        }
      }

      if (!item.error) validCount++;

      _parsedImportSoal.push(item);

      // Render preview row
      const statusHtml = item.error 
        ? `<span style="color:var(--red);font-weight:700">❌ ${esc(item.error)}</span>` 
        : '<span style="color:var(--green);font-weight:700">✅ Valid</span>';
      
      const badgeTipe = getTipeSoalLabelAdmin(tipe);
      
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><span class="badge b-blue" style="font-size:9px">${esc(badgeTipe)}</span></td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(teks_soal)}">${esc(teks_soal)}</td>
          <td>${(item.levels || []).map(l => `<span class="badge b-green" style="font-size:9px">${esc(l)}</span>`).join(' ') || '–'}</td>
          <td class="align-center">${item.rekomendasi_pertemuan_ke || '–'}</td>
          <td>${statusHtml}</td>
        </tr>
      `);
    }

    document.getElementById('previewCountSoal').textContent = _parsedImportSoal.length;
    document.getElementById('importPreviewBoxSoal').style.display = 'block';
    
    const dropZone = document.getElementById('dropZoneSoal');
    dropZone.style.borderColor = validCount === _parsedImportSoal.length ? 'var(--green)' : 'var(--amber)';
    dropZone.innerHTML = `<div style="font-size:32px">📂</div>`
      + `<div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Berkas: ${esc(file.name)}</div>`
      + `<div style="font-size:11px;color:var(--text-3);margin-top:4px">${validCount} dari ${_parsedImportSoal.length} soal valid dan siap diimpor.</div>`;

    document.getElementById('btnImportSoal').disabled = validCount === 0;
  };
  reader.readAsText(file);
}

async function prosesImportSoal() {
  const validSoalList = _parsedImportSoal.filter(s => !s.error);
  if (validSoalList.length === 0) return;

  document.getElementById('btnImportSoal').disabled = true;
  document.getElementById('btnBatalImportSoal').disabled = true;
  
  const progBox = document.getElementById('importProgressSoal');
  const progBar = document.getElementById('importProgressBarSoal');
  const progText = document.getElementById('importProgressTextSoal');
  
  progBox.style.display = 'block';
  progBar.style.width = '0%';
  progText.textContent = '0%';

  let importedCount = 0;

  for (let i = 0; i < validSoalList.length; i++) {
    const s = validSoalList[i];
    try {
      const payload = {
        tipe_soal: s.tipe_soal,
        teks_soal: s.teks_soal,
        teks_arab: s.teks_arab,
        audio_url: s.audio_url,
        pilihan: s.pilihan,
        pasangan: s.pasangan,
        kunci_isian: s.kunci_isian,
        levels: s.levels,
        rekomendasi_pertemuan_ke: s.rekomendasi_pertemuan_ke,
        durasi_detik_default: s.durasi_detik_default,
        bobot_poin_default: s.bobot_poin_default
      };
      
      await window.HQ.QuizAPI.createSoal(payload);
      importedCount++;
    } catch (err) {
      console.error('prosesImportSoal failed row:', i, err);
    }
    
    const percent = Math.round(((i + 1) / validSoalList.length) * 100);
    progBar.style.width = percent + '%';
    progText.textContent = percent + '%';
  }

  toast(`Impor Selesai! ${importedCount} dari ${validSoalList.length} soal berhasil masuk ke Bank Soal.`, 'ok');
  closeModal('modalImportSoal');
  await loadBankSoalAdmin();
}

// ══════════════════════════════════════════
//  HELPERS UI
// ══════════════════════════════════════════
function populateSel(selId, list, addAll=false) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const allOpt = addAll ? '<option value="">Semua Halaqah</option>' : '<option value="">— Pilih Halaqah —</option>';
  sel.innerHTML = allOpt + (list||allHalaqah).map(h =>
    `<option value="${esc(h.id_halaqah)}">${esc(h.nama_halaqah)}</option>`).join('');
}

function populatePeriodeSel(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Pilih Periode —</option>' +
    allPeriode.map(p => `<option value="${esc(p.id_periode)}" ${p.status==='aktif'?'selected':''}>${esc(p.nama_periode)}${p.status==='aktif'?' ✓':''}</option>`).join('');
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toast(msg, type='') {
  const icons  = {ok:'✅',err:'❌',warn:'⚠️','':'ℹ️'};
  const titles = {ok:'Berhasil',err:'Gagal',warn:'Perhatian','':'Info'};
  document.getElementById('notifIcon').textContent  = icons[type]||'ℹ️';
  document.getElementById('notifTitle').textContent = titles[type]||'Info';
  document.getElementById('notifMsg').textContent   = msg;
  const btn = document.getElementById('notifBtn');
  btn.className = 'notif-btn '+(type||'info');
  btn.textContent = type==='err'?'Tutup':type==='warn'?'Mengerti':'OK';
  btn.onclick = closeNotif;
  document.getElementById('notifOverlay').classList.add('show');
}
function closeNotif() { document.getElementById('notifOverlay').classList.remove('show'); }

function showLoad(msg='Bismillah...') { document.getElementById('loaderTxt').textContent=msg; document.getElementById('loader').classList.add('show'); }
function hideLoad() { document.getElementById('loader').classList.remove('show'); }
function setBtn(id,dis,txt) { const el=document.getElementById(id); if(!el)return; el.disabled=dis; el.textContent=txt; }

function roleBadge(r) {
  const m={admin:'b-red',guru:'b-green',murid:'b-blue'};
  return `<span class="badge ${m[r]||'b-gray'}">${r}</span>`;
}
function predikatBadge(p) {
  const m={'Mumtaz':'b-green','Jayyid Jiddan':'b-blue','Jayyid':'b-amber','Maqbul':'b-red'};
  return p?`<span class="badge ${m[p]||'b-gray'}">${p}</span>`:'–';
}
function statusRaportBadge(s) {
  const m={draft:'b-amber',published:'b-blue',terkirim:'b-green'};
  return `<span class="badge ${m[s]||'b-gray'}">${s||'–'}</span>`;
}
function nilaiLabel(avg) {
  const n = Number(avg);
  if (!n) return '–';
  if (n>=3.5) return '<span class="badge b-green">Mumtaz</span>';
  if (n>=2.5) return '<span class="badge b-blue">Jayyid Jiddan</span>';
  if (n>=1.5) return '<span class="badge b-amber">Jayyid</span>';
  return '<span class="badge b-red">Maqbul</span>';
}
function nilaiNumLabel(avg) {
  const n = Number(avg);
  if (!n) return '–';
  return `<span style="font-weight:700">${n.toFixed(1)}</span>`;
}
function pctBar(pct) {
  const color = pct>=75?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:5px;background:var(--border);border-radius:100px;min-width:60px">
      <div style="height:5px;background:${color};border-radius:100px;width:${Math.min(pct,100)}%"></div>
    </div>
    <span style="font-size:11.5px;font-weight:700;color:${color};flex-shrink:0">${pct}%</span>
  </div>`;
}
function fmtDate(d) { if(!d) return '–'; return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Ubah error teknis mentah menjadi pesan yang ramah & bisa dimengerti pengguna.
function friendlyError(e) {
  var m = (e && e.message) ? String(e.message) : (typeof e === 'string' ? e : '');
  if (!m) return 'Terjadi kesalahan. Silakan coba lagi.';
  var low = m.toLowerCase();
  if (low.indexOf('failed to fetch') >= 0 || low.indexOf('networkerror') >= 0 ||
      low.indexOf('network request failed') >= 0 || low.indexOf('load failed') >= 0)
    return 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';
  if (low.indexOf('jwt') >= 0 || low.indexOf('unauthorized') >= 0 ||
      low.indexOf('not authenticated') >= 0 || low.indexOf('401') >= 0)
    return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (low.indexOf('timeout') >= 0 || low.indexOf('timed out') >= 0)
    return 'Permintaan terlalu lama. Coba lagi sebentar.';
  if (low.indexOf('relation') >= 0 || low.indexOf('column') >= 0 || low.indexOf('syntax') >= 0 ||
      low.indexOf('supabase') >= 0 || low.indexOf('pgrst') >= 0 || /[{}<>]/.test(m) || m.length > 120)
    return 'Gagal memuat data. Coba lagi sebentar.';
  return m;
}
// escJs: aman untuk teks yang ditaruh di dalam string ber-kutip-tunggal pada atribut onclick="...".
// esc() TIDAK escape kutip tunggal, sehingga nama ber-apostrof (mis. "Mu'adz") memutus string JS
// dan tombolnya mati. Urutan: entity HTML dulu, lalu escape backslash & kutip tunggal untuk JS.
function escJs(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }


// ══════════════════════════════════════════
//  PUSH NOTIFIKASI ADMIN
// ══════════════════════════════════════════
async function loadPushAdmin() {
  try {
    var r = await window.HQ.AdminAPI.getPushStats();
    var d = r.data;
    document.getElementById('pushStatTotal').textContent = d.total;
    document.getElementById('pushStatMurid').textContent = d.murid;
    document.getElementById('pushStatGuru').textContent  = d.guru;
    document.getElementById('pushStatAdmin').textContent = d.admin;
    renderPushLog(d.logs);
  } catch(e) { console.warn('loadPushStats:', e); }
  try {
    var r2 = await window.HQ.AdminAPI.getPushConfig();
    renderPushConfig(r2.data);
  } catch(e) { console.warn('loadPushConfig:', e); }
  loadOnboarding();
  // Load halaqah & level untuk dropdown target
  loadPushTargetOptions();
}

  // Export functions to window
  if (typeof window !== "undefined") {
    window.startApp = startApp;
    window.loadMasterData = loadMasterData;
    window.goPage = goPage;
    window.openSB = openSB;
    window.closeSB = closeSB;
    window.toggleSidebarCollapse = toggleSidebarCollapse;
    window.refreshPage = refreshPage;
    window.loadDashboard = loadDashboard;
    window.loadObservasi = loadObservasi;
    window.renderObsStats = renderObsStats;
    window.filterObsByGuru = filterObsByGuru;
    window.filterObservasiTable = filterObservasiTable;
    window.lihatObsDetail = lihatObsDetail;
    window.loadAudit = loadAudit;
    window.miniPctBar = miniPctBar;
    window.loadKepatuhan = loadKepatuhan;
    window.loadSaranPage = loadSaranPage;
    window.calculateSaranStats = calculateSaranStats;
    window.filterSaran = filterSaran;
    window.renderSaranTable = renderSaranTable;
    window.showSaranDetail = showSaranDetail;
    window.simpanTanggapanSaran = simpanTanggapanSaran;
    window.loadBankSoalAdmin = loadBankSoalAdmin;
    window.onAdminBankSearchInput = onAdminBankSearchInput;
    window.onAdminBankLevelFilterChange = onAdminBankLevelFilterChange;
    window.onAdminBankPertemuanFilterChange = onAdminBankPertemuanFilterChange;
    window.getTipeSoalLabelAdmin = getTipeSoalLabelAdmin;
    window.filterAndRenderAdminBankList = filterAndRenderAdminBankList;
    window.hapusSoalAdmin = hapusSoalAdmin;
    window.openModalEditSoalAdmin = openModalEditSoalAdmin;
    window.closeAdminSoalModal = closeAdminSoalModal;
    window.adminOnTipeSoalChange = adminOnTipeSoalChange;
    window.adminApplyTajwidHighlight = adminApplyTajwidHighlight;
    window.adminUpdateTeksArabPreview = adminUpdateTeksArabPreview;
    window.submitFormEditSoalAdmin = submitFormEditSoalAdmin;
    window.bukaModalImportSoal = bukaModalImportSoal;
    window.downloadTemplateSoal = downloadTemplateSoal;
    window.handleFileSelectSoal = handleFileSelectSoal;
    window.parseCSVSoal = parseCSVSoal;
    window.prosesImportSoal = prosesImportSoal;
    window.populateSel = populateSel;
    window.populatePeriodeSel = populatePeriodeSel;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.toast = toast;
    window.closeNotif = closeNotif;
    window.showLoad = showLoad;
    window.hideLoad = hideLoad;
    window.setBtn = setBtn;
    window.roleBadge = roleBadge;
    window.predikatBadge = predikatBadge;
    window.statusRaportBadge = statusRaportBadge;
    window.nilaiLabel = nilaiLabel;
    window.nilaiNumLabel = nilaiNumLabel;
    window.pctBar = pctBar;
    window.fmtDate = fmtDate;
    window.esc = esc;
    window.friendlyError = friendlyError;
    window.escJs = escJs;
    window.loadPushAdmin = loadPushAdmin;
  }
})();
