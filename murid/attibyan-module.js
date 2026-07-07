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
    document.querySelectorAll('#attibyanFilter .atf-btn').forEach(function(b){
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
    renderAtTibyan();
  }

  function _buildAtCard(row, idx) {
    var ptm   = row['pertemuan_ke'] ? ('Pertemuan ' + esc(row['pertemuan_ke'])) : ('Catatan ' + (idx + 1));
    var bab   = row['bab'] ? esc(row['bab']) : '';
    var mtr   = row['materi'] ? esc(row['materi']) : '';
    var prs   = row['presensi'] ? esc(row['presensi']) : '';
    var cat   = row['catatan_guru'] ? esc(row['catatan_guru']) : '';
    var cardId= 'atCard_' + idx;

    var lowerPrs = prs.toLowerCase();
    var badgeCls = lowerPrs.indexOf('hadir') !== -1 ? 'b-green' :
                   (lowerPrs.indexOf('belum') !== -1 || !prs) ? 'b-amber' : 'b-red';
    var badgeTxt = prs || 'Presensi Belum Ada';

    var keyValRows = _attibyanColumns.map(function(c) {
      var key   = typeof c === 'object' && c !== null ? c.key : c;
      var label = typeof c === 'object' && c !== null ? (c.label || c.key) : c;
      var val   = row[key];
      if (val === undefined || val === null || val === '') return '';
      if (['pertemuan_ke', 'presensi', 'bab', 'catatan_guru', 'materi'].indexOf(key) !== -1) return '';
      
      // Clean label (e.g., materi_pembahasan -> Materi Pembahasan)
      var cleanLabel = label.split('_').map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ');

      return '<div class="at-field">'
        + '  <div class="at-field-label">' + esc(cleanLabel) + '</div>'
        + '  <div class="at-field-val">' + esc(String(val)) + '</div>'
        + '</div>';
    }).join('');

    var catHtml = cat ? '<div class="at-field"><div class="at-field-label">Catatan Ustadz</div><div class="at-field-val" style="background:var(--bg-2); padding:10px 12px; border-radius:8px; border-left:3px solid var(--blue); font-style:italic;">' + cat + '</div></div>' : '';

    return '<div class="at-card" id="' + cardId + '">'
      + '  <div class="at-card-head" onclick="toggleAtCard(\'' + cardId + '\')">'
      + '    <div>'
      + '      <div class="at-card-title">' + ptm + (bab ? (' — ' + bab) : '') + '</div>'
      + (mtr ? ('      <div style="font-size:12px; color:var(--text-3); margin-top:2.5px; font-weight:500;">' + mtr + '</div>') : '')
      + '    </div>'
      + '    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      + '      <span class="badge ' + badgeCls + '">' + badgeTxt + '</span>'
      + '      <span class="at-card-chevron">▼</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="at-card-body">'
      + keyValRows
      + catHtml
      + '    <div class="at-actions">'
      + '      <button class="at-btn at-btn-copy" onclick="copyAtTibyan(' + idx + ')">📋 Salin Ringkasan</button>'
      + '      <button class="at-btn at-btn-share" onclick="shareAtTibyan(' + idx + ')">💬 Kirim ke WA</button>'
      + '    </div>'
      + '  </div>'
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
    if (el) {
      el.classList.toggle('expanded');
    }
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

  async function switchAtMuridTab(tabName, btn) {
    document.querySelectorAll('#atTabBar .atf-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    var panelKajian = document.getElementById('atPanelKajian');
    var panelKehadiran = document.getElementById('atPanelKehadiran');
    if (tabName === 'kajian') {
      if (panelKajian) panelKajian.style.display = 'block';
      if (panelKehadiran) panelKehadiran.style.display = 'none';
    } else {
      if (panelKajian) panelKajian.style.display = 'none';
      if (panelKehadiran) panelKehadiran.style.display = 'block';
      await loadAtTibyanKehadiran();
    }
  }

  async function loadAtTibyanKehadiran() {
    var contentEl = document.getElementById('atKehadiranContent');
    if (!contentEl) return;
    
    contentEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);">Memuat data kehadiran At-Tibyan...</div>';
    
    try {
      var r = await window.HQ.MuridAPI.getAtTibyanMurid();
      if (r.status !== 'ok') {
        throw new Error(r.message || 'Gagal memuat');
      }
      
      var logs = r.data || [];
      var summary = r.summary || { hadir: 0, total: 0, pct: 0 };
      
      var html = '';
      
      // 1. Stats Summary Card
      html += '<div class="partner-dash-card" style="background:linear-gradient(135deg, rgba(34,197,94,.12), rgba(21,128,61,.06)); border:1.5px solid rgba(74,222,128,.25); margin-bottom:20px; padding:16px; border-radius:12px;">'
        + '  <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:12px; display:flex; align-items:center; gap:6px;">Ringkasan Kehadiran</div>'
        + '  <div style="display:flex; justify-content:space-between; align-items:center;">'
        + '    <div>'
        + '      <div style="font-size:28px; font-weight:800; color:var(--green); line-height:1;">' + summary.pct + '%</div>'
        + '      <div style="font-size:12px; color:var(--text-3); margin-top:4px;">Persentase Kehadiran</div>'
        + '    </div>'
        + '    <div style="text-align:right;">'
        + '      <div style="font-size:18px; font-weight:700; color:var(--text);">' + summary.hadir + ' <span style="font-size:13px; font-weight:500; color:var(--text-3);">dari</span> ' + summary.total + ' <span style="font-size:13px; font-weight:500; color:var(--text-3);">sesi</span></div>'
        + '      <div style="font-size:12px; color:var(--text-3); margin-top:4px;">Total Kehadiran</div>'
        + '    </div>'
        + '  </div>'
        + '  <div style="height:6px; background:var(--border); border-radius:100px; margin-top:16px; overflow:hidden;">'
        + '    <div style="height:100%; background:var(--green); width:' + summary.pct + '%; border-radius:100px; transition:width 0.5s ease;"></div>'
        + '  </div>'
        + '</div>';
        
      // 2. History List
      html += '<div style="font-size:13px; font-weight:700; color:var(--text-2); margin-bottom:12px;">🗓️ Riwayat Sesi</div>';
      
      if (logs.length === 0) {
        html += '<div class="empty" style="padding:30px;"><div class="empty-ico">📋</div><div class="empty-ttl">Belum ada riwayat presensi</div></div>';
      } else {
        html += '<div style="display:flex; flex-direction:column; gap:10px;">';
        logs.forEach(function(l) {
          var ptm = l.pertemuan_ke ? 'Pertemuan ' + l.pertemuan_ke : 'Pertemuan Tidak Diketahui';
          var dateTxt = l.tanggal ? fmtDate(l.tanggal) : 'Tanggal -';
          
          var sh = l.status_hadir;
          var badgeCls = 'b-amber';
          var statusTxt = 'Presensi Belum Ada';
          if (sh === 'H') { badgeCls = 'b-green'; statusTxt = 'Hadir'; }
          else if (sh === 'T') { badgeCls = 'b-green'; statusTxt = 'Terlambat'; }
          else if (sh === 'I') { badgeCls = 'b-amber'; statusTxt = 'Izin'; }
          else if (sh === 'A') { badgeCls = 'b-red'; statusTxt = 'Alpa'; }
          
          html += '<div class="at-card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:12px; background:var(--card-solid); margin-bottom: 0;">'
            + '  <div>'
            + '    <div style="font-weight:700; font-size:13.5px; color:var(--text);">' + ptm + '</div>'
            + '    <div style="font-size:11.5px; color:var(--text-3); margin-top:2px;">📅 ' + dateTxt + '</div>'
            + '  </div>'
            + '  <span class="badge ' + badgeCls + '">' + statusTxt + '</span>'
            + '</div>';
        });
        html += '</div>';
      }
      
      contentEl.innerHTML = html;
    } catch(e) {
      console.error('loadAtTibyanKehadiran error:', e);
      contentEl.innerHTML = '<div class="empty" style="padding:30px;"><div class="empty-ico">⚠️</div><div class="empty-ttl">Gagal memuat data</div><div class="empty-sub">' + esc(friendlyError(e)) + '</div></div>';
    }
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
  window.switchAtMuridTab = switchAtMuridTab;
  window.loadAtTibyanKehadiran = loadAtTibyanKehadiran;
})();
