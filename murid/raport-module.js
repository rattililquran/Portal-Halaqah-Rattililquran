/**
 * murid/raport-module.js
 * Modul Raport Tahfidz, Rincian Nilai, & PDF Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var _myRtPeriodeLoaded = false;
  var _myRtPeriodeList = [];
  var _myRtCachedData = null;

  async function _initMyRaportPanel() {
    if (_myRtPeriodeLoaded) return;
    _myRtPeriodeLoaded = true;
    try {
      var r = await window.HQ.MuridAPI.getSetoranHafalan(1, 0);
      var { data } = await window.HQ.supabase.from('periode').select('id_periode,nama_periode,tanggal_mulai,tanggal_selesai').order('created_at',{ascending:false});
      var pSel = document.getElementById('myRtPeriodeSel');
      if (pSel) {
        pSel.innerHTML = '<option value="semua">Semua Waktu</option>'
          + (data||[]).map(function(p){ return '<option value="'+esc(p.id_periode)+'">'+esc(p.nama_periode)+'</option>'; }).join('');
        
        if (data && data.length > 0) {
          pSel.value = data[0].id_periode;
        } else {
          pSel.value = 'semua';
        }
      }
      await loadMyRaportTahfidz();
    } catch(e) {}
  }

  async function loadMyRaportTahfidz() {
    var pSel  = document.getElementById('myRtPeriodeSel');
    var pVal  = pSel ? pSel.value : 'semua';
    var loading = document.getElementById('myRtLoading');
    var content = document.getElementById('myRtContent');
    if (loading) loading.style.display = 'block';
    if (content) content.innerHTML = '';

    try {
      var tglMulai = null, tglSelesai = null;
      if (pVal !== 'semua') {
        var { data: pData } = await window.HQ.supabase.from('periode').select('*').eq('id_periode', pVal).maybeSingle();
        if (pData) { tglMulai = pData.tanggal_mulai; tglSelesai = pData.tanggal_selesai; }
      }
      var [resSetoran, resCfg] = await Promise.all([
        window.HQ.MuridAPI.getMyRaportTahfidz(tglMulai, tglSelesai),
        window.HQ.GuruAPI.getPenilaianHafalan(),
      ]);
      var setoran = resSetoran.data || [];
      var cfg     = resCfg.data || { kelancaran: [], nilai: [] };

      if (!setoran.length) {
        if (content) content.innerHTML = '<div style="text-align:center;padding:32px;color:#9ca3af"><div style="font-size:36px;margin-bottom:8px">📭</div><div style="font-size:13px;font-weight:700">Belum ada setoran di periode ini</div></div>';
        if (loading) loading.style.display = 'none';
        return;
      }

      var r = _myRtBuild(setoran, cfg);
      if (content) content.innerHTML = _myRtRenderHTML(r, pVal === 'semua' ? 'Semua Waktu' : (pSel.options[pSel.selectedIndex] || {}).text || '');
    } catch(e) {
      if (content) content.innerHTML = '<div style="text-align:center;padding:24px;color:#ef4444;font-size:12px">Gagal memuat raport: '+esc(friendlyError(e))+'</div>';
    }
    if (loading) loading.style.display = 'none';
  }

  function _myRtHitungPoin(nilai, kelancaran, cfg) {
    var mappedNilai = nilai;
    if (nilai === 'Mumtaz') mappedNilai = 'A';
    else if (nilai === 'Baik') mappedNilai = 'B';
    else if (nilai === 'Cukup') mappedNilai = 'C';
    var kObj = (cfg.kelancaran || []).find(function(k){ return k.label === kelancaran; }) || { poin: 0 };
    var nObj = (cfg.nilai || []).find(function(n){ return n.label === mappedNilai; }) || { poin: 0 };
    return (kObj.poin || 0) + (nObj.poin || 0);
  }

  function _myRtBuild(setoran, cfg) {
    var totalPoin = 0, nA = 0, nB = 0, nC = 0;
    var kelLancar = 0, kelCukup = 0, kelPerbaikan = 0;
    var jenisCnt = { Ziyadah: 0, Murajaah: 0, Tahsin: 0 };
    var bulananMap = {}, juzMap = {}, suratMap = {};
    var juzDetails = {};

    setoran.forEach(function(s) {
      var poin = _myRtHitungPoin(s.nilai, s.kelancaran, cfg);
      totalPoin += poin;
      
      var vNil = String(s.nilai || '').trim();
      if (vNil === 'A' || vNil === 'Mumtaz') nA++;
      else if (vNil === 'B' || vNil === 'Baik') nB++;
      else if (vNil === 'C' || vNil === 'Cukup') nC++;
      
      var vKel = String(s.kelancaran || '').trim();
      if (vKel === 'Lancar') kelLancar++;
      else if (vKel === 'Cukup') kelCukup++;
      else if (vKel === 'Perlu Perbaikan') kelPerbaikan++;

      jenisCnt[s.jenis] = (jenisCnt[s.jenis]||0) + 1;

      var d = new Date(s.created_at);
      var bk = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      if (!bulananMap[bk]) bulananMap[bk] = { label: d.toLocaleDateString('id-ID',{month:'short',year:'numeric'}), poin: 0, count: 0 };
      bulananMap[bk].poin += poin; bulananMap[bk].count++;

      var juz = parseInt(s.juz)||0;
      if (juz) { 
        if (!juzMap[juz]) juzMap[juz]={count:0,poin:0}; 
        juzMap[juz].count++; 
        juzMap[juz].poin+=poin; 
        
        if (!juzDetails[juz]) juzDetails[juz]=[];
        var ayatStr = (s.ayat_mulai && s.ayat_selesai) ? s.ayat_mulai + ' - ' + s.ayat_selesai : s.ayat_mulai || s.ayat_selesai || '-';
        if (ayatStr === '-') {
          ayatStr = (s.ayat_dari && s.ayat_sampai) ? s.ayat_dari + ' - ' + s.ayat_sampai : s.ayat_dari || s.ayat_sampai || '-';
        }
        juzDetails[juz].push({
          surat: s.surat || '-',
          ayat: ayatStr,
          tanggal: d.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}),
          nilai: s.nilai || '-',
          kelancaran: s.kelancaran || '-',
          jenis: s.jenis || '-',
          poin: poin
        });
      }

      if (s.surat) {
        if (!suratMap[s.surat]) suratMap[s.surat]={surat:s.surat,juz:s.juz,count:0,nilai_list:[],poin:0};
        suratMap[s.surat].count++; suratMap[s.surat].nilai_list.push(s.nilai); suratMap[s.surat].poin+=poin;
      }
    });

    var badgeName = '📖 Pemula';
    var nextBadgeName = '🥉 Hafizh Pemula';
    var currentMin = 0;
    var nextTarget = 500;
    
    if (totalPoin >= 5000) {
      badgeName = '🏆 Bintang Tahfidz';
      nextBadgeName = 'Tingkat Maksimal';
      currentMin = 5000;
      nextTarget = 5000;
    } else if (totalPoin >= 2000) {
      badgeName = '🥇 Hafizh Teladan';
      nextBadgeName = '🏆 Bintang Tahfidz';
      currentMin = 2000;
      nextTarget = 5000;
    } else if (totalPoin >= 1000) {
      badgeName = '🥈 Hafizh Berkembang';
      nextBadgeName = '🥇 Hafizh Teladan';
      currentMin = 1000;
      nextTarget = 2000;
    } else if (totalPoin >= 500) {
      badgeName = '🥉 Hafizh Pemula';
      nextBadgeName = '🥈 Hafizh Berkembang';
      currentMin = 500;
      nextTarget = 1000;
    }
    
    var pctProgress = nextTarget === currentMin ? 100 : Math.min(100, Math.round(((totalPoin - currentMin) / (nextTarget - currentMin)) * 100));
    var sisaPoin = nextTarget - totalPoin;
    var fluencyScore = setoran.length ? Math.round((nA * 100 + nB * 75 + nC * 50) / setoran.length) : 0;

    return {
      totalSetoran: setoran.length, totalPoin, badge: badgeName,
      nextBadge: nextBadgeName, pctProgress, sisaPoin, fluencyScore,
      nA, nB, nC,
      kelLancar, kelCukup, kelPerbaikan,
      jenisCnt,
      bulanan: Object.keys(bulananMap).sort().map(function(k){ return Object.assign({key:k},bulananMap[k]); }),
      juzMap,
      juzDetails,
      suratList: Object.values(suratMap).sort(function(a,b){ return (a.juz-b.juz)||a.surat.localeCompare(b.surat); }),
    };
  }

  function _myRtRenderHTML(r, periodeTxt) {
    _myRtCachedData = r;

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">'
      + '<div style="font-size:12px;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em">📊 Raport Tahfidz — ' + esc(periodeTxt) + '</div>'
      + '<button onclick="downloadMyRtPDF()" style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:6px 14px;font-size:11.5px;font-weight:800;cursor:pointer;transition:opacity .2s" onmouseover="this.style.opacity=.9" onmouseout="this.style.opacity=1">'
        + '📥 Unduh PDF'
      + '</button>'
    + '</div>';

    html += '<div class="myrt-glass-card">'
      + '<div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;color:#fbbf24">🏆 Lencana Tahfidz</div>'
      + '<div class="myrt-badge-container">'
        + '<div class="myrt-badge-img">' + (r.badge.includes('Bintang') ? '🏆' : r.badge.includes('Teladan') ? '🥇' : r.badge.includes('Berkembang') ? '🥈' : r.badge.includes('Pemula') ? '🥉' : '📖') + '</div>'
        + '<div class="myrt-badge-info">'
          + '<div class="myrt-badge-title">' + esc(r.badge) + '</div>'
          + '<div class="myrt-badge-next">' + (r.nextBadge === 'Tingkat Maksimal' ? 'Tingkat Maksimal tercapai!' : 'Target: <b>' + r.nextBadge + '</b> (' + r.sisaPoin + ' Poin lagi)') + '</div>'
          + '<div class="myrt-progress-track">'
            + '<div class="myrt-progress-bar" style="width:' + r.pctProgress + '%"></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:12px">'
        + '<div><div style="font-size:18px;font-weight:900;color:#fff">' + r.totalSetoran + '</div><div style="font-size:9.5px;color:rgba(255,255,255,0.7);font-weight:700;text-transform:uppercase">Total Setoran</div></div>'
        + '<div><div style="font-size:18px;font-weight:900;color:#fff">' + r.totalPoin + '</div><div style="font-size:9.5px;color:rgba(255,255,255,0.7);font-weight:700;text-transform:uppercase">Total Poin</div></div>'
      + '</div>'
    + '</div>';

    var totalSetoran = r.totalSetoran || 0;
    var ziyadahVal = r.jenisCnt['Ziyadah'] || 0;
    var murajaahVal = r.jenisCnt['Murajaah'] || 0;
    var zPct = totalSetoran ? Math.round((ziyadahVal / totalSetoran) * 100) : 0;
    var mPct = totalSetoran ? 100 - zPct : 0;
    
    var circ = 100.5;
    var zDash = Math.round((zPct / 100) * circ);
    var mDash = circ - zDash;

    // Donut Card
    html += '<div class="myrt-card">'
      + '<div style="font-size:11px;font-weight:800;color:var(--amber-txt);margin-bottom:16px;text-transform:uppercase;letter-spacing:.06em">📈 Analisis & Kelancaran</div>'
      + '<div style="display:flex;gap:16px;align-items:center;justify-content:space-around;flex-wrap:wrap">'
        
        // Donut 1: Rasio Kelancaran
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">'
          + '<div style="position:relative;width:80px;height:80px">'
            + '<svg viewBox="0 0 40 40" style="width:100%;height:100%;transform:rotate(-90deg)">'
              + '<circle cx="20" cy="20" r="16" fill="none" stroke="var(--border)" stroke-width="4.5"/>'
              + '<circle cx="20" cy="20" r="16" fill="none" stroke="url(#myrt-glow-grad)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="' + (100.5 - (r.fluencyScore / 100) * 100.5) + '" style="transition: stroke-dashoffset 0.8s ease"/>'
            + '</svg>'
            + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1">'
              + '<span style="font-size:14px;font-weight:900;color:var(--text)">' + r.fluencyScore + '%</span>'
            + '</div>'
          + '</div>'
          + '<div style="font-size:11px;font-weight:800;color:var(--text)">Rasio Kelancaran</div>'
        + '</div>'

        // Donut 2: Komposisi Setoran
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">'
          + '<div style="position:relative;width:80px;height:80px">'
            + '<svg viewBox="0 0 40 40" style="width:100%;height:100%;transform:rotate(-90deg)">'
              + '<circle cx="20" cy="20" r="16" fill="none" stroke="var(--border)" stroke-width="4.5"/>'
              + '<circle cx="20" cy="20" r="16" fill="none" stroke="#10b981" stroke-width="4.5" stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ - zDash) + '" style="transition: stroke-dashoffset 0.8s ease"/>'
              + '<circle cx="20" cy="20" r="16" fill="none" stroke="#3b82f6" stroke-width="4.5" stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ - mDash) + '" transform="rotate(' + (zPct * 3.6) + ' 20 20)" style="transition: stroke-dashoffset 0.8s ease"/>'
            + '</svg>'
            + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1">'
              + '<span style="font-size:14px;font-weight:900;color:var(--text)">' + r.totalSetoran + '</span>'
              + '<span style="font-size:7.5px;font-weight:700;color:var(--text-3);text-transform:uppercase">Setoran</span>'
            + '</div>'
          + '</div>'
          + '<div style="font-size:11px;font-weight:800;color:var(--text)">Komposisi Setoran</div>'
        + '</div>'

      + '</div>'

      + '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--amber-txt);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Kategori Setoran</div>'
        + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="width:8px;height:8px;border-radius:50%;background:#10b981"></div>'
            + '<div style="flex:1"><div style="font-size:11.5px;font-weight:800;color:var(--text)">Ziyadah</div><div style="font-size:9.5px;color:var(--text-3)">' + ziyadahVal + ' setoran (' + zPct + '%)</div></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="width:8px;height:8px;border-radius:50%;background:#3b82f6"></div>'
            + '<div style="flex:1"><div style="font-size:11.5px;font-weight:800;color:var(--text)">Murajaah</div><div style="font-size:9.5px;color:var(--text-3)">' + murajaahVal + ' setoran (' + mPct + '%)</div></div>'
          + '</div>'
        + '</div>'
      + '</div>'

      + '<div style="margin-top:12px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--amber-txt);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Detail Kualitas Nilai</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#2563eb;width:16px;text-align:center">A</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Mumtaz</div><div style="font-size:9.5px;color:var(--text-3)">' + r.nA + ' setoran</div></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#059669;width:16px;text-align:center">B</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Baik</div><div style="font-size:9.5px;color:var(--text-3)">' + r.nB + ' setoran</div></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#d97706;width:16px;text-align:center">C</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Cukup</div><div style="font-size:9.5px;color:var(--text-3)">' + r.nC + ' setoran</div></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin-top:12px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--amber-txt);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Statistik Kelancaran</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#047857;width:16px;text-align:center">🟢</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Lancar</div><div style="font-size:9.5px;color:var(--text-3)">' + (r.kelLancar || 0) + ' setoran</div></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#b45309;width:16px;text-align:center">🟡</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Cukup</div><div style="font-size:9.5px;color:var(--text-3)">' + (r.kelCukup || 0) + ' setoran</div></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px">'
            + '<div style="font-size:11px;font-weight:800;color:#b91c1c;width:16px;text-align:center">🔴</div>'
            + '<div style="flex:1"><div style="font-size:11px;font-weight:800;color:var(--text)">Perbaikan</div><div style="font-size:9.5px;color:var(--text-3)">' + (r.kelPerbaikan || 0) + ' setoran</div></div>'
          + '</div>'
        + '</div>'
      + '</div>'
    + '</div>';

    if (r.bulanan.length > 0) {
      var maxP = Math.max.apply(null, r.bulanan.map(function(b){ return b.poin; }))||1;
      var gridMax = Math.ceil(maxP / 100) * 100;
      if (gridMax === 0) gridMax = 100;

      html += '<div class="myrt-card">'
        + '<div style="font-size:11px;font-weight:800;color:var(--amber-txt);margin-bottom:14px;text-transform:uppercase;letter-spacing:.06em">📊 Tren Perkembangan Poin</div>'
        + '<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:140px;margin-top:8px">';
      
      html += '<defs>'
        + '<linearGradient id="chart-bar-grad" x1="0%" y1="0%" x2="0%" y2="100%">'
          + '<stop offset="0%" stop-color="#10b981"/>'
          + '<stop offset="100%" stop-color="#3b82f6"/>'
        + '</linearGradient>'
        + '</defs>';

      // Solid X & Y axes for clear definition
      html += '<line x1="30" y1="15" x2="30" y2="80" stroke="var(--text-3)" stroke-width="0.75"/>'
        + '<line x1="30" y1="80" x2="290" y2="80" stroke="var(--text-3)" stroke-width="0.75"/>';

      // Axis titles
      html += '<text x="25" y="12" font-size="5" fill="var(--text-3)" font-weight="800" text-anchor="end">Poin</text>'
        + '<text x="290" y="87" font-size="5" fill="var(--text-3)" font-weight="800" text-anchor="end">Bulan</text>';

      var gridY = [20, 50, 80];
      var gridLabels = [gridMax, Math.round(gridMax/2), 0];
      gridY.forEach(function(gy, gi) {
        // Dotted horizontal grid line (skip y=80 as we have the solid axis line there)
        if (gy !== 80) {
          html += '<line x1="30" y1="' + gy + '" x2="290" y2="' + gy + '" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>';
        }
        // Y tick mark
        html += '<line x1="27" y1="' + gy + '" x2="30" y2="' + gy + '" stroke="var(--text-3)" stroke-width="0.5"/>'
          + '<text x="23" y="' + (gy + 2) + '" font-size="6" fill="var(--text-3)" text-anchor="end">' + gridLabels[gi] + '</text>';
      });

      var bW = Math.max(12, Math.floor(200/r.bulanan.length)-6);
      r.bulanan.forEach(function(b,i) {
        var barMaxH = 60;
        var bH = Math.max(4, Math.round(barMaxH * b.poin / gridMax));
        var x  = 35 + i * (250 / r.bulanan.length) + (250 / r.bulanan.length - bW) / 2;
        var y  = 80 - bH;
        
        html += '<rect x="'+x+'" y="'+y+'" width="'+bW+'" height="'+bH+'" rx="4" fill="url(#chart-bar-grad)"/>'
          + '<text x="'+(x+bW/2)+'" y="'+(y-3)+'" text-anchor="middle" font-size="7" fill="var(--text)" font-weight="800">'+b.poin+'</text>'
          + '<text x="'+(x+bW/2)+'" y="92" text-anchor="middle" font-size="6.5" fill="var(--text-3)" font-weight="600">'+b.label+'</text>'
          // X tick mark
          + '<line x1="'+(x+bW/2)+'" y1="80" x2="'+(x+bW/2)+'" y2="83" stroke="var(--text-3)" stroke-width="0.5"/>';
      });
      html += '</svg>'
        + '<div style="font-size:10.5px;color:var(--text-2);margin-top:12px;line-height:1.45;background:var(--bg-2);padding:10px 12px;border-radius:10px;border-left:3px solid var(--amber)">'
          + '💡 <b>Penjelasan Grafik:</b> Tren Perkembangan Poin menunjukkan keaktifan dan kualitas setoran hafalan Anda tiap bulan. Poin diperoleh dari volume baris/ayat setoran dan kualitas nilai kelancaran (Grade A mendapat poin lebih tinggi dibanding B dan C). Kenaikan grafik menandakan volume setoran yang meningkat atau tingkat kelancaran yang lebih baik.'
        + '</div>'
        + '</div>';
    }

    html += '<div class="myrt-card">'
      + '<div style="font-size:11px;font-weight:800;color:var(--amber-txt);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">🗺️ Peta Kematangan Juz</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:14px;line-height:1.3">Kotak mewakili Juz 1-30. Klik kotak Juz untuk melihat detail surah & ayat yang disetorkan.</div>'
      + '<div class="myrt-juz-grid">';
    var maxJuzCount = Math.max.apply(null, Object.values(r.juzMap).map(function(j){ return j.count; }).concat([1]));
    
    for (var juz = 1; juz <= 30; juz++) {
      var info = r.juzMap[juz];
      var cnt  = info ? info.count : 0;
      var alpha = cnt ? Math.max(0.2, cnt/maxJuzCount) : 0;
      
      var isDark = document.documentElement.classList.contains('theme-dark');
      var bg, clr;
      
      if (cnt) {
        bg = isDark ? 'rgba(56,189,248,'+alpha.toFixed(2)+')' : 'rgba(29,78,216,'+alpha.toFixed(2)+')';
        clr = alpha > 0.4 ? '#fff' : isDark ? '#38bdf8' : '#1e40af';
      } else {
        bg = isDark ? '#252830' : '#f3f4f6';
        clr = isDark ? '#4b5563' : '#d1d5db';
      }

      html += '<div class="myrt-juz-cell" style="background:'+bg+';color:'+clr+'" onclick="showMyRtJuzDetail('+juz+')" title="Juz '+juz+(cnt?' ('+cnt+' setoran)':'')+'">'
        + juz + (cnt ? '<span style="position:absolute;top:2px;right:3px;font-size:7px;font-weight:800">'+cnt+'</span>' : '')
      + '</div>';
    }
    html += '</div></div>';

    if (r.suratList.length) {
      html += '<div class="myrt-card">'
        + '<div style="font-size:11px;font-weight:800;color:var(--amber-txt);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">📜 Riwayat Per Surat</div>'
        + r.suratList.map(function(s,i) {
            var best = 'Cukup (C)';
            if (s.nilai_list.includes('A') || s.nilai_list.includes('Mumtaz')) best = 'Mumtaz (A)';
            else if (s.nilai_list.includes('B') || s.nilai_list.includes('Baik')) best = 'Baik (B)';

            var nc;
            var isDark = document.documentElement.classList.contains('theme-dark');
            if (isDark) {
              nc = {
                'Mumtaz (A)': 'background:rgba(59,130,246,0.15);color:#60a5fa',
                'Baik (B)': 'background:rgba(16,185,129,0.15);color:#34d399',
                'Cukup (C)': 'background:rgba(245,158,11,0.15);color:#fbbf24'
              };
            } else {
              nc = {
                'Mumtaz (A)': 'background:#dbeafe;color:#1d4ed8',
                'Baik (B)': 'background:#d1fae5;color:#065f46',
                'Cukup (C)': 'background:#fef3c7;color:#92400e'
              };
            }
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">'
              + '<div style="width:26px;height:26px;border-radius:8px;background:var(--bg-2);color:var(--blue);font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(i+1)+'</div>'
              + '<div style="flex:1;font-size:13.5px;font-weight:800;color:var(--text)">'+esc(s.surat)+'<span style="font-size:10.5px;color:var(--text-3);font-weight:500;margin-left:6px">Juz '+s.juz+'</span></div>'
              + '<div style="font-size:11.5px;color:var(--text-3);font-weight:600">'+s.count+'x setoran</div>'
              + '<span style="'+nc[best]+';padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800;margin-left:4px">'+best+'</span>'
            + '</div>';
          }).join('')
      + '</div>';
    }

    return html;
  }

  // ==========================================
  // GENERAL RAPORT PORTAL
  // ==========================================
  var _raportData = [];
  var _raportConfig = null;
  var _currentPreviewIdx = -1;
  var _rincianData = null;
  var _rincianTab = 0;
  var _rincianIdx = -1;

  var HADIR_LABEL = { H:'Hadir', T:'Terlambat', I:'Izin', A:'Alpa' };
  var HADIR_COLOR = { H:'var(--green)', T:'var(--amber)', I:'var(--blue)', A:'var(--red)' };
  var HADIR_ICON  = { H:'✓', T:'T', I:'I', A:'✗' };

  function _raportSeenKey() {
    var us = window.HQ && window.HQ.Auth && window.HQ.Auth.getUser();
    return 'hq_raport_last_seen_' + (us ? us.id_user : 'x');
  }

  function _checkRaportBadge(rows) {
    if (!rows || !rows.length) return;
    var badge = document.getElementById('raportNavBadge');
    if (!badge) return;
    var lastSeen = Number(localStorage.getItem(_raportSeenKey()) || 0);
    var latestTs = 0;
    rows.forEach(function(r) {
      if (r.status === 'published' && r.tanggal_cetak) {
        var ts = new Date(r.tanggal_cetak).getTime();
        if (ts > latestTs) latestTs = ts;
      }
    });
    if (latestTs > lastSeen) {
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  function _clearRaportBadge() {
    var badge = document.getElementById('raportNavBadge');
    if (badge) badge.style.display = 'none';
    localStorage.setItem(_raportSeenKey(), Date.now());
  }

  async function loadRaport() {
    var el = document.getElementById('raportList');
    if (typeof skelCards === 'function') el.innerHTML = skelCards(2, 4);
    showLoad('Bismillah, memuat raport...');
    try {
      var [rMain, rKonfig] = await Promise.allSettled([
        window.HQ.MuridAPI.getRaport(),
        window.HQ.MuridAPI.getKonfigurasiRaport()
      ]);
      if (rMain.status === 'rejected') throw new Error(rMain.reason?.message || 'Gagal memuat raport');
      var r = rMain.value;
      _raportConfig = (rKonfig.status === 'fulfilled' && rKonfig.value?.data) ? rKonfig.value.data : {};
      var rows = r.data || [];
      _raportData = rows;
      _checkRaportBadge(rows);
      if (!rows.length) {
        el.innerHTML = '<div class="empty"><div class="empty-ico">📄</div>'
          + '<div class="empty-ttl">Belum ada raport</div>'
          + '<div class="empty-sub">Raport akan muncul setelah dipublikasikan oleh wali halaqah Anda. Pastikan notifikasi pengumuman diaktifkan.</div></div>';
        return;
      }
      el.innerHTML = rows.map(function(rp, idx) {
        var nilaiNum = Number(rp.nilai_akhir) || 0;
        var pred = String(rp.predikat || '').trim();
        var predikat = pred + (pred.indexOf('Mumtaz') === 0 ? ' ⭐' : pred.indexOf('Jayyid Jiddan') === 0 ? ' 👍' : pred.indexOf('Jayyid') === 0 ? ' 📌' : ' 📝');
        var kompHTML = (rp.komponen||[]).map(function(k){
          var isRescaled = k.bobot_original != null && Math.abs(Number(k.bobot) - Number(k.bobot_original)) > 0.05;
          var bobotLabel = isRescaled
            ? 'Bobot ' + k.bobot + '% <span style="color:var(--amber);font-size:10px" title="Bobot disesuaikan dari ' + k.bobot_original + '% karena ada komponen yang ditangguhkan">⚠️</span>'
            : 'Bobot ' + k.bobot + '%';
          return '<div class="komponen-row">'
            + '<span>'+esc(k.nama_komponen||k.nama||'-')+'</span>'
            + '<div style="display:flex;gap:8px;align-items:center">'
            + '<span style="font-size:12px;color:var(--text-3)">'+bobotLabel+'</span>'
            + '<span style="font-weight:700">'+k.nilai+'</span>'
            + '</div></div>';
        }).join('');
        return '<div class="raport-card">'
          + '<div class="raport-periode">📅 '+esc(rp.nama_periode||rp.id_periode||'')+'</div>'
          + '<div class="raport-nilai">'+nilaiNum.toFixed(1)+'</div>'
          + '<div class="raport-predikat">'+predikat+'</div>'
          + (kompHTML ? '<div style="margin-top:14px;border-top:1px solid rgba(20,88,168,.1);padding-top:12px">'+kompHTML+'</div>' : '')
          + '<div class="raport-actions">'
          + '<button class="btn-pdf" onclick="lihatRincianRaport('+idx+')" style="background:linear-gradient(135deg,#1e3a5f,#334155)">📊 Rincian & PDF</button>'
          + '</div>'
          + '</div>';
      }).join('');
    } catch(e) { el.innerHTML = '<div class="empty"><div class="empty-ico">❌</div><div class="empty-ttl">'+esc(friendlyError(e))+'</div></div>'; }
    finally { hideLoad(); }
  }

  function previewRaportPDF(idx) {
    var rp = _raportData[idx];
    if (!rp) return;
    _currentPreviewIdx = idx;
    var cfg = _raportConfig || {};
    var nilaiNum = Number(rp.nilai_akhir) || 0;
    var predikatText = nilaiNum >= 90 ? 'Mumtaz' : nilaiNum >= 75 ? 'Jayyid Jiddan' : nilaiNum >= 60 ? 'Jayyid' : 'Maqbul';

    var logoHTML = '';
    if (cfg.logo_url) {
      logoHTML = '<div class="rp-header-logo-container">'
        + '<img class="rp-logo" src="'+esc(cfg.logo_url)+'" alt="Logo" crossorigin="anonymous">'
        + '</div><div class="rp-header-divider"></div>';
    }

    var headerClass = cfg.logo_url ? 'has-logo' : 'no-logo';
    var namaLembaga    = cfg.nama_lembaga    || "Rattililqur'an";
    var subNamaLembaga = cfg.sub_nama_lembaga || "Lembaga Belajar Al-Qur'an";
    var kontakLembaga  = cfg.kontak_lembaga  || "rattililquran.com";

    var predikatDesc = nilaiNum >= 90 ? 'Sangat Memuaskan' : nilaiNum >= 75 ? 'Memuaskan' : nilaiNum >= 60 ? 'Baik' : 'Cukup';
    var predikatColor = nilaiNum >= 90 ? '#065f46' : nilaiNum >= 75 ? '#0369a1' : nilaiNum >= 60 ? '#92400e' : '#991b1b';

    var headerHTML = '<div class="rp-topbar"></div>'
      + '<div class="rp-header ' + headerClass + '">'
      + logoHTML
      + '<div class="rp-header-text">'
      + '<div class="rp-lembaga">'+esc(namaLembaga)+'</div>'
      + '<div class="rp-sublembaga">'+esc(subNamaLembaga)+'</div>'
      + '<div class="rp-kontak">'+esc(kontakLembaga)+'</div>'
      + '</div>'
      + '<div class="rp-header-badge"><div class="rp-header-badge-ico">📖</div><div class="rp-header-badge-lbl">Raport</div></div>'
      + '</div>';

    var titleHTML = '<div class="rp-title-section">'
      + '<div class="rp-title-ornament">— ✦ —</div>'
      + '<div class="rp-title">Laporan Perkembangan Belajar Al-Qur\'an</div>'
      + '<div class="rp-periode-label">Periode: '+esc(rp.nama_periode||'')+'</div>'
      + '</div>';

    var identityHTML = '<div class="rp-identity">'
      + '<div class="rp-id-item"><span class="rp-id-label">Nama Murid</span><span class="rp-id-value">'+esc(rp.nama_murid||'-')+'</span></div>'
      + '<div class="rp-id-item"><span class="rp-id-label">Halaqah</span><span class="rp-id-value">'+esc(rp.halaqah_nama||'-')+'</span></div>'
      + '<div class="rp-id-item"><span class="rp-id-label">Level / Materi</span><span class="rp-id-value">'+esc(rp.level||'-')+'</span></div>'
      + '<div class="rp-id-item"><span class="rp-id-label">Guru Pengajar</span><span class="rp-id-value">'+esc(rp.guru_nama||'-')+'</span></div>'
      + '</div>';

    var hasRescaled = (rp.komponen||[]).some(function(k) {
      return k.bobot_original != null && Math.abs(Number(k.bobot) - Number(k.bobot_original)) > 0.05;
    });
    var footnoteHTML = hasRescaled
      ? '<div style="font-size:9.5px;color:#b45309;font-style:italic;margin-top:6px;margin-bottom:12px;text-align:left">* Bobot disesuaikan secara proporsional karena ada komponen penilaian yang ditangguhkan/tidak aktif.</div>'
      : '';

    var komponenHTML = (rp.komponen||[]).map(function(k, i) {
      var isRescaled = k.bobot_original != null && Math.abs(Number(k.bobot) - Number(k.bobot_original)) > 0.05;
      var bobotLabel = k.bobot + '%' + (isRescaled ? ' <span style="color:#d97706;font-size:11px" title="Bobot disesuaikan dari ' + k.bobot_original + '% karena ada komponen yang ditangguhkan">⚠️</span>' : '');
      return '<tr>'
        + '<td class="rp-table-num">'+(i+1)+'</td>'
        + '<td style="font-weight:600">'+esc(k.nama_komponen || k.nama || '-')+'</td>'
        + '<td class="rp-table-bobot">'+bobotLabel+'</td>'
        + '<td class="rp-table-nilai">'+k.nilai+'</td>'
        + '</tr>';
    }).join('');

    var catatanHTML = rp.catatan_guru
      ? '<div class="rp-catatan"><div class="rp-catatan-title">✍ Catatan Wali Halaqah</div>'+esc(rp.catatan_guru)+'</div>'
      : cfg.catatan_halaqah
      ? '<div class="rp-catatan"><div class="rp-catatan-title">✍ Catatan Wali Halaqah</div>'+esc(cfg.catatan_halaqah)+'</div>'
      : '';

    var pesanHTML = cfg.pesan_penutup
      ? '<div class="rp-pesan">❝ '+esc(cfg.pesan_penutup)+' ❞</div>'
      : '<div class="rp-pesan">❝ Teruslah bersemangat dalam mengemban amanah Al-Qur\'an. Setiap langkah kecil adalah kemajuan yang berarti. ❞</div>';

    var ttdKota    = cfg.kota_terbit || 'Jakarta';
    var ttdTanggal = ttdKota + ', ' + (new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}));

    var signatureHTML = '<div class="rp-signature-container">'
      + '<div class="rp-signature-block">'
      + '<div class="rp-sig-date">'+esc(ttdTanggal)+'</div>'
      + '<div class="rp-sig-title">Mengetahui,</div>'
      + '<div class="rp-sig-role">'+esc(cfg.ttd_jabatan || 'Koordinator Akademik')+'</div>'
      + '<div class="rp-sig-name">'+esc(cfg.ttd_nama || 'Tim Akademik')+'</div>'
      + '</div>'
      + '</div>';

    var watermarkHTML = '<div class="rp-bottombar">'
      + '<div class="rp-watermark">Dicetak otomatis • Portal Murid '+esc(namaLembaga)+' • '+(new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}))+'</div>'
      + '<div class="rp-bottombar-badge">'+esc(namaLembaga)+'</div>'
      + '</div>';

    var html = '<div style="position:absolute;left:-9999px;top:0">'
      + '<div class="raport-pdf" id="raportPdfMain">'
      + headerHTML
      + titleHTML
      + identityHTML
      + '<div class="rp-body">'
      + '<div class="rp-section-title">Detail Komponen Penilaian</div>'
      + '<table class="rp-table">'
      + '<thead><tr><th style="text-align:center;width:6%">No</th><th>Komponen Evaluasi</th><th style="text-align:center;width:14%">Bobot</th><th style="text-align:center;width:14%">Nilai</th></tr></thead>'
      + '<tbody>'+komponenHTML+'</tbody>'
      + '</table>'
      + footnoteHTML
      + '<div class="rp-final-row">'
      + '<div class="rp-final-score"><div class="rp-final-score-num">'+nilaiNum.toFixed(0)+'</div><div class="rp-final-score-lbl">Nilai Akhir</div></div>'
      + '<div class="rp-predikat-box">'
      + '<div class="rp-predikat-lbl">Predikat Pencapaian</div>'
      + '<div class="rp-predikat-val" style="color:'+predikatColor+'">'+predikatText+'</div>'
      + '<div class="rp-predikat-desc">'+predikatDesc+' &nbsp;·&nbsp; Nilai '+nilaiNum.toFixed(1)+' / 100</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + watermarkHTML
      + '</div>'
      + '<div class="raport-pdf" id="raportPdfLast">'
      + '<div style="height:6px;background:linear-gradient(90deg,#1a5c3a 0%,#2d8a5a 50%,#c59b20 100%)"></div>'
      + '<div class="rp-body" style="padding-top:24px">'
      + (catatanHTML || '')
      + pesanHTML
      + signatureHTML
      + '</div>'
      + watermarkHTML
      + '</div>'
      + '</div>'
      + '<div class="raport-pdf" id="raportPdfRender" style="margin-top:0">'
      + headerHTML
      + titleHTML
      + identityHTML
      + '<div class="rp-body">'
      + '<div class="rp-section-title">Detail Komponen Penilaian</div>'
      + '<table class="rp-table">'
      + '<thead><tr><th style="text-align:center;width:6%">No</th><th>Komponen Evaluasi</th><th style="text-align:center;width:14%">Bobot</th><th style="text-align:center;width:14%">Nilai</th></tr></thead>'
      + '<tbody>'+komponenHTML+'</tbody>'
      + '</table>'
      + footnoteHTML
      + '<div class="rp-final-row">'
      + '<div class="rp-final-score"><div class="rp-final-score-num">'+nilaiNum.toFixed(0)+'</div><div class="rp-final-score-lbl">Nilai Akhir</div></div>'
      + '<div class="rp-predikat-box">'
      + '<div class="rp-predikat-lbl">Predikat Pencapaian</div>'
      + '<div class="rp-predikat-val" style="color:'+predikatColor+'">'+predikatText+'</div>'
      + '<div class="rp-predikat-desc">'+predikatDesc+' &nbsp;·&nbsp; Nilai '+nilaiNum.toFixed(1)+' / 100</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="border-top:2px dashed #e2e8f0;margin:20px 0;text-align:center;font-size:10px;color:#94a3b8;padding-top:8px">— Halaman Terakhir: Catatan &amp; Tanda Tangan —</div>'
      + '<div class="rp-body" style="padding-top:0">'
      + (catatanHTML || '')
      + pesanHTML
      + signatureHTML
      + '</div>'
      + watermarkHTML
      + '</div>';

    document.getElementById('raportPdfContent').innerHTML = html;
    document.getElementById('raportPreviewModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeRaportPreview() {
    document.getElementById('raportPreviewModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function _loadScriptOnce(src) {
    return new Promise(function(resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function doDownloadPDF() {
    var btn = document.getElementById('btnDownloadPdf');
    btn.disabled = true; btn.textContent = '⏳ Menyiapkan berkas...';
    try {
      if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        btn.textContent = '⏳ Memuat generator...';
        await Promise.all([
          _loadScriptOnce('../assets/js/jspdf.umd.min.js'),
          _loadScriptOnce('../assets/js/html2canvas.min.js'),
        ]);
      }
      btn.textContent = '⏳ Generating...';
      var mainEl = document.getElementById('raportPdfMain');
      var lastEl = document.getElementById('raportPdfLast');
      if (!mainEl || !lastEl) throw new Error('Raport element not found');

      var opt = { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false };
      var [mainCanvas, lastCanvas] = await Promise.all([
        html2canvas(mainEl, opt),
        html2canvas(lastEl, opt),
      ]);

      var pdf    = new jspdf.jsPDF('p', 'mm', 'a4');
      var pageW  = pdf.internal.pageSize.getWidth();
      var pageH  = pdf.internal.pageSize.getHeight();
      var margin = 10;
      var printW = pageW - margin * 2;
      var printH = pageH - margin * 2;

      var mainImgW = printW;
      var mainImgH = (mainCanvas.height * mainImgW) / mainCanvas.width;
      var mainPages = Math.ceil(mainImgH / printH);

      for (var p = 0; p < mainPages; p++) {
        if (p > 0) pdf.addPage();
        pdf.addImage(
          mainCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          margin - p * printH,
          mainImgW,
          mainImgH
        );
      }

      pdf.addPage();
      var lastImgH = (lastCanvas.height * printW) / lastCanvas.width;
      var lastY = lastImgH < printH ? margin + (printH - lastImgH) / 3 : margin;
      pdf.addImage(lastCanvas.toDataURL('image/png'), 'PNG', margin, lastY, printW, lastImgH);

      var rp = _raportData[_currentPreviewIdx] || {};
      var filename = 'Raport_'+(rp.nama_murid||'Murid').replace(/\s+/g,'_')+'_'+(rp.nama_periode||'').replace(/\s+/g,'_')+'.pdf';
      pdf.save(filename);
      toast('PDF berhasil diunduh ✅', 'ok');
    } catch(e) {
      toast('Gagal generate PDF: '+e.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = '📥 Unduh PDF';
    }
  }

  async function lihatRincianRaport(idx) {
    _rincianIdx = idx;
    var rp = _raportData && _raportData[idx];
    if (!rp) return;

    document.getElementById('rincianTitle').textContent = 'Rincian Raport';
    document.getElementById('rincianSubtitle').textContent = rp.nama_periode || '';
    document.getElementById('rincianBody').innerHTML =
      '<div style="padding:48px;text-align:center"><div style="font-size:28px;margin-bottom:8px">⏳</div><div style="color:var(--text-3);font-size:13px">Memuat rincian...</div></div>';
    document.getElementById('rincianOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
      var r = await window.HQ.MuridAPI.getRincianRaport(rp.id_raport);
      _rincianData = r.data;
      _rincianTab = 0;
      document.getElementById('rincianSesiCount').textContent = (_rincianData.sesi || []).length;
      document.querySelectorAll('.rincian-tab').forEach(function(b,i){ b.classList.toggle('active', i===0); });
      _renderRincianBody();
    } catch(e) {
      document.getElementById('rincianBody').innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--red)">❌ Gagal: '+esc(friendlyError(e))+'</div>';
    }
  }

  function closeRincianModal() {
    document.getElementById('rincianOverlay').style.display = 'none';
    document.body.style.overflow = '';
  }

  function switchRincianTab(tabIdx, btn) {
    _rincianTab = tabIdx;
    document.querySelectorAll('.rincian-tab').forEach(function(b,i){ b.classList.toggle('active', i===tabIdx); });
    _renderRincianBody();
  }

  function _renderRincianBody() {
    if (!_rincianData) return;
    document.getElementById('rincianBody').innerHTML =
      _rincianTab === 0 ? _htmlRincianNilai(_rincianData) : _htmlRincianSesi(_rincianData);
  }

  function _isDarkMode() {
    return document.documentElement.classList.contains('theme-dark');
  }

  function _htmlRincianNilai(data) {
    var dark = _isDarkMode();
    var rp  = data.raport;
    var num = Number(rp.nilai_akhir) || 0;
    var pred = String(rp.predikat || '');
    var predBg  = pred === 'Mumtaz'        ? 'var(--green)'
                : pred === 'Jayyid Jiddan' ? 'var(--blue)'
                : pred === 'Jayyid'         ? 'var(--amber)' : 'var(--red)';

    var h = '<div class="rincian-hero">'
      + '<div class="rincian-hero-val" style="color:'+predBg+'">'+num.toFixed(1)+'</div>'
      + '<div style="font-size:15px;font-weight:800;color:'+predBg+';margin-top:4px">'+esc(pred)+'</div>'
      + '<div style="font-size:10px;color:var(--text-3);margin-top:4px">'+esc(rp.periode||'')+'</div>'
      + '</div>';

    var isDaurah = (rp.komponen || []).some(function(k) { return k.tipe === 'daurah_indikator'; });
    if (isDaurah) {
      h += '<div style="padding:0 14px 6px">';
      
      // A. Cetak Indikator Tajwid
      var tajwidKomp = (rp.komponen || []).filter(function(k) { return k.tipe === 'daurah_indikator'; });
      h += '<div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Capaian Kompetensi Makhraj & Tajwid (Bobot 80%)</div>'
        + '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">';
        
      tajwidKomp.forEach(function(k) {
        var status = k.status_guru || 'belum';
        var statusMeta = {
          'paham': { text: 'Paham', color: 'var(--green)', bg: 'rgba(16,185,129,.12)', icon: '✅' },
          'ragu':  { text: 'Ragu-ragu', color: 'var(--amber)', bg: 'rgba(245,158,11,.12)', icon: '🟡' },
          'belum': { text: 'Belum Paham', color: 'var(--red)', bg: 'rgba(239,68,68,.12)', icon: '❌' }
        }[status] || { text: 'Belum Dinilai', color: 'var(--text-3)', bg: 'var(--border)', icon: '⚪' };
        
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;gap:12px">'
          + '<div style="flex:1">'
            + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
              + '<span style="font-size:13px;font-weight:700;color:var(--text)">' + esc(k.nama_komponen) + '</span>'
              + (k.teks_arab ? '<span style="font-family:Amiri,serif;font-size:16px;color:var(--green);direction:rtl;font-weight:bold">' + esc(k.teks_arab) + '</span>' : '')
            + '</div>'
            + (k.keterangan ? '<div style="font-size:11px;color:var(--text-2);margin-top:2px;line-height:1.4">' + esc(k.keterangan) + '</div>' : '')
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:30px;background:' + statusMeta.bg + ';color:' + statusMeta.color + ';font-size:11px;font-weight:800;white-space:nowrap;border:1px solid ' + (dark ? 'transparent' : statusMeta.color) + '">'
            + statusMeta.icon + ' ' + statusMeta.text
          + '</div>'
        + '</div>';
      });
      h += '</div>';

      // B. Cetak Partisipasi KBM
      var kbmKomp = (rp.komponen || []).filter(function(k) { return k.tipe === 'daurah_kbm'; });
      if (kbmKomp.length > 0) {
        h += '<div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Partisipasi & Kedisiplinan KBM (Bobot 20%)</div>'
          + '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">';
          
        kbmKomp.forEach(function(k) {
          h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;gap:12px">'
            + '<div style="flex:1">'
              + '<div style="font-size:13px;font-weight:700;color:var(--text)">' + esc(k.nama_komponen) + '</div>'
              + (k.keterangan ? '<div style="font-size:11px;color:var(--text-2);margin-top:2px;line-height:1.4">' + esc(k.keterangan) + '</div>' : '')
            + '</div>'
            + '<div style="font-size:15px;font-weight:800;color:var(--blue)">'
              + k.nilai + ' / 100'
            + '</div>'
          + '</div>';
        });
        h += '</div>';
      }
      
      h += '<div style="margin-top:16px;padding:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:12px;text-align:center">'
          + '<div style="font-size:11px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:.05em">Status Kelulusan</div>'
          + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-top:4px">' 
            + (num >= 80 ? '🎉 Dinyatakan LULUS & LAYAK Membaca Al-Fatihah' : '📚 PERLU MENGULANG program daurah untuk pemantapan')
          + '</div>'
        + '</div>'
        + '</div>';
        
      return h;
    }

    var thBg    = dark ? '#0f172a'  : '#1e3a5f';
    var rowOdd  = dark ? '#1e2128'  : '#ffffff';
    var rowEven = dark ? '#212736'  : '#f8fafc';
    var rowLast = dark ? '#0d2d1e'  : 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
    var nilaiUjianBg = dark ? '#1e2535' : '#f1f5f9';

    h += '<div style="padding:0 14px 6px">'
      + '<div style="font-size:10.5px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Komponen Penilaian</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:'+thBg+';color:#fff">'
      + '<th style="padding:8px;text-align:left;border-radius:8px 0 0 0">Komponen</th>'
      + '<th style="padding:8px;text-align:center">Bobot</th>'
      + '<th style="padding:8px;text-align:center">Nilai</th>'
      + '<th style="padding:8px;text-align:center;border-radius:0 8px 0 0">x Bobot</th>'
      + '</tr></thead><tbody>';

    var hasRescaled = false;
    (rp.komponen || []).forEach(function(k, i) {
      var nb  = k.nilai_bobot !== undefined ? k.nilai_bobot
              : Math.round(Number(k.nilai||0)*Number(k.bobot||0)/100*10)/10;
      var bg  = i%2===0 ? rowOdd : rowEven;
      var vColor = Number(k.nilai) >= 80 ? 'var(--green)' : Number(k.nilai) >= 60 ? 'var(--amber)' : 'var(--red)';
      
      var isRescaled = k.bobot_original != null && Math.abs(Number(k.bobot) - Number(k.bobot_original)) > 0.05;
      if (isRescaled) hasRescaled = true;
      var bobotLabel = k.bobot + '%' + (isRescaled ? ' <span style="color:var(--amber)" title="Bobot disesuaikan dari ' + k.bobot_original + '% karena ada komponen yang ditangguhkan">⚠️</span>' : '');

      h += '<tr style="background:'+bg+'">'
        + '<td style="padding:9px 8px;font-weight:600;color:var(--text)">'+esc(k.nama_komponen||k.nama||'-')
          +'<span style="font-size:9px;color:var(--text-3);margin-left:6px;font-weight:400">'+(k.tipe==='manual'?'manual':'otomatis')+'</span></td>'
        + '<td style="padding:9px;text-align:center;color:var(--text-3)">'+bobotLabel+'</td>'
        + '<td style="padding:9px;text-align:center;font-weight:800;font-size:14px;color:'+vColor+'">'+k.nilai+'</td>'
        + '<td style="padding:9px;text-align:center;font-weight:700;color:var(--blue)">'+nb+'</td>'
        + '</tr>';
    });

    h += '<tr style="background:'+rowLast+'">'
      + '<td colspan="3" style="padding:10px 8px;font-weight:800;color:var(--green);text-align:right">NILAI AKHIR</td>'
      + '<td style="padding:10px;text-align:center;font-weight:900;font-size:16px;color:var(--green)">'+num.toFixed(1)+'</td>'
      + '</tr>';
    h += '</tbody></table></div>';
    
    if (hasRescaled) {
      h += '<div style="font-size:10px;color:var(--amber);font-style:italic;margin-top:6px;margin-bottom:8px">* Bobot disesuaikan secara proporsional karena ada komponen penilaian yang ditangguhkan/tidak aktif.</div>';
    }

    if (data.nilai_manual && data.nilai_manual.length) {
      h += '<div style="margin-top:14px">'
        + '<div style="font-size:10.5px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Nilai Ujian</div>';
      data.nilai_manual.forEach(function(n) {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:'+nilaiUjianBg+';border-radius:10px;margin-bottom:6px">'
          + '<span style="font-weight:600;font-size:13px">'+esc(n.nama_komponen||'-')+'</span>'
          + '<span style="font-weight:900;font-size:16px;color:var(--blue)">'+n.nilai+'</span>'
          + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _htmlRincianSesi(data) {
    var dark = _isDarkMode();
    var sum  = data.summary || {};
    var sesi = data.sesi    || [];
    var trOdd  = dark ? '#1e2128' : '#ffffff';
    var trEven = dark ? '#212736' : '#f8fafc';
    var catatanBg = dark ? '#1a2744' : '#eff6ff';
    var koreksBg  = dark ? '#2a1e00' : '#fffbeb';

    var h = '<div class="rincian-stat-grid">';
    var stats = [
      { val: sum.total_sesi||0,  lbl:'Total Sesi',    color:'var(--blue)' },
      { val: sum.total_hadir||0, lbl:'Hadir',          color:'var(--green)' },
      { val: sum.total_alpa||0,  lbl:'Alpa',           color:(sum.total_alpa>0?'var(--red)':'var(--text-3)') },
      { val: (sum.pct_hadir||0)+'%', lbl:'% Kehadiran',
        color: sum.pct_hadir>=80?'var(--green)':sum.pct_hadir>=60?'var(--amber)':'var(--red)' },
    ];
    stats.forEach(function(s) {
      h += '<div class="rincian-stat">'
        + '<div class="rincian-stat-val" style="color:'+s.color+'">'+s.val+'</div>'
        + '<div class="rincian-stat-lbl">'+s.lbl+'</div>'
        + '</div>';
    });
    h += '</div>';

    if (!sesi.length) {
      h += '<div style="padding:40px;text-align:center;color:var(--text-3)">Belum ada data sesi KBM</div>';
      return h;
    }

    h += '<div style="overflow-x:auto;padding:0 0 4px">'
      + '<table class="rincian-sesi-table">'
      + '<thead><tr>'
      + '<th style="text-align:center">#</th>'
      + '<th style="text-align:left">Tanggal</th>'
      + '<th style="text-align:left">Materi</th>'
      + '<th style="text-align:center">Hadir</th>'
      + '<th style="text-align:center">Adab</th>'
      + '<th style="text-align:center">Kamera</th>'
      + '</tr></thead><tbody>';

    sesi.forEach(function(s) {
      var hColor = HADIR_COLOR[s.status_hadir] || 'var(--text)';
      var hIcon  = HADIR_ICON[s.status_hadir]  || s.status_hadir;
      var isAlpa = s.status_hadir === 'A';

      var adabHTML = isAlpa ? '<span style="color:var(--text-3)">—</span>'
        : s.adab === 'Baik'
          ? '<span style="color:var(--green);font-weight:700">✓</span>'
          : s.adab === 'Butuh Perhatian'
            ? '<span style="color:var(--amber);font-size:9.5px;font-weight:700">⚠ Perhatian</span>'
            : '<span style="color:var(--text-3)">—</span>';

      var kamera = String(s.kamera||'');
      var kamHTML = isAlpa ? '<span style="color:var(--text-3)">—</span>'
        : kamera.indexOf('terbuka') !== -1
          ? '<span style="color:var(--green);font-size:10px">Terbuka</span>'
          : kamera.indexOf('selalu') !== -1
            ? '<span style="color:var(--red);font-size:10px">Tertutup</span>'
            : kamera.indexOf('sering') !== -1
              ? '<span style="color:var(--amber);font-size:10px">Sering Tutup</span>'
              : '<span style="color:var(--text-3)">—</span>';

      var noSesi  = s.pertemuan_ke || s.no || (sesi.indexOf(s)+1);
      var tglSesi = s.tanggal ? (typeof fmtDate==='function' ? fmtDate(s.tanggal) : s.tanggal) : '-';
      var trBg = sesi.indexOf(s)%2===0 ? trOdd : trEven;
      var badgeClass = s.jenis_sesi === 'Micro Teaching' ? 'b-purple' 
                     : s.jenis_sesi === 'KBM Qiyam' ? 'b-green' 
                     : 'b-blue';
      var jenisSesi = s.jenis_sesi || 'KBM Reguler';
      var badgeHTML = '<span class="badge ' + badgeClass + '" style="font-size:9.5px;padding:2px 6px;margin-bottom:4px;display:inline-block">' + jenisSesi + '</span>';

      h += '<tr style="background:'+trBg+'">'
        + '<td style="text-align:center;color:var(--text-3);font-size:10px;background:'+trBg+'">'+esc(String(noSesi))+'</td>'
        + '<td style="white-space:nowrap;background:'+trBg+'">'+esc(tglSesi)+'</td>'
        + '<td style="font-size:10.5px;color:var(--text-2);max-width:140px;word-break:break-word;background:'+trBg+'">' + badgeHTML + '<br>' + esc(s.materi||'-') + '</td>'
        + '<td style="text-align:center;font-weight:800;font-size:13px;color:'+hColor+';background:'+trBg+'">'+hIcon+'</td>'
        + '<td style="text-align:center;background:'+trBg+'">'+adabHTML+'</td>'
        + '<td style="text-align:center;background:'+trBg+'">'+kamHTML+'</td>'
        + '</tr>';

      if (s.catatan_murid) {
        h += '<tr><td style="background:'+catatanBg+'"></td>'
          + '<td colspan="5" style="padding:4px 6px 6px;font-size:10px;color:var(--blue);font-style:italic;background:'+catatanBg+'">'
          + '💬 '+esc(s.catatan_murid)+'</td></tr>';
      }
      if (s.koreksi && !isAlpa) {
        var displayHTML = s.jenis_sesi === 'Micro Teaching'
          ? (typeof formatMicroTeachingRubric === 'function' ? formatMicroTeachingRubric(s.koreksi) : esc(s.koreksi))
          : '<div class="koreksi-box" style="border-radius:12px; padding:10px 14px; font-size:13px; font-weight:500; line-height:1.5">' + esc(s.koreksi) + '</div>';

        h += '<tr><td style="background:'+koreksBg+'"></td>'
          + '<td colspan="5" style="padding:4px 6px 6px;background:'+koreksBg+'">'
          + displayHTML + '</td></tr>';
      }
    });

    h += '</tbody></table></div>';
    return h;
  }

  async function downloadPDFResmi() {
    if (!_rincianData) return;
    var rp  = _rincianData.raport;
    var sesi = (_rincianData && _rincianData.sesi) || [];
    var sum  = (_rincianData && _rincianData.summary) || {};
    var btn = document.getElementById('btnPDFResmi');
    btn.disabled = true; btn.textContent = '⏳ Membuat PDF...';
    try {
      if (typeof jspdf === 'undefined') {
        btn.textContent = '⏳ Memuat generator...';
        await _loadScriptOnce('../assets/js/jspdf.umd.min.js');
      }
      var doc = new jspdf.jsPDF('p','mm','a4');
      var W = 210, mar = 18, y = 0;

      var G  = [26,92,58];    // hijau tua
      var GL = [240,253,244]; // hijau muda
      var Au = [197,155,32];  // emas
      var Dk = [15,23,42];    // teks gelap
      var Md = [71,85,105];   // teks medium
      var Lt = [148,163,184]; // teks terang
      var Wh = [255,255,255];

      var tgl = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

      function drawPageFooter() {
        doc.setFillColor(248,250,252); doc.rect(0,284,W,13,'F');
        doc.setDrawColor(226,232,240); doc.setLineWidth(0.3);
        doc.line(0,284,W,284);
        doc.setTextColor(...Lt); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
        doc.text('Dicetak otomatis • '+tgl+" • Portal Murid Rattililqur'an", mar, 290);
        doc.setTextColor(...G); doc.setFont('helvetica','bold');
        doc.text("RATTILILQUR'AN", W-mar, 290, {align:'right'});
      }

      function drawPageMiniHeader() {
        doc.setFillColor(...G); doc.rect(0,0,W,12,'F');
        doc.setFillColor(...Au); doc.rect(0,12,W,1,'F');
        doc.setTextColor(...Wh); doc.setFont('helvetica','bold'); doc.setFontSize(10);
        doc.text("Rattililqur'an", mar, 8);
        doc.setFont('helvetica','normal'); doc.setFontSize(8);
        doc.text('Rincian Penilaian — ' + (rp.nama_murid||'') + ' — ' + (rp.periode||''), W-mar, 8, {align:'right'});
      }

      function addNewPage() {
        drawPageFooter();
        doc.addPage();
        drawPageMiniHeader();
      }

      function drawCatatanAndTTD(targetY) {
        var catatan = rp.catatan_guru || '';
        if (catatan) {
          doc.setFillColor(255,251,235);
          var lines = doc.splitTextToSize(catatan, W-mar*2-8);
          var boxH = lines.length*4.8 + 12;
          doc.roundedRect(mar, targetY, W-mar*2, boxH, 2, 2, 'F');
          doc.setFillColor(...Au); doc.rect(mar, targetY, 2, boxH, 'F');
          doc.setTextColor(146,64,14); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
          doc.text('CATATAN WALI HALAQAH', mar+5, targetY+6);
          doc.setTextColor(...Dk); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
          doc.text(lines, mar+5, targetY+11);
          targetY += boxH + 8;
        }

        var pesan = '"Teruslah bersemangat dalam mengemban amanah Al-Qur\'an. Setiap langkah kecil adalah kemajuan yang berarti."';
        doc.setDrawColor(...Lt); doc.setLineWidth(0.3);
        doc.setLineDash([1,1]);
        doc.line(mar, targetY, W-mar, targetY); targetY += 5;
        doc.setTextColor(...Md); doc.setFont('helvetica','italic'); doc.setFontSize(8.5);
        var pesanLines = doc.splitTextToSize(pesan, W-mar*2-10);
        doc.text(pesanLines, W/2, targetY, {align:'center'});
        targetY += pesanLines.length*4.5 + 4;
        doc.line(mar, targetY, W-mar, targetY);
        doc.setLineDash([]);
        targetY += 8;

        var ttdX = W-mar-55;
        doc.setDrawColor(226,232,240); doc.setFillColor(248,250,252);
        doc.roundedRect(ttdX, targetY, 55, 36, 2, 2, 'FD');
        doc.setTextColor(...Md); doc.setFont('helvetica','normal'); doc.setFontSize(8);
        doc.text(tgl, ttdX+27.5, targetY+6, {align:'center'});
        doc.text('Mengetahui,', ttdX+27.5, targetY+10, {align:'center'});
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...G);
        doc.text('Koordinator Akademik', ttdX+27.5, targetY+14, {align:'center'});
        doc.setDrawColor(...G); doc.setLineWidth(0.5);
        doc.line(ttdX+5, targetY+30, ttdX+50, targetY+30);
        doc.setTextColor(...Dk); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        doc.text('Tim Akademik', ttdX+27.5, targetY+35, {align:'center'});
      }

      function renderArabicToImage(text, fontSize, isBold) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        ctx.font = (isBold ? 'bold ' : '') + fontSize + 'px "Amiri", "Traditional Arabic", "Scheherazade", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif';
        var textWidth = ctx.measureText(text).width;
        canvas.width = Math.ceil(textWidth) + 40;
        canvas.height = fontSize + 20;
        ctx.font = (isBold ? 'bold ' : '') + fontSize + 'px "Amiri", "Traditional Arabic", "Scheherazade", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a5c3a';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        return {
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height
        };
      }

      doc.setFillColor(26,92,58); doc.rect(0,0,W,2,'F');
      doc.setFillColor(197,155,32); doc.rect(0,2,W,1,'F');

      var logoDataUrl = null;
      try {
        var logoResp = await fetch('../assets/images/logo-abu.png');
        if (logoResp.ok) {
          var logoBlob = await logoResp.blob();
          logoDataUrl = await new Promise(function(res) {
            var fr = new FileReader(); fr.onload = function(e){res(e.target.result);}; fr.readAsDataURL(logoBlob);
          });
        }
      } catch(e) {}

      var isDaurah = (rp.komponen || []).some(function(k) { return k.tipe === 'daurah_indikator'; });
      if (isDaurah) {
        // ── CETAK PDF SERTIFIKAT/RAPORT DAURAH AL-FATIHAH ──
        doc.setFillColor(...G); doc.rect(0, 0, W, 4, 'F');
        doc.setFillColor(...Au); doc.rect(0, 4, W, 2, 'F');

        // Draw nice gold borders around the page
        doc.setDrawColor(...Au); doc.setLineWidth(0.8);
        doc.rect(mar - 4, mar - 4, W - (mar - 4) * 2, 297 - (mar - 4) * 2);

        // Header / Logo
        var textXHeader = mar;
        if (logoDataUrl) {
          try { doc.addImage(logoDataUrl, 'PNG', mar + 4, mar + 2, 22, 22); } catch(e){}
          textXHeader = mar + 28;
        }
        
        doc.setTextColor(...G); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
        doc.text("RATTILILQUR'AN", textXHeader, mar + 10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...Md);
        doc.text("Lembaga Belajar Al-Qur'an", textXHeader, mar + 16);
        
        doc.setDrawColor(...Au); doc.setLineWidth(0.8);
        doc.line(W/2 + 20, mar + 4, W/2 + 20, mar + 20);

        doc.setTextColor(...G); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text("LAPORAN HASIL DAURAH", W - mar - 4, mar + 10, {align: 'right'});
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...Md);
        doc.text("Surah Al-Fatihah (8 Sesi)", W - mar - 4, mar + 15, {align: 'right'});

        doc.setDrawColor(...G); doc.setLineWidth(0.3);
        doc.line(mar - 4, mar + 25, W - mar + 4, mar + 25);

        // Basmalah & Hamdalah
        y = mar + 28;
        try {
          var dBas = renderArabicToImage("بِسْــــــــــــــمِ اللهِ الرَّحْمَنِ الرَّحِيْـــــم", 28, false);
          var dBasW = 50; var dBasH = (dBas.height * dBasW) / dBas.width;
          doc.addImage(dBas.dataUrl, 'PNG', (W - dBasW) / 2, y, dBasW, dBasH);
          y += dBasH + 1;
          var dHam = renderArabicToImage("الحمدُ للَّهِ الذي بنعمتِهِ تَتِمُّ الصَّالحاتُ", 22, false);
          var dHamW = 45; var dHamH = (dHam.height * dHamW) / dHam.width;
          doc.addImage(dHam.dataUrl, 'PNG', (W - dHamW) / 2, y, dHamW, dHamH);
          y += dHamH + 2;
        } catch(e){}

        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        var daurahIntroText = "Alhamdulillaah, atas taufiq dari Allah, kita bisa mencapai pencapaian ini. Jadikan ini sebagai bentuk syukur kita sekaligus motivasi kita untuk menjadi pribadi yang lebih baik lagi kedepannya. Berikut kami lampirkan hasil perjuangan kita selama daurah ini. Semoga Allah terima. Baarakallahu fiikum";
        var daurahIntroLines = doc.splitTextToSize(daurahIntroText, W - mar * 2 - 8);
        doc.text(daurahIntroLines, W / 2, y, { align: 'center' });
        y += daurahIntroLines.length * 3.8 + 4;

        // Title
        doc.setTextColor(...G); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
        doc.text('SERTIFIKAT DAURAH TAHSIN AL-FATIHAH', W/2, y, {align: 'center'});
        
        y += 6;
        doc.setTextColor(...Md); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text('Diberikan kepada:', W/2, y, {align: 'center'});

        y += 8;
        doc.setTextColor(...Dk); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
        doc.text(rp.nama_murid || 'Sahabat Al-Qur\'an', W/2, y, {align: 'center'});
        
        // Underline student name with gold line
        doc.setDrawColor(...Au); doc.setLineWidth(0.5);
        var nameW = doc.getTextWidth(rp.nama_murid || 'Sahabat Al-Qur\'an') + 10;
        doc.line((W - nameW)/2, y + 1.5, (W + nameW)/2, y + 1.5);

        y += 8;
        doc.setTextColor(...Md); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        var descText = "Alhamdulillaah, dinyatakan TELAH MENYELESAIKAN Program Daurah Tahsin Al-Fatihah selama 8 sesi pertemuan intensif dengan hasil pencapaian sebagai berikut:";
        var descLines = doc.splitTextToSize(descText, W - mar*2 - 8);
        doc.text(descLines, W/2, y, {align: 'center'});
        y += descLines.length * 4 + 4;

        // Table header for indicators
        doc.setFillColor(...G); doc.rect(mar, y, W - mar*2, 7, 'F');
        doc.setTextColor(...Wh); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.text('NO', mar + 3, y + 5);
        doc.text('INDIKATOR EVALUASI TAJWID & MAKHRAJ', mar + 10, y + 5);
        doc.text('STATUS CAPAIAN', W - mar - 3, y + 5, {align: 'right'});
        y += 7;

        var items = rp.komponen || [];
        var tajwidItems = items.filter(function(x) { return x.tipe === 'daurah_indikator'; });
        var kbmItems = items.filter(function(x) { return x.tipe === 'daurah_kbm'; });

        // Render Tajwid
        tajwidItems.forEach(function(k, idx) {
          var isEven = idx % 2 === 0;
          doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
          doc.rect(mar, y, W - mar*2, 6.5, 'F');
          
          doc.setTextColor(...Dk); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.0);
          doc.text(String(idx + 1), mar + 3, y + 4.5);
          doc.setFont('helvetica', 'bold');
          doc.text(k.nama_komponen, mar + 10, y + 4.5);
          
          var status = k.status_guru || 'belum';
          var statLabel = status === 'paham' ? 'PAHAM' : status === 'ragu' ? 'RAGU-RAGU' : 'BELUM PAHAM';
          var statColor = status === 'paham' ? [16,185,129] : status === 'ragu' ? [245,158,11] : [239,68,68];
          
          doc.setTextColor(...statColor); doc.setFont('helvetica', 'bold');
          doc.text(statLabel, W - mar - 3, y + 4.5, {align: 'right'});
          y += 6.5;
        });

        // Render KBM Metrics
        if (kbmItems.length > 0) {
          y += 3;
          doc.setFillColor(...G); doc.rect(mar, y, W - mar*2, 6, 'F');
          doc.setTextColor(...Wh); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.0);
          doc.text('PARTISIPASI & KEDISIPLINAN KEBERSAMAAN KBM', mar + 3, y + 4.2);
          doc.text('NILAI KBM', W - mar - 3, y + 4.2, {align: 'right'});
          y += 6;

          kbmItems.forEach(function(k, idx) {
            var isEven = idx % 2 === 0;
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.rect(mar, y, W - mar*2, 6.5, 'F');

            doc.setTextColor(...Dk); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.0);
            doc.text(k.nama_komponen + (k.keterangan ? ' (' + k.keterangan + ')' : ''), mar + 3, y + 4.5);

            doc.setTextColor(...G); doc.setFont('helvetica', 'bold');
            doc.text(String(k.nilai) + ' / 100', W - mar - 3, y + 4.5, {align: 'right'});
            y += 6.5;
          });
        }

        y += 6;
        var finalScore = Number(rp.nilai_akhir || 0);
        var isLulus = finalScore >= 80;
        
        doc.setFillColor(isLulus ? 240 : 254, isLulus ? 253 : 242, isLulus ? 244 : 242);
        doc.roundedRect(mar, y, W - mar*2, 11, 2, 2, 'F');
        doc.setDrawColor(isLulus ? 167 : 254, isLulus ? 243 : 202, isLulus ? 208 : 202); doc.setLineWidth(0.4);
        doc.roundedRect(mar, y, W - mar*2, 11, 2, 2, 'S');
        
        doc.setTextColor(isLulus ? 21 : 153, isLulus ? 128 : 27, isLulus ? 61 : 27);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        var statusGrad = isLulus ? 'KEPUTUSAN: BAARAKALLAHU FIIKUM, LAYAK & LULUS MEMBACA SURAH AL-FATIHAH' : 'KEPUTUSAN: PERLU MENGULANG PROGRAM DAURAH UNTUK PEMANTAPAN';
        doc.text(statusGrad, W/2, y + 7, {align: 'center'});
        
        y += 8;
        
        // Motivasi Quote
        var daurahPesan = '"Teruslah bersemangat dalam mengemban amanah Al-Qur\'an. Setiap langkah kecil adalah kemajuan yang berarti."';
        doc.setDrawColor(...Lt); doc.setLineWidth(0.3);
        doc.setLineDash([1,1]);
        doc.line(mar, y, W-mar, y); y += 4;
        doc.setTextColor(...Md); doc.setFont('helvetica','italic'); doc.setFontSize(7.5);
        var daurahPesanLines = doc.splitTextToSize(daurahPesan, W-mar*2-10);
        doc.text(daurahPesanLines, W/2, y, {align:'center'});
        y += daurahPesanLines.length*4 + 3;
        doc.line(mar, y, W-mar, y);
        doc.setLineDash([]);
        y += 6;

        // Footer: Catatan Guru & Tanda Tangan
        var catatan = rp.catatan_guru || '';
        if (catatan) {
          doc.setFillColor(255, 251, 235);
          var lines = doc.splitTextToSize(catatan, W - mar*2 - 8);
          var boxH = lines.length * 4.8 + 12;
          doc.roundedRect(mar, y, W - mar*2, boxH, 2, 2, 'F');
          doc.setFillColor(...Au); doc.rect(mar, y, 2, boxH, 'F');
          doc.setTextColor(146, 64, 14); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
          doc.text('CATATAN WALI HALAQAH / PEMBIMBING', mar + 5, y + 6);
          doc.setTextColor(...Dk); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
          doc.text(lines, mar + 5, y + 11);
          y += boxH + 8;
        }

        // Tanda Tangan
        if (y > 250) {
          y = 244;
        }
        var ttdX = W - mar - 55;
        doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252);
        doc.roundedRect(ttdX, y, 55, 34, 2, 2, 'FD');
        doc.setTextColor(...Md); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        doc.text('Bondowoso, ' + tgl, ttdX + 27.5, y + 5, {align: 'center'});
        doc.text('Mengetahui,', ttdX + 27.5, y + 9, {align: 'center'});
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...G);
        doc.text('Koordinator Akademik', ttdX + 27.5, y + 13, {align: 'center'});
        doc.setDrawColor(...G); doc.setLineWidth(0.4);
        doc.line(ttdX + 5, y + 26, ttdX + 50, y + 26);
        doc.setTextColor(...Dk); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text('Tim Akademik', ttdX + 27.5, y + 30, {align: 'center'});

        // Draw footer bar
        doc.setFillColor(248, 250, 252); doc.rect(0, 284, W, 13, 'F');
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
        doc.line(0, 284, W, 284);
        doc.setTextColor(...Lt); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.text('Dicetak otomatis • ' + tgl + ' • Sertifikat Daurah Al-Fatihah', mar, 290);
        doc.setTextColor(...G); doc.setFont('helvetica', 'bold');
        doc.text("RATTILILQUR'AN", W - mar, 290, {align: 'right'});

        var filename = 'Sertifikat_Al_Fatihah_' + (rp.nama_murid || 'Murid').replace(/\s+/g, '_') + '.pdf';
        doc.save(filename);
        toast('PDF berhasil diunduh!', 'ok');
        return;
      }

      doc.setFillColor(...GL); doc.rect(0,3,W,32,'F');
      var textX = mar;
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl,'PNG', mar, 6, 22, 22); } catch(e){}
        textX = mar + 26;
      }
      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(20);
      doc.text("RATTILILQUR'AN", textX, 17);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...Md);
      doc.text("Lembaga Belajar Al-Qur'an", textX, 24);
      doc.setDrawColor(...Au); doc.setLineWidth(0.8);
      doc.line(W/2+10, 8, W/2+10, 31);
      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(15);
      doc.text('RAPORT HALAQAH', W-mar, 17, {align:'right'});
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...Md);
      doc.text(rp.periode || '', W-mar, 24, {align:'right'});
      doc.setDrawColor(...G); doc.setLineWidth(0.3);
      doc.line(0,35,W,35);
      y = 45;

      doc.setFillColor(248,250,252); doc.rect(0,35,W,32,'F');
      var bioRows = [
        [['Nama Murid', rp.nama_murid||'-'], ['Halaqah', rp.halaqah_nama||rp.halaqah||'-']],
        [['Pembimbing', rp.guru_nama||rp.guru||'-'], ['Periode', rp.periode||'-']],
      ];
      var bioYStart = bioRows && bioRows.length ? 42 : 42;
      bioRows.forEach(function(row, ri) {
        row.forEach(function(col, ci) {
          var x0 = ci === 0 ? mar : W/2+mar/2;
          var yy = bioYStart + ri * 13;
          doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...Lt);
          doc.text(col[0].toUpperCase(), x0, yy);
          doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...Dk);
          doc.text(col[1], x0, yy+5.5);
        });
      });
      doc.setDrawColor(...G); doc.setLineWidth(0.3);
      doc.line(0,67,W,67);
      y = 71;

      var basmalahObj = renderArabicToImage("بِسْــــــــــــــمِ text_placeholder", 48, false);
      try {
        basmalahObj = renderArabicToImage("بِسْــــــــــــــمِ text_placeholder", 48, false);
      } catch(e){}
      try {
        basmalahObj = renderArabicToImage("بِسْــــــــــــــمِ اللهِ الرَّحْمَنِ الرَّحِيْـــــم", 48, false);
      } catch(e){}
      var basmalahW = 85;
      var basmalahH = (basmalahObj.height * basmalahW) / basmalahObj.width;
      doc.addImage(basmalahObj.dataUrl, 'PNG', (W - basmalahW) / 2, y, basmalahW, basmalahH);
      y += basmalahH + 1.5;

      var realHamdalahCorrected = "الحمدُ للَّهِ الذي بنعمتِهِ تَتِمُّ الصَّالحاتُ";
      var hamdalahObjReal = renderArabicToImage(realHamdalahCorrected, 34, false);
      var hamdalahW = 75;
      var hamdalahH = (hamdalahObjReal.height * hamdalahW) / hamdalahObjReal.width;
      doc.addImage(hamdalahObjReal.dataUrl, 'PNG', (W - hamdalahW) / 2, y, hamdalahW, hamdalahH);
      y += hamdalahH + 6;

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      var introText = "Alhamdulillaah, atas taufiq dari Allah, kita bisa mencapai pencapaian ini. Jadikan ini sebagai bentuk syukur kita sekaligus motivasi kita untuk menjadi pribadi yang lebih baik lagi kedepannya. Berikut kami lampirkan hasil perjuangan kita selama satu level ini. Semoga Allah terima. Baarakallahu fiikum";
      var introLines = doc.splitTextToSize(introText, W - mar * 2 - 4);
      doc.text(introLines, W / 2, y, { align: 'center' });
      y += introLines.length * 4.2 + 6;

      var nilaiNum = Number(rp.nilai_akhir||0);
      var predikat = rp.predikat || (nilaiNum>=90?'Mumtaz':nilaiNum>=75?'Jayyid Jiddan':nilaiNum>=60?'Jayyid':'Maqbul');
      var predikatDesc = nilaiNum>=90?'Sangat Memuaskan':nilaiNum>=75?'Memuaskan':nilaiNum>=60?'Baik':'Cukup';

      var wCard = W - mar * 2;
      var hCard = 28;
      doc.setFillColor(240, 253, 244); 
      doc.roundedRect(mar, y, wCard, hCard, 3, 3, 'F');
      doc.setDrawColor(26, 92, 58); 
      doc.setLineWidth(0.4);
      doc.roundedRect(mar, y, wCard, hCard, 3, 3, 'S');
      doc.setDrawColor(187, 235, 209); 
      doc.setLineWidth(0.4);
      doc.line(mar + 36, y + 4, mar + 36, y + hCard - 4);
      doc.setTextColor(26, 92, 58); 
      doc.setFont('helvetica', 'bold'); 
      doc.setFontSize(28);
      doc.text(nilaiNum.toFixed(0), mar + 18, y + 17, { align: 'center' });
      doc.setFontSize(6.5); 
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105); 
      doc.text('NILAI AKHIR', mar + 18, y + 23, { align: 'center' });
      doc.setTextColor(197, 155, 32); 
      doc.setFont('helvetica', 'bold'); 
      doc.setFontSize(7.5);
      doc.text('PREDIKAT PENCAPAIAN', mar + 42, y + 7);
      doc.setTextColor(26, 92, 58); 
      doc.setFont('helvetica', 'bold'); 
      doc.setFontSize(16);
      doc.text(predikat, mar + 42, y + 17);
      doc.setTextColor(71, 85, 105); 
      doc.setFont('helvetica', 'normal'); 
      doc.setFontSize(8);
      doc.text(predikatDesc + '  ·  Nilai ' + nilaiNum.toFixed(1) + ' / 100', mar + 42, y + 24);
      y += hCard + 8;

      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text('A.  KOMPONEN PENILAIAN', mar, y);
      doc.setDrawColor(209,250,229); doc.setLineWidth(0.3);
      doc.line(mar+50, y-1, W-mar, y-1);
      y += 6;

      var cw = [W-mar*2-52, 17, 17, 18];
      doc.setFillColor(...G); doc.rect(mar, y, W-mar*2, 7, 'F');
      doc.setTextColor(...Wh); doc.setFontSize(8); doc.setFont('helvetica','bold');
      var cx = mar+2;
      ['Komponen Penilaian','Bobot','Nilai','x Bobot'].forEach(function(h,i){
        doc.text(h, cx, y+5); cx += cw[i];
      });
      y += 7;

      var komp = rp.komponen || [];
      var hasRescaled = false;
      komp.forEach(function(k, idx) {
        var isEven = idx%2===0;
        doc.setFillColor(isEven?248:255, isEven?250:255, isEven?252:255);
        doc.rect(mar, y, W-mar*2, 6.5, 'F');
        doc.setTextColor(...Dk); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        cx = mar+2;
        var nm = k.nama_komponen || k.nama || '–';
        doc.text(nm, cx, y+4.5); cx += cw[0];
        doc.setTextColor(...Md);
        var isRescaled = k.bobot_original != null && Math.abs(Number(k.bobot) - Number(k.bobot_original)) > 0.05;
        if (isRescaled) hasRescaled = true;
        var bobotLabel = (k.bobot||0) + '%' + (isRescaled ? '*' : '');
        doc.text(bobotLabel, cx, y+4.5, {align:'left'}); cx += cw[1];
        doc.text(String(k.nilai||0), cx, y+4.5); cx += cw[2];
        doc.text(String(k.nilai_bobot||k.nilai_x_bobot||0), cx, y+4.5);
        y += 6.5;
      });
      doc.setFillColor(...G); doc.rect(mar, y, W-mar*2, 7, 'F');
      doc.setTextColor(...Wh); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text('NILAI AKHIR', mar+2, y+5);
      doc.text(nilaiNum.toFixed(1), W-mar-2, y+5, {align:'right'});
      y += 9;
      
      if (hasRescaled) {
        doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(...Md);
        doc.text('* Bobot disesuaikan secara proporsional karena ada komponen penilaian yang ditangguhkan/tidak aktif.', mar, y);
        y += 5;
      }
      y += 5;

      if (sesi.length) {
        drawPageFooter();
      } else {
        drawCatatanAndTTD(y);
        drawPageFooter();
      }

      if (sesi.length) {
        doc.addPage();
        drawPageMiniHeader();
        var y2 = 22;

        doc.setFillColor(...G); doc.rect(mar-2, y2-4, W-mar*2+4, 8, 'F');
        doc.setTextColor(...Wh); doc.setFont('helvetica','bold'); doc.setFontSize(9);
        doc.text('B.  RINCIAN KEHADIRAN DAN PENILAIAN KBM', mar, y2+1);
        y2 += 10;

        var tH = sum.total_hadir||0, tS = sum.total_sesi||0;
        var tT = sum.total_terlambat||0, tI = sum.total_izin||0, tA = sum.total_alpa||0;
        var pct = tS>0 ? Math.round(tH/tS*100) : 0;
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...Md);
        doc.text(
          'Kehadiran: '+tH+' dari '+tS+' sesi ('+pct+'%)  |  Hadir: '+tH+'x  Terlambat: '+tT+'x  Izin: '+tI+'x  Alpa: '+tA+'x',
          mar, y2
        );
        y2 += 7;

        var cW2 = [8, 22, 70, 22, 20, 32];
        doc.setFillColor(...G); doc.rect(mar, y2, W-mar*2, 7, 'F');
        doc.setTextColor(...Wh); doc.setFont('helvetica','bold'); doc.setFontSize(8);
        var cx2 = mar+1;
        ['No','Tanggal','Materi Pembelajaran','Kehadiran','Adab','Kamera'].forEach(function(h,i){
          doc.text(h, cx2+1, y2+5); cx2 += cW2[i];
        });
        y2 += 7;

        var HSTAT = {H:'Hadir',T:'Terlambat',I:'Izin',A:'Alpa'};
        var HCOLOR = {H:[16,185,129],T:[245,158,11],I:[59,130,246],A:[239,68,68]};
        sesi.forEach(function(s, idx) {
          if (y2 > 265) {
            addNewPage();
            y2 = 22;
          }
          var isEven = idx%2===0;
          doc.setFillColor(isEven?248:255, isEven?250:255, isEven?252:255);
          doc.rect(mar, y2, W-mar*2, 6);
          cx2 = mar+1;
          doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...Dk);
          doc.text(String(s.pertemuan_ke||idx+1), cx2+cW2[0]/2, y2+4, {align:'center'}); cx2 += cW2[0];
          doc.setTextColor(...Dk); doc.text(String(s.tanggal||'-').substring(0,10), cx2+1, y2+4); cx2 += cW2[1];
          var jenis = s.jenis_sesi || 'KBM Reguler';
          var matText = '[' + jenis + '] ' + (s.materi || '-');
          var mat = doc.splitTextToSize(matText, cW2[2]-2);
          doc.text(mat[0]||'-', cx2+1, y2+4); cx2 += cW2[2];
          var hStat = HSTAT[s.status_hadir]||s.status_hadir||'-';
          var hClr  = HCOLOR[s.status_hadir]||Md;
          doc.setTextColor(...hClr); doc.setFont('helvetica','bold');
          doc.text(hStat, cx2+cW2[3]/2, y2+4, {align:'center'}); cx2 += cW2[3];
          doc.setTextColor(...Md); doc.setFont('helvetica','normal');
          doc.text(s.adab==='Baik'?'Baik':s.adab||'—', cx2+cW2[4]/2, y2+4, {align:'center'}); cx2 += cW2[4];
          
          var kam = String(s.kamera_murid||s.kamera||'');
          var kamTxt = '—';
          var kamClr = Md;
          if (kam.indexOf('terbuka') !== -1) {
            kamTxt = 'Terbuka';
            kamClr = [16,185,129];
          } else if (kam.indexOf('selalu') !== -1 || kam.indexOf('tertutup') !== -1) {
            kamTxt = 'Tertutup';
            kamClr = [239,68,68];
          } else if (kam.indexOf('sering') !== -1 || kam.indexOf('buka tutup') !== -1) {
            kamTxt = 'Sering Tutup';
            kamClr = [245,158,11];
          }
          doc.setTextColor(...kamClr);
          doc.setFont('helvetica', kamTxt !== '—' ? 'bold' : 'normal');
          doc.text(kamTxt, cx2+cW2[5]/2, y2+4, {align:'center'});
          y2 += 6;
        });
        y2 += 8;

        var catatan = rp.catatan_guru || '';
        var lines = catatan ? doc.splitTextToSize(catatan, W-mar*2-8) : [];
        var boxH = catatan ? (lines.length*4.8 + 12) : 0;
        var totalHeightNeeded = boxH + (catatan ? 8 : 0) + 15 + 36 + 20;
        if (y2 + totalHeightNeeded > 270) {
          addNewPage();
          y2 = 22;
        }
        drawCatatanAndTTD(y2);
        drawPageFooter();
      }

      var fname = 'Raport_'+(rp.nama_murid||'Murid').replace(/\s+/g,'-')+'_'+(rp.periode||'').replace(/\s+/g,'-')+'.pdf';
      doc.save(fname);
      toast('PDF berhasil diunduh!', 'ok');
    } catch(e) { toast('Gagal membuat PDF: '+e.message, 'err'); }
    finally { btn.disabled=false; btn.textContent='📥 Unduh PDF Resmi'; }
  }

  function showMyRtJuzDetail(juz) {
    var titleEl = document.getElementById('myRtJuzDetailTitle');
    var bodyEl  = document.getElementById('myRtJuzDetailBody');
    if (!titleEl || !bodyEl) return;

    titleEl.innerHTML = '🗺️ Rincian Setoran — Juz ' + juz;

    if (!_myRtCachedData || !_myRtCachedData.juzDetails || !_myRtCachedData.juzDetails[juz] || !_myRtCachedData.juzDetails[juz].length) {
      bodyEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-3)">'
        + '<div style="font-size:36px;margin-bottom:8px">📭</div>'
        + '<div style="font-size:13px;font-weight:700">Belum ada setoran untuk Juz ' + juz + '</div>'
        + '</div>';
      openModal('myRtJuzDetailModal');
      return;
    }

    var list = _myRtCachedData.juzDetails[juz];
    
    var countZiyadah = list.filter(function(x){ return x.jenis === 'Ziyadah'; }).length;
    var countMurajaah = list.filter(function(x){ return x.jenis === 'Murajaah'; }).length;
    var countA = list.filter(function(x){ return x.nilai === 'A'; }).length;
    var countB = list.filter(function(x){ return x.nilai === 'B'; }).length;
    var countC = list.filter(function(x){ return x.nilai === 'C'; }).length;

    var statsHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">'
      + '<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text)">' + countZiyadah + ' / ' + countMurajaah + '</div>'
        + '<div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Ziyadah / Murajaah</div>'
      + '</div>'
      + '<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text)">'
          + (countA ? '<span style="color:var(--green)">' + countA + 'A</span> ' : '')
          + (countB ? '<span style="color:var(--blue)">' + countB + 'B</span> ' : '')
          + (countC ? '<span style="color:var(--amber)">' + countC + 'C</span>' : '')
          + (!countA && !countB && !countC ? '-' : '')
        + '</div>'
        + '<div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Rincian Nilai</div>'
      + '</div>'
    + '</div>';

    var listHTML = list.map(function(s) {
      var isZiyadah = s.jenis === 'Ziyadah';
      var isDark = document.documentElement.classList.contains('theme-dark');
      var badgeColor = isZiyadah ? 'background:#e6f4ea;color:#137333' : 'background:#e8f0fe;color:#1a73e8';
      if (isDark) {
        badgeColor = isZiyadah ? 'background:rgba(52,211,153,0.12);color:#34d399' : 'background:rgba(56,189,248,0.12);color:#38bdf8';
      }
      
      var gradeColor = { A: 'background:#dbeafe;color:#1d4ed8', B: 'background:#d1fae5;color:#065f46', C: 'background:#fef3c7;color:#92400e' }[s.nilai] || 'background:#f3f4f6;color:#374151';
      if (isDark) {
        gradeColor = { 
          A: 'background:rgba(59,130,246,0.15);color:#60a5fa', 
          B: 'background:rgba(16,185,129,0.15);color:#34d399', 
          C: 'background:rgba(245,158,11,0.15);color:#fbbf24' 
        }[s.nilai] || 'background:rgba(255,255,255,0.08);color:#d1d5db';
      }

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<div style="font-size:13px;font-weight:800;color:var(--text)">' + esc(s.surat) + '</div>'
          + '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:100px;text-transform:uppercase; ' + badgeColor + '">' + esc(s.jenis) + '</span>'
        + '</div>'
        + '<div style="font-size:12px;color:var(--text-2);display:flex;justify-content:space-between;align-items:center">'
          + '<div>Ayat: <span style="font-weight:700">' + esc(s.ayat) + '</span></div>'
          + '<div style="display:flex;gap:6px;align-items:center">'
            + '<span style="font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:4px; ' + gradeColor + '">' + esc(s.nilai) + '</span>'
            + '<span style="font-size:11px;color:var(--text-3);font-weight:600">' + s.poin + ' Poin</span>'
          + '</div>'
        + '</div>'
        + '<div style="font-size:10.5px;color:var(--text-3);border-top:1px solid var(--border);padding-top:6px;margin-top:2px;display:flex;justify-content:space-between">'
          + '<span>Tanggal: ' + esc(s.tanggal) + '</span>'
          + '<span>' + esc(s.kelancaran) + '</span>'
        + '</div>'
      + '</div>';
    }).join('');

    bodyEl.innerHTML = statsHTML + '<div style="display:flex;flex-direction:column;gap:2px">' + listHTML + '</div>';
    openModal('myRtJuzDetailModal');
  }

  async function downloadMyRtPDF() {
    if (!_myRtCachedData) return;
    var r = _myRtCachedData;
    var pSel = document.getElementById('myRtPeriodeSel');
    var pTxt = pSel ? (pSel.options[pSel.selectedIndex] || {}).text || 'Semua Waktu' : 'Semua Waktu';
    
    var dash = window.dashData || {};
    var name = (dash.profil && (dash.profil.nama_lengkap || dash.profil.nama)) || 'Sahabat Al-Qur\'an';
    var hqNama = (dash.halaqah && dash.halaqah.nama) || '-';
    var guruNama = (dash.halaqah && (dash.halaqah.guru_nama || dash.halaqah.guru)) || '-';
    var level = (dash.anggota && dash.anggota.level) || '-';

    toast('⏳ Menyiapkan PDF...', 'warn');
    try {
      if (typeof jspdf === 'undefined') {
        await _loadScriptOnce('../assets/js/jspdf.umd.min.js');
      }
      var doc = new jspdf.jsPDF('p', 'mm', 'a4');
      var W = 210, mar = 18, y = 0;
      
      var G  = [26,92,58];
      var GL = [240,253,244];
      var Au = [197,155,32];
      var Dk = [15,23,42];
      var Md = [71,85,105];
      var Lt = [148,163,184];
      var Wh = [255,255,255];
      
      var tgl = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

      doc.setFillColor(...G); doc.rect(0, 0, W, 2, 'F');
      doc.setFillColor(...Au); doc.rect(0, 2, W, 1, 'F');

      var logoDataUrl = null;
      try {
        var logoResp = await fetch('../assets/images/logo-abu.png');
        if (logoResp.ok) {
          var logoBlob = await logoResp.blob();
          logoDataUrl = await new Promise(function(res) {
            var fr = new FileReader(); fr.onload = function(e){res(e.target.result);}; fr.readAsDataURL(logoBlob);
          });
        }
      } catch(e) {}

      doc.setFillColor(...GL); doc.rect(0, 3, W, 32, 'F');
      var textX = mar;
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', mar, 6, 22, 22); } catch(e){}
        textX = mar + 26;
      }

      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(18);
      doc.text("RATTILILQUR'AN", textX, 17);
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...Md);
      doc.text("Lembaga Belajar Al-Qur'an", textX, 23);

      doc.setDrawColor(...Au); doc.setLineWidth(0.8);
      doc.line(W/2+10, 8, W/2+10, 30);

      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text('RAPORT TAHFIDZ AL-QUR\'AN', W-mar, 16, {align:'right'});
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...Md);
      doc.text('Periode: ' + pTxt, W-mar, 22, {align:'right'});

      doc.setDrawColor(...G); doc.setLineWidth(0.3);
      doc.line(0, 35, W, 35);

      doc.setFillColor(248, 250, 252); doc.rect(0, 35, W, 26, 'F');
      var bio = [
        [['Nama Murid', name], ['Halaqah', hqNama]],
        [['Pembimbing', guruNama], ['Tingkat / Level', level]]
      ];
      var bioY = 41;
      bio.forEach(function(row, ri) {
        row.forEach(function(col, ci) {
          var x0 = ci === 0 ? mar : W/2 + mar/2;
          var yy = bioY + ri * 10;
          doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...Lt);
          doc.text(col[0].toUpperCase(), x0, yy);
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...Dk);
          doc.text(col[1], x0, yy+4.5);
        });
      });
      doc.setDrawColor(...G); doc.setLineWidth(0.3);
      doc.line(0, 61, W, 61);
      
      y = 67;

      function renderArabicToImage(text, fontSize, isBold) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        ctx.font = (isBold ? 'bold ' : '') + fontSize + 'px "Amiri", "Traditional Arabic", "Scheherazade", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif';
        var textWidth = ctx.measureText(text).width;
        canvas.width = Math.ceil(textWidth) + 40;
        canvas.height = fontSize + 20;
        ctx.font = (isBold ? 'bold ' : '') + fontSize + 'px "Amiri", "Traditional Arabic", "Scheherazade", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a5c3a';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        return {
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height
        };
      }

      var cleanBasmalah = "بِسْــــــــــــــمِ اللهِ الرَّحْمَنِ الرَّحِيْـــــم";
      var basmalahObj = renderArabicToImage(cleanBasmalah, 42, false);
      var basmalahW = 75;
      var basmalahH = (basmalahObj.height * basmalahW) / basmalahObj.width;
      doc.addImage(basmalahObj.dataUrl, 'PNG', (W - basmalahW) / 2, y, basmalahW, basmalahH);
      y += basmalahH + 1;

      var hamdalahObj = renderArabicToImage("الحمدُ للَّهِ الذي بنعمتِهِ تَتِمُّ الصَّالحاتُ", 30, false);
      var hamdalahW = 65;
      var hamdalahH = (hamdalahObj.height * hamdalahW) / hamdalahObj.width;
      doc.addImage(hamdalahObj.dataUrl, 'PNG', (W - hamdalahW) / 2, y, hamdalahW, hamdalahH);
      y += hamdalahH + 4;

      doc.setTextColor(...Md); doc.setFont('helvetica','bold'); doc.setFontSize(7.8);
      var introText = "Alhamdulillaah, atas taufiq dari Allah, kita bisa mencapai pencapaian ini. Jadikan ini sebagai bentuk syukur kita sekaligus motivasi kita untuk menjadi pribadi yang lebih baik lagi kedepannya. Berikut kami lampirkan hasil perjuangan kita selama satu level ini. Semoga Allah terima. Baarakallahu fiikum";
      var introLines = doc.splitTextToSize(introText, W - mar*2 - 4);
      doc.text(introLines, W/2, y, {align:'center'});
      y += introLines.length * 3.8 + 6;

      var cardW = (W - mar * 2 - 6) / 2;
      var cardH = 28;
      
      doc.setFillColor(248, 250, 252); doc.roundedRect(mar, y, cardW, cardH, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(mar, y, cardW, cardH, 2, 2, 'S');
      
      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text('LENCANA PENCAPAIAN', mar + 6, y + 6);
      doc.setTextColor(...Dk); doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
      doc.text(r.badge, mar + 6, y + 12);
      
      doc.setTextColor(...Lt); doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
      doc.text('PROGRESS KE BADGE BERIKUTNYA', mar + 6, y + 17);
      doc.setFillColor(226, 232, 240); doc.rect(mar + 6, y + 19, cardW - 12, 2, 'F');
      doc.setFillColor(...G); doc.rect(mar + 6, y + 19, (cardW - 12) * (r.pctProgress/100), 2, 'F');
      
      doc.setTextColor(...Md); doc.setFont('helvetica','normal'); doc.setFontSize(7);
      var targetText = r.nextBadge === 'Tingkat Maksimal' ? 'Tingkat Maksimal Tercapai' : 'Target: ' + r.nextBadge + ' (' + r.sisaPoin + ' poin lagi)';
      doc.text(targetText, mar + 6, y + 25);

      doc.setFillColor(240, 253, 244); doc.roundedRect(mar + cardW + 6, y, cardW, cardH, 2, 2, 'F');
      doc.setDrawColor(187, 235, 209); doc.roundedRect(mar + cardW + 6, y, cardW, cardH, 2, 2, 'S');

      doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text('STATISTIK UTAMA', mar + cardW + 12, y + 6);
      
      var sColW = (cardW - 12) / 3;
      var subStats = [
        ['Setoran', r.totalSetoran],
        ['Total Poin', r.totalPoin],
        ['Kelancaran', r.fluencyScore + '%']
      ];
      subStats.forEach(function(s, idx) {
        var sx = mar + cardW + 12 + idx * sColW;
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...Md);
        doc.text(s[0], sx, y + 13);
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...G);
        doc.text(String(s[1]), sx, y + 18.5);
      });
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...Md);
      doc.text('Nilai: ' + r.nA + ' A, ' + r.nB + ' B  •  Tipe: ' + (r.jenisCnt['Ziyadah']||0) + ' Ziyadah, ' + (r.jenisCnt['Murajaah']||0) + ' Murajaah', mar + cardW + 12, y + 24.5);

      y += cardH + 6;

      var gridTitleY = y;
      doc.setTextColor(...Dk); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text('MAP KEMATANGAN 30 JUZ', mar, gridTitleY);
      y += 3.5;

      var wGrid = W - mar * 2;
      var nCols = 10;
      var nRows = 3;
      var gap = 2;
      var cellW = (wGrid - (nCols - 1) * gap) / nCols;
      var cellH = 10;
      
      var maxJuzCount = Math.max.apply(null, Object.values(r.juzMap).map(function(j){ return j.count; }).concat([1]));

      for (var row = 0; row < nRows; row++) {
        for (var col = 0; col < nCols; col++) {
          var juz = row * nCols + col + 1;
          var info = r.juzMap[juz];
          var cnt = info ? info.count : 0;
          var alpha = cnt ? Math.max(0.2, cnt/maxJuzCount) : 0;
          
          var rFill = cnt ? Math.round(255 - (255 - 29) * alpha) : 241;
          var gFill = cnt ? Math.round(255 - (255 - 78) * alpha) : 245;
          var bFill = cnt ? Math.round(255 - (255 - 216) * alpha) : 249;

          var cx = mar + col * (cellW + gap);
          var cy = y + row * (cellH + gap);

          doc.setFillColor(rFill, gFill, bFill);
          doc.roundedRect(cx, cy, cellW, cellH, 1, 1, 'F');
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25);
          doc.roundedRect(cx, cy, cellW, cellH, 1, 1, 'S');

          var txtClr = cnt && alpha > 0.4 ? Wh : cnt ? [30,64,175] : [148,163,184];
          doc.setTextColor(...txtClr); doc.setFont('helvetica','bold'); doc.setFontSize(8);
          doc.text(String(juz), cx + cellW/2, cy + 5.5, {align:'center'});

          if (cnt) {
            doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
            doc.text(String(cnt), cx + cellW - 2.5, cy + cellH - 1.5, {align:'right'});
          }
        }
      }

      y += nRows * (cellH + gap) + 6;

      doc.setTextColor(...Dk); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text('DAFTAR SURAT YANG TELAH DISETORKAN', mar, y);
      y += 3.5;

      doc.setFillColor(248, 250, 252); doc.rect(mar, y, W - mar * 2, 6, 'F');
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(mar, y, W - mar, y); doc.line(mar, y + 6, W - mar, y + 6);
      
      doc.setTextColor(...Md); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text('NO', mar + 3, y + 4.2);
      doc.text('NAMA SURAT', mar + 10, y + 4.2);
      doc.text('JUZ', mar + 95, y + 4.2, {align:'center'});
      doc.text('TOTAL SETORAN', mar + 125, y + 4.2, {align:'center'});
      doc.text('PREDIKAT TERBAIK', mar + 165, y + 4.2, {align:'center'});

      y += 6;

      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...Dk);
      
      var visibleSurats = r.suratList;
      var totalPagesAdded = 0;

      visibleSurats.forEach(function(s, idx) {
        if (y > 262) {
          doc.setFillColor(248,250,252); doc.rect(0,284,W,13,'F');
          doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(0,284,W,284);
          doc.setTextColor(...Lt); doc.setFontSize(7); doc.setFont('helvetica','normal');
          doc.text('Dicetak otomatis • ' + tgl + ' • Portal Murid Rattililqur\'an', mar, 290);
          doc.setTextColor(...G); doc.setFont('helvetica','bold');
          doc.text("RATTILILQUR'AN", W-mar, 290, {align:'right'});

          doc.addPage();
          totalPagesAdded++;
          
          doc.setFillColor(...G); doc.rect(0, 0, W, 2, 'F');
          doc.setFillColor(...Au); doc.rect(0, 2, W, 1, 'F');
          
          doc.setFillColor(...GL); doc.rect(0,3,W,10,'F');
          doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
          doc.text("Raport Tahfidz — " + name, mar, 9.5);
          doc.setTextColor(...Md); doc.setFont('helvetica','normal');
          doc.text("Periode: " + pTxt, W - mar, 9.5, {align:'right'});
          doc.line(0, 13, W, 13);
          
          y = 18;

          doc.setFillColor(248, 250, 252); doc.rect(mar, y, W - mar * 2, 6, 'F');
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(mar, y, W - mar, y); doc.line(mar, y + 6, W - mar, y + 6);
          doc.setTextColor(...Md); doc.setFont('helvetica','bold'); doc.setFontSize(7);
          doc.text('NO', mar + 3, y + 4.2);
          doc.text('NAMA SURAT', mar + 10, y + 4.2);
          doc.text('JUZ', mar + 95, y + 4.2, {align:'center'});
          doc.text('TOTAL SETORAN', mar + 125, y + 4.2, {align:'center'});
          doc.text('PREDIKAT TERBAIK', mar + 165, y + 4.2, {align:'center'});
          y += 6;
        }

        var best = s.nilai_list.includes('A')?'A':s.nilai_list.includes('B')?'B':'C';
        
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...Dk);
        doc.text(String(idx+1), mar + 3, y + 4);
        doc.setFont('helvetica','bold');
        doc.text(s.surat, mar + 10, y + 4);
        doc.setFont('helvetica','normal');
        doc.text(String(s.juz), mar + 95, y + 4, {align:'center'});
        doc.text(String(s.count) + ' Kali', mar + 125, y + 4, {align:'center'});
        
        var bClr = best === 'A' ? [29,78,216] : best === 'B' ? [5,150,105] : [146,64,14];
        var bBg  = best === 'A' ? [219,234,254] : best === 'B' ? [209,250,229] : [254,243,199];
        doc.setFillColor(...bBg); doc.roundedRect(mar + 158, y + 1, 14, 4.5, 0.8, 0.8, 'F');
        doc.setTextColor(...bClr); doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
        doc.text(best, mar + 165, y + 4.2, {align:'center'});

        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2);
        doc.line(mar, y + 6.2, W - mar, y + 6.2);

        y += 6.2;
      });

      y += 4;

      if (y > 240) {
        doc.setFillColor(248,250,252); doc.rect(0,284,W,13,'F');
        doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(0,284,W,284);
        doc.setTextColor(...Lt); doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text('Dicetak otomatis • ' + tgl + ' • Portal Murid Rattililqur\'an', mar, 290);
        doc.setTextColor(...G); doc.setFont('helvetica','bold');
        doc.text("RATTILILQUR'AN", W-mar, 290, {align:'right'});

        doc.addPage();
        doc.setFillColor(...G); doc.rect(0, 0, W, 2, 'F');
        doc.setFillColor(...Au); doc.rect(0, 2, W, 1, 'F');
        
        doc.setFillColor(...GL); doc.rect(0,3,W,10,'F');
        doc.setTextColor(...G); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        doc.text("Raport Tahfidz — " + name, mar, 9.5);
        doc.setTextColor(...Md); doc.setFont('helvetica','normal');
        doc.text("Periode: " + pTxt, W - mar, 9.5, {align:'right'});
        doc.line(0, 13, W, 13);
        
        y = 22;
      }

      var ttdX = W - mar - 55;
      doc.setDrawColor(226,232,240); doc.setFillColor(248,250,252);
      doc.roundedRect(ttdX, y, 55, 34, 2, 2, 'FD');
      doc.setTextColor(...Md); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.text('Jakarta, ' + tgl, ttdX+27.5, y+5, {align:'center'});
      doc.text('Mengetahui,', ttdX+27.5, y+9, {align:'center'});
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...G);
      doc.text('Koordinator Akademik', ttdX+27.5, y+13, {align:'center'});
      doc.setDrawColor(...G); doc.setLineWidth(0.4);
      doc.line(ttdX+5, y+27, ttdX+50, y+27);
      doc.setTextColor(...Dk); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.text('Tim Akademik', ttdX+27.5, y+31, {align:'center'});

      doc.setFillColor(248,250,252); doc.rect(0,284,W,13,'F');
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(0,284,W,284);
      doc.setTextColor(...Lt); doc.setFontSize(7); doc.setFont('helvetica','normal');
      doc.text('Dicetak otomatis • ' + tgl + ' • Portal Murid Rattililqur\'an', mar, 290);
      doc.setTextColor(...G); doc.setFont('helvetica','bold');
      doc.text("RATTILILQUR'AN", W-mar, 290, {align:'right'});

      var filename = 'Raport_Tahfidz_' + name.replace(/\s+/g,'_') + '_' + pTxt.replace(/\s+/g,'_') + '.pdf';
      doc.save(filename);
      toast('PDF berhasil diunduh ✅', 'ok');
    } catch(e) {
      toast('Gagal mengunduh PDF: ' + e.message, 'err');
      console.error(e);
    }
  }

  // Safe Property Accessors
  try { delete window._myRtPeriodeLoaded; Object.defineProperty(window, '_myRtPeriodeLoaded', { get: function() { return _myRtPeriodeLoaded; }, set: function(v) { _myRtPeriodeLoaded = v; }, configurable: true }); } catch(e) { window._myRtPeriodeLoaded = _myRtPeriodeLoaded; }
  try { delete window._myRtCachedData; Object.defineProperty(window, '_myRtCachedData', { get: function() { return _myRtCachedData; }, set: function(v) { _myRtCachedData = v; }, configurable: true }); } catch(e) { window._myRtCachedData = _myRtCachedData; }

  // Expose public functions to window
  window._initMyRaportPanel = _initMyRaportPanel;
  window.loadMyRaportTahfidz = loadMyRaportTahfidz;
  window._myRtHitungPoin = _myRtHitungPoin;
  window._myRtBuild = _myRtBuild;
  window._myRtRenderHTML = _myRtRenderHTML;
  window.loadRaport = loadRaport;
  window.lihatRincianRaport = lihatRincianRaport;
  window.closeRincianModal = closeRincianModal;
  window.switchRincianTab = switchRincianTab;
  window.downloadPDFResmi = downloadPDFResmi;
  window.previewRaportPDF = previewRaportPDF;
  window.closeRaportPreview = closeRaportPreview;
  window.doDownloadPDF = doDownloadPDF;
  window._checkRaportBadge = _checkRaportBadge;
  window._clearRaportBadge = _clearRaportBadge;
  window.showMyRtJuzDetail = showMyRtJuzDetail;
  window.downloadMyRtPDF = downloadMyRtPDF;
})();
