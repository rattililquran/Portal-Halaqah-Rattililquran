/**
 * murid/ketua-module.js
 * Modul Ketua Kelas Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var _ketuaData        = null;   // info ketua dari server
  var _ketuaKBMAlerts   = null;
  var _ketuaATAlerts    = null;
  var _ketuaObsPending  = null;
  var _ketuaCurrentTab  = 'pantau';
  var _ketuaObsIdKBM    = null;   // id_kbm yang sedang diisi form observasi
  var _ketuaTabLoaded   = {};
  var _ketuaObsShowDone = false;

  var _rekapIdKBM       = null;
  var _rekapText        = '';
  var _rekapSudahDikirim= new Set(); // id_kbm yang sudah rekap

  function initKetua(isKetua, halaqahKetua) {
    if (!isKetua) return;
    var btn = document.getElementById('sidebarKetuaBtn');
    if (btn) btn.style.display = '';
    // Lazy load badge
    window.HQ.KetuaAPI.getObservasiPending().then(function(r) {
      var pending = (r.data || []).filter(function(s) { return s.window_status === 'terbuka'; });
      _updateKetuaBadge(pending.length);
    }).catch(function(e) { console.warn('Ketua badge load failed:', e && e.message); });
  }

  function _updateKetuaBadge(n) {
    var badge1 = document.getElementById('sidebarKetuaBadge');
    var badge2 = document.getElementById('obsBadge');
    if (badge1) { badge1.textContent = n; badge1.style.display = n > 0 ? '' : 'none'; }
    if (badge2) { badge2.textContent = n; badge2.style.display = n > 0 ? '' : 'none'; }
  }

  function switchKetuaTab(tab, btn) {
    _ketuaCurrentTab = tab;
    document.querySelectorAll('.ketua-tab-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    document.getElementById('ketuaPanelPantau').style.display    = tab === 'pantau'   ? '' : 'none';
    document.getElementById('ketuaPanelObservasi').style.display = tab === 'observasi'? '' : 'none';
    document.getElementById('ketuaPanelReminder').style.display  = tab === 'reminder' ? '' : 'none';

    // Observasi selalu refresh agar badge dan status tidak stale
    if (tab === 'observasi') {
      _ketuaObsPending   = null;
      _rekapSudahDikirim = new Set();
      _ketuaObsIdKBM     = null;
      _ketuaTabLoaded['observasi'] = false;
    }

    if (!_ketuaTabLoaded[tab]) {
      _ketuaTabLoaded[tab] = true;
      if (tab === 'pantau')    loadKetuaPantau();
      if (tab === 'observasi') loadKetuaObservasi();
      if (tab === 'reminder')  initReminderTab();
    }
  }

  async function loadKetuaPage() {
    var hqInfo = document.getElementById('ketuaHalaqahInfo');
    try {
      var r = await window.HQ.KetuaAPI.getInfo();
      _ketuaData = r;
      if (hqInfo) hqInfo.textContent = (r.halaqah && r.halaqah.nama) ? 'Halaqah ' + r.halaqah.nama : 'Halaqah saya';
    } catch(e) { /* silent */ }
    if (!_ketuaTabLoaded['pantau']) { _ketuaTabLoaded['pantau'] = true; loadKetuaPantau(); }
  }

  async function loadKetuaPantau() {
    document.getElementById('ketuaMemberListKBM').innerHTML = skelCards(3,3);
    document.getElementById('ketuaMemberListAT').innerHTML  = skelCards(2,3);
    try {
      var [rKBM, rAT] = await Promise.all([
        window.HQ.KetuaAPI.getKeaktifanAnggota(),
        window.HQ.KetuaAPI.getAtTibyanAnggota(),
      ]);
      _ketuaKBMAlerts = rKBM.data || {};
      _ketuaATAlerts  = rAT.data  || {};
      var sumKBM = _ketuaKBMAlerts.summary || {};
      document.getElementById('ketuaKritis').textContent    = sumKBM.kritis    || 0;
      document.getElementById('ketuaPeringatan').textContent= sumKBM.peringatan|| 0;
      document.getElementById('ketuaNormal').textContent    = sumKBM.normal    || 0;
      renderKetuaMemberList('ketuaMemberListKBM', _ketuaKBMAlerts.alerts || [], 'kbm');
      renderKetuaMemberList('ketuaMemberListAT',  _ketuaATAlerts.alerts  || [], 'at');
    } catch(e) {
      document.getElementById('ketuaMemberListKBM').innerHTML = '<div class="empty"><div class="empty-ico">❌</div><div class="empty-ttl">'+esc(friendlyError(e))+'</div></div>';
    }
  }

  function renderKetuaMemberList(elId, list, type) {
    var el = document.getElementById(elId);
    if (!list.length) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">🌟</div><div class="empty-ttl">Alhamdulillah semua aktif!</div></div>';
      return;
    }
    el.innerHTML = list.map(function(m, idx) {
      var dots = (m.riwayat || []).map(function(r) {
        var cls = r.warna === 'hijau' ? 'hadir' : r.warna === 'merah' ? 'absen' : r.warna === 'abu' ? 'izin' : 'null';
        return '<div class="at-dot '+cls+'" title="'+esc(r.tanggal||'')+'"></div>';
      }).join('');
      var badge = m.status === 'kritis'
        ? '<span class="badge b-red" style="font-size:10px">Kritis 🔴</span>'
        : m.status === 'peringatan'
        ? '<span class="badge b-amber" style="font-size:10px">Peringatan 🟡</span>'
        : '<span class="badge b-green" style="font-size:10px">Normal 🟢</span>';
      var hasHp = m.no_hp && String(m.no_hp).replace(/\D/g,'').length >= 9;
      var hqNama = (_ketuaData && _ketuaData.halaqah && (_ketuaData.halaqah.nama || _ketuaData.halaqah.nama_halaqah)) || '';
      var waMsg = type === 'kbm'
        ? 'Assalamualaikum ' + m.nama_murid + ', saya ' + (_ketuaData && _ketuaData.anggota && _ketuaData.anggota.nama_murid || 'Ketua Kelas') + ' selaku Ketua Kelas Halaqah ' + hqNama + '.\n\n'
          + 'Hanya ingin mengingatkan, antum terpantau sudah alpa ' + m.absen + ' kali di kelas KBM. Yuk semangat hadir lagi biar kita bisa belajar bareng dan tidak ketinggalan materi. Semoga antum sehat selalu ya!\n\n'
          + 'Kalau ada kendala, kabari aku ya.\n\n'
          + 'Barakallahu fiikum.\n\n'
          + '-Data ini direkap otomatis melalui portal Rattililqur\'an, jika ada ketidak cocokan data mohon untuk konfirmasi-'
        : 'Assalamualaikum ' + m.nama_murid + ',\n\n'
          + 'Jangan lupa hadir di Kajian At-Tibyan minggu ini ya, insya Allah waktunya tidak lama dan banyak faidah yang akan kita dapatkan.\n\n'
          + 'Kajian ini penting banget buat ilmu kita bersama. Kehadiranmu sangat ditunggu.\n\n'
          + 'Barakallahu fiikum!\n\n'
          + '-Data ini direkap otomatis melalui portal Rattililqur\'an, jika ada ketidak cocokan data mohon untuk konfirmasi-';
      var num = String(m.no_hp || '').replace(/\D/g,'');
      if (num.startsWith('0')) num = '62' + num.slice(1);
      else if (!num.startsWith('62')) num = '62' + num;
      // FIX BUG: encodeURIComponent leaves single quote (like in Rattililqur'an) unencoded, breaking the onclick javascript string syntax.
      var waUrl = hasHp ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(waMsg).replace(/'/g, '%27') : '#';

      var isContacted = m.followup_ketua_at && (m.followup_ketua_alpa_kbm >= m.absen);
      var followupBtn = '';
      if (m.status !== 'normal') {
        if (isContacted) {
          followupBtn = '<button class="ketua-wa-btn" disabled style="background:var(--green-l);color:var(--green);border:none;margin-left:8px;font-weight:700">✅ Sudah Diingatkan</button>';
        } else {
          followupBtn = '<button class="ketua-wa-btn" style="background:rgba(59,130,246,0.15);color:var(--blue);border:none;margin-left:8px;font-weight:700" onclick="doMarkContactedKetua(\''+m.id_murid+'\', \''+esc(m.nama_murid)+'\', \''+type+'\', '+m.absen+', this)">Tandai Sudah Diingatkan</button>';
        }
      }

      return '<div class="ketua-member-card '+m.status+'">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        + '<div><div style="font-size:13.5px;font-weight:800;color:var(--text)">'+esc(m.nama_murid)+'</div>'
        + '<div style="font-size:11px;color:var(--text-3);font-weight:600;margin-top:2px">'
        + 'Hadir '+m.pct_hadir+'% · Absen '+m.absen+'× dari '+m.total_sesi+' sesi'
        + '</div></div>' + badge + '</div>'
        + '<div class="at-dots" style="margin-top:8px">'+dots+'</div>'
        + '<div style="display:flex;margin-top:8px;gap:8px;flex-wrap:wrap">'
        + (m.status !== 'normal' ? '<button class="ketua-wa-btn '+(hasHp?'aktif':'nonaktif')+'" onclick="'+(hasHp?'window.open(\''+waUrl+'\',\'_blank\')':'alert(\'No HP tidak tersedia\')')+'" style="margin:0">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.091.535 4.057 1.475 5.77L.057 23.784l6.162-1.396A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.797a9.8 9.8 0 01-4.988-1.361l-.36-.213-3.654.828.844-3.549-.235-.375A9.789 9.789 0 012.203 12C2.203 6.583 6.583 2.203 12 2.203S21.797 6.583 21.797 12 17.417 21.797 12 21.797z"/></svg>'
        + (hasHp ? 'Kirim Reminder WA' : 'No HP Tidak Tersedia') + '</button>' : '')
        + followupBtn
        + '</div>'
        + '</div>';
    }).join('');
  }

  async function doMarkContactedKetua(idMurid, namaMurid, tipeAlert, value, btnEl) {
    if (!confirm('Tandai ' + namaMurid + ' sudah diingatkan terkait keaktifan (' + value + 'x alpa)?')) return;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = '⏳...';
      btnEl.style.opacity = '.6';
    }
    try {
      await window.HQ.KetuaAPI.simpanFollowupKeaktifanKetua({
        id_murid  : idMurid,
        tipe_alert: tipeAlert,
        value     : value,
      });
      if (btnEl) {
        btnEl.style.background = 'var(--green-l)';
        btnEl.style.color = 'var(--green)';
        btnEl.textContent = '✅ Sudah Diingatkan';
        btnEl.style.opacity = '1';
      }
      toast('Berhasil menyimpan catatan tindak lanjut ketua kelas.', 'ok');
    } catch(e) {
      toast('Gagal: ' + e.message, 'err');
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = 'Tandai Sudah Diingatkan';
        btnEl.style.opacity = '1';
      }
    }
  }

  // ── TEMPLATE REMINDER ────────────────────────────
  function _buildReminderText(type) {
    var info  = _ketuaData && _ketuaData.halaqah ? _ketuaData.halaqah : {};
    var nama  = info.nama  || 'Maryam';
    var level = info.level || 'Level 1';
    var jam   = info.jam_mulai || '15:00';
    var jamM1 = _jamMinus1(jam);

    var hari  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
    var tgl   = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
    var besok = new Date(); besok.setDate(besok.getDate()+1);
    var hariBesok = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][besok.getDay()];
    var tglBesok  = besok.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });

    if (type === 'h1') {
      return "Assalamualaikum warahmatullahi wabarakatuh.\n\n" +
        "Diingatkan untuk sesi Halaqah Tahsin " + nama + " (" + level + ")\n" +
        "akan berlangsung besok, " + hariBesok + " " + tglBesok + "\n" +
        "pukul " + jam + " WIB via Zoom.\n\n" +
        "Harap bersiap dan hadir tepat waktu ya.\n" +
        "Jazakumullahu khairan.";
    }
    if (type === 'harih') {
      return "Assalamualaikum warahmatullahi wabarakatuh.\n\n" +
        "Halaqah Tahsin " + nama + " (" + level + ") akan dimulai\n" +
        "dalam 1 jam lagi, pukul " + jam + " WIB.\n\n" +
        "Segera persiapkan diri, buka Zoom, dan pastikan\n" +
        "kamera siap dibuka. Barakallahu fiikum!";
    }
    if (type === 'h1plus') {
      return "Assalamualaikum warahmatullahi wabarakatuh.\n\n" +
        "Semangat berlatih di rumah ya, jangan sampai ilmu\n" +
        "yang sudah dipelajari kemarin terlupakan.\n\n" +
        "Yuk luangkan waktu minimal 10-15 menit hari ini\n" +
        "untuk berlatih mandiri sesuai arahan ustadz/ustadzah.\n\n" +
        "Istiqomah adalah kunci. Semangat!\n" +
        "Jazakumullahu khairan.";
    }
    return '';
  }

  function _jamMinus1(jam) {
    var parts = String(jam).split(':');
    var h = parseInt(parts[0]) - 1;
    if (h < 0) h = 0;
    return String(h).padStart(2,'0') + ':' + (parts[1] || '00');
  }

  async function bukaModalRekap(idKBM, pertemuanKe, tanggal) {
    _rekapIdKBM = idKBM;
    document.getElementById('rekapTitle').textContent    = 'Rekap Sesi ke-' + pertemuanKe;
    document.getElementById('rekapSubtitle').textContent = fmtDate(tanggal);
    document.getElementById('rekapBody').innerHTML =
      '<div class="empty"><div class="empty-ico">⏳</div><div class="empty-ttl">Memuat data jurnal...</div></div>';
    document.getElementById('rekapTandaiBtn').style.display =
      _rekapSudahDikirim.has(idKBM) ? 'none' : '';
    openModal('rekapModal');

    try {
      var r = await window.HQ.KetuaAPI.getKBMJurnal(idKBM);
      var d = r.data;
      _renderRekapForm(d);
    } catch(e) {
      document.getElementById('rekapBody').innerHTML =
        '<div class="empty"><div class="empty-ico">❌</div><div class="empty-ttl">'+esc(friendlyError(e))+'</div></div>';
    }
  }

  function _renderRekapForm(d) {
    var tanggalVal = d.tanggal || d.tanggal_pertemuan || '';
    var tglFmt = '-';
    if (tanggalVal) {
      try {
        var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(tanggalVal+'T00:00:00').getDay()];
        tglFmt = hari + ', ' + fmtDate(tanggalVal);
      } catch (e) {
        tglFmt = fmtDate(tanggalVal);
      }
    }
    
    document.getElementById('rekapBody').innerHTML =
      '<div style="background:#f0fdf4;border:1.5px solid rgba(16,185,129,.2);border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:11.5px;color:#065f46;font-weight:600;line-height:1.7">' +
      'Data diambil otomatis dari jurnal guru. Tambahkan Catatan Ustadz jika ada, lalu salin teks rekap.' +
      '</div>' +
      '<div class="obs-form-section">' +
      '<div class="obs-form-label">Catatan Penting Ustadz/Ustadzah</div>' +
      '<textarea class="fc" id="rekapCatatanUstadz" rows="3" placeholder="Contoh: Tekankan sifat jahar pada huruf zai. Perbaiki makhraj qaf..." style="resize:vertical"></textarea>' +
      '</div>' +
      '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:4px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:8px">Preview Rekap</div>' +
      '<div id="rekapPreview" style="font-size:12px;color:var(--text-2);white-space:pre-wrap;line-height:1.8;font-family:monospace"></div>' +
      '</div>';

    // Render preview saat catatan diubah
    var ta = document.getElementById('rekapCatatanUstadz');
    ta.addEventListener('input', function() { _updateRekapPreview(d, tglFmt); });
    _updateRekapPreview(d, tglFmt);
  }

  function _updateRekapPreview(d, tglFmt) {
    var catatan = (document.getElementById('rekapCatatanUstadz') || {}).value || '-';
    
    // Format Point 3 (Tugas Latihan Mandiri)
    var tugasStr = '';
    if (d.jenis_latihan) {
      var jenisMap = {
        'Rekaman Portal': '🎙️ Rekaman Suara di Portal',
        'VN di WAG': '📱 Voice Note di WA Group',
        'Mendengar dan membaca mandiri': '🎧 Mendengar & Membaca Mandiri',
        'Lainnya': '📌 Lainnya'
      };
      var jenisFriendly = jenisMap[d.jenis_latihan] || d.jenis_latihan;
      var deadlineStr = d.deadline_latihan ? fmtDate(d.deadline_latihan) : '-';
      tugasStr = 
        "   • Jenis: " + jenisFriendly + "\n" +
        "   • Tugas: " + (d.latihan_mandiri || '-') + "\n" +
        "   • Deadline: *" + deadlineStr + "*";
    } else {
      tugasStr = "   _Tidak ada tugas_";
    }

    // Format Point 4 (Kehadiran Murid)
    var hadirList = [];
    var terlambatList = [];
    var alphaList = [];
    var izinList = [];

    if (d.presensi && d.presensi.length > 0) {
      d.presensi.forEach(function(p) {
        var name = p.nama_murid || p.id_murid;
        if (p.status_hadir === 'H') hadirList.push(name);
        else if (p.status_hadir === 'T') terlambatList.push(name);
        else if (p.status_hadir === 'A') alphaList.push(name);
        else if (p.status_hadir === 'I') izinList.push(name);
      });
    }

    var kehadiranStr = "";
    if (d.presensi && d.presensi.length > 0) {
      kehadiranStr = 
        "*4. KEHADIRAN MURID:*\n" +
        "   ✅ Hadir (" + hadirList.length + "): " + (hadirList.join(', ') || '-') + "\n" +
        "   ⏰ Terlambat (" + terlambatList.length + "): " + (terlambatList.join(', ') || '-') + "\n" +
        "   ❌ Alpha (" + alphaList.length + "): " + (alphaList.join(', ') || '-') + "\n" +
        "   📋 Izin (" + izinList.length + "): " + (izinList.join(', ') || '-');
    } else {
      kehadiranStr = "*4. KEHADIRAN MURID:*\n   _(Tidak ada data presensi)_";
    }

    // Fallbacks using global _ketuaData
    var halaqahName = d.nama_halaqah || (_ketuaData && _ketuaData.halaqah && _ketuaData.halaqah.nama) || '-';
    var guruName = d.nama_guru || (_ketuaData && _ketuaData.halaqah && _ketuaData.halaqah.nama_guru) || '-';
    var levelName = d.level || (_ketuaData && _ketuaData.halaqah && _ketuaData.halaqah.level) || '';

    _rekapText =
      "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n" +
      "_Teman-teman baarakallahu fiikum,_\n\n" +
      "Berikut *Rekapitulasi Halaqah Tahsin " + esc(levelName) + "*\n\n" +
      "📌 *Halaqah*       : " + esc(halaqahName) + "\n" +
      "👤 *Ustadz/ah*     : " + esc(guruName) + "\n" +
      "📅 *Hari/Tanggal*  : " + tglFmt + "\n" +
      "🔢 *Pertemuan Ke*  : " + d.pertemuan_ke + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      "*1. CAPAIAN MATERI TEORI:*\n   " + (d.pencapaian_modul || '-') + "\n" +
      (d.halaman_modul ? "   Halaman/Modul: " + d.halaman_modul + "\n" : '') + "\n" +
      "*2. CATATAN PENTING USTADZ/USTADZAH:*\n   _" + catatan + "_\n\n" +
      "*3. TUGAS LATIHAN MANDIRI:*\n" + tugasStr + "\n\n" +
      kehadiranStr + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      "_Mari kita istiqomah berlatih._\n" +
      "Sampai jumpa di pertemuan berikutnya.\n" +
      "_Jazakumullah khairan._\n" +
      "_Semoga Allah mudahkan_ 🤲";

    var prev = document.getElementById('rekapPreview');
    if (prev) prev.textContent = _rekapText;
  }

  function copyRekap() {
    if (!_rekapText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_rekapText).then(function() {
        _haptic(40);
        toast('Rekap berhasil disalin! Tempel di grup WA.', 'ok');
      }).catch(function() { _copyFallback(_rekapText); });
    } else { _copyFallback(_rekapText); }
  }

  async function tandaiRekapTerkirim() {
    if (!_rekapIdKBM) return;
    var catatan = (document.getElementById('rekapCatatanUstadz') || {}).value || '';
    var btn = document.getElementById('rekapTandaiBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
      await window.HQ.KetuaAPI.simpanRekapStatus({ id_kbm: _rekapIdKBM, catatan_ustadz: catatan });
      _rekapSudahDikirim.add(_rekapIdKBM);
      if (btn) btn.style.display = 'none';
      toast('Rekap ditandai sudah dikirim ✅', 'ok');
      renderKetuaObsList(); // refresh badge di list
      closeModal('rekapModal');
    } catch(e) {
      toast(friendlyError(e), 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Tandai Terkirim'; }
    }
  }

  async function _loadRekapStatus() {
    try {
      var r = await window.HQ.KetuaAPI.getRekapStatus();
      _rekapSudahDikirim = new Set(r.data || []);
    } catch(e) { /* silent */ }
  }

  // ── REMINDER TAB — Template yang bisa dikonfigurasi ──────────
  var _TMPL_KEY_BASE = {
    h1     : 'ketua_tmpl_h1',
    harih  : 'ketua_tmpl_harih',
    h1plus : 'ketua_tmpl_h1plus',
  };

  function _tmplKey(type) {
    var us = window.HQ && window.HQ.Auth && window.HQ.Auth.getUser();
    return _TMPL_KEY_BASE[type] + '_' + (us ? us.id_user : 'x');
  }

  function _defaultTemplate(type) {
    return _buildReminderText(type);
  }

  function initReminderTab() {
    var ids = { h1:'tmplH1', harih:'tmplHariH', h1plus:'tmplH1Plus' };
    Object.keys(ids).forEach(function(type) {
      var el = document.getElementById(ids[type]);
      if (!el) return;
      var saved = localStorage.getItem(_tmplKey(type));
      el.value = saved !== null ? saved : _defaultTemplate(type);
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }

  function simpanTemplate(type, val) {
    localStorage.setItem(_tmplKey(type), val);
  }

  function resetTemplate(type) {
    var ids = { h1:'tmplH1', harih:'tmplHariH', h1plus:'tmplH1Plus' };
    var el = document.getElementById(ids[type]);
    if (!el) return;
    localStorage.removeItem(_tmplKey(type));
    el.value = _defaultTemplate(type);
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    toast('Template di-reset ke teks bawaan', 'ok');
  }

  function copyReminderFromTextarea(textareaId, btn) {
    var el = document.getElementById(textareaId);
    if (!el) return;
    var txt = el.value.trim();
    if (!txt) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function() {
        _haptic(40);
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tersalin!';
        btn.classList.add('copied');
        setTimeout(function() { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
      }).catch(function() { _copyFallback(txt); });
    } else { _copyFallback(txt); }
  }

  function copyReminder(type, btn) {
    var ids = { h1:'tmplH1', harih:'tmplHariH', h1plus:'tmplH1Plus' };
    var el  = document.getElementById(ids[type]);
    var saved = localStorage.getItem(_tmplKey(type));
    var txt = (el && el.value.trim()) || (saved !== null ? saved : _buildReminderText(type));
    if (!txt) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function() {
        _haptic(40);
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tersalin!';
        btn.classList.add('copied');
        setTimeout(function() { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
      }).catch(function() { _copyFallback(txt); });
    } else { _copyFallback(txt); }
  }

  function refreshKetuaPage() {
    _ketuaTabLoaded = {};
    _ketuaKBMAlerts = null;
    _ketuaATAlerts  = null;
    _ketuaObsPending = null;
    _ketuaTabLoaded[_ketuaCurrentTab] = true;
    if (_ketuaCurrentTab === 'pantau') loadKetuaPantau();
    else loadKetuaObservasi();
  }

  async function loadKetuaObservasi() {
    var el = document.getElementById('ketuaObsList');
    el.innerHTML = skelCards(3,2);
    try {
      var [rObs, rRekap] = await Promise.all([
        window.HQ.KetuaAPI.getObservasiPending(),
        window.HQ.KetuaAPI.getRekapStatus(),
      ]);
      _ketuaObsPending    = rObs.data || [];
      _rekapSudahDikirim  = new Set(rRekap.data || []);
      var pending = _ketuaObsPending.filter(function(s) { return s.window_status === 'terbuka'; });
      _updateKetuaBadge(pending.length);
      renderKetuaObsList();
    } catch(e) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">❌</div><div class="empty-ttl">'+esc(friendlyError(e))+'</div></div>';
    }
  }

  function renderKetuaObsList() {
    var el = document.getElementById('ketuaObsList');
    if (!_ketuaObsPending || !_ketuaObsPending.length) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div class="empty-ttl">Belum ada sesi KBM</div></div>';
      return;
    }

    var sorted = _ketuaObsPending.slice().sort(function(a, b) {
      return (parseInt(b.pertemuan_ke, 10) || 0) - (parseInt(a.pertemuan_ke, 10) || 0);
    });

    function needsAction(s) {
      var sudahRekap = _rekapSudahDikirim.has(String(s.id_kbm));
      return s.window_status === 'terbuka' || (s.window_status === 'selesai' && !sudahRekap);
    }
    var actionItems = sorted.filter(needsAction);
    var doneItems   = sorted.filter(function(s) { return !needsAction(s); });

    var html = '';

    if (actionItems.length) {
      html += '<div class="card" style="margin-bottom:12px">'
        + '<div style="padding:10px 16px 4px;font-size:11px;font-weight:800;color:var(--blue);letter-spacing:.5px;text-transform:uppercase">Perlu Tindakan ('+actionItems.length+')</div>'
        + '<div style="padding:0 16px">'
        + actionItems.map(_renderObsSesiItem).join('')
        + '</div></div>';
    } else {
      html += '<div class="card" style="margin-bottom:12px;padding:14px 16px">'
        + '<div style="font-size:13px;color:var(--text-3);text-align:center">Semua sesi sudah diobservasi dan direkap ✓</div>'
        + '</div>';
    }

    if (doneItems.length) {
      html += '<div>';
      html += '<button onclick="toggleKetuaObsDone()" style="width:100%;background:none;border:none;cursor:pointer;padding:8px 4px;display:flex;align-items:center;gap:6px;color:var(--text-3);font-size:12px;font-weight:700">'
        + '<span id="ketuaObsDoneChevron">'+(  _ketuaObsShowDone ? '▾' : '▸')+'</span>'
        + '<span>'+(_ketuaObsShowDone ? 'Sembunyikan' : 'Tampilkan')+' '+doneItems.length+' sesi selesai</span>'
        + '</button>';
      html += '<div id="ketuaObsDonePanel" style="display:'+(_ketuaObsShowDone ? '' : 'none')+'">'
        + '<div class="card"><div style="padding:0 16px">'
        + doneItems.map(_renderObsSesiItem).join('')
        + '</div></div></div></div>';
    }

    el.innerHTML = html;
  }

  function _renderObsSesiItem(s) {
    var sudahRekap = _rekapSudahDikirim.has(String(s.id_kbm));
    var numCls = s.window_status === 'selesai' ? 'selesai' : s.window_status === 'terkunci' ? 'terkunci' : '';
    var obsChip = s.window_status === 'terbuka'
      ? '<span class="obs-window-chip obs-window-terbuka">Terbuka</span>'
      : s.window_status === 'terkunci'
      ? '<span class="obs-window-chip obs-window-terkunci">Terkunci</span>'
      : '<span class="obs-window-chip obs-window-selesai">Sudah diobservasi</span>';
    var rekapChip = sudahRekap
      ? '<span class="rekap-badge-done">Rekap terkirim</span>'
      : s.window_status !== 'terkunci'
      ? '<span class="rekap-badge-pending">Rekap belum dikirim</span>'
      : '';
    var btnObs = s.window_status === 'terbuka'
      ? '<button class="btn btn-primary btn-sm" style="font-size:11px;padding:5px 10px;white-space:nowrap" onclick="bukaFormObservasi(\''+esc(s.id_kbm)+'\',\''+s.pertemuan_ke+'\',\''+esc(s.tanggal||'')+'\')">Observasi</button>'
      : '';
    var btnRekap = !sudahRekap && s.window_status !== 'terkunci'
      ? '<button class="btn btn-outline btn-sm" style="font-size:11px;padding:5px 10px;white-space:nowrap;color:var(--green);border-color:var(--green)" onclick="bukaModalRekap(\''+esc(s.id_kbm)+'\',\''+s.pertemuan_ke+'\',\''+esc(s.tanggal||'')+'\')">Rekap</button>'
      : '';
    return '<div class="obs-sesi-item">'
      + '<div class="obs-sesi-num '+numCls+'">'+s.pertemuan_ke+'</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:13px;font-weight:800;color:var(--text)">Sesi ke-'+s.pertemuan_ke+'</div>'
      + '<div style="font-size:11.5px;color:var(--text-3);font-weight:600">'+fmtDate(s.tanggal)+'</div>'
      + '<div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">'+obsChip+rekapChip+'</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">'+btnObs+btnRekap+'</div>'
      + '</div>';
  }

  function toggleKetuaObsDone() {
    _ketuaObsShowDone = !_ketuaObsShowDone;
    var panel   = document.getElementById('ketuaObsDonePanel');
    var chevron = document.getElementById('ketuaObsDoneChevron');
    var btn     = chevron && chevron.parentElement;
    if (panel)   panel.style.display = _ketuaObsShowDone ? '' : 'none';
    if (chevron) chevron.textContent = _ketuaObsShowDone ? '▾' : '▸';
    if (btn) {
      var spans = btn.querySelectorAll('span');
      if (spans[1]) {
        var n = panel ? panel.querySelectorAll('.obs-sesi-item').length : 0;
        spans[1].textContent = (_ketuaObsShowDone ? 'Sembunyikan' : 'Tampilkan') + ' ' + n + ' sesi selesai';
      }
    }
  }

  function bukaFormObservasi(idKBM, pertemuanKe, tanggal) {
    _ketuaObsIdKBM = idKBM;
    document.getElementById('obsFormTitle').textContent = 'Observasi Sesi ke-' + pertemuanKe;
    document.getElementById('obsFormSubtitle').textContent = fmtDate(tanggal);

    _obsSelected = {};
    document.getElementById('obsSubmitBtn').disabled = false;

    document.getElementById('obsFormBody').innerHTML =
      _obsSection('kondisi_kelas', 'Kondisi Kelas saat KBM', [
        { val:'Kondusif',          label:'Kondusif', desc:'Kelas aktif, murid fokus and responsif' },
        { val:'Kurang Kondusif',   label:'Kurang Kondusif', desc:'Ada beberapa gangguan, tapi masih berjalan' },
        { val:'Tidak Kondusif',    label:'Tidak Kondusif', desc:'Kelas tidak berjalan dengan baik' },
      ]) +
      _obsSection('ada_latihan', 'Guru Memberikan Latihan Mandiri (PR)?', [
        { val:'Ya',    label:'Ya — Ada latihan/PR diberikan' },
        { val:'Tidak', label:'Tidak — Tidak ada latihan/PR' },
      ]) +
      _obsSection('ketepatan_waktu', 'Ketepatan Waktu Guru', [
        { val:'Tepat Waktu',           label:'Tepat Waktu', desc:'Guru hadir dan mengakhiri sesuai jadwal' },
        { val:'Guru Terlambat',        label:'Guru Terlambat Hadir' },
        { val:'Diakhiri Lebih Awal',   label:'KBM Diakhiri Lebih Awal dari Jadwal' },
        { val:'Keduanya',              label:'Keduanya (Terlambat + Lebih Awal)' },
      ]) +
      '<div class="obs-form-section" id="obsMenitWrap" style="display:none">'
      + '<div class="obs-form-label">Perkiraan Berapa Menit?</div>'
      + '<input type="number" class="fc" id="obsMenit" min="1" max="60" placeholder="Contoh: 10" style="max-width:140px">'
      + '</div>'
      + _obsSection('kamera_peserta', 'Keadaan Kamera Sebagian Besar Peserta', [
        { val:'Sebagian Besar Terbuka',   label:'Sebagian Besar Terbuka', desc:'Lebih dari 50% peserta kamera terbuka' },
        { val:'Campuran',                 label:'Campuran', desc:'Sekitar sama banyak yang terbuka dan tertutup' },
        { val:'Sebagian Besar Tertutup',  label:'Sebagian Besar Tertutup', desc:'Lebih dari 50% peserta kamera tertutup' },
      ]) +
      '<div class="obs-form-section">'
      + '<div class="obs-form-label">Catatan Lain (Opsional)</div>'
      + '<textarea class="fc" id="obsCatatanLain" rows="3" placeholder="Hal lain yang perlu dilaporkan..." style="resize:vertical"></textarea>'
      + '</div>';

    openModal('obsFormModal');
  }

  function _obsSection(key, label, options) {
    return '<div class="obs-form-section">'
      + '<div class="obs-form-label">'+esc(label)+'</div>'
      + '<div class="obs-options">'
      + options.map(function(o) {
        return '<div class="obs-radio" id="obs-'+key+'-'+esc(o.val)+'" onclick="selectObs(\''+key+'\',\''+esc(o.val)+'\')">'
          + '<div class="obs-radio-dot"></div>'
          + '<div><div class="obs-radio-label">'+esc(o.label)+'</div>'
          + (o.desc ? '<div style="font-size:11px;color:var(--text-3);margin-top:2px">'+esc(o.desc)+'</div>' : '')
          + '</div></div>';
      }).join('')
      + '</div></div>';
  }

  function selectObs(key, val) {
    _obsSelected[key] = val;
    document.querySelectorAll('[id^="obs-'+key+'-"]').forEach(function(el) {
      el.classList.remove('selected');
    });
    var sel = document.getElementById('obs-'+key+'-'+val);
    if (sel) sel.classList.add('selected');
    if (key === 'ketepatan_waktu') {
      var wrap = document.getElementById('obsMenitWrap');
      if (wrap) wrap.style.display = (val === 'Guru Terlambat' || val === 'Keduanya') ? '' : 'none';
    }
  }

  async function doSubmitObservasi() {
    var wajib = ['kondisi_kelas','ada_latihan','ketepatan_waktu','kamera_peserta'];
    for (var i = 0; i < wajib.length; i++) {
      if (!_obsSelected[wajib[i]]) {
        toast('Lengkapi semua pilihan terlebih dahulu', 'warn');
        return;
      }
    }
    var btn = document.getElementById('obsSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }
    try {
      var menit = 0;
      var menitEl = document.getElementById('obsMenit');
      if (menitEl && menitEl.value) menit = Number(menitEl.value);
      var catatan = document.getElementById('obsCatatanLain');

      await window.HQ.KetuaAPI.submitObservasi({
        id_kbm          : _ketuaObsIdKBM,
        kondisi_kelas   : _obsSelected['kondisi_kelas'],
        ada_latihan     : _obsSelected['ada_latihan'],
        ketepatan_waktu : _obsSelected['ketepatan_waktu'],
        estimasi_menit  : menit,
        kamera_peserta  : _obsSelected['kamera_peserta'],
        catatan_lain    : catatan ? catatan.value.trim() : '',
      });
      closeModal('obsFormModal');
      toast('Observasi berhasil dikirim. Jazakallahu khairan!', 'ok');
      delete _ketuaTabLoaded['observasi'];
      _ketuaObsPending = null;
      _ketuaTabLoaded['observasi'] = true;
      loadKetuaObservasi();
    } catch(e) {
      toast('Gagal: ' + e.message, 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim Observasi'; }
    }
  }

  // Safe Property Accessors to match variables accessed externally
  try {
    delete window._ketuaData;
    Object.defineProperty(window, '_ketuaData', {
      get: function() { return _ketuaData; },
      set: function(v) { _ketuaData = v; },
      configurable: true
    });
  } catch(e) { window._ketuaData = _ketuaData; }

  try {
    delete window._rekapText;
    Object.defineProperty(window, '_rekapText', {
      get: function() { return _rekapText; },
      set: function(v) { _rekapText = v; },
      configurable: true
    });
  } catch(e) { window._rekapText = _rekapText; }

  try {
    delete window._rekapIdKBM;
    Object.defineProperty(window, '_rekapIdKBM', {
      get: function() { return _rekapIdKBM; },
      set: function(v) { _rekapIdKBM = v; },
      configurable: true
    });
  } catch(e) { window._rekapIdKBM = _rekapIdKBM; }

  // Expose public functions to window
  window.initKetua = initKetua;
  window.switchKetuaTab = switchKetuaTab;
  window.loadKetuaPage = loadKetuaPage;
  window.loadKetuaPantau = loadKetuaPantau;
  window.renderKetuaMemberList = renderKetuaMemberList;
  window.doMarkContactedKetua = doMarkContactedKetua;
  window.bukaModalRekap = bukaModalRekap;
  window.copyRekap = copyRekap;
  window.tandaiRekapTerkirim = tandaiRekapTerkirim;
  window.initReminderTab = initReminderTab;
  window.simpanTemplate = simpanTemplate;
  window.resetTemplate = resetTemplate;
  window.copyReminderFromTextarea = copyReminderFromTextarea;
  window.copyReminder = copyReminder;
  window.refreshKetuaPage = refreshKetuaPage;
  window.loadKetuaObservasi = loadKetuaObservasi;
  window.renderKetuaObsList = renderKetuaObsList;
  window.toggleKetuaObsDone = toggleKetuaObsDone;
  window.bukaFormObservasi = bukaFormObservasi;
  window.selectObs = selectObs;
  window.doSubmitObservasi = doSubmitObservasi;

})();
