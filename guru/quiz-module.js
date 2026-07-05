// ============================================================
//  guru/quiz-module.js  v1.0
//  Portal Guru — Rattil Quiz Management & Analytics
// ============================================================

(function () {
  'use strict';

  var _activeTab = 'kuis'; // 'kuis' | 'bank' | 'review' | 'laporan'
  var _selectedQuizId = null;

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
              <button onclick="manageSoalKuis('${q.id_quiz}')" style="padding:8px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                ⚙️ Kelola Soal (${q.total_soal})
              </button>
              <button onclick="viewHasilKuisGuru('${q.id_quiz}')" style="padding:8px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                📊 Laporan & Hasil
              </button>
              <button onclick="openModalEditKuis('${q.id_quiz}')" style="padding:8px;background:var(--bg-2);color:var(--text-2);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
                ✏️ Edit Setting
              </button>
              <button onclick="deleteKuisConfirm('${q.id_quiz}')" style="padding:8px;background:var(--red-l);color:var(--red);border:none;border-radius:var(--r-sm);font-weight:700;font-size:11.5px;cursor:pointer;">
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
  async function renderBankSoal(container) {
    try {
      var res = await window.HQ.QuizAPI.getBankSoal();
      var list = res.data || [];

      var html = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 style="font-size:15px;font-weight:800;color:var(--text);">Bank Soal Saya (${list.length})</h3>
          <button onclick="openModalCreateSoal()" style="padding:8px 16px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:12px;cursor:pointer;">
            ➕ Buat Soal Baru
          </button>
        </div>
      `;

      if (list.length === 0) {
        html += '<div style="background:var(--card-solid);padding:30px;border-radius:var(--r-lg);text-align:center;color:var(--text-3);">Belum ada soal di bank soal.</div>';
        container.innerHTML = html;
        return;
      }

      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      list.forEach(function (s, idx) {
        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:14px 18px;border:1px solid var(--border);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;">
                  ${s.tipe_soal}
                </span>
              </div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text);">${idx + 1}. ${escapeHtml(s.teks_soal)}</div>
            </div>
            <button onclick="deleteSoalConfirm('${s.id_soal}')" style="background:var(--red-l);color:var(--red);border:none;padding:6px 12px;border-radius:var(--r-sm);font-weight:700;font-size:11px;cursor:pointer;">
              Hapus
            </button>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;">Gagal memuat bank soal.</div>';
    }
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
              <button onclick="prosesReviewIsian('${item.id_jawaban}', true, false)" style="padding:8px 14px;background:var(--green-l);color:var(--green-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ✅ Approve (Benar)
              </button>
              <button onclick="prosesReviewIsian('${item.id_jawaban}', true, true)" style="padding:8px 14px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ➕ Approve & Simpan sbg Varian Baru
              </button>
              <button onclick="prosesReviewIsian('${item.id_jawaban}', false, false)" style="padding:8px 14px;background:var(--red-l);color:var(--red);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ❌ Tolak (Salah)
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

  // Helper Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showLoading(msg) {
    if (typeof window.showLoad === 'function') window.showLoad(msg);
  }

  function hideLoading() {
    if (typeof window.hideLoad === 'function') window.hideLoad();
  }

})();
