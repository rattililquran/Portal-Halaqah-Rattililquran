# 📋 Laporan Analisis & Evaluasi Sistem Keranjang Setoran KBM Qiyam
**Portal-Halaqah-Rattililquran**  
*Tanggal Evaluasi: 31 Juli 2026*

---

## 📌 Ringkasan Eksekutif

Pemeriksaan menyeluruh terhadap sistem **Keranjang Setoran (Staging List)** pada modul **KBM Qiyam** (`guru/kbm-module.js`, `guru/index.html`, `api-staff.js`) telah selesai dilakukan. Sistem dirancang untuk memfasilitasi guru dalam menginputkan beberapa surat/setoran sekaligus untuk satu murid dalam satu sesi KBM Qiyam sebelum difinalisasi ke jurnal.

---

## 1. 🔍 Apakah Sistem Berjalan Normal?

**JAWABAN: YA, BERJALAN NORMAL DAN SANGAT STABIL.**

Sistem Keranjang Setoran KBM Qiyam telah diimplementasikan dengan arsitektur yang solid, menangani alur *staging*, validasi, komparasi data Ziyadah DB, pemulihan draf, hingga pengiriman batch ke database.

### Detail Pemeriksaan Fungsionalitas:
1. **Manajemen Staging List (Tambah / Edit / Hapus Item):**
   - `addHafalanKbmItem(mid)`: Berhasil mengumpulkan input (jenis, surat, range ayat, juz, kelancaran, nilai, kamera, catatan) dan menambahkannya ke array `window._hafalanKbmCache[mid]`. Form input langsung ter-reset bersih untuk persiapan item berikutnya.
   - `editHafalanKbmItem(mid, index)`: Mengeluarkan item dari keranjang dan mengembalikan nilainya ke form editor untuk disesuaikan kembali.
   - `removeHafalanKbmItem(mid, index)`: Menghapus item dari keranjang secara responsif dan memperbarui estimasi total poin.

2. **Validasi & Proteksi Integritas Data:**
   - **Validasi Dasar:** Memeriksa kelengkapan input (Surat, Ayat Dari ≤ Ayat Sampai, Juz) serta memastikan range ayat tidak melebihi batas max ayat surat (berdasarkan `_getSuratData()`).
   - **Cek Overlap Ziyadah (Smart Validation):** Memeriksa potensi tumpang tindih hafalan baru Ziyadah terhadap data Ziyadah tersimpan di DB (`_hfKbmZiyadah`) **sekaligus** item Ziyadah lain yang sedang ada di dalam keranjang.
   - **Fitur Auto-Split Ziyadah (`tryAutoSplitZiyadah`):** Jika guru memasukkan range Ziyadah yang tumpang tindih sebagian (misal: Ziyadah disetor ayat 8–15 padahal ayat 1–10 sudah disetor sebelumnya), sistem secara otomatis memicu dialog interaktif *Auto-Split* untuk memecah input menjadi **Murajaah (8–10)** + **Ziyadah Baru (11–15)**.
   - **Cek Containment Murajaah:** Memastikan range Murajaah berada di dalam cakupan Ziyadah yang sudah disetor sebelumnya di DB.

3. **Keamanan Draf & Persistensi (Offline / Refresh Safety):**
   - Menggunakan sinkronisasi 2 lapis (`_saveHafalanKbmCache`, `_restoreHafalanKbmCache`, debounced autosave ke `localStorage` & `kbm_draft` DB server).
   - Jika browser ter-refresh, mati lampu, atau pindah device, data keranjang **tidak akan hilang** dan ter-restore otomatis saat sesi KBM dibuka kembali.

4. **Single-Item Fallback Guard:**
   - Jika guru mengisi field setoran 1 surat tetapi **lupa menekan tombol "+ Tambah Surat Ke Keranjang Setoran"**, fungsi `_saveHafalanKbmCache()` secara cerdas mendeteksi keranjang yang kosong dan otomatis mengepak item di form aktif tersebut sebagai item tunggal saat berpindah ke Step Jurnal.

5. **Finalisasi & Integrasi Edit KBM:**
   - **Tutup Sesi (`simpanJurnal`):** Melakukan iterasi batch `addSetoranHafalan` per item keranjang, disertai penanda `_saved = true` per item agar aman dari *duplicate insert* jika ada kegagalan koneksi sebagian.
   - **Edit Nilai KBM (`renderEditNilaiQiyam`):** Mendukung rendering N sub-kartu per murid berdasar `hafalan_list`, sehingga guru tetap dapat mengedit nilai/kelancaran dari sesi KBM yang berisi multi-setoran tanpa terkunci.

---

## 2. 🔀 Apakah Bisa Multi-Jenis dalam Satu Keranjang?

**JAWABAN: YA, BISA (LENGKAP & FULLY SUPPORTED).**

Sistem keranjang dirancang modular di mana setiap item (*chip/card*) dalam keranjang menyimpan metadata `jenis`-nya masing-masing.

### Karakteristik Multi-Jenis dalam 1 Keranjang:
- **Kombinasi Bebas:** Dalam 1 keranjang murid, guru bisa mencampurkan:
  - 📖 **Ziyadah** (Warna Indikator: Emerald Green `#10b981`)
  - 🔄 **Murajaah** (Warna Indikator: Amber Yellow `#f59e0b`)
  - ✨ **Tahsin** (Warna Indikator: Purple `#8b5cf6`)
- **Independensi Evaluasi:** Setiap jenis setoran mempertahankan skor Kelancaran, Makhraj & Tajwid, serta Catatan Guru secara mandiri.
- **Akumulasi Poin Sesi:** Fungsi `updateHfKbmPoin(mid)` menghitung total estimasi poin akumulatif dari seluruh item dalam keranjang (apapun kombinasi jenisnya).
- **Format Penyimpanan DB:** Saat finalisasi, masing-masing item dimasukkan sebagai 1 baris terpisah di tabel `setoran_hafalan` dengan nilai kolom `jenis` sesuai item keranjang masing-masing.

---

## 3. 💡 Saran Enhancement (Rekomendasi Pengembangan)

Untuk meningkatkan efisiensi kerja guru dan kenyamanan UX, berikut adalah saran enhancement yang dapat dipertimbangkan:

| No | Fitur Enhancement | Deskripsi & Manfaat | Prioritas |
|---|---|---|---|
| 1 | **Header Summary Keranjang (Mini Dashboard)** | Menampilkan akumulasi total di atas keranjang murid, misal: `📋 Keranjang Setoran (3 Surat: 1 Ziyadah, 2 Murajaah · Total 45 Ayat)`. Memudahkan guru melihat ringkasan volume hafalan sebelum disimpan. | **Sedang** |
| 2 | **Tombol Duplikat Item (`📋 Quick Duplicate`)** | Tombol aksi cepat untuk menduplikasi nilai/kelancaran/kamera dari item sebelumnya saat murid menyetor beberapa surat berturut-turut dengan performa yang sama. | **Sedang** |
| 3 | **Quick Presets / Multi-Surat Pendek** | Preset sekali-klik untuk menyetor paket surat pendek (misal: An-Nas s.d. Al-Ikhlas) tanpa perlu menambahkannya satu per satu ke keranjang. | **Rendah** |
| 4 | **Batch Insert Transaksional (RPC Supabase)** | Mengubah loop pengiriman HTTP `addSetoranHafalan` menjadi satu pemanggilan RPC Batch Transaksional (`add_setoran_hafalan_batch`). Menjamin sifat *atomic* (All-or-Nothing) pada tingkat database saat jaringan tidak stabil. | **Tinggi (Backend)** |
| 5 | **Impor dari Partner Qiyam** | Integrasi tombol "Impor dari Setoran Partner Qiyam" untuk menyedot data rekaman setoran mandiri murid langsung masuk ke keranjang KBM Qiyam guru. | **Sedang** |

---

## 📄 Kesimpulan

Sistem Keranjang Setoran KBM Qiyam **sudah berjalan normal, stabil, mendukung multi-jenis setoran secara penuh**, serta memiliki mekanisme autosave/pembagian otomatis (Auto-Split) yang sangat responsif. Fitur ini siap digunakan dan memberikan pengalaman input data yang efisien bagi guru.
