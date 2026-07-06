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
    
    var formId = category === 'portal' ? 'saranFormPortal' : 'saranFormKelas';
    var form = document.getElementById(formId);
    if (!form) return;

    var payload = {
      kategori: category === 'portal' ? 'Portal & Manajemen' : 'Halaqah & Kelas'
    };

    if (category === 'portal') {
      var subcatPortal = form.querySelector('[name="subkategori_portal"]').value;
      var pesanPortal = form.querySelector('[name="pesan_portal"]').value.trim();
      var isAnonPortal = form.querySelector('[name="is_anon_portal"]').checked;

      if (!subcatPortal) return toast('Pilih kategori saran terlebih dahulu', 'warn');
      if (!pesanPortal) return toast('Isikan pesan saran Anda', 'warn');

      payload.subkategori = subcatPortal;
      payload.pesan = pesanPortal;
      payload.is_anonim = isAnonPortal;
    } else {
      var subcatKelas = form.querySelector('[name="subkategori_kelas"]').value;
      var pesanKelas = form.querySelector('[name="pesan_kelas"]').value.trim();
      var isAnonKelas = form.querySelector('[name="is_anon_kelas"]').checked;

      if (!subcatKelas) return toast('Pilih topik ulasan terlebih dahulu', 'warn');
      if (!pesanKelas) return toast('Isikan pesan masukan Anda', 'warn');

      payload.subkategori = subcatKelas;
      payload.pesan = pesanKelas;
      payload.is_anonim = isAnonKelas;

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

      form.reset();
      rateSaranStar('Guru', 0);
      rateSaranStar('Materi', 0);
      handleSubKategoriSaranKelasChange('');
      
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
        var statusClass = item.status === 'Ditinjau' ? 'b-green' : item.status === 'Ditolak' ? 'b-red' : 'b-amber';
        var isAnonText = item.is_anonim ? ' • <i>Anonim</i>' : '';
        var ratings = [];
        if (item.rating_guru) ratings.push('Guru: ⭐' + item.rating_guru);
        if (item.rating_materi) ratings.push('Materi: ⭐' + item.rating_materi);
        var ratingStr = ratings.length ? ' • <span style="color:var(--amber-txt);font-weight:700">' + ratings.join(' | ') + '</span>' : '';

        return '<div class="card" style="margin-bottom:12px;padding:14px;border:1px solid var(--border)">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          + '  <span class="badge b-blue" style="font-size:10px">' + esc(item.kategori) + ' — ' + esc(item.subkategori) + '</span>'
          + '  <span class="badge ' + statusClass + '" style="font-size:10px">' + esc(item.status || 'Terkirim') + '</span>'
          + '</div>'
          + '<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:10px;white-space:pre-wrap">' + esc(item.pesan) + '</div>'
          + '<div style="font-size:11px;color:var(--text-3);display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--border);padding-top:8px">'
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
