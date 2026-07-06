/**
 * murid/hafalan-module.js
 * Modul Hafalan Qiyam & Setoran Mandiri Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var HAFALAN_LEVEL = 'Level Qiyam';
  var HAFALAN_LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level Qiyam'];

  var _hafalanAllData = [];
  var _hafalanOffset = 0;
  var _hafalanFilter = 'all';

  function _isQiyam() {
    var dashData = window.dashData || null;
    return dashData && dashData.halaqah && dashData.halaqah.level === HAFALAN_LEVEL;
  }

  function loadPageHafalan() {
    var locked   = document.getElementById('hafalanLocked');
    var content  = document.getElementById('hafalanContent');
    var lockIcon = document.getElementById('sidebarHafalanLockIcon');
    var qiyamBdg = document.getElementById('sidebarQiyamBadge');

    if (_isQiyam()) {
      if (locked)   locked.style.display   = 'none';
      if (content)  content.style.display  = 'block';
      if (lockIcon) lockIcon.style.display = 'none';
      if (qiyamBdg) qiyamBdg.style.display = 'inline-block';
      _hafalanOffset  = 0;
      _hafalanAllData = [];
      loadSetoranHafalan(true);
      loadTargetHafalan();
    } else {
      if (locked)   locked.style.display  = 'block';
      if (content)  content.style.display = 'none';
      if (lockIcon) lockIcon.style.display = 'inline';
      if (qiyamBdg) qiyamBdg.style.display = 'none';
      _renderHafalanLevelPath();
    }
  }

  function _renderHafalanLevelPath() {
    var el = document.getElementById('hafalanRoadmapSteps');
    if (!el) return;
    var dashData = window.dashData || null;
    var currentLevel = (dashData && dashData.halaqah && dashData.halaqah.level) || '-';

    var levelDescs = {
      'Level 1': 'Pengenalan makhorijul huruf dan sifatnya serta melatih kelancaran membaca huruf-huruf hijaiyah tahap A.',
      'Level 2': 'Pengenalan makhorijul huruf dan sifatnya serta melatih kelancaran membaca huruf-huruf hijaiyah tahap B.',
      'Level 3': 'Melatih konsistensi bacaan, Tajwid dasar serta sifat-sifat huruf yang lebih mendalam.',
      'Level 4': 'Pematangan tajwid praktis, kelancaran tingkat lanjut, waqaf ibtida\' dan persiapan kelas tahfidz.',
      'Level Qiyam': 'Kelas setoran hafalan Al-Qur\'an reguler QIyam Bilquran.'
    };

    el.innerHTML = HAFALAN_LEVELS.map(function(lv, i) {
      var isCurrent  = lv === currentLevel;
      var isQiyam    = lv === HAFALAN_LEVEL;
      var isPast     = HAFALAN_LEVELS.indexOf(currentLevel) > i;

      var stepClass = isPast ? 'past' : isCurrent ? 'current' : 'locked';
      if (isQiyam) stepClass += ' qiyam-node';

      var nodeContent = '';
      if (isPast) nodeContent = '✓';
      else if (isQiyam) nodeContent = '🕌';
      else if (isCurrent) nodeContent = '●';
      else nodeContent = '🔒';

      var badgeText = isPast ? 'Selesai' : isCurrent ? 'Anda' : 'Terkunci';
      var badgeClass = isPast ? 'badge-past' : isCurrent ? 'badge-current' : 'badge-locked';
      if (isQiyam && !isCurrent) {
        badgeText = 'Tujuan';
        badgeClass = 'badge-qiyam';
      }

      var desc = levelDescs[lv] || '';

      return '<div class="roadmap-step ' + stepClass + '">'
        + '  <div class="roadmap-node">' + nodeContent + '</div>'
        + '  <div class="roadmap-info">'
        + '    <div class="roadmap-lv-title">'
        +        esc(lv)
        + '      <span class="roadmap-lv-badge ' + badgeClass + '">' + badgeText + '</span>'
        + '    </div>'
        + '    <div class="roadmap-lv-desc">' + esc(desc) + '</div>'
        + '  </div>'
        + '</div>';
    }).join('');

    var lvEl = document.getElementById('hafalanCurrentLevel');
    if (lvEl) lvEl.textContent = currentLevel;
  }

  async function loadTargetHafalan() {
    try {
      var res = await window.HQ.MuridAPI.getTargetHafalan();
      var t   = res.data;
      var card = document.getElementById('hafalanTargetCard');
      if (!card) return;
      if (!t || !t.target_surat) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      document.getElementById('hafalanTargetSurat').textContent = t.target_surat;
      document.getElementById('hafalanTargetAyat').innerHTML =
        '📌 Ayat <strong>' + _esc(t.target_ayat_dari) + '</strong> – <strong>' + _esc(t.target_ayat_sampai) + '</strong>';
      document.getElementById('hafalanTargetMeta').innerHTML =
        'Ditetapkan oleh <strong style="color:#93c5fd">' + _esc(t.nama_guru || 'Guru') + '</strong>'
        + ' &nbsp;·&nbsp; ' + _fmtDateHafalan(t.created_at);
    } catch(e) {
      console.warn('loadTargetHafalan:', e);
    }
  }

  async function loadSetoranHafalan(reset) {
    if (reset) { _hafalanOffset = 0; _hafalanAllData = []; }
    var el   = document.getElementById('hafalanList');
    var more = document.getElementById('hafalanLoadMore');
    var empt = document.getElementById('hafalanEmpty');
    if (!el) return;
    if (_hafalanOffset === 0) el.innerHTML = '<div style="text-align:center;padding:24px 0;color:#9ca3af;font-size:13px">⏳ Memuat...</div>';
    try {
      var res = await window.HQ.MuridAPI.getSetoranHafalan(10, _hafalanOffset);
      var list = res.data || [];
      _hafalanAllData = _hafalanAllData.concat(list);
      _hafalanOffset += list.length;
      _renderHafalanList();
      if (more) more.style.display = res.has_more ? 'block' : 'none';
      if (empt) empt.style.display = (!_hafalanAllData.length) ? 'block' : 'none';
    } catch(e) {
      if (el) el.innerHTML = '<div style="text-align:center;padding:24px 0;color:#ef4444;font-size:13px">Gagal memuat data. Coba refresh.</div>';
    }
  }

  function filterHafalan(jenis) {
    _hafalanFilter = jenis;
    document.querySelectorAll('.hflt-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-f') === jenis);
    });
    _hafalanOffset   = 0;
    _hafalanAllData  = [];
    loadSetoranHafalan(true);
  }

  function _renderHafalanList() {
    var el = document.getElementById('hafalanList');
    if (!el) return;
    var filtered = _hafalanAllData.filter(function(r) {
      if (_hafalanFilter === 'ziyadah')  return r.jenis === 'Ziyadah';
      if (_hafalanFilter === 'murajaah') return r.jenis === 'Murajaah';
      return true;
    });
    if (!filtered.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text-3);font-size:13px">Tidak ada setoran untuk kategori ini.</div>';
      return;
    }
    el.innerHTML = filtered.map(function(r) {
      var info = getNilaiBadgeInfo(r.nilai);
      var badgeHtml = '<span class="nilai-badge ' + info.cls + '">' + info.label + '</span>';
      var audioPlayerHtml = r.audio_url ? _renderAudioPlayerHtml(r.audio_url) : '';
      return '<div class="hafalan-card">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        +   '<div>'
        +     '<div style="font-weight:800;font-size:15px;color:var(--text)">QS. ' + _esc(r.surat) + '</div>'
        +     '<div style="font-size:12px;color:var(--text-3);margin-top:2px">Ayat ' + r.ayat_dari + ' – ' + r.ayat_sampai + (r.juz ? ' · Juz ' + r.juz : '') + '</div>'
        +   '</div>'
        +   badgeHtml
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:var(--text-3)">'
        +   '<span>' + _fmtDateHafalan(r.created_at) + '</span>'
        +   '<span>Disimak oleh ' + _esc(r.nama_guru || 'Guru') + '</span>'
        + '</div>'
        + audioPlayerHtml
        + '</div>';
    }).join('');
  }

  function getNilaiBadgeInfo(nilai) {
    if (!nilai) return { cls: 'b-gray', label: '—' };
    var n = String(nilai).toLowerCase();
    if (n.includes('mumtaz') || n.includes('sangat baik') || n.includes('a')) return { cls: 'b-green', label: nilai };
    if (n.includes('jayyid') || n.includes('baik') || n.includes('b')) return { cls: 'b-blue', label: nilai };
    if (n.includes('maqbul') || n.includes('c')) return { cls: 'b-amber', label: nilai };
    return { cls: 'b-gray', label: nilai };
  }

  // Safe Property Accessors
  try { delete window._hafalanAllData; Object.defineProperty(window, '_hafalanAllData', { get: function() { return _hafalanAllData; }, set: function(v) { _hafalanAllData = v; }, configurable: true }); } catch(e) { window._hafalanAllData = _hafalanAllData; }
  try { delete window._hafalanOffset; Object.defineProperty(window, '_hafalanOffset', { get: function() { return _hafalanOffset; }, set: function(v) { _hafalanOffset = v; }, configurable: true }); } catch(e) { window._hafalanOffset = _hafalanOffset; }
  try { delete window._hafalanFilter; Object.defineProperty(window, '_hafalanFilter', { get: function() { return _hafalanFilter; }, set: function(v) { _hafalanFilter = v; }, configurable: true }); } catch(e) { window._hafalanFilter = _hafalanFilter; }

  // Expose public functions to window
  window._isQiyam = _isQiyam;
  window.loadPageHafalan = loadPageHafalan;
  window._renderHafalanLevelPath = _renderHafalanLevelPath;
  window.loadTargetHafalan = loadTargetHafalan;
  window.loadSetoranHafalan = loadSetoranHafalan;
  window.filterHafalan = filterHafalan;
  window._renderHafalanList = _renderHafalanList;
  window.getNilaiBadgeInfo = getNilaiBadgeInfo;
})();
