(function() {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────────
  var _mtbData = null;
  var _expandedHq = {};
  var _mtbActiveHari = {};   // id_halaqah -> kategori ("Hari 1", dst) yang sedang dibuka

  // ── ENTRY POINT ───────────────────────────────────────────────
  async function loadMutabaah() {
    var sel = document.getElementById('mtbPeriodeSel');
    var id_periode = sel ? sel.value : 'P-DAURAH-JULI-2026';
    showLoad('Bismillah, memuat Mutaba\'ah Daurah...');
    try {
      var r = await window.HQ.AdminAPI.getMutabaahDaurah(id_periode);
      _mtbData = r.data;
      _expandedHq = {};
      _populateMtbHeatmapFilter(_mtbData.halaqahList);
      renderMutabaah(_mtbData);
    } catch(e) { toast('Gagal memuat Mutaba\'ah: ' + e.message, 'err'); }
    finally { hideLoad(); }
  }

  function renderMutabaah(d) {
    renderMeHeader(d);
    renderMeSummaryCards(d.summary, d.hariKe, d.statusDaurah);
    renderMeHalaqahTable(d.halaqahList, d.indikator);
    renderMeHeatmap(d.halaqahList, d.indikator);
    renderMeInsight(d.indikatorRanking, d.muridAlert);
  }

  // ── SECTION 1: HEADER ─────────────────────────────────────────
  function renderMeHeader(d) {
    var el = document.getElementById('mtbHeader');
    if (!el) return;
    var p = d.periode;
    var pct = Math.round((d.hariKe / 8) * 100);
    var statusBadge = d.statusDaurah === 'berlangsung'
      ? '<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,.12);color:#065f46;border:1px solid rgba(16,185,129,.25);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;animation:mtbPulse 1.5s ease-in-out infinite"></span>Sedang Berlangsung</span>'
      : d.statusDaurah === 'selesai'
        ? '<span style="background:rgba(14,165,233,.1);color:#0369a1;border:1px solid rgba(14,165,233,.2);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700">Selesai</span>'
        : '<span style="background:rgba(245,158,11,.1);color:#92400e;border:1px solid rgba(245,158,11,.2);border-radius:100px;padding:3px 12px;font-size:11.5px;font-weight:700">Belum Dimulai</span>';
    var tglStr = _fmt(p.tanggal_mulai) + ' \u2013 ' + _fmt(p.tanggal_selesai);
    el.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px">'
      + '<div>'
      +   '<div style="font-size:20px;font-weight:900;color:var(--text);margin-bottom:4px">\ud83d\udccb Mutaba\'ah \u2014 ' + esc(p.nama_periode) + '</div>'
      +   '<div style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +     '<span>\uD83D\uDCC5 ' + tglStr + '</span>'
      +     (d.statusDaurah === 'berlangsung' ? '<span>\u2022</span><span>Hari ke-<strong>' + d.hariKe + '</strong> dari 8</span>' : '')
      +     '<span>\u2022</span>' + statusBadge
      +   '</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +   '<select class="fc" id="mtbPeriodeSel" onchange="loadMutabaah()" style="max-width:220px;font-size:12px"><option value="P-DAURAH-JULI-2026">Daurah Al-Fatihah Jul 2026</option></select>'
      +   '<button class="btn btn-ghost btn-sm" onclick="loadMutabaah()" style="display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refresh</button>'
      +   '<button class="btn btn-outline btn-sm" onclick="mtbCsvExport()" style="display:flex;align-items:center;gap:6px">\uD83D\uDCE5 Export CSV</button>'
      + '</div>'
      + '</div>'
      + '<div style="background:rgba(0,0,0,.06);border-radius:100px;height:8px;overflow:hidden">'
      +   '<div style="height:8px;border-radius:100px;background:linear-gradient(90deg,#0ea5e9,#10b981);width:' + pct + '%;transition:width .6s cubic-bezier(.34,1.56,.64,1)"></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:4px;text-align:right">' + pct + '% progress (' + d.hariKe + '/8 hari)</div>';
  }

  // ── SECTION 2: SUMMARY CARDS ──────────────────────────────────
  function renderMeSummaryCards(s, hariKe, statusDaurah) {
    var el = document.getElementById('mtbSummaryCards');
    if (!el) return;
    var hariLabel = statusDaurah === 'belum' ? 'Belum Mulai' : statusDaurah === 'selesai' ? 'Selesai' : 'Hari ' + hariKe + '/8';
    var cards = [
      { ico:'\uD83E\uDDD1\u200D\uD83C\uDF93', val:s.totalPeserta,     lbl:'Total Peserta',       sub:'Murid aktif daurah',   grad:'linear-gradient(90deg,#0ea5e9,#38bdf8)',   color:'var(--blue-txt)' },
      { ico:'\uD83D\uDCC5',  val:hariLabel,           lbl:'Progress Daurah',      sub:'dari 8 hari',          grad:'linear-gradient(90deg,#8b5cf6,#a78bfa)',   color:'var(--purple-txt)' },
      { ico:'\uD83D\uDCCB',  val:s.totalSesi,         lbl:'Sesi Terlaksana',      sub:'KBM selesai',          grad:'linear-gradient(90deg,#f59e0b,#fbbf24)',   color:'var(--amber-txt)' },
      { ico:'\u2705',         val:s.avgHadir + '%',    lbl:'Rata-Rata Hadir',      sub:'Semua halaqah',        grad:'linear-gradient(90deg,#10b981,#34d399)',   color:'var(--green-txt)' },
      { ico:'\uD83C\uDFAF',  val:s.avgTajwid + '%',   lbl:'Penguasaan Tajwid',    sub:'Status guru: paham',   grad:'linear-gradient(90deg,#06b6d4,#22d3ee)',   color:'#0891b2' },
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

  // ── SECTION 3: TABEL HALAQAH EXPANDABLE ───────────────────────
  function renderMeHalaqahTable(halaqahList, indikator) {
    var el = document.getElementById('mtbTblBody');
    if (!el) return;
    if (!halaqahList.length) {
      el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada halaqah Daurah Al-Fatihah aktif</td></tr>';
      return;
    }
    el.innerHTML = halaqahList.map(function(hq) {
      var pHadir  = hq.pctHadir  >= 85 ? '#10b981' : hq.pctHadir  >= 70 ? '#f59e0b' : '#ef4444';
      var pTajwid = hq.pctTajwid >= 75 ? '#10b981' : hq.pctTajwid >= 50 ? '#f59e0b' : '#ef4444';
      var row = '<tr style="cursor:pointer" onclick="mtbTglDetail(\'' + esc(hq.id_halaqah) + '\')">'
        + '<td><span style="font-size:11px;margin-right:6px;display:inline-block;transition:transform .2s" id="mtbArr_' + esc(hq.id_halaqah) + '">\u25B6</span><strong>' + esc(hq.nama_halaqah) + '</strong></td>'
        + '<td style="color:var(--text-2);font-size:12.5px">' + esc(hq.nama_guru || '\u2014') + '</td>'
        + '<td class="align-center"><span class="badge b-blue">' + hq.murid.length + '</span></td>'
        + '<td class="align-center"><span class="badge b-gray">' + hq.sesiTerlaksana + '/8</span></td>'
        + '<td>' + _pctBar(hq.pctHadir, pHadir) + '</td>'
        + '<td>' + _pctBar(hq.pctTajwid, pTajwid) + '</td>'
        + '</tr>';
      var detail = '<tr id="mtbDetail_' + esc(hq.id_halaqah) + '" style="display:none"><td colspan="6" style="padding:0;background:rgba(14,165,233,.02)"><div id="mtbDetailInner_' + esc(hq.id_halaqah) + '" style="padding:12px 16px">' + _renderMuridDetail(hq, indikator) + '</div></td></tr>';
      return row + detail;
    }).join('');
  }

  // Kehadiran (H1-H8 + %Hadir) dan Indikator Tajwid dipisah jadi DUA tabel
  // bertumpuk (bukan satu tabel lebar) — tiap tabel jadi ringkas & tak perlu
  // saling geser horizontal untuk membaca salah satunya. Kolom Nama Murid
  // sengaja diulang di kedua tabel supaya masing-masing berdiri sendiri.
  // Kehadiran (H1-H8 + %Hadir) dan Indikator Tajwid dipisah jadi DUA tabel
  // bertumpuk (bukan satu tabel lebar) — tiap tabel jadi ringkas & tak perlu
  // saling geser horizontal untuk membaca salah satunya. Kolom Nama Murid
  // sengaja diulang di kedua tabel supaya masing-masing berdiri sendiri.
  function _renderMuridDetail(hq, indikator) {
    if (!hq.murid.length) return '<div style="padding:12px;color:var(--text-3);font-size:12px">Belum ada murid</div>';
    var sesiNums = [1,2,3,4,5,6,7,8];
    var sesiDone = {};
    hq.sesiList.forEach(function(s){ sesiDone[s.pertemuan_ke || 0] = true; });

    // ── Tabel 1: Kehadiran ──
    var hadirHdr = '<th style="font-size:10px;min-width:120px;text-align:left">Nama Murid</th>'
      + sesiNums.map(function(i){ return '<th style="font-size:10px;text-align:center;min-width:28px">H' + i + '</th>'; }).join('')
      + '<th style="font-size:10px;text-align:center">%Hadir</th>';
    var hadirBody = hq.murid.map(function(m) {
      var pctC = m.pctHadir >= 85 ? '#10b981' : m.pctHadir >= 70 ? '#f59e0b' : '#ef4444';
      var sesiCells = sesiNums.map(function(ke){
        var st = m.sesiStatus && m.sesiStatus[ke];
        if (st === 'H' || st === 'T') return '<td style="text-align:center" title="H' + ke + ': ' + (st === 'T' ? 'Terlambat' : 'Hadir') + '"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (st === 'T' ? '#f59e0b' : '#10b981') + '"></span></td>';
        if (st === 'A') return '<td style="text-align:center;color:#ef4444;font-size:11px;font-weight:800" title="H' + ke + ': Alpa">\u2717</td>';
        if (st) return '<td style="text-align:center" title="H' + ke + ': ' + esc(st) + '"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8"></span></td>';
        return sesiDone[ke]
          ? '<td style="text-align:center;color:var(--text-3);font-size:10px" title="H' + ke + ': sesi terlaksana, tanpa catatan presensi">\u00b7</td>'
          : '<td style="text-align:center;color:var(--border);font-size:10px">\u2014</td>';
      }).join('');
      return '<tr>'
        + '<td><strong style="font-size:12px">' + esc(m.nama_murid) + '</strong></td>'
        + sesiCells
        + '<td style="text-align:center"><strong style="color:' + pctC + '">' + m.pctHadir + '%</strong></td>'
        + '</tr>';
    }).join('');
    var tableHadir = '<div style="font-size:10.5px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">📅 Kehadiran</div>'
      + '<div style="overflow-x:auto;margin-bottom:18px"><table style="min-width:340px;font-size:11.5px"><thead><tr>' + hadirHdr + '</tr></thead><tbody>' + hadirBody + '</tbody></table></div>';

    if (!indikator.length) return tableHadir;

    // ── Tabel 2: Indikator Tajwid — dikelompokkan per Hari, chip buka/tutup ──
    // Total indikator bisa puluhan (8 hari × beberapa item/hari), jadi hanya
    // satu grup Hari yang ditampilkan tabelnya sekaligus; sisanya jadi chip.
    var groups = _groupIndikatorByHari(indikator);
    var activeKey = _mtbActiveHari[hq.id_halaqah] || groups[0].hari;
    var activeGroup = groups.find(function(g){ return g.hari === activeKey; }) || groups[0];

    var chipsHtml = groups.map(function(g) {
      var active = g.hari === activeGroup.hari;
      return '<button type="button" onclick="mtbToggleHari(\'' + escJs(hq.id_halaqah) + '\',\'' + escJs(g.hari) + '\')" '
        + 'style="font-size:11px;font-weight:700;padding:5px 12px;border-radius:100px;cursor:pointer;white-space:nowrap;border:1px solid ' + (active ? 'var(--blue)' : 'var(--border)') + ';background:' + (active ? 'var(--blue)' : 'transparent') + ';color:' + (active ? '#fff' : 'var(--text-2)') + '">'
        + esc(g.hari) + ' <span style="opacity:.75">(' + g.items.length + ')</span></button>';
    }).join('');

    var tableTajwid = '<div style="font-size:10.5px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">📊 Indikator Tajwid</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + chipsHtml + '</div>'
      + '<div id="mtbTajwidTblWrap_' + esc(hq.id_halaqah) + '" style="overflow-x:auto">' + _renderTajwidTable(hq, activeGroup.items) + '</div>';

    return tableHadir + tableTajwid;
  }

  // Kelompokkan indikator berdasarkan kolom kategori ("Hari 1", "Hari 2", ...).
  // Urutan grup mengikuti urutan array `indikator` — sudah diurutkan Hari lalu
  // urutan di supabase-client.js (getMutabaahDaurah/getMutabaahDaurahGuru).
  function _groupIndikatorByHari(indikator) {
    var map = {}, order = [];
    indikator.forEach(function(item) {
      var key = item.kategori || 'Lainnya';
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(item);
    });
    return order.map(function(key) { return { hari: key, items: map[key] }; });
  }

  // Render tabel Indikator Tajwid HANYA untuk himpunan `items` (satu hari).
  // m.tajwid dicocokkan via id_item (bukan asumsi urutan index) agar tetap
  // benar meski indikator ditambah/dihapus admin di tengah jalan.
  function _renderTajwidTable(hq, items) {
    var hdr = '<th style="font-size:10px;min-width:120px;text-align:left">Nama Murid</th>'
      + items.map(_indikatorTh).join('')
      + '<th style="font-size:10px;text-align:center">Aksi</th>';
    var body = hq.murid.map(function(m) {
      var tByItem = {};
      m.tajwid.forEach(function(t){ tByItem[t.id_item] = t; });
      var tajwidCells = items.map(function(item){
        var t = tByItem[item.id_item] || { nama: item.nama_item, status: null };
        var ico = t.status==='paham'?'\u2705':t.status==='ragu'?'\uD83D\uDFE1':t.status==='belum'?'\u274C':'\u26AA';
        return '<td style="text-align:center;font-size:13px" title="' + esc(t.nama) + ': ' + (t.status || 'belum dinilai') + '">' + ico + '</td>';
      }).join('');
      var waBtn = m.no_hp
        ? '<button class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a;padding:2px 8px;font-size:11px" onclick="openWAAdminAlert(\'' + escJs(m.nama_murid) + '\', \'' + escJs(m.no_hp) + '\', \'' + escJs(hq.nama_halaqah) + '\', \'' + escJs(hq.nama_guru) + '\', ' + m.pctHadir + ', ' + m.pahamCount + ', ' + m.tajwid.filter(t=>t.status==='belum').length + ')" title="Hubungi Murid via WhatsApp">💬 WA</button>'
        : '<button class="btn btn-outline btn-sm" disabled style="border-color:#cbd5e1;color:#94a3b8;cursor:not-allowed;opacity:0.6;padding:2px 8px;font-size:11px" title="No HP belum diisi">💬 WA</button>';
      return '<tr>'
        + '<td><strong style="font-size:12px">' + esc(m.nama_murid) + '</strong></td>'
        + tajwidCells
        + '<td style="text-align:center">' + waBtn + '</td>'
        + '</tr>';
    }).join('');
    return '<table style="min-width:340px;font-size:11.5px"><thead><tr>' + hdr + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  // Klik chip "Hari N" -> ganti grup aktif & render ulang HANYA panel detail
  // halaqah tsb (bukan reload data / seluruh tabel).
  function mtbToggleHari(id_halaqah, hariKey) {
    _mtbActiveHari[id_halaqah] = hariKey;
    if (!_mtbData) return;
    var hq = _mtbData.halaqahList.find(function(h){ return h.id_halaqah === id_halaqah; });
    var wrap = document.getElementById('mtbDetailInner_' + id_halaqah);
    if (!hq || !wrap) return;
    wrap.innerHTML = _renderMuridDetail(hq, _mtbData.indikator);
  }

  function mtbTglDetail(id_halaqah) {
    _expandedHq[id_halaqah] = !_expandedHq[id_halaqah];
    var row = document.getElementById('mtbDetail_' + id_halaqah);
    var arr = document.getElementById('mtbArr_' + id_halaqah);
    if (row) row.style.display = _expandedHq[id_halaqah] ? '' : 'none';
    if (arr) arr.style.transform = _expandedHq[id_halaqah] ? 'rotate(90deg)' : '';
  }

  // ── SECTION 4: HEATMAP ────────────────────────────────────────
  function renderMeHeatmap(halaqahList, indikator) {
    var wrap = document.getElementById('mtbHeatmapWrap');
    if (!wrap) return;
    if (!indikator.length) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada indikator tajwid</div>'; return; }
    var filterHq = (document.getElementById('mtbHeatmapFilter') || {}).value || '';
    var muridFlat = [];
    halaqahList.forEach(function(hq) {
      if (filterHq && hq.id_halaqah !== filterHq) return;
      hq.murid.forEach(function(m){ muridFlat.push(Object.assign({}, m, { nama_halaqah: hq.nama_halaqah })); });
    });
    if (!muridFlat.length) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada murid</div>'; return; }
    var hdr = '<tr><th style="font-size:10px;white-space:nowrap;min-width:120px">Murid</th><th style="font-size:10px;min-width:80px">Halaqah</th>'
      + indikator.map(_indikatorTh).join('')
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

  function _populateMtbHeatmapFilter(halaqahList) {
    var sel = document.getElementById('mtbHeatmapFilter');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '<option value="">— Semua Halaqah —</option>'
      + halaqahList.map(function(hq){ return '<option value="' + esc(hq.id_halaqah) + '">' + esc(hq.nama_halaqah) + '</option>'; }).join('');
    sel.value = prev;
  }

  function reloadMtbHeatmap() {
    if (!_mtbData) return;
    renderMeHeatmap(_mtbData.halaqahList, _mtbData.indikator);
  }

  // ── SECTION 5: INSIGHT ────────────────────────────────────────
  function renderMeInsight(ranking, alerts) {
    var barEl = document.getElementById('mtbBarChart');
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
    var alertEl = document.getElementById('mtbAlertList');
    if (alertEl) {
      if (!alerts.length) { alertEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12.5px">\u2705 Semua murid dalam kondisi baik</div>'; }
      else alertEl.innerHTML = alerts.map(function(m) {
        var isKritis = m.level === 'kritis';
        var border = isKritis ? '#ef4444' : '#f59e0b';
        var bg = isKritis ? 'rgba(239,68,68,.04)' : 'rgba(245,158,11,.04)';
        var ico = isKritis ? '\uD83D\uDFE5' : '\uD83D\uDFE1';
        var lemah = m.indikatorLemah.slice(0,3).join(', ') + (m.indikatorLemah.length>3?' +'+(m.indikatorLemah.length-3)+' lainnya':'');
        
        var waBtn = m.no_hp
          ? '<button class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a;margin-top:6px;font-size:11px;padding:2px 8px" onclick="openWAAdminAlert(\'' + escJs(m.nama_murid) + '\', \'' + escJs(m.no_hp) + '\', \'' + escJs(m.nama_halaqah) + '\', \'' + escJs(m.nama_guru) + '\', ' + m.pctHadir + ', ' + m.pahamCount + ', ' + m.tajwidBelum + ')" title="Hubungi via WhatsApp">💬 WA</button>'
          : '<button class="btn btn-outline btn-sm" disabled style="border-color:#cbd5e1;color:#94a3b8;cursor:not-allowed;opacity:0.6;margin-top:6px;font-size:11px;padding:2px 8px" title="No HP belum diisi">💬 WA</button>';

        return '<div style="border-left:3px solid '+border+';background:'+bg+';border-radius:0 8px 8px 0;padding:10px 12px;margin-bottom:8px">'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+ico+' <strong style="font-size:12.5px">'+esc(m.nama_murid)+'</strong> <span style="font-size:11px;color:var(--text-3)">\u2014 '+esc(m.nama_halaqah)+'</span></div>'
          + '<div style="font-size:11px;color:var(--text-2);display:flex;gap:12px;flex-wrap:wrap"><span>Hadir: <strong>'+m.pctHadir+'%</strong></span><span>Belum paham: <strong>'+m.tajwidBelum+' indikator</strong></span>'+(lemah?'<span style="color:var(--text-3)">\u26A0\uFE0F '+esc(lemah)+'</span>':'')+'</div>'
          + waBtn
          + '</div>';
      }).join('');
    }
  }

  function openWAAdminAlert(nama, hp, halaqah, guru, pctHadir, pahamCount, belumPaham) {
    var raw = String(hp || '').replace(/[^0-9]/g, '');
    if (!raw || raw.length < 9) {
      toast('Nomor HP murid ini tidak valid.', 'warn');
      return;
    }
    if (raw.startsWith('0')) raw = '62' + raw.slice(1);
    else if (!raw.startsWith('62')) raw = '62' + raw;

    var msg =
      'Assalamu\'alaikum warahmatullahi wabarakatuh, wali murid dari *' + nama + '* 🌙\n\n' +
      'Kami dari *Manajemen Rattililqur\'an* ingin menginfokan progress Daurah Al-Fatihah ananda di halaqah *' + halaqah + '* (bersama *' + guru + '*):\n' +
      '• Kehadiran: *' + pctHadir + '%*\n' +
      '• Indikator Tajwid Paham: *' + pahamCount + '*\n' +
      (belumPaham > 0 ? '• Indikator Belum Paham: *' + belumPaham + '*\n' : '') + '\n' +
      'Mohon kerja samanya untuk mendampingi ananda belajar di sisa hari daurah. Jazakumullahu khairan 🙏';

    window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
  }

  // ── EXPORT CSV ────────────────────────────────────────────────
  function mtbCsvExport() {
    if (!_mtbData) { toast('Muat data terlebih dahulu', 'warn'); return; }
    var lines = ['\uFEFF' + ['Halaqah','Guru','Nama Murid','% Hadir','Sesi Hadir','Total Sesi','% Tajwid Paham','Indikator Paham','Indikator Ragu','Indikator Belum'].join(';')];
    (_mtbData.halaqahList||[]).forEach(function(hq){
      (hq.murid||[]).forEach(function(m){
        var paham = m.tajwid.filter(function(t){ return t.status==='paham'; }).map(function(t){ return t.nama; }).join('|');
        var ragu  = m.tajwid.filter(function(t){ return t.status==='ragu';  }).map(function(t){ return t.nama; }).join('|');
        var belum = m.tajwid.filter(function(t){ return t.status==='belum'; }).map(function(t){ return t.nama; }).join('|');
        var pctT  = _mtbData.indikator.length > 0 ? Math.round(m.pahamCount / _mtbData.indikator.length * 100) : 0;
        lines.push([hq.nama_halaqah, hq.nama_guru, m.nama_murid, m.pctHadir+'%', m.hadir, m.sesiTotal, pctT+'%', paham, ragu, belum].map(function(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }).join(';'));
      });
    });
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'mutabaah-daurah-' + localDateStr() + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    toast('Export CSV berhasil', 'ok');
  }

  // ── HELPERS ───────────────────────────────────────────────────
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
  // Header kolom indikator ditulis VERTIKAL (bukan disingkat) \u2014 nama
  // indikator adalah teks bebas yang admin bisa tambah/ubah kapan saja
  // (lihat admin/konten-module.js), jadi kamus singkatan hardcoded selalu
  // basi & memotong kata sembarang begitu ada nama baru. Vertikal aman
  // untuk panjang teks berapa pun, tanpa perlu tahu isinya lebih dulu.
  function _indikatorTh(item) {
    var nama = esc(item.nama_item);
    return '<th style="min-width:28px;max-width:32px;height:140px;vertical-align:bottom;padding:4px 2px 8px;text-align:center" title="' + nama + '">'
      + '<div style="writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);white-space:nowrap;font-size:10px;font-weight:700;line-height:1;max-height:130px;overflow:hidden;margin:0 auto;display:inline-block">' + nama + '</div>'
      + '</th>';
  }

  // ── WINDOW EXPORTS ────────────────────────────────────────────
  window.loadMutabaah   = loadMutabaah;
  window.mtbTglDetail     = mtbTglDetail;
  window.mtbToggleHari    = mtbToggleHari;
  window.mtbCsvExport     = mtbCsvExport;
  window.reloadMtbHeatmap = reloadMtbHeatmap;
  window.openWAAdminAlert = openWAAdminAlert;
})();
