// ══════════════════════════════════════════════════════════════
//  Rattil Portal Guru — Modul Dashboard (dashboard-module.js)
//  Ekstraksi Fase 2: Memecah monolitik guru/index.html
// ══════════════════════════════════════════════════════════════

(function() {
  // ── HELPER KARTU HALAQAH DASHBOARD ──
  function hqCard(h) {
    return `<div class="hq-card" onclick="goPage('kbm')">
      <div class="hq-name">${esc(h.nama_halaqah)}</div>
      <div class="hq-meta">
        <span>📅 ${esc(h.jadwal_hari||'-')}</span>
        <span>⏰ ${esc(h.jam_mulai||'-')}</span>
        <span>📍 ${esc(h.lokasi||'-')}</span>
      </div>
      <div class="hq-stats">
        <div class="hq-stat"><div class="v">${h.total_murid??0}</div><div class="l">Murid</div></div>
        <div class="hq-stat"><div class="v">${h.total_sesi??0}</div><div class="l">Sesi</div></div>
        <div class="hq-stat"><div class="v">${esc(h.level||'-')}</div><div class="l">Level</div></div>
      </div>
    </div>`;
  }

  // ── REFRESH DATA PER TAB ──
  function guruRefresh(tab) {
    var btnMap = {
      murid: 'btnRefreshMurid',
      riwayat: 'btnRefreshRiwayat',
      keaktifan: 'btnRefreshKeaktifan',
      assessment: 'btnRefreshAsmt',
      'peninjauan-pr': 'btnRefreshPR'
    };
    var btn = document.getElementById(btnMap[tab] || '');
    if (btn) {
      btn.classList.add('spinning');
      setTimeout(function() { btn.classList.remove('spinning'); }, 1200);
    }
    
    var tabLoaded = window.HQ.AppState._guruTabLoaded;
    if (tabLoaded) {
      delete tabLoaded[tab];
    }
    
    if (tab === 'murid') {
      if (typeof window.loadMurid === 'function') window.loadMurid();
    } else if (tab === 'riwayat') {
      if (typeof window.loadRiwayat === 'function') window.loadRiwayat();
    } else if (tab === 'peninjauan-pr') {
      if (typeof window.loadPRSubmissions === 'function') window.loadPRSubmissions();
    } else if (tab === 'keaktifan') {
      window.HQ.AppState._keaktifanData = null;
      if (typeof window.loadKeaktifanPage === 'function') window.loadKeaktifanPage();
    } else if (tab === 'assessment') {
      if (typeof window.loadAssessmentRekap === 'function') window.loadAssessmentRekap();
    } else if (tab === 'attibyan-guru') {
      if (typeof window._atTabLoaded !== 'undefined') window._atTabLoaded = {};
      if (typeof window._atSesiData !== 'undefined') window._atSesiData = [];
      if (typeof window._atKeaktifanData !== 'undefined') window._atKeaktifanData = null;
      if (typeof window._atMuridAll !== 'undefined') window._atMuridAll = [];
      if (typeof window.loadAtTibyanGuru === 'function') window.loadAtTibyanGuru();
    }
  }

  // ── MEMUAT DATA DASHBOARD UTAMA ──
  async function loadDashboard(silent = false) {
    if (!silent) showLoad('Bismillah, memuat dashboard...');
    
    // Load jadwal paralel
    if (typeof window.loadJadwal === 'function') window.loadJadwal();
    if (typeof window.loadTemplateKoreksi === 'function') window.loadTemplateKoreksi();
    
    try {
      const r = await window.HQ.GuruAPI.getDashboard();
      const d = r.data;
      
      const hList = d.halaqah || [];
      window.HQ.AppState.halaqahList = hList;
      
      // Tampilkan nav Tahfidz jika guru punya halaqah Level Qiyam
      if (typeof window._initNavHafalan === 'function') window._initNavHafalan();
      // Tampilkan nav Mutaba'ah jika guru punya halaqah Tahsin Al-Fatihah
      if (typeof window._initNavMutabaah === 'function') window._initNavMutabaah();
      
      // Isi semua dropdown setelah data loaded
      if (typeof window.fillLevelDropdowns === 'function') window.fillLevelDropdowns();
      
      // Isi dropdown halaqah di semua page
      var selMurid = document.getElementById('muridHalaqahSel');
      var selRiwayat = document.getElementById('riwayatHalaqahSel');
      var selKbm = document.getElementById('kbmHalaqah');
      var selPR = document.getElementById('prHalaqahSel');
      [selMurid, selRiwayat, selKbm, selPR].forEach(function(sel) {
        if (!sel) return;
        var val = sel.value;
        sel.innerHTML = '<option value="">— Pilih Halaqah —</option>';
        hList.forEach(function(h) {
          var o = document.createElement('option');
          o.value = h.id_halaqah;
          o.textContent = h.nama_halaqah;
          if (h.id_halaqah === val) o.selected = true;
          sel.appendChild(o);
        });
      });

      document.getElementById('st-halaqah').textContent = d.total_halaqah ?? '–';
      document.getElementById('st-murid').textContent   = d.total_murid   ?? '–';
      document.getElementById('st-kbm').textContent     = d.kbm_hari_ini  ?? '–';
      document.getElementById('st-bulan').textContent   = d.kbm_bulan_ini ?? '–';
      
      // Kartu Kelompok Partner — hanya untuk guru yang punya halaqah Level Qiyam
      var _kpHasQiyam = hList.some(function(h) { return h.level === 'Level Qiyam'; });
      var _kpCard = document.getElementById('statKelompokPartner');
      if (_kpCard) _kpCard.style.display = _kpHasQiyam ? '' : 'none';
      
      // Kartu Kelompok Belajar — hanya untuk guru yang punya halaqah level partner_belajar_enabled
      if (typeof window._kbInitDashCard === 'function') window._kbInitDashCard();
      
      // Hapus skeleton stats
      document.querySelectorAll('.skel-stat').forEach(function(el) { el.remove(); });

      // Load total kuis di background
      if (window.HQ.QuizAPI && typeof window.HQ.QuizAPI.getKuisList === 'function') {
        window.HQ.QuizAPI.getKuisList().then(function(qr) {
          if (qr.status !== 'ok') return;
          var list = qr.data || [];
          var elVal = document.getElementById('st-kuis');
          if (elVal) {
            elVal.textContent = list.length + ' Kuis';
          }
        }).catch(function(e) {
          console.error("Gagal memuat kuis guru:", e);
        });
      }

      // Cek sesi draft aktif (untuk banner lanjut/hapus)
      if (d.sesi_draft) {
        window.HQ.AppState.sesiAktif = d.sesi_draft;
        if (typeof window.updateSesiBanner === 'function') window.updateSesiBanner();
      }

      // Cek draft dari dashboard (jika database sudah update dengan total_draft)
      if (typeof d.total_draft !== 'undefined') {
        if (typeof window._updateDraftOrphanAlert === 'function') {
          window._updateDraftOrphanAlert(d.total_draft);
        }
      }

      // Fallback: pakai getRiwayatKBM
      // Cek semua halaqah milik guru ini secara paralel (limit besar untuk dapat semua draft)
      if (typeof window._checkDraftViaRiwayat === 'function') {
        window._checkDraftViaRiwayat(d.halaqah || []);
      }

      // jadwalList sudah di-render oleh loadJadwal()
      // Pastikan jadwalList render ulang jika data sudah ada
      var jData = window.jadwalData;
      if (jData && jData.length && typeof window.renderJadwal === 'function') {
        window.renderJadwal();
      }

      // Kartu "Kehadiran Saya" — background, non-blocking
      if (typeof window.loadKehadiranSaya === 'function') window.loadKehadiranSaya();

      // Load summary keaktifan di background
      window.HQ.GuruAPI.getKeaktifanAlerts().then(function(kr) {
        if (kr.status !== 'ok') return;
        window.HQ.AppState._keaktifanData = kr.data;
        var s = kr.data.summary;
        var butuhPerhatian = (s.kritis || 0) + (s.peringatan || 0);
        var elVal = document.getElementById('st-keaktifan-kritis');
        var elSub = document.getElementById('st-keaktifan-sub');
        if (elVal) {
          elVal.textContent = butuhPerhatian;
          elVal.style.color = butuhPerhatian > 0 ? 'var(--red)' : 'var(--green)';
        }
        if (elSub) {
          elSub.textContent = s.kritis > 0
            ? s.kritis + ' kritis · ' + s.peringatan + ' peringatan'
            : s.peringatan > 0 ? s.peringatan + ' peringatan'
            : 'Semua murid aktif';
        }
      }).catch(function() {});
      
      if (typeof window.checkHalaqahPRBadge === 'function') {
        window.checkHalaqahPRBadge().catch(function() {});
      }
    } catch (e) {
      toast('Gagal memuat dashboard: ' + e.message, 'err');
    } finally {
      if (!silent) hideLoad();
    }
  }

  // ── EXPOSE PUBLIC INTERFACE TO WINDOW ──
  window.hqCard = hqCard;
  window.guruRefresh = guruRefresh;
  window.loadDashboard = loadDashboard;
})();
