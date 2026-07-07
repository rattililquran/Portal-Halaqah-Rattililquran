// ============================================================
//  Portal Admin — SPP, Keuangan, & Kas Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- SPP, Infaq, Metode Bayar, Kas Beasiswa & Operasional ---

// ── Metode Bayar ──
async function loadMetodeBayarAdmin() {
  var el = document.getElementById('sppMetodeAdminList');
  if (!el) return;
  try {
    var r = await window.HQ.AdminAPI.getMetodeBayar();
    var list = r.data || [];
    if (!list.length) {
      el.innerHTML = '<div style="padding:14px;background:var(--bg-2, #f8fafc);border-radius:10px;border:1px dashed var(--border);text-align:center;color:var(--text-3, #94a3b8);font-size:13px">Belum ada metode. Klik "+ Tambah" untuk menambahkan rekening atau QRIS.</div>';
      return;
    }
    el.innerHTML = list.map(function(m) {
      var detail = m.jenis==='qris'
        ? '<span style="font-size:11px;color:var(--blue-txt, #0369a1)">📱 QRIS ' + (m.qris_url?'· <a href="'+esc(m.qris_url)+'" target="_blank" style="color:var(--blue-txt, #0369a1)">Lihat QR</a>':'· belum ada gambar') + '</span>'
        : '<span style="font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--text)">'+esc(m.nomor||'—')+'</span><span style="font-size:11px;color:var(--text-2, #64748b);margin-left:8px">a/n '+esc(m.atas_nama||'')+'</span>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-2, #f8fafc);border:1px solid var(--border);border-radius:10px">'
        + '<div style="width:36px;height:36px;background:'+(m.jenis==='qris'?'var(--blue-bg, #e0f2fe)':'var(--green-bg, #f0fdf4)')+';border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">'+(m.jenis==='qris'?'📱':'🏦')+'</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(m.bank&&m.bank!==m.nama?m.bank+' · ':'')+esc(m.nama)+'</div>'
        + '<div style="margin-top:2px">'+detail+'</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-shrink:0">'
        + '<button class="btn btn-outline btn-sm" onclick="editMetode(\''+m.id+'\')">Edit</button>'
        + '<button class="btn btn-sm" style="background:var(--red-bg, #fee2e2);color:var(--red-txt, #991b1b);border:1px solid var(--red-l, #fca5a5);font-size:11px" onclick="hapusMetode(\''+m.id+'\',\''+escJs(m.nama)+'\')">Hapus</button>'
        + '</div></div>';
    }).join('');
  } catch(e) { if (el) el.innerHTML = '<div style="color:var(--red);padding:12px">Gagal: '+esc(friendlyError(e))+'</div>'; }
}

var _allMetode = [];

async function bukaFormMetode(data) {
  if (!_allMetode.length) {
    try { var r = await window.HQ.AdminAPI.getMetodeBayar(); _allMetode = r.data||[]; }
    catch(e) { toast(friendlyError(e),'err'); return; }
  }
  var isEdit = !!data;
  document.getElementById('modalMetodeTitle').textContent = isEdit ? 'Edit Metode Bayar' : 'Tambah Metode Bayar';
  document.getElementById('metodeId').value         = (data && data.id) || '';
  document.getElementById('metodeNama').value       = (data && data.nama) || '';
  document.getElementById('metodeBank').value       = (data && data.bank) || '';
  document.getElementById('metodeNomor').value      = (data && data.nomor) || '';
  document.getElementById('metodeAtasNama').value   = (data && data.atas_nama) || '';
  document.getElementById('metodeAtasNamaQris').value = (data && data.atas_nama) || '';
  document.getElementById('metodeQrisUrl').value    = (data && data.qris_url) || '';
  document.getElementById('metodeUrutan').value     = (data && data.urutan) || 1;
  var jenis = (data && data.jenis) || 'rekening';
  document.getElementById('metodeJenis').value = jenis;
  var tabs = document.querySelectorAll('#metodeJenisTabs > div');
  tabs[0].style.borderColor = jenis==='rekening'?'var(--green, #1a5c3a)':'var(--border)';
  tabs[0].style.background  = jenis==='rekening'?'var(--green-bg, #f0fdf4)':'var(--bg-2, #fff)';
  tabs[0].style.color       = jenis==='rekening'?'var(--green-txt, #1a5c3a)':'var(--text-2)';
  tabs[1].style.borderColor = jenis==='qris'?'var(--blue, #0369a1)':'var(--border)';
  tabs[1].style.background  = jenis==='qris'?'var(--blue-bg, #f0f9ff)':'var(--bg-2, #fff)';
  tabs[1].style.color       = jenis==='qris'?'var(--blue-txt, #0369a1)':'var(--text-2)';
  document.getElementById('metodeRekeningFields').style.display = jenis==='rekening'?'':'none';
  document.getElementById('metodeQrisFields').style.display     = jenis==='qris'?'':'none';
  document.getElementById('modalMetode').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function tutupFormMetode() { document.getElementById('modalMetode').classList.remove('open'); document.body.style.overflow=''; }
function setMetodeJenis(jenis, el) {
  document.getElementById('metodeJenis').value = jenis;
  var tabs = document.querySelectorAll('#metodeJenisTabs > div');
  tabs[0].style.borderColor = jenis==='rekening'?'var(--green, #1a5c3a)':'var(--border)';
  tabs[0].style.background  = jenis==='rekening'?'var(--green-bg, #f0fdf4)':'var(--bg-2, #fff)';
  tabs[0].style.color       = jenis==='rekening'?'var(--green-txt, #1a5c3a)':'var(--text-2)';
  tabs[1].style.borderColor = jenis==='qris'?'var(--blue, #0369a1)':'var(--border)';
  tabs[1].style.background  = jenis==='qris'?'var(--blue-bg, #f0f9ff)':'var(--bg-2, #fff)';
  tabs[1].style.color       = jenis==='qris'?'var(--blue-txt, #0369a1)':'var(--text-2)';
  document.getElementById('metodeRekeningFields').style.display = jenis==='rekening'?'':'none';
  document.getElementById('metodeQrisFields').style.display     = jenis==='qris'?'':'none';
}
async function editMetode(id) {
  try {
    var r = await window.HQ.AdminAPI.getMetodeBayar();
    var m = (r.data||[]).find(function(x){return x.id===id;});
    if (m) bukaFormMetode(m);
  } catch(e) { toast(friendlyError(e),'err'); }
}
async function hapusMetode(id, nama) {
  toast('Hapus "'+nama+'"?', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Hapus';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try { await window.HQ.AdminAPI.deleteMetodeBayar(id); toast('Dihapus','ok'); _allMetode=[]; loadMetodeBayarAdmin(); }
    catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}
async function simpanMetode() {
  var jenis = document.getElementById('metodeJenis').value;
  var d = {
    id        : document.getElementById('metodeId').value || undefined,
    nama      : document.getElementById('metodeNama').value.trim(),
    jenis,
    bank      : jenis==='rekening' ? document.getElementById('metodeBank').value.trim() : null,
    nomor     : jenis==='rekening' ? document.getElementById('metodeNomor').value.trim() : null,
    atas_nama : jenis==='rekening' ? document.getElementById('metodeAtasNama').value.trim() : document.getElementById('metodeAtasNamaQris').value.trim(),
    qris_url  : jenis==='qris'     ? document.getElementById('metodeQrisUrl').value.trim() : null,
    urutan    : Number(document.getElementById('metodeUrutan').value)||1,
    aktif     : true,
  };
  if (!d.nama) { showAlertModal('Nama harus diisi', { title: 'Validasi' }); return; }
  try { await window.HQ.AdminAPI.saveMetodeBayar(d); toast('Tersimpan ✅','ok'); _allMetode=[]; tutupFormMetode(); loadMetodeBayarAdmin(); }
  catch(e) { toast(friendlyError(e),'err'); }
}

async function loadSPPAdmin() {
  var tahun     = document.getElementById('sppFilterTahun').value;
  var idHalaqah = document.getElementById('sppFilterHalaqah').value;
  showLoad('Memuat data SPP...');
  try {
    // Isi dropdown halaqah jika belum
    var hqSel = document.getElementById('sppFilterHalaqah');
    if (hqSel.options.length <= 1) {
      var hqRes = await window.HQ.AdminAPI.getAllHalaqah();
      (hqRes.data||[]).forEach(function(h) {
        var opt = document.createElement('option');
        opt.value = h.id_halaqah; opt.textContent = h.nama_halaqah;
        hqSel.appendChild(opt);
      });
    }

    // ── Load pending (independent) ──
    try {
      var pendingRes = await window.HQ.AdminAPI.getSPPPending();
      var pending  = pendingRes.data || [];
      var pendSec  = document.getElementById('sppPendingSection');
      var pendList = document.getElementById('sppPendingList');
      if (pending.length) {
        pendSec.style.display = '';
        pendList.innerHTML = pending.map(function(p) {
          var nominal = p.nominal ? 'Rp '+Number(p.nominal).toLocaleString('id-ID') : '—';
          var jenisBadge = p.jenis === 'SPP Pribadi'
            ? '<span style="background:var(--green-bg, #f0fdf4);color:var(--green-txt, #065f46);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">SPP Pribadi</span>'
            : '<span style="background:var(--amber-bg, #fffbeb);color:var(--amber-txt, #92400e);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">Infaq</span>';
          var isGateway = p.metode_bayar === 'gateway';
          var buktiLink = isGateway
            ? ''
            : (p.bukti_url
                ? '<a href="javascript:void(0)" onclick="openSppLightbox(\''+esc(p.bukti_url)+'\')" style="color:var(--blue-txt, #0369a1);font-size:11px;font-weight:600">🔗 Lihat bukti</a>'
                : '<span style="font-size:11px;color:var(--text-3, #94a3b8)">Tidak ada bukti</span>');
          var actionBtns = '<div style="display:flex;flex-direction:column;align-items:stretch;gap:6px;flex-shrink:0">'
            + (isGateway ? '<span style="display:block;text-align:center;background:linear-gradient(135deg,#e0f2fe,#bae6fd);color:#0369a1;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap">⚡ Otomatis via Gateway</span>' : '')
            + '<div style="display:flex;gap:6px">'
              + (isGateway
                  ? '<button class="btn btn-green btn-sm" style="font-size:12px;padding:7px 12px;flex:1;white-space:nowrap" onclick="konfirmasiManualGateway(\''+esc(p.id_spp)+'\',\''+escJs(p.nama_murid||p.id_murid)+'\',\''+esc((p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||''))+'\')">✅ Konfirmasi Manual</button>'
                  : '<button class="btn btn-green btn-sm" style="font-size:12px;padding:7px 12px;flex:1;white-space:nowrap" onclick="validasiSPP(\''+esc(p.id_spp)+'\',\'lunas\')">✅ Konfirmasi</button>')
              + '<button class="btn btn-sm" style="background:var(--red-bg, #fee2e2);color:var(--red-txt, #991b1b);border:1px solid var(--red-l, #fca5a5);font-size:12px;padding:7px 12px;flex:1;white-space:nowrap" onclick="validasiSPP(\''+esc(p.id_spp)+'\',\'ditolak\')">❌ Tolak</button>'
              + '</div>'
            + '</div>';
          return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-2, #f8fafc);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap">'
            + '<div style="flex:1;min-width:160px">'
            + '<div style="font-size:13.5px;font-weight:800;color:var(--text)">'+esc(p.nama_murid||p.id_murid)+'</div>'
            + '<div style="font-size:11px;color:var(--text-2, #64748b);margin-top:3px">'+jenisBadge
              +' <span style="margin-left:4px">'+esc(p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||'')+'</span>'
              +' &nbsp;·&nbsp; <strong>'+nominal+'</strong>'
              +(p.metode_transfer?'&nbsp;·&nbsp;<span style="background:var(--bg, #f1f5f9);color:var(--text-2, #64748b);padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700">'+esc(p.metode_transfer)+'</span>':'')+'</div>'
            + (p.catatan ? '<div style="font-size:10.5px;color:var(--text-3, #94a3b8);margin-top:3px;font-style:italic">'+esc(p.catatan)+'</div>' : '')
            + (buktiLink ? '<div style="margin-top:4px">'+buktiLink+'</div>' : '')
            + '</div>'
            + actionBtns
            + '</div>';
        }).join('');
      } else {
        pendSec.style.display = 'none';
      }
    } catch(ePend) {
      console.error('getSPPPending error:', ePend);
      toast('Gagal memuat pending: '+ePend.message, 'err');
    }

    // ── Load rekap (independent) ──
    try {
      var rekapRes = await window.HQ.AdminAPI.getSPPRekap({ tahun, id_halaqah: idHalaqah||undefined });
      var rekap = rekapRes.data || {};
      _sppRekapData = rekap.murid_list || [];
      _sppInfaqData = rekap.infaq_list || [];
      _sppIhsanData = rekap.ihsan_list || [];
      
      // Update Dashboard Kinerja SPP Bulanan
      var totalMurid = (rekap.lunas || 0) + (rekap.menunggak || 0);
      var pctLunas = totalMurid > 0 ? Math.round((rekap.lunas || 0) / totalMurid * 100) : 0;
      var totalTunggakanBulan = 0;
      _sppRekapData.forEach(function(m) {
        totalTunggakanBulan += (m.tunggakan || 0);
      });
      var belumTertagih = totalTunggakanBulan * SPP_NOMINAL_BULANAN;

      document.getElementById('sppStatLunas').textContent   = rekap.lunas || 0;
      document.getElementById('sppStatLunasSub').textContent = pctLunas + '% dari ' + totalMurid + ' murid';
      document.getElementById('sppStatTunggak').textContent  = rekap.menunggak || 0;
      document.getElementById('sppStatTunggakSub').textContent  = 'Belum tertagih: Rp ' + belumTertagih.toLocaleString('id-ID');
      document.getElementById('sppStatTotal').textContent   = 'Rp ' + (rekap.total_nominal||0).toLocaleString('id-ID');
      document.getElementById('sppStatTotalSub').innerHTML = 'Gateway: Rp ' + (rekap.spp_gateway_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.spp_gateway_count||0) + 'x)<br>Manual: Rp ' + (rekap.spp_manual_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.spp_manual_count||0) + 'x)';
      document.getElementById('sppStatInfaq').textContent   = 'Rp ' + (rekap.total_infaq||0).toLocaleString('id-ID');
      document.getElementById('sppStatInfaqSub').innerHTML = 'Gateway: Rp ' + (rekap.infaq_gateway_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.infaq_gateway_count||0) + 'x)<br>Manual: Rp ' + (rekap.infaq_manual_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.infaq_manual_count||0) + 'x)';
      document.getElementById('sppStatMasuk').textContent   = 'Rp ' + (rekap.total_masuk||0).toLocaleString('id-ID');
      document.getElementById('sppStatMasukSub').innerHTML = 'Gateway: Rp ' + (rekap.total_gateway_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.total_gateway_count||0) + 'x)<br>Manual: Rp ' + (rekap.total_manual_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.total_manual_count||0) + 'x)';

      // Ihsan Guru & Saldo Net
      document.getElementById('sppStatIhsan').textContent = 'Rp ' + (rekap.total_ihsan||0).toLocaleString('id-ID');
      var netVal = rekap.total_net || 0;
      var netEl = document.getElementById('sppStatNet');
      if (netVal < 0) {
        netEl.style.color = 'var(--red-txt)';
        netEl.textContent = '−Rp ' + Math.abs(netVal).toLocaleString('id-ID');
      } else {
        netEl.style.color = 'var(--green-txt)';
        netEl.textContent = 'Rp ' + netVal.toLocaleString('id-ID');
      }

      // Ember ketiga + kartu Kas Beasiswa
      document.getElementById('sppStatBeasiswa').textContent = rekap.beasiswa_count || 0;
      loadKasBeasiswa(rekap);

      filterSPPTable();
    } catch(eRekap) {
      console.error('getSPPRekap error:', eRekap);
      document.getElementById('sppRekapBody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--red);font-size:12px">Gagal memuat rekap: '+esc(eRekap.message)+'</td></tr>';
    }

  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

// ── Kas Beasiswa & Operasional ─────────────────────────────
var BULAN_LIST = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
var _kasOpItems = [];

function ensureKasBulanOptions() {
  var sel = document.getElementById('kasBeasiswaBulan');
  if (sel && !sel.options.length) {
    sel.innerHTML = BULAN_LIST.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('');
    sel.value = BULAN_LIST[new Date().getMonth()];
  }
}

function renderKasRingkasan(rekap) {
  var fmt = function(n){ return 'Rp ' + (Number(n)||0).toLocaleString('id-ID'); };
  document.getElementById('kasInfaq').textContent = fmt(rekap.beasiswa_infaq_bulanan);
  document.getElementById('kasOperasional').textContent = fmt(rekap.beasiswa_operasional);
  var sisa = Number(rekap.beasiswa_sisa)||0;
  var sisaEl = document.getElementById('kasSisa');
  sisaEl.textContent = (sisa < 0 ? '−Rp ' + Math.abs(sisa).toLocaleString('id-ID') : fmt(sisa));
  sisaEl.style.color = sisa > 0 ? 'var(--green-txt)' : 'var(--text-2)';
  document.getElementById('kasBagian').textContent = fmt(rekap.beasiswa_bagian_per_guru);
  var gc = rekap.beasiswa_guru_count || 0;
  document.getElementById('kasBagianSub').textContent = gc ? ('dibagi rata ' + gc + ' guru') : 'belum ada guru beasiswa';
}

function renderKasOperasionalList(items) {
  var wrap = document.getElementById('kasOperasionalList');
  if (!items || !items.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-3);font-size:12px">Belum ada pengeluaran operasional untuk bulan ini.</div>';
    return;
  }
  wrap.innerHTML = items.map(function(it){
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:8px">'
      + '<div style="min-width:0"><div style="font-size:12px;font-weight:700;color:var(--text)">'+esc(it.keterangan)+'</div>'
      + (it.catatan ? '<div style="font-size:10.5px;color:var(--text-3)">'+esc(it.catatan)+'</div>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      + '<span style="font-size:12px;font-weight:800;color:var(--red-txt)">Rp '+(Number(it.nominal)||0).toLocaleString('id-ID')+'</span>'
      + '<button class="btn btn-ghost btn-sm" style="padding:3px 7px" onclick="editOperasional(\''+esc(it.id_operasional)+'\')">✏️</button>'
      + '<button class="btn btn-red btn-sm" style="padding:3px 7px" onclick="hapusOperasionalItem(\''+esc(it.id_operasional)+'\',\''+escJs(it.keterangan)+'\')">🗑</button>'
      + '</div></div>';
  }).join('');
}

async function loadKasBeasiswa(rekapPrefetch) {
  ensureKasBulanOptions();
  var tahun = Number(document.getElementById('sppFilterTahun') && document.getElementById('sppFilterTahun').value || new Date().getFullYear());
  var idHalaqah = (document.getElementById('sppFilterHalaqah') && document.getElementById('sppFilterHalaqah').value) || '';
  var bulan = document.getElementById('kasBeasiswaBulan').value;
  try {
    var rekap;
    if (rekapPrefetch && rekapPrefetch.beasiswa_bulan === bulan) {
      rekap = rekapPrefetch;
    } else {
      var rr = await window.HQ.AdminAPI.getSPPRekap({ tahun: tahun, bulan: bulan, id_halaqah: idHalaqah||undefined });
      rekap = rr.data || {};
    }
    renderKasRingkasan(rekap);
    var opRes = await window.HQ.AdminAPI.getOperasional({ tahun: tahun, bulan: bulan });
    _kasOpItems = opRes.data || [];
    renderKasOperasionalList(_kasOpItems);
  } catch(e) { console.error('loadKasBeasiswa', e); }
}

function bukaFormOperasional(item) {
  var selB = document.getElementById('opBulan');
  if (!selB.options.length) selB.innerHTML = BULAN_LIST.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('');
  var selT = document.getElementById('opTahun');
  if (!selT.options.length) {
    var yNow = new Date().getFullYear(); var ys = [];
    for (var y=yNow-1; y<=yNow+1; y++) ys.push('<option value="'+y+'">'+y+'</option>');
    selT.innerHTML = ys.join('');
  }
  document.getElementById('opErr').style.display = 'none';
  if (item) {
    document.getElementById('modalOperasionalTitle').textContent = 'Edit Operasional';
    document.getElementById('opId').value = item.id_operasional;
    selB.value = item.bulan; selT.value = item.tahun;
    document.getElementById('opKeterangan').value = item.keterangan || '';
    document.getElementById('opNominal').value = item.nominal || '';
    document.getElementById('opCatatan').value = item.catatan || '';
  } else {
    document.getElementById('modalOperasionalTitle').textContent = 'Tambah Operasional';
    document.getElementById('opId').value = '';
    selB.value = (document.getElementById('kasBeasiswaBulan') && document.getElementById('kasBeasiswaBulan').value) || BULAN_LIST[new Date().getMonth()];
    selT.value = (document.getElementById('sppFilterTahun') && document.getElementById('sppFilterTahun').value) || new Date().getFullYear();
    document.getElementById('opKeterangan').value = '';
    document.getElementById('opNominal').value = '';
    document.getElementById('opCatatan').value = '';
  }
  document.getElementById('modalOperasional').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function tutupFormOperasional() { document.getElementById('modalOperasional').classList.remove('open'); document.body.style.overflow=''; }

function editOperasional(id) {
  var it = (_kasOpItems||[]).find(function(x){ return x.id_operasional === id; });
  if (it) bukaFormOperasional(it);
}

async function simpanOperasional() {
  var id = document.getElementById('opId').value;
  var bulan = document.getElementById('opBulan').value;
  var tahun = document.getElementById('opTahun').value;
  var keterangan = document.getElementById('opKeterangan').value.trim();
  var nominal = document.getElementById('opNominal').value;
  var catatan = document.getElementById('opCatatan').value.trim();
  var err = document.getElementById('opErr');
  if (!keterangan) { err.textContent='Keterangan wajib diisi.'; err.style.display=''; return; }
  if (!nominal || Number(nominal) <= 0) { err.textContent='Nominal harus lebih dari 0.'; err.style.display=''; return; }
  try {
    if (id) await window.HQ.AdminAPI.updateOperasional({ id_operasional:id, bulan:bulan, tahun:tahun, keterangan:keterangan, nominal:nominal, catatan:catatan });
    else    await window.HQ.AdminAPI.tambahOperasional({ bulan:bulan, tahun:tahun, keterangan:keterangan, nominal:nominal, catatan:catatan });
    tutupFormOperasional();
    toast('Operasional tersimpan','ok');
    var kasSel = document.getElementById('kasBeasiswaBulan'); if (kasSel) kasSel.value = bulan;
    loadKasBeasiswa();
  } catch(e) { err.textContent='Gagal: '+(e.message||e); err.style.display=''; }
}

async function hapusOperasionalItem(id, nama) {
  if (!confirm('Hapus operasional "'+nama+'"?')) return;
  try { await window.HQ.AdminAPI.hapusOperasional(id); toast('Operasional dihapus','ok'); loadKasBeasiswa(); }
  catch(e) { toast('Gagal: '+(e.message||e),'err'); }
}

async function toggleTipeSpp(id_anggota, current, nama) {
  var next = current === 'beasiswa' ? 'reguler' : 'beasiswa';
  var label = next === 'beasiswa' ? 'Beasiswa Penuh (SPP Pribadi dibebaskan)' : 'Reguler (SPP Pribadi berbayar)';
  if (!confirm('Ubah tipe SPP ' + nama + ' menjadi:\n' + label + ' ?')) return;
  try {
    await window.HQ.AdminAPI.updateAnggota({ id_anggota: id_anggota, tipe_spp: next });
    var row = (window._anggotaAllRows||[]).find(function(r){ return r.id_anggota === id_anggota; });
    if (row) row.tipe_spp = next;
    renderAnggotaTable();
    toast(nama + ' → ' + label, 'ok');
  } catch(e) { toast('Gagal: ' + (e.message||e), 'err'); }
}

function filterSPPTable() {
  var jenis = document.getElementById('sppFilterJenis')?.value || 'spp';
  var statusFilter = document.getElementById('sppFilterStatus')?.value || '';
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var modeLunasBulan = jenis !== 'infaq' && !!bulanFilter && statusFilter === 'lunas';

  // Toggle visibilitas kontrol yang hanya relevan untuk SPP Pribadi
  var statusSel = document.getElementById('sppFilterStatus');
  var btnSalin  = document.getElementById('btnSalinTagihan');
  var subtitle  = document.getElementById('sppRekapSubtitle');
  if (statusSel) statusSel.style.display = (jenis === 'infaq' || jenis === 'ihsan') ? 'none' : '';
  if (btnSalin)  btnSalin.style.display  = (jenis === 'infaq' || jenis === 'ihsan') ? 'none' : '';
  if (subtitle)  subtitle.textContent    = jenis === 'infaq'
    ? 'Daftar pembayaran Infaq/Operasional yang sudah lunas'
    : jenis === 'ihsan'
      ? 'Daftar pembayaran Ihsan Guru (Gaji)'
      : modeLunasBulan
        ? 'Murid yang sudah membayar SPP Pribadi ' + bulanFilter
        : 'Rekap tunggakan SPP Pribadi per bulan';

  // Ganti header tabel sesuai jenis
  var thead = document.getElementById('sppRekapHead');
  thead.innerHTML = jenis === 'infaq'
    ? '<tr><th>Nama Murid</th><th>Halaqah</th><th>Bulan</th><th>Tanggal Bayar</th><th class="align-right">Nominal</th></tr>'
    : jenis === 'ihsan'
      ? '<tr><th>Nama Guru</th><th>Status</th><th>Bulan</th><th>Tanggal Bayar</th><th class="align-right">Nominal / Keterangan</th></tr>'
      : modeLunasBulan
        ? '<tr><th>Nama Murid</th><th>Halaqah</th><th class="align-center">Tunggakan</th><th>Status ' + bulanFilter + '</th><th class="align-center">Reminder</th></tr>'
        : '<tr><th>Nama Murid</th><th>Halaqah</th><th class="align-center">Tunggakan</th><th>Bulan Belum Lunas</th><th class="align-center">Reminder</th></tr>';

  if (jenis === 'infaq') return filterInfaqTable();
  if (jenis === 'ihsan') return filterIhsanTable();

  var searchVal   = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppRekapData;

  // Kombinasi "Bulan" + "Lunas" → tampilkan murid yang SUDAH membayar
  // bulan tersebut (bukan "tunggakan 0 secara keseluruhan").
  if (modeLunasBulan) {
    data = data.filter(function(m) {
      return (m.lunas_bulan||[]).includes(bulanFilter);
    });
  } else {
    // 1. Filter bulan (default: murid yang BELUM bayar bulan tsb)
    if (bulanFilter) {
      data = data.filter(function(m) {
        return m.bulan_belum.includes(bulanFilter);
      });
    }

    // 2. Filter status pembayaran
    if (statusFilter) {
      if (statusFilter === 'lunas') {
        data = data.filter(function(m) { return m.tunggakan === 0; });
      } else if (statusFilter === 'menunggak') {
        data = data.filter(function(m) { return m.tunggakan > 0; });
      } else if (statusFilter === 'tunggakan_berat') {
        data = data.filter(function(m) { return m.tunggakan >= 3; });
      }
    }
  }

  // 3. Filter pencarian teks (Nama, NIS, Halaqah, Level)
  if (searchVal) {
    data = data.filter(function(m) {
      var namaMatch  = (m.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (m.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var halaqahMatch = (m.nama_halaqah || m.id_halaqah || '').toLowerCase().indexOf(searchVal) !== -1;
      var levelMatch = (m.level || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || halaqahMatch || levelMatch;
    });
  }

  // Simpan data terfilter ke variabel global untuk proses ekspor
  _sppRekapDataFiltered = data;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Tidak ada data.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(function(m) {
    var badgeClass = m.tunggakan===0
      ? 'badge b-green'
      : m.tunggakan>=3
      ? 'badge b-red'
      : 'badge b-amber';
    var bulanBelum;
    if (modeLunasBulan) {
      bulanBelum = '<span class="badge b-green">✅ Lunas '+esc(bulanFilter)+'</span>';
    } else if (m.tunggakan === 0) {
      bulanBelum = '<span class="badge b-green">✅ Lunas</span>';
    } else if (m.bulan_belum.length) {
      bulanBelum = m.bulan_belum.map(function(b){ return '<span class="tag-spp-belum">'+b+'</span>'; }).join('');
    } else {
      bulanBelum = '<span class="tag-spp-belum">'+m.tunggakan+' bulan belum lunas</span>';
    }
    var waLink = '';
    if (m.no_hp && m.tunggakan > 0) {
      var num = m.no_hp.replace(/\D/g,'');
      if (num.startsWith('0')) num = '62' + num.slice(1);
      else if (!num.startsWith('62')) num = '62' + num;
      var nominal = m.tunggakan * SPP_NOMINAL_BULANAN;
      var msg = 'Assalamualaikum ' + m.nama_murid + ',\n\n'
        + 'Izin Kami ingatkan kembali perihal pembayaran SPP yang belum tertunaikan:\n\n'
        + 'Bulan : ' + (m.bulan_belum.length ? m.bulan_belum.join(', ') : (m.tunggakan + ' bulan terakhir')) + '\n'
        + 'Total : Rp ' + nominal.toLocaleString('id-ID') + '\n\n'
        + 'Cara pembayaran:\n'
        + '1. Buka Portal Rattililqur\'an → menu *SPP* → *Konfirmasi SPP* (info rekening/QRIS terbaru ada di sana)\n'
        + '2. Transfer sesuai nominal, lalu pilih bulan & metode bayar dan upload bukti transfer\n\n'
        + 'Jika ada kendala teknis ataupun finansial, jangan ragu hubungi kami. Semoga Allah mudahkan. Jazakumullahu khairan. 🤲\n\n'
        + '-Data ini direkap otomatis melalui portal Rattililqur\'an, jika ada ketidak cocokan data mohon untuk konfirmasi-';
      waLink = '<a href="https://wa.me/'+num+'?text='+encodeURIComponent(msg)+'" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#25D366;color:#fff;border-radius:8px;font-size:10.5px;font-weight:700;text-decoration:none">💬 WA</a>';
    }
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(m.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(m.id_murid)+' · '+esc(m.level||'')+'</div></td>'
      + '<td><div style="font-weight:600;color:var(--text-2)">'+esc(m.nama_halaqah||m.id_halaqah||'—')+'</div></td>'
      + '<td class="align-center"><span class="'+badgeClass+'" style="min-width:28px;justify-content:center">'+m.tunggakan+'</span></td>'
      + '<td>'+bulanBelum+'</td>'
      + '<td class="align-center">'+waLink+'</td>'
      + '</tr>';
  }).join('');
}

function filterInfaqTable() {
  var searchVal = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppInfaqData;

  // Filter bulan
  if (bulanFilter) {
    data = data.filter(function(r) { return r.bulan === bulanFilter; });
  }

  // Filter pencarian teks (Nama, NIS, Halaqah, Level)
  if (searchVal) {
    data = data.filter(function(r) {
      var namaMatch  = (r.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (r.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var halaqahMatch = (r.nama_halaqah || r.id_halaqah || '').toLowerCase().indexOf(searchVal) !== -1;
      var levelMatch = (r.level || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || halaqahMatch || levelMatch;
    });
  }

  _sppInfaqDataFiltered = data;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Tidak ada data.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(function(r) {
    var metodeBadge = r.metode_bayar === 'gateway'
      ? '<span style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);color:#0369a1;padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700">⚡ Gateway</span>'
      : '<span style="background:var(--bg, #f1f5f9);color:var(--text-2, #64748b);padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700">Manual</span>';
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(r.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(r.id_murid)+' · '+esc(r.level||'')+'</div></td>'
      + '<td><div style="font-weight:600;color:var(--text-2)">'+esc(r.nama_halaqah||r.id_halaqah||'—')+'</div></td>'
      + '<td>'+esc(r.bulan||'')+' '+esc(String(r.tahun||''))+'</td>'
      + '<td>'+esc(r.tanggal_bayar||'—')+'</td>'
      + '<td class="align-right"><strong>Rp '+Number(r.nominal||0).toLocaleString('id-ID')+'</strong><br>'+metodeBadge+'</td>'
      + '</tr>';
  }).join('');
}

function filterIhsanTable() {
  var searchVal = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppIhsanData;

  // Filter bulan
  if (bulanFilter) {
    data = data.filter(function(r) { return r.bulan === bulanFilter; });
  }

  // Filter pencarian teks (Nama Guru, ID Guru, Catatan)
  if (searchVal) {
    data = data.filter(function(r) {
      var namaMatch  = (r.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (r.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var catatanMatch = (r.catatan || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || catatanMatch;
    });
  }

  _sppIhsanDataFiltered = data;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">Tidak ada data pembayaran Ihsan Guru.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(function(r) {
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(r.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(r.id_murid)+' · Guru</div></td>'
      + '<td><span class="badge b-green" style="font-size:10.5px">Lunas</span></td>'
      + '<td>'+esc(r.bulan||'')+' '+esc(String(r.tahun||''))+'</td>'
      + '<td>'+esc(r.tanggal_bayar||'—')+'</td>'
      + '<td class="align-right"><strong>Rp '+Number(r.nominal||0).toLocaleString('id-ID')+'</strong><br><span style="font-size:10.5px;color:var(--text-3)">'+esc(r.catatan||'Gaji Guru')+'</span></td>'
      + '</tr>';
  }).join('');
}

// Cegah CSV/Formula Injection: jika nilai diawali =,+,-,@ (atau tab/CR),
// Excel/Sheets bisa menafsirkannya sebagai formula saat file dibuka.
// Beri prefiks tanda kutip tunggal agar dibaca sebagai teks biasa.
function _csvSafe(val) {
  var s = String(val == null ? '' : val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function eksporSPP() {
  var jenis = document.getElementById('sppFilterJenis')?.value || 'spp';
  var tahun = document.getElementById('sppFilterTahun').value;
  var halaqahVal = document.getElementById('sppFilterHalaqah').value || 'Semua-Halaqah';
  var bulanVal = document.getElementById('sppFilterBulan').value || 'Semua-Bulan';

  var csv, namaFile;
  if (jenis === 'infaq') {
    var infaqList = _sppInfaqDataFiltered || [];
    if (!infaqList.length) {
      showAlertModal('Tidak ada data Infaq untuk diekspor.', { title: 'Ekspor Infaq' });
      return;
    }
    csv = 'ID Murid;Nama Murid;Halaqah;Level;Bulan;Tahun;Tanggal Bayar;Nominal;Metode\r\n';
    infaqList.forEach(function(r) {
      var nama = _csvSafe(r.nama_murid || '');
      var hal = _csvSafe(r.nama_halaqah || r.id_halaqah || '—');
      var lvl = _csvSafe(r.level || '');
      var metode = _csvSafe(r.metode_bayar === 'gateway' ? 'Gateway' : 'Manual');
      csv += '"' + _csvSafe(r.id_murid) + '";"' + nama + '";"' + hal + '";"' + lvl + '";"' + _csvSafe(r.bulan) + '";' + r.tahun + ';"' + _csvSafe(r.tanggal_bayar||'') + '";' + Number(r.nominal||0) + ';"' + metode + '"\r\n';
    });
    namaFile = 'rekap_infaq_' + tahun + '_' + halaqahVal + '_' + bulanVal + '.csv';
  } else if (jenis === 'ihsan') {
    var ihsanList = _sppIhsanDataFiltered || [];
    if (!ihsanList.length) {
      showAlertModal('Tidak ada data Ihsan Guru untuk diekspor.', { title: 'Ekspor Ihsan Guru' });
      return;
    }
    csv = 'ID Guru;Nama Guru;Bulan;Tahun;Tanggal Bayar;Nominal;Catatan\r\n';
    ihsanList.forEach(function(r) {
      var nama = _csvSafe(r.nama_murid || '');
      csv += '"' + _csvSafe(r.id_murid) + '";"' + nama + '";"' + _csvSafe(r.bulan) + '";' + r.tahun + ';"' + _csvSafe(r.tanggal_bayar||'') + '";' + Number(r.nominal||0) + ';"' + _csvSafe(r.catatan||'') + '"\r\n';
    });
    namaFile = 'rekap_ihsan_guru_' + tahun + '_' + bulanVal + '.csv';
  } else {
    var list = _sppRekapDataFiltered || [];
    if (!list.length) {
      showAlertModal('Tidak ada data SPP untuk diekspor.', { title: 'Ekspor SPP' });
      return;
    }
    var statusVal = document.getElementById('sppFilterStatus').value || 'Semua-Status';
    csv = 'ID Murid;Nama Murid;Halaqah;Level;Tunggakan Bulan;Bulan Belum Lunas;No HP\r\n';
    list.forEach(function(m) {
      var nama = _csvSafe(m.nama_murid || '');
      var hal = _csvSafe(m.nama_halaqah || m.id_halaqah || '—');
      var lvl = _csvSafe(m.level || '');
      var bln = _csvSafe(m.tunggakan === 0 ? 'Lunas' : (m.bulan_belum.length ? m.bulan_belum.join(', ') : m.tunggakan + ' bulan belum lunas'));
      var hp  = _csvSafe(m.no_hp || '');
      csv += '"' + _csvSafe(m.id_murid) + '";"' + nama + '";"' + hal + '";"' + lvl + '";' + m.tunggakan + ';"' + bln + '";"' + hp + '"\r\n';
    });
    namaFile = 'rekap_spp_' + tahun + '_' + halaqahVal + '_' + bulanVal + '_' + statusVal + '.csv';
  }

  // UTF-8 BOM agar terbaca dengan benar di Excel (Indonesian locale)
  var blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');

  a.href   = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function salinTagihanMassal() {
  var list = _sppRekapDataFiltered || [];
  var menunggakList = list.filter(function(m) { return m.tunggakan > 0; });
  if (!menunggakList.length) {
    showAlertModal('Tidak ada data murid yang menunggak untuk disalin.', { title: 'Salin Tagihan' });
    return;
  }
  
  var tahun = document.getElementById('sppFilterTahun').value;
  var bulanVal = document.getElementById('sppFilterBulan').value;
  var halaqahVal = document.getElementById('sppFilterHalaqah').value;
  var namaHalaqah = '';
  if (halaqahVal) {
    var hq = (allHalaqah||[]).find(h => h.id_halaqah === halaqahVal);
    namaHalaqah = hq ? hq.nama_halaqah : halaqahVal;
  }
  
  var txt = '*REKAP TAGIHAN SPP RATTILILQUR\'AN*\n'
    + (namaHalaqah ? '📚 Kelas: *' + namaHalaqah + '*\n' : '')
    + (bulanVal ? '📅 Acuan Bulan: *' + bulanVal + '*\n' : '')
    + '📅 Tahun: *' + tahun + '*\n\n'
    + 'Mohon kerja samanya untuk menyelesaikan amanah SPP:\n\n';
    
  menunggakList.forEach(function(m, idx) {
    var nominal = m.tunggakan * SPP_NOMINAL_BULANAN;
    txt += (idx + 1) + '. *' + m.nama_murid + '* (' + m.id_murid + ')\n'
      + '   • Tunggakan: *' + m.tunggakan + ' bulan*' + (m.bulan_belum.length ? ' (' + m.bulan_belum.join(', ') + ')' : '') + '\n'
      + '   • Total Tagihan: *Rp ' + nominal.toLocaleString('id-ID') + '*\n\n';
  });
  
  txt += 'Pembayaran dapat ditransfer ke rekening resmi lembaga. Semoga Allah mudahkan rezeki Bapak/Ibu sekalian. Jazakumullahu khairan 🤲';
  
  navigator.clipboard.writeText(txt).then(function() {
    toast('Teks rekap tagihan disalin ke clipboard! 📋', 'ok');
  }).catch(function() {
    // Fallback
    var el = document.createElement('textarea');
    el.value = txt;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast('Teks rekap tagihan disalin ke clipboard! 📋', 'ok');
  });
}

async function konfirmasiManualGateway(id_spp, namaMurid, bulanTahun) {
  var msg = '⚠️ Baris ini adalah tagihan <strong>Gateway (Mayar)</strong> yang BELUM otomatis lunas.<br><br>'
    + 'Sebelum konfirmasi manual, pastikan Anda sudah <strong>cek riwayat transaksi di Mayar Dashboard</strong> dan '
    + esc(namaMurid) + ' <strong>BENAR-BENAR SUDAH MEMBAYAR</strong> SPP ' + esc(bulanTahun) + '.<br><br>'
    + 'Jika belum dibayar, klik <strong>Batal</strong> — konfirmasi yang salah akan membuat status "Lunas" padahal belum dibayar.';
  var ok = await showConfirm('', { html: msg, title: 'Double Check: Sudah Dibayar?', okText: 'Ya, Sudah Saya Cek & Lunas', danger: true });
  if (!ok) return;
  validasiSPP(id_spp, 'lunas');
}

var _sppRiwayatLoaded = false;
function toggleSPPRiwayat() {
  var sec = document.getElementById('sppRiwayatSection');
  var hidden = sec.style.display === 'none';
  sec.style.display = hidden ? 'flex' : 'none';
  if (hidden && !_sppRiwayatLoaded) loadSPPRiwayat();
}

async function loadSPPRiwayat() {
  var listEl = document.getElementById('sppRiwayatSection');
  listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:13px">Memuat...</div>';
  try {
    var res = await window.HQ.AdminAPI.getSPPRecentValidasi();
    _sppRiwayatLoaded = true;
    var rows = res.data || [];
    if (!rows.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:13px">Belum ada riwayat konfirmasi.</div>';
      return;
    }
    listEl.innerHTML = rows.map(function(p) {
      var nominal = p.nominal ? 'Rp '+Number(p.nominal).toLocaleString('id-ID') : '—';
      var isGateway  = p.metode_bayar === 'gateway' && !p.validated_by;
      var bulanTahun = (p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||'');
      var statusBadge = p.status === 'lunas'
        ? '<span style="background:var(--green-bg,#f0fdf4);color:var(--green-txt,#065f46);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">Lunas</span>'
        : '<span style="background:var(--red-bg,#fee2e2);color:var(--red-txt,#991b1b);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">Ditolak</span>';
      var sumberBadge = isGateway
        ? '<span style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);color:#0369a1;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">⚡ Gateway</span>'
        : '<span style="background:var(--bg,#f1f5f9);color:var(--text-2,#64748b);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">Manual Admin</span>';
      var when = fmtDate(p.validated_at || p.tanggal_bayar);
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-2, #f8fafc);border-radius:10px;border:1px solid var(--border);flex-wrap:wrap">'
        + '<div style="flex:1;min-width:160px">'
        + '<div style="font-size:13px;font-weight:800;color:var(--text)">'+esc(p.nama_murid||p.id_murid)+'</div>'
        + '<div style="font-size:11px;color:var(--text-2, #64748b);margin-top:3px">'+statusBadge+' '+sumberBadge
          +' <span style="margin-left:4px">'+esc(bulanTahun)+'</span>'
          +' &nbsp;·&nbsp; <strong>'+nominal+'</strong>'
          +' &nbsp;·&nbsp; <span style="color:var(--text-3, #94a3b8)">'+esc(when)+'</span></div>'
        + '</div>'
        + '<button class="btn btn-sm" style="background:var(--amber-bg, #fffbeb);color:var(--amber-txt, #92400e);border:1px solid #fcd34d;font-size:12px;padding:7px 12px;flex-shrink:0" '
          + 'onclick="batalkanKonfirmasi(\''+esc(p.id_spp)+'\',\''+escJs(p.nama_murid||p.id_murid)+'\',\''+escJs(bulanTahun)+'\',\''+p.status+'\')">↩️ Batalkan</button>'
        + '</div>';
    }).join('');
  } catch(e) {
    listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#ef4444;font-size:13px">Gagal memuat riwayat: '+esc(friendlyError(e))+'</div>';
  }
}

async function batalkanKonfirmasi(id_spp, namaMurid, bulanTahun, statusSebelumnya) {
  var aksiLabel = statusSebelumnya === 'lunas' ? 'LUNAS' : 'DITOLAK';
  var msg = '⚠️ Anda akan membatalkan konfirmasi <strong>' + aksiLabel + '</strong> untuk '
    + esc(namaMurid) + ' — SPP ' + esc(bulanTahun) + '.<br><br>'
    + 'Status akan dikembalikan ke <strong>"Menunggu Validasi"</strong> agar bisa dikonfirmasi/ditolak ulang dengan benar.<br><br>'
    + 'Pastikan ini memang salah konfirmasi sebelum lanjut.';
  var ok = await showConfirm('', { html: msg, title: 'Batalkan Konfirmasi?', okText: 'Ya, Batalkan', danger: true });
  if (!ok) return;
  showLoad('Membatalkan...');
  try {
    var r = await window.HQ.AdminAPI.batalkanValidasiSPP(id_spp);
    if (r && r.status === 'error') {
      toast(r.message || 'Gagal membatalkan.', 'warn');
    } else {
      toast('Konfirmasi dibatalkan, status kembali ke Menunggu ✅', 'ok');
    }
    _sppRiwayatLoaded = false;
    loadSPPRiwayat();
    loadSPPAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function validasiSPP(id_spp, aksi) {
  showLoad(aksi==='lunas'?'Mengkonfirmasi...':'Menolak...');
  try {
    var r = await window.HQ.AdminAPI.validasiSPP(id_spp, aksi);
    if (r && r.status === 'error') {
      toast(r.message || 'Pengajuan ini sudah divalidasi sebelumnya.', 'warn');
    } else {
      toast(aksi==='lunas'?'Pembayaran dikonfirmasi ✅':'Pembayaran ditolak', aksi==='lunas'?'ok':'warn');
    }
    loadSPPAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  INPUT SPP MANUAL OLEH ADMIN
// ══════════════════════════════════════════
var _sppManualMuridCache = [];
var _sppManualGuruCache = [];
var _sppManualSessionCount = 0;
var _sppManualBulanLunas = [];
var _sppManualBulanMenunggu = [];
var BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function bukaModalInputSPPManual(defaultJenis) {
  _sppManualSessionCount = 0;
  document.getElementById('sppManualCounter').textContent = '';
  document.getElementById('sppManualMuridSearch').value = '';
  document.getElementById('sppManualMuridId').value = '';
  document.getElementById('sppManualMuridInfo').style.display = 'none';
  document.getElementById('sppManualErr').style.display = 'none';
  document.getElementById('sppManualNominal').value = '';
  document.getElementById('sppManualNominalHint').textContent = '';
  var jenis = defaultJenis || 'SPP Pribadi';
  document.getElementById('sppManualCatatan').value = jenis === 'Ihsan Guru' ? 'Ihsan Guru' : 'Sinkronisasi data lama';
  // Default tahun dari filter SPP jika ada
  var filterTahun = document.getElementById('sppFilterTahun');
  if (filterTahun) document.getElementById('sppManualTahun').value = filterTahun.value;
  // Reset jenis ke default
  setSPPManualJenis(jenis, null);
  // Reset bulan grid
  renderSPPManualBulanGrid([], []);
  // Load murid list (cache)
  if (!_sppManualMuridCache.length) {
    try {
      var r = await window.HQ.AdminAPI.getAllAnggota();
      _sppManualMuridCache = (r.data||[]).filter(function(a){ return a.status === 'aktif'; });
      // Sort by tunggakan (dari _sppRekapData jika sudah loaded)
      if (_sppRekapData && _sppRekapData.length) {
        var tunggakMap = {};
        _sppRekapData.forEach(function(m){ tunggakMap[m.id_murid] = m.tunggakan || 0; });
        _sppManualMuridCache.sort(function(a,b){
          var tA = tunggakMap[a.id_murid] || 0;
          var tB = tunggakMap[b.id_murid] || 0;
          return tB - tA || (a.nama_murid||'').localeCompare(b.nama_murid||'');
        });
      } else {
        _sppManualMuridCache.sort(function(a,b){ return (a.nama_murid||'').localeCompare(b.nama_murid||''); });
      }
    } catch(e) { toast('Gagal memuat daftar murid: '+friendlyError(e), 'err'); }
  }
  document.getElementById('modalInputSPPManual').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus search
  setTimeout(function(){ document.getElementById('sppManualMuridSearch').focus(); }, 150);
}

function tutupModalInputSPPManual() {
  document.getElementById('modalInputSPPManual').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('sppManualMuridDropdown').style.display = 'none';
  // Jika ada data yang diinput, refresh halaman SPP
  if (_sppManualSessionCount > 0) loadSPPAdmin();
}

function filterMuridSPPManual() {
  var jenis = document.getElementById('sppManualJenis').value;
  var q = (document.getElementById('sppManualMuridSearch').value || '').toLowerCase().trim();
  var dd = document.getElementById('sppManualMuridDropdown');
  
  if (jenis === 'Ihsan Guru') {
    var list = _sppManualGuruCache;
    if (q) {
      list = list.filter(function(a) {
        return (a.nama_lengkap||'').toLowerCase().indexOf(q) !== -1
          || (a.id_user||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!list.length) {
      dd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">Tidak ditemukan</div>';
      dd.style.display = '';
      return;
    }
    dd.innerHTML = list.slice(0, 30).map(function(a) {
      return '<div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;justify-content:space-between" '
        + 'onmousedown="pilihMuridSPPManual(\''+esc(a.id_user)+'\',\''+escJs(a.nama_lengkap||'')+'\',\'Guru\')">'
        + '<div><span style="font-weight:700;color:var(--text)">'+esc(a.nama_lengkap)+'</span>'
        + '<span style="font-size:11px;color:var(--text-3);margin-left:6px">'+esc(a.id_user)+'</span></div>'
        + '</div>';
    }).join('');
    dd.style.display = '';
  } else {
    var list = _sppManualMuridCache;
    if (q) {
      list = list.filter(function(a) {
        return (a.nama_murid||'').toLowerCase().indexOf(q) !== -1
          || (a.id_murid||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!list.length) {
      dd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">Tidak ditemukan</div>';
      dd.style.display = '';
      return;
    }
    // Get tunggakan info
    var tunggakMap = {};
    if (_sppRekapData && _sppRekapData.length) {
      _sppRekapData.forEach(function(m){ tunggakMap[m.id_murid] = m.tunggakan || 0; });
    }
    dd.innerHTML = list.slice(0, 30).map(function(a) {
      var t = tunggakMap[a.id_murid] || 0;
      var badge = t > 0
        ? '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--red-bg,#fee2e2);color:var(--red-txt,#991b1b);font-weight:700;margin-left:6px">' + t + ' bln tunggak</span>'
        : '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--green-bg,#f0fdf4);color:var(--green-txt,#065f46);font-weight:700;margin-left:6px">Lunas</span>';
      return '<div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;justify-content:space-between" '
        + 'onmousedown="pilihMuridSPPManual(\''+esc(a.id_murid)+'\',\''+escJs(a.nama_murid||'')+'\',\''+escJs((a.halaqah&&a.halaqah.nama_halaqah)||a.id_halaqah||'')+'\')">'
        + '<div><span style="font-weight:700;color:var(--text)">'+esc(a.nama_murid||a.id_murid)+'</span>'
        + '<span style="font-size:11px;color:var(--text-3);margin-left:6px">'+esc(a.id_murid)+'</span></div>'
        + badge + '</div>';
    }).join('');
    dd.style.display = '';
  }
}

async function pilihMuridSPPManual(id_murid, nama, halaqah) {
  document.getElementById('sppManualMuridSearch').value = nama;
  document.getElementById('sppManualMuridId').value = id_murid;
  document.getElementById('sppManualMuridDropdown').style.display = 'none';
  var info = document.getElementById('sppManualMuridInfo');
  info.textContent = '✅ ' + nama + (halaqah ? ' · ' + halaqah : '');
  info.style.display = '';
  
  // Load status SPP/Ihsan bulan
  var tahun = document.getElementById('sppManualTahun').value;
  var jenis = document.getElementById('sppManualJenis').value;
  
  try {
    if (jenis === 'Ihsan Guru') {
      var r = await window.HQ.AdminAPI.getIhsanStatusGuru(id_murid, Number(tahun));
      _sppManualBulanLunas = r.data.lunas || [];
      _sppManualBulanMenunggu = [];
    } else {
      var r = await window.HQ.AdminAPI.getSPPStatusMurid(id_murid, Number(tahun));
      _sppManualBulanLunas = r.data.lunas || [];
      _sppManualBulanMenunggu = r.data.menunggu || [];
    }
  } catch(e) { 
    _sppManualBulanLunas = []; 
    _sppManualBulanMenunggu = []; 
  }
  
  renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  hitungNominalSPPManual();
}

function renderSPPManualBulanGrid(lunas, menunggu) {
  var jenis = document.getElementById('sppManualJenis').value;
  var isInfaq = jenis === 'Infaq/Operasional';
  var grid = document.getElementById('sppManualBulanGrid');
  grid.innerHTML = BULAN_NAMES.map(function(b) {
    var isLunas = !isInfaq && lunas.includes(b);
    var isMenunggu = !isInfaq && menunggu.includes(b);
    var disabled = isLunas ? 'pointer-events:none;opacity:0.5;' : '';
    var label = isLunas ? '✅ ' + b : isMenunggu ? '⏳ ' + b : b;
    var bgChecked = isLunas
      ? 'background:var(--green-bg,#f0fdf4);border-color:var(--green,#1a5c3a);color:var(--green-txt,#065f46);'
      : isMenunggu
        ? 'background:var(--amber-bg,#fffbeb);border-color:#fcd34d;color:var(--amber-txt,#92400e);'
        : '';
    return '<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;user-select:none;transition:all .15s;'+disabled+bgChecked+'" '
      + 'onchange="hitungNominalSPPManual()">'
      + '<input type="checkbox" name="sppManualBulan" value="'+b+'" '+(isLunas?'disabled checked':'')+' style="accent-color:var(--green,#1a5c3a)">'
      + label + '</label>';
  }).join('');
}

function hitungNominalSPPManual() {
  var jenis = document.getElementById('sppManualJenis')?.value || 'SPP Pribadi';
  var hint = document.getElementById('sppManualNominalHint');
  if (jenis !== 'SPP Pribadi') {
    if (hint) hint.textContent = 'Masukkan nominal secara manual';
    return;
  }
  var checked = document.querySelectorAll('input[name=sppManualBulan]:checked:not(:disabled)');
  var count = checked.length;
  var nominal = count * SPP_NOMINAL_BULANAN;
  document.getElementById('sppManualNominal').value = nominal;
  if (hint) {
    if (count > 0) {
      hint.textContent = count + ' bulan × Rp ' + SPP_NOMINAL_BULANAN.toLocaleString('id-ID') + ' = Rp ' + nominal.toLocaleString('id-ID');
    } else {
      hint.textContent = 'Pilih bulan terlebih dahulu';
    }
  }
}

function pilihSemuaBelumLunas() {
  var boxes = document.querySelectorAll('input[name=sppManualBulan]:not(:disabled)');
  var allChecked = Array.from(boxes).every(function(b){ return b.checked; });
  boxes.forEach(function(b){ b.checked = !allChecked; });
  hitungNominalSPPManual();
}

function setSPPManualJenis(jenis, el) {
  document.getElementById('sppManualJenis').value = jenis;
  var tabs = document.querySelectorAll('#sppManualJenisTabs > div');
  if (tabs.length === 3) {
    // Reset all tabs
    tabs.forEach(function(t) {
      t.style.borderColor = 'var(--border)';
      t.style.background  = 'var(--bg-2,#fff)';
      t.style.color       = 'var(--text-2)';
    });
    // Highlight selected tab
    if (jenis === 'SPP Pribadi') {
      tabs[0].style.borderColor = 'var(--green,#1a5c3a)';
      tabs[0].style.background  = 'var(--green-bg,#f0fdf4)';
      tabs[0].style.color       = 'var(--green-txt,#1a5c3a)';
    } else if (jenis === 'Infaq/Operasional') {
      tabs[1].style.borderColor = 'var(--amber,#f59e0b)';
      tabs[1].style.background  = 'var(--amber-bg,#fffbeb)';
      tabs[1].style.color       = 'var(--amber-txt,#92400e)';
    } else if (jenis === 'Ihsan Guru') {
      tabs[2].style.borderColor = 'var(--red,#ef4444)';
      tabs[2].style.background  = 'var(--red-bg,#fee2e2)';
      tabs[2].style.color       = 'var(--red-txt,#991b1b)';
    }
  }

  // Update label & placeholder
  var modalEl = document.getElementById('modalInputSPPManual');
  var labelMurid = modalEl ? modalEl.querySelector('label') : null;
  var searchInput = document.getElementById('sppManualMuridSearch');
  
  if (labelMurid && searchInput) {
    if (jenis === 'Ihsan Guru') {
      labelMurid.textContent = 'Penerima (Guru)';
      searchInput.placeholder = 'Ketik nama guru...';
    } else {
      labelMurid.textContent = 'Murid';
      searchInput.placeholder = 'Ketik nama murid...';
    }
  }

  // Kosongkan selection jika berganti jenis
  if (el) {
    searchInput.value = '';
    document.getElementById('sppManualMuridId').value = '';
    document.getElementById('sppManualMuridInfo').style.display = 'none';
    _sppManualBulanLunas = [];
    _sppManualBulanMenunggu = [];
  }

  // Load daftar guru jika belum ada & memilih Ihsan Guru
  if (jenis === 'Ihsan Guru' && !_sppManualGuruCache.length) {
    showLoad('Memuat daftar guru...');
    window.HQ.AdminAPI.getAllUsers('guru').then(function(r) {
      _sppManualGuruCache = (r.data || []).filter(function(u) { return u.status === 'aktif'; });
      _sppManualGuruCache.sort(function(a,b){ return (a.nama_lengkap||'').localeCompare(b.nama_lengkap||''); });
      hideLoad();
    }).catch(function(e) {
      toast('Gagal memuat daftar guru: ' + e.message, 'err');
      hideLoad();
    });
  }

  // Re-render bulan grid (infaq & ihsan: semua bisa dipilih, SPP: pakai lunas state)
  if (jenis === 'Infaq/Operasional' || jenis === 'Ihsan Guru') {
    renderSPPManualBulanGrid([], []);
  } else {
    renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  }
  hitungNominalSPPManual();

  // Tombol pilih semua hanya untuk SPP
  var btnAll = document.getElementById('btnPilihSemuaBelum');
  if (btnAll) btnAll.style.display = (jenis === 'SPP Pribadi') ? '' : 'none';
}

async function onSPPManualTahunChange() {
  var id_murid = document.getElementById('sppManualMuridId').value;
  if (!id_murid) return;
  var tahun = document.getElementById('sppManualTahun').value;
  try {
    var r = await window.HQ.AdminAPI.getSPPStatusMurid(id_murid, Number(tahun));
    _sppManualBulanLunas = r.data.lunas || [];
    _sppManualBulanMenunggu = r.data.menunggu || [];
  } catch(e) { _sppManualBulanLunas = []; _sppManualBulanMenunggu = []; }
  renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  hitungNominalSPPManual();
}

async function submitInputSPPManual() {
  var errEl = document.getElementById('sppManualErr');
  errEl.style.display = 'none';
  var id_murid = document.getElementById('sppManualMuridId').value;
  var jenis = document.getElementById('sppManualJenis').value;
  if (!id_murid) {
    errEl.textContent = jenis === 'Ihsan Guru' ? 'Pilih guru terlebih dahulu.' : 'Pilih murid terlebih dahulu.';
    errEl.style.display = '';
    return;
  }
  var checkedBoxes = document.querySelectorAll('input[name=sppManualBulan]:checked:not(:disabled)');
  var bulanArr = Array.from(checkedBoxes).map(function(b){ return b.value; });
  if (!bulanArr.length) { errEl.textContent = 'Pilih minimal 1 bulan.'; errEl.style.display = ''; return; }
  var nominal = Number(document.getElementById('sppManualNominal').value);
  if (!nominal || nominal <= 0) { errEl.textContent = 'Nominal harus lebih dari 0.'; errEl.style.display = ''; return; }

  showLoad('Menyimpan pembayaran...');
  try {
    var r = await window.HQ.AdminAPI.inputSPPManual({
      id_murid: id_murid,
      bulan: bulanArr,
      tahun: document.getElementById('sppManualTahun').value,
      jenis: jenis,
      nominal: nominal,
      catatan: document.getElementById('sppManualCatatan').value.trim(),
    });
    if (r.count === 0) {
      toast(r.message || 'Sudah lunas sebelumnya.', 'warn');
    } else {
      _sppManualSessionCount += 1;
      toast('✅ ' + (r.message || 'Berhasil disimpan'), 'ok');
      var entriLabel = jenis === 'Ihsan Guru' ? 'transaksi ihsan' : 'murid';
      document.getElementById('sppManualCounter').textContent = '✅ ' + _sppManualSessionCount + ' ' + entriLabel + ' sudah diinput sesi ini';
    }
    // Stay open: reset form untuk murid berikutnya
    document.getElementById('sppManualMuridSearch').value = '';
    document.getElementById('sppManualMuridId').value = '';
    document.getElementById('sppManualMuridInfo').style.display = 'none';
    document.getElementById('sppManualNominal').value = '';
    document.getElementById('sppManualNominalHint').textContent = '';
    _sppManualBulanLunas = [];
    _sppManualBulanMenunggu = [];
    renderSPPManualBulanGrid([], []);
    // Focus kembali ke search
    setTimeout(function(){ document.getElementById('sppManualMuridSearch').focus(); }, 100);
  } catch(e) {
    errEl.textContent = 'Gagal: ' + friendlyError(e);
    errEl.style.display = '';
  } finally { hideLoad(); }
}

// Close dropdown saat klik di luar
document.addEventListener('click', function(e) {
  var dd = document.getElementById('sppManualMuridDropdown');
  var search = document.getElementById('sppManualMuridSearch');
  if (dd && search && !dd.contains(e.target) && e.target !== search) {
    dd.style.display = 'none';
  }
});

// ══════════════════════════════════════════
//  PENGUMUMAN
// ══════════════════════════════════════════
async function loadPengumuman() {
  showLoad('Bismillah, memproses...');
  try {
    const r = await window.HQ.AdminAPI.getAllPengumuman();
    const tbody = document.getElementById('pengumumanTbl');
    tbody.innerHTML = (r.data||[]).map(p=>`<tr>
      <td>${esc(p.tanggal)}</td>
      <td><strong>${esc(p.judul)}</strong></td>
      <td><span class="badge b-blue">${esc(p.target)}</span></td>
      <td>${esc(p.nama_pembuat)}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada pengumuman</td></tr>';
  } catch(e) {}
  finally { hideLoad(); }
}

async function doKirimPengumuman() {
  const judul  = document.getElementById('pngJudul').value.trim();
  const isi    = document.getElementById('pngIsi').value.trim();
  const target = document.getElementById('pngTarget').value;
  if (!judul || !isi) return toast('Judul dan isi wajib diisi','err');
  showLoad('Bismillah, mengirim pengumuman...');
  try {
    await window.HQ.AdminAPI.buatPengumuman({ judul, isi, target });
    document.getElementById('pngJudul').value = '';
    document.getElementById('pngIsi').value   = '';
    toast('Pengumuman terkirim! 📢','ok');
    loadPengumuman();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  AUDIT LOG

  // Export functions to window
  if (typeof window !== "undefined") {
    window.loadMetodeBayarAdmin = loadMetodeBayarAdmin;
    window.bukaFormMetode = bukaFormMetode;
    window.tutupFormMetode = tutupFormMetode;
    window.setMetodeJenis = setMetodeJenis;
    window.editMetode = editMetode;
    window.hapusMetode = hapusMetode;
    window.simpanMetode = simpanMetode;
    window.loadSPPAdmin = loadSPPAdmin;
    window.ensureKasBulanOptions = ensureKasBulanOptions;
    window.renderKasRingkasan = renderKasRingkasan;
    window.renderKasOperasionalList = renderKasOperasionalList;
    window.loadKasBeasiswa = loadKasBeasiswa;
    window.bukaFormOperasional = bukaFormOperasional;
    window.tutupFormOperasional = tutupFormOperasional;
    window.editOperasional = editOperasional;
    window.simpanOperasional = simpanOperasional;
    window.hapusOperasionalItem = hapusOperasionalItem;
    window.toggleTipeSpp = toggleTipeSpp;
    window.filterSPPTable = filterSPPTable;
    window.filterInfaqTable = filterInfaqTable;
    window.filterIhsanTable = filterIhsanTable;
    window._csvSafe = _csvSafe;
    window.eksporSPP = eksporSPP;
    window.salinTagihanMassal = salinTagihanMassal;
    window.konfirmasiManualGateway = konfirmasiManualGateway;
    window.toggleSPPRiwayat = toggleSPPRiwayat;
    window.loadSPPRiwayat = loadSPPRiwayat;
    window.batalkanKonfirmasi = batalkanKonfirmasi;
    window.validasiSPP = validasiSPP;
    window.bukaModalInputSPPManual = bukaModalInputSPPManual;
    window.tutupModalInputSPPManual = tutupModalInputSPPManual;
    window.filterMuridSPPManual = filterMuridSPPManual;
    window.pilihMuridSPPManual = pilihMuridSPPManual;
    window.renderSPPManualBulanGrid = renderSPPManualBulanGrid;
    window.hitungNominalSPPManual = hitungNominalSPPManual;
    window.pilihSemuaBelumLunas = pilihSemuaBelumLunas;
    window.setSPPManualJenis = setSPPManualJenis;
    window.onSPPManualTahunChange = onSPPManualTahunChange;
    window.submitInputSPPManual = submitInputSPPManual;
    window.loadPengumuman = loadPengumuman;
    window.doKirimPengumuman = doKirimPengumuman;
  }
})();
