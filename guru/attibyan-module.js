// ══════════════════════════════════════════════════════════════
//  Rattil Portal Guru — Modul At-Tibyan & Assessment (attibyan-module.js)
//  Ekstraksi Fase 3: Memecah monolitik guru/index.html
// ══════════════════════════════════════════════════════════════

(function() {
// ══════════════════════════════════════════
//  KEAKTIFAN MURID
// ══════════════════════════════════════════
// window.HQ.AppState._keaktifanData in AppState

async function loadKeaktifanPage() {
  var grid = document.getElementById('keaktifanGrid');
  if (grid) grid.innerHTML = Array(4).fill('<div class="skel skel-card" style="height:120px;border-radius:16px"></div>').join('');
  showLoad('Bismillah, memuat data keaktifan...');
  try {
    var r = await window.HQ.GuruAPI.getKeaktifanAlerts();
    if (r.status !== 'ok') throw new Error(r.message || 'Gagal memuat data');
    window.HQ.AppState._keaktifanData = r.data;
    
    // Populate halaqah filter dropdown
    var sel = document.getElementById('filterKeaktifanHalaqah');
    if (sel) {
      sel.innerHTML = '<option value="">— Semua Halaqah —</option>';
      var uniqHalaqahs = {};
      window.HQ.AppState._keaktifanData.alerts.forEach(function(item) {
        if (item.id_halaqah && !uniqHalaqahs[item.id_halaqah]) {
          uniqHalaqahs[item.id_halaqah] = item.nama_halaqah;
          var opt = document.createElement('option');
          opt.value = item.id_halaqah;
          opt.textContent = item.nama_halaqah;
          sel.appendChild(opt);
        }
      });
    }

    renderKeaktifanPage();
  } catch(e) {
    toast(friendlyError(e), 'err');
  } finally {
    hideLoad();
  }
}

function renderKeaktifanPage() {
  if (!window.HQ.AppState._keaktifanData) return;
  document.getElementById('countKritis').textContent = window.HQ.AppState._keaktifanData.summary.kritis;
  document.getElementById('countPeringatan').textContent = window.HQ.AppState._keaktifanData.summary.peringatan;
  document.getElementById('countNormal').textContent = window.HQ.AppState._keaktifanData.summary.normal;

  filterKeaktifanCards();
}

function filterKeaktifanCards() {
  if (!window.HQ.AppState._keaktifanData) return;
  var q = document.getElementById('searchKeaktifanMurid').value.toLowerCase().trim();
  var st = document.getElementById('filterKeaktifanStatus').value;
  var hl = document.getElementById('filterKeaktifanHalaqah').value;

  var grid = document.getElementById('keaktifanGrid');
  grid.innerHTML = '';

  var filtered = window.HQ.AppState._keaktifanData.alerts.filter(function(item) {
    if (q && item.nama_murid.toLowerCase().indexOf(q) === -1) return false;
    if (st && item.status !== st) return false;
    if (hl && item.id_halaqah !== hl) return false;
    return true;
  });

  if (filtered.length === 0) {
    var isFiltered = q || st || hl;
    var allNormal = window.HQ.AppState._keaktifanData && window.HQ.AppState._keaktifanData.summary.kritis === 0 && window.HQ.AppState._keaktifanData.summary.peringatan === 0;
    var emptyMsg = isFiltered
      ? '<div class="guru-empty-ico">🔍</div><div class="guru-empty-ttl">Tidak ada murid yang cocok</div><div class="guru-empty-sub">Coba ubah atau hapus filter pencarian.</div>'
      : allNormal
        ? '<div class="guru-empty-ico">🌟</div><div class="guru-empty-ttl">Alhamdulillah, semua murid aktif!</div><div class="guru-empty-sub">Tidak ada murid dengan status kritis atau peringatan. Tetap semangat menjaga kehadiran!</div>'
        : '<div class="guru-empty-ico">📭</div><div class="guru-empty-ttl">Belum ada data keaktifan</div><div class="guru-empty-sub">Data akan muncul setelah ada riwayat KBM yang tercatat.</div>';
    grid.innerHTML = '<div style="grid-column:1/-1"><div class="guru-empty">' + emptyMsg + '</div></div>';
    return;
  }

  filtered.forEach(function(m) {
    var card = document.createElement('div');
    card.className = 'card';
    
    var borderColor = 'var(--green)';
    var statusLabel = 'Normal 🟢';
    if (m.status === 'kritis') {
      borderColor = 'var(--red)';
      statusLabel = 'Kritis 🔴';
    } else if (m.status === 'peringatan') {
      borderColor = 'var(--amber)';
      statusLabel = 'Peringatan 🟡';
    }

    card.style = 'border-radius:16px; background:#card; padding:18px; box-shadow:var(--shadow); border-left: 6px solid ' + borderColor + '; display:flex; flex-direction:column; gap:12px; transition: transform .2s, box-shadow .2s; position:relative; background:#fff;';
    card.dataset.muridId   = m.id_murid;
    card.dataset.halaqahId = m.id_halaqah;

    var cardHead = '<div style="display:flex; justify-content:space-between; align-items:flex-start;">'
      + '<div>'
      + '<div style="font-size:16px; font-weight:800; color:var(--text); margin-bottom:2px;">' + esc(m.nama_murid) + '</div>'
      + '<div style="font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.04em;">' + esc(m.nama_halaqah) + ' • Level ' + esc(m.level) + '</div>'
      + '</div>'
      + '<span class="badge" style="font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; background:' + (m.status === 'kritis' ? 'var(--red-l)' : m.status === 'peringatan' ? 'var(--amber-l)' : 'var(--green-l)') + '; color:' + (m.status === 'kritis' ? 'var(--red)' : m.status === 'peringatan' ? 'var(--amber-txt)' : 'var(--green)') + ';">' + statusLabel + '</span>'
      + '</div>';

    var metricItems = '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; background:var(--bg); padding:10px; border-radius:10px; text-align:center; font-size:12px;">'
      + '<div><div style="color:var(--text-3); font-weight:600;">Absen</div><div style="font-size:16px; font-weight:800; color:' + (m.metrics.absen > 0 ? 'var(--red)' : 'var(--text)') + '">' + m.metrics.absen + '</div></div>'
      + '<div><div style="color:var(--text-3); font-weight:600;">Terlambat</div><div style="font-size:16px; font-weight:800; color:' + (m.metrics.terlambat >= 2 ? 'var(--amber)' : 'var(--text)') + '">' + m.metrics.terlambat + '</div></div>'
      + '<div><div style="color:var(--text-3); font-weight:600;">Kamera</div><div style="font-size:16px; font-weight:800; color:' + (m.metrics.kamera_tertutup >= 2 ? 'var(--amber)' : 'var(--text)') + '">' + m.metrics.kamera_tertutup + '</div></div>'
      + '</div>';

    var dots = (m.riwayat || []).map(function(s) {
      var color = '#10b981';
      var title = s.tanggal + ': Hadir';
      if (s.warna === 'merah') {
        color = '#ef4444';
        title = s.tanggal + ': Absen/Alpa';
      } else if (s.warna === 'kuning') {
        color = '#f59e0b';
        title = s.tanggal + ': Terlambat';
      } else if (s.warna === 'coklat') {
        color = '#b45309';
        title = s.tanggal + ': Kamera Tertutup';
      } else if (s.warna === 'abu') {
        color = '#9ca3af';
        title = s.tanggal + ': Izin';
      }
      return '<span style="width:10px; height:10px; border-radius:50%; background:' + color + '; display:inline-block; margin:0 3px; cursor:pointer;" title="' + title + '"></span>';
    }).join('');

    var historyDiv = '<div style="margin:4px 0;">'
      + '<div style="font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">Riwayat Kehadiran (Terbaru → Kanan)</div>'
      + '<div style="display:flex; flex-wrap:wrap; align-items:center; min-height:16px;">' + (dots || '<span style="color:var(--text-3); font-style:italic; font-size:12px;">Belum ada sesi</span>') + '</div>'
      + '</div>';

    var flagsHTML = '';
    if (m.flags && m.flags.length > 0) {
      flagsHTML += '<div data-flags-area style="display:flex; flex-direction:column; gap:6px; margin:4px 0;">';
      m.flags.forEach(function(f) {
        // Skip flag yang sudah di-contacted dalam sesi ini — key: id_murid_id_halaqah_tipe
        if (_keaktifanContacted.has(m.id_murid + '_' + m.id_halaqah + '_' + f.tipe)) {
          flagsHTML += '<div style="background:var(--green-l);color:var(--green);padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700">✅ Sudah dihubungi — ' + esc(f.label) + '</div>';
          return;
        }
        var btnBg = f.tipe === 'absen' ? 'var(--red-l)' : 'var(--amber-l)';
        var btnColor = f.tipe === 'absen' ? 'var(--red)' : 'var(--amber-txt)';
        flagsHTML += '<div data-flag-row style="display:flex;justify-content:space-between;align-items:center;background:' + btnBg + ';padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.03)">'
          + '<span style="font-size:12px;font-weight:700;color:' + btnColor + '">⚠️ ' + esc(f.label) + ' <small>(' + esc(f.detail) + ')</small></span>'
          + '<button onclick="doMarkContacted(\'' + esc(m.id_murid) + '\',\'' + esc(m.id_halaqah) + '\',\'' + esc(f.tipe) + '\',' + f.count + ',this)" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;transition:opacity .15s">'
          + 'Tabayyun/tindak Lanjuti'
          + '</button>'
          + '</div>';
      });
      flagsHTML += '</div>';
    }
    // Tidak tampilkan "Sudah Dihubungi" secara otomatis —
    // tombol ✓ di card flags yang menandai murid sudah dihubungi

    var mIdx = window.HQ.AppState._keaktifanData.alerts.indexOf(m);

    var actionsHTML = '<div style="display:flex; gap:8px; margin-top:auto; padding-top:6px; border-top:1px solid var(--border);">'
      + '<button class="btn btn-outline" onclick="showKeaktifanDetailModal(' + mIdx + ')" style="flex:1; justify-content:center; padding:8px; font-size:12px; font-weight:700; cursor:pointer; border-radius:8px; gap:4px; display:flex; align-items:center;">'
      + '📜 Detail Riwayat'
      + '</button>'
      + '</div>';

    card.innerHTML = cardHead + metricItems + historyDiv + flagsHTML + actionsHTML;
    grid.appendChild(card);
  });
}

// ══════════════════════════════════════════
//  WHATSAPP KEAKTIFAN — Hubungi Murid
// ══════════════════════════════════════════
function buildWAMessageKeaktifan(m) {
  var nama   = m.nama_murid || 'Peserta';
  var hal    = m.nama_halaqah || '';
  var levelText = m.level ? (String(m.level).toLowerCase().indexOf('level') !== -1 ? m.level : 'Level ' + m.level) : '';
  var absen  = m.metrics ? m.metrics.absen : 0;
  var lambat = m.metrics ? m.metrics.terlambat : 0;
  var kamera = m.metrics ? m.metrics.kamera_tertutup : 0;

  // Ikon status
  var statusIkon = m.status === 'kritis' ? '🔴 *Kritis*' : '🟡 *Perlu Diperhatikan*';

  // Susun baris flags
  var flagLines = '';
  if (m.flags && m.flags.length) {
    m.flags.forEach(function(f) {
      var ikon = f.tipe === 'absen' ? (f.count >= 2 ? '🔴' : '🟠') : (f.tipe === 'terlambat' ? '🕐' : '📷');
      flagLines += '\n  ' + ikon + ' ' + f.label + ': *' + f.detail + '*';
    });
  }

  var msg =
    'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙 \n' +
    'semoga Allah senantiasa menjaga kita semua\n\n' +
    'izinkan Kami ingin menyampaikan laporan keaktifan KBM Rattililquran:\n\n' +
    '👤 *' + nama + '*\n' +
    '📚 Halaqah: ' + hal + (levelText ? ' • ' + levelText : '') + '\n' +
    '⚡ Status: ' + statusIkon + '\n\n' +
    '📊 *Evaluasi 40 Sesi Terakhir:*\n' +
    '  • Absen (Alpa)   : *' + absen + ' sesi*\n' +
    '  • Terlambat       : *' + lambat + ' sesi*\n' +
    '  • Kamera Tertutup : *' + kamera + ' sesi*\n';

  if (flagLines) {
    msg += '\n⚠️ *Catatan Khusus:*' + flagLines + '\n';
  }

  msg +=
    '\nKami berharap keaktifan dapat segera meningkat. Berikut yang dapat dilakukan:\n' +
    '  ✅ Hadir tepat waktu dan pastikan kamera aktif saat sesi berlangsung\n' +
    '  ✅ Kabari guru jika ada kendala yang membuat sulit hadir\n\n' +
    'Kami terbuka untuk berdiskusi jika ada hal yang ingin disampaikan. Jangan ragu untuk menyampaikannya.\n\n' +
    'Jazakumullahu khairan. 🙏 Rattil Al-Qur\'an\n\n' +
    '-Data ini direkap otomatis melalui portal Rattililqur\'an, jika ada ketidak cocokan data mohon untuk konfirmasi-';

  return msg;
}

function openWAKeaktifan(idx) {
  var m = window.HQ.AppState._keaktifanData && window.HQ.AppState._keaktifanData.alerts[idx];
  if (!m) return;

  var raw = String(m.no_hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) {
    toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn');
    return;
  }

  // Normalkan ke format internasional 62xxx
  if (raw.startsWith('0')) raw = '62' + raw.slice(1);
  else if (!raw.startsWith('62')) raw = '62' + raw;

  var msg  = buildWAMessageKeaktifan(m);
  var url  = 'https://wa.me/' + raw + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

function openWAMurid(nama, hp, level) {
  var raw = String(hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) {
    toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn');
    return;
  }
  if (raw.startsWith('0')) raw = '62' + raw.slice(1);
  else if (!raw.startsWith('62')) raw = '62' + raw;

  var levelText = level ? (String(level).toLowerCase().indexOf('level') !== -1 ? level : 'Level ' + level) : '';
  var msg =
    'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙\n\n' +
    'Ananda *' + (nama || 'Murid') + '*' + (levelText ? ' (' + levelText + ')' : '') + ',\n' +
    'kami dari Rattililqur\'an ingin menyampaikan sesuatu terkait perjalanan belajar ananda di halaqah.\n\n' +
    'Jazakumullahu khairan 🙏';

  window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
}

// Set untuk menyimpan flag yang sudah ditandai (in-memory, per session)
var _keaktifanContacted = new Set();

async function doMarkContacted(idMurid, idHalaqah, tipeAlert, value, btnEl) {
  if (!(await showConfirm('Tindak lanjuti murid ini dan hubungi via WhatsApp?', { title: 'Tindak Lanjut Murid', okText: 'Ya, Lanjutkan' }))) return;

  // Cari data murid di data lokal
  var alertItem = null;
  if (window.HQ.AppState._keaktifanData && window.HQ.AppState._keaktifanData.alerts) {
    alertItem = window.HQ.AppState._keaktifanData.alerts.find(function(a){ return a.id_murid === idMurid && a.id_halaqah === idHalaqah; });
  }

  if (!alertItem) {
    toast('Data murid tidak ditemukan.', 'err');
    return;
  }

  // Cek nomor HP
  var raw = String(alertItem.no_hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) {
    toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn');
    return;
  }

  // Optimistic UI: langsung ubah tampilan tombol sebelum API selesai
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = '⏳...';
    btnEl.style.opacity = '.6';
  }

  try {
    // 1. Update status di DB dan Akun Murid
    await window.HQ.GuruAPI.simpanFollowupKeaktifan({
      id_murid  : idMurid,
      id_halaqah: idHalaqah,
      tipe_alert: tipeAlert,
      value     : value
    });

    // Simpan ke set agar tidak muncul lagi setelah re-render
    _keaktifanContacted.add(idMurid + '_' + idHalaqah + '_' + tipeAlert);

    // Update flags di data lokal agar filter tidak perlu reload
    if (alertItem.flags) {
      alertItem.flags = alertItem.flags.filter(function(f){ return f.tipe !== tipeAlert; });
    }

    // Ganti baris flag menjadi "Sudah Dihubungi" tanpa reload penuh
    var flagRow = btnEl && btnEl.closest('[data-flag-row]');
    if (flagRow) {
      flagRow.style.transition = 'all .3s';
      flagRow.style.background = 'var(--green-l)';
      flagRow.innerHTML = '<span style="font-size:12px;font-weight:700;color:var(--green)">✅ Sudah dihubungi — ' + tipeAlert + '</span>';
      setTimeout(function() {
        var card = flagRow.closest('[data-murid-id="' + idMurid + '"]');
        var remaining = card && card.querySelectorAll('[data-flag-row]');
        if (remaining && remaining.length === 0) {
          // Semua flag sudah di-handle — tampilkan pesan selesai
          var flagsArea = card && card.querySelector('[data-flags-area]');
          if (flagsArea) flagsArea.innerHTML = '<div style="background:var(--green-l);color:var(--green);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;text-align:center;margin:4px 0">✅ Semua tindak lanjut selesai</div>';
        }
      }, 400);
    }

    toast('✅ Tercatat — murid sudah ditindaklanjuti', 'ok');

    // 2. Langsung arahkan ke WhatsApp murid lengkap dengan pesannya
    if (raw.startsWith('0')) raw = '62' + raw.slice(1);
    else if (!raw.startsWith('62')) raw = '62' + raw;

    var msg  = buildWAMessageKeaktifan(alertItem);
    var url  = 'https://wa.me/' + raw + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');

  } catch(e) {
    // Revert UI jika gagal
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Tabayyun/tindak Lanjuti'; btnEl.style.opacity = '1'; }
    toast(friendlyError(e), 'err');
  }
}

function showKeaktifanDetailModal(idx) {
  var m = window.HQ.AppState._keaktifanData && window.HQ.AppState._keaktifanData.alerts && window.HQ.AppState._keaktifanData.alerts[idx];
  if (!m) return;
  
  var modalId = 'modalDetailKeaktifan';
  var modalEl = document.getElementById(modalId);
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.className = 'overlay';
    document.body.appendChild(modalEl);
  }

  var riwayatRows = (m.riwayat || []).map(function(s, i) {
    var statusText = 'Hadir';
    var statusStyle = 'color:var(--green-txt); font-weight:700;';
    if (s.status_hadir === 'A') {
      statusText = 'Absen/Alpa';
      statusStyle = 'color:var(--red-txt); font-weight:700;';
    } else if (s.status_hadir === 'T') {
      statusText = 'Terlambat';
      statusStyle = 'color:var(--amber-txt); font-weight:700;';
    }
    
    var cameraText = s.kamera_murid || 'kamera terbuka';
    var cameraStyle = 'color:var(--green-txt);';
    if (cameraText.indexOf('tertutup') !== -1) {
      cameraStyle = 'color:var(--amber-txt); font-weight:600;';
    }

    return '<tr>'
      + '<td style="padding:10px; border-bottom:1px solid var(--border); text-align:center;">' + (i + 1) + '</td>'
      + '<td style="padding:10px; border-bottom:1px solid var(--border); text-align:center; font-weight:600;">' + s.tanggal + '</td>'
      + '<td style="padding:10px; border-bottom:1px solid var(--border); ' + statusStyle + '">' + statusText + '</td>'
      + '<td style="padding:10px; border-bottom:1px solid var(--border); ' + cameraStyle + '">' + cameraText + '</td>'
      + '</tr>';
  }).join('');

  if (!riwayatRows) {
    riwayatRows = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-3);">Belum ada riwayat sesi tercatat.</td></tr>';
  }

  modalEl.innerHTML = '<div class="modal" style="max-width:600px; width:95%;">'
    + '<div class="modal-head">'
    + '<div class="modal-title">Riwayat Sesi ' + esc(m.nama_murid) + '</div>'
    + '<button class="modal-x" onclick="closeModal(\'' + modalId + '\')">×</button>'
    + '</div>'
    + '<div class="modal-body" style="padding:16px; max-height:70vh; overflow-y:auto;">'
    + '<div style="margin-bottom:14px; font-size:13px; color:var(--text-2);">'
    + 'Halaqah: <strong>' + esc(m.nama_halaqah) + '</strong> | Level: <strong>' + esc(m.level) + '</strong>'
    + '</div>'
    + '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">'
    + '<thead>'
    + '<tr style="background:var(--bg);">'
    + '<th style="padding:10px; border-bottom:2px solid var(--border); text-align:center; width:10%;">No</th>'
    + '<th style="padding:10px; border-bottom:2px solid var(--border); text-align:center; width:30%;">Tanggal</th>'
    + '<th style="padding:10px; border-bottom:2px solid var(--border); width:30%;">Kehadiran</th>'
    + '<th style="padding:10px; border-bottom:2px solid var(--border); width:30%;">Kamera</th>'
    + '</tr>'
    + '</thead>'
    + '<tbody>' + riwayatRows + '</tbody>'
    + '</table>'
    + '</div>'
    + '</div>';

  openModal(modalId);
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function updateIcon(isDark) {
    btn.innerHTML = isDark ? 
      '<svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>' : 
      '<svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }
  let isDark = document.documentElement.classList.contains('theme-dark');
  updateIcon(isDark);
  btn.addEventListener('click', function() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('theme-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
      localStorage.setItem('theme', 'light');
    }
    updateIcon(isDark);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
      if (e.matches) {
        document.documentElement.classList.add('theme-dark');
        updateIcon(true);
      } else {
        document.documentElement.classList.remove('theme-dark');
        updateIcon(false);
      }
    }
  });
}
initThemeToggle();

// ── Panduan functions ──────────────────────────
function pdToggle(btn) {
  var body = btn.nextElementSibling;
  var open = btn.classList.toggle('open');
  body.classList.toggle('open', open);
}
function pdToggleNasihat() {
  var body = document.getElementById('pdNasihatBody');
  var label = document.getElementById('pdNasLabel');
  var chev  = document.getElementById('pdNasChevron');
  var hide  = body.style.display !== 'none';
  body.style.display = hide ? 'none' : 'block';
  label.textContent  = hide ? 'Tampilkan Nasihat' : 'Sembunyikan';
  chev.style.transform = hide ? 'rotate(180deg)' : '';
}

if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('../sw.js').catch(()=>{});

// Tangkap event beforeinstallprompt (Chrome/Android)
var _pwaInstallEvent = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _pwaInstallEvent = e;
  var btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.classList.remove('hidden');
});

// Setelah install berhasil
window.addEventListener('appinstalled', function() {
  _pwaInstallEvent = null;
  var btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.classList.add('hidden');
  if (typeof toast === 'function') toast('Aplikasi berhasil diinstall! 🎉', 'ok');
  closeModal('pwaModal');
});

function triggerPwaInstall() {
  if (!_pwaInstallEvent) return;
  _pwaInstallEvent.prompt();
  _pwaInstallEvent.userChoice.then(function(r) {
    if (r.outcome === 'accepted') { _pwaInstallEvent = null; }
  });
}

function setPwaTab(os, btn) {
  document.querySelectorAll('.pwa-os-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.pwa-os-panel').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  var panel = document.getElementById('pwa' + (os === 'ios' ? 'Ios' : 'Android') + 'Panel');
  if (panel) panel.classList.add('active');
}

// Auto-detect OS untuk buka tab yang sesuai
(function() {
  var isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent);
  document.addEventListener('DOMContentLoaded', function() {
    if (!isIOS) {
      var tabs = document.querySelectorAll('.pwa-os-tab');
      if (tabs.length >= 2) setPwaTab('android', tabs[1]);
    }
  });
}());

// Offline indicator listeners
window.addEventListener('online', function() {
  var banner = document.getElementById('offlineBanner');
  if (banner) banner.classList.remove('show');
  if (typeof toast === 'function') toast('Koneksi terhubung kembali. Menyelaraskan data...', 'ok');
});
window.addEventListener('offline', function() {
  var banner = document.getElementById('offlineBanner');
  if (banner) banner.classList.add('show');
  if (typeof toast === 'function') toast('Koneksi internet terputus. Anda bekerja secara offline.', 'warn');
});
// Check initial online status
if (!navigator.onLine) {
  window.addEventListener('DOMContentLoaded', function() {
    var banner = document.getElementById('offlineBanner');
    if (banner) banner.classList.add('show');
  });
}

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() { if (typeof initPushPrompt === 'function') initPushPrompt('guru'); }, 5000);
});

// ══════════════════════════════════════════════════════════════
//  AT-TIBYAN GURU
// ══════════════════════════════════════════════════════════════
var _atMuridAll      = [];   // semua murid aktif (loaded once)
var _atSesiData      = [];   // riwayat sesi
var _atKeaktifanData = null;
var _atEditId        = null; // id_sesi saat mode edit
var _atNextPertemuan = 1;    // pertemuan_ke berikutnya
var _atCurrentTab   = 'sesi';
var _atTabLoaded    = {};

function switchAtTab(tab, btn) {
  _atCurrentTab = tab;
  document.querySelectorAll('.at-tab-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.getElementById('atPanelSesi').style.display      = tab === 'sesi'      ? '' : 'none';
  document.getElementById('atPanelKeaktifan').style.display = tab === 'keaktifan' ? '' : 'none';
  document.getElementById('atPanelRekap').style.display     = tab === 'rekap'     ? '' : 'none';
  if (!_atTabLoaded[tab]) {
    _atTabLoaded[tab] = true;
    if (tab === 'sesi')      loadAtSesi();
    if (tab === 'keaktifan') loadAtKeaktifan();
    if (tab === 'rekap')     loadAtRekap();
  }
}

async function loadAtTibyanGuru() {
  // Load riwayat sesi (tab pertama)
  if (!_atTabLoaded['sesi']) { _atTabLoaded['sesi'] = true; await loadAtSesi(); }
  // Populate halaqah filter di rekap
  _populateAtHalaqahFilter();
}

function _populateAtHalaqahFilter() {
  var sel = document.getElementById('atRekapHalaqah');
  if (!sel || !window.HQ.AppState.halaqahList.length) return;
  sel.innerHTML = '<option value="">— Semua Halaqah —</option>'
    + window.HQ.AppState.halaqahList.map(function(h){ return '<option value="'+esc(h.id_halaqah)+'">'+esc(h.nama_halaqah)+'</option>'; }).join('');
}

async function loadAtSesi() {
  var el = document.getElementById('atSesiList');
  el.innerHTML = Array(3).fill('<div class="skel skel-card" style="height:64px;border-radius:12px;margin-bottom:10px"></div>').join('');
  try {
    var r = await window.HQ.GuruAPI.getAtTibyanSesi();
    _atSesiData = r.data || [];
    renderAtSesi();
  } catch(e) { el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">❌</div><div class="guru-empty-ttl">'+esc(friendlyError(e))+'</div></div>'; }
}

function renderAtSesi() {
  var el = document.getElementById('atSesiList');
  if (!_atSesiData.length) {
    el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">📖</div><div class="guru-empty-ttl">Belum ada sesi At-Tibyan</div><div class="guru-empty-sub">Tekan tombol di atas untuk mulai sesi pertama.</div></div>';
    return;
  }
  el.innerHTML = '<div class="card"><div style="padding:8px 16px">'
    + _atSesiData.map(function(s) {
      var pct = s.total_murid > 0 ? Math.round(s.total_hadir / s.total_murid * 100) : 0;
      var col = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
      return '<div class="at-sesi-row" onclick="lihatDetailAtSesi(\''+esc(s.id_sesi)+'\',\''+esc(s.pertemuan_ke)+'\')">'
        + '<div class="at-sesi-badge">📅</div>'
        + '<div class="at-sesi-info">'
        + '<div class="at-sesi-title">Kajian At-Tibyan</div>'
        + '<div class="at-sesi-meta">📅 '+fmtDate(s.tanggal)+' (Sesi '+esc(s.pertemuan_ke)+')</div>'
        + '</div>'
        + '<div style="text-align:right">'
        + '<div class="at-sesi-stat" style="color:'+col+'">'+s.total_hadir+'/'+s.total_murid+'</div>'
        + '<div style="font-size:10.5px;color:var(--text-3);font-weight:600">'+pct+'% hadir</div>'
        + '</div>'
        + '<button class="btn btn-outline btn-sm" style="margin-left:8px;padding:5px 10px" onclick="event.stopPropagation();editAtSesi(\''+esc(s.id_sesi)+'\',\''+esc(s.tanggal)+'\',\''+esc(s.pertemuan_ke)+'\')">✏️</button>'
        + '</div>';
    }).join('') + '</div></div>';
}

async function loadAtKeaktifan() {
  var el = document.getElementById('atKeaktifanGrid');
  el.innerHTML = Array(4).fill('<div class="skel skel-card" style="height:100px;border-radius:16px;margin-bottom:10px"></div>').join('');
  try {
    var r = await window.HQ.GuruAPI.getAtTibyanKeaktifan();
    _atKeaktifanData = r.data;
    document.getElementById('atKritisCount').textContent    = r.data.summary.kritis;
    document.getElementById('atPeringatanCount').textContent= r.data.summary.peringatan;
    document.getElementById('atNormalCount').textContent    = r.data.summary.normal;
    filterAtKeaktifan();
  } catch(e) { el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">❌</div><div class="guru-empty-ttl">'+esc(friendlyError(e))+'</div></div>'; }
}

function getFilteredAtKeaktifanList() {
  var list = (_atKeaktifanData && _atKeaktifanData.alerts) || [];
  var q = (document.getElementById('atKeaktifanSearch') && document.getElementById('atKeaktifanSearch').value || '').toLowerCase().trim();
  var statusFilter = (document.getElementById('atKeaktifanStatusFilter') && document.getElementById('atKeaktifanStatusFilter').value || '');
  return list.filter(function(m) {
    var matchesSearch = !q || (m.nama_murid || '').toLowerCase().indexOf(q) !== -1;
    var matchesStatus = !statusFilter || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
}

function filterAtKeaktifan() {
  var el = document.getElementById('atKeaktifanGrid');
  if (!_atKeaktifanData) return;
  var list = getFilteredAtKeaktifanList();
  if (!list.length) {
    el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">🌟</div>'
      + '<div class="guru-empty-ttl">Tidak ada data murid yang cocok</div></div>';
    return;
  }
  el.innerHTML = list.map(function(m, idx) {
    var borderColor = m.status === 'kritis' ? 'var(--red)' : m.status === 'peringatan' ? 'var(--amber)' : 'var(--green)';
    var badge = m.status === 'kritis' ? '<span class="badge b-red">Kritis 🔴</span>'
      : m.status === 'peringatan' ? '<span class="badge b-amber">Peringatan 🟡</span>'
      : '<span class="badge b-green">Normal 🟢</span>';
    var dots = (m.riwayat || []).map(function(r) {
      var dotCls = r.warna === 'hijau' ? 'hadir' : r.warna === 'abu' ? 'izin' : 'absen';
      return '<div class="at-dot '+dotCls+'" title="'+esc(fmtDate(r.tanggal))+'"></div>';
    }).join('');

    // Tombol WA hanya untuk kritis & peringatan
    var waBtn = '';
    if (m.status === 'kritis' || m.status === 'peringatan') {
      var hasHp = m.no_hp && String(m.no_hp).replace(/\D/g,'').length >= 9;
      waBtn = '<button onclick="openWAAtTibyan('+idx+')" title="'+(hasHp ? 'Hubungi via WhatsApp' : 'No HP tidak tersedia')+'" style="'
        + 'background:'+(hasHp ? 'linear-gradient(135deg,#25D366,#128C7E)' : 'rgba(0,0,0,0.08)')+';'
        + 'color:'+(hasHp ? '#fff' : 'var(--text-3)')+';'
        + 'border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;'
        + 'display:flex;align-items:center;gap:5px;white-space:nowrap;margin-top:10px;width:100%;justify-content:center">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.091.535 4.057 1.475 5.77L.057 23.784l6.162-1.396A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.797a9.8 9.8 0 01-4.988-1.361l-.36-.213-3.654.828.844-3.549-.235-.375A9.789 9.789 0 012.203 12C2.203 6.583 6.583 2.203 12 2.203S21.797 6.583 21.797 12 17.417 21.797 12 21.797z"/></svg>'
        + (hasHp ? 'Ingatkan via WhatsApp' : 'No HP Tidak Tersedia')
        + '</button>';
    }

    return '<div class="at-keaktifan-card '+m.status+'">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      + '<div><div style="font-size:14px;font-weight:800;color:var(--text)">'+esc(m.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3);font-weight:600;margin-top:2px">'+esc(m.nama_halaqah)+' · '+esc(m.level)+'</div></div>'
      + badge + '</div>'
      + '<div style="font-size:12px;color:var(--text-2);font-weight:600;margin-top:8px">Hadir '+m.hadir+' dari '+m.total_sesi+' sesi ('+m.pct_hadir+'%) · Absen '+m.absen+'×</div>'
      + '<div class="at-dots">'+dots+'</div>'
      + waBtn
      + '</div>';
  }).join('');
}

async function loadAtRekap() {
  var el = document.getElementById('atRekapContent');
  var id_h = document.getElementById('atRekapHalaqah').value;
  el.innerHTML = Array(4).fill('<div class="skel skel-row" style="height:48px;border-radius:8px;margin-bottom:8px"></div>').join('');
  try {
    var r = await window.HQ.GuruAPI.getAtTibyanRekap(id_h || null);
    var rows     = r.data     || [];
    var totalSesi= r.total_sesi || 0;
    var sum      = r.summary  || {};
    if (!rows.length) {
      el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">📊</div><div class="guru-empty-ttl">Belum ada data rekap</div></div>';
      return;
    }

    // Summary keseluruhan halaqah
    var pct = sum.pct_keseluruhan || 0;
    var pctCol = pct >= 80 ? 'var(--green-txt)' : pct >= 60 ? 'var(--amber-txt)' : 'var(--red-txt)';
    var pctBg = pct >= 80 ? 'var(--green-bg)' : pct >= 60 ? 'var(--amber-bg)' : 'var(--red-bg)';
    var pctBorder = pct >= 80 ? 'rgba(52,211,153,.25)' : pct >= 60 ? 'rgba(251,191,36,.25)' : 'rgba(248,113,113,.25)';

    var summaryHtml = '<div style="background:'+pctBg+';border:1px solid '+pctBorder+';border-radius:16px;padding:14px 16px;margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Ringkasan Keseluruhan · '+totalSesi+' sesi · '+sum.total_murid+' murid</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">'
      + '<div><div style="font-size:28px;font-weight:900;color:'+pctCol+'">'+pct+'%</div><div style="font-size:10.5px;font-weight:700;color:var(--text-3)">Kehadiran</div></div>'
      + '<div><div style="font-size:28px;font-weight:900;color:#10b981">'+sum.total_hadir+'</div><div style="font-size:10.5px;font-weight:700;color:var(--text-3)">Total Hadir</div></div>'
      + '<div><div style="font-size:28px;font-weight:900;color:#ef4444">'+(sum.total_absen||0)+'</div><div style="font-size:10.5px;font-weight:700;color:var(--text-3)">Total Alpa</div></div>'
      + '</div></div>';

    el.innerHTML = summaryHtml
      + '<div class="card"><div style="padding:8px 16px">'
      + rows.map(function(m) {
        var col = m.pct_hadir >= 80 ? '#10b981' : m.pct_hadir >= 60 ? '#f59e0b' : '#ef4444';
        return '<div class="at-rekap-row">'
          + '<div style="flex:1"><div class="at-rekap-name">'+esc(m.nama_murid)+'</div>'
          + '<div class="at-rekap-meta">'+esc(m.nama_halaqah)+' · '+esc(m.level)+'</div>'
          + '<div class="at-rekap-bar"><div class="at-rekap-fill" style="width:'+m.pct_hadir+'%;background:'+col+'"></div></div></div>'
          + '<div style="text-align:right"><div class="at-rekap-pct" style="color:'+col+'">'+m.pct_hadir+'%</div>'
          + '<div style="font-size:10.5px;color:var(--text-3);font-weight:600">'+m.hadir+'/'+totalSesi+' · alpa '+m.absen+'×</div></div>'
          + '</div>';
      }).join('') + '</div></div>';
  } catch(e) { el.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">❌</div><div class="guru-empty-ttl">'+esc(friendlyError(e))+'</div></div>'; }
}

async function lihatDetailAtSesi(id_sesi, pertemuan_ke) {
  toast('Memuat detail...','info');
  try {
    var r = await window.HQ.GuruAPI.getAtTibyanDetail(id_sesi);
    // getAtTibyanDetail mengembalikan {sesi, presensi} — ambil presensi
    var rows = (r.data && r.data.presensi) || [];
    var total = rows.length;
    var hadir = rows.filter(function(x){ return ['H','T'].includes(String(x.status_hadir).toUpperCase()); }).length;
    var alpa  = rows.filter(function(x){ return String(x.status_hadir).toUpperCase() === 'A'; }).length;

    var LABEL = {H:'Hadir',T:'Terlambat',I:'Izin',A:'Alpa'};
    var BADGE  = {H:'b-green',T:'b-purple',I:'b-amber',A:'b-red'};
    var groups = {};
    rows.forEach(function(m) {
      var key = (m.nama_halaqah||'-');
      if (!groups[key]) groups[key] = { halaqah: m.nama_halaqah, murid: [] };
      groups[key].murid.push(m);
    });
    var tgl = (r.data && r.data.sesi && r.data.sesi.tanggal) ? fmtDate(r.data.sesi.tanggal) : '';
    var html = '<div style="font-size:13px;font-weight:700;margin-bottom:10px">' + (tgl ? tgl + ' (Sesi ' + pertemuan_ke + ') — ' : '') + hadir+'/'+total+' hadir · alpa '+alpa+'×</div>'
      + Object.values(groups).map(function(g) {
        return '<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">'+esc(g.halaqah||'-')+'</div>'
          + g.murid.map(function(m) {
            var sh = String(m.status_hadir||'').toUpperCase();
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">'
              + '<span style="font-size:13px;font-weight:600">'+esc(m.nama_murid)+'</span>'
              + '<span class="badge '+(BADGE[sh]||'b-gray')+'">'+( LABEL[sh]||sh)+'</span></div>';
          }).join('') + '</div>';
      }).join('');

    // Tampilkan dalam notif overlay yang sudah ada
    var notifTitle = document.getElementById('notifTitle');
    var notifMsg   = document.getElementById('notifMsg');
    var notifIcon  = document.getElementById('notifIcon');
    var notifOverlay = document.getElementById('notifOverlay');
    if (notifTitle && notifMsg && notifOverlay) {
      if (notifIcon) notifIcon.textContent = '📋';
      notifTitle.textContent = 'Kajian At-Tibyan';
      notifMsg.innerHTML = html;
      notifOverlay.classList.add('show');
    } else {
      toast((tgl ? tgl + ' (Sesi ' + pertemuan_ke + '): ' : '') + hadir+'/'+total+' hadir.','info');
    }
  } catch(e) { toast(friendlyError(e),'err'); }
}

// ── WhatsApp At-Tibyan ──────────────────────────
function buildWAMessageAtTibyan(m) {
  var nama   = m.nama_murid  || 'Peserta';
  var hal    = m.nama_halaqah || '';
  var levelText = m.level ? (String(m.level).toLowerCase().indexOf('level') !== -1 ? m.level : 'Level ' + m.level) : '';
  var absen  = m.absen  || 0;
  var hadir  = m.hadir  || 0;
  var total  = m.total_sesi || 0;
  var pct    = m.pct_hadir  || 0;
  var statusIkon = m.status === 'kritis' ? '🔴 *Kritis*' : '🟡 *Perlu Diperhatikan*';

  return 'Assalamu\'alaikum warahmatullahi wabarakatuh 🌙 \n'
    + 'semoga Allah senantiasa menjaga kita semua\n\n'
    + 'izinkan Kami ingin menyampaikan laporan keaktifan Kajian At-Tibyan Rattililquran:\n\n\n'
    + '👤 *' + nama + '*\n'
    + '📚 Halaqah: ' + hal + (levelText ? ' · ' + levelText : '') + '\n'
    + '⚡ Status: ' + statusIkon + '\n\n'
    + '📊 *Rekap Kehadiran At-Tibyan:*\n'
    + '  • Hadir        : *' + hadir + ' dari ' + total + ' sesi*\n'
    + '  • Absen (Alpa) : *' + absen + ' sesi*\n'
    + '  • % Kehadiran  : *' + pct + '%*\n\n'
    + 'At-Tibyan adalah kajian mingguan yang penting untuk perkembangan ilmu. Kehadiran yang konsisten sangat berpengaruh pada penilaian dan pemahaman ke depannya.\n\n'
    + 'Kami berharap kehadiran dapat segera meningkat. Berikut yang dapat dilakukan:\n'
    + '  ✅ Hadir di setiap sesi At-Tibyan yang diadakan setiap Ahad malam jam 19.30 InsyaAllah\n'
    + '  ✅ Kabari guru jika ada kendala yang membuat sulit hadir\n\n\n'
    + 'Kami terbuka untuk berdiskusi jika ada hal yang ingin disampaikan. Jangan ragu untuk menyampaikannya.\n\n'
    + 'Jazakumullahu khairan. 🙏\n'
    + '_Rattil Al-Qur\'an_';
}

function openWAAtTibyan(idx) {
  var filtered = getFilteredAtKeaktifanList();
  var m = filtered[idx];
  if (!m) return;

  var raw = String(m.no_hp || '').replace(/[^0-9]/g, '');
  if (!raw || raw.length < 9) {
    toast('Nomor HP murid ini belum tersedia di data pengguna.', 'warn');
    return;
  }
  if (raw.startsWith('0')) raw = '62' + raw.slice(1);
  else if (!raw.startsWith('62')) raw = '62' + raw;

  var msg = buildWAMessageAtTibyan(m);
  window.open('https://wa.me/' + raw + '?text=' + encodeURIComponent(msg), '_blank');
}

// ── Form At-Tibyan ──────────────────────────────
// Materi At-Tibyan — diisi dari Supabase saat page load
var AT_TIBYAN_MATERI = [];

async function _loadAtMateriFromDB() {
  try {
    var r = await window.HQ.GuruAPI.getAtTibyanMateriForForm();
    if (r && r.data && r.data.length) AT_TIBYAN_MATERI = r.data;
  } catch(e) { /* gunakan data kosong */ }
}

function _showAtMateriInfo(pertemuan_ke) {
  var box = document.getElementById('atFormMateriBox');
  if (box) box.style.display = 'none';
}

async function bukaFormAtTibyan() {
  _atEditId = null;
  var sf = document.getElementById('atFormSearch'); if (sf) sf.value = '';
  var hf = document.getElementById('atFormHalaqahFilter'); if (hf) hf.value = '';
  // Pastikan _atSesiData sudah terisi sebelum hitung pertemuan_ke
  if (!_atTabLoaded['sesi']) {
    try { var r = await window.HQ.GuruAPI.getAtTibyanSesi(); _atSesiData = r.data || []; _atTabLoaded['sesi'] = true; } catch(e){}
  }
  _atNextPertemuan = _atSesiData.length > 0
    ? Math.max.apply(null, _atSesiData.map(function(s){ return s.pertemuan_ke || 0; })) + 1
    : 1;
  document.getElementById('atFormTitle').textContent = 'Presensi At-Tibyan Baru (Sesi ' + _atNextPertemuan + ')';
  document.getElementById('atFormTanggal').value = new Date().toISOString().substring(0,10);
  document.getElementById('atFormPertemuanInfo').textContent = 'Pertemuan ke-' + _atNextPertemuan;
  _showAtMateriInfo(_atNextPertemuan);
  await _loadAtFormMurid();
  document.getElementById('atFormOverlay').style.display = 'flex';
}

async function editAtSesi(id_sesi, tanggal, pertemuan_ke) {
  _atEditId = id_sesi;
  document.getElementById('atFormTitle').textContent = 'Edit Presensi At-Tibyan (Sesi ' + pertemuan_ke + ')';
  document.getElementById('atFormTanggal').value = String(tanggal).substring(0,10);
  document.getElementById('atFormPertemuanInfo').textContent = 'Pertemuan ke-' + pertemuan_ke;
  var sf = document.getElementById('atFormSearch'); if (sf) sf.value = '';
  var hf = document.getElementById('atFormHalaqahFilter'); if (hf) hf.value = '';
  _showAtMateriInfo(pertemuan_ke);
  await _loadAtFormMurid(id_sesi);
  document.getElementById('atFormOverlay').style.display = 'flex';
}

async function _loadAtFormMurid(id_sesi_edit) {
  var listEl = document.getElementById('atFormList');
  listEl.innerHTML = Array(4).fill('<div class="skel skel-card" style="height:52px;border-radius:10px;margin-bottom:8px"></div>').join('');
  try {
    // Load semua murid jika belum ada
    if (!_atMuridAll.length) {
      var r = await window.HQ.GuruAPI.getAllMuridAktif();
      _atMuridAll = r.data || [];
    }
    // Jika mode edit, ambil status hadir existing
    var existingMap = {};
    if (id_sesi_edit) {
      var rd = await window.HQ.GuruAPI.getAtTibyanDetail(id_sesi_edit);
      // getAtTibyanDetail mengembalikan {sesi, presensi}
      ((rd.data && rd.data.presensi) || []).forEach(function(m) { existingMap[m.id_murid] = String(m.status_hadir).toUpperCase(); });
    }
    // Default semua H
    _atMuridAll.forEach(function(m) {
      if (!existingMap[m.id_murid]) existingMap[m.id_murid] = 'H';
    });
    window._atPresensiMap = existingMap;
    _populateAtFormHalaqahFilter();
    renderAtFormList(_atMuridAll);
  } catch(e) { listEl.innerHTML = '<div class="guru-empty"><div class="guru-empty-ico">❌</div><div class="guru-empty-ttl">'+esc(friendlyError(e))+'</div></div>'; }
}

function _populateAtFormHalaqahFilter() {
  var sel = document.getElementById('atFormHalaqahFilter');
  if (!sel) return;
  var halaqahs = {};
  _atMuridAll.forEach(function(m) {
    var id_h = m.id_halaqah;
    var nama_h = (m.halaqah && m.halaqah.nama_halaqah) || m.nama_halaqah || '-';
    if (id_h) {
      halaqahs[id_h] = nama_h;
    }
  });
  var options = '<option value="">— Semua Halaqah —</option>';
  Object.keys(halaqahs).forEach(function(id_h) {
    options += '<option value="' + esc(id_h) + '">' + esc(halaqahs[id_h]) + '</option>';
  });
  sel.innerHTML = options;
  sel.value = '';
}

function renderAtFormList(murid) {
  var listEl = document.getElementById('atFormList');
  // Kelompokkan level → halaqah
  var groups = {};
  murid.forEach(function(m) {
    // getAllMuridAktif pakai join halaqah(nama_halaqah) → nested object
    var namaHalaqah = (m.halaqah && m.halaqah.nama_halaqah) || m.nama_halaqah || '-';
    var key = (m.level||'-')+'||'+namaHalaqah;
    if (!groups[key]) groups[key] = {level:m.level, halaqah:namaHalaqah, murid:[]};
    groups[key].murid.push(m);
  });
  var STATUS = ['H','T','I','A'];
  listEl.innerHTML = Object.values(groups).map(function(g) {
    return '<div class="at-halaqah-group">'
      + '<div class="at-halaqah-head">'
      + '<span>' + esc(g.level) + ' — ' + esc(g.halaqah) + '</span>'
      + '<div style="margin-left:auto;display:flex;gap:4px">'
      + '<button type="button" style="padding:3px 8px;font-size:10.5px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-2);font-weight:700;cursor:pointer" onclick="setGroupPresensi(this,\'H\')">✔️ Hadir</button>'
      + '<button type="button" style="padding:3px 8px;font-size:10.5px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-2);font-weight:700;cursor:pointer" onclick="setGroupPresensi(this,\'A\')">❌ Alpa</button>'
      + '</div>'
      + '</div>'
      + g.murid.map(function(m) {
        var cur = (window._atPresensiMap && window._atPresensiMap[m.id_murid]) || 'H';
        var btns = STATUS.map(function(s) {
          return '<button class="at-pb'+(cur===s?' on-'+s:'')+'" data-id="'+esc(m.id_murid)+'" data-s="'+s+'" onclick="setAtStatus(this,\''+esc(m.id_murid)+'\',\''+s+'\')">'+s+'</button>';
        }).join('');
        return '<div class="at-murid-row" data-name="'+esc((m.nama_murid||'').toLowerCase())+'" data-halaqah-id="'+esc(m.id_halaqah)+'">'
          +'<div><div class="at-murid-name">'+esc(m.nama_murid)+'</div>'
          +'<div class="at-murid-level">'+esc((m.halaqah&&m.halaqah.nama_halaqah)||m.nama_halaqah||'')+'</div></div>'
          +'<div style="display:flex;gap:4px;margin-left:auto;flex-shrink:0">'+btns+'</div>'
          +'</div>';
      }).join('') + '</div>';
  }).join('');
  _updateAtFormCount();
}

function setAtStatus(btn, id_murid, status) {
  if (!window._atPresensiMap) window._atPresensiMap = {};
  window._atPresensiMap[id_murid] = status;
  // Update semua tombol di baris ini
  document.querySelectorAll('[data-id="'+id_murid+'"]').forEach(function(b) {
    b.className = 'at-pb' + (b.dataset.s === status ? ' on-'+status : '');
  });
  _updateAtFormCount();
}

function setAllAtPresensi(status) {
  if (!window._atPresensiMap) window._atPresensiMap = {};
  var visibleRows = Array.from(document.querySelectorAll('#atFormList .at-murid-row')).filter(function(row) {
    return row.style.display !== 'none';
  });
  visibleRows.forEach(function(row) {
    var pbBtn = row.querySelector('.at-pb');
    if (pbBtn) {
      var id_murid = pbBtn.dataset.id;
      window._atPresensiMap[id_murid] = status;
      document.querySelectorAll('[data-id="'+id_murid+'"]').forEach(function(b) {
        b.className = 'at-pb' + (b.dataset.s === status ? ' on-'+status : '');
      });
    }
  });
  _updateAtFormCount();
}

function setGroupPresensi(btn, status) {
  if (!window._atPresensiMap) window._atPresensiMap = {};
  var groupEl = btn.closest('.at-halaqah-group');
  if (!groupEl) return;
  var visibleRows = Array.from(groupEl.querySelectorAll('.at-murid-row')).filter(function(row) {
    return row.style.display !== 'none';
  });
  visibleRows.forEach(function(row) {
    var pbBtn = row.querySelector('.at-pb');
    if (pbBtn) {
      var id_murid = pbBtn.dataset.id;
      window._atPresensiMap[id_murid] = status;
      document.querySelectorAll('[data-id="'+id_murid+'"]').forEach(function(b) {
        b.className = 'at-pb' + (b.dataset.s === status ? ' on-'+status : '');
      });
    }
  });
  _updateAtFormCount();
}

function applyAtFormFilters() {
  var searchVal = (document.getElementById('atFormSearch').value || '').toLowerCase().trim();
  var halFilter = document.getElementById('atFormHalaqahFilter').value; // id_halaqah

  document.querySelectorAll('#atFormList .at-halaqah-group').forEach(function(groupEl) {
    var visibleCount = 0;
    groupEl.querySelectorAll('.at-murid-row').forEach(function(row) {
      var rowName = (row.dataset.name || '');
      var rowHalaqahId = row.dataset.halaqahId;
      var matchesSearch = !searchVal || rowName.indexOf(searchVal) !== -1;
      var matchesHalaqah = !halFilter || rowHalaqahId === halFilter;

      if (matchesSearch && matchesHalaqah) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    if (visibleCount > 0) {
      groupEl.style.display = '';
    } else {
      groupEl.style.display = 'none';
    }
  });
}

function _updateAtFormCount() {
  var map = window._atPresensiMap || {};
  var hadir = Object.values(map).filter(function(s){ return ['H','T'].includes(s); }).length;
  var total = _atMuridAll.length;
  var el = document.getElementById('atFormCount');
  if (el) el.textContent = hadir + '/' + total + ' hadir';
}

function tutupFormAtTibyan() {
  document.getElementById('atFormOverlay').style.display = 'none';
  _atEditId = null;
  var sf = document.getElementById('atFormSearch'); if (sf) sf.value = '';
  var hf = document.getElementById('atFormHalaqahFilter'); if (hf) hf.value = '';
}

async function simpanAtTibyan() {
  var tanggal = document.getElementById('atFormTanggal').value;
  if (!tanggal) return toast('Tanggal wajib diisi','err');
  var map = window._atPresensiMap || {};
  var presensi = _atMuridAll.map(function(m) {
    return {
      id_murid    : m.id_murid,
      nama_murid  : m.nama_murid  || '',
      id_halaqah  : m.id_halaqah,
      nama_halaqah: (m.halaqah && m.halaqah.nama_halaqah) || '',
      status_hadir: map[m.id_murid] || 'H',
    };
  });
  var btn = document.getElementById('atFormSimpan');
  if (btn) { btn.disabled = true; btn.classList.add('btn-loading'); }
  try {
    if (_atEditId) {
      await window.HQ.GuruAPI.editAtTibyan({ id_sesi: _atEditId, presensi });
      toast('Presensi berhasil diperbarui ✅','ok');
    } else {
      await window.HQ.GuruAPI.simpanAtTibyan({ tanggal, presensi, pertemuan_ke: _atNextPertemuan });
      toast('Sesi At-Tibyan berhasil disimpan ✅','ok');
    }
    tutupFormAtTibyan();
    // Refresh data
    _atTabLoaded = {};
    _atSesiData = [];
    _atKeaktifanData = null;
    _atTabLoaded['sesi'] = true;
    await loadAtSesi();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally {
    if (btn) { btn.disabled = false; btn.classList.remove('btn-loading'); }
  }
}



  // ── EXPOSE GLOBAL VARIABLES TO WINDOW (GETTERS/SETTERS) ──
  try { delete window._atMuridAll; Object.defineProperty(window, '_atMuridAll', { get: function() { return _atMuridAll; }, set: function(v) { _atMuridAll = v; }, configurable: true }); } catch(e) { window._atMuridAll = _atMuridAll; }
  try { delete window._atSesiData; Object.defineProperty(window, '_atSesiData', { get: function() { return _atSesiData; }, set: function(v) { _atSesiData = v; }, configurable: true }); } catch(e) { window._atSesiData = _atSesiData; }
  try { delete window._atKeaktifanData; Object.defineProperty(window, '_atKeaktifanData', { get: function() { return _atKeaktifanData; }, set: function(v) { _atKeaktifanData = v; }, configurable: true }); } catch(e) { window._atKeaktifanData = _atKeaktifanData; }
  try { delete window._atTabLoaded; Object.defineProperty(window, '_atTabLoaded', { get: function() { return _atTabLoaded; }, set: function(v) { _atTabLoaded = v; }, configurable: true }); } catch(e) { window._atTabLoaded = _atTabLoaded; }

  // ── EXPOSE PUBLIC INTERFACE TO WINDOW ──
  window.loadKeaktifanPage = loadKeaktifanPage;
  window.renderKeaktifanPage = renderKeaktifanPage;
  window.filterKeaktifanCards = filterKeaktifanCards;
  window.getFilteredAtKeaktifanList = getFilteredAtKeaktifanList;
  window.showKeaktifanDetailModal = showKeaktifanDetailModal;
  window.buildWAMessageKeaktifan = buildWAMessageKeaktifan;
  window.openWAKeaktifan = openWAKeaktifan;
  window._populateAtHalaqahFilter = _populateAtHalaqahFilter;
  window._populateAtFormHalaqahFilter = _populateAtFormHalaqahFilter;
  window.loadAtTibyanGuru = loadAtTibyanGuru;
  window.switchAtTab = switchAtTab;
  window.loadAtSesi = loadAtSesi;
  window.loadAtKeaktifan = loadAtKeaktifan;
  window.loadAtRekap = loadAtRekap;
  window.bukaFormAtTibyan = bukaFormAtTibyan;
  window._loadAtFormMurid = _loadAtFormMurid;
  window._loadAtMateriFromDB = _loadAtMateriFromDB;
  window._updateAtFormCount = _updateAtFormCount;
  window.tutupFormAtTibyan = tutupFormAtTibyan;
  window.simpanAtTibyan = simpanAtTibyan;
  window.buildWAMessageAtTibyan = buildWAMessageAtTibyan;
  window.openWAAtTibyan = openWAAtTibyan;
  window.setAllAtPresensi = setAllAtPresensi;
  window.setAtStatus = setAtStatus;
  window.applyAtFormFilters = applyAtFormFilters;
  window.filterAtKeaktifan = filterAtKeaktifan;
  window.renderAtSesi = renderAtSesi;
  window.renderAtFormList = renderAtFormList;
  window.doMarkContacted = doMarkContacted;
  window.openWAMurid = openWAMurid;
})();
