/**
 * Modul Hafalan & Setoran Guru (hafalan-module.js)
 * Portal Halaqah Rattililquran
 */
(function() {
  'use strict';

  // State local module
  var _hafalanGuruQiyamList  = [];
  var _hafalanGuruMuridCache = {};
  var _hafalanGuruOffset     = 0;
  var _hafalanGuruZiyadah    = [];
  var _hafalanGuruSubmitting = false;

  var _HF_PENILAIAN_KEY  = 'hq_hf_penilaian_v1';
  var _hfConfigCache     = null;
  var _targetSuratMaxAyat = null;
  var _hafalanSelectedAyatMax = null;
  var _hfSuratData       = null;

  function getHalaqahList() {
    return (window.HQ && window.HQ.AppState && window.HQ.AppState.halaqahList) || window.halaqahList || [];
  }

  function getSesiAktif() {
    return (window.HQ && window.HQ.AppState && window.HQ.AppState.sesiAktif) || window.sesiAktif || null;
  }

  function _hfDefaultConfig() {
    return {
      kelancaran: [
        { id: 'kel-1', nama: 'Lancar',          poin: 10, icon: '🟢', ket: 'Tanpa salah' },
        { id: 'kel-2', nama: 'Cukup',           poin:  5, icon: '🟡', ket: 'Benar setelah ditegur' },
        { id: 'kel-3', nama: 'Perlu Perbaikan', poin:  0, icon: '🔴', ket: 'Ditegur tetap lupa' }
      ],
      nilai: [
        { id: 'nil-1', kode: 'Mumtaz', desc: 'Istimewa', poin: 90, icon: '⭐' },
        { id: 'nil-2', kode: 'Baik',   desc: 'Baik',     poin: 70, icon: '✅' },
        { id: 'nil-3', kode: 'Cukup',  desc: 'Cukup',    poin: 50, icon: '📌' }
      ],
      kamera: [
        { id: 'kam-1', nama: 'kamera terbuka',          icon: '📷' },
        { id: 'kam-2', nama: 'kamera sering buka tutup', icon: '🟡' },
        { id: 'kam-3', nama: 'kamera tertutup',          icon: '❌' }
      ]
    };
  }

  function _hfLoadConfig() {
    if (_hfConfigCache) return _hfConfigCache;
    try {
      var raw = localStorage.getItem(_HF_PENILAIAN_KEY);
      if (raw) { _hfConfigCache = JSON.parse(raw); return _hfConfigCache; }
    } catch(e) {}
    _hfConfigCache = _hfDefaultConfig();
    return _hfConfigCache;
  }

  async function _hfFetchConfigFromDB() {
    try {
      var res = await window.HQ.GuruAPI.getPenilaianHafalan();
      if (res && res.data && res.data.kelancaran && res.data.nilai) {
        var cfg = res.data;
        if (!cfg.kamera || !cfg.kamera.length) {
          cfg.kamera = _hfDefaultConfig().kamera;
        }
        _hfConfigCache = cfg;
        localStorage.setItem(_HF_PENILAIAN_KEY, JSON.stringify(cfg));
      }
    } catch(e) {
      _hfLoadConfig();
    }
  }

  function _hfClearLocalCache() {
    localStorage.removeItem(_HF_PENILAIAN_KEY);
    _hfConfigCache = null;
  }

  async function _hfSaveConfig(cfg) {
    _hfConfigCache = cfg;
    localStorage.setItem(_HF_PENILAIAN_KEY, JSON.stringify(cfg));
    _hfRenderAllDropdowns();
    renderKelolaPenilaianHafalan();
    try {
      await window.HQ.GuruAPI.savePenilaianHafalan(cfg);
    } catch(e) {
      showToast('Config tersimpan lokal. Gagal sync ke server: ' + e.message, 'warning');
    }
  }

  function _hfRenderAllDropdowns() {
    var cfg = _hfLoadConfig();
    var kelOpts = (cfg.kelancaran||[]).map(function(k) {
      var poinLabel = k.poin > 0 ? '(+' + k.poin + ' Poin)' : '(' + k.poin + ' Poin)';
      var ketLabel  = k.ket ? ' — ' + k.ket : '';
      return '<option value="' + _escAttr(k.nama) + '" title="' + _escAttr(k.ket||'') + '">'
        + k.icon + ' ' + _escAttr(k.nama) + ' ' + poinLabel + ketLabel + '</option>';
    }).join('');
    var nilOpts = (cfg.nilai||[]).map(function(n) {
      return '<option value="' + _escAttr(n.kode) + '">'
        + n.icon + ' ' + _escAttr(n.kode) + ' — ' + _escAttr(n.desc) + ' (' + n.poin + ' Poin)</option>';
    }).join('');
    var kamOpts = [
      { nama: 'kamera terbuka',          icon: '📷' },
      { nama: 'kamera sering buka tutup', icon: '🟡' },
      { nama: 'kamera tertutup',          icon: '❌' }
    ].map(function(k) {
      return '<option value="' + _escAttr(k.nama) + '">' + k.icon + ' ' + _escAttr(k.nama) + '</option>';
    }).join('');
    ['hafalanKelancaranSel','hfPreviewKelancaran'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.innerHTML = kelOpts || '<option>—</option>';
    });
    ['hafalanNilaiSel','hfPreviewNilai'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.innerHTML = nilOpts || '<option>—</option>';
    });
    ['hafalanKameraSel','hfPreviewKamera'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.innerHTML = kamOpts || '<option>—</option>';
    });
  }

  function _escAttr(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  function hfUpdatePoinPreview() {
    var cfg     = _hfLoadConfig();
    var nilVal  = document.getElementById('hafalanNilaiSel') ? document.getElementById('hafalanNilaiSel').value : '';
    var kelVal  = document.getElementById('hafalanKelancaranSel') ? document.getElementById('hafalanKelancaranSel').value : '';
    var kamVal  = document.getElementById('hafalanKameraSel') && document.getElementById('hafalanKameraSel').value;
    var nilItem = (cfg.nilai||[]).find(function(n){ return n.kode === nilVal; });
    var kelItem = (cfg.kelancaran||[]).find(function(k){ return k.nama === kelVal; });
    var kamItem = kamVal ? (cfg.kamera||[]).find(function(k){ return k.nama === kamVal; }) : null;
    var poin    = (nilItem ? nilItem.poin : 0) + (kelItem ? kelItem.poin : 0) + (kamItem ? kamItem.poin : 0);
    var bonus   = new Date().getHours() < 9 ? 10 : 0;
    var txt     = document.getElementById('hafalanPoinPreviewText');
    if (!txt) return;
    if (!nilItem || !kelItem) {
      txt.textContent = 'Estimasi poin akan dihitung otomatis oleh sistem';
      return;
    }
    txt.innerHTML = 'Estimasi poin: <strong>+' + (poin + bonus) + '</strong>'
      + (bonus ? ' <span style="color:#d97706;font-weight:700">(+10 bonus subuh 🌙)</span>' : '');
  }

  function toggleKelolaPenilaian() {
    var modal = document.getElementById('modalKelolaPenilaian');
    if (!modal) return;
    var isOpen = modal.style.display !== 'none';
    modal.style.display = isOpen ? 'none' : 'flex';
    modal.style.alignItems = 'flex-start';
    if (!isOpen) {
      renderKelolaPenilaianHafalan();
      setTimeout(function(){ modal.scrollTop = 0; }, 50);
    }
  }

  function renderKelolaPenilaianHafalan() {
    var cfg = _hfLoadConfig();

    var kelListEl = document.getElementById('hfKelList');
    var kelBadge  = document.getElementById('hfKelBadge');
    if (kelBadge) kelBadge.textContent = cfg.kelancaran.length + ' item';
    if (kelListEl) {
      kelListEl.innerHTML = cfg.kelancaran.length ? cfg.kelancaran.map(function(k, i) {
        var poinLabel = k.poin > 0 ? '<span style="color:#1d4ed8;font-weight:700">+' + k.poin + '</span>'
                      : k.poin > 0 ? '<span style="color:#dc2626;font-weight:700">' + k.poin + '</span>'
                      : '<span style="color:#6b7280;font-weight:700">' + k.poin + '</span>';
        return '<div class="hf-pn-row">'
          + '<span style="font-size:16px;flex-shrink:0">' + k.icon + '</span>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:12px;font-weight:700;color:#111827">' + esc(k.nama) + ' <span style="color:#6b7280;font-weight:400">— ' + poinLabel + ' poin</span></div>'
            + (k.ket ? '<div style="font-size:10px;color:#9ca3af;font-style:italic">' + esc(k.ket) + '</div>' : '')
          + '</div>'
          + '<button onclick="hfDelKelancaran(' + i + ')" style="width:26px;height:26px;border-radius:7px;border:none;background:#fee2e2;color:#dc2626;cursor:pointer;font-size:12px;flex-shrink:0" title="Hapus">🗑</button>'
        + '</div>';
      }).join('')
      : '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">Belum ada opsi</div>';
    }

    var kamListEl = document.getElementById('hfKamList');
    var kamBadge  = document.getElementById('hfKamBadge');
    var kameraList = cfg.kamera || [];
    if (kamBadge) kamBadge.textContent = kameraList.length + ' item';
    if (kamListEl) {
      kamListEl.innerHTML = kameraList.length ? kameraList.map(function(k, i) {
        return '<div class="hf-pn-row">'
          + '<span style="font-size:16px;flex-shrink:0">' + k.icon + '</span>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:12px;font-weight:700;color:#111827">' + esc(k.nama) + '</div>'
            + '<div style="font-size:11px;color:#6b7280">Modifier: '
              + (k.poin > 0 ? '<span style="color:#1d4ed8;font-weight:700">+' + k.poin + '</span>'
                 : k.poin < 0 ? '<span style="color:#dc2626;font-weight:700">' + k.poin + '</span>'
                 : '<span style="color:#6b7280;font-weight:700">0</span>')
              + ' poin</div>'
          + '</div>'
          + '<button onclick="hfDelKamera(' + i + ')" style="width:26px;height:26px;border-radius:7px;border:none;background:#fee2e2;color:#dc2626;cursor:pointer;font-size:12px;flex-shrink:0" title="Hapus">🗑</button>'
        + '</div>';
      }).join('')
      : '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">Belum ada opsi</div>';
    }

    var nilListEl = document.getElementById('hfNilList');
    var nilBadge  = document.getElementById('hfNilBadge');
    if (nilBadge) nilBadge.textContent = cfg.nilai.length + ' item';
    if (nilListEl) {
      nilListEl.innerHTML = cfg.nilai.length ? cfg.nilai.map(function(n, i) {
        return '<div class="hf-pn-row">'
          + '<div style="width:28px;height:28px;border-radius:8px;background:#fef3c7;color:#b45309;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + esc(n.kode) + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:12px;font-weight:700;color:#111827">' + n.icon + ' ' + esc(n.desc) + '</div>'
            + '<div style="font-size:11px;color:#6b7280">Kode: <strong>' + esc(n.kode) + '</strong> &nbsp;·&nbsp; <span style="color:#d97706;font-weight:700">' + n.poin + ' poin</span></div>'
          + '</div>'
          + '<button onclick="hfDelNilai(' + i + ')" style="width:26px;height:26px;border-radius:7px;border:none;background:#fee2e2;color:#dc2626;cursor:pointer;font-size:12px;flex-shrink:0" title="Hapus">🗑</button>'
        + '</div>';
      }).join('')
      : '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">Belum ada opsi</div>';
    }

    _hfRenderAllDropdowns();
  }

  function _confirmHapusOpsi() {
    return showConfirm('Hapus opsi ini?', { title: 'Hapus Opsi?', okText: 'Ya, Hapus', danger: true });
  }

  async function hfAddKelancaran() {
    var nama = (document.getElementById('hfAddKelNama').value || '').trim();
    var poin = parseInt(document.getElementById('hfAddKelPoin').value) || 0;
    var icon = document.getElementById('hfAddKelIcon').value || '🟢';
    if (!nama) { showToast('Nama kategori tidak boleh kosong', 'warning'); return; }
    var cfg = _hfLoadConfig();
    cfg.kelancaran.push({ id: 'kel-' + Date.now(), nama, poin, icon });
    await _hfSaveConfig(cfg);
    document.getElementById('hfAddKelNama').value = '';
    document.getElementById('hfAddKelPoin').value = '';
    showToast('Opsi kelancaran ditambahkan ✓', 'success');
  }

  async function hfDelKelancaran(i) {
    if (!(await _confirmHapusOpsi())) return;
    var cfg = _hfLoadConfig();
    cfg.kelancaran.splice(i, 1);
    await _hfSaveConfig(cfg);
    showToast('Opsi dihapus', 'success');
  }

  async function hfAddNilai() {
    var kode = (document.getElementById('hfAddNilKode').value || '').trim();
    var desc = (document.getElementById('hfAddNilDesc').value || '').trim();
    var poin = parseInt(document.getElementById('hfAddNilPoin').value) || 0;
    if (!kode || !desc) { showToast('Kode dan deskripsi wajib diisi', 'warning'); return; }
    var cfg  = _hfLoadConfig();
    var icons = ['⭐','✅','📌','🎯','🏆','📖'];
    cfg.nilai.push({ id: 'nil-' + Date.now(), kode, desc, poin, icon: icons[cfg.nilai.length % icons.length] });
    await _hfSaveConfig(cfg);
    document.getElementById('hfAddNilKode').value = '';
    document.getElementById('hfAddNilDesc').value = '';
    document.getElementById('hfAddNilPoin').value = '';
    showToast('Opsi nilai ditambahkan ✓', 'success');
  }

  async function hfDelNilai(i) {
    if (!(await _confirmHapusOpsi())) return;
    var cfg = _hfLoadConfig();
    cfg.nilai.splice(i, 1);
    await _hfSaveConfig(cfg);
    showToast('Opsi dihapus', 'success');
  }

  async function hfResetPenilaian() {
    if (!(await showConfirm('Reset semua penilaian ke pengaturan default?', { title: 'Reset Penilaian?', okText: 'Ya, Reset', danger: true }))) return;
    localStorage.removeItem(_HF_PENILAIAN_KEY);
    _hfConfigCache = null;
    await _hfSaveConfig(_hfDefaultConfig());
    showToast('Penilaian direset ke default', 'success');
  }

  async function hfAddKamera() {
    var nama = (document.getElementById('hfAddKamNama').value || '').trim();
    var poin = parseInt(document.getElementById('hfAddKamPoin').value) || 0;
    var icon = document.getElementById('hfAddKamIcon').value || '📷';
    if (!nama) { showToast('Nama opsi tidak boleh kosong', 'warning'); return; }
    var cfg = _hfLoadConfig();
    if (!cfg.kamera) cfg.kamera = [];
    cfg.kamera.push({ id: 'kam-' + Date.now(), nama, poin, icon });
    await _hfSaveConfig(cfg);
    document.getElementById('hfAddKamNama').value = '';
    document.getElementById('hfAddKamPoin').value = '';
    showToast('Opsi kamera ditambahkan ✓', 'success');
  }

  async function hfDelKamera(i) {
    if (!(await _confirmHapusOpsi())) return;
    var cfg = _hfLoadConfig();
    if (!cfg.kamera) return;
    cfg.kamera.splice(i, 1);
    await _hfSaveConfig(cfg);
    showToast('Opsi dihapus', 'success');
  }

  function _initNavHafalan() {
    var halaqahList = getHalaqahList();
    var qiyamHalaqah = (halaqahList || []).filter(function(h) { return h.level === 'Level Qiyam'; });
    var hasQiyam = qiyamHalaqah.length > 0;
    var btn   = document.getElementById('navHafalanGuru');
    var bdg   = document.getElementById('navHafalanBadge');
    var btnRp = document.getElementById('navRaportTahfidz');
    if (btn)   btn.style.display   = hasQiyam ? 'flex'  : 'none';
    if (bdg)   bdg.style.display   = hasQiyam ? 'inline-block' : 'none';
    if (btnRp) btnRp.style.display = hasQiyam ? 'flex'  : 'none';
    _hafalanGuruQiyamList = qiyamHalaqah;
  }

  async function initHafalanGuruPage() {
    var halaqahList = getHalaqahList();
    var qiyamHalaqah = (halaqahList || []).filter(function(h) { return h.level === 'Level Qiyam'; });
    _hafalanGuruQiyamList = qiyamHalaqah;

    var tglInput = document.getElementById('hafalanTanggal');
    if (tglInput && !tglInput.value) {
      tglInput.value = localDateStr();
    }

    _hfConfigCache = null;
    await _hfFetchConfigFromDB();
    _hfRenderAllDropdowns();
    hfUpdatePoinPreview();

    var hSel = document.getElementById('hafalanGuruHalaqahSel');
    if (!hSel) return;
    hSel.innerHTML = '<option value="">— Pilih Halaqah —</option>'
      + qiyamHalaqah.map(function(h) {
          return '<option value="' + esc(h.id_halaqah) + '">' + esc(h.nama_halaqah) + '</option>';
        }).join('');

    if (qiyamHalaqah.length === 1) {
      hSel.value = qiyamHalaqah[0].id_halaqah;
      await onHafalanHalaqahChange();
    }
  }

  async function loadTargetHafalanGuru(id_halaqah) {
    var card    = document.getElementById('hafalanTargetGuruCard');
    var grid    = document.getElementById('hafalanTargetGuruGrid');
    var badge   = document.getElementById('hafalanTargetGuruBadge');
    if (!card || !grid) return;
    try {
      var res  = await window.HQ.GuruAPI.getTargetHafalanMurid(id_halaqah);
      var list = res.data || [];
      if (!list.length) { card.style.display = 'none'; return; }
      badge.textContent = list.length + ' siswa';
      grid.innerHTML = list.map(function(t) {
        var initial = (t.nama_murid || '?').charAt(0).toUpperCase();
        var tgl     = t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
        return '<div class="hf-target-murid-card" style="display:flex;align-items:flex-start;gap:10px;border-radius:12px;padding:11px 13px">'
          + '<div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initial + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:12px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.nama_murid || '-') + '</div>'
            + '<div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-top:2px">🎯 ' + esc(t.target_surat) + '</div>'
            + '<div style="font-size:10px;color:#6b7280;margin-top:1px">Ayat ' + (t.target_ayat_dari||'-') + '–' + (t.target_ayat_sampai||'-') + ' &nbsp;·&nbsp; ' + tgl + '</div>'
          + '</div>'
        + '</div>';
      }).join('');
      window._lastTargetDataKbm = list;
      card.style.display = 'block';
    } catch(e) {
      card.style.display = 'none';
    }
  }

  async function onHafalanHalaqahChange() {
    var id_halaqah = document.getElementById('hafalanGuruHalaqahSel').value;
    if (!id_halaqah) return;
    if (!_hafalanGuruMuridCache[id_halaqah]) {
      try {
        var res = await window.HQ.GuruAPI.getMuridQiyam(id_halaqah);
        _hafalanGuruMuridCache[id_halaqah] = res.data || [];
      } catch(e) { _hafalanGuruMuridCache[id_halaqah] = []; }
    }
    var muridList = _hafalanGuruMuridCache[id_halaqah];
    var muridOpts = '<option value="">— Pilih Murid —</option>'
      + muridList.map(function(m) {
          return '<option value="' + esc(m.id_murid) + '" data-nama="' + esc(m.nama_murid) + '">'
            + esc(m.nama_murid) + '</option>';
        }).join('');
    var muridSel   = document.getElementById('hafalanMuridSel');
    var filterSel  = document.getElementById('hafalanRiwayatMuridFilter');
    if (muridSel)  muridSel.innerHTML  = muridOpts;
    if (filterSel) filterSel.innerHTML = '<option value="">Semua Murid</option>' + muridList.map(function(m) {
      return '<option value="' + esc(m.id_murid) + '">' + esc(m.nama_murid) + '</option>';
    }).join('');
    _hafalanGuruZiyadah = [];
    clearHafalanSurat();
    document.getElementById('hafalanMurajaahInfo').style.display = 'none';
    _hafalanGuruOffset = 0;
    if (id_halaqah) loadTargetHafalanGuru(id_halaqah);
    loadRiwayatHafalan();
    var kpModal = document.getElementById('modalKelolaKelompokPartner');
    if (kpModal && kpModal.style.display !== 'none' && typeof window.renderKelolaKelompokPartner === 'function') {
      window.renderKelolaKelompokPartner();
    }
  }

  async function onHafalanMuridChange() {
    var id_murid   = document.getElementById('hafalanMuridSel').value;
    var id_halaqah = document.getElementById('hafalanGuruHalaqahSel').value;
    clearHafalanSurat();
    document.getElementById('hafalanMurajaahInfo').style.display = 'none';
    _hafalanGuruZiyadah = [];
    if (!id_murid || !id_halaqah) return;
    try {
      var res = await window.HQ.GuruAPI.getZiyadahMurid(id_halaqah, id_murid);
      _hafalanGuruZiyadah = res.data || [];
    } catch(e) { _hafalanGuruZiyadah = []; }
    var inp = document.getElementById('hafalanSuratInput');
    if (inp) inp.placeholder = '— Pilih surat —';
  }

  async function onHafalanJenisChange() {
    var jenis = document.getElementById('hafalanJenisSel').value;
    clearHafalanSurat();
    document.getElementById('hafalanMurajaahInfo').style.display = 'none';
    if (jenis === 'Murajaah' && !_hafalanGuruZiyadah.length) {
      var id_murid = document.getElementById('hafalanMuridSel').value;
      if (!id_murid) {
        showToast('Pilih murid terlebih dahulu sebelum memilih jenis setoran.', 'warning');
        document.getElementById('hafalanJenisSel').value = 'Ziyadah';
        return;
      }
      showToast('Murid ini belum punya data Ziyadah. Murajaah tidak bisa dilakukan.', 'warning');
      document.getElementById('hafalanJenisSel').value = 'Ziyadah';
    }
  }

  function mergeIntervals(intervals) {
    if (!intervals || !intervals.length) return [];
    var sorted = intervals.slice().sort(function(a, b) {
      return a.ayat_dari - b.ayat_dari;
    });
    var merged = [];
    var current = { ayat_dari: parseInt(sorted[0].ayat_dari), ayat_sampai: parseInt(sorted[0].ayat_sampai) };
    for (var i = 1; i < sorted.length; i++) {
      var next = sorted[i];
      var nD = parseInt(next.ayat_dari);
      var nS = parseInt(next.ayat_sampai);
      if (nD <= current.ayat_sampai + 1) {
        current.ayat_sampai = Math.max(current.ayat_sampai, nS);
      } else {
        merged.push(current);
        current = { ayat_dari: nD, ayat_sampai: nS };
      }
    }
    merged.push(current);
    return merged;
  }

  function getJuzFromSuratAndAyat(suratNo, ayat) {
    var a = parseInt(ayat);
    if (isNaN(a)) return null;
    switch (suratNo) {
      case 2: if (a <= 141) return 1; if (a <= 252) return 2; return 3;
      case 3: if (a <= 92) return 3; return 4;
      case 4: if (a <= 23) return 4; if (a <= 147) return 5; return 6;
      case 5: if (a <= 81) return 6; return 7;
      case 6: if (a <= 110) return 7; return 8;
      case 7: if (a <= 87) return 8; return 9;
      case 8: if (a <= 40) return 9; return 10;
      case 9: if (a <= 92) return 10; return 11;
      case 11: if (a <= 5) return 11; return 12;
      case 12: if (a <= 52) return 12; return 13;
      case 18: if (a <= 74) return 15; return 16;
      case 25: if (a <= 20) return 18; return 19;
      case 27: if (a <= 55) return 19; return 20;
      case 29: if (a <= 45) return 20; return 21;
      case 33: if (a <= 30) return 21; return 22;
      case 36: if (a <= 27) return 22; return 23;
      case 39: if (a <= 31) return 23; return 24;
      case 41: if (a <= 46) return 24; return 25;
      case 51: if (a <= 30) return 26; return 27;
      default: return null;
    }
  }

  function updateAutoJuz() {
    var suratVal = document.getElementById('hafalanSuratValue').value;
    if (!suratVal) return;
    var meta = _getSuratData().find(function(sd) {
      return sd.latin.toLowerCase().replace(/['-]/g,'') === suratVal.toLowerCase().replace(/['-]/g,'');
    });
    if (!meta) return;
    if (meta.juz && meta.juz.length === 1) {
      document.getElementById('hafalanJuzSel').value = meta.juz[0];
    } else {
      var aD = parseInt(document.getElementById('hafalanAyatDari').value);
      if (!isNaN(aD)) {
        var computedJuz = getJuzFromSuratAndAyat(meta.no, aD);
        if (computedJuz) {
          document.getElementById('hafalanJuzSel').value = computedJuz;
        }
      }
    }
  }

  function updateAutoJuzKbm(mid) {
    var eid = typeof window._hfKbmEid === 'function' ? window._hfKbmEid(mid) : mid;
    var suratVal = document.getElementById('hfkbm-surat-' + eid) ? document.getElementById('hfkbm-surat-' + eid).value : '';
    if (!suratVal) return;
    var meta = _getSuratData().find(function(sd) {
      return sd.latin.toLowerCase().replace(/['-]/g,'') === suratVal.toLowerCase().replace(/['-]/g,'');
    });
    if (!meta) return;
    var juzEl = document.getElementById('hfkbm-juz-' + eid);
    if (!juzEl) return;
    if (meta.juz && meta.juz.length === 1) {
      juzEl.value = meta.juz[0];
    } else {
      var aD = parseInt(document.getElementById('hfkbm-ayat-dari-' + eid).value);
      if (!isNaN(aD)) {
        var computedJuz = getJuzFromSuratAndAyat(meta.no, aD);
        if (computedJuz) {
          juzEl.value = computedJuz;
        }
      }
    }
  }

  function isSuratFullyMemorized(suratLatin, rawZiyadah) {
    var meta = _getSuratData().find(function(sd) {
      return sd.latin.toLowerCase().replace(/['-]/g,'') === suratLatin.toLowerCase().replace(/['-]/g,'');
    });
    if (!meta) return false;
    var raw = (rawZiyadah || []).filter(function(z) {
      return z.surat.toLowerCase().replace(/['-]/g,'') === suratLatin.toLowerCase().replace(/['-]/g,'');
    });
    var intervals = mergeIntervals(raw);
    if (intervals.length === 1 && intervals[0].ayat_dari === 1 && intervals[0].ayat_sampai >= meta.ayat) {
      return true;
    }
    return false;
  }

  function getZiyadahIntervalsForSurat(surat) {
    var raw = _hafalanGuruZiyadah.filter(function(z) {
      return z.surat.toLowerCase().replace(/['-]/g,'') === surat.toLowerCase().replace(/['-]/g,'');
    });
    return mergeIntervals(raw);
  }

  function checkZiyadahOverlap(intervals, aD, aS) {
    for (var i = 0; i < intervals.length; i++) {
      var inv = intervals[i];
      if (aD <= inv.ayat_sampai && aS >= inv.ayat_dari) {
        return inv;
      }
    }
    return null;
  }

  function checkMurajaahContainment(intervals, aD, aS) {
    for (var i = 0; i < intervals.length; i++) {
      var inv = intervals[i];
      if (aD >= inv.ayat_dari && aS <= inv.ayat_sampai) {
        return true;
      }
    }
    return false;
  }

  function _getSuratData() {
    if (_hfSuratData) return _hfSuratData;
    _hfSuratData = [
      {no:1,latin:'Al-Fatihah',juz:[1],ayat:7},{no:2,latin:'Al-Baqarah',juz:[1,2,3],ayat:286},
      {no:3,latin:'Ali Imran',juz:[3,4],ayat:200},{no:4,latin:'An-Nisa',juz:[4,5,6],ayat:176},
      {no:5,latin:'Al-Maidah',juz:[6,7],ayat:120},{no:6,latin:"Al-An'am",juz:[7,8],ayat:165},
      {no:7,latin:"Al-A'raf",juz:[8,9],ayat:206},{no:8,latin:'Al-Anfal',juz:[9,10],ayat:75},
      {no:9,latin:'At-Taubah',juz:[10,11],ayat:129},{no:10,latin:'Yunus',juz:[11],ayat:109},
      {no:11,latin:'Hud',juz:[11,12],ayat:123},{no:12,latin:'Yusuf',juz:[12,13],ayat:111},
      {no:13,latin:"Ar-Ra'd",juz:[13],ayat:43},{no:14,latin:'Ibrahim',juz:[13],ayat:52},
      {no:15,latin:'Al-Hijr',juz:[14],ayat:99},{no:16,latin:'An-Nahl',juz:[14],ayat:128},
      {no:17,latin:"Al-Isra'",juz:[15],ayat:111},{no:18,latin:'Al-Kahf',juz:[15,16],ayat:110},
      {no:19,latin:'Maryam',juz:[16],ayat:98},{no:20,latin:'Taha',juz:[16],ayat:135},
      {no:21,latin:"Al-Anbiya'",juz:[17],ayat:112},{no:22,latin:'Al-Hajj',juz:[17],ayat:78},
      {no:23,latin:"Al-Mu'minun",juz:[18],ayat:118},{no:24,latin:'An-Nur',juz:[18],ayat:64},
      {no:25,latin:'Al-Furqan',juz:[18,19],ayat:77},{no:26,latin:"Asy-Syu'ara'",juz:[19],ayat:227},
      {no:27,latin:'An-Naml',juz:[19,20],ayat:93},{no:28,latin:'Al-Qashash',juz:[20],ayat:88},
      {no:29,latin:"Al-'Ankabut",juz:[20,21],ayat:69},{no:30,latin:'Ar-Rum',juz:[21],ayat:60},
      {no:31,latin:'Luqman',juz:[21],ayat:34},{no:32,latin:'As-Sajdah',juz:[21],ayat:30},
      {no:33,latin:'Al-Ahzab',juz:[21,22],ayat:73},{no:34,latin:"Saba'",juz:[22],ayat:54},
      {no:35,latin:'Fatir',juz:[22],ayat:45},{no:36,latin:'Ya Sin',juz:[22,23],ayat:83},
      {no:37,latin:'As-Saffat',juz:[23],ayat:182},{no:38,latin:'Sad',juz:[23],ayat:88},
      {no:39,latin:'Az-Zumar',juz:[23,24],ayat:75},{no:40,latin:'Ghafir',juz:[24],ayat:85},
      {no:41,latin:'Fussilat',juz:[24,25],ayat:54},{no:42,latin:'Asy-Syura',juz:[25],ayat:53},
      {no:43,latin:'Az-Zukhruf',juz:[25],ayat:89},{no:44,latin:'Ad-Dukhan',juz:[25],ayat:59},
      {no:45,latin:'Al-Jatsiyah',juz:[25],ayat:37},{no:46,latin:'Al-Ahqaf',juz:[26],ayat:35},
      {no:47,latin:'Muhammad',juz:[26],ayat:38},{no:48,latin:'Al-Fath',juz:[26],ayat:29},
      {no:49,latin:'Al-Hujurat',juz:[26],ayat:18},{no:50,latin:'Qaf',juz:[26],ayat:45},
      {no:51,latin:'Az-Zariyat',juz:[26,27],ayat:60},{no:52,latin:'At-Tur',juz:[27],ayat:49},
      {no:53,latin:'An-Najm',juz:[27],ayat:62},{no:54,latin:'Al-Qamar',juz:[27],ayat:55},
      {no:55,latin:'Ar-Rahman',juz:[27],ayat:78},{no:56,latin:"Al-Waqi'ah",juz:[27],ayat:96},
      {no:57,latin:'Al-Hadid',juz:[27],ayat:29},{no:58,latin:'Al-Mujadilah',juz:[28],ayat:22},
      {no:59,latin:'Al-Hasyr',juz:[28],ayat:24},{no:60,latin:'Al-Mumtahanah',juz:[28],ayat:13},
      {no:61,latin:'As-Saf',juz:[28],ayat:14},{no:62,latin:"Al-Jumu'ah",juz:[28],ayat:11},
      {no:63,latin:'Al-Munafiqun',juz:[28],ayat:11},{no:64,latin:'At-Taghabun',juz:[28],ayat:18},
      {no:65,latin:'At-Talaq',juz:[28],ayat:12},{no:66,latin:'At-Tahrim',juz:[28],ayat:12},
      {no:67,latin:'Al-Mulk',juz:[29],ayat:30},{no:68,latin:'Al-Qalam',juz:[29],ayat:52},
      {no:69,latin:'Al-Haqqah',juz:[29],ayat:52},{no:70,latin:"Al-Ma'arij",juz:[29],ayat:44},
      {no:71,latin:'Nuh',juz:[29],ayat:28},{no:72,latin:'Al-Jinn',juz:[29],ayat:28},
      {no:73,latin:'Al-Muzzammil',juz:[29],ayat:20},{no:74,latin:'Al-Muddaththir',juz:[29],ayat:56},
      {no:75,latin:'Al-Qiyamah',juz:[29],ayat:40},{no:76,latin:'Al-Insan',juz:[29],ayat:31},
      {no:77,latin:'Al-Mursalat',juz:[29],ayat:50},{no:78,latin:"An-Naba'",juz:[30],ayat:40},
      {no:79,latin:"An-Nazi'at",juz:[30],ayat:46},{no:80,latin:"'Abasa",juz:[30],ayat:42},
      {no:81,latin:'At-Takwir',juz:[30],ayat:29},{no:82,latin:'Al-Infitar',juz:[30],ayat:19},
      {no:83,latin:'Al-Mutaffifin',juz:[30],ayat:36},{no:84,latin:'Al-Insyiqaq',juz:[30],ayat:25},
      {no:85,latin:'Al-Buruj',juz:[30],ayat:22},{no:86,latin:'At-Tariq',juz:[30],ayat:17},
      {no:87,latin:"Al-A'la",juz:[30],ayat:19},{no:88,latin:'Al-Ghasyiyah',juz:[30],ayat:26},
      {no:89,latin:'Al-Fajr',juz:[30],ayat:30},{no:90,latin:'Al-Balad',juz:[30],ayat:20},
      {no:91,latin:'Asy-Syams',juz:[30],ayat:15},{no:92,latin:'Al-Lail',juz:[30],ayat:21},
      {no:93,latin:'Ad-Duha',juz:[30],ayat:11},{no:94,latin:'Al-Insyirah',juz:[30],ayat:8},
      {no:95,latin:'At-Tin',juz:[30],ayat:8},{no:96,latin:"Al-'Alaq",juz:[30],ayat:19},
      {no:97,latin:'Al-Qadr',juz:[30],ayat:5},{no:98,latin:'Al-Bayyinah',juz:[30],ayat:8},
      {no:99,latin:'Az-Zalzalah',juz:[30],ayat:8},{no:100,latin:"Al-'Adiyat",juz:[30],ayat:11},
      {no:101,latin:"Al-Qari'ah",juz:[30],ayat:11},{no:102,latin:'At-Takasur',juz:[30],ayat:8},
      {no:103,latin:"Al-'Asr",juz:[30],ayat:3},{no:104,latin:'Al-Humazah',juz:[30],ayat:9},
      {no:105,latin:'Al-Fil',juz:[30],ayat:5},{no:106,latin:'Quraisy',juz:[30],ayat:4},
      {no:107,latin:"Al-Ma'un",juz:[30],ayat:7},{no:108,latin:'Al-Kautsar',juz:[30],ayat:3},
      {no:109,latin:'Al-Kafirun',juz:[30],ayat:6},{no:110,latin:'An-Nasr',juz:[30],ayat:3},
      {no:111,latin:'Al-Lahab',juz:[30],ayat:5},{no:112,latin:'Al-Ikhlas',juz:[30],ayat:4},
      {no:113,latin:'Al-Falaq',juz:[30],ayat:5},{no:114,latin:'An-Nas',juz:[30],ayat:6}
    ];
    return _hfSuratData;
  }

  function onHafalanSuratFocus() {
    onHafalanSuratInput(document.getElementById('hafalanSuratInput').value);
  }

  function onHafalanSuratInput(q) {
    var jenis = document.getElementById('hafalanJenisSel').value;
    var norm  = (q || '').toLowerCase().replace(/['-]/g, '').trim();
    var dd    = document.getElementById('hafalanSuratDropdown');
    var clear = document.getElementById('hafalanSuratClear');
    if (clear) clear.style.display = q ? 'inline' : 'none';

    var ziyadahBySurat = {};
    _hafalanGuruZiyadah.forEach(function(z) {
      var key = z.surat.toLowerCase();
      if (!ziyadahBySurat[key]) ziyadahBySurat[key] = [];
      ziyadahBySurat[key].push({ ayat_dari: z.ayat_dari, ayat_sampai: z.ayat_sampai });
    });

    var mergedZiyadahBySurat = {};
    for (var key in ziyadahBySurat) {
      mergedZiyadahBySurat[key] = mergeIntervals(ziyadahBySurat[key]);
    }

    var list;

    if (jenis === 'Murajaah') {
      var surahKeys = Object.keys(mergedZiyadahBySurat);
      if (!surahKeys.length) {
        dd.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:#9ca3af;text-align:center">'
          + 'Belum ada data Ziyadah untuk murid ini</div>';
        dd.style.display = 'block';
        return;
      }
      
      list = surahKeys.map(function(key) {
        var meta = _getSuratData().find(function(s) {
          return s.latin.toLowerCase().replace(/['-]/g,'') === key.replace(/['-]/g,'');
        });
        var intervals = mergedZiyadahBySurat[key];
        var latin = meta ? meta.latin : key;
        return {
          latin: latin,
          no: meta ? meta.no : '',
          juz: meta ? meta.juz : [],
          total_ayat: meta ? meta.ayat : null,
          intervals: intervals,
          _mode: 'murajaah'
        };
      }).filter(function(s) {
        return !norm || s.latin.toLowerCase().replace(/['-]/g,'').includes(norm);
      });
      
      list.sort(function(a, b) { return a.no - b.no; });

    } else {
      list = _getSuratData().map(function(s) {
        var intervals = mergedZiyadahBySurat[s.latin.toLowerCase()] || [];
        var isFullySet = false;
        if (intervals.length === 1 && intervals[0].ayat_dari === 1 && intervals[0].ayat_sampai === s.ayat) {
          isFullySet = true;
        }
        
        return Object.assign({}, s, {
          _mode: 'ziyadah',
          _intervals: intervals,
          _sudah_disetor: intervals.length > 0,
          _is_fully_set: isFullySet
        });
      }).filter(function(s) {
        return !norm || s.latin.toLowerCase().replace(/['-]/g,'').includes(norm);
      });

      list.sort(function(a, b) {
        if (a._is_fully_set === b._is_fully_set) return a.no - b.no;
        return a._is_fully_set ? 1 : -1;
      });

      if (!norm) list = list.slice(0, 25);
    }

    if (!list.length) {
      dd.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:#9ca3af;text-align:center">Surat tidak ditemukan</div>';
      dd.style.display = 'block';
      return;
    }

    dd.innerHTML = list.map(function(s) {
      var badge = '';
      var rowStyle = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s;';
      var noStyle  = 'width:26px;height:26px;border-radius:6px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;';

      if (s._mode === 'murajaah') {
        var rangeStr = s.intervals.map(function(inv) {
          return inv.ayat_dari + '–' + inv.ayat_sampai;
        }).join(', ');
        badge = '<span style="background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis" title="' + esc(rangeStr) + '">'
              + '🔄 ' + esc(rangeStr) + '</span>';
        noStyle += 'background:#e0f2fe;color:#0284c7;';
      } else if (s._is_fully_set) {
        badge = '<span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;flex-shrink:0">'
              + '✓ Selesai (Penuh)</span>';
        noStyle += 'background:#dcfce7;color:#15803d;';
        rowStyle += 'opacity:.5; pointer-events:none;';
      } else if (s._sudah_disetor) {
        var rangeStr = s._intervals.map(function(inv) {
          return inv.ayat_dari + '–' + inv.ayat_sampai;
        }).join(', ');
        badge = '<span style="background:#fffbeb;color:#d97706;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:normal;word-break:break-word" title="' + esc(rangeStr) + '">'
              + '✓ Parsial: ' + esc(rangeStr) + '</span>';
        noStyle += 'background:#fef3c7;color:#d97706;';
        rowStyle += 'opacity:.9;';
      } else {
        noStyle += 'background:#e0f2fe;color:#0284c7;';
      }

      var safeStr = JSON.stringify(s).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
      return '<div onclick=\'selectHafalanSurat(' + JSON.stringify(s.latin) + ',' + safeStr + ')\' '
        + 'style="' + rowStyle + '" '
        + 'onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'\'">'
        + '<span style="' + noStyle + '">' + (s.no || '?') + '</span>'
        + '<span style="font-size:13px;font-weight:600;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(s.latin) + '</span>'
        + badge
        + '</div>';
    }).join('');
    dd.style.display = 'block';
  }

  function onTargetSuratInput(q) {
    var dd   = document.getElementById('hafalanTargetDD');
    var norm = (q || '').toLowerCase().replace(/['-]/g, '');
    var sudahSet = new Set(_hafalanGuruZiyadah.map(function(z){ return z.surat.toLowerCase(); }));
    var list = _getSuratData().filter(function(s) {
      return !norm || s.latin.toLowerCase().replace(/['-]/g,'').includes(norm);
    }).slice(0, 20);

    if (!list.length) { dd.innerHTML = '<div style="padding:10px;font-size:12px;color:#9ca3af;text-align:center">Tidak ditemukan</div>'; dd.style.display='block'; return; }

    dd.innerHTML = list.map(function(s) {
      var sudah = sudahSet.has(s.latin.toLowerCase());
      var tag   = sudah ? '<span style="background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:4px">Sudah disetor</span>' : '';
      return '<div onmousedown="selectTargetSuratGuru(\''+s.latin.replace(/'/g,"\\'")+'\','+s.ayat+')" '
        + 'style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s" '
        + 'onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'\'">'
        + '<span style="background:#e0f2fe;color:#0284c7;width:24px;height:24px;border-radius:6px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+s.no+'</span>'
        + '<span style="font-size:13px;font-weight:600;flex:1">'+esc(s.latin)+ tag +'</span>'
        + '<span style="font-size:11px;color:#9ca3af">'+s.ayat+' ayat</span>'
      + '</div>';
    }).join('');
    dd.style.display = 'block';
  }

  function selectTargetSuratGuru(latin, totalAyat) {
    document.getElementById('hafalanTargetSurat').value = latin;
    document.getElementById('hafalanTargetDD').style.display = 'none';
    _targetSuratMaxAyat = totalAyat;
    var tDari   = document.getElementById('hafalanTargetDari');
    var tSampai = document.getElementById('hafalanTargetSampai');
    if (tDari)   tDari.max   = totalAyat;
    if (tSampai) tSampai.max = totalAyat;
  }

  function clampTargetAyat(input) {
    var val = parseInt(input.value);
    var max = parseInt(input.max);
    if (!isNaN(val) && !isNaN(max) && val > max) input.value = max;
    if (!isNaN(val) && val < 1) input.value = 1;
  }

  function clampHafalanAyat(input) {
    var val = parseInt(input.value);
    var max = parseInt(input.max);
    var min = parseInt(input.min) || 1;
    if (isNaN(val)) return;
    if (!isNaN(max) && val > max) input.value = max;
    if (val < min) input.value = min;
  }

  function selectHafalanSurat(latin, s) {
    document.getElementById('hafalanSuratInput').value = latin;
    document.getElementById('hafalanSuratValue').value  = latin;
    var cl = document.getElementById('hafalanSuratClear');
    if (cl) cl.style.display = 'inline';
    document.getElementById('hafalanSuratDropdown').style.display = 'none';
    document.getElementById('hafalanMurajaahInfo').style.display = 'none';

    var meta = _getSuratData().find(function(sd) {
      return sd.latin.toLowerCase().replace(/['-]/g,'') === latin.toLowerCase().replace(/['-]/g,'');
    });
    _hafalanSelectedAyatMax = (meta && meta.ayat) ? meta.ayat : null;

    var lbl = document.getElementById('hafalanSuratLabel');
    if (lbl) {
      lbl.textContent = _hafalanSelectedAyatMax ? 'Nama Surat (' + _hafalanSelectedAyatMax + ' ayat)' : 'Nama Surat';
    }

    var inputDari   = document.getElementById('hafalanAyatDari');
    var inputSampai = document.getElementById('hafalanAyatSampai');
    var maxAyat     = _hafalanSelectedAyatMax || '';

    inputDari.placeholder = _hafalanSelectedAyatMax ? '1–' + _hafalanSelectedAyatMax : 'Ayat mulai';
    inputSampai.placeholder = _hafalanSelectedAyatMax ? 'Maks. ' + _hafalanSelectedAyatMax : 'Ayat selesai';

    if (s._mode === 'murajaah') {
      var firstInv = s.intervals[0] || { ayat_dari: '', ayat_sampai: '' };
      inputDari.value   = firstInv.ayat_dari;
      inputSampai.value = firstInv.ayat_sampai;
      inputDari.min     = '1';   inputDari.max   = maxAyat || '';
      inputSampai.min   = '1';   inputSampai.max = maxAyat || '';
      
      var rangeStr = s.intervals.map(function(inv) {
        return inv.ayat_dari + '–' + inv.ayat_sampai;
      }).join(', ');
      document.getElementById('hafalanMurajaahRange').textContent =
        latin + ' · Range Ziyadah: ' + rangeStr;
      document.getElementById('hafalanMurajaahInfo').style.display = 'block';

    } else {
      var suggestDari = 1;
      var intervals = s._intervals || [];
      if (intervals.length) {
        if (intervals[0].ayat_dari === 1) {
          suggestDari = intervals[0].ayat_sampai + 1;
        }
      }
      if (suggestDari > maxAyat) suggestDari = '';
      
      inputDari.value   = suggestDari;
      inputSampai.value = '';
      inputDari.min = '1'; inputDari.max = maxAyat || '';
      inputSampai.min = '1'; inputSampai.max = maxAyat || '';
    }

    updateAutoJuz();
  }

  function clearHafalanSurat() {
    document.getElementById('hafalanSuratInput').value  = '';
    document.getElementById('hafalanSuratValue').value  = '';
    var cl = document.getElementById('hafalanSuratClear');
    if (cl) cl.style.display = 'none';
    document.getElementById('hafalanSuratDropdown').style.display = 'none';
    document.getElementById('hafalanMurajaahInfo').style.display  = 'none';
    document.getElementById('hafalanAyatDari').value   = '';
    document.getElementById('hafalanAyatSampai').value = '';
    document.getElementById('hafalanAyatDari').placeholder = 'Ayat mulai';
    document.getElementById('hafalanAyatSampai').placeholder = 'Ayat selesai';
    var lbl = document.getElementById('hafalanSuratLabel');
    if (lbl) lbl.textContent = 'Nama Surat';
    document.getElementById('hafalanJuzSel').value = '';
    _hafalanSelectedAyatMax = null;
    ['hafalanAyatDari','hafalanAyatSampai'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.removeAttribute('max'); el.removeAttribute('min'); }
    });
  }

  document.addEventListener('click', function(e) {
    var dd = document.getElementById('hafalanSuratDropdown');
    var inp = document.getElementById('hafalanSuratInput');
    if (dd && inp && !dd.contains(e.target) && e.target !== inp) dd.style.display = 'none';
  });

  async function submitSetoranHafalan() {
    if (_hafalanGuruSubmitting) return;
    var id_halaqah = document.getElementById('hafalanGuruHalaqahSel').value;
    var muridSel   = document.getElementById('hafalanMuridSel');
    var id_murid   = muridSel.value;
    var nama_murid = muridSel.options[muridSel.selectedIndex] && muridSel.options[muridSel.selectedIndex].getAttribute('data-nama');
    var tanggal    = document.getElementById('hafalanTanggal').value;
    var jenis      = document.getElementById('hafalanJenisSel').value;
    var nilai      = document.getElementById('hafalanNilaiSel').value;
    var kelancaran = document.getElementById('hafalanKelancaranSel').value;
    var juz        = document.getElementById('hafalanJuzSel').value;
    var surat      = document.getElementById('hafalanSuratValue').value;
    var ayatDari   = document.getElementById('hafalanAyatDari').value;
    var ayatSampai = document.getElementById('hafalanAyatSampai').value;
    var kamera     = document.getElementById('hafalanKameraSel') ? document.getElementById('hafalanKameraSel').value : null;
    var catatan    = document.getElementById('hafalanCatatan').value.trim();
    var tgtSurat   = document.getElementById('hafalanTargetSurat').value.trim();
    var tgtDari    = document.getElementById('hafalanTargetDari').value;
    var tgtSampai  = document.getElementById('hafalanTargetSampai').value;

    if (!id_halaqah) { showToast('Pilih halaqah terlebih dahulu', 'warning'); return; }
    if (!id_murid)   { showToast('Pilih siswa terlebih dahulu', 'warning'); return; }
    if (!surat)      { showToast('Pilih surat terlebih dahulu', 'warning'); return; }
    if (!ayatDari || !ayatSampai) { showToast('Isi ayat dari dan sampai', 'warning'); return; }
    var aD = parseInt(ayatDari), aS = parseInt(ayatSampai);
    if (aD < 1 || aS < 1) { showToast('Nomor ayat harus minimal 1', 'warning'); return; }
    if (aD > aS) { showToast('Ayat dari tidak boleh lebih besar dari ayat sampai', 'warning'); return; }
    if (_hafalanSelectedAyatMax && (aD > _hafalanSelectedAyatMax || aS > _hafalanSelectedAyatMax)) {
      showToast('Ayat melebihi jumlah ayat surat ini (' + _hafalanSelectedAyatMax + ' ayat)', 'warning');
      return;
    }
    if (!nilai) { showToast('Pilih nilai terlebih dahulu', 'warning'); return; }

    if (jenis === 'Ziyadah') {
      var intervals = getZiyadahIntervalsForSurat(surat);
      var overlap = checkZiyadahOverlap(intervals, aD, aS);
      if (overlap) {
        showToast('Gagal: Ayat ' + aD + '–' + aS + ' sudah pernah disetor sebagai Ziyadah (tumpang tindih dengan ayat ' + overlap.ayat_dari + '–' + overlap.ayat_sampai + ').', 'warning');
        return;
      }
    } else if (jenis === 'Murajaah') {
      var intervals = getZiyadahIntervalsForSurat(surat);
      if (!intervals.length) {
        showToast('Gagal: Murid belum memiliki data Ziyadah untuk surat ' + surat + '.', 'warning');
        return;
      }
      var isContained = checkMurajaahContainment(intervals, aD, aS);
      if (!isContained) {
        var rangeStr = intervals.map(function(inv) {
          return inv.ayat_dari + '–' + inv.ayat_sampai;
        }).join(', ');
        showToast('Gagal: Ayat Murajaah harus berada di dalam range Ziyadah yang sudah disetor (Range valid: ' + rangeStr + ').', 'warning');
        return;
      }
    }

    _hafalanGuruSubmitting = true;
    var btn = document.getElementById('btnSubmitHafalan');
    if (btn) { btn.style.opacity = '.6'; btn.disabled = true; }

    try {
      await window.HQ.GuruAPI.addSetoranHafalan({
        id_murid, nama_murid, id_halaqah, juz, surat,
        tanggal: tanggal || null,
        ayat_dari: ayatDari, ayat_sampai: ayatSampai,
        jenis, nilai, kelancaran, kamera: kamera || null, catatan,
        target_surat: tgtSurat || null,
        target_ayat_dari: tgtDari || null,
        target_ayat_sampai: tgtSampai || null,
      });
      showToast('Setoran hafalan berhasil disimpan! 🎉', 'success');
      document.getElementById('hafalanJenisSel').value  = 'Ziyadah';
      document.getElementById('hafalanJuzSel').value    = '';
      document.getElementById('hafalanCatatan').value   = '';
      document.getElementById('hafalanTargetSurat').value   = '';
      document.getElementById('hafalanTargetDD').style.display = 'none';
      _targetSuratMaxAyat = null;
      document.getElementById('hafalanTargetDari').value    = '';
      document.getElementById('hafalanTargetSampai').value  = '';
      var cfg = _hfLoadConfig();
      var nilSel = document.getElementById('hafalanNilaiSel');
      var kelSel = document.getElementById('hafalanKelancaranSel');
      if (nilSel && cfg.nilai.length) nilSel.value = cfg.nilai[0].kode;
      if (kelSel && cfg.kelancaran.length) kelSel.value = cfg.kelancaran[0].nama;
      var kamSelEl = document.getElementById('hafalanKameraSel');
      if (kamSelEl && cfg.kamera && cfg.kamera.length) kamSelEl.value = cfg.kamera[0].nama;
      clearHafalanSurat();
      _hafalanGuruZiyadah = [];
      try {
        var zRes = await window.HQ.GuruAPI.getZiyadahMurid(id_halaqah, id_murid);
        _hafalanGuruZiyadah = zRes.data || [];
      } catch(e) { _hafalanGuruZiyadah = []; }
      document.getElementById('hafalanMurajaahInfo').style.display = 'none';
      hfUpdatePoinPreview();
      if (id_halaqah) loadTargetHafalanGuru(id_halaqah);
      _hafalanGuruOffset = 0;
      loadRiwayatHafalan();
    } catch(e) {
      showToast('Gagal menyimpan: ' + (e.message || e), 'error');
    } finally {
      _hafalanGuruSubmitting = false;
      if (btn) { btn.style.opacity = '1'; btn.disabled = false; }
    }
  }

  async function loadRiwayatHafalan(more) {
    var id_halaqah = document.getElementById('hafalanGuruHalaqahSel').value;
    if (!id_halaqah) return;
    if (!more) _hafalanGuruOffset = 0;
    var id_murid = document.getElementById('hafalanRiwayatMuridFilter').value;
    var listEl   = document.getElementById('hafalanGuruRiwayatList');
    var moreBtn  = document.getElementById('hafalanGuruLoadMore');
    var emptyEl  = document.getElementById('hafalanGuruEmpty');
    if (!more && listEl) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">⏳ Memuat…</div>';
    try {
      var res  = await window.HQ.GuruAPI.getSetoranHafalanGuru(id_halaqah, id_murid || null, 15, _hafalanGuruOffset);
      var data = res.data || [];
      _hafalanGuruOffset += data.length;
      if (!more && listEl) listEl.innerHTML = '';
      var jenisIcon = { Ziyadah:'📖', Murajaah:'🔄', Tahsin:'✨' };
      var nilaiCls  = { A:'background:#dbeafe;color:#1d4ed8', B:'background:#d1fae5;color:#065f46', C:'background:#fef3c7;color:#92400e' };
      if (listEl) listEl.innerHTML += data.map(function(r) {
        var catHtml = r.catatan ? '<div style="margin-top:6px;background:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:6px 10px;font-size:11px;color:#78350f;font-style:italic">' + esc(r.catatan) + '</div>' : '';
        var tgtHtml = r.target_surat ? '<div style="margin-top:4px;font-size:11px;color:#059669;font-weight:600">🎯 Target: ' + esc(r.target_surat) + ' · ' + r.target_ayat_dari + '–' + r.target_ayat_sampai + '</div>' : '';
        return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:13px;padding:12px 13px;margin-bottom:7px;display:flex;gap:10px;align-items:flex-start">'
          + '<div style="' + (nilaiCls[r.nilai] || 'background:#f3f4f6;color:#374151') + ';width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0">' + (r.nilai || '?') + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:13px;font-weight:700;color:#111827">Juz ' + (r.juz||'-') + ' · ' + esc(r.surat) + '</div>'
            + '<div style="font-size:11px;color:#6b7280;margin:2px 0">'
              + '<span style="background:#f3f4f6;border-radius:100px;padding:1px 8px;font-weight:700">' + (jenisIcon[r.jenis]||'📖') + ' ' + esc(r.jenis||'Ziyadah') + '</span>'
              + ' · Ayat ' + r.ayat_dari + '–' + r.ayat_sampai
              + ' · <strong>' + esc(r.nama_murid||'-') + '</strong>'
            + '</div>'
            + '<div style="font-size:10px;color:#9ca3af">' + _fmtHafalanDateGuru(r.created_at) + '</div>'
            + catHtml + tgtHtml
          + '</div>'
          + '<button onclick="deleteSetoranHafalanGuru(\'' + r.id_setoran + '\', \'' + esc((r.nama_murid||'').replace(/'/g, "\\'")) + '\', \'' + esc((r.surat||'').replace(/'/g, "\\'")) + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background 0.2s;margin-top:2px" title="Hapus Setoran" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'none\'">'
            + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
          + '</button>'
        + '</div>';
      }).join('');
      if (emptyEl) emptyEl.style.display = (!_hafalanGuruOffset && !more) ? 'block' : 'none';
      if (moreBtn) moreBtn.style.display = res.has_more ? 'block' : 'none';
    } catch(e) {
      if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px">Gagal memuat riwayat.</div>';
    }
  }

  function refreshHafalanGuru() {
    _hafalanGuruOffset = 0;
    loadRiwayatHafalan();
  }

  function _fmtHafalanDateGuru(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch(e) { return iso; }
  }

  async function deleteSetoranHafalanGuru(id_setoran, nama_murid, surat) {
    if (!(await showConfirm('Apakah Anda yakin ingin menghapus setoran hafalan ' + (surat ? '"' + surat + '" ' : '') + 'milik ' + (nama_murid || 'murid') + '?\n\nTindakan ini akan menghapus data setoran secara permanen dan memperbarui data raport.', { title: 'Hapus Setoran Hafalan?', okText: 'Ya, Hapus', danger: true }))) {
      return;
    }
    try {
      showLoad('Bismillah, menghapus setoran...');
      var res = await window.HQ.GuruAPI.deleteSetoranHafalan(id_setoran);
      if (res && res.status === 'ok') {
        showToast('Setoran hafalan berhasil dihapus.', 'ok');
        _hafalanGuruOffset = 0;
        loadRiwayatHafalan();
        var selMurid = document.getElementById('hafalanMuridSel').value;
        var selHalaqah = document.getElementById('hafalanGuruHalaqahSel').value;
        if (selHalaqah) {
          loadTargetHafalanGuru(selHalaqah);
        }
        if (selHalaqah && selMurid) {
          try {
            var zRes = await window.HQ.GuruAPI.getZiyadahMurid(selHalaqah, selMurid);
            _hafalanGuruZiyadah = zRes.data || [];
          } catch(e) { _hafalanGuruZiyadah = []; }
        }
      } else {
        throw new Error((res && res.message) || 'Gagal menghapus');
      }
    } catch(e) {
      showToast('Gagal menghapus: ' + (e.message || e), 'error');
    } finally {
      hideLoad();
    }
  }

  function closeRiwayatSetoranModal() {
    var m = document.getElementById('modalRiwayatSetoran');
    if (m) m.style.display = 'none';
  }

  async function showRiwayatSetoranModal(id_murid, nama_murid) {
    var modal  = document.getElementById('modalRiwayatSetoran');
    var body   = document.getElementById('riwayatSetoranModalBody');
    var titleEl = document.getElementById('riwayatSetoranModalTitle');
    var subEl   = document.getElementById('riwayatSetoranModalSub');
    if (!modal || !body) return;

    titleEl.textContent = '📋 Riwayat Setoran';
    subEl.textContent   = nama_murid || 'Murid';
    body.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">⏳ Memuat…</div>';
    modal.style.display = 'flex';

    try {
      var sesiAktif = getSesiAktif();
      var id_halaqah = (sesiAktif && sesiAktif.id_halaqah) || '';
      if (!id_halaqah) {
        var hqSel = document.getElementById('hafalanGuruHalaqahSel');
        if (hqSel) id_halaqah = hqSel.value;
      }
      if (!id_halaqah) throw new Error('Halaqah tidak ditemukan');

      var res  = await window.HQ.GuruAPI.getSetoranHafalanGuru(id_halaqah, id_murid, 100, 0);
      var data = res.data || [];

      if (!data.length) {
        body.innerHTML = '<div style="text-align:center;padding:32px;color:#9ca3af"><div style="font-size:36px;margin-bottom:8px">📭</div><div style="font-size:13px;font-weight:700;color:#374151">Belum ada setoran</div></div>';
        return;
      }

      var jenisIcon = { Ziyadah:'📖', Murajaah:'🔄', Tahsin:'✨' };
      var nilaiCls  = {
        Mumtaz : 'background:#dbeafe;color:#1d4ed8',
        Baik   : 'background:#d1fae5;color:#065f46',
        Cukup  : 'background:#fef3c7;color:#92400e',
        A      : 'background:#dbeafe;color:#1d4ed8',
        B      : 'background:#d1fae5;color:#065f46',
        C      : 'background:#fef3c7;color:#92400e'
      };
      var nilaiLabel = { Mumtaz:'M', Baik:'B', Cukup:'C', A:'A', B:'B', C:'C' };

      body.innerHTML = data.map(function(r) {
        var catHtml = r.catatan ? '<div style="margin-top:5px;background:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 7px 7px 0;padding:5px 9px;font-size:11px;color:#78350f;font-style:italic">' + esc(r.catatan) + '</div>' : '';
        var tgtHtml = r.target_surat ? '<div style="margin-top:4px;font-size:11px;color:#059669;font-weight:600">🎯 Target: ' + esc(r.target_surat) + ' · ' + r.target_ayat_dari + '–' + r.target_ayat_sampai + '</div>' : '';
        var kelHtml = r.kelancaran ? '<span style="font-size:10px;background:#f3f4f6;border-radius:100px;padding:1px 6px;margin-left:4px;font-weight:700">' + esc(r.kelancaran) + '</span>' : '';
        return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:11px 12px;margin-bottom:7px;display:flex;gap:9px;align-items:flex-start">'
          + '<div style="' + (nilaiCls[r.nilai] || 'background:#f3f4f6;color:#374151') + ';width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0" title="' + esc(r.nilai||'-') + '">' + (nilaiLabel[r.nilai] || (r.nilai ? r.nilai.charAt(0) : '?')) + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:13px;font-weight:700;color:#111827">Juz ' + (r.juz||'-') + ' · ' + esc(r.surat) + '</div>'
            + '<div style="font-size:11px;color:#6b7280;margin:2px 0">'
              + '<span style="background:#f3f4f6;border-radius:100px;padding:1px 7px;font-weight:700">' + (jenisIcon[r.jenis]||'📖') + ' ' + esc(r.jenis||'Ziyadah') + '</span>'
              + kelHtml
              + ' · Ayat ' + r.ayat_dari + '–' + r.ayat_sampai
            + '</div>'
            + '<div style="font-size:10px;color:#9ca3af">' + _fmtHafalanDateGuru(r.created_at) + '</div>'
            + catHtml + tgtHtml
          + '</div>'
        + '</div>';
      }).join('');
    } catch(e) {
      body.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px">Gagal memuat riwayat: ' + esc(e.message||'Error') + '</div>';
    }
  }

  // ── EXPOSE PUBLIC INTERFACE ──────────────────────
  window._hfDefaultConfig = _hfDefaultConfig;
  window._hfLoadConfig = _hfLoadConfig;
  window._hfFetchConfigFromDB = _hfFetchConfigFromDB;
  window._hfClearLocalCache = _hfClearLocalCache;
  window._hfSaveConfig = _hfSaveConfig;
  window._hfRenderAllDropdowns = _hfRenderAllDropdowns;
  window.hfUpdatePoinPreview = hfUpdatePoinPreview;
  window.toggleKelolaPenilaian = toggleKelolaPenilaian;
  window.renderKelolaPenilaianHafalan = renderKelolaPenilaianHafalan;
  window.hfAddKelancaran = hfAddKelancaran;
  window.hfDelKelancaran = hfDelKelancaran;
  window.hfAddNilai = hfAddNilai;
  window.hfDelNilai = hfDelNilai;
  window.hfResetPenilaian = hfResetPenilaian;
  window.hfAddKamera = hfAddKamera;
  window.hfDelKamera = hfDelKamera;
  window._initNavHafalan = _initNavHafalan;
  window.initHafalanGuruPage = initHafalanGuruPage;
  window.loadTargetHafalanGuru = loadTargetHafalanGuru;
  window.onHafalanHalaqahChange = onHafalanHalaqahChange;
  window.onHafalanMuridChange = onHafalanMuridChange;
  window.onHafalanJenisChange = onHafalanJenisChange;
  window.mergeIntervals = mergeIntervals;
  window.getJuzFromSuratAndAyat = getJuzFromSuratAndAyat;
  window.updateAutoJuz = updateAutoJuz;
  window.updateAutoJuzKbm = updateAutoJuzKbm;
  window.isSuratFullyMemorized = isSuratFullyMemorized;
  window.getZiyadahIntervalsForSurat = getZiyadahIntervalsForSurat;
  window.checkZiyadahOverlap = checkZiyadahOverlap;
  window.checkMurajaahContainment = checkMurajaahContainment;
  window._getSuratData = _getSuratData;
  window.onHafalanSuratFocus = onHafalanSuratFocus;
  window.onHafalanSuratInput = onHafalanSuratInput;
  window.onTargetSuratInput = onTargetSuratInput;
  window.selectTargetSuratGuru = selectTargetSuratGuru;
  window.clampTargetAyat = clampTargetAyat;
  window.clampHafalanAyat = clampHafalanAyat;
  window.selectHafalanSurat = selectHafalanSurat;
  window.clearHafalanSurat = clearHafalanSurat;
  window.submitSetoranHafalan = submitSetoranHafalan;
  window.loadRiwayatHafalan = loadRiwayatHafalan;
  window.refreshHafalanGuru = refreshHafalanGuru;
  window.deleteSetoranHafalanGuru = deleteSetoranHafalanGuru;
  window.closeRiwayatSetoranModal = closeRiwayatSetoranModal;
  window.showRiwayatSetoranModal = showRiwayatSetoranModal;

  try {
    delete window._hafalanGuruZiyadah;
    Object.defineProperty(window, '_hafalanGuruZiyadah', {
      get: function() { return _hafalanGuruZiyadah; },
      set: function(val) { _hafalanGuruZiyadah = val; },
      configurable: true
    });
  } catch(e) {
    window._hafalanGuruZiyadah = _hafalanGuruZiyadah;
  }

})();
