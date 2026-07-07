// ══════════════════════════════════════════════════════════════
//  Rattil Portal Guru — Modul Jadwal & Kehadiran (jadwal-module.js)
//  Ekstraksi Fase 1: Memecah monolitik guru/index.html
// ══════════════════════════════════════════════════════════════

(function() {
  // ── STATE LOKAL MODUL JADWAL ──
  let liveHalaqahs = [];
  let isFetchingJadwal = false;

  const JD_TIBYAN = {
    nama: "Kajian At-Tibyan",
    guru: "Seluruh halaqah · pemateri rotasi",
    level: "At-Tibyan",
    mulai: "19:30",
    selesai: "21:00",
    tibyan: true
  };

  const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"];
  const ALIAS = {
    "minggu": "Ahad",
    "ahad": "Ahad",
    "jumat": "Jumat",
    "jum'at": "Jumat",
    "jum’at": "Jumat"
  };

  const LV = {
    "Level 1": "#0ea5e9",
    "Level 2": "#8b5cf6",
    "Level 3": "#f59e0b",
    "Level 4": "#ef4444",
    "Level Qiyam": "#10b981",
    "At-Tibyan": "#6366f1",
    "Tahsin Al-Fatihah": "#14b8a6"
  };

  let _jdKalDate = new Date();
  let _jdKalSelected = null;
  let _jdKalEvtMap = {};
  let _jdKalKbmRows = [];
  let _jdKalFetchedMonth = null;

  var _ksBulan = null, _ksTahun = null, _ksBusy = false;
  var _ksDetailOpen = false; // dipertahankan antar-reload kartu

  const _KS_NAMA_BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const _KS_HARI_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Warna kotak strip per hari. Status paling perlu perhatian menang.
  const _KS_SQ_COLOR = {
    A: '#ef4444',
    _DRAFT: '#9ca3af',
    DS: '#f59e0b',
    I: '#3b82f6',
    HP: '#22c55e',
    H: '#22c55e',
    L: '#d1d5db'
  };
  const _KS_SEVERITY = ['A', '_DRAFT', 'DS', 'I', 'HP', 'H', 'L'];

  // ── HELPER INTERNAL MODUL ──
  function lvColor(l) {
    return LV[l] || "#0ea5e9";
  }

  function parseHari(h) {
    return String(h || "").split(/[\s,/&]+/).map(function(t) {
      var k = t.trim().toLowerCase();
      if (!k) return null;
      if (ALIAS[k]) return ALIAS[k];
      return HARI.find(function(d) { return d.toLowerCase() === k; }) || null;
    }).filter(Boolean);
  }

  function _ksWeekday(t) {
    return new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10))).getUTCDay();
  }

  function _ksTodayJakarta() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      var n = new Date();
      return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    }
  }

  function _ksDayColor(units) {
    if (!units || !units.length) return '#eef0f3';
    var best = null, rank = 99;
    units.forEach(function(u) {
      var r = _KS_SEVERITY.indexOf(u.status);
      if (r >= 0 && r < rank) {
        rank = r;
        best = u.status;
      }
    });
    return _KS_SQ_COLOR[best] || '#eef0f3';
  }

  function _ksSisaPengganti(id_halaqah, jenis) {
    var jData = window.jadwalData;
    var h = (typeof jData !== 'undefined' && jData) ? jData.find(function(x) { return x.id_halaqah === id_halaqah; }) : null;
    if (!h || !h.sisa_pengganti) return 0;
    return h.sisa_pengganti[jenis || 'KBM Reguler'] || 0;
  }

  function switchJdTab(type, btn) {
    document.querySelectorAll('#page-jadwal .at-tab-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    
    if (type === 'pekanan') {
      document.getElementById('panelJdPekanan').style.display = 'block';
      document.getElementById('panelJdBulanan').style.display = 'none';
    } else {
      document.getElementById('panelJdPekanan').style.display = 'none';
      document.getElementById('panelJdBulanan').style.display = 'block';
      initJdBulanan();
    }
  }

  async function initJadwalPage() {
    if (liveHalaqahs.length > 0) {
      renderJdPekanan();
      return;
    }
    await loadLiveJadwal();
  }

  // ── FUNGSI UTAMA JADWAL (PEKANAN & BULANAN) ──
  async function loadLiveJadwal() {
    if (isFetchingJadwal) return;
    isFetchingJadwal = true;

    const accEl = document.getElementById('jdAcc');
    if (accEl) {
      accEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-3)">Bismillah, memuat jadwal KBM...</div>';
    }

    try {
      let { data, error } = await window.HQ.supabase.rpc('get_active_schedules');

      if (error) {
        console.warn('[Jadwal] RPC get_active_schedules tidak ditemukan, menggunakan fallback query direct:', error.message || error);
        const fallbackRes = await window.HQ.supabase
          .from('halaqah')
          .select('id_halaqah, nama_halaqah, level, id_guru, nama_guru, jadwal_hari, jam_mulai, jam_selesai, anggota(count)')
          .eq('status', 'aktif');
        if (fallbackRes.error) throw fallbackRes.error;

        data = (fallbackRes.data || []).map(function(h) {
          return {
            id_halaqah: h.id_halaqah,
            nama_halaqah: h.nama_halaqah,
            level: h.level,
            id_guru: h.id_guru,
            nama_guru: h.nama_guru,
            jadwal_hari: h.jadwal_hari,
            jam_mulai: h.jam_mulai,
            jam_selesai: h.jam_selesai,
            murid_count: h.anggota ? (h.anggota[0] ? h.anggota[0].count : 0) : 0
          };
        });
      }

      liveHalaqahs = (data || []).map(function(h) {
        return {
          id_halaqah: h.id_halaqah,
          nama: h.nama_halaqah,
          guru: h.nama_guru || '—',
          id_guru: h.id_guru,
          level: h.level || 'Level 1',
          hari: h.jadwal_hari || '',
          mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : '—',
          selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : '',
          murid: h.murid_count || 0
        };
      });

      renderJdPekanan();
    } catch (e) {
      console.error('[Jadwal] Gagal memuat jadwal live:', e);
      if (accEl) {
        accEl.innerHTML = '<div class="empty"><div class="empty-ico">❌</div><div class="empty-ttl">Gagal memuat jadwal</div><div class="empty-sub">Silakan periksa koneksi internet Anda atau coba refresh.</div></div>';
      }
    } finally {
      isFetchingJadwal = false;
    }
  }

  function renderJdPekanan() {
    const chkFilter = document.getElementById('chkFilterJdMine');
    const filterMine = chkFilter && chkFilter.checked;

    const stateList = window.HQ.AppState.halaqahList;
    const mineIds = (typeof stateList !== 'undefined' && stateList || []).map(function(h) { return h.id_halaqah; });

    const byDay = {};
    HARI.forEach(function(h) { byDay[h] = []; });

    liveHalaqahs.forEach(function(k) {
      if (filterMine && !mineIds.includes(k.id_halaqah)) return;

      parseHari(k.hari).forEach(function(d) {
        if (byDay[d]) byDay[d].push(k);
      });
    });

    if (!filterMine) {
      byDay["Ahad"].push(JD_TIBYAN);
    }

    Object.keys(byDay).forEach(function(d) {
      byDay[d].sort(function(a, b) {
        return String(a.mulai).localeCompare(String(b.mulai));
      });
    });

    const todayIdx = new Date().getDay();
    const todayName = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][todayIdx];

    const chev = '<svg class="jd-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    let html = "";
    HARI.forEach(function(h) {
      const items = byDay[h];
      const isToday = (h === todayName);
      const cntTxt = items.length ? (items.length + " sesi") : "libur";
      let body = "";

      if (items.length) {
        body = items.map(function(k) {
          const c = lvColor(k.level);
          const jam = (k.mulai && k.selesai) ? (k.mulai + "–" + k.selesai) : (k.mulai || "—");
          const isMine = !k.tibyan && mineIds.includes(k.id_halaqah);
          let tags = "";
          let actionBtn = "";

          if (k.tibyan) {
            tags = '<span class="jd-tag">Pekanan</span><span class="jd-tag">Gabungan</span>';
          } else {
            tags = '<span class="jd-tag">' + k.level + '</span>';
            if (k.murid) tags += '<span class="jd-tag murid">' + k.murid + ' murid</span>';
            if (isMine) {
              tags += '<span class="jd-tag mine">★ Halaqah Anda</span>';

              const activeSesi = window.HQ.AppState.sesiAktif;
              if (isToday) {
                if (typeof activeSesi !== 'undefined' && activeSesi && activeSesi.id_halaqah === k.id_halaqah) {
                  actionBtn = '<button class="jd-btn-sm" style="background:#fbbf24" onclick="event.stopPropagation(); goPage(\'kbm\')">⚡ Lanjutkan Jurnal</button>';
                } else if (typeof activeSesi !== 'undefined' && activeSesi) {
                  actionBtn = '<button class="jd-btn-sm" style="background:#94a3b8; cursor:not-allowed" onclick="event.stopPropagation(); window.toast(\'Masih ada sesi draft berjalan di halaqah lain!\', \'warn\')">⚡ Mulai KBM</button>';
                } else {
                  actionBtn = '<button class="jd-btn-sm" onclick="event.stopPropagation(); window.mulaiSesiHalaqah(\'' + k.id_halaqah + '\')">⚡ Mulai KBM</button>';
                }
              }
            }
          }

          return '<div class="jd-sesi' + (isMine ? ' mine' : '') + '" style="--c:' + c + '">'
            + '<div class="jd-time">' + jam + '</div>'
            + '<div class="jd-info"><div class="jd-nm">' + window.esc(k.nama) + '</div>'
            + '<div class="jd-gr">' + window.esc(k.guru) + '</div>'
            + '<div class="jd-tags">' + tags + '</div>'
            + (actionBtn ? '<div style="margin-top:6px">' + actionBtn + '</div>' : '')
            + '</div></div>';
        }).join("");
      } else {
        body = '<div class="jd-empty">— Tidak ada KBM —</div>';
      }

      html += '<div class="jd-day' + (isToday ? ' today open' : '') + '">'
        + '<button class="jd-chip" onclick="this.parentNode.classList.toggle(\'open\')">'
        + '<span class="jd-name">' + h + '</span>'
        + (isToday ? '<span class="jd-today-tag">HARI INI</span>' : '')
        + '<span class="jd-count' + (items.length ? '' : ' libur') + '">' + cntTxt + '</span>'
        + chev + '</button>'
        + '<div class="jd-body">' + body + '</div></div>';
    });

    document.getElementById('jdAcc').innerHTML = html;

    const activeHalaqahsCount = liveHalaqahs.length;
    const totalSesi = liveHalaqahs.reduce(function(s, k) {
      return s + parseHari(k.hari).length;
    }, 0);

    document.getElementById('jdMeta').textContent = activeHalaqahsCount + ' halaqah · ' + totalSesi + ' sesi/pekan · +Kajian At-Tibyan tiap Ahad';
    document.getElementById('jdLegend').innerHTML = Object.keys(LV).map(function(l) {
      return '<span class="lg"><span class="d" style="background:' + LV[l] + '"></span>' + l + '</span>';
    }).join("");
  }

  async function initJdBulanan() {
    const user = window.HQ.Auth.getUser();
    const uid = user ? user.id_user : null;
    if (!uid) return;

    const y = _jdKalDate.getFullYear();
    const m = _jdKalDate.getMonth();
    const currentMonthStr = y + '-' + String(m + 1).padStart(2, '0');

    if (_jdKalFetchedMonth !== currentMonthStr) {
      const gridEl = document.getElementById('jdKalGrid');
      if (gridEl) {
        gridEl.innerHTML = '<div style="grid-column: span 7; text-align:center; padding:20px; color:var(--text-3)">Bismillah, memuat agenda...</div>';
      }

      try {
        const startStr = currentMonthStr + '-01';
        const lastDay = new Date(y, m + 1, 0).getDate();
        const endStr = currentMonthStr + '-' + String(lastDay).padStart(2, '0');

        const { data, error } = await window.HQ.supabase
          .from('kbm_log')
          .select('id_kbm, id_halaqah, tanggal_pertemuan, status, materi_belajar, jenis_sesi, jam_mulai, jam_selesai, halaqah(nama_halaqah)')
          .eq('id_guru', uid)
          .gte('tanggal_pertemuan', startStr)
          .lte('tanggal_pertemuan', endStr);

        if (error) throw error;

        _jdKalKbmRows = data || [];
        _jdKalFetchedMonth = currentMonthStr;
      } catch(e) {
        console.error('[Calendar] Gagal memuat data bulanan:', e);
        window.toast('Gagal memuat agenda bulanan.', 'err');
      }
    }

    renderJdBulanan();
  }

  function renderJdBulanan() {
    const HARI_NAMES = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
    const HARI_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
    const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const y = _jdKalDate.getFullYear();
    const m = _jdKalDate.getMonth();

    const monthEl = document.getElementById('jdKalMonth');
    if (monthEl) monthEl.textContent = BULAN_NAMES[m] + ' ' + y;

    const todayLbl = document.getElementById('jdKalToday');
    if (todayLbl) {
      const _now = new Date();
      todayLbl.textContent = 'Hari ini · ' + HARI_FULL[_now.getDay()] + ', '
        + _now.getDate() + ' ' + BULAN_NAMES[_now.getMonth()] + ' ' + _now.getFullYear();
    }

    const evtMap = {};
    function ensure(d) { if (!evtMap[d]) evtMap[d] = { aktual: [], jadwal: [] }; return evtMap[d]; }

    _jdKalKbmRows.forEach(function(row) {
      if (!row.tanggal_pertemuan) return;
      const d = String(row.tanggal_pertemuan).substring(0, 10);
      ensure(d).aktual.push(row);
    });

    const mineHalaqahs = (typeof window.HQ.AppState.halaqahList !== 'undefined' && window.HQ.AppState.halaqahList || []);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    for (let dd = 1; dd <= daysInMonth; dd++) {
      const dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      const cellDate = new Date(y, m, dd);
      const wd = cellDate.getDay();
      const slot = ensure(dateStr);

      mineHalaqahs.forEach(function(h) {
        const hDays = parseHari(h.jadwal_hari);
        const wdName = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][wd];

        if (hDays.includes(wdName)) {
          const hasAktual = slot.aktual.some(function(ak) { return ak.id_halaqah === h.id_halaqah; });
          if (!hasAktual) {
            slot.jadwal.push({
              id_halaqah: h.id_halaqah,
              nama: h.nama_halaqah,
              jam_mulai: h.jam_mulai || '—',
              jam_selesai: h.jam_selesai || '',
              isProjected: true
            });
          }
        }
      });

      if (wd === 0) {
        const hasTibyan = slot.aktual.some(function(ak) { return ak.jenis_sesi === 'KBM At-Tibyan' || ak.jenis_sesi === 'At-Tibyan'; });
        if (!hasTibyan) {
          slot.jadwal.push({
            nama: 'Kajian At-Tibyan',
            jam_mulai: '19:30',
            jam_selesai: '21:00',
            isProjected: true,
            tibyan: true
          });
        }
      }
    }

    _jdKalEvtMap = evtMap;
    if (!_jdKalSelected) {
      _jdKalSelected = (y === today.getFullYear() && m === today.getMonth())
        ? todayStr
        : (y + '-' + String(m + 1).padStart(2, '0') + '-01');
    }

    let html = HARI_NAMES.map(function(d) { return '<div class="dash-cal-dn">' + d + '</div>'; }).join('');
    for (let i = 0; i < firstDay; i++) html += '<div class="dash-cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const ev = evtMap[ds] || { aktual: [], jadwal: [] };

      let dots = '';
      let hasSelesai = false, hasDraft = false, hasLibur = false, hasJadwal = false;

      ev.aktual.forEach(function(x) {
        if (x.status === 'selesai') hasSelesai = true;
        else if (x.status === 'draft') hasDraft = true;
        else if (x.status === 'libur') hasLibur = true;
      });
      if (ev.jadwal && ev.jadwal.length > 0) hasJadwal = true;

      if (hasSelesai) dots += '<span class="dash-cal-dot" style="background:#10b981"></span>';
      if (hasDraft) dots += '<span class="dash-cal-dot" style="background:#fbbf24"></span>';
      if (hasLibur) dots += '<span class="dash-cal-dot" style="background:#ef4444"></span>';
      if (hasJadwal && !hasSelesai && !hasDraft && !hasLibur) {
        dots += '<span class="dash-cal-dot" style="background:#94a3b8"></span>';
      }

      const cls = 'dash-cal-day' + (ds === todayStr ? ' today' : '') + (ds === _jdKalSelected ? ' sel' : '');
      html += '<div class="' + cls + '" onclick="event.stopPropagation();window.pilihJdTanggal(\'' + ds + '\')">' + d
        + '<div class="dash-cal-dots">' + dots + '</div></div>';
    }

    const gridEl = document.getElementById('jdKalGrid');
    if (gridEl) gridEl.innerHTML = html;

    renderJdKalAgenda();
    updateJdKalStats();
  }

  function renderJdKalAgenda() {
    const el = document.getElementById('jdKalAgenda');
    if (!el || !_jdKalSelected) return;

    const ev = _jdKalEvtMap[_jdKalSelected] || { aktual: [], jadwal: [] };
    const parts = _jdKalSelected.split('-');
    const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

    const isSelectedToday = (new Date().toDateString() === dt.toDateString());

    const items = [];

    ev.aktual.forEach(function(x) {
      let statusText = '';
      let color = '';
      let actionBtn = '';

      if (x.status === 'selesai') {
        statusText = 'Selesai';
        color = '#10b981';
      } else if (x.status === 'draft') {
        statusText = 'Draft (Belum ditutup)';
        color = '#fbbf24';
        actionBtn = '<button class="jd-btn-sm" style="background:#fbbf24; margin-top: 6px" onclick="event.stopPropagation(); goPage(\'kbm\')">⚡ Lanjutkan Jurnal</button>';
      } else if (x.status === 'libur') {
        statusText = 'Libur: ' + (x.keterangan_libur || 'Libur Resmi');
        color = '#ef4444';
      }

      items.push({
        nama: (x.halaqah && x.halaqah.nama_halaqah) || 'KBM',
        sub: statusText + (x.materi_belajar ? ' · ' + x.materi_belajar : ''),
        dot: color,
        action: actionBtn
      });
    });

    ev.jadwal.forEach(function(x) {
      let actionBtn = '';

      const activeSesi = window.HQ.AppState.sesiAktif;
      if (isSelectedToday && !x.tibyan) {
        if (typeof activeSesi !== 'undefined' && activeSesi) {
          actionBtn = '<button class="jd-btn-sm" style="background:#94a3b8; cursor:not-allowed" onclick="event.stopPropagation(); window.toast(\'Masih ada sesi draft berjalan di halaqah lain!\', \'warn\')">⚡ Mulai KBM</button>';
        } else {
          actionBtn = '<button class="jd-btn-sm" onclick="event.stopPropagation(); window.mulaiSesiHalaqah(\'' + x.id_halaqah + '\')">⚡ Mulai KBM</button>';
        }
      }

      items.push({
        nama: x.nama,
        sub: 'Terjadwal · ' + (x.jam_mulai || '—') + (x.jam_selesai ? '-' + x.jam_selesai : ''),
        dot: '#94a3b8',
        action: actionBtn
      });
    });

    const head = '<div class="dash-cal-agenda-head">' + dt.getDate() + ' ' + BULAN_SINGKAT[dt.getMonth()] + ' ' + dt.getFullYear() + '</div>';
    if (!items.length) {
      el.innerHTML = head + '<div class="dash-cal-agenda-empty">Tidak ada kegiatan KBM</div>';
      return;
    }

    el.innerHTML = head + items.map(function(it) {
      return '<div class="dash-cal-evt"><span class="dash-cal-evt-dot" style="background:' + it.dot + '"></span>'
        + '<div><div class="dash-cal-evt-name">' + window.esc(it.nama) + '</div>'
        + '<div class="dash-cal-evt-time">' + window.esc(it.sub) + '</div>'
        + (it.action ? '<div>' + it.action + '</div>' : '')
        + '</div></div>';
    }).join('');
  }

  function updateJdKalStats() {
    let selesai = 0, draft = 0, libur = 0;
    _jdKalKbmRows.forEach(function(x) {
      if (x.status === 'selesai') selesai++;
      else if (x.status === 'draft') draft++;
      else if (x.status === 'libur') libur++;
    });

    const sEl = document.getElementById('jdStatSelesai');
    const dEl = document.getElementById('jdStatDraft');
    const lEl = document.getElementById('jdStatLibur');

    if (sEl) sEl.textContent = selesai;
    if (dEl) dEl.textContent = draft;
    if (lEl) lEl.textContent = libur;
  }

  function jdKalNav(dir) {
    _jdKalDate.setMonth(_jdKalDate.getMonth() + dir);
    _jdKalSelected = null;
    initJdBulanan();
  }

  function pilihJdTanggal(dateStr) {
    _jdKalSelected = dateStr;
    renderJdBulanan();
  }

  // ── FUNGSI UTAMA KEHADIRAN GURU (KEHADIRANKU) ──
  function ksNavBulan(delta) {
    if (_ksBusy || _ksBulan == null) return;
    var m = _ksBulan + delta, y = _ksTahun;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }

    var now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    loadKehadiranSaya({ bulan: m, tahun: y, fromNav: true });
  }

  function ksToggleDetail() {
    var list  = document.getElementById('ksDetailList');
    var caret = document.getElementById('ksDetailCaret');
    var btn   = document.getElementById('ksDetailToggle');
    if (!list) return;
    var open = list.style.display !== 'none';
    _ksDetailOpen = !open;
    list.style.display = open ? 'none' : '';
    if (caret) caret.style.transform = open ? '' : 'rotate(90deg)';
    if (btn) btn.setAttribute('aria-expanded', String(!open));
  }

  function ksBukaSusulan(id_halaqah, jenis) {
    const activeSesi = window.HQ.AppState.sesiAktif;
    if (typeof activeSesi !== 'undefined' && activeSesi) {
      window.toast('Tuntaskan dulu sesi yang sedang berjalan sebelum membuka kelas pengganti.', 'warn');
      goPage('kbm'); return;
    }
    jenis = jenis || 'KBM Reguler';
    goPage('kbm');
    var lvl = document.getElementById('kbmLevel');
    if (lvl) { lvl.value = ''; window.filterKbmHalaqah(); }
    var selH = document.getElementById('kbmHalaqah');
    if (selH) {
      selH.value = id_halaqah;
      if (selH.value !== id_halaqah) {
        window.toast('Halaqah ini sudah tidak aktif. Minta admin menonaktifkan jadwalnya.', 'warn');
        return;
      }
      if (['KBM Reguler', 'Micro Teaching', 'Lainnya', 'KBM Qiyam'].indexOf(jenis) >= 0) window.selectKbmJenis(jenis);
      selH.dispatchEvent(new Event('change'));
    }
    var tgl = document.getElementById('kbmTanggal');
    if (tgl && !tgl.value) {
      tgl.value = _ksTodayJakarta();
    }

    var cb = document.getElementById('kbmIsPengganti');
    var wrap = document.getElementById('kbmPenggantiWrap');
    if (cb && wrap && wrap.style.display !== 'none') {
      cb.checked = true;
      window.toast('Kelas pengganti: halaqah terisi & ditandai pengganti. Pilih tanggal pelaksanaan lalu buka sesi. 🤲', 'ok');
    } else {
      window.toast('Tidak ada slot kelas pengganti untuk halaqah ini. Jika tetap dibuka, akan tercatat sebagai sesi biasa (tidak menebus Izin).', 'warn');
    }
    var form = document.getElementById('formBukaKBM');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function ksTandaiIzin(id_halaqah, tanggal, jenis) {
    const activeSesi = window.HQ.AppState.sesiAktif;
    if (typeof activeSesi !== 'undefined' && activeSesi) {
      window.toast('Selesaikan dulu sesi yang sedang berjalan.', 'warn'); return;
    }
    jenis = jenis || 'KBM Reguler';
    const stateList = window.HQ.AppState.halaqahList;
    var h = (typeof stateList !== 'undefined' && stateList) ? stateList.find(function(x) { return x.id_halaqah === id_halaqah; }) : null;
    var nama = (h && h.nama_halaqah) || id_halaqah;
    var html = '<div style="background:var(--libur-bg);border:1px solid var(--libur-border);border-radius:10px;padding:12px 14px;margin-bottom:12px">' +
        '<div style="font-size:14px;font-weight:800;color:var(--libur-title,#9a3412)">✉️ ' + window.esc(nama) + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:var(--libur-sub,#b45309);margin-top:2px">' + window.esc(jenis) + ' · ' + window.fmtDate(tanggal) + '</div>' +
      '</div>' +
      '<label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:6px">Alasan uzur <span style="color:var(--red)">*</span></label>' +
      '<textarea id="ksIzinAlasan" class="fc" rows="3" placeholder="mis. sakit, ada keperluan mendesak, dsb." style="width:100%;resize:vertical"></textarea>' +
      '<div style="font-size:11.5px;color:var(--text-3);margin-top:8px;line-height:1.5">Alpa ini akan tercatat sebagai <strong>Izin</strong> and menambah <strong>+1 sisa kelas pengganti</strong>. ' +
      'Persentase kehadiran <strong>baru membaik setelah kamu menunaikan kelas penggantinya</strong>.</div>';
    var ok = await window.showConfirm('', { title: 'Tandai Alpa sebagai IZIN?', html: html, okText: 'Ya, Tandai Izin' });
    if (!ok) return;
    var alasan = (document.getElementById('ksIzinAlasan') ? document.getElementById('ksIzinAlasan').value : '').trim();
    if (!alasan) { window.toast('Alasan uzur wajib diisi.', 'err'); return ksTandaiIzin(id_halaqah, tanggal, jenis); }
    window.showLoad('Bismillah, menyimpan izin...');
    try {
      var r = await window.HQ.GuruAPI.tandaiLibur({
        id_halaqah: id_halaqah,
        tanggal_pertemuan: tanggal,
        jenis_sesi: jenis,
        keterangan_libur: alasan
      });
      if (r.status !== 'ok') throw new Error(r.message || 'Gagal menandai izin');
      window.hideLoad();
      window.toast('Tercatat sebagai Izin. Jangan lupa tunaikan kelas penggantinya. 🤲', 'ok');
      await loadKehadiranSaya({ bulan: _ksBulan, tahun: _ksTahun, fromNav: true });
    } catch (e) { window.hideLoad(); window.toast('Gagal: ' + e.message, 'err'); }
  }

  async function loadKehadiranSaya(opts) {
    opts = opts || {};
    var card = document.getElementById('kehadiranSayaCard');
    if (!card) return;
    var fromNav = !!opts.fromNav;
    _ksBusy = true;
    try {
      var r = await window.HQ.GuruAPI.getAbsensiSaya({ bulan: opts.bulan, tahun: opts.tahun });
      var d = r.data, me = d.rekap;
      _ksBulan = d.bulan; _ksTahun = d.tahun;

      document.getElementById('ksBulanLbl').textContent = _KS_NAMA_BULAN[d.bulan - 1] + ' ' + d.tahun;
      var now = new Date();
      var atMaxMonth = (d.tahun === now.getFullYear() && d.bulan === now.getMonth() + 1);
      var nextBtn = document.getElementById('ksNext');
      if (nextBtn) nextBtn.disabled = atMaxMonth;

      var total = me.H + me.DS + me.HP + me.I + me.A + (me.perlu_ditutup || 0);
      if (total === 0) {
        if (!fromNav) { card.style.display = 'none'; return; }
        document.getElementById('ksBody').innerHTML =
          '<div class="ks-empty">🍃 Belum ada sesi KBM yang tercatat pada bulan ini.</div>';
        card.style.display = '';
        return;
      }

      var pctD = me.pct_durasi;
      var pctK = me.pct_kehadiran;
      var hadirTot = me.H + me.HP;
      var hadirNum = me.H + me.DS + me.HP;
      var izinDiganti = me.izin_diganti || 0;
      var seharusnya = Math.max(0, hadirNum + me.I + me.A - izinDiganti);

      function _ksStatus(p) {
        if (p == null)   return { txt: 'Belum ada data', col: '#6b7280', bg: '#f3f4f6', bar: '#9ca3af', ico: 'ℹ️' };
        if (p >= 90)     return { txt: 'Sangat baik',    col: '#15803d', bg: '#dcfce7', bar: '#16a34a', ico: '🌟' };
        if (p >= 75)     return { txt: 'Cukup baik',     col: '#b45309', bg: '#fef3c7', bar: '#f59e0b', ico: '👍' };
        if (p >= 50)     return { txt: 'Perlu ditingkatkan', col: '#b45309', bg: '#fef3c7', bar: '#f59e0b', ico: '💪' };
        return             { txt: 'Banyak sesi terlewat', col: '#b91c1c', bg: '#fee2e2', bar: '#ef4444', ico: '🚩' };
      }
      var st = _ksStatus(pctK);
      var stD = _ksStatus(pctD);

      var hero =
        '<div class="ks-hero">' +
          '<div class="big" style="color:' + st.bar + '">' + (pctK == null ? '–' : pctK + '%') + '</div>' +
          '<div class="body">' +
            '<span class="ks-pill" style="color:' + st.col + ';background:' + st.bg + '">' + st.ico + ' ' + st.txt + '</span>' +
            '<div class="cap">Kehadiranmu bulan ini — hadir di sesi yang seharusnya kamu ampu</div>' +
            '<div class="ks-bar"><i style="width:' + (pctK == null ? 0 : pctK) + '%;background:' + st.bar + '"></i></div>' +
            '<div class="ks-bar-meta"><span>0%</span><span>hadir ' + hadirNum + ' dari ' + seharusnya + ' sesi</span><span>100%</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="ks-sub">' +
          '<div class="v" style="color:' + stD.bar + '">' + (pctD == null ? '–' : pctD + '%') + '</div>' +
          '<div class="minibar"><i style="width:' + (pctD == null ? 0 : pctD) + '%;background:' + stD.bar + '"></i></div>' +
          '<div class="t">⏱️ <strong>Durasi tertunaikan</strong> — dari ' + hadirNum + ' sesi yang kamu jalankan, ' + hadirTot + ' berdurasi ≥ ' + d.ambang + ' mnt. <em>(Alpa tidak dihitung di sini.)</em></div>' +
        '</div>';

      var nudge = '';
      if (pctK != null && seharusnya > 0) {
        if (pctK >= 100) {
          nudge = '<div class="ks-nudge"><span class="ic">🎉</span><div>MasyaAllah, kehadiranmu penuh bulan ini. Pertahankan, ya!</div></div>';
        } else {
          var tonggak = [50, 75, 90, 100].filter(function(t){ return t > pctK; })[0];
          var butuh = Math.max(1, Math.ceil(tonggak / 100 * seharusnya) - hadirNum);
          if (me.A > 0 && butuh <= me.A) {
            nudge = '<div class="ks-nudge"><span class="ic">🎯</span><div>Tunaikan <strong>' + butuh + ' kelas pengganti</strong> lagi (Tandai Izin dulu → buka sesi susulan) untuk naik ke <strong>' + tonggak + '%</strong>. Bismillah, masih bisa dikejar!</div></div>';
          } else if (me.A > 0) {
            nudge = '<div class="ks-nudge"><span class="ic">🎯</span><div>Kamu masih punya <strong>' + me.A + ' Alpa</strong> bulan ini. Tandai Izin (bila ada uzur) lalu tunaikan kelas penggantinya untuk menaikkan kehadiran.</div></div>';
          }
        }
      }

      var stats = [
        { lbl: 'Hadir',   ico: '✅', val: hadirTot, sub: me.HP ? me.HP + ' pengganti' : '', col: '#15803d', bg: '#f0fdf4', bd: '#bbf7d0' },
        { lbl: 'Singkat', ico: '⏱️', val: me.DS,    sub: '',                                col: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
        { lbl: 'Izin',    ico: '✉️', val: me.I,     sub: '',                                col: '#1d4ed8', bg: '#eff6ff', bd: '#bfdbfe' },
        { lbl: 'Alpa',    ico: '⚠️', val: me.A,     sub: '',                                col: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
      ];
      var statsHtml = '<div class="ks-stats">' + stats.map(function(c) {
        return '<div class="ks-stat" style="background:' + c.bg + ';border-color:' + c.bd + '">' +
          '<div class="v" style="color:' + c.col + '">' + c.val + '</div>' +
          '<div class="l" style="color:' + c.col + '">' + c.ico + ' ' + c.lbl + '</div>' +
          (c.sub ? '<div class="s">' + window.esc(c.sub) + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';

      var U = window.HQ.AbsensiGuruUtil;
      var todayStr = _ksTodayJakarta();
      var sq = (d.tanggal_list || []).map(function(t) {
        var units = (me.cells && me.cells[t]) || [];
        if (t > todayStr) return '';
        var wd = _ksWeekday(t), we = (wd === 0 || wd === 6) ? ' we' : '';
        var isToday = (t === todayStr) ? ' today' : '';
        var lbl = units.length
          ? units.map(function(u){ return U.meta(u.status).label + (u.nama_halaqah ? ' · ' + u.nama_halaqah : ''); }).join(' | ')
          : 'tak ada sesi';
        return '<span class="ks-sq' + we + isToday + '" style="background:' + _ksDayColor(units) + '" title="' +
          window.esc(_KS_HARI_FULL[wd] + ', ' + Number(t.slice(8,10)) + ' ' + _KS_NAMA_BULAN[d.bulan-1] + ': ' + lbl) + '"></span>';
      }).join('');
      var legendItems = [
        ['#22c55e','Hadir'], ['#f59e0b','Singkat'], ['#3b82f6','Izin'], ['#ef4444','Alpa'], ['#d1d5db','Libur'], ['#9ca3af','Perlu ditutup'],
      ];
      var stripHtml =
        '<div class="ks-strip-wrap">' +
          '<div class="ks-strip-ttl">Kehadiran harian bulan ini</div>' +
          '<div class="ks-strip">' + sq + '</div>' +
          '<div class="ks-legend">' + legendItems.map(function(l){ return '<span><i style="background:' + l[0] + '"></i>' + l[1] + '</span>'; }).join('') + '</div>' +
        '</div>';

      var detUnits = [];
      Object.keys(me.cells || {}).forEach(function(t){
        if (t > todayStr) return;
        (me.cells[t] || []).forEach(function(u){ detUnits.push(u); });
      });
      detUnits.sort(function(a,b){ return b.tanggal.localeCompare(a.tanggal) || (a.nama_halaqah||'').localeCompare(b.nama_halaqah||''); });
      var detailHtml = '';
      if (detUnits.length) {
        var rowsHtml = detUnits.map(function(u){
          var meta = U.meta(u.status), flags = U.flags(u);
          var wd = _ksWeekday(u.tanggal), dd = Number(u.tanggal.slice(8,10));
          var jenis = u.status === '_DRAFT' ? 'Sesi belum ditutup'
                    : u.status === 'A'      ? 'Tidak ada sesi (Alpa)'
                    : u.status === 'I'      ? (u.keterangan || 'Izin / Libur')
                    : u.status === 'L'      ? 'Libur'
                    : (u.jenis_sesi || 'KBM Reguler');
          var showDur = (u.status === 'H' || u.status === 'DS' || u.status === 'HP');
          var dur = showDur ? (u.durasi_menit != null ? u.durasi_menit + ' mnt' : 'tak terukur') : '';
          var metaLine = [];
          if (u.nama_halaqah) metaLine.push('📍 ' + window.esc(u.nama_halaqah));
          if (u.override) metaLine.push('✍️ koreksi admin');
          else if (u.keterangan && u.status !== 'I') metaLine.push(window.esc(u.keterangan));

          var actions = '';
          if (u.id_halaqah) {
            var jzn = (u.jenis_sesi || 'KBM Reguler').replace(/'/g, '');
            if (u.status === 'A') {
              actions = '<div class="ks-dr-actions">' +
                '<button type="button" class="ks-izin-btn" onclick="window.ksTandaiIzin(\'' + window.esc(u.id_halaqah) + '\',\'' + window.esc(u.tanggal) + '\',\'' + window.esc(jzn) + '\')">✉️ Tandai Izin (uzur)</button>' +
                '<button type="button" class="ks-susul-btn" disabled title="Tandai Izin dulu agar bisa dibuatkan kelas pengganti" style="opacity:.45;cursor:not-allowed">▶ Buka sesi susulan</button>' +
              '</div>';
            } else if (u.status === 'I' && _ksSisaPengganti(u.id_halaqah, jzn) > 0) {
              actions = '<div class="ks-dr-actions">' +
                '<button type="button" class="ks-susul-btn" onclick="window.ksBukaSusulan(\'' + window.esc(u.id_halaqah) + '\',\'' + window.esc(jzn) + '\')">▶ Buka sesi susulan</button>' +
              '</div>';
            }
          }
          return '<div class="ks-detail-row" style="border-left-color:' + meta.color + '">' +
            '<div class="ks-detail-row-date"><div class="d">' + dd + '</div><div class="w">' + _KS_HARI_FULL[wd].slice(0,3) + '</div></div>' +
            '<div class="ks-dr-body">' +
              '<div class="ks-dr-jenis">' + window.esc(jenis) + (flags ? ' <span style="font-size:11px">' + flags + '</span>' : '') + '</div>' +
              (metaLine.length ? '<div class="ks-dr-meta">' + metaLine.join(' · ') + '</div>' : '') +
            '</div>' +
            '<div class="ks-dr-badge" style="color:' + meta.color + ';background:' + meta.bg + '">' + meta.label +
              (dur ? '<span class="dur">' + dur + '</span>' : '') +
            '</div>' +
            actions +
          '</div>';
        }).join('');
        detailHtml =
          '<div class="ks-detail">' +
            '<button type="button" class="ks-detail-toggle" id="ksDetailToggle" aria-expanded="' + (_ksDetailOpen ? 'true' : 'false') + '" onclick="window.ksToggleDetail()">' +
              '<span class="ks-strip-ttl" style="margin:0">📋 Rincian sesi · ' + detUnits.length + ' sesi</span>' +
              '<span class="ks-caret" id="ksDetailCaret"' + (_ksDetailOpen ? ' style="transform:rotate(90deg)"' : '') + '>▸</span>' +
            '</button>' +
            '<div class="ks-detail-list" id="ksDetailList"' + (_ksDetailOpen ? '' : ' style="display:none"') + '>' + rowsHtml + '</div>' +
          '</div>';
      }

      var callouts = '';
      if (me.perlu_ditutup > 0) {
        callouts += '<div class="ks-callout" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a">' +
          '<span class="ic">⏳</span><div><strong>' + me.perlu_ditutup + ' sesi lampau belum ditutup.</strong> ' +
          'Sesi ini belum dihitung sampai kamu tuntaskan penilaiannya.</div></div>';
      }
      var izinDiganti = me.izin_diganti || 0;
      var izinSisa = Math.max(0, me.I - me.HP);
      if (izinDiganti > 0) {
        callouts += '<div class="ks-callout" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0">' +
          '<span class="ic">✅</span><div><strong>' + izinDiganti + ' Izin sudah ditebus kelas pengganti</strong> — tidak menurunkan persentase kehadiranmu.</div></div>';
      }
      if (izinSisa > 0) {
        callouts += '<div class="ks-callout" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a">' +
          '<span class="ic">🔁</span><div>Masih ada <strong>' + izinSisa + ' Izin</strong> yang perlu ditebus dengan kelas pengganti agar tidak menurunkan persentase.</div></div>';
      }

      var hqAgg = {};
      Object.keys(me.cells || {}).forEach(function(t){
        if (t > todayStr) return;
        (me.cells[t] || []).forEach(function(u){
          if (!u.id_halaqah) return;
          var a = hqAgg[u.id_halaqah] || (hqAgg[u.id_halaqah] = { nama: u.nama_halaqah || u.id_halaqah, H:0, DS:0, HP:0, I:0, A:0 });
          if (u.status === 'H') a.H++; else if (u.status === 'DS') a.DS++;
          else if (u.status === 'HP') a.HP++; else if (u.status === 'I') a.I++; else if (u.status === 'A') a.A++;
        });
      });
      var hqRows = Object.keys(hqAgg).map(function(id){
        var a = hqAgg[id]; var had = a.H + a.DS + a.HP; var den = had + a.I + a.A;
        a.pct = den > 0 ? Math.round(had / den * 100) : null; a.had = had; a.den = den;
        a.stale = (had === 0 && a.A >= 3);
        return a;
      }).sort(function(x,y){ return (y.A - x.A) || ((x.pct==null?101:x.pct) - (y.pct==null?101:y.pct)); });
      var hqHtml = '';
      if (hqRows.length > 1) {
        hqHtml = '<div class="ks-hq-wrap"><div class="ks-strip-ttl">Kehadiran per halaqah</div>' +
          hqRows.map(function(a){
            var s = _ksStatus(a.pct);
            var row = '<div class="ks-hq">' +
              '<div class="nm">' + window.esc(a.nama) + '</div>' +
              '<div class="bar"><i style="width:' + (a.pct==null?0:a.pct) + '%;background:' + s.bar + '"></i></div>' +
              '<div class="pc" style="color:' + s.bar + '">' + (a.pct==null?'–':a.pct+'%') + '</div>' +
              '<div class="ct">' + a.had + '/' + a.den + (a.A?' · '+a.A+' alpa':'') + '</div>' +
            '</div>';
            if (a.stale) row += '<div class="ks-hq-warn"><span>⚠️</span><div><strong>' + window.esc(a.nama) + '</strong> terjadwal tapi belum pernah ada sesi bulan ini (' + a.A + ' Alpa). Bila halaqah ini sudah tidak berjalan, minta admin menonaktifkan jadwalnya agar tidak menggerus kehadiranmu.</div></div>';
            return row;
          }).join('') + '</div>';
      }

      var note =
        '<div class="ks-note">Dihitung otomatis dari sesi KBM yang kamu tutup (Kajian At-Tibyan tidak dihitung). ' +
        '<strong>Kehadiran</strong> = hadir dibanding seluruh sesi yang seharusnya kamu ampu (Alpa menurunkannya; ' +
        'Izin yang sudah ditebus kelas pengganti tidak dihitung). ' +
        '<strong>Durasi tertunaikan</strong> menilai mutu sesi yang sudah dijalankan — sesi dengan durasi ≥ ' + d.ambang + ' menit. ' +
        '<span style="color:var(--text-3)">Catatan: kuota kelas pengganti bersifat akumulatif (lintas bulan), sehingga pengganti yang ditunaikan bulan ini bisa menebus libur bulan sebelumnya.</span></div>';

      document.getElementById('ksBody').innerHTML = hero + nudge + statsHtml + hqHtml + stripHtml + detailHtml + callouts + note;
      card.style.display = '';
      
      // KBM Page refresh trigger if available
      var jData = window.jadwalData;
      if (typeof window.renderJadwal === 'function' && jData && jData.length) {
        window.renderJadwal();
      }
    } catch (e) {
      if (!fromNav) card.style.display = 'none';
    } finally { _ksBusy = false; }
  }

  // ── EXPOSE PUBLIC INTERFACE TO WINDOW ──
  window.switchJdTab = switchJdTab;
  window.initJadwalPage = initJadwalPage;
  window.initJdBulanan = initJdBulanan;
  window.jdKalNav = jdKalNav;
  window.pilihJdTanggal = pilihJdTanggal;

  window.ksNavBulan = ksNavBulan;
  window.ksToggleDetail = ksToggleDetail;
  window.ksBukaSusulan = ksBukaSusulan;
  window.ksTandaiIzin = ksTandaiIzin;
  window.loadKehadiranSaya = loadKehadiranSaya;
})();
