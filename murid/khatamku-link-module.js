/**
 * murid/khatamku-link-module.js
 * Modul Account Linking KhatamKu — Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var CARD_STYLE = 'background:var(--card-solid);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px';
  var KHATAMKU_URL = 'https://rattililquran.github.io/KhatamKu/';

  function fmtSisaWaktu(expiresAt) {
    if (!expiresAt) return null;
    var ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return null;
    var menit = Math.ceil(ms / 60000);
    return menit + ' menit lagi';
  }

  async function loadKhatamkuLink() {
    var el = document.getElementById('khatamkuLinkContent');
    if (!el) return;
    el.innerHTML = '<div class="empty"><div class="empty-ico">⏳</div><div class="empty-ttl">Memuat...</div></div>';
    try {
      var r = await window.HQ.MuridAPI.getKhatamkuLinkStatus();
      renderKhatamkuLink(el, (r && r.data) || { link: null, progress: null });
    } catch (e) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-ttl">' + esc(friendlyError(e)) + '</div></div>';
    }
  }

  // Simpan data link yg lagi ditampilkan -- dipakai konfirmasiKhatamkuKlik()
  // utk optimistic update (lihat catatan di sana).
  var _khLastLink = null;

  function renderKhatamkuLink(el, data) {
    var link = data.link;
    _khLastLink = link;
    var openBtn = '<button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="window.open(\'' + KHATAMKU_URL + '\',\'_blank\')">↗️ Buka KhatamKu</button>';

    if (link && link.status === 'verified') {
      el.innerHTML = renderTerhubung(link, data.progress) + openBtn;
    } else if (link && link.status === 'pending_confirm') {
      el.innerHTML = renderKonfirmasi(link);
    } else if (link && link.status === 'pending') {
      el.innerHTML = renderKodeManual(link) + openBtn;
    } else {
      el.innerHTML = renderBelumTerhubung() + openBtn;
    }
  }

  function renderBelumTerhubung() {
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-size:32px;text-align:center;margin-bottom:8px">🔗</div>'
      + '<div style="font-weight:800;font-size:15px;text-align:center;margin-bottom:6px">Belum Terhubung</div>'
      + '<div style="color:var(--text-3);font-size:13px;text-align:center;margin-bottom:14px">Hubungkan akun KhatamKu-mu supaya progres bacaan &amp; dzikirmu bisa dilihat di sini.</div>'
      + '<button class="btn" style="width:100%" onclick="window.hubungkanKhatamkuKlik()">🔗 Cek &amp; Hubungkan Akun KhatamKu</button>'
      + '</div>';
  }

  function renderKonfirmasi(link) {
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-size:32px;text-align:center;margin-bottom:8px">🎉</div>'
      + '<div style="font-weight:800;font-size:15px;text-align:center;margin-bottom:6px">Ditemukan Akun KhatamKu-mu</div>'
      + '<div style="text-align:center;margin-bottom:4px"><b>' + esc(link.khatamku_nama || '-') + '</b></div>'
      + '<div style="color:var(--text-3);font-size:12.5px;text-align:center;margin-bottom:14px">@' + esc(link.khatamku_username || '-') + '</div>'
      + '<div style="color:var(--text-2);font-size:13px;text-align:center;margin-bottom:14px">Apakah ini akun kamu?</div>'
      + '<button class="btn" style="width:100%;margin-bottom:8px" onclick="window.konfirmasiKhatamkuKlik()">✅ Ya, ini saya</button>'
      + '<button class="btn btn-outline" style="width:100%" onclick="window.bukanAkunKhatamkuKlik()">❌ Bukan akun saya</button>'
      + '</div>';
  }

  function renderKodeManual(link) {
    var sisa = fmtSisaWaktu(link.link_code_expires);
    if (!sisa) {
      return '<div style="' + CARD_STYLE + '">'
        + '<div style="font-size:32px;text-align:center;margin-bottom:8px">⏱️</div>'
        + '<div style="font-weight:800;font-size:15px;text-align:center;margin-bottom:6px">Kode Sudah Kedaluwarsa</div>'
        + '<button class="btn" style="width:100%;margin-top:6px" onclick="window.hubungkanKhatamkuKlik()">🔄 Minta Kode Baru</button>'
        + '</div>';
    }
    return '<div style="' + CARD_STYLE + '">'
      + '<div style="font-weight:800;font-size:15px;text-align:center;margin-bottom:10px">Masukkan Kode Ini di KhatamKu</div>'
      + '<div style="font-size:32px;font-weight:800;letter-spacing:4px;text-align:center;background:var(--bg-2);border-radius:10px;padding:14px;margin-bottom:10px">' + esc(link.link_code) + '</div>'
      + '<div style="color:var(--text-3);font-size:12px;text-align:center;margin-bottom:14px">Berlaku ' + sisa + '</div>'
      + '<div style="color:var(--text-2);font-size:13px;text-align:center;background:var(--bg-2);border-radius:10px;padding:10px">Buka KhatamKu → cari menu <b>"Hubungkan ke Portal Rattil"</b> → masukkan kode ini.<br><span style="color:var(--text-3);font-size:11.5px">(Fitur ini di KhatamKu masih disiapkan, menyusul.)</span></div>'
      + '</div>';
  }

  function renderTerhubung(link, progress) {
    var html = '<div style="' + CARD_STYLE + '">'
      + '<div style="font-size:32px;text-align:center;margin-bottom:8px">✅</div>'
      + '<div style="font-weight:800;font-size:15px;text-align:center;margin-bottom:6px">Terhubung ke KhatamKu</div>'
      + '<div style="text-align:center;color:var(--text-2);font-size:13px;margin-bottom:14px">' + esc(link.khatamku_nama || link.khatamku_username || '-') + '</div>';

    if (progress) {
      html += '<div style="display:flex;gap:10px;text-align:center">'
        + statBox('Halaman', progress.last_page_read)
        + statBox('Streak', progress.streak_days != null ? progress.streak_days + ' hari' : null)
        + statBox('Khatam', progress.total_khatam)
        + '</div>';
    } else {
      html += '<div style="color:var(--text-3);font-size:12.5px;text-align:center;background:var(--bg-2);border-radius:10px;padding:10px">Data progres akan muncul di sini setelah sinkronisasi pertama.</div>';
    }
    html += '</div>';
    return html;
  }

  // Dipakai jg oleh khatamku-popup-module.js (window._khStatBox, di-expose di
  // bawah) -- bug hunt #5: dulu ada 2 salinan nyaris identik, disatukan di sini.
  function statBox(label, value) {
    return '<div style="flex:1;background:var(--bg-2);border-radius:10px;padding:10px 6px;text-align:center">'
      + '<div style="font-size:16px;font-weight:800;color:var(--text-2)">' + (value !== null && value !== undefined ? value : '-') + '</div>'
      + '<div style="font-size:10.5px;color:var(--text-3)">' + esc(label) + '</div>'
      + '</div>';
  }

  // Cegah kirim ganda -- dilaporkan user (2026-08-27): tap "Ya, ini saya"
  // terasa tak ada respons (loading polos, tak ada teks penenang), jadi user
  // tap berkali-kali. Guard ini + teks "mohon tunggu" di bawah menangani
  // gejalanya; fix akar di khatamku-link-confirm/index.ts bikin tap ganda
  // aman (idempotent) apa pun yang terjadi.
  var _khBusy = false;
  var TUNGGU_HTML = '<div class="empty"><div class="empty-ico">⏳</div><div class="empty-ttl">%JUDUL%</div>'
    + '<div style="color:var(--text-3);font-size:12px;margin-top:6px">Mohon tunggu, jangan tutup halaman ini.</div></div>';

  window.hubungkanKhatamkuKlik = async function() {
    if (_khBusy) return;
    _khBusy = true;
    var el = document.getElementById('khatamkuLinkContent');
    if (el) el.innerHTML = TUNGGU_HTML.replace('%JUDUL%', 'Menghubungi KhatamKu...');
    try {
      await window.HQ.MuridAPI.hubungkanKhatamku();
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
    _khBusy = false;
    loadKhatamkuLink();
  };

  window.konfirmasiKhatamkuKlik = async function() {
    if (_khBusy) return;
    _khBusy = true;
    var el = document.getElementById('khatamkuLinkContent');
    if (el) el.innerHTML = TUNGGU_HTML.replace('%JUDUL%', 'Menyimpan...');
    try {
      await window.HQ.MuridAPI.konfirmasiKhatamku();
      toast('Berhasil terhubung ke KhatamKu!', 'ok');
      // Optimistic: render status verified LANGSUNG pakai data yg sudah ada
      // (nama/username dari kartu konfirmasi tadi), TIDAK gantung ke
      // loadKhatamkuLink() di bawah berhasil & sempat repaint duluan --
      // dilaporkan user (2026-08-27): setelah popup "Berhasil terhubung",
      // kartu di baliknya masih kartu konfirmasi lama, bikin bingung.
      if (el && _khLastLink) {
        renderKhatamkuLink(el, { link: Object.assign({}, _khLastLink, { status: 'verified' }), progress: null });
      }
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
    _khBusy = false;
    loadKhatamkuLink(); // refresh di belakang layar (utk data progress kalau sudah ada)
  };

  window.bukanAkunKhatamkuKlik = function() {
    toast('Fitur ganti akun manual menyusul. Hubungi admin kalau ini keliru.', 'warn');
  };

  window.loadKhatamkuLink = loadKhatamkuLink;
  window._khStatBox = statBox;
})();
