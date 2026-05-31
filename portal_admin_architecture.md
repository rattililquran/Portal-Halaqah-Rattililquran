# Arsitektur Portal Admin — Rattililqur'an

> Dokumentasi teknis lengkap Portal Admin untuk pengelolaan sistem halaqah, raport, dan data master.

---

## Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Menu dan Fitur](#menu-dan-fitur)
3. [Manajemen Data Master](#manajemen-data-master)
4. [Sistem Raport](#sistem-raport)
5. [GAS Endpoints Admin](#gas-endpoints-admin)
6. [Google Sheets Structure](#google-sheets-structure)

---

## Gambaran Umum

Portal Admin adalah antarmuka pengelolaan pusat seluruh sistem Rattililqur'an. Diakses oleh admin (role: `admin`) dan berjalan di atas Google Apps Script sebagai backend.

**Teknologi:**
- Frontend: HTML/CSS/JS statis di GitHub Pages
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets

---

## Menu dan Fitur

| Menu | Fungsi |
|------|--------|
| Dashboard | Statistik: total murid, guru, halaqah, KBM bulan ini, % nilai terisi |
| Periode/Semester | Buat & kelola periode aktif (Semester 1, Semester 2, dll) |
| Users | CRUD guru dan murid — generate NIS otomatis |
| Halaqah | CRUD halaqah — assign guru, set jadwal, level |
| Anggota | Kelola murid per halaqah — level, target level, catatan |
| Komponen Raport | Setup komponen nilai per periode (otomatis/manual + bobot) |
| Nilai Manual | Entry nilai manual (UAS, Micro Teaching, dll) |
| Raport | Generate + publish raport — bulk, per halaqah, per level |
| Laporan Global | Rekap absensi & nilai lintas halaqah |
| Pengumuman | Broadcast pengumuman ke guru/murid |
| Level | Master data level tahsin |
| Template Koreksi | Upload template koreksi tahsin untuk guru |

---

## Manajemen Data Master

### Users
- Generate NIS otomatis format `RTL{YY}{MM}{NNNNN}` untuk murid
- Guru: `GRU-NNN`, Admin: `ADM-NNN`
- Soft delete (status: `nonaktif`)

### Halaqah
- Satu guru bisa pegang banyak halaqah
- Jadwal hari + jam (contoh: `Rabu,Jumat` | `15:00-16:30`)
- Status: `aktif` / `nonaktif`

### Periode
- Hanya satu periode yang bisa `aktif` sekaligus
- Periode aktif menentukan komponen raport yang berlaku

---

## Sistem Raport

### Alur Generate Raport

```
Admin pilih murid + periode → generateRaportMurid()
    ↓
Baca Komponen_Raport (aktif, sesuai periode)
    ↓
Per komponen:
  tipe = otomatis → keyword detection dari nama_komponen
  tipe = manual   → ambil dari sheet Nilai_Manual
    ↓
nilai_komponen = nilai_angka × bobot / 100
nilai_akhir = Σ semua nilai_komponen
    ↓
Bonus Perfect Attendance: +5 jika 0 Alpa (max 100)
    ↓
Tentukan predikat → simpan ke sheet Raport
```

### Komponen Otomatis — Keyword Detection

| Keyword di Nama Komponen | Data Sumber | Formula |
|--------------------------|-------------|---------|
| `kehadiran` (tanpa `tibyan`) | Nilai_KBM | `(skor_hadir / total_sesi) × 100` — H=1.0, T=0.7, I=0.5, A=0 |
| `kbm` atau `harian` | Nilai_KBM | Rata-rata `(adab×70% + kamera×30%)` per sesi hadir |
| `adab` | Nilai_KBM | `% sesi Baik / total sesi hadir` |
| `kamera` | Nilai_KBM | Rata-rata score kamera: Terbuka=100, Setengah=50, Tertutup=0 |
| `latihan` / `pr` / `mandiri` | KBM_Log | 80 jika ada PR di periode, else 0 |
| `tibyan` / `at-tibyan` | At-Tibyan_Log | `(hadir_at / total_sesi_at) × 100` |

### Predikat Nilai

Threshold dikonfigurasi di sheet `Konfigurasi_Raport` (key-value):

| Key | Default | Predikat |
|-----|---------|---------|
| `grade_mumtaz` | 90 | Mumtaz |
| `grade_jayyid_jiddan` | 80 | Jayyid Jiddan |
| `grade_jayyid` | 70 | Jayyid |
| < grade_jayyid | — | Maqbul |

### Konfigurasi Dinamis (`Konfigurasi_Raport`)

| Key | Default | Keterangan |
|-----|---------|-----------|
| `grade_mumtaz` | 90 | Batas nilai Mumtaz |
| `grade_jayyid_jiddan` | 80 | Batas Jayyid Jiddan |
| `grade_jayyid` | 70 | Batas Jayyid |
| `bobot_adab` | 70 | Bobot adab dalam KBM Harian |
| `bobot_kamera` | 30 | Bobot kamera dalam KBM Harian |
| `bonus_perfect_attendance` | 5 | Bonus poin jika 0 Alpa |

### Sheet Raport

| Sheet | Kolom Utama | Fungsi |
|-------|-------------|--------|
| `Komponen_Raport` | id_komponen, nama_komponen, bobot, tipe, id_periode, status | Definisi komponen per periode |
| `Nilai_Manual` | id_murid, id_komponen, id_periode, nilai | Entry manual admin/guru |
| `Konfigurasi_Raport` | key, value | Threshold & parameter dinamis |
| `Raport` | id_raport, id_murid, id_periode, nilai_akhir, predikat, detail_json | Output final |
| `Catatan_Raport` | id_murid, id_periode, catatan | Catatan per murid per periode |

---

## GAS Endpoints Admin

### Read (doGet)

```
getDashboardAdmin        — Statistik dashboard
getAllPeriode             — List semua periode
getAllUsers               — List semua user (tanpa password)
getAllHalaqah             — List semua halaqah
getAllAnggota             — List anggota per halaqah
getKomponenRaport        — Komponen raport aktif per periode
getNilaiManual           — Nilai manual per murid/periode
getRaportList            — List raport tergenerate
getAllPengumuman          — List pengumuman
getRekapAbsensi          — Rekap absensi lintas halaqah
getLaporanGlobal         — Laporan nilai global
getAuditLog              — Log aktivitas sistem
```

### Write (doPost)

```
createUser / updateUser / deleteUser
createHalaqah / updateHalaqah / deleteHalaqah
createPeriode / updatePeriode
updateAnggota
saveKomponenRaport
simpanNilaiManual
generateRaportMurid      — Generate raport satu murid
generateRaportBulk       — Generate raport semua murid satu periode
generateRaportByHalaqah  — Generate per halaqah
generateRaportByLevel    — Generate per level
publishRaport            — Publikasikan raport ke murid
kirimRaportEmail         — Kirim raport via email
kirimPengumuman          — Broadcast pengumuman
```

---

## Google Sheets Structure

### Sheet Master

| Sheet | Kolom Kunci |
|-------|------------|
| `Users` | id_user, nama_lengkap, role, password, no_hp, status |
| `Halaqah` | id_halaqah, nama_halaqah, id_guru, jadwal_hari, jam_mulai, level, status |
| `Anggota` | id_anggota, id_murid, id_halaqah, level, target_level, total_hadir, status |
| `Level` | id_level, nama_level, deskripsi |
| `Periode` | id_periode, nama_periode, tanggal_mulai, tanggal_selesai, status |

### Sheet KBM

| Sheet | Kolom Kunci |
|-------|------------|
| `KBM_Log` | id_kbm, id_guru, id_halaqah, tanggal_pertemuan, jenis_sesi, pertemuan_ke, status (draft/selesai), pencapaian_modul, latihan_mandiri, deadline_latihan |
| `Nilai_KBM` | id_nilai, id_kbm, id_murid, id_halaqah, jenis_sesi, status_hadir (H/T/I/A), adab, kamera_murid, nilai, koreksi_tahsin |

### Sheet At-Tibyan

| Sheet | Kolom Kunci |
|-------|------------|
| `At-Tibyan_Sesi` | id_sesi, pertemuan_ke, tanggal, id_guru, total_hadir, total_murid, status |
| `At-Tibyan_Log` | id_log, id_sesi, pertemuan_ke, tanggal, id_murid, nama_murid, id_halaqah, level, status_hadir |

### Sheet Lainnya

| Sheet | Fungsi |
|-------|--------|
| `Pengumuman` | Broadcast dari admin/guru ke murid |
| `Template_Koreksi` | Template koreksi tahsin yang dipakai guru |
| `Audit_Log` | Log semua aksi penting di sistem |
| `Assessment_Items` | Item penilaian diri murid Level 1 & 2 |
| `Keaktifan_Followup` | Catatan tindak lanjut murid yang kurang aktif |

**Spreadsheet ID:** `19Lbdtdt3cjTsWzwYw6bhyVWCCFzSsF2x7r-Unk7-Ks0`

---

*Dokumentasi ini mencerminkan kondisi sistem per Juni 2026. Update seiring penambahan fitur.*
