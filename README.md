# 📖 Portal Halaqah Rattililqur'an

PWA (*Progressive Web App*) Sistem Manajemen Halaqah Tahsin & Tahfidz Al-Qur'an Online — **Rattililqur'an**.

Aplikasi ini dibangun menggunakan arsitektur **Modular SPA & PWA Offline-First** dengan teknologi Vanilla HTML5, CSS3, JavaScript ES6+, dan backend **Supabase**.

---

## 🏛️ Arsitektur Proyek & Struktur Modul

Proyek ini telah dimodularisasi dari berkas monolitik menjadi **21 Modul JavaScript Terpisah** yang terbagi dalam 3 portal utama:

```
Portal-Halaqah-Rattililquran/
├── admin/                        # 🏛️ Portal Admin & Manajemen Akademik
│   ├── index.html                # Entry Point SPA Admin
│   ├── guru-module.js            # Modul Data Guru, Penugasan & Observasi Superadmin
│   ├── murid-module.js           # Modul Data Murid & Import Terintegrasi 3 Tahap
│   ├── kelompok-module.js        # Modul Kelompok Belajar, Partner Qiyam & Ketua Kelas
│   ├── spp-keuangan-module.js    # Modul SPP, Infaq, Metode Bayar & Kas Beasiswa/Operasional
│   ├── konten-module.js          # Modul Pengumuman, Push Notif, Target Level, At-Tibyan & Materi
│   └── laporan-module.js         # Modul Arsip Data & Executive Analytics Dashboard
│
├── murid/                        # 👨‍🎓 Portal Murid & Santri
│   ├── index.html                # Entry Point SPA Murid
│   ├── spp-module.js             # Modul SPP, Infaq, Pembayaran & Mode Beasiswa
│   ├── partner-module.js         # Modul Partner Qiyam & Partner Belajar (Level 1-4)
│   ├── charging-module.js        # Modul Charging Notes (Afirmasi & Penyemangat)
│   ├── hafalan-module.js         # Modul Setoran Hafalan & Perekaman Suara Qiyam (IndexedDB)
│   ├── attibyan-module.js        # Modul Kajian At-Tibyan & Tab Kehadiranku
│   ├── saran-observasi-module.js # Modul Observasi KBM (Ketua Kelas) & Reminder WA
│   └── raport-module.js          # Modul Raport Tahfidz, Peta Juz & Unduh PDF
│
├── guru/                         # 👨‍🏫 Portal Guru & Pengajar
│   ├── index.html                # Entry Point SPA Guru
│   ├── jadwal-module.js          # Modul Jadwal KBM & Kalender Guru
│   ├── dashboard-module.js       # Modul Ringkasan Statistics & Kartu Halaqah
│   ├── kelompok-module.js        # Modul Manajemen Kelompok Belajar & Partner Qiyam Guru
│   ├── attibyan-module.js        # Modul Penilaian At-Tibyan & Rekap Keaktifan Guru
│   ├── raport-module.js          # Modul Penyusunan & Cetak Raport Murid
│   ├── kbm-module.js             # Modul Buka KBM, Presensi, Microteaching & Hafalan Qiyam
│   ├── pr-jurnal-module.js       # Modul Peninjauan PR, Perekaman Suara Guru & Jurnal
│   └── hafalan-module.js         # Modul Setoran Guru & Konfigurasi Penilaian
│
├── assets/                       # 🎨 Aset Statis Shared (CSS, JS Utilitas, Gambar, Font)
│   ├── js/shared-utils.js        # Utilitas Umum, Toast, Modal, State Manager (window.HQ)
│   ├── confirm-modal.js          # Modal Konfirmasi Reusable
│   └── push-permission.js        # Push Notification Service Manager
│
├── supabase/                     # ⚡ Supabase Client API Helper
│   └── supabase-client.js        # Client Database Helper API
│
└── sw.js                         # 📲 Service Worker PWA (Offline-First Cache v8.57)
```

---

## 🌟 Fitur Utama Aplikasi

### 1. 🏛️ Portal Admin
- **Manajemen Guru & Murid**: Pengelolaan data guru, penugasan halaqah, status keaktifan murid, dan mutasi.
- **Import Terintegrasi 3 Tahap**: Import data massal dari Excel/CSV untuk Halaqah, Users, dan Anggota.
- **Keuangan & Kas Beasiswa**: Verifikasi bukti pembayaran SPP/Infaq, metode bayar QRIS/Transfer, dan pencatatan mutasi kas operasional.
- **Pengumuman & Broadcast Push**: Pengiriman notifikasi push langsung ke perangkat guru & murid.
- **Executive Analytics**: Dashboard rekapitulasi keaktifan, pencapaian target hafalan, dan analisis raport.

### 2. 👨‍🎓 Portal Murid
- **Setoran Hafalan & Voice Recording**: Perekaman audio bacaan secara lokal dan pengiriman setoran hafalan.
- **Partner Qiyam & Belajar**: Kolaborasi antar murid untuk menyimak hafalan dan kegiatan belajar bersama.
- **Raport Tahfidz & Download PDF**: Peta kematangan Juz 1–30, statistik kelancaran, dan cetak PDF resmi.
- **Charging Notes**: Catatan penyemangat pribadi dengan tampilan kartu afirmasi fullscreen.
- **SPP & Mode Beasiswa**: Transparansi tagihan SPP, bukti bayar infaq, dan penyesuaian khusus penerima beasiswa.

### 3. 👨‍🏫 Portal Guru
- **Buka KBM & Presensi**: Pelaksanaan kelas KBM realtime, pencatatan presensi, dan penilaian *microteaching*.
- **Peninjauan PR & Audio Feedback**: Penilaian tugas rumah murid beserta balasan pesan suara (*voice note*).
- **Rekap At-Tibyan & Raport**: Penilaian kajian keislaman dan pengisian raport berkala murid.

---

## 💻 Panduan Pengembangan (Developer Guide)

### 1. Menjalankan Server Lokal
Gunakan HTTP server sederhana di direktori akar:
```bash
# Menggunakan Python
python3 -m http.server 8080

# Atau menggunakan Node npx
npx serve -p 8080
```
Buka peramban di:
- Portal Admin: `http://localhost:8080/admin/`
- Portal Murid: `http://localhost:8080/murid/`
- Portal Guru: `http://localhost:8080/guru/`

### 2. Memeriksa Sintaks JS Modul
Jalankan perintah pengujian sintaks `node -c` untuk memastikan tidak ada *SyntaxError*:
```bash
node -c admin/*.js murid/*.js guru/*.js assets/js/*.js
```

### 3. Memeriksa Kompilasi Blok Script SPA
Jalankan pengujian kompilasi `vm.Script` pada Node.js:
```bash
node -e '
const fs = require("fs"), vm = require("vm");
["admin/index.html", "murid/index.html", "guru/index.html"].forEach(file => {
  const html = fs.readFileSync(file, "utf8");
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match, count = 0;
  while ((match = regex.exec(html)) !== null) {
    count++;
    if (!match[1].trim()) continue;
    new vm.Script(match[1], { filename: `${file}#${count}` });
  }
  console.log(`✅ ${file} script blocks OK!`);
});
'
```

---

## 🔒 PWA Service Worker (`sw.js`)

Aplikasi ini dilengkapi Service Worker `sw.js` dengan strategi:
1. **Network-First** untuk halaman utama (`index.html`, `/guru/`, `/murid/`, `/admin/`) agar pengguna selalu mendapat pembaruan terkini saat online, dan fallback offline saat tidak ada sinyal.
2. **Stale-While-Revalidate** untuk seluruh 21 modul JavaScript, file CSS, font, dan gambar sehingga PWA dapat dibuka secara *offline-first*.
