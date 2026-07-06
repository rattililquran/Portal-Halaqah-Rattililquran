/**
 * murid/spp-module.js
 * Modul SPP, Transparansi Dana, & Keuangan Murid Portal Halaqah Rattililqur'an
 */
(function() {
  'use strict';

  var _sppLoaded = false;
  var _sppData = null;
  var _sppFormJenis = 'SPP Pribadi';
  var _sppBuktiBlob = null; // compressed image blob
  var _sppManualOpen = false;
  var _sppMetode = 'qris';
  var _sppPendingSubmit = null;

  async function loadSPP() {
    if (_sppLoaded) return; // skip jika sudah dimuat (hindari CORS spam saat auto-refresh)
    var user = window.HQ.getCurrentUser();
    try {
      var r = await window.HQ.MuridAPI.getSPPStatus();
      if (r && r.status === 'error') {
        console.error('SPP Load Error from Backend:', r.message);
        return;
      }
      if (!r || !r.data) return; // SPP belum dikonfigurasi
      renderSPP(r.data);
      loadTransparansi();
      _sppLoaded = true; // tandai sudah berhasil
    } catch(e) {
      console.error('SPP load exception:', e.message);
    }
  }

  // Panel transparansi dana untuk para Muhsinin (semua murid)
  async function loadTransparansi() {
    var card = document.getElementById('transparansiCard');
    if (!card) return;
    try {
      var r = await window.HQ.MuridAPI.getTransparansiDana({});
      var d = r && r.data; if (!d) return;
      var fmt = function(n){ return 'Rp ' + (Number(n)||0).toLocaleString('id-ID'); };
      document.getElementById('transBulanLabel').textContent = d.bulan + ' ' + d.tahun;
      document.getElementById('transInfaq').textContent = fmt(d.infaq_bulanan);
      document.getElementById('transOperasional').textContent = fmt(d.operasional_total);
      var sisa = Number(d.sisa)||0;
      document.getElementById('transSisa').textContent = sisa < 0 ? '−' + fmt(Math.abs(sisa)) : fmt(sisa);
      var beasiswa_count = d.beasiswa_count || 0;
      var note = 'Alhamdulillaah, per hari ini ada <b>' + beasiswa_count + '</b> murid yang menerima beasiswa.';
      if (sisa > 0) {
        note += '<br><span style="font-size:9.5px;color:var(--text-3);margin-top:2px;display:block">(Sisa disalurkan rata ke guru pengajar beasiswa)</span>';
      } else if (sisa < 0) {
        note += '<br><span style="font-size:9.5px;color:var(--text-3);margin-top:2px;display:block">(Kekurangan nominal ditanggung Rattililqur\'an)</span>';
      }
      document.getElementById('transSisaNote').innerHTML = note;
      var items = d.operasional_items || [];
      document.getElementById('transOpList').innerHTML = !items.length
        ? '<div style="text-align:center;padding:8px;color:var(--text-3);font-size:11.5px">Belum ada rincian operasional bulan ini.</div>'
        : items.map(function(it){
            return '<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:8px">'
              + '<span style="font-size:11.5px;color:var(--text-2);font-weight:600">' + esc(it.keterangan) + '</span>'
              + '<span style="font-size:11.5px;color:#b91c1c;font-weight:800;white-space:nowrap">Rp ' + (Number(it.nominal)||0).toLocaleString('id-ID') + '</span>'
              + '</div>';
          }).join('');
      card.style.display = 'block';
    } catch(e) { console.error('loadTransparansi', e); }
  }

  function switchSppTab(tab) {
    document.getElementById('sppTabSpp').className   = 'spp-jenis-tab' + (tab==='spp'?' active':'');
    document.getElementById('sppTabInfaq').className = 'spp-jenis-tab' + (tab==='infaq'?' active':'');
    document.getElementById('sppPanelSpp').style.display   = tab==='spp'?'':'none';
    document.getElementById('sppPanelInfaq').style.display = tab==='infaq'?'':'none';
  }

  function setSppFormJenis(jenis, el) {
    _sppFormJenis = jenis;
    document.querySelectorAll('#sppFormJenisTab .spp-jenis-tab').forEach(function(t){ t.className='spp-jenis-tab'; });
    if (el) el.className = 'spp-jenis-tab active';
    var bulanWrap = document.getElementById('sppFormBulanWrap');
    var nominalInput = document.getElementById('sppFormNominal');
    
    if (jenis === 'SPP Pribadi') {
      if (bulanWrap) bulanWrap.style.display = '';
      updateSppBulanCount();
    } else {
      if (bulanWrap) bulanWrap.style.display = 'none';
      if (nominalInput) {
        nominalInput.value = '';
        nominalInput.readOnly = false;
        nominalInput.style.backgroundColor = '';
      }
    }
  }

  async function handleSppBuktiFile(input) {
    var file = input.files[0];
    if (!file) return;
    
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      showLoad('Mengonversi HEIC ke JPEG...');
      try {
        if (typeof heic2any === 'undefined') {
          await _loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js');
        }
        var conversionResult = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        var convertedFile = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        
        var baseName = file.name.substring(0, file.name.lastIndexOf('.'));
        var renamedFile = new File([convertedFile], baseName + '.jpg', { type: 'image/jpeg' });
        file = renamedFile;
      } catch (err) {
        console.error('HEIC conversion error:', err);
        alert('Gagal mengonversi foto HEIC: ' + err.message);
        input.value = '';
        hideLoad();
        return;
      } finally {
        hideLoad();
      }
    }

    var MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
      alert('Ukuran foto melebihi 5 MB. Pilih foto yang lebih kecil.');
      input.value = ''; return;
    }

    // Langsung lakukan kompresi gambar tanpa cropper
    showLoad('Memproses foto...');
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var max_size = 1000; // batasi dimensi maksimal (Opsi B - Ekonomis)
        var width = img.width;
        var height = img.height;
        
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(function(blob) {
          _sppBuktiBlob = blob;
          var url = URL.createObjectURL(blob);
          document.getElementById('sppBuktiImg').src = url;
          document.getElementById('sppBuktiPreview').style.display = '';
          document.getElementById('sppBuktiName').textContent = file.name;
          document.getElementById('sppBuktiLabel').style.borderColor = '#1a5c3a';
          document.getElementById('sppBuktiSize').textContent = 'Ukuran kompresi: ' + (blob.size/1024).toFixed(0) + ' KB';
          hideLoad();
        }, 'image/jpeg', 0.75);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearSppBukti() {
    _sppBuktiBlob = null;
    document.getElementById('sppFormBuktiFile').value = '';
    document.getElementById('sppBuktiPreview').style.display = 'none';
    document.getElementById('sppBuktiName').textContent = 'Klik untuk pilih foto';
    document.getElementById('sppBuktiLabel').style.borderColor = '';
  }

  function previewSppBukti() {
    var img = document.getElementById('sppBuktiImg');
    if (!img || !img.src) return;
    var overlay = document.getElementById('muridSppPreviewOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'muridSppPreviewOverlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.background = 'rgba(15, 23, 42, 0.95)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '10002';
      overlay.style.cursor = 'zoom-out';
      overlay.onclick = function() { overlay.style.display = 'none'; };
      
      var container = document.createElement('div');
      container.style.position = 'relative';
      container.style.maxWidth = '90%';
      container.style.maxHeight = '90%';
      
      var previewImg = document.createElement('img');
      previewImg.id = 'muridSppPreviewImg';
      previewImg.style.maxWidth = '100%';
      previewImg.style.maxHeight = '90dvh';
      previewImg.style.borderRadius = '12px';
      previewImg.style.border = '2px solid rgba(255,255,255,0.2)';
      previewImg.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
      
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '-12px';
      closeBtn.style.right = '-12px';
      closeBtn.style.width = '32px';
      closeBtn.style.height = '32px';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.background = '#ef4444';
      closeBtn.style.color = '#fff';
      closeBtn.style.border = 'none';
      closeBtn.style.fontSize = '16px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      
      container.appendChild(previewImg);
      container.appendChild(closeBtn);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
    }
    document.getElementById('muridSppPreviewImg').src = img.src;
    overlay.style.display = 'flex';
  }

  function salinNomor(nomor, btnId) {
    navigator.clipboard.writeText(nomor).then(function() {
      var btn = document.getElementById(btnId);
      if (!btn) return;
      var orig = btn.innerHTML;
      btn.innerHTML = '✅ Disalin!'; btn.className = 'spp-salin-btn copied';
      setTimeout(function(){ btn.innerHTML = orig; btn.className = 'spp-salin-btn'; }, 2000);
    }).catch(function() { alert('Salin manual: ' + nomor); });
  }

  function updateSppBulanCount() {
    var n = document.querySelectorAll('#sppBulanGrid input:checked').length;
    document.getElementById('sppBulanCount').textContent = n === 0 ? 'Pilih 1 atau lebih' : n + ' bulan dipilih';
    
    if (_sppFormJenis === 'SPP Pribadi') {
      var nominalInput = document.getElementById('sppFormNominal');
      if (nominalInput) {
        nominalInput.value = n > 0 ? n * 75000 : '';
        nominalInput.readOnly = true;
        nominalInput.style.backgroundColor = 'var(--border)';
      }
    }
  }
  function getSppBulanSelected() {
    return Array.from(document.querySelectorAll('#sppBulanGrid input:checked')).map(function(c){ return c.value; });
  }
  function getSppMetodeSelected() {
    var el = document.querySelector('input[name="sppMetodeTransfer"]:checked');
    return el ? el.value : '';
  }
  function updateSppMetode(el) {
    if (typeof triggerHaptic === 'function') triggerHaptic('selection');
  }

  function setSppFormMetode(metode, el) {
    _sppMetode = metode;
    _sppManualOpen = (metode === 'manual');
    
    document.querySelectorAll('#sppFormMetodeTab .spp-jenis-tab').forEach(function(t){ t.className='spp-jenis-tab'; });
    if (el) el.className = 'spp-jenis-tab active';
    
    // Tampilkan/sembunyikan kolom manual
    document.querySelectorAll('.spp-manual-only').forEach(function(el) {
      el.style.display = _sppManualOpen ? '' : 'none';
    });
    
    // Tampilkan/sembunyikan gateway footer vs manual footer
    var gatewayContainer = document.getElementById('sppGatewayContainer');
    if (gatewayContainer) gatewayContainer.style.display = _sppManualOpen ? 'none' : 'flex';
    var gatewaySubtext = document.getElementById('sppGatewaySubtext');
    if (gatewaySubtext) gatewaySubtext.style.display = _sppManualOpen ? 'none' : '';

    var footer = document.getElementById('sppManualFooter');
    if (footer) footer.style.display = _sppManualOpen ? 'flex' : 'none';
    
    if (_sppManualOpen) {
      var sheet = document.querySelector('#sppKonfirmasiModal .modal-sheet');
      if (sheet) setTimeout(function(){ sheet.scrollTop = sheet.scrollHeight; }, 50);
    }
  }

  // Fallback untuk backward compatibility
  function toggleSppManual() {
    var nextMetode = _sppMetode === 'qris' ? 'manual' : 'qris';
    var tabEl = document.querySelector('#sppFormMetodeTab .spp-jenis-tab:' + (nextMetode === 'qris' ? 'first-child' : 'last-child'));
    setSppFormMetode(nextMetode, tabEl);
  }

  async function bukaModalKonfirmasiSPP() {
    _sppFormJenis = 'SPP Pribadi';
    _sppBuktiBlob = null;
    
    // Reset tab metode ke QRIS
    var tabQris = document.querySelector('#sppFormMetodeTab .spp-jenis-tab:first-child');
    setSppFormMetode('qris', tabQris);

    document.querySelectorAll('#sppFormJenisTab .spp-jenis-tab').forEach(function(t,i){ t.className='spp-jenis-tab'+(i===0?' active':''); });
    document.getElementById('sppFormBulanWrap').style.display = '';
    // Reset checkboxes & radio
    document.querySelectorAll('#sppBulanGrid input').forEach(function(c){ c.checked=false; });
    document.querySelectorAll('input[name="sppMetodeTransfer"]').forEach(function(r){ r.checked=false; });
    
    var nominalInput = document.getElementById('sppFormNominal');
    if (nominalInput) {
      nominalInput.value = '';
      nominalInput.readOnly = true;
      nominalInput.style.backgroundColor = 'var(--border)';
    }
    
    updateSppBulanCount();
    document.getElementById('sppFormCatatan').value  = '';
    document.getElementById('sppFormBuktiFile').value = '';
    document.getElementById('sppBuktiPreview').style.display = 'none';
    document.getElementById('sppBuktiName').textContent = 'Klik untuk pilih foto';
    document.getElementById('sppBuktiLabel').style.borderColor = '';
    document.getElementById('sppFormErr').style.display = 'none';
    openModal('sppKonfirmasiModal');
    applyBeasiswaModeModal();
    // Reset scroll ke atas agar header tidak terpotong
    var _sppSheet = document.querySelector('#sppKonfirmasiModal .modal-sheet');
    if (_sppSheet) _sppSheet.scrollTop = 0;

    // Disable bulan yang sudah lunas/menunggu
    try {
      var sppSt = await window.HQ.MuridAPI.getSPPStatus();
      var grid  = sppSt.data && sppSt.data.bulan_grid || [];
      document.querySelectorAll('#sppBulanGrid .spp-bulan-check').forEach(function(label) {
        var inp = label.querySelector('input');
        if (!inp) return;
        var bulan = inp.value;
        var info  = grid.find(function(g){ return g.bulan === bulan; });
        var st    = info ? info.status : 'belum';
        label.classList.remove('lunas','menunggu');
        if (st === 'lunas' || st === 'menunggu') {
          label.classList.add(st);
          inp.disabled = true;
          inp.checked  = false;
        } else {
          inp.disabled = false;
        }
      });
    } catch(e) { /* gagal load status — biarkan semua aktif */ }

    // Load metode bayar dengan timeout 8 detik
    try {
      var _metodeTimeout = new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout')); }, 8000); });
      var r = await Promise.race([window.HQ.MuridAPI.getMetodeBayar(), _metodeTimeout]);
      var metode = r.data || [];
      var wrap = document.getElementById('sppMetodeInfo');
      var list = document.getElementById('sppMetodeList');
      if (!metode.length) { wrap.style.display='none'; return; }
      if (_sppManualOpen) wrap.style.display = '';
      list.innerHTML = metode.map(function(m, i) {
        var btnId = 'salinBtn' + i;
        if (m.jenis === 'qris') {
          return '<div class="spp-metode-card" style="text-align:center">'
            + '<div class="spp-metode-bank">QRIS · ' + esc(m.nama) + '</div>'
            + (m.atas_nama ? '<div class="spp-metode-nama">' + esc(m.atas_nama) + '</div>' : '')
            + (m.qris_url
              ? '<img src="' + esc(m.qris_url) + '" class="spp-qris-img" alt="QR Code" loading="lazy">'
              : '<div style="margin:10px 0;padding:14px;background:#f1f5f9;border-radius:8px;font-size:12px;color:var(--text-3)">QR Code belum tersedia</div>')
            + '</div>';
        }
        return '<div class="spp-metode-card">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
          + '<div>'
          + '<div class="spp-metode-bank">' + esc(m.bank||m.nama) + '</div>'
          + '<div class="spp-metode-nomor">' + esc(m.nomor||'—') + '</div>'
          + (m.atas_nama ? '<div class="spp-metode-nama">a/n ' + esc(m.atas_nama) + '</div>' : '')
          + '</div>'
          + (m.nomor ? '<button class="spp-salin-btn" id="' + btnId + '" onclick="salinNomor(\'' + esc(m.nomor) + '\',\'' + btnId + '\')">'
            + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
            + ' Salin</button>' : '')
          + '</div></div>';
      }).join('');
    } catch(e) { /* silent */ }
  }

  function tutupModalKonfirmasiSPP() { closeModal('sppKonfirmasiModal'); }

  function tutupSppSummaryModal() {
    document.getElementById('sppSummaryModal').style.display = 'none';
  }

  async function submitKonfirmasiSPP() {
    var jenis   = _sppFormJenis;
    var currentMonthName = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][new Date().getMonth()];
    var bulan   = jenis === 'SPP Pribadi' ? getSppBulanSelected() : [currentMonthName];
    var metode  = getSppMetodeSelected();
    var tahun   = document.getElementById('sppFormTahun').value;
    var nominal = document.getElementById('sppFormNominal').value;
    var catatan = document.getElementById('sppFormCatatan').value.trim();
    var errEl   = document.getElementById('sppFormErr');

    if (jenis === 'SPP Pribadi' && !bulan.length) { errEl.textContent='Pilih minimal 1 bulan.'; errEl.style.display=''; return; }
    if (!metode) { errEl.textContent='Pilih metode pembayaran.'; errEl.style.display=''; return; }
    if (metode !== 'Cash' && !_sppBuktiBlob) { errEl.textContent='Bukti transfer wajib diunggah.'; errEl.style.display=''; return; }
    if (!nominal || Number(nominal) <= 0) { errEl.textContent='Nominal pembayaran tidak valid.'; errEl.style.display=''; return; }
    errEl.style.display = 'none';

    // Store data for final submit
    _sppPendingSubmit = { jenis: jenis, bulan: bulan, metode: metode, tahun: tahun, nominal: nominal, catatan: catatan };

    // Populate Summary Modal
    document.getElementById('sumSppJenis').textContent = jenis;
    document.getElementById('sumSppBulan').textContent = jenis === 'SPP Pribadi' ? bulan.join(', ') : '—';
    document.getElementById('sumSppBulanRow').style.display = jenis === 'SPP Pribadi' ? '' : 'none';
    document.getElementById('sumSppTahun').textContent = tahun;
    document.getElementById('sumSppMetode').textContent = metode;
    document.getElementById('sumSppNominal').textContent = 'Rp ' + Number(nominal).toLocaleString('id-ID');
    
    var cat = catatan.trim();
    document.getElementById('sumSppCatatan').textContent = cat || 'Tidak ada catatan';
    document.getElementById('sumSppCatatanRow').style.display = cat ? '' : 'none';

    var sumImg = document.getElementById('sumSppBuktiImg');
    var sumWrapper = document.getElementById('sumSppBuktiWrapper');
    var sumNoBukti = document.getElementById('sumSppNoBukti');

    if (_sppBuktiBlob) {
      sumImg.src = URL.createObjectURL(_sppBuktiBlob);
      sumWrapper.style.display = 'block';
      sumNoBukti.style.display = 'none';
    } else {
      sumWrapper.style.display = 'none';
      sumNoBukti.style.display = 'block';
      if (metode === 'Cash') {
        sumNoBukti.textContent = 'ℹ️ Tanpa lampiran foto bukti (opsional untuk Cash)';
        sumNoBukti.style.background = 'var(--bg-2,#f8fafc)';
        sumNoBukti.style.borderColor = 'var(--border)';
        sumNoBukti.style.color = 'var(--text-3)';
      } else {
        sumNoBukti.textContent = '⚠️ Lampiran bukti transfer belum dipilih!';
        sumNoBukti.style.background = '#fef2f2';
        sumNoBukti.style.borderColor = '#fecaca';
        sumNoBukti.style.color = '#ef4444';
      }
    }

    // Open Summary Modal
    document.getElementById('sppSummaryModal').style.display = 'flex';
  }

  async function bayarViaGateway() {
    var jenis   = _sppFormJenis;
    var currentMonthName = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][new Date().getMonth()];
    var bulan   = jenis === 'SPP Pribadi' ? getSppBulanSelected() : [currentMonthName];
    var tahun   = document.getElementById('sppFormTahun').value;
    var nominal = document.getElementById('sppFormNominal').value;
    var errEl   = document.getElementById('sppFormErr');

    if (jenis === 'SPP Pribadi' && !bulan.length) { errEl.textContent='Pilih minimal 1 bulan.'; errEl.style.display=''; return; }
    if (!nominal || Number(nominal) <= 0) { errEl.textContent='Nominal pembayaran tidak valid.'; errEl.style.display=''; return; }
    errEl.style.display = 'none';

    var btn = document.getElementById('btnBayarGateway');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Membuat tagihan...'; }
    showLoad('Menyiapkan pembayaran...');
    try {
      var result = await window.HQ.MuridAPI.createPaymentGateway({
        jenis: jenis, bulan: bulan, tahun: tahun, nominal: Number(nominal)
      });
      hideLoad();
      tutupModalKonfirmasiSPP();
      // Redirect ke halaman pembayaran Mayar
      window.location.href = result.payment_link;
    } catch(e) {
      hideLoad();
      errEl.textContent = e.message || 'Gagal membuat tagihan. Coba lagi.';
      errEl.style.display = '';
      if (btn) { btn.disabled = false; btn.innerHTML = '<span style="font-size:16px">⚡</span> Bayar via QRIS'; }
    }
  }

  async function kirimSppFinal() {
    if (!_sppPendingSubmit) return;
    var d = _sppPendingSubmit;
    var errEl = document.getElementById('sppFormErr');
    
    var btn = document.getElementById('btnSppFinalSubmit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengirim...'; }
    
    showLoad('Mengunggah bukti...');
    try {
      var buktiUrl = '';
      if (_sppBuktiBlob) {
        var uid    = window.HQ.getCurrentUser() && window.HQ.getCurrentUser().id_user || 'unknown';
        var fname  = uid + '/' + Date.now() + '.jpg';
        var { data: upData, error: upErr } = await window.HQ.supabase.storage
          .from('bukti-spp').upload(fname, _sppBuktiBlob, { contentType:'image/jpeg', upsert:true });
        if (upErr) throw new Error('Upload foto gagal: ' + upErr.message);
        var { data: urlData } = window.HQ.supabase.storage.from('bukti-spp').getPublicUrl(fname);
        buktiUrl = urlData && urlData.publicUrl || '';
      }

      showLoad('Mengirim konfirmasi...');
      await window.HQ.MuridAPI.konfirmasiSPP({ 
        jenis: d.jenis, 
        bulan: d.bulan, 
        metode_transfer: d.metode, 
        tahun: d.tahun, 
        nominal: d.nominal, 
        bukti_url: buktiUrl, 
        catatan: d.catatan 
      });
      
      tutupSppSummaryModal();
      tutupModalKonfirmasiSPP();
      toast('Konfirmasi terkirim, menunggu validasi admin ✅', 'ok');
      triggerHaptic('success');
      _sppLoaded = false;
      loadSPP();
    } catch(e) { 
      errEl.textContent = e.message || 'Gagal mengirim.'; 
      errEl.style.display = ''; 
      tutupSppSummaryModal(); // return to form to show error
    } finally { 
      hideLoad(); 
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Ya, Kirim Sekarang'; }
    }
  }

  function renderSPP(data) {
    if (!data) return;
    _sppData = data;
    var card  = document.getElementById('sppCard');
    var grid  = document.getElementById('sppBulanGridDisplay');
    var badge = document.getElementById('sppBadge');
    if (!card || !grid) return;
    card.style.display = 'block';

    var bulanBerjalan = new Date().getMonth() + 1;

    var bulanGrid    = data.bulan_grid || [];
    var lunasBulan   = data.lunas_bulan || [];
    var menungguBulan= data.menunggu_bulan || [];
    var lunasCount   = bulanGrid.filter(function(b){ return b.status === 'lunas'; }).length;
    var tunggakan       = (data.tunggakan !== undefined) ? data.tunggakan : Math.max(0, 5 - lunasCount);
    var totalBulanLevel = (data.window_size !== undefined && data.window_size > 0) ? data.window_size : 5;

    // ── Donut chart ──
    var circ = 2 * Math.PI * 15; // 94.25
    var pct  = totalBulanLevel > 0 ? (lunasCount / totalBulanLevel) : 0;
    var arc  = document.getElementById('sppDonutArc');
    var num  = document.getElementById('sppDonutNum');
    var titleEl = document.getElementById('sppDonutTitle');
    var subEl   = document.getElementById('sppDonutSub');
    if (arc) {
      var dashLen = pct * circ;
      arc.setAttribute('stroke-dasharray', dashLen + ' ' + (circ - dashLen));
      arc.setAttribute('stroke', tunggakan===0?'#10b981': tunggakan>=3?'#ef4444':'#f59e0b');
    }
    if (num) num.textContent = tunggakan;
    if (titleEl) titleEl.textContent = tunggakan===0 ? 'SPP Lunas ✅' : tunggakan + ' bulan belum lunas';
    if (subEl)   subEl.textContent = lunasCount + ' dari ' + totalBulanLevel + ' bulan sudah terbayar';

    // Badge
    if (badge) {
      badge.className = 'badge ' + (tunggakan===0?'b-green':tunggakan>=3?'b-red':'b-amber');
      badge.textContent = tunggakan===0 ? '✅ Lunas' : '⚠ ' + tunggakan + ' bulan';
    }

    // ── Grid 12 bulan ──
    var BNAME = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    var bulanMulaiIdx = (data.bulan_mulai_idx !== undefined) ? data.bulan_mulai_idx : 0;
    grid.innerHTML = (bulanGrid || []).map(function(b, i) {
      var sudahMulai = i >= bulanMulaiIdx;
      var lewat      = (i + 1) <= bulanBerjalan;
      var ico  = b.status==='lunas' ? '✅' : b.status==='menunggu' ? '⏳' : (sudahMulai && lewat ? '❌' : '○');
      var cls  = b.status==='lunas' ? 'spp-lunas' : b.status==='menunggu' ? 'spp-menunggu' : 'spp-belum';
      return '<div class="spp-bulan ' + cls + '" title="' + b.bulan + '">'
        + '<span class="spp-bulan-ico">' + ico + '</span>'
        + '<span>' + BNAME[i] + '</span>'
        + '</div>';
    }).join('');

    // ── Infaq list ──
    var rows     = data.rows || [];
    var infaqRows= rows.filter(function(r){ return r.jenis !== 'SPP Pribadi'; });
    var infaqEl  = document.getElementById('sppInfaqList');
    if (infaqEl) {
      infaqEl.innerHTML = !infaqRows.length
        ? '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">Belum ada data infaq.</div>'
        : infaqRows.map(function(r) {
            var statusCls = r.status==='lunas'?'color:#065f46':r.status==='menunggu'?'color:#92400e':'color:#991b1b';
            var nominal = r.nominal ? 'Rp ' + Number(r.nominal).toLocaleString('id-ID') : '—';
            return '<div class="spp-infaq-item">'
              + '<div><div style="font-size:13px;font-weight:700;color:var(--text)">' + esc(r.jenis||'Infaq') + '</div>'
              + '<div style="font-size:11px;color:var(--text-3)">' + esc(r.catatan||r.bulan||'') + ' · ' + (r.tanggal_bayar||r.created_at||'').substring(0,10) + '</div></div>'
              + '<div style="text-align:right"><div style="font-size:13px;font-weight:800;color:var(--text)">' + nominal + '</div>'
              + '<div style="font-size:10px;font-weight:700;' + statusCls + '">' + (r.status==='lunas'?'✅ Terkonfirmasi':r.status==='menunggu'?'⏳ Menunggu':'❌ Ditolak') + '</div></div>'
              + '</div>';
          }).join('');
    }

    applyBeasiswaMode();
  }

  function isBeasiswaMurid() {
    var user = window.HQ.getCurrentUser();
    var isFth = !!(user && user.id_user && user.id_user.toUpperCase().startsWith('FTH'));
    var dashData = window.dashData || null;
    return isFth || !!(dashData && dashData.anggota && dashData.anggota.tipe_spp === 'beasiswa');
  }

  var BEASISWA_PANEL_HTML =
    '<div style="padding:4px 2px">'
    + '<div style="text-align:center;margin-bottom:12px">'
    +   '<div style="font-size:30px">🤲</div>'
    +   '<div style="font-size:15px;font-weight:800;color:#b45309;margin-top:2px">Beasiswa Penuh Rattililqur\'an</div>'
    + '</div>'
    + '<p style="font-size:12.5px;line-height:1.7;color:var(--text-2);text-align:center;margin:0 0 10px">Alhamdulillah, atas taufiq dari Allah, biaya belajar Anda telah ditanggung sepenuhnya oleh para <b>Muhsinin</b> — saudara-saudara yang berinfaq dengan ikhlas agar Anda terus belajar Al-Qur\'an.</p>'
    + '<p style="font-size:12.5px;line-height:1.7;color:var(--text-2);text-align:center;margin:0 0 12px">Maka jadikanlah ini sebagai <b>amanah</b>: hadirlah dengan sungguh-sungguh, jagalah adab, dan teruslah berkembang. Setiap kemajuan Anda adalah buah dari kebaikan mereka.</p>'
    + '<div style="background:linear-gradient(180deg,#fffbeb,#f0fdf4);border:1px solid rgba(180,83,9,.18);border-radius:14px;padding:14px 12px;text-align:center;margin-bottom:12px">'
    +   '<div dir="rtl" lang="ar" style="font-family:\'Amiri\',\'Scheherazade New\',\'Traditional Arabic\',\'Geeza Pro\',serif;font-size:24px;line-height:2;color:#7c4a03">ثُمَّ لَتُسْأَلُنَّ يَوْمَئِذٍ عَنِ ٱلنَّعِيمِ</div>'
    +   '<div style="font-size:11.5px;font-style:italic;color:var(--text-3);margin-top:8px;line-height:1.6">"Kemudian kamu benar-benar akan ditanya pada hari itu tentang kenikmatan (yang kamu nikmati di dunia)."</div>'
    +   '<div style="font-size:11px;font-weight:700;color:#b45309;margin-top:4px">— QS. At-Takāṡur: 8</div>'
    + '</div>'
    + '<p style="font-size:12px;line-height:1.6;color:var(--text-2);text-align:center;margin:0 0 6px">Sisihkan doa terbaik untuk para Muhsinin — semoga Allah membalas kebaikan mereka berlipat ganda. 🌱</p>'
    + '<div style="text-align:center;font-size:13px;font-weight:800;color:#059669">Baarakallahu fiikum 💛</div>'
    + '</div>';

  var DAURAH_PANEL_HTML =
    '<div style="padding:4px 2px">'
    + '<div style="text-align:center;margin-bottom:12px">'
    +   '<div style="font-size:30px">📖</div>'
    +   '<div style="font-size:15px;font-weight:800;color:#0369a1;margin-top:2px">Daurah Al-Fatihah Rattililqur\'an</div>'
    + '</div>'
    + '<p style="font-size:12.5px;line-height:1.7;color:var(--text-2);text-align:center;margin:0 0 10px">Alhamdulillah, program akselerasi bacaan Surah Al-Fatihah ini diselenggarakan secara <b>gratis / tanpa biaya pendaftaran</b> bagi seluruh peserta.</p>'
    + '<p style="font-size:12.5px;line-height:1.7;color:var(--text-2);text-align:center;margin:0 0 12px">Maka jadikanlah ini sebagai <b>amanah</b>: hadirlah dengan sungguh-sungguh pada 7 pertemuan ini, jagalah adab, dan teruslah berkembang demi menyempurnakan rukun shalat kita.</p>'
    + '<div style="background:linear-gradient(180deg,#f0f9ff,#f0fdf4);border:1px solid rgba(3,105,161,.18);border-radius:14px;padding:14px 12px;text-align:center;margin-bottom:12px">'
    +   '<div style="font-size:11.5px;color:var(--text-2);line-height:1.6">Bagi rekan-rekan peserta yang memiliki kelapangan rezeki dan ingin ikut mendukung biaya operasional penyelenggaraan daurah, manajemen menyediakan wadah <b>Infaq Sukarela / Operasional</b> di bawah ini.</div>'
    + '</div>'
    + '<p style="font-size:12px;line-height:1.6;color:var(--text-2);text-align:center;margin:0 0 6px">Setiap infaq yang terkumpul akan digunakan sepenuhnya untuk menunjang kegiatan belajar-mengajar dan memuliakan para pengajar.</p>'
    + '<div style="text-align:center;font-size:13px;font-weight:800;color:#0284c7">Baarakallahu fiikum 💛</div>'
    + '</div>';

  function applyBeasiswaMode() {
    var tabSpp   = document.getElementById('sppTabSpp');
    var tabsBar  = document.querySelector('#sppCard .spp-jenis-tabs');
    var body     = document.querySelector('#sppCard .spp-body');
    var btn      = document.querySelector('.spp-konfirm-btn');
    var badge    = document.getElementById('sppBadge');
    var old = document.getElementById('sppBeasiswaPanel');
    if (old) old.remove();
    if (!isBeasiswaMurid()) {
      if (tabsBar) tabsBar.style.display = '';
      if (tabSpp)  tabSpp.style.display = '';
      return;
    }
    var user = window.HQ.getCurrentUser();
    var isFth = !!(user && user.id_user && user.id_user.toUpperCase().startsWith('FTH'));
    if (tabsBar) tabsBar.style.display = 'none';
    if (badge) {
      badge.className = 'badge b-green';
      badge.textContent = isFth ? '🎓 Daurah' : '🎓 Beasiswa';
    }
    if (body) {
      var panel = document.createElement('div');
      panel.id = 'sppBeasiswaPanel';
      panel.style.marginBottom = '14px';
      panel.innerHTML = isFth ? DAURAH_PANEL_HTML : BEASISWA_PANEL_HTML;
      body.insertBefore(panel, body.firstChild);
    }
    switchSppTab('infaq');
    if (btn) btn.innerHTML = '💛 Bayar Infaq';
  }

  function applyBeasiswaModeModal() {
    var tabs = document.querySelectorAll('#sppFormJenisTab .spp-jenis-tab');
    if (!isBeasiswaMurid()) { if (tabs[0]) tabs[0].style.display = ''; return; }
    if (tabs[0]) tabs[0].style.display = 'none';
    if (tabs[1]) { tabs[1].style.display = ''; setSppFormJenis('Infaq/Operasional', tabs[1]); }
  }

  // Safe Property Getters/Setters for legacy access
  try { delete window._sppLoaded; Object.defineProperty(window, '_sppLoaded', { get: function() { return _sppLoaded; }, set: function(v) { _sppLoaded = v; }, configurable: true }); } catch(e) { window._sppLoaded = _sppLoaded; }
  try { delete window._sppData; Object.defineProperty(window, '_sppData', { get: function() { return _sppData; }, set: function(v) { _sppData = v; }, configurable: true }); } catch(e) { window._sppData = _sppData; }
  try { delete window._sppFormJenis; Object.defineProperty(window, '_sppFormJenis', { get: function() { return _sppFormJenis; }, set: function(v) { _sppFormJenis = v; }, configurable: true }); } catch(e) { window._sppFormJenis = _sppFormJenis; }

  // Expose public functions to window
  window.loadSPP = loadSPP;
  window.loadTransparansi = loadTransparansi;
  window.switchSppTab = switchSppTab;
  window.setSppFormJenis = setSppFormJenis;
  window.handleSppBuktiFile = handleSppBuktiFile;
  window.clearSppBukti = clearSppBukti;
  window.previewSppBukti = previewSppBukti;
  window.salinNomor = salinNomor;
  window.updateSppBulanCount = updateSppBulanCount;
  window.getSppBulanSelected = getSppBulanSelected;
  window.getSppMetodeSelected = getSppMetodeSelected;
  window.updateSppMetode = updateSppMetode;
  window.setSppFormMetode = setSppFormMetode;
  window.toggleSppManual = toggleSppManual;
  window.bukaModalKonfirmasiSPP = bukaModalKonfirmasiSPP;
  window.tutupModalKonfirmasiSPP = tutupModalKonfirmasiSPP;
  window.tutupSppSummaryModal = tutupSppSummaryModal;
  window.submitKonfirmasiSPP = submitKonfirmasiSPP;
  window.bayarViaGateway = bayarViaGateway;
  window.kirimSppFinal = kirimSppFinal;
  window.renderSPP = renderSPP;
  window.isBeasiswaMurid = isBeasiswaMurid;
  window.applyBeasiswaMode = applyBeasiswaMode;
  window.applyBeasiswaModeModal = applyBeasiswaModeModal;
})();
