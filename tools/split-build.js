#!/usr/bin/env node
// Build script: split supabase-client.js -> core/staff/murid/assemble.
// Content-assertions at every boundary: fail loud if a line number drifts.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: split-build.js <projectRoot> [--force]'); process.exit(1); }
const FORCE = process.argv.includes('--force');
const SRC = path.join(ROOT, 'supabase', 'supabase-client.js');
const OUT = path.join(ROOT, 'supabase');

// GUARD (#2): file split kini KANONIK. Menimpanya dari monolit lama akan menghapus
// edit manual apa pun. Tolak kecuali --force eksplisit.
const TARGETS = ['supabase-core.js', 'api-staff.js', 'api-murid.js', 'hq-assemble.js'];
const existing = TARGETS.filter(t => fs.existsSync(path.join(OUT, t)));
if (existing.length && !FORCE) {
  console.error('REFUSED: file split sudah ada & KANONIK (' + existing.join(', ') + ').');
  console.error('Menjalankan ini menimpanya dari supabase-client.js lama — edit manual akan HILANG.');
  console.error('Jika benar-benar sengaja regenerasi, ulangi dengan  --force');
  process.exit(3);
}
const raw = fs.readFileSync(SRC, 'utf8');
const L = raw.split('\n');            // L[0] = line 1
const N = L.length;                   // note: trailing newline => last elem ''

function line(n) { return L[n - 1]; }  // 1-indexed
function slice(a, b) { return L.slice(a - 1, b).join('\n'); } // 1-indexed inclusive
let failed = false;
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAIL: ' + msg); failed = true; } }
function assertEq(n, val) { assert(line(n) === val, `L${n} === ${JSON.stringify(val)} (got ${JSON.stringify(line(n))})`); }
function assertHas(n, sub) { assert(line(n) && line(n).includes(sub), `L${n} contains ${JSON.stringify(sub)} (got ${JSON.stringify(line(n))})`); }

// ---- boundary assertions ----
assertEq(586, 'var GuruAPI = {');
assertEq(3676, 'var MuridAPI = {');
assertEq(5476, 'var AdminAPI = {');
assertEq(7825, 'var KetuaAPI = {');
assertEq(8108, 'var PushPrefsAPI = {');
assertEq(8398, 'window.HQ = {');
assertEq(3423, '};');   // GuruAPI close
assertEq(3671, '}');    // _kalkulasiRaport close
assertEq(5471, '};');   // MuridAPI close
assertEq(7820, '};');   // AdminAPI close
assertEq(8103, '};');   // KetuaAPI close
assertEq(8269, '}');    // _urlB64ToUint8Array close
assertEq(8393, '})();'); // SWR IIFE close
assertHas(3429, 'function _kalkulasiRaport');
assertHas(8137, 'function _sendPushBg');
assertHas(8156, 'var PushAPI');
assertHas(8277, 'var apis = {');
assertHas(8284, 'readPrefixes');

// ---- boundary-method headers/footers ----
assertHas(1961, 'getRincianRaport: async function(id_raport)');
assertEq(2019, '  },');
assertHas(2021, 'generateRaportPDF: async function(id_raport)');
assertEq(2024, '  },');
assertHas(2206, 'getPenilaianHafalan: async function()');
assertEq(2213, '  },');
assertHas(7583, 'getPushConfig: async function()');
assertHas(4035, 'getLatihanUploadToken: async function()');
// MuridAPI wrappers
assertHas(4086, 'getRincianRaport: async function(id_raport) { return GuruAPI.getRincianRaport(id_raport); }');
assertHas(4087, 'generateRaportPDF: async function(id_r)');

if (failed) { console.error('\nAborting: boundary assertions failed.'); process.exit(2); }

// ---- extract a method body (lines between header and its "  }," footer) ----
function bodyBetween(headerLine, footerLine) {
  // returns inner lines (exclusive of header & footer), preserving indentation
  return L.slice(headerLine, footerLine - 1).join('\n');
}
// getRincianRaport 1961..2019 ; generateRaportPDF 2021..2024 ; getPenilaianHafalan 2206..2213
const bRincian  = bodyBetween(1961, 2019);
const bGenPDF   = bodyBetween(2021, 2024);
const bPenilaian= bodyBetween(2206, 2213);
// getPushConfig 7583.. find footer '  },'
let f7583 = 7583; while (line(f7583).trim() !== '},') f7583++;
const bPush = bodyBetween(7583, f7583);
// getLatihanUploadToken 4035.. find footer (trim '},')
let f4035 = 4035; while (line(f4035).trim() !== '},') f4035++;
const bTok = bodyBetween(4035, f4035);

// ---- facade (QuizAPI) inside window.HQ ----
let qStart = -1, aIdx = -1;
for (let i = 8398; i <= 8446; i++) {
  if (line(i).trim() === 'QuizAPI: {') qStart = i;
  if (line(i).trim() === 'AbsensiGuruUtil: AbsensiGuruUtil,') aIdx = i;
}
assert(qStart > 0 && aIdx > qStart, 'facade anchors found');
assert(line(aIdx - 1).trim() === '},', `QuizAPI close '  },' at L${aIdx-1} (got ${JSON.stringify(line(aIdx-1))})`);
if (failed) process.exit(2);
let facadeInner = L.slice(qStart, aIdx - 2).join('\n'); // between 'QuizAPI: {' and its '  },'
// transform bare API refs -> HQ.* (undefined-safe across portals)
facadeInner = facadeInner
  .replace(/\bGuruAPI\b/g, 'HQ.GuruAPI')
  .replace(/\bMuridAPI\b/g, 'HQ.MuridAPI');

// ---- DEDUP (#1/#3/#4): hapus 5 method boundary ASLI dari slice asal.
//      _core_* (di core) jadi satu-satunya sumur; akses via HQ.<Obj> (fill di assemble). ----
const DEL = new Set();
function markDel(a, b) { for (let i = a; i <= b; i++) DEL.add(i); }
markDel(1961, 2019);   // GuruAPI.getRincianRaport
markDel(2021, 2024);   // GuruAPI.generateRaportPDF
markDel(2206, 2213);   // GuruAPI.getPenilaianHafalan
markDel(4035, f4035);  // MuridAPI.getLatihanUploadToken
markDel(7583, f7583);  // AdminAPI.getPushConfig
// carve a..b (1-indexed inclusive) MENGECUALIKAN baris di DEL
function sliceDel(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) if (!DEL.has(i)) out.push(line(i));
  return out.join('\n');
}

// ---- big object carves ----
const HEAD  = slice(1, 582);
const GURU  = sliceDel(583, 3423);   // minus getRincianRaport/generateRaportPDF/getPenilaianHafalan
const KALK  = slice(3424, 3671);
let   MURID = sliceDel(3672, 5471);  // minus getLatihanUploadToken
const ADMIN = sliceDel(5472, 7820);  // minus getPushConfig
const KETUA = slice(7821, 8103);
const PUSH  = slice(8104, 8269);
const IIFEBODY = slice(8284, 8392); // readPrefixes .. window._clearHQCache=clearCache
// sanity: method asli benar-benar hilang dari slice
assert(!/getRincianRaport: async function/.test(GURU), 'GuruAPI.getRincianRaport terhapus');
assert(!/generateRaportPDF: async function/.test(GURU), 'GuruAPI.generateRaportPDF terhapus');
assert(!/getPenilaianHafalan: async function/.test(GURU), 'GuruAPI.getPenilaianHafalan terhapus');
assert(/savePenilaianHafalan: async function/.test(GURU), 'GuruAPI.savePenilaianHafalan MASIH ada (tak ikut terhapus)');
assert(!/getLatihanUploadToken: async function/.test(MURID), 'MuridAPI.getLatihanUploadToken terhapus');
assert(!/getPushConfig: async function/.test(ADMIN), 'AdminAPI.getPushConfig terhapus');
if (failed) process.exit(2);

// ---- edit MuridAPI wrappers: bare GuruAPI.* -> _core_* ----
MURID = MURID
  .replace('return GuruAPI.getRincianRaport(id_raport);', 'return _core_getRincianRaport(id_raport);')
  .replace('return GuruAPI.generateRaportPDF(id_r);', 'return _core_generateRaportPDF(id_r);');
assert(MURID.includes('_core_getRincianRaport(id_raport)'), 'wrapper getRincianRaport edited');
assert(MURID.includes('_core_generateRaportPDF(id_r)'), 'wrapper generateRaportPDF edited');
assert(!/\bGuruAPI\b/.test(MURID), 'no bare GuruAPI left in MURID slice');
if (failed) process.exit(2);

const HDR = (name) => `// ============================================================\n//  ${name}\n//  Hasil split supabase-client.js (2026-07-18). File ini KANONIK — edit di sini.\n//  supabase-client.js lama disimpan sbg fallback rollback; boleh dihapus stlh live OK.\n// ============================================================\n`;

// ---------- supabase-core.js ----------
const core = [
HDR('SUPABASE CORE — dimuat SEMUA portal (config, _sb, helper, Auth, Push, boundary)'),
HEAD,
'',
'// ─────────────────────────────────────────────',
'//  PUSH (prefs + notifications) — dipakai semua portal',
'// ─────────────────────────────────────────────',
PUSH,
'',
'// ─────────────────────────────────────────────',
'//  BOUNDARY METHODS (direlokasi ke core; dipakai lintas-bundle)',
'//  Ditempel ke HQ.<Obj> oleh hq-assemble.js (fill-if-absent).',
'// ─────────────────────────────────────────────',
`async function _core_getRincianRaport(id_raport) {\n${bRincian}\n}`,
`async function _core_generateRaportPDF(id_raport) {\n${bGenPDF}\n}`,
`async function _core_getPenilaianHafalan() {\n${bPenilaian}\n}`,
`async function _core_getPushConfig() {\n${bPush}\n}`,
`async function _core_getLatihanUploadToken() {\n${bTok}\n}`,
'',
'// ─────────────────────────────────────────────',
'//  window.HQ BASE — anggota yang SELALU ada di tiap portal.',
'//  Bundle lain (staff/murid) & hq-assemble menempel sisanya.',
'// ─────────────────────────────────────────────',
'window.HQ = window.HQ || {};',
'window.HQ.Auth = Auth;',
'window.HQ.PushAPI = PushAPI;',
'window.HQ.PushPrefsAPI = PushPrefsAPI;',
'window.HQ.AbsensiGuruUtil = AbsensiGuruUtil;',
'window.HQ.supabase = _sb;',
'window.HQ.getCurrentUser = function() { return _currentUser; };',
'window.HQ.cache = { invalidate: function(){ return window._clearHQCache && window._clearHQCache(); }, clear: function(){ return window._clearHQCache && window._clearHQCache(); } };',
'window.HQ.SPP_NOMINAL_BULANAN = SPP_NOMINAL_BULANAN;',
''
].join('\n');

// ---------- api-staff.js ----------
const staff = [
HDR('API STAFF — GuruAPI + AdminAPI (dimuat portal guru & admin, TIDAK murid)'),
GURU,
'',
KALK,
'',
ADMIN,
'',
'// ── attach ke window.HQ ──',
'window.HQ = window.HQ || {};',
'window.HQ.GuruAPI = GuruAPI;',
'window.HQ.AdminAPI = AdminAPI;',
'window.HQ.SuperAdminAPI = AdminAPI;',
''
].join('\n');

// ---------- api-murid.js ----------
const murid = [
HDR('API MURID — MuridAPI + KetuaAPI (dimuat HANYA portal murid)'),
MURID,
'',
KETUA,
'',
'// ── attach ke window.HQ ──',
'window.HQ = window.HQ || {};',
'window.HQ.MuridAPI = MuridAPI;',
'window.HQ.KetuaAPI = KetuaAPI;',
''
].join('\n');

// ---------- hq-assemble.js ----------
const assemble = [
HDR('HQ ASSEMBLE — dimuat TERAKHIR tiap portal (boundary fill, QuizAPI facade, SWR cache)'),
'(function(){',
'  var HQ = window.HQ; if (!HQ) return;',
'  function ensure(n){ HQ[n] = HQ[n] || {}; return HQ[n]; }',
'  function fill(n,m,fn){ var o = ensure(n); if (!o[m]) o[m] = fn; }',
"  // 3 boundary diakses via HQ.<Obj> di portal yg tak memuat objek aslinya.",
"  fill('GuruAPI','getPenilaianHafalan', _core_getPenilaianHafalan);",
"  fill('AdminAPI','getPushConfig',      _core_getPushConfig);",
"  fill('MuridAPI','getLatihanUploadToken', _core_getLatihanUploadToken);",
"  // _core_getRincianRaport & _core_generateRaportPDF TIDAK di-fill: hanya dipanggil",
"  // wrapper MuridAPI langsung (HQ.GuruAPI.* keduanya tak pernah dipanggil portal mana pun).",
'',
'  // QuizAPI facade — ref via HQ.* (undefined-safe; method sisi-lain hanya error bila dipanggil di portal salah)',
'  HQ.QuizAPI = {',
facadeInner,
'  };',
'})();',
'',
'// ─────────────────────────────────────────────',
'//  DYNAMIC CACHE WRAPPER (SWR & INVALIDATION) — dipindah dari monolit',
'//  apis via window.HQ + guard (objek berbeda per portal)',
'// ─────────────────────────────────────────────',
'(function() {',
'  if (typeof window === "undefined") return;',
'  var apis = {',
'    AdminAPI: window.HQ.AdminAPI,',
'    GuruAPI:  window.HQ.GuruAPI,',
'    MuridAPI: window.HQ.MuridAPI,',
'    KetuaAPI: window.HQ.KetuaAPI',
'  };',
IIFEBODY,
'})();',
''
].join('\n');

fs.writeFileSync(path.join(OUT, 'supabase-core.js'), core);
fs.writeFileSync(path.join(OUT, 'api-staff.js'), staff);
fs.writeFileSync(path.join(OUT, 'api-murid.js'), murid);
fs.writeFileSync(path.join(OUT, 'hq-assemble.js'), assemble);
console.log('OK written: supabase-core.js, api-staff.js, api-murid.js, hq-assemble.js');
console.log('lines: core=%d staff=%d murid=%d assemble=%d',
  core.split('\n').length, staff.split('\n').length, murid.split('\n').length, assemble.split('\n').length);
