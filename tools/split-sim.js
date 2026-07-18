#!/usr/bin/env node
// Simulate each portal's script load order in a shared global (concatenation),
// with mocked browser globals. Fails if any ReferenceError at load, or shape wrong.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(process.argv[2], 'supabase');
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const core = read('supabase-core.js');
const staff = read('api-staff.js');
const murid = read('api-murid.js');
const assemble = read('hq-assemble.js');

function chainProxy() {
  const p = new Proxy(function(){}, {
    get(t, prop) {
      if (prop === 'then') return undefined;           // not a thenable
      if (prop === Symbol.toPrimitive) return () => '';
      return chainProxy();
    },
    apply() { return chainProxy(); }
  });
  return p;
}

function makeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k,v)=>m.set(k,String(v)),
           removeItem: k=>m.delete(k), key: i=>Array.from(m.keys())[i]||null,
           get length(){ return m.size; }, clear:()=>m.clear() };
}

function runPortal(name, parts) {
  const ctx = {};
  ctx.window = ctx;                          // window === global
  ctx.self = ctx;
  ctx.globalThis = ctx;
  ctx.console = console;
  ctx.JSON = JSON; ctx.Math = Math; ctx.Date = Date; ctx.Object = Object;
  ctx.Array = Array; ctx.Promise = Promise; ctx.Symbol = Symbol; ctx.Error = Error;
  ctx.String = String; ctx.Number = Number; ctx.Boolean = Boolean;
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
  ctx.atob = s => Buffer.from(s, 'base64').toString('binary');
  ctx.btoa = s => Buffer.from(s, 'binary').toString('base64');
  ctx.Uint8Array = Uint8Array; ctx.ArrayBuffer = ArrayBuffer;
  ctx.localStorage = makeStorage();
  ctx.sessionStorage = makeStorage();
  ctx.navigator = { serviceWorker: { ready: Promise.resolve({}), register(){return Promise.resolve({});} },
                    userAgent: 'node', onLine: true };
  ctx.Notification = function(){}; ctx.Notification.permission = 'default'; ctx.Notification.requestPermission = ()=>Promise.resolve('granted');
  ctx.PushManager = function(){};
  ctx.document = { addEventListener(){}, visibilityState:'visible', getElementById(){return null;} };
  ctx.addEventListener = ()=>{};
  ctx.fetch = ()=>Promise.resolve({ json:()=>Promise.resolve({}), ok:true });
  ctx.supabase = { createClient: () => chainProxy() };

  vm.createContext(ctx);
  const src = parts.map(readName).join('\n;\n');
  try {
    vm.runInContext(src, ctx, { filename: name + '-bundle.js' });
  } catch (e) {
    console.log(`\n[${name}] LOAD ERROR: ${e.name}: ${e.message}`);
    console.log(e.stack.split('\n').slice(0,3).join('\n'));
    return { ok:false, ctx };
  }
  return { ok:true, ctx };
}
function readName(n){ return ({core,staff,murid,assemble})[n]; }

let bad = 0;
function check(cond, msg){ if(!cond){ console.log('  ✗ '+msg); bad++; } else { console.log('  ✓ '+msg); } }
function isFn(o, pathStr){ const v = pathStr.split('.').reduce((a,k)=>a&&a[k], o); return typeof v === 'function'; }
function isObj(o, pathStr){ const v = pathStr.split('.').reduce((a,k)=>a&&a[k], o); return v && typeof v === 'object'; }

// ---- MURID portal: core + murid + assemble ----
console.log('=== MURID (core + api-murid + hq-assemble) ===');
let r = runPortal('murid', ['core','murid','assemble']);
if (r.ok) {
  const HQ = r.ctx.HQ;
  check(HQ && typeof HQ === 'object', 'window.HQ ada');
  check(isObj(HQ,'MuridAPI'), 'HQ.MuridAPI (real)');
  check(isFn(HQ,'MuridAPI.getRincianRaport'), 'HQ.MuridAPI.getRincianRaport');
  check(isFn(HQ,'MuridAPI.getLatihanUploadToken'), 'HQ.MuridAPI.getLatihanUploadToken');
  check(isObj(HQ,'KetuaAPI'), 'HQ.KetuaAPI (real)');
  check(isFn(HQ,'GuruAPI.getPenilaianHafalan'), 'HQ.GuruAPI.getPenilaianHafalan (boundary fill)');
  check(isFn(HQ,'AdminAPI.getPushConfig'), 'HQ.AdminAPI.getPushConfig (boundary fill)');
  check(!isFn(HQ,'GuruAPI.getRincianRaport'), 'HQ.GuruAPI.getRincianRaport TIDAK di-fill (dedup #1/#4)');
  check(!isFn(HQ,'GuruAPI.generateRaportPDF'), 'HQ.GuruAPI.generateRaportPDF TIDAK di-fill (dedup)');
  check(!isFn(HQ,'GuruAPI.getKuisList'), 'HQ.GuruAPI.getKuisList TIDAK ada (guru-only, benar absen)');
  check(!isObj(HQ,'GuruAPI.getDashboard') && !isFn(HQ,'AdminAPI.getDashboard'), 'AdminAPI.getDashboard absen di murid');
  check(isFn(HQ,'QuizAPI.getKuisTersedia'), 'HQ.QuizAPI.getKuisTersedia (murid facade)');
  check(isFn(HQ,'PushAPI.isSupported'), 'HQ.PushAPI.isSupported');
  check(isFn(HQ,'PushPrefsAPI.getPrefs'), 'HQ.PushPrefsAPI.getPrefs');
  check(isFn(HQ,'getCurrentUser'), 'HQ.getCurrentUser');
  check(HQ.SPP_NOMINAL_BULANAN === 75000, 'HQ.SPP_NOMINAL_BULANAN=75000');
  check(typeof r.ctx._clearHQCache === 'function', 'window._clearHQCache terpasang (SWR IIFE jalan)');
} else bad++;

// ---- GURU/ADMIN portal: core + staff + assemble ----
console.log('\n=== STAFF/guru+admin (core + api-staff + hq-assemble) ===');
r = runPortal('staff', ['core','staff','assemble']);
if (r.ok) {
  const HQ = r.ctx.HQ;
  check(isObj(HQ,'GuruAPI'), 'HQ.GuruAPI (real)');
  check(isFn(HQ,'GuruAPI.getKuisList'), 'HQ.GuruAPI.getKuisList (real)');
  check(isFn(HQ,'GuruAPI.getPenilaianHafalan'), 'HQ.GuruAPI.getPenilaianHafalan (via fill, dedup)');
  check(!isFn(HQ,'MuridAPI.getRincianRaport'), 'staff: HQ.MuridAPI.getRincianRaport absen (murid-only)');
  check(isObj(HQ,'AdminAPI'), 'HQ.AdminAPI (real)');
  check(isFn(HQ,'AdminAPI.getDashboard'), 'HQ.AdminAPI.getDashboard (real)');
  check(isFn(HQ,'AdminAPI.getPushConfig'), 'HQ.AdminAPI.getPushConfig (via fill, dedup)');
  check(HQ.SuperAdminAPI === HQ.AdminAPI, 'HQ.SuperAdminAPI === AdminAPI');
  check(isFn(HQ,'MuridAPI.getLatihanUploadToken'), 'HQ.MuridAPI.getLatihanUploadToken (boundary stub utk guru)');
  check(!isFn(HQ,'MuridAPI.getRincianRaport'), 'HQ.MuridAPI.getRincianRaport TIDAK ada di staff (murid-only)');
  check(isFn(HQ,'QuizAPI.getKuisList'), 'HQ.QuizAPI.getKuisList (guru facade)');
  check(isFn(HQ,'QuizAPI.getKuisTersedia'), 'HQ.QuizAPI.getKuisTersedia (facade ada; body ref HQ.MuridAPI)');
  check(isFn(HQ,'PushAPI.isSupported'), 'HQ.PushAPI.isSupported');
  check(typeof r.ctx._clearHQCache === 'function', 'window._clearHQCache terpasang');
} else bad++;

console.log('\n' + (bad ? `FAILED: ${bad} problem(s)` : 'ALL SIMULATION CHECKS PASSED'));
process.exit(bad ? 1 : 0);
