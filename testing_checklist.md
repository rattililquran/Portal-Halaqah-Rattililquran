# Testing Checklist — Portal Halaqah Rattililqur'an

> Centang setiap item saat testing. Format: `- [x]` = lulus, `- [ ]` = belum ditest, `- [❌]` = gagal (catat masalahnya).
> Versi testing: Juni 2026

---

## STATUS RINGKASAN

| Kategori | Total | Lulus | Gagal | Belum |
|----------|-------|-------|-------|-------|
| Autentikasi | 7 | | | |
| Dashboard Guru | 9 | | | |
| KBM Flow | 22 | | | |
| Edit & Hapus KBM | 7 | | | |
| Alert Draft KBM | 7 | | | |
| At-Tibyan Guru | 20 | | | |
| At-Tibyan Murid | 12 | | | |
| Dashboard Murid | 7 | | | |
| Riwayat & PR Murid | 9 | | | |
| Raport | 6 | | | |
| Notifikasi & Keaktifan | 6 | | | |
| Superadmin | 5 | | | |
| Observasi Guru Admin | 7 | | | |
| Assign Ketua Kelas | 6 | | | |
| Ketua Kelas — Akses | 4 | | | |
| Ketua — Pantau Anggota | 9 | | | |
| Ketua — Template Reminder | 6 | | | |
| Ketua — Observasi KBM | 17 | | | |
| Ketua — Rekap KBM | 9 | | | |
| Ketua — Window Logic | 3 | | | |
| PWA & Responsivitas | 8 | | | |
| Setup & Data Dummy | 6 | | | |
| **TOTAL** | **183** | | | |

---

## 1. AUTENTIKASI

- [ ] Login guru dengan ID + password benar → masuk dashboard guru
- [ ] Login murid dengan NIS + password benar → masuk dashboard murid
- [ ] Login admin biasa (`admin`) → masuk portal admin
- [ ] Login superadmin (`superadmin`) → masuk portal admin
- [ ] Login dengan password salah → muncul pesan error merah
- [ ] Login dengan NIS tidak terdaftar → muncul pesan error
- [ ] Logout dari aplikasi → kembali ke halaman login

---

## 2. DASHBOARD GURU

- [ ] Statistik: Halaqah, Total Murid, KBM Hari Ini, Sesi Bulan Ini tampil benar
- [ ] Kartu halaqah tampil dengan info pertemuan berikutnya yang benar (ke-X, bukan selalu ke-1)
- [ ] Tombol "Lanjut Sesi ke-X" → form KBM ter-prefill halaqah yang tepat
- [ ] Kartu Keaktifan Murid → angka sesuai jumlah yang butuh perhatian
- [ ] **Alert draft muncul** jika ada sesi KBM berstatus draft
- [ ] Alert menampilkan nama halaqah dan detail sesi draft
- [ ] **Badge merah** di sidebar "Riwayat KBM" menampilkan jumlah draft
- [ ] Klik alert card → diarahkan ke Riwayat KBM
- [ ] Setelah semua draft dihapus → alert dan badge hilang

---

## 3. KBM FLOW — 4 STEP

### 3a. Persiapan & Buka Sesi
- [ ] Checklist persiapan: centang 3 item → tombol "Mulai Perjuangan Baru" aktif
- [ ] Sebelum 3 item tercentang → tombol masih disabled
- [ ] Pilih halaqah → jam otomatis terisi dari jadwal
- [ ] Pertemuan ke-X field kosong → auto-hitung dari GAS (bukan selalu 1)
- [ ] Isi pertemuan manual → nilai custom terkirim ke GAS
- [ ] Klik Mulai → doa pembuka muncul → klik Lanjut → masuk presensi
- [ ] Tidak bisa buka sesi baru jika ada draft aktif

### 3b. Presensi
- [ ] Semua murid halaqah tampil di daftar presensi
- [ ] Default semua murid = H (Hadir)
- [ ] Tombol "Semua Hadir" → semua jadi H
- [ ] Ubah status individual H/T/I/A → tersimpan
- [ ] Klik Simpan Presensi → lanjut ke nilai

### 3c. Nilai
- [ ] Murid Alpa/Izin tidak muncul di form nilai
- [ ] Murid Hadir/Terlambat → bisa isi Adab, Kamera, Koreksi, Catatan
- [ ] Chip template koreksi berfungsi (klik → teks terisi otomatis)
- [ ] Klik Simpan Semua → lanjut ke jurnal

### 3d. Jurnal & Latihan Mandiri
- [ ] Isi materi, metode, catatan, jam selesai
- [ ] Latihan mandiri: isi deskripsi + deadline → tersimpan
- [ ] Jenis latihan bisa dipilih
- [ ] Klik Lanjut ke Preview → halaman preview terbuka

### 3e. Preview & Tutup
- [ ] Preview menampilkan ringkasan presensi dan nilai
- [ ] Jika ada murid hadir yang adab/kamera belum diisi → muncul peringatan (bisa dilanjutkan)
- [ ] Klik Tutup & Simpan Sesi → sesi berubah jadi `selesai`
- [ ] Setelah tutup → dashboard refresh, pertemuan ke-X bertambah 1
- [ ] KBM Micro Teaching/Lainnya → hanya 2 step (presensi → preview langsung, tanpa nilai & jurnal)

---

## 4. EDIT & HAPUS KBM

- [ ] Riwayat KBM → pilih halaqah → daftar sesi muncul
- [ ] Klik **Edit KBM** pada sesi selesai → modal edit terbuka
- [ ] Ubah status hadir murid → Simpan Perubahan → tidak ada error "tidak berhak"
- [ ] Setelah edit → data presensi terupdate di riwayat
- [ ] Tombol **Hapus Draft** (merah) hanya muncul di baris berstatus `draft`
- [ ] Klik Hapus Draft → konfirmasi → sesi terhapus dari daftar
- [ ] Setelah hapus → badge sidebar berkurang / hilang

---

## 5. ALERT DRAFT KBM

- [ ] Badge merah di sidebar "Riwayat KBM" muncul saat ada draft
- [ ] Angka badge sesuai jumlah sesi draft
- [ ] Alert card di dashboard: judul + nama halaqah + detail sesi + 4 dampak negatif
- [ ] Klik alert → masuk ke Riwayat KBM
- [ ] Hapus satu draft → badge berkurang 1
- [ ] Hapus semua draft → badge hilang, alert card hilang
- [ ] Buka sesi draft baru → badge muncul kembali saat refresh

---

## 6. AT-TIBYAN GURU

### 6a. Sesi Baru
- [ ] Menu At-Tibyan muncul di sidebar section "Kajian"
- [ ] Tab Riwayat Sesi → tampil list sesi
- [ ] Klik "+ Sesi At-Tibyan Baru" → form terbuka
- [ ] Semua murid semua halaqah muncul, dikelompokkan Level → Halaqah
- [ ] Default semua murid = H
- [ ] Tombol "Semua Hadir" → semua jadi H
- [ ] Tombol "Semua Alpa" → semua jadi A
- [ ] Kotak cari murid berfungsi
- [ ] Counter "X/Y hadir" update saat status diubah
- [ ] Simpan → muncul di riwayat dengan pertemuan ke yang benar (global counter)

### 6b. Edit Sesi
- [ ] Klik ✏️ di riwayat → form edit terbuka dengan status hadir existing
- [ ] Ubah beberapa murid → Simpan → data terupdate

### 6c. Tab Keaktifan
- [ ] Summary cards Kritis/Peringatan/Normal tampil
- [ ] Kartu murid tampil dengan dots riwayat dan % hadir
- [ ] Kritis = absen ≥2, Peringatan = absen 1
- [ ] Tombol WA muncul untuk Kritis dan Peringatan
- [ ] Klik WA → WhatsApp terbuka dengan pesan format At-Tibyan
- [ ] Murid tanpa no HP → tombol abu-abu, tidak bisa diklik

### 6d. Tab Rekap
- [ ] Summary % kehadiran + total hadir + total alpa tampil
- [ ] Tabel per murid dengan bar visual dan info alpa
- [ ] Filter per halaqah berfungsi
- [ ] Tombol Refresh → reload data terbaru

---

## 7. AT-TIBYAN MURID

- [ ] Halaman At-Tibyan → 2 tab: "Kajian" dan "Kehadiranku"
- [ ] **Tab Kajian**: kartu "KAJIAN TERBARU" di-pin di atas dengan banner merah beranimasi
- [ ] Filter Pertemuan berfungsi (Semua / Pertemuan 1, 2, 3...)
- [ ] Kotak pencarian keyword berfungsi (cari materi/nasihat)
- [ ] Search tidak ada hasil → empty state "Tidak ditemukan"
- [ ] Tombol Salin → teks ter-copy ke clipboard, haptic feedback
- [ ] Tombol Bagikan → menu share native muncul
- [ ] Teks Arab tampil RTL dengan font Amiri
- [ ] **Tab Kehadiranku**: % hadir tampil dengan warna (hijau/amber/merah)
- [ ] Riwayat per pertemuan tampil dengan badge H/T/I/A
- [ ] Tanggal tampil format WIB (bukan ISO UTC)
- [ ] Murid yang belum ada data At-Tibyan → empty state informatif

---

## 8. DASHBOARD MURID

- [ ] Progress 40 sesi hanya menghitung KBM Reguler (bukan At-Tibyan / Micro Teaching)
- [ ] Kartu At-Tibyan emas-oranye muncul → klik → buka halaman At-Tibyan
- [ ] Grafik kehadiran 6 bulan tampil dengan benar
- [ ] Warna bar: hijau ≥80%, amber 50-79%, merah <50%
- [ ] Bulan tanpa sesi → bar abu-abu + label "Libur"
- [ ] Bulan ini ter-highlight titik biru (●)
- [ ] Tap batang grafik (mobile) → tooltip detail muncul

---

## 9. RIWAYAT & PR MURID

- [ ] Kalender kehadiran: warna tanggal sesuai status (hijau/merah/kuning)
- [ ] Klik tanggal → popup detail sesi
- [ ] Daftar sesi expandable: materi, adab, kamera, koreksi, catatan guru, PR
- [ ] Muat lebih banyak berfungsi
- [ ] Murid baru (0 sesi) → pesan "Sesi pertamamu belum tercatat"
- [ ] Tab PR: daftar PR aktif dengan warna deadline (merah/kuning/hijau)
- [ ] Badge angka merah di tab PR jika ada PR aktif
- [ ] Tombol Refresh di Riwayat dan PR berfungsi
- [ ] Skeleton loading muncul saat data dimuat

---

## 10. RAPORT

- [ ] Raport murid tampil setelah dipublikasikan admin
- [ ] Nilai akhir dan predikat tampil (Mumtaz/Jayyid Jiddan/Jayyid/Maqbul/Belum Ada Data)
- [ ] Komponen nilai tampil termasuk "Kehadiran At-Tibyan" jika dikonfigurasi
- [ ] Raport murid tanpa data KBM → predikat "Belum Ada Data" bukan "Maqbul"
- [ ] Preview PDF berfungsi
- [ ] Tombol unduh PDF berfungsi

---

## 11. NOTIFIKASI & KEAKTIFAN

- [ ] Alert keaktifan muncul di dashboard murid jika absen ≥2 dalam 40 sesi
- [ ] Guru klik "Sudah Dihubungi" → alert di murid hilang
- [ ] Lonceng notifikasi murid menyimpan catatan permanen
- [ ] Alert At-Tibyan: murid Kritis/Peringatan tampil di keaktifan At-Tibyan guru
- [ ] Keaktifan KBM hanya menghitung sesi KBM Reguler (bukan At-Tibyan)
- [ ] Keaktifan murid: threshold Kritis ≥2 alpa, Peringatan 1 alpa

---

## 12. SUPERADMIN

- [ ] Login `superadmin` → menu **Observasi Guru** dan **Audit Log** muncul di sidebar
- [ ] Login `admin` biasa → kedua menu tersebut **tidak muncul**
- [ ] Label "Super Admin" tampil di sidebar
- [ ] Admin biasa tidak bisa akses endpoint `getAuditLog` (GAS return 403 jika dicoba)
- [ ] Admin biasa tidak bisa akses endpoint `getObservasiKBM` (GAS return 403)

---

## 13. OBSERVASI GURU (ADMIN — SUPERADMIN)

- [ ] Halaman Observasi Guru terbuka tanpa error
- [ ] Rekap per guru tampil: % kondisi kondusif, % tepat waktu, % ada latihan, distribusi kamera
- [ ] Warna indikator: hijau ≥80%, amber 60-79%, merah <60%
- [ ] Tabel detail sesi tampil dengan badge warna per kolom
- [ ] Filter per guru → data terfilter
- [ ] Filter per halaqah → data terfilter
- [ ] Klik Refresh → data reload

---

## 14. ASSIGN KETUA KELAS (SUPERADMIN)

- [ ] Di tabel Anggota login superadmin → tombol **Jadikan Ketua** muncul per baris
- [ ] Di tabel Anggota login admin biasa → tombol **tidak muncul**
- [ ] Klik Jadikan Ketua → konfirmasi → murid jadi ketua (sheet Anggota: `is_ketua = TRUE`)
- [ ] Jika ada ketua lama di halaqah yang sama → ketua lama otomatis dicabut
- [ ] Tombol berubah jadi **👑 Ketua** setelah ditunjuk
- [ ] Klik 👑 Ketua → konfirmasi pencabutan → tombol kembali ke "Jadikan Ketua"

---

## 15. KETUA KELAS — AKSES & TAMPILAN

- [ ] Login murid biasa → menu Ketua Kelas **tidak muncul** di sidebar
- [ ] Login murid yang `is_ketua = TRUE` → menu Ketua Kelas muncul di sidebar
- [ ] Badge angka di menu Ketua Kelas sesuai jumlah observasi pending
- [ ] Klik menu → halaman terbuka dengan nama halaqah yang benar
- [ ] Header: "Ketua Kelas · Halaqah [Nama]"

---

## 16. KETUA — TAB PANTAU ANGGOTA

- [ ] Summary cards Kritis/Peringatan/Normal KBM tampil
- [ ] Kartu anggota dengan % hadir, absen count, dots riwayat
- [ ] Murid diri sendiri **tidak muncul** di daftar
- [ ] Section KBM dan At-Tibyan terpisah jelas
- [ ] Tombol WA Reminder hanya untuk Kritis dan Peringatan
- [ ] Klik WA Reminder → WhatsApp terbuka dengan pesan personal terformat
- [ ] Murid tanpa no HP → tombol abu-abu + tidak bisa diklik
- [ ] Tombol Refresh → reload data terbaru
- [ ] Skeleton loading muncul saat data dimuat

---

## 17. KETUA — TEMPLATE REMINDER

- [ ] Tombol **Salin Template H-1** → teks tersalin, tombol berubah "Tersalin!" 2 detik
- [ ] Teks H-1 mengandung: nama halaqah, level, hari besok, jam kelas
- [ ] Tombol **Salin Template Hari-H** → teks tersalin
- [ ] Teks Hari-H mengandung jam kelas hari ini
- [ ] Tombol **Salin Template H+1 Latihan** → teks tersalin
- [ ] Teks H+1 berisi pesan motivasi latihan mandiri

---

## 18. KETUA — OBSERVASI KBM

- [ ] List sesi tampil dengan status: Terbuka / Terkunci / Sudah Diobservasi
- [ ] Sesi Terbuka: tombol Observasi aktif + badge "Rekap belum dikirim" amber
- [ ] Sesi Terkunci: tidak ada tombol Observasi, keterangan sesi yang mengunci
- [ ] Sesi Sudah Diobservasi: badge hijau, tidak ada tombol Observasi

**Form Observasi:**
- [ ] Klik Observasi → modal terbuka dengan judul sesi yang benar
- [ ] Semua 5 poin tersedia: kondisi kelas, latihan, ketepatan waktu, kamera peserta, catatan
- [ ] Klik opsi → pilihan ter-highlight dengan benar
- [ ] Input menit **muncul** saat pilih "Guru Terlambat" atau "Keduanya"
- [ ] Input menit **tersembunyi** saat pilih "Tepat Waktu" atau "Diakhiri Lebih Awal"
- [ ] Submit tanpa isi semua wajib → toast error menyebut field yang kurang
- [ ] Submit lengkap → sukses, modal tutup, badge observasi update
- [ ] Setelah submit → sesi tidak bisa diobservasi ulang (error "sudah disubmit")
- [ ] Data observasi tersimpan di sheet `Observasi_KBM` (cek di spreadsheet)
- [ ] Data di sheet `Observasi_KBM` hanya bisa dilihat admin (tidak ada di endpoint guru)

---

## 19. KETUA — REKAP KBM

- [ ] Tombol **Rekap** muncul di sesi yang belum direkap (status terbuka/selesai)
- [ ] Klik Rekap → modal terbuka, data jurnal guru terisi otomatis (materi, latihan, deadline)
- [ ] Field "Catatan Penting Ustadz" kosong, bisa diisi
- [ ] Preview rekap update real-time saat mengetik catatan
- [ ] Preview berisi format baku: level, hari/tanggal, pertemuan, materi, catatan, latihan
- [ ] Tombol **Salin Rekap** → teks tersalin ke clipboard
- [ ] Tombol **Tandai Terkirim** → badge berubah jadi hijau "Rekap terkirim"
- [ ] Setelah tandai → tombol Rekap di list hilang, badge tetap hijau
- [ ] Sesi yang sudah direkap tidak bisa ditandai ulang (error "sudah ditandai")

---

## 20. KETUA — WINDOW LOGIC

- [ ] Setelah guru buka sesi KBM baru → sesi sebelumnya berubah jadi **Terkunci** di list ketua
- [ ] Sesi terkunci tidak bisa diisi observasi via GAS (return error)
- [ ] Hanya satu sesi berstatus Terbuka di waktu bersamaan

---

## 21. PWA & RESPONSIVITAS

- [ ] Menu "Install Aplikasi" di sidebar murid → modal panduan muncul
- [ ] Tab iOS/Android di modal switch dengan benar
- [ ] Auto-detect OS: iOS → tab iOS aktif, Android → tab Android aktif
- [ ] Dark mode toggle berfungsi di portal guru dan murid
- [ ] Tampilan mobile (HP) tidak ada yang terpotong
- [ ] Tablet ≥768px → layout lebih lebar
- [ ] Hard refresh (Cmd+Shift+R) → tidak ada error cache
- [ ] Service worker v3.9 aktif (cek di DevTools → Application → Service Workers)

---

## 22. SETUP & DATA DUMMY

- [ ] Jalankan `setupKetuaColumn()` di GAS → kolom `is_ketua` muncul di sheet Anggota
- [ ] Isi `is_ketua = TRUE` untuk satu murid → login → menu Ketua Kelas muncul
- [ ] Jalankan `seedAllData()` → semua sheet terisi data testing
- [ ] Data At-Tibyan 5 sesi tersedia di sheet `At-Tibyan_Sesi`
- [ ] Komponen raport 6 poin terkonfigurasi (total bobot = 100%)
- [ ] `setupRaportSheets()` dijalankan → sheet `Konfigurasi_Raport`, `Komponen_Raport`, `Catatan_Raport` ada

---

## CATATAN HASIL TESTING

> Catat item yang GAGAL di sini:

| Item | Masalah | Status |
|------|---------|--------|
| | | |
| | | |
| | | |

---

## GAS FILES YANG PERLU DEPLOY

Sebelum testing, pastikan semua file GAS sudah di-deploy:

| File Lokal | File di GAS Editor | Fungsi Kritis |
|-----------|-------------------|---------------|
| `Code.gs` | `Code.gs` | routeSuperAdmin, assignKetuaKelas |
| `Code-Admin.txt` | `Code_admin.gs` | getDashboardAdmin (fix typo) |
| `Code_guru.txt` | `Code_guru.gs` | hapusKBM, editPresensi (fix type mismatch) |
| `Code_ketua.txt` | `Code_ketua.gs` | Semua fungsi ketua |
| `Code_murid.gs` | `Code_murid.gs` | getDashboardMurid return is_ketua |
| `Code_assessment.gs` | `Code_assessment.gs` | fix id_guru comparison |
| `setup_dummy_data.gs` | `setup_dummy_data.gs` | setupKetuaColumn, seedAllData |
| `setup_raport_sheets.gs.txt` | `setup_raport_sheets.gs` | setupRaportSheets |

---

*Testing dilakukan pada: _________________ oleh: _________________*
