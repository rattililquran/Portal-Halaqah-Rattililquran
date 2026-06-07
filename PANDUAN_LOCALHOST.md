# Panduan Aktivasi Localhost & Kartu Login Portal Halaqah Rattililqur'an

Dokumen ini berisi informasi mengenai cara mengaktifkan server localhost di macOS, tautan akses portal, dan kartu login (kredensial) akun uji coba.

---

## 1. Cara Aktivasi Local Host di macOS

Karena portal ini menggunakan berkas HTML, JavaScript, dan CSS statis, Anda dapat menjalankan server web statis lokal menggunakan **Terminal** di macOS dengan beberapa alternatif berikut:

### **Metode A: Menggunakan Node.js (Sangat Direkomendasikan)**
Jika Anda sudah memiliki Node.js terinstal, Anda dapat menggunakan modul `http-server` secara langsung tanpa instalasi permanen:
```bash
npx http-server -p 8080
```

### **Metode B: Menggunakan Python 3 (Bawaan macOS)**
macOS biasanya sudah dilengkapi dengan Python 3. Anda dapat menggunakannya untuk membuat web server instan:
```bash
python3 -m http.server 8080
```

### **Metode C: Menggunakan Ekstensi VS Code (Live Server)**
Jika Anda membuka proyek menggunakan VS Code:
1. Pasang ekstensi **Live Server** oleh Ritwick Dey.
2. Klik tombol **Go Live** pada bilah status di pojok kanan bawah editor VS Code.

> [!NOTE]
> Pastikan Anda menjalankan perintah Terminal di atas tepat di dalam direktori root proyek:
> `/Users/mangica/Project/Rattil/Portal Manajemen/Portal-Halaqah-Rattililquran`

---

## 2. Link Akses Portal (Localhost)

Setelah server localhost berjalan di port `8080`, Anda dapat mengakses portal-portal berikut di browser Anda:

*   **Halaman Utama & Login:** [http://localhost:8080/](http://localhost:8080/) (merujuk ke [index.html](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/index.html))
*   **Portal Admin:** [http://localhost:8080/admin/](http://localhost:8080/admin/) (merujuk ke [admin/index.html](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/admin/index.html))
*   **Portal Guru:** [http://localhost:8080/guru/](http://localhost:8080/guru/) (merujuk ke [guru/index.html](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/guru/index.html))
*   **Portal Murid / Ketua Kelas:** [http://localhost:8080/murid/](http://localhost:8080/murid/) (merujuk ke [murid/index.html](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/murid/index.html))
*   **Daftar Checklist Pengujian:** [http://localhost:8080/testing-checklist.html](http://localhost:8080/testing-checklist.html) (merujuk ke [testing-checklist.html](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/testing-checklist.html))

---

## 3. Kartu Login (Kredensial Akun Dummy)

Gunakan akun-akun uji coba di bawah ini untuk masuk ke portal masing-masing. Seluruh kredensial bersumber dari seed database ([001_seed_master.sql](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/supabase/seed/001_seed_master.sql) dan [002_seed_superadmin.sql](file:///Users/mangica/Project/Rattil/Portal%20Manajemen/Portal-Halaqah-Rattililquran/supabase/seed/002_seed_superadmin.sql)):

| Role | Username (ID User) | Password | Nama Lengkap / Deskripsi |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `SUPERADMIN-001` | `superadmin123` | Super Administrator (Akses penuh) |
| **Admin** | `ADMIN-001` | `admin123` | Administrator Utama |
| **Guru (Laki-laki)** | `UMAR` | `654321` | Al-Ustadz Umar Abdul Aziz |
| **Guru (Perempuan)** | `NISA` | `654321` | Al-Ustadzah Annisa Rizkya Rahmawati |
| **Ketua Kelas** | `RTL24180253` | `123456` | Vidyah Nawang Sari (Halaqah Maryam) |
| **Murid Biasa** | `RTL24180250` | `123456` | Nur Lindatul Hidayah (Halaqah Maryam) |
