// ══════════════════════════════════════════════════════════════
//  Rattil Portal Guru — Modul Kelompok Belajar (kelompok-module.js)
//  Ekstraksi Fase 2: Memecah monolitik guru/index.html
// ══════════════════════════════════════════════════════════════

(function() {
var _kpData = { id_halaqah: null, kelompok: [], murid: [] };

// Isi dropdown halaqah Qiyam di dalam modal (agar bisa dibuka dari mana saja,
// termasuk kartu dashboard yang tidak punya selector halaqah hafalan)
function _kpPopulateHalaqahSel() {
  var sel = document.getElementById('kpHalaqahSel');
  if (!sel) return;
  var qiyam = (window.HQ.AppState.halaqahList || []).filter(function(h){ return h.level === 'Level Qiyam'; });
  // Pertahankan pilihan sebelumnya, atau ikuti selector di halaman hafalan kalau ada
  var hfSel = document.getElementById('hafalanGuruHalaqahSel');
  var prev = sel.value || (hfSel ? hfSel.value : '');
  sel.innerHTML = '<option value="">— Pilih Halaqah —</option>' + qiyam.map(function(h){
    return '<option value="' + esc(h.id_halaqah) + '">' + esc(h.nama_halaqah) + '</option>';
  }).join('');
  if (prev && qiyam.some(function(h){ return h.id_halaqah === prev; })) sel.value = prev;
  else if (qiyam.length === 1) sel.value = qiyam[0].id_halaqah;
}

// Dulu toggle buka/tutup modal -- sekarang seksinya sudah jadi bagian tetap
// halaman #page-kelompok, jadi fungsi ini tinggal isi dropdown halaqah &
// render ulang daftar kelompok tiap kali halaman dibuka (dipanggil dari
// goPage() dan dari kartu dashboard/tombol toolbar yang masih memicu
// goPage('kelompok') lalu fungsi ini).
function toggleKelolaKelompokPartner() {
  _kpPopulateHalaqahSel();
  renderKelolaKelompokPartner();
}

async function renderKelolaKelompokPartner() {
  var _kpSel = document.getElementById('kpHalaqahSel');
  var id_halaqah = _kpSel ? _kpSel.value : '';
  var listWrap   = document.getElementById('kpListWrap');
  var newWrap    = document.getElementById('kpNewAnggotaList');
  if (!id_halaqah) {
    listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">Pilih halaqah Qiyam terlebih dahulu</div>';
    newWrap.innerHTML = '';
    return;
  }
  listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">⏳ Memuat…</div>';
  try {
    var muridList = _hafalanGuruMuridCache[id_halaqah];
    if (!muridList) {
      var resM = await window.HQ.GuruAPI.getMuridQiyam(id_halaqah);
      muridList = resM.data || [];
      _hafalanGuruMuridCache[id_halaqah] = muridList;
    }
    var resK = await window.HQ.GuruAPI.getKelompokPartnerHalaqah(id_halaqah);
    var kelompokList = (resK.data || []).filter(function(k) { return k.status === 'aktif'; });
    // Denyut anggota (pantau) — non-fatal: kalau RPC belum ada/ gagal, kelola tetap jalan
    var pantauMap = {};
    try {
      var resP = await window.HQ.GuruAPI.getPantauKelompokPartner(id_halaqah);
      (resP.data || []).forEach(function(p) { pantauMap[p.id_murid] = p; });
    } catch(e) { pantauMap = {}; }
    _kpData = { id_halaqah: id_halaqah, kelompok: kelompokList, murid: muridList, pantau: pantauMap };
    _kpRenderList();
    _kpRenderNewForm();
    _kpRenderMenunggu();
  } catch(e) {
    listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red-txt);font-size:12px">Gagal memuat data</div>';
  }
}

// id_murid yang sudah jadi anggota kelompok aktif lain (selain id_kelompok yang dikecualikan)
function _kpAssignedMurid(excludeKelompok) {
  var ids = {};
  _kpData.kelompok.forEach(function(k) {
    if (k.id_kelompok === excludeKelompok) return;
    (k.anggota_kelompok_partner || []).forEach(function(a) { ids[a.id_murid] = true; });
  });
  return ids;
}

function _kpRenderList() {
  var listWrap = document.getElementById('kpListWrap');
  if (!_kpData.kelompok.length) {
    listWrap.innerHTML = '<div class="kg-empty-lg">Belum ada kelompok partner di halaqah ini.<br>Buat lewat form di bawah ⬇</div>';
    return;
  }
  listWrap.innerHTML = _kpData.kelompok.map(function(k) {
    var anggota = k.anggota_kelompok_partner || [];
    var chips = anggota.map(function(a) {
      return '<span class="kg-chip">'
        + esc(a.nama_murid || a.id_murid)
        + '<button onclick="kpRemoveAnggota(\'' + esc(k.id_kelompok) + '\',\'' + esc(a.id_murid) + '\')" title="Hapus dari kelompok">✕</button>'
      + '</span>';
    }).join('');

    var assigned  = _kpAssignedMurid(k.id_kelompok);
    var available = _kpData.murid.filter(function(m) {
      return !anggota.some(function(a) { return a.id_murid === m.id_murid; }) && !assigned[m.id_murid];
    });
    var addOpts = '<option value="">+ Tambah anggota...</option>' + available.map(function(m) {
      return '<option value="' + esc(m.id_murid) + '" data-nama="' + esc(m.nama_murid) + '">' + esc(m.nama_murid) + '</option>';
    }).join('');

    // Denyut anggota: tanggal setoran mandiri terakhir + status aktif/mandek + ingatkan WA
    var denyutRows = anggota.map(function(a) { return _kpDenyutRow(a); }).join('');
    var denyutBlock = anggota.length
      ? '<div class="kg-sub"><div class="kg-sub-lbl">Denyut Setoran Partner</div>' + denyutRows + '</div>'
      : '';

    // Lini Masa Kelompok: toggle + tambah milestone (lazy-load)
    var liniBlock = '<div class="kg-sub">'
      + '<div class="kg-actions">'
        + '<button onclick="kpToggleLiniMasa(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-lini">🗓️ Lini Masa</button>'
        + '<button onclick="kpAddMilestone(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-milestone">+ Milestone</button>'
        + '<button onclick="kpToggleTarget(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-target">🎯 Target</button>'
      + '</div>'
      + '<div id="kpLini_' + esc(k.id_kelompok) + '" style="display:none;margin-top:8px"></div>'
      + '<div id="kpTarget_' + esc(k.id_kelompok) + '" style="display:none;margin-top:8px"></div>'
    + '</div>';

    var capBadge = '<span class="kg-cap ' + (anggota.length >= 3 ? 'full' : 'partial') + '">' + anggota.length + '/3</span>';

    return '<div class="kg-card">'
      + '<div class="kg-card-head">'
        + '<input type="text" class="kg-card-name" value="' + esc(k.nama_kelompok || '') + '" placeholder="Nama kelompok" onchange="kpRenameKelompok(\'' + esc(k.id_kelompok) + '\',this.value)">'
        + capBadge
        + '<button onclick="kpDeleteKelompok(\'' + esc(k.id_kelompok) + '\')" class="kg-icon-btn" title="Hapus Kelompok">🗑</button>'
      + '</div>'
      + '<div class="kg-card-body">'
        + (chips || '<div class="kg-empty">Belum ada anggota</div>')
        + (available.length ? '<select class="kg-add-sel" onchange="kpAddAnggota(\'' + esc(k.id_kelompok) + '\',this)">' + addOpts + '</select>' : '')
        + denyutBlock
        + liniBlock
      + '</div>'
    + '</div>';
  }).join('');
}

// ── Lini Masa Kelompok (guru) — gabungan setoran dikonfirmasi + milestone ──
function _kpRenderLiniMasa(setoran, milestones) {
  var jenisIcon = { Ziyadah:'📖', Murajaah:'🔄' };
  var events = [];
  (setoran || []).forEach(function(s){
    events.push({ t:new Date(s.tanggal).getTime(), dot:'green', tgl:s.tanggal, html:
      '<div style="font-weight:700;color:var(--text)">' + (jenisIcon[s.jenis]||'📖') + ' ' + esc(s.nama_murid) + ' — ' + esc(s.jenis) + '</div>'
      + '<div style="color:var(--text-3)">QS. ' + esc(s.surat) + ' ayat ' + esc(s.ayat_dari) + '-' + esc(s.ayat_sampai) + (s.kelancaran ? ' · ' + esc(s.kelancaran) : '') + '</div>'
      + (s.catatan_partner ? '<div class="kg-teal-note">💬 ' + esc(s.catatan_partner) + (s.reaksi_partner ? ' ' + esc(s.reaksi_partner) : '') + '</div>' : '')
    });
  });
  (milestones || []).forEach(function(m){
    events.push({ t:new Date(m.tanggal).getTime(), dot:'amber', tgl:m.tanggal, html:
      '<div style="font-weight:800;color:var(--amber-txt)">🏆 ' + esc(m.judul)
        + '<button onclick="kpDeleteMilestone(\'' + esc(m.id_milestone) + '\',\'' + esc(m.id_kelompok) + '\')" style="border:none;background:none;color:var(--red-txt);cursor:pointer;font-size:12px;margin-left:6px" title="Hapus">✕</button>'
      + '</div>'
      + '<div style="color:var(--text-3);font-size:10px">ditandai oleh ' + esc(m.nama_pembuat || '-') + '</div>'
    });
  });
  if (!events.length) return '<div class="kg-empty">Belum ada jejak.</div>';
  events.sort(function(a,b){ return b.t - a.t; });
  return events.map(function(e){
    return '<div class="kg-lini-row">'
      + '<span class="kg-dot ' + e.dot + '" style="margin-top:4px"></span>'
      + '<div style="flex:1;min-width:0">' + e.html + '<div style="color:var(--text-3);font-size:10px">' + esc(_kpFmtTgl(e.tgl)) + '</div></div>'
    + '</div>';
  }).join('');
}

function _kpFmtTgl(iso) {
  try { return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }); }
  catch(e) { return iso; }
}

async function _kpLoadLiniMasa(id_kelompok) {
  var c = document.getElementById('kpLini_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    var res = await Promise.all([
      window.HQ.GuruAPI.getLiniMasaSetoranKelompok(id_kelompok),
      window.HQ.GuruAPI.getMilestoneByKelompok(id_kelompok),
    ]);
    c.innerHTML = _kpRenderLiniMasa(res[0].data || [], res[1].data || []);
  } catch(e) { c.innerHTML = '<div style="font-size:11px;color:var(--red-txt)">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
}

function kpToggleLiniMasa(id_kelompok) {
  var c = document.getElementById('kpLini_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kpLoadLiniMasa(id_kelompok);
}

async function kpAddMilestone(id_kelompok) {
  var judul = prompt('Tandai milestone kelompok (mis: Dedy khatam Juz 30):');
  if (!judul || !judul.trim()) return;
  try {
    await window.HQ.GuruAPI.addMilestoneKelompok({ id_kelompok: id_kelompok, id_halaqah: _kpData.id_halaqah, judul: judul.trim() });
    showToast('Milestone ditandai 🏆', 'success');
    _kpLoadLiniMasa(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal menambah milestone', 'error'); }
}

async function kpDeleteMilestone(id_milestone, id_kelompok) {
  try {
    await window.HQ.GuruAPI.deleteMilestoneKelompok(id_milestone);
    showToast('Milestone dihapus', 'success');
    _kpLoadLiniMasa(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal menghapus', 'error'); }
}

// ── #3 Konfirmasi setoran partner yang menunggu (guru sebagai jalan keluar) ──
async function _kpRenderMenunggu() {
  var wrap = document.getElementById('kpMenungguWrap');
  if (!wrap) return;
  try {
    var res = await window.HQ.GuruAPI.getSetoranPartnerMenungguHalaqah(_kpData.id_halaqah);
    var data = res.data || [];
    if (!data.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    var cfgRes = await window.HQ.GuruAPI.getPenilaianHafalan();
    var kelOpts = ((cfgRes.data && cfgRes.data.kelancaran) || []).map(function(k){
      return '<option value="' + esc(k.nama) + '">' + esc(k.icon || '') + ' ' + esc(k.nama) + '</option>';
    }).join('');
    wrap.style.display = 'block';
    wrap.innerHTML = '<div class="kg-menunggu">'
      + '<div class="kg-menunggu-title">⏳ Setoran Partner Menunggu Konfirmasi (' + data.length + ')</div>'
      + '<div class="kg-menunggu-sub">Konfirmasi di sini bila partner berhalangan menyimak.</div>'
      + data.map(function(r){
          return '<div class="kg-menunggu-item">'
            + '<div class="kg-menunggu-name">' + esc(r.nama_murid) + '</div>'
            + '<div class="kg-menunggu-meta">' + esc(r.jenis) + ' · Juz ' + esc(r.juz||'-') + ' · ' + esc(r.surat) + ' ayat ' + esc(r.ayat_dari) + '-' + esc(r.ayat_sampai) + '</div>'
            + '<div class="kg-menunggu-actions">'
              + '<select class="kg-sel-inline" id="kpKonf_' + esc(r.id_setoran) + '">' + kelOpts + '</select>'
              + '<button onclick="kpGuruKonfirmasi(\'' + esc(r.id_setoran) + '\')" class="kg-btn-confirm">✓ Konfirmasi</button>'
            + '</div>'
          + '</div>';
        }).join('')
      + '</div>';
  } catch(e) { wrap.style.display = 'none'; }
}

async function kpGuruKonfirmasi(id_setoran) {
  var sel = document.getElementById('kpKonf_' + id_setoran);
  var kelancaran = sel ? sel.value : null;
  try {
    await window.HQ.GuruAPI.guruKonfirmasiSetoran(id_setoran, kelancaran, null);
    showToast('Setoran dikonfirmasi ✓', 'success');
    _kpRenderMenunggu();
    renderKelolaKelompokPartner();
  } catch(e) { showToast(e.message || 'Gagal konfirmasi', 'error'); }
}

// ── #4 Target bersama kelompok (guru) ── konsensus: progres X/Y dari murid
function _kpRenderTargetHtml(targets, total) {
  total = total || 0;
  var html = '<div class="kg-target-add"><input type="text" class="kg-target-input" id="kpTgtInput" placeholder="Target baru (mis: Khatam Juz 30)"><button onclick="kpAddTarget(\'__K__\')" class="kg-target-set-btn">+ Set</button></div>';
  if (!(targets || []).length) return html + '<div class="kg-empty">Belum ada target.</div>';
  return html + targets.map(function(t){
    var done = (t.target_partner_progress || []).length;
    var tercapai = t.status === 'tercapai';
    var badge = tercapai
      ? '<span class="kg-cap full">🎉 tercapai</span>'
      : '<span class="kg-cap partial">' + done + '/' + total + ' selesai</span>';
    var markBtn = tercapai ? '' : '<button onclick="kpMarkTarget(\'' + esc(t.id_target) + '\',\'' + esc(t.id_kelompok) + '\')" title="Tandai tercapai (paksa, override konsensus)" style="background:var(--green-bg);color:var(--green-txt);border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✓</button>';
    return '<div class="kg-target-row">'
      + '<span class="kg-target-title">🎯 ' + esc(t.judul) + ' ' + badge + '</span>'
      + '<span style="display:flex;gap:4px;flex-shrink:0">' + markBtn
      + '<button onclick="kpDeleteTarget(\'' + esc(t.id_target) + '\',\'' + esc(t.id_kelompok) + '\')" style="background:none;border:none;color:var(--red-txt);cursor:pointer;font-size:12px">✕</button></span>'
    + '</div>';
  }).join('');
}
async function _kpLoadTarget(id_kelompok) {
  var c = document.getElementById('kpTarget_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    var k = _kpData.kelompok.find(function(x){ return x.id_kelompok === id_kelompok; });
    var total = k ? (k.anggota_kelompok_partner || []).length : 0;
    var res = await window.HQ.GuruAPI.getTargetByKelompok(id_kelompok);
    c.innerHTML = _kpRenderTargetHtml(res.data || [], total).replace(/__K__/g, id_kelompok);
  } catch(e) { c.innerHTML = '<div style="font-size:11px;color:var(--red-txt)">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
}
function kpToggleTarget(id_kelompok) {
  var c = document.getElementById('kpTarget_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kpLoadTarget(id_kelompok);
}
async function kpAddTarget(id_kelompok) {
  var inp = document.getElementById('kpTgtInput');
  var judul = inp ? (inp.value || '').trim() : '';
  if (!judul) { showToast('Tulis dulu targetnya', 'warn'); return; }
  try {
    await window.HQ.GuruAPI.addTargetByKelompok({ id_kelompok: id_kelompok, id_halaqah: _kpData.id_halaqah, judul: judul });
    showToast('Target ditetapkan 🎯', 'success');
    _kpLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}
async function kpMarkTarget(id_target, id_kelompok) {
  var ok = await showConfirm('Tandai target ini TERCAPAI untuk seluruh kelompok? Ini menimpa konsensus murid (tidak menunggu semua anggota menandai).', { title: 'Tandai Tercapai?', okText: 'Ya, Tandai' });
  if (!ok) return;
  try {
    await window.HQ.GuruAPI.updateTargetByKelompok(id_target, { status: 'tercapai' });
    showToast('Target tercapai 🎉', 'success');
    _kpLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}
async function kpDeleteTarget(id_target, id_kelompok) {
  try {
    await window.HQ.GuruAPI.deleteTargetByKelompok(id_target);
    showToast('Target dihapus', 'success');
    _kpLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}

// Satu baris denyut anggota: tanggal terakhir + status aktif/mandek + ingatkan WA
function _kpDenyutRow(a) {
  var p = (_kpData.pantau && _kpData.pantau[a.id_murid]) || null;
  var last = p && p.tanggal_terakhir;
  var hari = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  var menunggu = p ? (p.jumlah_menunggu || 0) : 0;
  var mandek = (hari === null) || (hari >= 7);

  var dotCls = mandek ? 'amber' : 'green';
  var statusTxt = (hari === null)
    ? 'Belum pernah setor'
    : (hari === 0 ? 'Setor hari ini' : (hari === 1 ? 'Setor kemarin' : 'Terakhir ' + hari + ' hari lalu'));

  var menungguBadge = menunggu > 0
    ? '<span class="kg-badge-menunggu">' + menunggu + ' menunggu</span>'
    : '';

  var nudgeBtn = '';
  if (mandek && p && p.no_hp) {
    nudgeBtn = '<button onclick="kpNudgeAnggota(\'' + escJs(a.nama_murid || '') + '\',\'' + escJs(p.no_hp) + '\')" class="kg-btn-nudge">💬 Ingatkan</button>';
  }

  return '<div class="kg-denyut-row">'
    + '<span class="kg-dot ' + dotCls + '"></span>'
    + '<span class="kg-denyut-name">' + esc(a.nama_murid || a.id_murid) + '</span>'
    + '<span class="kg-denyut-status">· ' + statusTxt + '</span>'
    + menungguBadge
    + nudgeBtn
  + '</div>';
}

// Kirim WA pengingat dari guru ke anggota yang mandek
function kpNudgeAnggota(nama, hp) {
  var raw = String(hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) { toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn'); return; }
  if (raw.charAt(0) === '0') raw = '62' + raw.slice(1);
  else if (raw.slice(0,2) !== '62') raw = '62' + raw;
  var msg =
    'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙\n\n' +
    'Ananda *' + (nama || 'Murid') + '*, Ustadz/Ustadzah memantau setoran hafalan qiyam bersama partnermu. ' +
    'Sudah beberapa waktu belum ada setoran baru — yuk semangat lanjutkan setoran & muraja\'ah bersama partner ya 🤝\n\n' +
    'Barakallahu fiikum.';
  window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
}

function _kpRenderNewForm() {
  var assigned  = _kpAssignedMurid(null);
  var available = _kpData.murid.filter(function(m) { return !assigned[m.id_murid]; });
  var wrap = document.getElementById('kpNewAnggotaList');
  var btn = document.getElementById('kpBtnCreate');
  if (!available.length) {
    wrap.innerHTML = '<div class="kg-empty">Semua murid sudah tergabung di kelompok partner 🎉</div>';
    if (btn) btn.disabled = true;
    return;
  }
  var autoBtn = available.length >= 2
    ? '<button type="button" onclick="kpAutoBentukKelompok()" class="kg-btn-auto">✨ Bentuk Otomatis dari ' + available.length + ' Murid Sisa</button>'
      + '<div class="kg-divider-or">atau pilih manual</div>'
    : '';
  var counter = '<div class="kg-counter low" id="kpNewCounter">Pilih 2-3 murid untuk kelompok baru</div>';
  var checks = available.map(function(m) {
    return '<label class="kg-chk-label">'
      + '<input type="checkbox" value="' + esc(m.id_murid) + '" data-nama="' + esc(m.nama_murid) + '" class="kp-new-anggota" onchange="_kpOnCheckToggle(this)">'
      + esc(m.nama_murid)
    + '</label>';
  }).join('');
  wrap.innerHTML = autoBtn + counter + checks;
  _kpUpdateNewFormCounter();
}

// Live feedback saat guru mencentang murid -- highlight label + counter warna
// (abu=belum cukup, kuning=belum pas, hijau=siap) supaya tak perlu coba-coba
// klik "Buat Kelompok" dulu baru tahu salah jumlah.
function _kpOnCheckToggle(el) {
  var label = el.closest('label');
  if (label) label.classList.toggle('on', el.checked);
  _kpUpdateNewFormCounter();
}
function _kpUpdateNewFormCounter() {
  var n = document.querySelectorAll('.kp-new-anggota:checked').length;
  var el = document.getElementById('kpNewCounter');
  var btn = document.getElementById('kpBtnCreate');
  if (!el) return;
  if (n === 0) { el.className = 'kg-counter low'; el.textContent = 'Pilih 2-3 murid untuk kelompok baru'; }
  else if (n >= 2 && n <= 3) { el.className = 'kg-counter ready'; el.textContent = '✓ ' + n + ' murid dipilih, siap dibuat'; }
  else if (n === 1) { el.className = 'kg-counter mid'; el.textContent = n + ' dipilih — pilih minimal 1 murid lagi'; }
  else { el.className = 'kg-counter mid'; el.textContent = n + ' dipilih — maksimal 3 murid per kelompok'; }
  if (btn) btn.disabled = !(n >= 2 && n <= 3);
}

// Bagi rata N murid tersisa jadi beberapa kelompok berukuran valid [min,max],
// mis. 7 murid utk Partner (2-3) -> [3,2,2]. null kalau kurang dari minimum.
function _kgBalancedGroupSizes(n, min, max) {
  if (n < min) return null;
  var g = Math.ceil(n / max);
  var base = Math.floor(n / g);
  var rem = n % g;
  var sizes = [];
  for (var i = 0; i < g; i++) sizes.push(base + (i < rem ? 1 : 0));
  return sizes;
}

// Bentuk semua kelompok tersisa sekaligus (1 klik) -- ekstra berguna utk
// halaqah beranggota banyak yg kalau manual harus klak-klik checkbox
// berkali-kali. Guru tetap lihat & konfirmasi preview dulu sebelum dibuat,
// nama kelompok bisa diubah belakangan lewat input nama di kartu kelompok.
async function kpAutoBentukKelompok() {
  var assigned = _kpAssignedMurid(null);
  var available = _kpData.murid.filter(function(m) { return !assigned[m.id_murid]; });
  var sizes = _kgBalancedGroupSizes(available.length, 2, 3);
  if (!sizes) { showToast('Sisa murid tidak cukup dibentuk kelompok (minimal 2 murid)', 'warning'); return; }
  var groups = []; var idx = 0;
  sizes.forEach(function(sz) { groups.push(available.slice(idx, idx + sz)); idx += sz; });
  var preview = groups.map(function(g, i) { return (i + 1) + '. ' + g.map(function(m){ return m.nama_murid; }).join(', '); }).join('\n');
  var ok = await showConfirm(
    'Akan dibentuk ' + groups.length + ' kelompok baru dari ' + available.length + ' murid tersisa:\n\n' + preview,
    { title: 'Bentuk Otomatis?', okText: 'Ya, Buat Semua' }
  );
  if (!ok) return;
  var okCount = 0, failCount = 0;
  for (var i = 0; i < groups.length; i++) {
    var anggota = groups[i].map(function(m) { return { id_murid: m.id_murid, nama_murid: m.nama_murid }; });
    try { await window.HQ.GuruAPI.createKelompokPartner(_kpData.id_halaqah, null, anggota); okCount++; }
    catch(e) { failCount++; }
  }
  showToast(okCount + ' kelompok dibuat otomatis ✓' + (failCount ? (' · ' + failCount + ' gagal') : ''), failCount ? 'warning' : 'success');
  renderKelolaKelompokPartner();
}

async function kpCreateKelompok() {
  var checks = Array.prototype.slice.call(document.querySelectorAll('.kp-new-anggota:checked'));
  if (checks.length < 2 || checks.length > 3) {
    showToast('Pilih 2-3 murid untuk satu kelompok', 'warning');
    return;
  }
  var anggota = checks.map(function(c) { return { id_murid: c.value, nama_murid: c.getAttribute('data-nama') }; });
  var nama = (document.getElementById('kpNewNama').value || '').trim() || null;
  try {
    await window.HQ.GuruAPI.createKelompokPartner(_kpData.id_halaqah, nama, anggota);
    showToast('Kelompok partner dibuat ✓', 'success');
    document.getElementById('kpNewNama').value = '';
    renderKelolaKelompokPartner();
  } catch(e) {
    showToast(e.message || 'Gagal membuat kelompok', 'error');
  }
}

async function kpRenameKelompok(id_kelompok, nama) {
  try {
    await window.HQ.GuruAPI.updateKelompokPartner(id_kelompok, { nama_kelompok: nama.trim() || null });
    showToast('Nama kelompok disimpan ✓', 'success');
    var k = _kpData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
    if (k) k.nama_kelompok = nama.trim() || null;
  } catch(e) {
    showToast(e.message || 'Gagal menyimpan nama', 'error');
  }
}

async function kpDeleteKelompok(id_kelompok) {
  var ok = await showConfirm('Hapus kelompok ini? Anggota akan kehilangan akses partner.', { title: 'Hapus Kelompok?', okText: 'Ya, Hapus', danger: true });
  if (!ok) return;
  try {
    await window.HQ.GuruAPI.deleteKelompokPartner(id_kelompok);
    showToast('Kelompok dihapus', 'success');
    renderKelolaKelompokPartner();
  } catch(e) {
    showToast(e.message || 'Gagal menghapus kelompok', 'error');
  }
}

async function kpRemoveAnggota(id_kelompok, id_murid) {
  // C3 fix (bug hunt 2026-08-18): dulu fungsi ini membangun ulang seluruh
  // daftar anggota dari cache klien (_kpData) lalu replace-all -- kalau cache
  // basi (tab/sesi lain sudah ubah anggota duluan), anggota yang dihapus tab
  // lain bisa "hidup lagi" di sini. Sekarang cuma hapus 1 baris di server;
  // jumlah minimum dicek dari cache utk validasi UX saja (server tetap sumber
  // kebenaran -- kalau ternyata sudah di bawah minimum di server, RPC/trigger
  // akan menolak dan errornya ditangkap di catch).
  var k = _kpData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
  if (!k) return;
  var jumlahSaatIni = (k.anggota_kelompok_partner || []).length;
  if (jumlahSaatIni <= 2) {
    showToast('Kelompok minimal harus punya 2 anggota. Hapus kelompok ini jika ingin mengosongkannya.', 'warning');
    return;
  }
  try {
    await window.HQ.GuruAPI.removeAnggotaKelompok(id_kelompok, id_murid);
    showToast('Anggota diperbarui ✓', 'success');
    renderKelolaKelompokPartner();
  } catch(e) {
    showToast(e.message || 'Gagal memperbarui anggota', 'error');
  }
}

async function kpAddAnggota(id_kelompok, selectEl) {
  var id_murid = selectEl.value;
  if (!id_murid) return;
  var nama_murid = selectEl.options[selectEl.selectedIndex].getAttribute('data-nama');
  var k = _kpData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
  if (!k) return;
  var jumlahSaatIni = (k.anggota_kelompok_partner || []).length;
  if (jumlahSaatIni >= 3) {
    showToast('Maksimal 3 anggota per kelompok', 'warning');
    return;
  }
  try {
    await window.HQ.GuruAPI.addAnggotaKelompok(id_kelompok, id_murid, nama_murid);
    showToast('Anggota ditambahkan ✓', 'success');
    renderKelolaKelompokPartner();
  } catch(e) {
    showToast(e.message || 'Gagal menambah anggota', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════
//  KELOLA KELOMPOK PARTNER BELAJAR (Level 1-4) — mirror kp*, prefix kb
// ══════════════════════════════════════════════════════════════════════
var _kbData = { id_halaqah: null, kelompok: [], murid: [], pantau: {} };
var _kbMuridCache = {};
var _kbEnabledLevels = null;
var KB_JENIS_ICON = { 'Makharijul Huruf':'🗣️', 'Shifatul Huruf':'🔤', 'Hafalan Materi':'🧠', 'Tajwid':'📐', 'Doa-Doa Pilihan':'🤲', 'Murajaah':'🔄' };

async function _kbEnsureEnabledLevels() {
  if (_kbEnabledLevels) return _kbEnabledLevels;
  try {
    var res = await window.HQ.GuruAPI.getLevelBelajarEnabled();
    _kbEnabledLevels = res.data || [];
  } catch(e) { _kbEnabledLevels = []; }
  return _kbEnabledLevels;
}
function _kbBelajarHalaqah() {
  var lv = _kbEnabledLevels || [];
  return (window.HQ.AppState.halaqahList || []).filter(function(h){ return lv.indexOf(h.level) !== -1; });
}

// Tampilkan kartu dashboard "Kelompok Belajar" DAN tombol cadangannya di
// toolbar halaman Daftar Murid -- keduanya hanya utk guru yang punya halaqah
// yang enabled. Dua titik akses sengaja dipertahankan: kartu dashboard biar
// langsung kelihatan tanpa perlu tahu harus cari ke mana (dilaporkan user
// sempat "jadi jauh sekali" waktu cuma ditaruh di toolbar Daftar Murid),
// tombol toolbar sebagai cadangan kalau sedang berada di halaman itu.
async function _kbInitDashCard() {
  await _kbEnsureEnabledLevels();
  var tampil = _kbBelajarHalaqah().length ? '' : 'none';
  var card = document.getElementById('statKelompokBelajar');
  if (card) card.style.display = tampil;
  var btn = document.getElementById('btnKelolaKelompokBelajar');
  if (btn) btn.style.display = tampil;
  // Seksi "Kelompok Partner Belajar" di halaman #page-kelompok + nav sidebarnya --
  // sama seperti 2 titik akses di atas, hanya DITAMPILKAN di sini (tidak pernah
  // disembunyikan lagi), krn halaqah yang diampu guru tak menyusut dalam 1 sesi.
  var wrap = document.getElementById('kbSectionWrap');
  if (wrap) wrap.style.display = tampil;
  if (tampil === '') {
    var nav = document.getElementById('navKelompok');
    if (nav) nav.style.display = '';
  }
}

function _kbPopulateHalaqahSel() {
  var sel = document.getElementById('kbHalaqahSel');
  if (!sel) return;
  var belajar = _kbBelajarHalaqah();
  var prev = sel.value || '';
  sel.innerHTML = '<option value="">— Pilih Halaqah —</option>' + belajar.map(function(h){
    return '<option value="' + esc(h.id_halaqah) + '">' + esc(h.nama_halaqah) + ' · ' + esc(h.level) + '</option>';
  }).join('');
  if (prev && belajar.some(function(h){ return h.id_halaqah === prev; })) sel.value = prev;
  else if (belajar.length === 1) sel.value = belajar[0].id_halaqah;
}

// Dulu toggle buka/tutup modal -- sekarang seksinya sudah jadi bagian tetap
// halaman #page-kelompok (lihat komentar toggleKelolaKelompokPartner di atas).
async function toggleKelolaKelompokBelajar() {
  await _kbEnsureEnabledLevels();
  _kbPopulateHalaqahSel();
  renderKelolaKelompokBelajar();
}

async function renderKelolaKelompokBelajar() {
  var _kbSel = document.getElementById('kbHalaqahSel');
  var id_halaqah = _kbSel ? _kbSel.value : '';
  var listWrap   = document.getElementById('kbListWrap');
  var newWrap    = document.getElementById('kbNewAnggotaList');
  if (!id_halaqah) {
    listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">Pilih halaqah terlebih dahulu</div>';
    newWrap.innerHTML = '';
    return;
  }
  listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">⏳ Memuat…</div>';
  try {
    var muridList = _kbMuridCache[id_halaqah];
    if (!muridList) {
      var resM = await window.HQ.GuruAPI.getMuridBelajar(id_halaqah);
      muridList = resM.data || [];
      _kbMuridCache[id_halaqah] = muridList;
    }
    var resK = await window.HQ.GuruAPI.getKelompokBelajarHalaqah(id_halaqah);
    var kelompokList = (resK.data || []).filter(function(k) { return k.status === 'aktif'; });
    var pantauMap = {};
    try {
      var resP = await window.HQ.GuruAPI.getPantauKelompokBelajar(id_halaqah);
      (resP.data || []).forEach(function(p) { pantauMap[p.id_murid] = p; });
    } catch(e) { pantauMap = {}; }
    _kbData = { id_halaqah: id_halaqah, kelompok: kelompokList, murid: muridList, pantau: pantauMap };
    _kbRenderList();
    _kbRenderNewForm();
    _kbRenderMenunggu();
  } catch(e) {
    listWrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red-txt);font-size:12px">Gagal memuat data</div>';
  }
}

function _kbAssignedMurid(excludeKelompok) {
  var ids = {};
  _kbData.kelompok.forEach(function(k) {
    if (k.id_kelompok === excludeKelompok) return;
    (k.anggota_kelompok_belajar || []).forEach(function(a) { ids[a.id_murid] = true; });
  });
  return ids;
}

function _kbRenderList() {
  var listWrap = document.getElementById('kbListWrap');
  if (!_kbData.kelompok.length) {
    listWrap.innerHTML = '<div class="kg-empty-lg">Belum ada kelompok belajar di halaqah ini.<br>Buat lewat form di bawah ⬇</div>';
    return;
  }
  listWrap.innerHTML = _kbData.kelompok.map(function(k) {
    var anggota = k.anggota_kelompok_belajar || [];
    var chips = anggota.map(function(a) {
      return '<span class="kg-chip">'
        + esc(a.nama_murid || a.id_murid)
        + '<button onclick="kbRemoveAnggota(\'' + esc(k.id_kelompok) + '\',\'' + esc(a.id_murid) + '\')" title="Hapus dari kelompok">✕</button>'
      + '</span>';
    }).join('');

    var assigned  = _kbAssignedMurid(k.id_kelompok);
    var available = _kbData.murid.filter(function(m) {
      return !anggota.some(function(a) { return a.id_murid === m.id_murid; }) && !assigned[m.id_murid];
    });
    var canAdd = anggota.length < 5;
    var addOpts = '<option value="">+ Tambah anggota...</option>' + available.map(function(m) {
      return '<option value="' + esc(m.id_murid) + '" data-nama="' + esc(m.nama_murid) + '">' + esc(m.nama_murid) + '</option>';
    }).join('');

    var denyutRows = anggota.map(function(a) { return _kbDenyutRow(a); }).join('');
    var denyutBlock = anggota.length
      ? '<div class="kg-sub"><div class="kg-sub-lbl">Denyut Aktivitas Partner</div>' + denyutRows + '</div>'
      : '';

    var liniBlock = '<div class="kg-sub">'
      + '<div class="kg-actions">'
        + '<button onclick="kbToggleLiniMasa(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-lini">🗓️ Lini Masa</button>'
        + '<button onclick="kbAddMilestone(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-milestone">+ Milestone</button>'
        + '<button onclick="kbToggleTarget(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-tool kg-btn-target">🎯 Target</button>'
      + '</div>'
      + '<div id="kbLini_' + esc(k.id_kelompok) + '" style="display:none;margin-top:8px"></div>'
      + '<div id="kbTarget_' + esc(k.id_kelompok) + '" style="display:none;margin-top:8px"></div>'
    + '</div>';

    var capBadge = '<span class="kg-cap ' + (anggota.length >= 5 ? 'full' : 'partial') + '">' + anggota.length + '/5</span>';

    return '<div class="kg-card">'
      + '<div class="kg-card-head">'
        + '<input type="text" class="kg-card-name" value="' + esc(k.nama_kelompok || '') + '" placeholder="Nama kelompok" onchange="kbRenameKelompok(\'' + esc(k.id_kelompok) + '\',this.value)">'
        + capBadge
        + '<button onclick="kbColekKelompok(\'' + esc(k.id_kelompok) + '\')" class="kg-btn-colek" title="Colek Kelompok">💬 Colek</button>'
        + '<button onclick="kbDeleteKelompok(\'' + esc(k.id_kelompok) + '\')" class="kg-icon-btn" title="Hapus Kelompok">🗑</button>'
      + '</div>'
      + '<div class="kg-card-body">'
        + (chips || '<div class="kg-empty">Belum ada anggota</div>')
        + (canAdd && available.length ? '<select class="kg-add-sel" onchange="kbAddAnggota(\'' + esc(k.id_kelompok) + '\',this)">' + addOpts + '</select>' : '')
        + denyutBlock
        + liniBlock
      + '</div>'
    + '</div>';
  }).join('');
}

// ── Lini Masa Kelompok (guru) — aktivitas dikonfirmasi + milestone ──
function _kbRenderLiniMasa(logs, milestones) {
  var events = [];
  (logs || []).forEach(function(s){
    events.push({ t:new Date(s.tanggal).getTime(), dot:'green', tgl:s.tanggal, html:
      '<div style="font-weight:700;color:var(--text)">' + (KB_JENIS_ICON[s.jenis_aktivitas]||'📚') + ' ' + esc(s.nama_murid) + ' — ' + esc(s.jenis_aktivitas) + '</div>'
      + (s.deskripsi ? '<div style="color:var(--text-3)">' + esc(s.deskripsi) + (s.durasi_menit ? ' · ' + esc(s.durasi_menit) + ' menit' : '') + (s.kelancaran ? ' · ' + esc(s.kelancaran) : '') + '</div>' : (s.kelancaran ? '<div style="color:var(--text-3)">' + esc(s.kelancaran) + '</div>' : ''))
      + (s.catatan_partner ? '<div class="kg-teal-note">💬 ' + esc(s.catatan_partner) + (s.reaksi_partner ? ' ' + esc(s.reaksi_partner) : '') + '</div>' : '')
    });
  });
  (milestones || []).forEach(function(m){
    events.push({ t:new Date(m.tanggal).getTime(), dot:'amber', tgl:m.tanggal, html:
      '<div style="font-weight:800;color:var(--amber-txt)">🏆 ' + esc(m.judul)
        + '<button onclick="kbDeleteMilestone(\'' + esc(m.id_milestone) + '\',\'' + esc(m.id_kelompok) + '\')" style="border:none;background:none;color:var(--red-txt);cursor:pointer;font-size:12px;margin-left:6px" title="Hapus">✕</button>'
      + '</div>'
      + '<div style="color:var(--text-3);font-size:10px">ditandai oleh ' + esc(m.nama_pembuat || '-') + '</div>'
    });
  });
  if (!events.length) return '<div class="kg-empty">Belum ada jejak.</div>';
  events.sort(function(a,b){ return b.t - a.t; });
  return events.map(function(e){
    return '<div class="kg-lini-row">'
      + '<span class="kg-dot ' + e.dot + '" style="margin-top:4px"></span>'
      + '<div style="flex:1;min-width:0">' + e.html + '<div style="color:var(--text-3);font-size:10px">' + esc(_kpFmtTgl(e.tgl)) + '</div></div>'
    + '</div>';
  }).join('');
}

async function _kbLoadLiniMasa(id_kelompok) {
  var c = document.getElementById('kbLini_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    var res = await Promise.all([
      window.HQ.GuruAPI.getLiniMasaBelajarKelompok(id_kelompok),
      window.HQ.GuruAPI.getMilestoneBelajarByKelompok(id_kelompok),
    ]);
    c.innerHTML = _kbRenderLiniMasa(res[0].data || [], res[1].data || []);
  } catch(e) { c.innerHTML = '<div style="font-size:11px;color:var(--red-txt)">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
}

function kbToggleLiniMasa(id_kelompok) {
  var c = document.getElementById('kbLini_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kbLoadLiniMasa(id_kelompok);
}

async function kbAddMilestone(id_kelompok) {
  var judul = prompt('Tandai milestone kelompok (mis: Dedy lancar makhraj halqi):');
  if (!judul || !judul.trim()) return;
  try {
    await window.HQ.GuruAPI.addMilestoneBelajarKelompok({ id_kelompok: id_kelompok, id_halaqah: _kbData.id_halaqah, judul: judul.trim() });
    showToast('Milestone ditandai 🏆', 'success');
    _kbLoadLiniMasa(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal menambah milestone', 'error'); }
}

async function kbDeleteMilestone(id_milestone, id_kelompok) {
  try {
    await window.HQ.GuruAPI.deleteMilestoneBelajarKelompok(id_milestone);
    showToast('Milestone dihapus', 'success');
    _kbLoadLiniMasa(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal menghapus', 'error'); }
}

// ── Konfirmasi aktivitas belajar yang menunggu (guru sebagai jalan keluar) ──
async function _kbRenderMenunggu() {
  var wrap = document.getElementById('kbMenungguWrap');
  if (!wrap) return;
  try {
    var res = await window.HQ.GuruAPI.getLogBelajarMenungguHalaqah(_kbData.id_halaqah);
    var data = res.data || [];
    if (!data.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    var kelOpts = ['Lancar','Cukup','Perlu Perbaikan'].map(function(k){
      return '<option value="' + k + '">' + k + '</option>';
    }).join('');
    wrap.style.display = 'block';
    wrap.innerHTML = '<div class="kg-menunggu">'
      + '<div class="kg-menunggu-title">⏳ Aktivitas Menunggu Konfirmasi (' + data.length + ')</div>'
      + '<div class="kg-menunggu-sub">Konfirmasi di sini bila partner berhalangan memantau.</div>'
      + data.map(function(r){
          return '<div class="kg-menunggu-item">'
            + '<div class="kg-menunggu-name">' + esc(r.nama_murid) + '</div>'
            + '<div class="kg-menunggu-meta">' + (KB_JENIS_ICON[r.jenis_aktivitas]||'📚') + ' ' + esc(r.jenis_aktivitas) + (r.durasi_menit ? ' · ' + esc(r.durasi_menit) + ' menit' : '') + (r.deskripsi ? ' · ' + esc(r.deskripsi) : '') + '</div>'
            + '<div class="kg-menunggu-actions">'
              + '<select class="kg-sel-inline" id="kbKonf_' + esc(r.id_log) + '">' + kelOpts + '</select>'
              + '<button onclick="kbGuruKonfirmasi(\'' + esc(r.id_log) + '\')" class="kg-btn-confirm">✓ Konfirmasi</button>'
            + '</div>'
          + '</div>';
        }).join('')
      + '</div>';
  } catch(e) { wrap.style.display = 'none'; }
}

async function kbGuruKonfirmasi(id_log) {
  var sel = document.getElementById('kbKonf_' + id_log);
  var kelancaran = sel ? sel.value : null;
  try {
    await window.HQ.GuruAPI.guruKonfirmasiLogBelajar(id_log, kelancaran, null);
    showToast('Aktivitas dikonfirmasi ✓', 'success');
    _kbRenderMenunggu();
    renderKelolaKelompokBelajar();
  } catch(e) { showToast(e.message || 'Gagal konfirmasi', 'error'); }
}

// ── Target bersama kelompok (guru) ── konsensus: progres X/Y dari murid
function _kbRenderTargetHtml(targets, total) {
  total = total || 0;
  var html = '<div class="kg-target-add"><input type="text" class="kg-target-input" id="kbTgtInput" placeholder="Target baru (mis: Khatam tilawah Juz 30)"><button onclick="kbAddTarget(\'__K__\')" class="kg-target-set-btn">+ Set</button></div>';
  if (!(targets || []).length) return html + '<div class="kg-empty">Belum ada target.</div>';
  return html + targets.map(function(t){
    var done = (t.target_belajar_progress || []).length;
    var tercapai = t.status === 'tercapai';
    var badge = tercapai
      ? '<span class="kg-cap full">🎉 tercapai</span>'
      : '<span class="kg-cap partial">' + done + '/' + total + ' selesai</span>';
    var markBtn = tercapai ? '' : '<button onclick="kbMarkTarget(\'' + esc(t.id_target) + '\',\'' + esc(t.id_kelompok) + '\')" title="Tandai tercapai (paksa, override konsensus)" style="background:var(--green-bg);color:var(--green-txt);border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✓</button>';
    return '<div class="kg-target-row">'
      + '<span class="kg-target-title">🎯 ' + esc(t.judul) + ' ' + badge + '</span>'
      + '<span style="display:flex;gap:4px;flex-shrink:0">' + markBtn
      + '<button onclick="kbDeleteTarget(\'' + esc(t.id_target) + '\',\'' + esc(t.id_kelompok) + '\')" style="background:none;border:none;color:var(--red-txt);cursor:pointer;font-size:12px">✕</button></span>'
    + '</div>';
  }).join('');
}
async function _kbLoadTarget(id_kelompok) {
  var c = document.getElementById('kbTarget_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    var k = _kbData.kelompok.find(function(x){ return x.id_kelompok === id_kelompok; });
    var total = k ? (k.anggota_kelompok_belajar || []).length : 0;
    var res = await window.HQ.GuruAPI.getTargetBelajarByKelompok(id_kelompok);
    c.innerHTML = _kbRenderTargetHtml(res.data || [], total).replace(/__K__/g, id_kelompok);
  } catch(e) { c.innerHTML = '<div style="font-size:11px;color:var(--red-txt)">Gagal: ' + esc(friendlyError(e)) + '</div>'; }
}
function kbToggleTarget(id_kelompok) {
  var c = document.getElementById('kbTarget_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kbLoadTarget(id_kelompok);
}
async function kbAddTarget(id_kelompok) {
  var inp = document.getElementById('kbTgtInput');
  var judul = inp ? (inp.value || '').trim() : '';
  if (!judul) { showToast('Tulis dulu targetnya', 'warn'); return; }
  try {
    await window.HQ.GuruAPI.addTargetBelajarByKelompok({ id_kelompok: id_kelompok, id_halaqah: _kbData.id_halaqah, judul: judul });
    showToast('Target ditetapkan 🎯', 'success');
    _kbLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}
async function kbMarkTarget(id_target, id_kelompok) {
  var ok = await showConfirm('Tandai target ini TERCAPAI untuk seluruh kelompok? Ini menimpa konsensus murid (tidak menunggu semua anggota menandai).', { title: 'Tandai Tercapai?', okText: 'Ya, Tandai' });
  if (!ok) return;
  try {
    await window.HQ.GuruAPI.updateTargetBelajarByKelompok(id_target, { status: 'tercapai' });
    showToast('Target tercapai 🎉', 'success');
    _kbLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}
async function kbDeleteTarget(id_target, id_kelompok) {
  try {
    await window.HQ.GuruAPI.deleteTargetBelajarByKelompok(id_target);
    showToast('Target dihapus', 'success');
    _kbLoadTarget(id_kelompok);
  } catch(e) { showToast(e.message || 'Gagal', 'error'); }
}

// Satu baris denyut anggota: tanggal terakhir + status aktif/mandek + ingatkan WA
function _kbDenyutRow(a) {
  var p = (_kbData.pantau && _kbData.pantau[a.id_murid]) || null;
  var last = p && p.tanggal_terakhir;
  var hari = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  var menunggu = p ? (p.jumlah_menunggu || 0) : 0;
  var mandek = (hari === null) || (hari >= 7);

  var dotCls = mandek ? 'amber' : 'green';
  var statusTxt = (hari === null)
    ? 'Belum pernah catat'
    : (hari === 0 ? 'Aktivitas hari ini' : (hari === 1 ? 'Aktivitas kemarin' : 'Terakhir ' + hari + ' hari lalu'));

  var menungguBadge = menunggu > 0
    ? '<span class="kg-badge-menunggu">' + menunggu + ' menunggu</span>'
    : '';

  var nudgeBtn = '';
  if (mandek && p && p.no_hp) {
    nudgeBtn = '<button onclick="kbNudgeAnggota(\'' + escJs(a.nama_murid || '') + '\',\'' + escJs(p.no_hp) + '\')" class="kg-btn-nudge">💬 Ingatkan</button>';
  }

  return '<div class="kg-denyut-row">'
    + '<span class="kg-dot ' + dotCls + '"></span>'
    + '<span class="kg-denyut-name">' + esc(a.nama_murid || a.id_murid) + '</span>'
    + '<span class="kg-denyut-status">· ' + statusTxt + '</span>'
    + menungguBadge
    + nudgeBtn
  + '</div>';
}

function kbNudgeAnggota(nama, hp) {
  var raw = String(hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) { toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn'); return; }
  if (raw.charAt(0) === '0') raw = '62' + raw.slice(1);
  else if (raw.slice(0,2) !== '62') raw = '62' + raw;
  var msg =
    'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙\n\n' +
    'Ananda *' + (nama || 'Murid') + '*, Ustadz/Ustadzah memantau aktivitas belajar mandiri bersama partnermu. ' +
    'Sudah beberapa waktu belum ada catatan baru — yuk semangat lanjutkan tilawah, tajwid & muraja\'ah bersama partner ya 📚\n\n' +
    'Barakallahu fiikum.';
  window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
}

function kbColekKelompok(id_kelompok) {
  var k = _kbData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
  if (!k) return;

  var namaKelompok = k.nama_kelompok || 'Kelompok Belajar';
  var anggota = k.anggota_kelompok_belajar || [];
  if (!anggota.length) { showToast('Kelompok tidak memiliki anggota', 'warning'); return; }

  var lines = [];
  anggota.forEach(function(a) {
    var p = (_kbData.pantau && _kbData.pantau[a.id_murid]) || null;
    var last = p && p.tanggal_terakhir;
    var hari = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
    var menunggu = p ? (p.jumlah_menunggu || 0) : 0;
    
    var statusTxt = (hari === null)
      ? 'Belum pernah lapor ⏰'
      : (hari === 0 ? 'Aktif hari ini 🔥' : (hari === 1 ? 'Aktif kemarin' : 'Terakhir lapor ' + hari + ' hari lalu'));
    
    if (menunggu > 0) statusTxt += ' (' + menunggu + ' menunggu konfirmasi)';
    
    lines.push('- *' + (a.nama_murid || a.id_murid) + '*: ' + statusTxt);
  });

  var msg = 
    'Assalamu\'alaikum Warahmatullahi Wabarakaatuh Kelompok *' + namaKelompok + '* 👋\n\n' +
    'Ustadz/Ustadzah menyapa dan menyemangati antum semua agar tetap konsisten melapor di Partner Belajar ya. 📚\n\n' +
    '*Rekap Denyut Aktivitas Kelompok:* \n' +
    lines.join('\n') + '\n\n' +
    'Yuk saling ingatkan dan dukung partner belajar kita. Barakallahu fiikum. 😊';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showToast('Rekap colek disalin ke clipboard ✓', 'success');
      window.open('https://web.whatsapp.com', '_blank');
    }).catch(function() {
      _fallbackCopyText(msg);
    });
  } else {
    _fallbackCopyText(msg);
  }
}

function _fallbackCopyText(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Rekap colek disalin ke clipboard ✓', 'success');
    window.open('https://web.whatsapp.com', '_blank');
  } catch (err) {
    alert('Gagal menyalin. Silakan salin manual:\n\n' + text);
  }
  document.body.removeChild(textArea);
}

function _kbRenderNewForm() {
  var assigned  = _kbAssignedMurid(null);
  var available = _kbData.murid.filter(function(m) { return !assigned[m.id_murid]; });
  var wrap = document.getElementById('kbNewAnggotaList');
  var btn = document.getElementById('kbBtnCreate');
  if (!available.length) {
    wrap.innerHTML = '<div class="kg-empty">Semua murid sudah tergabung di kelompok belajar 🎉</div>';
    if (btn) btn.disabled = true;
    return;
  }
  var autoBtn = available.length >= 3
    ? '<button type="button" onclick="kbAutoBentukKelompok()" class="kg-btn-auto">✨ Bentuk Otomatis dari ' + available.length + ' Murid Sisa</button>'
      + '<div class="kg-divider-or">atau pilih manual</div>'
    : '';
  var counter = '<div class="kg-counter low" id="kbNewCounter">Pilih 3-5 murid untuk kelompok baru</div>';
  var checks = available.map(function(m) {
    return '<label class="kg-chk-label">'
      + '<input type="checkbox" value="' + esc(m.id_murid) + '" data-nama="' + esc(m.nama_murid) + '" class="kb-new-anggota" onchange="_kbOnCheckToggle(this)">'
      + esc(m.nama_murid)
    + '</label>';
  }).join('');
  wrap.innerHTML = autoBtn + counter + checks;
  _kbUpdateNewFormCounter();
}

// Live feedback saat guru mencentang murid (lihat komentar _kpOnCheckToggle).
function _kbOnCheckToggle(el) {
  var label = el.closest('label');
  if (label) label.classList.toggle('on', el.checked);
  _kbUpdateNewFormCounter();
}
function _kbUpdateNewFormCounter() {
  var n = document.querySelectorAll('.kb-new-anggota:checked').length;
  var el = document.getElementById('kbNewCounter');
  var btn = document.getElementById('kbBtnCreate');
  if (!el) return;
  if (n === 0) { el.className = 'kg-counter low'; el.textContent = 'Pilih 3-5 murid untuk kelompok baru'; }
  else if (n >= 3 && n <= 5) { el.className = 'kg-counter ready'; el.textContent = '✓ ' + n + ' murid dipilih, siap dibuat'; }
  else if (n < 3) { el.className = 'kg-counter mid'; el.textContent = n + ' dipilih — pilih minimal ' + (3 - n) + ' murid lagi'; }
  else { el.className = 'kg-counter mid'; el.textContent = n + ' dipilih — maksimal 5 murid per kelompok'; }
  if (btn) btn.disabled = !(n >= 3 && n <= 5);
}

// Bentuk semua kelompok tersisa sekaligus (lihat komentar kpAutoBentukKelompok).
async function kbAutoBentukKelompok() {
  var assigned = _kbAssignedMurid(null);
  var available = _kbData.murid.filter(function(m) { return !assigned[m.id_murid]; });
  var sizes = _kgBalancedGroupSizes(available.length, 3, 5);
  if (!sizes) { showToast('Sisa murid tidak cukup dibentuk kelompok (minimal 3 murid)', 'warning'); return; }
  var groups = []; var idx = 0;
  sizes.forEach(function(sz) { groups.push(available.slice(idx, idx + sz)); idx += sz; });
  var preview = groups.map(function(g, i) { return (i + 1) + '. ' + g.map(function(m){ return m.nama_murid; }).join(', '); }).join('\n');
  var ok = await showConfirm(
    'Akan dibentuk ' + groups.length + ' kelompok baru dari ' + available.length + ' murid tersisa:\n\n' + preview,
    { title: 'Bentuk Otomatis?', okText: 'Ya, Buat Semua' }
  );
  if (!ok) return;
  var okCount = 0, failCount = 0;
  for (var i = 0; i < groups.length; i++) {
    var anggota = groups[i].map(function(m) { return { id_murid: m.id_murid, nama_murid: m.nama_murid }; });
    try { await window.HQ.GuruAPI.createKelompokBelajar(_kbData.id_halaqah, null, anggota); okCount++; }
    catch(e) { failCount++; }
  }
  showToast(okCount + ' kelompok dibuat otomatis ✓' + (failCount ? (' · ' + failCount + ' gagal') : ''), failCount ? 'warning' : 'success');
  renderKelolaKelompokBelajar();
}

async function kbCreateKelompok() {
  var checks = Array.prototype.slice.call(document.querySelectorAll('.kb-new-anggota:checked'));
  if (checks.length < 3 || checks.length > 5) {
    showToast('Pilih 3-5 murid untuk satu kelompok', 'warning');
    return;
  }
  var anggota = checks.map(function(c) { return { id_murid: c.value, nama_murid: c.getAttribute('data-nama') }; });
  var nama = (document.getElementById('kbNewNama').value || '').trim() || null;
  try {
    await window.HQ.GuruAPI.createKelompokBelajar(_kbData.id_halaqah, nama, anggota);
    showToast('Kelompok belajar dibuat ✓', 'success');
    document.getElementById('kbNewNama').value = '';
    renderKelolaKelompokBelajar();
  } catch(e) {
    showToast(e.message || 'Gagal membuat kelompok', 'error');
  }
}

async function kbRenameKelompok(id_kelompok, nama) {
  try {
    await window.HQ.GuruAPI.updateKelompokBelajar(id_kelompok, { nama_kelompok: nama.trim() || null });
    showToast('Nama kelompok disimpan ✓', 'success');
    var k = _kbData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
    if (k) k.nama_kelompok = nama.trim() || null;
  } catch(e) {
    showToast(e.message || 'Gagal menyimpan nama', 'error');
  }
}

async function kbDeleteKelompok(id_kelompok) {
  var ok = await showConfirm('Hapus kelompok ini? Anggota akan kehilangan akses partner belajar.', { title: 'Hapus Kelompok?', okText: 'Ya, Hapus', danger: true });
  if (!ok) return;
  try {
    await window.HQ.GuruAPI.deleteKelompokBelajar(id_kelompok);
    showToast('Kelompok dihapus', 'success');
    renderKelolaKelompokBelajar();
  } catch(e) {
    showToast(e.message || 'Gagal menghapus kelompok', 'error');
  }
}

async function kbRemoveAnggota(id_kelompok, id_murid) {
  // C3 fix (bug hunt 2026-08-18): lihat catatan di kpRemoveAnggota -- mutasi
  // 1 baris di server, bukan replace-all dari cache klien yang bisa basi.
  var k = _kbData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
  if (!k) return;
  var jumlahSaatIni = (k.anggota_kelompok_belajar || []).length;
  if (jumlahSaatIni <= 3) {
    showToast('Kelompok minimal harus punya 3 anggota. Hapus kelompok ini jika ingin mengosongkannya.', 'warning');
    return;
  }
  try {
    await window.HQ.GuruAPI.removeAnggotaKelompokBelajar(id_kelompok, id_murid);
    showToast('Anggota diperbarui ✓', 'success');
    renderKelolaKelompokBelajar();
  } catch(e) {
    showToast(e.message || 'Gagal memperbarui anggota', 'error');
  }
}

async function kbAddAnggota(id_kelompok, selectEl) {
  var id_murid = selectEl.value;
  if (!id_murid) return;
  var nama_murid = selectEl.options[selectEl.selectedIndex].getAttribute('data-nama');
  var k = _kbData.kelompok.find(function(x) { return x.id_kelompok === id_kelompok; });
  if (!k) return;
  var jumlahSaatIni = (k.anggota_kelompok_belajar || []).length;
  if (jumlahSaatIni >= 5) {
    showToast('Maksimal 5 anggota per kelompok', 'warning');
    return;
  }
  try {
    await window.HQ.GuruAPI.addAnggotaKelompokBelajar(id_kelompok, id_murid, nama_murid);
    showToast('Anggota ditambahkan ✓', 'success');
    renderKelolaKelompokBelajar();
  } catch(e) {
    showToast(e.message || 'Gagal menambah anggota', 'error');
  }
}



  // ── EXPOSE PUBLIC INTERFACE TO WINDOW ──
  window._kbInitDashCard = _kbInitDashCard;
  window.toggleKelolaKelompokPartner = toggleKelolaKelompokPartner;
  window.renderKelolaKelompokPartner = renderKelolaKelompokPartner;
  window.kpToggleLiniMasa = kpToggleLiniMasa;
  window.kpAddMilestone = kpAddMilestone;
  window.kpDeleteMilestone = kpDeleteMilestone;
  window.kpGuruKonfirmasi = kpGuruKonfirmasi;
  window.kpToggleTarget = kpToggleTarget;
  window.kpAddTarget = kpAddTarget;
  window.kpMarkTarget = kpMarkTarget;
  window.kpDeleteTarget = kpDeleteTarget;
  window.kpNudgeAnggota = kpNudgeAnggota;
  window.kpCreateKelompok = kpCreateKelompok;
  window.kpRenameKelompok = kpRenameKelompok;
  window.kpDeleteKelompok = kpDeleteKelompok;
  window.kpRemoveAnggota = kpRemoveAnggota;
  window.kpAddAnggota = kpAddAnggota;
  window._kpOnCheckToggle = _kpOnCheckToggle;
  window.kpAutoBentukKelompok = kpAutoBentukKelompok;

  window.toggleKelolaKelompokBelajar = toggleKelolaKelompokBelajar;
  window.renderKelolaKelompokBelajar = renderKelolaKelompokBelajar;
  window.kbToggleLiniMasa = kbToggleLiniMasa;
  window.kbAddMilestone = kbAddMilestone;
  window.kbDeleteMilestone = kbDeleteMilestone;
  window.kbGuruKonfirmasi = kbGuruKonfirmasi;
  window.kbToggleTarget = kbToggleTarget;
  window.kbAddTarget = kbAddTarget;
  window.kbMarkTarget = kbMarkTarget;
  window.kbDeleteTarget = kbDeleteTarget;
  window.kbNudgeAnggota = kbNudgeAnggota;
  window.kbColekKelompok = kbColekKelompok;
  window.kbCreateKelompok = kbCreateKelompok;
  window.kbRenameKelompok = kbRenameKelompok;
  window.kbDeleteKelompok = kbDeleteKelompok;
  window.kbRemoveAnggota = kbRemoveAnggota;
  window.kbAddAnggota = kbAddAnggota;
  window._kbOnCheckToggle = _kbOnCheckToggle;
  window.kbAutoBentukKelompok = kbAutoBentukKelompok;
})();
