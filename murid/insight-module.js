/**
 * murid/insight-module.js
 * Modul Insight Belajar Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var KATEGORI_WARNA = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444'];
  var RUBRIK_LABEL = { penguasaan: 'Penguasaan', penyampaian: 'Penyampaian', tajwid: 'Tajwid', interaksi: 'Interaksi', waktu: 'Waktu' };
  var CARD_STYLE = 'background:var(--card-solid);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px';

  function pctColor(pct) {
    return pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
  }

  async function loadInsightBelajar() {
    var el = document.getElementById('insightContent');
    if (!el) return;
    el.innerHTML = '<div class="empty"><div class="empty-ico">⏳</div><div class="empty-ttl">Memuat...</div></div>';
    try {
      var r = await window.HQ.MuridAPI.getInsightBelajar();
      var data = r && r.data;
      if (!data) {
        el.innerHTML = '<div class="empty"><div class="empty-ico">📭</div><div class="empty-ttl">Belum ada data KBM untuk dianalisis</div></div>';
        return;
      }
      renderInsightBelajar(el, data);
    } catch (e) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-ttl">' + esc(friendlyError(e)) + '</div></div>';
    }
  }

  function renderInsightBelajar(el, data) {
    if (data.insufficientData) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">🌱</div><div class="empty-ttl">Masih butuh beberapa sesi lagi</div>'
        + '<div style="color:var(--text-3);font-size:13px;margin-top:6px;max-width:280px">Insight baru akurat setelah beberapa kali KBM tercatat (baru ' + data.totalSesiHadir + ' sesi hadir). Terus semangat hadir ya!</div></div>';
      return;
    }
    var html = '';
    html += renderTrenAdabKamera(data.trenAdabKamera);
    html += renderTopKoreksi(data.topKategoriKoreksi);
    if (data.trenRubrikMt && data.trenRubrikMt.length) html += renderTrenRubrikMt(data.trenRubrikMt);
    el.innerHTML = html;
  }

  function renderTrenAdabKamera(tren) {
    if (!tren || !tren.length) return '';
    var rows = tren.map(function(b) {
      return rowDuaBar(b);
    }).join('');
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-weight:800;font-size:14px;margin-bottom:4px">📈 Tren Adab &amp; Kamera per Bulan</div>'
      + '<div style="color:var(--text-3);font-size:12.5px;margin-bottom:8px">% sesi dengan adab "Baik", dan rekap kamera (terbuka/sering/selalu tertutup), dari sesi kamu hadir</div>'
      + legendKamera()
      + rows
      + '</div>';
  }

  function legendKamera() {
    return '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--text-3);margin-bottom:10px">'
      + legendDot('var(--green)', 'Terbuka')
      + legendDot('var(--amber)', 'Sering Buka-Tutup')
      + legendDot('var(--red)', 'Tertutup')
      + '</div>';
  }

  function legendDot(color, label) {
    return '<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>' + esc(label) + '</span>';
  }

  function rowDuaBar(b) {
    return '<div style="margin-bottom:10px">'
      + '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:4px">' + esc(b.bulan) + '</div>'
      + miniBar('Adab', b.pct_adab_baik)
      + stackedKameraBar(b.pct_kamera_terbuka, b.pct_kamera_sering_tertutup, b.pct_kamera_selalu_tertutup)
      + kameraCaption(b.n_kamera_sering_tertutup, b.n_kamera_selalu_tertutup)
      + '</div>';
  }

  // Keterangan jumlah kejadian tertutup -- hanya muncul kalau ada, biar bulan
  // yang bersih (tidak ada masalah kamera) tidak penuh angka "0x" tak berguna.
  function kameraCaption(nSering, nSelalu) {
    var parts = [];
    if (nSelalu) parts.push('🔴 kamera tertutup ' + nSelalu + '×');
    if (nSering) parts.push('🟠 sering buka-tutup ' + nSering + '×');
    if (!parts.length) return '';
    return '<div style="margin:2px 0 0 60px;font-size:10.5px;color:var(--text-3)">' + parts.join(' · ') + '</div>';
  }

  function miniBar(label, pct) {
    var known = pct !== null && pct !== undefined;
    var w = known ? pct : 0;
    var color = known ? pctColor(pct) : 'var(--border)';
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
      + '<div style="width:52px;font-size:11px;color:var(--text-3)">' + esc(label) + '</div>'
      + '<div style="flex:1;height:8px;background:var(--bg-2);border-radius:5px;overflow:hidden">'
      + '<div style="height:100%;width:' + w + '%;background:' + color + ';border-radius:5px"></div>'
      + '</div>'
      + '<div style="width:34px;text-align:right;font-size:11px;font-weight:700;color:var(--text-2)">' + (known ? pct + '%' : '-') + '</div>'
      + '</div>';
  }

  // Kamera: satu bar 3-segmen (terbuka hijau / sering tertutup amber / selalu
  // tertutup merah) supaya rekap tertutup & sering tertutup ikut tampil secara
  // visual -- jumlah kejadian persisnya ditulis di kameraCaption() di bawah bar.
  function stackedKameraBar(pctTerbuka, pctSering, pctSelalu) {
    var known = pctTerbuka !== null && pctTerbuka !== undefined;
    var segs = '';
    if (known) {
      if (pctTerbuka > 0) segs += '<div style="height:100%;width:' + pctTerbuka + '%;background:var(--green)"></div>';
      if (pctSering > 0) segs += '<div style="height:100%;width:' + pctSering + '%;background:var(--amber)"></div>';
      if (pctSelalu > 0) segs += '<div style="height:100%;width:' + pctSelalu + '%;background:var(--red)"></div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px">'
      + '<div style="width:52px;font-size:11px;color:var(--text-3)">Kamera</div>'
      + '<div style="flex:1;height:8px;background:var(--bg-2);border-radius:5px;overflow:hidden;display:flex">' + segs + '</div>'
      + '<div style="width:34px;text-align:right;font-size:11px;font-weight:700;color:var(--text-2)">' + (known ? pctTerbuka + '%' : '-') + '</div>'
      + '</div>';
  }

  function renderTopKoreksi(list) {
    if (!list || !list.length) {
      return '<div style="' + CARD_STYLE + '">'
        + '<div style="font-weight:800;font-size:14px;margin-bottom:4px">🎯 Kategori Koreksi Tahsin Tersering</div>'
        + '<div style="color:var(--text-3);font-size:12.5px">Belum ada catatan koreksi tahsin dalam 6 bulan terakhir. Alhamdulillah!</div></div>';
    }
    var max = list[0].jumlah || 1;
    var rows = list.map(function(item, i) {
      var w = Math.round(item.jumlah / max * 100);
      var color = KATEGORI_WARNA[i % KATEGORI_WARNA.length];
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<div style="width:110px;font-size:12px;font-weight:700;color:var(--text-2)">' + esc(item.kategori) + '</div>'
        + '<div style="flex:1;height:10px;background:var(--bg-2);border-radius:5px;overflow:hidden">'
        + '<div style="height:100%;width:' + w + '%;background:' + color + ';border-radius:5px"></div>'
        + '</div>'
        + '<div style="width:24px;text-align:right;font-size:11px;font-weight:700;color:var(--text-2)">' + item.jumlah + '</div>'
        + '</div>';
    }).join('');
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-weight:800;font-size:14px;margin-bottom:4px">🎯 Kategori Koreksi Tahsin Tersering</div>'
      + '<div style="color:var(--text-3);font-size:12.5px;margin-bottom:12px">Fokuskan latihan mandirimu di sini</div>'
      + rows
      + '</div>';
  }

  function renderTrenRubrikMt(tren) {
    var komponenKeys = Object.keys(RUBRIK_LABEL);
    var rows = tren.map(function(b) {
      var komponen = komponenKeys.map(function(k) {
        var v = b[k];
        return '<div style="text-align:center;flex:1">'
          + '<div style="font-size:10px;color:var(--text-3)">' + RUBRIK_LABEL[k] + '</div>'
          + '<div style="font-size:14px;font-weight:800;color:var(--text-2)">' + (v !== null && v !== undefined ? v : '-') + '</div>'
          + '</div>';
      }).join('');
      return '<div style="margin-bottom:12px">'
        + '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px">' + esc(b.bulan) + '</div>'
        + '<div style="display:flex;gap:4px">' + komponen + '</div>'
        + '</div>';
    }).join('');
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-weight:800;font-size:14px;margin-bottom:4px">🎤 Rata-rata Rubrik Micro Teaching</div>'
      + '<div style="color:var(--text-3);font-size:12.5px;margin-bottom:12px">Skala 1-4 per komponen, dari sesi Micro Teaching-mu</div>'
      + rows
      + '</div>';
  }

  window.loadInsightBelajar = loadInsightBelajar;
})();
