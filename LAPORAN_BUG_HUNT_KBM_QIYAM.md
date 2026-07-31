# 🐞 Laporan Deep Bug Hunt & Rencana Perbaikan Sistem KBM Qiyam
**Portal-Halaqah-Rattililquran**  
*Tanggal: 31 Juli 2026*  
*Target File Utama:* `guru/kbm-module.js`, `supabase/api-staff.js`, `guru/index.html`

---

## 📌 Ringkasan Eksekutif

Hasil penelusuran mendalam (*deep bug hunt*) pada sistem KBM Qiyam mengungkapkan **6 bug & titik rawan (vulnerabilities)** yang berdampak pada **hilangnya data Target Hafalan murid (data loss)**, **dead code pada restorasi draf**, **race condition status kamera**, **state loss saat edit item**, dan **duplikasi data saat terjadi gangguan koneksi internet (partial network failure)**.

Laporan ini menyajikan analisis detail penyebab (*root cause*), dampak, serta **rencana langkah perbaikan lengkap (step-by-step fix plan)**.

---

## 🔍 Temuan Bug & Analisis Root Cause

### 🔴 BUG #1 (CRITICAL - DATA LOSS): Target Hafalan Hilang dari Database saat Menggunakan Keranjang Setoran

* **Gejala:** Target Hafalan yang diisi guru tidak tersimpan ke database (bernilai `NULL` di Supabase) jika guru menggunakan tombol "+ Tambah Surat Ke Keranjang Setoran".
* **Lokasi Kode:** `guru/kbm-module.js` (`addHafalanKbmItem` baris 808–813 & `simpanJurnal` baris 2288–2290)
* **Root Cause Analysis:**
  Fungsi `addHafalanKbmItem()` mengumpulkan data setoran ke dalam objek `item` tanpa menyertakan field target hafalan:
  ```javascript
  // guru/kbm-module.js:808
  var item = {
    jenis: jenis, surat: surat, suratD: suratD,
    dari: dari, sampai: sampai, juz: juz,
    kel: kel, nil: nil, kam: kam, catatan: catatan,
    _saved: false
    // ⚠️ Field tgtSrt, tgtDari, tgtSmp TIDAK DISISIPKAN DI SINI!
  };
  ```
  Saat finalisasi di `simpanJurnal()`, payload dikirim ke backend dengan membaca `cache.tgtSrt`:
  ```javascript
  // guru/kbm-module.js:2288
  target_surat       : (idx === 0) ? (cache.tgtSrt || null) : null,
  target_ayat_dari   : (idx === 0) ? (cache.tgtDari || null) : null,
  target_ayat_sampai : (idx === 0) ? (cache.tgtSmp || null) : null,
  ```
  Karena `cache` berasal dari item keranjang yang tidak memiliki properti `tgtSrt`, maka `cache.tgtSrt` bernilai `undefined`, menyebabkan `target_surat` bernilai `NULL` di Supabase.

---

### 🔴 BUG #2 (DEAD CODE): Restorasi Form Editor `_restoreHafalanKbmCache` Tidak Pernah Dieksekusi

* **Gejala:** Pemulihan nilai form editor untuk draf legacy / single item tidak berjalan saat halaman dibuka kembali.
* **Lokasi Kode:** `guru/kbm-module.js` (Baris 1701 & 1715)
* **Root Cause Analysis:**
  ```javascript
  // Line 1701: Jika list kosong, fungsi langsung RETURN!
  if (!list.length) return;

  var first = list[0];
  ...
  // Line 1715: KONDISI INI TIDAK PERNAH BISA TRUE (UNREACHABLE / DEAD CODE)
  if (!list.length) {
    setSel('hfkbm-jenis-'+eid, first.jenis);
    setV('hfkbm-surat-'+eid,   first.surat);
    ...
  }
  ```
  Karena baris 1701 sudah melakukan `return` jika `!list.length`, maka blok `if (!list.length)` pada baris 1715 menjadi *unreachable dead code*.

---

### 🟡 BUG #3 (STATE LOSS): Target Hafalan Terhapus Saat Browser Di-refresh

* **Gejala:** Jika guru mengisikan Target Hafalan, memasukkan surat ke keranjang, lalu menguji refresh browser, Target Hafalan yang diketik langsung hilang dan kosong kembali.
* **Lokasi Kode:** `guru/kbm-module.js` (Baris 1681 - `_saveHafalanKbmCache`)
* **Root Cause Analysis:**
  ```javascript
  // Line 1681
  if (staged.length > 0) {
    return; // 👈 Menolak menyimpan input DOM jika keranjang sudah ada item
  }
  ```
  Karena `addHafalanKbmItem()` tidak menyimpan target ke item keranjang (Bug #1), dan `_saveHafalanKbmCache()` menolak membaca DOM ketika keranjang berisi item, maka Target Hafalan **tidak pernah ter-serialize ke `localStorage` maupun server `kbm_draft`**.

---

### 🟡 BUG #4 (RACE CONDITION / OVERWRITE): Status Kamera Murid Tertimpa Acak di `nilai_kbm`

* **Gejala:** Nilai status kamera murid pada Jurnal KBM berubah tidak konsisten jika terdapat lebih dari 1 item di keranjang.
* **Lokasi Kode:** `supabase/api-staff.js` (Baris 1482–1489 - `addSetoranHafalan`)
* **Root Cause Analysis:**
  ```javascript
  // supabase/api-staff.js:1482
  if (d.id_kbm && d.id_murid) {
    var { error: syncErr } = await _sb.from('nilai_kbm')
      .update({ kamera_murid: d.kamera || 'kamera terbuka' })
      .eq('id_kbm', d.id_kbm)
      .eq('id_murid', d.id_murid);
  }
  ```
  Ketika 1 murid memiliki 3 item setoran (misal Item 1: `Kamera Terbuka`, Item 2: `Kamera Tertutup`, Item 3: `` [kosong]), query `UPDATE` dijalankan 3x (*last-write-wins*). Item 3 yang bernilai kosong menimpa nilai item sebelumnya dengan nilai default `'kamera terbuka'`.

---

### 🟡 BUG #5 (UX / STATE LOSS): Perubahan Form Edit Terbuang Tanpa Peringatan

* **Gejala:** Saat guru menekan `✏️ Edit` pada item keranjang, mengubah nilainya di form, namun lupa menekan "+ Tambah" ulang sebelum mengeklik "Lanjut ke Jurnal", perubahan form terbuang diam-diam.
* **Lokasi Kode:** `guru/kbm-module.js` (`editHafalanKbmItem` & `simpanHafalanKBM`)
* **Root Cause Analysis:**
  Tombol edit mencabut item dari array `_hafalanKbmCache[mid]`. Jika masih ada item lain di keranjang (`staged.length > 0`), `_saveHafalanKbmCache()` mengabaikan form editor aktif, sehingga data yang sedang diedit hilang begitu saja.

---

### 🔵 BUG #6 (PARTIAL NETWORK FAILURE): Risiko Duplikasi Setoran Saat Re-submission

* **Gejala:** Terjadi duplikasi baris setoran di Supabase jika koneksi internet terputus di tengah-tengah proses finalisasi jurnal.
* **Lokasi Kode:** `guru/kbm-module.js` (Baris 2270–2294 - `simpanJurnal`)
* **Root Cause Analysis:**
  Loop `addSetoranHafalan` berjalan sekuensial per item. Jika item #1 sukses masuk Supabase, namun item #2 gagal akibat timeout jaringan:
  1. `simpanJurnal()` terhenti dan melempar toast error.
  2. `_clearKbmDraftLocal()` tidak dijalankan.
  3. Jika guru me-refresh halaman (memori JS `_saved` hilang) dan menekan tombol simpan ulang, item #1 yang sudah ada di Supabase akan ter-insert untuk **kedua kalinya**.

---

## 🛠️ Rencana Perbaikan Lengkap (Step-by-Step Implementation Plan)

### Langkah 1: Isolasi & Standardisasi Storage Target Hafalan Level-Murid (Fix Bug #1 & #3)
* **File Target:** `guru/kbm-module.js`
* **Perubahan:**
  1. Buat storage terpisah untuk target hafalan murid: `window._hafalanKbmTarget = window._hafalanKbmTarget || {};`
  2. Di fungsi `addHafalanKbmItem(mid)` & event handler input target, selalu update `window._hafalanKbmTarget[mid] = { tgtSrt, tgtDari, tgtSmp }`.
  3. Di `_saveHafalanKbmCache()`, simpan `target` ke dalam draf JSON: `draf.target = window._hafalanKbmTarget`.
  4. Di `_restoreHafalanKbmCache()`, pulihkan nilai target dari `draf.target` atau `window._hafalanKbmTarget[mid]`.
  5. Di `simpanJurnal()`, baca target dari `window._hafalanKbmTarget[m.id_murid]` untuk disisipkan pada item pertama (`idx === 0`).

---

### Langkah 2: Perbaikan Logika Dead Code `_restoreHafalanKbmCache` (Fix Bug #2)
* **File Target:** `guru/kbm-module.js`
* **Perubahan:**
  1. Ganti kondisi `if (!list.length)` pada baris 1715 menjadi pengecekan apakah form editor perlu diisi dari draf item tunggal legacy.
  2. Pastikan form input terisi dengan benar saat hanya ada 1 draf setoran tanpa merusak tampilan staged list jika ada multi-item.

---

### Langkah 3: Proteksi Sync Kamera `addSetoranHafalan` (Fix Bug #4)
* **File Target:** `supabase/api-staff.js`
* **Perubahan:**
  1. Pada `addSetoranHafalan`, update `kamera_murid` di `nilai_kbm` **HANYA jika `d.kamera` terisi (non-empty)**:
     ```javascript
     if (d.id_kbm && d.id_murid && d.kamera) {
       await _sb.from('nilai_kbm')
         .update({ kamera_murid: d.kamera })
         .eq('id_kbm', d.id_kbm)
         .eq('id_murid', d.id_murid);
     }
     ```

---

### Langkah 4: Auto-Check & Alert Unsaved Form Item (Fix Bug #5)
* **File Target:** `guru/kbm-module.js`
* **Perubahan:**
  1. Di `simpanHafalanKBM()`, tambahkan pengecekan: Jika field form editor (`hfkbm-surat-`, `hfkbm-ayat-dari-`, dll) terisi data valid tetapi belum dimasukkan ke keranjang (`staged.length > 0`), tampilkan konfirmasi/toast:
     *"Ada setoran di form yang belum dimasukkan ke keranjang. Otomatis tambahkan?"*

---

### Langkah 5: Penanganan Partial Network Failure & Resilience (Fix Bug #6)
* **File Target:** `guru/kbm-module.js`
* **Perubahan:**
  1. Bungkus loop insert `addSetoranHafalan` per item dalam `try...catch`.
  2. Tandai item yang sudah sukses tersimpan di draf persistent (`item._saved = true`) dan simpan draf lokal secara instan.
  3. Jika terjadi error di tengah jalan, tampilkan pesan warning dengan tombol *"Lanjutkan Menyimpan Sisa Item"*, sehingga item yang sudah masuk tidak akan di-insert ulang.

---

## 📋 Checklist Verifikasi Pasca-Fix

- [ ] Target Hafalan terisi di DB Supabase pada baris setoran pertama saat menggunakan keranjang multi-surat.
- [ ] Target Hafalan tidak hilang dari UI setelah browser di-refresh.
- [ ] Restorasi draf dari `localStorage` memulihkan seluruh item keranjang dan form target dengan tepat.
- [ ] Status kamera di `nilai_kbm` tidak tertimpa oleh item ber-kamera kosong.
- [ ] Peringatan muncul jika ada data di form editor yang belum ditekan "+ Tambah".
- [ ] Simulasi kegagalan koneksi tidak menyebabkan duplikasi data setoran di database.
