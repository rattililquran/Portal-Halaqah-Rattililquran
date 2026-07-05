// ============================================================
//  guru/quiz-module.js  v1.0
//  Portal Guru — Rattil Quiz Management & Analytics
// ============================================================

(function () {
  'use strict';

  var _activeTab = 'kuis'; // 'kuis' | 'bank' | 'review' | 'laporan'
  var _selectedQuizId = null;

  // Filter state for bank soal
  var _bankFilterText = '';
  var _bankFilterLevel = '';
  var _bankFilterPertemuan = '';
  var _allBankSoalRaw = [];

  // Filter & bulk select state for quiz question picker
  var _pickerFilterText = '';
  var _pickerFilterLevel = '';
  var _pickerFilterPertemuan = '';
  var _pickerAvailableSoal = [];
  var _pickerSelectedSoalIds = new Set();
  var _currentQuizData = null;

  // ─────────────────────────────────────────────
  //  1. RENDER GURU QUIZ PAGE
  // ─────────────────────────────────────────────
  window.renderGuruQuizPage = async function () {
    var container = document.getElementById('page-kuis-guru');
    if (!container) return;

    container.innerHTML = `
      <div class="guru-quiz-container">
        <!-- Sub-header & Navigation Tabs -->
        <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:16px 20px;border:1px solid var(--border);box-shadow:var(--shadow);margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:var(--text)">🎯 Manajemen Rattil Quiz</h2>
              <p style="font-size:12px;color:var(--text-3)">Buat kuis latihan, kelola bank soal, & tinjau hasil halaqah</p>
            </div>
            <button onclick="openModalCreateKuis()" style="padding:10px 18px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
              ➕ Buat Kuis Baru
            </button>
          </div>

          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);padding-bottom:2px;overflow-x:auto;">
            <button onclick="switchGuruQuizTab('kuis', this)" class="gquiz-tab active" style="padding:8px 16px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--blue-d);border-bottom:2.5px solid var(--blue-d);cursor:pointer;">
              📋 Daftar Kuis
            </button>
            <button onclick="switchGuruQuizTab('bank', this)" class="gquiz-tab" style="padding:8px 16px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--text-3);cursor:pointer;">
              📦 Bank Soal
            </button>
            <button onclick="switchGuruQuizTab('review', this)" class="gquiz-tab" style="padding:8px 16px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--text-3);cursor:pointer;">
              ⏳ Antrian Review Isian <span id="badgeAntrianReview" style="background:var(--red);color:#fff;border-radius:100px;font-size:10px;padding:1px 6px;margin-left:4px;display:none;">0</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Sub-Tab Content -->
        <div id="guruQuizTabContent">
          <div style="text-align:center;padding:40px;color:var(--text-3);">Memuat data kuis...</div>
        </div>

        <!-- Modals Container -->
        <div id="guruQuizModalContainer"></div>
      </div>
    `;

    await loadGuruQuizTabContent();
  };

  window.switchGuruQuizTab = function (tabName, btnEl) {
    _activeTab = tabName;
    document.querySelectorAll('.gquiz-tab').forEach(function (b) {
      b.style.color = 'var(--text-3)';
      b.style.borderBottom = 'none';
      b.classList.remove('active');
    });
    if (btnEl) {
      btnEl.style.color = 'var(--blue-d)';
      btnEl.style.borderBottom = '2.5px solid var(--blue-d)';
      btnEl.classList.add('active');
    }
    loadGuruQuizTabContent();
  };

  async function loadGuruQuizTabContent() {
    var contentEl = document.getElementById('guruQuizTabContent');
    if (!contentEl) return;

    if (_activeTab === 'kuis') {
      await renderDaftarKuis(contentEl);
    } else if (_activeTab === 'bank') {
      await renderBankSoal(contentEl);
    } else if (_activeTab === 'review') {
      await renderAntrianReview(contentEl);
    }
  }

  // ─────────────────────────────────────────────
  //  2. TAB 1: DAFTAR KUIS GURU
  // ─────────────────────────────────────────────
  async function renderDaftarKuis(container) {
    try {
      var res = await window.HQ.QuizAPI.getKuisList();
      var list = res.data || [];

      if (list.length === 0) {
        container.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:40px 20px;text-align:center;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="font-size:42px;margin-bottom:12px;">📝</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:4px;">Belum Ada Kuis</h3>
            <p style="font-size:12px;color:var(--text-3);margin-bottom:16px;">Klik tombol "Buat Kuis Baru" di atas untuk membuat kuis pertama Anda.</p>
            <button onclick="openModalCreateKuis()" style="padding:10px 20px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;">
              ➕ Buat Kuis Pertama
            </button>
          </div>
        `;
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">';
      list.forEach(function (q) {
        var statusColor = q.status === 'aktif' ? 'background:var(--green-l);color:var(--green);' : q.status === 'selesai' ? 'background:var(--bg-2);color:var(--text-3);' : 'background:var(--amber-l);color:var(--amber-txt);';
        var halaqahNames = (q.assigned_halaqah || []).map(function(h){ return h.nama_halaqah; }).join(', ') || 'Belum di-assign';

        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;text-transform:uppercase;${statusColor}">
                  ● ${q.status}
                </span>
                <span style="font-size:11px;font-weight:700;color:var(--text-3);">
                  ${q.total_soal} Soal
                </span>
              </div>

              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px;">${escapeHtml(q.judul)}</h3>
              <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">${escapeHtml(q.deskripsi || 'Tidak ada deskripsi.')}</p>

              <div style="font-size:11px;color:var(--text-3);background:var(--bg-2);padding:8px 12px;border-radius:var(--r-sm);margin-bottom:14px;">
                <div>👥 <strong>Halaqah:</strong> ${escapeHtml(halaqahNames)}</div>
                <div style="margin-top:2px;">⏱️ <strong>Durasi:</strong> ${q.durasi_per_soal_detik ? q.durasi_per_soal_detik + ' dtk/soal' : 'Tanpa batas'}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button onclick="manageSoalKuis('${escapeJsStr(q.id_quiz)}')" style="padding:8px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                ⚙️ Kelola Soal (${q.total_soal})
              </button>
              <button onclick="viewHasilKuisGuru('${escapeJsStr(q.id_quiz)}')" style="padding:8px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                📊 Laporan & Hasil
              </button>
              <button onclick="openModalEditKuis('${escapeJsStr(q.id_quiz)}')" style="padding:8px;background:var(--bg-2);color:var(--text-2);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                ✏️ Edit Setting
              </button>
              <button onclick="deleteKuisConfirm('${escapeJsStr(q.id_quiz)}')" style="padding:8px;background:var(--red-l);color:var(--red);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                🗑️ Hapus
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error('[QuizGuru] Load error:', err);
      container.innerHTML = '<div style="color:var(--red);text-align:center;">Gagal memuat daftar kuis.</div>';
    }
  }

  // ─────────────────────────────────────────────
  //  3. TAB 2: BANK SOAL GURU
  // ─────────────────────────────────────────────
  function getTipeSoalLabel(tipe) {
    switch (tipe) {
      case 'pilihan_ganda': return 'Pilihan Ganda';
      case 'benar_salah': return 'Benar / Salah';
      case 'matching': return 'Menjodohkan';
      case 'audio': return 'Audio / Suara';
      case 'teks_arab': return 'Teks Arab';
      case 'isian_singkat': return 'Isian Singkat';
      default: return 'Soal';
    }
  }

  async function renderBankSoal(container) {
    var headerHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
        <div>
          <h3 style="font-size:15px;font-weight:800;color:var(--text);">📦 Bank Soal Bersama</h3>
          <p style="font-size:11px;color:var(--text-3);">Semua pengajar dapat menggunakan soal-soal ini di kuis halaqah masing-masing.</p>
        </div>
        <button onclick="openModalCreateSoal()" style="padding:8px 16px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:12px;cursor:pointer;box-shadow:var(--shadow-blue);">
          ➕ Buat Soal Baru
        </button>
      </div>

      <!-- Filter Panel -->
      <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-lg);border:1px solid var(--border);margin-bottom:16px;box-shadow:var(--shadow);display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <!-- Search input -->
        <div style="flex:2;min-width:200px;position:relative;">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text-3);">🔍</span>
          <input type="text" id="bankSearchInput" oninput="onBankSearchInput(this.value)" placeholder="Cari teks soal..." value="${escapeHtml(_bankFilterText)}" style="width:100%;padding:10px 10px 10px 34px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;background:#fff;color:var(--text);">
        </div>
        <!-- Level Select -->
        <div style="flex:1;min-width:150px;">
          <select id="bankLevelSelect" onchange="onBankLevelFilterChange(this.value)" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;background:#fff;color:var(--text);outline:none;">
            <option value="">— Semua Level —</option>
            <option value="Level 1" ${_bankFilterLevel === 'Level 1' ? 'selected' : ''}>Level 1</option>
            <option value="Level 2" ${_bankFilterLevel === 'Level 2' ? 'selected' : ''}>Level 2</option>
            <option value="Level 3" ${_bankFilterLevel === 'Level 3' ? 'selected' : ''}>Level 3</option>
            <option value="Level Qiyam" ${_bankFilterLevel === 'Level Qiyam' ? 'selected' : ''}>Level Qiyam</option>
            <option value="Micro Teaching" ${_bankFilterLevel === 'Micro Teaching' ? 'selected' : ''}>Micro Teaching</option>
            <option value="Tahsin Al-Fatihah" ${_bankFilterLevel === 'Tahsin Al-Fatihah' ? 'selected' : ''}>Tahsin Al-Fatihah</option>
          </select>
        </div>
        <!-- Pertemuan Ke- Input -->
        <div style="flex:1;min-width:120px;">
          <input type="number" id="bankPertemuanInput" oninput="onBankPertemuanFilterChange(this.value)" placeholder="Pertemuan ke-" value="${escapeHtml(_bankFilterPertemuan)}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;background:#fff;color:var(--text);">
        </div>
      </div>

      <style>
        .bank-soal-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg) !important;
          border-color: var(--blue) !important;
        }
        .btn-delete-soal:hover {
          background: var(--red) !important;
          color: #fff !important;
        }
      </style>

      <div id="bankSoalListContainer">
        <div style="text-align:center;padding:30px;color:var(--text-3);">Memuat daftar bank soal...</div>
      </div>
    `;

    container.innerHTML = headerHtml;

    await reloadBankList();
  }

  window.onBankSearchInput = function (val) {
    _bankFilterText = val;
    filterAndRenderBankList();
  };

  window.onBankLevelFilterChange = async function (val) {
    _bankFilterLevel = val;
    await reloadBankList();
  };

  window.onBankPertemuanFilterChange = async function (val) {
    _bankFilterPertemuan = val;
    await reloadBankList();
  };

  async function reloadBankList() {
    var listContainer = document.getElementById('bankSoalListContainer');
    if (listContainer && listContainer.innerHTML === '') {
      listContainer.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3);">Memuat daftar bank soal...</div>';
    }
    try {
      var res = await window.HQ.QuizAPI.getBankSoal(null, null, _bankFilterLevel || null, _bankFilterPertemuan || null);
      _allBankSoalRaw = res.data || [];
      filterAndRenderBankList();
    } catch (err) {
      if (listContainer) {
        listContainer.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">Gagal memuat bank soal.</div>';
      }
    }
  }

  function filterAndRenderBankList() {
    var container = document.getElementById('bankSoalListContainer');
    if (!container) return;

    var filtered = _allBankSoalRaw.filter(function (s) {
      if (!_bankFilterText) return true;
      var term = _bankFilterText.toLowerCase();
      return (s.teks_soal || '').toLowerCase().includes(term) ||
             (s.users && s.users.nama_lengkap || '').toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="background:var(--card-solid);padding:40px;border-radius:var(--r-lg);text-align:center;color:var(--text-3);border:1px dashed var(--border);grid-column: 1 / -1;">Tidak ada soal yang cocok dengan filter pencarian.</div>';
      return;
    }

    var currentUserId = window.HQ.getCurrentUser().id_user;
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">';
    filtered.forEach(function (s, idx) {
      var authorName = s.users ? s.users.nama_lengkap : 'Pengajar';
      var isOwner = s.id_guru === currentUserId;

      html += `
        <div class="bank-soal-card" style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s ease;display:flex;flex-direction:column;justify-content:space-between;gap:12px;position:relative;">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;">
                <!-- Badges -->
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;text-transform:uppercase;letter-spacing:0.02em;">
                    ${getTipeSoalLabel(s.tipe_soal)}
                  </span>
                  ${(s.levels || []).map(function(lvl) {
                    return `<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 8px;border-radius:100px;">${escapeHtml(lvl)}</span>`;
                  }).join('')}
                  ${s.rekomendasi_pertemuan_ke ? `
                    <span style="font-size:10px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber-txt);padding:2px 8px;border-radius:100px;">
                      📍 Pertemuan ${s.rekomendasi_pertemuan_ke}
                    </span>
                  ` : ''}
                </div>
                <!-- Question text -->
                <div style="font-size:13.5px;font-weight:700;color:var(--text);line-height:1.45;margin-top:4px;word-break:break-word;">
                  ${idx + 1}. ${escapeHtml(s.teks_soal)}
                </div>
              </div>

              <!-- Delete Button -->
              ${isOwner ? `
                <button onclick="deleteSoalConfirm('${escapeJsStr(s.id_soal)}')" class="btn-delete-soal" style="background:var(--red-l);color:var(--red);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Hapus Soal">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Footer Meta Info -->
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;font-size:10.5px;color:var(--text-3);">
            <span>Oleh: <strong>${escapeHtml(authorName)}</strong> ${isOwner ? '(Saya)' : ''}</span>
            <span>Dibuat: ${new Date(s.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ─────────────────────────────────────────────
  //  4. TAB 3: ANTRIAN REVIEW ISIAN SINGKAT
  // ─────────────────────────────────────────────
  async function renderAntrianReview(container) {
    try {
      var res = await window.HQ.QuizAPI.getAntrianReviewIsian();
      var list = res.data || [];

      var badgeEl = document.getElementById('badgeAntrianReview');
      if (badgeEl) {
        if (list.length > 0) {
          badgeEl.textContent = list.length;
          badgeEl.style.display = 'inline-block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      if (list.length === 0) {
        container.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:40px 20px;text-align:center;border:1px solid var(--border);">
            <div style="font-size:42px;margin-bottom:8px;">✅</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);">Antrian Review Kosong</h3>
            <p style="font-size:12px;color:var(--text-3);">Semua jawaban isian singkat murid sudah diperiksa.</p>
          </div>
        `;
        return;
      }

      var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
      list.forEach(function (item) {
        var muridName = item.users ? item.users.nama_lengkap : 'Murid';
        var soalText = item.soal ? item.soal.teks_soal : '';

        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:13px;font-weight:800;color:var(--text);">${escapeHtml(muridName)}</span>
              <span style="font-size:10px;font-weight:800;background:var(--amber-l);color:var(--amber-txt);padding:2px 8px;border-radius:100px;">⏳ Menunggu Review</span>
            </div>

            <div style="font-size:12px;color:var(--text-2);margin-bottom:8px;">
              <strong>Soal:</strong> ${escapeHtml(soalText)}
            </div>

            <div style="background:var(--bg-2);padding:10px 14px;border-radius:var(--r-sm);margin-bottom:12px;font-size:13px;">
              Jawaban Murid: <strong style="color:var(--blue-d);">${escapeHtml(item.teks_jawaban_isian)}</strong>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', true, false)" style="padding:8px 14px;background:var(--green-l);color:var(--green-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ✅ Terima
              </button>
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', true, true)" style="padding:8px 14px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                📖 + Kunci Jawaban
              </button>
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', false, false)" style="padding:8px 14px;background:var(--red-l);color:var(--red);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ❌ Tolak
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;">Gagal memuat antrian review.</div>';
    }
  }

  window.prosesReviewIsian = async function (id_jawaban, disetujui, simpanVarian) {
    try {
      showLoading('Memproses review...');
      await window.HQ.QuizAPI.reviewIsianSingkat(id_jawaban, disetujui, simpanVarian);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal memproses review: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────
  //  5. MODAL HANDLERS & ACTIONS
  // ─────────────────────────────────────────────
  window.closeGuruQuizModal = function () {
    var el = document.getElementById('guruQuizModalContainer');
    if (el) el.innerHTML = '';
  };

  window.openModalCreateKuis = async function () {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    showLoading('Memuat daftar halaqah...');
    var halaqahList = [];
    try {
      var id_guru = window.HQ.getCurrentUser().id_user;
      var { data } = await window.HQ.supabase.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif');
      halaqahList = data || [];
    } catch(e) {}
    hideLoading();

    var halaqahOptionsHtml = halaqahList.map(function(h) {
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" name="id_halaqah" value="${h.id_halaqah}"> ${escapeHtml(h.nama_halaqah)} (${escapeHtml(h.level)})</label>`;
    }).join('') || '<div style="font-size:12px;color:var(--text-3);">Belum ada halaqah aktif.</div>';

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">➕ Buat Kuis Baru</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormCreateKuis(event)">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">JUDUL KUIS *</label>
              <input type="text" id="cqJudul" required placeholder="mis. Kuis Hukum Nun Mati & Tanwin" style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;">
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DESKRIPSI / INSTRUKSI</label>
              <textarea id="cqDeskripsi" rows="2" placeholder="Petunjuk pengerjaan kuis untuk murid..." style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">KATEGORI</label>
                <select id="cqKategori" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="Tajwid">Tajwid</option>
                  <option value="Makharijul Huruf">Makharijul Huruf</option>
                  <option value="Hafalan">Hafalan</option>
                  <option value="Murajaah">Murajaah</option>
                  <option value="Umum" selected>Umum</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">STATUS</label>
                <select id="cqStatus" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="draft">Draft (Disimpan saja)</option>
                  <option value="aktif" selected>Aktif (Dapat Dikerjakan)</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DURASI PER SOAL (DETIK)</label>
                <input type="number" id="cqDurasi" value="30" placeholder="0 = tanpa batas" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URUTAN SOAL</label>
                <select id="cqUrutan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="berurutan">Berurutan</option>
                  <option value="acak">Acak (Random)</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ASSIGN KE HALAQAH *</label>
              <div style="background:var(--bg-2);padding:10px;border-radius:var(--r-sm);display:flex;flex-direction:column;gap:6px;max-height:120px;overflow-y:auto;">
                ${halaqahOptionsHtml}
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Kuis</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.submitFormCreateKuis = async function (e) {
    e.preventDefault();
    var idHalaqahList = Array.from(document.querySelectorAll('input[name="id_halaqah"]:checked')).map(function(c){ return c.value; });

    var payload = {
      judul: document.getElementById('cqJudul').value.trim(),
      deskripsi: document.getElementById('cqDeskripsi').value.trim(),
      kategori: document.getElementById('cqKategori').value,
      status: document.getElementById('cqStatus').value,
      durasi_per_soal_detik: parseInt(document.getElementById('cqDurasi').value) || null,
      urutan_soal: document.getElementById('cqUrutan').value,
      id_halaqah_list: idHalaqahList
    };

    try {
      showLoading('Membuat kuis...');
      await window.HQ.QuizAPI.createKuis(payload);
      hideLoading();
      closeGuruQuizModal();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal membuat kuis: ' + err.message);
    }
  };

  window.openModalEditKuis = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    showLoading('Memuat detail kuis...');
    var halaqahList = [];
    var kuisData = null;
    try {
      var id_guru = window.HQ.getCurrentUser().id_user;
      
      // Fetch halaqah
      var { data: hList } = await window.HQ.supabase.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif');
      halaqahList = hList || [];
      
      // Fetch quiz detail with its assigned halaqah
      var { data: qData } = await window.HQ.supabase.from('quiz').select('*, quiz_halaqah(id_halaqah)').eq('id_quiz', id_quiz).single();
      kuisData = qData;
    } catch(e) {
      alert('Gagal memuat detail kuis: ' + e.message);
      hideLoading();
      return;
    }
    hideLoading();

    if (!kuisData) return;

    var assignedHalaqahIds = (kuisData.quiz_halaqah || []).map(function(qh) { return qh.id_halaqah; });

    var halaqahOptionsHtml = halaqahList.map(function(h) {
      var isChecked = assignedHalaqahIds.indexOf(h.id_halaqah) !== -1 ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" name="id_halaqah" value="${h.id_halaqah}" ${isChecked}> ${escapeHtml(h.nama_halaqah)} (${escapeHtml(h.level)})</label>`;
    }).join('') || '<div style="font-size:12px;color:var(--text-3);">Belum ada halaqah aktif.</div>';

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">✏️ Edit Setting Kuis</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormEditKuis(event, '${escapeJsStr(kuisData.id_quiz)}')">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">JUDUL KUIS *</label>
              <input type="text" id="eqJudul" required value="${escapeHtml(kuisData.judul)}" placeholder="mis. Kuis Hukum Nun Mati & Tanwin" style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;">
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DESKRIPSI / INSTRUKSI</label>
              <textarea id="eqDeskripsi" rows="2" placeholder="Petunjuk pengerjaan kuis untuk murid..." style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;">${escapeHtml(kuisData.deskripsi || '')}</textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">KATEGORI</label>
                <select id="eqKategori" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="Tajwid" ${kuisData.kategori === 'Tajwid' ? 'selected' : ''}>Tajwid</option>
                  <option value="Makharijul Huruf" ${kuisData.kategori === 'Makharijul Huruf' ? 'selected' : ''}>Makharijul Huruf</option>
                  <option value="Hafalan" ${kuisData.kategori === 'Hafalan' ? 'selected' : ''}>Hafalan</option>
                  <option value="Murajaah" ${kuisData.kategori === 'Murajaah' ? 'selected' : ''}>Murajaah</option>
                  <option value="Umum" ${kuisData.kategori === 'Umum' ? 'selected' : ''}>Umum</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">STATUS</label>
                <select id="eqStatus" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="draft" ${kuisData.status === 'draft' ? 'selected' : ''}>Draft (Disimpan saja)</option>
                  <option value="aktif" ${kuisData.status === 'aktif' ? 'selected' : ''}>Aktif (Dapat Dikerjakan)</option>
                  <option value="selesai" ${kuisData.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                  <option value="arsip" ${kuisData.status === 'arsip' ? 'selected' : ''}>Arsip</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DURASI PER SOAL (DETIK)</label>
                <input type="number" id="eqDurasi" value="${kuisData.durasi_per_soal_detik !== null ? kuisData.durasi_per_soal_detik : 0}" placeholder="0 = tanpa batas" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URUTAN SOAL</label>
                <select id="eqUrutan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="berurutan" ${kuisData.urutan_soal === 'berurutan' ? 'selected' : ''}>Berurutan</option>
                  <option value="acak" ${kuisData.urutan_soal === 'acak' ? 'selected' : ''}>Acak (Random)</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">BOLEH RETAKE?</label>
                <select id="eqBolehRetake" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="false" ${!kuisData.boleh_retake ? 'selected' : ''}>Tidak Boleh</option>
                  <option value="true" ${kuisData.boleh_retake ? 'selected' : ''}>Boleh Retake</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ANTI TAB / CHEAT</label>
                <select id="eqAntiTab" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="true" ${kuisData.anti_tab_aktif ? 'selected' : ''}>Aktif (Diawasi)</option>
                  <option value="false" ${!kuisData.anti_tab_aktif ? 'selected' : ''}>Nonaktif</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ASSIGN KE HALAQAH *</label>
              <div style="background:var(--bg-2);padding:10px;border-radius:var(--r-sm);display:flex;flex-direction:column;gap:6px;max-height:120px;overflow-y:auto;">
                ${halaqahOptionsHtml}
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.submitFormEditKuis = async function (e, id_quiz) {
    e.preventDefault();
    var idHalaqahList = Array.from(document.querySelectorAll('input[name="id_halaqah"]:checked')).map(function(c){ return c.value; });

    var payload = {
      judul: document.getElementById('eqJudul').value.trim(),
      deskripsi: document.getElementById('eqDeskripsi').value.trim(),
      kategori: document.getElementById('eqKategori').value,
      status: document.getElementById('eqStatus').value,
      durasi_per_soal_detik: parseInt(document.getElementById('eqDurasi').value) || null,
      urutan_soal: document.getElementById('eqUrutan').value,
      boleh_retake: document.getElementById('eqBolehRetake').value === 'true',
      anti_tab_aktif: document.getElementById('eqAntiTab').value === 'true',
      id_halaqah_list: idHalaqahList
    };

    try {
      showLoading('Menyimpan perubahan...');
      await window.HQ.QuizAPI.updateKuis(id_quiz, payload);
      hideLoading();
      closeGuruQuizModal();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal mengedit kuis: ' + err.message);
    }
  };

  window.deleteKuisConfirm = async function (id_quiz) {
    if (!confirm('Apakah Anda yakin ingin menghapus kuis ini? Semua jawaban dan hasil murid pada kuis ini akan terhapus.')) return;

    try {
      showLoading('Menghapus kuis...');
      await window.HQ.QuizAPI.deleteKuis(id_quiz);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus kuis: ' + err.message);
    }
  };

  window.manageSoalKuis = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    _selectedQuizId = id_quiz;
    _pickerSelectedSoalIds.clear(); // Reset selection

    try {
      showLoading('Memuat soal kuis...');
      var quizRes = await window.HQ.QuizAPI.getHasilKuis(id_quiz);
      hideLoading();

      var quiz = quizRes.quiz;
      _currentQuizData = quiz;
      var existingQuizSoal = quiz.quiz_soal || [];

      var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;height:65vh;"><div style="flex:1;min-width:300px;overflow-y:auto;background:var(--bg-2);padding:14px;border-radius:var(--r-lg);border:1px solid var(--border);">';
      html += `<div style="font-size:12px;font-weight:800;color:var(--text-3);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.02em;">Soal di Kuis Saat Ini (${existingQuizSoal.length})</div>`;
      html += existingQuizSoal.map(function(qs, idx) {
        var s = qs.soal;
        if (!s) return '';
        return `
          <div style="background:var(--card-solid);padding:10px 14px;border-radius:var(--r-sm);border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:10px;">
            <div style="flex:1;font-size:12.5px;font-weight:700;color:var(--text);">${idx + 1}. ${escapeHtml(s.teks_soal)}</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button onclick="removeSoalFromKuisAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}')" style="background:var(--red-l);color:var(--red);border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Hapus</button>
            </div>
          </div>
        `;
      }).join('') || '<div style="font-size:12px;color:var(--text-3);padding:10px 0;text-align:center;">Belum ada soal dimasukkan ke kuis ini.</div>';

      html += `
          </div>
          <div style="flex:1.2;min-width:280px;background:var(--bg-2);border-radius:var(--r-lg);padding:14px;border:1px solid var(--border);display:flex;flex-direction:column;gap:12px;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h4 style="font-size:13px;font-weight:800;color:var(--text);">📦 Pilih dari Bank Soal</h4>
              <button onclick="openModalCreateSoal('${escapeJsStr(id_quiz)}')" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;cursor:pointer;">➕ Buat Soal Baru</button>
            </div>

            <!-- Picker Filters -->
            <div style="display:flex;flex-direction:column;gap:8px;background:var(--card-solid);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <input type="text" id="pickerSearchInput" oninput="onPickerSearchInput(this.value)" placeholder="Cari teks soal..." value="${escapeHtml(_pickerFilterText)}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;">
              <div style="display:flex;gap:6px;">
                <select id="pickerLevelSelect" onchange="onPickerLevelFilterChange(this.value)" style="flex:1.2;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;">
                  <option value="">— Level —</option>
                  <option value="Level 1" ${_pickerFilterLevel === 'Level 1' ? 'selected' : ''}>Level 1</option>
                  <option value="Level 2" ${_pickerFilterLevel === 'Level 2' ? 'selected' : ''}>Level 2</option>
                  <option value="Level 3" ${_pickerFilterLevel === 'Level 3' ? 'selected' : ''}>Level 3</option>
                  <option value="Level Qiyam" ${_pickerFilterLevel === 'Level Qiyam' ? 'selected' : ''}>Level Qiyam</option>
                  <option value="Micro Teaching" ${_pickerFilterLevel === 'Micro Teaching' ? 'selected' : ''}>Micro Teaching</option>
                  <option value="Tahsin Al-Fatihah" ${_pickerFilterLevel === 'Tahsin Al-Fatihah' ? 'selected' : ''}>Tahsin Al-Fatihah</option>
                </select>
                <input type="number" id="pickerPertemuanInput" oninput="onPickerPertemuanFilterChange(this.value)" placeholder="Pertemuan ke-" value="${escapeHtml(_pickerFilterPertemuan)}" style="flex:0.8;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;width:100%;">
              </div>
            </div>

            <!-- Floating / Top Action Bar for Bulk Add -->
            <div id="pickerBulkActionBar" style="display:none;background:var(--blue-l);border:1px solid var(--blue);padding:8px 12px;border-radius:var(--r-sm);align-items:center;justify-content:space-between;transition:all 0.2s ease;">
              <span style="font-size:11.5px;font-weight:800;color:var(--blue-d);" id="pickerSelectedCountText">0 soal terpilih</span>
              <button onclick="bulkAddSelectedSoal('${escapeJsStr(id_quiz)}')" style="background:var(--blue-d);color:#fff;border:none;padding:5px 12px;border-radius:var(--r-pill,100px);font-size:11.5px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">➕ Tambah Terpilih</button>
            </div>

            <div id="soalPickerContainer" style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;">
              <!-- Loaded dynamically -->
            </div>
          </div>
        </div>
      `;

      modalEl.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
          <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:880px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="font-size:16px;font-weight:800;color:var(--text)">⚙️ Kelola Soal: ${escapeHtml(quiz.judul)}</h3>
              <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
            </div>

            ${html}

            <button onclick="closeGuruQuizModal()" style="width:100%;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;flex-shrink:0;">Selesai</button>
          </div>
        </div>
      `;

      await reloadPickerList(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal mengelola soal kuis: ' + err.message);
    }
  };

  window.onPickerSearchInput = function (val) {
    _pickerFilterText = val;
    renderPickerList(_selectedQuizId);
  };

  window.onPickerLevelFilterChange = async function (val) {
    _pickerFilterLevel = val;
    await reloadPickerList(_selectedQuizId);
  };

  window.onPickerPertemuanFilterChange = async function (val) {
    _pickerFilterPertemuan = val;
    await reloadPickerList(_selectedQuizId);
  };

  async function reloadPickerList(id_quiz) {
    var pickerEl = document.getElementById('soalPickerContainer');
    if (pickerEl && pickerEl.innerHTML === '') {
      pickerEl.innerHTML = '<div style="font-size:11px;color:var(--text-3);text-align:center;padding:20px;">Memuat soal...</div>';
    }
    try {
      var res = await window.HQ.QuizAPI.getBankSoal(null, null, _pickerFilterLevel || null, _pickerFilterPertemuan || null);
      _pickerAvailableSoal = res.data || [];
      renderPickerList(id_quiz);
    } catch (e) {
      if (pickerEl) pickerEl.innerHTML = '<div style="font-size:11px;color:var(--red);text-align:center;padding:20px;">Gagal memuat soal.</div>';
    }
  }

  function renderPickerList(id_quiz) {
    var pickerEl = document.getElementById('soalPickerContainer');
    if (!pickerEl) return;

    var quiz = _currentQuizData;
    var existingQuizSoal = quiz ? (quiz.quiz_soal || []) : [];
    var addedIds = new Set(existingQuizSoal.map(function(qs){ return qs.id_soal; }));

    var available = _pickerAvailableSoal.filter(function(b){
      return !addedIds.has(b.id_soal);
    });

    if (_pickerFilterText) {
      var term = _pickerFilterText.toLowerCase();
      available = available.filter(function(s) {
        return (s.teks_soal || '').toLowerCase().includes(term);
      });
    }

    if (available.length === 0) {
      pickerEl.innerHTML = '<div style="font-size:11.5px;color:var(--text-3);text-align:center;padding:20px;">Tidak ada soal baru di bank soal yang sesuai filter.</div>';
      updateBulkActionBarVisibility();
      return;
    }

    var pickerHtml = '';
    available.forEach(function(s) {
      var badgeText = getTipeSoalLabel(s.tipe_soal);
      var isChecked = _pickerSelectedSoalIds.has(s.id_soal);

      pickerHtml += `
        <div style="background:var(--card-solid);padding:10px;border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:8px;">
          <input type="checkbox" class="picker-cb" value="${escapeHtml(s.id_soal)}" ${isChecked ? 'checked' : ''} onchange="onPickerCheckboxChange(this)" style="width:16px;height:16px;cursor:pointer;flex-shrink:0;margin:0 4px 0 0;">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span style="font-size:8px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 6px;border-radius:4px;text-transform:uppercase;">${badgeText}</span>
              ${(s.levels || []).map(function(lvl){
                return `<span style="font-size:8px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 6px;border-radius:4px;">${escapeHtml(lvl)}</span>`;
              }).join('')}
              ${s.rekomendasi_pertemuan_ke ? `
                <span style="font-size:8px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber-txt);padding:2px 6px;border-radius:4px;">📍 P.${s.rekomendasi_pertemuan_ke}</span>
              ` : ''}
            </div>
            <div style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(s.teks_soal)}">${escapeHtml(s.teks_soal)}</div>
          </div>
          <button onclick="addSoalToKuisAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}')" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;">+ Tambah</button>
        </div>
      `;
    });

    pickerEl.innerHTML = pickerHtml;
    updateBulkActionBarVisibility();
  }

  window.onPickerCheckboxChange = function(cb) {
    var id_soal = cb.value;
    if (cb.checked) {
      _pickerSelectedSoalIds.add(id_soal);
    } else {
      _pickerSelectedSoalIds.delete(id_soal);
    }
    updateBulkActionBarVisibility();
  };

  function updateBulkActionBarVisibility() {
    var bar = document.getElementById('pickerBulkActionBar');
    var txt = document.getElementById('pickerSelectedCountText');
    if (!bar || !txt) return;

    if (_pickerSelectedSoalIds.size > 0) {
      txt.textContent = _pickerSelectedSoalIds.size + ' soal terpilih';
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  window.bulkAddSelectedSoal = async function(id_quiz) {
    var ids = Array.from(_pickerSelectedSoalIds);
    if (ids.length === 0) return;

    try {
      showLoading(`Menambahkan ${ids.length} soal ke kuis...`);
      for (var i = 0; i < ids.length; i++) {
        await window.HQ.QuizAPI.addSoalToKuis(id_quiz, ids[i], null, 10);
      }
      _pickerSelectedSoalIds.clear();
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menambahkan soal massal: ' + err.message);
    }
  };

  window.addSoalToKuisAction = async function (id_quiz, id_soal) {
    try {
      showLoading('Menambahkan soal...');
      await window.HQ.QuizAPI.addSoalToKuis(id_quiz, id_soal, null, 10);
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menambahkan soal: ' + err.message);
    }
  };

  window.removeSoalFromKuisAction = async function (id_quiz, id_soal) {
    try {
      showLoading('Menghapus soal...');
      await window.HQ.QuizAPI.removeSoalFromKuis(id_quiz, id_soal);
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus soal: ' + err.message);
    }
  };

  window.openModalCreateSoal = function (prefilledQuizId) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">➕ Buat Soal Baru (Bank Soal)</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormCreateSoal(event, '${prefilledQuizId || ''}')">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TIPE SOAL *</label>
              <select id="csTipe" onchange="onTipeSoalChange(this.value)" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                <option value="pilihan_ganda">Pilihan Ganda</option>
                <option value="benar_salah">Benar / Salah</option>
                <option value="matching">Matching (Menjodohkan)</option>
                <option value="audio">Audio / Suara</option>
                <option value="teks_arab">Teks Arab</option>
                <option value="isian_singkat">Isian Singkat</option>
              </select>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TEKS PERTANYAAN (LATIN) *</label>
              <textarea id="csTeksSoal" required rows="2" placeholder="Ketik pertanyaan di sini..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;"></textarea>
            </div>

            <div id="csTeksArabWrap" style="display:none;margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TEKS ARAB</label>
              <textarea id="csTeksArab" rows="2" placeholder="Gunakan {[...]} untuk highlight kata/hukum tajwid" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:'Amiri',serif;font-size:18px;direction:rtl;outline:none;resize:vertical;"></textarea>
            </div>

            <div id="csAudioWrap" style="display:none;margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URL AUDIO (GDrive / YouTube / MP3 Direct)</label>
              <input type="url" id="csAudioUrl" placeholder="https://..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>

            <!-- Options Container Dynamic -->
            <div id="csDynamicOptions" style="margin-bottom:14px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">OPSI PILIHAN (Centang Kunci Jawaban Benar):</label>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="0" checked> <input type="text" class="csPil" required placeholder="Pilihan A" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
                <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="1"> <input type="text" class="csPil" required placeholder="Pilihan B" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
                <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="2"> <input type="text" class="csPil" placeholder="Pilihan C (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
                <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="3"> <input type="text" class="csPil" placeholder="Pilihan D (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Soal</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.onTipeSoalChange = function (tipe) {
    var arabWrap = document.getElementById('csTeksArabWrap');
    var audioWrap = document.getElementById('csAudioWrap');
    var optionsDiv = document.getElementById('csDynamicOptions');

    if (arabWrap) arabWrap.style.display = (tipe === 'teks_arab') ? 'block' : 'none';
    if (audioWrap) audioWrap.style.display = (tipe === 'audio') ? 'block' : 'none';

    if (!optionsDiv) return;

    if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
      optionsDiv.innerHTML = `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">OPSI PILIHAN (Pilih Kunci Jawaban Benar):</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="0" checked> <input type="text" class="csPil" required placeholder="Pilihan A" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
          <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="1"> <input type="text" class="csPil" required placeholder="Pilihan B" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
          <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="2"> <input type="text" class="csPil" placeholder="Pilihan C (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
          <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="3"> <input type="text" class="csPil" placeholder="Pilihan D (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        </div>
      `;
    } else if (tipe === 'benar_salah') {
      optionsDiv.innerHTML = `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">KUNCI JAWABAN BENAR:</label>
        <div style="display:flex;gap:16px;">
          <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="benar" checked> ✅ Benar</label>
          <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="salah"> ❌ Salah</label>
        </div>
      `;
    } else if (tipe === 'matching') {
      optionsDiv.innerHTML = `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">PASANGAN (TEKS KIRI ↔ TEKS KANAN):</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
          <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
          <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" placeholder="Teks Kiri 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" placeholder="Teks Kanan 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        </div>
      `;
    } else if (tipe === 'isian_singkat') {
      optionsDiv.innerHTML = `
        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">VARIAN KUNCI JAWABAN (Pisahkan dengan koma):</label>
        <input type="text" id="csIsianKunci" required placeholder="mis. Idgham Bighunnah, idgham bighunnah" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
      `;
    }
  };

  window.submitFormCreateSoal = async function (e, prefilledQuizId) {
    e.preventDefault();
    var tipe = document.getElementById('csTipe').value;
    var teksSoal = document.getElementById('csTeksSoal').value.trim();

    var payload = {
      tipe_soal: tipe,
      teks_soal: teksSoal,
      teks_arab: document.getElementById('csTeksArab') ? document.getElementById('csTeksArab').value.trim() : null,
      audio_url: document.getElementById('csAudioUrl') ? document.getElementById('csAudioUrl').value.trim() : null,
      pilihan: [],
      pasangan: [],
      kunci_isian: []
    };

    if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
      var pilInputs = Array.from(document.querySelectorAll('.csPil'));
      var selectedBenarIdx = parseInt(document.querySelector('input[name="csBenar"]:checked').value);
      payload.pilihan = pilInputs.map(function(inp, idx) {
        if (!inp.value.trim()) return null;
        return { teks_pilihan: inp.value.trim(), is_benar: idx === selectedBenarIdx };
      }).filter(Boolean);
    } else if (tipe === 'benar_salah') {
      var isBenarSelected = document.querySelector('input[name="csBsBenar"]:checked').value === 'benar';
      payload.pilihan = [
        { teks_pilihan: 'Benar', is_benar: isBenarSelected },
        { teks_pilihan: 'Salah', is_benar: !isBenarSelected }
      ];
    } else if (tipe === 'matching') {
      var kiriInputs = Array.from(document.querySelectorAll('.csMatchKiri'));
      var kananInputs = Array.from(document.querySelectorAll('.csMatchKanan'));
      payload.pasangan = kiriInputs.map(function(kInp, idx) {
        var kiriText = kInp.value.trim();
        var kananText = kananInputs[idx] ? kananInputs[idx].value.trim() : '';
        if (!kiriText || !kananText) return null;
        return { teks_kiri: kiriText, teks_kanan: kananText };
      }).filter(Boolean);
    } else if (tipe === 'isian_singkat') {
      var rawKunci = document.getElementById('csIsianKunci').value;
      payload.kunci_isian = rawKunci.split(',').map(function(k){ return k.trim(); }).filter(Boolean);
    }

    try {
      showLoading('Membuat soal...');
      var res = await window.HQ.QuizAPI.createSoal(payload);
      var newSoal = res.data;

      if (prefilledQuizId && newSoal) {
        await window.HQ.QuizAPI.addSoalToKuis(prefilledQuizId, newSoal.id_soal, 1, 10);
      }

      hideLoading();
      closeGuruQuizModal();

      if (prefilledQuizId) {
        manageSoalKuis(prefilledQuizId);
      } else {
        await loadGuruQuizTabContent();
      }
    } catch (err) {
      hideLoading();
      alert('Gagal membuat soal: ' + err.message);
    }
  };

  window.deleteSoalConfirm = async function (id_soal) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;

    try {
      showLoading('Menghapus soal...');
      await window.HQ.QuizAPI.deleteSoal(id_soal);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus soal: ' + err.message);
    }
  };

  window.viewHasilKuisGuru = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    try {
      showLoading('Memuat laporan kuis...');
      var res = await window.HQ.QuizAPI.getHasilKuis(id_quiz);
      hideLoading();

      var quiz = res.quiz;
      var summary = res.summary;
      var hasilMurid = summary.hasil_murid || [];

      var rowsHtml = hasilMurid.map(function(h, idx) {
        var name = h.users ? h.users.nama_lengkap : 'Murid';
        var percent = h.skor_maksimal > 0 ? Math.round((h.skor_total / h.skor_maksimal) * 100) : 0;

        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px;font-size:12px;font-weight:700;">#${idx + 1}</td>
            <td style="padding:10px;font-size:12px;font-weight:800;color:var(--text);">${escapeHtml(name)}</td>
            <td style="padding:10px;font-size:12px;font-weight:900;color:var(--green);">${h.skor_total} / ${h.skor_maksimal} (${percent}%)</td>
            <td style="padding:10px;font-size:12px;">${h.durasi_pengerjaan_detik ? h.durasi_pengerjaan_detik + 's' : '-'}</td>
            <td style="padding:10px;font-size:11px;">
              ${h.flag_suspicious ? `<span style="background:var(--red-l);color:var(--red);padding:2px 8px;border-radius:100px;font-weight:800;">⚠️ ${h.jumlah_tab_switch}x Pindah Tab</span>` : '<span style="color:var(--text-3);">Normal</span>'}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-3);">Belum ada murid yang mengerjakan kuis ini.</td></tr>';

      modalEl.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
          <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="font-size:16px;font-weight:800;color:var(--text)">📊 Laporan & Hasil: ${escapeHtml(quiz.judul)}</h3>
              <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
              <div style="background:var(--bg-2);padding:14px;border-radius:var(--r-sm);text-align:center;">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);">TOTAL MENGERJAKAN</div>
                <div style="font-size:24px;font-weight:900;color:var(--blue-d);">${summary.total_mengerjakan} Murid</div>
              </div>
              <div style="background:var(--bg-2);padding:14px;border-radius:var(--r-sm);text-align:center;">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);">RATA-RATA SKOR</div>
                <div style="font-size:24px;font-weight:900;color:var(--green);">${summary.rata_rata_skor} Poin</div>
              </div>
            </div>

            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;text-align:left;">
                <thead>
                  <tr style="background:var(--bg-2);font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;">
                    <th style="padding:10px;">No</th>
                    <th style="padding:10px;">Nama Murid</th>
                    <th style="padding:10px;">Skor</th>
                    <th style="padding:10px;">Waktu</th>
                    <th style="padding:10px;">Status / Log</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>

            <button onclick="closeGuruQuizModal()" style="width:100%;padding:11px;margin-top:20px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Tutup</button>
          </div>
        </div>
      `;
    } catch (err) {
      hideLoading();
      alert('Gagal memuat laporan kuis: ' + err.message);
    }
  };

  // Helper Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  function escapeJsStr(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  function showLoading(msg) {
    if (typeof window.showLoad === 'function') window.showLoad(msg);
  }

  function hideLoading() {
    if (typeof window.hideLoad === 'function') window.hideLoad();
  }

  function showQuizAlert(opts) {
    var type = opts.type || 'warning';
    var icon = opts.icon || (type === 'warning' ? '⚠️' : type === 'danger' ? '🚨' : type === 'success' ? '🎉' : 'ℹ️');
    var buttonText = opts.buttonText || 'Mengerti 👍';

    var headerBg = type === 'warning' ? 'linear-gradient(135deg,#f59e0b,#d97706)' :
                   type === 'danger'  ? 'linear-gradient(135deg,#ef4444,#dc2626)' :
                   type === 'success' ? 'linear-gradient(135deg,#10b981,#059669)' :
                                        'linear-gradient(135deg,#0ea5e9,#0284c7)';

    var existing = document.getElementById('quizAlertModalOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'quizAlertModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:quizFadeIn .25s ease;';

    overlay.innerHTML = `
      <div style="background:var(--card-solid,#fff);border-radius:24px;padding:28px 24px;width:100%;max-width:400px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.6);animation:quizPopIn .3s cubic-bezier(0.34,1.56,0.64,1);position:relative;overflow:hidden;">
        <div style="width:64px;height:64px;border-radius:50%;background:${headerBg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;box-shadow:0 8px 20px rgba(0,0,0,0.15);">
          ${icon}
        </div>
        <h3 style="font-size:17px;font-weight:900;color:var(--text,#1e293b);margin-bottom:8px;line-height:1.3;">
          ${escapeHtml(opts.title || 'Pemberitahuan')}
        </h3>
        <p style="font-size:13px;color:var(--text-2,#475569);line-height:1.5;margin-bottom:22px;">
          ${escapeHtml(opts.message || '')}
        </p>
        <button id="btnQuizAlertClose" style="width:100%;padding:13px;background:${headerBg};color:#fff;border:none;border-radius:100px;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:transform .2s;">
          ${escapeHtml(buttonText)}
        </button>
      </div>
      <style>
        @keyframes quizFadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes quizPopIn { from{opacity:0;transform:scale(0.85) translateY(10px);} to{opacity:1;transform:scale(1) translateY(0);} }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnQuizAlertClose').onclick = function () {
      overlay.remove();
      if (typeof opts.callback === 'function') opts.callback();
    };
  }

})();
