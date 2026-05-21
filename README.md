# 🕌 Portal Halaqah Rattililqur'an

Sistem manajemen KBM, hafalan Al-Qur'an, dan absensi berbasis  
**Google Apps Script** (backend) + **GitHub Pages** (frontend) + **PWA**.

---

## 📁 Struktur Repository

```
halaqah-rattililquran/         ← nama repo GitHub Anda
│
├── index.html                 ← halaman login utama (portal selector)
├── manifest.json              ← konfigurasi PWA
├── sw.js                      ← Service Worker (offline & cache)
│
├── assets/
│   ├── js/
│   │   ├── api.js             ← client API ke GAS (ganti BASE_URL)
│   │   ├── auth.js            ← helper auth & session
│   │   └── utils.js           ← fungsi utilitas umum
│   ├── css/
│   │   └── main.css           ← style global (opsional jika inline)
│   └── icons/
│       ├── icon-72.png
│       ├── icon-96.png
│       ├── icon-128.png
│       ├── icon-144.png
│       ├── icon-152.png
│       ├── icon-192.png       ← wajib untuk PWA
│       └── icon-512.png       ← wajib untuk PWA
│
├── admin/
│   └── index.html             ← dashboard admin
│
├── guru/
│   └── index.html             ← dashboard guru
│
├── murid/
│   └── index.html             ← dashboard murid
│
└── gas/                       ← (opsional, untuk referensi saja)
    ├── Code.gs
    ├── Code_admin.gs
    ├── Code_guru.gs
    └── Code_murid.gs
```

---

## 🚀 PANDUAN DEPLOY — LANGKAH DEMI LANGKAH

### BAGIAN A — Google Sheets & Apps Script (Backend)

---

#### ✅ Langkah 1 — Buat Google Spreadsheet

1. Buka [sheets.google.com](https://sheets.google.com)
2. Klik **+ Blank** → beri nama: `DB Halaqah Rattililqur'an`
3. Salin **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```
4. Simpan ID tersebut — akan dipakai di langkah 3.

---

#### ✅ Langkah 2 — Buat Google Apps Script Project

1. Buka [script.google.com](https://script.google.com)
2. Klik **New Project**
3. Ganti nama project: `Halaqah Rattililqur'an API`
4. Di panel kiri, klik ikon **+** di samping **Files**
5. Buat **4 file Script** berikut (klik `Script`):

| Nama File    | Isi dari                    |
|--------------|-----------------------------|
| `Code`       | Isi dari file `Code.gs`     |
| `Code_admin` | Isi dari file `Code_admin.gs` |
| `Code_guru`  | Isi dari file `Code_guru.gs`  |
| `Code_murid` | Isi dari file `Code_murid.gs` |

---

#### ✅ Langkah 3 — Konfigurasi Spreadsheet ID

Di file `Code.gs`, temukan baris:

```javascript
SPREADSHEET_ID: 'GANTI_DENGAN_SPREADSHEET_ID_ANDA',
```

Ganti dengan ID dari Langkah 1:

```javascript
SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
```

---

#### ✅ Langkah 4 — Inisialisasi Sheet (Jalankan Sekali)

1. Di editor GAS, pilih fungsi `initSpreadsheet` dari dropdown
2. Klik tombol **▶ Run**
3. Izinkan akses saat diminta (klik **Review Permissions** → pilih akun Google → **Allow**)
4. Tunggu hingga muncul alert: ✅ *Inisialisasi berhasil!*

> Sheet yang dibuat otomatis: `Users`, `Halaqah`, `Anggota`, `KBM_Log`, `Hafalan`, `Pengumuman`  
> Akun admin default: `admin@rattililquran.com` (NIS: `ADM-001`)

---

#### ✅ Langkah 5 — Deploy sebagai Web App

1. Klik **Deploy** → **New deployment**
2. Klik ikon ⚙️ di samping **Select type** → pilih **Web app**
3. Isi konfigurasi:

| Field                   | Nilai                        |
|-------------------------|------------------------------|
| Description             | `Halaqah API v1.0`           |
| Execute as              | **Me** (akun Anda)           |
| Who has access          | **Anyone** *(tanpa login)*   |

4. Klik **Deploy**
5. Salin **Web app URL** yang muncul:
   ```
   https://script.google.com/macros/s/AKfyc.../exec
   ```

---

### BAGIAN B — GitHub (Hosting Frontend)

---

#### ✅ Langkah 6 — Buat Repository GitHub

1. Buka [github.com](https://github.com) → Login
2. Klik **New repository**
3. Isi:
   - **Repository name**: `halaqah-rattililquran`
   - **Visibility**: Public *(wajib untuk GitHub Pages gratis)*
   - Centang **Add a README file**
4. Klik **Create repository**

---

#### ✅ Langkah 7 — Upload File ke GitHub

**Cara A — Via Web (mudah):**

1. Di halaman repo, klik **Add file** → **Upload files**
2. Upload semua file:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - Folder `assets/` (js, css, icons)
   - Folder `admin/`, `guru/`, `murid/`
3. Klik **Commit changes**

**Cara B — Via Git (disarankan):**

```bash
# Clone repo
git clone https://github.com/USERNAME/halaqah-rattililquran.git
cd halaqah-rattililquran

# Salin semua file ke folder ini
# lalu commit
git add .
git commit -m "feat: initial deploy Portal Halaqah"
git push origin main
```

---

#### ✅ Langkah 8 — Aktifkan GitHub Pages

1. Di repo GitHub, klik tab **Settings**
2. Di sidebar kiri, klik **Pages**
3. Di bagian **Source**, pilih:
   - Branch: **main**
   - Folder: **/ (root)**
4. Klik **Save**
5. Tunggu 1–2 menit → muncul URL:
   ```
   https://USERNAME.github.io/halaqah-rattililquran/
   ```

---

#### ✅ Langkah 9 — Hubungkan GAS URL ke Frontend

1. Buka file `assets/js/api.js`
2. Ganti baris:
   ```javascript
   const BASE_URL = 'GANTI_DENGAN_URL_GOOGLE_APPS_SCRIPT_DEPLOYMENT';
   ```
   Dengan URL dari Langkah 5:
   ```javascript
   const BASE_URL = 'https://script.google.com/macros/s/AKfyc.../exec';
   ```
3. Commit & push ke GitHub
4. Tunggu beberapa detik → GitHub Pages otomatis update

---

### BAGIAN C — Ikon PWA

---

#### ✅ Langkah 10 — Buat Ikon Aplikasi

1. Buka [pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
2. Upload gambar logo Rattililqur'an (minimal 512×512 px)
3. Generate → download ZIP
4. Ekstrak dan upload semua ikon ke folder `assets/icons/` di repo

---

### BAGIAN D — Verifikasi & Testing

---

#### ✅ Langkah 11 — Test di Browser

Buka URL GitHub Pages Anda:
```
https://USERNAME.github.io/halaqah-rattililquran/
```

Checklist:
- [ ] Halaman login tampil dengan benar
- [ ] Pilih role → form berubah warna & teks
- [ ] Input NIS + password → klik Masuk
- [ ] Muncul loading overlay
- [ ] Redirect ke portal yang tepat

---

#### ✅ Langkah 12 — Test PWA Install

**Di Android (Chrome):**
1. Buka URL di Chrome
2. Tunggu 3 detik → muncul banner "Install Aplikasi Halaqah"
3. Klik **Install** → aplikasi muncul di home screen

**Di iOS (Safari):**
1. Buka URL di Safari
2. Tap ikon **Share** (kotak dengan panah atas)
3. Pilih **Add to Home Screen**
4. Tap **Add**

**Di Desktop (Chrome/Edge):**
1. Klik ikon install di address bar (📥)
2. Klik **Install**

---

#### ✅ Langkah 13 — Test Offline

1. Buka DevTools (F12) → tab **Network**
2. Centang **Offline**
3. Reload halaman
4. Harus muncul halaman offline atau halaman dari cache

---

## 🔧 KONFIGURASI LANJUTAN

### Custom Domain (Opsional)

1. Beli domain (misal: `halaqah.rattililquran.com`)
2. Di GitHub Pages Settings → **Custom domain** → masukkan domain
3. Di DNS provider, tambah record:
   ```
   CNAME  halaqah  USERNAME.github.io
   ```
4. Centang **Enforce HTTPS**

### CORS di GAS

Jika ada error CORS di browser, tambahkan di `Code.gs`:

```javascript
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON);
}
```

Dan pastikan deployment GAS menggunakan **"Anyone"** bukan "Anyone with Google Account".

### Update Deployment GAS

Setiap kali kode GAS diubah:
1. Klik **Deploy** → **Manage deployments**
2. Klik ✏️ (edit) pada deployment aktif
3. **Version** → pilih **New version**
4. Klik **Deploy**

> ⚠️ URL Web App tidak berubah saat update — tidak perlu ganti `BASE_URL` di frontend.

---

## 🛡️ KEAMANAN

| Aspek              | Implementasi                                        |
|--------------------|-----------------------------------------------------|
| Autentikasi        | Token 40-char via PropertiesService (8 jam expire)  |
| Role guard         | Setiap endpoint dicek role di server (GAS)         |
| Data sensitif      | Password tidak pernah dikirim ke client             |
| HTTPS              | Otomatis oleh GitHub Pages                          |
| Token storage      | sessionStorage (default) atau localStorage (remember me) |

---

## 📞 SUPPORT

| Kontak              | Info                              |
|---------------------|-----------------------------------|
| Email Admin         | admin@rattililquran.com           |
| GitHub Issues       | github.com/USERNAME/halaqah-rattililquran/issues |

---

*Dibuat dengan ❤️ untuk Rattililqur'an — sistem halaqah digital berbasis Google Workspace*
