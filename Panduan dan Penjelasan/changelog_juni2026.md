# Changelog & Penjelasan Teknis — Juni 2026

Dokumen ini merangkum semua perubahan signifikan yang dilakukan pada bulan Juni 2026,
termasuk arsitektur fitur raport, bug fix, dan catatan teknis untuk developer.

---

## Ringkasan Perubahan

| Tanggal | Kategori | Perubahan |
|---------|----------|-----------|
| Jun 2026 | **Feature** | Halaman Raport Halaqah di portal guru |
| Jun 2026 | **Feature** | `Code_raport.gs` — GAS backend raport guru |
| Jun 2026 | **Feature** | Observasi KBM — sorting & grouping (Perlu Tindakan vs Selesai) |
| Jun 2026 | **Fix** | Nilai raport = 0 karena halaqah tidak terhubung ke periode |
| Jun 2026 | **Fix** | Nilai adab/kamera terbawa ke sesi KBM berikutnya |
| Jun 2026 | **Fix** | Route duplikat `getTemplateKoreksi` di `Code.gs` |
| Jun 2026 | **Data** | Update `setup_dummy_data.gs` dengan data raport yang konsisten |

---

## 1. Fitur Baru: Raport Halaqah (Portal Guru)

### Apa yang berubah
Sebelumnya, generate dan publish raport hanya bisa dilakukan admin. Dengan 300 murid, ini menjadi bottleneck.

Sekarang, **guru halaqah dapat langsung**:
1. Mengisi nilai manual (UAS, Micro Teaching) untuk muridnya
2. Menulis catatan wali halaqah
3. Generate raport semua murid halaqahnya
4. Preview tabel nilai (dengan warna per-komponen)
5. Publish semua raport ke murid (dengan konfirmasi + alert double-check)

### File yang ditambahkan/diubah
- **Baru**: `Google Apps Script/Code_raport.gs`
- **Diubah**: `Google Apps Script/Code.gs` — 5 route baru
- **Diubah**: `assets/js/api.js` — 5 method baru di `GuruAPI`
- **Diubah**: `guru/index.html` — page `page-raport` + sidebar nav + JS functions

### Fungsi GAS baru (`Code_raport.gs`)

| Fungsi | Akses | Keterangan |
|--------|-------|-----------|
| `_buildRaportMurid(idMurid, idPeriode)` | Internal | Core kalkulasi raport satu murid |
| `generateRaportHalaqahGuru(data, user)` | Guru | Generate semua murid halaqah guru |
| `getRaportListGuru(params, user)` | Guru | List raport + detail komponen |
| `publishAllRaportHalaqahGuru(data, user)` | Guru | Publish semua draft di halaqah |
| `getCatatanHalaqah(params, user)` | Guru | Ambil catatan halaqah |
| `saveCatatanHalaqahGuru(data, user)` | Guru | Simpan catatan halaqah |

### Route baru di `Code.gs`
```
GET:  getRaportListGuru      → routeGuru
GET:  getCatatanHalaqah      → routeGuru
POST: generateRaportHalaqahGuru   → routeGuru
POST: publishAllRaportHalaqahGuru → routeGuru
POST: saveCatatanHalaqahGuru      → routeGuru
```

### Method baru di `GuruAPI` (`api.js`)
```javascript
getRaportListGuru(id_h, id_p)     // list raport per halaqah+periode
getCatatanHalaqah(id_h)           // ambil catatan halaqah
generateRaportHalaqah(d)          // generate raport
publishAllRaportHalaqah(d)        // publish semua
saveCatatanHalaqah(d)             // simpan catatan
```

---

## 2. Fix: Nilai Raport = 0 (Root Cause & Solusi)

### Root Cause
Fungsi `generateRaportMurid` di `Code-Admin.txt` memfilter halaqah dengan:
```javascript
const halaqahInPeriode = halaqah.filter(h => h.id_periode === data.id_periode)
```
Jika kolom `id_periode` di sheet `Halaqah` kosong atau tidak cocok → `halaqahInPeriode` kosong → `nilaiKBM` kosong → semua komponen otomatis = 0.

### Solusi di `_buildRaportMurid`
```javascript
// Fallback: jika tidak ada halaqah ber-id_periode,
// gunakan halaqah murid yang bersangkutan
if (!halaqahIds.length && anggota.id_halaqah) {
  halaqahIds = [String(anggota.id_halaqah).trim()];
}
```

### Tindakan yang diperlukan di sheet
Pastikan setiap halaqah aktif memiliki `id_periode` yang sesuai dengan ID periode aktif (contoh: `P2026-1`).

---

## 3. Fix: Nilai Adab/Kamera Terbawa ke Sesi Baru

### Root Cause
`_nilaiCache` disimpan di JavaScript memory dan **tidak dibersihkan** di dua path penutupan sesi:
- `konfirmasiTutup()` — guru tutup sesi tanpa mengisi jurnal
- `hapusKBM()` — guru batalkan sesi

Sehingga saat guru membuka sesi baru di halaman yang sama (tanpa refresh), nilai lama muncul di Step 3 (Nilai).

### Solusi
Tambah `window._nilaiCache = {}` di tiga titik:
1. `konfirmasiTutup()` — after `sesiAktif = null`
2. `hapusKBM()` — after `muridSesi = []`
3. `bukaKBM()` success — sebelum sesi baru diproses (defense in depth)

---

## 4. Fix: Observasi KBM — Tampilan Berantakan

### Root Cause
Backend mengirim 20 sesi tanpa prioritas. Frontend merender semua tanpa sorting atau grouping.

### Solusi
Di `renderKetuaObsList()`:
- **Sort** by `pertemuan_ke` descending (numerik, konsisten saat tanggal sama)
- **Group 1 — "Perlu Tindakan"**: `window_status === 'terbuka'` ATAU (`selesai` AND rekap belum dikirim)
- **Group 2 — "Selesai"**: tersembunyi default, toggle chevron ▸ untuk expand

---

## 5. Fix: Route Duplikat `getTemplateKoreksi`

### Masalah
Di `Code.gs`, case `getTemplateKoreksi` muncul dua kali di switch `doGet()`:
- Line 106 (blok Admin)
- Line 115 (blok Guru) — **unreachable**, tidak pernah dieksekusi

### Solusi
Hapus baris duplikat di blok Guru. Case pertama (line 106) sudah cukup — fungsi ini tidak memerlukan otentikasi role.

---

## 6. Update Data Dummy (`setup_dummy_data.gs`)

### Perubahan
1. **Konstanta `KMP`**: ID komponen yang konsisten antara `seedKomponenRaport` dan `seedNilaiManual`
2. **`seedKomponenRaport()`**: 5 komponen sesuai raport aktual (hapus At-Tibyan), bobot benar (40/20/10/15/15)
3. **`seedNilaiManual()`**: Pakai `KMP.UAS` dan `KMP.MICRO` — sebelumnya pakai ID lama sehingga nilai manual = 0
4. **`seedCatatanRaport()`**: Baru — seed catatan per halaqah untuk raport
5. **`clearRaportSheet()`**: Baru — bersihkan sheet Raport sebelum testing
6. **`seedAllData()`**: Tambah `seedCatatanRaport()` dan `clearRaportSheet()`

### Cara Testing Raport
```
1. Jalankan seedAllData() di GAS editor
2. Login sebagai NISA (guru halaqah Maryam) di portal guru
3. Buka menu Raport Halaqah
4. Pilih Semester 1 2026 + Maryam
5. Nilai manual sudah terisi dari seed
6. Generate Raport → cek preview
7. Publish Semua
8. Login sebagai murid Maryam → cek raport muncul
```

---

## 7. Arsitektur Raport — Komponen & Cara Hitung

### Keyword Deteksi Otomatis

Nama komponen menentukan cara hitungnya. Sistem mencocokkan nama komponen (lowercase) dengan keyword:

```
"kehadiran" (tanpa "tibyan") → % skor hadir / total sesi
  H=1.0, T=0.7, I=0.5, A=0.0

"kbm" atau "harian" → rata-rata per sesi
  score_sesi = adab×70% + kamera×30%
  adab: Baik=100, Butuh Perhatian=50
  kamera: terbuka=100, sering tertutup=50, selalu tertutup=0

"adab" → % sesi dengan adab="Baik" dari sesi hadir

"kamera" → rata-rata score kamera dari sesi hadir

"tibyan" atau "at-tibyan" → % hadir At-Tibyan dari total sesi selesai

tipe manual → ambil dari sheet Nilai_Manual
```

### Bonus Perfect Attendance
Jika murid tidak pernah Alpa sepanjang semester, nilai akhir ditambah `bonus_perfect_attendance` (default 5 poin, max 100).

### Predikat
```
≥ 90  → Mumtaz
≥ 80  → Jayyid Jiddan
≥ 70  → Jayyid
< 70  → Maqbul
= 0   → Belum Ada Data (jika total sesi = 0)
```

---

## 8. Struktur Sheet Raport

Sheet `Raport` di Google Spreadsheet:

| Kolom | Keterangan |
|-------|-----------|
| `id_raport` | ID unik (RPT-YYYYMMDD-XXXX) |
| `id_murid` | Referensi ke sheet Users |
| `id_periode` | Referensi ke sheet Periode |
| `id_halaqah` | Referensi ke sheet Halaqah |
| `nilai_akhir` | Nilai total berbobot (0-100) |
| `predikat` | Mumtaz / Jayyid Jiddan / Jayyid / Maqbul |
| `detail_json` | Array komponen nilai dalam format JSON |
| `tanggal_cetak` | Tanggal generate terakhir (yyyy-MM-dd) |
| `status` | `draft` / `published` |
| `url_pdf` | Kosong (fitur email pakai HTML, bukan PDF) |

Sheet `Catatan_Raport`:

| Kolom | Keterangan |
|-------|-----------|
| `id_halaqah` | ID halaqah |
| `nama_halaqah` | Nama halaqah |
| `catatan` | Catatan wali halaqah — tampil di semua raport murid halaqah ini |

---

## 9. Catatan Deployment

### GAS Files yang perlu di-deploy
Setelah setiap perubahan pada file GAS, wajib:
1. Copy isi file baru/diubah ke GAS Editor
2. Klik **Deploy → Manage deployments**
3. Klik **Edit (pensil)** pada deployment aktif
4. Pilih **"New version"** (bukan Create new deployment)
5. Klik **Deploy**

File GAS yang perlu di-deploy untuk fitur Juni 2026:
- `Code.gs` — route baru raport guru + fix duplikat getTemplateKoreksi
- `Code_raport.gs` — **file baru**, tambahkan sebagai file terpisah di GAS editor

### Cache SW
Setiap perubahan `api.js` atau JS lainnya, bump cache version di `sw.js`:
```javascript
const CACHE_NAME = 'halaqah-v4.X'; // increment X
```
Browser akan reload semua file setelah SW update.

---

*Dokumen ini diperbarui Juni 2026 oleh tim developer Rattililqur'an.*
