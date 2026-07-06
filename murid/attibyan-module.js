/**
 * murid/attibyan-module.js
 * Modul At-Tibyan Personal & Keaktifan Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var _attibyanData = [];
  var _attibyanColumns = [];
  var _attibyanFilter = 'all';

  async function loadAtTibyan() {
    var listEl = document.getElementById('attibyanList');
    if (listEl) listEl.innerHTML = skelCards(3, 4);
    showLoad('Memuat kajian At-Tibyan...');
    try {
      var r = await window.HQ.MuridAPI.getAtTibyan();
      _attibyanData    = r.data    || [];
      _attibyanColumns = r.columns || [];

      var ptms = [];
      _attibyanData.forEach(function(row) {
        var p = String(row['pertemuan_ke'] || '').trim();
        if (p && ptms.indexOf(p) === -1) ptms.push(p);
      });
      ptms.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });

      var filterEl = document.getElementById('attibyanFilter');
      if (filterEl) {
        var pills = '<button class="atf-btn active" onclick="setAtTibyanFilter(\'all\',this)">Semua</button>';
        pills += ptms.map(function(p) {
          return '<button class="atf-btn" onclick="setAtTibyanFilter(\'' + esc(p) + '\',this)">Pertemuan ' + esc(p) + '</button>';
        }).join('');
        filterEl.innerHTML = pills;
      }

      _attibyanFilter = 'all';
      renderAtTibyan();
    } catch(e) {
      console.error('loadAtTibyan error:', e);
      if (listEl) {
        listEl.innerHTML = '<div class="empty"><div class="empty-ico">📖</div>'
          + '<div class="empty-ttl">Kajian belum tersedia</div>'
          + '<div class="empty-sub">Admin belum menambahkan data At-Tibyan</div>'
          + '<div style="margin-top:10px;font-size:11px;color:var(--red)">' + esc(friendlyError(e)) + '</div>'
          + '</div>';
      }
    } finally { hideLoad(); }
  }

  function setAtTibyanFilter(val, btn) {
    _attibyanFilter = val;
    document.querySelectorAll('.atf-btn').forEach(function(b){ b.className = 'atf-btn'; });
    if (btn) btn.className = 'atf-btn active';
    renderAtTibyan();
  }

  function _buildAtCard(row, idx) {
    var ptm   = row['pertemuan_ke'] ? ('Pertemuan ' + esc(row['pertemuan_ke'])) : ('Catatan ' + (idx + 1));
    var bab   = row['bab'] ? esc(row['bab']) : '';
    var mtr   = row['materi'] ? esc(row['materi']) : '';
    var prs   = row['presensi'] ? esc(row['presensi']) : '';
    var cat   = row['catatan_guru'] ? esc(row['catatan_guru']) : '';
    var cardId= 'atCard_' + idx;

    var badgeCls = prs.toLowerCase().indexOf('hadir') !== -1 ? 'b-green' : prs ? 'b-red' : 'b-amber';
    var badgeTxt = prs || 'Presensi Belum Ada';

    var keyValRows = _attibyanColumns.map(function(c) {
      var label = c.label || c.key;
      var val   = row[c.key];
      if (val === undefined || val === null || val === '') return '';
      return '<div class="at-kv-row">'
        + '<span class="at-kv-k">' + esc(label) + '</span>'
        + '<span class="at-kv-v">' + esc(String(val)) + '</span>'
        + '</div>';
    }).join('');

    return '<div class="at-card" id="' + cardId + '">'
      + '<div class="at-card-hdr" onclick="toggleAtCard(\'' + cardId + '\')">'
      + '<div>'
      + '<div class="at-card-ptm">' + ptm + (bab ? (' — ' + bab) : '') + '</div>'
      + (mtr ? ('<div class="at-card-mtr">' + mtr + '</div>') : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
      + '<span class="badge ' + badgeCls + '">' + badgeTxt + '</span>'
      + '<span class="at-card-chev">▼</span>'
      + '</div>'
      + '</div>'
      + '<div class="at-card-bdy">'
      + (cat ? ('<div class="at-catatan"><strong>Catatan Ust:</strong> ' + cat + '</div>') : '')
      + (keyValRows ? ('<div class="at-kv-sec">' + keyValRows + '</div>') : '')
      + '<div style="display:flex;gap:8px;margin-top:12px">'
      + '<button class="at-act-btn" onclick="copyAtTibyan(' + idx + ')">📋 Salin Ringkasan</button>'
      + '<button class="at-act-btn" onclick="shareAtTibyan(' + idx + ')">💬 Kirim ke WA</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderAtTibyan() {
    var listEl = document.getElementById('attibyanList');
    if (!listEl) return;

    var rows = _attibyanData.filter(function(row) {
      if (_attibyanFilter === 'all') return true;
      return String(row['pertemuan_ke'] || '').trim() === _attibyanFilter;
    });

    if (!rows.length) {
      listEl.innerHTML = '<div class="empty"><div class="empty-ico">📖</div>'
        + '<div class="empty-ttl">Tidak ada catatan untuk pertemuan ini</div></div>';
      return;
    }

    listEl.innerHTML = rows.map(function(r, idx) { return _buildAtCard(r, idx); }).join('');
  }

  function toggleAtCard(id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('open');
  }

  function _buildAtTibyanText(idx) {
    var row = _attibyanData[idx];
    if (!row) return '';
    var ptm = row['pertemuan_ke'] ? ('Pertemuan ' + row['pertemuan_ke']) : ('Catatan ' + (idx + 1));
    var bab = row['bab'] ? (' — ' + row['bab']) : '';
    var mtr = row['materi'] ? ('\nMateri: ' + row['materi']) : '';
    var prs = row['presensi'] ? ('\nPresensi: ' + row['presensi']) : '';
    var cat = row['catatan_guru'] ? ('\nCatatan Ust: ' + row['catatan_guru']) : '';

    var kv = _attibyanColumns.map(function(c) {
      var label = c.label || c.key;
      var val   = row[c.key];
      if (val === undefined || val === null || val === '') return '';
      return '• ' + label + ': ' + val;
    }).filter(Boolean).join('\n');

    var text = '📖 *Rangkuman At-Tibyan*\n' + ptm + bab + mtr + prs;
    if (kv)  text += '\n\n*Rincian:*\n' + kv;
    if (cat) text += '\n' + cat;
    text += '\n\n_Portal Rattililqur\'an_';
    return text;
  }

  function copyAtTibyan(idx) {
    var txt = _buildAtTibyanText(idx);
    if (!txt) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function() {
        toast('Rangkuman disalin! 📋', 'ok');
      }).catch(function() {
        _copyFallback(txt);
      });
    } else {
      _copyFallback(txt);
    }
  }

  function _copyFallback(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Rangkuman disalin! 📋', 'ok'); }
    catch(e) { toast('Gagal menyalin text', 'err'); }
    document.body.removeChild(ta);
  }

  function shareAtTibyan(idx) {
    var txt = _buildAtTibyanText(idx);
    if (!txt) return;
    var url = 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
  }

  // Safe Property Accessors
  try { delete window._attibyanData; Object.defineProperty(window, '_attibyanData', { get: function() { return _attibyanData; }, set: function(v) { _attibyanData = v; }, configurable: true }); } catch(e) { window._attibyanData = _attibyanData; }
  try { delete window._attibyanColumns; Object.defineProperty(window, '_attibyanColumns', { get: function() { return _attibyanColumns; }, set: function(v) { _attibyanColumns = v; }, configurable: true }); } catch(e) { window._attibyanColumns = _attibyanColumns; }
  try { delete window._attibyanFilter; Object.defineProperty(window, '_attibyanFilter', { get: function() { return _attibyanFilter; }, set: function(v) { _attibyanFilter = v; }, configurable: true }); } catch(e) { window._attibyanFilter = _attibyanFilter; }

  // Expose public functions to window
  window.loadAtTibyan = loadAtTibyan;
  window.setAtTibyanFilter = setAtTibyanFilter;
  window._buildAtCard = _buildAtCard;
  window.renderAtTibyan = renderAtTibyan;
  window.toggleAtCard = toggleAtCard;
  window._buildAtTibyanText = _buildAtTibyanText;
  window.copyAtTibyan = copyAtTibyan;
  window._copyFallback = _copyFallback;
  window.shareAtTibyan = shareAtTibyan;
})();
