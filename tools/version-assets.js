#!/usr/bin/env node
/*
 * version-assets.js — Cache-busting berbasis CONTENT HASH (otomatis).
 *
 * MASALAH yang diselesaikan:
 *   Selama ini tiap tag <script src="x.js?v=1.0.6"> di-bump manual. Mudah lupa
 *   (mis. supabase-client.js pernah tertinggal di guru: 2.1.16 vs 2.1.19),
 *   dan versinya "berbohong" (angka tak mencerminkan isi file).
 *
 * CARA KERJA:
 *   Untuk setiap file HTML yang terdaftar, cari SEMUA rujukan file lokal .js/.css
 *   yang SUDAH memakai `?v=...` (baik di atribut `src=`/`href=` MAUPUN di JS
 *   inline seperti `s.src = 'maze-module.js?v=maze21'`), resolusikan path relatif
 *   terhadap folder HTML-nya, hitung hash isi file (sha256, 8 hex pertama), lalu
 *   ganti nilai `?v=` dengan hash tsb. Hash berubah HANYA saat isi file berubah
 *   -> mustahil lupa, tak pernah over/under-bust, dan file yang dishare (mis.
 *   supabase-client.js) otomatis dapat hash IDENTIK di semua portal.
 *
 * AMAN:
 *   - Hanya menyentuh rujukan yang SUDAH punya `?v=` (blast radius = tag yang ada).
 *   - Melewati (skip + warn) bila file tak ditemukan — tak pernah merusak markup.
 *   - Idempoten: jalankan berkali-kali, hasil sama bila isi tak berubah.
 *
 * PAKAI:
 *   node tools/version-assets.js          # tulis perubahan
 *   node tools/version-assets.js --check   # dry-run: exit 1 bila ada yang out-of-date
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'admin/index.html', 'guru/index.html', 'murid/index.html'];

// Cocokkan: <path>.js|css ?v=<versi>. Path tak boleh mengandung kutip/spasi/tanda-tanya.
const REF_RE = /([A-Za-z0-9_./-]+\.(?:js|css))\?v=([A-Za-z0-9._-]+)/g;

const checkOnly = process.argv.includes('--check');
const hashCache = new Map();

function hashFile(absPath) {
  if (hashCache.has(absPath)) return hashCache.get(absPath);
  const buf = fs.readFileSync(absPath);
  const h = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  hashCache.set(absPath, h);
  return h;
}

let totalChanged = 0;
let totalRefs = 0;
let totalSkipped = 0;
const changes = [];

for (const rel of HTML_FILES) {
  const htmlAbs = path.join(ROOT, rel);
  if (!fs.existsSync(htmlAbs)) { console.warn('  ! HTML tak ada: ' + rel); continue; }
  const htmlDir = path.dirname(htmlAbs);
  const src = fs.readFileSync(htmlAbs, 'utf8');

  const out = src.replace(REF_RE, function (match, refPath, oldVer) {
    totalRefs++;
    const assetAbs = path.resolve(htmlDir, refPath);
    if (!fs.existsSync(assetAbs)) {
      totalSkipped++;
      console.warn('  ! [' + rel + '] file tak ditemukan, dilewati: ' + refPath);
      return match; // jangan sentuh
    }
    const hash = hashFile(assetAbs);
    if (hash === oldVer) return match; // sudah mutakhir
    totalChanged++;
    changes.push('  ~ [' + rel + '] ' + refPath + '  ' + oldVer + ' -> ' + hash);
    return refPath + '?v=' + hash;
  });

  if (out !== src) {
    if (!checkOnly) fs.writeFileSync(htmlAbs, out);
  }
}

console.log('version-assets: ' + totalRefs + ' rujukan diperiksa, '
  + totalChanged + ' diperbarui, ' + totalSkipped + ' dilewati.');
if (changes.length) console.log(changes.join('\n'));

if (checkOnly && totalChanged > 0) {
  console.error('\n[--check] Ada aset out-of-date. Jalankan `npm run version` lalu commit ulang.');
  process.exit(1);
}
