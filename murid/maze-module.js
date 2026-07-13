/* ============================================================
 *  maze-module.js — Rattil Maze Adventure (Fase 1, integrasi portal)
 *  Vanilla Canvas 2D, nol dependensi. Mount sendiri sebagai overlay.
 *
 *  API: window.MazeGame.open()  -> buka game (overlay fullscreen)
 *       window.MazeGame.close() -> tutup & bersihkan
 *
 *  Data: window.HQ.MuridAPI.getMazeLevels/getMazeSoal/simpanMazeProgress
 *        (patch_069). Bila DB belum siap -> fallback contoh bawaan (tetap main,
 *        skor tidak disimpan). NOL koneksi ke nilai akademik/raport.
 * ============================================================ */
(function () {
  "use strict";
  if (window.MazeGame) return;

  // ---------- Contoh bawaan (fallback bila DB kosong) ----------
  var FALLBACK_QUESTIONS = [
    { q: "Hukum mempelajari ilmu tajwid secara teori?", opsi: ["Fardhu 'ain", "Fardhu kifayah", "Sunnah", "Mubah"], benar: 1 },
    { q: "Hukum membaca Al-Qur'an dengan tajwid?", opsi: ["Fardhu 'ain", "Sunnah", "Mubah", "Makruh"], benar: 0 },
    { q: "Nun mati bertemu huruf Ba (ب), hukumnya?", opsi: ["Izhar", "Iqlab", "Idgham", "Ikhfa"], benar: 1 },
    { q: "Panjang bacaan Mad Thabi'i?", opsi: ["1 harakat", "2 harakat", "4 harakat", "6 harakat"], benar: 1 },
    { q: "Makhraj huruf Kha (خ) berada di?", opsi: ["Tenggorokan", "Lidah", "Dua bibir", "Rongga"], benar: 0 }
  ];

  // 6 peta terverifikasi (nol jalan buntu, tersambung penuh) — generator seed 40,57,82,110,112,7
  var FALLBACK_MAZES = [
    ["#############","#.....1.....#","#.#.##.#.##.#","#.#....#....#","#.#..#.#.##.#","#....#G.....#","#.##...##.#.#","#4....P...#2#","#.#.##.##...#","#.#.##......#","#...##.##.#.#","#.#.......#.#","#.#.##.#....#","#.....3.....#","#############"],
    ["#############","#.....1.....#","#..#.#......#","#......##.#.#","#.##.#.##.#.#","#.##..G.....#","#.##..P.###.#","#4...##....2#","#.#..##.##..#","#.#..##.....#","#.#.....##..#","#....#..##..#","#....#..##..#","#.....3.....#","#############"],
    ["#############","#.....1.....#","#.#..###.##.#","#.#.........#","#....##.###.#","#....##G###.#","#.#..##.....#","#4#...P..#.2#","#...##......#","#.......##..#","#...##..##..#","#.#.##......#","#.#.##.##.#.#","#.....3.....#","#############"],
    ["#############","#.....1.....#","#.#...##.##.#","#........##.#","#....#.#.##.#","#..#.#G.....#","#......##...#","#4.##.P##..2#","#......##...#","#.........#.#","#.##.#.##...#","#.##.#....#.#","#.##.#.##.#.#","#.....3.....#","#############"],
    ["#############","#.....1.....#","#.....##.##.#","#..##.##.##.#","#..##.##....#","#.....G.....#","#......##.#.#","#4.###P##..2#","#......##.#.#","#.###.....#.#","#.......#...#","#.....#.....#","#.###.#..##.#","#.....3.....#","#############"],
    ["#############","#.....1.....#","#..#........#","#.....#.#.#.#","#.#...G...#.#","#....##.#.#.#","#.##.##.#...#","#4...##P...2#","#.......#...#","#.#.#.#.....#","#.......#.#.#","#.........#.#","#..##.##....#","#.....3.....#","#############"]
  ];

  // ---------- State ----------
  var root = null, canvas = null, ctx = null, mounted = false;
  var MAZES = FALLBACK_MAZES, MAZE = MAZES[0], QUESTIONS = FALLBACK_QUESTIONS.slice();
  var COLS = 13, ROWS = 15, activeLevel = null, savedMsg = "";
  var TILE = 32, OX = 0, OY = 0, HUD_H = 0, QBAR_H = 0, BANNER_H = 0, W = 0, H = 0, DPR = 1;
  // Kecepatan (petak/detik) — mudah disetel. Pemain harus > monster agar bisa kabur.
  var PLAYER_SPEED = 3.8;
  var MON_START = 2, MON_MAX = 4, MON_SPEED = 2.3;
  var state = "start"; // start | play | over | win
  var player, monsters = [], PODS = [], PLAYER_SPAWN = { c: 6, r: 7 }, GHOST_SPAWN = [], dots = null;
  var score = 0, lives = 3, qIndex = 0, podMap = [], mapIdx = 0;
  var frightenTimer = 0, invuln = 0, flash = 0, msg = "", msgColor = "#fff", msgTimer = 0;
  var lastT = 0, dotsLeft = 0, startTime = 0;
  var graceTimer = 0, monsterHome = { c: 6, r: 1 };   // jeda "Bersiap" + spawn monster jauh dari pemain
  var _frames = 0, _taps = 0, _inputs = 0, _lastDir = "-", _dbgNS = 0, DEBUG = false; // overlay diagnosa
  var _keyHandler = null, _touchStart = null, _resizeHandler = null;

  // ---------- Util peta ----------
  function isWall(c, r) { if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true; return MAZE[r][c] === "#"; }
  function scanMap() {
    PODS = []; GHOST_SPAWN = []; dots = [];
    for (var r = 0; r < ROWS; r++) {
      dots[r] = [];
      for (var c = 0; c < COLS; c++) {
        var ch = MAZE[r][c];
        dots[r][c] = (ch === ".");
        if (ch >= "1" && ch <= "4") PODS[parseInt(ch, 10) - 1] = { c: c, r: r };
        if (ch === "P") PLAYER_SPAWN = { c: c, r: r };
        if (ch === "G") GHOST_SPAWN.push({ c: c, r: r });
      }
    }
  }

  // Petak jalur TERJAUH dari (c0,r0) via BFS — untuk menempatkan monster di sisi berlawanan.
  function farthestOpenFrom(c0, r0) {
    var dist = [], i;
    for (i = 0; i < ROWS; i++) dist[i] = [];
    var q = [[c0, r0]], head = 0, best = { c: c0, r: r0 }, bestD = -1;
    dist[r0][c0] = 0;
    while (head < q.length) {
      var cur = q[head++], c = cur[0], r = cur[1], d = dist[r][c];
      if (d > bestD) { bestD = d; best = { c: c, r: r }; }
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var nc = c + dirs[i][0], nr = r + dirs[i][1];
        if (!isWall(nc, nr) && dist[nr][nc] === undefined) { dist[nr][nc] = d + 1; q.push([nc, nr]); }
      }
    }
    return best;
  }

  // ---------- Entitas ----------
  function mkEntity(c, r, speed) { return { fx: c, fy: r, dx: 0, dy: 0, ndx: 0, ndy: 0, speed: speed, spawn: { c: c, r: r } }; }
  function makeMonster(idx) {
    var s = monsterHome;                          // spawn jauh dari pemain (sisi berlawanan)
    var m = mkEntity(s.c, s.r, MON_SPEED + (idx % 3) * 0.2);
    m.type = (idx % 2 === 0) ? "chase" : "ambush";
    m.hue = (m.type === "chase") ? 205 : 330;
    return m;
  }
  function resetPositions() {
    player = mkEntity(PLAYER_SPAWN.c, PLAYER_SPAWN.r, PLAYER_SPEED);
    monsterHome = farthestOpenFrom(PLAYER_SPAWN.c, PLAYER_SPAWN.r);
    monsters = [];
    for (var i = 0; i < MON_START; i++) monsters.push(makeMonster(i));
  }
  function addMonster() { if (monsters.length >= MON_MAX) return false; monsters.push(makeMonster(monsters.length)); return true; }

  function switchMaze(idx) {
    mapIdx = idx % MAZES.length; MAZE = MAZES[mapIdx];
    scanMap(); dotsLeft = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (dots[r][c]) dotsLeft++;
    player.fx = PLAYER_SPAWN.c; player.fy = PLAYER_SPAWN.r; player.dx = 0; player.dy = 0; player.ndx = 0; player.ndy = 0;
    monsterHome = farthestOpenFrom(PLAYER_SPAWN.c, PLAYER_SPAWN.r);
    for (var i = 0; i < monsters.length; i++) { monsters[i].fx = monsterHome.c; monsters[i].fy = monsterHome.r; monsters[i].spawn = { c: monsterHome.c, r: monsterHome.r }; monsters[i].dx = 0; monsters[i].dy = 0; }
    graceTimer = 1.5;                              // jeda singkat tiap ganti peta
  }

  function loadQuestion() {
    // Soal bisa 2-4 opsi. Peta punya 4 kotak; hanya aktifkan sebanyak opsi.
    var n = QUESTIONS[qIndex].opsi.length;
    var chosen = (n <= 2) ? [0, 2] : (n === 3) ? [0, 1, 2] : [0, 1, 2, 3]; // pod (0=atas,1=kanan,2=bawah,3=kiri)
    var shift = (qIndex * 3 + 1) % n;
    podMap = [-1, -1, -1, -1];                     // -1 = kotak nonaktif (tak digambar/tak bisa dipilih)
    for (var k = 0; k < n; k++) podMap[chosen[k]] = (k + shift) % n; // pod -> index opsi
  }

  // ---------- Membangun data dari DB (dengan fallback) ----------
  function buildQuestions(soalDB) {
    var out = [];
    (soalDB || []).forEach(function (s) {
      if (s.tipe_soal !== "pilihan_ganda" && s.tipe_soal !== "benar_salah") return;
      var pil = (s.pilihan || []).slice().sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });
      if (pil.length < 2 || pil.length > 4) return;
      var tooLong = pil.some(function (p) { return (p.teks_pilihan || "").length > 14; });
      if (tooLong) return;
      var benar = -1;
      for (var i = 0; i < pil.length; i++) if (pil[i].is_benar) { benar = i; break; }
      if (benar < 0) return;
      out.push({ q: s.teks_soal, opsi: pil.map(function (p) { return p.teks_pilihan; }), benar: benar, id_soal: s.id_soal });
    });
    if (out.length > 8) out = out.slice(0, 8);
    return out.length ? out : FALLBACK_QUESTIONS.slice();
  }
  function buildMazes(levels) {
    var maps = FALLBACK_MAZES.slice();
    if (levels && levels[0] && levels[0].map_data && Array.isArray(levels[0].map_data.grid)
        && levels[0].map_data.grid.length === ROWS) {
      maps[0] = levels[0].map_data.grid;
    }
    return maps;
  }

  async function boot() {
    var levels = [], soalDB = [];
    try {
      if (window.HQ && window.HQ.MuridAPI && window.HQ.MuridAPI.getMazeLevels) {
        var lv = await window.HQ.MuridAPI.getMazeLevels();
        levels = (lv && lv.data) || [];
        if (levels.length) {
          var sq = await window.HQ.MuridAPI.getMazeSoal(levels[0].id_maze_level);
          soalDB = (sq && sq.data) || [];
        }
      }
    } catch (e) { console.warn("[maze] gagal memuat dari server, pakai contoh bawaan:", e); }

    activeLevel = levels[0] || null;
    QUESTIONS = buildQuestions(soalDB);
    MAZES = buildMazes(levels);
    if (activeLevel) {
      MON_START = Math.max(1, Math.min(MON_MAX, activeLevel.jumlah_monster || 2));
      MON_SPEED = 2.3 * (activeLevel.kecepatan_monster || 1.0);
    }
    var sub = root.querySelector("#mzStartSub");
    if (sub) {
      sub.textContent = activeLevel
        ? ("Level: " + activeLevel.nama_level + " · " + QUESTIONS.length + " soal")
        : "Mode contoh (server maze belum diaktifkan) — skor tak disimpan";
    }
  }

  // ---------- Simpan progress ----------
  async function saveProgress(completed) {
    savedMsg = "";
    if (!activeLevel || !window.HQ || !window.HQ.MuridAPI || !window.HQ.MuridAPI.simpanMazeProgress) {
      savedMsg = "Mode contoh — skor tidak disimpan"; return;
    }
    try {
      var snapshot = QUESTIONS.map(function (q) { return { q: q.q, opsi: q.opsi, benar: q.benar, id_soal: q.id_soal || null }; });
      var res = await window.HQ.MuridAPI.simpanMazeProgress({
        id_maze_level: activeLevel.id_maze_level,
        score: score, best_time_ms: completed ? Math.round(performance.now() - startTime) : null,
        nyawa_sisa: lives, completed: completed, badges: currentBadges(), soal_snapshot: snapshot
      });
      savedMsg = (res && res.data) ? ("Skor tersimpan ✓ (terbaik: " + res.data.score + ")") : "Gagal menyimpan";
    } catch (e) {
      console.warn("[maze] simpan gagal:", e);
      savedMsg = "Skor tidak tersimpan (login dulu?)";
    }
  }
  function currentBadges() {
    if (lives >= 3) return ["sahabat"]; if (lives === 2) return ["ahlulquran"];
    if (lives === 1) return ["pecinta"]; return ["pejuang"];
  }

  // ---------- Layout ----------
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var vw = window.innerWidth, vh = window.innerHeight;
    HUD_H = Math.round(Math.min(56, vh * 0.08));
    QBAR_H = Math.round(Math.min(96, vh * 0.14));     // banner soal di ATAS
    BANNER_H = Math.round(Math.min(190, vh * 0.24));  // area tombol navigasi di BAWAH (lebih lega)
    var topH = HUD_H + QBAR_H;
    var availH = vh - topH - BANNER_H;
    TILE = Math.floor(Math.min(vw / COLS, availH / ROWS));
    var mazeW = TILE * COLS, mazeH = TILE * ROWS;
    OX = Math.round((vw - mazeW) / 2); OY = topH + Math.round((availH - mazeH) / 2);
    W = vw; H = vh;
    canvas.style.width = vw + "px"; canvas.style.height = vh + "px";
    canvas.width = Math.round(vw * DPR); canvas.height = Math.round(vh * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ---------- Audio SFX ringan (prosedural, tanpa file) ----------
  var _audio = null, _muted = false, _lastDot = 0;
  function ensureAudio() {
    try { if (!_audio) _audio = new (window.AudioContext || window.webkitAudioContext)(); if (_audio && _audio.state === "suspended") _audio.resume(); } catch (e) { }
  }
  function beep(freq, dur, type, vol, slideTo) {
    if (_muted || !_audio) return;
    try {
      var o = _audio.createOscillator(), g = _audio.createGain(), t0 = _audio.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(_audio.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { }
  }
  function sfx(name) {
    if (_muted || !_audio) return;
    if (name === "correct") { beep(523, 0.12, "sine", 0.2); setTimeout(function () { beep(784, 0.2, "sine", 0.2); }, 110); }
    else if (name === "wrong") { beep(210, 0.28, "sawtooth", 0.16, 90); }
    else if (name === "hit") { beep(150, 0.32, "square", 0.18, 60); }
    else if (name === "scare") { beep(680, 0.1, "triangle", 0.14, 440); }
    else if (name === "start") { beep(440, 0.1, "sine", 0.14); }
    else if (name === "dot") { var n = (performance.now ? performance.now() : 0); if (n - _lastDot > 70) { _lastDot = n; beep(900, 0.03, "square", 0.05); } }
  }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- Popup baca soal ----------
  var _introTimer = null;
  function clearIntroTimer() { if (_introTimer) { clearInterval(_introTimer); _introTimer = null; } }
  function showIntro() {
    state = "intro";
    var qd = QUESTIONS[qIndex];
    root.querySelector("#mzIntroNum").textContent = "Soal " + (qIndex + 1) + " / " + QUESTIONS.length;
    root.querySelector("#mzIntroQ").textContent = qd.q;
    show("mzStart", false); show("mzOver", false); show("mzWin", false); show("mzIntro", true);
    // Mulai otomatis setelah 5 detik (bisa dipercepat dengan mengetuk tombol)
    var btn = root.querySelector("#mzIntroBtn"), left = 5;
    clearIntroTimer();
    btn.textContent = "Mulai! ▶ (" + left + ")";
    _introTimer = setInterval(function () {
      left--;
      if (left <= 0) { beginPlay(); return; }
      btn.textContent = "Mulai! ▶ (" + left + ")";
    }, 1000);
  }
  function beginPlay() {
    clearIntroTimer();
    ensureAudio();
    show("mzIntro", false);
    graceTimer = (qIndex === 0 ? 1.6 : 1.2);
    state = "play"; lastT = 0; requestAnimationFrame(loop); sfx("start");
  }

  // ---------- Input ----------
  function setDir(dx, dy) { _lastDir = dx + "," + dy; if (state !== "play") return; player.ndx = dx; player.ndy = dy; _inputs++; }
  // Berhenti TEPAT di petak (snap ke pusat terdekat) agar bisa mangkal di kotak jawaban.
  function stopPlayer() {
    if (state !== "play" || !player) return;
    player.fx = Math.round(player.fx); player.fy = Math.round(player.fy);
    player.dx = 0; player.dy = 0; player.ndx = 0; player.ndy = 0;
  }
  function dpadRect() { var size = Math.min(BANNER_H * 0.98, W * 0.72, 250); return { cx: W / 2, cy: H - BANNER_H / 2, s: size }; }
  function handleDpadTap(x, y) {
    _taps++;
    var d = dpadRect(), rx = x - d.cx, ry = y - d.cy, half = d.s / 2;
    if (Math.abs(rx) > half || Math.abs(ry) > half) return;              // di luar d-pad
    var cz = d.s * 0.22;                                                 // zona tengah lebih lebar
    if (Math.abs(rx) <= cz && Math.abs(ry) <= cz) { centerButton(); return; }  // tengah = berhenti / konfirmasi
    if (Math.abs(rx) > Math.abs(ry)) setDir(rx > 0 ? 1 : -1, 0); else setDir(0, ry > 0 ? 1 : -1);
  }

  // ---------- Gerak ----------
  var ALIGN = 0.12;
  function aligned(v) { return Math.abs(v - Math.round(v)) < ALIGN; }
  // Gerak grid KOKOH: entitas selalu melangkah menuju pusat petak berikutnya dan
  // berhenti/belok TEPAT di pusat (deteksi lintas-pusat). Tidak ada "snap balik",
  // jadi tak tergantung ambang/FPS. Gerak selalu satu sumbu (dx XOR dy).
  var EPS = 1e-6;
  function moveEntity(m, dt, isPlayer) {
    if (Math.abs(m.fx - Math.round(m.fx)) < EPS) m.fx = Math.round(m.fx);
    if (Math.abs(m.fy - Math.round(m.fy)) < EPS) m.fy = Math.round(m.fy);
    var remaining = m.speed * dt, guard = 0;
    while (remaining > EPS && guard++ < 128) {
      var atCenter = (m.fx === Math.round(m.fx)) && (m.fy === Math.round(m.fy));
      if (atCenter) {
        var cc = m.fx, cr = m.fy;
        if (isPlayer) {
          if ((m.ndx || m.ndy) && !isWall(cc + m.ndx, cr + m.ndy)) { m.dx = m.ndx; m.dy = m.ndy; }
        } else { chooseMonsterDir(m, cc, cr); }
        if (isWall(cc + m.dx, cr + m.dy)) { m.dx = 0; m.dy = 0; }
        if (m.dx === 0 && m.dy === 0) break;            // buntu / tak ada arah -> diam
      }
      var distToNext;                                    // jarak ke pusat petak berikutnya
      if (m.dx > 0) distToNext = (Math.floor(m.fx) + 1) - m.fx;
      else if (m.dx < 0) distToNext = m.fx - (Math.ceil(m.fx) - 1);
      else if (m.dy > 0) distToNext = (Math.floor(m.fy) + 1) - m.fy;
      else distToNext = m.fy - (Math.ceil(m.fy) - 1);
      if (distToNext < EPS) distToNext = 1;              // tepat di pusat -> satu petak penuh
      var stepd = Math.min(remaining, distToNext);
      m.fx += m.dx * stepd; m.fy += m.dy * stepd;
      remaining -= stepd;
      if (stepd >= distToNext - EPS) { m.fx = Math.round(m.fx); m.fy = Math.round(m.fy); } // mendarat di pusat
    }
  }
  function chooseMonsterDir(m, cc, cr) {
    var options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return !isWall(cc + d[0], cr + d[1]); });
    var noRev = options.filter(function (d) { return !(d[0] === -m.dx && d[1] === -m.dy); });
    if (noRev.length) options = noRev;
    var flee = frightenTimer > 0, tx_ = player.fx, ty_ = player.fy;
    if (!flee && m.type === "ambush") { tx_ = player.fx + player.dx * 4; ty_ = player.fy + player.dy * 4; }
    var best = null, bestScore = flee ? -1 : 1e9;
    for (var i = 0; i < options.length; i++) {
      var d = options[i], dist = Math.hypot((cc + d[0]) - tx_, (cr + d[1]) - ty_);
      if (flee ? dist > bestScore : dist < bestScore) { bestScore = dist; best = d; }
    }
    if (best) { m.dx = best[0]; m.dy = best[1]; }
  }

  // ---------- Logika ----------
  function onReachTile(cc, cr) { if (dots[cr] && dots[cr][cc]) { dots[cr][cc] = false; score += 10; dotsLeft--; sfx("dot"); } }
  function podUnderPlayer() {
    var pc = Math.round(player.fx), pr = Math.round(player.fy);
    for (var p = 0; p < PODS.length; p++) if (PODS[p] && PODS[p].c === pc && PODS[p].r === pr && podMap[p] >= 0) return p;
    return -1;
  }
  function answer(podIdx) {
    var optIdx = podMap[podIdx];
    if (optIdx < 0) return;
    var qd = QUESTIONS[qIndex];
    if (optIdx === qd.benar) {
      score += 100; frightenTimer = 4.5; sfx("correct");
      if (monsters.length > MON_START) monsters.pop();
      flash = 0.35; setMsg("✔ Benar! +100", "#3ddc84");
      qIndex++;
      if (qIndex >= QUESTIONS.length) { win(); return; }
      loadQuestion(); switchMaze(qIndex); showIntro();   // popup soal berikutnya
    } else { loseLife("Kurang tepat!", true); }
  }
  function loseLife(text, fromWrong) {
    lives--; setMsg(text || "Terkena monster!", "#ff5c6c"); flash = 0.4; sfx(fromWrong ? "wrong" : "hit");
    if (lives <= 0) { over(); return; }
    invuln = 1.6; graceTimer = 1.2;                // reposisi + jeda singkat
    player.fx = PLAYER_SPAWN.c; player.fy = PLAYER_SPAWN.r; player.dx = 0; player.dy = 0; player.ndx = 0; player.ndy = 0;
    for (var i = 0; i < monsters.length; i++) { monsters[i].fx = monsterHome.c; monsters[i].fy = monsterHome.r; monsters[i].dx = 0; monsters[i].dy = 0; }
    if (fromWrong) { frightenTimer = 0; if (addMonster()) setMsg("Salah! Muncul monster baru (" + monsters.length + ")", "#ff8a4c"); }
  }
  function setMsg(t, col) { msg = t; msgColor = col || "#fff"; msgTimer = 1.6; }
  // Tombol tengah: bila DIAM di kotak jawaban -> konfirmasi (nilai); selain itu -> berhenti.
  function centerButton() {
    if (state !== "play" || !player) return;
    if (player.dx === 0 && player.dy === 0) { var p = podUnderPlayer(); if (p >= 0) { answer(p); return; } }
    stopPlayer();
  }

  function over() { state = "over"; saveProgress(false).then(paintEndScreens); paintEndScreens(); }
  function win() { state = "win"; saveProgress(true).then(paintEndScreens); paintEndScreens(); }
  function paintEndScreens() {
    var badge, emoji;
    if (lives >= 3) { badge = "Sahabat Al-Qur'an"; emoji = "🏆"; }
    else if (lives === 2) { badge = "Ahlulqur'an"; emoji = "⭐"; }
    else if (lives === 1) { badge = "Pecinta Al-Qur'an"; emoji = "📖"; }
    else { badge = "Pejuang Al-Qur'an"; emoji = "🌱"; }
    if (state === "win") {
      show("mzWin", true); show("mzOver", false);
      root.querySelector("#mzWinEmoji").textContent = emoji;
      root.querySelector("#mzWinBadge").textContent = badge;
      root.querySelector("#mzWinStat").textContent = "Skor: " + score + " · Nyawa: " + lives + (savedMsg ? (" · " + savedMsg) : "");
    } else if (state === "over") {
      show("mzOver", true); show("mzWin", false);
      root.querySelector("#mzOverStat").textContent = "Skor: " + score + (savedMsg ? (" · " + savedMsg) : "");
    }
  }

  function startGame() {
    mapIdx = 0; MAZE = MAZES[0]; scanMap();
    score = 0; lives = 3; qIndex = 0; frightenTimer = 0; invuln = 0; savedMsg = "";
    dotsLeft = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (dots[r][c]) dotsLeft++;
    resetPositions(); loadQuestion();
    startTime = performance.now();
    showIntro();                                   // popup baca soal dulu, baru main
  }

  // ---------- Loop ----------
  function loop(t) {
    if (!mounted) return;
    if (state !== "play") return;
    _frames++;
    try {
    if (!lastT) lastT = t;
    // Gerak BERBASIS WAKTU: pakai elapsed nyata (dibatasi 0.25s utk hindari lompatan
    // besar setelah tab tak aktif), lalu dibagi sub-langkah kecil agar tetap akurat &
    // tak tembus dinding meski FPS rendah. Ini menghilangkan "gerak lambat/telat".
    var frameDt = Math.min((t - lastT) / 1000, 0.25); lastT = t;
    if (frightenTimer > 0) frightenTimer -= frameDt;
    if (invuln > 0) invuln -= frameDt;
    if (graceTimer > 0) graceTimer -= frameDt;     // jeda "Bersiap": monster diam dulu
    if (flash > 0) flash -= frameDt;
    if (msgTimer > 0) msgTimer -= frameDt;

    var STEP = 0.02, nSteps = Math.max(1, Math.min(16, Math.ceil(frameDt / STEP))), sub = frameDt / nSteps;
    _dbgNS = nSteps;
    for (var s = 0; s < nSteps && state === "play"; s++) {
      var pcOld = Math.round(player.fx), prOld = Math.round(player.fy);
      moveEntity(player, sub, true);
      var pcNew = Math.round(player.fx), prNew = Math.round(player.fy);
      if ((pcNew !== pcOld || prNew !== prOld) && aligned(player.fx) && aligned(player.fy)) onReachTile(pcNew, prNew);
      if (graceTimer <= 0) for (var i = 0; i < monsters.length; i++) moveEntity(monsters[i], sub, false);
    }

    // (menjawab TIDAK otomatis — hanya lewat tombol tengah ✓, lihat centerButton)

    if (invuln <= 0 && graceTimer <= 0) {
      for (var j = 0; j < monsters.length; j++) {
        var m = monsters[j];
        if (Math.hypot(m.fx - player.fx, m.fy - player.fy) < 0.55) {
          if (frightenTimer > 0) { score += 50; m.fx = m.spawn.c; m.fy = m.spawn.r; setMsg("Monster kabur! +50", "#8ad"); sfx("scare"); }
          else { loseLife("Terkena monster!", false); }
          break;
        }
      }
    }
    render();
    } catch (e) { console.error("[maze] loop error:", e); }
    requestAnimationFrame(loop);
  }

  // ---------- Render ----------
  function tx(c) { return OX + c * TILE + TILE / 2; }
  function ty(r) { return OY + r * TILE + TILE / 2; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrapText(text, x, y, maxW, lh) {
    var words = text.split(" "), line = "", yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i] + " "; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
  }
  function render() {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#060819"; ctx.fillRect(0, 0, W, H);
    drawHUD(); drawMaze(); drawDots(); drawPods();
    drawPlayer();
    for (var i = 0; i < monsters.length; i++) drawMonster(monsters[i]);
    drawBanner(); drawDpad();
    if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (flash * 0.4) + ")"; ctx.fillRect(OX, OY, TILE * COLS, TILE * ROWS); }
    if (graceTimer > 0) drawGrace();
    if (msgTimer > 0) drawFloatMsg();
    if (DEBUG) drawDebug();
  }
  function drawGrace() {
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#f2cf5b"; ctx.font = "900 26px sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 10;
    ctx.fillText("Bersiap… " + Math.ceil(graceTimer), OX + TILE * COLS / 2, OY + TILE * ROWS / 2);
    ctx.restore();
  }
  function drawDebug() {
    var y = HUD_H + QBAR_H + 2;
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(4, y, 280, 30);
    ctx.fillStyle = "#5f5"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    var pd = player ? (player.dx + "," + player.dy) : "-";
    ctx.fillText("F" + _frames + " tap" + _taps + " in" + _inputs + " want" + _lastDir + " mv" + pd + " " + state, 8, y + 2);
    if (player) {
      var cc = Math.round(player.fx), cr = Math.round(player.fy);
      var w = (isWall(cc, cr - 1) ? "U" : "-") + (isWall(cc, cr + 1) ? "D" : "-") + (isWall(cc - 1, cr) ? "L" : "-") + (isWall(cc + 1, cr) ? "R" : "-");
      var al = (aligned(player.fx) && aligned(player.fy)) ? 1 : 0;
      ctx.fillText("fx" + player.fx.toFixed(1) + " fy" + player.fy.toFixed(1) + " al" + al + " nd" + player.ndx + "," + player.ndy + " wall:" + w + " nS" + _dbgNS, 8, y + 16);
    }
  }
  function drawHUD() {
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#c9a84a"; ctx.font = "800 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("SKOR", 16, HUD_H / 2 - 9);
    ctx.fillStyle = "#fff"; ctx.font = "900 20px sans-serif"; ctx.fillText(String(score), 16, HUD_H / 2 + 11);
    for (var i = 0; i < 3; i++) drawHeart(W - 22 - i * 30, HUD_H / 2, 9, i < lives ? "#ff5c6c" : "#33406e");
    ctx.fillStyle = "#9fb0e0"; ctx.font = "800 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Soal " + (qIndex + 1) + " / " + QUESTIONS.length, W / 2, HUD_H / 2 - 8);
    ctx.fillStyle = "#c9a84a"; ctx.font = "700 10px sans-serif";
    ctx.fillText("Peta " + (mapIdx + 1) + " / " + MAZES.length, W / 2, HUD_H / 2 + 8);
  }
  function drawHeart(x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s, -s * 0.6, -s * 0.5, -s * 1.1, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.6, 0, s * 0.35);
    ctx.fill(); ctx.restore();
  }
  function drawMaze() {
    var mw = TILE * COLS, mh = TILE * ROWS;
    var g = ctx.createLinearGradient(OX, OY, OX, OY + mh);
    g.addColorStop(0, "#123f86"); g.addColorStop(1, "#0b2350"); ctx.fillStyle = g; ctx.fillRect(OX, OY, mw, mh);
    ctx.fillStyle = "#04060e";
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (MAZE[r][c] === "#") ctx.fillRect(OX + c * TILE, OY + r * TILE, TILE + 0.6, TILE + 0.6);
    var lw = Math.max(2, TILE * 0.11); ctx.strokeStyle = "#e6bb3e"; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var ins = lw * 0.55 + 1; ctx.beginPath();
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      if (MAZE[r2][c2] !== "#") continue;
      var x = OX + c2 * TILE, y = OY + r2 * TILE, x2 = x + TILE, y2 = y + TILE;
      if (!isWall(c2, r2 - 1)) { ctx.moveTo(x + ins, y + ins); ctx.lineTo(x2 - ins, y + ins); }
      if (!isWall(c2, r2 + 1)) { ctx.moveTo(x + ins, y2 - ins); ctx.lineTo(x2 - ins, y2 - ins); }
      if (!isWall(c2 - 1, r2)) { ctx.moveTo(x + ins, y + ins); ctx.lineTo(x + ins, y2 - ins); }
      if (!isWall(c2 + 1, r2)) { ctx.moveTo(x2 - ins, y + ins); ctx.lineTo(x2 - ins, y2 - ins); }
    }
    ctx.stroke();
  }
  function drawDots() {
    ctx.fillStyle = "#f6e7b2";
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (dots[r] && dots[r][c]) { ctx.beginPath(); ctx.arc(tx(c), ty(r), Math.max(1.8, TILE * 0.08), 0, 7); ctx.fill(); }
  }
  function drawPods() {
    var qd = QUESTIONS[qIndex];
    for (var p = 0; p < PODS.length; p++) {
      if (!PODS[p] || podMap[p] < 0) continue;      // kotak nonaktif (opsi < 4)
      var pod = PODS[p], cx = tx(pod.c), cy = ty(pod.r), label = qd.opsi[podMap[p]];
      var here = player && player.dx === 0 && player.dy === 0 && Math.round(player.fx) === pod.c && Math.round(player.fy) === pod.r;
      var w = TILE * 2.5, h = TILE * 1.35;
      var x = Math.max(OX + 3, Math.min(cx - w / 2, OX + TILE * COLS - w - 3));
      var y = Math.max(OY + 3, Math.min(cy - h / 2, OY + TILE * ROWS - h - 3));
      ctx.fillStyle = here ? "#0d2a16" : "#04060e"; roundRect(x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = here ? "#3ddc84" : "rgba(230,187,62,0.55)"; ctx.lineWidth = here ? 2.5 : 1.5; roundRect(x, y, w, h, 8); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var words = label.split(" ");
      if (words.length > 1 && label.length > 8) {
        ctx.font = "800 13px sans-serif";
        ctx.fillText(words[0], x + w / 2, y + h / 2 - 8);
        ctx.fillText(words.slice(1).join(" "), x + w / 2, y + h / 2 + 8);
      } else { ctx.font = "800 " + (label.length > 11 ? 12 : 14) + "px sans-serif"; ctx.fillText(label, x + w / 2, y + h / 2); }
    }
  }
  function drawPlayer() {
    var x = tx(player.fx), y = ty(player.fy), rad = TILE * 0.36;
    if (invuln > 0 && Math.floor(invuln * 10) % 2 === 0) return;
    var ang = Math.atan2(player.dy, player.dx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    var grd = ctx.createRadialGradient(-rad * 0.2, -rad * 0.2, rad * 0.2, 0, 0, rad);
    grd.addColorStop(0, "#ff8a95"); grd.addColorStop(1, "#e23b4e"); ctx.fillStyle = grd;
    var mouth = (player.dx || player.dy) ? (0.28 + 0.12 * Math.sin(performance.now() / 90)) : 0.05;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rad, mouth, Math.PI * 2 - mouth); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + player.dx * 3, y - rad * 0.35 + player.dy * 3, rad * 0.14, 0, 7); ctx.fill();
  }
  function drawMonster(m) {
    var x = tx(m.fx), y = ty(m.fy), rad = TILE * 0.34, scared = frightenTimer > 0;
    var body = scared ? "#3a4bb0" : "hsl(" + m.hue + ",70%,62%)";
    if (scared && frightenTimer < 1.5 && Math.floor(frightenTimer * 6) % 2 === 0) body = "#dfe6ff";
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y - rad * 0.15, rad, Math.PI, 0); ctx.lineTo(x + rad, y + rad * 0.7);
    var waves = 3;
    for (var i = 0; i < waves; i++) { var wx = x + rad - (i * 2 + 1) * (rad * 2 / (waves * 2)); ctx.lineTo(wx, y + rad * 0.4); ctx.lineTo(wx - rad * 2 / (waves * 2), y + rad * 0.7); }
    ctx.lineTo(x - rad, y + rad * 0.7); ctx.closePath(); ctx.fill();
    var ex = scared ? 0 : (m.dx * rad * 0.18), ey = scared ? 0 : (m.dy * rad * 0.18);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - rad * 0.35, y - rad * 0.1, rad * 0.24, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + rad * 0.35, y - rad * 0.1, rad * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = scared ? "#3a4bb0" : "#0a1030"; ctx.beginPath(); ctx.arc(x - rad * 0.35 + ex, y - rad * 0.1 + ey, rad * 0.12, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + rad * 0.35 + ex, y - rad * 0.1 + ey, rad * 0.12, 0, 7); ctx.fill();
  }
  // Banner soal di ATAS (di bawah HUD, lebar penuh) — sisakan bawah untuk tombol navigasi
  function drawBanner() {
    var by = HUD_H; ctx.fillStyle = "#0a0e2a"; ctx.fillRect(0, by, W, QBAR_H);
    ctx.fillStyle = "rgba(201,168,74,0.25)"; ctx.fillRect(0, by + QBAR_H - 2, W, 2);
    var qd = QUESTIONS[qIndex];
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "#c9a84a"; ctx.font = "800 11px sans-serif"; ctx.fillText("PERTANYAAN", 16, by + 10);
    ctx.fillStyle = "#6b7aa8"; ctx.font = "600 10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("berhenti di kotak jawaban → tekan ✓", W - 16, by + 11);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff"; ctx.font = "700 15px sans-serif"; wrapText(qd.q, 16, by + 28, W - 32, 19);
  }
  function drawDpad() {
    var d = dpadRect(), arms = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var i = 0; i < arms.length; i++) {
      var a = arms[i], bx = d.cx + a[0] * d.s * 0.37, by = d.cy + a[1] * d.s * 0.37, bs = d.s * 0.28;
      var active = player && player.dx === a[0] && player.dy === a[1];
      ctx.fillStyle = active ? "rgba(201,168,74,0.95)" : "rgba(255,255,255,0.14)"; roundRect(bx - bs / 2, by - bs / 2, bs, bs, 7); ctx.fill();
      ctx.fillStyle = active ? "#1a1200" : "rgba(255,255,255,0.7)"; ctx.font = "900 " + Math.round(bs * 0.6) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(i === 0 ? "▲" : i === 1 ? "▼" : i === 2 ? "◀" : "▶", bx, by);
    }
    // tombol tengah = BERHENTI, atau ✓ KONFIRMASI bila diam di kotak jawaban
    var bs2 = d.s * 0.26, stopped = player && player.dx === 0 && player.dy === 0;
    var canConfirm = stopped && podUnderPlayer() >= 0;
    ctx.fillStyle = canConfirm ? "rgba(61,220,132,0.95)" : (stopped ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.14)");
    roundRect(d.cx - bs2 / 2, d.cy - bs2 / 2, bs2, bs2, 6); ctx.fill();
    ctx.fillStyle = canConfirm ? "#06210f" : (stopped ? "#fff" : "rgba(255,255,255,0.7)");
    ctx.font = "900 " + Math.round(bs2 * 0.55) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(canConfirm ? "✓" : "■", d.cx, d.cy);
  }
  function drawFloatMsg() {
    ctx.save(); ctx.globalAlpha = Math.min(1, msgTimer); ctx.fillStyle = msgColor; ctx.font = "900 22px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
    ctx.fillText(msg, OX + TILE * COLS / 2, OY + TILE * ROWS / 2); ctx.restore();
  }

  // ---------- DOM & lifecycle ----------
  function show(id, on) { var el = root.querySelector("#" + id); if (el) el.style.display = on ? "flex" : "none"; }
  function injectStyles() {
    if (document.getElementById("mzStyle")) return;
    var css = "" +
      "#mzRoot{position:fixed;inset:0;z-index:99999;background:#060819;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;overflow:hidden;touch-action:none;-webkit-tap-highlight-color:transparent;}" +
      "#mzRoot canvas{display:block;touch-action:none;}" +
      "#mzRoot .mz-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;gap:14px;background:radial-gradient(ellipse at 50% 35%,#17224f 0%,#090c22 70%);}" +
      "#mzRoot .mz-brand{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#c9a84a;font-weight:800;}" +
      "#mzRoot .mz-title{font-size:28px;font-weight:900;line-height:1.15;}" +
      "#mzRoot .mz-sub{font-size:13.5px;color:#9fb0e0;max-width:320px;line-height:1.6;}" +
      "#mzRoot .mz-btn{margin-top:6px;padding:15px 34px;border:none;border-radius:16px;cursor:pointer;font-size:16px;font-weight:800;font-family:inherit;color:#1a1200;background:linear-gradient(135deg,#f2cf5b,#d3a12f);box-shadow:0 8px 24px rgba(211,161,47,.4);}" +
      "#mzRoot .mz-btn:active{transform:scale(.95);}" +
      "#mzRoot .mz-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:14px;z-index:5;width:40px;height:40px;border-radius:12px;border:1.5px solid #33406e;background:rgba(10,14,42,.7);color:#9fb0e0;font-size:20px;cursor:pointer;}" +
      "#mzRoot .mz-emoji{font-size:60px;}" +
      "#mzRoot .mz-badge{font-size:22px;font-weight:900;color:#f2cf5b;}" +
      "#mzRoot .mz-stat{font-size:14px;color:#c8d4f5;}" +
      "#mzRoot .mz-hint{font-size:11.5px;color:#6b7aa8;line-height:1.7;}" +
      "#mzRoot .mz-opt{background:rgba(255,255,255,.07);border:1.5px solid #2a3860;border-radius:11px;padding:10px 14px;font-size:14px;font-weight:700;color:#dbe4ff;}" +
      "#mzRoot .mz-mute{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:62px;z-index:5;width:40px;height:40px;border-radius:12px;border:1.5px solid #33406e;background:rgba(10,14,42,.7);color:#9fb0e0;font-size:18px;cursor:pointer;}";
    var st = document.createElement("style"); st.id = "mzStyle"; st.textContent = css; document.head.appendChild(st);
  }
  function buildDOM() {
    root = document.createElement("div"); root.id = "mzRoot";
    root.innerHTML =
      '<canvas id="mzCanvas"></canvas>' +
      '<button class="mz-mute" id="mzMuteBtn" aria-label="Suara">🔊</button>' +
      '<button class="mz-x" id="mzCloseBtn" aria-label="Tutup">✕</button>' +
      '<div class="mz-screen" id="mzStart">' +
        '<div class="mz-brand">Rattīlil Qur\'an</div>' +
        '<div class="mz-title">Rattil Maze<br>Adventure</div>' +
        '<div class="mz-sub" id="mzStartSub">Memuat…</div>' +
        '<button class="mz-btn" id="mzStartBtn">Mulai Bermain</button>' +
        '<div class="mz-hint">Geser / tombol panah untuk bergerak · ■ (tengah) untuk berhenti<br>Diam di kotak jawaban lalu tekan ✓ untuk memilih (berhenti ≠ menjawab)</div>' +
      '</div>' +
      '<div class="mz-screen" id="mzIntro" style="display:none;">' +
        '<div class="mz-brand" id="mzIntroNum">Soal 1 / 5</div>' +
        '<div class="mz-title" id="mzIntroQ" style="font-size:20px;max-width:340px;">?</div>' +
        '<div class="mz-hint">Jawaban tersebar di labirin. Temukan yang benar, berhenti di kotaknya, lalu tekan ✓.</div>' +
        '<button class="mz-btn" id="mzIntroBtn">Mulai! ▶</button>' +
      '</div>' +
      '<div class="mz-screen" id="mzOver" style="display:none;">' +
        '<div class="mz-emoji">💫</div><div class="mz-title" style="font-size:24px;">Nyawa Habis</div>' +
        '<div class="mz-stat" id="mzOverStat">Skor: 0</div>' +
        '<div class="mz-sub">Jangan menyerah, ulangi lagi bacaanmu!</div>' +
        '<button class="mz-btn" id="mzRetryBtn">Coba Lagi</button>' +
      '</div>' +
      '<div class="mz-screen" id="mzWin" style="display:none;">' +
        '<div class="mz-emoji" id="mzWinEmoji">🏆</div><div class="mz-brand">Kamu Mendapat Badge</div>' +
        '<div class="mz-badge" id="mzWinBadge">Sahabat Al-Qur\'an</div>' +
        '<div class="mz-stat" id="mzWinStat">Skor: 0</div>' +
        '<div class="mz-sub">Semua soal terjawab. Barakallahu fiik!</div>' +
        '<button class="mz-btn" id="mzAgainBtn">Main Lagi</button>' +
      '</div>';
    document.body.appendChild(root);
    canvas = root.querySelector("#mzCanvas"); ctx = canvas.getContext("2d");

    root.querySelector("#mzStartBtn").onclick = function () { ensureAudio(); startGame(); };
    root.querySelector("#mzRetryBtn").onclick = startGame;
    root.querySelector("#mzAgainBtn").onclick = startGame;
    root.querySelector("#mzIntroBtn").onclick = beginPlay;
    root.querySelector("#mzCloseBtn").onclick = close;
    root.querySelector("#mzMuteBtn").onclick = function () {
      _muted = !_muted; this.textContent = _muted ? "🔇" : "🔊"; if (!_muted) ensureAudio();
    };

    _keyHandler = function (e) {
      var k = e.key, d = null;
      if (k === "ArrowUp" || k === "w") d = [0, -1]; else if (k === "ArrowDown" || k === "s") d = [0, 1];
      else if (k === "ArrowLeft" || k === "a") d = [-1, 0]; else if (k === "ArrowRight" || k === "d") d = [1, 0];
      else if (k === " " || k === "Enter") { centerButton(); e.preventDefault(); return; }
      else if (k === "Escape") { close(); return; } else return;
      setDir(d[0], d[1]); e.preventDefault();
    };
    window.addEventListener("keydown", _keyHandler, { passive: false });

    canvas.addEventListener("touchstart", function (e) { e.preventDefault(); var t = e.changedTouches[0]; _touchStart = { x: t.clientX, y: t.clientY }; }, { passive: false });
    canvas.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener("touchend", function (e) {
      e.preventDefault();
      if (!_touchStart) return; var t = e.changedTouches[0], dx = t.clientX - _touchStart.x, dy = t.clientY - _touchStart.y;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) { handleDpadTap(t.clientX, t.clientY); _touchStart = null; return; }
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1);
      _touchStart = null;
    }, { passive: false });
    canvas.addEventListener("mousedown", function (e) { handleDpadTap(e.clientX, e.clientY); });

    _resizeHandler = function () { if (mounted) { layout(); if (state !== "play") render(); } };
    window.addEventListener("resize", _resizeHandler);
  }

  function open() {
    if (mounted) return; mounted = true;
    injectStyles(); buildDOM(); layout(); scanMap();
    try { player = mkEntity(PLAYER_SPAWN.c, PLAYER_SPAWN.r, PLAYER_SPEED); loadQuestion(); render(); } catch (e) { }
    state = "start"; show("mzStart", true);
    boot();
  }
  function close() {
    if (!mounted) return; mounted = false; state = "closed";
    clearIntroTimer();
    if (_keyHandler) window.removeEventListener("keydown", _keyHandler);
    if (_resizeHandler) window.removeEventListener("resize", _resizeHandler);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = canvas = ctx = null; _keyHandler = _resizeHandler = _touchStart = null;
  }

  window.MazeGame = { open: open, close: close };
})();
