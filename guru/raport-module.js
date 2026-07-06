// ══════════════════════════════════════════════════════════════
//  Rattil Portal Guru — Modul Raport & Raport Tahfidz (raport-module.js)
//  Ekstraksi Fase 3: Memecah monolitik guru/index.html
// ══════════════════════════════════════════════════════════════

(function() {
// ── RAPORT HALAQAH ──
// ══════════════════════════════════════════════════════════
//  RAPORT HALAQAH
// ══════════════════════════════════════════════════════════
var _raportPeriode    = '';
var _raportHalaqah   = '';
var _raportKomponen  = [];  // komponen manual
var _raportMuridList = [];
var _raportData      = [];  // hasil generate

async function onRaportPeriodeChange() {
  var pSel = document.getElementById('raportPeriodeSel');
  _raportPeriode = pSel.value;
  _raportData    = [];

  // Isi halaqah dropdown dari window.HQ.AppState.halaqahList yang sudah dimuat
  var hSel = document.getElementById('raportHalaqahSel');
  hSel.innerHTML = '<option value="">— Pilih Halaqah —</option>'
    + (window.HQ.AppState.halaqahList || []).map(function(h) {
        return '<option value="'+esc(h.id_halaqah)+'">'+esc(h.nama_halaqah)+'</option>';
      }).join('');

  // Auto-select jika hanya satu halaqah
  if (window.HQ.AppState.halaqahList && window.HQ.AppState.halaqahList.length === 1) {
    hSel.value = window.HQ.AppState.halaqahList[0].id_halaqah;
    await onRaportHalaqahChange();
  } else {
    _hideRaportSections();
  }

  if (!_raportPeriode) return;
  // Muat komponen manual untuk periode ini
  try {
    var r = await window.HQ.GuruAPI.getKomponenRaport(_raportPeriode);
    _raportKomponen = (r.data || []).filter(function(k) {
      return k.status === 'aktif' && k.tipe === 'manual';
    });
  } catch(e) {
    _raportKomponen = [];
  }
}

async function onRaportHalaqahChange() {
  _raportHalaqah = document.getElementById('raportHalaqahSel').value;
  _raportData    = [];
  _hideRaportSections();
  if (!_raportPeriode || !_raportHalaqah) return;

  showLoad('Memuat data murid dan nilai...');
  try {
    var [muridRes, nilaiRes, catatanRes] = await Promise.all([
      window.HQ.GuruAPI.getMurid(_raportHalaqah),
      window.HQ.GuruAPI.getNilaiManual(_raportPeriode),
      window.HQ.GuruAPI.getCatatanHalaqah(_raportHalaqah),
    ]);
    _raportMuridList = muridRes.data || [];
    var nilaiExisting = nilaiRes.data || [];

    // Render nilai manual
    var nilaiCard = document.getElementById('raportNilaiCard');
    if (_raportKomponen.length) {
      document.getElementById('raportNilaiBody').innerHTML = _raportMuridList.map(function(m) {
        return '<div style="margin-bottom:14px;padding:12px;border:1px solid var(--border);border-radius:10px">'
          + '<div style="font-weight:700;font-size:13.5px;margin-bottom:8px">👤 '+esc(m.nama_murid)+'</div>'
          + '<div class="f'+Math.min(_raportKomponen.length,3)+' gap">'
          + _raportKomponen.map(function(k) {
              var ex = nilaiExisting.find(function(n) { return n.id_murid===m.id_murid && n.id_komponen===k.id_komponen; });
              return '<div class="fg" style="margin:0">'
                + '<label style="font-size:11.5px">'+esc(k.nama_komponen)+' ('+k.bobot+'%)</label>'
                + '<input type="number" class="fc" min="0" max="100" id="rn_'+m.id_murid+'_'+k.id_komponen+'"'
                + ' value="'+((ex && ex.nilai !== undefined && ex.nilai !== '') ? ex.nilai : '')+'"'
                + ' placeholder="0-100" style="font-size:13px">'
                + '</div>';
            }).join('')
          + '</div></div>';
      }).join('') || '<div style="color:var(--text-3);padding:12px">Belum ada murid aktif</div>';
      nilaiCard.style.display = '';
    } else {
      nilaiCard.style.display = 'none';
    }

    // Render catatan
    document.getElementById('raportCatatanTa').value = (catatanRes.data && catatanRes.data.catatan) || '';
    document.getElementById('raportCatatanCard').style.display = '';
    document.getElementById('raportGenerateWrap').style.display = '';

    // Cek apakah sudah ada raport sebelumnya
    try {
      var listRes = await window.HQ.GuruAPI.getRaportListGuru(_raportHalaqah, _raportPeriode);
      if (listRes.data && listRes.data.length) {
        _raportData = listRes.data;
        _renderRaportPreview(true);
      }
    } catch(e) {}

  } catch(e) {
    toast('Gagal memuat data: '+e.message, 'err');
  } finally {
    hideLoad();
  }
}

function _hideRaportSections() {
  ['raportNilaiCard','raportCatatanCard','raportGenerateWrap','raportPreviewCard'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

async function raportSimpanNilai() {
  if (!_raportPeriode) return toast('Pilih periode dulu','err');
  if (!_raportHalaqah) return toast('Pilih halaqah dulu','err');
  showLoad('Menyimpan nilai manual...');
  try {
    var nilaiList = [];
    _raportMuridList.forEach(function(m) {
      _raportKomponen.forEach(function(k) {
        var el = document.getElementById('rn_'+m.id_murid+'_'+k.id_komponen);
        if (!el || el.value === '') return;
        // Clamp ke 0-100 — atribut min/max HTML hanya validasi UI, tidak menjamin
        // nilai yang benar-benar terkirim (mis. paste manual / devtools) tetap dalam rentang.
        var nilai = Math.min(100, Math.max(0, Number(el.value) || 0));
        nilaiList.push({ id_murid:m.id_murid, id_komponen:k.id_komponen, nama_komponen:k.nama_komponen, nilai:nilai });
      });
    });
    if (!nilaiList.length) return toast('Tidak ada nilai untuk disimpan','warn');
    await window.HQ.GuruAPI.saveNilaiManualBatch({ id_periode:_raportPeriode, id_halaqah:_raportHalaqah, nilai_list:nilaiList });
    toast(nilaiList.length+' nilai disimpan!','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function raportSimpanCatatan() {
  if (!_raportHalaqah) return toast('Pilih halaqah dulu','err');
  var catatan = document.getElementById('raportCatatanTa').value.trim();
  showLoad('Menyimpan catatan...');
  try {
    await window.HQ.GuruAPI.saveCatatanHalaqah({ id_halaqah:_raportHalaqah, catatan:catatan });
    toast('Catatan halaqah disimpan!','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function raportGenerate() {
  if (!_raportPeriode) return toast('Pilih periode dulu','err');
  if (!_raportHalaqah) return toast('Pilih halaqah dulu','err');
  showLoad('Generating raport... (bisa 10-30 detik)');
  try {
    var r = await window.HQ.GuruAPI.generateRaportHalaqah({ id_halaqah:_raportHalaqah, id_periode:_raportPeriode });
    _raportData = r.data && r.data.berhasil ? r.data.berhasil : [];
    if (r.data && r.data.gagal && r.data.gagal.length) {
      toast(r.data.gagal.length+' murid gagal di-generate: '+r.data.gagal.map(function(g){return g.nama;}).join(', '), 'warn');
    }
    _renderRaportPreview(false);
    toast(r.message || 'Raport berhasil digenerate!', 'ok');
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

function _renderRaportPreview(isExisting) {
  var card  = document.getElementById('raportPreviewCard');
  var table = document.getElementById('raportPreviewTable');
  var wrap  = document.getElementById('raportPublishWrap');
  var alert = document.getElementById('raportAlertBox');
  card.style.display = '';

  if (!_raportData.length) {
    table.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3)">Belum ada data raport</div>';
    wrap.style.display = 'none';
    alert.style.display = 'none';
    return;
  }

  // Hitung status
  var draftCount     = _raportData.filter(function(r){ return r.status === 'draft' || !r.status; }).length;
  var publishedCount = _raportData.filter(function(r){ return r.status === 'published'; }).length;
  var statusEl = document.getElementById('raportPublishStatus');
  if (statusEl) statusEl.textContent = publishedCount+' sudah publish · '+draftCount+' draft';

  // Header kolom komponen dari data pertama
  var firstKomponen = (_raportData[0] && _raportData[0].detail) || (_raportData[0] && _raportData[0].komponen) || [];
  var kompHeaders = firstKomponen.map(function(k){ return k.nama_komponen; });

  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">'
    + '<thead><tr style="background:var(--blue);color:#fff">'
    + '<th style="padding:8px 10px;text-align:left;white-space:nowrap">Nama Murid</th>'
    + kompHeaders.map(function(n){ return '<th style="padding:8px 6px;text-align:center;white-space:nowrap">'+esc(n)+'</th>'; }).join('')
    + '<th style="padding:8px 10px;text-align:center">Nilai</th>'
    + '<th style="padding:8px 10px;text-align:center">Predikat</th>'
    + '<th style="padding:8px 10px;text-align:center">Status</th>'
    + '</tr></thead><tbody>';

  _raportData.forEach(function(r, i) {
    var komp = r.detail || r.komponen || [];
    var isPublished = r.status === 'published';
    html += '<tr style="background:'+(i%2===0?'var(--card)':'var(--bg)')+'">'
      + '<td style="padding:8px 10px;font-weight:700">'+esc(r.nama_murid)+'</td>'
      + komp.map(function(k){
          var bg = k.nilai >= 80 ? '#f0fdf4' : k.nilai >= 60 ? '#fffbeb' : '#fff1f2';
          return '<td style="padding:8px 6px;text-align:center;background:'+bg+';font-weight:700">'+k.nilai+'</td>';
        }).join('')
      + '<td style="padding:8px 10px;text-align:center;font-weight:800;font-size:14px">'+r.nilai_akhir+'</td>'
      + '<td style="padding:8px 10px;text-align:center">'
        + '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:'
          + (r.predikat==='Mumtaz'?'#dcfce7;color:#166534'
            :r.predikat==='Jayyid Jiddan'?'#dbeafe;color:#1e40af'
            :r.predikat==='Jayyid'?'#fef9c3;color:#854d0e'
            :'#fee2e2;color:#991b1b')+'">'+esc(r.predikat)+'</span>'
        + '</td>'
      + '<td style="padding:8px 10px;text-align:center">'
        + '<span style="font-size:11px;font-weight:700;color:'+(isPublished?'var(--green)':'var(--amber)')+'">'+
          (isPublished ? '✓ Published' : '● Draft')+'</span>'
        + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  table.innerHTML = html;

  // Alert double check (hanya jika ada yang draft)
  if (draftCount > 0) {
    var halaqahNama = (window.HQ.AppState.halaqahList || []).find(function(h){ return h.id_halaqah===_raportHalaqah; });
    var periodeNama = (allPeriode   || []).find(function(p){ return p.id_periode===_raportPeriode; });
    document.getElementById('raportAlertBody').innerHTML =
      '• <b>Halaqah:</b> '+esc(halaqahNama ? halaqahNama.nama_halaqah : _raportHalaqah)+'<br>'
      + '• <b>Periode:</b> '+esc(periodeNama ? periodeNama.nama_periode : _raportPeriode)+'<br>'
      + '• <b>Jumlah murid:</b> '+_raportData.length+' murid<br>'
      + '• <b>Siap publish:</b> '+draftCount+' raport (draft → published)<br><br>'
      + 'Pastikan <b>nama murid</b>, <b>nilai setiap komponen</b>, dan <b>catatan wali halaqah</b> '
      + 'sudah benar sebelum dipublish. Raport yang sudah dipublish akan langsung terlihat oleh murid. '
      + 'Publish adalah tanggung jawab guru wali halaqah.';
    alert.style.display = '';
    wrap.style.display  = '';
  } else {
    alert.style.display = 'none';
    wrap.style.display  = 'none';
  }
}

async function raportPublishSemua() {
  if (!_raportHalaqah || !_raportPeriode) return;
  var draftCount = _raportData.filter(function(r){ return r.status==='draft'||!r.status; }).length;
  if (!draftCount) return toast('Semua raport sudah dipublish','warn');
  if (!(await showConfirm('Publish '+draftCount+' raport ke murid?\n\nRaport yang sudah dipublish akan langsung terlihat oleh murid di portal mereka. Pastikan semua nilai dan catatan sudah benar.', { title: 'Publish Raport?', okText: 'Ya, Publish' }))) return;
  showLoad('Mempublish raport...');
  try {
    var r = await window.HQ.GuruAPI.publishAllRaportHalaqah({ id_halaqah:_raportHalaqah, id_periode:_raportPeriode });
    toast(r.message || 'Raport berhasil dipublish!', 'ok');
    // Refresh list
    var listRes = await window.HQ.GuruAPI.getRaportListGuru(_raportHalaqah, _raportPeriode);
    _raportData = listRes.data || [];
    _renderRaportPreview(true);
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// Init raport page: isi dropdown periode saat halaman dibuka
async function initRaportPage() {
  var pSel = document.getElementById('raportPeriodeSel');
  if (pSel.options.length > 1) {
    // Sudah terisi (dari loadNilaiSetup atau sebelumnya)
    if (!allPeriode.length) return;
  }
  try {
    if (!allPeriode.length) {
      var r = await window.HQ.GuruAPI.getAllPeriode();
      allPeriode = r.data || [];
    }
    pSel.innerHTML = '<option value="">— Pilih Periode —</option>'
      + allPeriode.map(function(p) {
          return '<option value="'+esc(p.id_periode)+'"'+(p.status==='aktif'?' selected':'')+'>'+esc(p.nama_periode)+(p.status==='aktif'?' ✓':'')+'</option>';
        }).join('');

    // Isi halaqah dari window.HQ.AppState.halaqahList
    var hSel = document.getElementById('raportHalaqahSel');
    hSel.innerHTML = '<option value="">— Pilih Halaqah —</option>'
      + (window.HQ.AppState.halaqahList || []).map(function(h) {
          return '<option value="'+esc(h.id_halaqah)+'">'+esc(h.nama_halaqah)+'</option>';
        }).join('');

    // Auto-select aktif periode dan single halaqah
    if (pSel.value) await onRaportPeriodeChange();
  } catch(e) { console.error('initRaportPage:', e); }
}


// ── RAPORT TAHFIDZ ──
// ══════════════════════════════════════════════════════════════
//  RAPORT TAHFIDZ — GURU
// ══════════════════════════════════════════════════════════════

var _rtPeriodeList = [];
var _rtLastData    = null;  // hasil terakhir untuk print

async function initRaportTahfidz() {
  var qiyam = (window.HQ.AppState.halaqahList || []).filter(function(h){ return h.level === 'Level Qiyam'; });
  // Halaqah selector
  var hSel = document.getElementById('rtHalaqahSel');
  hSel.innerHTML = '<option value="">— Pilih Halaqah —</option>'
    + qiyam.map(function(h){ return '<option value="'+esc(h.id_halaqah)+'">'+esc(h.nama_halaqah)+'</option>'; }).join('');
  if (qiyam.length === 1) hSel.value = qiyam[0].id_halaqah;
  if (hSel.value) rtOnHalaqahChange();
  // Periode selector
  try {
    var r = await window.HQ.GuruAPI.getAllPeriode();
    _rtPeriodeList = r.data || [];
    var pSel = document.getElementById('rtPeriodeSel');
    pSel.innerHTML = '<option value="semua">Semua Waktu</option>'
      + _rtPeriodeList.map(function(p){
          return '<option value="'+esc(p.id_periode)+'">'+esc(p.nama_periode)+'</option>';
        }).join('');
  } catch(e) {}
  // Reset output
  document.getElementById('rtOutput').style.display  = 'none';
  document.getElementById('rtEmpty').style.display   = 'block';
  document.getElementById('rtLoading').style.display = 'none';
}

async function rtOnHalaqahChange() {
  var id_halaqah = document.getElementById('rtHalaqahSel').value;
  if (!id_halaqah) return;
  // Murid selector
  if (!_hafalanGuruMuridCache[id_halaqah]) {
    try {
      var res = await window.HQ.GuruAPI.getMuridQiyam(id_halaqah);
      _hafalanGuruMuridCache[id_halaqah] = res.data || [];
    } catch(e) { _hafalanGuruMuridCache[id_halaqah] = []; }
  }
  var murid = _hafalanGuruMuridCache[id_halaqah];
  var mSel  = document.getElementById('rtMuridSel');
  mSel.innerHTML = '<option value="">— Semua Siswa —</option>'
    + murid.map(function(m){ return '<option value="'+esc(m.id_murid)+'">'+esc(m.nama_murid)+'</option>'; }).join('');
}

async function generateRaportTahfidz() {
  var id_halaqah = document.getElementById('rtHalaqahSel').value;
  var id_murid   = document.getElementById('rtMuridSel').value;
  var id_periode = document.getElementById('rtPeriodeSel').value;
  if (!id_halaqah) { showToast('Pilih halaqah terlebih dahulu', 'warning'); return; }

  var tgl_mulai = null, tgl_selesai = null;
  if (id_periode !== 'semua') {
    var p = _rtPeriodeList.find(function(x){ return x.id_periode === id_periode; });
    if (p) { tgl_mulai = p.tanggal_mulai; tgl_selesai = p.tanggal_selesai; }
  }

  document.getElementById('rtEmpty').style.display   = 'none';
  document.getElementById('rtOutput').style.display  = 'none';
  document.getElementById('rtLoading').style.display = 'block';

  try {
    var [resSetoran, resMurid, resPenilaian] = await Promise.all([
      window.HQ.GuruAPI.getRaportTahfidzData(id_halaqah, id_murid || null, tgl_mulai, tgl_selesai),
      window.HQ.GuruAPI.getMuridQiyam(id_halaqah),
      window.HQ.GuruAPI.getPenilaianHafalan(),
    ]);
    var allSetoran  = resSetoran.data  || [];
    var muridList   = resMurid.data    || [];
    var penilaianCfg= (resPenilaian.data) ? resPenilaian.data : _hfLoadConfig();
    var periodeInfo = id_periode !== 'semua' ? _rtPeriodeList.find(function(x){ return x.id_periode===id_periode; }) : null;

    // Filter ke murid yang dipilih atau semua
    var targetMurid = id_murid ? muridList.filter(function(m){ return m.id_murid===id_murid; }) : muridList;

    // Build raport per murid
    var raportList = targetMurid.map(function(m) {
      var setoran = allSetoran.filter(function(s){ return s.id_murid === m.id_murid; });
      return _rtBuildMuridRaport(m, setoran, penilaianCfg);
    });

    _rtLastData = { raportList, periodeInfo, id_halaqah, penilaianCfg };
    document.getElementById('rtContent').innerHTML = _rtRenderHTML(raportList, periodeInfo);
    document.getElementById('rtLoading').style.display = 'none';
    document.getElementById('rtOutput').style.display  = 'block';
  } catch(e) {
    document.getElementById('rtLoading').style.display = 'none';
    document.getElementById('rtEmpty').style.display   = 'block';
    showToast('Gagal memuat raport: ' + e.message, 'error');
  }
}

// ── Hitung poin dari nilai + kelancaran berdasarkan config ──────────────
function _rtHitungPoin(nilai, kelancaran, cfg) {
  var mappedNilai = nilai;
  if (nilai === 'Mumtaz') mappedNilai = 'A';
  else if (nilai === 'Baik') mappedNilai = 'B';
  else if (nilai === 'Cukup') mappedNilai = 'C';
  var n = (cfg.nilai||[]).find(function(x){ return x.kode === mappedNilai; });
  var k = (cfg.kelancaran||[]).find(function(x){ return x.nama === kelancaran; });
  return (n ? n.poin : 0) + (k ? k.poin : 0);
}

// ── Build raport data per murid ─────────────────────────────────────────
function _rtBuildMuridRaport(murid, setoran, cfg) {
  var totalPoin = 0, nilaiA = 0, nilaiB = 0, nilaiC = 0;
  var kelLancar = 0, kelCukup = 0, kelPerbaikan = 0;
  var jenisCnt  = { Ziyadah: 0, Murajaah: 0, Tahsin: 0 };
  var bulananMap = {};
  var juzMap     = {};
  var suratMap   = {};
  var catatanList = [];

  setoran.forEach(function(s) {
    var poin = _rtHitungPoin(s.nilai, s.kelancaran, cfg);
    totalPoin += poin;
    
    var vNil = String(s.nilai || '').trim();
    if (vNil === 'A' || vNil === 'Mumtaz') nilaiA++;
    else if (vNil === 'B' || vNil === 'Baik') nilaiB++;
    else if (vNil === 'C' || vNil === 'Cukup') nilaiC++;
    
    var vKel = String(s.kelancaran || '').trim();
    if (vKel === 'Lancar') kelLancar++;
    else if (vKel === 'Cukup') kelCukup++;
    else if (vKel === 'Perlu Perbaikan') kelPerbaikan++;

    jenisCnt[s.jenis] = (jenisCnt[s.jenis] || 0) + 1;

    // Per bulan
    var d = new Date(s.created_at);
    var bKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    var bLbl = d.toLocaleDateString('id-ID', { month:'short', year:'numeric' });
    if (!bulananMap[bKey]) bulananMap[bKey] = { label: bLbl, poin: 0, count: 0 };
    bulananMap[bKey].poin  += poin;
    bulananMap[bKey].count++;

    // Per juz
    var juz = parseInt(s.juz) || 0;
    if (juz) {
      if (!juzMap[juz]) juzMap[juz] = { count: 0, poin: 0 };
      juzMap[juz].count++;
      juzMap[juz].poin += poin;
    }

    // Per surat
    var suratKey = s.surat;
    if (suratKey) {
      if (!suratMap[suratKey]) suratMap[suratKey] = { surat: s.surat, juz: s.juz, ayat_dari: s.ayat_dari, ayat_sampai: s.ayat_sampai, count: 0, nilai_list: [], poin: 0, last_tgl: s.created_at };
      suratMap[suratKey].count++;
      suratMap[suratKey].nilai_list.push(s.nilai);
      suratMap[suratKey].poin += poin;
      if (s.created_at > suratMap[suratKey].last_tgl) suratMap[suratKey].last_tgl = s.created_at;
    }

    // Catatan
    if (s.catatan && s.catatan.trim()) {
      catatanList.push({ tanggal: s.created_at, surat: s.surat, catatan: s.catatan, guru: s.nama_guru });
    }
  });

  // Target aktif (setoran terbaru yang punya target)
  var targetAktif = null;
  var reversed = [...setoran].reverse();
  for (var i = 0; i < reversed.length; i++) {
    if (reversed[i].target_surat) { targetAktif = reversed[i]; break; }
  }

  // Badge
  function calcBadge(poin) {
    if (poin >= 5000) return '🏆 Bintang Tahfidz';
    if (poin >= 2000) return '🥇 Hafizh Teladan';
    if (poin >= 1000) return '🥈 Hafizh Berkembang';
    if (poin >= 500)  return '🥉 Hafizh Pemula';
    return '📖 Pemula';
  }

  // Bulanan sorted
  var bulanan = Object.keys(bulananMap).sort().map(function(k){ return Object.assign({ key: k }, bulananMap[k]); });

  // Surat list sorted by juz then surat
  var suratList = Object.values(suratMap).sort(function(a,b){ return (a.juz - b.juz) || a.surat.localeCompare(b.surat); });

  return {
    murid, totalSetoran: setoran.length, totalPoin, badge: calcBadge(totalPoin),
    nilaiA, nilaiB, nilaiC,
    kelLancar, kelCukup, kelPerbaikan,
    jenisCnt, bulanan, juzMap, suratList,
    catatan: catatanList.slice(-5).reverse(),
    target: targetAktif,
  };
}

// ── Render HTML raport (semua murid) ────────────────────────────────────
function _rtRenderHTML(raportList, periodeInfo) {
  if (!raportList.length) return '<div style="text-align:center;padding:40px;color:#9ca3af">Tidak ada data hafalan</div>';
  return raportList.map(function(r, idx) { return _rtRenderMuridCard(r, periodeInfo, idx); }).join('');
}

function _rtRenderMuridCard(r, periodeInfo, idx) {
  var periodeTxt = periodeInfo ? periodeInfo.nama_periode : 'Semua Waktu';
  var hqInfo = (window.HQ.AppState.halaqahList || []).find(function(h){ return h.id_halaqah === document.getElementById('rtHalaqahSel').value; }) || {};

  // ── Header murid ───────────────────────────────────────────
  var header = '<div class="rt-card" style="background:linear-gradient(135deg,#0a2463,#1046a8,#1a73e8);color:#fff;position:relative;overflow:hidden">'
    + '<div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;position:relative;z-index:1">'
      + '<div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex-shrink:0">'
        + (r.murid.nama_murid||'?').charAt(0).toUpperCase()
      + '</div>'
      + '<div>'
        + '<div style="font-size:18px;font-weight:900;line-height:1.2">' + esc(r.murid.nama_murid) + '</div>'
        + '<div style="font-size:12px;opacity:.75;margin-top:2px">' + esc(hqInfo.nama_halaqah||'') + ' &nbsp;·&nbsp; ' + esc(hqInfo.nama_guru||'') + '</div>'
      + '</div>'
      + '<div style="margin-left:auto;text-align:right;position:relative;z-index:1">'
        + '<div style="font-size:11px;opacity:.65;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Periode</div>'
        + '<div style="font-size:13px;font-weight:700">' + esc(periodeTxt) + '</div>'
      + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;position:relative;z-index:1">'
      + _rtMiniStat('📖', r.totalSetoran, 'Total Setoran', 'rgba(255,255,255,0.15)')
      + _rtMiniStat('⭐', r.totalPoin, 'Total Poin', 'rgba(255,255,255,0.15)')
      + _rtMiniStat('🏅', r.badge.split(' ').slice(1).join(' '), 'Badge', 'rgba(255,255,255,0.15)')
      + _rtMiniStat('✅', r.nilaiA + '/' + (r.nilaiA+r.nilaiB+r.nilaiC) + ' A', 'Nilai A', 'rgba(255,255,255,0.15)')
    + '</div>'
  + '</div>';

  // ── Statistik detail ───────────────────────────────────────
  var stats = '<div class="rt-card">'
    + '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">📈 Statistik Setoran</div>'
    + '<div class="rt-stat-grid" style="margin-bottom:8px">'
      + _rtStatBox(r.jenisCnt['Ziyadah']||0, 'Ziyadah', '📖', '#dbeafe', '#1d4ed8')
      + _rtStatBox(r.jenisCnt['Murajaah']||0, 'Murajaah', '🔄', '#d1fae5', '#065f46')
      + _rtStatBox(r.jenisCnt['Tahsin']||0, 'Tahsin', '✨', '#fef9c3', '#854d0e')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">'
      + _rtStatBox(r.nilaiA, 'Mumtaz (A)', '⭐', '#dbeafe', '#1d4ed8')
      + _rtStatBox(r.nilaiB, 'Baik (B)', '✅', '#d1fae5', '#065f46')
      + _rtStatBox(r.nilaiC, 'Cukup (C)', '📌', '#fef3c7', '#92400e')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
      + _rtStatBox(r.kelLancar || 0, 'Lancar', '🟢', '#ecfdf5', '#047857')
      + _rtStatBox(r.kelCukup || 0, 'Cukup', '🟡', '#fffbeb', '#b45309')
      + _rtStatBox(r.kelPerbaikan || 0, 'Perbaikan', '🔴', '#fef2f2', '#b91c1c')
    + '</div>'
  + '</div>';

  // ── Grafik poin bulanan ────────────────────────────────────
  var grafik = _rtGrafikBulanan(r.bulanan);

  // ── Peta juz ──────────────────────────────────────────────
  var petaJuz = _rtPetaJuz(r.juzMap);

  // ── Daftar surat ──────────────────────────────────────────
  var daftarSurat = '<div class="rt-card">'
    + '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">📜 Daftar Surat yang Disetor</div>';
  if (!r.suratList.length) {
    daftarSurat += '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">Belum ada data</div>';
  } else {
    daftarSurat += '<div style="overflow-x:auto"><table class="rt-surat-tbl"><thead><tr>'
      + '<th>No</th><th>Surat</th><th>Juz</th><th>Ayat</th><th>Setoran</th><th>Nilai Terbaik</th><th>Terakhir</th>'
      + '</tr></thead><tbody>'
      + r.suratList.map(function(s, i) {
          var bestNilai = 'Cukup (C)';
          if (s.nilai_list.includes('A') || s.nilai_list.includes('Mumtaz')) bestNilai = 'Mumtaz (A)';
          else if (s.nilai_list.includes('B') || s.nilai_list.includes('Baik')) bestNilai = 'Baik (B)';
          
          var nc = {
            'Mumtaz (A)': 'background:#dbeafe;color:#1d4ed8',
            'Baik (B)': 'background:#d1fae5;color:#065f46',
            'Cukup (C)': 'background:#fef3c7;color:#92400e'
          };
          var tgl = s.last_tgl ? new Date(s.last_tgl).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
          return '<tr>'
            + '<td style="color:#9ca3af">' + (i+1) + '</td>'
            + '<td style="font-weight:700">' + esc(s.surat) + '</td>'
            + '<td>Juz ' + (s.juz||'-') + '</td>'
            + '<td>' + (s.ayat_dari||'-') + '–' + (s.ayat_sampai||'-') + '</td>'
            + '<td style="font-weight:700;color:#2563eb">' + s.count + 'x</td>'
            + '<td><span style="' + (nc[bestNilai]||'background:#f3f4f6;color:#374151') + ';padding:2px 10px;border-radius:100px;font-size:11px;font-weight:800">' + bestNilai + '</span></td>'
            + '<td style="color:#9ca3af;font-size:11px">' + tgl + '</td>'
          + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }
  daftarSurat += '</div>';

  // ── Target aktif ──────────────────────────────────────────
  var targetHtml = '';
  if (r.target && r.target.target_surat) {
    targetHtml = '<div class="rt-card" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#86efac">'
      + '<div style="font-size:12px;font-weight:800;color:#15803d;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">🎯 Target Hafalan Berikutnya</div>'
      + '<div style="font-size:16px;font-weight:900;color:#166534;margin-bottom:4px">' + esc(r.target.target_surat) + '</div>'
      + '<div style="font-size:12px;color:#15803d">Ayat ' + (r.target.target_ayat_dari||'-') + ' – ' + (r.target.target_ayat_sampai||'-') + '</div>'
    + '</div>';
  }

  // ── Catatan guru ──────────────────────────────────────────
  var catatanHtml = '';
  if (r.catatan.length) {
    catatanHtml = '<div class="rt-card">'
      + '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">💬 Catatan Terakhir dari Guru</div>'
      + r.catatan.map(function(c){
          var tgl = c.tanggal ? new Date(c.tanggal).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
          return '<div style="border-left:3px solid #fbbf24;padding:8px 12px;background:#fffbeb;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:12px">'
            + '<div style="font-weight:700;color:#78350f;margin-bottom:3px">' + esc(c.surat||'-') + ' &nbsp;·&nbsp; ' + tgl + '</div>'
            + '<div style="color:#92400e;font-style:italic">"' + esc(c.catatan) + '"</div>'
          + '</div>';
        }).join('')
    + '</div>';
  }

  return '<div style="margin-bottom:20px">' + header + stats + grafik + petaJuz + daftarSurat + targetHtml + catatanHtml + '</div>';
}

function _rtMiniStat(icon, val, lbl, bg) {
  return '<div style="background:'+bg+';border-radius:10px;padding:10px;text-align:center">'
    + '<div style="font-size:18px;font-weight:900;color:#fff">' + icon + ' ' + esc(String(val)) + '</div>'
    + '<div style="font-size:10px;opacity:.75;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + lbl + '</div>'
  + '</div>';
}

function _rtStatBox(val, lbl, icon, bg, color) {
  return '<div class="rt-stat" style="background:'+bg+';border-color:transparent">'
    + '<div class="rt-stat-val" style="color:'+color+'">' + icon + ' ' + val + '</div>'
    + '<div class="rt-stat-lbl">' + lbl + '</div>'
  + '</div>';
}

// ── Grafik Poin Bulanan (SVG) ─────────────────────────────────────────
function _rtGrafikBulanan(bulanan) {
  if (!bulanan.length) return '';
  var maxPoin = Math.max.apply(null, bulanan.map(function(b){ return b.poin; })) || 1;
  var W = 600, H = 160, pad = 40, barW = Math.max(20, Math.floor((W - pad*2) / bulanan.length) - 6);
  var html = '<div class="rt-card">'
    + '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">📈 Grafik Poin per Bulan</div>'
    + '<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:180px">'
    // Grid lines
    + '<line x1="'+pad+'" y1="10" x2="'+pad+'" y2="'+(H-30)+'" stroke="#e5e7eb" stroke-width="1"/>'
    + '<line x1="'+pad+'" y1="'+(H-30)+'" x2="'+(W-10)+'" y2="'+(H-30)+'" stroke="#e5e7eb" stroke-width="1"/>';

  bulanan.forEach(function(b, i) {
    var barH = Math.max(4, Math.round(((H-50) * b.poin) / maxPoin));
    var x    = pad + i * ((W - pad*2) / bulanan.length) + 3;
    var y    = H - 30 - barH;
    var pct  = b.poin / maxPoin;
    var clr  = pct > 0.7 ? '#1d4ed8' : pct > 0.4 ? '#60a5fa' : '#93c5fd';
    html += '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+barH+'" rx="4" fill="'+clr+'"/>'
          + '<text x="'+(x+barW/2)+'" y="'+(y-4)+'" text-anchor="middle" font-size="9" fill="#374151" font-weight="600">'+b.poin+'</text>'
          + '<text x="'+(x+barW/2)+'" y="'+(H-14)+'" text-anchor="middle" font-size="8" fill="#9ca3af">'+b.label+'</text>';
  });
  html += '</svg></div></div>';
  return html;
}

// ── Peta Progress Juz (grid 6×5) ────────────────────────────────────
function _rtPetaJuz(juzMap) {
  var html = '<div class="rt-card">'
    + '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">🗺️ Peta Progress Juz (1–30)</div>'
    + '<div class="rt-juz-grid">';
  var maxCount = Math.max.apply(null, Object.values(juzMap).map(function(j){ return j.count; }).concat([1]));
  for (var juz = 1; juz <= 30; juz++) {
    var info = juzMap[juz];
    var count = info ? info.count : 0;
    var poin  = info ? info.poin  : 0;
    var alpha = count ? Math.max(0.25, count / maxCount) : 0;
    var bg    = count ? 'rgba(29,78,216,' + alpha.toFixed(2) + ')' : '#f3f4f6';
    var color = count && alpha > 0.4 ? '#fff' : count ? '#1e40af' : '#9ca3af';
    html += '<div class="rt-juz-cell" style="background:'+bg+';color:'+color+'" title="Juz '+juz+(count?' — '+count+' setoran, '+poin+' poin':' — belum ada setoran')+'">'
      + juz + (count ? '<span style="position:absolute;top:2px;right:3px;font-size:7px;font-weight:800">'+count+'x</span>' : '')
    + '</div>';
  }
  html += '</div>'
    + '<div style="display:flex;gap:12px;margin-top:10px;font-size:10px;color:#6b7280">'
      + '<div style="display:flex;align-items:center;gap:4px"><div style="width:12px;height:12px;border-radius:3px;background:#f3f4f6;border:1px solid #e5e7eb"></div> Belum disetor</div>'
      + '<div style="display:flex;align-items:center;gap:4px"><div style="width:12px;height:12px;border-radius:3px;background:rgba(29,78,216,.25)"></div> Sedikit</div>'
      + '<div style="display:flex;align-items:center;gap:4px"><div style="width:12px;height:12px;border-radius:3px;background:#1d4ed8"></div> Banyak</div>'
    + '</div>'
  + '</div>';
  return html;
}

// ── Cetak / Export PDF ────────────────────────────────────────────────
function cetakRaportTahfidz() {
  if (!_rtLastData) return;
  var printEl = document.getElementById('raportTahfidzPrintArea');
  var periodeInfo = _rtLastData.periodeInfo;
  var hqInfo = (window.HQ.AppState.halaqahList || []).find(function(h){ return h.id_halaqah === document.getElementById('rtHalaqahSel').value; }) || {};

  printEl.innerHTML = '<style>'
    + 'body{font-family:sans-serif}'
    + '.rt-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:12px;break-inside:avoid}'
    + '.rt-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}'
    + '.rt-stat{background:#f8faff;border:1px solid #e0eaff;border-radius:10px;padding:10px;text-align:center}'
    + '.rt-stat-val{font-size:20px;font-weight:900;color:#1d4ed8}'
    + '.rt-stat-lbl{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase}'
    + '.rt-juz-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}'
    + '.rt-juz-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;position:relative}'
    + '.rt-surat-tbl{width:100%;border-collapse:collapse;font-size:11px}'
    + '.rt-surat-tbl th{padding:6px 8px;background:#f0f5fd;color:#1d4ed8;font-size:9px;font-weight:800;text-transform:uppercase;text-align:left;border-bottom:1px solid #e0eaff}'
    + '.rt-surat-tbl td{padding:6px 8px;border-bottom:1px solid #f3f4f6}'
    + '.rt-pdf-page{padding:0;margin-bottom:24px}'
    + 'h1{font-size:18px;color:#0a2463;margin:0 0 4px}'
    + '</style>'
    + '<div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1d4ed8;padding-bottom:12px">'
      + '<h1>📋 RAPORT TAHFIDZ AL-QUR\'AN</h1>'
      + '<div style="font-size:12px;color:#374151">'
        + esc(hqInfo.nama_halaqah||'') + ' &nbsp;|&nbsp; '
        + esc(hqInfo.nama_guru||'') + ' &nbsp;|&nbsp; '
        + esc(periodeInfo ? periodeInfo.nama_periode : 'Semua Waktu')
      + '</div>'
    + '</div>'
    + _rtLastData.raportList.map(function(r) {
        return '<div class="rt-pdf-page">' + _rtRenderMuridCard(r, periodeInfo, 0) + '</div>';
      }).join('');

  window.print();
}


  // ── EXPOSE PUBLIC INTERFACE TO WINDOW ──
  window._hideRaportSections = _hideRaportSections;
  window._renderRaportPreview = _renderRaportPreview;
  window._rtBuildMuridRaport = _rtBuildMuridRaport;
  window._rtGrafikBulanan = _rtGrafikBulanan;
  window._rtHitungPoin = _rtHitungPoin;
  window._rtMiniStat = _rtMiniStat;
  window._rtPetaJuz = _rtPetaJuz;
  window._rtRenderHTML = _rtRenderHTML;
  window._rtRenderMuridCard = _rtRenderMuridCard;
  window._rtStatBox = _rtStatBox;
  window.cetakRaportTahfidz = cetakRaportTahfidz;
  window.generateRaportTahfidz = generateRaportTahfidz;
  window.initRaportPage = initRaportPage;
  window.initRaportTahfidz = initRaportTahfidz;
  window.onRaportHalaqahChange = onRaportHalaqahChange;
  window.onRaportPeriodeChange = onRaportPeriodeChange;
  window.raportGenerate = raportGenerate;
  window.raportPublishSemua = raportPublishSemua;
  window.raportSimpanCatatan = raportSimpanCatatan;
  window.loadNilaiSetup = loadNilaiSetup;
  window.loadNilaiMurid = loadNilaiMurid;
  window.saveSemuaNilai = saveSemuaNilai;
})();
