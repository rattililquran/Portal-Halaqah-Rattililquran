// ============================================================
//  Portal Admin — Laporan, Arsip Data, & Analytics Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Arsip Data & Executive Laporan/Analytics ---


// ══ ARSIP DATA ══════════════════════════════
var _arsipPeriodeList = [];

async function loadArsipPage() {
  // Isi dropdown semester
  var semSel = document.getElementById('arsipSemester');
  if (semSel && semSel.options.length <= 1) {
    var now = new Date();
    var y   = now.getFullYear();
    [y, y-1, y-2].forEach(function(yr) {
      ['S2','S1'].forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = yr + '-' + s;
        opt.textContent = (s==='S1' ? 'Semester 1 (Jan-Jun)' : 'Semester 2 (Jul-Des)') + ' ' + yr;
        semSel.appendChild(opt);
      });
    });
  }
  // Isi dropdown periode
  var perSel = document.getElementById('arsipPeriodeSelect');
  if (perSel && allPeriode && allPeriode.length && perSel.options.length <= 1) {
    allPeriode.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.id_periode;
      opt.textContent = p.nama_periode;
      perSel.appendChild(opt);
    });
  }
  await loadArsipList();
}

function updateArsipMode() {
  var mode = document.getElementById('arsipMode').value;
  var semWrap = document.getElementById('arsipSemesterWrap');
  var perWrap = document.getElementById('arsipPeriodeWrap');
  if (semWrap) semWrap.style.display = mode==='semester' ? 'block' : 'none';
  if (perWrap) perWrap.style.display = mode==='periode'  ? 'block' : 'none';
}

async function loadArsipList() {
  var tb = document.getElementById('arsipTbl');
  if (tb) tb.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center"><span class="skel skel-text" style="width:200px;margin:auto;display:block"></span></td></tr>';
  try {
    var r = await window.HQ.AdminAPI.getArsipList();
    var rows = r.data || [];
    if (!rows.length) {
      if (tb) tb.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada sheet arsip</td></tr>';
      return;
    }
    if (tb) tb.innerHTML = rows.map(function(a) {
      return '<tr>'
        + '<td style="font-weight:600">' + esc(a.nama) + '</td>'
        + '<td>' + (a.baris||0).toLocaleString() + ' baris</td>'
        + '<td><a href="' + esc(a.url) + '" target="_blank" class="btn btn-ghost btn-sm">🔗 Buka</a></td>'
        + '</tr>';
    }).join('');
  } catch(e) { toast(friendlyError(e),'err'); }
}

async function doArsip() {
  var mode = document.getElementById('arsipMode').value;
  var params = { mode: mode };
  var label  = '';

  if (mode === 'semester') {
    var sem = document.getElementById('arsipSemester').value;
    if (!sem) return toast('Pilih semester dulu','err');
    params.semester = sem;
    label = 'semester ' + sem;
  } else if (mode === 'periode') {
    var pid = document.getElementById('arsipPeriodeSelect').value;
    if (!pid) return toast('Pilih periode dulu','err');
    params.id_periode = pid;
    var perSel = document.getElementById('arsipPeriodeSelect');
    label = 'periode ' + ((perSel.options[perSel.selectedIndex] ? perSel.options[perSel.selectedIndex].text : '') || pid);
  } else {
    label = 'data > 1 tahun';
  }

  if (!(await showConfirm('Arsipkan ' + label + '? Data akan dipindah ke arsip database. Pastikan sudah backup data terlebih dahulu.', { title: 'Arsipkan Data?', okText: 'Ya, Arsipkan', danger: true }))) return;

  showLoad('Bismillah, mengarsipkan ' + label + '...');
  try {
    // Gunakan apiPost standar
    var data = await window.HQ.AdminAPI.arsipData(params);
    toast('✅ ' + (data.message || 'Arsip selesai! Sheet arsip baru dibuat.'),'ok');
    await loadArsipList();
  } catch(e) { toast('Arsip gagal: ' + e.message,'err'); }
  finally { hideLoad(); }
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(()=>{});

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
  setTimeout(function() { if (typeof initPushPrompt === 'function') initPushPrompt('admin'); }, 5000);
});

// ══════════════════════════════════════════
//  SPP IMAGE LIGHTBOX
// ══════════════════════════════════════════
var _lightboxScale = 1;
var _lightboxRotate = 0;
var _lightboxX = 0;
var _lightboxY = 0;
var _lightboxIsDragging = false;
var _lightboxStartX = 0;
var _lightboxStartY = 0;

function openSppLightbox(url) {
  var img = document.getElementById('lightboxImg');
  if (!img) return;
  img.src = url;
  _lightboxScale = 1;
  _lightboxRotate = 0;
  _lightboxX = 0;
  _lightboxY = 0;
  updateLightboxTransform();
  document.getElementById('sppLightbox').style.display = 'flex';
}

function closeSppLightbox() {
  document.getElementById('sppLightbox').style.display = 'none';
}

function updateLightboxTransform() {
  var img = document.getElementById('lightboxImg');
  if (img) {
    img.style.setProperty('--scale', _lightboxScale);
    img.style.setProperty('--rotate', _lightboxRotate + 'deg');
    img.style.setProperty('--x', _lightboxX + 'px');
    img.style.setProperty('--y', _lightboxY + 'px');
    img.style.transform = 'translate(var(--x, 0px), var(--y, 0px)) scale(var(--scale, 1)) rotate(var(--rotate, 0deg))';
  }
}

function zoomSppLightbox(amount) {
  _lightboxScale = Math.max(0.5, Math.min(5, _lightboxScale + amount));
  updateLightboxTransform();
}

function rotateSppLightbox(amount) {
  _lightboxRotate = (_lightboxRotate + amount) % 360;
  updateLightboxTransform();
}

function resetSppLightbox() {
  _lightboxScale = 1;
  _lightboxRotate = 0;
  _lightboxX = 0;
  _lightboxY = 0;
  updateLightboxTransform();
}

// Drag & Pan support for SPP Lightbox
document.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.lightbox-image-container');
  var img = document.getElementById('lightboxImg');
  if (!container || !img) return;
  
  container.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    _lightboxIsDragging = true;
    _lightboxStartX = e.clientX - _lightboxX;
    _lightboxStartY = e.clientY - _lightboxY;
    container.style.cursor = 'grabbing';
  });
  
  window.addEventListener('pointermove', function(e) {
    if (!_lightboxIsDragging) return;
    _lightboxX = e.clientX - _lightboxStartX;
    _lightboxY = e.clientY - _lightboxStartY;
    updateLightboxTransform();
  });
  
  window.addEventListener('pointerup', function() {
    if (_lightboxIsDragging) {
      _lightboxIsDragging = false;
      container.style.cursor = 'grab';
    }
  });
});

  // Export functions to window
  if (typeof window !== "undefined") {
    window.loadArsipPage = loadArsipPage;
    window.updateArsipMode = updateArsipMode;
    window.loadArsipList = loadArsipList;
    window.doArsip = doArsip;
    window.initThemeToggle = initThemeToggle;
    window.updateIcon = updateIcon;
    window.openSppLightbox = openSppLightbox;
    window.closeSppLightbox = closeSppLightbox;
    window.updateLightboxTransform = updateLightboxTransform;
    window.zoomSppLightbox = zoomSppLightbox;
    window.rotateSppLightbox = rotateSppLightbox;
    window.resetSppLightbox = resetSppLightbox;
  }
})();
