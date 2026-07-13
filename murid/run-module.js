/*
 *  RATTIL RUN — modul portal (Vanilla Canvas 2D)
 *  Game pelari kuis kanguru. Lapisan gamifikasi; NOL bobot akademik.
 *
 *  API: window.RunGame.open()  -> buka game (overlay fullscreen #rnRoot)
 *       window.RunGame.close() -> tutup & bersihkan
 *  Data: window.HQ.MuridAPI.getRunLevels / getRunSoal / simpanRunProgress
 *  Ritme dua-detak: [LARI: rintangan] -> [SOAL: awan jawaban] -> ulang.
 *  Port dari run-prototype.html. Bila belum login / belum ada level -> mode contoh (skor tak tersimpan).
 */
"use strict";
(function () {
  if (window.RunGame) return;

  // ---------- Soal contoh (fallback bila offline / belum ada soal boleh_run) ----------
  var SAMPLE = [
    { q: "Membaca Al-Qur'an wajib dengan tajwid.", opsi:["Benar","Salah"], benar:0 },
    { q: "Nun mati bertemu Ba (ب), hukumnya?", opsi:["Izhar","Iqlab","Ikhfa"], benar:1 },
    { q: "Panjang bacaan Mad Thabi'i?", opsi:["1 harakat","2 harakat","4 harakat"], benar:1 },
    { q: "Mad Thabi'i termasuk mad far'i.", opsi:["Benar","Salah"], benar:1 },
    { q: "Makhraj huruf Kha (خ) berada di?", opsi:["Tenggorokan","Lidah","Bibir"], benar:0 },
    { q: "Idgham bighunnah dibaca berdengung.", opsi:["Benar","Salah"], benar:0 },
    { q: "Qalqalah punya berapa huruf?", opsi:["3","5","7"], benar:1 }
  ];

  // ---------- State DOM/lifecycle ----------
  var root = null, cv = null, ctx = null, mounted = false, dataReady = false;
  var activeLevel = null;         // level dari getRunLevels (punya id_run_level); null = mode contoh
  var QUESTIONS = SAMPLE.slice();  // diganti soal server saat loadData sukses
  var saved = false;               // cegah simpan ganda per satu sesi main
  var _onKey = null, _onKeyUp = null, _onResize = null;

  // ---------- Kanvas / skala / fisika ----------
  var W, H, DPR, groundY, S;
  var GRAV, JUMP_V, SPEED_MIN, SPEED_MAX;
  var QUIZ_SPEED_FACTOR = 0.78;
  var TARGET_SOAL = 8;
  var READ_DELAY = 5;

  function resize() {
    if (!cv || !ctx) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    groundY = Math.round(H * 0.80);
    S = Math.min(H / 720, W / 900); if (S > 1.4) S = 1.4; if (S < 0.6) S = 0.6;
    GRAV = 2600 * S; JUMP_V = 1120 * S; SPEED_MIN = 230 * S; SPEED_MAX = 390 * S;
    if (roo) roo.x = W * 0.20;
  }

  // ---------- Audio (WebAudio) — HANYA bunyi NON-MELODI (kehati-hatian syar'i) ----------
  //  Berbasis DERAU (noise) tersaring + amplop lembut → terdengar ALAMI (langkah, angin, benturan,
  //  detak). TANPA nada/melodi/alat musik; tak ada oscillator yang BERBUNYI (angin dimodulasi via JS).
  var AC = null, _noiseBuf = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function noiseBuf() {
    if (_noiseBuf) return _noiseBuf;
    var a = ac(); if (!a) return null;
    var n = Math.floor(a.sampleRate * 1.0);
    var b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _noiseBuf = b; return b;
  }
  // Satu ketukan derau tersaring dgn attack lembut (perkusif, non-melodi, tak "klik").
  function noise(dur, vol, type, freq, q, atk) {
    var a = ac(); if (!a) return;
    var b = noiseBuf(); if (!b) return;
    var src = a.createBufferSource(); src.buffer = b;
    var f = a.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1000; if (q) f.Q.value = q;
    var g = a.createGain();
    src.connect(f); f.connect(g); g.connect(a.destination);
    var t = a.currentTime, A = atk || 0.006, D = dur || 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + A);       // attack lembut → tak "klik"
    g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    src.start(t); src.stop(t + D + 0.03);
  }
  function sfxJump()      { noise(0.18, 0.06, 'bandpass', 900, 0.5, 0.010); }                                   // "wus" lompat
  function sfxCoin()      { noise(0.06, 0.08, 'highpass', 3800, 0, 0.004); }                                     // "tik" bonus
  function sfxGood()      { noise(0.06, 0.09, 'highpass', 3200, 0, 0.004); setTimeout(function(){ noise(0.06, 0.09, 'highpass', 3200, 0, 0.004); }, 85); } // ketuk-ketuk benar
  function sfxBad()       { noise(0.24, 0.10, 'lowpass', 260, 0, 0.006); }                                       // "duk" tumpul salah
  function sfxHit()       { noise(0.22, 0.16, 'lowpass', 360, 0, 0.003); }                                       // benturan rintangan
  function sfxHeart()     { noise(0.14, 0.11, 'lowpass', 420, 0, 0.006); setTimeout(function(){ noise(0.16, 0.11, 'lowpass', 420, 0, 0.006); }, 150); } // "dug-dug" tambah nyawa
  function sfxHeartbeat() { noise(0.15, 0.13, 'lowpass', 140, 0, 0.008); setTimeout(function(){ noise(0.17, 0.10, 'lowpass', 120, 0, 0.008); }, 175); } // detak jantung nyawa kritis
  // Angin gurun ambient: derau tersaring loop + embusan halus (gust) dimodulasi lewat JS (bukan oscillator).
  var _wind = null, _windPhase = 0, _windAge = 0;
  function windStart() {
    var a = ac(); if (!a || _wind) return;
    var b = noiseBuf(); if (!b) return;
    var src = a.createBufferSource(); src.buffer = b; src.loop = true;
    var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    var g = a.createGain(); g.gain.value = 0.0001;
    src.connect(f); f.connect(g); g.connect(a.destination);
    try { src.start(); } catch (e) {}
    _wind = { src: src, filter: f, gain: g }; _windPhase = 0; _windAge = 0;
  }
  function windStop() {
    if (!_wind) return;
    var w = _wind; _wind = null;
    try {
      var a = ac(), t = a.currentTime;
      w.gain.gain.cancelScheduledValues(t);
      w.gain.gain.setValueAtTime(Math.max(0.0001, w.gain.gain.value), t);
      w.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      w.src.stop(t + 0.45);
    } catch (e) { try { w.src.stop(); } catch (e2) {} }
  }
  function windTick(dt) {
    if (!_wind) return;
    _windPhase += dt; _windAge += dt;
    var fade = Math.min(1, _windAge / 1.5);
    try {
      _wind.gain.gain.value = fade * (0.010 + 0.008 * (0.5 + 0.5 * Math.sin(_windPhase * 0.5)));
      _wind.filter.frequency.value = 340 + 200 * (0.5 + 0.5 * Math.sin(_windPhase * 0.33));
    } catch (e) {}
  }

  // ---------- State game ----------
  var roo, world, speed, mode, quiz, obstacles, coins, clouds;
  var lives, score, dist, tState, tScheduled, invuln, running, shake;
  var missedQueue, pendingQuestion, toast, correctCount, streak, deck;
  var spawnGap = 0, coinGap = 0;
  var _heartAcc = 0;   // kadens detak jantung (audio non-melodi)

  function kangarooBox() {
    var kw = 54 * S;
    var kh = (roo.duck && roo.grounded ? 32 : 66) * S;
    return { x: roo.x - kw / 2, y: roo.y - kh, w: kw, h: kh };
  }

  function reset() {
    roo = { x: W * 0.20, y: groundY, vy: 0, grounded: true, duck: false, run: 0 };
    speed = SPEED_MIN;
    mode = 'run';
    quiz = null;
    obstacles = []; coins = []; clouds = [];
    lives = 3; score = 0; dist = 0;
    tState = 0;
    tScheduled = rand(4.5, 6.5);
    invuln = 0; shake = 0;
    missedQueue = []; pendingQuestion = null; toast = null;
    correctCount = 0; streak = 0;
    saved = false;
    deck = shuffle(QUESTIONS.slice());
    world = 0;
    running = true;
  }

  // ---------- Util ----------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function drawCard() { if (!deck.length) deck = shuffle(QUESTIONS.slice()); return deck.pop(); }
  function intersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // ---------- Data (server) ----------
  function normalizeSoal(rows) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i];
      var pil = (s.pilihan || []).slice().sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });
      if (pil.length < 2 || pil.length > 4) continue;                 // 2–4 lajur
      var tooLong = pil.some(function (p) { return (p.teks_pilihan || '').length > 14; });
      if (tooLong) continue;                                           // opsi kepanjangan → tak muat di awan
      var benar = 0;
      for (var k = 0; k < pil.length; k++) if (pil[k].is_benar) { benar = k; break; }
      out.push({ q: s.teks_soal, opsi: pil.map(function (p) { return p.teks_pilihan; }), benar: benar, id_soal: s.id_soal });
    }
    return out;
  }

  async function loadData() {
    activeLevel = null;
    var questions = null;
    try {
      var M = window.HQ && window.HQ.MuridAPI;
      if (M && M.getRunLevels && M.getRunSoal) {
        var lv = await M.getRunLevels();
        var levels = (lv && lv.data) || [];
        if (levels.length) {
          activeLevel = levels[0];
          var sq = await M.getRunSoal(activeLevel.id_run_level);
          questions = normalizeSoal((sq && sq.data) || []);
        }
      }
    } catch (e) { console.warn('RunGame loadData:', e && (e.message || e)); }
    // Fallback: tanpa level nyata ATAU 0 soal eligible → mode contoh (activeLevel=null → skor tak disimpan).
    if (!questions || !questions.length) { activeLevel = null; QUESTIONS = SAMPLE.slice(); }
    else QUESTIONS = questions;
    dataReady = true;
  }

  async function saveProgress(completed) {
    if (saved) return;
    saved = true;
    var M = window.HQ && window.HQ.MuridAPI;
    if (!activeLevel || !M || !M.simpanRunProgress) return; // mode contoh → tak simpan
    try {
      var snapshot = QUESTIONS.map(function (q) { return { q: q.q, opsi: q.opsi, benar: q.benar, id_soal: q.id_soal || null }; });
      await M.simpanRunProgress({
        id_run_level:  activeLevel.id_run_level,
        score:         score + Math.floor(dist),
        best_distance: Math.floor(dist),
        jml_benar:     correctCount,
        nyawa_sisa:    lives,
        completed:     !!completed,
        badges:        completed ? ['pelari-quran'] : [],
        soal_snapshot: snapshot
      });
    } catch (e) { console.warn('RunGame simpanRunProgress:', e && (e.message || e)); }
  }

  // ---------- Spawner ----------
  function spawnObstacle() {
    var r = Math.random();
    if (r < 0.45) obstacles.push({ type: 'cactus', x: W + 40 });
    else if (r < 0.72) obstacles.push({ type: 'egg', x: W + 40 });
    else obstacles.push({ type: 'bird', x: W + 40, flap: 0 });
  }
  function spawnCoin() {
    var heart = (lives < 5 && Math.random() < 0.22);  // sesekali hati (nambah nyawa), lebih jarang dari koin
    coins.push({ x: W + 40, y: groundY - rand(120, 200) * S, got: false, kind: heart ? 'heart' : 'coin' });
  }

  // ---------- Segmen SOAL ----------
  function startQuiz() {
    mode = 'quiz'; tState = 0;
    var Q = pendingQuestion || drawCard();
    pendingQuestion = null;
    var opts = Q.opsi.map(function (t, i) { return { t: t, correct: i === Q.benar }; });
    shuffle(opts);
    clouds = [];
    quiz = { q: Q.q, Q: Q, opts: opts, total: opts.length, resolved: false, result: null, readTimer: READ_DELAY, spawned: false };
  }
  function spawnClouds() {
    var gap = 330 * S, startX = W + 200 * S, cy = groundY - 185 * S;
    clouds = quiz.opts.map(function (o, i) { return { t: o.t, correct: o.correct, x: startX + i * gap, y: cy, state: 'idle' }; });
    quiz.spawned = true;
  }
  function cloudBox(c) {
    var w = Math.max(150 * S, (c.t.length * 12 + 44) * S);
    var h = 78 * S;
    return { x: c.x - w / 2, y: c.y - h / 2, w: w, h: h };
  }

  // ---------- Input ----------
  function doJump() {
    if (!running) return;
    if (roo.grounded) { roo.vy = -JUMP_V; roo.grounded = false; sfxJump(); }
  }
  function setDuck(v) { if (roo) roo.duck = v; }

  // ---------- Update ----------
  function update(dt) {
    if (!running) return;
    tState += dt;
    dist += speed * dt * 0.05;
    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake -= dt;
    if (toast && toast.t > 0) toast.t -= dt;
    roo.run += dt * 12;

    speed = Math.min(SPEED_MAX, speed + dt * 5 * S);
    var v = speed * (mode === 'quiz' ? QUIZ_SPEED_FACTOR : 1);
    world += v * dt;

    roo.vy += GRAV * dt;
    roo.y += roo.vy * dt;
    if (roo.y >= groundY) { roo.y = groundY; roo.vy = 0; roo.grounded = true; }

    // Audio non-melodi: detak jantung saat nyawa kritis (≤1) + angin ambient
    if (lives <= 1) { _heartAcc += dt; if (_heartAcc >= 0.85) { _heartAcc = 0; sfxHeartbeat(); } }
    else _heartAcc = 0;
    windTick(dt);

    if (mode === 'run') updateRun(dt, v);
    else updateQuiz(dt, v);
  }

  function updateRun(dt, v) {
    spawnGap -= dt;
    if (spawnGap <= 0) { spawnObstacle(); spawnGap = rand(1.0, 1.7) - Math.min(0.5, dist / 4000); }
    coinGap -= dt;
    if (coinGap <= 0) { if (Math.random() < 0.6) spawnCoin(); coinGap = rand(1.8, 3.2); }

    var kb = kangarooBox();
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= v * dt;
      if (o.type === 'bird') o.flap += dt * 10;
      var ob = obstacleBox(o);
      if (invuln <= 0 && intersect(kb, ob)) {
        lives--; invuln = 1.1; shake = 0.3; sfxHit();
        obstacles.splice(i, 1);
        if (lives <= 0) return gameOver();
        continue;
      }
      if (o.x < -60) obstacles.splice(i, 1);
    }
    for (var j = coins.length - 1; j >= 0; j--) {
      var c = coins[j]; c.x -= v * dt;
      var cbx = { x: c.x - 16 * S, y: c.y - 16 * S, w: 32 * S, h: 32 * S };
      if (!c.got && intersect(kb, cbx)) {
        c.got = true; coins.splice(j, 1);
        if (c.kind === 'heart') {
          lives = Math.min(5, lives + 1); sfxHeart();
          toast = { text: '❤️ +1 Nyawa!', t: 1.8 };
        } else {
          score += 25; sfxCoin();
          if (missedQueue.length && !pendingQuestion) {
            pendingQuestion = missedQueue.shift();
            tScheduled = Math.min(tScheduled, tState + 1.6);
            toast = { text: '🪙 Soal terlewat kembali!', t: 1.8 };
          }
        }
        continue;
      }
      if (c.x < -40) coins.splice(j, 1);
    }
    if (tState >= tScheduled && obstacles.length === 0) startQuiz();
    else if (tState >= tScheduled) { spawnGap = 99; coinGap = 99; }
  }

  function obstacleBox(o) {
    if (o.type === 'cactus') return { x: o.x - 17 * S, y: groundY - 56 * S, w: 34 * S, h: 56 * S };
    if (o.type === 'egg') return { x: o.x - 15 * S, y: groundY - 34 * S, w: 30 * S, h: 34 * S };
    return { x: o.x - 20 * S, y: groundY - 66 * S, w: 40 * S, h: 26 * S };
  }

  function updateQuiz(dt, v) {
    if (quiz.readTimer > 0) {
      quiz.readTimer -= dt;
      if (quiz.readTimer <= 0 && !quiz.spawned) spawnClouds();
      return;
    }
    var kb = kangarooBox();
    var maxX = -Infinity;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; c.x -= v * dt;
      if (c.x > maxX) maxX = c.x;
      if (!quiz.resolved && roo.y < groundY - 6 && c.state === 'idle') {
        if (intersect(kb, cloudBox(c))) {
          if (c.correct) {
            c.state = 'right'; quiz.result = 'right'; sfxGood();
            streak++;
            var bonus = 100 + (streak - 1) * 50;
            score += bonus;
            correctCount++;
            toast = { text: streak >= 2 ? ('🔥 ' + streak + 'x beruntun  +' + bonus) : ('Benar!  +' + bonus), t: 1.6 };
            if (correctCount >= TARGET_SOAL) { quiz.resolved = true; setTimeout(winGame, 600); return; }
          } else {
            c.state = 'wrong'; quiz.result = 'wrong'; streak = 0; shake = 0.25; sfxBad();
            toast = { text: 'Belum tepat — lihat jawaban benar', t: 1.6 };
          }
          quiz.resolved = true;
          for (var k = 0; k < clouds.length; k++) if (clouds[k].correct && clouds[k].state === 'idle') clouds[k].state = 'reveal';
        }
      }
    }
    if (maxX < -180 * S) {
      if (!quiz.resolved) { quiz.result = 'skip'; missedQueue.push(quiz.Q); }
      endQuiz();
    }
  }

  function endQuiz() {
    mode = 'run'; tState = 0; clouds = [];
    tScheduled = rand(4.5, 6.5);
    spawnGap = rand(0.6, 1.0); coinGap = rand(1.0, 2.0);
    quiz = null;
  }

  // ---------- Render ----------
  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-4, 4) * S, rand(-3, 3) * S);
    drawSky();
    drawGround();
    drawClouds();
    for (var i = 0; i < coins.length; i++) drawCoin(coins[i]);
    for (var j = 0; j < obstacles.length; j++) drawObstacle(obstacles[j]);
    drawKangaroo();
    ctx.restore();
    drawHUD();
    if (mode === 'quiz' && quiz) drawQuestionBanner();
    if (toast && toast.t > 0) drawToast();
  }

  function drawToast() {
    ctx.save();
    ctx.globalAlpha = Math.min(1, toast.t / 0.4);
    ctx.fillStyle = '#b9711a';
    ctx.font = '800 ' + (16 * S) + 'px -apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(toast.text, W / 2, 46 * S);
    ctx.restore();
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, '#eaf4ff'); g.addColorStop(1, '#bfe3ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    var off = (world * 0.15) % (260 * S);
    for (var i = -1; i < W / (260 * S) + 1; i++) {
      var x = i * 260 * S - off;
      ctx.beginPath(); ctx.arc(x + 130 * S, groundY, 130 * S, Math.PI, 0); ctx.fill();
    }
  }
  function drawGround() {
    ctx.fillStyle = '#e6c98f'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,120,50,0.35)'; ctx.lineWidth = 2 * S;
    var off = (world) % (70 * S);
    for (var i = -1; i < W / (70 * S) + 1; i++) {
      var x = i * 70 * S - off;
      ctx.beginPath(); ctx.moveTo(x, groundY + 22 * S); ctx.lineTo(x + 16 * S, groundY + 22 * S); ctx.stroke();
    }
  }

  function emoji(ch, x, y, size, baseline) {
    ctx.font = size + 'px -apple-system,"Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(ch, x, y);
  }

  function drawKangaroo() {
    var blink = (invuln > 0 && (Math.floor(invuln * 9) % 2 === 0));
    var y = roo.y;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath(); ctx.ellipse(roo.x, groundY + 4 * S, 30 * S, 6.5 * S, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = blink ? 0.55 : 1;
    ctx.fillStyle = '#5a3a1a';
    var size = (roo.duck && roo.grounded ? 54 : 76) * S;
    var ey = y + (roo.duck && roo.grounded ? 6 * S : 0);
    ctx.translate(roo.x, ey); ctx.scale(-1, 1);
    ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('🦘', 0, 0);
    ctx.restore();
  }

  function drawObstacle(o) {
    if (o.type === 'cactus') emoji('🌵', o.x, groundY + 4 * S, 58 * S, 'alphabetic');
    else if (o.type === 'egg') emoji('🥚', o.x, groundY + 2 * S, 40 * S, 'alphabetic');
    else { var fy = groundY - 52 * S + Math.sin(o.flap) * 5 * S; emoji('🐦', o.x, fy, 42 * S, 'middle'); }
  }
  function drawCoin(c) { emoji(c.kind === 'heart' ? '❤️' : '🪙', c.x, c.y, 34 * S, 'middle'); }

  function drawClouds() {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; var b = cloudBox(c);
      var fill = '#ffffff', stroke = '#9ec7e8', txt = '#123';
      if (c.state === 'right') { fill = '#c9f5d0'; stroke = '#3bbf5b'; }
      else if (c.state === 'wrong') { fill = '#ffd2d2'; stroke = '#e05555'; }
      else if (c.state === 'reveal') { fill = '#dff3ff'; stroke = '#3bbf5b'; }
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 3 * S;
      roundRect(b.x, b.y, b.w, b.h, 26 * S); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.30, b.y + 6 * S, 20 * S, 0, 7);
      ctx.arc(b.x + b.w * 0.62, b.y + 2 * S, 26 * S, 0, 7);
      ctx.fill();
      ctx.fillStyle = txt; ctx.font = '800 ' + (20 * S) + 'px -apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.t, c.x, c.y + 4 * S);
      if (c.state === 'right') emoji('✅', c.x + b.w / 2 - 4 * S, b.y - 2 * S, 26 * S, 'middle');
      if (c.state === 'wrong') emoji('❌', c.x + b.w / 2 - 4 * S, b.y - 2 * S, 26 * S, 'middle');
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawHUD() {
    ctx.fillStyle = '#123'; ctx.font = '800 ' + (20 * S) + 'px -apple-system,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Skor ' + (score + Math.floor(dist)), 16 * S, 16 * S);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b9711a'; ctx.font = '800 ' + (17 * S) + 'px -apple-system,sans-serif';
    ctx.fillText('⭐ ' + correctCount + '/' + TARGET_SOAL, W / 2, 18 * S);
    ctx.textAlign = 'right';
    var hearts = ''; for (var i = 0; i < lives; i++) hearts += '❤️';
    ctx.font = (22 * S) + 'px -apple-system,"Segoe UI Emoji",sans-serif';
    ctx.fillStyle = '#123';
    ctx.fillText(hearts || '—', W - 14 * S, 14 * S);
  }

  function drawQuestionBanner() {
    var pad = 14 * S, y = Math.min(H * 0.30, groundY - 240 * S);
    if (y < 70 * S) y = 70 * S;
    var maxW = Math.min(W - 32 * S, 560 * S);
    ctx.font = '800 ' + (18 * S) + 'px -apple-system,sans-serif';
    var lines = wrap(quiz.q, maxW - pad * 2);
    var bh = lines.length * 24 * S + pad * 2;
    ctx.fillStyle = 'rgba(18,30,40,0.88)';
    roundRect((W - maxW) / 2, y, maxW, bh, 16 * S); ctx.fill();
    ctx.fillStyle = '#ffd25b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '700 ' + (11 * S) + 'px -apple-system,sans-serif';
    var sub = (quiz.readTimer > 0)
      ? ('BACA DULU — jawaban muncul dalam ' + Math.ceil(quiz.readTimer) + '…')
      : 'SOAL — lompat ke awan yang benar';
    ctx.fillText(sub, W / 2, y + 8 * S);
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + (18 * S) + 'px -apple-system,sans-serif';
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, y + pad + 16 * S + i * 24 * S);
  }
  function wrap(text, maxW) {
    ctx.font = '800 ' + (18 * S) + 'px -apple-system,sans-serif';
    var words = (text || '').split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- Loop ----------
  var last = 0;
  function frame(ts) {
    if (!mounted) return;               // berhenti saat modul ditutup
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    try { if (running) update(dt); draw(); }
    catch (err) { console.error('Rattil Run frame error:', err); }
    requestAnimationFrame(frame);
  }

  // ---------- Layar (DOM helper) ----------
  function $(sel) { return root ? root.querySelector(sel) : null; }
  function show(el) { if (el) el.classList.remove('rn-hidden'); }
  function hide(el) { if (el) el.classList.add('rn-hidden'); }

  function startGame() {
    if (!dataReady) return;
    ac(); reset();
    hide($('#rnStart')); hide($('#rnOver')); hide($('#rnWin')); show($('#rnPad'));
    windStart();
    last = 0;
  }
  function gameOver() {
    running = false; hide($('#rnPad')); windStop();
    var st = $('#rnOverStat'); if (st) st.textContent = 'Skor: ' + (score + Math.floor(dist)) + ' · Soal benar: ' + correctCount + '/' + TARGET_SOAL;
    show($('#rnOver'));
    saveProgress(false);
  }
  function winGame() {
    running = false; hide($('#rnPad')); windStop();
    var st = $('#rnWinStat'); if (st) st.textContent = 'Skor: ' + (score + Math.floor(dist)) + ' · Nyawa tersisa: ' + lives;
    show($('#rnWin'));
    saveProgress(true);
  }

  function bindPad(el, onDown, onUp) {
    if (!el) return;
    el.addEventListener('touchstart', function (e) { e.preventDefault(); ac(); onDown(); }, { passive: false });
    el.addEventListener('touchend', function (e) { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
    el.addEventListener('mousedown', function (e) { e.preventDefault(); ac(); onDown(); });
    el.addEventListener('mouseup', function (e) { e.preventDefault(); if (onUp) onUp(); });
    el.addEventListener('mouseleave', function () { if (onUp) onUp(); });
  }

  // ---------- CSS (ter-scope #rnRoot) ----------
  function injectCSS() {
    if (document.getElementById('rnStyle')) return;
    var css =
      "#rnRoot{position:fixed;inset:0;z-index:99999;background:#bfe3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#173a2f;overflow:hidden;-webkit-tap-highlight-color:transparent;touch-action:none;}" +
      "#rnRoot canvas{display:block;position:absolute;inset:0;touch-action:none;}" +
      "#rnRoot .rn-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:14px;z-index:12;width:40px;height:40px;border-radius:12px;border:1.5px solid rgba(0,0,0,.12);background:rgba(255,255,255,.7);color:#3a5a66;font-size:20px;font-weight:800;cursor:pointer;}" +
      "#rnRoot .rn-screen{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;gap:14px;background:radial-gradient(ellipse at 50% 30%,#eaf4ff 0%,#bfe3ff 60%,#a7d3f2 100%);}" +
      "#rnRoot .rn-hidden{display:none;}" +
      "#rnRoot .rn-brand{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#c08a1e;font-weight:800;}" +
      "#rnRoot .rn-title{font-size:32px;font-weight:900;line-height:1.12;color:#123;text-shadow:0 2px 14px rgba(255,255,255,.6);}" +
      "#rnRoot .rn-sub{font-size:14px;color:#3a5a66;max-width:340px;line-height:1.6;}" +
      "#rnRoot .rn-btn{margin-top:8px;padding:15px 34px;border:none;border-radius:16px;cursor:pointer;font-size:16px;font-weight:800;font-family:inherit;color:#3a2600;background:linear-gradient(135deg,#ffd25b,#e8a72f);box-shadow:0 8px 22px rgba(200,140,30,.4);}" +
      "#rnRoot .rn-btn:disabled{opacity:.5;}" +
      "#rnRoot .rn-btn:active{transform:scale(.95);}" +
      "#rnRoot .rn-emoji{font-size:60px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.25));}" +
      "#rnRoot .rn-stat{font-size:16px;color:#123;font-weight:700;}" +
      "#rnRoot .rn-hint{font-size:12px;color:#5b7480;margin-top:4px;line-height:1.7;}" +
      "#rnRoot .rn-legend{font-size:12.5px;color:#3a5a66;line-height:1.9;background:rgba(255,255,255,.55);border-radius:14px;padding:12px 18px;max-width:340px;}" +
      "#rnRoot .rn-legend b{color:#123;}" +
      "#rnRoot .rn-pad{position:absolute;inset:auto 0 0 0;z-index:8;display:flex;justify-content:space-between;padding:0 20px calc(env(safe-area-inset-bottom,0px) + 22px);pointer-events:none;}" +
      "#rnRoot .rn-padbtn{pointer-events:auto;width:88px;height:88px;border-radius:50%;border:none;font-size:34px;font-weight:900;color:#123;cursor:pointer;user-select:none;background:rgba(255,255,255,.62);box-shadow:0 6px 18px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;touch-action:none;}" +
      "#rnRoot .rn-padbtn:active{transform:scale(.92);background:rgba(255,255,255,.85);}" +
      "@media (min-width:900px){#rnRoot .rn-pad{opacity:.55;}}";
    var st = document.createElement('style'); st.id = 'rnStyle'; st.textContent = css;
    document.head.appendChild(st);
  }

  function mount() {
    if (mounted) return;
    injectCSS();
    root = document.createElement('div'); root.id = 'rnRoot';
    root.innerHTML =
      '<canvas id="rnCanvas"></canvas>' +
      '<button class="rn-x" id="rnClose" aria-label="Tutup">✕</button>' +
      '<div class="rn-screen" id="rnStart">' +
        '<div class="rn-brand">Rattīlil Qur\'an</div>' +
        '<div class="rn-title">Rattil Run 🦘</div>' +
        '<div class="rn-sub">Lari, lompat, dan taklukkan soal! Bantu si kanguru melewati rintangan — lalu <b>lompat menyambar awan jawaban yang benar</b>.</div>' +
        '<div class="rn-legend">🌵🥚 <b>rintangan darat</b> — LOMPAT<br>🐦 <b>burung</b> — MERUNDUK (tahan ↓)<br>☁️ <b>awan jawaban</b> — LOMPAT ke yang benar<br>🪙 <b>bonus</b> — lompat untuk ambil<br>❤️ <b>hati</b> — lompat untuk tambah nyawa</div>' +
        '<button class="rn-btn" id="rnStartBtn" disabled>Memuat…</button>' +
        '<div class="rn-hint" id="rnStartHint">Tombol ⬆️ / ⬇️ di layar &nbsp;·&nbsp; Spasi/↑ = lompat, ↓ = merunduk<br>Taklukkan 8 soal untuk menang! Salah jawab tak mengurangi nyawa.</div>' +
      '</div>' +
      '<div class="rn-screen rn-hidden" id="rnOver">' +
        '<div class="rn-emoji">💫</div>' +
        '<div class="rn-title" style="font-size:26px;">Nyawa Habis</div>' +
        '<div class="rn-stat" id="rnOverStat">Skor: 0</div>' +
        '<div class="rn-sub">Nyawa habis karena menabrak rintangan. Terus asah jawaban benarmu sambil lincah menghindari rintangan — ayo coba lagi!</div>' +
        '<button class="rn-btn" id="rnRetryBtn">Coba Lagi</button>' +
      '</div>' +
      '<div class="rn-screen rn-hidden" id="rnWin">' +
        '<div class="rn-emoji">🏆</div>' +
        '<div class="rn-brand">Kamu Mendapat Badge</div>' +
        '<div class="rn-title" style="font-size:24px;">Pelari Al-Qur\'an</div>' +
        '<div class="rn-stat" id="rnWinStat">Skor: 0</div>' +
        '<div class="rn-sub">8 soal ditaklukkan sambil berlari. Barakallahu fiik!</div>' +
        '<button class="rn-btn" id="rnAgainBtn">Main Lagi</button>' +
      '</div>' +
      '<div class="rn-pad rn-hidden" id="rnPad">' +
        '<button class="rn-padbtn" id="rnDuck">⬇️</button>' +
        '<button class="rn-padbtn" id="rnJump">⬆️</button>' +
      '</div>';
    document.body.appendChild(root);

    cv = root.querySelector('#rnCanvas'); ctx = cv.getContext('2d');
    resize();
    reset(); running = false;  // dunia diam di balik layar start

    // tombol layar
    $('#rnStartBtn').onclick = startGame;
    $('#rnRetryBtn').onclick = startGame;
    $('#rnAgainBtn').onclick = startGame;
    $('#rnClose').onclick = close;
    bindPad($('#rnJump'), doJump);
    bindPad($('#rnDuck'), function () { setDuck(true); }, function () { setDuck(false); });

    // input global
    _onKey = function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); doJump(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setDuck(true); }
      else if (e.code === 'Escape') { close(); }
    };
    _onKeyUp = function (e) { if (e.code === 'ArrowDown' || e.code === 'KeyS') setDuck(false); };
    _onResize = resize;
    window.addEventListener('keydown', _onKey);
    window.addEventListener('keyup', _onKeyUp);
    window.addEventListener('resize', _onResize);

    // input kanvas
    cv.addEventListener('touchstart', function (e) {
      e.preventDefault(); ac();
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].clientY > H * 0.62) setDuck(true); else doJump();
      }
    }, { passive: false });
    cv.addEventListener('touchend', function (e) { e.preventDefault(); setDuck(false); }, { passive: false });
    cv.addEventListener('mousedown', function (e) { ac(); if (e.clientY > H * 0.62) setDuck(true); else doJump(); });
    cv.addEventListener('mouseup', function () { setDuck(false); });

    mounted = true;
    requestAnimationFrame(frame);
  }

  // ---------- API publik ----------
  function open() {
    mount();
    dataReady = false;
    var btn = $('#rnStartBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Memuat…'; }
    loadData().then(function () {
      if (!mounted) return;
      var b = $('#rnStartBtn'); if (b) { b.disabled = false; b.textContent = 'Mulai Berlari'; }
      if (!activeLevel) {
        var h = $('#rnStartHint');
        if (h) h.innerHTML = 'Mode contoh (belum ada level Run / belum login) — skor tak tersimpan.<br>Tombol ⬆️/⬇️ atau Spasi/↑ = lompat, ↓ = merunduk.';
      }
    });
  }

  function close() {
    mounted = false; running = false;
    windStop();
    if (_onKey) window.removeEventListener('keydown', _onKey);
    if (_onKeyUp) window.removeEventListener('keyup', _onKeyUp);
    if (_onResize) window.removeEventListener('resize', _onResize);
    _onKey = _onKeyUp = _onResize = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = cv = ctx = null;
  }

  window.RunGame = { open: open, close: close };
})();
