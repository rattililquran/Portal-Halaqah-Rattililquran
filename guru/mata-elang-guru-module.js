(function() {
  'use strict';

  var _meData = null;
  var _expandedHq = {};

  async function loadMataElangGuru() {
    var sel = document.getElementById('meGuruPeriodeseSel');
    var id_periode = sel ? sel.value : 'P-DAURAH-JULI-2026';
    showLoad('Bismillah, memuat Mata Elang Daurah...');
    try {
      var r = await window.HQ.GuruAPI.getMataElangDaurahGuru(id_periode);
      _meData = r.data;
      _expandedHq = {};
      _populateMeHeatmapFilter(_meData.halaqahList);
      renderMataElangGuru(_meData);
    } catch(e) { toast('Gagal memuat Mata Elang: ' + e.message, 'err'); }
    finally { hideLoad(); }
  }

  function renderMataElangGuru(d) {
    renderMeHeader(d);
    renderMeSummaryCards(d.summary, d.hariKe, d.statusDaurah);
    renderMeHalaqahTable(d.halaqahList, d.indikator);
    renderMeHeatmap(d.halaqahList, d.indikator);
    renderMeInsight(d.indikatorRanking, d.muridAlert);
  }

  function renderMeHeader(d) {
    var el = document.getElementById('meGuruHeader');
    if (!el) return;
    var p = d.periode;
    var pct = Math.round((d.hariKe / 8) * 100);
    var statusBadge = d.statusDaurah === 'berlangsung'
      ? '<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,.12);color:#065f46;border:1px solid rgba(16,185,129,.25);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;animation:mePulse 1.5s ease-in-out infinite"></span>Sedang Berlangsung</span>'
      : d.statusDaurah === 'selesai'
        ? '<span style="background:rgba(14,165,233,.1);color:#0369a1;border:1px solid rgba(14,165,233,.2);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700">Selesai</span>'
        : '<span style="background:rgba(245,158,11,.1);color:#92400e;border:1px solid rgba(245,158,11,.2);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700">Belum Dimulai</span>';
    var tglStr = _fmt(p.tanggal_mulai) + ' \u2013 ' + _fmt(p.tanggal_selesai);
    el.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px">'
      + '<div>'
      +   '<div style="font-size:20px;font-weight:900;color:var(--text);margin-bottom:4px">\uD83E\uDAC5 Mata Elang Daurah \u2014 ' + esc(p.nama_periode) + '</div>'
      +   '<div style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +     '<span>\uD83D\uDCC5 ' + tglStr + '</span>'
      +     (d.statusDaurah === 'berlangsung' ? '<span>\u2022</span><span>Hari ke-<strong>' + d.hariKe + '</strong> dari 8</span>' : '')
      +     '<span>\u2022</span>' + statusBadge
      +   '</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +   '<select class="fc" id="meGuruPeriodeseSel" onchange="loadMataElangGuru()" style="max-width:220px;font-size:12px"><option value="P-DAURAH-JULI-2026">Daurah Al-Fatihah Jul 2026</option></select>'
      +   '<button class="btn btn-ghost btn-sm" onclick="loadMataElangGuru()" style="display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refresh</button>'
      +   '<button class="btn btn-outline btn-sm" onclick="meGuruCsvExport()" style="display:flex;align-items:center;gap:6px">\uD83D\uDCE5 Export CSV</button>'
      + '</div>'
      + '</div>'
      + '<div style="background:rgba(0,0,0,.06);border-radius:100px;height:8px;overflow:hidden">'
      +   '<div style="height:8px;border-radius:100px;background:linear-gradient(90deg,#0ea5e9,#10b981);width:' + pct + '%;transition:width .6s cubic-bezier(.34,1.56,.64,1)"></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:4px;text-align:right">' + pct + '% progress (' + d.hariKe + '/8 hari)</div>';
  }

  function renderMeSummaryCards(s, hariKe, statusDaurah) {
    var el = document.getElementById('meGuruSummaryCards');
    if (!el) return;
    var hariLabel = statusDaurah === 'belum' ? 'Belum Mulai' : statusDaurah === 'selesai' ? 'Selesai' : 'Hari ' + hariKe + '/8';
    var cards = [
      { ico:'\uD83E\uDDD1\u200D\uD83C\uDF93', val:s.totalPeserta,     lbl:'Total Peserta Anda',  sub:'Murid aktif daurah',   grad:'linear-gradient(90deg,#0ea5e9,#38bdf8)',   color:'var(--blue-txt)' },
      { ico:'\uD83D\uDCC5',  val:hariLabel,           lbl:'Progress Daurah',      sub:'dari 8 hari',          grad:'linear-gradient(90deg,#8b5cf6,#a78bfa)',   color:'var(--purple-txt)' },
      { ico:'\uD83D\uDCCB',  val:s.totalSesi,         lbl:'Sesi Terlaksana',      sub:'KBM halaqah Anda',     grad:'linear-gradient(90deg,#f59e0b,#fbbf24)',   color:'var(--amber-txt)' },
      { ico:'\u2705',         val:s.avgHadir + '%',    lbl:'Rata-Rata Hadir',      sub:'Halaqah Anda',         grad:'linear-gradient(90deg,#10b981,#34d399)',   color:'var(--green-txt)' },
      { ico:'\uD83C\uDFAF',  val:s.avgTajwid + '%',   lbl:'Penguasaan Tajwid',    sub:'Status: paham',        grad:'linear-gradient(90deg,#06b6d4,#22d3ee)',   color:'#0891b2' },
    ];
    el.innerHTML = cards.map(function(c) {
      return '<div class="stat" style="--stat-grad:' + c.grad + ';display:flex;flex-direction:column;justify-content:space-between;text-align:left;padding:18px 16px;min-height:110px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        +   '<span style="font-size:10.5px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.8px">' + c.lbl + '</span>'
        +   '<span style="font-size:15px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + c.ico + '</span>'
        + '</div>'
        + '<div style="font-size:22px;font-weight:900;color:' + c.color + ';line-height:1.2;margin-bottom:2px">' + c.val + '</div>'
        + '<div style="font-size:11px;color:var(--text-3);font-weight:500">' + c.sub + '</div>'
        + '</div>';
    }).join('');
  }

  function renderMeHalaqahTable(halaqahList, indikator) {
    var el = document.getElementById('meGuruTblBody');
    if (!el) return;
    if (!halaqahList.length) {
      el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada halaqah Daurah Al-Fatihah aktif milik Anda</td></tr>';
      return;
    }
    el.innerHTML = halaqahList.map(function(hq) {
      var pHadir  = hq.pctHadir  >= 85 ? '#10b981' : hq.pctHadir  >= 70 ? '#f59e0b' : '#ef4444';
      var pTajwid = hq.pctTajwid >= 75 ? '#10b981' : hq.pctTajwid >= 50 ? '#f59e0b' : '#ef4444';
      var row = '<tr style="cursor:pointer" onclick="meGuruTglDetail(\'' + esc(hq.id_halaqah) + '\')">'
        + '<td><span style="font-size:11px;margin-right:6px;display:inline-block;transition:transform .2s" id="meGuruArr_' + esc(hq.id_halaqah) + '">\u25B6</span><strong>' + esc(hq.nama_halaqah) + '</strong></td>'
        + '<td class="align-center"><span class="badge b-blue">' + hq.murid.length + '</span></td>'
        + '<td class="align-center"><span class="badge b-gray">' + hq.sesiTerlaksana + '/8</span></td>'
        + '<td>' + _pctBar(hq.pctHadir, pHadir) + '</td>'
        + '<td>' + _pctBar(hq.pctTajwid, pTajwid) + '</td>'
        + '</tr>';
      var detail = '<tr id="meGuruDetail_' + esc(hq.id_halaqah) + '" style="display:none"><td colspan="5" style="padding:0;background:rgba(14,165,233,.02)"><div style="padding:12px 16px">' + _renderMuridDetail(hq, indikator) + '</div></td></tr>';
      return row + detail;
    }).join('');
  }

  function _renderMuridDetail(hq, indikator) {
    if (!hq.murid.length) return '<div style="padding:12px;color:var(--text-3);font-size:12px">Belum ada murid</div>';
    var sesiNums = [1,2,3,4,5,6,7,8];
    var sesiDone = {};
    hq.sesiList.forEach(function(s){ sesiDone[s.pertemuan_ke || 0] = true; });
    var hdrCols = '<th style="font-size:10px;min-width:120px">Nama Murid</th>'
      + sesiNums.map(function(i){ return '<th style="font-size:10px;text-align:center;min-width:28px">H' + i + '</th>'; }).join('')
      + '<th style="font-size:10px;text-align:center">%Hadir</th>'
      + indikator.map(function(item){ return '<th style="font-size:9px;text-align:center;min-width:44px;max-width:56px;white-space:normal;line-height:1.2;padding:6px 2px" title="' + esc(item.nama_item) + '">' + _shortItem(item.nama_item) + '</th>'; }).join('')
      + '<th style="font-size:10px;text-align:center">Aksi</th>';
    var body = hq.murid.map(function(m) {
      var pctC = m.pctHadir >= 85 ? '#10b981' : m.pctHadir >= 70 ? '#f59e0b' : '#ef4444';
      var sesiCells = sesiNums.map(function(ke){
        return sesiDone[ke]
          ? '<td style="text-align:center"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0ea5e9"></span></td>'
          : '<td style="text-align:center;color:var(--border);font-size:10px">\u2014</td>';
      }).join('');
      var tajwidCells = m.tajwid.map(function(t){
        var ico = t.status==='paham'?'\u2705':t.status==='ragu'?'\uD83D\uDFE1':t.status==='belum'?'\u274C':'\u26AA';
        return '<td style="text-align:center;font-size:13px" title="' + esc(t.nama) + ': ' + (t.status || 'belum dinilai') + '">' + ico + '</td>';
      }).join('');
      
      var waBtn = m.no_hp
        ? '<button class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a;padding:2px 8px;font-size:11px" onclick="openWAGuruAlert(\'' + esc(m.nama_murid) + '\', \'' + esc(m.no_hp) + '\', \'' + esc(hq.nama_halaqah) + '\', \'' + esc(hq.nama_guru) + '\', ' + m.pctHadir + ', ' + m.pahamCount + ', ' + m.tajwid.filter(t=>t.status==='belum').length + ')" title="Hubungi Murid via WhatsApp">💬 WA</button>'
        : '<button class="btn btn-outline btn-sm" disabled style="border-color:#cbd5e1;color:#94a3b8;cursor:not-allowed;opacity:0.6;padding:2px 8px;font-size:11px" title="No HP belum diisi">💬 WA</button>';

      return '<tr>'
        + '<td><strong style="font-size:12px">' + esc(m.nama_murid) + '</strong></td>'
        + sesiCells
        + '<td style="text-align:center"><strong style="color:' + pctC + '">' + m.pctHadir + '%</strong></td>'
        + tajwidCells
        + '<td style="text-align:center">' + waBtn + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="overflow-x:auto"><table style="min-width:650px;font-size:11.5px"><thead><tr>' + hdrCols + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function meGuruTglDetail(id_halaqah) {
    _expandedHq[id_halaqah] = !_expandedHq[id_halaqah];
    var row = document.getElementById('meGuruDetail_' + id_halaqah);
    var arr = document.getElementById('meGuruArr_' + id_halaqah);
    if (row) row.style.display = _expandedHq[id_halaqah] ? '' : 'none';
    if (arr) arr.style.transform = _expandedHq[id_halaqah] ? 'rotate(90deg)' : '';
  }

  function renderMeHeatmap(halaqahList, indikator) {
    var wrap = document.getElementById('meGuruHeatmapWrap');
    if (!wrap) return;
    if (!indikator.length) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada indikator tajwid</div>'; return; }
    var filterHq = (document.getElementById('meGuruHeatmapFilter') || {}).value || '';
    var muridFlat = [];
    halaqahList.forEach(function(hq) {
      if (filterHq && hq.id_halaqah !== filterHq) return;
      hq.murid.forEach(function(m){ muridFlat.push(Object.assign({}, m, { nama_halaqah: hq.nama_halaqah })); });
    });
    if (!muridFlat.length) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada murid</div>'; return; }
    var hdr = '<tr><th style="font-size:10px;white-space:nowrap;min-width:120px">Murid</th><th style="font-size:10px;min-width:80px">Halaqah</th>'
      + indikator.map(function(item){ return '<th style="font-size:9px;text-align:center;min-width:44px;max-width:56px;white-space:normal;line-height:1.2;padding:8px 4px" title="' + esc(item.nama_item) + '">' + _shortItem(item.nama_item) + '</th>'; }).join('')
      + '</tr>';
    var rows = muridFlat.map(function(m){
      var cells = m.tajwid.map(function(t){
        var bg = t.status==='paham'?'rgba(16,185,129,.85)':t.status==='ragu'?'rgba(245,158,11,.8)':t.status==='belum'?'rgba(239,68,68,.8)':'rgba(0,0,0,.06)';
        var color = t.status ? '#fff' : 'var(--text-3)';
        var ico = t.status==='paham'?'\u2713':t.status==='ragu'?'?':t.status==='belum'?'\u2717':'\u00B7';
        return '<td style="text-align:center;padding:5px 3px" title="' + esc(t.nama) + ': ' + (t.status||'belum dinilai') + '"><span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:' + bg + ';color:' + color + ';font-size:12px;font-weight:700">' + ico + '</span></td>';
      }).join('');
      return '<tr><td style="font-size:12px;font-weight:600;white-space:nowrap;padding:6px 10px">' + esc(m.nama_murid) + '</td><td style="font-size:11px;color:var(--text-3);padding:6px 8px">' + esc(m.nama_halaqah) + '</td>' + cells + '</tr>';
    }).join('');
    var footer = '<tr style="background:rgba(0,0,0,.03)"><td colspan="2" style="font-size:10px;font-weight:700;color:var(--text-2);text-transform:uppercase;padding:6px 10px">% Paham</td>'
      + indikator.map(function(item){
        var paham=0,total=0;
        muridFlat.forEach(function(m){ var t=m.tajwid.find(function(x){ return x.id_item===item.id_item; }); if(t&&t.status){total++;if(t.status==='paham')paham++;} });
        var pct=total>0?Math.round(paham/total*100):null;
        var color=pct===null?'var(--text-3)':pct>=75?'#10b981':pct>=50?'#f59e0b':'#ef4444';
        return '<td style="text-align:center;font-size:11px;font-weight:800;color:' + color + ';padding:6px 3px">' + (pct===null?'\u2014':pct+'%') + '</td>';
      }).join('') + '</tr>';
    wrap.innerHTML = '<div style="overflow-x:auto"><table style="border-collapse:collapse;min-width:400px"><thead>' + hdr + '</thead><tbody>' + rows + '</tbody><tfoot>' + footer + '</tfoot></table></div>';
  }

  function _populateMeHeatmapFilter(halaqahList) {
    var sel = document.getElementById('meGuruHeatmapFilter');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '<option value="">— Semua Halaqah —</option>'
      + halaquahList.map(function(hq){ return '<option value="' + esc(hq.id_halaqah) + '">' + esc(hq.nama_halaqah) + '</option>'; }).join('');
    sel.value = prev;
  }

  function reloadMeGuruHeatmap() {
    if (!_meData) return;
    renderMeHeatmap(_meData.halaqahList, _meData.indikator);
  }

  function renderMeInsight(ranking, alerts) {
    var barEl = document.getElementById('meGuruBarChart');
    if (barEl) {
      if (!ranking.length) { barEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada data penilaian</div>'; }
      else barEl.innerHTML = ranking.map(function(item) {
        var pct = item.pctPaham;
        var color = pct===null?'var(--border)':pct>=75?'#10b981':pct>=50?'#f59e0b':'#ef4444';
        var label = pct===null?'<span style="color:var(--text-3);font-size:11px">Belum dinilai</span>':'<span style="font-weight:800;color:'+color+'">'+pct+'%</span>';
        return '<div style="margin-bottom:12px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:12px;font-weight:600;color:var(--text-2)">'+esc(item.nama)+'</span>'+label+'</div>'
          + '<div style="height:8px;background:rgba(0,0,0,.06);border-radius:100px;overflow:hidden"><div style="height:8px;background:'+color+';border-radius:100px;width:'+(pct||0)+'%;transition:width .5s ease"></div></div>'
          + '<div style="font-size:10.5px;color:var(--text-3);margin-top:3px">\u2705 '+item.paham+' &nbsp;\uD83D\uDFE1 '+item.ragu+' &nbsp;\u274C '+item.belum+'</div>'
          + '</div>';
      }).join('');
    }
    var alertEl = document.getElementById('meGuruAlertList');
    if (alertEl) {
      if (!alerts.length) { alertEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12.5px">\u2705 Semua murid dalam kondisi baik</div>'; }
      else alertEl.innerHTML = alerts.map(function(m) {
        var isKritis = m.level === 'kritis';
        var border = isKritis ? '#ef4444' : '#f59e0b';
        var bg = isKritis ? 'rgba(239,68,68,.04)' : 'rgba(245,158,11,.04)';
        var ico = isKritis ? '\uD83D\uDFE5' : '\uD83D\uDFE1';
        var lemah = m.indikatorLemah.slice(0,3).join(', ') + (m.indikatorLemah.length>3?' +'+(m.indikatorLemah.length-3)+' lainnya':'');
        
        var waBtn = m.no_hp
          ? '<button class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a;margin-top:6px;font-size:11px;padding:2px 8px" onclick="openWAGuruAlert(\'' + esc(m.nama_murid) + '\', \'' + esc(m.no_hp) + '\', \'' + esc(m.nama_halaqah) + '\', \'' + esc(m.nama_guru) + '\', ' + m.pctHadir + ', ' + m.pahamCount + ', ' + m.tajwidBelum + ')" title="Hubungi via WhatsApp">💬 WA Guru</button>'
          : '<button class="btn btn-outline btn-sm" disabled style="border-color:#cbd5e1;color:#94a3b8;cursor:not-allowed;opacity:0.6;margin-top:6px;font-size:11px;padding:2px 8px" title="No HP belum diisi">💬 WA Guru</button>';

        return '<div style="border-left:3px solid '+border+';background:'+bg+';border-radius:0 8px 8px 0;padding:10px 12px;margin-bottom:8px">'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+ico+' <strong style="font-size:12.5px">'+esc(m.nama_murid)+'</strong> <span style="font-size:11px;color:var(--text-3)">\u2014 '+esc(m.nama_halaqah)+'</span></div>'
          + '<div style="font-size:11px;color:var(--text-2);display:flex;gap:12px;flex-wrap:wrap"><span>Hadir: <strong>'+m.pctHadir+'%</strong></span><span>Belum paham: <strong>'+m.tajwidBelum+'</strong></span>'+(lemah?'<span style="color:var(--text-3)">\u26A0\uFE0F '+esc(lemah)+'</span>':'')+'</div>'
          + waBtn
          + '</div>';
      }).join('');
    }
  }

  function openWAGuruAlert(nama, hp, halaqah, guru, pctHadir, pahamCount, belumPaham) {
    var raw = String(hp || '').replace(/[^0-9]/g, '');
    if (!raw || raw.length < 9) {
      toast('Nomor HP murid ini tidak valid.', 'warn');
      return;
    }
    if (raw.startsWith('0')) raw = '62' + raw.slice(1);
    else if (!raw.startsWith('62')) raw = '62' + raw;

    var msg =
      'Assalamu\'alaikum warahmatullahi wabarakatuh, ananda *' + nama + '* 🌙\n\n' +
      'Saya *' + (guru || 'Guru Anda') + '* dari halaqah *' + halaqah + '*.\n' +
      'Ingin memberikan update progress Daurah Al-Fatihah ananda:\n' +
      '• Kehadiran: *' + pctHadir + '%*\n' +
      '• Indikator Tajwid Paham: *' + pahamCount + '*\n' +
      (belumPaham > 0 ? '• Indikator Belum Paham: *' + belumPaham + '*\n' : '') + '\n' +
      'Mari terus bersemangat memperbaiki bacaan Al-Fatihah kita di sisa hari daurah ini. Jika ada kendala, kabari saya ya.\n\n' +
      'Jazakumullahu khairan 🙏';

    window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function meGuruCsvExport() {
    if (!_meData) { toast('Muat data terlebih dahulu', 'warn'); return; }
    var lines = ['\uFEFF' + ['Halaqah','Guru','Nama Murid','% Hadir','Sesi Hadir','Total Sesi','% Tajwid Paham','Indikator Paham','Indikator Ragu','Indikator Belum'].join(';')];
    (_meData.halaqahList||[]).forEach(function(hq){
      (hq.murid||[]).forEach(function(m){
        var paham = m.tajwid.filter(function(t){ return t.status==='paham'; }).map(function(t){ return t.nama; }).join('|');
        var ragu  = m.tajwid.filter(function(t){ return t.status==='ragu';  }).map(function(t){ return t.nama; }).join('|');
        var belum = m.tajwid.filter(function(t){ return t.status==='belum'; }).map(function(t){ return t.nama; }).join('|');
        var pctT  = _meData.indikator.length > 0 ? Math.round(m.pahamCount / _meData.indikator.length * 100) : 0;
        lines.push([hq.nama_halaqah, hq.nama_guru, m.nama_murid, m.pctHadir+'%', m.hadir, m.sesiTotal, pctT+'%', paham, ragu, belum].map(function(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }).join(';'));
      });
    });
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'mata-elang-guru-daurah-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    toast('Export CSV berhasil', 'ok');
  }

  function _fmt(tgl) {
    if (!tgl) return '';
    return new Date(tgl).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  }
  function _pctBar(pct, color) {
    return '<div style="display:flex;align-items:center;gap:8px">'
      + '<div style="width:64px;height:5px;background:rgba(0,0,0,.08);border-radius:100px;overflow:hidden"><div style="height:5px;background:'+color+';width:'+Math.min(pct,100)+'%;border-radius:100px"></div></div>'
      + '<span style="font-size:12px;font-weight:700;color:'+color+'">'+pct+'%</span>'
      + '</div>';
  }
  function _shortItem(nama) {
    var map = { 'Hamzah':'Hamzah', "A'in":"A'in", 'Ha Tipis':'Ha\u2609', 'Ha Tebal':'Ha\u25CF',
      'Nabr':'Nabr', 'Tasydid':'Nabr', 'Shad':'Shad', 'Tha':'Tha\u02BE',
      'Idzhar':'Idzhar', 'Mim':'Mim\u25CF', 'Dhad':'Dhad', 'Mad':'Mad' };
    for (var k in map) { if (nama.indexOf(k) !== -1) return map[k]; }
    return nama.length > 8 ? nama.slice(0,7) + '\u2026' : nama;
  }

  window.loadMataElangGuru   = loadMataElangGuru;
  window.meGuruTglDetail     = meGuruTglDetail;
  window.meGuruCsvExport     = meGuruCsvExport;
  window.reloadMeGuruHeatmap = reloadMeGuruHeatmap;
  window.openWAGuruAlert     = openWAGuruAlert;
})();
