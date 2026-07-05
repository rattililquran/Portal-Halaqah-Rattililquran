# Panduan Import Soal via CSV — Portal Manajemen Rattililqur'an

Dokumen ini menjelaskan format pengisian berkas template CSV untuk mengimpor soal secara massal ke dalam database sistem.

---

## 🔍 Penjelasan Simbol Kustom

Untuk menyisipkan data berbentuk daftar atau struktur dinamis di dalam satu kolom CSV, kita menggunakan simbol berikut:

| Simbol | Nama | Fungsi Utama | Contoh Penggunaan |
| :---: | :--- | :--- | :--- |
| **`|`** | **Pipe** | Pemisah antar item (pilihan, pasangan, atau kunci jawaban) | `A|B|C` |
| **`*`** | **Asterisk** | Penanda pilihan jawaban benar (letakan di akhir opsi) | `Benar*|Salah` |
| **`:`** | **Colon** | Pemisah pasangan kiri & kanan (tipe menjodohkan) | `Aqshal:Hamzah` |
| **`,`** | **Comma** | Pemisah jika soal dimasukan ke beberapa level halaqah | `Level 1,Level 2` |

---

## 📖 Panduan Kolom Template CSV

Berkas template menggunakan pemisah titik koma (`;`) dan memiliki kolom berikut:

1. **`tipe_soal`** *(Wajib)*: Jenis soal yang akan dibuat. Nilai yang didukung:
   * `pilihan_ganda`
   * `benar_salah`
   * `matching`
   * `audio`
   * `teks_arab`
   * `isian_singkat`
2. **`teks_soal`** *(Wajib)*: Teks pertanyaan dalam huruf latin.
3. **`teks_arab`** *(Opsional)*: Teks Arab jika memilih tipe `teks_arab`.
4. **`audio_url`** *(Opsional)*: URL audio jika memilih tipe `audio`.
5. **`pilihan`**: Opsi jawaban dipisah `|`. Akhiri pilihan yang benar dengan `*`. *(Wajib untuk tipe pilihan_ganda, benar_salah, audio, teks_arab)*.
6. **`pasangan`**: Pasangan menjodohkan dengan format `Kiri:Kanan` dipisah `|`. *(Wajib untuk tipe matching)*.
7. **`kunci_isian`**: Kunci jawaban benar dipisah `|`. *(Wajib untuk tipe isian_singkat)*.
8. **`levels`** *(Opsional)*: Kategori level halaqah dipisah koma (`,`). Pilihan level: `Level 1`, `Level 2`, `Level 3`, `Level Qiyam`, `Micro Teaching`, `Tahsin Al-Fatihah`.
9. **`rekomendasi_pertemuan_ke`** *(Opsional)*: Angka rekomendasi pertemuan ke berapa soal ini digunakan (contoh: `23`).

---

## 💡 Contoh Pengisian Baris CSV

| tipe_soal | teks_soal | teks_arab | audio_url | pilihan | pasangan | kunci_isian | levels | rekomendasi_pertemuan_ke |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`pilihan_ganda`** | Huruf Wasatul Halq adalah? | | | `ع*|غ|ء` | | | `Level 1` | `23` |
| **`benar_salah`** | ع keluar dari Wasatul Halq. | | | `Benar*|Salah` | | | `Level 1` | `23` |
| **`isian_singkat`** | Berapa total huruf Al-Halq? | | | | | `6|enam` | `Level 1` | `23` |
| **`matching`** | Jodohkan makhraj & hurufnya | | | | `Aqshal:Hamzah|Wasatul:Ain` | | `Level 1` | |

---

## 🛠️ Tips & Penyelamatan Error

* **Gunakan Editor yang Tepat**: Disarankan mengedit CSV menggunakan Google Sheets atau Microsoft Excel, lalu simpan dengan format **CSV (UTF-8, semicolon-separated)**.
* **Separator**: Pastikan file menggunakan pemisah titik koma (`;`), bukan koma (`,`), karena karakter koma digunakan untuk memisahkan daftar level.
* **Pratinjau Sebelum Impor**: Gunakan area pratinjau (*preview table*) pada modal admin untuk mengecek status `Valid` atau `Error` dari masing-masing soal sebelum melakukan impor.
