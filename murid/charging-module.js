/**
 * murid/charging-module.js
 * Modul Charging & Motivasi Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var CHARGING_QUOTES = [
    "\"Barangsiapa menempuh jalan untuk menuntut ilmu, Allah akan mudahkan baginya jalan menuju surga.\" — HR. Muslim",
    "\"Sebaik-baik kalian adalah yang mempelajari Al-Qur'an dan mengajarkannya.\" — HR. Bukhari",
    "\"Sesungguhnya bersama kesulitan ada kemudahan.\" — QS. Al-Insyirah: 6",
    "\"Bacalah Al-Qur'an, karena ia akan datang pada hari kiamat sebagai pemberi syafaat bagi pembacanya.\" — HR. Muslim",
    "\"Orang yang lancar membaca Al-Qur'an akan bersama para malaikat yang mulia lagi taat.\" — HR. Bukhari & Muslim"
  ];

  var CHARGING_COLORS = {
    blue:   { bg: '#0ea5e9', soft: 'rgba(14,165,233,0.15)',  wash: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.02))', txt: '#0284c7' },
    green:  { bg: '#10b981', soft: 'rgba(16,185,129,0.15)',  wash: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))', txt: '#059669' },
    amber:  { bg: '#f59e0b', soft: 'rgba(245,158,11,0.15)',  wash: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', txt: '#d97706' },
    purple: { bg: '#8b5cf6', soft: 'rgba(139,92,246,0.15)', wash: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))', txt: '#7c3aed' },
    rose:   { bg: '#f43f5e', soft: 'rgba(244,63,94,0.15)',   wash: 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(244,63,94,0.02))', txt: '#e11d48' }
  };

  var CHARGING_CATEGORIES = {
    goal:     { emoji: '🎯', label: 'Tujuan & Target' },
    affirm:   { emoji: '✨', label: 'Afirmasi Diri' },
    nasihat:  { emoji: '💡', label: 'Nasihat Guru' },
    memories: { emoji: '🏆', label: 'Momen Berhasil' }
  };

  var _chargingNotes = [];
  var _chargingModeIdx = 0;

  function _chargingHeroQuote() {
    var el = document.getElementById('chargingHeroQuote');
    if (el) el.textContent = CHARGING_QUOTES[Math.floor(Math.random() * CHARGING_QUOTES.length)];
  }

  async function loadCharging() {
    _chargingHeroQuote();
    var grid = document.getElementById('chargingGrid');
    if (grid) grid.innerHTML = skelCards(3, 2);
    try {
      var r = await window.HQ.MuridAPI.getChargingNotes();
      _chargingNotes = r.data || [];
      renderChargingNotes();
    } catch (e) {
      if (grid) grid.innerHTML = '<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-ttl">Gagal memuat catatan</div></div>';
      toast(friendlyError(e), 'err');
    }
  }

  function renderChargingNotes() {
    var grid = document.getElementById('chargingGrid');
    if (!grid) return;
    if (!_chargingNotes.length) {
      grid.innerHTML = '<div class="charging-empty">'
        + '<div class="charging-empty-emoji">🌱</div>'
        + '<div class="empty-ttl" style="font-size:15px">Belum ada catatan tersimpan</div>'
        + '<div style="font-size:12.5px;color:var(--text-3);margin-top:6px;max-width:320px;margin-left:auto;margin-right:auto;line-height:1.6">'
        + 'Mulai simpan kata-kata yang menguatkanmu — sebuah tujuan, afirmasi harian,'
        + ' kenangan saat berhasil, atau nasihat dari ustadz yang ingin selalu kamu ingat.</div>'
        + '<button class="btn charging-btn-glow" style="margin-top:16px;padding:10px 22px" onclick="bukaFormCharging()">✍️ Tulis Catatan Pertamamu</button>'
        + '</div>';
      return;
    }
    grid.innerHTML = _chargingNotes.map(function(n, idx) {
      var c   = CHARGING_COLORS[n.color] || CHARGING_COLORS.blue;
      var cat = CHARGING_CATEGORIES[n.category] || CHARGING_CATEGORIES.goal;
      return '<div class="charging-note-card" style="background:' + c.wash + ', var(--card-solid)">'
        + '<div class="charging-note-quote" style="color:' + c.txt + '">&ldquo;</div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative">'
        + '<span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:' + c.txt + ';background:' + c.soft + ';padding:4px 10px;border-radius:100px">' + cat.emoji + ' ' + cat.label + '</span>'
        + '<span style="font-size:10.5px;color:var(--text-3);font-weight:600">' + fmtDate(n.created_at) + '</span>'
        + '</div>'
        + '<div class="charging-note-content" style="margin-top:12px;position:relative">' + esc(n.content) + '</div>'
        + '<div class="charging-note-actions">'
        + '<button class="charging-icon-btn" onclick="bukaFormCharging(\'' + esc(n.id_note) + '\')">✏️ Ubah</button>'
        + '<button class="charging-icon-btn danger" onclick="hapusChargingNote(\'' + esc(n.id_note) + '\')">🗑 Hapus</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function bukaFormCharging(id) {
    var note = id ? _chargingNotes.find(function(n) { return n.id_note === id; }) : null;
    document.getElementById('chargingFormTitle').textContent = note ? '✏️ Edit Catatan' : '✨ Catatan Baru';
    document.getElementById('chargingNoteId').value  = note ? note.id_note : '';
    document.getElementById('chargingContent').value = note ? note.content : '';
    document.getElementById('chargingCategory').value = note ? note.category : 'goal';
    _renderChargingColorPicker(note ? note.color : 'blue');
    openModal('chargingFormModal');
  }

  function _renderChargingColorPicker(selected) {
    var wrap = document.getElementById('chargingColorPicker');
    if (!wrap) return;
    wrap.innerHTML = Object.keys(CHARGING_COLORS).map(function(key) {
      var c = CHARGING_COLORS[key];
      var active = key === selected;
      return '<div onclick="_pilihChargingColor(\'' + key + '\')" data-color-swatch="' + key + '" '
        + 'style="width:34px;height:34px;border-radius:50%;background:' + c.bg + ';cursor:pointer;display:flex;align-items:center;justify-content:center;'
        + 'box-shadow:' + (active ? '0 0 0 3px var(--card-solid),0 0 0 5px ' + c.txt : 'none') + '">'
        + (active ? '<span style="color:#fff;font-size:14px;font-weight:900">✓</span>' : '')
        + '</div>';
    }).join('');
    wrap.setAttribute('data-selected', selected);
  }

  function _pilihChargingColor(key) {
    _renderChargingColorPicker(key);
  }

  async function simpanChargingNote() {
    var content = document.getElementById('chargingContent').value.trim();
    if (!content) return toast('Tulis dulu isi catatannya ya', 'err');
    var payload = {
      id_note : document.getElementById('chargingNoteId').value || null,
      content : content,
      category: document.getElementById('chargingCategory').value,
      color   : document.getElementById('chargingColorPicker').getAttribute('data-selected') || 'blue',
    };
    var btn = document.getElementById('chargingSubmitBtn');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      await window.HQ.MuridAPI.saveChargingNote(payload);
      closeModal('chargingFormModal');
      toast('Catatan tersimpan!', 'ok');
      loadCharging();
    } catch (e) {
      toast(friendlyError(e), 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  function hapusChargingNote(id) {
    if (!confirm('Hapus catatan ini? Tindakan ini tidak bisa dibatalkan.')) return;
    showLoad('Menghapus catatan...');
    window.HQ.MuridAPI.deleteChargingNote(id).then(function() {
      toast('Catatan dihapus', 'ok');
      loadCharging();
    }).catch(function(e) {
      toast(friendlyError(e), 'err');
    }).finally(function() {
      hideLoad();
    });
  }

  function bukaModeCharging() {
    if (!_chargingNotes.length) return toast('Belum ada catatan untuk dibaca. Tulis dulu yuk!', 'warn');
    _chargingModeIdx = 0;
    document.getElementById('chargingModeOverlay').style.display = 'flex';
    _renderChargingModeCard();
  }

  function tutupModeCharging() {
    document.getElementById('chargingModeOverlay').style.display = 'none';
  }

  function modeChargingNav(dir) {
    var n = _chargingNotes.length;
    _chargingModeIdx = ((_chargingModeIdx + dir) % n + n) % n;
    _renderChargingModeCard();
  }

  function modeChargingShuffle() {
    if (_chargingNotes.length < 2) return _renderChargingModeCard();
    var next;
    do { next = Math.floor(Math.random() * _chargingNotes.length); } while (next === _chargingModeIdx);
    _chargingModeIdx = next;
    _renderChargingModeCard();
  }

  function _renderChargingModeCard() {
    var note = _chargingNotes[_chargingModeIdx];
    if (!note) return;
    var c   = CHARGING_COLORS[note.color] || CHARGING_COLORS.blue;
    var cat = CHARGING_CATEGORIES[note.category] || CHARGING_CATEGORIES.goal;
    var card = document.getElementById('chargingModeCard');
    if (!card) return;
    card.style.background = c.bg;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'chargingCardIn .4s cubic-bezier(.34,1.56,.64,1)';
    document.getElementById('chargingModeCategory').style.color = '#fff';
    document.getElementById('chargingModeCategory').textContent = cat.emoji + ' ' + cat.label;
    var contentEl = document.getElementById('chargingModeContent');
    var len = (note.content || '').length;
    contentEl.style.fontSize   = len > 380 ? '14px' : len > 220 ? '16px' : '19px';
    contentEl.style.fontWeight = len > 220 ? '700' : '800';
    contentEl.style.lineHeight = len > 220 ? '1.6' : '1.7';
    contentEl.style.color = '#fff';
    contentEl.textContent = note.content;
    document.getElementById('chargingModeDate').style.color = '#fff';
    document.getElementById('chargingModeDate').textContent = 'Ditulis ' + fmtDate(note.created_at);
  }

  // Safe Property Accessors
  try { delete window._chargingNotes; Object.defineProperty(window, '_chargingNotes', { get: function() { return _chargingNotes; }, set: function(v) { _chargingNotes = v; }, configurable: true }); } catch(e) { window._chargingNotes = _chargingNotes; }
  try { delete window._chargingModeIdx; Object.defineProperty(window, '_chargingModeIdx', { get: function() { return _chargingModeIdx; }, set: function(v) { _chargingModeIdx = v; }, configurable: true }); } catch(e) { window._chargingModeIdx = _chargingModeIdx; }

  // Expose public functions to window
  window._chargingHeroQuote = _chargingHeroQuote;
  window.loadCharging = loadCharging;
  window.renderChargingNotes = renderChargingNotes;
  window.bukaFormCharging = bukaFormCharging;
  window._renderChargingColorPicker = _renderChargingColorPicker;
  window._pilihChargingColor = _pilihChargingColor;
  window.simpanChargingNote = simpanChargingNote;
  window.hapusChargingNote = hapusChargingNote;
  window.bukaModeCharging = bukaModeCharging;
  window.tutupModeCharging = tutupModeCharging;
  window.modeChargingNav = modeChargingNav;
  window.modeChargingShuffle = modeChargingShuffle;
  window._renderChargingModeCard = _renderChargingModeCard;
})();
