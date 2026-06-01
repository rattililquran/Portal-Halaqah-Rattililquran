# Arsitektur Portal Admin — Rattililqur'an

> Dokumentasi teknis lengkap Portal Admin per Juni 2026.

---

## 1. Gambaran Umum

Portal Admin adalah pusat kendali seluruh sistem. Berjalan di atas Google Apps Script backend dengan dua level akses: `admin` (operasional) dan `superadmin` (data sensitif).

### Dua Level Akses

| Role | Akses |
|------|-------|
| `admin` | Semua fitur operasional: users, halaqah, raport, laporan, pengumuman |
| `superadmin` | Semua fitur admin + Observasi Guru + Audit Log + Assign Ketua Kelas |

**Route guard di GAS:**
```javascript
function routeAdmin(user, fn) {
  // admin + superadmin
  if (!['admin','superadmin'].includes(user.role)) return error(403);
  return jsonResponse(fn());
}
function routeSuperAdmin(user, fn) {
  // hanya superadmin
  if (user.role !== 'superadmin') return error(403);
  return jsonResponse(fn());
}
```

**Cara buat superadmin:** Sheet `Users` → kolom `role` → isi `superadmin`.

---

## 2. Menu dan Fitur

| Menu | Fungsi | Akses |
|------|--------|-------|
| Dashboard | Statistik global | Admin + Superadmin |
| Periode/Semester | Create/Update/Activate periode | Admin + Superadmin |
| Users | CRUD guru dan murid — NIS otomatis | Admin + Superadmin |
| Halaqah | CRUD halaqah — assign guru, jadwal, level | Admin + Superadmin |
| Anggota | Kelola murid per halaqah + **Assign Ketua Kelas** | Admin (tanpa ketua) / Superadmin (dengan ketua) |
| Komponen Raport | Setup komponen nilai per periode | Admin + Superadmin |
| Nilai Manual | Entry nilai UAS, Micro Teaching, dll | Admin + Superadmin |
| Raport | Generate + publish raport | Admin + Superadmin |
| Laporan Global | Rekap kehadiran dan nilai lintas halaqah | Admin + Superadmin |
| Rekap Absensi | Export ke Google Sheets | Admin + Superadmin |
| Pengumuman | Broadcast ke guru/murid | Admin + Superadmin |
| Arsip Data | Pindah data lama ke spreadsheet terpisah | Admin + Superadmin |
| Level | Master data level tahsin | Admin + Superadmin |
| Template Koreksi | Template chip koreksi untuk guru | Admin + Superadmin |
| **Observasi Guru** | Data rahasia observasi KBM dari ketua kelas | **Superadmin only** |
| **Audit Log** | Rekam jejak aktivitas sistem | **Superadmin only** |

---

## 3. Manajemen Data Master

### NIS Generation
Format otomatis: `RTL{YY}{MM}{NNNNN}`
Guru: `GRU-NNN` | Admin: `ADM-NNN`

### Halaqah
- Satu guru bisa pegang banyak halaqah
- Halaqah harus diasosiasikan ke `id_periode` untuk filter raport yang benar

### Periode
- Hanya satu periode `aktif` sekaligus
- Periode aktif menentukan komponen raport yang berlaku

---

## 4. Sistem Raport

### Alur Generate

```
Admin pilih murid + periode → generateRaportMurid()
    ↓
Baca kbmPeriode: id_kbm dari KBM_Log yang selesai + halaqah di periode ini
    ↓
Baca nilaiKBM: filter by id_murid + halaqahInPeriode + kbmPeriode
    ↓
Per komponen (Komponen_Raport):
  tipe = otomatis → keyword detection dari nama_komponen
  tipe = manual   → ambil dari Nilai_Manual
    ↓
nilai_komponen = nilai_angka x bobot / 100
nilai_akhir = sigma semua nilai_komponen
    ↓
Bonus Perfect Attendance: +N jika 0 Alpa (max 100)
Jika total sesi = 0 → predikat = 'Belum Ada Data'
    ↓
Tentukan predikat → simpan ke sheet Raport
```

### Keyword Detection — Komponen Otomatis

| Keyword di nama_komponen | Sumber | Formula |
|--------------------------|--------|---------|
| `kehadiran` (tanpa `tibyan`) | Nilai_KBM | `skor_hadir / total_sesi x 100` (H=1.0, T=0.7, I=0.5, A=0) |
| `kbm` atau `harian` | Nilai_KBM | Rata-rata `(adab x 70% + kamera x 30%)` per sesi hadir |
| `adab` | Nilai_KBM | `% sesi Baik / total sesi hadir` |
| `kamera` | Nilai_KBM | Rata-rata score: terbuka=100, sering=50, selalu=0 |
| `latihan` / `pr` / `mandiri` | KBM_Log | 80 jika ada PR, else 0 |
| `tibyan` / `at-tibyan` | At-Tibyan_Log | `hadir_at / total_sesi_at x 100` |

### Konfigurasi Komponen (per Juni 2026)

| Komponen | Bobot | Tipe |
|----------|-------|------|
| Nilai KBM Harian | 30% | otomatis |
| Kehadiran | 20% | otomatis |
| Adab dan Kamera | 10% | otomatis |
| Micro Teaching | 10% | manual |
| UAS | 20% | manual |
| Kehadiran At-Tibyan | 10% | otomatis |
| **Total** | **100%** | |

### Predikat (threshold dari Konfigurasi_Raport)

| Key | Default | Predikat |
|-----|---------|---------|
| `grade_mumtaz` | 90 | Mumtaz |
| `grade_jayyid_jiddan` | 80 | Jayyid Jiddan |
| `grade_jayyid` | 70 | Jayyid |
| < grade_jayyid | — | Maqbul |
| total sesi = 0 | — | Belum Ada Data |

### Konfigurasi Dinamis (Konfigurasi_Raport sheet)

| Key | Default | Keterangan |
|-----|---------|-----------|
| `grade_mumtaz` | 90 | Nilai min Mumtaz |
| `grade_jayyid_jiddan` | 80 | Nilai min Jayyid Jiddan |
| `grade_jayyid` | 70 | Nilai min Jayyid |
| `bobot_adab` | 70 | Bobot adab dalam KBM Harian |
| `bobot_kamera` | 30 | Bobot kamera dalam KBM Harian |
| `bonus_perfect_attendance` | 5 | Bonus poin jika 0 Alpa |
| `nama_lembaga` | Rattililqur'an | Nama di header raport |
| `ttd_nama` | Tim Akademik | Nama penanda tangan |
| `kota_terbit` | Jakarta | Kota tanggal cetak |

### Bug Fix generateRaportMurid

Perbaikan penting yang sudah diterapkan:

1. **Filter periode KBM**: `nilaiKBM` difilter by `kbmPeriode` (id_kbm selesai di halaqah periode ini) — mencegah nilai KBM dari periode lain masuk raport
2. **Type-safe comparison**: semua `id_murid`, `id_periode`, `id_halaqah` pakai `String().trim()`
3. **Zero sesi**: jika `totalSesi === 0` → predikat `'Belum Ada Data'`
4. **Batch update type mismatch**: `saveNilaiManualBatch` pakai `String().trim()` di semua sisi

---

## 5. Bug Fix getLaporanGlobal

```javascript
// Filter yang benar: cek id_periode halaqah, bukan double-check id_halaqah
const halaqahMatchesPeriode = !id_periode ||
  String(h.id_periode || '').trim() === String(id_periode).trim();
const kbmHalaqah = halaqahMatchesPeriode ? kbmLog.filter(...) : [];
const kbmIds = new Set(kbmHalaqah.map(k => k.id_kbm));
// Nilai hanya dari KBM di periode ini
const nilaiHalaqah = nilaiKBM.filter(n => kbmIds.has(n.id_kbm));
```

---

## 6. publishRaport — Proteksi Double Publish

```javascript
// Validasi sebelum publish
const raport = raportList.find(r => r.id_raport === data.id_raport);
if (!raport) return error('Raport tidak ditemukan');
if (raport.status === 'published') return error('Raport sudah dipublikasikan');
// Lanjut update...
```

---

## 7. Observasi Guru & Assign Ketua (Superadmin)

Data observasi KBM dari ketua kelas. Admin biasa tidak bisa akses.

### Alur Data
```
Ketua kelas isi form observasi di portal murid
    -> sheet Observasi_KBM
    -> Superadmin baca via getObservasiKBM / getObservasiStats
```

### Assign Ketua Kelas
- Superadmin klik tombol "Jadikan Ketua" di tabel Anggota
- `assignKetuaKelas()` otomatis cabut ketua lama di halaqah yang sama
- Sheet: `Anggota` kolom `is_ketua` = `TRUE`

### GAS Endpoints Superadmin
```
getObservasiKBM    -> routeSuperAdmin -> getObservasiKBM(params)
getObservasiStats  -> routeSuperAdmin -> getObservasiStats(params)
getAuditLog        -> routeSuperAdmin -> getAuditLog()
assignKetuaKelas   -> routeSuperAdmin -> assignKetuaKelas(data)
```

---

## 8. GAS Endpoints Admin

### Read
```
getDashboardAdmin, getAllPeriode, getAllUsers, getAllHalaqah, getAllAnggota
getKomponenRaport, getNilaiManual, getRaportList, getAllPengumuman
getRekapAbsensi, getLaporanGlobal, getAuditLog
```

### Write
```
createUser/updateUser/deleteUser
createHalaqah/updateHalaqah/deleteHalaqah
createPeriode/updatePeriode
updateAnggota
saveKomponenRaport
simpanNilaiManual / saveNilaiManualBatch
generateRaportMurid / generateRaportBulk / generateRaportByHalaqah / generateRaportByLevel
publishRaport
kirimRaportEmail
kirimPengumuman
```

---

## 8. Google Sheets Structure

### Sheet Master
| Sheet | Kolom Kunci |
|-------|------------|
| `Users` | id_user, nama_lengkap, role, password, no_hp, status |
| `Halaqah` | id_halaqah, nama_halaqah, id_guru, id_periode, jadwal_hari, level, status |
| `Anggota` | id_anggota, id_murid, id_halaqah, level, target_level, total_hadir, status |
| `Level` | id_level, nama_level, deskripsi |
| `Periode` | id_periode, nama_periode, tanggal_mulai, tanggal_selesai, status |

### Sheet KBM
| Sheet | Kolom Kunci |
|-------|------------|
| `KBM_Log` | id_kbm, id_guru, id_halaqah, pertemuan_ke, jenis_sesi, status (draft/selesai), latihan_mandiri |
| `Nilai_KBM` | id_kbm, id_murid, id_halaqah, jenis_sesi, status_hadir, adab, kamera_murid, koreksi_tahsin |

### Sheet At-Tibyan
| Sheet | Kolom Kunci |
|-------|------------|
| `At-Tibyan_Sesi` | id_sesi, pertemuan_ke, tanggal, total_hadir, total_murid, status |
| `At-Tibyan_Log` | id_sesi, id_murid, id_halaqah, level, status_hadir |

### Sheet Raport
| Sheet | Kolom Kunci |
|-------|------------|
| `Komponen_Raport` | id_komponen, id_periode, nama_komponen, bobot, tipe, urutan, status |
| `Nilai_Manual` | id_murid, id_komponen, id_periode, nilai |
| `Konfigurasi_Raport` | key, value (parameter dinamis) |
| `Raport` | id_raport, id_murid, id_periode, nilai_akhir, predikat, detail_json, status |
| `Catatan_Raport` | id_halaqah, catatan (ditampilkan di raport murid) |

### Sheet Lainnya
| Sheet | Fungsi |
|-------|--------|
| `Pengumuman` | Broadcast dari admin/guru |
| `Template_Koreksi` | Template chip koreksi tahsin |
| `Audit_Log` | Log semua aksi penting |
| `Assessment_Items` | Item penilaian mandiri Level 1 & 2 |
| `Keaktifan_Followup` | Tracking tindak lanjut guru per murid |
| `at-tibyan` | Konten materi kajian At-Tibyan (dibaca portal murid) |

**Spreadsheet ID:** `19Lbdtdt3cjTsWzwYw6bhyVWCCFzSsF2x7r-Unk7-Ks0`

---

*Dokumentasi per Juni 2026.*
