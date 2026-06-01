# Panduan Portal Guru — Rattililqur'an

> Panduan lengkap menggunakan Portal Guru untuk mencatat KBM, menilai murid, dan menerbitkan raport halaqah.
> Diperbarui Juni 2026 — mencakup fitur Raport Halaqah (generate & publish oleh guru).

---

## Daftar Isi

1. [Login & Logout](#1-login--logout)
2. [Dashboard](#2-dashboard)
3. [Alert Sesi KBM Belum Diselesaikan](#3-alert-sesi-kbm-belum-diselesaikan)
4. [Alur Utama: Sesi KBM](#4-alur-utama-sesi-kbm)
5. [Edit Presensi Sesi Selesai](#5-edit-presensi-sesi-selesai)
6. [Menu Daftar Murid](#6-menu-daftar-murid)
7. [Menu Keaktifan Murid](#7-menu-keaktifan-murid)
8. [Menu At-Tibyan](#8-menu-at-tibyan)
9. [Menu Assessment](#9-menu-assessment)
10. [Menu Riwayat KBM](#10-menu-riwayat-kbm)
11. [Menu Nilai Manual](#11-menu-nilai-manual)
12. [Menu Raport Halaqah *(Baru)*](#12-menu-raport-halaqah)
13. [Menu Pengumuman](#13-menu-pengumuman)
14. [Berkas Pengajar](#14-berkas-pengajar)
15. [Ganti Password](#15-ganti-password)
16. [Install Aplikasi (PWA)](#16-install-aplikasi-pwa)
17. [Solusi Masalah Umum](#17-solusi-masalah-umum)

---

## 1. Login & Logout

### Login
1. Buka portal melalui tautan yang diberikan admin
2. Masukkan **ID Guru** (contoh: `NISA`) di kolom pertama
3. Masukkan **Password** di kolom kedua
4. Klik **Masuk**

> ⚠️ Jika muncul pesan merah, periksa ID dan password. Hubungi admin jika tidak bisa masuk.

### Logout
Buka **Sidebar** (klik ikon hamburger pojok kiri atas) → klik **Keluar dari Aplikasi** di bagian bawah.

---

## 2. Dashboard

Halaman utama yang terbuka setelah login menampilkan ringkasan aktivitas mengajar.

### Kartu Statistik
| Kartu | Keterangan |
|-------|-----------|
| Halaqah | Jumlah halaqah yang diampu |
| Total Murid | Jumlah seluruh murid aktif |
| KBM Hari Ini | Jumlah sesi KBM hari ini |
| Sesi Bulan Ini | Total sesi yang diselesaikan bulan berjalan |
| Butuh Perhatian | Murid Kritis + Peringatan — klik untuk ke halaman Keaktifan |
| Berkas Pengajar | Shortcut ke dokumen silabus dan SOP |

### Kartu Halaqah Saya
Menampilkan info setiap halaqah: jadwal, jumlah murid, progress sesi, dan tombol **Lanjut Sesi ke-X** untuk langsung membuka form KBM dengan halaqah terpilih.

---

## 3. Alert Sesi KBM Belum Diselesaikan

Jika ada sesi KBM yang dibuka tapi tidak diselesaikan (status `draft`), sistem otomatis menampilkan dua peringatan:

**1. Banner kuning di Dashboard**
Menampilkan jumlah sesi draft, nama halaqah, dan detail sesi mana yang belum selesai. Klik banner langsung ke Riwayat KBM.

**2. Badge merah di sidebar "Riwayat KBM"**
Angka merah menunjukkan jumlah sesi draft.

### Dampak jika dibiarkan
- Data presensi dan nilai murid tidak tersimpan — statistik tidak akurat
- Tidak bisa membuka sesi KBM baru selama ada draft aktif
- Riwayat KBM tidak lengkap dan memengaruhi nilai raport

### Cara menyelesaikan
- Buka **Riwayat KBM** → klik **Hapus Draft** di baris berstatus `draft`
- Atau lanjutkan sesi draft yang masih relevan via tombol **Lanjutkan Sesi** di banner

---

## 4. Alur Utama: Sesi KBM

Setiap sesi KBM melewati 4 langkah berurutan.

### Sebelum Mulai — Persiapan

Centang 3 item persiapan sebelum tombol buka sesi aktif:
1. **Memperbaiki Niat** — luruskan niat mengajar karena Allah
2. **Membaca Silabus** — cek materi yang akan disampaikan
3. **Menyiapkan 1 Nasihat** — siapkan satu nasihat untuk murid

### Langkah 1 — Buka Sesi Baru

1. Pilih **Halaqah** dari dropdown
2. Pilih **Jenis Sesi**: KBM Reguler / Micro Teaching / Lainnya
3. Isi **Tanggal** dan **Jam Mulai**
4. **Pertemuan ke-X**: biarkan kosong untuk auto-hitung dari sistem
5. Klik **Mulai Perjuangan Baru**
6. Doa pembuka muncul — baca hingga selesai lalu klik Lanjut

> ⚠️ Jika muncul "Masih ada sesi berjalan" → selesaikan atau hapus sesi draft terlebih dahulu.

> 💡 Pertemuan ke-X dihitung otomatis dari sesi yang sudah selesai.

### Langkah 2 — Presensi Murid

Pilih status per murid:
- **H** = Hadir tepat waktu
- **T** = Terlambat
- **I** = Izin
- **A** = Alpa

Klik **Simpan Presensi** setelah selesai.

> 💡 Tombol **Semua Hadir** untuk set semua murid sekaligus.

**Catatan:** KBM Micro Teaching dan Lainnya hanya 2 step (Buka + Presensi). Tidak ada step nilai dan jurnal.

### Langkah 3 — Penilaian Murid

Untuk setiap murid yang Hadir atau Terlambat:

| Field | Pilihan |
|-------|---------|
| **Adab** | Baik / Butuh Perhatian |
| **Kamera** | Kamera terbuka / sering tertutup / selalu tertutup |
| **Koreksi Tahsin** | Teks bebas — gunakan chip template untuk lebih cepat |
| **Catatan Murid** | Pesan khusus yang terlihat di portal murid |

> ⚠️ Nilai adab dan kamera ini menjadi **komponen otomatis** di raport akhir semester. Isi dengan teliti setiap sesi.

Klik **Simpan Semua** setelah selesai.

### Langkah 4 — Jurnal & Latihan Mandiri

**Jurnal KBM:**
- Pencapaian Materi (wajib)
- Metode Mengajar
- Catatan Umum
- Jam Selesai

**Latihan Mandiri (opsional):**
- Jenis: VN di WAG / Membaca mandiri / Lainnya
- Deskripsi tugas
- Deadline pengumpulan

### Langkah 5 — Preview & Tutup Sesi

Periksa ringkasan semua data. Klik **Tutup & Simpan Sesi** untuk finalisasi.

> ⚠️ Jika ada murid hadir yang Adab/Kamera belum diisi, muncul peringatan. Sebaiknya dilengkapi sebelum menutup sesi.

---

## 5. Edit Presensi Sesi Selesai

Jika ada kesalahan input setelah sesi ditutup:

1. Buka **Riwayat KBM** → pilih halaqah
2. Klik **Edit KBM** di baris sesi yang ingin dikoreksi
3. Ubah status hadir murid yang perlu dikoreksi
4. Klik **Simpan Perubahan**

---

## 6. Menu Daftar Murid

### Filter & Pencarian
- Dropdown Level dan Halaqah
- Kotak cari nama atau NIS
- Tombol **Refresh** untuk muat ulang data

### Kolom Tabel
| Kolom | Keterangan |
|-------|-----------|
| Nama Murid | Nama lengkap |
| Level | Level tahsin saat ini |
| Hadir | Jumlah sesi hadir (H + T) |
| Sesi | Total sesi KBM Reguler tercatat |
| % Kehadiran | Persentase dari total sesi |
| Skor/40 | Skor akumulasi dari 40 sesi target |
| Poin Adab | Akumulasi poin adab |
| Poin Kamera | Akumulasi poin kamera |

### Aksi
- **Catatan** — tulis catatan khusus tentang murid
- **+ Tambah** — tambah murid ke halaqah
- **Rekap Presensi / Rekap Nilai** — generate sheet di Google Sheets

---

## 7. Menu Keaktifan Murid

### Status Keaktifan KBM
| Status | Kriteria (40 sesi terakhir) |
|--------|--------------------------|
| Kritis | Alpa >= 2 kali |
| Peringatan | Alpa 1 kali, ATAU terlambat >= 2, ATAU kamera tertutup >= 2 |
| Normal | Tidak ada kriteria di atas |

### Fitur
- Kartu per murid dengan metrik dan dots riwayat 15 sesi
- Kotak pencarian nama
- Tombol **Sudah Dihubungi** untuk dismiss alert
- Tombol **WhatsApp** untuk menghubungi dengan pesan terformat

---

## 8. Menu At-Tibyan

Kajian mingguan untuk **semua murid semua halaqah** sekaligus. Hanya presensi, tanpa nilai dan jurnal.

### Membuat Sesi Baru
1. Klik **+ Sesi At-Tibyan Baru**
2. Pilih tanggal
3. Semua murid semua halaqah muncul, dikelompokkan Level → Halaqah
4. Default semua = H. Ubah yang tidak hadir
5. Gunakan kotak cari atau bulk action Semua Hadir/Alpa
6. Klik **Simpan Sesi**

### Edit Sesi
Klik ✏️ di riwayat → form terbuka dengan data existing → ubah → Simpan.

### Tab Keaktifan At-Tibyan
| Status | Kriteria |
|--------|---------|
| Kritis | Absen At-Tibyan >= 2 kali |
| Peringatan | Absen At-Tibyan 1 kali |
| Normal | 0 absen |

Tombol **WhatsApp** tersedia untuk Kritis dan Peringatan dengan pesan berformat khusus At-Tibyan.

### Tab Rekap At-Tibyan
- Summary % kehadiran halaqah + total hadir + alpa
- Tabel per murid dengan bar visual
- Data ini otomatis masuk komponen raport bertipe `tibyan` jika dikonfigurasi

---

## 9. Menu Assessment

Rekap self-assessment murid Level 1 & 2 (makharijul dan sifaatul huruf):
1. Pilih Halaqah
2. Lihat summary % Paham/Ragu/Belum + bar distribusi
3. Kartu per murid dengan detail per huruf/makhraj

---

## 10. Menu Riwayat KBM

### Filter
Pilih Level dan Halaqah → data tampil otomatis.

### Aksi per Baris
- **Detail** — lihat presensi dan nilai lengkap
- **Edit KBM** — koreksi presensi
- **Hapus Draft** (merah) — hanya muncul di baris `draft`

### Generate Rekap
- **Rekap Presensi** — sheet kehadiran per murid per sesi
- **Rekap Nilai** — matriks nilai KBM harian

---

## 11. Menu Nilai Manual

Input nilai komponen manual (UAS, Micro Teaching) tanpa perlu masuk ke menu Raport:

1. Pilih **Periode** → sistem memuat komponen manual yang dikonfigurasi admin
2. Pilih **Halaqah**
3. Isi nilai 0–100 per murid per komponen
4. Klik **Simpan Semua**

> 💡 Nilai yang diisi di sini juga tersedia dan bisa diedit dari **Menu Raport Halaqah**. Kedua menu mengakses data yang sama.

---

## 12. Menu Raport Halaqah

Menu ini memungkinkan guru **langsung generate, review, dan publish** raport murid di halaqahnya sendiri — tanpa harus menunggu admin.

### Alur Kerja Raport (5 Tahap)

```
[1] Pilih Periode & Halaqah
       ↓
[2] Isi Nilai Manual (UAS, Micro Teaching)
       ↓
[3] Tulis Catatan Wali Halaqah
       ↓
[4] Generate Raport → Preview Tabel
       ↓
[5] Review → Konfirmasi → Publish Semua
```

---

### Tahap 1 — Pilih Periode & Halaqah

Pilih periode semester dan halaqah Anda. Sistem otomatis memuat:
- Nilai manual yang sudah pernah diisi
- Catatan halaqah yang pernah disimpan
- Daftar raport yang sudah pernah di-generate (jika ada)

---

### Tahap 2 — Isi Nilai Manual

Jika ada komponen manual (UAS, Micro Teaching), form input muncul otomatis.

- Isi nilai **0–100** per murid per komponen
- Klik **Simpan** sebelum lanjut

> ⚠️ Jika tidak ada form nilai manual, berarti admin belum mengkonfigurasi komponen manual untuk periode ini. Hubungi admin.

---

### Tahap 3 — Catatan Wali Halaqah

Tulis catatan yang akan **tercetak di seluruh raport murid halaqah ini**. Contoh:

> "Alhamdulillah, perjalanan belajar Al-Qur'an semester ini berjalan dengan baik. Semoga ilmu yang sudah dipelajari dapat diamalkan..."

- Klik **Simpan Catatan** setelah selesai
- Catatan ini bisa diubah kapan saja sebelum raport dipublish

---

### Tahap 4 — Generate Raport

Klik tombol **⚙️ Generate Raport Semua Murid**.

Sistem menghitung nilai akhir setiap murid berdasarkan:

| Komponen | Sumber Data | Catatan |
|----------|-------------|---------|
| Nilai KBM Harian | Adab + Kamera per sesi | Otomatis dari data KBM |
| Kehadiran | % hadir dari total sesi KBM | Otomatis |
| Adab | % sesi adab "Baik" | Otomatis |
| Micro Teaching | Input manual | Isi di Tahap 2 |
| UAS | Input manual | Isi di Tahap 2 |

**Preview tabel muncul** setelah generate:

| Kolom | Keterangan |
|-------|-----------|
| Nama Murid | Nama lengkap |
| Per-komponen | Nilai tiap komponen (warna: hijau ≥80, kuning ≥60, merah <60) |
| Nilai Akhir | Total nilai berbobot |
| Predikat | Mumtaz / Jayyid Jiddan / Jayyid / Maqbul |
| Status | Draft / Published |

> 💡 Generate bisa dilakukan **berkali-kali** sebelum publish. Nilai akan diperbarui setiap kali generate. Raport yang sudah `published` tidak berubah nilainya jika di-generate ulang.

---

### Predikat Nilai

| Predikat | Nilai Minimum |
|----------|--------------|
| Mumtaz | ≥ 90 |
| Jayyid Jiddan | ≥ 80 |
| Jayyid | ≥ 70 |
| Maqbul | < 70 |

> Threshold bisa berubah sesuai konfigurasi admin di `Konfigurasi_Raport`.

---

### Tahap 5 — Review & Publish

Sebelum tombol Publish aktif, muncul **kotak alert kuning** berisi checklist:

```
⚠️ Periksa Sebelum Publish

• Halaqah: Maryam
• Periode: Semester 1 2026
• Jumlah murid: 11 murid
• Siap publish: 11 raport (draft → published)

Pastikan nama murid, nilai setiap komponen, dan catatan wali halaqah
sudah benar sebelum dipublish. Raport yang sudah dipublish akan langsung
terlihat oleh murid. Publish adalah tanggung jawab guru wali halaqah.
```

Setelah yakin benar, klik **📢 Publish Semua Raport ke Murid** → dialog konfirmasi muncul → klik OK.

> ⚠️ **Tanggung jawab guru**: Raport yang sudah published langsung terlihat oleh murid. Periksa kembali nama, nilai, dan catatan sebelum publish. Admin tidak akan mengecek lagi kecuali ada laporan masalah.

> ⚠️ Raport yang sudah `published` **tidak bisa di-unpublish** dari portal ini. Jika ada kesalahan setelah publish, hubungi admin.

---

### Contoh Hasil Raport Murid

Murid melihat di portal mereka:

```
Nama       : Vidyah Nawang Sari
Halaqah    : Maryam
Level      : Level 1
Guru       : Al-Ustadzah Annisa Rizkya Rahmawati
Periode    : Semester 1 2026

Nilai KBM Harian   40%  → 85  → 34 poin
Kehadiran          20%  → 92  → 18 poin
Adab               10%  → 91  → 9 poin
Micro Teaching     15%  → 75  → 11 poin
UAS                15%  → 78  → 12 poin
                         ───────────────
Nilai Akhir               84   → Jayyid Jiddan

Catatan Wali: "Alhamdulillah..."
```

---

## 13. Menu Pengumuman

1. Pilih target halaqah (atau semua)
2. Isi judul dan isi pengumuman
3. Kirim

Pengumuman langsung muncul di portal murid.

---

## 14. Berkas Pengajar

Akses dokumen via sidebar → Berkas Pengajar:
- Silabus Tahsin
- SOP Mengajar
- Panduan Penilaian

---

## 15. Ganti Password

Sidebar → Ganti Password → isi password lama, baru, konfirmasi → Simpan.

---

## 16. Install Aplikasi (PWA)

### Android (Chrome)
1. Klik menu ⋮ pojok kanan atas
2. Pilih **Tambahkan ke layar utama** atau **Install app**
3. Konfirmasi

### iPhone (Safari)
1. Klik ikon Bagikan (kotak panah atas) di toolbar bawah
2. Pilih **Tambahkan ke Layar Utama**
3. Ketuk **Tambahkan**

---

## 17. Solusi Masalah Umum

| Masalah | Solusi |
|---------|--------|
| Tombol Mulai tidak aktif | Centang semua 3 item persiapan |
| "Masih ada sesi berjalan" | Hapus draft atau lanjutkan dari banner |
| Alert draft terus muncul | Riwayat KBM → Hapus Draft di baris draft |
| Nilai adab/kamera masih ada dari sesi lama | Bug sudah diperbaiki Juni 2026 — hard refresh browser |
| "getCatatanHalaqah is not a function" | Hard refresh: Cmd+Shift+R (cache lama) |
| Nilai raport semua 0 | Pastikan komponen raport sudah dikonfigurasi admin dan nilai manual sudah diisi |
| Error "Akses ditolak: halaqah bukan milik Anda" | Pastikan halaqah yang dipilih adalah halaqah Anda sendiri |
| Portal lambat | Hard refresh: Cmd+Shift+R atau Ctrl+Shift+R |
| Lupa password | Hubungi admin |

---

## Ringkasan Alur Lengkap Per Semester

```
SETIAP SESI KBM:
  Dashboard → Mulai Sesi Baru
    Step 1: Buka Sesi → Step 2: Presensi
    Step 3: Nilai (adab, kamera, koreksi)
    Step 4: Jurnal + PR → Step 5: Preview → Tutup

SETIAP MINGGU:
  At-Tibyan → Sesi Baru → Presensi semua → Simpan

AKHIR SEMESTER (Raport):
  Raport Halaqah
    [1] Pilih Periode + Halaqah
    [2] Isi nilai UAS & Micro Teaching → Simpan
    [3] Tulis Catatan Wali Halaqah → Simpan
    [4] Generate Raport → cek preview tabel
    [5] Baca alert double-check → Publish Semua
```

---

*Panduan ini mencerminkan fitur per Juni 2026. Untuk pertanyaan teknis hubungi developer.*
