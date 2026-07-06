/**
 * Modul Peninjauan PR & Jurnal Guru (pr-jurnal-module.js)
 * Portal Halaqah Rattililquran
 */
(function() {
  'use strict';

  // State local module
  var _prData = [];
  var _prDataFiltered = [];
  var _selectedPrId = null;
  var _prDataAll = [];
  var _collapsedPrGroups = {};

  var _mediaRecorderGuru = null;
  var _recordedChunksGuru = [];
  var _rekamanBlobGuru = null;
  var _durasiIntervalGuru = null;
  var _detikRekamGuru = 0;

  var _activeAudioPlayers = {};
  var _audioBlobCache = {};
  var _hapusExistingGuruAudio = false;
  var _penggantiPendingRows = [];

  function getHalaqahList() {
    return (window.HQ && window.HQ.AppState && window.HQ.AppState.halaqahList) || window.halaqahList || [];
  }

  async function loadPRSubmissions() {
    const halaqahSelEl = document.getElementById('prHalaqahSel');
    const halaqahId = halaqahSelEl ? halaqahSelEl.value : '';
    const tbody = document.getElementById('prSubmissionsTbl');
    if (tbody) {
      tbody.innerHTML = Array(5).fill(`<tr>${Array(8).fill('<td><div class="skel skel-row" style="height:12px;border-radius:6px"></div></td>').join('')}</tr>`).join('');
    }
    showLoad('Bismillah, memuat tugas & PR murid...');
    try {
      let mergedData = [];
      const halaqahList = getHalaqahList();
      if (halaqahList && halaqahList.length > 0) {
        const promises = halaqahList.map(h => 
          window.HQ.GuruAPI.getHalaqahPRSubmissions(h.id_halaqah)
            .then(res => {
              const data = res.data || [];
              return data.map(item => ({ ...item, nama_halaqah: h.nama_halaqah }));
            })
            .catch(err => {
              console.error('Gagal memuat PR halaqah:', h.nama_halaqah, err);
              return [];
            })
        );
        const results = await Promise.all(promises);
        results.forEach(res => {
          mergedData = mergedData.concat(res);
        });
      }
      mergedData.sort((a, b) => new Date(b.pr_submitted_at || 0) - new Date(a.pr_submitted_at || 0));
      _prDataAll = mergedData;
      window._prDataAll = _prDataAll;
      
      const chipRow = document.getElementById('prPertemuanChipRow');
      if (chipRow) {
        const uniquePertemuan = [...new Set(mergedData.map(i => i.pertemuan_ke).filter(p => p != null))].sort((a, b) => a - b);
        if (uniquePertemuan.length > 0) {
          const currentVal = document.getElementById('prPertemuanFilter')?.value || '';
          let chips = '<span class="pr-chip-label">Pertemuan ke-</span>';
          chips += `<button class="pr-chip${currentVal === '' ? ' active' : ''}" onclick="switchPrPertemuanChip('', this)">Semua</button>`;
          uniquePertemuan.forEach(p => {
            chips += `<button class="pr-chip${currentVal === String(p) ? ' active' : ''}" onclick="switchPrPertemuanChip('${p}', this)">${p}</button>`;
          });
          chipRow.innerHTML = chips;
          chipRow.style.display = 'flex';
        } else {
          chipRow.style.display = 'none';
        }
      }
      
      renderPRSummaryCards();
      filterPRSubmissions();
      checkHalaqahPRBadge().catch(function() {});
    } catch (e) {
      toast('Gagal memuat tugas PR: ' + e.message, 'err');
    } finally {
      hideLoad();
    }
  }

  function filterPRSubmissions() {
    const halaqahSelEl = document.getElementById('prHalaqahSel');
    const halaqahId = halaqahSelEl ? halaqahSelEl.value : '';
    const status = document.getElementById('prStatusFilter') ? document.getElementById('prStatusFilter').value : '';
    const pertemuan = document.getElementById('prPertemuanFilter')?.value || '';
    const search = document.getElementById('prSearchInput') ? document.getElementById('prSearchInput').value.toLowerCase().trim() : '';
    
    _prData = halaqahId ? _prDataAll.filter(item => item.id_halaqah === halaqahId) : _prDataAll;
    window._prData = _prData;
    
    _prDataFiltered = _prData.filter(item => {
      if (status === 'belum_dinilai' && item.pr_status !== 'selesai') return false;
      if (status === 'telah_dinilai' && item.pr_status !== 'dinilai') return false;
      if (status === 'belum_mengerjakan' && item.pr_status !== 'belum') return false;
      
      if (pertemuan && String(item.pertemuan_ke) !== pertemuan) return false;
      
      const nama = (item.users?.nama_lengkap || '').toLowerCase();
      if (search && !nama.includes(search)) return false;
      
      return true;
    });
    window._prDataFiltered = _prDataFiltered;
    
    renderPRSubmissions();
  }

  function salinRekapanPRGrup() {
    const belumMengerjakan = _prData.filter(item => item.pr_status === 'belum');
    
    if (belumMengerjakan.length === 0) {
      quickToast('Alhamdulillah, semua murid sudah mengerjakan PR!', 'ok');
      return;
    }
    
    const halaqahSelEl = document.getElementById('prHalaqahSel');
    const halaqahId = halaqahSelEl ? halaqahSelEl.value : '';
    let namaHalaqah = 'Semua Halaqah';
    const halaqahList = getHalaqahList();
    if (halaqahId) {
      const hObj = halaqahList.find(h => h.id_halaqah === halaqahId);
      if (hObj) {
        namaHalaqah = hObj.nama_halaqah;
      }
    }
    
    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = new Date();
    const namaHari = days[today.getDay()];
    const tanggalSkg = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const tglFull = `${namaHari}, ${tanggalSkg}`;
    
    let text = `📋 *REKAPAN PR BELUM DIKERJAKAN* 📋\n`;
    text += `*Halaqah:* ${namaHalaqah}\n`;
    text += `*Tanggal:* ${tglFull}\n\n`;
    text += `Berikut daftar murid yang belum mengumpulkan laporan PR:\n`;
    
    belumMengerjakan.forEach((item, index) => {
      const namaMurid = item.users?.nama_lengkap || '–';
      const prText = (item.kbm_log && item.kbm_log.latihan_mandiri) || '';
      const tglText = fmtDate(item.tanggal);
      const detailHalaqah = halaqahId ? '' : ` [${item.nama_halaqah || '–'}]`;
      text += `${index + 1}. *${namaMurid}*${detailHalaqah} (Pertemuan ${item.pertemuan_ke} - ${tglText})\n`;
      text += `   👉 PR: ${prText}\n`;
    });
    
    text += `\nMohon kerja samanya untuk segera menyelesaikan tugas dan mengirimkan laporannya via portal murid ya. Jazakumullahu khairan. 😊`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          quickToast('Rekapan berhasil disalin ke clipboard!', 'ok');
        })
        .catch(err => {
          console.error('Gagal menyalin:', err);
          fallbackCopyTextToClipboard(text);
        });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  }

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        quickToast('Rekapan berhasil disalin!', 'ok');
      } else {
        quickToast('Gagal menyalin rekapan.', 'err');
      }
    } catch (err) {
      console.error('Fallback gagal:', err);
      quickToast('Gagal menyalin rekapan.', 'err');
    }
    document.body.removeChild(textArea);
  }

  function switchPrStatusTab(status, btn) {
    const input = document.getElementById('prStatusFilter');
    if (input) input.value = status;
    
    document.querySelectorAll('.pr-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    filterPRSubmissions();
  }

  function switchPrPertemuanChip(val, btn) {
    const input = document.getElementById('prPertemuanFilter');
    if (input) input.value = val;
    
    document.querySelectorAll('#prPertemuanChipRow .pr-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    filterPRSubmissions();
  }

  function renderPRSummaryCards() {
    const container = document.getElementById('prSummaryCards');
    if (!container) return;
    
    let totalWaiting = 0;
    let totalTodo = 0;
    
    const statsMap = {};
    const halaqahList = getHalaqahList();
    if (halaqahList) {
      halaqahList.forEach(h => {
        statsMap[h.id_halaqah] = { name: h.nama_halaqah, waiting: 0, todo: 0 };
      });
    }
    
    _prDataAll.forEach(item => {
      if (item.pr_status === 'selesai') {
        totalWaiting++;
        if (statsMap[item.id_halaqah]) statsMap[item.id_halaqah].waiting++;
      } else if (item.pr_status === 'belum') {
        totalTodo++;
        if (statsMap[item.id_halaqah]) statsMap[item.id_halaqah].todo++;
      }
    });
    
    const currentHalaqahId = document.getElementById('prHalaqahSel') ? document.getElementById('prHalaqahSel').value : '';
    
    let html = `
      <div class="pr-sum-card ${currentHalaqahId === '' ? 'active' : ''}" onclick="selectHalaqahCard('')">
        <div class="pr-sum-card-title">📚 Semua Halaqah</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap">
          <span class="pr-sum-card-badge waiting">⏳ ${totalWaiting}</span>
          <span class="pr-sum-card-badge todo">💤 ${totalTodo}</span>
        </div>
      </div>
    `;
    
    if (halaqahList) {
      halaqahList.forEach(h => {
        const stats = statsMap[h.id_halaqah] || { name: h.nama_halaqah, waiting: 0, todo: 0 };
        html += `
          <div class="pr-sum-card ${currentHalaqahId === h.id_halaqah ? 'active' : ''}" onclick="selectHalaqahCard('${esc(h.id_halaqah)}')">
            <div class="pr-sum-card-title" title="${esc(h.nama_halaqah)}">📚 ${esc(h.nama_halaqah)}</div>
            <div style="display:flex;align-items:center;flex-wrap:wrap">
              <span class="pr-sum-card-badge waiting">⏳ ${stats.waiting}</span>
              <span class="pr-sum-card-badge todo">💤 ${stats.todo}</span>
            </div>
          </div>
        `;
      });
    }
    
    container.innerHTML = html;
  }

  function selectHalaqahCard(id_halaqah) {
    const selEl = document.getElementById('prHalaqahSel');
    if (selEl) selEl.value = id_halaqah;
    filterPRSubmissions();
    renderPRSummaryCards();
  }

  function togglePrGroupCollapse(safeId) {
    _collapsedPrGroups[safeId] = !_collapsedPrGroups[safeId];
    
    const rows = document.querySelectorAll(`.pr-group-row-${safeId}`);
    rows.forEach(r => {
      r.style.display = _collapsedPrGroups[safeId] ? 'none' : '';
    });
    
    const ico = document.getElementById(`pr-group-ico-${safeId}`);
    if (ico) {
      if (_collapsedPrGroups[safeId]) {
        ico.classList.add('collapsed');
      } else {
        ico.classList.remove('collapsed');
      }
    }
  }

  function renderPRSubmissions() {
    const tbody = document.getElementById('prSubmissionsTbl');
    if (!tbody) return;
    
    if (_prDataFiltered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada tugas / PR yang cocok dengan kriteria filter.</td></tr>`;
      return;
    }
    
    const groups = {};
    _prDataFiltered.forEach(item => {
      const hName = item.nama_halaqah || 'Lainnya';
      if (!groups[hName]) groups[hName] = [];
      groups[hName].push(item);
    });
    
    let html = '';
    
    Object.keys(groups).forEach(hName => {
      const items = groups[hName];
      const safeId = hName.replace(/[^a-zA-Z0-9]/g, '_');
      const isCollapsed = _collapsedPrGroups[safeId] || false;
      
      const uniqueStudents = [...new Set(items.map(item => item.id_murid || item.users?.nama_lengkap))].filter(Boolean).length;
      const taskCount = items.length;
      
      html += `
        <tr class="pr-group-header" onclick="togglePrGroupCollapse('${safeId}')">
          <td colspan="8">
            <div class="pr-group-title">
              <span>📚 <strong>${esc(hName)}</strong> <small style="color:var(--text-3);font-weight:600;margin-left:6px">(${uniqueStudents} murid · ${taskCount} tugas)</small></span>
              <span class="pr-group-toggle-ico ${isCollapsed ? 'collapsed' : ''}" id="pr-group-ico-${safeId}">▼</span>
            </div>
          </td>
        </tr>
      `;
      
      items.forEach(item => {
        const namaMurid = item.users?.nama_lengkap || '–';
        const tglKbm = fmtDate(item.tanggal);
        const sesiKe = `<span class="badge b-blue">Pertemuan ${item.pertemuan_ke}</span>`;
        
        const deadline = item.kbm_log?.deadline_latihan;
        const submittedAt = item.pr_submitted_at;
        let lateTag = '';
        if (submittedAt && deadline) {
          const subDate = submittedAt.slice(0, 10);
          if (subDate > deadline) {
            lateTag = `<br><span class="badge b-red" style="font-size:9px;padding:2px 6px;margin-top:4px" title="Guru tidak ada kewajiban mengoreksi tugas yang terlambat dikumpulkan.">🔴 Terlambat</span>`;
          }
        }
        
        const waktuKirim = item.pr_submitted_at ? (fmtDateTime(item.pr_submitted_at) + lateTag) : '–';
        const catatanMurid = item.pr_catatan_murid ? `<div style="font-size:12px;font-style:italic;max-width:180px;white-space:pre-wrap;color:var(--text-2)">"${esc(item.pr_catatan_murid)}"</div>` : '–';
        
        let lampiranHTML = '–';
        if (item.pr_lampiran_url) {
          const isAudio = item.pr_lampiran_url.includes('drive.google.com') || /\.(webm|mp3|wav|m4a|mp4|ogg)($|\?)/i.test(item.pr_lampiran_url);
          if (isAudio && item.pr_lampiran_url.includes('id=')) {
            const fileId = item.pr_lampiran_url.split('id=')[1].split('&')[0];
            const containerId = 'audio-container-guru-' + fileId;
            lampiranHTML = `
              <div id="${containerId}" style="width:100%; max-width:240px; min-height:40px; display:flex; align-items:center;">
                <button class="btn btn-outline btn-sm" onclick="putarAudioInline('${containerId}', '${fileId}')" style="color:var(--blue);border-color:var(--blue);width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
                  ▶️ Putar Rekaman
                </button>
              </div>
            `;
          } else {
            lampiranHTML = `<a href="${esc(item.pr_lampiran_url)}" target="_blank" class="btn btn-outline btn-sm" style="color:var(--blue);border-color:var(--blue)">📂 Buka Lampiran</a>`;
          }
        }
        
        let statusHTML = '';
        if (item.pr_status === 'selesai') {
          statusHTML = `<span class="badge" style="background:rgba(245,158,11,0.15);color:#d97706;font-weight:700">Menunggu Penilaian</span>`;
        } else if (item.pr_status === 'dinilai') {
          const isSesuai = item.pr_status_nilai === 'Sesuai';
          const color = isSesuai ? 'var(--green)' : 'var(--red)';
          const bg = isSesuai ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
          const hasGuruAudio = item.pr_lampiran_guru_url ? ' 🎙️' : '';
          statusHTML = `
            <div style="display:flex;flex-direction:column;gap:2px">
              <span class="badge" style="background:${bg};color:${color};font-weight:700">${esc(item.pr_status_nilai)}${hasGuruAudio}</span>
              ${item.pr_catatan_guru ? `<small style="font-size:10px;color:var(--text-3);max-width:120px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(item.pr_catatan_guru)}">💬 ${esc(item.pr_catatan_guru)}</small>` : ''}
            </div>
          `;
        } else {
          statusHTML = `<span class="badge" style="background:rgba(148,163,184,0.15);color:#64748b;font-weight:700">Belum Dikerjakan</span>`;
        }
        
        const actionText = item.pr_status === 'dinilai' ? '✏️ Ubah Nilai' : '✏️ Beri Nilai';
        let actionBtn = `<button class="btn btn-outline btn-sm" onclick="bukaFormKoreksiPR('${esc(item.id_nilai)}')" style="color:var(--blue);border-color:var(--blue);width:100%">${actionText}</button>`;
        if (item.pr_status === 'belum' && item.no_wa) {
          let formattedPhone = String(item.no_wa).replace(/\D/g, '');
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.slice(1);
          }
          const prText = (item.kbm_log && item.kbm_log.latihan_mandiri) || '';
          const tglText = fmtDate(item.tanggal);
          const waMsg = `Assalamu'alaikum ${namaMurid},\n\nMengingatkan untuk tugas Latihan Mandiri: *"${prText}"* (Pertemuan ${item.pertemuan_ke} - KBM Tanggal ${tglText}).\nMohon segera diselesaikan dan dikirimkan laporannya melalui portal murid ya.\n\nJazakallahu khairan.`;
          const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waMsg)}`;
          actionBtn += `
            <a href="${waLink}" target="_blank" class="btn btn-outline btn-sm" style="color:#16a34a;border-color:#16a34a;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:4px;width:100%">
              💬 Hubungi WA
            </a>
          `;
        }
        
        html += `
          <tr class="pr-group-row-${safeId}" style="${isCollapsed ? 'display:none' : ''}">
            <td><strong>${esc(namaMurid)}</strong></td>
            <td>${tglKbm}</td>
            <td>${sesiKe}</td>
            <td>${waktuKirim}</td>
            <td>${catatanMurid}</td>
            <td>${lampiranHTML}</td>
            <td>${statusHTML}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      });
    });
    
    tbody.innerHTML = html;
  }

  function fmtDateTime(d) {
    if (!d) return '–';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).substring(0, 16);
      return dt.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) + ' ' + 
             dt.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    } catch(e) {
      return String(d).substring(0, 16);
    }
  }

  function bukaFormKoreksiPR(id_nilai) {
    const item = _prData.find(x => x.id_nilai === id_nilai);
    if (!item) return;
    
    _selectedPrId = id_nilai;
    window._selectedPrId = _selectedPrId;
    _hapusExistingGuruAudio = false;
    
    document.getElementById('prModalNamaMurid').textContent = item.users?.nama_lengkap || '–';
    document.getElementById('prModalDetailSesi').textContent = `Pertemuan ke-${item.pertemuan_ke} (${fmtDate(item.tanggal)})`;
    document.getElementById('prModalCatatanMurid').textContent = item.pr_catatan_murid || '(Tidak ada catatan dari murid)';
    
    document.getElementById('prModalStatusNilai').value = item.pr_status_nilai || 'Sesuai';
    document.getElementById('prModalCatatanGuru').value = item.pr_catatan_guru || '';
    
    const audioGroup = document.getElementById('prModalAudioGroup');
    const iframeWadah = document.getElementById('prModalIframeWadah');
    
    if (item.pr_lampiran_url) {
      const isAudio = item.pr_lampiran_url.includes('drive.google.com') || /\.(webm|mp3|wav|m4a|mp4|ogg)($|\?)/i.test(item.pr_lampiran_url);
      if (isAudio && item.pr_lampiran_url.includes('id=')) {
        const fileId = item.pr_lampiran_url.split('id=')[1].split('&')[0];
        const containerId = 'audio-container-modal-' + fileId;
        iframeWadah.innerHTML = `
          <div id="${containerId}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:10px;">
            <button class="btn btn-outline" onclick="putarAudioInline('${containerId}', '${fileId}')" style="color:var(--blue);border-color:var(--blue);width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
              ▶️ Putar Rekaman
            </button>
          </div>
        `;
        audioGroup.style.display = 'block';
      } else {
        iframeWadah.innerHTML = '';
        audioGroup.style.display = 'none';
      }
    } else {
      iframeWadah.innerHTML = '';
      audioGroup.style.display = 'none';
    }

    hapusRekamanLokalGuru();
    
    const existingWadah = document.getElementById('existingGuruAudioWadah');
    const existingContainer = document.getElementById('existingGuruAudioContainer');
    if (item.pr_lampiran_guru_url) {
      existingWadah.style.display = 'block';
      if (item.pr_lampiran_guru_url.includes('id=')) {
        const gFileId = item.pr_lampiran_guru_url.split('id=')[1].split('&')[0];
        const gContainerId = 'audio-container-guru-existing-' + gFileId;
        existingContainer.innerHTML = `
          <div id="${gContainerId}" style="margin-top:4px;">
            <button class="btn btn-outline btn-sm" onclick="putarAudioInline('${gContainerId}', '${gFileId}')" style="color:var(--blue);border-color:var(--blue);width:100%">
              ▶️ Putar Rekaman Ustadz
            </button>
          </div>
        `;
      } else {
        existingContainer.innerHTML = `<a href="${esc(item.pr_lampiran_guru_url)}" target="_blank" class="btn btn-outline btn-sm" style="color:var(--blue);border-color:var(--blue);width:100%">📂 Buka Rekaman Ustadz</a>`;
      }
    } else {
      existingWadah.style.display = 'none';
      existingContainer.innerHTML = '';
    }
    
    openModal('peninjauanPrModal');
  }

  function closePRModal() {
    const iframeWadah = document.getElementById('prModalIframeWadah');
    if (iframeWadah) {
      const audios = iframeWadah.querySelectorAll('audio');
      audios.forEach(function(aud) {
        try { aud.pause(); } catch(e){}
      });
      iframeWadah.innerHTML = '';
    }
    
    if (_mediaRecorderGuru && _mediaRecorderGuru.state !== "inactive") {
      try { _mediaRecorderGuru.stop(); } catch(e){}
    }
    if (_durasiIntervalGuru) {
      clearInterval(_durasiIntervalGuru);
      _durasiIntervalGuru = null;
    }
    hapusRekamanLokalGuru();
    
    closeModal('peninjauanPrModal');
  }

  function mulaiPerekamanGuru() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        _recordedChunksGuru = [];
        let mime = "audio/webm";
        if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mime)) {
          if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
          else if (MediaRecorder.isTypeSupported("audio/wav")) mime = "audio/wav";
        }
        
        _mediaRecorderGuru = new MediaRecorder(stream, { mimeType: mime });
        _mediaRecorderGuru.ondataavailable = function(e) {
          if (e.data.size > 0) _recordedChunksGuru.push(e.data);
        };
        
        _mediaRecorderGuru.onstop = function() {
          _rekamanBlobGuru = new Blob(_recordedChunksGuru, { type: mime });
          const audioUrl = URL.createObjectURL(_rekamanBlobGuru);
          const player = document.getElementById('audioPreviewGuru');
          if (player) {
            player.src = audioUrl;
            document.getElementById('playerWadahGuru').style.display = 'block';
          }
          stream.getTracks().forEach(function(track) { track.stop(); });
        };

        _mediaRecorderGuru.start();
        _detikRekamGuru = 0;
        document.getElementById('durasiRekamGuru').textContent = "00:00";
        document.getElementById('btnMulaiRekamGuru').style.display = 'none';
        document.getElementById('btnHentikanRekamGuru').style.display = 'flex';
        document.getElementById('statusRekamGuru').textContent = "🔴 Perekaman berjalan...";
        
        _durasiIntervalGuru = setInterval(function() {
          _detikRekamGuru++;
          const m = String(Math.floor(_detikRekamGuru / 60)).padStart(2, '0');
          const s = String(_detikRekamGuru % 60).padStart(2, '0');
          document.getElementById('durasiRekamGuru').textContent = m + ":" + s;
        }, 1000);
      })
      .catch(function(err) {
        toast("Gagal mengakses mikrofon: " + err.message, "err");
      });
  }

  function hentikanPerekamanGuru() {
    if (_mediaRecorderGuru && _mediaRecorderGuru.state !== "inactive") {
      _mediaRecorderGuru.stop();
    }
    if (_durasiIntervalGuru) {
      clearInterval(_durasiIntervalGuru);
      _durasiIntervalGuru = null;
    }
    document.getElementById('btnMulaiRekamGuru').style.display = 'flex';
    document.getElementById('btnMulaiRekamGuru').textContent = "🔴 Rekam Ulang";
    document.getElementById('btnHentikanRekamGuru').style.display = 'none';
    document.getElementById('statusRekamGuru').textContent = "⏹️ Rekaman selesai";
  }

  function hapusRekamanLokalGuru() {
    _rekamanBlobGuru = null;
    _recordedChunksGuru = [];
    const player = document.getElementById('audioPreviewGuru');
    if (player) player.src = '';
    document.getElementById('playerWadahGuru').style.display = 'none';
    document.getElementById('statusRekamGuru').textContent = "";
    document.getElementById('btnMulaiRekamGuru').textContent = "🔴 Rekam Suara";
    document.getElementById('btnMulaiRekamGuru').style.display = 'flex';
  }

  function tandaiHapusExistingGuruAudio() {
    _hapusExistingGuruAudio = true;
    document.getElementById('existingGuruAudioWadah').style.display = 'none';
    toast("Rekaman lama ditandai untuk dihapus saat disimpan.", "warn");
  }

  function renderAudioPlayerDOM(container, containerId, fileId, blobUrl, mimeType) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
        <audio controls style="width:100%; height:36px;" id="audio-el-${containerId}">
          <source src="${blobUrl}" type="${mimeType}">
          Peramban Anda tidak mendukung pemutar suara.
        </audio>
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span style="color:var(--text-3)">Kecepatan:</span>
          <select style="background:var(--bg-2); border:1px solid var(--border); border-radius:4px; padding:2px 4px; font-size:11px; color:var(--text);" 
                  onchange="document.getElementById('audio-el-${containerId}').playbackRate = parseFloat(this.value)">
            <option value="1.0">1.0x (Normal)</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>
      </div>
    `;

    const audioEl = document.getElementById(`audio-el-${containerId}`);
    if (audioEl) {
      _activeAudioPlayers[containerId] = audioEl;
      audioEl.play().catch(function(err) {
        console.warn("Autoplay dicegah oleh peramban:", err);
      });
    }
  }

  async function putarAudioInline(containerId, fileId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    for (let cId in _activeAudioPlayers) {
      if (cId !== containerId && _activeAudioPlayers[cId]) {
        try {
          _activeAudioPlayers[cId].pause();
        } catch(e){}
        delete _activeAudioPlayers[cId];
      }
    }

    if (_audioBlobCache[fileId]) {
      const cached = _audioBlobCache[fileId];
      renderAudioPlayerDOM(container, containerId, fileId, cached.blobUrl, cached.mimeType);
      return;
    }

    container.innerHTML = `<div style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:6px">` +
      `<span class="spinner" style="border: 2px solid rgba(0,0,0,0.1); border-left-color: var(--blue); border-radius: 50%; width: 14px; height: 14px; display: inline-block; animation: spin 1s linear infinite;"></span>` +
      `<span>Memuat rekaman...</span>` +
      `</div>` +
      `<style>` +
      `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` +
      `</style>`;

    try {
      const tokRes = await window.HQ.MuridAPI.getLatihanUploadToken();
      if (!tokRes || !tokRes.token) {
        throw new Error("Gagal mengambil token keamanan.");
      }
      const uploadToken = tokRes.token;

      const gasUrl = "https://script.google.com/macros/s/AKfycbwtY2wL-JSwKU1rmrJBOoa_3JNsRibn5CARn6Fq3gfuD_CztOhx5vW6zbqc0Z_hgjj7/exec";
      const fetchUrl = `${gasUrl}?id=${fileId}&token=${uploadToken}`;

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error("Koneksi ke server penyimpanan gagal.");
      }

      const result = await res.json();
      if (result.status !== "success" || !result.base64Data) {
        throw new Error(result.message || "Gagal mengunduh file rekaman.");
      }

      const mimeType = result.mimeType || "audio/webm";
      const binaryStr = atob(result.base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      _audioBlobCache[fileId] = { blobUrl: blobUrl, mimeType: mimeType };

      renderAudioPlayerDOM(container, containerId, fileId, blobUrl, mimeType);
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div style="color: var(--red); font-size: 11px; margin-bottom: 4px;">⚠️ Gagal memuat audio: ${err.message || 'Koneksi error'}</div>
        <button class="btn btn-outline btn-sm" onclick="putarAudioInline('${containerId}', '${fileId}')" style="color:var(--blue);border-color:var(--blue);font-size:11px;padding:4px 8px">
          🔄 Coba Lagi
        </button>
      `;
    }
  }

  async function simpanPenilaianPR() {
    if (!_selectedPrId) return;
    
    const item = _prData.find(x => x.id_nilai === _selectedPrId);
    if (!item) return;

    const statusNilai = document.getElementById('prModalStatusNilai').value;
    const catatanGuru = document.getElementById('prModalCatatanGuru').value.trim();
    
    let lampiranGuruUrl = item.pr_lampiran_guru_url || null;
    if (_hapusExistingGuruAudio) {
      lampiranGuruUrl = null;
    }

    showLoad('Bismillah, menyimpan penilaian...');
    try {
      if (_rekamanBlobGuru) {
        showLoad('Bismillah, mengunggah rekaman guru... Mohon jangan tutup aplikasi.');
        
        const tokRes = await window.HQ.MuridAPI.getLatihanUploadToken();
        if (!tokRes || !tokRes.token) {
          throw new Error("Gagal mengambil token keamanan.");
        }
        const uploadToken = tokRes.token;
        
        const reader = new FileReader();
        const base64Promise = new Promise(function(resolve, reject) {
          reader.onloadend = function() {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(_rekamanBlobGuru);
        const base64Data = await base64Promise;
        
        const gasUrl = "https://script.google.com/macros/s/AKfycbwtY2wL-JSwKU1rmrJBOoa_3JNsRibn5CARn6Fq3gfuD_CztOhx5vW6zbqc0Z_hgjj7/exec";
        const uploadPayload = {
          token: uploadToken,
          base64Data: base64Data,
          fileName: "KOREKSI-GURU-" + _selectedPrId + "-" + Date.now() + "." + (_rekamanBlobGuru.type.split('/')[1] || "webm"),
          mimeType: _rekamanBlobGuru.type
        };
        
        const gasRes = await fetch(gasUrl, {
          method: "POST",
          mode: "cors",
          body: JSON.stringify(uploadPayload)
        });
        if (!gasRes.ok) {
          throw new Error("Koneksi ke server penyimpanan gagal.");
        }
        const uploadResult = await gasRes.json();
        
        if (uploadResult.status !== "success") {
          throw new Error(uploadResult.message || "Gagal mengunggah berkas suara guru.");
        }
        
        lampiranGuruUrl = uploadResult.url;
      }

      showLoad('Bismillah, menyimpan penilaian...');
      const res = await window.HQ.GuruAPI.nilaiPR(_selectedPrId, statusNilai, catatanGuru, lampiranGuruUrl);
      if (res.status === 'ok') {
        toast('Penilaian PR berhasil disimpan!', 'ok');
        closePRModal();
        await loadPRSubmissions();
      } else {
        toast('Gagal menyimpan penilaian: ' + res.message, 'err');
      }
    } catch (e) {
      toast('Gagal: ' + e.message, 'err');
    } finally {
      hideLoad();
    }
  }

  async function checkHalaqahPRBadge() {
    const halaqahList = getHalaqahList();
    if (!halaqahList || halaqahList.length === 0) return;
    let totalPending = 0;
    let totalBelum = 0;
    try {
      const promises = halaqahList.map(h => window.HQ.GuruAPI.getHalaqahPRSubmissions(h.id_halaqah));
      const results = await Promise.all(promises);
      results.forEach(r => {
        if (r.status === 'ok' && r.data) {
          totalPending += r.data.filter(item => item.pr_status === 'selesai').length;
          totalBelum += r.data.filter(item => (item.pr_status || 'belum') === 'belum').length;
        }
      });
      const badge = document.getElementById('navPrSubmissionBadge');
      if (badge) {
        if (totalPending > 0) {
          badge.textContent = totalPending;
          badge.classList.add('show');
        } else {
          badge.classList.remove('show');
        }
      }
      
      const cardVal = document.getElementById('st-peninjauan-pr');
      const cardSub = document.getElementById('st-peninjauan-pr-sub');
      if (cardVal) {
        cardVal.textContent = totalPending;
        cardVal.style.color = totalPending > 0 ? 'var(--blue)' : 'var(--green)';
      }
      if (cardSub) {
        let subText = totalPending > 0
          ? totalPending + ' tugas perlu dinilai'
          : 'Semua PR diperiksa';
        if (totalBelum > 0) {
          subText += ' · ' + totalBelum + ' murid belum mengerjakan';
        }
        cardSub.textContent = subText;
      }
    } catch (err) {
      console.error('Gagal mengecek badge PR:', err);
    }
  }

  function _updatePenggantiReminder(jadwal) {
    var card     = document.getElementById('statPengganti');
    var valEl    = document.getElementById('st-pengganti');
    var subEl    = document.getElementById('st-pengganti-sub');
    var rowEl    = document.getElementById('statsTopBaris2');
    if (!card) return;

    var rows = [];
    (jadwal || []).forEach(function(h) {
      var pending = h.pengganti_pending || {};
      Object.keys(pending).forEach(function(jenis) {
        (pending[jenis] || []).forEach(function(entry) {
          rows.push({ nama: h.nama_halaqah, jenis: jenis, tanggal: entry.tanggal_pertemuan, keterangan: entry.keterangan_libur });
        });
      });
    });
    _penggantiPendingRows = rows;

    if (rows.length > 0) {
      if (valEl) valEl.textContent = String(rows.length);
      if (subEl) subEl.textContent = rows.length === 1 ? rows[0].nama : rows.length + ' jadwal';
      card.style.display = '';
      if (rowEl) rowEl.classList.add('has-pengganti');
    } else {
      card.style.display = 'none';
      if (rowEl) rowEl.classList.remove('has-pengganti');
    }
  }

  function _showPenggantiReminderDetail() {
    if (!_penggantiPendingRows.length) return;
    var html = '<div style="font-size:13px;color:var(--text-2);margin-bottom:12px">'
      + 'Sesi berikut sudah ditandai <strong>libur</strong> dan tercatat sebagai sisa kelas pengganti yang belum digantikan:</div>'
      + _penggantiPendingRows.map(function(r) {
        return '<div style="display:flex;align-items:flex-start;gap:10px;background:var(--libur-bg);border:1px solid var(--libur-border);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
          + '<div style="font-size:18px;line-height:1">🔄</div>'
          + '<div style="flex:1">'
          + '<div style="font-size:13.5px;font-weight:800;color:var(--libur-title)">' + esc(r.nama) + '</div>'
          + '<div style="font-size:11.5px;font-weight:700;color:var(--libur-sub);margin-top:2px">' + esc(r.jenis) + ' · ' + fmtDate(r.tanggal) + '</div>'
          + (r.keterangan ? '<div style="font-size:12px;color:var(--libur-note);margin-top:4px;font-style:italic">' + esc(r.keterangan) + '</div>' : '')
          + '</div></div>';
      }).join('');

    showAlertModal('', { title: '🔄 Kelas Pengganti Belum Diganti', html: html });
  }

  function toggleReferensiJurnal() {
    const selEl = document.getElementById('jurnalJenisLatihan');
    const val = selEl ? selEl.value : '';
    const wadah = document.getElementById('wadahJurnalReferensi');
    if (wadah) {
      wadah.style.display = val !== '' ? 'block' : 'none';
    }
  }

  function applyJurnalPrTemplate(val) {
    const selectJenis = document.getElementById('jurnalJenisLatihan');
    const txtArea = document.getElementById('jurnalLatihanMandiri');
    if (!txtArea || !val) return;
    
    if (val === 'vn') {
      txtArea.value = 'Merekam dan mengirimkan setoran suara (VN) halaman/materi hari ini melalui portal untuk dikoreksi makhrajnya.';
      if (selectJenis) {
        selectJenis.value = 'Rekaman Portal';
        toggleReferensiJurnal();
      }
    } else if (val === 'murottal') {
      txtArea.value = 'Mendengarkan rekaman murottal/suara referensi ustadz sebanyak minimal 1 kali secara saksama.';
      if (selectJenis) {
        selectJenis.value = 'Mendengar dan membaca mandiri';
        toggleReferensiJurnal();
      }
    } else if (val === 'baca') {
      txtArea.value = 'Membaca mandiri (latihan berulang) materi/halaman tajwid hari ini sebanyak minimal 3 kali sebelum pertemuan berikutnya.';
      if (selectJenis) {
        selectJenis.value = 'Mendengar dan membaca mandiri';
        toggleReferensiJurnal();
      }
    }
    
    const deadlineInput = document.getElementById('jurnalDeadline');
    if (deadlineInput) {
      const today = new Date();
      const targetDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      deadlineInput.value = targetDate.toISOString().slice(0, 10);
    }
  }

  // ── EXPOSE PUBLIC INTERFACE ──────────────────────
  window.loadPRSubmissions = loadPRSubmissions;
  window.filterPRSubmissions = filterPRSubmissions;
  window.salinRekapanPRGrup = salinRekapanPRGrup;
  window.fallbackCopyTextToClipboard = fallbackCopyTextToClipboard;
  window.switchPrStatusTab = switchPrStatusTab;
  window.switchPrPertemuanChip = switchPrPertemuanChip;
  window.renderPRSummaryCards = renderPRSummaryCards;
  window.selectHalaqahCard = selectHalaqahCard;
  window.togglePrGroupCollapse = togglePrGroupCollapse;
  window.renderPRSubmissions = renderPRSubmissions;
  window.fmtDateTime = fmtDateTime;
  window.bukaFormKoreksiPR = bukaFormKoreksiPR;
  window.closePRModal = closePRModal;
  window.mulaiPerekamanGuru = mulaiPerekamanGuru;
  window.hentikanPerekamanGuru = hentikanPerekamanGuru;
  window.hapusRekamanLokalGuru = hapusRekamanLokalGuru;
  window.tandaiHapusExistingGuruAudio = tandaiHapusExistingGuruAudio;
  window.renderAudioPlayerDOM = renderAudioPlayerDOM;
  window.putarAudioInline = putarAudioInline;
  window.simpanPenilaianPR = simpanPenilaianPR;
  window.checkHalaqahPRBadge = checkHalaqahPRBadge;
  window._updatePenggantiReminder = _updatePenggantiReminder;
  window._showPenggantiReminderDetail = _showPenggantiReminderDetail;
  window.toggleReferensiJurnal = toggleReferensiJurnal;
  window.applyJurnalPrTemplate = applyJurnalPrTemplate;

  try {
    delete window._prData;
    Object.defineProperty(window, '_prData', {
      get: function() { return _prData; },
      set: function(val) { _prData = val; },
      configurable: true
    });
  } catch(e) { window._prData = _prData; }

  try {
    delete window._prDataFiltered;
    Object.defineProperty(window, '_prDataFiltered', {
      get: function() { return _prDataFiltered; },
      set: function(val) { _prDataFiltered = val; },
      configurable: true
    });
  } catch(e) { window._prDataFiltered = _prDataFiltered; }

  try {
    delete window._prDataAll;
    Object.defineProperty(window, '_prDataAll', {
      get: function() { return _prDataAll; },
      set: function(val) { _prDataAll = val; },
      configurable: true
    });
  } catch(e) { window._prDataAll = _prDataAll; }

})();
