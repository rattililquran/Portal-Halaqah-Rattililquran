# Panduan Portal Admin — Rattililqur'an

> Panduan lengkap untuk Admin dan Super Admin Portal Rattililqur'an.
> Versi ini mencakup semua fitur termasuk sistem dua level akses.

---

## Daftar Isi

1. [Login & Dua Level Akses](#1-login--dua-level-akses)
2. [Dashboard](#2-dashboard)
3. [Manajemen Periode](#3-manajemen-periode)
4. [Manajemen User](#4-manajemen-user)
5. [Manajemen Halaqah](#5-manajemen-halaqah)
6. [Anggota Kelas & Ketua Kelas](#6-anggota-kelas--ketua-kelas)
7. [Komponen Raport](#7-komponen-raport)
8. [Input Nilai Manual](#8-input-nilai-manual)
9. [Generate & Publish Raport](#9-generate--publish-raport)
10. [Laporan Global](#10-laporan-global)
11. [Rekap Absensi](#11-rekap-absensi)
12. [Pengumuman](#12-pengumuman)
13. [Observasi Guru (Superadmin)](#13-observasi-guru-superadmin)
14. [Audit Log (Superadmin)](#14-audit-log-superadmin)
15. [Arsip Data](#15-arsip-data)
16. [Manajemen Level & Template Koreksi](#16-manajemen-level--template-koreksi)

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

> ⚠️ Jika muncul pesan "Akun ini bukan Admin", pastikan ID yang digunakan memiliki role `admin` atau `superadmin` di sheet Users.

### Cara Membuat Akun Superadmin
Buka Google Sheets → sheet `Users` → cari baris akun yang akan dijadikan superadmin → ubah kolom `role` dari `admin` menjadi `superadmin` → save.

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

> ⚠️ Komponen Raport, Nilai Manual, dan Generate Raport semuanya terikat pada periode aktif. Pastikan periode sudah benar sebelum mulai generate raport.

---

## 4. Manajemen User

### Tab Guru / Murid / Semua
Filter tampilan berdasarkan role.

### Tambah User
1. Klik **+ Tambah User**
2. Pilih Role: `guru` atau `murid`
3. Isi nama lengkap, no HP, email (opsional)
4. **NIS murid** digenerate otomatis format `RTL{YY}{MM}{NNNNN}`
5. **ID guru**: `GRU-NNN` (auto)
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
3. Pilih periode yang terkait
4. Klik **Simpan**

> 💡 Satu guru bisa mengampu lebih dari satu halaqah. Halaqah harus dikaitkan ke periode agar data raport terfilter dengan benar.

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

> 💡 Jika ada ketua lama, status ketua lama otomatis dicabut saat menunjuk ketua baru.
> Untuk mencabut tanpa mengganti: klik tombol **👑 Ketua** pada murid yang sedang menjabat → konfirmasi pencabutan.

---

## 7. Komponen Raport

Komponen raport menentukan bagaimana nilai akhir murid dihitung. **Total bobot semua komponen harus = 100%.**

### Tambah Komponen
1. Pilih periode
2. Klik **+ Tambah Komponen**
3. Isi nama komponen — **nama menentukan cara hitung otomatis**
4. Pilih tipe: `otomatis` atau `manual`
5. Isi bobot (%)
6. Simpan

### Keyword Deteksi Otomatis

| Keyword dalam Nama | Sumber Data | Cara Hitung |
|--------------------|-------------|------------|
| `kehadiran` (tanpa `tibyan`) | KBM Reguler | Skor hadir / total sesi |
| `kbm` atau `harian` | KBM Reguler | Rata-rata adab×70% + kamera×30% |
| `adab` | KBM Reguler | % sesi dengan adab Baik |
| `kamera` | KBM Reguler | Rata-rata score kamera |
| `latihan` / `pr` / `mandiri` | KBM_Log | 80 jika ada PR, else 0 |
| `tibyan` / `at-tibyan` | At-Tibyan_Log | % hadir At-Tibyan |
| Manual | Nilai_Manual | Diisi admin/guru |

### Konfigurasi Threshold (sheet Konfigurasi_Raport)

| Key | Default | Keterangan |
|-----|---------|-----------|
| `grade_mumtaz` | 90 | Nilai minimum Mumtaz |
| `grade_jayyid_jiddan` | 80 | Nilai minimum Jayyid Jiddan |
| `grade_jayyid` | 70 | Nilai minimum Jayyid |
| `bobot_adab` | 70 | Bobot adab dalam KBM Harian |
| `bobot_kamera` | 30 | Bobot kamera dalam KBM Harian |
| `bonus_perfect_attendance` | 5 | Bonus poin jika 0 Alpa |

---

## 8. Input Nilai Manual

Untuk komponen bertipe `manual` (UAS, Micro Teaching, dll):

1. Pilih periode dan komponen
2. Pilih halaqah
3. Tabel murid muncul — isi nilai (0-100) per murid
4. Klik **Simpan**

---

## 9. Generate & Publish Raport

### Generate Raport
1. Pilih periode
2. Pilih mode:
   - **Per murid** — generate satu murid
   - **Per halaqah** — semua murid dalam satu halaqah
   - **Per level** — semua murid dalam satu level
   - **Bulk** — semua murid semua halaqah
3. Klik **Generate**
4. Sistem menghitung nilai berdasarkan komponen yang dikonfigurasi

> ⚠️ Pastikan semua nilai manual sudah diisi sebelum generate. Murid tanpa data KBM akan mendapat predikat "Belum Ada Data".

### Publish Raport
Setelah generate, raport berstatus `draft`. Murid belum bisa melihat.
1. Pilih raport yang akan dipublikasikan
2. Klik **Publish** → status berubah jadi `published`
3. Murid langsung bisa melihat di portal mereka

> ⚠️ Raport yang sudah dipublish **tidak bisa di-unpublish**. Pastikan data sudah benar sebelum publish.

---

## 10. Laporan Global

Ringkasan performa semua halaqah dalam satu tampilan:
- Total murid, total sesi, rata-rata nilai, % kehadiran
- Bisa filter per periode

---

## 11. Rekap Absensi

Generate laporan kehadiran ke Google Sheets:
1. Pilih halaqah
2. Klik **Export Rekap Presensi** → sheet baru dibuat di spreadsheet
3. Atau klik **Export Rekap Nilai** → matriks nilai per pertemuan

---

## 12. Pengumuman

Kirim pengumuman ke semua murid atau halaqah tertentu:
1. Isi judul dan isi pesan
2. Pilih target (semua / halaqah tertentu)
3. Klik **Kirim**

Pengumuman langsung muncul di dashboard portal murid.

---

## 13. Observasi Guru *(Superadmin)*

Data observasi KBM yang diisi secara rahasia oleh ketua kelas. **Admin biasa tidak bisa mengakses halaman ini.**

### Rekap per Guru
Menampilkan statistik per guru:

| Metrik | Keterangan |
|--------|-----------|
| % Kondisi Kondusif | Seberapa sering kelas berjalan kondusif |
| % Tepat Waktu | Guru hadir dan mengakhiri tepat jadwal |
| Terlambat | Berapa kali + rata-rata keterlambatan (menit) |
| % Ada Latihan | Frekuensi pemberian latihan mandiri |
| Kamera Peserta | Distribusi: Terbuka / Campuran / Tertutup |

Warna indikator:
- **Hijau** = baik (≥80%)
- **Amber** = perlu perhatian (60-79%)
- **Merah** = perlu tindak lanjut (<60%)

### Detail per Sesi
Tabel lengkap setiap observasi dengan:
- Tanggal, sesi ke-, halaqah, nama guru
- Badge warna per poin observasi
- Catatan tambahan dari ketua kelas

### Filter
- Filter per guru atau per halaqah untuk analisis spesifik

> 💡 Data ini bersumber dari ketua kelas yang mengisi form observasi setelah setiap sesi. Ketua kelas tidak mengetahui bahwa datanya terlihat oleh siapa — mereka hanya tahu "hanya admin".

---

## 14. Audit Log *(Superadmin)*

Rekam jejak semua aktivitas penting di sistem (100 terakhir):
- Siapa melakukan apa dan kapan
- Berguna untuk investigasi jika ada anomali data

---

## 15. Arsip Data

Pindahkan data periode lama ke spreadsheet terpisah agar sheet aktif tetap ringan:
1. Pilih periode yang akan diarsip
2. Klik **Arsip Data**
3. Data dipindah ke spreadsheet arsip — tidak hilang, hanya tidak aktif

> 💡 Lakukan arsip setiap akhir semester/tahun ajaran untuk menjaga performa sistem.

---

## 16. Manajemen Level & Template Koreksi

### Level
Kelola daftar level tahsin (Level 1, Level 2, dst):
- Tambah level baru
- Edit nama dan deskripsi level

### Template Koreksi
Upload template koreksi tahsin yang digunakan guru saat penilaian:
- Template muncul sebagai chip di form penilaian murid
- Memudahkan guru mengisi koreksi yang konsisten

---

## Perbandingan Akses Admin vs Superadmin

| Menu | Admin | Superadmin |
|------|:-----:|:----------:|
| Dashboard | ✅ | ✅ |
| Manajemen User/Halaqah/Anggota | ✅ | ✅ |
| Komponen Raport | ✅ | ✅ |
| Input Nilai Manual | ✅ | ✅ |
| Generate & Publish Raport | ✅ | ✅ |
| Laporan Global | ✅ | ✅ |
| Rekap Absensi | ✅ | ✅ |
| Pengumuman | ✅ | ✅ |
| Arsip Data | ✅ | ✅ |
| Level & Template | ✅ | ✅ |
| **Assign Ketua Kelas** | ❌ | ✅ |
| **Observasi Guru** | ❌ | ✅ |
| **Audit Log** | ❌ | ✅ |

---

## Tips Penting

- **Urutan setup awal:** Periode → Level → Halaqah → User → Anggota → Komponen Raport
- **Sebelum generate raport:** Pastikan semua nilai manual sudah diisi dan periode sudah benar
- **Arsip rutin:** Lakukan setiap akhir semester agar sistem tetap responsif
- **Password akun:** Ganti password admin secara berkala melalui menu Ganti Password
- **Backup data:** Google Sheets otomatis punya version history — bisa restore jika ada kesalahan

---

*Panduan ini mencerminkan fitur per Juni 2026. Hubungi developer jika ada kendala teknis.*
