# Saran & Rencana Penataan Ulang Beranda (Dashboard Murid)

Dokumen ini merangkum hasil telaah mendalam terhadap halaman Beranda Portal Murid (`murid/index.html`, `id="page-dashboard"`) beserta rencana perbaikannya. Ditulis 2026-08-26, hasil investigasi 3 agen eksplorasi paralel yang menelusuri kode sampai ke nomor baris & fungsi JS sebelum eksekusi dimulai.

## Kenapa dokumen ini dibuat

Selama beberapa sesi kerja, halaman Beranda menumpuk sisa-sisa iterasi fitur: kartu yang sengaja disembunyikan permanen tapi kodenya tetap jalan tiap kali halaman dimuat, dua kartu berbeda untuk satu fitur yang sama (Partner Belajar) dengan syarat tampil yang ternyata tidak identik, kartu dengan gaya visual lama (gradient) yang belum ikut diflatkan seperti kartu-kartu lain, dan urutan kartu yang tidak mencerminkan prioritas urgensi murid (PR Aktif nyaris di paling bawah halaman).

## Temuan per topik

### 1. Kartu Rattil Quiz — preview duplikat, aman dihapus
Kartu `dashQuizCard` di Beranda (`disembunyikan dari Beranda` secara permanen sejak sebelumnya) sudah null-safe dan terisolasi dalam `try/catch` sendiri saat dirender. Fitur Quiz-nya sendiri **tetap hidup penuh** lewat sidebar "Rattil Quiz" → halaman `/kuis`. Kartu Beranda ini murni preview yang tidak pernah terlihat siapa pun — sekaligus memicu 1 API call (`getKuisTersedia()`) yang terus jalan tiap load dashboard tanpa hasil yang pernah tampak.

### 2. Kartu statistik (`stats-grid`) — mati tapi berbahaya kalau dihapus sembarangan
4 kartu statistik (% Hadir, Sesi, Poin Adab, Poin Kamera) disembunyikan permanen, tapi baris JS yang mengisinya **tidak punya null-check**. Kalau HTML-nya dihapus tanpa menyentuh JS yang bersangkutan, seluruh sisa proses render Beranda (profil, avatar, kalender, SPP, notifikasi) akan ikut gagal karena satu `TypeError` di tengah jalan. Menyembunyikan kartu ini juga membuat dua modal ("Rincian Poin Adab" & "Rincian Poin Kamera") jadi sama sekali tidak terjangkau user — orphan penuh.

### 3. Elemen legacy "Kehadiranku" — peninggalan sistem UI lama
Beberapa elemen (chip Level, Target, Estimasi selesai, teks motivasi) adalah sisa dari sebelum kartu "Kehadiranku" versi gabungan (KBM Reguler + At-Tibyan) dibuat. Info yang sama sekarang tersaji lewat modal "Kehadiranku" yang terbuka saat kartu diklik — jadi bukan info yang hilang, cuma pindah jalur tampil.

### 4. Dua kartu Partner Belajar — bug nyata, perlu digabung
Kartu ringkasan (`dashPartnerBelajarCard`, dua-arah: notifikasi konfirmasi + status kelompok) dan kartu form (`dashPbCard`, form "Lapor Aktivitas") ternyata punya **syarat tampil yang tidak identik** — untuk murid tertentu, satu kartu bisa tampil sementara yang lain tidak, padahal keduanya soal fitur yang sama. Ditambah lagi, dua variabel penyimpan status kelompok yang seharusnya sama malah terpisah antar dua file JS, dijembatani dengan cara yang rapuh. Form di Beranda juga cuma versi sederhana dari form lengkap yang sudah ada di halaman Partner Belajar sendiri (kurang field Durasi & mode Edit) — jadi menyederhanakan tampilan di Beranda tidak menghilangkan kemampuan apa pun.

### 5. Urutan kartu — PR Aktif nyaris di paling bawah
Latihan Mandiri (PR) yang sifatnya deadline-driven ditaruh di posisi hampir paling akhir halaman, di bawah ringkasan SPP dan form Partner Belajar. Tidak ada satu pun kode yang bergantung pada urutan kartu-kartu ini — semuanya diakses lewat ID masing-masing — jadi pemindahan posisi murni aman.

### 6. Micro Teaching — gaya visual belum ikut diseragamkan
Kartu Partner Qiyam/Belajar sudah diflatkan minimalis di sesi sebelumnya, tapi kartu Micro Teaching masih memakai gradient ungu mencolok (di HTML, CSS, dan sebagian di-set langsung oleh JS) — belum konsisten dengan arah desain flat yang sudah diterapkan ke kartu-kartu lain.

## Rencana eksekusi (6 tahap, urut dari risiko terendah)

- [ ] **Tahap 1** — Hapus kartu Rattil Quiz dari Beranda (markup + JS render + 1 API call yang jadi tak perlu).
- [ ] **Tahap 2** — Hapus `stats-grid` beserta 2 modal & 2 fungsi yang jadi orphan setelahnya (HTML + JS dihapus bersamaan, karena tanpa null-check).
- [ ] **Tahap 3** — Bersihkan elemen legacy "Kehadiranku" (chip Level/Target/Estimasi/Motivasi) yang sudah tergantikan oleh modal.
- [ ] **Tahap 4** — Naikkan posisi kartu PR Aktif ke lebih atas, dekat kartu-kartu status personal lain.
- [ ] **Tahap 5** — Gabung dua kartu Partner Belajar jadi satu: ringkasan dua-arah sebagai konten utama, form lapor sebagai tombol/CTA sekunder, sekaligus samakan syarat tampil dan satukan sumber data yang tadinya redundan.
- [ ] **Tahap 6** — Seragamkan gaya visual Micro Teaching ke gaya flat yang sama dengan kartu Partner.

Setiap tahap dieksekusi & di-commit terpisah, diverifikasi (tag-balance HTML + cek syntax JS) sebelum lanjut ke tahap berikutnya — detail teknis lengkap (nomor baris, nama fungsi) ada di riwayat kerja sesi ini.
