# Panduan Portal Admin — Rattililqur'an

> Panduan lengkap untuk Admin dan Super Admin Portal Rattililqur'an.
> Diperbarui Juni 2026 — mencakup perubahan alur raport: guru halaqah dapat generate & publish raport sendiri.

---

## Daftar Isi

1. [Login & Dua Level Akses](#1-login--dua-level-akses)
2. [Dashboard](#2-dashboard)
3. [Manajemen Periode](#3-manajemen-periode)
4. [Manajemen User](#4-manajemen-user)
5. [Manajemen Halaqah](#5-manajemen-halaqah)
6. [Anggota Kelas & Ketua Kelas](#6-anggota-kelas--ketua-kelas)
7. [Komponen Raport](#7-komponen-raport)
8. [Input Nilai Manual (Admin)](#8-input-nilai-manual-admin)
9. [Alur Raport — Pembagian Tugas Guru & Admin](#9-alur-raport--pembagian-tugas-guru--admin)
10. [Generate & Publish Raport (Admin)](#10-generate--publish-raport-admin)
11. [Laporan Global](#11-laporan-global)
12. [Rekap Absensi](#12-rekap-absensi)
13. [Pengumuman](#13-pengumuman)
14. [Observasi Guru (Superadmin)](#14-observasi-guru-superadmin)
15. [Audit Log (Superadmin)](#15-audit-log-superadmin)
16. [Arsip Data](#16-arsip-data)
17. [Manajemen Level & Template Koreksi](#17-manajemen-level--template-koreksi)

---

## 1. Login & Dua Level Akses

### Dua Role Admin

| Role | Siapa | Akses |
|------|-------|-------|
| `admin` | Staf operasional / operator | Semua menu kecuali Observasi Guru, Audit Log, Assign Ketua |
| `superadmin` | Koordinator akademik / pimpinan | Semua menu termasuk data sensitif |

### Login
1. Buka portal admin melalui tautan yang diberikan
2. Masukkan **ID Admin** di kolom pertama
3. Masukkan **Password** di kolom kedua
4. Klik **Masuk sebagai Admin**

> ⚠️ Jika muncul "Akun ini bukan Admin", pastikan role di sheet Users adalah `admin` atau `superadmin`.

### Cara Membuat Akun Superadmin
Buka Google Sheets → sheet `Users` → cari baris akun → ubah kolom `role` dari `admin` menjadi `superadmin` → save.

---

## 2. Dashboard

Ringkasan statistik global sistem:
- Total Murid, Guru, Halaqah aktif
- KBM bulan ini
- % nilai terisi oleh guru
- Daftar halaqah aktif dengan info guru dan jumlah murid

---

## 3. Manajemen Periode

Periode adalah semester/tahun ajaran. Hanya satu periode yang bisa aktif sekaligus.

### Buat Periode Baru
1. Klik **+ Periode Baru**
2. Isi nama periode (contoh: "Semester 1 2026")
3. Isi tanggal mulai dan selesai
4. Pilih status: `nonaktif` (default) atau `aktif`
5. Klik **Simpan**

### Aktifkan Periode
Klik **Aktifkan** pada periode yang ingin digunakan. Periode lain otomatis dinonaktifkan.

> ⚠️ Komponen Raport, Nilai Manual, dan Generate Raport semuanya terikat pada periode. Pastikan periode sudah benar sebelum guru mulai generate raport.

---

## 4. Manajemen User

### Tab Guru / Murid / Semua
Filter tampilan berdasarkan role.

### Tambah User
1. Klik **+ Tambah User**
2. Pilih Role: `guru` atau `murid`
3. Isi nama lengkap, no HP, email (opsional)
4. **NIS murid** digenerate otomatis format `RTL{YY}{MM}{NNNNN}`
5. **ID guru**: format `GRU-NNN` (auto)
6. Klik **Simpan**

### Edit User
Klik **✏️ Edit** → ubah nama, no HP, email, atau status → Simpan.

### Nonaktifkan User
Klik **🗑 Hapus** → konfirmasi → status berubah jadi `nonaktif` (soft delete, data tetap ada).

### Reset Password
Cari user → Edit → isi field password baru → Simpan.

---

## 5. Manajemen Halaqah

### Tambah Halaqah
1. Klik **+ Tambah Halaqah**
2. Isi nama halaqah, pilih guru, level, jadwal, jam, lokasi
3. **Pilih Periode** — wajib dikaitkan agar data KBM murid terbaca saat generate raport
4. Klik **Simpan**

> ⚠️ **Penting:** Halaqah yang tidak memiliki `id_periode` terhubung ke periode aktif akan menghasilkan nilai raport = 0 (data KBM tidak terfilter). Pastikan setiap halaqah aktif sudah dikaitkan ke periode yang tepat.

> 💡 Satu guru bisa mengampu lebih dari satu halaqah. Setiap halaqah bisa dikaitkan ke periode berbeda untuk keperluan historis.

### Edit & Nonaktifkan
Klik **✏️** untuk edit, klik **🗑** untuk nonaktifkan halaqah.

---

## 6. Anggota Kelas & Ketua Kelas

### Tambah Murid ke Halaqah
1. Pilih halaqah dari dropdown
2. Klik **+ Tambah Murid**
3. Pilih murid dari daftar
4. Isi level dan target level
5. Klik **Simpan**

### Edit Level Murid
Di tabel anggota → klik **✏️ Level** → ubah level dan target level → Simpan.

### Hapus dari Halaqah
Klik **🗑** di baris murid → konfirmasi → murid dikeluarkan dari halaqah.

---

### Assign Ketua Kelas *(Superadmin)*

Ketua kelas memiliki akses khusus di portal murid untuk memantau anggota dan mengisi observasi guru.

1. Pilih halaqah → lihat tabel anggota
2. Cari murid yang akan dijadikan ketua
3. Klik tombol **Jadikan Ketua** (hanya muncul untuk superadmin)
4. Konfirmasi → murid ditunjuk sebagai ketua

> 💡 Jika ada ketua lama, status ketua lama otomatis dicabut. Untuk mencabut tanpa mengganti: klik tombol **👑 Ketua** pada murid yang sedang menjabat → konfirmasi pencabutan.

---

## 7. Komponen Raport

Komponen raport menentukan bagaimana nilai akhir murid dihitung. **Total bobot semua komponen harus = 100%.**

### Tambah Komponen
1. Pilih periode
2. Klik **+ Tambah Komponen**
3. Isi nama komponen — **nama menentukan cara hitung otomatis** (lihat tabel keyword di bawah)
4. Pilih tipe: `otomatis` atau `manual`
5. Isi bobot (%)
6. Simpan

### Keyword Deteksi Otomatis

| Keyword dalam Nama | Sumber Data | Cara Hitung |
|--------------------|-------------|------------|
| `kehadiran` (tanpa `tibyan`) | KBM Reguler | Skor hadir / total sesi × 100 |
| `kbm` atau `harian` | KBM Reguler | Rata-rata per sesi: adab×70% + kamera×30% |
| `adab` | KBM Reguler | % sesi dengan adab = "Baik" |
| `kamera` | KBM Reguler | Rata-rata score kamera |
| `tibyan` atau `at-tibyan` | At-Tibyan_Log | % hadir At-Tibyan dari total sesi selesai |
| Tipe `manual` | Nilai_Manual | Diisi guru/admin per murid |

### Contoh Konfigurasi Aktif (Semester 1 2026)

| # | Nama | Bobot | Tipe |
|---|------|-------|------|
| 1 | Nilai KBM Harian | 40% | otomatis |
| 2 | Kehadiran | 20% | otomatis |
| 3 | Adab | 10% | otomatis |
| 4 | Micro Teaching | 15% | manual |
| 5 | UAS | 15% | manual |
| | **Total** | **100%** | |

### Konfigurasi Threshold (sheet `Konfigurasi_Raport`)

| Key | Default | Keterangan |
|-----|---------|-----------|
| `grade_mumtaz` | 90 | Nilai minimum Mumtaz |
| `grade_jayyid_jiddan` | 80 | Nilai minimum Jayyid Jiddan |
| `grade_jayyid` | 70 | Nilai minimum Jayyid |
| `bobot_adab` | 70 | Bobot adab dalam KBM Harian (%) |
| `bobot_kamera` | 30 | Bobot kamera dalam KBM Harian (%) |
| `bonus_perfect_attendance` | 5 | Poin bonus jika 0 Alpa seluruh semester |

> ⚠️ Ubah sheet `Konfigurasi_Raport` secara langsung di Google Sheets. Perubahan langsung berlaku di generate berikutnya.

---

## 8. Input Nilai Manual (Admin)

Untuk komponen bertipe `manual` (UAS, Micro Teaching) yang dikelola admin:

1. Pilih **Periode** → sistem memuat komponen manual yang aktif
2. Pilih **Halaqah**
3. Tabel murid muncul — isi nilai (0–100) per murid per komponen
4. Klik **Simpan Semua**

> 💡 Sejak Juni 2026, **guru halaqah juga bisa mengisi nilai manual** langsung dari portal mereka (menu Nilai Manual atau menu Raport Halaqah). Admin tidak perlu input semua nilai jika sudah didelegasikan ke guru.

---

## 9. Alur Raport — Pembagian Tugas Guru & Admin

Sejak Juni 2026, raport tidak lagi sepenuhnya dilakukan admin. Berikut pembagian yang direkomendasikan:

### Alur yang Direkomendasikan (300 murid)

```
GURU HALAQAH (via portal guru → menu Raport Halaqah):
  [1] Isi nilai manual UAS & Micro Teaching untuk muridnya
  [2] Tulis catatan wali halaqah
  [3] Generate raport semua murid halaqahnya
  [4] Review preview tabel nilai
  [5] Publish semua raport → murid langsung bisa lihat

ADMIN (via portal admin):
  [1] Setup awal: Periode + Komponen Raport (satu kali per semester)
  [2] Pantau via Laporan Global jika ada anomali
  [3] Override/generate ulang jika ada koreksi (via menu Generate Raport admin)
  [4] Kirim email raport jika diminta
```

### Keuntungan Pendelegasian ke Guru
- Admin tidak perlu input 300+ nilai manual
- Guru lebih tahu kondisi muridnya → catatan lebih personal
- Proses raport bisa paralel (semua guru jalan bersamaan)
- Admin hanya quality control, bukan operator

### Hak Akses Raport

| Aksi | Guru | Admin |
|------|:----:|:-----:|
| Input nilai manual halaqahnya | ✅ | ✅ |
| Generate raport halaqahnya | ✅ | ✅ |
| Publish raport halaqahnya | ✅ | ✅ |
| Generate raport semua halaqah (bulk) | ❌ | ✅ |
| Kirim raport via email | ❌ | ✅ |
| Lihat raport halaqah lain | ❌ | ✅ |

---

## 10. Generate & Publish Raport (Admin)

Admin tetap bisa generate dan publish dari portal admin, terutama untuk:
- Koreksi jika ada raport yang salah setelah dipublish guru
- Bulk generate semua halaqah sekaligus
- Generate ulang setelah ada perubahan data

### Generate Raport
1. Pilih periode
2. Pilih mode:
   - **Per murid** — generate satu murid
   - **Per halaqah** — semua murid dalam satu halaqah
   - **Per level** — semua murid dalam satu level
   - **Bulk** — semua murid semua halaqah
3. Klik **Generate**

> ⚠️ Jika raport sudah dipublish oleh guru dan di-generate ulang oleh admin, status akan kembali ke `draft`. Guru perlu publish ulang, atau admin bisa publish dari portal admin.

### Publish Raport
Setelah generate, raport berstatus `draft`. Murid belum bisa melihat.
1. Pilih raport yang akan dipublikasikan
2. Klik **Publish** → status berubah jadi `published`
3. Murid langsung bisa melihat di portal mereka

### Kirim Email
1. Klik **📧 Email** di baris raport yang sudah `published`
2. Email dikirim ke alamat email murid (jika sudah diisi di data user)
3. Status berubah jadi `terkirim`

> ⚠️ Raport yang sudah `published` **tidak bisa di-unpublish**. Jika ada koreksi besar, generate ulang → publish ulang.

---

## 11. Laporan Global

Ringkasan performa semua halaqah dalam satu tampilan:
- Total murid, total sesi, rata-rata nilai, % kehadiran
- Bisa filter per periode
- Berguna untuk evaluasi akademik dan laporan ke pimpinan

---

## 12. Rekap Absensi

Generate laporan kehadiran ke Google Sheets:
1. Pilih halaqah
2. Klik **Export Rekap Presensi** → sheet baru dibuat di spreadsheet
3. Atau klik **Export Rekap Nilai** → matriks nilai per pertemuan

---

## 13. Pengumuman

Kirim pengumuman ke semua murid atau halaqah tertentu:
1. Isi judul dan isi pesan
2. Pilih target (semua / halaqah tertentu)
3. Klik **Kirim**

Pengumuman langsung muncul di dashboard portal murid.

---

## 14. Observasi Guru *(Superadmin)*

Data observasi KBM yang diisi secara rahasia oleh ketua kelas. **Admin biasa tidak bisa mengakses.**

### Rekap per Guru

| Metrik | Keterangan |
|--------|-----------|
| % Kondisi Kondusif | Seberapa sering kelas berjalan kondusif |
| % Tepat Waktu | Guru hadir dan mengakhiri tepat jadwal |
| Terlambat | Berapa kali + rata-rata keterlambatan (menit) |
| % Ada Latihan | Frekuensi pemberian latihan mandiri |
| Kamera Peserta | Distribusi: Terbuka / Campuran / Tertutup |

Warna indikator:
- **Hijau** = baik (≥80%)
- **Amber** = perlu perhatian (60–79%)
- **Merah** = perlu tindak lanjut (<60%)

> 💡 Data ini bersumber dari ketua kelas yang mengisi form observasi setelah setiap sesi. Ketua kelas hanya tahu "data hanya dilihat admin" — tidak tahu bahwa yang melihat adalah superadmin tertentu.

---

## 15. Audit Log *(Superadmin)*

Rekam jejak semua aktivitas penting di sistem (100 terakhir):
- Siapa melakukan apa dan kapan
- Termasuk: generate raport, publish raport, input nilai, buka/tutup KBM
- Berguna untuk investigasi jika ada anomali data

---

## 16. Arsip Data

Pindahkan data periode lama ke spreadsheet terpisah agar sheet aktif tetap ringan:
1. Pilih periode yang akan diarsip
2. Klik **Arsip Data**
3. Data dipindah ke spreadsheet arsip — tidak hilang, hanya tidak aktif

> 💡 Lakukan arsip setiap akhir semester/tahun ajaran untuk menjaga performa sistem.

---

## 17. Manajemen Level & Template Koreksi

### Level
Kelola daftar level tahsin (Level 1, Level 2, dst):
- Tambah level baru
- Edit nama dan deskripsi level

### Template Koreksi
Template koreksi tahsin yang muncul sebagai chip di form penilaian murid:
- Memudahkan guru mengisi koreksi yang konsisten dan terstandar
- Tambah, edit, atau nonaktifkan template dari menu ini

---

## Perbandingan Akses Admin vs Superadmin

| Menu | Admin | Superadmin |
|------|:-----:|:----------:|
| Dashboard | ✅ | ✅ |
| Manajemen User/Halaqah/Anggota | ✅ | ✅ |
| Komponen Raport | ✅ | ✅ |
| Input Nilai Manual | ✅ | ✅ |
| Generate & Publish Raport | ✅ | ✅ |
| Kirim Email Raport | ✅ | ✅ |
| Laporan Global | ✅ | ✅ |
| Rekap Absensi | ✅ | ✅ |
| Pengumuman | ✅ | ✅ |
| Arsip Data | ✅ | ✅ |
| Level & Template | ✅ | ✅ |
| **Assign Ketua Kelas** | ❌ | ✅ |
| **Observasi Guru** | ❌ | ✅ |
| **Audit Log** | ❌ | ✅ |

---

## Checklist Setup Awal Semester Baru

```
□ Buat Periode baru (contoh: Semester 2 2026)
□ Aktifkan Periode
□ Tambah atau update Halaqah → pastikan id_periode terhubung
□ Assign murid ke halaqah baru jika ada perubahan
□ Konfigurasi Komponen Raport untuk periode baru
  □ Total bobot = 100%
  □ Nama komponen sesuai keyword deteksi otomatis
□ Informasikan ke guru untuk mulai input nilai manual di akhir semester
□ Informasikan ke guru untuk generate dan publish raport halaqahnya masing-masing
```

---

## Tips Penting

- **Urutan setup awal:** Periode → Level → Halaqah (+ id_periode) → User → Anggota → Komponen Raport
- **Nilai raport = 0?** Cek apakah halaqah sudah dikaitkan ke periode yang benar
- **Delegasikan ke guru:** Guru bisa isi nilai manual dan generate raport halaqahnya — admin cukup setup komponen
- **Arsip rutin:** Lakukan setiap akhir semester agar sistem tetap responsif
- **Backup data:** Google Sheets otomatis punya version history — bisa restore jika ada kesalahan
- **Hard refresh** jika ada error "... is not a function": `Cmd+Shift+R` (Mac) atau `Ctrl+Shift+R` (Windows)

---

*Panduan ini mencerminkan fitur per Juni 2026. Hubungi developer jika ada kendala teknis.*
