/**
 * Modul KBM & Presensi Guru (kbm-module.js)
 * Portal Halaqah Rattililquran
 */
(function() {
  'use strict';

  // ── PRIVATE CONSTANTS & HELPERS ──
  const KRITERIA_MT = [
    { id: 'penguasaan', label: 'Penguasaan Materi', bobot: 0.25, desc: ['Sangat Kuat', 'Kuat', 'Cukup', 'Lemah'] },
    { id: 'penyampaian', label: 'Cara Penyampaian', bobot: 0.25, desc: ['Sangat Jelas', 'Jelas', 'Cukup', 'Kurang'] },
    { id: 'tajwid', label: 'Kualitas Tajwid', bobot: 0.20, desc: ['Sangat Fasih', 'Fasih', 'Cukup', 'Kurang'] },
    { id: 'interaksi', label: 'Interaksi Kelas', bobot: 0.15, desc: ['Sangat Komunikatif', 'Komunikatif', 'Cukup', 'Pasif'] },
    { id: 'waktu', label: 'Manajemen Waktu', bobot: 0.15, desc: ['Sangat Tepat', 'Tepat', 'Cukup', 'Molor'] }
  ];

  const OPT_MT = [
    { val: 4, code: 'SB', cls: 'opt-sb' },
    { val: 3, code: 'B', cls: 'opt-b' },
    { val: 2, code: 'C', cls: 'opt-c' },
    { val: 1, code: 'PP', cls: 'opt-pp' }
  ];

  function getSesiAktif() {
    return window.HQ && window.HQ.AppState && typeof window.HQ.AppState.sesiAktif !== 'undefined'
      ? window.HQ.AppState.sesiAktif
      : window.sesiAktif;
  }
  function setSesiAktif(val) {
    if (window.HQ && window.HQ.AppState) window.HQ.AppState.sesiAktif = val;
    window.sesiAktif = val;
  }

  function getMuridSesi() {
    return window.HQ && window.HQ.AppState && typeof window.HQ.AppState.muridSesi !== 'undefined'
      ? window.HQ.AppState.muridSesi
      : (window.muridSesi || []);
  }
  function setMuridSesi(val) {
    if (window.HQ && window.HQ.AppState) window.HQ.AppState.muridSesi = val;
    window.muridSesi = val;
  }

  function getHalaqahList() {
    return (window.HQ && window.HQ.AppState && window.HQ.AppState.halaqahList) || window.halaqahList || [];
  }

  function getMuridCache() {
    return window.muridCache || {};
  }
  function setMuridCache(val) {
    window.muridCache = val;
  }

  // ── FORM VALIDATION ──────────────────────
  function validateFields(fields) {
    var ok = true;
    fields.forEach(function(f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      el.classList.remove('field-error');
      var isEmpty = !el.value || !el.value.trim();
      if (isEmpty) {
        el.classList.add('field-error');
        setTimeout(function(){ el.classList.remove('field-error'); }, 800);
        ok = false;
      }
    });
    if (!ok) {
      var missing = fields.filter(function(f){
        var el = document.getElementById(f.id);
        return el && (!el.value || !el.value.trim());
      }).map(function(f){ return f.label; });
      toast('Field wajib belum diisi: ' + missing.join(', '), 'err');
    }
    return ok;
  }

  async function doBukaKBM() {
    const id_halaqah = document.getElementById('kbmHalaqah').value;
    const tanggal    = document.getElementById('kbmTanggal').value;
    const jam_mulai  = document.getElementById('kbmJam').value;
    const jenis_sesi = document.getElementById('kbmJenis').value;
    const sesiAktif  = getSesiAktif();

    if (sesiAktif) return toast('Masih ada sesi berjalan. Tutup dulu!','warn');
    if (!validateFields([
      {id:'kbmHalaqah', label:'Halaqah'},
      {id:'kbmTanggal', label:'Tanggal'},
      {id:'kbmJenis',   label:'Jenis Sesi'},
    ])) return;

    setBtn('btnMulai', true, '⏳ Membuka sesi...');
    showLoad('Bismillah, kita buka sesi KBM dengan doa terlebih dahulu...');
    try {
      const pertemuanCustom = (document.getElementById('kbmPertemuan') ? document.getElementById('kbmPertemuan').value : '');
      const isPengganti = !!document.getElementById('kbmIsPengganti')?.checked;
      const r = await window.HQ.GuruAPI.bukaKBM({
        id_halaqah,
        tanggal_pertemuan: tanggal,
        jam_mulai,
        jenis_sesi,
        pertemuan_ke_custom: pertemuanCustom ? Number(pertemuanCustom) : null,
        is_pengganti: isPengganti,
      });
      setSesiAktif(r.data);
      const newMurid = await getMurid(id_halaqah);
      setMuridSesi(newMurid);
      window.doaSudahMuncul = false;
      window._nilaiCache      = {};
      window._hafalanKbmCache = {};
      window._microteachingKbmCache = {};
      window._hfKbmZiyadah   = {};
      window._lastTargetDataKbm = null;
      _pruneKbmDrafts(r.data.id_kbm);
      window._presensiState = {};
      window._presensiStateKbm = r.data.id_kbm;
      ['jurnalMateri','jurnalHalaman','jurnalCatatan','jurnalLatihanMandiri','jurnalDeadline','jurnalReferensiUrl'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value = '';
      });
      var prSel = document.getElementById('jurnalJenisLatihan');
      if (prSel) prSel.value = '';
      if (typeof toggleReferensiJurnal === 'function') toggleReferensiJurnal();
      document.querySelectorAll('[id^="adab-"],[id^="kamera-"],[id^="koreksi-"],[id^="catatan-"],[id^="nilai-"]').forEach(function(el){
        el.value = '';
      });

      hideLoad();
      setBtn('btnMulai', false, '🌟 Mulai Perjuangan Baru');

      tampilkanDoa(() => {
        goPage('presensi');
        renderPresensi();
        renderSteps('presensi');
        quickToast('Sesi dibuka! Silakan isi presensi.','ok');
      });
    } catch(e) {
      toast(friendlyError(e),'err');
      hideLoad();
      setBtn('btnMulai', false, '🌟 Mulai Perjuangan Baru');
    }
  }

  function updateSesiBanner() {
    const b = document.getElementById('sesiBanner');
    if (!b) return;
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) { b.style.display='none'; return; }
    const halaqahList = getHalaqahList();
    const h = halaqahList.find(x => x.id_halaqah === sesiAktif.id_halaqah);
    document.getElementById('sesiInfo').innerHTML =
      `<strong>${esc((h && h.nama_halaqah)||sesiAktif.id_halaqah)}</strong> &nbsp;·&nbsp;
       ${esc(sesiAktif.jenis_sesi||'KBM')} &nbsp;·&nbsp;
       ${fmtDate(sesiAktif.tanggal_pertemuan)} ${sesiAktif.jam_mulai||''} &nbsp;·&nbsp;
       Pertemuan ke-${sesiAktif.pertemuan_ke}`;
    b.style.display = 'flex';
  }

  function lanjutSesi() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    window.doaSudahMuncul = true;
    _hydrateKbmCacheFromDraft(sesiAktif.id_kbm);
    _reconcileKbmDraftServer(sesiAktif.id_kbm);

    if (window._presensiStateKbm !== sesiAktif.id_kbm) {
      window._presensiState = {};
      window._presensiStateKbm = sesiAktif.id_kbm;
    }

    var proceed = function() {
      goPage('presensi'); renderPresensi(); renderSteps('presensi');
      document.getElementById('pageTitle').textContent = 'Presensi — Step 2/4';
    };

    var loadPresensiThen = function(cb) {
      window.HQ.GuruAPI.getPresensiByKBM(sesiAktif.id_kbm).then(function(res) {
        window._presensiState = window._presensiState || {};
        (((res && res.data) || [])).forEach(function(p) {
          if (p.status_hadir && !(p.id_murid in window._presensiState)) {
            window._presensiState[p.id_murid] = p.status_hadir;
          }
        });
        cb();
      }, function() { cb(); });
    };

    const muridSesi = getMuridSesi();
    if (muridSesi.length) {
      loadPresensiThen(proceed);
    } else {
      getMurid(sesiAktif.id_halaqah).then(function(murid) {
        setMuridSesi(murid);
        loadPresensiThen(proceed);
      });
    }
  }

  // ── PRESENSI ──────────────────────
  function renderPresensi() {
    const cont = document.getElementById('presensiList');
    if (!cont) return;
    const sesiAktif = getSesiAktif();
    const muridSesi = getMuridSesi();
    const isReguler = !sesiAktif || sesiAktif.jenis_sesi === 'KBM Reguler';
    const btnLanjut = document.getElementById('btnLanjutPresensi');
    if (btnLanjut) {
      const jenisSesi = sesiAktif && sesiAktif.jenis_sesi;
      if (jenisSesi === 'KBM Qiyam') {
        btnLanjut.textContent = 'Input Hafalan →';
      } else if (jenisSesi === 'Micro Teaching') {
        btnLanjut.textContent = 'Input Nilai/Assessment →';
      } else {
        btnLanjut.textContent = isReguler ? 'Lanjut ke Nilai →' : 'Selesaikan Sesi →';
      }
    }
    renderSteps('presensi');
    if (!muridSesi.length) {
      cont.innerHTML = emptyHTML('👥','Belum ada murid','Tambahkan murid ke halaqah ini lewat portal admin.'); return;
    }
    const _ps = window._presensiState || {};
    cont.innerHTML = muridSesi.map(m => `
      <div class="prow" id="prow-${esc(m.id_murid)}">
        <div>
          <div class="prow-name">${esc(m.nama_murid)}</div>
          <div class="prow-level">Level: ${esc(m.level||'-')} &nbsp;·&nbsp; ${m.total_hadir||0}× hadir</div>
        </div>
        <div class="prow-btns">
          ${['H','T','I','A'].map(k=>`
            <button class="pb ${k===(_ps[m.id_murid]||'H')?'on':''}" data-k="${k}" data-id="${esc(m.id_murid)}"
              data-nama="${esc(m.nama_murid)}" onclick="togPresensi(this)"
              title="${{H:'Hadir (100%)',T:'Terlambat (90%)',I:'Izin (70%)',A:'Alpa (0%)'}[k]}">${k}</button>
          `).join('')}
        </div>
      </div>`).join('');

    updatePresensiCount();
  }

  function togPresensi(btn) {
    btn.closest('.prow-btns').querySelectorAll('.pb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    (window._presensiState = window._presensiState || {})[btn.dataset.id] = btn.dataset.k;
    updatePresensiCount();
  }

  function setAllPresensi(kode) {
    window._presensiState = window._presensiState || {};
    document.querySelectorAll('.pb[data-k="' + kode + '"]').forEach(btn => {
      btn.closest('.prow-btns').querySelectorAll('.pb').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      window._presensiState[btn.dataset.id] = kode;
    });
    updatePresensiCount();
  }

  function updatePresensiCount() {
    const H = document.querySelectorAll('.pb[data-k="H"].on').length;
    const T = document.querySelectorAll('.pb[data-k="T"].on').length;
    const I = document.querySelectorAll('.pb[data-k="I"].on').length;
    const A = document.querySelectorAll('.pb[data-k="A"].on').length;
    const countEl = document.getElementById('presensiCount');
    const muridSesi = getMuridSesi();
    if (countEl) {
      countEl.textContent = `H:${H} T:${T} I:${I} A:${A} / ${muridSesi.length} murid`;
    }
  }

  async function doSimpanPresensi() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    const presensi = [];
    document.querySelectorAll('.prow').forEach(row => {
      const aktif = row.querySelector('.pb.on');
      if (aktif) presensi.push({
        id_murid    : aktif.dataset.id,
        nama_murid  : aktif.dataset.nama,
        status_hadir: aktif.dataset.k,
      });
    });
    if (!presensi.length) return toast('Isi presensi minimal 1 murid','err');

    showLoad('Bismillah, menyimpan presensi...');
    try {
      await window.HQ.GuruAPI.simpanPresensi({
        id_kbm: sesiAktif.id_kbm,
        id_halaqah: sesiAktif.id_halaqah,
        jenis_sesi: sesiAktif.jenis_sesi,
        presensi
      });
      const jenisSesi = sesiAktif ? sesiAktif.jenis_sesi : 'KBM Reguler';
      if (jenisSesi === 'KBM Reguler') {
        goToNilai();
      } else if (jenisSesi === 'KBM Qiyam') {
        goToHafalanQiyam();
      } else if (jenisSesi === 'Micro Teaching') {
        goToMicroteachingAssessment();
      } else {
        goToPreviewNonReguler();
      }
      quickToast('Presensi tersimpan!','ok');
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  }

  // ── JURNAL & NILAI STEP ──────────────────────
  async function goToNilai() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    _hydrateKbmCacheFromDraft(sesiAktif.id_kbm);
    
    // Memuat indikator daurah secara dinamis jika terdeteksi level daurah
    const muridSesi = getMuridSesi();
    const hasDaurah = muridSesi.some(m => m.level === 'Tahsin Al-Fatihah');
    if (hasDaurah) {
      showLoad('Bismillah, memuat indikator daurah...');
      try {
        var r = await window.HQ.GuruAPI.getAssessmentRekap(sesiAktif.id_halaqah);
        if (r.status === 'ok') {
          if (r.data && r.data.length > 0 && r.data[0].detail) {
            window._daurahAssessmentItems = r.data[0].detail.map(d => ({
              id_item: d.id_item,
              kategori: d.kategori,
              teks_latin: d.teks_latin,
              teks_arab: d.teks_arab,
              keterangan: d.keterangan,
              urutan: d.urutan
            }));
            
            window._daurahAssessmentMap = window._daurahAssessmentMap || {};
            r.data.forEach(m => {
              window._daurahAssessmentMap[m.id_murid] = window._daurahAssessmentMap[m.id_murid] || {};
              m.detail.forEach(d => {
                // Gunakan jawaban guru, jika belum ada gunakan jawaban murid, jika belum ada null
                window._daurahAssessmentMap[m.id_murid][d.id_item] = d.jawaban_guru || d.jawaban || null;
              });
            });
          }
        }
      } catch (e) {
        console.error('Gagal memuat assessment daurah:', e);
      } finally {
        hideLoad();
      }
    }
    
    renderNilaiMuridStep();
    goPage('nilai-murid');
    renderSteps('nilai-murid');
    document.getElementById('pageTitle').textContent = 'Nilai — Step 3/4';
  }

  function onKbmHalaqahChange() {
    var id_halaqah = document.getElementById('kbmHalaqah').value;
    var halaqahList = getHalaqahList();
    var halaqah    = (halaqahList || []).find(function(h){ return h.id_halaqah === id_halaqah; });
    var isQiyam    = halaqah && halaqah.level === 'Level Qiyam';
    var btnQiyam   = document.getElementById('btnKbmJenis-KBM_Qiyam');
    var btnReguler = document.getElementById('btnKbmJenis-KBM_Reguler');
    var jenisEl    = document.getElementById('kbmJenis');
    if (!jenisEl) return;
    if (btnQiyam) {
      btnQiyam.style.display = isQiyam ? 'flex' : 'none';
    }
    if (btnReguler) {
      var isDaurah = halaqah && halaqah.level === 'Tahsin Al-Fatihah';
      btnReguler.innerHTML = '<span>📖</span> ' + (isDaurah ? 'KBM Daurah' : 'KBM Reguler');
    }
    if (!isQiyam && jenisEl.value === 'KBM Qiyam') {
      selectKbmJenis('KBM Reguler');
    }
  }

  function selectKbmJenis(val) {
    var jenisEl = document.getElementById('kbmJenis');
    if (!jenisEl) return;
    jenisEl.value = val;

    var buttons = ['KBM Reguler', 'KBM Qiyam', 'Micro Teaching', 'Lainnya'];
    buttons.forEach(function(b) {
      var btnId = 'btnKbmJenis-' + b.replace(' ', '_');
      var btn = document.getElementById(btnId);
      if (btn) {
        if (b === val) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    if (typeof autoFillPertemuan === 'function') autoFillPertemuan();
  }

  function goToHafalanQiyam() {
    const sesiAktif = getSesiAktif();
    const muridSesi = getMuridSesi();
    _saveHafalanKbmCache();
    _hydrateKbmCacheFromDraft(sesiAktif && sesiAktif.id_kbm);
    var id_halaqah = sesiAktif && sesiAktif.id_halaqah;
    goPage('hafalan-kbm');
    renderSteps('hafalan-kbm');
    document.getElementById('pageTitle').textContent = 'Hafalan — Step 3/4';
    var studentIds = muridSesi ? muridSesi.map(function(m){ return m.id_murid; }) : [];
    if (id_halaqah) {
      window.HQ.GuruAPI.getTargetHafalanMurid(id_halaqah, studentIds)
        .then(function(res) { window._lastTargetDataKbm = res.data || []; renderHafalanKbm(); setTimeout(_restoreHafalanKbmCache, 120); })
        .catch(function()   { window._lastTargetDataKbm = [];             renderHafalanKbm(); setTimeout(_restoreHafalanKbmCache, 120); });
    } else {
      window._lastTargetDataKbm = [];
      renderHafalanKbm();
      setTimeout(_restoreHafalanKbmCache, 120);
    }
  }

  function goToMicroteachingAssessment() {
    const sesiAktif = getSesiAktif();
    _saveMicroteachingKbmCache();
    _hydrateKbmCacheFromDraft(sesiAktif && sesiAktif.id_kbm);
    goPage('microteaching-kbm');
    renderSteps('microteaching-kbm');
    document.getElementById('pageTitle').textContent = 'Assessment — Step 3/4';
    renderMicroteachingKbm();
  }

  function renderHafalanKbm() {
    var cont = document.getElementById('hafalanKbmList');
    const muridSesi = getMuridSesi();
    if (!cont || !muridSesi || !muridSesi.length) {
      if (cont) cont.innerHTML = emptyHTML('👥','Tidak ada murid','');
      return;
    }
    var presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(function(btn) {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });
    var hadirList = muridSesi.filter(function(m) {
      var s = presensiMap[m.id_murid] || 'A';
      return s === 'H' || s === 'T';
    });
    var tidakList = muridSesi.filter(function(m) {
      var s = presensiMap[m.id_murid] || 'A';
      return s !== 'H' && s !== 'T';
    });

    var cfg     = typeof _hfLoadConfig === 'function' ? _hfLoadConfig() : { kelancaran: [], nilai: [] };
    var kelOpts = (cfg.kelancaran||[]).map(function(k) {
      return '<option value="' + esc(k.nama) + '" title="' + esc(k.ket||'') + '">' + k.icon + ' ' + esc(k.nama) + ' (+' + k.poin + ' poin)</option>';
    }).join('');
    var nilOpts = (cfg.nilai||[]).map(function(n) {
      return '<option value="' + esc(n.kode) + '">' + n.icon + ' ' + esc(n.kode) + ' — ' + esc(n.desc) + ' (' + n.poin + ' poin)</option>';
    }).join('');
    var kamOpts = [
      {nama:'kamera terbuka',icon:'📷'},
      {nama:'kamera sering buka tutup',icon:'🟡'},
      {nama:'kamera tertutup',icon:'❌'}
    ].map(function(k) {
      return '<option value="' + esc(k.nama) + '">' + k.icon + ' ' + esc(k.nama) + '</option>';
    }).join('');
    var juzOpts = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]
      .map(function(n){ return '<option value="' + n + '">Juz ' + n + '</option>'; }).join('');

    var _targetMapKbm = {};
    if (window._lastTargetDataKbm) {
      window._lastTargetDataKbm.forEach(function(t){ _targetMapKbm[t.id_murid] = t; });
    }

    function buildCard(m, status) {
      var mid      = m.id_murid;
      var eid      = mid.replace(/[^a-zA-Z0-9-_]/g, '_');
      var initials = (m.nama_murid||'?').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
      var badge    = {H:'nm-badge-H',T:'nm-badge-T',I:'nm-badge-I',A:'nm-badge-A'}[status]||'nm-badge-H';
      var badgeTxt = {H:'Hadir',T:'Terlambat',I:'Izin',A:'Alpa'}[status]||status;

      var targetInfo = _targetMapKbm[mid];
      var targetSubtext = '';
      if (targetInfo && targetInfo.target_surat) {
        targetSubtext = '<div style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#f0fdf4,#e8fdf0);border:1px solid #86efac;border-radius:9px;padding:7px 11px;margin-bottom:10px;flex-wrap:wrap">'
          + '<span style="font-size:13px;flex-shrink:0">🎯</span>'
          + '<span style="font-size:11.5px;font-weight:700;color:#166534">Target Sebelumnya:</span>'
          + '<span style="font-size:11.5px;font-weight:800;color:#15803d">' + esc(targetInfo.target_surat) + '</span>'
          + '<span style="font-size:11px;color:#16a34a;background:rgba(22,163,74,0.12);border-radius:5px;padding:1px 6px;font-weight:600">Ayat ' + (targetInfo.target_ayat_dari||'-') + '–' + (targetInfo.target_ayat_sampai||'-') + '</span>'
        + '</div>';
      }

      return '<div class="nilai-murid-card" id="hfkbm-card-' + eid + '" style="margin-bottom:12px" data-mid="' + esc(mid) + '">'
        + '<div class="nm-header" style="margin-bottom:0;">'
          + '<div class="nm-nama"><div class="nm-nama-avatar">' + initials + '</div>' + esc(m.nama_murid) + '</div>'
          + '<div style="display:flex;align-items:center;gap:6px">'
            + '<button onclick="showRiwayatSetoranModal(\'' + esc(mid.replace(/'/g,"\\'")) + '\', \'' + esc((m.nama_murid||'').replace(/'/g,"\\'")) + '\')" '
              + 'style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:7px;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer;display:flex;align-items:center;gap:4px;transition:background 0.2s;white-space:nowrap" '
              + 'title="Riwayat Setoran Semua Surat" '
              + 'onmouseover="this.style.background=\'rgba(255,255,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.18)\'">'
              + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>'
              + 'Riwayat'
            + '</button>'
            + '<span class="nm-badge-hadir ' + badge + '">' + badgeTxt + '</span>'
          + '</div>'
        + '</div>'
        + '<div style="padding:10px 12px 12px">'
          + targetSubtext
          + '<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;margin-bottom:8px">'
            + '<div><div class="nm-section-label">Jenis</div>'
              + '<select class="fc hfkbm-jenis" data-mid="' + esc(mid) + '" id="hfkbm-jenis-' + eid + '" style="font-size:12px">'
                + '<option value="Ziyadah">📖 Ziyadah</option>'
                + '<option value="Murajaah">🔄 Murajaah</option>'
                + '<option value="Tahsin">✨ Tahsin</option>'
              + '</select>'
            + '</div>'
            + '<div><div class="nm-section-label">Nama Surat</div>'
              + '<div style="position:relative">'
                + '<input type="text" class="fc hfkbm-surat-display" data-mid="' + esc(mid) + '" id="hfkbm-surat-display-' + eid + '" placeholder="— Pilih surat —" autocomplete="off" style="font-size:12px;padding-right:24px">'
                + '<input type="hidden" id="hfkbm-surat-' + eid + '">'
                + '<div id="hfkbm-dd-' + eid + '" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:99;max-height:200px;overflow-y:auto;padding:4px"></div>'
              + '</div>'
            + '</div>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px">'
            + '<div><div class="nm-section-label">Ayat Dari</div><input type="number" class="fc" id="hfkbm-ayat-dari-' + eid + '" data-mid="' + esc(mid) + '" min="1" style="font-size:12px" placeholder=""></div>'
            + '<div><div class="nm-section-label">Sampai Ayat</div><input type="number" class="fc" id="hfkbm-ayat-sampai-' + eid + '" data-mid="' + esc(mid) + '" min="1" style="font-size:12px" placeholder=""></div>'
            + '<div><div class="nm-section-label">Juz</div>'
              + '<select class="fc" id="hfkbm-juz-' + eid + '" data-mid="' + esc(mid) + '" style="font-size:12px">'
                + '<option value="">—</option>' + juzOpts
              + '</select>'
            + '</div>'
          + '</div>'
          + '<div id="hfkbm-ayat-info-' + eid + '" style="font-size:11px;color:#6b7280;margin-bottom:8px;padding:0 2px">— pilih surat —</div>'
          + '<div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-radius:10px;padding:10px;margin-bottom:8px">'
            + '<div style="font-size:10px;font-weight:800;color:#1d4ed8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">★ Penilaian Bacaan</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
              + '<div><div class="nm-section-label">Kelancaran</div><select class="fc hfkbm-kel" data-mid="' + esc(mid) + '" id="hfkbm-kel-' + eid + '" style="font-size:12px">' + kelOpts + '</select></div>'
              + '<div><div class="nm-section-label">Makhraj & Tajwid</div><select class="fc hfkbm-nil" data-mid="' + esc(mid) + '" id="hfkbm-nil-' + eid + '" style="font-size:12px">' + nilOpts + '</select></div>'
              + '<div><div class="nm-section-label">Kamera</div><select class="fc" id="hfkbm-kam-' + eid + '" style="font-size:12px">' + kamOpts + '</select></div>'
            + '</div>'
            + '<div id="hfkbm-poin-' + eid + '" style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 10px;margin-top:8px">⚡ Estimasi poin: akan dihitung</div>'
          + '</div>'
          + '<div class="fg" style="margin-bottom:8px"><div class="nm-section-label">Catatan Guru</div>'
            + '<textarea class="fc" id="hfkbm-catatan-' + eid + '" rows="2" placeholder="Catatan untuk murid..." style="font-size:12px;resize:vertical"></textarea>'
          + '</div>'
          + '<div style="background:#f0fdf4;border:1px dashed #86efac;border-radius:10px;padding:10px;overflow:visible;margin-bottom:2px">'
            + '<div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">🎯 Target Hafalan Berikutnya (opsional)</div>'
            + '<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:6px">'
              + '<div style="position:relative"><input type="text" class="fc hfkbm-tgt-surat-input" data-mid="' + esc(mid) + '" id="hfkbm-tgt-surat-' + eid + '" placeholder="Nama surat target…" style="font-size:12px"><div id="hfkbm-tgt-dd-' + eid + '" style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:999;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.15);max-height:180px;overflow-y:auto;padding:4px"></div></div>'
              + '<div><input type="number" class="fc" id="hfkbm-tgt-dari-' + eid + '" min="1" placeholder="Dari" style="font-size:12px"></div>'
              + '<div><input type="number" class="fc" id="hfkbm-tgt-sampai-' + eid + '" min="1" placeholder="Sampai" style="font-size:12px"></div>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>';
    }

    var html = hadirList.map(function(m){ return buildCard(m, presensiMap[m.id_murid]||'H'); }).join('');
    if (tidakList.length) {
      html += '<div style="display:flex;align-items:center;gap:10px;margin:14px 0 10px">'
        + '<div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#fde68a)"></div>'
        + '<div style="font-size:10px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:100px;padding:3px 12px">⬇ Izin &amp; Alpa — tidak perlu input hafalan</div>'
        + '<div style="flex:1;height:1px;background:linear-gradient(90deg,#fde68a,transparent)"></div>'
        + '</div>'
        + tidakList.map(function(m) {
            var s = presensiMap[m.id_murid]||'A';
            var initials = (m.nama_murid||'?').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
            return '<div class="nilai-murid-card alpa" style="margin-bottom:8px">'
              + '<div class="nm-header"><div class="nm-nama"><div class="nm-nama-avatar">'+initials+'</div>'+esc(m.nama_murid)+'</div>'
              + '<span class="nm-badge-hadir '+(s==='I'?'nm-badge-I':'nm-badge-A')+'">'+(s==='I'?'Izin':'Alpa')+'</span></div>'
              + '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:4px 0">Tidak perlu input hafalan</div></div>';
          }).join('');
    }
    cont.innerHTML = html;

    if (cont.dataset.listenersBound) return;
    cont.dataset.listenersBound = '1';

    cont.addEventListener('input', function(e) {
      _kbmDraftSaveDebounced();
      if (e.target.id && e.target.id.startsWith('hfkbm-surat-display-')) {
        var mid2 = e.target.dataset.mid;
        hfKbmSuratInput(mid2, e.target.value);
      }
      if (e.target.id && e.target.id.startsWith('hfkbm-tgt-surat-')) {
        var mid2 = e.target.dataset.mid;
        hfKbmTargetSuratInput(mid2, e.target.value);
      }
      if (e.target.id && (e.target.id.startsWith('hfkbm-ayat-dari-') || e.target.id.startsWith('hfkbm-ayat-sampai-'))) {
        var maxV = parseInt(e.target.max); var val = parseInt(e.target.value);
        if (!isNaN(maxV) && !isNaN(val) && val > maxV) e.target.value = maxV;
        if (!isNaN(val) && val < 1) e.target.value = 1;
        
        if (e.target.id.startsWith('hfkbm-ayat-dari-')) {
          var mid2 = e.target.dataset.mid;
          if (mid2 && typeof updateAutoJuzKbm === 'function') updateAutoJuzKbm(mid2);
        }
      }
      if (e.target.id && (e.target.id.startsWith('hfkbm-tgt-dari-') || e.target.id.startsWith('hfkbm-tgt-sampai-'))) {
        var maxV = parseInt(e.target.max); var val = parseInt(e.target.value);
        if (!isNaN(maxV) && !isNaN(val) && val > maxV) e.target.value = maxV;
        if (!isNaN(val) && val < 1) e.target.value = 1;
      }
    });
    cont.addEventListener('focus', function(e) {
      if (e.target.id && e.target.id.startsWith('hfkbm-surat-display-')) {
        var mid2 = e.target.dataset.mid;
        hfKbmSuratInput(mid2, e.target.value);
      }
      if (e.target.id && e.target.id.startsWith('hfkbm-tgt-surat-')) {
        var mid2 = e.target.dataset.mid;
        hfKbmTargetSuratInput(mid2, e.target.value);
      }
    }, true);
    cont.addEventListener('blur', function(e) {
      if (e.target.id && (e.target.id.startsWith('hfkbm-surat-display-') || e.target.id.startsWith('hfkbm-tgt-surat-'))) {
        var eid2 = e.target.id.includes('tgt') ? 'hfkbm-tgt-dd-' + e.target.id.replace('hfkbm-tgt-surat-','') : 'hfkbm-dd-' + e.target.id.replace('hfkbm-surat-display-','');
        setTimeout(function(){ var dd = document.getElementById(eid2); if (dd) dd.style.display='none'; }, 200);
      }
    }, true);
    cont.addEventListener('change', function(e) {
      _kbmDraftSaveDebounced();
      var mid2 = e.target.dataset && e.target.dataset.mid;
      if (!mid2) return;
      if (e.target.classList.contains('hfkbm-kel') || e.target.classList.contains('hfkbm-nil')) {
        updateHfKbmPoin(mid2);
      }
      if (e.target.id && e.target.id.startsWith('hfkbm-juz-')) {
        var eid2 = _hfKbmEid(mid2);
        var dispEl = document.getElementById('hfkbm-surat-display-' + eid2);
        var valEl  = document.getElementById('hfkbm-surat-' + eid2);
        if (dispEl) dispEl.value = ''; if (valEl) valEl.value = '';
        var infoEl = document.getElementById('hfkbm-ayat-info-' + eid2);
        if (infoEl) infoEl.textContent = '— pilih surat —';
        hfKbmSuratInput(mid2, '');
      }
      if (e.target.classList.contains('hfkbm-jenis')) {
        var eid2    = _hfKbmEid(mid2);
        var dispEl  = document.getElementById('hfkbm-surat-display-' + eid2);
        var valEl   = document.getElementById('hfkbm-surat-' + eid2);
        if (dispEl) dispEl.value = ''; if (valEl) valEl.value = '';
        var infoEl = document.getElementById('hfkbm-ayat-info-' + eid2);
        if (infoEl) infoEl.textContent = '— pilih surat —';

        const sesiAktif = getSesiAktif();
        var id_halaqah = sesiAktif && sesiAktif.id_halaqah;
        if (id_halaqah && (!window._hfKbmZiyadah || !window._hfKbmZiyadah[mid2])) {
          window.HQ.GuruAPI.getZiyadahMurid(id_halaqah, mid2).then(function(res) {
            window._hfKbmZiyadah = window._hfKbmZiyadah || {};
            window._hfKbmZiyadah[mid2] = res.data || [];
            hfKbmSuratInput(mid2, '');
          }).catch(function(){});
        } else {
          hfKbmSuratInput(mid2, '');
        }
      }
    });

    const sesiAktif = getSesiAktif();
    var id_halaqah_kbm = sesiAktif && sesiAktif.id_halaqah;
    if (id_halaqah_kbm) {
      hadirList.forEach(function(m) {
        var mid = m.id_murid;
        if (!window._hfKbmZiyadah || !window._hfKbmZiyadah[mid]) {
          window.HQ.GuruAPI.getZiyadahMurid(id_halaqah_kbm, mid).then(function(res) {
            window._hfKbmZiyadah = window._hfKbmZiyadah || {};
            window._hfKbmZiyadah[mid] = res.data || [];
          }).catch(function(){});
        }
      });
    }

    hadirList.forEach(function(m){ updateHfKbmPoin(m.id_murid); });
    _restoreHafalanKbmCache();
  }

  function _hfKbmEid(mid) { return mid.replace(/[^a-zA-Z0-9-_]/g,'_'); }

  function updateHfKbmPoin(mid) {
    var eid     = _hfKbmEid(mid);
    var cfg     = typeof _hfLoadConfig === 'function' ? _hfLoadConfig() : { kelancaran: [], nilai: [] };
    var kelEl   = document.getElementById('hfkbm-kel-' + eid);
    var nilEl   = document.getElementById('hfkbm-nil-' + eid);
    var poinEl  = document.getElementById('hfkbm-poin-' + eid);
    if (!kelEl || !nilEl || !poinEl) return;
    var kelItem = (cfg.kelancaran||[]).find(function(k){ return k.nama === kelEl.value; });
    var nilItem = (cfg.nilai||[]).find(function(n){ return n.kode === nilEl.value; });
    var poin    = (kelItem ? kelItem.poin : 0) + (nilItem ? nilItem.poin : 0);
    poinEl.textContent = '⚡ Estimasi poin: +' + poin;
  }

  function hfKbmSuratInput(mid, q) {
    var eid      = _hfKbmEid(mid);
    var dd       = document.getElementById('hfkbm-dd-' + eid);
    var norm     = (q||'').toLowerCase().replace(/['-]/g,'');
    var juzEl    = document.getElementById('hfkbm-juz-' + eid);
    var selJuz   = juzEl ? parseInt(juzEl.value) : null;
    var jenisEl2 = document.getElementById('hfkbm-jenis-' + eid);
    var isMurajaah = jenisEl2 && jenisEl2.value === 'Murajaah';
    var isZiyadahMode = jenisEl2 && jenisEl2.value === 'Ziyadah';
    if (!dd) return;

    const sesiAktif = getSesiAktif();
    var needsZiyadah = isMurajaah || isZiyadahMode;
    if (needsZiyadah) {
      var ziyadahData = window._hfKbmZiyadah && window._hfKbmZiyadah[mid];
      if (!ziyadahData) {
        dd.innerHTML = '<div style="padding:10px;font-size:11px;color:#9ca3af;text-align:center">Memuat data Ziyadah...</div>';
        dd.style.display = 'block';
        window.HQ.GuruAPI.getZiyadahMurid(sesiAktif && sesiAktif.id_halaqah, mid).then(function(res) {
          window._hfKbmZiyadah = window._hfKbmZiyadah || {};
          window._hfKbmZiyadah[mid] = res.data || [];
          hfKbmSuratInput(mid, q);
        }).catch(function(){});
        return;
      }
    }

    if (isMurajaah) {
      var zList = ziyadahData.filter(function(z){ return !norm || z.surat.toLowerCase().replace(/['-]/g,'').includes(norm); });
      if (!zList.length) {
        dd.innerHTML = '<div style="padding:10px;font-size:11px;color:#9ca3af;text-align:center">Tidak ada Ziyadah ditemukan</div>';
        dd.style.display = 'block'; return;
      }
      dd.innerHTML = zList.map(function(z) {
        var meta = (typeof _getSuratData === 'function' ? _getSuratData() : [])
          .find(function(s){ return s.latin.toLowerCase().replace(/['-]/g,'') === z.surat.toLowerCase().replace(/['-]/g,''); }) || {};
        var synth = Object.assign({}, meta, { latin:z.surat, _murajaah:true, _ayat_dari:z.ayat_dari, _ayat_sampai:z.ayat_sampai, juz:meta.juz||[z.juz] });
        var safeJson = JSON.stringify(synth).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:12px" '
          + 'data-latin="' + esc(z.surat) + '" data-info="' + safeJson + '" data-mid="' + esc(mid) + '" '
          + 'class="hfkbm-dd-opt" '
          + 'onmousedown="hfKbmSelectSurat(this)">'
          + '<span style="background:#d1fae5;color:#065f46;width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (meta.no||'?') + '</span>'
          + '<span style="font-weight:600;flex:1">' + esc(z.surat) + '</span>'
          + '<span style="background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0">🔄 Ayat ' + z.ayat_dari + '–' + z.ayat_sampai + '</span>'
        + '</div>';
      }).join('');
      dd.style.display = 'block'; return;
    }

    var list = (typeof _getSuratData === 'function' ? _getSuratData() : [])
      .filter(function(s){
        var matchJuz  = !selJuz || (s.juz && s.juz.includes(selJuz));
        var matchName = !norm   || s.latin.toLowerCase().replace(/['-]/g,'').includes(norm);
        return matchJuz && matchName;
      });

    if (isZiyadahMode && ziyadahData) {
      list = list.map(function(s) {
        var isFullySet = typeof isSuratFullyMemorized === 'function' ? isSuratFullyMemorized(s.latin, ziyadahData) : false;
        var rawForSurat = ziyadahData.filter(function(z) {
          return z.surat.toLowerCase().replace(/['-]/g,'') === s.latin.toLowerCase().replace(/['-]/g,'');
        });
        var intervals = typeof mergeIntervals === 'function' ? mergeIntervals(rawForSurat) : [];
        return Object.assign({}, s, {
          _is_fully_set: isFullySet,
          _intervals: intervals,
          _sudah_disetor: intervals.length > 0
        });
      });

      list.sort(function(a, b) {
        if (a._is_fully_set === b._is_fully_set) return a.no - b.no;
        return a._is_fully_set ? 1 : -1;
      });
    }

    list = list.slice(0, 20);
    if (!list.length) {
      dd.innerHTML = '<div style="padding:10px;font-size:11px;color:#9ca3af;text-align:center">Tidak ditemukan</div>';
      dd.style.display = 'block'; return;
    }

    dd.innerHTML = list.map(function(s) {
      var safeJson = JSON.stringify(s).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      var badge = '';
      var rowStyle = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:12px;';
      var noStyle  = 'width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      var isClickable = true;

      if (isZiyadahMode && s._is_fully_set) {
        badge = '<span style="background:#dcfce7;color:#15803d;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0">✓ Selesai</span>';
        noStyle += 'background:#dcfce7;color:#15803d;';
        rowStyle += 'opacity:.5; pointer-events:none;';
        isClickable = false;
      } else if (isZiyadahMode && s._sudah_disetor) {
        var rangeStr = s._intervals.map(function(inv) {
          return inv.ayat_dari + '–' + inv.ayat_sampai;
        }).join(', ');
        badge = '<span style="background:#fffbeb;color:#d97706;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:normal;word-break:break-word" title="' + esc(rangeStr) + '">✓ Parsial: ' + esc(rangeStr) + '</span>';
        noStyle += 'background:#fef3c7;color:#d97706;';
      } else {
        noStyle += 'background:#e0f2fe;color:#0284c7;';
      }

      return '<div style="' + rowStyle + '" '
        + 'data-latin="' + s.latin.replace(/"/g,'&quot;') + '" data-info="' + safeJson + '" data-mid="' + esc(mid) + '" '
        + 'class="hfkbm-dd-opt" '
        + (isClickable ? 'onmousedown="hfKbmSelectSurat(this)"' : '') + '>'
        + '<span style="' + noStyle + '">' + s.no + '</span>'
        + '<span style="font-weight:600;flex:1">' + esc(s.latin) + '</span>'
        + badge
        + '<span style="color:#9ca3af;font-size:10px;margin-left:4px">' + s.ayat + ' ayat</span>'
      + '</div>';
    }).join('');
    dd.style.display = 'block';
  }

  function hfKbmSelectSurat(el) {
    var mid    = el.dataset.mid;
    var eid    = _hfKbmEid(mid);
    var latin  = el.dataset.latin;
    var s      = JSON.parse(el.dataset.info.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
    document.getElementById('hfkbm-surat-display-' + eid).value = latin;
    document.getElementById('hfkbm-surat-' + eid).value = latin;
    document.getElementById('hfkbm-dd-' + eid).style.display = 'none';
    var infoEl = document.getElementById('hfkbm-ayat-info-' + eid);
    if (infoEl) infoEl.textContent = latin + ' = ' + s.ayat + ' ayat';
    var dari   = document.getElementById('hfkbm-ayat-dari-' + eid);
    var sampai = document.getElementById('hfkbm-ayat-sampai-' + eid);
    if (dari)   { dari.max   = s.ayat; }
    if (sampai) { sampai.max = s.ayat; }
    if (s._murajaah && s._ayat_dari && s._ayat_sampai) {
      if (dari)   { dari.value   = s._ayat_dari;   dari.min   = s._ayat_dari;   dari.max   = s._ayat_sampai; }
      if (sampai) { sampai.value = s._ayat_sampai; sampai.min = s._ayat_dari;   sampai.max = s._ayat_sampai; }
      if (infoEl) infoEl.textContent = latin + ' · Range Ziyadah: Ayat ' + s._ayat_dari + '–' + s._ayat_sampai;
    } else {
      var suggestDari = 1;
      var ziyadahData = window._hfKbmZiyadah && window._hfKbmZiyadah[mid];
      if (ziyadahData) {
        var raw = ziyadahData.filter(function(z) {
          return z.surat.toLowerCase().replace(/['-]/g,'') === latin.toLowerCase().replace(/['-]/g,'');
        });
        var intervals = typeof mergeIntervals === 'function' ? mergeIntervals(raw) : [];
        if (intervals.length) {
          if (intervals[0].ayat_dari === 1) {
            suggestDari = intervals[0].ayat_sampai + 1;
          }
        }
      }
      if (suggestDari > s.ayat) suggestDari = '';
      if (dari) { dari.value = suggestDari; dari.min = 1; dari.max = s.ayat; }
      if (sampai) { sampai.value = ''; sampai.min = 1; sampai.max = s.ayat; }
    }
    if (s.juz && s.juz.length === 1) {
      var juzEl = document.getElementById('hfkbm-juz-' + eid);
      if (juzEl) juzEl.value = s.juz[0];
    } else {
      if (typeof updateAutoJuzKbm === 'function') updateAutoJuzKbm(mid);
    }
  }

  function hfKbmTargetSuratInput(mid, q) {
    var eid  = _hfKbmEid(mid);
    var dd   = document.getElementById('hfkbm-tgt-dd-' + eid);
    if (!dd) return;
    var norm = (q||'').toLowerCase().replace(/['-]/g,'');
    
    var ziyadahData = (window._hfKbmZiyadah && window._hfKbmZiyadah[mid]) || [];
    
    var list = (typeof _getSuratData === 'function' ? _getSuratData() : [])
      .filter(function(s){
        var matchName = !norm || s.latin.toLowerCase().replace(/['-]/g,'').includes(norm);
        if (!matchName) return false;
        var isFullySet = typeof isSuratFullyMemorized === 'function' ? isSuratFullyMemorized(s.latin, ziyadahData) : false;
        return !isFullySet;
      })
      .slice(0,10);
    if (!list.length) { dd.style.display='none'; return; }
    dd.innerHTML = list.map(function(s) {
      var safeJson = JSON.stringify({latin:s.latin,ayat:s.ayat}).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      return '<div class="hfkbm-dd-opt" style="padding:6px 10px;font-size:12px;border-radius:7px" '
        + 'data-latin="' + esc(s.latin) + '" data-info="' + safeJson + '" data-mid="' + esc(mid) + '" '
        + 'onmousedown="hfKbmSelectTargetSurat(this)">'
        + esc(s.latin) + ' <span style="color:#9ca3af;font-size:10px">' + s.ayat + ' ayat</span>'
      + '</div>';
    }).join('');
    dd.style.display = 'block';
  }

  function hfKbmSelectTargetSurat(el) {
    var mid = el.dataset.mid;
    var eid = _hfKbmEid(mid);
    var latin = el.dataset.latin;
    var s = JSON.parse(el.dataset.info.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
    document.getElementById('hfkbm-tgt-surat-' + eid).value = latin;
    document.getElementById('hfkbm-tgt-dd-' + eid).style.display = 'none';
    
    var tDari = document.getElementById('hfkbm-tgt-dari-' + eid);
    var tSampai = document.getElementById('hfkbm-tgt-sampai-' + eid);
    if (tDari) { tDari.value = ''; tDari.max = s.ayat; }
    if (tSampai) { tSampai.value = ''; tSampai.max = s.ayat; }
  }

  function renderMicroteachingKbm() {
    const cont = document.getElementById('microteachingKbmList');
    if (!cont) return;
    const muridSesi = getMuridSesi();
    if (!muridSesi || !muridSesi.length) {
      cont.innerHTML = emptyHTML('👥', 'Tidak ada murid', 'Silakan pilih halaqah yang memiliki murid.');
      return;
    }

    cont.innerHTML = muridSesi.map(function(m) {
      return buildMicroteachingCard(m);
    }).join('');

    _restoreMicroteachingKbmCache();
  }

  function buildMicroteachingCard(m) {
    var initials = (m.nama_murid || '').split(' ').slice(0, 2).map(function(w){ return w[0]||''; }).join('').toUpperCase();
    var id = m.id_murid;
    
    const presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(function(btn) {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });
    var status = presensiMap[id] || 'H';
    var statusText = status === 'H' ? 'Hadir' : status === 'T' ? 'Terlambat' : status === 'I' ? 'Izin' : 'Alpa';
    var statusColor = status === 'H' ? '#16a34a' : status === 'T' ? '#d97706' : status === 'I' ? '#2563eb' : '#dc2626';

    return '<div class="student-card card" id="mt-card-' + id + '" style="margin-bottom:24px; border-radius:16px; overflow:hidden; border:1.5px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.06);">'
      + '<div class="student-header" style="display:flex; align-items:center; gap:12px; padding:14px 18px; background:linear-gradient(135deg, #0d2d5e, #1a4fa8); color:#fff; flex-wrap:wrap;">'
        + '<div class="student-avatar" style="width:36px; height:36px; border-radius:8px; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px;">' + initials + '</div>'
        + '<div>'
          + '<div class="student-name" style="font-size:14.5px; font-weight:800; letter-spacing: 0.02em;">👤 ' + esc(m.nama_murid) + '</div>'
          + '<div style="font-size:11px; margin-top:2px;"><span style="background:'+statusColor+'; color:#fff; padding:2px 8px; border-radius:100px; font-weight:800;">'+statusText+'</span></div>'
        + '</div>'
        + '<div class="student-score-badge" id="mt-score-badge-' + id + '" style="margin-left:auto; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:100px; padding:4px 12px; font-size:12px; font-weight:900; letter-spacing: 0.04em;">OBSERVER</div>'
      + '</div>'
      + '<div style="padding:14px 18px 0; display:flex; align-items:center; gap:8px;">'
        + '<input type="checkbox" id="mt-toggle-' + id + '" data-status="'+status+'" onchange="toggleMicroteachingPracticing(\'' + id + '\')" style="width:18px; height:18px; cursor:pointer;">'
        + '<label for="mt-toggle-' + id + '" style="font-size:13px; font-weight:800; color:#1e3a8a; cursor:pointer; margin:0; user-select:none;">🎯 Jadwal Praktik Hari Ini</label>'
      + '</div>'
      + '<div id="mt-content-wrapper-' + id + '"></div>'
      + '</div>';
  }

  function toggleMicroteachingPracticing(id) {
    _kbmDraftSaveDebounced();
    var toggle = document.getElementById('mt-toggle-' + id);
    var wrapper = document.getElementById('mt-content-wrapper-' + id);
    if (!toggle || !wrapper) return;
    
    var isToggled = toggle.checked;
    var status = toggle.dataset.status || 'H';
    var isAbsent = ['A','I'].includes(status);
    
    if (!isToggled) {
      wrapper.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-3); font-style:italic; font-size:13px;">'
        + '👁️ Murid menyimak pertemuan ini sebagai observer (tidak dinilai).'
        + '</div>';
      var badge = document.getElementById('mt-score-badge-' + id);
      if (badge) badge.textContent = 'OBSERVER';
      return;
    }
    
    if (isAbsent) {
      wrapper.innerHTML = '<div style="padding:20px; text-align:center; color:var(--red); font-weight:700; font-size:13px; background:#fef2f2; border-radius:12px; border:1px solid #fca5a5; margin:10px 0;">'
        + '⚠️ Murid tidak hadir saat jadwal praktik. Nilai praktik otomatis dihitung 0 (Alpa).'
        + '</div>';
      var badge = document.getElementById('mt-score-badge-' + id);
      if (badge) badge.textContent = 'NILAI: 0';
      return;
    }
    
    var rubrikHTML = KRITERIA_MT.map(function(k) {
      var opts = OPT_MT.map(function(o, oi) {
        var radioId = 'mt-' + id + '-' + k.id + '-' + o.val;
        return '<div class="rubrik-option ' + o.cls + '">'
          + '<input type="radio" name="mt-' + id + '-' + k.id + '" id="' + radioId + '" value="' + o.val + '"'
            + ' onchange="updateMicroteachingScore(\'' + id + '\')">'
          + '<label for="' + radioId + '" style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 6px; border:1.5px solid var(--border); border-radius:10px; cursor:pointer; text-align:center; font-size:10px; min-height:85px; justify-content:center; width:100%; box-sizing:border-box;">'
            + '<span style="font-size:14px; font-weight:800; line-height:1">' + o.val + '</span>'
            + '<span style="font-size:10px; font-weight:700; margin:1px 0">' + o.code + '</span>'
            + '<span style="font-size:8.5px; opacity:0.8; line-height:1.25; display:block; margin-top:2px;">' + k.desc[oi] + '</span>'
          + '</label>'
        + '</div>';
      }).join('');
      return '<div class="rubrik-item" style="border-bottom:1px solid var(--border); padding:16px 0;">'
        + '<div class="rubrik-label" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">'
          + '<div class="rubrik-title-chip" style="background: linear-gradient(135deg, #fff7ed, #ffedd5); color: #c2410c; border: 1px solid #f97316; padding: 4px 12px; border-radius: 20px; font-size: 12.5px; font-weight: 800; display: inline-flex; align-items: center; box-shadow: 0 2px 4px rgba(249,115,22,0.08);">'
            + '✨ ' + k.label
          + '</div>'
          + '<div style="font-size:11px; color:#1e3a8a; font-weight:800; background:#dbeafe; border: 1px solid #3b82f6; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 4px rgba(59,130,246,0.08);">⚖️ Bobot ' + Math.round(k.bobot*100) + '%</div>'
        + '</div>'
        + '<div class="rubrik-options">' + opts + '</div>'
      + '</div>';
    }).join('');

    var badge = document.getElementById('mt-score-badge-' + id);
    if (badge) badge.textContent = '— / 100';

    wrapper.innerHTML = '<div class="rubrik-wrap" style="padding:12px 18px;">' + rubrikHTML + '</div>'
      + '<div id="mt-score-panel-' + id + '" style="padding:16px 18px; background:var(--bg-2); border-top:1.5px solid var(--border); border-bottom:1.5px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; transition:all 0.3s; margin: 8px 0;">'
        + '<div>'
          + '<div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-3); margin-bottom:2px;">Nilai Akhir Terhitung</div>'
          + '<div id="mt-score-desc-' + id + '" style="font-size:12px; color:var(--text-2);">0/5 kriteria diisi</div>'
        + '</div>'
        + '<div id="mt-score-box-' + id + '" style="background:#94a3b8; color:#fff; font-size:22px; font-weight:900; width:60px; height:60px; border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.05); flex-shrink:0; transition:all 0.3s;">—</div>'
      + '</div>'
      + '<div class="catatan-wrap" style="padding:12px 18px 18px;">'
        + '<label style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.03em; color:var(--text-3); display:block; margin-bottom:6px;">Catatan Penilaian</label>'
        + '<textarea class="fc" id="mt-catatan-' + id + '" rows="2" oninput="_kbmDraftSaveDebounced()" placeholder="Saran perbaikan, kendala, atau pencapaian spesifik murid..." style="font-size:12.5px; resize:vertical; padding:10px; border-radius:10px; border: 1.5px solid var(--border);"></textarea>'
      + '</div>';
  }

  function updateMicroteachingScore(id) {
    _kbmDraftSaveDebounced();
    var total = 0; var filled = 0; var filledBobot = 0;
    KRITERIA_MT.forEach(function(k) {
      var checked = document.querySelector('input[name="mt-'+id+'-'+k.id+'"]:checked');
      if (checked) {
        total += parseInt(checked.value) * k.bobot;
        filled++;
        filledBobot += k.bobot;
      }
    });
    var score = filled > 0 ? Math.round((total / filledBobot) * 25) : null;

    var badgeEl  = document.getElementById('mt-score-badge-' + id);
    var descEl   = document.getElementById('mt-score-desc-'  + id);
    var boxEl    = document.getElementById('mt-score-box-'   + id);
    var panelEl  = document.getElementById('mt-score-panel-' + id);

    if (score !== null) {
      var s = score;
      var bg = '#16a34a';
      var border = '#f0fdf4';
      var borderLine = '#bbf7d0';
      var text = '#15803d';
      if (s < 60) {
        bg = '#dc2626';
        border = '#fef2f2';
        borderLine = '#fecaca';
        text = '#b91c1c';
      } else if (s < 75) {
        bg = '#d97706';
        border = '#fffbeb';
        borderLine = '#fde68a';
        text = '#b45309';
      } else if (s < 88) {
        bg = '#2563eb';
        border = '#eff6ff';
        borderLine = '#bfdbfe';
        text = '#1d4ed8';
      }

      if (badgeEl) badgeEl.textContent = s + ' / 100';
      if (descEl) {
        var prefix = filled === KRITERIA_MT.length ? 'Semua kriteria terisi. Predikat: ' : (filled + '/' + KRITERIA_MT.length + ' kriteria. Estimasi: ');
        var predikat = s >= 88 ? 'Sangat Baik' : s >= 75 ? 'Baik' : s >= 60 ? 'Cukup' : 'Perlu Perbaikan';
        descEl.innerHTML = prefix + '<strong style="font-weight:800">' + predikat + '</strong>';
        descEl.style.color = text;
      }
      if (boxEl) {
        boxEl.textContent = s;
        boxEl.style.background = bg;
        boxEl.style.boxShadow = '0 4px 12px ' + bg + '40';
        boxEl.style.transform = 'scale(1.05)';
      }
      if (panelEl) {
        panelEl.style.background = border;
        panelEl.style.borderColor = borderLine;
      }
    } else {
      if (badgeEl) badgeEl.textContent = '0/' + KRITERIA_MT.length + ' terisi';
      if (descEl) {
        descEl.textContent = '0 dari ' + KRITERIA_MT.length + ' kriteria diisi';
        descEl.style.color = 'var(--text-2)';
      }
      if (boxEl) {
        boxEl.textContent = '—';
        boxEl.style.background = '#94a3b8';
        boxEl.style.boxShadow = 'none';
        boxEl.style.transform = 'scale(1)';
      }
      if (panelEl) {
        panelEl.style.background = 'var(--bg-2)';
        panelEl.style.borderColor = 'var(--border)';
      }
    }
  }

  function _saveMicroteachingKbmCache() {
    if (!window._microteachingKbmCache) window._microteachingKbmCache = {};
    const muridSesi = getMuridSesi();
    if (!muridSesi) return;
    muridSesi.forEach(function(m) {
      var id = m.id_murid;
      if (!document.getElementById('mt-toggle-'+id)) return;
      var toggle = document.getElementById('mt-toggle-'+id);
      var isToggled = toggle ? toggle.checked : false;
      
      var getCheckedVal = function(criteriaId) {
        var checked = document.querySelector('input[name="mt-'+id+'-'+criteriaId+'"]:checked');
        return checked ? checked.value : '';
      };
      var getV = function(eid){ var el=document.getElementById(eid); return el?el.value:''; };
      
      window._microteachingKbmCache[id] = {
        isToggled  : isToggled,
        penguasaan : isToggled ? getCheckedVal('penguasaan') : '',
        penyampaian: isToggled ? getCheckedVal('penyampaian') : '',
        tajwid     : isToggled ? getCheckedVal('tajwid') : '',
        interaksi  : isToggled ? getCheckedVal('interaksi') : '',
        waktu      : isToggled ? getCheckedVal('waktu') : '',
        catatan    : getV('mt-catatan-'+id),
      };
    });
  }

  function _restoreMicroteachingKbmCache() {
    const muridSesi = getMuridSesi();
    if (!window._microteachingKbmCache || !muridSesi) return;
    muridSesi.forEach(function(m) {
      var id = m.id_murid;
      var cache = window._microteachingKbmCache[id];
      if (!cache) return;
      
      var toggle = document.getElementById('mt-toggle-' + id);
      if (toggle) {
        toggle.checked = !!cache.isToggled;
        toggle.dispatchEvent(new Event('change'));
      }
      
      if (cache.isToggled) {
        var setChecked = function(criteriaId, val) {
          if (!val) return;
          var rad = document.querySelector('input[name="mt-'+id+'-'+criteriaId+'"][value="'+val+'"]');
          if (rad) {
            rad.checked = true;
            rad.dispatchEvent(new Event('change'));
          }
        };
        setChecked('penguasaan', cache.penguasaan);
        setChecked('penyampaian', cache.penyampaian);
        setChecked('tajwid', cache.tajwid);
        setChecked('interaksi', cache.interaksi);
        setChecked('waktu', cache.waktu);
        
        var note = document.getElementById('mt-catatan-' + id);
        if (note && cache.catatan) {
          note.value = cache.catatan;
        }
      }
    });
  }

  // ── DRAFT KBM LOCAL STORAGE ──────────────────────
  function _kbmDraftKey(id) { return 'hq_kbm_draft_' + id; }

  function _snapshotNilaiCache() {
    if (!window._nilaiCache) window._nilaiCache = {};
    const muridSesi = getMuridSesi();
    if (!muridSesi) return;
    muridSesi.forEach(function(m) {
      var a = document.getElementById('adab-' + m.id_murid);
      if (!a) return;
      var k  = document.getElementById('kamera-'  + m.id_murid);
      var ko = document.getElementById('koreksi-' + m.id_murid);
      var c  = document.getElementById('catatan-' + m.id_murid);
      var cur = window._nilaiCache[m.id_murid] || (window._nilaiCache[m.id_murid] = {});
      cur.adab = a.value;
      if (k)  cur.kamera  = k.value;
      if (ko) cur.koreksi = ko.value;
      if (c)  cur.catatan = c.value;
    });
  }

  function _mergeCacheObj(prev, cur) { return Object.assign({}, prev || {}, cur || {}); }

  function _saveKbmDraftLocal() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif || !sesiAktif.id_kbm) return;
    var jenis = sesiAktif.jenis_sesi;
    if (jenis === 'KBM Qiyam')           { _saveHafalanKbmCache(); }
    else if (jenis === 'Micro Teaching') { _saveMicroteachingKbmCache(); }
    else                                 { _snapshotNilaiCache(); }
    var prev = _loadKbmDraftLocal(sesiAktif.id_kbm) || {};
    var draft = {
      id_kbm        : sesiAktif.id_kbm,
      jenis_sesi    : jenis,
      updated_at    : new Date().toISOString(),
      nilai         : _mergeCacheObj(prev.nilai,         window._nilaiCache),
      hafalan       : _mergeCacheObj(prev.hafalan,       window._hafalanKbmCache),
      microteaching : _mergeCacheObj(prev.microteaching, window._microteachingKbmCache),
      daurah_asmt   : window._daurahAssessmentMap || {}
    };
    try { localStorage.setItem(_kbmDraftKey(sesiAktif.id_kbm), JSON.stringify(draft)); }
    catch (e) {}
    _kbmServerSyncDebounced();
  }

  var _kbmDraftTimer = null;
  function _kbmDraftSaveDebounced() {
    if (_kbmDraftTimer) clearTimeout(_kbmDraftTimer);
    _kbmDraftTimer = setTimeout(_saveKbmDraftLocal, 400);
  }

  function _loadKbmDraftLocal(id) {
    if (!id) return null;
    try { var r = localStorage.getItem(_kbmDraftKey(id)); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  function _clearKbmDraftLocal(id) {
    if (!id) return;
    try { localStorage.removeItem(_kbmDraftKey(id)); } catch (e) {}
    try { window.HQ.GuruAPI.clearKbmDraftServer(id).catch(function(){}); } catch (e) {}
  }

  function _mergeFill(mem, ls, hasData) {
    mem = mem || {};
    if (!ls) return mem;
    Object.keys(ls).forEach(function(id) {
      if (!hasData(mem[id])) mem[id] = ls[id];
    });
    return mem;
  }

  function _hafKbmHasContent(o){
    return !!(o && (o.surat || o.suratD || o.dari || o.sampai || o.catatan || (o.jenis && o.jenis !== 'Ziyadah')));
  }

  function _hydrateKbmCacheFromDraft(id) {
    var d = _loadKbmDraftLocal(id);
    if (!d) return;
    var anyData = function(o){ return !!(o && Object.keys(o).some(function(k){ return o[k]; })); };
    if (d.nilai)         window._nilaiCache            = _mergeFill(window._nilaiCache, d.nilai, anyData);
    if (d.hafalan)       window._hafalanKbmCache        = _mergeFill(window._hafalanKbmCache, d.hafalan, _hafKbmHasContent);
    if (d.microteaching) window._microteachingKbmCache  = _mergeFill(window._microteachingKbmCache, d.microteaching, anyData);
    if (d.daurah_asmt)   window._daurahAssessmentMap    = d.daurah_asmt;
  }

  var _kbmSyncTimer = null, _kbmSyncChipTimer = null;
  function _setKbmSyncStatus(state) {
    var el = document.getElementById('kbmSyncChip');
    if (!el) return;
    if (_kbmSyncChipTimer) { clearTimeout(_kbmSyncChipTimer); _kbmSyncChipTimer = null; }
    el.className = 'kbm-sync-chip show ' + state;
    if (state === 'syncing') {
      el.textContent = '↑ Menyinkronkan…';
    } else if (state === 'synced') {
      el.textContent = '✓ Tersimpan ke server';
      _kbmSyncChipTimer = setTimeout(function(){ el.className = 'kbm-sync-chip'; }, 1800);
    } else {
      el.textContent = '⚠ Tersimpan lokal · menunggu koneksi';
      _kbmSyncChipTimer = setTimeout(function(){ el.className = 'kbm-sync-chip'; }, 3500);
    }
  }

  function _kbmServerSyncFlush() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif || !sesiAktif.id_kbm) return;
    var d = _loadKbmDraftLocal(sesiAktif.id_kbm);
    if (!d) return;
    try {
      _setKbmSyncStatus('syncing');
      window.HQ.GuruAPI.saveKbmDraftServer({
        id_kbm     : sesiAktif.id_kbm,
        jenis_sesi : sesiAktif.jenis_sesi,
        draft      : { nilai: d.nilai || {}, hafalan: d.hafalan || {}, microteaching: d.microteaching || {} },
      }).then(function(){ _setKbmSyncStatus('synced'); })
        .catch(function(){ _setKbmSyncStatus('offline'); });
    } catch (e) { _setKbmSyncStatus('offline'); }
  }

  function _kbmServerSyncDebounced() {
    if (_kbmSyncTimer) clearTimeout(_kbmSyncTimer);
    _kbmSyncTimer = setTimeout(_kbmServerSyncFlush, 3000);
  }

  function _reconcileKbmDraftServer(id_kbm) {
    if (!id_kbm) return;
    try {
      window.HQ.GuruAPI.getKbmDraftServer(id_kbm).then(function(res) {
        var server = res && res.data;
        if (!server || !server.draft) return;
        var local = _loadKbmDraftLocal(id_kbm);
        var serverNewer = !local || !local.updated_at ||
          (server.updated_at && new Date(server.updated_at) > new Date(local.updated_at));
        if (!serverNewer) return;
        var dd = server.draft;
        try {
          localStorage.setItem(_kbmDraftKey(id_kbm), JSON.stringify({
            id_kbm: id_kbm, jenis_sesi: server.jenis_sesi, updated_at: server.updated_at,
            nilai: dd.nilai || {}, hafalan: dd.hafalan || {}, microteaching: dd.microteaching || {},
          }));
        } catch (e) {}
        _hydrateKbmCacheFromDraft(id_kbm);
      }).catch(function(){});
    } catch (e) {}
  }

  function _pruneKbmDrafts(idAktif) {
    var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000, now = Date.now();
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('hq_kbm_draft_') !== 0) continue;
        if (idAktif && key === _kbmDraftKey(idAktif)) continue;
        var d = null;
        try { d = JSON.parse(localStorage.getItem(key)); } catch (e) {}
        var age = (d && d.updated_at) ? (now - new Date(d.updated_at).getTime()) : Infinity;
        if (age > MAX_AGE_MS) localStorage.removeItem(key);
      }
    } catch (e) {}
  }

  async function simpanMicroteachingKBM() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    _saveMicroteachingKbmCache();

    const presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(function(btn) {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });

    const muridSesi = getMuridSesi();
    var valid = true;
    for (var i = 0; i < muridSesi.length; i++) {
      var m = muridSesi[i];
      var cache = window._microteachingKbmCache[m.id_murid] || {};
      var status = presensiMap[m.id_murid] || 'H';
      
      if (cache.isToggled && !['A','I'].includes(status)) {
        if (!cache.penguasaan || !cache.penyampaian || !cache.tajwid || !cache.interaksi || !cache.waktu) {
          toast('Semua kriteria penilaian wajib diisi untuk ' + m.nama_murid, 'warn');
          valid = false;
          break;
        }
      }
    }
    if (!valid) return;

    goToJurnal();
  }

  function goToPreviewNonReguler() {
    const sesiAktif = getSesiAktif();
    const muridSesi = getMuridSesi();
    const jenis = sesiAktif ? sesiAktif.jenis_sesi : '';

    const presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(btn => {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });
    const HADIR_LABEL = {H:'Hadir',T:'Terlambat',I:'Izin',A:'Alpa'};
    const HADIR_BADGE = {H:'b-green',T:'b-purple',I:'b-amber',A:'b-red'};

    const hadir    = Object.values(presensiMap).filter(v => ['H','T'].includes(v)).length;
    const izin     = Object.values(presensiMap).filter(v => v === 'I').length;
    const alpa     = Object.values(presensiMap).filter(v => v === 'A').length;

    document.getElementById('pvJenis').textContent    = jenis || 'Sesi KBM';
    document.getElementById('pvTanggal').textContent  = sesiAktif ? fmtDate(sesiAktif.tanggal_pertemuan) : '';
    document.getElementById('pvPertemuan').textContent= sesiAktif ? 'Pertemuan ke-' + sesiAktif.pertemuan_ke : '';
    document.getElementById('pvHadir').textContent    = hadir;
    document.getElementById('pvIzin').textContent     = izin;
    document.getElementById('pvAlpa').textContent     = alpa;

    const pvNilaiList = document.getElementById('pvNilaiList');
    if (pvNilaiList) {
      pvNilaiList.innerHTML = muridSesi.map(m => {
        const status = presensiMap[m.id_murid] || 'H';
        return '<div class="preview-murid-item">'
          + '<span style="font-weight:600">' + esc(m.nama_murid) + '</span>'
          + '<span class="badge ' + (HADIR_BADGE[status]||'b-gray') + '" style="font-size:11px">' + (HADIR_LABEL[status]||status) + '</span>'
          + '</div>';
      }).join('');
    }

    const warnEl = document.getElementById('pvWarningNilai');
    if (warnEl) warnEl.style.display = 'none';

    const footEl = document.getElementById('pvFootNote');
    if (footEl) footEl.textContent = 'Presensi ' + jenis + ' akan disimpan. Tidak ada nilai & jurnal.';

    openModal('previewModal');
  }

  function goToJurnal() {
    _saveHafalanKbmCache();
    _saveMicroteachingKbmCache();
    var jamEl = document.getElementById('jurnalJamSelesai');
    if (jamEl) jamEl.value = new Date().toTimeString().slice(0,5);
    goPage('jurnal');
    renderSteps('jurnal');
    document.getElementById('pageTitle').textContent = 'Jurnal — Step 4/4';
  }

  function _saveHafalanKbmCache() {
    if (!window._hafalanKbmCache) window._hafalanKbmCache = {};
    const muridSesi = getMuridSesi();
    if (!muridSesi) return;
    muridSesi.forEach(function(m) {
      var eid = _hfKbmEid(m.id_murid);
      if (!document.getElementById('hfkbm-jenis-'+eid)) return;
      var getV = function(id){ var el=document.getElementById(id);return el?el.value:''; };
      var obj = {
        jenis  : getV('hfkbm-jenis-'+eid), juz     : getV('hfkbm-juz-'+eid),
        surat  : getV('hfkbm-surat-'+eid), suratD  : getV('hfkbm-surat-display-'+eid),
        dari   : getV('hfkbm-ayat-dari-'+eid), sampai: getV('hfkbm-ayat-sampai-'+eid),
        kel    : getV('hfkbm-kel-'+eid),   nil    : getV('hfkbm-nil-'+eid),
        kam    : getV('hfkbm-kam-'+eid),   catatan: getV('hfkbm-catatan-'+eid),
        tgtSrt : getV('hfkbm-tgt-surat-'+eid),
        tgtDari: getV('hfkbm-tgt-dari-'+eid), tgtSmp: getV('hfkbm-tgt-sampai-'+eid),
      };
      var prev = window._hafalanKbmCache[m.id_murid];
      if (!_hafKbmHasContent(obj) && _hafKbmHasContent(prev)) return;
      window._hafalanKbmCache[m.id_murid] = obj;
    });
  }

  function _restoreHafalanKbmCache() {
    const muridSesi = getMuridSesi();
    if (!window._hafalanKbmCache || !muridSesi) return;
    muridSesi.forEach(function(m) {
      var eid   = _hfKbmEid(m.id_murid);
      var cache = window._hafalanKbmCache[m.id_murid];
      if (!cache) return;
      var setV = function(id,v){ var el=document.getElementById(id);if(el&&v)el.value=v; };
      var setSel = function(id,v){ var el=document.getElementById(id); if(!el||(v===undefined||v==='')) return;
        el.value=v;
        if(el.value!==v){ var o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); el.value=v; } };
      setSel('hfkbm-jenis-'+eid, cache.jenis);
      setSel('hfkbm-juz-'+eid,   cache.juz);
      setV('hfkbm-surat-'+eid,   cache.surat);
      setV('hfkbm-surat-display-'+eid, cache.suratD);
      setV('hfkbm-ayat-dari-'+eid,  cache.dari);
      setV('hfkbm-ayat-sampai-'+eid,cache.sampai);
      setSel('hfkbm-kel-'+eid,    cache.kel);
      setSel('hfkbm-nil-'+eid,    cache.nil);
      setSel('hfkbm-kam-'+eid,    cache.kam);
      setV('hfkbm-catatan-'+eid, cache.catatan);
      setV('hfkbm-tgt-surat-'+eid, cache.tgtSrt);
      setV('hfkbm-tgt-dari-'+eid,  cache.tgtDari);
      setV('hfkbm-tgt-sampai-'+eid,cache.tgtSmp);
      if (cache.suratD) {
        var meta = (typeof _getSuratData === 'function' ? _getSuratData() : [])
          .find(function(s){ return s.latin === cache.suratD; });
        var infoEl = document.getElementById('hfkbm-ayat-info-'+eid);
        if (infoEl && meta) { infoEl.textContent = cache.suratD + ' = ' + meta.ayat + ' ayat'; }
      }
      updateHfKbmPoin(m.id_murid);
    });
  }

  function simpanHafalanKBM() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    _saveHafalanKbmCache();

    var presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(function(btn) {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });

    const muridSesi = getMuridSesi();
    var valid = true;
    for (var i = 0; i < muridSesi.length; i++) {
      var m = muridSesi[i];
      var status = presensiMap[m.id_murid] || 'A';
      if (status !== 'H' && status !== 'T') continue;

      var cache = window._hafalanKbmCache[m.id_murid] || {};
      if (!cache.jenis) {
        toast('Pilih jenis setoran untuk ' + m.nama_murid, 'warn');
        valid = false; break;
      }
      if (cache.jenis !== 'Tahsin') {
        if (!cache.surat) {
          toast('Pilih nama surat untuk ' + m.nama_murid, 'warn');
          valid = false; break;
        }
        var aD = parseInt(cache.dari);
        var aS = parseInt(cache.sampai);
        if (isNaN(aD) || isNaN(aS)) {
          toast('Isi range ayat untuk ' + m.nama_murid, 'warn');
          valid = false; break;
        }
        if (aD > aS) {
          toast('Ayat Dari tidak boleh melebihi Sampai Ayat untuk ' + m.nama_murid, 'warn');
          valid = false; break;
        }
        if (!cache.juz) {
          toast('Pilih Juz untuk ' + m.nama_murid, 'warn');
          valid = false; break;
        }

        var meta = _getSuratData().find(function(sd) {
          return sd.latin.toLowerCase().replace(/['-]/g,'') === cache.surat.toLowerCase().replace(/['-]/g,'');
        });
        if (meta && (aD > meta.ayat || aS > meta.ayat)) {
          toast('Ayat ' + m.nama_murid + ' melebihi jumlah ayat surat ' + meta.latin + ' (' + meta.ayat + ' ayat)', 'warn');
          valid = false; break;
        }

        if (cache.jenis === 'Ziyadah') {
          var raw = (window._hfKbmZiyadah && window._hfKbmZiyadah[m.id_murid]) || [];
          var intervals = typeof mergeIntervals === 'function' ? mergeIntervals(raw) : [];
          var overlap = typeof checkZiyadahOverlap === 'function' ? checkZiyadahOverlap(intervals, aD, aS) : null;
          if (overlap) {
            toast('Gagal: ' + m.nama_murid + ' sudah menyetor Ziyadah ayat ' + overlap.ayat_dari + '–' + overlap.ayat_sampai + ' pada surat ini!', 'warn');
            valid = false; break;
          }
        } else if (cache.jenis === 'Murajaah') {
          var raw = (window._hfKbmZiyadah && window._hfKbmZiyadah[m.id_murid]) || [];
          var intervals = typeof mergeIntervals === 'function' ? mergeIntervals(raw) : [];
          var contained = typeof checkMurajaahContainment === 'function' ? checkMurajaahContainment(intervals, aD, aS) : true;
          if (!contained) {
            toast('Gagal: Rentang Murajaah ' + m.nama_murid + ' harus berada di dalam range Ziyadah yang sudah disetor!', 'warn');
            valid = false; break;
          }
        }
      }

      if (cache.tgtSrt && (!cache.tgtDari || !cache.tgtSmp)) {
        toast('Tolong isi ayat mulai dan selesai untuk target hafalan ' + m.nama_murid, 'warn');
        valid = false; break;
      }
      if (!cache.tgtSrt && (cache.tgtDari || cache.tgtSmp)) {
        toast('Tolong pilih nama surat target hafalan untuk ' + m.nama_murid, 'warn');
        valid = false; break;
      }
      if (cache.tgtSrt && cache.tgtDari && cache.tgtSmp) {
        var tgtD = parseInt(cache.tgtDari);
        var tgtS = parseInt(cache.tgtSmp);
        if (tgtD > tgtS) {
          toast('Ayat Dari target tidak boleh melebihi Sampai Ayat target untuk ' + m.nama_murid, 'warn');
          valid = false; break;
        }
        var targetMeta = _getSuratData().find(function(sd) {
          return sd.latin.toLowerCase().replace(/['-]/g,'') === cache.tgtSrt.toLowerCase().replace(/['-]/g,'');
        });
        if (targetMeta && (tgtD > targetMeta.ayat || tgtS > targetMeta.ayat)) {
          toast('Target ayat ' + m.nama_murid + ' melebihi jumlah ayat surat ' + targetMeta.latin + ' (' + targetMeta.ayat + ' ayat)', 'warn');
          valid = false; break;
        }
        var raw = (window._hfKbmZiyadah && window._hfKbmZiyadah[m.id_murid]) || [];
        var rawForSurat = raw.filter(function(z) {
          return z.surat.toLowerCase().replace(/['-]/g,'') === cache.tgtSrt.toLowerCase().replace(/['-]/g,'');
        });
        var tgtIntervals = typeof mergeIntervals === 'function' ? mergeIntervals(rawForSurat) : [];
        var overlap = typeof checkZiyadahOverlap === 'function' ? checkZiyadahOverlap(tgtIntervals, tgtD, tgtS) : null;
        if (overlap) {
          toast('Gagal: Target ' + m.nama_murid + ' ayat ' + tgtD + '–' + tgtS + ' tumpang tindih dengan Ziyadah yang sudah disetor (ayat ' + overlap.ayat_dari + '–' + overlap.ayat_sampai + ')!', 'warn');
          valid = false; break;
        }
      }
    }

    if (!valid) return;
    goToJurnal();
  }

  function lanjutKeJurnal() {
    const muridSesi = getMuridSesi();
    if (typeof muridSesi !== 'undefined' && muridSesi.length) {
      if (!window._nilaiCache) window._nilaiCache = {};
      muridSesi.forEach(function(m) {
        var adabEl = document.getElementById('adab-'    + m.id_murid);
        var kamEl  = document.getElementById('kamera-'  + m.id_murid);
        var korEl  = document.getElementById('koreksi-' + m.id_murid);
        var catEl  = document.getElementById('catatan-' + m.id_murid);
        window._nilaiCache[m.id_murid] = {
          adab    : adabEl ? adabEl.value : '',
          kamera  : kamEl  ? kamEl.value  : '',
          koreksi : korEl  ? korEl.value  : '',
          catatan : catEl  ? catEl.value  : '',
        };
      });
    }
    goToJurnal();
  }

  function kembaliKeStep1() {
    goPage('kbm');
    document.getElementById('pageTitle').textContent = 'Sesi KBM';
  }

  function kembaliKeStep2() {
    _saveKbmDraftLocal();
    goPage('presensi');
    renderSteps('presensi');
    document.getElementById('pageTitle').textContent = 'Presensi — Step 2/4';
  }

  function kembaliKeStep3() {
    const sesiAktif = getSesiAktif();
    var jenis = sesiAktif && sesiAktif.jenis_sesi;
    if (jenis === 'KBM Qiyam') {
      goPage('hafalan-kbm');
      renderSteps('hafalan-kbm');
      document.getElementById('pageTitle').textContent = 'Hafalan — Step 3/4';
      setTimeout(function() { _restoreHafalanKbmCache(); }, 80);
      return;
    }
    if (jenis === 'Micro Teaching') {
      goPage('microteaching-kbm');
      renderSteps('microteaching-kbm');
      document.getElementById('pageTitle').textContent = 'Assessment — Step 3/4';
      setTimeout(function() { _restoreMicroteachingKbmCache(); }, 80);
      return;
    }
    goToNilai();
    setTimeout(function() {
      if (!window._nilaiCache) return;
      Object.keys(window._nilaiCache).forEach(function(id) {
        var cache = window._nilaiCache[id];
        var setV = function(eid, v){ var el=document.getElementById(eid); if(el&&v) el.value=v; };
        setV('adab-'+id, cache.adab); setV('kamera-'+id, cache.kamera);
        setV('koreksi-'+id, cache.koreksi); setV('catatan-'+id, cache.catatan);
      });
    }, 100);
  }

  function renderNilaiMuridStep() {
    const cont = document.getElementById('nilaiMuridList');
    if (!cont) return;
    const muridSesi = getMuridSesi();
    if (!muridSesi.length) { cont.innerHTML = emptyHTML('👥','Tidak ada murid',''); return; }

    const presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(btn => {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });

    const HADIR_LABEL = {H:'Hadir',T:'Terlambat',I:'Izin',A:'Alpa'};
    const HADIR_BADGE = {H:'b-green',T:'b-purple',I:'b-amber',A:'b-red'};

    const URUTAN = {H:0, T:1, I:2, A:3};
    const muridSorted = muridSesi.slice().sort(function(a, b) {
      var sa = URUTAN[presensiMap[a.id_murid] || 'H'] || 0;
      var sb = URUTAN[presensiMap[b.id_murid] || 'H'] || 0;
      return sa - sb || (a.nama_murid||'').localeCompare(b.nama_murid||'');
    });

    var adaHadir  = muridSorted.some(function(m){ var s=presensiMap[m.id_murid]||'H'; return s==='H'||s==='T'; });
    var adaTidak  = muridSorted.some(function(m){ var s=presensiMap[m.id_murid]||'H'; return s==='I'||s==='A'; });
    var sepInserted = false;

    const sesiAktif = getSesiAktif();
    let terisi = 0;
    cont.innerHTML = muridSorted.map(m => {
      const status   = presensiMap[m.id_murid] || 'H';
      const isAlpa   = status === 'A';
      const isIzin   = status === 'I';
      const isSkip   = isAlpa || isIzin;
      var _cache  = (sesiAktif && window._nilaiCache && window._nilaiCache[m.id_murid]) || {};
      const adabVal = (document.getElementById('adab-'   + m.id_murid) ? document.getElementById('adab-'   + m.id_murid).value : '') || _cache.adab || '';
      const kamVal  = (document.getElementById('kamera-' + m.id_murid) ? document.getElementById('kamera-' + m.id_murid).value : '') || _cache.kamera || '';
      const korVal  = (document.getElementById('koreksi-'+ m.id_murid) ? document.getElementById('koreksi-'+ m.id_murid).value : '') || _cache.koreksi || '';
      const catVal  = (document.getElementById('catatan-'+ m.id_murid) ? document.getElementById('catatan-'+ m.id_murid).value : '') || _cache.catatan || '';
      if (adabVal && !isSkip) terisi++;

      const cardClass = isSkip ? 'nilai-murid-card alpa' : (adabVal ? 'nilai-murid-card terisi' : 'nilai-murid-card');
      const skipMsg   = isAlpa
        ? '<div style="font-size:12.5px;color:var(--text-3);font-style:italic;padding:6px 0">🔴 Murid alpa — nilai tidak perlu diisi</div>'
        : '<div style="font-size:12.5px;color:var(--text-3);font-style:italic;padding:6px 0">🟡 Murid izin — nilai tidak perlu diisi</div>';

      const nilaiForm = [
        '<div style="margin-bottom:8px">',
        '  <div class="fg" style="margin:0">',
        '    <div class="nm-section-label">😊 Adab</div>',
        '    <select class="fc" id="adab-' + esc(m.id_murid) + '" style="font-size:13px" onchange="updateNilaiCard(\'' + esc(m.id_murid) + '\');_saveKbmDraftLocal()">',
        '      <option value="">— Pilih —</option>',
        '      <option value="Baik"' + (adabVal==='Baik' ? ' selected' : '') + '>😊 Baik</option>',
        '      <option value="Butuh Perhatian"' + (adabVal==='Butuh Perhatian' ? ' selected' : '') + '>⚠️ Butuh Perhatian</option>',
        '    </select>',
        '  </div>',
        '</div>',
        '<div style="margin-bottom:8px">',
        '  <div class="fg" style="margin:0">',
        '    <div class="nm-section-label">📷 Kamera Murid</div>',
        '    <select class="fc" id="kamera-' + esc(m.id_murid) + '" style="font-size:13px" onchange="_saveKbmDraftLocal()">',
        '      <option value="">— Pilih —</option>',
        '      <option value="kamera terbuka"' + (kamVal==='kamera terbuka' ? ' selected' : '') + '>📷 kamera terbuka</option>',
        '      <option value="kamera sering buka tutup"' + (kamVal==='kamera sering buka tutup' ? ' selected' : '') + '>🟡 kamera sering buka tutup</option>',
        '      <option value="kamera tertutup"' + (kamVal==='kamera tertutup' ? ' selected' : '') + '>❌ kamera tertutup</option>',
        '    </select>',
        '  </div>',
        '</div>',
        '<div class="fg" style="margin:0">',
        '  <div class="nm-section-label">✏️ Koreksi Tahsin</div>',
        '  <div id="chips-' + esc(m.id_murid) + '" style="margin-bottom:8px"></div>',
        '  <textarea class="fc" id="koreksi-' + esc(m.id_murid) + '" rows="3" oninput="autoResizeKor(this);_kbmDraftSaveDebounced()" placeholder="Makhraj huruf, mad, dll..." style="font-size:13px;resize:vertical;min-height:72px">' + esc(korVal) + '</textarea>',
        '  <div style="display:flex;justify-content:flex-end;margin-top:4px">',
        '    <button type="button" data-mid="' + esc(m.id_murid) + '" data-mnm="' + esc(m.nama_murid) + '" onclick="bukaRiwayatKoreksi(this.dataset.mid,this.dataset.mnm)" style="background:var(--blue-l);border:1.5px solid var(--blue);color:var(--blue);border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;width:100%;margin-top:6px;display:block">📋 Lihat Riwayat Koreksi Sebelumnya</button>',
        '  </div>',
        '</div>',
        '<div class="fg" style="margin-top:10px">',
        '  <div class="nm-section-label">📝 Catatan Lainnya</div><div style="font-size:10px;color:var(--text-3);font-weight:500;margin-bottom:5px">(opsional)</div>',
        '  <textarea class="fc" id="catatan-' + esc(m.id_murid) + '" rows="2" oninput="_kbmDraftSaveDebounced()" placeholder="Catatan khusus untuk murid ini..." style="font-size:13px;resize:vertical">' + esc(catVal) + '</textarea>',
        '</div>',
      ].join('\n');

      var daurahHtml = '';
      if (m.level === 'Tahsin Al-Fatihah' && window._daurahAssessmentItems && window._daurahAssessmentItems.length > 0) {
        var meetingNo = (sesiAktif && sesiAktif.pertemuan_ke) || 1;
        var meetingItems = getDaurahItemsForMeeting(meetingNo, window._daurahAssessmentItems);
        if (meetingItems.length > 0) {
          daurahHtml = '<div class="daurah-kbm-assessment" style="margin-top:12px;padding-top:12px;border-top:1.5px dashed var(--border);margin-bottom:8px">'
            + '<div class="nm-section-label" style="display:flex;align-items:center;gap:4px;color:var(--blue-d);font-weight:800;font-size:12px">'
            + '🎯 Evaluasi Bacaan: ' + getDaurahDayTitle(meetingNo)
            + '</div>'
            + meetingItems.map(function(item) {
              var ans = (window._daurahAssessmentMap && window._daurahAssessmentMap[m.id_murid] && window._daurahAssessmentMap[m.id_murid][item.id_item]) || null;
              return '<div class="daurah-asmt-row" style="margin-top:8px">'
                + '<div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:4px">'
                + (item.teks_arab ? '<span style="font-family:Amiri,serif;font-size:15px;direction:rtl;margin-right:6px">' + esc(item.teks_arab) + '</span>' : '')
                + '<span>' + esc(item.teks_latin) + '</span>'
                + '</div>'
                + (item.keterangan ? '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px">' + esc(item.keterangan) + '</div>' : '')
                + '<div style="display:flex;gap:6px">'
                + '<button type="button" class="btn-asmt-opt btn-paham ' + (ans === 'paham' ? 'active' : '') + '" onclick="setDaurahAsmtScore(\'' + esc(m.id_murid) + '\', \'' + esc(item.id_item) + '\', \'paham\', this)">✅ Paham</button>'
                + '<button type="button" class="btn-asmt-opt btn-ragu ' + (ans === 'ragu' ? 'active' : '') + '" onclick="setDaurahAsmtScore(\'' + esc(m.id_murid) + '\', \'' + esc(item.id_item) + '\', \'ragu\', this)">🟡 Ragu</button>'
                + '<button type="button" class="btn-asmt-opt btn-belum ' + (ans === 'belum' ? 'active' : '') + '" onclick="setDaurahAsmtScore(\'' + esc(m.id_murid) + '\', \'' + esc(item.id_item) + '\', \'belum\', this)">❌ Belum</button>'
                + '</div>'
                + '</div>';
            }).join('')
            + '</div>';
        }
      }

      var initials = m.nama_murid.split(' ').map(function(w){return w[0]||'';}).join('').substring(0,2).toUpperCase();
      var badgeCls = {'H':'nm-badge-H','T':'nm-badge-T','I':'nm-badge-I','A':'nm-badge-A'}[status] || 'nm-badge-H';

      var sepHtml = '';
      if (adaHadir && adaTidak && (status === 'I' || status === 'A') && !sepInserted) {
        sepInserted = true;
        sepHtml = '<div style="display:flex;align-items:center;gap:10px;margin:14px 0 10px">'
          + '<div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,#fde68a)"></div>'
          + '<div style="font-size:10px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:100px;padding:3px 12px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap">⬇ Izin &amp; Alpa</div>'
          + '<div style="flex:1;height:1px;background:linear-gradient(90deg,#fde68a,transparent)"></div>'
          + '</div>';
      }

      return sepHtml + '<div class="' + cardClass + '" id="nmcard-' + esc(m.id_murid) + '">'
        + '<div class="nm-header">'
        + '<div class="nm-nama">'
        + '<div class="nm-nama-avatar">' + initials + '</div>'
        + esc(m.nama_murid)
        + '</div>'
        + '<span class="nm-badge-hadir ' + badgeCls + '">' + (HADIR_LABEL[status]||status) + '</span>'
        + '</div>'
        + '<div class="nm-body">'
        + (isSkip ? skipMsg : (nilaiForm + daurahHtml))
        + '</div>'
        + '</div>';
    }).join('');

    function doRenderChips() {
      muridSesi.forEach(function(m) {
        var status = presensiMap[m.id_murid] || 'H';
        if (!['A','I'].includes(status) && typeof renderChipsKoreksi === 'function') {
          renderChipsKoreksi(m.id_murid);
        }
      });
    }
    if (typeof templateKoreksi !== 'undefined' && Object.keys(templateKoreksi).length > 0) {
      doRenderChips();
    } else if (typeof loadTemplateKoreksi === 'function') {
      loadTemplateKoreksi().then(function() { doRenderChips(); });
    }

    const total = muridSesi.filter(function(m){ return !['A','I'].includes(presensiMap[m.id_murid]||'H'); }).length;
    const progEl = document.getElementById('nilaiProgress');
    if (progEl) progEl.textContent = terisi + '/' + total + ' terisi';
  }

  function updateNilaiCard(id_murid) {
    const card = document.getElementById('nmcard-' + id_murid);
    var adabEl = document.getElementById('adab-' + id_murid);
    var val    = adabEl ? adabEl.value : '';
    if (card) card.className = 'nilai-murid-card ' + (val ? 'terisi' : '');

    const presensiMap = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(btn => {
      presensiMap[btn.dataset.id] = btn.dataset.k;
    });
    const muridSesi = getMuridSesi();
    const terisi = muridSesi.filter(m => {
      const status = presensiMap[m.id_murid] || 'H';
      return !['A','I'].includes(status) && document.getElementById('adab-'+m.id_murid) && document.getElementById('adab-'+m.id_murid).value;
    }).length;
    const total = muridSesi.filter(function(m){ return !['A','I'].includes(presensiMap[m.id_murid]||'H'); }).length;
    const progEl = document.getElementById('nilaiProgress');
    if (progEl) progEl.textContent = terisi + '/' + total + ' terisi';
  }

  function renderNilaiList() { renderNilaiMuridStep(); }

  async function doSelesaiKBM() {
    const sesiAktif = getSesiAktif();
    if (!sesiAktif) return;
    const muridSesi = getMuridSesi();

    const presensiMapPv = {};
    document.querySelectorAll('#presensiList .pb.on').forEach(btn => {
      presensiMapPv[btn.dataset.id] = btn.dataset.k;
    });

    const isRegulerSesi = !sesiAktif || sesiAktif.jenis_sesi === 'KBM Reguler';
    const isQiyamSesi = sesiAktif && sesiAktif.jenis_sesi === 'KBM Qiyam';
    const isMicroteachingSesi = sesiAktif && sesiAktif.jenis_sesi === 'Micro Teaching';

    if (isRegulerSesi) {
      const incompleteCount = muridSesi.filter(m => {
        const status = presensiMapPv[m.id_murid] || 'H';
        const adab   = (document.getElementById('adab-'+m.id_murid)   ? document.getElementById('adab-'+m.id_murid).value   : '') || '';
        const kamera = (document.getElementById('kamera-'+m.id_murid) ? document.getElementById('kamera-'+m.id_murid).value : '') || '';
        return !['A','I'].includes(status) && (!adab || !kamera);
      }).length;

      if (incompleteCount > 0) {
        const confirmMsg = `Peringatan: Ada ${incompleteCount} murid hadir yang belum lengkap nilai Adab atau Kameranya.\n\n` +
          `Nilai yang belum lengkap akan langsung memengaruhi raport akhir Murid.\n` +
          `Mengisi nilai secara lengkap dan tepat waktu merupakan bentuk menjalankan AMANAH kita sebagai guru.\n\n` +
          `Apakah Anda yakin tetap ingin menutup sesi ini?`;
        if (!(await showConfirm(confirmMsg, { title: '⚠️ Nilai Belum Lengkap', okText: 'Tetap Tutup Sesi', danger: true }))) return;
      }
    }

    if (isMicroteachingSesi) {
      const incompleteMT = muridSesi.filter(m => {
        const cache = window._microteachingKbmCache[m.id_murid] || {};
        const status = presensiMapPv[m.id_murid] || 'H';
        if (!cache.isToggled || ['A','I'].includes(status)) return false;
        const filled = KRITERIA_MT.filter(k => cache[k.id]).length;
        return filled > 0 && filled < KRITERIA_MT.length;
      }).length;
      if (incompleteMT > 0) {
        const confirmMsg = `Peringatan: Ada ${incompleteMT} peserta Praktik Mengajar yang rubrik penilaiannya baru terisi sebagian.\n\n` +
          `Penilaian yang belum lengkap TIDAK akan tersimpan (nilai kosong) dan tidak bisa diisi lagi setelah sesi ditutup.\n\n` +
          `Apakah Anda yakin tetap ingin menutup sesi ini?`;
        if (!(await showConfirm(confirmMsg, { title: '⚠️ Penilaian Belum Lengkap', okText: 'Tetap Tutup Sesi', danger: true }))) return;
      }
    }

    const saveJurnal  = isRegulerSesi || isQiyamSesi || isMicroteachingSesi;
    const materi     = saveJurnal ? document.getElementById('jurnalMateri').value.trim() : '';
    const halaman    = (isRegulerSesi || isMicroteachingSesi) ? (document.getElementById('jurnalHalaman') ? document.getElementById('jurnalHalaman').value.trim() : '') : '';
    const metode     = (isRegulerSesi || isMicroteachingSesi) ? document.getElementById('jurnalMetode').value : '';
    const catatan    = saveJurnal ? document.getElementById('jurnalCatatan').value.trim() : '';
    const jamSelesai = saveJurnal
      ? (document.getElementById('jurnalJamSelesai').value || new Date().toTimeString().slice(0,5))
      : new Date().toTimeString().slice(0,5);
    const savePr = isRegulerSesi || isQiyamSesi;
    const latihanMandiri  = savePr ? document.getElementById('jurnalLatihanMandiri').value.trim() : '';
    const jenisLatihan    = savePr ? document.getElementById('jurnalJenisLatihan').value : '';
    const deadlineLatihan = savePr ? (document.getElementById('jurnalDeadline').value || null) : null;
    const referensiUrl    = savePr ? document.getElementById('jurnalReferensiUrl').value.trim() : '';

    if (savePr) {
      if (jenisLatihan !== '') {
        if (!latihanMandiri) {
          toast("Harap isi Deskripsi Latihan Mandiri (PR) jika Jenis Latihan dipilih.", "warn");
          return;
        }
        if (!deadlineLatihan) {
          toast("Harap isi Tanggal Batas Waktu (Deadline) Pengerjaan PR.", "warn");
          return;
        }
        if (referensiUrl && !referensiUrl.startsWith("http://") && !referensiUrl.startsWith("https://")) {
          toast("Tautan referensi harus diawali dengan http:// atau https://", "warn");
          return;
        }
      } else {
        if (latihanMandiri || deadlineLatihan || referensiUrl) {
          toast("Harap pilih Jenis Latihan Mandiri (PR) jika deskripsi, batas waktu, atau tautan diisi.", "warn");
          return;
        }
        
        try {
          const lastPrRes = await window.HQ.GuruAPI.getLastKbmWithPr(sesiAktif.id_halaqah);
          if (lastPrRes.status === 'ok' && lastPrRes.data) {
            const lastPrDate = new Date(lastPrRes.data.tanggal_pertemuan);
            const currentDate = new Date(sesiAktif.tanggal_pertemuan);
            const diffDays = Math.ceil((currentDate - lastPrDate) / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) {
              const confirmPrMsg = `💡 Pengingat SOP: Halaqah Anda sudah ${diffDays} hari tidak menerima tugas PR.\n`
                + `Untuk menjaga keaktifan latihan murid di luar kelas, disarankan memberikan Latihan Mandiri.\n\n`
                + `Apakah Anda yakin tetap ingin menutup sesi tanpa PR?`;
              if (!(await showConfirm(confirmPrMsg, { title: '💡 Pengingat SOP PR', okText: 'Tetap Tanpa PR', danger: false }))) {
                return;
              }
            }
          } else if (lastPrRes.status === 'ok' && !lastPrRes.data) {
            const confirmPrMsg = `💡 Pengingat SOP: Halaqah ini belum pernah diberikan tugas PR.\n`
              + `Untuk menjaga keaktifan latihan murid di luar kelas, disarankan memberikan Latihan Mandiri.\n\n`
              + `Apakah Anda yakin tetap ingin menutup sesi tanpa PR?`;
            if (!(await showConfirm(confirmPrMsg, { title: '💡 Pengingat SOP PR', okText: 'Tetap Tanpa PR', danger: false }))) {
              return;
            }
          }
        } catch (err) {
          console.error("Gagal memeriksa kepatuhan SOP PR:", err);
        }
      }
    }

    closeModal('previewModal');

    setBtn('btnSelesai', true, '⏳ Menyimpan...');
    showLoad('Alhamdulillah, kita simpan sesi KBM kali ini semoga Allah terima...');
    try {
      await window.HQ.GuruAPI.simpanJurnalKBM({
        id_kbm           : sesiAktif.id_kbm,
        materi_belajar   : materi,
        pencapaian_modul : materi,
        halaman_modul    : halaman,
        metode,
        catatan_umum     : catatan,
        jam_selesai      : jamSelesai,
        latihan_mandiri  : latihanMandiri,
        jenis_latihan    : jenisLatihan,
        deadline_latihan : deadlineLatihan,
        referensi_url    : referensiUrl,
      });

      const nilaiList = [];
      if (isQiyamSesi) {
        for (const m of muridSesi) {
          const status = presensiMapPv[m.id_murid] || 'H';
          if (!['H','T'].includes(status)) continue;

          const cache = window._hafalanKbmCache[m.id_murid] || {};
          if (cache.jenis && !cache._saved) {
            await window.HQ.GuruAPI.addSetoranHafalan({
              id_murid           : m.id_murid,
              nama_murid         : m.nama_murid,
              id_halaqah         : sesiAktif.id_halaqah,
              id_kbm             : sesiAktif.id_kbm,
              tanggal            : sesiAktif.tanggal_pertemuan,
              juz                : cache.juz,
              surat              : cache.surat,
              ayat_dari          : cache.dari,
              ayat_sampai        : cache.sampai,
              jenis              : cache.jenis,
              nilai              : cache.nil,
              kelancaran         : cache.kel,
              kamera             : cache.kam,
              catatan            : cache.catatan,
              target_surat       : cache.tgtSrt || null,
              target_ayat_dari   : cache.tgtDari || null,
              target_ayat_sampai : cache.tgtSmp || null,
            });
            cache._saved = true;
          }
        }
      } else {
        for (const m of muridSesi) {
          if (isMicroteachingSesi) {
            const cache = window._microteachingKbmCache[m.id_murid] || {};
            const status = presensiMapPv[m.id_murid] || 'H';
            
            if (cache.isToggled) {
              if (!['A','I'].includes(status)) {
                let total = 0; let filled = 0;
                KRITERIA_MT.forEach(function(k) {
                  var val = cache[k.id];
                  if (val) { total += parseInt(val) * k.bobot; filled++; }
                });
                var score = filled === KRITERIA_MT.length ? Math.round(total * 25) : null;
                var rubrikChoices = {
                  penguasaan : cache.penguasaan,
                  penyampaian: cache.penyampaian,
                  tajwid     : cache.tajwid,
                  interaksi  : cache.interaksi,
                  waktu      : cache.waktu,
                };
                nilaiList.push({
                  id_murid      : m.id_murid,
                  nama_murid    : m.nama_murid,
                  nilai         : score,
                  adab          : '',
                  kamera_murid  : '',
                  koreksi_tahsin: JSON.stringify(rubrikChoices),
                  catatan_murid : cache.catatan || '',
                });
              } else {
                nilaiList.push({
                  id_murid      : m.id_murid,
                  nama_murid    : m.nama_murid,
                  nilai         : 0,
                  adab          : '',
                  kamera_murid  : '',
                  koreksi_tahsin: JSON.stringify({ absent: true }),
                  catatan_murid : 'Murid Alpa saat jadwal Praktik Mengajar',
                });
              }
            } else {
              nilaiList.push({
                id_murid      : m.id_murid,
                nama_murid    : m.nama_murid,
                nilai         : null,
                adab          : '',
                kamera_murid  : '',
                koreksi_tahsin: '',
                catatan_murid : '',
              });
            }
          } else {
            const nilai   = (document.getElementById('nilai-'+m.id_murid) ? document.getElementById('nilai-'+m.id_murid).value : '') || '';
            const adab    = (document.getElementById('adab-'+m.id_murid) ? document.getElementById('adab-'+m.id_murid).value : '') || '';
            const kamera  = (document.getElementById('kamera-'+m.id_murid) ? document.getElementById('kamera-'+m.id_murid).value : '') || '';
            const koreksi = (document.getElementById('koreksi-'+m.id_murid) ? document.getElementById('koreksi-'+m.id_murid).value : '') || '';
            if (nilai || adab || kamera || koreksi) {
              const catatan = document.getElementById('catatan-'+m.id_murid);
              nilaiList.push({
                id_murid     : m.id_murid,
                nama_murid   : m.nama_murid,
                nilai        : nilai,
                adab         : adab,
                kamera_murid : kamera,
                koreksi_tahsin: koreksi,
                catatan_murid: catatan ? catatan.value.trim() : '',
              });
            }
          }
        }
      }
      if (nilaiList.length > 0) {
        await window.HQ.GuruAPI.simpanNilaiMuridBatch({
          id_kbm    : sesiAktif.id_kbm,
          id_halaqah: sesiAktif.id_halaqah,
          nilai_list: nilaiList,
        });
      }

      // Simpan nilai indikator Daurah ke database jika ada
      if (window._daurahAssessmentMap) {
        var promises = [];
        var presentMuridIds = muridSesi.filter(function(m) {
          var status = presensiMapPv[m.id_murid] || 'H';
          return status === 'H' || status === 'T';
        }).map(function(m) { return m.id_murid; });

        Object.keys(window._daurahAssessmentMap).forEach(function(mId) {
          if (!presentMuridIds.includes(mId)) return;
          var items = window._daurahAssessmentMap[mId];
          Object.keys(items).forEach(function(iId) {
            var val = items[iId];
            promises.push(window.HQ.GuruAPI.simpanVerifikasiGuru({
              id_murid: mId,
              id_item: iId,
              status_guru: val
            }));
          });
        });
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }

      const idHalaqahSelesai = sesiAktif.id_halaqah;
      const idKbmSelesai = sesiAktif.id_kbm;
      await window.HQ.GuruAPI.tutupKBM(sesiAktif.id_kbm);
      _clearKbmDraftLocal(idKbmSelesai);
      window._daurahAssessmentMap = {};
      window._daurahAssessmentItems = [];

      hideLoad();
      setBtn('btnSelesai', false, '✅ Selesaikan & Tutup Sesi');

      const el = document.getElementById('notifOverlay');
      if (el) {
        document.getElementById('notifIcon').textContent  = '🌟';
        document.getElementById('notifTitle').textContent = 'Jazaakumullahu Khairan';
        document.getElementById('notifMsg').textContent   =
          'Jazaakumullahu Khairan atas jerih payah yang dikeluarkan, semoga Allah terima sebagai amal kebaikan kita.';
        const btn = document.getElementById('notifBtn');
        btn.className   = 'notif-btn ok';
        btn.textContent = 'Aamiin 🤲';
        btn.onclick     = closeNotif;
        el.classList.add('show');
        setTimeout(closeNotif, 7000);
      }

      setSesiAktif(null);
      setMuridSesi([]);
      setMuridCache({});
      window.doaSudahMuncul   = false;
      window._nilaiCache = {};
      window._microteachingKbmCache = {};
      window._hafalanKbmCache = {};

      const dw = document.getElementById('draftWarning');
      if (dw) dw.classList.remove('show');

      setTimeout(async () => {
        if (typeof loadDashboard === 'function') await loadDashboard(true);
        goPage('riwayat');
        const riwayatSel = document.getElementById('riwayatHalaqahSel');
        if (riwayatSel && idHalaqahSelesai) {
          riwayatSel.value = idHalaqahSelesai;
          loadRiwayat();
        }
      }, 1000);

    } catch(e) { toast(friendlyError(e),'err'); hideLoad(); setBtn('btnSelesai', false, '✅ Selesaikan & Tutup Sesi'); }
  }

  async function konfirmasiTutup() {
    const sesiAktif = getSesiAktif();
    if (!(await showConfirm('Tutup sesi tanpa mengisi jurnal nilai?\nData presensi yang sudah diisi akan tetap tersimpan.', { title: 'Tutup Sesi?', okText: 'Ya, Tutup' }))) return;
    showLoad('Alhamdulillah, kita simpan sesi KBM kali ini semoga Allah terima...');
    try {
      const idKbmTutup = sesiAktif.id_kbm;
      const res = await window.HQ.GuruAPI.tutupKBM(sesiAktif.id_kbm);
      toast(res.message || 'Sesi ditutup','ok');
      _clearKbmDraftLocal(idKbmTutup);
      setSesiAktif(null);
      setMuridSesi([]);
      window._nilaiCache = {};
      window._microteachingKbmCache = {};
      if (typeof resetPersiapan === 'function') resetPersiapan();
      updateSesiBanner();
      if (typeof loadDashboard === 'function') loadDashboard();
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  }

  // ── STEP INDICATOR ──────────────────────
  function getStepsDef() {
    const sesiAktif = getSesiAktif();
    const jenis = sesiAktif ? sesiAktif.jenis_sesi : 'KBM Reguler';
    if (jenis === 'KBM Reguler') {
      return [
        {id:'kbm',         label:'Buka Sesi'},
        {id:'presensi',    label:'Presensi'},
        {id:'nilai-murid', label:'Nilai'},
        {id:'jurnal',      label:'Jurnal'},
      ];
    }
    if (jenis === 'KBM Qiyam') {
      return [
        {id:'kbm',           label:'Buka Sesi'},
        {id:'presensi',      label:'Presensi'},
        {id:'hafalan-kbm',   label:'Hafalan'},
        {id:'jurnal',        label:'Jurnal'},
      ];
    }
    if (jenis === 'Micro Teaching') {
      return [
        {id:'kbm',                label:'Buka Sesi'},
        {id:'presensi',           label:'Presensi'},
        {id:'microteaching-kbm',  label:'Assessment'},
        {id:'jurnal',             label:'Jurnal'},
      ];
    }
    return [
      {id:'kbm',      label:'Buka Sesi'},
      {id:'presensi', label:'Presensi'},
    ];
  }

  function renderSteps(current) {
    const steps = getStepsDef();
    const ci    = steps.findIndex(s => s.id === current);
    const bars  = ['stepBarPresensi','stepBarNilai','stepBarJurnal','stepBarHafalanKbm','stepBarMicroteachingKbm'];
    bars.forEach(barId => {
      const bar = document.getElementById(barId);
      if (!bar) return;
      bar.innerHTML = steps.map((s,i) => {
        const state = i < ci ? 'done' : i === ci ? 'active' : 'pending';
        const line  = i < steps.length-1
          ? '<div class="step-line ' + (i < ci ? 'done' : '') + '"></div>' : '';
        return '<div class="step">'
          + '<div class="step-num ' + state + '">' + (i < ci ? '✓' : i+1) + '</div>'
          + '<div class="step-label ' + state + '">' + s.label + '</div>'
          + '</div>' + line;
      }).join('');
    });
  }

  // ── DAFTAR MURID ──────────────────────
  function getPoinAdabBadge(poin) {
    const p = Number(poin) || 0;
    const colorClass = p > 0 ? 'b-green' : 'b-gray';
    const prefix = p > 0 ? '+' : '';
    return `<span class="badge ${colorClass}">${prefix}${p}</span>`;
  }

  function getPoinKameraBadge(poin) {
    const p = Number(poin) || 0;
    const colorClass = p > 0 ? 'b-purple' : p < 0 ? 'b-red' : 'b-gray';
    const prefix = p > 0 ? '+' : '';
    return `<span class="badge ${colorClass}">${prefix}${p}</span>`;
  }

  async function getMurid(id_halaqah) {
    const muridCache = getMuridCache();
    if (muridCache[id_halaqah]) return muridCache[id_halaqah];
    try {
      const r = await window.HQ.GuruAPI.getMurid(id_halaqah);
      muridCache[id_halaqah] = r.data || [];
      setMuridCache(muridCache);
      return muridCache[id_halaqah];
    } catch(e) {
      console.error('getMurid error:', e.message);
      return [];
    }
  }

  async function loadMurid() {
    const selEl = document.getElementById('muridHalaqahSel');
    const id = selEl ? selEl.value : '';
    const halaqahList = getHalaqahList();
    if (!id && !halaqahList.length) return;
    const tbody = document.getElementById('muridTbl');
    if (tbody) tbody.innerHTML = Array(4).fill('<tr>'+Array(9).fill('<td><div class="skel skel-text" style="height:12px;border-radius:6px"></div></td>').join('')+'</tr>').join('');
    showLoad('Bismillah, memuat data murid...');
    try {
      var murid = [];
      if (!id) {
        const semua = await Promise.all(
          halaqahList.map(function(h){ return getMurid(h.id_halaqah); })
        );
        var seen = {};
        semua.forEach(function(arr){
          (arr||[]).forEach(function(m){
            if (!seen[m.id_murid]) { seen[m.id_murid]=true; murid.push(m); }
          });
        });
      } else {
        murid = await getMurid(id);
      }
      window._muridAllRows = murid;
      var els = ['muridSearchInput','muridKehadiranFilter','muridSkorFilter','muridLevelFilter'];
      els.forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
      var so = document.getElementById('muridSortSel'); if(so) so.value='level_asc';
      renderMuridTable();
    } catch(e) { toast('Gagal: '+e.message,'err'); }
    finally { hideLoad(); }
  }

  function muridHeaderSort(valA, valB) {
    var sel = document.getElementById('muridSortSel');
    if (!sel) return;
    sel.value = (sel.value === valA) ? valB : valA;
    renderMuridTable();
  }

  function updateMuridSortIndicators() {
    var sel = document.getElementById('muridSortSel');
    var cur = sel ? sel.value : '';
    document.querySelectorAll('[data-murid-sort-a]').forEach(function(th) {
      var a = th.getAttribute('data-murid-sort-a'), b = th.getAttribute('data-murid-sort-b');
      var ind = th.querySelector('.sort-ind');
      if (!ind) return;
      if (cur === a)      { ind.textContent = ' ▲'; ind.style.opacity = '1'; }
      else if (cur === b) { ind.textContent = ' ▼'; ind.style.opacity = '1'; }
      else                { ind.textContent = ' ⇅'; ind.style.opacity = '.3'; }
    });
  }

  function renderMuridTable() {
    var rows  = window._muridAllRows || [];
    var q     = (document.getElementById('muridSearchInput')     ? document.getElementById('muridSearchInput').value     : '').toLowerCase().trim();
    var kFil  = document.getElementById('muridKehadiranFilter')  ? document.getElementById('muridKehadiranFilter').value  : '';
    var sFil  = document.getElementById('muridSkorFilter')       ? document.getElementById('muridSkorFilter').value       : '';
    var lFil  = document.getElementById('muridLevelFilter')      ? document.getElementById('muridLevelFilter').value      : '';
    var sort  = document.getElementById('muridSortSel')          ? document.getElementById('muridSortSel').value          : 'level_asc';
    var tbody = document.getElementById('muridTbl');
    if (!tbody) return;
    updateMuridSortIndicators();

    var LEVEL_ORDER = {'Level 1':1,'Level 2':2,'Level 3':3,'Level Qiyam':4,'Micro Teaching':5,'Tahsin Al-Fatihah':6};
    function levelRank(l){ return LEVEL_ORDER[l] || 99; }

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="guru-empty">'
        + '<div class="guru-empty-ico">👥</div>'
        + '<div class="guru-empty-ttl">Belum ada murid di halaqah ini</div>'
        + '<div class="guru-empty-sub">Murid baru dapat ditambahkan oleh Admin melalui portal admin.</div>'
        + '</div></td></tr>';
      var b = document.getElementById('muridCountBadge'); if(b) b.textContent='';
      return;
    }

    var filtered = rows.filter(function(m) {
      if (q) {
        var hay = [(m.nama_murid||''), (m.id_murid||''), (m.level||'')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (lFil && (m.level||'') !== lFil) return false;
      var pct = m.pct_hadir || 0;
      if (kFil === 'rendah' && pct >= 50)           return false;
      if (kFil === 'cukup'  && (pct<50||pct>=75))   return false;
      if (kFil === 'baik'   && pct < 75)            return false;
      var s40 = m.skor_dari_40 || 0;
      if (sFil === 'rendah' && s40 >= 50)           return false;
      if (sFil === 'cukup'  && (s40<50||s40>=75))   return false;
      if (sFil === 'baik'   && s40 < 75)            return false;
      return true;
    });

    filtered.sort(function(a,b){
      if (sort==='level_asc') {
        var ld = levelRank(a.level) - levelRank(b.level);
        return ld !== 0 ? ld : (a.nama_murid||'').localeCompare(b.nama_murid||'');
      }
      if (sort==='nama_asc')   return (a.nama_murid||'').localeCompare(b.nama_murid||'');
      if (sort==='nama_desc')  return (b.nama_murid||'').localeCompare(a.nama_murid||'');
      if (sort==='hadir_desc') return (b.pct_hadir||0)-(a.pct_hadir||0);
      if (sort==='hadir_asc')  return (a.pct_hadir||0)-(b.pct_hadir||0);
      if (sort==='skor_desc')  return (b.skor_dari_40||0)-(a.skor_dari_40||0);
      if (sort==='skor_asc')   return (a.skor_dari_40||0)-(b.skor_dari_40||0);
      return 0;
    });

    var badge = document.getElementById('muridCountBadge');
    if (badge) badge.textContent = filtered.length + ' dari ' + rows.length + ' murid';

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada murid yang sesuai filter</td></tr>';
      return;
    }

    var selHalaqahId = document.getElementById('muridHalaqahSel')?.value;
    var jadwalData = window.jadwalData || [];
    var h = (jadwalData || []).find(function(x){ return x.id_halaqah === selHalaqahId; });
    var targetSesi = (h && h.target_sesi) || 40;

    var th = document.getElementById('muridSkorTableHeader');
    if (th) {
      var sortInd = th.querySelector('.sort-ind')?.outerHTML || '';
      th.innerHTML = 'Skor/' + targetSesi + sortInd;
    }

    tbody.innerHTML = filtered.map(function(m) {
      var pct  = m.pct_hadir || 0;
      var s40  = m.skor_dari_40 || 0;
      var pctC = pct>=75?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
      var s40C = s40>=75?'var(--green)':s40>=50?'var(--amber)':'var(--red)';
      var rowStyle = (pct<50 && (m.total_sesi||0)>2) ? ' style="background:rgba(239,68,68,.04)"' : '';
      return '<tr'+rowStyle+'>'
        + '<td><strong>'+esc(m.nama_murid)+'</strong>'
        + (m.id_murid ? '<div style="font-size:10.5px;color:var(--text-3)">'+esc(m.id_murid)+'</div>' : '')
        + '</td>'
        + '<td><span class="badge b-blue">'+esc(m.level||'-')+'</span></td>'
        + '<td><span class="badge b-green">'+(m.total_hadir||0)+'\u00d7</span></td>'
        + '<td>'+(m.total_sesi||0)+'</td>'
        + '<td><span style="font-weight:700;color:'+pctC+'">'+pct+'%</span>'
        + '<div style="height:4px;background:#e2e8f0;border-radius:4px;margin-top:3px;width:80px">'
        + '<div style="height:4px;background:'+pctC+';border-radius:4px;width:'+Math.min(pct,100)+'%"></div></div></td>'
        + '<td><span style="font-weight:700;color:'+s40C+'">'+s40+'%</span>'
        + '<div style="font-size:10.5px;color:var(--text-3)">'+(m.skor_hadir_raw?Number(m.skor_hadir_raw).toFixed(1):'\u2013')+'/' + targetSesi + '</div></td>'
        + '<td>'+getPoinAdabBadge(m.poin_adab)+'</td>'
        + '<td>'+getPoinKameraBadge(m.poin_kamera)+'</td>'
        + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'
          + '<button class="btn btn-outline btn-sm" data-id="'+esc(m.id_anggota)+'" data-nama="'+esc(m.nama_murid)+'" data-cat="'+esc(m.catatan_guru||'')+'" onclick="var b=this;bukaCatatan(b.getAttribute(\'data-id\'),b.getAttribute(\'data-nama\'),b.getAttribute(\'data-cat\'))">📝 Catatan</button>'
          + '<button class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a" data-nama="'+esc(m.nama_murid)+'" data-hp="'+esc(m.no_hp||'')+'" data-level="'+esc(m.level||'')+'" onclick="var b=this;openWAMurid(b.getAttribute(\'data-nama\'),b.getAttribute(\'data-hp\'),b.getAttribute(\'data-level\'))" title="'+(m.no_hp ? 'Hubungi via WhatsApp' : 'No HP tidak tersedia')+'">💬 WA</button>'
          + '</div></td>'
        + '</tr>';
    }).join('');
  }

  function doExportMuridCSV() {
    var rows = window._muridAllRows || [];
    if (!rows.length) { toast('Tidak ada data murid untuk diekspor.','err'); return; }
    var sel  = document.getElementById('muridHalaqahSel');
    var nama = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].text : 'semua';
    
    var selHalaqahId = document.getElementById('muridHalaqahSel')?.value;
    var jadwalData = window.jadwalData || [];
    var h = (jadwalData || []).find(function(x){ return x.id_halaqah === selHalaqahId; });
    var targetSesi = (h && h.target_sesi) || 40;

    var header = ['NIS/ID Murid','Nama Murid','Level','Total Hadir','Total Sesi','% Kehadiran','Skor/' + targetSesi + ' (%)','Raw Skor','Poin Adab','Poin Kamera'].join(';');
    var body = rows.map(function(m){
      return [m.id_murid||'',m.nama_murid||'',m.level||'',
        m.total_hadir||0,m.total_sesi||0,(m.pct_hadir||0)+'%',(m.skor_dari_40||0)+'%',
        m.skor_hadir_raw?Number(m.skor_hadir_raw).toFixed(1):'',
        m.poin_adab||0,m.poin_kamera||0
      ].map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob(['\uFEFF'+header+'\r\n'+body],{type:'text/csv;charset=utf-8;'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'daftar-murid-'+nama.replace(/\s+/g,'-')+'-'+_localDateStr()+'.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV diunduh \u2014 '+rows.length+' murid','ok');
  }

  // ── RIWAYAT KBM ──────────────────────
  async function loadRiwayat() {
    const selEl = document.getElementById('riwayatHalaqahSel');
    const id = selEl ? selEl.value : '';
    if (!id) return;
    const tbody = document.getElementById('riwayatTbl');
    if (tbody) tbody.innerHTML = Array(5).fill(`<tr>${Array(7).fill('<td><div class="skel skel-row" style="height:12px;border-radius:6px"></div></td>').join('')}</tr>`).join('');
    showLoad('Bismillah, memuat riwayat KBM...');
    try {
      const r = await window.HQ.GuruAPI.getRiwayatKBM(id, 100);
      window._riwayatData = r.data || [];
      filterRiwayatTable();
    } catch(e) { toast('Gagal: '+e.message,'err'); }
    finally { hideLoad(); }
  }

  function riwayatHeaderSort(valA, valB) {
    var sel = document.getElementById('riwayatSort');
    if (!sel) return;
    sel.value = (sel.value === valA) ? valB : valA;
    filterRiwayatTable();
  }

  function updateRiwayatSortIndicators() {
    var sel = document.getElementById('riwayatSort');
    var cur = sel ? sel.value : '';
    document.querySelectorAll('[data-riwayat-sort-a]').forEach(function(th) {
      var a = th.getAttribute('data-riwayat-sort-a'), b = th.getAttribute('data-riwayat-sort-b');
      var ind = th.querySelector('.sort-ind');
      if (!ind) return;
      if (cur === a)      { ind.textContent = ' ▲'; ind.style.opacity = '1'; }
      else if (cur === b) { ind.textContent = ' ▼'; ind.style.opacity = '1'; }
      else                { ind.textContent = ' ⇅'; ind.style.opacity = '.3'; }
    });
  }

  function filterRiwayatTable() {
    const search = (document.getElementById('riwayatSearchInput')?.value || '').trim().toLowerCase();
    const jenis = document.getElementById('riwayatJenisSel')?.value || '';
    const statusVal = document.getElementById('riwayatStatusSel')?.value || '';
    const sortBy = document.getElementById('riwayatSort')?.value || 'tanggal_desc';
    updateRiwayatSortIndicators();

    var _riwayatData = window._riwayatData || [];
    window._riwayatDataFiltered = _riwayatData.filter(k => {
      if (search) {
        const materi = (k.pencapaian_modul || '').toLowerCase();
        const pertemuan = String(k.pertemuan_ke || '');
        if (!materi.includes(search) && !pertemuan.includes(search)) {
          return false;
        }
      }
      if (jenis) {
        const kJenis = k.jenis_sesi || 'KBM Reguler';
        if (kJenis !== jenis) return false;
      }
      if (statusVal) {
        if (k.status !== statusVal) return false;
      }
      return true;
    });

    window._riwayatDataFiltered.sort((a, b) => {
      if (sortBy === 'tanggal_desc') {
        return new Date(b.tanggal_pertemuan || 0) - new Date(a.tanggal_pertemuan || 0);
      } else if (sortBy === 'tanggal_asc') {
        return new Date(a.tanggal_pertemuan || 0) - new Date(b.tanggal_pertemuan || 0);
      } else if (sortBy === 'pertemuan_desc') {
        return (b.pertemuan_ke || 0) - (a.pertemuan_ke || 0);
      } else if (sortBy === 'pertemuan_asc') {
        return (a.pertemuan_ke || 0) - (b.pertemuan_ke || 0);
      } else if (sortBy === 'status_asc') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    const tbody = document.getElementById('riwayatTbl');
    if (!tbody) return;

    if (!window._riwayatDataFiltered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="guru-empty"><div class="guru-empty-ico">📋</div><div class="guru-empty-ttl">Tidak ada riwayat KBM yang sesuai</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = window._riwayatDataFiltered.map(k => {
      if (k.status === 'libur') {
        return `<tr>
          <td>${fmtDate(k.tanggal_pertemuan)}</td>
          <td><span class="badge b-gray">—</span></td>
          <td>${typeof jenisKbmBadge === 'function' ? jenisKbmBadge(k.jenis_sesi) : k.jenis_sesi}</td>
          <td colspan="2" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(k.keterangan_libur||'-')}">📵 ${esc(k.keterangan_libur||'-')}</td>
          <td>${typeof statusBadge === 'function' ? statusBadge(k.status) : k.status}</td>
          <td>—</td>
        </tr>`;
      }
      const penggantiBadge = k.is_pengganti ? ' <span class="badge" style="background:#fff7ed;color:#c2410c">🔄 Pengganti</span>' : '';
      return `<tr>
      <td>${fmtDate(k.tanggal_pertemuan)}<br><small style="color:var(--text-3)">${esc(k.jam_mulai||'')}${k.jam_selesai?'–'+esc(k.jam_selesai):''}</small></td>
      <td><span class="badge b-blue">ke-${k.pertemuan_ke}</span></td>
      <td>${typeof jenisKbmBadge === 'function' ? jenisKbmBadge(k.jenis_sesi) : k.jenis_sesi}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(k.pencapaian_modul||'-')}">${esc(k.pencapaian_modul||'-')}</td>
      <td><strong style="color:var(--green)">${k.jumlah_hadir??0}</strong>/${(k.jumlah_hadir??0)+(k.jumlah_alpa??0)}</td>
      <td>${typeof statusBadge === 'function' ? statusBadge(k.status) : k.status}${penggantiBadge}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="lihatDetail('${esc(k.id_kbm)}','${esc(k.tanggal_pertemuan)}')">🔍 Detail</button>
        <button class="btn btn-outline btn-sm" style="color:var(--amber);border-color:var(--amber)"
          onclick="bukaEditPresensi('${esc(k.id_kbm)}','${esc(k.tanggal_pertemuan)}')">✏️ Edit KBM</button>
        ${k.status === 'draft' ? `<button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)"
          onclick="hapusDraftKBM('${esc(k.id_kbm)}','${esc(k.pertemuan_ke)}','${esc(k.jenis_sesi||'KBM')}')">🗑 Hapus Draft</button>` : ''}
      </td>
    </tr>`;
    }).join('');
  }

  async function _checkDraftViaRiwayat(halaqahList) {
    if (!halaqahList || !halaqahList.length) return;
    try {
      var results = await Promise.all(
        halaqahList.map(function(h) {
          return window.HQ.GuruAPI.getRiwayatKBM(h.id_halaqah, 100, 0)
            .then(function(r) {
              return { nama: h.nama_halaqah, rows: r.data || [] };
            })
            .catch(function() { return { nama: h.nama_halaqah, rows: [] }; });
        })
      );
      var totalDraft = 0;
      var draftPerHalaqah = [];
      results.forEach(function(res) {
        var drafts = res.rows.filter(function(k) {
          return String(k.status).toLowerCase() === 'draft';
        });
        if (drafts.length) {
          totalDraft += drafts.length;
          draftPerHalaqah.push({
            nama  : res.nama,
            count : drafts.length,
            detail: drafts.map(function(k) {
              return { pertemuan_ke: k.pertemuan_ke, jenis: k.jenis_sesi || 'KBM', tanggal: k.tanggal_pertemuan };
            }),
          });
        }
      });
      _updateDraftOrphanAlert(totalDraft, draftPerHalaqah);
    } catch(e) {}
  }

  function _updateDraftOrphanAlert(totalDraft, draftPerHalaqah) {
    var alertEl = document.getElementById('draftOrphanAlert');
    var badge   = document.getElementById('navDraftBadge');
    var title   = document.getElementById('draftOrphanTitle');
    var detail  = document.getElementById('draftOrphanDetail');
    if (!alertEl) return;

    if (totalDraft > 0) {
      var label = totalDraft === 1
        ? 'Ada 1 sesi KBM belum diselesaikan'
        : 'Ada ' + totalDraft + ' sesi KBM belum diselesaikan';
      if (title) title.textContent = label;

      if (detail && draftPerHalaqah && draftPerHalaqah.length) {
        detail.innerHTML = draftPerHalaqah.map(function(h) {
          var items = h.detail.map(function(d) {
            return '<span style="background:rgba(217,119,6,.15);border-radius:6px;padding:2px 8px;font-size:10.5px;font-weight:700;color:#92400e;white-space:nowrap">'
              + esc(d.jenis) + ' ke-' + esc(String(d.pertemuan_ke)) + ' · ' + fmtDate(d.tanggal)
              + '</span>';
          }).join(' ');
          return '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px">'
            + '<div style="font-size:12px;font-weight:800;color:#92400e;white-space:nowrap;min-width:80px">📚 ' + esc(h.nama) + '</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:4px">' + items + '</div>'
            + '</div>';
        }).join('');
        detail.style.display = 'block';
      }

      alertEl.classList.add('show');
      if (badge) { badge.textContent = totalDraft; badge.classList.add('show'); }
    } else {
      alertEl.classList.remove('show');
      if (badge) badge.classList.remove('show');
    }
  }

  async function hapusDraftKBM(id_kbm, pertemuan_ke, jenis) {
    if (!(await showConfirm('Hapus sesi draft ' + jenis + ' ke-' + pertemuan_ke + '?\n\nSesi ini belum selesai dan tidak ada data presensi/nilai yang tersimpan.', { title: 'Hapus Draft?', okText: 'Ya, Hapus', danger: true }))) return;
    showLoad('Menghapus sesi draft...');
    try {
      await window.HQ.GuruAPI.hapusKBM(id_kbm);
      toast('Sesi draft berhasil dihapus ✅', 'ok');
      if (window._guruTabLoaded) delete window._guruTabLoaded['riwayat'];
      loadRiwayat();
      if (typeof loadDashboard === 'function') loadDashboard(true);
    } catch(e) { toast('Gagal: ' + e.message, 'err'); }
    finally { hideLoad(); }
  }

  async function lihatDetail(id_kbm, tgl) {
    document.getElementById('detailTitle').textContent = 'Detail — ' + fmtDate(tgl);
    document.getElementById('detailBody').innerHTML = emptyHTML('⏳','Memuat...','');
    openModal('detailModal');
    try {
      const r = await window.HQ.GuruAPI.getNilaiByKBM(id_kbm);
      const data = r.data || [];
      if (!data.length) {
        document.getElementById('detailBody').innerHTML = emptyHTML('📭','Belum ada data nilai','');
        return;
      }
      document.getElementById('detailBody').innerHTML = data.map(n => {
        let contentHtml = '';
        if (n.hafalan) {
          const h = n.hafalan;
          const jenisIcon = { Ziyadah: '📖', Murajaah: '🔄', Tahsin: '✨' };
          contentHtml = `
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">
              Juz ${h.juz || '-'} · ${esc(h.surat)} · Ayat ${h.ayat_dari}–${h.ayat_sampai}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <span class="badge b-gray">${jenisIcon[h.jenis] || '📖'} ${esc(h.jenis || 'Ziyadah')}</span>
              <span class="badge ${h.nilai === 'A' ? 'b-blue' : h.nilai === 'B' ? 'b-green' : 'b-amber'}" style="font-weight:bold">Nilai: ${esc(h.nilai)}</span>
              ${h.kelancaran ? `<span class="badge b-purple">Kelancaran: ${esc(h.kelancaran)}</span>` : ''}
              ${h.kamera ? `<span class="badge b-purple">Kamera: ${esc(h.kamera)}</span>` : n.kamera_murid ? `<span class="badge b-purple">Kamera: ${esc(n.kamera_murid)}</span>` : ''}
            </div>
            ${h.target_surat ? `
              <div style="font-size:12px;color:#059669;font-weight:600;margin-bottom:4px">
                🎯 Target: ${esc(h.target_surat)} · Ayat ${h.target_ayat_dari || 1}–${h.target_ayat_sampai || 1}
              </div>` : ''}
            ${h.catatan ? `
              <div style="margin-top:6px;background:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:6px 10px;font-size:12px;color:#78350f;font-style:italic">
                📝 Catatan: ${esc(h.catatan)}
              </div>` : ''}
          `;
        } else if (n.jenis_sesi === 'Micro Teaching') {
          let rubrikHtml = '';
          if (n.koreksi_tahsin) {
            try {
              const rubrik = JSON.parse(n.koreksi_tahsin);
              const keyMap = {
                penguasaan : 'Penguasaan Materi',
                penyampaian: 'Cara Penyampaian',
                tajwid     : 'Kualitas Tajwid',
                interaksi  : 'Interaksi Kelas',
                waktu      : 'Manajemen Waktu'
              };
              const optMap = {
                4: 'Sangat Baik (SB)',
                3: 'Baik (B)',
                2: 'Cukup (C)',
                1: 'Perlu Perbaikan (PP)'
              };
              const items = [];
              for (const k in keyMap) {
                if (rubrik[k]) {
                  const val = rubrik[k];
                  items.push(`<strong>${keyMap[k]}:</strong> ${optMap[val] || val}`);
                }
              }
              if (items.length > 0) {
                rubrikHtml = `<div style="font-size:12px;color:var(--text-2);margin-top:6px;line-height:1.4">
                  📋 <strong>Rubrik Penilaian:</strong><br>
                  ${items.join('<br>')}
                </div>`;
              } else {
                rubrikHtml = `<div style="font-size:12.5px;color:var(--text-2)">✏️ ${esc(n.koreksi_tahsin)}</div>`;
              }
            } catch(e) {
              rubrikHtml = `<div style="font-size:12.5px;color:var(--text-2)">✏️ ${esc(n.koreksi_tahsin)}</div>`;
            }
          }
          contentHtml = `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <span class="badge b-blue" style="font-size:11.5px;font-weight:bold">Nilai: ${esc(n.nilai)} / 100</span>
            </div>
            ${rubrikHtml}
            ${n.catatan_murid ? `
              <div style="margin-top:6px;background:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:6px 10px;font-size:12px;color:#78350f;font-style:italic">
                📝 Catatan: ${esc(n.catatan_murid)}
              </div>` : ''}
          `;
        } else {
          contentHtml = `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${n.nilai ? (typeof nilaiLabel === 'function' ? nilaiLabel(n.nilai) : n.nilai) : ''}
              ${n.adab ? `<span class="badge b-blue">Adab: ${esc(n.adab)}</span>` : ''}
              ${n.kamera_murid ? `<span class="badge b-purple">Kamera: ${esc(n.kamera_murid)}</span>` : ''}
            </div>
            ${n.koreksi_tahsin ? `<div style="font-size:12.5px;color:var(--text-2)">✏️ ${esc(n.koreksi_tahsin)}</div>` : ''}
            ${n.catatan_murid ? `
              <div style="margin-top:6px;background:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:6px 10px;font-size:12px;color:#78350f;font-style:italic">
                📝 Catatan: ${esc(n.catatan_murid)}
              </div>` : ''}
          `;
        }

        return `
          <div class="nilai-row">
            <div class="nilai-murid-name">
              <span>👤 ${esc(n.nama_murid||n.id_murid)}</span>
              ${typeof hadirBadge === 'function' ? hadirBadge(n.status_hadir) : n.status_hadir}
            </div>
            ${contentHtml}
          </div>
        `;
      }).join('');
    } catch(e) {
      document.getElementById('detailBody').innerHTML = emptyHTML('❌','Gagal memuat','');
    }
  }

  function bukaCatatan(id_anggota, nama, catatan) {
    document.getElementById('catatanNama').textContent    = nama;
    document.getElementById('catatanTxt').value           = catatan;
    document.getElementById('catatanIdAnggota').value     = id_anggota;
    openModal('catatanModal');
  }

  async function simpanCatatan() {
    const id_anggota  = document.getElementById('catatanIdAnggota').value;
    const catatan_guru = document.getElementById('catatanTxt').value;
    showLoad('Bismillah, menyimpan...');
    try {
      await window.HQ.GuruAPI.updateCatatanMurid({ id_anggota, catatan_guru });
      closeModal('catatanModal');
      setMuridCache({});
      toast('Catatan tersimpan!','ok');
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  }

  // ── EXPOSE PUBLIC INTERFACE ──────────────────────
  window.validateFields = validateFields;
  window.doBukaKBM = doBukaKBM;
  window.updateSesiBanner = updateSesiBanner;
  window.lanjutSesi = lanjutSesi;
  window.renderPresensi = renderPresensi;
  window.togPresensi = togPresensi;
  window.setAllPresensi = setAllPresensi;
  window.updatePresensiCount = updatePresensiCount;
  window.doSimpanPresensi = doSimpanPresensi;
  window.goToNilai = goToNilai;
  window.onKbmHalaqahChange = onKbmHalaqahChange;
  window.selectKbmJenis = selectKbmJenis;
  window.goToHafalanQiyam = goToHafalanQiyam;
  window.goToMicroteachingAssessment = goToMicroteachingAssessment;
  window.renderHafalanKbm = renderHafalanKbm;
  window.updateHfKbmPoin = updateHfKbmPoin;
  window.hfKbmSuratInput = hfKbmSuratInput;
  window.hfKbmSelectSurat = hfKbmSelectSurat;
  window.hfKbmTargetSuratInput = hfKbmTargetSuratInput;
  window.hfKbmSelectTargetSurat = hfKbmSelectTargetSurat;
  window.renderMicroteachingKbm = renderMicroteachingKbm;
  window.toggleMicroteachingPracticing = toggleMicroteachingPracticing;
  window.updateMicroteachingScore = updateMicroteachingScore;
  window.simpanMicroteachingKBM = simpanMicroteachingKBM;
  window.goToPreviewNonReguler = goToPreviewNonReguler;
  window.goToJurnal = goToJurnal;
  window.simpanHafalanKBM = simpanHafalanKBM;
  window.lanjutKeJurnal = lanjutKeJurnal;
  window.kembaliKeStep1 = kembaliKeStep1;
  window.kembaliKeStep2 = kembaliKeStep2;
  window.kembaliKeStep3 = kembaliKeStep3;
  window.renderNilaiMuridStep = renderNilaiMuridStep;
  window.updateNilaiCard = updateNilaiCard;
  window.renderNilaiList = renderNilaiList;
  window.doSelesaiKBM = doSelesaiKBM;
  window.konfirmasiTutup = konfirmasiTutup;
  window.getStepsDef = getStepsDef;
  window.renderSteps = renderSteps;
  window.getPoinAdabBadge = getPoinAdabBadge;
  window.getPoinKameraBadge = getPoinKameraBadge;
  window.getMurid = getMurid;
  window.loadMurid = loadMurid;
  window.muridHeaderSort = muridHeaderSort;
  window.updateMuridSortIndicators = updateMuridSortIndicators;
  window.renderMuridTable = renderMuridTable;
  window.doExportMuridCSV = doExportMuridCSV;
  window.loadRiwayat = loadRiwayat;
  window.riwayatHeaderSort = riwayatHeaderSort;
  window.updateRiwayatSortIndicators = updateRiwayatSortIndicators;
  window.filterRiwayatTable = filterRiwayatTable;
  window._checkDraftViaRiwayat = _checkDraftViaRiwayat;
  window._updateDraftOrphanAlert = _updateDraftOrphanAlert;
  window.hapusDraftKBM = hapusDraftKBM;
  window.lihatDetail = lihatDetail;
  window.bukaCatatan = bukaCatatan;
  window.simpanCatatan = simpanCatatan;
  window._saveKbmDraftLocal = _saveKbmDraftLocal;
  window._loadKbmDraftLocal = _loadKbmDraftLocal;
  window._clearKbmDraftLocal = _clearKbmDraftLocal;
  window._hydrateKbmCacheFromDraft = _hydrateKbmCacheFromDraft;
  window._reconcileKbmDraftServer = _reconcileKbmDraftServer;
  window._saveHafalanKbmCache = _saveHafalanKbmCache;
  window._restoreHafalanKbmCache = _restoreHafalanKbmCache;
  window._saveMicroteachingKbmCache = _saveMicroteachingKbmCache;
  window._restoreMicroteachingKbmCache = _restoreMicroteachingKbmCache;

  window._daurahAssessmentItems = [];
  window._daurahAssessmentMap = {};

  function getDaurahDayTitle(meetingNo) {
    const titles = {
      1: "Hari 1 (Isti'adzah)",
      2: "Hari 2 (Basmalah)",
      3: "Hari 3 (Ayat 2)",
      4: "Hari 4 (Ayat 3-4)",
      5: "Hari 5 (Ayat 5)",
      6: "Hari 6 (Ayat 6)",
      7: "Hari 7 (Ayat 7)",
      8: "Hari 8 (Evaluasi Akhir)"
    };
    return titles[meetingNo] || ("Pertemuan Ke-" + meetingNo);
  }

  function getDaurahItemsForMeeting(meetingNo, allItems) {
    if (!allItems || allItems.length === 0) return [];
    var sorted = allItems.slice().sort(function(a, b) {
      return (a.urutan || 0) - (b.urutan || 0);
    });
    if (meetingNo >= 8) {
      return sorted;
    }
    var filterKey = 'Hari ' + meetingNo;
    return sorted.filter(function(item) {
      return item.kategori === filterKey;
    });
  }

  function setDaurahAsmtScore(idMurid, idItem, status, btn) {
    window._daurahAssessmentMap = window._daurahAssessmentMap || {};
    window._daurahAssessmentMap[idMurid] = window._daurahAssessmentMap[idMurid] || {};
    if (window._daurahAssessmentMap[idMurid][idItem] === status) {
      window._daurahAssessmentMap[idMurid][idItem] = null;
    } else {
      window._daurahAssessmentMap[idMurid][idItem] = status;
    }
    var parent = btn.parentNode;
    if (parent) {
      parent.querySelectorAll('.btn-asmt-opt').forEach(function(b) {
        b.classList.remove('active');
      });
      var curVal = window._daurahAssessmentMap[idMurid][idItem];
      if (curVal) {
        var activeBtn = parent.querySelector('.btn-' + curVal);
        if (activeBtn) activeBtn.classList.add('active');
      }
    }
    _saveKbmDraftLocal();
  }

  window.setDaurahAsmtScore = setDaurahAsmtScore;

})();
