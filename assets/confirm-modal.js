// ============================================================
//  Modal konfirmasi/alert custom — pengganti window.confirm()/window.alert()
//  Dipakai bersama oleh guru/index.html dan admin/index.html.
//  Markup di-inject otomatis ke <body> saat script ini dimuat.
// ============================================================
(function () {
  var html =
    '<div class="overlay" id="confirmModalOverlay" style="z-index:10010">' +
      '<div class="modal" style="max-width:440px">' +
        '<div class="modal-head">' +
          '<div class="modal-title" id="confirmModalTitle">Konfirmasi</div>' +
        '</div>' +
        '<div class="modal-body" id="confirmModalBody" style="font-size:13.5px;line-height:1.7;color:var(--text-2)"></div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-ghost" id="confirmModalCancel">Batal</button>' +
          '<button class="btn btn-primary" id="confirmModalOk">Oke</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function inject() {
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  // Konfirmasi yang sedang menunggu jawaban user (untuk guard re-entrancy).
  var _pending = null;

  // Resolve:
  //   true  → tombol "Oke" diklik
  //   false → tombol "Batal" diklik (aksi batal yang DISENGAJA)
  //   null  → ditutup tanpa memilih (klik luar / Esc / didahului dialog lain)
  // Sebagian besar pemanggil cukup pakai `if (!hasil)` (null & false sama-sama
  // falsy). Pemanggil yang perlu bedakan "batal disengaja" vs "sekadar ditutup"
  // bisa cek `hasil === false`.
  window.showConfirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay   = document.getElementById('confirmModalOverlay');
      var titleEl   = document.getElementById('confirmModalTitle');
      var bodyEl    = document.getElementById('confirmModalBody');
      var okBtn     = document.getElementById('confirmModalOk');
      var cancelBtn = document.getElementById('confirmModalCancel');

      // Kalau ada dialog sebelumnya yang masih menunggu, tutup dulu (resolve null
      // — "ditutup tanpa memilih") sebelum dialog baru dibuka, cegah listener menumpuk.
      if (_pending) _pending();

      titleEl.textContent = opts.title || 'Konfirmasi';
      bodyEl.innerHTML = opts.html || esc(message || '').replace(/\n/g, '<br>');
      okBtn.textContent = opts.okText || 'Oke';
      okBtn.className = 'btn ' + (opts.danger ? 'btn-red' : 'btn-primary');
      cancelBtn.style.display = opts.alertOnly ? 'none' : '';
      cancelBtn.textContent = opts.cancelText || 'Batal';

      function cleanup(result) {
        overlay.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        _pending = null;
        resolve(result);
      }
      function onOk()     { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlay(e) { if (e.target === overlay && !opts.alertOnly) cleanup(null); }
      function onKey(e) {
        if (e.key !== 'Escape') return;
        cleanup(opts.alertOnly ? true : null);
      }

      // Didahului dialog lain → dianggap "ditutup tanpa memilih", bukan batal.
      _pending = function () { cleanup(null); };
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
      overlay.classList.add('open');
    });
  };

  // Modal alert custom — pengganti window.alert(). Hanya tombol "Oke".
  window.showAlertModal = function (message, opts) {
    return window.showConfirm(message, Object.assign({ alertOnly: true, okText: 'Oke' }, opts || {}));
  };
})();
