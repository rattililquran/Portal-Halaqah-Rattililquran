/**
 * murid/saran-observasi-module.js
 * Modul Saran, Feedback, & Form Observasi Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var saranRatings = {
    Guru: 0,
    Materi: 0
  };

  function populateSaranInfo() {
    var dashData = window.dashData || null;
    var hq = (dashData && dashData.halaqah) || {};
    var ang = (dashData && dashData.anggota) || {};
    
    var hqName = hq.nama || '';
    var levelStr = ang.level ? ' (Level ' + ang.level.replace('Level ', '') + ')' : '';
    var halaqahTxt = hqName ? hqName + levelStr : 'Tidak ada halaqah aktif';
    var guruTxt = hq.guru || 'Tidak ada guru pembimbing';
    
    var elMockHalaqah = document.getElementById('saran-mockHalaqah');
    var elMockGuru = document.getElementById('saran-mockGuru');
    
    if (elMockHalaqah) elMockHalaqah.textContent = halaqahTxt;
    if (elMockGuru) elMockGuru.textContent = guruTxt;
    
    switchSaranTab('portal', document.querySelector('#page-saran .tab-btn:nth-child(1)'));
  }

  function switchSaranTab(tabName, btn) {
    document.querySelectorAll('#page-saran .tab-content').forEach(function(el) {
      el.style.display = 'none';
    });
    
    var target = document.getElementById('saran-view-' + tabName);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#page-saran .tab-btn').forEach(function(el) {
      el.classList.remove('active');
    });
    
    if (btn) btn.classList.add('active');

    if (tabName === 'riwayat') {
      loadRiwayatSaran();
    }
  }

  function rateSaranStar(type, val) {
    saranRatings[type] = val;
    var containerId = 'saran-stars-' + type;
    var container = document.getElementById(containerId);
    if (!container) return;
    var stars = container.querySelectorAll('.star-btn');
    
    stars.forEach(function(btn, idx) {
      if (idx < val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function handleSubKategoriSaranKelasChange(val) {
    var ratingGuru = document.getElementById('saran-ratingGuruGroup');
    var ratingMateri = document.getElementById('saran-ratingMateriGroup');
    if (!ratingGuru || !ratingMateri) return;
    
    if (val === 'Performa Guru') {
      ratingGuru.style.display = 'block';
      ratingMateri.style.display = 'none';
      rateSaranStar('Materi', 0);
    } else if (val === 'Kurikulum & Materi') {
      ratingGuru.style.display = 'none';
      ratingMateri.style.display = 'block';
      rateSaranStar('Guru', 0);
    } else if (val === 'Lainnya') {
      ratingGuru.style.display = 'block';
      ratingMateri.style.display = 'block';
    } else {
      ratingGuru.style.display = 'none';
      ratingMateri.style.display = 'none';
      rateSaranStar('Guru', 0);
      rateSaranStar('Materi', 0);
    }
  }

  async function handleSaranSubmit(e, category) {
    if (e) e.preventDefault();
    
    var payload = {
      kategori_utama: category === 'portal' ? 'portal' : 'program'
    };

    if (category === 'portal') {
      var subcatPortal = document.getElementById('saran-subKategoriPortal')?.value || '';
      var judulPortal = document.getElementById('saran-judulPortal')?.value.trim() || '';
      var pesanPortal = document.getElementById('saran-isiPortal')?.value.trim() || '';
      var isAnonPortal = document.getElementById('saran-anonPortal')?.checked || false;

      if (!subcatPortal) return toast('Pilih kategori saran terlebih dahulu', 'warn');
      if (!pesanPortal) return toast('Isikan pesan saran Anda', 'warn');

      payload.sub_kategori = subcatPortal;
      // Prepend title to message since database only has isi_masukan
      payload.isi_masukan = judulPortal ? '[' + judulPortal + '] ' + pesanPortal : pesanPortal;
      payload.is_anonymous = isAnonPortal;
    } else {
      var subcatKelas = document.getElementById('saran-subKategoriKelas')?.value || '';
      var pesanKelas = document.getElementById('saran-isiKelas')?.value.trim() || '';
      var isAnonKelas = document.getElementById('saran-anonKelas')?.checked || false;

      if (!subcatKelas) return toast('Pilih topik ulasan terlebih dahulu', 'warn');
      if (!pesanKelas) return toast('Isikan pesan masukan Anda', 'warn');

      payload.sub_kategori = subcatKelas;
      payload.isi_masukan = pesanKelas;
      payload.is_anonymous = isAnonKelas;

      if (subcatKelas === 'Performa Guru' || subcatKelas === 'Lainnya') {
        payload.rating_guru = saranRatings.Guru || null;
      }
      if (subcatKelas === 'Kurikulum & Materi' || subcatKelas === 'Lainnya') {
        payload.rating_materi = saranRatings.Materi || null;
      }
    }

    showLoad('Mengirimkan masukan...');
    try {
      await window.HQ.MuridAPI.kirimSaran(payload);
      hideLoad();
      toast('Terima kasih! Masukan Anda berhasil terkirim ✨', 'ok');

      // Reset fields manually
      if (category === 'portal') {
        var elSub = document.getElementById('saran-subKategoriPortal'); if (elSub) elSub.value = '';
        var elJud = document.getElementById('saran-judulPortal'); if (elJud) elJud.value = '';
        var elIsi = document.getElementById('saran-isiPortal'); if (elIsi) elIsi.value = '';
        var elAnon = document.getElementById('saran-anonPortal'); if (elAnon) elAnon.checked = false;
        var pWarning = document.getElementById('saran-anonPortalWarning'); if (pWarning) pWarning.style.display = 'none';
      } else {
        var elSubK = document.getElementById('saran-subKategoriKelas'); if (elSubK) elSubK.value = '';
        var elIsiK = document.getElementById('saran-isiKelas'); if (elIsiK) elIsiK.value = '';
        var elAnonK = document.getElementById('saran-anonKelas'); if (elAnonK) elAnonK.checked = false;
        var kWarning = document.getElementById('saran-anonKelasWarning'); if (kWarning) kWarning.style.display = 'none';
        rateSaranStar('Guru', 0);
        rateSaranStar('Materi', 0);
        handleSubKategoriSaranKelasChange('');
      }
      
      switchSaranTab('riwayat', document.querySelectorAll('#page-saran .tab-btn')[2]);
    } catch(err) {
      hideLoad();
      toast(friendlyError(err), 'err');
    }
  }

  async function loadRiwayatSaran() {
    var container = document.getElementById('saran-riwayatList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3)">⏳ Memuat riwayat...</div>';

    try {
      var res = await window.HQ.MuridAPI.getRiwayatSaran();
      var data = res.data || [];

      if (!data.length) {
        container.innerHTML = '<div class="empty"><div class="empty-ico">💬</div>'
          + '<div class="empty-ttl">Belum Ada Masukan</div>'
          + '<div class="empty-sub">Saran dan masukan yang Anda kirimkan akan tampil di sini.</div></div>';
        return;
      }

      container.innerHTML = data.map(function(item) {
        var statusMeta = {
          'pending':  { text: '⏳ Terkirim', class: 'b-amber' },
          'dibaca':   { text: '👀 Dibaca', class: 'b-blue' },
          'tindakan': { text: '⚙️ Diproses', class: 'b-blue' },
          'selesai':  { text: '✅ Selesai', class: 'b-green' },
          'arsip':    { text: '📦 Arsip', class: 'b-gray' }
        };
        var meta = statusMeta[item.status] || { text: item.status || 'Terkirim', class: 'b-amber' };
        var isAnonText = item.is_anonymous ? ' • <i>Anonim</i>' : '';
        var ratings = [];
        if (item.rating_guru) ratings.push('Guru: ⭐' + item.rating_guru);
        if (item.rating_materi) ratings.push('Materi: ⭐' + item.rating_materi);
        var ratingStr = ratings.length ? ' • <span style="color:var(--amber-txt);font-weight:700">' + ratings.join(' | ') + '</span>' : '';

        var katLabel = item.kategori_utama === 'portal' ? 'Portal & Manajemen' : 'Halaqah & Kelas';
        var tanggapanHtml = '';
        if (item.tanggapan) {
          tanggapanHtml = '<div style="margin-top:10px;padding:10px;background:var(--bg-2,#f1f5f9);border-left:4px solid var(--green);border-radius:8px;font-size:12.5px;color:var(--text-2);line-height:1.5">'
            + '<strong>Tanggapan Admin:</strong> ' + esc(item.tanggapan)
            + '</div>';
        }

        return '<div class="card" style="margin-bottom:12px;padding:14px;border:1px solid var(--border)">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          + '  <span class="badge b-blue" style="font-size:10px">' + esc(katLabel) + ' — ' + esc(item.sub_kategori) + '</span>'
          + '  <span class="badge ' + meta.class + '" style="font-size:10px">' + esc(meta.text) + '</span>'
          + '</div>'
          + '<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:10px;white-space:pre-wrap">' + esc(item.isi_masukan) + '</div>'
          + tanggapanHtml
          + '<div style="font-size:11px;color:var(--text-3);display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--border);padding-top:8px;margin-top:10px">'
          + '  <span>' + fmtDate(item.created_at) + isAnonText + ratingStr + '</span>'
          + '</div>'
          + '</div>';
      }).join('');

    } catch(err) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--red)">Gagal memuat riwayat saran.</div>';
    }
  }

  // Safe Property Accessors
  try { delete window.saranRatings; Object.defineProperty(window, 'saranRatings', { get: function() { return saranRatings; }, set: function(v) { saranRatings = v; }, configurable: true }); } catch(e) { window.saranRatings = saranRatings; }

  // Expose public functions to window
  window.populateSaranInfo = populateSaranInfo;
  window.switchSaranTab = switchSaranTab;
  window.rateSaranStar = rateSaranStar;
  window.handleSubKategoriSaranKelasChange = handleSubKategoriSaranKelasChange;
  window.handleSaranSubmit = handleSaranSubmit;
  window.loadRiwayatSaran = loadRiwayatSaran;
})();
