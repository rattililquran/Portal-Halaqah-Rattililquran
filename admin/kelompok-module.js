// ============================================================
//  Portal Admin — Kelompok Belajar & Partner Qiyam Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Kelompok Belajar & Partner Qiyam ---

// ── Lini Masa Kelompok (admin) — gabungan setoran dikonfirmasi + milestone ──
function _kqRenderLiniMasa(setoran, milestones) {
  const jenisIcon = { Ziyadah:'📖', Murajaah:'🔄' };
  const events = [];
  (setoran || []).forEach(s => {
    events.push({ t:new Date(s.tanggal).getTime(), dot:'#16a34a', tgl:s.tanggal, html:
      `<div style="font-weight:700;color:var(--text-1,#374151)">${jenisIcon[s.jenis]||'📖'} ${esc(s.nama_murid)} — ${esc(s.jenis)}</div>`
      + `<div style="color:var(--text-3)">QS. ${esc(s.surat)} ayat ${esc(s.ayat_dari)}-${esc(s.ayat_sampai)}${s.kelancaran ? ' · '+esc(s.kelancaran) : ''}</div>`
      + (s.catatan_partner ? `<div style="color:#0f766e">💬 ${esc(s.catatan_partner)}${s.reaksi_partner ? ' '+esc(s.reaksi_partner) : ''}</div>` : '')
    });
  });
  (milestones || []).forEach(m => {
    events.push({ t:new Date(m.tanggal).getTime(), dot:'#f59e0b', tgl:m.tanggal, html:
      `<div style="font-weight:800;color:#b45309">🏆 ${esc(m.judul)}`
        + `<button onclick="kqDeleteMilestone('${esc(m.id_milestone)}','${esc(m.id_kelompok)}')" style="border:none;background:none;color:#ef4444;cursor:pointer;font-size:12px;margin-left:6px" title="Hapus">✕</button>`
      + `</div>`
      + `<div style="color:var(--text-3);font-size:10px">ditandai oleh ${esc(m.nama_pembuat || '-')}</div>`
    });
  });
  if (!events.length) return '<div style="font-size:11px;color:var(--text-3)">Belum ada jejak.</div>';
  events.sort((a,b) => b.t - a.t);
  return events.map(e =>
    `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border,#f0f0f0);font-size:11px">`
      + `<span style="width:8px;height:8px;border-radius:50%;background:${e.dot};flex-shrink:0;margin-top:4px"></span>`
      + `<div style="flex:1;min-width:0">${e.html}<div style="color:var(--text-3);font-size:10px">${esc(_kqFmtTgl(e.tgl))}</div></div>`
    + `</div>`
  ).join('');
}

function _kqFmtTgl(iso) {
  try { return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }); }
  catch(e) { return iso; }
}

async function _kqLoadLiniMasa(id_kelompok) {
  const c = document.getElementById('kqLini_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    const res = await Promise.all([
      window.HQ.AdminAPI.getLiniMasaSetoranKelompok(id_kelompok),
      window.HQ.AdminAPI.getMilestoneByKelompok(id_kelompok),
    ]);
    c.innerHTML = _kqRenderLiniMasa(res[0].data || [], res[1].data || []);
  } catch(e) { c.innerHTML = `<div style="font-size:11px;color:var(--red)">Gagal: ${esc(friendlyError(e))}</div>`; }
}

function kqToggleLiniMasa(id_kelompok) {
  const c = document.getElementById('kqLini_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kqLoadLiniMasa(id_kelompok);
}

async function kqAddMilestone(id_kelompok) {
  const judul = prompt('Tandai milestone kelompok (mis: Dedy khatam Juz 30):');
  if (!judul || !judul.trim()) return;
  try {
    await window.HQ.AdminAPI.addMilestoneKelompok({ id_kelompok, id_halaqah: _kqData.id_halaqah, judul: judul.trim() });
    toast('Milestone ditandai', 'ok');
    _kqLoadLiniMasa(id_kelompok);
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}

async function kqDeleteMilestone(id_milestone, id_kelompok) {
  try {
    await window.HQ.AdminAPI.deleteMilestoneKelompok(id_milestone);
    toast('Milestone dihapus', 'ok');
    _kqLoadLiniMasa(id_kelompok);
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}

// ── #3 Konfirmasi setoran partner menunggu (admin) ──
async function _kqRenderMenunggu() {
  const wrap = document.getElementById('kqMenungguWrap');
  if (!wrap) return;
  try {
    const res = await window.HQ.AdminAPI.getSetoranPartnerMenungguHalaqah(_kqData.id_halaqah);
    const data = res.data || [];
    if (!data.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    const cfgRes = await window.HQ.GuruAPI.getPenilaianHafalan();
    const kelOpts = ((cfgRes.data && cfgRes.data.kelancaran) || []).map(k =>
      `<option value="${esc(k.nama)}">${esc(k.icon||'')} ${esc(k.nama)}</option>`).join('');
    wrap.style.display = 'block';
    wrap.innerHTML = `<div class="card"><div class="card-body" style="background:#fffbeb">`
      + `<div style="font-size:12px;font-weight:800;color:#92400e;margin-bottom:8px">⏳ Setoran Partner Menunggu Konfirmasi (${data.length})</div>`
      + data.map(r =>
          `<div style="background:#fff;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-bottom:6px">`
          + `<div style="font-weight:800;font-size:12px">${esc(r.nama_murid)}</div>`
          + `<div style="font-size:11px;color:#6b7280;margin-bottom:6px">${esc(r.jenis)} · Juz ${esc(r.juz||'-')} · ${esc(r.surat)} ayat ${esc(r.ayat_dari)}-${esc(r.ayat_sampai)}</div>`
          + `<div style="display:flex;gap:6px"><select class="fc" id="kqKonf_${esc(r.id_setoran)}" style="flex:1;font-size:11px;padding:5px 8px">${kelOpts}</select>`
          + `<button onclick="kqGuruKonfirmasi('${esc(r.id_setoran)}')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:0 12px;font-weight:800;font-size:11px;cursor:pointer">✓ Konfirmasi</button></div>`
          + `</div>`
        ).join('')
      + `</div></div>`;
  } catch(e) { wrap.style.display = 'none'; }
}
async function kqGuruKonfirmasi(id_setoran) {
  const sel = document.getElementById('kqKonf_' + id_setoran);
  try {
    await window.HQ.AdminAPI.guruKonfirmasiSetoran(id_setoran, sel ? sel.value : null, null);
    toast('Setoran dikonfirmasi', 'ok');
    onKqHalaqahChange();
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}

// ── #4 Target bersama kelompok (admin) ── konsensus: progres X/Y dari murid
function _kqRenderTargetHtml(targets, total) {
  total = total || 0;
  let html = `<div style="display:flex;gap:6px;margin-bottom:8px"><input type="text" class="fc" id="kqTgtInput" placeholder="Target baru (mis: Khatam Juz 30)" style="flex:1;font-size:11px;padding:5px 8px"><button onclick="kqAddTarget('__K__')" style="background:#d97706;color:#fff;border:none;border-radius:7px;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer">+ Set</button></div>`;
  if (!(targets || []).length) return html + `<div style="font-size:11px;color:var(--text-3)">Belum ada target.</div>`;
  return html + targets.map(t => {
    const done = (t.target_partner_progress || []).length;
    const tercapai = t.status === 'tercapai';
    const badge = tercapai
      ? `<span style="font-size:10px;font-weight:800;color:#15803d;background:rgba(22,163,74,.14);border-radius:100px;padding:1px 7px">🎉 tercapai</span>`
      : `<span style="font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;border-radius:100px;padding:1px 7px">${done}/${total} selesai</span>`;
    const markBtn = tercapai ? '' : `<button onclick="kqMarkTarget('${esc(t.id_target)}','${esc(t.id_kelompok)}')" title="Tandai tercapai (paksa, override konsensus)" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✓</button>`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;background:rgba(245,158,11,.08);border-radius:8px;margin-bottom:5px">`
    + `<span style="font-size:11px;font-weight:700;color:#92400e;flex:1;min-width:0">🎯 ${esc(t.judul)} ${badge}</span>`
    + `<span style="display:flex;gap:4px;flex-shrink:0">${markBtn}`
    + `<button onclick="kqDeleteTarget('${esc(t.id_target)}','${esc(t.id_kelompok)}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px">✕</button></span>`
  + `</div>`;
  }).join('');
}
async function _kqLoadTarget(id_kelompok) {
  const c = document.getElementById('kqTarget_' + id_kelompok);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = '<div style="font-size:11px;color:var(--text-3)">⏳ Memuat...</div>';
  try {
    const k = _kqData.kelompok.find(x => x.id_kelompok === id_kelompok);
    const total = k ? (k.anggota_kelompok_partner || []).length : 0;
    const res = await window.HQ.AdminAPI.getTargetByKelompok(id_kelompok);
    c.innerHTML = _kqRenderTargetHtml(res.data || [], total).replace(/__K__/g, id_kelompok);
  } catch(e) { c.innerHTML = `<div style="font-size:11px;color:var(--red)">Gagal: ${esc(friendlyError(e))}</div>`; }
}
function kqToggleTarget(id_kelompok) {
  const c = document.getElementById('kqTarget_' + id_kelompok);
  if (!c) return;
  if (c.style.display !== 'none') { c.style.display = 'none'; return; }
  _kqLoadTarget(id_kelompok);
}
async function kqAddTarget(id_kelompok) {
  const inp = document.getElementById('kqTgtInput');
  const judul = inp ? (inp.value || '').trim() : '';
  if (!judul) { toast('Tulis dulu targetnya', 'err'); return; }
  try {
    await window.HQ.AdminAPI.addTargetByKelompok({ id_kelompok, id_halaqah: _kqData.id_halaqah, judul });
    toast('Target ditetapkan', 'ok');
    _kqLoadTarget(id_kelompok);
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}
async function kqMarkTarget(id_target, id_kelompok) {
  if (!confirm('Tandai target ini TERCAPAI untuk seluruh kelompok? Ini menimpa konsensus murid (tidak menunggu semua anggota menandai).')) return;
  try {
    await window.HQ.AdminAPI.updateTargetByKelompok(id_target, { status: 'tercapai' });
    toast('Target tercapai', 'ok');
    _kqLoadTarget(id_kelompok);
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}
async function kqDeleteTarget(id_target, id_kelompok) {
  try {
    await window.HQ.AdminAPI.deleteTargetByKelompok(id_target);
    toast('Target dihapus', 'ok');
    _kqLoadTarget(id_kelompok);
  } catch(e) { toast('Gagal: '+e.message, 'err'); }
}

// Satu baris denyut anggota (admin): tanggal terakhir + status aktif/mandek + ingatkan WA
function _kqDenyutRow(a) {
  const p = (_kqData.pantau && _kqData.pantau[a.id_murid]) || null;
  const last = p && p.tanggal_terakhir;
  const hari = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const menunggu = p ? (p.jumlah_menunggu || 0) : 0;
  const mandek = (hari === null) || (hari >= 7);
  const dot = mandek ? '#f59e0b' : '#16a34a';
  const statusTxt = (hari === null)
    ? 'Belum pernah setor'
    : (hari === 0 ? 'Setor hari ini' : (hari === 1 ? 'Setor kemarin' : `Terakhir ${hari} hari lalu`));
  const menungguBadge = menunggu > 0
    ? `<span style="font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;border-radius:100px;padding:1px 7px;margin-left:6px">${menunggu} menunggu</span>`
    : '';
  let nudgeBtn = '';
  if (mandek && p && p.no_hp) {
    nudgeBtn = `<button onclick="kqNudgeAnggota('${escJs(a.nama_murid||'')}','${esc(p.no_hp)}')" style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;background:#25d366;color:#fff;border:none;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">💬 Ingatkan</button>`;
  }
  return `<div style="display:flex;align-items:center;gap:7px;padding:5px 0;font-size:12px">`
    + `<span style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0"></span>`
    + `<span style="font-weight:700;color:var(--text-1,#374151)">${esc(a.nama_murid || a.id_murid)}</span>`
    + `<span style="color:var(--text-3);font-size:11px">· ${statusTxt}</span>`
    + menungguBadge
    + nudgeBtn
  + `</div>`;
}

// Kirim WA pengingat dari admin ke anggota yang mandek
function kqNudgeAnggota(nama, hp) {
  let raw = String(hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) { toast('Nomor HP murid ini belum tersedia di data pengguna.', 'err'); return; }
  if (raw.charAt(0) === '0') raw = '62' + raw.slice(1);
  else if (raw.slice(0,2) !== '62') raw = '62' + raw;
  const msg =
    'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙\n\n' +
    'Ananda *' + (nama || 'Murid') + '*, kami memantau setoran hafalan qiyam bersama partnermu. ' +
    'Sudah beberapa waktu belum ada setoran baru — yuk semangat lanjutkan setoran & muraja\'ah bersama partner ya 🤝\n\n' +
    'Barakallahu fiikum.';
  window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
}

function _kqRenderNewForm() {
  const assigned  = _kqAssignedMurid(null);
  const available = _kqData.murid.filter(m => !assigned[m.id_murid]);
  const wrap = document.getElementById('kqNewAnggotaList');
  if (!available.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:var(--text-3)">Semua murid sudah tergabung di kelompok partner</div>';
    return;
  }
  wrap.innerHTML = available.map(m =>
    `<label style="display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid var(--border,#f3f4f6);border-radius:9px;margin-bottom:5px;font-size:12px;cursor:pointer">`
      + `<input type="checkbox" value="${esc(m.id_murid)}" data-nama="${esc(m.nama_murid)}" class="kq-new-anggota">`
      + esc(m.nama_murid)
    + `</label>`
  ).join('');
}

async function kqCreateKelompok() {
  const checks = Array.from(document.querySelectorAll('.kq-new-anggota:checked'));
  if (checks.length < 2 || checks.length > 3) {
    toast('Pilih 2-3 murid untuk satu kelompok', 'err');
    return;
  }
  const anggota = checks.map(c => ({ id_murid: c.value, nama_murid: c.getAttribute('data-nama') }));
  const nama = (document.getElementById('kqNewNama').value || '').trim() || null;
  try {
    await window.HQ.AdminAPI.createKelompokPartner(_kqData.id_halaqah, nama, anggota);
    toast('Kelompok partner dibuat', 'ok');
    document.getElementById('kqNewNama').value = '';
    onKqHalaqahChange();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
}

async function kqRenameKelompok(id_kelompok, nama) {
  try {
    await window.HQ.AdminAPI.updateKelompokPartner(id_kelompok, { nama_kelompok: nama.trim() || null });
    toast('Nama kelompok disimpan', 'ok');
    const k = _kqData.kelompok.find(x => x.id_kelompok === id_kelompok);
    if (k) k.nama_kelompok = nama.trim() || null;
  } catch(e) { toast('Gagal: '+e.message,'err'); }
}

async function kqDeleteKelompok(id_kelompok) {
  const ok = await showConfirm('Hapus kelompok ini? Anggota akan kehilangan akses partner.', { title: 'Hapus Kelompok?', okText: 'Ya, Hapus', danger: true });
  if (!ok) return;
  try {
    await window.HQ.AdminAPI.deleteKelompokPartner(id_kelompok);
    toast('Kelompok dihapus', 'ok');
    onKqHalaqahChange();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
}

async function kqRemoveAnggota(id_kelompok, id_murid) {
  const k = _kqData.kelompok.find(x => x.id_kelompok === id_kelompok);
  if (!k) return;
  const anggotaBaru = (k.anggota_kelompok_partner||[])
    .filter(a => a.id_murid !== id_murid)
    .map(a => ({ id_murid: a.id_murid, nama_murid: a.nama_murid }));
  if (anggotaBaru.length < 2) {
    toast('Kelompok minimal harus punya 2 anggota. Hapus kelompok ini jika ingin mengosongkannya.', 'err');
    return;
  }
  try {
    await window.HQ.AdminAPI.setAnggotaKelompok(id_kelompok, anggotaBaru);
    toast('Anggota diperbarui', 'ok');
    onKqHalaqahChange();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
}

async function kqAddAnggota(id_kelompok, selectEl) {
  const id_murid = selectEl.value;
  if (!id_murid) return;
  const nama_murid = selectEl.options[selectEl.selectedIndex].getAttribute('data-nama');
  const k = _kqData.kelompok.find(x => x.id_kelompok === id_kelompok);
  if (!k) return;
  const anggotaBaru = (k.anggota_kelompok_partner||[])
    .map(a => ({ id_murid: a.id_murid, nama_murid: a.nama_murid }))
    .concat([{ id_murid, nama_murid }]);
  if (anggotaBaru.length > 3) {
    toast('Maksimal 3 anggota per kelompok', 'err');
    return;
  }
  try {
    await window.HQ.AdminAPI.setAnggotaKelompok(id_kelompok, anggotaBaru);
    toast('Anggota ditambahkan', 'ok');
    onKqHalaqahChange();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
}


  // --- Assign Ketua Kelas ---
// ══════════════════════════════════════════
// ══ ASSIGN KETUA KELAS (superadmin) ═════════════════
async function toggleKetua(idAnggota, currentStatus, nama) {
  var isKetua = String(currentStatus).toUpperCase() === 'TRUE';
  var msg = isKetua
    ? 'Cabut status ketua kelas dari ' + nama + '?'
    : 'Jadikan ' + nama + ' sebagai ketua kelas halaqah ini?\n(Ketua lama akan otomatis diganti)';
  if (!(await showConfirm(msg, { title: 'Konfirmasi Ketua Kelas', okText: 'Ya, Lanjutkan' }))) return;
  showLoad('Memproses...');
  try {
    await window.HQ.SuperAdminAPI.assignKetuaKelas({ id_anggota: idAnggota, assign: !isKetua });
    toast(isKetua ? 'Status ketua dicabut' : 'Ketua kelas berhasil ditunjuk', 'ok');
    loadAnggota();
  } catch(e) { toast(friendlyError(e), 'err'); }
  finally { hideLoad(); }
}


  // Export functions to window
  if (typeof window !== undefined) {
    [
      loadKelompokAdmin, renderKelompokAdminCard, assignKetuaKelas, simpanAssignKetua
    ].forEach(fnName => {
      try {
        if (typeof eval(fnName) === "function") {
          window[fnName] = eval(fnName);
        }
      } catch(e) {}
    });
  }
})();
