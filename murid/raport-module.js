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
    var totalPoin = 0, ziAyat = 0, mjAyat = 0, countZiyadah = 0, countMurajaah = 0;
    var juzMap = {};

    setoran.forEach(function(s) {
      var p = _myRtHitungPoin(s.nilai, s.kelancaran, cfg);
      totalPoin += p;
      var jmlAyat = (s.ayat_sampai - s.ayat_dari + 1);
      if (s.jenis === 'Ziyadah')  { ziAyat += jmlAyat; countZiyadah++; }
      if (s.jenis === 'Murajaah') { mjAyat += jmlAyat; countMurajaah++; }
      var j = s.juz || 30;
      if (!juzMap[j]) juzMap[j] = { total: 0, ziyadah: 0, murajaah: 0, items: [] };
      juzMap[j].total++;
      if (s.jenis === 'Ziyadah') juzMap[j].ziyadah++;
      if (s.jenis === 'Murajaah') juzMap[j].murajaah++;
      juzMap[j].items.push(s);
    });

    _myRtCachedData = { setoran: setoran, cfg: cfg, juzMap: juzMap, totalPoin: totalPoin, ziAyat: ziAyat, mjAyat: mjAyat };
    return _myRtCachedData;
  }

  function _myRtRenderHTML(data, labelPeriode) {
    var user = window.HQ.getCurrentUser();
    var namaMurid = (user && user.nama) || 'Murid';
    return '<div class="my-rt-container" style="padding:16px;background:var(--card-solid);border-radius:16px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<div><div style="font-size:16px;font-weight:800;color:var(--text)">📊 Raport Tahfidz</div><div style="font-size:11px;color:var(--text-3)">' + esc(namaMurid) + ' · ' + esc(labelPeriode) + '</div></div>'
      + '<button class="btn btn-sm" onclick="downloadMyRtPDF()" style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">📄 Unduh PDF</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
      + '<div style="background:var(--bg-2);padding:12px;border-radius:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#0ea5e9">' + data.totalPoin + '</div><div style="font-size:10px;color:var(--text-3);font-weight:700">Total Poin</div></div>'
      + '<div style="background:var(--bg-2);padding:12px;border-radius:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#10b981">' + data.ziAyat + '</div><div style="font-size:10px;color:var(--text-3);font-weight:700">Ayat Ziyadah</div></div>'
      + '<div style="background:var(--bg-2);padding:12px;border-radius:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#8b5cf6">' + data.mjAyat + '</div><div style="font-size:10px;color:var(--text-3);font-weight:700">Ayat Murajaah</div></div>'
      + '</div>'
      + '</div>';
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
})();
