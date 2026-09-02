# RENCANA — Enhancement Desain & Fungsi Halaman Sesi KBM (Portal Guru)

> Tanggal: 2026-08-28 · Status: siap implementasi
> Cakupan: penataan ulang visual (pola `saranberanda.md`) + revamp wizard Buka Sesi. Step 2–4 (Presensi → Nilai/Hafalan/Assessment → Jurnal) **dirapikan tapi alurnya dipertahankan**.

---

## 1. Tujuan

1. Step 1 "Buka Sesi" menjadi **wizard 3 sub-step** yang jelas: Pilih Halaqah → Detail Sesi → Persiapan, menggantikan satu halaman panjang yang menumpuk form + checklist + kartu libur.
2. Hapus dead code & sisa iterasi (`sesiBanner`/`updateSesiBanner`, input dummy `visibility:hidden`, komentar step dobel, label `Step X/4` hardcoded, jenis "Lainnya" yang dead-end).
3. Seragamkan gaya visual ke flat design (kartu libur oranye gradient, persiapan hijau gradient) + perbaiki layout mobile HP.
4. Satu pintu masuk sesi: quick-start dashboard & kelas pengganti masuk ke wizard yang sama — tidak ada lagi dua jalur pembukaan sesi.

## 2. Keputusan Desain (sudah dikonfirmasi user)

| # | Keputusan | Pilihan |
|---|---|---|
| D1 | Bentuk revamp | **Wizard penuh di Buka Sesi** (3 sub-step); step 2–4 dirapikan saja |
| D2 | Quick-start dashboard (`mulaiSesiBaruCepat`) | Masuk wizard langsung di **sub-step Detail** (halaqah terisi) |
| D3 | Jenis sesi "Lainnya" | **Dihapus dari UI** (DB & riwayat lama tidak disentuh) |
| D4 | Checklist persiapan | Tetap **wajib** dicentang semua sebelum tombol Buka Sesi aktif |
| D5 | Guard tanggal kelas pengganti | **Ya** — blokir Lanjut jika `is_pengganti` tercentang & tanggal masih default hari ini |
| D6 | Reset checklist libur tiap masuk halaman | **Ya** — `resetLiburCheck()` dipanggil di `goPage('kbm')` (saat ini bisa nyangkut) |
| D7 | Step "Buka Sesi" di step bar step 2–4 | **Tidak clickable** — hanya penanda posisi (kembali ke Step 1 = membatalkan konteks sesi yang sudah dibuka di server) |
| D8 | Validasi sub-step 2 | **Guard ringan** — tombol `Lanjut →` hanya aktif jika tanggal & jam terisi (default otomatis mengisi, jadi hampir selalu aktif) + guard pengganti (D5); validasi penuh tetap di `doBukaKBM` sebagai jaring pengaman |

Alasan D3: `getStepsDef()` di `kbm-module.js:2830` mengembalikan hanya 2 step untuk "Lainnya", sementara satu-satunya jalur penutup sesi (`doSelesaiKBM`) membaca field jurnal dari DOM halaman jurnal — sesi "Lainnya" **tidak bisa ditutup** = dead-end nyata. Riwayat/raport lama dengan `jenis_sesi='Lainnya'` tetap tampil normal (lihat §6).

## 3. Konteks Kode Penting (hasil penelusuran)

- `guru/index.html` (9.788 baris) — markup halaman: `page-kbm` (3161–3346), `page-presensi` (3349), `page-nilai-murid` (3372), `page-hafalan-kbm` (3398), `page-microteaching-kbm` (3415), `page-jurnal` (3457). CSS wizard dipakai bersama di `<style>` global file ini.
- `guru/kbm-module.js` (3.573 baris, IIFE, diekspor via `window.*` di akhir) — `doBukaKBM` (86), `lanjutSesi` (166), `renderSteps` (2836), `getStepsDef` (2803), `doSelesaiKBM` (2463), `kembaliKeStep1/2/3` (2009–2021).
- **Pembaca form Step 1** (jangan sampai ada yang yatim saat markup berubah):
  - `kbm-module.js:87-97` — `doBukaKBM` baca `kbmHalaqah/kbmTanggal/kbmJam/kbmJenis/kbmPertemuan/kbmIsPengganti`.
  - `guru/index.html:6507-6509` — `doTandaiLibur` baca `kbmHalaqah/kbmTanggal/kbmJenis` + `liburAlasan`.
  - `guru/index.html:8994` — `mulaiSesiBaruCepat` → `mulaiSesiHalaqah` (8126) mengisi `kbmHalaqah` + dispatch `change`.
  - `guru/jadwal-module.js:682-708` — kelas pengganti mengisi `kbmLevel/kbmHalaqah/kbmTanggal/kbmIsPengganti` + `selectKbmJenis(jenis)` lalu `scrollIntoView` ke `formBukaKBM`.
  - `guru/dashboard-module.js:90-102` — repopulasi `<select id="kbmHalaqah">`; **:164** memanggil `window.updateSesiBanner()`.
  - `guru/index.html:6392` `updateDraftWarning()` & `:6425` `updateLiburResmiBanner()` — men-show/hide `formBukaKBM`, `cardKelasLibur`, `draftWarning`, `liburResmiBanner`.
- Step bar: `renderSteps(current)` render ke 5 container `stepBar*`; `pageTitle.textContent` di-set manual di 9 tempat (`kbm-module.js:188,365,418,437,1693,2011,2018,2027,2034`) dengan label `Step X/4` hardcoded.
- State checklist: `_persiapanState` (3 item) & `_liburCheckState` (2 item) di `guru/index.html:8659-8746`, dengan `togglePersiapan/_updatePersiapanUI/resetPersiapan` dan `toggleLiburCheck/_updateLiburCheckUI/resetLiburCheck`. Tombol `btnMulai` disabled sampai 3/3.
- **Lifecycle penting**: `goPage('kbm')` di `index.html:6602-6611` selalu menjalankan `populateSel('kbmHalaqah')` + `updateSesiBanner()` + `updateDraftWarning()` + **`resetPersiapan()` (jika tidak ada sesi aktif)**. Artinya centangan persiapan SELALU di-reset tiap masuk halaman — wizard tidak boleh berasumsi mengingat centangan lintas kunjungan; dan penghapusan `updateSesiBanner` harus mencakup titik panggil ini (selain `dashboard-module.js:164`).
- `selectKbmJenis` (`kbm-module.js:389-408`) menyimpan array tile `['KBM Reguler','KBM Qiyam','Micro Teaching','Lainnya']` — penghapusan "Lainnya" menyentuh array ini juga. `onKbmHalaqahChange` (:368-387) mengatur tampil tile Qiyam (hanya level `Level Qiyam`) dan mengubah label tile Reguler menjadi **"KBM Daurah"** untuk level `Tahsin Al-Fatihah` — UI wizard harus mempertahankan dua perilaku ini.
- Default tanggal/jam diisi saat `DOMContentLoaded` (`index.html:6139-6140`, WIB via `_todayJakarta()`); kelas pengganti memakai `_ksTodayJakarta()` dari `jadwal-module.js:150`.
- Filter level yang bisa dipakai ulang untuk sub-step 1: pola pill `renderLevelPills/setLevelFilter` (`index.html:8105-8115`, dipakai halaman Jadwal).
- Kartu halaqah dashboard menampilkan `h.jadwal_hari` & `h.jam_mulai` (`dashboard-module.js:12-13`) — field ini tersedia di `halaqahList`; `sisa_pengganti` tersedia per jenis (`jadwal-module.js:172-177`).
- Saat ini **tidak ada jalur kembali ke Step 1** dari step 2–4 (hanya `kembaliKeStep2/3`); `kembaliKeStep1` hanya dipakai tombol "← Kembali" di Presensi.

## 4. Desain Baru — Wizard Buka Sesi (Step 1)

Struktur `page-kbm` baru (atas→bawah):

1. **Banner draft aktif** (`draftWarning`) — tidak berubah fungsinya; saat tampil, seluruh wizard & kartu libur disembunyikan (logika `updateDraftWarning` tetap).
2. **Banner libur resmi** (`liburResmiBanner`) — tidak berubah.
3. **Wizard card** (`#formBukaKBM` dipertahankan sebagai container agar show/hide lama tetap jalan):
   - **Mini step indicator** (3 titik): `1 Halaqah · 2 Detail · 3 Persiapan` — render dari satu state `_wizStep`.
   - **Sub-step 1 — Pilih Halaqah**: daftar halaqah sebagai **kartu/chip** (nama, level, jadwal `jadwal_hari`+`jam_mulai`, label pertemuan berikutnya sesuai konteks jenis — Reguler/Daurah/Qiyam/Micro, memakai `pertemuan_ke_reguler/qiyam/microteach` yang sudah dipakai `autoFillPertemuan`). Halaqah yang jadwalnya hari ini (pakai `window._hariIniServer` dgn fallback device-local — pola yang sama dengan `mulaiSesiBaruCepat:9033-9040`) disorot & diurut teratas. Filter level memakai pola pill yang sudah ada (`renderLevelPills`, index.html:8105-8115) dengan state filter sendiri untuk wizard (jangan mengubah `_activeLevel` milik halaman Jadwal). Klik kartu → tulis ke `#kbmHalaqah` + dispatch `change` (memicu `autoFillPertemuan` + `onKbmHalaqahChange`) → lanjut sub-step 2. Jika hanya 1 halaqah: kartu tetap tampil terpilih (guru sadar pilihannya), tidak auto-skip.
   - **Sub-step 2 — Detail Sesi**: tile jenis sesi **3 opsi** (📖 KBM Reguler — label berubah "KBM Daurah" untuk Tahsin Al-Fatihah via `onKbmHalaqahChange`, 🕌 KBM Qiyam — tetap kondisional `display:none` untuk level non-Qiyam, 🎓 Micro Teaching), tanggal, jam, pertemuan ke- (placeholder auto via logika `autoFillPertemuan`), checkbox kelas pengganti (`kbmPenggantiWrap`). Header sub-step menampilkan ringkasan halaqah terpilih + tombol `← Ganti Halaqah`. **Hapus input dummy `visibility:hidden`** (index.html:3249-3252) — layout grid 1 kolom di mobile. **Guard ringan (D8)**: tombol `Lanjut →` disabled + hint kecil jika `kbmTanggal`/`kbmJam` dikosongkan, atau saat guard pengganti (D5) aktif; selain itu langsung aktif karena default otomatis terisi.
   - **Sub-step 3 — Persiapan**: konten checklist persiapan yang ada sekarang (3 item + progress bar + footer), digaya flat (hilangkan gradient hijau `.persiapan-wrap` → kartu border biasa, pertahankan warna aksen hijau). Tombol utama: `🌟 Mulai Perjuangan Baru` (= `btnMulai`/`doBukaKBM` lama), disabled sampai 3/3 (D4). Tombol `← Kembali` ke sub-step 2. **Perilaku reset dipertahankan**: `resetPersiapan()` tetap dipanggil tiap `goPage('kbm')` (index.html:6610) — guru yang bolak-balik ke halaman lain akan mengulang checklist; ini disengaja (pengingat niat per sesi), bukan bug.
4. **Kartu "Tidak Bisa Mengajar?"** (`cardKelasLibur`): dari kartu penuh gradient oranye menjadi **baris CTA sekunder collapsible** di bawah wizard ("📵 Tidak bisa mengajar hari ini? Tandai libur ▸"). Saat dibuka menampilkan form yang sama (`liburAlasan` + 2 checklist + `btnTandaiLibur`), digaya flat. Sumber halaqah/tanggal/jenis: baca dari pilihan wizard (sub-step 1/2); jika belum dipilih, minta guru memilih di wizard dulu (toast), karena `doTandaiLibur` membaca ID elemen yang sama.

### Kompatibilitas mundur Step 1
- **Pertahankan elemen tersembunyi** `#kbmLevel`, `#kbmHalaqah` (boleh `<select hidden>`), `#kbmJenis`, `#kbmTanggal`, `#kbmJam`, `#kbmPertemuan`, `#kbmIsPengganti` sebagai **single source of truth** — kartu halaqah & tile jenis hanyalah UI yang menulis ke elemen ini + memicu handler lama (`filterKbmHalaqah`, `autoFillPertemuan`, `onKbmHalaqahChange`, `selectKbmJenis`). Dengan cara ini `doBukaKBM`, `doTandaiLibur`, `mulaiSesiHalaqah`, `ksBukaKelasPengganti`, dan repopulasi `dashboard-module.js` **tidak perlu diubah sama sekali**.
- State wizard baru: `_wizStep` (1|2|3) + fungsi `wizGo(n)` / `wizNext()` / `wizBack()` (taro di `kbm-module.js`, ekspor ke `window`). `wizGo` juga menyinkronkan highlight kartu halaqah dari `#kbmHalaqah.value` (dipanggil lagi setelah `populateSel` di `goPage('kbm')` dan setelah repopulasi di `dashboard-module.js:92-103`, agar repopulasi tak menghilangkan highlight).
- `mulaiSesiHalaqah()` (index.html:8126): setelah mengisi `kbmHalaqah` + dispatch change, tambahkan `wizGo(2)` (D2). `ksBukaKelasPengganti` (jadwal-module.js:707): ganti `form.scrollIntoView` dengan `wizGo(2)`.
- `updateDraftWarning`/`updateLiburResmiBanner` tetap menyembunyikan `#formBukaKBM` & `#cardKelasLibur` — wizard ikut tersembunyi otomatis.
- **Guard tanggal kelas pengganti** (perbaikan kecil terkait): `ksBukaKelasPengganti` mengisi `kbmTanggal` hanya jika kosong (`jadwal-module.js:694-697`); karena `DOMContentLoaded` sudah mengisi default hari ini (index.html:6139), tanggal kelas pengganti diam-diam jadi "hari ini". Di sub-step 2, saat `kbmIsPengganti` tercentang DAN tanggal masih = hari ini (WIB), tampilkan hint inline "⚠️ Pilih tanggal pelaksanaan kelas pengganti" + blokir `Lanjut →` sampai tanggal diubah. (Terkonfirmasi user.)

## 5. Perapian Step 2–4 & Dead Code

- **Step bar jadi clickable**: `renderSteps` (kbm-module.js:2836) — step berstatus `done` **kecuali `kbm`** dirender sebagai tombol yang memanggil fungsi navigasi yang sudah ada (`kembaliKeStep2`, `kembaliKeStep3`); `kbm`/`active`/`pending` tetap non-klik (D7). Ini murni perubahan render, memakai jalur restore cache yang sudah teruji.
- **`pageTitle` terpusat**: buat `setStepTitle(stepId)` di `kbm-module.js` yang mengambil label dari `getStepsDef()` + menghitung posisi (`Presensi — Step 2/4` dinamis). Ganti 9 penulisan manual; panggil juga dari `renderSteps` supaya tidak bisa selip lagi.
- **Hapus dead code**:
  - `sesiBanner`/`sesiInfo` (index.html:3194-3195) + fungsi `updateSesiBanner` (kbm-module.js:151-164) + **semua** pemanggilnya: `dashboard-module.js:164` dan `index.html:6604` (di dalam blok `goPage('kbm')`).
  - Komentar dobel `STEP 4: JURNAL` / `STEP 3: HAFALAN QIYAM` (index.html:3396-3397).
  - Input dummy `visibility:hidden` (index.html:3249-3252).
  - Tile "Lainnya" (`btnKbmJenis-Lainnya`, index.html:3228-3230), entri `'Lainnya'` di array tile `selectKbmJenis` (kbm-module.js:394), cabang `Lainnya` di `getStepsDef` fallback (2830-2833) & `autoFillPertemuan` (index.html:8621) — sisakan fallback aman ke Reguler.
  - Label hardcoded `— Step 3/4` di markup `page-hafalan-kbm` (3401) & `page-microteaching-kbm` (3418).
- **Perbaikan kecil terkait (terkonfirmasi user)**: panggil `resetLiburCheck()` + kosongkan `liburAlasan` saat `goPage('kbm')` tanpa sesi aktif (blok index.html:6602-6611) — saat ini `_liburCheckState` bisa nyangkut dari kunjungan sebelumnya.
- **Flat design**: `.persiapan-wrap` gradient → flat (light + `theme-dark` var di :1801 disesuaikan); header gradient `cardKelasLibur` (:3316) → flat; pertahankan skema warna aksen (hijau=persiapan, oranye=libur).

## 6. Urutan Eksekusi (tiap tahap = 1 commit, diverifikasi sebelum lanjut — pola `saranberanda.md`)

1. **Tahap 1 — Dead code & cleanup** (risiko terendah): hapus `sesiBanner`+`updateSesiBanner`+pemanggilnya, komentar dobel, input dummy, label `Step X/4` hardcoded → ganti dengan `setStepTitle`. Verifikasi: tag-balance HTML, tidak ada referensi `sesiBanner` tersisa (`grep`), buka tutup step 1→4 manual.
2. **Tahap 2 — Wizard Step 1**: markup 3 sub-step + `_wizStep`/`wizGo` + kartu halaqah + mini step indicator; hidden inputs tetap diisi UI baru; hook `mulaiSesiHalaqah` & `ksBukaKelasPengganti` → `wizGo(2)`; hapus tile Lainnya + cabang kode terkait. Verifikasi: buka sesi Reguler/Qiyam/Micro end-to-end di mobile & desktop; kelas pengganti dari halaman Jadwal masuk ke sub-step 2 dengan checkbox tercentang.
3. **Tahap 3 — Kartu libur collapsible + flat design + reset libur (D6)**: CTA sekunder, style flat persiapan & libur (light+dark), `resetLiburCheck()` + clear `liburAlasan` di `goPage('kbm')`. Verifikasi: tandai libur dengan & tanpa halaqah terpilih; centangan libur tidak nyangkut saat keluar-masuk halaman; `batalkanDanTandaiLibur` tetap jalan.
4. **Tahap 4 — Step bar clickable + rapikan step 2–4**: `renderSteps` render tombol untuk step `done`; judul `pageTitle` dinamis. Verifikasi: loncat mundur dari Jurnal → Presensi → maju lagi, data nilai/presensi/hafalan tetap ter-restore (cache `_nilaiCache`, `_presensiState`, draft lokal `_saveKbmDraftLocal` tidak tersentuh).
5. **Tahap 5 — Verifikasi menyeluruh** (lihat §7) + bump cache (`?v=` di `guru/index.html` script/css tags + `CACHE_NAME` di `sw.js`) sesuai konvensi proyek agar HP tidak menjalankan JS lama (lihat `RENCANA_fix-sesi-rls-kbm-hp.md` §3.4-3.5).

## 7. Validasi

- **Sintaks**: `node --check` untuk setiap file JS yang disentuh (atau ekstraksi inline script index.html); cek tag-balance HTML setelah edit markup wizard.
- **Fungsional (manual/Playwright di HP & desktop)**:
  1. Buka sesi baru tiap jenis (Reguler, Qiyam, Micro Teaching) lewat wizard → presensi → nilai/hafalan/assessment → jurnal → selesai. Draft lokal & banner draft berfungsi di tiap titik.
  2. Quick-start dashboard: 1 halaqah (langsung sub-step 2) & multi-halaqah (modal → sub-step 2).
  3. Kelas pengganti dari Jadwal → wizard sub-step 2, `kbmIsPengganti` tercentang, toast benar; **guard D5**: Lanjut terblokir + hint tampil jika tanggal masih hari ini, terbuka setelah tanggal diubah.
  4. Draft aktif → banner tampil, wizard tersembunyi; Lanjutkan / Tandai Libur / Hapus berfungsi.
  5. Libur resmi (`window._liburResmiHariIni`) → wizard tersembunyi, banner tampil.
  6. Tandai libur (form collapsible) dengan checklist + alasan; tombol disabled sebelum lengkap; keluar-masuk halaman KBM → checklist libur kembali kosong (D6).
  7. Klik step `done` (Presensi/Nilai/Jurnal) di step bar mundur/maju tanpa kehilangan input; step "Buka Sesi" tidak bisa diklik (D7).
  8. Checklist persiapan ter-reset saat keluar-masuk halaman KBM (perilaku lama yang dipertahankan), tapi pilihan halaqah & posisi wizard (`_wizStep`) tetap tersimpan selama sesi halaman yang sama.
  9. Dark mode: kartu wizard, persiapan, libur terbaca baik.

## 8. Risiko & Mitigasi

- **Referensi ID form lama** — mitigasi: hidden inputs sebagai single source of truth (§4), `grep` semua `getElementById('kbm...')` sebelum/sesudah untuk memastikan tak ada yang yatim.
- **`dashboard-module.js` repopulasi `kbmHalaqah`** menimpa pilihan kartu — mitigasi: setelah repopulasi, sinkronkan highlight kartu halaqah dari `kbmHalaqah.value`.
- **Data lama `jenis_sesi='Lainnya'`** — tidak disentuh; riwayat/raport membaca dari DB, bukan dari tile. Cabang kode `Lainnya` yang dihapus hanya di jalur *pembukaan* sesi.
- **Guru di tengah sesi saat deploy** — draft lokal (`hq_kbm_draft_*`) & `sesiAktif` di server tidak terpengaruh perubahan markup; banner draft mengambil alih layar. Bump cache wajib (Tahap 5) agar tidak ada campuran HTML baru + JS lama.
- **Guard tanggal pengganti false-positive** — guru yang MEMANG mengadakan kelas pengganti hari ini harus tetap bisa: guard hanya memblokir jika tanggal masih sama persis default hari ini (belum disentuh guru). Mitigasi: bandingkan dengan flag "tanggal diubah manual" (set di event `change`/`input` `kbmTanggal`), bukan nilai tanggalnya semata — jika guru sengaja memilih hari ini, flag ter-set dan Lanjut terbuka.
- **`resetPersiapan` tiap masuk halaman** — guru yang sudah centang 3 item lalu pindah halaman akan mengulang. Ini perilaku lama yang dipertahankan; jangan "memperbaiki" dengan mengingat centangan (risiko guru asal lewat).
- **Jangan sentuh**: logika `doBukaKBM`, `doSimpanPresensi`, `doSelesaiKBM`, sistem draft lokal/server, API `GuruAPI`. Perubahan hanya lapisan presentasi + navigasi.

## 9. Out of Scope

- Perubahan schema DB / SQL patch apa pun.
- Perubahan flow nilai, hafalan Qiyam, rubrik Micro Teaching, jurnal/PR (hanya kulit & navigasi).
- Auto-save presensi, redesign step 2–4 di luar perapian.
- Portal murid/admin.
