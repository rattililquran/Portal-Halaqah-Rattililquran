// ============================================================
//  murid/quiz-module.js  v1.0.6
//  Portal Murid — Rattil Quiz Interactive Engine
// ============================================================

(function () {
  'use strict';

  var _currentQuiz = null;
  var _quizData = null; // Detail quiz & questions from getKuisDetail
  var _currentQuestionIdx = 0;
  var _attemptKe = 1;
  var _userAnswers = {}; // { id_soal: { id_pilihan, matching_json, teks_isian, waktu_detik } }
  var _questionStartTime = 0;
  var _quizStartTime = 0;
  var _timerInterval = null;
  var _tabSwitchCount = 0;
  var _tabAwayStartTime = 0;
  var _totalAwayDuration = 0;
  var _isQuizActive = false;
  var _antiCheatHandler = null;

  function showLoading(msg) {
    if (typeof window.showLoad === 'function') window.showLoad(msg);
  }

  function hideLoading() {
    if (typeof window.hideLoad === 'function') window.hideLoad();
  }

  // ─────────────────────────────────────────────
  //  1. RENDER KUIS PAGE IN PORTAL MURID
  // ─────────────────────────────────────────────
  window.renderMuridQuizPage = async function () {
    var container = document.getElementById('page-kuis');
    if (!container) return;

    container.innerHTML = `
      <div class="quiz-container">
        <div id="quizListView">
          <!-- Tab Navigation -->
          <div style="display:inline-flex;background:rgba(0,0,0,0.04);padding:4px;border-radius:100px;margin-bottom:24px;border:1px solid rgba(0,0,0,0.03);overflow-x:auto;max-width:100%;">
            <button id="tabKuisTersedia" onclick="switchQuizTab('tersedia')" style="padding:8px 20px;font-weight:800;font-size:13px;color:var(--blue-d);border:none;border-radius:100px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.05);cursor:pointer;transition:all 0.25s ease;display:flex;align-items:center;gap:6px;white-space:nowrap;">
              🎯 Kuis Tersedia
            </button>
            <button id="tabKuisProgres" onclick="switchQuizTab('progres')" style="padding:8px 20px;font-weight:700;font-size:13px;color:var(--text-3);border:none;border-radius:100px;background:transparent;cursor:pointer;transition:all 0.25s ease;display:flex;align-items:center;gap:6px;white-space:nowrap;">
              📈 Progres Saya
            </button>
          </div>
        </div>

        <!-- Kuis Tersedia View -->
        <div id="quizTersediaWrapper">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:800;color:var(--text)">🎯 Daftar Kuis</h2>
              <p style="font-size:11.5px;color:var(--text-3)">Latihan interaktif & kuis halaqah untuk kelasmu</p>
            </div>
            <button onclick="loadKuisTersedia()" class="btn-refresh-quiz" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:8px 14px;border-radius:100px;font-weight:700;font-size:12px;cursor:pointer;">
              🔄 Refresh
            </button>
          </div>
          <div id="quizListContainer">
            <div style="text-align:center;padding:40px;color:var(--text-3)">Memuat daftar kuis...</div>
          </div>
        </div>

        <!-- Progres Kuis View -->
        <div id="quizProgresWrapper" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:800;color:var(--text)">📈 Progres Belajar</h2>
              <p style="font-size:11.5px;color:var(--text-3)">Analisis hasil pengerjaan kuis kamu</p>
            </div>
            <button onclick="loadProgresKuis()" class="btn-refresh-quiz" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:8px 14px;border-radius:100px;font-weight:700;font-size:12px;cursor:pointer;">
              🔄 Refresh
            </button>
          </div>
          <div id="quizProgressContainer">
            <div style="text-align:center;padding:40px;color:var(--text-3)">Memuat data progres...</div>
          </div>
        </div>
      </div>

      <div id="quizInstructionView" style="display:none;"></div>
      <div id="quizPlayView" style="display:none;"></div>
      <div id="quizResultView" style="display:none;"></div>
    `;

    await loadKuisTersedia();
  };

  window.switchQuizTab = function (tab) {
    var tabTersedia = document.getElementById('tabKuisTersedia');
    var tabProgres = document.getElementById('tabKuisProgres');
    var wrapperTersedia = document.getElementById('quizTersediaWrapper');
    var wrapperProgres = document.getElementById('quizProgresWrapper');

    if (!tabTersedia || !tabProgres || !wrapperTersedia || !wrapperProgres) return;

    if (tab === 'tersedia') {
      tabTersedia.style.color = 'var(--blue-d)';
      tabTersedia.style.background = '#fff';
      tabTersedia.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
      tabTersedia.style.fontWeight = '800';

      tabProgres.style.color = 'var(--text-3)';
      tabProgres.style.background = 'transparent';
      tabProgres.style.boxShadow = 'none';
      tabProgres.style.fontWeight = '700';

      wrapperTersedia.style.display = 'block';
      wrapperProgres.style.display = 'none';
      loadKuisTersedia();
    } else {
      tabProgres.style.color = 'var(--blue-d)';
      tabProgres.style.background = '#fff';
      tabProgres.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
      tabProgres.style.fontWeight = '800';

      tabTersedia.style.color = 'var(--text-3)';
      tabTersedia.style.background = 'transparent';
      tabTersedia.style.boxShadow = 'none';
      tabTersedia.style.fontWeight = '700';

      wrapperTersedia.style.display = 'none';
      wrapperProgres.style.display = 'block';
      loadProgresKuis();
    }
  };

  window.loadProgresKuis = async function () {
    var el = document.getElementById('quizProgressContainer');
    if (!el) return;

    try {
      var res = await window.HQ.QuizAPI.getRiwayatKuisMurid();
      var list = res.data || [];

      if (list.length === 0) {
        el.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:36px 20px;text-align:center;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="font-size:42px;margin-bottom:12px;">📊</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:4px;">Belum Ada Riwayat Kuis</h3>
            <p style="font-size:12px;color:var(--text-3);max-width:300px;margin:0 auto;">Kerjakan kuis latihan pertamamu untuk melihat analisis progres di sini!</p>
          </div>
        `;
        return;
      }

      // 1. Calculate Aggregate Metrics
      var totalAttempts = list.length;
      var totalPerfect = 0;
      var totalMinSpent = 0;
      var sumPercentage = 0;

      list.forEach(function(item) {
        var max = item.skor_maksimal || 100;
        var score = item.skor_total || 0;
        var pct = Math.round((score / max) * 100);
        sumPercentage += pct;
        if (pct === 100) totalPerfect++;
        totalMinSpent += (item.durasi_pengerjaan_detik || 0);
      });

      var avgPercentage = totalAttempts > 0 ? Math.round(sumPercentage / totalAttempts) : 0;
      var totalMinutes = Math.round(totalMinSpent / 60) || 1;

      // 2. Render Metrics Row
      var metricsHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:12px;margin-bottom:20px;">
          <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;box-shadow:var(--shadow-sm);">
            <div style="font-size:24px;margin-bottom:4px;">✏️</div>
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;">Kuis Diikuti</div>
            <div style="font-size:16px;font-weight:900;color:var(--text);margin-top:2px;">${totalAttempts} Kali</div>
          </div>
          <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;box-shadow:var(--shadow-sm);">
            <div style="font-size:24px;margin-bottom:4px;">🎯</div>
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;">Rata-rata</div>
            <div style="font-size:16px;font-weight:900;color:var(--blue-d);margin-top:2px;">${avgPercentage}%</div>
          </div>
          <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;box-shadow:var(--shadow-sm);">
            <div style="font-size:24px;margin-bottom:4px;">🏆</div>
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;">Sempurna</div>
            <div style="font-size:16px;font-weight:900;color:var(--green);margin-top:2px;">${totalPerfect} Kuis</div>
          </div>
          <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;box-shadow:var(--shadow-sm);">
            <div style="font-size:24px;margin-bottom:4px;">⏱️</div>
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;">Waktu Belajar</div>
            <div style="font-size:16px;font-weight:900;color:var(--text);margin-top:2px;">${totalMinutes} Menit</div>
          </div>
        </div>
      `;

      // 3. Render Trend CSS Bar Chart (chronological from left to right, up to latest 10 attempts)
      var latest = list.slice(0, 10).reverse();
      var barsHtml = latest.map(function(item, idx) {
        var max = item.skor_maksimal || 100;
        var score = item.skor_total || 0;
        var pct = Math.round((score / max) * 100);
        var quizTitle = (item.quiz && item.quiz.judul) || 'Kuis';

        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;margin:0 4px;position:relative;" title="${escapeHtml(quizTitle)}: ${score}/${max} (${pct}%)">
            <div style="width:70%;max-width:24px;height:${pct}%;background:linear-gradient(180deg, var(--blue), var(--blue-d));border-radius:4px 4px 0 0;position:relative;transition:all 0.3s ease;">
              <span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:800;color:var(--blue-d);">${pct}%</span>
            </div>
            <div style="font-size:8.5px;color:var(--text-3);margin-top:6px;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              #${idx + 1}
            </div>
          </div>
        `;
      }).join('');

      var chartHtml = `
        <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);margin-bottom:20px;">
          <h3 style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.02em;">📊 Tren Nilai Kuis Terbaru</h3>
          <div style="display:flex;align-items:flex-end;justify-content:space-between;height:140px;padding:12px 0 6px;border-bottom:2px solid var(--border);position:relative;">
            <div style="position:absolute;left:0;right:0;top:0;border-top:1px dashed var(--border);font-size:8.5px;color:var(--text-3);padding-top:2px;">100%</div>
            <div style="position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--border);font-size:8.5px;color:var(--text-3);padding-top:2px;">50%</div>
            ${barsHtml}
          </div>
        </div>
      `;

      // 4. Render Historical Attempts List
      var listHtml = '<div style="display:flex;flex-direction:column;gap:10px;">';
      list.forEach(function(item) {
        var max = item.skor_maksimal || 100;
        var score = item.skor_total || 0;
        var pct = Math.round((score / max) * 100);
        var quizTitle = (item.quiz && item.quiz.judul) || 'Kuis';
        var dateStr = new Date(item.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        var cat = (item.quiz && item.quiz.kategori) || 'Umum';
        var timeMin = Math.round((item.durasi_pengerjaan_detik || 0) / 60) || 1;

        var reviewSetting = (item.quiz && item.quiz.tampilkan_jawaban) || 'setelah_submit';
        var showReviewBtn = reviewSetting === 'setelah_submit';

        var reviewBtnHtml = showReviewBtn 
          ? `<button onclick="viewQuizResult('${escapeJsStr(item.id_quiz)}', ${item.attempt_ke})" style="padding:6px 12px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:100px;font-size:11px;font-weight:800;cursor:pointer;transition:all 0.2s;">📊 Lihat Review</button>`
          : `<span style="font-size:10px;color:var(--text-3);background:var(--bg-2);padding:4px 8px;border-radius:100px;">🔒 Terkunci</span>`;

        listHtml += `
          <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-sm);border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="font-size:9px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:1.5px 6px;border-radius:100px;">${escapeHtml(cat)}</span>
                <span style="font-size:11px;color:var(--text-3);">${dateStr}</span>
              </div>
              <h4 style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;">${escapeHtml(quizTitle)} (Percobaan #${item.attempt_ke})</h4>
              <div style="font-size:11.5px;color:var(--text-2);">
                ⏱️ Durasi: <strong>${timeMin} Menit</strong> | 🎯 Skor: <strong>${score}/${max}</strong> (${pct}%)
              </div>
            </div>
            <div style="flex-shrink:0;">
              ${reviewBtnHtml}
            </div>
          </div>
        `;
      });
      listHtml += '</div>';

      el.innerHTML = metricsHtml + chartHtml + `
        <h3 style="font-size:13.5px;font-weight:800;color:var(--text);margin:24px 0 10px;text-transform:uppercase;letter-spacing:0.02em;">📜 Riwayat Pengerjaan</h3>
      ` + listHtml;
    } catch(err) {
      console.error('[QuizProgress] Load failed:', err);
      el.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">Gagal memuat riwayat progres. Silakan coba lagi.</div>';
    }
  };

  async function loadKuisTersedia() {
    var el = document.getElementById('quizListContainer');
    if (!el) return;

    try {
      var res = await window.HQ.QuizAPI.getKuisTersedia();
      var list = res.data || [];

      if (list.length === 0) {
        el.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:36px 20px;text-align:center;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="font-size:42px;margin-bottom:12px;">📚</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:4px;">Belum Ada Kuis Aktif</h3>
            <p style="font-size:12px;color:var(--text-3);max-width:300px;margin:0 auto;">Saat ini belum ada kuis latihan yang dibuka ustadz/ustadzah untuk halaqahmu.</p>
          </div>
        `;
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">';
      list.forEach(function (q) {
        var isDone = q.sudah_dikerjakan;
        var score = isDone && q.hasil_terbaik ? q.hasil_terbaik.skor_total : 0;
        var maxScore = isDone && q.hasil_terbaik ? q.hasil_terbaik.skor_maksimal : 100;
        var pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        var categoryBadge = q.kategori || 'Umum';

        var canRetake = q.boleh_retake || (isDone && pct < 50);

        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);position:relative;display:flex;flex-direction:column;justify-content:space-between;transition:transform .2s;" class="quiz-card-item">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="background:var(--blue-l);color:var(--blue-d);font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;text-transform:uppercase;letter-spacing:.04em;">
                  🏷️ ${escapeHtml(categoryBadge)}
                </span>
                ${q.mode === 'live' ? '<span style="background:var(--red-l);color:var(--red);font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;">⚡ LIVE</span>' : ''}
              </div>
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px;line-height:1.3;">
                ${escapeHtml(q.judul)}
              </h3>
              <p style="font-size:12px;color:var(--text-2);margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${escapeHtml(q.deskripsi || 'Tidak ada deskripsi.')}
              </p>
            </div>

            <div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text-3);margin-bottom:14px;background:var(--bg-2);padding:8px 12px;border-radius:var(--r-sm);">
                <span>⏱️ ${q.durasi_per_soal_detik ? q.durasi_per_soal_detik + ' dtk/soal' : 'Tanpa batas'}</span>
                <span>•</span>
                <span>🔄 ${q.boleh_retake ? 'Bisa Ulang' : 'Ulang jika < 50%'}</span>
              </div>

              ${isDone ? `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-size:11px;font-weight:700;color:var(--text-2);">Skor Terbaik:</span>
                  <span style="font-size:14px;font-weight:900;color:var(--green);">${score} / ${maxScore}</span>
                </div>
                <div style="display:flex;gap:8px;">
                  ${canRetake ? `
                    <button onclick="startQuizFlow('${q.id_quiz}')" style="flex:1;padding:10px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
                      🔄 Kerjakan Lagi
                    </button>
                  ` : ''}
                  <button onclick="viewQuizResult('${q.id_quiz}')" style="flex:1;padding:10px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;">
                    📊 Lihat Hasil
                  </button>
                </div>
              ` : `
                <button onclick="startQuizFlow('${q.id_quiz}')" style="width:100%;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:13px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
                  🚀 Mulai Kuis
                </button>
              `}
            </div>
          </div>
        `;
      });
      html += '</div>';
      el.innerHTML = html;
    } catch (err) {
      console.error('[Quiz] Load failed:', err);
      el.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">Gagal memuat kuis. Silakan coba lagi.</div>';
    }
  }

  // ─────────────────────────────────────────────
  //  2. INSTRUCTION & START FLOW
  // ─────────────────────────────────────────────
  window.startQuizFlow = async function (id_quiz) {
    try {
      showLoading('Menyiapkan soal kuis...');
      var res = await window.HQ.QuizAPI.getKuisDetail(id_quiz);
      
      // Calculate attempt_ke based on past hasil_quiz records in the database
      var id_murid = window.HQ.getCurrentUser().id_user;
      var { data: hasilData, error: hasilErr } = await window.HQ.supabase
        .from('hasil_quiz')
        .select('attempt_ke, skor_total, skor_maksimal')
        .eq('id_quiz', id_quiz)
        .eq('id_murid', id_murid)
        .order('attempt_ke', { ascending: false });
      
      if (hasilErr) console.warn('[Quiz] Gagal mengambil riwayat attempt:', hasilErr);
      var maxAttempt = 0;
      var bestPct = 0;
      if (hasilData && hasilData.length > 0) {
        maxAttempt = hasilData[0].attempt_ke;
        hasilData.forEach(function(h) {
          var max = h.skor_maksimal || 100;
          var score = h.skor_total || 0;
          var pct = max > 0 ? Math.round((score / max) * 100) : 0;
          if (pct > bestPct) bestPct = pct;
        });
      }
      _attemptKe = maxAttempt + 1;

      _quizData = res.data;

      // Enforce lock if bestPct >= 50 and boleh_retake is false
      var hasAnyPast = maxAttempt > 0;
      var isRetakeAllowed = _quizData.boleh_retake || !hasAnyPast || (hasAnyPast && bestPct < 50);

      if (!isRetakeAllowed) {
        hideLoading();
        showQuizAlert({ 
          title: 'Akses Dibatasi 🔒', 
          message: 'Anda sudah berhasil lulus kuis ini dengan nilai terbaik ' + bestPct + '% (Batas Kelulusan: 50%). Anda tidak dapat mengulang kuis ini lagi.', 
          type: 'info' 
        });
        return;
      }

      hideLoading();

      _currentQuiz = _quizData;
      _currentQuestionIdx = 0;
      _userAnswers = {};
      _tabSwitchCount = 0;
      _totalAwayDuration = 0;

      if (!_quizData.soal || _quizData.soal.length === 0) {
        showQuizAlert({ title: 'Kuis Belum Siap', message: 'Kuis ini belum memiliki soal.', type: 'info' });
        return;
      }

      document.getElementById('quizListView').style.display = 'none';
      document.getElementById('quizResultView').style.display = 'none';

      var insEl = document.getElementById('quizInstructionView');
      insEl.style.display = 'block';

      insEl.innerHTML = `
        <div style="background:var(--card-solid);border-radius:var(--r-xl);padding:30px 24px;border:1px solid var(--border);box-shadow:var(--shadow-lg);max-width:540px;margin:0 auto;text-align:center;">
          
          <!-- Basmalah & Header Icon -->
          <div style="margin-bottom:18px;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(14,165,233,0.15));border:1px solid rgba(16,185,129,0.3);font-size:32px;margin:0 auto 12px;box-shadow:0 8px 20px rgba(0,0,0,0.06);">
              📖
            </div>
            
            <div style="font-family:'Amiri',serif;font-size:26px;color:#059669;margin-bottom:8px;direction:rtl;line-height:1.4;font-weight:700;letter-spacing:0.02em;">
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </div>

            <h2 style="font-size:18px;font-weight:900;color:var(--text);line-height:1.3;margin-bottom:6px;">
              ${escapeHtml(_quizData.judul)}
            </h2>
            <p style="font-size:12px;color:var(--text-3);line-height:1.5;">
              ${escapeHtml(_quizData.deskripsi || '')}
            </p>
          </div>

          <!-- Nasihat Kejujuran & Doa Card -->
          <div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(16,185,129,0.08));border:1px solid rgba(245,158,11,0.25);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:18px;text-align:center;">
            <div style="font-size:12px;font-weight:800;color:var(--amber-txt);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;">
              <span>✨ Nasihat & Adab Mengerjakan Kuis</span>
            </div>
            <p style="font-size:11.5px;color:var(--text-2);line-height:1.5;margin-bottom:10px;font-style:italic;">
              "Sesungguhnya kejujuran akan membawa kepada kebaikan, dan kebaikan akan membawa ke dalam surga." (HR. Bukhari & Muslim)
            </p>
            <div style="background:rgba(255,255,255,0.7);padding:8px 12px;border-radius:var(--r-sm);border:1px dashed rgba(16,185,129,0.3);">
              <div style="font-family:'Amiri',serif;font-size:18px;color:#047857;direction:rtl;margin-bottom:2px;">
                رَبِّ زِدْنِي عِلْمًا وَارْزُقْنِي فَهْمًا
              </div>
              <div style="font-size:10.5px;color:var(--text-3);">
                "Ya Rabb-ku, tambahkanlah kepadaku ilmu dan berilah aku kefahaman."
              </div>
            </div>
          </div>

          <!-- Quiz Info List -->
          <div style="background:var(--bg-2);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:18px;font-size:12px;text-align:left;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-3);font-weight:600;">Jumlah Soal</span>
              <strong style="color:var(--text);font-weight:800;">${_quizData.soal.length} Butir Soal</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-3);font-weight:600;">Waktu per Soal</span>
              <strong style="color:var(--text);font-weight:800;">${_quizData.durasi_per_soal_detik ? _quizData.durasi_per_soal_detik + ' Detik' : 'Tanpa Batas'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:var(--text-3);font-weight:600;">Pengawasan Anti-Cheat</span>
              <strong style="color:${_quizData.anti_tab_aktif ? 'var(--amber-txt)' : 'var(--text-3)'}; font-weight:800;">
                ${_quizData.anti_tab_aktif ? '⚠️ Peringatan Pindah Tab' : 'Nonaktif'}
              </strong>
            </div>
          </div>

          <!-- Buttons -->
          <div style="display:flex;gap:10px;">
            <button onclick="cancelQuizFlow()" style="flex:1;padding:13px;background:var(--bg-2);color:var(--text-2);border:none;border-radius:var(--r-pill,100px);font-weight:700;font-size:13px;cursor:pointer;">
              Batal
            </button>
            <button onclick="beginQuizPlay()" style="flex:2;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 4px 16px rgba(16,185,129,0.35);">
              بِسْمِ اللَّهِ — Mulai Kuis 🚀
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      hideLoading();
      showQuizAlert({ title: 'Gagal Membuka Kuis', message: err.message, type: 'danger' });
    }
  };

  window.cancelQuizFlow = function () {
    document.getElementById('quizInstructionView').style.display = 'none';
    document.getElementById('quizListView').style.display = 'block';
  };

  // ─────────────────────────────────────────────
  //  3. PLAYING ENGINE & TIMER & ANTI-CHEAT
  // ─────────────────────────────────────────────
  window.beginQuizPlay = function () {
    document.getElementById('quizInstructionView').style.display = 'none';

    var playEl = document.getElementById('quizPlayView');
    playEl.style.display = 'block';

    _isQuizActive = true;
    _quizStartTime = Date.now();

    // Attach Anti-tab listener
    setupAntiCheatListener();

    renderQuestion(_currentQuestionIdx);
  };

  function setupAntiCheatListener() {
    if (!_quizData.anti_tab_aktif) return;

    if (_antiCheatHandler) {
      document.removeEventListener('visibilitychange', _antiCheatHandler);
    }

    _antiCheatHandler = function () {
      if (!_isQuizActive) return;

      if (document.hidden) {
        _tabAwayStartTime = Date.now();
        _tabSwitchCount++;
      } else {
        if (_tabAwayStartTime > 0) {
          var awayDuration = Math.round((Date.now() - _tabAwayStartTime) / 1000);
          _totalAwayDuration += awayDuration;
          _tabAwayStartTime = 0;
        }

        // Pop up warning modal (custom glassmorphism UI)
        var maxWarn = _quizData.maks_peringatan_tab || 2;
        if (_tabSwitchCount >= maxWarn) {
          showQuizAlert({
            title: '⚠️ Peringatan Pindah Tab',
            message: 'Terdeteksi meninggalkan halaman kuis ' + _tabSwitchCount + ' kali. Kuis akan otomatis disubmit!',
            type: 'danger',
            icon: '🚨',
            buttonText: 'Submit Kuis Sekarang',
            callback: function () {
              finishAndSubmitQuiz();
            }
          });
        } else {
          showQuizAlert({
            title: '⚠️ Peringatan Pindah Tab (' + _tabSwitchCount + '/' + maxWarn + ')',
            message: 'Kamu baru saja meninggalkan halaman kuis! Aktivitas ini telah dicatat oleh sistem.',
            type: 'warning',
            icon: '⚠️',
            buttonText: 'Kembali ke Kuis'
          });
        }
      }
    };

    document.addEventListener('visibilitychange', _antiCheatHandler);
  }

  function renderQuestion(idx) {
    if (idx < 0 || idx >= _quizData.soal.length) return;

    _currentQuestionIdx = idx;
    _questionStartTime = Date.now();

    var soal = _quizData.soal[idx];
    var totalSoal = _quizData.soal.length;
    var playEl = document.getElementById('quizPlayView');

    // Setup timer jika ada durasi (Combined Ultimate Tension Theme)
    if (_timerInterval) clearInterval(_timerInterval);
    var timeRemaining = (soal && soal.durasi_detik) ? soal.durasi_detik : (_quizData.durasi_per_soal_detik || 0);

    var timerHtml = timeRemaining > 0 ? `
      <div id="quizTimerContainer" style="margin-top:10px;padding:10px 14px;background:var(--bg-2);border-radius:var(--r-md);border:1px solid var(--border);position:relative;transition:all .3s ease;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span id="quizTimerBadge" style="font-size:12px;font-weight:900;color:var(--text);display:flex;align-items:center;gap:6px;transition:all .3s ease;">
            <span id="quizTimerIcon" style="font-size:16px;">⏱️</span>
            <span id="quizTimerText">${timeRemaining}s</span>
          </span>
          <span id="quizTimerStatus" style="font-size:10px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;transition:all .3s ease;">
            Sisa Waktu
          </span>
        </div>

        <div style="width:100%;height:14px;background:rgba(0,0,0,0.06);border-radius:100px;position:relative;overflow:visible;box-shadow:inset 0 1px 3px rgba(0,0,0,0.1);">
          <div id="quizTimerBar" style="width:100%;height:100%;background:linear-gradient(90deg,#10b981,#0ea5e9);border-radius:100px;transition:width 1s linear, background 0.5s ease;position:relative;">
            <div id="quizTimerSprite" style="position:absolute;right:-12px;top:-10px;font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);">
              👾
            </div>
          </div>
        </div>
      </div>

      <style>
        @keyframes tensionHeartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.22); color: #ef4444; }
        }
        @keyframes tensionShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 2px); }
        }
        @keyframes tensionGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.05); }
          50% { box-shadow: 0 0 22px rgba(239,68,68,0.6); border-color: rgba(239,68,68,0.9); background: rgba(239,68,68,0.15); }
        }
      </style>
    ` : '';

    var html = `
      <div style="max-width:600px;margin:0 auto;">
        <!-- Header Progress -->
        <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:14px 18px;border:1px solid var(--border);box-shadow:var(--shadow);margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:800;color:var(--text-3);">Soal ${idx + 1} dari ${totalSoal}</span>
            <span style="font-size:11px;font-weight:700;color:var(--blue-d);background:var(--blue-l);padding:2px 8px;border-radius:100px;">
              ${getTipeSoalLabel(soal.tipe_soal)}
            </span>
          </div>
          ${timerHtml}
        </div>

        <!-- Question Body Card -->
        <div style="background:var(--card-solid);border-radius:var(--r-xl);padding:22px;border:1px solid var(--border);box-shadow:var(--shadow-lg);margin-bottom:16px;">
          
          <!-- Teks Arab Render jika ada -->
          ${soal.teks_arab ? `
            <div style="font-family:'Amiri',serif;font-size:24px;line-height:1.8;color:var(--text);text-align:right;direction:rtl;margin-bottom:14px;background:var(--bg-2);padding:14px;border-radius:var(--r-sm);border-right:3px solid var(--blue);">
              ${renderArabicHighlight(soal.teks_arab, soal.highlight_markup)}
            </div>
          ` : ''}

          <!-- Pertanyaan Latin -->
          <h3 style="font-size:15px;font-weight:700;color:var(--text);line-height:1.5;margin-bottom:18px;">
            ${escapeHtml(soal.teks_soal)}
          </h3>

          <!-- Audio Player jika tipe audio -->
          ${soal.audio_url ? `
            <div style="margin-bottom:18px;background:var(--blue-l);padding:12px;border-radius:var(--r-sm);text-align:center;">
              <audio controls style="width:100%;max-width:320px;">
                <source src="${escapeHtml(soal.audio_url)}" type="audio/mpeg">
                Browser kamu tidak mendukung pemutar suara.
              </audio>
            </div>
          ` : ''}

          <!-- Form Jawaban Berdasarkan Tipe -->
          <div id="quizAnswerContainer">
            ${renderAnswerInputs(soal)}
          </div>
        </div>

        <!-- Bottom Navigation Controls -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${idx > 0 ? `
            <button onclick="prevQuestion()" style="padding:10px 18px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;font-size:12px;cursor:pointer;">
              ⬅️ Sebelumnya
            </button>
          ` : '<div></div>'}

          ${idx < totalSoal - 1 ? `
            <button onclick="nextQuestion()" style="padding:10px 22px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:13px;cursor:pointer;box-shadow:var(--shadow-blue);">
              Selanjutnya ➡️
            </button>
          ` : `
            <button id="btnSubmitQuiz" onclick="finishAndSubmitQuiz()" style="padding:10px 24px;background:linear-gradient(135deg,var(--green),var(--green-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 16px rgba(16,185,129,0.3);">
              Selesai & Submit 🏁
            </button>
          `}
        </div>
      </div>
    `;

    playEl.innerHTML = html;

    // Start Timer Interval with Combined Ultimate Tension Engine
    if (timeRemaining > 0) {
      var currentSec = timeRemaining;
      var totalDuration = timeRemaining;
      _timerInterval = setInterval(function () {
        currentSec--;
        var txtEl = document.getElementById('quizTimerText');
        var barEl = document.getElementById('quizTimerBar');
        var spriteEl = document.getElementById('quizTimerSprite');
        var containerEl = document.getElementById('quizTimerContainer');
        var statusEl = document.getElementById('quizTimerStatus');
        var badgeEl = document.getElementById('quizTimerBadge');

        var pct = Math.max(0, (currentSec / totalDuration) * 100);

        if (barEl) barEl.style.width = pct + '%';
        if (txtEl) txtEl.textContent = currentSec + 's';

        // TENSION ENGINE PHASES & SHARIAH-COMPLIANT SFX
        if (currentSec > 10) {
          // Phase 1: Safe Zone (Green/Sky Pacman + Soft Wood Click)
          if (barEl) barEl.style.background = 'linear-gradient(90deg, #10b981, #0ea5e9)';
          if (spriteEl) spriteEl.textContent = '👾';
          if (statusEl) { statusEl.textContent = 'Sisa Waktu'; statusEl.style.color = 'var(--text-3)'; }
          playWoodClick();
        } else if (currentSec > 5) {
          // Phase 2: Warning Zone (Amber Flame Fuse + Wood Click)
          if (barEl) barEl.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
          if (spriteEl) spriteEl.textContent = '🔥';
          if (statusEl) { statusEl.textContent = '⚠️ Waktu Menipis!'; statusEl.style.color = '#f59e0b'; }
          if (txtEl) txtEl.style.color = '#f59e0b';
          playWoodClick();
        } else if (currentSec > 0) {
          // Phase 3: CRITICAL TENSION ZONE (< 5s) - Heartbeat Pulse Sound
          if (barEl) barEl.style.background = 'linear-gradient(90deg, #ef4444, #991b1b)';
          if (spriteEl) spriteEl.textContent = (currentSec % 2 === 0) ? '💣' : '💥';
          if (txtEl) {
            txtEl.textContent = currentSec + 's';
            txtEl.style.color = '#ef4444';
            txtEl.style.fontSize = '16px';
          }
          if (badgeEl) badgeEl.style.animation = 'tensionHeartbeat 0.5s infinite';
          if (containerEl) containerEl.style.animation = 'tensionShake 0.2s infinite, tensionGlow 0.5s infinite';
          if (statusEl) {
            statusEl.textContent = '🚨 KRITIS! CEPAT SUBMIT!';
            statusEl.style.color = '#ef4444';
            statusEl.style.fontWeight = '900';
          }
          playHeartbeat();
        }

        if (currentSec <= 0) {
          clearInterval(_timerInterval);
          saveCurrentQuestionAnswer();
          if (_currentQuestionIdx < _quizData.soal.length - 1) {
            nextQuestion();
          } else {
            finishAndSubmitQuiz();
          }
        }
      }, 1000);
    }
  }

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

  function renderAnswerInputs(soal) {
    var saved = _userAnswers[soal.id_soal] || {};

    if (soal.tipe_soal === 'pilihan_ganda' || soal.tipe_soal === 'audio' || soal.tipe_soal === 'teks_arab') {
      var colors = [
        'background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.25);color:var(--text);',
        'background:rgba(37,99,235,0.08);border:1.5px solid rgba(37,99,235,0.25);color:var(--text);',
        'background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.25);color:var(--text);',
        'background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.25);color:var(--text);'
      ];

      var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
      (soal.pilihan || []).forEach(function (p, idx) {
        var style = colors[idx % colors.length];
        var isSelected = saved.id_pilihan === p.id_pilihan;
        var activeBorder = isSelected ? 'border:2px solid var(--blue-d);background:var(--blue-l);font-weight:800;' : '';

        html += `
          <button onclick="selectOptionAnswer('${soal.id_soal}', '${p.id_pilihan}', this)" style="padding:14px 16px;border-radius:var(--r-sm);text-align:left;font-family:inherit;font-size:13.5px;cursor:pointer;transition:all .2s;${style}${activeBorder}" class="quiz-option-btn">
            <span style="font-weight:800;margin-right:8px;">${String.fromCharCode(65 + idx)}.</span>
            ${escapeHtml(p.teks_pilihan)}
          </button>
        `;
      });
      html += '</div>';
      return html;
    }

    if (soal.tipe_soal === 'benar_salah') {
      var selPilihan = saved.id_pilihan;
      var isBenarSel = false, isSalahSel = false;
      (soal.pilihan || []).forEach(function (p) {
        if (p.id_pilihan === selPilihan) {
          if (p.teks_pilihan.toLowerCase().includes('benar')) isBenarSel = true;
          else isSalahSel = true;
        }
      });

      var pBenar = (soal.pilihan || []).find(function(p){ return p.teks_pilihan.toLowerCase().includes('benar'); });
      var pSalah = (soal.pilihan || []).find(function(p){ return p.teks_pilihan.toLowerCase().includes('salah'); });

      return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <button onclick="selectOptionAnswer('${soal.id_soal}', '${pBenar ? pBenar.id_pilihan : ''}', this)" style="padding:16px;border-radius:var(--r-md);border:${isBenarSel ? '3px solid #10b981' : '1.5px solid rgba(16,185,129,0.3)'};background:rgba(16,185,129,0.1);color:#065f46;font-weight:800;font-size:15px;cursor:pointer;">
            ✅ Benar
          </button>
          <button onclick="selectOptionAnswer('${soal.id_soal}', '${pSalah ? pSalah.id_pilihan : ''}', this)" style="padding:16px;border-radius:var(--r-md);border:${isSalahSel ? '3px solid #ef4444' : '1.5px solid rgba(239,68,68,0.3)'};background:rgba(239,68,68,0.1);color:#991b1b;font-weight:800;font-size:15px;cursor:pointer;">
            ❌ Salah
          </button>
        </div>
      `;
    }

    if (soal.tipe_soal === 'matching') {
      var savedMatching = saved.matching_json || [];
      var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
      (soal.pasangan || []).forEach(function (pas, idx) {
        var existingMatch = savedMatching.find(function(m){ return m.kiri === pas.teks_kiri; });
        var selectedKanan = existingMatch ? existingMatch.kanan_dipilih : '';

        html += `
          <div style="background:var(--bg-2);padding:12px 14px;border-radius:var(--r-sm);display:flex;flex-direction:column;gap:6px;">
            <div style="font-weight:700;font-size:13px;color:var(--text);">${idx + 1}. ${escapeHtml(pas.teks_kiri)}</div>
            <select onchange="updateMatchingAnswer('${soal.id_soal}', '${escapeHtml(pas.teks_kiri)}', this.value)" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;background:var(--card-solid);color:var(--text);">
              <option value="">-- Pilih Pasangan --</option>
              ${(pas.opsi_kanan || []).map(function(k){
                return `<option value="${escapeHtml(k)}" ${k === selectedKanan ? 'selected' : ''}>${escapeHtml(k)}</option>`;
              }).join('')}
            </select>
          </div>
        `;
      });
      html += '</div>';
      return html;
    }

    if (soal.tipe_soal === 'isian_singkat') {
      var teksSaved = saved.teks_isian || '';
      return `
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;">Ketik Jawaban Singkat (Latin):</label>
          <input type="text" maxlength="500" value="${escapeHtml(teksSaved)}" oninput="updateIsianAnswer('${soal.id_soal}', this.value)" placeholder="Ketik jawaban kamu di sini..." style="width:100%;padding:14px;border-radius:var(--r-sm);border:1.5px solid var(--blue);font-family:inherit;font-size:14px;font-weight:600;outline:none;background:var(--card-solid);color:var(--text);">
          <p style="font-size:11px;color:var(--text-3);margin-top:6px;">*Jawaban akan diperiksa otomatis atau ditinjau ustadz/ustadzah.</p>
        </div>
      `;
    }

    return '<div>Tipe soal tidak dikenali.</div>';
  }

  // Answer Choice Handlers
  window.selectOptionAnswer = function (id_soal, id_pilihan, btnEl) {
    var container = btnEl.parentElement;
    if (container) {
      container.querySelectorAll('.quiz-option-btn').forEach(function(b){
        b.style.border = '';
        b.style.fontWeight = '';
      });
      btnEl.style.border = '2px solid var(--blue-d)';
      btnEl.style.fontWeight = '800';
    }

    var timeSpent = Math.round((Date.now() - _questionStartTime) / 1000);
    _userAnswers[id_soal] = {
      id_pilihan: id_pilihan,
      waktu_detik: timeSpent
    };

    // Save server-side via RPC immediately
    submitAnswerToServer(id_soal);
  };

  window.updateMatchingAnswer = function (id_soal, kiriText, kananSelected) {
    if (!_userAnswers[id_soal]) {
      _userAnswers[id_soal] = { matching_json: [], waktu_detik: 0 };
    }

    var list = _userAnswers[id_soal].matching_json || [];
    var idx = list.findIndex(function(m){ return m.kiri === kiriText; });

    if (kananSelected) {
      if (idx >= 0) list[idx].kanan_dipilih = kananSelected;
      else list.push({ kiri: kiriText, kanan_dipilih: kananSelected });
    } else {
      if (idx >= 0) list.splice(idx, 1);
    }

    _userAnswers[id_soal].matching_json = list;
    _userAnswers[id_soal].waktu_detik = Math.round((Date.now() - _questionStartTime) / 1000);

    submitAnswerToServer(id_soal);
  };

  window.updateIsianAnswer = function (id_soal, val) {
    _userAnswers[id_soal] = {
      teks_isian: val,
      waktu_detik: Math.round((Date.now() - _questionStartTime) / 1000)
    };

    submitAnswerToServer(id_soal);
  };

  async function submitAnswerToServer(id_soal) {
    var ans = _userAnswers[id_soal];
    if (!ans) return;

    try {
      await window.HQ.QuizAPI.jawabSoal({
        id_quiz: _quizData.id_quiz,
        id_soal: id_soal,
        attempt_ke: _attemptKe,
        id_pilihan: ans.id_pilihan || null,
        matching_json: ans.matching_json || null,
        teks_isian: ans.teks_isian || null,
        waktu_detik: ans.waktu_detik || 0
      });
    } catch (e) {
      console.warn('[Quiz] RPC jawab_soal error:', e);
    }
  }

  function saveCurrentQuestionAnswer() {
    var soal = _quizData.soal[_currentQuestionIdx];
    if (soal) submitAnswerToServer(soal.id_soal);
  }

  window.nextQuestion = function () {
    if (_timerInterval) clearInterval(_timerInterval);
    saveCurrentQuestionAnswer();
    renderQuestion(_currentQuestionIdx + 1);
  };

  window.prevQuestion = function () {
    if (_timerInterval) clearInterval(_timerInterval);
    saveCurrentQuestionAnswer();
    renderQuestion(_currentQuestionIdx - 1);
  };

  window.finishAndSubmitQuiz = async function () {
    if (_timerInterval) clearInterval(_timerInterval);
    _isQuizActive = false;

    if (_antiCheatHandler) {
      document.removeEventListener('visibilitychange', _antiCheatHandler);
      _antiCheatHandler = null;
    }

    saveCurrentQuestionAnswer();

    var btnSubmit = document.getElementById('btnSubmitQuiz');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Menyimpan... ⏳';
    }

    try {
      showLoading('Finalisasi & menghitung skor kuis...');
      var totalDuration = Math.round((Date.now() - _quizStartTime) / 1000);

      await window.HQ.QuizAPI.submitKuis({
        id_quiz: _quizData.id_quiz,
        attempt_ke: _attemptKe,
        durasi_pengerjaan_detik: totalDuration,
        jumlah_tab_switch: _tabSwitchCount,
        total_durasi_keluar_detik: _totalAwayDuration
      });

      hideLoading();
      await viewQuizResult(_quizData.id_quiz, _attemptKe);
    } catch (err) {
      hideLoading();
      showQuizAlert({ title: 'Gagal Submit Kuis', message: err.message, type: 'danger' });
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Selesai & Submit 🏁';
      }
    }
  };

  // ─────────────────────────────────────────────
  //  4. RESULT & LEADERBOARD VIEW
  // ─────────────────────────────────────────────
  window.viewQuizResult = async function (id_quiz, attempt_ke) {
    try {
      showLoading('Memuat hasil & leaderboard...');
      var [hasilRes, leaderboardRes] = await Promise.all([
        window.HQ.QuizAPI.getHasilKuisMurid(id_quiz, attempt_ke || 1),
        window.HQ.QuizAPI.getLeaderboardKuis(id_quiz)
      ]);
      hideLoading();

      document.getElementById('quizListView').style.display = 'none';
      document.getElementById('quizInstructionView').style.display = 'none';
      document.getElementById('quizPlayView').style.display = 'none';

      var resEl = document.getElementById('quizResultView');
      resEl.style.display = 'block';

      var hasil = hasilRes.hasil;
      var jawaban = hasilRes.jawaban || [];
      var reviewSetting = hasilRes.tampilkan_jawaban_setting || 'setelah_submit';
      var leaderboard = leaderboardRes.data || [];

      var percent = hasil.skor_maksimal > 0 ? Math.round((hasil.skor_total / hasil.skor_maksimal) * 100) : 0;
      var isPerfect = percent === 100;

      var top3Html = '';
      if (leaderboard.length > 0) {
        top3Html = '<div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;margin:24px 0 16px;">';
        
        var ranks, icons, heights, colors;
        if (leaderboard.length >= 3) {
          ranks = [leaderboard[1], leaderboard[0], leaderboard[2]];
          icons = ['🥈', '🥇', '🥉'];
          heights = ['90px', '110px', '80px'];
          colors = ['#e2e8f0', '#fef08a', '#ffedd5'];
        } else if (leaderboard.length === 2) {
          ranks = [leaderboard[1], leaderboard[0]];
          icons = ['🥈', '🥇'];
          heights = ['90px', '110px'];
          colors = ['#e2e8f0', '#fef08a'];
        } else {
          ranks = [leaderboard[0]];
          icons = ['🥇'];
          heights = ['110px'];
          colors = ['#fef08a'];
        }

        ranks.forEach(function (r, i) {
          if (!r) return;
          top3Html += `
            <div style="flex:1;max-width:110px;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.nama_lengkap)}</div>
              <div style="height:${heights[i]};background:${colors[i]};border-radius:16px 16px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:var(--shadow);">
                <span style="font-size:24px;">${icons[i]}</span>
                <span style="font-weight:900;font-size:13px;color:var(--text);margin-top:2px;">${r.skor_total}</span>
              </div>
            </div>
          `;
        });
        top3Html += '</div>';
      }

      var listOthersHtml = '<div style="display:flex;flex-direction:column;gap:6px;">';
      leaderboard.forEach(function (lb, idx) {
        var isMe = lb.id_murid === window.HQ.getCurrentUser().id_user;
        listOthersHtml += `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:var(--r-sm);background:${isMe ? 'var(--blue-l)' : 'var(--bg-2)'};font-size:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-weight:800;color:var(--text-3);width:20px;">#${idx + 1}</span>
              <span style="font-weight:700;color:${isMe ? 'var(--blue-d)' : 'var(--text)'};">${escapeHtml(lb.nama_lengkap)} ${isMe ? '(Kamu)' : ''}</span>
            </div>
            <strong style="color:var(--text);font-weight:900;">${lb.skor_total} Poin</strong>
          </div>
        `;
      });
      listOthersHtml += '</div>';

      // ─── Build answer review section based on tampilkan_jawaban_setting ───
      var reviewHtml = '';
      if (reviewSetting === 'setelah_submit' && jawaban.length > 0) {
        reviewHtml = `
          <div style="background:var(--card-solid);border-radius:var(--r-xl);padding:22px;border:1px solid var(--border);box-shadow:var(--shadow);margin-bottom:20px;">
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:16px;">📋 Review Jawaban Kamu</h3>
            <div style="display:flex;flex-direction:column;gap:12px;">
        `;

        jawaban.forEach(function(j, idx) {
          var soal = j.soal || {};
          var isBenar = j.is_benar === true;
          var isNull = j.is_benar === null || j.is_benar === undefined;
          var pilihan = soal.soal_pilihan || [];

          var statusBadge = isNull
            ? '<span style="font-size:10px;font-weight:800;background:rgba(245,158,11,0.15);color:#d97706;padding:2px 8px;border-radius:100px;">⏳ Menunggu Review</span>'
            : isBenar
              ? '<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.15);color:#059669;padding:2px 8px;border-radius:100px;">✅ Benar</span>'
              : '<span style="font-size:10px;font-weight:800;background:rgba(239,68,68,0.15);color:#dc2626;padding:2px 8px;border-radius:100px;">❌ Salah</span>';

          var borderColor = isNull ? 'rgba(245,158,11,0.35)' : isBenar ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)';
          var bgColor = isNull ? 'rgba(245,158,11,0.04)' : isBenar ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)';

          // Build answer detail block
          var answerDetailHtml = '';

          if (soal.tipe_soal === 'isian_singkat') {
            answerDetailHtml = `
              <div style="font-size:12px;color:var(--text-2);margin-top:8px;background:var(--bg-2);padding:8px 10px;border-radius:var(--r-sm);">
                <div><strong>Jawaban kamu:</strong> ${escapeHtml(j.teks_isian || '(tidak dijawab)')}</div>
                ${isBenar === false ? '<div style="color:#059669;margin-top:4px;"><strong>Catatan:</strong> Akan ditinjau oleh ustadz/ustadzah.</div>' : ''}
              </div>
            `;
          } else if (soal.tipe_soal === 'matching') {
            var matchingPairs = [];
            try { matchingPairs = j.matching_json ? JSON.parse(j.matching_json) : []; } catch(e) {}
            answerDetailHtml = '<div style="font-size:12px;color:var(--text-2);margin-top:8px;display:flex;flex-direction:column;gap:4px;">';
            matchingPairs.forEach(function(m) {
              var correctPair = (soal.soal_pasangan || []).find(function(p){ return p.teks_kiri === m.kiri; });
              var correctKanan = correctPair ? correctPair.teks_kanan : '?';
              var isPairRight = m.kanan_dipilih === correctKanan;
              answerDetailHtml += `
                <div style="background:${isPairRight ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};color:var(--text);padding:6px 10px;border-radius:6px;border-left:3px solid ${isPairRight ? '#10b981' : '#ef4444'};">
                  <span style="font-weight:700;">${escapeHtml(m.kiri)}</span>
                  <span style="color:var(--text-3);margin:0 6px;">→</span>
                  <span>${escapeHtml(m.kanan_dipilih || '(tidak dipilih)')}</span>
                  ${!isPairRight ? '<span style="color:#059669;font-size:11px;margin-left:8px;">✓ ' + escapeHtml(correctKanan) + '</span>' : ''}
                </div>
              `;
            });
            answerDetailHtml += '</div>';
          } else {
            // Pilihan ganda, benar_salah, audio, teks_arab
            var pilihanHtml = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">';
            pilihan.forEach(function(p) {
              var isMyAnswer = j.id_pilihan === p.id_pilihan;
              var isCorrectAnswer = p.is_benar;
              var rowBg = 'var(--bg-2)';
              var rowBorder = '1px solid var(--border)';
              var prefix = '';
              if (isMyAnswer && isCorrectAnswer) { rowBg = 'rgba(16,185,129,0.12)'; rowBorder = '1.5px solid #10b981'; prefix = '✅ '; }
              else if (isMyAnswer && !isCorrectAnswer) { rowBg = 'rgba(239,68,68,0.10)'; rowBorder = '1.5px solid #ef4444'; prefix = '❌ '; }
              else if (isCorrectAnswer) { rowBg = 'rgba(16,185,129,0.06)'; rowBorder = '1.5px dashed #10b981'; prefix = '✓ '; }
              pilihanHtml += `
                <div style="padding:8px 12px;background:${rowBg};border:${rowBorder};border-radius:8px;font-size:12.5px;font-weight:${isMyAnswer ? '700' : '500'};color:var(--text);">
                  ${prefix}${escapeHtml(p.teks_pilihan)}
                </div>
              `;
            });
            pilihanHtml += '</div>';
            answerDetailHtml = pilihanHtml;
          }

          reviewHtml += `
            <div style="border:1.5px solid ${borderColor};background:${bgColor};border-radius:var(--r-md);padding:14px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4;flex:1;">
                  <span style="font-size:11px;font-weight:800;color:var(--text-3);margin-right:6px;">${idx + 1}.</span>
                  ${escapeHtml(soal.teks_soal || '')}
                </div>
                <div style="flex-shrink:0;">${statusBadge}</div>
              </div>
              ${soal.teks_arab ? `<div style="font-family:'Amiri',serif;font-size:18px;direction:rtl;text-align:right;background:var(--bg-2);padding:8px 10px;border-radius:var(--r-sm);margin-bottom:8px;color:var(--text);">${renderArabicHighlight(soal.teks_arab, soal.highlight_markup)}</div>` : ''}
              ${answerDetailHtml}
              ${j.skor_diperoleh !== null && j.skor_diperoleh !== undefined ? `<div style="font-size:11px;color:var(--text-3);font-weight:700;margin-top:6px;text-align:right;">+${j.skor_diperoleh} Poin</div>` : ''}
            </div>
          `;
        });

        reviewHtml += '</div></div>';
      } else if (reviewSetting === 'hanya_skor') {
        reviewHtml = `
          <div style="background:rgba(14,165,233,0.06);border:1.5px solid rgba(14,165,233,0.25);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:20px;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:var(--blue-d);">📊 Ustadz/ustadzah menyembunyikan detail jawaban untuk kuis ini.</div>
          </div>
        `;
      }

      resEl.innerHTML = `
        <div style="max-width:540px;margin:0 auto;">
          <div style="background:var(--card-solid);border-radius:var(--r-xl);padding:28px 22px;border:1px solid var(--border);box-shadow:var(--shadow-lg);text-align:center;margin-bottom:20px;">
            <div style="font-size:52px;margin-bottom:6px;">${isPerfect ? '🎉' : '👏'}</div>
            <h2 style="font-size:20px;font-weight:900;color:var(--text);">Kuis Selesai!</h2>
            
            ${reviewSetting !== 'sembunyikan' ? `
            <div style="margin:20px 0;background:var(--bg-2);padding:18px;border-radius:var(--r-lg);">
              <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Skor Kamu</div>
              <div style="font-size:38px;font-weight:900;color:var(--blue-d);line-height:1.2;margin:4px 0;">${hasil.skor_total} <span style="font-size:18px;color:var(--text-3);">/ ${hasil.skor_maksimal}</span></div>
              <div style="font-size:12px;font-weight:700;color:var(--green);">${hasil.jumlah_benar} Jawaban Benar</div>
            </div>
            ` : `
            <div style="margin:20px 0;background:var(--bg-2);padding:18px;border-radius:var(--r-lg);">
              <div style="font-size:36px;margin-bottom:8px;">🔒</div>
              <div style="font-size:13px;color:var(--text-2);font-weight:600;">Hasil kuis disembunyikan oleh ustadz/ustadzah. Jazakallahu khairan atas kesungguhan belajar Anda!</div>
            </div>
            `}

            ${hasil.flag_suspicious ? `
              <div style="background:var(--red-l);border:1px solid rgba(239,68,68,0.2);color:var(--red);padding:10px;border-radius:var(--r-sm);font-size:11px;margin-bottom:14px;">
                ⚠️ Terdeteksi meninggalkan tab kuis ${hasil.jumlah_tab_switch} kali (${hasil.total_durasi_keluar_detik} detik).
              </div>
            ` : ''}

            <button onclick="renderMuridQuizPage()" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:13px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
              Kembali ke Daftar Kuis
            </button>
          </div>

          ${reviewHtml}

          <!-- Leaderboard Section -->
          <div style="background:var(--card-solid);border-radius:var(--r-xl);padding:22px;border:1px solid var(--border);box-shadow:var(--shadow);">
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:12px;">🏆 Leaderboard Halaqah</h3>
            ${top3Html}
            ${listOthersHtml}
          </div>
        </div>
      `;
    } catch (err) {
      hideLoading();
      showQuizAlert({ title: 'Gagal Memuat Hasil', message: err.message, type: 'danger' });
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
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  function renderArabicHighlight(teks, highlightMarkup) {
    if (!teks) return '';
    var escaped = escapeHtml(teks);
    return escaped.replace(/\{\[(.+?)\]\}/g, '<span style="background:rgba(245,158,11,0.25);color:var(--amber-txt);padding:2px 6px;border-radius:6px;border:1px solid rgba(245,158,11,0.4);">$1</span>');
  }



  // ─────────────────────────────────────────────
  // SHARIAH-COMPLIANT WEB AUDIO SYNTH (NO INSTRUMENTS)
  // ─────────────────────────────────────────────
  var _audioCtx = null;
  var _isSoundMuted = false;

  function getAudioContext() {
    if (!_audioCtx) {
      var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) _audioCtx = new AudioCtxClass();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function playWoodClick() {
    if (_isSoundMuted) return;
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var t = ctx.currentTime;

      // Layer 1: Sharp attack snap (square wave — bright, cuts through tiny speakers)
      var osc1 = ctx.createOscillator();
      var g1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(1200, t);
      osc1.frequency.exponentialRampToValueAtTime(300, t + 0.06);
      g1.gain.setValueAtTime(0.9, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.start(t); osc1.stop(t + 0.06);

      // Layer 2: Body resonance (triangle — warmth)
      var osc2 = ctx.createOscillator();
      var g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(800, t);
      osc2.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      g2.gain.setValueAtTime(0.6, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(t); osc2.stop(t + 0.1);
    } catch(e) {}
  }

  function playHeartbeat() {
    if (_isSoundMuted) return;
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var t = ctx.currentTime;

      // Lub — bright attack + body
      var osc1a = ctx.createOscillator();
      var g1a = ctx.createGain();
      osc1a.type = 'square';
      osc1a.frequency.setValueAtTime(400, t);
      osc1a.frequency.exponentialRampToValueAtTime(120, t + 0.15);
      g1a.gain.setValueAtTime(0.95, t);
      g1a.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc1a.connect(g1a); g1a.connect(ctx.destination);
      osc1a.start(t); osc1a.stop(t + 0.15);

      var osc1b = ctx.createOscillator();
      var g1b = ctx.createGain();
      osc1b.type = 'triangle';
      osc1b.frequency.setValueAtTime(250, t);
      osc1b.frequency.exponentialRampToValueAtTime(80, t + 0.18);
      g1b.gain.setValueAtTime(0.7, t);
      g1b.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc1b.connect(g1b); g1b.connect(ctx.destination);
      osc1b.start(t); osc1b.stop(t + 0.18);

      // Dub — slightly softer echo
      setTimeout(function() {
        if (_isSoundMuted) return;
        var t2 = ctx.currentTime;
        var osc2a = ctx.createOscillator();
        var g2a = ctx.createGain();
        osc2a.type = 'square';
        osc2a.frequency.setValueAtTime(350, t2);
        osc2a.frequency.exponentialRampToValueAtTime(100, t2 + 0.12);
        g2a.gain.setValueAtTime(0.8, t2);
        g2a.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
        osc2a.connect(g2a); g2a.connect(ctx.destination);
        osc2a.start(t2); osc2a.stop(t2 + 0.12);

        var osc2b = ctx.createOscillator();
        var g2b = ctx.createGain();
        osc2b.type = 'triangle';
        osc2b.frequency.setValueAtTime(200, t2);
        osc2b.frequency.exponentialRampToValueAtTime(70, t2 + 0.14);
        g2b.gain.setValueAtTime(0.6, t2);
        g2b.gain.exponentialRampToValueAtTime(0.001, t2 + 0.14);
        osc2b.connect(g2b); g2b.connect(ctx.destination);
        osc2b.start(t2); osc2b.stop(t2 + 0.14);
      }, 120);
    } catch(e) {}
  }

  window.toggleQuizSound = function () {
    _isSoundMuted = !_isSoundMuted;
    var btn = document.getElementById('btnToggleQuizSound');
    if (btn) {
      btn.textContent = _isSoundMuted ? '🔇 Bisu' : '🔊 Suara';
      btn.style.background = _isSoundMuted ? 'var(--bg-2)' : 'var(--blue-l)';
      btn.style.color = _isSoundMuted ? 'var(--text-3)' : 'var(--blue-d)';
    }
  };

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
