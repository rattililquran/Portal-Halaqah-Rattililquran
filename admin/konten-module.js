// ============================================================
//  Portal Admin — Konten, Pengumuman, Push, & Materi Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Pengumuman, Push Notifications, Target Level, At-Tibyan, & Materi Level ---

// ── Pengumuman Onboarding (admin editor) ─────────────────────
function onObCtaChange(v) {
  var wrap = document.getElementById('obCtaLabelWrap');
  if (wrap) wrap.style.display = v ? '' : 'none';
}
async function loadOnboarding() {
  try {
    var r = await window.HQ.AdminAPI.getOnboarding();
    var c = r.data || {};
    document.getElementById('obEnabled').checked   = !!c.enabled;
    document.getElementById('obJudul').value       = c.judul || '';
    document.getElementById('obPesan').value       = c.pesan || '';
    document.getElementById('obTarget').value      = c.target_role || 'murid';
    document.getElementById('obCtaAction').value   = c.cta_action || '';
    document.getElementById('obCtaLabel').value    = c.cta_label || '';
    document.getElementById('obOnlyUnsub').checked = !!c.only_unsubscribed;
    onObCtaChange(c.cta_action || '');
  } catch(e) { console.warn('loadOnboarding:', e); }
}
function _obReadForm() {
  return {
    enabled    : document.getElementById('obEnabled').checked,
    judul      : document.getElementById('obJudul').value.trim(),
    pesan      : document.getElementById('obPesan').value.trim(),
    target_role: document.getElementById('obTarget').value,
    cta_action : document.getElementById('obCtaAction').value,
    cta_label  : document.getElementById('obCtaAction').value ? document.getElementById('obCtaLabel').value.trim() : '',
    only_unsubscribed: document.getElementById('obOnlyUnsub').checked,
  };
}
async function saveOnboarding() {
  var cfg = _obReadForm();
  if (cfg.enabled && (!cfg.judul || !cfg.pesan)) { toast('Judul & pesan wajib diisi saat aktif.', 'err'); return; }
  if (cfg.cta_action && !cfg.cta_label) { toast('Isi teks tombol, atau pilih "Tanpa tombol aksi".', 'err'); return; }
  try {
    await window.HQ.AdminAPI.saveOnboarding(cfg);
    toast('💾 Pengumuman onboarding tersimpan' + (cfg.enabled ? ' & aktif' : ''), 'ok');
  } catch(e) { toast(friendlyError(e), 'err'); }
}
function previewOnboarding() {
  var cfg = _obReadForm();
  if (!cfg.judul && !cfg.pesan) { toast('Isi judul/pesan dulu untuk pratinjau.', 'err'); return; }
  if (typeof window.renderOnboardingPopup === 'function') {
    window.renderOnboardingPopup(cfg, 'admin', true); // preview = abaikan status "sudah dilihat"
  } else { toast('Pratinjau tidak tersedia.', 'err'); }
}

var PUSH_CONFIG_META = {
  kbm_h1          : { group:'Terjadwal', waktu:'Setiap hari 20:00 WIB', target:'Murid + Guru' },
  attibyan_h1      : { group:'Terjadwal', waktu:'Sabtu 19:30 WIB',       target:'Semua Murid' },
  attibyan_30min   : { group:'Terjadwal', waktu:'Ahad 19:00 WIB',         target:'Semua Murid' },
  pr_deadline      : { group:'Terjadwal', waktu:'Setiap hari 08:00 WIB', target:'Murid' },
  guru_kbm_today   : { group:'Terjadwal', waktu:'Setiap hari 08:00 WIB', target:'Guru' },
  admin_digest     : { group:'Terjadwal', waktu:'Setiap hari 21:00 WIB', target:'Admin' },
  spp_reminder     : { group:'Terjadwal', waktu:'Setiap tanggal 25 08:00 WIB', target:'Murid Belum Bayar' },
  reminder_guru_followup: { group:'Terjadwal', waktu:'Setiap hari 08:00 WIB', target:'Guru' },
  reminder_ketua_observasi: { group:'Terjadwal', waktu:'Setiap hari 08:00 WIB', target:'Ketua Kelas' },
  dzikir_pagi      : { group:'Terjadwal', waktu:'Setiap hari 05:15 WIB', target:'Semua Pengguna' },
  dzikir_sore      : { group:'Terjadwal', waktu:'Setiap hari 15:30 WIB', target:'Semua Pengguna' },
  kbm_absen        : { group:'Real-time', waktu:'Saat guru tutup sesi KBM',  target:'Murid yang Alpa' },
  pengumuman       : { group:'Real-time', waktu:'Saat pengumuman dikirim', target:'Murid + Guru' },
  raport_published : { group:'Real-time', waktu:'Saat raport dipublish',  target:'Murid' },
  spp_validasi     : { group:'Real-time', waktu:'Saat SPP divalidasi',    target:'Murid' },
  observasi_terbuka: { group:'Real-time', waktu:'Saat sesi KBM selesai',  target:'Ketua Kelas' },
};

function renderPushConfig(configs) {
  var el = document.getElementById('pushConfigList');
  if (!configs.length) { el.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:12px 0">Tidak ada konfigurasi.</div>'; return; }

  var groups = { 'Terjadwal': [], 'Real-time': [] };
  configs.forEach(function(c) {
    var meta = PUSH_CONFIG_META[c.key] || { group:'Lainnya', waktu:'-', target:'-' };
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push(Object.assign({}, c, meta));
  });

  var GROUP_ICON = { 'Terjadwal':'⏰', 'Real-time':'⚡' };
  var GROUP_COLOR = { 'Terjadwal':'var(--blue)', 'Real-time':'var(--green)' };

  el.innerHTML = Object.keys(groups).map(function(gName) {
    var items = groups[gName];
    if (!items.length) return '';
    return '<div style="margin-bottom:8px">'
      + '<div style="font-size:10px;font-weight:800;color:'+GROUP_COLOR[gName]+';text-transform:uppercase;letter-spacing:.1em;padding:10px 0 6px;display:flex;align-items:center;gap:6px">'
      + '<span>'+GROUP_ICON[gName]+'</span><span>'+gName+'</span></div>'
      + items.map(function(c) {
          var isOn = c.enabled;
          return '<div class="push-cfg-row" data-key="'+c.key+'" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;margin-bottom:4px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);transition:background .15s">'
            + '<div style="font-size:20px;width:28px;text-align:center;flex-shrink:0">' + (c.icon||'🔔') + '</div>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:13px;font-weight:700;color:var(--text)">' + esc(c.label) + '</div>'
            +   '<div style="font-size:11px;color:var(--text-3);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">'
            +     '<span>🕐 ' + esc(c.waktu) + '</span>'
            +     '<span>👤 ' + esc(c.target) + '</span>'
            +   '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
            +   '<span style="font-size:11px;font-weight:700;color:'+(isOn?'var(--green)':'var(--text-3)')+'">' + (isOn?'Aktif':'Nonaktif') + '</span>'
            +   '<button onclick="togglePushConfig(\''+c.key+'\','+(!isOn)+')" title="'+(isOn?'Nonaktifkan':'Aktifkan')+'" '
            +     'style="width:44px;height:24px;border-radius:24px;border:none;cursor:pointer;position:relative;transition:background .2s;background:'+(isOn?'var(--green)':'#cbd5e1')+'">'
            +     '<span style="position:absolute;width:18px;height:18px;background:#fff;border-radius:50%;top:3px;transition:left .2s;left:'+(isOn?'23px':'3px')+'"></span>'
            +   '</button>'
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
  }).join('');
}

async function togglePushConfig(key, enabled) {
  // Update visual langsung sebelum API call
  var row = document.querySelector('.push-cfg-row[data-key="'+key+'"]');
  if (row) {
    var btn   = row.querySelector('button');
    var label = btn ? btn.previousElementSibling : null;
    var dot   = btn ? btn.querySelector('span') : null;
    if (btn)   btn.style.background = enabled ? 'var(--green)' : '#cbd5e1';
    if (dot)   dot.style.left       = enabled ? '23px' : '3px';
    if (label) { label.textContent = enabled ? 'Aktif' : 'Nonaktif'; label.style.color = enabled ? 'var(--green)' : 'var(--text-3)'; }
  }
  try {
    await window.HQ.AdminAPI.updatePushConfig(key, enabled);
    toast((enabled ? '✅ Diaktifkan' : '⛔ Dinonaktifkan') + ': ' + key.replace(/_/g,' '), 'ok');
  } catch(e) {
    // Revert visual jika gagal
    var btn2  = row && row.querySelector('button');
    var dot2  = btn2 && btn2.querySelector('span');
    var lbl2  = btn2 && btn2.previousElementSibling;
    if (btn2)  btn2.style.background = !enabled ? 'var(--green)' : '#cbd5e1';
    if (dot2)  dot2.style.left       = !enabled ? '23px' : '3px';
    if (lbl2)  { lbl2.textContent = !enabled ? 'Aktif' : 'Nonaktif'; }
    toast(friendlyError(e), 'err');
  }
}

// Terjemahkan status code kegagalan push (web-push) jadi sebab manusiawi.
function _pushFailLabel(code) {
  switch (String(code)) {
    case '410':
    case '404': return 'device expired/uninstall (otomatis dibersihkan)';
    case '429': return 'rate-limit push service';
    case '413': return 'payload terlalu besar';
    case '401':
    case '403': return 'VAPID/otorisasi ditolak';
    case '0':   return 'jaringan/timeout';
    default:    return 'error HTTP '+code;
  }
}
// Rangkum push_log.fail_detail (mis. {"410":5,"429":2}) jadi teks tooltip.
function _pushFailSummary(fd) {
  if (!fd || typeof fd !== 'object') return 'Sebab tidak tercatat (broadcast sebelum fitur pelacakan aktif).';
  return Object.keys(fd).map(function(code) {
    return fd[code]+' device — '+_pushFailLabel(code);
  }).join('\n');
}

function renderPushLog(logs) {
  var tbody = document.getElementById('pushLogTbl');
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada log.</td></tr>'; return; }
  tbody.innerHTML = logs.map(function(l) {
    var d = new Date(l.created_at);
    var waktu = d.toLocaleDateString('id')+' '+d.toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
    var gagalCell = l.failed_count
      ? '<span title="'+esc(_pushFailSummary(l.fail_detail))+'" style="color:var(--red);cursor:help;border-bottom:1px dotted var(--red)">'+l.failed_count+'</span>'
      : '<span style="color:var(--text-3)">'+l.failed_count+'</span>';
    return '<tr><td style="font-size:12px;white-space:nowrap">'+waktu+'</td>'
      + '<td><code style="font-size:11px;background:var(--bg-2);padding:2px 6px;border-radius:4px">'+esc(l.trigger_type)+'</code></td>'
      + '<td style="font-size:12px">'+(l.target_role||'spesifik')+'</td>'
      + '<td><span style="color:var(--green);font-weight:700">'+l.sent_count+'</span></td>'
      + '<td>'+gagalCell+'</td></tr>';
  }).join('');
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'pushTestTarget') {
    var show = e.target.value === 'user_id';
    document.getElementById('pushTestUserIdWrap').style.display = show ? '' : 'none';
  }
});

// ── Subscriber management ──────────────────────
var _pushSubsData = [];

async function loadPushSubscribers() {
  var tbody = document.getElementById('pushSubsTbl');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-3)">Memuat...</td></tr>';
  try {
    var r = await window.HQ.AdminAPI.getPushSubscribers();
    _pushSubsData = r.data || [];
    renderPushSubscribers(_pushSubsData);
  } catch(e) { toast(friendlyError(e), 'err'); }
}

function renderPushSubscribers(subs) {
  var tbody = document.getElementById('pushSubsTbl');
  if (!subs.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada subscriber.</td></tr>'; return; }
  var ROLE_BADGE = { murid:'<span class="badge b-blue">Murid</span>', guru:'<span class="badge b-green">Guru</span>', admin:'<span class="badge b-amber">Admin</span>' };
  var DEVICE_ICO = { android:'📱', ios:'🍎', desktop:'💻' };
  tbody.innerHTML = subs.map(function(s) {
    var d = new Date(s.created_at);
    var tgl = d.toLocaleDateString('id') + ' ' + d.toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
    return '<tr>'
      + '<td style="font-weight:700;font-size:13px">' + esc(s.nama||s.id_user) + '</td>'
      + '<td style="font-size:11.5px;color:var(--text-3)">' + esc(s.id_user) + '</td>'
      + '<td>' + (ROLE_BADGE[s.role]||s.role) + '</td>'
      + '<td style="font-size:13px">' + (DEVICE_ICO[s.device_hint]||'❓') + ' ' + esc(s.device_hint||'-') + '</td>'
      + '<td style="font-size:12px;color:var(--text-3)">' + tgl + '</td>'
      + '<td style="text-align:center"><button class="btn btn-red btn-sm" onclick="hapusPushSubscriber(\''+s.id+'\')" title="Hapus subscription ini">🗑</button></td>'
      + '</tr>';
  }).join('');
}

async function hapusPushSubscriber(id) {
  toast('Hapus subscription device ini? User perlu aktifkan ulang notifikasi.', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Hapus';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try {
      await window.HQ.AdminAPI.deletePushSubscriber(id);
      toast('Subscription dihapus','ok');
      loadPushSubscribers();
      loadPushAdmin(); // refresh stats
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}

// ── Target halaqah / level ──────────────────────
var _pushHalaqahList = [];
var _pushLevelList   = [];

async function loadPushTargetOptions() {
  try {
    var [hRes, lRes] = await Promise.all([
      window.HQ.AdminAPI.getHalaqahForPush(),
      window.HQ.AdminAPI.getLevelForPush(),
    ]);
    _pushHalaqahList = hRes.data || [];
    _pushLevelList   = lRes.data || [];
    var optH = document.getElementById('pushOptHalaqah');
    var optL = document.getElementById('pushOptLevel');
    if (optH) optH.innerHTML = _pushHalaqahList.map(function(h){
      return '<option value="halaqah_'+h.id_halaqah+'">🏠 '+esc(h.nama_halaqah)+' ('+esc(h.level||'-')+')</option>';
    }).join('');
    if (optL) optL.innerHTML = _pushLevelList.map(function(l){
      return '<option value="level_'+l+'">📚 Level: '+esc(l)+'</option>';
    }).join('');
  } catch(e) { console.warn('loadPushTargetOptions:', e); }
}

function onPushTargetChange(val) {
  var wrap = document.getElementById('pushTestUserIdWrap');
  if (wrap) wrap.style.display = val === 'user_id' ? '' : 'none';
}

function onPushUrlPresetChange(val) {
  var wrap = document.getElementById('pushTestUrlCustomWrap');
  if (wrap) wrap.style.display = val === 'custom' ? '' : 'none';
}

function getPushTestUrl() {
  var preset = document.getElementById('pushTestUrlPreset');
  if (!preset) return '/Portal-Halaqah-Rattililquran/murid/index.html';
  if (preset.value === 'custom') {
    var custom = document.getElementById('pushTestUrlCustom');
    var val = custom ? custom.value.trim() : '';
    if (!val) return '/Portal-Halaqah-Rattililquran/murid/index.html';
    // Validasi: hanya HTTPS yang diizinkan (blokir HTTP dan javascript:)
    try {
      if (val.startsWith('http')) {
        var u = new URL(val);
        if (u.protocol !== 'https:') {
          toast('Hanya URL HTTPS yang diizinkan', 'err');
          return null;
        }
        return val; // Zoom, YouTube, dll diizinkan
      }
      // Path relatif — tambah base jika belum ada
      return val.startsWith('/Portal-Halaqah-Rattililquran') ? val
        : '/Portal-Halaqah-Rattililquran' + (val.startsWith('/') ? val : '/' + val);
    } catch (_) {
      toast('URL tidak valid', 'err');
      return null;
    }
  }
  return preset.value;
}

async function setAllPushConfig(enabled) {
  var rows = Array.from(document.querySelectorAll('.push-cfg-row'));
  var promises = rows.map(function(row) {
    var key = row.dataset.key;
    return key ? togglePushConfig(key, enabled) : Promise.resolve();
  });
  await Promise.allSettled(promises);
  toast(enabled ? '✅ Semua notifikasi diaktifkan' : '⛔ Semua notifikasi dinonaktifkan', 'ok');
}

async function kirimTestPush() {
  var target = document.getElementById('pushTestTarget').value;
  var title  = document.getElementById('pushTestTitle').value.trim();
  var bodyEl = document.getElementById('pushTestBody');
  var body   = (bodyEl.tagName === 'TEXTAREA' ? bodyEl.value : bodyEl.value || '').trim();
  if (!title || !body) return toast('Isi judul dan pesan','err');
  var btn = document.getElementById('btnTestPush');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    var pushUrl = getPushTestUrl();
    if (pushUrl === null) { btn.disabled=false; btn.textContent='📤 Kirim Sekarang'; return; }
    var opts = { title, body, url: pushUrl, tag: 'admin-kirim' };
    if (target === 'user_id') {
      var uid = document.getElementById('pushTestUserId').value.trim();
      if (!uid) return toast('Isi User ID terlebih dahulu','err');
      opts.user_ids = [uid];
    } else if (target === 'all') {
      // kirim tanpa filter
    } else if (target.startsWith('role_')) {
      opts.role_filter = target.replace('role_','');
    } else if (target.startsWith('halaqah_')) {
      // kirim ke murid halaqah tertentu
      var hId = target.replace('halaqah_','');
      var ids = await window.HQ.AdminAPI.getPushTargetUserIds({halaqah: hId});
      if (!ids.length) { toast('Tidak ada murid subscribe di halaqah ini','err'); return; }
      opts.user_ids = ids;
    } else if (target.startsWith('level_')) {
      var lv = target.replace('level_','');
      var ids2 = await window.HQ.AdminAPI.getPushTargetUserIds({level: lv});
      if (!ids2.length) { toast('Tidak ada murid subscribe di level ini','err'); return; }
      opts.user_ids = ids2;
    }
    var r = await window.HQ.AdminAPI.testSendPush(opts);
    var res = document.getElementById('pushTestResult');
    res.style.display = '';
    var ok = r.sent > 0;
    res.style.background = ok ? 'var(--green-bg, #f0fdf4)' : (r.total===0 ? 'var(--amber-bg, #fffbeb)' : 'var(--red-bg, #fff5f5)');
    res.style.color = ok ? 'var(--green-txt, #065f46)' : (r.total===0 ? 'var(--amber-txt, #92400e)' : 'var(--red-txt, #991b1b)');
    res.style.border = '1px solid ' + (ok ? 'var(--green, #bbf7d0)' : (r.total===0 ? 'var(--amber, #fde68a)' : 'var(--red, #fecaca)'));
    res.style.borderRadius = '10px';
    res.textContent = ok
      ? '✅ Berhasil dikirim ke ' + r.sent + ' device' + (r.failed ? ' · Gagal: '+r.failed : '')
      : (r.total===0 ? '⚠️ Tidak ada device yang subscribe' : '❌ Gagal: ' + (r.failed||0) + ' dari ' + r.total);
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { btn.disabled=false; btn.textContent='📤 Kirim Test'; }
}

async function jalankanDiagnostik() {
  var el = document.getElementById('pushDiagResult');
  el.style.display = 'block';
  el.textContent = '⏳ Memeriksa...';
  var lines = [];
  var ok = '✅', warn = '⚠️', err = '❌';

  // 1. Browser support
  lines.push('── Browser Support ──');
  lines.push((('serviceWorker' in navigator) ? ok : err) + ' serviceWorker: ' + ('serviceWorker' in navigator));
  lines.push((('PushManager' in window) ? ok : err) + ' PushManager: ' + ('PushManager' in window));
  lines.push((('Notification' in window) ? ok : err) + ' Notification API: ' + ('Notification' in window));
  lines.push(ok + ' Permission: ' + (('Notification' in window) ? Notification.permission : 'N/A'));

  // 2. Service Worker
  lines.push('\n── Service Worker ──');
  try {
    var regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) {
      lines.push(err + ' Tidak ada SW terdaftar');
    } else {
      regs.forEach(function(r, i) {
        var state = r.active ? 'active' : (r.installing ? 'installing' : (r.waiting ? 'waiting' : 'none'));
        var sw = r.active || r.installing || r.waiting;
        lines.push(ok + ' SW[' + i + ']: scope=' + r.scope);
        lines.push('   state=' + state + ' | script=' + (sw ? sw.scriptURL : '-'));
      });
    }
    var ready = await Promise.race([
      navigator.serviceWorker.ready.then(function(r){ return r; }),
      new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout 3s')); }, 3000); })
    ]);
    lines.push(ok + ' SW ready: ' + ready.scope);
  } catch(e) {
    lines.push(err + ' SW ready error: ' + e.message);
  }

  // 3. Push Manager
  lines.push('\n── Push Manager ──');
  try {
    var reg = await navigator.serviceWorker.ready;
    var state = await reg.pushManager.permissionState({ userVisibleOnly: true });
    lines.push(ok + ' Permission state: ' + state);
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      lines.push(ok + ' Ada subscription aktif:');
      lines.push('   endpoint: ' + sub.endpoint.slice(0, 60) + '...');
    } else {
      lines.push(warn + ' Tidak ada subscription aktif');
      lines.push('   → Klik "Ya, Aktifkan Notifikasi" di dialog izin');
    }
  } catch(e) {
    lines.push(err + ' Push Manager error: ' + e.message);
  }

  // 4. VAPID Key
  lines.push('\n── VAPID Key ──');
  var vk = (typeof VAPID_PUBLIC_KEY !== 'undefined') ? VAPID_PUBLIC_KEY : 'UNDEFINED';
  lines.push((vk !== 'UNDEFINED' && vk.length > 10 ? ok : err) + ' VAPID_PUBLIC_KEY: ' + vk.slice(0,20) + '...' + ' (len=' + vk.length + ')');

  // 5. Database subscriptions
  lines.push('\n── Database (push_subscriptions) ──');
  try {
    var dbRes = await window.HQ.AdminAPI.getPushStats();
    var d = dbRes.data;
    lines.push(ok + ' Total: ' + d.total + ' | Murid: ' + d.murid + ' | Guru: ' + d.guru + ' | Admin: ' + d.admin);
  } catch(e) {
    lines.push(err + ' Gagal baca DB: ' + e.message);
  }

  lines.push('\n── Selesai ──');
  el.textContent = lines.join('\n');
}

async function testTrigger(trigger) {
  var res = document.getElementById('pushTriggerResult');
  res.style.display = '';
  res.textContent = '⏳ Menjalankan trigger: ' + trigger + '...';
  try {
    var r = await window.HQ.AdminAPI.testTrigger(trigger);
    res.style.background = r.ok ? 'var(--green-bg, #f0fdf4)' : 'var(--amber-bg, #fef3c7)';
    res.style.color       = r.ok ? 'var(--green-txt, #065f46)' : 'var(--amber-txt, #92400e)';
    res.textContent = r.ok
      ? '✅ Trigger ' + trigger + ' berhasil dijalankan'
      : '⛔ Trigger dinonaktifkan admin: ' + trigger;
  } catch(e) {
    res.style.background = 'var(--red-bg, #fff5f5)'; res.style.color = 'var(--red-txt, #991b1b)';
    res.textContent = '❌ Error: ' + e.message;
  }
}

function _confirmStressCleanup(msg) {
  return showConfirm(msg, { title: 'Stress Test Cleanup', okText: 'Ya, Hapus', danger: true });
}

// ══════════════════════════════════════════
//  STRESS TEST KBM
// ══════════════════════════════════════════
async function stressTestMulai() {
  var btn = document.getElementById('btnStressStart');
  btn.disabled = true; btn.textContent = '⏳ Berjalan...';
  document.getElementById('stResult').style.display = 'none';
  document.getElementById('stProgressWrap').style.display = 'block';

  var sesiCount    = parseInt(document.getElementById('stSesiCount').value) || 3;
  var incSetoran   = document.getElementById('stIncludeSetoran').checked;

  try {
    var hasil = await window.HQ.AdminAPI.stressTestKBM(
      { sesiPerHalaqah: sesiCount, includeSetoran: incSetoran },
      function(pct, label) {
        document.getElementById('stProgressBar').style.width   = pct + '%';
        document.getElementById('stProgressLabel').textContent = label;
      }
    );

    var errHtml = hasil.errors && hasil.errors.length
      ? '<div style="color:#ef4444;font-size:11px;margin-top:8px">⚠ ' + hasil.errors.length + ' error — cek console</div>'
      : '';
    if (hasil.errors && hasil.errors.length) console.warn('[StressTest] Errors:', hasil.errors);

    document.getElementById('stResult').style.display = 'block';
    document.getElementById('stResult').innerHTML = '<div style="background:var(--bg-2);padding:12px;border-radius:8px;font-size:13px">'
      + '<div style="font-weight:700;margin-bottom:8px;color:#22c55e">✅ Stress Test Selesai</div>'
      + '<div>📚 KBM Log: <b>' + hasil.totalKbm + '</b> sesi</div>'
      + '<div>📋 Nilai KBM: <b>' + hasil.totalNilai + '</b> record</div>'
      + (incSetoran ? '<div>📖 Setoran Hafalan: <b>' + hasil.totalSetoran + '</b> record</div>' : '')
      + '<div style="color:var(--text-3);font-size:11px;margin-top:8px">Ditandai [STRESS_TEST] — klik "Hapus Data Test" untuk cleanup</div>'
      + errHtml + '</div>';
  } catch(e) {
    document.getElementById('stResult').style.display = 'block';
    document.getElementById('stResult').innerHTML = '<div style="color:#ef4444;padding:10px;background:var(--bg-2);border-radius:8px;font-size:13px">❌ Error: ' + e.message + '</div>';
  }

  btn.disabled = false; btn.textContent = '⚡ Mulai Stress Test';
}

async function stressTestCleanup() {
  if (!(await _confirmStressCleanup('Hapus semua data [STRESS_TEST] dari kbm_log, nilai_kbm, dan setoran_hafalan?\n\nTidak dapat di-undo.'))) return;
  var btn = document.getElementById('btnStressCleanup');
  btn.disabled = true; btn.textContent = '⏳ Menghapus...';
  try {
    var r = await window.HQ.AdminAPI.cleanupStressTest();
    if (r.status === 'ok') {
      var d = r.deleted || {};
      toast('Terhapus — KBM: ' + (d.kbm||0) + ', Nilai: ' + (d.nilai||0) + ', Setoran: ' + (d.setoran||0), 'ok');
      document.getElementById('stResult').style.display = 'none';
      document.getElementById('stProgressWrap').style.display = 'none';
      document.getElementById('stProgressBar').style.width = '0%';
    } else {
      toast('Error cleanup: ' + (r.errors || []).join(', '), 'error');
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  STRESS TEST REKAP STATUS
// ══════════════════════════════════════════
async function rsStressTestMulai() {
  var btn=document.getElementById('btnRsStressStart'), wrap=document.getElementById('rsStProgressWrap'),
      bar=document.getElementById('rsStProgressBar'), lbl=document.getElementById('rsStProgressLabel'),
      res=document.getElementById('rsStResult');
  btn.disabled=true; btn.textContent='⏳ Berjalan...';
  wrap.style.display='block'; res.style.display='none';
  var sesiPerHalaqah=parseInt(document.getElementById('rsStSesiCount').value)||2;
  try {
    var r=await window.HQ.AdminAPI.stressTestRekapStatus({sesiPerHalaqah},function(pct,msg){bar.style.width=pct+'%';lbl.textContent=msg;});
    if(r.errors&&r.errors.length) console.warn('[ST REKAP] Errors:',r.errors);
    res.style.display='block';
    res.innerHTML='<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      +'<div style="font-weight:600;color:var(--success);margin-bottom:6px">'+(r.status==='ok'?'✅ Selesai':'⚠️ '+r.errors.length+' error')+'</div>'
      +'<div>📚 KBM Log: <b>'+r.totalKbm+'</b></div><div>📋 Rekap Status: <b>'+r.totalRekap+'</b></div>'
      +(r.errors&&r.errors.length?'<div style="color:#ef4444;font-size:11px;margin-top:4px">'+r.errors.slice(0,2).join('<br>')+'</div>':'')
      +'<div style="color:var(--text-3);font-size:11px;margin-top:6px">Ditandai [STRESS_TEST]</div></div>';
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='⚡ Mulai Stress Test';
}
async function rsStressTestCleanup() {
  if(!(await _confirmStressCleanup('Hapus data [STRESS_TEST] dari rekap_status dan kbm_log?'))) return;
  var btn=document.getElementById('btnRsStressCleanup');
  btn.disabled=true; btn.textContent='⏳ Menghapus...';
  try {
    var r=await window.HQ.AdminAPI.cleanupStressTestRekapStatus();
    if(r.status==='ok'){var d=r.deleted||{};toast('Terhapus — Rekap: '+(d.rekap||0)+', KBM: '+(d.kbm||0),'ok');document.getElementById('rsStResult').style.display='none';document.getElementById('rsStProgressWrap').style.display='none';document.getElementById('rsStProgressBar').style.width='0%';}
    else toast('Error: '+(r.errors||[]).join(', '),'error');
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  STRESS TEST PUSH PREFS
// ══════════════════════════════════════════
async function prefsStressTestMulai() {
  var btn=document.getElementById('btnPrefsStressStart'), wrap=document.getElementById('prefsStProgressWrap'),
      bar=document.getElementById('prefsStProgressBar'), lbl=document.getElementById('prefsStProgressLabel'),
      res=document.getElementById('prefsStResult');
  btn.disabled=true; btn.textContent='⏳ Berjalan...';
  wrap.style.display='block'; res.style.display='none';
  try {
    var r=await window.HQ.AdminAPI.stressTestPushPrefs(function(pct,msg){bar.style.width=pct+'%';lbl.textContent=msg;});
    res.style.display='block';
    res.innerHTML='<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      +'<div style="font-weight:600;color:var(--success);margin-bottom:6px">'+(r.status==='ok'?'✅ Selesai':'⚠️ '+r.errors.length+' error')+'</div>'
      +'<div>👤 User diupdate: <b>'+r.totalUsers+'</b></div>'
      +(r.errors&&r.errors.length?'<div style="color:#ef4444;font-size:11px;margin-top:4px">'+r.errors.slice(0,2).join('<br>')+'</div>':'')
      +'<div style="color:var(--text-3);font-size:11px;margin-top:6px">Key <code>_st:true</code> ditambahkan ke prefs — tidak mempengaruhi notifikasi nyata</div></div>';
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='⚡ Mulai Stress Test';
}
async function prefsStressTestCleanup() {
  if(!(await _confirmStressCleanup('Hapus key _st dari semua push_user_prefs?'))) return;
  var btn=document.getElementById('btnPrefsStressCleanup');
  btn.disabled=true; btn.textContent='⏳ Menghapus...';
  try {
    var r=await window.HQ.AdminAPI.cleanupStressTestPushPrefs();
    if(r.status==='ok'){var d=r.deleted||{};toast('Cleaned — '+d.rows+' rows','ok');document.getElementById('prefsStResult').style.display='none';document.getElementById('prefsStProgressWrap').style.display='none';document.getElementById('prefsStProgressBar').style.width='0%';}
    else toast('Error: '+(r.errors||[]).join(', '),'error');
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  COMBINED LOAD TEST
// ══════════════════════════════════════════
async function combStressTestMulai() {
  var btn=document.getElementById('btnCombStressStart'), wrap=document.getElementById('combStProgressWrap'),
      bar=document.getElementById('combStProgressBar'), lbl=document.getElementById('combStProgressLabel'),
      res=document.getElementById('combStResult');
  btn.disabled=true; btn.textContent='⏳ Berjalan...';
  wrap.style.display='block'; res.style.display='none';
  var sesi=parseInt(document.getElementById('combStSesi').value)||2;
  try {
    var r=await window.HQ.AdminAPI.stressTestCombined({sesi},function(pct,msg){bar.style.width=pct+'%';lbl.textContent=msg;});
    var totalErrors=[r.kbm,r.atTibyan,r.observasi,r.rekapStatus,r.users].reduce(function(s,x){return s+((x&&x.errors&&x.errors.length)||0);},0);
    res.style.display='block';
    res.innerHTML='<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      +'<div style="font-weight:600;color:'+(totalErrors?'#f59e0b':'var(--success)')+';margin-bottom:8px">'+(totalErrors?'⚠️ Selesai ('+totalErrors+' error)':'🔥 Combined Load Selesai')+'</div>'
      +'<div>📚 KBM: <b>'+(r.kbm&&r.kbm.totalKbm||0)+'</b> sesi</div>'
      +'<div>📖 At-Tibyan: <b>'+(r.atTibyan&&r.atTibyan.totalSesi||0)+'</b> sesi / <b>'+(r.atTibyan&&r.atTibyan.totalLog||0)+'</b> log</div>'
      +'<div>📋 Observasi: <b>'+(r.observasi&&r.observasi.totalObs||0)+'</b> record</div>'
      +'<div>📝 Rekap Status: <b>'+(r.rekapStatus&&r.rekapStatus.totalRekap||0)+'</b> record</div>'
      +'<div>👤 Users: <b>'+(r.users&&r.users.totalUsers||0)+'</b> murid</div>'
      +'<div style="color:var(--text-3);font-size:11px;margin-top:8px">Semua ditandai [STRESS_TEST] — klik "Cleanup Semua" untuk bersihkan</div></div>';
    if(totalErrors) console.warn('[Combined ST] errors:',r);
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='🔥 Mulai Combined Test';
}
async function combStressTestCleanup() {
  if(!(await _confirmStressCleanup('Cleanup SEMUA data stress test dari seluruh tabel?\n\nTidak dapat di-undo.'))) return;
  var btn=document.getElementById('btnCombStressCleanup');
  btn.disabled=true; btn.textContent='⏳ Cleanup semua...';
  try {
    var r=await window.HQ.AdminAPI.cleanupStressTestCombined();
    toast('Cleanup selesai — semua tabel bersih','ok');
    ['combStResult','combStProgressWrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
    document.getElementById('combStProgressBar').style.width='0%';
  } catch(e){toast('Error: '+e.message,'error');}
  btn.disabled=false; btn.textContent='🗑️ Cleanup Semua';
}

// ══════════════════════════════════════════
//  STRESS TEST USER MANAJEMEN
// ══════════════════════════════════════════
async function usrStressTestMulai() {
  var btn  = document.getElementById('btnUsrStressStart');
  var wrap = document.getElementById('usrStProgressWrap');
  var bar  = document.getElementById('usrStProgressBar');
  var lbl  = document.getElementById('usrStProgressLabel');
  var res  = document.getElementById('usrStResult');
  btn.disabled = true; btn.textContent = '⏳ Berjalan...';
  wrap.style.display = 'block'; res.style.display = 'none';
  var muridPerHalaqah = parseInt(document.getElementById('usrStCount').value) || 3;
  try {
    var r = await window.HQ.AdminAPI.stressTestUsers(
      { muridPerHalaqah },
      function(pct, msg) { bar.style.width = pct + '%'; lbl.textContent = msg; }
    );
    if (r.errors && r.errors.length) console.warn('[StressTest USR] Errors:', r.errors);
    res.style.display = 'block';
    res.innerHTML = '<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      + '<div style="font-weight:600;color:var(--success);margin-bottom:6px">'
      + (r.status === 'ok' ? '✅ Stress Test Selesai' : '⚠️ Selesai dengan ' + r.errors.length + ' error') + '</div>'
      + '<div>👤 User Murid: <b>' + r.totalUsers + '</b></div>'
      + '<div>📋 Anggota: <b>' + r.totalAnggota + '</b></div>'
      + (r.errors && r.errors.length ? '<div style="color:#ef4444;font-size:11px;margin-top:6px">' + r.errors.slice(0,3).join('<br>') + '</div>' : '')
      + '<div style="color:var(--text-3);font-size:11px;margin-top:8px">Ditandai [STRESS_TEST] di kolom catatan — klik "Hapus Data Test" untuk cleanup</div>'
      + '</div>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '⚡ Mulai Stress Test';
}

async function usrStressTestCleanup() {
  if (!(await _confirmStressCleanup('Hapus semua user [STRESS_TEST] dari users dan anggota?\n\nTidak dapat di-undo.'))) return;
  var btn = document.getElementById('btnUsrStressCleanup');
  btn.disabled = true; btn.textContent = '⏳ Menghapus...';
  try {
    var r = await window.HQ.AdminAPI.cleanupStressTestUsers();
    if (r.status === 'ok') {
      var d = r.deleted || {};
      toast('Terhapus — User: ' + (d.users||0) + ', Anggota: ' + (d.anggota||0), 'ok');
      document.getElementById('usrStResult').style.display = 'none';
      document.getElementById('usrStProgressWrap').style.display = 'none';
      document.getElementById('usrStProgressBar').style.width = '0%';
    } else {
      toast('Error cleanup: ' + (r.errors || []).join(', '), 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  STRESS TEST OBSERVASI KBM
// ══════════════════════════════════════════
async function obsStressTestMulai() {
  var btn  = document.getElementById('btnObsStressStart');
  var wrap = document.getElementById('obsStProgressWrap');
  var bar  = document.getElementById('obsStProgressBar');
  var lbl  = document.getElementById('obsStProgressLabel');
  var res  = document.getElementById('obsStResult');
  btn.disabled = true; btn.textContent = '⏳ Berjalan...';
  wrap.style.display = 'block'; res.style.display = 'none';
  var sesiPerHalaqah = parseInt(document.getElementById('obsStSesiCount').value) || 2;
  try {
    var r = await window.HQ.AdminAPI.stressTestObservasi(
      { sesiPerHalaqah },
      function(pct, msg) { bar.style.width = pct + '%'; lbl.textContent = msg; }
    );
    if (r.errors && r.errors.length) console.warn('[StressTest OBS] Errors:', r.errors);
    res.style.display = 'block';
    res.innerHTML = '<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      + '<div style="font-weight:600;color:var(--success);margin-bottom:6px">'
      + (r.status === 'ok' ? '✅ Stress Test Selesai' : '⚠️ Selesai dengan ' + r.errors.length + ' error') + '</div>'
      + '<div>📚 KBM Log: <b>' + r.totalKbm + '</b> sesi</div>'
      + '<div>📋 Observasi: <b>' + r.totalObs + '</b> record</div>'
      + (r.errors && r.errors.length ? '<div style="color:#ef4444;font-size:11px;margin-top:6px">' + r.errors.slice(0,3).join('<br>') + '</div>' : '')
      + '<div style="color:var(--text-3);font-size:11px;margin-top:8px">Ditandai [STRESS_TEST] — klik "Hapus Data Test" untuk cleanup</div>'
      + '</div>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '⚡ Mulai Stress Test';
}

async function obsStressTestCleanup() {
  if (!(await _confirmStressCleanup('Hapus semua data [STRESS_TEST] dari observasi_kbm dan kbm_log (observasi)?\n\nTidak dapat di-undo.'))) return;
  var btn = document.getElementById('btnObsStressCleanup');
  btn.disabled = true; btn.textContent = '⏳ Menghapus...';
  try {
    var r = await window.HQ.AdminAPI.cleanupStressTestObservasi();
    if (r.status === 'ok') {
      var d = r.deleted || {};
      toast('Terhapus — Observasi: ' + (d.observasi||0) + ', KBM: ' + (d.kbm||0), 'ok');
      document.getElementById('obsStResult').style.display = 'none';
      document.getElementById('obsStProgressWrap').style.display = 'none';
      document.getElementById('obsStProgressBar').style.width = '0%';
    } else {
      toast('Error cleanup: ' + (r.errors || []).join(', '), 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  STRESS TEST AT-TIBYAN
// ══════════════════════════════════════════
async function atStressTestMulai() {
  var btn = document.getElementById('btnAtStressStart');
  var wrap = document.getElementById('atStProgressWrap');
  var bar  = document.getElementById('atStProgressBar');
  var lbl  = document.getElementById('atStProgressLabel');
  var res  = document.getElementById('atStResult');
  btn.disabled = true; btn.textContent = '⏳ Berjalan...';
  wrap.style.display = 'block'; res.style.display = 'none';
  var sesiCount = parseInt(document.getElementById('atStSesiCount').value) || 3;
  try {
    var r = await window.HQ.AdminAPI.stressTestAtTibyan(
      { sesiCount },
      function(pct, msg) { bar.style.width = pct + '%'; lbl.textContent = msg; }
    );
    if (r.errors && r.errors.length) console.warn('[StressTest AT] Errors:', r.errors);
    res.style.display = 'block';
    res.innerHTML = '<div style="background:var(--bg-2);border-radius:8px;padding:12px;font-size:13px">'
      + '<div style="font-weight:600;color:var(--success);margin-bottom:6px">'
      + (r.status === 'ok' ? '✅ Stress Test Selesai' : '⚠️ Selesai dengan ' + r.errors.length + ' error') + '</div>'
      + '<div>📖 Sesi At-Tibyan: <b>' + r.totalSesi + '</b></div>'
      + '<div>👥 Log Presensi: <b>' + r.totalLog + '</b></div>'
      + (r.errors && r.errors.length ? '<div style="color:#ef4444;font-size:11px;margin-top:6px">' + r.errors.slice(0,3).join('<br>') + '</div>' : '')
      + '<div style="color:var(--text-3);font-size:11px;margin-top:8px">Ditandai [STRESS_TEST] — klik "Hapus Data Test" untuk cleanup</div>'
      + '</div>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '⚡ Mulai Stress Test';
}

async function atStressTestCleanup() {
  if (!(await _confirmStressCleanup('Hapus semua data [STRESS_TEST] dari at_tibyan_sesi dan at_tibyan_log?\n\nTidak dapat di-undo.'))) return;
  var btn = document.getElementById('btnAtStressCleanup');
  btn.disabled = true; btn.textContent = '⏳ Menghapus...';
  try {
    var r = await window.HQ.AdminAPI.cleanupStressTestAtTibyan();
    if (r.status === 'ok') {
      var d = r.deleted || {};
      toast('Terhapus — Sesi: ' + (d.sesi||0) + ', Log: ' + (d.log||0), 'ok');
      document.getElementById('atStResult').style.display = 'none';
      document.getElementById('atStProgressWrap').style.display = 'none';
      document.getElementById('atStProgressBar').style.width = '0%';
    } else {
      toast('Error cleanup: ' + (r.errors || []).join(', '), 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.disabled = false; btn.textContent = '🗑️ Hapus Data Test';
}

// ══════════════════════════════════════════
//  MATERI KAJIAN
// ══════════════════════════════════════════
var _atMateriData  = [];
var _lvMateriData  = [];

async function loadMateriAdmin() {
  await Promise.all([ loadAtMateriAdmin(), loadLvMateriAdmin() ]);
}

function switchMateriTab(tab, btn) {
  document.getElementById('mPanelAt').style.display    = tab === 'at'    ? 'block' : 'none';
  document.getElementById('mPanelLevel').style.display = tab === 'level' ? 'block' : 'none';
  document.querySelectorAll('.materi-tab-btn').forEach(function(b) {
    var isActive = b === btn;
    b.style.color       = isActive ? 'var(--blue-d)' : 'var(--text-3)';
    b.style.borderColor = isActive ? 'var(--blue-d)' : 'transparent';
    b.classList.toggle('active', isActive);
  });
}

// ── At-Tibyan ─────────────────────────────────
async function loadAtMateriAdmin() {
  var tbody = document.getElementById('atMateriTbl');
  try {
    var r = await window.HQ.AdminAPI.getAtTibyanMateriAdmin();
    _atMateriData = r.data || [];
    if (!_atMateriData.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada data. Tambah pertemuan pertama.</td></tr>';
      return;
    }
    tbody.innerHTML = _atMateriData.map(function(m) {
      return '<tr>'
        + '<td style="text-align:center;font-weight:800;color:var(--blue-d)">'+esc(m.pertemuan_ke)+'</td>'
        + '<td><div style="font-weight:700">'+esc(m.materi_pembahasan)+'</div>'
        + (m.nasihat_aplikatif ? '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;white-space:normal">'+esc(m.nasihat_aplikatif.substring(0,80))+(m.nasihat_aplikatif.length>80?'...':'')+'</div>' : '')+'</td>'
        + '<td style="font-size:12.5px">'+esc(m.pemateri||'-')+'</td>'
        + '<td style="font-size:12px;white-space:nowrap">'+esc(m.tanggal||'-')+'</td>'
        + '<td><div style="display:flex;gap:6px">'
        + '<button class="btn btn-outline btn-sm" onclick="editAtMateri('+m.id+')">✏️</button>'
        + '<button class="btn btn-red btn-sm" onclick="hapusAtMateri('+m.id+','+m.pertemuan_ke+')">🗑️</button>'
        + '</div></td></tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--red);padding:16px">'+esc(friendlyError(e))+'</td></tr>';
  }
}

function bukaModalAt(data) {
  document.getElementById('atEditId').value      = data ? data.id : '';
  document.getElementById('atEditKe').value      = data ? data.pertemuan_ke : '';
  document.getElementById('atEditTanggal').value = data ? (data.tanggal||'') : '';
  document.getElementById('atEditPemateri').value= data ? (data.pemateri||'') : '';
  document.getElementById('atEditMateri').value  = data ? (data.materi_pembahasan||'') : '';
  document.getElementById('atEditNasihat').value = data ? (data.nasihat_aplikatif||'') : '';
  document.getElementById('modalAtTitle').textContent = data ? 'Edit Pertemuan At-Tibyan ke-'+data.pertemuan_ke : 'Tambah Pertemuan At-Tibyan';
  document.getElementById('modalAtOverlay').style.display = 'flex';
}
function tutupModalAt() { document.getElementById('modalAtOverlay').style.display = 'none'; }

function editAtMateri(id) {
  var m = _atMateriData.find(function(x){ return x.id === id; });
  if (m) bukaModalAt(m);
}

async function hapusAtMateri(id, ke) {
  toast('Hapus pertemuan ke-'+ke+'? Data tidak bisa dikembalikan.', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Hapus';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try {
      await window.HQ.AdminAPI.deleteAtTibyanMateri(id);
      toast('Pertemuan ke-'+ke+' dihapus','ok');
      loadAtMateriAdmin();
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}

async function simpanAtMateri() {
  var id     = document.getElementById('atEditId').value;
  var ke     = parseInt(document.getElementById('atEditKe').value);
  var materi = document.getElementById('atEditMateri').value.trim();
  if (!ke || ke < 1) return toast('Pertemuan ke- wajib diisi','err');
  if (!materi) return toast('Materi pembahasan wajib diisi','err');
  var d = {
    id: id ? parseInt(id) : undefined,
    pertemuan_ke: ke,
    tanggal: document.getElementById('atEditTanggal').value.trim(),
    pemateri: document.getElementById('atEditPemateri').value.trim(),
    materi_pembahasan: materi,
    nasihat_aplikatif: document.getElementById('atEditNasihat').value.trim(),
  };
  try {
    await window.HQ.AdminAPI.upsertAtTibyanMateri(d);
    toast('Pertemuan ke-'+ke+' disimpan','ok');
    tutupModalAt();
    loadAtMateriAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
}

// ── Materi Level ──────────────────────────────
async function loadLvMateriAdmin() {
  var tbody = document.getElementById('levelMateriTbl');
  var sel   = document.getElementById('materiLevelFilter');
  try {
    var r = await window.HQ.AdminAPI.getMateriLevelAdmin();
    _lvMateriData = r.data || [];
    // Populate level filter
    var levels = [...new Set(_lvMateriData.map(function(x){ return x.level; }))].sort();
    sel.innerHTML = '<option value="">— Semua Level —</option>'
      + levels.map(function(lv){ return '<option>'+esc(lv)+'</option>'; }).join('');
    renderMateriLevelAdmin();
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--red);padding:16px">'+esc(friendlyError(e))+'</td></tr>';
  }
}

function renderMateriLevelAdmin() {
  var tbody  = document.getElementById('levelMateriTbl');
  var filter = document.getElementById('materiLevelFilter').value;
  var data   = filter ? _lvMateriData.filter(function(x){ return x.level === filter; }) : _lvMateriData;
  var KAT_COLOR = { Deskripsi:'var(--blue-txt)', Target:'var(--green-txt)', Materi:'var(--purple-txt)', Tips:'var(--amber-txt)', Doa:'var(--blue-txt)' };
  var KAT_BG    = { Deskripsi:'var(--blue-bg)', Target:'var(--green-bg)', Materi:'var(--purple-bg)', Tips:'var(--amber-bg)', Doa:'var(--blue-bg)' };
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada materi. Tambah item pertama.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(m) {
    var col = KAT_COLOR[m.kategori] || 'var(--text-3)';
    var bg  = KAT_BG[m.kategori] || 'var(--bg-2)';
    return '<tr>'
      + '<td style="font-weight:700;white-space:nowrap">'+esc(m.level)+'</td>'
      + '<td><span style="font-size:11px;font-weight:700;color:'+col+';background:'+bg+';padding:2px 8px;border-radius:100px">'+esc(m.kategori)+'</span></td>'
      + '<td><div style="font-weight:700">'+esc(m.judul)+'</div>'
      + '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;white-space:normal">'+esc((m.isi||'').substring(0,70))+((m.isi||'').length>70?'...':'')+'</div></td>'
      + '<td style="text-align:center">'+esc(m.urutan||'-')+'</td>'
      + '<td><div style="display:flex;gap:6px">'
      + '<button class="btn btn-outline btn-sm" onclick="editMateriLevel('+m.id+')">✏️</button>'
      + '<button class="btn btn-red btn-sm" onclick="hapusMateriLevel('+m.id+',\''+escJs(m.judul)+'\')">🗑️</button>'
      + '</div></td></tr>';
  }).join('');
}

function bukaModalLevel(data) {
  document.getElementById('lvEditId').value      = data ? data.id : '';
  document.getElementById('lvEditLevel').value   = data ? (data.level||'') : '';
  document.getElementById('lvEditKategori').value= data ? (data.kategori||'Deskripsi') : 'Deskripsi';
  document.getElementById('lvEditJudul').value   = data ? (data.judul||'') : '';
  document.getElementById('lvEditIsi').value     = data ? (data.isi||'') : '';
  document.getElementById('lvEditUrutan').value  = data ? (data.urutan||'') : '';
  document.getElementById('modalLevelTitle').textContent = data ? 'Edit Materi Level' : 'Tambah Materi Level';
  document.getElementById('modalLevelOverlay').style.display = 'flex';
}
function tutupModalLevel() { document.getElementById('modalLevelOverlay').style.display = 'none'; }

function editMateriLevel(id) {
  var m = _lvMateriData.find(function(x){ return x.id === id; });
  if (m) bukaModalLevel(m);
}

async function hapusMateriLevel(id, judul) {
  toast('Hapus "'+judul+'"? Data tidak bisa dikembalikan.', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Hapus';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try {
      await window.HQ.AdminAPI.deleteMateriLevel(id);
      toast('Item dihapus','ok');
      loadLvMateriAdmin();
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}

async function simpanMateriLevel() {
  var id    = document.getElementById('lvEditId').value;
  var level = document.getElementById('lvEditLevel').value.trim();
  var judul = document.getElementById('lvEditJudul').value.trim();
  var isi   = document.getElementById('lvEditIsi').value.trim();
  if (!level) return toast('Level wajib diisi','err');
  if (!judul) return toast('Judul wajib diisi','err');
  var d = {
    id: id ? parseInt(id) : undefined,
    level: level,
    kategori: document.getElementById('lvEditKategori').value,
    judul: judul,
    isi: isi,
    urutan: parseInt(document.getElementById('lvEditUrutan').value)||0,
  };
  try {
    await window.HQ.AdminAPI.upsertMateriLevel(d);
    toast('Materi "'+judul+'" disimpan','ok');
    tutupModalLevel();
    loadLvMateriAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
}

// ══════════════════════════════════════════
//  MANAJEMEN LEVEL
// ══════════════════════════════════════════
async function loadLevel() {
  showLoad('Bismillah, memuat data level...');
  try {
    const r = await window.HQ.AdminAPI.getLevelList();
    const rows = r.data || [];
    document.getElementById('levelTbl').innerHTML = rows.map(l =>
      '<tr>'
      + '<td style="font-weight:700;color:var(--text-3)">' + esc(l.urutan||'–') + '</td>'
      + '<td><strong>' + esc(l.nama_level) + '</strong></td>'
      + '<td style="font-weight:700;color:var(--green)">' + (l.jumlah_pertemuan||40) + ' sesi</td>'
      + '<td style="font-size:12.5px;color:var(--text-3)">' + esc(l.deskripsi||'–') + '</td>'
      + '<td>' + (l.status==='aktif'?'<span class="badge b-green">Aktif</span>':'<span class="badge b-gray">Non-aktif</span>') + '</td>'
      + '<td style="display:flex;gap:5px">'
      + '<button class="btn btn-ghost btn-sm" data-lid="' + esc(l.id_level) + '" onclick="editLevel(this.getAttribute(\'data-lid\'))">✏️</button>'
      + '<button class="btn btn-red btn-sm" data-lid="' + esc(l.id_level) + '" data-lnm="' + esc(l.nama_level) + '" onclick="hapusLevel(this.getAttribute(\'data-lid\'),this.getAttribute(\'data-lnm\'))">🗑</button>'
      + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada level</td></tr>';
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

function openModalLevel() {
  document.getElementById('modalMngLevelTitle').textContent = '🏆 Level Baru';
  document.getElementById('lvlId').value = '';
  document.getElementById('lvlNama').value = '';
  document.getElementById('lvlUrutan').value = '';
  document.getElementById('lvlTarget').value = '40';
  document.getElementById('lvlDesc').value = '';
  document.getElementById('lvlStatus').value = 'aktif';
  openModal('modalLevel');
}

function editLevel(id) {
  const lvl = document.querySelector('[data-lvl-id="' + id + '"]');
  // Reload dari server
  window.HQ.AdminAPI.getLevelList().then(r => {
    const l = (r.data||[]).find(x => x.id_level === id);
    if (!l) return;
    document.getElementById('modalMngLevelTitle').textContent = '✏️ Edit Level';
    document.getElementById('lvlId').value = l.id_level;
    document.getElementById('lvlNama').value = l.nama_level;
    document.getElementById('lvlUrutan').value = l.urutan||'';
    document.getElementById('lvlTarget').value = l.jumlah_pertemuan||40;
    document.getElementById('lvlDesc').value = l.deskripsi||'';
    document.getElementById('lvlStatus').value = l.status||'aktif';
    openModal('modalLevel');
  }).catch(e => toast(friendlyError(e),'err'));
}

async function saveLevel() {
  const data = {
    id_level         : document.getElementById('lvlId').value,
    nama_level       : document.getElementById('lvlNama').value.trim(),
    urutan           : Number(document.getElementById('lvlUrutan').value)||1,
    jumlah_pertemuan : Number(document.getElementById('lvlTarget').value)||40,
    deskripsi        : document.getElementById('lvlDesc').value,
    status           : document.getElementById('lvlStatus').value,
  };
  if (!data.nama_level) return toast('Nama level wajib diisi','err');
  showLoad('Bismillah, menyimpan level...');
  try {
    await window.HQ.AdminAPI.saveLevel(data);
    closeModal('modalLevel');
    toast('Level disimpan!','ok');
    loadLevel();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function hapusLevel(id, nama) {
  toast('Nonaktifkan level ' + nama + '?','warn');
  document.getElementById('notifBtn').textContent = 'Ya, Nonaktifkan';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad();
    try { await window.HQ.AdminAPI.deleteLevel(id); toast('Level dinonaktifkan','ok'); loadLevel(); }
    catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}

// ══════════════════════════════════════════
//  TEMPLATE KOREKSI
// ══════════════════════════════════════════
var templateRows = [];

async function loadTemplate() {
  showLoad('Bismillah, memuat template koreksi...');
  try {
    const r = await window.HQ.AdminAPI.getTemplateKoreksi();
    templateRows = (r.flat || []).map(function(t){
      return { id: t.id_template || '', kategori: t.kategori || 'Umum', teks: t.teks || '' };
    });
    if (!templateRows.length) {
      templateRows = [
        { id:'',teks:'Makhraj ح perlu diperjelas',kategori:'Makhraj' },
        { id:'',teks:'Mad tabi\u2019i kurang panjang',kategori:'Mad' },
        { id:'',teks:'Ghunnah (dengung) kurang jelas',kategori:'Dengung' },
      ];
    }
    renderTemplateRows();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

function renderTemplateRows() {
  document.getElementById('templateList').innerHTML = templateRows.map(function(t, i) {
    return '<div class="komponen-row" style="padding:8px;gap:8px">'
      + '<input type="text" class="fc" value="' + esc(t.kategori||'Umum') + '" placeholder="Kategori" style="width:120px;flex-shrink:0" oninput="templateRows[' + i + '].kategori=this.value">'
      + '<input type="text" class="fc" value="' + esc(t.teks) + '" placeholder="Teks koreksi..." style="flex:1" oninput="templateRows[' + i + '].teks=this.value">'
      + '<button class="btn btn-red btn-sm" onclick="hapusTemplateRow(' + i + ')">🗑</button>'
      + '</div>';
  }).join('') || '<div style="color:var(--text-3);text-align:center;padding:16px">Belum ada template</div>';
}

function tambahTemplateRow() {
  templateRows.push({ id:'', kategori:'Umum', teks:'' });
  renderTemplateRows();
}

function hapusTemplateRow(i) {
  templateRows.splice(i, 1);
  renderTemplateRows();
}

async function saveTemplate() {
  const valid = templateRows.filter(t => t.teks.trim());
  if (!valid.length) return toast('Tidak ada template yang diisi','err');
  showLoad('Bismillah, menyimpan template...');
  try {
    await window.HQ.AdminAPI.saveTemplateKoreksi({ templates: valid });
    toast('Template koreksi disimpan! Guru akan lihat update berikutnya.','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  EXPORT REKAP ABSENSI
// ══════════════════════════════════════════
function doExportAbsensi() {
  var list = _absensiRekapDataFiltered || [];
  if (!list.length) {
    showAlertModal('Tidak ada data absensi untuk diekspor.', { title: 'Ekspor Absensi' });
    return;
  }
  var csv = 'ID Murid;Nama Murid;Halaqah;Hadir (H);Terlambat (T);Izin (I);Alpa (A);Total Sesi;Persentase Hadir;Skor Kehadiran\r\n';
  list.forEach(function(m) {
    var nama = _csvSafe(m.nama_murid || '');
    var hal = _csvSafe(m.nama_halaqah || '—');
    var pctText = m.total === 0 ? '—' : m.pct_hadir + '%';
    var skorText = m.total === 0 ? '—' : m.skor_dari_40 + '%';
    csv += '"' + _csvSafe(m.id_murid) + '";"' + nama + '";"' + hal + '";' + (m.H||0) + ';' + (m.T||0) + ';' + (m.I||0) + ';' + (m.A||0) + ';' + (m.total||0) + ';"' + pctText + '";"' + skorText + '"\r\n';
  });

  // UTF-8 BOM agar terbaca dengan benar di Excel (Indonesian locale)
  var blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var halaqahVal = document.getElementById('absensiHalaqahSel').value || 'Semua-Halaqah';
  var jenisVal = document.getElementById('absensiJenisSel')?.value || 'Semua-Sesi';
  var statusVal = document.getElementById('absensiFilterStatus').value || 'Semua-Status';

  a.href   = url;
  a.download = 'rekap_absensi_' + halaqahVal + '_' + jenisVal + '_' + statusVal + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ══════════════════════════════════════════
//  AUTO-REFRESH & SESSION TIMEOUT ADMIN
// ══════════════════════════════════════════
var _adminRefreshInterval = null;
var _adminLastRefresh     = null;

function startAdminAutoRefresh() {
  clearInterval(_adminRefreshInterval);
  _adminLastRefresh = new Date();
  _adminRefreshInterval = setInterval(async function() {
    const menit = Math.round((new Date() - _adminLastRefresh) / 60000);
    if (menit >= 5) {
      try { await loadMasterData(); _adminLastRefresh = new Date(); } catch(e) {}
    }
  }, 30000);
}

var _adminSession = null;
function resetAdminSession() {
  clearTimeout(_adminSession);
  _adminSession = setTimeout(function() {
    toast('Sesi berakhir setelah 8 jam tidak aktif.','warn');
    setTimeout(function(){ window.HQ.Auth.logout(); }, 3000);
  }, 8 * 60 * 60 * 1000);
}
['click','keydown','touchstart'].forEach(function(ev) {
  document.addEventListener(ev, resetAdminSession, { passive:true });
});


  // Export functions to window
  if (typeof window !== "undefined") {
    window.onObCtaChange = onObCtaChange;
    window.loadOnboarding = loadOnboarding;
    window._obReadForm = _obReadForm;
    window.saveOnboarding = saveOnboarding;
    window.previewOnboarding = previewOnboarding;
    window.renderPushConfig = renderPushConfig;
    window.togglePushConfig = togglePushConfig;
    window._pushFailLabel = _pushFailLabel;
    window._pushFailSummary = _pushFailSummary;
    window.renderPushLog = renderPushLog;
    window.loadPushSubscribers = loadPushSubscribers;
    window.renderPushSubscribers = renderPushSubscribers;
    window.hapusPushSubscriber = hapusPushSubscriber;
    window.loadPushTargetOptions = loadPushTargetOptions;
    window.onPushTargetChange = onPushTargetChange;
    window.onPushUrlPresetChange = onPushUrlPresetChange;
    window.getPushTestUrl = getPushTestUrl;
    window.setAllPushConfig = setAllPushConfig;
    window.kirimTestPush = kirimTestPush;
    window.jalankanDiagnostik = jalankanDiagnostik;
    window.testTrigger = testTrigger;
    window._confirmStressCleanup = _confirmStressCleanup;
    window.stressTestMulai = stressTestMulai;
    window.stressTestCleanup = stressTestCleanup;
    window.rsStressTestMulai = rsStressTestMulai;
    window.rsStressTestCleanup = rsStressTestCleanup;
    window.prefsStressTestMulai = prefsStressTestMulai;
    window.prefsStressTestCleanup = prefsStressTestCleanup;
    window.combStressTestMulai = combStressTestMulai;
    window.combStressTestCleanup = combStressTestCleanup;
    window.usrStressTestMulai = usrStressTestMulai;
    window.usrStressTestCleanup = usrStressTestCleanup;
    window.obsStressTestMulai = obsStressTestMulai;
    window.obsStressTestCleanup = obsStressTestCleanup;
    window.atStressTestMulai = atStressTestMulai;
    window.atStressTestCleanup = atStressTestCleanup;
    window.loadMateriAdmin = loadMateriAdmin;
    window.switchMateriTab = switchMateriTab;
    window.loadAtMateriAdmin = loadAtMateriAdmin;
    window.bukaModalAt = bukaModalAt;
    window.tutupModalAt = tutupModalAt;
    window.editAtMateri = editAtMateri;
    window.hapusAtMateri = hapusAtMateri;
    window.simpanAtMateri = simpanAtMateri;
    window.loadLvMateriAdmin = loadLvMateriAdmin;
    window.renderMateriLevelAdmin = renderMateriLevelAdmin;
    window.bukaModalLevel = bukaModalLevel;
    window.tutupModalLevel = tutupModalLevel;
    window.editMateriLevel = editMateriLevel;
    window.hapusMateriLevel = hapusMateriLevel;
    window.simpanMateriLevel = simpanMateriLevel;
    window.loadLevel = loadLevel;
    window.openModalLevel = openModalLevel;
    window.editLevel = editLevel;
    window.saveLevel = saveLevel;
    window.hapusLevel = hapusLevel;
    window.loadTemplate = loadTemplate;
    window.renderTemplateRows = renderTemplateRows;
    window.tambahTemplateRow = tambahTemplateRow;
    window.hapusTemplateRow = hapusTemplateRow;
    window.saveTemplate = saveTemplate;
    window.doExportAbsensi = doExportAbsensi;
    window.startAdminAutoRefresh = startAdminAutoRefresh;
    window.resetAdminSession = resetAdminSession;

    // Daurah indicators administration functions
    var _indikatorDaurahData = [];

    async function loadIndikatorDaurah() {
      var tbody = document.getElementById('indikatorDaurahTbl');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">Bismillah, memuat data...</td></tr>';
      try {
        var r = await window.HQ.AdminAPI.getAssessmentItemsAdmin();
        _indikatorDaurahData = (r.data || []).filter(function(x) { return x.level === 'Tahsin Al-Fatihah'; });
        
        if (!_indikatorDaurahData.length) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada indikator daurah. Klik "+ Tambah Indikator" untuk menambahkan.</td></tr>';
          return;
        }
        tbody.innerHTML = _indikatorDaurahData.map(function(m) {
          var statusLabel = m.status === 'aktif' ? 'Aktif' : 'Non-aktif';
          var statusClass = m.status === 'aktif' ? 'b-green' : 'b-red';
          var hariLabel = m.kategori || 'Hari 1';
          return '<tr>'
            + '<td style="text-align:center;font-weight:800;color:var(--blue-d)">' + esc(m.urutan) + '</td>'
            + '<td style="font-weight:700">' + esc(m.teks_latin) + '</td>'
            + '<td style="font-family:Amiri,serif;font-size:16px;color:var(--green);font-weight:bold">' + esc(m.teks_arab || '-') + '</td>'
            + '<td style="font-weight:700;color:var(--blue-d);font-size:12.5px">' + esc(hariLabel) + '</td>'
            + '<td style="font-size:12px;white-space:normal;line-height:1.4">' + esc(m.keterangan || '-') + '</td>'
            + '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>'
            + '<td><div style="display:flex;gap:6px">'
            + '<button class="btn btn-outline btn-sm" onclick="editIndikator(\'' + m.id_item + '\')">✏️</button>'
            + '<button class="btn btn-red btn-sm" onclick="hapusIndikator(\'' + m.id_item + '\',\'' + escJs(m.teks_latin) + '\')">🗑️</button>'
            + '</div></td></tr>';
        }).join('');
      } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--red);padding:16px">' + esc(friendlyError(e)) + '</td></tr>';
      }
    }

    function bukaModalIndikator(data) {
      document.getElementById('indId').value = data ? data.id_item : '';
      document.getElementById('indTeksLatin').value = data ? (data.teks_latin || '') : '';
      document.getElementById('indTeksArab').value = data ? (data.teks_arab || '') : '';
      document.getElementById('indUrutan').value = data ? data.urutan : (_indikatorDaurahData.length + 1);
      document.getElementById('indKeterangan').value = data ? (data.keterangan || '') : '';
      document.getElementById('indKategori').value = data ? (data.kategori || 'Hari 1') : 'Hari 1';
      document.getElementById('indStatus').value = data ? (data.status || 'aktif') : 'aktif';
      
      document.getElementById('modalIndikatorTitle').textContent = data ? 'Edit Indikator Daurah' : 'Tambah Indikator Daurah';
      openModal('modalIndikator');
    }

    function editIndikator(id_item) {
      var m = _indikatorDaurahData.find(function(x) { return x.id_item === id_item; });
      if (m) bukaModalIndikator(m);
    }

    async function simpanIndikator() {
      var id_item = document.getElementById('indId').value;
      var teks_latin = document.getElementById('indTeksLatin').value.trim();
      var teks_arab = document.getElementById('indTeksArab').value.trim();
      var urutan = document.getElementById('indUrutan').value;
      var keterangan = document.getElementById('indKeterangan').value.trim();
      var kategori = document.getElementById('indKategori').value;
      var status = document.getElementById('indStatus').value;

      if (!teks_latin) return toast('Nama indikator wajib diisi', 'err');
      if (!urutan) return toast('Urutan wajib diisi', 'err');

      showLoad('Bismillah, menyimpan indikator...');
      try {
        await window.HQ.AdminAPI.upsertAssessmentItem({
          id_item: id_item || undefined,
          level: 'Tahsin Al-Fatihah',
          kategori: kategori,
          teks_latin: teks_latin,
          teks_arab: teks_arab,
          urutan: Number(urutan),
          keterangan: keterangan,
          status: status
        });
        toast('Indikator daurah berhasil disimpan!', 'ok');
        closeModal('modalIndikator');
        loadIndikatorDaurah();
      } catch(e) {
        toast(friendlyError(e), 'err');
      } finally {
        hideLoad();
      }
    }

    async function hapusIndikator(id_item, nama) {
      toast('Hapus indikator "' + nama + '"? Data yang berkaitan dengannya tidak dapat diakses.', 'warn');
      document.getElementById('notifBtn').textContent = 'Ya, Hapus';
      document.getElementById('notifBtn').onclick = async () => {
        closeNotif();
        showLoad('Bismillah, menghapus...');
        try {
          await window.HQ.AdminAPI.deleteAssessmentItem(id_item);
          toast('Indikator "' + nama + '" berhasil dihapus', 'ok');
          loadIndikatorDaurah();
        } catch(e) {
          toast(friendlyError(e), 'err');
        } finally {
          hideLoad();
        }
      };
    }

    window.loadIndikatorDaurah = loadIndikatorDaurah;
    window.bukaModalIndikator = bukaModalIndikator;
    window.editIndikator = editIndikator;
    window.simpanIndikator = simpanIndikator;
    window.hapusIndikator = hapusIndikator;
  }
})();
