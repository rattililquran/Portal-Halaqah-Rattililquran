// ══════════════════════════════════════════════════════════════
//  Rattil Portal — Shared Utilities (Core Helpers)
//  Created to prevent logic leaks and ReferenceErrors across modules
// ══════════════════════════════════════════════════════════════

(function() {
  const Utils = {
    // ── NOTIF CENTER (ganti toast) ──
    toast: function(msg, type='') {
      const icons = { ok:'✅', err:'❌', warn:'⚠️', '':'ℹ️' };
      const titles = { ok:'Berhasil', err:'Gagal', warn:'Perhatian', '':'Info' };
      const overlay = document.getElementById('notifOverlay');
      const btn     = document.getElementById('notifBtn');

      if (!overlay || !btn) {
        alert((titles[type] || 'Info') + ': ' + msg);
        return;
      }

      document.getElementById('notifIcon').textContent  = icons[type]  || 'ℹ️';
      document.getElementById('notifTitle').textContent = titles[type] || 'Info';
      document.getElementById('notifMsg').textContent   = msg;

      btn.className = 'notif-btn ' + (type || 'info');
      btn.textContent = type === 'err' ? 'Tutup' : type === 'warn' ? 'Mengerti' : 'OK';

      overlay.classList.add('show');
    },

    closeNotif: function() {
      var overlay = document.getElementById('notifOverlay');
      if (overlay) overlay.classList.remove('show');
    },

    // Untuk pesan cepat yang tidak perlu klik (info ringan)
    quickToast: (function() {
      let _quickTimer;
      return function(msg, type='ok') {
        let el = document.getElementById('quickToast');
        if (!el) {
          el = document.createElement('div');
          el.id = 'quickToast';
          el.style.cssText = `position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+20px);
            left:50%;transform:translateX(-50%) translateY(60px);
            background:#0f172a;color:#fff;padding:10px 20px;border-radius:100px;
            font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.25);
            opacity:0;transition:all .25s;z-index:650;white-space:nowrap;
            max-width:calc(100vw - 40px);text-align:center`;
          document.body.appendChild(el);
        }
        const bg = {ok:'#1D9E75', err:'#e05a2a', warn:'#e0aa2a'}[type] || '#0f172a';
        el.style.background = bg;
        el.style.color = type==='warn' ? '#3d2800' : '#fff';
        el.textContent = msg;
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(_quickTimer);
        _quickTimer = setTimeout(function() {
          el.style.opacity = '0';
          el.style.transform = 'translateX(-50%) translateY(60px)';
        }, 2500);
      };
    })(),

    showLoad: function(msg='Bismillah...') {
      var loaderTxt = document.getElementById('loaderTxt');
      var loader = document.getElementById('loader');
      if (loaderTxt) loaderTxt.textContent = msg;
      if (loader) loader.classList.add('show');
    },

    hideLoad: function() {
      var loader = document.getElementById('loader');
      if (loader) loader.classList.remove('show');
    },

    fmtDate: function(d) {
      if (!d) return '–';
      try {
        var s = String(d);
        var dt;
        // ISO UTC → konversi ke WIB (+7) sebelum format
        if (s.length > 10 && (s.indexOf('T') !== -1 || s.indexOf('Z') !== -1)) {
          dt = new Date(new Date(s).getTime() + 7 * 3600000);
        } else {
          var p = s.substring(0,10).split('-');
          dt = new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
        }
        if (isNaN(dt.getTime())) return s.substring(0,10);
        return dt.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
      } catch(e) { return String(d).substring(0,10); }
    },

    fmtDateTime: function(d) {
      if (!d) return '–';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d).substring(0, 16);
        return dt.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) + ' ' + 
               dt.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
      } catch(e) {
        return String(d).substring(0, 16);
      }
    },

    esc: function(s) {
      return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    // Escape untuk argumen string JS di dalam atribut inline (onclick="fn('...')").
    // esc() saja TIDAK cukup: apostrof lolos dan mematahkan string JS
    // (nama seperti Sa'ad / A'isyah) — sekaligus celah injeksi kode.
    escJs: function(s) {
      return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    },

    friendlyError: function(e) {
      var m = (e && e.message) ? String(e.message) : (typeof e === 'string' ? e : '');
      if (!m) return 'Terjadi kesalahan. Silakan coba lagi.';
      var low = m.toLowerCase();
      if (low.indexOf('failed to fetch') >= 0 || low.indexOf('networkerror') >= 0 ||
          low.indexOf('network request failed') >= 0 || low.indexOf('load failed') >= 0)
        return 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';
      if (low.indexOf('jwt expired') >= 0 || low.indexOf('invalid jwt') >= 0 || low.indexOf('jwt signature') >= 0)
        return 'Sesi masuk Anda telah berakhir. Silakan logout lalu login kembali.';
      return m;
    },

    validateFields: function(fields) {
      var ok = true;
      fields.forEach(function(f) {
        var el = document.getElementById(f.id);
        if (!el) return;
        el.classList.remove('field-error');
        var isEmpty = !el.value || !el.value.trim();
        if (isEmpty) {
          el.classList.add('field-error');
          setTimeout(function(){ el.classList.remove('field-error'); }, 800);
          ok = false;
        }
      });
      if (!ok) {
        var missing = fields.filter(function(f){
          var el = document.getElementById(f.id);
          return el && (!el.value || !el.value.trim());
        }).map(function(f){ return f.label; });
        Utils.toast('Field wajib belum diisi: ' + missing.join(', '), 'err');
      }
      return ok;
    }
  };

  // Expose ke window
  window.HQ = window.HQ || {};
  window.HQ.Utils = Utils;

  // Pasang alias legacy ke global window agar kode lama tidak pecah
  window.toast = Utils.toast;
  window.closeNotif = Utils.closeNotif;
  window.quickToast = Utils.quickToast;
  window.showLoad = Utils.showLoad;
  window.hideLoad = Utils.hideLoad;
  window.fmtDate = Utils.fmtDate;
  window.fmtDateTime = Utils.fmtDateTime;
  window.esc = Utils.esc;
  window.escJs = Utils.escJs;
  window.friendlyError = Utils.friendlyError;
  window.validateFields = Utils.validateFields;
})();
