# tools/ — Utilitas build ringan

## version-assets.js — Cache-busting otomatis (content hash)

Mengganti nilai `?v=...` pada rujukan `.js`/`.css` lokal di `admin/index.html`,
`guru/index.html`, `murid/index.html` dengan **hash isi file** (sha256, 8 hex).

**Kenapa:** dulu tiap `<script src="x.js?v=1.0.6">` di-bump manual — mudah lupa
(mis. `supabase-client.js` pernah tertinggal di guru: `2.1.16` vs `2.1.19`) dan
angkanya tak mencerminkan isi. Dengan hash isi, versi berubah **hanya** saat file
berubah, tak pernah lupa/over-bust, dan file yang dishare (`supabase-client.js`,
`shared-utils.js`) otomatis dapat hash **identik** di semua portal.

### Pakai
```bash
npm run version:assets   # tulis hash terbaru ke ketiga index.html
npm run version:check    # dry-run; exit 1 bila ada yang out-of-date (buat CI)
```

Aman & idempoten: hanya menyentuh rujukan yang **sudah** punya `?v=`; melewati
(skip + warn) bila file tak ditemukan; menangani juga pemuatan dinamis inline
(`s.src = 'maze-module.js?v=...'`).

### Menambah aset baru
Cukup tulis tag dengan `?v=x` placeholder apa pun (mis. `?v=0`), lalu jalankan
`npm run version:assets` — placeholder diganti hash asli. File HTML baru? tambahkan
ke array `HTML_FILES` di `version-assets.js`.

## hooks/pre-commit — Jalankan versioning otomatis saat commit

Agar tak perlu ingat menjalankan skrip. Bila commit menyentuh `.js/.css/index.html`,
hook menjalankan `version-assets.js` lalu re-stage `index.html`. **Defensif:** apa
pun yang gagal → tak memblokir commit.

```bash
# Pasang (sekali per klon repo — hook tidak ikut ter-track otomatis)
cp tools/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

# Copot
rm .git/hooks/pre-commit
```
